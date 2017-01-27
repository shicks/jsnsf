import Clock from '../clock';
import Memory from '../mem';
import Noise from './noise';
import Pulse from './pulse';
import Triangle from './triangle';

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


// TODO - log changes to APU state
//   - but we should bundle them such that if several registers
//     change within a short period of time, then only a single
//     line is logged (provided the same one doesn't change
//     multiple times)
//   - consider allowing registers to be named and then having
//     the MMU do this?


class Enabler {
  constructor(id) {
    const element = document.getElementById(id);
    this.enabled = true;
    if (element) {
      element.addEventListener('click', () => {
        this.enabled = element.checked;
        console.log(id + ' => ' + this.enabled);
      });
    }
  }  
}

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
    this.triangle_ = new Triangle(mem);
    this.noise_ = new Noise(mem);
    this.steps_ = [];
    this.last_ = 0;
    this.wait_ = 2;

    this.frameCounter_ = 0;

    this.pulse1Enabled = new Enabler('pulse1_enabled');
    this.pulse2Enabled = new Enabler('pulse2_enabled');
    this.triangleEnabled = new Enabler('triangle_enabled');
    this.noiseEnabled = new Enabler('noise_enabled');


    // TODO - add a callback when volume changes, so we don't
    // need to keep recomputing the mixer every single time!

    // mem.register(0x4015, {
    //   get: this.getStatus.bind(this),
    //   set: this.setStatus.bind(this),
    // });

    // this.status_ = 0;
  }

  // getStatus() {
  //   // console.log('get status');
  //   return this.status_;
  // }

  // setStatus(value) {
  //   // console.log('set status: ' + value);
  //   this.status_ = value;
  // }

  clock() {
    if (++this.frameCounter_ == FRAME_LIMIT) this.frameCounter_ = 0;
    const quarter = FRAME_CYCLES[this.frameCounter_];
    if (quarter != null) {
      // TODO - distinguish half from quarter frames.
      this.pulse1_.clockFrame();
      this.pulse2_.clockFrame();
      this.triangle_.clockFrame();
      this.noise_.clockFrame();
    }

    this.triangle_.clockSequencer(); // clocks every cycle
    if (!--this.wait_) {
      this.pulse1_.clockSequencer();
      this.pulse2_.clockSequencer();
      this.noise_.clockSequencer();
      this.wait_ = 2;
    }

    const volume = this.volume();
    if (volume != this.last_) {
      this.steps_.push([this.clock_.time, volume]);
      this.last_ = volume;
    }
  }

  // clockFrame() {
  //   this.pulse1_.clockFrame();
  //   this.pulse2_.clockFrame();
  //   this.noise_.clockFrame();
  // }

  steps() {
    const steps = this.steps_;
    const volume = this.volume();
    steps.push([this.clock_.time, volume]); // always return at least one.
    this.steps_ = [[this.clock_.time, volume]];
    return steps;
  }

  volume() {
    const pulse1 = this.pulse1Enabled.enabled ? this.pulse1_.volume() : 0;
    const pulse2 = this.pulse2Enabled.enabled ? this.pulse2_.volume() : 0;
    const pulseOut = (pulse1 || pulse2) &&
        95.88 / (8128 / (pulse1 + pulse2) + 100);

    const triangle = this.triangleEnabled.enabled ? this.triangle_.volume() : 0;
    const noise = this.noiseEnabled.enabled ? this.noise_.volume() : 0;
    const dmc = 0; // this.dmc_.volume();
    const tndOut = (triangle || noise || dmc) &&
        159.79 / (1 / (triangle / 8227 + noise / 12241 + dmc / 22638) + 100);

    //console.log('volume=' + (pulseOut + tndOut));
    return pulseOut + tndOut;

    // TODO(sdh): consider using the linear approximation and adjusting
    // all the APU units to output waves centered at zero.


    // TODO - consider giving each unit a property for
    // "# of cycles until volume changes" (provided
    // memory doesn't change).  Then fast-forward without
    // recalculating anything - might decrease the
    // number of reads.

  }
}

const FRAME_CYCLES = {[3728.5 * 2]: 0,
                      [7456.5 * 2]: 1,
                      [11185.5 * 2]: 2,
                      [14914.5 * 2]: 3};
const FRAME_LIMIT = 14915 * 2;
