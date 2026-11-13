// 用内存里的假 Redis 把四个接口走一遍：开账号、改名、交分、看排行。
import assert from 'node:assert';

const db = { h: new Map(), z: new Map(), n: new Map() };
function exec([cmd, ...a]) {
  switch (cmd) {
    case 'HSET': { const m = db.h.get(a[0]) || new Map(); for (let i = 1; i < a.length; i += 2) m.set(a[i], a[i + 1]); db.h.set(a[0], m); return 1; }
    case 'HGET': return (db.h.get(a[0]) || new Map()).get(a[1]) ?? null;
    case 'HGETALL': return [...(db.h.get(a[0]) || new Map())].flat();
    case 'HINCRBY': { const m = db.h.get(a[0]) || new Map(); m.set(a[1], String(Number(m.get(a[1]) || 0) + Number(a[2]))); db.h.set(a[0], m); return Number(m.get(a[1])); }
    case 'INCR': db.n.set(a[0], (db.n.get(a[0]) || 0) + 1); return db.n.get(a[0]);
    case 'EXPIRE': return 1;
    case 'ZADD': { const [, gt, score, member] = a; assert.equal(gt, 'GT'); if (!db.z.has(member) || Number(score) > db.z.get(member)) db.z.set(member, Number(score)); return 1; }
    case 'ZSCORE': return db.z.has(a[1]) ? String(db.z.get(a[1])) : null;
    case 'ZCARD': return db.z.size;
    case 'ZREVRANK': { const s = [...db.z].sort((x, y) => y[1] - x[1]).map(x => x[0]); const i = s.indexOf(a[1]); return i < 0 ? null : i; }
    case 'ZRANGE': return [...db.z].sort((x, y) => y[1] - x[1]).slice(Number(a[1]), Number(a[2]) + 1).flatMap(([m, s]) => [m, String(s)]);
    default: throw new Error('unmocked ' + cmd);
  }
}
globalThis.fetch = async (url, opt) => {
  const payload = JSON.parse(opt.body);
  const data = String(url).endsWith('/pipeline') ? payload.map(c => ({ result: exec(c) })) : { result: exec(payload) };
  return { ok: true, json: async () => data };
};
const call = async (handler, method, body, query = {}) => {
  const res = { code: 0, data: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(d) { this.data = d; return this; }, end() { return this; } };
  await handler({ method, body, query, headers: { 'x-forwarded-for': '1.2.3.4' } }, res);
  return res;
};
const account = (await import('../api/account.js')).default;
const score = (await import('../api/score.js')).default;
const board = (await import('../api/leaderboard.js')).default;
const { cleanName, randomName } = await import('../api/_names.js');

// 数据库没开通时
assert.equal((await call(board, 'GET')).code, 503);
process.env.KV_REST_API_URL = 'https://fake'; process.env.KV_REST_API_TOKEN = 't';
assert.equal((await call(board, 'POST')).code, 405);
assert.deepEqual((await call(board, 'GET')).data, { top: [], total: 0 });

// 开两个账号
const a = (await call(account, 'POST', {})).data, b = (await call(account, 'POST', {})).data;
assert(/^[A-Z2-9]{8}$/.test(a.id) && a.secret.length === 48 && a.name && a.id !== b.id);
assert(![...db.h.get('acct:' + a.id).values()].includes(a.secret), 'secret must be stored hashed');

// 改名：正常、不良词、冒名、密钥不对
assert.equal((await call(account, 'POST', { ...a, name: '  阿明<b>  ' })).data.name, '阿明b');
assert.equal((await call(account, 'POST', { ...a, name: '傻 逼' })).data.rejected, true);
assert.equal((await call(account, 'POST', { ...a, name: '官方客服' })).data.rejected, true);
assert.equal((await call(account, 'POST', { id: a.id, secret: 'x'.repeat(48), name: '黑客' })).code, 401);
assert.equal(cleanName('一二三四五六七八九十十一'), '一二三四五六七八九十');
assert.equal(cleanName('   '), null);
assert(cleanName(randomName()));

// 交分：范围、密钥、频率、只记最好的一次
assert.equal((await call(score, 'POST', { ...a, score: 1e12 })).code, 400);
assert.equal((await call(score, 'POST', { ...a, score: 12.5 })).code, 400);
assert.equal((await call(score, 'POST', { ...a, score: '99999' })).code, 400);
assert.equal((await call(score, 'POST', { id: a.id, secret: b.secret, score: 5000 })).code, 401);
let r = await call(score, 'POST', { ...a, score: 5000, favor: 3 });
assert.deepEqual(r.data, { best: 5000, rank: 1, total: 1, improved: true });
assert.equal((await call(score, 'POST', { ...a, score: 9000 })).code, 429, 'second submit within the window is refused');
r = await call(score, 'POST', { ...b, score: 80000 });
assert.deepEqual(r.data, { best: 80000, rank: 1, total: 2, improved: true });
db.n.clear(); // 假装过了限流时间
r = await call(score, 'POST', { ...a, score: 100 });
assert.deepEqual(r.data, { best: 5000, rank: 2, total: 2, improved: false }, 'a lower score does not replace the best');

// 排行
r = await call(board, 'GET', null, { id: a.id });
assert.deepEqual(r.data.top.map(x => [x.rank, x.name, x.score]), [[1, b.name, 80000], [2, '阿明b', 5000]]);
assert.deepEqual(r.data.me, { rank: 2, score: 5000 });
assert.equal(r.headers['Access-Control-Allow-Origin'], '*');
assert(!JSON.stringify(r.data).includes(a.secret) && !JSON.stringify(r.data).includes('secret'));
console.log('api ok');
