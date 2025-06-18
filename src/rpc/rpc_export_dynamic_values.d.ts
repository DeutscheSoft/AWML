import { DynamicValue } from '../dynamic_value';
import { RPCMethods } from './server_base';

export function rpcExportDynamicValues(
  values: Record<string, DynamicValue<unknown>>,
  key?: string,
  readonly?: boolean
): RPCMethods;
