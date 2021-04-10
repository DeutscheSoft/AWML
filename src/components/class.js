import { StylesComponentBase } from './styles_component_base.js';

/**
 * Component which modifies the CSS class of its parent element. The data can
 * be either a string or an array of strings.
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
export class ClassComponent extends StylesComponentBase {
  static get observedAttributes() {
    return StylesComponentBase.observedAttributes;
  }

  applyState(v) {
    const classList = this.target.classList;

    if (typeof v === 'string') {
      classList.add(v);
    } else if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) classList.add(v[i]);
    } else {
      throw new TypeError('Expected string or string[].');
    }
  }

  removeState(v) {
    const classList = this.target.classList;

    if (typeof v === 'string') {
      classList.remove(v);
    } else if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) classList.remove(v[i]);
    } else {
      throw new TypeError('Expected string or string[].');
    }
  }
}
