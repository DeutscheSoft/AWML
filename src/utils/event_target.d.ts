export class EventTarget {
  constructor();

  on(name: string, cb: (...args: unknown[]) => void): void;
  off(name: string, cb: (...args: unknown[]) => void): void;
  subscribeEvent(name: string, cb: (...args: unknown[]) => void): () => void;
  once(name: string, cb: (...args: unknown[]) => void): () => void;
  emit(name: string, ...args: unknown[]): void;
  destroy(): void;
}
