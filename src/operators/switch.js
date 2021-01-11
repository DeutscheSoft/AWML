import { DynamicValue } from '../dynamic_value.js';

class SwitchMapValue extends DynamicValue {
  constructor(dv, projection) {
    super();
    this._other = dv;
    this._projection = projection;
    this._inner = null;
    this._hasRequestedValue = false;
    this._requestedValue = null;
  }

  _subscribe() {
    let inner_sub = null;

    const outer_sub = this._other.subscribe((x) => {
      const projection = this._projection;

      const inner = projection(x);

      // nothing to do
      if (inner === this._inner) return;

      this._inner = inner;

      if (inner_sub !== null) {
        inner_sub();
        inner_sub = null;
      }

      if (inner === null) return;

      inner_sub = inner.subscribe((val) => {
        this._updateValue(val);
      });

      if (this._hasRequestedValue) {
        this._hasRequestedValue = false;
        inner.set(this._requestedValue);
        this._requestedValue = null;
      }
    });

    return () => {
      outer_sub();

      if (inner_sub !== null) {
        inner_sub();
        inner_sub = null;
      }
    };
  }

  set(x) {
    const inner = this._inner;

    if (inner) {
      inner.set(x);
    } else {
      this._hasRequestedValue = true;
      this._requestedValue = x;
    }
  }
}

/**
 * switchMap can be used to between different DynamicValues based on the value
 * emitted from another DynamicValue.
 *
 * @param {DynamicValue} dv
 * @param {function(*): DynamicValue} projection
 *      This function is called for each value emitted by the input
 *      DynamicValue. The DynamicValue returned will then be subscribed to. If
 *      the projection function returned `null`, the value is ignored.
 * @return {DynamicValue}
 */
export function switchMap(dv, projection) {
  if (!(dv instanceof DynamicValue))
    throw new TypeError('Expected DynamicValue.');

  if (projection === void 0) {
    projection = function (x) {
      return x;
    };
  } else if (typeof projection !== 'function') {
    throw new TypeError('Expected function.');
  }

  return new SwitchMapValue(dv, projection);
}

export function switchAll(dv) {
  return switchMap(dv);
}
