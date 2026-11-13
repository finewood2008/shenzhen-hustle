// 界面层：把逻辑状态画到 HUD / 面板上，并把玩家操作转给逻辑层和 3D 场景。
// 两个模式：'street' 在街区里走动、靠近档口交易；'map' 在城市沙盘上选下一个区。
import { TITLE, CONFIG, DISTRICTS, GOODS, STALLS, SERVICES, GREETINGS } from './content.js';
import * as L from './logic.js';
import { createScene } from './scene.js';
import { CAST, nextScene, play, epilogue, walkerKind, walkerScene, shadyScene } from './story.js';
import { portrait, heroPortrait } from './portraits.js';
import { settings, saveSettings, applySettings, heroName, heroLook, THEMES, SIZES, SPEEDS, STATS, SHIRTS, PACKS, HAIRSTYLES, PRESETS, NAMES } from './settings.js';

const $ = sel => document.querySelector(sel);
const yuan = n => (n < 0 ? '-¥' : '¥') + Math.abs(Math.round(n)).toLocaleString('zh-CN');
const D = Object.fromEntries(DISTRICTS.map(d => [d.id, d]));
const G = L.GOOD;
const hex = c => '#' + c.toString(16).padStart(6, '0');

let s = null, busy = false, log = [], toastTimer = 0;
let mode = 'street', nearSpot = null, activeSpot = null;
let scene = null; // 正在播放的剧情对话
let nearWalker = null; // 身边的路人编号
const MARKS = { tip: '💬', ask: '❗' };
document.title = TITLE;
for (const id of ['#panel', '#log', '#bar', '#dock', '#travel', '#toast', '#modal-card']) $(id).classList.add('glass');
applySettings();

const playing = () => s && !s.over && !busy && !scene;
const view = createScene($('#stage'), DISTRICTS, {
  onPick,
  street: {
    canMove: () => playing() && mode === 'street' && $('#modal').hidden && $('#screen').hidden && $('#sheet').hidden,
    playerLook: heroLook,
    onNear(spot) {
      nearSpot = spot;
      if (activeSpot && (!spot || spot.id !== activeSpot.id)) activeSpot = null; // 走开就收摊
      render();
    },
    onInteract: interact,
    walkerMark: i => (s ? MARKS[walkerKind(s, i)] || null : null),
    onNearWalker(i) { nearWalker = i; render(); },
    onTalk(i) { // 走到路人跟前了
      const sc = playing() && walkerScene(s, i);
      if (!sc) { if (playing()) toast('他摆摆手：刚才不是聊过了嘛。', 2200); view.releaseWalker(i); return; }
      startScene(sc, () => view.releaseWalker(i), s.day * 100 + DISTRICTS.indexOf(D[s.loc]) * 13 + i);
    },
  },
});

// ---------- 街区 ----------
function spotsFor(d) {
  const list = [{ kind: 'metro', id: 'metro', name: '地铁站', icon: '🚇' }];
  for (const st of STALLS) list.push({ kind: 'stall', ...st });
  if (d.service) list.push({ kind: 'service', id: 'service', service: d.service, ...SERVICES[d.service] });
  return list;
}
function enterStreet() {
  const d = D[s.loc];
  mode = 'street'; nearSpot = null; activeSpot = null;
  view.enterStreet(d, DISTRICTS.indexOf(d), spotsFor(d));
}
function interact(spot) {
  if (!playing() || mode !== 'street') return;
  if (spot.kind === 'metro') {
    if (L.isLastDay(s)) { toast('今天是最后一天，把货卖掉就结算吧。'); return; }
    showMap();
  } else if (spot.kind === 'stall' && s.shady && s.shady.state === 'offer' && spot.goods.includes(s.shady.good) && s.market[s.shady.good]) {
    startScene(shadyScene(s), () => { activeSpot = spot; render(); }); // 老板先问你要不要烧心货
  } else {
    activeSpot = spot;
    render();
  }
}
function showMap() {
  mode = 'map'; activeSpot = null; nearSpot = null;
  view.setMode('map');
  view.focus(s.loc);
  render();
}
function backToStreet() {
  $('#travel').hidden = true;
  mode = 'street';
  view.setMode('street');
  render();
}

// ---------- 渲染 ----------
function goodRow(g) {
  const p = s.market[g.id], it = s.inv[g.id];
  let priceHtml = '<div class="price tag-mid">无货</div>';
  if (p) {
    const k = (p - g.min) / (g.max - g.min);
    const [cls, word] = k < 0.25 ? ['tag-low', '便宜'] : k > 0.8 ? ['tag-high', '走俏'] : ['tag-mid', '平价'];
    priceHtml = `<div class="price">${yuan(p)}<small class="${cls}">${word}</small></div>`;
  }
  let hold = '';
  if (it) {
    const avg = it.cost / it.qty;
    const diff = p ? (p >= avg ? `<em class="up">赚 ${yuan((p - avg) * it.qty)}</em>` : `<em class="down">亏 ${yuan((avg - p) * it.qty)}</em>`) : '';
    const bad = L.badQty(s, g.id);
    hold = `<div class="hold">持有 ${it.qty}${bad ? `（${bad} 件烧心货）` : ''} · 均价 ${yuan(avg)} ${diff}</div>`;
  }
  return `<div class="row ${p || it ? '' : 'off'}">
    <div class="icon">${g.icon}</div>
    <div><div class="name">${g.name}</div>${hold}</div>
    ${priceHtml}
    <div class="acts">
      <button class="buy" data-buy="${g.id}" ${p && L.maxBuy(s, g.id) > 0 ? '' : 'disabled'}>${p && L.shadyOpen(s, g.id) ? '七折' : '买'}</button>
      <button class="sell" data-sell="${g.id}" ${p && it ? '' : 'disabled'}>卖</button>
    </div>
  </div>`;
}

