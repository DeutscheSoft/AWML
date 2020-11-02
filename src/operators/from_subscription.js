import { DynamicValue } from '../dynamic_value.js';

class SubscriptionDynamicValue extends DynamicValue {
  _subscribe() {
    return this._subscribeFun((value) => {
      this._updateValue(value);
    });
  }

  constructor(subscribeFun, transformArgs) {
    super();
    this._subscribeFun = subscribeFun;
  }

  set() {
    throw new Error('Read only.');
  }
}

/**
 * Creates a read-only DynamicValue from a subscription function.
 */
export function fromSubscription(subscribeFun) {
  return new SubscriptionDynamicValue(subscribeFun);
}
