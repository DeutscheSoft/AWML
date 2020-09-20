import { StylesComponentBase } from './styles_component_base.js';
import {
  maybeAuxElement,
  getAuxWidget,
  subscribeCustomElement,
} from '../utils/aux-support.js';

function changeVisibility(target, hidden) {
  const widget = target.auxWidget;

  if (widget !== void 0) {
    const parent = widget.parent;

    if (parent) {
      if (hidden) {
        parent.hideChild(widget);
      } else {
        parent.showChild(widget);
      }
    } else {
      if (hidden) {
        widget.hide();
      } else {
        widget.show();
      }
    }
  } else {
    if (hidden) {
      target.style.display = 'none';
    } else {
      target.style.removeProperty('display');
    }
  }
}

/** @ignore */
export class VisibilityComponent extends StylesComponentBase {
  _subscribe() {
    const parentNode = this.parentNode;

    if (maybeAuxElement(parentNode)) {
      if (getAuxWidget(parentNode) === null)
        return subscribeCustomElement(parentNode, () => this._resubscribe());
    }

    return super._subscribe();
  }

  /** @ignore */
  triggerDraw() {
    const target = this._target;
    const widget = target.auxWidget;

    // if our target is an aux widget, we apply the display state immediately.
    // aux widgets have their own redraw dispatching logic.
    if (widget === void 0) return super.triggerDraw();

    this.log('executing redraw immediately on %o', target);
    this._willDraw = false;
    if (!this.isConnected) return;
    this.redraw();
  }

  updateState(oldState, newState) {
    this.applyState(newState);
  }
}

/**
 * The `AWML-SHOW` component hides its parent widget if the
 * corresponding backend value is true.
 */
export class HideComponent extends VisibilityComponent {
  /** @ignore */
  static get observedAttributes() {
    return StylesComponentBase.observedAttributes;
  }

  /** @ignore */
  applyState(v) {
    changeVisibility(this._target, !!v);
  }

  /** @ignore */
  removeState(v) {
    changeVisibility(this._target, !v);
  }
}

/**
 * The `AWML-SHOW` component makes its parent widget visible if the
 * corresponding backend value is true.
 */
export class ShowComponent extends VisibilityComponent {
  /** @ignore */
  static get observedAttributes() {
    return StylesComponentBase.observedAttributes;
  }

  /** @ignore */
  applyState(v) {
    changeVisibility(this._target, !v);
  }

  /** @ignore */
  removeState(v) {
    changeVisibility(this._target, !!v);
  }
}
