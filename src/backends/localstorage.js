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

    this.addSubscription(
      subscribeDOMEvent(window, 'storage', (ev) => {
        if (ev.storageArea !== this._storage) return;
        const key = ev.key;
        const val = ev.newValue;
        if (this._pathToId.has(key)) {
          this._encodedValues.set(key, val);
          this.receive(key, JSON.parse(val));
        }
      })
    );
  }

  lowSubscribe(address) {
    try {
      const storedValue = this.storage.getItem(address);

      if (storedValue !== null) {
        this._encodedValues.set(address, storedValue);
        this._values.set(address, JSON.parse(storedValue));
      }
    } catch (err) {
      warn('Loading stored value %o from storage failed: %o', address, err);
    }

    super.lowSubscribe(address);
  }

  set(id, value) {
    super.set(id, value);

    try {
      const encodedValue = JSON.stringify(value);
      const encodedValues = this._encodedValues;

      if (encodedValues.get(id) === encodedValue) return;

      this.storage.setItem(id, encodedValue);
      encodedValues.set(id, encodedValue);
    } catch (err) {
      warn('Storing value %o to storage failed: %o', id, err);
    }
  }

  static argumentsFromNode(node) {
    const options = LocalBackend.argumentsFromNode(node);

    options.storage = parseAttribute(
      'js',
      node.getAttribute('storage'),
      localStorage
    );
    options.clear = node.getAttribute('clear') !== null;

    return options;
  }

  destroy() {
    super.destroy();
  }
}
