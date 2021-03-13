import { parseAttribute } from '../utils/parse_attribute.js';
import { LocalBackend } from './local.js';
import { subscribeDOMEvent } from '../utils/subscribe_dom_event.js';
import { warn } from '../utils/log.js';

/**
 * This class implements a backend which stores parameters in either
 * localStorage or sessionStorage.
 *
 * It is available with the ``AWML-BACKEND`` component using the type
 * ``localstorage``.
 */
export class LocalStorageBackend extends LocalBackend {
  /**
   * The storage object. Should be either ``localStorage`` or
   * ``sessionStorage``.
   */
  get storage() {
    return this._storage;
  }

  constructor(options) {
    super(options);

    const storage = options.storage;

    this._storage = storage;
    this._encodedValues = new Map();

    if (options.clear) {
      storage.clear();
    }

    if (options.sync)
      this.addSubscription(
        subscribeDOMEvent(window, 'storage', (ev) => {
          if (ev.storageArea !== this._storage) return;
          const key = ev.key;
          const val = ev.newValue;
          if (this._encodedValues.has(key)) {
            if (this._encodedValues.get(key) !== val) {
              this._encodedValues.set(key, val);
              this._receive(key, JSON.parse(val));
            }
          }
        })
      );
  }

  observeByPath(path, callback) {
    if (!this._hasSubscribers(path) && !this._values.has(path)) {
      try {
        const storedValue = this.storage.getItem(path);

        if (storedValue !== null) {
          this._encodedValues.set(path, storedValue);
          this._values.set(path, JSON.parse(storedValue));
        }
      } catch (err) {
        warn('Loading stored value %o from storage failed: %o', path, err);
      }
    }
    return super.observeByPath(path, callback);
  }

  setByPath(path, value) {
    const store = () => {
      try {
        const encodedValue = JSON.stringify(value);
        const encodedValues = this._encodedValues;

        if (encodedValues.get(path) === encodedValue) return;

        this.storage.setItem(path, encodedValue);
        encodedValues.set(path, encodedValue);
      } catch (err) {
        warn('Storing value %o to storage failed: %o', path, err);
      }
    };

    const task = super.setByPath(path, value);

    if (typeof task === 'object' && typeof task.then === 'function')
      return task.then(store);

    store();

    return task;
  }

  static argumentsFromNode(node) {
    const options = LocalBackend.argumentsFromNode(node);

    options.sync = node.getAttribute('sync') !== null;
    options.storage = parseAttribute(
      'js',
      node.getAttribute('storage'),
      localStorage
    );
    options.clear = node.getAttribute('clear') !== null;

    return options;
  }
}
