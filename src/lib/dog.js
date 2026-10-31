// Cute medium-sized warm-brown cartoon dog with floppy ears. Local space: origin on the floor under the body,
// +Y up, +Z = forward (snout direction).
import * as THREE from 'three';
import { Toon, Limb, ik2, ellipsoid, sphere, V, lerp, orientTo } from './toon.js';

const BROWN = 0xb8743c;
const DARK = 0x7d4522; // ears
const TAN = 0xe6bd8a; // muzzle, chest, paws
const BLACK = 0x0b0b10;
const PINK = 0xf08aa0;
const MOUTH = 0x6a1f2a;

const _black = new THREE.MeshBasicMaterial({ color: BLACK });
const _white = new THREE.MeshBasicMaterial({ color: 0xffffff });
const _sph = new THREE.SphereGeometry(1, 20, 14);
function orient(obj, dir) { orientTo(obj, dir); }

export const DOG = { footSize: 0.13, upper: 0.5, lower: 0.5, bodyY: 1.15 };

export class Dog extends THREE.Group {
  constructor() {
    super();
    this.bodyY = DOG.bodyY;
    this.aura = 0; // 0..1 glow amount used for emissive tint

    // ------------------------------------------------------------ torso
    this.body = new THREE.Group(); this.add(this.body);
    this.torso = ellipsoid(0.54, 0.52, 0.84, BROWN, { outline: 7 });
    this.chest = ellipsoid(0.36, 0.4, 0.34, TAN, { outline: 0 });
    this.chest.position.set(0, -0.12, 0.6);
    this.torso.add(this.chest); // child scaled by torso scale; compensate below
    this.chest.scale.set(0.36 / 0.54, 0.4 / 0.52, 0.34 / 0.84);
    this.chest.position.set(0, -0.12 / 0.52, 0.56 / 0.84);
    this.body.add(this.torso);

    // ------------------------------------------------------------ neck + head
    this.neck = ellipsoid(0.36, 0.5, 0.4, BROWN, { outline: 7 });
    this.neck.rotation.x = 0.55;
    this.body.add(this.neck);

    this.head = new THREE.Group(); this.body.add(this.head);
    this.skull = sphere(0.56, BROWN, { outline: 7 });
    this.skull.position.set(0, 0.32, 0.3);
    this.head.add(this.skull);
    this.snout = ellipsoid(0.27, 0.16, 0.34, TAN, { outline: 7 });
    this.snout.position.set(0, 0.2, 0.72);
    this.head.add(this.snout);
    this.nose = ellipsoid(0.125, 0.085, 0.09, BLACK, { outline: 0 });
    this.nose.position.set(0, 0.275, 1.04);
    this.head.add(this.nose);
    // nose shine
    const shine = new THREE.Mesh(_sph, _white); shine.scale.set(0.03, 0.018, 0.018); shine.position.set(-0.035, 0.31, 1.085);
    this.head.add(shine);

    // mouth cavity + jaw
    this.cavity = ellipsoid(0.19, 0.13, 0.27, MOUTH, { outline: 0 });
    this.cavity.position.set(0, 0.03, 0.74);
    this.head.add(this.cavity);
    this.jaw = new THREE.Group(); this.jaw.position.set(0, 0.06, 0.45); this.head.add(this.jaw);
    this.jawMesh = ellipsoid(0.2, 0.085, 0.31, TAN, { outline: 7 });
    this.jawMesh.position.set(0, -0.05, 0.28);
    this.jaw.add(this.jawMesh);
    this.tongue = ellipsoid(0.11, 0.045, 0.2, PINK, { outline: 0 });
    this.tongue.position.set(0, 0.02, 0.3);
    this.jaw.add(this.tongue);
    // mouth line (smile) on the muzzle: little "w" under the nose
    this.mouthLine = new THREE.Group(); this.mouthLine.position.set(0, 0.2, 1.0); this.head.add(this.mouthLine);
    const lineMat = _black;
    const v = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.09, 3, 6), lineMat); v.position.set(0, 0.0, 0.0); v.rotation.x = 0.4;
    this.mouthLine.add(v);

    // eyes
    const sk = this.skull.position;
    this.eyes = [-1, 1].map((s) => {
      const dir = V(s * 0.4, 0.3, 0.86).normalize();
      const g = new THREE.Group();
      g.position.copy(sk).addScaledVector(dir, 0.545);
      orient(g, dir);
      const open = new THREE.Mesh(_sph, _black); open.scale.set(0.075, 0.1, 0.04);
      const hl = new THREE.Mesh(_sph, _white); hl.scale.set(0.026, 0.03, 0.02); hl.position.set(-0.02 * s, 0.035, 0.035);
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.017, 6, 20, Math.PI), _black);
      arc.rotation.z = Math.PI; arc.position.y = 0.04; arc.visible = false;
      g.add(open, hl, arc);
      this.head.add(g);
      // eyebrow spot
      const bdir = V(s * 0.42, 0.62, 0.66).normalize();
      const brow = ellipsoid(0.07, 0.045, 0.03, TAN, { outline: 0 });
      brow.position.copy(sk).addScaledVector(bdir, 0.55);
      orient(brow, bdir);
      this.head.add(brow);
      return { s, g, open, hl, arc };
    });

    // floppy ears (pivot at top of the skull sides)
    this.ears = [-1, 1].map((s) => {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.4, 0.66, 0.25);
      const ear = ellipsoid(0.085, 0.4, 0.24, DARK, { outline: 7 });
      ear.position.set(s * 0.1, -0.32, -0.02);
      ear.rotation.z = s * 0.2;
      pivot.add(ear);
      this.head.add(pivot);
      return { s, pivot, ear };
    });

    // ------------------------------------------------------------ legs
    this.legs = [];
    const mk = (sx, front) => {
      const upper = new Limb(front ? 0.15 : 0.17, BROWN);
      const lower = new Limb(0.125, BROWN);
      const paw = ellipsoid(0.15, 0.1, 0.21, TAN, { outline: 6 });
      this.add(upper, lower, paw);
      return { sx, front, upper, lower, paw, target: null, off: V(0, 0, 0) };
    };
    this.legs.push(mk(-1, true), mk(1, true), mk(-1, false), mk(1, false));

    // ------------------------------------------------------------ tail (3 segments)
    this.tail = [0, 1, 2].map((i) => new Limb(0.1 - i * 0.012, i === 2 ? TAN : BROWN));
    this.tail.forEach((t) => this.add(t));
    this.tailAngle = 0.0; // sideways wag angle (rad)
    this.tailLift = 0.75; // elevation of tail base direction (rad)

    this.shells = [this.skull, this.snout, this.neck, this.jawMesh, ...this.ears.map((e) => e.ear)];
    this.headShells = [this.skull, this.snout, this.jawMesh];
    this.earShells = this.ears.map((e) => e.ear);
    this.pose = { headPitch: 0, headYaw: 0, headRoll: 0, jaw: 0, earLift: [0, 0], eyeOpen: 1, closed: false, tongue: 0 };
    this.sleeping = false;
  }

  // -------------------------------------------------------------- targets
  setFoot(i, world) { this.legs[i].target = world ? world.clone() : null; } // 0=FL(-x) 1=FR 2=BL 3=BR
  setEyes({ open = 1, closed = false } = {}) {
    this.pose.eyeOpen = open; this.pose.closed = closed;
    for (const e of this.eyes) {
      e.open.visible = !closed; e.hl.visible = !closed && open > 0.5; e.arc.visible = closed;
      e.open.scale.y = 0.1 * Math.max(0.1, open);
    }
  }
  xrayHead(a) { for (const s of this.headShells) s.setXray(a); this.neck.setXray(a); }
  xrayEars(a) { for (const s of this.earShells) s.setXray(a); }

  /** tint the whole dog with an emissive aura colour */
  setAura(color, k) {
    const c = new THREE.Color(color);
    this.traverse((o) => {
      if (o.isMesh && o.material && o.material.isMeshToonMaterial) { o.material.emissive.copy(c).multiplyScalar(k); }
    });
  }

  // -------------------------------------------------------------- solve
  solve() {
    const P = this.pose;
    this.body.position.set(0, this.bodyY, 0);
    this.torso.position.set(0, 0, 0);
    this.neck.position.set(0, 0.34, 0.62);
    this.head.position.set(0, 0.58, 0.76);
    this.head.rotation.set(P.headPitch, P.headYaw, P.headRoll, 'YXZ');
    this.jaw.rotation.x = P.jaw;
    this.tongue.visible = P.jaw > 0.15 || P.tongue > 0.5;
    this.cavity.visible = true;
    this.ears.forEach((e, i) => {
      e.pivot.rotation.z = e.s * P.earLift[i];
      e.pivot.rotation.x = -P.earLift[i] * 0.4;
    });
    this.updateMatrixWorld(true);

    // legs: hips/shoulders relative to the body
    const by = this.bodyY;
    const hips = [
      V(-0.3, by - 0.2, 0.5), V(0.3, by - 0.2, 0.5),
      V(-0.3, by - 0.15, -0.5), V(0.3, by - 0.15, -0.5),
    ];
    this.legs.forEach((L, i) => {
      const o = hips[i];
      let t;
      if (L.target) t = this.worldToLocal(L.target.clone());
      else t = V(o.x, DOG.footSize * 0.7, o.z);
      const pole = L.front ? V(0, 0.2, -1) : V(0, 0.3, 1);
      const { mid, end } = ik2(o, t, DOG.upper, DOG.lower, pole);
      L.upper.place(o, mid); L.lower.place(mid, end);
      L.paw.position.set(end.x, end.y - 0.02, end.z + 0.06);
    });

    // tail
    const base = V(0, by + 0.1, -0.78);
    let dir = V(Math.sin(this.tailAngle) * Math.cos(this.tailLift), Math.sin(this.tailLift), -Math.cos(this.tailAngle) * Math.cos(this.tailLift) * 0.8).normalize();
    let p = base.clone();
    const seglen = 0.3;
    this.tail.forEach((t, i) => {
      const q = p.clone().addScaledVector(dir, seglen);
      t.place(p, q);
      p = q;
      dir = dir.clone().add(V(Math.sin(this.tailAngle) * 0.5, -0.45, 0.0)).normalize();
    });
  }
}
