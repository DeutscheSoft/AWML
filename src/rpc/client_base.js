/**
 * RPC request
 * [
 *   id,
 *   method,
 *   args
 * ]
 *
 * RPC response
 * [
 *   id, // rpc request id
 *   ok, // error or response (0 or 1)
 *   last, // if this is the last message (0 or 1)
 *   err | return_values
 * ]
 */

export class RPCResponsError extends Error {
  constructor(reason) {
    super(`rpc returned failure ${reason}`);
    this.reason = reason;
  }
}

function makeError(data) {
  if (typeof data === 'object' && data instanceof Error) return data;

  try {
    return new RPCResponsError(data);
  } catch (err) {
    console.error('Failed to create error from', data);
  }

  return new Error('Rpc call failed.');
}

class RPCRequestContext {
  constructor(id, callback) {
    this._id = id;
    this._callback = callback;
    this._active = true;
  }

  handleResponse(ok, last, data) {
    if (!this._active) return;

    const callback = this._callback;

    try {
      callback(ok, last, ok ? data : makeError(data));
    } catch (err) {
      console.error(
        'RPC result handler for result (%o, %o, %o) generated an exception: %o',
        ok,
        last,
        data,
        err
      );
    }

    if (last) {
      this._active = false;
    }
  }

  fail(error) {
    if (!this._active) return;

    this._active = false;

    const callback = this._callback;

    try {
      callback(0, 1, makeError(error));
    } catch (err) {
      console.error(
        'Client close triggered an exception in RPC handler: %o',
        err
      );
    }
  }

  unsubscribe() {
    this._active = false;
  }
}

export class RPCClientBase {
  isClosed() {
    return false;
  }

  constructor() {
    this._requests = new Map();
    this._debug = false;
  }

  call(method, args, callback) {
    if (typeof callback !== 'function')
      throw new TypeError('Expected function.');

    const requests = this._requests;
    let id;

    do {
      id = (Math.random() * 0x7ffffff) | 0;
    } while (!id || requests.has(id));

    const context = new RPCRequestContext(id, callback);
    requests.set(id, context);

    try {
      this._send([id, method, args]);
    } catch (err) {
      requests.delete(id);
      throw err;
    }

    return () => {
      if (callback === null) return;
      callback = null;
      context.unsubscribe();

      if (!this.isClosed()) this._send([0, '_cancel', [id]]);
    };
  }

  callWait(method, ...args) {
    return new Promise((resolve, reject) => {
      let active = true;
      /* eslint-disable prefer-const */
      let unsubscribe;

      const dispose = () => {
        if (unsubscribe) unsubscribe();
        else active = false;
      };

      unsubscribe = this.call(method, args, (ok, last, data) => {
        if (!last) {
          reject(new Error('Invalid use of callWait() on *function.'));
          dispose();
        }

        (ok ? resolve : reject)(data);
      });

      if (!active) unsubscribe();
    });
  }

  callAsyncIterator(method, ...args) {
    let done = false;
    const results = [];
    let _wakeup = null;
    let _wait = null;

    const wait = () => {
      if (!_wait) {
        _wait = new Promise((resolve) => {
          _wakeup = resolve;
        });
      }

      return _wait;
    };

    class AsyncIterator {
      async next() {
        if (!results.length && done) {
          return {
            done: true,
          };
        }

        while (!results.length) await wait();

        const [ok, data] = results.shift();

        if (!ok) throw new Error(data);

        return {
          done: false,
          value: data,
        };
      }

      [Symbol.asyncIterator]() {
        return this;
      }
    }

    this.call(method, args, (ok, last, data) => {
      results.push([ok, data]);
      done = last;

      const wakeup = _wakeup;

      if (wakeup) {
        _wakeup = null;
        _wait = null;
        wakeup();
      }
    });

    return new AsyncIterator();
  }

  pendingCalls() {
    return this._requests.size;
  }

  failAllCalls(err) {
    const requests = Array.from(this._requests.values());
    this._requests.clear();

    requests.forEach((context) => {
      context.fail(err);
    });
  }

  _onMessage(message) {
    const [id, ok, last, data] = message;
    const requests = this._requests;

    const context = requests.get(id);

    if (!context) throw new Error('Unknown request context.');

    context.handleResponse(ok, last, data);

    if (last) requests.delete(id);
  }

  _send(message) {
    throw new Error('Not implemented.');
  }
}
