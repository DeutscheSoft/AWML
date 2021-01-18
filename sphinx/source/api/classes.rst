Classes
=======

Dynamic Values
--------------

.. _DynamicValue:

DynamicValue
^^^^^^^^^^^^

.. js:autoclass:: DynamicValue
  :members: hasValue, isActive, value, set, subscribe, wait, fromConstant, _subscribe

ListValue
^^^^^^^^^

Subclass of :ref:`DynamicValue` for aggregating lists of dynamic values.

.. js:autoclass:: ListValue
  :members: inSync, debounce, partial, constructor, DynamicValue

BackendValue
^^^^^^^^^^^^

Subclass of :ref:`DynamicValue` for representing backend data. Will be returned
by :ref:`getBackendValue`.

.. js:autoclass:: BackendValue
  :members: inSync, uri


.. _Option-Types:

Option Types
------------

Option types are classes which are instantiated by the ``AWML-OPTION`` component
(see :ref:`OptionComponent`). They control how values are connected to the component.

.. _BindOption:

BindOption
^^^^^^^^^^

.. js:autoclass:: BindOption
  :members: BindOption

.. _StaticOption:

StaticOption
^^^^^^^^^^^^

.. js:autoclass:: StaticOption

.. _MediaOption:

MediaOption
^^^^^^^^^^^

.. js:autoclass:: MediaOption

.. _Backends:

Backends
--------

.. _LocalBackend:

LocalBackend
^^^^^^^^^^^^

.. js:autoclass:: LocalBackend
  :members: delay

.. _LocalStorageBackend:

LocalStorageBackend
^^^^^^^^^^^^^^^^^^^

.. js:autoclass:: LocalStorageBackend
  :members: storage

.. _AES70Backend:

AES70Backend
^^^^^^^^^^^^

.. js:autoclass:: AES70Backend

.. _EmberPlusBackend:

EmberPlusBackend
^^^^^^^^^^^^^^^^

.. js:autoclass:: EmberPlusBackend
