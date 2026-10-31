// Karaoke subtitles: 3-4 word chunks, [bracketed] words in yellow #FFD700, spoken word pops.
let chunks = [];
let box = null, S = 1;
export async function setupSubs(W, H) {
  box = document.getElementById('subs');
  S = W / 1080;
  box.style.top = Math.round(H * 0.66) + 'px';
  box.style.fontSize = Math.round(84 * S) + 'px';
  try { const r = await fetch('/out/subs.json', { cache: 'no-store' }); if (r.ok) chunks = await r.json(); } catch (e) { chunks = []; }
}
let lastKey = '';
export function updateSubs(t) {
  if (!box) return;
  const c = chunks.find((c) => t >= c.start && t < c.end + 0.0);
  if (!c) { if (lastKey !== '') { box.innerHTML = ''; lastKey = ''; } return; }
  let active = -1;
  c.words.forEach((w, i) => { if (t >= w.start) active = i; });
  const key = c.start + ':' + active;
  if (key === lastKey) return;
  lastKey = key;
  const popAge = active >= 0 ? t - c.words[active].start : 1;
  box.innerHTML = '<div class="chunk">' + c.words.map((w, i) => {
    const on = i === active;
    const stroke = `-webkit-text-stroke:${Math.round(11 * S)}px #0b0b10;`;
    const sc = on ? 1.1 : 1;
    const op = i > active ? 0.78 : 1;
    return `<span class="w${w.hl ? ' y' : ''}" style="${stroke}transform:scale(${sc});opacity:${op}">${w.text}</span>`;
  }).join('') + '</div>';
}
