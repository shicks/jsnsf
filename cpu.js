import Memory from './memory';
import Clock from './clock';


/** Models the CPU. */
export default class Cpu {
  /**
   * @param {!Memory} mem
   * @param {!Clock} clock
   */
  constructor(mem, clock) {
    /** @private @const {!Memory} */
    this.mem_ = mem;
        
    /** @private @const {!Clock} */
    this.clock_ = clock;

    /** @private {!Registers} */
    this.reg_ = new Registers();
  }

  

  
  

}


class Registers {
  constructor() {
    this.a = 0;
    this.x = 0;
    this.y = 0;
    this.pc = 0;
    this.sr = 0;
    this.sp = 0x1ff;
  }

  // Sign flag (sr bit 7)
  get s() { return Boolean(this.sr & 0x80); }
  set s(value) { value ? this.sr |= 0x80 : this.sr &= ~0x80; }

  // Overflow flag (sr bit 6)
  get v() { return Boolean(this.sr & 0x40); }
  set v(value) { value ? this.sr |= 0x40 : this.sr &= ~0x40; }

  // Break flag (sr bit 4)
  get b() { return Boolean(this.sr & 0x10); }
  set b(value) { value ? this.sr |= 0x10 : this.sr &= ~0x10; }

  // Decimal flag (sr bit 3)
  get d() { return Boolean(this.sr & 8); }
  set d(value) { value ? this.sr |= 8 : this.sr &= ~8; }

  // Interrupt flag (sr bit 2)
  get i() { return Boolean(this.sr & 4); }
  set i(value) { value ? this.sr |= 4 : this.sr &= ~4; }

  // Zero flag (sr bit 1)
  get z() { return Boolean(this.sr & 2); }
  set z(value) { value ? this.sr |= 2 : this.sr &= ~2; }

  // Carry flag (sr bit 0)
  get c() { return Boolean(this.sr & 1); }
  set c(value) { value ? this.sr |= 1 : this.sr &= ~1; }

  /**
   * Sets the sign and zero flags based on the number.
   * @param {number} arg
   * @return {number} The argument, for chaining.
   */
  setSZ(arg) {
    this.s = arg & 0x80;
    this.z = !arg;
    return arg;
  }

  /**
   * Compare register to memory.
   * @param {number} reg
   * @param {number} mem
   */
  cmp(reg, mem) {
    this.c = !(this.s = reg < mem);
    this.z = reg == mem;
  }   
}


