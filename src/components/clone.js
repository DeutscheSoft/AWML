import { PrefixComponentBase } from './prefix_component_base.js';
import { parseAttribute } from '../utils/parse_attribute.js';
import { Subscriptions } from '../utils/subscriptions.js';
import { fetchText } from '../utils/fetch.js';
import { subscribeDOMEventOnce } from '../utils/subscribe_dom_event.js';

// this
const urlStack = [window.location.href];

function getBaseUrl() {
  return urlStack[urlStack.length - 1];
}

function pushUrl(url) {
  urlStack.push(url);
}

function popUrl() {
  urlStack.length--;
}

function withUrl(url, cb) {
  pushUrl(url);
  let result;

  try {
    result = cb();
  } catch (err) {
    throw err;
  } finally {
    popUrl();
  }

  return result;
}

function getUrl(path, baseUrl) {
  const base = new URL(baseUrl);

  return new URL(path, base).href;
}

class Template {
  constructor(node, url, deInline) {
    this.node = node;
    this.url = url;
    this._needsDeinline = typeof deInline === 'boolean' ? deInline : true;
    this._inlining = null;
    this._refs = 0;
    this._inlines = [];
  }

  getUrl(path) {
    const base = new URL(this.url);

    return new URL(path, base).href;
  }

  deinline(importScripts) {
    if (this._inlining !== null) return this._inlining;

    if (!this._needsDeinline) return Promise.resolve(this);

    this._needsDeinline = false;

    const fragment = this.node.content;

    const styles = fragment.querySelectorAll('link[rel=stylesheet]');

    const tasks = [];

    styles.forEach((style) => {
      style.href = this.getUrl(style.getAttribute('href'));
      document.head.appendChild(style);
      this._inlines.push(style);
      tasks.push(onLoad(style));
    });

    const templates = fragment.querySelectorAll('template');

    templates.forEach((template) => {
      document.head.appendChild(template);
      this._inlines.push(template);
    });

    const scripts = fragment.querySelectorAll('script');

    scripts.forEach((_script) => {
      _script.remove();

      if (!importScripts) return;

      const script = document.createElement('script');
      const attributes = _script.attributes;

      for (let i = 0; i < attributes.length; i++) {
        const name = attributes[i].name;
        let value = attributes[i].value;

        if (name === 'src') {
          value = this.getUrl(value);
          tasks.push(onLoad(script));
        }

        script.setAttribute(name, value);
      }
      script.textContent = _script.textContent;
      document.head.appendChild(script);
      this._inlines.push(script);
    });

    if (tasks.length) {
      this._inlining = Promise.all(tasks).then(() => {
        this._inlining = null;
        return this;
      });
      return this._inlining;
    }

    return Promise.resolve(this);
  }

  importNode() {
    const node = withUrl(this.url, () => {
      return document.importNode(this.node.content, true);
    });

    return node;
  }
}

function fetchTemplate(url) {
  // TODO: register loading
  return fetchText(url).then((text) => {
    const template = document.createElement('TEMPLATE');
    template.innerHTML = text;
    return new Template(template, url);
  });
}

const templateCache = new Map();

function fetchTemplateCached(url) {
  if (templateCache.has(url)) return templateCache.get(url);

  const p = fetchTemplate(url);

  templateCache.set(url, p);

  return p;
}

function onLoad(node) {
  return new Promise((resolve, reject) => {
    let errorsub, loadsub;

    errorsub = subscribeDOMEventOnce(node, 'error', (err) => {
      loadsub();
      reject(new Error('Failed to load inline.'));
    });

    loadsub = subscribeDOMEventOnce(node, 'load', () => {
      errorsub();
      resolve();
    });
  });
}

export class CloneComponent extends PrefixComponentBase {
  get template() {
    return this._template;
  }

  set template(v) {
    if (v !== null && typeof v !== 'string')
      throw new TypeError('Expected string.');
    this._template = v;
    this._resubscribe();
  }

  get fetch() {
    return this._fetch;
  }

  set fetch(v) {
    if (typeof v !== 'boolean') throw new TypeError('Expected boolean.');
    this._fetch = v;
    this._resubscribe();
  }

  get notemplate() {
    return this._notemplate;
  }

  set notemplate(v) {
    if (typeof v !== 'boolean') throw new TypeError('Expected boolean.');
    this._notemplate = v;
    this._resubscribe();
  }

  get nocache() {
    return this._nocache;
  }

  set nocache(v) {
    if (typeof v !== 'boolean') throw new TypeError('Expected boolean.');
    this._nocache = v;
  }

  get transformTemplate() {
    return this._transformTemplate;
  }

  set transformTemplate(v) {
    if (v !== null && typeof v !== 'function')
      throw new TypeError('Expected boolean.');
    this._transformTemplate = v;
    this._resubscribe();
  }

  get triggerResize() {
    return this._triggerResize;
  }

