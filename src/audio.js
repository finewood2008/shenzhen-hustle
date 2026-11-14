// 音乐和音效：全部用 Web Audio 现场合成，不依赖任何音频文件。
// 背景音乐是写好的城市流行曲（固定的旋律与和弦），用合成的电钢琴、贝斯、主旋律和鼓组现场演奏。
// 想换成真正的录音，把 startMusic / stopMusic 改成播放 <audio> 即可；音效同理。
import { settings } from './settings.js';

let ctx = null, musicBus = null, sfxBus = null;
let mix = null, revSend = null, dlySend = null, delay = null; // 音乐的干声、混响和回声
const hz = m => 440 * 2 ** ((m - 69) / 12);

// 生成一段混响用的脉冲响应：两声道、指数衰减的噪声
function impulse(sec, decay) {
  const n = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** decay;
  }
  return buf;
}

// 浏览器要求先有一次点击才能出声，所以在“开始”按钮里调用
export function initAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    // 音乐：各乐器 → mix → 压缩 → 音量 → 输出；混响和回声从 mix 旁路送出再回到压缩器前
    musicBus = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.2;
    mix = ctx.createGain(); mix.gain.value = 0.55; // 给压缩器留余量，不削顶
    mix.connect(comp); comp.connect(musicBus); musicBus.connect(ctx.destination);
    const rev = ctx.createConvolver(); rev.buffer = impulse(2.4, 3);
    revSend = ctx.createGain(); revSend.gain.value = 0.32;
    revSend.connect(rev); rev.connect(comp);
    delay = ctx.createDelay(1.5);
    const fb = ctx.createGain(); fb.gain.value = 0.3;
    const dlyTone = ctx.createBiquadFilter(); dlyTone.type = 'lowpass'; dlyTone.frequency.value = 2600;
    dlySend = ctx.createGain(); dlySend.gain.value = 0.22;
    dlySend.connect(delay); delay.connect(dlyTone); dlyTone.connect(fb); fb.connect(delay); dlyTone.connect(comp);
    sfxBus = ctx.createGain();
    sfxBus.connect(ctx.destination);
    document.addEventListener('visibilitychange', () => { if (ctx) document.hidden ? ctx.suspend() : ctx.resume(); });
  }
  if (ctx.state === 'suspended') ctx.resume();
  applyAudioSettings();
}

export function applyAudioSettings() {
  if (!ctx) return;
  musicBus.gain.value = settings.music ? 0.55 : 0;
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

// ---------- 乐器 ----------
// 每个乐器都是一次性的节点组合：在时间 t 开始、持续 dur 秒，接到 out（默认 mix），可以带混响和回声的发送量
function env(g, t, peak, attack, hold, release) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  return t + attack + hold + release;
}
function sends(node, rev = 0, dly = 0) {
  node.connect(mix);
  if (rev) { const g = ctx.createGain(); g.gain.value = rev; node.connect(g); g.connect(revSend); }
  if (dly) { const g = ctx.createGain(); g.gain.value = dly; node.connect(g); g.connect(dlySend); }
}

// 电钢琴：两组调频，一组给温暖的琴体，一组给敲击时那一下“叮”的金属声
function epiano(t, midi, dur, vel = 0.12, { rev = 0.35, bell = 0 } = {}) {
  const f = hz(midi), out = ctx.createGain();
  const car = ctx.createOscillator(); car.frequency.value = f;
  const mod = ctx.createOscillator(); mod.frequency.value = f;
  const modG = ctx.createGain();
  modG.gain.setValueAtTime(f * (1.6 + bell * 2), t); modG.gain.exponentialRampToValueAtTime(f * 0.15, t + 0.9);
  mod.connect(modG); modG.connect(car.frequency);
  const tine = ctx.createOscillator(); tine.frequency.value = f * 14;
  const tineG = ctx.createGain();
  tineG.gain.setValueAtTime(f * (0.9 + bell * 3), t); tineG.gain.exponentialRampToValueAtTime(1, t + 0.06);
  tine.connect(tineG); tineG.connect(car.frequency);
  // 按下去马上到最响，然后像真琴一样慢慢衰减，到时间再松开
  const off = t + Math.max(0.05, dur), end = off + 0.5;
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(vel, t + 0.005);
  out.gain.setTargetAtTime(vel * 0.35, t + 0.01, 0.55);
  out.gain.setTargetAtTime(0.0001, off, 0.1);
  car.connect(out); sends(out, rev, bell ? 0.4 : 0);
  for (const o of [car, mod, tine]) { o.start(t); o.stop(end + 0.05); }
}

