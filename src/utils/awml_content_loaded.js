import { waitForDOMEvent } from './subscribe_dom_event.js';

let fired = false;
const firedPromise = waitForDOMEvent(document, 'AWMLContentLoaded');
let loading = 1;

function fire() {
  fired = true;
  document.dispatchEvent(new Event('AWMLContentLoaded'));
}

function maybeFire() {
  if (loading !== 0) return;
  fire();
}

window.addEventListener('load', () => {
  loading--;
  maybeFire();
});

/** @ignore */
export function registerLoading(p) {
  if (fired) return p;

  const when_done = () => {
    loading--;
    maybeFire();
  };

  loading++;
  p.then(when_done, when_done);
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
