var ac = new AudioContext();

var g = ac.createGain();
g.gain.value = 0.1;
g.connect(ac.destination);

// Square wave
var o = ac.createOscillator();
o.type = 'square';
o.frequency.value = 440;
o.connect(g);
o.start();

// White noise
var fc = ac.sampleRate*2;  // count frames for 2 seconds
var ab = ac.createBuffer(2, fc, ac.sampleRate);
for (var c = 0; c < 2; c++) {
  // note: reverse order of for loop, otherwise
  // get weird superimposition when one is done and other is not
  var b = ab.getChannelData(c);
  for (var i = 0; i < fc; i++) {
    b[i] = Math.random() * 2 - 1;
  }
}
var s = ac.createBufferSource();
s.buffer = ab;
s.loop = true;
s.connect(g);
s.start();

// TODO - separate gains..
// TODO - noise period?!?


// ... or use <audio> element and writeAudio()
// and generate samples...?


// --- or double buffer - have a sample that's 2 seconds long
// and update the half that isn't playing...?
