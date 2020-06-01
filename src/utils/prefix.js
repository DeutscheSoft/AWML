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

export function registerPrefixTagName(tagName) {
  if (prefixTags.has(tagName)) return;
  prefixTags.add(tagName);
  prefixTagSelector = Array.from(prefixTags).join(',');
}

export function updatePrefix(node, handle) {
  if (node._updatePrefix) node._updatePrefix(handle);

  const list = node.querySelectorAll(prefixTagSelector);

  for (let i = 0; i < list.length; i++) {
    const node = list.item(i);
    if (node._updatePrefix) node._updatePrefix(handle);
  }
}
