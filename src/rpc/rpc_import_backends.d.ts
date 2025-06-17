import { DynamicValue } from '../dynamic_value';
import { RPCClientBase } from './client_base';
import { BackendBase } from '../backends/backend_base';

type IObserveBackend = (options: unknown) => DynamicValue<BackendBase>;

export function rpcImportDynamicValues(
  rpc: RPCClientBase,
  key = ''
): IObserveBackend;
