// vim:sw=2
var f = (function(w, AWML) {
  if (!AWML.Backends) AWML.Backends = {};

  if (!('CustomEvent' in w)) {
    w.CustomEvent = function(type, o) {
      this.type = type;
      this.detail = o ? o.detail : null;
    };
  }

  var q = [];
  var dispatched = false;

  function dispatch_loop() {
    dispatched = false;
    for (var i = 0; i < q.length; i++) {
      try {
        q[i]();
      } catch (e) {
        console.log("Error in dispatched callback:", e);
      }
    }
    q.length = 0;
  }

  var trigger_dispatch;

  function dispatch(cb) {
    q.push(cb);
    if (dispatched) return;
    dispatched = true;
    trigger_dispatch();
  }

  if ("addEventListener" in w && "postMessage" in w) {
    trigger_dispatch = function() {
      w.postMessage(true, "*");
    };
    w.addEventListener("message", function(ev) {
      if (ev.source !== w) return;
      dispatch_loop();
    });
  } else if (typeof setImmediate !== "undefined") {
    trigger_dispatch = function() {
      setImmediate(dispatch_loop);
    };
  } else {
    trigger_dispatch = function() {
      setTimeout(dispatch_loop, 0);
    };
  }

  function subscribe_fail(uri, error) {
    var pending = this.pending_subscriptions.get(uri);

    this.pending_subscriptions.delete(uri);
    
    pending.forEach(function(a) {
      a[2]([ uri, error ]);
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
      var ret;
      if (this.values.has(id)) {
        ret = [uri, id, this.values.get(id) ];
      } else {
        ret = [uri, id];
      }
      pending.forEach(function(a) {
        a[1](ret);
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
    var values = this.values;

    if (values.has(id) && values.get(id) === value) return;

    values.set(id, value);

    var cbs = this.subscriptions.get(id);

    if (cbs) call_subscribers(cbs, id, value);
  }

  var error = AWML.error || (console && console.error);

  function invalid_transition(from, to) {

    error('Cannot transition backend %o from %o to %o.', this, from, to);
  }

  function to_open() {
    var state = this.state;

    if (state !== 'init') {
      invalid_transition.call(this, state, 'open');
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
      invalid_transition.call(this, state, 'closed');
    }

    this.state = 'closed';
    clear_all_subscriptions.call(this, 'closed');
    this.fire('close');
    this.destroy();
  }

  function to_error(err) {
    var state = this.state;

    if (state === 'error' || state === 'closed') return;

    this.state = 'error';

    clear_all_subscriptions.call(this, err);

    if (this.hasEventListener('error')) {
      this.fire('error', err);
    } else {
      error("Backend error", err);
    }
    this.destroy();
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

  function Base(options) {
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

    this.transform_path = options.transform_path || null;
  }
  Base.prototype = {
    subscribe_success: subscribe_success,
    subscribe_fail: subscribe_fail,
    close: to_closed,
    error: to_error,
    open: to_open,
    is_open: function() { return this.state === "open"; },
    receive: receive,
    low_subscribe_batch: function(uris) {
      return Promise.all(uris.map(this.low_subscribe, this));
    },
    clear: function() {
      this.values = new Map();
    },
    low_unsubscribe_batch: function(ids) {
      return Promise.all(ids.map(this.low_unsubscribe, this));
    },
    subscribe: function(uri, cb) {
      var uri2id = this.uri2id;
      var subscriptions = this.subscriptions;
      var values = this.values;

      if (this.transform_path !== null)
        uri = this.transform_path(uri);

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

          var has_value = values.has(key);

          if (has_value) {
            var val = values.get(key);
            resolve([uri, key, val ]);
          } else {
            resolve([uri, key ]);
          }
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
        this.low_unsubscribe(id);
        subscriptions.delete(id);
        values.delete(id);
        id2uri.delete(id);
        uri2id.delete(uri);
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
    hasEventListener: function(event) {
      var e = this._event_handlers;
      var s;
      return e.has(event);
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
          error(e);
        }
      }, this);
    },
    is_destructed: function() {
      return this.id2uri === null;
    },
    destroy: function() {
      this.id2uri = null;
      this.uri2id = null;
      this.values = null;
      this.subscriptions = null;
      this.pending_subscriptions = null;
      this.fire("destroy");
      this._event_handler = {};
    },
    fire: function(type, data) {
      var e = this._event_handlers;

      if (!e.has(type)) return;

      this.dispatchEvent(new w.CustomEvent(type, { detail: data }));
    },
    arguments_from_node: function(node) {
      var tmp = node.getAttribute("transform-path");
      return {
        transform_path: tmp ? AWML.parse_format("js", tmp, null) : null,
      };
    },
  };

  function Local(options) {
    this.name = options.name;
    this.delay = options.delay;
    Base.call(this, options);
    this.open();

    var values = options.values;

    for (var uri in values) {
      this.receive(uri, values[uri]);
    }

    var src = options.src;

    if (src) {
      AWML.fetch_json(src)
        .then(
          function(values) {
            for (var uri in values) {
              this.receive(uri, values[uri]);
            }
          }.bind(this),
          function(e) {
            error("Failed to load values from %o: %o", src, e);
          }
        );
    }
  }
  Local.prototype = Object.assign(Object.create(Base.prototype), {
    low_subscribe: function(uri) {
      subscribe_success.call(this, uri, uri);
    },
    low_unsubscribe: function(id) { },
    set: function(id, value) {
      var delay = this.delay;
      if (delay > 0) {
        setTimeout(function() {
          this.receive(id, value);
        }.bind(this), delay);
      } else {
        this.receive(id, value);
      }
    },
    arguments_from_node: function(node) {
        return Object.assign(
          Base.prototype.arguments_from_node(node),
          {
            name: node.getAttribute("name"),
            values: AWML.parse_format("json", node.textContent, {}),
            src: node.getAttribute("src"),
            delay: parseInt(node.getAttribute("delay")),
          }
        );
    },
  });

  function Test(name, values, src) {
    Local.call(this, name, values, src);
    setInterval(function() {
      this.uri2id.forEach(function(id, uri) {
        if (uri.search("random") !== -1) {
          this.receive(id, Math.random()); 
        }
      }, this);
    }.bind(this), 500);
  }
  Test.prototype = Object.assign(Object.create(Local.prototype), {
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
    var l = w.location;
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

  function ClientBackend(options) {
    Base.call(this, options);
    this.changeset = [];
    this.pending = null;
    this.send_changes = function() {
      if (this.state != "open") return;
      var m = this.pending;
      if (m) this.send(m);
      this.pending = null;
      var a = this.changeset;
      if (a.length) {
        this.send(a);
        a.length = 0;
      }
    }.bind(this);
  }
  ClientBackend.prototype = Object.assign(Object.create(Base.prototype), {
    message: function(d) {
      var uri, id, i, tmp;

      if (typeof(d) === "object") {
        if (d instanceof Array) {
          for (i = 0; i < d.length; i+=2) {
            this.receive(d[i], d[i+1]);
          }
        } else {
          for (uri in d) {
            tmp = d[uri];
            if (tmp) {
              if (Array.isArray(tmp)) {
                id = tmp[0];
                this.values.set(tmp[0], tmp[1]);
              } else {
                id = tmp;
              }
              subscribe_success.call(this, uri, id);
            }
            else subscribe_fail.call(this, uri, tmp);
          }
        }
      } else AWML.warn('Unexpected message on WebSocket:', d);
    },
    low_subscribe: function(uri) {
      if (this.changeset.length === 0 && this.pending === null) dispatch(this.send_changes);
      var d = this.pending;
      if (d === null) this.pending = d = {};
      d[uri] = 1;
    },
    low_subscribe_batch: function(uris) {
      var d = {}, i;
      for (i = 0; i < uris.length; i++) {
        d[uris[i]] = 1;
      }
      this.send(d);
    },
    low_unsubscribe: function(uri) {
      if (this.changeset.length === 0 && this.pending === null) dispatch(this.send_changes);
      var d = this.pending;
      if (d === null) this.pending = d = {};
      d[uri] = 0;
    },
    low_unsubscribe_batch: function(uris) {
      var d = {}, i;
      for (i = 0; i < uris.length; i++) {
        d[uris[i]] = 0;
      }
      this.send(d);
    },
    set: function(id, value) {
      if (this.changeset.length === 0 && this.pending === null) dispatch(this.send_changes);
      this.changeset.push(id, value);
    },
    clear: function() {
      this.send(false);
    },
  });

  /* WebSocket backend implementation */

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
        ws.onopen = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        try { ws.close(); } catch(e) {}
      }
  }
  function websocket(options) {
    this.url = options.url;
    ClientBackend.call(this, options);
    this.connect(options.clear);
  }
  websocket.prototype = Object.assign(Object.create(ClientBackend.prototype), {
    send: function(o) {
      this.ws.send(pad(JSON.stringify(o)));
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
        ws.onerror = function(ev) { this.error(ev); }.bind(this);
        ws.onmessage = function(ev) {
          this.message(JSON.parse(ev.data));
        }.bind(this);
        this.ws = ws;
      } catch (e) {
        this.error(e);
      }
    },
    destroy: function() {
      teardown.call(this);
      ClientBackend.prototype.destroy.call(this);
    },
    close: function() {
      teardown.call(this);
      ClientBackend.prototype.close.call(this);
    },
    error: function(reason) {
      teardown.call(this);
      ClientBackend.prototype.error.call(this, reason);
    },
    arguments_from_node: function(node) {
      var src = node.getAttribute("src");
      if (!src) {
        src = get_relative_wsurl();
      } else if (src[0] == "/"[0]) {
        /* relative url */
        src = get_relative_wsurl() + src;
      }

      return Object.assign(
        ClientBackend.prototype.arguments_from_node(node),
        {
          url: src,
          clear: node.getAttribute("clear") !== null,
        }
      );
    },
  });

  if ('SharedWorker' in w) {
    var url = document.currentScript.getAttribute("src");
    url = url.replace(/awml\.backends\.js/, "awml.backends.sharedworker.js");

    var Shared = function(type) {
      ClientBackend.call(this);
      var args = Array.prototype.slice.call(arguments, 1);
      this.worker = new SharedWorker(url, JSON.stringify([ type, args ]));
      this.worker.onerror = function(e) {
        error("Shared Worker generated an error:", e);
      };
      this.worker.port.addEventListener('message', function (ev) {
          this.message(ev.data);
        }.bind(this));
      this.worker.port.start();
      to_open.call(this);
    }
    Shared.prototype = Object.assign(Object.create(ClientBackend.prototype), {
      send: function(d) {
        this.worker.port.postMessage(d);
      },
    });
    AWML.Backends.shared = Shared;
  }

  function LocalStorage(options) {
    var clear = options.clear;
    Base.call(this, options);
    try {
      this.storage = w.localStorage;
      if (clear) this.storage.clear();
    } catch (e) {
      error("Cannot use LocalStorage backend. Probably because this page is accessed through a file:// URL.");
    }
    this.encoded_values = new Map();
    w.addEventListener('storage', function(ev) {
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
      return Object.assign(
        Base.prototype.arguments_from_node(node),
        {
          clear: node.getAttribute("clear") !== null,
        }
      );
    },
  });

  function ServerBackend(backend) {
    this.backend = backend;
    this.changeset = [];
    this.pending = null;
    this.send_changes = function() {
      var m = this.pending;
      if (m) this.send(m);
      this.pending = null;
      var a = this.changeset;
      if (a.length) {
        this.send(a);
        a.length = 0;
      }
    }.bind(this);

    this._change_cb = function(id, value) {
      if (this.changeset.length === 0 && this.pending === null) dispatch(this.send_changes);
      this.changeset.push(id, value);
    }.bind(this);
    this.subscriptions = new Set();
  }
  ServerBackend.prototype = {
    destroy: function() {
      this.subscriptions.forEach(function(id) {
        this.backend.unsubscribe(id, this._change_cb);
      }, this);
    },
    message: function(d) {
      var backend = this.backend;
      if (Array.isArray(d)) {
        if (d.length & 1) throw new Error("Bad message from client.\n");
        for (var i = 0; i < d.length; i+=2) backend.set(d[i], d[i+1]);
      } else if (d === false) {
        backend.clear(); 
      } else {
        for (var uri in d) {
          if (d[uri]) {
            backend.subscribe(uri, this._change_cb)
              .then(
                function(a) {
                  if (this.changeset.length === 0 && this.pending === null) dispatch(this.send_changes);
                  var d = this.pending;
                  if (d === null) this.pending = d = {};
                  if (a.length === 3) {
                    d[a[0]] = [ a[1], a[2] ];
                  } else {
                    d[a[0]] = a[1];
                  }
                  this.subscriptions.add(a[1]);
                }.bind(this),
                function(a) {
                  if (this.changeset.length === 0 && this.pending === null) dispatch(this.send_changes);
                  var d = this.pending;
                  if (d === null) this.pending = d = {};
                  d[a[0]] = 0;
                }.bind(this));
          } else {
            /* unsubscribe happens per id */
            var id = parseInt(uri);
            backend.unsubscribe(id, this._change_cb);
            this.subscriptions.delete(id);
          }
        }
      }
    }
  };

  AWML.ServerBackend = ServerBackend;
  AWML.ClientBackend = ClientBackend;
  AWML.BaseBackend = Base;
  AWML.dispatch = dispatch;

  Object.assign(AWML.Backends, {
    local: Local,
    base: Base,
    test: Test,
    cache: Cache,
    websocket: websocket,
    localstorage: LocalStorage,
  });
});
if (typeof module !== "undefined" && !this.AWML) module.exports = f;
else f(this, this.AWML || (this.AWML = {}));
