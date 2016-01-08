// A buffered player.

function run(gen) {
  return run_(gen(), void 0);
}

function run_(iter, last) {
  const result = iter.next(last);
  if (result.done) return result.value;
  return result.value.then(x => run_(iter, x));
}


class BufferedAudioNode {
  /**
   * @param {!AudioContext} ac
   * @param {number=} buffer Size of buffer, in seconds.
   */
  constructor(ac, buffer) {
    buffer = buffer != null ? buffer : 2;
    /** @private @const */
    this.fc_ = buffer * ac.sampleRate;
    /** @private @const */
    this.ac_ = ac;
    /** @private @const */
    this.ab_ = ac.createBuffer(2, this.fc_, ac.sampleRate);
    /** @private @const */
    this.c0_ = this.ab_.getChannelData(0);
    /** @private @const */
    this.c1_ = this.ab_.getChannelData(1);
    /** @private {!AudioBufferSourceNode} */
    this.s_ = ac.createBufferSource();
    /** @private {number} */
    this.written_ = 0;
    /** @private {number} */
    this.started_ = 0;
    /** @private {number} */
    this.underrun_ = -1;
    /** @private {?AudioNode} */
    this.destination_ = null;

    this.s_.buffer = this.ab_;
    this.s_.loop = true;
    this.s_.connect(ac.destination);

    this.maxBuffer_ = 0.9;
    this.minBuffer_ = 0.5;
    this.writePromise_ = null;
    this.writeResolver_ = null;

    Object.seal(this);
  }


  get context() { return this.ac_; }
  get numberOfInputs() { return 0; }
  get numberOfOutputs() { return 1; }
  get channelCount() { return 2; }
  get channelCountMode() { return 'explicit'; }
  get channelInterpretation() { return 'speakers'; }


  /** Connects to an output. */
  connect(dest) {
    this.destination_ = dest;
    this.s_.connect(dest);
  }


  /** Disconnects the output. */
  disconnect() {
    this.destination_ = null;
    this.s_.disconnect();
  }


  /** Resets everything to an empty buffer. */
  reset() {
    if (this.writeResolver_) this.writeResolver_();
    this.s_.stop();
    this.s_.disconnect();

    this.s_ = this.ac_.createBufferSource();
    this.written_ = 0;
    this.started_ = 0;
    this.writePromise_ = this.writeResolver_ = null;

    this.s_.buffer = this.ab_;
    this.s_.loop = true;
    this.s_.connect(this.ac_.destination);
  }


  /**
   * @return {number} The current fraction of the buffer filled.
   */
  buffer() {
    let frames = this.written_ + this.started_ - 
        this.ac_.currentTime * this.ac_.sampleRate;
    return Math.max(0, frames) / this.fc_;
  }


  /**
   * @param {!ArrayLike<number>} left
   * @param {!ArrayLike<number>=} right
   * @param {number=} offset
   * @param {!Promise=} promise
   * @return {!Promise} Promise that completes when buffer written.
   */
  write(left, right, offset, promise) {
    right = right || left;
    offset = offset || 0;
    if (this.writePromise_ != promise) { // n.b. single-threaded
      return this.writePromise_ = this.writePromise_.then(
          () => this.write(left, right, offset, promise));
    }
    const max = Math.max(left.length, right.length);
    const remainingBuffer =
        Math.max(0, this.maxBuffer_ - Math.max(0, this.buffer()));
    const end = Math.floor(Math.min(max, offset + remainingBuffer * this.fc_));
    let pos = this.written_ % this.fc_;
    if (offset > end) throw new Error('impossible ' + offset + ' > ' + end);
    if (this.written_ == 0 && offset < end) {
      this.s_.start();
      this.started_ = this.ac_.currentTime * this.ac_.sampleRate;
    }
    for (let i = offset; i < end; i++) {
      this.c0_[pos] = i < left.length ? left[i] : right[i];
      this.c1_[pos] = i < right.length ? right[i] : left[i];
      if (++pos >= this.fc_) pos = 0;
    }
    this.written_ += (end - offset);
    if (end < max) {
      if (!this.writePromise_) {
        this.writePromise_ =
            new Promise(resolve => this.writeResolver_ = resolve);
      }
      const delta = Math.max(this.maxBuffer_ - this.minBuffer_, 0);
      setTimeout(
          () => { this.write(left, right, end, this.writePromise_); },
          this.fc_ / this.ac_.sampleRate * 1000 * delta);
      return this.writePromise_;
    } else if (this.writeResolver_) { // we're done, so resolve
      this.writeResolver_();  // n.b. then() methods happen *after frame*
      this.writeResolver_ = this.writePromise_ = null;
    }
    // No pending operation, so zero out the buffer after the end (underrun?)
    const buf = this.buffer() * this.fc_;  // frames of buffer left
    const empty = this.fc_ - buf;
    for (let i = 0; i < empty; i++) {
      this.c0_[pos] = this.c1_[pos] = 0;
      if (++pos >= this.fc_) pos = 0;
    }
    const written = this.written_;
    // TODO(sdh): cancel previous checks?
    clearTimeout(this.underrun_);
    this.underrun_ = setTimeout(() => {
      if (this.written_ == written) this.reset();
    }, (empty * 0.9 + buf) / this.ac_.sampleRate * 1000);
    return Promise.resolve();
  }
}




