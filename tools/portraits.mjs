// 用本机的 Codex CLI（ChatGPT 账号）生成剧情人物的 2D 头像，每人四种表情。
// 用法：node tools/portraits.mjs bing jie ...   （不带参数就列出角色）
// 先画平常表情，再拿它当参考画笑、生气、难过，保证同一个人长得一样。原图存 assets/portraits/raw/<id>_<mood>.png，
// 之后用 sips 压成 320px 的 JPEG：assets/portraits/<id>_<mood>.jpg（游戏用这个）。
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'assets/portraits'), RAW = path.join(DIR, 'raw');
const conf = JSON.parse(fs.readFileSync(path.join(DIR, 'prompts.json'), 'utf8'));
const ids = process.argv.slice(2);
if (!ids.length) { console.log('角色：', Object.keys(conf.cast).join(' ')); process.exit(0); }
fs.mkdirSync(RAW, { recursive: true });

function codex(prompt, refs) {
  // 提示词要放在 -i 前面：-i 可以接多个文件，放在后面会被当成图片路径吞掉
  const args = ['exec', prompt, '-s', 'workspace-write', '--skip-git-repo-check', '-C', ROOT];
  for (const r of refs) args.push('-i', r);
  return spawnSync('codex', args, { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8', timeout: 15 * 60 * 1000 });
}
function shrink(id, mood) {
  const src = path.join(RAW, `${id}_${mood}.png`), out = path.join(DIR, `${id}_${mood}.jpg`);
  if (!fs.existsSync(src)) return false;
  spawnSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '-Z', '320', src, '--out', out], { stdio: 'ignore' });
  return true;
}

for (const id of ids) {
  const who = conf.cast[id];
  if (!who) { console.error(`没有 ${id}`); continue; }
  const plain = path.join(RAW, `${id}_plain.png`);
  for (const [mood, face] of Object.entries(conf.moods)) {
    const file = path.join(RAW, `${id}_${mood}.png`);
    if (fs.existsSync(file)) { shrink(id, mood); console.log(`[${id}] ${mood} 已有，跳过`); continue; }
    const same = mood === 'plain' ? '' : `The second attached image is this exact character with a neutral face: keep the identical face, hair, clothing, colors, framing and background, change ONLY the facial expression. `;
    const prompt = `Use your image generation tool to create exactly ONE game character portrait and save it as a PNG at ${path.relative(ROOT, file)}. Do not create or modify any other file.\n\n${same}Style: ${conf.style}.\n\nCharacter: ${who}.\nExpression: ${face}.`;
    const refs = [path.join(ROOT, 'assets/panpan.png')];
    if (mood !== 'plain' && fs.existsSync(plain)) refs.push(plain);
    const t0 = Date.now();
    const r = codex(prompt, refs);
    const ok = fs.existsSync(file) && shrink(id, mood);
    console.log(`[${id}] ${mood} ${ok ? '完成' : '失败'} ${Math.round((Date.now() - t0) / 1000)}s${ok ? '' : ' ' + (r.stderr || '').split('\n').filter(l => /error|limit|quota/i.test(l)).slice(-2).join(' | ')}`);
  }
}
