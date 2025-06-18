type RpcResultCallbackParameters<T> =
  | [ok: true, last: boolean, result: T]
  | [ok: false, last: boolean, result: Error];

/**
 * A result callback for rpc.
 *
 * @param {boolean} ok
 *   True if this result is a regular result. False if this
 *   result is an error.
 * @param {boolean} last
 *   True if this is the last result.
 * @param {T|Error} result
 *   If ok is true, this is the result.
 *   If ok is false, this is the associated failure.
 */
export type RPCCallback<T = unknown> = (
  ...args: RpcResultCallbackParameters<T>
) => void;

export class RPCResponsError extends Error {
  public readonly reason: unknown;
  constructor(reason: unknown);
}

export abstract class RPCClientBase {
  isClosed(): boolean;
  constructor();

  /**
   * Call a remote method and call the callback for each result.
   */
  call<T = unknown>(
    methodName: string,
    args: unknown[],
    callback: RPCCallback<T>
  ): () => void;

  /**
   * Calls a remote method and returns the result in the associated promise.
   * Fails if the given method returns more than one result.
   */
  callWait<T = unknown>(methodName: string, ...args: unknown[]): Promise<T>;
  callAsyncIterator<T = unknown>(
    methodName: string,
    ...args: unknown[]
  ): AsyncIterator<T>;

  /**
   * The number of currently pending calls.
   */
  pendingCalls(): number;

  /**
   * Process one incoming message.
   */
  protected _onMessage(msg: unknown): void;

  /**
   * Send one outgoing message.
   */
  protected abstract _send(msg: unknown): void;
}
