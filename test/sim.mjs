// 用一个简单的贪心机器人跑很多局，检查逻辑不出错并观察数值分布。
import assert from 'node:assert';
import * as L from '../src/logic.js';
import { GOODS, DISTRICTS, CONFIG } from '../src/content.js';
import { SCENES, CAST, nextScene, play, epilogue } from '../src/story.js';

const seenScenes = new Set();
// 把当前该触发的剧情都走完，选项按种子轮流选
function runStory(s, seed) {
  let sc, n = 0;
  while ((sc = nextScene(s))) {
    assert(++n < 10, 'story must settle');
    seenScenes.add(sc.id);
    const p = play(s, sc);
    let steps = 0;
    while (!p.done) {
      assert(++steps < 60, 'scene must end: ' + sc.id);
      const cur = p.current();
      assert(CAST[cur.who], 'unknown speaker ' + cur.who);
      assert(typeof cur.text === 'string' && cur.text && !cur.text.includes('undefined'), sc.id);
      if (cur.choices) {
        const ok = cur.choices.map((c, i) => (c.ok ? i : -1)).filter(i => i >= 0);
        assert(ok.length, 'at least one choice must be available: ' + sc.id);
        assert(p.choose(ok[(seed + s.day + steps) % ok.length]) !== null);
      } else assert(p.next());
    }
  }
}

const scores = [];
for (let seed = 1; seed <= 500; seed++) {
  const s = L.newGame(seed);
  let guard = 0;
  runStory(s, seed);
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
    runStory(s, seed);
    for (const k of ['cash', 'debt', 'bank', 'health', 'day']) assert(Number.isFinite(s[k]), k);
    assert(s.cash >= 0 && s.debt >= 0 && s.health > 0 && L.used(s) <= s.capacity);
    assert(s.day <= CONFIG.days);
  }
  assert.equal(L.travel(s, 'dafen'), null, 'no travel on last day');
  for (const id of Object.keys(s.inv)) if (s.market[id]) L.sell(s, id, s.inv[id].qty);
  const r = L.settle(s);
  assert(s.over && Number.isFinite(r.score) && r.title);
  scores.push(r.score);
  assert(epilogue(s).length >= 1);
}
// 同一个种子必须得到同样的开局
assert.deepEqual(L.newGame(42), L.newGame(42));

scores.sort((a, b) => a - b);
const q = p => Math.round(scores[Math.floor(p * (scores.length - 1))]);
assert.equal(seenScenes.size, SCENES.length, 'every scene should be reachable: ' + [...seenScenes]);
console.log('ok', scores.length, 'games');
console.log({ min: q(0), p25: q(0.25), median: q(0.5), p75: q(0.75), max: q(1) });
