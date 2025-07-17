import { DynamicValue } from '../dynamic_value';
import { BackendBase, IBackendBaseOptions } from './backend_base';

export interface IDynamicValuesBackendOptions extends IBackendBaseOptions {
  values: Map<string,DynamicValue<unknown>> | Record<string, DynamicValue<unknown>>;
}

export class DynamicValuesBackend extends BackendBase {
  constructor(options: IDynamicValuesBackendOptions);
}
