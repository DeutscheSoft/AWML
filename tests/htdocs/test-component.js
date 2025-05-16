import { TestWidget } from './test-widget.js';

class TestComponent extends HTMLElement {
  constructor() {
    super();
    this.auxWidget = new TestWidget();
  }
}

customElements.define('test-component', TestComponent);
