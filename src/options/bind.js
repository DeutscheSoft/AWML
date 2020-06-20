import { Option } from './option.js';
import { registerOptionType } from '../components/option.js';
import { parseAttribute } from '../utils/parse_attribute.js';

export class BindOption extends Option {
  static get needsBackendValue() {
    return true;
  }

  constructor(options) {
    super(options);

    this.backendValue = options.backendValue;
    const readonly = options.readonly;
    const writeonly = options.writeonly;
    const sync = options.sync;
    const preventDefault = options.preventDefault;
    this.transformSend = options.transformSend;
    this.afterReceive = options.afterReceive;
    this.receiveDelay = options.receiveDelay;
    this._sub = null;
    this._interacting_sub = null;
    this._receiving = false;
    this._lastValue = null;

    if (!readonly) {
      let sub;

      if (writeonly) {
        sub = this.widget.subscribe('userset', (name, value) => {
          if (name !== this.name) return;
          this.sendValue(value);
          return false;
        });
      } else if (sync) {
        sub = this.widget.subscribe('set_' + this.name, (value) => {
          if (this._receiving) return;
          this.sendValue(value);
        });
      } else {
        sub = this.widget.subscribe('useraction', (name, value) => {
          if (name !== this.name) return;
          this.sendValue(value);
          if (preventDefault) return false;
        });
      }

      this._sub = sub;
    }
  }

  sendValue(value) {
    if (this.transformSend !== null) {
      value = this.transformSend(value);
    }
    this.backendValue.set(value);
  }

  valueReceived(value) {
    if (this._receiving) return;
    this._receiving = true;

    try {
      const widget = this.widget;

      if (widget.get('interacting') === true) {
        this._lastValue = value;
        if (this._interacting_sub !== null) return;

        this._interacting_sub = widget.once('set_interacting', () => {
          this._interacting_sub = null;
          this.valueReceived(this._lastValue);
          this._lastValue = null;
        });
      } else {
        widget.set(this.name, value);

        if (this.afterReceive !== null) {
          this.afterReceive(this.backendValue, this.widget, value, this);
        }
      }
    } finally {
      this._receiving = false;
    }
  }

  static optionsFromNode(node) {
    const options = Option.optionsFromNode(node);

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
    options.afterReceive = parseAttribute(
      'javascript',
      node.getAttribute('after-receive'),
      null
    );
    options.receiveDelay = parseAttribute(
      'int',
      node.getAttribute('receive-delay'),
      1000
    );

    return options;
  }

  destroy() {
    super.destroy();
    let sub = this._sub;
    if (sub !== null) sub();
    sub = this._interacting_sub;
    if (sub !== null) sub();
  }
}

registerOptionType('bind', BindOption);
