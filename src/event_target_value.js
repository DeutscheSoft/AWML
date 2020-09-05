import { DynamicValue } from './dynamic_value.js';
import { subscribeDOMEvent } from './utils/subscribe_dom_event.js';

export class EventTargetValue extends DynamicValue {
  _subscribe() {
    return subscribeDOMEvent(this._eventTarget, this._eventName, (ev) => {
      if (
        this._preventDefault &&
        (typeof ev.cancelable !== 'boolean' || ev.cancelable)
      )
        ev.preventDefault();
      if (this._stopPropagation) ev.stopPropagation();
      this._updateValue(ev);
    });
  }

  constructor(eventTarget, eventName, preventDefault, stopPropagation) {
    super();
    this._eventTarget = eventTarget;
    this._eventName = eventName;
    this._preventDefault = !!preventDefault;
    this._stopPropagation = !!stopPropagation;
  }
}
