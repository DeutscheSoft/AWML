import { DynamicValue } from '../dynamic_value.js';
import { filter } from '../operators.js';

const loading$ = DynamicValue.fromConstant(1);
const firedPromise = filter(loading$, (count) => count <= 0).wait();

function maybeDone() {
  const count = loading$.value;
  loading$.set(count - 1);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('load', maybeDone);
  firedPromise.then(() => {
    document.dispatchEvent(new Event('AWMLContentLoaded'));
  });
} else {
  maybeDone();
}

/** @ignore */
export function registerLoading(p) {
  const count = loading$.value;
  if (!count) return p;

  loading$.set(count + 1);
  p.then(maybeDone, maybeDone);
  return p;
}

/**
 * Wait for the `AWMLContentLoaded` event to be emitted.
 *
 * @return {Promise}
 */
export function waitForAWMLContentLoaded() {
  return firedPromise;
}
