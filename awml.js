"use strict";
(function(w) {
  function Option(name, value, attach, detach) {
    this.name = name;
    this.value = value;
    this._attach = attach;
    this._detach = detach;
    this.node = null;
    this.widget = null;
  };
  Option.prototype = {
    detach: function(node, widget) {
        if (this._detach) this._detach(node, widget);
        this.node = null;
        this.widget = null;
    },
    attach: function(node, widget) {
        this.node = node;
        this.widget = widget;
        if (this._attach) this._attach(node, widget);
    },
  };
  function attach_option(node, widget, name, value) {
      if (value instanceof Option) {
          value.attach(node, widget);
      } else if (value !== undefined) {
          widget.set(name, value);
      }
  }
  function attach_options(node, widget, options) {
      for (var key in options) {
          attach_option(node, widget, key, options[key]);
      }
  }
  function detach_option(node, widget, name, value) {
      if (value instanceof Option) {
          value.detach(node, widget);
      } else if (value !== undefined) {
          // we set it back to the default
          widget.set(name, undefined);
      }
  }
  function update_option(node, widget, name, value_old, value_new) {
      detach_option(node, widget, name, value_old);
      attach_option(node, widget, name, value_new);
  }
  function option_value(value) {
      if (value instanceof Option) return value.value;
      return value;
  }
  function has_attribute(widget, name) {
      if (widget._options[name] || name.charCodeAt(0) === 95) {
          // If the widget does not internally use the awml element itself, we have to 
          // actually use id/class. This is buggy because the 'wrong' element ends
          // up with the same class/id. We need to fix this somehow, but its not really
          // possible without renaming the option. FIXME
          return name !== "id" && name !== "class" || !widget._options.element;
      }
      return false;
  }
  function evaluate_options(options) {
      var ret = {};
      for (var key in options) {
          ret[key] = option_value(options[key]);
      }
      return ret;
  }
  function parse_type(type, x) {
      switch (type) {
      case "js":
        x = x.replace(/^\s*/g, "");
        x = x.replace(/\s*$/g, "");
        try {
            return new Function([], "return ("+x+");")();
        } catch (e) {
            TK.error("Syntax error", e, "in", x);
            return undefined;
        }
      case "json":
        try {
            return JSON.parse(x);
        } catch (e) {
            TK.error("Syntax error", e, "in JSON", x);
            return undefined;
        }
      case "string":
        return x;
      case "number":
        return parseFloat(x);
      case "int":
        return parseInt(x);
      case "sprintf":
        return TK.FORMAT(x);
      case "inherit":
        return w.AWML.options[x];
      default:
        TK.error("unsupported type", type);
        return undefined;
      }
  }
  function parse_option(name, type, value) {
      if (type === "media") {
        if (!window.matchMedia) {
            TK.error("media type AWML options are not supported in this browser:", x);
        }
        var m = window.matchMedia(value);
        var o = new Option(name, m.matches,
          function () {
            this.mql.addListener(this.handler);
            this.handler();
          },
          function () {
            this.mql.removeListener(this.handler);
          });
         o.handler = function() {
            this.widget.set(this.name, this.mql.matches);
        }.bind(o);
         o.mql = m;
         return o;
      } else {
         return parse_type(type, value);
      }
  }
  function parse_attribute(name, x) {
      var match;

      if (typeof x !== "string") return undefined;

      if (match = x.match(/^([^:]*):(.*)/m)) {
          x = parse_option(name, match[1], match[2]);
      } else if (parseFloat(x).toString() === x) {
          x = parseFloat(x);
      } else if (x === "true") {
          x = true;
      } else if (x === "false") {
          x = false;
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

  function extract_options(widget) {
    var O = widget.prototype._options;
    var tagName = this.tagName;
    var attr = this.attributes;
    var merge_options;
    var options = {};
    for (var i = 0; i < attr.length; i++) {
        var name = attr[i].name;
        var value = attr[i].value;

        if (name === "expanded") {
            options._expanded = parse_attribute("_expanded", value);
            if (typeof options._expanded === "string")
                options._expanded = true;
            continue;
        } else if (name === "collapsed") {
            options._collapsed = parse_attribute("_collapsed", value);
            if (typeof options._collapsed === "string")
                options._collapsed = true;
            continue;
        } else if (name == "options") {
            merge_options = w.AWML.options[value];
            continue;
        }

        if (widget.prototype._options[name] || name.charCodeAt(0) === 95) {
            if (!widget.prototype._options.element) {
                // TODO: we should really remove the id, to avoid collisions, but
                // this does not currently work
                /*
                    if (name === "id")
                        this.removeAttribute("id");
                */
                options[name] = parse_attribute(name, value);
            } else if (name !== "id" && name !== "class")
                options[name] = parse_attribute(name, value);
        }
    }
    options = do_merge_options(merge_options, options);
    options = do_merge_options(w.AWML.options.defaults[tagName], options);
    return options;
  }
  
  w.AWML = {
    options: { defaults: {} },
    set_default: function (tag, name, value) {
        var d = this.options.defaults;
        if (!d.hasOwnProperty(tag)) d[tag] = {};
        d[tag][name] = value;
    },
    registerWidget: function registerWidget(tagName, widget) {
      var proto = Object.create(HTMLElement.prototype);
      proto.createdCallback = function() {
        var options = this.options = extract_options.call(this, widget);
        if (widget.prototype._options.element)
            options.element = this;
        this.widget = new widget(evaluate_options(options));
        attach_options(this, this.widget, options);
      };
      proto.attachedCallback = function() {
        var parent_node = find_parent.call(this);
        if (parent_node) parent_node.widget.add_child(this.widget);
        else if (!(this.widget instanceof TK.Root)) TK.error("could not find parent for", this);
      };
      proto.detachedCallback = function() {
          if (this.widget.parent)
              this.widget.parent.remove_child(this.widget);
      };
      proto.attributeChangedCallback = function(name, old_value, value) {
          if (this.widget && has_attribute(this.widget, name)) {
              value = parse_attribute(name, value);

              update_option(this, this.widget, name, this.options[name], value);

              this.options[name] = value;
          }
      };
      proto.is_toolkit_node = true;
      var O = { prototype: proto };
      return document.registerElement(tagName, O);
    },
  };

  for (var key in TK) {
      var f = TK[key];
      if (typeof f === "function" && f.prototype && Widget.prototype.isPrototypeOf(f.prototype)) {
          w.AWML[key] = w.AWML.registerWidget("awml-"+key.toLowerCase(), f);
      }
  }

  w.AWML.Option = document.registerElement("awml-option", {
    prototype: Object.assign(Object.create(HTMLElement.prototype), {
       is_toolkit_node: true,
       createdCallback: function() {
            var data = this.textContent;
            var name = this.getAttribute("name");
            var type = this.getAttribute("type") || "string";

            data = parse_option(name, type, data);
            this.name = name;
            this.data = data;
            this.type = type;
            this.style.display = "none";
      },
      attachedCallback: function() {
        var parent_node = find_parent.call(this);
        if (!this.name) {
            return;
        }
        if (parent_node) parent_node.widget.set(this.name, this.data);
      }
    })
  });

  w.AWML.Page = document.registerElement("awml-page", {
    prototype: Object.assign(Object.create(HTMLElement.prototype), {
       is_toolkit_node: true,
       createdCallback: function() {
            var label = this.getAttribute("label");
            var options = extract_options.call(this, TK.Container);
            options.element = this;
            this.label = label;
            this.widget = new TK.Container(options);
      },
      attributeChangedCallback: function(name, old_value, value) {
          if (name !== "class" && name !== "id")
            TK.warn("not implemented");
      },
      detachedCallback: function() {
          TK.warn("not implemented");
      },
      attachedCallback: function() {
        if (this._is_attached) return;
        var parent_node = find_parent.call(this);
        // TODO:
        //  - error handling, what if parent is not a pager
        //  - this breaks if you move pages around
        if (parent_node) {
            this._is_attached = true;
            window.setTimeout(function() {
                parent_node.widget.add_page(this.label, this.widget);
            }.bind(this), 0);
        }
      }
    })
  });
  w.AWML.Filter = document.registerElement("awml-filter", {
    prototype: Object.assign(Object.create(HTMLElement.prototype), {
      is_tookit_node: true,
      createdCallback: function() {
        this.style.display = "none";
        this.options = extract_options.call(this, TK.EqBand);
      },
      attachedCallback: function() {
        var node = find_parent.call(this);
        if (node) {
          if (this.band) node.widget.remove_band(this.band);
          this.band = node.widget.add_band(this.options);
        }
      },
      detachedCallback: function() {
        var node = find_parent.call(this);
        if (node && this.band) {
          node.widget.remove_band(this.band);
          delete this.band;
        }
      }
    })
  });
  w.AWML.Event = document.registerElement("awml-event", {
    prototype: Object.assign(Object.create(HTMLElement.prototype), {
      createdCallback: function() {
          this.type = this.getAttribute("type");
          this.fun = parse_type("js", this.textContent);
          this.style.display = "none";
      },
      attributeChangedCallback: function(name, old_value, value) {
          TK.warn("not implemented");
      },
      detachedCallback: function() {
        var parent_node = find_parent.call(this);
        if (parent_node) {
            parent_node.widget.remove_event(this.type, this.fun);
        }
      },
      attachedCallback: function() {
        var parent_node = find_parent.call(this);
        if (parent_node) {
            parent_node.widget.add_event(this.type, this.fun);
        }
      }
    })
  });

})(this);
