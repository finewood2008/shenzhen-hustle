// 街区有两种视角，可以随时切换：
//   'iso' 斜俯视（默认）：镜头从斜上方 45 度跟着主角，可以绕着转和缩放；挡在镜头和街道之间的高楼会自动“剖开”。
//   'fp'  第一人称：站在街上平视。
// 按所在区的布局生成一条街，两侧有档口，地标在街东头或正对街尾。
// 只负责画面、走动和“靠近了谁”，不知道任何买卖规则。
import * as THREE from '../vendor/three.module.min.js';
import { labelSprite, signBoard, makeFigure, animateFigure, facadeMaterials, tileTexture } from './models.js';
import { kit, palm, buildLandmark, decorate, SHOPS, SHOP_COLORS, PALM_DISTRICTS } from './landmarks.js';
import { STREETS, buildSouth, capBuilding } from './streetscape.js';

const Z_MIN = -4.4, Z_MAX = 4.6, X_MIN = -21;
const SPEED = 7, TURN = 1.8, NEAR = 3.2;
const EYE = 1.72, CUT_H = 3.8; // 镜头这一侧，高过这个高度的大件会被隐藏
const SPOT_Z = 6.5, STAND_Z = 4; // 档口离街心的距离、站位离街心的距离（北侧取负）
const MOVE_KEYS = { w: [0, 1], arrowup: [0, 1], s: [0, -1], arrowdown: [0, -1], a: [-1, 0], d: [1, 0] }; // [右, 前]
const TURN_KEYS = { arrowleft: -1, arrowright: 1, q: -1 };
const SHIRTS = [0xef4444, 0x3b82f6, 0x22c55e, 0xfacc15, 0xf8fafc, 0xa855f7, 0xf97316, 0x14b8a6, 0x64748b, 0xec4899];
const PANTS = [0x334155, 0x1e3a8a, 0x44403c, 0x111827, 0x78716c];
const HAIR = [0x2b2118, 0x111827, 0x4a3728, 0x6b7280];

