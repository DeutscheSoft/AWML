import { EventTarget } from '../src/utils/event_target.js';

class TestWidget extends EventTarget {
  constructor() {
    super();
    this.options = {
      visbility: true,
      interacting: false,
    };
  }

  set(name, value) {
    this.options[name] = value;
    this.emit('set_' + name, value, name);
    this.emit('set', name, value);
  }

  startInteracting() {
    this.set('interacting', true);
  }

  stopInteracting() {
    this.set('interacting', false);
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

  hide() {
    this.set('visbility', false);
  }

  show() {
    this.set('visbility', true);
  }
}

class TestComponent extends HTMLElement {
  constructor() {
    super();
    this.auxWidget = new TestWidget();
  }
}

customElements.define('test-component', TestComponent);
