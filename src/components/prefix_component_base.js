import { error } from '../utils/log.js';
import { BaseComponent } from './base.js';
import { collectPrefix, registerPrefixTagName } from '../utils/prefix.js';
import { getBackendValue } from '../backends.js';
import { parseAttribute } from '../utils/parse_attribute.js';

/**
 * Base class for components which can bind to backend values using an address.
 */
export class PrefixComponentBase extends BaseComponent {
  static get observedAttributes() {
    return BaseComponent.observedAttributes.concat([
      'src-prefix',
      'src',
      'transform-receive',
      'transform-src',
    ]);
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

    // it would be enough to do this once
    registerPrefixTagName(this.tagName);
  }

  _subscribe() {
    let src = this._src;

    if (src === null) return null;

    if (!src.includes(':')) {
      let prefix = this._currentPrefix;

      if (prefix === null) {
        this._currentPrefix = prefix = collectPrefix(this, this._srcPrefix);
      }

      if (!prefix.includes(':')) return null;

      src = prefix + src;
    }

    if (this.transformSrc !== null) {
      src = this.transformSrc(src);
    }

    this.log('Subscribing to %o', src);

    const backendValue = getBackendValue(src);

    this._backendValue = backendValue;

    const subs = backendValue.subscribe((value) => {
      const transformReceive = this._transformReceive;

      if (transformReceive !== null) {
        value = transformReceive.call(this._backendValue, value);
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
      case 'src-prefix':
        this.srcPrefix = newValue;
        break;
      case 'src':
        this.src = newValue;
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
