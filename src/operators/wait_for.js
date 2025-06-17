import { DynamicValue } from '../dynamic_value.js';
import { assignCleanup } from '../utils/cleanup.js';
import { initCleanup } from '../utils/cleanup.js';
import { combineSubscriptions } from '../utils/combine_subscriptions.js';
import { subscribeDOMEvent } from '../utils/subscribe_dom_event.js';

function yes() {
  return true;
}

/**
 * Returns a promise which resolves when the dynamic value dv emits
 * a value for which predicate(value) is true. The promise rejects if
 * the predicate throws and exception.
 *
 * @param {DynamicValue<T>} dv
 * @param {(value: T) => boolean} [predicate]
 * @param {boolean} [replay=true]
 * @param {AbortSignal} [signal]
 * @returns {Promise<T>}
 */
export function waitFor(dv, predicate = yes, replay = true, signal) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) throw new Error('Aborted.');

    if (replay && dv.hasValue && dv.isActive && predicate(dv.value)) {
      resolve(dv.value);
      return;
    }

    const cleanup = initCleanup();

    assignCleanup(
      cleanup,
      combineSubscriptions(
        dv.subscribe((value) => {
          try {
            if (predicate(value)) {
              resolve(value);
              cleanup();
            }
          } catch (err) {
            cleanup();
            reject(err);
          }
        }, replay),
        signal
          ? subscribeDOMEvent(signal, 'abort', () => {
              reject(signal.reason);
              cleanup();
            })
          : null
      )
    );
  });
}
