import { Option } from './option.js';
import { parseAttribute } from '../utils/parse_attribute.js';

export class StaticOption extends Option {
  constructor(options) {
    super(options);

    this.widget.set(this.name, options.value);
  }

  static optionsFromNode(node) {
    const options = Option.optionsFromNode(node);
    const format = node.getAttribute('format') || 'json';

    options.value = parseAttribute(format, node.getAttribute('value'));

    return options;
  }

  destroy() {
    super.destroy();
    this.widget.reset(this.name);
  }
}
