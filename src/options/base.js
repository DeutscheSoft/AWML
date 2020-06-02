export class BaseOption {
  constructor(options) {
    this.name = options.name;
    this.widget = options.widget;
  }

  static optionsFromNode(node) {
    return {};
  }

  destroy() {}
}
