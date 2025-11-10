import { DynamicValue } from '../dynamic_value.js.js';

export function resolveItems<R, T>(
  dv: DynamicValue<T[]>,
  transform: (item: T, key: number, items: T[]) => DynamicValue<R>
): DynamicValue<R[]>;
export function resolveItems<R, T, K>(
  dv: DynamicValue<T[]>,
  transform: (item: T, key: K, items: T[]) => DynamicValue<R>,
  getKey: (item: T, key: number, items: T[]) => K
): DynamicValue<R[]>;

export function resolveItems<R, T>(
  dv: DynamicValue<Set<T>>,
  transform: (item: T, key: number, items: Set<T>) => DynamicValue<R>
): DynamicValue<Set<R>>;
export function resolveItems<R, T, K>(
  dv: DynamicValue<Set<T>>,
  transform: (item: T, key: K, items: Set<T>) => DynamicValue<R>,
  getKey: (item: T, key: number, items: Set<T>) => K
): DynamicValue<Set<R>>;

export function resolveItems<R, T, K>(
  dv: DynamicValue<Map<K, T>>,
  transform: (item: T, key: K, items: Map<K, T>) => DynamicValue<R>
): DynamicValue<Map<K, R>>;
export function resolveItems<R, T, K, CK>(
  dv: DynamicValue<Map<K, T>>,
  transform: (item: T, key: CK, items: Map<K, T>) => DynamicValue<R>,
  getKey: (item: T, key: K, items: Map<K, T>) => CK
): DynamicValue<Map<K, R>>;
