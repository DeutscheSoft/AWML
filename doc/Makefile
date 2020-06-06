all: build

build: jsdoc/* ../src/**/*.js ../src/*.js Makefile
	./node_modules/.bin/jsdoc -c jsdoc/conf.json -d out -r ../src
