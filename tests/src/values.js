import { RemoteValue } from '../../src/remote_value.js';
import { ListValue } from '../../src/list_value.js';
import { DynamicValue } from '../../src/dynamic_value.js';
import { fromDOMEvent, connect, connectTo } from '../../src/operators.js';
import { delay } from '../../src/utils/delay.js';

export default async function values({ assertEqual, rejects }) {
  {
    assertEqual(await DynamicValue.from(42).wait(), 42);
  }

  {
    const list = await ListValue.from(
      DynamicValue.from(23),
      DynamicValue.from(42)
    ).wait();

    assertEqual(list[0], 23);
    assertEqual(list[1], 42);
  }

  {
    // ListValue basics
    const v1 = new DynamicValue();
    const v2 = new DynamicValue();

    const listv = ListValue.from(v1, v2);

    listv.subscribe(() => {});

    assertEqual(listv.hasValue, false);
    v1.set(23);
    assertEqual(listv.hasValue, false);
    v2.set(23);
    assertEqual(listv.hasValue, true);

    listv.set([42, 43]);

    assertEqual(v1.value, 42);
    assertEqual(v2.value, 43);
  }

  {
    // ListValue with partial
    const v1 = new DynamicValue();
    const v2 = new DynamicValue();

    const listv = ListValue.from(v1, v2);

    v1.set(23);
    listv.partial = true;

    const list = await listv.wait();
    assertEqual(list[0], 23);
    assertEqual(list[1], void 0);
  }

  {
    // ListValue with partial = true after subscribe
    const v1 = new DynamicValue();
    const v2 = new DynamicValue();

    const listv = ListValue.from(v1, v2);
    const p = listv.wait();

    v1.set(23);

    listv.partial = true;

    const list = await p;
    assertEqual(list[0], 23);
    assertEqual(list[1], void 0);
  }

  {
    // ListValue with partial = true before subscribe
    const v1 = new DynamicValue();
    const v2 = new DynamicValue();

    const listv = ListValue.from(v1, v2);
    listv.partial = true;

    const p = listv.wait();

    v1.set(23);

    const list = await p;
    assertEqual(list[0], 23);
    assertEqual(list[1], void 0);
  }

  {
    // subscribed ListValue with partial = true before subscribe
    const v1 = new DynamicValue();
    const v2 = new DynamicValue();

    const listv = ListValue.from(v1, v2);
    listv.subscribe(() => {});
    listv.partial = true;

    const p = listv.wait();

    v1.set(23);

    const list = await p;
    assertEqual(list[0], 23);
    assertEqual(list[1], void 0);
  }

  {
    // subscribed ListValue with partial = true before subscribe
    const v1 = new DynamicValue();
    const v2 = new DynamicValue();

    const listv = ListValue.from(v1, v2);
    listv.subscribe(() => {});
    listv.partial = true;

    v1.set(23);

    const p = listv.wait();

    const list = await p;
    assertEqual(list[0], 23);
    assertEqual(list[1], void 0);
  }

  {
    // debounce
    const v1 = DynamicValue.from(42);
    const v2 = DynamicValue.from(23);

    const listv = new ListValue([v1, v2], false, 20);
    let called = 0;

    listv.subscribe(() => called++);

    for (let i = 0; i < 1000; i++) v1.set(i);

    assertEqual(called, 0);
    await delay(30);
    assertEqual(called, 1);
  }

  {
    // debounce
    const v1 = DynamicValue.from(42);
    const v2 = DynamicValue.from(23);

    const listv = new ListValue([v1, v2], false, 20);

    // add a subscription to get it live
    listv.subscribe(() => {});

    {
      const tmp = await listv.wait();
      assertEqual(tmp[0], 42);
      assertEqual(tmp[1], 23);
    }

    v1.set(0);

    {
      // the debounce should prevent the new value from arriving
      const tmp = await listv.wait();
      assertEqual(tmp[0], 42);
      assertEqual(tmp[1], 23);
    }

    // now it should be here
    await delay(30);

    {
      const tmp = await listv.wait();
      assertEqual(tmp[0], 0);
      assertEqual(tmp[1], 23);
    }
  }

  if (typeof document !== 'undefined') {
    // fromDOMEvent
    const div = document.createElement('div');

    {
      const v1 = fromDOMEvent(div, 'click');

      const p = v1.wait();
      const ev = new CustomEvent('click');

      assertEqual(div.dispatchEvent(ev), true);
      assertEqual(await p, ev);
    }

    {
      const v1 = fromDOMEvent(div, 'click', true);

      const p = v1.wait();
      const ev = new CustomEvent('click', {
        cancelable: true,
      });

      assertEqual(div.dispatchEvent(ev), false);
      assertEqual(await p, ev);
    }
  }

  {
    // connectTo
    const to = new DynamicValue();
    const from = DynamicValue.from(42);

    {
      assertEqual(to.hasValue, false);
      assertEqual(from.hasValue, true);

      const sub = connectTo(to, from);

      assertEqual(to.value, 42);

      sub();
      to.clear();
    }

    {
      const sub = connectTo(to, from, false, (v) => v * 2);

      assertEqual(to.hasValue, false);

      from.set(42);

      assertEqual(to.value, 42 * 2);

      sub();
      to.clear();
    }
  }

  {
    // connect
    const a = new DynamicValue();
    const b = new DynamicValue();

    {
      const sub = connect(a, true, null, b, true, null);

      a.set(42);

      assertEqual(a.value, b.value);
      assertEqual(a.value, 42);

      b.set(23);

      assertEqual(a.value, b.value);
      assertEqual(a.value, 23);

      sub();
    }
  }

  {
    // RemoteValue
    const dv = DynamicValue.fromConstant(1);
    const rv = new RemoteValue();

    assertEqual(rv.hasValue, false);
    rejects(async () => {
      await rv.set(3);
    });
    const sub = rv.connect(dv);
    assertEqual(await rv.wait(), 1);
    await rv.set(4);
    assertEqual(await rv.wait(), 4);
    sub();
  }
}
