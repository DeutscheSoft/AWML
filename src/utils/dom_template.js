import { TemplateExpression, tokenizeTemplate } from './tokenize_template.js';
import { StringTemplate } from './string_template.js';
import { warn } from './log.js';
import { Subscriptions } from './subscriptions.js';
import { subscribeDOMEvent } from './subscribe_dom_event.js';
import { Bindings } from '../bindings.js';

const PLACEHOLDER_START = '\x01';
const PLACEHOLDER_END = '\x02';

const rePlaceholder = /[\x01](\d+)[\x02]/g;

function replaceExpressions(tokens) {
  const expressions = [];

  const tmp = new Array(tokens.length);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token instanceof TemplateExpression) {
      tmp[i] = PLACEHOLDER_START + expressions.length + PLACEHOLDER_END;
      expressions.push(token);
    } else {
      tmp[i] = token;
    }
  }

  return [expressions, tmp.join('')];
}

class DOMTemplateDirective {
  constructor(path) {
    this._path = path;
    this._node = null;
    this.isConnected = false;
  }

  connectedCallback() {
    this.isConnected = true;
  }

  disconnectedCallback() {
    this.isConnected = false;
  }

  attach(node) {
    const path = this._path;
    for (let i = 0; i < path.length; i++) {
      node = node.childNodes.item(path[i]);
    }
    this._node = node;
  }

  get node() {
    return this._node;
  }
}

class NodeReference extends DOMTemplateDirective {
  constructor(path, name) {
    super(path);
    this._name = name;
  }

  get name() {
    return this._name;
  }

  clone() {
    return new this.constructor(this._path, this._name);
  }
}

class OptionReference extends DOMTemplateDirective {
  constructor(path, name, optionName) {
    super(path);
    this._name = name;
    this._optionName = optionName;
  }

  get name() {
    return this._name;
  }

  get optionName() {
    return this._optionName;
  }

  clone() {
    return new this.constructor(this._path, this._name, this._optionName);
  }
}

class DOMTemplateExpression extends DOMTemplateDirective { }

class NodeContentExpression extends DOMTemplateExpression {
  constructor(path, template) {
    super(path);
    this._template = template;
  }

  update(ctx) {
    const template = this._template;

    if (template.update(ctx)) {
      const data = template.get();

      if (data === null || data === void 0) {
        const node = document.createComment(' null placeholder ');
        this._node.replaceWith(node);
        this._node = node;
      } else {
        switch (typeof data) {
          case 'string':
          case 'number':
          case 'boolean':
            {
              const node = this._node;

              if (node.nodeType !== 3) {
                const tmp = document.createTextNode(data);
                node.replaceWith(tmp);
                this._node = tmp;
              } else {
                node.data = data;
              }
            }
            break;
          case 'object':
            // is a node.
            if ('replaceWith' in data) {
              this._node.replaceWith(data);
              this._node = data;
            } else {
              throw new TypeError('Unsupported data type.');
            }
            break;
          default:
            throw new TypeError('Unsupported type.');
        }
      }

      return true;
    } else {
      return false;
    }
  }

  get dependencies() {
    return this._template.dependencies;
  }

  clone() {
    return new this.constructor(this._path, this._template.clone());
  }
}

class AttributeValueExpression extends DOMTemplateExpression {
  constructor(path, attributeName, template) {
    super(path);
    this._attributeName = attributeName;
    this._template = template;
  }

  update(ctx) {
    const template = this._template;

    if (template.update(ctx)) {
      this._node.setAttribute(this._attributeName, template.get());
      return true;
    } else {
      return false;
    }
  }

  get dependencies() {
    return this._template.dependencies;
  }

  clone() {
    return new this.constructor(
      this._path,
      this._attributeName,
      this._template.clone()
    );
  }
}

class PropertyValueExpression extends DOMTemplateExpression {
  constructor(path, propertyName, template) {
    super(path);
    this._propertyName = propertyName;
    this._template = template;
  }

