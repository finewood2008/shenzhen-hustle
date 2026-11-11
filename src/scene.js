// 3D 沙盘：只负责画面和拾取，不知道任何玩法规则。
import * as THREE from '../vendor/three.module.min.js';
import { ROADS } from './content.js';
import { labelSprite } from './models.js';
import { createStreet } from './street.js';

const DAY = new THREE.Color(0xa8d8f0), NIGHT = new THREE.Color(0x0e1633);

export function createScene(container, districts, handlers) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  const el = renderer.domElement;
  el.style.touchAction = 'none';

  // 两个模式共用一个渲染器：'map' 是城市沙盘，'street' 是可行走的街区
  const street = createStreet(renderer, el, handlers.street);
  let mode = 'map';

  const scene = new THREE.Scene();
  scene.background = DAY.clone();
  scene.fog = new THREE.Fog(DAY.clone(), 70, 170);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 400);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x7c8a6a, 1.5);
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
  sun.position.set(-30, 50, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 40, bottom: -40, near: 1, far: 150 });
  scene.add(hemi, sun);

  // 海面与陆地（形状坐标 y = -z）
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshLambertMaterial({ color: 0x3b9ed6 }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -0.4;
  scene.add(sea);
  const coast = [[-60, 40], [60, 40], [60, -6], [32, -8], [22, -7.5], [14, -10], [8, -11.5], [0, -10], [-9, -9.5],
    [-11.5, -7.5], [-13, -9.5], [-14, -14.5], [-22, -14.5], [-23, -8], [-28, -2], [-31, 6], [-37, 16], [-60, 24]];
  const shape = new THREE.Shape(coast.map(p => new THREE.Vector2(p[0], p[1])));
  const landGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: false });
  landGeo.rotateX(-Math.PI / 2);
  const land = new THREE.Mesh(landGeo, new THREE.MeshLambertMaterial({ color: 0xb9d99a }));
  land.position.y = -0.6; land.receiveShadow = true;
  scene.add(land);

  // 山
  const hillMat = new THREE.MeshLambertMaterial({ color: 0x5fa862, flatShading: true });
  for (const [x, z, r, h] of [[21, -0.5, 3.2, 3.6], [23.5, -2.5, 2.4, 2.6], [-10, -3, 2.6, 2.2], [-15, -13, 3.4, 3],
    [6, -17, 3, 2.4], [32, -10, 4, 3.4], [-30, -16, 3.5, 2.6], [40, -2, 3.5, 3], [-8.5, -14.5, 2, 1.6]]) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), hillMat);
    m.position.set(x, h / 2, z); m.rotation.y = x; m.castShadow = true;
    scene.add(m);
  }

  // 道路
  const byId = Object.fromEntries(districts.map(d => [d.id, d]));
  const roadMat = new THREE.MeshLambertMaterial({ color: 0xf5f0e1 });
  for (const [a, b] of ROADS) {
    const A = byId[a].pos, B = byId[b].pos;
    const dx = B[0] - A[0], dz = B[1] - A[1], len = Math.hypot(dx, dz);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.45), roadMat);
    m.position.set((A[0] + B[0]) / 2, 0.02, (A[1] + B[1]) / 2);
    m.rotation.y = -Math.atan2(dz, dx);
    m.receiveShadow = true;
    scene.add(m);
  }

  // 各区
  const nodes = {}, pickables = [], labels = [];
  districts.forEach((d, idx) => {
    const g = new THREE.Group();
    g.position.set(d.pos[0], 0, d.pos[1]);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 0.14, 40),
      new THREE.MeshLambertMaterial({ color: d.color }));
    base.position.y = 0.07; base.receiveShadow = true;
    g.add(base);

    let seed = idx * 9973 + 17;
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const st = d.style, placed = [];
    let top = 0;
    for (let tries = 0; placed.length < st.n && tries < 300; tries++) {
      const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * 2.5;
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      const w = st.w[0] + r() * (st.w[1] - st.w[0]);
      const h = st.h[0] + r() * r() * (st.h[1] - st.h[0]) * 1.6;
      const color = st.palette[Math.floor(r() * st.palette.length)];
      if (Math.hypot(x, z - 2.3) < 1 + w / 2) continue; // 给玩家棋子留位置
      if (placed.some(p => Math.hypot(p.x - x, p.z - z) < (p.w + w) * 0.62)) continue;
      const hh = Math.min(h, st.h[1]);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, w * (0.8 + r() * 0.4)),
        new THREE.MeshLambertMaterial({ color }));
      m.position.set(x, hh / 2 + 0.14, z);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
      placed.push({ x, z, w });
      top = Math.max(top, hh);
    }

    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.7, 0.12, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.2; ring.visible = false;
    g.add(ring);

    const label = labelSprite(d.name);
    label.position.y = top + 1.6;
    g.add(label);
    label.userData.id = d.id; labels.push(label); // 点名字牌也算点中这个区

    const pick = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, top + 1, 16),
      new THREE.MeshBasicMaterial({ visible: false }));
    pick.position.y = (top + 1) / 2; pick.userData.id = d.id;
    g.add(pick); pickables.push(pick);

    scene.add(g);
    nodes[d.id] = { group: g, ring, top, beacon: null };
  });

  // 玩家棋子
  const player = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 1, 12), new THREE.MeshLambertMaterial({ color: 0xff5a1f }));
  body.position.y = 0.64;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshLambertMaterial({ color: 0xffd9b3 }));
  head.position.y = 1.4;
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.3), new THREE.MeshLambertMaterial({ color: 0x1f2937 }));
  pack.position.set(0, 0.75, -0.38);
  [body, head, pack].forEach(m => { m.castShadow = true; player.add(m); });
  scene.add(player);
  const standPos = id => new THREE.Vector3(byId[id].pos[0], 0, byId[id].pos[1] + 2.3);

  // 相机：固定俯角，拖动平移，滚轮缩放
  const target = new THREE.Vector3(0, 0, 0);
  let dist = 52, follow = null;
  function placeCamera() {
    target.x = THREE.MathUtils.clamp(target.x, -32, 34);
    target.z = THREE.MathUtils.clamp(target.z, -16, 14);
    camera.position.set(target.x, target.y + dist * 0.78, target.z + dist * 0.63);
    camera.lookAt(target);
  }
  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    street.resize(w, h);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize(); placeCamera();

  const pointers = new Map();
  let dragged = false, pinch = 0, hoverId = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pickAt(e) {
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(labels)[0] || ray.intersectObjects(pickables)[0];
    return hit ? hit.object.userData.id : null;
  }
  el.addEventListener('pointerdown', e => {
    if (mode !== 'map') return;
    el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    dragged = pointers.size > 1;
    pinch = 0;
  });
  el.addEventListener('pointermove', e => {
    if (mode !== 'map') return;
    const p = pointers.get(e.pointerId);
    if (!p) {
      const id = pickAt(e);
      if (id !== hoverId) { hoverId = id; el.style.cursor = id ? 'pointer' : 'grab'; }
      return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) dist = THREE.MathUtils.clamp(dist * pinch / d, 18, 80);
      pinch = d; dragged = true;
    } else {
      if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 6) dragged = true;
      if (dragged) {
        const k = dist / el.clientHeight * 1.1;
        target.x -= dx * k; target.z -= dy * k * 1.3;
        follow = null;
      }
    }
    placeCamera();
  });
  const up = e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    pinch = 0;
    if (!dragged && e.type === 'pointerup') {
      const id = pickAt(e);
      if (id) handlers.onPick(id);
    }
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', e => {
    e.preventDefault();
    if (mode !== 'map') return;
    dist = THREE.MathUtils.clamp(dist * Math.exp(e.deltaY * 0.0012), 18, 80);
    placeCamera();
  }, { passive: false });

  // 动画
  let current = null, move = null, rumorNode = null;
  const clock = new THREE.Clock();
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    let night = 0;
    if (move) {
      move.t = Math.min(1, move.t + dt / move.dur);
      const k = move.t * move.t * (3 - 2 * move.t);
      player.position.lerpVectors(move.from, move.to, k);
      player.position.y = Math.sin(Math.PI * k) * 5;
      player.rotation.y = Math.atan2(move.to.x - move.from.x, move.to.z - move.from.z);
      night = Math.sin(Math.PI * move.t);
      if (move.t >= 1) { const done = move.done; move = null; player.rotation.y = 0; done && done(); }
    } else {
      player.position.y = Math.abs(Math.sin(t * 2.4)) * 0.12;
    }
    scene.background.lerpColors(DAY, NIGHT, night);
    scene.fog.color.copy(scene.background);
    hemi.intensity = 1.5 - night * 1.1;
    sun.intensity = 2.2 - night * 1.9;
    if (follow) {
      target.lerp(follow, 1 - Math.exp(-dt * 4));
      placeCamera();
    }
    if (current) {
      const s = 1 + Math.sin(t * 3) * 0.04;
      nodes[current].ring.scale.set(s, s, 1);
    }
    if (rumorNode && rumorNode.beacon) rumorNode.beacon.position.y = rumorNode.top + 3.9 + Math.sin(t * 3) * 0.25;
    if (mode === 'street') { street.update(dt, t); renderer.render(street.scene, street.camera); }
    else renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function focus(id) { follow = new THREE.Vector3(byId[id].pos[0], 0, byId[id].pos[1]); }

  return {
    setPlayerAt(id) {
      move = null;
      player.position.copy(standPos(id));
      this.setCurrent(id);
      target.set(byId[id].pos[0], 0, byId[id].pos[1]);
      follow = null;
      placeCamera();
    },
    setCurrent(id) {
      if (current) nodes[current].ring.visible = false;
      current = id;
      nodes[id].ring.visible = true;
    },
    movePlayer(toId, done) {
      move = { from: player.position.clone().setY(0), to: standPos(toId), t: 0, dur: 1.5, done };
      this.setCurrent(toId);
      focus(toId);
    },
    focus,
    setMode(m) {
      mode = m;
      street.setActive(m === 'street');
      el.style.cursor = m === 'street' ? 'pointer' : 'grab';
    },
    enterStreet(district, idx, spots) { street.enter(district, idx, spots); this.setMode('street'); },
    // rumor: { district, text, up } 或 null
    setRumor(rumor) {
      if (rumorNode && rumorNode.beacon) {
        rumorNode.group.remove(rumorNode.beacon);
        rumorNode.beacon.material.map.dispose();
        rumorNode.beacon.material.dispose();
        rumorNode.beacon = null;
      }
      rumorNode = null;
      if (!rumor) return;
      const n = nodes[rumor.district];
      n.beacon = labelSprite(rumor.text, { bg: rumor.up ? 'rgba(220,38,38,.95)' : 'rgba(22,163,74,.95)', size: 28 });
      n.beacon.position.y = n.top + 3.9;
      n.group.add(n.beacon);
      rumorNode = n;
    },
  };
}
