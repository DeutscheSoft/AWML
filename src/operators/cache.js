import { fromSubscription } from './from_subscription.js';
import { safeCall } from '../utils/safe_call.js';

/**
 * Returns a new dynamic value which caches the last value even
 * if no subscription is currently active. The subscription is removed
 * when the first value change is received while being unsubscribed.
 *
 * This operator is useful in situations where subscriptions are added
 * and removed in quick succession.
 *
 * @param value The dynamic value to cache.
 */
export function cache(dv) {
  let hasValue = false;
  let lastValue = null;
  let isActive = false;
  let unsubscribe = null;
  let subscriber = null;

  function onValue(value) {
    if (subscriber !== null) {
      hasValue = true;
      lastValue = value;
      safeCall(subscriber, value);
    } else {
      hasValue = false;
      safeCall(unsubscribe);
    }
  }

  return fromSubscription(
    (callback) => {
      subscriber = callback;

      if (isActive) {
        // we are still subscribed
        if (hasValue) safeCall(callback, lastValue);
      } else {
        unsubscribe = dv.subscribe(onValue);
      }

      return () => {
        subscriber = null;
      };
    },
    (value) => dv.set(value)
  );
}
