import { Base } from './base.js';
import { registerBackendType } from '../components/backend.js';
import { parseAttribute } from '../utils/parse_attribute.js';
import { fetchJSON } from '../utils/fetch.js';

export class LocalBackend extends Base {
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

  constructor(options) {
    super(options);
    this.delay = options.delay;
    this._src = options.src || null;
    this._transformData = options.transformData || null;

    let pending = 1;
    const maybeOpen = () => {
      if (--pending === 0) this.open();
    };

    const importData = (data) => {
      if (!this.isInit) return;

      if (this._transformData !== null) data = this._transformData(data);

      // Note: this works because id == path in this backend.
      const values = this._values;

      for (let path in data) {
        // do not overwrite values which came from the textContent
        if (values.has(path)) continue;
        this.receive(path, data[path]);
      }

      maybeOpen();
    };

    if (this._src !== null) {
      pending++;
      fetchJSON(this._src).then(
        (data) => {
          importData(data);
        },
        (err) => {
          error('Failed to load values from %o: %o', src, e);
          maybeOpen();
        }
      );
    }

    if (this.node !== null) {
      pending++;
      setTimeout(() => {
        const data = parseAttribute('json', this.node.textContent, {});
        importData(data);
      }, 0);
    }

    maybeOpen();
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
    const options = Base.argumentsFromNode(node);

    options.delay = parseInt(node.getAttribute('delay')) || 0;
    options.src = node.getAttribute('src');

    return options;
  }
}

registerBackendType('local', LocalBackend);
