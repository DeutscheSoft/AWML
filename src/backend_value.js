import { warn } from './utils/log.js';
import { DynamicValue } from './dynamic_value.js';

/**
 * Instances of this class represent dynamic values connected to a protocol
 * backend. Internally it interfaces with the API of a backend implementation.
 */
export class BackendValue extends DynamicValue {
  _activate() {
    const backend = this._backend;
    if (!backend) return;

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

        const hasRequestedValue = this._hasRequestedValue;
        const requestedValue = this._requestedValue;

        if (result.length === 3) {
          if (!this._hasValue) this._callback(id, result[2]);
        }

        if (hasRequestedValue) {
          this._backend.set(id, requestedValue);
        }
      },
      (err) => {
        this._backend = null;

        // if the backend is not open, this subscription most likely failed
        // because the backend closed during subscription. There is litle reason
        // to inform the developer about this, it will likely be resolved after
        // reconnect
        if (backend.isOpen)
          warn('Failed to subscribe to %o: %o', this._path, err);
      }
    );
  }

  _deactivate() {
    const backend = this._backend;
    const backendId = this._backendId;

    this.clear();

    if (this._hasRequestedValue) {
      this._hasRequestedValue = false;
      this._requestedValue = null;
    }

    if (!backend) return;
    if (backendId === null) return;

    try {
      this._backendId = null;
      backend.unsubscribe(backendId, this._callback);
    } catch (err) {
      warn(err);
    }
  }

  /** @ignore */
  connectBackend(backend) {
    this._backend = backend;
    this._backendId = null;

    if (this.isActive) this._activate();
  }

  /** @ignore */
  disconnectBackend() {
    this._backend = null;
    this._backendId = null;
    this._deactivate();
  }

  /**
   * Returns true if this value is currently synchronized with the backend. This
   * means that currently no value change is pending.
   */
  get inSync() {
    return (
      this._hasValue &&
      (!this._hasRequestedValue || this._requestedValue === this._value)
    );
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
    // last value sent as a request to the backend
    this._requestedValue = null;
    this._hasRequestedValue = false;
    this._backend = null;
    this._backendId = null;
    this._callback = (id, value) => {
      // unsubscribe from the backend
      if (id === false) {
        this.disconnectBackend();
        return;
      }

      if (this._hasRequestedValue) {
        if (value === this._requestedValue) {
          this._hasRequestedValue = false;
          this._requestedValue = null;
        }
      }

      this._updateValue(value);
    };
  }

  /**
   * Sets the value in the backend. If the corresponding backend is currently
   * offline, the value will be kept until it is connected.
   *
   * @param value - The new value.
   */
  set(value) {
    this._requestedValue = value;
    this._hasRequestedValue = true;

    const backend = this._backend;
    const backendId = this._backendId;

    if (backend && backendId !== null) {
      backend.set(backendId, value);
    } else {
      // This will subscribe temporarily and
      // in the process call backend.set() on
      // the value we have requested.
      this.wait();
    }
  }
}
