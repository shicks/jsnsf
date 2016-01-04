'use strict';

/**
 * @param {number} radius Integer radius of kernel.  Given a step at
 *     time t, all points between [t-r, t+r] are affected.
 * @param {number} phases Number of different phases to compute.
 * @return {!StepKernel}
 */
function lanczosKernel(radius, phases) {
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
  for (let i = 0; i <= phases; i += 2) fracs.push(i / phases - 1);
  const samples = [];  // [-a - 1, -a + 1, ..., a + 1]
  for (let i = -a - 1; i <= a + 1; i += 2) samples.push(i);
  // 2d array of times [[-5, -3, ..., 5], [-4.75, -2.75, ..., 5.25], ...
  const times = fracs.map(frac => samples.map(base => base - frac));

  // console.log('times([' + times.map(ts=>'['+ts.join(',')+']').join(', ') + '])');

  const values = times.map(ts => ts.map(t => f(t) / norm + 0.5));
  return values.map(diff);

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
      c = b.add(c.inv().mul(a));
      const del = c.mul(d);
      h = h.mul(del);
      if (Math.abs(del.re - 1) + Math.abs(del.im) <= EPS) break;
    }
    if (i >= MAXIT) throw new Error('cf failed in cisi(' + x + ')');
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
      let k;
      for (k = 1; k <= MAXIT; k++) {
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
      if (k > MAXIT) throw('maxits exceeded in cisi(' + x + ')');
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

  toString() {
    return this.im == 0 ? String(this.re) :
      this.im > 0 ? this.re + ' + ' + this.im + 'i' :
      this.re + ' - ' + -this.im + 'i';
  }
}

Complex.ONE = new Complex(1);
Complex.I = new Complex(0, 1);
Complex.ZERO = new Complex(0);
Object.freeze(Complex);
