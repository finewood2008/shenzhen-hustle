// 用 Tripo API 生成地标楼模型。
// 用法：node tools/tripo.mjs huaqiangbei [futian ...]      （不带参数就列出可以生成的楼）
// 生成好的 GLB 存到 assets/buildings/<id>.glb，预览图存 <id>.png，并登记进 index.json。之后可用 tools/shrink-glb.mjs 压贴图。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, run, download, register } from './tripo-api.mjs';

const DIR = path.join(ROOT, 'assets/buildings');
const conf = JSON.parse(fs.readFileSync(path.join(DIR, 'prompts.json'), 'utf8'));
const ids = process.argv.slice(2);
if (!ids.length) { console.log('可以生成：', Object.keys(conf.buildings).join(' ')); process.exit(0); }

async function generate(id) {
  const b = conf.buildings[id];
  if (!b) throw new Error(`没有 ${id} 的提示词`);
  const t = await run(id, '/generation/text-to-model', {
    prompt: `${b.prompt}, ${conf.style}`.slice(0, 1024), negative_prompt: conf.negative.slice(0, 255),
    model: 'v3.1-20260211', face_limit: 20000, texture: true, pbr: false, texture_quality: 'standard',
  });
  // 模型链接 5 分钟后失效，马上下载
  const size = await download(t.output.model_url, path.join(DIR, `${id}.glb`));
  if (t.output.rendered_image_url) await download(t.output.rendered_image_url, path.join(DIR, `${id}.png`)).catch(() => {});
  register(path.join(DIR, 'index.json'), id, { rotY: -90, file: `${id}.glb` }); // Tripo 默认正面朝 +x，转 -90° 朝向街道
  console.log(`[${id}] 完成：${id}.glb ${(size / 1048576).toFixed(1)} MB`);
}

for (const id of ids) {
  try { await generate(id); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
