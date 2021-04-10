import { StylesComponentBase } from './styles_component_base.js';

/**
 * Component which modifies the attributes of its parent element. The data is
 * expected to be an object containing the attributes.
 *
 * This component has the following properties (and corresponding attributes):
 *
 * - :js:attr:`StylesComponentBase.triggerResize`
 * - :js:attr:`PrefixComponentBase.src`
 * - :js:attr:`PrefixComponentBase.srcPrefix`
 * - :js:attr:`PrefixComponentBase.transformReceive`
 * - :js:attr:`PrefixComponentBase.transformSend`
 * - :js:attr:`PrefixComponentBase.transformSrc`
 * - :js:attr:`PrefixComponentBase.debounce`
 * - :js:attr:`PrefixComponentBase.partial`
 * - :js:attr:`PrefixComponentBase.pipe`
 * - :js:attr:`PrefixComponentBase.replay`
 * - :js:attr:`PrefixComponentBase.debounce`
 * - :js:attr:`BaseComponent.debug`
 *
 */
export class AttributesComponent extends StylesComponentBase {
  static get observedAttributes() {
    return StylesComponentBase.observedAttributes;
  }

  applyState(v) {
    const target = this.target;

    if (typeof v === 'object') {
      for (const name in v) {
        target.setAttribute(name, v[name]);
      }
    } else {
      throw new TypeError('Expected object.');
    }
  }

  removeState(v) {
    const target = this.target;

    if (typeof v === 'object') {
      for (const name in v) {
        target.removeAttribute(name);
      }
    } else {
      throw new TypeError('Expected object.');
    }
  }
}
