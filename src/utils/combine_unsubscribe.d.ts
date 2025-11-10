import { ISubscription } from '../subscription.js';

export function combineUnsubscribe(
  ...callbacks: ISubscription[]
): ISubscription;
