// 每个区的街道布局：南侧是什么、地标摆在哪、档口怎么排、天色和地面。
// 街道沿 x 轴，北侧临街楼正面在 z = -9.5，南侧场景从 z ≈ 8.5 往南。
import * as THREE from '../vendor/three.module.min.js';

// spots 依次是：地铁站、小商品档、土特产档、尖货档、服务点（如果有）；每项是 [x, 'n' | 's']
// landmark：'side' 在街东头北侧的广场上；'end' 正对街道尽头
export const STREETS = {
  huaqiangbei: { south: 'mall', landmark: 'side', ground: 0xbfb8a8, sky: 0xa8d8f0, sun: 0xfff1d6, fog: [50, 135],
    spots: [[-16, 'n'], [-8, 'n'], [4, 's'], [8, 'n']] },
  futian: { south: 'park', landmark: 'end', ground: 0xd5d9de, sky: 0x9fd0f5, sun: 0xffffff, fog: [60, 160],
    spots: [[-16, 'n'], [-8, 'n'], [0, 'n'], [8, 'n'], [16, 'n']] },
  luohu: { south: 'rail', landmark: 'end', ground: 0xc9c2b2, sky: 0xa8d8f0, sun: 0xfff1d6, fog: [50, 135],
    spots: [[-16, 'n'], [0, 's'], [-8, 'n'], [8, 'n'], [14, 's']] },
  dongmen: { south: 'shops', landmark: 'end', ground: 0xb98b73, sky: 0xf3dcb4, sun: 0xffd08a, fog: [40, 120],
    spots: [[-16, 'n'], [-8, 'n'], [-4, 's'], [10, 's']] },
  keji: { south: 'campus', landmark: 'side', ground: 0xcfd6dc, sky: 0xb6e0f7, sun: 0xffffff, fog: [60, 150],
    spots: [[-16, 'n'], [-8, 'n'], [0, 'n'], [15, 's']] },
  shekou: { south: 'sea', landmark: 'end', water: true, ground: 0xc19a6b, sky: 0x8fd3f7, sun: 0xfff6dd, fog: [70, 190],
    spots: [[-16, 'n'], [-8, 'n'], [0, 's'], [9, 's']] },
  baoan: { south: 'wall', landmark: 'side', ground: 0x8f9299, sky: 0xcfd8dc, sun: 0xf1eee4, fog: [35, 110],
    spots: [[-16, 'n'], [-8, 'n'], [-1, 's'], [8, 'n'], [16, 'n']] },
  longhua: { south: 'village', landmark: 'side', ground: 0xa9a59c, sky: 0xecd2bc, sun: 0xffc98f, fog: [40, 115],
    spots: [[-16, 'n'], [-2, 's'], [-8, 'n'], [13, 's'], [8, 'n']] },
  dafen: { south: 'mural', landmark: 'side', ground: 0xd8c9a6, sky: 0xbfe3f2, sun: 0xfff1d6, fog: [50, 140],
    spots: [[-16, 'n'], [-8, 'n'], [0, 'n'], [8, 'n']] },
  yantian: { south: 'yard', landmark: 'end', water: true, ground: 0x8b9097, sky: 0xa9cfe6, sun: 0xf5f1e6, fog: [55, 160],
    spots: [[-16, 'n'], [-8, 'n'], [0, 'n'], [8, 'n']] },
};

function fence(k, x0, x1, z, h, color) {
  for (let x = x0; x <= x1; x += 2.5) k.box(0.1, h, 0.1, color, x, h / 2, z);
  k.box(x1 - x0, 0.07, 0.07, color, (x0 + x1) / 2, h, z).castShadow = false;
  k.box(x1 - x0, 0.05, 0.05, color, (x0 + x1) / 2, h * 0.55, z).castShadow = false;
}
const flat = (k, w, d, color, x, y, z) => { const m = k.box(w, 0.1, d, color, x, y, z); m.castShadow = false; return m; };
function tree(k, x, z, s = 1) {
  k.cyl(0.18 * s, 0.24 * s, 2.2 * s, 0x8b5a2b, x, 1.1 * s, z, 8);
  k.ball(1.3 * s, 0x4c9a52, x, 3.1 * s, z).material.flatShading = true;
  k.ball(0.8 * s, 0x5fa862, x + 0.6 * s, 3.7 * s, z + 0.3).material.flatShading = true;
}

