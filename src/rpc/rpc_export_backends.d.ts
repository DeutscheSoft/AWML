import { DynamicValue } from '../dynamic_value';
import { BackendBase } from '../backends/backend_base';
import { RPCMethods } from './server_base';

export function rpcExportBackends(
  observeBackend: (options: unknown) => DynamicValue<BackendBase>,
  key?: string
): RPCMethods;
