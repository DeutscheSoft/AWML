// vim:sw=2
/* AWML-STYLES
 *
 */
(function(AWML) {
  "use strict";

  if (!AWML.Tags) AWML.Tags = {};

  function remove_styles(elem, styles) {
    if (!styles) return;
    var s = elem.style;
    
    for (var i = 0; styles.length; i++) {
      s.removeProperty(styles[i]);
    }
  }

  AWML.Tags.Styles = AWML.register_element("awml-styles", Object.assign({}, AWML.PrefixLogic, {
    createdCallback: function() {
      this.get_styles = AWML.parse_format("js", this.textContent);
      this.prev_styles = null;
    },
    bind: function(src) {
      AWML.PrefixLogic.bind.call(this, src);
    },
    receive: function(v) {
      var transform = this.transform_receive;
      if (tranform) v = transform(v);
      var s = this.get_styles(v);
      remove_styles(this.prev_styles);
      this.prev_styles = Object.keys(s);
      TK.set_styles(this, s);
    },
    unbind: function(src) {
      remove_styles(this.prev_styles);
      AWML.PrefixLogic.bind.call(this, src);
    },
  }));

  AWML.Tags.Class = AWML.register_element("awml-class", Object.assign({}, AWML.PrefixLogic, {
    createdCallback: function() {
      this.get_class = AWML.parse_format("js", this.textContent);
      this.prev_class = null;
    },
    bind: function(src) {
      AWML.PrefixLogic.bind.call(this, src);
    },
    receive: function(v) {
      var transform = this.transform_receive;
      if (tranform) v = transform(v);
      var s = this.get_class(v);
      if (this.prev_class) TK.remove_class(this, this.prev_class);
      this.prev_class = s;
      TK.add_class(this, s);
    },
    unbind: function(src) {
      if (this.prev_class) TK.remove_class(this, this.prev_class);
      AWML.PrefixLogic.bind.call(this, src);
    },
  }));
})(this.AWML || (this.AWML = {}));