// c: { k, r, pal, d, x1（东边到哪）, row(opts) 生成一排临街楼 }；返回可选的 tick(t)
export function buildSouth(type, c) {
  const { k, r, x1 } = c, x0 = -38, mid = (x0 + x1) / 2, len = x1 - x0;

  if (type === 'shops') { c.row({ side: 's', x0, x1 }); return null; }

  if (type === 'mall') { // 高大的电子商场，楼面挂着大广告牌
    c.row({ side: 's', x0, x1, w: [9, 13], h: () => 16 + r() * 12, billboards: ['数码广场', '手机批发城', '电子市场', '通讯城', '元器件中心'] });
    return null;
  }

  if (type === 'village') { // 又窄又高的握手楼
    c.row({ side: 's', x0, x1, w: [2.6, 3.8], h: () => 11 + r() * 8 });
    return null;
  }

  if (type === 'park') { // 中心公园：草坪、喷泉、远处的高楼
    flat(k, len, 26, 0x8fc97a, mid, -0.05, 22);
    for (let x = x0; x < x1; x += 3) { const b = k.ball(0.6, 0x4c9a52, x + r(), 0.35, 8.8); b.scale.set(2.6, 1, 1); b.castShadow = false; }
    for (let i = 0; i < 16; i++) tree(k, x0 + 3 + r() * (len - 6), 13 + r() * 16, 1 + r() * 0.5);
    k.cyl(3.4, 3.6, 0.6, 0xcbd5e1, 2, 0.3, 14, 24); k.cyl(3.1, 3.1, 0.1, 0x60a5fa, 2, 0.6, 14, 24).castShadow = false;
    k.cyl(0.5, 0.7, 1.4, 0xcbd5e1, 2, 1, 14, 12);
    const jets = [0, 1, 2, 3, 4].map(i => k.cone(0.16, 2.2, 0xdbeafe, 2 + Math.cos(i * 1.257) * 1.8, 1.6, 14 + Math.sin(i * 1.257) * 1.8, 6));
    const mid2 = k.cone(0.22, 3.4, 0xdbeafe, 2, 3.2, 14, 6);
    c.row({ side: 's', x0, x1, z: 36, w: [8, 12], h: () => 30 + r() * 30, plain: true });
    return t => { jets.forEach((j, i) => { j.scale.y = 0.7 + Math.sin(t * 3 + i) * 0.3; }); mid2.scale.y = 0.8 + Math.sin(t * 2) * 0.2; };
  }

  if (type === 'rail') { // 铁路：栏杆、道砟、两股铁轨和缓缓开过的列车
    fence(k, x0, x1, 8.6, 1.5, 0x6b7280);
    flat(k, len + 60, 9, 0x8a7f72, mid, -0.04, 13.6);
    for (const z of [11.2, 12.6, 14.8, 16.2]) k.box(len + 60, 0.14, 0.12, 0x52525b, mid, 0.1, z).castShadow = false;
    for (let x = x0 - 20; x < x1 + 20; x += 1.3) { flat(k, 0.3, 2.2, 0x5b4636, x, 0.0, 11.9); flat(k, 0.3, 2.2, 0x5b4636, x, 0.0, 15.5); }
    for (let x = x0; x < x1; x += 14) { k.box(0.16, 6, 0.16, 0x4b5563, x, 3, 9.8); k.box(0.1, 0.1, 7.4, 0x4b5563, x, 5.9, 13.4); }
    k.box(len + 60, 0.04, 0.04, 0x111827, mid, 5.6, 11.9).castShadow = false; k.box(len + 60, 0.04, 0.04, 0x111827, mid, 5.6, 15.5).castShadow = false;
    const train = k.sub(0, 0, 11.9);
    for (let i = 0; i < 5; i++) {
      const cx = i * 11.4;
      train.box(11, 2.6, 2.3, i === 0 ? 0xf8fafc : 0x15803d, cx, 1.8, 0);
      train.box(11.02, 0.7, 2.34, 0x1e293b, cx, 2.3, 0);
      train.box(11.02, 0.25, 2.34, 0xfacc15, cx, 1.2, 0);
      train.box(10.6, 0.25, 1.9, 0x94a3b8, cx, 3.2, 0);
    }
    c.row({ side: 's', x0, x1, z: 21, w: [6, 10], h: () => 10 + r() * 14, plain: true });
    return t => { train.g.position.x = ((t * 6) % 220) - 130; };
  }

  if (type === 'campus') { // 科技园区：草坪、矮树篱、玻璃办公楼和几何雕塑
    flat(k, len, 9, 0x8fc97a, mid, -0.05, 13);
    for (let x = x0; x < x1; x += 3) { const b = k.ball(0.55, 0x4c9a52, x + r(), 0.3, 8.7); b.scale.set(2.8, 1, 1); b.castShadow = false; }
    for (let x = x0 + 2; x < x1 - 8;) {
      const w = 10 + r() * 5, h = 8 + r() * 6, cx = x + w / 2;
      k.box(w, h, 9, 0x8fc1e6, cx, h / 2, 23);
      for (let y = 2.5; y < h; y += 2.5) k.box(w + 0.1, 0.2, 9.1, 0xf8fafc, cx, y, 23).castShadow = false;
      for (let vx = -w / 2; vx <= w / 2 + 0.01; vx += w / 4) k.box(0.2, h, 0.2, 0xf8fafc, cx + vx, h / 2, 18.45).castShadow = false;
      k.box(w + 0.6, 0.3, 9.6, 0xe2e8f0, cx, h + 0.15, 23);
      x += w + 3;
    }
    [[-22, 0xf97316], [-6, 0x22c55e], [8, 0x38bdf8], [20, 0xfacc15]].forEach(([x, col], i) => {
      if (x > x1 - 2) return;
      const m = k.box(1.6, 1.6, 1.6, col, x, 1.6, 12.5); m.rotation.set(0.6, 0.5 + i, 0.3);
      k.cyl(0.5, 0.7, 0.5, 0x9ca3af, x, 0.25, 12.5);
    });
    for (let i = 0; i < 8; i++) tree(k, x0 + 4 + r() * (len - 8), 11 + r() * 5);
    return null;
  }

  if (type === 'sea') { // 海滨栈道：栏杆外就是海，远处有帆船和对岸的山
    flat(k, 220, 160, 0x3b9ed6, 20, -0.35, 8.9 + 80);
    k.box(len + 20, 0.5, 0.5, 0x8b6b47, mid, -0.1, 8.7);
    fence(k, x0, x1, 8.4, 1.15, 0xf8fafc);
    const boats = [[-20, 26], [-2, 40], [14, 22], [30, 55], [-34, 60]].map(([x, z], i) => {
      const b = k.sub(x, -0.3, z);
      b.box(2.8, 0.6, 0.9, 0xffffff, 0, 0.3, 0); b.cyl(0.04, 0.04, 3.4, 0xe5e7eb, 0, 2.2, 0, 6);
      const sail = b.cone(1.1, 3, [0xffffff, 0xef4444, 0xfacc15][i % 3], 0.55, 2.3, 0, 3); sail.scale.z = 0.08;
      return b.g;
    });
    for (let i = 0; i < 9; i++) { const m = k.cone(14 + r() * 10, 9 + r() * 9, 0x7fa9b8, -90 + i * 26 + r() * 8, 3, 150, 6); m.castShadow = false; }
    return t => boats.forEach((b, i) => { b.rotation.z = Math.sin(t * 1.2 + i) * 0.06; b.position.x += Math.sin(t * 0.2 + i) * 0.004; });
  }

  if (type === 'wall') { // 工厂围墙：标语、大门、门卫亭，墙后是厂房和烟囱
    const gates = [-14, 12].filter(g => g < x1 - 4);
    let from = x0;
    for (const g of [...gates, null]) {
      const to = g == null ? x1 : g - 2.5;
      k.box(to - from, 2.6, 0.4, 0xe5e7eb, (from + to) / 2, 1.3, 9.2);
      k.box(to - from, 0.2, 0.6, 0x9ca3af, (from + to) / 2, 2.7, 9.2);
      if (g != null) {
        for (const dx of [-2.5, 2.5]) k.box(0.6, 3.2, 0.6, 0x9ca3af, g + dx, 1.6, 9.2);
        for (let i = 0; i < 9; i++) k.box(0.08, 1.8, 0.08, 0x475569, g - 2 + i * 0.5, 0.9, 9.2);
        k.box(4.4, 0.1, 0.1, 0x475569, g, 1.8, 9.2); k.box(4.4, 0.1, 0.1, 0x475569, g, 0.3, 9.2);
        k.box(1.6, 2.4, 1.6, 0xf8fafc, g + 4.2, 1.2, 8.2); k.box(1.9, 0.2, 1.9, 0x1e3a8a, g + 4.2, 2.5, 8.2); k.box(1, 0.8, 0.05, 0x7ea3c4, g + 4.2, 1.5, 7.38);
        from = g + 2.5;
      }
    }
    ['安全生产', '质量第一', '诚信经营', '准时交货', '精益求精', '客户至上'].forEach((s, i) => {
      const x = [-32, -24.5, -5.6, 3.6, 22, 32][i]; if (x > x1 - 3) return; // 避开大门和南侧档口
      k.sign(s, { w: 4.4, h: 1.1, bg: '#ffffff', fg: '#b91c1c' }, x, 1.5, 8.98, Math.PI);
    });
    for (let x = x0 + 1; x < x1 - 10;) {
      const w = 12 + r() * 6, h = 6 + r() * 3, cx = x + w / 2, col = [0xd4d4d8, 0x93b4d1, 0xa8a29e][Math.floor(r() * 3)];
      k.box(w, h, 12, col, cx, h / 2, 18);
      for (let i = 0; i < 4; i++) k.box(w / 4, 0.3, 12, 0x71717a, cx - w * 0.375 + i * w / 4, h + 0.7, 18).rotation.z = 0.45;
      if (r() < 0.6) { k.cyl(0.6, 0.8, 16, 0xe5e7eb, cx + w / 3, 8, 26); k.cyl(0.72, 0.76, 1, 0xdc2626, cx + w / 3, 14.5, 26); }
      x += w + 2;
    }
    return null;
  }

  if (type === 'mural') { // 画廊墙：整面墙挂着画，墙后是彩色的小画室
    k.box(len, 3.4, 0.4, 0xfffbeb, mid, 1.7, 9.2);
    k.box(len, 0.25, 0.7, 0x9a3412, mid, 3.5, 9.2);
    for (let x = x0 + 2, i = 0; x < x1 - 1.5; x += 3.3, i++) {
      const w = 2 + (i % 3) * 0.3, h = 1.4 + ((i + 1) % 3) * 0.3;
      k.box(w + 0.24, h + 0.24, 0.1, 0x7c4a1e, x, 1.9, 8.95).castShadow = false;
      k.art(w, h, 60 + i * 7, x, 1.9, 8.88, Math.PI);
    }
    const cols = [0xfb7185, 0xfacc15, 0x38bdf8, 0x4ade80, 0xc084fc];
    for (let x = x0 + 2, i = 0; x < x1 - 5; x += 6.5, i++) {
      const h = 4 + r() * 2.5;
      k.box(5.4, h, 6, cols[i % 5], x + 2.7, h / 2, 14);
      k.box(4.1, 4.1, 6.3, 0x9a3412, x + 2.7, h, 14).rotation.z = Math.PI / 4;
    }
    return null;
  }

  if (type === 'yard') { // 集装箱堆场：铁丝网后面是成排的箱子和一台龙门吊
    fence(k, x0, x1, 8.6, 2.2, 0x6b7280);
    flat(k, len, 14, 0x7b8088, mid, -0.05, 15);
    const cols = [0xdc2626, 0x2563eb, 0xf59e0b, 0x16a34a, 0xe5e7eb, 0x0e7490, 0x7c3aed];
    for (const z of [10.6, 12.3, 16.2, 17.9]) for (let x = x0 + 2; x < x1 - 2; x += 3.9) {
      const n = 1 + Math.floor(r() * 5);
      for (let l = 0; l < n; l++) k.box(3.6, 1.25, 1.5, cols[Math.floor(r() * 7)], x, 0.63 + l * 1.27, z);
    }
    const gx = Math.min(4, x1 - 8);
    for (const dz of [9.6, 19]) for (const dx of [-3, 3]) k.box(0.5, 10, 0.5, 0xfacc15, gx + dx, 5, dz);
    for (const dx of [-3, 3]) k.box(0.6, 0.8, 10, 0xfacc15, gx + dx, 10.2, 14.3);
    k.box(6.6, 0.6, 0.6, 0xfacc15, gx, 10.2, 9.6); k.box(6.6, 0.6, 0.6, 0xfacc15, gx, 10.2, 19);
    k.box(2, 1.4, 2, 0x1f2937, gx, 9.4, 14);
    return null;
  }
  return null;
}

// 街道两头的收口楼，正面朝街心
export function capBuilding(k, x, facing, h, materials) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(19, h, 8), materials);
  b.position.set(x, h / 2, 0);
  b.rotation.y = facing; // +π/2 朝东，-π/2 朝西
  b.castShadow = true; b.receiveShadow = true;
  k.g.add(b);
  return b;
}
