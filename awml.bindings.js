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
    this.id = false;
    this.backend = null;
    this.value = null;
    this.requested_value = null;
    this.has_value = false;
    BaseBinding.call(this);
  };
  Binding.prototype = inherit(BaseBinding, {
    set_backend: function(backend) {
      this.backend = backend;
      backend.subscribe(this.uri, this)
        .then(
          function(a) {
            this.id = a[1];
            var has_value = a.length === 3;
            if (has_value) {
              this.update(a[1], a[2]);

              if (this.requested_value !== null && this.requested_value !== a[2]) {
                this.backend.set(a[1], this.requested_value);
              }
            } else if (this.has_value) {
              this.backend.set(a[1], this.value);
              this.has_value = false;
              this.value = null;
            }
          }.bind(this),
          function(reason) {
            /* FIXME: this log output can be very annoying */
            AWML.warn("Subscription failed: ", reason);
          });
    },
    delete_backend: function(backend) {
      if (this.id !== false) {
        backend.unsubscribe(this.id, this);
      }
      this.id = false;
      this.backend = null;
    },
    set: function(value) {
      if (value === this.requested_value && value === this.value) return;
      this.requested_value = value;
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
    this.prefix = node.getAttribute("src-prefix");
    this.sync = node.getAttribute("sync") !== null;
    this.debug = node.getAttribute("debug") !== null;
    this.value = node.getAttribute("value");
    this.format = node.getAttribute("format");
    this.readonly = node.getAttribute("readonly") !== null;
    this.writeonly = node.getAttribute("writeonly") !== null;
    this.unsubscribe = node.getAttribute("unsubscribe-when-hidden") !== null;

    var delay = node.getAttribute("receive-delay");

    /* default receive delay of 2 seconds */
    this.receive_delay = delay === null ? 2000 : parseInt(delay);
    this.receive_delay_id = 0;

    if (this.receive_delay > 0) {
      this.receive_delay_cb = function() {
        var b = this.binding;
        this.receive_delay_id = 0;
        if (!b || !b.has_value) return;
        this.receive(b.value);
      }.bind(this);
    } else {
      this.receive_delay_cb = null;
    }

    var src = node.getAttribute("src");

    if (src !== null && src.search(',') !== -1) {
      src = src.split(",");
    }

    this.src = src;

    if (this.sync && this.writeonly)
      AWML.warn("Setting both 'sync' and 'writeonly' does not work.");

    var transform_send = node.getAttribute("transform-send");
    var transform_receive = node.getAttribute("transform-receive");

    this.transform_send = transform_send ? AWML.parse_format("js", transform_send) : null;
    this.transform_receive = transform_receive ? AWML.parse_format("js", transform_receive) : null;

    this.last_send = 0;
    this.recurse = false;
    this.attached = false;
    this.binding = null;

    this.send_cb = null;

    this.visibility_cb = this.unsubscribe ? function(state) {
      if (!this.binding) return;
      if (state) this.bind(this.binding, this.node, this.widget);
      else this.unbind(this.binding, this.node, this.widget);
    }.bind(this) : null;
  };
  BindingOption.prototype = Object.assign(Object.create(AWML.Option.prototype), {
    get_send_event: function() {
      if (this.writeonly) return "userset";
      if (this.sync) return "set_"+this.name;
      return "useraction";
    },
    get_send_cb: function() {
      var cb = this.send_cb;
      if (cb) return cb;
      if (this.writeonly) cb = binding_userset_handler.bind(this, this.name);
      else if (this.sync) cb = binding_set_handler;
      else cb = binding_useraction_handler.bind(this, this.name);

      cb = cb.bind(this);
      this.send_cb = cb;
      return cb;
    },
    bind: function(binding, node, widget) {
      if (this.debug) TK.log("bind", binding);
      binding.addListener(this);
    },
    unbind: function(binding, node, widget) {
      if (this.debug) TK.log("unbind", binding);
      binding.removeListener(this);
    },
    attach: function(node, widget) {
      AWML.Option.prototype.attach.call(this, node, widget);

      this.update_prefix(null);

      if (!this.readonly) {
        widget.add_event(this.get_send_event(), this.get_send_cb());
      }

      if (this.unsubscribe)
        widget.add_event("visibility", this.visibility_cb);
    },
    detach: function(node, widget) {
      if (this.binding) this.unbind(this.binding, node, widget);

      if (!this.readonly) {
        widget.remove_event(this.get_send_event(), this.get_send_cb());
      }

      if (this.unsubscribe)
        widget.remove_event("visibility", this.visibility_cb);

      AWML.Option.prototype.detach.call(this, node, widget);
    },
    update_prefix: function(handle) {
      var node = this.node;
      var widget = this.widget;

      if (widget === null) return;

      if (this.binding) this.unbind(this.binding, node, widget);

      var src = this.src;

      if (src === null) return;

      if (src_needs_prefix(src)) {
        var prefix = AWML.collect_prefix(node, this.prefix);
        if (prefix.search(':') === -1) return;
        src = src_apply_prefix(src, prefix);
      }

      this.binding = Array.isArray(src) ? new ListBinding(src.map(get_binding)) : AWML.get_binding(src);
      if (!this.unsubscribe || widget.is_drawn())
        this.bind(this.binding, node, widget);
    },
    send: function(v) {
      if (this.debug) TK.log("send", this.binding, v);
      if (!this.recurse && this.binding) {
        this.recurse = true;
        if (this.transform_send) v = this.transform_send(v);
        if (v !== void(0)) this.binding.set(v);
        this.recurse = false;
        this.last_send = Date.now();
      }
    },
    receive: function(v) {
      var t = this.last_send;
      var d = this.receive_delay;
      if (t > 0 && d > 0) {
        /* callout already happening */
        if (this.receive_delay_id) return;
        t += d - Date.now();
        if (t > 0) {
          /* delay receive */
          this.receive_delay_id = setTimeout(this.receive_delay_cb, t);
          return;
        }
      }
      if (this.debug) TK.log("receive", this.binding, v);
      if (!this.recurse) {
        this.recurse = true;
        if (this.transform_receive) v = this.transform_receive(v);
        if (v !== void(0)) this.widget.set(this.name, v);
        this.recurse = false;
      }
    },
  });

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
   * UserBinding is a Connector, which connects a toolkit widget and a binding.
   * It binds to the <code>useraction</code> event of the widget and does not react to
   * external <code>set</code> events.
   *
   */
  function UserBinding(uri, widget, option, transform_in, transform_out) {
    this.widget = widget;
    this.option = option;

    this._send = function(key, value) {
      var option = this.option;
      if (key === option) this.send(value);
    }.bind(this);

    Connector.call(this, get_binding(uri), transform_in, transform_out);
  };
  UserBinding.prototype = Object.assign(Object.create(Connector.prototype), {
    activate: function() {
      this.widget.add_event("useraction", this._send);
      return Connector.prototype.activate.call(this);
    },
    deactivate: function() {
      this.widget.remove_event("useraction", this._send);
      return Connector.prototype.deactivate.call(this);
    },
    receive: function(v) {
      var transform = this.transform_in;
      if (transform) v = transform(v);
      this.widget.set(this.option, v);
    }
  });

  /**
   * SyncBinding
   */
  function SyncBinding(uri, widget, option, transform_in, transform_out) {
    this.widget = widget;
    this.option = option;
    this.recurse = false;
    this._send = this.send.bind(this);

    Connector.call(this, get_binding(uri), transform_in, transform_out);
  };
  SyncBinding.prototype = Object.assign(Object.create(Connector.prototype), {
    activate: function() {
      this.widget.add_event("set_"+this.option, this._send);
      return Connector.prototype.activate.call(this);
    },
    deactivate: function() {
      this.widget.remove_event("set_"+this.option, this._send);
      return Connector.prototype.deactivate.call(this);
    },
    receive: function(v) {
      if (this.recurse) return;
      var transform = this.transform_in;
      if (transform) v = transform(v);
      this.recurse = true;
      this.widget.set(this.option, v);
      this.recurse = false;
    },
    send: function(v) {
      if (this.recurse) return;
      this.recurse = true;
      Connector.prototype.send.call(this, v);
      this.recurse = false;
    },
  });

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
      this.error_cb = function(e) {
        window.setTimeout(function() {
          this.detachedCallback();
          this.attachedCallback();
        }.bind(this), 250);
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
      backend_deactivate(proto, backends.get(proto));
      backends.delete(proto);
    }

    if (backend) {
      backends.set(proto, backend);
      cb = backend_deactivate.bind(this, proto, backend);
      backend.addEventListener('close', cb);
      backend.addEventListener('error', cb);
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
