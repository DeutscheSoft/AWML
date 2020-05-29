import { parseAttribute } from '../utils/parse_attribute.js';
import { subscribeDOMEvent } from '../utils/subscribe_dom_event.js';
import {
  isAuxComponent,
  getAuxWidget,
  subscribeAuxWidget,
} from '../utils/aux.js';

class AWMLEvent extends HTMLElement {
  static get observedAttributes() {
    return ['type', 'callback', 'debug'];
  }

  get type() {
    return this._type;
  }

  set type(v) {
    if (typeof v !== 'string' && v !== null)
      throw new TypeError('Expected string.');
    this._type = v;
    this._resubscribe();
  }

  get callback() {
    return this._callback;
  }

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
    this._subscription = null;
    this.debug = false;
  }

  connectedCallback() {
    this.style.display = 'none';

    // we only want to subscribe here if we are not yet subscribed
    // and if we are connected to the dom
    if (this.isConnected && this._subscription === null) {
      this._subscription = this._subscribe();
    }
  }

  _unsubscribe() {
    const sub = this._subscription;
    this._subscription = null;
    if (sub) sub();
  }

  _subscribe() {
    const type = this._type;
    const callback = this._callback;

    if (type === null || callback === null) return;

    const parent = this.parentNode;

    if (isAuxComponent(parent)) {
      const widget = getAuxWidget(parent);

      // try again when the component has been defined
      if (widget === null)
        return subscribeAuxWidget(parent, () => this._resubscribe());

      return widget.subscribe(type, callback);
    } else {
      // generic DOM node
      return subscribeDOMEvent(parent, type, callback);
    }
  }

  _resubscribe() {
    this._unsubscribe();
    this._subscription = this._subscribe();
  }

  disconnectedCallback() {
    this._unsubscribe();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case 'type':
        this.type = newValue;
        break;
      case 'callback':
        this.callback = parseAttribute('javascript', newValue, null);
        break;
      case 'debug':
        this.debug = newValue !== null;
        break;
    }
  }
}

customElements.define('awml-event', AWMLEvent);
