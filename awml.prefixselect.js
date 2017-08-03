"use strict";
(function(w, TK, AWML){

function find_parent(s) {
  var o = this.element.parentNode;

  while (o) {
    if (o.matches(s)) return o;
    o = o.parentNode;
  }

  return o;
}

function update_prefix() {
  var O = this.options;

  var s = O.parent_selector;
  var p = find_parent.call(this, s);

  if (!p) {
    AWML.warn("No matching parent for %o", s);
    return;
  }

  var prefix = this.current_value();

  var f = O.format_prefix;
  var handle = O.handle;

  if (f) prefix = f.call(this, prefix);

  s = O.child_selector;

  if (s) {
    p.querySelectorAll(s).forEach(function(e) {
      AWML.set_prefix(e, prefix, handle);
    }, this);
  } else {
    AWML.set_prefix(p, prefix, handle);
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
    useraction: function(key, val) {
      if (key === "selected")
        TK.S.add(update_prefix.bind(this), 1);
    },
    initialized: update_prefix,
  },
  redraw: function() {
    TK.Select.prototype.redraw.call(this);
  },
});
/* FIXME: It would be great if we could support loading/registering widgets on
 * demand. But this is an ok workaround  */
AWML.Tags.PrefixSelect = AWML.registerWidget("awml-prefixselect", TK.PrefixSelect);
})(this, this.TK, this.AWML);
