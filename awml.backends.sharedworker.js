if (self.importScripts)
(function(self) {
"use strict";
var ports = new Map();
importScripts('awml.backends.js');

var a = JSON.parse(self.name);

var constructor = AWML.Backends[a[0]];
var args = a[1];

var backend = new (constructor.bind.apply(constructor, [null].concat(args)));

function receive(id, value) {
  this.postMessage([id, value]);
}

self.onconnect = function(e) {
    var port = e.ports[0];

    port.onmessage = function(e) {
        var data = e.data;

        if (data === 1) {
            // ping
            port.postMessage(1);
            return;
        }

        if (data === 0) {
            // disconnect
            ports.delete(port);
            return;
        }

        if (data instanceof Array) {
            for (let i = 0; i < data.length; i+=2) {
                let id = data[i];
                let value = data[i+1];

                // check if it is gone
                backend.set(id, value);
            }
        } else if (typeof data === "object") {
            let uri;
            let cb = ports.get(port);

            // TODO: use batch subscribe
            for (uri in data) {
              // TODO: handle reject
              backend.subscribe(uri, cb)
                .then(function(a) {
                        var d = {};
                        d[a[0]] = a[1];
                        port.postMessage(d);
                      })
            }
        }
    };
    ports.set(port, receive.bind(port));
};
})(self);
