import { safeCall } from './safe_call.js';

let q = null;

function run() {
  const _q = q;
  q = null;
  _q.forEach((cb) => safeCall(cb));
}

export function dispatch(cb) {
  if (q === null) {
    q = [];
    Promise.resolve().then(run);
  }

  q.push(cb);
}
