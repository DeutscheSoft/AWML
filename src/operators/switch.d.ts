import { DynamicValue } from '../dynamic_value.js';

export function switchMap<Type1, Type2>(
  dv: DynamicValue<Type1>,
  projection: (value: Type1) => DynamicValue<Type2> | null
): DynamicValue<Type2>;

export function switchAll<T>(
  dv: DynamicValue<DynamicValue<T>>
): DynamicValue<T>;
