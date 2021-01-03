import { Option } from './option.js';
import { parseAttribute } from '../utils/parse_attribute.js';
import { getAuxWidget } from '../utils/aux-support.js';

/**
 * This option type is used to set aux widet options to static values.
 */
export class StaticOption extends Option {
  constructor(options, component) {
    super(options);

    this.widget = getAuxWidget(component);

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
