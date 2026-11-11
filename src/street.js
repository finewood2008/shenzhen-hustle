// 可行走的街区：一条按所在区风格生成的步行街，北侧一排档口，东头是该区的地标。
// 只负责画面、走动和“靠近了谁”，不知道任何买卖规则。
import * as THREE from '../vendor/three.module.min.js';
import { labelSprite, signBoard, makeFigure, animateFigure, facadeMaterials, tileTexture } from './models.js';
import { kit, palm, buildLandmark, decorate, SHOPS, SHOP_COLORS, PALM_DISTRICTS } from './landmarks.js';

const BOUNDS = { xMin: -21, xMax: 32, zMin: -4.4, zMax: 4.6 }; // 东边可以一直走到地标跟前
const SPEED = 9, NEAR = 3;
const SPOT_Z = -6.5, STAND_Z = -4;
const LANDMARK_X = 27.5, LANDMARK_Z = -15.5; // 地标广场的位置，临街楼到 x = 19.5 为止
const MOVE_KEYS = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };
const SHIRTS = [0xef4444, 0x3b82f6, 0x22c55e, 0xfacc15, 0xf8fafc, 0xa855f7, 0xf97316, 0x14b8a6, 0x64748b, 0xec4899];
const PANTS = [0x334155, 0x1e3a8a, 0x44403c, 0x111827, 0x78716c];
const HAIR = [0x2b2118, 0x111827, 0x4a3728, 0x6b7280];

