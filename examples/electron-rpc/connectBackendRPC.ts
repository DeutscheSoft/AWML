import { RPCCallback, RPCServerBase } from '../../src/rpc/server_base';
import { ipcMain, IpcMainEvent, WebContents } from 'electron';

class RPCServer extends RPCServerBase {
  private readonly messageCallback = (
    event: IpcMainEvent,
    message: unknown
  ) => {
    this._onMessage(message);
  };

  constructor(
    private readonly topic: string,
    private readonly sender: WebContents,
    methods: Record<string, Function>
  ) {
    super(methods);

    this.sender.ipc.on(this.topic, this.messageCallback);
  }

  _send(message: unknown) {
    this.sender.postMessage(this.topic, message);
  }

  dispose() {
    super.dispose();
    this.sender.ipc.off(this.topic, this.messageCallback);
  }
}

export function connectBackendRPC() {
  const methods = {
    ping(foo: unknown) {
      return foo;
    },
    subscribeInterval: (interval: number) => {
      return (callback: RPCCallback<number>) => {
        let counter = 0;
        const id = setInterval(
          () => callback(true, false, counter++),
          interval
        );

        return () => clearInterval(id);
      };
    },
  };

  let server: RPCServer | null = null;
  let rpcId = 0;

  ipcMain.handle('awml-rpc-connect', (ev) => {
    if (server) server.dispose();

    const { sender } = ev;
    const topic = 'awml-rpc-message-' + rpcId++;

    server = new RPCServer(topic, sender, methods);

    sender.on('destroyed', () => {
      if (server) server.dispose();

      server = null;
    });

    return topic;
  });

  return () => {
    ipcMain.removeHandler('awml-rpc-connect');
  };
}
