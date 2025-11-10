import { BackendBase, IBackendBaseOptions } from './backend_base.js';

type InitialValues = { [path: string]: any };

export interface ILocalBackendOptions extends IBackendBaseOptions {
  data?: InitialValues;
  delay?: number;
  src?: string;
  transformData?: (data: InitialValues) => InitialValues;
}

export class LocalBackend extends BackendBase {
  get options(): ILocalBackendOptions;

  constructor(options: ILocalBackendOptions);

  delay: number;
}
