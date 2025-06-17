import { combineUnsubscribe } from '../utils/combine_unsubscribe.js';
import { prefixMethods } from './prefix_methods.js';
import { mergeMethods } from './merge_methods.js';
import { rpcExportBackend } from './rpc_export_backend.js';

export function rpcExportBackends(observeBackend, key = '') {
  let id = 1;

  const backends = new Map();

  const methods = prefixMethods(
    {
      observeBackend: (options) => {
        const dv = observeBackend(options);
        let currentID = 0;

        return (callback) => {
          return combineUnsubscribe(
            dv.subscribe((backend) => {
              if (currentID) {
                if (backends.get(currentID) === backend) return;
                backends.delete(currentID);
              }
              if (!backend) {
                currentID = 0;
              } else {
                currentID = id++;
                backends.set(currentID, backend);
              }
              callback(1, 0, currentID);
            }),
            () => {
              if (currentID) backends.delete(currentID);
            }
          );
        };
      },
    },
    key
  );

  const getBackend = (id) => {
    const backend = backends.get(id);

    if (!backend) throw new Error(`Backend already closed.`);

    return backend;
  };

  return mergeMethods(methods, rpcExportBackend(getBackend, key));
}
