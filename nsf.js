import BankSwitcher from './bankswitcher';
import Clock from './clock';
import Cpu from './cpu';
import Memory from './mem';

function getString(view, start, length) {
  const bytes = [];
  for (let i = 0; i < length; i++) {
    const byte = view.getUint8(start + i);
    if (!byte) break;
    bytes.push(byte);
  }
  return String.fromCharCode(...bytes);
}

function readBits(value, ...names) {
  const out = [];
  while (value > 0) {
    if (value & 1) out.push(names[0] || 'ILLEGAL');
    names.shift();
    value <<= 1;
  }
  return out;
}

export default class Nsf {
  /** @param {!ArrayBuffer} buf */
  constructor(buf) {
    const header = new DataView(buf, 0, 0x80);
    // Check magic constant in header
    if (getString(header, 0, 5) != 'NESM\x1a') {
      throw new Error('Invalid NSF file.');
    }

    this.version_ = header.getUint8(0x5);
    this.songCount_ = header.getUint8(0x6);
    this.startSong_ = header.getUint8(0x7);
    this.loadAddress_ = header.getUint16(0x8, true);
    this.initAddress_ = header.getUint16(0xA, true);
    this.playAddress_ = header.getUint16(0xC, true);
    this.songName_ = getString(header, 0xE, 32);
    this.artistName_ = getString(header, 0x2E, 32);
    this.copyrightName_ = getString(header, 0x4E, 32);
    this.playSpeedNtsc_ = header.getUint16(0x6E, true);
    this.bankInits_ = new Uint8Array(buf, 0x70, 0x8);
    this.playSpeedPal_ = header.getUint16(0x78, true);
    const palNtscBits = header.getUint8(0x7A);
    this.palNtsc_ = palNtscBits & 2 ? 'dual' : palNtscBits & 1 ? 'pal' : 'ntsc';
    this.extraSupport_ = readBits(header.getUint8(0x7B),
                                  'VRC6', 'VRC7', 'FDS', 'MMC5',
                                  'Namco 163', 'Sunsoft 5B');

    /** @private @const {!Uint8Array} */
    this.data_ = new Uint8Array(buf, 0x80);
  }

  /** @param {!Clock} clock */
  cyclesPerFrame(clock) {
    const speed = clock.ntsc ? this.playSpeedNtsc_ : this.playSpeedPal_;
    return Math.floor(speed / 1e6 / clock.cycleLength);
  }

  /**
   * @param {!Cpu} cpu
   * @param {!Memory} mem
   * @param {?number=} song
   * @param {?BankSwitcher=} banks
   */
  init(cpu, mem, song = null, banks = null) {
    // Load the data
    mem.zero();
    cpu.init();

    if (this.bankInits_.find(i => i)) {
      // Bank switching is enabled.
      if (!banks) throw new Error('Bank switcher required for this ROM');
      banks.load(this.data_, this.loadAddress_);
      const fds = this.extraSupport_.indexOf('FDS') >= 0;
      for (let i = 0; i < 8; i++) {
        const addr = (i > 5 && fds) ? 0x5ff0 + i : 0x5ff8 + i;
        mem.set(addr, this.bankInits_[i]);
      }
    } else {
      // No bank switching, so load directly.
      mem.load(this.data_, this.loadAddress_);
    }
    cpu.pushWord(0xffff); // special signal that we're done...
    cpu.pushWord(this.playAddress_ - 1);
    cpu.PC = this.initAddress_ - 1;
    mem.set(0x4015, 0xf);
    mem.set(0x4017, 0x40);
    cpu.A = song != null ? song : this.startSong_;
    // really, we need the clock... this is getting horribly tangled!
    cpu.X = this.palNtsc_ != 'pal' ? 0 : 1;  // default to NTSC
  }

  frame(cpu) {
    cpu.pushWord(0xffff); // special signal that we're done...
    cpu.PC = this.playAddress_ - 1;
  }

  toString() {
    const speed = [];
    if (this.palNtsc_ == 'ntsc' || this.palNtsc_ == 'dual') {
      speed.push((1e6 / this.playSpeedNtsc_) + ' Hz NTSC');
    }
    if (this.palNtsc_ == 'pal' || this.palNtsc_ == 'dual') {
      speed.push((1e6 / this.playSpeedPal_) + ' Hz PAL');
    }
    return [
      `NSF v${this.version_}`,
      `${this.songCount_} songs, starting at ${this.startSong_}`,
      `Load:      $${this.loadAddress_.toString(16)}`,
      `Init:      $${this.initAddress_.toString(16)}`,
      `Play:      $${this.playAddress_.toString(16)}`,
      `Song name: ${this.songName_}`,
      `Artist:    ${this.artistName_}`,
      `Copyright: ${this.copyrightName_}`,
      `Speed:     ${speed.join(' / ')}`,
      `Bank Init: ${this.bankInits_.join(' ')}`,
      `Extras:    ${this.extraSupport_.join(' ')}`,
    ].join('\n');
  }
}
