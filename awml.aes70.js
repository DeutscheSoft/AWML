var f = (function(w, AWML) {
  var base = AWML.Backends.base;
  var proto = base.prototype;

  /* TODO: this backend is far from being optimized. */

  function get_members(o) {
    return o.GetMembers().then(function(res) {
      return res.map(o.device.resolve_object.bind(o.device));
    });
  }

  var OCA = w.OCA;
  var SP = OCA.SP;

  function PropertySync(backend, o, path) {
    this.o = o;
    this.backend = backend;
    this.path = path;
  }
  PropertySync.prototype = {
    resolve: function(name) {
      /* returns the ID. This is used for the subscription step. */
      var o = this.o;
      var p = o.__oca_properties__.find_property(name);

      if (!p) return void(0);

      var id = p.index | (p.level << 16);

      return o.ObjectNumber + ":" + id;
    },
    full_path: function(name) {
      return this.path + "/" + name;
    },
    subscribe: function(name) {
      var o = this.o;
      var p = o.__oca_properties__.find_property(name);

      if (!p) throw new Error("No such property: "+name);

      var id = this.resolve(name);

      if (p.static) {
        backend.receive(id, this.o[name]);
        return;
      }

      var getter = p.getter(o);

      if (!getter) {
        throw new Error("Property is missing getter.");
      }

      var ret = getter.call(o)
        .then(function(val) { 
            var path = this.full_path(name);
            this.backend.subscribe_success(path, id);

            if (val instanceof SP.Arguments) {
              // Assume that [1] is Min and [2] is Max

              var tmp = val.item(1);
              if (tmp !== void(0)) {
                this.backend.subscribe_success(path + "/Min", false);
                this.backend.receive(path + "/Min", tmp);
              }

              tmp = val.item(2);
              if (tmp !== void(0)) {
                this.backend.subscribe_success(path + "/Max", false);
                this.backend.receive(path + "/Max", tmp);
              }

              this.backend.receive(id, val.item(0));
            } else {
              this.backend.receive(id, val);
            }
          }.bind(this));

      var event = p.event(o);

      if (event)
      {
        event.subscribe((value, type, id) => {
          // TODO: check that type is value changed
          var id = this.resolve(name);
          this.backend.receive(id, value);
        });
      }

      return ret;
    },
    unsubscribe: function(name) {
      this.subscribed.delete(name);

      if (!this.subscribed.size) {
        /* FIXME: unsubscribe event handler */
      }
    },
    set: function(name, value) {
      var o = this.o;
      var p = o.__oca_properties__.find_property(name);

      if (!p) throw new Error("No such property: "+name);

      var setter = p.setter(o);

      if (p.static || p.readonly || !setter)
            throw new Error("Trying to modify readonly property.");

      setter(value);
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

  function aes70(options) {
    base.call(this, options);

    this.objects = new Map();

    if (options.url)
    {
      this.device = null;
      this.url = options.url;
      this.connect();
    }
    else if (options.device)
    {
      this.url = null;
      this.device = options.device;
      this.open();
    }
  }
  aes70.prototype = Object.assign(Object.create(proto), {
    connect: function() {
      try {
        var ws;
        ws = new WebSocket(this.url);
        ws.onopen = function() {
          this.device = new OCA.RemoteDevice(new OCA.WebSocketConnection(this.ws));
          this.open();
        }.bind(this);
        ws.onclose = function() { ws.onerror = null; this.close(); }.bind(this);
        ws.onerror = function(ev) { ws.onclose = null; this.error(ev); }.bind(this);
        this.ws = ws;
      } catch (e) {
        this.error(e);
      }
    },
    arguments_from_node: AWML.Backends.websocket.prototype.arguments_from_node,
    open: function() {
      resolve_object_tree(this, this.device.Root, "")
        .then(function() {
          proto.open.call(this);
        }.bind(this),
        function(err) {
          this.error(err);
        }.bind(this));
      var m = OCA.Types.OcaManagerDefaultObjectNumbers;
      for (var name in m) {
        var ono = m[name];
        resolve_object_tree(this, new OCA.RemoteControlClasses["Oca"+name](ono, this.device), name);
      }
    },
    low_subscribe: function(path) {
      var meta;

      if (path.endsWith("/Min")) {
        meta = "Min";
      } else if (path.endsWith("/Max")) {
        meta = "Max";
      }

      var tmp = path.split("/");
      var object_path;
      var property_name;

      if (meta) {
        object_path = tmp.slice(0, -2).join("/");
        property_name = tmp[tmp.length-2];
      } else {
        object_path = tmp.slice(0, -1).join("/");
        property_name = tmp[tmp.length-1];
      }

      var p = this.objects.get(object_path);
      var id;

      if (!p || (id = p.resolve(property_name)) === void(0)) {
        this.subscribe_fail(path, "No such property.");
        return;
      }

      try {
        p.subscribe(property_name)
          .catch(function(e) {
            this.subscribe_fail(path, e.toString());
          }.bind(this));
      } catch (e) {
        this.subscribe_fail(path, e.toString());
      }
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

  AWML.Backends.aes70 = aes70;
 });
if (typeof module !== "undefined" && !this.AWML) module.exports = f;
else f(this, this.AWML || (this.AWML = {}));
