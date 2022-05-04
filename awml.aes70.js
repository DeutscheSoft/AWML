var f = (function(w, AWML) {
  var base = AWML.Backends.base;
  var proto = base.prototype;

  if (typeof OCA === 'undefined') {
    console.warn('Cannot find AES70.js library. Missing a script include?');
  }

  function runCleanupHandler(cleanup) {
    try {
      cleanup();
    } catch (error) {
      AWML.warn('Cleanup handler threw an exception:', error);
    }
  }

  function splitAtLast(path, seperator) {
    const pos = path.lastIndexOf(seperator);

    return pos === -1
      ? [seperator, path]
      : [path.substr(0, pos + 1), path.substr(pos + 1)];
  }

  function combineCleanupHandlers(...cbs) {
    cbs = cbs.filter((cb) => !!cb);

    if (!cbs.length)
      return null;

    if (cbs.length === 1)
      return cbs[0];

    return () => {
      if (cbs === null) return;
      cbs.forEach(runCleanupHandler);
      cbs = null;
    };
  }

  const toplevelObjects = [
    'DeviceManager',
    'SecurityManager',
    'FirmwareManager',
    'SubscriptionManager',
    'PowerManager',
    'NetworkManager',
    'MediaClockManager',
    'LibraryManager',
    'AudioProcessingManager',
    'DeviceTimeManager',
    'TaskManager',
    'CodingManager',
    'DiagnosticManager',
    'Root',
  ];

  function unCurry(callback) {
    return (id, value) => {
      // if we get unsubscribed, we simply abort
      if (id === false) return;
      return callback(value);
    };
  }

  function isBlock(o) {
    return typeof o === 'object' && typeof o.GetMembers === 'function';
  }

  function aes70(options) {
    base.call(this, options);
    this.options = options;
    this.ws = null;

    this.close_cb = function() {
      this.close();
    }.bind(this);
    this.error_cb = function(e) {
      this.error(e);
    }.bind(this);

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
    this._path_subscriptions = new Map();
    this._setters = new Map();
    this._seperator = '/';
  }
  aes70.prototype = Object.assign(Object.create(proto), {
    connect: function() {
      try {
        var ws = new WebSocket(this.url);
        ws.addEventListener('open', function() {
          var options = { };

          if (this.options.batch)
            options.batch = this.options.batch;

          this.device = new OCA.RemoteDevice(new OCA.WebSocketConnection(this.ws, options));
          this.device.set_keepalive_interval(1);
          this.open();
        }.bind(this));
        ws.addEventListener('close', this.close_cb);
        ws.addEventListener('error', this.error_cb);
        this.ws = ws;
      } catch (e) {
        this.error(e);
      }
    },
    arguments_from_node: function (node) {
      var options = {};

      var batch = node.getAttribute('batch');

      if (batch !== null)
        options.batch = parseInt(batch);

      return Object.assign(
        AWML.Backends.websocket.prototype.arguments_from_node(node),
        options
      );
    },
    destroy: function() {
      proto.destroy.call(this);
      this.device = null;
      if (this.ws)
      {
        this.ws.removeEventListener('close', this.close_cb);
        this.ws.removeEventListener('error', this.error_cb);
        try { this.ws.close(); } catch(e) {}
        this.ws = null;
      }
    },
    low_unsubscribe: function(id) {
      const m = this._path_subscriptions;
      if (m.has(id)) {
        const sub = m.get(id);
        m.delete(id);
        runCleanupHandler(sub);
      }
      this._values.delete(id);
    },
    low_subscribe: function(path) {
      try {
        const cleanup = this.doSubscribe(path);
        if (cleanup) this._path_subscriptions.set(path, cleanup);
        this.subscribe_success(path, path);
      } catch (error) {
        this.subscribe_fail(path, error);
      }
    },
    set: function(id, value) {
      const setter = this._setters.get(id);

      if (!setter) {
        AWML.warn('%o is a readonly property.', id);
        return;
      }

      setter(value);
    },
    // returns CleanupLogic
    observe: function(path, callback) {
      if (typeof callback !== 'function')
        throw new TypeError('Expected function.');

      callback = unCurry(callback);

      let id = null;

      this.subscribe(path, callback).then(
        (a) => {
          if (id === false) {
            this.unsubscribe(a[1], callback);
            return;
          } else {
            id = a[1];
          }

          if (a.length === 3) {
            callback(id, a[2]);
          }
        },
        (err) => {
          AWML.warn('Subscription failed:', err);
        }
      );

      return () => {
        if (id !== null) {
          this.unsubscribe(id, callback);
        } else {
          // subscribe is still pending
          id = false;
        }
      };
    },
    _subscribeMembersAndRoles: function(block, callback, onError) {
      if (!isBlock(block)) throw new TypeError('Expected OcaBlock.');
      if (typeof callback !== 'function') throw new TypeError('Expected function.');
      if (!onError) onError = (err) => {
        AWML.log('Error while fetching block members:', err);
      };

      // ono -> OcaRoot
      const members = new Map();
      // OcaRoot -> string
      const roles = new Map();

      // Array<OcaRoot>
      let last_members;

      const device = block.device;

      const publish = () => {
        // unsubscribed
        if (callback === null) return;

        const roleNames = new Array(last_members.length);

        for (let i = 0; i < last_members.length; i++)
        {
          const o = last_members[i];

          // this may happen if we get a new member list before we manage to fetch
          // all roles. In that case, we simply abort here and wait for things to
          // complete.
          if (!roles.has(o)) return;
          roleNames[i] = roles.get(o);
        }

        callback(last_members, roleNames);
      };

      const onMembers = (a) => {
        // unsubscribed
        if (callback === null) return;

        const tasks = [];

        const tmp = a.map((member) => {
          const objectNumber = member.ONo;

          // we already know this member
          if (members.has(objectNumber)) {
            return members.get(objectNumber);
          } else {
            const o = device.resolve_object(member);
            members.set(objectNumber, o);
            const p = o.GetRole().then(
              (rolename) => {
                // the members may have changed since then, simply
                // ignore this result.
                if (members.get(objectNumber) === o) {
                  roles.set(o, rolename);
                }
              },
              onError
            );
            tasks.push(p);
            return o;
          }
        });

        last_members = tmp;

        // remove all object which have disappeared.
        const objectNumbers = new Set(a.map(member => member.ONo));
        const deleted = Array.from(members.keys()).filter(ono => !objectNumbers.has(ono));

        deleted.forEach((ono) => {
          const o = members.get(ono);

          members.delete(ono);
          roles.delete(o);
        });

        if (!tasks.length) {
          // we are done
          publish();
        } else {
          Promise.all(tasks).then(publish);
        }
      };

      block.OnMembersChanged.subscribe(onMembers);
      block.GetMembers().then(onMembers, onError);

      return () => {
        // unsubscribe
        if (callback === null) return;
        block.OnMembersChanged.unsubscribe(onMembers);
        callback = null;
      };
    },
    _observeDirectory: function(o, callback) {
      //console.log('observeDirectory', o);
      if (isBlock(o)) {
        let membersCallback = (members, roles) => {
          if (callback === null) return;

          const rolemap = new Map();


          for (let i = 0; i < members.length; i++)
          {
            const role = roles[i];
            let key = role;

            if (rolemap.has(key)) {
              let n = 1;
              do {
                key = role + n++;
              } while (rolemap.has(key));
            }
            rolemap.set(key, members[i]);
          }

          callback([ o, rolemap ]);
        };

        let cleanup = this._subscribeMembersAndRoles(o, membersCallback);

        return () => {
          if (cleanup) {
            runCleanupHandler(cleanup);
            cleanup = null;
          }
          // cleanup may help
          callback = null;
          o = null;
        };
      } else {
        // not a block, so we only care about properties
        callback([o]);
      }
    },
    _observePropertyWithGetter: function(o, property, path, index, callback) {
      let active = true;

      if (property.static) {
        if (index === 0) {
          callback(true, o[property.name]);
        } else {
          AWML.warn(
            'Static property %o in %o has no Min/Max.',
            property.name,
            o.ClassName
          );
        }
        return;
      }

      const getter = property.getter(o);

      if (!getter) {
        AWML.warn(
          'Could not subscribe to private property %o in %o',
          propertyName,
          properties
        );
        return;
      }

      const event = property.event(o);
      const setter = index === 0 ? property.setter(o) : null;
      let eventHandler = null;

      if (event) {
        eventHandler = (value, changeType) => {
          switch (index) {
            case 0: // current
              if (changeType.value !== 1) return;
              break;
            case 1: // min
              if (changeType.value !== 2) return;
              break;
            case 2: // max
              if (changeType.value !== 3) return;
              break;
            default:
              return;
          }
          callback(true, value);
        };
        event.subscribe(eventHandler).catch((err) => {
          AWML.warn('Failed to subscribe to %o: %o.\n', property.name, err);
        });
      }

      if (setter) this._setters.set(path, setter);

      getter().then(
        (x) => {
          if (!active) return;
          if (typeof x === 'object' && typeof x.item === 'function' && index < x.length) {
            callback(true, x.item(index));
          } else if (!index) {
            callback(true, x);
          } else {
            AWML.warn('%o in %o has neither Min nor Max.', property.name, o.ClassName);
          }
        },
        (error) => {
          callback(false, null);
          if (!active) return;
          // NotImplemented
          if (error.status.value == 8) {
            AWML.warn('Fetching %o failed: not implemented.', property.name);
          } else {
            AWML.warn('Fetching %o produced an error: %o', property.name, error);
          }
        }
      );

      return () => {
        if (!active) return;
        if (event) event.unsubscribe(eventHandler);
        if (setter) this._setters.delete(path);
        active = false;
      };
    },
    _observeProperty: function(a, propertyName, path, callback) {
      //console.log('_observeProperty(%o, %o, %o)', a, propertyName, path);
      const o = a[0];
      let noError = false;

      if (isBlock(o) && a[1] instanceof Map) {
        const rolemap = a[1];

        if (rolemap && rolemap.has(propertyName)) {
          callback(true, rolemap.get(propertyName));
          return;
        }

        // try property lookup
        a = [o];

        // No need to warn here.
        noError = true;
      }

      // actual property lookup
      if (a.length === 1) {
        const properties = o.get_properties();
        const property = properties.find_property(propertyName);

        if (!property) {
          if (!noError)
            AWML.log('Could not find property %o in %o.', propertyName, properties);
          callback(false, null);
          return;
        }

        return this._observePropertyWithGetter(o, property, path, 0, callback);
      } else if (a.length === 2) {
        // meta info
        const o = a[0];
        const property = a[1];

        // It might be that this property does not exist.
        // That is not necessarily a permanent error.
        if (!property) return;

        if (propertyName === 'Min' || propertyName === 'Max') {
          const index = propertyName === 'Min' ? 1 : 2;
          return this._observePropertyWithGetter(
            o,
            property,
            path,
            index,
            callback
          );
        }
      } else {
        callback(false, null);
      }
    },
    _observeEach: function(path, callback) {
      let lastValue = null;
      let cleanup = null;

      const cb = (o) => {
        if (lastValue === o) return;
        if (cleanup) runCleanupHandler(cleanup);

        cleanup = callback(o);
      };

      let sub = this.observe(path, cb);

      return () => {
        if (cleanup) runCleanupHandler(cleanup);
        if (sub) runCleanupHandler(sub);
        sub = null;
        lastValue = null;
        cleanup = null;
      };
    },
    // Promise<CleanupLogic>
    doSubscribe: function(path) {
      //console.log('doSubscribe(%o)', path);
      const seperator = this._seperator;
      const dir = path.endsWith(seperator);
      const [parentPath, propertyName] = splitAtLast(
        dir ? path.substr(0, path.length - 1) : path,
        seperator
      );

      // we are at the top level
      if (parentPath === '/') {
        if (propertyName == '') {
          return combineCleanupHandlers(
            this._observeDirectory(this.device.Root, (a) => {
              this.receive(path, a);
            }),
            () => {
              this.clearValue(path);
            });
        } else if (toplevelObjects.indexOf(propertyName) !== -1) {
          const o = this.device[propertyName];

          if (!dir) {
            // just pass the object
            this.receive(path, o);
            return () => {
              this.clearValue(path);
            };
          } else {
            // we got a slash, we subscribe object, rolemap/properties
            //console.log('trying to subscribe top level %o', path);
            return combineCleanupHandlers(
              this._observeDirectory(o, (a) => {
                this.receive(path, a);
              }),
              () => {
                this.clearValue(path);
              });
          }
        }
      }

      let callback;

      if (dir) {
        //console.log('trying to subscribe directory %o in %o', propertyName, parentPath);
        callback = (a) => {
          if (a === AWML.DELETED) {
            this.clearValue(path);
            return;
          }

          //console.log('%o / %o -> %o', parentPath, propertyName, a);
          const o = a[0];
          let noError = false;

          if (isBlock(o) && a[1] instanceof Map) {
            const rolemap = a[1];

            if (rolemap.has(propertyName)) {
              return combineCleanupHandlers(
                this._observeDirectory(
                  rolemap.get(propertyName),
                  (value) => {
                    this.receive(path, value);
                  }
                ),
                () => {
                  this.clearValue(path);
                });
            }

            noError = true;
          }

          // check the properties, this is for meta-info lookup
          const property = o.get_properties().find_property(propertyName);

          if (!property && !noError) {
            AWML.log('Could not find property %o in %o', propertyName, o);
            this.clearValue(path);
          } else if (!isBlock(o)) {
            this.receive(path, [o, property]);
            return () => {
              this.clearValue(path);
            };
          }
        };
      } else {
        //console.log('trying to subscribe property %o in %o', propertyName, parentPath);
        callback = (a) => {
          if (a === AWML.DELETED) {
            this.clearValue(path);
            return;
          }

          return combineCleanupHandlers(
            this._observeProperty(a, propertyName, path, (ok, value) => {
              //console.log('%o -> %o', path, value);
              if (ok) {
                this.receive(path, value);
              } else {
                this.clearValue(path);
              }
            }),
            () => {
              this.clearValue(path);
            }
          );
        };
      }

      // get a directory query for the parent object
      return this._observeEach(
        parentPath === seperator ? 'Root' + seperator : parentPath,
        callback
      );
    }
  });

  AWML.Backends.aes70 = aes70;
 });
if (typeof module !== "undefined" && !this.AWML) module.exports = f;
else f(this, this.AWML || (this.AWML = {}));
