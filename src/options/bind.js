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
    this.ignoreInteraction = options.ignoreInteraction;
    this.node = options.node;
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
    this.node.log('Sending value %o', value);
    this.backendValue.set(value);
  }

  _subscribeInteractionEnd(widget, timeout, callback) {
    if (!(timeout > 0)) {
      // if the timeout is zero, we immediately continue with
      // the new value
      return widget.once('set_interacting', callback);
    }

    let sub;

    sub = widget.subscribe('set_interacting', (interacting) => {
      if (interacting) return;

      setTimeout(() => {
        if (sub === null) return;
        if (widget.get('interacting')) return;
        sub();
        sub = null;
        callback();
      }, timeout);
    });

    return () => {
      if (sub === null) return;
      sub();
      sub = null;
    };
  }

  valueReceived(value) {
    if (this._receiving) return;

    // we are waiting for interaction to end
    if (this._interacting_sub !== null) {
      this._lastValue = value;
      return;
    }

    this._receiving = true;

    try {
      const widget = this.widget;

      if (!this.ignoreInteraction && widget.get('interacting') === true) {
        this._lastValue = value;

        this._interacting_sub = this._subscribeInteractionEnd(
          widget,
          this.receiveDelay,
          () => {
            const value = this._lastValue;
            this._interacting_sub = null;
            this._lastValue = null;
            this.valueReceived(value);
          }
        );
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
    options.afterReceive = parseAttribute(
      'javascript',
      node.getAttribute('after-receive'),
      null
    );
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
    sub = this._interacting_sub;
    if (sub !== null) sub();
  }
}

registerOptionType('bind', BindOption);
