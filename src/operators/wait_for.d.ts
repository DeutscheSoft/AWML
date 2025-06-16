import { DynamicValue } from '../dynamic_value';

export function waitFor<T>(
  dv: DynamicValue<T>,
  predicate?: (value: T) => boolean,
  replay?: boolean,
  signal?: AbortSignal
): Promise<T>;
