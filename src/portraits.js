// 对话头像：用参数拼出来的扁平风 SVG。想换成插画，把 portrait() 改成返回 <img> 即可。
// 画布 200 × 220，脸的中线在 x = 100。

const LOOKS = {
  bing: { bg: ['#4d6b58', '#22332a'], skin: '#d6a179', hair: '#a3a8ad', style: 'receding', jaw: 34, w: 45,
    shirt: '#2f6b52', collar: 'polo', glasses: true, wrinkles: true, brow: '#7b8085', browW: 5.5 },
  jie: { bg: ['#5b86c4', '#27406b'], skin: '#ecbd96', hair: '#211b18', style: 'fringe', jaw: 22, w: 39,
    shirt: '#e9c46a', collar: 'tee', straps: '#6b4f35', blush: true, brow: '#211b18', browW: 4 },
  biao: { bg: ['#7a2f40', '#2a1118'], skin: '#c48b62', hair: '#15110f', style: 'buzz', jaw: 42, w: 46,
    shirt: '#17191e', collar: 'tee', chain: true, scar: true, brow: '#15110f', browW: 7 },
};

// 把颜色调暗（k < 0）或调亮（k > 0）
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(c => f(c).toString(16).padStart(2, '0')).join('');
}

function hair(L) {
  const w = L.w, l = 100 - w, r = 100 + w;
  if (L.style === 'buzz') {
    return `<path d="M${l - 1} 84 C${l - 3} 22 ${r + 3} 22 ${r + 1} 84 C${r - 8} 54 ${l + 8} 54 ${l - 1} 84Z" fill="${L.hair}"/>
      <path d="M${l + 6} 62 Q100 48 ${r - 6} 62" stroke="${shade(L.hair, 0.25)}" stroke-width="2" fill="none" opacity=".5"/>`;
  }
  if (L.style === 'receding') {
    const side = x => `<path d="M${x(-3)} 96 C${x(-7)} 62 ${x(6)} 42 ${x(22)} 38 C${x(12)} 54 ${x(9)} 74 ${x(7)} 96Z" fill="${L.hair}"/>`;
    return side(d => l + d) + side(d => r - d) +
      `<path d="M72 41 Q100 27 128 41 Q100 35 72 41Z" fill="${L.hair}" opacity=".8"/>`;
  }
  // fringe：盖住额头的碎刘海
  return `<path d="M${l - 4} 94 C${l - 9} 14 ${r + 9} 14 ${r + 4} 94 L${r - 3} 70 L${r - 14} 80 L114 62 L102 78 L90 60 L78 78 L${l + 9} 64 L${l + 2} 76 Z" fill="${L.hair}"/>
    <path d="M84 34 Q100 26 118 36" stroke="${shade(L.hair, 0.3)}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/>`;
}

