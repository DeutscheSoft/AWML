import { BackendValue } from './backend_value.js';
import { BackendBase } from './backends/backend_base.js';
import { DynamicValue } from './dynamic_value.js';
import { ISubscription } from './subscription.js';

export function getBackendValue<T>(address: string): BackendValue<T>;

export function getBackend(name: string): BackendBase;
export function waitForBackend(name: string): Promise<BackendBase>;
export function registerBackend(name: string, backend: BackendBase): void;
export function unregisterBackend(name: string, backend: BackendBase): void;
export function provideBackend(
  name: string,
  dv: DynamicValue<BackendBase | null | undefined>
): ISubscription;
export function getBackendValues(
  backendName: string
): Map<string, BackendValue<any>>;
export function getBackends(): Map<string, BackendBase>;
export function observeBackends(): DynamicValue<Map<string, BackendBase>>;
export function observeBackend(name: string): DynamicValue<BackendBase>;