function serviceHtml(kind) {
  if (kind === 'bank') return `<p>存款日息 ${CONFIG.bankRate * 100}%，现金放这里不怕丢。</p>
    <div class="service"><button data-act="deposit" ${s.cash > 0 ? '' : 'disabled'}>存款</button>
    <button data-act="withdraw" ${s.bank > 0 ? '' : 'disabled'}>取款</button></div>`;
  if (kind === 'debt') return `<p>欠款 ${yuan(s.debt)}，日息 ${CONFIG.debtRate * 100}%。早还早轻松。
    还能再借 ${yuan(L.borrowLimit(s))}，额度看你的人情。</p>
    <div class="service"><button data-act="repay" ${s.debt > 0 && s.cash > 0 ? '' : 'disabled'}>还钱</button>
    <button data-act="borrow" ${L.borrowLimit(s) >= 100 ? '' : 'disabled'}>再借一点</button></div>`;
  if (kind === 'clinic') return `<p>当前体力 ${s.health}。每点体力 ${yuan(CONFIG.clinicCost)}。</p>
    <div class="service"><button data-act="heal" ${s.health < 100 && s.cash >= CONFIG.clinicCost ? '' : 'disabled'}>看病</button></div>`;
  const full = s.capacity >= CONFIG.storageMax;
  return `<p>背包容量 ${s.capacity}，每次扩容 +${CONFIG.storageStep}，上限 ${CONFIG.storageMax}。</p>
    <div class="service"><button data-act="storage" ${!full && s.cash >= L.storageCost(s) ? '' : 'disabled'}>${full ? '已到上限' : '扩容 ' + yuan(L.storageCost(s))}</button></div>`;
}

