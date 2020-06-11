import { Base } from './base.js';
import { warn } from '../utils/log.js';

export class JsonProtocolClientBackend extends Base {
  constructor(options) {
    super(options);
    this._pendingSubscriptionMessage = null;
    this._pendingChanges = new Map();
    this._willFlush = false;
  }

  send() {
    throw new Error('Not implemented.');
  }

  flush() {
    this._willFlush = false;
    if (!this.isOpen) return;

    const pendingChanges = this._pendingChanges;

    if (pendingChanges.size) {
      const message = new Array(pendingChanges.size * 2);
      let i = 0;

      pendingChanges.forEach((value, id) => {
        message[i++] = id;
        message[i++] = value;
      });

      pendingChanges.clear();

      this.send(message);
    }

    const pendingSubscriptionMessage = this._pendingSubscriptionMessage;

    if (pendingSubscriptionMessage !== null) {
      this._pendingSubscriptionMessage = null;
      this.send(pendingSubscriptionMessage);
    }
  }

  triggerFlush() {
    if (this._willFlush === true) return;
    this._willFlush = true;
    Promise.resolve().then(() => this.flush());
  }

  onMessage(message) {
    if (typeof message !== 'object') {
      warn('Unexpected message: %o', message);
      return;
    }

    if (Array.isArray(message)) {
      for (let i = 0; i < message.length; i += 2) {
        const id = message[i];
        const value = message[i + 1];
        this.receive(id, value);
      }
    } else {
      for (const path in message) {
        const tmp = message[path];

        if (tmp) {
          let id;

          if (Array.isArray(tmp)) {
            id = tmp[0];
            this._values.set(id, tmp[1]);
          } else {
            id = tmp;
          }

          this._subscribeSuccess(path, id);
        } else {
          this._subscribeFailure(path, new Error('Unknown'));
        }
      }
    }
  }

  lowSubscribe(address) {
    let message = this._pendingSubscriptionMessage;

    if (message === null) {
      this._pendingSubscriptionMessage = message = {};
    }

    message[address] = 1;
    this.triggerFlush();
  }

  lowSubscribeBatch(addresses) {
    let message = this._pendingSubscriptionMessage;

    if (message === null) {
      this._pendingSubscriptionMessage = message = {};
    }

    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      message[address] = 1;
    }

    this.triggerFlush();
  }

  lowUnsubscribe(address) {
    let message = this._pendingSubscriptionMessage;

    if (message === null) {
      this._pendingSubscriptionMessage = message = {};
    }

    message[address] = 0;
    this.triggerFlush();
  }

  set(id, value) {
    this._pendingChanges.set(id, value);
    this.triggerFlush();
  }

  clear() {
    this.send(false);
  }

  static argumentsFromNode(node) {
    const options = Base.argumentsFromNode(node);

    return options;
  }
}
