import { error } from '../utils/log.js';
import { BaseComponent } from './base.js';
import { registerBackend, unregisterBackend } from '../backends.js';
import { Subscriptions } from '../utils/subscriptions.js';
import { timeout } from '../utils/timeout.js';

const backendTypes = new Map();
const backendTypeSubscribers = new Map();

export function registerBackendType(type, constructor) {
  if (backendTypes.has(type))
    throw new Error('Cannot redefine a backend type.');

  backendTypes.set(type, constructor);

  const subscribers = backendTypeSubscribers.get(type);
  backendTypeSubscribers.delete(type);

  if (subscribers === void 0) return;

  subscribers.forEach((cb) => {
    try {
      cb(constructor);
    } catch (err) {
      error('Subscriber generated an exception: %o', err);
    }
  });
}

export function subscribeBackendType(type, callback) {
  if (typeof type !== 'string') throw new TypeError('Expected string.');

  if (typeof callback !== 'function') throw new TypeError('Expected function.');

  let subscribers = backendTypeSubscribers.get(type);

  if (subscribers === void 0) {
    backendTypeSubscribers.set(type, (subscribers = new Set()));
  }

  subscribers.add(callback);

  return () => {
    if (callback === null) return;
    subscribers.delete(callback);
  };
}

export class BackendComponent extends BaseComponent {
  static get observedAttributes() {
    return BaseComponent.observedAttributes.concat([
      'name',
      'type',
      'retry-interval',
    ]);
  }

  get name() {
    return this._name;
  }

  set name(v) {
    if (typeof v !== 'string' && v !== null)
      throw new TypeError('Expected string.');
    this._name = v;
    this._resubscribe();
  }

  get type() {
    return this._type;
  }

  set type(v) {
    if (typeof v !== 'string' && v !== null)
      throw new TypeError('Expected string.');
    this._type = v;
    this._resubscribe();
  }

  get retryInterval() {
    return this._retryInterval || 500;
  }

  set retryInterval(v) {
    if (typeof v === 'number') {
      if (!(v > 0)) v = null;
    } else if (v !== null) {
      throw new TypeError('Expected integer.');
    }
    this._retryInterval = v;
  }

  get isOpen() {
    const backend = this._backend;

    return backend !== null && backend.isOpen;
  }

  calculateRetryInterval() {
    const interval = this.retryInterval;

    return interval * (1 + Math.log(Math.pow(1+this._retries, 2)));
  }

  constructor() {
    super();
    this._name = null;
    this._type = null;
    this._backend = null;
    this._retryInterval = null;
    this._retries = 0;
  }

  _subscribe() {
    const name = this._name;
    const type = this._type;

    if (name === null || type === null) return null;

    const constructor = backendTypes.get(type);

    // backend types has not been defined, yet.
    if (constructor === void 0) {
      return subscribeBackendType(type, () => {
        this._resubscribe();
      });
    }

    const options = constructor.argumentsFromNode(this);
    const backend = new constructor(options);

    this._backend = backend;

    const subscriptions = new Subscriptions();

    let registered = false;

    if (backend.isOpen) {
      registerBackend(name, backend);
      registered = true;
    } else {
      subscriptions.add(
        backend.once('open', () => {
          this._retries = 0;
          this.log('is open.');
          this.dispatchEvent(
            new CustomEvent('open', {
              detail: {
                backend: backend,
              },
            })
          );
          registerBackend(name, backend);
          registered = true;
        })
      );
    }

    const unregister = () => {
      if (registered) {
        registered = false;
        unregisterBackend(name, backend);
      }
    };

    const retry = () => {
      unregister();
      const time = this.calculateRetryInterval();
      this.log('retrying in %d ms', time);
      subscriptions.add(
        timeout(() => {
          this._resubscribe();
        }, time)
      );
      this._retries++;
    };

    subscriptions.add(
      backend.subscribeEvent('error', (err) => {
        this.log('Backend closed with error %o. Retry.', err);
        this.dispatchEvent(
          new CustomEvent('error', {
            detail: {
              backend: backend,
              error: err,
            },
          })
        );
        retry();
      }),
      backend.subscribeEvent('close', () => {
        this.log('Backend closed. Retry.');
        this.dispatchEvent(
          new CustomEvent('close', {
            detail: {
              backend: backend,
            },
          })
        );
        retry();
      }),
      () => {
        if (backend.isOpen || backend.isInit) backend.close();
        unregister();
        this._backend = null;
      }
    );

    return subscriptions.unsubscribe.bind(subscriptions);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case 'type':
        this.type = newValue;
        break;
      case 'name':
        this.name = newValue;
        break;
      case 'retry-interval':
        this.retryInterval = newValue !== null ? parseInt(newValue) : null;
        break;
      default:
        super.attributeChangedCallback(name, oldValue, newValue);
        break;
    }
  }
}

customElements.define('awml-backend', BackendComponent);
