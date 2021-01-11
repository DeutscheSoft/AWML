import { PrefixComponentBase } from './prefix_component_base.js';
import { error } from '../utils/log.js';
import {
  isCustomElement,
  isCustomElementDefined,
  subscribeCustomElement,
} from '../utils/aux-support.js';

const optionTypes = new Map();
const optionTypeSubscribers = new Map();

/** @ignore */
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

/** @ignore */
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

/**
 * The ``AWML-OPTION`` component can be used to bind to options in AUX widgets.
 * The type and behavior of the binding depends on the specific option being used.
 * Standard option types available as part of AWML are
 *
 * - ``static`` for setting options to static values (see :ref:`StaticOption`),
 * - ``media`` for setting options based on CSS media queries and
 * - ``bind`` for binding options to backend values.
 *
 * Note that each option has additional attributes which can be used to control
 * its behavior. They are documented for each option type. These additional
 * options are only interpreted when the option is first connected. This means
 * that when these options are changed dynamically, it is necessary to also
 * modify either ``name`` or ``type`` to trigger the option to be reinitialized.
 *
 */
export class OptionComponent extends PrefixComponentBase {
  /** @ignore */
  static get observedAttributes() {
    return PrefixComponentBase.observedAttributes.concat(['type', 'name']);
  }

  /**
   * Type of this option.
   *
   * @return {string}
   */
  get type() {
    return this._type;
  }

  set type(v) {
    if (typeof v !== 'string' && v !== null)
      throw new TypeError('Expected string.');
    this._type = v;
    this._resubscribe();
  }

  /**
   * Option name in the parent widget.
   *
   * @return {string}
   */
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

    if (!parentNode.isAuxWidget) {
      if (!isCustomElement(parentNode))
        throw new Error(
          'AWML-OPTION needs to be the direct child of a WebComponent.'
        );

      // come back when the custom element has been defined
      if (!isCustomElementDefined(parentNode))
        return subscribeCustomElement(parentNode, () => this._resubscribe());
    }

    let sub = null;

    if (constructor.needsBackendValue === true) {
      const backendValue = this._getBackendValue();

      if (backendValue === null) return null;

      this._backendValue = backendValue;
    }

    const options = constructor.optionsFromNode(this);

    options.name = name;

    const option = new constructor(options, parentNode);

    // come back when the option is ready.
    if (typeof option.then === 'function') {
      option.then(() => this._resubscribe());
      return null;
    }

    this._option = option;

    this.log('Constructed option implementation %o', option);

    return () => {
      option.destroy();
      this._option = null;
      this._backendValue = null;

      if (sub !== null) {
        sub();
        sub = null;
      }
      this.log('Destructed option implementation.');
    };
  }

  /** @ignore */
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
