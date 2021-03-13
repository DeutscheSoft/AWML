import { DynamicValue } from './dynamic_value.js';
import { runCleanupHandler } from './utils/run_cleanup_handler.js';

/**
 * Instances of this class represent dynamic values connected to a protocol
 * backend. Internally it interfaces with the API of a backend implementation.
 */
export class BackendValue extends DynamicValue {
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

  waitForInfo() {
    if (this._info !== null) return Promise.resolve();

    if (!this._infoPromise) {
      this._infoPromise = new Promise((resolve) => {
        this._infoResolve = resolve;
      });
    }

    return this._infoPromise;
  }

  /** @ignore */
  connectBackend(backend) {
    runCleanupHandler(this._infoSubscription);

    this._infoSubscription = backend.observeInfo(
      this._path,
      (ok, last, info) => {
        if (ok) {
          this._info = info;
          this._backend = backend;
        } else {
          this._info = null;
          this._backend = null;

          this._callback(ok, last, info);
        }

        this._resubscribe();

        const resolve = this._infoResolve;

        if (resolve) {
          this._infoPromise = null;
          this._infoResolve = null;
          resolve();
        }
      }
    );
  }

  /** @ignore */
  disconnectBackend() {
    runCleanupHandler(this._infoSubscription);
    this._infoSubscription = null;
    this._backend = null;
    this._info = null;

    const resolve = this._infoResolve;

    if (resolve) {
      this._infoPromise = null;
      this._infoResolve = null;
      resolve();
    }

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
    this._infoSubscription = null;
    this._infoResolve = null;
    this._infoPromise = null;
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
   * @param value - The new value.
   */
  set(value) {
    const backend = this._backend;
    const info = this._info;

    if (!info || !backend) {
      if (this._infoSubscription) {
        return this.waitForInfo().then(() => {
          if (!this._info) throw new Error('Not connected.');

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
}
