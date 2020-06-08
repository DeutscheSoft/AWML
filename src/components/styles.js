import { StylesComponentBase } from './styles_component_base.js';

/**
 * Component which modifies the styles of its parent element. The data is
 * expected to be an object containing the styles.
 */
export class StylesComponent extends StylesComponentBase {
  static get observedAttributes() {
    return StylesComponentBase.observedAttributes;
  }

  applyState(v) {
    const style = this._target.style;

    if (typeof v === 'object') {
      for (let name in v) {
        style.setProperty(name, v[name]);
      }
    } else {
      throw new TypeError('Expected object.');
    }
  }

  removeState(v) {
    const style = this._target.style;

    if (typeof v === 'object') {
      for (let name in v) {
        style.removeProperty(name);
      }
    } else {
      throw new TypeError('Expected object.');
    }
  }
}

customElements.define('awml-styles', StylesComponent);
