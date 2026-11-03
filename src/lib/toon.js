// Toon / cel-shading helpers: toon materials + constant-pixel-width outlines (inverted hull).
import * as THREE from 'three';

// ---------------------------------------------------------------- gradient map (soft 3-step cel shading)
function makeGradient(steps) {
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => {
    const c = Math.round(v * 255);
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = c;
    data[i * 4 + 3] = 255;
  });
  const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
export const GRADIENT = makeGradient([0.62, 0.86, 1.0]);

// ---------------------------------------------------------------- shared outline uniforms
export const OUTLINE = {
  uRes: { value: new THREE.Vector2(1080, 1920) }, // current viewport in pixels
  uScale: { value: 1 }, // global thickness multiplier
};

const hullVert = /* glsl */ `
  uniform vec2 uRes;
  uniform float uScale;
  uniform float uThick;
  void main() {
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vec2 p = (projectionMatrix * vec4(n, 0.0)).xy;
    vec2 pix = p * uRes;
    float l = length(pix);
    vec2 dir = l > 1e-5 ? pix / l : vec2(0.0);
    vec2 off = dir * (uThick * uScale) * 2.0 / uRes;
    clip.xy += off * clip.w;
    gl_Position = clip;
  }
`;
const hullFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() { gl_FragColor = vec4(uColor, uOpacity); }
`;

export function makeHullMaterial(thick = 6, color = 0x0b0b10) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uRes: OUTLINE.uRes,
      uScale: OUTLINE.uScale,
      uThick: { value: thick },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 1 },
    },
    vertexShader: hullVert,
    fragmentShader: hullFrag,
    side: THREE.BackSide,
  });
  return m;
}

// ---------------------------------------------------------------- Toon part (fill + hull in a group)
const XRAY_TINT = new THREE.Color(0x7cc4ff);
const XRAY_BASE = new THREE.Color(0xcdeaff);
export class Toon extends THREE.Group {
  /**
   * @param {THREE.BufferGeometry} geo
   * @param {number|string} color
   * @param {object} o {outline: px (0 disables), emissive}
   */
  constructor(geo, color, o = {}) {
    super();
    const outline = o.outline ?? 6;
    this.fillMat = new THREE.MeshToonMaterial({ color, gradientMap: GRADIENT });
    if (o.emissive !== undefined) this.fillMat.emissive = new THREE.Color(o.emissive);
    this.fill = new THREE.Mesh(geo, this.fillMat);
    this.add(this.fill);
    this.hull = null;
    if (outline > 0) {
      this.hullMat = makeHullMaterial(outline, o.outlineColor ?? 0x0b0b10);
      this.hull = new THREE.Mesh(geo, this.hullMat);
      this.add(this.hull);
    }
    this.xrayShell = false;
  }
  setColor(c) { this.fillMat.color.set(c); return this; }
  setEmissive(c, k = 1) { this.fillMat.emissive.set(c).multiplyScalar(k); return this; }

  /** Make this part a see-through "X-ray" shell: a = 0 opaque, 1 = 30% opacity. Outline stays solid. */
  setXray(a, minOpacity = 0.3, baseMix = 0.72) {
    const op = 1 - (1 - minOpacity) * a;
    const m = this.fillMat;
    // glassy cyan lift so the 30% shell stays luminous over dark backgrounds
    if (this._baseEmissive === undefined) { this._baseEmissive = m.emissive.clone(); this._baseColor = m.color.clone(); }
    m.color.copy(this._baseColor).lerp(XRAY_BASE, a * baseMix);
    m.emissive.copy(this._baseEmissive).lerp(XRAY_TINT, a * 0.42);
    if (a <= 0.001) {
      m.transparent = false; m.opacity = 1; m.depthWrite = true;
      m.stencilWrite = false;
      this.fill.renderOrder = 0;
      if (this.hull) { this.hullMat.stencilWrite = false; this.hullMat.transparent = false; this.hull.renderOrder = 0; }
    } else {
      m.transparent = true; m.opacity = op; m.depthWrite = false;
      m.stencilWrite = true; m.stencilRef = 1;
      m.stencilFunc = THREE.AlwaysStencilFunc; m.stencilZPass = THREE.ReplaceStencilOp;
      this.fill.renderOrder = 20;
      if (this.hull) {
        // outline only outside the shell silhouette so it stays crisp over the translucent body
        const h = this.hullMat;
        h.transparent = true; // draw after the shell fill (transparent pass, higher renderOrder)
        h.stencilWrite = true; h.stencilRef = 1;
        h.stencilFunc = THREE.NotEqualStencilFunc;
        h.stencilFail = h.stencilZFail = h.stencilZPass = THREE.KeepStencilOp;
        this.hull.renderOrder = 21;
      }
    }
    return op;
  }
}

// ---------------------------------------------------------------- geometries
const _unitSphere = new THREE.SphereGeometry(1, 40, 28);
const _unitCyl = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true); // open ended; capped by joint spheres
const _unitCylClosed = new THREE.CylinderGeometry(1, 1, 1, 28, 1, false);

export function sphere(r, color, o) { const t = new Toon(_unitSphere, color, o); t.scale.setScalar(r); return t; }
export function ellipsoid(rx, ry, rz, color, o) { const t = new Toon(_unitSphere, color, o); t.scale.set(rx, ry, rz); return t; }
export function plainSphere(r, color) { // unlit sphere, no outline
  const m = new THREE.Mesh(_unitSphere, new THREE.MeshBasicMaterial({ color }));
  m.scale.setScalar(r); return m;
}

/** Tube between two points built from an open cylinder (call place()) with spherical end caps. */
export class Limb extends THREE.Group {
  constructor(radius, color, o = {}) {
    super();
    this.r = radius;
    this.cyl = new Toon(_unitCyl, color, o);
    this.a = new Toon(_unitSphere, color, o);
    this.b = new Toon(_unitSphere, color, o);
    this.a.scale.setScalar(radius); this.b.scale.setScalar(radius);
    this.add(this.cyl, this.a, this.b);
    this._up = new THREE.Vector3(0, 1, 0);
  }
  place(pa, pb) {
    const d = new THREE.Vector3().subVectors(pb, pa);
    const L = Math.max(d.length(), 1e-4);
    this.a.position.copy(pa); this.b.position.copy(pb);
    this.cyl.position.copy(pa).add(pb).multiplyScalar(0.5);
    this.cyl.scale.set(this.r, L, this.r);
    this.cyl.quaternion.setFromUnitVectors(this._up, d.divideScalar(L));
    return this;
  }
  setColor(c) { this.cyl.setColor(c); this.a.setColor(c); this.b.setColor(c); return this; }
  setEndColors(ca, cb) { this.a.setColor(ca); this.b.setColor(cb); return this; }
  parts() { return [this.cyl, this.a, this.b]; }
}

/** Two-bone IK in a local frame. Returns the middle joint (elbow/knee). */
export function ik2(origin, target, l1, l2, pole) {
  const d0 = new THREE.Vector3().subVectors(target, origin);
  let d = d0.length();
  const maxD = (l1 + l2) * 0.998;
  const minD = Math.abs(l1 - l2) + 0.02;
  d = Math.min(Math.max(d, minD), maxD);
  const dir = d0.lengthSq() > 1e-9 ? d0.clone().normalize() : new THREE.Vector3(0, -1, 0);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
  const p = pole.clone().addScaledVector(dir, -pole.dot(dir));
  if (p.lengthSq() < 1e-8) p.set(0, 0, 1);
  p.normalize();
  const mid = origin.clone().addScaledVector(dir, a).addScaledVector(p, h);
  const end = origin.clone().addScaledVector(dir, d); // reachable end
  return { mid, end };
}

// ---------------------------------------------------------------- math helpers
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const smoother = (x) => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };
export const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
export const easeOutExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(x)));
export const easeInOut = smooth;
export const easeOutBack = (x) => { x = clamp(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
/** progress of t within [a,b] */
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** deterministic pseudo random in [0,1) from an integer seed */
export function rnd(i) { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

/** orient obj so its +Z points along dir, keeping +Y as close to `up` as possible (no twist) */
export function orientTo(obj, dir, up = new THREE.Vector3(0, 1, 0)) {
  const z = dir.clone().normalize();
  const x = new THREE.Vector3().crossVectors(up, z);
  if (x.lengthSq() < 1e-6) x.set(1, 0, 0);
  x.normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
