import { DynamicValue } from './dynamic_value';

export type WrapDynamicValues<T extends [...any[]]> =
  T extends [ infer T0, ...infer Rest ]
    ? [ DynamicValue<T0>, ...WrapDynamicValues<Rest> ]
    : [];
export type UnwrapDynamicValue<T> = T extends DynamicValue<infer U> ? U : never;
export type UnwrapDynamicValues<T extends [...any[]]> =
  T extends [ infer T0, ...infer Rest ]
    ? [ UnwrapDynamicValue<T0>, ...UnwrapDynamicValues<Rest> ]
    : [];

export class ListValue<T extends [...any[]]> extends DynamicValue<T> {
  static from<U extends [...any[]]>(
      ...values: [ ...U ]
    ): ListValue<UnwrapDynamicValues<U>>;

  constructor(values: [...WrapDynamicValues<T>],
              partial?: boolean,
              debouncel?: number);

  debounce: number;
  partial: boolean;
}
