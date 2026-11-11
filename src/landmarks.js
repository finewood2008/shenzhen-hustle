// 各区的专属地标和街景道具，全部用基础几何体拼出来。
// 地标：原点在地面中心，正面朝 +z，占地大约 14 × 10；街区里按原尺寸摆放，沙盘上缩小后摆放。
import * as THREE from '../vendor/three.module.min.js';
import { signBoard, painting } from './models.js';

export function kit(g) {
  const lam = c => new THREE.MeshLambertMaterial({ color: c });
  const add = (geo, color, x, y, z) => {
    const m = new THREE.Mesh(geo, lam(color));
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const k = {
    g,
    box: (w, h, d, c, x, y, z) => add(new THREE.BoxGeometry(w, h, d), c, x, y, z),
    cyl: (rt, rb, h, c, x, y, z, seg = 12) => add(new THREE.CylinderGeometry(rt, rb, h, seg), c, x, y, z),
    cone: (r, h, c, x, y, z, seg = 4) => add(new THREE.ConeGeometry(r, h, seg), c, x, y, z),
    ball: (r, c, x, y, z) => add(new THREE.IcosahedronGeometry(r, 1), c, x, y, z),
    sign(text, opts, x, y, z, ry = 0) {
      const s = signBoard(text, opts);
      s.position.set(x, y, z); s.rotation.y = ry;
      g.add(s);
      return s;
    },
    art(w, h, seed, x, y, z, ry = 0) {
      const p = painting(w, h, seed);
      p.position.set(x, y, z); p.rotation.y = ry;
      g.add(p);
      return p;
    },
    sub(x, y, z) { const n = new THREE.Group(); n.position.set(x, y, z); g.add(n); return kit(n); },
  };
  return k;
}

// ---------- 通用小件 ----------
export function palm(k, x, z, h = 4.6) {
  k.cyl(0.14, 0.22, h, 0x9a7b4f, x, h / 2, z, 7);
  for (let i = 0; i < 7; i++) {
    const pivot = new THREE.Group();
    pivot.position.set(x, h, z);
    pivot.rotation.y = (i / 7) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.07, 0.5), new THREE.MeshLambertMaterial({ color: i % 2 ? 0x3f8f4a : 0x56a85c }));
    leaf.position.set(1, -0.22, 0); leaf.rotation.z = -0.4; leaf.castShadow = true;
    pivot.add(leaf);
    k.g.add(pivot);
  }
}

function hull(k, color, y, depth, x, z, scale = 1) {
  const s = new THREE.Shape([[-6.5, -1.7], [4.3, -1.7], [7.6, 0], [4.3, 1.7], [-6.5, 1.7]].map(p => new THREE.Vector2(p[0] * scale, p[1] * scale)));
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z); m.castShadow = true;
  k.g.add(m);
  return m;
}

function car(k, x, z, color) {
  k.box(3.1, 0.6, 1.45, color, x, 0.6, z);
  k.box(1.7, 0.55, 1.3, 0x1e293b, x - 0.1, 1.15, z);
  k.box(0.5, 0.14, 0.9, 0xfde047, x - 0.1, 1.5, z);
  for (const dx of [-1, 1]) for (const dz of [-0.7, 0.7]) {
    const w = k.cyl(0.3, 0.3, 0.2, 0x111827, x + dx, 0.3, z + dz);
    w.rotation.x = Math.PI / 2;
  }
}

function bike(k, x, z, color) {
  for (const dx of [-0.5, 0.5]) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 6, 14), new THREE.MeshLambertMaterial({ color: 0x1f2937 }));
    w.position.set(x + dx, 0.34, z);
    k.g.add(w);
  }
  k.box(1, 0.07, 0.07, color, x, 0.62, z).rotation.z = 0.25;
  k.box(0.07, 0.5, 0.07, color, x - 0.25, 0.75, z);
  k.box(0.3, 0.07, 0.16, 0x111827, x - 0.25, 1.02, z);
  k.box(0.07, 0.6, 0.07, color, x + 0.42, 0.75, z);
  k.box(0.07, 0.07, 0.5, 0x111827, x + 0.42, 1.06, z);
}

function scooter(k, x, z, color) {
  k.box(1.1, 0.25, 0.4, color, x, 0.45, z);
  k.box(0.5, 0.14, 0.38, 0x1f2937, x - 0.25, 0.68, z);
  k.box(0.08, 0.7, 0.08, 0x374151, x + 0.45, 0.8, z);
  k.box(0.08, 0.08, 0.55, 0x111827, x + 0.45, 1.15, z);
  for (const dx of [-0.45, 0.5]) k.cyl(0.2, 0.2, 0.14, 0x111827, x + dx, 0.2, z).rotation.x = Math.PI / 2;
}

function easel(k, x, z, seed, s = 1) {
  k.box(0.08 * s, 1.9 * s, 0.08 * s, 0x92400e, x - 0.45 * s, 0.95 * s, z).rotation.z = -0.1;
  k.box(0.08 * s, 1.9 * s, 0.08 * s, 0x92400e, x + 0.45 * s, 0.95 * s, z).rotation.z = 0.1;
  k.box(0.08 * s, 1.9 * s, 0.08 * s, 0x92400e, x, 0.95 * s, z - 0.35 * s).rotation.x = -0.3;
  k.box(1.2 * s, 0.07 * s, 0.14 * s, 0x92400e, x, 0.75 * s, z + 0.08 * s);
  k.art(1.1 * s, 0.85 * s, seed, x, 1.25 * s, z + 0.1 * s);
}

