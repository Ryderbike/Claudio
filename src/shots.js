// The 17 cuts of "El Paréntesis del Viernes (Perro)". Every cut is a pure function of time.
import * as THREE from 'three';
import { V, clamp, lerp, smooth, smoother, easeOut, easeOutExpo, easeOutBack, seg, rnd } from './lib/toon.js';
import { setCam, shake, MOODS } from './lib/world.js';
import { HALL, KITCHEN } from './lib/sets.js';
import { DOG } from './lib/dog.js';

export const CUTS = [
  [0, 2.5], [2.5, 5.5], [5.5, 8.5], [8.5, 11], [11, 14], [14, 17], [17, 20], [20, 23], [23, 26], [26, 29],
  [29, 32], [32, 35.5], [35.5, 39], [39, 42], [42, 44.5], [44.5, 47.5], [47.5, 50],
];
export const DURATION = 50;
const HX = HALL.x, KX = KITCHEN.x;
const GOLD = 0xffd34a;

// ------------------------------------------------------------------------------------------ helpers
function reset(w) {
  const { human, dog } = w;
  human.visible = true; human.position.set(0, 1.2, 0); human.rotation.set(0, 0, 0);
  human.torso.rotation.set(0, 0, 0); human.head.rotation.set(0, 0, 0);
  human.shirt.scale.set(0.43, 0.62, 0.3);
  human.xray(0); human.setHand(-1, null); human.setHand(1, null); human.setFoot(-1, null); human.setFoot(1, null);
  human.setFace({});
  human.chest.visible = false; human.brain.visible = false;
  w.battery.visible = false; w.toggle.visible = false; w.brainH.visible = false; w.scribble.visible = false;
  dog.visible = true; dog.position.set(0, 0, 0); dog.rotation.set(0, 0, 0); dog.bodyY = DOG.bodyY;
  dog.pose = { headPitch: 0, headYaw: 0, headRoll: 0, jaw: 0, earLift: [0, 0], eyeOpen: 1, closed: false, tongue: 0 };
  dog.setEyes({}); dog.xrayHead(0); dog.xrayEars(0); dog.setAura(0xffffff, 0);
  dog.tailAngle = 0; dog.tailLift = 0.75;
  for (let i = 0; i < 4; i++) dog.setFoot(i, null);
  w.dogShadow.visible = false; w.humanShadow.visible = false;
  w.aura.visible = false; w.aura.material.opacity = 0;
  w.phone.group.visible = false; w.ball.group.visible = false;
  w.gaugeD.visible = false; w.qmark.visible = false; w.sign.visible = false; w.hearts.forEach((h) => (h.visible = false));
  w.meter.visible = false; w.rings.forEach((r) => (r.visible = false));
  w.stress.mesh.visible = false; w.stressGlow.mesh.visible = false; w.dust.mesh.visible = false; w.puff.visible = false;
  w.goldLine.visible = false; w.goldPulse.visible = false; w.bubble.visible = false; w.bubbleRim.visible = false; w.sunBeam.visible = false;
  w.living.seats.forEach((s) => s.scale.set(1, 1, 1));
  w.living.sunGlow.material.opacity = 0; w.living.lampGlow.material.opacity = 0;
  w.living.shadeMat.emissive.set(0x000000);
  w.kitchen.hinge.rotation.y = 0;
  w.living.city.redraw({ t: 0, speed: 0.12, warm: 0 }, 'static');
  w.views = [{ x: 0, y: 0, w: w.W, h: w.H, cam: w.cam, clear: 0x0d1226 }];
}

function breathe(t, rate = 0.33, a = 0.02) { return Math.sin(t * Math.PI * 2 * rate) * a; }

function sit(w, o = {}) {
  const h = w.human;
  const { x = 0, z = 0.08, lean = -0.2, headPitch = 0.22, headYaw = 0, headRoll = 0, feetZ = 1.5, torsoRoll = 0, y = 1.2 } = o;
  h.position.set(x, y, z); h.rotation.set(0, 0, 0);
  h.torso.rotation.set(lean, 0, torsoRoll); h.head.rotation.set(headPitch, headYaw, headRoll);
  h.setFoot(-1, V(x - 0.27, 0.17, feetZ)); h.setFoot(1, V(x + 0.27, 0.17, feetZ + 0.12));
  w.humanShadow.visible = false;
}
function restHands(w, x = 0, z = 0.08) {
  w.human.setHand(-1, V(x - 0.42, 1.52, z + 0.72)); w.human.setHand(1, V(x + 0.42, 1.52, z + 0.72));
}
function breatheShirt(w, t, a = 0.018, rate = 0.3) {
  const k = breathe(t, rate, a);
  w.human.shirt.scale.set(0.43 * (1 + k * 0.6), 0.62 * (1 + k), 0.3 * (1 + k));
}
function placeBillboard(obj, cam, pos) { obj.position.copy(pos); obj.quaternion.copy(cam.quaternion); }
const _q = new THREE.Quaternion();
/** make a child icon face the camera (parent's world rotation compensated) */
function faceCam(obj, cam) { obj.parent.updateWorldMatrix(true, false); obj.parent.getWorldQuaternion(_q); obj.quaternion.copy(_q.invert()).multiply(cam.quaternion); }

function setAuraFx(w, color, k, size = 5.5, alpha = 0.8) {
  w.aura.visible = k > 0.01;
  w.aura.material.color.set(color);
  w.aura.material.opacity = alpha * k;
  w.dog.setAura(color, 0.32 * k);
}

/** frame so that `width` world units are visible across the screen at the target distance */
function fit(cam, aspect, pos, target, width, roll = 0) {
  const d = pos.distanceTo(target);
  const fov = 2 * Math.atan(width / aspect / 2 / d) * 180 / Math.PI;
  setCam(cam, pos, target, fov, roll, aspect);
}
function view(w, pos, target, width, roll = 0) { fit(w.cam, w.W / w.H, pos, target, width, roll); }
const headPos = (dog) => { dog.updateMatrixWorld(true); return dog.skull.getWorldPosition(new THREE.Vector3()); };

// =========================================================================================== CUT 01  fridge POV
function cut01(w, t, u, D) {
  const { human } = w;
  w.rig.set('fridge');
  w.rig.point('a', 0xe8f6ff, 1.2, V(KX, 4.2, 0.6), 3);
  w.views[0].clear = 0x0b1230;
  // door swings open fast
  const dOpen = easeOut(seg(u, 0.0, 0.85));
  w.kitchen.hinge.rotation.y = -lerp(1.05, 2.0, dOpen);
  // character
  human.position.set(KX, 1.95, 5.6); human.rotation.set(0, Math.PI, 0);
  human.torso.rotation.set(0.16 + breathe(u, 0.5, 0.01), 0, 0.03);
  human.head.rotation.set(0.32 + breathe(u, 0.5, 0.015), 0.05, 0.1);
  human.setFace({ eyeOpen: 0.32 + 0.0 * u, bags: true, mouth: 'frown', look: [0, -0.4] });
  const blink = Math.abs(u - 1.45) < 0.1 ? 0.0 : 1;
  if (blink === 0) human.setFace({ eyeOpen: 0.05, bags: true, mouth: 'frown' });
  human.setHand(-1, V(KX + 0.55, 1.2, 5.3)); human.setHand(1, V(KX - 0.5, 1.15, 5.45));
  w.living.city.visible = true;
  const z = easeOutExpo(seg(u, 0.25, 2.4));
  const fov = lerp(84, 21, z);
  const hp = V(KX, 3.78, 5.6);
  setCam(w.cam, V(KX, 2.95, -1.2).add(shake(u, 0.012 * (1 - z), 23)), V(KX, lerp(3.45, 3.85, z), 5.6), fov, 0, w.W / w.H);
}

