let tests = 0;

import { delay } from '../../src/utils/delay.js';

export function assertEqual(a, b) {
  if (a !== b) {
    console.error('assertEqual(%o, %o) failed.', a, b);
    throw new Error('Assertion failed.');
  }

  tests++;
}

export function assert(a) {
  if (!a) {
    throw new Error('Assertion failed.');
  }

  tests++;
}

export function assertEq(a, b) {
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);

  if (ja !== jb) {
    console.error('assertEqual(%o, %o) failed.', a, b);
    throw new Error('Assertion failed.');
  }

  tests++;
}

export async function assertFailure(cb) {
  try {
    await cb();
    failure(new Error('Expected failure.'));
  } catch (err) {
    tests++;
  }
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
