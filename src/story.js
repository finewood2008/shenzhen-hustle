// 剧情：角色、对话场景和结局旁白。和 logic.js 一样不依赖 DOM，可以在 Node 里跑。
//
// 一个场景是一串台词，默认从上往下走：
//   { who, text, mood }            一句话。who 是 CAST 里的 id，'me' 是玩家，'narr' 是旁白
//   { k: 'name' }                  给这句话起名，供 to 跳转
//   { to: 'name' | s => 'name' }   说完这句跳到哪句（不写就接下一句）
//   { end: true }                  说完这句结束
//   { choices: [{ label, ok?, why?, effect?, to? }] }  选项。effect(s) 修改状态并返回结果说明
// text 可以是 s => string。

import { CONFIG } from './content.js';

const yuan = n => '¥' + Math.round(n).toLocaleString('zh-CN');
const favor = (s, n) => { s.favor += n; return `人情 ${n > 0 ? '+' : ''}${n}`; };
const free = s => s.capacity - Object.values(s.inv).reduce((a, b) => a + b.qty, 0);
function give(s, id, qty) {
  const n = Math.min(free(s), qty);
  if (n <= 0) return 0;
  const it = s.inv[id] || (s.inv[id] = { qty: 0, cost: 0 });
  it.qty += n;
  return n;
}

export const CAST = {
  me: { name: '你' },
  narr: { name: '' },
  bing: { name: '炳叔', title: '老乡会会长' },
  jie: { name: '阿杰', title: '刚到深圳的老乡' },
  biao: { name: '阿彪', title: '替人收账的' },
};

