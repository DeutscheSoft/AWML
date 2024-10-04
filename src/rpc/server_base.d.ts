import { RPCCallback } from './client_base';

type RPCMethods = Record<string, Function>;

export { RPCCallback };

export abstract class RPCServerBase {
  constructor(methods: RPCMethods);

  /**
   * The number of currently pending calls.
   */
  pendingCalls(): number;

  /**
   * Fails all currently pending calls.
   */
  dispose(): void;

  /**
   * Process one incoming message.
   */
  protected _onMessage(msg: unknown): void;

  /**
   * Send one outgoing message.
   */
  abstract _send(msg: unknown): void;
}
