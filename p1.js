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
      var proto = Object.create(HTMLElement.prototype);
      proto.rec_find_children = function(node) {
        var i;
        var ret = [];

        for (i = 0; i < node.childNodes.length; i++) {
            if (node.childNodes[i].is_toolkit_node) {
                ret.push(node.childNodes[i].widget);
            } else if (node.childNodes[i] != this.widget.element) {
                ret = ret.concat(this.rec_find_children(node.childNodes[i]));
            }
        }
        return ret;
      };
      proto.find_parent = function() {
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
        var parent_node;
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
        parent_node = this.find_parent();
        if (parent_node)
            this.widget.add_child(parent_node.widget);
        this.widget.show();
      };
      proto.appendChild = function(node) {
        Node.prototype.appendChild.call(this, node);
        if (this.widget) this.widget.add_children(this.rec_find_children(node));
      };
      proto.insertBefore = function(n, p) {
        Node.prototype.insertBefore.call(this, n, p);
        if (this.widget) this.widget.add_children(this.rec_find_children(n));
      };
      proto.is_toolkit_node = true;
      return document.registerElement(tagName, { prototype: proto, });
    },
  };

  for (var key in TK) {
      var f = TK[key];
      if (typeof f === "function" && f.prototype && Widget.prototype.isPrototypeOf(f.prototype)) {
          w.P1[key] = w.P1.registerWidget("p1-"+key.toLowerCase(), f);
      }
  }

})(this);
