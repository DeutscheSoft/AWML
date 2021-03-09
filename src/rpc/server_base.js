export class RPCServerBase {
  constructor(methods) {
    this._pending = new Map();
    this._rpcMethods = methods;
    this._internalCalls = ['_cancel'];
    this._methodNames = Object.getOwnPropertyNames(methods);
  }

  pendingCalls() {
    return this._pending.size;
  }

  dispose() {
    const subs = Array.from(this._pending.values());
    this._pending.clear();
    subs.forEach((sub) => {
      sub(false);
    });
  }

  _cancel(id) {
    const sub = this._pending.get(id);

    if (!sub) return;

    sub(true);
  }

  _dispatchCall(method, args) {
    if (this._internalCalls.includes(method)) {
      return this[method](...args);
    }

    if (!this._methodNames.includes(method)) throw new Error('No such method.');

    return this._rpcMethods[method](...args);
  }

  _installSubscription(id, subscribe) {
    let active = true;
    let unsubscribe = null;

    const dispose = (send) => {
      if (!active) return;
      active = false;
      if (unsubscribe !== null) unsubscribe();
      this._pending.delete(id);
      if (send) this._sendResponse(id, 0, 1, 0);
    };

    unsubscribe =
      subscribe((ok, last, data) => {
        if (!active) return;
        if (last) dispose(false);
        this._sendResponse(id, ok, last, data);
      }) || null;

    if (active) this._pending.set(id, dispose);
    else if (unsubscribe !== null) unsubscribe();
  }

  _onMessage(message) {
    const [id, method, args] = message;

    try {
      const result = this._dispatchCall(method, args);

      // seems like a promise
      if (typeof result === 'object' && typeof result.then === 'function') {
        if (id === 0) {
          result.catch((err) => {
            console.error(err);
          });
        } else {
          this._installSubscription(id, (callback) => {
            result.then(
              (result) => {
                callback(1, 1, result);
              },
              (err) => {
                callback(0, 1, err.toString());
              }
            );
          });
        }
      } else if (typeof result === 'function') {
        // This is a long running call

        // Without a response id there is no reason
        // to install the subscription.
        if (id === 0) return;

        this._installSubscription(id, result);
      } else {
        if (id !== 0) this._sendResponse(id, 1, 1, result);
      }
    } catch (err) {
      if (id !== 0) this._sendResponse(id, 0, 1, err.toString());
    }
  }

  _sendResponse(id, ok, last, data) {
    this._send([id, ok, last, data]);
  }

  _send(message) {
    throw new Error('Not implemented.');
  }
}
