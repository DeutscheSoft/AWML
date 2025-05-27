import { RPCClientBase, RPCServerBase } from '../../src/rpc.js';

class DummyRPCServer extends RPCServerBase {
  constructor(methods) {
    super(methods);
  }
}

class DummyRPCClient extends RPCClientBase {
  constructor() {
    super();
  }
}

function connect(delay, a, b) {
  a._send = (message) => {
    //console.log(message);

    message = JSON.stringify(message);
    message = JSON.parse(message);

    if (delay === 0) {
      Promise.resolve().then(() => {
        b._onMessage(message);
      });
    } else if (delay > 0) {
      setTimeout(() => {
        b._onMessage(message);
      }, delay);
    } else {
      b._onMessage(message);
    }
  };
}

export function getClient(clientDelay, serverDelay, methods) {
  const server = new DummyRPCServer(methods);
  const client = new DummyRPCClient();

  connect(clientDelay, client, server);
  connect(serverDelay, server, client);

  return [client, server];
}
