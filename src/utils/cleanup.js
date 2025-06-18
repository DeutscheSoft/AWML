import { runCleanupHandler } from './run_cleanup_handler.js';

const assign = Symbol('assign');

export function initCleanup() {
  let active = true;
  let callback;
  return (...args) => {
    if (args.length === 2 && args[0] === assign) {
      const cb = args[1];

      if (!active) {
        runCleanupHandler(cb);
      } else {
        runCleanupHandler(callback);
        callback = cb;
      }
    } else {
      if (!active) return;
      active = false;
      runCleanupHandler(callback);
    }
  };
}

export function assignCleanup(cleanup, callback) {
  cleanup(assign, callback);
}
