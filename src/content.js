// 全部游戏内容（标题、数值、地点、商品、事件）都在这个文件里，改这里即可调整游戏。

export const TITLE = '潘潘浮生记';

export const CONFIG = {
  days: 30,          // 一局的总天数
  startCash: 3000,
  startDebt: 6000,
  debtRate: 0.04,    // 欠款日息
  bankRate: 0.008,   // 存款日息
  capacity: 100,     // 初始背包容量
  storageStep: 50,   // 每次扩容增加的容量
  storageMax: 300,
  storageCost: 4000, // 第 n 次扩容花费 = storageCost * n
  clinicCost: 30,    // 每点体力的花费
  // 行情：每样货每天的价格 = 最低价 + (最高价 − 最低价) × u，u 以 0.5 为中心、在 ±priceSpread/2 之内，越靠中间越常见
  // 这一组数是用三种水平的模拟玩家各跑几百局调出来的：
  // 乱逛的新手约三成亏本，会看行情的普通玩家中位十几二十万，熟悉产地销地的高手中位一两百万。
  priceSpread: 0.6,
  originMult: 0.8,   // 产地的价格倍数
  demandMult: 1.2,   // 销地的价格倍数
  rumorUp: [1.6, 2.2],     // 小道消息说“要涨”时的价格倍数范围
  rumorDown: [0.45, 0.65], // 说“要跌”时
  tagLow: 0.38, tagHigh: 0.62, // 面板上标“便宜 / 走俏”的分界（u 值）
  fatigue: 3,        // 每换一次区掉多少体力；电单车和面包车各少掉 1 点、2 点
  livingCost: 80,    // 每过一天的房租饭钱；付不起就饿着，掉体力
  eventChance: 0.4,
  orderChance: 0.45, // 每次到站被人找上门下订单的概率
  orderMax: 2,       // 同时最多接几单
  orderPremium: 1.25, // 订单单价 = 这种货的中间价 × 这个倍数
  haggleBase: 0.35,  // 砍价的基础成功率，每点人情再加 haggleFavor
  haggleFavor: 0.07,
  haggleWin: 0.88,   // 砍价成功 / 失败后，这个档口今天的价格倍数
  haggleLose: 1.06,
  borrowBase: 10000, // 老乡会的借款额度 = borrowBase + 人情 × borrowFavor，减去已欠的
  borrowFavor: 3000,
  newsChance: 0.45,  // 每过一天，出“今日大事”的概率
  tipLie: 0.5,       // 路人给的行情消息是假的概率
  shadyChance: 0.3,  // 每次到站，有档口在卖“烧心货”的概率
  shadyPrice: 0.7,   // 烧心货的进价是正价的几成
  shadyCatch: 0.4,   // 转手卖烧心货被退货的概率
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

// 随机事件现在是带对话的小场景，写在 story.js 的 EVENT_SCENES 里。

export const RANKS = [
  [-Infinity, '欠债跑路', '这座城市没留住你，债主倒是还记得你。'],
  [0, '勉强回本', '没赚到钱，但至少把这座城市的路跑熟了。'],
  [50000, '档口小老板', '在华强北租得起一米柜台了。'],
  [300000, '城中村房东的朋友', '房东开始主动跟你打招呼。'],
  [1500000, '供应链老手', '报个型号，你就知道哪里拿货最便宜。'],
  [8000000, '鹏城传说', '后来的人，都是听着你的故事来深圳的。'],
];

// 街区里的档口：每个档口经营一类商品
// 交通工具：在宝安的租仓点买。cap 是多出来的背包容量，speed 是街上走路的倍速，fuel 是每趟的油钱。
// 面包车一天能跑两趟：每天第二次换区不过夜。
export const VEHICLES = {
  ebike: { name: '二手电单车', icon: '🛵', cost: 2500, cap: 50, speed: 1.6, fuel: 0, desc: '背包 +50，街上走得快六成' },
  van: { name: '二手面包车', icon: '🚐', cost: 18000, cap: 150, speed: 1, fuel: 150, desc: '背包 +150，每天能多跑一个区，每趟油钱 ¥150' },
};

// 今日大事：每过一天有概率出一条，当天改变规则。
// mult + goods：这些货（不写 goods 就是全部）今天的价格倍数；其余字段见 logic.js
const ELEC = ['led', 'powerbank', 'earbuds', 'phone', 'gpu', 'drone'];
export const NEWS = [
  { id: 'expo', title: '华强北电子展开幕', text: '全城都在找电子货，电子类今天贵两成半。', mult: 1.25, goods: ELEC },
  { id: 'coupon', title: '全城发消费券', text: '人人都在花钱，今天所有货贵一成半。', mult: 1.15 },
  { id: 'sale', title: '换季清仓日', text: '档口都在甩货，今天所有货便宜两成。', mult: 0.8 },
  { id: 'typhoon', title: '台风黄色预警', text: '出门一趟掉 8 点体力；荔枝和生蚝运不进来，贵三成。', mult: 1.3, goods: ['lychee', 'oyster'], health: -8 },
  { id: 'customs', title: '海关联合严查', text: '今天没人敢卖烧心货；手里有的，出手必被退。', catchAll: true },
  { id: 'nightmarket', title: '夜市文化节', text: '老板们心情好，今天砍价成功率加两成半。', haggle: 0.25 },
  { id: 'audit', title: '市场统一明码标价', text: '今天所有档口不讲价。', noHaggle: true },
  { id: 'reunion', title: '老乡会年会', text: '炳叔高兴，昨晚的利息免了。', noInterest: true },
  { id: 'chip', title: '显卡又缺货了', text: '二手显卡和无人机配件今天贵四成。', mult: 1.4, goods: ['gpu', 'drone'] },
  { id: 'port', title: '口岸通关提速', text: '进口奶粉和翻新手机今天便宜三成。', mult: 0.7, goods: ['milk', 'phone'] },
];

// 档口老板的招呼语，按天轮换
export const GREETINGS = {
  small: ['贵是贵点，但用了不烧机。', '便宜的隔壁有，炸不炸我可不敢说。', '我这的规矩：坏了包换，价钱不讲。', '先把规矩立住，一手钱一手货。'],
  local: ['贵是贵点，但吃了不烧心。', '隔夜的我不卖，宁可倒掉。', '宁可少挣点，秤不能短。', '尝一个？不甜不要钱。'],
  premium: ['我这只走正路货，拿着不烧手。', '价钱不虚，来路清楚，这是规矩。', '规矩立住了，回头客才多。', '识货的人不用我多说。'],
};

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
