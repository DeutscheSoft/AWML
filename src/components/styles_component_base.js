import { RedrawComponentBase } from './redraw_component_base.js';
import { parseAttribute } from '../utils/parse_attribute.js';

function Identity(v) {
  return v;
}

export class StylesComponentBase extends RedrawComponentBase {
  static get observedAttributes() {
    return RedrawComponentBase.observedAttributes;
  }

  constructor() {
    super();
    this._getState = null;
    this._state = null;
    this._target = null;
  }

  redraw() {
    // we do this here because it needs to happen after all
    // children have been initialized
    if (this._getState === null) {
      this._getState = parseAttribute('javascript', this.textContent, Identity);
    }

    const state = this._getState(this._value);
    this.log('Applying state %o to %o', state, this._target);

    const prevState = this._state;

    if (state === prevState) return;

    this.updateState(prevState, state);
    this._state = state;
  }

  updateState(oldState, newState) {
    if (oldState !== null) this.removeState(oldState);
    this._state = null;
    if (newState !== null) this.applyState(newState);
  }

  connectedCallback() {
    this._target = this.parentNode;
    super.connectedCallback();
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    const state = this._state;

    if (state === null) return;

    this.removeState(state);
    this._state = null;
    this._target = null;
  }
}
