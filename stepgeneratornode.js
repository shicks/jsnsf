'use strict';

import BufferedAudioNode from './bufferedaudionode';

/** An audio node that takes a generator function as input. */
export default class StepGeneratorNode {
  /** @param {!AudioContext} ac
      @param {number=} bufferLength */
  constructor(ac, bufferLength) {
    this.ac_ = ac;
    this.bufferLength_ = bufferLength != null ? bufferLength : 2;

    this.buffer_ = new BufferedAudioNode(ac, this.bufferLength_);

    this.generator_ = null;
    this.time_ = 0;
  }


  /** @param {?function()} generator */
  set generator(generator) {
    // TODO - do we need to cancel the previous one?
    this.generator_ = generator;
    this.time_ = 0;

    if (generator) this.generate_();
  }

  generate_() {
    const next = this.generator_.next();
    if (next.done) {
      // TODO - how to stop this thing?
      return;
    }
    
    const t = next.value[0];
    const v = next.value[1];
    
  }


}


/**
 * @param {number} radius Integer radius of kernel.
 * @param {number} fractions Number of different fractions to compute.
 * @return {!StepKernel}
 */
function lanczosKernel(radius, fractions) {
  const a = 2 * radius;
  const PI = Math.PI;
  function f(x) {
    const m1 = (a - 1) * PI * x;
    const p1 = (a + 1) * PI * x;
    return (-m1 * cisi(m1 / a).im +
            p1 * cisi(p1 / a).im -
            2 * a * Math.sin(PI * x) * Math.sin(PI * x / a)) /
        (2 * PI * PI * x);
  }
  function diff(xs) {
    const diffs = new Array(xs.length - 1);
    for (let i = 1; i < xs.length; i++) {
      diffs[i - 1] = xs[i] - xs[i - 1];
    }
    return diffs;
  }
  const fracs = [];
  for (let i = 0; i < 1 - 1 / (2 * fractions); i += 1 / fractions) {
    fracs.push(2 * i);
  }
  const samples = [];
  for (let i = 0; i <= a; i += 2) samples.push(i);
  const times = fracs.map(frac => samples.map(base => base + frac));
  const values = times.map(ts => ts.map(f));
  return times.map(diff);
}


function nub(list) {
  if (!list.length) return [];
  let last = list[0];
  const out = [last];
  for (let elem of list) {
    if (elem != last) out.push(last = elem);
  }
  return out;
}


/** A convolution kernel. */
class StepKernel {
  /**
   * @param {!Array<!Array<number>>} data Array of convolution kernels,
   *     expressed as differences.  The outer array contains evenly-spaced
   *     delays, and the inner array is a list of differences, one for
   *     each following sample.  The opposite array will be used for the
   *     samples preceding the step.
   */
  constructor(data) {
    this.data_ = data;
    const sizes = nub(data.map(x => x.length));
    if (sizes.length != 1) throw new Error('non-rectangular array');
    this.radius_ = sizes[0] / 2;
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
   * @return {!Array<number>} Deltas.
   */
  convolve(startTime, endTime, steps) {
    const out = [];
    for (let time = startTime; time < endTime; time++) {
      out.push(0);
    }
    for (let step of steps) {
      const value = step[1];
      let floor = Math.floor(step[0]);
      let fraction = Math.round((step[0] - floor) / this.fractions_);
      const fwd = this.data_[fraction];
      const rev = this.data_[this.fractions_ - fraction];
      for (let i = 0; i < this.radius_; i++) {
        if (i > 0 && floor - i >= 0) {
          out[floor - i] += rev[this.radius_ - i - 1] * value;
        }
        // TODO - check OBO
        if (floor + i /* + 1 */ < out.length) {
          out[floor + i /* + 1 */] += fwd[i] * value;
        }
      }
    }
    return out;
  }
}



/**
 * @param {double} x
 * @return {!Complex} Ci(x) + i*Si(x).
 */
function cisi(x) {
  // NOTE: this comes from NR p301
  const MAXIT = 100;
  const EULER = 0.577215664901533;  // euler's constant γ
  const HALFPI = 1.570796326794897;  // π/2
  const TMIN = 2;  // dividing line beween taylor series vs continued fraction
  const EPS = 2.2204460492503131e-16;  // relative error
  const FPMIN = 8.9e-308;  // close to smallest representable number
  const BIG = 1.7e+308;  // near machine overflow limit

  const t = Math.abs(x);
  let cs;  // complex result
  if (!t) return new Complex(-BIG, 0);
  if (t > TMIN) {
    let b = new Complex(1, t);
    let c = new Complex(BIG, 0);
    let d = b.inv();
    let h = d;
    let i;
    for (i = 1; i < MAXIT; i++) {
      const a = -i * i;
      b = b.add(2);
      d = d.mul(a).add(b).inv();
      c = b.add(a).div(c);
      const del = c.mul(d);
      h = h.mul(del);
      if (Math.abs(del.re - 1) + Math.abs(del.im) <= EPS) break;
    }
    if (i >= MAXIT) throw new Error('cf failed in cisi');
    h = new Complex(Math.cos(t), -Math.sin(t)).mul(h);
    cs = new Complex(-h.re, h.im + HALFPI);
  } else {
    let sum, sumc, sums;  // doubles
    if (t < Math.sqrt(FPMIN)) {
      sumc = 0.;
      sums = t;
    } else {
      sum = sums = sumc = 0.;
      let sign = 1.;
      let fact = 1.;
      let odd = true;
      for (let k = 1; k <= MAXIT; k++) {
        fact *= t / k;
        const term = fact / k;
        sum += sign * term;
        const err = term / Math.abs(sum);
        if (odd) {
          sign = -sign;
          sums = sum;
          sum = sumc;
        } else {
          sumc = sum;
          sum = sums;
        }
        if (err < EPS) break;
        odd = !odd;
      }
      if (k > MAXIT) throw("maxits exceeded in cisi");
    }
    cs = new Complex(sumc + Math.log(t) + EULER, sums);
  }
  if (x < 0) cs = cs.conj();
  return cs;
}

class Complex {
  constructor(re, im) {
    this.re = re;
    this.im = im || 0;
    Object.freeze(this);
  }

  add(z) {
    return z instanceof Complex ?
        new Complex(this.re + z.re, this.im + z.im) :
        new Complex(this.re + z, this.im);
  }

  mul(z) {
    return z instanceof Complex ?
        new Complex(this.re * z.re - this.im * z.im,
                    this.re * z.im + this.im * z.re) :
        new Complex(this.re * z, this.im * z);
  }

  sub(z) {
    return z instanceof Complex ?
        new Complex(this.re - z.re, this.im - z.im) :
        new Complex(this.re - z, this.im);
  }

  inv() {
    const mag2 = this.mag2();
    return new Complex(this.re / mag2, -this.im / mag2);
  }

  div(z) {
    return z instanceof Complex ?
        this.mul(z.conj()).div(z.mag2()) :
        new Complex(this.re / z, this.im / z);
  }

  conj() {
    return new Complex(this.re, -this.im);
  }

  mag2() {
    return this.re * this.re + this.im * this.im;
  }
}

Complex.ONE = new Complex(1);
Complex.I = new Complex(0, 1);
Complex.ZERO = new Complex(0);
Object.freeze(Complex);
