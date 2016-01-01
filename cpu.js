


export class Cpu {

  constructor(/** Cpu.Params */ params) {
    /** @const {Cpu.Params} */
    this.params = params;
  }

}


/**
 * clock: frequency in Hz
 * @enum {{clock: number}}
 */
Cpu.Params = {
  NTSC: {clock: 1789773},
  PAL: {clock: 1662607},
};
