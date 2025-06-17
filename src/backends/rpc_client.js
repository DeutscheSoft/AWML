import { BackendBase } from './backend_base.js';

export class RPCClientBackend extends BackendBase {
  async _connect() {
    this._capabilities = await this.callWait('capabilities');
  }

  _assertIds() {
    if (!this._capabilities.supportsIds)
      throw new Error('Only available in backends which support ids.');
  }

  makeArgs(...args) {
    return this._extraArgs.concat(args);
  }

  makeMethodName(name) {
    return this._prefix ? `${this._prefix}${name}` : name;
  }

  /**
   * @param {string} name
   *    The backend name.
   * @param {RPCClientBase} remote
   *    The rpc client implementation.
   */
  constructor(name, options) {
    super(name, options);
    this._remote = options?.remote || null;
    this._capabilities = null;
    this._extraArgs = options?.extraArgs || [];
    this._prefix = options?.prefix || '';
    this._connect().then(
      () => {
        if (!this.isInit) return;
        this.open();
      },
      (err) => {
        if (!this.isInit) return;
        this.error(err);
      }
    );
  }

  callWait(methodName, ...args) {
    return this._remote.callWait(
      this.makeMethodName(methodName),
      ...this.makeArgs(...args)
    );
  }

  call(methodName, args, callback) {
    return this._remote.call(
      this.makeMethodName(methodName),
      this.makeArgs(...args),
      callback
    );
  }

  resolveId(id) {
    this._assertIds();
    return this.callWait('resolveId', id);
  }

  setByPath(path, value) {
    return this.callWait('setByPath', path, value);
  }

  setById(id, value) {
    this._assertIds();
    return this.callWait('setById', id, value);
  }

  observeInfo(path, callback) {
    return this.call('observeInfo', [path], callback);
  }

  fetchInfo(path) {
    return this.callWait('fetchInfo', path);
  }

  observeById(id, callback) {
    this._assertIds();
    return this.call('observeById', [id], callback);
  }

  observeByPath(path, callback) {
    return this.call('observeByPath', [path], callback);
  }

  callById(id, args) {
    this._assertIds();
    return this.callWait('callById', id, args);
  }

  callByPath(path, args) {
    return this.callWait('callByPath', path, args);
  }
}
