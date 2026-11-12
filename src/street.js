// 第一人称的街区：按所在区的布局生成一条街，两侧有档口，地标在街东头或正对街尾。
// 只负责画面、走动和“靠近了谁”，不知道任何买卖规则。
import * as THREE from '../vendor/three.module.min.js';
import { labelSprite, signBoard, makeFigure, animateFigure, facadeMaterials, tileTexture } from './models.js';
import { kit, palm, buildLandmark, decorate, SHOPS, SHOP_COLORS, PALM_DISTRICTS } from './landmarks.js';
import { STREETS, buildSouth, capBuilding } from './streetscape.js';

const Z_MIN = -4.4, Z_MAX = 4.6, X_MIN = -21;
const SPEED = 7, TURN = 2.2, NEAR = 3.2, EYE = 1.72;
const SPOT_Z = 6.5, STAND_Z = 4; // 档口离街心的距离、站位离街心的距离（北侧取负）
const MOVE_KEYS = { w: [0, 1], arrowup: [0, 1], s: [0, -1], arrowdown: [0, -1], a: [-1, 0], d: [1, 0] }; // [右, 前]
const TURN_KEYS = { arrowleft: 1, arrowright: -1 };
const SHIRTS = [0xef4444, 0x3b82f6, 0x22c55e, 0xfacc15, 0xf8fafc, 0xa855f7, 0xf97316, 0x14b8a6, 0x64748b, 0xec4899];
const PANTS = [0x334155, 0x1e3a8a, 0x44403c, 0x111827, 0x78716c];
const HAIR = [0x2b2118, 0x111827, 0x4a3728, 0x6b7280];

