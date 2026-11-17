// 街上的普通楼：按区分三种风格，楼面画成整张贴图，阳台、空调、晾衣杆、水箱这些小件合并成一个网格。
//   village 城中村：瓷砖墙、防盗网阳台、空调外机、晾衣杆、楼顶水箱和太阳能热水器
//   office  写字楼：玻璃幕墙、竖向装饰条、楼顶设备层和天线
//   street  老商业街：窗框窗台、每层的腰线、空调外机、楼顶广告牌架
import * as THREE from '../vendor/three.module.min.js';
import { mergeGeometries } from '../vendor/loaders/BufferGeometryUtils.js';

export const BUILDING_STYLE = {
  huaqiangbei: 'street', futian: 'office', luohu: 'street', dongmen: 'street', keji: 'office',
  shekou: 'street', baoan: 'village', longhua: 'village', dafen: 'village', yantian: 'street',
};
const FH = 2.6; // 一层楼高

const css = c => '#' + c.toString(16).padStart(6, '0');
function shade(hex, f) { // f < 1 变暗，> 1 变亮
  const c = new THREE.Color(hex);
  if (f < 1) c.multiplyScalar(f); else c.lerp(new THREE.Color(0xffffff), f - 1);
  return c.getHex();
}

// ---------- 楼面贴图 ----------
const texCache = new Map();
const CURTAINS = ['#f1e4c8', '#c7d7e6', '#e9c6c6', '#d6e6c9', '#f4f1ea', '#e8d6a8'];
function facadeCanvas(style, color, cols, floors, side, variant) {
  const CW = 32, CH = 40;
  const c = document.createElement('canvas');
  c.width = cols * CW; c.height = floors * CH;
  const g = c.getContext('2d');
  let seed = variant * 977 + cols * 31 + floors * 7 + (side ? 5 : 0);
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.fillStyle = css(color); g.fillRect(0, 0, c.width, c.height);

  if (style === 'office') {
    for (let j = 0; j < floors; j++) for (let i = 0; i < cols; i++) {
      const x = i * CW, y = j * CH;
      const grad = g.createLinearGradient(x, y, x + CW, y + CH);
      const tint = r() < 0.15 ? ['#7fb3d5', '#a9cce3'] : ['#3d6b8c', '#7aa7c7'];
      grad.addColorStop(0, tint[1]); grad.addColorStop(1, tint[0]);
      g.fillStyle = grad; g.fillRect(x + 1, y + 6, CW - 2, CH - 8);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + 4, y + 8, 3, CH - 14);
      g.fillStyle = css(shade(color, 0.85)); g.fillRect(x, y + CH - 3, CW, 3); // 层间的实墙带
    }
    g.fillStyle = 'rgba(255,255,255,.55)';
    for (let i = 0; i <= cols; i++) g.fillRect(i * CW - 1, 0, 2, c.height);
  } else {
    if (style === 'village') { // 小块瓷砖
      g.strokeStyle = 'rgba(0,0,0,.06)'; g.lineWidth = 1;
      for (let y = 0; y < c.height; y += 6) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(c.width, y + 0.5); g.stroke(); }
      for (let x = 0; x < c.width; x += 8) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, c.height); g.stroke(); }
    }
    for (let j = 0; j < floors; j++) {
      const y = j * CH;
      if (style === 'street') { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, y + CH - 4, c.width, 3); }
      for (let i = 0; i < cols; i++) {
        if (side && (i % 2 || r() < 0.3)) continue; // 侧面窗户少一些
        const x = i * CW, ww = style === 'village' ? 16 : 18, wh = style === 'village' ? 20 : 24;
        const wx = x + (CW - ww) / 2, wy = y + 8;
        g.fillStyle = style === 'street' ? '#f8fafc' : 'rgba(0,0,0,.18)';
        g.fillRect(wx - 2, wy - 2, ww + 4, wh + 4); // 窗框
        g.fillStyle = '#35556e'; g.fillRect(wx, wy, ww, wh);
        g.fillStyle = '#6f97b5'; g.fillRect(wx, wy, ww, wh * 0.35);
        if (r() < 0.55) { g.fillStyle = CURTAINS[Math.floor(r() * CURTAINS.length)]; g.fillRect(wx + (r() < 0.5 ? 0 : ww / 2), wy, ww / 2, wh); }
        g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(wx + ww / 2 - 1, wy, 2, wh);
        if (style === 'village') { // 防盗网
          g.fillStyle = 'rgba(40,40,40,.55)';
          for (let b = 2; b < ww; b += 4) g.fillRect(wx + b, wy - 1, 1, wh + 2);
        } else { g.fillStyle = '#e5e7eb'; g.fillRect(wx - 3, wy + wh + 2, ww + 6, 2); } // 窗台
      }
    }
  }
  return c;
}
function facadeTexture(style, color, cols, floors, side, variant) {
  const key = [style, color, cols, floors, side, variant].join('|');
  let t = texCache.get(key);
  if (!t) {
    t = new THREE.CanvasTexture(facadeCanvas(style, color, cols, floors, side, variant));
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    t.userData.shared = true;
    texCache.set(key, t);
  }
  return t;
}

