import { safeCall } from './safe_call.js';

export function combineUnsubscribe(...callbacks) {
  return function () {
    if (callbacks === null) return;
    callbacks.forEach(safeCall);
    callbacks = null;
  };
}
