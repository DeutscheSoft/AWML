// vim:sw=2
"use strict";
(function(w) {
  function Option(node) {
    this.name = node.getAttribute("name");
    if (typeof this.name !== "string") AWML.error("AWML-OPTION tag without 'name' attribute.");
    this.node = null;
    this.widget = null;
  };
  Option.prototype = {
    detach: function(node, widget) {
        this.node = null;
        this.widget = null;
    },
    attach: function(node, widget) {
        this.node = node;
        this.widget = widget;
    },
  };

  function StaticOption(node) {
    Option.call(this, node);
    var value = node.getAttribute("value") || node.textContent;
    this.value = parse_option(node.getAttribute("format"), value); 
  };
  StaticOption.prototype = Object.assign(Object.create(Option.prototype), {
    attach: function(node, widget) {
      Option.prototype.attach.call(this, node, widget); 
      widget.set(this.name, this.value);
    },
    detach: function(node, widget) {
      widget.set(this.name, undefined);
      Option.prototype.detach.call(this, node, widget); 
    },
  });

  function MediaOption(node) {
    Option.call(this, node);
    this.query = node.getAttribute("media");
    var values = node.getAttribute("value");
    if (values) {
      var format = node.getAttribute("format")||"json";
      this.values = parse_format.call(this, format, values);
    } else {
      this.values = [ false, true ];
    }
    this.mql = window.matchMedia(this.query);
    if (this.mql.media !== this.query) {
      AWML.warn("Possibly malformed media query %o (is parsed to %o)", this.query, this.mql.media);
    }
    this.handler = function() {
        var value = this.values[this.mql.matches ? 1 : 0];
        this.widget.set(this.name, value);
      }.bind(this);
  };
  MediaOption.prototype = Object.assign(Object.create(Option.prototype), {
    attach: function(node, widget) {
      Option.prototype.attach.call(this, node, widget);
      this.mql.addListener(this.handler);
      this.handler();
    },
    detach: function(node, widget) {
      this.mql.removeListener(this.handler);
      Option.prototype.detach.call(this, node, widget);
    },
  });

  function check_option(widget, key, value) {
      var type = widget._options[key];
      if (type && type !== "mixed") {
        if (typeof value !== type) {
          if (type === "int" && typeof value === "number" ||
              type === "array" && typeof value === "object" && value instanceof Array) {
            return;
          }
          AWML.warn("Type mismatch for option %o. Expected type %o. Got %o (%o)",
                    key, widget._options[key], value, typeof value);
        }
      }
  }
  function check_options(widget, options) {
    for (var key in options) {
      check_option(widget, key, options[key]);
    }
    return options;
  }
  function attach_option(node, widget, name, value) {
      if (value instanceof Option) {
          value.attach(node, widget);
      } else if (typeof value !== "undefined") {
          check_option(widget, name, value);
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
          var v = option_value(options[key]);
          if (v !== undefined) ret[key] = v;
      }
      return ret;
  }
  function parse_format(type, x) {
      switch (type) {
      case "js":
        x = x.replace(/^\s*/g, "");
        x = x.replace(/\s*$/g, "");
        try {
            return new Function([], "return ("+x+");").call(this);
        } catch (e) {
            AWML.error("Syntax error", e, "in", x);
            return undefined;
        }
      case "json":
        try {
            return JSON.parse(x);
        } catch (e) {
            AWML.error("Syntax error", e, "in JSON", x);
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
      case "bool":
        if (x === "true") {
          return true;
        } else if (x === "false") {
          return false;
        } else {
          AWML.error("Malformed 'bool': ", x);
          return undefined;
        }
      default:
        AWML.error("unsupported type", type);
        return undefined;
      }
  }
  AWML.parse_format = parse_format;
  function parse_option(format, value) {
    if (format) return parse_format(format, value);

    try {
      value = JSON.parse(value);
    } catch(e) {
      // fall back to string.
    }

    return value;
  }
  AWML.parse_option = parse_option;
  function parse_attribute(x) {
    var match;

    if (typeof x !== "string") return undefined;

    if (-1 !== (match = x.search(':'))) {
      x = parse_format.call(this, x.substr(0, match), x.substr(match+1));
    } else {
      x = parse_option(false, x);
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

  AWML.find_parent_widget = find_parent;


  function extract_options(widget) {
    var O = widget ? widget.prototype._options : null;
    var tagName = this.tagName;
    var attr = this.attributes;
    var merge_options;
    var options = {};

    var options_blacklist = {
      'id' : true,
      'class' : true,
      'style' : true,
    };

    for (var i = 0; i < attr.length; i++) {
        var name = attr[i].name;

        if (options_blacklist[name]) continue;

        var value = attr[i].value;

        if (name === "expanded") {
            options._expanded = parse_attribute(value);
            if (typeof options._expanded === "string")
                options._expanded = true;
            continue;
        } else if (name === "collapsed") {
            options._collapsed = parse_attribute(value);
            if (typeof options._collapsed === "string")
                options._collapsed = true;
            continue;
        } else if (name === "options") {
            merge_options = AWML.options[value];
            if (!merge_options) TK.warn("No such default options: %o", value);
            continue;
        }

        if (!O || O[name] || name.charCodeAt(0) === 95) {
            if (O && !O.element) {
                // TODO: we should really remove the id, to avoid collisions, but
                // this does not currently work
                /*
                    if (name === "id")
                        this.removeAttribute("id");
                */
                options[name] = parse_attribute(value);
            } else options[name] = parse_attribute(value);
        }
    }
    options = do_merge_options(merge_options, options);
    options = do_merge_options(AWML.options.defaults[tagName], options);
    return options;
  }

  var _warn_stack = [ TK.warn ];
  
  AWML.warn = function() {
    _warn_stack[_warn_stack.length-1].apply(this, arguments);
  };
  AWML.error = function() {
    if (_warn_stack.length != 1)
      AWML.warn.apply(this, arguments);
    TK.error.apply(TK, arguments);
  };
  AWML.push_warn = function(f) {
    _warn_stack.push(f);
  };
  AWML.pop_warn = function() {
    if (_warn_stack.length > 1) {
      _warn_stack.length--;
    }
  };
  AWML.options = { defaults: {} };
  AWML.set_default = function (tag, name, value) {
    var d = this.options.defaults;
    if (!d.hasOwnProperty(tag)) d[tag] = {};
    d[tag][name] = value;
  };
  AWML.registerWidget = function registerWidget(tagName, widget) {
    var proto = Object.create(HTMLElement.prototype);
    proto.createdCallback = function() {
      var options = this.options = extract_options.call(this, widget);
      if (widget.prototype._options.element)
          options.element = this;
      this.widget = new widget(check_options(widget.prototype, evaluate_options(options)));
      attach_options(this, this.widget, options);
    };
    proto.attachedCallback = function() {
      var parent_node = find_parent.call(this);
      if (parent_node) parent_node.widget.add_child(this.widget);
      else if (!(this.widget instanceof TK.Root)) AWML.error("could not find parent for", this);
    };
    proto.detachedCallback = function() {
        AWML.options[this.name] = null;
        if (this.widget.parent)
            this.widget.parent.remove_child(this.widget);
    };
    proto.attributeChangedCallback = function(name, old_value, value) {
        if (this.widget && has_attribute(this.widget, name)) {
            value = parse_attribute(value);

            update_option(this, this.widget, name, this.options[name], value);

            this.options[name] = value;
        }
    };
    proto.is_toolkit_node = true;
    var O = { prototype: proto };
    return document.registerElement(tagName, O);
  };

  AWML.Tags = {};

  for (var key in TK) {
      var f = TK[key];
      if (typeof f === "function" && f.prototype && Widget.prototype.isPrototypeOf(f.prototype)) {
          AWML.Tags[key] = AWML.registerWidget("awml-"+key.toLowerCase(), f);
      }
  }

  AWML.Tags.Option = document.registerElement("awml-option", {
    prototype: Object.assign(Object.create(HTMLElement.prototype), {
      is_toolkit_node: true,
      createdCallback: function() {
        this.style.display = "none";
        this.attached_to = null;

        var type = this.getAttribute("type") || "static";
        var factory = AWML.Options[type];

        if (!factory) {
          AWML.error("Unknown option type '%o'", type);
        } else {
          this.option = new factory(this);
        }
      },
      attachedCallback: function() {
        var parent_node = this.parentNode;
        var o = this.option;

        if (!o) return;

        if (parent_node.widget) {
          o.attach(parent_node, parent_node.widget); 
        } else if (parent_node instanceof AWML.Tags.Options) {
          parent_node.data[o.name] = o;
        } else {
          AWML.error("Attached awml-option tag to neither widget nor awml-options parent.");
          return;
        }

        this.attached_to = parent_node;
      },
      detachedCallback: function() {
        var parent_node = this.attached_to;

        if (!parent_node) return;

        var o = this.option;

        if (!o) return;

        if (parent_node.widget) {
          o.detach(parent_node, parent_node.widget);
        } else if (parent_node instanceof AWML.Tags.Options) {
          if (parent_node.data[o.name] === o) {
            delete parent_node.data[o.name];
          }
        }

        this.attached_to = null;
      },
      attributeChangedCallback: function(name, old_value, value) {
        AWML.warn('changing awml-option tags is not supported, yet');
      },
    })
  });

  AWML.Tags.Options = document.registerElement("awml-options", {
    prototype: Object.assign(Object.create(HTMLElement.prototype), {
       is_toolkit_node: true,
       createdCallback: function() {
          this.style.display = "none";

          this.name = this.getAttribute("name");
          this.widget = this.getAttribute("widget");

          if (this.widget) this.widget = this.widget.toLowerCase();

          this.data = extract_options.call(this);
          delete this.data.name;
          delete this.data.widget;
      },
      attachedCallback: function() {
        if (this.name) {
          AWML.options[this.name] = this.data;
        } else if (this.widget) {
          AWML.options.defaults[this.widget] = this.data;
        } else AWML.error("awml-options without name or widget.");
      },
      detachedCallback: function() {
        if (this.name) {
          if (AWML.options[this.name] === this.data) {
            AWML.options[this.name] = null;
          }
        } else if (this.widget) {
          if (AWML.options.defaults[this.widget] === this.data) {
            AWML.options.defaults[this.widget] = null;
          }
        }
      },
      attributeChangedCallback: function(name, old_value, value) {
        AWML.warn("Attribute changes in awml-options tags are not supported, yet.");
      },
    })
  });

  AWML.Tags.Page = document.registerElement("awml-page", {
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
  AWML.Tags.Filter = document.registerElement("awml-filter", {
    prototype: Object.assign(Object.create(HTMLElement.prototype), {
      is_toolkit_node: true,
      createdCallback: function() {
        this.style.display = "none";
        this.options = extract_options.call(this, TK.EqBand);
      },
      attachedCallback: function() {
        var node = find_parent.call(this);
        if (node) {
          if (this.widget) node.widget.remove_band(this.widget);
          this.widget = node.widget.add_band(this.options);
        }
      },
      detachedCallback: function() {
        var node = find_parent.call(this);
        if (node && this.widget) {
          node.widget.remove_band(this.widget);
          this.widget = false;
        }
      }
    })
  });
  AWML.Tags.Event = document.registerElement("awml-event", {
    prototype: Object.assign(Object.create(HTMLElement.prototype), {
      createdCallback: function() {
          this.type = this.getAttribute("type");
          this.fun = parse_format.call(this, "js", this.textContent);
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

  AWML.Option = Option;

  AWML.Options = {
    static: StaticOption,
    media: MediaOption,
  };
})(this.AWML || (this.AWML = {}));
