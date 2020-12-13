import { log } from '../utils/log.js';

/**
 * Component base class for all AWML components.
 */
export class BaseComponent extends HTMLElement {
  /** @ignore */
  static get observedAttributes() {
    return ['debug'];
  }

  constructor() {
    super();
    /**
     * If true, this component will output warnings
     * and log messages to the developer console. Useful for debugging. This
     * property is available as the `debug` attribute.
     * @type {boolean}
     */
    this.debug = false;
    this._subscription = null;

    /*
     * This property is true if the connectedCallback() has run
     * while this.isConnected was true.
     */
    this._connected = false;
  }

  /**
   * @protected
   */
  log(fmt, ...args) {
    if (!this.debug) return;
    log('%o ' + fmt, this.tagName, ...args);
  }

  /** @ignore */
  connectedCallback() {
    this.style.display = 'none';

    if (!this.isConnected) return;
    this._connected = true;

    // we only want to subscribe here if we are not yet subscribed
    // and if we are connected to the dom
    if (this._subscription === null) {
      this._subscription = this._subscribe();
    }
  }

  /** @ignore */
  _unsubscribe() {
    const sub = this._subscription;
    this._subscription = null;
    if (sub) sub();
  }

  /** @ignore */
  _resubscribe() {
    this._unsubscribe();
    if (!this.isConnected || !this._connected) return;
    this._subscription = this._subscribe();
  }

  /** @ignore */
  _subscribe() {
    throw new Error('Not implemented.');
  }

  /** @ignore */
  disconnectedCallback() {
    this._connected = false;
    this._unsubscribe();
  }

  /** @ignore */
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'debug') {
      this.debug = newValue !== null;
    }
  }
}
