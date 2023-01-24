import { createConnection } from 'net';
import { parse } from 'url';

import ws from 'ws';
const { Server } = ws;

import { handleWebSocket } from './handle_websocket.js';

function connect(destination) {
  return new Promise((resolve, reject) => {
    const socket = createConnection(destination, () => {
      resolve(socket);
    });
    socket.on('error', reject);
  });
}

function tunnel(socket, ws, head) {
  ws.on('close', () => {
    socket.end();
  });
  ws.on('error', (err) => {
    socket.end();
  });
  socket.on('end', () => {
    ws.close();
  });
  socket.on('error', (err) => {
    ws.close();
  });
  ws.on('message', (buf) => {
    socket.write(buf);
  });
  socket.on('data', (buf) => {
    ws.send(buf);
  });
  socket.write(head);
}

export function setupWSTunnel(server, path, destination) {
  const wss = new Server({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = parse(request.url).pathname;

    if (pathname !== path) return;

    handleWebSocket(request, async () => {
      try {
        const tcpSocket = await connect(destination);

        wss.handleUpgrade(request, socket, head, (ws) => {
          tunnel(tcpSocket, ws, head);
          console.log('Created tunnel to %o', destination);
        });
      } catch (err) {
        console.error('Failed to create tunnel to %o: %o', destination, err);
        socket.end();
      }
    });
  });
}
