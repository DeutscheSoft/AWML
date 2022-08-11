import { DynamicValue } from '../dynamic_value';

export function fromSubscription<T>(
  subscribeFun: (callback: (value: T) => void) => () => void,
  setFun?: (value: T) => void
): DynamicValue<T>;
