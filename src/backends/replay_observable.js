import { runCleanupHandler } from '../utils/run_cleanup_handler.js';

export function safeCall(cb, ...args) {
  if (cb === null) return;
  try {
    cb(...args);
  } catch (err) {
    console.error('Unsubscribe callback generated an exception: %o.', err);
  }
}

export class ReplayObservable {
  constructor() {
    this.hasValue = false;
    this.value = null;
    this._subscribers = null;
    this._subscription = null;
  }

  hasSubscribers() {
    return this._subscribers !== null;
  }

  _receive(ok, last, data) {
    //console.log('%o._receive(%o, %o, %o)', this, ok, last, data);
    this.hasValue = true;
    this.value = [ok, last, data];

    const subscribers = this._subscribers;

    if (subscribers === null) return;

    if (typeof subscribers === 'function') {
      safeCall(subscribers, ok, 0, data);
    } else {
      for (let i = 0; i < subscribers.length; i++) {
        safeCall(subscribers[i], ok, 0, data);
      }
    }
  }

  subscribe(callback) {
    if (this.hasValue) {
      callback(this.value[0], 0, this.value[2]);
    }

    const subscribers = this._subscribers;

    if (subscribers === null) {
      this._subscribers = callback;
    } else if (typeof subscribers === 'function') {
      if (subscribers === callback) throw new Error('Already subscribed.');
      this._subscribers = [subscribers, callback];
    } else {
      subscribers.push(callback);
    }

    if (!this._subscription) {
      this._subscription = this._subscribe((ok, last, value) => {
        this._receive(ok, last, value);
      });

      // The subscription does not do anything.
      if (!this._subscription) return null;
    }

    return () => {
      let subscribers = this._subscribers;

      if (subscribers === callback) {
        this._subscribers = null;
      } else {
        subscribers = subscribers.filter((_callback) => _callback !== callback);
        this._subscribers =
          subscribers.length === 1 ? subscribers[0] : subscribers;
      }
    };
  }

  dispose() {
    runCleanupHandler(this._subscription);
    this._subscription = null;
  }
}

