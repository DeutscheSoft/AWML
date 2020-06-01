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

export class RedrawComponentBase extends PrefixComponentBase {
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

  triggerDraw() {
    if (this._willDraw) return;
    this._willDraw = true;
    scheduleDraw(this._redraw);
  }

  _valueReceived(value) {
    this.triggerDraw();
    this._value = value;
  }
}
