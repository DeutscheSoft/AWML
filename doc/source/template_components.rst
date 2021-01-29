Template Components were added in version 2.1.0.

.. _template-components:

Template Components
-------------------

Template components are web components based on HTML templates. They use a
template syntax similar to that of Angular. Expressions used inside of the
template string are mapped onto properties of the corresponding component. ::

    const template = `<div title={{ this.title }}>Hello {{ this.name }}</div>`;
    
    class MyComponent extends TemplateComponent.fromString(template) {
      constructor() {
        super();
        this.title = '';
        this.name = '';
      }
    }

    customElements.define('my-component', MyComponent);

Using the above example template will result in a web component which defines
two properties ``title`` and ``name``. Setting them will automatically update the
DOM in the next rendering frame.
Inside of strings template expressions can be used inside of Node textContent,
attributes and using special syntax as properties, style properties and DOM
event handlers.

Properties referenced in template expressions can be bound to using
``awml-option`` tag with option ``type=bind``. As an example for the above component
this can be done using ::

    <my-component>
      <awml-option type=bind sync name=title src='.../Title'></awml-option>
      <awml-option type=bind sync name=name src='.../Name'></awml-option>
    </my-component>

Attributes
^^^^^^^^^^

Template expressions can be used to control attribute values. ::

    const template1 = `<div title={{ this.title }}></div>`;
    const template2 = `<div title="Title: {{ this.title }}"></div>`;

Container Contents
^^^^^^^^^^^^^^^^^^

Templates expressions can be used to control node content which allows either
strings or arbitrary DOM nodes to be placed into the DOM. ::

    const template = `<div>{{ this.content }}</div>`;

How the content is placed into the DOM depdends on the data type of the data.

- Values of type ``'string'``, ``'number'`` or ``'boolean'`` are rendered into the DOM
  as strings inside of a TextNode.
- The values ``null`` and ``undefined`` result in no content, instead a
  CommentNode is placed into the DOM as a placeholder.
- Values of type ``Node`` are placed directly into the DOM. Naturally, using the
  same Node as content for two different template expressions does not work.
  Template Components do not guard against this usage and it will result in
  subtle issues.

Properties
^^^^^^^^^^

Template expressions can be used to control node properties with a special
syntax using square brackets. ::

    const template1 = `<input type=text [value]={{ this.value }} />`;

Style properties
^^^^^^^^^^^^^^^^

Template expressions can be used to control style properties using a special
syntax using square brackets. ::

    const template1 = `<div [style.color]={{ this.color }}></div>`;

Event handlers
^^^^^^^^^^^^^^

Template expressions can be used to attach event handlers to DOM nodes. ::

    const template = `<button (click)={{ this.onClick }}>click me</button>`;
    class MyComponent extends TemplateComponent.fromString(template) {
      constructor() {
        super();
        this.onClick = (ev) => {
          // handle click event.
        };
      }
    }

    customElements.define('my-component', MyComponent);

Node References
^^^^^^^^^^^^^^^

DOM nodes inside of templates can be assigned names which make them available as
properties on the resulting web components. ::

    const template = `<div #hello>Hello</div>`;

This can be useful to access specific DOM nodes inside of the resulting
component. It can also be useful when trying to create bindings to child
components. ::

    const template = `<aux-fader #gain></aux-fader>`;
    customElements.define('my-channel', TemplateComponent.fromString(template));
    
Then inside the DOM options of the fader can be bound to using ``awml-option``. ::

    <my-channel>
      <awml-option type=bind name='gain.value' src='...'></awml-option>
    </my-channel>

Optional Nodes
^^^^^^^^^^^^^^

DOM nodes inside of templates can be added or removed based on the value of a
template expression. This can be used to implement optional parts of an
interface. ::

    const template `
      <aux-fader></aux-fader>
      <aux-toggle %if={{ this.hasMute }} label=mute></aux-toggle>
    `;

Binding aliases
^^^^^^^^^^^^^^^

Options of components inside of templates can be assigned aliases which make them available as
options on the resulting web components. ::

    const template = `<aux-fader $gain=value></aux-fader>`;
    customElements.define('my-channel', TemplateComponent.fromString(template));

Then inside the DOM options of the fader can be bound to using ``awml-option``. ::

    <my-channel>
      <awml-option type=bind name='gain' src='...'></awml-option>
    </my-channel>

