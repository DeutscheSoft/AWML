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

  function get_base() {
    return url_stack[ url_stack.length - 1];
  }

  function get_url(path, base) {
    if (!base) base = url_stack[url_stack.length - 1];

    return new URL(path, base).href;
  }

  function fetch_template(path, base) {
    var url = get_url(path, base);

    return AWML.register_loading(AWML.fetch_text(url).then(function(text) {
      var template = document.createElement("TEMPLATE");
      template.url = url;
      template.innerHTML = text;
      return template;
    }));
  }

  var cache = new Map();

  function fetch_template_cached(path, base) {
    var url = get_url(path, base);

    if (cache.has(url)) return cache.get(url);

    var p = fetch_template(path, base);

    cache.set(url, p);

    return p;
  }

  function get_template(O) {
    var p;

    if (O.notemplate)
    {
      p = Promise.resolve(O.template);
    }
    else if (O.fetch)
    {
      p = (O.cached ? fetch_template_cached : fetch_template)(O.handle, O.base_url);
    }
    else
    {
      var el = document.getElementById(O.handle);
      p = el ? Promise.resolve(el) : Promise.reject(new Error('Could not find TEMPLATE element.'));
    }

    return p;
  }

  function find_tag(list, e) {
    var s;
    var to = e.outerHTML;
    for (var i = 0; i < list.length; i++) {
      if (list[i].outerHTML === to) {
        e.remove();
        return list[i];
      }
    }
    return e;
  }

  function onload() {
    window.dispatchEvent(new Event("resize"));
  }

  function deduplicate_to_head(node, selector, O) {
      var elems = node.querySelectorAll(selector);
      var helems = document.head.querySelectorAll(selector);
      var e;
      for (var i = 0; i < elems.length; i++) {
        e = find_tag(helems, elems[i]);
        if (e.parentNode !== document.head)
          document.head.appendChild(e);
        if (e.tagName === 'link')
          e.addEventListener('load', onload);
      }

      return elems;
  }

  function transform_template(node, O) {
    if (O.transform_template)
      node = O.transform_template(node);

    return node;
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
        base_url: get_base(),
        num_permanent: this.children.length,
        generation: 0,
        transform_template: null,
      };
      AWML.PrefixLogic.createdCallback.call(this);
      AWML.RedrawLogic.createdCallback.call(this);
    },
    attachedCallback: function() {
      var O = this.awml_data;
      O.handle = this.getAttribute("template");
      O.notemplate = this.getAttribute("notemplate") !== null;

      if (O.notemplate)
      {
        O.template = document.createElement("template");
        O.template.url = get_base();
      }

      AWML.PrefixLogic.attachedCallback.call(this);
      this.reload();
    },
    receive: function(v) {
      var O = this.awml_data;
      var transform = O.transform_receive;
      if (transform) v = transform(v);
      if (O.handle === v && O.transform_template === null) return;
      O.handle = v;
      this.reload();
    },
    reload: function() {
      var O = this.awml_data;

      O.fetch = this.getAttribute("fetch") !== null;
      O.cached = this.getAttribute("nocache") === null;

      var transform = this.getAttribute("transform-template");
      if (transform)
        transform = AWML.parse_format("js", transform);
      O.transform_template = transform;

      if (!O.handle) return;

      var generation = ++O.generation;

      get_template(O).then(
        function(template) {
          var O = this.awml_data;
          // the template has been updated again
          if (O.generation !== generation) return;
          O.template = template;
          if (O.attached) this.redraw();
        }.bind(this),
        function(e) {
          AWML.error("Could not load template", O.handle, ":", e);
        }
      );
    },
    redraw: function() {
      AWML.RedrawLogic.redraw.call(this);
      var O = this.awml_data;

      while (this.children.length > O.num_permanent) {
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
      node = document.importNode(template.content, true);
      if (O.cached) {
        deduplicate_to_head(node, "link[rel=stylesheet]", O);
      }
      deduplicate_to_head(node, "template", O).forEach(function(template) {
        template.url = url;
      });

      this.appendChild(transform_template(node, O));
      AWML.upgrade_element(this);
      pop_url();
      if (this.getAttribute("trigger-resize") !== null)
        onload();
    },
    detachedCallback: function() {
      AWML.PrefixLogic.detachedCallback.call(this);
      while (this.lastChild) {
        AWML.downgrade_element(this.lastChild);
        this.removeChild(this.lastChild);
      }
    },
    attributeChangedCallback: function(name, old_value, value) {
      if (name.startsWith("prefix")) {
        var handle = name.substr(7);
        AWML.update_prefix(this, handle);
      } else if (old_value !== value) {
        this.detachedCallback();
        this.attachedCallback();
      }
    },
  }));
})(this.AWML || (this.AWML = {}));
