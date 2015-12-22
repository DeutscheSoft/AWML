"use strict";
(function(w) {
  w.P1 = {
    registerWidget: function registerWidget(tagName, widget) {
      var proto = Object.create(HTMLElement.prototype);
      proto.createdCallback = function() {
        var options = {
          container: this,
        };
        var attr = this.attributes;
        var O = widget.prototype._options;
        console.log(O);
        for (var i = 0; i < attr.length; i++) {
          var name = attr[i].name;
          var value = attr[i].value;
          switch (O[name]) {
          case "number":
            value = parseFloat(value); 
            break;
          case "int":
            value = parseInt(value); 
            break;
          case "string":
            break;
          case "function":
            value = new Function("", value);
            break;
          default:
            console.log("Unsupported type %o for %o=%o\n", O[name], name, value);
            continue;
          }
          options[name] = value;
        }
        this.widget = new widget(options);
        this.widget.show();
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
