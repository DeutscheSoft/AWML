export class Option {
  constructor(options) {
    this.name = options.name;
    this.node = options.node;
  }

  static optionsFromNode(node) {
    return {};
  }

  destroy() {}
}
