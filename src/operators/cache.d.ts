import { DynamicValue } from '../dynamic_value.js';

/**
 * Returns a new dynamic value which caches the last value even
 * if no subscription is currently active. The subscription is removed
 * when the first value change is received while being unsubscribed.
 *
 * This operator is useful in situations where subscriptions are added
 * and removed in quick succession.
 *
 * @param value The dynamic value to cache.
 */
export function cache<T>(value: DynamicValue<T>): DynamicValue<T>;
