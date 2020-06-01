import { StylesComponentBase } from './styles_component_base.js';

export class AttributesComponent extends StylesComponentBase {
  static get observedAttributes() {
    return StylesComponentBase.observedAttributes;
  }

  applyState(v) {
    const target = this._target;

    if (typeof v === 'object') {
      for (let name in v) {
        target.setAttribute(name, v[name]);
      }
    } else {
      throw new TypeError('Expected object.');
    }
  }

  removeState(v) {
    const target = this._target;

    if (typeof v === 'object') {
      for (let name in v) {
        target.removeAttribute(name);
      }
    } else {
      throw new TypeError('Expected object.');
    }
  }
}

customElements.define('awml-attributes', AttributesComponent);
