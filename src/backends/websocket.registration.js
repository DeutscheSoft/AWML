import { WebSocketBackend } from './websocket.js';
import { registerBackendType } from '../components/backend.js';

registerBackendType('websocket', WebSocketBackend);
