import { DynamicValue } from '../dynamic_value';

export function connect<Type1, Type2>(
  value1: DynamicValue<Type1>,
  replay1: boolean,
  transform1: null | ((value: Type1) => Type2),
  value2: DynamicValue<Type2>,
  replay2: boolean,
  transform2?: null | ((value: Type2) => Type1)
): () => void;

export function connectTo<Type1, Type2>(
  to: DynamicValue<Type2>,
  from: DynamicValue<Type1>,
  replay: boolean,
  transform?: ((value: Type1) => Type2)): () => void;