/** An addressing mode. */
class AddressingMode {
  /**
   * @param {number} size
   * @param {number} cycles
   * @param {function(number, !Memory, !Registers): number} func
   */
  constructor(size, cycles, func) {
    this.size_ = size;
    this.cycles_ = cycles;
    this.func_ = func;
  }
  /**
   * @param {number} arg
   * @param {!Memory} mem
   * @param {!Registers} reg
   * @return {number} The 8-bit result.  The 8th bit (0x100) is
   *     set if there was a branch crossing.
   */
  get(arg, mem, reg) {
    let arg = 0;
    let size = this.size_;
    let addr = reg.pc + 1;
    while (size--) {
      arg = (arg << 8) | mem.get(addr++);
    }
    const result = this.func_(arg, mem, reg);
    reg.pc += this.size + 1;
    return result;
  }
}


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
  // LOAD AND STORE
  // Load Accumulator with Memory: M -> A
  LDA(arg, mem, reg) { reg.a = reg.setSZ(arg.get()); },
  // Load Index X with Memory: M -> X
  LDX(arg, mem, reg) { reg.x = reg.setSZ(arg.get()); },
  // Load Index Y with Memory: M -> Y
  LDX(arg, mem, reg) { reg.y = reg.setSZ(arg.get()); },
  // Store Accumulator in Memory: A -> M
  STA(arg, mem, reg) { arg.set(reg.a); },
  // Store Index X in Memory: X -> M
  STX(arg, mem, reg) { arg.set(reg.x); },
  // Store Index Y in Memory: Y -> M
  STY(arg, mem, reg) { arg.set(reg.y); },

  // ARITHMETIC
  // Add Memory to Accumulator with Carry: A + M + C -> A
  ADC(arg, mem, reg) {
    if (reg.d) throw new Error('BCD not supported!');
    const x = arg.get();
    const sum = reg.a + x + reg.c;
    const as = reg.a & 0x80;
    const xs = x & 0x80;
    const ss = sum & 0x80;
    reg.v = (as == xs && as != ss) || (reg.c && sum == 0x80);
    reg.c = sum > 0xff;
    reg.a = reg.setSV(sum & 0xff);
  },
  // Subtract Memory from Accumulator with Borrow: A - M - ~C -> A
  SBC(arg, mem, reg) {
    if (reg.d) throw new Error('BCD not supported!');
    const x = arg.get();
    const diff = reg.a - x - !reg.c;
    const as = reg.a & 0x80;
    const xs = x & 0x80;
    const ds = diff & 0x80;
    reg.v = (as != xs && as != ds) || (!reg.c && diff == -129);
    reg.c = diff < 0;
    reg.a = reg.setSV(diff & 0xff);
  },

  // INCREMENT AND DECREMENT
  // Increment Memory by One: M + 1 -> M
  INC(arg, mem, reg) { arg.set(reg.setSV(arg.get() + 1)); },
  // Increment Index X by One: X + 1 -> X
  INX(arg, mem, reg) { reg.x = reg.setSV(reg.x + 1); },
  // Increment Index Y by One: Y + 1 -> Y
  INY(arg, mem, reg) { reg.y = reg.setSV(reg.y + 1); },
  // Decrement Memory by One: M - 1 -> M
  DEC(arg, mem, reg) { arg.set(reg.setSV(arg.get() - 1)); },
  // Decrement Index X by One: X - 1 -> X
  DEX(arg, mem, reg) { reg.x = reg.setSV(reg.x - 1); },
  // Decrement Index Y by One: Y - 1 -> Y
  DEY(arg, mem, reg) { reg.y = reg.setSV(reg.y - 1); },

  // SHIFT AND ROTATE
  // Arithmetic Shift Left One Bit: C <- 76543210 <- 0
  ASL(arg, mem, reg) {
    const shift = arg.get() << 1;
    reg.c = shift > 0xff;
    arg.set(reg.setSV(shift & 0xff));
  },
  // Logical Shift Right One Bit: 0 -> 76543210 -> C
  LSR(arg, mem, reg) {
    const value = arg.get();
    reg.c = value & 1;
    arg.set(reg.setSV(value >>> 1));
  },
  // Rotate Left One Bit: C <- 76543210 <- C
  ROL(arg, mem, reg) {
    const shift = (arg.get() << 1) | reg.c
    reg.c = shift > 0xff;
    arg.set(reg.setSV(shift & 0xff));
  },
  // Rotate Right One Bit: C -> 76543210 -> C
  ROR(arg, mem, reg) {
    const value = arg.get() | (reg.c ? 0x100 : 0);
    reg.c = value & 1;
    arg.set(reg.setSV(value >>> 1));
  },

  // LOGIC
  // AND Memory with Accumulator: A & M -> A
  AND(arg, mem, reg) { reg.a = reg.setSV(arg.get() & reg.a); },
  // OR Memory with Accumulator: A | M -> A
  ORA(arg, mem, reg) { reg.a = reg.setSV(arg.get() | reg.a); },
  // Exclusive-OR Memory with Accumulator: A ^ M -> A
  EOR(arg, mem, reg) { reg.a = reg.setSV(arg.get() ^ reg.a); },

  // COMPARE AND TEST BIT
  // Compare Memory and Accumulator: A - M
  CMP(arg, mem, reg) { reg.cmp(reg.a, arg); },
  // Compare Memory and Index X: X - M
  CPX(arg, mem, reg) { reg.cmp(reg.x, arg); },
  // Compare Memory and Index Y: Y - M
  CPY(arg, mem, reg) { reg.cmp(reg.y, arg); },
  // Test Bits in Memory with Accumulator: A & M
  BIT(arg, mem, reg) {
    const value = arg.get();
    reg.sr = (reg.sr & 0x3f) | (value & 0xc0);
    reg.z = !(reg.a & value); // TODO(sdh): is the ! correct here?!?
  },

  // BRANCH    -- TODO(sdh): how to not add 1 cycle if no branch?
  // Branch on Carry Clear
  BCC(arg, mem, reg) { if (!reg.c) reg.pc = arg.get(); },
  // Branch on Carry Set
  BCS(arg, mem, reg) { if (reg.c) reg.pc = arg.get(); },
  // Branch on Result Zero
  BEQ(arg, mem, reg) { if (reg.z) reg.pc = arg.get(); },
  // Branch on Result Minus
  BMI(arg, mem, reg) { if (reg.s) reg.pc = arg.get(); },
  // Branch on Result Plus
  BPL(arg, mem, reg) { if (!reg.s) reg.pc = arg.get(); },
  // Branch on Overflow Clear
  BVC(arg, mem, reg) { if (!reg.v) reg.pc = arg.get(); },
  // Branch on Overflow Set
  BVS(arg, mem, reg) { if (reg.v) reg.pc = arg.get(); },

  // TRANSFER
  // Transfer Accumulator to Index X: A -> X
  TAX(arg, mem, reg) { reg.x = reg.setSV(reg.a); },
  // Transfer Index X to Accumulator: X -> A
  TXA(arg, mem, reg) { reg.a = reg.setSV(reg.x); },
  // Transfer Accumulator to Index Y: A -> Y
  TAY(arg, mem, reg) { reg.y = reg.setSV(reg.a); },
  // Transfer Index Y to Accumulator: Y -> A
  TYA(arg, mem, reg) { reg.a = reg.setSV(reg.y); },
  // Transfer Stack Pointer to Index X: SP -> X
  TSX(arg, mem, reg) { reg.x = reg.setSV(reg.sp); },
  // Transfer Index X to Stack Pointer: X -> SP
  TXS(arg, mem, reg) { reg.sp = reg.setSV(reg.x); },

  // STACK
  // Push Accumulator on Stack: A -> (SP)
  PHA(arg, mem, reg) { mem.set(reg.sp--, reg.a); },
  // Pull Accumulator from Stack: (SP) -> A
  PLA(arg, mem, reg) { reg.a = mem.get(++reg.sp); },
  // Push Processor Status on Stack: SR -> (SP)
  PHP(arg, mem, reg) { mem.set(reg.sp--, reg.sr); },
  // Pull Processor Status from Stack: (SP) -> SR
  PLP(arg, mem, reg) { reg.sr = mem.get(++reg.sp); },

  // SUBROUTINES AND JUMP
  // Jump to New Location
  JMP(arg, mem, reg) { reg.pc = arg.get(); },
  // Jump to New Location Saving Return Address
  JSR(arg, mem, reg) {
    // TODO(!!!): nail down the pc++ nuances
    //  - specifically, during execution, PC is 1 before the next instr to run
    //  - so jump addresses are actually instruction minus 1
    mem.setWord(reg.sp, reg.pc);
    reg.sp -= 2;
    reg.pc = arg.get();
  },
  // Return from Subroutine
  RTS(arg, mem, reg) { reg.pc = mem.getWord(reg.sp += 2); },
  // Return from Interrupt
  RTI(arg, mem, reg) {
    reg.sr = mem.get(++reg.sp);
    reg.pc = mem.getWord(reg.sp += 2) - 1;  // NOTE: INTERRUPTS GO AFTER ++PC
  },

  // SET AND CLEAR
  // Set Carry Flag: 1 -> C
  SEC(arg, mem, reg) { reg.c = 1; },
  // Set Decimal Mode: 1 -> D
  SED(arg, mem, reg) { reg.d = 1; },
  // Set Interrupt Disable Status: 1 -> I
  SEI(arg, mem, reg) { reg.i = 1; },
  // Clear Carry Flag: 0 -> C
  CLC(arg, mem, reg) { reg.c = 0; },
  // Clear Decimal Mode: 0 -> D
  CLD(arg, mem, reg) { reg.d = 0; },
  // Clear Interrupt Disable Status: 0 -> I
  CLI(arg, mem, reg) { reg.i = 0; },
  // Clear Overflow Flag: 0 -> V
  CLV(arg, mem, reg) { reg.v = 0; },

  // MISC
  // No Operation
  NOP(arg, mem, reg) {},
  // Break: 1 -> B, 1 -> I
  BRK(arg, mem, reg) { reg.b = reg.i = 1; }
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
