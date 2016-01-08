import Pulse from './pulse';
import Clock from '../clock';
import Memory from '../mem';

// APU has a clock speed of ~900 kHz, and it potentially samples
// a point at every time (though most of the time nothing changes).
//
// We output at 44.1 kHz, which is quite different and may involve
// arbitrary fractional delays for the steps.  We therefore need to
// resample.  Ideally we could precompute heaviside functions at
// arbitrary fractional delays and then pick the closest...?
//
// cf. Lanczos sampling with sinc(x)=sin(pi*x)/(pi*x) functions.


// NOTE: 32-sample triangle waves are muddy below about 1380 Hz.
// (and likewise, 64-sample below 690 Hz, 128-sample below 345 Hz,
// and 256-sample below 170 Hz).  As such, we may consider adding
// additional samples for longer periods, or else possibly even
// using a fixed period and repurposing the period register as a
// delta register (though we'd need to be careful about what happens
// when it changes!)  Then again, the muddier versions are actually
// more accurate - so let's try both and compare.


// NOTE: Frame counter should always be assumed to operate in
// 4-step mode.  We never need to worry about IRQ.


export default class Apu {
  /**
   * @param {!Memory} mem
   * @param {!Clock} clock
   */
  constructor(mem, clock) {
    this.mem_ = mem;
    this.clock_ = clock;
    this.pulse1_ = new Pulse(mem, 0x4000);
    this.pulse2_ = new Pulse(mem, 0x4004);
    this.steps_ = [];
    this.last_ = 0;
    this.wait_ = 2;

    this.frameCounter_ = 0;

    mem.register(0x4015, {
      get: this.getStatus.bind(this),
      set: this.setStatus.bind(this),
    });

    this.status_ = 0;
  }

  getStatus() {
    // console.log('get status');
    return this.status_;;
  }

  setStatus(value) {
    // console.log('set status: ' + value);
    this.status_ = value;
  }

  clock() {
    if (++this.frameCounter_ == FRAME_LIMIT) this.frameCounter_ = 0;
    const quarter = FRAME_CYCLES.indexOf(this.frameCounter_);
    if (quarter >= 0) {
      // TODO - distinguish half from quarter frames.
      this.pulse1_.clockFrame();
      this.pulse2_.clockFrame();
    }

    if (--this.wait_) return;

    this.pulse1_.clockSequencer();
    this.pulse2_.clockSequencer();

    const pulse1 = this.pulse1_.volume();
    const pulse2 = this.pulse2_.volume();
    const pulseOut = (pulse1 || pulse2) &&
        95.88 / (8128 / (pulse1 + pulse2) + 100);

    const triangle = 0; // this.triangle_.volume();
    const noise = 0; // this.noise_.volume();
    const dmc = 0; // this.dmc_.volume();
    const tndOut = (triangle || noise || dmc) &&
        159.79 / (1 / (triangle / 8227 + noise / 12241 + dmc / 22638) + 100);

    const volume = pulseOut + tndOut;

    if (volume != this.last_) {
      this.steps_.push([this.clock_.time, volume]);
      this.last_ = volume;
    }

    this.wait_ = 2;
  }

  clockFrame() {
    this.pulse1_.clockFrame();
    this.pulse2_.clockFrame();
  }

  steps() {
    const steps = this.steps_;
    this.steps_ = [];
    return steps;
  }
}

const FRAME_CYCLES = [3728.5 * 2, 7456.5 * 2, 11185.5 * 2, 14914.5 * 2];
const FRAME_LIMIT = 14915 * 2;