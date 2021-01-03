Introduction
============

AWML is a web components library for building professional audio user
interfaces. It has close integration with the `aux-widgets
<https://github.com/DeutscheSoft/aux-widgets>`_ library.

This introduction aims to give an overview and explain basic concepts
of AWML. It provides links to more in-depth documentation of the features
discussed.

AWML provides

* :ref:`introduction-parameter-binding` for connecting UI components with
  backend parameters,
* :ref:`introduction-templating` for combining pre-defined views into complex
  interfaces and
* :ref:`introduction-protocol-backends` for controling device backends.

.. _introduction-parameter-binding:

Parameter Binding
-----------------

For binding components to backend parameters, for instance using a standard
audio control protocol such as `AES70 <https://www.ocaalliance.org>`_, AWML
allows backend parameters to be assigned to the DOM tree. This relies on backend
parameters being represented by some kind of hirarchical addressing scheme (e.g.
``Channel1/Mute``). These parameter addresses will then be used by AWML
components in order to decide which backend parameter to bind to.

In general, there can be any number of different parameter trees defined on top
of the DOM, however in basic views it will be only one. The assignment of
parameter addresses to DOM elements is done hirarchically by assigning address
prefixes to nodes. The resulting address of a given node is then the
concatenation of the prefixes of the node itself and all its parents. Parameter
trees are denoted by their unique string handle and the prefix of a node for a
given handle is set using the attribute ``prefix-<HANDLE>``. The default
parameter tree with handle ``null`` uses the attribute ``prefix``.

Backend parameter can be bound to

* `aux-widgets <https://github.com/DeutscheSoft/aux-widgets>`_ components and
  properties of :ref:`template-components` using :ref:`OptionComponent`,
* DOM element attributes using :ref:`AttributesComponent`,
* CSS classes using :ref:`ClassComponent`,
* CSS styles using :ref:`StylesComponent`,
* the visibility of elements and widgets using :ref:`HideComponent` and
  :ref:`ShowComponent`,
* the template name or location using :ref:`CloneComponent` and
* the prefix of a node using :ref:`PrefixComponent`.

.. _introduction-templating:

Templating
----------

There are two main ways of templating build into AWML. The first are standard
HTML templates which can be cloned into the DOM using the :ref:`CloneComponent`.
The second are :ref:`template-components` which allow building complex custom
components based on HTML templates.

Basic HTML templates can either be ``<template>`` elements with a unique ``id``
or simple HTML files. The :ref:`CloneComponent` can then be used to clone those
templates into the DOM. It can then be combined with e.g. the ``prefix``
attribute to attach it to the corresponding backend parameters. ::

    <template id=channel>
      <aux-fader>
        ...
      </aux-fader>
      <aux-toglle label=Mute>
        ...
      </aux-toggle>
    </template>

    <awml-clone template=channel prefix='remote:Channel1/'></awml-clone>
    <awml-clone template=channel prefix='remote:Channel2/'></awml-clone>
    <awml-clone template=channel prefix='remote:Channel3/'></awml-clone>

Template compoents instead are Web Components which are defined using a HTML
template. This HTML template contains template expressions which are mapped onto
properties of the resulting component. See :ref:`template-components` for an
introduction.

.. _introduction-protocol-backends:

Protocol Backends
-----------------

In AWML protocol backends can be thought of conceptually as remote devices or
or as some kind of backend parameters. Backends are essentially parameters which
can be accessed using some unique address. If a backend is registered and given
a name its parameters can be referenced by components in parameter bindings.

Backends can either be created and registered using the :ref:`BackendComponent`
or using the global functions :ref:`registerBackend`. Then a parameter with 
address ``<parameterName>`` in a backend registered under a name ``<backendName>``
will be available under the global address ``<backendName>:<parameterName>``.

Conventions
-----------

AWML components follow several simple conventions.

* A component called OptionComponent will be registered for the tag name
  ``AWML-OPTION``.
* If a component has a property called ``someProperty`` it will map the
  attribute ``some-property`` onto that same property. The conversion between the
  attribute value (which is a string) and the property value depends on the
  datatype.

Installation
============

AWML is written as ES6 modules. In order to install it into a project, either
add it as a git submodule or install it from git using npm. Then adding it into
an application can either be done by including using a script tag. ::

    <script type=module src='AWML/src/index.js'></script>

Alternatively it can also be imported by adding an import statement to an
existing ES6 module script. ::

    import './AWML/src/index.js';

AWML is compatible with the AUX widget library. AWML will automatically detect
AUX components if they are used.

License
=======

This implementation of AWML is available under the terms of the GNU General Public License version 2.
See the ``COPYING`` file for details.

Copyright (c) 2015-2020 DeusO GmbH
