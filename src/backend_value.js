import { warn } from './utils/log.js';
import { Value } from './value.js';

export class BackendValue extends Value {
  _activate() {}

  _deactivate() {}

  connectBackend(backend) {
    this._backend = backend;
    this._backendId = null;

    const callback = (id, value) => {
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

      this._updateValue(value);
    };

    backend.subscribe(this._path, callback).then(
      (result) => {
        // result[0] == this._path
        const id = result[1];

        // if this happens, disconnectBackend() has been called
        // while one previous subscribe was still pending. simply
        // unsubscribe then
        if (this._backend !== backend) {
          backend.unsubscribe(id, callback);
          return;
        }

        this._backendId = id;

        if (this._hasRequestedValue) {
          this._backend.set(id, this._requestedValue);
        }

        if (result.length === 3) {
          callback(id, result[2]);
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
    // last value sent as a request to the backend
    this._requestedValue = null;
    this._hasRequestedValue = false;
    this._backend = null;
    this._backendId = null;
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
}
