import { ISubscription } from '../subscription.js';

/**
 * Subscribes to a DOM event.
 */
export function subscribeDOMEvent(
  node: EventTarget,
  name: string,
  callback: Function
): ISubscription;

/**
 * Subscribes to a DOM event once.
 */
export function subscribeDOMEventOnce(
  node: EventTarget,
  name: string,
  callback: Function
): ISubscription;

/**
 * Waits for a DOM event to fire.
 */
export function waitForDOMEvent(
  node: EventTarget,
  name: string
): Promise<Event>;
