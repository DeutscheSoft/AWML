import { cache, fromSubscription } from '../operators.js';

export function rpcImportDynamicValues(rpc, names, key = '', readonly = false) {
  const result = {};

  names.forEach((name) => {
    result[name] = cache(
      fromSubscription(
        (callback) => {
          return rpc.call('_sub_' + key, [name], (ok, last, result) => {
            if (ok) {
              callback(result);
            } else {
              console.error('RPC error', result);
            }
          });
        },
        readonly
          ? undefined
          : (value) => {
              return rpc.callWait('_set_' + key, name, value);
            }
      )
    );
  });

  return result;
}