// =========================================================================================== CUT 02  collapse onto sofa
function cut02(w, t, u, D) {
  const { human } = w;
  w.rig.set('night'); w.rig.point('a', 0xff5a5a, 0.1, V(0.2, 2.6, 2.4), 2.5);
  const fall = seg(u, 1.15, 1.75);
  const fe = fall * fall * (3 - 2 * fall) * 0.4 + fall * fall * 0.6;
  const standY = 1.97 + 0.02 * Math.sin(u * 2.3), sitY = 1.2;
  const impact = Math.max(0, u - 1.75);
  const bounce = Math.exp(-impact * 6) * Math.sin(impact * 24) * 0.12;
  const py = lerp(standY, sitY, fe) + bounce * (fall >= 1 ? 1 : 0);
  const pz = lerp(1.55, 0.08, fe);
  human.position.set(0, py, pz);
  const lean = lerp(0.12, -0.24, fe) + (fall >= 1 ? -Math.exp(-impact * 5) * Math.sin(impact * 18) * 0.06 : 0);
  human.torso.rotation.set(lean, 0, 0.0);
  human.head.rotation.set(lerp(0.3, -0.05, fe) + (fall >= 1 ? 0.25 * Math.exp(-impact * 4) * Math.cos(impact * 12) : 0), 0, 0.05);
  human.setFoot(-1, V(-0.27, 0.17, lerp(1.7, 1.65, fe))); human.setFoot(1, V(0.27, 0.17, lerp(1.75, 1.78, fe)));
  // arms: swing up while falling then flop
  const flail = fall < 1 ? Math.sin(fall * Math.PI) * 0.7 : 0;
  human.setHand(-1, V(-0.85 - flail * 0.5, lerp(0.9, 1.5, fe) + flail * 1.0, lerp(1.4, 0.8, fe)));
  human.setHand(1, V(0.85 + flail * 0.5, lerp(0.9, 1.5, fe) + flail * 1.0, lerp(1.4, 0.8, fe)));
  human.setFace({ eyeOpen: 0.3, bags: true, mouth: fall > 0.9 ? 'oval' : 'frown' });
  breatheShirt(w, u, 0.03, 0.6);
  // seat squash
  const sq = fall >= 1 ? Math.exp(-impact * 7) * Math.cos(impact * 20) * 0.16 : 0;
  w.living.seats[1].scale.y = 1 - Math.max(0, sq) * (u > 1.75 ? 1 : 0) - (fall > 0.9 ? 0.04 : 0);
  // X-ray torso fades in, battery icon drains with blinking
  const xr = smooth(seg(u, 0.15, 0.6));
  human.xray(xr);
  human.chest.visible = xr > 0.02; w.battery.visible = xr > 0.02;
  const level = lerp(1.0, 0.02, easeOut(seg(u, 0.7, 2.4)));
  const blinkOn = u > 2.2 ? (Math.sin(u * 22) > -0.2 ? 1 : 0.15) : 1;
  w.battery.redraw({ level: Math.max(level, 0.0), color: '#ff2a3a', label: `${Math.max(1, Math.round(level * 100))}%` }, `${Math.round(level * 50)}`);
  w.battery.material.opacity = blinkOn * xr;
  human.updateMatrixWorld(true);
  // dust puffs on impact
  w.dust.mesh.visible = false;
  if (impact > 0 && impact < 0.9) {
    w.dust.begin(w.cam.quaternion);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI - 0.0, sp = 0.6 + rnd(i) * 0.8;
      const p = V(Math.cos(a) * sp * impact * 3.2 * (i % 2 ? 1 : -1) * 0.8, 1.15 + Math.sin(a) * impact * 1.0, 1.0 + rnd(i + 9) * 0.6);
      w.dust.push(p, 0.06 + impact * 0.16, 0xb8c0e0, (1 - impact / 0.9) * 0.35);
    }
    w.dust.end();
  }
  const sh = shake(u, 0.12 * Math.exp(-impact * 6) * (u > 1.75 ? 1 : 0), 31);
  view(w, V(3.2, 2.9, 9.0).add(sh), V(0, 1.95, 0.6), 4.4);
  w.views[0].clear = 0x161b36;
}

// =========================================================================================== CUT 03  glued to the phone
function cut03(w, t, u, D) {
  const { human } = w;
  w.rig.set('phone');
  const phonePos = V(-0.02, 1.98, 0.78);
  w.rig.point('a', 0x7fb8ff, 1.15, V(0, 2.2, 1.6), 1.6);
  sit(w, { lean: -0.3, headPitch: 0.42, headRoll: 0.06 });
  breatheShirt(w, u, 0.02, 0.28);
  human.setFace({ eyeOpen: 0.38, bags: true, mouth: 'flat' });
  // phone in both hands at chest
  w.phone.group.visible = true;
  w.phone.group.position.copy(phonePos); w.phone.group.rotation.set(-0.5, 0, 0);
  w.phone.screen.redraw({ t: u }, `${Math.floor(u * 24)}`);
  human.setHand(-1, V(-0.36, 1.84, 0.82));
  const swipe = Math.sin(u * 7.0) * 0.12;
  human.setHand(1, V(0.34, 1.92 + swipe * 0.4, 0.86));
  const xr = smooth(seg(u, 0.35, 0.8));
  human.xray(xr);
  human.brain.visible = xr > 0.02; w.scribble.visible = xr > 0.02;
  w.scribble.rotation.set(u * 5.2, u * 7.7, u * 3.1);
  w.scribble.scale.setScalar(0.85 + 0.12 * Math.sin(u * 9));
  w.scribble.userData.tube.material.opacity = xr;
  human.updateMatrixWorld(true);
  const sh = shake(u, 0.012, 11);
  view(w, V(2.6, 2.7, 6.0).add(sh), V(0.05, 2.3, 0.4), 2.7);
  w.views[0].clear = 0x161b36;
}

