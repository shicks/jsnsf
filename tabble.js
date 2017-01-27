/**
 * UI element for a tab-separated text area.
 * Automatically ensures tabs are evenly-spaced.
 */
export default class Tabble {
  /** @param {!Element} elem */
  constructor(elem) {
    /** @private @const {!Element} */
    this.elem_ = elem;

    /** @private @const {!Array<number>} */
    this.sizes_ = [];

    /** @private @const {!Array<!Array<string>>} */
    this.rows_ = [];

    this.update_ = rateLimit(this.update_, 500);
  }

  /**
   * Writes a single row of text.
   * @param {string} text
   */
  write(text) {
    const cols = text.split('\t');
    const row = [];
    while (this.sizes_.length < cols.length) this.sizes_.push(0);
    for (let [i, s] of cols.entries()) {
      const cs = this.sizes_[i];
      if (s.length < cs) {
        s = pad(s, cs);
      } else if (cs < s.length) {
        this.sizes_[i] = s.length;
        for (let r of this.rows_) {
          if (i < r.length) r[i] = pad(r[i], s.length);
        }
      }
      row.push(s);
    }
    this.rows_.push(row);
    this.update_()
  }

  update_() {
    this.elem_.textContent =
        this.rows_.map(row => row.join(' ')).join('\n');
  }
}

/**
 * @param {string} str
 * @param {number} size
 * @return {string} Padded string.
 */
function pad(str, size) {
  if (str.length < size) str += ' '.repeat(size - str.length);
  return str;
}

/**
 * Rate limits a function to only be called once every rateMillis.
 * @param {function(this: THIS)} func
 * @param {number} rateMillis
 * @return {function(this: THIS)}
 * @template THIS
 */
function rateLimit(func, rateMillis) {
  let queued = false;
  let lastMs = 0;
  return function() {
    if (queued) return;
    const now = new Date().getTime();
    if (now - lastMs < rateMillis) {
      queued = true;
      setTimeout(() => {
        queued = false;
        func.call(this);
        lastMs = new Date().getTime();
      }, rateMillis - (now - lastMs));
    } else {
      func.call(this);
      lastMs = new Date().getTime();
    }
  }
}
