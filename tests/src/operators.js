import { DynamicValue } from '../../src/dynamic_value.js';
import { ListValue } from '../../src/list_value.js';
import {
  map,
  filter,
  fromSubscription,
  switchMap,
  resolve,
  connect,
  mapItemsCached,
  mapItemsCachedByKey,
  resolveItems,
  unique,
  throttleReceive,
  throttleSend,
  observeLatest,
  project,
  createProjectionContext,
  cache,
} from '../../src/operators.js';
import { delay } from '../../src/utils/delay.js';

import { timeout } from '../../src/utils/timeout.js';

function record(dv) {
  const values = [];
  dv.subscribe((x) => values.push(x));
  return values;
}

function delaySend(dv, n) {
  return fromSubscription(
    (callback) => dv.subscribe(callback),
    async (value) => {
      await delay(n);
      return await dv.set(value);
    }
  );
}

export default async function run(Assert) {
  const { assertEqual, assertDeepEqual, assert } = Assert;
  // map
  {
    const v1 = DynamicValue.fromConstant(42);
    let v2 = map(v1, (x) => 2 * x);

    assertEqual(await v2.wait(), 42 * 2);

    try {
      v2.set(23);
      assertEqual(true, false);
    } catch (err) {
      assertEqual(true, true);
    }

    v2 = map(
      v1,
      (x) => 2 * x,
      (x) => x / 2
    );
    v2.set(42);

    assertEqual(await v1.wait(), 21);
  }

  // filter
  {
    const v1 = DynamicValue.fromConstant(42);
    const v2 = filter(v1, (x) => x % 2 === 0);

    let val;

    v2.subscribe((x) => {
      val = x;
    });

    assertEqual(val, 42);

    v1.set(41);

    assertEqual(val, 42);

    v1.set(44);

    assertEqual(val, 44);
  }

  // switchMap
  {
    const v1 = DynamicValue.fromConstant(42);
    const v2 = DynamicValue.fromConstant(23);

    const d = DynamicValue.fromConstant(true);

    const result = switchMap(d, (cond) => (cond ? v1 : v2));

    let val;

    result.subscribe((x) => {
      val = x;
    });

    assertEqual(val, 42);

    d.set(false);

    assertEqual(val, 23);

    await result.set(22);

    assertEqual(v1.value, 42);
    assertEqual(v2.value, 22);

    d.set(true);

    await result.set(41);

    assertEqual(v2.value, 22);
    assertEqual(v1.value, 41);
  }

  // resolve
  {
    const v1 = DynamicValue.fromConstant(0);

    const projection = (n) => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(n), n);
      });
    };

    const dv = resolve(v1, projection);
    const values = record(dv);

    assertEqual(values.length, 0);
    await delay(0);
    assertEqual(values.length, 1);
    assertEqual(values[0], 0);

    v1.set(5);
    assertEqual(values.length, 1);
    await delay(5);
    assertEqual(values.length, 2);
    assertEqual(values[1], 5);

    v1.set(10);
    for (let i = 0; i < 5; i++) {
      v1.set(5);
      // awaiting a promise will essentially dispatch
      await Promise.resolve();
    }
    await delay(10);
    assertEqual(values.length, 3);
    assertEqual(values[2], 10);

    await delay(10);
    assertEqual(values.length, 4);
    assertEqual(values[3], 5);
  }

  // connect
  {
    // no replay
    {
      const v1 = DynamicValue.fromConstant(42);
      const v2 = DynamicValue.fromConstant(23);

      connect(v1, false, null, v2, false, null);

      assertEqual(v1.value, 42);
      assertEqual(v2.value, 23);

      v1.set(0);

      assertEqual(v1.value, 0);
      assertEqual(v2.value, 0);
    }

    // replay v1 -> v2
    {
      const v1 = DynamicValue.fromConstant(42);
      const v2 = DynamicValue.fromConstant(23);

      connect(v1, true, null, v2, false, null);

      assertEqual(v1.value, 42);
      assertEqual(v2.value, 42);
    }

    // replay v2 -> v1
    {
      const v1 = DynamicValue.fromConstant(42);
      const v2 = DynamicValue.fromConstant(23);

      connect(v1, false, null, v2, true, null);

      assertEqual(v1.value, 23);
      assertEqual(v2.value, 23);
    }

    // One full round of recursion. It is important
    // to allow values to make one round trip.
    {
      const v1 = DynamicValue.fromConstant(0);
      const v2 = DynamicValue.fromConstant(0);

      connect(
        v1,
        false,
        (v) => v * 2,
        v2,
        false,
        (v) => v * 2
      );

      v1.set(1);

      assertEqual(v2.value, 2);
      assertEqual(v1.value, 4);
    }
  }

  // mapItemsCached
  {
    // array
    {
      let called = 0;
      const input = DynamicValue.fromConstant([]);
      const result = mapItemsCached(input, (item, key, items) => {
        called++;
        return item * 2;
      });

      // We want the result dynamic value to be permanently active.
      result.subscribe(() => {});

      let p;

      assertDeepEqual(await result.wait(), []);
      assertEqual(called, 0);

      p = result.wait(false);
      input.set([2, 3, 4]);
      assertDeepEqual(await p, [4, 6, 8]);
      assertEqual(called, 3);

      p = result.wait(false);
      input.set([0, 2, 3, 4]);
      assertDeepEqual(await p, [0, 4, 6, 8]);
      assertEqual(called, 4);

      p = result.wait(false);
      input.set([0]);
      assertDeepEqual(await p, [0]);
      assertEqual(called, 4);
    }

    // with Map
    {
      let called = 0;
      const m = new Map();
      const input = DynamicValue.fromConstant(m);
      const result = mapItemsCached(input, (item, key, items) => {
        called++;
        return item * 2;
      });
      const resultByKey = mapItemsCachedByKey(input, (item, key, items) => {
        called++;
        return item * 2;
      });

      // We want the result dynamic value to be permanently active.
      result.subscribe(() => {});
      resultByKey.subscribe(() => {});

      let p, pKey;

      assertDeepEqual(await result.wait(), new Map());
      assertDeepEqual(await resultByKey.wait(), new Map());
      assertEqual(called, 0);

      p = result.wait(false);
      pKey = resultByKey.wait(false);
      m.set('a', 2);
      m.set('b', 3);
      m.set('c', 4);
      input.set(m);

      assertDeepEqual(
        await p,
        new Map([
          ['a', 4],
          ['b', 6],
          ['c', 8],
        ])
      );
      assertDeepEqual(
        await pKey,
        new Map([
          ['a', 4],
          ['b', 6],
          ['c', 8],
        ])
      );
      assertEqual(called, 6);

      p = result.wait(false);
      pKey = resultByKey.wait(false);
      m.set('a', 5);
      m.set('null', 0);
      m.delete('c');
      input.set(m);
      assertDeepEqual(
        await p,
        new Map([
          ['a', 10],
          ['b', 6],
          ['null', 0],
        ])
      );
      assertDeepEqual(
        await pKey,
        new Map([
          ['a', 4],
          ['b', 6],
          ['null', 0],
        ])
      );
      assertEqual(called, 9);

      p = result.wait(false);
      pKey = resultByKey.wait(false);
      m.clear();
      input.set(m);

      assertDeepEqual(await p, new Map());
      assertDeepEqual(await pKey, new Map());
      assertEqual(called, 9);
    }
  }

  // resolveItems
  {
    // Synchronous case of an array
    {
      let called = 0;
      const input = DynamicValue.fromConstant([]);
      const result = resolveItems(input, (item, index, items, callback) => {
        called++;
        callback(item * 2);
        return null;
      });

      // We want the result dynamic value to be permanently active.
      result.subscribe(() => {});

      let p;

      assertDeepEqual(await result.wait(), []);
      assertEqual(called, 0);

      p = result.wait(false);
      input.set([2, 3, 4]);
      assertDeepEqual(await p, [4, 6, 8]);
      assertEqual(called, 3);

      p = result.wait(false);
      input.set([0, 2, 3, 4]);
      assertDeepEqual(await p, [0, 4, 6, 8]);
      assertEqual(called, 4);

      p = result.wait(false);
      input.set([0]);
      assertDeepEqual(await p, [0]);
      assertEqual(called, 4);
    }

    // Asynchronous array case
    {
      let called = 0;
      const input = DynamicValue.fromConstant([]);
      const result = resolveItems(input, (item, index, items, callback) => {
        called++;
        return timeout(() => callback(item * 2), 10 + item * 5);
      });

      // We want the result dynamic value to be permanently active.
      result.subscribe(() => {});

      let p;

      assertDeepEqual(await result.wait(), []);
      assertEqual(called, 0);

      p = result.wait(false);
      input.set([2, 3, 4]);
      assertDeepEqual(await p, [4, 6, 8]);
      assertEqual(called, 3);

      p = result.wait(false);
      input.set([0, 2, 3, 4]);
      assertDeepEqual(await p, [0, 4, 6, 8]);
      assertEqual(called, 4);

      p = result.wait(false);
      input.set([0, 4, 5, 6]);
      assertDeepEqual(await p, [0, 8, 10, 12]);
      assertEqual(called, 6);

      p = result.wait(false);
      input.set([0]);
      assertDeepEqual(await p, [0]);
      assertEqual(called, 6);
    }

    // Asynchromous Map case
    {
      let called = 0;
      const m = new Map();
      const input = DynamicValue.fromConstant(m);
      const result = resolveItems(input, (item, index, items, callback) => {
        called++;
        return timeout(() => callback(item * 2), 10 + item * 5);
      });

      // We want the result dynamic value to be permanently active.
      result.subscribe(() => {});

      let p = result.wait();
      assertDeepEqual(await p, new Map());
      assertEqual(called, 0);

      p = result.wait(false);
      m.set('a', 2);
      m.set('b', 3);
      m.set('c', 4);
      m.set('d', 2);
      input.set(m);

      assertDeepEqual(
        await p,
        new Map([
          ['a', 4],
          ['b', 6],
          ['c', 8],
          ['d', 4],
        ])
      );
      assertEqual(called, 3);

      p = result.wait(false);
      m.set('a', 5);
      m.set('null', 0);
      m.delete('c');
      input.set(m);
      assertDeepEqual(
        await p,
        new Map([
          ['a', 10],
          ['b', 6],
          ['d', 4],
          ['null', 0],
        ])
      );
      assertEqual(called, 5);

      p = result.wait(false);
      m.clear();
      input.set(m);
      assertDeepEqual(await p, new Map());
      assertEqual(called, 5);
    }

    // unique
    {
      {
        const v1 = DynamicValue.fromConstant(42);
        const v2 = unique(v1);

        const values = [];

        let sub = v2.subscribe((v) => values.push(v));

        assertDeepEqual(values, [42]);
        v1.set(23);
        assertDeepEqual(values, [42, 23]);
        v1.set(23);
        assertDeepEqual(values, [42, 23]);

        sub();
        v1.set(23);
        assertDeepEqual(values, [42, 23]);

        sub = v2.subscribe((v) => values.push(v));
        assertDeepEqual(values, [42, 23, 23]);
        sub();
      }

      // Test with comparison function
      {
        const v1 = DynamicValue.fromConstant(42);
        const v2 = unique(v1, (a, b) => Math.abs(a - b) < 1);

        const values = [];

        let sub = v2.subscribe((v) => values.push(v));

        assertDeepEqual(values, [42]);
        v1.set(23);
        assertDeepEqual(values, [42, 23]);
        v1.set(23.5);
        assertDeepEqual(values, [42, 23]);

        sub();
        v1.set(23.3);
        assertDeepEqual(values, [42, 23]);

        sub = v2.subscribe((v) => values.push(v));
        assertDeepEqual(values, [42, 23, 23.3]);
        sub();
      }
    }

    // throttleReceive
    {
      const v1 = DynamicValue.fromConstant(1);
      const throttledV1 = throttleReceive(v1, 50);
      const values = record(throttledV1);

      assertDeepEqual(values, [1]);
      v1.set(2);
      assertDeepEqual(values, [1]);
      await delay(55);
      assertDeepEqual(values, [1, 2]);
      await delay(55);
      for (let i = 0; i < 100; i++) v1.set(i);
      assertDeepEqual(values, [1, 2, 0]);
      await delay(55);
      assertDeepEqual(values, [1, 2, 0, 99]);
    }

    // thottleSend
    {
      const v1 = DynamicValue.fromConstant(0);
      const values = record(v1);
      const throttledV1 = throttleSend(v1, 50);

      throttledV1.set(1);
      assertDeepEqual(values, [0, 1]);
      throttledV1.set(2);
      assertDeepEqual(values, [0, 1]);
      await delay(55);
      assertDeepEqual(values, [0, 1, 2]);
      await delay(55);
      for (let i = 0; i < 100; i++) throttledV1.set(i);
      assertDeepEqual(values, [0, 1, 2, 0]);
      await delay(55);
      assertDeepEqual(values, [0, 1, 2, 0, 99]);
    }

    // observeLatest
    {
      let hasValue = false,
        value;
      const v1 = DynamicValue.fromConstant(0);
      const v2 = observeLatest(delaySend(v1, 50), (_hasValue, _value) => {
        hasValue = _hasValue;
        value = _value;
      });

      assert(!hasValue);
      let unsubscribe = v2.subscribe(() => {});
      assert(hasValue);
      assertEqual(value, 0);
      unsubscribe();
      assert(!hasValue);
      assertEqual(value, undefined);

      unsubscribe = v2.subscribe(() => {});
      assert(hasValue);
      assertEqual(value, 0);
      const p = v2.set(1);
      await delay(0);
      assert(hasValue);
      assertEqual(value, 1);
      v1.set(3);
      assert(hasValue);
      assertEqual(value, 1);
      await delay(30);
      assertEqual(value, 1);
      assertEqual(v1.value, 3);
      assertEqual(v2.value, 3);
      await delay(30);
      assertEqual(value, 1);
      assertEqual(v1.value, 1);
      assertEqual(v2.value, 1);
      await p;
      v1.set(4);
      assertEqual(value, 4);
      assertEqual(v1.value, 4);
      assertEqual(v2.value, 4);
      unsubscribe();
    }

    // project without context
    {
      const v1 = DynamicValue.fromConstant([0, 0]);
      const v2 = delaySend(v1, 50);
      const v3 = project(
        v2,
        ([a, b]) => a,
        ([a, b], c) => [c, b]
      );

      const unsubscribe = v3.subscribe(() => {});
      assertEqual(v3.value, 0);
      v3.set(3);
      await delay(60);
      assertEqual(v3.value, 3);
      assertDeepEqual(v1.value, [3, 0]);
      unsubscribe();
    }

    // project with context
    {
      const v1 = DynamicValue.fromConstant([0, 0]);
      const [v2, ctx] = createProjectionContext(delaySend(v1, 50));

      const vx = project(
        v2,
        ([a, b]) => a,
        ([a, b], c) => [c, b],
        ctx
      );

      const vy = project(
        v2,
        ([a, b]) => b,
        ([a, b], c) => [a, c],
        ctx
      );

      const unsubscribe = vx.subscribe(() => {});

      assertEqual(vx.value, 0);
      assertEqual(await vy.wait(), 0);
      for (let i = 0; i < 10; i++) {
        vx.set(i);
        vy.set(i);
        await delay(10);
      }

      await delay(60);

      assertDeepEqual(v1.value, [9, 9]);
      assertEqual(vx.value, 9);

      unsubscribe();
    }

    // cache
    {
      const v = DynamicValue.fromConstant(0);
      const cv = cache(v);

      assertEqual(await cv.wait(), 0);
      assert(!cv.isActive);
      assert(v.isActive);
      v.set(3);
      assert(!v.isActive);
      assertEqual(await cv.wait(), 3);
      assert(!cv.isActive);
      assert(v.isActive);
    }
  }
}