// =========================================================================================== CUT 04  protocol activated
function addRadar(w, u, srcs, t0, period, life, maxR, cam) {
  let k = 0;
  srcs.forEach((s, si) => {
    for (let n = 0; n < 4; n++) {
      const tt = u - t0 - n * period - si * 0.04;
      const ring = w.rings[k++];
      if (!ring) return;
      if (tt < 0 || tt > life) { ring.visible = false; continue; }
      const p = tt / life;
      ring.visible = true;
      ring.position.copy(s.pos);
      ring.quaternion.copy(cam.quaternion);
      ring.scale.setScalar(0.05 + p * s.r * maxR * 0.62);
      ring.material.opacity = (1 - p) * 0.9;
      ring.material.color.set(0x33e8ff);
    }
  });
}
function cut04(w, t, u, D) {
  const { dog } = w;
  w.rig.set('hall');
  w.rig.point('a', 0xffa24a, 0.9, V(HX - 0.8, 4.2, 0.0), 3);
  dog.position.set(HX, 0, 0.4); dog.rotation.set(0, 1.12, 0);
  dog.pose.headPitch = -0.1 + 0.03 * Math.sin(u * 3); dog.pose.headYaw = 0.0; dog.pose.earLift = [0.12, 0.12];
  dog.tailAngle = 0.0; dog.tailLift = 0.5;
  const snap = easeOutExpo(seg(u, 1.05, 1.5));
  dog.bodyY = DOG.bodyY;
  dog.setEyes({ open: 1 });
  dog.solve();
  w.dogShadow.visible = true; w.dogShadow.position.set(HX, 0.04, 0.4);
  // radar rings at eyes + nose
  const head = dog.head; head.updateMatrixWorld(true);
  const wp = (v) => dog.localToWorld(v.clone()); // already in dog space; head transforms applied below
  const eyeL = dog.eyes[0].g.getWorldPosition(new THREE.Vector3()), eyeR = dog.eyes[1].g.getWorldPosition(new THREE.Vector3());
  const nose = dog.nose.getWorldPosition(new THREE.Vector3());
  const hp = headPos(dog);
  const camPos = hp.clone().add(V(4.6, 0.7, 4.8));
  view(w, camPos.add(shake(u, 0.01, 13)), hp.clone().add(V(0.2, lerp(-0.6, -0.1, snap), 0)), lerp(4.2, 1.9, snap));
  const scale = 1 + 0.4 * snap;
  addRadar(w, u, [{ pos: eyeL, r: 1.0 }, { pos: eyeR, r: 1.0 }, { pos: nose, r: 1.6 }], 0.35, 0.5, 1.4, 1.8, w.cam);
  w.views[0].clear = 0x0b0f1c;
}

// =========================================================================================== CUT 05  split screen
function cut05(w, t, u, D) {
  const { human, dog } = w;
  w.rig.set('night');
  w.rig.point('a', 0xffa24a, 0.8, V(HX - 0.8, 4.2, 0.0), 3);
  w.rig.point('b', 0x7fb8ff, 0.8, V(0, 2.1, 1.7), 1.8);
  // top: silent slumped human
  sit(w, { lean: -0.3, headPitch: 0.34, headRoll: 0.04 });
  breatheShirt(w, u, 0.02, 0.28);
  human.setFace({ eyeOpen: 0.35, bags: true, mouth: 'flat' });
  w.phone.group.visible = true; w.phone.group.position.set(-0.02, 1.62, 0.9); w.phone.group.rotation.set(-0.7, 0, 0);
  w.phone.screen.redraw({ t: u * 0.4 }, `${Math.floor(u * 10)}`);
  human.setHand(-1, V(-0.38, 1.72, 0.9)); human.setHand(1, V(0.38, 1.72, 0.92));
  // bottom: curious dog tilting head
  dog.position.set(HX, 0, 0.4); dog.rotation.set(0, 0.25, 0);
  const tilt = smooth(seg(u, 0.35, 0.8)) * (1 - 0.0) * (1 + 0.15 * Math.sin(u * 2.2));
  dog.pose.headRoll = -0.42 * tilt; dog.pose.headPitch = 0.0; dog.pose.earLift = [0.0 + 0.1 * tilt, 0.0];
  dog.tailAngle = Math.sin(u * 4) * 0.25; dog.tailLift = 0.8;
  dog.setEyes({ open: 1 });
  dog.solve(); w.dogShadow.visible = true; w.dogShadow.position.set(HX, 0.04, 0.4);
  human.updateMatrixWorld(true);
  // ? mark above the head, bouncing
  const head = dog.head.getWorldPosition(new THREE.Vector3());
  const bounce = Math.abs(Math.sin(u * 5.2)) * 0.28;
  const pop = easeOutBack(seg(u, 0.4, 0.7));
  w.qmark.visible = true; w.qmark.scale.setScalar(Math.max(pop, 0.001));
  const top = { x: 0, y: 0, w: w.W, h: w.H / 2, cam: w.cam, clear: 0x161b36 };
  const bot = { x: 0, y: w.H / 2, w: w.W, h: w.H / 2, cam: w.cam2, clear: 0x0b0f1c };
  w.views = [top, bot];
  fit(w.cam, top.w / top.h, V(2.2, 2.8, 6.4), V(0, 1.9, 0.4), 4.6);
  const hp5 = headPos(dog);
  fit(w.cam2, bot.w / bot.h, hp5.clone().add(V(0.5, 0.6, 6.4)), hp5.clone().add(V(0, 0.2, 0)), 3.6);
  placeBillboard(w.qmark, w.cam2, V(head.x + 0.1, head.y + 1.35 + bounce, head.z + 0.4));
  w.divider = true;
}

// =========================================================================================== CUT 06  ear = rhythm detector
function cut06(w, t, u, D) {
  const { dog } = w;
  w.rig.set('hall'); w.rig.point('a', 0xffa24a, 0.9, V(HX - 0.8, 4.2, 0.0), 3);
  dog.position.set(HX, 0, 0.4); dog.rotation.set(0, Math.PI / 2, 0);
  const lift = smooth(seg(u, 0.9, 1.4)) * 0.35 + 0.05 * Math.sin(u * 5) * smooth(seg(u, 1.4, 1.8));
  dog.pose.earLift = [lift, 0.0]; dog.pose.headPitch = 0.04; dog.pose.headYaw = 0;
  dog.setEyes({ open: 1 });
  const xr = smooth(seg(u, 0.15, 0.55));
  dog.xrayEars(xr);
  dog.solve();
  // meter: bars spike to red
  w.meter.visible = xr > 0.02;
  w.meter.position.set(-0.15, -0.32, -0.02); w.meter.rotation.set(0, -Math.PI / 2, 0);
  w.meterFrame.position.set(0, 0.05, -0.01);
  const spikeK = smooth(seg(u, 0.9, 1.5));
  w.meterBars.forEach((b, i) => {
    const base = 0.12 + 0.1 * (0.5 + 0.5 * Math.sin(u * 9 + i * 1.7));
    const spike = (0.2 + 0.45 * (0.5 + 0.5 * Math.sin(u * 14 + i * 2.3))) * spikeK;
    const hgt = Math.min(0.62, (base + spike) * 1.2);
    b.scale.y = hgt; b.position.set(-0.27 + i * 0.09, -0.3 + hgt / 2, 0.0);
    const col = new THREE.Color().setHSL(lerp(0.38, 0.0, clamp(hgt / 0.55)), 1, 0.55);
    b.material.color.copy(col); b.material.opacity = xr;
  });
  w.meterFrame.material.opacity = 0.5 * xr;
  // incoming soundwave arcs toward the ear
  w.dust.mesh.visible = false;
  dog.updateMatrixWorld(true);
  const earW = dog.ears[0].ear.getWorldPosition(new THREE.Vector3());
  w.rings.forEach((r, i) => {
    const tt = (u * 1.1 + i * 0.28) % 1.1; const k = i < 4 ? 1 : 0;
    if (!k) { r.visible = false; return; }
    const p = tt / 1.1; r.visible = true;
    r.position.set(earW.x + 1.6 - p * 1.35, earW.y + 0.25, earW.z + 0.5); r.quaternion.copy(w.cam.quaternion);
    r.scale.setScalar(0.18 + p * 0.2); r.material.opacity = Math.sin(p * Math.PI) * 0.7 * smooth(seg(u, 0.4, 0.8)); r.material.color.set(0x6fd0ff);
  });
  const camShift = V(0, 0, 0).add(shake(u, 0.006, 9));
  const hp6 = headPos(dog);
  view(w, hp6.clone().add(V(0.3, 0.25, 6.0)).add(camShift), hp6.clone().add(V(0.05, -0.15, 0)), lerp(2.9, 2.2, easeOut(seg(u, 0, 3))));
  w.views[0].clear = 0x0b0f1c;
  w.dogShadow.visible = true; w.dogShadow.position.set(HX, 0.04, 0.4);
}

