import { Option } from './option.js';
import { parseAttribute } from '../utils/parse_attribute.js';
import { warn } from '../utils/log.js';
import { getAuxWidget } from '../utils/aux-support.js';

function compareQueries(query1, query2) {
  if (query1 === query2) return true;
  if (typeof query1 !== typeof query2) return false;

  return query1.replace(/\s/g, '') === query2.replace(/\s/g, '');
}

/**
 * This option type can be used to bind CSS media queries to aux widet
 * options.
 *
 * When this option is created from a :ref:`OptionComponent` the following
 * attributes are parsed on creation and passed as options to the constructor
 * along with those options already parsed by :ref:`OptionComponent`.
 *
 * - ``format`` is passed as a string as the ``format`` option (default is
 *   ``json``),
 * - ``values`` is passed as parsed according to the ``format`` option and passed
 *   as the ``values`` option and
 * - ``media`` is used to create a MediaQuery using the ``matchMedia`` function
 *   which is passed as the ``query`` option.
 *
 * @param {object} options
 * @param {string} options.name
 *    The option name in the component to set.
 * @param {Array} options.values
 *    An array of length two. The first item in this array is set
 *    as the option value when the media queries is false, the second when
 *    the media query is true.
 * @param {MediaQuery} options.query
 *    The media query to subscribe to.
 * @param {Node} component
 *    The component to set an option on.
 */
export class MediaOption extends Option {
  constructor(options, component) {
    super(options);
    this.widget = getAuxWidget(component);
    this.values = options.values;
    this.query = options.query;
    this._handler = () => {
      const matches = this.query.matches;
      const value = Array.isArray(this.values)
        ? this.values[matches ? 1 : 0]
        : matches;
      this.widget.set(this.name, value);
    };

    this.query.addListener(this._handler);
    this._handler();
  }

  static optionsFromNode(node) {
    const options = Option.optionsFromNode(node);
    const format = node.getAttribute('format') || 'json';

    options.values = parseAttribute(format, node.getAttribute('values'), null);

    const media = node.getAttribute('media');

    const query = matchMedia(media);

    if (!compareQueries(query.media, media)) {
      warn(
        'Possibly malformed media query %o (is parsed as %o)',
        media,
        query.media
      );
    }

    options.query = query;

    return options;
  }

  destroy() {
    super.destroy();
    this.widget.reset(this.name);
    this.query.removeListener(this._handler);
  }
}
