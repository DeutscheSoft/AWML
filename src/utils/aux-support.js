import { error } from './log.js';

/** @ignore */
export function isCustomElement(node) {
  return node.tagName.includes('-');
}

export function isCustomElementDefined(node) {
  const tagName = node.tagName;

  return tagName.includes('-') && customElements.get(tagName.toLowerCase());
}

/** @ignore */
export function maybeAuxElement(node) {
  return (
    node.auxWidget !== void 0 ||
    (isCustomElement(node) && !customElements.get(node.tagName.toLowerCase()))
  );
}

/** @ignore */
export function getAuxWidget(node) {
  const widget = node.auxWidget;

  if (widget) return widget;

  // this custom element is defined but does not have an
  // auxWidget property. This means that it is not an aux widget.
  if (customElements.get(node.tagName.toLowerCase())) {
    throw new TypeError('Expected an AUX widget.');
  }

  return null;
}

const _subscribers = new Map();

/**
 * Calls callback once when the corresponding Custom Element
 * has been defined.
 */
export function subscribeCustomElement(node, callback) {
  const name = node.tagName.toLowerCase();

  let subscribers = _subscribers.get(name);

  if (!subscribers) {
    _subscribers.set(name, (subscribers = new Set()));
    customElements.whenDefined(name).then(() => {
      _subscribers.delete(name);
      subscribers.forEach((cb) => {
        try {
          cb();
        } catch (err) {
          error('Subscriber generated an exception: %o', err);
        }
      });
    });
  }

  const cb = () => callback();

  subscribers.add(cb);

  return () => {
    subscribers.delete(cb);
  };
}

/**
 * @ignore
 */
export function triggerResize(node, levels) {
  if (!(levels >= 0)) levels = 0;

  let widget = null;

  while (node) {
    const w = node.auxWidget;

    if (w !== void 0) {
      widget = w;
      break;
    }

    node = node.parentNode;
  }

  for (let i = 0; widget && i < levels; i++) {
    widget = widget.parent;
  }

  if (widget) {
    widget.triggerResize();
  } else {
    window.dispatchEvent(new UIEvent('resize'));
  }
}

export function subscribeInteractionChange(widget, timeout, callback) {
  let state = widget.get('interacting');
  let tid;

  const call_out = (cb) => {
    if (!(timeout > 0)) {
      cb();
    } else {
      tid = setTimeout(cb, timeout);
    }
  };

  callback(state);

  const sub = widget.subscribe('set_interacting', (value) => {
    if (value || !(timeout > 0)) {
      if (state == value) return;
      callback((state = value));
    } else {
      if (tid !== void 0) clearTimeout(tid);

      state = value;

      tid = call_out(() => {
        tid = void 0;
        if (state) return;
        callback(state);
      });
    }
  });

  return () => {
    sub();
    if (tid !== void 0) {
      clearTimeout(tid);
      tid = void 0;
    }
  };
}

import { fromSubscription } from '../operators/from_subscription.js';

export function userInteractionFromWidget(widget, timeout) {
  if (timeout === void 0) timeout = 500;

  if (!(timeout >= 0))
    throw new TypeError('Expected timeout (non-negative number).');

  return fromSubscription((cb) => {
    return subscribeInteractionChange(widget, timeout, cb);
  });
}

function blockWhileInteracting(widget, subscribeReceive, setFun, delay) {
  let interacting = false;
  let hasValue = false;
  let lastValue = null;

  return [
    (cb) => {
      let sub1 = subscribeInteractionChange(widget, delay, (_interacting) => {
        interacting = _interacting;

        if (!interacting && hasValue) {
          hasValue = false;
          setFun(lastValue);
        }
      });

      if (!subscribeReceive) return sub1;

      let sub2 = subscribeReceive(cb);

      return () => {
        sub1();
        sub2();
      };
    },
    (value) => {
      if (interacting) {
        hasValue = true;
        lastValue = value;
      } else {
        hasValue = false;
        setFun(value);
      }
    },
  ];
}