// =========================================================================================== CUT 07  heavy sighs
function cut07(w, t, u, D) {
  const { human } = w;
  w.rig.set('night'); w.rig.point('a', 0x7fb8ff, 0.7, V(0, 2.0, 1.7), 1.8);
  const inhale = smooth(seg(u, 0.2, 0.8)), exh = seg(u, 0.9, 1.4);
  sit(w, { lean: -0.28 - 0.04 * inhale + 0.05 * smooth(exh), headPitch: 0.3 - 0.1 * inhale + 0.18 * smooth(exh), headRoll: 0.05 });
  human.setFace({ eyeOpen: 0.35, bags: true, mouth: exh > 0 && exh < 1 ? 'oval' : 'flat' });
  breatheShirt(w, u, 0.05, 0.4);
  w.phone.group.visible = true; w.phone.group.position.set(-0.02, 1.6, 0.9); w.phone.group.rotation.set(-0.7, 0, 0);
  w.phone.screen.redraw({ t: u * 0.3 }, `${Math.floor(u * 8)}`);
  human.setHand(-1, V(-0.38, 1.7, 0.9)); human.setHand(1, V(0.38, 1.7, 0.92));
  human.updateMatrixWorld(true);
  // puff leaves the mouth and drifts right toward the dog
  const mouth = human.mouth.getWorldPosition(new THREE.Vector3());
  const p = seg(u, 1.0, 3.0);
  w.puff.visible = u > 1.0 && p < 0.98;
  w.puff.position.set(mouth.x + 0.25 + p * 4.4, mouth.y - 0.02 + p * 0.5 + Math.sin(p * 6) * 0.05, mouth.z + 0.55);
  const ps = (0.18 + easeOut(seg(u, 1.0, 2.0)) * 0.62) * (1 - smooth(seg(p, 0.85, 0.98)));
  w.puff.scale.setScalar(Math.max(ps, 0.001)); w.puff.quaternion.copy(w.cam.quaternion);
  view(w, V(2.4, 2.9, 5.2).add(shake(u, 0.01, 8)), V(0.7, 2.5, 0.3), 3.6);
  w.views[0].clear = 0x161b36;
}

// =========================================================================================== CUT 08  smell of tiredness
function stressParticles(w, u, anchors, n, speed = 0.55, spread = 1) {
  w.stress.begin(w.cam.quaternion); w.stressGlow.begin(w.cam.quaternion);
  for (let i = 0; i < n; i++) {
    const a = anchors[i % anchors.length];
    const ph = ((u * speed + rnd(i * 3.1) * 3) % 1.6) / 1.6; // 0..1 life
    const drift = (rnd(i * 7.3) - 0.5) * 1.1 * spread;
    const side = a.x >= 0 ? 1 : -1;
    const pos = V(a.x + drift * 0.5 + side * (0.25 + ph * 0.6) + Math.sin(u * 2.1 + i) * 0.06, a.y - 0.1 + ph * 0.75, a.z + 0.35 + rnd(i * 5.1) * 0.4);
    const fade = Math.sin(ph * Math.PI);
    const sz = 0.022 + rnd(i * 2.3) * 0.03;
    w.stress.push(pos, sz, 0xff2e4a, fade);
    w.stressGlow.push(pos, sz * 2.8, 0xff2e4a, 0.22 * fade);
  }
  w.stress.end(); w.stressGlow.end();
}
function cut08(w, t, u, D) {
  const { human } = w;
  w.rig.set('night'); w.rig.point('a', 0xff4a5e, 0.18, V(0, 2.4, 2.0), 2);
  sit(w, { lean: -0.3, headPitch: 0.34, headRoll: 0.05 });
  breatheShirt(w, u, 0.03, 0.3);
  human.setFace({ eyeOpen: 0.3, bags: true, mouth: 'flat' });
  w.phone.group.visible = false;
  human.setHand(-1, V(-0.4, 1.5, 0.8)); human.setHand(1, V(0.4, 1.5, 0.8));
  human.updateMatrixWorld(true);
  const sl = human.torso.localToWorld(V(-0.5, 0.98, 0.1)), sr = human.torso.localToWorld(V(0.5, 0.98, 0.1)), nk = human.torso.localToWorld(V(0, 1.1, 0.1));
  stressParticles(w, u, [sl, sr, V(sl.x * 0.7, sl.y - 0.15, sl.z), V(sr.x * 0.7, sr.y - 0.15, sr.z)], 30, 0.5);
  view(w, V(1.9, 2.6, 4.8).add(shake(u, 0.006, 8)), V(0.0, 2.1, 0.3), 2.0);
  w.views[0].clear = 0x161b36;
}

