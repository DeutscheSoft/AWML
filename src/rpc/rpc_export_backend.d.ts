import { BackendBase } from '../backends/backend_base';
import { RPCMethods } from './server_base';

type IExportBackendArg = BackendBase | ((options: unknown) => BackendBase);

export function rpcExportBackend(arg: IExportBackendArg, key = ''): RPCMethods;
