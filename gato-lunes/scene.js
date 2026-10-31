// Renderizador determinista: drawFrame(t) dibuja el fotograma del segundo t.
// Estilo: vector plano 2D, contornos negros gruesos, cel-shading suave, 9:16.
const W = 1080, H = 1920;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const DATA = window.DATA;
const OL = '#1b1b1f';          // contorno
const LW = 9;                  // grosor de contorno base
const SHIRT = '#5f7fa6', SHIRT_D = '#4c6a8f', PANTS = '#8b9099', PANTS_D = '#737882';
const CAT = '#f29a3a', CAT_D = '#d97f22', CAT_L = '#fbd7a6', STRIPE = '#c8661a';
const GOLD = '#ffc94d', YEL = '#FFD700';
let T = 0; const blink = k => ((T + k) % 3.3) < 0.11;
// cinemática inversa de 2 segmentos (convención a=0 abajo)
function ik(dx, dy, L1, L2, bend = 1) { const d = Math.min(Math.hypot(dx, dy), L1 + L2 - 1); const b = Math.atan2(dx, dy); const c = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)))); const a1 = b + bend * c; const ex = Math.sin(a1) * L1, ey = Math.cos(a1) * L1; return [a1, Math.atan2(dx - ex, dy - ey)]; }

// ---------- utilidades ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const eOut = k => 1 - Math.pow(1 - clamp(k), 3);
const eBack = k => { k = clamp(k); const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const seg = (u, a, b) => clamp((u - a) / (b - a));
const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
const mixc = (c1, c2, k) => { const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); const a = p(c1), b = p(c2); return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], k))).join(',')})`; };

function path(pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); }
function fillStroke(fill, lw = LW, stroke = OL) { if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); } }
function ell(x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, Math.PI * 2); }
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
// tubo con contorno (extremidades)
function tube(pts, w, col, ol = LW) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  path(pts); ctx.lineWidth = w + ol * 2; ctx.strokeStyle = OL; ctx.stroke();
  path(pts); ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke();
}
const dir = (a, l) => [Math.sin(a) * l, Math.cos(a) * l];   // a=0 -> abajo
function save(f) { ctx.save(); f(); ctx.restore(); }

// ---------- personaje palito ----------
// p: {x,y (cadera), s, rot, headTilt, eyes:'open'|'half'|'closed'|'down', mouth:'line'|'groan'|'smile'|'frown',
//     armL:[a1,a2], armR:[a1,a2], legL:[a1,a2], legR:[a1,a2], hold: fn(handR) }
function person(p) {
  save(() => {
    ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0); ctx.scale(p.s || 1, p.s || 1);
    const torso = 250, sh = [0, -torso];
    const legs = [p.legL || [0.12, 0.05], p.legR || [-0.12, -0.05]];
    const arms = [p.armL || [0.25, 0.15], p.armR || [-0.25, -0.15]];
    const UL = 165, LL = 160, UA = 125, LA = 120;
    // piernas (pantalón gris)
    legs.forEach((l, i) => {
      const hip = [i ? -28 : 28, -10];
      const k = [hip[0] + dir(l[0], UL)[0], hip[1] + dir(l[0], UL)[1]];
      const f = [k[0] + dir(l[1], LL)[0], k[1] + dir(l[1], LL)[1]];
      tube([hip, k, f], 46, i ? PANTS_D : PANTS);
      ell(f[0] + (i ? -14 : 14), f[1] + 14, 34, 18); fillStroke('#2b2b30', 6);
    });
    // brazo trasero
    const drawArm = (a, i) => {
      const s0 = [i ? -78 : 78, sh[1] + 30];
      const e = [s0[0] + dir(a[0], UA)[0], s0[1] + dir(a[0], UA)[1]];
      const h = [e[0] + dir(a[1], LA)[0], e[1] + dir(a[1], LA)[1]];
      tube([s0, e, h], 22, '#ffffff');
      // manga
      const m = [s0[0] + dir(a[0], 55)[0], s0[1] + dir(a[0], 55)[1]];
      tube([s0, m], 46, i ? SHIRT_D : SHIRT, 7);
      ell(h[0], h[1], 17, 17); fillStroke('#fff', 7);
      return h;
    };
    const hL = drawArm(arms[0], 0);
    // torso camiseta
    ctx.beginPath();
    ctx.moveTo(-95, sh[1] + 10); ctx.quadraticCurveTo(-100, sh[1] - 8, -70, sh[1] - 14);
    ctx.lineTo(70, sh[1] - 14); ctx.quadraticCurveTo(100, sh[1] - 8, 95, sh[1] + 10);
    ctx.lineTo(80, 8); ctx.quadraticCurveTo(0, 22, -80, 8); ctx.closePath();
    fillStroke(SHIRT);
    save(() => { ctx.clip(); ctx.fillStyle = SHIRT_D; ctx.fillRect(30, sh[1] - 20, 80, torso + 50); }); // cel-shading
    ctx.beginPath(); ctx.moveTo(-95, sh[1] + 10); ctx.quadraticCurveTo(-100, sh[1] - 8, -70, sh[1] - 14); ctx.lineTo(70, sh[1] - 14); ctx.quadraticCurveTo(100, sh[1] - 8, 95, sh[1] + 10); ctx.lineTo(80, 8); ctx.quadraticCurveTo(0, 22, -80, 8); ctx.closePath(); fillStroke(null);
    // cuello
    tube([[0, sh[1] - 10], [0, sh[1] - 40]], 22, '#fff', 7);
    // cabeza
    save(() => {
      ctx.translate(0, sh[1] - 40); ctx.rotate(p.headTilt || 0); ctx.translate(0, -100);
      head(p);
    });
    const hR = drawArm(arms[1], 1);
    if (p.hold) p.hold(hR, hL);
  });
}
function head(p) {
  ell(0, 0, 108, 108); fillStroke('#ffffff', 10);
  save(() => { ell(0, 0, 108, 108); ctx.clip(); ell(40, 30, 100, 110); ctx.fillStyle = '#e3e8ef'; ctx.fill(); });
  ell(0, 0, 108, 108); fillStroke(null, 10);
  const ey = p.eyeY ?? 0, ex = p.eyeX ?? 0; let e = p.eyes || 'open'; if (e === 'open' && blink(0.7)) e = 'closed';
  [-38, 38].forEach(x => {
    ctx.fillStyle = OL;
    if (e === 'closed') { ctx.beginPath(); ctx.arc(x + ex, ey - 4, 16, 0.15 * Math.PI, 0.85 * Math.PI); ctx.lineWidth = 8; ctx.strokeStyle = OL; ctx.stroke(); }
    else if (e === 'half') {
      ell(x + ex, ey + 4, 13, 10); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + ex - 22, ey - 4); ctx.lineTo(x + ex + 22, ey - 2); ctx.lineWidth = 8; ctx.strokeStyle = OL; ctx.stroke();
    } else { ell(x + ex, ey + (e === 'down' ? 10 : 0), 13, e === 'wide' ? 24 : 20); ctx.fill(); ell(x + ex + 4, ey - 6 + (e === 'down' ? 10 : 0), 4, 5); ctx.fillStyle = '#fff'; ctx.fill(); }
  });
  ctx.lineWidth = 8; ctx.strokeStyle = OL; ctx.lineCap = 'round';
  const my = 52 + ey * 0.5, m = p.mouth || 'line';
  ctx.beginPath();
  if (m === 'line') { ctx.moveTo(-26 + ex, my); ctx.lineTo(26 + ex, my); }
  else if (m === 'smile') { ctx.arc(ex, my - 22, 28, 0.25 * Math.PI, 0.75 * Math.PI); }
  else if (m === 'frown') { ctx.arc(ex, my + 22, 26, 1.25 * Math.PI, 1.75 * Math.PI); }
  else if (m === 'groan') { const w = p.wob || 0; ctx.moveTo(-30, my); for (let i = 1; i <= 6; i++) ctx.lineTo(-30 + i * 10, my + (i % 2 ? -7 : 7) * (0.6 + 0.4 * Math.sin(w + i))); }
  ctx.stroke();
}

// ---------- gato ----------
function stripes(list) { ctx.strokeStyle = STRIPE; ctx.lineCap = 'round'; list.forEach(([x1, y1, x2, y2, w]) => { ctx.lineWidth = w || 12; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }); }
function catHead(c) {
  // c: earsBack 0..1, eyes 'open'|'wide'|'closed'|'one'|'focus', pupil 0..1, look [x,y]
  const eb = c.earsBack || 0;
  const ear = sgn => {
    save(() => {
      ctx.translate(sgn * 62, -62); ctx.rotate(sgn * (0.25 + eb * 0.9)); ctx.scale(1, 1 - eb * 0.35);
      path([[-38, 18], [sgn * 4, -78], [38, 18]]); ctx.closePath(); fillStroke(CAT);
      path([[-20, 10], [sgn * 3, -48], [20, 10]]); ctx.closePath(); ctx.fillStyle = '#f7b9a7'; ctx.fill();
    });
  };
  ear(-1); ear(1);
  ell(0, 0, 118, 100); fillStroke(CAT);
  save(() => { ell(0, 0, 118, 100); ctx.clip(); ell(55, 45, 110, 90); ctx.fillStyle = CAT_D; ctx.globalAlpha = .45; ctx.fill(); ctx.globalAlpha = 1;
    stripes([[0, -100, 0, -62, 13], [-30, -96, -24, -66, 11], [30, -96, 24, -66, 11], [-118, 10, -84, 14, 11], [118, 10, 84, 14, 11], [-116, 36, -88, 34, 10], [116, 36, 88, 34, 10]]);
    ell(0, 52, 62, 40); ctx.fillStyle = CAT_L; ctx.fill(); });
  ell(0, 0, 118, 100); fillStroke(null);
  const lx = (c.look || [0, 0])[0], ly = (c.look || [0, 0])[1]; let e = c.eyes || 'open'; if ((e === 'open' || e === 'focus') && blink(c.bk || 0)) e = 'closed';
  [-46, 46].forEach((x, i) => {
    if (e === 'closed' || (e === 'one' && i === 0)) {
      ctx.beginPath(); ctx.arc(x, 0, 20, 0.15 * Math.PI, 0.85 * Math.PI); ctx.lineWidth = 8; ctx.strokeStyle = OL; ctx.stroke(); return;
    }
    const big = e === 'wide' || e === 'focus' ? 1.25 : 1;
    ell(x, -2, 26 * big, 30 * big); fillStroke('#fff8e0', 7);
    const pr = lerp(7, 21, c.pupil ?? 0.35) * big;
    ell(x + lx * 8, -2 + ly * 8, Math.min(pr, 22 * big), 24 * big); ctx.fillStyle = OL; ctx.fill();
    ell(x + lx * 8 + 7, -12 + ly * 8, 6, 7); ctx.fillStyle = '#fff'; ctx.fill();
  });
  // nariz y boca
  path([[-11, 30], [11, 30], [0, 42]]); ctx.closePath(); fillStroke('#e47a8a', 5);
  ctx.beginPath(); ctx.moveTo(0, 42); ctx.quadraticCurveTo(-8, 58, -22, 52); ctx.moveTo(0, 42); ctx.quadraticCurveTo(8, 58, 22, 52); ctx.lineWidth = 6; ctx.strokeStyle = OL; ctx.stroke();
  // bigotes
  ctx.lineWidth = 4; [-1, 1].forEach(s => { [[0, -4], [12, 6]].forEach(([y, d]) => { ctx.beginPath(); ctx.moveTo(s * 66, 36 + y); ctx.lineTo(s * 132, 30 + y + d); ctx.stroke(); }); });
}
// gato sentado de frente. c: x,y (base), s, tail (fase), xray(bool)
function catSit(c) {
  save(() => {
    ctx.translate(c.x, c.y); ctx.scale(c.s || 1, c.s || 1);
    if (c.xray) ctx.globalAlpha = 0.32;
    // cola
    const tw = Math.sin(c.tail || 0) * 25;
    tube([[90, -30], [170, -50], [190 + tw, -130], [160 + tw * 1.4, -200]], 34, CAT);
    // cuerpo
    ctx.beginPath(); ctx.moveTo(-70, -250); ctx.bezierCurveTo(-150, -150, -150, 0, -100, 0); ctx.lineTo(100, 0); ctx.bezierCurveTo(150, 0, 150, -150, 70, -250); ctx.closePath();
    fillStroke(CAT);
    save(() => { ctx.clip(); ctx.fillStyle = CAT_D; ctx.globalAlpha *= .5; ell(90, -90, 70, 180); ctx.fill(); ctx.globalAlpha = c.xray ? .32 : 1;
      ell(0, -120, 58, 110); ctx.fillStyle = CAT_L; ctx.fill(); stripes([[-140, -150, -100, -140], [-145, -100, -102, -96], [140, -150, 100, -140], [145, -100, 102, -96]]); });
    ctx.beginPath(); ctx.moveTo(-70, -250); ctx.bezierCurveTo(-150, -150, -150, 0, -100, 0); ctx.lineTo(100, 0); ctx.bezierCurveTo(150, 0, 150, -150, 70, -250); ctx.closePath(); fillStroke(null);
    // patas delanteras
    [-38, 38].forEach(x => { rr(x - 24, -110, 48, 112, 24); fillStroke(CAT, 8); ell(x, -4, 30, 18); fillStroke(CAT_L, 7); });
    save(() => { ctx.translate(0, -300 + (c.headY || 0)); ctx.rotate(c.headTilt || 0); catHead(c); });
  });
}
// gato de lado caminando. c: x,y (suelo), s, face(1 der,-1 izq), walk (fase), noseUp 0..1, knead fase
function catSide(c) {
  save(() => {
    ctx.translate(c.x, c.y); ctx.scale((c.s || 1) * (c.face || 1), c.s || 1);
    const w = c.walk || 0, bob = Math.abs(Math.sin(w)) * 6;
    ctx.translate(0, -bob);
    const leg = (x, ph, col, up = 0) => { const a = Math.sin(w + ph) * 0.45; const k = [x + Math.sin(a) * 60, -60 - up]; tube([[x, -120], k, [k[0] + Math.sin(a * 0.6) * 50 + 10, -2 - up * 1.4]], 30, col, 7); };
    leg(-110, Math.PI, CAT_D); leg(70, 0, CAT_D, c.kneadB || 0);
    const tw = Math.sin((c.tail || 0)) * 30;
    tube([[-150, -170], [-230, -230], [-250 + tw, -320], [-215 + tw, -370]], 32, CAT);
    ell(-20, -165, 175, 88); fillStroke(CAT);
    save(() => { ell(-20, -165, 175, 88); ctx.clip(); ell(-10, -110, 170, 50); ctx.fillStyle = CAT_L; ctx.fill();
      stripes([[-120, -250, -105, -190], [-60, -255, -50, -192], [0, -255, 5, -195], [60, -248, 60, -195]]); });
    ell(-20, -165, 175, 88); fillStroke(null);
    leg(-80, 0, CAT); leg(100, Math.PI, CAT, c.kneadA || 0);
    save(() => { ctx.translate(165, -250 - (c.noseUp || 0) * 20); ctx.rotate(-(c.noseUp || 0) * 0.35); ctx.scale(0.85, 0.85); catHead({ ...c, look: [0.8, -(c.noseUp || 0)] }); });
  });
}
// gato acurrucado durmiendo (vista 3/4 superior). c: x,y,s, breath, eyes, tail, xray
function catCurl(c) {
  save(() => {
    ctx.translate(c.x, c.y); const b = 1 + Math.sin(c.breath || 0) * 0.02; ctx.scale((c.s || 1) * b, (c.s || 1) / b);
    if (c.xray) ctx.globalAlpha = 0.32;
    ell(0, 0, 230, 150); fillStroke(CAT);
    save(() => { ell(0, 0, 230, 150); ctx.clip(); ell(60, 60, 220, 120); ctx.fillStyle = CAT_D; ctx.globalAlpha *= .5; ctx.fill(); ctx.globalAlpha = c.xray ? .32 : 1;
      stripes([[-150, -120, -130, -60], [-80, -148, -70, -80], [0, -150, 0, -85], [80, -145, 70, -80], [150, -115, 125, -60]]); });
    ell(0, 0, 230, 150); fillStroke(null);
    // cola envolviendo
    const tw = c.tailFlick || 0;
    tube([[200, 40], [150, 120], [0, 140], [-140, 110 - tw * 60], [-210 - tw * 60, 60 - tw * 330]], 38, CAT);
    // patas
    ell(-40, 100, 45, 26); fillStroke(CAT_L, 7); ell(30, 108, 45, 26); fillStroke(CAT_L, 7);
    save(() => { ctx.translate(-95, 25); ctx.rotate(-0.25); ctx.scale(0.85, 0.85); catHead({ eyes: c.eyes || 'closed', earsBack: 0.1, pupil: c.pupil ?? 0.3, look: c.look }); });
  });
}
// gato de espaldas sentado
function catBack(c) {
  save(() => {
    ctx.translate(c.x, c.y); ctx.scale(c.s || 1, c.s || 1);
    tube([[60, -10], [150, 0], [190, -70 + Math.sin(c.tail || 0) * 10]], 34, CAT);
    ctx.beginPath(); ctx.moveTo(-70, -250); ctx.bezierCurveTo(-150, -150, -150, 0, -100, 0); ctx.lineTo(100, 0); ctx.bezierCurveTo(150, 0, 150, -150, 70, -250); ctx.closePath(); fillStroke(CAT);
    save(() => { ctx.clip(); stripes([[-130, -200, -40, -190, 16], [-140, -130, -30, -125, 16], [-140, -60, -30, -60, 16], [130, -200, 40, -190, 16], [140, -130, 30, -125, 16], [140, -60, 30, -60, 16]]); });
    ctx.beginPath(); ctx.moveTo(-70, -250); ctx.bezierCurveTo(-150, -150, -150, 0, -100, 0); ctx.lineTo(100, 0); ctx.bezierCurveTo(150, 0, 150, -150, 70, -250); ctx.closePath(); fillStroke(null);
    save(() => {
      ctx.translate(0, -300); const eb = c.earsBack || 0;
      [-1, 1].forEach(s => save(() => { ctx.translate(s * 62, -62); ctx.rotate(s * (0.25 + eb * 0.9)); ctx.scale(1, 1 - eb * .35); path([[-38, 18], [s * 4, -78], [38, 18]]); ctx.closePath(); fillStroke(CAT); }));
      ell(0, 0, 118, 100); fillStroke(CAT);
      save(() => { ell(0, 0, 118, 100); ctx.clip(); stripes([[0, -100, 0, -20, 16], [-40, -92, -30, -30, 13], [40, -92, 30, -30, 13]]); });
      ell(0, 0, 118, 100); fillStroke(null);
    });
  });
}
// contorno brillante para modo rayos X
function xrayGlow(fn, col = '#7fe8ff') {
  save(() => { ctx.shadowColor = col; ctx.shadowBlur = 40; fn(); });
}

// ---------- iconos ----------
function clockIcon(x, y, r, ang, col = '#4fe3ff') {
  save(() => {
    ctx.translate(x, y); ctx.shadowColor = col; ctx.shadowBlur = 35;
    ell(0, 0, r, r); ctx.fillStyle = 'rgba(20,60,80,.55)'; ctx.fill(); ctx.lineWidth = 10; ctx.strokeStyle = col; ctx.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.sin(a) * r * .78, Math.cos(a) * r * .78); ctx.lineTo(Math.sin(a) * r * .9, Math.cos(a) * r * .9); ctx.lineWidth = 6; ctx.stroke(); }
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(ang) * r * .7, -Math.cos(ang) * r * .7); ctx.lineWidth = 9; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(ang / 12) * r * .45, -Math.cos(ang / 12) * r * .45); ctx.lineWidth = 13; ctx.stroke();
    ell(0, 0, 10, 10); ctx.fillStyle = col; ctx.fill();
  });
}
function heartIcon(x, y, s, col) {
  save(() => {
    ctx.translate(x, y); ctx.scale(s, s); ctx.shadowColor = col; ctx.shadowBlur = 40;
    ctx.beginPath(); ctx.moveTo(0, 30); ctx.bezierCurveTo(-70, -20, -45, -75, 0, -40); ctx.bezierCurveTo(45, -75, 70, -20, 0, 30); ctx.closePath();
    ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = OL; ctx.stroke();
  });
}
function brainIcon(x, y, s, col) {
  save(() => {
    ctx.translate(x, y); ctx.scale(s, s); ctx.shadowColor = col; ctx.shadowBlur = 40;
    ctx.fillStyle = col; ctx.strokeStyle = OL; ctx.lineWidth = 6;
    [[-30, -10, 34], [0, -28, 34], [30, -10, 34], [-18, 18, 30], [18, 18, 30]].forEach(([a, b, r]) => { ell(a, b, r, r); ctx.fill(); });
    ctx.shadowBlur = 0; ctx.beginPath(); ctx.moveTo(0, -50); ctx.bezierCurveTo(-12, -20, 12, 0, 0, 40); ctx.moveTo(-40, -5); ctx.quadraticCurveTo(-20, 5, -30, 25); ctx.moveTo(40, -5); ctx.quadraticCurveTo(20, 5, 30, 25); ctx.stroke();
  });
}
function warnBox(x, y, s) {
  save(() => {
    ctx.translate(x, y); ctx.scale(s, s); ctx.shadowColor = '#ff3b3b'; ctx.shadowBlur = 30;
    rr(-55, -55, 110, 110, 18); fillStroke('#ff3b3b', 9);
    ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; rr(-11, -38, 22, 50, 10); ctx.fill(); ell(0, 30, 12, 12); ctx.fill();
  });
}
function phone(x, y, s, glow, txt) {
  save(() => {
    ctx.translate(x, y); ctx.scale(s, s);
    ctx.shadowColor = '#9fdcff'; ctx.shadowBlur = 60 * glow;
    rr(-75, -140, 150, 280, 26); fillStroke('#23262e', 9);
    ctx.shadowBlur = 0;
    rr(-62, -122, 124, 244, 16); ctx.fillStyle = mixc('#2d4f7a', '#bfe6ff', glow); ctx.fill();
    ctx.fillStyle = '#0d1b2e'; ctx.font = '800 44px Pop'; ctx.textAlign = 'center'; ctx.fillText(txt, 0, -30);
    ctx.font = '800 20px Pop'; ctx.fillText('ALARMA', 0, 4);
    ell(0, 70, 28, 28); ctx.fillStyle = '#ff5d5d'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OL; ctx.stroke();
  });
}
function vibLines(x, y, r, k) {
  ctx.strokeStyle = '#d6f0ff'; ctx.lineWidth = 8; ctx.lineCap = 'round';
  [-1, 1].forEach(s => [0, 1].forEach(i => { ctx.beginPath(); ctx.arc(x, y, r + i * 34, s > 0 ? -0.5 : Math.PI - 0.5, s > 0 ? 0.5 : Math.PI + 0.5); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(k * 30 + i); ctx.stroke(); ctx.globalAlpha = 1; }));
}
function toothbrush(h, ang, s = 1) {
  save(() => { ctx.translate(h[0], h[1]); ctx.rotate(ang); ctx.scale(s, s);
    rr(-10, -10, 150, 20, 10); fillStroke('#5fd1c4', 6); rr(118, -30, 32, 22, 6); fillStroke('#ffffff', 5); });
}
function keysIcon(x, y, s, sw) {
  save(() => { ctx.translate(x, y); ctx.rotate(sw); ctx.scale(s, s);
    ell(0, 0, 34, 34); ctx.lineWidth = 12; ctx.strokeStyle = '#c9ced6'; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = OL; ell(0, 0, 40, 40); ctx.stroke();
    [[-0.5, '#d9b44a'], [0.4, '#b9c2cc']].forEach(([a, col]) => save(() => { ctx.rotate(a); ctx.translate(0, 40);
      ell(0, 25, 26, 26); fillStroke(col, 6); rr(-9, 45, 18, 110, 5); fillStroke(col, 6); rr(5, 115, 22, 12, 3); fillStroke(col, 5); rr(5, 140, 16, 12, 3); fillStroke(col, 5); }));
  });
}
function shoe(x, y, s, lace) {
  save(() => { ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(-160, 40); ctx.lineTo(-150, -60); ctx.quadraticCurveTo(-60, -90, -20, -40); ctx.quadraticCurveTo(80, -20, 160, 10); ctx.lineTo(160, 40); ctx.closePath(); fillStroke('#3b4f6b');
    rr(-170, 30, 340, 30, 14); fillStroke('#f1f1f1', 8);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-90 + i * 30, -50 + i * 8); ctx.lineTo(-60 + i * 30, -30 + i * 8); ctx.stroke(); }
    // lazo
    const l = lace;
    ctx.lineWidth = 8; ctx.beginPath(); ctx.ellipse(-60 - 30 * l, -70, 26 * l + 4, 14, -0.4, 0, Math.PI * 2); ctx.ellipse(-20 + 30 * l, -70, 26 * l + 4, 14, 0.4, 0, Math.PI * 2); ctx.stroke();
  });
}
function goldParticles(cx, cy, n, t, spread, rise, seed = 1, size = 9) {
  save(() => {
    ctx.shadowColor = GOLD; ctx.shadowBlur = 20; ctx.fillStyle = GOLD;
    for (let i = 0; i < n; i++) {
      const ph = (t * 0.5 + hash(i + seed)) % 1;
      const x = cx + (hash(i * 3.1 + seed) - .5) * spread + Math.sin(t * 2 + i) * 18;
      const y = cy - ph * rise;
      ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.9;
      ell(x, y, size * (0.6 + hash(i * 7.7)), size * (0.6 + hash(i * 7.7))); ctx.fill();
    }
  });
}
function qmark(x, y, s) {
  save(() => { ctx.translate(x, y); ctx.scale(s, s); ell(0, 0, 70, 70); fillStroke('#ffffff', 9);
    ctx.fillStyle = OL; ctx.font = '900 100px Pop'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 2, 8); });
}

// ---------- fondos ----------
function bg(c1, c2) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; ctx.fillRect(-200, -200, W + 400, H + 400); }
function floor(y, col, line) { ctx.fillStyle = col; ctx.fillRect(-200, y, W + 400, H); ctx.fillStyle = line; ctx.fillRect(-200, y, W + 400, 10); }
function planks(y, col) { ctx.strokeStyle = col; ctx.lineWidth = 5; for (let i = 0; i < 10; i++) { const yy = y + 40 + i * i * 14; ctx.beginPath(); ctx.moveTo(-200, yy); ctx.lineTo(W + 200, yy); ctx.stroke(); } }
function windowRect(x, y, w, h, sky, frame = '#e9eef5') { rr(x, y, w, h, 14); fillStroke(sky, 10); ctx.fillStyle = frame; ctx.fillRect(x + w / 2 - 7, y, 14, h); ctx.fillRect(x, y + h / 2 - 7, w, 14); rr(x, y, w, h, 14); fillStroke(null, 10); }
function door(x, y, w, h, open, col = '#9a6a42') {
  rr(x - 18, y - 18, w + 36, h + 18, 8); fillStroke('#e6dccd', 8);
  ctx.fillStyle = '#fff6c9'; ctx.fillRect(x, y, w, h);
  const ww = w * (1 - open * 0.75);
  rr(x, y, ww, h, 4); fillStroke(col, 8);
  ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 6; rr(x + 30, y + 40, ww - 60, h * .38, 8); ctx.stroke(); rr(x + 30, y + h * .5, ww - 60, h * .42, 8); ctx.stroke();
  ell(x + ww - 40, y + h * .52, 16, 16); fillStroke('#e9c45a', 6);
}
function bed(x, y, w, sheet = '#dfe6f1', blanket = '#9db4d6') {
  rr(x - 30, y - 330, 60, 470, 18); fillStroke('#8a5d3b');
  rr(x, y - 40, w, 120, 26); fillStroke(sheet);
  rr(x + 10, y + 70, w - 20, 70, 10); fillStroke('#8a5d3b');
  if (blanket) { rr(x + 240, y - 60, w - 250, 110, 40); fillStroke(blanket); }
}
function shirtPile(x, y, s) {
  save(() => { ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(-200, 30); ctx.bezierCurveTo(-230, -40, -150, -90, -90, -70); ctx.bezierCurveTo(-40, -110, 60, -100, 100, -70); ctx.bezierCurveTo(170, -90, 240, -30, 200, 30); ctx.bezierCurveTo(120, 60, -120, 60, -200, 30); ctx.closePath(); fillStroke(SHIRT);
    ctx.strokeStyle = SHIRT_D; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-120, -20); ctx.quadraticCurveTo(-40, -50, 20, -10); ctx.moveTo(40, -40); ctx.quadraticCurveTo(110, -50, 150, 0); ctx.stroke();
  });
}
function lightRays(x, y, ang, len, alpha, col = '255,214,130') {
  save(() => { ctx.translate(x, y); ctx.rotate(ang); for (let i = 0; i < 4; i++) { const g = ctx.createLinearGradient(0, 0, 0, len); g.addColorStop(0, `rgba(${col},${alpha})`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(i * 90 - 40, 0); ctx.lineTo(i * 90 + 40, 0); ctx.lineTo(i * 140 + 120, len); ctx.lineTo(i * 140 - 60, len); ctx.closePath(); ctx.fill(); } });
}
function tiles(col, line) { ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = line; ctx.lineWidth = 4; for (let x = 0; x <= W; x += 120) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y <= H; y += 120) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } }
function sink(x, y, w) { rr(x - w / 2, y, w, 70, 30); fillStroke('#f4f7fb'); ell(x, y + 18, w / 2 - 50, 22); ctx.fillStyle = '#c9d4e2'; ctx.fill(); rr(x - 22, y - 90, 44, 95, 10); fillStroke('#c8d0da'); rr(x - 22, y - 90, 90, 30, 12); fillStroke('#c8d0da'); ctx.fillStyle = '#e2e7ee'; ctx.fillRect(x - w / 2 + 40, y + 70, w - 80, H); ctx.strokeStyle = OL; ctx.lineWidth = LW; ctx.strokeRect(x - w / 2 + 40, y + 70, w - 80, H); }
function hallway(dark) {
  bg(mixc('#7d97bd', '#1d2a44', dark), mixc('#5f789e', '#141d33', dark));
  floor(1350, mixc('#8b6a50', '#3a2c25', dark), mixc('#6e523d', '#2a1f1a', dark)); planks(1350, mixc('#76583f', '#30241e', dark));
  ctx.fillStyle = mixc('#c7d2e4', '#2c3a57', dark); ctx.fillRect(-200, 1310, W + 400, 40);
}

// ---------- escenas ----------
// cada una recibe u (s desde inicio del corte), d (duración), p = u/d
const S = {};
S[1] = (u, d, p) => {
  bg('#2b3d62', '#1a2640');
  windowRect(120, 220, 330, 380, '#3a5b8f'); ell(380, 300, 34, 34); ctx.fillStyle = '#dfe8ff'; ctx.fill();
  floor(1450, '#24324f', '#1b2740');
  bed(80, 1250, 760, '#c5d1e6', null);
  // persona acostada: cabeza en almohada
  rr(150, 1110, 230, 110, 50); fillStroke('#e8eef8');
  person({ x: 660, y: 1150, s: 0.85, rot: -Math.PI / 2 + 0.02, headTilt: -0.05, eyes: u > 1.2 ? 'half' : 'closed', mouth: u > 1.3 ? 'groan' : 'line', wob: u * 20, armR: [-0.15, -0.05], armL: [0.3, 0.2] });
  rr(400, 1120, 520, 150, 60); fillStroke('#7f9cc9'); // manta
  ctx.strokeStyle = '#6a86b2'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(470, 1160); ctx.quadraticCurveTo(620, 1190, 780, 1150); ctx.stroke();
  // mesita y móvil
  rr(860, 1080, 190, 380, 14); fillStroke('#5b4a6b');
  const vib = u < 2.0 ? Math.sin(u * 90) * 6 : 0;
  phone(955 + vib, 960, 0.85, 0.6 + 0.4 * Math.sin(u * 12), '07:00');
  if (u < 2.2) vibLines(955, 960, 120, u);
  lightRays(900, 900, Math.PI * 0.62, 900, 0.10, '160,210,255');
};
S[1].cam = (u, d, p) => ({ zx: 955, zy: 980, z: 1 + 1.0 * eOut(seg(u, 0, 0.6)) - 1.0 * ease(seg(u, 1.35, 1.9)) });

S[2] = (u, d, p) => {
  const warm = 1 - ease(seg(p, 0.62, 0.95));
  bg(mixc('#2b3d62', '#ffd59a', warm), mixc('#1a2640', '#f2a65e', warm));
  windowRect(560, 180, 360, 420, mixc('#3a5b8f', '#ffe9b8', warm));
  floor(1100, mixc('#2e3550', '#c98a55', warm), mixc('#232a40', '#a9703f', warm)); planks(1100, mixc('#262c44', '#b47a48', warm));
  ctx.globalAlpha = warm; lightRays(600, 500, -0.35, 1500, 0.35); ctx.globalAlpha = 1;
  // persona acostada en el piso
  person({ x: 700, y: 1330, s: 0.95, rot: -Math.PI / 2, eyes: 'closed', mouth: warm > .5 ? 'smile' : 'line', armL: [0.2, 0.1], armR: [-1.1, -1.4], headTilt: 0.1 });
  catCurl({ x: 440, y: 1540, s: 0.95, breath: u * 3 });
  // viñeta "recuerdo"
  ctx.fillStyle = `rgba(255,236,190,${0.18 * warm})`; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = warm; ctx.fillStyle = '#fff6e0'; ctx.font = '900 64px Pop'; ctx.textAlign = 'center'; ctx.lineWidth = 12; ctx.strokeStyle = OL; ctx.strokeText('SÁB · DOM', 290, 420); ctx.fillText('SÁB · DOM', 290, 420); ctx.globalAlpha = 1;
};
S[2].cam = (u, d, p) => ({ zx: 560, zy: 1300, z: 1.2 + 0.1 * p });

S[3] = (u, d, p) => {
  const fl = (hash(Math.floor(u * 12)) > 0.93) ? 0.85 : 1;
  tiles(mixc('#9fb6c9', '#000000', 1 - fl), '#86a0b6');
  rr(190, 260, 700, 640, 30); fillStroke('#c8e2ee', 12); // espejo
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.moveTo(260, 300); ctx.lineTo(380, 300); ctx.lineTo(240, 600); ctx.lineTo(220, 520); ctx.fill();
  ctx.fillStyle = 'rgba(230,250,255,.8)'; ctx.fillRect(300, 180, 480, 40); // tubo fluorescente
  const br = Math.sin(u * 13);
  person({ x: 540, y: 1650, s: 1.1, eyes: 'half', mouth: 'line', headTilt: 0.06 * Math.sin(u * 1.5),
    armL: [0.15, 0.1], armR: [-1.9 + br * 0.05, 2.39 + br * 0.12],
    hold: h => toothbrush(h, -0.08 + br * 0.12, 0.9) });
  sink(540, 1560, 720);
  ctx.fillStyle = 'rgba(200,240,255,.10)'; ctx.fillRect(0, 0, W, H);
};
S[3].cam = (u, d, p) => ({ zx: 540, zy: 900, z: 1.0 + 0.06 * p });

S[4] = (u, d, p) => {
  tiles('#9fb6c9', '#86a0b6');
  rr(140, 150, 800, 900, 30); fillStroke('#c8e2ee', 12);
  ctx.globalAlpha = 0.45; person({ x: 540, y: 1200, s: 1.0, eyes: 'half' }); ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(200,226,238,.45)'; rr(140, 150, 800, 900, 30); ctx.fill();
  sink(540, 1350, 900);
  catSit({ x: 760, y: 1360, s: 0.95, eyes: 'focus', pupil: 0.15 + 0.5 * ease(seg(u, 0.6, 1.6)), tail: u * 1.5, look: [-0.6, -0.3], headTilt: -0.08 });
};
S[4].cam = (u, d, p) => ({ zx: 735, zy: 1045, z: 1 + 1.4 * eOut(seg(u, 0.2, 1.6)) });

S[5] = (u, d, p) => {
  // pantalla dividida
  save(() => { ctx.beginPath(); ctx.rect(0, 0, W, H / 2); ctx.clip();
    tiles('#9fb6c9', '#86a0b6');
    person({ x: 520, y: 1060, s: 1.1, eyes: 'down', eyeY: 22, mouth: 'line', headTilt: 0.25 });
    sink(800, 905, 900);
  });
  save(() => { ctx.beginPath(); ctx.rect(0, H / 2, W, H / 2); ctx.clip();
    bg('#c4d3e4', '#a9bbd3'); ctx.fillStyle = '#e2e7ee'; ctx.fillRect(0, 1650, W, 300);
    catSit({ x: 540, y: 1880, s: 1.05, eyes: 'wide', earsBack: 0.45, pupil: 0.55, look: [0, -0.9], tail: u * 2 });
    const qk = eBack(seg(u, 0.35, 0.75));
    if (qk > 0) qmark(830, 1330 + Math.sin(u * 4) * 12, qk * 1.15);
  });
  ctx.fillStyle = OL; ctx.fillRect(0, H / 2 - 8, W, 16);
};

S[6] = (u, d, p) => {
  bg('#152238', '#0b1424');
  ctx.strokeStyle = 'rgba(79,227,255,.07)'; ctx.lineWidth = 3; for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  xrayGlow(() => catSit({ x: 540, y: 1650, s: 1.35, xray: true, eyes: 'open', tail: u }));
  clockIcon(540, 1650 - 300 * 1.35 - 30, 78, u * 9);
};
S[6].cam = (u, d, p) => ({ zx: 540, zy: 1200, z: 1 + 0.12 * p });

S[7] = (u, d, p) => {
  const fl = 0.5 + 0.5 * Math.sin(u * 14);
  bg(mixc('#152238', '#3a0f18', fl * .7), '#0b1424');
  xrayGlow(() => catSit({ x: 540, y: 1750, s: 1.15, xray: true, eyes: 'wide', pupil: .6, tail: u }), '#ff6b6b');
  brainIcon(540, 1750 - 345, 1.25, mixc('#ff3b3b', '#ff9a9a', fl));
  [0, 1, 2].forEach(i => { const k = eBack(seg(u, 0.35 + i * 0.4, 0.65 + i * 0.4)); if (k > 0) warnBox(260 + i * 280, 760 + Math.sin(u * 3 + i) * 10, k * 1.2); });
};

S[8] = (u, d, p) => {
  const ph = H / 3;
  const icons = [
    k => { tiles('#9fb6c9', '#86a0b6'); save(() => {
        person({ x: 540, y: 720, s: 1.0, eyes: 'half', armR: [-1.9, 2.39 + Math.sin(u * 14) * .12], hold: h => toothbrush(h, -0.08 + Math.sin(u * 14) * .12, .9) }); }); },
    k => { bg('#d7c4ad', '#bfa98e'); shoe(540, ph * .62, 1.4, 0.5 + 0.5 * Math.sin(u * 6));
        tube([[220, ph * .1], [380, ph * .38], [420, ph * .45]], 22, '#fff'); ell(420, ph * .45, 18, 18); fillStroke('#fff', 7);
        tube([[880, ph * .1], [700, ph * .36], [640, ph * .42]], 22, '#fff'); ell(640, ph * .42, 18, 18); fillStroke('#fff', 7); },
    k => { bg('#c9d6c4', '#a9b9a2'); ctx.fillStyle = '#8a5d3b'; ctx.fillRect(0, ph * .82, W, ph); keysIcon(540, ph * .42, 1.25, Math.sin(u * 8) * 0.2);
        tube([[1000, -40], [760, ph * .2], [560, ph * .3]], 22, '#fff'); ell(560, ph * .3, 22, 22); fillStroke('#fff', 7); },
  ];
  icons.forEach((f, i) => {
    save(() => {
      ctx.beginPath(); ctx.rect(0, i * ph, W, ph); ctx.clip(); ctx.translate(0, i * ph); f();
      const on = seg(u, i * d / 3 - 0.05, i * d / 3 + 0.15);
      ctx.fillStyle = `rgba(5,10,25,${0.72 * (1 - on)})`; ctx.fillRect(0, 0, W, ph);
      if (on > 0 && u < (i + 1) * d / 3 + 0.2) { ctx.lineWidth = 16; ctx.strokeStyle = YEL; ctx.strokeRect(8, 8, W - 16, ph - 16); }
      ctx.fillStyle = '#ff3b3b'; ell(90, 90, 44, 44); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '900 52px Pop'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(i + 1, 90, 94);
    });
  });
  ctx.fillStyle = OL; ctx.fillRect(0, ph - 8, W, 16); ctx.fillRect(0, 2 * ph - 8, W, 16);
};

S[9] = (u, d, p) => {
  hallway(0.35);
  door(640, 520, 330, 790, 0);
  // sombra alargada
  const sl = ease(seg(u, 0.1, 1.6));
  save(() => { ctx.globalAlpha = 0.75; ctx.fillStyle = '#05070f'; ctx.translate(120, 1620); ctx.rotate(1.0); ctx.scale(1, 1 + sl * 1.3);
    ell(0, -620, 70, 70); ctx.fill(); rr(-75, -550, 150, 330, 50); ctx.fill(); rr(-60, -230, 50, 230, 20); ctx.fill(); rr(10, -230, 50, 230, 20); ctx.fill(); });
  const k = ease(seg(u, 0.8, 2.2));
  catSit({ x: 330, y: 1580, s: 0.7, eyes: 'wide', earsBack: 0.2 + 0.8 * k, pupil: 0.3 + 0.7 * k, look: [0.7, -0.4], tail: u * 0.6 });
};
S[9].cam = (u, d, p) => ({ zx: 400, zy: 1300, z: 1.0 + 0.18 * ease(p) });

S[10] = (u, d, p) => {
  hallway(0.2);
  door(640, 520, 330, 790, 0);
  const pet = u > 0.4 && u < d - 0.3, st = Math.sin(u * 5);
  const cs = 0.62, cx = 370, cy = 1580, headY = pet ? st * 4 : 0;
  const ps = 0.92, hx = 620, hy = 1410;
  // mano objetivo: sobre la cabeza del gato (coords locales del personaje)
  const tx = cx + (pet ? st * 22 : 30), ty = cy - (300 - 95) * cs + headY - (pet ? 0 : 60);
  const sx = hx - 78 * ps, sy = hy + (-250 + 30) * ps;
  const armR = ik((tx - sx) / ps, (ty - sy) / ps, 125, 120, 1);
  catSit({ x: cx, y: cy, s: cs, eyes: (u > 0.9 && u < 2.2) ? 'closed' : 'open', earsBack: 0.15, tail: u * 1.5, headTilt: 0.1 + st * 0.04, headY });
  person({ x: hx, y: hy, s: ps, eyes: 'open', mouth: 'smile', headTilt: -0.2,
    legL: [-1.3, 0.5], legR: [-1.45, 0.35], armL: [0.6, 0.6], armR });
  if (u > 0.9 && u < 2.4) heartIcon(cx + 70, 1240 - (u - 0.9) * 60, 0.45, '#ff7aa2');
};
S[10].cam = (u, d, p) => ({ zx: 420, zy: 1250, z: 1.15 + 0.05 * p });

S[11] = (u, d, p) => {
  const shut = ease(seg(u, 0.25, 0.6));
  const dark = 0.25 + 0.6 * ease(seg(u, 0.55, 1.6));
  hallway(dark);
  door(330, 420, 420, 900, 1 - shut, mixc('#9a6a42', '#3e2a1d', dark));
  if (shut < 1) { ctx.fillStyle = `rgba(255,240,190,${0.5 * (1 - shut)})`; ctx.beginPath(); ctx.moveTo(330 + 420 * (0.25 + 0.75 * shut), 1320); ctx.lineTo(750, 1320); ctx.lineTo(900, 1900); ctx.lineTo(200 + 600 * shut, 1900); ctx.fill(); }
  catBack({ x: 540, y: 1690, s: 0.75, earsBack: 0.4 * ease(seg(u, 0.6, 1.2)), tail: u });
  // sombras azules avanzando
  const g = ctx.createRadialGradient(540, 1100, 200, 540, 1100, 1200); g.addColorStop(0, 'rgba(10,20,50,0)'); g.addColorStop(1, `rgba(5,10,30,${0.8 * dark})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (u > 0.55 && u < 0.85) { ctx.fillStyle = '#fff'; ctx.font = '900 90px Pop'; ctx.textAlign = 'center'; ctx.lineWidth = 14; ctx.strokeStyle = OL; ctx.strokeText('¡CLIC!', 820, 520); ctx.fillText('¡CLIC!', 820, 520); }
};
S[11].cam = (u, d, p) => { const sh = (u > 0.58 && u < 0.8) ? Math.sin(u * 140) * 10 : 0; return { zx: 540, zy: 1100 + sh, z: 1.0 + 0.08 * p }; };

