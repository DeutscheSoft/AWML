import { TemplateExpression, tokenizeTemplate } from './tokenize_template.js';
import { error } from './log.js';

export class SingleExpressionTemplate {
  constructor(compiledExpression) {
    this._compiledExpression = compiledExpression;
    this._output = null;
    this._initially = true;
  }

  clone() {
    return new this.constructor(this._compiledExpression);
  }

  update(ctx) {
    const compiledExpression = this._compiledExpression;

    try {
      const result = compiledExpression.call(ctx);

      if (this._initially === false && result === this._output) return false;

      this._initially = false;
      this._output = result;
      return true;
    } catch (err) {
      error('Exception when evaluating template expression \'%s\': %o',
            compiledExpression, err);
      throw err;
    }
  }

  get dependencies() {
    return this._compiledExpression._dependencies;
  }

  get() {
    return this._output;
  }
}

export class StringTemplate {
  constructor(compiledExpressions) {
    this._compiledExpressions = compiledExpressions;
    this._results = compiledExpressions.map((token) => {
      return typeof token === 'string' ? token : '';
    });
    this._output = null;
  }

  clone() {
    return new this.constructor(this._compiledExpressions);
  }

  update(ctx) {
    const compiledExpressions = this._compiledExpressions;
    const results = this._results;
    let changed = this._output === null;

    for (let i = 0; i < compiledExpressions.length; i++) {
      const expression = compiledExpressions[i];

      if (typeof expression === 'string') continue;

      try {
        const result = expression.call(ctx);
        const previousResult = results[i];

        if (result === previousResult && !isNaN(result) && !isNaN(previousResult))
          continue;

        results[i] = result;
        changed = true;
      } catch (err) {
        error('Exception when evaluating template expression \'%s\': %o',
              expression, err);
        throw err;
      }
    }

    if (changed) {
      this._output = results.join('');
    }

    return changed;
  }

  reduceToSingleExpression() {
    const compiledExpressions = this._compiledExpressions;

    if (compiledExpressions.length === 1)
      return new SingleExpressionTemplate(this._compiledExpressions[0]);

    return this;
  }

  toSingleExpression() {
    const compiledExpressions = this._compiledExpressions;

    if (compiledExpressions.length !== 1)
      throw new Error('Cannot reduce to single expression.');

    return new SingleExpressionTemplate(this._compiledExpressions[0]);
  }

  get() {
    return this._output;
  }

  get dependencies() {
    return this._compiledExpressions
      .map((expr) => (typeof expr === 'function' ? expr._dependencies : void 0))
      .filter((a) => a !== void 0)
      .flat()
      .filter((name, index, a) => index === a.indexOf(name));
  }

  static fromString(input) {
    return this.fromTokens(tokenizeTemplate(input));
  }

  static fromTokens(tokens) {
    const compiledExpressions = tokens.map((token) => {
      if (token instanceof TemplateExpression) {
        return token.compile();
      } else {
        return token;
      }
    });

    return new this(compiledExpressions);
  }

  static $(name) {
    return 'this.' + name;
  }
}