function render() {
  if (!s) return;
  const last = L.isLastDay(s), d = D[s.loc];
  const on = settings.stats, sub = [];
  if (on.debt) sub.push(`<span class="${s.debt > 0 ? 'bad' : ''}">待还 ${yuan(s.debt)}</span>`);
  if (on.bank) sub.push(`<span>存款 ${yuan(s.bank)}</span>`);
  if (on.health) sub.push(`<span class="${s.health < 40 ? 'bad' : ''}">体力 ${s.health}</span>`);
  if (on.pack) sub.push(`<span>背包 ${L.used(s)}/${s.capacity}</span>`);
  if (on.favor) sub.push(`<span class="${s.favor < 0 ? 'bad' : ''}">人情 ${s.favor > 0 ? '+' : ''}${s.favor}</span>`);
  $('#hud').innerHTML = `
    <div class="topline">
      <span class="chip ${last ? 'warn' : ''}">📅 第 ${s.day}/${CONFIG.days} 天</span>
      <span class="chip">📍 ${d.name}</span>
    </div>
    <div class="wallet">
      <small>${heroName() === '你' ? '余额' : heroName() + ' 的余额'}</small>
      <b>${yuan(s.cash)}</b>
      <div class="sub">${sub.join('')}</div>
      ${on.health ? `<div class="hp"><i style="width:${s.health}%"></i></div>` : ''}
    </div>`;

  // 交易面板：只在街区里和某个档口/服务点互动时出现
  const panel = $('#panel');
  if (mode === 'street' && activeSpot && !scene) {
    const sp = activeSpot;
    let haggleHtml = '';
    if (sp.kind === 'stall') {
      const h = s.haggled[sp.id], open = sp.goods.some(id => s.market[id]);
      haggleHtml = h
        ? `<span class="haggled ${h}">${h === 'win' ? '砍价成功，今天这里便宜 12%' : '砍价失败，今天这里贵了 6%'}</span>`
        : `<button data-act="haggle" ${open ? '' : 'disabled'}>砍价（${Math.round(L.haggleChance(s) * 100)}% 成）</button>`;
    }
    const body = sp.kind === 'stall'
      ? `<div class="rows">${sp.goods.map(id => goodRow(G[id])).join('')}</div>`
      : `<div class="rows"><div class="empty">${serviceHtml(sp.service)}</div></div>`;
    panel.innerHTML = `
      <div class="head">
        <button class="close" data-act="close" aria-label="关闭">×</button>
        <h2><i style="background:${hex(sp.color || d.color)}"></i>${sp.icon} ${d.name} · ${sp.name}</h2>
        <p class="desc">${sp.kind === 'stall' ? `“${GREETINGS[sp.id][(s.day + DISTRICTS.indexOf(d)) % GREETINGS[sp.id].length]}”` : d.desc}</p>
        ${haggleHtml ? `<div class="haggle">${haggleHtml}</div>` : ''}
      </div>
      ${body}
      <div class="foot">
        ${last
          ? '<span>最后一天了。没卖掉的货不计入成绩。</span><button class="primary" data-act="settle">结算</button>'
          : '<span>走开或按 Esc 关闭。去地铁站可以换区。</span>'}
      </div>`;
    panel.hidden = false;
  } else {
    panel.hidden = true;
    panel.innerHTML = '';
  }

  // 底部操作条
  const bar = $('#bar');
  let html = '';
  if (scene) {
    html = '';
  } else if (mode === 'map') {
    html = `<span>${last ? '最后一天，不能再换区了' : '选一个区前往，每次移动耗时 1 天'}</span><button data-bar="back">返回街区</button>`;
  } else if (!activeSpot) {
    if (nearSpot) {
      const verb = nearSpot.kind === 'metro' ? '看地图换区' : nearSpot.kind === 'stall' ? '看货' : '办事';
      html += `<button class="primary" data-bar="interact"><kbd>E</kbd>${nearSpot.icon} ${nearSpot.name} · ${verb}</button>`;
    }
    else if (nearWalker != null && walkerKind(s, nearWalker) !== 'done') {
      const k = walkerKind(s, nearWalker);
      html += `<button data-bar="talk"><kbd>E</kbd>${MARKS[k] || '🚶'} 跟路人${k === 'tip' ? '打听消息' : k === 'ask' ? '说句话' : '聊两句'}</button>`;
    }
    if (last) html += '<button data-bar="settle">结算</button>';
  }
  bar.innerHTML = html;
  bar.hidden = !html;

  // 订单清单
  $('#orders').hidden = !settings.showOrders;
  $('#orders').innerHTML = s.orders.map((o, i) => {
    const have = s.inv[o.good] ? s.inv[o.good].qty : 0, left = o.deadline - s.day;
    const here = s.loc === o.to, ready = L.canDeliver(s, o);
    return `<div class="order glass ${left <= 1 ? 'urgent' : ''}">
      <b>${G[o.good].icon} ${G[o.good].name} ×${o.qty}</b> → ${D[o.to].name}
      <small>${left <= 0 ? '今天截止' : `还剩 ${left} 天`} · 货 ${Math.min(have, o.qty)}/${o.qty} · 报酬 ${yuan(o.qty * o.pay)}</small>
      ${here ? `<button class="primary" data-deliver="${i}" ${ready && !scene ? '' : 'disabled'}>${ready ? '交货' : '货不够'}</button>` : ''}
    </div>`;
  }).join('');

  // 底栏：订单、消息、视角、设置
  const dock = $('#dock');
  dock.hidden = !!scene || s.over || !$('#screen').hidden;
  dock.innerHTML = `
    <button data-dock="orders" class="${settings.showOrders ? 'on' : ''}"><i>📦</i>订单${s.orders.length ? `<em>${s.orders.length}</em>` : ''}</button>
    <button data-dock="log" class="${settings.showLog ? 'on' : ''}"><i>💬</i>消息</button>
    ${mode === 'street' ? `<button data-dock="view"><i>${view.streetView === 'fp' ? '🧍' : '🎥'}</i>${view.streetView === 'fp' ? '第一人称' : '俯视'}</button>` : ''}
    <button data-dock="settings"><i>⚙️</i>设置</button>`;

  $('#log').hidden = !settings.showLog;
  // 触屏摇杆：只在触屏设备的街区里出现
  $('#stick').hidden = !TOUCH || mode !== 'street' || !!scene || !!activeSpot || s.over || !$('#screen').hidden;
  if ($('#stick').hidden) resetStick();
  autosave();
  $('#log').innerHTML = log.slice(-6).map(l => `<p class="${l.cls || ''}">${l.text}</p>`).join('');
}

function say(text, cls) { log.push({ text, cls }); }
function toast(html, ms = 3600) {
  const t = $('#toast');
  t.innerHTML = html; t.hidden = false;
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}
const rumorText = r => `明天${D[r.district].name}的${G[r.good].name}${r.up ? '要被抢疯' : '要大甩卖'}`;
function showRumor() {
  const r = s.rumor;
  if (L.isLastDay(s)) { view.setRumor(null); return; }
  say('小道消息：' + rumorText(r), 'rumor');
  view.setRumor({ district: r.district, up: r.up, text: `${r.up ? '▲' : '▼'} ${G[r.good].name}` });
}

// ---------- 数量弹窗 ----------
let modalOk = null;
function askAmount({ title, hint, max, total, onOk }) {
  $('#modal-title').textContent = title;
  $('#modal-hint').textContent = hint || '';
  const num = $('#modal-num'), range = $('#modal-range');
  num.max = range.max = max;
  const set = v => {
    v = Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
    num.value = range.value = v;
    $('#modal-total').textContent = total ? total(v) : '';
    $('#modal-ok').disabled = v <= 0;
  };
  num.oninput = () => set(num.value);
  range.oninput = () => set(range.value);
  $('#modal-card').querySelectorAll('[data-frac]').forEach(b => { b.onclick = () => set(max * Number(b.dataset.frac)); });
  modalOk = () => onOk(Number(num.value));
  set(max);
  $('#modal').hidden = false;
  num.focus(); num.select();
}
function closeModal() { $('#modal').hidden = true; modalOk = null; }
$('#modal-cancel').onclick = closeModal;
$('#modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal') closeModal(); });
$('#modal-card').addEventListener('submit', e => {
  e.preventDefault();
  const fn = modalOk; closeModal();
  if (fn) { fn(); render(); checkStory(); }
});
window.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('#modal').hidden) closeModal();
  else if (activeSpot) { activeSpot = null; render(); }
  else if (mode === 'map' && playing()) backToStreet();
});

