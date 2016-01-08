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
    /** @private {number} Last sample value. */
    this.lastSample_ = 0;
    /** @private {!Array<!Array<number>>} Steps we currently care about. */
    this.steps_ = [];

    // this.kernel_ = new StepKernel([[.5, .5], [.5, .5]]);
    // this.kernel_ = new StepKernel([[1, 0], [0, 1]]);

    /** @private @const {!StepKernel} */
    this.kernel_ = lanczosKernel(5, 32);
  }


  /**
   * @param {!Array<!Array<number>>} steps Array of [time (s), sample]
   *     indicating transition times between steps.
   * @param {number} time "Current" ending time.
   * @return {!Promise}
   */
  write(steps, time) {
    console.log('WRITE: [' + steps + '], ' + time);

    const samples = [];
    const endTime = time - 2 * this.kernel_.radius * this.sampleRate_;
    // Add a final (zero) step.
    if (steps.length == 0 || steps[steps.length - 1][0] < endTime) {

      // TODO - why aren't we outputting anything for empty steps?!?
      //   ....?!?
      //   -- consider separating steps from time, and having
      //      time just output regardless?  but how to know when ready?

      steps = steps.slice();
      steps.push([
        endTime,
        steps.length ? steps[steps.length - 1][1] : this.lastSample_]);
    }
    for (let step of steps) {
      // console.log('step: ' + step[0] + ', ' + step[1]);
      const s = step[0] * this.sampleRate_;
      const v = step[1] - this.lastSample_;
      //console.log('step: [' + s + ', ' + v + ']');

      if (s <= this.sampleIndex_) {
        this.lastSample_ = step[1];
        this.steps_ = [];
        console.log('past value: resetting');
        continue;
      }
      this.lastSample_ += v;

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
    console.log(`Writing ${samples.length} samples`);
    return this.buffer_.write(samples);
  }
}


