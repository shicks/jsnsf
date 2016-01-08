.PHONY: all

all: nes.compiled.js # test4.compiled.js

JSCOMP=java -jar ~/Downloads/compiler.jar

deps.d: deps.pl
	./deps.pl

-include deps.d
