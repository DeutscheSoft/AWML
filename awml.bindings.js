// vim:sw=2
"use strict";
(function(AWML) {

  function inherit(from, o) {
    return Object.assign(Object.create(from.prototype), o);
  }

  function call_listener(cb, value) {
    if (typeof(cb) === "function") {
      cb(value);
    } else {
      cb.receive(value);
    }
  }

  function BaseBinding() {
    this.listeners = null;
  }
  BaseBinding.prototype = {
    subscribe: function() {},
    unsubscribe: function() {},
    hasListener: function(callback) {
      var a = this.listeners;
      if (a === callback) return true;
      if (a === null || !(a instanceof Set)) return false;
      return a.has(callback);
    },
    addListener: function(callback) {
      if (this.hasListener(callback)) {
        AWML.warn("Trying to add same listener twice.");
        return;
      }
      var a = this.listeners;
      if (a === null) {
        this.listeners = callback;
        this.subscribe();
      } else if (a instanceof Set) {
        a.add(callback);
      } else {
        this.listeners = new Set([ a, callback ]);
      }
      if (this.has_value) call_listener(callback, this.value);
    },
    removeListener: function(callback) {
      var a = this.listeners;

      if (a === null) return;
      if (a === callback) {
        this.listeners = null;
        this.unsubscribe();
      }
      if (!(a instanceof Set)) return;
      a.delete(callback);
      if (a.size === 0) {
        this.listeners = null
        this.unsubscribe();
      }
    },
    hasListeners: function() {
      return this.listeners !== null;
    },
    callListeners: function(v) {
      var a = this.listeners;

      if (a === null) return;

      if (!(a instanceof Set)) {
        call_listener(a, v);
      } else {
        a.forEach(function(cb, foo, set) {
          call_listener(cb, v);
        });
      }
    }
  };

  function Binding(uri) {
    this.uri = uri;
    this.path = uri.split(":")[1];
    this.id = false;
    this.backend = null;
    this.value = null;
    this.requested_value = null;
    this.has_value = false;
    this.has_requested_value = false;
    BaseBinding.call(this);
  };
  Binding.prototype = inherit(BaseBinding, {
    set_backend: function(backend) {
      this.backend = backend;
      backend.subscribe(this.path, this)
        .then(
          function(a) {
            this.id = a[1];
            var has_value = a.length === 3;
            if (has_value) {
              this.update(a[1], a[2]);

              if (this.requested_value !== null && this.requested_value !== a[2]) {
                this.backend.set(a[1], this.requested_value);
              }
            } else {
              if (this.has_value) {
                this.backend.set(a[1], this.value);
                this.has_value = false;
                this.value = null;
              } else if (this.has_requested_value) {
                this.backend.set(a[1], this.requested_value);
              }
            }
          }.bind(this),
          function(reason) {
            /* FIXME: this log output can be very annoying */
            AWML.warn("Subscription failed: ", reason);
          });
    },
    delete_backend: function(backend) {
      if (this.id !== false && !backend.is_destructed()) {
        backend.unsubscribe(this.id, this);
      }
      this.id = false;
      this.backend = null;
    },
    set: function(value) {
      if (value === this.requested_value && value === this.value) return;
      this.requested_value = value;
      this.has_requested_value = true;
      if (this.id !== false) {
        this.backend.set(this.id, value);
      }
    },
    update: function(id, value) {
      var cb, a;

      /* we were unsubscribed by the backend */
      if (id === false) {
        this.id = false;
        return;
      }

      this.value = value;
      this.has_value = true;

      this.callListeners(value);
    },
    in_sync: function() {
      return this.has_value && (this.value === this.requested_value || this.requested_value === null);
    },
  });

  function ListBinding(b) {
    this.bindings = b;
    BaseBinding.call(this);

    this.has_value = false;
    this.has_values = [];
    this.value = new Array(b.length);

    var C = this.cbs = new Array(b.length),
        i, cb = this.receive;

    for (i = 0; i < C.length; i++)
      C[i] = cb.bind(this, i);
  }
  ListBinding.prototype = inherit(BaseBinding, {
    subscribe: function() {
      this.has_values = [];
      this.has_value = false;
      var b = this.bindings,
          V = this.value,
          C = this.cbs;

      for (var i = 0; i < b.length; i++) {
        b[i].addListener(C[i]);
      }
    },
    unsubscribe: function() {
      var b = this.bindings;
      var C = this.cbs;
      for (var i = 0; i < b.length; i++) {
        b[i].removeListener(C[i]);
      }
      this.has_value = false;
    },
    in_sync: function() {
      var b = this.bindings;

      for (var i = 0; i < b.length; i++)
        if (!b[i].in_sync()) return false;

      return true;
    },
    set: function(value) {
      var b = this.bindings;

      if (!Array.isArray(value) || value.length !== b.length)
        throw new Error("ListBinding.set expects an array of correct length.");

      for (var i = 0; i < b.length; i++) b[i].set(value[i]);
    },
    receive: function(n, value) {
      var v = this.value;
      var has_values = this.has_values;
      v[n] = value;
      has_values[n] = true;

      if (!this.has_value) {
        var b = this.bindings;
        for (var i = 0; i < b.length; i++) if (!has_values[i]) return;
        this.has_value = true;
      }

      this.callListeners(v);
    },
  });

  function binding_set_handler(v) {
    this.send(v);
  }
  function binding_useraction_handler(name, k, v) {
    if (name !== k) return;
    this.send(v);
  }
  function binding_userset_handler(name, k, v) {
    if (name !== k) return;
    this.send(v);
    return false;
  }

  function src_needs_prefix(src) {
    if (Array.isArray(src)) {
      for (var i = 0; i < src.length; i++) {
        if (src[i].search(':') === -1) return true;
      }
      return false;
    } else {
      return src.search(':') === -1;
    }
  }

  function src_apply_prefix(src, prefix) {
    if (Array.isArray(src)) {
      var ret = new Array(src.length);
      for (var i = 0; i < src.length; i++) {
        ret[i] = src[i].search(':') === -1 ? prefix + src[i] : src[i];
      }
      return ret;
    } else {
      return prefix + src;
    }
  }

  AWML.PrefixLogic = {
    is_awml_node: true,
    createdCallback: function() {
      var O = this.awml_data;
      if (!O) this.awml_data = O = {};
      O.binding = null;
      O.prefix = null;
      O.attached = false;
      O.transform_receive = null;
    },
    attachedCallback: function() {
      var O = this.awml_data;

      O.attached = true;

      /* update all prefixes */
      this.awml_update_prefix(null);
    },
    detachedCallback: function() {
      this.awml_data.attached = false;

      if (this.binding) this.unbind();
    },
    attributeChangedCallback: function(name, old_value, value) {
      if (name === "src") {
        this.detachedCallback();
        this.attachedCallback(); 
      }
      if (name === "src-prefix") {
        this.awml_update_prefix(null);
      }
      if (name === "prefix") {
        AWML.update_prefix(this, value);
      }
    },
    awml_update_prefix: function(handle) {
      if (handle !== null) {
        if (handle !== this.getAttribute("src-prefix")) return;
      }

      var O = this.awml_data;

      if (this.binding) this.unbind();

      var src = this.getAttribute("src");

      if (src === null) return;

      if (src.search(',') !== -1) src = src.split(",");

      if (src_needs_prefix(src)) {
        handle = this.getAttribute("src-prefix") || "";
        var prefix = AWML.collect_prefix(this, handle);
        if (prefix.search(':') === -1) return;
        src = src_apply_prefix(src, prefix);
      }

      this.bind(src);
    },
    bind: function(src) {
      var O = this.awml_data;
      if (!O.transform_receive) {
        var tmp = this.getAttribute("transform-receive");
        if (tmp) O.transform_receive = AWML.parse_format("js", tmp);
      }
      if (!src) {
        AWML.error(this.tagName, "is missing src attribute");
        return;
      }
      O.binding = Array.isArray(src) ? new ListBinding(src.map(get_binding)) : AWML.get_binding(src);
      O.binding.addListener(this);
    },
    unbind: function() {
      var O = this.awml_data;
      O.binding.removeListener(this);
      O.binding = null;
    },
    receive: function(v) { },
  };

  function BindingOption(node) {
    AWML.Option.call(this, node);
    this.connector = null;
  };
  BindingOption.prototype = Object.assign(Object.create(AWML.Option.prototype), {
    attach: function(node, widget) {
      AWML.Option.prototype.attach.call(this, node, widget);

      this.update_prefix(null);
    },
    detach: function(node, widget) {
      if (this.connector) {
        this.connector.destroy();
        this.connector = null;
      }

      AWML.Option.prototype.detach.call(this, node, widget);
    },
    update_prefix: function(handle) {
      var node = this.option;
      var widget = this.widget;
      var connector = this.connector;

      if (connector) {
        connector.destroy();
        this.connector = null;
      }

      if (widget === null) return;

      var src = node.getAttribute("src");

      if (src === null) return;

      if (src.search(',') !== -1) {
        src = src.split(",");
      }

      if (src_needs_prefix(src)) {
        handle = node.getAttribute("src-prefix");
        var prefix = AWML.collect_prefix(node, handle);
        if (prefix.search(':') === -1) return;
        src = src_apply_prefix(src, prefix);
      }

      var binding = Array.isArray(src) ? new ListBinding(src.map(get_binding)) : AWML.get_binding(src);
      var options = WidgetConnector.prototype.extract_options(node);

      this.connector = connector = new WidgetConnector(binding, widget, options);

      connector.activate();
    },
  });

  function interpret_attributes(node, formats, defaults) {
    var o = Object.create(defaults);

    for (var key in formats) {
      var v = node.getAttribute(key);
      var fmt = formats[key];

      if (fmt === "flag") {
        v = v !== null;
      } else {
        if (v === null) continue;

        if (typeof(fmt) === "string") {
          v = AWML.parse_format(fmt, v);
        }
      }

      o[key] = v;
    }

    return o;
  }

  function WidgetConnector(binding, widget, options) {
    this.binding = binding;
    this.widget = widget;
    this.options = options;
    this.last_send = 0;
    this.send_cb = null;
    this._delay_id = void(0);
    this.recurse = false;

    if (options.sync && options.writeonly)
      AWML.warn("Setting both 'sync' and 'writeonly' does not work.");
  }
  WidgetConnector.prototype = {
    destroy: function() {
      this.deactivate();
      this.send_cb = null;
      if (this._delay_id) clearTimeout(this._delay_id);
      this.widget = null;
      this.options = null;
      this.binding = null;
    },
    option_defaults: {
      sync: false,
      prefix: null,
      debug: false,
      readonly: false,
      writeonly: false,
      "unsubscribe-when-hidden": false,
      "receive-delay": 1000,
    },
    option_formats: {
      sync: "flag",
      prefix: null,
      debug: "flag",
      readonly: "flag",
      writeonly: "flag",
      name: null,
      "unsubscribe-when-hidden": "flag",
      "receive-delay": "int",
      "transform-receive": "js",
      "transform-send": "js",
    },
    get_send_event: function() {
      var o = this.options;
      if (o.writeonly) return "userset";
      if (o.sync) return "set_"+o.name;
      return "useraction";
    },
    extract_options: function(node) {
      return interpret_attributes(node, this.option_formats, this.option_defaults);
    },
    get_send_cb: function() {
      var o = this.options;
      var cb = this.send_cb;
      if (cb) return cb;
      if (o.writeonly) cb = binding_userset_handler.bind(this, o.name);
      else if (o.sync) cb = binding_set_handler;
      else cb = binding_useraction_handler.bind(this, o.name);

      cb = cb.bind(this);
      this.send_cb = cb;
      return cb;
    },
    activate: function() {
      var o = this.options;

      if (o.debug) TK.log("Connector(%o) activated.", this.binding);

      if (!o.readonly)
        this.widget.add_event(this.get_send_event(), this.get_send_cb());
      this.binding.addListener(this);
    },
    deactivate: function() {
      var o = this.options;

      if (!o.readonly)
        this.widget.remove_event(this.get_send_event(), this.get_send_cb());

      this.binding.removeListener(this);
      if (this._delay_id) clearTimeout(this._delay_id);
      this._delay_id = 0;
    },
    receive_delay_cb: function() {
      /* this is rarely used */
      return function() {
        this._delay_id = 0;
        var b = this.binding;
        if (!b.has_value) return;
        this.receive(b.value);
      }.bind(this);
    },
    receive: function(v) {
      var t = this.last_send;
      var o = this.options;

      if (this.recurse) return;

      if (t > 0) {
        /* we might have to delay this value */
        t += o["receive-delay"] - Date.now();
        if (t > 0) {
          /* if the returned value is identical to the requested value,
           * we do not need to delay it */
          if (this.binding.requested_value !== v) {
            /* The call out is already in progress, so we are done */
            if (this._delay_id) return;
            this._delay_id = setTimeout(this.receive_delay_cb(), t);
            return;
          }
        } else {
          /* the last send is older than the receive delay, we can reset
           * the timestamp */
          this.last_send = 0;
        }
      }

      var f = o["transform-receive"];
      var w = this.widget;

      this.recurse = true;

      try {
        if (f !== void(0)) v = f.call(this.binding, v);
        if (v !== void(0)) w.set(o.name, v);
        if (o.debug) TK.log("Connector(%o) received %o", this.binding, v);
      } catch (e) {
        AWML.warn("Error when receiving value:", e);
      } finally {
        this.recurse = false;
      }
    },
    send: function(v) {
      if (this.recurse) return;

      var o = this.options;
      var f = o["transform-send"];

      this.recurse = true;

      try {
        if (f !== void(0)) v = f.call(this.binding, v);
        if (v !== void(0)) this.binding.set(v);
        if (o.debug) TK.log("Connector(%o) sent %o", this.binding, v);
      } catch (e) {
        AWML.warn("Error when sending value:", e);
      } finally {
        this.recurse = false;
      }

      if (o["receive-delay"] > 0) this.last_send = Date.now();
    },
  };

  /** 
   * UserBinding is a Connector, which connects a toolkit widget and a binding.
   * It binds to the <code>useraction</code> event of the widget and does not react to
   * external <code>set</code> events.
   *
   */
  function UserBinding(uri, widget, option, transform_in, transform_out) {
    if (typeof uri === "string") uri = get_binding(uri);

    var options = Object.assign(Object.create(this.option_defaults), {
      name: option,
      "transform-send": transform_out,
      "transform-receive": transform_in,
    });

    WidgetConnector.call(this, uri, widget, options);
  };
  UserBinding.prototype = WidgetConnector.prototype;

  /**
   * SyncBinding
   */
  function SyncBinding(uri, widget, option, transform_in, transform_out) {
    if (typeof uri === "string") uri = get_binding(uri);

    var options = Object.assign(Object.create(this.option_defaults), {
      sync: true,
      name: option,
      "transform-send": transform_out,
      "transform-receive": transform_in,
    });

    WidgetConnector.call(this, uri, widget, options);
  };
  SyncBinding.prototype = WidgetConnector.prototype;

  /**
   * Abstract Connector base class.
   */
  function Connector(binding, transform_in, transform_out) {
    this.binding = binding;
    this.uri = binding.uri;
    this.transform_in = transform_in;
    this.transform_out = transform_out;
  };
  Connector.prototype = {
    receive: function(v) { },
    send: function(v) {
      var binding = this.binding;
      var transform = this.transform_out;
      if (transform) v = transform(v);
      binding.set(v);
    },
    deactivate: function() {
      this.binding.removeListener(this);
      return this;
    },
    activate: function() {
      this.binding.addListener(this);
      return this;
    },
  };

  /**
   * Property Binding, essentially only receives values.
   */
  function PropertyBinding(uri, target, property, transform_in, transform_out) {
    this.target = target;
    this.property = property;
    this.timer_id = -1;
    this._publish = this.publish.bind(this);
    this.writable = true;
    var d = Object.getOwnPropertyDescriptor(this.target, this.property);
    if (d) this.writable = d.writable;
    else {
      try {
        this.target[this.property] = this.target[this.property];
      } catch (e) {
        this.writable = false;
      }
    }

    Connector.call(this, get_binding(uri), transform_in, transform_out);
  };
  PropertyBinding.prototype = Object.assign(Object.create(Connector.prototype), {
    activate: function() {
      // TODO: might be more reasonable to require calling this explicitly
      if (!this.binding.has_value)
        this.publish();

      if (!this.writable) return this;
      return Connector.prototype.activate.call(this);
    },
    deactivate: function() {
      if (!this.writable) return this;
      return Connector.prototype.deactivate.call(this);
    },
    publish: function() {
      this.send(this.target[this.property]);
    },
    receive: function(v) {
      var transform = this.transform_in;
      if (transform) v = transform(v);
      this.target[this.property] = v;
    },
    publish_interval: function(v) {
      if (this.timer_id !== -1) {
        window.clearInterval(this.timer_id);
        this.timer_id = -1;
      }
      if (v > 0) this.timer_id = window.setInterval(this._publish, v);
      return this;
    },
  });

  /**
   * MethodBinding calls a setter on receiving a value.
   */
  function MethodBinding(uri, method, transform_in, transform_out) {
    this.uri = uri;
    this.binding = get_binding(uri);
    this.method = method;
    Connector.call(this, get_binding(uri), transform_in, transform_out);
  };
  MethodBinding.prototype = Object.assign(Object.create(Connector.prototype), {
    receive: function(v) {
      var transform = this.transform_in;
      if (transform) v = transform(v);
      this.method(v);
    },
    /* MethodBindings are read-only */
    publish: function() { },
  });

  AWML.Tags.Backend = AWML.register_element("awml-backend", {
    createdCallback: function() {
      this.style.display = "none";
      this.name = "";
      this.backend = null;
      this.reconnect_id = 0;
      this.error_cb = function(e) {
        this.detachedCallback();
        if (this.reconnect_id) return;
        this.reconnect_id = window.setTimeout(function() {
          this.reconnect_id = 0;
          this.attachedCallback();
        }.bind(this), 500);
      }.bind(this);
    },
    attributeChangedCallback: function(name, old_value, value) {
      if (document.body.contains(this)) {
        // simply detach and attach if any property has changed.
        this.detachedCallback();
        this.attachedCallback();
      }
    },
    detachedCallback: function() {
      var backend = this.backend;
      if (backend) {
        AWML.register_backend(this.name, null);
        backend.removeEventListener("error", this.error_cb);
        backend.removeEventListener("close", this.error_cb);
        backend.removeEventListener("destroy", this.error_cb);
        backend.destroy();
        backend = null;
      }
    },
    attachedCallback: function() {
      var name = this.getAttribute("name");

      if (typeof(name) !== "string") {
        AWML.error("awml-backend without name.");
        return;
      }

      this.name = name;

      var shared = typeof(this.getAttribute("shared")) === "string";
      var type = this.getAttribute("type");

      if (type === null) return;

      if (!AWML.Backends[type]) {
        AWML.error("No such backend: ", type);
        return;
      }

      var constructor = AWML.Backends[type];
      var args = constructor.prototype.arguments_from_node(this);

      if (shared) {
        if (AWML.Backends.shared) {
          args = [ type ].concat(args);
          constructor = AWML.Backends.shared;
        } else {
          AWML.warn("Shared backend not supported.");
        }
      }

      var backend = new (constructor.bind.apply(constructor, [ window ].concat(args)));

      this.backend = backend;

      backend.addEventListener("error", this.error_cb);
      backend.addEventListener("close", this.error_cb);
      backend.addEventListener("destroy", this.error_cb);

      if (backend.is_open()) {
        AWML.register_backend(name, backend);
      } else {
        backend.addEventListener("open", AWML.register_backend.bind(AWML, name, backend));
      }
    }
  });

  var bindings = new Map(),
      backends = new Map();

  function backend_deactivate(proto, backend) {
    if (!bindings.has(proto)) return;

    bindings.get(proto).forEach(function (bind, uri, m) {
      bind.delete_backend(backend);
    });
  }
  function backend_activate(proto, backend) {
    if (!bindings.has(proto)) return;

    bindings.get(proto).forEach(function (bind, uri, m) {
      bind.set_backend(backend);
    });
  }
  function register_backend(proto, backend) {
    var cb;

    if (backends.has(proto)) {
      var backend = backends.get(proto);
      var ev = new CustomEvent("AWMLBackendUnregistered", {
        detail: {
          protocol: proto,
          backend: backend,
        },
      });
      document.dispatchEvent(ev);
      backend_deactivate(proto, backend);
      backends.delete(proto);
    }

    if (backend) {
      backends.set(proto, backend);
      cb = backend_deactivate.bind(this, proto, backend);
      backend.addEventListener('close', cb);
      backend.addEventListener('error', cb);
      var ev = new CustomEvent("AWMLBackendRegistered", {
        detail: {
          protocol: proto,
          backend: backend
        },
      });
      document.dispatchEvent(ev);
      backend_activate(proto, backend);
    }

    return backend;
  };
  function init_backend(proto, type) {
    if (!AWML.Backends || !AWML.Backends[type]) throw new Error("No such backend.");

    var constructor = AWML.Backends[type];
    var args = Array.prototype.slice.call(arguments, 1);

    return register_backend(proto, new (constructor.bind.apply(constructor, args)));
  }

  function get_binding (uri) {
    var i = uri.search(':');
    var bind;
    if (i === -1) throw new Error("bad URI: "+uri);
    var proto = uri.substr(0, i);

    if (!bindings.has(proto)) bindings.set(proto, bind = new Map());
    else bind = bindings.get(proto)

    if (bind.has(uri)) return bind.get(uri);

    bind.set(uri, bind = new Binding(uri));

    if (backends.has(proto)) bind.set_backend(backends.get(proto));

    return bind;
  };

  function get_bindings(proto) {
    return bindings.get(proto) || new Map();
  };
  function get_backend(proto) {
    return backends.get(proto);
  }

  AWML.Options.bind = BindingOption;

  Object.assign(AWML, {
    Binding: Binding,
    ListBinding: ListBinding,
    get_binding: get_binding,
    get_bindings: get_bindings,
    register_backend: register_backend,
    init_backend: init_backend,
    get_backend: get_backend,
    // Connectors
    SyncBinding: SyncBinding,
    UserBinding: UserBinding,
    PropertyBinding: PropertyBinding,
    MethodBinding: MethodBinding,
    Connectors: {
      Base: Connector,
      Method: MethodBinding,
      Property: PropertyBinding,
      TKUser: UserBinding,
      TKSync: SyncBinding,
    },
  });

})(this.AWML || (this.AWML = {}));
