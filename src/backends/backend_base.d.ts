import { EventTarget } from '../utils/event_target';

interface IPathInfo {
  id: string|number;
  type: 'parameter' | 'directory' | 'function' | 'event';
  access?: string;
  description?: string;
}

export interface IBackendBaseOptions {
  name?: string;
  node?: Node;
}

export abstract class BackendBase extends EventTarget {
  get name(): string;
  get node(): Node|null;

  get isInit(): boolean;
  get isOpen(): boolean;
  get isError(): boolean;
  get isClosed(): boolean;

  constructor(options: IBackendBaseOptions);
  close(): void;

  resolvePath(path: string): Promise<string|number>;
  resolveId(id: number|string): Promise<string>;
  setByPath(path: string, value: any): Promise<void>;
  
  observeInfo(
      path: string,
      callback: (ok: boolean|number,
                 last: boolean|number,
                 data: IPathInfo|Error) => void
    ): () => void;

  fetchInfo(path: string): Promise<IPathInfo>;

  observeById(
      id: number|string,
      callback: (ok: boolean,
                 last: boolean,
                 value: any) => void
    ): () => void;

  observeByPath(
      path: string,
      callback: (ok: boolean,
                 last: boolean,
                 value: any) => void
    ): () => void;
               
  callById(
      id: number|string,
      args: any[]
    ): Promise<any>;

  callByPath(
      path: string,
      args: any[]
    ): Promise<any>;

  fetchByPath(path: string): Promise<any>;
  fetchById(id: number|string): Promise<any>;
}
