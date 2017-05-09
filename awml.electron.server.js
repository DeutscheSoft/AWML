const {ipcMain} = require('electron')
const AWML = require(".").AWML;

const ServerBackend = AWML.ServerBackend;
const channels = new Map();

function ElectronServerBackend(name, channel, backend, sender) {
  this.name = name;
  this.channel = channel;
  this.sender = sender;

  ServerBackend.call(this, backend);

  this.message_cb = function(event, d) {
    this.message(d);
  }.bind(this);

  ipcMain.on(this.channel, this.message_cb);
}
ElectronServerBackend.prototype = Object.assign(Object.create(ServerBackend.prototype), {
  send: function(d) {
    this.sender.send(this.channel, d);
  },
  destroy: function() {
    this.sender.send("awml-connect", [ "disconnected", this.channel ]);
    ipcMain.removeListener(this.channel, this.message_cb);
    channels.delete(this.channel);
  },
});

function export_backends(backends) {
  ipcMain.on("awml-connect", function(event, msg) {
    var cmd = msg[0];
    
    if (cmd === "connect") {
        var name = msg[1];
        var backend;

        if (typeof backends === "function") {
          backend = backends(name);
        } else {
          backend = backends[name];
        }

        if (!backend) {
            event.sender.send(["error", "No such backend."]);
            return;
        }
        var channel;
        do {
            channel = "channel-" + (Math.random() * 2 * channels.size).toFixed(0);
        } while (channels.has(channel));

        channels.set(channel, new ElectronServerBackend(name, channel, backend, event.sender));
        event.sender.send("awml-connect", [ "connected", msg[1], channel ]);
    } else if (cmd === "ping") {
        event.sender.send("awml-connect", [ "pong" ]);
    } else if (cmd === "disconnect") {
        var channel = msg[1];

        var backend = channels.get(channel);

        if (backend) {
            backend.destroy();
            channels.delete(channel);
        }
    }
  });
}

module.exports = {
    ElectronServerBackend : ElectronServerBackend,
    export_backends : export_backends,
    all_channels : channels,
};
