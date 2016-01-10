'use strict';

import BufferedAudioNode from './bufferedaudionode';
import {StepKernel,lanczosKernel} from './kernel';

/** A class to write steps to a buffer. */
export default class StepBufferWriter {
  /**
   * @param {!BufferedAudioNode} buffer
   */
  constructor(buffer) {
    /** @private @const {!BufferedAudioNode} */
    this.buffer_ = buffer;
    /** @private @const {number} */
    this.sampleRate_ = buffer.context.sampleRate;

    /** @private {number} Current sample index. */
    this.sampleIndex_ = 0;
    /** @private {number} Last sample value read from steps. */
    this.lastStep_ = 0;
    /** @private {number} Last sample value written to buffer. */
    this.lastSample_ = 0;
    /** @private {!Array<!Array<number>>} Steps we currently care about. */
    this.steps_ = [];

    // this.kernel_ = new StepKernel([[.5, .5], [.5, .5]]);
    this.kernel_ = new StepKernel([[1, 0], [0, 1]]);

    /** @private @const {!StepKernel} */
    //this.kernel_ = lanczosKernel(5, 32);
  }


  /**
   * @param {!Array<!Array<number>>} steps Array of [time (s), sample]
   *     indicating transition times between steps.
   * @return {!Promise}
   */
  write(steps) {

    // TODO(sdh): consider having the input always start at zero?

    //console.log('WRITE: [' + steps.map(s=>`[${s[0]},${s[1]}]`) + ']');
    if (!steps.length) return new Promise(resolve => setTimeout(resolve, 50));

    const samples = [];

    for (let step of steps) {
      // console.log('step: ' + step[0] + ', ' + step[1]);
      const s = step[0] * this.sampleRate_;
      const v = step[1] - this.lastStep_;
      this.lastStep_ = step[1];
      //console.log('step: [' + s + ', ' + v + ']');

      // console.log(`step: ${step} s=${s} v=${v} sampleIndex=${this.sampleIndex_} endSample=${Math.floor(s - this.kernel_.radius)}`);

      if (s <= this.sampleIndex_) {
        this.lastStep_ = this.lastSample_ = step[1];
        this.steps_ = [];
        console.log('past value: resetting');
        continue;
      }
      //this.lastSample_ += v;

      // Compute samples until s - kernel.radius
      const endSample = Math.floor(s - this.kernel_.radius);
      if (endSample > this.sampleIndex_) {
        const deltas =
            this.kernel_.convolve(this.sampleIndex_, endSample, this.steps_)
        for (let delta of /** @type {!Iterable<number>} */ (deltas)) {
          // TODO(sdh): can we remove the floating-point error drift?!?
          //this.lastSample_ *= 0.9999995;
          samples.push(this.lastSample_ += delta);
        }
        this.sampleIndex_ = endSample;

        const done = Math.floor(this.sampleIndex_ - this.kernel_.radius);
        let i = 0;
        while (i < this.steps_.length && this.steps_[i][0] < done) i++;
        if (i > 0) this.steps_.splice(0, i);
      }
      // console.log('step push: ' + s + ', ' + v);
      this.steps_.push([s, v]);
    }
    // now write the buffer.
    //console.log(`Writing ${samples.length} samples`, samples);
    return this.buffer_.write(samples);
  }
}


