import { DynamicValue } from '../dynamic_value.js';
import { ISubscription } from '../subscription.js';

export function forEachItemCached<T>(
  dv: DynamicValue<T[]>,
  continuation: (item: T, key: number, items: T[]) => ISubscription
): ISubscription;

export function forEachItemCached<T, K>(
  dv: DynamicValue<T[]>,
  continuation: (item: T, key: K, items: T[]) => ISubscription,
  getKey: (item: T, index: number, items: T[]) => K
): ISubscription;

export function forEachItemCached<T>(
  dv: DynamicValue<Set<T>>,
  continuation: (item: T, key: number, items: Set<T>) => ISubscription
): ISubscription;

export function forEachItemCached<T, K>(
  dv: DynamicValue<Set<T>>,
  continuation: (item: T, key: K, items: Set<T>) => ISubscription,
  getKey: (item: T, index: number, items: Set<T>) => K
): ISubscription;

export function forEachItemCached<T, K>(
  dv: DynamicValue<Map<K, T>>,
  continuation: (item: T, key: K, items: Map<K, T>) => ISubscription
): ISubscription;

export function forEachItemCached<T, K, CK>(
  dv: DynamicValue<Map<K, T>>,
  continuation: (item: T, key: CK, items: Map<K, T>) => ISubscription,
  getKey: (item: T, index: K, items: Map<K, T>) => CK
): ISubscription;

export function forEachItemCachedByKey<T>(
  dv: DynamicValue<T[]>,
  continuation: (item: T, key: number, items: T[]) => ISubscription
): ISubscription;

export function forEachItemCachedByKey<T, K>(
  dv: DynamicValue<Map<K, T>>,
  continuation: (item: T, key: K, items: Map<K, T>) => ISubscription
): ISubscription;
