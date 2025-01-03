let tests = 0;

import { delay } from '../../src/utils/delay.js';

import assert, { equal, deepEqual, rejects, throws } from './assert.js';

export function assertEqual(a, b, message) {
  equal(a, b, message);
  tests++;
}

function _assert(a, message) {
  assert(a, message);
  tests++;
}

export { _assert as assert };

export function assertDeepEqual(a, b, message) {
  deepEqual(a, b, message);
  tests++;
}

export async function assertFailure(cb, error, message) {
  await rejects(cb, error, message);
  tests++;
}

export function done() {
  console.log('%d done', tests);
  window.parent.postMessage({ ok: true, count: tests });
}

export function skip(reason) {
  console.log('skipped: %o', reason);
  window.parent.postMessage({ ok: true, count: 'skipped', reason: reason });
}

export function failure(err) {
  console.error(err);
  window.parent.postMessage({ ok: false, error: err.toString() });
}

export function define(callback) {
  window.addEventListener('load', () => {
    try {
      let called = false;
      const p = callback(() => {
        called = true;
      });

      if (typeof p === 'object' && typeof p.then === 'function') {
        p.then(
          () => {
            done();
          },
          (error) => {
            failure(error);
          }
        );
      } else if (!called) {
        done();
      }
    } catch (error) {
      failure(error);
    }
  });
}

export function defineWithAssert(callback) {
  define(async () => {
    const Assert = {
      assertEqual,
      assertDeepEqual,
      equal: assertEqual,
      deepEqual: assertDeepEqual,
      assert,
      assertFailure,
      rejects: assertFailure,
    };

    await callback(Assert);
  });
}

export function waitForFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(resolve);
  });
}

export { delay };

import { subscribeDOMEventOnce } from '../../src/utils/subscribe_dom_event.js';

export function waitForDOMEvent(node, name) {
  return new Promise((resolve) => {
    subscribeDOMEventOnce(node, name, resolve);
  });
}

export function testAttribute(
  node,
  attributeName,
  attributeValue,
  name,
  value
) {
  if (attributeValue === null) {
    node.removeAttribute(attributeName);
  } else {
    node.setAttribute(attributeName, attributeValue);
  }
  assertEqual(node[name], value);
}
