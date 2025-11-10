import { DynamicValue } from '../dynamic_value.js';
import { RPCMethods } from './server_base.js';

export function rpcExportDynamicValues(
  values: Record<string, DynamicValue<unknown>>,
  key?: string,
  readonly?: boolean
): RPCMethods;
