import { BackendBase, IBackendBaseOptions } from './backend_base';

type InitialValues = { [path: string]: any };

export interface ILocalBackendOptions extends IBackendBaseOptions {
  data?: InitialValues;
  delay?: number;
  src?: string;
  transformData?: (data: InitialValues) => InitialValues;
}

export class LocalBackend extends BackendBase {
  constructor(options: ILocalBackendOptions);

  delay: number;
}
