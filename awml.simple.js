// vim:sw=2
"use strict";
(function(AWML) {
 // this is a super simple binding, nothing to write home about.
 function Simple(proto) {
    this.proto = proto;
    this.bindings = {};
    AWML.register_protocol_handler(proto, this);
 }

 Simple.prototype = {};
 Simple.prototype.set = function(uri, value) {
    this.update(uri, value);
 };
 Simple.prototype.update = function(uri, value) {
    var bind = this.bindings[uri];
    if (bind) bind.update(value);
 };
 Simple.prototype.register = function(binding) {
   this.bindings[binding.uri] = binding;
 };
 Simple.prototype.unregister = function(binding) {
   delete this.bindings[binding.uri];
 };
 AWML.SimpleHandler = Simple;
})(this.AWML || (this.AWML = {}));
