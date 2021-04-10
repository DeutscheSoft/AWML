import { StylesComponentBase } from './styles_component_base.js';
import { setPrefix, removePrefix } from '../utils/prefix.js';

/**
 * Component which modifies the prefix of its parent element. The data can
 * be either a string or null. The `handle` attribute can be used to control
 * which `src-prefix` this should apply to.
 *
 * This component has the following properties (and corresponding attributes):
 *
 * - :js:attr:`PrefixComponent.handle`
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
 *
 */
export class PrefixComponent extends StylesComponentBase {
  static get observedAttributes() {
    return StylesComponentBase.observedAttributes.concat(['handle']);
  }

  /**
   * The source handle to use. Passed as second argument
   * to :js:func:`setPrefix`.
   * @type {?string}
   */
  get handle() {
    return this._handle;
  }
  set handle(v) {
    if (typeof v !== 'string' && v !== null) {
      throw new TypeError('Expected string.');
    }
    this._handle = v;
    this.triggerDraw();
  }

  applyState(v) {
    setPrefix(this.target, v, this._handle);
  }

  removeState(v) {
    removePrefix(this.target, this._handle);
  }

  /** @ignore */
  updateState(oldState, newState) {
    if (newState === null) {
      this.removeState(oldState);
    } else {
      this.applyState(newState);
    }
  }

  /** @ignore */
  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case 'handle':
        this.handle = newValue;
        break;
      default:
        super.attributeChangedCallback(name, oldValue, newValue);
    }
  }
}