function face(L, mood) {
  const ink = '#2a1d16', line = shade(L.skin, -0.32);
  // 眉毛：内侧 / 外侧的高度随表情变
  const [bi, bo] = { plain: [0, 0], smile: [-2, -1], angry: [6, -4], sad: [-5, 2] }[mood];
  const brow = sgn => `<path d="M${100 + sgn * 10} ${78 + bi} L${100 + sgn * 30} ${77 + bo}" stroke="${L.brow}" stroke-width="${L.browW}" stroke-linecap="round"/>`;
  const eye = x => mood === 'smile'
    ? `<path d="M${x - 8} 94 Q${x} 86 ${x + 8} 94" stroke="${ink}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`
    : `<ellipse cx="${x}" cy="93" rx="8" ry="${mood === 'angry' ? 4.4 : 5.6}" fill="#fff"/>
       <circle cx="${x}" cy="${mood === 'sad' ? 94.5 : 93}" r="3.9" fill="${ink}"/>
       <circle cx="${x + 1.4}" cy="91.6" r="1.2" fill="#fff"/>
       <path d="M${x - 8.5} 90.5 Q${x} ${mood === 'angry' ? 88.5 : 85} ${x + 8.5} 90.5" stroke="${ink}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  const mouth = {
    plain: `<path d="M89 126 Q100 128.5 111 126" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    smile: `<path d="M85 122 Q100 138 115 122Z" fill="#fff" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>`,
    angry: `<path d="M87 129 Q100 121 113 129" stroke="${ink}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`,
    sad: `<path d="M90 128 Q100 123 110 128" stroke="${ink}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`,
  }[mood];
  let extra = '';
  if (L.wrinkles) extra += `<path d="M82 60 Q100 56 118 60 M86 67 Q100 64 114 67" stroke="${line}" stroke-width="1.6" fill="none" opacity=".7"/>
    <path d="M80 112 Q77 120 81 128 M120 112 Q123 120 119 128" stroke="${line}" stroke-width="1.8" fill="none" opacity=".7"/>`;
  if (L.blush) extra += `<circle cx="72" cy="110" r="8" fill="#f08a7a" opacity=".28"/><circle cx="128" cy="110" r="8" fill="#f08a7a" opacity=".28"/>`;
  if (L.scar) extra += `<path d="M124 66 L134 88" stroke="${shade(L.skin, 0.35)}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M126 73 l6 -2 M128 80 l6 -2" stroke="${shade(L.skin, 0.35)}" stroke-width="1.6"/>`;
  if (L.glasses) extra += `<g fill="rgba(255,255,255,.14)" stroke="#2b2622" stroke-width="3">
    <rect x="66" y="82" width="30" height="23" rx="7"/><rect x="104" y="82" width="30" height="23" rx="7"/></g>
    <path d="M96 91 Q100 88 104 91 M66 90 L${100 - L.w} 88 M134 90 L${100 + L.w} 88" stroke="#2b2622" stroke-width="3" fill="none"/>`;
  return brow(-1) + brow(1) + eye(81) + eye(119) +
    `<path d="M100 97 L96 111 Q100 114.5 104.5 111" stroke="${line}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
    mouth + extra;
}

function body(L) {
  const dark = shade(L.shirt, -0.25), light = shade(L.shirt, 0.18);
  let s = `<path d="M6 220 C6 172 46 162 78 156 L122 156 C154 162 194 172 194 220Z" fill="${L.shirt}"/>
    <path d="M150 164 C176 172 194 184 194 220 L160 220Z" fill="${dark}" opacity=".5"/>`;
  if (L.straps) s += `<path d="M52 162 L70 158 L76 220 L56 220Z M148 162 L130 158 L124 220 L144 220Z" fill="${L.straps}"/>`;
  s += `<rect x="83" y="126" width="34" height="40" rx="12" fill="${shade(L.skin, -0.14)}"/>`;
  if (L.collar === 'polo') {
    s += `<path d="M82 156 Q100 180 118 156 L118 150 L82 150Z" fill="${shade(L.skin, -0.14)}"/>
      <path d="M80 152 L100 178 L86 190 L66 160Z M120 152 L100 178 L114 190 L134 160Z" fill="${light}"/>
      <path d="M100 180 L100 220" stroke="${dark}" stroke-width="2.5"/><circle cx="100" cy="196" r="2.4" fill="${dark}"/>`;
  } else {
    s += `<path d="M78 155 Q100 184 122 155 L118 148 L82 148Z" fill="${shade(L.skin, -0.14)}"/>
      <path d="M78 155 Q100 184 122 155" stroke="${dark}" stroke-width="4" fill="none"/>`;
  }
  if (L.chain) s += `<path d="M80 160 Q100 196 120 160" stroke="#e7b93c" stroke-width="4.5" fill="none" stroke-dasharray="5 3" stroke-linecap="round"/>`;
  return s;
}

export function portrait(id, mood = 'plain') {
  const L = LOOKS[id];
  if (!L) return '';
  if (!['plain', 'smile', 'angry', 'sad'].includes(mood)) mood = 'plain';
  const w = L.w, l = 100 - w, r = 100 + w, j = L.jaw;
  const head = `M${l} 84 C${l} 28 ${r} 28 ${r} 84 C${r} 122 ${100 + j} 146 100 146 C${100 - j} 146 ${l} 122 ${l} 84Z`;
  return `<svg viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg" role="img">
    <defs>
      <linearGradient id="pbg-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${L.bg[0]}"/><stop offset="1" stop-color="${L.bg[1]}"/></linearGradient>
      <clipPath id="phead-${id}"><path d="${head}"/></clipPath>
    </defs>
    <rect width="200" height="220" fill="url(#pbg-${id})"/>
    <circle cx="150" cy="50" r="70" fill="#fff" opacity=".06"/>
    ${body(L)}
    <ellipse cx="${l}" cy="97" rx="7" ry="11" fill="${shade(L.skin, -0.1)}"/><ellipse cx="${r}" cy="97" rx="7" ry="11" fill="${shade(L.skin, -0.1)}"/>
    <path d="${head}" fill="${L.skin}"/>
    <g clip-path="url(#phead-${id})"><rect x="112" y="20" width="60" height="140" fill="#000" opacity=".07"/>
      <ellipse cx="100" cy="150" rx="40" ry="12" fill="#000" opacity=".06"/></g>
    ${hair(L)}
    ${face(L, mood)}
  </svg>`;
}
