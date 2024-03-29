Classes
=======

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

.. _IBindingDescription:

IBindingDescription
^^^^^^^^^^^^^^^^^^^

.. js:autoclass:: IBindingDescription

.. _Bindings:

Bindings
^^^^^^^^
.. js:autoclass:: Bindings
  :members: update, updatePrefix, dispose

.. _Option-Types:

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

.. _BackendBase:

BackendBase
^^^^^^^^^^^

.. js:autoclass:: BackendBase
  :members: resolvePath, resolveId, setByPath, observeInfo, fetchInfo,
    observeById, observeByPath, supportsIds, callById, callByPath

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
