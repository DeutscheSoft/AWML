import { Backend } from './backend.js';
import { registerBackendType } from '../components/backend.js';
import { warn } from '../utils/log.js';
import { subscribeDOMEvent } from '../utils/subscribe_dom_event.js';
import { getCurrentWebSocketUrl } from '../utils/fetch.js';
import { parseAttribute } from '../utils/parse_attribute.js';

/* global OCA */

if (typeof EmberPlus === 'undefined') {
  warn('Cannot find ember-plus library. Missing a script include?');
}

function runCleanupHandler(cleanup) {
  try {
    cleanup();
  } catch (error) {
    warn('Cleanup handler threw an exception:', error);
  }
}

function splitAtLast(path, delimiter) {
  const pos = path.lastIndexOf(delimiter);

  return pos === -1
    ? [delimiter, path]
    : [path.substr(0, pos + 1), path.substr(pos + 1)];
}

function unCurry(callback) {
  return (id, value) => {
    // if we get unsubscribed, we simply abort
    if (id === false) return;
    return callback(value);
  };
}

const NodeProperties = [
  'identifier',
  'number',
  'numericPath',
  'key',
  'isOnline',
];

const ParameterProperties = [
  'identifier',
  'number',
  'numericPath',
  'key',
  'description',
  'value',
  'minimum',
  'maximum',
  'access',
  'format',
  'enumeration',
  'factor',
  'isOnline',
  'formula',
  'step',
  'default',
  'type',
  'streamIdentifier',
  'enumMap',
  'streamDescriptor',
];

/**
 * This class implements a backend for the Ember+ protocol. It uses the
 * ember-plus https://github.com/DeutscheSoft/ember-plus which is required to be
 * loaded as the global symbol ``EmberPlus``.
 *
 * The paths used to represent objects follow the standard Ember+ naming
 * convention. The ``/`` character is used as delimiter. The following addresses
 * are supported:
 *
 * - Addresses of nodes or parameters will emit the corresponding object from
 *   the ember-plus library.
 * - Addresses of nodes appended with a ``/`` will emit the node object with
 *   children populated. It will emit another value whenever the children are
 *   changed.
 * - Adresses of nodes appended with ``/identifier`` will emit the node identifier,
 *   ``/number`` will emit the node number, ``/numericPath`` will emit the node
 *   numeric path, ``isOnline`` will emit the isOnline flag of the node.
 * - Adresses of parameters appended with ``/`` and ``identifier``, ``number``,
 *   ``numericPath``, ``key``, ``description``, ``value``, ``minimum``, ``maximum``,
 *   ``access``, ``format``, ``enumeration``, ``factor``, ``isOnline``, ``formula``,
 *   ``step``, ``default``, ``type``, ``streamIdentifier``, ``enumMap`` or
 *   ``streamDescriptor`` will emit the corresponding Ember+ field.
 * - Addresses of parameters appended with ``/effectiveValue``,
 *   ``/effectiveMinimum`` or ``/effectiveMaximum`` will emit the ``value``,
 *   ``minimum`` or ``maximum`` fields transformed according to the parameter
 *   fields such as ``factor``, ``step``, etc.
 *
 * All parameters except for ``/value`` and ``/effectiveValue`` are read-only.
 *
 * This backend is available with the ``AWML-BACKEND`` component using the type
 * ``emberplus``.
 */
export class EmberPlusBackend extends Backend {
  get url() {
    return this.options.url;
  }

  get protocol() {
    return this.options.protocol;
  }

  get device() {
    return this._device;
  }

  get fetchUrl() {
    return this.options.fetchUrl || this.fetchUrlDefault;
  }

  fetchUrlDefault() {
    return this.url;
  }

  get batch() {
    return this.options.batch;
  }

  constructor(options) {
    super(options);

    this._websocket = null;
    this._device = null;
    this._path_subscriptions = new Map();
    this._setters = new Map();
    this._delimiter = '/';

    Promise.resolve(this.fetchUrl())
      .then((url) => this.connect(url))
      .catch((err) => {
        if (!this.isInit) return;
        this.error(err);
      });
  }

  connect(src) {
    if (!this.isInit) return;

    let url;

    if (src === null) {
      url = getCurrentWebSocketUrl().href;
    } else if (src.startsWith('/')) {
      const current = getCurrentWebSocketUrl();
      url = new URL(src, current).href;
    } else {
      url = src;
    }

    const args = [url];

    if (this.protocol !== null) args.push(this.protocol);

    const websocket = new WebSocket(...args);
    this._websocket = websocket;
    this.addSubscription(
      subscribeDOMEvent(websocket, 'open', () => {
        try {
          const connection = new EmberPlus.WebSocketConnection(this._websocket);

          if (this.batch) connection.batch = this.batch;
          connection.setKeepaliveInterval(1000);
          this._device = new EmberPlus.Device(connection);

          this.open();
        } catch (err) {
          this.error(err);
        }
      }),
      subscribeDOMEvent(websocket, 'close', () => {
        this.close();
      }),
      subscribeDOMEvent(websocket, 'error', (err) => {
        this.error(err);
      })
    );
  }

  destroy() {
    super.destroy();

    const device = this._device;

    if (device) device.close();
  }

