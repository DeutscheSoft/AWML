import { error, warn } from './utils/log.js';

function callSubscriber(cb, value) {
  try {
    cb(value);
  } catch (err) {
    warn(
      'Calling subscriber %o with %o generated an exception: %o',
      cb,
      value,
      err
    );
  }
}

class BaseValue {
  constructor() {
    this._subscribers = null;
  }

  subscribe(subscriber) {
    if (typeof subscriber !== 'function')
      throw new TypeError('Expected function or Subscriber object.');

    const a = this._subscribers;

    if (a === null) {
      this._subscribers = subscriber;
    } else if (typeof a === 'function') {
      this._subscribers = [a, subscriber];
    } else {
      this._subscribers.push(subscriber);
    }

    return () => {
      if (subscriber === null) return;

      const a = this._subscribers;

      if (typeof a === 'function') {
        if (a === subscriber) {
          this._subscribers = null;
        } else {
          // this seems unexpected, however someone might have
          // called removeAllSubscribers() before us
        }
      } else if (Array.isArray(a)) {
        let newSubscribers = a.filter((_sub) => _sub !== subscriber);
        if (newSubscribers.length === 1) newSubscribers = newSubscribers[0];
        this._subscribers = newSubscribers;
      }

      subscriber = null;
    };
  }

  removeAllSubscribers() {
    this._subscribers = null;
  }

  callSubscribers(v) {
    const a = this._subscribers;

    if (a === null) return;

    if (typeof a === 'function') {
      callSubscriber(a, v);
    } else {
      for (let i = 0; i < a.length; i++) {
        callSubscriber(a[i], v);
      }
    }
  }
}

export class BackendValue extends BaseValue {
  // these methods are not really part of the public API
  update(id, value) {
    // unsubscribe from the backend
    if (id === false) {
      this._backendId = null;
      this._backend = null;
      return;
    }

    if (this._hasRequestedValue) {
      if (value === this._requestedValue) {
        this._hasRequestedValue = false;
        this._requestedValue = null;
      }
    }

    this._hasValue = true;
    this._value = value;

    this.callSubscribers(value);
  }

  connectBackend(backend) {
    this._backend = backend;
    this._backendId = null;

    backend.subscribe(this._path, this._callback).then(
      (result) => {
        // result[0] == this._path
        const id = result[1];

        // if this happens, disconnectBackend() has been called
        // while one previous subscribe was still pending. simply
        // unsubscribe then
        if (this._backend !== backend) {
          backend.unsubscribe(id, this._callback);
          return;
        }

        this._backendId = id;

        if (this._hasRequestedValue) {
          this._backend.set(id, this._requestedValue);
        }

        if (result.length === 3) {
          this.update(id, result[2]);
        }
      },
      (err) => {
        this._backend = null;

        // if the backend is not open, this subscription most likely failed
        // because the backend closed during subscription. There is litle reason
        // to inform the developer about this, it will likely be resolved after
        // reconnect
        if (backend.isOpen)
          warn('Failed to subscribe to %o: %o', this._path, reason);
      }
    );
  }

  disconnectBackend() {
    const backend = this._backend;
    const backendId = this._backendId;

    if (backendId !== null) {
      backend.unsubscribe(backendId, this._callback);
    }

    this._backend = null;
    this._backendId = null;

    if (this._hasRequestedValue) {
      this._hasRequestedValue = false;
      this._requestedValue = null;
    }
  }

  // public API starts here
  get value() {
    if (!this._hasValue) throw new Error('Waiting for value from backend.');

    return this._value;
  }

  get hasValue() {
    return this._hasValue;
  }

  get inSync() {
    return (
      this._hasValue &&
      (!this._hasRequestedValue || this._requestedValue === this._value)
    );
  }

  get uri() {
    return this._address;
  }

  constructor(address) {
    super();
    this._address = address;
    this._path = address.split(':')[1];
    // last value received from the backend
    this._value = null;
    this._hasValue = false;
    // last value sent as a request to the backend
    this._requestedValue = null;
    this._hasRequestedValue = false;
    this._backend = null;
    this._backendId = null;
    this._callback = this.update.bind(this);
  }

  set(value) {
    this._requestedValue = value;
    this._hasRequestedValue = true;

    const backend = this._backend;
    const backendId = this._backendId;

    if (backend && backendId !== null) {
      backend.set(backendId, value);
    }
  }

  wait() {
    return new Promise((resolve) => {
      if (this._hasValue) {
        resolve(this._value);
        return;
      }

      const sub = this.subscribe((value) => {
        resolve(value);
        sub();
      });
    });
  }

  subscribe(callback) {
    const sub = super.subscribe(callback);

    if (this._hasValue) {
      callSubscriber(callback, this._value);
    }

    return sub;
  }
}
