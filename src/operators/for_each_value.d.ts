import { DynamicValue } from '../dynamic_value';
import { ISubscription } from '../subscription';

export function forEachValue<T>(
  dv: DynamicValue<T>,
  continuation: (value: T) => ISubscription | null | undefined,
  replay?: boolean,
  compare?: (a: T, b: T) => boolean
): ISubscription;
