import { BackendBase, IBackendBaseOptions } from './backend_base';

export interface IAES70BackendOptions extends IBackendBaseOptions {
  url: string;
  batch?: number;
}

export class AES70Backend extends BackendBase {
  constructor(options: IAES70BackendOptions);

  get device();
}
