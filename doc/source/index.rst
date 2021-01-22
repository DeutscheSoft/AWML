====
AWML
====

Audio Widget Markup Language is a markup language for building
user interfaces for audio applications.

Building this documentation
---------------------------

The documentation for this project is built using ``sphinx-js``. The documentation
source files can be found in the ``doc`` directory.
Building the documentation requires ``sphinx-js`` to be installed.
``sphinx-js`` requires ``jsdoc`` which can be installed by running ::

    npm ci

inside of the ``doc`` directory.

After that the documentation can be built using ::

    make html

after which the HTML version of the documentation can be found in
``doc/build/html/``.

Installation
------------

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
-------

AWML is available under the terms of the GNU General Public License version 2.
See the ``COPYING``` file for details.

Copyright (c) 2015-2021 DeusO GmbH

.. awml documentation master file, created by
   sphinx-quickstart on Wed Dec 30 14:19:26 2020.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

.. toctree::
   :maxdepth: 2
   :caption: Documentation

   introduction
   template_components

.. toctree::
   :maxdepth: 2
   :caption: API Reference

   api/globals
   api/classes
   api/components
   api/dynamic_value_operators

Indices and tables
==================

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`
