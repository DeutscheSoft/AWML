import { Value } from './value.js';
import { Subscriptions } from './utils/subscriptions.js';

/**
 * A special Value implementation which combines a list of other Value
 * instances. The ListValue will emit an array of values emitted by that list of
 * values.
 */
export class ListValue extends Value {
  /**
   * A shorthand function to create a ListValue from a list of values.
   *
   * @param values {Value}
   */
  static from(...values) {
    return new this(values.map((val) => Value.from(val)));
  }

  _notify() {
    const t = this._debounce;
    if (t === 0) {
      const v = this._values;
      this._values = v.slice(0);
      this._updateValue(v);
      return;
    }

    let id = this._debounce_id;

    if (id !== -1) return;

    id = setTimeout(() => {
      if (id !== this._debounce_id) return;
      this._debounce_id = -1;
      const v = this._values;
      this._values = v.slice(0);
      this._updateValue(v);
    }, t);
    this._debounce_id = id;
  }

  _activate() {
    const sub = new Subscriptions();
    this._subscriptions = sub;

    this.values.forEach((value, index) => {
      sub.add(
        value.subscribe((v) => {
          this._values[index] = v;
          this._hasValues[index] = true;

          if (this._hasValue) {
            this._notify();
            return;
          }

          if (this._partial) {
            this._notify();
            return;
          }

          for (let i = 0; i < this._hasValues.length; i++) {
            if (!this._hasValues[i]) return;
          }

          this._notify();
        })
      );
    });
  }

  _deactivate() {
    const sub = this._subscriptions;
    this._subscriptions = null;
    if (sub !== null) sub.unsubscribe();

    // mark all values as undefined
    this._hasValue = false;
    for (let i = 0; i < this._hasValues.length; i++) {
      this._hasValues[i] = false;
    }
    this._debounce_id = -1;
  }

  /**
   * @param values {Value[]}
   * @param [partial=false] {boolean} - Initial value for the partial property.
   * @param [debounce=0] {number} - Initial value for the debounce property.
   */
  constructor(values, partial, debounce) {
    super();
    /** @private */
    this.values = values;
    this._values = values.map(() => void 0);
    this._hasValues = values.map(() => false);
    this._partial = !!partial;
    this._debounce = debounce > 0 ? debounce : 0;
    this._subscriptions = null;
    this._debounce_id = -1;
    this._readonly = values.every((value) => typeof value.set === 'function');
  }

  /**
   * This value is in sync if all its represented values are in sync.
   */
  get inSync() {
    return this.values.every((value) => value.inSync);
  }

  /**
   * The debounce property can be used to throttle the number of
   * value updates. When debounce is a positive number N, value change
   * notifications will be delayed for N milliseconds.
   * @param v {number} - Number of milliseconds to debounce.
   */
  set debounce(v) {
    v = +v;
    if (this._debounce === v) return;

    if (!(v >= 0)) throw new TypeError('Expected non-negative number.');
    this._debounce = v;

    if (v !== 0) return;

    // if debouncing is turned off we might have to immediately emit
    // one value if a timeout is running
    const id = this._debounce_id;

    if (id === -1) return;

    this._debounce_id = -1;
    this._notify();
  }

  /** @ignore */
  get debounce() {
    return this._debounce;
  }

  /**
   * The partial property can be used to emit values even if not for each input
   * values at least one value has been received.
   * @param v {boolean}
   */
  set partial(v) {
    if (v === this._partial) return;

    if (typeof v !== 'boolean') throw new TypeError('Expected boolean.');

    this._partial = v;

    if (!v) {
      this._hasValue = this._hasValues.every((v) => v);
    } else {
      // if at least one value has been received, we
      // can now call our subscribers
      if ((this._hasValue = this._hasValues.some((v) => v))) this._notify();
    }
  }

  /** @ignore */
  get partial() {
    return this._partial;
  }

  /**
   * Set all values.
   *
   * @param value {Array} An array of values. Its length needs to match the
   * number of input values of this ListValue.
   */
  set(value) {
    if (this._readonly)
      throw new Error('Cannot set value in readonly ListValue.');

    const values = this.values;

    if (!Array.isArray(value) || value.length !== values.length)
      throw new TypeError('Expected an array of the right length.');

    for (let i = 0; i < values.length; i++) {
      values[i].set(value[i]);
    }
  }
}