S[12] = (u, d, p) => {
  bg('#1a1020', '#0c0a14');
  door(330, 420, 420, 900, 0, '#2a1e18');
  ctx.fillStyle = 'rgba(10,8,20,.55)'; ctx.fillRect(0, 0, W, H);
  xrayGlow(() => catSit({ x: 540, y: 1720, s: 1.05, xray: true, eyes: 'wide', pupil: .85, earsBack: .8, tail: u * 3 }), '#ff5a5a');
  const beat = Math.pow(Math.abs(Math.sin(u * Math.PI * 2.4)), 6);
  heartIcon(540, 1560, 0.95 + beat * 0.35, '#ff2f4f');
  for (let i = 0; i < 14; i++) { const a = hash(i) * 6.28, r = 60 + hash(i + 9) * 140, yy = 1500 + Math.sin(a + u * 2) * r * .7 - ((u * 40 + i * 30) % 120); ctx.fillStyle = '#ff4b4b'; ctx.globalAlpha = .8; ell(540 + Math.cos(a + u) * r * .8, yy, 10, 10); ctx.fill(); }
  ctx.globalAlpha = 1;
  // medidor de estrés
  const lvl = ease(seg(u, 0.2, d - 0.4));
  rr(140, 330, 800, 70, 35); fillStroke('#2a2030', 8); rr(150, 340, 780 * lvl + 1, 50, 25); ctx.fillStyle = mixc('#ffcc33', '#ff2f4f', lvl); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '900 54px Pop'; ctx.textAlign = 'center'; ctx.fillText('ESTRÉS', W / 2, 300);
};
S[12].cam = (u, d, p) => ({ zx: 540, zy: 1150, z: 1.0 + 0.06 * Math.sin(u * 15) * 0.15 + 0.05 * p });

