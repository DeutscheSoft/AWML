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
    this.uri2id.set(uri, id);

    var key;

    if (id !== false) {
      key = id;
      this.id2uri.set(id, uri);
    } else {
      key = uri;
    }

    var pending = this.pending_subscriptions.get(uri);

    if (pending) {
      var s = new Set();
      this.pending_subscriptions.delete(uri);
      this.subscriptions.set(key, s);
      pending.forEach(function(a) {
        a[1]([uri, id]);
        s.add(a[0]);
      }, this);
    }

    this.fire('register_success', [ uri, id ]);
  }

  function call_subscriber(cb, id, value) {
    if (typeof(cb) === "function") {
      cb(id, value);
    } else cb.update(id, value);
  }

  function call_subscribers(cbs, id, value) {
    cbs.forEach(function(cb) {
      call_subscriber(cb, id, value);
    });
  }

  function receive(id, value) {
    this.values.set(id, value);

    var cbs = this.subscriptions.get(id);

    if (cbs) call_subscribers(cbs, id, value);
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
    AWML.error("Backend error", error);
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
    var pending = this.pending_subscriptions;
    var id2uri = this.id2uri;

    this.id2uri = new Map();
    this.uri2id = new Map();
    this.values = new Map();
    this.subscriptions = new Map();
    this.pending_subscriptions = new Map();
    
    subscriptions.forEach(function(cbs, id) {
        var uri = typeof(id) === "string" ? id : id2uri.get(id);

        call_subscribers(cbs, false, uri);
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
      var subscriptions = this.subscriptions;
      var values = this.values;

      if (uri2id.has(uri)) {
        return new Promise(function(resolve, reject) {
          var key;
          var id = uri2id.get(uri);

          if (id !== false) {
            key = id;
          } else {
            key = uri;
          }

          var s = subscriptions.get(key);

          if (!s) subscriptions.set(key, s = new Set());

          s.add(cb);

          /* NOTE: this is needed because we should not call the subscriber
           * before the promise resolve callback has been executed
           *
           * FIXME: replace this by something better
           */
          if (values.has(key)) window.setTimeout(call_subscriber.bind(this, cb, key, values.get(key)), 0);

          resolve([uri, id]);
        });
      } else {
        var pending = this.pending_subscriptions;
        var s = pending.get(uri);
        var do_subscribe = !s;
        if (do_subscribe) {
          s = new Set();
          pending.set(uri, s);
        }
        var p = new Promise(function (resolve, reject) {
          s.add([ cb, resolve, reject ]);
        });

        if (do_subscribe && this.state === 'open')
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

      if (!s.has(cb)) throw new Error("No such subscription.");

      s.delete(cb);

      if (!s.size) {
        subscriptions.delete(id);
        values.delete(id);
        id2uri.delete(id);
        uri2id.delete(uri);
        this.low_unsubscribe(id);
        this.fire("unregister", [ uri, id ]);
      } else subscriptions.set(id, s);
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

      s.forEach(function(cb) {
        try {
          cb.call(this, ev);
        } catch (e) {
          if (console && console.error) console.error(e);
        }
      }, this);
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

  function Local(name, values) {
    this.name = name;
    Base.call(this);
    this.open();

    for (var uri in values) {
      AWML.get_binding(this.name + ":" + uri).set(values[uri]);
    }
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
        return [ node.getAttribute("name"), AWML.parse_format("json", node.textContent, {}) ];
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

  function websocket(url, clear) {
    if (!url) {
      url = get_relative_wsurl();
    } else if (url[0] == "/"[0]) {
      /* relative url */
      url = get_relative_wsurl() + url;
    }
    this.url = url;
    Base.call(this);
    if (url) this.connect(clear);
    else AWML.error("Missing URL in websocket backend. Cannot connect.");
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
    connect: function(clear) {
      try {
        var ws;
        ws = new WebSocket(this.url, 'json');
        ws.onopen = function() {
          if (clear) this.ws.send(pad("false"));
          this.open();
        }.bind(this);
        ws.onclose = function() { this.close(); }.bind(this);
        ws.onerror = function(ev) { this.error(""); }.bind(this);
        ws.onmessage = this.message.bind(this);
        this.ws = ws;
      } catch (e) {
        this.error(e);
      }
    },
    close: function() {
      teardown.call(this);
      Base.prototype.close.call(this);
    },
    error: function(reason) {
      teardown.call(this);
      Base.prototype.error.call(this, reason);
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
      return [ node.getAttribute("src"), node.getAttribute("clear") !== null ];
    },
  });

  if ('SharedWorker' in window) {
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

  function LocalStorage(clear) {
    Base.call(this);
    try {
      this.storage = window.localStorage;
      if (clear) this.storage.clear();
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
        return [ node.getAttribute("clear") !== null ];
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
