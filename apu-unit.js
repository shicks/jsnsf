import BitMask from './bitmask';

export default class ApuUnit {
  constructor(addresses) {
    /** @private {!number} */
    this.registers_ = 0;

    /** @private @const {!Object<number, !BitMask>} */
    this.addresses_ = addresses;
  }

  get(bitmask) {
    return bitmask.get(this.registers_);
  }

  set(bitmask, value) {
    return bitmask.set(this.registers_, Number(value));
  }

  check(bitmask) {
    return bitmask.check(this.registers_);
  }

  getRegister(address) {
    return this.get(this.addresses_[address]);
  }

  setRegister(address, value) {
    this.set(this.addresses_[address], value);
  }
}

ApuUnit.BYTE_ZERO = new BitMask(0, 8);
ApuUnit.BYTE_ONE = new BitMask(8, 8);
ApuUnit.BYTE_TWO = new BitMask(16, 8);
ApuUnit.BYTE_THREE = new BitMask(24, 8);
