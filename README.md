# AWML

**A**udio **W**idget **M**arkup **L**anguage is a markup language for describing user interfaces for audio applications.
AWML aims to be an independent description language, however it is currently de-facto specified by this implementation.
This implementation uses HTML5 Custom Tags and is based on the [toolkit widget library](https://github.com/DeutscheSoft/toolkit).

The aim of AWML is to simplify the creation of professional user interfaces.

## Widgets

Using a toolkit widget in AWML is as easy as writing standard HTML.

    <awml-knob class="myKnob"
      min="-24" max="24"
      base="0" value="12" 
      labels="[-24, 0, 24]"
      >
      <awml-option name='show_hand' type='media' media='(min-width: 800px)'></awml-option>
    </awml-knob>

## Options

The behavior of AWML widgets is completely controlled by their options.

There are two different ways to specify options for a widget.
They can either be set inline using attributes or using the `awml-option` tag.

The possible options of an AWML Tag are identical to those of the corresponding toolkit widget.
See the [toolkit documentation](http://deuso.de/toolkit/docs/) for a complete list of widgets and their options.

Options usually have both a type and a format.
For inline options using attributes the type is always `static` and the `format` is specified by prepending the attribute value by the format name followed by a `:` (e.g. `min='js:4*12'`).
For options using the tag `awml-option`, the format and the type are given as attributes, the value can be either in an attribute or container content.
The default type is `static`.

Example:

    <awml-knob min="-24" max="24">
      <awml-option name="value" format="number" value='-21'></awml-option>
      <awml-option name="base">0</awml-option>
      <awml-option name="labels" format="json">[-24, 0, 24]</awml-option>
    </awml-knob>


### Option formats

Since AWML options are mapped onto options for widgets of the 'toolkit' library, they need to represent different JavaScript types.
This is done in AWML by using different data formats.

When specifying an option as a tag attribute, the format is part of the attribute value.
When setting an option using the `awml-option` tag, the format is specified by the `format`-attribute.

Available formats are:

* `json` - JSON datatypes
* `js` - JavaScript expression
* `string` - literal string
* `number` - a numeric value (including floats)
* `int` - integers
* `sprintf` - generates a formatting function from a sprintf-style format definition
* `bool` - `true` or `false`
* `regexp` - A regular expression.

When no format has been specified explicitly, AWML will try to interpret the value as `json` and, if that fails, fall back to `string`.

### Option types

### static

`static` options are just that, static.
Once set they do not change their value, unless the corresponding DOM node attributes are changed.
They are intended to be used for options which do not usually change.
All inline options are static and `static` is the default value for the `awml-option` tag `type` attribute.

Additional attributes are

* `name` - option name
* `format` - option format (defaults to `json` or `string`)
* `value` - option value (optionally as container content)

### media

The media prefix is used to make options depend on [media queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Media_Queries/Using_media_queries).
The value of media type options depends on the result of the media query and their value is updated dynamically when the window size changes.

The media query is given in the `media` attribute and follows the usual syntax.
The two possible values of the option are given in the value in an array with two entries.
The first entry is used when the media-query is false, the second entry when it is true.

Additional attributes are:

* `name` - option name
* `format` - option format
* `value` - an array of values, defaults to `[false, true]`

Example:

    <awml-knob>
      <awml-option type=media name=active media='(min-width: 400px)'></awml-option>
    </awml-knob>
    <awml-fader>
      <awml-option type=media media='(max-width:600 px)' name=min>[0,2]</awml-option>
      <awml-option type=media media='(max-width:500 px)' name=show_scale></awml-option>
    </awml-fader>

In the above example, the `min` option of the fader will have the value `0` if the window is smaller than 600 pixels and `2` otherwise.

The media type options are supposed to be used in conjunction with corresponding CSS definitions.

### bind

The `bind` type option allows connecting widget options to values in a backend.
Backends are essentially shared value stores using publish/subscribe semantics.
In a given application all data values in a backend are uniquely identified by their address.
Addresses take the form of URIs, where the protocol part uniquely identifies a backend.

Unlike in most applications of URI schemes, the protocol part is used here only to identify the backend and can be chosen freely by the developer.
It has no meaning inside of AWML itself.
The same applies to the rest of the URI.

However, in most cases it makes sense to follow reasonable conventions and use the protocol name which the backend actually uses.

Additional attributes are:

* `name` - option name
* `src` - the address of the backend value, of the form `<protocol>:<path>`
* `transform-send` - transform function for sending values (optional)
* `transform-receive` - transform function when receiving values (optional)
* `prefix` - source address base handle (optional)
* `sync` - sync flag (optional)
* `value` - the default value, if none is set in the corresponding backend (optional)
* `format` - option format for default value (optional)

By default, bindings will only react to user interaction in the widget, as opposed to any modification.
This behavior can be controlled using the `sync` flag.
If `sync` is set, the binding will trigger on any modification of the widget option and send the new value to the backend.
This is useful when relaying values from one remote backend to another local one.

Example:

      <awml-knob min=0 max=10>
        <awml-option name=value type=bind src='remote:foo'></awml-option>
        <awml-option sync name=value type=bind src='local:foo'></awml-option>
      </awml-knob>
      <awml-knob min=0 max=10>
        <awml-option name=value type=bind src='local:foo'></awml-option>
      </awml-knob>

The purpose of the `prefix` handle is to simplify binding a tree of widgets to a tree of values in the backend.
This is useful when building interfaces using templates or similar mechanisms where copies of the same AWML structure are connected to different sources.
Another application is where the binding of parts of a user interface is changed dynamically.
The basic idea is that the `src` attribute is a relative address which is to be prefixed later by calling `AWML.set_prefix` on the widget tree.
The value of the `prefix` attribute is a handle.
When setting the prefix of option bindings with a given handle, the handle is passed as the second argument to `AWML.set_prefix`.
If the prefix attributes are without a value (i.e. the value is `prefix`), the second argument is optional.

Example:

        <template id='foo'>
          <awml-knob>
            <awml-option name=value type=bind src='knob1/value' prefix></awml-option>
            <awml-option sync name=min type=bind src='knob1/min' prefix></awml-option>
            <awml-option sync name=max type=bind src='knob1/max' prefix></awml-option>
          </awml-knob>
          <awml-knob>
            <awml-option name=value type=bind src='knob2/value' prefix></awml-option>
            <awml-option sync name=min type=bind src='knob2/min' prefix></awml-option>
            <awml-option sync name=max type=bind src='knob2/max' prefix></awml-option>
          </awml-knob>
          <awml-knob min=-96 max=6>
            <awml-option name=value type=bind src='knob/gain' prefix=bar></awml-option>
          </awml-knob>
        </template>
        <script>
            window.addEventListener('load', function() {
                var template = document.getElementById('foo');
                var clone;

                for (var i = 0; i < 10; i++) {
                    clone = document.importNode(template, true);

                    // set the prefix for the first two knobs
                    AWML.set_prefix(clone, "remote:device"+i+"/");

                    // set the prefix for the third knob
                    AWML.set_prefix(clone, "local:device"+i+"/", 'bar');

                    document.body.appendChild(clone);
                }
            });
        </script>

Note that, the `awml-clone` tag is a simple alternative to using templates with automatic prefix support.
See the section about [templates](#templates) for more information.

### Options and inheritance

In complex user interfaces many widgets end up sharing the same or similar sets of options.
Repeating the same set of options every time a widget is created is cumbersome and unecessarily verbose.
To simplify this scenario a predefined set of options can be defined using the `awml-options` tag.

Currently, the `awml-options` tag has two limitations.

1. Only `static` options are allowed as defaults.
2. Changing the value of a set of default options does not change the options in existing widgets.

Both of these limitations may be removed in the future.

There are several possibilities to define default options:

1. As defaults for one specific type of widget using the `widget` attribute.

   Example:

        <awml-root>
          <awml-options widget='awml-fader' min=-96 max=6></awml-options>

          <awml-fader></awml-fader>
        </awml-root>

2. As a set of named defaults using the `name` attribute. This set of options can then
   be applied to a widget by referencing that name in the `options` attribute.

   Example:

        <awml-root>
          <awml-options name='knob1' min=0 max=10></awml-options>

          <awml-knob options='knob1'></awml-knob>
        </awml-root>

   It is possible to combine multiple named options using a list of names (e.g. `options='knob1 knob2'`).
   Furthermore, `awml-options` tag can inherit each other using the same syntax. This allow building up
   inhertance structures.

Both types of default options can be combined, named options overwrite tagname based defaults.

Example:

        <awml-root>
          <awml-options name='foo' max=10></awml-options>
          <awml-options name='bar' options='foo' min=0></awml-options>

          <awml-options widget='awml-fader' min=-96 max=6></awml-options>

          <awml-knob options='bar'></awml-knob>
          <!-- will have min=0 and max=10 and min=0 -->

          <awml-fader options='foo'></awml-fader>
          <!-- will have min=-96 and max=10 -->
        </awml-root>

Apart from widget options, the `awml-options` tag can also be given a CSS class. This class
will be added to any tag the options are applied to. This is useful in situations where one set
of options is directly linked to style properties.

## Events

toolkit widgets have several custom events in addition to the standard DOM events.
In AWML, event handlers can be registered by using the `awml-event` tag.

Example:

        <awml-root>
          <awml-button label='Click me!'>
            <awml-event type='click'>
                function() {
                    window.alert('Hello!');
                }
            </awml-event>
          </awml-button>
        </awml-root>

## Protocol Backends

In principle, protocol backends can be used without bindings, but usually they are used together with data bindings.
Protocol backends are defined in `awml.backends.js`.


### local

The `local` backend is essentially a mapping of values and there is no 'real' backend which connects different clients.
It can be a convenient way for connecting widgets without the additional roundtrip of a network connection.
In addition, it can also be used as a building block for more complex setups.

Example:

    <awml-root>
      <awml-backend type='local' name='local'></awml-backend>

      <h1>These two knobs stay in sync</h1>

      <awml-knob min='0' max='10'>
        <awml-option type=bind name='value' src='local:foo'></awml-option>
      </awml-knob>
      <awml-knob min='0' max='10'>
        <awml-option type=bind name='value' src='local:foo'></awml-option>
      </awml-knob>
    </awml-root>


### shared

The `shared` backend connects to a second backend inside of a [Shared Worker](https://developer.mozilla.org/en/docs/Web/API/SharedWorker).
Shared Workers are worker threads, which can be accessed from all browser tabs with the same origin (protocol, host and port).
For example, if the backend inside of the worker thread is a `websocket` backend, all same origin tabs would automatically share the same websocket connection.

In the AWML tag `shared` can be added as an attribute.
It can be applied to all other backends.

The following example uses a `local` backend inside of the Shared Worker, which is a convenient way of connecting widgets inside of several tabs without the need for any network connection.

Example:

    <awml-root>
      <awml-backend shared type='local' name='local'></awml-backend>

      <h1>All tabs will keep this knob in sync</h1>

      <awml-knob min='0' max='10'>
        <awml-option name='value' src='local:foo'></awml-option>
      </awml-knob>
    </awml-root>

### websocket

The `websocket` connects to a server through a WebSocket.
The current implementation uses a simple JSON-based protocol.
This is going to change in the future.
An example backend can be found in the source code repository.

Example:

    <awml-root>
      <awml-backend
            type='websocket' name='local'
            src='ws://localhost:8080/data'
        >
      </awml-backend>

      <h1>All connected clients will keep this in sync</h1>

      <awml-knob min='0' max='10'>
        <awml-option name='value' src='local:foo'></awml-option>
      </awml-knob>
    </awml-root>

## Templates

[HTML5 Templates](https://developer.mozilla.org/en/docs/Web/HTML/Element/template) are a mechanism for defining reusable parts of document.
AWML encourages the use of templates and features the special tag `awml-clone` to make them easier to use.
The basic idea behind the `awml-clone` tag is to allow cloning templates in a AWML document.

    <template id='block'>
        <awml-clone template='row'></awml-clone>
        <awml-clone template='row'></awml-clone>
        <awml-clone template='row'></awml-clone>
        <awml-clone template='row'></awml-clone>
    </template>
    <template id='row'>
        <awml-clone template='button'></awml-clone>
        <awml-clone template='button'></awml-clone>
        <awml-clone template='button'></awml-clone>
        <awml-clone template='button'></awml-clone>
        <br>
    </template>
    <template id='button'>
        <awml-button label='hello'></awml-button>
    </template>
    
    <awml-root>
      4x4 buttons:<br>
      <awml-clone template='block'></awml-clone>
    </awml-root>

Adding the attribute `fetch` to the `awml-clone` element fetches the file stated in the `template` attribute from the server. The path is relative to the document containing the `awml-clone` element.

    <awml-root>
        4x4 buttons:<br>
        <awml-clone template='block.html' fetch></awml-clone>
    </awml-root>


The real benefit of the `awml-clone` tag is the built-in support for relative binding addresses.
To illustrate this, we consider a situation where the value addressing scheme of the backend is in line with the structure of the user interface.
For example, the URIs of the button values are of the form `remote:block%/row%/column%/value`.
This could then easily be implemented in the above template examples:

    <template id='block'>
        <awml-clone template='row' prefix='row1/'></awml-clone>
        <awml-clone template='row' prefix='row2/'></awml-clone>
        <awml-clone template='row' prefix='row3/'></awml-clone>
        <awml-clone template='row' prefix='row4/'></awml-clone>
    </template>
    <template id='row'>
        <awml-clone template='button' prefix='column1/'></awml-clone>
        <awml-clone template='button' prefix='column2/'></awml-clone>
        <awml-clone template='button' prefix='column3/'></awml-clone>
        <awml-clone template='button' prefix='column4/'></awml-clone>
        <br>
    </template>
    <template id='button'>
        <awml-button label='hello'>
            <awml-option type=bind src='/value' prefix></awml-option>
        </awml-button>
    </template>
    
    <awml-root>
      4x4 buttons:<br>
      <awml-clone template='block' prefix='remote:block1/'></awml-clone>
    </awml-root>

The `awml-clone` tag will automatically propagate the correct prefix values to all `awml-option` tags.

The `awml-clone` tag is defined in the src file `awml.templates.js`.

## Installation

Simply clone this repository and update the submodule to get the right version to the toolkit library.

    git clone http://github.com/DeutscheSoft/AWML.git
    cd AWML
    git submodule init
    git submodule sync
    git submodule update

To start playing around with AWML, use one of the files in `tests/`.
Most of the AWML features will work when opening files locally, however some things (e.g. the `shared` or `websocket` backends) will require a webserver.
This repository contains a simple webserver which can be used for testing, which is written in the [Pike](http://pike.lysator.liu.se) programming language.

    pike backend/wsjson.pike

After starting it, you can access the tests using the url (http://localhost:8080/tests/).

## License

This implementation of AWML is available under the terms of the GNU General Public License version 2.
See the `COPYING` file for details.

Copyright (c) 2015-2017 DeusO GmbH
