import { Option } from './option.js';
import { parseAttribute } from '../utils/parse_attribute.js';

function subscribeInteractionChange(widget, timeout, callback)
{
  let state = widget.get('interacting');
  let tid;

  callback(state);

  const sub = widget.subscribe('set_interacting', (value) => {
    if (value || !(timeout > 0))
    {
      if (state == value) return;
      callback(state = value);
    }
    else
    {
      if (tid !== void(0))
        clearTimeout(tid);

      state = value;

      tid = setTimeout(() => {
        if (state) return;
        callback(state);
      }, timeout);
    }
  });

  return () => {
    sub();
    if (tid !== void(0))
    {
      clearTimeout(tid);
      tid = void(0);
    }
  };
}

function combineSubscriptions(a, b)
{
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
    this._receiving = false;
    this._hasLastValue = false;
    this._lastValue = null;
    this._interacting = false;

    let sub1 = null;
    let sub2 = null;

    if (!readonly) {
      if (writeonly) {
        sub1 = this.widget.subscribe('userset', (name, value) => {
          if (name !== this.name) return;
          this.sendValue(value);
          return false;
        });
      } else if (sync) {
        sub1 = this.widget.subscribe('set_' + this.name, (value) => {
          if (this._receiving) return;
          this.sendValue(value);
        });
      } else {
        sub1 = this.widget.subscribe('useraction', (name, value) => {
          if (name !== this.name) return;
          this.sendValue(value);
          if (preventDefault) return false;
        });
      }
    }

    if (!this.ignoreInteraction) {
      sub2 = subscribeInteractionChange(this.widget, this.receiveDelay, (value) => {
        this._interacting = value;

        if (value || !this._hasLastValue)
          return;

        const lastValue = this._lastValue;
        this._lastValue = null;
        this._hasLastValue = false;
        this.valueReceived(lastValue);
      });
    }

    this._sub = combineSubscriptions(sub1, sub2);
  }

  sendValue(value) {
    if (this.transformSend !== null) {
      value = this.transformSend(value);
    }
    this.node.log('Sending value %o', value);
    this.backendValue.set(value);
  }

  valueReceived(value) {
    if (this._receiving) return;

    if (this._interacting) {
      this._lastValue = value;
      this._hasLastValue = true;
      return;
    }

    this._receiving = true;

    try {
      const widget = this.widget;

      widget.set(this.name, value);

      if (this.afterReceive !== null) {
        this.afterReceive(this.backendValue, widget, value, this);
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
  }
}
