import {Complex,cisi} from '../util/math';
import {nub} from '../util/util';

/** A convolution kernel. */
export class StepKernel {
  /**
   * @param {!Array<!Array<number>>} data Array of convolution kernels,
   *     expressed as differences.  The outer array contains evenly-spaced
   *     delays, and the inner array is a list of differences, one for
   *     each following sample.  The opposite array will be used for the
   *     samples preceding the step.
   */
  constructor(data) {
    /** @private @const {!Array<!Array<number>>} */
    this.data_ = data;
    const sizes = nub(data.map(x => x.length));
    if (sizes.length != 1) throw new Error('non-rectangular array');
    /** @private @const {number} */
    this.radius_ = sizes[0] / 2;
    /** @private @const {number} */
    this.phases_ = 2 * (data.length - 1);
  }

  /** @return {number} Required distance from a sample. */
  get radius() {
    return this.radius_;
  }

  /**
   * Note: caller should keep track of radius and when to stop passing.
   * @param {number} startTime Integer sample index.
   * @param {number} endTime Integer sample index.
   * @param {!Array<!Array<number>>} steps List of [time, delta] pairs,
   *     where times may be fractional sample indices.
   * @return {!Float32Array} Deltas.
   */
  convolve(startTime, endTime, steps) {
    const out = new Float32Array(endTime - startTime);
    for (let step of steps) {
      const delta = step[1];
      const center = Math.round(step[0]);
      const phase = Math.round((step[0] - center) * this.phases_);
      let kernel = this.data_[Math.abs(phase)];
      if (phase < 0) {
        kernel = kernel.slice().reverse();
      }
      // ex: center=5, startTime=2, kernel.length=4 (3-4, 4-5, 5-6, 6-7)
      //      --> startIndex = 5 - 2 - (4/2) = 1 = second diff
      const startIndex = center - startTime - kernel.length / 2;
      for (let i = Math.max(0, -startIndex);
           i < Math.min(kernel.length, out.length - startIndex); i++) {
        out[startIndex + i] += kernel[i] * delta;
      }
    }
    return out;
  }
}


/**
 * @param {number} radius Integer radius of kernel.  Given a step at
 *     time t, all points between [t-r, t+r] are affected.
 * @param {number} phases Number of different phases to compute.
 * @return {!StepKernel}
 */
export function lanczosKernel(radius, phases) {
  radius = radius >>> 0;  // unsigned int
  phases -= phases % 2;  // must be even

  const a = 2 * radius - 1;  // Note: guarantees a is always odd.
  const PI = Math.PI;
  function f(x) {
    if (x == 0) return 0;
    if (x >= a) return 0.5;
    if (x <= -a) return -0.5;
    const m1 = (a - 1) * PI * x;
    const p1 = (a + 1) * PI * x;
    return (-m1 * cisi(m1 / a).im + p1 * cisi(p1 / a).im -
            2 * a * Math.sin(PI * x) * Math.sin(PI * x / a)) /
        (2 * PI * PI * x);
  }
  const norm = f(a) - f(-a);
  function diff(xs) {
    const diffs = new Array(xs.length - 1);
    for (let i = 1; i < xs.length; i++) {
      diffs[i - 1] = xs[i] - xs[i - 1];
    }
    return diffs;
  }

  const fracs = [];  // [0, 2/phases, ..., 1], negative fracs inferred
  for (let i = 0; i <= phases; i += 2) fracs.push(i / phases /* - 1*/);
  const samples = [];  // [-a - 1, -a + 1, ..., a + 1]
  for (let i = -a - 1; i <= a + 1; i += 2) samples.push(i);
  // 2d array of times [[-5, -3, ..., 5], [-4.75, -2.75, ..., 5.25], ...
  const times = fracs.map(frac => samples.map(base => base - frac));

  // console.log('times([' + times.map(ts=>'['+ts.join(',')+']').join(', ') + '])');

  const values = times.map(ts => ts.map(t => f(t) / norm + 0.5));
  return new StepKernel(values.map(diff));

  // TODO(sdh): There are a few cases where floating-point roundoff
  // causes the sum to be 1-ε instead of 1.  These *should* cancel
  // out in the long run, but we could also take one of two other
  // approaches if it causes a problem:
  //  1. add a very low frequency drift correction in the direction
  //     opposite the 1-2s moving average
  //  2. discretize the fractions, rounding off at (say) 2^-26 both
  //     the step heights and the lanczos coefficients
  // Note that the latter option requires care: we can't simply round
  // the coefficients because they won't necessarily add to 1 - we'd
  // need to add/subtract a constant (very small) offset first until
  // they did add to exactly 1.  This same problem could possibly
  // also show up in adding rounded steps, so the drift may be a
  // better option.
}
