import { Value } from './value.js';
import { Subscriptions } from './utils/subscriptions.js';

export class ListValue extends Value {
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

  constructor(values, partial, debounce) {
    super();
    this.values = values;
    this._values = values.map(() => void 0);
    this._hasValues = values.map(() => false);
    this._partial = !!partial;
    this._debounce = debounce > 0 ? debounce : 0;
    this._subscriptions = null;
    this._debounce_id = -1;
    this._readonly = values.every((value) => typeof value.set === 'function');
  }

  get inSync() {
    return this.values.every((value) => value.inSync);
  }

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
