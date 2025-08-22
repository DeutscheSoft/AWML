import { fromSubscription } from '../operators/from_subscription.js';
import { RPCClientBackend } from '../backends/rpc_client.js';
import { safeCall } from '../utils/safe_call.js';

export function rpcImportBackends(rpc, key = '', debug = false) {
  const call = (method, args, callback) => {
    return rpc.call(`${key}${method}`, args, callback);
  };

  return (options) => {
    return fromSubscription((callback) => {
      let lastBackend;

      return call('observeBackend', [options], (ok, last, result) => {
        if (lastBackend) {
          safeCall(() => {
            if (ok) {
              lastBackend.close();
            } else {
              lastBackend.error(result);
            }
          });
        }
        if (ok && result) {
          // result is the backend ID
          lastBackend = new RPCClientBackend(`${key}${result}`, {
            prefix: key,
            extraArgs: [result],
            remote: rpc,
            debug,
          });
        } else {
          lastBackend = null;
        }

        callback(lastBackend);
      });
    });
  };
}
