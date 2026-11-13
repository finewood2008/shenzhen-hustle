// 联网部分：自动分配的账号和天梯排行榜。服务端在 api/ 目录里，跑在 Vercel 上。
// 任何一步失败（没网、数据库没开通、本地开发没有后端）都只是拿不到结果，不影响游戏本身。

// 正式站上用同源地址；GitHub Pages 那份没有后端，转去调正式站的接口
const HOME = 'https://shenzhenfushengji.vercel.app';
const BASE = location.hostname.endsWith('github.io') ? HOME : '';
const KEY = 'sz-account';

async function api(path, body) {
  try {
    const r = await fetch(BASE + path, body
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : undefined);
    const d = await r.json();
    return r.ok ? d : { error: d.error || String(r.status) };
  } catch { return { error: 'offline' }; }
}

let account = null;
try { account = JSON.parse(localStorage.getItem(KEY)); } catch { /* 没有就等会儿开一个 */ }
const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(account)); } catch { /* 存不了就只在这次有效 */ } };

export const getAccount = () => account;
// 没有账号就向服务器要一个。返回账号，或 null（服务器不可用）
let opening = null;
export function ensureAccount() {
  if (account && account.id) return Promise.resolve(account);
  return opening || (opening = api('/api/account', {}).then(d => {
    opening = null;
    if (!d.id) return null;
    account = { id: d.id, secret: d.secret, name: d.name };
    keep();
    return account;
  }));
}
// 改昵称。返回服务器最终认可的名字（不合适的名字会被退回原名，rejected 为 true）
export async function rename(name) {
  const a = await ensureAccount();
  if (!a) return null;
  const d = await api('/api/account', { id: a.id, secret: a.secret, name });
  if (!d.name) return null;
  account.name = d.name; keep();
  return d;
}
export async function submitScore(score, favor) {
  const a = await ensureAccount();
  if (!a) return { error: 'no_account' };
  return api('/api/score', { id: a.id, secret: a.secret, score: Math.round(score), favor });
}
export function fetchBoard() {
  return api('/api/leaderboard' + (account && account.id ? '?id=' + account.id : ''));
}
