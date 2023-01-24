import { DynamicValue } from '../dynamic_value';

export function filter<T>(
  dv: DynamicValue<T>,
  predicate: (value: T) => boolean
): DynamicValue<T>;
