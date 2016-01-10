//@ nes.compiled.js --language_in=ES6_STRICT --language_out=ES5_STRICT --create_source_map=nes.srcmap --jscomp_warning=checkTypes --jscomp_warning=checkVars

import Apu from './apu/apu';
import BankSwitcher from './bankswitcher';
import Clock from './clock';
import Cpu from './cpu';
import Memory from './mem';
import Nsf from './nsf';
import StepBufferWriter from './audio/stepbufferwriter';
import BufferedAudioNode from './audio/bufferedaudionode';

export default class NsfPlayer {

  constructor(ac, nsf) {
    this.nsf = nsf;
    this.clock = Clock.ntsc();
    this.cyclesPerFrame = nsf.cyclesPerFrame(this.clock);
    this.mem = new Memory();
    this.apu = new Apu(this.mem, this.clock);
    this.cpu = new Cpu(this.mem);
    this.banks = new BankSwitcher(this.mem);
    this.node = new BufferedAudioNode(ac, 2);
    this.node.connect(ac.destination);
    this.writer = new StepBufferWriter(this.node);
    this.promise = null;
  }

  start(song = 0) {
    this.nsf.init(this.cpu, this.mem, song, this.banks);
    this.node.reset();
    this.promise = null;
    this.play(null);
  }

  play(promise) {

    // TODO - add a check - store assembler logs for first ten (60?)
    // frames - if volume is never non-zero after these frames,
    // dump the whole log...?

    if (this.promise != promise) return;
    if (this.node.bufferTime() == 0) console.log('buffer underrun!');
    for (let i = 0; i < 10; i++) {
      for (let frameCycle = this.cyclesPerFrame; frameCycle >= 0; frameCycle--) {
        if (frameCycle != frameCycle) throw new Error('NaN');
        if (this.cpu.PC != 0xFFFF) this.cpu.clock();
        this.apu.clock();
        this.clock.tick();
      }
      if (this.cpu.PC == 0xFFFF) {
        // console.log('New frame');
        this.nsf.frame(this.cpu);
      }
    }
    // Yield a single frame worth of steps
    promise = this.promise =
        this.writer.write(this.apu.steps(), this.clock.time)
            //.then(() => this.play(promise));
            .then(() => { setTimeout(() => this.play(promise), 0); });
    // console.log('Yield data', data);
  }

  stop() {
    this.promise = null;
  }
}

function readLocalFiles() {
  const file = document.getElementById('files').files[0];
  const reader = new FileReader();
  reader.onload = (e => startEmu(e.target.result));
  reader.readAsArrayBuffer(file);
}

function startEmu(buf) {
  const nsf = new Nsf(buf);
new Cpu(new Memory()).log(nsf + '');
  const ac = new AudioContext();
  const player = new NsfPlayer(ac, nsf);
  window.PLAYER = player;

  let track = 2;

  player.start(track);

  const stop = document.getElementById('stop');
  const next = document.getElementById('next');

  stop.style.display = '';
  next.style.display = '';

  stop.addEventListener('click', () => player.stop());
  next.addEventListener('click', () => player.start(++track));

}

document.getElementById('fetch').addEventListener('click', readLocalFiles);