S[13] = (u, d, p) => {
  hallway(0.55);
  door(60, 520, 300, 790, 0, '#5a3e2a');
  // dormitorio al fondo (puerta abierta con luz cálida)
  rr(760, 600, 260, 720, 6); fillStroke('#ffe0a3', 8);
  // rastro dorado
  save(() => { ctx.shadowColor = GOLD; ctx.shadowBlur = 25; for (let i = 0; i < 40; i++) { const k = i / 40; const x = 300 + k * 600, y = 1120 - k * 200 + Math.sin(k * 12 + u * 3) * 40; ctx.globalAlpha = 0.35 + 0.5 * Math.sin(k * 20 - u * 6) ** 2; ctx.fillStyle = GOLD; ell(x, y, 9, 9); ctx.fill(); } });
  ctx.globalAlpha = 1;
  const x = lerp(250, 640, ease(p));
  catSide({ x, y: 1560, s: 0.65, face: 1, walk: u * 7, noseUp: 0.6 + 0.3 * Math.sin(u * 4), tail: u * 2, eyes: 'open', pupil: .4 });
};
S[13].cam = (u, d, p) => ({ zx: lerp(420, 700, ease(p)), zy: 1350, z: 1.12 });

function bedroomWarm(w = 1) {
  bg(mixc('#4a5a80', '#ffcf8f', w), mixc('#2b3550', '#e79a58', w));
  windowRect(600, 160, 360, 420, mixc('#6b86b8', '#fff1c7', w));
  floor(1500, mixc('#3d3448', '#b97d4b', w), mixc('#2e2738', '#9a643a', w));
  rr(-40, 1050, 1160, 470, 40); fillStroke('#e7ecf4'); // colchón
  rr(-40, 1420, 1160, 120, 20); fillStroke('#8a5d3b');
}
S[14] = (u, d, p) => {
  bedroomWarm(0.6);
  shirtPile(560, 1240, 1.6);
  goldParticles(560, 1180, 26, u, 600, 600, 3, 10);
  const kn = u > 0.4 ? u - 0.4 : 0;
  const climb = ease(seg(u, 0, 0.5));
  catSide({ x: lerp(250, 500, climb), y: lerp(1500, 1250, climb), s: 0.72, face: 1, walk: climb < 1 ? u * 8 : 0, tail: u * 2, eyes: kn > 0 ? 'closed' : 'open',
    kneadA: kn > 0 ? Math.max(0, Math.sin(kn * 9)) * 40 : 0, kneadB: kn > 0 ? Math.max(0, -Math.sin(kn * 9)) * 40 : 0 });
};
S[14].cam = (u, d, p) => ({ zx: 560, zy: 1150, z: 1.1 + 0.08 * p });

