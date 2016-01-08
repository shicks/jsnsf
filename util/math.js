/** @fileoverview Math classes/functions. */

/**
 * @param {number} x
 * @return {!Complex} Ci(x) + i*Si(x).
 */
export function cisi(x) {
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
  if (!t) return new Complex(-BIG);
  if (t > TMIN) {
    let b = new Complex(1, t);
    let c = new Complex(BIG);
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

/** Represents an immutable complex number. */
export class Complex {
  /**
   * @param {number} re Real part.
   * @param {number=} im Imaginary part, if any.
   */
  constructor(re, im = 0) {
    this.re = re;
    this.im = im;
    Object.freeze(this);
  }

  /**
   * @param {!Complex|number} z
   * @return {!Complex} The sum.
   */
  add(z) {
    return z instanceof Complex ?
        new Complex(this.re + z.re, this.im + z.im) :
        new Complex(this.re + z, this.im);
  }

  /**
   * @param {!Complex|number} z
   * @return {!Complex} The product.
   */
  mul(z) {
    return z instanceof Complex ?
        new Complex(this.re * z.re - this.im * z.im,
                    this.re * z.im + this.im * z.re) :
        new Complex(this.re * z, this.im * z);
  }

  /**
   * @param {!Complex|number} z
   * @return {!Complex} The difference.
   */
  sub(z) {
    return z instanceof Complex ?
        new Complex(this.re - z.re, this.im - z.im) :
        new Complex(this.re - z, this.im);
  }

  /** @return {!Complex} The reciprocal. */
  inv() {
    const mag2 = this.mag2();
    return new Complex(this.re / mag2, -this.im / mag2);
  }

  /**
   * @param {!Complex|number} z Denominator.
   * @return {!Complex} The quotient.
   */
  div(z) {
    return z instanceof Complex ?
        this.mul(z.conj()).div(z.mag2()) :
        new Complex(this.re / z, this.im / z);
  }

  /** @return {!Complex} The conjugate. */
  conj() {
    return new Complex(this.re, -this.im);
  }

  /** @return {number} The absolute value, squared. */
  mag2() {
    return this.re * this.re + this.im * this.im;
  }

  /** @return {string} A string representation. */
  toString() {
    return this.im == 0 ? String(this.re) :
      this.im > 0 ? this.re + ' + ' + this.im + 'i' :
      this.re + ' - ' + -this.im + 'i';
  }
}

/** @const {!Complex} Unit. */
Complex.ONE = new Complex(1);
/** @const {!Complex} Imaginary unit. */
Complex.I = new Complex(0, 1);
/** @const {!Complex} Zero. */
Complex.ZERO = new Complex(0);

Object.freeze(Complex);
