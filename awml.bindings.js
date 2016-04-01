// vim:sw=2
"use strict";
(function(AWML) {
  var handlers = {},
      bindings = {};
  AWML.register_protocol_handler = function(proto, handler) {
    var b;
    handlers[proto] = handler;
    if (!(b = bindings[proto])) bindings[proto] = b = {};
    handler.register_bindings(b);
    for (var uri in b) b[uri].set_handler(handler);
  };
  AWML.unregister_protocol_handler = function(proto, handler) {
    delete handlers[proto];
    handler.unregister_bindings(bindings[proto]);
  };
  function Binding(uri) {
    this.uri = uri;
    this.handler = null;
    this.value = null;
    this.requested_value = null;
    this.has_value = false;
    this.listeners = [];
  };
  AWML.Binding = Binding;
  Binding.prototype = {};
  Binding.prototype.set_handler = function(handler) {
    this.handler = handler;
    if (this.requested_value !== this.value) {
      handler.set(this.uri, this.requested_value);
    }
  };
  Binding.prototype.remove_handler = function(handler) {
    this.handler = null;
  };
  Binding.prototype.addListener = function(callback) {
    this.listeners.push(callback);
    if (this.has_value) callback(this.value);
  };
  Binding.prototype.removeListener = function(callback) {
    var i;
    while ((i = this.listeners.indexOf(callback)) != -1)
      this.listeners.splice(i, 1);
  };
  Binding.prototype.set = function(value) {
    this.requested_value = value;
    if (this.handler) {
      if (this.requested_value !== this.value) {
        this.handler.set(this.uri, value);
      }
    }
  };
  Binding.prototype.update = function(value) {
    var i;
    this.value = value;
    for (i = 0; i < this.listeners.length; i++) {
      this.listeners[i].call(this, value);
    }
  };
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
  AWML.Tags.Binding = document.registerElement("awml-binding", {
    prototype: Object.assign(Object.create(HTMLElement.prototype), {
      createdCallback: function() {
          var bind, option;
          this.style.display = "none";
          this.option = option = this.getAttribute("option");
          this.source = this.getAttribute("source");
          this.binding = bind = AWML.get_binding(this.source);
          this.target = null;
          this._useraction_cb = function(key, value) {
            if (key === option)
              bind.set(value); 
          };
          this._set_cb = function(value) {
            this.target.set(option, value);
          }.bind(this);
      },
      attributeChangedCallback: function(name, old_value, value) {
          TK.warn("not implemented");
      },
      detachedCallback: function() {
        var parent_node = AWML.find_parent_widget.call(this);
        if (parent_node) {
          this.target = null;
          this.binding.removeListener(this._set_cb);
          parent_node.remove_event("useraction", this._useraction_cb);
        }
      },
      attachedCallback: function() {
        var bind = this.binding;
        var parent_node = AWML.find_parent_widget.call(this);
        if (parent_node) {
          this.target = parent_node.widget;
          this.binding.addListener(this._set_cb);
          parent_node.widget.add_event("useraction", this._useraction_cb);
        }
      }
    })
  });
})(this.AWML || (this.AWML = {}));
