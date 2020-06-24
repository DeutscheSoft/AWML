import { BaseComponent } from './base.js';
import { collectPrefix, registerPrefixTagName } from '../utils/prefix.js';
import { getBackendValue } from '../backends.js';
import { parseAttribute } from '../utils/parse_attribute.js';
import { ListValue } from '../list_value.js';

/**
 * Base class for components which can bind to backend values using an address.
 */
export class PrefixComponentBase extends BaseComponent {
  static get observedAttributes() {
    return BaseComponent.observedAttributes.concat([
      'debounce',
      'partial',
      'pipe',
      'src-prefix',
      'src',
      'transform-receive',
      'transform-src',
    ]);
  }

  /**
   * Returns the current prefix of this element.
   */
  get currentPrefix() {
    let prefix = this._currentPrefix;

    if (prefix === null)
      this._currentPrefix = prefix = collectPrefix(this, this._srcPrefix);

    return prefix;
  }

  /**
   * Number of milliseconds to debounce incoming values. This currently only
   * works with ListValue sources.
   */
  get debounce() {
    return this._debounce;
  }
  set debounce(v) {
    if (typeof v !== 'number' || !(v >= 0))
      throw new TypeError('Expected non-negative number.');
    this._debounce = v;

    const backendValue = this._backendValue;

    if (backendValue !== null && backendValue instanceof ListValue)
      backendValue.debounce = v;
  }

  /**
   * If true, partial values are received from a ListValue source.
   */
  get partial() {
    return this._partial;
  }
  set partial(v) {
    if (typeof v !== 'boolean') throw new TypeError('Expected boolean.');
    this._partial = v;

    const backendValue = this._backendValue;

    if (backendValue !== null && backendValue instanceof ListValue)
      backendValue.partial = v;
  }

  /**
   * A function which is called before subscribing to a DynamicValue. It can be
   * used to transform the DynamicValue, e.g. by using an operator. If null, no
   * transformation happens.
   *
   * @return {function(dv: DynamicValue):DynamicValue}
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
   * bind to this property. The source address is combined with `prefix`
   * attributes on this component and all it's DOM parents into the final
   * address. This property can be set using the `src` attribute.
   * @type {?string}
   */
  get src() {
    return this._src;
  }
  set src(v) {
    if (typeof v !== 'string' && v !== null)
      throw new TypeError('Expected string.');

    this._src = v;
    this._resubscribe();
  }

  /**
   * The source address prefix to use for
   * the `src` property in this component. If `null`, the default prefix will
   * be used, which corresponds to the `prefix` attribute. If not null, the
   * source address will instead be constructed using the
   * `prefix-<srcPrefix>` attribute. This feature can be used to connect
   * bind components to different backend parameter trees. This property can
   * be set using the `src-prefix` atttribute.
   *
   * @type {?string}
   */
  get srcPrefix() {
    return this._srcPrefix;
  }
  set srcPrefix(v) {
    if (typeof v !== 'string' && v !== null)
      throw new TypeError('Expected string.');

    this._srcPrefix = v;
    this._resubscribe();
  }

  /**
   * Transformation function for backend values.
   * This function is called in the context of this component for every value
   * received from the backend. This property can be set using the
   * `transform-receive` attribute.
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
   * Transformation function for the source
   * address. This function is called in the context of this component
   * once before a source address is subscribed to.
   * This property can be set using the `transform-src` attribute.
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

  constructor() {
    super();
    this._srcPrefix = null;
    this._src = null;
    this._transformReceive = null;
    this._currentPrefix = null;
    this._transformSrc = null;
    this._backendValue = null;
    this._debounce = 0;
    this._partial = false;
    this._pipe = null;

    // it would be enough to do this once
    registerPrefixTagName(this.tagName);
  }

  _getBackendValue() {
    let src = this._src;

    if (src === null) return null;

    if (src.includes(',')) {
      const a = src.split(',');
      let prefix = null;

      for (let i = 0; i < a.length; i++) {
        const tmp = a[i];

        if (tmp.includes(':')) continue;

        if (prefix === null) {
          prefix = this.currentPrefix;

          if (!prefix.includes(':')) return null;
        }

        a[i] = prefix + tmp;
      }

      src = a;
    } else {
      if (!src.includes(':')) {
        const prefix = this.currentPrefix;

        if (!prefix.includes(':')) return null;

        src = prefix + src;
      }
    }

    if (this.transformSrc !== null) {
      src = this.transformSrc(src);
    }

    this.log('Subscribing to %o', src);

    let dv;

    if (typeof src === 'string') {
      dv = getBackendValue(src);
    } else {
      dv = new ListValue(
        src.map(getBackendValue),
        this._partial,
        this._debounce
      );
    }

    if (this._pipe !== null) {
      dv = this._pipe(dv);
    }

    return dv;
  }

  _subscribe() {
    const backendValue = this._getBackendValue();

    if (backendValue === null) return null;

    this._backendValue = backendValue;

    const subs = backendValue.subscribe((value) => {
      const transformReceive = this._transformReceive;

      if (transformReceive !== null) {
        value = transformReceive.call(this._backendValue, value, this);
      }

      this.log('Received value %o', value);

      this._valueReceived(value);
    });

    return () => {
      if (this._backendValue === null) return;
      this._backendValue = null;
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
    if (handle !== this._srcPrefix) return;
    this._currentPrefix = null;
    this._resubscribe();
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
      case 'src':
        this.src = newValue;
        break;
      case 'src-prefix':
        this.srcPrefix = newValue;
        break;
      case 'transform-receive':
        this.transformReceive = parseAttribute('javascript', newValue, null);
        break;
      case 'transform-src':
        this.transformSrc = parseAttribute('javascript', newValue, null);
        break;
      default:
        super.attributeChangedCallback(name, oldValue, newValue);
    }
  }
}
