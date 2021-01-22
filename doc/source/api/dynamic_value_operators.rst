.. _dynamic-value-operators:

DynamicValue Operators
======================

Dynamic value operators are functions which create and transform dynamic
values. There are useful in combination with the ``pipe`` property of the
:ref:`PrefixComponentBase` component.

Dynamic value operators can be thought of as asynchronous analogues of standard
control flow constructs. For instance,

- the :ref:`filter` function removes values from the stream of values emitted by
  a dynamic value,
- the :ref:`map` function transforms values received and sent by a dynamic
  value,
- the :ref:`switchMap` function can be used to dynamically switch between
  dynamic values based on the value of another dynamic value. This can be
  thought of as the asynchronous analog of ::
  
      if (valueA) {
        return valueB;
      } else {
        return valueC;
      }
- the :ref:`resolve` function can be used to transform values received using an
  async function and
- the :ref:`combineLatest` function can be used to combine the values emitted by
  a list of dynamic values into one array of values.


.. _filter:

filter
------

.. js:autofunction:: filter

.. _map:

map
---

.. js:autofunction:: map


.. _switchMap:

switchMap
---------

.. js:autofunction:: switchMap

.. _resolve:

resolve
-------

.. js:autofunction:: resolve

.. _combineLatest:

combineLatest
-------------

.. js:autofunction:: combineLatest
