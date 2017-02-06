// vim:sw=2
(function(AWML) {
  "use strict";

  if (!AWML.Tags) AWML.Tags = {};

  AWML.Tags.Clone = AWML.register_element("awml-clone", Object.assign({}, AWML.PrefixLogic, AWML.RedrawLogic, {
    is_awml_node: true,
    createdCallback: function() {
      var O = {};
      this.awml_data = O;
      AWML.PrefixLogic.createdCallback.call(this);
      AWML.RedrawLogic.createdCallback.call(this);
      O.template_name = null;
    },
    attachedCallback: function() {
      var O = this.awml_data;
      AWML.PrefixLogic.attachedCallback.call(this);
      var template_name = this.getAttribute("template");
      if (!template_name) return;
      O.template_name = template_name;
      this.trigger_redraw();
    },
    receive: function(v) {
      var O = this.awml_data;
      var transform = O.transform_receive;
      if (transform) v = transform(v);
      O.template_name = v;
      this.trigger_redraw();
    },
    redraw: function() {
      var O = this.awml_data;

      while (this.lastChild) {
        AWML.downgrade_element(this.lastChild);
        this.removeChild(this.lastChild);
      }

      var template_name = O.template_name;

      if (!template_name || !template_name.length) return;

      var template = document.getElementById(template_name);

      if (!template) {
          AWML.error("Unknown template: ", this.getAttribute("template"));
      }

      var node = this.parentNode;

      while (node) {
          if (node.tagName === this.tagName &&
              node.getAttribute('template') === template_name) {
              AWML.error("Recursive template definition.");
              return;
          }
          node = node.parentNode;
      }

      this.appendChild(node = document.importNode(template.content, true));

      AWML.upgrade_element(this);
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
