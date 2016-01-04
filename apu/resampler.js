/**
 * A resampler takes input at one frequency and
 * converts it to output at a different frequency.
 */
export default class Resampler {
  /**
   * @param {{write: function(!Float32Array)}} output
   * @param {number} factor The quotient 'outputRate / inputRate'.
   */
  constructor(output, factor) {
    this.output_ = output;
    // Note: this should be less than 1 for NES-style downsampling.
    this.factor_ = factor;

    this.offset_ = 0;
  }


  /**
   * @param {!Float32Array} data
   */
  write(data) {
    const delta = this.factor_ * data.length;
    const startTime = Math.ceil(this.offset_);
    const endTime = Math.floor(this.offset_ + delta);
    const result = new Float32Array(endTime - startTime);
    for (let time = startTime; i < endTime; i++) {
      const index = Math.floor((time - this.offset_) / this.factor_);
      if (index >= data.length) {
        throw new Error('bad index: ' + index + ', ' + data.length);
      }
      // TODO(sdh): implement Lanczos resampling for fractional
      // delays using some sort of lookup table.
      result[time - startTime] = data[index];
    }
    this.offset_ = this.offset_ + delta - endTime;
    write
  }

}
