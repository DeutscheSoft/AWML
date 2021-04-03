import { safeCall } from './safe_call.js';

export function initSubscribers() {
  return null;
}

export function addSubscriber(a, cb) {
  if (a === null) {
    return cb;
  } else if (typeof a === 'function') {
    if (a === cb) throw new Error('Already subscribed.');
    return [a, cb];
  } else {
    if (a.includes(cb)) throw new Error('Already subscribed.');
    a.push(cb);
    return a;
  }
}

export function removeSubscriber(a, cb) {
  if (typeof a === 'function') {
    if (a === cb) return null;
  } else if (Array.isArray(a)) {
    const tmp = a.filter((_cb) => _cb !== cb);
    if (tmp.length !== a.length) return tmp;
  }

  throw new Error('Unknown subscriber.');
}

export function callSubscribers(a, ...args) {
  if (a === null) return;

  if (typeof a === 'function') {
    safeCall(a, ...args);
  } else {
    for (let i = 0; i < a.length; i++) {
      safeCall(a[i], ...args);
    }
  }
}