S[15] = (u, d, p) => {
  bedroomWarm(0.75);
  shirtPile(540, 1260, 1.7);
  ctx.fillStyle = 'rgba(10,15,40,.45)'; ctx.fillRect(0, 0, W, H);
  const calm = ease(seg(u, 0.4, d - 0.4));
  xrayGlow(() => catCurl({ x: 560, y: 1200, s: 1.1, xray: true, breath: u * 2 }), mixc('#ff6b6b', '#ffd36b', calm));
  // partículas hacia la nariz
  save(() => { ctx.shadowColor = GOLD; ctx.shadowBlur = 20; ctx.fillStyle = GOLD; for (let i = 0; i < 22; i++) { const ph = (u * 0.7 + hash(i)) % 1; const sx = 120 + hash(i + 4) * 300, sy = 700 + hash(i + 8) * 300; ctx.globalAlpha = Math.sin(ph * Math.PI); ell(lerp(sx, 420, ph), lerp(sy, 1250, ph), 9, 9); ctx.fill(); } });
  ctx.globalAlpha = 1;
  brainIcon(450, 1180, 0.95, mixc('#ff3b3b', '#4fb6ff', calm));
  const beat = Math.pow(Math.abs(Math.sin(u * Math.PI * lerp(2.4, 0.9, calm))), 6);
  heartIcon(640, 1250, 0.6 + beat * 0.15, mixc('#ff2f4f', '#ff9db0', calm));
  ctx.fillStyle = `rgba(255,214,120,${0.2 * calm})`; ctx.fillRect(0, 0, W, H);
};
S[15].cam = (u, d, p) => ({ zx: 520, zy: 1200, z: 1.25 });

