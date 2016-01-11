import Memory from '../mem';
import Envelope from './envelope';

/** Noise generator for NES APU. */
export default class Noise {
  /**
   * @param {!Memory} mem
   */
  constructor(mem) {
    const base = 0x400C;
    /** @private @const {!Envelope} */
    this.envelope_ = new Envelope(mem, base);
    
    /** @private @const {!Memory.Register<number>} */
    this.rate_ = mem.int(base + 2, 0, 4);
    /** @private @const {!Memory.Register<boolean>} */
    this.mode_ = mem.int(base + 2, 7);

    /** @private {number} */
    this.shiftDivider_ = 0;
    /** @private {number} */
    this.shiftRegister_ = 1;

    /** @private {boolean} */
    this.duty_ = false;
  }

//   print() {
//     return;
//     console.log(`
// pulse ${this.base_ - 0x4000}: silenced=${this.silenced_}, duty=${DUTY_CYCLE_LIST[this.dutyCycle_.get()][this.sequence_]}
//   dutyCycle=${this.dutyCycle_.get()}
//   sweepShift=${this.sweepShift_.get()}
//   sweepNegate=${this.sweepNegate_.get()}
//   sweepPeriod=${this.sweepPeriod_.get()}
//   sweepEnabled=${this.sweepEnabled_.get()}
//   wavePeriod=${this.wavePeriod_.get()}` + this.envelope_.print());
//   }

  /**
   * @return {number} The value of the waveform, from 0 to 15 (?)
   */
  volume() {
    //console.log('pulse ' + (this.base_ - 0x4000) + ': silenced=' + this.silenced_ + ', length=' + this.lengthCounter_.get() + ', period=' + this.wavePeriod_.get() + ', duty=' + DUTY_CYCLE_LIST[this.dutyCycle_.get()][this.sequence_]);

    return this.duty_ ? this.envelope_.volume() : 0;
  }

  /**
   * Clocks the frame counter.
   * @param {number} quarter An integer from 0 to 3, indicating the quarter.
   */
  clockFrame(quarter) {
    this.envelope_.clock(quarter % 2);
  }

  /** Clocks the sequencer. */
  clockSequencer() {
    if (this.shiftDivider_ == 0) {
      const feedback =
          (this.shiftRegister_ & 1) ^
          ((this.shiftRegister_ >>> (this.mode_.get() ? 6 : 1)) & 1);
      this.shiftRegister_ = (this.shiftRegister_ >>> 1) | (feedback << 14);
      this.duty_ = !!(this.shiftRegister_ & 1);
      this.shiftDivider_ = TIMER_PERIOD_NTSC[this.rate_.get()];
    } else {
      this.shiftDivider_--;
    }
  }
};


const TIMER_PERIOD_NTSC = [
    4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068];
const TIMER_PERIOD_PAL = [
    4, 8, 14, 30, 60, 88, 118, 148, 188, 236, 354, 472, 708,  944, 1890, 3778];
