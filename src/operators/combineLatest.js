import { ListValue } from '../list_value.js';

/**
 * Transform a list of input dynamic values and emits a new DynamicValue which emits
 * an array of values.
 *
 * @param {DynamicValue[]} a
 * @return {DynamicValue}
 */
export function combineLatest(a) {
  return ListValue.from(...a);
}
