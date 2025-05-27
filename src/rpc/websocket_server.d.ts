import { RPCMethods, RPCServerBase } from './server_base.js';

export class WebSocketRPCServer extends RPCServerBase {
  isClosed(): boolean;
  close(): void;
  constructor(websocket: unknown, methods: RPCMethods);

  protected _onWebSocketMessage(...args: unknown[]): void;
  protected _onWebSocketError(...args: unknown[]): void;
  protected _onWebSocketClose(...args: unknown[]): void;
  protected _encodeMessages(messages: unknown[]): string;
  protected _decodeMessages(data: string): unknown[];
}