// ---------- 剧情对话 ----------
const dlg = { root: $('#dialog'), portrait: $('#dialog .portrait'), who: $('#dialog .who'), text: $('#dialog .text'), choices: $('#dialog .choices'), more: $('#dialog .more') };
// 有该触发的剧情就播，可能连着好几段；全部播完后调用 then
function checkStory(then) {
  const sc = s && !scene && nextScene(s);
  if (!sc) { if (then) then(); return; }
  startScene(sc, () => checkStory(then));
}
// 播放一段对话，播完调用 then。seed 决定路人长什么样
function startScene(sc, then, seed = 0) {
  scene = { p: play(s, sc), timer: 0, full: '', shown: 0, cur: null, then, seed };
  activeSpot = null;
  dlg.root.hidden = false;
  render();
  showLine();
}
function showLine() {
  const cur = scene.p.current();
  if (!cur) {
    const then = scene.then;
    clearInterval(scene.timer);
    scene = null;
    dlg.root.hidden = true;
    render();
    then();
    return;
  }
  const c = CAST[cur.who];
  const art = portrait(cur.who, cur.mood, scene.seed);
  dlg.root.dataset.who = cur.who;
  dlg.portrait.innerHTML = art;
  dlg.portrait.hidden = !art;
  dlg.who.innerHTML = c.name ? `${c.name}${c.title ? `<small>${c.title}</small>` : ''}` : '';
  dlg.who.hidden = !c.name;
  dlg.choices.innerHTML = '';
  dlg.more.hidden = true;
  scene.cur = cur; scene.full = cur.text; scene.shown = 0;
  dlg.text.textContent = '';
  clearInterval(scene.timer);
  const t0 = performance.now(); // 按时间算字数，标签页被降频时也不会变慢
  scene.timer = setInterval(() => {
    scene.shown = settings.speed ? Math.min(scene.full.length, Math.floor((performance.now() - t0) / settings.speed) + 1) : scene.full.length;
    dlg.text.textContent = scene.full.slice(0, scene.shown);
    if (scene.shown >= scene.full.length) lineDone();
  }, 26);
}
function lineDone() {
  clearInterval(scene.timer);
  scene.shown = scene.full.length;
  dlg.text.textContent = scene.full;
  const ch = scene.cur.choices;
  if (ch) {
    dlg.choices.innerHTML = ch.map((c, i) =>
      `<button data-choice="${i}" ${c.ok ? '' : 'disabled'}><kbd>${i + 1}</kbd>${c.label}${c.ok || !c.why ? '' : `<small>${c.why}</small>`}</button>`).join('');
  } else dlg.more.hidden = false;
}
function advance() {
  if (!scene) return;
  if (scene.shown < scene.full.length) lineDone();
  else if (!scene.cur.choices) {
    const result = scene.p.next();
    if (result) { say(result, 'rumor'); toast(result, 3000); render(); }
    showLine();
  }
}
function choose(i) {
  if (!scene || scene.shown < scene.full.length || !scene.cur.choices) return;
  const result = scene.p.choose(i);
  if (result === null) return;
  if (result) { say(result, 'rumor'); toast(result, 3000); }
  render();
  showLine();
}
dlg.root.addEventListener('click', e => {
  const b = e.target.closest('[data-choice]');
  if (b) choose(Number(b.dataset.choice)); else advance();
});
// 对话时截住键盘，不让街区和面板收到
window.addEventListener('keydown', e => {
  if (!scene) return;
  e.stopImmediatePropagation();
  if (e.repeat) return;
  if (e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'e') { e.preventDefault(); advance(); }
  else if (/^[1-9]$/.test(e.key)) choose(Number(e.key) - 1);
}, true);

