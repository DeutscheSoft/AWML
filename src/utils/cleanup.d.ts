import { ISubscription } from '../subscription.js';

export function initCleanup(): ISubscription;
export function assignCleanup(
  cleanup: ISubscription,
  callback: ISubscription
): void;
