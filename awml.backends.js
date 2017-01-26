// vim:sw=2
(function(AWML) {
  "use strict";
  if (!AWML.Backends) AWML.Backends = {};

  function subscribe_fail(uri, error) {
    var pending = this.pending_subscriptions.get(uri);

    this.pending_subscriptions.delete(uri);
    
    pending.forEach(function(a) {
      a[2](error);
    });

    this.fire('register_fail', [ uri, error ]);
  }

  function subscribe_success(uri, id) {
    var pending = this.pending_subscriptions.get(uri);
    var s;

    this.pending_subscriptions.delete(uri);

    this.uri2id.set(uri, id);

    if (id !== false) {
      this.subscriptions.set(id, s = new Set());
      this.id2uri.set(id, uri);
    } else {
      this.subscriptions.set(uri, s = new Set());
    }

    if (pending) pending.forEach(function(a) {
      s.add(a[0]);
      a[1]([uri, id]);
    });

    this.fire('register_success', [ uri, id ]);
  }

  function receive(id, value) {
    var values = this.values;
    var subscriptions = this.subscriptions.get(id);

    values.set(id, value);

    if (subscriptions)
      subscriptions.forEach(function(cb) {
        cb(id, value);
      });
  }

  function invalid_transition(from, to) {
    var error = AWML.error || (console && console.error);

    if (error) error('Cannot transition backend %o from %o to %o.', this, from, to);
  }

  function to_open() {
    var state = this.state;

    if (state !== 'init') {
      invalid_transition(state, 'open');
      return;
    }

    this.state = 'open';
    if (this.pending_subscriptions.size) {
      this.low_subscribe_batch(Array.from(this.pending_subscriptions.keys()));
    }
    this.fire('open');
  }

  function to_closed() {
    var state = this.state;

    if (state === 'closed' || state === 'error') {
      invalid_transition(state, 'closed');
    }

    this.state = 'closed';
    clear_all_subscriptions.call(this, 'closed');
    this.fire('close');
  }

  function to_error(error) {
    var state = this.state;

    if (state === 'error') return;

    this.state = 'error';
    clear_all_subscriptions.call(this, error);
    this.fire('error', error);
  }

  function to_state(state) {
    if (this.state === state) return;

    switch (state) {
    case 'open':
      to_open.call(this);
      break;
    case 'closed':
      to_closed.call(this);
      break;
    case 'error':
      to_error.call(this);
      break;
    default:
      throw new Error("No such state.");
    }
  }

  function clear_all_subscriptions(reason) {
    var subscriptions = this.subscriptions;
    var id2uri = this.id2uri;
    var uri2id = this.uri2id;
    var pending = this.pending_subscriptions;

    this.id2uri = new Map();
    this.uri2id = new Map();
    this.values = new Map();
    this.subscriptions = new Map();
    this.pending_subscriptions = new Map();
    
    subscriptions.forEach(function(cbs, id) {
        var uri = typeof(id) === "string" ? id : id2uri.get(id);
        cbs.forEach(function(cb) {
          cb(false, uri);
        });
    });
    pending.forEach(function(cbs, uri) {
        cbs.forEach(function(a) {
          a[2](reason);
        });
    });
  }

  function Base() {
    this.values = new Map();
    this.uri2id = new Map();
    this.id2uri = new Map();
    this.subscriptions = new Map();
    this.pending_subscriptions = new Map();
    this.state = 'init';

    this._subscribe_success = subscribe_success.bind(this);
    this._subscribe_fail = subscribe_fail.bind(this);
    this._receive = receive.bind(this);

    this._event_handlers = new Map();
  }
  Base.prototype = {
    subscribe_success: subscribe_success,
    subscribe_fail: subscribe_fail,
    close: to_closed,
    error: to_error,
    open: to_open,
    receive: receive,
    low_subscribe_batch: function(uris) {
      return Promise.all(uris.map(this.low_subscribe, this));
    },
    low_unsubscribe_batch: function(ids) {
      return Promise.all(ids.map(this.low_unsubscribe, this));
    },
    subscribe: function(uri, cb) {
      var uri2id = this.uri2id;
      var id2uri = this.id2uri;
      var subscriptions = this.subscriptions;
      var pending = this.pending_subscriptions;
      var values = this.values;

      var id, s;

      if (uri2id.has(uri)) {
        return new Promise(function(resolve, reject) {
          id = uri2id.get(uri);

          if (id !== false) {
            s = subscriptions.get(id);
            if (values.has(id)) self.setTimeout(cb.bind(0, id, values.get(id)), 0);
            if (!s) subscriptions.set(id, s = new Set());
          } else {
            s = subscriptions.get(uri);
            if (values.has(uri)) self.setTimeout(cb.bind(0, uri, values.get(uri)), 0);
            if (!s) subscriptions.set(uri, s = new Set());
          }

          s.add(cb);

          resolve([uri, id]);
        });
      } else if (pending.has(uri)) {
        return new Promise(function (resolve, reject) {
          pending.get(uri).add([ cb, resolve, reject ]);
        });
      } else {
        pending.set(uri, new Set());
        var p = new Promise(function (resolve, reject) {
          pending.get(uri).add([ cb, resolve, reject ]);
        });

        if (this.state === 'open')
          this.low_subscribe(uri);

        return p;
      }
    },
    unsubscribe: function(id, cb) {
      var uri2id = this.uri2id;
      var id2uri = this.id2uri;
      var subscriptions = this.subscriptions;
      var values = this.values;
      
      if (!id2uri.has(id)) throw new Error("No such subscription.");

      var uri = id2uri.get(id);

      var s = subscriptions.get(id);

      if (!s || !s.has(cb)) throw new Error("No such subscription.");
      
      s.delete(cb);

      if (s.size === 0) {
        subscriptions.delete(id);
        values.delete(id);
        id2uri.delete(id);
        uri2id.delete(uri);
        this.low_unsubscribe(id);
        this.fire("unregister", [ uri, id ]);
      }
    },
    addEventListener: function(event, cb) {
      var e = this._event_handlers;
      var s;
      if (!e.has(event)) e.set(event, s = new Set());
      else s = e.get(event);

      s.add(cb);
    },
    removeEventListener: function(event, cb) {
      var e = this._event_handlers;
      var s;
      if (!e.has(event)) return;
      else s = e.get(event);

      s.delete(cb);
    },
    dispatchEvent: function(ev) {
      var e = this._event_handlers;
      var type = ev.type;

      if (!e.has(type)) return;

      var s = e.get(type);
      var self = this;

      s.forEach(function(cb) {
        try {
          cb.call(self, ev);
        } catch (e) {
          if (console && console.error) console.error(e);
        }
      });
    },
    fire: function(type, data) {
      var e = this._event_handlers;

      if (!e.has(type)) return;

      this.dispatchEvent(new CustomEvent(type, { detail: data }));
    },
    arguments_from_node: function(node) {
        throw new Error("Backend needs implementation of arguments_from_node()");
    },
  };

  function Local() {
    Base.call(this);
    this.open();
  }
  Local.prototype = Object.assign(Object.create(Base.prototype), {
    low_subscribe: function(uri) {
      var id2uri = this.id2uri;
      var id;
      do {
        id = (Math.random()*id2uri.size*2)|0;
      } while (id2uri.has(id));

      subscribe_success.call(this, uri, id);
    },
    low_unsubscribe: function(id) { },
    set: receive,
    arguments_from_node: function(node) {
        return [];
    },
  });

  function Cache(backend) {
    this.backend = backend;
    Base.call(this);
  }
  Cache.prototype = Object.assign(Object.create(Base.prototype), {
    set: function(id, value) {
      this.backend.set(id, value);
    },
    low_subscribe: function(uri) {
      this.backend.subscribe(uri, this._receive).then(this._subscribe_success, this._subscribe_fail);
    },
    low_unsubscribe: function(id) {
      this.backend.unsubscribe(id, this_receive);
    },
  });

  function get_relative_wsurl() {
    var l = window.location;
    var r;

    if (l.protocol == "http:") {
      r = "ws://" + l.hostname;
      if (l.port != 80) r += ":" + l.port;
    } else if (l.protocol == "https:") {
      r = "wss://" + l.hostname;
      if (l.port != 443) r += ":" + l.port;
    }

    return r;
  }

  function websocket(url) {
    if (!url) {
      url = get_relative_wsurl();
    } else if (url[0] == "/"[0]) {
      /* relative url */
      url = get_relative_wsurl() + url;
    }
    this.url = url;
    Base.call(this);
    this.connect();
  }
  /* NOTE: due to a bug in the pike websocket implementation
   * we have to pad all outgoing frames so they are longer than
   * 125 bytes. */
  var padding = function() {
    var a = new Array(125), i;
    for (i = 0; i < 125; i++) a[i] = " ";
    return a.join("");
  }();
  function pad(s) {
    var d = 126 - s.length;

    if (d > 0) s += padding.substr(0, d);

    return s;
  }
  function teardown() {
      var ws = this.ws;
      if (ws) {
        this.ws = null;
        try { ws.close(); } catch(e) {}
        ws.onopen = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
      }
  }
  websocket.prototype = Object.assign(Object.create(Base.prototype), {
    message: function(ev) {
      var d = JSON.parse(ev.data);
      var uri, id, fun, i;

      if (typeof(d) === "object") {
        if (d instanceof Array) {
          fun = this.receive;
          for (i = 0; i < d.length; i+=2) {
            receive.call(this, d[i], d[i+1]);
          }
        } else {
          fun = subscribe_success;
          for (uri in d) {
            id = d[uri];
            fun.call(this, uri, id);
          }
        }
      } else AWML.warn('Unexpected message on WebSocket:', d);
    },
    connect: function() {
      this.ws = new WebSocket(this.url, 'json');
      this.ws.onopen = function() { this.open(); }.bind(this);
      this.ws.onclose = function() { this.close(); }.bind(this);
      this.ws.onerror = function(ev) { this.error(""); }.bind(this);
      this.ws.onmessage = this.message.bind(this);
    },
    close: function() {
      teardown.call(this);
      Base.prototype.close.call(this);
    },
    error: function(reason) {
      teardown.call(this);
      Base.prototype.close.call(this, reason);
    },
    low_subscribe: function(uri) {
      var d = {};
      d[uri] = 1;
      this.ws.send(pad(JSON.stringify(d)));
    },
    low_subscribe_batch: function(uris) {
      var d = {}, i;
      for (i = 0; i < uris.length; i++) {
        d[uris[i]] = 1;
      }
      this.ws.send(pad(JSON.stringify(d)));
    },
    low_unsubscribe: function(uri) {
      var d = {};
      d[uri] = 0;
      this.ws.send(pad(JSON.stringify(d)));
    },
    low_unsubscribe_batch: function(uris) {
      var d = {}, i;
      for (i = 0; i < uris.length; i++) {
        d[uris[i]] = 0;
      }
      this.ws.send(pad(JSON.stringify(d)));
    },
    set: function(id, value) {
      // the websocket backend will not respond
      receive.call(this, id, value);
      this.ws.send(pad(JSON.stringify([ id, value ])));
    },
    arguments_from_node: function(node) {
      return [ node.getAttribute("src") ];
    },
  });

  if (self.SharedWorker) {
    var url = document.currentScript.getAttribute("src");
    url = url.replace(/awml\.backends\.js/, "awml.backends.sharedworker.js");

    var Shared = function(type) {
      Base.call(this);
      var args = Array.prototype.slice.call(arguments, 1);
      this.worker = new SharedWorker(url, JSON.stringify([ type, args ]));
      this.worker.onerror = function(e) {
        AWML.error("Shared Worker generated an error:", e);
      };
      this.worker.port.addEventListener('message', function (ev) {
          var d = ev.data;

          if (typeof(d) === "object") {
            if (d instanceof Array) {
              var i;
              for (i = 0; i < d.length; i+=2) {
                receive.call(this, d[i], d[i+1]);
              }
              return;
            } else {
              var uri;
              for (uri in d) {
                subscribe_success.call(this, uri, d[uri]);
              }
              return;
            }
          }
        }.bind(this));
      this.worker.port.start();
      to_open.call(this);
    }
    Shared.prototype = Object.assign(Object.create(Base.prototype), {
      low_subscribe: function(uri) {
        var d = {};
        d[uri] = 1;
        this.worker.port.postMessage(d);
      },
      low_unsubscribe: function(uri) {
        var d = {};
        d[uri] = 0;
        this.worker.port.postMessage(d);
      },
      set: function(id, value) {
        this.worker.port.postMessage([ id, value ]);
      },
    });
    AWML.Backends.shared = Shared;
  }

  function LocalStorage() {
    Base.call(this);
    try {
      this.storage = window.localStorage;
    } catch (e) {
      AWML.error("Cannot use LocalStorage backend. Probably because this page is accessed through a file:// URL.");
    }
    this.encoded_values = new Map();
    window.addEventListener('storage', function(ev) {
      if (ev.storageArea !== this.storage) return;
      var key = ev.key;
      var old = ev.oldValue;
      var val = ev.newValue;
      if (this.uri2id.has(key)) {
        this.encoded_values.set(key, val);
        receive.call(this, key, JSON.parse(val));
      }
    }.bind(this));
    to_open.call(this);
  }
  LocalStorage.prototype = Object.assign(Object.create(Base.prototype), {
    low_subscribe: function(uri) {
      subscribe_success.call(this, uri, uri);
      var val = this.storage.getItem(uri);

      if (val !== null) {
        this.encoded_values.set(uri, val);
        receive.call(this, uri, JSON.parse(val));
      }
    },
    low_unsubscribe: function(id) {},
    set: function(id, value) {
      var enc = JSON.stringify(value);
      if (typeof(enc) === "string") {
        if (enc === this.encoded_values.get(id)) return;
        this.storage.setItem(id, enc);
        this.encoded_values.set(id, enc);
        receive.call(this, id, value);
      } else {
        AWML.warn('Cannot encode %o (key: %o)', value, id);
      }
    },
    arguments_from_node: function(node) {
        return [];
    },
  });

  Object.assign(AWML.Backends, {
    local: Local,
    base: Base,
    cache: Cache,
    websocket: websocket,
    localstorage: LocalStorage,
  });
})(this.AWML || (this.AWML = {}));
