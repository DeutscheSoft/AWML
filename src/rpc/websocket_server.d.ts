import { RPCMethods, RPCServerBase } from './server_base.js';

export class WebSocketRPCServer extends RPCServerBase {
  isClosed(): boolean;
  close(): void;
  constructor(websocket: unknown, methods: RPCMethods);
}
