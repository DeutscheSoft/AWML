import { Backend } from './backend.js';
import { parseAttribute } from '../utils/parse_attribute.js';
import { fetchJSON } from '../utils/fetch.js';
import { error } from '../utils/log.js';

/**
 * This class implements a backend which stores parameters in memory. It can be
 * useful when handling temporary parameters (e.g. some form of shared UI
 * state).
 *
 * It is available with the ``AWML-BACKEND`` component using the type ``local``.
 */
export class LocalBackend extends Backend {
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
    if (typeof v !== 'number' || v < 0 || !isFinite(v))
      throw new TypeError('Expected finite non-negative number.');
    this._delay = v;
  }

  get src() {
    return this._src;
  }

  get transformData() {
    return this._transformData;
  }

  _maybeOpen() {
    if (--this._pending === 0) this.open();
  }

  _importData(data, overwrite) {
    if (this._transformData !== null) data = this._transformData(data);

    // Note: this works because id == path in this backend.
    const values = this._values;

    for (const path in data) {
      if (!overwrite && values.has(path)) continue;
      this.receive(path, data[path]);
    }
  }

  constructor(options) {
    super(options);
    this.delay = options.delay || 0;
    this._src = options.src || null;
    this._transformData = options.transformData || null;
    this._pending = 1;

    if (this._src !== null) {
      this._pending++;
      fetchJSON(this._src).then(
        (data) => {
          if (!this.isInit) return;
          this._importData(data, false);
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
      this._pending++;
      Promise.resolve().then(() => {
        if (!this.isInit) return;
        const data = parseAttribute('json', this.node.textContent, {});
        this._importData(data, false);
        this._maybeOpen();
      });
    }

    if (options.data !== null) {
      this._importData(options.data, false);
    }

    Promise.resolve().then(() => {
      if (!this.isInit) return;
      this._maybeOpen();
    });
  }

  set(id, value) {
    const delay = this._delay;

    if (delay > 0) {
      setTimeout(() => {
        if (!this.isOpen) return;
        this.receive(id, value);
      }, delay);
    } else {
      this.receive(id, value);
    }
  }

  lowSubscribe(path) {
    this._subscribeSuccess(path, path);
  }

  lowUnsubscribe(id) {}

  static argumentsFromNode(node) {
    const options = Backend.argumentsFromNode(node);
    const transformData = node.getAttribute('transform-data');
    const data = node.getAttribute('data');

    options.delay = parseInt(node.getAttribute('delay')) || 0;
    options.src = node.getAttribute('src');
    options.transformData = parseAttribute('javascript', transformData, null);
    options.data = parseAttribute('javascript', data, null);

    return options;
  }
}
