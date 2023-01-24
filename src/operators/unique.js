import { fromSubscription } from './from_subscription.js';
import { combineUnsubscribe } from '../utils/combine_unsubscribe.js';
import { DynamicValue } from '../dynamic_value.js';

function defaultCompare(a, b) {
  return a === b;
}

/**
 * Transform the input dynamic value and returns a new DynamicValue which skips
 * identical values from being emitted. If no comparison function is given, the
 * `===` is used to compare values.
 *
 * @param {DynamicValue} dv
 * @param {function(*, *): boolean} compare
 *      Comparison function for values.
 * @return {DynamicValue}
 */
export function unique(dv, compare) {
  if (!(dv instanceof DynamicValue))
    throw new TypeError('Expected DynamicValue.');

  if (compare === void 0) compare = defaultCompare;
  else if (typeof compare !== 'function')
    throw new TypeError('Expected function.');

  let lastValue = null;
  let hasLastValue = false;

  return fromSubscription(
    function (callback) {
      return combineUnsubscribe(
        dv.subscribe((value) => {
          if (hasLastValue && compare(value, lastValue)) return;
          lastValue = value;
          hasLastValue = true;
          callback(value);
        }),
        () => {
          hasLastValue = false;
          lastValue = null;
        }
      );
    },
    function (value) {
      return dv.set(value);
    }
  );
}
