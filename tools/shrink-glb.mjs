// 把 GLB 里的贴图缩小（默认最长边 1024、JPEG 质量 80），手机加载更快。只用 macOS 自带的 sips，不装别的东西。
// 用法：node tools/shrink-glb.mjs assets/buildings/huaqiangbei.glb [...]（原文件会被覆盖；已经够小的贴图跳过）
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const MAX = Number(process.env.MAX || 1024), Q = Number(process.env.Q || 80);
const pad4 = n => (n + 3) & ~3;

function shrink(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error('不是 GLB');
  const jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen + 8, bin = b.subarray(binStart, binStart + b.readUInt32LE(20 + jsonLen));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'glb-'));
  const views = json.bufferViews.map(v => bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength));
  let changed = 0;
  for (const img of json.images || []) {
    if (img.bufferView == null) continue;
    const src = path.join(tmp, 'in' + (img.mimeType === 'image/png' ? '.png' : '.jpg')), out = path.join(tmp, 'out.jpg');
    fs.writeFileSync(src, views[img.bufferView]);
    const size = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', src]).toString().match(/\d+/g).slice(-2).map(Number);
    if (Math.max(...size) <= MAX && img.mimeType === 'image/jpeg') continue;
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(Q), '-Z', String(MAX), src, '--out', out], { stdio: 'ignore' });
    views[img.bufferView] = fs.readFileSync(out);
    img.mimeType = 'image/jpeg';
    changed++;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  if (!changed) return console.log(`${file}：贴图已经够小，跳过`);
  // 重新排布二进制块
  let off = 0;
  const parts = views.map((v, i) => {
    json.bufferViews[i].byteOffset = off; json.bufferViews[i].byteLength = v.length;
    const p = Buffer.alloc(pad4(v.length)); v.copy(p); off += p.length; return p;
  });
  json.buffers[0].byteLength = off;
  let js = Buffer.from(JSON.stringify(json), 'utf8');
  js = Buffer.concat([js, Buffer.alloc(pad4(js.length) - js.length, 0x20)]);
  const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + off, 8);
  jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  bh.writeUInt32LE(off, 0); bh.writeUInt32LE(0x004e4942, 4);
  const before = b.length;
  fs.writeFileSync(file, Buffer.concat([head, jh, js, bh, ...parts]));
  console.log(`${file}：${(before / 1048576).toFixed(2)} MB → ${(fs.statSync(file).size / 1048576).toFixed(2)} MB`);
}

for (const f of process.argv.slice(2)) shrink(f);
