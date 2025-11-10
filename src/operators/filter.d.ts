import { DynamicValue } from '../dynamic_value.js';

export function filter<T>(
  dv: DynamicValue<T>,
  predicate: (value: T) => boolean
): DynamicValue<T>;
