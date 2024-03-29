import { LocalBackend, LocalStorageBackend } from '../src/index';
import { AES70Backend, IAES70BackendOptions } from '../src/backends/aes70';
import { EmberPlusBackend } from '../src/backends/ember-plus';

{
  new LocalBackend({});
  new LocalBackend({
    name: 'local',
    data: { foo: 23 },
    delay: 100,
  });

  new LocalStorageBackend({});
  new LocalStorageBackend({
    name: 'local',
    data: { foo: 23 },
    delay: 100,
    transformData: (data) => {
      return {};
    },
    storage: window.sessionStorage,
  });
}

{
  new AES70Backend({
    url: '/_control',
  });
}

{
  new EmberPlusBackend({
    url: '/_control',
  });
}

// Check that options is there
{
  const b = new LocalBackend({
    name: 'local',
    data: { foo: 23 },
    delay: 100,
  });

  const name: string = b.options.name;

  b.open();
  b.close();
  b.error(new Error('foo'));
}

async function fun() {
  const b = new AES70Backend({
    url: '/_control',
  });

  const ws: WebSocket = await b._connectWebSocket();
}

interface DerivedOptions extends IAES70BackendOptions {
  foo: number;
}

class DerivedBackend extends AES70Backend {
  async _connectDevice(options: DerivedOptions) {
    return {};
  }
}
