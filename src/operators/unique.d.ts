import { DynamicValue } from '../dynamic_value.js';

export function unique<Type>(
  dv: DynamicValue<Type>,
  compare?: (a: Type, b: Type) => boolean
): DynamicValue<Type>;
