import { DynamicValue } from '../dynamic_value.js';
import { BackendBase } from '../backends/backend_base.js';
import { RPCMethods } from './server_base.js';

export function rpcExportBackends(
  observeBackend: (options: unknown) => DynamicValue<BackendBase>,
  key?: string
): RPCMethods;