// 合成贝斯：锯齿波过一个带共鸣的低通滤波器，每个音开头滤波器往下扫一下
function bass(t, midi, dur, vel = 0.15) {
  const f = hz(midi), out = ctx.createGain(), lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.Q.value = 5;
  lp.frequency.setValueAtTime(1800, t); lp.frequency.exponentialRampToValueAtTime(380, t + 0.22);
  const saw = ctx.createOscillator(); saw.type = 'sawtooth'; saw.frequency.value = f;
  const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = f;
  const subG = ctx.createGain(); subG.gain.value = 0.45;
  saw.connect(lp); sub.connect(subG); subG.connect(lp); lp.connect(out);
  const end = env(out, t, vel, 0.004, Math.max(0.02, dur * 0.85), 0.06);
  sends(out);
  for (const o of [saw, sub]) { o.start(t); o.stop(end + 0.05); }
}

// 主旋律：两个略微失谐的锯齿波加一个三角波，开头稍晚一点出现揉弦，带回声
function lead(t, midi, dur, vel = 0.1) {
  const f = hz(midi), out = ctx.createGain(), lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 3400; lp.Q.value = 0.7;
  const vib = ctx.createOscillator(); vib.frequency.value = 5.6;
  const vibG = ctx.createGain(); vibG.gain.setValueAtTime(0, t); vibG.gain.linearRampToValueAtTime(f * 0.006, t + 0.25);
  vib.connect(vibG);
  const oscs = [['sawtooth', -7], ['sawtooth', 7], ['triangle', 0]].map(([type, cents]) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = cents;
    vibG.connect(o.frequency); o.connect(lp); return o;
  });
  lp.connect(out);
  const end = env(out, t, vel, 0.018, Math.max(0.03, dur - 0.05), 0.16);
  sends(out, 0.3, 0.55);
  for (const o of [...oscs, vib]) { o.start(t); o.stop(end + 0.05); }
}

// 铺底：慢慢起来的失谐锯齿波和弦，地图上用
function pad(t, midis, dur, vel = 0.03) {
  const out = ctx.createGain(), lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 1100;
  const oscs = [];
  for (const m of midis) for (const cents of [-9, 9]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = cents;
    o.connect(lp); oscs.push(o);
  }
  lp.connect(out);
  const end = env(out, t, vel, 0.8, Math.max(0.1, dur - 0.8), 1.4);
  sends(out, 0.6);
  for (const o of oscs) { o.start(t); o.stop(end + 0.05); }
}

// 鼓组
function kick(t, vel = 0.42) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.12);
  env(g, t, vel, 0.002, 0.015, 0.18);
  o.connect(g); g.connect(mix); o.start(t); o.stop(t + 0.32);
}
function hit(t, { vel, hp = 0, bp = 0, q = 0.8, len, rev = 0 }) { // 噪声打击：军鼓、踩镲都用它
  if (!noiseBuf) noise(sfxBus, { t, d: 0.001, g: 0.0001 }); // 借音效那边生成一次噪声
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuf;
  f.type = bp ? 'bandpass' : 'highpass'; f.frequency.value = bp || hp; f.Q.value = q;
  env(g, t, vel, 0.001, 0.005, len);
  src.connect(f); f.connect(g); sends(g, rev);
  src.start(t, Math.random() * 0.5, len + 0.05);
}
function snare(t, vel = 0.32) {
  hit(t, { vel, bp: 1900, q: 0.7, len: 0.17, rev: 0.25 });
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
  env(g, t, vel * 0.7, 0.001, 0.01, 0.09);
  o.connect(g); g.connect(mix); o.start(t); o.stop(t + 0.14);
}
const hat = (t, vel = 0.12, open = false) => hit(t, { vel: vel * 2, hp: 7000, len: open ? 0.24 : 0.04 });

