/** The master clock. */
export default class Clock {
  /** @param {number} speed Clock speed, in Hz.
   * @param {boolean} ntsc */
  constructor(speed, ntsc) {
    /** @private {number} */
    this.tick_ = 1 / speed;
    /** @private {number} */
    this.time_ = 0;
    // /** @private {!Array<{u: (function(): number), d: number}>} */
    // this.units_ = [];
    this.ntsc_ = ntsc;
  }

  get ntsc() {
    return this.ntsc_;
  }

  get cycleLength() {
    return this.tick_;
  }

  get time() {
    return this.time_;
  }

  // /**
  //  * Adds a unit, which is a tick function that returns a delay.
  //  * @param {function(): number} unit
  //  */
  // add(unit) {
  //   this.units_.push({u: unit, d: 1});
  // }

  /** Ticks the clock. */
  tick() {
    // for (let u of this.units_) {
    //   if (--u.d == 0) {
    //     u.d = u.u() || 1;
    //   }
    // }
    this.time_ += this.tick_;
  }

  /** Makes a new NTSC clock. */
  static ntsc() { return new Clock(1789773, true); }

  /** Makes a new PAL clock. */
  static pal() { return new Clock(1662607, false); }
}
