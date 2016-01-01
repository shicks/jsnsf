/**
 * @fileoverview NES APU Emulator.
 */

import BitMask from './bitmask';


export default class ApuPulse extends ApuUnit {
  constructor(/** !Cpu */ cpu) {
    super({
      0x4000: ApuUnit.BYTE_ZERO,
      0x4001: ApuUnit.BYTE_ONE,
      0x4002: ApuUnit.BYTE_TWO,
      0x4003: ApuUnit.BYTE_THREE,
      0x4004: ApuUnit.BYTE_ZERO,
      0x4005: ApuUnit.BYTE_ONE,
      0x4006: ApuUnit.BYTE_TWO,
      0x4007: ApuUnit.BYTE_THREE,
    });

    /** @type {!ApuPulse.Duty} */
    this.duty = ApuPulse.Duty[0];

    /** @private {number} */
    this.sequence_ = 0;

    /** @private @const {!Cpu} */ // TODO(sdh): invert dependency?
    this.cpu_ = cpu;
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
