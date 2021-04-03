import { warn } from './log.js';

export function safeCall(cb, ...args) {
  if (cb === null) return;
  try {
    cb(...args);
  } catch (err) {
    warn('Callback generated an exception: %o.', err);
  }
}
