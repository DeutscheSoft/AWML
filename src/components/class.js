import { StylesComponentBase } from './styles_component_base.js';

export class ClassComponent extends StylesComponentBase {
  static get observedAttributes() {
    return StylesComponentBase.observedAttributes;
  }

  applyState(v) {
    const classList = this._target.classList;

    if (typeof v === 'string') {
      classList.add(v);
    } else if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++)
        classList.add(v[i]);
    } else {
      throw new TypeError('Expected string or string[].');
    }
  }

  removeState(v) {
    const classList = this._target.classList;

    if (typeof v === 'string') {
      classList.remove(v);
    } else if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++)
        classList.remove(v[i]);
    } else {
      throw new TypeError('Expected string or string[].');
    }
  }
}

customElements.define('awml-class', ClassComponent);
