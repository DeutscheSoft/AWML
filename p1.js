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
          x = w.P1.options[match[1]];
      } else if (Number.parseFloat(x).toString() == x) {
          x = Number.parseFloat(x);
      }

      return x;

  }
  function do_merge_options(o1, o2) {
    var x;

    if (!o1)
        return o2;
    if (!o2)
        return o1;

    for (x in o2) {
        if (typeof o1[x] === object &&
            typeof o2[x] === object &&
            Object.getPrototype(o1[x]) == null &&
            Object.getPrototype(o2[x]) == null)
            do_merge_options(o1[x], o2[x]);
        else
            o1[x] = o2[x];
    }
  }
  
  w.P1 = {
    options: { defaults: {} },
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
                merge_options = w.P1.options[value];
            }
            options[name] = parse(name, value);
        }
        options = do_merge_options(merge_options, options);
        options = do_merge_options(w.P1.options.defaults[tagName], options);
        this.widget = new widget(options);
      };
      proto.attachedCallback = function() {
        var parent_node = find_parent.call(this);
        if (parent_node) parent_node.widget.add_child(this.widget);
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
          w.P1[key] = w.P1.registerWidget("p1-"+key.toLowerCase(), f);
      }
  }

})(this);
