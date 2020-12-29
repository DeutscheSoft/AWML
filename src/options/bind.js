import { Option } from './option.js';
import { parseAttribute } from '../utils/parse_attribute.js';
import { bindingFromComponent } from '../utils/aux-support.js';
import { connect } from '../operators/connect.js';

function combineSubscriptions(a, b) {
  if (!a && !b) return null;
  if (!b) return a;
  if (!a) return b;
  return () => {
    a();
    b();
  };
}

export class BindOption extends Option {
  static get needsBackendValue() {
    return true;
  }

  constructor(options, component) {
    super(options);

    this.backendValue = options.backendValue;
    this.transformSend = options.transformSend;
    this.node = options.node;
    this.transformReceive = this.node.transformReceive;

    const dv = bindingFromComponent(component, this.name, {
      readonly: options.writeonly,
      writeonly: options.readonly,
      sync: options.sync,
      preventDefault: options.preventDefault,
      ignoreInteraction: options.ignoreInteraction,
      receiveDelay: options.receiveDelay,
    });

    if (typeof dv.then === 'function') {
      return dv;
    }

    this._sub = connect(
      options.backendValue,
      true,
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
    options.transformSend = parseAttribute(
      'javascript',
      node.getAttribute('transform-send'),
      null
    );

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
