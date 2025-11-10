import { DynamicValue } from '../dynamic_value.js';
import { RPCClientBase } from './client_base.js';
import { BackendBase } from '../backends/backend_base.js';

type IObserveBackend = (options: unknown) => DynamicValue<BackendBase>;

export function rpcImportBackends(
  rpc: RPCClientBase,
  key?: string,
  debug?: boolean
): IObserveBackend;
