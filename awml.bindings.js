// vim:sw=2
"use strict";
(function(AWML) {

  function call_listener(cb, value) {
    if (typeof(cb) === "function") {
      cb(value);
    } else {
      cb.receive(value);
    }
  }

  function Binding(uri) {
    this.uri = uri;
    this.id = false;
    this.backend = null;
    this.value = null;
    this.requested_value = null;
    this.has_value = false;
    this.listeners = null;
  };
  Binding.prototype = {
    set_backend: function(backend) {
      this.backend = backend;
      backend.subscribe(this.uri, this)
        .then(
          function(a) {
            this.id = a[1];
            if (this.requested_value !== null && this.value !== this.requested_value) {
              this.backend.set(a[1], this.requested_value);
            }
          }.bind(this),
          function(reason) {
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
    hasListener: function(callback) {
      var a = this.listeners;
      if (a === null) return false;
      if (Array.isArray(a))
        return a.indexOf(callback) !== -1;
      return a === callback;
    },
    addListener: function(callback) {
      if (this.hasListener(callback)) {
        AWML.warn("Trying to add same listener twice.");
        return;
      }
      var a = this.listeners;
      if (a === null) {
        this.listeners = callback;
      } else if (Array.isArray(a)) {
        a.push(callback);
      } else {
        this.listeners = [ a, callback ];
      }
      if (this.has_value) call_listener(callback, this.value);
    },
    removeListener: function(callback) {
      var a = this.listeners;

      /* TODO: should we warn? */

      if (a === null) return;
      if (Array.isArray(a)) {
        var i;
        if ((i = a.indexOf(callback)) != -1) {
          a.splice(i, 1);
          if (a.length === 1) this.listeners = a[0];
        }
      } else {
        if (a === callback) {
          this.listeners = null;
        }
      }

    },
    set: function(value) {
      if (value === this.requested_value) return;
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

      a = this.listeners;

      if (a === null) return;

      if (Array.isArray(a)) {
        var i;
        for (i = 0; i < a.length; i++)
          call_listener(a[i], value);
      } else {
        call_listener(a, value);
      }
    },
  };

  function binding_set_handler(v) {
    this.send(v);
  }
  function binding_user_handler(k, v) {
    this.send(v);
  }

  function BindingOption(node) {
    AWML.Option.call(this, node);
    this.src = node.getAttribute("src");
    this.prefix = node.getAttribute("prefix");
    this.sync = node.getAttribute("sync") !== null;
    this.value = node.getAttribute("value");
    this.format = node.getAttribute("format");
    this.readonly = node.getAttribute("readonly") !== null;

    var transform_send = node.getAttribute("transform-send");
    var transform_receive = node.getAttribute("transform-receive");

    this.transform_send = transform_send ? AWML.parse_format("js", transform_send) : null;
    this.transform_receive = transform_receive ? AWML.parse_format("js", transform_receive) : null;

    this.recurse = false;
    this.attached = false;
    this.binding = null;

    this.send_cb = null;
  };
  BindingOption.prototype = Object.assign(Object.create(AWML.Option.prototype), {
    get_send_event: function() {
      return this.sync ? "set_"+this.name : "useraction";
    },
    get_send_cb: function() {
      var cb = this.send_cb;
      if (!cb) this.send_cb = cb = (this.sync ? binding_set_handler : binding_user_handler).bind(this);
      return cb;
    },
    bind: function(binding, node, widget) {
      binding.addListener(this);
    },
    unbind: function(binding, node, widget) {
      binding.removeListener(this);
    },
    attach: function(node, widget) {
      AWML.Option.prototype.attach.call(this, node, widget);

      if (this.prefix !== null) {
        this.binding = null;
      } else {
        this.binding = AWML.get_binding(this.src);
        this.bind(this.binding, node, widget);
      }

      if (!this.readonly) {
        widget.add_event(this.get_send_event(), this.get_send_cb());
      }
    },
    detach: function(node, widget) {
      if (this.binding) this.unbind(this.binding, node, widget);

      if (!this.readonly) {
        widget.remove_event(this.get_send_event(), this.get_send_cb());
      }

      AWML.Option.prototype.detach.call(this, node, widget);
    },
    set_prefix: function(prefix, handle) {
      if (this.prefix !== handle) return;

      var node = this.node;
      var widget = this.widget;
      var attached = widget !== null;

      if (attached) {
        if (this.binding) this.unbind(this.binding, node, widget);
      }

      if (typeof prefix === "string") {
        this.binding = AWML.get_binding(prefix + this.src);
        if (attached) this.bind(this.binding, node, widget);
      } else {
        this.binding = null;
      }
    },
    send: function(v) {
      if (!this.recurse && this.binding) {
        this.recurse = true;
        if (this.transform_send) v = this.transform_send(v);
        this.binding.set(v);
        this.recurse = false;
      }
    },
    receive: function(v) {
      if (!this.recurse) {
        this.recurse = true;
        if (this.transform_receive) v = this.transform_receive(v);
        this.widget.set(this.name, v);
        this.recurse = false;
      }
    },
  });

  function collect_prefix(from, to, handle) {
    var attr = handle.length ? "prefix-"+handle : "prefix";
    var prefix = [];
    var tmp;

    var node = from.parentNode;

    while (node && node.getAttribute) {
      tmp = node.getAttribute(attr);
      if (tmp) {
        prefix.push(tmp);
      }
      if (node === to) break;
      node = node.parentNode;
    }

    return prefix.reverse().join("");
  }

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
  });

  AWML.Tags.Backend = AWML.register_element("awml-backend", {
    createdCallback: function() {
      this.style.display = "none";
      this.name = "";
      this.backend = null;
      this.error_cb = function() {
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
      AWML.register_backend(this.name, null);
    },
    attachedCallback: function() {
      this.name = this.getAttribute("name");

      if (typeof(this.name) !== "string") {
        AWML.error("awml-backend without name.");
        return;
      }

      var shared = typeof(this.getAttribute("shared")) === "string";
      var type = this.getAttribute("type");

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

      this.backend = new (constructor.bind.apply(constructor, [ window ].concat(args)));

      AWML.register_backend(this.name, this.backend);

      this.backend.addEventListener("error", this.error_cb);
      this.backend.addEventListener("close", this.error_cb);
    }
  });

  AWML.Tags.Binding = AWML.register_element("awml-binding", {
    createdCallback: function() {
        this.style.display = "none";
        this.bind = null;
        AWML.warn("awml-binding is deprecated");
    },
    attributeChangedCallback: function(name, old_value, value) {
        if (name === "option" || name === "source") {
          this.attachedCallback();
        }
    },
    detachedCallback: function() {
      if (this.bind) {
        this.bind.deactivate();
        this.bind = null
      }
    },
    attachedCallback: function() {
      var parent_node = AWML.find_parent_widget.call(this);
      var type = this.getAttribute("type");
      var cl;

      if (this.bind) this.bind.deactivate();

      if (parent_node) {
        switch (type) {
        case "sync":
          cl = SyncBinding;
          break;
        case "user":
        default:
          cl = UserBinding;
          break;
        }
        this.bind = new cl(this.getAttribute("source"),
                           parent_node.widget,
                           this.getAttribute("option"));
        this.bind.activate();
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
