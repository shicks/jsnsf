class AddressingMode {

  addr(arg, mem, cpu) {
    const addr = this.func_(arg, mem, cpu);
    if (addr != null && addr >= 0) return addr;
    throw new Error('Immediate valuew have no address.');
  }

  get(arg, mem, cpu) {
    const addr = this.func_(arg, mem, cpu);
    if (addr == null) return cpu.A;
    if (addr < 0) return ~addr;
    return mem.get(addr);
  }

  set(arg, mem, cpu, value) {
    const addr = this.func_(arg, mem, cpu);
    if (addr == null) {
      cpu.A = value;
    } else if (addr < 0) {
      throw new Error('Cannot set an immediate value.');
    }
    mem.set(addr, value);
  }

  /**
   * @param {number} arg
   * @param {!Memory} mem
   * @param {!Registers} reg
   * @return {number} The 8-bit result.  The 8th bit (0x100) is
   *     set if there was a branch crossing.
   */
  // get(arg, mem, reg) {
  //   let arg = 0;
  //   let size = this.size_;
  //   let addr = reg.pc + 1;
  //   while (size--) {
  //     arg = (arg << 8) | mem.get(addr++);
  //   }
  //   const result = this.func_(arg, mem, reg);
  //   reg.pc += this.size + 1;
  //   return result;
  // }
}




/** An addressing mode. */
class AddressingMode {
  /**
   * @param {number} size
   * @param {function(number, !Memory, !Cpu): ?number} func
   */
  constructor(name, fmt, func) {
    this.bytes_ = /\$\$/.test(fmt) ? 2 : /\$/.test(fmt) ? 1 : 0;
    this.signed_ = /\+\$/.test(fmt);
    this.name_ = name;
    /** @private @const {function(!Cpu): number} */
    this.func_ = func;

    const before = fmt.replace(/\+?\$\$?.*/, '');
    const after = fmt.replace(/.*\+?\$\$?/, '');
    const pad =
        this.bytes_ == 2 ?
        x => '0000'.substring(x.length, 4) + x.toUpperCase() :
        x => '00'.substring(x.length, 2) + x.toUpperCase();
    const sgn = this.signed_ ? (x => x < 0 ? '-' : x > 0 ? '+' : '') : () => '';
    /** @const {function(number): string} */
    this.format =
        this.bytes_ == 0 ?
        arg => fmt :
        arg => before + sgn(arg) + '$' + pad(arg.toString(16)) + after;
  }

  addr(arg, mem, cpu) {
    const addr = this.func_(arg, mem, cpu);
    if (addr != null && addr >= 0) return addr;
    throw new Error('Immediate valuew have no address.');
  }

  get(arg, mem, cpu) {
    const addr = this.func_(arg, mem, cpu);
    if (addr == null) return cpu.A;
    if (addr < 0) return ~addr;
    return mem.get(addr);
  }

  set(arg, mem, cpu, value) {
    const addr = this.func_(arg, mem, cpu);
    if (addr == null) {
      cpu.A = value;
    } else if (addr < 0) {
      throw new Error('Cannot set an immediate value.');
    }
    mem.set(addr, value);
  }

  /**
   * @param {number} arg
   * @param {!Memory} mem
   * @param {!Registers} reg
   * @return {number} The 8-bit result.  The 8th bit (0x100) is
   *     set if there was a branch crossing.
   */
  // get(arg, mem, reg) {
  //   let arg = 0;
  //   let size = this.size_;
  //   let addr = reg.pc + 1;
  //   while (size--) {
  //     arg = (arg << 8) | mem.get(addr++);
  //   }
  //   const result = this.func_(arg, mem, reg);
  //   reg.pc += this.size + 1;
  //   return result;
  // }
}


