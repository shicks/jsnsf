/**
 * A bit mask, enables getting and setting.
 */
export default class BitMask {
  /**
   * @param {number} start
   * @param {number} length
   */
  constructor(start, length) {
    let mask = 0;
    while (length--) mask = (mask | 1) << 1;
    this.shift = start;
    this.mask = mask << start;
  }


  /**
   * @param {number} full
   * @return {number}
   */
  get(full) {
    return (full & this.mask) >>> this.shift;
  }


  /**
   * @param {number} full
   * @return {boolean}
   */
  check(full) {
    return !!(full & this.mask);
  }


  /**
   * @param {number} full
   * @param {number} word
   * @return {number}
   */
  set(full, word) {
    word = (word << this.shift) & this.mask;
    return (full & ~this.mask) | word;
  }
}