export const SCENES = [
  // ---------- 第 1 天：借钱 ----------
  {
    id: 'intro',
    when: s => s.day === 1,
    lines: [
      { who: 'narr', text: '罗湖口岸旁，老乡会的铁皮屋里，一台旧风扇吱呀吱呀地转。' },
      { who: 'bing', text: s => `${yuan(CONFIG.startDebt)}，你点清楚。规矩你知道，一天五个点的利。不是我要赚你的，会里的钱，要对大家有交代。` },
      { who: 'bing', text: '深圳这地方，同一样货，在这头便宜，到那头就贵。腿勤一点，耳朵灵一点，三十天够你翻身了。' },
      { who: 'bing', text: '还钱要回这里来，当面点。别的地方我不认。', choices: [
        { label: '“谢谢炳叔，我一定早点还。”', effect: s => favor(s, 1), to: 'thanks' },
        { label: '“利息能不能少一点？”', to: 'haggle' },
        { label: '“放心，这点钱我很快就不放在眼里了。”', effect: s => favor(s, -1), to: 'brag' },
      ] },
      { k: 'thanks', who: 'bing', mood: 'smile', text: '有这句话就行。去吧，街上的档口都去看看，别急着下手。', to: 'out' },
      { k: 'haggle', who: 'bing', text: '少不了。不过你早一天还清，后面的自然就不用算了。去吧。', to: 'out' },
      { k: 'brag', who: 'bing', mood: 'angry', text: '口气不小。后生仔，先把第一单做成了再说。', to: 'out' },
      { k: 'out', who: 'narr', text: '你拖着行李箱走到街上。走近档口可以看货，去地铁站可以换一个区，每换一次过一天。' },
    ],
  },

  // ---------- 一周后：炳叔来电话 ----------
  {
    id: 'bing_call',
    when: s => s.day >= 7 && s.debt > 0,
    lines: [
      { who: 'narr', text: '手机在裤兜里震个不停。屏幕上两个字：炳叔。' },
      { who: 'bing', text: s => `到深圳一个礼拜了，生意怎么样？账上现在是 ${yuan(s.debt)} 了，你心里要有数。`, choices: [
        { label: '“手上有一点了，先转您一千。”', ok: s => s.cash >= 1000, why: '现金不足 ¥1,000',
          effect: s => { const n = Math.min(1000, s.debt); s.cash -= n; s.debt -= n; return `欠款 -${yuan(n)} · ` + favor(s, 1); }, to: 'pay' },
        { label: '“刚压了货，过几天回罗湖当面还。”', effect: s => { s.flags.promised = true; return ''; }, to: 'later' },
        { label: '“催什么催，又不是不还。”', effect: s => favor(s, -1), to: 'rude' },
      ] },
      { k: 'pay', who: 'bing', mood: 'smile', text: '好。有来有往，我记着。', end: true },
      { k: 'later', who: 'bing', text: '行，我等你。说了的话要算数。', end: true },
      { k: 'rude', who: 'bing', mood: 'angry', text: '我是提醒你，不是求你。', end: true },
    ],
  },

  // ---------- 阿杰借钱 ----------
  {
    id: 'jie_ask',
    when: s => s.day >= 11,
    lines: [
      { who: 'narr', text: '一个背着编织袋的后生在街口东张西望，看见你，小跑着过来。' },
      { who: 'jie', text: '你是……炳叔说的那个老乡吧？我叫阿杰，前天刚到。厂里说下礼拜才能进。' },
      { who: 'jie', mood: 'sad', text: '我身上就剩二十块了。能不能……', choices: [
        { label: '借他 ¥500', ok: s => s.cash >= 500, why: '现金不足 ¥500',
          effect: s => { s.cash -= 500; s.flags.jie = 'lent'; s.flags.jieDay = s.day; return '现金 -¥500 · ' + favor(s, 2); }, to: 'lent' },
        { label: '请他吃碗猪脚饭（¥30）', ok: s => s.cash >= 30, why: '现金不足 ¥30',
          effect: s => { s.cash -= 30; s.flags.jie = 'fed'; s.flags.jieDay = s.day; return '现金 -¥30 · ' + favor(s, 1); }, to: 'fed' },
        { label: '“我自己都还欠着债呢。”', effect: s => favor(s, -1), to: 'no' },
      ] },
      { k: 'lent', who: 'jie', mood: 'smile', text: '我一定还！发了工资第一个还你！', end: true },
      { k: 'fed', who: 'jie', mood: 'smile', text: '谢谢老乡……我好几天没吃过热的了。', end: true },
      { k: 'no', who: 'jie', mood: 'sad', text: '哦……没事没事，我再想想办法。', end: true },
    ],
  },

  // ---------- 阿杰回报 ----------
  {
    id: 'jie_back',
    when: s => s.flags.jie && s.day >= s.flags.jieDay + 6,
    lines: [
      { who: 'jie', mood: 'smile', text: '老乡！可算找到你了。我进了宝安的灯具厂，包吃包住。' },
      { who: 'jie', mood: 'smile', to: 'gift',
        text: s => s.flags.jie === 'lent' ? '这是八百。五百是本，三百是我的心意，你别推。' : '那碗猪脚饭我一直记着。' },
      { k: 'gift', who: 'jie', text: '还有，我们厂这两天清尾货，我给你留了几卷灯带，拿去卖。', choices: [
        { label: '收下', effect: s => {
          const out = [];
          if (s.flags.jie === 'lent') { s.cash += 800; out.push('现金 +¥800'); }
          const n = give(s, 'led', s.flags.jie === 'lent' ? 12 : 6);
          out.push(n ? `LED灯带 +${n}` : '背包满了，灯带没拿');
          out.push(favor(s, 1));
          return out.join(' · ');
        } },
      ] },
      { who: 'narr', text: '他朝你挥挥手，挤进了下班的人潮里。' },
    ],
  },

  // ---------- 拖欠太久：上门催债 ----------
  {
    id: 'bing_pressure',
    when: s => s.day >= 17 && s.debt >= 12000,
    lines: [
      { who: 'narr', text: '刚出地铁口，两个穿黑 T 恤的人一左一右把你夹在中间。' },
      { who: 'biao', text: s => `炳叔让我们来问问。${yuan(s.debt)} 的账，你打算拖到什么时候？`, to: s => (s.flags.promised ? 'promised' : 'ask') },
      { k: 'promised', who: 'biao', mood: 'angry', text: '上回你说“过几天当面还”，炳叔可是一直等着。' },
      { k: 'ask', who: 'biao', text: '今天总得有个说法。', choices: [
        { label: '把身上一半现金交出去抵债', ok: s => s.cash >= 200, why: '身上没什么钱',
          effect: s => { const n = Math.min(Math.floor(s.cash / 2), s.debt); s.cash -= n; s.debt -= n; return `现金 -${yuan(n)} · 欠款 -${yuan(n)}`; }, to: 'paid' },
        { label: '“让我跟炳叔说句话。”', to: s => (s.favor >= 2 ? 'mercy' : 'cold') },
        { label: '转身就跑', effect: s => { s.health = Math.max(1, s.health - 20); return '体力 -20 · ' + favor(s, -1); }, to: 'run' },
      ] },
      { k: 'paid', who: 'biao', text: '算你识相。剩下的，自己去罗湖还。', end: true },
      { k: 'mercy', who: 'narr', text: '阿彪拨通电话，开了免提。那头沉默了一会儿。' },
      { who: 'bing', text: '……算了。这后生做人还可以。利息我免你两成，本金一分不能少。', choices: [
        { label: '“谢谢炳叔。”', effect: s => { const n = Math.floor(s.debt * 0.2); s.debt -= n; return `欠款 -${yuan(n)}`; } },
      ], end: true },
      { k: 'cold', who: 'narr', text: '阿彪拨通电话，开了免提。' },
      { who: 'bing', mood: 'angry', text: '现在想起我来了？', choices: [
        { label: '……', effect: s => { s.health = Math.max(1, s.health - 15); return '体力 -15'; } },
      ] },
      { who: 'narr', text: '电话挂了。你被推到墙上，肩膀撞得生疼。', end: true },
      { k: 'run', who: 'narr', text: '你一口气跑过三个路口才甩掉他们，肺都要炸了。', end: true },
    ],
  },

  // ---------- 还清 ----------
  {
    id: 'bing_clear',
    when: s => s.debt === 0,
    lines: [
      { who: 'bing', text: '账我对过了，清了。', to: s => (s.favor >= 2 ? 'warm' : 'cool') },
      { k: 'warm', who: 'bing', mood: 'smile', text: '你这后生，做事有交代。会里在宝安有间闲着的铁皮仓，你拿去用，不收你钱。', choices: [
        { label: '“谢谢炳叔！”', effect: s => { s.capacity += 30; s.flags.warehouse = true; return '背包容量 +30'; } },
      ], end: true },
      { k: 'cool', who: 'bing', text: '两清了。往后各走各的路。', end: true },
    ],
  },
];

