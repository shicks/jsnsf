/**
 * @fileoverview NES APU Emulator.
 */

import Memory from '../mem';
import Envelope from './envelope';

export default class ApuPulse {
  /**
   * @param {!Memory} mem
   * @param {number} base Base address, either $4000 or $4004.
   */
  constructor(mem, base) {
    /** @private @const {number} */
    this.base_ = base;
    /** @private @const {!Envelope} */
    this.envelope_ = new Envelope(mem, base);
    
    /** @private @const {!Memory.Register<number>} */
    this.dutyCycle_ = mem.int(base, 6, 2);
    /** @private @const {!Memory.Register<number>} */
    this.sweepShift_ = mem.int(base, 8, 3);
    /** @private @const {!Memory.Register<boolean>} */
    this.sweepNegate_ = mem.bool(base, 11);
    /** @private @const {!Memory.Register<number>} */
    this.sweepPeriod_ = mem.int(base, 12, 3);
    /** @private @const {!Memory.Register<boolean>} */
    this.sweepEnabled_ = mem.bool(base, 15);
    /** @private @const {!Memory.Register<number>} */
    this.wavePeriod_ = mem.int(base, 16, 11);

    /** @private {number} */
    this.sweepDivider_ = 0;  // TODO(sdh): use a Divider?
    /** @private {boolean} */
    this.sweepReload_ = false;

    /** @private {boolean} Whether we're silenced due to period overflow. */
    this.silenced_ = false;

    /** @private {number} */
    this.sequence_ = 0;
    /** @private {number} */
    this.sequenceDivider_ = 0;

    /** @private {boolean} Whether the duty is on or not. */
    this.duty_ = false;

    // for (let i = 0; i < 4; i++) {
    //   mem.listen(base + i, () => this.print());
    // }
    mem.listen(base + 1, () => {
      this.sweepReload_ = true;
    });
    mem.listen(base + 2, () => {
      this.duty_ = this.computeDuty_();
    });
    mem.listen(base + 3, () => {
      this.sequence_ = 0;
      this.duty_ = this.computeDuty_();
      // NOTE: envelope also restarted... (elsewhere)
    });
  }

  print() {
    return;
    console.log(`
pulse ${this.base_ - 0x4000}: silenced=${this.silenced_}, duty=${DUTY_CYCLE_LIST[this.dutyCycle_.get()][this.sequence_]}
  dutyCycle=${this.dutyCycle_.get()}
  sweepShift=${this.sweepShift_.get()}
  sweepNegate=${this.sweepNegate_.get()}
  sweepPeriod=${this.sweepPeriod_.get()}
  sweepEnabled=${this.sweepEnabled_.get()}
  wavePeriod=${this.wavePeriod_.get()}` + this.envelope_.print());
  }

  /**
   * @return {boolean} Whether the pulse is currently high.
   */
  computeDuty_() {
    //console.log('pulse ' + (this.base_ - 0x4000) + ': silenced=' + this.silenced_ + ', length=' + this.lengthCounter_.get() + ', period=' + this.wavePeriod_.get() + ', duty=' + DUTY_CYCLE_LIST[this.dutyCycle_.get()][this.sequence_]);
    return !(
        this.silenced_ ||
        this.wavePeriod_.get() < 8 ||
        !DUTY_CYCLE_LIST[this.dutyCycle_.get()][this.sequence_] == 0);
  }

  /**
   * @return {number} The value of the waveform, from 0 to 15 (?)
   */
  volume() {
    return this.duty_ ? this.envelope_.volume() : 0;
  }

  /**
   * Clocks the frame counter.
   * @param {number} quarter An integer from 0 to 3, indicating the quarter.
   */
  clockFrame(quarter) {
    if (this.sweepDivider_ == 0 && this.sweepEnabled_.get()) {
      const target = this.sweepTarget_();
      if (target > 0x7ff || target < 8) {
        this.silenced_ = true;
        this.duty_ = false;
      } else {
        this.wavePeriod_.set(target);
      }
    } else if (this.sweepDivider_ != 0) {
      this.sweepDivider_--;
    }
    if (this.sweepReload_) {
      this.sweepDivider_ = this.sweepPeriod_.get();
      this.sweepReload_ = false;
      this.silenced_ = false;
    }
    this.envelope_.clock(quarter % 2);
    this.duty_ = this.computeDuty_();
  }

  /** Clocks the sequencer. */
  clockSequencer() {
    if (this.sequenceDivider_ == 0) {
      this.sequenceDivider_ = this.wavePeriod_.get();
      this.sequence_ = (this.sequence_ + 1) % 8;
      this.duty_ = this.computeDuty_();
    } else {
      this.sequenceDivider_--;
    }
  }

  sweepTarget_() {
    const period = this.wavePeriod_.get();
    let delta = period >>> this.sweepShift_.get();
    if (this.sweepNegate_.get()) {
      delta = this.base_ == 0x4000 ? ~delta : -delta;
    }
    return period + delta;
  }
};


/**
 * The various duty cycles.
 * @enum {!Array<number>}
 */
const Duty = {
  /** 12.5% duty */
  EIGHTH: [0, 1, 0, 0, 0, 0, 0, 0],
  /** 25% duty */
  QUARTER: [0, 1, 1, 0, 0, 0, 0, 0],
  /** 50% duty */
  HALF: [0, 1, 1, 1, 1, 0, 0, 0],
  /** 25% duty negated */
  THREE_QUARTERS: [1, 0, 0, 1, 1, 1, 1, 1],
};

const DUTY_CYCLE_LIST = [
  Duty.EIGHTH, Duty.QUARTER, Duty.HALF, Duty.THREE_QUARTERS];