  update(ctx) {
    const template = this._template;

    if (template.update(ctx)) {
      this._node[this._propertyName] = template.get();
      return true;
    } else {
      return false;
    }
  }

  get dependencies() {
    return this._template.dependencies;
  }

  clone() {
    return new this.constructor(
      this._path,
      this._propertyName,
      this._template.clone()
    );
  }
}

class StyleValueExpression extends PropertyValueExpression {
  update(ctx) {
    const template = this._template;

    if (template.update(ctx)) {
      this._node.style[this._propertyName] = template.get();
      return true;
    } else {
      return false;
    }
  }
}

class EventBindingExpression extends DOMTemplateExpression {
  constructor(path, eventName, template) {
    super(path);
    this._eventName = eventName;
    this._template = template;
    this._subscriptions = new Subscriptions();
  }

  update(ctx) {
    const template = this._template;

    if (template.update(ctx)) {
      this._subscriptions.unsubscribe();
      this._subscriptions = new Subscriptions();
      this._subscriptions.add(
        subscribeDOMEvent(this._node, this._eventName, template.get())
      );
      return true;
    } else {
      return false;
    }
  }

  get dependencies() {
    return this._template.dependencies;
  }

  clone() {
    return new this.constructor(
      this._path,
      this._eventName,
      this._template.clone()
    );
  }
}

class OptionalNodeReference extends DOMTemplateExpression {
  constructor(path, template) {
    super(path);
    this._template = template;
    this._commentNode = null;
  }

  get commentNode() {
    let commentNode = this._commentNode;

    if (commentNode === null) {
      this._commentNode = commentNode = document.createComment(
        ' %if placeholder '
      );
    }

    return commentNode;
  }

  update(ctx) {
    const template = this._template;

    if (template.update(ctx)) {
      const state = !!template.get();
      const node = this._node;
      const attached = node.parentNode !== null;

      if (state === attached) return false;

      const commentNode = this.commentNode;

      if (state) {
        commentNode.replaceWith(node);
      } else {
        node.replaceWith(commentNode);
      }

      return true;
    } else {
      return false;
    }
  }

  get dependencies() {
    return this._template.dependencies;
  }

  clone() {
    return new this.constructor(this._path, this._template.clone());
  }
}

class BindNodeReference extends DOMTemplateExpression {
  static get requiresPrefix() {
    return true;
  }

  constructor(path, template) {
    super(path);
    this._template = template;
    this._bindingsImpl = null;
  }

  attach(node) {
    super.attach(node);
    this._bindingsImpl = new Bindings(
      this._node,
      this._node,
      this._node
    );
  }

  connectedCallback() {
    super.connectedCallback();
    this._bindingsImpl.update(this._template.get());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._bindingsImpl.dispose();
  }

  updatePrefix(handle) {
    if (this.isConnected) {
      this._bindingsImpl.updatePrefix(handle);
    }
  }

  update(ctx) {
    const template = this._template;

    if (template.update(ctx)) {
      if (this.isConnected)
        this._bindingsImpl.update(template.get())
      return true;
    } else {
      return false;
    }
  }

  get dependencies() {
    return this._template.dependencies;
  }

  clone() {
    return new this.constructor(this._path, this._template.clone());
  }
}

function containsPlaceholders(input) {
  return -1 !== input.search(rePlaceholder);
}

function mergeTokens(strings, expressions) {
  let tokens = [];

  for (let i = 0; i < expressions.length; i++) {
    tokens.push(strings[i]);
    tokens.push(expressions[i]);
  }

  tokens.push(strings[strings.length - 1]);

  return tokens;
}

function compileStringWithPlaceholders(input, expressions) {
  const strings = input.split(rePlaceholder);
  const matches = Array.from(input.matchAll(rePlaceholder));

  const tmp = matches.map((match) => {
    return expressions[parseInt(match[1])];
  });

  let tokens = mergeTokens(strings, tmp);

  tokens = tokens.filter((token) => {
    return typeof token !== 'string' || token.length;
  });

  return StringTemplate.fromTokens(tokens);
}

