// 用一个简单的贪心机器人跑很多局，检查逻辑不出错并观察数值分布。
import assert from 'node:assert';
import * as L from '../src/logic.js';
import { GOODS, DISTRICTS, CONFIG } from '../src/content.js';

const scores = [];
for (let seed = 1; seed <= 500; seed++) {
  const s = L.newGame(seed);
  let guard = 0;
  while (!L.isLastDay(s)) {
    assert(++guard < 100, 'game must terminate');
    for (const id of Object.keys(s.inv)) {
      const it = s.inv[id];
      if (s.market[id] && s.market[id] > it.cost / it.qty) assert(L.sell(s, id, it.qty));
    }
    if (s.loc === 'luohu' && s.debt > 0) L.repay(s, Math.min(s.cash, s.debt));
    let best = null;
    for (const g of GOODS) {
      const p = s.market[g.id];
      if (!p) continue;
      const k = (p - g.min) / (g.max - g.min);
      if (k < 0.3 && L.maxBuy(s, g.id) > 0 && (!best || p > s.market[best])) best = g.id;
    }
    if (best) assert(L.buy(s, best, L.maxBuy(s, best)));
    assert(!L.buy(s, 'led', 1e9), 'cannot overbuy');
    const others = DISTRICTS.filter(d => d.id !== s.loc);
    const res = L.travel(s, others[(seed + s.day) % others.length].id);
    assert(res, 'travel should succeed');
    for (const k of ['cash', 'debt', 'bank', 'health', 'day']) assert(Number.isFinite(s[k]), k);
    assert(s.cash >= 0 && s.debt >= 0 && s.health > 0 && L.used(s) <= s.capacity);
    assert(s.day <= CONFIG.days);
  }
  assert.equal(L.travel(s, 'dafen'), null, 'no travel on last day');
  for (const id of Object.keys(s.inv)) if (s.market[id]) L.sell(s, id, s.inv[id].qty);
  const r = L.settle(s);
  assert(s.over && Number.isFinite(r.score) && r.title);
  scores.push(r.score);
}
// 同一个种子必须得到同样的开局
assert.deepEqual(L.newGame(42), L.newGame(42));

scores.sort((a, b) => a - b);
const q = p => Math.round(scores[Math.floor(p * (scores.length - 1))]);
console.log('ok', scores.length, 'games');
console.log({ min: q(0), p25: q(0.25), median: q(0.5), p75: q(0.75), max: q(1) });
