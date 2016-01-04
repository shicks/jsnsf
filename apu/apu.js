import Pulse from './pulse';

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


export class Apu {
  constructor(mem, buffer) {
    this.mem_ = mem;
    this.
  }

}
