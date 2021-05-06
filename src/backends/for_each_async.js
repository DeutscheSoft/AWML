import { runCleanupHandler } from '../utils/run_cleanup_handler.js';
import { warn } from '../utils/log.js';

export function forEachAsync(subscribe, callback) {
  let lastValue = null;
  let cleanup = null;

  const cb = (ok, last, o) => {
    if (lastValue === o) return;
    runCleanupHandler(cleanup);

    cleanup = callback(ok, last, o);
  };

  let sub = subscribe(cb);

  return () => {
    runCleanupHandler(cleanup);
    runCleanupHandler(sub);
    sub = null;
    lastValue = null;
    cleanup = null;
  };
}
