import { StylesComponentBase } from './styles_component_base.js';

/**
 * Component which modifies the styles of its parent element. The data is
 * expected to be an object containing the styles.
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
export class StylesComponent extends StylesComponentBase {
  static get observedAttributes() {
    return StylesComponentBase.observedAttributes;
  }

  applyState(v) {
    const style = this.target.style;

    if (typeof v === 'object') {
      for (const name in v) {
        const value = v[name];

        if (Array.isArray(value)) {
          style.setProperty(name, ...value);
        } else {
          style.setProperty(name, value);
        }
      }
    } else {
      throw new TypeError('Expected object.');
    }
  }

  removeState(v) {
    const style = this.target.style;

    if (typeof v === 'object') {
      for (const name in v) {
        style.removeProperty(name);
      }
    } else {
      throw new TypeError('Expected object.');
    }
  }
}
