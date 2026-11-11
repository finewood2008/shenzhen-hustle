// 全部游戏内容（标题、数值、地点、商品、事件）都在这个文件里，改这里即可调整游戏。

export const TITLE = '深圳搞钱记';

export const CONFIG = {
  days: 30,          // 一局的总天数
  startCash: 3000,
  startDebt: 6000,
  debtRate: 0.05,    // 欠款日息
  bankRate: 0.008,   // 存款日息
  capacity: 100,     // 初始背包容量
  storageStep: 50,   // 每次扩容增加的容量
  storageMax: 300,
  storageCost: 4000, // 第 n 次扩容花费 = storageCost * n
  clinicCost: 60,    // 每点体力的花费
  eventChance: 0.4,
  startLoc: 'luohu',
};

// pos: [x, z]，x 向东，z 向南
export const DISTRICTS = [
  { id: 'huaqiangbei', name: '华强北', pos: [0, 2], color: 0xf59e0b, service: null,
    desc: '一米柜台挨着一米柜台，电子货的源头。',
    style: { n: 12, h: [1.5, 4.5], w: [0.8, 1.3], palette: [0xfbbf24, 0xf97316, 0xe5e7eb, 0x94a3b8] } },
  { id: 'futian', name: '福田CBD', pos: [-6, 5], color: 0x3b82f6, service: 'bank',
    desc: '玻璃幕墙里全是银行和写字楼。可以存取款。',
    style: { n: 8, h: [4, 9], w: [0.9, 1.3], palette: [0x60a5fa, 0x93c5fd, 0x1d4ed8, 0xcbd5e1] } },
  { id: 'luohu', name: '罗湖口岸', pos: [8, 7], color: 0xef4444, service: 'debt',
    desc: '过关的人流不断，带货的也多。老乡会在这里，可以还钱。',
    style: { n: 9, h: [1.5, 5], w: [0.9, 1.4], palette: [0xfca5a5, 0xe5e7eb, 0xb91c1c, 0xd6d3d1] } },
  { id: 'dongmen', name: '东门老街', pos: [11.5, -0.5], color: 0xec4899, service: null,
    desc: '步行街人挤人，什么便宜货都好卖。',
    style: { n: 13, h: [0.8, 2.6], w: [0.7, 1.1], palette: [0xf9a8d4, 0xfde68a, 0xfb7185, 0xfef3c7] } },
  { id: 'keji', name: '南山科技园', pos: [-15, 3], color: 0x8b5cf6, service: null,
    desc: '加班的灯光彻夜不灭，硬件创业公司扎堆。',
    style: { n: 9, h: [3, 7.5], w: [0.9, 1.4], palette: [0xa78bfa, 0xddd6fe, 0x6d28d9, 0xe2e8f0] } },
  { id: 'shekou', name: '蛇口', pos: [-18, 10], color: 0x14b8a6, service: null,
    desc: '海风、码头和外国人，愿意为新鲜东西掏钱。',
    style: { n: 9, h: [1, 3.5], w: [0.8, 1.3], palette: [0x5eead4, 0xf0fdfa, 0x0f766e, 0xfed7aa] } },
  { id: 'baoan', name: '宝安西乡', pos: [-24, -4], color: 0x84cc16, service: 'storage',
    desc: '工厂和仓库连成片，海鲜档口也多。可以租仓扩容。',
    style: { n: 10, h: [0.8, 2.2], w: [1.1, 1.8], palette: [0xbef264, 0xd4d4d8, 0x71717a, 0xa3a3a3] } },
  { id: 'longhua', name: '龙华', pos: [-3, -9], color: 0x06b6d4, service: 'clinic',
    desc: '城中村握手楼密密麻麻，住着最多的打工人。社康可以看病。',
    style: { n: 14, h: [1.5, 3.5], w: [0.7, 1.0], palette: [0xa5f3fc, 0xe7e5e4, 0xfde68a, 0xd6d3d1] } },
  { id: 'dafen', name: '大芬村', pos: [16, -6], color: 0xf43f5e, service: null,
    desc: '满村都是画室，油画按批发价论斤卖。',
    style: { n: 12, h: [0.8, 2], w: [0.8, 1.2], palette: [0xfb7185, 0xfacc15, 0x38bdf8, 0x4ade80, 0xc084fc] } },
  { id: 'yantian', name: '盐田港', pos: [27, 3], color: 0x0ea5e9, service: null,
    desc: '集装箱堆成山，进出口的尾货常在这里流出来。',
    style: { n: 14, h: [0.6, 1.8], w: [1.0, 1.9], palette: [0xdc2626, 0x2563eb, 0xf59e0b, 0x16a34a, 0xe5e7eb] } },
];

export const ROADS = [
  ['baoan', 'keji'], ['keji', 'shekou'], ['keji', 'futian'], ['futian', 'huaqiangbei'],
  ['huaqiangbei', 'luohu'], ['huaqiangbei', 'dongmen'], ['luohu', 'dongmen'],
  ['huaqiangbei', 'longhua'], ['longhua', 'baoan'], ['dongmen', 'dafen'],
  ['dafen', 'yantian'], ['luohu', 'yantian'], ['longhua', 'dafen'],
];