/**
 * @param {Widget} widget
 *      The aux widget to bind to.
 * @param {String} name
 *      Name of the option to bind to.
 * @param {Object} [options={}]
 * @param {boolean} [options.ignoreInteraction=false]
 *      If false, values are being delayed while the widget is being
 *      interacted with.
 * @param {boolean} [options.preventDefault=false]
 *      If true, the default action of the change is being prevented.
 *      The meaning of this depends on the widget and the option bound to.
 * @param {boolean} [options.preventChange=false]
 *      If true, the ``userset`` event handler will be used. This implies
 *      ``options.preventDefault=true``.
 * @param {boolean} [options.sync=false]
 *      Emit modifications also if they are not triggered by user interaction.
 * @param {boolean} [options.readonly=false]
 *      Only emit option changes, do not allow setting the option using
 *      set(). The resulting dynamic value will be readonly.
 * @param {boolean} [options.writeonly=false]
 *      Do not emit any values, only allow setting the widget option using
 *      set().
 * @param {number} [options.receiveDelay=500]
 *      Delay values passed to set() for the given number of ms after
 *      the user interaction has ended.
 *
 * @returns {DynamicValue}
 *      Returns the dynamic value which represents this binding. Calling
 *      :class:`set() <DynamicValue>` on this value will set the option on the widget.
 *      Values emitted from this dynamic value represent changes of the option.
 */
export function bindingFromWidget(widget, name, options) {
  let setFun = null;
  let subscribeFun = null;

  if (!options) options = {};

  if (options.writeonly && options.readonly)
    throw new Error('Binding cannot be both write- and read-only.');

  if (!options.writeonly) {
    if (options.sync) {
      let rec = false;
      const eventName = 'set_' + name;
      const preventDefault = options.preventDefault;

      subscribeFun = function (cb) {
        const eventHandler = preventDefault
          ?  function (value) {
              if (rec) return;
              cb(value);
              return false;
            }
          : function (value) {
              if (rec) return;
              cb(value);
            };

        return widget.subscribe(eventName, eventHandler);
      };

      setFun = function (value) {
        if (rec) return;
        rec = true;
        try {
          widget.set(name, value);
        } catch (err) {
          throw err;
        } finally {
          rec = false;
        }
      };
    } else {
      const eventName = options.preventChange ? 'userset' : 'useraction';
      const preventDefault = options.preventChange || options.preventDefault;

      subscribeFun = function (cb) {
        const eventHandler = preventDefault
          ? function (_name, value) {
              if (_name !== name) return;
              cb(value);
              return false;
            }
          : function (_name, value) {
              if (_name !== name) return;
              cb(value);
            };
        return widget.subscribe(eventName, eventHandler);
      };
    }
  }

  if (!options.readonly && setFun === null) {
    setFun = function (value) {
      widget.set(name, value);
    };
  }

  if (!options.ignoreInteraction && setFun !== null) {
    [subscribeFun, setFun] = blockWhileInteracting(
      widget,
      subscribeFun,
      setFun,
      options.receiveDelay
    );
  }

  return fromSubscription(subscribeFun, setFun);
}

/**
 * @param {HTMLElement} node
 *      The component to bind to.
 * @param {String} name
 *      Name of the option or property to bind to.
 * @param {Object} [options={}]
 * @param {boolean} [options.ignoreInteraction=false]
 *      If false, values are being delayed while the widget is being
 *      interacted with.
 * @param {boolean} [options.preventDefault=false]
 *      If true, the default action of the change is being prevented.
 *      The meaning of this depends on the widget and the option bound to.
 * @param {boolean} [options.preventChange=false]
 *      If true, the event handler will attempt to prevent the change from
 *      taking place.
 * @param {boolean} [options.sync=false]
 *      Emit modifications also if they are not triggered by user interaction.
 * @param {boolean} [options.readonly=false]
 *      Only emit option changes, do not allow setting the option using
 *      set(). The resulting dynamic value will be readonly.
 * @param {boolean} [options.writeonly=false]
 *      Do not emit any values, only allow setting the widget option using
 *      set().
 * @param {number} [options.receiveDelay=500]
 *      Delay values passed to set() for the given number of ms after
 *      the user interaction has ended.
 *
 * @returns {DynamicValue}
 *      Returns the dynamic value which represents this binding.
 */
export function bindingFromComponent(node, name, options) {
  if (isCustomElementDefined(node)) {
    const widget = node.auxWidget;

    if (widget) return bindingFromWidget(widget, name, options);

    if (node.awmlCreateBinding) {
      return node.awmlCreateBinding(name, options);
    }
  } else {
    throw new Error('Cannot create binding with unsupported component.');
  }
}
