import { JsonProtocolClientBackend } from './json_protocol_client.js';
import { subscribeDOMEvent } from '../utils/subscribe_dom_event.js';
import { registerBackendType } from '../components/backend.js';
import { getCurrentWebSocketUrl } from '../utils/fetch.js';

export class WebSocketBackend extends JsonProtocolClientBackend {
  constructor(options) {
    super(options);

    const url = options.url;

    const websocket = new WebSocket(url);

    this._websocket = websocket;
    this.addSubscription(
      subscribeDOMEvent(websocket, 'open', () => {
        this.open();
        if (options.clear) this.clear();
      }),
      subscribeDOMEvent(websocket, 'close', () => {
        this.close();
      }),
      subscribeDOMEvent(websocket, 'error', (err) => {
        this.error(err);
      }),
      subscribeDOMEvent(websocket, 'message', (ev) => {
        this.onMessage(JSON.parse(ev.data));
      })
    );
  }

  static argumentsFromNode(node) {
    const options = JsonProtocolClientBackend.argumentsFromNode(node);

    options.clear = node.getAttribute('clear') !== null;

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

  send(message) {
    this._websocket.send(JSON.stringify(message));
  }

  destroy() {
    super.destroy();
    this._websocket.close();
  }
}

registerBackendType('websocket', WebSocketBackend);
