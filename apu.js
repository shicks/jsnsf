/**
 * @fileoverview NES APU Emulator.
 */

import BitMask from './bitmask';


export default class Apu {
  constructor(node) {
    /** @private @const {!BufferedAudioNode} */
    this.node_ = node;
    /** @type {number} */
    this.timer = 0;
  }


}


Apu.Pulse = class {
  constructor(/** !Cpu */ cpu) {
    /** @private {!number} */
    this.registers_ = 0;

    /** @type {!Apu.Pulse.Duty} */
    this.duty = Apu.Pulse.Duty[0];

    /** @private {number} */
    this.sequence_ = 0;

    /** @private @const {!Cpu} */ // TODO(sdh): invert dependency?
    this.cpu_ = cpu;


    /** @type {number} */  // 11-bit $4002(low), $4003(high)
    this.period = 

  }


  getRegister(address) {
    return (this.registers_ >>> ((address & 3) << 3)) & 0xff;
  }

  setRegister(address, value) {
    const shift = (address & 3) << 3;
    const mask = 0xff << shift;
    value = (value & 0xff) << shift;
    this.registers_ = (this.registers_ & ~mask) | value;
  }

  set duty(value) { this.registers_ = Apu.Pulse.Bits.DUTY_CYCLE.set(this.registers_, value); }
  get duty() { return Apu.Pulse.Bits.DUTY_CYCLE.get(this.registers_); }

  /** @return {!Apu.Pulse.Duty} */
  duty() {
    return Apu.Pulse.Duty[(this.registers_ >>> 6) & 3];
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

  /** @return {number} */
  frequency() {
    // TODO(sdh): if period < 8 then silenced.
    return this.cpu_.params.clock / (16 * (this.period() + 1));
  }
};


/**
 * The various duty cycles.
 * @enum {!Array<number>}
 */
Apu.Pulse.Duty = {
  /** 12.5% duty */
  0: [0, 1, 0, 0, 0, 0, 0, 0],
  /** 25% duty */
  1: [0, 1, 1, 0, 0, 0, 0, 0],
  /** 50% duty */
  2: [0, 1, 1, 1, 1, 0, 0, 0],
  /** 25% duty negated */
  3: [1, 0, 0, 1, 1, 1, 1, 1],
};


/** @enum {!BitMask} */
Apu.Pulse.Bits = {
  VOLUME_ENVELOPE: new BitMask(0, 4),
  CONSTANT_VOLUME: new BitMask(4, 1),
  ENVELOPE_LOOP: new BitMask(5, 1),
  DUTY_CYCLE: new BitMask(6, 2),
  SWEEP_SHIFT: new BitMask(8, 3),
  SWEEP_NEGATE: new BitMask(11, 1),
  SWEEP_PERIOD: new BitMask(12, 3),
  SWEEP_ENABLED: new BitMask(15, 1),
  SIGNAL_TIMER: new BitMask(16, 11),
  LENGTH_COUNTER: new BitMask(27, 5),
}
