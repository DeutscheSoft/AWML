import { map } from './map.js';
import { mapContainer } from '../utils/map_container.js';

function identity(item, key, items) {
  return item;
}

/**
 * Takes a dynamic value which emits builtin iterables (Array,
 * Map, Set, WeakMap, WeakSet) and transforms each entry using
 * the projection.
 *
 * Individual transformed items are cached. This means that the
 * projections function is expected to be have no side effects.
 * Items are identified by using the getKey function. If getKey
 * is left undefined, the items itself are used as identifiers.
 *
 * To identify items by their key inside of the container, use the
 * mapItemsCachedByKey() function or set the getKey function appropriately.
 *
 * The returned dynamic value is always read-only.
 */
export function mapItemsCached(dv, projection, getKey) {
  if (getKey === void 0) getKey = identity;

  let currentItems = new Map();

  return map(dv, (items) => {
    let newItems = new Map();

    const result = mapContainer(items, (item, index, items) => {
      const key = getKey(item, index, items);
      let transformedItem;

      if (currentItems.has(key)) {
        transformedItem = currentItems.get(key);
      } else if (newItems.has(key)) {
        transformedItem = newItems.get(key);
      } else {
        transformedItem = projection(item, key, items);
      }

      newItems.set(key, transformedItem);

      return transformedItem;
    });

    currentItems = newItems;

    return result;
  });
}

function getKey(item, key, items) {
  return key;
}

export function mapItemsCachedByKey(dv, project) {
  return mapItemsCached(dv, project, getKey);
}
