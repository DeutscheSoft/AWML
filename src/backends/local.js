import { Backend } from './backend.js';
import { registerBackendType } from '../components/backend.js';
import { parseAttribute } from '../utils/parse_attribute.js';
import { fetchJSON } from '../utils/fetch.js';
import { error } from '../utils/log.js';

export class LocalBackend extends Backend {
  get delay() {
    return this._delay;
  }

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
    this.delay = options.delay;
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
      setTimeout(() => {
        if (!this.isInit) return;
        const data = parseAttribute('json', this.node.textContent, {});
        this._importData(data, false);
        this._maybeOpen();
      }, 0);
    }

    setTimeout(() => {
      if (!this.isInit) return;
      this._maybeOpen();
    }, 0);
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

  static argumentsFromNode(node) {
    const options = Backend.argumentsFromNode(node);
    const tmp = node.getAttribute('transform-data');

    options.delay = parseInt(node.getAttribute('delay')) || 0;
    options.src = node.getAttribute('src');
    options.transformData = parseAttribute('javascript', tmp, null);

    return options;
  }
}

registerBackendType('local', LocalBackend);
