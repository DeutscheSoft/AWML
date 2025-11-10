import { DynamicValue } from '../dynamic_value.js';
import { RPCClientBase } from './client_base.js';

export function rpcImportDynamicValues<
  T extends Record<string, DynamicValue<unknown>>,
>(rpc: RPCClientBase, names: (keyof T)[], key?: string, readonly?: boolean): T;
