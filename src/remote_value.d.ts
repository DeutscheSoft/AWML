import { DynamicValue } from './dynamic_value';
import { ISubscription } from './subscription';

/**
 * A special DynamicValue which can be connected and disconnected from a remote
 * DynamicValue. It acts as a proxy to that value as long as it is connected. Once
 * disconnected, it stops emitting values and cannot be used to set values, anymore.
 */
export class RemoteValue<T> extends DynamicValue<T> {
  constructor();

  connect(other: DynamicValue<T>): ISubscription;
}
