export function rpcExportDynamicValues(values, key = '', readonly = false) {
  const methods = {};

  methods['_sub_' + key] = (name) => {
    const dv = values[name];
    if (!dv) throw new Error(`No such dynamic value: ${name}.`);
    return (callback) => {
      return dv.subscribe((v) => {
        callback(1, 0, v);
      });
    };
  };

  if (!readonly) {
    methods['_set_' + key] = (name, value) => {
      const dv = values[name];
      if (!dv) throw new Error(`No such dynamic value: ${name}.`);
      return dv.set(value);
    };
  }

  return methods;
}
