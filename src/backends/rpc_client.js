import { BackendBase } from './backend_base.js';

export class RPCClientBackend extends BackendBase {
  async _connect() {
    this._capabilities = await this._remote.callWait('capabilities');
    this.open();
  }

  _assertIds() {
    if (!this._capabilities.supportsIds)
      throw new Error('Only available in backends which support ids.');
  }

  /**
   * @param {string} name
   *    The backend name.
   * @param {RPCClientBase} remote
   *    The rpc client implementation.
   */
  constructor(name, options) {
    super(name, options);
    this._remote = null;
    this._capabilities = null;
    this._connect().then(
      () => {
        this.open();
      },
      (err) => {
        this.error(err);
      }
    );
  }

  resolveId(id) {
    this._assertIds();
    return this._remote.callWait('resolveId', id);
  }

  setByPath(path, value) {
    return this._remote.callWait('setByPath', path, value);
  }

  setById(id, value) {
    this._assertIds();
    return this._remote.callWait('setById', id, value);
  }

  observeInfo(path, callback) {
    return this._remote.call('observeInfo', [path], callback);
  }

  fetchInfo(path) {
    return this._remote.callWait('fetchInfo', path);
  }

  observeById(id, callback) {
    this._assertIds();
    return this._remote.call('observeById', [id], callback);
  }

  observeByPath(path, callback) {
    return this._remote.call('observeByPath', [path], callback);
  }

  callById(id, args) {
    this._assertIds();
    return this._remote.callWait('callById', id, args);
  }

  callByPath(path, args) {
    return this._remote.callWait('callByPath', path, args);
  }
}
