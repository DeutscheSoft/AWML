import { LocalStorageBackend } from './localstorage.js';
import { registerBackendType } from '../components/backend.js';

registerBackendType('localstorage', LocalStorageBackend);
