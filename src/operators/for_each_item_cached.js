import { runCleanupHandler } from '../utils/run_cleanup_handler.js';
import { mapContainer } from '../utils/map_container.js';
import { combineUnsubscribe } from '../utils/combine_unsubscribe.js';

function identity(item, key, items) {
  return item;
}

/**
 * Takes a dynamic value which emits builtin iterables (Array,
 * Map, Set, WeakMap, WeakSet) and calls the continuation
 * for each entry. Each continuation can return a cleanup handler
 * of type ISubscription.
 *
 * Individual transformed items are cached. This means that the
 * continuation is only called once an item first appears.
 * Items are identified by using the getKey function. If getKey
 * is left undefined, the items itself are used as identifiers.
 *
 * To identify items by their key inside of the container, use the
 * mapItemsCachedByKey() function or set the getKey function appropriately.
 *
 * The return value is a cleanup handler.
 *
 * @param {DynamicValue} dv
 * @param {(value, key, items) => ISubscription} continuation
 * @param {(item, key, items) => unknown} getKey
 * @returns {ISubscription}
 */
export function forEachItemCached(dv, continuation, getKey) {
  if (getKey === void 0) getKey = identity;

  let currentCleanups = new Map();

  const cleanup = () => {
    currentCleanups.forEach(runCleanupHandler);
    currentCleanups.clear();
  };

  return combineUnsubscribe(
    dv.subscribe((items) => {
      const newCleanups = new Map();

      mapContainer(items, (item, index, items) => {
        const key = getKey(item, index, items);
        let unsubscribe;

        if (currentCleanups.has(key)) {
          unsubscribe = currentCleanups.get(key);
        } else if (newCleanups.has(key)) {
          unsubscribe = newCleanups.get(key);
        } else {
          unsubscribe = null;
          try {
            unsubscribe = continuation(item, key, items);
          } catch (err) {
            warn('continuation threw an exception for', item, ':', err);
          }
        }

        newCleanups.set(key, unsubscribe);
      });

      currentCleanups.forEach((item, key) => {
        if (newCleanups.has(key)) return;
        runCleanupHandler(item);
      });
      currentCleanups = newCleanups;
    }),
    cleanup
  );
}

function getKey(item, key, items) {
  return key;
}

/**
 *
 * @param {DynamicValue} dv
 * @param {(value, key, items) => ISubscription} continuation
 * @returns {ISubscription}
 */
export function forEachItemCachedByKey(dv, continuation) {
  return forEachItemCached(dv, continuation, getKey);
}
