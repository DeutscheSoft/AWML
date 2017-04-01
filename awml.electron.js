(function(w, AWML) {
  var ClientBackend = AWML.ClientBackend;
  const {ipcRenderer} = require('electron');

  if (ipcRenderer === void(0)) {
    AWML.warn("Using awml.electron.js without Electron.");
    return;
  }

  function Electron(channel) {
    ClientBackend.call(this);
    this.channel = channel = ipcRenderer.sendSync("awml-connect", channel);
    if (!channel) {
        this.error();
        return;
    }
    ipcRenderer.on(channel, function(ev, o) {
      this.message(o);
    }.bind(this));
    this.open();
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
