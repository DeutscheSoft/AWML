import { DynamicValue } from '../dynamic_value.js';
import { ListValue, UnwrapDynamicValues } from '../list_value.js';

export function combineLatest<U extends [...any[]]>(
  values: [...U]
): ListValue<UnwrapDynamicValues<U>>;

export function combineLatest<T>(
  values: DynamicValue<T>[]
): ListValue<T[]>;
