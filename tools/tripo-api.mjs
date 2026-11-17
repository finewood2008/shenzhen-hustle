// Tripo API 的公共小工具：读密钥、发请求、轮询任务、下载文件。
// 密钥从环境变量 TRIPO_API_KEY 读，没有就读项目根目录的 .env.local（这个文件不会提交、不会部署）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = process.env.TRIPO_API_BASE || 'https://openapi.tripo3d.com/v3'; // 国内平台 tripo3d.com 的密钥只能用这个地址

function apiKey() {
  if (process.env.TRIPO_API_KEY) return process.env.TRIPO_API_KEY.trim();
  try {
    const m = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(/^\s*TRIPO_API_KEY\s*=\s*["']?([^"'\s]+)/m);
    if (m) return m[1];
  } catch { /* 没有这个文件 */ }
  console.error('找不到 Tripo 密钥：请在项目根目录的 .env.local 里写一行 TRIPO_API_KEY=你的密钥');
  process.exit(1);
}
const KEY = apiKey();

export async function call(method, url, body) {
  const res = await fetch(API + url, {
    method, headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.code !== 0) throw new Error(`${method} ${url} → ${res.status} ${JSON.stringify(j).slice(0, 300)}`);
  return j.data;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 提交任务并等它完成，返回任务数据
export async function run(label, url, body) {
  const { task_id } = await call('POST', url, body);
  console.log(`[${label}] 已提交 ${url} ${task_id}`);
  for (let i = 0; i < 400; i++) {
    await sleep(3000);
    const t = await call('GET', `/tasks/${task_id}`);
    if (t.status === 'success') return t;
    if (['failed', 'cancelled', 'banned', 'expired'].includes(t.status)) throw new Error(`[${label}] ${url} 任务${t.status} ${JSON.stringify(t).slice(0, 300)}`);
    if (i % 10 === 0) console.log(`[${label}] ${t.status} ${t.progress ?? 0}%`);
  }
  throw new Error(`[${label}] ${url} 超时`);
}

export async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载失败 ${res.status}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return fs.statSync(file).size;
}

export function register(indexFile, id, entry) {
  let index = {};
  try { index = JSON.parse(fs.readFileSync(indexFile, 'utf8')); } catch { /* 新建 */ }
  index[id] = { ...entry, ...(index[id] || {}), file: entry.file };
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 2) + '\n');
}
