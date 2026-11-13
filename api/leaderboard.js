// GET /api/leaderboard?id=账号编号
// 返回前 50 名 { top: [{ rank, id, name, score }], total }，带 id 时再加上 me: { rank, score }。
import { open, redis, pipeline, validId } from './_db.js';

export default async function handler(req, res) {
  if (!open(req, res, 'GET')) return;
  try {
    const flat = (await redis('ZRANGE', 'lb', '0', '49', 'REV', 'WITHSCORES')) || [];
    const rows = [];
    for (let i = 0; i + 1 < flat.length; i += 2) rows.push({ rank: i / 2 + 1, id: flat[i], score: Number(flat[i + 1]) });
    const names = rows.length ? await pipeline(rows.map(r => ['HGET', 'acct:' + r.id, 'name'])) : [];
    rows.forEach((r, i) => { r.name = names[i] || '无名氏'; });
    const out = { top: rows, total: await redis('ZCARD', 'lb') };
    const id = req.query && req.query.id;
    if (validId(id)) {
      const [score, rank] = [await redis('ZSCORE', 'lb', id), await redis('ZREVRANK', 'lb', id)];
      if (score != null) out.me = { rank: rank + 1, score: Number(score) };
    }
    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: 'server' });
  }
}
