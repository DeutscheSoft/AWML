import { RPCClientBase } from './client_base.js';
import { Subscriptions } from '../utils/subscriptions.js';
import { subscribeDOMEvent } from '../utils/subscribe_dom_event.js';

export class WebSocketRPCClient extends RPCClientBase {
  isClosed() {
    return this._websocket.readyState !== WebSocket.OPEN;
  }

  close() {
    if (!this.isClosed()) this._websocket.close();
  }

  constructor(websocket) {
    super();
    this._websocket = websocket;
    this._sendBuffer = [];
    this._flushTriggered = false;
    this._flushCallback = () => {
      this._flushTriggered = false;
      if (this.isClosed()) return;
      this._flush();
    };
    if (this.isClosed()) throw new Error('WebSocket not open.');

    websocket.addEventListener('message', (ev) => {
      if (typeof ev.data !== 'string') {
        throw new Error('Unexpected BINARY frame.');
      }
      try {
        const messages = JSON.parse(ev.data);

        for (let i = 0; i < messages.length; i++) {
          this._onMessage(messages[i]);
        }
      } catch (err) {
        console.error(
          'Error while handling RPC message %o from server: %o',
          ev,
          err
        );
        this.close();
      }
    });
    websocket.addEventListener('error', (err) => {
      this.failAllCalls(err);
    });
    websocket.addEventListener('close', () => {
      this.failAllCalls(new Error('Closed.'));
    });
  }

  _flush() {
    if (this._sendBuffer.length === 0) return;
    const data = JSON.stringify(this._sendBuffer);
    this._sendBuffer.length = 0;
    this._websocket.send(data);
  }

  _triggerFlush() {
    if (this._sendBuffer.length > 512) {
      this._flush();
    }
    if (!this._flushTriggered) {
      this._flushTriggered = true;
      Promise.resolve().then(this._flushCallback);
    }
  }

  _send(message) {
    if (this.isClosed()) throw new Error('Already closed.');
    this._sendBuffer.push(message);
    this._triggerFlush();
  }

  static connect(url, protocols) {
    return new Promise((resolve, reject) => {
      const subscriptions = new Subscriptions();
      const websocket = new WebSocket(url, protocols);

      subscriptions.add(
        subscribeDOMEvent(websocket, 'open', () => {
          resolve(new this(websocket));
          subscriptions.unsubscribe();
        }),
        subscribeDOMEvent(websocket, 'error', (err) => {
          reject(err);
          subscriptions.unsubscribe();
        }),
        subscribeDOMEvent(websocket, 'close', () => {
          reject(new Error('Connection closed while connecting.'));
          subscriptions.unsubscribe();
        })
      );
    });
  }
}
