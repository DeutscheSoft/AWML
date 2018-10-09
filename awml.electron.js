(function(w, AWML) {
  var ClientBackend = AWML.ClientBackend;

  if (typeof require === "undefined") return;

  var ipcRenderer = require('electron').ipcRenderer;

  if (ipcRenderer === void(0)) {
    AWML.warn("Using awml.electron.js without Electron.");
    return;
  }

  ipcRenderer.setMaxListeners(0);

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

  function Electron(options) {
    ClientBackend.call(this, options);

    var name = options.channel;

    this.name = name;
    this.channel = null;
    this.message_cb = onmessage.bind(this);
    this.connect_cb = onconnect.bind(this);

    ipcRenderer.on("awml-connect", this.connect_cb);
    ipcRenderer.send("awml-connect", [ "connect", name ]);
  };
  Electron.prototype = Object.assign(Object.create(ClientBackend.prototype), {
    destroy: function() {
        ipcRenderer.send("awml-connect", [ "disconnect", name ]);
        ipcRenderer.removeListener("awml-connect", this.connect_cb);
        ipcRenderer.removeListener(this.channel, this.message_cb);
        ClientBackend.prototype.destroy.call(this);
    },
    send: function(o) {
      ipcRenderer.send(this.channel, o);
    },
    arguments_from_node: function(node) {
      return Object.assign(
        ClientBackend.prototype.arguments_from_node(node),
        {
          channel: node.getAttribute("channel")||node.getAttribute("name"),
        }
      );
    },
  });
  AWML.Backends.electron = Electron;
  Electron.discover = function()
  {
    return new Promise(function(resolve, reject) {
      var timeout_id;
      var on_message = function(ev, msg)
      {
        if (msg[0] === 'discover')
        {
          clearTimeout(timeout_id);
          resolve(msg[1]);
        }
      };
      var fail = function()
      {
        ipcRenderer.removeListener('awml-connect', on_message);
        reject(new Error("timeout"));
      };
      ipcRenderer.on('awml-connect', on_message);
      timeout_id = setTimeout(fail, 1000);
      ipcRenderer.send("awml-connect", [ "discover" ]);
    });
  }
})(this, this.AWML);
