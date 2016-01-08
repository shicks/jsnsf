
/** Sets up bank switching for the upper half of the RAM. */
export default class BankSwitcher {
  /**
   * @param {!Memory} mem
   * @param {boolean} fds Whether to set up FDS bank switching.
   */
  constructor(mem, fds) {
    /** @private @const {!Memory} */
    this.mem_ = mem;
    /** @private @const {!Array<!Uint8Array>} */
    this.pages_ = [];
    for (let i = fds ? 6 : 8; i < 16; i++) {
      mem.listen(0x5FF0 + i, page => this.swap_(i, page));
    }
  }

  
  /**
   * Loads the banks.
   * @param {number} padding Padding, only the low 12 bits are used.
   * @param {!Uint8Array} data
   */
  load(padding, data) {
    padding &= 0xfff;
    let bufferSize = padding + data.length;
    if (bufferSize & 0xfff) bufferSize = (bufferSize & ~0xfff + 0x1000);
    let buffer;
    if (data.length < bufferSize) {
      buffer = new Uint8Array(bufferSize);
      buffer.set(data, padding);
    } else {
      buffer = data;
    }
    for (let i = 0; i < (bufferSize >>> 12); i++) {
      this.pages_[i] = new Uint8Array(buffer, i << 12, 0x1000);
    }
  }


  /**
   * @param {number} bank The bank index to fill.
   * @param {number} page The page number to load from.
   * @private
   */
  swap_(bank, page) {
    if (!this.pages_.length) return; // bank switching not loaded/enabled
    if (page >= this.pages_.length) throw new Error('invalid bank index');
    this.mem_.loadBank(this.pages_[page], (bank & 0xf) << 12);
  }
}
