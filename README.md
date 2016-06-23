# AWML

**A**udio **W**idget **M**arkup **L**anguage is a markup language for describing user interfaces for audio applications.
AWML aims to be an independent description language, however it is currently de-facto specified by this implementation.
This implementation uses HTML5 Custom Tags and is based on the [toolkit widget library](https://github.com/DeutscheSoft/toolkit).

The aim of AWML is to simplify the creation of professional user interfaces.


## Widgets

Creating a widget using AWML is easy as writing standard HTML.

    <awml-knob class="myKnob"
      min="-24" max="24"
      base="0" value="12" 
      labels="json:[-24, 0, 24]"
      >
      <awml-option name='show_hand' type='media' media='min-width: 800px'></awml-option>
    </awml-knob>

## Options

The way a widget behaves and its DOM representation are controlled by its options. In addition CSS can be used to change the way it looks.

There are two different ways to specify options for a widget.
They can either be set inline using attributes or alternatively using the `awml-option` tag.

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

Since AWML options are mapped onto options for widgets from the 'toolkit' library, they need to represent different JavaScript types.
The way this is done in AWML by using different formats.

When specifying an option as tag attribute, the format is part of the attribute value.
When setting an option using the `awml-option` tag, the format is given in the type-attribute.

Available formats are:

* `json` - JSON datatypes
* `js` - JavaScript expression
* `string` - literal string
* `number` - a numeric value (including floats)
* `int` - integers
* `sprintf` - generates a formatting function from a sprintf-style format definition
* `inherit` - inherits values
* `bool` - `true` or `false`

If no format is specified, the parser will try `json` and then fall back to `string`.

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
      <awml-option type=media name=active media='min-width: 400px'></awml-option>
    </awml-knob>
    <awml-fader>
      <awml-option type=media media='max-width:600 px' name=min>[0,2]</awml-option>
      <awml-option type=media media='max-width:500 px' name=show_scale></awml-option>
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
* `format` - option format
* `value` - the default value, if none is set in the corresponding backend (optional)
* `src` - the address of the backend value, of the form `<protocol>:<path>`
* `sync` - sync flag (optional)
* `transform-send` - transform function for sending values (optional)
* `transform-receive` - transform function when receiving values (optional)

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


## Protocol Backends

In principle, protocol backends can be used without bindings, but usually they are used together with data bindings.
Protocol backends are defined in `awml.backends.js`.


### local

The `local` backend is essentially a mapping of values and there is no 'real' backend which connects different clients.
It can be a convenient way for connecting widgets without the additional roundtrip of a network connection.
In addition, it can also be used as a building block for more complex setups.

Example:

    <html>
      <head>
        <script src='awml.js'></script>
        <script src='awml.bindings.js'></script>
        <script src='awml.backends.js'></script>
      </head>
      <body>
        <awml-root>
          <awml-backend type='local' name='local'></awml-backend>

          <h1>These two knobs stay in sync</h1>

          <awml-knob min='0' max='10'>
            <awml-binding option='value' source='local:foo'></awml-binding>
          </awml-knob>
          <awml-knob min='0' max='10'>
            <awml-binding option='value' source='local:foo'></awml-binding>
          </awml-knob>
        </awml-root>
      </body>
    </html>


### shared

The `shared` backend connects to a second backend inside of a [Shared Worker](https://developer.mozilla.org/en/docs/Web/API/SharedWorker).
Shared Workers are worker threads, which can be accessed from all browser tabs with the same origin (protocol, host and port).
For example, if the backend inside of the worker thread is a `websocket` backend, all same origin tabs would automatically share the same websocket connection.

In the AWML tag `shared` can be added as an attribute.
It can be applied to all other backends.

The following example uses a `local` backend inside of the Shared Worker, which is a convenient way of connecting widgets inside of several tabs without the need for any network connection.

Example:

    <html>
      <head>
        <script src='awml.js'></script>
        <script src='awml.bindings.js'></script>
        <script src='awml.backends.js'></script>
      </head>
      <body>
        <awml-root>
          <awml-backend shared type='local' name='local'></awml-backend>

          <h1>All tabs will keep this knob in sync</h1>

          <awml-knob min='0' max='10'>
            <awml-binding option='value' source='local:foo'></awml-binding>
          </awml-knob>
        </awml-root>
      </body>
    </html>

### websocket

Example:

    <html>
      <head>
        <script src='awml.js'></script>
        <script src='awml.bindings.js'></script>
        <script src='awml.backends.js'></script>
      </head>
      <body>
        <awml-root>
          <awml-backend
                type='websocket' name='local'
                src='ws://localhost:8080/data'
            >
          </awml-backend>

          <h1>All connected clients will keep this in sync</h1>

          <awml-knob min='0' max='10'>
            <awml-binding option='value' source='local:foo'></awml-binding>
          </awml-knob>
        </awml-root>
      </body>
    </html>

## License

This implementation of AWML is available under the terms of the GNU General Public License version 2.
See the `LICENSE` file for details.

Copyright (c) 2015-2016 DeusO GmbH