// ---------- 面板与操作条 ----------
$('#panel').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || !playing()) return;
  const { buy, sell, act } = b.dataset;
  if (buy) {
    const g = G[buy], p = L.buyPrice(s, buy), shady = L.shadyOpen(s, buy);
    askAmount({
      title: shady ? `买入 ${g.name}（烧心货）` : `买入 ${g.name}`, hint: `${shady ? '七折价' : '单价'} ${yuan(p)}，最多能买 ${L.maxBuy(s, buy)}`, max: L.maxBuy(s, buy),
      total: n => `花费 ${yuan(n * p)}`,
      onOk: n => { if (L.buy(s, buy, n)) say(`买入 ${g.name} ×${n}，花了 ${yuan(n * p)}`); },
    });
  } else if (sell) {
    const g = G[sell], p = s.market[sell], it = s.inv[sell], avg = it.cost / it.qty;
    askAmount({
      title: `卖出 ${g.name}`, hint: `单价 ${yuan(p)}，持有 ${it.qty}，均价 ${yuan(avg)}`, max: it.qty,
      total: n => `收入 ${yuan(n * p)}（${p >= avg ? '赚' : '亏'} ${yuan(Math.abs(p - avg) * n)}）`,
      onOk: n => {
        const r = L.sell(s, sell, n);
        if (!r) return;
        if (r.caught) {
          const t = `“这批货有问题！”${r.bad} 件${g.name}被当场退货，钱没收到，货也废了。人情 -1`;
          say(t); toast(t, 4200);
          if (n > r.bad) say(`其余 ${n - r.bad} 件卖出，收入 ${yuan((n - r.bad) * p)}`);
        } else say(`卖出 ${g.name} ×${n}，收入 ${yuan(n * p)}${r.bad ? '（烧心货混过去了）' : ''}`);
      },
    });
  } else if (act === 'deposit') {
    askAmount({ title: '存款', hint: `现金 ${yuan(s.cash)}`, max: s.cash, total: n => `存入 ${yuan(n)}`,
      onOk: n => { if (L.deposit(s, n)) say(`存入银行 ${yuan(n)}`); } });
  } else if (act === 'withdraw') {
    askAmount({ title: '取款', hint: `存款 ${yuan(s.bank)}`, max: s.bank, total: n => `取出 ${yuan(n)}`,
      onOk: n => { if (L.withdraw(s, n)) say(`从银行取出 ${yuan(n)}`); } });
  } else if (act === 'repay') {
    askAmount({ title: '还钱给老乡会', hint: `欠款 ${yuan(s.debt)}，现金 ${yuan(s.cash)}`, max: Math.min(s.cash, s.debt),
      total: n => `还款 ${yuan(n)}，还剩 ${yuan(s.debt - n)}`,
      onOk: n => { if (L.repay(s, n)) say(s.debt === 0 ? '欠款还清了，一身轻松。' : `还了 ${yuan(n)}，还欠 ${yuan(s.debt)}`); } });
  } else if (act === 'borrow') {
    const max = L.borrowLimit(s);
    askAmount({ title: '向老乡会再借一点', hint: `最多还能借 ${yuan(max)}，日息 ${CONFIG.debtRate * 100}%`, max,
      total: n => `借 ${yuan(n)}，欠款变成 ${yuan(s.debt + n)}`,
      onOk: n => { if (L.borrow(s, n)) say(`又向老乡会借了 ${yuan(n)}，现在欠 ${yuan(s.debt)}`); } });
  } else if (act === 'haggle') {
    const res = L.haggle(s, activeSpot.id, activeSpot.goods);
    if (res) {
      const t = res === 'win' ? '“行，老主顾的规矩：价让你一点，料不能减。”' : '“价钱能谈，规矩不能坏。今天就这个价。”';
      say(res === 'win' ? '砍价成功，这个档口今天便宜 12%。' : '砍价失败，这个档口今天贵了 6%。');
      toast(t, 3200);
    }
    render();
  } else if (act === 'heal') {
    const max = Math.min(100 - s.health, Math.floor(s.cash / CONFIG.clinicCost));
    askAmount({ title: '社康看病', hint: `当前体力 ${s.health}`, max, total: n => `恢复 ${n} 点，花费 ${yuan(n * CONFIG.clinicCost)}`,
      onOk: n => { if (L.heal(s, n)) say(`看了病，体力恢复到 ${s.health}`); } });
  } else if (act === 'storage') {
    if (L.expandStorage(s)) say(`租了个小仓，背包容量升到 ${s.capacity}`);
    render();
  } else if (act === 'close') {
    activeSpot = null; render();
  } else if (act === 'settle') {
    endGame();
  }
});

$('#bar').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || !playing()) return;
  b.blur();
  const act = b.dataset.bar;
  if (act === 'interact' && nearSpot) interact(nearSpot);
  else if (act === 'talk') window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
  else if (act === 'back') backToStreet();
  else if (act === 'settle') endGame();
});

function toggleView() {
  if (!playing() || mode !== 'street') return;
  view.setStreetView(view.streetView === 'fp' ? 'iso' : 'fp');
  render();
}
$('#dock').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  const act = b.dataset.dock;
  if (act === 'view') toggleView();
  else if (act === 'settings') openSettings();
  else if (act === 'orders') { settings.showOrders = !settings.showOrders; saveSettings(); }
  else if (act === 'log') { settings.showLog = !settings.showLog; saveSettings(); }
  render();
});

// ---------- 触屏摇杆 ----------
const TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
let stickId = null;
function resetStick() { stickId = null; $('#stick i').style.transform = ''; view.setStick(0, 0); }
function moveStick(e) {
  const rc = $('#stick').getBoundingClientRect(), R = rc.width / 2;
  let x = (e.clientX - rc.left - R) / R, y = (e.clientY - rc.top - R) / R;
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  $('#stick i').style.transform = `translate(${x * R * 0.6}px, ${y * R * 0.6}px)`;
  view.setStick(len < 0.2 ? 0 : x, len < 0.2 ? 0 : -y);
}
$('#stick').addEventListener('pointerdown', e => {
  e.preventDefault();
  stickId = e.pointerId;
  try { $('#stick').setPointerCapture(e.pointerId); } catch { /* 合成事件 */ }
  moveStick(e);
});
$('#stick').addEventListener('pointermove', e => { if (e.pointerId === stickId) moveStick(e); });
for (const ev of ['pointerup', 'pointercancel']) $('#stick').addEventListener(ev, e => { if (e.pointerId === stickId) resetStick(); });

// ---------- 存档：自动存在浏览器里，关掉页面再打开可以接着玩 ----------
const SAVE = 'sz-save';
function autosave() {
  if (!s || s.over || scene || busy) return;
  try { localStorage.setItem(SAVE, JSON.stringify({ v: 1, s, log: log.slice(-30) })); } catch { /* 存不了就算了 */ }
}
function loadSave() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE));
    return d && d.v === 1 && d.s && !d.s.over && D[d.s.loc] && Array.isArray(d.s.orders) ? d : null;
  } catch { return null; }
}
function clearSave() { try { localStorage.removeItem(SAVE); } catch { /* 无所谓 */ } }

