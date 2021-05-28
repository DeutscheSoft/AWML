import { DOMTemplate } from '../utils/dom_template.js';
import { warn } from '../utils/log.js';
import { bindingFromComponent } from '../utils/aux-support.js';
import { fromSubscription } from '../operators/from_subscription.js';
import { registerPrefixTagName } from '../utils/prefix.js';
import { Bindings } from '../bindings.js';

let redrawQueue = [];
let oldQueue = [];

function redraw() {
  const q = redrawQueue;
  redrawQueue = oldQueue;
  oldQueue = q;

  q.forEach((cb) => {
    try {
      cb();
    } catch (err) {
      warn('redraw callback generated an exception.', err);
    }
  });
  q.length = 0;
}

function requestRedraw(cb) {
  redrawQueue.push(cb);

  if (redrawQueue.length === 1) {
    requestAnimationFrame(redraw);
  }
}

function bindingFromProperty(component, name, options) {
  let recurse = false;

  const subscribeFun = !options.writeonly
    ? function (cb) {
        cb(component[name]);
        return component.subscribeEvent(name + 'Changed', (value) => {
          if (recurse) return;
          cb(value);
        });
      }
    : null;

  const setFun = !options.readonly
    ? function (value) {
        if (recurse) return;
        recurse = true;
        try {
          component[name] = value;
        } catch (err) {
          throw err;
        } finally {
          recurse = false;
        }
      }
    : null;

  return fromSubscription(subscribeFun, setFun);
}

/**
 * TemplateComponent is a base class for components using DOM templates.
 */
export class TemplateComponent extends HTMLElement {
  getHostBindings() {
    return this.constructor.getHostBindings();
  }

  static getHostBindings() {
    return null;
  }

  /**
   * Reinitializes host bindings from getHostBindings().
   */
  updateHostBindings() {
    const bindings = this._hostBindings;

    if (bindings) {
      bindings.dispose();
      this._hostBindings = null;
    }

    if (!this.isConnected) return;

    const hostBindings = this.getHostBindings();

    if (hostBindings) {
      this._hostBindings = new Bindings(this);
      this._hostBindings.update(hostBindings);
    }
  }

  /**
   * @params {DOMTemplate} [template]
   */
  constructor(template) {
    super();
    this._template = template.clone();
    this._attached = false;
    this._redrawRequested = false;
    this._needsRedraw = true;
    this._redraw = () => {
      this._redrawRequested = false;
      if (!this.isConnected) return;
      this.redraw();
      this._needsRedraw = false;
      this.emit('redraw');
    };
    this._whenAttached = null;
    this._eventHandlers = null;
    this._hostBindings = null;

    if (template.requiresPrefix) registerPrefixTagName(this.tagName);
  }

  /**
   * @internal
   */
  connectedCallback() {
    if (!this.isConnected) return;
    if (!this._attached) {
      this._attached = true;
      this.appendChild(this._template.fragment);

      this.emit('attached');
    }

    if (this._needsRedraw) this.triggerRedraw();

    this._template.connectedCallback();

    const hostBindings = this.getHostBindings();

    if (hostBindings) {
      this._hostBindings = new Bindings(this);
      this._hostBindings.update(hostBindings);
    }
  }

  /**
   * @internal
   */
  disconnectedCallback() {
    this._template.disconnectedCallback();

    const bindings = this._hostBindings;

    if (bindings) {
      bindings.dispose();
      this._hostBindings = null;
    }
  }

  /**
   * @internal
   */
  _updatePrefix(handle) {
    if (!this.isConnected) return;
    this._template._updatePrefix(handle);

    const hostBindings = this._hostBindings;

    if (hostBindings)
      hostBindings.updatePrefix(handle);
  }

  /**
   * Returns a promise which resolves when the DOM template has been attached.
   *
   * @returns {Promise}
   */
  whenAttached() {
    return new Promise((resolve) => {
      if (this._attached) {
        resolve();
      } else {
        let unsubscribe;
        unsubscribe = this.subscribeEvent('attached', () => {
          resolve();
          unsubscribe();
        });
      }
    });
  }

  /**
   * Returns a promise which resolves when the DOM template has been redrawn.
   *
   * @returns {Promise}
   */
  whenRedrawn() {
    return new Promise((resolve) => {
      let unsubscribe;
      unsubscribe = this.subscribeEvent('redraw', () => {
        resolve();
        unsubscribe();
      });
    });
  }

  /**
   * Subscribe to the given event.
   *
   * @param {string} name
   *    The event name.
   * @param {Function} cb
   *    The event handler.
   */
  subscribeEvent(name, cb) {
    if (typeof name !== 'string') throw new TypeError('Expected string.');

    if (typeof cb !== 'function') throw new TypeError('Expected function.');

    let subscribers = this._eventHandlers;

    if (subscribers === null) {
      this._eventHandlers = subscribers = new Map();
    }

    let q = subscribers.get(name);

    if (!q) {
      subscribers.set(name, (q = [cb]));
    } else {
      if (q.indexOf(cb) !== -1) throw new Error('Already subscribed.');
      q.push(cb);
    }

    return () => {
      if (cb === null) return;
      const subscribers = this._eventHandlers;
      const q = subscribers.get(name).filter((_cb) => _cb !== cb);

      if (q.length) {
        subscribers.set(name, q);
      } else {
        subscribers.delete(name);
      }

      cb = null;
    };
  }

  observeProperty(name, cb) {
    cb(this[name]);
    return this.subscribeEvent(name + 'Changed', cb);
  }

