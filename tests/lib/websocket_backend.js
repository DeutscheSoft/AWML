import { parse } from 'url';
import { WebSocketServer } from 'ws';

import {
  RPCServerBackendConnector,
  WebSocketRPCServer,
} from '../../src/index.node.js';

import { handleWebSocket } from './handle_websocket.js';

export function setupWSBackendConnections(server, prefix, getBackend) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = parse(request.url).pathname;
    const tmp = pathname.split('/').filter((str) => str.length > 0);

    if (tmp.length !== 2) return;

    const [apiPrefix, backendName] = tmp;

    if (apiPrefix !== prefix) return;

    handleWebSocket(request, () => {
      try {
        const backend = getBackend(backendName);

        wss.handleUpgrade(request, socket, head, (ws) => {
          new RPCServerBackendConnector(
            WebSocketRPCServer.getFactory(ws),
            backend
          );
        });
      } catch (err) {
        socket.end();
        console.error(err);
      }
    });
  });
}
