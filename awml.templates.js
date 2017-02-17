// vim:sw=2
(function(AWML) {
  "use strict";

  if (!AWML.Tags) AWML.Tags = {};

  var url_stack = [ window.location.href ];

  function push_url(url) {
    url_stack.push(url);
  }

  function pop_url() {
    url_stack.length--;
  }

  function get_url(path, base) {
    if (!base) base = url_stack[url_stack.length - 1];

    return new URL(path, base).href;
  }

  function fetch_template(path, base) {
    var url = get_url(path, base);

    return fetch(url).then(function(response) {
      if (!response.ok) throw new Error(response.statusText);
      return response.text().then(function(text) {
        var template = document.createElement("TEMPLATE");
        template.url = url;
        template.innerHTML = text;
        return template;
      });
    });
  }

  var cache = new Map();

  function fetch_template_cached(path, base) {
    var url = get_url(path, base);

    if (cache.has(url)) return Promise.resolve(cache.get(url));

    return fetch_template(path, base).then(function(template) {
      cache.set(url, template);
      return template;
    });
  }

  AWML.fetch_template = fetch_template;
  AWML.fetch_template_cached = fetch_template_cached;

  AWML.Tags.Clone = AWML.register_element("awml-clone", Object.assign({}, AWML.PrefixLogic, AWML.RedrawLogic, {
    is_awml_node: true,
    createdCallback: function() {
      this.awml_data = {
        handle: null,
        fetch: false,
        template: null,
        cached: false,
      };
      AWML.PrefixLogic.createdCallback.call(this);
      AWML.RedrawLogic.createdCallback.call(this);
    },
    attachedCallback: function() {
      var O = this.awml_data;
      AWML.PrefixLogic.attachedCallback.call(this);
      O.handle = this.getAttribute("template");
      O.fetch = this.getAttribute("fetch") !== null;
      O.cached = this.getAttribute("cached") !== null;
      this.reload();
    },
    receive: function(v) {
      var O = this.awml_data;
      var transform = O.transform_receive;
      if (transform) v = transform(v);
      O.handle = v;
      this.reload();
    },
    reload: function() {
      var O = this.awml_data;

      if (!O.fetch) {
        O.template = document.getElementById(O.handle);
        if (!O.template) {
            AWML.error("Unknown template: ", O.handle);
            return;
        }
        /* we are not fetching the template, simply reload it */
        this.trigger_redraw();
      } else {
        var fetch = O.cached ? fetch_template_cached : fetch_template;
        /* async template loading */
        fetch(O.handle).then(function(template) {
          this.awml_data.template = template;
          this.trigger_redraw();
        }.bind(this)).catch(function (e) {
          AWML.error("Could not load template", O.handle, ":", e);
        });
      }
    },
    redraw: function() {
      var O = this.awml_data;

      while (this.lastChild) {
        AWML.downgrade_element(this.lastChild);
        this.removeChild(this.lastChild);
      }

      var template = O.template;

      var node = this.parentNode;

      while (node) {
          if (node.tagName === this.tagName && node.awml_data.handle === O.handle) {
              AWML.error("Recursive template definition.");
              return;
          }
          node = node.parentNode;
      }

      var url = template.url || window.location.href;
      push_url(url);
      this.appendChild(node = document.importNode(template.content, true));
      AWML.upgrade_element(this);
      pop_url();
    },
    detachedCallback: function() {
      AWML.PrefixLogic.detachedCallback.call(this);
      while (this.lastChild) {
        AWML.downgrade_element(this.lastChild);
        this.removeChild(this.lastChild);
      }
    },
    attributeChangedCallback: function(name, old_value, value) {
      if (name === "template") {
          this.detachedCallback();
          this.attachedCallback();
      }
      if (name.startsWith("prefix")) {
        var handle = name.substr(7);
        AWML.update_prefix(this, handle);
      }
    },
  }));
})(this.AWML || (this.AWML = {}));
