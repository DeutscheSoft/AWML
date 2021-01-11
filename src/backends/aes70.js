import { Backend } from './backend.js';
import { registerBackendType } from '../components/backend.js';
import { warn } from '../utils/log.js';
import { subscribeDOMEvent } from '../utils/subscribe_dom_event.js';
import { getCurrentWebSocketUrl } from '../utils/fetch.js';

/* global OCA */

if (typeof OCA === 'undefined') {
  warn('Cannot find AES70.js library. Missing a script include?');
}

function runCleanupHandler(cleanup) {
  try {
    cleanup();
  } catch (error) {
    warn('Cleanup handler threw an exception:', error);
  }
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

function unCurry(callback) {
  return (id, value) => {
    // if we get unsubscribed, we simply abort
    if (id === false) return;
    return callback(value);
  };
}

function isBlock(o) {
  return typeof o === 'object' && typeof o.GetMembers === 'function';
}

/**
 * This class implements a backend for AES70 devices. It uses AES70.js
 * https://github.com/DeutscheSoft/AES70.js which is required to be loaded
 * as one global ``OCA`` symbol. It is usually enough to include
 * ``AES70.es5.js`` alongside this backend.
 *
 * The paths uses to represent objects and properties of the AES70 device in
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
export class AES70Backend extends Backend {
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

  constructor(options) {
    super(options);
    const websocket = new WebSocket(options.url);
    this._websocket = websocket;
    this._device = null;
    this._path_subscriptions = new Map();
    this._setters = new Map();
    this._seperator = '/';
    this.addSubscription(
      subscribeDOMEvent(websocket, 'open', () => {
        try {
          // discover the device
          const options = {
            batch: this.options.batch,
          };

          this._device = new OCA.RemoteDevice(
            new OCA.WebSocketConnection(this._websocket, options)
          );
          this._device.set_keepalive_interval(1);
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

  /**
   * @internal
   * @returns CleanupLogic
   */
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

  /** @internal */
  _subscribeMembersAndRoles(block, callback, onError) {
    if (!isBlock(block)) throw new TypeError('Expected OcaBlock.');
    if (typeof callback !== 'function')
      throw new TypeError('Expected function.');
    if (!onError)
      onError = (err) => {
        this.log('Error while fetching block members:', err);
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

      callback(last_members, roleNames);
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

  /** @internal */
  _observeDirectory(o, callback) {
    //console.log('observeDirectory', o);
    if (isBlock(o)) {
      let membersCallback = (members, roles) => {
        if (callback === null) return;

        const rolemap = new Map();

        for (let i = 0; i < members.length; i++) {
          let key = roles[i];

          if (rolemap.has(key)) {
            let n = 1;
            do {
              key = role + n++;
            } while (rolemap.has(key));
          }
          rolemap.set(key, members[i]);
        }

        callback([o, rolemap]);
      };

      let cleanup = this._subscribeMembersAndRoles(o, membersCallback);

      return () => {
        if (cleanup) {
          runCleanupHandler(cleanup);
          cleanup = null;
        }
        // cleanup may help
        callback = null;
        o = null;
      };
    } else {
      // not a block, so we only care about properties
      callback([o]);
    }
  }

  /** @internal */
  _observePropertyWithGetter(o, property, path, index, callback) {
    let active = true;

    if (property.static) {
      if (index === 0) {
        callback(o[property.name]);
      } else {
        warn(
          'Static property %o in %o has no Min/Max.',
          property.name,
          o.ClassName
        );
      }
      return;
    }

    const getter = property.getter(o);

    if (!getter) {
      warn(
        'Could not subscribe to private property %o in %o',
        propertyName,
        properties
      );
      return;
    }

    const event = property.event(o);
    const setter = index === 0 ? property.setter(o) : null;
    let eventHandler = null;

    if (event) {
      eventHandler = (value, changeType) => {
        switch (index) {
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
        callback(value);
      };
      event.subscribe(eventHandler).catch((err) => {
        warn('Failed to subscribe to %o: %o.\n', property.name, err);
      });
    }

    if (setter) this._setters.set(path, setter);

    getter().then(
      (x) => {
        if (!active) return;
        if (x instanceof OCA.SP.Arguments && index < x.length) {
          callback(x.item(index));
        } else if (!index) {
          callback(x);
        } else {
          warn('%o in %o has neither Min nor Max.', property.name, o.ClassName);
        }
      },
      (error) => {
        if (!active) return;
        // NotImplemented
        if (error.status.value == 8) {
          warn('Fetching %o failed: not implemented.', property.name);
        } else {
          warn('Fetching %o produced an error: %o', property.name, error);
        }
      }
    );

    return () => {
      if (!active) return;
      if (event) event.unsubscribe(eventHandler);
      if (setter) this._setters.delete(path);
      active = false;
    };
  }

  /** @internal */
  _observeProperty(a, propertyName, path, callback) {
    //console.log('_observeProperty(%o, %o, %o)', a, propertyName, path);
    const o = a[0];

    if (isBlock(o) && a[1] instanceof Map) {
      const rolemap = a[1];

      if (rolemap && rolemap.has(propertyName)) {
        callback(rolemap.get(propertyName));
        return;
      }

      // try property lookup
      a = [o];
    }

    // actual property lookup
    if (a.length === 1) {
      const properties = o.get_properties();
      const property = properties.find_property(propertyName);

      if (!property) {
        this.log('Could not find property %o in %o.', propertyName, properties);
        return;
      }

      return this._observePropertyWithGetter(o, property, path, 0, callback);
    } else if (a.length === 2) {
      // meta info
      const o = a[0];
      const property = a[1];

      // It might be that this property does not exist.
      // That is not necessarily a permanent error.
      if (!property) return;

      if (propertyName === 'Min' || propertyName === 'Max') {
        const index = propertyName === 'Min' ? 1 : 2;
        return this._observePropertyWithGetter(
          o,
          property,
          path,
          index,
          callback
        );
      }
    }
  }

  /** @internal */
  _observeEach(path, callback) {
    let lastValue = null;
    let cleanup = null;

    const cb = (o) => {
      if (lastValue === o) return;
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

  /**
   * @internal
   * @returns Promise<CleanupLogic>
   */
  doSubscribe(path) {
    //console.log('doSubscribe(%o)', path);
    const seperator = this._seperator;
    const dir = path.endsWith(seperator);
    const [parentPath, propertyName] = splitAtLast(
      dir ? path.substr(0, path.length - 1) : path,
      seperator
    );

    // we are at the top level
    if (parentPath === '/') {
      if (propertyName == '') {
        return this._observeDirectory(this.device.Root, (a) => {
          this.receive(path, a);
        });
      } else if (toplevelObjects.indexOf(propertyName) !== -1) {
        const o = this.device[propertyName];

        if (!dir) {
          // just pass the object
          this.receive(path, o);
          return;
        } else {
          // we got a slash, we subscribe object, rolemap/properties
          //console.log('trying to subscribe top level %o', path);
          return this._observeDirectory(o, (a) => {
            this.receive(path, a);
          });
        }
      }
    }

    let callback;

    if (dir) {
      //console.log('trying to subscribe directory %o in %o', propertyName, parentPath);
      callback = (a) => {
        //console.log('%o / %o -> %o', parentPath, propertyName, a);
        const o = a[0];

        if (isBlock(o) && a[1] instanceof Map) {
          const rolemap = a[1];

          if (rolemap.has(propertyName)) {
            return this._observeDirectory(
              rolemap.get(propertyName),
              (value) => {
                this.receive(path, value);
              }
            );
          }
        }

        // check the properties, this is for meta-info lookup
        const property = o.get_properties().find_property(propertyName);

        if (!property) {
          this.log('Could not find property %o in %o', propertyName, o);
        }

        if (!isBlock(o)) this.receive(path, [o, property]);
      };
    } else {
      //console.log('trying to subscribe property %o in %o', propertyName, parentPath);
      callback = (a) => {
        return this._observeProperty(a, propertyName, path, (value) => {
          //console.log('%o -> %o', path, value);
          this.receive(path, value);
        });
      };
    }

    // get a directory query for the parent object
    return this._observeEach(
      parentPath === seperator ? 'Root' + seperator : parentPath,
      callback
    );
  }

  /** @internal */
  lowSubscribe(path) {
    try {
      const cleanup = this.doSubscribe(path);
      if (cleanup) this._path_subscriptions.set(path, cleanup);
      this._subscribeSuccess(path, path);
    } catch (error) {
      this._subscribeFailure(path, error);
    }
  }

  /** @internal */
  lowUnsubscribe(id) {
    const m = this._path_subscriptions;
    if (m.has(id)) {
      const sub = m.get(id);
      m.delete(id);
      runCleanupHandler(sub);
    }
    this._values.delete(id);
  }

  /** @internal */
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

    const batch = node.hasAttribute('batch') ? parseInt(batch) : 0;

    options.url = url;
    options.batch = batch;

    return options;
  }
}

registerBackendType('aes70', AES70Backend);
