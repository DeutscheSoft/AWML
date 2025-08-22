import { RPCResponsError } from '../../src/rpc.js';
import { delay } from '../../src/utils/delay.js';
import { getClient } from './rpc_test_helpers.js';

const Methods = {
  ping: (value) => value,
  ping_async: async (value) => await Promise.resolve(value),
  ping_twice: (value) => {
    return (callback) => {
      const run = async () => {
        callback(1, 0, value);
        await delay(50);
        callback(1, 1, value);
      };

      run();
      return () => {};
    };
  },
  error: (value) => {
    throw new Error('');
  },
  error_noerror: (value) => {
    throw value;
  },
  error_async: (value) => Promise.reject(new Error('')),
  error_twice: (value) => {
    return (callback) => {
      const run = async () => {
        callback(1, 0, new Error(''));
        await delay(50);
        callback(1, 1, new Error(''));
      };

      run();
      return () => {};
    };
  },
  stream: () => {
    return (callback) => {
      let active = true;

      const run = async () => {
        for (let i = 0; active; i++) {
          callback(1, 0, i);
          await delay(20);
        }
      };

      run();
      return () => {
        active = false;
      };
    };
  },
};

export default async function rpc_base(Assert) {
  const { assert, assertEqual, assertFailure, assertDeepEqual } = Assert;
  const delays = [-1, 0, 25];

  const a = [];

  delays.forEach((clientDelay) => {
    delays.forEach((serverDelay) => {
      a.push([clientDelay, serverDelay]);
    });
  });

  for (let i = 0; i < a.length; i++) {
    const [client, server] = getClient(...a[i], Methods);

    assertEqual(await client.callWait('ping', 42), 42);
    assertEqual(client.pendingCalls(), 0);
    assertEqual(server.pendingCalls(), 0);
    assertEqual(await client.callWait('ping_async', 42), 42);
    assertEqual(client.pendingCalls(), 0);
    assertEqual(server.pendingCalls(), 0);

    await assertFailure(() => client.callWait('error'));
    assertEqual(client.pendingCalls(), 0);
    assertEqual(server.pendingCalls(), 0);
    await assertFailure(() => client.callWait('error_async'));
    assertEqual(client.pendingCalls(), 0);
    assertEqual(server.pendingCalls(), 0);
    await assertFailure(() => client.callWait('this_method_does_not_exist'));
    assertEqual(client.pendingCalls(), 0);
    assertEqual(server.pendingCalls(), 0);

    {
      let n = 0;
      for await (let value of client.callAsyncIterator('ping_twice', 42)) {
        if (!n) {
          assertEqual(client.pendingCalls(), 1);
          assertEqual(server.pendingCalls(), 1);
        }
        assertEqual(value, 42);
        n++;
      }
      assertEqual(n, 2);
    }

    assertEqual(client.pendingCalls(), 0);
    assertEqual(server.pendingCalls(), 0);

    {
      let items = [];

      const unsubscribe = client.call('stream', [], (ok, last, item) => {
        assertEqual(ok, 1);
        assertEqual(last, 0);
        items.push(item);
      });

      while (items.length < 5) await delay(5);

      unsubscribe();

      assertDeepEqual(items, [0, 1, 2, 3, 4]);

      const delayTime = (a[i][0] + a[i][1]) * 2;
      await delay(Math.max(delayTime, 1));

      assertEqual(client.pendingCalls(), 0);
      assertEqual(server.pendingCalls(), 0);
    }
  }

  {
    const [client, server] = getClient(-1, -1, Methods);
    let failed = false;

    const p = client.callWait('ping_async', 42).catch((err) => {
      failed = true;
    });

    client.failAllCalls(new Error('test'));
    server.dispose();
    await delay(10);
    assertEqual(failed, true);
  }

  {
    const [client, server] = getClient(-1, -1, Methods);
    const e = new RPCResponsError('foobar');
    await assertFailure(() => client.callWait('error_noerror', 'foobar'), {
      name: 'RPCResponsError',
      message: e.message,
    });
  }
}
