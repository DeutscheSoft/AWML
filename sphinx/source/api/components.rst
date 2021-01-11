Components
==========

.. _PrefixComponentBase:

PrefixComponentBase
-------------------

.. js:autoclass:: PrefixComponentBase
  :members: src, srcPrefix, transformReceive, transformSrc, debounce, partial, pipe

.. _AttributesComponent:

AttributesComponent
-------------------

The ``<awml-attribute>`` component can be used to attach a backend parameter to
attributes on a DOM element. It inherits all properties and attributes from
:ref:`PrefixComponentBase`.

Note that ``<awml-attribute>`` should not be used to set the ``prefix``
attributes, use ``<awml-prefix>``, instead.

Example: ::

    <div>
      <awml-attributes
        src='/label'
        transform-receive='(label) => { title: label }'>
      </awml-attributes>
    </div>

.. js:autoclass:: AttributesComponent

.. js:autoattribute:: StylesComponentBase#triggerResize

.. _BackendComponent:

BackendComponent
----------------

.. js:autoclass:: BackendComponent

.. _ClassComponent:

ClassComponent
--------------

The ``<awml-class>`` component can be used to set CSS classes on a DOM element 
based on the value of a backend parameter. It inherits all properties and
attributes from :ref:`PrefixComponentBase`.

Example: ::

    <div>
      <awml-class
        src='/Mute'
        transform-receive='(muted) => muted ? "is-muted" : null'>
      </awml-class>
    </div>

.. js:autoclass:: ClassComponent

.. _CloneComponent:

CloneComponent
--------------

.. js:autoclass:: CloneComponent

.. _EventComponent:

EventComponent
--------------

.. js:autoclass:: EventComponent

.. _OptionComponent:

OptionComponent
---------------

The OptionComponent can be used to create two-way bindings with a parent
component. Custom binding types can be implemented to extend it's functionality.

.. js:autoclass:: OptionComponent
  :members: type, name

.. _PrefixComponent:

PrefixComponent
---------------

.. js:autoclass:: PrefixComponent

.. _StylesComponent:

StylesComponent
---------------

.. js:autoclass:: StylesComponent

.. _TemplateComponent:

TemplateComponent
-----------------

TemplateComponent is a baseclass for building powerful custom components. See
:doc:`/template_components` for an introduction.

.. js:autoclass:: TemplateComponent
  :members: constructor, fromString, awmlCreateBinding, whenAttached, triggerUpdate, redraw

.. _HideComponent:

HideComponent
-------------

.. js:autoclass:: HideComponent

.. _ShowComponent:

ShowComponent
-------------

.. js:autoclass:: ShowComponent

