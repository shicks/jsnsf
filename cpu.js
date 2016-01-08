import Memory from './mem';


/** Models the CPU. */
export default class Cpu {
  /**
   * @param {!Memory} mem
   */
  constructor(mem) {
    /** @private @const {!Memory} */
    this.mem_ = mem;

    /** @type {boolean} Carry flag. */
    this.C = false;
    /** @type {boolean} Zero flag. */
    this.Z = false;
    /** @type {boolean} IRQ disable. */
    this.I = false;
    /** @type {boolean} Decimal mode. */
    this.D = false;
    /** @type {boolean} Break flag. */
    this.B = false;
    /** @type {boolean} Overflow flag. */
    this.V = false;
    /** @type {boolean} Sign flag. */
    this.S = false;
    /** @type {number} Accumulator */
    this.A = 0;
    /** @type {number} Index X */
    this.X = 0;
    /** @type {number} Index Y */
    this.Y = 0;
    /** @type {number} Stack pointer */
    this.SP = 0x1ff;
    /** @type {number} Program counter */
    this.PC = 0;

    this.opcode = null;
    this.operand = null;
    this.wait = 1;

    this.opcodes_ = instructionTable();
    this.message = '';
  }

  init() {
    this.C = this.Z = this.I = this.D = this.B = this.V = this.S = false;
    this.A = this.X = this.Y = this.PC = 0;
    this.SP = 0x1ff;
    this.opcode = this.operand = null;
    this.wait = 1;
  }

  clock() {
    // Tick the wait until we're down to zero.  Once we hit zero,
    // then run the opcode that was set before wait started.
    if (!this.opcode) this.loadOp();
    if (--this.wait > 1) return;
    if (this.opcode) {
      // Actually execute the opcode.
      try {
        this.opcode.op.call(this);
      } finally {
        if (window.msg) { 
          console.log(this.message);
        window.msg = false; }
      }
      
      if (!this.opcode.extraCycles) this.wait = 0;
      this.opcode = null;
    }
  }


  loadOp() {
    this.opcode = this.opcodes_[this.mem_.get(++this.PC)];
    this.operand = 0;
    let shift = 0;
    for (let i = this.opcode.mode.bytes; i > 0; i--) {
      this.operand |= this.mem_.get(++this.PC) << ((shift += 8) - 8);
    }
    this.wait += this.opcode.cycles;
    const lastPc = hex(this.PC - this.opcode.mode.bytes, 2);
    this.message = `${lastPc}: ${this.opcode.format(this.operand)}`;
  }


  disassemble(addr, count) {
    const result = [];
    this.PC = --addr;
    while (count-- > 0) {
      this.loadOp();
      let bytes = '\t\t\t';
      while (addr < this.PC) {
        bytes += hex(this.mem_.get(++addr)).substring(1) + ' ';
      }
      result.push(this.message + bytes);
    }
    console.log(result.join('\n'));
  }


  get SR() {
    let sr = 0;
    sr |= this.S ? 0x80 : 0;
    sr |= this.V ? 0x40 : 0;
    sr |= this.B ? 0x10 : 0;
    sr |= this.D ? 0x08 : 0;
    sr |= this.I ? 0x04 : 0;
    sr |= this.Z ? 0x02 : 0;
    sr |= this.C ? 0x01 : 0;
    return sr;
  }

  set SR(sr) {
    this.S = !!(sr & 0x80);
    this.V = !!(sr & 0x40);
    this.B = !!(sr & 0x10);
    this.D = !!(sr & 0x08);
    this.I = !!(sr & 0x04);
    this.Z = !!(sr & 0x02);
    this.C = !!(sr & 0x01);
  }
  
