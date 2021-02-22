import { Backend } from './backend.js';
import { warn } from '../utils/log.js';

export class JsonProtocolClientBackend extends Backend {
  constructor(options) {
    super(options);
    this._pendingSubscriptionMessage = null;
    this._pendingChanges = new Map();
    this._willFlush = false;
    // This map temporarily contains
    // ids for each path which is currently
    // pending in the current unsubscribe message.
    this._pendingPaths = new Map();
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
      this._pendingPaths.clear();
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

    if (message[address] === 0) {
      delete message[address];
      this._subscribeSuccess(address, this._pendingPaths.get(address));
    } else {
      message[address] = 1;
    }

    this.triggerFlush();
  }

  lowUnsubscribe(id) {
    let message = this._pendingSubscriptionMessage;

    const address = this._idToPath.get(id);

    if (message === null) {
      this._pendingSubscriptionMessage = message = {};
    }

    if (message[address] === 1) {
      delete message[address];
    } else {
      this._pendingPaths.set(address, id);
      message[address] = 0;
    }

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
    const options = Backend.argumentsFromNode(node);

    return options;
  }
}
