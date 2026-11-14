// 3D 沙盘：只负责画面和拾取，不知道任何玩法规则。
import * as THREE from '../vendor/three.module.min.js';
import { ROADS } from './content.js';
import { labelSprite } from './models.js';
import { createStreet } from './street.js';
import { makePanpan, onPanpan } from './panpan.js';
import { buildLandmark } from './landmarks.js';

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

  // 地铁：每个区外圈一条环线，车站在圆盘正前方；相邻的区之间一段直轨，从各自环线上朝向对方的点连过去。
  // 换区时按距离找最短路线，途经的区沿环线绕过去，所以列车不会从楼群里穿过。
  const byId = Object.fromEntries(districts.map(d => [d.id, d]));
  const LOOP_R = 3.75, FRONT = Math.PI / 2, RAIL_Y = 0.2;
  const rim = (id, a) => new THREE.Vector3(byId[id].pos[0] + LOOP_R * Math.cos(a), RAIL_Y, byId[id].pos[1] + LOOP_R * Math.sin(a));
  const toward = (a, b) => Math.atan2(byId[b].pos[1] - byId[a].pos[1], byId[b].pos[0] - byId[a].pos[0]);
  const ballastMat = new THREE.MeshLambertMaterial({ color: 0x59606b });
  const railMat = new THREE.MeshLambertMaterial({ color: 0xe5e7eb });
  const sleeperMat = new THREE.MeshLambertMaterial({ color: 0x8b6b4a });
  const sleeperGeo = new THREE.BoxGeometry(0.62, 0.04, 0.12), sleepers = [];
  for (const [a, b] of ROADS) { // 区间直轨
    const P = rim(a, toward(a, b)), Q = rim(b, toward(b, a));
    const dx = Q.x - P.x, dz = Q.z - P.z, len = Math.hypot(dx, dz), ang = -Math.atan2(dz, dx);
    const g = new THREE.Group();
    g.position.set((P.x + Q.x) / 2, 0, (P.z + Q.z) / 2); g.rotation.y = ang;
    const bed = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.62), ballastMat);
    bed.position.y = 0.15; bed.receiveShadow = true; g.add(bed);
    for (const side of [-0.17, 0.17]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.05), railMat);
      rail.position.set(0, 0.215, side); g.add(rail);
    }
    for (let s = -len / 2 + 0.25; s < len / 2; s += 0.42) sleepers.push({ g, x: s });
    scene.add(g);
  }
  districts.forEach(d => { // 每个区的环线
    const g = new THREE.Group();
    g.position.set(d.pos[0], 0, d.pos[1]);
    const bed = new THREE.Mesh(new THREE.RingGeometry(LOOP_R - 0.31, LOOP_R + 0.31, 72), ballastMat);
    bed.rotation.x = -Math.PI / 2; bed.position.y = 0.18; bed.receiveShadow = true; g.add(bed);
    for (const r of [LOOP_R - 0.17, LOOP_R + 0.17]) {
      const rail = new THREE.Mesh(new THREE.TorusGeometry(r, 0.028, 4, 120), railMat);
      rail.rotation.x = Math.PI / 2; rail.position.y = 0.215; g.add(rail);
    }
    // 车站：正前方一小段站台和一块蓝色 M 牌
    const plat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.4), new THREE.MeshLambertMaterial({ color: 0xd6d3d1 }));
    plat.position.set(0, 0.2, LOOP_R + 0.55); plat.receiveShadow = true; g.add(plat);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), railMat);
    post.position.set(1.05, 0.6, LOOP_R + 0.6); g.add(post);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.06), new THREE.MeshLambertMaterial({ color: 0x1d4ed8 }));
    sign.position.set(1.05, 1.1, LOOP_R + 0.6); g.add(sign);
    scene.add(g);
  });
  { // 区间直轨上的枕木一次画完
    const inst = new THREE.InstancedMesh(sleeperGeo, sleeperMat, sleepers.length), m = new THREE.Matrix4();
    sleepers.forEach(({ g, x }, i) => {
      g.updateMatrixWorld(true);
      m.makeTranslation(x, 0.185, 0).premultiply(g.matrixWorld);
      inst.setMatrixAt(i, m.clone().multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)));
    });
    scene.add(inst);
  }
  // 线路图：按距离找最短路线
  const adj = Object.fromEntries(districts.map(d => [d.id, []]));
  for (const [a, b] of ROADS) {
    const w = Math.hypot(byId[a].pos[0] - byId[b].pos[0], byId[a].pos[1] - byId[b].pos[1]);
    adj[a].push([b, w]); adj[b].push([a, w]);
  }
  function shortest(from, to) {
    const dist = { [from]: 0 }, prev = {}, todo = new Set(Object.keys(adj));
    while (todo.size) {
      let u = null;
      for (const k of todo) if (dist[k] != null && (u == null || dist[k] < dist[u])) u = k;
      if (u == null || u === to) break;
      todo.delete(u);
      for (const [v, w] of adj[u]) if (dist[v] == null || dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; }
    }
    const path = [to];
    while (path[0] !== from) path.unshift(prev[path[0]]);
    return path;
  }
  // 把一串区变成列车要走的折线：从起点车站出发，沿环线绕到出口，直轨到下一区，……最后绕回终点车站
  function routePoints(path) {
    const pts = [];
    const arc = (id, a0, a1) => {
      const d = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)), n = Math.max(1, Math.ceil(Math.abs(d) / 0.12));
      for (let i = 0; i <= n; i++) pts.push(rim(id, a0 + (d * i) / n));
    };
    let a = FRONT;
    path.forEach((id, i) => {
      const out = i < path.length - 1 ? toward(id, path[i + 1]) : FRONT;
      arc(id, a, out);
      if (i < path.length - 1) a = toward(path[i + 1], id);
    });
    const clean = pts.filter((p, i) => i === 0 || p.distanceTo(pts[i - 1]) > 1e-3);
    const dir = clean[1].clone().sub(clean[0]).normalize(); // 起点往后再延一点，让后车厢有地方停
    clean.unshift(clean[0].clone().addScaledVector(dir, -2));
    const cum = [0];
    for (let i = 1; i < clean.length; i++) cum.push(cum[i - 1] + clean[i].distanceTo(clean[i - 1]));
    return { pts: clean, cum, len: cum[cum.length - 1], start: 2 };
  }
  function pointAt(r, d, out, dirOut) {
    d = THREE.MathUtils.clamp(d, 0, r.len);
    let i = 1;
    while (i < r.cum.length - 1 && r.cum[i] < d) i++;
    const a = r.pts[i - 1], b = r.pts[i], k = (d - r.cum[i - 1]) / Math.max(1e-6, r.cum[i] - r.cum[i - 1]);
    out.lerpVectors(a, b, k);
    if (dirOut) dirOut.subVectors(b, a).normalize();
    return out;
  }

  // 列车：两节敞篷车厢，潘潘坐在第一节里，大头露在外面
  function makeCar(head) {
    const g = new THREE.Group();
    const lam = c => new THREE.MeshLambertMaterial({ color: c });
    const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
    box(0.66, 0.36, 1.5, lam(0xf8fafc), 0, 0.22, 0);          // 车身
    box(0.68, 0.08, 1.52, lam(0x16a34a), 0, 0.3, 0);          // 腰线（绿色，深圳地铁的颜色）
    box(0.7, 0.06, 1.56, lam(0x334155), 0, 0.03, 0);          // 底盘
    const glass = new THREE.MeshLambertMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.35, depthWrite: false });
    for (const x of [-0.31, 0.31]) box(0.03, 0.2, 1.36, glass, x, 0.5, 0);
    box(0.62, 0.2, 0.03, glass, 0, 0.5, -0.69);
    for (const x of [-0.25, 0.25]) for (const z of [-0.5, 0.5]) box(0.12, 0.08, 0.2, lam(0x111827), x, -0.02, z); // 轮子
    if (head) {
      box(0.62, 0.3, 0.26, lam(0xf8fafc), 0, 0.2, 0.86);       // 车头
      box(0.56, 0.16, 0.03, lam(0x1e293b), 0, 0.3, 0.995);     // 挡风玻璃
      for (const x of [-0.2, 0.2]) box(0.1, 0.06, 0.03, new THREE.MeshBasicMaterial({ color: 0xfff3b0 }), x, 0.13, 0.995);
      box(0.62, 0.2, 0.03, glass, 0, 0.5, 0.69);
    }
    g.scale.setScalar(1.5);
    g.visible = false;
    scene.add(g);
    return g;
  }
  const cars = [makeCar(true), makeCar(false)], CAR_GAP = 2.45;
  const tmpP = new THREE.Vector3(), tmpD = new THREE.Vector3();
  function placeTrain(r, d) {
    cars.forEach((car, i) => {
      pointAt(r, d - i * CAR_GAP, tmpP, tmpD);
      car.position.copy(tmpP);
      car.rotation.y = Math.atan2(tmpD.x, tmpD.z);
      car.visible = true;
    });
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
    // 本区地标的缩小版，放在圆盘中间偏后
    const lm = buildLandmark(d.id, true);
    const lmR = lm ? lm.userData.mapScale * 7 : 0;
    if (lm) {
      lm.scale.setScalar(lm.userData.mapScale);
      lm.position.set(0, 0.14, -1);
      g.add(lm);
    }
    let top = 0;
    for (let tries = 0; placed.length < st.n && tries < 300; tries++) {
      const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * 2.5;
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      const w = st.w[0] + r() * (st.w[1] - st.w[0]);
      const h = st.h[0] + r() * r() * (st.h[1] - st.h[0]) * 1.6;
      const color = st.palette[Math.floor(r() * st.palette.length)];
      if (Math.hypot(x, z - 2.3) < 1 + w / 2) continue; // 给玩家棋子留位置
      if (lm && Math.hypot(x, z + 1) < lmR + w / 2) continue; // 给地标留位置
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

    if (lm) top = Math.max(top, new THREE.Box3().setFromObject(lm).max.y);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.45, 0.12, 8, 64),
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
  let mapPan = null; // 潘潘的模型下载完后，把棋子换成潘潘
  onPanpan(() => {
    mapPan = makePanpan(4.6);
    [body, head, pack].forEach(m => player.remove(m));
    player.add(mapPan.root);
  });
  const standPos = id => new THREE.Vector3(byId[id].pos[0], 0, byId[id].pos[1] + 2.3);

  // 相机：固定俯角，拖动平移，滚轮缩放
  const target = new THREE.Vector3(0, 0, 0);
  let dist = 52, follow = null;
  let rideZoom = 0; // 坐车时镜头拉近的程度，0～1
  function placeCamera() {
    target.x = THREE.MathUtils.clamp(target.x, -32, 34);
    target.z = THREE.MathUtils.clamp(target.z, -16, 14);
    const d = dist * (1 - rideZoom * 0.42); // 坐车时拉近跟拍
    camera.position.set(target.x, target.y + d * 0.78, target.z + d * 0.63);
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
  let current = null, trip = null, rumorNode = null;
  const RIDE_H = 1.15; // 坐车时潘潘的身高（车厢放大了 1.5 倍，实际看上去约 1.7；地图上平时是 4.6）
  const clock = new THREE.Clock();
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    let night = 0;
    if (trip) {
      trip.t += dt;
      const walk = (from, to, k) => { // 潘潘在站位和车站之间小跑
        player.position.lerpVectors(from, to, k);
        player.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
        if (mapPan) mapPan.play('run');
      };
      if (trip.phase === 'board') {
        const k = Math.min(1, trip.t / 0.7);
        placeTrain(trip.route, trip.route.start);
        walk(trip.from, trip.station, k);
        if (k >= 1) { // 上车：坐进第一节车厢
          cars[0].add(player);
          player.position.set(0, 0.06, 0.1); player.rotation.y = 0;
          player.scale.setScalar(RIDE_H / (mapPan ? 4.6 : 1.7));
          if (mapPan) mapPan.play('idle');
          trip.phase = 'ride'; trip.t = 0;
        }
      } else if (trip.phase === 'ride') {
        const k = Math.min(1, trip.t / trip.dur), e = k * k * (3 - 2 * k);
        placeTrain(trip.route, trip.route.start + (trip.route.len - trip.route.start) * e);
        follow = cars[0].position.clone().setY(0);
        night = Math.sin(Math.PI * k) * 0.7;
        rideZoom = Math.min(1, k * 4, (1 - k) * 4);
        if (k >= 1) { // 到站下车
          scene.attach(player);
          player.scale.setScalar(1);
          player.position.copy(trip.end).setY(0);
          trip.phase = 'alight'; trip.t = 0; rideZoom = 0;
        }
      } else {
        const k = Math.min(1, trip.t / 0.7);
        walk(trip.end.clone().setY(0), trip.to, k);
        if (k >= 1) {
          const done = trip.done;
          trip = null; player.rotation.y = 0;
          cars.forEach(c => { c.visible = false; });
          if (mapPan) mapPan.play('idle');
          done && done();
        }
      }
    } else if (mapPan) {
      player.position.y = 0;
      mapPan.play('idle');
    } else {
      player.position.y = Math.abs(Math.sin(t * 2.4)) * 0.12;
    }
    if (mapPan) mapPan.update(dt);
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
      if (trip) { scene.attach(player); player.scale.setScalar(1); cars.forEach(c => { c.visible = false; }); trip = null; }
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
      // 坐地铁过去：先跑进车站上车，列车沿最短线路开到目的地，再下车走回站位
      const route = routePoints(shortest(current, toId));
      const station = route.pts[1].clone().setY(0); // pts[0] 是给后车厢往后延出来的点
      trip = { phase: 'board', t: 0, route, from: player.position.clone().setY(0), station,
        end: route.pts[route.pts.length - 1].clone(), to: standPos(toId),
        dur: THREE.MathUtils.clamp((route.len - route.start) / 11, 1.8, 4.8), done };
      this.setCurrent(toId);
      follow = station.clone(); // 镜头先看着车站，发车后跟着列车走
    },
    focus,
    setMode(m) {
      mode = m;
      street.setActive(m === 'street');
      el.style.cursor = 'grab';
    },
    get streetView() { return street.view; },
    setStick(x, y) { street.setStick(x, y); },
    refreshPlayer() { street.refreshPlayer(); },
    emote(name, maxSec) { street.emote(name, maxSec); },
    releaseWalker(i, icon) { street.releaseWalker(i, icon); },
    setStreetView(v) { street.setView(v); },
    enterStreet(district, idx, spots, startX, startYaw) { street.enter(district, idx, spots, startX, startYaw); this.setMode('street'); },
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
