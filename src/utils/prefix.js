/**
 * Calculate the prefix of the given node for the given handle. The prefix
 * is the concatenation of the `"prefix"` attribute of this node and all its
 * parent nodes. This collection terminates early either
 * - if a prefix attribute has the value `":noprefix:"` which results in an empty
 *   prefix, or
 * - if a prefix contains a `":"` at which point the prefix is complete.
 *
 * @param node {Node} - The DOM node.
 * @param [handle] {string} - The handle name. If given, instead of the
 * `"prefix"` attribute, the attribute `"prefix-" + handle` is used.
 */
export function collectPrefix(node, handle) {
  const attributeName = handle && handle.length ? 'prefix-' + handle : 'prefix';
  const prefix = [];

  for (; node && node.getAttribute; node = node.parentNode) {
    const attributeValue = node.getAttribute(attributeName);
    if (attributeValue === null) continue;
    if (attributeValue === ':noprefix:') return '';
    prefix.push(attributeValue);
    if (attributeValue.includes(':')) break;
  }

  return prefix.reverse().join('');
}

const prefixTags = new Set();
let prefixTagSelector = '';

/** @ignore */
export function registerPrefixTagName(tagName) {
  if (prefixTags.has(tagName)) return;
  prefixTags.add(tagName);
  prefixTagSelector = Array.from(prefixTags).join(',');
}

/**
 * Tell a node and all its children to recalculate their prefixes.
 *
 * @param node {Node} - The DOM node.
 * @param [handle] {string} - The handle name.
 */
export function triggerUpdatePrefix(node, handle) {
  if (node._updatePrefix) node._updatePrefix(handle);

  const list = node.querySelectorAll(prefixTagSelector);

  for (let i = 0; i < list.length; i++) {
    const node = list.item(i);
    if (node._updatePrefix) node._updatePrefix(handle);
  }
}

/**
 * Update the prefix of a node.
 *
 * @param node {Node} - The DOM node.
 * @param prefix {string} - The prefix value.
 * @param [handle] {string} - The handle name.
 */
export function setPrefix(node, prefix, handle) {
  if (handle === void 0) {
    handle = null;
  } else if (typeof handle !== 'string') {
    throw new TypeError('Expected string.');
  }

  if (typeof prefix !== 'string') throw new TypeError('Expected string.');

  const attribute = handle === null ? 'prefix' : 'prefix-' + handle;

  if (node.getAttribute(attribute) === prefix) return;
  node.setAttribute(attribute, prefix);

  triggerUpdatePrefix(node, handle);
}

/**
 * Remove the prefix of a node.
 *
 * @param node {Node} - The DOM node.
 * @param [handle] {string} - The handle name.
 */
export function removePrefix(node, handle) {
  if (handle === void 0) {
    handle = null;
  } else if (typeof handle !== 'string') {
    throw new TypeError('Expected string.');
  }

  const attribute = handle === null ? 'prefix' : 'prefix-' + handle;

  if (!node.hasAttribute(attribute)) return;
  node.removeAttribute(attribute);

  triggerUpdatePrefix(node, handle);
}

/**
 * Block prefix collection at this node.
 *
 * @param node {Node} - The DOM node.
 * @param [handle] {string} - The handle name.
 */
export function setPrefixBlock(node, handle) {
  setPrefix(node, ':noprefix:', handle);
}
