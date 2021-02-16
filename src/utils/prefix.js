/**
 * Calculate the prefix of the given node for the given handle. The prefix
 * is the concatenation of the ``"prefix"`` attribute of this node and all its
 * parent nodes. This collection terminates early either
 *
 * - if a prefix attribute has the value ``":noprefix:"`` which results in an empty
 *   prefix, or
 * - if a prefix contains a ``":"`` at which point the prefix is complete.
 *
 * @param {Node} node
 *   The DOM node.
 * @param {string} [handle]
 *   The handle name. If given, instead of the ``"prefix"`` attribute,
 *   the attribute ``"prefix-" + handle`` is used.
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

/**
 * Register the given tagName to be included in the list of components
 * to be notified when a prefix changes on a parent node.
 */
export function registerPrefixTagName(tagName) {
  if (prefixTags.has(tagName)) return;
  prefixTags.add(tagName);
  prefixTagSelector = Array.from(prefixTags).join(',');
}

/**
 * Tell a node and all its children to recalculate their prefixes.
 *
 * @param {Node} node
 *      The DOM node.
 * @param {string} [handle]
 *      The handle name.
 */
export function triggerUpdatePrefix(node, handle) {
  const selector = prefixTagSelector;

  if (node._updatePrefix) node._updatePrefix(handle);

  if (node._updatePrefix && node.matches(selector))
    node._updatePrefix(handle);

  const list = node.querySelectorAll(selector);

  for (let i = 0; i < list.length; i++) {
    const node = list.item(i);
    if (node._updatePrefix) node._updatePrefix(handle);
  }
}

/**
 * Update the prefix of a node.
 *
 * @param {Node} node
 *      The DOM node.
 * @param {string} prefix
 *      The prefix value.
 * @param {string|null} [handle]
 *      The handle name. If omitted defaults ot ``null`` for the
 *      default prefix handle.
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
 * @param {Node} node
 *      The DOM node.
 * @param {string} [handle]
 *      The handle name.
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
 * @param {Node} node
 *      The DOM node.
 * @param {string} [handle]
 *      The handle name.
 */
export function setPrefixBlock(node, handle) {
  setPrefix(node, ':noprefix:', handle);
}

export function compileSrc(src, getPrefix) {
  if (src === null) return null;

  if (typeof src === 'string') {
    if (src.includes(':')) return src;

    const prefix = getPrefix();

    if (Array.isArray(prefix))
      throw new TypeError('Expected prefix string for src string.');

    if (!prefix.includes(':')) return null;

    return prefix + src;
  }

  let prefix;

  const result = src.map((src, i) => {
    if (typeof src !== 'string')
      throw new TypeError('Expected src as string[].');

    if (src.includes(':')) return src;

    if (prefix === void 0) prefix = getPrefix();

    const tmp = Array.isArray(prefix) ? prefix[i] : prefix;

    if (typeof tmp !== 'string' || !tmp.includes(':')) return null;

    return tmp + src;
  });

  for (let i = 0; i < result.length; i++) if (result[i] === null) return null;

  return result;
}

/**
 * Print all prefixes available for this node to the console.
 *
 * @param {Node} node
 *      The DOM node.
 * @param {Node} match
 *      A regular expression or string to match the prefixes against.
 */
export function printPrefixes(node, match) {
  let prefixes = [];
  let chars = 0;
  const N = node;
  for (; node && node.attributes; node = node.parentNode) {
    const attrs = node.attributes;
    for (let i = 0; i < attrs.length; ++i) {
      const pmatch = attrs[i].name.match(/prefix[\-]?([a-zA-Z0-9_]*)$/);
      if (
        pmatch &&
        prefixes.indexOf(pmatch[1]) < 0 &&
        (!match || (match && pmatch[1].match(match)))
      ) {
        prefixes.push(pmatch[1]);
        chars = Math.max(chars, pmatch[1].length);
      }
    }
  }
  prefixes.sort((a, b) => a.localeCompare(b));
  for (let i = 0, m = prefixes.length; i < m; ++i) {
    const spaces = new Array(chars - prefixes[i].length + 1).join(' ');
    console.log(
      '%s%s : %c%s',
      prefixes[i],
      spaces,
      'color:#FFDE7A',
      collectPrefix(N, prefixes[i])
    );
  }
}
