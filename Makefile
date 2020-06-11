.PHONY: prettier

all:

prettier:
	cd prettier && npm run prettier

lint:
	./eslint/node_modules/.bin/eslint .
