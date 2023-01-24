import {
  TemplateExpression,
  tokenizeTemplate as tokenizeStringTemplate,
} from './tokenize_template.js';
import { StringTemplate } from './string_template.js';
import { warn, error } from './log.js';
import { Subscriptions } from './subscriptions.js';
import { subscribeDOMEvent } from './subscribe_dom_event.js';
import { Bindings } from '../bindings.js';
import { setPrefix, removePrefix } from './prefix.js';
import { safeCall } from './safe_call.js';

/* eslint-disable no-control-regex */

const PLACEHOLDER_START = '\x01';
const PLACEHOLDER_END = '\x02';

const rePlaceholderSplit = /[\x01]\d+[\x02]/g;
const rePlaceholder = /[\x01](\d+)[\x02]/g;
const reSinglePlaceholder = /^[\x01](\d+)[\x02]$/g;

const rePropertyAssignmentSplit = /\s\[[\w$-.\d]+\]=/g;
const rePropertyAssignment = /\s\[([\w$-.\d]+)\]=/g;

/* eslint-enable no-control-regex */

class AttributeAssignmentExpression {
  constructor(attributeName) {
    this.attributeName = attributeName;
  }
}

function mergeTokens(strings, expressions) {
  const tokens = [];

  for (let i = 0; i < expressions.length; i++) {
    tokens.push(strings[i]);
    tokens.push(expressions[i]);
  }

  tokens.push(strings[strings.length - 1]);

  return tokens;
}

function tokenizeTemplate(input) {
  const result = tokenizeStringTemplate(input);

  return result
    .map((token) => {
      if (typeof token !== 'string') return token;

      if (token.match(rePropertyAssignment)) {
        const strings = token.split(rePropertyAssignmentSplit);
        const expressions = Array.from(
          token.matchAll(rePropertyAssignment)
        ).map((match) => {
          return [' ', new AttributeAssignmentExpression(`[${match[1]}]`), '='];
        });

        return mergeTokens(strings, expressions).flat();
      }

      return token;
    })
    .flat();
}

