// World assembly: renderer, lights (mood rig), characters, sets, shared effect pools and view management.
import * as THREE from 'three';
import { OUTLINE, V, clamp, lerp, rnd, ellipsoid } from './toon.js';
import { Human } from './human.js';
import { Dog } from './dog.js';
import { buildLiving, buildHallway, buildKitchen, buildPhone, buildBall, shadowBlob, HALL, KITCHEN } from './sets.js';
import { CanvasPlane, batteryIcon, brainGauge, toggleSwitch, questionMark, heartIcon, subscribeSign, glowSprite } from './icons.js';

// ---------------------------------------------------------------------------------- light moods
const c = (hex) => new THREE.Color(hex);
function mixColor(a, b, k) { return c(a).lerp(c(b), k); }
export const MOODS = {
  fridge: { amb: [0x5d78ad, 0.5], key: [0xe6f4ff, 0.95, KITCHEN.x + 0.4, 4.6, 1.5, KITCHEN.x, 2.6, 6.5], fill: [0x2a3a6e, 0.3, KITCHEN.x - 3, 3, 9] },
  night:  { amb: [0x34488a, 0.72], key: [0x9fb4ff, 0.85, 3, 7, 9, 0, 1.5, 0], fill: [0x5a4a8a, 0.35, -6, 3, 6] },
  phone:  { amb: [0x2c3668, 0.5], key: [0x86a8ff, 0.5, 2, 6, 9, 0, 1.5, 0], fill: [0x303a70, 0.25, -6, 3, 6] },
  hall:   { amb: [0x4a3a55, 0.62], key: [0xffc58a, 0.9, HALL.x - 1, 5.5, 5, HALL.x, 1.5, 0], fill: [0x4f6cc8, 0.55, HALL.x + 9, 3, 3] },
  warmA:  { amb: [0x9a96b0, 0.78], key: [0xffe0b4, 1.0, 3, 7, 9, 0, 1.5, 0], fill: [0xd09080, 0.35, -6, 3, 6] },
  warmB:  { amb: [0xe8e0e8, 0.9], key: [0xffdca8, 1.25, -6, 6, 6, 0, 1.5, 0], fill: [0xffb08a, 0.45, 6, 3, 6] },
};

export class Rig {
  constructor(scene) {
    this.amb = new THREE.AmbientLight(0xffffff, 1);
    this.key = new THREE.DirectionalLight(0xffffff, 1);
    this.fill = new THREE.DirectionalLight(0xffffff, 0.3);
    this.pa = new THREE.PointLight(0xffffff, 0, 0, 2);
    this.pb = new THREE.PointLight(0xffffff, 0, 0, 2);
    scene.add(this.amb, this.key, this.key.target, this.fill, this.fill.target, this.pa, this.pb);
  }
  /** mood: either a key of MOODS or an object; blend with `to` by k. */
  set(a, to = null, k = 0) {
    const A = typeof a === 'string' ? MOODS[a] : a, B = to ? (typeof to === 'string' ? MOODS[to] : to) : A;
    const m = (x, y) => lerp(x, y, k);
    this.amb.color.copy(mixColor(A.amb[0], B.amb[0], k)); this.amb.intensity = m(A.amb[1], B.amb[1]) * Math.PI;
    this.key.color.copy(mixColor(A.key[0], B.key[0], k)); this.key.intensity = m(A.key[1], B.key[1]) * Math.PI;
    this.key.position.set(m(A.key[2], B.key[2]), m(A.key[3], B.key[3]), m(A.key[4], B.key[4]));
    this.key.target.position.set(m(A.key[5], B.key[5]), m(A.key[6], B.key[6]), m(A.key[7], B.key[7]));
    this.fill.color.copy(mixColor(A.fill[0], B.fill[0], k)); this.fill.intensity = m(A.fill[1], B.fill[1]) * Math.PI;
    this.fill.position.set(m(A.fill[2], B.fill[2]), m(A.fill[3], B.fill[3]), m(A.fill[4], B.fill[4]));
    this.fill.target.position.copy(this.key.target.position);
    this.pa.intensity = 0; this.pb.intensity = 0;
  }
  /** point light helper: value ~ illuminance at `ref` distance */
  point(which, color, value, pos, ref = 3) {
    const p = which === 'a' ? this.pa : this.pb;
    p.color.set(color); p.intensity = value * Math.PI * ref * ref; p.position.copy(pos); p.distance = 0; p.decay = 2;
  }
}

