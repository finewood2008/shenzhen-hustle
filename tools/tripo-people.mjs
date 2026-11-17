// 用 Tripo API 生成会走路的路人：生成低面数角色 → 绑骨前检查 → 自动绑骨（Mixamo 骨骼命名）→ 套上站立和走路动作。
// 用法：node tools/tripo-people.mjs rider [office ...]      （不带参数就列出可以生成的角色）
// 结果存到 assets/people/<id>.glb（带 idle / walk 两个动作），立绘 <id>.webp（对话头像用），并登记进 index.json。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, run, download, register } from './tripo-api.mjs';

const DIR = path.join(ROOT, 'assets/people');
const conf = JSON.parse(fs.readFileSync(path.join(DIR, 'prompts.json'), 'utf8'));
const ids = process.argv.slice(2);
if (!ids.length) { console.log('可以生成：', Object.keys(conf.people).join(' ')); process.exit(0); }

async function generate(id) {
  const p = conf.people[id];
  if (!p) throw new Error(`没有 ${id} 的提示词`);
  const gen = await run(id, '/generation/text-to-model', {
    prompt: `${p.prompt}, ${conf.style}`.slice(0, 1024), negative_prompt: conf.negative.slice(0, 255),
    model: 'P2-20260801', face_limit: 6000, texture: true, pbr: false,
  });
  if (gen.output.rendered_image_url) await download(gen.output.rendered_image_url, path.join(DIR, `${id}.webp`)).catch(() => {});
  const check = await run(id, '/animations/rig-check', { input: gen.task_id });
  if (!check.output?.riggable || check.output.rig_type !== 'biped') throw new Error(`[${id}] 不能绑成人形骨骼：${JSON.stringify(check.output)}`);
  const rig = await run(id, '/animations/rig', { input: gen.task_id, model: 'v3.0-20260909', rig_type: 'biped', spec: 'mixamo', out_format: 'glb' });
  const anim = await run(id, '/animations/retarget', { input: rig.task_id, animations: ['preset:idle', 'preset:walk'], out_format: 'glb' });
  const url = anim.output.model_url || Object.values(anim.output).find(v => typeof v === 'string' && v.includes('.glb'));
  if (!url) throw new Error(`[${id}] 动作任务没有返回模型：${JSON.stringify(anim.output).slice(0, 300)}`);
  const size = await download(url, path.join(DIR, `${id}.glb`));
  register(path.join(DIR, 'index.json'), id, { name: p.name, file: `${id}.glb` });
  console.log(`[${id}] 完成：${id}.glb ${(size / 1048576).toFixed(1)} MB  输出字段 ${Object.keys(anim.output).join(',')}`);
}

for (const id of ids) {
  try { await generate(id); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