// 找出现在该触发的场景（每个场景一局只触发一次）
export function nextScene(s) {
  if (s.over) return null;
  return SCENES.find(sc => !s.seen[sc.id] && sc.when(s)) || null;
}

// 逐步播放一个场景。界面层调用 current() 显示，next() / choose(i) 推进。
export function play(s, scene) {
  s.seen[scene.id] = true;
  const lines = scene.lines;
  let i = 0, done = false;
  const jump = (line, choice) => {
    let to = choice && choice.to !== undefined ? choice.to : line.to;
    if (typeof to === 'function') to = to(s);
    if (to !== undefined) {
      const j = lines.findIndex(l => l.k === to);
      if (j < 0) throw new Error(`scene ${scene.id}: no line "${to}"`);
      i = j;
    } else if (line.end || i + 1 >= lines.length) done = true;
    else i++;
  };
  return {
    get done() { return done; },
    current() {
      if (done) return null;
      const l = lines[i];
      return {
        who: l.who, mood: l.mood || 'plain',
        text: typeof l.text === 'function' ? l.text(s) : l.text,
        choices: l.choices ? l.choices.map(c => ({ label: c.label, ok: !c.ok || c.ok(s), why: c.why || '' })) : null,
      };
    },
    next() { const l = lines[i]; if (done || l.choices) return false; jump(l); return true; },
    choose(n) {
      const l = lines[i], c = l.choices && l.choices[n];
      if (done || !c || (c.ok && !c.ok(s))) return null;
      const result = (c.effect && c.effect(s)) || '';
      jump(l, c);
      return result;
    },
  };
}

// 结局旁白：看欠款和人情
export function epilogue(s) {
  const out = [];
  if (s.debt === 0) {
    out.push(s.favor >= 3 ? '老乡会年饭那天，炳叔在主桌给你留了个位置。'
      : s.favor >= 0 ? '账清了。逢年过节，炳叔还会给你发一条祝福短信。'
      : '账是清了，老乡会的群里却再没人 @ 过你。');
  } else {
    out.push(s.favor >= 3 ? '炳叔替你在会里担了话，可利息一分也没少算。'
      : '炳叔的人还在到处打听你的下落。');
  }
  if (s.flags.jie === 'lent') out.push('阿杰后来当上了线长，逢人就说起借他五百块的那个老乡。');
  else if (s.flags.jie === 'fed') out.push('阿杰每次路过那家猪脚饭，都会想起你。');
  return out;
}
