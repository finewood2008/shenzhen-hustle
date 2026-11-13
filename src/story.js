// 剧情：角色、对话场景和结局旁白。和 logic.js 一样不依赖 DOM，可以在 Node 里跑。
//
// 一个场景是一串台词，默认从上往下走：
//   { who, text, mood }            一句话。who 是 CAST 里的 id，'me' 是玩家，'narr' 是旁白
//   { k: 'name' }                  给这句话起名，供 to 跳转
//   { to: 'name' | s => 'name' }   说完这句跳到哪句（不写就接下一句）
//   { end: true }                  说完这句结束
//   { effect: s => '说明' }        没有选项的台词也可以带后果，说完这句时生效
//   { choices: [{ label, ok?, why?, effect?, to? }] }  选项。effect(s) 修改状态并返回结果说明
// text 可以是 s => string。

import { CONFIG, GOODS, DISTRICTS } from './content.js';

const GOOD = Object.fromEntries(GOODS.map(g => [g.id, g]));

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

const hp = (s, n) => { s.health = Math.min(100, s.health + n); return `体力 ${n > 0 ? '+' : ''}${n}`; };
// 扣现金，最多扣到 0（事件是到站时抽的，中间的剧情可能已经把钱花掉了）
const pay = (s, n) => { n = Math.min(n, s.cash); s.cash -= n; return `现金 -${yuan(n)}`; };
const unloadPay = s => 300 + (s.day % 4) * 100;
const bigItem = s => Object.keys(s.inv).sort((a, b) => s.inv[b].qty - s.inv[a].qty)[0];

