import { parseAttribute } from '../utils/parse_attribute.js';
import { subscribeDOMEvent } from '../utils/subscribe_dom_event.js';
import {
  isAuxComponent,
  getAuxWidget,
  subscribeAuxWidget,
} from '../utils/aux.js';
import { BaseComponent } from './base.js';

class EventComponent extends BaseComponent {
  static get observedAttributes() {
    return BaseComponent.observedAttributes.concat(['type', 'callback']);
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
  }

  _subscribe() {
    const type = this._type;
    const callback = this._callback;

    if (type === null || callback === null) return null;

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

  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case 'type':
        this.type = newValue;
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