// =========================================================================================== CUT 09  cortisol -> 93%
function cut09(w, t, u, D) {
  const { dog } = w;
  w.rig.set('hall'); w.rig.point('a', 0xffa24a, 0.9, V(HX - 0.8, 4.2, 0.0), 3);
  dog.position.set(HX, 0, 0.4); dog.rotation.set(0, Math.PI / 2, 0);
  const sn = (a, b) => Math.sin(clamp((u - a) / (b - a)) * Math.PI);
  dog.pose.headPitch = -0.12 + 0.12 * sn(0.9, 1.25) + 0.12 * sn(1.4, 1.75);
  dog.pose.earLift = [0.06, 0.06];
  dog.setEyes({ open: 1 });
  dog.xrayHead(smooth(seg(u, 0.1, 0.5))); dog.xrayEars(smooth(seg(u, 0.1, 0.5)));
  dog.solve();
  w.dogShadow.visible = true; w.dogShadow.position.set(HX, 0.04, 0.4);
  dog.updateMatrixWorld(true);
  const nose = dog.nose.getWorldPosition(new THREE.Vector3());
  const skull = dog.skull.getWorldPosition(new THREE.Vector3());
  // red dots float in from the right, get sucked into the snout, then hop to the brain
  w.stress.begin(w.cam.quaternion); w.stressGlow.begin(w.cam.quaternion);
  const brainP = skull.clone().add(V(-0.0, 0.05, 0.0));
  for (let i = 0; i < 16; i++) {
    const s = rnd(i * 4.7) * 1.2;
    const tt = (u - 0.9 - s * 0.9) / 1.0; // per-dot timeline
    if (tt < 0 || tt > 1.25) continue;
    const start = V(nose.x + 2.4 + rnd(i) * 0.8, nose.y + (rnd(i * 2.2) - 0.4) * 1.1, nose.z + (rnd(i * 3.3) - 0.5) * 0.4);
    let pos;
    if (tt < 0.7) { const k = smooth(tt / 0.7); pos = start.clone().lerp(nose.clone().add(V(0.05, 0, 0)), k); pos.y += Math.sin(k * 3 + i) * 0.1 * (1 - k); }
    else { const k = smooth((tt - 0.7) / 0.55); pos = nose.clone().lerp(brainP.clone().add(V(0.0, 0.0, 0.0)), k); }
    const alpha = tt > 1.15 ? 1 - (tt - 1.15) / 0.1 : 1;
    w.stress.push(pos, 0.055, 0xff2e4a, clamp(alpha)); w.stressGlow.push(pos, 0.19, 0xff2e4a, 0.3 * clamp(alpha));
  }
  w.stress.end(); w.stressGlow.end();
  // gauge rising to 93%
  const g = smooth(seg(u, 1.55, 2.4));
  w.gaugeD.visible = u > 1.3;
  const gs = easeOutBack(seg(u, 1.3, 1.7));
  w.gaugeD.scale.setScalar(Math.max(0.001, gs) * 0.62);
  placeBillboard(w.gaugeD, w.cam, brainP.clone().add(V(-0.05, 0.12, 0.55)));
  const val = 0.93 * g;
  const col = val < 0.5 ? '#ff5a4a' : '#25e06a';
  w.gaugeD.redraw({ value: val, color: val < 0.6 ? '#ffb02e' : '#25e06a', pct: val * 100 }, `${Math.round(val * 100)}${val < 0.6}`);
  const hp9 = headPos(dog);
  view(w, hp9.clone().add(V(0.4, 0.15, 6.0)).add(shake(u, 0.005, 9)), hp9.clone().add(V(0.5, -0.1, 0)), 3.0);
  w.views[0].clear = 0x0b0f1c;
}

// =========================================================================================== CUT 10  the ball drops
function cut10(w, t, u, D) {
  const { dog } = w;
  w.rig.set('hall'); w.rig.point('a', 0xffa24a, 0.9, V(HX - 0.8, 4.2, 0.0), 3);
  dog.position.set(HX - 0.3, 0, 0.5); dog.rotation.set(0, 1.35, 0);
  const open = smooth(seg(u, 1.3, 1.75));
  dog.pose.jaw = 0.1 + 0.55 * open; dog.pose.headPitch = lerp(0.2, 0.7, smooth(seg(u, 0.5, 1.5))); dog.bodyY = DOG.bodyY - 0.12 * smooth(seg(u, 0.5, 1.5));
  dog.pose.earLift = [0.05, 0.05];
  dog.setEyes({ open: 1 });
  dog.solve(); dog.updateMatrixWorld(true);
  w.dogShadow.visible = true; w.dogShadow.position.set(HX - 0.3, 0.04, 0.5);
  // ball: in the mouth, then ballistic with slow-mo gravity + 2 bounces
  w.ball.group.visible = true;
  const mouthW = dog.head.localToWorld(V(0, 0.0, 0.72));
  const dropT = 1.72, g = 6.4, floorY = 0.25;
  if (u < dropT) { w.ball.group.position.copy(mouthW); w.ball.group.rotation.set(u * 2, 0, u); }
  else {
    const x0 = mouthW.x, y0 = Math.max(mouthW.y, 0.6), z0 = mouthW.z;
    let tt = u - dropT; let y = y0; let vy = 0; let x = x0; const vx = 0.22;
    // integrate analytically segment by segment
    let h = y0 - floorY, e = 0.55, tl = 0, n = 0;
    let cur = tt, py = floorY;
    let fall = Math.sqrt(2 * h / g);
    if (cur < fall) { py = y0 - 0.5 * g * cur * cur; }
    else {
      cur -= fall; let vimp = g * fall; let bounces = 0; py = floorY;
      while (bounces < 4) {
        const v0 = vimp * e; const air = 2 * v0 / g;
        if (cur < air) { py = floorY + v0 * cur - 0.5 * g * cur * cur; break; }
        cur -= air; vimp = v0; bounces++;
        if (bounces >= 3) { py = floorY; break; }
      }
    }
    w.ball.group.position.set(x0 + vx * Math.min(tt, 2.6) * 0.5, py, z0 + 0.0);
    w.ball.group.rotation.set(0.0, 0.0, -tt * 2.4);
  }
  const hp10 = headPos(dog);
  view(w, V(hp10.x + 3.2, 1.1, hp10.z + 5.0).add(shake(u, 0.004, 9)), V(hp10.x + 0.2, 0.85, hp10.z), 3.3);
  w.views[0].clear = 0x0b0f1c;
}

// =========================================================================================== CUT 11  dog walks, aura dims
function walkLegs(w, dog, phase, S = 0.62, lift = 0.28) {
  const sx = 0.3;
  dog.updateMatrixWorld(true);
  const defs = [[0, -sx, 0.5, 0.0], [1, sx, 0.5, 0.5], [2, -sx, -0.5, 0.5], [3, sx, -0.5, 0.0]];
  defs.forEach(([i, x, z0, off]) => {
    const p = (phase + off) % 1;
    let zr, y = DOG.footSize * 0.7;
    if (p < 0.6) zr = z0 + S / 2 - S * (p / 0.6);
    else { const k = (p - 0.6) / 0.4; zr = z0 - S / 2 + S * smooth(k); y += Math.sin(k * Math.PI) * lift; }
    dog.setFoot(i, dog.localToWorld(V(x, y, zr)));
  });
}
function cut11(w, t, u, D) {
  const { dog, human } = w;
  w.rig.set('night'); w.rig.point('a', 0xffc46b, 0.6, V(-1.5, 3.0, 4.0), 3);
  sit(w, { lean: -0.28, headPitch: 0.3, headRoll: 0.05 }); breatheShirt(w, u, 0.025, 0.3);
  human.setFace({ eyeOpen: 0.4, bags: true, mouth: 'flat' }); restHands(w);
  const freq = 1.45, S = 0.62; const v = S * freq / 0.6;
  const x = -6.0 + v * u;
  dog.position.set(x, 0, 2.5); dog.rotation.set(0, Math.PI / 2, 0);
  const phase = (u * freq) % 1;
  dog.bodyY = DOG.bodyY + 0.03 * Math.sin(phase * Math.PI * 4);
  dog.pose.headPitch = 0.12 + 0.03 * Math.sin(phase * Math.PI * 4); dog.pose.earLift = [0.0, 0.0];
  dog.tailAngle = Math.sin(u * 3.0) * 0.18; dog.tailLift = 0.55;
  dog.setEyes({ open: 1 });
  dog.solve();
  walkLegs(w, dog, phase, S);
  dog.solve();
  w.dogShadow.visible = true; w.dogShadow.position.set(x, 0.04, 2.5);
  const k = smooth(seg(u, 0.2, 2.9));
  const col = new THREE.Color(0xffe23a).lerp(new THREE.Color(0xffa72a), k);
  setAuraFx(w, col, lerp(1.0, 0.45, k), 5.8, 0.55);
  w.aura.position.set(x, 1.25, 2.0); w.aura.quaternion.copy(w.cam.quaternion); w.aura.scale.setScalar(1.15);
  const sh = V(0, 0, 0);
  view(w, V(x + 0.8, 2.1, 9.0).add(sh), V(x + 1.0, 1.4, 2.5), 5.4);
  w.views[0].clear = 0x161b36;
}

