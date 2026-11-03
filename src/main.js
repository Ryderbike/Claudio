import * as THREE from 'three';
import { OUTLINE } from './lib/toon.js';
import { createWorld } from './lib/world.js';
import { updateScene, DURATION, CUTS } from './shots.js';
import { setupSubs, updateSubs } from './subs.js';

const q = new URLSearchParams(location.search);
const W = +(q.get('w') || 1080), H = +(q.get('h') || 1920);
await document.fonts.load('900 40px Inter');
const world = createWorld(W, H);
const canvas = world.renderer.domElement; canvas.id = 'c';
document.getElementById('c').replaceWith(canvas);
const stage = document.getElementById('stage'); stage.style.width = W + 'px'; stage.style.height = H + 'px';
await setupSubs(W, H);
const dh = document.getElementById('dh'), dv = document.getElementById('dv');

function renderAt(t) {
  const w = world;
  updateScene(w, t);
  const r = w.renderer;
  r.setScissorTest(true);
  r.setClearColor(0x000000, 1); r.setViewport(0, 0, W, H); r.setScissor(0, 0, W, H); r.clear(true, true, true);
  for (const v of w.views) {
    const gy = H - v.y - v.h;
    r.setViewport(v.x, gy, v.w, v.h); r.setScissor(v.x, gy, v.w, v.h);
    r.setClearColor(v.clear, 1); r.clear(true, true, true);
    OUTLINE.uRes.value.set(v.w, v.h);
    OUTLINE.uScale.value = Math.min(1, Math.sqrt((v.w * v.h) / (1080 * 1920)) * 1.25) * (W / 1080);
    r.render(w.scene, v.cam);
  }
  // split dividers
  dh.style.display = w.divider && !w.dividerVertical ? 'block' : 'none'; dh.style.top = H / 2 + 'px';
  dv.style.display = w.divider && w.dividerVertical ? 'block' : 'none'; dv.style.left = (w.views[0] ? w.views[0].w : 0) + 'px';
  updateSubs(t);
}
window.renderAt = renderAt;
window.__world = world;
window.__duration = DURATION;
if (q.get('t') !== null) renderAt(+q.get('t'));
window.__ready = true;