// ---------------------------------------------------------------------------------- flat disc particle pool
export class Discs {
  constructor(max, { additive = false } = {}) {
    const geo = new THREE.CircleGeometry(1, 28);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, toneMapped: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 12; this.max = max; this.n = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._c = new THREE.Color();
    this.mesh.count = 0;
  }
  begin(camQuat) { this.n = 0; this.q = camQuat; }
  push(pos, size, color, k = 1) {
    if (this.n >= this.max) return;
    this._s.set(size, size, size);
    this._m.compose(pos, this.q, this._s);
    this.mesh.setMatrixAt(this.n, this._m);
    this._c.set(color).multiplyScalar(k);
    this.mesh.setColorAt(this.n, this._c);
    this.n++;
  }
  end() { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true; this.mesh.visible = this.n > 0; }
}

// ---------------------------------------------------------------------------------- the world
export function createWorld(W, H) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.autoClear = false;
  const scene = new THREE.Scene();
  const rig = new Rig(scene);

  const living = buildLiving(); scene.add(living.group);
  const hall = buildHallway(); scene.add(hall.group);
  const kitchen = buildKitchen(); scene.add(kitchen.group);

  const human = new Human(); scene.add(human);
  const dog = new Dog(); scene.add(dog);
  const dogShadow = shadowBlob(1.5, 1.0); scene.add(dogShadow);
  const humanShadow = shadowBlob(1.0, 0.6); scene.add(humanShadow);
  const aura = glowSprite(0xffd23a, 5.5); aura.material.opacity = 0; aura.renderOrder = 4; scene.add(aura);

  const phone = buildPhone(); scene.add(phone.group);
  const ball = buildBall(); scene.add(ball.group);

  // -------- icons / X-ray internals
  const battery = batteryIcon(1.55); human.chest.add(battery); battery.position.z = 0.1; battery.renderOrder = 10;
  const toggle = toggleSwitch(1.1); human.brain.add(toggle); toggle.position.set(0, -0.05, 0.1); toggle.renderOrder = 10;
  const brainH = brainGauge(1.15); human.brain.add(brainH); brainH.position.set(0, 0.0, 0.0); brainH.renderOrder = 9;
  const scribble = new THREE.Group(); human.brain.add(scribble);
  {
    const pts = []; let s = 11;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647 - 0.5; };
    for (let i = 0; i < 46; i++) pts.push(new THREE.Vector3(r() * 0.7, r() * 0.7, r() * 0.5));
    const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.2);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 260, 0.018, 6, true), new THREE.MeshBasicMaterial({ color: 0x9aa0ad, transparent: true, depthWrite: false }));
    tube.renderOrder = 10; scribble.add(tube);
    scribble.userData.tube = tube;
  }
  const gaugeD = brainGauge(1.7); gaugeD.renderOrder = 30; gaugeD.material.depthTest = false; scene.add(gaugeD); // dog brain gauge (billboard)
  gaugeD.visible = false;
  const qmark = questionMark(0.9); scene.add(qmark); qmark.visible = false;
  const sign = subscribeSign(3.4); scene.add(sign); sign.visible = false;
  const hearts = Array.from({ length: 7 }, (_, i) => { const h = heartIcon(0.42, i % 2 ? '#ff6fae' : '#ff9ac6'); h.redraw({}, 'static'); scene.add(h); h.visible = false; return h; });
  qmark.redraw({}, 'static'); sign.redraw({}, 'static');

  // ear soundwave meter (child of the ear pivot)
  const meter = new THREE.Group(); dog.ears[0].pivot.add(meter);
  const meterBars = [];
  for (let i = 0; i < 7; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1, 0.03), new THREE.MeshBasicMaterial({ color: 0x33ff88, transparent: true, depthWrite: false }));
    bar.renderOrder = 30; bar.position.set(-0.04 + 0 * i, -0.3, 0.0); meter.add(bar); meterBars.push(bar);
  }
  const meterFrame = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.8), new THREE.MeshBasicMaterial({ color: 0x0a1020, transparent: true, opacity: 0.55, depthWrite: false })); meterFrame.renderOrder = 29; meter.add(meterFrame);
  meter.visible = false;

  // radar rings pool
  const rings = Array.from({ length: 12 }, () => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.955, 1.0, 72), new THREE.MeshBasicMaterial({ color: 0x19d8ff, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    m.renderOrder = 14; m.visible = false; scene.add(m); return m;
  });

  const stress = new Discs(60, { additive: false }); scene.add(stress.mesh);
  const stressGlow = new Discs(60, { additive: true }); scene.add(stressGlow.mesh);
  const dust = new Discs(24, { additive: true }); scene.add(dust.mesh);

  // grey exhale puff (flat cartoon cloud with outline)
  const puff = new THREE.Group(); scene.add(puff);
  {
    const defs = [[0, 0, 0.5], [0.45, 0.12, 0.42], [0.85, -0.02, 0.36], [0.4, -0.22, 0.34], [-0.2, 0.16, 0.3]];
    defs.forEach(([x, y, r]) => { const b = ellipsoid(r, r, 0.07, 0xd2d6df, { outline: 5 }); b.setEmissive(0x5a5f6c, 1); b.position.set(x, y, 0); puff.add(b); });
    puff.visible = false;
  }

  // golden light line (cut 13) + golden bubble (cut 15)
  const goldLine = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(V(0, 0, 0), V(0, 1, 0)), 1, 0.05, 8, false), new THREE.MeshBasicMaterial({ color: 0xffd34a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  goldLine.visible = false; goldLine.renderOrder = 15; scene.add(goldLine);
  const goldPulse = glowSprite(0xffc740, 1.2); goldPulse.visible = false; scene.add(goldPulse);
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshBasicMaterial({ color: 0xffc766, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  bubble.visible = false; bubble.renderOrder = 6; scene.add(bubble);
  const bubbleRim = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshBasicMaterial({ color: 0xffe3a0, transparent: true, opacity: 0.0, wireframe: false, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending }));
  bubbleRim.visible = false; scene.add(bubbleRim);
  const sunBeam = glowSprite(0xffc46b, 14); sunBeam.visible = false; scene.add(sunBeam);

  const cam = new THREE.PerspectiveCamera(40, W / H, 0.05, 300);
  const cam2 = new THREE.PerspectiveCamera(40, W / H, 0.05, 300);

  return {
    W, H, renderer, scene, rig, cam, cam2, living, hall, kitchen, human, dog, dogShadow, humanShadow, aura, phone, ball,
    battery, toggle, brainH, scribble, gaugeD, qmark, sign, hearts, meter, meterBars, meterFrame, rings, stress, stressGlow, dust, puff,
    goldLine, goldPulse, bubble, bubbleRim, sunBeam,
    views: [],
  };
}

// camera helpers ------------------------------------------------------------------------
export function setCam(cam, pos, target, fov, roll = 0, aspect = null) {
  cam.position.copy(pos);
  cam.up.set(Math.sin(roll), Math.cos(roll), 0);
  cam.lookAt(target);
  cam.fov = fov;
  if (aspect) cam.aspect = aspect;
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
}
export function shake(t, amp, f = 17) {
  return V(Math.sin(t * f * 1.3) * amp, Math.sin(t * f * 0.9 + 1.7) * amp, Math.sin(t * f * 1.1 + 3.1) * amp * 0.5);
}
