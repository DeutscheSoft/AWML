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
    var uri;

    for (uri in d) {
        this.update(uri, d[uri]);
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
    connect.call(this);
 }
 Simple.prototype = {};
 Simple.prototype.set = function(uri, value) {
     var d = {};
     d[uri] = value;
     this.ws.send(JSON.stringify(d));
     this.update(uri, value);
 };
 Simple.prototype.update = function(uri, value) {
    var bind = this.bindings[uri] || AWML.get_binding(uri);
    if (bind) bind.update(value);
 };
 Simple.prototype.register_bindings = function(bind) {
    this.bindings = bind || {};
 };
 Simple.prototype.unregister_bindings = function() {
    this.bindings = {};
 };
 Simple.prototype.close = function() {
   this.ws.close();
 };
 AWML.WebSocketJSON = Simple;
})(this.AWML || (this.AWML = {}));
