// vim:sw=2
(function(AWML) {
  "use strict";

  if (!AWML.Tags) AWML.Tags = {};

  AWML.Tags.Clone = AWML.register_element("awml-clone", {
    createdCallback: function() {
    },
    attachedCallback: function() {
      var template_name = this.getAttribute("template");
      var template = document.getElementById(template_name);

      if (!template) {
          AWML.error("Unknown template: ", this.getAttribute("template"));
      }

      var node = this.parentNode;

      do {
          if (node.tagName === this.tagName &&
              node.getAttribute('template') === template_name) {
              AWML.error("Recursive template definition.");
              return;
          }
      } while (node = node.parentNode);

      this.appendChild(document.importNode(template.content, true));

      var val;

      for (var i = 0; i < this.attributes.length; i++) {
          var attr = this.attributes[i].name;
          var val = this.attributes[i].value;
          if (!attr.startsWith("prefix") || val.search(':') == -1) continue;

          var handle = attr === "prefix" ? "" : attr.substr(7);
          AWML.set_prefix(this, "", handle);
      }
    },
    detachedCallback: function() {
      TK.empty(this);
    },
    attributeChangedCallback: function(name, old_value, value) {
      if (name === "template") {
          this.detachedCallback();
          this.attachedCallback();
      }
      /* TODO: implement prefix changes */
    },
  });
})(this.AWML || (this.AWML = {}));
