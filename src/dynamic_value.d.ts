export class DynamicValue<T> {
  static fromConstant<Type>(value: Type): DynamicValue<Type>;

  constructor();

  get value(): T;
  get hasValue(): boolean;
  get isActive(): boolean;

  subscribe(subscriber: (value: T) => void, replay?: boolean): () => void;
  wait(replay?: boolean, predicate: (value: T) => boolean, signal: AbortSignal): Promise<T>;
  set(value: T): void | Promise<void>;
}
