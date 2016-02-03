"use strict";
(function(w) {
  function parse(name, x) {
      var match;

      // TODO: rename this to eval?
      if (match = x.match(/^js:(.*)/m)) {
          x = eval(match[1]);
      } else if (match = x.match(/^sprintf:(.*)/m)) {
          x = TK.FORMAT(match[1]);
      } else if (match = x.match(/^javascript:(.*)/m)) {
          x = new Function("", match[1]);
      } else if (match = x.match(/^json:(.*)/m)) {
          x = JSON.parse(match[1]);
      } else if (match = x.match(/^inherit:(.*)/m)) {
          x = w.AWML.options[match[1]];
      } else if (match = x.match(/^string:(.*)/m)) {
          x = match[1];
      } else if (Number.parseFloat(x).toString() == x) {
          x = Number.parseFloat(x);
      }

      return x;

  }
  function do_merge_options(o1, o2) {
    var x;
    var ret = {};

    if (!o1)
        return o2;
    if (!o2)
        return o1;

    for (x in o1)
        ret[x] = o1[x];

    for (x in o2) {
        if (typeof ret[x] === "object" &&
            typeof o2[x] === "object" &&
            Object.getPrototypeOf(ret[x]) == null &&
            Object.getPrototypeOf(o2[x]) == null)
            ret[x] = do_merge_options(ret[x], o2[x]);
        else
            ret[x] = o2[x];
    }

    return ret;
  }
  
  w.AWML = {
    options: { defaults: {} },
    set_default: function (tag, name, value) {
        var d = this.options.defaults;
        if (!d.hasOwnProperty(tag)) d[tag] = {};
        d[tag][name] = value;
    },
    registerWidget: function registerWidget(tagName, widget) {
      var dom_element = widget.prototype.DOMElement || HTMLElement;
      var proto = Object.create(dom_element.prototype);
      function find_parent() {
          var node = this.parentNode;

          if (!node)
              return undefined;

          do
              if (node.is_toolkit_node)
                  return node;
          while (node = node.parentNode);

          return undefined;
      };
      proto.createdCallback = function() {
        var options = {
          element: this,
        };
        var merge_options;
        var attr = this.attributes;
        var O = widget.prototype._options;
        console.log(O);
        for (var i = 0; i < attr.length; i++) {
            var name = attr[i].name;
            var value = attr[i].value;

            if (name == "options") {
                merge_options = w.AWML.options[value];
            }

            if (widget.prototype._options[name])
                options[name] = parse(name, value);
        }
        options = do_merge_options(merge_options, options);
        options = do_merge_options(w.AWML.options.defaults[tagName], options);
        this.widget = new widget(options);
      };
      proto.attachedCallback = function() {
        var parent_node = find_parent.call(this);
        if (parent_node) parent_node.widget.add_child(this.widget);
      };
      proto.attributeChangedCallback = function(name, old_value, value) {
          if (this.widget && widget.prototype._options[name] && !Widget.prototype._options[name] && typeof value === "string") {
              this.widget.set(name, parse(name, value));
          }
      };
      proto.is_toolkit_node = true;
      var O = { prototype: proto };
      if (dom_element !== HTMLElement) {
          O.extends = "svg";
      }
      return document.registerElement(tagName, O);
    },
  };

  for (var key in TK) {
      var f = TK[key];
      if (typeof f === "function" && f.prototype && Widget.prototype.isPrototypeOf(f.prototype)) {
          w.AWML[key] = w.AWML.registerWidget("awml-"+key.toLowerCase(), f);
      }
  }

})(this);