// =========================================================================================== CUT 12  climbs and curls up
function lyingFeet(w, dog, rootX, rootY, rootZ, curl = 1) {
  const f = (x, y, z) => V(rootX + x, rootY + y, rootZ + z);
  dog.setFoot(0, f(-0.28, 0.1, 1.25 - 0.3 * curl)); dog.setFoot(1, f(0.28, 0.1, 1.25 - 0.3 * curl));
  dog.setFoot(2, f(-0.5, 0.12, 0.2)); dog.setFoot(3, f(0.5, 0.12, 0.15));
}
function cut12(w, t, u, D) {
  const { dog, human } = w;
  w.rig.set('night'); w.rig.point('a', 0xffc46b, 0.6, V(-1.0, 3.0, 5.0), 3);
  // human stays slumped
  sit(w, { lean: -0.26, headPitch: 0.3, headRoll: 0.05 }); breatheShirt(w, u, 0.025, 0.3);
  human.setFace({ eyeOpen: 0.4, bags: true, mouth: 'flat' });
  w.phone.group.visible = true; w.phone.group.position.set(0.55, 1.62, 0.95); w.phone.group.rotation.set(-0.7, -0.2, 0);
  w.phone.screen.redraw({ t: 0.2 }, 'idle');
  human.setHand(-1, V(-0.42, 1.52, 0.8)); human.setHand(1, V(0.56, 1.66, 0.92));
  // dog trajectory
  const hopStart = 0.6, hopEnd = 1.35;
  const turn = smooth(seg(u, 0.0, 0.5));
  let pos = V(-1.0, 0, 2.2), yaw = lerp(Math.PI / 2, Math.PI, turn);
  let bodyY = DOG.bodyY, pitch = 0;
  const hop = seg(u, hopStart, hopEnd);
  if (u >= hopStart) {
    const arcY = Math.sin(hop * Math.PI) * 0.55 + hop * 1.0; // seat height 1.0
    pos = V(-0.95, arcY, lerp(2.2, 0.55, smoothHop(hop)));
    pitch = -0.5 * Math.sin(hop * Math.PI);
  }
  if (u >= hopEnd) {
    const k = smooth(seg(u, hopEnd, 2.1));
    pos = V(-0.95, 1.0, 0.55);
    yaw = lerp(Math.PI, 0.0, smooth(seg(u, 1.4, 2.3)));
    bodyY = lerp(DOG.bodyY, 0.58, k);
  }
  dog.position.copy(pos); dog.rotation.set(0, yaw, 0);
  dog.pose.headPitch = u < hopStart ? -0.3 : u >= hopEnd ? lerp(-0.2, 0.5, smooth(seg(u, 1.8, 2.6))) : -0.3;
  dog.pose.earLift = [0.05, 0.05]; dog.bodyY = bodyY;
  const closed = u > 2.8;
  dog.setEyes({ open: u > 2.4 ? lerp(1, 0.2, smooth(seg(u, 2.4, 2.9))) : 1, closed });
  dog.tailAngle = u > 2.4 ? 0 : Math.sin(u * 5) * 0.2; dog.tailLift = 0.5;
  // legs
  dog.solve(); dog.updateMatrixWorld(true);
  if (u < hopStart) { walkLegs(w, dog, 0.0 + 0.0, 0.0, 0.0); }
  if (u >= hopStart && u < hopEnd) {
    const k = Math.sin(hop * Math.PI);
    const f = (x, y, z) => dog.localToWorld(V(x, y, z));
    dog.setFoot(0, f(-0.3, 0.7 + 0.2 * k, 0.9 + 0.2 * k)); dog.setFoot(1, f(0.3, 0.7 + 0.2 * k, 0.9 + 0.2 * k));
    dog.setFoot(2, f(-0.3, 0.2, -0.5)); dog.setFoot(3, f(0.3, 0.2, -0.5));
  } else if (u >= hopEnd) {
    lyingFeet(w, dog, -0.95, 1.0, 0.55, smooth(seg(u, 1.6, 2.6)));
  }
  dog.solve();
  w.dogShadow.visible = u < hopStart + 0.2; w.dogShadow.position.set(-1.0, 0.04, 2.2);
  // sofa squash when landing / settling
  const land = Math.max(0, u - hopEnd);
  w.living.seats[0].scale.y = 1 - (u >= hopEnd ? Math.exp(-land * 6) * Math.cos(land * 16) * 0.1 + 0.03 * smooth(seg(u, 1.6, 2.6)) : 0);
  const cp = V(2.8, 3.0, 8.6).add(shake(u, 0.02 * Math.exp(-land * 6) * (u > hopEnd ? 1 : 0), 25));
  view(w, cp, V(-0.5, 1.7, 0.6), 4.8);
  w.views[0].clear = 0x161b36;
}
function smoothHop(k) { return k * k * (3 - 2 * k); }

// =========================================================================================== CUT 13  weight presses the brake
function dogLying(w, u, closed = true, breath = 0.0) {
  const { dog } = w;
  dog.position.set(-0.95, 1.0, 0.55); dog.rotation.set(0, 0.0, 0);
  dog.bodyY = 0.58 + 0.012 * breathe(u, 0.3, 1) * 1.0 + breath;
  dog.pose.headPitch = 0.5; dog.pose.earLift = [0.0, 0.0]; dog.tailAngle = -1.2; dog.tailLift = 0.15;
  dog.setEyes({ open: 0.2, closed });
  dog.solve(); dog.updateMatrixWorld(true);
  lyingFeet(w, dog, -0.95, 1.0, 0.55, 1);
  dog.solve();
}
function cut13(w, t, u, D) {
  const { human, dog } = w;
  w.rig.set('night', 'warmA', smooth(seg(u, 0.8, 3.0)));
  w.rig.point('a', 0xffc46b, 0.6, V(-1.0, 3.0, 5.0), 3);
  sit(w, { lean: -0.26 - 0.03 * smooth(seg(u, 1.6, 3)), headPitch: lerp(0.3, 0.1, smooth(seg(u, 1.9, 3.2))), headRoll: 0.05 });
  breatheShirt(w, u, 0.025, 0.3);
  const calm = smooth(seg(u, 1.8, 2.8));
  human.setFace({ eyeOpen: lerp(0.4, 0.62, calm), bags: calm < 0.5, mouth: calm > 0.5 ? 'smile' : 'flat' });
  w.phone.group.visible = true; w.phone.group.position.set(0.55, 1.62, 0.95); w.phone.group.rotation.set(-0.7, -0.2, 0);
  w.phone.screen.redraw({ t: 0.2 }, 'idle');
  human.setHand(-1, V(-0.42, 1.52, 0.8)); human.setHand(1, V(0.56, 1.66, 0.92));
  dogLying(w, u, true);
  const xr = smooth(seg(u, 0.1, 0.55));
  human.xray(xr);
  human.brain.visible = xr > 0.02; w.toggle.visible = xr > 0.02; w.toggle.material.opacity = xr;
  const flip = smooth(seg(u, 1.65, 2.0));
  w.toggle.redraw({ v: flip, label: flip > 0.5 ? 'OFF' : 'ON' }, `${Math.round(flip * 20)}`);
  human.updateMatrixWorld(true);
  // golden line: from contact point up the body to the brain switch
  const path = [V(-0.45, 1.25, 0.45), human.torso.localToWorld(V(-0.1, 0.1, 0.15)), human.torso.localToWorld(V(0, 0.65, 0.2)), human.torso.localToWorld(V(0, 1.1, 0.1)), human.brain.getWorldPosition(new THREE.Vector3()).add(V(0, -0.1, 0.0))];
  const curve = new THREE.CatmullRomCurve3(path, false, 'catmullrom', 0.3);
  const travel = easeOut(seg(u, 0.55, 1.7));
  w.goldLine.visible = travel > 0.01;
  if (travel > 0.01) {
    const pts = []; const n = 24; const head = travel; const tail = Math.max(0, head - 0.55);
    for (let i = 0; i <= n; i++) pts.push(curve.getPoint(tail + (head - tail) * (i / n)));
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.05, 8, false);
    w.goldLine.geometry.dispose(); w.goldLine.geometry = g;
    w.goldLine.material.opacity = 1 - smooth(seg(u, 1.9, 2.5));
    w.goldPulse.visible = true; w.goldPulse.position.copy(curve.getPoint(head)); w.goldPulse.quaternion.copy(w.cam.quaternion);
    w.goldPulse.scale.setScalar(1.0 + 0.6 * Math.sin(u * 14)); w.goldPulse.material.opacity = 1 - smooth(seg(u, 1.9, 2.6));
  }
  // contact glow at the start
  view(w, V(2.4, 2.8, 7.0).add(shake(u, 0.004, 9)), V(-0.3, 2.0, 0.4), 4.6);
  w.views[0].clear = 0x1a1d3a;
}