  accumulator() { return null; }
  absolute() { return this.operand; }
  absoluteX() { return this.checkCross_(this.operand, this.X); }
  absoluteY() { return this.checkCross_(this.operand, this.Y); }
  immediate() { return ~this.operand; }
  implied() { throw new Error('Implied opcode has no operand.'); }
  indirect() { return this.mem_.getWord(this.operand, 0xfff); }
  indirectX() { return this.mem_.getWord(0xff & (this.operand + this.X), 0xff); }
  indirectY() { return this.checkCross_(this.mem_.getWord(this.operand), this.Y); }
  relative() { return this.PC + this.operand; }
  zeroPage() { return this.operand & 0xff; }
  zeroPageX() { return (this.operand + this.X) & 0xff }
  zeroPageY() { return (this.operand + this.Y) & 0xff }

  // ILLEGAL OPCODES
  // Kill
  KIL() { throw new Error('Illegal opcode: ' + this.opcode.name); }

  // LOAD AND STORE
  // Load Accumulator with Memory: M -> A
  LDA() { this.A = this.eqFlags_(this.M); }
  // Load Index X with Memory: M -> X
  LDX() { this.X = this.eqFlags_(this.M); }
  // Load Index Y with Memory: M -> Y
  LDY() { this.Y = this.eqFlags_(this.M); }
  // Store Accumulator in Memory: A -> M
  STA() { this.M = this.A; }
  // Store Index X in Memory: X -> M
  STX() { this.M = this.X; }
  // Store Index Y in Memory: Y -> M
  STY() { this.M = this.Y; }

  // ARITHMETIC
  // Add Memory to Accumulator with Carry: A + M + C -> A
  ADC() {
    if (this.D) throw new Error('BCD not supported!');
    const x = this.M;
    const sum = this.A + x + this.C;
    const as = this.A & 0x80;
    const xs = x & 0x80;
    const ss = sum & 0x80;
    this.V = (as == xs && as != ss) || (this.C && sum == 0x80);
    this.C = sum > 0xff;
    this.A = this.eqFlags_(sum & 0xff);
  }
  // Subtract Memory from Accumulator with Borrow: A - M - ~C -> A
  SBC() {
    if (this.D) throw new Error('BCD not supported!');
    const x = this.M;
    const diff = this.A - x - !this.C;
    const as = this.A & 0x80;
    const xs = x & 0x80;
    const ds = diff & 0x80;
    this.V = (as != xs && as != ds) || (!this.C && diff == -129);
    this.C = diff < 0;
    this.A = this.eqFlags_(diff & 0xff);
  }

  // INCREMENT AND DECREMENT
  // Increment Memory by One: M + 1 -> M
  INC() { this.eqFlags_(++this.M); }
  // Increment Index X by One: X + 1 -> X
  INX() { this.eqFlags_(++this.X); }
  // Increment Index Y by One: Y + 1 -> Y
  INY() { this.eqFlags_(++this.Y); }
  // Decrement Memory by One: M - 1 -> M
  DEC() { this.eqFlags_(--this.M); }
  // Decrement Index X by One: X - 1 -> X
  DEX() { this.eqFlags_(--this.X); }
  // Decrement Index Y by One: Y - 1 -> Y
  DEY() { this.eqFlags_(--this.Y); }

  // SHIFT AND ROTATE
  // Arithmetic Shift Left One Bit: C <- 76543210 <- 0
  ASL() {
    const shift = this.M << 1;
    this.C = shift > 0xff;
    this.M = this.eqFlags_(shift & 0xff);
  }
  // Logical Shift Right One Bit: 0 -> 76543210 -> C
  LSR() {
    const value = this.M;
    this.C = value & 1;
    this.M = this.eqFlags_(value >>> 1);
  }
  // Rotate Left One Bit: C <- 76543210 <- C
  ROL() {
    const shift = (this.M << 1) | this.C
    this.C = shift > 0xff;
    this.M = this.eqFlags_(shift & 0xff);
  }
  // Rotate Right One Bit: C -> 76543210 -> C
  ROR() {
    const value = this.M | (this.C ? 0x100 : 0);
    this.C = value & 1;
    this.M = this.eqFlags_(value >>> 1);
  }

