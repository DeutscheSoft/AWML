import { DynamicValue } from '../dynamic_value.js';

function defaultSubscribe() {
  return () => {};
}

function defaultSet() {
  throw new Error('This dynamic value is read-only.');
}

class SubscriptionDynamicValue extends DynamicValue {
  _subscribe() {
    return this._subscribeFun((value) => {
      this._updateValue(value);
    });
  }

  constructor(subscribeFun, setFun) {
    super();
    this._subscribeFun = subscribeFun || defaultSubscribe;
    this._setFun = setFun || defaultSet;
  }

  set(value) {
    this._setFun(value);
  }
}

/**
 * Creates a read-only DynamicValue from a subscription function.
 */
export function fromSubscription(subscribeFun, setFun) {
  return new SubscriptionDynamicValue(subscribeFun, setFun);
}
