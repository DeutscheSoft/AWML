(function(w, AWML) {
  var base = AWML.Backends.base;
  var proto = base.prototype;

  /* TODO: this backend is far from being optimized. */

  function get_members(o) {
    return o.GetMembers().then(function(res) {
      return res.map(o.device.resolve_object.bind(o.device));
    });
  }

  var property_event_data_signature = new SP.signature(OCA.OcaPropertyID, SP.REST);

  function PropertySync(backend, o, path) {
    this.o = o;
    this.backend = backend;
    this.path = path;
    this.subscribed = new Set();
    this._property_changed_cb = function(n) {
      var a = property_event_data_signature.decode(new DataView(n.parameters));
      var o = this.o.__oca_properties__;
      var property_id = a[0];
      var buf = a[1];
      var name = o.find_name(property_id);
      if (!this.subscribed.has(name)) return; /* ignore */
      var sig = o.find_signature(property_id);
      var id = this.resolve(name);
      this.backend.receive(id, sig.decode(new DataView(buf)));
    }.bind(this);
  }
  PropertySync.prototype = {
    resolve: function(name) {
      /* returns the ID. This is used for the subscription step. */
      var o = this.o;
      var properties = o.__oca_properties__.properties;
      var p = properties[name];

      if (!p) return void(0);

      var id = p.index | (p.level << 16);

      return o.ObjectNumber + ":" + id;
    },
    subscribe: function(name) {
      var o = this.o;
      var properties = o.__oca_properties__.properties;
      var p = properties[name];

      if (!p) throw new Error("No such property: "+name);

      var id = this.resolve(name);

      if (p.static) {
        backend.receive(id, this.o[name]);
        return;
      }

      if (!this.subscribed.size)
        this.o.onPropertyChanged(this._property_changed_cb);

      this.subscribed.add(name);

      this.o["Get"+name]()
        .then(function(val) { 
            this.backend.receive(id, val);
          }.bind(this));
    },
    unsubscribe: function(name) {
      this.subscribed.delete(name);

      if (!this.subscribed.size) {
        /* FIXME: unsubscribe event handler */
      }
    },
    set: function(name, value) {
      var o = this.o;
      var properties = o.__oca_properties__.properties;
      var p = properties[name];

      if (!p) throw new Error("No such property: "+name);

      if (p.static || p.readonly || !o["Set"+name])
            throw new Error("Trying to modify readonly property.");

      o["Set"+name](value);
    },
  };

  function resolve_object_tree(backend, o, path) {
    return new Promise(function(resolve, reject) {
      var n = 0;
      var rec = function(o, path) {
        if (o.GetMembers) { /* a block */
          var prefix = path;
          if (prefix.length) prefix += "/";
          n++;
          get_members(o)
            .then(function(children) {
              Promise.all(children.map(function(c) { return c.GetRole(); }))
                .then(function(roles) {
                  var tmp = {}, cnt = {};

                  /* make paths locally unique */
                  for (var i = 0; i < roles.length; i++) {
                    tmp[roles[i]] = 1 + (tmp[roles[i]]|0);
                  }

                  for (var i = 0; i < roles.length; i++) {
                    if (tmp[roles[i]] > 1) {
                      cnt[roles[i]] = 1;
                    }
                  }

                  for (var i = 0; i < roles.length; i++) {
                    var path_component = roles[i];
                    if (cnt[path_component]) {
                      path_component += cnt[path_component]++;
                    }
                    rec(children[i], prefix + path_component);
                  }
                  if (!--n) resolve();
                }, reject);
            }, reject);
        } else {
          backend.objects.set(path, new PropertySync(backend, o, path));
        }
      };
      rec(o, path);
    });
  }

  function oca(url) {
    this.device = null;
    this.url = url;
    this.objects = new Map();
    base.call(this);
    this.connect();
  }
  oca.prototype = Object.assign(Object.create(proto), {
    connect: function() {
      try {
        var ws;
        ws = new WebSocket(this.url);
        ws.onopen = function() { this.open(); }.bind(this);
        ws.onclose = function() { this.close(); }.bind(this);
        ws.onerror = function(ev) { this.error(ev); }.bind(this);
        this.ws = ws;
      } catch (e) {
        this.error(e);
      }
    },
    arguments_from_node: AWML.Backends.websocket.prototype.arguments_from_node,
    open: function() {
      this.device = new OCA.RemoteDevice(new OCA.WebSocketConnection(this.ws));
      resolve_object_tree(this, this.device.root, "")
        .then(function() {
          proto.open.call(this);
        }.bind(this),
        function(err) {
          this.error(err);
        }.bind(this));
    },
    low_subscribe: function(path) {
      var tmp = path.split("/");
      var object_path = tmp.slice(0, -1).join("/");
      var property_name = tmp[tmp.length-1];
      var p = this.objects.get(object_path);
      var id;

      if (!p || (id = p.resolve(property_name)) === void(0)) {
        this.subscribe_fail(path, "No such property.");
        return;
      }

      this.subscribe_success(path, id);
      p.subscribe(property_name);
    },
    set: function(id, value) {
      var path = this.id2uri.get(id);
      var tmp = path.split("/");
      var object_path = tmp.slice(0, -1).join("/");
      var property_name = tmp[tmp.length-1];
      var p = this.objects.get(object_path);

      p.set(property_name, value);
    },
  });

  AWML.Backends.oca = oca;
 })(this, this.AWML);
