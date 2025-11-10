import { ISubscription } from '../subscription.js';

export function combineSubscriptions(
  ...callbacks: ISubscription[]
): ISubscription;