class SineWave {
  constructor(pitch, phase, amplitude) {
    this.pitch = pitch || 440;
    this.phase = phase || 0;
    this.amplitude = amplitude || 0.01;
  }

  /** @param {number} t Time in seconds.
      @return {number} Value */
  sample(t) {
    return this.amplitude * Math.sin(t * this.pitch * 2 * Math.PI - this.phase)
  }

  /** @param {number} pitch New pitch, in Hz.
      @param {number} t Time in seconds to match. */
  setPitch(pitch, t) {
    this.phase += t * (pitch - this.pitch) * 2 * Math.PI;
    this.phase %= 2 * Math.PI
    this.pitch = pitch;
  }
}


class SquareWave extends SineWave {
  sample(t) {
    return Math.sign(super.sample(t)) * this.amplitude;
  }
}


class SawtoothWave extends SineWave {
  sample(t) {
    return Math.asin(super.sample(t) / this.amplitude) * this.amplitude;
  }
}


class Noise {
  constructor(amplitude) {
    this.amplitude = amplitude || 0.01;
  }

  sample(t) {
    return this.amplitude * (Math.random() * 2 - 1);
  }
}

class Waves {
  constructor(/** number */ sampleRate) {
    this.waves = [];
    this.sampleRate = sampleRate;
    this.t = 0;
  }

  /** @return {!Float32Array} */
  generate(/** number */ duration) {
    const samples = Math.floor(duration * this.sampleRate);
    const signal = new Float32Array(samples);
    const dt = 1 / this.sampleRate;
    for (let i = 0; i < samples; i++) {
      let total = 0;
      for (let wave of this.waves) {
        total += wave.sample(this.t + i * dt);
      }
      signal[i] = total;
    }
    this.t = this.t + samples * dt;
    return signal;
  }
}


var ac = new AudioContext();
var bp = new BufferedAudioNode(ac);
bp.connect(ac.destination);
var ws = new Waves(ac.sampleRate);

Wave = SawtoothWave;

ws.waves.push(new Wave(440));
ws.waves.push(new Wave(440 * 1.25));
ws.waves.push(new Wave(440 * 1.5));

var all=new Map();
Promise.prototype.toString = function() {
  if (!all.has(this)) {
    all.set(this, all.size)
  }
  return 'Promise ' + all.get(this);
}

run(function*() {
  console.log("A");
  yield bp.write(ws.generate(1));
  ws.waves[1].setPitch(440 * 1.19, 1);
  console.log("Am");
  yield bp.write(ws.generate(1));
  ws.waves[2].setPitch(440 * 1.414, 2);
  console.log("Adim");
  yield bp.write(ws.generate(1));
  ws.waves.push(new Noise());
  console.log("drums");
  yield bp.write(ws.generate(0.2));
  ws.waves[3].amplitude = 0;
  yield bp.write(ws.generate(0.5));
  ws.waves[3].amplitude = 0.01;
  yield bp.write(ws.generate(0.15));
  ws.waves[3].amplitude = 0;
  yield bp.write(ws.generate(0.15));
  ws.waves[3].amplitude = 0.01;
  yield bp.write(ws.generate(0.2));
  ws.waves[3].amplitude = 0;
  yield bp.write(ws.generate(1));
  // ws.waves = [];
  // yield bp.write(ws.generate(1));
  // yield bp.write(ws.generate(1));
  // yield bp.write(ws.generate(1));
});


function go1() {
let t = 0;
run(function*() {
  var data = new Float32Array(2000);
  while (true) {
    for (var i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * .01;
      //data[i] = Math.sin(t) * .01;
      //data[i] = Math.sign(Math.sin(t)) * .01;
      //data[i] = ((t % 2) - 1) * .001;
      t += .05;
    }
    yield bp.write(data);
    //console.log('added 10000 frames to buffer: ' + bp.buffer);
    //if (t * 20 > 500000) {console.log('returning');  return 0;}
  }
});
}
