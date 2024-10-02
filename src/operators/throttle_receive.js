import { fromSubscription } from './from_subscription.js';
import { now } from '../utils/now.js';

/**
 * Returns a new dynamic value which emits values at most once every {interval} milliseconds.
 * When values are emitted by dv$ more often, the last value is emitted at the end of the interval.
 *
 * @param {DynamicValue} dv$
 * @param interval
 * @returns {DynamicValue}
 */
export function throttleReceive(dv$, interval) {
  if (!(interval > 0)) throw new TypeError('Expected positive number.');
  return fromSubscription(
    (callback) => {
      let lastValue;
      let lastValueTime;
      let pending = false;
      let timerId;

      const emitValue = () => {
        pending = false;
        lastValueTime = now();
        callback(lastValue);
      };

      const unsubscribe = dv$.subscribe((value) => {
        lastValue = value;

        if (pending) return;

        if (lastValueTime !== undefined) {
          const timeLeft = now() - lastValueTime;
          if (timeLeft < interval) {
            pending = true;
            timerId = setTimeout(emitValue, interval - timeLeft);
            return;
          }
        }

        emitValue();
      });

      return () => {
        unsubscribe();
        if (pending) clearTimeout(timerId);
      };
    },
    (value) => dv$.set(value)
  );
}