  set triggerResize(v) {
    if (typeof v !== 'boolean') throw new TypeError('Expected boolean.');
    this._triggerResize = v;
  }

  get importScripts() {
    return this._importScripts;
  }

  set importScripts(v) {
    if (typeof v !== 'boolean') throw new TypeError('Expected boolean.');
    this._importScripts = v;
  }

  _subscribe() {
    // there is actually no reason to try to subscribe here,
    // we already have the template we are going to load

    let subs = super._subscribe();

    // no source there, we can just load the template now if we know which
    // one it will be
    if (this._backendValue === null) {
      if (this.notemplate || this.template !== null) {
        // we know which template we want, let's load it
        this._reloadTemplate();
      } else {
        // nothing to do, no template and no backend value, let's try
        // again later when we have more information
        return null;
      }
    }

    return () => {
      if (subs !== null) {
        subs();
        subs = null;
      }
      const tsub = this._templateSubscription;
      if (tsub) {
        tsub();
        this._templateSubscription = null;
      }
      this._value = null;
    };
  }

  _valueReceived(v) {
    this._value = v;
    this._reloadTemplate();
  }

  _reloadTemplate() {
    // remove the old template
    const subs = this._templateSubscription;

    if (subs !== null) {
      subs();
    }

    this._templateSubscription = this._loadTemplate();
  }

  _getUrl(path) {
    const base = new URL(this._baseUrl);

    return new URL(path, base).href;
  }

  _fetchTemplate() {
    if (this.notemplate) {
      const templateNode = document.createElement('template');
      const template = new Template(templateNode, this._baseUrl, false);

      return Promise.resolve(template);
    } else {
      const path = this._value !== null ? this._value : this._template;

      if (typeof path !== 'string') return Promise.resolve(null);

      if (this.fetch) {
        const fetcher = this.nocache ? fetchTemplate : fetchTemplateCached;

        this.log('Fetching template %o', path);

        return fetcher(this._getUrl(path)).then((template) => {
          return template.deinline(this.importScripts);
        });
      } else {
        this.log('Finding template by id %o', path);
        const templateNode = document.getElementById(path);

        if (templateNode === null)
          return Promise.reject(new Error('Could not find template element.'));

        const template = new Template(
          templateNode,
          window.location.href,
          false
        );

        return Promise.resolve(template);
      }
    }
  }

  _loadTemplate() {
    let stop = false;
    let addedNodes = null;

    this._fetchTemplate()
      .then((template) => {
        if (stop) return;
        if (template !== null) {
          let node = template.importNode();

          if (this._transformTemplate) {
            const value = this._backendValue !== null ? this._backendValue.value : void 0;
            node = withUrl(this._baseUrl, () => {
              return this._transformTemplate(node, value);
            });
          }

          let length = this.childNodes.length;
          this.appendChild(node);

          addedNodes = Array.from(this.childNodes).slice(length);

          this.log('Cloned %d nodes.', addedNodes.length);
        } else {
          this.log('No template.');
        }

        this.dispatchEvent(new Event('load'));

        if (this._triggerResize) window.dispatchEvent(new UIEvent('resize'));
      })
      .catch((err) => {
        if (stop) return;
        this.log('Failed to load template: %o', err);
        this.dispatchEvent(
          new ErrorEvent('error', {
            message: err.toString(),
          })
        );
      });

    return () => {
      if (addedNodes) addedNodes.forEach((node) => node.remove());
      stop = true;
    };
  }

  constructor() {
    super();
    this._template = null;
    this._fetch = false;
    this._notemplate = false;
    this._nocache = false;
    this._transformTemplate = null;
    this._triggerResize = false;
    this._importScripts = false;
    this._baseUrl = getBaseUrl();
    this._templateElement = null;
    this._templateSubscription = null;
    this._value = null;
  }

  static get observedAttributes() {
    return PrefixComponentBase.observedAttributes.concat([
      'template',
      'fetch',
      'notemplate',
      'nocache',
      'transform-template',
      'trigger-resize',
      'import-scripts',
    ]);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case 'template':
        this.template = newValue;
        break;
      case 'fetch':
        this.fetch = newValue !== null;
        break;
      case 'notemplate':
        this.notemplate = newValue !== null;
        break;
      case 'nocache':
        this.nocache = newValue !== null;
        break;
      case 'transform-template':
        this.transformTemplate = parseAttribute('javascript', newValue, null);
        break;
      case 'trigger-resize':
        this.triggerResize = newValue !== null;
        break;
      case 'import-scripts':
        this.importScripts = newValue !== null;
        break;
      default:
        super.attributeChangedCallback(name, oldValue, newValue);
    }
  }

  connectedCallback() {
    super.connectedCallback();
    // FIXME: remove display: none from the base class
    this.style.removeProperty('display');
  }
}

customElements.define('awml-clone', CloneComponent);
