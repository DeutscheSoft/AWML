import { ISubscription } from '../subscription.js';

export class Subscriptions {
  constructor();
  unsubscribe(): void;
  add(...callbacks: ISubscription[]): void;
  get closed(): boolean;
}
