import { DynamicValue } from '../../src/dynamic_value.js';
import {
  mergeMethods,
  rpcExportBackends,
  rpcImportBackends,
  rpcExportDynamicValues,
  rpcImportDynamicValues,
} from '../../src/rpc.js';
import { getClient } from './rpc_test_helpers.js';
import { map } from '../../src/operators.js';
import { LocalBackend } from '../../src/backends/local.js';
import { DynamicValuesBackend } from '../../src/backends/dynamic_values.js';
import { getBackendValue } from '../../src/backends.js';
import { Subscriptions } from '../../src/utils/subscriptions.js';
import { provideBackend } from '../../src/backends.js';
import { getBackend } from '../../src/backends.js';
import { delay } from '../../src/utils/delay.js';

export default async function rpc_export_import(Assert) {
  const { assertEqual, rejects, assert } = Assert;
  {
    const values = {
      foo: DynamicValue.fromConstant(1),
      bar: DynamicValue.fromConstant('foo'),
    };

    const [client, server] = getClient(-1, -1, rpcExportDynamicValues(values));
    const remoteValues = rpcImportDynamicValues(client, Object.keys(values));
    assertEqual(1, await remoteValues.foo.wait());
    assertEqual('foo', await remoteValues.bar.wait());
    await remoteValues.foo.set(2);
    assertEqual(values.foo.value, 2);
  }
  {
    const values1 = {
      foo: DynamicValue.fromConstant(1),
      bar: DynamicValue.fromConstant('foo'),
    };
    const values2 = {
      foo: DynamicValue.fromConstant(1),
      bar: DynamicValue.fromConstant('foo'),
    };

    const [client, server] = getClient(
      -1,
      -1,
      mergeMethods(
        rpcExportDynamicValues(values1, '1'),
        rpcExportDynamicValues(values2, '2', true)
      )
    );
    const remoteValues1 = rpcImportDynamicValues(
      client,
      Object.keys(values1),
      '1'
    );
    const remoteValues2 = rpcImportDynamicValues(
      client,
      Object.keys(values2),
      '2'
    );
    assertEqual(1, await remoteValues1.foo.wait());
    assertEqual('foo', await remoteValues2.bar.wait());
    await remoteValues1.foo.set(2);
    assertEqual(values1.foo.value, 2);

    rejects(async () => {
      await remoteValues2.foo.set(2);
    });
  }
  {
    const cleanup = new Subscriptions();
    const backends$ = DynamicValue.fromConstant(new Map());

    const remoteValuesFoo$ = DynamicValue.fromConstant(1);
    const remoteValuesBar$ = DynamicValue.fromConstant('bar');
    const valuesFoo$ = getBackendValue('values:foo');
    const valuesBar$ = getBackendValue('values:bar');
    const localFoo$ = getBackendValue('local:foo');
    const localBar$ = getBackendValue('local:bar');

    const remoteLocalBackend = new LocalBackend({ name: 'local' });
    const remoteValuesBackend = new DynamicValuesBackend({
      name: 'values',
      values: {
        foo: remoteValuesFoo$,
        bar: remoteValuesBar$,
      },
    });

    remoteLocalBackend.setByPath('foo', 1);
    remoteLocalBackend.setByPath('bar', 2);

    const observeBackend = (name) => {
      return map(backends$, (backends) => {
        return backends.get(name);
      });
    };

    const [client, server] = getClient(
      -1,
      -1,
      mergeMethods(rpcExportBackends(observeBackend, 'foo'))
    );

    cleanup.add(
      () => server.dispose(),
      () => client.dispose()
    );

    const rpcObserveBackend = rpcImportBackends(client, 'foo');

    const localBackend$ = rpcObserveBackend('local');
    const valuesBackend$ = rpcObserveBackend('values');

    cleanup.add(provideBackend('local', localBackend$));

    cleanup.add(provideBackend('values', valuesBackend$));

    assertEqual(getBackend('local'), undefined);
    assertEqual(getBackend('values'), undefined);

    backends$.value.set('local', remoteLocalBackend);
    backends$.value.set('values', remoteValuesBackend);
    backends$.set(backends$.value);

    // Wait for the backend to be open.
    await delay(50);

    assert(getBackend('local') != undefined);
    assert(getBackend('values') != undefined);

    // Try removing the backends again
    backends$.value.clear();
    backends$.set(backends$.value);
    assertEqual(getBackend('local'), undefined);
    assertEqual(getBackend('values'), undefined);

    // Re-add the backends
    backends$.value.set('local', remoteLocalBackend);
    backends$.value.set('values', remoteValuesBackend);
    backends$.set(backends$.value);

    await delay(50);

    assert(getBackend('local') != undefined);
    assert(getBackend('values') != undefined);

    // Check values.
    assertEqual(await valuesFoo$.wait(), 1);
    assertEqual(await valuesBar$.wait(), 'bar');
    assertEqual(await localFoo$.wait(), 1);
    assertEqual(await localBar$.wait(), 2);

    remoteValuesFoo$.set(2);
    remoteValuesBar$.set('foo');
    remoteLocalBackend.setByPath('foo', 2);
    remoteLocalBackend.setByPath('bar', 'bar');

    assertEqual(await valuesFoo$.wait(), 2);
    assertEqual(await valuesBar$.wait(), 'foo');
    assertEqual(await localFoo$.wait(), 2);
    assertEqual(await localBar$.wait(), 'bar');

    cleanup.unsubscribe();
  }
}
