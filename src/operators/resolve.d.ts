import { DynamicValue } from '../dynamic_value';

export function resolve<Type1, Type2>(
  dv: DynamicValue<Type1>,
  projection: (value: Type1) => Promise<Type2> | null,
  parallel?: boolean
): DynamicValue<Type2>;
