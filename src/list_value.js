import { DynamicValue } from './dynamic_value.js';
import { Subscriptions } from './utils/subscriptions.js';

/**
 * A special DynamicValue implementation which combines a list of other DynamicValue
 * instances. The ListValue will emit an array of values emitted by that list of
 * dynamic values.
 */
export class ListValue extends DynamicValue {
  /**
   * A shorthand function to create a ListValue from a list of dynamic values.
   *
   * @param values {DynamicValue}
   */
  static from(...values) {
    return new this(values.map((val) => DynamicValue.from(val)));
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

  _subscribe() {
    const sub = new Subscriptions();

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

    if (this.values.length === 0) {
      this._notify();
    }

    return sub.unsubscribe.bind(sub);
  }

  _deactivate() {
    super._deactivate();

    // mark all values as undefined
    this._hasValue = false;
    for (let i = 0; i < this._hasValues.length; i++) {
      this._hasValues[i] = false;
    }
    this._debounce_id = -1;
  }

  /**
   * @param values {DynamicValue[]}
   * @param [partial=false] {boolean}
   *    Initial value for the partial property.
   * @param [debounce=0] {number}
   *    Initial value for the debounce property.
   */
  constructor(values, partial, debounce) {
    super();
    /** @private */
    this.values = values;
    this._values = values.map(() => void 0);
    this._hasValues = values.map(() => false);
    this._partial = !!partial;
    this._debounce = debounce > 0 ? debounce : 0;
    this._debounce_id = -1;
    this._readonly = !values.every((value) => typeof value.set === 'function');
  }

  /**
   * This value is in sync if all its represented values are in sync.
   */
  get inSync() {
    return this.values.every((value) => value.inSync);
  }

  /**
   * The debounce property can be used to throttle the number of
   * value updates. When debounce is a positive number ``N``, value change
   * notifications will be delayed for ``N`` milliseconds.
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

  get debounce() {
    return this._debounce;
  }

  /**
   * The partial property can be used to emit values even if not for each input
   * dynamic value at least one value has been received. The resulting array
   * will contain ``undefined`` at those positions.
   *
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

    const promises = [];

    for (let i = 0; i < values.length; i++) {
      const p = values[i].set(value[i]);

      if (p) promises.push(p);
    }

    if (promises.length) {
      return Promise.all(promises);
    }
  }
}
