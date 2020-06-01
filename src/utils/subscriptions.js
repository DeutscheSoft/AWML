import { error } from './log.js';

export class Subscriptions {
  constructor() {
    this.subscriptions = [];
  }

  unsubscribe() {
    const subs = this.subscriptions;
    if (subs === null) return;
    this.subscriptions = null

    for (let i = 0; i < subs.length; i++) {
      try {
        subs[i]();
      } catch (err) {
        error('Unsubscriptions handler generated an exception: %o', err);
      }
    }
  }

  add(...callbacks) {
    const subs = this.subscriptions;

    for (let i = 0; i < callbacks.length; i++) {
      const cb = callbacks[i];

      if (typeof cb !== 'function')
        throw new TypeError('Expected function.');

      subs.push(cb);
    }
  }

  get closed() {
    return this.subscriptions === null;
  }
}