export const CAST = {
  me: { name: '你' },
  narr: { name: '' },
  bing: { name: '炳叔', title: '老乡会会长' },
  jie: { name: '阿杰', title: '刚到深圳的老乡' },
  biao: { name: '阿彪', title: '替人收账的' },
  boss: { name: '档口老板' },
  landlord: { name: '房东阿姨' },
  auntie: { name: '肠粉摊阿姨' },
  officer: { name: '市场协管' },
  passer: { name: '路人' },
  director: { name: '短剧导演' },
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

  // ---------- 规矩线：肠粉阿姨和对面的低价摊 ----------
  {
    id: 'rule_start',
    when: s => s.day >= 4,
    lines: [
      { who: 'narr', text: '街角的肠粉摊前冷冷清清。马路对面新开了一家，门口排着长队，红底黄字写着：三块一碟。' },
      { who: 'auntie', mood: 'sad', text: '后生，你看对面。三块钱，我的米浆钱都不止三块。老客都叫我也降价。' },
      { who: 'auntie', text: '降不了。料减了，味道就不是那个味道了。贵是贵点，但吃了不烧心。', choices: [
        { label: '在阿姨这坐下，照旧来一碟（¥5）', ok: s => s.cash >= 5, why: '现金不足 ¥5',
          effect: s => { s.flags.rule = 'loyal'; s.flags.ruleDay = s.day; return pay(s, 5) + ' · ' + hp(s, 6) + ' · ' + favor(s, 1); }, to: 'loyal' },
        { label: '站到摊前帮她吆喝一阵', effect: s => { s.flags.rule = 'helped'; s.flags.ruleDay = s.day; return hp(s, -3) + ' · ' + favor(s, 2); }, to: 'helped' },
        { label: '“我去对面看看。”（¥3）', ok: s => s.cash >= 3, why: '现金不足 ¥3',
          effect: s => { s.flags.rule = 'cheap'; s.flags.ruleDay = s.day; return pay(s, 3); }, to: 'cheap' },
      ] },
      { k: 'loyal', who: 'auntie', mood: 'smile', text: '好，给你多加个蛋。有人肯坐下来吃，这个摊就立得住。', end: true },
      { k: 'helped', who: 'narr', text: '你扯着嗓子喊了半个钟头：“现磨米浆，现拉现卖！”真有几个人停下来了。' },
      { who: 'auntie', mood: 'smile', text: '你这后生，比我儿子还上心。', end: true },
      { k: 'cheap', who: 'narr', text: '三块钱的肠粉又咸又粘。半夜你被胃里的一团火烧醒，在床上翻到天亮。', effect: s => hp(s, -10) + '（烧心）', end: true },
    ],
  },
  {
    id: 'rule_end',
    when: s => s.flags.rule && s.day >= s.flags.ruleDay + 5,
    lines: [
      { who: 'narr', text: '又路过那个街角。对面的铺子拉着卷闸门，贴了张“旺铺转让”。', to: s => (s.flags.rule === 'cheap' ? 'cheap' : 'good') },
      { k: 'good', who: 'auntie', mood: 'smile', text: '看见没？料差的东西，骗得了一回骗不了三回。老客都回来了。' },
      { who: 'auntie', mood: 'smile', text: '我妈传下来一句话：先把规矩立住，路才越走越宽。这盒你带着，不许给钱。',
        effect: s => (s.flags.rule === 'helped' ? (s.cash += 200, '现金 +¥200（阿姨硬塞的吆喝钱） · ') : '') + hp(s, 15), end: true },
      { k: 'cheap', who: 'auntie', text: '听讲你也去对面吃过？不怪你，三块钱谁不想试试。' },
      { who: 'auntie', mood: 'smile', text: '坐下，这碟不收你钱。吃过烧心的，才晓得什么叫不烧心。', effect: s => hp(s, 8), end: true },
    ],
  },

  // ---------- 彩蛋：酱板鸭寻仇 ----------
  {
    id: 'duck_revenge',
    when: s => s.flags.duckDay && s.day >= s.flags.duckDay + 3,
    lines: [
      { who: 'narr', text: '一个人从人群里走出来，拦在你面前。风吹起他的外套，他的眼神像是等了你三年。' },
      { who: 'passer', mood: 'angry', text: '那只酱板鸭，你还记得吗？' },
      { who: 'me', text: '记得……挺好吃的。' },
      { who: 'passer', mood: 'angry', text: '你吃了鸭，却没有配饭！一只酱板鸭的心意，你只领了一半！' },
      { who: 'narr', text: '他郑重地把一盒白米饭放进你手里，转身消失在晚高峰的人潮中。饭还是热的。', effect: s => hp(s, 5) },
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

// 随机事件：换区时按权重 w 抽一个，can(s) 为假的不参与。可以重复发生。
export const EVENT_SCENES = [
  { id: 'ev_typhoon', w: 3, lines: [
    { who: 'narr', text: '台风的尾巴扫过来，雨大得看不清马路对面。你怀里还抱着货。', choices: [
      { label: '抱着货蹚水走过去', effect: s => hp(s, -15) },
      { label: '咬牙打个车（¥80）', ok: s => s.cash >= 80, why: '现金不足 ¥80', effect: s => { s.cash -= 80; return '现金 -¥80 · ' + hp(s, -3); } },
    ] },
    { who: 'narr', text: '到地方的时候，鞋里能倒出半杯水。' },
  ] },
  { id: 'ev_thief', w: 2, can: s => s.cash >= 200, lines: [
    { who: 'narr', text: '晚高峰的地铁挤得人贴人。出站一摸，裤兜被划开了一道口子。',
      effect: s => { const n = Math.floor(s.cash * 0.1); s.cash -= n; return `现金 -${yuan(n)}`; } },
  ] },
  { id: 'ev_noodle', w: 3, lines: [
    { who: 'auntie', mood: 'smile', text: '后生，看你脸都白了。坐下，阿姨给你拉一碟肠粉，再来碗糖水。' },
    { who: 'auntie', text: '出来闯，钱要赚，饭也要吃。这碟算阿姨的。', effect: s => hp(s, 12) },
  ] },
  { id: 'ev_unload', w: 3, lines: [
    { who: 'boss', text: s => `靓仔！我这来了一车货，伙计又请假。搭把手卸一下，给你 ${yuan(unloadPay(s))}。`, choices: [
      { label: '“行，我来。”', effect: s => { const n = unloadPay(s); s.cash += n; return `现金 +${yuan(n)} · ` + hp(s, -4); }, to: 'yes' },
      { label: '“赶时间，下次吧。”', to: 'no' },
    ] },
    { k: 'yes', who: 'boss', mood: 'smile', text: '手脚够快。以后缺人我还找你。', end: true },
    { k: 'no', who: 'boss', text: '行吧行吧，我自己来。', end: true },
  ] },
  { id: 'ev_rent', w: 2, can: s => s.cash >= 300, lines: [
    { who: 'landlord', text: '哎，正找你呢。下个月起每间涨三百，差价先补一下。', choices: [
      { label: '掏钱补上（¥300）', effect: s => pay(s, 300), to: 'pay' },
      { label: '“阿姨，我才来几天，通融一下？”', to: s => (s.favor >= 1 ? 'soft' : 'hard') },
    ] },
    { k: 'pay', who: 'landlord', mood: 'smile', text: '爽快。楼顶可以晒被子，钥匙在我这。', end: true },
    { k: 'soft', who: 'landlord', text: '……听炳叔讲过你，说人还实在。行，先收你一半。', effect: s => pay(s, 150), end: true },
    { k: 'hard', who: 'landlord', mood: 'angry', text: '个个都叫我通融，我找谁通融去？三百，一分不少。', effect: s => pay(s, 300), end: true },
  ] },
  { id: 'ev_check', w: 2, can: s => Object.keys(s.inv).length > 0, lines: [
    { who: 'officer', text: '市场抽检。你这批货的进货票据，拿出来看一下。' },
    { who: 'me', text: '票据……老板说回头补给我。' },
    { who: 'officer', text: s => `没有票据的，${GOOD[bigItem(s)].name}先暂扣一部分，补了票再来领。`,
      effect: s => {
        const id = bigItem(s), it = s.inv[id], n = Math.max(1, Math.floor(it.qty * 0.3));
        it.cost -= Math.round(it.cost * n / it.qty); it.qty -= n; if (it.bad) it.bad = Math.min(it.bad, it.qty);
        if (it.qty <= 0) delete s.inv[id];
        return `${GOOD[id].name} -${n}`;
      } },
  ] },
  { id: 'ev_sample', w: 2, can: s => free(s) >= 3, lines: [
    { who: 'narr', text: '路过会展中心，一个参展商正往纸箱里收样品。' },
    { who: 'narr', text: '“带不回去了，你要就拿走。”他把一袋东西塞到你手里。',
      effect: s => { const id = ['led', 'powerbank', 'earbuds'][s.day % 3]; return `${GOOD[id].name} +${give(s, id, 3 + (s.day % 5))}`; } },
  ] },
  { id: 'ev_ebike', w: 2, can: s => s.cash >= 200, lines: [
    { who: 'officer', mood: 'angry', text: '电单车不能进这条路，牌子那么大没看见？罚款两百，车先扣下。',
      effect: s => pay(s, 200) + ' · ' + hp(s, -5) },
    { who: 'narr', text: '剩下的路，你扛着货走完了。' },
  ] },
  { id: 'ev_hill', w: 2, lines: [
    { who: 'narr', text: '天还没亮透，你跟着晨练的阿伯阿婆爬了趟莲花山。山顶的风一吹，整个人都松了。', effect: s => hp(s, 8) },
  ] },
  { id: 'ev_night', w: 2, lines: [
    { who: 'boss', text: '今晚有一批货要通宵打包发走，四百块，干不干？', choices: [
      { label: '“干。”', effect: s => { s.cash += 400; return '现金 +¥400 · ' + hp(s, -10); }, to: 'yes' },
      { label: '“我得睡觉。”', to: 'no' },
    ] },
    { k: 'yes', who: 'narr', text: '天亮的时候，你靠着纸箱堆睡着了，手里还攥着封箱胶带。', end: true },
    { k: 'no', who: 'boss', text: '也是，身体要紧。', end: true },
  ] },
];
EVENT_SCENES.push({ id: 'ev_shortdrama', w: 2, lines: [
  { who: 'narr', text: '街边支着三脚架和一台笔记本，几个年轻人围着一个空摊位，在拍“AI 市井短剧”。' },
  { who: 'director', text: '靓仔！缺个群演。画面是 AI 生成的，可人脸它老崩，得拍个真人垫一下。站摊前说一句词，两百块。', choices: [
    { label: '“行，什么词？”', to: 'yes' },
    { label: '“我赶着拿货。”', to: 'no' },
  ] },
  { k: 'yes', who: 'director', text: '就一句：“贵是贵点，但吃了不烧心。”要说出信念感。这不是在卖货，而是在卖一种……算了，你直接说。' },
  { who: 'me', text: '贵是贵点，但吃了不烧心。' },
  { who: 'director', mood: 'smile', text: '过！AI 生成了四十遍都没你这个味儿。', effect: s => { s.cash += 200; return '现金 +¥200'; }, end: true },
  { k: 'no', who: 'director', text: '行吧，那我们再让 AI 崩几遍。', end: true },
] });
for (const e of EVENT_SCENES) e.event = true;

// 有人找你下订单时的对话（订单内容在 s.offer 里，由 logic.js 生成）
const OFFER_SCENE = {
  id: 'offer', offer: true,
  lines: [
    { who: 'boss', text: s => {
        const o = s.offer, name = DISTRICTS.find(d => d.id === o.to).name;
        return `靓仔，有个老客要 ${o.qty} 件${GOOD[o.good].name}，${name}那边收，最晚第 ${o.deadline} 天送到。每件给 ${yuan(o.pay)}，一共 ${yuan(o.pay * o.qty)}。接不接？`;
      }, choices: [
      { label: '“接。”', effect: s => { const o = s.offer; s.orders.push(o); s.offer = null; return `接下订单：${GOOD[o.good].name} ×${o.qty}`; }, to: 'yes' },
      { label: '“这单接不了。”', effect: s => { s.offer = null; return ''; }, to: 'no' },
    ] },
    { k: 'yes', who: 'boss', mood: 'smile', text: '爽快！货带到了那边，自然有人找你收。别误了日子，误了大家都难做。', end: true },
    { k: 'no', who: 'boss', text: '行，那我问问别人。', end: true },
  ],
};

// ---------- 路人 ----------
// 街上有 WALKERS 个路人。每天每个区里：一个消息灵通的（tip），多半还有一个有事相求的（ask），其余是闲聊（chat）。
// 用天数和区算出来，不消耗随机数，所以同一天回头看还是同一个人。
export const WALKERS = 12;
const mix = (a, b, c = 0) => { let h = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791); h = Math.imul(h ^ (h >>> 13), 0x5bd1e995); return (h ^ (h >>> 15)) >>> 0; };
const locIdx = s => DISTRICTS.findIndex(d => d.id === s.loc);
export function walkerKind(s, i) {
  if (s.talked[i]) return 'done';
  const h = mix(s.day, locIdx(s)), tip = h % WALKERS, ask = (tip + 1 + (h >>> 8) % (WALKERS - 1)) % WALKERS;
  if (i === tip && s.day < CONFIG.days) return 'tip';
  if (i === ask && (h >>> 4) % 10 < 7) return 'ask';
  return 'chat';
}

const SMALL_TALK = {
  huaqiangbei: ['别在一楼买，上三楼同样的货便宜一截。', '以前这里一米柜台能养活一家人，现在都搬到网上去了。', '修手机？往里走第二家，手艺最老。'],
  futian: ['这边的楼，灯是通宵不灭的。', '中午别来这吃饭，一碗面三十八。', '刚面完试，也不知道有没有戏。'],
  luohu: ['过关的队今天排到天桥上去了。', '以前带货的都从这走，热闹得很。', '火车站那头的肠粉，三十年没变过味。'],
  dongmen: ['东门的东西，开口先砍一半。', '我小时候这还是骑楼老街，现在全是奶茶店。', '周末别来，人挤人。'],
  keji: ['我在养龙虾。不是吃的那种，是会自己上网干活的那种。', '刚下班。哦不对，是刚吃完饭回去加班。', '这栋楼的灯，凌晨两点还亮着一大半。', '我们组上个月刚发了新品，卖疯了。'],
  shekou: ['晚上海边风大，记得多带件衣服。', '这一片老外多，东西卖得上价。', '以前这是码头，我爸就在这卸过货。'],
  baoan: ['厂里又招人了，包吃包住。', '今天总算不用加班。', '我们那条线一天要出两万个灯。'],
  longhua: ['这的房租又涨了，握手楼都要一千五了。', '楼下那家隆江猪脚饭，深夜两点还开着。', '搬来三年，还没见过对门邻居长什么样。'],
  dafen: ['一幅《向日葵》，我师傅一天能画八张。', '现在都画原创了，临摹不好卖。', '画框比画还贵，你信不信。'],
  yantian: ['今天又到了三条大船。', '码头不等人，货到了就得拉走。', '海鲜街往东走，晚上才热闹。'],
};
const COMMON_TALK = ['昨晚刷 AI 短剧刷到两点，全是摆摊立规矩的。', '那家店贵是贵点，但是不烧心，你懂我意思吧。', '深圳这天气，说下雨就下雨。', '来了就是深圳人嘛。', '时间就是金钱，我先走了啊。', '你也是做生意的？看着就像。'];

// 明天最值得跑一趟的行情（不重复地图上已有的那条小道消息）
function bestTip(s) {
  let best = null;
  for (const d of DISTRICTS) {
    if (d.id === s.loc) continue;
    for (const g of GOODS) {
      const p = s.forecast[d.id][g.id];
      if (!p || (s.rumor.district === d.id && s.rumor.good === g.id)) continue;
      const k = (p - g.min) / (g.max - g.min), score = Math.abs(k - 0.5) * Math.sqrt(g.max);
      if (!best || score > best.score) best = { score, d, g, cheap: k < 0.5 };
    }
  }
  return best;
}

const ASKS = [
  [ { who: 'passer', text: '不好意思，请问地铁站往哪边走？我转了两圈了。', choices: [
      { label: '停下来仔细指给他', effect: s => favor(s, 1), to: 'y' }, { label: '“我也不熟。”', to: 'n' } ] },
    { k: 'y', who: 'passer', mood: 'smile', text: '太谢谢了！深圳人真热心。', end: true },
    { k: 'n', who: 'passer', text: '哦，好，那我再问问别人。', end: true } ],
  [ { who: 'passer', mood: 'sad', text: '手机没电了……能不能借你的打个电话？我跟家里说一声就还你。', choices: [
      { label: '把手机递过去', effect: s => favor(s, 1), to: 'y' }, { label: '“不太方便。”', to: 'n' } ] },
    { k: 'y', who: 'passer', mood: 'smile', text: '“妈，我到了，都好，别担心。”……谢谢你啊，真的。', end: true },
    { k: 'n', who: 'passer', text: '没事没事，理解。', end: true } ],
  [ { who: 'passer', text: '老板跑路了，工资拿货抵的。这三副蓝牙耳机，一百五你全拿走，行不行？', choices: [
      { label: '买下（¥150）', ok: s => s.cash >= 150 && free(s) >= 3, why: '钱或背包不够', effect: s => { s.cash -= 150; return '现金 -¥150 · 蓝牙耳机 +' + give(s, 'earbuds', 3); }, to: 'y' },
      { label: '“不要，谢谢。”', to: 'n' } ] },
    { k: 'y', who: 'passer', mood: 'smile', text: '谢了，总算能凑够回家的车票。', end: true },
    { k: 'n', who: 'passer', mood: 'sad', text: '唉，行吧。', end: true } ],
  [ { who: 'passer', text: '帮我把这沓传单发完行吗？给你五十。我赶着去面试，真来不及了。', choices: [
      { label: '接过传单', effect: s => { s.cash += 50; return '现金 +¥50 · ' + hp(s, -3); }, to: 'y' }, { label: '“我也赶时间。”', to: 'n' } ] },
    { k: 'y', who: 'passer', mood: 'smile', text: '救命了！祝你发财！', end: true },
    { k: 'n', who: 'passer', text: '好吧，我边跑边发。', end: true } ],
  [ { who: 'passer', text: '我们在给山区小学募书。十块二十块都行，一本书的钱。', choices: [
      { label: '捐 ¥20', ok: s => s.cash >= 20, why: '现金不足 ¥20', effect: s => { s.cash -= 20; return '现金 -¥20 · ' + favor(s, 1); }, to: 'y' },
      { label: '摆摆手走开', to: 'n' } ] },
    { k: 'y', who: 'passer', mood: 'smile', text: '谢谢！这是收据，书上会写你的名字。', end: true },
    { k: 'n', who: 'passer', text: '没关系，打扰了。', end: true } ],
  [ { who: 'passer', text: '这个充电宝我用不上了，才拆封的。五十块，两个都给你。', choices: [
      { label: '买下（¥50）', ok: s => s.cash >= 50 && free(s) >= 2, why: '钱或背包不够', effect: s => { s.cash -= 50; return '现金 -¥50 · 充电宝 +' + give(s, 'powerbank', 2); }, to: 'y' },
      { label: '“不用了。”', to: 'n' } ] },
    { k: 'y', who: 'passer', mood: 'smile', text: '爽快，拿好。', end: true },
    { k: 'n', who: 'passer', text: '行，那我挂网上卖。', end: true } ],
];

ASKS.push([
  { who: 'passer', mood: 'sad', text: '哎呀！电单车倒了，货撒了一地。搭把手行不行？', choices: [
    { label: '蹲下帮他一件件捡起来', effect: s => { if (!s.flags.duckDay) s.flags.duckDay = s.day; return favor(s, 1); }, to: 'y' },
    { label: '绕过去', to: 'n' } ] },
  { k: 'y', who: 'passer', mood: 'smile', text: '好人啊！我没什么谢你的，这只酱板鸭你拿着，我老家带来的。', effect: s => hp(s, 5) + '（当晚加了个菜）', end: true },
  { k: 'n', who: 'passer', text: '唉，现在的人……', end: true },
]);
const LOBSTER = [
  { who: 'passer', text: '帮我看五分钟电脑行吗？我养的“龙虾”在跑，就是个智能体。你盯着别让它乱点就行。', choices: [
    { label: '“行，我看着。”', to: 'y' }, { label: '“我不懂这个。”', to: 'n' } ] },
  { k: 'y', who: 'narr', text: '你盯着屏幕。“龙虾”很有礼貌地问你最近在买什么，然后自己跟三家店砍了价，替你退回来一笔差价。', effect: s => { s.cash += 66; return '现金 +¥66'; } },
  { who: 'passer', mood: 'smile', text: '回来了！咦，它怎么还帮你薅了个羊毛……算了，说明规矩我给它立得还行。', end: true },
  { k: 'n', who: 'passer', text: '没事，我把它拴桌腿上。', end: true },
];

// 烧心货：走到档口时老板压低声音问你要不要（内容在 s.shady 里，由 logic.js 生成）
export function shadyScene(s) {
  const name = GOOD[s.shady.good].name;
  return { id: 'shady', offer: true, lines: [
    { who: 'boss', text: `（压低声音）靓仔，我这有一批${name}，来路你别问，七折给你。转手能不能出掉，看你运气。`, choices: [
      { label: '“我只拿正路货。”', effect: s => { s.shady.state = 'refused'; return favor(s, 1); }, to: 'no' },
      { label: '“七折？拿来看看。”', effect: s => { s.shady.state = 'open'; return `今天这里的${name}按七折进，但都是烧心货`; }, to: 'yes' },
    ] },
    { k: 'no', who: 'boss', mood: 'smile', text: '行，有规矩。那批货我也不想碰，是别人硬压给我的。', end: true },
    { k: 'yes', who: 'boss', text: '丑话说前头：被人验出来退货，我可不认账。', end: true },
  ] };
}

// 和第 i 个路人说话时播放的场景；今天已经聊过就返回 null
export function walkerScene(s, i) {
  const kind = walkerKind(s, i);
  if (kind === 'done' || s.over) return null;
  const h = mix(s.day, locIdx(s), i + 1);
  let lines;
  if (kind === 'tip') {
    const t = bestTip(s);
    lines = t ? [
      { who: 'passer', text: '你是跑货的吧？看你背着包就知道。' },
      { who: 'passer', mood: 'smile', text: `跟你说个事，${t.d.name}那边，明天${t.g.name}${t.cheap ? '有人清仓，便宜得很' : '有人高价收，缺得厉害'}。信不信由你。`,
        effect: () => `线索：明天${t.d.name}的${t.g.name}${t.cheap ? '便宜' : '走俏'}` },
    ] : [{ who: 'passer', text: '最近行情平平，没什么可说的。' }];
  } else if (kind === 'ask') {
    lines = s.loc === 'keji' && h % 2 ? LOBSTER : ASKS[h % ASKS.length];
  } else {
    const pool = (SMALL_TALK[s.loc] || []).concat(COMMON_TALK);
    lines = [{ who: 'passer', text: pool[h % pool.length] }];
  }
  return { id: 'walker', walker: i, kind, lines };
}

// 找出现在该触发的场景：先是主线（每个一局只触发一次），再是这次换区抽到的随机事件
export function nextScene(s) {
  if (s.over) return null;
  return SCENES.find(sc => !s.seen[sc.id] && sc.when(s))
    || (s.pendingEvent && EVENT_SCENES.find(e => e.id === s.pendingEvent))
    || (s.offer ? OFFER_SCENE : null);
}

// 逐步播放一个场景。界面层调用 current() 显示，next() / choose(i) 推进。
export function play(s, scene) {
  if (scene.event) s.pendingEvent = null;
  else if (scene.walker != null) s.talked[scene.walker] = true;
  else if (!scene.offer) s.seen[scene.id] = true;
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
    // 返回这句台词的后果说明（没有就是空字符串）；不能前进时返回 false
    next() {
      const l = lines[i];
      if (done || l.choices) return false;
      const result = (l.effect && l.effect(s)) || '';
      jump(l);
      return result;
    },
    choose(n) {
      const l = lines[i], c = l.choices && l.choices[n];
      if (done || !c || (c.ok && !c.ok(s))) return null;
      const result = (c.effect && c.effect(s)) || '';
      jump(l, c);
      return result;
    },
  };
}

// 结算时的总结：把这一局做过的事写成几段话
export function summary(s, score, name) {
  const st = s.stats || {}, out = [];
  out.push(`第 1 天，${name}拖着一个行李箱走出罗湖口岸，口袋里是老乡会借来的 ${yuan(CONFIG.startDebt)}。`);
  const deals = (st.buys || 0) + (st.sells || 0);
  let mid = deals ? `三十天里，做了 ${deals} 笔买卖` : '三十天里，一笔买卖也没做成';
  if (st.delivered) mid += `，送成了 ${st.delivered} 张订单`;
  if (st.haggleWin) mid += `，砍价赢了 ${st.haggleWin} 回`;
  out.push(mid + `。手头最阔的时候，有 ${yuan(st.peak || s.cash)}。`);
  const bumps = [];
  if (st.caught) bumps.push(`碰过烧心货，被人当场退了 ${st.caught} 回，长了记性`);
  if (st.expired) bumps.push(`有 ${st.expired} 张订单没赶上，欠着人家一句对不起`);
  if (bumps.length) out.push(bumps.join('；') + '。');
  out.push(score < 0 ? '第三十天一结账，账面是负的。钱没留住，路倒是跑熟了。'
    : score < 50000 ? '第三十天一结账，有了点结余。不多，但每一块都是自己跑出来的。'
    : score < 1500000 ? '第三十天一结账，数字后面的零多得要数两遍。在这座城市，算是站住了。'
    : '第三十天一结账，连档口老板都来打听你是怎么做到的。');
  return out;
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
  if (s.flags.rule === 'loyal' || s.flags.rule === 'helped') out.push('肠粉摊阿姨的队又排到了街角，她说你来了不用排。');
  const net = s.cash + s.bank - s.debt;
  if (s.favor >= 4) out.push('规矩立住了，路是越走越宽。这座城市里，肯替你说话的人不少。');
  else if (s.favor < 0 && net > 0) out.push('钱是挣到了，就是夜里想起来，有点烧心。');
  if (s.flags.jie === 'lent') out.push('阿杰后来当上了线长，逢人就说起借他五百块的那个老乡。');
  else if (s.flags.jie === 'fed') out.push('阿杰每次路过那家猪脚饭，都会想起你。');
  return out;
}
