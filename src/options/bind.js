import { Option } from './option.js';
import { parseAttribute } from '../utils/parse_attribute.js';
import { bindingFromComponent } from '../utils/aux-support.js';
import { connect } from '../operators/connect.js';

/**
 * This option type is used to create two-way bindings between backend values
 * and components.
 *
 * When this option is created from a :ref:`OptionComponent` the following
 * attributes are parsed on creation and passed as options to the constructor
 * along with those options already parsed by :ref:`OptionComponent`.
 *
 * - ``readonly`` as the ``readonly = true`` if present,
 * - ``writeonly`` as the ``writeonly = true`` if present,
 * - ``sync`` as the ``sync`` option if present,
 * - ``prevent-default`` as the ``preventDefault = true`` option if present,
 * - ``prevent-change`` as the ``preventChange = true`` option if present,
 * - ``transform-send`` is parsed as JavaScript and passed as ``transformSend``
 *   option,
 * - ``transform-receive`` is parsed as JavaScript and passed as
 *   ``transformReceive`` option,
 * - ``receive-delay`` is parsed as an integer and passed as ``receiveDelay``
 *   option and
 * - ``ignore-interaction`` is passed as ``ignoreInteraction = true`` if
 *   present.
 *
 * Passes the options ``readonly``, ``writeonly``,
 * ``sync``, ``preventDefault``, ``ignoreInteraction`` and ``receiveDelay`` to
 * a call to :ref:`bindingFromComponent`.
 *
 * The option ``transformSend`` is a function (or null) which is called to
 * transform a value before it is passed to the backend.
 *
 * The option ``transformReceive`` is a function (or null) which is called to
 * transform a value before it is passed from the backend to the component.
 *
 * @param {object} options
 *    The options for this binding.
 * @param {DynamicValue} options.backendValue
 *    The backend value to bind to.
 * @param {string} options.name
 *    The option name in the component to bind to.
 * @param {Node} component
 *    The component to bind to.
 */
export class BindOption extends Option {
  static get needsBackendValue() {
    return true;
  }

  constructor(options, component) {
    super(options);

    this.backendValue = options.backendValue;
    this.transformSend = options.transformSend;
    this.node = options.node;
    this.transformReceive = options.transformReceive;

    const dv = bindingFromComponent(component, this.name, {
      readonly: options.writeonly,
      writeonly: options.readonly,
      sync: options.sync,
      preventDefault: options.preventDefault,
      preventChange: options.preventChange,
      ignoreInteraction: options.ignoreInteraction,
      receiveDelay: options.receiveDelay,
    });

    if (typeof dv.then === 'function') {
      return dv;
    }

    this._sub = connect(
      options.backendValue,
      options.replay,
      this.receiveValue.bind(this),
      dv,
      false,
      this.sendValue.bind(this)
    );
  }

  sendValue(value) {
    if (this.transformSend !== null) {
      value = this.transformSend(value);
    }
    this.node.log('Sending value %o', value);
    return value;
  }

  receiveValue(value) {
    const transformReceive = this.transformReceive;

    if (transformReceive !== null) {
      const tmp = transformReceive.call(this.backendValue, value, this.node);
      this.node.log('Received value %o -> %o', value, tmp);
      value = tmp;
    } else {
      this.node.log('Received value %o', value);
    }

    return value;
  }

  static optionsFromNode(node) {
    const options = Option.optionsFromNode(node);

    options.node = node;
    options.backendValue = node._backendValue;
    options.readonly = node.getAttribute('readonly') !== null;
    options.writeonly = node.getAttribute('writeonly') !== null;
    options.sync = node.getAttribute('sync') !== null;
    options.preventDefault = node.getAttribute('prevent-default') !== null;
    options.preventChange = node.getAttribute('prevent-change') !== null;
    options.transformSend = node.transformSend;
    options.transformReceive = node.transformReceive;
    options.replay = node.replay;

    const afterReceive = parseAttribute(
      'javascript',
      node.getAttribute('after-receive'),
      null
    );

    if (afterReceive) {
      error('Support for after-received has been dropped.');
    }

    options.receiveDelay = parseAttribute(
      'int',
      node.getAttribute('receive-delay'),
      500
    );
    options.ignoreInteraction =
      node.getAttribute('ignore-interaction') !== null;

    return options;
  }

  destroy() {
    super.destroy();
    let sub = this._sub;
    if (sub !== null) sub();
  }
}
