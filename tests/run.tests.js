import assert, { equal, deepEqual, rejects } from 'node:assert/strict';
import { test } from 'node:test';

import operators from './src/operators.js';
import values from './src/values.js';
import backend_value from './src/backend_value.js';
import rpc_base from './src/rpc_base.js';

const Assert = {
  assertEqual: equal,
  assertDeepEqual: deepEqual,
  equal,
  deepEqual,
  assert,
  assertFailure: rejects,
  rejects,
};

test('operators', async () => {
  await operators(Assert);
});

test('values', async () => {
  await values(Assert);
});

test('backend_value', async () => {
  await values(Assert);
});

test('rpc_base', async () => {
  await rpc_base(Assert);
});
