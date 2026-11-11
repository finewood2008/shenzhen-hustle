// 纯玩法逻辑，不依赖任何渲染或 DOM，可以在 Node 里直接跑。
import { CONFIG, DISTRICTS, GOODS, EVENTS, RANKS } from './content.js';

const GOOD = Object.fromEntries(GOODS.map(g => [g.id, g]));

function rnd(s) { // mulberry32，状态存在 s.rng 里，保证可复现
  s.rng = (s.rng + 0x6D2B79F5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const helpers = s => ({
  rand: () => rnd(s),
  int: (a, b) => a + Math.floor(rnd(s) * (b - a + 1)),
  pick: arr => arr[Math.floor(rnd(s) * arr.length)],
});

function genMarket(s, districtId, surge) {
  const m = {};
  for (const g of GOODS) {
    const forced = surge && surge.good === g.id;
    if (!forced && rnd(s) > 0.7) continue;
    let p = g.min + (g.max - g.min) * rnd(s);
    if (g.origin === districtId) p *= 0.65;
    if (g.demand === districtId) p *= 1.3;
    if (forced) p *= surge.mult;
    m[g.id] = Math.max(1, Math.round(p));
  }
  return m;
}

// 预先生成“明天”各区的行情，并放出一条小道消息
function rollForecast(s) {
  const r = helpers(s);
  const up = rnd(s) < 0.6;
  s.rumor = {
    district: r.pick(DISTRICTS.filter(d => d.id !== s.loc)).id, // 当前所在区去不了，消息没用
    good: r.pick(GOODS).id,
    up,
    mult: up ? 2.2 + rnd(s) * 1.3 : 0.25 + rnd(s) * 0.2,
  };
  s.forecast = {};
  for (const d of DISTRICTS) {
    s.forecast[d.id] = genMarket(s, d.id, d.id === s.rumor.district ? s.rumor : null);
  }
}

export function newGame(seed = (Math.random() * 2 ** 31) | 0) {
  const s = {
    rng: seed | 0, day: 1, cash: CONFIG.startCash, debt: CONFIG.startDebt, bank: 0,
    health: 100, capacity: CONFIG.capacity, storageLevel: 0, inv: {},
    loc: CONFIG.startLoc, market: null, forecast: null, rumor: null, over: false,
  };
  s.market = genMarket(s, s.loc, null);
  rollForecast(s);
  return s;
}

export const used = s => Object.values(s.inv).reduce((a, b) => a + b.qty, 0);
export const free = s => s.capacity - used(s);
export const isLastDay = s => s.day >= CONFIG.days;
export const netWorth = s => s.cash + s.bank - s.debt;

export function maxBuy(s, id) {
  const p = s.market[id];
  return p ? Math.max(0, Math.min(Math.floor(s.cash / p), free(s))) : 0;
}

export function buy(s, id, qty) {
  qty = Math.floor(qty);
  if (s.over || !(qty > 0) || qty > maxBuy(s, id)) return false;
  const cost = s.market[id] * qty;
  s.cash -= cost;
  const it = s.inv[id] || (s.inv[id] = { qty: 0, cost: 0 });
  it.qty += qty; it.cost += cost;
  return true;
}

export function sell(s, id, qty) {
  qty = Math.floor(qty);
  const it = s.inv[id];
  if (s.over || !it || !s.market[id] || !(qty > 0) || qty > it.qty) return false;
  s.cash += s.market[id] * qty;
  it.cost -= Math.round(it.cost * qty / it.qty);
  it.qty -= qty;
  if (it.qty <= 0) delete s.inv[id];
  return true;
}

const here = (s, service) => DISTRICTS.find(d => d.id === s.loc).service === service;

export function deposit(s, n) {
  n = Math.floor(n);
  if (!here(s, 'bank') || !(n > 0) || n > s.cash) return false;
  s.cash -= n; s.bank += n; return true;
}
export function withdraw(s, n) {
  n = Math.floor(n);
  if (!here(s, 'bank') || !(n > 0) || n > s.bank) return false;
  s.bank -= n; s.cash += n; return true;
}
export function repay(s, n) {
  n = Math.floor(n);
  if (!here(s, 'debt') || !(n > 0) || n > s.cash || n > s.debt) return false;
  s.cash -= n; s.debt -= n; return true;
}
export function heal(s, points) {
  points = Math.floor(points);
  const cost = points * CONFIG.clinicCost;
  if (!here(s, 'clinic') || !(points > 0) || points > 100 - s.health || cost > s.cash) return false;
  s.cash -= cost; s.health += points; return true;
}
export const storageCost = s => CONFIG.storageCost * (s.storageLevel + 1);
export function expandStorage(s) {
  const cost = storageCost(s);
  if (!here(s, 'storage') || s.capacity >= CONFIG.storageMax || cost > s.cash) return false;
  s.cash -= cost; s.capacity += CONFIG.storageStep; s.storageLevel++; return true;
}

function rollEvent(s) {
  if (rnd(s) >= CONFIG.eventChance) return null;
  const total = EVENTS.reduce((a, e) => a + e.w, 0);
  let x = rnd(s) * total;
  const ev = EVENTS.find(e => (x -= e.w) < 0) || EVENTS[0];
  const out = ev.apply(s, helpers(s));
  if (!out) return null;
  return typeof out === 'string' ? { text: out } : out;
}

// 前往另一个区：过一天、计息、换行情、可能触发事件
export function travel(s, to) {
  if (s.over || to === s.loc || isLastDay(s) || !s.forecast[to]) return null;
  s.day++;
  s.debt = Math.ceil(s.debt * (1 + CONFIG.debtRate));
  s.bank = Math.floor(s.bank * (1 + CONFIG.bankRate));
  s.loc = to;
  s.market = s.forecast[to];
  const res = { rumorHit: s.rumor.district === to ? s.rumor : null, event: rollEvent(s), collapsed: null };
  if (s.health <= 0) { // 累倒：住院两天，花掉两成现金
    const fee = Math.floor(s.cash * 0.2);
    s.cash -= fee; s.health = 50;
    s.day = Math.min(CONFIG.days, s.day + 2);
    res.collapsed = { fee };
  }
  rollForecast(s);
  return res;
}

export function settle(s) {
  s.over = true;
  const score = netWorth(s);
  let rank = RANKS[0];
  for (const r of RANKS) if (score >= r[0]) rank = r;
  return { score, title: rank[1], line: rank[2] };
}

export { GOOD };
