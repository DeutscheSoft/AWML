import { PrefixComponentBase } from './prefix_component_base.js';
import { error } from '../utils/log.js';

let drawQueue = [];

function runDraw() {
  const q = drawQueue;

  drawQueue = [];

  for (let i = 0; i < q.length; i++) {
    try {
      q[i]();
    } catch (err) {
      error('Draw function threw an error: %o', err);
    }
  }
}

function scheduleDraw(cb) {
  if (drawQueue.length === 0) requestAnimationFrame(runDraw);

  drawQueue.push(cb);
}

/**
 * Base class for components which update the DOM inside of a rendering frame.
 */
export class RedrawComponentBase extends PrefixComponentBase {
  /** @ignore */
  static get observedAttributes() {
    return PrefixComponentBase.observedAttributes;
  }

  constructor() {
    super();
    this._redraw = () => {
      this._willDraw = false;
      if (!this.isConnected) return;
      this.redraw();
    };
    this._willDraw = false;
    this._value = null;
  }

  /** @protected */
  triggerDraw() {
    if (this._willDraw) return;
    this._willDraw = true;
    scheduleDraw(this._redraw);
  }

  /** @ignore */
  _valueReceived(value) {
    this._value = value;
    this.triggerDraw();
  }
}
