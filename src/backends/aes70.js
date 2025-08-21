import { BackendBase } from './backend_base.js';
import { warn } from '../utils/log.js';
import { subscribeDOMEvent } from '../utils/subscribe_dom_event.js';
import { getCurrentWebSocketUrl } from '../utils/fetch.js';
import { connectWebSocket } from '../utils/connect_websocket.js';
import { combineUnsubscribe } from '../utils/combine_unsubscribe.js';

import { runCleanupHandler } from '../utils/run_cleanup_handler.js';
import { ReplayObservable } from './replay_observable.js';
import { ReplayObservableMap } from './replay_observable_map.js';
import { forEachAsync } from './for_each_async.js';
import { dispatch } from '../utils/dispatch.js';

function splitAtLast(path, seperator) {
  const pos = path.lastIndexOf(seperator);

  return pos === -1
    ? [seperator, path]
    : [path.substr(0, pos + 1), path.substr(pos + 1)];
}

const toplevelObjects = [
  'DeviceManager',
  'SecurityManager',
  'FirmwareManager',
  'SubscriptionManager',
  'PowerManager',
  'NetworkManager',
  'MediaClockManager',
  'LibraryManager',
  'AudioProcessingManager',
  'DeviceTimeManager',
  'TaskManager',
  'CodingManager',
  'DiagnosticManager',
  'Root',
];

function isBlock(o) {
  return typeof o === 'object' && typeof o.GetMembers === 'function';
}

class ObjectContext {
  hasSubscribers() {
    return false;
  }

  constructor(object) {
    this.object = object;
    this.info = {
      type: 'parameter',
      access: 'r',
      description: object.ClassName,
      id: 'o' + object.ObjectNumber,
    };
  }

  set() {
    throw new Error('Read only.');
  }

  subscribe(callback) {
    callback(1, 0, this.object);
    return null;
  }

  dispose() {
    this.object = null;
  }
}

class ObjectDirectoryContext {
  constructor(object) {
    this.object = object;
    this.info = {
      type: 'directory',
      access: 'r',
      id: 'd' + object.ObjectNumber,
    };
  }

  set() {
    throw new Error('Read only.');
  }

  subscribe(callback) {
    callback(1, 0, [this.object]);
    return null;
  }

  dispose() {
    this.object = null;
  }
}

class PropertyDirectoryContext {
  constructor(object, property) {
    this.object = object;
    this.property = property;
    this.info = {
      type: 'directory',
      access: 'r',
      description: property.name + ' in ' + object.ClassName,
      id: 'o' + object.ObjectNumber + 'pd' + property.name,
    };
  }

  set() {
    throw new Error('Read only.');
  }

  subscribe(callback) {
    callback(1, 0, [this.object, this.property]);
    return null;
  }

