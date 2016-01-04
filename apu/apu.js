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

export class Apu {
  constructor(mem, buffer) {
    this.mem_ = mem;
    this.
  }

}
