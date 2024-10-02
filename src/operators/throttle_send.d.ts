import { DynamicValue } from '../dynamic_value';

/**
 * Returns a new dynamic value which sends values at most once every {interval} milliseconds.
 * When set() is called more often, the last value is emitted at the end of the interval.
 */
export function throttleSend<T>(
  dv$: DynamicValue<T>,
  interval: number
): DynamicValue<T>;