function drone(k, x, y, z) {
  const d = k.sub(x, y, z);
  d.box(0.5, 0.14, 0.5, 0x1f2937, 0, 0, 0);
  d.box(1.3, 0.05, 0.08, 0x475569, 0, 0, 0).rotation.y = Math.PI / 4;
  d.box(1.3, 0.05, 0.08, 0x475569, 0, 0, 0).rotation.y = -Math.PI / 4;
  for (const [dx, dz] of [[-0.46, -0.46], [0.46, -0.46], [-0.46, 0.46], [0.46, 0.46]]) d.cyl(0.24, 0.24, 0.03, 0xe5e7eb, dx, 0.08, dz, 10);
  d.ball(0.07, 0xef4444, 0, -0.1, 0.22);
  return d.g;
}

// ---------- 地标 ----------
// 每个 build(k, mini) 可以返回一个 tick(t) 用来做动画；mini 表示是沙盘上的缩小版。
export const LANDMARKS = {
  huaqiangbei: { name: '电子大厦', mapScale: 0.13, build(k) {
    k.box(12, 6, 8, 0xe5e7eb, 0, 3, 0);
    k.box(12.3, 0.4, 8.3, 0x94a3b8, 0, 6.2, 0);
    k.sign('电子世界', { w: 8, h: 2.4, bg: '#0b1220', fg: '#22d3ee' }, 0, 3.9, 4.03);
    k.sign('芯片', { w: 1.1, h: 3.6, bg: '#dc2626', fg: '#fff', vertical: true }, -5.2, 3.2, 4.04);
    k.sign('配件', { w: 1.1, h: 3.6, bg: '#16a34a', fg: '#fff', vertical: true }, 5.2, 3.2, 4.04);
    k.box(7, 1.9, 0.2, 0x1e293b, 0, 0.95, 4.0);
    k.cyl(3.4, 3.4, 30, 0xdbe4ee, 0, 21.4, -0.5, 8);
    for (let y = 8.5; y < 36; y += 2.6) k.cyl(3.47, 3.47, 1.1, 0x35526e, 0, y, -0.5, 8);
    k.cyl(3.9, 3.4, 1.2, 0xf8fafc, 0, 37, -0.5, 8);
    k.cyl(2.2, 2.2, 0.2, 0x64748b, 0, 37.7, -0.5, 16);
    for (const x of [-0.9, 0.9]) { k.cyl(0.1, 0.16, 10, 0xcbd5e1, x, 42.8, -0.5, 6); k.ball(0.28, 0xef4444, x, 48, -0.5); }
  } },

  futian: { name: '金融塔', mapScale: 0.12, build(k) {
    let y = 0;
    for (const [s, h] of [[6.4, 22], [5.6, 16], [4.8, 12], [3.8, 9]]) {
      k.box(s, h, s, 0x9fbbd9, 0, y + h / 2, -1.5);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.3, h, 0.3, 0xf1f5f9, sx * s / 2, y + h / 2, -1.5 + sz * s / 2);
      for (let b = y + 3; b < y + h; b += 3) k.box(s + 0.06, 0.25, s + 0.06, 0x56789b, 0, b, -1.5);
      y += h;
    }
    k.cone(2.7, 6, 0xdbe7f3, 0, y + 3, -1.5, 4).rotation.y = Math.PI / 4;
    k.cyl(0.08, 0.2, 10, 0xe2e8f0, 0, y + 10, -1.5, 6);
    // 塔前的翼形屋顶大厅
    k.box(10, 2.6, 2.6, 0xe2e8f0, 0, 1.3, 3.2);
    k.box(9.6, 1.6, 0.1, 0x7ea3c4, 0, 1.4, 4.52);
    k.cyl(0.55, 0.55, 4.6, 0xdc2626, -5.8, 2.3, 3.2);
    k.cyl(0.55, 0.55, 4.6, 0xfacc15, 5.8, 2.3, 3.2);
    k.box(7.4, 0.35, 4.4, 0x1e40af, -3.5, 4.9, 3.2).rotation.z = -0.13;
    k.box(7.4, 0.35, 4.4, 0x1e40af, 3.5, 4.9, 3.2).rotation.z = 0.13;
  } },

  luohu: { name: '口岸联检楼', mapScale: 0.2, build(k) {
    k.box(13, 6, 6, 0xf3ead7, 0, 3, 0);
    k.box(13.5, 0.45, 6.5, 0xb45309, 0, 6.2, 0);
    k.box(5.2, 4.4, 0.3, 0x1e293b, 0, 2.2, 3.02);
    k.box(4.6, 0.12, 0.34, 0x9ec5e8, 0, 3, 3.03); k.box(0.12, 4.4, 0.34, 0x9ec5e8, 0, 2.2, 3.03);
    for (const x of [-3, 3]) k.box(0.6, 5.6, 0.6, 0xb91c1c, x, 2.8, 3.3);
    for (const x of [-5.3, -4.1, 4.1, 5.3]) k.box(0.8, 1.6, 0.1, 0x7ea3c4, x, 3.6, 3.03);
    k.box(7.4, 1.9, 0.3, 0x7f1d1d, 0, 7.35, 2.6);
    k.sign('罗湖口岸', { w: 7, h: 1.6, bg: '#b91c1c', fg: '#fde68a' }, 0, 7.35, 2.77);
    // 钟楼
    k.box(2.4, 14, 2.4, 0xf3ead7, -5, 7, -1.4);
    const face = k.cyl(0.9, 0.9, 0.1, 0xffffff, -5, 12, -0.17, 20); face.rotation.x = Math.PI / 2;
    k.box(0.08, 0.7, 0.05, 0x111827, -5, 12.3, -0.1); k.box(0.5, 0.08, 0.05, 0x111827, -4.78, 12, -0.1);
    k.cone(2, 2.6, 0xb45309, -5, 15.3, -1.4, 4).rotation.y = Math.PI / 4;
    k.cyl(0.06, 0.06, 7, 0xe5e7eb, 5, 9.9, 1.5, 6);
    k.box(1.5, 0.95, 0.05, 0xdc2626, 5.8, 12.8, 1.5);
  } },

  dongmen: { name: '老街牌坊', mapScale: 0.24, build(k) {
    // 骑楼和钟楼
    k.box(12, 5, 4, 0xfef3c7, 0, 2.5, -2.6);
    for (let x = -5.4; x <= 5.4; x += 2.7) k.box(0.45, 2.6, 0.45, 0xffffff, x, 1.3, -0.4);
    k.box(12, 0.3, 0.6, 0xffffff, 0, 2.75, -0.4);
    for (let x = -4.05; x <= 4.1; x += 2.7) { k.box(1.2, 1.3, 0.1, 0x7c2d12, x, 3.9, -0.58); k.box(0.9, 1, 0.12, 0x9ec5e8, x, 3.9, -0.56); }
    k.box(12.5, 0.4, 4.6, 0x7c2d12, 0, 5.2, -2.6);
    k.box(2.4, 3, 2.4, 0xfef3c7, 0, 6.9, -2.6);
    k.box(1.2, 1.4, 0.1, 0x1e293b, 0, 7, -1.38);
    k.cone(2, 1.9, 0x7c2d12, 0, 9.35, -2.6, 4).rotation.y = Math.PI / 4;
    // 牌坊
    for (const [x, h] of [[-5.2, 5.4], [-2.1, 7], [2.1, 7], [5.2, 5.4]]) { k.box(0.6, h, 0.6, 0xb91c1c, x, h / 2, 2.6); k.box(0.9, 0.5, 0.9, 0x9ca3af, x, 0.25, 2.6); }
    k.box(4.8, 0.55, 0.5, 0x0f766e, 0, 6.2, 2.6);
    for (const x of [-3.65, 3.65]) k.box(3.7, 0.5, 0.5, 0x0f766e, x, 4.7, 2.6);
    k.box(6, 0.3, 1.7, 0x475569, 0, 7.25, 2.6); k.box(4.6, 0.3, 1.2, 0x64748b, 0, 7.55, 2.6); k.box(3.2, 0.25, 0.35, 0xfacc15, 0, 7.85, 2.6);
    for (const x of [-3.65, 3.65]) { k.box(4.4, 0.3, 1.5, 0x475569, x, 5.65, 2.6); k.box(3.2, 0.25, 1, 0x64748b, x, 5.92, 2.6); }
    for (const x of [-3.2, 3.2]) k.box(0.9, 0.3, 1.7, 0x475569, x, 7.4, 2.6).rotation.z = x < 0 ? -0.5 : 0.5;
    k.sign('东门', { w: 2.2, h: 1, bg: '#1e3a8a', fg: '#fde047' }, 0, 5.35, 2.9);
    for (const x of [-3.65, -1.2, 1.2, 3.65]) { k.box(0.04, 0.5, 0.04, 0x1f2937, x, 4.2, 2.95); k.ball(0.32, 0xdc2626, x, 3.75, 2.95).scale.y = 0.85; }
  } },

  keji: { name: '双子总部', mapScale: 0.13, build(k) {
    k.box(13, 1, 7.5, 0xe2e8f0, 0, 0.5, -1);
    k.box(4.6, 44, 4.6, 0x8fb6e0, -3.5, 22, -1);
    k.box(4.6, 34, 4.6, 0xa7c7ea, 3.5, 17, -1);
    for (let y = 4; y < 44; y += 3.4) k.box(4.68, 0.28, 4.68, 0x3b5f85, -3.5, y, -1);
    for (let y = 4; y < 34; y += 3.4) k.box(4.68, 0.28, 4.68, 0x3b5f85, 3.5, y, -1);
    k.box(2.6, 2.4, 3.4, 0xf97316, 0, 8, -1);
    k.box(2.6, 2.4, 3.4, 0x22c55e, 0, 18, -1);
    k.box(2.6, 2.4, 3.4, 0x38bdf8, 0, 28, -1);
    k.box(4.2, 0.3, 4.2, 0x4ade80, 3.5, 34.15, -1);
    k.ball(0.8, 0x3f8f4a, 2.6, 34.8, -1.6); k.ball(0.6, 0x56a85c, 4.4, 34.7, -0.2);
    k.box(1.6, 1.4, 1.6, 0xe2e8f0, -3.5, 44.7, -1);
    k.cyl(0.07, 0.07, 6, 0xcbd5e1, -3.5, 48.4, -1, 6);
    k.sign('科技园', { w: 4, h: 0.9, bg: '#1d4ed8', fg: '#fff' }, 0, 1.6, 2.78);
    const ds = [drone(k, -5, 6, 4), drone(k, 4, 8, 3.5), drone(k, 0.5, 11, 4.5)];
    return t => ds.forEach((d, i) => {
      d.position.y = 6 + i * 2.4 + Math.sin(t * 1.3 + i * 2) * 0.6;
      d.position.x = [-5, 4, 0.5][i] + Math.sin(t * 0.5 + i) * 1.6;
      d.rotation.y = t * 0.6 + i;
    });
  } },

  shekou: { name: '海上邮轮', mapScale: 0.22, build(k, mini) {
    if (!mini) k.box(64, 0.1, 30, 0x3b9ed6, 3, 0.06, -12.4).castShadow = false;
    k.box(16, 0.5, 0.7, 0x9ca3af, 0, 0.25, 2.9);
    for (let x = -7; x <= 7; x += 2.8) k.cyl(0.16, 0.2, 0.7, 0x374151, x, 0.75, 2.9, 8);
    const z = -1.6;
    hull(k, 0x1e3a5f, 0.1, 2.2, -0.5, z);
    hull(k, 0xffffff, 2.3, 0.9, -0.5, z);
    k.box(10.6, 0.14, 3.42, 0xdc2626, -1.4, 2.3, z);
    k.box(8.2, 1.3, 2.8, 0xffffff, -2, 3.85, z); k.box(8.26, 0.45, 2.86, 0x1e293b, -2, 3.95, z);
    k.box(6.6, 1.2, 2.4, 0xf1f5f9, -2.3, 5.1, z); k.box(6.66, 0.4, 2.46, 0x1e293b, -2.3, 5.2, z);
    k.box(4.6, 1.1, 2, 0xffffff, -2.6, 6.25, z);
    k.box(1.7, 1, 2.5, 0xe2e8f0, 0.3, 6.3, z); k.box(1.76, 0.4, 2.56, 0x1e293b, 0.3, 6.45, z);
    k.cyl(0.6, 0.72, 2.1, 0xdc2626, -3.2, 7.85, z); k.cyl(0.63, 0.63, 0.45, 0x111827, -3.2, 8.85, z);
    k.cyl(0.05, 0.05, 3.4, 0xe5e7eb, 1.6, 8.5, z, 6); k.box(1.2, 0.05, 0.05, 0xe5e7eb, 1.6, 9.4, z);
    for (let i = 0; i < 6; i++) k.box(0.5, 0.5, 0.05, i % 2 ? 0xfacc15 : 0xef4444, 1.9 + i * 0.75, 9.2 - i * 0.95, z);
    for (let x = -5.5; x <= 3; x += 1.2) k.cyl(0.14, 0.14, 0.06, 0x0f172a, x, 1.5, z + 1.72, 10).rotation.x = Math.PI / 2;
    if (!mini) { palm(k, -6.6, 4.2); palm(k, 6.6, 4.2, 5.2); }
  } },

  baoan: { name: '西乡工厂', mapScale: 0.2, build(k) {
    k.box(12, 5, 7, 0xd4d4d8, 0, 2.5, -1.2);
    for (let i = 0; i < 4; i++) {
      const x = -4.5 + i * 3;
      k.box(3.1, 0.3, 7, 0x71717a, x - 0.1, 5.75, -1.2).rotation.z = 0.48;
      k.box(0.15, 1.5, 7, 0x9ec5e8, x + 1.38, 5.75, -1.2);
    }
    k.box(3.2, 3.4, 0.2, 0x475569, -2.6, 1.7, 2.35);
    for (let y = 0.5; y < 3.4; y += 0.6) k.box(3.2, 0.06, 0.24, 0x1f2937, -2.6, y, 2.36);
    k.sign('西乡制造', { w: 5, h: 1.1, bg: '#1e3a8a', fg: '#fff' }, 2.4, 3.8, 2.33);
    for (const x of [1, 2.6, 4.2]) k.box(1.1, 1, 0.1, 0x7ea3c4, x, 1.9, 2.32);
    k.cyl(0.6, 0.85, 15, 0xe5e7eb, 5.2, 7.5, -3.8);
    for (const y of [9.5, 12, 14.4]) k.cyl(0.72, 0.76, 0.9, 0xdc2626, 5.2, y, -3.8);
    for (const dx of [-0.9, 0.9]) for (const dz of [-0.9, 0.9]) k.box(0.18, 6.5, 0.18, 0x64748b, -5.3 + dx, 3.25, -3.9 + dz);
    k.cyl(1.4, 1.4, 2.3, 0x94a3b8, -5.3, 7.6, -3.9); k.cone(1.5, 0.9, 0x64748b, -5.3, 9.2, -3.9, 12);
    // 货车和托盘
    k.box(1.7, 1.9, 2, 0x2563eb, 5.1, 1.35, 4); k.box(1.2, 0.7, 2.02, 0x9ec5e8, 5.3, 1.75, 4);
    k.box(3.8, 2.3, 2.1, 0xf8fafc, 2.2, 1.6, 4);
    for (const x of [1, 3.2, 5.2]) for (const dz of [-0.95, 0.95]) k.cyl(0.4, 0.4, 0.25, 0x111827, x, 0.4, 4 + dz).rotation.x = Math.PI / 2;
    for (const [x, n] of [[-5, 3], [-3.4, 2]]) {
      k.box(1.3, 0.16, 1.3, 0xa16207, x, 0.08, 4);
      for (let i = 0; i < n; i++) k.box(1.1, 0.55, 1.1, i % 2 ? 0xc8a26b : 0xd9b98a, x, 0.45 + i * 0.57, 4);
    }
  } },

  longhua: { name: '握手楼', mapScale: 0.2, build(k) {
    const cols = [0xe7e5e4, 0xfde68a, 0xd6d3d1, 0xa5f3fc, 0xfecaca], hs = [13, 16.5, 12, 15, 14];
    const cloth = [0xef4444, 0x3b82f6, 0xfacc15, 0xffffff, 0x22c55e];
    hs.forEach((h, i) => {
      const x = -5 + i * 2.5;
      k.box(2.3, h, 5, cols[i], x, h / 2, -1.6);
      for (let y = 3.4, f = 0; y < h - 0.6; y += 2.4, f++) {
        k.box(1.5, 1.2, 0.1, 0x4f7391, x, y + 0.2, 0.92);
        k.box(1.9, 0.75, 0.55, 0x9ca3af, x, y - 0.55, 1.15);
        if ((i + f) % 2 === 0) for (let c = 0; c < 3; c++) k.box(0.36, 0.5, 0.04, cloth[(i + f + c) % 5], x - 0.55 + c * 0.55, y + 0.45, 1.42);
      }
      k.box(1.5, 2.2, 0.12, 0x334155, x, 1.1, 0.92);
      k.cyl(0.45, 0.45, 0.9, 0xcbd5e1, x - 0.4, h + 0.45, -1.2);
      k.box(1, 0.08, 1.4, 0x1e3a8a, x + 0.45, h + 0.3, -2.4).rotation.x = 0.4;
    });
    for (let i = 0; i < 4; i++) k.box(2.6, 0.04, 0.04, 0x1f2937, -3.75 + i * 2.5, 11.4 - (i % 2) * 0.5, 1.3).rotation.z = i % 2 ? 0.12 : -0.12;
    // 村口牌楼
    for (const x of [-3.6, 3.6]) k.box(0.65, 4.6, 0.65, 0xb91c1c, x, 2.3, 3.8);
    k.box(8.2, 1, 0.6, 0xb91c1c, 0, 4.7, 3.8); k.box(8.8, 0.25, 1, 0x7f1d1d, 0, 5.3, 3.8);
    k.sign('龙华新村', { w: 5.4, h: 0.8, bg: '#b91c1c', fg: '#fde047' }, 0, 4.7, 4.12);
  } },

  dafen: { name: '画家村', mapScale: 0.24, build(k) {
    const cols = [0xfb7185, 0xfacc15, 0x38bdf8];
    cols.forEach((c, i) => {
      const x = -4.3 + i * 4.3;
      k.box(3.8, 3.6, 4, c, x, 1.8, -3);
      k.box(2.75, 2.75, 4.3, 0x9a3412, x, 3.6, -3).rotation.z = Math.PI / 4;
      k.box(1, 1.9, 0.1, 0x7c2d12, x - 0.9, 0.95, -0.97);
      k.art(1.5, 1.1, 11 + i * 7, x + 0.7, 1.8, -0.96);
      k.cyl(0.5, 0.5, 0.1, 0xffffff, x, 4.4, -0.9, 16).rotation.x = Math.PI / 2;
    });
    // 广场上的巨型画架
    k.box(0.28, 8, 0.28, 0x92400e, -1.9, 4, 2.6).rotation.z = -0.1;
    k.box(0.28, 8, 0.28, 0x92400e, 1.9, 4, 2.6).rotation.z = 0.1;
    k.box(0.28, 8.2, 0.28, 0x92400e, 0, 4, 1.2).rotation.x = -0.32;
    k.box(5, 0.25, 0.6, 0x92400e, 0, 2.9, 2.9);
    k.box(4.5, 3.5, 0.18, 0xfef3c7, 0, 4.9, 2.8);
    k.art(4.2, 3.2, 5, 0, 4.9, 2.9);
    // 画笔和颜料桶
    const brush = k.sub(4.6, 0, 3.2); brush.g.rotation.z = -0.35;
    brush.cyl(0.13, 0.13, 4.2, 0xd97706, 0, 2.6, 0, 8); brush.cyl(0.17, 0.17, 0.6, 0xcbd5e1, 0, 4.9, 0, 8); brush.cone(0.2, 0.9, 0xdc2626, 0, 5.6, 0, 8);
    [0xdc2626, 0x2563eb, 0xfacc15, 0x16a34a].forEach((c, i) => { k.cyl(0.32, 0.28, 0.6, 0xe5e7eb, -5.4 + i * 0.8, 0.3, 3.4 + (i % 2) * 0.5); k.cyl(0.27, 0.27, 0.05, c, -5.4 + i * 0.8, 0.61, 3.4 + (i % 2) * 0.5); });
  } },

  yantian: { name: '集装箱码头', mapScale: 0.2, build(k, mini) {
    const cols = [0xdc2626, 0x2563eb, 0xf59e0b, 0x16a34a, 0xe5e7eb, 0x0e7490];
    if (!mini) k.box(64, 0.1, 26, 0x3b9ed6, 3, 0.06, -17.4).castShadow = false;
    k.box(16, 0.5, 0.7, 0x9ca3af, 0, 0.25, -4.1);
    // 堆场
    [3.2, 1.5].forEach((z, row) => [-5.4, -1.6, 2.2, 6].forEach((x, col) => {
      const n = 1 + ((col * 3 + row * 2 + 1) % 4);
      for (let l = 0; l < n; l++) k.box(3.6, 1.25, 1.5, cols[(col + row * 2 + l) % 6], x, 0.63 + l * 1.27, z);
    }));
    // 岸桥
    const red = 0xdc2626;
    for (const x of [-3.6, 3.6]) for (const z of [-1, -3.2]) k.box(0.5, 11.5, 0.5, red, x, 5.75, z);
    for (const z of [-1, -3.2]) k.box(7.7, 0.5, 0.5, red, 0, 6, z);
    for (const x of [-3.6, 3.6]) { k.box(0.4, 0.4, 2.7, red, x, 11.3, -2.1); k.box(0.3, 3.4, 0.3, 0xffffff, x, 8.6, -2.1).rotation.x = 0.7; }
    k.box(1.2, 0.8, 20, red, 0, 11.9, -7.5);
    k.box(2.2, 1.7, 2.6, 0xf8fafc, 0, 13.1, -0.6);
    k.box(0.3, 5, 0.3, red, 0, 14.8, -3).rotation.x = -0.5; k.box(0.3, 5, 0.3, red, 0, 14.8, -1).rotation.x = 0.5;
    k.box(0.12, 0.12, 12.5, 0xffffff, 0, 14.6, -10.2).rotation.x = -0.38;
    const tr = k.sub(0, 0, -10.5);
    tr.box(1.6, 0.6, 1.6, 0xfacc15, 0, 11.2, 0);
    for (const dx of [-0.6, 0.6]) tr.box(0.05, 4.4, 0.05, 0x1f2937, dx, 8.7, 0);
    tr.box(1.5, 1.25, 3.6, 0x2563eb, 0, 5.9, 0);
    // 靠泊的货轮
    const z = -10.5;
    hull(k, 0x7f1d1d, 0.1, 1.2, 0, z, 1.05); hull(k, 0x1f2937, 1.3, 1.3, 0, z, 1.05);
    k.box(2, 3.2, 3, 0xf8fafc, -5.4, 4.2, z); k.box(2.06, 0.5, 3.06, 0x1e293b, -5.4, 5.2, z);
    k.cyl(0.4, 0.45, 1.4, 0xf59e0b, -5.9, 6.5, z);
    for (let i = 0; i < 3; i++) for (let l = 0; l < 2 - (i === 2 ? 1 : 0); l++) k.box(1.5, 1.25, 3.1, cols[(i + l * 2) % 6], -3 + i * 1.7, 3.25 + l * 1.27, z);
    return mini ? null : t => { tr.g.position.z = -10.5 + Math.sin(t * 0.35) * 2.6; }; // 小车沿大梁来回
  } },
};

