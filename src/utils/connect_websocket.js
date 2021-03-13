import { subscribeDOMEvent } from './subscribe_dom_event.js';
import { Subscriptions } from './subscriptions.js';

export function connectWebSocket(url, protocols) {
  return new Promise((resolve, reject) => {
    const subscriptions = new Subscriptions();
    const websocket = new WebSocket(url, protocols);

    subscriptions.add(
      subscribeDOMEvent(websocket, 'open', () => {
        resolve(websocket);
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
