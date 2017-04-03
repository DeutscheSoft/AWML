(function(w, AWML) {
  var ClientBackend = AWML.ClientBackend;

  if (typeof require === "undefined") return;

  var ipcRenderer = require('electron').ipcRenderer;

  if (ipcRenderer === void(0)) {
    AWML.warn("Using awml.electron.js without Electron.");
    return;
  }

  function Electron(channel) {
    ClientBackend.call(this);
    var handshake_cb = function(ev, channel) {
        if (!channel) {
            this.error();
            return;
        }
        this.channel = channel;
        ipcRenderer.on(channel, function(ev, o) {
          this.message(o);
        }.bind(this));
        this.open();
        ipcRenderer.removeEventListener(handshake_cb);
    }.bind(this);
    ipcRenderer.on("awml-connect", handshake_cb);
    ipcRenderer.send("awml-connect", channel);
  };
  Electron.prototype = Object.assign(Object.create(ClientBackend.prototype), {
    send: function(o) {
      ipcRenderer.send(this.channel, o);
    },
    arguments_from_node: function(node) {
      return [ node.getAttribute("channel")||node.getAttribute("name") ];
    },
  });
  AWML.Backends.electron = Electron;
})(this, this.AWML);
