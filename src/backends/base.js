import { parseAttribute } from '../utils/parse_attribute.js';
import { EventTarget } from '../utils/event_target.js';

export class Base extends EventTarget {
  get transformPath() {
    return this._transformPath;
  }

  set transformPath(v) {
    if (typeof v !== 'function' && v !== null)
      throw new TypeError('Expected function.');

    this._transformPath = v;
  }

  get isOpen() {
    return this._state === 'open';
  }

  get isInit() {
    return this._state === 'init';
  }

  get isClosed() {
    return this._state === 'closed';
  }

  get name() {
    return this._name;
  }

  get node() {
    return this._node;
  }

  constructor(options) {
    super();
    if (typeof options !== 'object')
      throw new TypeError('Expected options object.');
    const name = options.name;

    if (typeof name !== 'string') throw new TypeError('Expected string.');

    // Map<ID, ANY>
    this._values = new Map();
    // Map<STRING, ID>
    this._pathToId = new Map();
    // Map<ID, STRING>
    this._idToPath = new Map();
    // Map<ID, BackendValue[]>
    this._subscriptions = new Map();
    // Map<STRING, [ Callback, Resolve, Reject ]>
    this._pendingSubscriptions = new Map();
    this._state = 'init';
    this._transformPath = options.transformPath || null;
    this._name = name;
    this._node = options.node || null;
  }

  open() {
    if (this.isOpen) return;
    if (!this.isInit) throw new Error('Invalid transition.');

    this._state = 'open';

    const pendingSubscriptions = this._pendingSubscriptions;

    if (pendingSubscriptions.size !== 0)
      this.lowSubscribeBatch(Array.from(pendingSubscriptions.keys()));

    this.emit('open');
  }

  close() {
    if (this.isClosed) return;
    if (!this.isInit && !this.isOpen) throw new Error('Invalid transition.');

    this._state = 'closed';

    this._failAllSubscriptions(new Error('closed'));

    this.emit('close');

    this.destroy();
  }

  error(err) {
    if (this.isError) return;
    if (!this.isInit && !this.isOpen) throw new Error('Invalid transition.');

    this._state = 'error';

    this._failAllSubscriptions(err);

    this.emit('error', err);

    this.destroy();
  }

  subscribe(path, callback) {
    const pathToId = this._pathToId;
    const subscriptions = this._subscriptions;

    if (this.transformPath !== null) path = this.transformPath(path);

    if (pathToId.has(path)) {
      const values = this._values;
      // already subscribed
      const id = pathToId.get(path);
      const key = id === null ? path : id;
      let subscribers = subscriptions.get(key);

      if (subscribers === void 0) {
        subscribers = [];
        subscriptions.set(key, subscribers);
      }

      subscribers.push(callback);

      const result = values.has(key) ? [path, id, values.get(key)] : [path, id];

      return Promise.resolve(result);
    } else {
      const pendingSubscriptions = this._pendingSubscriptions;

      let pendingSubscribers = pendingSubscriptions.get(path);

      if (pendingSubscribers === void 0) {
        pendingSubscribers = [];
        pendingSubscriptions.set(path, pendingSubscribers);
      }

      const p = new Promise(function (resolve, reject) {
        pendingSubscribers.push([callback, resolve, reject]);
      });

      if (pendingSubscribers.length === 1 && this.isOpen) {
        this.lowSubscribe(path);
        this.emit('subscribe', path);
      }

      return p;
    }
  }

  unsubscribe(id, callback) {
    const subscriptions = this._subscriptions;

    let subscribers = subscriptions.get(id);

    if (subscribers === void 0 || !subscribers.includes(callback))
      throw new Error('No such subscriber.');

    subscribers = subscribers.filter((_callback) => _callback !== callback);

    if (subscribers.length > 0) return;

    // perform unsubscribe

    subscriptions.delete(id);
    this.lowUnsubscribe(id);
    this._values.delete(id);
    const path = this._idToPath.get(id);
    this._idToPath.delete(id);
    this._pathToId.delete(path);

    this.emit('unsubscribe', [path, id]);

    // emit unregister event
  }

  lowSubscribeBatch(addresses) {
    for (let i = 0; i < addresses.length; i++) {
      this.lowSubscribe(addresses[i]);
    }
  }

  destroy() {
    this.emit('destroy');
    this._pathToId = null;
    this._idToPath = null;
    this._values = null;
    this._subscriptions = null;
    this._pendingSubscribers = null;
  }

  receive(id, value) {
    const values = this._values;

    values.set(id, value);

    const subscribers = this._subscriptions.get(id);

    if (subscribers === void 0) return;

    for (let i = 0; i < subscribers.length; i++) {
      try {
        callback(id, value);
      } catch (err) {
        warn('Calling subscriber generated an exception', err);
      }
    }
  }

  static argumentsFromNode(node) {
    const tmp = node.getAttribute('transform-path');

    // Note: we prefer the property 'name' here over the corresponding
    // attribute.
    return {
      transformPath: tmp ? parseAttribute('javascript', tmp, null) : null,
      name: node.name,
      node: node,
    };
  }

  _failAllSubscriptions(err) {
    const subscriptions = new Map(this._subscriptions);
    const pendingSubscriptions = new Map(this._pendingSubscriptions);

    this._subscriptions.clear();
    this._pendingSubscriptions.clear();
    this._idToPath.clear();
    this._pathToId.clear();
    this._values.clear();

    pendingSubscriptions.forEach((a) => {
      a.forEach((tmp) => {
        tmp[2](err);
      });
    });
    subscriptions.forEach((callbacks) => {
      for (let i = 0; i < callbacks.length; i++) {
        const callback = callbacks[i];
        try {
          callback(false, err);
        } catch (err) {
          warn('Calling subscriber generated an exception', err);
        }
      }
    });
  }

  _subscribeSuccess(path, id) {
    // the special value used to be 'false', we use
    // null now
    if (id === false) id = null;

    this._pathToId.set(path, id);

    const key = id === null ? path : id;

    if (id !== false) this._idToPath.set(id, path);

    const pendingSubscriptions = this._pendingSubscriptions;
    const pendingSubscribers = pendingSubscriptions.get(path);

    if (pendingSubscribers === void 0) return;
    pendingSubscriptions.delete(path);

    // the callbacks are at index 0, store them as subscribers
    this._subscriptions.set(
      key,
      pendingSubscribers.map((a) => a[0])
    );

    const values = this._values;

    const result = values.has(key) ? [path, id, values.get(key)] : [path, id];
    const resolvers = pendingSubscribers.map((a) => a[1]);

    for (let i = 0; i < resolvers.length; i++) {
      resolvers[i](result);
    }

    this.emit('register_success', [path, id]);
  }

  _subscribeFailure(path, error) {
    if (!this.isOpen) return;

    const pendingSubscriptions = this._pendingSubscriptions;
    const pendingSubscribers = pendingSubscriptions.get(path);
    if (pendingSubscribers === void 0) return;
    pendingSubscriptions.delete(path);
    const rejecters = pendingSubscribers.map((a) => a[2]);

    for (let i = 0; i < rejecters.length; i++) {
      rejecters[i](error);
    }

    this.emit('register_fail', [path, error]);
  }
}