export function createStreet(renderer, el, handlers) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa8d8f0);
  scene.fog = new THREE.Fog(0xa8d8f0, 50, 135);
  const camera = new THREE.PerspectiveCamera(66, 1, 0.1, 400);
  camera.rotation.order = 'YXZ';

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
  const pos = new THREE.Vector3(); // 玩家脚下的位置
  let yaw = 0, pitch = 0, turnTo = null, bob = 0; // 视线朝向：前方 = (-sin yaw, 0, -cos yaw)
  const keys = new Set();

  function dispose(root) {
    root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      for (const m of [].concat(o.material || [])) { if (m.map) m.map.dispose(); m.dispose(); }
    });
  }

  function build(d, idx, defs) {
    if (world) { scene.remove(world); dispose(world); }
    world = new THREE.Group();
    scene.add(world);
    spots = []; pickables = []; walkers = []; ticks = [];
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
    scene.fog.near = conf.fog[0]; scene.fog.far = conf.fog[1];
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
      if (lm.userData.tick) ticks.push(lm.userData.tick);
      const tag = labelSprite(lm.userData.name, { bg: 'rgba(120,53,15,.85)', size: 30 });
      tag.scale.multiplyScalar(0.7);
      if (atEnd) tag.position.set(28.5, 4.6, 0); else tag.position.set(27.5, 4.6, -9.2);
      world.add(tag);
    }

    // 地铁站、档口、服务点：每个都在自己的小坐标系里朝 +z 搭好，再摆到街的北侧或南侧
    defs.forEach((def, i) => {
      const [x, side] = conf.spots[i] || [16, 'n'];
      const sgn = side === 'n' ? -1 : 1;
      const spot = { ...def, x, side, stand: new THREE.Vector3(x, 0, sgn * STAND_Z), faceYaw: side === 'n' ? 0 : Math.PI };
      spots.push(spot);
      const sk = k.sub(x, 0, sgn * SPOT_Z);
      if (side === 's') sk.g.rotation.y = Math.PI;
      const label = y => {
        const s = labelSprite(`${spot.icon} ${spot.name}`);
        s.scale.multiplyScalar(0.4);
        s.position.set(0, y - 0.3, 0);
        s.userData.spot = spot;
        sk.g.add(s); pickables.push(s);
        const hit = new THREE.Mesh(new THREE.BoxGeometry(4.6, 4, 3.6), new THREE.MeshBasicMaterial({ visible: false }));
        hit.position.set(0, 2, 0);
        hit.userData.spot = spot;
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
        const vendor = makeFigure({ shirt: spot.color, hair: HAIR[i % HAIR.length], scale: 1.15 });
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
        hair: HAIR[Math.floor(r() * HAIR.length)], pack: r() < 0.3 ? 0x475569 : null, scale: 1.05 + r() * 0.15,
      });
      const dir = r() < 0.5 ? -1 : 1;
      f.position.set(-34 + r() * 60, 0, -3.6 + r() * 7.8);
      f.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      world.add(f);
      walkers.push({ f, dir, speed: 1.2 + r() * 1.4, phase: r() * 6 });
    }
  }

  function placeCamera() {
    camera.position.set(pos.x, EYE + bob, pos.z);
    camera.rotation.set(pitch, yaw, 0);
  }
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

  // ---------- 输入：拖动转视角，单击走过去或和档口互动 ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pt = new THREE.Vector3();
  function click(e) {
    const rc = el.getBoundingClientRect();
    ndc.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables)[0];
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
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
  });
  el.addEventListener('pointermove', e => {
    if (!active || !drag || drag.id !== e.pointerId) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) { drag.moved = true; el.style.cursor = 'grabbing'; }
    if (drag.moved) {
      const kf = 0.0045;
      yaw = wrap(yaw + (e.clientX - drag.x) * kf);
      pitch = THREE.MathUtils.clamp(pitch + (e.clientY - drag.y) * kf, -1.1, 1.1);
      turnTo = null;
    }
    drag.x = e.clientX; drag.y = e.clientY;
  });
  const release = e => {
    if (!drag || drag.id !== e.pointerId) return;
    const wasClick = !drag.moved && e.type === 'pointerup';
    drag = null;
    el.style.cursor = 'grab';
    if (wasClick && active && handlers.canMove()) click(e);
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);

  window.addEventListener('keydown', e => {
    if (!active || e.target.tagName === 'INPUT' || e.metaKey || e.ctrlKey) return;
    const key = e.key.toLowerCase();
    if (MOVE_KEYS[key] || TURN_KEYS[key]) { keys.add(key); e.preventDefault(); }
    else if ((key === 'e' || key === 'enter' || key === ' ') && near && handlers.canMove()) {
      if (e.target.tagName === 'BUTTON') return; // 让按钮自己的回车/空格生效
      e.preventDefault();
      turnTo = near.faceYaw;
      handlers.onInteract(near);
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
    if (turn) { yaw = wrap(yaw + turn * TURN * dt); turnTo = null; }
    let dx = 0, dz = 0, step = SPEED * dt;
    if (right || fwd) {
      target = null; pending = null; marker.visible = false; turnTo = null;
      const len = Math.hypot(right, fwd), sn = Math.sin(yaw), cs = Math.cos(yaw);
      dx = (-sn * fwd + cs * right) / len; dz = (-cs * fwd - sn * right) / len;
    } else if (target) {
      const ox = target.x - pos.x, oz = target.z - pos.z, dist = Math.hypot(ox, oz);
      if (dist < 0.12) {
        target = null; marker.visible = false;
        if (pending) { const p = pending; pending = null; turnTo = p.faceYaw; handlers.onInteract(p); }
      } else {
        dx = ox / dist; dz = oz / dist; step = Math.min(step, dist);
        if (!drag && dist > 1.5) turnTo = Math.atan2(-dx, -dz); // 自动走的时候，视线慢慢转向前进方向
      }
    }
    const moving = dx !== 0 || dz !== 0;
    if (moving) {
      pos.x = THREE.MathUtils.clamp(pos.x + dx * step, X_MIN, xMax);
      pos.z = THREE.MathUtils.clamp(pos.z + dz * step, Z_MIN, Z_MAX);
    }
    if (turnTo != null) {
      const diff = wrap(turnTo - yaw);
      yaw = wrap(yaw + diff * Math.min(1, dt * 5));
      pitch += (0 - pitch) * Math.min(1, dt * 3);
      if (Math.abs(diff) < 0.01) turnTo = null;
    }
    bob += ((moving ? Math.sin(t * 11) * 0.045 : 0) - bob) * Math.min(1, dt * 12);
    placeCamera();

    for (const w of walkers) {
      w.f.position.x += w.dir * w.speed * dt;
      if (w.f.position.x > xMax + 4 || w.f.position.x < -36) { w.dir *= -1; w.f.rotation.y = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
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
  }

  return {
    scene, camera, update,
    resize(w, h) { camera.aspect = w / h; camera.fov = w < h ? 78 : 66; camera.updateProjectionMatrix(); },
    setActive(v) { active = v; keys.clear(); drag = null; },
    // startX / startYaw 仅供调试：直接站到街上的某个位置、朝某个方向
    enter(district, idx, defs, startX, startYaw) {
      build(district, idx, defs);
      if (startX == null) { pos.set(spots[0].x + 2.8, 0, -2.4); yaw = -Math.PI / 2 + 0.12; } // 从地铁口出来，面朝东
      else { pos.set(startX, 0, 0); yaw = startYaw ?? -Math.PI / 2; }
      pitch = 0; turnTo = null; bob = 0;
      target = null; pending = null; marker.visible = false;
      near = null;
      placeCamera();
    },
  };
}