S[16] = (u, d, p) => {
  bedroomWarm(1);
  lightRays(640, 420, 0.55, 1400, 0.4);
  shirtPile(540, 1260, 1.7);
  catCurl({ x: 560, y: 1200, s: 0.95, breath: u * 2.2 });
  // Zzz
  ctx.fillStyle = '#fff'; ctx.strokeStyle = OL; ctx.lineWidth = 10; ctx.textAlign = 'center';
  [0, 1, 2].forEach(i => { const k = (u * 0.6 + i / 3) % 1; ctx.globalAlpha = Math.sin(k * Math.PI); ctx.font = `900 ${50 + i * 14}px Pop`; ctx.strokeText('z', 420 - k * 60 + i * 40, 1000 - k * 220); ctx.fillText('z', 420 - k * 60 + i * 40, 1000 - k * 220); });
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,200,120,.12)'; ctx.fillRect(0, 0, W, H);
};
S[16].cam = (u, d, p) => ({ zx: 560, zy: 1150, z: 1.5 - 0.45 * ease(p) });

S[17] = (u, d, p) => {
  bedroomWarm(1);
  lightRays(640, 420, 0.55, 1400, 0.35);
  shirtPile(540, 1360, 1.7);
  const c17 = DATA.cuts[DATA.cuts.length - 1], HT = c17.words[c17.words.length - 1].t - c17.start;
  const flick = seg(u, HT - 0.4, HT) - seg(u, HT + 0.15, HT + 0.5);
  catCurl({ x: 560, y: 1300, s: 0.95, breath: u * 2.2, eyes: u > 0.35 ? 'one' : 'closed', pupil: .3, look: [-0.6, -0.3], tailFlick: ease(clamp(flick)) });
  // botón
  const hit = u > HT;
  const bounce = hit ? Math.abs(Math.sin((u - HT) * 9)) * Math.exp(-(u - HT) * 2.5) : 0;
  const bin = eBack(seg(u, 0.05, 0.4));
  save(() => {
    ctx.translate(540, 980 - bounce * 70); ctx.scale(bin * (1 + bounce * .12), bin * (1 - bounce * .06));
    ctx.shadowColor = hit ? YEL : '#ff3b3b'; ctx.shadowBlur = 50;
    rr(-330, -85, 660, 170, 85); fillStroke(hit ? YEL : '#e62b2b', 12);
    ctx.shadowBlur = 0; ctx.fillStyle = hit ? OL : '#fff'; ctx.font = '900 84px Pop'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('SUSCRÍBETE', 0, 8);
  });
  if (hit) save(() => { ctx.translate(540, 980); const k = seg(u, HT, HT + 0.5); ctx.globalAlpha = 1 - k; ctx.strokeStyle = YEL; ctx.lineWidth = 10; for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; ctx.beginPath(); ctx.moveTo(Math.cos(a) * (360 + k * 60), Math.sin(a) * (120 + k * 60)); ctx.lineTo(Math.cos(a) * (420 + k * 140), Math.sin(a) * (170 + k * 120)); ctx.stroke(); } });
};
S[17].cam = (u, d, p) => ({ zx: 540, zy: 1000, z: 1.0 });

