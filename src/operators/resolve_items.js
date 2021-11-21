import { fromSubscription } from './from_subscription.js';
import { safeCall } from '../utils/safe_call.js';
import { warn } from '../utils/log.js';
import { mapContainer } from '../utils/map_container.js';

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

    return dv.subscribe((items) => {
      const currentItems = new Set();
      debounce = true;

      items.forEach((item, index, items) => {
        const key = getKey(item, index, items);

        currentItems.add(key);
        if (subscriptions.has(key)) return;

        let unsubscribe = null;
        try {
          unsubscribe = subscribe(item, key, items, (transformedItem) => {
            transformedItems.set(key, transformedItem);
            update();
          });
        } catch (err) {
          warn('A subscribe function threw an exception: %o.', err);
        }

        subscriptions.set(key, unsubscribe);
      });

      debounce = false;

      // Nothing to do.
      if (subscriptions.size !== currentItems.size) {
        subscriptions.forEach((unsubscribe, key) => {
          if (currentItems.has(key)) return;
          subscriptions.delete(key);
          safeCall(unsubscribe);
          transformedItems.delete(key);
        });
      }

      lastItems = items;
      update();
    });
  });
}

export function forEachAsync(dv, callback, getKey) {
  return resolveItems(dv, callback, getKey).subscribe(() => {});
}
