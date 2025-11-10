import { BackendBase } from '../backends/backend_base.js';
import { RPCMethods } from './server_base.js';

type IExportBackendArg = BackendBase | ((options: unknown) => BackendBase);

export function rpcExportBackend(
  arg: IExportBackendArg,
  key?: string
): RPCMethods;
