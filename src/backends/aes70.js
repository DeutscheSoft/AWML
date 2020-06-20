import { Base } from './base.js';
import { registerBackendType } from '../components/backend.js';
import { warn } from '../utils/log.js';
import { subscribeDOMEvent } from '../utils/subscribe_dom_event.js';
import { getCurrentWebSocketUrl } from './websocket.js';

if (typeof OCA === 'undefined') {
  warn('Cannot find AES70.js library. Missing a script include?');
}

export class AES70Backend extends Base {
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
    this._objects = null;
    this._path_subscriptions = new Map();
    this._setters = new Map();
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
          this._device.get_role_map('/').then(
            (objects) => {
              if (!this.isInit) return;
              this._objects = objects;
              this.open();
            },
            (err) => {
              if (!this.isInit) return;
              this.error(err);
            }
          );
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

  lowSubscribe(path) {
    const objects = this._objects;

    if (objects.has(path)) {
      // it is an object
      const o = objects.get(path);
      this.receive(path, o);
      this._subscribeSuccess(path, path);
      return;
    }

    const tmp = path.split('/');

    let propertyName = tmp.pop();

    let objectPath = tmp.join('/');

    if (objects.has(objectPath)) {
      // it is an object
      const o = objects.get(objectPath);
      const properties = o.get_properties();

      switch (propertyName) {
        case 'ClassName':
          this.receive(path, o[propertyName]);
          this._subscribeSuccess(path, path);
          return;
      }

      const property = properties.find_property(propertyName);

      if (!property) {
        warn('Could not find property %o in %o.', propertyName, properties);
        this._subscribeFailure(path, new Error('No such property.'));
      } else {
        if (property.static) {
          this.receive(path, o[propertyName]);
          this._subscribeSuccess(path, path);
        } else {
          const eventCallback = (value, type, id) => {
            this.receive(path, value);
          };
          const event = property.event(o);
          const getter = property.getter(o);

          if (!getter) {
            this._subscribeFailure(path, new Error('Could not find getter.'));
            return;
          }

          const task = event
            ? event.subscribe(eventCallback).then(() => true)
            : Promise.resolve(false);

          task
            .then((subscribed) => {
              const setter = property.setter(o);
              const unsubscribe = () => {
                if (!subscribed) return;
                event.unsubscribe(eventCallback);
                if (setter) this._setters.delete(path);
              };
              getter().then(
                (x) => {
                  let val;
                  if (x instanceof OCA.SP.Arguments) {
                    val = x.item(0);
                  } else {
                    val = x;
                  }
                  this.receive(path, val);
                  if (setter) this._setters.set(path, setter);
                  this._subscribeSuccess(path, path);
                  if (subscribed)
                    this._path_subscriptions.set(path, unsubscribe);
                },
                (error) => {
                  unsubscribe();
                  throw error;
                }
              );
            })
            .catch((error) => {
              this._subscribeFailure(path, error);
            });
        }
      }
      return;
    } else {
      switch (propertyName) {
        case 'Min':
        case 'Max':
          const index = propertyName === 'Min' ? 1 : 2;
          propertyName = tmp.pop();
          objectPath = tmp.join('/');

          if (!objects.has(objectPath)) break;

          const o = objects.get(objectPath);
          const properties = o.get_properties();

          const property = properties.find_property(propertyName);

          if (!property) break;

          const getter = property.getter(o);

          if (!getter) break;

          getter()
            .then((x) => {
              if (!(x instanceof OCA.SP.Arguments))
                throw new Error('Property has no min or max.');

              this.receive(path, x.item(index));
              this._subscribeSuccess(path, path);
            })
            .catch((error) => {
              this._subscribeFailure(path, error);
            });

          return;
      }
    }

    this._subscribeFailure(path, new Error('Not such address.'));
  }

  lowUnsubscribe(id) {
    const m = this._path_subscriptions;
    if (m.has(id)) {
      const sub = m.get(id);
      m.delete(id);
      sub();
    }
  }

  static argumentsFromNode(node) {
    const options = Base.argumentsFromNode(node);

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
