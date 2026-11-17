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
  me: { name: '潘潘' },
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
  // 各区插曲里的人物
  wen: { name: '小雯', title: '跑口岸的姑娘' },
  lan: { name: '阿兰', title: '足浴店技师' },
  guang: { name: '光头佬' },
  chen: { name: '陈总', title: '硬件公司创始人' },
  xiaok: { name: '小K', title: 'AI 创业者' },
  zhou: { name: '老周', title: '华强北老档主' },
  hongyi: { name: '红姨', title: '相亲角热心人' },
  lin: { name: '林小姐', title: '福田白领' },
  kevin: { name: 'Kevin', title: '理财经理' },
  amu: { name: '阿木', title: '街头歌手' },
  mike: { name: 'Mike', title: '蛇口的英语老师' },
  huang: { name: '黄厂长' },
  fang: { name: '小芳', title: '流水线女工' },
  haige: { name: '海哥', title: '三和大神' },
  fan: { name: '阿梵', title: '大芬村画师' },
  zhang: { name: '老张', title: '跑船的海员' },
};

export const SCENES = [
  // ---------- 第 1 天：借钱 ----------
  {
    id: 'intro',
    when: s => s.day === 1,
    lines: [
      { who: 'narr', text: '罗湖口岸旁，老乡会的铁皮屋里，一台旧风扇吱呀吱呀地转。' },
      { who: 'bing', text: s => `${yuan(CONFIG.startDebt)}，你点清楚。规矩你知道，一天四个点的利。不是我要赚你的，会里的钱，要对大家有交代。` },
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
    when: s => s.day >= 17 && s.debt >= 10000,
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

// ---------- 各区插曲 ----------
// 到了某个区才会触发的小故事，几段连着讲，隔几天再续。只动一点钱、体力、人情，不改主线。
// 一天最多一段插曲；flags 里记着每条线走到哪一步、上次是哪天。
// at: 'landmark' 表示走到本区地标跟前互动时才触发；不写就是一到这个区就触发
function episode(id, loc, when, lines, at = null) {
  const first = lines[0], fx = first.effect;
  return {
    id, episode: loc, at,
    when: s => s.loc === loc && s.flags.epDay !== s.day && when(s),
    lines: [{ ...first, effect: st => { st.flags.epDay = st.day; return fx ? fx(st) : ''; } }, ...lines.slice(1)],
  };
}
const since = (s, key, n) => s.day - (s.flags[key] || 0) >= n;
const mark = (s, key, val) => { s.flags[key] = val; s.flags[key + 'Day'] = s.day; return ''; };
const tipText = s => {
  const t = bestTip(s);
  return t ? `明天${t.d.name}的${t.g.name}，${t.cheap ? '会便宜一截，可以去收' : '会涨一截，手上有就拿去卖'}。` : '最近行情乱，手上的货先别急着出。';
};

// 插曲里的买卖：按指定单价进货 / 出货（不走档口，不算砍价）
function buyAt(s, id, qty, unit) {
  const n = Math.min(free(s), qty, Math.floor(s.cash / Math.max(1, unit)));
  if (n <= 0) return 0;
  s.cash -= n * unit;
  const it = s.inv[id] || (s.inv[id] = { qty: 0, cost: 0 });
  it.qty += n; it.cost += n * unit;
  return n;
}
function sellAt(s, id, qty, unit) {
  const it = s.inv[id];
  const n = it ? Math.min(it.qty, qty) : 0;
  if (n <= 0) return 0;
  s.cash += n * unit;
  it.cost -= Math.round(it.cost * n / it.qty); it.qty -= n;
  if (it.qty <= 0) delete s.inv[id];
  return n;
}
const has = (s, id) => (s.inv[id] ? s.inv[id].qty : 0);
const priceOf = (s, id) => (s.market && s.market[id]) || Math.round((GOOD[id].min + GOOD[id].max) / 2);
// 插曲里的运气：由开局种子和天数决定，同一局重玩结果一样
const luck = (s, salt) => ((((s.rng | 0) ^ Math.imul(s.day + 1, 2654435761) ^ Math.imul(salt, 40503)) >>> 0) % 1000) / 1000;

const EPISODES = [
  // ===== 罗湖·口岸边的小雯 =====
  episode('wen_1', 'luohu', s => s.day >= 3 && !s.flags.wen, [
    { who: 'narr', text: '你走到口岸联检楼门口。出关的扶梯上，一个姑娘拖着两个比她还宽的行李箱，一个轮子卡在了梯级里，后面的人开始骂。' },
    { who: 'wen', mood: 'sad', text: '不好意思不好意思……马上好，马上好！', choices: [
      { label: '过去帮她把箱子抬上来', effect: s => { mark(s, 'wen', 1); return hp(s, -3); }, to: 'help' },
      { label: '绕开走，别惹麻烦', effect: s => mark(s, 'wen', 'no'), to: 'skip' },
    ] },
    { k: 'help', who: 'narr', text: '箱子沉得出奇。你憋着气把它扛上平台，里面哗啦响了一声，像是一整箱玻璃瓶。' },
    { who: 'wen', mood: 'smile', text: '谢谢你啊！我叫小雯，天天在这条线上来回跑，帮人从香港带奶粉、面霜。你别看我小小只，一天过三趟关。' },
    { who: 'wen', text: s => `你也是做生意的吧？看你那个包就知道。请你喝水太俗了，送你一句：${tipText(s)}` },
    { who: 'me', text: '这你都知道？' },
    { who: 'wen', mood: 'smile', text: '在口岸混的，耳朵比眼睛灵。下次见到我，记得打招呼！', effect: s => favor(s, 1), end: true },
    { k: 'skip', who: 'narr', text: '你从旁边挤了过去。身后传来一句带着哭腔的“对不起”，很快被人群的声音盖住了。', end: true },
  ], 'landmark'),
  episode('wen_2', 'luohu', s => s.flags.wen === 1 && since(s, 'wenDay', 3), [
    { who: 'narr', text: '你刚走到联检楼门口，突然下起大雨。屋檐底下挤满了避雨的人，你一眼就看到了那两个大箱子。' },
    { who: 'wen', mood: 'smile', text: '又是你！走，我请你吃糖水，旁边那家双皮奶是罗湖最好吃的，没有之一。' },
    { who: 'narr', text: '糖水铺里，她一边吹着热气一边算账：一罐奶粉赚十五块，一天三趟，刨掉车费，一个月能攒四千。' },
    { who: 'wen', mood: 'sad', text: '上个月被海关扣过一次，整箱没收，白跑半个月。我妈让我回潮汕嫁人，我不想。我想在深圳开个小店，自己当老板，不用天天提心吊胆过关。', choices: [
      { label: '“你一定能开成。缺什么跟我说。”', effect: s => { mark(s, 'wen', 2); s.flags.wenPath = 'shop'; return favor(s, 1); }, to: 'shop' },
      { label: '“要不你的货我包了，省得你到处找下家。”', effect: s => { mark(s, 'wen', 2); s.flags.wenPath = 'deal'; const n = give(s, 'milk', 8); return n ? `进口奶粉 +${n}（她按成本给你）· ${pay(s, n * 120)}` : '背包满了，她说下次再给你留。'; }, to: 'deal' },
      { label: '“跑水货终究不是长久之计。”', effect: s => mark(s, 'wen', 2), to: 'cold' },
    ] },
    { k: 'shop', who: 'wen', mood: 'smile', text: '你是第一个不劝我回家的人。这碗我请，下碗你请！', end: true },
    { k: 'deal', who: 'wen', mood: 'smile', text: '爽快！我按进价给你，你别出去乱说啊。', end: true },
    { k: 'cold', who: 'wen', text: '……我知道。可除了这个，我现在也不会别的。', end: true },
  ], 'landmark'),
  episode('wen_3', 'luohu', s => s.flags.wen === 2 && since(s, 'wenDay', 3) && s.day >= 12, [
    { who: 'narr', text: '联检楼门口拉起了警戒线，今天严查。你正想绕开，电话响了，是小雯，声音在发抖。' },
    { who: 'wen', mood: 'sad', text: '我在口岸里面……今天严查，我被拦下来了，货全扣了，还要交罚款，不交今晚走不了。我身上就剩两百块……你能不能先借我两千？我一定还你。', choices: [
      { label: '马上转两千给她', ok: s => s.cash >= 2000, why: '现金不足 ¥2,000', effect: s => { mark(s, 'wen', 3); s.flags.wenLent = 2000; return pay(s, 2000) + ' · ' + favor(s, 2); }, to: 'lent' },
      { label: '先转五百，剩下的让她找朋友', ok: s => s.cash >= 500, why: '现金不足 ¥500', effect: s => { mark(s, 'wen', 3); s.flags.wenLent = 500; return pay(s, 500) + ' · ' + favor(s, 1); }, to: 'half' },
      { label: '“我手头也紧，实在帮不了。”', effect: s => mark(s, 'wen', 'gone'), to: 'no' },
    ] },
    { k: 'lent', who: 'wen', mood: 'sad', text: '……谢谢你。真的。我出来第一件事就是去找你。', end: true },
    { k: 'half', who: 'wen', text: '够了够了，我再找姐妹凑凑。谢谢你。', end: true },
    { k: 'no', who: 'wen', mood: 'sad', text: '嗯，没事……打扰你了。', effect: s => favor(s, -1), end: true },
  ], 'landmark'),
  episode('wen_4', 'luohu', s => s.flags.wen === 3 && since(s, 'wenDay', 3) && s.day >= 18, [
    { who: 'narr', text: '联检楼前的广场上，小雯没有拖箱子。她穿了条新裙子，手里拿着一个信封，远远地朝你挥手。' },
    { who: 'wen', mood: 'smile', text: s => `还你的，${yuan(s.flags.wenLent || 0)}，一分不少，外加一点利息——你别跟炳叔学，我这是心意。`,
      effect: s => { const n = Math.round((s.flags.wenLent || 0) * 1.2); s.cash += n; return `现金 +${yuan(n)}`; } },
    { who: 'wen', text: '我不跑水货了。东门有个档口要转让，我凑够了首付。下个月开张，卖港货，正正经经开票的那种。' },
    { who: 'wen', mood: 'smile', text: '开张那天……你会来吗？', choices: [
      { label: '“一定来，我还要当你第一个客人。”', effect: s => { mark(s, 'wen', 'together'); return favor(s, 1); }, to: 'yes' },
      { label: '“恭喜你。以后就是小雯老板了。”', effect: s => mark(s, 'wen', 'friend'), to: 'friend' },
    ] },
    { k: 'yes', who: 'wen', mood: 'smile', text: '那说定了！不来的话，我就天天去你档口门口放鞭炮。', end: true },
    { k: 'friend', who: 'wen', mood: 'smile', text: '嗯！以后进货找我，给你最低价。', end: true },
  ], 'landmark'),

  // ===== 罗湖·足浴店的阿兰 =====
  episode('lan_1', 'luohu', s => s.day >= 3 && s.health <= 80 && !s.flags.lan, [
    { who: 'narr', text: '你的腿像灌了铅。巷子口一块灯箱一闪一闪：“沐足 68 元，送凉茶”。' },
    { who: 'narr', text: '要不要进去歇歇脚？', choices: [
      { label: '进去泡个脚（¥68）', ok: s => s.cash >= 68, why: '现金不足 ¥68', effect: s => { mark(s, 'lan', 1); return pay(s, 68) + ' · ' + hp(s, 25); }, to: 'in' },
      { label: '省点钱，继续赶路', to: 'out' },
    ] },
    { k: 'in', who: 'lan', mood: 'smile', text: '老板第一次来吧？水温合适不？我叫阿兰，湖南邵阳的。你这脚底板，一看就是一天走了两万步。' },
    { who: 'lan', text: '我在这干了三年了。女儿在老家跟她外婆，今年上一年级。等我攒够钱，就把她接过来，在深圳读书。' },
    { who: 'lan', mood: 'smile', text: '你别笑我啊，我手机里全是她的照片。你看，这个缺门牙的就是她。', choices: [
      { label: '“真可爱。给她买点糖。”（小费 ¥50）', ok: s => s.cash >= 50, why: '现金不足 ¥50', effect: s => pay(s, 50) + ' · ' + favor(s, 1), to: 'tip' },
      { label: '“接过来好，孩子跟着妈最好。”', to: 'talk' },
    ] },
    { k: 'tip', who: 'lan', mood: 'smile', text: '哎呀，这怎么好意思……那我替她谢谢叔叔！', end: true },
    { k: 'talk', who: 'lan', mood: 'smile', text: '是吧！我也这么想。下次累了再来，给你多按十分钟。', end: true },
    { k: 'out', who: 'narr', text: '你咬咬牙走了过去。凉茶的味道在身后飘了很远。', end: true },
  ]),
  episode('lan_2', 'luohu', s => s.flags.lan === 1 && since(s, 'lanDay', 2), [
    { who: 'narr', text: '足浴店门口吵成一团。老板娘叉着腰，把一沓钱拍在桌上又收了回去。' },
    { who: 'lan', mood: 'sad', text: '我没有得罪客人！那天下午我就接了一个客人，就是……就是你啊！你还给了小费的！' },
    { who: 'narr', text: '老板娘说有人投诉阿兰“态度不好”，要扣她八百块。可那天下午，店里确实只有你一个客人。', choices: [
      { label: '站出来：“那天的客人就是我，我没投诉。”', effect: s => { mark(s, 'lan', 2); s.flags.lanHelped = true; return favor(s, 2); }, to: 'stand' },
      { label: '别掺和别人店里的事', effect: s => mark(s, 'lan', 2), to: 'leave' },
    ] },
    { k: 'stand', who: 'narr', text: '老板娘的脸红一阵白一阵，嘟囔着“搞错了搞错了”，把八百块塞回了阿兰手里。' },
    { who: 'lan', mood: 'smile', text: '你……谢谢你。这是我自己做的剁辣椒，带上，下饭的。走那么多路，要吃饱。', effect: s => hp(s, 10), end: true },
    { k: 'leave', who: 'narr', text: '你低头走开了。身后，阿兰没再争，只是蹲在门口数着剩下的钱。', effect: s => favor(s, -1), end: true },
  ]),
  episode('lan_3', 'luohu', s => s.flags.lan === 2 && s.flags.lanHelped && since(s, 'lanDay', 2) && s.cash >= 1500, [
    { who: 'narr', text: '一个光头男人挡住了你的路，脖子上的金链子比阿彪的还粗。' },
    { who: 'guang', mood: 'smile', text: '兄弟，阿兰让我来找你的。她说上次的事要好好谢谢你，在楼上开了间房，请你上去坐坐，喝两杯。', choices: [
      { label: '跟他上楼看看', effect: s => { const n = Math.min(3000, Math.round(s.cash * 0.4)); mark(s, 'lan', 'trap'); return '你上了当，被“讲数”讹走了 ' + pay(s, n).replace('现金 -', ''); }, to: 'trap' },
      { label: '当着他的面给阿兰打电话', effect: s => { mark(s, 'lan', 3); return favor(s, 1); }, to: 'call' },
      { label: '“不用了，我还有事。”', effect: s => mark(s, 'lan', 3), to: 'walk' },
    ] },
    { k: 'trap', who: 'narr', text: '房间里还有两个人。他们说你“欺负了他们的人”，不赔钱别想走。你掏光了身上的现金才脱身。阿兰后来红着眼说，她根本不认识那个光头。', end: true },
    { k: 'call', who: 'lan', mood: 'angry', text: '什么光头？我没让任何人找你！你别跟他走，那是专门讹人的！' },
    { who: 'guang', mood: 'angry', text: '……算你精。', end: true },
    { k: 'walk', who: 'narr', text: '光头男人在背后啐了一口。后来你听说，这条街上有人专门打着技师的名号“仙人跳”。', end: true },
  ]),
  episode('lan_4', 'luohu', s => s.flags.lan === 3 && since(s, 'lanDay', 2) && s.day >= 16, [
    { who: 'narr', text: '足浴店门口，阿兰牵着一个背着粉红书包的小女孩，门牙还没长齐。' },
    { who: 'lan', mood: 'smile', text: '我女儿！接过来了！学位是社区帮忙找的，就在罗湖，下礼拜一开学。' },
    { who: 'lan', mood: 'smile', text: '这张卡你拿着，我自己的钱充的，你来了随时找我，不收钱。在深圳，好人要有好报。',
      effect: s => { s.flags.lan = 'done'; return hp(s, 30); } },
    { who: 'narr', text: '小女孩躲在妈妈身后，冲你挥了挥手。', end: true },
  ]),

  // ===== 南山科技园·电梯里的陈总（地标：双子总部）=====
  episode('keji_chen_1', 'keji', s => s.day >= 2 && !s.flags.chen, [
    { who: 'narr', text: '你跟着人流挤进双子总部的电梯。门关上的一瞬间，一个穿灰卫衣的中年人也闪了进来，手里还拿着半个包子。' },
    { who: 'chen', text: '小伙子，看你背着货。我问你个问题：同样一个蓝牙耳机，在华强北卖八十，到了我们这栋楼里卖八百，凭什么？', choices: [
      { label: '“凭你们给它讲了个故事。”', effect: s => { mark(s, 'chen', 1); return favor(s, 1); }, to: 'good' },
      { label: '“凭你们的东西质量好？”', effect: s => mark(s, 'chen', 1), to: 'ok' },
      { label: '“我只管它在哪里便宜。”', effect: s => mark(s, 'chen', 'no'), to: 'no' },
    ] },
    { k: 'good', who: 'chen', mood: 'smile', text: '哈！说得对。东西是华强北的，故事是南山的。我姓陈，做无人机的。下次来，上二十八楼找我。', end: true },
    { k: 'ok', who: 'chen', text: '一半对。质量是门票，故事才是价钱。有空上二十八楼坐坐。', end: true },
    { k: 'no', who: 'chen', mood: 'smile', text: '也行，实在。叮——二十八楼到了，我先走了。', end: true },
  ], 'landmark'),
  episode('keji_chen_2', 'keji', s => s.flags.chen === 1 && since(s, 'chenDay', 2), [
    { who: 'narr', text: '二十八楼的前台把你领进一间全是样机的会议室。陈总正趴在桌上拆一台无人机。' },
    { who: 'chen', text: s => `我们换代，有一批上一代的无人机配件要清，按市价七折给你，${yuan(Math.round(priceOf(s, 'drone') * 0.7))} 一套。拿去倒，赚了算你的。`, choices: [
      { label: '能拿多少拿多少（最多 5 套）', ok: s => s.cash >= priceOf(s, 'drone') * 0.7 && free(s) > 0, why: '现金或背包不够',
        effect: s => { const n = buyAt(s, 'drone', 5, Math.round(priceOf(s, 'drone') * 0.7)); mark(s, 'chen', 2); s.flags.chenBought = n; return `无人机配件 +${n}`; }, to: 'buy' },
      { label: '“陈总，我本小，先不了。”', effect: s => mark(s, 'chen', 2), to: 'pass' },
    ] },
    { k: 'buy', who: 'chen', mood: 'smile', text: '爽快。做生意就是这样，看准了就别磨叽。', end: true },
    { k: 'pass', who: 'chen', text: '懂得收手也是本事。以后有好货我还记得你。', end: true },
  ], 'landmark'),
  episode('keji_chen_3', 'keji', s => s.flags.chen === 2 && since(s, 'chenDay', 3) && s.day >= 14, [
    { who: 'narr', text: '双子总部楼下拉起了红色横幅，门口摆满了花篮：热烈庆祝敲钟上市。' },
    { who: 'chen', mood: 'smile', text: '你来得巧！今天公司上市。三年前我也在华强北扛箱子，跟你现在一模一样。' },
    { who: 'chen', mood: 'smile', text: '这个红包你拿着，不多，图个好意头。记住：别光倒货，有一天要做自己的东西。',
      effect: s => { const n = s.flags.chenBought ? 2000 : 800; s.cash += n; mark(s, 'chen', 'done'); return `现金 +${yuan(n)} · ` + favor(s, 1); }, end: true },
  ], 'landmark'),

  // ===== 南山科技园·小K 的 AI 养龙虾 =====
  episode('keji_ai_1', 'keji', s => s.day >= 4 && s.cash >= 3000 && !s.flags.ai, [
    { who: 'narr', text: '科技园的咖啡店里，一个戴着 VR 眼镜的年轻人把 PPT 怼到了你面前。' },
    { who: 'xiaok', mood: 'smile', text: '哥，给你看个大项目：AI 养龙虾！摄像头盯着每一只虾，AI 算它什么时候饿、什么时候脱壳。今天天使轮，三千块一个点，错过就是错过一个时代！', choices: [
      { label: '投三千，赌一把', ok: s => s.cash >= 3000, why: '现金不足 ¥3,000', effect: s => { mark(s, 'ai', 1); s.flags.aiBet = 3000; return pay(s, 3000); }, to: 'in' },
      { label: '投一千意思意思', ok: s => s.cash >= 1000, why: '现金不足 ¥1,000', effect: s => { mark(s, 'ai', 1); s.flags.aiBet = 1000; return pay(s, 1000); }, to: 'in' },
      { label: '“龙虾不会自己找饲料吗？”', effect: s => mark(s, 'ai', 'no'), to: 'no' },
    ] },
    { k: 'in', who: 'xiaok', mood: 'smile', text: '格局！哥你就是我们的第一个投资人，等我们 A 轮，你就是创始股东！', end: true },
    { k: 'no', who: 'xiaok', mood: 'sad', text: '……这个问题，我们下一版 PPT 会回答。', end: true },
  ]),
  episode('keji_ai_2', 'keji', s => s.flags.ai === 1 && since(s, 'aiDay', 4), [
    { who: 'narr', text: '还是那家咖啡店。小K 没戴 VR 眼镜，看上去三天没睡。', to: s => (luck(s, 7) < 0.35 ? 'win' : 'lose') },
    { k: 'win', who: 'xiaok', mood: 'smile', text: '哥！成了！一家水产集团看中了，直接把我们收了！你那份，按五倍给你结！',
      effect: s => { const n = (s.flags.aiBet || 0) * 5; s.cash += n; mark(s, 'ai', 'won'); return `现金 +${yuan(n)}`; }, end: true },
    { k: 'lose', who: 'xiaok', mood: 'sad', text: '哥……龙虾全跑了。摄像头拍到了，AI 也算出来了，就是没人去关那个水阀。钱是还不上了，这件文化衫你拿着，限量的。',
      effect: s => { mark(s, 'ai', 'lost'); return favor(s, 1); }, end: true },
  ]),

  // ===== 华强北·老周的一米柜台（地标：电子大厦）=====
  episode('hqb_zhou_1', 'huaqiangbei', s => s.day >= 2 && !s.flags.zhou, [
    { who: 'narr', text: '电子大厦三楼最里头，一个一米宽的柜台，墙上贴满了褪色的手机海报。柜台后面的老头在泡功夫茶。' },
    { who: 'zhou', text: '后生，看什么看，这些都是古董，不卖。零八年，我这一个柜台，一天出两千台机。山寨机，懂不懂？', choices: [
      { label: '坐下来，请他讲讲当年（买包茶叶 ¥50）', ok: s => s.cash >= 50, why: '现金不足 ¥50', effect: s => { mark(s, 'zhou', 1); return pay(s, 50); }, to: 'sit' },
      { label: '“现在谁还用山寨机啊。”', effect: s => mark(s, 'zhou', 'no'), to: 'no' },
    ] },
    { k: 'sit', who: 'zhou', mood: 'smile', text: '那时候，带电视的、带验钞灯的、八个喇叭的，我们什么都敢做。卖到非洲，卖到印度。后来大牌子起来了，我们就散了。' },
    { who: 'zhou', mood: 'smile', text: '你人不错，肯听老头子啰嗦。下次来，我教你一招。', end: true },
    { k: 'no', who: 'zhou', mood: 'angry', text: '哼，没有我们，哪有今天的你们。', end: true },
  ], 'landmark'),
  episode('hqb_zhou_2', 'huaqiangbei', s => s.flags.zhou === 1 && since(s, 'zhouDay', 2), [
    { who: 'zhou', text: '来了？坐。我教你砍价。记住三句：第一，别说你要，说你“看看”。第二，价钱别先开口。第三——' },
    { who: 'zhou', mood: 'smile', text: '转身要真走。走到第三个柜台，他一定叫你。叫你了，你就赢了。',
      effect: s => { mark(s, 'zhou', 2); s.flags.haggleSkill = true; return '学会了老周的砍价功夫：砍价成功率永久提升'; } },
    { who: 'me', text: '这……就这么简单？' },
    { who: 'zhou', mood: 'smile', text: '简单？我用了二十年才敢真走。', end: true },
  ], 'landmark'),
  episode('hqb_zhou_3', 'huaqiangbei', s => s.flags.zhou === 2 && since(s, 'zhouDay', 3) && s.day >= 13, [
    { who: 'narr', text: '老周的柜台空了一半，墙上的海报被一张张揭下来，叠得整整齐齐。' },
    { who: 'zhou', mood: 'sad', text: '租约到期了，不续了。儿子在东莞买了房，叫我过去带孙子。' },
    { who: 'zhou', mood: 'smile', text: '这台机你拿着，最后一批货，双卡双待，带手电筒，能用十年。我们那代人做的东西，结实。',
      effect: s => { mark(s, 'zhou', 'done'); const n = give(s, 'phone', 1); return n ? '翻新手机 +1' : '背包满了，他说替你寄到老乡会。'; }, end: true },
  ], 'landmark'),

  // ===== 福田·莲花山相亲角 =====
  episode('ft_date_1', 'futian', s => s.day >= 4 && !s.flags.date, [
    { who: 'narr', text: '路过莲花山脚，一排排的牌子：男，八五年，有房有车，年薪四十万。一个烫着卷发的阿姨一把拉住了你。' },
    { who: 'hongyi', mood: 'smile', text: '靓仔！单身吧？我一看就知道。做什么的？一个月多少？深圳有房吗？', choices: [
      { label: '“做贸易的，自己当老板。”（吹一吹）', effect: s => { mark(s, 'date', 1); s.flags.dateBrag = true; return ''; }, to: 'brag' },
      { label: '“在街上倒货的，还欠着债。”（老实说）', effect: s => mark(s, 'date', 1), to: 'honest' },
      { label: '拔腿就跑', effect: s => mark(s, 'date', 'ran'), to: 'run' },
    ] },
    { k: 'brag', who: 'hongyi', mood: 'smile', text: '老板好啊！我手上有个林小姐，福田上班的，眼光高。下次你来，我约她跟你喝个茶！', end: true },
    { k: 'honest', who: 'hongyi', text: '……老实人啊。老实人好，现在老实人少。我手上有个林小姐，就喜欢实在的。下次我给你们约！', end: true },
    { k: 'run', who: 'hongyi', mood: 'angry', text: '跑什么跑！我又不收钱！', end: true },
  ]),
  episode('ft_date_2', 'futian', s => s.flags.date === 1 && since(s, 'dateDay', 2), [
    { who: 'narr', text: '茶餐厅的卡座里，林小姐看了一眼你的背包，又看了一眼手机上红姨发的介绍。' },
    { who: 'lin', text: s => (s.flags.dateBrag ? '红姨说你是做贸易的大老板？那这个背包……是你的风格？' : '红姨说你很实在。我也直说吧，我在深圳八年，见过太多吹牛的人了。') },
    { who: 'lin', text: '你觉得，在深圳，最重要的是什么？', choices: [
      { label: '“是有个人一起熬。”', effect: s => { mark(s, 'date', 'good'); return favor(s, 1); }, to: 'good' },
      { label: '“是钱。”', effect: s => mark(s, 'date', 'meh'), to: 'money' },
      { label: '抢着把单买了（¥200）', ok: s => s.cash >= 200, why: '现金不足 ¥200', effect: s => { mark(s, 'date', 'meh'); return pay(s, 200); }, to: 'bill' },
    ] },
    { k: 'good', who: 'lin', mood: 'smile', text: '……这个答案还行。下礼拜我加班少，可以再出来喝个茶。AA。', end: true },
    { k: 'money', who: 'lin', mood: 'smile', text: '诚实。我也这么觉得。那我们还是各自努力搞钱吧，加个微信，有生意介绍给你。', end: true },
    { k: 'bill', who: 'lin', text: '谢谢。不过下次别这样，我不喜欢欠人情。', end: true },
  ]),

  // ===== 福田·金融塔里的 Kevin（地标：金融塔）=====
  episode('ft_kevin_1', 'futian', s => s.day >= 5 && s.cash >= 5000 && !s.flags.kevin, [
    { who: 'narr', text: '金融塔大堂里，一个西装笔挺的年轻人递过来一张烫金名片：财富管理中心，高级客户经理。' },
    { who: 'kevin', mood: 'smile', text: '先生您好，我是 Kevin。我们有一款内部产品，年化百分之三十，保本保息，五千起投，只对少数客户开放。', choices: [
      { label: '投五千试试', ok: s => s.cash >= 5000, why: '现金不足 ¥5,000', effect: s => { mark(s, 'kevin', 'lost'); return pay(s, 5000); }, to: 'in' },
      { label: '“你们的金融牌照给我看看。”', effect: s => { mark(s, 'kevin', 'caught'); return favor(s, 1); }, to: 'license' },
      { label: '“不了，谢谢。”', effect: s => mark(s, 'kevin', 'no'), to: 'no' },
    ] },
    { k: 'in', who: 'kevin', mood: 'smile', text: '先生好眼光！合同我回头寄给您，每个月十号到账。', end: true },
    { k: 'license', who: 'kevin', mood: 'sad', text: '牌照……在、在总部，我回头拍给您……' },
    { who: 'narr', text: '他把名片揣回兜里，快步走出了大堂。保安在后面喊了一声，他跑得更快了。', end: true },
    { k: 'no', who: 'kevin', text: '好的先生，有需要随时找我。', end: true },
  ], 'landmark'),
  episode('ft_kevin_2', 'futian', s => s.flags.kevin === 'lost' && since(s, 'kevinDay', 3), [
    { who: 'narr', text: '金融塔大堂立了一块新的提示牌：“警惕冒充金融机构的非法集资”，上面贴着一张照片——就是 Kevin。' },
    { who: 'officer', text: '你也被他骗了？登记一下。追回来的钱，按比例退。别抱太大希望，能回来三成就不错了。',
      effect: s => { const n = 1500; s.cash += n; mark(s, 'kevin', 'back'); return `追回 ${yuan(n)}`; } },
    { who: 'narr', text: '年化百分之三十，最后变成了亏七成。你把那张烫金名片揉成一团，扔进了垃圾桶。', end: true },
  ], 'landmark'),

  // ===== 东门·牌坊下的阿木（地标：老街牌坊）=====
  episode('dm_amu_1', 'dongmen', s => s.day >= 2 && !s.flags.amu, [
    { who: 'narr', text: '牌坊底下，一个穿拖鞋的年轻人抱着一把掉了漆的吉他，唱着一首十几年前的老歌。面前的琴盒里只有几个硬币。' },
    { who: 'amu', text: '谢谢，谢谢。下一首，想听什么都可以点。', choices: [
      { label: '往琴盒里放二十块，点一首', ok: s => s.cash >= 20, why: '现金不足 ¥20', effect: s => { mark(s, 'amu', 1); return pay(s, 20) + ' · ' + hp(s, 5); }, to: 'tip' },
      { label: '站着听完一首就走', effect: s => mark(s, 'amu', 'no'), to: 'listen' },
    ] },
    { k: 'tip', who: 'amu', mood: 'smile', text: '老板大气！我叫阿木，从贵州来的。等我攒够钱，要录一张自己的专辑。', end: true },
    { k: 'listen', who: 'narr', text: '一曲唱完，你发现自己的脚步轻了一点。', effect: s => hp(s, 3), end: true },
  ], 'landmark'),
  episode('dm_amu_2', 'dongmen', s => s.flags.amu === 1 && since(s, 'amuDay', 2), [
    { who: 'officer', text: '这里不能卖唱，影响通行，收拾一下走吧。' },
    { who: 'amu', mood: 'sad', text: '我就唱到八点……我不挡路的，我靠着柱子唱……' },
    { who: 'narr', text: '围观的人越来越多，有人小声说：唱得挺好的啊。', choices: [
      { label: '帮他说情：“他唱完这首就走，我帮他收拾。”', effect: s => { mark(s, 'amu', 2); return favor(s, 1); }, to: 'help' },
      { label: '别掺和', effect: s => mark(s, 'amu', 'gone'), to: 'leave' },
    ] },
    { k: 'help', who: 'officer', text: '……行，就这一首。下次去文化广场那边，那边有街头表演登记。' },
    { who: 'amu', mood: 'smile', text: '兄弟，这首送你。', end: true },
    { k: 'leave', who: 'narr', text: '第二天，牌坊底下空荡荡的，只剩一个歪倒的谱架。', end: true },
  ], 'landmark'),
  episode('dm_amu_3', 'dongmen', s => s.flags.amu === 2 && since(s, 'amuDay', 3) && s.day >= 14, [
    { who: 'narr', text: '牌坊底下架起了补光灯和摄像机，阿木换了一身新衣服。旁边那个人你认识——酱板鸭短剧的导演。' },
    { who: 'director', mood: 'smile', text: '这小伙子的嗓子，配我新剧的主题曲正好！哎，你不是那个……来来来，正缺一个路人甲，演一个街头老板，一天八百！',
      effect: s => { s.cash += 800; mark(s, 'amu', 'star'); return '现金 +¥800'; } },
    { who: 'amu', mood: 'smile', text: '哥，主题曲的第一句，是看着你写的。', end: true },
  ], 'landmark'),

  // ===== 蛇口·邮轮边的 Mike（地标：海上邮轮）=====
  episode('sk_mike_1', 'shekou', s => s.day >= 3 && !s.flags.mike, [
    { who: 'narr', text: '邮轮旁的栈道上，一个高个子外国人举着手机，对着翻译软件跟一个阿婆比划了半天。' },
    { who: 'mike', mood: 'smile', text: '你好！我叫 Mike，我……在蛇口，教英语。我妈妈，下个月，生日。我想买，中国的，油画。真的，油画。你知道吗？' },
    { who: 'mike', text: s => (has(s, 'painting') ? '你的包里……是油画吗？我可以买！' : '大芬村？很远吗？我不会坐地铁……'), choices: [
      { label: '把手上的油画卖给他（按市价一倍半）', ok: s => has(s, 'painting') > 0, why: '手上没有油画',
        effect: s => { const n = sellAt(s, 'painting', 2, Math.round(priceOf(s, 'painting') * 1.5)); mark(s, 'mike', 'sold'); return `卖出油画 ${n} 幅，现金 +${yuan(n * Math.round(priceOf(s, 'painting') * 1.5))}`; }, to: 'sold' },
      { label: '“下次我帮你带一幅过来。”', effect: s => mark(s, 'mike', 1), to: 'later' },
    ] },
    { k: 'sold', who: 'mike', mood: 'smile', text: '太好了！我妈妈会哭的！谢谢你，我的朋友！', end: true },
    { k: 'later', who: 'mike', mood: 'smile', text: '真的吗？太好了！我每天下午都在这里。', end: true },
  ], 'landmark'),
  episode('sk_mike_2', 'shekou', s => s.flags.mike === 1 && since(s, 'mikeDay', 2), [
    { who: 'mike', mood: 'smile', text: s => (has(s, 'painting') ? '我的朋友！你带来了！我还叫了两个同事，他们也想要！' : '我的朋友！油画呢？我同事们都在等……'), choices: [
      { label: '把油画都卖给他们（按市价一倍八，最多 4 幅）', ok: s => has(s, 'painting') > 0, why: '手上没有油画',
        effect: s => { const u = Math.round(priceOf(s, 'painting') * 1.8), n = sellAt(s, 'painting', 4, u); mark(s, 'mike', 'sold'); return `卖出油画 ${n} 幅，现金 +${yuan(n * u)} · ` + favor(s, 1); }, to: 'sold' },
      { label: '“抱歉，忘了……”', effect: s => { mark(s, 'mike', 'forgot'); return favor(s, -1); }, to: 'sad' },
    ] },
    { k: 'sold', who: 'mike', mood: 'smile', text: '这是我在中国做的最好的一笔交易！下次我请你喝精酿！', end: true },
    { k: 'sad', who: 'mike', mood: 'sad', text: 'Oh……没关系。中国人说，下次一定？', end: true },
  ], 'landmark'),

  // ===== 宝安·西乡工厂（地标：西乡工厂）=====
  episode('ba_fac_1', 'baoan', s => s.day >= 4 && !s.flags.fac, [
    { who: 'narr', text: '工厂门口堆满了纸箱。一个挺着肚子的男人叼着烟，冲你招手。' },
    { who: 'huang', mood: 'smile', text: s => `兄弟，倒货的吧？我这批 LED 灯带，${yuan(Math.max(5, Math.round(priceOf(s, 'led') * 0.5)))} 一条，市价对半！要多少有多少，今天现钱提货。` },
    { who: 'fang', mood: 'sad', text: '（一个穿工衣的姑娘从你身边走过，压低声音）他三个月没发工资了，这批货是抵债的，过两天就要被查封……', choices: [
      { label: '照收不误，便宜就是硬道理（60 条）', effect: s => { const n = buyAt(s, 'led', 60, Math.max(5, Math.round(priceOf(s, 'led') * 0.5))); mark(s, 'fac', 'bought'); return `LED灯带 +${n}`; }, to: 'buy' },
      { label: '帮小芳打劳动监察的电话', effect: s => { mark(s, 'fac', 'report'); return favor(s, 2); }, to: 'report' },
      { label: '不蹚这趟浑水', effect: s => mark(s, 'fac', 'no'), to: 'no' },
    ] },
    { k: 'buy', who: 'huang', mood: 'smile', text: '爽快！以后常来！', end: true },
    { k: 'report', who: 'narr', text: '你走到街角拨了 12345。小芳远远地看着你，眼圈红了。', end: true },
    { k: 'no', who: 'narr', text: '你摇摇头走开了。身后，黄厂长还在招呼下一个路人。', end: true },
  ], 'landmark'),
  episode('ba_fac_2', 'baoan', s => (s.flags.fac === 'bought' || s.flags.fac === 'report') && since(s, 'facDay', 3), [
    { who: 'narr', text: '西乡工厂的大门贴上了封条。门口围着一圈工人，劳动监察的车停在路边。', to: s => (s.flags.fac === 'report' ? 'r' : 'b') },
    { k: 'r', who: 'fang', mood: 'smile', text: '工资发下来了！三个月的！这是我家沙井的生蚝，我爸今早刚撬的，你一定要收下。',
      effect: s => { mark(s, 'fac', 'done'); const n = give(s, 'oyster', 5); return (n ? `沙井生蚝 +${n} · ` : '') + favor(s, 1); }, end: true },
    { k: 'b', who: 'fang', mood: 'sad', text: '……你就是那天收灯带的人吧。那批货是我们三个月的工资。算了，你也是做生意的。',
      effect: s => { mark(s, 'fac', 'guilt'); return favor(s, -1); }, end: true },
  ]),

  // ===== 龙华·三和的海哥 =====
  episode('lh_haige_1', 'longhua', s => s.day >= 3 && s.cash < 1500 && !s.flags.haige, [
    { who: 'narr', text: '人力市场门口，一群人蹲在马路牙子上抽烟。一个瘦高个看了一眼你干瘪的钱包。' },
    { who: 'haige', text: '兄弟，手头紧吧？我叫海哥，在这住了三年。明天有个日结，搬货，一天三百，管一顿饭。干不干？', choices: [
      { label: '干！先把今天过了', effect: s => { s.cash += 300; mark(s, 'haige', 1); return '现金 +¥300 · ' + hp(s, -20); }, to: 'work' },
      { label: '“我再想想办法。”', effect: s => mark(s, 'haige', 1), to: 'no' },
    ] },
    { k: 'work', who: 'haige', mood: 'smile', text: '干一天玩三天，这是三和的规矩。不过你跟我们不一样，你眼里还有光。', end: true },
    { k: 'no', who: 'haige', text: '行，有骨气。想通了随时来，我就在这儿蹲着。', end: true },
  ]),
  episode('lh_haige_2', 'longhua', s => s.flags.haige === 1 && since(s, 'haigeDay', 3), [
    { who: 'narr', text: '握手楼底下的士多店门口，海哥在打电话，声音很小：“妈，我过年回来……真的回来。”' },
    { who: 'haige', mood: 'sad', text: '兄弟，跟你说个事。我想回家了。三年没回去了。就是……车票钱还差两百。', choices: [
      { label: '给他买张车票（¥200）', ok: s => s.cash >= 200, why: '现金不足 ¥200', effect: s => { mark(s, 'haige', 'home'); return pay(s, 200) + ' · ' + favor(s, 2); }, to: 'give' },
      { label: '“我也不容易……”', effect: s => mark(s, 'haige', 'stay'), to: 'no' },
    ] },
    { k: 'give', who: 'haige', mood: 'smile', text: '……我这辈子没求过人。兄弟，你会发财的，我说的。', end: true },
    { k: 'no', who: 'haige', text: '懂，都不容易。那我再干几天日结。', end: true },
  ], 'landmark'),

  // ===== 大芬·画师阿梵（地标：画家村）=====
  episode('df_fan_1', 'dafen', s => s.day >= 2 && !s.flags.fan, [
    { who: 'narr', text: '画家村的巷子里，一个满手颜料的年轻人正在画第一百零一幅《向日葵》，画得一模一样。' },
    { who: 'fan', text: '要画像吗？两百一张，半小时。我临摹梵高十年了，闭着眼都能画，就是没人买我自己的画。', choices: [
      { label: '画一张（¥200）', ok: s => s.cash >= 200, why: '现金不足 ¥200', effect: s => { mark(s, 'fan', 1); return pay(s, 200) + ' · ' + favor(s, 1); }, to: 'draw' },
      { label: '“你自己的画，给我看看？”', effect: s => mark(s, 'fan', 1), to: 'own' },
    ] },
    { k: 'draw', who: 'fan', mood: 'smile', text: '你这张脸好画，圆。……送你个背景，深圳的夜景。', end: true },
    { k: 'own', who: 'fan', mood: 'smile', text: '真的要看？……这是城中村的屋顶，这是凌晨四点的华强北。没人要，但我喜欢。', end: true },
  ], 'landmark'),
  episode('df_fan_2', 'dafen', s => s.flags.fan === 1 && since(s, 'fanDay', 2), [
    { who: 'narr', text: '一个光头男人拦住了你。你认出来了——罗湖那个。他今天换了身唐装，手里捧着一幅画。' },
    { who: 'guang', mood: 'smile', text: '老板，识货的话看看这个：名家真迹，有证书。急用钱，五千，亏本出。' },
    { who: 'fan', mood: 'angry', text: '（凑到你耳边）那是我上个月画的，一百五卖给他的……', choices: [
      { label: '当场拆穿他', effect: s => { mark(s, 'fan', 2); return favor(s, 1); }, to: 'expose' },
      { label: '装作不知道，走开', effect: s => mark(s, 'fan', 2), to: 'walk' },
    ] },
    { k: 'expose', who: 'guang', mood: 'angry', text: '……又是你！你是专门来坏我生意的是吧！' },
    { who: 'narr', text: '光头男人卷起画就跑了。阿梵笑得直不起腰。', end: true },
    { k: 'walk', who: 'narr', text: '你转身离开，听见光头男人又拦住了一对游客。', end: true },
  ], 'landmark'),
  episode('df_fan_3', 'dafen', s => s.flags.fan === 2 && since(s, 'fanDay', 3) && s.day >= 14, [
    { who: 'narr', text: '画家村的小美术馆门口挂着一条横幅：阿梵个展·《凌晨四点的深圳》。' },
    { who: 'fan', mood: 'smile', text: '有个策展人看到了我的画！第一次，我自己的名字挂在墙上。这幅你拿去，就是那天给你看的华强北。',
      effect: s => { mark(s, 'fan', 'show'); const n = give(s, 'painting', 1); return n ? '大芬油画 +1' : '背包满了，他说先替你收着。'; }, end: true },
  ], 'landmark'),

  // ===== 盐田·海员老张（地标：集装箱码头）=====
  episode('yt_zhang_1', 'yantian', s => s.day >= 3 && !s.flags.zhang, [
    { who: 'narr', text: '码头边，一个皮肤晒得黝黑的老海员坐在缆桩上，脚边放着几个贴满外文标签的纸箱。' },
    { who: 'zhang', text: s => `跑了十八个月船，刚靠岸。路上捎了几张二手显卡，船上的小伙子们挖矿淘汰的，${yuan(Math.round(priceOf(s, 'gpu') * 0.6))} 一张，要不要？`, choices: [
      { label: '要三张', ok: s => s.cash >= priceOf(s, 'gpu') * 0.6 && free(s) > 0, why: '现金或背包不够',
        effect: s => { const n = buyAt(s, 'gpu', 3, Math.round(priceOf(s, 'gpu') * 0.6)); mark(s, 'zhang', 1); return `二手显卡 +${n}`; }, to: 'buy' },
      { label: '陪他聊聊海上的事', effect: s => mark(s, 'zhang', 1), to: 'talk' },
    ] },
    { k: 'buy', who: 'zhang', mood: 'smile', text: '识货！挖过矿的卡，扛造。', end: true },
    { k: 'talk', who: 'zhang', mood: 'smile', text: '海上啊，就是蓝，蓝得你发慌。最想的是一碗热肠粉。', end: true },
  ], 'landmark'),
  episode('yt_zhang_2', 'yantian', s => s.flags.zhang === 1 && since(s, 'zhangDay', 3), [
    { who: 'narr', text: '天色突然黑了下来，风卷着雨点打在集装箱上。广播在喊：台风提前登陆，所有人撤离码头。' },
    { who: 'zhang', mood: 'angry', text: '我那几个箱子还没绑！兄弟，搭把手！', choices: [
      { label: '冒雨帮他绑箱子', effect: s => { mark(s, 'zhang', 'storm'); const n = give(s, 'gpu', 1); return hp(s, -10) + ' · ' + favor(s, 2) + (n ? ' · 二手显卡 +1（他硬塞给你的）' : ''); }, to: 'help' },
      { label: '先找地方躲雨', effect: s => mark(s, 'zhang', 'hid'), to: 'hide' },
    ] },
    { k: 'help', who: 'zhang', mood: 'smile', text: '好兄弟！这张卡拿着，不收钱。海上的规矩：一起扛过风的，就是自己人。', end: true },
    { k: 'hide', who: 'narr', text: '你在岗亭里躲了一夜。第二天，老张的两个箱子被吹进了海里。', end: true },
  ]),
];
SCENES.push(...EPISODES);

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
  { id: 'ev_ebike', w: 3, can: s => s.vehicle === 'ebike' && s.cash >= 200, lines: [
    { who: 'officer', mood: 'angry', text: '电单车不能进这条路，牌子那么大没看见？罚款两百，下不为例。',
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
    // 路人的消息有一半是假的：说的货和地方是真的有戏，但涨跌说反了。听上去一模一样，分不出来。
    const t = bestTip(s), lie = (mix(s.day, locIdx(s), 4099) % 100) < CONFIG.tipLie * 100;
    const cheap = t && (lie ? !t.cheap : t.cheap);
    lines = t ? [
      { who: 'passer', text: '你是跑货的吧？看你背着包就知道。' },
      { who: 'passer', mood: 'smile', text: `跟你说个事，${t.d.name}那边，明天${t.g.name}${cheap ? '有人清仓，便宜得很' : '有人高价收，缺得厉害'}。信不信由你。`,
        effect: () => `路人说：明天${t.d.name}的${t.g.name}${cheap ? '便宜' : '走俏'}（真假各半）` },
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
  return SCENES.find(sc => !sc.at && !s.seen[sc.id] && sc.when(s))
    || (s.pendingEvent && EVENT_SCENES.find(e => e.id === s.pendingEvent))
    || (s.offer ? OFFER_SCENE : null);
}

// 走到本区地标跟前互动：有该发生的插曲就播插曲，没有就返回一句看风景的旁白
export function landmarkScene(s) {
  if (s.over) return null;
  return SCENES.find(sc => sc.at === 'landmark' && !s.seen[sc.id] && sc.when(s)) || null;
}
const LANDMARK_LINES = {
  huaqiangbei: ['电子大厦里，一米宽的柜台挤了上百家，喊价声比空调声还响。', '门口的大屏滚动着“全网最低价”，底下蹲着一排等活的维修师傅。'],
  futian: ['你仰头看金融塔，脖子都酸了，楼顶还藏在云里。', '大堂的保安上下打量了你一眼，你默默把背包往身后挪了挪。'],
  luohu: ['联检楼里人潮汹涌，拖着箱子的人往一个方向走，空着手的人往另一个方向走。', '口岸的广播一遍遍提醒：请勿替他人携带物品。'],
  dongmen: ['牌坊底下，有人在拍照，有人在卖糖画，还有人在吵架。', '老街的牌坊比你想象的旧，柱子上的红漆剥了一层又一层。'],
  keji: ['双子塔之间的天桥上，有人边走边开视频会议。', '楼下的咖啡店门口排着长队，每个人胸前都挂着工牌。'],
  shekou: ['邮轮上的灯一串串亮起来，海风里有咖啡和炸鱼的味道。', '码头边，几个外国人在用翻译软件跟出租车师傅讲价。'],
  baoan: ['工厂门口的电子屏写着：急招普工，包吃住，日结。', '下班铃一响，穿着工衣的人潮从厂门涌了出来。'],
  longhua: ['握手楼之间的缝隙只容一个人侧身过去，头顶晾着一整条街的衣服。', '楼下的出租告示贴了一层又一层：单间 800，押一付一。'],
  dafen: ['画家村门口，几十幅一模一样的《向日葵》排成一排晒太阳。', '一个画师头也不抬：“定制肖像，两百一张，半小时取。”'],
  yantian: ['龙门吊缓缓地把一个集装箱吊上了船，像在下一盘很大的棋。', '码头的风很大，吹得集装箱上的封条哗哗作响。'],
};
export const landmarkLine = s => { const a = LANDMARK_LINES[s.loc] || ['这里人来人往。']; return a[s.day % a.length]; };

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

// 结局：从上往下，第一个条件成立的就是这一局的结局。n 是净资产。
export const ENDINGS = [
  { id: 'legend', icon: '👑', title: '鹏城传说', when: (s, n) => n >= 3000000 && s.favor >= 3,
    text: '三十天，从一个行李箱到一条供应链。后来的人来深圳，都是听着潘潘的故事来的。更难得的是，一路上帮过他的人，他一个都没忘。' },
  { id: 'lonely', icon: '🏙️', title: '孤家寡人', when: (s, n) => n >= 1000000 && s.favor < 0,
    text: '钱是真的赚到了。潘潘搬进了福田的高层公寓，落地窗外是整个 CBD 的灯火。只是手机通讯录翻到底，找不出一个能约出来吃宵夜的人。' },
  { id: 'heir', icon: '🤝', title: '老乡会接班人', when: s => s.debt === 0 && s.favor >= 6,
    text: '年会那天，炳叔当着所有人的面，把那本记了二十年的账本交到潘潘手上：“以后会里的事，你多担待。”钱多钱少另说，这座城市里，潘潘有了自己人。' },
  { id: 'boss', icon: '🏪', title: '一米柜台', when: (s, n) => n >= 300000 && s.debt === 0,
    text: '潘潘在华强北租下了一米柜台，招牌是自己写的。从今天起，轮到别人来他这里拿货了。' },
  { id: 'partner', icon: '🥢', title: '肠粉摊合伙人', when: (s, n) => s.flags.rule === 'helped' && n >= 20000,
    text: '阿姨说年纪大了，起不了那么早。潘潘把攒下的钱投了进去，肠粉摊开了第二家。招牌上多了一行小字：贵是贵点，但吃了不烧心。' },
  { id: 'driver', icon: '🚐', title: '跑货司机', when: (s, n) => s.vehicle === 'van' && n >= 0,
    text: '钱没赚到多少，车倒是开熟了。潘潘在面包车的挡风玻璃上贴了张纸：全市拉货，随叫随到。日子不富，但每天都在路上。' },
  { id: 'stay', icon: '🌃', title: '再闯一个月', when: (s, n) => n >= 50000,
    text: '账还清了，手里还有一笔。潘潘退掉了回家的车票，给家里打了个电话：“妈，我再待一阵。这地方，好像真的行。”' },
  { id: 'home', icon: '🚄', title: '回老家', when: (s, n) => n >= 0,
    text: '不赚不赔。潘潘在罗湖站买了张回家的票，行李箱还是来时那一个。火车开动的时候他想：深圳的路，我是跑熟了的。' },
  { id: 'bailed', icon: '📿', title: '打工还债', when: (s, n) => n < 0 && s.favor >= 2,
    text: '账没还上。炳叔看了他半天，叹了口气：“人还实在。去阿杰那个厂里做吧，工资我按月扣。”潘潘点点头。欠的钱，总归要还。' },
  { id: 'runaway', icon: '🏃', title: '连夜跑路', when: () => true,
    text: '账没还上，人情也用光了。潘潘半夜拖着行李箱出了城中村，没敢开灯。这座城市没留住他，债主倒是还记得他。' },
];
export const ending = (s, score) => ENDINGS.find(e => e.when(s, score));

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
  if (s.flags.wen === 'together') out.push('东门新开的港货店，开张那天的第一位客人是你。后来，店门口的鞭炮常常是为你放的。');
  else if (s.flags.wen === 'friend') out.push('小雯的港货店生意不错，你每次去，她都按进价给你。');
  else if (s.flags.wen === 'gone') out.push('后来你再也没在口岸见过小雯。');
  if (s.flags.chen === 'done') out.push('陈总的公司上市那天，你在新闻里看到了他，他还穿着那件灰卫衣。');
  if (s.flags.ai === 'won') out.push('小K 的 AI 养龙虾被收购了。你成了朋友圈里唯一一个真赚到钱的天使投资人。');
  else if (s.flags.ai === 'lost') out.push('那件限量文化衫，你后来一直当睡衣穿。');
  if (s.flags.zhou === 'done') out.push('老周送的那台山寨机，你用了很多年，电池一次也没换过。');
  if (s.flags.date === 'good') out.push('林小姐后来真的约你喝了第二次茶。AA。');
  if (s.flags.kevin === 'caught') out.push('那个叫 Kevin 的理财经理后来被抓了，你是少数没上当的人之一。');
  if (s.flags.amu === 'star') out.push('阿木的歌火了。短剧片头里那个一闪而过的路人甲，是你。');
  if (s.flags.mike === 'sold') out.push('Mike 的妈妈把那幅油画挂在了伦敦的客厅里。');
  if (s.flags.fac === 'done') out.push('小芳后来去读了夜校，每年都给你寄一箱沙井生蚝。');
  else if (s.flags.fac === 'guilt') out.push('那批便宜的灯带，你卖得很顺，就是一直有点烧心。');
  if (s.flags.haige === 'home') out.push('海哥回了老家，在镇上开了个小卖部。他说，三和他再也不去了。');
  if (s.flags.fan === 'show') out.push('阿梵的《凌晨四点的深圳》后来卖了很高的价钱。你手上那幅，他说永远不会让你卖。');
  if (s.flags.zhang === 'storm') out.push('老张再出海前，请你吃了一碗热肠粉。');
  if (s.flags.lan === 'done') out.push('阿兰的女儿在罗湖上了小学，作文写的是《我的妈妈在深圳》。');
  else if (s.flags.lan === 'trap') out.push('那次在罗湖被讹的钱，你一直没好意思跟人提。');
  if (s.flags.jie === 'lent') out.push('阿杰后来当上了线长，逢人就说起借他五百块的那个老乡。');
  else if (s.flags.jie === 'fed') out.push('阿杰每次路过那家猪脚饭，都会想起你。');
  return out;
}