export function createStreet(renderer, el, handlers) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa8d8f0);
  scene.fog = new THREE.Fog(0xa8d8f0, 50, 135);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.3, 300);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f7a, 1.5));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.1);
  sun.position.set(-18, 34, 24);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 44, top: 34, bottom: -30, near: 1, far: 110 });
  scene.add(sun);

  const player = makeFigure({ shirt: 0xff5a1f, pack: 0x1f2937, scale: 1.2 });
  // 头顶的小箭头，方便在人群里认出自己
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.36, 4), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
  arrow.rotation.x = Math.PI; arrow.position.y = 2.15;
  player.add(arrow);
  scene.add(player);
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
  marker.rotation.x = -Math.PI / 2; marker.position.y = 0.05; marker.visible = false;
  scene.add(marker);

  let active = false, world = null, spots = [], pickables = [], walkers = [], ticks = [];
  let near = null, pending = null, target = null, down = false, facing = 0;
  const keys = new Set();

  function sign(k, spot, y) {
    const s = labelSprite(`${spot.icon} ${spot.name}`);
    s.scale.multiplyScalar(0.55);
    s.position.set(spot.x, y, SPOT_Z);
    s.userData.spot = spot;
    k.g.add(s); pickables.push(s);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(4.6, 4, 3.6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(spot.x, 2, SPOT_Z);
    hit.userData.spot = spot;
    k.g.add(hit); pickables.push(hit);
  }

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
    const k = kit(world);
    const flat = (w, dpt, color, x, y, z) => { const m = k.box(w, 0.1, dpt, color, x, y, z); m.castShadow = false; return m; };

    // 地面：草地、铺装、地砖步行道、盲道和本区颜色的边线
    flat(260, 260, 0xb9d99a, 0, -0.1, 0);
    flat(74, 17, 0xddd8cb, 0, -0.06, -1.5);
    flat(18, 13, 0xd4cfc1, LANDMARK_X, -0.06, LANDMARK_Z + 0.5);
    flat(74, 9.6, 0xffffff, 0, -0.04, 0.1).material.map = tileTexture(0xcbc4b4, 37, 5);
    flat(74, 0.35, 0xe0b23c, 0, -0.03, -4.25);
    flat(74, 0.25, d.color, 0, -0.03, -4.8);
    flat(74, 0.25, d.color, 0, -0.03, 4.95);
    for (const x of [-12, -4, 4, 12]) k.cyl(0.42, 0.42, 0.03, 0x6b7280, x + 1.6, 0.02, 1.2 + (x % 8) * 0.3, 14).castShadow = false; // 井盖

    // 北侧临街楼：窗户贴图、店面、雨棚、店招、楼顶设备
    const shops = SHOPS[d.id] || [];
    let shopIdx = 0;
    for (let x = -36; x < 19;) {
      const w = Math.min(4 + r() * 3.5, 19.5 - x);
      const h = 5 + (st.h[0] + r() * (st.h[1] - st.h[0])) * 2.2;
      const cx = x + w / 2, color = pal();
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 8), facadeMaterials(color, w, h));
      b.position.set(cx, h / 2, -13.5); b.castShadow = true; b.receiveShadow = true;
      world.add(b);
      k.box(w - 0.5, 2.5, 0.3, 0x2b3648, cx, 1.25, -9.4).castShadow = false;
      k.box(w - 1.9, 1.5, 0.08, 0x8db4d3, cx + 0.5, 1.3, -9.24).castShadow = false;
      k.box(0.9, 2, 0.08, 0x5b4636, cx - w / 2 + 1, 1, -9.24).castShadow = false;
      k.box(w - 0.3, 0.12, 1.1, pal(), cx, 2.56, -8.95);
      if (shops.length && w > 2.6) {
        const name = shops[shopIdx % shops.length];
        const s = signBoard(name, { w: Math.min(w - 0.9, name.length * 0.72 + 0.7), h: 0.85, bg: SHOP_COLORS[shopIdx % SHOP_COLORS.length] });
        s.position.set(cx, 3.2, -9.46);
        world.add(s);
        shopIdx++;
      }
      if (h < 26) { // 楼顶的空调外机和水箱（太高的楼看不到楼顶）
        k.box(1, 0.6, 0.8, 0x9ca3af, cx - w / 4, h + 0.3, -11.5);
        if (r() < 0.6) k.cyl(0.55, 0.55, 1, 0xcbd5e1, cx + w / 5, h + 0.5, -12.5);
      }
      x += w + 0.3;
    }
    // 后排天际线（地标后面留空）
    for (let x = -46; x < 18;) {
      const w = 6 + r() * 5;
      const h = 10 + (st.h[0] + r() * (st.h[1] - st.h[0])) * 3.6;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 8), facadeMaterials(pal(), w * 0.7, h * 0.7));
      b.position.set(x + w / 2, h / 2, -24);
      world.add(b);
      x += w + 1;
    }
    // 云
    for (let i = 0; i < 7; i++) {
      const c = k.ball(3 + r() * 3, 0xffffff, -60 + i * 20 + r() * 8, 38 + r() * 14, -50 - r() * 30);
      c.scale.set(2.2, 0.6, 1); c.castShadow = false;
      c.material = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
    }

    // 行道树、路灯、长椅、垃圾桶、南侧灌木（南侧不放高的东西，免得挡住镜头）
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
    for (const x of [-17, 1, 19]) {
      k.box(1.8, 0.1, 0.5, 0x92400e, x, 0.5, 5.7); k.box(1.8, 0.4, 0.08, 0x92400e, x, 0.8, 5.95);
      for (const dx of [-0.75, 0.75]) k.box(0.08, 0.5, 0.45, 0x374151, x + dx, 0.25, 5.7);
    }
    for (const x of [-15.3, 2.7]) { k.cyl(0.26, 0.22, 0.8, 0x15803d, x, 0.4, 5.6, 10); k.cyl(0.27, 0.27, 0.06, 0x111827, x, 0.82, 5.6, 10); }
    for (let x = -34; x <= 34; x += 4) {
      const b = k.ball(0.7, 0x5fa862, x + r() * 1.5, 0.3, 7.2 + r() * 0.5);
      b.material.flatShading = true; b.scale.set(1.5, 0.8, 1); b.castShadow = false;
    }

    // 本区专属的街景道具和地标
    const t1 = decorate(d.id, k, r);
    if (t1) ticks.push(t1);
    const lm = buildLandmark(d.id);
    if (lm) {
      lm.position.set(LANDMARK_X, 0, LANDMARK_Z);
      world.add(lm);
      if (lm.userData.tick) ticks.push(lm.userData.tick);
      lookUp = THREE.MathUtils.clamp(new THREE.Box3().setFromObject(lm).max.y * 0.3, 3, 13);
      const tag = labelSprite(lm.userData.name, { bg: 'rgba(120,53,15,.85)', size: 30 });
      tag.scale.multiplyScalar(0.6);
      tag.position.set(LANDMARK_X, 2.2, LANDMARK_Z + 6.8);
      world.add(tag);
    }

    // 可互动的点：地铁站、档口、服务点，从西到东排开
    const xs = [-16, -8, 0, 8, 16];
    defs.forEach((def, i) => {
      const spot = { ...def, x: xs[i], stand: new THREE.Vector3(xs[i], 0, STAND_Z) };
      spots.push(spot);
      const x = spot.x;
      if (spot.kind === 'metro') {
        for (const dx of [-1.7, 1.7]) k.box(0.35, 3, 0.35, 0x94a3b8, x + dx, 1.5, SPOT_Z + 0.9);
        k.box(4.4, 0.35, 3, 0x1d4ed8, x, 3.15, SPOT_Z);
        k.box(4.4, 0.5, 0.1, 0xffffff, x, 3.1, SPOT_Z + 1.52).castShadow = false;
        k.box(3.4, 2.6, 0.3, 0x1e293b, x, 1.3, SPOT_Z - 1.2);
        for (let s = 0; s < 4; s++) k.box(3, 0.2, 0.5, 0x64748b, x, 0.1 + s * 0.2, SPOT_Z - 0.2 - s * 0.25).castShadow = false;
        for (const dx of [-1.5, 1.5]) k.box(0.06, 0.9, 1.6, 0xcbd5e1, x + dx, 0.75, SPOT_Z - 0.3);
        k.box(0.5, 2.6, 0.2, 0x1d4ed8, x + 2.6, 1.3, SPOT_Z + 1.2);
        k.sign('M', { w: 0.42, h: 0.42, bg: '#ffffff', fg: '#1d4ed8' }, x + 2.6, 2.2, SPOT_Z + 1.31);
        sign(k, spot, 4.5);
      } else if (spot.kind === 'stall') {
        k.box(3.2, 0.9, 1.2, 0xa16207, x, 0.45, SPOT_Z + 0.6);
        k.box(3.3, 0.08, 1.3, 0xf5e6c8, x, 0.94, SPOT_Z + 0.6).castShadow = false;
        for (const dx of [-1.7, 1.7]) for (const dz of [-0.5, 1.5]) k.box(0.12, 2.7, 0.12, 0xe5e7eb, x + dx, 1.35, SPOT_Z + dz);
        for (let s = 0; s < 5; s++) // 条纹雨棚
          k.box(0.76, 0.14, 2.5, s % 2 ? 0xffffff : spot.color, x - 1.52 + s * 0.76, 2.75, SPOT_Z + 0.5);
        k.box(3.8, 0.4, 0.06, spot.color, x, 2.5, SPOT_Z + 1.75).castShadow = false;
        for (let s = 0; s < 5; s++) { // 桌上的货：箱子和圆罐混着摆
          const sz = 0.3 + r() * 0.22, gx = x - 1.25 + s * 0.62, gz = SPOT_Z + 0.4 + r() * 0.4;
          if (s % 2) k.cyl(sz * 0.5, sz * 0.5, sz, pal(), gx, 0.98 + sz / 2, gz, 10);
          else k.box(sz, sz, sz, pal(), gx, 0.98 + sz / 2, gz);
        }
        for (const dx of [-1.3, 1.3]) k.box(0.7, 0.5, 0.6, 0xc8a26b, x + dx * 1.75, 0.25, SPOT_Z - 0.2); // 地上的纸箱
        k.box(0.5, 0.36, 0.03, 0x111827, x + 1.2, 1.5, SPOT_Z + 1.0).rotation.x = -0.2; // 价目牌
        const vendor = makeFigure({ shirt: spot.color, hair: HAIR[i % HAIR.length], scale: 1.15 });
        vendor.position.set(x + 0.3, 0, SPOT_Z - 0.5);
        world.add(vendor);
        sign(k, spot, 3.9);
      } else {
        k.box(5, 3.4, 3, d.color, x, 1.7, SPOT_Z - 0.9);
        k.box(5.4, 0.25, 3.5, 0xf8fafc, x, 3.5, SPOT_Z - 0.9);
        k.box(1.3, 2.2, 0.15, 0x1e293b, x, 1.1, SPOT_Z + 0.63).castShadow = false;
        for (const dx of [-1.6, 1.6]) k.box(1.1, 0.9, 0.1, 0xbae6fd, x + dx, 1.9, SPOT_Z + 0.63).castShadow = false;
        k.box(1.7, 0.1, 0.9, 0x9ca3af, x, 0.05, SPOT_Z + 1.1).castShadow = false;
        k.sign(spot.name, { w: 2.6, h: 0.7, bg: '#ffffff', fg: '#' + d.color.toString(16).padStart(6, '0') }, x, 2.95, SPOT_Z + 0.62);
        sign(k, spot, 4.7);
      }
    });

    // 路人
    for (let i = 0; i < 10; i++) {
      const f = makeFigure({
        shirt: SHIRTS[Math.floor(r() * SHIRTS.length)], pants: PANTS[Math.floor(r() * PANTS.length)],
        hair: HAIR[Math.floor(r() * HAIR.length)], pack: r() < 0.3 ? 0x475569 : null, scale: 1.05 + r() * 0.15,
      });
      const dir = r() < 0.5 ? -1 : 1;
      f.position.set(-30 + r() * 60, 0, -3.4 + r() * 7.6);
      f.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      world.add(f);
      walkers.push({ f, dir, speed: 1.6 + r() * 1.8, phase: r() * 6 });
    }
  }

  // 平时是贴近的跟随镜头；走近东头的地标时，镜头拉远并抬头，把整座地标收进画面
  let wide = 0, lookUp = 4; // lookUp：地标越高，抬头越多
  function placeCamera(snap) {
    const f0 = THREE.MathUtils.smoothstep(player.position.x, 19, 27);
    wide = snap ? f0 : wide + (f0 - wide) * 0.08;
    const want = new THREE.Vector3(player.position.x, 13 - 3 * wide, player.position.z + 17 + 15 * wide);
    if (snap) camera.position.copy(want); else camera.position.lerp(want, 0.12);
    camera.lookAt(camera.position.x, 1.5 + lookUp * wide, camera.position.z - 20 - 22 * wide);
  }

  // ---------- 输入 ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pt = new THREE.Vector3();
  function point(e, first) {
    const rc = el.getBoundingClientRect();
    ndc.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (first) {
      const hit = ray.intersectObjects(pickables)[0];
      if (hit) { // 点中档口：走过去，到了自动打开
        pending = hit.object.userData.spot;
        target = pending.stand.clone();
        marker.visible = false;
        return;
      }
    }
    if (!ray.ray.intersectPlane(ground, pt)) return;
    pending = null;
    target = new THREE.Vector3(
      THREE.MathUtils.clamp(pt.x, BOUNDS.xMin, BOUNDS.xMax), 0, THREE.MathUtils.clamp(pt.z, BOUNDS.zMin, BOUNDS.zMax));
    marker.position.set(target.x, 0.05, target.z);
    marker.visible = true;
  }
  el.addEventListener('pointerdown', e => {
    if (!active || !handlers.canMove()) return;
    down = true;
    el.setPointerCapture(e.pointerId);
    point(e, true);
  });
  el.addEventListener('pointermove', e => { if (active && down && !pending) point(e, false); });
  const release = () => { down = false; };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);

  window.addEventListener('keydown', e => {
    if (!active || e.target.tagName === 'INPUT' || e.metaKey || e.ctrlKey) return;
    const key = e.key.toLowerCase();
    if (MOVE_KEYS[key]) { keys.add(key); e.preventDefault(); }
    else if ((key === 'e' || key === 'enter' || key === ' ') && near && handlers.canMove()) {
      if (e.target.tagName === 'BUTTON') return; // 让按钮自己的回车/空格生效
      e.preventDefault();
      handlers.onInteract(near);
    }
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  // ---------- 每帧 ----------
  function update(dt, t) {
    let dx = 0, dz = 0, step = SPEED * dt;
    if (handlers.canMove()) for (const key of keys) { dx += MOVE_KEYS[key][0]; dz += MOVE_KEYS[key][1]; }
    if (dx || dz) {
      target = null; pending = null; marker.visible = false;
      const len = Math.hypot(dx, dz); dx /= len; dz /= len;
    } else if (target) {
      const ox = target.x - player.position.x, oz = target.z - player.position.z, dist = Math.hypot(ox, oz);
      if (dist < 0.12) {
        target = null; marker.visible = false;
        if (pending) { const p = pending; pending = null; handlers.onInteract(p); }
      } else { dx = ox / dist; dz = oz / dist; step = Math.min(step, dist); }
    }
    const moving = dx !== 0 || dz !== 0;
    if (moving) {
      player.position.x = THREE.MathUtils.clamp(player.position.x + dx * step, BOUNDS.xMin, BOUNDS.xMax);
      player.position.z = THREE.MathUtils.clamp(player.position.z + dz * step, BOUNDS.zMin, BOUNDS.zMax);
      const want = Math.atan2(dx, dz);
      let diff = want - facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      facing += diff * Math.min(1, dt * 14);
      player.rotation.y = facing;
    }
    animateFigure(player, t * 14, moving);
    player.position.y = moving ? Math.abs(Math.sin(t * 14)) * 0.06 : 0;
    arrow.position.y = 2.15 + Math.sin(t * 4) * 0.07;
    arrow.rotation.y = t * 2 - facing;
    placeCamera(false);

    for (const w of walkers) {
      w.f.position.x += w.dir * w.speed * dt;
      if (Math.abs(w.f.position.x) > 32) { w.dir *= -1; w.f.rotation.y = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      animateFigure(w.f, t * (3 + w.speed * 2) + w.phase, true);
    }
    for (const tick of ticks) tick(t);

    let best = null, bestD = NEAR;
    for (const s of spots) {
      const dd = Math.hypot(s.stand.x - player.position.x, s.stand.z - player.position.z);
      if (dd < bestD) { best = s; bestD = dd; }
    }
    if (best !== near) { near = best; handlers.onNear(near); }
  }

  return {
    scene, camera, update,
    resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); },
    setActive(v) { active = v; keys.clear(); down = false; },
    // startX 仅供调试：直接站到街上的某个位置
    enter(district, idx, defs, startX) {
      build(district, idx, defs);
      player.position.set(startX ?? spots[0].x + 2.6, 0, startX == null ? -2.6 : 3); // 默认从地铁口出来
      facing = 0; player.rotation.y = 0;
      target = null; pending = null; marker.visible = false;
      near = null;
      placeCamera(true);
    },
  };
}
