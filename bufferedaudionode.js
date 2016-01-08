'use strict';

/** An audio node that allows writing samples. */
export default class BufferedAudioNode {
  /**
   * @param {!AudioContext} ac
   * @param {number=} buffer Length of buffer, in seconds (default 2).
   */
  constructor(ac, buffer) {
    buffer = buffer != null ? buffer : 2;
    /** @private @const */
    this.fc_ = buffer * ac.sampleRate;
    /** @private @const */
    this.ac_ = ac;
    /** @private @const */
    this.ab_ = ac.createBuffer(2, this.fc_, ac.sampleRate);
    /** @private @const */
    this.c0_ = this.ab_.getChannelData(0);
    /** @private @const */
    this.c1_ = this.ab_.getChannelData(1);
    /** @private {!AudioBufferSourceNode} */
    this.s_ = ac.createBufferSource();
    /** @private {number} */
    this.written_ = 0;
    /** @private {number} */
    this.started_ = -1;
    /** @private {number} */
    this.underrun_ = -1;
    /** @private {?AudioNode} */
    this.destination_ = null;

    this.s_.buffer = this.ab_;
    this.s_.loop = true;

    this.maxBuffer_ = 0.9;
    this.minBuffer_ = 0.5;
    this.writePromise_ = null;
    this.writeResolver_ = null;

    Object.seal(this);
  }


  get context() { return this.ac_; }
  get numberOfInputs() { return 0; }
  get numberOfOutputs() { return 1; }
  get channelCount() { return 2; }
  get channelCountMode() { return 'explicit'; }
  get channelInterpretation() { return 'speakers'; }


  /** Connects to an output. */
  connect(dest) {
    this.destination_ = dest;
    this.s_.connect(dest);
  }


  /** Disconnects the output. */
  disconnect() {
    this.destination_ = null;
    this.s_.disconnect();
  }


  /** Resets everything to an empty buffer. */
  reset() {
    if (this.writeResolver_) this.writeResolver_();
    this.s_.stop();
    this.s_.disconnect();

    this.s_ = this.ac_.createBufferSource();
    this.written_ = 0;
    this.started_ = -1;
    this.writePromise_ = this.writeResolver_ = null;

    this.s_.buffer = this.ab_;
    this.s_.loop = true;
    this.s_.connect(this.ac_.destination);
  }


  /**
   * @return {number} The current fraction of the buffer filled.
   */
  buffer() {
    if (this.started_ < 0) return 0;
    const frames = this.written_ + this.started_ - 
        this.ac_.currentTime * this.ac_.sampleRate;
    // TODO(sdh): if frames < 0 then there's an underrun.
    //   - if started is zero then this shouldn't be a problem
    //     (though it would be nice to rearrange things so this
    //     doesn't happen).
    //   - otherwise we probably want to advance written?
    return Math.max(0, frames) / this.fc_;
  }


  /**
   * @return {number} Time (in seconds) until the buffer underruns.
   */
  bufferTime() {
    if (this.started_ < 0) return Infinity;
    const time = (this.written_ + this.started_) / this.ac_.sampleRate - 
        this.ac_.currentTime;
    return Math.max(0, time);
  }


  /**
   * @return {number} Max samples that can be added without an overrun.
   */
  bufferLimit() {
    const limit = (this.maxBuffer_ - this.buffer()) * this.fc_;
    return Math.max(0, Math.floor(limit));
  }


  /**
   * @param {!ArrayLike<number>} left
   * @param {!ArrayLike<number>=} right
   * @param {number=} offset
   * @param {!Promise=} promise
   * @return {!Promise} Promise that completes when buffer written.
   */
  write(left, right, offset, promise) {
    right = right || left;
    offset = offset || 0;
    if (this.writePromise_ != promise) { // n.b. single-threaded
      return this.writePromise_ = this.writePromise_.then(
          () => this.write(left, right, offset, promise));
    }
    const max = Math.max(left.length, right.length);
    const remainingBuffer =
        Math.max(0, this.maxBuffer_ - Math.max(0, this.buffer()));
    const end = Math.floor(Math.min(max, offset + remainingBuffer * this.fc_));
    let pos = this.written_ % this.fc_;
    if (offset > end) throw new Error('impossible ' + offset + ' > ' + end);
    if (this.written_ == 0 && offset < end) {
      this.s_.start();
      this.started_ = this.ac_.currentTime * this.ac_.sampleRate;
    }
    for (let i = offset; i < end; i++) {
      this.c0_[pos] = i < left.length ? left[i] : right[i];
      this.c1_[pos] = i < right.length ? right[i] : left[i];
      if (++pos >= this.fc_) pos = 0;
    }
    this.written_ += (end - offset);
    if (end < max) {
      if (!this.writePromise_) {
        this.writePromise_ =
            new Promise(resolve => this.writeResolver_ = resolve);
      }
      const delta = Math.max(this.maxBuffer_ - this.minBuffer_, 0);
      setTimeout(
          () => { this.write(left, right, end, this.writePromise_); },
          this.fc_ / this.ac_.sampleRate * 1000 * delta);
      return this.writePromise_;
    } else if (this.writeResolver_) { // we're done, so resolve
      this.writeResolver_();  // n.b. then() methods happen *after frame*
      this.writeResolver_ = this.writePromise_ = null;
    }
    // No pending operation, so zero out the buffer after the end (underrun?)
    const buf = this.buffer() * this.fc_;  // frames of buffer left
    const empty = this.fc_ - buf;
    for (let i = 0; i < empty; i++) {
      this.c0_[pos] = this.c1_[pos] = 0;
      if (++pos >= this.fc_) pos = 0;
    }
    const written = this.written_;
    // TODO(sdh): cancel previous checks?
    clearTimeout(this.underrun_);
    this.underrun_ = setTimeout(() => {
      if (this.written_ == written) this.reset();
    }, (empty * 0.9 + buf) / this.ac_.sampleRate * 1000);
    return Promise.resolve();
  }
}
