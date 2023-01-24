import { ListValue, UnwrapDynamicValues } from '../list_value';
import { DynamicValue } from '../dynamic_value';

export function combineLatest<U extends [...any[]]>(
  values: [...U]
): ListValue<UnwrapDynamicValues<U>>;