function attributesToArray(attributes) {
  const length = attributes.length;
  const result = new Array(length);

  for (let i = 0; i < length; i++) {
    result[i] = attributes.item(i);
  }

  return result;
}

function splitTextNodes(childNodes) {
  childNodes.forEach((node) => {
    if (node.nodeType === 3) {
      let pos;
      while ((pos = node.data.search(rePlaceholder)) !== -1) {
        if (pos > 0) {
          node = node.splitText(pos);
        } else {
          pos = node.data.search(PLACEHOLDER_END);
          if (pos === node.data.length - 1) break;
          node = node.splitText(pos + 1);
        }
      }
    } else {
      const childNodes = node.childNodes;
      if (!childNodes.length) return;
      splitTextNodes(childNodes);
    }
  });
}

function compileExpressions(childNodes, expressions, nodePath) {
  let results = [];

  childNodes.forEach((node, i) => {
    const path = nodePath.concat([i]);

    switch (node.nodeType) {
      case 1:
        // element node
        {
          const attributes = attributesToArray(node.attributes);

          for (let i = 0; i < attributes.length; i++) {
            const attr = attributes[i];
            const { name, value } = attr;
            let expr = null;

            if (name.startsWith('#')) {
              if (containsPlaceholders(value) || containsPlaceholders(name))
                throw new Error(
                  'Templates expressions in Node references not supported.'
                );

              expr = new NodeReference(path, name.substr(1));
            } else if (name.startsWith('$')) {
              if (containsPlaceholders(value) || containsPlaceholders(name))
                throw new Error(
                  'Templates expressions in Option references not supported.'
                );

              expr = new OptionReference(path, name.substr(1), value);
            } else if (name.startsWith('(')) {
              if (name.endsWith(')')) {
                if (!containsPlaceholders(value)) {
                  warn(
                    'Event handler definition without template expression in',
                    node
                  );
                  continue;
                }

                const tpl = compileStringWithPlaceholders(value, expressions);

                expr = new EventBindingExpression(
                  path,
                  name.substr(1, name.length - 2),
                  tpl.toSingleExpression()
                );
              } else {
                warn(
                  "Missing closing paranthesis ')' in event listener definition in",
                  node
                );
                continue;
              }
            } else if (name === '%if') {
              const tpl = compileStringWithPlaceholders(value, expressions);

              expr = new OptionalNodeReference(path, tpl.toSingleExpression());
            } else if (name === '%bind') {
              const tpl = compileStringWithPlaceholders(value, expressions);

              expr = new BindNodeReference(path, tpl.toSingleExpression());
            } else if (containsPlaceholders(value)) {
              if (containsPlaceholders(name))
                throw new Error('Templates in attribute names not supported.');

              const tpl = compileStringWithPlaceholders(value, expressions);

              if (name.startsWith('[') && name.endsWith(']')) {
                const propertyName = name.substr(1, name.length - 2);

                if (propertyName.startsWith('style.')) {
                  expr = new StyleValueExpression(
                    path,
                    propertyName.substr('style.'.length),
                    tpl.reduceToSingleExpression()
                  );
                } else {
                  if (propertyName.search('\\.') !== -1)
                    throw new Error(
                      "A property expression cannot contain '.'.",
                      propertyName
                    );
                  expr = new PropertyValueExpression(
                    path,
                    propertyName,
                    tpl.reduceToSingleExpression()
                  );
                }
              } else {
                expr = new AttributeValueExpression(path, name, tpl);
              }
            }

            if (expr === null) continue;

            results.push(expr);
            node.removeAttribute(name);
          }
        }
        break;
      case 3:
        // text node
        {
          const data = node.data;

          if (!containsPlaceholders(data)) break;

          node.data = '';

          const tpl = compileStringWithPlaceholders(data, expressions);
          const tmp = new NodeContentExpression(path, tpl.toSingleExpression());

          results.push(tmp);
        }
        break;
    }

    const childNodes = node.childNodes;

    if (!childNodes.length) return;

    const tmp = compileExpressions(childNodes, expressions, path);

    if (tmp.length) results = results.concat(tmp);
  });

  return results;
}

