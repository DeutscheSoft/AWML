export function mergeMethods(...methods) {
  const result = {};

  methods.forEach((m) => {
    if (typeof m !== 'object') throw new TypeError('Expected object methods.');

    for (const key in m) {
      if (key in result)
        throw new Error(`Entry with key ${key} defined twice.`);
      result[key] = m[key];
    }
  });

  return result;
}
