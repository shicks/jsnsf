/**
 * @fileoverview NES APU Emulator.
 */

import Memory from '../mem';
import Divider from '../divider';
import Envelope from './Envelope';

export default class ApuPulse extends ApuUnit {
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
    /** @private @const {!Memory.Register<number>} */
    this.lengthCounter_ = mem.int(base, 27, 5);

    /** @private {number} */
    this.sweepDivider_ = 0;  // TODO(sdh): use a Divider?
    /** @private {boolean} */
    this.sweepReload_ = false;

    this.silenced_ = false;

    /** @private {number} */
    this.sequence_ = 0;
    /** @private {number} */
    this.sequenceDivider_ = 0;

    mem.listen(base + 1, () => { this.sweepReload_ = true; });
  }

  /**
   * @return {number} The value of the waveform, from 0 to 15 (?)
   */
  volume() {
    if (this.silenced_ ||
        this.lengthCounter_.get() == 0 ||
        this.wavePeriod_.get() < 8 ||
        DUTY_CYCLE_LIST[this.dutyCycle_.get()][this.sequence_] == 0) {
      return 0;
    }
    return this.envelope_.volume();
  }

  /** Clocks the frame counter. */
  clockFrame() {
    if (this.sweepDivider_ == 0 && this.sweepEnabled_.get()) {
      const target = this.sweepTarget_();
      if (target > 0x7ff || target < 8) {
        this.silenced_ = true;
      } else {
        this.wavePeriod_.set(target);
      }
    } else if (this.sweepDivider_ != 0) {
      this.sweepDivider_--;
    }
    if (this.sweepReload_) {
      this.sweepDivider_ = this.sweepPeriod_.get();
      this.sweepReload_ = false;
    }
    this.envelope_.clock();
  }

  /** Clocks the sequencer. */
  clockSequencer() {
    if (this.sequenceDivider_ == 0) {
      this.sequenceDivider_ = this.wavePeriod_.get();
      this.sequence_ = (this.sequence_ + 1) % 8;
    }
  }

  /** Clocks the waveform generator. */
  clockWaveform_() {
    
  }

  sweepTarget_() {
    const period = this.wavePeriod_.get();
    let delta = period >>> this.sweepShift_.get();
    if (this.sweepNegate_.get()) {
      delta = this.base_ == 0x4000 ? ~delta : -delta;
    }
    return period + delta;
  }


  /** @return {!Duty} */
  duty() {
    return DUTY_CYCLE_LIST[this.get(DUTY_CYCLE)];
  }



  /** @return {boolean} */
  envelopeLoop() {
    return !!(this.registers & 0x20);
  }

  /** @return {boolean} */
  constantVolume() {
    return !!(this.registers & 0x10);
  }

  /** @return {number} */
  volumeEnvelope() {
    return !!(this.registers & 0xf);
  }

  /** @return {boolean} */
  sweepEnabled() {
    return !!(this.registers & 0x8000);
  }

  /** @return {number} */
  sweepPeriod() {
    return (this.registers >>> 12) & 7;
  }

  /** @return {boolean} */
  sweepNegate() {
    return !!(this.registers & 0x800);
  }

  /** @return {number} */
  sweepShift() {
    return (this.registers >>> 8) & 7;
  }

  /** @return {number} */
  period() {
    return (this.registers >>> 16) & 0x7ff;
  }

  /** @return {number} */
  lengthCounter() {
    return (this.registers >>> 27) & 0x1f;
  }



  // set duty(value) { this.registers_ = ApuPulse.Bits.DUTY_CYCLE.set(this.registers_, value); }
  // get duty() { return ApuPulse.Bits.DUTY_CYCLE.get(this.registers_); }



  /** @return {number} */
  frequency() {
    // TODO(sdh): if period < 8 then silenced.
    return this.cpu_.params.clock / (16 * WAVE_PERIOD.get(this.register_) + 1));
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

const VOLUME_ENVELOPE = new BitMask(0, 4);
const CONSTANT_VOLUME = new BitMask(4, 1);
const ENVELOPE_LOOP = new BitMask(5, 1);
const DUTY_CYCLE = new BitMask(6, 2);
const SWEEP_SHIFT = new BitMask(8, 3);
const SWEEP_NEGATE = new BitMask(11, 1);
const SWEEP_PERIOD = new BitMask(12, 3);
const SWEEP_ENABLED = new BitMask(15, 1);
const WAVE_PERIOD = new BitMask(16, 11);
const LENGTH_COUNTER = new BitMask(27, 5);
