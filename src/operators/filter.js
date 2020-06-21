import { DynamicValue } from '../dynamic_value.js';

class FilteredValue extends DynamicValue {
  constructor(dv, predicate) {
    super();
    this._other = dv;
    this._predicate = predicate;
  }

  _subscribe() {
    return this._other.subscribe((x) => {
      const predicate = this._predicate;

      if (!predicate(x)) return;

      this._updateValue(x);
    });
  }

  set(x) {
    this._other.set(x);
  }
}

/**
 * Transform the input dynamic value and emits a new DynamicValue which emits
 * only those value for which the predicate is true.
 *
 * @param {DynamicValue}
 * @param {function(value: *): boolean} predicate
 *      The predicate function. If it returns false, the corresponding value
 *      is ignored.
 * @return {DynamicValue}
 */
export function filter(dv, predicate) {
  if (!(dv instanceof DynamicValue))
    throw new TypeError('Expected DynamicValue.');

  if (typeof predicate !== 'function')
    throw new TypeError('Expected function.');

  return new FilteredValue(dv, predicate);
}
