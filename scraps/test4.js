//@ test4.compiled.js --language_in=ES6_STRICT --language_out=ES5_STRICT --create_source_map=nes.srcmap --jscomp_warning=checkTypes --jscomp_warning=checkVars

'use strict';

import StepGeneratorNode from './audio/stepgeneratornode';

const ac = new AudioContext();
const sg = new StepGeneratorNode(ac, 2);
sg.connect(ac.destination);

sg.generator = function*() {
  const freq = 110;
  let time = 0;
  const samples = 512;
  while (time < 2) {
    const delta = 1 / freq;
    for (let value = -1; value < 1; value += 4/samples) {
      yield [time, value * .1];
      time += delta / samples;
    }
    for (let value = 1; value > -1; value -= 4/samples) {
      yield [time, value * .1];
      time += delta / samples;
    }
  }
};
