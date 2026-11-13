// 玩家可以自定义的东西：界面外观与布局、游戏偏好、主角形象。存在浏览器本地，下次打开还在。

const KEY = 'sz-settings';

export const THEMES = [
  { id: 'night', name: '夜色', swatch: ['#0f1420', '#16c784'] },
  { id: 'neon', name: '霓虹', swatch: ['#1a1030', '#22d3ee'] },
  { id: 'day', name: '白天', swatch: ['#ffffff', '#07c160'] },
];
export const SIZES = [{ id: 's', name: '小' }, { id: 'm', name: '中' }, { id: 'l', name: '大' }];
export const SPEEDS = [{ id: 40, name: '慢' }, { id: 24, name: '中' }, { id: 10, name: '快' }, { id: 0, name: '直接显示' }];
// 余额卡片下面可以显示的状态项
export const STATS = [
  { id: 'debt', name: '待还' }, { id: 'bank', name: '存款' }, { id: 'health', name: '体力' },
  { id: 'pack', name: '背包' }, { id: 'favor', name: '人情' },
];
export const SHIRTS = [0xff5a1f, 0xef4444, 0x3b82f6, 0x22c55e, 0xfacc15, 0xa855f7, 0x14b8a6, 0xf8fafc, 0x1f2937];
export const PACKS = [0x2563eb, 0x475569, 0xdc2626, 0x16a34a, 0xf59e0b, 0x111827];
export const HAIRSTYLES = [
  { id: 'short', name: '短发' }, { id: 'long', name: '长发' }, { id: 'bun', name: '丸子头' },
  { id: 'cap', name: '鸭舌帽' }, { id: 'bald', name: '光头' },
];

// 现成的造型，一键套用
export const PRESETS = [
  { name: '稳重款', shirt: 0xff5a1f, pack: 0x2563eb, hair: 'short', skirt: false },
  { name: '学生款', shirt: 0xf8fafc, pack: 0x475569, hair: 'long', skirt: true },
  { name: '码农款', shirt: 0x1f2937, pack: 0x111827, hair: 'short', skirt: false },
  { name: '潮流款', shirt: 0xa855f7, pack: 0xdc2626, hair: 'cap', skirt: false },
  { name: '干练款', shirt: 0xef4444, pack: 0xf59e0b, hair: 'bun', skirt: true },
  { name: '硬汉款', shirt: 0x14b8a6, pack: 0x16a34a, hair: 'bald', skirt: false },
];
export const NAMES = ['阿明', '小芳', '阿强', '阿珍', '大伟', '小林', '阿欣', '老陈', '小敏', '阿豪'];

const DEFAULTS = {
  theme: 'night', size: 'm', side: 'right',
  stats: { debt: true, bank: true, health: true, pack: true, favor: true },
  showOrders: true, showLog: true,
  view: 'iso', speed: 24,
  hero: { name: '', shirt: SHIRTS[0], pack: PACKS[0], hair: 'short', skirt: false },
};

function load() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { /* 读不了就用默认值 */ }
  return { ...DEFAULTS, ...saved, stats: { ...DEFAULTS.stats, ...saved.stats }, hero: { ...DEFAULTS.hero, ...saved.hero } };
}

export const settings = load();

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* 存不了就算了 */ }
}

// 把外观类的设置落到 <body> 上，样式表按这些属性换主题和布局
export function applySettings() {
  const b = document.body.dataset;
  b.theme = settings.theme; b.size = settings.size; b.side = settings.side;
}

export const heroName = () => settings.hero.name.trim() || '你';
// 主角在街上的 3D 小人用的参数
export const heroLook = () => ({
  shirt: settings.hero.shirt, pack: settings.hero.pack, hairStyle: settings.hero.hair,
  skirt: settings.hero.skirt, pants: 0x1f2937, hat: settings.hero.shirt, scale: 1.2,
});
