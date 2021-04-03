const handled = new WeakSet();

export function handleWebSocket(request, cb) {
  if (handled.has(request)) return;

  handled.add(request);

  cb();
}

export function closeUnhandledWebSockets(request, socket, head) {
  if (!handled.has(request)) socket.end();
}
