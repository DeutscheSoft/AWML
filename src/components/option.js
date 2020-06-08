import { PrefixComponentBase } from './prefix_component_base.js';
import { error } from '../utils/log.js';
import {
  maybeAuxElement,
  getAuxWidget,
  subscribeCustomElement,
} from '../utils/aux.js';

const optionTypes = new Map();
const optionTypeSubscribers = new Map();

export function registerOptionType(type, constructor) {
  if (optionTypes.has(type)) throw new Error('Cannot redefine a backend type.');

  optionTypes.set(type, constructor);

  const subscribers = optionTypeSubscribers.get(type);
  optionTypeSubscribers.delete(type);

  if (subscribers === void 0) return;

  subscribers.forEach((cb) => {
    try {
      cb(constructor);
    } catch (err) {
      error('Subscriber generated an exception: %o', err);
    }
  });
}

export function subscribeOptionType(type, callback) {
  if (typeof type !== 'string') throw new TypeError('Expected string.');

  if (typeof callback !== 'function') throw new TypeError('Expected function.');

  let subscribers = optionTypeSubscribers.get(type);

  if (subscribers === void 0) {
    optionTypeSubscribers.set(type, (subscribers = new Set()));
  }

  subscribers.add(callback);

  return () => {
    if (callback === null) return;
    subscribers.delete(callback);
  };
}

class OptionComponent extends PrefixComponentBase {
  static get observedAttributes() {
    return PrefixComponentBase.observedAttributes.concat(['type', 'name']);
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

  get name() {
    return this._name;
  }

  set name(v) {
    if (typeof v !== 'string' && v !== null)
      throw new TypeError('Expected string.');
    this._name = v;
    this._resubscribe();
  }

  constructor() {
    super();
    this._type = null;
    this._name = null;
    this._option = null;
  }

  _subscribe() {
    const type = this._type;
    const name = this._name;

    if (type === null || name === null) return null;

    const constructor = optionTypes.get(type);

    // come back when the option type has been defined.
    if (constructor === void 0)
      return subscribeOptionType(type, () => this._resubscribe());

    const parentNode = this.parentNode;

    if (!maybeAuxElement(parentNode))
      throw new Error(
        'AWML-OPTION needs to be the direct child of an AUX Widget.'
      );

    const widget = getAuxWidget(parentNode);

    // come back when the custom element has been defined
    if (widget === null)
      return subscribeCustomElement(parentNode, () => this._resubscribe());

    let sub = null;

    if (constructor.needsBackendValue === true) {
      sub = super._subscribe();

      // backend value not found, yet.
      if (sub === null) return null;
    }

    const options = constructor.optionsFromNode(this);

    options.name = name;
    options.widget = widget;

    const option = new constructor(options);

    this._option = option;

    this.log('Constructed option implementation %o', option);

    const backendValue = this._backendValue;

    if (backendValue !== null && backendValue.hasValue) {
      let value = backendValue.value;
      const transformReceive = this._transformReceive;

      if (transformReceive !== null) {
        value = transformReceive.call(this._backendValue, value);
      }

      option.valueReceived(value);
    }

    return () => {
      option.destroy();
      this._option = null;

      if (sub !== null) {
        sub();
        sub = null;
      }
      this.log('Destructed option implementation.');
    };
  }

  _valueReceived(value) {
    const option = this._option;
    // this happens if the backendValue already has a value and calls
    // the subscriber in super._subscribe(). We handle this by calling
    // option.valueReceived() above.
    if (option === null) return;
    option.valueReceived(value);
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
    }
  }
}

customElements.define('awml-option', OptionComponent);