export function buildLandmark(id, mini = false) {
  const def = LANDMARKS[id];
  if (!def) return null;
  const g = new THREE.Group();
  g.userData.tick = def.build(kit(g), mini) || null;
  g.userData.name = def.name;
  g.userData.mapScale = def.mapScale;
  return g;
}

// ---------- 街景道具 ----------
// 世界坐标：北侧人行道 z∈[-9.3,-4.8]，步行道 z∈[-4.4,4.6]，南侧 z∈[5.2,7]（南侧只放矮的东西）。
// 返回可选的 tick(t)。
export const SHOPS = {
  huaqiangbei: ['手机配件', '芯片批发', '数码维修', '电子元件', '摄像头', '充电器', '主板回收', '屏幕总成'],
  futian: ['证券营业部', '精品咖啡', '便利店', '商务中心', '会展服务', '轻食沙拉', '西装定制', '律师事务所'],
  luohu: ['口岸商城', '货币找换', '茶餐厅', '行李寄存', '商务酒店', '大药房', '手信特产', '钟表行'],
  dongmen: ['糖水铺', '肠粉王', '服装批发', '凉茶', '金饰', '牛杂', '鞋城', '奶茶'],
  keji: ['创客空间', '手冲咖啡', '共享办公', '轻食', '图文打印', '健身房', '机器人实验室', '路演厅'],
  shekou: ['海鲜酒家', '精酿酒吧', '西餐厅', '帆船俱乐部', '咖啡烘焙', '潜水店', '面包房', '花店'],
  baoan: ['五金机电', '模具加工', '物流专线', '海鲜档', '劳保用品', '快餐', '轴承', '包装材料'],
  longhua: ['隆江猪脚饭', '手机维修', '便利店', '理发', '麻辣烫', '房屋出租', '快递驿站', '沙县小吃'],
  dafen: ['画廊', '画框装裱', '油画批发', '画材', '写生工作室', '艺术咖啡', '国画', '定制肖像'],
  yantian: ['报关行', '货运代理', '国际物流', '海鲜街', '船务公司', '保税仓', '拖车服务', '渔港饭店'],
};
export const SHOP_COLORS = ['#b91c1c', '#1d4ed8', '#047857', '#b45309', '#7c3aed', '#0f766e', '#be185d', '#334155'];
export const PALM_DISTRICTS = ['shekou', 'yantian', 'luohu'];

