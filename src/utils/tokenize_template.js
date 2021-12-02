import { error } from './log.js';

// FIXME: this is not exact.
const reUsedProperties = /this\.([\w0-9$_]+)/g;

export class TemplateExpression {
  constructor(expression) {
    if (typeof expression !== 'string' && typeof expression !== 'function')
      throw new TypeError('Expected string or function.');
    this.expression = expression;
  }

  compile() {
    const expr = this.expression;

    if (typeof expr === 'string') {
      try {
        const fun = new Function('return (' + this.expression + ');');

        const dependencies = this.usedProperties();

        if (dependencies !== void 0) fun._dependencies = dependencies;

        return fun;
      } catch (err) {
        error('Failed to compile template expression \'%s\;: %o',
              expr, err);
        throw err;
      }
    } else if (typeof expr === 'function') {
      return expr;
    }
  }

  usedProperties() {
    const expr = this.expression;

    if (typeof expr === 'string') {
      return Array.from(expr.matchAll(reUsedProperties)).map((match) => {
        return match[1];
      });
    } else if (typeof expr === 'function') {
      return void 0;
    }
  }
}

const BACKSPACE = '\\'.charCodeAt(0);
const OPENING = '{'.charCodeAt(0);
const CLOSING = '}'.charCodeAt(0);
const exprStart = /{{/g;

function findExpressionEnd(str, startPos) {
  const length = str.length;

  for (let depth = 0, pos = startPos; pos < length; pos++) {
    const c = str.charCodeAt(pos);

    if (c === CLOSING) {
      if (depth) {
        depth--;
      } else {
        if (pos + 1 < length && str.charCodeAt(pos + 1) === CLOSING) {
          return pos;
        }

        return -1;
      }
    } else if (c === OPENING) {
      depth++;
    }
  }

  return -1;
}

export function tokenizeTemplate(input) {
  if (typeof input !== 'string') throw new TypeError('Expected string.');

  exprStart.lastIndex = 0;

  const expressionPositions = [];

  while (exprStart.test(input)) {
    const startPos = exprStart.lastIndex - 2;

    // this is not a template expression, it is quoted.
    if (startPos > 0 && input.charCodeAt(startPos - 1) === BACKSPACE) continue;

    const endPos = findExpressionEnd(input, startPos + 2);

    if (endPos === -1) continue;

    expressionPositions.push([startPos, endPos]);
    exprStart.lastIndex = endPos + 2;
  }

  const result = [];

  let pos = 0;

  for (let i = 0; i < expressionPositions.length; i++) {
    const [startPos, endPos] = expressionPositions[i];

    if (startPos > pos) {
      result.push(input.substr(pos, startPos - pos));
    }

    const expression = input.substr(startPos + 2, endPos - (startPos + 2));

    result.push(new TemplateExpression(expression));

    pos = endPos + 2;
  }

  if (pos < input.length) result.push(input.substr(pos));

  return result;
}
