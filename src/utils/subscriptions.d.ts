import { ISubscription } from '../subscription';

export class Subscriptions {
  constructor();
  unsubscribe(): void;
  add(...callbacks: ISubscription[]): void;
  get closed(): boolean;
}
