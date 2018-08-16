all: awml.min.js

DEFAULT_MODULES = awml.bindings.js awml.backends.js awml.templates.js awml.prefixselect.js awml.styles.js

awml.min.js: awml.js $(DEFAULT_MODULES)
	closure-compiler --language_in ECMASCRIPT5_STRICT --create_source_map awml.min.map $^ > $@
