import { DynamicValue } from './dynamic_value';

interface IBindingDescriptionShared {
  name: string;
  pipe?: (dv: DynamicValue<any>) => DynamicValue<any>;
  transformReceive?: (value: any) => any;
  transformSend?: (value: any) => any;
  replayReceive?: boolean;
  replaySend?: boolean;
  debug?: boolean;
}

interface IBindingDescriptionSrc extends IBindingDescriptionShared {
  src: string;
  srcPrefix?: string;
}

interface IBindingDescriptionBackendValue extends IBindingDescriptionShared {
  backendValue: DynamicValue<any>;
}

interface IWidget {
  subscribe(eventName: string, eventHandler: (...args) => void): () => void,
  set(optionName: string, value: any): any;
}

export type IBindingDescription = IBindingDescriptionSrc |
  IBindingDescriptionBackendValue;

export function createBinding(
  target: Node | IWidget,
  sourceNode: Node,
  ctx: any,
  options: IBindingDescription,
  log?: (...args) => void): () => void;

export class Bindings {
  constructor(
    target: Node | IWidget,
    sourceNode: Node,
    ctx: any,
    log?: (...args) => void);

  update(bindings: IBindingDescription | IBindingDescription[] | null): void;
  updatePrefix(handle: string): void;
  dispose(): void;
}
