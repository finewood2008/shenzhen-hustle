// POST /api/score  { id, secret, score, favor }
// 一局打完提交净资产。每个账号只记最好的一次。返回 { best, rank, total, improved }。
// 防作弊只做基础校验：分数必须是合理范围内的整数，提交有频率限制。游戏在浏览器里运行，认真作弊是防不住的。
import { open, body, limited, redis, auth } from './_db.js';

export const MAX_SCORE = 30000000, MIN_SCORE = -5000000;

export default async function handler(req, res) {
  if (!open(req, res, 'POST')) return;
  try {
    const b = body(req), score = b.score;
    if (!Number.isInteger(score) || score > MAX_SCORE || score < MIN_SCORE) return res.status(400).json({ error: 'score' });
    const a = await auth(b.id, b.secret);
    if (!a) return res.status(401).json({ error: 'auth' });
    // 一局三十天，正常玩不可能两分钟一局
    if (await limited(`rl:score:${b.id}`, 1, 120)) return res.status(429).json({ error: 'slow_down' });
    const before = await redis('ZSCORE', 'lb', b.id);
    await redis('ZADD', 'lb', 'GT', String(score), b.id); // GT：只在比原来高时才更新
    const favor = Number.isInteger(b.favor) ? Math.max(-99, Math.min(99, b.favor)) : 0;
    await redis('HINCRBY', 'acct:' + b.id, 'plays', '1');
    const improved = before == null || score > Number(before);
    if (improved) await redis('HSET', 'acct:' + b.id, 'favor', String(favor), 'at', String(Date.now()));
    const [best, rank, total] = [await redis('ZSCORE', 'lb', b.id), await redis('ZREVRANK', 'lb', b.id), await redis('ZCARD', 'lb')];
    res.status(200).json({ best: Number(best), rank: rank == null ? null : rank + 1, total, improved });
  } catch (e) {
    res.status(500).json({ error: 'server' });
  }
}