  // LOGIC
  // AND Memory with Accumulator: A & M -> A
  AND() { this.A = this.eqFlags_(this.M & this.A); }
  // OR Memory with Accumulator: A | M -> A
  ORA() { this.A = this.eqFlags_(this.M | this.A); }
  // Exclusive-OR Memory with Accumulator: A ^ M -> A
  EOR() { this.A = this.eqFlags_(this.M ^ this.A); }

  // COMPARE AND TEST BIT
  // Compare Memory and Accumulator: A - M
  CMP() { this.cmpFlags_(this.A, this.M); }
  // Compare Memory and Index X: X - M
  CPX() { this.cmpFlags_(this.X, this.M); }
  // Compare Memory and Index Y: Y - M
  CPY() { this.cmpFlags_(this.Y, this.M); }
  // Test Bits in Memory with Accumulator: A & M
  BIT() {
    const value = this.M;
    this.S = value & 0x80;
    this.V = value & 0x40;
    this.Z = !(this.A & value); // TODO(sdh): is the ! correct here?!?
  }

  // BRANCH    -- TODO(sdh): how to not add 1 cycle if no branch?
  // Branch on Carry Clear
  BCC() { if (!this.C) this.PC = this.checkBranch_(this.MP); }
  // Branch on Carry Set
  BCS() { if (this.C) this.PC = this.checkBranch_(this.MP); }
  // Branch on Result Zero
  BEQ() { if (this.Z) this.PC = this.checkBranch_(this.MP); }
  // Branch on Result Not Zero
  BNE() { if (!this.Z) this.PC = this.checkBranch_(this.MP); }
  // Branch on Result Minus
  BMI() { if (this.S) this.PC = this.checkBranch_(this.MP); }
  // Branch on Result Plus
  BPL() { if (!this.S) this.PC = this.checkBranch_(this.MP); }
  // Branch on Overflow Clear
  BVC() { if (!this.V) this.PC = this.checkBranch_(this.MP); }
  // Branch on Overflow Set
  BVS() { if (this.V) this.PC = this.checkBranch_(this.MP); }

  // TRANSFER
  // Transfer Accumulator to Index X: A -> X
  TAX() { this.X = this.eqFlags_(this.A); }
  // Transfer Index X to Accumulator: X -> A
  TXA() { this.A = this.eqFlags_(this.X); }
  // Transfer Accumulator to Index Y: A -> Y
  TAY() { this.Y = this.eqFlags_(this.A); }
  // Transfer Index Y to Accumulator: Y -> A
  TYA() { this.A = this.eqFlags_(this.Y); }
  // Transfer Stack Pointer to Index X: SP -> X
  TSX() { this.X = this.eqFlags_(this.SP); }
  // Transfer Index X to Stack Pointer: X -> SP
  TXS() { this.SP = this.eqFlags_(this.X); }

  // STACK
  // Push Accumulator on Stack: A -> (SP)
  PHA() { this.pushByte(this.A); }
  // Pull Accumulator from Stack: (SP) -> A
  PLA() { this.A = this.pullByte(); }
  // Push Processor Status on Stack: SR -> (SP)
  PHP() { this.pushByte(this.SR); }
  // Pull Processor Status from Stack: (SP) -> SR
  PLP() { this.SR = this.pullByte(); }

  // SUBROUTINES AND JUMP
  // Jump to New Location
  JMP() { this.PC = this.MP - 1; }
  // Jump to New Location Saving Return Address
  JSR() {
    // TODO(!!!): nail down the pc++ nuances
    //  - specifically, during execution, PC is 1 before the next instr to run
    //  - so jump addresses are actually instruction minus 1
    this.pushWord(this.PC);
    this.PC = this.MP - 1;
  }
  // Return from Subroutine
  RTS() { this.PC = this.pullWord();
          this.message += '\t\t\tPC=' + hex(this.PC); }
  // Return from Interrupt
  RTI() {
    this.SR = this.pullByte();
    // NOTE: INTERRUPTS GO AFTER ++PC, so we need to un-add
    this.PC = this.pullWord() - 1;
  }

