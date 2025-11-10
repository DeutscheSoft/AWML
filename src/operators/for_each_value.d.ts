import { DynamicValue } from '../dynamic_value.js';
import { ISubscription } from '../subscription.js';

export function forEachValue<T>(
  dv: DynamicValue<T>,
  continuation: (value: T) => ISubscription | null | undefined,
  replay?: boolean,
  compare?: (a: T, b: T) => boolean
): ISubscription;
