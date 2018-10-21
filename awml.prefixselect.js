"use strict";
(function(w, TK, AWML){

if (!TK.Select) return;

function update_prefix() {
  var O = this.options;
  var p = this.find_prefix_parent();

  if (!p) {
    AWML.warn("No matching parent for %o", s);
    return;
  }

  var tmp = this.current();
  var prefix;

  if (tmp) prefix = tmp.get("value");

  var f = O.format_prefix;
  var handle = O.handle;

  if (f) prefix = f.call(this, prefix);

  var s = O.child_selector;

  if (s) {
    p.querySelectorAll(s).forEach(function(e) {
      if (tmp) AWML.set_prefix(e, prefix, handle);
      else AWML.set_prefix_block(e, handle);
    }, this);
  } else {
    if (tmp) AWML.set_prefix(p, prefix, handle);
      else AWML.set_prefix_block(p, handle);
  }
}

TK.PrefixSelect = TK.class({
  _class: "PrefixSelect",
  Extends: TK.Select,
  _options: Object.assign(Object.create(TK.Select.prototype._options), {
    parent_selector: "string",
    child_selector: "string",
    format_prefix: "function",
    handle: "string",
  }),
  options: {
    parent_selector: "*",
    child_selector: null,
    format_prefix: null,
  },
  static_events: {
    set_selected: function(val) {
      TK.S.add(update_prefix.bind(this), 1);
    },
    initialized: update_prefix,
  },
  find_prefix_parent: function() {
    var O = this.options;

    var s = O.parent_selector;
    var o = this.element.parentNode;

    while (o) {
      if (o.matches(s)) return o;
      o = o.parentNode;
    }

    return o;
  },
  find_prefix_target: function() {
    var p = this.find_prefix_parent();

    if (!p) return null;

    var s = this.options.child_selector;

    if (!s) return p;

    return p.querySelector(s);
  },
  redraw: function() {
    TK.Select.prototype.redraw.call(this);
  },
});
/* FIXME: It would be great if we could support loading/registering widgets on
 * demand. But this is an ok workaround  */
AWML.Tags.PrefixSelect = AWML.registerWidget("awml-prefixselect", TK.PrefixSelect);
})(this, this.TK, this.AWML);
