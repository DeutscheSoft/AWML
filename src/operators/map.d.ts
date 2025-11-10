import { DynamicValue } from '../dynamic_value.js';

export function map<Type1, Type2>(
  dv: DynamicValue<Type1>,
  transform: (value: Type1) => Type2,
  inverse?: (value: Type2) => Type1
): DynamicValue<Type2>;

export function reduce<Type1, Type2>(
  dv: DynamicValue<Type1>,
  transform: (accumulator: Type2, currentValue: Type1) => Type2,
  initialValue?: Type2
): DynamicValue<Type2>;
