import { ISubscription } from "../subscription";

export function combineUnsubscribe(...callbacks: ISubscription[]): ISubscription;
