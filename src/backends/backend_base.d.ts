import { EventTarget } from '../utils/event_target.js';
import { DynamicValue } from '../dynamic_value.js';

interface IPathInfo {
  id: string | number;
  type: 'parameter' | 'directory' | 'function' | 'event';
  access?: string;
  description?: string;
}

export interface IBackendBaseOptions {
  name?: string;
  node?: Node;
  /**
   * IF true, the backend will print additional warnings and error messages.
   */
  debug?: boolean;
}

export type IBackendState = 'init' | 'open' | 'closed' | 'error' | null;

export abstract class BackendBase extends EventTarget {
  get name(): string;
  get node(): Node | null;
  get debug(): boolean;

  get isInit(): boolean;
  get isOpen(): boolean;
  get isError(): boolean;
  get isClosed(): boolean;
  get options(): IBackendBaseOptions;
  get state$(): DynamicValue<IBackendState>;

  constructor(options: IBackendBaseOptions);
  close(): void;
  open(): void;
  error(err: Error): void;
  waitOpen(): Promise<void>;

  resolvePath(path: string): Promise<string | number>;
  resolveId(id: number | string): Promise<string>;
  setByPath(path: string, value: any): Promise<void>;
  log(fmt: string, ...args: unknown[]): void;

  observeInfo(
    path: string,
    callback: (
      ok: boolean | number,
      last: boolean | number,
      data: IPathInfo | Error
    ) => void
  ): () => void;

  fetchInfo(path: string): Promise<IPathInfo>;

  observeById(
    id: number | string,
    callback: (ok: boolean, last: boolean, value: any) => void
  ): () => void;

  observeByPath(
    path: string,
    callback: (ok: boolean, last: boolean, value: any) => void
  ): () => void;

  callById(id: number | string, args: any[]): Promise<any>;

  callByPath(path: string, args: any[]): Promise<any>;

  fetchByPath(path: string): Promise<any>;
  fetchById(id: number | string): Promise<any>;
}