  // SET AND CLEAR
  // Set Carry Flag: 1 -> C
  SEC() { this.C = 1; }
  // Set Decimal Mode: 1 -> D
  SED() { this.D = 1; }
  // Set Interrupt Disable Status: 1 -> I
  SEI() { this.I = 1; }
  // Clear Carry Flag: 0 -> C
  CLC() { this.C = 0; }
  // Clear Decimal Mode: 0 -> D
  CLD() { this.D = 0; }
  // Clear Interrupt Disable Status: 0 -> I
  CLI() { this.I = 0; }
  // Clear Overflow Flag: 0 -> V
  CLV() { this.V = 0; }

  // MISC
  // No Operation
  NOP() {}
  // Break: 1 -> B, 1 -> I
  BRK() { this.B = this.I = 1; }
  

  get MP() {
    const addr = this.opcode.mode.func.call(this);
    if (addr == null || addr < 0) throw new Error('Jump to non-address.');
    return addr;
  }

  // get MM() {
  //   return this.mem_.getWord(this.MP);
  // }

  get M() {
    const addr = this.opcode.mode.func.call(this);
    if (addr == null) return this.A;
    if (addr < 0) return ~addr;
    return this.mem_.get(addr);
  }

  set M(value) {
    const addr = this.opcode.mode.func.call(this);
    if (addr < 0) throw new Error('Cannot write to immediate value.');
    if (addr == null) {
      this.A = value;
      this.message += '\t\tA=' + hex(value);
    } else {
      this.mem_.set(addr, value);
      this.message += '\t\t(' + hex(addr, 2) + ')=' + hex(value);
    }
  }

  /** @param {number} value A one-byte integer. */
  pushByte(value) {
    this.mem_.set(this.SP--, value);
    this.message += `\t\t(SP)=${hex(value)}, SP=${hex(this.SP,2)}`;
  }

  /** @param {number} value A two-byte integer. */
  pushWord(value) {
    this.mem_.setWord(this.SP - 1, value);
    this.SP -= 2;
    this.message += `\t\t(SP)=${hex(value, 2)}, SP=${hex(this.SP,2)}`;
  }

  /** @return {number} */
  pullByte(value) {
    const result = this.mem_.get(++this.SP);
    this.message += `\t\t${hex(result)}<-(SP), SP=${hex(this.SP,2)}`;
    return result;
  }

  /** @return {number} */
  pullWord(value) {
    const result = this.mem_.getWord((this.SP += 2) - 1);
    this.message += `\t\t${hex(result, 2)}<-(SP), SP=${hex(this.SP,2)}`;
    return result;
  }

  /**
   * Sets the sign and zero flags based on the number.
   * @param {number} arg
   * @return {number} The argument, for chaining.
   * @private
   */
  eqFlags_(arg) {
    this.S = arg & 0x80;
    this.Z = !arg;
    return arg;
  }

  /**
   * Compare register to memory.
   * @param {number} reg
   * @param {number} mem
   * @private
   */
  cmpFlags_(reg, mem) {
    this.C = !(this.S = reg < mem);
    this.Z = reg == mem;
    this.message += `\t\tR=${hex(reg)}, M=${hex(mem)}, C=${this.C?1:0}, S=${this.S?1:0}, Z=${this.Z?1:0}`;
  }   

  /**
   * Check if a jump occured on the same or different page,
   * and set extra cycles accordingly.
   * @param {number} addr
   * @return {number} The input address.
   * @private
   */
  checkBranch_(addr) {
    this.message += `\t\tPC=${hex(this.PC, 2)}->${hex(addr, 2)}`;
    this.wait = ((this.PC & 0xf000) == (addr & 0xf000)) ? 1 : 2;
    return addr;
  }

