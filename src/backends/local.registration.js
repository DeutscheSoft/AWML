import { LocalBackend } from './local.js';
import { registerBackendType } from '../components/backend.js';

registerBackendType('local', LocalBackend);
