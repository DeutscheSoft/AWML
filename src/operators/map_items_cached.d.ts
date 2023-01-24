import { DynamicValue } from '../dynamic_value';

export function mapItemsCached<T>(
  dv: DynamicValue<T>,
  projection: (item: any, key: any, items: T) => any,
  getKey?: (item: any) => any
): DynamicValue<T>;
