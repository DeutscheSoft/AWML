import assert, { equal, deepEqual, rejects } from 'node:assert/strict';
import { test } from 'node:test';

import operators from './src/operators.js';
import values from './src/values.js';
import backend_value from './src/backend_value.js';
import rpc_base from './src/rpc_base.js';
import base64 from './src/base64.js';
import rpc_export_import from './src/rpc_export_import.js';

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
  await backend_value(Assert);
});

test('rpc_base', async () => {
  await rpc_base(Assert);
});

test('base64', async () => {
  await base64(Assert);
});

test('rpc_export_import', async () => {
  await rpc_export_import(Assert);
});
