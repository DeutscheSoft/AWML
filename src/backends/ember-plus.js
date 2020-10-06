import { Backend } from './backend.js';
import { registerBackendType } from '../components/backend.js';
import { warn } from '../utils/log.js';
import { subscribeDOMEvent } from '../utils/subscribe_dom_event.js';
import { getCurrentWebSocketUrl } from '../utils/fetch.js';

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
  'isOnline'
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
  'streamDescriptor'
];

export class EmberPlusBackend extends Backend {
  get src() {
    return this._src;
  }

  get device() {
    return this._device;
  }

  constructor(options) {
    super(options);

    const args = [ options.url ];

    if (options.protocol !== null)
      args.push(options.protocol);

    const websocket = new WebSocket(...args);
    this._websocket = websocket;
    this._device = null;
    this._path_subscriptions = new Map();
    this._setters = new Map();
    this._delimiter = '/';
    this.addSubscription(
      subscribeDOMEvent(websocket, 'open', () => {
        try {
          const connection = new EmberPlus.WebSocketConnection(this._websocket);

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

    if (parentPath === '/' && propertyName === '')
    {
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
          this.log('Could not list directory for child %o in parameter Node %o',
                   parameterName, node);
        } else {
          if (ParameterProperties.includes(propertyName)) {
            if (propertyName === 'value') {
              this._setters.set(path, (value) => {
                this._device.setValue(node, value);
              });
            }

            return node.observeProperty(propertyName, callback);
          } else if (propertyName === 'effectiveValue') {
            this._setters.set(path, (value) => {
              this._device.setEffectiveValue(node, value);
            });
            return node.observeEffectiveValue(callback);
          } else if (propertyName === 'effectiveMinimum') {
            return node.observeEffectiveMinimum(callback);
          } else if (propertyName === 'effectiveMaximum') {
            return node.observeEffectiveMaximum(callback);
          } else {
            this.log('Property %o does not exist on Parameter Node.',
                     propertyName);
          }
        }
      } else {
        // Special meaning, this is not a child
        if (propertyName.startsWith('$') && !dir) {
          const tmp = propertyName.substr(1);

          if (NodeProperties.includes(tmp)) {
            return node.observeProperty(tmp, callback);
          }
        }

        const childNames = node.children.map((child) => child.identifier);
        const pos = childNames.indexOf(propertyName);

        if (pos === -1)
        {
          this.log('Could not find child %o in node children %o',
                   parameterName, node.children);
        }
        else
        {
          const child = node.children[pos];

          if (dir && !(child instanceof EmberPlus.Parameter)) {
            return this._device.observeDirectory(child, callback);
          } else {
            this.receive(path, child);
          }
        }
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

    let url;

    if (src === null) {
      url = getCurrentWebSocketUrl().href;
    } else if (src.startsWith('/')) {
      const current = getCurrentWebSocketUrl();
      url = new URL(src, current).href;
    } else {
      url = src;
    }

    const batch = node.hasAttribute('batch') ? parseInt(node.getAttribute('batch')) : 0;

    const protocol = node.getAttribute('protocol');

    options.url = url;
    options.batch = batch;
    options.protocol = protocol;

    return options;
  }
}

registerBackendType('emberplus', EmberPlusBackend);
