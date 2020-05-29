// vim:sw=2
"use strict";
(function(w) {

  function log()
  {
    try
    {
      console.log.apply(console, arguments);
    }
    catch (err)
    {}
  }

  function warn()
  {
    try
    {
      console.warn.apply(console, arguments);
    }
    catch (err)
    {}
  }

  function error()
  {
    try
    {
      console.error.apply(console, arguments);
    }
    catch (err)
    {}
  }

  function schedule(cb)
  {
    window.requestAnimationFrame(cb);
  }

  function after_frame(cb)
  {
    window.requestAnimationFrame(cb);
  }

  function Option(node) {
    this.name = node.getAttribute("name");
    if (typeof this.name !== "string") AWML.error("AWML-OPTION tag without 'name' attribute.");
    this.option = node;
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
  AWML.check_option = check_option;
  function check_options(widget, options) {
    for (var key in options) {
      check_option(widget, key, options[key]);
    }
    return options;
  }
  AWML.check_options = check_options;
  function attach_option(node, widget, name, value, simple) {
      if (name === "@CLASSES") {
        node.classList.add.apply(node.classList, value);
      } else if (value instanceof Option) {
          value.attach(node, widget);
      } else if (typeof value !== "undefined" && simple) {
          check_option(widget, name, value);
          widget.set(name, value);
      }
  }
  AWML.attach_option = attach_option;
  function attach_options(node, widget, options, simple) {
      for (var key in options) {
          attach_option(node, widget, key, options[key], simple);
      }
  }
  AWML.attach_options = attach_options;
  function detach_option(node, widget, name, value) {
      if (name === "@CLASSES") {
        node.classList.remove.apply(node.classList, value);
      } else if (value instanceof Option) {
          value.detach(node, widget);
      }
      /*
      else if (value !== undefined) {
          // we set it back to the default
          widget.set(name, undefined);
      }
      */
  }
  AWML.detach_option = detach_option;
  function detach_options(node, widget, options) {
      for (var key in options) {
          detach_option(node, widget, key, options[key]);
      }
  }
  AWML.detach_options = detach_options;
  function update_option(node, widget, name, value_old, value_new) {
      detach_option(node, widget, name, value_old);
      attach_option(node, widget, name, value_new);
  }
  AWML.update_option = update_option;
  function option_value(value) {
      if (value instanceof Option) return value.value;
      return value;
  }
  AWML.option_value = option_value;
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
      case "string":
        return x;
      case "number":
        return parseFloat(x);
      case "int":
        return parseInt(x);
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
  var json_start = new RegExp("^[0-9tf\[\{\\-\+]"),
      json_end = new RegExp("[0-9e\\]\\}]$");
  AWML.parse_format = parse_format;
  function parse_option(format, value) {
    if (format) return parse_format(format, value);

    try {
      var tmp = value.trim();
      if (tmp.match(json_start) && tmp.match(json_end))
        value = JSON.parse(value);
    } catch(e) {
      // fall back to string.
    }

    return value;
  }
  AWML.parse_option = parse_option;

  function find_parent() {
      var node = this.parentNode;

      if (!node)
          return null;

      do
      {
          if (node.isAuxWidget)
            return node;
      }
      while (node = node.parentNode);

      return null;
  };

  function find_root() {
      var node = this.parentNode;

      if (!node)
          return null;

      do
      {
          if (node.tagName === "AWML-ROOT")
              return node;
          if (node.tagName === "AUX-ROOT")
              return node;
      }
      while (node = node.parentNode);

      return null;
  };

  AWML.find_parent_widget = function(node) { return find_parent.call(node); }
  AWML.find_root_widget = function(node) { return find_root.call(node); }
  AWML.get_widget = function(node) {
    return node.auxWidget;
  }


  var _warn_stack = [ warn ];

  AWML.warn = function() {
    _warn_stack[_warn_stack.length-1].apply(this, arguments);
  };
  AWML.error = function() {
    if (_warn_stack.length != 1)
      AWML.warn.apply(this, arguments);
    error.apply(this, arguments);
  };
  AWML.log = log;
  AWML.push_warn = function(f) {
    _warn_stack.push(f);
  };
  AWML.pop_warn = function() {
    if (_warn_stack.length > 1) {
      _warn_stack.length--;
    }
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
    var attr;
    if (handle === void(0))
    {
      handle = null;
      attr = "prefix"
    }
    else
    {
      attr = "prefix-"+handle;
    }
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
      if (c.awml_update_prefix)
        c.awml_update_prefix(handle);
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
      var resize = this.getAttribute("trigger-resize");
      if (resize !== null) {
        O.resize = parseInt(resize);
      } else {
        O.resize = false;
      }
    },
    trigger_redraw: function() {
      var O = this.awml_data;
      if (O.will_redraw) return;
      if (!O._redraw) O._redraw = function() {
        try {
          if (!O.will_redraw)
            return;
          this.redraw();
        } catch (e) {
          error("%o threw an error in redraw: %o", this, e);
        }
      }.bind(this);
      O.will_redraw = true;
      schedule(O._redraw);
    },
    redraw: function() {
      var O = this.awml_data;
      if (!O.will_redraw) return;
      O.will_redraw = false;
      if (O.resize !== false) {
        var p = AWML.find_parent_widget(this)
        if (p) {
          var w = AWML.get_widget(p);

          if (w) {
            if (O.resize > 0) {
              window.setTimeout(w.trigger_resize.bind(w), O.resize);
            } else {
              w.trigger_resize();
            }
          }
        }
      }
    },
    remove_redraw: function() {
      var O = this.awml_data;
      if (O.will_redraw) {
        O.will_redraw = false;
      }
    },
  };

  // we execute this at run-time to avoid
  // syntax-errors in browsers which do not
  // support ES6 classes
  function create_class(tagName) {
    var name = tagName.replace(/-/g, "_");
    var code = "";
    code += "return class "+name+" extends HTMLElement {";
    code += "constructor()";
    code += "{";
    code += "super();";
    code += "this.created = false;";
    code += "}";
    code += "}";
    return new Function(code)();
  }

  function register_element_v1(tagName, prototype) {
    if (prototype.awml_update_prefix)
      register_prefix_tag(tagName);

    var cl = create_class(tagName);

    prototype.connectedCallback = function() {
      if (!this.created) {
        this.created = true;
        this.createdCallback();
      }
      this.attachedCallback();
    };

    prototype.disconnectedCallback = function() {
      this.detachedCallback();
    };

    Object.assign(cl.prototype, prototype);

    customElements.define(tagName, cl);

    return cl;
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

  AWML.register_element = register_element_v1;
  AWML.downgrade_element = function(node) {};
  AWML.update_attribute = update_attribute;
  AWML.whenDefined = function(name) { return customElements.whenDefined(name); };

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
            else if (root)
            {
              var tagName = this.parentNode.tagName;

              if (AWML.whenDefined && tagName.search('-') !== -1)
              {
                tagName = tagName.toLowerCase();
                AWML.whenDefined(tagName).then(function() {
                  if (!this.isConnected) return;
                  this.attachedCallback();
                }.bind(this));
              }
            }
          }
        },
        awml_attachedCallback: function(root, parent_node) {
          AWML.error("Not implemented: awml_attachedCallback\n");
        },
        detachedCallback: function() {
          var parent_node = find_parent.call(this);

          if (parent_node !== this.awml_parent) {
            if (this.awml_root && this.awml_parent) {
              this.awml_detachedCallback(this.awml_root, this.awml_parent);
            }
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
  AWML.create_tag = create_tag;

  if (!AWML.Tags) AWML.Tags = {};

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

      if (parent_node instanceof AWML.Tags.Options) {
        parent_node.data[o.name] = o;
      } else if (parent_node.isAuxWidget) {
        o.attach(parent_node, parent_node.auxWidget);
      } else {
        AWML.error("Attached awml-option tag to neither widget nor awml-options parent.");
        return;
      }
    },
    awml_detachedCallback: function(root, parent_node) {
      var o = this.option;

      if (!o) return;

      if (parent_node instanceof AWML.Tags.Options) {
        if (parent_node.data[o.name] === o) {
          delete parent_node.data[o.name];
        }
      } else if (parent_node.isAuxWidget) {
        o.detach(parent_node, parent_node.auxWidget);
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

  AWML.Tags.Event = create_tag("awml-event", {
    awml_createdCallback: function() {
      this.style.display = "none";
      this.type = this.getAttribute("type");
      this.fun = null;
      var cb = this.getAttribute("callback");
      this.fun = parse_format.call(this, "js", cb);
      if (typeof(this.type) !== "string") {
        AWML.error("AWML-EVENT without type.");
      }
    },
    awml_attributeChangedCallback: function(name, old_value, value) {
      warn("not implemented");
    },
    awml_detachedCallback: function(root, parent_node) {
      var types = this.type.split(/[^a-zA-Z0-9\-_]/);
      var type;
      for (var i = 0; i < types.length; i++) {
        type = types[i].trim();
        if (!type.length) continue;
        if (this.fun) {
          parent_node.auxWidget.off(type, this.fun);
        }
      }
    },
    awml_attachedCallback: function(root, parent_node) {
      var types = this.type.split(/[^a-zA-Z0-9\-_]/);
      var type;
      var w = parent_node.auxWidget;
      this.parent_widget = w;
      for (var i = 0; i < types.length; i++) {
        type = types[i].trim();
        if (!type.length) continue;
        w.on(type, this.fun);
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
      after_frame(document.dispatchEvent.bind(document, new Event("AWMLContentLoaded")));
    }
  }

  AWML.register_loading = function(p) {
    if (!loading) return p; /* already done loading */
    loading ++;
    p.then(unregister_loading, unregister_loading);
    return p;
  };

  AWML.unregister_loading = unregister_loading;

  window.addEventListener("load", unregister_loading);

  function fetch_text(url) {
    if ('fetch' in window) {
      return fetch(url).then(function(response) {
        if (!response.ok) throw new Error(response.statusText);
        return response.text();
      });
    } else {
      return new Promise(function(resolve, reject) {
        var r = new XMLHttpRequest();
        r.addEventListener("readystatechange", function() {
          if (r.readyState === 4) {
            if (r.status === 200) {
              resolve(r.responseText);
            } else {
              reject("Error: " + r.status);
            }
          }
        });
        r.addEventListener("error", function(ev) {
          reject(ev);
        });
        r.open("GET", url);
        r.send();
      });
    }
  }

  function fetch_json(url) {
    return fetch_text(url).then(function(data) { return JSON.parse(data); });
  }

  AWML.fetch_text = fetch_text;
  AWML.fetch_json = fetch_json;
})(this.AWML || (this.AWML = {}));