export function decorate(id, k, r) {
  const south = 6.1;
  if (id === 'huaqiangbei') {
    const words = ['手机', '芯片', '配件', '维修', '数码', '批发'], neon = ['#dc2626', '#0891b2', '#16a34a', '#d97706', '#7c3aed', '#db2777'];
    [-31, -25, -19, -10, -3, 3, 10].forEach((x, i) => k.sign(words[i % 6], { w: 0.95, h: 3.2, bg: neon[i % 6], fg: '#fff', vertical: true }, x, 6.3 + (i % 3) * 1.3, -9.3));
    for (const x of [-14, -2, 9]) for (let l = 0; l < 3; l++) k.box(0.9 - l * 0.1, 0.6, 0.7, l % 2 ? 0xc8a26b : 0xd9b98a, x + l * 0.05, 0.3 + l * 0.6, south);
    for (const x of [-12.6, 10.4]) { k.box(0.9, 0.08, 0.6, 0x2563eb, x, 0.25, south); k.box(0.06, 1.1, 0.06, 0x2563eb, x - 0.42, 0.8, south); k.box(0.8, 0.5, 0.5, 0xc8a26b, x, 0.55, south); }
  } else if (id === 'futian') {
    const flags = [0xdc2626, 0x2563eb, 0xfacc15, 0x16a34a, 0xffffff];
    [-14, -7, 0, 7, 14].forEach((x, i) => { k.cyl(0.05, 0.06, 5, 0xe5e7eb, x, 2.5, south, 6); k.box(1.1, 0.7, 0.04, flags[i], x + 0.6, 4.6, south); });
    for (const x of [-10.5, -3.5, 3.5, 10.5]) { k.box(2.4, 0.5, 0.9, 0x94a3b8, x, 0.25, south); k.box(2.2, 0.35, 0.7, 0x4c9a52, x, 0.65, south); }
  } else if (id === 'luohu') {
    car(k, -11, 6.5, 0xdc2626); car(k, -6.5, 6.5, 0xdc2626); car(k, 5, 6.5, 0x2563eb);
    k.sign('的士站', { w: 1.6, h: 0.5, bg: '#facc15', fg: '#111827' }, -8.8, 2.3, 5.5); k.cyl(0.05, 0.05, 2.2, 0x374151, -8.8, 1.1, 5.45, 6);
    [[-13.5, 0xdc2626], [-12.9, 0x1d4ed8], [11, 0x16a34a], [11.6, 0x111827]].forEach(([x, c]) => { k.box(0.45, 0.7, 0.28, c, x, 0.4, -4.9); k.box(0.04, 0.4, 0.04, 0x9ca3af, x, 0.95, -5); });
  } else if (id === 'dongmen') {
    for (const x of [-22, -10.6, -5.4, 5.4, 10.6, 18.6]) { // 灯笼串只挂在北侧人行道上方，不挡街心的视线
      k.cyl(0.06, 0.08, 5.9, 0x7f1d1d, x, 2.95, -4.95, 6);
      k.box(0.04, 0.04, 4.6, 0x1f2937, x, 5.8, -7.2).castShadow = false;
      for (let i = 0; i < 4; i++) { const b = k.ball(0.28, 0xdc2626, x, 5.42, -8.8 + i * 1.1); b.scale.y = 0.85; b.castShadow = false; k.box(0.13, 0.08, 0.13, 0xfacc15, x, 5.68, -8.8 + i * 1.1).castShadow = false; }
    }
    for (const x of [-12.5, 3.5]) { k.box(1.6, 0.9, 0.8, 0xb45309, x, 0.55, south); k.box(1.8, 0.08, 1, 0xdc2626, x, 2, south); for (const dx of [-0.8, 0.8]) k.box(0.05, 1.5, 0.05, 0xe5e7eb, x + dx, 1.25, south); k.cyl(0.2, 0.16, 0.3, 0x9ca3af, x - 0.3, 1.15, south); }
  } else if (id === 'keji') {
    const cs = [0xfacc15, 0x14b8a6, 0x3b82f6];
    for (let i = 0; i < 9; i++) bike(k, -14 + i * 1.5 + (i > 4 ? 12 : 0), south, cs[i % 3]);
    k.box(1.8, 1.1, 0.9, 0x1f2937, -1.5, 0.75, south); k.box(2, 0.08, 1.1, 0xf97316, -1.5, 2.1, south); for (const dx of [-0.9, 0.9]) k.box(0.05, 1.4, 0.05, 0xe5e7eb, -1.5 + dx, 1.4, south);
    const ds = [drone(k, -9, 7, 0), drone(k, 7, 8, -2)];
    return t => ds.forEach((d, i) => { d.position.x = (i ? 7 : -9) + Math.sin(t * 0.4 + i * 2) * 6; d.position.y = 7 + i + Math.sin(t * 1.5 + i) * 0.4; d.rotation.y = t * 0.8; });
  } else if (id === 'shekou') {
    const cs = [0xef4444, 0xfacc15, 0x38bdf8, 0xffffff];
    [-13, -5, 5, 13].forEach((x, i) => {
      k.cyl(0.04, 0.04, 2.2, 0xe5e7eb, x, 1.1, south, 6); k.cone(1.25, 0.5, cs[i], x, 2.3, south, 10);
      k.cyl(0.5, 0.5, 0.06, 0xf8fafc, x, 0.75, south, 12); k.cyl(0.05, 0.05, 0.75, 0x9ca3af, x, 0.37, south, 6);
      for (const dx of [-0.9, 0.9]) { k.box(0.4, 0.06, 0.4, 0x92400e, x + dx, 0.45, south); k.box(0.4, 0.5, 0.05, 0x92400e, x + dx, 0.7, south + 0.2); }
    });
    k.cyl(0.9, 0.9, 0.12, 0xf97316, -20.5, 1.6, -4.85, 16).rotation.x = Math.PI / 2;
  } else if (id === 'baoan') {
    for (const [x, n] of [[-13, 3], [-11.4, 2], [3, 3], [12, 1]]) { k.box(1.3, 0.16, 1.1, 0xa16207, x, 0.08, south); for (let i = 0; i < n; i++) k.box(1.1, 0.5, 0.95, i % 2 ? 0xc8a26b : 0xd9b98a, x, 0.41 + i * 0.52, south); }
    [[-6, 0x2563eb], [-5.2, 0xdc2626], [-4.4, 0x2563eb], [8, 0xdc2626]].forEach(([x, c]) => { k.cyl(0.33, 0.33, 0.9, c, x, 0.45, south); k.cyl(0.34, 0.34, 0.06, 0xe5e7eb, x, 0.6, south); });
    // 叉车
    k.box(1.5, 0.7, 0.9, 0xfacc15, 16.5, 0.6, south); k.box(0.7, 0.9, 0.85, 0x1f2937, 16.2, 1.35, south); k.box(0.1, 2, 0.8, 0x374151, 17.3, 1.1, south); k.box(0.9, 0.06, 0.7, 0x9ca3af, 17.8, 0.25, south);
    for (const dx of [-0.5, 0.5]) k.cyl(0.25, 0.25, 0.95, 0x111827, 16.5 + dx, 0.25, south).rotation.x = Math.PI / 2;
  } else if (id === 'longhua') {
    const cs = [0xef4444, 0x3b82f6, 0x22c55e, 0xfacc15, 0xf97316, 0xffffff];
    for (let i = 0; i < 10; i++) scooter(k, -15 + i * 1.5 + (i > 5 ? 9 : 0), south, cs[i % 6]);
    for (const x of [-24, -8, 8, 24]) { k.cyl(0.1, 0.13, 6.4, 0x6b7280, x, 3.2, 5.5, 8); k.box(1.4, 0.1, 0.1, 0x6b7280, x, 5.9, 5.5); }
    for (const y of [5.7, 6.05]) for (const z of [5.1, 5.9]) k.box(48, 0.03, 0.03, 0x111827, 0, y, z).castShadow = false;
    k.box(1.7, 1, 0.9, 0xe5e7eb, -19.5, 0.7, south); k.box(1.9, 0.08, 1.1, 0x2563eb, -19.5, 2.05, south); for (const dx of [-0.85, 0.85]) k.box(0.05, 1.3, 0.05, 0x9ca3af, -19.5 + dx, 1.4, south);
  } else if (id === 'dafen') {
    [-21.5, -11, -3, 5, 13].forEach((x, i) => easel(k, x, -7.4, 20 + i * 3, 1.25));
    [0xdc2626, 0x2563eb, 0xfacc15, 0x16a34a, 0xdb2777, 0xf97316].forEach((c, i) => { const x = -10 + i * 4.2; k.cyl(0.28, 0.24, 0.5, 0xe5e7eb, x, 0.25, south); k.cyl(0.24, 0.24, 0.05, c, x, 0.51, south); });
    for (const x of [-16, 0, 16]) for (let i = 0; i < 3; i++) k.art(1.2, 0.9, 40 + x + i, x + i * 0.25, 0.6, south - i * 0.12).rotation.x = -0.25;
  } else if (id === 'yantian') {
    const cs = [0xdc2626, 0x2563eb, 0xf59e0b, 0x16a34a, 0x0e7490];
    [-21, -13, -5, 6, 15].forEach((x, i) => k.box(3.6, 1.25, 1.5, cs[i], x, 0.63, 6.5));
    for (let x = -18; x <= 18; x += 4) { k.cyl(0.16, 0.2, 0.6, 0xfacc15, x + 2, 0.3, 5.25, 8); k.cyl(0.21, 0.21, 0.12, 0x111827, x + 2, 0.6, 5.25, 8); }
  }
  return null;
}
