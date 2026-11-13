// 昵称：随机分配，玩家可以改。改的时候做长度限制和基础的不良词过滤。
const PLACES = ['福田', '罗湖', '南山', '宝安', '龙华', '盐田', '蛇口', '东门', '大芬', '华强北'];
const GIVEN = ['阿明', '小芳', '阿强', '阿珍', '大伟', '小林', '阿欣', '老陈', '小敏', '阿豪', '阿杰', '小雨', '阿东', '小青', '大刘', '阿凤'];
export function randomName() {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  return pick(PLACES) + pick(GIVEN) + String(1000 + Math.floor(Math.random() * 9000));
}
// 过滤表只收最常见的脏话和明显不合适的词，做不到万无一失
const BANNED = ['傻逼', '傻b', 'sb', '操你', '草泥马', '他妈', '尼玛', '妈的', '狗日', '鸡巴', '屌', '婊', '贱人', '去死', '杀人', '强奸', '色情', '赌博', '毒品', '法轮', '习近平', '共产党', '台独', '港独', '疆独', '藏独',
  'fuck', 'shit', 'bitch', 'nigger', 'cunt', 'dick', 'pussy', 'admin', '管理员', '官方', '客服'];
// 返回清理后的昵称；不合适或为空则返回 null
export function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const name = [...raw.normalize('NFKC').replace(/[\x00-\x1f\x7f<>&"'`\\\u200b-\u200f\u2028-\u202f\ufeff]/g, '').trim()].slice(0, 10).join('');
  if (!name) return null;
  const low = name.toLowerCase().replace(/[\s._\-*]/g, '');
  return BANNED.some(w => low.includes(w)) ? null : name;
}
