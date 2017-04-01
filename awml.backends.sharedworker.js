if (self.importScripts)
(function(self) {
"use strict";
var ports = new Map();
importScripts('awml.backends.js');

var a = JSON.parse(self.name);

var constructor = AWML.Backends[a[0]];
var args = a[1];

var backend = new (constructor.bind.apply(constructor, [null].concat(args)));

var ServerBackend = AWML.ServerBackend;

function SharedWorkerServerBackend(port, backend) {
  this.port = port;
  ServerBackend.call(this, backend);

  port.onmessage = function(e) {
      this.message(e.data);
  }.bind(this);
}
SharedWorkerServerBackend.prototype = Object.assign(Object.create(ServerBackend.prototype), {
  send: function(d) {
    this.port.postMessage(d);
  },
});

self.onconnect = function(e) {
    var port = e.ports[0];

    ports.set(port, new SharedWorkerServerBackend(port, backend));
};
})(self);
