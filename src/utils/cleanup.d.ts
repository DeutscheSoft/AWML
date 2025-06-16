import { ISubscription } from '../subscription';

export function initCleanup(): ISubscription;
export function assignCleanup(
  cleanup: ISubscription,
  callback: ISubscription
): void;
