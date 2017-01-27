//@ test4.compiled.js --language_in=ES6_STRICT --language_out=ES5_STRICT --create_source_map=nes.srcmap --jscomp_warning=checkTypes --jscomp_warning=checkVars

'use strict';

import StepBufferWriter from './audio/stepbufferwriter';
import BufferedAudioNode from './audio/bufferedaudionode';

const ac = new AudioContext();
const node = new BufferedAudioNode(ac, 2);
const sw = new StepBufferWriter(node);
node.connect(ac.destination);

let time = 0;
const freq = 440;

function next() {
  if (time > 2) return;
  let steps = [];
  for (let i = 0; i < 20; i++) {
    steps.push([time, -.1]);
    time += 0.5 / freq;
    steps.push([time, .1]);
    time += 0.5 / freq;
  }
  sw.write(steps, time + 20 / freq);//.then(next);
}
next();

// sg.generator = function*() {
//   const freq = 110;
//   let time = 0;
//   const samples = 512;
//   while (time < 2) {
//     const delta = 1 / freq;
//     for (let value = -1; value < 1; value += 4/samples) {
//       yield [time, value * .1];
//       time += delta / samples;
//     }
//     for (let value = 1; value > -1; value -= 4/samples) {
//       yield [time, value * .1];
//       time += delta / samples;
//     }
//   }
// };
