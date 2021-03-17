import { BackendSubscriberBase } from './subscriber_base.js';
import { parseAttribute } from '../utils/parse_attribute.js';
import { fetchJSON } from '../utils/fetch.js';
import { error } from '../utils/log.js';

const parameterInfo = {
  type: 'parameter',
  access: 'rw',
};

/**
 * This class implements a backend which stores parameters in memory. It can be
 * useful when handling temporary parameters (e.g. some form of shared UI
 * state).
 *
 * It is available with the ``AWML-BACKEND`` component using the type ``local``.
 */
export class LocalBackend extends BackendSubscriberBase {
  get delay() {
    return this._delay;
  }

  /**
   * Set an optional delay. Values set on this backend will be emitted after
   * the delay has passed.
   *
   * @param {number} v
   *    Delay in milliseconds.
   */
  set delay(v) {
    if (v === void 0) v = -1;
    if (typeof v !== 'number' || !isFinite(v))
      throw new TypeError('Expected finite number.');
    this._delay = v;
  }

  get src() {
    return this._src;
  }

  _maybeOpen() {
    if (--this._pendingImport === 0) this.open();
  }

  _importData(data) {
    if (this._transformData !== null) data = this._transformData(data);

    const values = this._values;

    for (const path in data) {
      const value = data[path];
      this._defaultValues.set(path, value);
    }
  }

  _receive(path, value) {
    this._values.set(path, value);
    super._receive(path, value);
  }

  constructor(options) {
    super(options);
    this._transformData = options.transformData || null;
    this.delay = options.delay;
    this._src = options.src || null;
    this._pendingImport = 1;
    this._values = new Map();
    this._defaultValues = new Map();

    if (this._src !== null) {
      this._pendingImport++;
      fetchJSON(this._src).then(
        (data) => {
          if (!this.isInit) return;
          this._importData(data);
          this._maybeOpen();
        },
        (err) => {
          if (!this.isInit) return;
          error('Failed to load values from %o: %o', this._src, err);
          this._maybeOpen();
        }
      );
    }

    if (this.node !== null) {
      this._pendingImport++;
      Promise.resolve().then(() => {
        if (!this.isInit) return;
        const data = parseAttribute('json', this.node.textContent, {});
        this._importData(data);
        this._maybeOpen();
      });
    }

    if (options.data !== null) {
      this._importData(options.data);
    }

    Promise.resolve().then(() => {
      if (!this.isInit) return;
      this._maybeOpen();
    });
  }

  observeInfo(path, callback) {
    callback(1, 1, parameterInfo);
    return null;
  }

  setByPath(path, value) {
    const delay = this._delay;

    if (delay > 0) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (!this.isOpen) {
            reject(new Error('closed.'));
          } else {
            this._receive(path, value);
          }
        }, delay);
      });
    } else if (delay === 0) {
      return Promise.resolve().then(() => {
        if (!this.isOpen)
          throw new Error('closed.');
        this._receive(path, value);
      });
    } else {
      this._receive(path, value);
    }
  }

  observeByPath(path, callback) {
    const sub = super.observeByPath(path, callback);
    const values = this._values;
    const defaultValues = this._defaultValues;

    if (!values.has(path) && defaultValues.has(path)) {
      values.set(path, defaultValues.get(path));
    }

    if (values.has(path)) {
      this._safeCall(callback, 1, 0, values.get(path));
    }

    return sub;
  }

  static argumentsFromNode(node) {
    const options = BackendSubscriberBase.argumentsFromNode(node);
    const transformData = node.getAttribute('transform-data');
    const data = node.getAttribute('data');

    const delay = node.getAttribute('delay');
    options.delay = delay ? parseInt(delay) : -1;
    options.src = node.getAttribute('src');
    options.transformData = parseAttribute('javascript', transformData, null);
    options.data = parseAttribute('javascript', data, null);

    return options;
  }
}
