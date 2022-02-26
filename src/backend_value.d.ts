import { DynamicValue } from './dynamic_value';

export class BackendValue<T> extends DynamicValue<T> {
  get uri(): string;
  set(value: T): Promise<void>;
  setWhenConnected(value: T): Promise<void>;
}
