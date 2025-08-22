import { BackendBase } from './backend_base.js';

const parameterInfo = {
  type: 'parameter',
  access: 'rw',
};

export class DynamicValuesBackend extends BackendBase {
  _findDynamicValue(path) {
    const dv = this._dynamicValues.get(path);

    if (!dv) {
      this.log('Could not find parameter %o', path);
    }

    return dv;
  }

  _getDynamicValue(path) {
    const dv = this._findDynamicValue(path);

    if (!dv) {
      throw new Error(`No such parameter "${path}".`);
    }

    return dv;
  }

  constructor(options) {
    super(options);
    let values = options.values;

    if (typeof values !== 'object')
      throw new TypeError('Expected object or Map.');

    if (!(values instanceof Map)) {
      values = new Map(Object.entries(values));
    }

    this._dynamicValues = values;
    this._cleanupHandlers = new Set();
    this.open();
  }

  observeInfo(path, callback) {
    const dv = this._findDynamicValue(path);
    if (!dv) {
      callback(0, 1, new Error(`No such parameter "${path}".`));
    } else {
      callback(1, 1, parameterInfo);
    }
    return null;
  }

  observeByPath(path, callback) {
    try {
      const dv = this._getDynamicValue(path);

      const sub = dv.subscribe((value) => {
        callback(1, 0, value);
      });

      this._cleanupHandlers.add(sub);

      return () => {
        this._cleanupHandlers.delete(sub);
        sub();
      };
    } catch (error) {
      callback(0, 1, error);
      return null;
    }
  }

  setByPath(path, value) {
    return this._getDynamicValue(path).set(value);
  }
}