export class DOMTemplate {
  get requiresPrefix() {
    return this._requiresPrefix;
  }

  constructor(fragment, directives, dependencies) {
    this._original = fragment;
    this._directives = directives;
    this._fragment = fragment.cloneNode(true);
    this._expressions = directives.filter((directive) => {
      return directive instanceof DOMTemplateExpression;
    });
    this._dependencies = dependencies || null;

    let requiresPrefix = false;

    directives.forEach((directive) => {
      directive.attach(this._fragment);
      if (directive.constructor.requiresPrefix)
        requiresPrefix = true;
    });

    this._requiresPrefix = requiresPrefix;

    let references = null;
    let optionReferences = null;

    {
      const referenceExpressions = directives.filter((directive) => {
        return directive instanceof NodeReference;
      });

      if (referenceExpressions.length) {
        references = new Map(
          referenceExpressions.map((nodeReference) => {
            return [nodeReference.name, nodeReference.node];
          })
        );
      }
    }

    {
      const referenceExpressions = directives.filter((directive) => {
        return directive instanceof OptionReference;
      });

      if (referenceExpressions.length) {
        optionReferences = new Map(
          referenceExpressions.map((optionReference) => {
            return [
              optionReference.name,
              [optionReference.node, optionReference.optionName],
            ];
          })
        );
      }
    }

    this._references = references;
    this._optionReferences = optionReferences;
    this._context = null;
  }

  get references() {
    return this._references || new Map();
  }

  get optionReferences() {
    return this._optionReferences || new Map();
  }

  get referencePrototype() {
    return Object.fromEntries(this.references.entries());
  }

  get fragment() {
    return this._fragment;
  }

  get dependencies() {
    if (this._dependencies === null) {
      this._dependencies = this._expressions
        .map((expr) => expr.dependencies)
        .filter((a) => Array.isArray(a))
        .flat()
        .filter((name, index, a) => index === a.indexOf(name));
    }
    return this._dependencies;
  }

  connectedCallback() {
    this._directives.forEach((directive) => directive.connectedCallback());
  }

  disconnectedCallback() {
    this._directives.forEach((directive) => directive.disconnectedCallback());
  }

  _updatePrefix(handle) {
    this._directives.forEach((directive) => {
      if (directive.constructor.requiresPrefix)
        directive.updatePrefix(handle);
    });
  }

  update(ctx) {
    const expressions = this._expressions;
    let changed = false;

    for (let i = 0; i < expressions.length; i++) {
      if (expressions[i].update(ctx)) changed = true;
    }

    return changed;
  }

  clone() {
    return new this.constructor(
      this._original,
      this._directives.map((expr) => expr.clone()),
      this._dependencies
    );
  }

  static fromString(input) {
    if (input.search(PLACEHOLDER_START) !== -1)
      throw new Error('DOMTemplates must not contain byte \x01.');

    return this.fromTokens(tokenizeTemplate(input));
  }

  static fromTokens(tokens) {
    const templateNode = document.createElement('template');
    const [stringExpressions, html] = replaceExpressions(tokens);

    templateNode.innerHTML = html;

    const fragment = templateNode.content;

    splitTextNodes(fragment.childNodes);

    const expressions = compileExpressions(
      fragment.childNodes,
      stringExpressions,
      []
    );

    return new this(fragment, expressions);
  }

  static fromTemplate(strings, ...expressions) {
    expressions = expressions.map((expr) => new TemplateExpression(expr));
    return this.fromTokens(mergeTokens(strings, expressions));
  }
}
