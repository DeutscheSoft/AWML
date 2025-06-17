import { rpcExportBackend } from '../rpc/rpc_export_backend.js';

export class RPCServerBackendConnector {
  constructor(rpcFactory, backend) {
    this.backend = backend;
    backend.on('destroy', () => {
      this._client.close();
    });
    this._client = rpcFactory(rpcExportBackend(backend));
  }
}
