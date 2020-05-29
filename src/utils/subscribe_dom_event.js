/**
 * Subscribes to a DOM event.
 */
export function subscribeDOMEvent(node, name, callback) {
  // make unique
  const cb = (...args) => callback(...args);

  node.addEventListener(name, cb);

  return () => {
    if (node === null) return;
    node.removeEventListener(name, cb);
    node = null;
  };
}
