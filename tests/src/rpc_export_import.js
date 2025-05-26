import { DynamicValue } from '../../src/dynamic_value.js';
import {
  mergeMethods,
  rpcExportDynamicValues,
  rpcImportDynamicValues,
} from '../../src/rpc.js';
import { getClient } from './rpc_test_helpers.js';

export default async function rpc_export_import(Assert) {
  const { assertEqual, rejects } = Assert;
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

    const [client, server] = getClient(-1, -1,
      mergeMethods(
        rpcExportDynamicValues(values1, '1'),
        rpcExportDynamicValues(values2, '2', true),
      )
    );
    const remoteValues1 = rpcImportDynamicValues(client, Object.keys(values1), '1');
    const remoteValues2 = rpcImportDynamicValues(client, Object.keys(values2), '2');
    assertEqual(1, await remoteValues1.foo.wait());
    assertEqual('foo', await remoteValues2.bar.wait());
    await remoteValues1.foo.set(2);
    assertEqual(values1.foo.value, 2);

    rejects(async () => {
      await remoteValues2.foo.set(2);
    });
  }
}