  /**
   * Adds addresses and sets extra wait if there's a page crossing.
   * @param {number} addr A 16-bit address.
   * @param {number} index An 8-bit index register.
   * @return {number} The sum
   */
  checkCross_(addr, index) {
    const sum = addr + index;
    if (sum & 0xff00 != addr & 0xff00) {
      this.wait += 1;
    }
    return sum;
  }
}


/** An addressing mode. */
class AddressingMode {
  /**
   * @param {string} fmt
   * @param {function(!Cpu): ?number} func
   */
  constructor(fmt, func) {
    /** @const {string} */
    this.fmt = fmt;
    /** @const {number} */
    this.bytes = /\$\$/.test(fmt) ? 2 : /\$/.test(fmt) ? 1 : 0;
    /** @const {function(!Cpu): ?number} */
    this.func = func;

    const signed = /\+\$/.test(fmt);
    const before = fmt.replace(/\+?\$\$?.*/, '');
    const after = fmt.replace(/.*\+?\$\$?/, '');
    this.format =
        !this.bytes ?
        arg => fmt :
        arg => {
          return `${before}${hex(arg, this.bytes, signed)}${after}`
        };
  }
}


/** An opcode, with an addressing mode. */
class Opcode {
  /**
   * @param {string} name
   * @param {!AddressingMode} mode
   * @param {function(this: Cpu)} op
   * @param {number} cycles
   * @param {boolean} extraCycles
   */
  constructor(name, mode, op, cycles, extraCycles) {
    /** @const {string} */
    this.name = name;
    /** @const {!AddressingMode} */
    this.mode = mode;
    /** @const {function(this: Cpu)} */
    this.op = op;
    /** @const {number} */
    this.cycles = cycles;
    /** @const {boolean} */
    this.extraCycles = extraCycles;
  }

  /**
   * @param {number} arg
   * @return {string}
   */
  format(arg) {
    return `${this.name} ${this.mode.format(arg)}`;
  }

  /** @return {string} */
  toString() {
    return `${this.name} ${this.mode.fmt}`;
  }
}

/**
 * Builds the instruction table.
 * @return {!Array<!Opcode>}
 */
