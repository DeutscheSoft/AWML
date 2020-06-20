# AWML

**A**udio **W**idget **M**arkup **L**anguage is a markup language for describing user interfaces for audio applications.
This implementation uses HTML5 Custom Tags and supports integration with the AUX widget library.

## Contents

* [Using Widgets](#widgets)
* [Options](#options)
  - [Option formats](#option-formats)
  - [Static options](#awml-option-type-static)
  - [Media options](#awml-option-type-media)
  - [Bind options](#awml-option-type-bind)
  - [Option inheritance](#options-and-inheritance)
* [Events](#events)
* [Protocol Backends](#protocol-backends)
  - [local](#-awml-backend-type-local-)
  - [websocket](#-awml-backend-type-websocket-)
  - [aes70](#-awml-backend-type-aes70-)
* [Templates](#templates)
* [Tree Mutation Tags](#mutation-tags)
* [Installation](#installation)
* [License](#license)

## Options

The behavior of AWML widgets is completely controlled by their options.

There are two different ways to specify options for a widget.
They can either be set inline using attributes or using the `awml-option` tag.

The possible options of an AWML Tag are identical to those of the corresponding AUX widget.
See the [AUX documentation](http://docs.deuso.de/AUX/) for a complete list of widgets and their options.

Options usually have both a type and a format.
For inline options using attributes the type is always `static` and the `format` is specified by prepending the attribute value by the format name followed by a `:` (e.g. `min='js:4*12'`).
For options using the tag `awml-option`, the format and the type are given as attributes, the value can be either in an attribute or container content.
The default type is `static`.

Example:

    <aux-knob min="-24" max="24">
      <awml-option name="value" format="number" value='-21'></awml-option>
      <awml-option name="base">0</awml-option>
      <awml-option name="labels" format="json">[-24, 0, 24]</awml-option>
    </aux-knob>


### Option formats

Since AWML options are mapped onto options for widgets of the 'AUX' library, they need to represent different JavaScript types.
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

### awml-option type=static

`static` options are just that, static.
Once set they do not change their value, unless the corresponding DOM node attributes are changed.
They are intended to be used for options which do not usually change.
All inline options are static and `static` is the default value for the `awml-option` tag `type` attribute.

Additional attributes are

* `name` - option name
* `format` - option format (defaults to `json` or `string`)
* `value` - option value (optionally as container content)

### awml-option type=media

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

    <aux-knob>
      <awml-option type=media name=active media='(min-width: 400px)'></awml-option>
    </aux-knob>
    <aux-fader>
      <awml-option type=media media='(max-width:600 px)' name=min>[0,2]</awml-option>
      <awml-option type=media media='(max-width:500 px)' name=show_scale></awml-option>
    </aux-fader>

In the above example, the `min` option of the fader will have the value `0` if the window is smaller than 600 pixels and `2` otherwise.

The media type options are supposed to be used in conjunction with corresponding CSS definitions.

### awml-option type=bind

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
* `transform-src` - transform function called with the path before creating the
  binding
* `prefix` - source address base handle (optional)
* `sync` - sync flag (optional)
* `readonly` - readonly flag (optional)
* `writeonly` - writeonly flag (optional)
* `value` - the default value, if none is set in the corresponding backend (optional)
* `format` - option format for default value (optional)
* `partial` - accept partial values for list bindings
* `prevent-default` - If set, the event handler of the AUX event will return false. This will prevent
  the default action of that event handler. What this default action is depends
  on the widget.
* `receive-delay` - Time in milliseconds for which value changes from the
  backend are ignored for after the last user action. This prevents control
  widgets to jump back while the user is controlling them. Defaults to 1000.
* `debug` - If set, some debug information about the binding will be printed to
  the JavaScript console. This can be helpful when bindings do not work for some
  reason.

By default, bindings will only react to user interaction in the widget, as opposed to any modification.
This means it will bind the `useraction` event in the AUX widget. This
behavior can be controlled using the following flags:
* `readonly` - No event will be used. The binding will not react to changes of
  the widget option at all and only set the option in the widget when values
  change in the back-end.
* `sync` - The `set` event handler will be used instead of the `useraction`
  event. This means that this binding will react to *all* changes of the widget
  option, even if done programmatically (e.g. by another binding).
* `writeonly` - The `userset` event will be used and the default action
  prevented. The default action of the `userset` event is the `useraction`
  event. This means that option changes done by the user will not change the
  widget at all, instead they will only be sent to the back end.

Example:

      <aux-knob min=0 max=10>
        <awml-option name=value type=bind src='remote:foo'></awml-option>
        <awml-option sync name=value type=bind src='local:foo'></awml-option>
      </aux-knob>
      <aux-knob min=0 max=10>
        <awml-option name=value type=bind src='local:foo'></awml-option>
      </aux-knob>

The purpose of the `prefix` handle is to simplify binding a tree of widgets to a tree of values in the backend.
This is useful when building interfaces using templates or similar mechanisms where copies of the same AWML structure are connected to different sources.
Another application is where the binding of parts of a user interface is changed dynamically.
The basic idea is that the `src` attribute is a relative address which is to be prefixed later by calling `AWML.set_prefix` on the widget tree.
The value of the `prefix` attribute is a handle.
When setting the prefix of option bindings with a given handle, the handle is passed as the second argument to `AWML.set_prefix`.
If the prefix attributes are without a value (i.e. the value is `prefix`), the second argument is optional.

Example:

        <template id='foo'>
          <aux-knob>
            <awml-option name=value type=bind src='knob1/value' prefix></awml-option>
            <awml-option sync name=min type=bind src='knob1/min' prefix></awml-option>
            <awml-option sync name=max type=bind src='knob1/max' prefix></awml-option>
          </aux-knob>
          <aux-knob>
            <awml-option name=value type=bind src='knob2/value' prefix></awml-option>
            <awml-option sync name=min type=bind src='knob2/min' prefix></awml-option>
            <awml-option sync name=max type=bind src='knob2/max' prefix></awml-option>
          </aux-knob>
          <aux-knob min=-96 max=6>
            <awml-option name=value type=bind src='knob/gain' prefix=bar></awml-option>
          </aux-knob>
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

## Events

The `aux-event` component can be used to install event handlers to a parent
element. If the parent element is an AUX widget, the event handler will use the
`subscribe` method in the parent AUX widget to subscribe to an event. If the
parent is not an AUX event, the event handler will be subscribed using the
standard DOM event mechanism `addEventListener`.

### Properties

* `type` - Event name (available as `type` attribute).
* `callback` - Event callback (available as `callback` attribute, parsed as
  javascript).

### Example

Using an AUX widget:

        <aux-button label='Click me!'>
          <awml-event type=click callback="function() { window.alert('Hello!'); }"></awml-event>
        </aux-button>

Using a standard DOM element:

        <button>
          Click me!
          <awml-event type=click callback="function() { window.alert('Hello!'); }"></awml-event>
        </button>

## Protocol Backends

In principle, protocol backends can be used without bindings, but usually they are used together with data bindings.

### Common Attributes

* `transform-path`
* `name`
* `type`

### `<awml-backend type=local>`

The `local` backend is essentially a mapping of values and there is no 'real' backend which connects different clients.
It can be a convenient way for connecting widgets without the additional roundtrip of a network connection.
In addition, it can also be used as a building block for more complex setups.

Example:

    <awml-backend type='local' name='local'></awml-backend>

    <h1>These two knobs stay in sync</h1>

    <aux-knob min='0' max='10'>
      <awml-option type=bind name='value' src='local:foo'></awml-option>
    </aux-knob>
    <aux-knob min='0' max='10'>
      <awml-option type=bind name='value' src='local:foo'></awml-option>
    </aux-knob>

#### Attributes

* `delay`: Artificially delays the setting of properties by a number of
  milliseconds. This can be used to simulate the behavior of a user
  interface with a specific network lag. 

### `<awml-backend type=websocket>`

The `websocket` connects to a server through a WebSocket.
The current implementation uses a simple JSON-based protocol.
This backend is to be considered an example and the protocol used
here is going to change without any backwards compatibility.
A corresponding server example can be found in the source code repository
in `bin/server.pike`.

Example:

    <awml-backend
          type='websocket' name='local'
          src='ws://localhost:8080/data'
      >
    </awml-backend>

    <h1>All connected clients will keep this in sync</h1>

    <aux-knob min='0' max='10'>
      <awml-option name='value' src='local:foo'></awml-option>
    </aux-knob>

#### Attributes

* `src`: WebSocket url to connect to.
* `clear`: If set, a clear command will be send initially after connecting.

### `<awml-backend type=aes70>`

This backend uses [AES70.js](http://github.com/DeutscheSoft/AES70.js) to control
a remote device. The `aes70` backend is not exported by default, it needs to be
explicitly imported from `src/backends/aes70.js`.
All properties in the device will become available through path names built up from
their [AES70](https://ocaalliance.com) Role names. The path name of an object
consists of its role name and the role names of its parent objects, seperated by
`/`. The root block is excluded from this naming scheme, which means that the
children of the root block appear at the top level.

For example, imagine a device with the following AES70 tree in its root block:
        
      OcaBlock("Channel1",
        OcaGain("Volume")
      )
      OcaBlock("Channel2",
        OcaGain("Volume")
      )

The resulting properties available from the backend would be

      Channel1/Volume/Gain
      Channel1/Volume/Gain/Min
      Channel1/Volume/Gain/Max
      Channel1/Volume/Role
      Channel1/Volume/Label
      Channel1/Volume/...
      Channel2/Volume/Gain
      Channel2/Volume/Gain/Min
      Channel2/Volume/Gain/Max
      Channel2/Volume/Role
      Channel2/Volume/Label
      Channel2/Volume/...

The properties available within an object path are those defined by AES70.

All AES70 Manager objects are available through their name, e.g. the
`DeviceManager` and its properties is availble as `DeviceManager/<property>`.

#### Attributes

* `src`: WebSocket url to connect to.

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
    
    4x4 buttons:<br>
    <awml-clone template='block'></awml-clone>

Adding the attribute `fetch` to the `awml-clone` element fetches the file stated in the `template` attribute from the server. The path is relative to the document containing the `awml-clone` element.

    4x4 buttons:<br>
    <awml-clone template='block.html' fetch></awml-clone>


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
        <aux-button label='hello'>
            <awml-option type=bind src='/value' prefix></awml-option>
        </aux-button>
    </template>
    
    4x4 buttons:<br>
    <awml-clone template='block' prefix='remote:block1/'></awml-clone>

The `awml-clone` tag will automatically propagate the correct prefix values to all `awml-option` tags.

## Mutation Tags

The mutation tags described here can be used to modify the DOM tree based
on backend data. The text content inside of these tags is, unless empty,
interpreted as a transformation method which is called with the current backend
value. The interpretation of its return value depends on the mutation tag.
Alternatively, the `transform-receive` attribute can be used to set a
transformation function.

### Common Attributes

* `src` - Path of the value(s) to be bound.
* `src-prefix` - Prefix handle to use for this binding.
* `transform-receive` - Optional transformation callback for received values.
  Will be called in the context of the corresponding DOM node.

### `<awml-show>` and `<awml-hide>`

The parent widgets is either hidden or shown depending on whether the value
received is true or false. Depending on what the parent widget is, the behavior
of these tags is different:

* If the parent is an AUX widget inside of an AUX Container, it will call
  `hideChild` or `showChild` in its Container parent.
* If the parent is any other AUX widget, it will call `hide` and `show`.
* If the parent is any other DOM element, it will set the CSS `display`
  property to `none`.

### `<awml-styles>`

This tag sets style properties on its parent node. The return value of the
transformation function is expected to be an object containing style properties.

### `<awml-class>`

This tag adds CSS classes to its parent node. The return value of the
transformation function is expected to be either a class name or an array of
class names.

### `<awml-attributes>`

This tag sets attributes on its parent node. The return value of the
transformation function is expected to be an object of attributes.

### `<awml-prefix>`

This tag sets a prefix on its parent node. The prefix handle used can be
chosen using the `handle` attribute.

## Installation

AWML is written as ES6 modules. In order to install it into a project, either
add it as a git submodule or install it from git using npm. Then adding it into
an application can either be done by including using a script tag.

    <script type=module src='AWML/src/index.js'></script>

Alternatively it can also be imported by adding an import statement to an
existing ES6 module script.

    import './AWML/src/index.js';

AWML is compatible with the AUX widget library. AWML will automatically detect
AUX components if they are used.

## License

This implementation of AWML is available under the terms of the GNU General Public License version 2.
See the `COPYING` file for details.

Copyright (c) 2015-2020 DeusO GmbH
