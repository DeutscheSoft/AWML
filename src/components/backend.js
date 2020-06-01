import { error } from '../utils/log.js';
import { BaseComponent } from './base.js';
import { registerBackend, unregisterBackend } from '../backends.js';
import { Subscriptions } from '../utils/subscriptions.js';

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
    return BaseComponent.observedAttributes.concat(['name', 'type']);
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

  constructor() {
    super();
    this._name = null;
    this._type = null;
    this._backend = null;
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
          registerBackend(name, backend);
          registered = true;
        })
      );
    }

    const retry = () => {
      subscriptions.add(
        timeout(() => {
          this._resubscribe();
        }, 400)
      );
    };

    subscriptions.add(
      backend.subscribeEvent('error', retry),
      backend.subscribeEvent('close', retry),
      () => {
        if (backend.isOpen || backend.isInit) backend.close();
        if (registered) unregisterBackend(name, backend);
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
      default:
        super.attributeChangedCallback(name, oldValue, newValue);
        break;
    }
  }
}

customElements.define('awml-backend', BackendComponent);
