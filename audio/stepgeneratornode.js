'use strict';

import BufferedAudioNode from './bufferedaudionode';
import {StepKernel,lanczosKernel} from './kernel';

/** An audio node that takes a generator function as input. */
export default class StepGeneratorNode {
  /**
   * @param {!AudioContext} ac
   * @param {number=} bufferLength
   */
  constructor(ac, bufferLength) {
    /** @private @const {!AudioContext} */
    this.ac_ = ac;
    /** @private @const {number} */
    this.bufferLength_ = bufferLength != null ? bufferLength : 2;

    /** @private @const {!BufferedAudioNode} */
    this.buffer_ = new BufferedAudioNode(ac, this.bufferLength_);

    /** @private {?function()} Generator function. */
    this.generator_ = null;
    /** @private {number} Current sample index. */
    this.sample_ = 0;
    /** @private {number} Last sample index. */
    this.lastSample_ = 0;
    /** @private {number} Last sample value. */
    this.lastValue_ = 0;
    /** @private {!Array<!Array<number>>} Steps we currently care about. */
    this.steps_ = [];

    // this.kernel_ = new StepKernel([[.5, .5], [.5, .5]]);
    // this.kernel_ = new StepKernel([[1, 0], [0, 1]]);

    /** @private @const {!StepKernel} */
    this.kernel_ = lanczosKernel(5, 32);
  }


  /** @param {!AudioNode} destination */
  connect(destination) {
    this.buffer_.connect(destination);
  }


  /** @param {?function()} generator */
  set generator(generator) {
    // TODO - do we need to cancel the previous one?
    generator = generator instanceof Function ? generator() : generator;
    this.generator_ = generator;
    this.sample_ = 0;
    this.lastSample_ = 0;
    this.lastValue_ = 0;
    this.steps_ = [];

    if (generator) this.generate_(generator);
  }

  /**
   * Generates more waveform.
   * @param {?function()} generator The current generator; quits on mismatch.
   * @private
   */
  generate_(generator) {
    // If generator has changed, then do nothing and don't queue another
    if (generator != this.generator_) return;

    const timeLimit = new Date().getTime() + this.buffer_.bufferTime() * 1000;
    const bufferLimit = this.buffer_.bufferLimit();

    // Loop until we either have (1) a full buffer, (2) 10000 steps,
    // (3) exhausted generator, or (4) risk of buffer underrun.
    let stepCount = 0;
    let next;
    const samples = [];
    while (!(next = generator.next()).done) {
      for (let step of next.value) {
        // console.log('step: ' + step[0] + ', ' + step[1]);
        const s = step[0] * this.ac_.sampleRate;
        const v = step[1] - this.lastValue_;
        //console.log('step: [' + s + ', ' + v + ']');

        if (s <= this.sample_) {
          this.lastSample_ = step[1];
          this.lastValue_ = step[1];
          this.steps_ = [];
          console.log('past value: resetting');
          continue;
        }
        this.lastValue_ += v;

        // Compute samples until s - kernel.radius
        const endSample = Math.floor(s - this.kernel_.radius);
        if (endSample > this.sample_) {
          const deltas =
            this.kernel_.convolve(this.sample_, endSample, this.steps_)
          for (let delta of /** @type {!Iterable<number>} */ (deltas)) {
            // TODO(sdh): can we remove the floating-point error drift?!?
            //this.lastSample_ *= 0.9999995;
            samples.push(this.lastSample_ += delta);
          }
          this.sample_ = endSample;

          const done = Math.floor(this.sample_ - this.kernel_.radius);
          let i = 0;
          while (i < this.steps_.length && this.steps_[i][0] < done) i++;
          if (i > 0) this.steps_.splice(0, i);
        }
        // console.log('step push: ' + s + ', ' + v);
        this.steps_.push([s, v]);
      }

      // Check the various ending conditions.
      if (new Date().getTime() >= timeLimit) {
        console.log('time limit exceeded');
        break;
      }
      if (samples.length >= bufferLimit) {
        console.log('buffer limit exceeded');
        break;
      }
      if (++stepCount >= 100000) {
        console.log('step count exceeded');
        break;
      }
      if (next.done) console.log('done!?');
    }
    if (!samples.length) {
      //this.generate_(generator);
      console.log('no samples!');
      return;
    }
    // now write the buffer.
    // console.log('write()', samples);
    this.buffer_.write(samples).then(() => this.generate_(generator));
  }
}


