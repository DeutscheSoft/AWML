import { StylesComponentBase } from './styles_component_base.js';
import {
  maybeAuxElement,
  getAuxWidget,
  subscribeCustomElement,
} from '../utils/aux.js';

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

export class VisibilityComponent extends StylesComponentBase {
  _subscribe() {
    const parentNode = this.parentNode;

    if (maybeAuxElement(parentNode)) {
      if (getAuxWidget(parentNode) === null)
        return subscribeCustomElement(parentNode, () => this._resubscribe());
    }

    return super._subscribe();
  }
}

export class HideComponent extends VisibilityComponent {
  static get observedAttributes() {
    return StylesComponentBase.observedAttributes;
  }

  applyState(v) {
    changeVisibility(this._target, !!v);
  }

  removeState(v) {
    changeVisibility(this._target, !v);
  }
}

customElements.define('awml-hide', HideComponent);

export class ShowComponent extends VisibilityComponent {
  static get observedAttributes() {
    return StylesComponentBase.observedAttributes;
  }

  applyState(v) {
    changeVisibility(this._target, !v);
  }

  removeState(v) {
    changeVisibility(this._target, !!v);
  }
}

customElements.define('awml-show', ShowComponent);
