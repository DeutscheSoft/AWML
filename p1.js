"use strict";
var P1 = {options: {}};
(function(w) {
  function parse(name, x) {
      var match;

      if (match = x.match(/^js:(.*)/m)) {
          x = eval(match[1]);
      } else if (match = x.match(/^inherit:(.*)/m)) {
          x = P1.options[match[1]];
      } else if (Number.parseFloat(x).toString() == x) {
          x = Number.parseFloat(x);
      }

      return x;

  }
  w.P1 = {
    registerWidget: function registerWidget(tagName, widget) {
      var proto = Object.create(HTMLElement.prototype);
      proto.rec_find_children = function rec_find_children(node) {
        var i;
        var ret = [];

        for (i = 0; i < node.childNodes.length; i++) {
            if (node.childNodes[i].is_toolkit_node) {
                ret.push(node.childNotes[i].widget);
            } else if (node.childNodes[i]
                       != this.widget.element) {
                ret = ret.concat(this.rec_find_children(node.childNodes[i]));
            }
        }
        return ret;
      };
      proto.createdCallback = function() {
        var options = {
          container: this,
        };
        var merge_options;
        var attr = this.attributes;
        var O = widget.prototype._options;
        console.log(O);
        for (var i = 0; i < attr.length; i++) {
            var name = attr[i].name;
            var value = attr[i].value;

            if (name == "options") {
                merge_options = P1.options[value];
            }
            options[name] = parse(name, value);
        }
        if (merge_options) {
            for (var x in options) {
                merge_options[x] = options[x];
            }
            options = merge_options;
        }
        options.element = this;
        this.widget = new widget(options);
        this.widget.add_children(this.rec_find_children(this));
        this.widget.show();
      };
      proto.appendChild = function(node) {
        Node.prototype.appendChild.call(this, node);
        this.widget.add_children(this.rec_find_children(node));
      };
      proto.insertBefore = function(n, p) {
        Node.prototype.insertBefore.call(this, n, p);
        this.widget.add_children(this.rec_find_children(n));
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
