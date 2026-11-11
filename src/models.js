// 地图和街区共用的小模型。
import * as THREE from '../vendor/three.module.min.js';

export function labelSprite(text, { bg = 'rgba(15,23,42,.82)', fg = '#fff', size = 34 } = {}) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = `bold ${size}px "PingFang SC","Microsoft YaHei",sans-serif`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 36, h = size + 26;
  c.width = w * 2; c.height = h * 2;
  ctx.scale(2, 2);
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.roundRect(0, 0, w, h, h / 2); ctx.fill();
  ctx.font = font; ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(w / 30, h / 30, 1);
  sp.renderOrder = 10;
  return sp;
}

// 小人：正面朝 +z，脚底在 y = 0
export function makeFigure({ shirt = 0xff5a1f, skin = 0xffd9b3, pack = null, scale = 1 } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 1, 12), new THREE.MeshLambertMaterial({ color: shirt }));
  body.position.y = 0.64;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshLambertMaterial({ color: skin }));
  head.position.y = 1.4;
  g.add(body, head);
  if (pack != null) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.3), new THREE.MeshLambertMaterial({ color: pack }));
    p.position.set(0, 0.75, -0.38);
    g.add(p);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.scale.setScalar(scale);
  return g;
}
