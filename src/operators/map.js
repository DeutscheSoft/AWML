import { DynamicValue } from '../dynamic_value.js';

class MappedValue extends DynamicValue {
  constructor(dv, f, inverse) {
    super();
    this._other = dv;
    this._transform = f;
    this._inverse = inverse;
  }

  _subscribe() {
    return this._other.subscribe((x) => {
      const transform = this._transform;

      this._updateValue(transform(x));
    });
  }

  set(x) {
    const inverse = this._inverse;

    if (inverse === null) throw new Error('map() without inverse transform.');

    const other = this._other;

    other.set(inverse(x));
  }
}

/**
 * Transform the input dynamic value and emits a new DynamicValue which emits
 * each value of the input transformed with `f`. If an inverse transform is also
 * given, calling `set(X)` on the resulting DynamicValue will use the inverse
 * transform and call `dv.set(inverse(X))`.
 *
 * @param {DynamicValue} dv
 * @param {function(*): *} transform
 *      Transformation function for values.
 * @param {function(*): *} [inverse]
 *      Optional inverse transformation function. It not specified, the
 *      resulting DynamicValue does not support `set()`.
 * @return {DynamicValue}
 */
export function map(dv, transform, inverse) {
  if (!(dv instanceof DynamicValue))
    throw new TypeError('Expected DynamicValue.');

  if (typeof transform !== 'function')
    throw new TypeError('Expected function.');

  if (inverse !== void 0 && typeof inverse !== 'function')
    throw new TypeError('Expected function.');

  return new MappedValue(dv, transform, inverse || null);
}

/**
 * Transform the input dynamic value and emit a new DynamicValue which emits the
 * accumulation of all values using the transform function.
 *
 * This is similar to Array.reduce().
 *
 * @param {DynamicValue} dv
 * @param {function(*, *): *} transform
 *      Transformation function. Is called with each value and the
 *      accumulator.
 * @param initialValue
 *      The initial value for the accumulator.
 */
export function reduce(dv, transform, initialValue) {
  return map(dv, (value) => {
    initialValue = transform(initialValue, value);
    return initialValue;
  });
}
