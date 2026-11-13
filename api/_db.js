// 服务端公用：连 Upstash Redis（通过 Vercel 的 Storage 集成开通，密钥由 Vercel 注入环境变量）、
// 跨域、限流、账号校验。文件名以下划线开头，Vercel 不会把它当成接口。
import { createHash, randomBytes } from 'node:crypto';

const env = () => ({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});
async function call(path, payload) {
  const { url, token } = env();
  const r = await fetch(url + path, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const d = await r.json();
  if (!r.ok || d.error) throw new Error(d.error || `redis ${r.status}`);
  return d;
}
export const redis = async (...cmd) => (await call('', cmd)).result;
export const pipeline = async cmds => (await call('/pipeline', cmds)).map(x => x.result);

// 每个接口开头调用：处理跨域和预检；数据库没开通时直接回 503。返回 false 表示已经回复过了
export function open(req, res, method) {
  res.setHeader('Access-Control-Allow-Origin', '*'); // GitHub Pages 上的那份也要能用排行榜
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return false; }
  if (req.method !== method) { res.status(405).json({ error: 'method' }); return false; }
  const { url, token } = env();
  if (!url || !token) { res.status(503).json({ error: 'not_configured' }); return false; }
  return true;
}
export function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}
export const ip = req => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
// 限流：seconds 秒内超过 max 次就返回 true
export async function limited(key, max, seconds) {
  const n = await redis('INCR', key);
  if (n === 1) await redis('EXPIRE', key, seconds);
  return n > max;
}
export const hash = s => createHash('sha256').update(String(s)).digest('hex');
export const newId = () => Array.from(randomBytes(8), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
export const newSecret = () => randomBytes(24).toString('hex');
export const validId = id => typeof id === 'string' && /^[A-Z2-9]{8}$/.test(id);
// 校验账号：密钥只在玩家浏览器里，服务器只存它的哈希
export async function auth(id, secret) {
  if (!validId(id) || typeof secret !== 'string' || secret.length < 20 || secret.length > 80) return null;
  const flat = await redis('HGETALL', 'acct:' + id);
  const a = {};
  for (let i = 0; i + 1 < (flat || []).length; i += 2) a[flat[i]] = flat[i + 1];
  return a.secret && a.secret === hash(secret) ? a : null;
}
