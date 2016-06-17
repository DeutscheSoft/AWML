// vim:sw=2
"use strict";
(function(AWML) {
  var handlers = {},
      bindings = {};
  AWML.register_protocol_handler = function(proto, handler) {
    var b;
    handlers[proto] = handler;
    if (!(b = bindings[proto])) bindings[proto] = b = {};
    for (var uri in b) b[uri].set_handler(handler);
  };
  AWML.unregister_protocol_handler = function(proto, handler) {
    var b = bindings[proto];

    delete handlers[proto];
    
    for (var uri in b) b[uri].remove_handler(handler);
  };

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
  AWML.Binding = Binding;

  AWML.get_binding = function(uri) {
    var i = uri.search(':');
    var bind;
    if (i === -1) throw new Error("bad URI: "+uri);
    var proto = uri.substr(0, i);

    if (!bindings[proto]) bindings[proto] = {};
    if (bind = bindings[proto][uri])
        return bind;
    bindings[proto][uri] = bind = new Binding(uri);
    if (handlers[proto]) bind.set_handler(handlers[proto]);
    return bind;
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

    Connector.call(this, AWML.get_binding(uri), transform_in, transform_out);
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
  AWML.UserBinding = UserBinding;

  /**
   * SyncBinding
   */
  function SyncBinding(uri, widget, option, transform_in, transform_out) {
    this.widget = widget;
    this.option = option;
    this.recurse = false;

    Connector.call(this, AWML.get_binding(uri), transform_in, transform_out);
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
  AWML.SyncBinding = SyncBinding;

  /**
   * Property Binding, essentially only receives values.
   */
  function PropertyBinding(uri, target, property, transform_in, transform_out) {
    this.target = target;
    this.property = property;

    Connector.call(this, AWML.get_binding(uri), transform_in, transform_out);
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
  AWML.PropertyBinding = PropertyBinding;

  /**
   * MethodBinding calls a setter on receiving a value.
   */
  function MethodBinding(uri, method, transform_in, transform_out) {
    this.uri = uri;
    this.binding = AWML.get_binding(uri);
    this.method = method;
    Connector.call(this, AWML.get_binding(uri), transform_in, transform_out);
  };
  MethodBinding.prototype = Object.assign(Object.create(Connector.prototype), {
    receive: function(transform, v) {
      if (transform) v = transform(v);
      this.method(v);
    },
  });
  AWML.MethodBinding = MethodBinding;

  AWML.Connectors = {
    Base: Connector,
    Method: MethodBinding,
    Property: PropertyBinding,
    TKUser: UserBinding,
    TKSync: SyncBinding,
  };

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
            cl = AWML.SyncBinding;
            break;
          case "user":
          default:
            cl = AWML.UserBinding;
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
})(this.AWML || (this.AWML = {}));
