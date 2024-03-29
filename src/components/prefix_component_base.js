import { BaseComponent } from './base_component.js';
import {
  collectPrefix,
  registerPrefixTagName,
  compileSrc,
} from '../utils/prefix.js';
import { getBackendValue } from '../backends.js';
import { parseAttribute } from '../utils/parse_attribute.js';
import { ListValue } from '../list_value.js';

function srcEqual(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }

    return true;
  }

  return a === b;
}

/**
 * Base class for components which can bind to backend values using an address.
 */
export class PrefixComponentBase extends BaseComponent {
  static get observedAttributes() {
    return BaseComponent.observedAttributes.concat([
      'debounce',
      'partial',
      'pipe',
      'no-replay',
      'src-prefix',
      'src',
      'transform-receive',
      'transform-send',
      'transform-src',
    ]);
  }

  /**
   * Returns the current prefix of this element.
   */
  get currentPrefix() {
    if (!this.isConnected) return null;

    let prefix = this._currentPrefix;

    if (prefix === null) {
      const srcPrefix = this._srcPrefix;

      if (Array.isArray(srcPrefix)) {
        prefix = srcPrefix.map((handle) => collectPrefix(this, handle));
      } else {
        prefix = collectPrefix(this, srcPrefix);
      }

      this._currentPrefix = prefix;
    }

    return prefix;
  }

  /**
   * Number of milliseconds to debounce incoming values. This currently only
   * works with ListValue sources. This property can also be set using the
   * ``debounce`` attribute.
   *
   * @type number
   */
  get debounce() {
    return this._debounce;
  }
  set debounce(v) {
    if (typeof v !== 'number' || !(v >= 0))
      throw new TypeError('Expected non-negative number.');
    if (this._debounce === v) return;
    this._debounce = v;
    this._resubscribe();
  }

  /**
   * If true, partial values are received from a ListValue source. This property
   * can also be set using the ``partial`` attribute.
   *
   * @type boolean
   */
  get partial() {
    return this._partial;
  }
  set partial(v) {
    if (typeof v !== 'boolean') throw new TypeError('Expected boolean.');
    if (this._partial === v) return;
    this._partial = v;
    this._resubscribe();
  }

  /**
   * A function which is called before subscribing to a DynamicValue. It can be
   * used to transform the DynamicValue, e.g. by using an operator. If null, no
   * transformation happens. This propert can also be set using the ``pipe``
   * attribute. See :ref:`dynamic-value-operators` for a list of supported
   * operators.
   *
   * @return {function(DynamicValue):DynamicValue}
   */
  get pipe() {
    return this._pipe;
  }
  set pipe(v) {
    if (v !== null && typeof v !== 'function')
      throw new TypeError('Expected function.');
    this._pipe = v;
    this._resubscribe();
  }

  /**
   * The source address of the backend value to
   * bind to this property. The source address is combined with ``prefix``
   * attributes on this component and all it's DOM parents into the final
   * address. This property can be set using the ``src`` attribute.
   * @type {?string}
   */
  get src() {
    return this._src;
  }
  set src(v) {
    if (typeof v !== 'string' && v !== null)
      throw new TypeError('Expected string.');

    this._src = v;
    this._updateEffectiveSrc();
  }

  /**
   * The source address prefix to use for
   * the ``src`` property in this component. If ``null``, the default prefix will
   * be used, which corresponds to the ``prefix`` attribute. If not null, the
   * source address will instead be constructed using the
   * ``prefix-<srcPrefix>`` attribute. This feature can be used to connect
   * bind components to different backend parameter trees. This property can
   * be set using the ``src-prefix`` atttribute.
   *
   * @type {?string}
   */
  get srcPrefix() {
    return this._srcPrefix;
  }
  set srcPrefix(v) {
    if (typeof v !== 'string' && v !== null && !Array.isArray(v))
      throw new TypeError('Expected string|string[].');

    this._srcPrefix = v;
    this._currentPrefix = null;
    this._updateEffectiveSrc();
  }

  /**
   * Transformation function for receiving backend values.
   * This function is called in the context of this component for every value
   * received from the backend. This property can also be set using the
   * ``transform-receive`` attribute.
   * @type {?function}
   */
  get transformReceive() {
    return this._transformReceive;
  }
  set transformReceive(v) {
    if (typeof v !== 'function' && v !== null)
      throw new TypeError('Expected function.');
    this._transformReceive = v;
    this._resubscribe();
  }

  /**
   * Transformation function for backend values.
   * This function is called in the context of this component for every value
   * sent to the backend. This property can also be set using the
   * ``transform-send`` attribute.
   * @type {?function}
   */
  get transformSend() {
    return this._transformSend;
  }
  set transformSend(v) {
    if (typeof v !== 'function' && v !== null)
      throw new TypeError('Expected function.');
    this._transformSend = v;
    this._resubscribe();
  }

