// 街上的路人：Tripo 生成并绑好骨骼的角色（assets/people/<id>.glb，带 idle / walk 两个动作）。
// assets/people/index.json 登记有哪些角色：{ "rider": { "name": "外卖骑手", "file": "rider.glb" } }（rotY 可选，默认 -90）
// 第一次进街区时才开始下载；没下载完或下载失败的，街上先用代码拼的小人。
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from '../vendor/loaders/SkeletonUtils.js';

const DIR = 'assets/people/';
let ids = [];          // 登记了的角色，顺序固定，路人按编号轮流用
let manifest = {};
const models = {};     // id -> gltf
const mats = new Map(); // 原材质 -> 换成的 Lambert 材质
const waiting = [];
let started = false;

export function loadPeople() {
  if (started) return;
  started = true;
  fetch(DIR + 'index.json').then(r => (r.ok ? r.json() : {})).catch(() => ({})).then(async list => {
    manifest = list;
    ids = Object.keys(list).filter(id => list[id] && list[id].file);
    const loader = new GLTFLoader();
    for (const id of ids) { // 一个一个下，先下完的先换上
      await new Promise(done => loader.load(DIR + list[id].file, g => {
        g.userData.stride = inPlace(g);
        models[id] = g;
        waiting.forEach(fn => fn(id));
        done();
      }, undefined, e => { console.warn(`路人模型 ${list[id].file} 加载失败`, e); done(); }));
    }
  });
}
// Tripo 的走路动作自带位移：一个循环里胯部往前走一段，到循环结尾又跳回原点，人就一闪一闪的。
// 这里把胯部的水平位移扣掉，改成原地踏步，前进交给游戏自己移动；返回动作原本的行走速度（模型单位/秒）。
function inPlace(g) {
  let stride = 0;
  for (const clip of g.animations) {
    const t = clip.tracks.find(tr => /Hips\.position$/.test(tr.name));
    if (!t) continue;
    const v = t.values, n = v.length / 3, times = t.times, dur = times[n - 1] - times[0] || 1;
    for (const k of [0, 2]) { // x、z 两个水平方向
      const drift = v[(n - 1) * 3 + k] - v[k];
      if (clip.name === 'walk') stride = Math.max(stride, Math.abs(drift) / dur);
      for (let i = 0; i < n; i++) v[i * 3 + k] -= drift * (times[i] - times[0]) / dur;
    }
  }
  return stride;
}

// 有新角色加载好时通知（参数是角色 id）
export function onPerson(fn) { waiting.push(fn); return () => { const i = waiting.indexOf(fn); if (i >= 0) waiting.splice(i, 1); }; }

// 第 n 个路人用哪个角色（同一个区同一个编号，长相固定）
export const personId = n => (ids.length ? ids[((n % ids.length) + ids.length) % ids.length] : null);
export const personArt = id => (id && manifest[id] ? DIR + (manifest[id].art || `${id}.webp`) : null);
export const personName = id => (id && manifest[id] ? manifest[id].name : null);

// 做一个路人：height 是身高。返回 { root, play, update }，模型还没加载就返回 null
export function makePerson(id, height = 1.75) {
  const g = models[id];
  if (!g) return null;
  const model = cloneSkinned(g.scene);
  model.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.frustumCulled = false;
    const src = o.material; // 和场景其余部分统一用 Lambert；同一个角色共用一份材质
    o.material = mats.get(src) || mats.set(src, new THREE.MeshLambertMaterial({ map: src.map || null, color: src.map ? 0xffffff : src.color })).get(src);
  });
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true); // 带骨骼的网格要按顶点精确量，粗略包围盒不准
  model.scale.setScalar(height / Math.max(0.01, box.max.y - box.min.y));
  model.rotation.y = THREE.MathUtils.degToRad(manifest[id].rotY ?? -90); // Tripo 导出的角色正面朝 +x，转到游戏里约定的 +z
  const root = new THREE.Group();
  root.add(model);
  root.userData.keep = true; // 网格、贴图和材质都是共用的，换区时不要释放

  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const clip of g.animations) actions[clip.name] = mixer.clipAction(clip);
  let cur = null;
  function play(name, speed = 1) {
    const a = actions[name] || actions[Object.keys(actions)[0]];
    if (!a) return;
    a.timeScale = speed;
    if (cur === a) return;
    a.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.2).play();
    a.time = Math.random() * a.getClip().duration; // 路人步子错开，不会齐步走
    if (cur) cur.fadeOut(0.2);
    cur = a;
  }
  play('idle');
  // stride：这个身高下，走路动作按原速播放时一秒走多远；游戏按它来配路人的移动速度，脚才不会打滑
  return { root, play, update: dt => mixer.update(dt), stride: (g.userData.stride || 0.4) * model.scale.x };
}
