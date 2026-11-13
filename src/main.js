// 界面层：把逻辑状态画到 HUD / 面板上，并把玩家操作转给逻辑层和 3D 场景。
// 两个模式：'street' 在街区里走动、靠近档口交易；'map' 在城市沙盘上选下一个区。
import { TITLE, CONFIG, DISTRICTS, GOODS, STALLS, SERVICES, GREETINGS } from './content.js';
import * as L from './logic.js';
import { createScene } from './scene.js';
import { CAST, nextScene, play, epilogue } from './story.js';
import { portrait } from './portraits.js';

const $ = sel => document.querySelector(sel);
const yuan = n => (n < 0 ? '-¥' : '¥') + Math.abs(Math.round(n)).toLocaleString('zh-CN');
const D = Object.fromEntries(DISTRICTS.map(d => [d.id, d]));
const G = L.GOOD;
const hex = c => '#' + c.toString(16).padStart(6, '0');

let s = null, busy = false, log = [], toastTimer = 0;
let mode = 'street', nearSpot = null, activeSpot = null;
let scene = null; // 正在播放的剧情对话
document.title = TITLE;
for (const id of ['#panel', '#log', '#bar', '#travel', '#toast', '#modal-card']) $(id).classList.add('glass');

const playing = () => s && !s.over && !busy && !scene;
const view = createScene($('#stage'), DISTRICTS, {
  onPick,
  street: {
    canMove: () => playing() && mode === 'street' && $('#modal').hidden && $('#screen').hidden,
    onNear(spot) {
      nearSpot = spot;
      if (activeSpot && (!spot || spot.id !== activeSpot.id)) activeSpot = null; // 走开就收摊
      render();
    },
    onInteract: interact,
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
    hold = `<div class="hold">持有 ${it.qty} · 均价 ${yuan(avg)} ${diff}</div>`;
  }
  return `<div class="row ${p || it ? '' : 'off'}">
    <div class="icon">${g.icon}</div>
    <div><div class="name">${g.name}</div>${hold}</div>
    ${priceHtml}
    <div class="acts">
      <button class="buy" data-buy="${g.id}" ${p && L.maxBuy(s, g.id) > 0 ? '' : 'disabled'}>买</button>
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
  const stat = (label, value, cls = '', extra = '') =>
    `<div class="stat glass ${cls}"><small>${label}</small><b>${value}</b>${extra}</div>`;
  $('#hud').innerHTML =
    stat('日期', `第 ${s.day} / ${CONFIG.days} 天`, last ? 'warn' : '') +
    stat('所在', d.name) +
    stat('现金', yuan(s.cash), 'good') +
    stat('存款', yuan(s.bank)) +
    stat('欠款', yuan(s.debt), s.debt > 0 ? 'warn' : '') +
    stat('体力', s.health, s.health < 40 ? 'warn' : '', `<div class="bar"><i style="width:${s.health}%"></i></div>`) +
    stat('背包', `${L.used(s)} / ${s.capacity}`) +
    stat('人情', (s.favor > 0 ? '+' : '') + s.favor, s.favor < 0 ? 'warn' : '');

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
    if (last) html += '<button data-bar="settle">结算</button>';
  }
  bar.innerHTML = html;
  bar.hidden = !html;

  // 订单清单
  $('#orders').innerHTML = s.orders.map((o, i) => {
    const have = s.inv[o.good] ? s.inv[o.good].qty : 0, left = o.deadline - s.day;
    const here = s.loc === o.to, ready = L.canDeliver(s, o);
    return `<div class="order glass ${left <= 1 ? 'urgent' : ''}">
      <b>${G[o.good].icon} ${G[o.good].name} ×${o.qty}</b> → ${D[o.to].name}
      <small>${left <= 0 ? '今天截止' : `还剩 ${left} 天`} · 货 ${Math.min(have, o.qty)}/${o.qty} · 报酬 ${yuan(o.qty * o.pay)}</small>
      ${here ? `<button class="primary" data-deliver="${i}" ${ready && !scene ? '' : 'disabled'}>${ready ? '交货' : '货不够'}</button>` : ''}
    </div>`;
  }).join('');

  // 视角切换按钮：只在街区里、没有对话和面板时出现
  const vb = $('#viewbtn');
  vb.hidden = mode !== 'street' || !!scene || s.over || !$('#screen').hidden;
  vb.innerHTML = view.streetView === 'fp' ? '<kbd>V</kbd>切到俯视' : '<kbd>V</kbd>切到第一人称';

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
  scene = { p: play(s, sc), timer: 0, full: '', shown: 0, cur: null, then: () => checkStory(then) };
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
  const art = portrait(cur.who, cur.mood);
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
    scene.shown = Math.min(scene.full.length, Math.floor((performance.now() - t0) / 24) + 1);
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
    const g = G[buy], p = s.market[buy];
    askAmount({
      title: `买入 ${g.name}`, hint: `单价 ${yuan(p)}，最多能买 ${L.maxBuy(s, buy)}`, max: L.maxBuy(s, buy),
      total: n => `花费 ${yuan(n * p)}`,
      onOk: n => { if (L.buy(s, buy, n)) say(`买入 ${g.name} ×${n}，花了 ${yuan(n * p)}`); },
    });
  } else if (sell) {
    const g = G[sell], p = s.market[sell], it = s.inv[sell], avg = it.cost / it.qty;
    askAmount({
      title: `卖出 ${g.name}`, hint: `单价 ${yuan(p)}，持有 ${it.qty}，均价 ${yuan(avg)}`, max: it.qty,
      total: n => `收入 ${yuan(n * p)}（${p >= avg ? '赚' : '亏'} ${yuan(Math.abs(p - avg) * n)}）`,
      onOk: n => { if (L.sell(s, sell, n)) say(`卖出 ${g.name} ×${n}，收入 ${yuan(n * p)}`); },
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
      const t = res === 'win' ? '“行行行，算你会讲。今天给你这个价。”' : '“不诚心买就别乱还价。今天就这个价，爱要不要。”';
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
  else if (act === 'back') backToStreet();
  else if (act === 'settle') endGame();
});

function toggleView() {
  if (!playing() || mode !== 'street') return;
  view.setStreetView(view.streetView === 'fp' ? 'iso' : 'fp');
  render();
}
$('#viewbtn').addEventListener('click', e => { e.currentTarget.blur(); toggleView(); });
window.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 'v' && e.target.tagName !== 'INPUT' && !e.metaKey && !e.ctrlKey && $('#modal').hidden) toggleView();
});

$('#orders').addEventListener('click', e => {
  const b = e.target.closest('[data-deliver]');
  if (!b || !playing()) return;
  const o = s.orders[Number(b.dataset.deliver)];
  const got = L.deliver(s, Number(b.dataset.deliver));
  if (!got) return;
  const t = `交货：${G[o.good].name} ×${o.qty}，收到 ${yuan(got)} · 人情 +1`;
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
  const best = bestScore();
  $('#screen').innerHTML = `<div class="card glass">
    <h1>${TITLE}</h1>
    <div class="sub">一个行李箱，三十天，一座不睡觉的城市</div>
    <div class="intro">
      你揣着老乡会借的 ${yuan(CONFIG.startDebt)} 来到深圳，手里还剩 ${yuan(CONFIG.startCash)} 现金。<br>
      · 路上会遇到人和事，怎么选，会影响别人怎么看你（人情）。<br>
      · 点地面走过去，或用 WASD 走动；按住拖动转镜头，滚轮缩放。<br>
      · 按 V 或右下角的按钮，可以在斜俯视和第一人称之间切换。<br>
      · 靠近档口按 E（或直接点它）看货，低买高卖。<br>
      · 每个区的街都不一样；镜头转到哪一侧，那一侧的高楼会自动剖开。<br>
      · 去地铁站打开地图换区，每换一次过一天。<br>
      · 有人会找你下订单：按时把货送到指定的区，价钱比市面高。档口每天还能砍一次价。<br>
      · 欠款每天涨 ${CONFIG.debtRate * 100}%，回罗湖口岸的老乡会才能还。<br>
      · 地图上飘着小道消息：红色是要涨，绿色是要跌。<br>
      · 第 ${CONFIG.days} 天结算：现金 + 存款 − 欠款，没卖掉的货不算。
    </div>
    ${best != null ? `<p style="color:#94a3b8;margin-top:12px">历史最佳：${yuan(best)}</p>` : ''}
    <button class="primary" id="start">开始闯荡</button>
  </div>`;
  $('#screen').hidden = false;
  $('#start').onclick = startGame;
}

function startGame() {
  s = L.newGame();
  log = []; busy = false; scene = null;
  $('#dialog').hidden = true;
  $('#screen').hidden = true;
  $('#travel').hidden = true;
  if (document.activeElement) document.activeElement.blur();
  view.setPlayerAt(s.loc);
  say(`第 1 天，你拖着行李箱走出${D[s.loc].name}的地铁站。`);
  showRumor();
  enterStreet();
  render();
  checkStory();
}

function endGame() {
  const r = L.settle(s);
  const prev = bestScore();
  const isBest = prev == null || r.score > prev;
  if (isBest) saveBest(r.score);
  view.setRumor(null);
  activeSpot = null;
  $('#panel').hidden = true;
  $('#bar').hidden = true;
  $('#viewbtn').hidden = true;
  $('#screen').innerHTML = `<div class="card glass">
    <div class="sub">三十天过去了</div>
    <div class="score ${r.score < 0 ? 'neg' : ''}">${yuan(r.score)}</div>
    <div class="rank">${r.title}</div>
    <p style="color:#cbd5e1">${r.line}</p>
    <div class="epilogue">${epilogue(s).map(t => `<p>${t}</p>`).join('')}</div>
    <p style="color:#94a3b8">${isBest ? '新的最佳成绩！' : '历史最佳：' + yuan(prev)}</p>
    <button class="primary" id="start">再来一局</button>
  </div>`;
  $('#screen').hidden = false;
  $('#start').onclick = startGame;
}

startScreen();
window.__game = { peek(id, x, yaw) { const d = D[id]; view.enterStreet(d, DISTRICTS.indexOf(d), spotsFor(d), x, yaw); }, map() { view.setMode('map'); }, get state() { return s; }, get ui() { return { mode, near: nearSpot && nearSpot.id, active: activeSpot && activeSpot.id, scene: scene && scene.cur }; }, story: checkStory, go, end: endGame }; // 方便调试
