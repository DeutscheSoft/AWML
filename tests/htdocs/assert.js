export default function assert(value, message) {
  if (!value) {
    throw new Error(`Assertion failed: ${message || ''}.`);
  }
}

export function equal(actual, expected, message) {
  const value = actual === expected;
  if (!value) {
    console.error('equal(%o, %o) failed.', actual, expected);
    assert(value, message);
  }
}

export function deepEqual(a, b, message) {
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);

  const value = ja === jb;

  if (!value) {
    console.error('deepEqual(%o, %o) failed.', a, b);
    assert(value, message);
  }
}

function errorEqual(actual, expected) {
  equal(actual.name, expected.name);
  if (expected.message) equal(actual.message, expected.message);
}

export async function rejects(asyncFn, error, message) {
  try {
    await asyncFn();
  } catch (err) {
    if (error) errorEqual(err, error);
    return;
  }

  assert(false, message);
}

export function throws(fn, error, message) {
  try {
    fn();
  } catch (err) {
    if (error) errorEqual(err, error);
    return;
  }

  assert(false, message);
}
