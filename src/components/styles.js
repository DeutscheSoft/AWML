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
    if (typeof v === 'object') {
      let S = '';
      for (const name in v) {
        S += name + ': ' + v[name] + ';';
      }
      this.target.setAttribute('style', S);
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
