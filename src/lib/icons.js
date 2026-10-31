// Canvas-drawn flat icons shown as unlit billboards inside the scene (X-ray internals, UI props).
import * as THREE from 'three';
import { V, clamp } from './toon.js';

const FONT = '"Inter", "Inter Display", sans-serif';

export class CanvasPlane extends THREE.Mesh {
  /** @param w,h canvas pixels; ww,wh world size; draw(ctx,w,h,state) */
  constructor(w, h, ww, wh, draw, { additive = false } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, toneMapped: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    super(new THREE.PlaneGeometry(ww, wh), mat);
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.tex = tex; this.drawFn = draw;
    this.renderOrder = 10;
    this._key = null;
  }
  /** redraw only when key changes (cheap) */
  redraw(state, key = JSON.stringify(state)) {
    if (key === this._key) return;
    this._key = key;
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.drawFn(ctx, canvas.width, canvas.height, state);
    this.tex.needsUpdate = true;
  }
  set opacity(v) { this.material.opacity = v; this.visible = v > 0.003; }
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ------------------------------------------------------------------ battery
export function batteryIcon(ww = 1.5) {
  const w = 512, h = 300;
  return new CanvasPlane(w, h, ww, ww * h / w, (ctx, W, H, s) => {
    const { level = 1, color = '#ff2a2a', bolt = false, text = true } = s;
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = 38;
    ctx.lineWidth = 16; ctx.strokeStyle = color; ctx.fillStyle = color;
    rr(ctx, 40, 50, 380, 200, 34); ctx.stroke();
    rr(ctx, 424, 105, 44, 90, 12); ctx.fill();
    // 5 segments
    const n = 5, gap = 12, bw = (380 - 48 - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const on = level * n > i + 0.001;
      const part = clamp(level * n - i);
      if (!on) continue;
      ctx.globalAlpha = 1;
      rr(ctx, 64 + i * (bw + gap), 76, bw * (i === 0 || part >= 1 ? 1 : part), 148, 14); ctx.fill();
    }
    ctx.restore();
    if (bolt) {
      ctx.save(); ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.moveTo(250, 62); ctx.lineTo(176, 160); ctx.lineTo(226, 160); ctx.lineTo(206, 240); ctx.lineTo(292, 132); ctx.lineTo(240, 132); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    if (text !== false && s.label) {
      ctx.save(); ctx.font = `900 74px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.fillStyle = '#fff';
      ctx.strokeText(s.label, 230, 152); ctx.fillText(s.label, 230, 152); ctx.restore();
    }
  });
}

// ------------------------------------------------------------------ brain + gauge ("93%")
export function brainGauge(ww = 1.6) {
  const w = 512, h = 512;
  return new CanvasPlane(w, h, ww, ww, (ctx, W, H, s) => {
    const { value = 0, color = '#25e06a', brain = '#f78fb3', pct = 0 } = s;
    ctx.save(); ctx.translate(W / 2, H / 2);
    // brain silhouette (two lobes) – flat pink with darker folds
    ctx.shadowColor = color; ctx.shadowBlur = 36 * (0.4 + value);
    ctx.fillStyle = brain; ctx.globalAlpha = 0.9;
    const lobe = (cx, sgn) => {
      ctx.beginPath();
      ctx.moveTo(0, -150);
      ctx.bezierCurveTo(sgn * 90, -230, sgn * 230, -170, sgn * 225, -70);
      ctx.bezierCurveTo(sgn * 270, 0, sgn * 235, 100, sgn * 160, 120);
      ctx.bezierCurveTo(sgn * 130, 190, sgn * 40, 190, 0, 150);
      ctx.closePath(); ctx.fill();
    };
    lobe(0, -1); lobe(0, 1);
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(160,40,90,.8)'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -150); ctx.lineTo(0, 150); ctx.stroke();
    ctx.lineWidth = 8;
    [[-120, -90, -50, -60], [-140, 10, -70, 30], [120, -90, 50, -60], [140, 10, 70, 30], [-90, 90, -40, 70], [90, 90, 40, 70]].forEach(([a, b, c, d]) => {
      ctx.beginPath(); ctx.moveTo(a, b); ctx.quadraticCurveTo((a + c) / 2, (b + d) / 2 - 30, c, d); ctx.stroke();
    });
    // gauge ring
    ctx.shadowColor = color; ctx.shadowBlur = 30;
    ctx.lineWidth = 34; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(10,20,10,.75)'; ctx.beginPath(); ctx.arc(0, 0, 118, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(0, 0, 118, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * value); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(8,24,14,.82)'; ctx.beginPath(); ctx.arc(0, 0, 98, 0, Math.PI * 2); ctx.fill();
    ctx.font = `900 86px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 22;
    ctx.fillText(`${Math.round(pct)}%`, 0, 6);
    ctx.restore();
  });
}

// ------------------------------------------------------------------ toggle switch (brain switch)
export function toggleSwitch(ww = 1.6) {
  const w = 512, h = 300;
  return new CanvasPlane(w, h, ww, ww * h / w, (ctx, W, H, s) => {
    const { v = 0, label = 'ON' } = s; // v: 0 = red/on(alarm), 1 = green/off
    const red = [255, 52, 64], green = [46, 230, 112];
    const col = red.map((c, i) => Math.round(c + (green[i] - c) * v));
    const css = `rgb(${col.join(',')})`;
    ctx.save(); ctx.shadowColor = css; ctx.shadowBlur = 40;
    ctx.fillStyle = 'rgba(8,10,18,.85)'; rr(ctx, 50, 70, 412, 160, 80); ctx.fill();
    ctx.lineWidth = 14; ctx.strokeStyle = css; rr(ctx, 50, 70, 412, 160, 80); ctx.stroke();
    const kx = 50 + 80 + v * (412 - 160);
    ctx.fillStyle = css; ctx.beginPath(); ctx.arc(kx, 150, 62, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.font = `900 64px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 10;
    const tx = v > 0.5 ? 50 + 130 : 50 + 412 - 130;
    ctx.strokeText(label, tx, 152); ctx.fillText(label, tx, 152);
  });
}

// ------------------------------------------------------------------ question mark
export function questionMark(ww = 1.2) {
  const w = 256, h = 320;
  return new CanvasPlane(w, h, ww, ww * h / w, (ctx, W, H) => {
    ctx.font = `900 300px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 34; ctx.strokeStyle = '#0b0b10'; ctx.strokeText('?', W / 2, H / 2 + 14);
    ctx.fillStyle = '#ffd400'; ctx.fillText('?', W / 2, H / 2 + 14);
  });
}

// ------------------------------------------------------------------ heart
export function heartIcon(ww = 0.5, color = '#ff6fae') {
  const w = 192, h = 192;
  return new CanvasPlane(w, h, ww, ww, (ctx, W, H) => {
    ctx.save(); ctx.translate(W / 2, H / 2 + 8); const k = 1.7;
    ctx.beginPath();
    ctx.moveTo(0, 44 * k * 0.55);
    ctx.bezierCurveTo(-60 * k * 0.55, 6 * k * 0.55, -52 * k * 0.55, -48 * k * 0.55, -22 * k * 0.55, -48 * k * 0.55);
    ctx.bezierCurveTo(-6 * k * 0.55, -48 * k * 0.55, 0, -34 * k * 0.55, 0, -28 * k * 0.55);
    ctx.bezierCurveTo(0, -34 * k * 0.55, 6 * k * 0.55, -48 * k * 0.55, 22 * k * 0.55, -48 * k * 0.55);
    ctx.bezierCurveTo(52 * k * 0.55, -48 * k * 0.55, 60 * k * 0.55, 6 * k * 0.55, 0, 44 * k * 0.55);
    ctx.closePath();
    ctx.lineJoin = 'round'; ctx.lineWidth = 14; ctx.strokeStyle = '#0b0b10'; ctx.stroke();
    ctx.fillStyle = color; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-26, -28, 11, 7, -0.7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
}

// ------------------------------------------------------------------ "SUSCRÍBETE" red flat sign
export function subscribeSign(ww = 3.6) {
  const w = 768, h = 300;
  return new CanvasPlane(w, h, ww, ww * h / w, (ctx, W, H) => {
    ctx.save();
    rr(ctx, 20, 30, W - 40, H - 70, 44);
    ctx.fillStyle = '#0b0b10'; ctx.translate(0, 12); ctx.fill(); ctx.translate(0, -12);
    ctx.lineJoin = 'round'; ctx.lineWidth = 16; ctx.strokeStyle = '#0b0b10'; rr(ctx, 20, 30, W - 40, H - 70, 44); ctx.stroke();
    ctx.fillStyle = '#ff1f2d'; rr(ctx, 20, 30, W - 40, H - 70, 44); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.22)'; rr(ctx, 44, 46, W - 88, 52, 26); ctx.fill();
    // bell
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0b0b10'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(108, 190); ctx.quadraticCurveTo(108, 100, 150, 96); ctx.quadraticCurveTo(192, 100, 192, 190); ctx.lineTo(206, 204); ctx.lineTo(94, 204); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(150, 218, 14, 0, Math.PI); ctx.fill(); ctx.stroke();
    ctx.font = `900 86px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.fillText('SUSCRÍBETE', W / 2 + 92, H / 2 - 4);
    ctx.restore();
  });
}

// ------------------------------------------------------------------ soft radial glow (aura / halo)
export function glowTexture(color = '#ffffff') {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, color); gr.addColorStop(0.35, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  // rgba tail: build properly via globalAlpha
  g.clearRect(0, 0, 256, 256);
  g.fillStyle = color;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.4, 'rgba(255,255,255,0.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
export function glowSprite(color, size) {
  const mat = new THREE.MeshBasicMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.renderOrder = 8;
  return m;
}

export { V };
