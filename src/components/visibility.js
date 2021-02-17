import { StylesComponentBase } from './styles_component_base.js';
import {
  maybeAuxElement,
  getAuxWidget,
  subscribeCustomElement,
} from '../utils/aux-support.js';

const MODE_NONE = -1;
const MODE_AUX_CHILD = 0;
const MODE_AUX_WIDGET = 1;
const MODE_DOM_NODE = 2;

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

  _determineVisibilityMode() {
    const target = this.target;
    const widget = target.auxWidget;

    if (widget !== void 0) {
      const parent = widget.parent;

      if (parent) {
        return MODE_AUX_CHILD;
      } else {
        return MODE_AUX_WIDGET;
      }
    } else {
      return MODE_DOM_NODE;
    }
  }

  _updateVisibility(mode, hidden) {
    const target = this.target;
    const widget = target.auxWidget;

    switch (mode) {
      case MODE_AUX_CHILD:
        {
          this.log('Changing visibility in parent container.');

          const parent = widget.parent;

          if (parent) {
            if (hidden) {
              parent.hideChild(widget);
            } else {
              parent.showChild(widget);
            }
          }
        }
        break;
      case MODE_AUX_WIDGET:
        this.log('Changing visibility as auxWidget.');

        if (hidden) {
          widget.hide();
        } else {
          widget.show();
        }
        break;
      case MODE_DOM_NODE:
        this.log('Changing visibility as DOM node.');

        if (hidden) {
          target.style.display = 'none';
        } else {
          target.style.removeProperty('display');
        }
        break;
    }
  }

  _changeVisibility(hidden) {
    const target = this.target;
    const widget = target.auxWidget;

    const currentMode = this._determineVisibilityMode();
    const lastMode = this._visbilityMode;

    // If the mode has changed we need to reverse it. This can happen when a
    // parent container has not been initialized, yet or we belive our parent
    // node is a DOM node.
    if (lastMode !== MODE_NONE && lastMode !== currentMode && this._hidden) {
      this._updateVisibility(lastMode, false);
    }

    this._hidden = hidden;
    this._visbilityMode = currentMode;

    this._updateVisibility(currentMode, hidden);
  }

  /** @ignore */
  triggerDraw() {
    const target = this.target;
    const widget = target.auxWidget;

    if (!this.isConnected) return;

    // if our target is an aux widget, we apply the display state immediately.
    // aux widgets have their own redraw dispatching logic.
    if (widget === void 0) return super.triggerDraw();

    this.log('executing redraw immediately on %o', target);
    this._willDraw = false;
    this.redraw();
  }

  updateState(oldState, newState) {
    this.applyState(newState);
  }

  constructor() {
    super();
    this._visibilityMode = MODE_NONE;
    this._hidden = false;
  }
}

/**
 * The `AWML-HIDE` component hides its parent widget if the
 * corresponding backend value is true.
 */
export class HideComponent extends VisibilityComponent {
  /** @ignore */
  static get observedAttributes() {
    return StylesComponentBase.observedAttributes;
  }

  /** @ignore */
  applyState(v) {
    this._changeVisibility(!!v);
  }

  /** @ignore */
  removeState(v) {
    this._changeVisibility(!v);
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
    this._changeVisibility(!v);
  }

  /** @ignore */
  removeState(v) {
    this._changeVisibility(!!v);
  }
}
