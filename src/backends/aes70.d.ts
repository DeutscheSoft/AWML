import { BackendBase, IBackendBaseOptions } from './backend_base';

export interface IAES70BackendOptions extends IBackendBaseOptions {
  url: string;
  batch?: number;
}

export class AES70Backend extends BackendBase {
  get options(): IAES70BackendOptions;

  _connectWebSocket(): Promise<WebSocket>;
  _connectDevice(options: IAES70BackendOptions): Promise<object>;

  constructor(options: IAES70BackendOptions);

  get device();
}
