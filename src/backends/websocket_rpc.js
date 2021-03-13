import { RPCClientBackend } from './rpc_client.js';
import { getCurrentWebSocketUrl } from '../utils/fetch.js';
import { WebSocketRPCClient } from '../rpc/websocket_client.js';

export class WebSocketRPCBackend extends RPCClientBackend {
  _connectWebSocket() {
    return WebSocketRPCClient.connect(this.options.url);
  }

  async _connect() {
    this._remote = await this._connectWebSocket();
    return await super._connect();
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
