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
        if (typeof value !== type && type.search(value) === -1) {
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
          // widget.set(name, undefined);
      }
  }
  function detach_options(node, widget, options) {
      for (var key in options) {
          detach_option(node, widget, key, options[key]);
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
          return null;

      do
          if (node.is_awml_node && node.widget)
              return node;
      while (node = node.parentNode);

      return null;
  };

  function find_root() {
      var node = this.parentNode;

      if (!node)
          return null;

      do
          if (node.tagName === "AWML-ROOT")
              return node;
      while (node = node.parentNode);

      return null;
  };

  AWML.find_parent_widget = find_parent;
  AWML.find_root_widget = find_root;


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

  function register_element(tagName, prototype) {
    prototype = Object.assign(Object.create(HTMLElement.prototype), prototype);
    return document.registerElement(tagName, { prototype: prototype });
  }

  var custom_elements;

  function upgrade_element(node) {
    var prototype;
    var tagName = node.tagName;
    var i;
    if (custom_elements.hasOwnProperty(tagName)) {
      if (!node.is_awml_node) {
        prototype = custom_elements[tagName];
        Object.assign(node, prototype);
        node.createdCallback();
        node.attachedCallback();
      }
    }
    var children = node.childNodes||node.children;
    for (i = 0; i < children.length; i++) {
      upgrade_element(children[i]);
    }
  }

  function register_element_polyfill(tagName, prototype) {
    custom_elements[tagName.toUpperCase()] = prototype;
    return true;
  }

  if (document.registerElement) {
    AWML.register_element = register_element;
    AWML.upgrade_element = function(node) {}
  } else {
    custom_elements = {};
    AWML.register_element = register_element_polyfill;
    AWML.upgrade_element = upgrade_element;
    AWML.warn('Running with simple polyfill. Only static AWML is supported.');
  }

  function create_tag(tagName, prototype) {
    prototype = Object.assign({
        is_awml_node: true,
        createdCallback: function() {
          this.awml_root = null;
          this.awml_parent = null;
          this.awml_createdCallback();
        },
        awml_createdCallback: function() {
          AWML.error("Not implemented: awml_createdCallback\n");
        },
        attachedCallback: function() {
          var root = find_root.call(this);
          var parent_node = find_parent.call(this);

          if (root !== this.awml_root || parent_node !== this.awml_parent) {
            if (this.awml_root && this.awml_parent) {
              this.awml_detachedCallback(this.awml_root, this.awml_parent);
            }
            this.awml_root = root;
            this.awml_parent = parent_node;
            if (root && parent_node) {
              if (!this.awml_created) {
                this.awml_created = true;
              }
              this.awml_attachedCallback(root, parent_node);
            }
          }
        },
        awml_attachedCallback: function(root, parent_node) {
          AWML.error("Not implemented: awml_attachedCallback\n");
        },
        detachedCallback: function() {
          var parent_node = find_parent.call(this);

          if (parent_node !== this.awml_parent) {
            this.awml_detachedCallback(this.awml_root, this.awml_parent);
            this.awml_parent = null;
          }
        },
        awml_detachedCallback: function(root, parent_node) {
          AWML.error("Not implemented: awml_detachedCallback\n");
        },
        attributeChangedCallback: function(name, old_value, value) {
        },
      },
      prototype
    );

    return AWML.register_element(tagName, prototype);
  };

  function registerWidget(tagName, widget) {
    return create_tag(tagName, {
      awml_createdCallback: function() {
        this.widget = null;
      },
      awml_attachedCallback: function(root, parent_node) {
        if (!this.widget) {
          var options = this.options = extract_options.call(this, widget);
          if (widget.prototype._options.element)
              options.element = this;
          this.widget = new widget(check_options(widget.prototype, evaluate_options(options)));
          attach_options(this, this.widget, options);
        }
        parent_node.widget.add_child(this.widget);
      },
      awml_detachedCallback: function(root, parent_node) {
        parent_node.widget.remove_child(this.widget);
      },
      awml_attributeChangedCallback: function(name, old_value, value) {
          if (this.widget && has_attribute(this.widget, name)) {
              value = parse_attribute(value);

              update_option(this, this.widget, name, this.options[name], value);

              this.options[name] = value;
          }
      },
    });
  }

  AWML.registerWidget = registerWidget;

  if (!AWML.Tags) AWML.Tags = {};

  // awml-root is somewhat custom, because it has no awml parents
  AWML.Tags.Root = AWML.register_element("awml-root", {
    is_awml_node: true,
    createdCallback: function() {
      this.widget = null;
    },
    attachedCallback: function() {
      this.widget = new TK.Root({ element: this });
    },
    detachedCallback: function() {
      this.widget.destroy();
      this.widget = null;
    },
  });

  for (var key in TK) {
      var f = TK[key];
      if (AWML.Tags[key]) continue;
      if (typeof f === "function" && f.prototype && Widget.prototype.isPrototypeOf(f.prototype)) {
          AWML.Tags[key] = registerWidget("awml-"+key.toLowerCase(), f);
      }
  }

  AWML.Tags.Option = create_tag("awml-option", {
    awml_createdCallback: function() {
      this.style.display = "none";

      var type = this.getAttribute("type") || "static";
      var factory = AWML.Options[type];

      if (!factory) {
        AWML.error("Unknown option type '%o'", type);
        this.option = null;
      } else {
        this.option = new factory(this);
      }
    },
    awml_attachedCallback: function(root, parent_node) {
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
    },
    awml_detachedCallback: function(root, parent_node) {
      var o = this.option;

      if (!o) return;

      if (parent_node.widget) {
        o.detach(parent_node, parent_node.widget);
      } else if (parent_node instanceof AWML.Tags.Options) {
        if (parent_node.data[o.name] === o) {
          delete parent_node.data[o.name];
        }
      }
    },
    attributeChangedCallback: function(name, old_value, value) {
      AWML.warn('changing awml-option tags is not supported, yet');
    },
  });

  AWML.Tags.Options = create_tag("awml-options", {
     awml_createdCallback: function() {
        this.style.display = "none";

        this.name = this.getAttribute("name");
        this.widget = this.getAttribute("widget");

        if (this.widget) this.widget = this.widget.toLowerCase();

        this.data = extract_options.call(this);
        delete this.data.name;
        delete this.data.widget;
    },
    awml_attachedCallback: function(root, parent_node) {
      if (parent_node.tagName !== "AWML-ROOT") {
        AWML.error("awml-options tags must be direct children of awml-root.");
        return;
      }
      if (this.name) {
        AWML.options[this.name] = this.data;
      } else if (this.widget) {
        AWML.options.defaults[this.widget] = this.data;
      } else AWML.error("awml-options without name or widget.");
    },
    awml_detachedCallback: function(root, parent_node) {
      if (parent_node.tagName !== "AWML-ROOT") {
        AWML.error("awml-options tags must be direct children of awml-root.");
        return;
      }
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
  });

  AWML.Tags.Page = create_tag("awml-page", {
     awml_createdCallback: function() {
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
    awml_detachedCallback: function(root, parent_node) {
        TK.warn("not implemented");
    },
    awml_attachedCallback: function(root, parent_node) {
      if (!(parent_node.widget instanceof TK.Pager)) {
        AWML.error("awml-page needs to be inside of a awml-pager.");
        return;
      }
      /* FIXME: the custom tags polyfill does not like
       * if the DOM is modified directly from within the
       * attached/detached callbacks. We do it on the next
       * frame.
       */
      TK.S.add_next(function() {
        parent_node.widget.add_page(this.label, this.widget);
      }.bind(this));
    }
  });
  AWML.Tags.Filter = create_tag("awml-filter", {
    awml_createdCallback: function() {
      this.style.display = "none";
      this.options = extract_options.call(this, TK.EqBand);
    },
    awml_attachedCallback: function(root, parent_node) {
      if (this.widget) {
        detach_options(this, this.widget, this.options);
        parent_node.widget.remove_band(this.widget);
      }
      var options = check_options(TK.EqBand.prototype, evaluate_options(this.options));
      this.widget = parent_node.widget.add_band(options);
      attach_options(this, this.widget, this.options);
    },
    awml_detachedCallback: function(root, parent_node) {
      detach_options(this, this.widget, this.options);
      parent_node.widget.remove_band(this.widget);
      this.widget = null;
    },
    attributeChangedCallback: function(name, old_value, value) {
      if (this.widget && has_attribute(this.widget, name)) {
          value = parse_attribute(value);

          update_option(this, this.widget, name, this.options[name], value);

          this.options[name] = value;
      }
    }
  });
  AWML.Tags.Event = create_tag("awml-event", {
    awml_createdCallback: function() {
      this.style.display = "none";
      this.type = this.getAttribute("type");
      this.fun = parse_format.call(this, "js", this.textContent);
    },
    awml_attributeChangedCallback: function(name, old_value, value) {
      TK.warn("not implemented");
    },
    awml_detachedCallback: function(root, parent_node) {
      parent_node.widget.remove_event(this.type, this.fun);
    },
    awml_attachedCallback: function(root, parent_node) {
      parent_node.widget.add_event(this.type, this.fun);
    }
  });

  AWML.Option = Option;

  AWML.Options = {
    static: StaticOption,
    media: MediaOption,
  };

  if (!document.registerElement) {
    document.addEventListener('DOMContentLoaded', function() {
      AWML.upgrade_element(this.body);
    });
  }
})(this.AWML || (this.AWML = {}));