// ---------- 设置：外观、布局、游戏偏好、主角形象 ----------
const hexc = c => '#' + c.toString(16).padStart(6, '0');
const seg = (key, list, cur) => `<div class="seg">${list.map(o => `<button data-set="${key}" data-val="${o.id}" class="${String(o.id) === String(cur) ? 'on' : ''}">${o.name}</button>`).join('')}</div>`;
const swatches = (key, list, cur) => `<div class="seg">${list.map(c => `<button class="sw ${c === cur ? 'on' : ''}" data-hero="${key}" data-val="${c}" style="background:${hexc(c)}" aria-label="颜色"></button>`).join('')}</div>`;
// 形象板块：左边一张“工牌”实时预览，右边先挑现成造型，再按标签页细调
let heroTab = 'shirt';
const HERO_TABS = [['shirt', '上衣'], ['pack', '背包'], ['hair', '发型'], ['skirt', '下装']];
function heroHtml() {
  const h = settings.hero;
  const same = p => p.shirt === h.shirt && p.pack === h.pack && p.hair === h.hair && p.skirt === h.skirt;
  const picker = {
    shirt: () => SHIRTS.map(c => `<button class="sw ${c === h.shirt ? 'on' : ''}" data-hero="shirt" data-val="${c}" style="background:${hexc(c)}" aria-label="上衣颜色"></button>`).join(''),
    pack: () => PACKS.map(c => `<button class="sw ${c === h.pack ? 'on' : ''}" data-hero="pack" data-val="${c}" style="background:${hexc(c)}" aria-label="背包颜色"></button>`).join(''),
    hair: () => HAIRSTYLES.map(o => `<button data-hero="hair" data-val="${o.id}" class="${o.id === h.hair ? 'on' : ''}">${o.name}</button>`).join(''),
    skirt: () => `<button data-hero="skirt" data-val="0" class="${h.skirt ? '' : 'on'}">长裤</button><button data-hero="skirt" data-val="1" class="${h.skirt ? 'on' : ''}">裙子</button>`,
  }[heroTab]();
  return `<div class="hero">
    <div class="badge">
      <i class="clip"></i>
      <div class="ava">${heroPortrait(h)}</div>
      <input type="text" id="hero-name" maxlength="8" placeholder="点这里起名" value="${h.name.replace(/"/g, '&quot;')}" aria-label="名字">
      <small>深圳搞钱人 · 第 1 天报到</small>
      <button class="dice" data-random title="随机一个">🎲 随机</button>
    </div>
    <div class="looks">
      <h4>挑一个造型</h4>
      <div class="presets">${PRESETS.map((p, i) => `<button data-preset="${i}" class="${same(p) ? 'on' : ''}"><span>${heroPortrait(p, 'plain')}</span>${p.name}</button>`).join('')}</div>
      <h4>或者自己搭</h4>
      <div class="tabs">${HERO_TABS.map(([k, n]) => `<button data-herotab="${k}" class="${k === heroTab ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="pick">${picker}</div>
    </div>
  </div>`;
}
// 形象选项的点击和输入，封面和设置面板共用。返回 true 表示需要重画
function heroInput(e) {
  if (e.target.id === 'hero-name') { settings.hero.name = e.target.value; saveSettings(); return false; }
  if (e.type !== 'click' || !e.target.closest) return false;
  const h = settings.hero;
  const tab = e.target.closest('[data-herotab]'), pre = e.target.closest('[data-preset]'), b = e.target.closest('[data-hero]');
  if (tab) { heroTab = tab.dataset.herotab; return true; }
  if (pre) Object.assign(h, PRESETS[Number(pre.dataset.preset)], { name: h.name });
  else if (e.target.closest('[data-random]')) {
    const pick = a => a[Math.floor(Math.random() * a.length)];
    Object.assign(h, { name: pick(NAMES), shirt: pick(SHIRTS), pack: pick(PACKS), hair: pick(HAIRSTYLES).id, skirt: Math.random() < 0.4 });
  } else if (b) {
    const k = b.dataset.hero, v = b.dataset.val;
    h[k] = k === 'hair' ? v : k === 'skirt' ? v === '1' : Number(v);
  } else return false;
  saveSettings();
  view.refreshPlayer();
  return true;
}
function openSettings() {
  const sh = $('#sheet');
  const draw = () => {
    const y = sh.firstElementChild ? sh.firstElementChild.scrollTop : 0;
    sh.innerHTML = `<div class="card glass">
      <header><b>设置</b><button data-close>完成</button></header>
      <section><h4>外观</h4>
        <div class="opt"><span>主题</span><div class="seg">${THEMES.map(th => `<button class="sw theme ${th.id === settings.theme ? 'on' : ''}" data-set="theme" data-val="${th.id}" title="${th.name}" aria-label="${th.name}" style="background:linear-gradient(135deg, ${th.swatch[0]} 55%, ${th.swatch[1]} 55%)"></button>`).join('')}</div></div>
        <div class="opt"><span>字号</span>${seg('size', SIZES, settings.size)}</div>
      </section>
      <section><h4>布局</h4>
        <div class="opt"><span>交易面板</span>${seg('side', [{ id: 'left', name: '靠左' }, { id: 'right', name: '靠右' }], settings.side)}</div>
        <div class="opt"><span>余额卡片显示</span><div class="seg">${STATS.map(o => `<button data-stat="${o.id}" class="${settings.stats[o.id] ? 'on' : ''}">${o.name}</button>`).join('')}</div></div>
        <div class="opt"><span>订单清单</span>${seg('showOrders', [{ id: 'true', name: '显示' }, { id: 'false', name: '隐藏' }], settings.showOrders)}</div>
        <div class="opt"><span>消息记录</span>${seg('showLog', [{ id: 'true', name: '显示' }, { id: 'false', name: '隐藏' }], settings.showLog)}</div>
      </section>
      <section><h4>游戏</h4>
        <div class="opt"><span>默认视角</span>${seg('view', [{ id: 'iso', name: '斜俯视' }, { id: 'fp', name: '第一人称' }], settings.view)}</div>
        <div class="opt"><span>对话文字速度</span>${seg('speed', SPEEDS, settings.speed)}</div>
      </section>
      <section class="herosec"><h4>我的形象</h4>${heroHtml()}</section>
    </div>`;
    sh.firstElementChild.scrollTop = y;
  };
  sh.onclick = e => {
    if (e.target === sh || e.target.closest('[data-close]')) { sh.hidden = true; render(); return; }
    if (heroInput(e)) { draw(); render(); return; }
    if (e.target.closest('.hero')) return;
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.stat) settings.stats[b.dataset.stat] = !settings.stats[b.dataset.stat];
    else if (b.dataset.set) {
      const k = b.dataset.set, v = b.dataset.val;
      settings[k] = k === 'speed' ? Number(v) : k.startsWith('show') ? v === 'true' : v;
      if (k === 'view' && s && !s.over) view.setStreetView(v);
    } else return;
    saveSettings(); applySettings(); draw(); render();
  };
  sh.oninput = heroInput;
  draw();
  sh.hidden = false;
}
window.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) { e.stopImmediatePropagation(); $('#sheet').hidden = true; render(); } }, true);
window.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 'v' && e.target.tagName !== 'INPUT' && !e.metaKey && !e.ctrlKey && $('#modal').hidden && $('#sheet').hidden) { toggleView(); render(); }
});

$('#orders').addEventListener('click', e => {
  const b = e.target.closest('[data-deliver]');
  if (!b || !playing()) return;
  const o = s.orders[Number(b.dataset.deliver)];
  const r = L.deliver(s, Number(b.dataset.deliver));
  if (!r) return;
  const t = r.bad
    ? `交货：${G[o.good].name} ×${o.qty}，其中 ${r.bad} 件烧心货被验了出来，只收到 ${yuan(r.got)} · 人情 -1`
    : `交货：${G[o.good].name} ×${o.qty}，收到 ${yuan(r.got)} · 人情 +1`;
  say(t, 'rumor'); toast(t, 3600);
  render();
});

// ---------- 地图上换区 ----------
function onPick(id) {
  if (!playing() || mode !== 'map') return;
  const box = $('#travel');
  if (id === s.loc) { backToStreet(); return; }
  if (L.isLastDay(s)) { toast('今天是最后一天，不能再换区了。'); return; }
  const d = D[id];
  const tip = s.rumor.district === id ? `<br><span style="color:#fbbf24">听说：${rumorText(s.rumor)}</span>` : '';
  box.innerHTML = `<b>前往 ${d.name}？</b><p>${d.desc}${tip}</p>
    <div class="btn-row"><button data-no>取消</button><button class="primary" data-go="${id}">出发（1 天）</button></div>`;
  box.hidden = false;
}
$('#travel').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  $('#travel').hidden = true;
  if (b.dataset.go) go(b.dataset.go);
});

function go(id) {
  if (busy) return;
  const res = L.travel(s, id);
  if (!res) return;
  busy = true;
  view.setRumor(null);
  $('#toast').hidden = true;
  $('#bar').hidden = true;
  view.movePlayer(id, () => {
    busy = false;
    const lines = [`<b>第 ${s.day} 天 · ${D[id].name}</b>`];
    say(`第 ${s.day} 天，到了${D[id].name}。`);
    if (res.rumorHit) {
      const t = `消息是真的：${G[res.rumorHit.good].name}${res.rumorHit.up ? '价格飞涨！' : '跌到了地板价！'}`;
      lines.push(t); say(t, 'rumor');
    }
    if (s.health < 40) lines.push('体力快撑不住了，去龙华的社康看看吧。');
    for (const o of res.expired) {
      const t = `订单过期：${G[o.good].name} ×${o.qty} 没送到${D[o.to].name}。人情 -1`;
      lines.push(t); say(t);
    }
    if (L.isLastDay(s)) lines.push('今天是最后一天。');
    showRumor();
    enterStreet();
    render();
    toast(lines.join('<br>'), 4200);
    checkStory(() => { // 对话都播完后，再看有没有累倒
      const c = L.checkCollapse(s);
      if (!c) return;
      const t = `你累倒在路边，被送进医院躺了两天，花了 ${yuan(c.fee)}。`;
      say(t); toast(t, 4200); render();
    });
  });
  render();
}

// ---------- 开始与结束 ----------
function bestScore() { try { return JSON.parse(localStorage.getItem('sz-best')); } catch { return null; } }
function saveBest(v) { try { localStorage.setItem('sz-best', JSON.stringify(v)); } catch { /* 存不了就算了 */ } }

function startScreen() {
  const best = bestScore(), sc = $('#screen'), save = loadSave();
  sc.innerHTML = `<div class="card glass cover">
    <div class="pitch">
      <span class="tag">30 天挑战</span>
      <h1>深圳<span>浮生</span>记</h1>
      <div class="sub">一个行李箱，三十天，一座不睡觉的城市。你揣着老乡会借的 ${yuan(CONFIG.startDebt)}，手里还剩 ${yuan(CONFIG.startCash)}。</div>
      <ul class="points">
        <li><i>📈</i><b>低买高卖</b>十个区、十样货，行情一天一变</li>
        <li><i>📦</i><b>接单跑腿</b>按时送到，价钱比市面高</li>
        <li><i>🤝</i><b>人情世故</b>怎么待人，决定谁肯帮你</li>
      </ul>
    </div>
    <div class="me">${heroHtml()}</div>
    <div class="go">
      ${save ? `<button class="primary" id="resume">继续上一局（第 ${save.s.day} 天 · ${yuan(save.s.cash)}）</button>` : ''}
      <button class="${save ? 'again' : 'primary'}" id="start">${save ? '重新开局' : '开始搞钱'}</button>
      ${best != null ? `<div class="best">历史最佳 ${yuan(best)}</div>` : ''}
      <details><summary>怎么玩</summary><div class="intro">
        · 点地面走过去，或用 WASD；按住拖动转镜头，滚轮缩放，按 V 切换第一人称。<br>
        · 走近档口看货，低买高卖；每个档口每天能砍一次价。<br>
        · 去地铁站换区，每换一次过一天。欠款每天涨 ${CONFIG.debtRate * 100}%，回罗湖的老乡会才能还。<br>
        · 有人会找你下订单，按时把货送到指定的区，价钱比市面高。<br>
        · 路人可以搭话：头顶 💬 的有行情消息，❗ 的有事找你。<br>
        · 怎么待人会影响人情，人情影响砍价、借款和结局。<br>
        · 第 ${CONFIG.days} 天结算：现金 + 存款 − 欠款，没卖掉的货不算。<br>
        · 主题、布局和形象随时可以在底栏的“设置”里改。
      </div></details>
    </div>
  </div>`;
  sc.hidden = false;
  sc.onclick = e => { if (heroInput(e)) { const y = sc.firstElementChild.scrollTop; startScreen(); sc.firstElementChild.scrollTop = y; } };
  sc.oninput = heroInput;
  $('#start').onclick = () => startGame();
  if (save) $('#resume').onclick = () => startGame(save);
}

// saved 有值就是读档接着玩
function startGame(saved) {
  s = saved ? { ...L.newGame(), ...saved.s } : L.newGame(); // 旧存档缺的字段用新局的默认值补上
  log = saved ? saved.log || [] : []; busy = false; scene = null;
  $('#dialog').hidden = true;
  $('#screen').hidden = true;
  $('#screen').onclick = $('#screen').oninput = null;
  $('#travel').hidden = true;
  if (document.activeElement) document.activeElement.blur();
  view.setPlayerAt(s.loc);
  view.setStreetView(settings.view);
  say(saved ? `接着玩：第 ${s.day} 天，${D[s.loc].name}。` : `第 1 天，你拖着行李箱走出${D[s.loc].name}的地铁站。`);
  showRumor();
  enterStreet();
  render();
  checkStory();
}

function endGame() {
  const r = L.settle(s);
  clearSave();
  const prev = bestScore();
  const isBest = prev == null || r.score > prev;
  if (isBest) saveBest(r.score);
  view.setRumor(null);
  activeSpot = null;
  $('#panel').hidden = true;
  $('#bar').hidden = true;
  $('#dock').hidden = true;
  $('#screen').innerHTML = `<div class="card glass">
    <div class="scorecard ${r.score < 0 ? 'neg' : ''}">
      <small>${heroName() === '你' ? '' : heroName() + ' · '}深圳 ${CONFIG.days} 天 · 净资产</small>
      <div class="score">${yuan(r.score)}</div>
      <div class="rank">${r.title}</div>
      <div class="facts"><span>现金 ${yuan(s.cash)}</span><span>存款 ${yuan(s.bank)}</span><span>欠款 ${yuan(s.debt)}</span><span>人情 ${s.favor > 0 ? '+' : ''}${s.favor}</span></div>
    </div>
    <p style="color:var(--text);margin-top:12px">${r.line}</p>
    <div class="epilogue">${epilogue(s).map(t => `<p>${t}</p>`).join('')}</div>
    <div class="best">${isBest ? '新的最佳成绩' : '历史最佳 ' + yuan(prev)}</div>
    <button class="primary" id="start">再来一局</button>
  </div>`;
  $('#screen').hidden = false;
  $('#start').onclick = startScreen;
}

startScreen();
window.__game = { peek(id, x, yaw) { const d = D[id]; view.enterStreet(d, DISTRICTS.indexOf(d), spotsFor(d), x, yaw); }, map() { view.setMode('map'); }, get state() { return s; }, get ui() { return { mode, near: nearSpot && nearSpot.id, active: activeSpot && activeSpot.id, scene: scene && scene.cur }; }, story: checkStory, go, end: endGame }; // 方便调试
