import { BackendValue } from './backend_value';
import { BackendBase } from './backends/backend_base';

export function getBackendValue<T>(address: string): BackendValue<T>;

export function getBackend(name: string): BackendBase;
export function waitForBackend(name: string): Promise<BackendBase>;
export function registerBackend(name: string, backend: BackendBase): void;
export function unregisterBackend(name: string, backend: BackendBase): void;
export function getBackendValues(
  backendName: string
): Map<string, BackendValue<any>>;
export function getBackends(): Map<string, BackendBase>;
