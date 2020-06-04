import { log } from '../utils/log.js';

export class BaseComponent extends HTMLElement {
  static get observedAttributes() {
    return ['debug'];
  }

  constructor() {
    super();
    this.debug = false;
    this._subscription = null;
  }

  log(fmt, ...args) {
    if (!this.debug) return;
    log('%o ' + fmt, this, ...args);
  }

  connectedCallback() {
    this.style.display = 'none';

    // we only want to subscribe here if we are not yet subscribed
    // and if we are connected to the dom
    if (this.isConnected && this._subscription === null) {
      this._subscription = this._subscribe();
    }
  }

  _unsubscribe() {
    const sub = this._subscription;
    this._subscription = null;
    if (sub) sub();
  }

  _resubscribe() {
    this._unsubscribe();
    if (!this.isConnected) return;
    this._subscription = this._subscribe();
  }

  _subscribe() {
    throw new Error('Not implemented.');
  }

  disconnectedCallback() {
    this._unsubscribe();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'debug') {
      this.debug = newValue !== null;
    }
  }
}
