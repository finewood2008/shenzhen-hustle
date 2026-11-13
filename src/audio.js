// 音乐和音效：全部用 Web Audio 现场合成，不依赖任何音频文件。
// 想换成真正的曲子，把 startMusic / stopMusic 改成播放 <audio> 即可；音效同理。
import { settings } from './settings.js';

let ctx = null, musicBus = null, sfxBus = null, echo = null;
const hz = m => 440 * 2 ** ((m - 69) / 12);

// 浏览器要求先有一次点击才能出声，所以在“开始”按钮里调用
export function initAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const soft = ctx.createBiquadFilter(); // 音乐整体压暗一点，不抢戏
    soft.type = 'lowpass'; soft.frequency.value = 2400;
    musicBus = ctx.createGain(); sfxBus = ctx.createGain();
    musicBus.connect(soft).connect(ctx.destination);
    sfxBus.connect(ctx.destination);
    echo = ctx.createDelay(1); echo.delayTime.value = 0.32; // 旋律带一点回声
    const fb = ctx.createGain(); fb.gain.value = 0.28;
    echo.connect(fb).connect(echo); echo.connect(musicBus);
    document.addEventListener('visibilitychange', () => { if (ctx) document.hidden ? ctx.suspend() : ctx.resume(); });
  }
  if (ctx.state === 'suspended') ctx.resume();
  applyAudioSettings();
}

export function applyAudioSettings() {
  if (!ctx) return;
  musicBus.gain.value = settings.music ? 0.5 : 0;
  sfxBus.gain.value = settings.sfx ? 0.6 : 0;
  if (settings.music) startMusic(); else stopMusic();
}

// 一个音：type 波形，f 频率，t 开始时间，d 时长，g 音量，to 滑到的频率
function tone(bus, { f, t = ctx.currentTime, d = 0.15, type = 'sine', g = 0.3, a = 0.006, to = 0 }) {
  const o = ctx.createOscillator(), v = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
  v.gain.setValueAtTime(0.0001, t);
  v.gain.exponentialRampToValueAtTime(g, t + a);
  v.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(v).connect(bus);
  o.start(t); o.stop(t + d + 0.03);
}
let noiseBuf = null;
function noise(bus, { t = ctx.currentTime, d = 0.08, g = 0.2, hp = 3000 }) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), v = ctx.createGain();
  src.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp;
  v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(0.0001, t + d);
  src.connect(f).connect(v).connect(bus);
  src.start(t, Math.random() * 0.5, d + 0.02);
}

// ---------- 音效 ----------
const on = () => ctx && settings.sfx && ctx.state === 'running';
const seq = (notes, step, opt) => notes.forEach((m, i) => tone(sfxBus, { f: hz(m), t: ctx.currentTime + i * step, ...opt }));
let lastBlip = 0;
export const sfx = {
  tap() { if (on()) tone(sfxBus, { f: 880, d: 0.05, type: 'triangle', g: 0.12 }); },
  blip() { // 对话打字声，限制频率
    if (!on() || ctx.currentTime - lastBlip < 0.055) return;
    lastBlip = ctx.currentTime;
    tone(sfxBus, { f: 520 + Math.random() * 120, d: 0.035, type: 'square', g: 0.035 });
  },
  buy() { if (on()) { tone(sfxBus, { f: 300, to: 180, d: 0.12, type: 'triangle', g: 0.3 }); noise(sfxBus, { d: 0.05, g: 0.12, hp: 1500 }); } },
  sell() { if (on()) { noise(sfxBus, { d: 0.04, g: 0.15 }); seq([88, 93], 0.07, { d: 0.25, type: 'triangle', g: 0.22 }); } }, // 收银机“叮”
  coin() { if (on()) seq([84, 91], 0.06, { d: 0.18, type: 'sine', g: 0.2 }); },
  win() { if (on()) seq([72, 76, 79, 84], 0.09, { d: 0.22, type: 'triangle', g: 0.22 }); },
  fail() { if (on()) { tone(sfxBus, { f: 196, to: 98, d: 0.35, type: 'sawtooth', g: 0.16 }); tone(sfxBus, { f: 185, to: 92, d: 0.35, type: 'sawtooth', g: 0.12 }); } },
  notify() { if (on()) seq([81, 86], 0.11, { d: 0.2, type: 'sine', g: 0.14 }); },
  talk() { if (on()) seq([67, 72], 0.07, { d: 0.12, type: 'sine', g: 0.14 }); }, // 有人跟你搭话
  metro() { // 地铁关门提示音，然后一阵风声
    if (!on()) return;
    seq([79, 79, 79], 0.16, { d: 0.1, type: 'square', g: 0.07 });
    noise(sfxBus, { t: ctx.currentTime + 0.5, d: 1.1, g: 0.1, hp: 500 });
  },
  arrive() { if (on()) seq([76, 72, 79], 0.2, { d: 0.5, type: 'sine', g: 0.16 }); }, // 到站“叮咚”
  end(good) { if (on()) seq(good ? [60, 64, 67, 72, 76, 79, 84] : [67, 65, 62, 58, 55], good ? 0.1 : 0.22, { d: 0.5, type: 'triangle', g: 0.2 }); },
};

// ---------- 背景音乐：按区生成的轻快循环 ----------
// 每个区一个调和速度；四小节和弦循环，上面飘一条五声音阶的旋律，每次都不完全一样。
const PROG = [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]]; // I  vi  IV  V
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
let timer = 0, nextT = 0, stepN = 0, key = 57, tempo = 84, walk = 3, calm = false;

export function setMood(districtIndex, isMap = false) {
  key = 53 + ((districtIndex * 5) % 8);
  tempo = 76 + (districtIndex % 5) * 5;
  calm = isMap;
}
function schedule() {
  if (!ctx || ctx.state !== 'running') return;
  const beat = 60 / tempo, eighth = beat / 2;
  if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
  while (nextT < ctx.currentTime + 0.3) {
    const bar = Math.floor(stepN / 8) % 4, pos = stepN % 8, chord = PROG[bar], t = nextT;
    if (pos === 0) { // 铺底的和弦
      for (const n of chord) tone(musicBus, { f: hz(key + n), t, d: beat * 4.1, type: 'sine', g: 0.05, a: 0.4 });
    }
    if (pos === 0 || pos === 5) tone(musicBus, { f: hz(key + chord[0] - 12), t, d: beat * 1.2, type: 'triangle', g: 0.14, a: 0.01 }); // 贝斯
    if (!calm) {
      if (pos % 2 === 1) noise(musicBus, { t, d: 0.03, g: 0.035, hp: 7000 }); // 轻轻的镲
      if (pos === 0 || pos === 4) tone(musicBus, { f: 110, to: 45, t, d: 0.12, type: 'sine', g: 0.16 }); // 底鼓
    }
    if (Math.random() < (calm ? 0.25 : 0.5)) { // 旋律：在五声音阶上随机游走
      walk = Math.max(0, Math.min(PENTA.length - 1, walk + Math.floor(Math.random() * 5) - 2));
      const f = hz(key + 12 + PENTA[walk]);
      const o = ctx.createOscillator(), v = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(0.09, t + 0.01); v.gain.exponentialRampToValueAtTime(0.0001, t + eighth * 1.8);
      o.connect(v); v.connect(musicBus); v.connect(echo);
      o.start(t); o.stop(t + eighth * 2);
    }
    nextT += eighth; stepN++;
  }
}
function startMusic() { if (!timer && ctx) { nextT = 0; timer = setInterval(schedule, 100); } }
function stopMusic() { clearInterval(timer); timer = 0; }
