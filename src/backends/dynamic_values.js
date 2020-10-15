import { Backend } from './backend.js';

export class DynamicValuesBackend extends Backend {
  constructor(options) {
    super(options);
    let values = options.values;

    if (typeof values !== 'object')
      throw new TypeError('Expected object or Map.');

    if (!(values instanceof Map)) {
      values = new Map(Object.entries(values));
    }

    this._dynamicValues = values;
    this._cleanupHandlers = new Map();
    this.open();
  }

  lowSubscribe(path) {
    const dv = this._dynamicValues.get(path);

    if (dv) {
      this._subscribeSuccess(path, path);
      const sub = dv.subscribe((value) => {
        console.log(path, value);
        this.receive(path, value);
      });

      this._cleanupHandlers.set(path, sub);
    } else {
      this._subscribeFailure(new Error('No such parameter.'));  
    }
  }

  lowUnsubscribe(id) {
    const path = id;
    const sub = this._cleanupHandlers.get(path);

    console.log("Unsubscribe", id);

    this._cleanupHandlers.delete(path);

    try {
      sub();
    } catch (error) {
      console.error(error);
    }
  }

  set(id, value) {
    this._dynamicValues.get(id).set(value);
  }
}
