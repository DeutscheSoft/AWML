import { LocalBackend, LocalStorageBackend } from '../src/index';
import { AES70Backend } from '../src/backends/aes70';
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
