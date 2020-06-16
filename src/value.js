import { warn } from './utils/log.js';

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

export class Value {
  static fromConstant(value) {
    const result = new Value();
    result._updateValue(value);
    return result;
  }

  static from(v) {
    if (v instanceof Value) return v;

    return this.fromConstant(v);
  }

  _updateValue(value) {
    this._hasValue = true;
    this._value = value;

    this.callSubscribers(value);
  }

  _activate() {}

  _deactivate() {}

  constructor() {
    this._subscribers = null;
    // last value received
    this._value = null;
    this._hasValue = false;
  }

  get value() {
    if (!this._hasValue) throw new Error('Waiting for value from backend.');

    return this._value;
  }

  get hasValue() {
    return this._hasValue;
  }

  get isActive() {
    return this._subscribers !== null;
  }

  subscribe(subscriber) {
    if (typeof subscriber !== 'function')
      throw new TypeError('Expected function or Subscriber object.');

    const a = this._subscribers;

    if (a === null) {
      this._subscribers = subscriber;
      this._activate();
    } else if (typeof a === 'function') {
      this._subscribers = [a, subscriber];
    } else {
      this._subscribers.push(subscriber);
    }

    if (this._hasValue) {
      callSubscriber(subscriber, this._value);
    }

    return () => {
      if (subscriber === null) return;

      const a = this._subscribers;

      if (typeof a === 'function') {
        if (a === subscriber) {
          this._subscribers = null;
          this._deactivate();
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
    this._deactivate();
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

  wait() {
    return new Promise((resolve) => {
      if (this._hasValue) {
        resolve(this._value);
        return;
      }

      let sub = null;
      let resolved = false;

      sub = this.subscribe((value) => {
        resolve(value);
        resolved = true;
        if (sub !== null) sub();
      });
      if (resolved) sub();
    });
  }

  get inSync() {
    return false;
  }
}