export function createStreet(renderer, el, handlers) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa8d8f0);
  scene.fog = new THREE.Fog(0xa8d8f0, 50, 135);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 500);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f7a, 1.5));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.1);
  sun.position.set(-18, 36, 26);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -50, right: 52, top: 42, bottom: -40, near: 1, far: 130 });
  scene.add(sun);

  const marker = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
  marker.rotation.x = -Math.PI / 2; marker.position.y = 0.06; marker.visible = false;
  scene.add(marker);

  let active = false, world = null, spots = [], pickables = [], walkers = [], ticks = [];
  let near = null, pending = null, target = null, xMax = 32;
  let chase = null, nearW = null; // 正要走过去搭话的路人、离得最近的路人
  const pos = new THREE.Vector3(); // 玩家脚下的位置
  // 镜头绕着主角转：az 是方位角（镜头在主角的 (sin az, cos az) 方向，0 = 正南），elev 是仰角，dist 是距离
  let az = -Math.PI / 4, elev = 0.72, dist = 31;
  // 第一人称的视线：前方 = (-sin yaw, 0, -cos yaw)
  let view = 'iso', yaw = 0, pitch = 0, turnTo = null, bob = 0, vw = 1, vh = 1, fogBase = [50, 135];
  let labels = [];
  const look = new THREE.Vector3(); // 镜头盯着的点，平滑地跟着主角
  let player = null, face = 0, faceTo = null, walkPhase = 0;
  let cuts = [], cutKey = '';
  const keys = new Set();
  const stick = { x: 0, y: 0 }; // 触屏摇杆：x 向右，y 向前
  const touches = new Map(); let pinch = 0; // 双指缩放

  function dispose(root) {
    root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      for (const m of [].concat(o.material || [])) { if (m.map) m.map.dispose(); m.dispose(); }
    });
  }

  function build(d, idx, defs) {
    if (world) { scene.remove(world); dispose(world); player = null; }
    world = new THREE.Group();
    scene.add(world);
    spots = []; pickables = []; walkers = []; ticks = []; cuts = []; cutKey = ''; labels = [];
    let seed = idx * 7919 + 31;
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const st = d.style, pal = () => st.palette[Math.floor(r() * st.palette.length)];
    const conf = STREETS[d.id];
    const k = kit(world);
    const flat = (w, dpt, color, x, y, z) => { const m = k.box(w, 0.1, dpt, color, x, y, z); m.castShadow = false; return m; };
    const atEnd = conf.landmark === 'end';
    xMax = atEnd ? 26 : 32;

    // 天色
    scene.background.set(conf.sky); scene.fog.color.set(conf.sky);
    fogBase = conf.fog;
    sun.color.set(conf.sun);

    // 地面：草地、铺装、地砖步行道、盲道和本区颜色的边线
    flat(300, 300, 0xb9d99a, 0, -0.1, 0);
    flat(98, 18.4, 0xddd8cb, 2, -0.06, -0.4);
    if (!atEnd) flat(18, 13, 0xd4cfc1, 27.5, -0.06, -15);
    flat(98, 9.6, 0xffffff, 2, -0.04, 0.1).material.map = tileTexture(conf.ground, 49, 5);
    flat(98, 0.35, 0xe0b23c, 2, -0.03, -4.25);
    flat(98, 0.25, d.color, 2, -0.03, -4.8);
    flat(98, 0.25, d.color, 2, -0.03, 4.95);
    for (const x of [-12, -4, 4, 12]) k.cyl(0.42, 0.42, 0.03, 0x6b7280, x + 1.6, 0.02, 1.2 + (x % 8) * 0.3, 14).castShadow = false; // 井盖

    // 一排临街楼。side 'n' 在北侧朝南，'s' 在南侧朝北；z 是楼正面离街心的距离
    const shops = SHOPS[d.id] || [];
    let shopIdx = 0;
    function row(o) {
      const g = new THREE.Group();
      if (o.side === 's') g.rotation.y = Math.PI;
      world.add(g);
      const rk = kit(g), z = -(o.z ?? 9.5), wr = o.w || [4, 7.5];
      const [a, b] = o.side === 's' ? [-o.x1, -o.x0] : [o.x0, o.x1];
      let bi = 0;
      for (let x = a; x < b - 1.5;) {
        const w = Math.min(wr[0] + r() * (wr[1] - wr[0]), b - x);
        const h = o.h ? o.h() : 5 + (st.h[0] + r() * (st.h[1] - st.h[0])) * 2.2;
        const cx = x + w / 2;
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, 8), facadeMaterials(pal(), w, h));
        body.position.set(cx, h / 2, z - 4); body.castShadow = true; body.receiveShadow = true;
        g.add(body);
        if (!o.plain) {
          rk.box(w - 0.5, 2.5, 0.3, 0x2b3648, cx, 1.25, z + 0.1).castShadow = false;
          rk.box(w - 1.9, 1.5, 0.08, 0x8db4d3, cx + 0.5, 1.3, z + 0.26).castShadow = false;
          rk.box(0.9, 2, 0.08, 0x5b4636, cx - w / 2 + 1, 1, z + 0.26).castShadow = false;
          rk.box(w - 0.3, 0.12, 1.1, pal(), cx, 2.56, z + 0.55);
          if (shops.length && w > 2.6) {
            const name = shops[shopIdx % shops.length];
            const s = signBoard(name, { w: Math.min(w - 0.9, name.length * 0.72 + 0.7), h: 0.85, bg: SHOP_COLORS[shopIdx % SHOP_COLORS.length] });
            s.position.set(cx, 3.2, z + 0.04);
            g.add(s);
            shopIdx++;
          }
          if (o.billboards && w > 7) {
            const s = signBoard(o.billboards[bi++ % o.billboards.length], { w: Math.min(w - 2, 7), h: 2.4, bg: '#0b1220', fg: ['#22d3ee', '#fde047', '#f472b6', '#4ade80'][bi % 4] });
            s.position.set(cx, 6.5 + r() * 3, z + 0.05);
            g.add(s);
          }
          if (h < 26) {
            rk.box(1, 0.6, 0.8, 0x9ca3af, cx - w / 4, h + 0.3, z - 2);
            if (r() < 0.6) rk.cyl(0.55, 0.55, 1, 0xcbd5e1, cx + w / 5, h + 0.5, z - 3);
          }
        }
        x += w + 0.3;
      }
    }

    // 北侧：临街楼和后排天际线；地标在侧面时给广场留出空位
    const rowEnd = conf.water ? 25 : 42;
    if (atEnd) row({ side: 'n', x0: -38, x1: rowEnd });
    else { row({ side: 'n', x0: -38, x1: 19.5 }); row({ side: 'n', x0: 35.5, x1: 42 }); }
    row({ side: 'n', x0: -46, x1: atEnd ? rowEnd : 18, z: 20, w: [6, 11], h: () => 10 + (st.h[0] + r() * (st.h[1] - st.h[0])) * 3.6, plain: true });
    // 南侧：每个区不一样
    const t0 = buildSouth(conf.south, { k, r, pal, d, x1: conf.water ? 30 : 42, row });
    if (t0) ticks.push(t0);
    // 街道两头收口
    const capH = () => 8 + (st.h[0] + r() * (st.h[1] - st.h[0])) * 2.4;
    let h = capH(); capBuilding(k, -43, Math.PI / 2, h, facadeMaterials(pal(), 19, h));
    if (!conf.water) { h = capH() + (atEnd ? 6 : 0); capBuilding(k, atEnd ? 50 : 46, -Math.PI / 2, h, facadeMaterials(pal(), 19, h)); }

    // 云
    for (let i = 0; i < 9; i++) {
      const c = k.ball(3 + r() * 3, 0xffffff, -80 + i * 20 + r() * 8, 40 + r() * 16, (i % 2 ? 1 : -1) * (40 + r() * 40));
      c.scale.set(2.2, 0.6, 1); c.castShadow = false;
      c.material = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
      c.userData.noCut = true;
    }

    // 可互动的点的位置
    const southXs = conf.spots.filter(s => s[1] === 's').map(s => s[0]);
    const clearSouth = x => southXs.every(sx => Math.abs(sx - x) > 3.4);

    // 行道树、路灯、长椅、垃圾桶
    const palms = PALM_DISTRICTS.includes(d.id);
    for (const x of [-20, -12, -4, 4, 12]) {
      k.box(1.3, 0.12, 1.3, 0x7c6a55, x, 0.02, -8.3).castShadow = false;
      if (palms) palm(k, x, -8.3, 4.2 + r() * 1.2);
      else {
        k.cyl(0.18, 0.24, 2.2, 0x8b5a2b, x, 1.1, -8.3, 8);
        const crown = k.ball(1.3, 0x4c9a52, x, 3.1, -8.3); crown.material.flatShading = true; crown.rotation.y = x;
        k.ball(0.8, 0x5fa862, x + 0.6, 3.7, -8).material.flatShading = true;
      }
    }
    for (const x of [-24, -10.6, 2.4, 13.6, 21.5]) { // 路灯贴着北侧楼脚，灯臂伸向街心
      k.cyl(0.07, 0.09, 5, 0x374151, x, 2.5, -9, 8);
      k.box(0.08, 0.08, 1.3, 0x374151, x, 4.95, -8.4);
      k.box(0.3, 0.12, 0.55, 0xfef9c3, x, 4.88, -7.8).castShadow = false;
    }
    for (const x of [-17, 1, 19]) if (clearSouth(x)) {
      k.box(1.8, 0.1, 0.5, 0x92400e, x, 0.5, 5.9); k.box(1.8, 0.4, 0.08, 0x92400e, x, 0.8, 6.15);
      for (const dx of [-0.75, 0.75]) k.box(0.08, 0.5, 0.45, 0x374151, x + dx, 0.25, 5.9);
    }
    for (const x of [-15.3, 2.7]) if (clearSouth(x)) { k.cyl(0.26, 0.22, 0.8, 0x15803d, x, 0.4, 5.6, 10); k.cyl(0.27, 0.27, 0.06, 0x111827, x, 0.82, 5.6, 10); }

    // 本区专属的街景道具和地标
    const t1 = decorate(d.id, k, r);
    if (t1) ticks.push(t1);
    const lm = buildLandmark(d.id);
    if (lm) {
      if (atEnd) { lm.position.set(34, 0, 0); lm.rotation.y = -Math.PI / 2; } // 正对街尾，面朝西
      else lm.position.set(27.5, 0, -15.5);
      world.add(lm);
      lm.userData.unit = true; // 地标整体显示或整体隐藏
      if (lm.userData.tick) ticks.push(lm.userData.tick);
      const tag = labelSprite(lm.userData.name, { bg: 'rgba(120,53,15,.85)', size: 30 });
      labels.push({ s: tag, base: tag.scale.clone(), iso: 0.6, fp: 0.7, y: 4.6 });
      if (atEnd) tag.position.set(28.5, 4.6, 0); else tag.position.set(27.5, 4.6, -9.2);
      world.add(tag);
    }

    // 地铁站、档口、服务点：每个都在自己的小坐标系里朝 +z 搭好，再摆到街的北侧或南侧
    defs.forEach((def, i) => {
      const [x, side] = conf.spots[i] || [16, 'n'];
      const sgn = side === 'n' ? -1 : 1;
      const spot = { ...def, x, side, stand: new THREE.Vector3(x, 0, sgn * STAND_Z), faceYaw: side === 'n' ? Math.PI : 0 };
      spots.push(spot);
      const sk = k.sub(x, 0, sgn * SPOT_Z);
      if (side === 's') sk.g.rotation.y = Math.PI;
      const label = y => {
        const s = labelSprite(`${spot.icon} ${spot.name}`);
        s.position.set(0, y, 0);
        labels.push({ s, base: s.scale.clone(), iso: 0.42, fp: 0.4, y });
        s.userData.spot = spot;
        sk.g.add(s); pickables.push(s);
        const hit = new THREE.Mesh(new THREE.BoxGeometry(4.6, 4, 3.6), new THREE.MeshBasicMaterial({ visible: false }));
        hit.position.set(0, 2, 0);
        hit.userData.spot = spot; hit.userData.noCut = true;
        sk.g.add(hit); pickables.push(hit);
      };
      if (spot.kind === 'metro') {
        for (const dx of [-1.7, 1.7]) sk.box(0.35, 3, 0.35, 0x94a3b8, dx, 1.5, 0.9);
        sk.box(4.4, 0.35, 3, 0x1d4ed8, 0, 3.15, 0);
        sk.box(4.4, 0.5, 0.1, 0xffffff, 0, 3.1, 1.52).castShadow = false;
        sk.sign('地铁 Metro', { w: 3, h: 0.42, bg: '#ffffff', fg: '#1d4ed8' }, 0, 3.1, 1.58);
        sk.box(3.4, 2.6, 0.3, 0x1e293b, 0, 1.3, -1.2);
        for (let s = 0; s < 4; s++) sk.box(3, 0.2, 0.5, 0x64748b, 0, 0.1 + s * 0.2, -0.2 - s * 0.25).castShadow = false;
        for (const dx of [-1.5, 1.5]) sk.box(0.06, 0.9, 1.6, 0xcbd5e1, dx, 0.75, -0.3);
        sk.box(0.5, 2.6, 0.2, 0x1d4ed8, 2.6, 1.3, 1.2);
        sk.sign('M', { w: 0.42, h: 0.42, bg: '#ffffff', fg: '#1d4ed8' }, 2.6, 2.2, 1.31);
        label(4.5);
      } else if (spot.kind === 'stall') {
        sk.box(3.2, 0.9, 1.2, 0xa16207, 0, 0.45, 0.6);
        sk.box(3.3, 0.08, 1.3, 0xf5e6c8, 0, 0.94, 0.6).castShadow = false;
        for (const dx of [-1.7, 1.7]) for (const dz of [-0.5, 1.5]) sk.box(0.12, 2.7, 0.12, 0xe5e7eb, dx, 1.35, dz);
        for (let s = 0; s < 5; s++) // 条纹雨棚
          sk.box(0.76, 0.14, 2.5, s % 2 ? 0xffffff : spot.color, -1.52 + s * 0.76, 2.75, 0.5);
        sk.box(3.8, 0.45, 0.06, spot.color, 0, 2.48, 1.75).castShadow = false;
        sk.sign(spot.name, { w: 2.4, h: 0.4, bg: '#' + spot.color.toString(16).padStart(6, '0'), fg: '#ffffff' }, 0, 2.48, 1.79);
        for (let s = 0; s < 5; s++) { // 桌上的货：箱子和圆罐混着摆
          const sz = 0.3 + r() * 0.22, gx = -1.25 + s * 0.62, gz = 0.4 + r() * 0.4;
          if (s % 2) sk.cyl(sz * 0.5, sz * 0.5, sz, pal(), gx, 0.98 + sz / 2, gz, 10);
          else sk.box(sz, sz, sz, pal(), gx, 0.98 + sz / 2, gz);
        }
        for (const dx of [-2.27, 2.27]) sk.box(0.7, 0.5, 0.6, 0xc8a26b, dx, 0.25, -0.2); // 地上的纸箱
        sk.box(0.5, 0.36, 0.03, 0x111827, 1.2, 1.5, 1.0).rotation.x = -0.2; // 价目牌
        const vendor = makeFigure({ shirt: spot.color, hair: HAIR[i % HAIR.length], scale: 1.15, apron: true,
          hairStyle: ['short', 'bun', 'cap', 'long'][(i + idx) % 4], build: 1 + ((i + idx) % 3) * 0.08 });
        vendor.position.set(0.3, 0, -0.5);
        sk.g.add(vendor);
        label(3.9);
      } else {
        sk.box(5, 3.4, 3, d.color, 0, 1.7, -0.9);
        sk.box(5.4, 0.25, 3.5, 0xf8fafc, 0, 3.5, -0.9);
        sk.box(1.3, 2.2, 0.15, 0x1e293b, 0, 1.1, 0.63).castShadow = false;
        for (const dx of [-1.6, 1.6]) sk.box(1.1, 0.9, 0.1, 0xbae6fd, dx, 1.9, 0.63).castShadow = false;
        sk.box(1.7, 0.1, 0.9, 0x9ca3af, 0, 0.05, 1.1).castShadow = false;
        sk.sign(spot.name, { w: 2.6, h: 0.7, bg: '#ffffff', fg: '#' + d.color.toString(16).padStart(6, '0') }, 0, 2.95, 0.62);
        label(4.7);
      }
    });

    // 路人
    for (let i = 0; i < 12; i++) {
      const f = makeFigure({
        shirt: SHIRTS[Math.floor(r() * SHIRTS.length)], pants: PANTS[Math.floor(r() * PANTS.length)],
        hair: HAIR[Math.floor(r() * HAIR.length)], pack: r() < 0.3 ? 0x475569 : null, scale: 0.98 + r() * 0.24,
        hairStyle: ['short', 'short', 'long', 'long', 'bun', 'cap', 'bald'][Math.floor(r() * 7)],
        hat: SHIRTS[Math.floor(r() * SHIRTS.length)], skirt: r() < 0.22, bag: r() < 0.35 ? PANTS[Math.floor(r() * PANTS.length)] : null,
        build: 0.9 + r() * 0.3,
      });
      const dir = r() < 0.5 ? -1 : 1;
      f.position.set(X_MIN - 1 + r() * (xMax - X_MIN), 0, -3.4 + r() * 7.2);
      f.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      f.userData.noCut = true;
      world.add(f);
      const w = { i, f, dir, speed: 1.2 + r() * 1.4, phase: r() * 6, talking: false, mark: null };
      const hit = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.1, 1.3), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 1.05; hit.userData.walker = w;
      f.add(hit); pickables.push(hit);
      walkers.push(w);
      setMark(w, handlers.walkerMark ? handlers.walkerMark(i) : null);
    }

    makePlayer();

    // 记下哪些东西在街的哪一侧、够不够高大，镜头转到那一侧时把它们藏起来
    world.updateMatrixWorld(true);
    const box = new THREE.Box3(), size = new THREE.Vector3();
    const consider = (o, unit) => {
      box.setFromObject(o); box.getSize(size);
      const big = unit || (box.max.y > CUT_H && size.x * size.z > 9) || box.min.y > 5.5;
      if (!big) return;
      const across = box.min.z < 9 && box.max.z > -9; // 横在街上（街两头的楼、街尾的地标）
      const c = { o, s: box.min.z > 5.2, n: box.max.z < -5.2, e: across && box.min.x > xMax + 1, w: across && box.max.x < X_MIN - 4 };
      if (c.s || c.n || c.e || c.w) cuts.push(c);
    };
    (function walk(o) {
      for (const ch of o.children) {
        if (ch.userData.noCut || ch.isSprite) continue;
        if (ch.userData.unit) consider(ch, true);
        else if (ch.isMesh) consider(ch, false);
        else walk(ch);
      }
    })(world);
  }

  // 切换视角时要跟着变的东西：视野、雾、名字牌大小、主角是否可见
  // 路人头顶的标记（💬 有消息、❗ 有事相求），没有就传 null
  function setMark(w, icon) {
    if (w.mark) { w.f.remove(w.mark); w.mark.material.map.dispose(); w.mark.material.dispose(); w.mark = null; }
    if (!icon) return;
    w.mark = labelSprite(icon, { bg: icon === '❗' ? 'rgba(220,38,38,.92)' : 'rgba(245,158,11,.95)', size: 30 });
    w.mark.scale.multiplyScalar(0.36);
    w.mark.position.y = 2.25;
    w.f.add(w.mark);
  }
  const faceEachOther = w => {
    const a = Math.atan2(w.f.position.x - pos.x, w.f.position.z - pos.z);
    faceTo = a; turnTo = a + Math.PI; w.f.rotation.y = a + Math.PI;
  };
  function talkTo(w) {
    chase = null; target = null; marker.visible = false;
    w.talking = true;
    faceEachOther(w);
    handlers.onTalk(w.i);
  }
  // 主角：形象由玩家自己定，脚下一圈光环方便在人群里找到
  function makePlayer() {
    if (player) { world.remove(player); dispose(player); }
    player = makeFigure(handlers.playerLook ? handlers.playerLook() : { shirt: 0xff5a1f, pants: 0x1f2937, pack: 0x2563eb, scale: 1.2 });
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.66, 28), new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.9 }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = 0.05;
    player.add(halo);
    player.userData.noCut = true;
    player.position.copy(pos); player.rotation.y = face;
    player.visible = view !== 'fp';
    world.add(player);
  }
  function applyView() {
    const fp = view === 'fp', tall = vw < vh;
    camera.fov = fp ? (tall ? 78 : 66) : (tall ? 50 : 38);
    camera.near = fp ? 0.1 : 0.5;
    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();
    scene.fog.near = fogBase[0] + (fp ? 0 : 25); scene.fog.far = fogBase[1] + (fp ? 0 : 40);
    for (const l of labels) { l.s.scale.copy(l.base).multiplyScalar(fp ? l.fp : l.iso); l.s.position.y = l.y + (fp ? -0.3 : 0.3); }
    if (player) player.visible = !fp;
    cutKey = '';
  }
  function placeCamera(snap) {
    let key = 'fp';
    if (view === 'fp') {
      camera.rotation.order = 'YXZ';
      camera.position.set(pos.x, EYE + bob, pos.z);
      camera.rotation.set(pitch, yaw, 0);
    } else {
      if (snap) look.set(pos.x, 1.1, pos.z);
      const h = Math.cos(elev) * dist;
      camera.position.set(look.x + Math.sin(az) * h, look.y + Math.sin(elev) * dist, look.z + Math.cos(az) * h);
      camera.lookAt(look);
      key = (Math.cos(az) > 0.3 ? 's' : Math.cos(az) < -0.3 ? 'n' : '') + (Math.sin(az) > 0.3 ? 'e' : Math.sin(az) < -0.3 ? 'w' : '');
    }
    if (key !== cutKey) { // 斜俯视时剖开镜头这一侧的高楼；第一人称全部显示
      cutKey = key;
      for (const c of cuts) c.o.visible = !((c.s && key.includes('s')) || (c.n && key.includes('n')) || (c.e && key.includes('e')) || (c.w && key.includes('w')));
    }
  }
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

  // ---------- 输入：拖动转镜头，滚轮缩放，单击走过去或和档口互动 ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pt = new THREE.Vector3();
  function click(e) {
    const rc = el.getBoundingClientRect();
    ndc.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables)[0];
    if (hit && hit.object.userData.walker) { // 点中路人：他站住等你，你走过去搭话
      chase = hit.object.userData.walker; pending = null; target = null; marker.visible = false;
      return;
    }
    chase = null;
    if (hit) { // 点中档口：走过去，到了自动打开
      pending = hit.object.userData.spot;
      target = pending.stand.clone();
      marker.visible = false;
      return;
    }
    if (!ray.ray.intersectPlane(ground, pt) || pt.distanceTo(camera.position) > 60) return;
    pending = null;
    target = new THREE.Vector3(THREE.MathUtils.clamp(pt.x, X_MIN, xMax), 0, THREE.MathUtils.clamp(pt.z, Z_MIN, Z_MAX));
    marker.position.set(target.x, 0.06, target.z);
    marker.visible = true;
  }
  let drag = null;
  el.addEventListener('pointerdown', e => {
    if (!active || !handlers.canMove()) return;
    try { el.setPointerCapture(e.pointerId); } catch { /* 合成事件没有可捕获的指针 */ }
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) { // 第二根手指落下：开始缩放，不再当成拖动或点击
      const [a, b] = [...touches.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y); drag = null;
      return;
    }
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
  });
  el.addEventListener('pointermove', e => {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (active && pinch && touches.size === 2) {
      const [a, b] = [...touches.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (view !== 'fp' && d > 10) dist = THREE.MathUtils.clamp(dist * pinch / d, 13, 44);
      pinch = d;
      return;
    }
    if (!active || !drag || drag.id !== e.pointerId) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) { drag.moved = true; el.style.cursor = 'grabbing'; }
    if (drag.moved) {
      const mx = e.clientX - drag.x, my = e.clientY - drag.y;
      if (view === 'fp') {
        yaw = wrap(yaw + mx * 0.0045);
        pitch = THREE.MathUtils.clamp(pitch + my * 0.0045, -1.1, 1.1);
        turnTo = null;
      } else {
        az = wrap(az - mx * 0.006);
        elev = THREE.MathUtils.clamp(elev + my * 0.004, 0.56, 1.2);
      }
    }
    drag.x = e.clientX; drag.y = e.clientY;
  });
  const release = e => {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch = 0;
    if (!drag || drag.id !== e.pointerId) return;
    const wasClick = !drag.moved && e.type === 'pointerup';
    drag = null;
    el.style.cursor = 'grab';
    if (wasClick && active && handlers.canMove()) click(e);
  };
  el.addEventListener('wheel', e => {
    if (!active || view === 'fp') return;
    e.preventDefault();
    dist = THREE.MathUtils.clamp(dist * (e.deltaY > 0 ? 1.1 : 0.9), 13, 44);
  }, { passive: false });
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);

  window.addEventListener('keydown', e => {
    if (!active || e.target.tagName === 'INPUT' || e.metaKey || e.ctrlKey) return;
    const key = e.key.toLowerCase();
    if (MOVE_KEYS[key] || TURN_KEYS[key]) { keys.add(key); e.preventDefault(); }
    else if ((key === 'e' || key === 'enter' || key === ' ') && near && handlers.canMove()) {
      if (e.target.tagName === 'BUTTON') return; // 让按钮自己的回车/空格生效
      e.preventDefault();
      faceTo = near.faceYaw; turnTo = near.faceYaw + Math.PI;
      handlers.onInteract(near);
    } else if ((key === 'e' || key === 'enter' || key === ' ') && nearW && !nearW.talking && handlers.canMove()) {
      if (e.target.tagName === 'BUTTON') return;
      e.preventDefault();
      talkTo(nearW);
    }
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  // ---------- 每帧 ----------
  function update(dt, t) {
    let right = 0, fwd = 0, turn = 0;
    if (handlers.canMove()) for (const key of keys) {
      if (MOVE_KEYS[key]) { right += MOVE_KEYS[key][0]; fwd += MOVE_KEYS[key][1]; }
      else turn += TURN_KEYS[key];
    }
    if (handlers.canMove()) { right += stick.x; fwd += stick.y; }
    const fp = view === 'fp', heading = fp ? yaw : az; // 键盘方向相对镜头：W 是往画面深处走
    if (turn) { if (fp) { yaw = wrap(yaw - turn * TURN * dt); turnTo = null; } else az = wrap(az + turn * TURN * dt); }
    let dx = 0, dz = 0, step = SPEED * dt;
    if (right || fwd) {
      target = null; pending = null; chase = null; marker.visible = false; turnTo = null;
      const len = Math.hypot(right, fwd), sn = Math.sin(heading), cs = Math.cos(heading);
      dx = (-sn * fwd + cs * right) / len; dz = (-cs * fwd - sn * right) / len;
    } else if (chase) {
      const ox = chase.f.position.x - pos.x, oz = chase.f.position.z - pos.z, d2 = Math.hypot(ox, oz);
      if (d2 < 1.7) talkTo(chase);
      else { dx = ox / d2; dz = oz / d2; if (fp && !drag) turnTo = Math.atan2(-dx, -dz); }
    } else if (target) {
      const ox = target.x - pos.x, oz = target.z - pos.z, d2 = Math.hypot(ox, oz);
      if (d2 < 0.12) {
        target = null; marker.visible = false;
        if (pending) { const p = pending; pending = null; faceTo = p.faceYaw; turnTo = p.faceYaw + Math.PI; handlers.onInteract(p); }
      } else {
        dx = ox / d2; dz = oz / d2; step = Math.min(step, d2);
        if (fp && !drag && d2 > 1.5) turnTo = Math.atan2(-dx, -dz); // 第一人称自动走时，视线慢慢转向前进方向
      }
    }
    const moving = dx !== 0 || dz !== 0;
    if (moving) {
      pos.x = THREE.MathUtils.clamp(pos.x + dx * step, X_MIN, xMax);
      pos.z = THREE.MathUtils.clamp(pos.z + dz * step, Z_MIN, Z_MAX);
    }
    // 主角朝着走的方向，停在档口前就转身面对档口
    if (moving) faceTo = Math.atan2(dx, dz);
    if (faceTo != null) face = wrap(face + wrap(faceTo - face) * Math.min(1, dt * 12));
    walkPhase += dt * 11;
    player.position.copy(pos);
    player.rotation.y = face;
    animateFigure(player, walkPhase, moving);
    if (fp && turnTo != null) {
      const diff = wrap(turnTo - yaw);
      yaw = wrap(yaw + diff * Math.min(1, dt * 5));
      pitch += (0 - pitch) * Math.min(1, dt * 3);
      if (Math.abs(diff) < 0.01) turnTo = null;
    }
    bob += ((fp && moving ? Math.sin(t * 11) * 0.045 : 0) - bob) * Math.min(1, dt * 12);
    look.x += (pos.x - look.x) * Math.min(1, dt * 6);
    look.z += (pos.z - look.z) * Math.min(1, dt * 6);
    placeCamera();

    let bestW = null, bestWD = 2.4;
    for (const w of walkers) {
      const wd = Math.hypot(w.f.position.x - pos.x, w.f.position.z - pos.z);
      if (wd < bestWD) { bestW = w; bestWD = wd; }
      if (w.talking || w === chase) { // 站住，面朝你
        if (w === chase) w.f.rotation.y = Math.atan2(pos.x - w.f.position.x, pos.z - w.f.position.z);
        animateFigure(w.f, 0, false);
        continue;
      }
      w.f.position.x += w.dir * w.speed * dt;
      const turn = w.f.position.x > xMax - 1 ? -1 : w.f.position.x < X_MIN - 2 ? 1 : 0; // 走到街头就掉头
      if (turn && turn !== w.dir) { w.dir = turn; w.f.rotation.y = turn > 0 ? Math.PI / 2 : -Math.PI / 2; }
      // 路人会绕开玩家，不从镜头里穿过去
      const ax = w.f.position.x - pos.x, az = w.f.position.z - pos.z;
      if (Math.abs(ax) < 3 && Math.abs(az) < 1.3) w.f.position.z = THREE.MathUtils.clamp(w.f.position.z + (az >= 0 ? 1 : -1) * 3 * dt, Z_MIN - 0.3, Z_MAX + 0.3);
      animateFigure(w.f, t * (3 + w.speed * 2.4) + w.phase, true);
    }
    for (const tick of ticks) tick(t);

    let best = null, bestD = NEAR;
    for (const s of spots) {
      const dd = Math.hypot(s.stand.x - pos.x, s.stand.z - pos.z);
      if (dd < bestD) { best = s; bestD = dd; }
    }
    if (best !== near) { near = best; handlers.onNear(near); }
    if (bestW !== nearW) { nearW = bestW; if (handlers.onNearWalker) handlers.onNearWalker(nearW ? nearW.i : null); }
  }

  return {
    scene, camera, update,
    resize(w, h) { vw = w; vh = h; applyView(); },
    get view() { return view; },
    refreshPlayer() { if (world) makePlayer(); },
    // 聊完了：路人接着走，头顶的标记换成新的（通常是去掉）
    releaseWalker(i, icon = null) {
      const w = walkers[i];
      if (!w) return;
      w.talking = false;
      w.f.rotation.y = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      setMark(w, icon);
    },
    setView(v) {
      if (v === view) return;
      view = v;
      if (v === 'fp') { yaw = wrap(face + Math.PI); pitch = 0; turnTo = null; } // 进第一人称时，看向主角面朝的方向
      else { face = wrap(yaw + Math.PI); faceTo = null; } // 回到俯视时镜头方位保持上次的样子，主角面朝刚才看的方向
      applyView(); placeCamera(true);
    },
    setActive(v) { active = v; keys.clear(); drag = null; touches.clear(); pinch = 0; stick.x = stick.y = 0; },
    setStick(x, y) { stick.x = x; stick.y = y; },
    // startX / startAz 仅供调试：直接站到街上的某个位置、把镜头转到某个方位
    enter(district, idx, defs, startX, startAz) {
      build(district, idx, defs);
      if (startX == null) pos.set(spots[0].x + 2.8, 0, -2.4); // 从地铁口出来
      else pos.set(startX, 0, 0);
      az = startAz ?? -Math.PI / 4;
      face = Math.PI / 2; faceTo = null;
      yaw = -Math.PI / 2 + 0.12; pitch = 0; turnTo = null; bob = 0;
      applyView();
      target = null; pending = null; chase = null; nearW = null; marker.visible = false;
      near = null;
      player.position.copy(pos); player.rotation.y = face;
      placeCamera(true);
    },
  };
}
