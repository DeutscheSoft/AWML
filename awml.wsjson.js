// vim:sw=2
"use strict";
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
 function Simple(proto, url) {
    this.proto = proto;
    this.url = url;
    this.bindings = {};
    this.path2id = new Map();
    this.id2path = new Map();
    this.modifications = new Map();
    connect.call(this);
 }
 Simple.prototype = {};
 Simple.prototype.set = function(uri, value) {
    if (this.path2id.has(uri)) {
      var id = this.path2id.get(uri);
      this.ws.send(JSON.stringify([ id, value ]));
      this.update(uri, value);
    }
 };
 Simple.prototype.update = function(uri, value) {
    var bind = this.bindings[uri] || AWML.get_binding(uri);
    if (bind) bind.update(value);
 };
 Simple.prototype.register = function(binding) {
   var uri = binding.uri;
   this.bindings[uri] = binding;

   if (!this.path2id.has(uri)) {
     var d = {};
     d[uri] = 1;
     this.ws.send(JSON.stringify(d));
   }
 };
 Simple.prototype.unregister = function(binding) {
   delete this.bindings[binding.uri];
 };
 Simple.prototype.close = function() {
   this.ws.close();
 };
 AWML.WebSocketJSON = Simple;
})(this.AWML || (this.AWML = {}));
