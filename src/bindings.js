import { connect } from './operators/connect.js';
import { collectPrefix, compileSrc } from './utils/prefix.js';
import { getBackendValue } from './backends.js';
import { ListValue } from './list_value.js';
import { bindingFromComponent } from './utils/aux-support.js';
import { runCleanupHandler } from './utils/run_cleanup_handler.js';

function dependsOnPrefix(binding, handle) {
  const srcPrefix = binding.srcPrefix || null;
  const src = binding.src;

  if (binding.backendValue) return false;

  if (Array.isArray(srcPrefix)) {
    // illegal
    if (!Array.isArray(src) || src.length !== srcPrefix.length) return false;

    for (let i = 0; i < srcPrefix.length; i++) {
      if (srcPrefix[i] !== handle) continue;

      if (src[i].indexOf(':') > 0) continue;

      return true;
    }

    return false;
  } else {
    if (handle !== srcPrefix) return false;

    if (typeof src === 'string') {
      // Note: index 0 would not be sufficient, the empty
      // string is not a legal name for a backend
      return src.indexOf(':') <= 0;
    } else if (Array.isArray(src)) {
      return src.some((str) => src.indexOf(':') <= 0);
    } else {
      // illegal
      return false;
    }
  }
}

/**
 * An interface describing a binding.
 *
 * @typedef {Object} IBindingDescription
 * @property {string|string[]} src
 *      The src address.
 * @property {string|string[]} [srcPrefix=null]
 *      The source prefix to use.
 * @property {DynamicValue} [backendValue]
 *      An explicit backend value to bind to. If a backendValue
 *      is specified, ``src`` and ``srcPrefix`` will be ignored.
 * @property {function} [pipe]
 *      An optional pipe operator.
 * @property {function} [transformReceive]
 *      An optional function for transforming values received
 *      from the ``backendValue``.
 * @property {function} [transformSend]
 *      An optional function for transforming values sent to the
 *      backendValue.
 * @property {boolean} [replayReceive=true]
 *      If true, one value will be replayed when subscribing to
 *      the backendValue.
 * @property {boolean} [replaySend=false]
 *      If true, one value will be replayed when subscribing to
 *      the component value. For example, this would send the
 *      current option value of the widget to the backend when
 *      the binding is created.
 * @property {boolean} [partial=false]
 *      Optional partial parameter used if ``src`` specifies a
 *      list of sources. This parameter is passed to the resulting
 *      ListValue.
 * @property {number} [debounce=0]
 *      Optional parameter used if a ListValue is created.
 */

/**
 * Creates a binding to a target component.
 *
 * @param {Node} targetNode
 *      The node to bind to.
 * @param {Node} sourceNode
 *      The source node which initiated this binding. This node is used
 *      for calculating the prefix.
 * @param {*} ctx
 *      The context in which callbacks such as ``options.pipe``,
 *      ``options.transformReceive`` and ``options.transformSend`` is called.
 * @param {IBindingDescription} options
 *      The binding description.
 * @param {function} [log]
 *      An optional callback which is called with debug output. This function
 *      is expected to have the same signature as ``console.log``.
 */
export function createBinding(targetNode, sourceNode, ctx, options, log) {
  let backendValue = options.backendValue;

  if (!backendValue) {
    const { src, srcPrefix } = options;

    const effectiveSrc = compileSrc(src, () => {
      if (Array.isArray(srcPrefix)) {
        return srcPrefix.map((handle) => {
          return collectPrefix(sourceNode, handle);
        });
      } else {
        return collectPrefix(sourceNode, srcPrefix);
      }
    });

    if (log) log('Source of binding %o is %o', options, effectiveSrc);

    if (effectiveSrc === null) return null;

    if (Array.isArray(effectiveSrc)) {
      backendValue = new ListValue(
        effectiveSrc.map(getBackendValue),
        options.partial || false,
        options.debounce || 0
      );
    } else {
      backendValue = getBackendValue(effectiveSrc);
    }
  }

  if (options.pipe) {
    const tmp = options.pipe.call(ctx, backendValue);

    if (log) log('Applying pipe %o(%o) => %o', options.pipe, backendValue, tmp);

    if (!tmp) return null;

    backendValue = tmp;
  }

  const binding = bindingFromComponent(targetNode, options.name, options);

  if (log)
    log('created binding for %o in component %o.', options.name, targetNode);

  const transformReceive = options.transformReceive
    ? options.transformReceive.bind(ctx)
    : null;

  const transformSend = options.transformSend
    ? options.transformSend.bind(ctx)
    : null;

  return connect(
    backendValue,
    options.replayReceive === void 0 ? true : !!options.replayReceive,
    transformReceive,
    binding,
    !!options.replaySend,
    transformSend
  );
}

/**
 * A class for managing a collection of bindings for a node.
 */
export class Bindings {
  /**
   * @param {Node} targetNode
   *    Node to install bindings on.
   * @param {Node} [sourceNode=targetNode]
   *    The source node which initiated this binding. This node is used
   *    for calculating the prefix.
   * @param {*} [ctx=sourceNode]
   *    The context in which callbacks such as ``pipe``,
   *    ``transformReceive`` and ``transformSend`` is called.
   * @param {function} [log]
   *    An optional callback which is called with debug output. This function
   *    is expected to have the same signature as ``console.log``.
   */
  constructor(targetNode, sourceNode, ctx, log) {
    this._subscriptions = new Map();
    this._targetNode = targetNode;
    this._sourceNode = sourceNode || targetNode;
    this._ctx = ctx || this._sourceNode;
    this._log = log;
    this._bindings = null;
  }

  log(fmt, ...args) {
    const log = this._log;

    if (!log) return;

    log(fmt, ...args);
  }

  /**
   * Update the bindings.
   * @param {IBindingDescription[]|null} bindings
   */
  update(bindings) {
    const n = new Set(bindings || []);
    const subscriptions = this._subscriptions;
    subscriptions.forEach((sub, options) => {
      if (n.has(options)) return;
      subscriptions.delete(options);
      runCleanupHandler(sub);
    });
    this.log('Creating %d bindings.', n.size);
    n.forEach((options) => {
      const sub = createBinding(
        this._targetNode,
        this._sourceNode,
        this._ctx,
        options,
        this._log
      );
      subscriptions.set(options, sub);
    });
    this._bindings = bindings;
  }

  /**
   * Reinitialize all bindings which depend on the prefix with given handle.
   * @param {string|null} handle
   */
  updatePrefix(handle) {
    const subscriptions = this._subscriptions;
    subscriptions.forEach((sub, options) => {
      if (!dependsOnPrefix(options, handle)) return;
      runCleanupHandler(sub);
      sub = createBinding(
        this._targetNode,
        this._sourceNode,
        this._ctx,
        options,
        this._log
      );
      subscriptions.set(options, sub);
    });
  }

  /**
   * Remove all bindings.
   */
  dispose() {
    const tmp = Array.from(this._subscriptions.values());
    this._subscriptions.clear();
    tmp.forEach(runCleanupHandler);
    this._bindings = null;
  }
}
