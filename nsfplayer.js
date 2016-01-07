import Clock from './clock';
import Cpu from './cpu';
import Memory from './mem';
import Nsf from './nsf';
import Apu from './apu/apu';
import StepGeneratorNode from './stepgeneratornode';

export default class NsfPlayer {

  constructor(ac, nsf) {
    this.nsf = nsf;
    this.clock = Clock.ntsc();
    this.cyclesPerFrame = nsf.cyclesPerFrame(this.clock);
    this.mem = new Memory();
    this.apu = new Apu(this.mem, this.clock);
    this.cpu = new Cpu(this.mem);
    this.node = new StepGeneratorNode(ac, 2);
  }

  start(song = 0) {
    this.nsf.init(this.cpu, this.mem, song);
    this.node.generator = this.play();
  }

  *play() {
    //yield [];
    let frameCounter = this.cyclesPerFrame;
    // console.log('Starting frame counter at ' + frameCounter);
    for (let i = 0; i < 600 * this.cyclesPerFrame; i++) {
      if (frameCounter != frameCounter) throw new Error('NaN');
      if (--frameCounter <= 0) {
        frameCounter = this.cyclesPerFrame;
        if (this.cpu.PC == 0xFFFF) {
          // console.log('New frame');
          this.nsf.frame(this.cpu);
        }
        // Yield a single frame worth of steps
        const data = this.apu.steps();
        // console.log('Yield data', data);
        yield data;
      }
      if (this.cpu.PC != 0xFFFF) this.cpu.clock();
      this.apu.clock();
      this.clock.tick();
    }
  }

  stop() {
    this.node.generator = null;
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
  console.log(nsf + '');
  const ac = new AudioContext();
  const player = new NsfPlayer(ac, nsf);

  let track = 1;

  player.start(track);

  const stop = document.getElementById('stop');
  const next = document.getElementById('next');

  stop.style.display = '';
  next.style.display = '';

  stop.addEventListener('click', () => player.stop());
  next.addEventListener('click', () => player.start(++track));

}

document.getElementById('fetch').addEventListener('click', readLocalFiles);