// 一栋楼的六个面：正面和两侧用贴图，楼顶是水泥色
export function buildingMaterials(style, color, w, h, d, variant = 0) {
  const floors = Math.max(1, Math.round(h / FH)), cols = Math.max(1, Math.round(w / 1.6)), sc = Math.max(1, Math.round(d / 1.6));
  variant = Math.abs(variant) % 4;
  const front = new THREE.MeshLambertMaterial({ map: facadeTexture(style, color, cols, floors, false, variant) });
  const side = new THREE.MeshLambertMaterial({ map: facadeTexture(style, color, sc, floors, true, variant) });
  const top = new THREE.MeshLambertMaterial({ color: 0xb9b4aa });
  const plain = new THREE.MeshLambertMaterial({ color: shade(color, 0.8) });
  return [side, side, top, plain, front, plain];
}

// ---------- 小件：全部收集起来合并成一个带顶点颜色的网格 ----------
const detailMat = new THREE.MeshLambertMaterial({ vertexColors: true });
detailMat.userData.shared = true;
function collector() {
  const list = [];
  const push = (geo, color, x, y, z) => {
    geo.deleteAttribute('uv');
    geo.translate(x, y, z);
    const c = new THREE.Color(color), n = geo.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    list.push(geo);
    return geo;
  };
  return {
    box: (w, h, d, color, x, y, z) => push(new THREE.BoxGeometry(w, h, d), color, x, y, z),
    tilted: (w, h, d, color, x, y, z, rx) => { const g = new THREE.BoxGeometry(w, h, d); g.rotateX(rx); return push(g, color, x, y, z); },
    cyl: (rad, h, color, x, y, z, seg = 10) => push(new THREE.CylinderGeometry(rad, rad, h, seg), color, x, y, z),
    mesh() {
      if (!list.length) return null;
      const m = new THREE.Mesh(mergeGeometries(list), detailMat);
      list.forEach(g => g.dispose());
      m.castShadow = true; m.receiveShadow = true;
      return m;
    },
  };
}

const CLOTHES = [0xef4444, 0x3b82f6, 0xfacc15, 0xf8fafc, 0x22c55e, 0xf472b6, 0x1f2937];
// 楼顶：女儿墙、水箱、热水器、楼梯间、天线、广告牌架
function roof(c, style, w, h, d, color, r) {
  const top = h / 2, wall = shade(color, 0.9);
  c.box(w, 0.5, 0.15, wall, 0, top + 0.25, d / 2 - 0.08);
  c.box(w, 0.5, 0.15, wall, 0, top + 0.25, -d / 2 + 0.08);
  c.box(0.15, 0.5, d, wall, -w / 2 + 0.08, top + 0.25, 0);
  c.box(0.15, 0.5, d, wall, w / 2 - 0.08, top + 0.25, 0);
  if (style === 'office') {
    const cw = w * (0.45 + r() * 0.2), cd = d * 0.55;
    c.box(cw, 1.4, cd, shade(color, 0.75), 0, top + 0.7, -0.5);
    for (let i = 0; i < 3; i++) c.box(0.7, 0.5, 0.7, 0x9ca3af, -cw / 2 + 0.6 + i * 0.9, top + 1.65, -0.5);
    if (h > 18 || r() < 0.4) { c.cyl(0.06, 3.2, 0xd1d5db, cw / 3, top + 3, -1, 6); c.box(0.18, 0.18, 0.18, 0xef4444, cw / 3, top + 4.6, -1); }
    return;
  }
  if (r() < 0.75) { // 水箱
    const x = (r() - 0.5) * (w - 2), z = -d / 4;
    for (const dx of [-0.45, 0.45]) for (const dz of [-0.45, 0.45]) c.box(0.08, 0.8, 0.08, 0x52525b, x + dx, top + 0.4, z + dz);
    c.cyl(0.6, 1.1, style === 'village' ? 0x60a5fa : 0xd4d4d8, x, top + 1.35, z, 12);
  }
  if (style === 'village' && r() < 0.6 && w > 3) { // 太阳能热水器：一排斜着的真空管
    const x = (r() - 0.5) * (w - 2.4);
    c.tilted(1.8, 0.08, 1.2, 0x1f2937, x, top + 0.75, d / 4, -0.6);
    c.box(1.8, 0.36, 0.36, 0xe5e7eb, x, top + 1.15, d / 4 - 0.5); // 顶上的储水罐
  }
  if (r() < 0.55) c.box(1.6, 1.8, 1.8, shade(color, 0.85), w / 2 - 1.2, top + 0.9, -d / 2 + 1.2); // 楼梯间
  if (style === 'street' && r() < 0.35 && w > 4) { // 楼顶广告牌
    const bw = Math.min(w - 1, 5);
    for (const dx of [-bw / 3, bw / 3]) c.box(0.12, 1.4, 0.12, 0x52525b, dx, top + 0.7, 1.2);
    c.box(bw, 1.5, 0.15, [0xdc2626, 0x0ea5e9, 0xf59e0b, 0x16a34a][Math.floor(r() * 4)], 0, top + 2.1, 1.2);
  }
}

