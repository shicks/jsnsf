import Memory from '../mem';

/** Envelope generator (TODO - inherit from LengthCounter?). */
export default class Envelope {
  /**
   * @param {!Memory} mem Memory unit.
   * @param {number} base Base address for the envelope.
   */
  constructor(mem, base) {
    /** @private @const {!Memory.Register<number>} */
    this.volumeEnvelope_ = mem.int(base, 0, 4);
    /** @private @const {!Memory.Register<boolean>} */
    this.constantVolume_ = mem.bool(base, 4);
    /** @private @const {!Memory.Register<boolean>} */
    this.loopFlag_ = mem.bool(base, 5); // TODO(sdh): also: length counter halt?
    // /** @private @const {!Memory.Register<number>} */
    // this.lengthCounter_ = mem.int(base + 3, 3, 5);

    mem.listen(base + 3, () => {
      // console.log('envelope start: ' + mem.get(base + 3));
      // window.msg = true;
      this.start_ = true;
    });

    /** @private {boolean} */
    this.start_ = false;
    /** @private {number} */
    this.divider_ = 0;
    /** @private {number} */
    this.counter_ = 0;
  }

  print() {
    return `
  volumeEnvelope=${this.volumeEnvelope_.get()}
  constantVolume=${this.constantVolume_.get()}
  loopFlag=${this.loopFlag_.get()}`;
  }

  /** Clocked by the frame counter. */
  clock() {
    if (!this.start_) {
      this.clockDivider_();
    } else {
      this.start_ = false;
      this.counter_ = 15;
      this.reloadDivider_();
    }
  }

  clockDivider_() {
    if (this.divider_ == 0) {
      // When the divider finishes, the counter is clocked
      if (this.counter_ == 0) {
        if (this.loopFlag_.get()) this.counter_ = 15;
      } else {
        this.counter_--;
      }
      this.reloadDivider_();
    } else {
      this.divider_--;
    }
  }

  reloadDivider_() {
    this.divider_ = this.volumeEnvelope_.get();
  }

  /** Returns the volume. */
  volume() {
    if (this.constantVolume_.get()) {
      //console.log('constant volume: ' + this.volumeEnvelope_.get());
      return this.volumeEnvelope_.get();
    } else {
      //console.log('counter: ' + this.counter_);
      return this.counter_;
    }
  }
}
