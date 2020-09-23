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

function throttle(callback) {
  let dispatched = false;
  let lastArgs = null;

  return (...args) => {
    lastArgs = args;
    if (dispatched) return;
    dispatched = true;
    Promise.resolve().then(() => {
      dispatched = false;
      callback(...lastArgs);
    });
  };
}

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

function forEachMemberAsync(block, callback, onStable, onError) {
  if (typeof callback !== 'function') throw new TypeError('Expected function.');
  if (!onError) onError = (err) => warn('Error while fetching members:', err);
  // ono -> [ object, callback(object) ]
  const members = new Map();
  const device = block.device;

  const onMembers = (a) => {
    // unsubscribed
    if (callback === null) return;

    const objectNumbers = new Set();

    a.forEach((member) => {
      const objectNumber = member.ONo;

      objectNumbers.add(objectNumber);

      // we already know this child
      if (members.has(objectNumber)) return;

      const o = device.resolve_object(member);

      members.set(objectNumber, [o, callback(o)]);
    });

    members.forEach((a, objectNumber) => {
      if (objectNumbers.has(objectNumber)) return;
      members.delete(objectNumber);
      runCleanupHandler(a[1]);
    });

    if (onStable) onStable();
  };

  block.OnMembersChanged.subscribe(onMembers);
  block.GetMembers().then(onMembers, onError);

  return () => {
    // unsubscribe
    if (callback === null) return;
    block.OnMembersChanged.unsubscribe(onMembers);
    const cleanup = Array.from(members.values()).map((a) => a[1]);
    members.clear();
    cleanup.forEach(runCleanupHandler);
    callback = null;
  };
}

export class AES70Backend extends Backend {
  get src() {
    return this._src;
  }

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

  _observeDirectory(o, callback) {
    //console.log('observeDirectory', o);
    if (isBlock(o)) {
      let rolemap = new Map();
      let pending = 0;
      let hasChanged = true;
      let cb = throttle(() => {
        if (callback === null) return;
        if (pending !== 0) return;
        if (!hasChanged) return;
        hasChanged = false;
        //console.log('rolemap', Array.from(rolemap);
        // Note: we pass a copy here to our subscribers
        // to prevent them from observing modifications
        // we are making to it in the future
        callback([o, new Map(rolemap)]);
      });

      let memberCallback = (member) => {
        let key = null;

        pending++;
        member.GetRole().then(
          (role) => {
            if (member === null) return;
            if (callback === null) return;
            pending--;
            key = role;
            if (rolemap.has(key)) {
              let n = 1;
              do {
                key = role + n++;
              } while (rolemap.has(key));
            }
            rolemap.set(key, member);
            hasChanged = true;
            cb();
          },
          (error) => {
            if (member === null) return;
            if (callback === null) return;
            pending--;
            cb();
            warn('Failed to fetch Role', error);
          }
        );
        return () => {
          if (member === null) return;
          if (key !== null) rolemap.delete(key);
          member = null;
          hasChanged = true;
          cb();
        };
      };

      let onStable = () => {
        cb();
      };

      let cleanup = forEachMemberAsync(o, memberCallback, onStable);

      return () => {
        if (cleanup) {
          runCleanupHandler(cleanup);
          cleanup = null;
        }
        // cleanup may help
        cb = null;
        callback = null;
        rolemap = null;
        o = null;
      };
    } else {
      // not a block, so we only care about properties
      callback([o]);
    }
  }

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

  // Promise<CleanupLogic>
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

    const batch = node.hasAttribute('batch') ? parseInt(batch) : 0;

    options.url = url;
    options.batch = batch;

    return options;
  }
}

registerBackendType('aes70', AES70Backend);
