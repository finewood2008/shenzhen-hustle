// 用一个简单的贪心机器人跑很多局，检查逻辑不出错并观察数值分布。
import assert from 'node:assert';
import * as L from '../src/logic.js';
import { GOODS, DISTRICTS, CONFIG, STALLS } from '../src/content.js';
import { SCENES, EVENT_SCENES, CAST, WALKERS, walkerKind, walkerScene, shadyScene, nextScene, play, epilogue } from '../src/story.js';

const seenScenes = new Set();
const tally = { shadyYes: 0, shadyNo: 0, caught: 0, slipped: 0, delivered: 0, expired: 0, haggleWin: 0, haggleLose: 0, borrowed: 0 };
// 把当前该触发的剧情都走完，选项按种子轮流选
const kinds = { chat: 0, tip: 0, ask: 0 };
// 和街上的每个路人都聊一遍：每天正好一个线索、最多一个求助，聊过就不能再聊
function talkToEveryone(s, seed) {
  const ks = Array.from({ length: WALKERS }, (_, i) => walkerKind(s, i));
  assert(ks.filter(k => k === 'tip').length === (L.isLastDay(s) ? 0 : 1) && ks.filter(k => k === 'ask').length <= 1, ks.join());
  for (let i = 0; i < WALKERS; i++) {
    const sc = walkerScene(s, i);
    assert(sc && sc.kind === ks[i]);
    kinds[sc.kind]++;
    playScene(s, sc, seed + i);
    assert.equal(walkerScene(s, i), null);
    assert.equal(walkerKind(s, i), 'done');
  }
}
function runStory(s, seed) {
  let sc, n = 0;
  while ((sc = nextScene(s))) {
    assert(++n < 10, 'story must settle');
    seenScenes.add(sc.id);
    playScene(s, sc, seed);
  }
}
function playScene(s, sc, seed) {
  {
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
      } else assert(p.next() !== false);
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
      if (s.market[id] && s.market[id] > it.cost / it.qty) {
        const r = L.sell(s, id, it.qty);
        assert(r);
        if (r.bad) tally[r.caught ? 'caught' : 'slipped']++;
      }
    }
    // 交货：货不够就先在这里补
    for (let i = s.orders.length - 1; i >= 0; i--) {
      const o = s.orders[i];
      if (s.loc !== o.to) continue;
      const need = o.qty - (s.inv[o.good] ? s.inv[o.good].qty : 0);
      if (need > 0 && s.market[o.good] && L.maxBuy(s, o.good) >= need) L.buy(s, o.good, need);
      if (L.canDeliver(s, o)) { const cash = s.cash, r = L.deliver(s, i); assert(r && s.cash >= cash && (r.bad || r.got > 0)); tally.delivered++; }
    }
    // 烧心货：老板问的时候，一半的局接、一半的局不接；接了就按七折进一点
    if (s.shady && s.shady.state === 'offer') {
      const g = s.shady.good, favor0 = s.favor;
      playScene(s, shadyScene(s), seed % 2);
      assert(s.shady.state !== 'offer');
      if (s.shady.state === 'open') {
        tally.shadyYes++;
        assert(L.buyPrice(s, g) < s.market[g] || s.market[g] <= 1);
        const n = Math.min(3, L.maxBuy(s, g));
        if (n > 0) { assert(L.buy(s, g, n)); assert(L.badQty(s, g) >= n); }
      } else { tally.shadyNo++; assert.equal(s.favor, favor0 + 1); }
    }
    for (const id of Object.keys(s.inv)) assert(L.badQty(s, id) <= s.inv[id].qty);
    // 砍价：每个档口试一次，第二次必须被拒绝
    if (seed % 3 === 0) talkToEveryone(s, seed);
    if (seed % 2) for (const st of STALLS) {
      const res = L.haggle(s, st.id, st.goods);
      if (res) { tally[res === 'win' ? 'haggleWin' : 'haggleLose']++; assert.equal(L.haggle(s, st.id, st.goods), null); }
    }
    if (s.loc === 'luohu' && seed % 5 === 0 && s.day < 10 && L.borrowLimit(s) >= 2000) { assert(L.borrow(s, 2000)); tally.borrowed++; }
    assert(!L.borrow(s, 1e9), 'cannot borrow past the limit');
    if (s.loc === 'luohu' && s.debt > 0 && s.day >= 10) L.repay(s, Math.min(s.cash, s.debt));
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
    tally.expired += res.expired.length;
    assert(s.orders.length <= CONFIG.orderMax && s.orders.every(o => o.deadline >= s.day));
    runStory(s, seed);
    L.checkCollapse(s);
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
assert(kinds.chat > 500 && kinds.tip > 500 && kinds.ask > 300, JSON.stringify(kinds));
assert(tally.shadyYes > 50 && tally.shadyNo > 50 && tally.caught > 10 && tally.slipped > 10, JSON.stringify(tally));
assert(tally.delivered > 20 && tally.expired > 20 && tally.haggleWin > 20 && tally.haggleLose > 20 && tally.borrowed > 5, JSON.stringify(tally));
assert.equal(seenScenes.size, SCENES.length + EVENT_SCENES.length + 1, 'every scene should be reachable: ' + [...seenScenes]);
console.log('ok', scores.length, 'games', tally, kinds);
console.log({ min: q(0), p25: q(0.25), median: q(0.5), p75: q(0.75), max: q(1) });
