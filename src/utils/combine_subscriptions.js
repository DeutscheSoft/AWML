import { safeCall } from './safe_call.js';

export function combineSubscriptions(...callbacks) {
  callbacks = callbacks.filter((cb) => !!cb);
  if (callbacks.length === 1) {
    return callbacks[0];
  }

  return () => {
    callbacks.forEach((cb) => safeCall(cb));
  };
}