function instructionTable() {
  const modes = {};
  const ops = {};

  function op(name, func) {
    ops[name] = func;
  }
  function mode(fmt, func) {
    modes[fmt] = new AddressingMode(fmt, func);
  }

  // Standard Opcodes
  op('LDA', Cpu.prototype.LDA);
  op('LDX', Cpu.prototype.LDX);
  op('LDY', Cpu.prototype.LDY);
  op('STA', Cpu.prototype.STA);
  op('STX', Cpu.prototype.STX);
  op('STY', Cpu.prototype.STY);
  op('ADC', Cpu.prototype.ADC);
  op('SBC', Cpu.prototype.SBC);
  op('INC', Cpu.prototype.INC);
  op('INX', Cpu.prototype.INX);
  op('INY', Cpu.prototype.INY);
  op('DEC', Cpu.prototype.DEC);
  op('DEX', Cpu.prototype.DEX);
  op('DEY', Cpu.prototype.DEY);
  op('ASL', Cpu.prototype.ASL);
  op('LSR', Cpu.prototype.LSR);
  op('ROL', Cpu.prototype.ROL);
  op('ROR', Cpu.prototype.ROR);
  op('AND', Cpu.prototype.AND);
  op('ORA', Cpu.prototype.ORA);
  op('EOR', Cpu.prototype.EOR);
  op('CMP', Cpu.prototype.CMP);
  op('CPX', Cpu.prototype.CPX);
  op('CPY', Cpu.prototype.CPY);
  op('BIT', Cpu.prototype.BIT);
  op('BCC', Cpu.prototype.BCC);
  op('BCS', Cpu.prototype.BCS);
  op('BEQ', Cpu.prototype.BEQ);
  op('BMI', Cpu.prototype.BMI);
  op('BNE', Cpu.prototype.BNE);
  op('BPL', Cpu.prototype.BPL);
  op('BVC', Cpu.prototype.BVC);
  op('BVS', Cpu.prototype.BVS);
  op('TAX', Cpu.prototype.TAX);
  op('TXA', Cpu.prototype.TXA);
  op('TAY', Cpu.prototype.TAY);
  op('TYA', Cpu.prototype.TYA);
  op('TSX', Cpu.prototype.TSX);
  op('TXS', Cpu.prototype.TXS);
  op('PHA', Cpu.prototype.PHA);
  op('PLA', Cpu.prototype.PLA);
  op('PHP', Cpu.prototype.PHP);
  op('PLP', Cpu.prototype.PLP);
  op('JMP', Cpu.prototype.JMP);
  op('JSR', Cpu.prototype.JSR);
  op('RTS', Cpu.prototype.RTS);
  op('RTI', Cpu.prototype.RTI);
  op('SEC', Cpu.prototype.SEC);
  op('SED', Cpu.prototype.SED);
  op('SEI', Cpu.prototype.SEI);
  op('CLC', Cpu.prototype.CLC);
  op('CLD', Cpu.prototype.CLD);
  op('CLI', Cpu.prototype.CLI);
  op('CLV', Cpu.prototype.CLV);
  op('NOP', Cpu.prototype.NOP);
  op('BRK', Cpu.prototype.BRK);
  // Illegal Opcodes
  function combo(a, b) {
    if (!a || !b) throw new Error('bad reference');
    return function() { a.call(this); b.call(this); };
  }
  op('KIL', Cpu.prototype.KIL);
  op('SLO', combo(Cpu.prototype.ASL, Cpu.prototype.ORA));
  op('XAA', combo(Cpu.prototype.TXA, Cpu.prototype.AND));
  op('RLA', combo(Cpu.prototype.ROL, Cpu.prototype.AND));

  // Addressing Modes
  mode('A', Cpu.prototype.accumulator);
  mode('$$', Cpu.prototype.absolute);
  mode('$$,X', Cpu.prototype.absoluteX);
  mode('$$,Y', Cpu.prototype.absoluteY);
  mode('#$', Cpu.prototype.immediate);
  mode('', Cpu.prototype.implied);
  mode('($$)', Cpu.prototype.indirect);
  mode('($,X)', Cpu.prototype.indirectX);
  mode('($),Y', Cpu.prototype.indirectY);
  mode('+$', Cpu.prototype.relative);
  mode('$', Cpu.prototype.zeroPage);
  mode('$,X', Cpu.prototype.zeroPageX);
  mode('$,Y', Cpu.prototype.zeroPageY);

  const data = `
    00: BRK 7          | ORA ($,X) 6    | KIL!           | SLO! ($,X) 8
    04: NOP! $ 3       | ORA $ 3        | ASL $ 5        | SLO! $ 5
    08: PHP 3          | ORA #$ 2       | ASL A 2        | ANC! #$ 2
    0C: NOP! $$ 4      | ORA $$ 4       | ASL $$ 6       | SLO! $$ 6

    10: BPL +$ 2+      | ORA ($),Y 5+   | KIL!           | SLO! ($),Y 8
    14: NOP! $,X 4     | ORA $,X 4      | ASL $,X 6      | SLO! $,X 6
    18: CLC 2          | ORA $$,Y 4+    | NOP! A 2       | SLO! $$,Y 7
    1C: NOP! $$,X 4+   | ORA $$,X 4+    | ASL $$,X 7     | SLO! $$,X 7

    20: JSR $$ 6       | AND ($,X) 6    | KIL!           | RLA! ($,X) 8
    24: BIT $ 3        | AND $ 3        | ROL $ 5        | RLA! $ 5
    28: PLP 4          | AND #$ 2       | ROL A 2        | ANC! #$ 2
    2C: BIT $$ 4       | AND $$ 4       | ROL $$ 6       | RLA! $$ 6

    30: BMI +$ 2+      | AND ($),Y 5+   | KIL!           | RLA! ($),Y 8
    34: NOP! $,X 4     | AND $,X 4      | ROL $,X 6      | RLA! $,X 6
    38: SEC 2          | AND $$,Y 4+    | NOP! A 2       | RLA! $$,Y 7
    3C: NOP $$,X 4+    | AND $$,X 4+    | ROL $$,X 7     | RLA! $$,X 7

    40: RTI 6          | EOR ($,X) 6    | KIL!           | SRE! ($,X) 8
    44: NOP! $ 3       | EOR $ 3        | LSR $ 5        | SRE! $ 5
    48: PHA 3          | EOR #$ 2       | LSR A 2        | ALR! #$ 2
    4C: JMP $$ 3       | EOR $$ 4       | LSR $$ 6       | SRE! $$ 6

    50: BVC +$ 2+      | EOR ($),Y 5+   | KIL!           | SRE! ($),Y 8
    54: NOP! $,X 4     | EOR $,X 4      | LSR $,X 6      | SRE! $,X 6
    58: CLI 2          | EOR $$,Y 4+    | NOP! A 2       | SRE! $$,Y 7
    5C: NOP! $$,X 4+   | EOR $$,X 4+    | LSR $$,X 7     | SRE! $$,X 7

    60: RTS 6          | ADC ($,X) 6    | KIL!           | RRA! ($,X) 8
    64: NOP! $ 3       | ADC $ 3        | ROR $ 5        | RRA! $ 5
    68: PLA 4          | ADC #$ 2       | ROR A 2        | ARR! #$ 2
    6C: JMP ($$) 5     | ADC $$ 4       | ROR $$ 6       | RRA! $$ 6

    70: BVS +$ 2+      | ADC ($),Y 5+   | KIL!           | RRA! ($),Y 8
    74: NOP! $,X 4     | ADC $,X 4      | ROR $,X 6      | RRA! $,X 6
    78: SEI 2          | ADC $$,Y 4+    | NOP! A 2       | RRA! $$,Y 7
    7C: NOP! $$,X 4+   | ADC $$,X 4+    | ROR $$,X 7     | RRA! $$,X 7

    80: NOP! #$ 2      | STA ($,X) 6    | NOP! #$ 2      | SAX! ($,X) 6
    84: STY $ 3        | STA $ 3        | STX $ 3        | SAX! $ 3
    88: DEY 2          | NOP! #$ 2      | TXA 2          | XAA!! #$ 2
    8C: STY $$ 4       | STA $$ 4       | STX $$ 4       | SAX! $$ 4

    90: BCC +$ 2+      | STA ($),Y 6    | KIL!           | AHX!! ($),Y 6
    94: STY $,X 4      | STA $,X 4      | STX $,Y 4      | SAX! $,Y 4
    98: TYA 2          | STA $$,Y 5     | TXS 2          | TAS!! $$,Y 5
    9C: SHY!! $$,X 5   | STA $$,X 5     | SHX!! $$,Y 5   | AHX!! $$,Y 5

    A0: LDY #$ 2       | LDA ($,X) 6    | LDX #$ 2       | LAX! ($,X) 6
    A4: LDY $ 3        | LDA $ 3        | LDX $ 3        | LAX! $ 3
    A8: TAY 2          | LDA #$ 2       | TAX 2          | LAX!! #$ 2
    AC: LDY $$ 4       | LDA $$ 4       | LDX $$ 4       | LAX! $$ 4

    B0: BCS +$ 2+      | LDA ($),Y 5+   | KIL!           | LAX! ($),Y 5+
    B4: LDY $,X 4      | LDA $,X 4      | LDX $,Y 4      | LAX! $,Y 4
    B8: CLV 2          | LDA $$,Y 4+    | TSX 2          | LAS! $$,Y 4+
    BC: LDY $$,X 4+    | LDA $$,X 4+    | LDX $$,Y 4+    | LAX! $$,Y 4+

    C0: CPY #$ 2       | CMP ($,X) 6    | NOP! #$ 2      | DCP! ($,X) 8
    C4: CPY $ 3        | CMP $ 3        | DEC $ 5        | DCP! $ 5
    C8: INY 2          | CMP #$ 2       | DEX 2          | AXS! #$ 2
    CC: CPY $$ 4       | CMP $$ 4       | DEC $$ 6       | DCP! $$ 6

    D0: BNE +$ 2+      | CMP ($),Y 5+   | KIL!           | DCP! ($),Y 8
    D4: NOP! $,X 4     | CMP $,X 4      | DEC $,X 6      | DCP! $,X 6
    D8: CLD 2          | CMP $$,Y 4+    | NOP! 2         | DCP! $$,Y 7
    DC: NOP! $$,X 4+   | CMP $$,X 4+    | DEC $$,X 7     | DCP! $$,X 7

    E0: CPX #$ 2       | SBC ($,X) 6    | NOP! #$ 2      | ISC! ($,X) 8
    E4: CPX $ 3        | SBC $ 3        | INC $ 5        | ISC! $ 5
    E8: INX 2          | SBC #$ 2       | NOP 2          | SBC! #$ 2
    EC: CPX $$ 4       | SBC $$ 4       | INC $$ 6       | ISC! $$ 6

    F0: BEQ +$ 2+      | SBC ($),Y 5+   | KIL!           | ISC! ($),Y 8
    F4: NOP! $,X 4     | SBC $,X 4      | INC $,X 6      | ISC! $,X 6
    F8: SED 2          | SBC $$,Y 4+    | NOP! 2         | ISC! $$,Y 7
    FC: NOP! $$,X 4+   | SBC $$,X 4+    | INC $$,X 7     | ISC! $$,X 7`;

  function buildOpcode(str) {
    //console.log('opcode: [' + str + ']');
    const split = str.split(' ');
    const mode = modes[split.length > 2 ? split[1] : ''];
    if (!mode) throw new Error('Unknown mode: ' + str);
    const cycles = split.length > 1 ? split[split.length - 1] : '1';
    let illegal = false;
    if (split[0][3] == '!') {
      split[0] = split[0].replace('!', '');
      split[0] = split[0].replace('!', ''); // some have two
      illegal = true;
    }
    let op = ops[split[0]];
    if (!op) {
      if (illegal) {
        op = ops['KIL'];
      } else {
        throw new Error('Unknown op: ' + str);
      }
    }
    // check for + in cycles, then check for relative addressing
    return new Opcode(split[0], mode, op,
                      Number.parseInt(cycles.replace('+', ''), 10),
                      /\+/.test(cycles));
  }

  const opcodes = data.split('\n')
      .map(line => line.replace(/^\s*[0-9A-F]{2}:\s*/, '').split('|'))
      .reduce((x, y) => x.concat(y), [])
      .map(s => s.trim())
      .filter(s => s)
      .map(buildOpcode);
  if (opcodes.length != 256) {
    throw new Exception('wrong number of opcodes: ' + opcodes.join('|'));
  }
  return opcodes;
}

function hex(num, opt_bytes, opt_signed) {
  if (num == null) {
    window.msg = true;
    setTimeout(() => { throw 'NULL number'; }, 0);
    return 'NUL';
  }
  let sign = '';
  if (opt_signed) {
    sign = '+';
    if (num < 0) {
      sign = '-';
      num = -num;
    }
  }
  const bytes = opt_bytes || 1;
  let str = num.toString(16).toUpperCase();
  while (str.length < bytes * 2) {
    str = '0000'.substring(0, bytes * 2 - str.length) + str;
  }
  return sign + '$' + str;
}
