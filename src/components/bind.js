import { BaseComponent } from './base_component.js';
import { parseAttribute } from '../utils/parse_attribute.js';
import {
  isCustomElement,
  isCustomElementDefined,
  subscribeCustomElement,
} from '../utils/aux-support.js';
import { registerPrefixTagName } from '../utils/prefix.js';
import { Bindings } from '../bindings.js';

/**
 * BindComponent can be used to create a series of bindings between backend
 * values and a component.
 */
export class BindComponent extends BaseComponent {
  /** @ignore */
  static get observedAttributes() {
    return BaseComponent.observedAttributes.concat(['bindings']);
  }

  /**
   * @type {IBindingDescription[]}
   */
  get bindings() {
    return this._bindings;
  }
  set bindings(value) {
    this._bindings = value;

    const bindingsImpl = this._bindingsImpl;

    if (bindingsImpl) bindingsImpl.update(value);
  }

  constructor() {
    super();
    this._bindings = null;
    this._bindingsImpl = null;
    // it would be enough to do this once
    registerPrefixTagName(this.tagName);
  }

  _subscribe() {
    const parentNode = this.parentNode;

    if (isCustomElement(parentNode)) {
      if (!isCustomElementDefined(parentNode))
        return subscribeCustomElement(parentNode, () => this._resubscribe());
    }

    const bindingsImpl = new Bindings(
      this.parentNode,
      this,
      this,
      this.getLog()
    );

    this._bindingsImpl = bindingsImpl;

    const bindings = this._bindings;

    if (bindings !== null) bindingsImpl.update(bindings);

    return () => {
      this._bindingsImpl = null;
      bindingsImpl.dispose();
    };
  }

  /** @ignore */
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'bindings') {
      this.bindings = parseAttribute('javascript', newValue, null);
    } else {
      super.attributeChangedCallback(name, oldValue, newValue);
    }
  }

  /** @ignore */
  _updatePrefix(handle) {
    const bindingsImpl = this._bindingsImpl;

    if (bindingsImpl) bindingsImpl.updatePrefix(handle);
  }
}
