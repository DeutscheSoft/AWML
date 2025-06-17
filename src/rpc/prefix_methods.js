export function prefixMethods(methods, prefix) {
  if (prefix === '') return methods;

  const result = {};

  for (const name in methods) {
    result[`${prefix}${name}`] = methods[name];
  }

  return result;
}
