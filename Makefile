test4.compiled.js: bufferedaudionode.js stepgeneratornode.js test4.js Makefile
	{ java -jar ~/Downloads/compiler.jar --js=bufferedaudionode.js --js=stepgeneratornode.js --js=test4.js --language_in=ES6_STRICT --language_out=ES5_STRICT --create_source_map=test4.srcmap --jscomp_warning=checkTypes --jscomp_warning=checkVars; echo "//# sourceMappingURL=test4.srcmap"; } >| test4.compiled.js
