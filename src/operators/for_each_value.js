import { combineUnsubscribe } from '../utils/combine_unsubscribe.js';
import { assignCleanup, initCleanup } from '../utils/cleanup.js';

/**
 *
 * @param {DynamicValue} dv
 * @param {(value) => ISubscription|null} continuation
 * @param {boolean} [replay=true]
 * @param {(a, b) => boolean} [compare]
 */
export function forEachValue(dv, continuation, replay = true, compare) {
  const cleanup = initCleanup();

  let hasValue = false;
  let lastValue = null;

  const unsubscribe = dv.subscribe((value) => {
    if (hasValue) {
      if (compare) {
        if (compare(lastValue, value)) return;
      } else {
        if (value === lastValue) return;
      }
    } else {
      hasValue = true;
    }

    lastValue = value;

    assignCleanup(cleanup, continuation(value));
  });

  return combineUnsubscribe(unsubscribe, cleanup);
}
