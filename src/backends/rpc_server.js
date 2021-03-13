export class RPCServerBackendConnector {
  constructor(rpcFactory, backend) {
    this.backend = backend;
    this._client = rpcFactory({
      capabilities: () => {
        return {
          supportsIds: backend.supportsIds(),
        };
      },
      resolvePath: (path) => {
        return this.backend.resolvePath(path);
      },
      fetchInfo: (path) => {
        return this.backend.fetchInfo(path);
      },
      setById: (path, value) => {
        return this.backend.setById(path, value);
      },
      setByPath: (path, value) => {
        return this.backend.setByPath(path, value);
      },
      observeInfo: (path) => {
        return (callback) => {
          return this.backend.observeInfo(path, callback);
        };
      },
      observeById: (id) => {
        return (callback) => {
          return this.backend.observeById(id, callback);
        };
      },
      observeByPath: (path) => {
        return (callback) => {
          return this.backend.observeByPath(path, callback);
        };
      },
      callById: (id, args) => {
        return this.backend.callById(id, args);
      },
      callByPath: (path, args) => {
        return this.backend.callById(path, args);
      },
    });
  }
}
