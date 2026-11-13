// 地图和街区共用的小模型与程序化贴图。
import * as THREE from '../vendor/three.module.min.js';

const FONT = '"PingFang SC","Microsoft YaHei",sans-serif';
const css = c => '#' + c.toString(16).padStart(6, '0');

function canvasTexture(c) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// 悬浮名字牌（始终朝向镜头）
export function labelSprite(text, { bg = 'rgba(15,23,42,.82)', fg = '#fff', size = 34 } = {}) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = `bold ${size}px ${FONT}`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 36, h = size + 26;
  c.width = w * 2; c.height = h * 2;
  ctx.scale(2, 2);
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.roundRect(0, 0, w, h, h / 2); ctx.fill();
  ctx.font = font; ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 2);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTexture(c), depthTest: false, transparent: true }));
  sp.scale.set(w / 30, h / 30, 1);
  sp.renderOrder = 10;
  return sp;
}

// 固定在墙上的招牌，正面朝 +z，自发光不受光照影响
export function signBoard(text, { w = 3, h = 0.8, bg = '#b91c1c', fg = '#fff', vertical = false } = {}) {
  const px = 72, c = document.createElement('canvas');
  c.width = Math.round(w * px); c.height = Math.round(h * px);
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, c.width - 8, c.height - 8);
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const chars = [...text];
  if (vertical) {
    const size = Math.min(c.width * 0.7, (c.height / chars.length) * 0.8);
    ctx.font = `bold ${size}px ${FONT}`;
    chars.forEach((ch, i) => ctx.fillText(ch, c.width / 2, (c.height * (i + 0.5)) / chars.length + size * 0.05));
  } else {
    const size = Math.min(c.height * 0.64, (c.width / chars.length) * 0.84);
    ctx.font = `bold ${size}px ${FONT}`;
    ctx.fillText(text, c.width / 2, c.height / 2 + size * 0.06);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: canvasTexture(c) }));
  return m;
}

// 一幅随机的“油画”，正面朝 +z
export function painting(w, h, seed) {
  let s = Math.abs(Math.round(seed)) * 9301 + 49297;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const c = document.createElement('canvas');
  c.width = 96; c.height = Math.round((96 * h) / w);
  const ctx = c.getContext('2d');
  const hue = Math.floor(r() * 360);
  const sky = ctx.createLinearGradient(0, 0, 0, c.height);
  sky.addColorStop(0, `hsl(${hue},70%,72%)`);
  sky.addColorStop(1, `hsl(${(hue + 40) % 360},75%,55%)`);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = `hsl(${(hue + 180) % 360},80%,70%)`;
  ctx.beginPath(); ctx.arc(20 + r() * 56, c.height * (0.2 + r() * 0.2), 7 + r() * 6, 0, 7); ctx.fill();
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = `hsl(${(hue + 90 + i * 35) % 360},${45 + i * 10}%,${42 - i * 8}%)`;
    ctx.beginPath(); ctx.moveTo(0, c.height);
    for (let x = 0; x <= 96; x += 16) ctx.lineTo(x, c.height * (0.5 + i * 0.14) + (r() - 0.5) * 14);
    ctx.lineTo(96, c.height); ctx.fill();
  }
  ctx.strokeStyle = '#7c4a1e'; ctx.lineWidth = 5; ctx.strokeRect(0, 0, c.width, c.height);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: canvasTexture(c) }));
}

// 楼面：正面是一格格窗户，其余面是纯色
const cellCache = new Map();
function windowCell(color) {
  if (cellCache.has(color)) return cellCache.get(color);
  const c = document.createElement('canvas');
  c.width = 32; c.height = 48;
  const ctx = c.getContext('2d');
  ctx.fillStyle = css(color); ctx.fillRect(0, 0, 32, 48);
  ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(0, 44, 32, 4);
  ctx.fillStyle = '#4f7391'; ctx.fillRect(6, 9, 20, 26);
  ctx.fillStyle = '#8db4d3'; ctx.fillRect(6, 9, 20, 9);
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(15, 9, 2, 26); ctx.fillRect(5, 35, 22, 2);
  cellCache.set(color, c);
  return c;
}
export function facadeMaterials(color, w, h) {
  const side = new THREE.MeshLambertMaterial({ color });
  const tex = canvasTexture(windowCell(color));
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(Math.max(1, Math.round(w / 1.5)), Math.max(1, Math.round(h / 2.3)));
  const front = new THREE.MeshLambertMaterial({ map: tex });
  return [side, side, side, side, front, side];
}