// ---------- 曲子 ----------
// 音高都写成相对主音的半音数：和弦从 C4（60）算，旋律从 C5（72）算，贝斯从 C3（48）算；再按区整体移调。
// bars：每小节一到两个和弦 [起始的十六分音符, 和弦名]；melody：每小节一串 [起始十六分, 音, 长度]
const CH = {
  Fmaj7: { v: [-7, -3, 0, 4], r: -7 }, E7: { v: [-8, -4, 2, 6], r: -8 }, Am7: { v: [-3, 0, 4, 7], r: -3 },
  Gm7: { v: [-5, -2, 2, 5], r: -5 }, C9: { v: [-8, -2, 2, 7], r: 0 }, Dm9: { v: [-7, -3, 0, 4], r: -10 },
  G13: { v: [-7, -1, 4, 9], r: -5 }, Cmaj9: { v: [-8, -5, -1, 2], r: 0 }, A7b9: { v: [-5, -2, 1, 4], r: -3 },
  Cmaj7: { v: [-8, -5, -1, 2], r: 0 }, Am9: { v: [-5, -1, 0, 4], r: -3 }, Dm7: { v: [-7, -3, 0, 2], r: -10 },
  G7sus: { v: [-7, 0, 2, 7], r: -5 }, G7: { v: [-7, -1, 2, 7], r: -5 }, Em7: { v: [-5, -1, 2, 4], r: -8 },
  A7: { v: [-5, 1, 4, 9], r: -3 },
};
const SONGS = [
  { name: '霓虹', tempo: 108, swing: 0.06,
    bars: [[[0, 'Fmaj7']], [[0, 'E7']], [[0, 'Am7']], [[0, 'Gm7'], [8, 'C9']], [[0, 'Dm9']], [[0, 'G13']], [[0, 'Cmaj9']], [[0, 'A7b9']]],
    comp: [[0, 5], [6, 2], [10, 5]],                                 // 电钢琴在小节里哪几下弹和弦
    bass: [[0, 0, 3], [3, 12, 1], [6, 0, 2], [8, 0, 2], [10, 7, 2], [12, 0, 2], [14, 12, 2]],
    kick: [0, 10], snare: [4, 12], hats: [0, 2, 4, 6, 8, 10, 12], open: [14],
    melody: [
      [[2, 4, 2], [4, 7, 2], [6, 9, 3], [10, 7, 2], [12, 4, 4]],
      [[0, 2, 2], [2, 4, 2], [4, 8, 4], [8, 11, 2], [10, 8, 2], [12, 4, 4]],
      [[0, 9, 3], [3, 12, 3], [6, 11, 2], [8, 9, 2], [10, 7, 2], [12, 4, 3]],
      [[0, 5, 2], [2, 7, 2], [4, 10, 4], [8, 9, 2], [10, 7, 2], [12, 4, 4]],
      [[2, 5, 2], [4, 9, 2], [6, 12, 4], [10, 16, 2], [12, 14, 4]],
      [[0, 11, 2], [2, 9, 2], [4, 7, 2], [6, 5, 2], [8, 4, 4], [12, 2, 4]],
      [[0, 4, 3], [3, 7, 3], [6, 11, 2], [8, 14, 4], [12, 11, 4]],
      [[0, 13, 4], [4, 9, 2], [6, 7, 2], [8, 4, 8]],
    ] },
  { name: '晚风', tempo: 96, swing: 0.16,
    bars: [[[0, 'Cmaj7']], [[0, 'Am9']], [[0, 'Dm7']], [[0, 'G7sus'], [8, 'G7']], [[0, 'Em7']], [[0, 'A7']], [[0, 'Dm9']], [[0, 'G13']]],
    comp: [[0, 3], [4, 2], [7, 3], [12, 3]],
    bass: [[0, 0, 4], [6, 0, 1], [7, 7, 2], [10, 12, 2], [14, 7, 2]],
    kick: [0, 7, 10], snare: [4, 12], hats: [0, 2, 4, 6, 8, 10, 12, 14], open: [],
    melody: [
      [[0, 7, 2], [2, 4, 2], [4, 2, 2], [6, 4, 6], [12, 7, 2], [14, 11, 2]],
      [[0, 12, 4], [4, 11, 2], [6, 9, 2], [8, 4, 8]],
      [[0, 5, 2], [2, 9, 2], [4, 12, 2], [6, 14, 4], [10, 12, 2], [12, 9, 4]],
      [[0, 7, 6], [6, 5, 2], [8, 2, 4], [12, -1, 4]],
      [[2, 11, 2], [4, 14, 2], [6, 16, 4], [10, 14, 2], [12, 11, 4]],
      [[0, 13, 2], [2, 9, 2], [4, 7, 4], [8, 4, 2], [10, 7, 2], [12, 9, 4]],
      [[0, 5, 3], [3, 4, 3], [6, 2, 2], [8, 0, 2], [10, 2, 2], [12, 5, 4]],
      [[0, 4, 4], [4, 2, 2], [6, -1, 2], [8, 2, 8]],
    ] },
];
const KEYS = [0, -3, 2, -5, 3, -2, 4, -4, 1, -1]; // 每个区一个调

