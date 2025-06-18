import { DynamicValue } from '../dynamic_value';

export function mapItemsCached<T, R>(
  dv: DynamicValue<T[]>,
  projection: (item: T, key: number, items: T[]) => R
): DynamicValue<R[]>;

export function mapItemsCached<T, R, K>(
  dv: DynamicValue<T[]>,
  projection: (item: T, key: K, items: T[]) => R,
  getKey: (item: T, index: number, items: T[]) => K
): DynamicValue<R[]>;

export function mapItemsCached<T, R>(
  dv: DynamicValue<Set<T>>,
  projection: (item: T, key: number, items: Set<T>) => R
): DynamicValue<Set<R>>;

export function mapItemsCached<T, R, K>(
  dv: DynamicValue<Set<T>>,
  projection: (item: T, key: K, items: Set<T>) => R,
  getKey: (item: T, index: number, items: Set<T>) => K
): DynamicValue<Set<R>>;

export function mapItemsCached<T, R, K>(
  dv: DynamicValue<Map<K, T>>,
  projection: (item: T, key: K, items: Map<K, T>) => R
): DynamicValue<Map<K, R>>;

export function mapItemsCached<T, R, K, CK>(
  dv: DynamicValue<Map<K, T>>,
  projection: (item: T, key: CK, items: Map<K, T>) => R,
  getKey: (item: T, index: K, items: Map<K, T>) => CK
): DynamicValue<Map<K, R>>;