  /**
   * Transformation function for the source
   * address. This function is called in the context of this component
   * once before a source address is subscribed to.
   * This property can also be set using the ``transform-src`` attribute.
   * @type {?function}
   */
  get transformSrc() {
    return this._transformSrc;
  }
  set transformSrc(v) {
    if (typeof v !== 'function' && v !== null)
      throw new TypeError('Expected function.');
    this._transformSrc = v;
    this._resubscribe();
  }

  /**
   * Determines the value of the second argument to ``subscribe()`` on the
   * backend value. If false, the current cached value will not be emitted.
   * This property can also be set using the ``no-replay`` attribute. Defaults to
   * ``true``.
   *
   * @type {boolean}
   */
  get replay() {
    return this._replay;
  }
  set replay(v) {
    this._replay = v === void 0 || !!v;
    if (this._replay) this._resubscribe();
  }

  /**
   * Directly sets the dynamic value.
   */
  set backendValue(bv) {
    if (this._backendValue === bv) return;
    this._backendValue = bv;
    this._resubscribe();
  }

  get backendValue() {
    return this._backendValue;
  }

  constructor() {
    super();
    this._srcPrefix = null;
    this._src = null;
    this._transformReceive = null;
    this._transformSend = null;
    this._currentPrefix = null;
    this._transformSrc = null;
    this._backendValue = null;
    this._debounce = 0;
    this._partial = false;
    this._pipe = null;
    this._replay = true;
    this._effectiveSrc = null;

    // it would be enough to do this once
    registerPrefixTagName(this.tagName);
  }

  _compileSrc(src) {
    try {
      if (typeof src === 'string' && src.includes(',')) src = src.split(',');
      return compileSrc(src, () => this.currentPrefix);
    } catch (err) {
      this.log(err.toString());
      return null;
    }
  }

  get effectiveSrc() {
    if (!this.isConnected) return null;
    if (this._effectiveSrc !== null) return this._effectiveSrc;

    const src = this._compileSrc(this._src);

    this.log('Source is %o', src);

    this._effectiveSrc = src;

    return src;
  }

  _updateEffectiveSrc() {
    const last = this._effectiveSrc;
    this._effectiveSrc = null;
    const effectiveSrc = this.effectiveSrc;
    if (srcEqual(last, effectiveSrc)) return;
    this._resubscribe();
  }

  _getBackendValue() {
    let dv = this._backendValue;

    if (dv === null) {
      let src = this.effectiveSrc;

      if (src === null) return null;

      if (this.transformSrc !== null) {
        src = this.transformSrc(src);
      }

      if (src === null) return null;

      this.log('Subscribing to %o', src);

      if (typeof src === 'string') {
        dv = getBackendValue(src);
      } else {
        dv = new ListValue(
          src.map(getBackendValue),
          this._partial,
          this._debounce
        );
      }
    }

    if (this._pipe !== null) {
      dv = this._pipe(dv);
    }

    return dv;
  }

  _subscribe() {
    let backendValue = this._getBackendValue();

    if (backendValue === null) return null;

    const subs = backendValue.subscribe((value) => {
      const transformReceive = this._transformReceive;

      if (transformReceive !== null) {
        const tmp = transformReceive.call(backendValue, value, this);
        this.log('Received value %o -> %o', value, tmp);
        value = tmp;
      } else {
        this.log('Received value %o', value);
      }

      this._valueReceived(value);
    });

    return () => {
      if (backendValue === null) return;
      backendValue = null;
      subs();
    };
  }

  /**
   * Internal API method which is called with every values received from the
   * backend.
   * @protected
   */
  _valueReceived(value) {
    // this should be overloaded by subclasses
    throw new Error('Not implemented.');
  }

  _updatePrefix(handle) {
    const srcPrefix = this._srcPrefix;

    if (Array.isArray(srcPrefix)) {
      if (!srcPrefix.includes(handle)) return;
    } else if (handle !== srcPrefix) return;

    this._currentPrefix = null;
    this._updateEffectiveSrc();
  }

  /** @ignore */
  disconnectedCallback() {
    super.disconnectedCallback();
    this._currentPrefix = null;
  }

  /** @ignore */
  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case 'debounce':
        this.debounce = parseAttribute('number', newValue, 0);
        break;
      case 'partial':
        this.partial = newValue !== null;
        break;
      case 'pipe':
        this.pipe = parseAttribute('javascript', newValue, null);
        break;
      case 'no-replay':
        this.replay = newValue === null;
        break;
      case 'src':
        this.src = newValue;
        break;
      case 'src-prefix':
        {
          if (newValue.includes(',')) {
            newValue = newValue.split(',').map((s) => (s === '' ? null : s));
          }
          this.srcPrefix = newValue;
        }
        break;
      case 'transform-receive':
        this.transformReceive = parseAttribute('javascript', newValue, null);
        break;
      case 'transform-send':
        this.transformSend = parseAttribute('javascript', newValue, null);
        break;
      case 'transform-src':
        this.transformSrc = parseAttribute('javascript', newValue, null);
        break;
      default:
        super.attributeChangedCallback(name, oldValue, newValue);
    }
  }
}
