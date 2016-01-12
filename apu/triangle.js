import Memory from '../mem';
import LengthCounter from './lengthcounter';

// TODO - this pops a lot - can we smooth it out?!?

export default class Triangle {
  /**
   * @param {!Memory} mem
   */
  constructor(mem) {
    const base = 0x4008;

    /** @private @const {!Memory.Register<number>} */
    this.linearCounterReloadValue_ = mem.int(0x4008, 0, 7);
    /** @private @const {!Memory.Register<boolean>} */
    this.control_ = mem.bool(0x4008, 7);
    /** @private @const {!Memory.Register<number>} */
    this.sequenceTimerPeriod_ = mem.int(0x400A, 0, 11);

    /** @private {number} */
    this.volume_ = 0;

    /** @private {!LengthCounter} */
    this.lengthCounter_ = new LengthCounter(mem, base);

    /** @private {boolean} */
    this.linearCounterReloadFlag_ = false;
    /** @private {number} */
    this.linearCounter_ = 0;

    /** @private {number} */
    this.sequenceTimer_ = 0;
    /** @private {number} */
    this.sequence_ = 0;


    for (let i = 0x4008; i < 0x400C; i++) mem.listen(i, () => this.print());

    mem.listen(0x400B, () => this.linearCounterReloadFlag_ = true);
    this.lengthCounter_.onDisable(() => this.volume_ = 0);
  }

  print() {
    return;
    console.log(`TRIANGLE
linear ${this.linearCounter_} of ${this.linearCounterReloadValue_.get()}
control ${this.control_.get()}
sequence ${this.sequenceTimer_} of ${this.sequenceTimerPeriod_.get()} => ${this.sequence_}
length ${this.lengthCounter_.enabled_.get()} ${this.lengthCounter_.counter_} ${this.lengthCounter_.reload_.get()}
volume ${this.volume_}`);
  }

  /**
   * @return {number} The value of the waveform, from 0 to 15 (?)
   */
  volume() {
    return this.volume_;
  }

  /**
   * @return {number} Computes the volume.
   */
  computeVolume_() {
    const v = this.lengthCounter_.enabled() && this.linearCounter_ > 0 ?
        WAVEFORM[this.sequence_] : 0;
    //if (v == 15) console.log('TRIANGLE 15');
    return v;
  }

  /**
   * Clocks the frame counter.
   * @param {number} quarter An integer from 0 to 3, indicating the quarter.
   */
  clockFrame(quarter) {
    if (this.linearCounterReloadFlag_) {
      this.linearCounter_ = this.linearCounterReloadValue_.get();
    } else if (this.linearCounter_ > 0) {
      this.linearCounter_--;
      if (!this.linearCounter_) this.volume_ = 0;
    }

    if (this.control_.get()) {
      this.linearCounterReloadFlag_ = false;
    }

    if (quarter % 2 && !this.control_.get()) {
      this.lengthCounter_.clock();
    }
  }

  /** Clocks the sequencer. */
  clockSequencer() {
    if (this.sequenceTimer_ == 0) {
      this.sequence_ = (this.sequence_ + 1) % 32;
      this.sequenceTimer_ = this.sequenceTimerPeriod_.get();
      this.volume_ = this.computeVolume_();
    } else {
      this.sequenceTimer_--;
    }
  }
};


const WAVEFORM = [15, 14, 13, 12, 11, 10, 9, 8, 7, 6,  5,  4,  3,  2,  1,  0,
                   0,  1,  2,  3,  4,  5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