// origin: 产地（便宜），demand: 销地（贵）
export const GOODS = [
  { id: 'led', name: 'LED灯带', icon: '💡', min: 10, max: 60, origin: 'baoan', demand: 'dongmen' },
  { id: 'powerbank', name: '充电宝', icon: '🔋', min: 30, max: 130, origin: 'huaqiangbei', demand: 'luohu' },
  { id: 'lychee', name: '南山荔枝', icon: '🍒', min: 60, max: 260, origin: 'keji', demand: 'futian' },
  { id: 'earbuds', name: '蓝牙耳机', icon: '🎧', min: 80, max: 320, origin: 'huaqiangbei', demand: 'longhua' },
  { id: 'oyster', name: '沙井生蚝', icon: '🦪', min: 150, max: 520, origin: 'baoan', demand: 'shekou' },
  { id: 'milk', name: '进口奶粉', icon: '🍼', min: 200, max: 720, origin: 'luohu', demand: 'longhua' },
  { id: 'painting', name: '大芬油画', icon: '🖼️', min: 300, max: 1500, origin: 'dafen', demand: 'shekou' },
  { id: 'phone', name: '翻新手机', icon: '📱', min: 600, max: 2600, origin: 'huaqiangbei', demand: 'dongmen' },
  { id: 'gpu', name: '二手显卡', icon: '🖥️', min: 1500, max: 6200, origin: 'yantian', demand: 'keji' },
  { id: 'drone', name: '无人机配件', icon: '🚁', min: 3000, max: 12000, origin: 'keji', demand: 'yantian' },
];

// apply(s, r) 返回事件文案；返回 null 表示这次不触发。
// r: { rand(), int(a, b), pick(arr) }
export const EVENTS = [
  { w: 3, apply(s, r) { s.health -= 15; return '台风过境，你抱着货在雨里蹚了两条街。体力 -15'; } },
  { w: 2, apply(s, r) {
      if (s.cash < 200) return null;
      const n = Math.floor(s.cash * 0.1); s.cash -= n;
      return `晚高峰的地铁上，裤兜被人划开了。现金 -¥${n}`; } },
  { w: 3, apply(s, r) { s.health = Math.min(100, s.health + 12); return '老乡拉你去吃了顿肠粉配糖水。体力 +12'; } },
  { w: 3, apply(s, r) { const n = r.int(2, 6) * 100; s.cash += n; return `档口老板缺人手，你帮忙卸了一车货。现金 +¥${n}`; } },
  { w: 2, apply(s, r) {
      const n = Math.min(s.cash, 300); if (n <= 0) return null; s.cash -= n;
      return `房东在楼道贴了通知：下月起涨租，先补差价。现金 -¥${n}`; } },
  { w: 2, apply(s, r) {
      const ids = Object.keys(s.inv); if (!ids.length) return null;
      const id = r.pick(ids), it = s.inv[id];
      const n = Math.max(1, Math.floor(it.qty * 0.3));
      it.cost -= Math.round(it.cost * n / it.qty); it.qty -= n;
      if (it.qty <= 0) delete s.inv[id];
      return { text: '市场抽检，拿不出票据的货被暂扣了。', lost: { id, qty: n } }; } },
  { w: 2, apply(s, r) {
      const free = s.capacity - Object.values(s.inv).reduce((a, b) => a + b.qty, 0);
      const n = Math.min(free, r.int(3, 8)); if (n <= 0) return null;
      const id = r.pick(['led', 'powerbank', 'earbuds']);
      const it = s.inv[id] || (s.inv[id] = { qty: 0, cost: 0 }); it.qty += n;
      return { text: '路过会展中心，参展商撤展前把样品塞给了你。', gained: { id, qty: n } }; } },
  { w: 2, apply(s, r) {
      const n = Math.min(s.cash, 200); if (n <= 0) return null; s.cash -= n; s.health -= 5;
      return `送货的电单车被扣了，交了罚款还走了一路。现金 -¥${n}，体力 -5`; } },
  { w: 2, apply(s, r) { s.health = Math.min(100, s.health + 8); return '清早爬了趟莲花山，出了一身汗。体力 +8'; } },
  { w: 2, apply(s, r) { s.health -= 10; s.cash += 400; return '接了个通宵打包发货的急活。现金 +¥400，体力 -10'; } },
];

export const RANKS = [
  [-Infinity, '欠债跑路', '这座城市没留住你，债主倒是还记得你。'],
  [0, '勉强回本', '没赚到钱，但至少把这座城市的路跑熟了。'],
  [50000, '档口小老板', '在华强北租得起一米柜台了。'],
  [300000, '城中村房东的朋友', '房东开始主动跟你打招呼。'],
  [1500000, '供应链老手', '报个型号，你就知道哪里拿货最便宜。'],
  [8000000, '鹏城传说', '后来的人，都是听着你的故事来深圳的。'],
];

// 街区里的档口：每个档口经营一类商品
export const STALLS = [
  { id: 'small', name: '小商品档', icon: '🔌', color: 0xf97316, goods: ['led', 'powerbank', 'earbuds'] },
  { id: 'local', name: '土特产档', icon: '🧺', color: 0x16a34a, goods: ['lychee', 'oyster', 'milk'] },
  { id: 'premium', name: '尖货档', icon: '💎', color: 0x7c3aed, goods: ['painting', 'phone', 'gpu', 'drone'] },
];

export const SERVICES = {
  bank: { name: '银行', icon: '🏦' },
  debt: { name: '老乡会', icon: '🤝' },
  clinic: { name: '社康', icon: '🏥' },
  storage: { name: '租仓点', icon: '📦' },
};
