import { BackendBase, IBackendBaseOptions } from './backend_base';

export interface IEmberPlusBackendOptions extends IBackendBaseOptions {
  url: string;
  batch?: number;
  fetchUrl?: () => Promise<string>;
  protocol?: string | string[];
}

export class EmberPlusBackend extends BackendBase {
  get url(): string;
  get protocol(): string;
  get batch(): number;

  constructor(options: IEmberPlusBackendOptions);
}
