import { BackendBase } from './backend_base.js';
import { registerBackendType } from '../components/backend.js';
import { warn } from '../utils/log.js';
import { subscribeDOMEvent } from '../utils/subscribe_dom_event.js';
import { getCurrentWebSocketUrl } from '../utils/fetch.js';
import { parseAttribute } from '../utils/parse_attribute.js';

import { runCleanupHandler } from '../utils/run_cleanup_handler.js';
import { ReplayObservable } from './replay_observable.js';
import { ReplayObservableMap } from './replay_observable_map.js';
import { forEachAsync } from './for_each_async.js';

/* global EmberPlus */

if (typeof EmberPlus === 'undefined') {
  warn('Cannot find ember-plus library. Missing a script include?');
}

function splitAtLast(path, delimiter) {
  const pos = path.lastIndexOf(delimiter);

  return pos === -1
    ? [delimiter, path]
    : [path.substr(0, pos + 1), path.substr(pos + 1)];
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

const allParameterProperties = ParameterProperties.concat([
  'effectiveValue',
  'effectiveMinimum',
  'effectiveMaximum',
]);

class ObjectContext {
  hasSubscribers() {
    return false;
  }

  /**
   * @param {EmberPlus.Parameter|EmberPlus.Node} node
   */
  constructor(node) {
    this.node = node;
    this.info = {
      type: 'parameter',
      access: 'r',
      description: node.identifier,
      id: node.key,
    };
  }

  set() {
    throw new Error('Read only.');
  }

  subscribe(callback) {
    callback(1, 0, this.node);
    return null;
  }

  dispose() {
    this.node = null;
  }
}

class ContextWithValue extends ReplayObservable {
  _receive(ok, last, error) {
    if (!this.hasSubscribers()) {
      runCleanupHandler(this._subscription);
      this._subscription = null;
      this.hasValue = false;
      this.value = null;
    } else {
      super._receive(ok, last, error);
    }
  }
}

class NodeDirectoryContext extends ContextWithValue {
  constructor(device, node) {
    super();
    this.device = device;
    this.node = node;
    this.info = {
      type: 'directory',
      access: 'r',
      description: node.identifier,
      id: 'd' + node.key,
    };
  }

  _subscribe(callback) {
    return this.device.observeDirectory(this.node, (node) => {
      callback(1, 0, node);
    });
  }
}

class ParameterPropertyContext extends ContextWithValue {
  constructor(device, node, propertyName) {
    super();
    if (!allParameterProperties.includes(propertyName))
      throw new Error('No such parameter property.');

    this.device = device;
    this.node = node;
    this.propertyName = propertyName;
    this.info = {
      type: 'parameter',
      access:
        propertyName === 'value' || propertyName === 'effectiveValue'
          ? 'rw'
          : 'r',
      id: node.key + 'p' + propertyName,
    };
  }

  _subscribe(callback) {
    const { device, node, propertyName } = this;
    const cb = (value) => {
      callback(1, 0, value);
    };
    if (ParameterProperties.includes(propertyName)) {
      return device.observeProperty(node, propertyName, cb);
    } else if (propertyName === 'effectiveValue') {
      return device.observeProperty(node, 'value', (_) => {
        callback(1, 0, node.effectiveValue);
      });
    } else if (propertyName === 'effectiveMinimum') {
      return node.observeEffectiveMinimum(cb);
    } else {
      return node.observeEffectiveMaximum(cb);
    }
  }

  set(value) {
    const { device, node, propertyName } = this;

    if (propertyName === 'value') {
      return device.setValue(node, value);
    } else if (propertyName === 'effectiveValue') {
      return device.setEffectiveValue(node, value);
    } else {
      throw new Error('Read only.');
    }
  }
}

class NodePropertyContext extends ContextWithValue {
  constructor(device, node, propertyName) {
    super();
    if (!NodeProperties.includes(propertyName))
      throw new Error('No such node property.');

    this.device = device;
    this.node = node;
    this.propertyName = propertyName;
    this.info = {
      type: 'parameter',
      access: 'r',
      id: node.key + 'p' + propertyName,
    };
  }

  _subscribe(callback) {
    return this.node.observeProperty(this.propertyName, (value) => {
      callback(1, 0, value);
    });
  }

  set(value) {
    throw new Error('Read only.');
  }
}

class ContextObservable extends ReplayObservable {
  constructor(subscribe) {
    super();
    this._subscribe = (callback) => {
      try {
        return subscribe(callback);
      } catch (err) {
        callback(0, 0, err);
      }
    };
  }
}

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
export class EmberPlusBackend extends BackendBase {
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
    this._contextObservables = new ReplayObservableMap((path) =>
      this._createContextObservable(path)
    );
    this._contexts = new Map();

    Promise.resolve(this.fetchUrl())
      .then((url) => this.connect(url))
      .catch((err) => {
        if (!this.isInit) return;
        this.error(err);
      });
  }

  registerContext(ctx) {
    const contexts = this._contexts;
    const id = ctx.info.id;

    if (contexts.has(id)) {
      console.error(ctx);
      throw new Error('Context already registered.');
    }

    contexts.set(id, ctx);

    return () => {
      this._contexts.delete(id);
    };
  }

  _observeEach(path, callback) {
    return forEachAsync((cb) => {
      return this.observeByPath(path, cb);
    }, callback);
  }

  _createContextObservable(path) {
    return new ContextObservable((callback) => {
      const delimiter = this._delimiter;
      const dir = path.endsWith(delimiter);
      const [parentPath, propertyName] = splitAtLast(
        dir ? path.substr(0, path.length - 1) : path,
        delimiter
      );
      const device = this._device;

      if (parentPath === '/' && propertyName === '') {
        const ctx = dir
          ? new NodeDirectoryContext(device, device.root)
          : new ObjectContext(device.root);
        const sub = this.registerContext(ctx);
        callback(1, 0, ctx);
        return sub;
      }

      const cb = (ok, last, node) => {
        if (!ok) {
          callback(0, last, node);
          return null;
        }

        if (node === null) {
          // node disappeared (e.g. went offline)
          callback(0, 0, new Error('Not found.'));
          return null;
        }

        if (node instanceof EmberPlus.Parameter) {
          if (dir) {
            callback(
              0,
              0,
              new Error('Could not list directory for parameter Node.')
            );
          } else {
            try {
              const ctx = new ParameterPropertyContext(
                device,
                node,
                propertyName
              );
              const sub = this.registerContext(ctx);
              callback(1, 0, ctx);
              return sub;
            } catch (err) {
              callback(0, 0, err);
              return null;
            }
          }
        } else if (node instanceof EmberPlus.InternalNode) {
          // Special meaning, this is not a child
          if (propertyName.startsWith('$') && !dir) {
            try {
              const ctx = new NodePropertyContext(
                device,
                node,
                propertyName.substr(1)
              );
              const sub = this.registerContext(ctx);
              callback(1, 0, ctx);
              return sub;
            } catch (err) {
              callback(0, 0, err);
              return null;
            }
          }

          const childNames = node.children.map((child) => child.identifier);
          const pos = childNames.indexOf(propertyName);

          if (pos === -1) {
            callback(0, 0, new Error(`Could not find child ${propertyName} in node.`));
            return null;
          } else {
            const child = node.children[pos];

            if (dir && child instanceof EmberPlus.InternalNode) {
              const ctx = new NodeDirectoryContext(device, child);
              const sub = this.registerContext(ctx);
              callback(1, 0, ctx);
              return sub;
            } else {
              const ctx = new ObjectContext(child);
              const sub = this.registerContext(ctx);
              callback(1, 0, ctx);
              return sub;
            }
          }
        } else {
          this.log('Cannot find %o in %o.', propertyName, node);
          callback(0, 0, new Error(`Cannot find property ${propertyName}.`));
          return null;
        }
      };

      return this._observeEach(
        parentPath.endsWith(delimiter) ? parentPath : parentPath + delimiter,
        cb
      );
    });
  }

  _observeContext(path, callback) {
    return this._contextObservables.subscribe(path, callback);
  }

  observeInfo(path, callback) {
    //console.log('observeInfo', path);
    return this._observeContext(path, (ok, last, ctx) => {
      //console.log(path, ' context ', ctx);
      callback(ok, last, ok ? ctx.info : ctx);
    });
  }

  observeById(id, callback) {
    //console.log('observe(%o): ctx %o', id, this._contexts.get(id));
    return this._contexts.get(id).subscribe(callback);
  }

  setById(id, value) {
    const ctx = this._contexts.get(id);

    if (!ctx) throw new Error('Unknown property.');

    return ctx.set(value);
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

  static argumentsFromNode(node) {
    const options = BackendBase.argumentsFromNode(node);

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
