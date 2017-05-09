(function(w, AWML) {
  var ClientBackend = AWML.ClientBackend;

  if (typeof require === "undefined") return;

  var ipcRenderer = require('electron').ipcRenderer;

  if (ipcRenderer === void(0)) {
    AWML.warn("Using awml.electron.js without Electron.");
    return;
  }

  function onmessage(ev, o) {
    this.message(o);
  }

  function onconnect(ev, msg) {
    var cmd = msg[0];

    if (cmd === "connected" && msg[1] === this.name) {
      this.channel = msg[2];
      ipcRenderer.on(this.channel, this.message_cb);
      this.open();
    } else if (cmd === "error") {
      this.error(msg[1]);
    } else if (cmd === "disconnected" && msg[1] === this.channel) {
      ipcRenderer.removeListener("awml-connect", this.connect_cb);
      ipcRenderer.removeListener(this.channel, this.message_cb);
      this.close();
    }
  }

  function Electron(name) {
    ClientBackend.call(this);

    this.name = name;
    this.channel = null;
    this.message_cb = onmessage.bind(this);
    this.connect_cb = onconnect.bind(this);

    ipcRenderer.on("awml-connect", this.connect_cb);
    ipcRenderer.send("awml-connect", [ "connect", name ]);
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
