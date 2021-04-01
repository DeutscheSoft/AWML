import { RPCClientBackend } from './rpc_client.js';
import { getCurrentWebSocketUrl } from '../utils/fetch.js';
import { WebSocketRPCClient } from '../rpc/websocket_client.js';
import { subscribeDOMEvent } from '../utils/subscribe_dom_event.js';
import { parseAttribute } from '../utils/parse_attribute.js';

export class WebSocketRPCBackend extends RPCClientBackend {
  async _connectWebSocket() {
    const transformSrc = this.options.transformSrc;
    let src = this.options.url;

    if (typeof transformSrc === 'function')
      src = await transformSrc.call(this, src);

    return await WebSocketRPCClient.connect(src);
  }

  async _connect() {
    this._remote = await this._connectWebSocket();
    return await super._connect();
  }

  open() {
    super.open();
    this.addSubscription(
      subscribeDOMEvent(this._remote.websocket, 'close', () => {
        if (this.isOpen)
          this.close();
      }),
      subscribeDOMEvent(this._remote.websocket, 'error', (err) => {
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


    options.transformSrc = parseAttribute('javascript', node.getAttribute('transform-src'), null);

    options.url = url;

    return options;
  }
}
