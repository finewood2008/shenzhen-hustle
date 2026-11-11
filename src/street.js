// 可行走的街区：一条按所在区风格生成的步行街，北侧一排档口。
// 只负责画面、走动和“靠近了谁”，不知道任何买卖规则。
import * as THREE from '../vendor/three.module.min.js';
import { labelSprite, makeFigure } from './models.js';

const BOUNDS = { x: 21, zMin: -4.4, zMax: 4.6 };
const SPEED = 9, NEAR = 3;
const SPOT_Z = -6.5, STAND_Z = -4;
const MOVE_KEYS = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };

export function createStreet(renderer, el, handlers) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa8d8f0);
  scene.fog = new THREE.Fog(0xa8d8f0, 45, 120);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.3, 300);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f7a, 1.5));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.1);
  sun.position.set(-18, 30, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 26, bottom: -26, near: 1, far: 90 });
  scene.add(sun);

  const player = makeFigure({ pack: 0x1f2937, scale: 1.2 });
  // 头顶的小箭头，方便在人群里认出自己
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 4), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
  arrow.rotation.x = Math.PI; arrow.position.y = 2.25;
  player.add(arrow);
  scene.add(player);
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
  marker.rotation.x = -Math.PI / 2; marker.position.y = 0.04; marker.visible = false;
  scene.add(marker);

  let active = false, world = null, spots = [], pickables = [], walkers = [];
  let near = null, pending = null, target = null, down = false, facing = 0;
  const keys = new Set();

  function mesh(parent, geo, color, x, y, z, shadow = true) {
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
    m.position.set(x, y, z);
    m.castShadow = shadow; m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  const box = (parent, w, h, d, color, x, y, z, shadow) => mesh(parent, new THREE.BoxGeometry(w, h, d), color, x, y, z, shadow);

  function sign(parent, spot, y) {
    const s = labelSprite(`${spot.icon} ${spot.name}`);
    s.scale.multiplyScalar(0.55);
    s.position.set(spot.x, y, SPOT_Z);
    s.userData.spot = spot;
    parent.add(s); pickables.push(s);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(4.6, 4, 3.6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(spot.x, 2, SPOT_Z);
    hit.userData.spot = spot;
    parent.add(hit); pickables.push(hit);
  }

  function build(d, idx, defs) {
    if (world) {
      scene.remove(world);
      world.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
      });
    }
    world = new THREE.Group();
    scene.add(world);
    spots = []; pickables = []; walkers = [];
    let seed = idx * 7919 + 31;
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const st = d.style, pal = () => st.palette[Math.floor(r() * st.palette.length)];

    // 地面：草地、铺装、步行道和两条本区颜色的边线
    const grass = mesh(world, new THREE.PlaneGeometry(240, 240), 0xb9d99a, 0, -0.03, 0, false);
    grass.rotation.x = -Math.PI / 2;
    box(world, 72, 0.1, 17, 0xddd8cb, 0, -0.05, -1.5, false);
    box(world, 72, 0.1, 9.6, 0xcbc4b4, 0, -0.04, 0.1, false);
    box(world, 72, 0.1, 0.25, d.color, 0, -0.03, -4.75, false);
    box(world, 72, 0.1, 0.25, d.color, 0, -0.03, 4.95, false);

    // 北侧临街楼和后排天际线
    for (let x = -34; x < 34;) {
      const w = 4 + r() * 3.5;
      const h = 5 + (st.h[0] + r() * (st.h[1] - st.h[0])) * 2.2;
      const cx = x + w / 2;
      box(world, w, h, 8, pal(), cx, h / 2, -13.5);
      box(world, w - 0.6, 2.6, 0.3, 0x334155, cx, 1.3, -9.4, false);
      box(world, w - 0.3, 0.15, 1.3, pal(), cx, 2.9, -8.9);
      for (let y = 4.4; y < h - 1; y += 2.4) box(world, w - 1, 1, 0.1, 0x7ea3c4, cx, y, -9.47, false);
      x += w + 0.3;
    }
    for (let x = -44; x < 44;) {
      const w = 6 + r() * 5;
      const h = 10 + (st.h[0] + r() * (st.h[1] - st.h[0])) * 3.6;
      box(world, w, h, 8, pal(), x + w / 2, h / 2, -24, false);
      x += w + 1;
    }

    // 行道树和南侧的矮灌木（南侧不放高的东西，免得挡住镜头）
    for (const x of [-20, -12, -4, 4, 12, 20]) {
      mesh(world, new THREE.CylinderGeometry(0.18, 0.24, 2.2, 8), 0x8b5a2b, x, 1.1, -8.3);
      const crown = mesh(world, new THREE.IcosahedronGeometry(1.25, 0), 0x4c9a52, x, 3, -8.3);
      crown.material.flatShading = true; crown.rotation.y = x;
    }
    for (let x = -30; x <= 30; x += 4) {
      const b = mesh(world, new THREE.IcosahedronGeometry(0.7, 0), 0x5fa862, x + r() * 1.5, 0.3, 6.2 + r() * 0.5);
      b.material.flatShading = true; b.scale.set(1.5, 0.8, 1);
    }

    // 可互动的点：地铁站、档口、服务点，从西到东排开
    const xs = [-16, -8, 0, 8, 16];
    defs.forEach((def, i) => {
      const spot = { ...def, x: xs[i], stand: new THREE.Vector3(xs[i], 0, STAND_Z) };
      spots.push(spot);
      const x = spot.x;
      if (spot.kind === 'metro') {
        box(world, 0.35, 3, 0.35, 0x94a3b8, x - 1.7, 1.5, SPOT_Z + 0.9);
        box(world, 0.35, 3, 0.35, 0x94a3b8, x + 1.7, 1.5, SPOT_Z + 0.9);
        box(world, 4.4, 0.35, 3, 0x1d4ed8, x, 3.15, SPOT_Z);
        box(world, 3.4, 2.6, 0.3, 0x1e293b, x, 1.3, SPOT_Z - 1.2);
        for (let k = 0; k < 4; k++) box(world, 3, 0.2, 0.5, 0x64748b, x, 0.1 + k * 0.2, SPOT_Z - 0.2 - k * 0.25, false);
        sign(world, spot, 4.5);
      } else if (spot.kind === 'stall') {
        box(world, 3.2, 0.9, 1.2, 0xa16207, x, 0.45, SPOT_Z + 0.6);
        for (const dx of [-1.7, 1.7]) for (const dz of [-0.5, 1.5]) box(world, 0.12, 2.7, 0.12, 0xe5e7eb, x + dx, 1.35, SPOT_Z + dz);
        for (let k = 0; k < 5; k++) // 条纹雨棚
          box(world, 0.76, 0.14, 2.5, k % 2 ? 0xffffff : spot.color, x - 1.52 + k * 0.76, 2.75, SPOT_Z + 0.5);
        for (let k = 0; k < 4; k++) {
          const s = 0.35 + r() * 0.25;
          box(world, s, s, s, pal(), x - 1.1 + k * 0.75, 0.9 + s / 2, SPOT_Z + 0.5 + r() * 0.3);
        }
        const vendor = makeFigure({ shirt: spot.color, scale: 1.15 });
        vendor.position.set(x + 0.3, 0, SPOT_Z - 0.5);
        world.add(vendor);
        sign(world, spot, 3.9);
      } else {
        box(world, 5, 3.4, 3, d.color, x, 1.7, SPOT_Z - 0.9);
        box(world, 5.4, 0.25, 3.5, 0xf8fafc, x, 3.5, SPOT_Z - 0.9);
        box(world, 1.3, 2.2, 0.15, 0x1e293b, x, 1.1, SPOT_Z + 0.63, false);
        box(world, 1.1, 0.9, 0.1, 0xbae6fd, x - 1.6, 1.9, SPOT_Z + 0.63, false);
        box(world, 1.1, 0.9, 0.1, 0xbae6fd, x + 1.6, 1.9, SPOT_Z + 0.63, false);
        sign(world, spot, 4.7);
      }
    });

    // 路人
    for (let i = 0; i < 8; i++) {
      const f = makeFigure({ shirt: pal(), scale: 1.05 + r() * 0.15 });
      const dir = r() < 0.5 ? -1 : 1;
      f.position.set(-26 + r() * 52, 0, -3.4 + r() * 7.6);
      f.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      world.add(f);
      walkers.push({ f, dir, speed: 1.6 + r() * 1.8, phase: r() * 6 });
    }
  }

  function placeCamera(snap) {
    const want = new THREE.Vector3(player.position.x, 13, player.position.z + 17);
    if (snap) camera.position.copy(want); else camera.position.lerp(want, 0.12);
    camera.lookAt(camera.position.x, 1.5, camera.position.z - 20);
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
      THREE.MathUtils.clamp(pt.x, -BOUNDS.x, BOUNDS.x), 0, THREE.MathUtils.clamp(pt.z, BOUNDS.zMin, BOUNDS.zMax));
    marker.position.set(target.x, 0.04, target.z);
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
    const k = e.key.toLowerCase();
    if (MOVE_KEYS[k]) { keys.add(k); e.preventDefault(); }
    else if ((k === 'e' || k === 'enter' || k === ' ') && near && handlers.canMove()) {
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
    if (handlers.canMove()) for (const k of keys) { dx += MOVE_KEYS[k][0]; dz += MOVE_KEYS[k][1]; }
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
      player.position.x = THREE.MathUtils.clamp(player.position.x + dx * step, -BOUNDS.x, BOUNDS.x);
      player.position.z = THREE.MathUtils.clamp(player.position.z + dz * step, BOUNDS.zMin, BOUNDS.zMax);
      const want = Math.atan2(dx, dz);
      let diff = want - facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      facing += diff * Math.min(1, dt * 14);
      player.rotation.y = facing;
    }
    player.position.y = moving ? Math.abs(Math.sin(t * 13)) * 0.14 : 0;
    arrow.position.y = 2.25 + Math.sin(t * 4) * 0.08;
    arrow.rotation.y = t * 2 - facing;
    placeCamera(false);

    for (const w of walkers) {
      w.f.position.x += w.dir * w.speed * dt;
      if (Math.abs(w.f.position.x) > 28) { w.dir *= -1; w.f.rotation.y = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      w.f.position.y = Math.abs(Math.sin(t * 9 + w.phase)) * 0.1;
    }

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
    enter(district, idx, defs) {
      build(district, idx, defs);
      player.position.set(spots[0].x + 2.6, 0, -2.6); // 从地铁口出来
      facing = 0; player.rotation.y = 0;
      target = null; pending = null; marker.visible = false;
      near = null;
      placeCamera(true);
    },
  };
}