// 地砖
export function tileTexture(base, repeatX, repeatY) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = css(base); ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(0, 0, 32, 32); ctx.fillRect(32, 32, 32, 32);
  ctx.strokeStyle = 'rgba(0,0,0,.13)'; ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 32, 32); ctx.strokeRect(32, 0, 32, 32); ctx.strokeRect(0, 32, 32, 32); ctx.strokeRect(32, 32, 32, 32);
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

// 小人：正面朝 +z，脚底在 y = 0，身高约 1.7。四肢可以用 animateFigure 摆动。
// hairStyle: 'short' | 'long' | 'bun' | 'cap' | 'bald'；skirt / apron / bag / build 让路人各不相同。
export function makeFigure({ shirt = 0xff5a1f, pants = 0x334155, skin = 0xf2c9a0, hair = 0x2b2118, pack = null, scale = 1,
  hairStyle = 'short', hat = 0x1e3a5f, skirt = false, apron = false, bag = null, build = 1 } = {}) {
  const g = new THREE.Group();
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  const limb = (r, h, color, x, y) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, h, 8), mat(color));
    m.position.y = -h / 2;
    pivot.add(m); g.add(pivot);
    return pivot;
  };
  const legColor = skirt ? skin : pants;
  const legL = limb(skirt ? 0.09 : 0.12, 0.62, legColor, -0.13, 0.62), legR = limb(skirt ? 0.09 : 0.12, 0.62, legColor, 0.13, 0.62);
  const add = (geo, color, x, y, z) => { const m = new THREE.Mesh(geo, mat(color)); m.position.set(x, y, z); g.add(m); return m; };
  if (skirt) add(new THREE.CylinderGeometry(0.26, 0.4, 0.42, 12), pants, 0, 0.5, 0);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.27, 0.62, 10), mat(shirt));
  torso.position.y = 0.91; torso.scale.set(build, 1, build * 0.92);
  const armL = limb(0.075, 0.52, shirt, -0.31, 1.17), armR = limb(0.075, 0.52, shirt, 0.31, 1.17);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 10), mat(skin));
  head.position.y = 1.45;
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.245, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(hair));
  hairCap.position.y = 1.46; hairCap.rotation.x = -0.3;
  g.add(torso, head);
  if (hairStyle === 'cap') {
    add(new THREE.CylinderGeometry(0.245, 0.25, 0.14, 14), hat, 0, 1.6, 0);
    add(new THREE.BoxGeometry(0.34, 0.03, 0.2), hat, 0, 1.55, 0.26);
    add(new THREE.CylinderGeometry(0.235, 0.235, 0.1, 14), hair, 0, 1.5, -0.02).scale.z = 0.9;
  } else if (hairStyle !== 'bald') {
    g.add(hairCap);
    if (hairStyle === 'long') add(new THREE.CylinderGeometry(0.2, 0.26, 0.5, 10, 1, false, Math.PI / 2, Math.PI), hair, 0, 1.28, -0.02);
    if (hairStyle === 'bun') add(new THREE.SphereGeometry(0.11, 10, 8), hair, 0, 1.72, -0.1);
  }
  if (apron) add(new THREE.BoxGeometry(0.34 * build, 0.5, 0.03), 0xf4f1ea, 0, 0.86, 0.24 * build);
  if (bag != null) {
    add(new THREE.BoxGeometry(0.1, 0.24, 0.3), bag, 0.33 * build, 0.72, 0);
    const strap = add(new THREE.BoxGeometry(0.03, 0.62, 0.05), bag, 0.16, 1.02, 0.2); strap.rotation.z = 0.62;
  }
  for (const x of [-0.085, 0.085]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), mat(0x1f2937));
    eye.position.set(x, 1.47, 0.215);
    g.add(eye);
  }
  if (pack != null) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.22), mat(pack));
    p.position.set(0, 0.95, -0.3);
    g.add(p);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.scale.setScalar(scale);
  g.userData.limbs = { legL, legR, armL, armR };
  return g;
}

export function animateFigure(g, phase, moving) {
  const a = moving ? Math.sin(phase) * 0.75 : 0;
  const { legL, legR, armL, armR } = g.userData.limbs;
  legL.rotation.x = a; legR.rotation.x = -a;
  armL.rotation.x = -a * 0.8; armR.rotation.x = a * 0.8;
}
