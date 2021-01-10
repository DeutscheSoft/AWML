Installation
============

The source of AWML is available to the public at
https://github.com/DeutscheSoft/AWML.

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
