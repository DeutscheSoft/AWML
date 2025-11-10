import { DynamicValue } from '../dynamic_value.js';

/**
 * Returns a new dynamic value which emits values at most once every {interval} milliseconds.
 * When values are emitted by dv$ more often, the last value is emitted at the end of the interval.
 */
export function throttleReceive<T>(
  dv$: DynamicValue<T>,
  interval: number
): DynamicValue<T>;
