// 主角潘潘：加载带骨骼和动作的 3D 模型（assets/panpan.glb），给街区和地图各做一个实例。
// 模型身高 1.0 m、脚底在原点、面朝 +z，自带 idle / walk / run / jump / turn / hurt / fall 等动作。
// 加载失败或还没加载完时，调用方继续用原来的小人顶替。
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from '../vendor/loaders/SkeletonUtils.js';

export const PANPAN_ART = 'assets/panpan.png'; // 正面设定图，用作头像

let gltf = null;
const waiting = [];
// 页面一打开就开始下载；ready(fn) 在加载好之后调用 fn（已经加载好则马上调用）
new GLTFLoader().load('assets/panpan.glb',
  g => { gltf = g; waiting.splice(0).forEach(fn => fn()); },
  undefined,
  e => console.warn('潘潘模型加载失败，先用简易小人顶替', e));
export const panpanReady = () => !!gltf;
export function onPanpan(fn) { if (gltf) fn(); else waiting.push(fn); }

// 给潘潘背上一个双肩包。坐标是模型原始单位（身高 1.0）：躯干在 y 0.12～0.33，后背在 z ≈ -0.15，再往上就是大头。
// 包先按模型坐标摆好，再挂到脊柱骨骼上，走路跑动时跟着身体动。
export const PACK_COLOR = 0xe8572a;
function addBackpack(model, color) {
  const spine = model.getObjectByName('mixamorigSpine1');
  if (!spine) return;
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  const dark = new THREE.Color(color).multiplyScalar(0.72).getHex();
  const pack = new THREE.Group();
  const box = (w, h, d, c, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    m.position.set(x, y, z); m.castShadow = true; pack.add(m); return m;
  };
  // 头太大，镜头又从斜上方看，包得做大、往后凸出才露得出来；顶部仍在头的下方，不会穿模
  box(0.32, 0.24, 0.17, color, 0, 0.2, -0.235);      // 包身
  box(0.325, 0.05, 0.18, dark, 0, 0.315, -0.235);    // 包盖
  box(0.2, 0.11, 0.04, dark, 0, 0.16, -0.335);       // 外面的小口袋
  box(0.04, 0.04, 0.03, 0xfacc15, 0, 0.3, -0.33);    // 扣子
  for (const x of [-0.175, 0.175]) box(0.04, 0.12, 0.1, dark, x, 0.15, -0.235); // 两侧的水杯袋
  for (const x of [-0.075, 0.075]) {                 // 两根背带：从包顶越过肩膀，垂到胸前
    box(0.03, 0.025, 0.2, dark, x, 0.318, -0.07);
    box(0.03, 0.12, 0.02, dark, x, 0.26, 0.122).rotation.x = -0.12;
  }
  model.add(pack);
  model.updateMatrixWorld(true);
  spine.attach(pack); // 保持现在的位置，改挂到骨骼上
}

// 做一个潘潘：height 是想要的身高。返回 { root, play, emote, update }
export function makePanpan(height = 2) {
  if (!gltf) return null;
  const model = cloneSkinned(gltf.scene);
  addBackpack(model, PACK_COLOR);
  model.scale.setScalar(height);
  model.traverse(o => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; }
  });
  const root = new THREE.Group();
  root.add(model);
  root.userData.keep = true; // 换区重建街道时不要把它的贴图和几何体释放掉

  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);
  let base = null, oneShot = null, oneShotEnd = 0, clock = 0;

  // 循环动作（idle / walk / run），淡入淡出切换
  function play(name, fade = 0.25) {
    const a = actions[name];
    if (!a || base === a) return;
    a.reset().setLoop(THREE.LoopRepeat, Infinity).setEffectiveWeight(1).fadeIn(fade).play();
    if (base && !oneShot) base.fadeOut(fade);
    base = a;
  }
  // 一次性动作：jump / hurt / fall 等。maxSec 限制最长播放多久（有些动作自带很长的尾巴）
  function emote(name, maxSec = 3) {
    const a = actions[name];
    if (!a) return;
    if (oneShot && oneShot !== a) oneShot.fadeOut(0.15);
    a.reset().setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.fadeIn(0.15).play();
    if (base) base.fadeOut(0.15);
    oneShot = a;
    oneShotEnd = clock + Math.min(maxSec, a.getClip().duration);
  }
  function update(dt) {
    clock += dt;
    if (oneShot && clock >= oneShotEnd) { // 一次性动作播完，回到原来的循环动作
      oneShot.fadeOut(0.3);
      if (base) base.reset().setEffectiveWeight(1).fadeIn(0.3).play();
      oneShot = null;
    }
    mixer.update(dt);
  }
  play('idle', 0);
  return { root, play, emote, update, get busy() { return !!oneShot; } };
}
