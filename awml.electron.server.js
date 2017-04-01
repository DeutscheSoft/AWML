const {ipcMain} = require('electron')
const AWML = require(".").AWML;

const ServerBackend = AWML.ServerBackend;
const channels = new Map();

function ElectronServerBackend(channel, backend, sender) {
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
    ipcMain.removeListener(this.channel, this.message_cb);
    channels.delete(this.channel);
  },
});

function export_backends(backends) {
  ipcMain.on("awml-connect", function(event, backend) {
    var backend = backends[backend];
    if (!backend) {
        event.returnValue = false;
        return;
    }
    var channel;
    do {
        channel = "channel-" + (Math.random() * 2 * channels.size).toString();
    } while (channels.has(channel));


    channels.set(channel, new ElectronServerBackend(channel, backend, event.sender));
    event.returnValue = channel;
  });
}

module.exports = {
    ElectronServerBackend : ElectronServerBackend,
    export_backends : export_backends,
};
