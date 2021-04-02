import { BackendBase } from './backend_base.js';
import { registerBackendType } from '../components/backend.js';
import { warn } from '../utils/log.js';
import { subscribeDOMEvent } from '../utils/subscribe_dom_event.js';
import { getCurrentWebSocketUrl } from '../utils/fetch.js';
import { connectWebSocket } from '../utils/connect_websocket.js';

import { runCleanupHandler } from '../utils/run_cleanup_handler.js';
import { ReplayObservable } from './replay_observable.js';
import { ReplayObservableMap } from './replay_observable_map.js';
import { forEachAsync } from './for_each_async.js';

/* global OCA */

if (typeof OCA === 'undefined') {
  warn('Cannot find AES70.js library. Missing a script include?');
}

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
      if (index) throw new Error('Static property has no Min/Max.');
    } else if (!this.getter) {
      throw new Error('Could not subscribe to private property.');
    }
  }

  _subscribe(callback) {
    if (this.property.static)
    {
      callback(1, 0, this.object[this.property.name]);
      return () => {};
    }

    let eventHandler = null;
    let active = true;

    const { getter, event, index } = this;

    if (event) {
      eventHandler = (value, changeType) => {
        switch (this.index) {
          case 0: // current
            if (changeType.value !== 1) return;
            break;
          case 1: // min
            if (changeType.value !== 2) return;
            break;
          case 2: // max
            if (changeType.value !== 3) return;
            break;
          default:
            return;
        }
        callback(1, 0, value);
      };
      event.subscribe(eventHandler).catch((err) => {
        callback(0, 0, err);
      });
    }

    getter().then(
      (x) => {
        if (!active) return;
        if (
          typeof x === 'object' &&
          typeof x.item === 'function' &&
          index < x.length
        ) {
          callback(1, 0, x.item(index));
        } else if (!index) {
          callback(1, 0, x);
        } else {
          callback(
            0,
            0,
            new Error(
              [
                this.property.name,
                ' in ',
                this.object.ClassName,
                ' has neither Min nor Max.',
              ].join('')
            )
          );
        }
      },
      (error) => {
        if (!active) return;
        callback(0, 0, error);
      }
    );

    return () => {
      if (!active) return;
      if (event) event.unsubscribe(eventHandler);
      active = false;
    };
  }

  set(value) {
    if (this.setter) return this.setter(value);

    throw new Error('This property has no setter.');
  }
}

class RoleMapContext extends ContextWithValue {
  constructor(object) {
    super();
    if (!isBlock(object)) throw new TypeError('Expected OcaBlock.');
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
    this._subscribe = subscribe;
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

  async _connect() {
    // discover the device
    const options = {
      batch: this.options.batch,
    };

    const websocket = await this._connectWebSocket();

    this._device = new OCA.RemoteDevice(
      new OCA.WebSocketConnection(websocket, options)
    );
    this._device.set_keepalive_interval(1);
    this.addSubscription(
      subscribeDOMEvent(websocket, 'close', () => {
        this.close();
      }),
      subscribeDOMEvent(websocket, 'error', (err) => {
        this.error(err);
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
    this._contextObservables = new ReplayObservableMap((path) => this._createContextObservable(path));
    this._connect().then(
      () => {
        this.open();
      },
      (err) => {
        this.error(err);
      }
    );
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
          const ctx = dir ?  getDirectoryContext(o) : new ObjectContext(o);
          const sub = this.registerContext(ctx);
          callback(1, 0, ctx);
          return sub;
        }
      }

      let cb;

      if (dir) {
        //console.log('trying to subscribe directory %o in %o', propertyName, parentPath);
        cb = (a) => {
          //console.log('%o / %o -> %o', parentPath, propertyName, a);
          const o = a[0];

          if (isBlock(o) && a[1] instanceof Map) {
            const rolemap = a[1];
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
            if (!isBlock(o)) {
              this.log('Could not find property %o in %o', propertyName, o);
              callback(0, 0, new Error('Could not find property.'));
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
        cb = (a) => {
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

            if (!property) return null;

            const ctx = new PropertyContext(o, property, 0);
            const sub = this.registerContext(ctx);
            callback(1, 0, ctx);
            return sub;
          } else if (a.length === 1) {
            // property lookup
            const property = o.get_properties().find_property(propertyName);

            if (!property) {
              this.log('Could not find property %o in %o', propertyName, o);
              callback(0, 0, new Error('Could not find property.'));
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
            } else {
              this.log('Could not find property %o in %o', propertyName, o);
              callback(0, 0, new Error('Could not find property.'));
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

  _observeContext(path, callback) {
    if (path === 'Root/')
      path = '/';
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

registerBackendType('aes70', AES70Backend);