// 正面的小件。front 是楼正面在楼自身坐标里的 z；skipGround 表示底层是铺面，不放东西
function facade(c, style, w, h, d, color, r, skipGround, far) {
  const floors = Math.max(1, Math.round(h / FH)), cols = Math.max(1, Math.round(w / 1.6));
  const fh = h / floors, cw = w / cols, front = d / 2, y0 = -h / 2;
  const cage = [0x4b5563, 0xe5e7eb, 0x92400e, 0x0f766e][Math.floor(r() * 4)];
  if (style === 'office') {
    for (let i = 1; i < cols; i++) c.box(0.1, h, 0.3, 0xf1f5f9, -w / 2 + i * cw, 0, front + 0.15);
    for (let j = 1; j < floors; j += far ? 3 : 1) c.box(w, 0.08, 0.12, 0xe2e8f0, 0, y0 + j * fh, front + 0.06);
    return;
  }
  for (let j = skipGround ? 1 : 0; j < floors; j++) {
    const yb = y0 + j * fh;
    if (style === 'street') c.box(w + 0.1, 0.12, 0.28, shade(color, 1.25), 0, yb, front + 0.14); // 腰线
    if (far) continue;
    for (let i = 0; i < cols; i++) {
      const x = -w / 2 + (i + 0.5) * cw, p = r();
      if (style === 'village' && p < 0.4 && cw > 1.2) { // 防盗网阳台
        const bw = cw * 0.82, bh = fh * 0.72, bz = front + 0.35;
        c.box(bw, 0.08, 0.7, 0xd6d3d1, x, yb + 0.25, front + 0.35);
        c.box(bw, 0.05, 0.05, cage, x, yb + 0.25 + bh, bz + 0.33);
        c.box(bw, 0.05, 0.05, cage, x, yb + 0.25 + bh * 0.45, bz + 0.33);
        for (let b = 0; b <= 4; b++) c.box(0.04, bh, 0.04, cage, x - bw / 2 + b * bw / 4, yb + 0.25 + bh / 2, bz + 0.33);
        for (const s of [-1, 1]) c.box(0.04, bh, 0.66, cage, x + s * bw / 2, yb + 0.25 + bh / 2, bz);
        if (r() < 0.5) { // 阳台里晾的衣服
          for (let k = 0; k < 3; k++) c.box(0.22, 0.38, 0.03, CLOTHES[Math.floor(r() * CLOTHES.length)], x - bw / 3 + k * bw / 3, yb + bh - 0.1, bz);
        }
        if (r() < 0.25) c.box(0.3, 0.25, 0.3, 0x15803d, x + bw / 3, yb + 0.42, bz + 0.15); // 盆栽
      } else if (p < 0.7) { // 空调外机
        const ax = x + (r() < 0.5 ? -1 : 1) * cw * 0.3;
        c.box(0.62, 0.42, 0.32, 0xeef0f2, ax, yb + 0.35, front + 0.18);
        c.box(0.3, 0.3, 0.02, 0x6b7280, ax - 0.1, yb + 0.35, front + 0.35);
      } else if (style === 'village' && p < 0.85) { // 窗外的晾衣杆
        c.box(cw * 0.9, 0.03, 0.03, 0x9ca3af, x, yb + fh - 0.35, front + 0.55);
        for (let k = 0; k < 2; k++) c.box(0.26, 0.42, 0.02, CLOTHES[Math.floor(r() * CLOTHES.length)], x - cw * 0.2 + k * cw * 0.4, yb + fh - 0.6, front + 0.55);
      }
    }
  }
}

// 做一栋楼：中心在 (0, h/2, 0)，正面朝 +z。返回 Mesh，小件挂在它下面（剖切时一起显示或隐藏）
export function makeBuilding({ style, color, w, h, d = 8, r, skipGround = false, far = false, variant = 0 }) {
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), buildingMaterials(style, color, w, h, d, variant));
  body.castShadow = true; body.receiveShadow = true;
  const c = collector();
  facade(c, style, w, h, d, color, r, skipGround, far);
  roof(c, style, w, h, d, color, r);
  const m = c.mesh();
  if (m) body.add(m);
  return body;
}