  set(id, value) {
    const setter = this._setters.get(id);

    if (!setter) {
      warn('%o is a readonly property.', id);
      return;
    }

    setter(value);
  }

  // returns CleanupLogic
  observe(path, callback) {
    if (typeof callback !== 'function')
      throw new TypeError('Expected function.');

    callback = unCurry(callback);

    let id = null;

    this.subscribe(path, callback).then(
      (a) => {
        if (id === false) {
          this.unsubscribe(a[1], callback);
          return;
        } else {
          id = a[1];
        }

        if (a.length === 3) {
          callback(id, a[2]);
        }
      },
      (err) => {
        warn('Subscription failed:', err);
      }
    );

    return () => {
      if (id !== null) {
        this.unsubscribe(id, callback);
      } else {
        // subscribe is still pending
        id = false;
      }
    };
  }

  _observeEach(path, callback, cmp) {
    let lastValue = null;
    let cleanup = null;

    const cb = (o) => {
      if (lastValue === o) return;
      if (cmp && cmp(lastValue, o)) return;
      if (cleanup) runCleanupHandler(cleanup);

      cleanup = callback(o);
    };

    let sub = this.observe(path, cb);

    return () => {
      if (cleanup) runCleanupHandler(cleanup);
      if (sub) runCleanupHandler(sub);
      sub = null;
      lastValue = null;
      cleanup = null;
    };
  }

  // Promise<CleanupLogic>
  doSubscribe(path) {
    const delimiter = this._delimiter;
    const dir = path.endsWith(delimiter);
    const [parentPath, propertyName] = splitAtLast(
      dir ? path.substr(0, path.length - 1) : path,
      delimiter
    );

    if (parentPath === '/' && propertyName === '') {
      // root Directory subscription
      return this._device.observeDirectory(this._device.root, (node) => {
        this.receive(path, node);
      });
    }

    const cb = (node) => {
      if (node === null) {
        // node disappeared (e.g. went offline)
        this._setters.delete(path);
        this.receive(path, void 0);
        return;
      }

      const callback = (value) => {
        this.receive(path, value);
      };

      if (node instanceof EmberPlus.Parameter) {
        if (dir) {
          this.log(
            'Could not list directory for child %o in parameter Node %o',
            propertyName,
            node
          );
        } else {
          if (ParameterProperties.includes(propertyName)) {
            if (propertyName === 'value') {
              this._setters.set(path, (value) => {
                this._device.setValue(node, value);
              });
            }

            return this._device.observeProperty(node, propertyName, callback);
          } else if (propertyName === 'effectiveValue') {
            this._setters.set(path, (value) => {
              this._device.setEffectiveValue(node, value);
            });
            return this._device.observerProperty(node, 'value', (value) => {
              callback(node.effectiveValue);
            });
          } else if (propertyName === 'effectiveMinimum') {
            return node.observeEffectiveMinimum(callback);
          } else if (propertyName === 'effectiveMaximum') {
            return node.observeEffectiveMaximum(callback);
          } else {
            this.log(
              'Property %o does not exist on Parameter Node.',
              propertyName
            );
          }
        }
      } else if (node instanceof EmberPlus.InternalNode) {
        // Special meaning, this is not a child
        if (propertyName.startsWith('$') && !dir) {
          const tmp = propertyName.substr(1);

          if (NodeProperties.includes(tmp)) {
            return node.observeProperty(tmp, callback);
          } else {
            this.log('Unknown node property %o', tmp);
            return;
          }
        }

        const childNames = node.children.map((child) => child.identifier);
        const pos = childNames.indexOf(propertyName);

        if (pos === -1) {
          this.log(
            'Could not find child %o in node children %o',
            propertyName,
            node.children
          );
        } else {
          const child = node.children[pos];

          if (dir && child instanceof EmberPlus.InternalNode) {
            return this._device.observeDirectory(child, callback);
          } else {
            this.receive(path, child);
          }
        }
      } else {
        this.log('Cannot find property %o inside of %o.', propertyName, node);
      }
    };

    // get a directory query for the parent object
    return this._observeEach(
      parentPath.endsWith(delimiter) ? parentPath : parentPath + delimiter,
      cb
    );
  }

  lowSubscribe(path) {
    try {
      const cleanup = this.doSubscribe(path);
      if (cleanup) this._path_subscriptions.set(path, cleanup);
      this._subscribeSuccess(path, path);
    } catch (error) {
      this._subscribeFailure(path, error);
    }
  }

  lowUnsubscribe(id) {
    const m = this._path_subscriptions;
    if (m.has(id)) {
      const sub = m.get(id);
      m.delete(id);
      runCleanupHandler(sub);
    }
    this._values.delete(id);
  }

  static argumentsFromNode(node) {
    const options = Backend.argumentsFromNode(node);

    const src = node.getAttribute('src');

    const batch = node.hasAttribute('batch')
      ? parseInt(node.getAttribute('batch'))
      : 0;

    const protocol = node.getAttribute('protocol');

    options.url = src;
    options.batch = batch;
    options.protocol = protocol;
    options.fetchUrl = null;

    {
      const tmp = node.getAttribute('fetch-url');
      const fetchUrl = tmp ? parseAttribute('javascript', tmp, null) : null;
      options.fetchUrl = fetchUrl;
    }

    return options;
  }
}

registerBackendType('emberplus', EmberPlusBackend);