// =========================================================================================== CUT 14  battery recharges
function cut14(w, t, u, D) {
  const { human } = w;
  w.rig.set('warmA'); w.rig.point('a', 0xffc46b, 0.5, V(-1.0, 3.0, 5.0), 3);
  const drop = smooth(seg(u, 0.35, 0.9));
  sit(w, { lean: -0.26, headPitch: 0.1, headRoll: 0.06 }); breatheShirt(w, u, 0.025, 0.3);
  human.setFace({ eyeOpen: 0.62, bags: false, mouth: 'smile' });
  // phone: in right hand then released onto the cushion
  w.phone.group.visible = true;
  const ph0 = V(0.56, 1.66, 0.92), ph1 = V(0.85, 1.07, 0.7);
  const fallK = seg(u, 0.45, 0.9);
  w.phone.group.position.copy(ph0).lerp(ph1, fallK * fallK);
  w.phone.group.rotation.set(-0.7 + fallK * 1.0, -0.2 + fallK * 0.4, fallK * 0.3);
  w.phone.screen.redraw({ t: 0.2 }, 'idle');
  human.setHand(1, fallK < 0.05 ? ph0.clone().add(V(0, 0, 0.0)) : V(lerp(0.56, 0.85, drop), lerp(1.66, 1.5, drop), 0.9));
  // left hand rests on dog's back
  const back = V(-0.95, 2.12, 0.55);
  const reach = easeOut(seg(u, 0.6, 1.4));
  human.setHand(-1, V(-0.42, 1.52, 0.8).lerp(back, reach));
  dogLying(w, u, true);
  // X-ray chest battery charging
  const xr = smooth(seg(u, 0.0, 0.4));
  human.xray(xr);
  human.chest.visible = xr > 0.02; w.battery.visible = xr > 0.02; w.battery.material.opacity = xr;
  const level = lerp(0.08, 0.95, smooth(seg(u, 0.5, 2.8)));
  w.battery.redraw({ level, color: level < 0.3 ? '#ffb02e' : '#2cf27a', bolt: true, label: '' }, `${Math.round(level * 60)}${level < 0.3}`);
  // floating hearts
  human.updateMatrixWorld(true);
  const ch = human.chest.getWorldPosition(new THREE.Vector3());
  w.hearts.forEach((h, i) => {
    const ph = ((u * 0.55 + i / 7 + 0.0) % 1);
    const start = 0.5 + i * 0.0;
    h.visible = u > 0.9;
    const fade = Math.sin(ph * Math.PI);
    placeBillboard(h, w.cam, V(ch.x + (rnd(i * 2.3) - 0.5) * 1.5, ch.y + 0.2 + ph * 1.6, ch.z + 0.55));
    h.scale.setScalar(0.4 + 0.7 * fade); h.material.opacity = fade;
  });
  view(w, V(2.2, 2.6, 6.2).add(shake(u, 0.003, 7)), V(-0.4, 1.9, 0.5), 3.5);
  w.views[0].clear = 0x1d1f3e;
}

// =========================================================================================== CUT 15  the world vs the sofa
function cut15(w, t, u, D) {
  const { human, dog } = w;
  w.rig.set('warmA'); w.rig.point('a', 0xffc46b, 0.6, V(-1.0, 3.0, 5.0), 3);
  sit(w, { lean: -0.28, headPitch: 0.1, headRoll: 0.06 }); breatheShirt(w, u, 0.02, 0.25);
  human.setFace({ eyeOpen: 0.6, bags: false, mouth: 'smile' });
  const back = V(-0.95, 2.12, 0.55);
  human.setHand(-1, back); human.setHand(1, V(0.8, 1.55, 0.7));
  w.phone.group.visible = true; w.phone.group.position.set(0.85, 1.07, 0.7); w.phone.group.rotation.set(0.3, 0.2, 0.3);
  w.phone.screen.redraw({ t: 0.2 }, 'idle');
  dogLying(w, u, true);
  // city: fast
  w.living.city.redraw({ t: u * 1.0 + 3, speed: 1.4, warm: 0 }, `${Math.round(u * 30)}`);
  const leftW = Math.round(w.W * 0.40), rightW = w.W - leftW;
  const L = { x: 0, y: 0, w: leftW, h: w.H, cam: w.cam, clear: 0x2b3350 };
  const R = { x: leftW, y: 0, w: rightW, h: w.H, cam: w.cam2, clear: 0x3a2a30 };
  w.views = [L, R];
  fit(w.cam, L.w / L.h, V(-8.0, 3.9, 5.0), V(-8.0, 3.9, -2.8), 1.9);
  fit(w.cam2, R.w / R.h, V(2.2, 2.8, 7.6), V(-0.4, 2.0, 0.5), 3.9);
  // golden bubble around the pair
  w.bubble.visible = true; w.bubble.position.set(-0.4, 2.05, 0.6); w.bubble.scale.set(2.4, 2.35, 1.9);
  w.bubble.material.opacity = 0.22 + 0.04 * Math.sin(u * 3);
  w.divider = true; w.dividerVertical = true;
}

