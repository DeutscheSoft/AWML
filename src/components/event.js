import { parseAttribute } from '../utils/parse_attribute.js';
import { subscribeDOMEvent } from '../utils/subscribe_dom_event.js';
import {
  isCustomElement,
  getAuxWidget,
  subscribeCustomElement,
} from '../utils/aux-support.js';
import { BaseComponent } from './base.js';

function combine_subscriptions(callbacks) {
  return () => {
    if (callbacks === null) return;
    const tmp = callbacks;
    callbacks === null;
    tmp.forEach((cb) => cb());
  };
}

/**
 * The AWML-EVENT component can be used to attach event handlers to an AUX
 * widget or other DOM nodes.
 *
 * If the parent is an AUX widget the event handler will use the AUX widget
 * event mechanism, is the parent is any other DOM node, the standard DOM event
 * API will be used.
 */
export class EventComponent extends BaseComponent {
  static get observedAttributes() {
    return BaseComponent.observedAttributes.concat(['type', 'callback']);
  }

  /**
   * Event type, e.g. `"click"`.
   *
   * @return {string}
   */
  get type() {
    return this._type;
  }

  /** @ignore */
  set type(v) {
    if (typeof v !== 'string' && v !== null && !Array.isArray(v))
      throw new TypeError('Expected string.');
    this._type = v;
    this._resubscribe();
  }

  /**
   * Callback function.
   *
   * @return {function}
   */
  get callback() {
    return this._callback;
  }

  /** @ignore */
  set callback(v) {
    if (typeof v !== 'function' && v !== null)
      throw new TypeError('Expected function.');
    this._callback = v;
    this._resubscribe();
  }

  constructor() {
    super();
    this._type = null;
    this._callback = null;
  }

  _subscribe() {
    const type = this._type;
    const callback = this._callback;

    if (type === null || callback === null) return null;

    const parent = this.parentNode;

    if (isCustomElement(parent)) {
      const widget = getAuxWidget(parent);

      // try again when the component has been defined
      if (widget === null)
        return subscribeCustomElement(parent, () => this._resubscribe());

      if (typeof type === 'string') return widget.subscribe(type, callback);

      return combine_subscriptions(
        type.map((name) => widget.subscribe(name, callback))
      );
    } else {
      // generic DOM node
      if (typeof type === 'string')
        return subscribeDOMEvent(parent, type, callback);

      return combine_subscriptions(
        type.map((name) => subscribeDOMEvent(parent, name, callback))
      );
    }
  }

  /** @ignore */
  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case 'type':
        if (newValue === '' || newValue === null) {
          this.type = null;
        } else {
          const tmp = newValue
            .split(/[^a-zA-Z0-9\-_]/)
            .map((v) => v.trim())
            .filter((v) => v.length);

          if (tmp.length === 0) {
            this.type = null;
          } else if (tmp.length === 1) {
            this.type = tmp[0];
          } else {
            this.type = tmp;
          }
        }
        break;
      case 'callback':
        this.callback = parseAttribute('javascript', newValue, null);
        break;
      default:
        super.attributeChangedCallback(name, oldValue, newValue);
        break;
    }
  }
}

customElements.define('awml-event', EventComponent);
