import { DynamicValue } from '../dynamic_value.js';
import { map } from './map.js';
import { unique } from './unique.js';
import { safeCall } from '../utils/safe_call.js';

class SwitchMapValue extends DynamicValue {
  constructor(dv, projection) {
    super();
    this._other = unique(map(dv, projection));
    this._inner = null;
  }

  _subscribe() {
    let inner_sub = null;

    const outer_sub = this._other.subscribe((inner) => {
      this._inner = inner;

      if (inner_sub !== null) {
        safeCall(inner_sub);
        inner_sub = null;
      }

      if (inner === null) return;

      inner_sub = inner.subscribe((val) => {
        this._updateValue(val);
      });
    });

    return () => {
      safeCall(outer_sub);

      if (inner_sub !== null) {
        safeCall(inner_sub);
        inner_sub = null;
      }
      this._inner = null;
    };
  }

  async set(x) {
    const inner = await this._other.wait();
    if (inner === null)
      throw new Error(`switchMap projection returned null. Cannot set().`);
    return inner.set(x);
  }
}

/**
 * switchMap can be used to switch between different DynamicValues based on the value
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