  /**
   * Emits an event. See subscribeEvent().
   */
  emit(name, ev) {
    const subscribers = this._eventHandlers;

    if (subscribers === null) return;

    const q = subscribers.get(name);

    if (!q) return;

    for (let i = 0; i < q.length; i++) {
      const cb = q[i];
      try {
        cb(ev);
      } catch (err) {
        warn(err);
      }
    }
  }

  triggerRedraw() {
    if (this._needsRedraw && this._redrawRequested) return;
    this._needsRedraw = true;
    if (!this.isConnected) return;
    this._redrawRequested = true;
    requestRedraw(this._redraw);
  }

  /**
   * Mark a certain property as changed and (if necessary) trigger
   * redraw() to be called in the next rendering frame.
   *
   * @param {string} propertyName
   *    The name of the property which changed.
   */
  triggerUpdate(propertyName) {
    this.triggerRedraw();
  }

  /**
   * Called in a rendering frame and updates the DOM.
   */
  redraw() {
    this._template.update(this);
  }

  /**
   * Internal method called when a binding is created. This is used by
   * BindOption to create binding with template components.
   *
   * @param {string} name
   *    The binding name.
   * @param {Object} options
   *    The binding options. See bindingFromComponent for option values.
   * @returns {DynamicValue}
   *    Returns a dynamic value which represents the given binding.
   */
  awmlCreateBinding(name, options) {
    if (!this._attached) return this.whenAttached();

    const template = this._template;

    const alias = template.optionReferences.get(name);

    if (alias) return bindingFromComponent(alias[0], alias[1], options);

    const dependencies = this.constructor.dynamicProperties;

    if (dependencies.includes(name)) {
      if (options.preventDefault)
        throw new Error(
          'preventDefault is not supported for template reference bindings.'
        );

      if (!options.sync)
        throw new Error('sync is required for for template property bindings.');

      return bindingFromProperty(this, name, options);
    }

    const pos = name.indexOf('.');

    if (pos !== -1) {
      const references = this._template.references;
      const childName = name.substr(0, pos);

      if (references.has(childName)) {
        return bindingFromComponent(
          references.get(childName),
          name.substr(pos + 1),
          options
        );
      }
    }

    throw new Error('No such option in component: ' + name);
  }

  /**
   * Creates a component class from a template string.
   *
   * @param {string|object} input
   *    The template string.
   * @returns {class}
   *    A subclass of TemplateComponent which - when instantiated - will
   *    clone the template.
   */
  static fromString(input) {
    return this.create({
      template: input,
    });
  }

  /**
   * Creates a template component from a set of options.
   * @param {object} options
   * @param {string|DOMTemplate} options.template
   *    The template.
   * @param {string[]} [options.properties]
   *    An optional list of property names. They are added
   *    to the list of properties referenced from the template itself.
   * @param {string[]} [options.ignoreProperties]
   *    An optional list of property names which should not automatically
   *    create dynamic properties.
   * @returns {class}
   *    A subclass of TemplateComponent which - when instantiated - will
   *    clone the template.
   */
  static create(options) {
    let template;

    if (typeof options.template === 'string') {
      template = DOMTemplate.fromString(options.template);
    } else {
      template = options.template;
      if (typeof template !== 'object' || !(template instanceof DOMTemplate))
        throw new TypeError('Expected a DOMTemplate instance or a string.');
    }

    const referenceNames = Array.from(template.references.keys());

    // Remove trailing $
    let dependencies = template.dependencies;

    dependencies = dependencies
      .map((name) => {
        if (name.endsWith('$')) name = name.slice(0, name.length - 1);

        return name;
      })
      .filter((name, index, a) => name.length && a.indexOf(name) === index);

    if (Array.isArray(options.ignoreProperties)) {
      dependencies = dependencies.filter((name) => {
        return !options.ignoreProperties.includes(name);
      });
    }

    if (Array.isArray(options.properties)) {
      dependencies = dependencies
        .concat(options.properties)
        .filter(
          (entry, i, a) => typeof entry === 'string' && a.indexOf(entry) === i
        );
    }

    dependencies = dependencies.filter((name) => {
      return !referenceNames.includes(name);
    });

    const component = class extends TemplateComponent {
      constructor() {
        super(template);

        const tpl = this._template;

        if (referenceNames.length) {
          const references = tpl.references;

          for (let i = 0; i < referenceNames.length; i++) {
            const name = referenceNames[i];

            this['_' + name] = references.get(name);
          }
        }

        dependencies.forEach((name) => {
          if (referenceNames.includes(name)) return;
          this['_' + name] = void 0;
        });
      }

      static get dynamicProperties() {
        return dependencies;
      }
    };

    referenceNames.forEach((name) => {
      const privName = '_' + name;

      Object.defineProperty(component.prototype, name, {
        enumerable: true,
        get: function () {
          return this[privName];
        },
      });
    });

    dependencies.forEach((name) => {
      const privName = '_' + name;
      const evName = name + 'Changed';
      Object.defineProperty(component.prototype, name, {
        enumerable: true,
        get: function () {
          return this[privName];
        },
        set: function (value) {
          this[privName] = value;
          this.triggerUpdate(name);
          this.emit(evName, value);
        },
      });
      Object.defineProperty(component.prototype, name + '$', {
        enumerable: true,
        get: function () {
          return bindingFromProperty(this, name, {});
        },
      });
    });

    return component;
  }
}