function replaceExpressions(tokens) {
  const expressions = [];

  const tmp = new Array(tokens.length);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (typeof token !== 'string') {
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

  get path() {
    return this._path;
  }

  connectedCallback() {
    this.isConnected = true;
  }

  disconnectedCallback() {
    this.isConnected = false;
  }

  updateConnected() {
    const state = this._node.isConnected;

    if (state === this.isConnected) return;

    if (state) {
      this.connectedCallback();
    } else {
      this.disconnectedCallback();
    }
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

class DOMTemplateExpression extends DOMTemplateDirective {
  constructor(path, template) {
    super(path);
    this._template = template;
  }

  get dependencies() {
    return this._template.dependencies;
  }

  update(ctx) {
    const template = this._template;

    if (!template.update(ctx)) return false;

    this.apply(template.get());

    return true;
  }

  clone() {
    return new this.constructor(this._path, this._template.clone());
  }
}

class NodeContentList {
  constructor(nodes) {
    this.nodes = nodes;
  }

  replaceWith(tmp) {
    const nodes = this.nodes;
    const firstNode = nodes[0];

    if ('nodeType' in tmp) {
      firstNode.replaceWith(tmp);
      for (let i = 1; i < nodes.length; i++) {
        nodes[i].remove();
      }
    } else if (tmp instanceof NodeContentList) {
      // This is a naive algorithm, it does not try to optimize away operations
      // on nodes which are already in the right place. We can improve this if
      // we get into situations where this makes a significant difference.
      const currentNodes = this.nodes;
      const newNodes = tmp.nodes;
      const newNodeSet = new Set(newNodes);

      const placeholder = document.createComment('placeholder');
      const lastNode = currentNodes[currentNodes.length - 1];
      const parentNode = lastNode.parentNode;

      parentNode.insertBefore(placeholder, lastNode);

      for (let i = 0; i < currentNodes.length; i++) {
        const node = currentNodes[i];

        if (newNodeSet.has(node)) continue;
        node.remove();
      }

      for (let i = 0; i < newNodes.length; i++) {
        parentNode.insertBefore(newNodes[i], placeholder);
      }

      placeholder.remove();
    } else {
      throw new TypeError('Bad argument.');
    }
  }

  replace(other) {
    if (other instanceof NodeContentList) {
      other.replaceWith(this);
    } else if ('nodeType' in other) {
      const nodes = this.nodes;
      const parentNode = other.parentNode;
      const length = nodes.length;

      const lastNode = nodes[length - 1];

      other.replaceWith(lastNode);

      for (let i = 0; i < length - 1; i++) {
        parentNode.insertBefore(nodes[i], lastNode);
      }
    } else {
      throw new TypeError('Bad argument.');
    }
  }
}

class NodeContentExpression extends DOMTemplateExpression {
  apply(data) {
    const currentNode = this._node;

    if (
      data === null ||
      data === void 0 ||
      (Array.isArray(data) && data.length === 0)
    ) {
      const node = document.createComment(' null placeholder ');
      currentNode.replaceWith(node);
      this._node = node;
    } else {
      switch (typeof data) {
        case 'string':
        case 'number':
        case 'boolean':
          {
            if (currentNode.nodeType !== 3) {
              const tmp = document.createTextNode(data);
              currentNode.replaceWith(tmp);
              this._node = tmp;
            } else {
              currentNode.data = data;
            }
          }
          break;
        case 'object':
          // is a node.
          if (Array.isArray(data)) {
            const nodeList = new NodeContentList(data);
            nodeList.replace(currentNode);
            this._node = nodeList;
          } else if ('replaceWith' in data) {
            currentNode.replaceWith(data);
            this._node = data;
          } else {
            throw new TypeError('Unsupported data type.');
          }
          break;
        default:
          throw new TypeError('Unsupported type.');
      }
    }
  }
}

class ClassListExpression extends DOMTemplateExpression {
  constructor(path, template) {
    super(path, template);
    this._list = [];
  }

  apply(list) {
    const currentList = this._list;

    if (typeof list === 'string') {
      list = list.split(/\s+/g);
    } else if (list === null || list === void 0) {
      list = [];
    } else if (!Array.isArray(list)) {
      throw new TypeError('Expected string, null or array.');
    }

    const [toRemove, toAdd] = arrayDiff(currentList, list);

    const classList = this._node.classList;

    toRemove.forEach((cl) => {
      classList.remove(cl);
    });
    toAdd.forEach((cl) => {
      classList.add(cl);
    });

    this._list = list;
  }
}

class AttributeValueExpression extends DOMTemplateExpression {
  constructor(path, attributeName, template) {
    super(path, template);
    this._attributeName = attributeName;
  }

  apply(attributeValue) {
    this._node.setAttribute(this._attributeName, attributeValue);
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
    super(path, template);
    this._propertyName = propertyName;
  }

  apply(propertyValue) {
    this._node[this._propertyName] = propertyValue;
  }

  clone() {
    return new this.constructor(
      this._path,
      this._propertyName,
      this._template.clone()
    );
  }
}

class PrefixExpression extends DOMTemplateExpression {
  get handle() {
    return this._prefixHandle;
  }

  constructor(path, prefixHandle, template) {
    super(path, template);
    this._prefixHandle = prefixHandle;
  }

  apply(prefix) {
    const node = this._node;
    const handle = this._prefixHandle;

    if (prefix === null) {
      removePrefix(node, handle);
    } else {
      setPrefix(node, prefix, handle);
    }
  }

  clone() {
    return new this.constructor(
      this._path,
      this._prefixHandle,
      this._template.clone()
    );
  }
}

class StyleValueExpression extends PropertyValueExpression {
  apply(cssValue) {
    const style = this._node.style;
    const propertyName = this._propertyName;

    if (Array.isArray(cssValue)) {
      if (cssValue.length !== 2)
        throw new TypeError('Expected array [ value, priority ].');

      style.setProperty(propertyName, cssValue[0], cssValue[1]);
    } else {
      style.setProperty(propertyName, cssValue);
    }
  }
}

class EventBindingExpression extends DOMTemplateExpression {
  constructor(path, eventName, template) {
    super(path, template);
    this._eventName = eventName;
    this._subscriptions = new Subscriptions();
  }

  apply(callback) {
    this._subscriptions.unsubscribe();
    this._subscriptions = new Subscriptions();
    this._subscriptions.add(
      subscribeDOMEvent(this._node, this._eventName, callback)
    );
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
  get changesDOM() {
    return true;
  }

  set onDOMModified(cb) {
    this._onDOMModified = cb;
  }

  get onDOMModified() {
    return this._onDOMModified;
  }

  constructor(path, template) {
    super(path, template);
    this._commentNode = null;
    this._onDOMModified = null;
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

  apply(state) {
    state = !!state;
    const node = this._node;
    const attached = node.parentNode !== null;

    if (state === attached) return false;

    const commentNode = this.commentNode;

    if (state) {
      commentNode.replaceWith(node);
    } else {
      node.replaceWith(commentNode);
    }

    const onDOMModified = this.onDOMModified;

    if (onDOMModified !== null) safeCall(onDOMModified);
  }
}

class BindNodeReference extends DOMTemplateExpression {
  static requiresPrefix() {
    return true;
  }

  constructor(path, template) {
    super(path, template);
    this._bindingsImpl = null;
  }

  attach(node) {
    super.attach(node);
    this._bindingsImpl = new Bindings(this._node, this._node, this._node);
  }

  connectedCallback() {
    if (!this._node.isConnected) return;
    super.connectedCallback();
    const bindings = this._template.get();

    try {
      this._bindingsImpl.update(bindings);
    } catch (err) {
      error(
        'Exception when updating bindings %o in %s: %o',
        bindings,
        this._template.toString(),
        err
      );
      throw err;
    }
  }

  disconnectedCallback() {
    if (!this.isConnected) return;
    super.disconnectedCallback();
    this._bindingsImpl.dispose();
  }

  updatePrefix(handle) {
    if (this.isConnected) {
      this._bindingsImpl.updatePrefix(handle);
    }
  }

  apply(bindings) {
    if (!this.isConnected) return;

    try {
      this._bindingsImpl.update(bindings);
    } catch (err) {
      error(
        'Exception when updating bindings %o in %s: %o',
        bindings,
        this._template.toString(),
        err
      );
      throw err;
    }
  }
}

function subscribePromise(p, callback) {
  let active = true;

  p.then((result) => {
    if (!active) return;
    callback(result);
  });

  return () => {
    active = false;
  };
}

class AsyncPipeDirective extends DOMTemplateExpression {
  get requiresPrefix() {
    return this._directive.requiresPrefix;
  }

  get changesDOM() {
    return this._directive.changesDOM;
  }

  set onDOMModified(cb) {
    this._directive.onDOMModified = cb;
  }

  get onDOMModified() {
    return this._directive.onDOMModified;
  }

  constructor(path, template, directive) {
    super(path, template);
    this._directive = directive;
    this._unsubscribe = null;
    this._valueChanged = (value) => {
      this._directive.update(value);
    };
  }

  attach(node) {
    super.attach(node);
    this._directive.attach(node);
  }

  updateConnected() {
    super.updateConnected();
    this._directive.updateConnected();
  }

  updatePrefix(handle) {
    if (this.isConnected) {
      const directive = this._directive;

      if ('updatePrefix' in directive) directive.updatePrefix(handle);
    }
  }

  apply(result) {
    safeCall(this._unsubscribe);
    this._unsubscribe = null;
    this._unsubscribe = this._subscribe(result);
  }

  clone() {
    return new this.constructor(
      this._path,
      this._template.clone(),
      this._directive.clone()
    );
  }

  _subscribe(observable) {
    if (!observable) return null;

    const valueChanged = this._valueChanged;

    switch (typeof observable) {
      case 'function':
        return observable(valueChanged);
      case 'object':
        if ('subscribe' in observable) {
          return observable.subscribe(valueChanged);
        } else if ('then' in observable) {
          return subscribePromise(observable, valueChanged);
        }
        break;
      default:
        throw new TypeError('Expected Promise|DynamicValue.');
    }
  }
}

function containsPlaceholders(input) {
  return -1 !== input.search(rePlaceholder);
}

function extractAsync(templateExpression) {
  const expr = templateExpression.expression;

  if (typeof expr === 'string') {
    const tmp = expr.split('|');
    const last = tmp.pop();

    if (last.trim() === 'async') {
      return [new TemplateExpression(tmp.join('|')), true];
    }
  }

  return [templateExpression, false];
}

function asyncTemplateFunction() {
  return this;
}

function extractAttributeName(name, expressions) {
  const match = Array.from(name.matchAll(reSinglePlaceholder));

  if (!match) return null;

  const expr = expressions[parseInt(match[0][1])];

  if (expr instanceof AttributeAssignmentExpression) {
    return expr.attributeName;
  }

  return null;
}

function compileStringWithPlaceholders(input, expressions) {
  const strings = input.split(rePlaceholderSplit);
  const matches = Array.from(input.matchAll(rePlaceholder));

  const tmp = matches.map((match) => {
    return expressions[parseInt(match[1])];
  });

  let tokens = mergeTokens(strings, tmp);

  tokens = tokens.filter((token) => {
    return typeof token !== 'string' || token.length;
  });

  let asyncTemplate = null;

  tokens = tokens.map((token) => {
    if (typeof token === 'string') return token;

    const [tpl, isAsync] = extractAsync(token);

    if (!isAsync) return token;

    if (asyncTemplate)
      throw new Error('Found two async pipes inside one directive.');

    asyncTemplate = tpl;

    return new TemplateExpression(asyncTemplateFunction);
  });

  if (asyncTemplate)
    asyncTemplate = StringTemplate.fromTokens([
      asyncTemplate,
    ]).toSingleExpression();

  return [StringTemplate.fromTokens(tokens), asyncTemplate];
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

function arrayDiff(from, to) {
  const toRemove = from.filter((elem) => !to.includes(elem));
  const toAdd = to.filter((elem) => !from.includes(elem));

  return [toRemove, toAdd];
}

function makeAsync(expression, asyncTemplate) {
  if (!asyncTemplate) return expression;

  return new AsyncPipeDirective(expression.path, asyncTemplate, expression);
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
            const attributeName = attr.name;
            const value = attr.value;
            let expr = null;
            let asyncTemplate = null;
            let tpl = null;
            let name;

            if (containsPlaceholders(attributeName)) {
              name = extractAttributeName(attributeName, expressions);

              if (!name)
                throw new Error('Templates in attribute names not supported.');
            } else {
              name = attributeName;
            }

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

                [tpl, asyncTemplate] = compileStringWithPlaceholders(
                  value,
                  expressions
                );

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
              [tpl, asyncTemplate] = compileStringWithPlaceholders(
                value,
                expressions
              );

              expr = new OptionalNodeReference(path, tpl.toSingleExpression());
            } else if (name === '%bind') {
              [tpl, asyncTemplate] = compileStringWithPlaceholders(
                value,
                expressions
              );

              expr = new BindNodeReference(path, tpl.toSingleExpression());
            } else if (containsPlaceholders(value)) {
              [tpl, asyncTemplate] = compileStringWithPlaceholders(
                value,
                expressions
              );

              if (name.startsWith('[') && name.endsWith(']')) {
                const propertyName = name.substr(1, name.length - 2);

                if (propertyName.startsWith('style.')) {
                  expr = new StyleValueExpression(
                    path,
                    propertyName.substr('style.'.length),
                    tpl.reduceToSingleExpression()
                  );
                } else if (propertyName === 'classList') {
                  expr = new ClassListExpression(
                    path,
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
              } else if (name.startsWith('prefix')) {
                const handle =
                  name === 'prefix' ? null : name.substr('prefix-'.length);

                expr = new PrefixExpression(path, handle, tpl);
              } else {
                expr = new AttributeValueExpression(path, name, tpl);
              }
            }

            if (expr === null) continue;

            results.push(makeAsync(expr, asyncTemplate));
            node.removeAttribute(attributeName);
          }
        }
        break;
      case 3:
        // text node
        {
          const data = node.data;

          if (!containsPlaceholders(data)) break;

          node.data = '';

          const [tpl, asyncTemplate] = compileStringWithPlaceholders(
            data,
            expressions
          );
          const tmp = new NodeContentExpression(path, tpl.toSingleExpression());

          results.push(makeAsync(tmp, asyncTemplate));
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

  get onDOMModified() {
    if (!this._onDOMModified) {
      this._onDOMModified = () => {
        if (this._delayUpdateDOM) {
          this._domModified = true;
        } else if (this._isConnected) {
          this._directives.forEach((directive) => {
            directive.updateConnected();
          });
        }
      };
    }

    return this._onDOMModified;
  }

  constructor(fragment, directives, dependencies) {
    this._original = fragment;
    this._directives = directives;
    this._fragment = fragment.cloneNode(true);
    this._expressions = directives.filter((directive) => {
      return directive instanceof DOMTemplateExpression;
    });
    this._dependencies = dependencies || null;
    this._onDOMModified = null;
    this._delayUpdateDOM = false;
    this._domModified = false;

    let requiresPrefix = false;

    directives.forEach((directive) => {
      directive.attach(this._fragment);
      if (directive.requiresPrefix) requiresPrefix = true;
      if (directive.changesDOM) directive.onDOMModified = this.onDOMModified;
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
    this._isConnected = false;
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
    this._isConnected = true;
    this._directives.forEach((directive) => {
      try {
        directive.updateConnected();
      } catch (err) {
        warn(
          'connectedCallback() on template directive %o generated an error: %o',
          directive,
          err
        );
      }
    });
  }

  disconnectedCallback() {
    this._isConnected = false;
    this._directives.forEach((directive) => {
      try {
        directive.updateConnected();
      } catch (err) {
        warn(
          'disconnectedCallback() on template directive %o generated an error: %o',
          directive,
          err
        );
      }
    });
  }

  _updatePrefix(handle) {
    this._directives.forEach((directive) => {
      try {
        if (directive.constructor.requiresPrefix)
          directive.updatePrefix(handle);
      } catch (err) {
        warn(
          'Prefix change on template directive %o generated an error: %o',
          directive,
          err
        );
      }
    });
  }

  _updatePrefixOn(handle, node) {
    this._directives.forEach((directive) => {
      if (!directive.constructor.requiresPrefix) return;
      if (!node.contains(directive.node)) return;
      try {
        directive.updatePrefix(handle);
      } catch (err) {
        warn(
          'Prefix change on template directive %o generated an error: %o',
          directive,
          err
        );
      }
    });
  }

  update(ctx) {
    const expressions = this._expressions;
    let changed = false;

    this._delayUpdateDOM = true;

    for (let i = 0; i < expressions.length; i++) {
      const expression = expressions[i];

      try {
        if (expression.update(ctx)) {
          changed = true;

          if (expression instanceof PrefixExpression) {
            this._updatePrefixOn(expression.handle, expression.node);
          }
        }
      } catch (err) {
        warn('Template expression %o generated an error: %o', expression, err);
      }
    }

    this._delayUpdateDOM = false;

    if (this._domModified) {
      this.onDOMModified();
      this._domModified = false;
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
