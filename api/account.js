// POST /api/account
//   不带参数：新开一个账号，返回 { id, secret, name }。secret 只发这一次，由浏览器自己保存。
//   带 { id, secret, name }：改昵称，返回 { name }；昵称不合适时保持原名并带上 rejected: true。
import { open, body, ip, limited, redis, hash, newId, newSecret, auth } from './_db.js';
import { randomName, cleanName } from './_names.js';

export default async function handler(req, res) {
  if (!open(req, res, 'POST')) return;
  try {
    const b = body(req);
    if (b.id) {
      const a = await auth(b.id, b.secret);
      if (!a) return res.status(401).json({ error: 'auth' });
      if (await limited(`rl:name:${b.id}`, 10, 3600)) return res.status(429).json({ error: 'slow_down' });
      const name = cleanName(b.name);
      if (!name) return res.status(200).json({ name: a.name, rejected: true });
      await redis('HSET', 'acct:' + b.id, 'name', name);
      return res.status(200).json({ name });
    }
    if (await limited(`rl:acct:${ip(req)}`, 20, 3600)) return res.status(429).json({ error: 'slow_down' });
    const id = newId(), secret = newSecret(), name = randomName();
    await redis('HSET', 'acct:' + id, 'secret', hash(secret), 'name', name, 'created', String(Date.now()));
    res.status(200).json({ id, secret, name });
  } catch (e) {
    res.status(500).json({ error: 'server' });
  }
}
