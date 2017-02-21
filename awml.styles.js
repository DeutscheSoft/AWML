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
    
    for (var i = 0; i < styles.length; i++) {
      s.removeProperty(styles[i]);
    }
  }

  function id(v) { return v; }

  var TK = window.TK;

  if (!TK || !TK.S) {
    AWML.error('awml.styles.js depends on toolkit');
    return;
  }

  AWML.Tags.Styles = AWML.register_element("awml-styles", Object.assign({}, AWML.PrefixLogic, AWML.RedrawLogic, {
    createdCallback: function() {
      var O = {};
      this.awml_data = O;
      AWML.PrefixLogic.createdCallback.call(this);
      AWML.RedrawLogic.createdCallback.call(this);
      O.get_styles = null;
      O.prev_styles = null;
      this.style.display = 'none';
    },
    receive: function(v) {
      this.trigger_redraw();
    },
    redraw: function() {
      var O = this.awml_data;
      var v = O.binding.value;
      if (!O.get_styles)
        O.get_styles = AWML.parse_format("js", this.textContent, id);
      var transform = O.transform_receive;
      if (transform) v = transform(v);
      var s = O.get_styles(v);
      remove_styles(this.parentNode, O.prev_styles);
      O.prev_styles = Object.keys(s);
      TK.set_styles(this.parentNode, s);
    },
    unbind: function(src) {
      var O = this.awml_data;
      this.remove_redraw();
      if (O.prev_styles)
        remove_styles(this.parentNode, O.prev_styles);
      AWML.PrefixLogic.bind.call(this, src);
    },
  }));

  AWML.Tags.Class = AWML.register_element("awml-class", Object.assign({}, AWML.PrefixLogic, AWML.RedrawLogic, {
    createdCallback: function() {
      var O = {};
      this.awml_data = O;
      AWML.PrefixLogic.createdCallback.call(this);
      AWML.RedrawLogic.createdCallback.call(this);
      O.get_class = null;
      O.prev_class = null;
      this.style.display = 'none';
    },
    receive: function(v) {
      this.trigger_redraw();
    },
    redraw: function() {
      var O = this.awml_data;
      var v = O.binding.value;
      if (!O.get_class)
        O.get_class = AWML.parse_format("js", this.textContent, id);
      var transform = O.transform_receive;
      if (transform) v = transform(v);
      var s = O.get_class(v);
      if (O.prev_class) TK.remove_class(this.parentNode, O.prev_class);
      O.prev_class = s;
      TK.add_class(this.parentNode, s);
    },
    unbind: function(src) {
      var O = this.awml_data;
      this.remove_redraw();
      if (O.prev_class) TK.remove_class(this.parentNode, O.prev_class);
      AWML.PrefixLogic.bind.call(this, src);
    },
  }));

  function remove_attributes(node, attr) {
    if (!attr) return;
    for (var i = 0; i < attr.length; i++) {
      var name = attr[i];
      node.removeAttribute(name);
    }
  }

  function add_attributes(node, attr) {
    if (!attr) return;
    for (var name in attr) {
      node.setAttribute(name, attr[name]);
    }
  }

  AWML.Tags.Attributes = AWML.register_element("awml-attributes", Object.assign({}, AWML.PrefixLogic, AWML.RedrawLogic, {
    createdCallback: function() {
      var O = {};
      this.awml_data = O;
      AWML.PrefixLogic.createdCallback.call(this);
      AWML.RedrawLogic.createdCallback.call(this);
      O.get_attributes = null;
      O.prev_attributes = null;
      this.style.display = 'none';
    },
    receive: function(v) {
      this.trigger_redraw();
    },
    redraw: function() {
      var O = this.awml_data;
      var v = O.binding.value;
      if (!O.get_attributes)
        O.get_attributes = AWML.parse_format("js", this.textContent, id);
      var transform = O.transform_receive;
      if (transform) v = transform(v);
      var s = O.get_attributes(v);
      remove_attributes(this.parentNode, O.prev_attributes);
      O.prev_attributes = Object.keys(s);
      add_attributes(this.parentNode, s);
    },
    unbind: function(src) {
      var O = this.awml_data;
      this.remove_redraw();
      remove_attributes(this.parentNode, O.prev_attributes);
      AWML.PrefixLogic.bind.call(this, src);
    },
  }));

})(this.AWML || (this.AWML = {}));
