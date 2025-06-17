import { prefixMethods } from './prefix_methods.js';

export function rpcExportBackend(arg, key = '') {
  const getBackend =
    typeof arg === 'function'
      ? (args) => {
          return arg(args.shift());
        }
      : (args) => {
          return arg;
        };

  return prefixMethods(
    {
      capabilities: (...args) => {
        const backend = getBackend(args);
        return {
          supportsIds: backend.supportsIds(),
        };
      },
      resolvePath: (...args) => {
        const backend = getBackend(args);
        const [path] = args;
        return backend.resolvePath(path);
      },
      fetchInfo: (...args) => {
        const backend = getBackend(args);
        const [path] = args;
        return backend.fetchInfo(path);
      },
      setById: (...args) => {
        const backend = getBackend(args);
        const [id, value] = args;
        return backend.setById(id, value);
      },
      setByPath: (...args) => {
        const backend = getBackend(args);
        const [path, value] = args;
        return backend.setByPath(path, value);
      },
      observeInfo: (...args) => {
        const backend = getBackend(args);
        const [path] = args;
        return (callback) => {
          return backend.observeInfo(path, callback);
        };
      },
      observeById: (...args) => {
        const backend = getBackend(args);
        const [id] = args;
        return (callback) => {
          return backend.observeById(id, callback);
        };
      },
      observeByPath: (...args) => {
        const backend = getBackend(args);
        const [path] = args;
        return (callback) => {
          return backend.observeByPath(path, callback);
        };
      },
      callById: (...args) => {
        const backend = getBackend(args);
        const [id, a] = args;
        return backend.callById(id, a);
      },
      callByPath: (...args) => {
        const backend = getBackend(args);
        const [path, a] = args;
        return backend.callById(path, a);
      },
    },
    key
  );
}
