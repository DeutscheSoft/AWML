import { Option } from './option.js';
import { parseAttribute } from '../utils/parse_attribute.js';
import { getAuxWidget } from '../utils/aux-support.js';

/**
 * This option type is used to set aux widet options to static values.
 *
 * When this option is created from a :ref:`OptionComponent` the following
 * attributes are parsed on creation and passed as options to the constructor
 * along with those options already parsed by :ref:`OptionComponent`.
 *
 * - ``format`` is passed as a string as the ``format`` option (default is
 *   ``json``) and
 * - ``value`` is passed as parsed according to the ``format`` option and passed
 *   as the ``value`` option.
 *
 * @param {object} options
 * @param {string} name
 *    The option name in the component to set.
 * @param {*} value
 *    The option value in the component to set.
 * @param {Node} component
 *    The component to set an option on.
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
