/** A simple divider. */
export default class Divider {
  /**
   * @param {function(this: THIS)} output Function to call at zero.
   * @param {THIS=} opt_thisArg
   * @template THIS
   */
  constructor(output, opt_thisArg) {
    /** @private @const {function(this: THIS)} */
    this.output_ = output;
    /** @private @const {THIS|undefined} */
    this.this_ = opt_thisArg;
    /** @private {number} */
    this.counter_ = 0;

    /** @type {number} */
    this.period = 0;  // TODO(sdh): make this a property?
  }

  /** @return {number} */
  get counter() {
    return this.counter_;
  }

  /** Reloads the divider. */
  reload() {
    this.counter_ = this.period;
  }

  /** Clocks the counter. */
  clock() {
    if (this.counter_ == 0) {
      this.counter_ = this.period;
      this.output_.call(this.this_);
    } else {
      this.counter_--;
    }
  }
}
