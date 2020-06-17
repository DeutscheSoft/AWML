import { RedrawComponentBase } from './redraw_component_base.js';
import { parseAttribute } from '../utils/parse_attribute.js';

function Identity(v) {
  return v;
}

/**
 * Base class for style transformation components.
 */
export class StylesComponentBase extends RedrawComponentBase {
  /**
   * Method which calculates the display state. It is initialized
   * by parsing the textContent of this
   * component.
   * @type {?function}
   */
  get getState() {
    return this._getState;
  }
  set getState(v) {
    if (v !== null && typeof v !== 'function') {
      throw new TypeError('Expected function.');
    }
    this._getState = v;
  }

  /**
   * If true, a resize is triggered after updating the display state.
   * @type {?boolean}
   */
  get triggerResize() {
    return this._triggerResize;
  }
  set triggerResize(v) {
    if (typeof v !== 'boolean') {
      throw new TypeError('Expected boolean.');
    }
    this._triggerResize = v;
  }

  /** @ignore */
  static get observedAttributes() {
    return RedrawComponentBase.observedAttributes;
  }

  constructor() {
    super();
    this._getState = null;
    this._state = null;
    this._target = null;
    this._triggerResize = false;
  }

  /** @ignore */
  redraw() {
    // we do this here because it needs to happen after all
    // children have been initialized
    if (this._getState === null) {
      this.getState = parseAttribute('javascript', this.textContent, Identity);
    }

    const state = this._getState(this._value);
    const prevState = this._state;

    if (state === prevState) return;

    this.log('Applying state %o to %o', state, this._target);

    this.updateState(prevState, state);
    this._state = state;
    if (this._triggerResize) {
      const widget = this._target.auxWidget;

      if (widget !== void 0) {
        if (widget.parent) {
          this.log('Triggering resize in widget parent.');
          widget.parent.triggerResize();
        } else {
          this.log('Triggering resize in widget.');
          widget.triggerResize();
        }
      }
    }
  }

  /** @ignore */
  updateState(oldState, newState) {
    if (oldState !== null) this.removeState(oldState);
    this._state = null;
    if (newState !== null) this.applyState(newState);
  }

  /** @ignore */
  connectedCallback() {
    this._target = this.parentNode;
    super.connectedCallback();
  }

  /** @ignore */
  disconnectedCallback() {
    super.disconnectedCallback();

    const state = this._state;

    if (state === null) return;

    this.log('Removing state', state);
    this.removeState(state);
    this._state = null;
    this._target = null;
  }

  /** @ignore */
  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case 'trigger-resize':
        this.srcPrefix = newValue !== null;
        break;
      default:
        super.attributeChangedCallback(name, oldValue, newValue);
    }
  }
}
