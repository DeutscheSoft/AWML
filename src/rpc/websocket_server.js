import { RPCServerBase } from './server_base.js';

export class WebSocketRPCServer extends RPCServerBase {
  isClosed() {
    this._websocket.readyState === 1;
  }

  close() {
    this.dispose();
    this._websocket.close();
  }

  _onWebSocketMessage(ev) {
    let str;
    if (typeof ev === 'string') {
      // Note: this is the node 'ws' module
      str = ev;
    } else if (typeof ev === 'object' && 'type' in ev) {
      // Note: this is the node 'websocket' module
      if (ev.type === 'utf8') {
        str = ev.utf8Data;
      } else {
        throw new Error('Expected TEXT frame.');
      }
    } else {
      throw new Error('Unexpected message.');
    }

    try {
      const messages = JSON.parse(str);

      for (let i = 0; i < messages.length; i++) {
        this._onMessage(messages[i]);
      }
    } catch (err) {
      console.error(
        'Error while handling RPC message %o from client: %o',
        ev,
        err
      );
      this.close();
    }
  }

  _onWebSocketError(ev) {
    this.dispose();
  }

  _onWebSocketClose(ev) {
    this.dispose();
  }

  constructor(websocket, methods) {
    super(methods);
    this._websocket = websocket;
    this._sendBuffer = [];
    this._flushTriggered = false;
    this._flushCallback = () => {
      this._flushTriggered = false;
      if (this.isClosed()) return;
      this._flush();
    };

    websocket.on('message', (...args) => this._onWebSocketMessage(...args));
    websocket.on('error', (...args) => this._onWebSocketError(...args));
    websocket.on('close', (...args) => this._onWebSocketClose(...args));
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

  static getFactory(websocket) {
    return (methods) => {
      return new this(websocket, methods);
    };
  }
}
