var f = (function(w, AWML) {
  var base = AWML.Backends.base;
  var proto = base.prototype;

  /* TODO: this backend is far from being optimized. */
  function timeout(p, time)
  {
    return new Promise(function(resolve, reject) {
      const id = setTimeout(function() { reject(new Error("timeout")); }, time);
      p.then(
        function(result) {
          clearTimeout(id);
          resolve(result);
        },
        function(err) {
          clearTimeout(id);
          reject(err);
        });
    });
  }

  function get_members(o) {
    return timeout(o.GetMembers(), 5000).catch(function(){ return []; }).then(function(res) {
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

      var ret = [];

      ret.push(getter.call(o)
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
          }.bind(this)));

      var event = p.event(o);

      if (event)
      {
        ret.push(event.subscribe((value, type, id) => {
          // TODO: check that type is value changed
          var id = this.resolve(name);
          this.backend.receive(id, value);
        }));
      }

      return Promise.all(ret);
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

  function map_all_objects()
  {
    const roles = new Map();

    const get_all_roles = function(tree)
    {
      var ret = [];

      for (var i = 0 ; i < tree.length; i++)
      {
        var o = tree[i];
        if (Array.isArray(o))
        {
          ret.push(get_all_roles(o));
        }
        else
        {
          ret.push(timeout(o.GetRole(), 10000)
              .catch(function() { return null; }.bind(this, o))
              .then(function(o, role) { roles.set(o, role); }.bind(this, o)));
        }
      }

      return Promise.all(ret);
    }

    return this.device.GetDeviceTree()
      .then(function(tree) {
        return get_all_roles(tree)
          .then(
            function() {
              const rec = function(tree, path) {
                const local_roles = new Map();
                const children = new Map();

                const prefix = (path.length) ? (path + "/") : path;

                for (var i = 0; i < tree.length; i++)
                {
                  if (!Array.isArray(tree[i]))
                  {
                    let role = roles.get(tree[i]);

                    if (role === null)
                    {
                      role = tree[i].ono.toString();
                      //console.log("ignoring object", tree[i].ono);
                      //continue;
                    }

                    if (local_roles.has(role))
                    {
                      let cnt = 1;

                      while (local_roles.has(role + cnt)) cnt++;

                      role += cnt;
                    }

                    local_roles.set(role, tree[i]);
                  }
                  else
                  {
                    children.set(tree[i-1], tree[i]);
                  }
                }

                local_roles.forEach(
                  function(o, role) {
                    const path = prefix + role;
                    this.objects.set(path, new PropertySync(this, o, path));
                    if (children.has(o))
                      rec(children.get(o), path);
                  }.bind(this)
                );
              }.bind(this);
              rec(tree, "");
              this.objects.forEach((o, role) => o.o.get_properties().forEach((p) => console.log(role, p.name)));
            }.bind(this)
          );
      }.bind(this));
  }

  function aes70(options) {
    base.call(this, options);

    this.close_cb = function() {
      this.close();
    }.bind(this);
    this.error_cb = function(e) {
      this.error(e);
    }.bind(this);

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
        ws.onclose = this.close_cb;
        ws.onerror = this.error_cb;
        this.ws = ws;
      } catch (e) {
        this.error(e);
      }
    },
    arguments_from_node: AWML.Backends.websocket.prototype.arguments_from_node,
    destroy: function() {
      proto.destroy.call(this);
      if (this.device)
      {
        this.device.removeEventListener('close', this.close_cb);
      }
    },
    open: function() {
      this.device.on('close', this.close_cb);
      var m = OCA.Types.OcaManagerDefaultObjectNumbers;
      for (var name in m) {
        var ono = m[name];
        var o = new OCA.RemoteControlClasses["Oca"+name](ono, this.device);
        this.objects.set(name, new PropertySync(this, o, name));
      }
      map_all_objects.call(this)
        .then(function() {
          proto.open.call(this);
        }.bind(this),
        function(err) {
          console.error(err);
          this.error(err);
        }.bind(this));
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
        console.error(e);
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
