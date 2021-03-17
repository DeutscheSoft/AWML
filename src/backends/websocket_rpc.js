import { RPCClientBackend } from './rpc_client.js';
import { getCurrentWebSocketUrl } from '../utils/fetch.js';
import { WebSocketRPCClient } from '../rpc/websocket_client.js';
import { subscribeDOMEvent } from '../utils/subscribe_dom_event.js';

export class WebSocketRPCBackend extends RPCClientBackend {
  _connectWebSocket() {
    return WebSocketRPCClient.connect(this.options.url);
  }

  async _connect() {
    this._remote = await this._connectWebSocket();
    return await super._connect();
  }

  open() {
    super.open();
    this.addSubscription(
      subscribeDOMEvent(this._remote.websocket, 'close', () => {
        console.log('websocket closed');
        if (this.isOpen)
          this.close();
      }),
      subscribeDOMEvent(this._remote.websocket, 'error', (err) => {
        console.log('websocket errored');
        if (this.isOpen)
          this.error(err);
      }),
      () => {
        this._remote.close();
      },
    );
  }

  static argumentsFromNode(node) {
    const options = RPCClientBackend.argumentsFromNode(node);

    const src = node.getAttribute('src');
    let url;

    if (src === null) {
      url = getCurrentWebSocketUrl().href;
    } else if (src.startsWith('/')) {
      const current = getCurrentWebSocketUrl();
      url = new URL(src, current).href;
    } else {
      url = src;
    }

    options.url = url;

    return options;
  }
}
