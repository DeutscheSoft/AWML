import { error } from './log.js';

/**
 * A simple EventTarget implementation used by backends.
 *
 * @ignore
 */
export class EventTarget {
  constructor() {
    this._eventHandlers = new Map();
  }

  on(name, cb) {
    if (typeof name !== 'string') throw new TypeError('Expected string.');

    if (typeof cb !== 'function') throw new TypeError('Expected function.');

    const eventHandlers = this._eventHandlers;

    let handlers = eventHandlers.get(name);

    if (handlers === void 0) {
      handlers = new Set();
      eventHandlers.set(name, handlers);
    }

    if (handlers.has(cb)) throw new Error('Cannot subscribe twice.');

    handlers.add(cb);
  }

  off(name, cb) {
    const eventHandlers = this._eventHandlers;

    const handlers = eventHandlers.get(name);

    if (handlers === void 0 || !handlers.has(cb)) {
      throw new Error('Unknown subscriber.');
    }

    handlers.delete(cb);
  }

  subscribeEvent(name, cb) {
    this.on(name, cb);

    return () => {
      if (name === null) return;
      if (this._eventHandlers !== null) this.off(name, cb);
      name = null;
    };
  }

  once(name, cb) {
    let sub = null;

    const _cb = (...args) => {
      sub();
      cb(...args);
    };

    sub = this.subscribeEvent(name, _cb);

    return sub;
  }

  emit(name, ...args) {
    const eventHandlers = this._eventHandlers;

    const handlers = eventHandlers.get(name);

    if (handlers === void 0) return;

    handlers.forEach((cb) => {
      try {
        cb(...args);
      } catch (err) {
        error('Subscriber threw an error: %o', err);
      }
    });
  }

  /**
   * Remove all event handlers. This object cannot be used after calling
   * this method.
   */
  destroy() {
    this._eventHandlers = null;
  }
}
