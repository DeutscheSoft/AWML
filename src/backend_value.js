import { DynamicValue } from './dynamic_value.js';
import { runCleanupHandler } from './utils/run_cleanup_handler.js';

import { safeCall } from './utils/safe_call.js';
import { initSubscribers, addSubscriber, removeSubscriber, callSubscribers } from './utils/subscribers.js';

/**
 * Instances of this class represent dynamic values connected to a protocol
 * backend. Internally it interfaces with the API of a backend implementation.
 */
export class BackendValue extends DynamicValue {

  get info() {
    const _info = this._info;

    if (_info !== null) return _info;

    if (this._infoError) throw this._infoError;

    return this._info;
  }

  _deactivate() {
    super._deactivate();
    super.clear();
  }

  _resubscribe() {
    if (this.isActive) {
      this._deactivate();
      this._activate();
    }
  }

  _subscribe() {
    const info = this._info;
    const backend = this._backend;

    if (!info || !backend) return null;

    if ('id' in info) {
      return backend.observeById(info.id, this._callback);
    } else {
      return backend.observeByPath(this._path, this._callback);
    }
  }

  _trackPending(task) {
    if (typeof task !== 'object' || typeof task.then !== 'function')
      return task;

    const whenDone = () => {
      this._pending--;
    };

    task.then(whenDone, whenDone);
    this._pending++;
    return task;
  }

  /**
   * Observe the parameter info.
   *
   * @param {ObserveInfoCallback} callback
   *    A call back which will be called with the parameter info.
   * @returns {function}
   *    A unsubscription callback.
   */
  observeInfo(callback) {
    this._infoSubscribers = addSubscriber(this._infoSubscribers, callback);

    if (this._infoError) {
      safeCall(callback, 0, 0, this._infoError);
    } else {
      safeCall(callback, 1, 0, this._info);
    }

    return () => {
      if (callback === null) return;
      this._infoSubscribers = removeSubscriber(this._infoSubscribers, callback);
      callback = null;
    };
  }

  /**
   * Returns a promise which resolves either to the parameter info or fails
   * if the parameter cannot be found.
   *
   * @returns {Promise<IPathInfo>}
   */
  waitForInfo() {
    return new Promise((resolve, reject) => {
      const info = this.info;

      if (info !== null) {
        resolve(info);
      } else {
        let sub;

        sub = this.observeInfo((ok, last, info) => {
          // ignore disconnects
          if (ok && info === null) return;

          sub();

          (ok ? resolve : reject)(info);
        });
      }
    });
  }

  /** @ignore */
  connectBackend(backend) {
    runCleanupHandler(this._infoSubscription);

    this._infoSubscription = backend.observeInfo(
      this._path,
      (ok, last, info) => {
        if (ok) {
          this._info = info;
          this._infoError = null;
          this._backend = backend;

          safeCall(this._infoSubscribers, 1, 0, info);
        } else {
          this._info = null;
          this._infoError = info;
          this._backend = null;

          this._callback(ok, last, info);
          safeCall(this._infoSubscribers, 0, 0, info);
        }

        this._resubscribe();
      }
    );
  }

  /** @ignore */
  disconnectBackend() {
    runCleanupHandler(this._infoSubscription);
    this._infoSubscription = null;
    this._backend = null;
    this._info = null;
    this._infoError = null;

    safeCall(this._infoSubscribers, 1, 0, null);
    this._resubscribe();
  }

  /**
   * Returns true if this value is currently synchronized with the backend. This
   * means that currently no value change is pending.
   */
  get inSync() {
    return this._pending === 0;
  }

  /**
   * Returns true if this value is currently synchronized with the backend. This
   * means that currently no value change is pending.
   */
  get uri() {
    return this._address;
  }

  /** @ignore */
  get address() {
    return this._address;
  }

  /** @ignore */
  constructor(address) {
    super();
    this._address = address;
    this._path = address.split(':')[1];
    this._backend = null;
    this._info = null;
    this._infoError = null;
    this._infoSubscription = null;
    this._infoSubscribers = initSubscribers();
    this._pending = 0;
    this._callback = (ok, last, value) => {
      if (ok) {
        this._updateValue(value);
      } else {
        if (value)
          console.log(
            'BackendValue(%o) ran into an error: %o',
            this.uri,
            value
          );
      }
    };
  }

  /**
   * Sets the value in the backend. If the corresponding backend is currently
   * offline, an exception will be generated.
   *
   * @param {*} value
   *    The new value.
   * @returns {Promise}
   */
  set(value) {
    const backend = this._backend;
    const info = this.info;

    if (!info || !backend) {
      if (this._infoSubscription) {
        return this.waitForInfo().then((info) => {
          return this.set(value);
        });
      }

      throw new Error('Not connected.');
    }

    if (info.type === 'parameter') {
      if ('id' in info) {
        return this._trackPending(backend.setById(info.id, value));
      } else {
        return this._trackPending(backend.setByPath(this._path, value));
      }
    } else if (info.type === 'function') {
      if (!Array.isArray(value))
        throw new TypeError('Function values expect an array of arguments.');

      if ('id' in info) {
        return this._trackPending(backend.callById(info.id, value));
      } else {
        return this._trackPending(backend.callByPath(this._path, value));
      }
    } else {
      throw new Error('Unable to set() a value of type ' + info.type);
    }
  }

  /**
   * Waits for this backend value to be connected and then call set().
   * This function works similarly to how set() used to work in previous
   * versions of AWML.
   *
   * @param {*} value
   *    The new value.
   * @returns {Promise}
   */
  setWhenConnected(value) {
    const backend = this._backend;
    const info = this.info;

    if (info && backend)
      return this.set(value);

    return this.waitForInfo().then(() => this.setWhenConnected(value));
  }
}
