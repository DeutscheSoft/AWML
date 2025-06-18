import { fromSubscription } from './from_subscription.js';
import { safeCall } from '../utils/safe_call.js';
import { mapContainer } from '../utils/map_container.js';
import { runCleanupHandler } from '../utils/run_cleanup_handler.js';
import { combineUnsubscribe } from '../utils/combine_unsubscribe.js';

function identity(item, key, items) {
  return item;
}

export function resolveItems(dv, subscribe, getKey) {
  if (getKey === void 0) getKey = identity;

  return fromSubscription((callback) => {
    const subscriptions = new Map();
    const transformedItems = new Map();
    let lastItems = null;
    let debounce = false;

    const update = () => {
      if (debounce) return;
      if (subscriptions.size !== transformedItems.size) return;
      callback(
        mapContainer(lastItems, (item, index, items) => {
          const key = getKey(item, index, items);
          return transformedItems.get(key);
        })
      );
    };

    return combineUnsubscribe(
      dv.subscribe((items) => {
        const currentItems = new Set();
        debounce = true;

        items.forEach((item, index, items) => {
          const key = getKey(item, index, items);

          currentItems.add(key);
          if (subscriptions.has(key)) return;

          let result = null;
          const callback = (transformedItem) => {
            transformedItems.set(key, transformedItem);
            update();
          };

          safeCall(() => {
            result = subscribe(item, key, items, callback);
          });

          if (
            result !== null &&
            typeof result === 'object' &&
            typeof result.subscribe === 'function'
          ) {
            result = result.subscribe(callback);
          }

          subscriptions.set(key, result);
        });

        debounce = false;

        // Nothing to do.
        if (subscriptions.size !== currentItems.size) {
          subscriptions.forEach((unsubscribe, key) => {
            if (currentItems.has(key)) return;
            subscriptions.delete(key);
            runCleanupHandler(unsubscribe);
            transformedItems.delete(key);
          });
        }

        lastItems = items;
        update();
      }),
      () => {
        subscriptions.forEach((unsubscribe) => {
          runCleanupHandler(unsubscribe);
        });
      }
    );
  });
}

export function forEachAsync(dv, callback, getKey) {
  return resolveItems(dv, callback, getKey).subscribe(() => {});
}