// =========================================================================================== CUT 16  you are enough (wide, warm)
function cut16(w, t, u, D) {
  const { human, dog } = w;
  const warm = smooth(seg(u, 0, 1.0));
  w.rig.set('warmA', 'warmB', warm);
  w.rig.point('a', 0xffc46b, 0.5, V(-1.0, 3.0, 5.0), 3);
  const br = Math.sin(u * Math.PI * 2 * 0.28);
  sit(w, { lean: -0.3, headPitch: 0.06, headRoll: 0.08 });
  human.shirt.scale.set(0.43 * (1 + br * 0.012), 0.62 * (1 + br * 0.03), 0.3 * (1 + br * 0.03));
  human.setFace({ closed: true, mouth: 'smile', eyeOpen: 0.6 });
  human.setHand(-1, V(-0.95, 2.12 + br * 0.02, 0.55)); human.setHand(1, V(0.6, 1.5, 0.75));
  w.phone.group.visible = true; w.phone.group.position.set(0.85, 1.07, 0.7); w.phone.group.rotation.set(0.3, 0.2, 0.3);
  w.phone.screen.redraw({ t: 0.2 }, 'idle');
  dogLying(w, u, true, br * 0.014);
  w.living.sunGlow.material.opacity = 0.85 * warm; w.living.lampGlow.material.opacity = 0.8 * warm; w.living.shadeMat.emissive.set(0xffb552).multiplyScalar(warm * 0.9);
  w.living.city.redraw({ t: 1.2, speed: 0.05, warm: 1 }, 'warm');
  w.sunBeam.visible = true; w.sunBeam.position.set(-3.8, 3.8, 1.5); w.sunBeam.quaternion.copy(w.cam.quaternion); w.sunBeam.material.opacity = 0.35 * warm; w.sunBeam.scale.setScalar(1.0);
  w.living.leaves.forEach((l) => (l.inner.rotation.z = l.base + 0.03 * Math.sin(u * 1.2 + l.i)));
  const pull = easeOut(seg(u, 0, 3.0));
  view(w, V(2.0, lerp(2.9, 3.2, pull), 11.0), V(lerp(-0.2, 0.5, pull), lerp(1.95, 2.2, pull), 0.4), lerp(5.6, 9.2, pull));
  w.views[0].clear = 0x3a2a30;
}

// =========================================================================================== CUT 17  CTA
function cut17(w, t, u, D) {
  const { human, dog } = w;
  w.rig.set('warmB');
  w.rig.point('a', 0xffc46b, 0.5, V(-1.0, 3.0, 5.0), 3);
  const br = Math.sin((u + 3.0) * Math.PI * 2 * 0.28);
  sit(w, { lean: -0.3, headPitch: 0.06, headRoll: 0.08 });
  human.shirt.scale.set(0.43 * (1 + br * 0.012), 0.62 * (1 + br * 0.03), 0.3 * (1 + br * 0.03));
  human.setFace({ closed: true, mouth: 'smile', eyeOpen: 0.6 });
  human.setHand(-1, V(-0.95, 2.12 + br * 0.02, 0.55)); human.setHand(1, V(0.6, 1.5, 0.75));
  w.phone.group.visible = true; w.phone.group.position.set(0.85, 1.07, 0.7); w.phone.group.rotation.set(0.3, 0.2, 0.3);
  w.phone.screen.redraw({ t: 0.2 }, 'idle');
  // dog wakes: one eye opens, one ear perks, tail wags up and down
  const wake = smooth(seg(u, 0.25, 0.7));
  const { dog: d } = w;
  d.position.set(-0.95, 1.0, 0.55); d.rotation.set(0, 0, 0);
  d.bodyY = 0.58 + br * 0.01 + 0.03 * wake;
  d.pose.headPitch = lerp(0.5, 0.32, wake); d.pose.headRoll = -0.1 * wake;
  d.pose.earLift = [0.0, 0.45 * wake + 0.05 * Math.sin(u * 8) * wake];
  d.setEyes({ open: 1, closed: false });
  d.eyes[0].open.visible = false; d.eyes[0].hl.visible = false; d.eyes[0].arc.visible = true; // left eye stays closed
  d.eyes[1].open.visible = wake > 0.1; d.eyes[1].hl.visible = wake > 0.1; d.eyes[1].arc.visible = wake <= 0.1;
  d.eyes[1].open.scale.y = 0.1 * clamp(wake * 1.2, 0.1, 1);
  const wag = smooth(seg(u, 1.0, 1.35));
  const swing = Math.sin(u * 13) * wag;
  d.tailAngle = -1.15; d.tailLift = lerp(0.12, 0.5, wag) + 0.32 * swing;
  d.solve(); d.updateMatrixWorld(true);
  lyingFeet(w, d, -0.95, 1.0, 0.55, 1); d.solve(); d.updateMatrixWorld(true);
  w.living.sunGlow.material.opacity = 0.85; w.living.lampGlow.material.opacity = 0.8; w.living.shadeMat.emissive.set(0xffb552).multiplyScalar(0.9);
  w.living.city.redraw({ t: 1.2, speed: 0.05, warm: 1 }, 'warm');
  w.sunBeam.visible = true; w.sunBeam.position.set(-3.8, 3.8, 1.5); w.sunBeam.quaternion.copy(w.cam.quaternion); w.sunBeam.material.opacity = 0.35;
  w.living.leaves.forEach((l) => (l.inner.rotation.z = l.base + 0.03 * Math.sin(u * 1.2 + l.i)));
  // sign: pops in, gets hit by the tail tip and wobbles
  const tailTip = w.dog.tail[2].b.getWorldPosition(new THREE.Vector3());
  const hit = Math.max(0, Math.sin(u * 13)) * wag;
  const pop = easeOutBack(seg(u, 1.15, 1.6));
  w.sign.visible = pop > 0.01;
  const bob = Math.sin(u * 2.2) * 0.05;
  w.sign.position.set(-1.9, 3.15 + bob + hit * 0.16, 1.9); w.sign.material.depthTest = false; w.sign.quaternion.copy(w.cam.quaternion);
  w.sign.rotateZ(0.08 * Math.sin(u * 13) * wag - 0.05);
  w.sign.scale.setScalar(Math.max(0.001, pop) * 0.78 * (1 + hit * 0.06));
  view(w, V(2.0, 3.2, 11.0), V(0.5, 2.2, 0.4), 9.2);
  w.views[0].clear = 0x3a2a30;
}

const FNS = [cut01, cut02, cut03, cut04, cut05, cut06, cut07, cut08, cut09, cut10, cut11, cut12, cut13, cut14, cut15, cut16, cut17];

export function cutIndex(t) {
  for (let i = CUTS.length - 1; i >= 0; i--) if (t >= CUTS[i][0]) return i;
  return 0;
}

export function updateScene(w, t) {
  t = clamp(t, 0, DURATION - 1e-4);
  const i = cutIndex(t);
  const [a, b] = CUTS[i];
  reset(w);
  w.divider = false; w.dividerVertical = false;
  w.cutIndex = i;
  const dogCuts = [3, 4, 5, 8, 9, 10, 11, 12, 13, 14, 15, 16];
  w.dog.visible = dogCuts.includes(i);
  w.human.visible = ![3, 5, 8, 9].includes(i) || i === 4;
  FNS[i](w, t, t - a, b - a);
  w.human.solve();
  w.human.updateMatrixWorld(true);
  [w.battery, w.toggle, w.brainH].forEach((o) => { if (o.visible) faceCam(o, w.views[0].cam); });
  // contact shadows follow characters
  w.living.group.visible = true;
}
