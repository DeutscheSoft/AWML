import { error } from './log.js';

/** @ignore */
export function parseAttribute(type, x, fallback) {
  if (x === null) return fallback;
  switch (type) {
    case 'javascript':
    case 'js':
      x = x.trim();
      if (x.length) {
        try {
          return new Function([], 'return (' + x + ');').call(this);
        } catch (e) {
          error('Syntax error', e, 'in', x);
        }
      }
      return fallback;
    case 'json':
      x = x.trim();
      if (x.length) {
        try {
          return JSON.parse(x);
        } catch (e) {
          error('Syntax error', e, 'in JSON', x);
        }
      }
      return fallback;
    case 'string':
      return x;
    case 'number': {
      const n = parseFloat(x);
      return n === n ? n : fallback;
    }
    case 'int': {
      const n = parseInt(x);
      return n === n ? n : fallback;
    }
    case 'regexp':
      return new RegExp(x);
    case 'bool':
      x = x.trim();
      if (x === 'true') {
        return true;
      } else if (x === 'false') {
        return false;
      }
      error("Malformed 'bool': ", x);
      return fallback;
    default:
      error('unsupported type', type);
      return fallback;
  }
}
