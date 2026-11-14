// 纯玩法逻辑，不依赖任何渲染或 DOM，可以在 Node 里直接跑。
import { CONFIG, DISTRICTS, GOODS, RANKS, VEHICLES, NEWS } from './content.js';
import { EVENT_SCENES } from './story.js';

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
    const u = 0.5 + (rnd(s) + rnd(s) - 1) * 0.5 * CONFIG.priceSpread; // 两个随机数相加：中间多、两头少
    let p = g.min + (g.max - g.min) * u;
    if (g.origin === districtId) p *= CONFIG.originMult;
    if (g.demand === districtId) p *= CONFIG.demandMult;
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
    mult: up ? CONFIG.rumorUp[0] + rnd(s) * (CONFIG.rumorUp[1] - CONFIG.rumorUp[0]) : CONFIG.rumorDown[0] + rnd(s) * (CONFIG.rumorDown[1] - CONFIG.rumorDown[0]),
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
    favor: 0, flags: {}, seen: {}, pendingEvent: null,
    orders: [], offer: null, haggled: {}, talked: {},
    stats: { buys: 0, sells: 0, delivered: 0, expired: 0, haggleWin: 0, caught: 0, peak: CONFIG.startCash }, // 结算时写总结用
    vehicle: null, freeMove: false, // 交通工具；freeMove：面包车今天还能不过夜地再跑一趟
    news: null, // 今日大事的 id
    shady: null, // 今天的烧心货：{ good, state: 'offer' | 'open' | 'refused' }
    // 已接的订单、等你答复的订单、今天砍过价的档口
    // 剧情：人情值、剧情标记、已触发的场景
  };
  s.market = genMarket(s, s.loc, null);
  rollForecast(s);
  return s;
}

// 旧存档里没有 stats，用到的时候补上
const stat = s => s.stats || (s.stats = { buys: 0, sells: 0, delivered: 0, expired: 0, haggleWin: 0, caught: 0, peak: s.cash });

export const used = s => Object.values(s.inv).reduce((a, b) => a + b.qty, 0);
export const free = s => s.capacity - used(s);
export const isLastDay = s => s.day >= CONFIG.days;
export const netWorth = s => s.cash + s.bank - s.debt;

// 烧心货：答应了老板之后，这样货今天按七折进，但买到的都是来路不明的货
export const shadyOpen = (s, id) => !!s.shady && s.shady.state === 'open' && s.shady.good === id;
export const buyPrice = (s, id) => (shadyOpen(s, id) ? Math.max(1, Math.round(s.market[id] * CONFIG.shadyPrice)) : s.market[id]);
export const badQty = (s, id) => (s.inv[id] ? Math.min(s.inv[id].bad || 0, s.inv[id].qty) : 0);

export function maxBuy(s, id) {
  const p = s.market[id] && buyPrice(s, id);
  return p ? Math.max(0, Math.min(Math.floor(s.cash / p), free(s))) : 0;
}

export function buy(s, id, qty) {
  qty = Math.floor(qty);
  if (s.over || !(qty > 0) || qty > maxBuy(s, id)) return false;
  const cost = buyPrice(s, id) * qty;
  s.cash -= cost;
  const it = s.inv[id] || (s.inv[id] = { qty: 0, cost: 0 });
  if (shadyOpen(s, id)) it.bad = badQty(s, id) + qty;
  stat(s).buys++;
  it.qty += qty; it.cost += cost;
  return true;
}

