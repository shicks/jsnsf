import Clock from './clock';
import Cpu from './cpu';
import Memory from './mem';
import Nsf from './nsf';
import Apu from './apu/apu';

const clock = CLock.ntsc();
const mem = new Memory();
const apu = new Apu(mem, clock);
const cpu = new Cpu(mem);

function readLocalFiles() {
  const file = document.getElementById('files').files[0];
  const reader = new FileReader();
  reader.onload = (e => startEmu(e.target.result));
  reader.readAsArrayBuffer(file);
}

function startEmu(buf) {
  const nsf = new Nsf(buf);
  console.log(nsf + '');
  nsf.init(cpu, mem);
  clockCpu(nsf, 5, nsg.cyclesPerFrame())
}

function clockCpu(nsf, frames, cyclesLeft) {
  if (cpu.PC == 0) {
    console.log('returned');
    return; // done?
  }

  const start = new Date().getTime();
  for (let i = 0; i < 17890; i++) {
    
    cpu.clock();
    if (cpu.PC == 0xffff) {
      if (--frames == 0) {
        console.log('last frame');
        return;
      }
      console.log('next frame');
      nsf.frame(cpu, mem);
    }
  }
  setTimeout(() => clockCpu(nsf, frames), 10 + start - new Date().getTime());
}

document.getElementById('fetch').addEventListener('click', readLocalFiles);
