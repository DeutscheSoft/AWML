import { AES70Backend } from './aes70.js';
import { registerBackendType } from '../components/backend.js';

registerBackendType('aes70', AES70Backend);