export function sell(s, id, qty) {
  qty = Math.floor(qty);
  const it = s.inv[id];
  if (s.over || !it || !s.market[id] || !(qty > 0) || qty > it.qty) return false;
  // 烧心货先出手；有四成机会被当场退货：这部分钱收不到，货也没了，还丢人情
  const bad = Math.min(badQty(s, id), qty), caught = bad > 0 && (newsOf(s).catchAll || rnd(s) < CONFIG.shadyCatch);
  s.cash += s.market[id] * (caught ? qty - bad : qty);
  if (caught) { s.favor -= 1; stat(s).caught++; }
  stat(s).sells++; stat(s).peak = Math.max(stat(s).peak, s.cash);
  it.cost -= Math.round(it.cost * qty / it.qty);
  it.qty -= qty; it.bad = badQty(s, id) - bad;
  if (it.qty <= 0) delete s.inv[id];
  return { bad, caught };
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

// 抽一个随机事件，返回它的 id；事件本身是一段对话，由界面层播放（见 story.js）
function rollEvent(s) {
  if (rnd(s) >= CONFIG.eventChance) return null;
  const pool = EVENT_SCENES.filter(e => !e.can || e.can(s));
  let x = rnd(s) * pool.reduce((a, e) => a + e.w, 0);
  return (pool.find(e => (x -= e.w) < 0) || pool[0]).id;
}

// 有人找上门下订单：要多少件什么货，几号之前送到哪个区，每件给多少钱
function rollOffer(s) {
  if (rnd(s) >= CONFIG.orderChance || s.orders.length >= CONFIG.orderMax || s.day > CONFIG.days - 3) return null;
  const r = helpers(s), g = r.pick(GOODS), mid = (g.min + g.max) / 2;
  const others = DISTRICTS.filter(d => d.id !== s.loc);
  const to = g.demand !== s.loc && rnd(s) < 0.6 ? g.demand : r.pick(others).id;
  return {
    good: g.id, to,
    qty: Math.max(2, Math.min(30, Math.round((2500 + s.day * 500) / mid))),
    pay: Math.round(mid * CONFIG.orderPremium),
    deadline: Math.min(CONFIG.days, s.day + r.int(3, 5)),
  };
}
export function acceptOffer(s) {
  if (!s.offer || s.orders.length >= CONFIG.orderMax) return false;
  s.orders.push(s.offer); s.offer = null;
  return true;
}
export const canDeliver = (s, o) => s.loc === o.to && !!s.inv[o.good] && s.inv[o.good].qty >= o.qty;
// 交货：人在目的地、货够数就行。返回收到的钱
export function deliver(s, i) {
  const o = s.orders[i];
  if (s.over || !o || !canDeliver(s, o)) return 0;
  const it = s.inv[o.good];
  // 订单里混了烧心货一定会被验出来：那部分不给钱，人情不加反减
  const bad = Math.min(badQty(s, o.good), o.qty), got = (o.qty - bad) * o.pay;
  it.cost -= Math.round(it.cost * o.qty / it.qty);
  it.qty -= o.qty; it.bad = badQty(s, o.good) - bad;
  if (it.qty <= 0) delete s.inv[o.good];
  s.orders.splice(i, 1);
  s.cash += got;
  s.favor += bad ? -1 : 1;
  stat(s).delivered++; stat(s).peak = Math.max(stat(s).peak, s.cash);
  return { got, bad };
}

// 砍价：每个档口每天一次。成功则这个档口今天的价格全线下调，失败则上调。返回 'win' | 'lose' | null
export const canHaggle = s => !newsOf(s).noHaggle;
export const haggleChance = s => Math.max(0.15, Math.min(0.9, CONFIG.haggleBase + s.favor * CONFIG.haggleFavor + (newsOf(s).haggle || 0)));
export function haggle(s, stallId, goodIds) {
  if (s.over || !canHaggle(s) || s.haggled[stallId] || !goodIds.some(id => s.market[id])) return null;
  const win = rnd(s) < haggleChance(s);
  for (const id of goodIds) if (s.market[id]) s.market[id] = Math.max(1, Math.round(s.market[id] * (win ? CONFIG.haggleWin : CONFIG.haggleLose)));
  if (win) stat(s).haggleWin++;
  return (s.haggled[stallId] = win ? 'win' : 'lose');
}

// 追加借款：只能在老乡会，额度看人情
export const borrowLimit = s => Math.max(0, CONFIG.borrowBase + s.favor * CONFIG.borrowFavor - s.debt);
export function borrow(s, n) {
  n = Math.floor(n);
  if (s.over || !here(s, 'debt') || !(n > 0) || n > borrowLimit(s)) return false;
  s.cash += n; s.debt += n; return true;
}

// 前往另一个区：过一天、计息、换行情、可能触发事件
// 今日大事
export const newsOf = s => NEWS.find(n => n.id === s.news) || {};
function applyNews(s) { // 把今天的大事落到当前这个区的行情上
  const n = newsOf(s);
  if (n.mult) for (const id of Object.keys(s.market)) if (!n.goods || n.goods.includes(id)) s.market[id] = Math.max(1, Math.round(s.market[id] * n.mult));
}

// 交通工具：只能在租仓点买，可以从电单车换成面包车
export const vehicleOf = s => VEHICLES[s.vehicle] || null;
export function canBuyVehicle(s, id) {
  const v = VEHICLES[id], cur = vehicleOf(s);
  return !!v && !s.over && here(s, 'storage') && s.vehicle !== id && (!cur || v.cap > cur.cap) && s.cash >= v.cost;
}
export function buyVehicle(s, id) {
  if (!canBuyVehicle(s, id)) return false;
  const v = VEHICLES[id], cur = vehicleOf(s);
  s.cash -= v.cost;
  s.capacity += v.cap - (cur ? cur.cap : 0);
  s.vehicle = id;
  return true;
}
// 现在还能不能换区：最后一天不行，除非面包车今天还剩一趟
export const freeMoveReady = s => s.vehicle === 'van' && s.freeMove;
export const canTravel = s => !s.over && (!isLastDay(s) || freeMoveReady(s));

// 过期的订单作废，丢人情。返回这次作废的订单
function expireOrders(s) {
  const gone = s.orders.filter(o => o.deadline < s.day);
  if (gone.length) {
    s.orders = s.orders.filter(o => o.deadline >= s.day);
    s.favor -= gone.length;
    stat(s).expired += gone.length;
  }
  return gone;
}

// 到了一个区之后要做的事：重置当天的砍价和搭话，抽事件、订单、烧心货
function arrive(s, to) {
  s.loc = to;
  s.haggled = {}; s.talked = {};
  applyNews(s);
  s.pendingEvent = rollEvent(s);
  s.offer = rollOffer(s);
  const onSale = Object.keys(s.market);
  s.shady = !newsOf(s).catchAll && rnd(s) < CONFIG.shadyChance && onSale.length ? { good: helpers(s).pick(onSale), state: 'offer' } : null;
}

// 前往另一个区：过一天、计息、换行情、可能触发事件。
// 开面包车时，每天的第二趟不过夜：日期不变、不计息，行情是那个区今天的。
export function travel(s, to) {
  if (!canTravel(s) || to === s.loc || !s.forecast[to]) return null;
  const v = vehicleOf(s), fuel = v ? Math.min(s.cash, v.fuel) : 0;
  s.cash -= fuel;
  if (freeMoveReady(s)) {
    s.freeMove = false;
    s.market = genMarket(s, to, null);
    arrive(s, to);
    return { rumorHit: null, expired: [], free: true, fuel, news: null };
  }
  s.day++;
  const hadNews = s.news;
  s.news = rnd(s) < CONFIG.newsChance ? helpers(s).pick(NEWS.filter(n => n.id !== hadNews)).id : null;
  const n = newsOf(s);
  if (!n.noInterest) s.debt = Math.ceil(s.debt * (1 + CONFIG.debtRate));
  s.bank = Math.floor(s.bank * (1 + CONFIG.bankRate));
  if (n.health) s.health += n.health;
  // 赶路的疲劳：有车就轻松些
  s.health -= Math.max(0, CONFIG.fatigue - (s.vehicle === 'van' ? 2 : s.vehicle === 'ebike' ? 1 : 0));
  // 房租饭钱：付不起就饿一天
  const living = Math.min(s.cash, CONFIG.livingCost);
  s.cash -= living;
  if (living < CONFIG.livingCost) s.health -= 6;
  s.market = s.forecast[to];
  const res = { rumorHit: s.rumor.district === to ? s.rumor : null, expired: expireOrders(s), free: false, fuel, news: s.news, living, hungry: living < CONFIG.livingCost };
  arrive(s, to);
  s.freeMove = s.vehicle === 'van';
  rollForecast(s);
  return res;
}

// 体力耗尽就累倒：住院两天，花掉两成现金。剧情和事件播完后调用。
export function checkCollapse(s) {
  if (s.health > 0) return null;
  const fee = Math.floor(s.cash * 0.2);
  s.cash -= fee; s.health = 50;
  s.day = Math.min(CONFIG.days, s.day + 2);
  return { fee, expired: expireOrders(s) }; // 躺的这两天里到期的订单也算过期
}

export function settle(s) {
  s.over = true;
  const score = netWorth(s);
  let rank = RANKS[0];
  for (const r of RANKS) if (score >= r[0]) rank = r;
  return { score, title: rank[1], line: rank[2] };
}

export { GOOD };
