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

Bind directives
^^^^^^^^^^^^^^^

Bind directives can be used to install bindings on components inside of a
template. They are internally based on a :ref:`Bindings` object and work
similar to :ref:`BindComponent`. The main advantage to using a
:ref:`BindComponent` is that they require no additional component. ::

    const template = `<aux-fader %bind={{ this.faderBindings }}></aux-fader>`;
    class MyComponent extends TemplateComponent.fromString(template) {
      constructor() {
        super();
        this.faderBindings = [
          {
            src: '...',
          },
        ];
      }
    }

    customElements.define('my-component', MyComponent);

See the documentation of :ref:`IBindingDescription` for a specification of the
possible parameters. All bindings will calculate their prefix starting from the
node which they are installed on.

Properties of template expressions
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Template components automatically extract properties from template expressions.
Those properties are then defined as properties on the resulting template
component. Specifically, for a property named ``VAR``, the actual value is
stored in the property ``_VAR`` and initialized to ``null``; a getter is defined
which returns the value and a setter is defined which updates the value and
notifies all template expressions depending on this property to be updated in
the next rendering frame.
In addition for each property a getter is defined called ``VAR$`` which returns
a dynamic value which represents the property. This can, for example, be used to
bind properties to e.g. widget options.

Properties are detected inside of template expressions as matches of the regular
expression ``/this\.([\w0-9$_]+)/``. The resulting list of properties can be
controlled with parameters to :js:func:`TemplateComponent.create`.
