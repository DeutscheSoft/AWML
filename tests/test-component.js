class TestWidget {
  constructor() {
    this.options = {};
  }

  set(name, value) {
    this.options[name] = value;
  }

  reset(name) {
    this.options[name] = void 0;
  }

  get(name) {
    return this.options[name];
  }
}

class TestComponent extends HTMLElement {
  constructor() {
    super();
    this.auxWidget = new TestWidget();
  }
}

customElements.define('test-component', TestComponent);
