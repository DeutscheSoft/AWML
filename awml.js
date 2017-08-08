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
      var val_type = typeof(value);
      if (val_type === "object" && value instanceof Array) val_type = "array";
      if (type && type !== "mixed") {
        if (val_type !== type && type.search(val_type) === -1) {
          if (val_type === "number" && (value % 1 === 0) && type.search("int") !== -1) return;
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
  function attach_option(node, widget, name, value, simple) {
      if (value instanceof Option) {
          value.attach(node, widget);
      } else if (typeof value !== "undefined" && simple) {
          check_option(widget, name, value);
          widget.set(name, value);
      }
  }
  function attach_options(node, widget, options, simple) {
      for (var key in options) {
          attach_option(node, widget, key, options[key], simple);
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
  function parse_format(type, x, fallback) {
      switch (type) {
      case "js":
        x = x.trim();
        if (x.length) {
          try {
              return new Function([], "return ("+x+");").call(this);
          } catch (e) {
              AWML.error("Syntax error", e, "in", x);
          }
        }
        return fallback;
      case "json":
        x = x.trim();
        if (x.length) {
          try {
              return JSON.parse(x);
          } catch (e) {
              AWML.error("Syntax error", e, "in JSON", x);
          }
        }
        return fallback;
      case "html":
        return TK.html(x);
      case "string":
        return x;
      case "number":
        return parseFloat(x);
      case "int":
        return parseInt(x);
      case "sprintf":
        return TK.FORMAT(x);
      case "regexp":
        return new RegExp(x);
      case "bool":
        x = x.trim();
        if (x === "true") {
          return true;
        } else if (x === "false") {
          return false;
        }
        AWML.error("Malformed 'bool': ", x);
        return fallback;
      default:
        AWML.error("unsupported type", type);
        return fallback;
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

  AWML.find_parent_widget = function(node) { return find_parent.call(node); }
  AWML.find_root_widget = function(node) { return find_root.call(node); }
  AWML.get_widget = function(node) {
    return node.widget;
  }


  function extract_options(widget) {
    var O = widget ? widget.prototype._options : null;
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

        /* NOTE: it is unfortunate that this attribute collides,
         * should be introduce something like 'visible-if-expanded' ? */
        if (name === "expanded" && !O && !("expanded" in O)) {
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
            merge_options = {};
            var tmp = value.split(" ");
            for (var j = 0; j < tmp.length; j++) {
              if (!tmp[j].length) continue;
              if (!AWML.options[tmp[j]]) {
                TK.warn("No such default options: %o", tmp[j]);
                continue;
              }
              Object.assign(merge_options, AWML.options[tmp[j]]);
            }
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
    options = do_merge_options(AWML.options.defaults[this.tagName.toLowerCase()], options);
    return options;
  }

  var TK = window.TK;

  var _warn_stack = [ TK ? TK.warn : function() {} ];
  
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

  var prefix_tags = "";

  function register_prefix_tag(tag) {
    var tmp = prefix_tags.length ? prefix_tags.split(",") : [];
    tmp.push(tag);
    prefix_tags = tmp.join(",");
  }

  function collect_prefix(from, handle) {
    var attr = handle && handle.length ? "prefix-"+handle : "prefix";
    var prefix = [];
    var tmp;

    var node = from;

    while (node && node.getAttribute) {
      tmp = node.getAttribute(attr);
      if (tmp) {
        if (tmp === ":noprefix:") return "";
        prefix.push(tmp);
        if (tmp.search(':') !== -1) break;
      }
      node = node.parentNode;
    }

    return prefix.reverse().join("");
  }

  function set_prefix(node, prefix, handle) {
    var attr = handle !== void 0 ? "prefix-"+handle : "prefix";
    if (node.getAttribute(attr) === prefix) return;
    node.setAttribute(attr, prefix);
    update_prefix(node, handle);
  }

  function set_prefix_block(node, handle) {
    set_prefix(node, ":noprefix:", handle);
  }

  function update_prefix(node, handle) {
    if (node.awml_update_prefix)
      node.awml_update_prefix(handle);

    var list, i, c;

    list = node.querySelectorAll(prefix_tags);

    for (i = 0; i < list.length; i++) {
      var tmp;
      c = list.item(i);
      update_prefix(c, handle);
    }
  }

  AWML.collect_prefix = collect_prefix;
  AWML.set_prefix = set_prefix;
  AWML.set_prefix_block = set_prefix_block;
  AWML.update_prefix = update_prefix;


  AWML.RedrawLogic = {
    is_awml_node: true,
    createdCallback: function() {
      var O = this.awml_data;
      O._redraw = null;
      O.will_redraw = false;
    },
    trigger_redraw: function() {
      var O = this.awml_data;
      if (O.will_redraw) return;
      if (!O._redraw) O._redraw = this.redraw.bind(this);
      O.will_redraw = true;
      TK.S.add(O._redraw, 1);
    },
    redraw: function() {
      var O = this.awml_data;
      O.will_redraw = false;
    },
    remove_redraw: function() {
      var O = this.awml_data;
      if (O.will_redraw) {
        O.will_redraw = false;
        TK.S.remove(O._redraw, 1);
      }
    },
  };

  function register_element(tagName, prototype) {
    if (prototype.awml_update_prefix)
      register_prefix_tag(tagName);
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

  function downgrade_element(node) {
    var prototype;
    var tagName = node.tagName;
    var i;
    if (custom_elements.hasOwnProperty(tagName)) {
      if (node.is_awml_node) {
        node.detachedCallback();
      }
    }
    var children = node.childNodes||node.children;
    for (i = 0; i < children.length; i++) {
      downgrade_element(children[i]);
    }
  }

  function update_attribute(node, name, value) {
    var old = node.getAttribute(name);
    if (value === null)
      node.removeAttribute(name);
    else
      node.setAttribute(name, value);
    if (node.attributeChangedCallback)
      node.attributeChangedCallback(name, old, node.getAttribute(name));
  }

  function register_element_polyfill(tagName, prototype) {
    if (prototype.awml_update_prefix)
      register_prefix_tag(tagName);
    custom_elements[tagName.toUpperCase()] =
      Object.assign({
        attachedCallback: function() {},
        createdCallback: function() {},
        detachedCallback: function() {},
        attributeChangedCallback: function() {},
      }, prototype);
    return true;
  }

  if (document.registerElement) {
    AWML.register_element = register_element;
    AWML.upgrade_element = function(node) {};
    AWML.downgrade_element = function(node) {};
    AWML.update_attribute = function(node, name, value) {
      if (value === null)
        node.removeAttribute(name);
      else
        node.setAttribute(name, value);
    };
  } else {
    custom_elements = {};
    AWML.register_element = register_element_polyfill;
    AWML.upgrade_element = upgrade_element;
    AWML.downgrade_element = downgrade_element;
    AWML.update_attribute = update_attribute;
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
          attach_options(this, this.widget, options, false);
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
          }
      },
    });
  }

  AWML.registerWidget = registerWidget;

  if (!AWML.Tags) AWML.Tags = {};

  // awml-root is somewhat custom, because it has no awml parents
  if (TK && TK.Root) AWML.Tags.Root = AWML.register_element("awml-root", {
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
  
  AWML.Tags.ResponseHandle = create_tag("awml-responsehandle", {
    awml_createdCallback: function() {
      this.style.display = "none";
      this.options = extract_options.call(this, TK.ResponseHandle);
    },
    awml_attachedCallback: function(root, parent_node) {
      if (!(parent_node.widget instanceof TK.ResponseHandler)) {
        AWML.error("awml-responsehandle needs to be inside of a awml-responsehandler.");
        return;
      }
      if (this.widget) {
        detach_options(this, this.widget, this.options);
        parent_node.widget.remove_handle(this.widget);
      }
      var options = check_options(TK.ResponseHandle.prototype, evaluate_options(this.options));
      this.widget = parent_node.widget.add_handle(options);
      attach_options(this, this.widget, this.options, false);
    },
    awml_detachedCallback: function(root, parent_node) {
      detach_options(this, this.widget, this.options);
      parent_node.widget.remove_handle(this.widget);
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

  if (TK && TK.Widget) for (var key in TK) {
      var f = TK[key];
      if (AWML.Tags[key]) continue;
      if (typeof f === "function" && f.prototype && TK.Widget.prototype.isPrototypeOf(f.prototype)) {
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
        if (o.name.charCodeAt(0) !== 95 && !parent_node.widget._options[o.name] && this.getAttribute("force") === null)
          AWML.warn("%o has no option called %o.\n", parent_node.widget._class, o.name);
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
      /* TODO: this could be much better */
      var r = this.awml_root;
      var p = this.awml_parent;
      if (p) this.awml_detachedCallback(r, p);
      this.awml_createdCallback();
      this.awml_attachedCallback(r, p);
    },
    awml_update_prefix: function(handle) {
      var o = this.option;
      if (!o || !o.update_prefix) return;

      o.update_prefix(handle);
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
        if (this.widget && has_attribute(this.widget, name)) {
            value = parse_attribute(value);

            update_option(this, this.widget, name, this.options[name], value);
        }
    },
    awml_detachedCallback: function(root, parent_node) {
        parent_node.widget.remote_page(this.widget);
    },
    awml_attachedCallback: function(root, parent_node) {
      if (!(parent_node.widget instanceof TK.Pager)) {
        AWML.error("awml-page needs to be inside of a awml-pager.");
        return;
      }
      parent_node.widget.add_page(this.label, this.widget);
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
      attach_options(this, this.widget, this.options, false);
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
      if (typeof(this.type) !== "string") {
        AWML.error("AWML-EVENT without type.");
      }
      if (typeof(this.fun) !== "function") {
        AWML.error("AWML-EVENT without function.");
      }
    },
    awml_attributeChangedCallback: function(name, old_value, value) {
      TK.warn("not implemented");
    },
    awml_detachedCallback: function(root, parent_node) {
      var types = this.type.split(",");
      var type;
      for (var i = 0; i < types.length; i++) {
        type = types[i].trim();
        if (!type.length) continue;
        parent_node.widget.remove_event(type, this.fun);
      }
    },
    awml_attachedCallback: function(root, parent_node) {
      var types = this.type.split(",");
      var type;
      var w = parent_node.widget;
      for (var i = 0; i < types.length; i++) {
        type = types[i].trim();
        if (!type.length) continue;
        w.add_event(type, this.fun);
        if (type === 'initialized') {
          /* the initialization has already happened, 
           * so we call it manually */
          this.fun.call(w);
        }
      }
    }
  });

  AWML.Option = Option;

  AWML.Options = {
    static: StaticOption,
    media: MediaOption,
  };

  var loading = 1;

  function unregister_loading() {
    if (!--loading) {
      window.dispatchEvent(new Event("resize"));
      TK.S.after_frame(document.dispatchEvent.bind(document, new Event("AWMLContentLoaded")));
    }
  }

  AWML.register_loading = function(p) {
    if (!loading) return p; /* already done loading */
    loading ++;
    p.then(unregister_loading, unregister_loading);
    return p;
  };

  AWML.unregister_loading = unregister_loading;

  if (!document.registerElement)
    document.addEventListener('DOMContentLoaded', function() {
      AWML.upgrade_element(this.head);
      AWML.upgrade_element(this.body);
    });

  window.addEventListener("load", unregister_loading);
})(this.AWML || (this.AWML = {}));
