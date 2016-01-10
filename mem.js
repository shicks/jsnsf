/** Manages memory, including various views and listeners. */
export default class Memory {
  constructor() {
    /** @private @const {!Uint8Array} */
    this.data8_ = new Uint8Array(0x10000);
    /** @private @const {!Object<number, !Array<function()>>} */
    this.callbacks_ = {};
    /** @private @const {!Object<number, !Memory.Register>} */
    this.registers_ = {};
  }


  zero() {
    this.data8_.fill(0);
    // TODO - clear callbacks?
  }


  /**
   * @param {number} addr
   * @return {number}
   */
  get(addr) {
    return this.data8_[addr];
    const reg = this.registers_[addr];
    return reg ? reg.get() : this.data8_[addr];
  }


  /**
   * @param {number} addr
   * @param {number=} opt_wrap Page size for wrapping.
   * @return {number}
   */
  getWord(addr, opt_wrap) {
    let next = (addr + 1) & 0xffff;
    if (opt_wrap) {
      next = (next & opt_wrap) | (addr & ~opt_wrap);
    }
    return this.data8_[addr] | (this.data8_[next] << 8);
    return this.get(addr) | (this.get(next) << 8);
  }


  /**
   * @param {number} addr
   * @param {number} value
   */
  set(addr, value) {
    if (addr & 0xfff0 == 0x4000) {
      console.log(`($${addr.toString(16)}) <- $${value.toString(16)}`);
    }
    // const reg = this.registers_[addr];
    // if (reg) reg.set(value);
    this.data8_[addr] = value;
    this.call_(addr, value);
  }


  /**
   * @param {number} addr
   * @param {number} value
   */
  setWord(addr, value) {
    this.set(addr, value & 0xff);
    this.set(addr + 1, value >>> 8);
  }


  /**
   * Loads a 4k chunk.
   * @param {!Uint8Array} data A 4k buffer.
   * @param {number} offset The offset to start loading.
   */
  load(data, offset) {
    this.data8_.set(data, offset);
  }


  /**
   * @param {number} addr
   * @param {number} value
   * @private
   */
  call_(addr, value) {
    const cbs = this.callbacks_[addr];
    if (cbs) {
      for (let cb of cbs) {
        cb(value);
      }
    }
  }


  /**
   * @param {number} addr
   * @param {function(number)} callback
   */
  listen(addr, callback) {
    (this.callbacks_[addr] = this.callbacks_[addr] || []).push(callback);
  }


  /**
   * @param {number} addr
   * @param {!Memory.Register} register
   */
  register(addr, register) {
    this.registers_[addr] = register;
  }


  /**
   * @param {number} addr
   * @param {number} shift
   * @param {number} length
   * @return {!Memory.Register<number>}
   */
  int(addr, shift, length) {
    if (shift > 8) {
      addr += shift >>> 3;
      shift = shift & 3;
    }
    if (shift + length > 16) throw new Error('two bytes max');
    const self = this;
    const mask = makeMask(length) << shift;
    const getWord = mask > 0xff ? this.getWord : this.get;
    const setWord = mask > 0xff ? this.setWord : this.set;
    return {
      get() {
        return (getWord.call(self, addr) & mask) >>> shift;
      },
      set(value) {
        const word = getWord.call(self, addr);
        setWord.call((word & ~mask) | ((value << shift) & mask));
      },
    };
  }


  /**
   * @param {number} addr
   * @param {number} bit
   * @return {!Memory.Register<boolean>}
   */
  bool(addr, bit) {
    const mask = 1 << bit;
    const self = this;
    return {
      get() {
        return !!(self.get(addr) & mask);
      },
      set(value) {
        if (value) self.set(addr, self.get(addr) | mask);
        else self.set(addr, self.get(addr) & ~mask);
      },
    };
  }
}


/**
 * @param {number} length
 * @return {number}
 */
function makeMask(length) {
  let mask = 0;
  while (length--) mask = (mask << 1) | 1;
  return mask;
}


/**
 * @record
 * @template T
 */
Memory.Register = class {
  /** @return {T} */
  get() {}
  /** @param {T} value */
  set(value) {}
};