// ---------- subtítulos karaoke ----------
function subtitles(t) {
  const s = DATA.subs.find(s => t >= s.start && t < s.end);
  if (!s) return;
  const SUBY = {1:1500,2:700,3:1740,4:1720,5:1100,6:520,7:520,8:1280,9:700,10:700,11:760,12:1000,13:520,14:600,15:600,16:600,17:1700};
  const y = SUBY[s.cut] || 1500, fs = 92;
  ctx.font = `900 ${fs}px Pop`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const words = s.words.map(w => ({ ...w, txt: (w.kw ? w.w.toUpperCase() : w.w) }));
  const sp = fs * 0.42;
  // dividir en líneas si no cabe
  const maxW = 960; let lines = [[]], lw = 0;
  words.forEach(w => { const ww = ctx.measureText(w.txt).width; if (lw + ww > maxW && lines[lines.length - 1].length) { lines.push([]); lw = 0; } lines[lines.length - 1].push({ ...w, ww }); lw += ww + sp; });
  const pin = eBack(seg(t, s.start, s.start + 0.18));
  lines.forEach((ln, li) => {
    const tw = ln.reduce((a, w) => a + w.ww, 0) + sp * (ln.length - 1);
    let x = W / 2 - tw / 2; const yy = y + (li - (lines.length - 1) / 2) * fs * 1.12;
    ln.forEach(w => {
      const active = t >= w.t - 0.03 && t < w.t + Math.max(w.d, 0.18);
      const sc = (active ? 1.1 : 1) * (0.7 + 0.3 * pin);
      save(() => {
        ctx.translate(x + w.ww / 2, yy); ctx.scale(sc, sc); ctx.textAlign = 'center';
        ctx.lineJoin = 'round'; ctx.lineWidth = 18; ctx.strokeStyle = '#000'; ctx.strokeText(w.txt, 0, 0);
        ctx.fillStyle = w.kw ? YEL : '#ffffff';
        if (!w.kw && active) ctx.fillStyle = '#ffffff';
        ctx.fillText(w.txt, 0, 0);
        if (w.kw && active) { ctx.globalAlpha = .35; ctx.shadowColor = YEL; ctx.shadowBlur = 30; ctx.fillText(w.txt, 0, 0); }
      });
      x += w.ww + sp;
    });
  });
}

