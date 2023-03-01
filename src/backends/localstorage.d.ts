import { LocalBackend, ILocalBackendOptions } from './local';

export interface ILocalStorageBackendOptions extends ILocalBackendOptions {
  storage?: Storage;
  clear?: boolean;
  sync?: boolean;
}

export class LocalStorageBackend extends LocalBackend {
  get options(): ILocalStorageBackendOptions;

  constructor(options: ILocalStorageBackendOptions);

  get storage(): Storage;
}
