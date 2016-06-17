// vim:sw=2
"use strict";
(function(AWML) {
  function Binding(uri) {
    this.uri = uri;
    this.handler = null;
    this.value = null;
    this.requested_value = null;
    this.has_value = false;
    this.listeners = [];
  };
  Binding.prototype = {
    set_handler: function(handler) {
      this.handler = handler;
      handler.register(this);
      if (this.requested_value !== this.value) {
        handler.set(this.uri, this.requested_value);
      }
    },
    remove_handler: function(handler) {
      handler.unregister(this);
      this.handler = null;
    },
    addListener: function(callback) {
      this.listeners.push(callback);
      if (this.has_value) callback(this.value);
    },
    removeListener: function(callback) {
      var i;
      while ((i = this.listeners.indexOf(callback)) != -1)
        this.listeners.splice(i, 1);
    },
    set: function(value) {
      this.requested_value = value;
      if (this.handler) {
        if (this.requested_value !== this.value) {
          this.handler.set(this.uri, value);
        }
      }
    },
    update: function(value) {
      var i;
      this.value = value;
      this.has_value = true;
      for (i = 0; i < this.listeners.length; i++) {
        this.listeners[i].call(this, value);
      }
    },
  };

  /**
   * Abstract Connector base class.
   */
  function Connector(binding, transform_in, transform_out) {
    this.binding = binding;
    this.uri = binding.uri;
    this.transform_in = transform_in;
    this.transform_out = transform_out;
    this._receive = this.receive.bind(this, transform_in)
    this._send = this.send.bind(this, transform_out);
  };
  Connector.prototype = {
    receive: function(transform, v) { },
    send: function(transform, v) {
      var binding = this.binding;
      if (transform) v = transform(v);
      binding.set(v);
    },
    deactivate: function() {
      this.binding.removeListener(this._receive);
      return this;
    },
    activate: function() {
      this.binding.addListener(this._receive);
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

    this._useraction_cb = function(option, key, value) {
      if (key === option) this._send(value);
    }.bind(this, option);

    Connector.call(this, get_binding(uri), transform_in, transform_out);
  };
  UserBinding.prototype = Object.assign(Object.create(Connector.prototype), {
    activate: function() {
      this.widget.add_event("useraction", this._useraction_cb);
      return Connector.prototype.activate.call(this);
    },
    deactivate: function() {
      this.widget.remove_event("useraction", this._useraction_cb);
      return Connector.prototype.deactivate.call(this);
    },
    receive: function(transform, v) {
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
    receive: function(transform, v) {
      if (this.recurse) return;
      if (transform) v = transform(v);
      this.recurse = true;
      this.widget.set(this.option, v);
      this.recurse = false;
    },
    send: function(transform, v) {
      if (this.recurse) return;
      this.recurse = true;
      Connector.prototype.send.call(this, transform, v);
      this.recurse = false;
    },
  });

  /**
   * Property Binding, essentially only receives values.
   */
  function PropertyBinding(uri, target, property, transform_in, transform_out) {
    this.target = target;
    this.property = property;

    Connector.call(this, get_binding(uri), transform_in, transform_out);
  };
  PropertyBinding.prototype = Object.assign(Object.create(Connector.prototype), {
    activate: function() {
      // TODO: might be more reasonable to require calling this explicitly
      if (!this.binding.has_value)
        this.sync();

      return Connector.prototype.activate.call(this);
    },
    sync: function() {
      this._send(this.target[this.property]);
    },
    receive: function(transform, v) {
      if (transform) v = transform(v);
      this.target[this.property] = v;
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
    receive: function(transform, v) {
      if (transform) v = transform(v);
      this.method(v);
    },
  });

  AWML.Tags.Binding = document.registerElement("awml-binding", {
    prototype: Object.assign(Object.create(HTMLElement.prototype), {
      createdCallback: function() {
          this.style.display = "none";
          this.bind = null;
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
    })
  });

  var handlers = new Map(),
      bindings = new Map();

  function register_protocol_handler(proto, handler) {
    handlers.set(proto, handler);

    if (!bindings.has(proto)) return;

    bindings.get(proto).forEach(function (bind, uri, m) {
      bind.set_handler(handler);
    });
  };
  function unregister_protocol_handler(proto, handler) {
    handlers.delete(proto);

    if (!bindings.has(proto)) return;

    bindings.get(proto).forEach(function (bind, uri, m) {
      bind.remove_handler(handler);
    });
  };
  function get_binding (uri) {
    var i = uri.search(':');
    var bind;
    if (i === -1) throw new Error("bad URI: "+uri);
    var proto = uri.substr(0, i);

    if (!bindings.has(proto)) bindings.set(proto, bind = new Map());
    else bind = bindings.get(proto)

    if (bind.has(uri)) return bind.get(uri);

    bind.set(uri, bind = new Binding(uri));

    if (handlers.has(proto)) bind.set_handler(handlers.get(proto));

    return bind;
  };

  function SimpleHandler(proto) {
    this.proto = proto;
    this.bindings = {};
    AWML.register_protocol_handler(proto, this);
  }

  SimpleHandler.prototype = {};
  SimpleHandler.prototype.set = function(uri, value) {
    this.update(uri, value);
  };
  SimpleHandler.prototype.update = function(uri, value) {
    var bind = this.bindings[uri];
    if (bind) bind.update(value);
  };
  SimpleHandler.prototype.register = function(binding) {
    this.bindings[binding.uri] = binding;
  };
  SimpleHandler.prototype.unregister = function(binding) {
    delete this.bindings[binding.uri];
  };
  AWML.SimpleHandler = SimpleHandler;

  (function(AWML) {
    function open_cb() {
      AWML.register_protocol_handler(this.proto, this);
    };
    function close_cb() {
      AWML.unregister_protocol_handler(this.proto, this);
    };
    function error_cb() {
      AWML.unregister_protocol_handler(this.proto, this);
    };
    function message_cb(ev) {
      var d = JSON.parse(ev.data);
      var uri, i, id, value;

      if (typeof(d) === "object") {
        if (d instanceof Array) {
          for (i = 0; i < d.length; i+=2) {
            id = d[i];
            value = d[i+1];

            uri = this.id2path.get(id);

            this.update(uri, value);
          }
        } else {
          for (uri in d) {
            id = d[uri];
            this.path2id.set(uri, id);
            this.id2path.set(id, uri);
            if (this.modifications.has(uri)) {
              var value = this.modifications.get(uri);
              this.modifications.delete(uri);
              this.set(uri, value);
            }
          }
        }
      }
    };
    function connect() {
      this.ws = new WebSocket(this.url, "json");
      this.ws.onopen = open_cb.bind(this);
      this.ws.onclose = close_cb.bind(this);
      this.ws.onerror = error_cb.bind(this);
      this.ws.onmessage = message_cb.bind(this);
    };
    function WebSocketJSON(proto, url) {
      this.proto = proto;
      this.url = url;
      this.bindings = {};
      this.path2id = new Map();
      this.id2path = new Map();
      this.modifications = new Map();
      connect.call(this);
    }
    WebSocketJSON.prototype = {};
    WebSocketJSON.prototype.set = function(uri, value) {
      if (this.path2id.has(uri)) {
        var id = this.path2id.get(uri);
        this.ws.send(JSON.stringify([ id, value ]));
        this.update(uri, value);
      } else {
        this.modifications.set(uri, value);
      }
    };
    WebSocketJSON.prototype.update = function(uri, value) {
      var bind = this.bindings[uri] || AWML.get_binding(uri);
      if (bind) bind.update(value);
    };
    WebSocketJSON.prototype.register = function(binding) {
      var uri = binding.uri;
      this.bindings[uri] = binding;

      if (!this.path2id.has(uri)) {
        var d = {};
        d[uri] = 1;
        this.ws.send(JSON.stringify(d));
      }
    };
    WebSocketJSON.prototype.unregister = function(binding) {
      delete this.bindings[binding.uri];
    };
    WebSocketJSON.prototype.close = function() {
      this.ws.close();
    };
    AWML.WebSocketJSON = WebSocketJSON;
  })(AWML);

  Object.assign(AWML, {
    Binding: Binding,
    get_binding: get_binding,
    register_protocol_handler: register_protocol_handler,
    unregister_protocol_handler: unregister_protocol_handler,
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

    // Handlers
    Handlers: {
      Simple: SimpleHandler,
    },
  });

})(this.AWML || (this.AWML = {}));
