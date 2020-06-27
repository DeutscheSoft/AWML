import { error } from './log.js';

/** @ignore */
export function isCustomElement(node) {
  return node.tagName.includes('-');
}

/** @ignore */
export function maybeAuxElement(node) {
  if (!isCustomElement(node)) return false;

  return (
    node.auxWidget !== void 0 || !customElements.get(node.tagName.toLowerCase())
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
