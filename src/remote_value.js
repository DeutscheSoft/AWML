import { DynamicValue } from './dynamic_value.js';

export class RemoteValue extends DynamicValue {
  constructor() {
    super();
    this._other = null;
    this._callback = (value) => {
      this._updateValue(value);
    };
  }

  _subscribe() {
    const _other = this._other;
    if (!_other) return null;
    return _other.subscribe(this._callback, true);
  }

  connect(other) {
    if (!(other instanceof DynamicValue))
      throw new Error(`Expected DynamicValue.`);
    if (this._other) throw new Error(`Already connected.`);

    this._other = other;

    if (this.isActive) this._activate();

    return () => {
      this._other = null;
      this.clear();
      this._deactivate();
    };
  }

  set(value) {
    if (!this._other) throw new Error(`Not connected.`);

    return this._other.set(value);
  }
}
