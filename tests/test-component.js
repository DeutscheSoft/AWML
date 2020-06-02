import { EventTarget } from '../src/utils/event_target.js';

class TestWidget extends EventTarget {
  constructor() {
    super();
    this.options = {};
  }

  set(name, value) {
    this.options[name] = value;
    this.emit('set_' + name, value, name);
  }

  userset(name, value) {
    this.emit('userset', name, value);
    this.emit('useraction', name, value);
    this.set(name, value);
  }

  reset(name) {
    this.options[name] = void 0;
  }

  get(name) {
    return this.options[name];
  }

  subscribe(...args) {
    return super.subscribeEvent(...args);
  }
}

class TestComponent extends HTMLElement {
  constructor() {
    super();
    this.auxWidget = new TestWidget();
  }
}

customElements.define('test-component', TestComponent);