  dispose() {
    this.object = null;
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

class PropertyImplementedContext extends ContextWithValue {
  constructor(backend, path, object, property) {
    super();
    this.backend = backend;
    this.path = path;
    this.property = property;
    this.object = object;
    this.info = {
      type: 'parameter',
      access: 'r',
      id: 'o' + object.ObjectNumber + 'pI' + property.name,
    };

    if (!property.getter(object)) {
      throw new Error(
        `Could not subscribe to private property ${object.ClassName}.${property.name}`
      );
    }
  }

  subscribe(callback) {
    if (this.property.static) {
      callback(1, 0, true);
      return () => {};
    }

    return this.backend.observeByPath(this.path, (ok, last, value) => {
      if (ok) {
        callback(1, 0, true);
      } else {
        // NotImplemented
        if (
          typeof value === 'object' &&
          'status' in value &&
          value.status.value === 8
        ) {
          callback(1, 0, false);
        } else {
          callback(0, 0, value);
        }
      }
    });
  }

  dispose() {
    this.backend = null;
    this.object = null;
    this.property = null;
  }
}

class PropertyContext extends ContextWithValue {
  constructor(object, property, index) {
    super();
    this.object = object;
    this.property = property;
    this.index = index;
    this.getter = property.getter(object);
    this.setter = index === 0 ? property.setter(object) : null;
    this.event = property.event(object);
    this.info = {
      type: 'parameter',
      access: this.setter ? 'rw' : 'r',
      id: 'o' + object.ObjectNumber + 'p' + index + property.name,
    };

    if (property.static) {
      if (index)
        throw new Error(
          `Static property ${object.ClassName}.${property.name} has no Min/Max.`
        );
    } else if (!this.getter) {
      throw new Error(
        `Could not subscribe to private property ${object.ClassName}.${property.name}`
      );
    }
  }

  _observeGetter(callback) {
    let active = true;

    this.getter().then(
      (returnValues) => {
        if (!active) return;
        const index = this.index;
        let value;
        if (
          typeof returnValues === 'object' &&
          typeof returnValues.item === 'function' &&
          index < returnValues.length
        ) {
          value = returnValues.item(index);
        } else if (!index) {
          value = returnValues;
        } else {
          callback(
            0,
            0,
            new Error(
              `${this.object.ClassName}.${this.property.name} has neither Min nor Max.`
            )
          );
          return;
        }

        callback(1, 0, value);
      },
      (error) => {
        if (!active) return;
        callback(0, 0, error);
      }
    );

    return () => {
      active = false;
    };
  }

  _observe(callback) {
    let getterPending = true;
    let needsDispatch = false;
    let unsubscribe = null;

    const eventHandler = (value, changeType) => {
      const changeTypeCode = changeType.value;
      switch (this.index) {
        case 0: // current
          // Note: All change types except for min and max
          // will result in the current value being updated. This also
          // includes e.g. items added to a list.
          if (changeTypeCode === 2 || changeTypeCode === 3) return;
          break;
        case 1: // min
          if (changeTypeCode !== 2) return;
          break;
        case 2: // max
          if (changeTypeCode !== 3) return;
          break;
        default:
          return;
      }

      // The reason for using this dispatch logic here is that the getter
      // resolve callback will fire one event loop after the one in which the
      // response was received over the network.
      // If we arrive here and have not received a result from the getter, yet,
      // which means that the response will be interleaved with notifications
      // and in order to preserve the order of events from the network we must
      // dispatch all events by one event loop.
      if (getterPending && !needsDispatch) needsDispatch = true;

      if (needsDispatch) {
        dispatch(() => {
          if (unsubscribe === null) return;
          callback(1, 0, value);
        });
      } else {
        callback(1, 0, value);
      }
    };

    this.event.subscribe(eventHandler).catch((error) => {
      if (unsubscribe === null) return;
      callback(0, 0, error);
    });

    unsubscribe = combineUnsubscribe(
      () => this.event.unsubscribe(eventHandler),
      this._observeGetter((ok, last, value) => {
        getterPending = false;
        callback(ok, last, value);
      })
    );

    return () => {
      const _unsubscribe = unsubscribe;
      if (_unsubscribe === null) return;
      unsubscribe = null;
      _unsubscribe();
    };
  }

  _subscribe(callback) {
    if (this.property.static) {
      callback(1, 0, this.object[this.property.name]);
      return () => {};
    }

    if (this.event) return this._observe(callback);

    return this._observeGetter(callback);
  }

  set(value) {
    if (this.setter) return this.setter(value);

    throw new Error('This property has no setter.');
  }
}

class RoleMapContext extends ContextWithValue {
  constructor(object) {
    super();
    if (!isBlock(object))
      throw new TypeError(`Expected OcaBlock, got ${object.ClassName}`);
    this.object = object;
    this.info = {
      type: 'directory',
      access: 'r',
      id: 'd' + object.ObjectNumber,
    };
  }

  _subscribe(callback) {
    const onError = (err) => {
      if (callback === null) return;
      callback(0, 0, err);
    };

    const block = this.object;

    const membersCallback = (members, roles) => {
      const rolemap = new Map();

      for (let i = 0; i < members.length; i++) {
        const role = roles[i];
        let key = role;

        if (rolemap.has(key)) {
          let n = 1;
          do {
            key = role + n++;
          } while (rolemap.has(key));
        }
        rolemap.set(key, members[i]);
      }

      callback(1, 0, [this.object, rolemap]);
    };

    // ono -> OcaRoot
    const members = new Map();
    // OcaRoot -> string
    const roles = new Map();

    // Array<OcaRoot>
    let last_members;

    const device = block.device;

    const publish = () => {
      // unsubscribed
      if (callback === null) return;

      const roleNames = new Array(last_members.length);

      for (let i = 0; i < last_members.length; i++) {
        const o = last_members[i];

        // this may happen if we get a new member list before we manage to fetch
        // all roles. In that case, we simply abort here and wait for things to
        // complete.
        if (!roles.has(o)) return;
        roleNames[i] = roles.get(o);
      }

      membersCallback(last_members, roleNames);
    };

    const onMembers = (a) => {
      // unsubscribed
      if (callback === null) return;

      const tasks = [];

      const tmp = a.map((member) => {
        const objectNumber = member.ONo;

        // we already know this member
        if (members.has(objectNumber)) {
          return members.get(objectNumber);
        } else {
          const o = device.resolve_object(member);
          members.set(objectNumber, o);
          const p = o.GetRole().then((rolename) => {
            // the members may have changed since then, simply
            // ignore this result.
            if (members.get(objectNumber) === o) {
              roles.set(o, rolename);
            }
          }, onError);
          tasks.push(p);
          return o;
        }
      });

      last_members = tmp;

      // remove all object which have disappeared.
      const objectNumbers = new Set(a.map((member) => member.ONo));
      const deleted = Array.from(members.keys()).filter(
        (ono) => !objectNumbers.has(ono)
      );

      deleted.forEach((ono) => {
        const o = members.get(ono);

        members.delete(ono);
        roles.delete(o);
      });

      if (!tasks.length) {
        // we are done
        publish();
      } else {
        Promise.all(tasks).then(publish);
      }
    };

    block.OnMembersChanged.subscribe(onMembers);
    block.GetMembers().then(onMembers, onError);

    return () => {
      // unsubscribe
      if (callback === null) return;
      block.OnMembersChanged.unsubscribe(onMembers);
      callback = null;
    };
  }
}

function getDirectoryContext(object) {
  if (isBlock(object)) {
    return new RoleMapContext(object);
  } else {
    return new ObjectDirectoryContext(object);
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
 * This class implements a backend for AES70 devices. It uses AES70.js
 * https://github.com/DeutscheSoft/AES70.js which is required to be loaded
 * as one global ``OCA`` symbol. It is usually enough to include
 * ``AES70.es5.js`` alongside this backend.
 *
 * The paths used to represent objects and properties of the AES70 device in
 * this backend follow these rules.
 *
 * - The path of an object is given by the concatenation of all role names up
 *   to the root block delimited by ``/``.
 * - The path of a property is given by the paths of the corresponding object
 *   concatenated by ``/`` and the property name.
 * - The path for minimum and maximum values for a property (if defined) are
 *   given by the properties path followed by ``/Min`` and ``/Max``, respectively.
 * - The path of a property followed by ``/Implemented`` will emit ``true`` or
 *   ``false`` depending on whether or not the corresponding getter is
 *   implemented or not.
 *
 * Furthermore, it is possible to subscribe to directory contents inside of
 * blocks. These are given by the path of the object followed by a single ``/``.
 * This paths will emit an array with two elements, the first the block itself
 * and the second a `Map` which contains all children by their role name in
 * order. For example, the content of the root block can be subscribed as the
 * path ``/``.
 *
 * Note that AES70 does not guarantee, only recommend, that all siblings of a
 * block have unique role names. In order to generate unique path names, this
 * backend will make object paths unique by appending ``1``, ``2``, etc..
 *
 * This backend is available with the ``AWML-BACKEND`` component using the type
 * ``aes70``.
 */
export class AES70Backend extends BackendBase {
  /** @internal */
  get src() {
    return this._src;
  }

  /**
   * The OCA.RemoteDevice object.
   */
  get device() {
    return this._device;
  }

  _connectWebSocket() {
    return connectWebSocket(this.options.url);
  }

  async _connectDevice(options) {
    /* global OCA */

    if (typeof OCA === 'undefined') {
      warn('Cannot find AES70.js library. Missing a script include?');
    }

    const websocket = await this._connectWebSocket();

    return new OCA.RemoteDevice(
      new OCA.WebSocketConnection(websocket, options)
    );
  }

  async _connect() {
    // discover the device
    const options = {
      batch: this.options.batch,
    };

    const device = await this._connectDevice(options);

    // The backend has been destroyed while the connect
    // was still pending.
    if (!this.isInit) {
      this.log('Backend was closed during setup.');
      device.close();
      return;
    }

    this._device = device;
    device.set_keepalive_interval(1);
    this.addSubscription(
      subscribeDOMEvent(device, 'close', () => {
        this.close();
      }),
      subscribeDOMEvent(device, 'error', (err) => {
        this.error(err);
      }),
      this.subscribeEvent('destroy', () => {
        device.close();
      })
    );
    this.open();
  }

  constructor(options) {
    super(options);
    this._device = null;
    this._seperator = '/';
    // Map<ID,Context>
    this._contexts = new Map();
    // Map<path,ContextObservable>
    this._contextObservables = new ReplayObservableMap((path) =>
      this._createContextObservable(path)
    );
    this._connect().catch((err) => {
      if (this.isInit) this.error(err);
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

  _createContextObservable(path) {
    return new ContextObservable((callback) => {
      const seperator = this._seperator;
      const dir = path.endsWith(seperator);
      const [parentPath, propertyName] = splitAtLast(
        dir ? path.substr(0, path.length - 1) : path,
        seperator
      );

      // we are at the top level
      if (parentPath === '/') {
        if (propertyName == '') {
          const ctx = new RoleMapContext(this.device.Root);
          const sub = this.registerContext(ctx);
          callback(1, 0, ctx);
          return sub;
        } else if (toplevelObjects.indexOf(propertyName) !== -1) {
          const o = this.device[propertyName];
          const ctx = dir ? getDirectoryContext(o) : new ObjectContext(o);
          const sub = this.registerContext(ctx);
          callback(1, 0, ctx);
          return sub;
        }
      }

      let cb;

      if (dir) {
        //console.log('trying to subscribe directory %o in %o', propertyName, parentPath);
        cb = (ok, last, a) => {
          if (!ok) {
            callback(0, last, a);
            return null;
          }
          //console.log('%o / %o -> %o', parentPath, propertyName, a);
          const o = a[0];
          let rolemap;

          if (isBlock(o) && a[1] instanceof Map) {
            rolemap = a[1];
            const o = rolemap.get(propertyName);

            if (o) {
              const ctx = getDirectoryContext(o);
              const sub = this.registerContext(ctx);
              callback(1, 0, ctx);
              return sub;
            }
          }

          // check the properties, this is for meta-info lookup
          const property = o.get_properties().find_property(propertyName);

          if (!property) {
            this.logPropertyNotFound(path, propertyName, o, rolemap);
            if (!isBlock(o)) {
              callback(
                0,
                0,
                new Error(`Could not find property ${propertyName} at ${path}.`)
              );
            }
          } else {
            const ctx = new PropertyDirectoryContext(o, property);
            const sub = this.registerContext(ctx);
            callback(1, 0, ctx);
            return sub;
          }
        };
      } else {
        //console.log('trying to subscribe property %o in %o', propertyName, parentPath);
        cb = (ok, last, a) => {
          if (!ok) {
            callback(0, last, a);
            return null;
          }

          const o = a[0];

          if (isBlock(o) && a[1] instanceof Map) {
            const rolemap = a[1];

            if (rolemap && rolemap.has(propertyName)) {
              const ctx = new ObjectContext(rolemap.get(propertyName));
              const sub = this.registerContext(ctx);
              callback(1, 0, ctx);
              return sub;
            }

            // try property lookup
            const property = o.get_properties().find_property(propertyName);

            if (!property) {
              this.logPropertyNotFound(path, propertyName, o, rolemap);
              return null;
            }

            const ctx = new PropertyContext(o, property, 0);
            const sub = this.registerContext(ctx);
            callback(1, 0, ctx);
            return sub;
          } else if (a.length === 1) {
            // property lookup
            const property = o.get_properties().find_property(propertyName);

            if (!property) {
              this.logPropertyNotFound(path, propertyName, o);
              callback(
                0,
                0,
                new Error(`Could not find property ${propertyName}.`)
              );
              return null;
            }

            const ctx = new PropertyContext(o, property, 0);
            const sub = this.registerContext(ctx);
            callback(1, 0, ctx);
            return sub;
          } else if (a.length === 2) {
            const property = a[1];
            if (propertyName === 'Min' || propertyName === 'Max') {
              const index = propertyName === 'Min' ? 1 : 2;
              const ctx = new PropertyContext(o, property, index);
              const sub = this.registerContext(ctx);
              callback(1, 0, ctx);
              return sub;
            } else if (propertyName === 'Implemented') {
              const ctx = new PropertyImplementedContext(
                this,
                parentPath.slice(0, parentPath.length - 1),
                o,
                property
              );
              const sub = this.registerContext(ctx);
              callback(1, 0, ctx);
              return sub;
            } else {
              this.logPropertyNotFound(path, propertyName, o);
              callback(
                0,
                0,
                new Error(`Could not find property ${propertyName}.`)
              );
              return null;
            }
          }
        };
      }

      return this._observeEach(
        parentPath === seperator ? 'Root' + seperator : parentPath,
        cb
      );
    });
  }

  logPropertyNotFound(path, propertyName, o, rolemap) {
    if (!isBlock(o)) {
      const propertyNames = [];
      o.get_properties().forEach((prop) => {
        propertyNames.push(prop.name);
      });
      this.log(
        'Could not find property %o in %o ( %s(%d) ). Available properties: %o',
        propertyName,
        path,
        o.ClassName,
        o.ObjectNumber,
        propertyNames
      );
    } else {
      if (rolemap) {
        this.log(
          'Could not currently find child %o in %o ( %s(%d) ). Available children: %o.',
          propertyName,
          path,
          o.ClassName,
          o.ObjectNumber,
          Array.from(rolemap.keys())
        );
      } else {
        this.log(
          'Could not currently find child %o in %o ( %s(%d) ).',
          propertyName,
          path,
          o.ClassName,
          o.ObjectNumber
        );
      }
    }
  }

  _observeContext(path, callback) {
    if (path === 'Root/') path = '/';
    return this._contextObservables.subscribe(path, callback);
  }

  setById(id, value) {
    const ctx = this._contexts.get(id);

    if (!ctx) throw new Error('Unknown property.');

    return ctx.set(value);
  }

  /** @internal */
  _observeEach(path, callback) {
    return forEachAsync((cb) => {
      return this.observeByPath(path, cb);
    }, callback);
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

  /** @internal */
  static argumentsFromNode(node) {
    const options = BackendBase.argumentsFromNode(node);

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

    const batch = node.hasAttribute('batch') ? parseInt(batch) : 0;

    options.url = url;
    options.batch = batch;

    return options;
  }
}
