import { ISubscription } from '../subscription';

export function combineSubscriptions(
  ...callbacks: ISubscription[]
): ISubscription;