// ---------- fotograma ----------
window.drawFrame = function (t) {
  T = t;
  const cut = DATA.cuts.find(c => t >= c.start && t < c.end) || DATA.cuts[DATA.cuts.length - 1];
  const d = cut.end - cut.start, u = t - cut.start, p = clamp(u / d);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const cam = S[cut.id].cam ? S[cut.id].cam(u, d, p) : { zx: W / 2, zy: H / 2, z: 1 };
  const punch = 1 + 0.06 * (1 - eOut(seg(u, 0, 0.3)));   // "punch-in" al cortar
  const z = cam.z * punch;
  save(() => {
    ctx.translate(W / 2, H / 2); ctx.scale(z, z);
    ctx.translate(-lerp(W / 2, cam.zx, 1 - 1 / z), -lerp(H / 2, cam.zy, 1 - 1 / z));
    ctx.translate(Math.sin(t * 0.7) * 4, Math.cos(t * 0.5) * 4); // deriva sutil
    S[cut.id](u, d, p);
  });
  // flash suave al cortar
  const fl = 1 - seg(u, 0, 0.12); if (fl > 0 && cut.id > 1) { ctx.fillStyle = `rgba(255,255,255,${0.25 * fl})`; ctx.fillRect(0, 0, W, H); }
  // viñeta
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (t < 0.2) { ctx.fillStyle = `rgba(0,0,0,${1 - t / 0.2})`; ctx.fillRect(0, 0, W, H); }
  subtitles(t);
  const end = DATA.total; if (t > end - 0.5) { ctx.fillStyle = `rgba(0,0,0,${(t - end + 0.5) / 0.5})`; ctx.fillRect(0, 0, W, H); }
};
