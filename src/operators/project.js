import { map } from './map.js';
import { observeLatest } from './observeLatest.js';
import { DynamicValue } from '../dynamic_value.js';

export function createProjectionContext(dv) {
  const context = {
    hasValue: false,
    value: undefined,
  };

  dv = observeLatest(dv, (hasValue, value) => {
    context.hasValue = hasValue;
    context.value = value;
  });

  return [ dv, context ];
}

export function project(dv, projection, merge, context) {
  if (!(dv instanceof DynamicValue))
    throw new TypeError('Expected DynamicValue.');

  if (typeof projection !== 'function')
    throw new TypeError('Expected function.');

  if (!merge) {
    return map(dv, projection);
  }

  if (typeof merge !== 'function')
    throw new TypeError('Expected function.');

  if (!context) {
    const tmp = createProjectionContext(dv);

    dv = tmp[0];
    context = tmp[1];
  }

  return map(
    dv,
    (value) => projection(value),
    (value) => {
      if (!context.hasValue)
        throw new Error(`No current value to use.`);

      return merge(context.value, value);
    },
  );
}
