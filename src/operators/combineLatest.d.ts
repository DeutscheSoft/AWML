import { ListValue, UnwrapDynamicValues } from '../list_value.js';

export function combineLatest<U extends [...any[]]>(
  values: [...U]
): ListValue<UnwrapDynamicValues<U>>;