// ---------- 演奏 ----------
// 以十六分音符为单位往前排；每小节开头才换曲子，切换不会断在半拍上
let timer = 0, nextT = 0, step = 0, bar = 0, pass = 0;
let cur = null, want = { song: SONGS[0], key: 0, map: false };

export function setMood(districtIndex, isMap = false) {
  const i = Math.max(0, districtIndex);
  want = { song: SONGS[i % SONGS.length], key: KEYS[i % KEYS.length], map: isMap, tempo: SONGS[i % SONGS.length].tempo + (i % 3) * 2 };
}
const chordAt = (song, b, s) => { let c = null; for (const [at, name] of song.bars[b]) if (s >= at) c = CH[name]; return c; };

function playStep(t, s, sixteenth) {
  const { song, key, map } = cur, c = chordAt(song, bar, s);
  const K = 60 + key, len = n => n * sixteenth;
  if (map) { // 地图：铺底、琶音和轻贝斯，不要鼓
    if (s === 0 || (s === 8 && song.bars[bar].length > 1)) pad(t, c.v.map(n => K + n), len(song.bars[bar].length > 1 ? 8 : 16));
    if (s % 2 === 0) epiano(t, K + 12 + c.v[(s / 2) % 4], len(3), 0.09, { rev: 0.5 });
    if (s === 0) bass(t, 48 + key + c.r, len(12), 0.09);
    if (pass === 1) for (const [at, n, l] of song.melody[bar]) if (at === s && at % 4 === 0) epiano(t, 84 + key + n, len(l + 2), 0.05, { rev: 0.6, bell: 1 });
    return;
  }
  for (const [at, l] of song.comp) if (at === s) for (const n of c.v) epiano(t, K + n, len(l), pass === 2 ? 0.1 : 0.085);
  for (const [at, iv, l] of song.bass) if (at === s) bass(t, 48 + key + c.r + iv, len(l));
  const breakdown = pass === 2 && bar < 4;
  if (song.kick.includes(s) && !(breakdown && s !== 0)) kick(t);
  if (song.snare.includes(s) && !breakdown) snare(t);
  if (song.hats.includes(s)) hat(t, s % 4 === 2 ? 0.075 : 0.045);
  else if (s % 2 === 1 && !breakdown) hat(t, 0.02);
  if (song.open.includes(s) && !breakdown) hat(t, 0.05, true);
  if (bar === 7 && s >= 13 && pass !== 2) snare(t, 0.16 + (s - 13) * 0.06); // 每八小节结尾一小段过门
  for (const [at, n, l] of song.melody[bar]) if (at === s) {
    if (pass === 0) lead(t, 72 + key + n, len(l));
    else if (pass === 1) epiano(t, 84 + key + n, len(l + 1), 0.08, { rev: 0.45, bell: 1 });
  }
}

function schedule() {
  if (!ctx || ctx.state !== 'running') return;
  if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.06;
  while (nextT < ctx.currentTime + 0.25) {
    const s = step % 16;
    if (s === 0 && (!cur || cur.song !== want.song || cur.key !== want.key || cur.map !== want.map)) {
      const restart = !cur || cur.song !== want.song;
      cur = { ...want };
      if (restart) { bar = 0; pass = 0; }
    }
    const tempo = cur.map ? 78 : cur.tempo, sixteenth = 60 / tempo / 4;
    delay.delayTime.setValueAtTime(sixteenth * 3, nextT); // 回声卡在附点八分音符上
    const swing = s % 2 ? (cur.map ? 0.1 : cur.song.swing) * sixteenth : 0;
    playStep(nextT + swing, s, sixteenth);
    nextT += sixteenth; step++;
    if (step % 16 === 0) { bar = (bar + 1) % 8; if (bar === 0) pass = (pass + 1) % 3; }
  }
}
function startMusic() { if (!timer && ctx) { nextT = 0; step = 0; timer = setInterval(schedule, 50); } }
function stopMusic() { clearInterval(timer); timer = 0; }
