import { DynamicValue } from '../dynamic_value';

export type ObserveLatestArgs<T> =
  | [hasValue: true, value: T]
  | [hasValue: false, value: undefined];

export function observeLatest<T>(
  dv: DynamicValue<T>,
  callback: (...args: ObserveLatestArgs<T>) => void
): DynamicValue<T>;
