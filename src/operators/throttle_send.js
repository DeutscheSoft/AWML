import { fromSubscription } from './from_subscription.js';
import { now } from '../utils/now.js';
import { delay } from '../utils/delay.js';

/**
 * Returns a new dynamic value which sends values at most once every {interval} milliseconds.
 * When set() is called more often, the last value is emitted at the end of the interval.
 *
 * @param {DynamicValue} dv$
 * @param interval
 * @returns {DynamicValue}
 */
export function throttleSend(dv$, interval) {
  if (!(interval > 0)) throw new TypeError('Expected positive number.');

  let lastValue;
  let lastValueTime;
  let pending;

  const setWithDelay = async (interval) => {
    await delay(interval);
    lastValueTime = now();
    pending = undefined;
    await dv$.set(lastValue);
  };

  return fromSubscription(
    (callback) => dv$.subscribe(callback),
    (value) => {
      lastValue = value;

      if (pending) return pending;

      if (lastValueTime !== undefined) {
        const timeLeft = now() - lastValueTime;
        if (timeLeft < interval) {
          pending = setWithDelay(interval - timeLeft);
          return pending;
        }
      }
      lastValueTime = now();
      return dv$.set(lastValue);
    }
  );
}
