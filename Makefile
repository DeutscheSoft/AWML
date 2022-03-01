.PHONY: prettier ts_tests

all:

prettier:
	cd prettier && npm run prettier

lint:
	./eslint/node_modules/.bin/eslint .

ts_tests:
	./ts_tests.sh
