import { WebSocketRPCBackend } from './websocket_rpc.js';
import { registerBackendType } from '../components/backend.js';

registerBackendType('websocket-rpc', WebSocketRPCBackend);
