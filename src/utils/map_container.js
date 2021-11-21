export function mapContainer(items, callback) {
  if (Array.isArray(items)) {
    return items.map(callback);
  } else if (items instanceof Map || items instanceof WeakMap) {
    const result = new items.__proto__.constructor();

    items.forEach((item, key, items) => {
      result.set(key, callback(item, key, items));
    });

    return result;
  } else if (items instanceof Set || items instanceof WeakSet) {
    const result = new items.prototype();

    items.forEach((item, items) => {
      result.add(callback(item, 0, items));
    });

    return result;
  } else if (typeof items === 'object' && 'map' in items) {
    return items.map(callback);
  } else {
    throw new TypeError('Expected Array|Map|Set|WeakMap|WeakSet.');
  }
}
