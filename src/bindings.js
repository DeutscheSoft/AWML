import { connect, connectTo } from './operators/connect.js';
import { collectPrefix, compileSrc } from './utils/prefix.js';
import { getBackendValue } from './backends.js';
import { ListValue } from './list_value.js';
import {
  bindingFromComponent,
  bindingFromWidget,
} from './utils/aux-support.js';
import { runCleanupHandler } from './utils/run_cleanup_handler.js';
import { log as defaultLog } from './utils/log.js';

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
 * @property {function} [log]
 *      An optional function called for generating log output.
 * @property {boolean} [debug=false]
 *      If true, and ``log`` is undefined, ``log`` will be set
 *      to console.log.
 * @property {number} [debounce=0]
 *      Optional parameter used if a ListValue is created.
 */

function logReceive(log, transform) {
  if (!log) return transform;

  if (transform) {
    return function (value) {
      const tmp = transform(value);
      log('Received value %o -> %o', value, tmp);
      return tmp;
    };
  } else {
    return function (value) {
      log('Received value %o', value);
      return value;
    };
  }
}

function logSend(log, transform) {
  if (!log) return transform;

  if (transform) {
    return function (value) {
      const tmp = transform(value);
      log('Sending value %o -> %o', value, tmp);
      return tmp;
    };
  } else {
    return function (value) {
      log('Sending value %o', value);
      return value;
    };
  }
}

/**
 * Creates a binding to a target component or target widget.
 *
 * @param {Node|Widget} target
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
export function createBinding(target, sourceNode, ctx, options, log) {
  let backendValue = options.backendValue;

  if (!log && options.debug)
    log = function (fmt, ...args) {
      defaultLog('Binding(%o, %o): ' + fmt, target, options, ...args);
    };

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

    if (log) log('Source is %o', effectiveSrc);

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

  let binding;
  const bindingOptions = {
    readonly: options.writeonly,
    writeonly: options.readonly,
    sync: options.sync,
    preventDefault: options.preventDefault,
    preventChange: options.preventChange,
    ignoreInteraction: options.ignoreInteraction,
    receiveDelay: options.receiveDelay,
    debug: options.debug,
  };

  if (target instanceof Node) {
    binding = bindingFromComponent(target, options.name, bindingOptions);
  } else if (typeof target === 'object') {
    // We assume it is a widget.
    binding = bindingFromWidget(target, options.name, bindingOptions);
  } else {
    throw new TypeError('Expected target node or widget.');
  }

  if (log) log('Created binding for %o in component %o.', options.name, target);

  const transformReceive = logReceive(
    log,
    options.transformReceive ? options.transformReceive.bind(ctx) : null
  );

  const transformSend = logSend(
    log,
    options.transformSend ? options.transformSend.bind(ctx) : null
  );

  if (options.readonly) {
    return connectTo(
      binding,
      backendValue,
      options.replayReceive === void 0 ? true : !!options.replayReceive,
      transformReceive
    );
  } else if (options.writeonly) {
    return connectTo(
      backendValue,
      binding,
      !!options.replaySend,
      transformSend
    );
  } else {
    return connect(
      backendValue,
      options.replayReceive === void 0 ? true : !!options.replayReceive,
      transformReceive,
      binding,
      !!options.replaySend,
      transformSend
    );
  }
}

/**
 * A class for managing a collection of bindings for a node.
 */
export class Bindings {
  /**
   * @param {Node|Widget} target
   *    Node to install bindings on.
   * @param {Node} [sourceNode=target]
   *    The source node which initiated this binding. This node is used
   *    for calculating the prefix.
   * @param {*} [ctx=sourceNode]
   *    The context in which callbacks such as ``pipe``,
   *    ``transformReceive`` and ``transformSend`` is called.
   * @param {function} [log]
   *    An optional callback which is called with debug output. This function
   *    is expected to have the same signature as ``console.log``.
   */
  constructor(target, sourceNode, ctx, log) {
    this._subscriptions = new Map();
    this._target = target;
    this._sourceNode =
      sourceNode || (target instanceof Node ? target : target.element);
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
   * @param {IBindingDescription|IBindingDescription[]|null} bindings
   */
  update(bindings) {
    if (bindings === null || bindings === void 0) {
      bindings = [];
    } else if (typeof bindings === 'object') {
      if (!Array.isArray(bindings)) {
        bindings = [bindings];
      }
    } else {
      throw new TypeError('Expected IBindingDescription[].');
    }

    const n = new Set(bindings || []);
    const subscriptions = this._subscriptions;
    subscriptions.forEach((sub, options) => {
      if (n.has(options)) return;
      subscriptions.delete(options);
      runCleanupHandler(sub);
    });
    this.log('Creating %d bindings.', n.size);
    n.forEach((options) => {
      if (subscriptions.has(options)) return;
      const sub = createBinding(
        this._target,
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
        this._target,
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