AddressingMode.MODES = [
  new AddressingMode('A', () => null),
  new AddressingMode('', () => { throw new Error('Operand is implied.'); }),
  new AddressingMode('#$', arg => ~arg),
  new AddressingMode('$$', arg => arg),
  new AddressingMode('($$)', (arg, mem) => mem.getWord(arg)),
  new AddressingMode('$$,x', (arg, mem, cpu) => mem.getWord(arg + cpu.X)),
  new AddressingMode('$$,y', (arg, mem, cpu) => mem.getWord(arg + cpu.Y)),
  new AddressingMode('$', arg => arg),
  new AddressingMode('$,x', (arg, mem, cpu) => arg),
  new AddressingMode('$,y', (arg, mem, cpu) => arg),
  new AddressingMode('($,x)', (arg, mem, cpu) => arg),
  new AddressingMode('($),y', (arg, mem, cpu) => arg),
AddressingMode.IMPLIED = new AddressingMode(

    'A': mode(0, (arg, mem, reg) => accum(reg)),
    'i': mode(0, () => { throw new Error('Operand is implied.'); }),
    '#': mode(1, arg => immediate(arg)),
    '##': mode(2, arg => immediate(arg)),  // NOTE: fake mode for JMP
    'a': mode(2, (arg, mem) => mem.cell(arg)),
    'aa': mode(2, (arg, mem) => immediate(mem.getWord(arg, true))),  // FAKE
    'zp': mode(1, (arg, mem) => mem.cell(arg)),
    'r': mode(1, (arg, mem, reg) => mem.cell((arg << 24 >> 24) + reg.pc)),
    'a,x': mode(2, (arg, mem, reg) => absWith(mem, arg, reg.x)),
    'a,y': mode(2, (arg, mem, reg) => absWith(mem, arg, reg.y)),
    'zp,x': mode(1, (arg, mem, reg) => mem.cell(0xff & (arg + reg.x))),
    'zp,y': mode(1, (arg, mem, reg) => mem.cell(0xff & (arg + reg.y))),
    '(zp,x)': mode(1, (arg, mem, reg) =>
              mem.cell(mem.get(0xff & (arg + reg.x)) +
                       (mem.get(0xff & (arg + reg.x + 1)) << 8))),
    '(zp),y': mode(1, (arg, mem, reg) => absWith(mem, mem.getWord(arg)), reg.y),

/** @const {!Object<!AddressingMode>} */
const ADDRESSING_MODES = (function() {
  /**
   * @param {number} size
   * @param {function(number, !Memory, !Registers): !Memory.Cell} func
   * @return {!AddressingMode}
   */
  function mode(size, func) {
    return new AddressingMode(size, func);
  }
  /**
   * Adds in the page-crossing bit.
   * @param {!Memory} mem
   * @param {number} arg
   * @param {number} offset
   * @return {!Memory.Cell}
   */
  function absWith(mem, arg, offset) {
    const addr = arg + offset;
    return mem.cell(addr, addr & 0xff00 != arg && 0xff00);
  }
  /**
   * Accumulator register as a cell.
   * @param {!Registers} reg
   * @return {!Memory.Cell}
   */
  function accum(reg) {
    return {
      get() { return reg.a; },
      set(value) { reg.a = value; },
      cross: false,
    };
  }
  /**
   * Immediate value as a cell.
   * @param {number} value
   * @return {!Memory.Cell}
   */
  function immediate(reg) {
    return {
      get() { return value; },
      set(value) { throw new Error('Cannot set immediate value'); },
      cross: false,
    };
  }
  return {
    'A': mode(0, (arg, mem, reg) => accum(reg)),
    'i': mode(0, () => { throw new Error('Operand is implied.'); }),
    '#': mode(1, arg => immediate(arg)),
    '##': mode(2, arg => immediate(arg)),  // NOTE: fake mode for JMP
    'a': mode(2, (arg, mem) => mem.cell(arg)),
    'aa': mode(2, (arg, mem) => immediate(mem.getWord(arg, true))),  // FAKE
    'zp': mode(1, (arg, mem) => mem.cell(arg)),
    'r': mode(1, (arg, mem, reg) => mem.cell((arg << 24 >> 24) + reg.pc)),
    'a,x': mode(2, (arg, mem, reg) => absWith(mem, arg, reg.x)),
    'a,y': mode(2, (arg, mem, reg) => absWith(mem, arg, reg.y)),
    'zp,x': mode(1, (arg, mem, reg) => mem.cell(0xff & (arg + reg.x))),
    'zp,y': mode(1, (arg, mem, reg) => mem.cell(0xff & (arg + reg.y))),
    '(zp,x)': mode(1, (arg, mem, reg) =>
              mem.cell(mem.get(0xff & (arg + reg.x)) +
                       (mem.get(0xff & (arg + reg.x + 1)) << 8))),
    '(zp),y': mode(1, (arg, mem, reg) => absWith(mem, mem.getWord(arg)), reg.y),
  };
})();


/**
 * @const {!Object<function(number, !Memory, !Registers)>}
 */
const OPCODES = {
}


// TODO - potential optimization
//  - class Opcode {
//      constructor(addrmode, cycles) {
//        this.addrmode = ...
//        this.cycles = ...  // how to indicate +1/+2?
//        this.cross = false;  // set each time
//      }
//      get(operand) { from memory/reg via addrmode }
//      set(operand, value) { into memory/reg via addrmode }
//      run(operand, mem, reg) { abstract }

// basic idea is that we can return extra information (e.g. cycles, etc)
// as properties on the Opcode instance, since we're single-threaded...
//  - this should eliminate most allocations for CPU cycles...
//  - can we also eliminate allocations for APU cycles?


// TODO -
//  - rework opcodes as simple methods on CPU - no need to pass args anymore
//  - addressing modes are a separate class since they need to format
//    themselves, and we may need to compare for e.g. JMP?
//     - alernatively, make them methods, too?
//     - separate parallel map for formatting?
