import { BaseOption } from './base.js';
import { registerOptionType } from '../components/option.js';
import { parseAttribute } from '../utils/parse_attribute.js';
import { warn } from '../utils/log.js';

export class MediaOption extends BaseOption {
  constructor(options) {
    super(options);
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
    const options = BaseOption.optionsFromNode(node);
    const format = node.getAttribute('format') || 'json';

    options.values = parseAttribute(format, node.getAttribute('values'), null);

    const media = node.getAttribute('media');

    const query = matchMedia(media);

    if (query.media !== media) {
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

registerOptionType('media', MediaOption);
