import { DynamicValue } from '../dynamic_value';
import { RPCClientBase } from './client_base';

export function rpcImportDynamicValues<
  T extends Record<string, DynamicValue<unknown>>,
>(rpc: RPCClientBase, names: (keyof T)[], key?: string, readonly?: boolean): T;
