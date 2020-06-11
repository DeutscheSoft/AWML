/* eslint-disable */
const WebSocket = require('ws');

module.exports = function (w, AWML) {
  var ServerBackend = AWML.ServerBackend;

  function WebSocketServerBackend(ws, backend) {
    if (!ws || ws.readyState !== 1) throw new Error('WebSocket not open.');
    this.ws = ws;
    ServerBackend.call(this, backend);
    this.message_cb = function (data) {
      this.message(JSON.parse(data));
    }.bind(this);
    this.close_cb = function () {
      try {
        this.destroy();
      } catch (err) {
        console.error(err);
      }
    }.bind(this);
    ws.on('message', this.message_cb);
    ws.on('error', this.close_cb);
    ws.on('close', this.close_cb);
  }
  WebSocketServerBackend.prototype = Object.assign(
    Object.create(ServerBackend.prototype),
    {
      send: function (d) {
        var ws = this.ws;
        /* this check is necessary because a send may be dispatched */
        if (ws === null || ws.readyState !== 1) return;
        ws.send(JSON.stringify(d));
      },
      destroy: function () {
        var ws = this.ws;
        if (ws) {
          ws.removeListener('message', this.message_cb);
          ws.removeListener('error', this.close_cb);
          ws.removeListener('close', this.close_cb);
          if (ws.readyState <= 1) {
            ws.close();
          }
          this.ws = null;
        }
        ServerBackend.prototype.destroy.call(this);
      },
    }
  );

  var ClientBackend = AWML.ClientBackend;

  function teardown() {
    var ws = this.ws;
    if (ws) {
      this.ws = null;
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      try {
        ws.close();
      } catch (e) {}
    }
  }
  function websocket(url, clear, options) {
    this.url = url;
    this.options = options;
    ClientBackend.call(this);
    this.onopen = function () {
      if (clear) this.ws.send('false');
      this.open();
    }.bind(this);
    this.onclose = function () {
      this.close();
    }.bind(this);
    this.onerror = function (ev) {
      this.error(ev);
    }.bind(this);
    this.onmessage = function (ev) {
      this.message(JSON.parse(ev.data));
    }.bind(this);
    this.connect();
  }
  websocket.prototype = Object.assign(Object.create(ClientBackend.prototype), {
    send: function (o) {
      var ws = this.ws;
      if (ws === null || ws.readyState !== 1) return;
      ws.send(JSON.stringify(o));
    },
    connect: function () {
      try {
        var ws;
        ws = new WebSocket(this.url, 'json', this.options);
        ws.addEventListener('open', this.onopen);
        ws.addEventListener('close', this.onclose);
        ws.addEventListener('error', this.onerror);
        ws.addEventListener('message', this.onmessage);
        this.ws = ws;
      } catch (e) {
        this.error(e);
      }
    },
    destroy: function () {
      teardown.call(this);
      ClientBackend.prototype.destroy.call(this);
    },
    close: function () {
      teardown.call(this);
      ClientBackend.prototype.close.call(this);
    },
    error: function (reason) {
      teardown.call(this);
      ClientBackend.prototype.error.call(this, reason);
    },
  });

  AWML.WebSocketServerBackend = WebSocketServerBackend;
  AWML.Backends.websocket = websocket;
};
