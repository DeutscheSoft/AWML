export function assertEqual(a, b) {
  if (a !== b) {
    console.error('assertEqual(%o, %o) failed.', a, b);
    throw new Error('Assertion failed.');
  }
}

export function done() {
  window.parent.postMessage({ ok: true });
}

export function failure(err) {
  console.error(err);
  window.parent.postMessage({ ok: false, error: err });
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
