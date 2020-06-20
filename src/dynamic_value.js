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

/**
 * Base class for values. DynamicValue instances represent value which can
 * be used in data bindings. Some base classes of DynamicValue instances
 * implement a `set()` method which can be used to modify the value.
 * What exactly the `set()` method does depends on the implementation.
 * They can be used to implement bindings to backend data,
 * as well as for application interaction.
 *
 * DynamicValues are similar to BehaviorSubjects in Rx.
 */
export class DynamicValue {
  /**
   * Create a value from a constant.
   *
   * @param value - The value to emit.
   * @return {DynamicValue}
   */
  static fromConstant(value) {
    const result = new DynamicValue();
    result._updateValue(value);
    return result;
  }

  /** @ignore */
  static from(v) {
    if (v instanceof this) return v;

    return this.fromConstant(v);
  }

  /** @ignore */
  _updateValue(value) {
    this._hasValue = true;
    this._value = value;

    this.callSubscribers(value);
  }

  /**
   * @protected
   */
  _subscribe() {
    return null;
  }

  /**
   * @protected
   */
  _activate() {
    this._subscription = this._subscribe();
  }

  /**
   * @protected
   */
  _deactivate() {
    const sub = this._subscription;
    if (sub !== null) {
      this._subscription = null;
      sub();
    }
  }

  constructor() {
    this._subscribers = null;
    // last value received
    this._value = null;
    this._hasValue = false;
    this._subscription = null;
  }

  /**
   * Returns the last value received. Throws an error if no value has been
   * received, yet.
   *
   * @returns any - The value.
   */
  get value() {
    if (!this._hasValue) throw new Error('Waiting for value from backend.');

    return this._value;
  }

  /**
   * Returns true if a value is available.
   *
   * @returns boolean
   */
  get hasValue() {
    return this._hasValue;
  }

  /**
   * Returns true if this value is currently subscribed to.
   */
  get isActive() {
    return this._subscribers !== null;
  }

  /**
   * Subscribe to this value. Will call the callback argument whenever a value
   * becomes available.
   *
   * Returns a unsubscribe callback. Calling it will remove the subscription.
   *
   * @param {Function} subscriber - Callback function to subscribe.
   * @return {Function} - The unsubscribe callback.
   */
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

  /**
   * Remove all subscribed listeners.
   */
  removeAllSubscribers() {
    this._subscribers = null;
    this._deactivate();
  }

  /**
   * @protected
   */
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

  /**
   * Wait for a value to be available.
   *
   * @returns Promise<any>
   */
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
