const { ipcMain } = require('electron');
const AWML = require('.').AWML;

const ServerBackend = AWML.ServerBackend;
const channels = new Map();

ipcMain.setMaxListeners(0);

function ElectronServerBackend(name, channel, backend, sender) {
  this.name = name;
  this.channel = channel;
  this.sender = sender;

  ServerBackend.call(this, backend);

  this.message_cb = function (event, d) {
    this.message(d);
  }.bind(this);

  ipcMain.on(this.channel, this.message_cb);
}
ElectronServerBackend.prototype = Object.assign(
  Object.create(ServerBackend.prototype),
  {
    send: function (d) {
      this.sender.send(this.channel, d);
    },
    destroy: function () {
      console.log(
        'electron backend destroy',
        this.channel,
        channels.get(this.channel) == this
      );
      channels.delete(this.channel);
      ipcMain.removeAllListeners(this.channel);
      ServerBackend.prototype.destroy.call(this);
      this.sender.send('awml-connect', ['disconnected', this.channel]);
      console.log('electron backend destroyed.');
    },
  }
);

function export_backends(backends) {
  function get_backends() {
    if (typeof backends === 'function') {
      return backends();
    } else if (backends instanceof Map) {
      const ret = [];
      backends.forEach(function (b, name) {
        ret.push(name);
      });
      return ret;
    } else {
      return Object.keys(backends);
    }
  }

  function get_backend(name) {
    if (typeof backends === 'function') {
      return backends(name);
    } else if (backends instanceof Map) {
      return backends.get(name);
    } else {
      return backends[name];
    }
  }

  ipcMain.on('awml-connect', function (event, msg) {
    var cmd = msg[0];

    if (cmd === 'connect') {
      var name = msg[1];
      var backend = get_backend(name);

      if (!backend) {
        event.sender.send('awml-connect', ['error', 'No such backend.']);
        return;
      }
      var channel;
      do {
        channel = 'channel-' + (Math.random() * 2 * channels.size).toFixed(0);
      } while (channels.has(channel));

      channels.set(
        channel,
        new ElectronServerBackend(name, channel, backend, event.sender)
      );
      event.sender.send('awml-connect', ['connected', msg[1], channel]);
    } else if (cmd === 'discover') {
      event.sender.send('awml-connect', ['discover', get_backends()]);
    } else if (cmd === 'ping') {
      event.sender.send('awml-connect', ['pong']);
    } else if (cmd === 'disconnect') {
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
  ElectronServerBackend: ElectronServerBackend,
  export_backends: export_backends,
  all_channels: channels,
};
