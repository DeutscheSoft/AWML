import { RPCClientBase } from './client_base';

export class WebSocketRPCClient extends RPCClientBase {
  isClosed(): boolean;
  close(): void;
  get websocket(): WebSocket;
  constructor(websocket: WebSocket);
  static connect(
    url: string | URL,
    protocols?: string[]
  ): Promise<WebSocketRPCClient>;
  protected _encodeMessages(messages: unknown[]): string;
  protected _decodeMessages(data: string): unknown[];
  protected _send(msg: unknown): void;
}
