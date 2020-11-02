import { subscribeDOMEvent } from '../utils/subscribe_dom_event.js';
import { fromSubscription } from './from_subscription.js';

/**
 * Creates a dynamic value from a DOM event.
 *
 * @param {EventTarget} eventTarget The event target.
 * @param {string} eventName The event name.
 * @param {bool} [preventDefault=false] If true, preventDefault() is called on
 *      each event.
 * @param {bool} [stopPropagation=false] If true, stopPropagation() is called on
 *      each event.
 */
export function fromDOMEvent(
  eventTarget,
  eventName,
  preventDefault,
  stopPropagation
) {
  if (typeof eventName !== 'string') throw new TypeError('Expected string.');

  preventDefault = !!preventDefault;
  stopPropagation = !!stopPropagation;

  return fromSubscription((callback) => {
    return subscribeDOMEvent(eventTarget, eventName, (ev) => {
      if (
        preventDefault &&
        (typeof ev.cancelable !== 'boolean' || ev.cancelable)
      )
        ev.preventDefault();
      if (stopPropagation) ev.stopPropagation();
      callback(ev);
    });
  });
}
