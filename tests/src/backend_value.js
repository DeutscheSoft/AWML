import {
  getBackendValue,
  registerBackend,
  unregisterBackend,
} from '../../src/backends.js';

import { LocalBackend } from '../../src/backends/local.js';

export default async function backend_value({ assertEqual }) {
  {
    // Test if setting a value connects to the backend.
    const backend = new LocalBackend({ name: 'local' });

    registerBackend(backend.name, backend);

    const dv = getBackendValue('local:foo');

    dv.set('bar');

    // this set needs to subscribe which is in itself an asynchronous
    // operation.

    assertEqual(await backend.fetchByPath('foo'), 'bar');

    unregisterBackend(backend.name, backend);

    // The data should have been dropped. We are not connected to
    // the backend anymore.
    assertEqual(false, dv.hasValue);
  }
}
