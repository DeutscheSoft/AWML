import { RPCClientBase } from '../../src/rpc/client_base';

type RpcMethods = {
  send(msg: unknown): void;
  subscribe(callback: (...args: unknown[]) => void): () => void;
};

type AwmlRpc = {
  connectRPC(): Promise<RpcMethods>;
};

export async function connectFrontendRPC() {
  if (!('awmlRpc' in window))
    throw new Error(`Running without electron backend.`);
  const { connectRPC } = window.awmlRpc as unknown as AwmlRpc;
  const { subscribe, send } = await connectRPC();
  class RpcClient extends RPCClientBase {
    constructor() {
      super();
      subscribe((msg) => {
        this._onMessage(msg);
      });
    }

    _send(msg: unknown) {
      send(msg);
    }
  }

  const rpc = new RpcClient();

  return {
    ping(arg: unknown) {
      return rpc.callWait('ping', arg);
    },
    subscribeInterval(interval: number, callback: (counter: number) => void) {
      return rpc.call<number>(
        'subscribeInterval',
        [interval],
        (ok, last, result) => {
          if (ok) callback(result);
          else console.error('Failed', result);
        }
      );
    },
  };
}
