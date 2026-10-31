// "Stickman hybrid" character: smooth white sphere head, thin white tube limbs, muted-blue tee, grey pants.
// Local space: origin = pelvis, +Y up, +Z = front (faces the camera by default).
import * as THREE from 'three';
import { Toon, Limb, ik2, ellipsoid, sphere, V, orientTo } from './toon.js';

const WHITE = 0xf1f1ed;
const SHIRT = 0x4b6ea8;
const PANTS = 0x8d929c;
const SHOE = 0xe9e9e4;
const BLACK = 0x0b0b10;

export const HUMAN = {
  headR: 0.58,
  upperArm: 0.72, foreArm: 0.72,
  thigh: 0.95, shin: 0.95,
  shoulderY: 0.98, shoulderX: 0.5,
  hipX: 0.2,
  footDrop: 0.17, // ankle -> floor
  standPelvisY: 1.97,
};

const _blackMat = new THREE.MeshBasicMaterial({ color: BLACK });
function blackMesh(geo) { return new THREE.Mesh(geo, _blackMat); }
function orient(obj, dir) { orientTo(obj, dir); }

export class Human extends THREE.Group {
  constructor() {
    super();
    const H = HUMAN;
    // ------------------------------------------------------------ pelvis + legs (root space)
    this.hips = ellipsoid(0.34, 0.22, 0.25, PANTS);
    this.hips.position.set(0, -0.02, 0);
    this.add(this.hips);

    this.legs = [-1, 1].map((s) => {
      const thigh = new Limb(0.165, PANTS);
      const shin = new Limb(0.14, PANTS);
      const foot = ellipsoid(0.16, 0.095, 0.29, SHOE);
      this.add(thigh, shin, foot);
      return { s, thigh, shin, foot, target: null };
    });

    // ------------------------------------------------------------ torso pivot
    this.torso = new THREE.Group();
    this.torso.position.set(0, 0.08, 0);
    this.add(this.torso);
    this.shirt = ellipsoid(0.43, 0.62, 0.3, SHIRT);
    this.shirt.position.set(0, 0.52, 0);
    this.torso.add(this.shirt);
    this.neck = new Limb(0.085, WHITE);
    this.neck.place(V(0, 1.02, 0), V(0, 1.22, 0.01));
    this.torso.add(this.neck);

    // head pivot at the neck base
    this.head = new THREE.Group();
    this.head.position.set(0, 1.12, 0.01);
    this.torso.add(this.head);
    this.skull = sphere(H.headR, WHITE, { outline: 6.5 });
    this.skull.position.set(0, 0.55, 0.03);
    this.head.add(this.skull);
    this._buildFace();

    // ------------------------------------------------------------ arms (torso space)
    this.arms = [-1, 1].map((s) => {
      const shoulder = V(s * H.shoulderX, H.shoulderY, 0);
      const upper = new Limb(0.075, WHITE);
      const fore = new Limb(0.07, WHITE);
      const sleeve = new Limb(0.14, SHIRT);
      const hand = sphere(0.125, WHITE);
      this.torso.add(upper, fore, sleeve, hand);
      return { s, shoulder, upper, fore, sleeve, hand, target: null };
    });

    // anchors for X-ray internals
    this.chest = new THREE.Group(); this.chest.position.set(0, 0.62, 0.27); this.torso.add(this.chest);
    this.brain = new THREE.Group(); this.brain.position.set(0, 0.5, 0.03); this.head.add(this.brain);

    this.shells = [this.shirt, this.skull, this.neck.cyl, this.neck.a, this.neck.b, ...this.arms.map((a) => a.sleeve.cyl), ...this.arms.map((a) => a.sleeve.a), ...this.arms.map((a) => a.sleeve.b)];
    this.xrayAmount = 0;
  }

  // -------------------------------------------------------------- face
  _buildFace() {
    const R = HUMAN.headR;
    const C = V(0, 0, 0.0); // skull centre in skull-local coordinates (skull is scaled by R)
    this.face = new THREE.Group();
    this.skull.add(this.face); // inherits scale(R) -> build in unit sphere coordinates (r = 1)

    const eyeGeo = new THREE.SphereGeometry(1, 20, 14);
    this.eyes = [-1, 1].map((s) => {
      const dir = V(s * 0.38, 0.16, 0.91).normalize();
      const g = new THREE.Group();
      g.position.copy(dir).multiplyScalar(0.985);
      orient(g, dir);
      const open = blackMesh(eyeGeo);
      open.scale.set(0.125, 0.19, 0.05);
      const arc = blackMesh(new THREE.TorusGeometry(0.15, 0.028, 8, 24, Math.PI)); // ∩ ; rotated for ∪ below
      arc.rotation.z = Math.PI; // ∪  (peaceful closed eye)
      arc.position.y = 0.06;
      arc.scale.set(1, 0.8, 1);
      arc.visible = false;
      const bag = blackMesh(new THREE.TorusGeometry(0.17, 0.016, 6, 20, Math.PI * 0.6));
      bag.rotation.z = Math.PI + Math.PI * 0.2; // small ∪ under the eye
      bag.position.set(0, -0.26, 0);
      bag.material = new THREE.MeshBasicMaterial({ color: 0x5a6a8c });
      bag.visible = false;
      g.add(open, arc, bag);
      this.face.add(g);
      return { s, g, open, arc, bag };
    });

    // mouth: variants toggled by name
    const mdir = V(0, -0.42, 0.9).normalize();
    this.mouth = new THREE.Group();
    this.mouth.position.copy(mdir).multiplyScalar(0.995);
    orient(this.mouth, mdir);
    this.face.add(this.mouth);
    const flat = blackMesh(new THREE.CapsuleGeometry(0.028, 0.34, 4, 10)); flat.rotation.z = Math.PI / 2;
    const smile = blackMesh(new THREE.TorusGeometry(0.26, 0.028, 8, 28, Math.PI * 0.55));
    smile.rotation.z = Math.PI + (Math.PI - Math.PI * 0.55) / 2 + Math.PI * 0.0; smile.position.y = 0.2; // ∪
    smile.rotation.z = -Math.PI / 2 - (Math.PI * 0.55) / 2;
    const frown = blackMesh(new THREE.TorusGeometry(0.26, 0.028, 8, 28, Math.PI * 0.55));
    frown.rotation.z = Math.PI / 2 - (Math.PI * 0.55) / 2; frown.position.y = -0.2; // ∩
    const oval = blackMesh(new THREE.SphereGeometry(1, 20, 14)); oval.scale.set(0.1, 0.13, 0.05);
    const wide = blackMesh(new THREE.SphereGeometry(1, 20, 14)); wide.scale.set(0.16, 0.2, 0.05);
    this.mouths = { flat, smile, frown, oval, wide };
    Object.values(this.mouths).forEach((m) => { m.visible = false; this.mouth.add(m); });
    this.mouths.flat.visible = true;
  }

  /** eyeOpen 0..1 (squash), closed -> peaceful arcs, bags -> tired marks, mouth name */
  setFace({ eyeOpen = 1, closed = false, bags = false, mouth = 'flat', look = [0, 0] } = {}) {
    for (const e of this.eyes) {
      e.open.visible = !closed;
      e.arc.visible = closed;
      e.bag.visible = bags;
      e.open.scale.y = 0.19 * Math.max(0.12, eyeOpen);
      e.open.position.set(look[0] * 0.05, look[1] * 0.05 - (1 - eyeOpen) * 0.03, 0);
    }
    for (const k of Object.keys(this.mouths)) this.mouths[k].visible = k === mouth;
  }

  // -------------------------------------------------------------- X-ray (torso + head become 30% opaque shells)
  xray(a) {
    this.xrayAmount = a;
    for (const s of this.shells) s.setXray(a);
  }

  // -------------------------------------------------------------- rig solve
  /** Set a target (WORLD space) for a hand (side -1 = viewer's left … see s) or null to hang. */
  setHand(side, world) { this.arms[side < 0 ? 0 : 1].target = world ? world.clone() : null; }
  setFoot(side, world) { this.legs[side < 0 ? 0 : 1].target = world ? world.clone() : null; }

  solve() {
    this.updateMatrixWorld(true);
    const H = HUMAN;
    // arms in torso space
    for (const a of this.arms) {
      let t;
      if (a.target) t = this.torso.worldToLocal(a.target.clone());
      else t = a.shoulder.clone().add(V(a.s * 0.1, -1.3, 0.1));
      const pole = V(a.s * 0.7, -0.35, -0.75);
      const { mid, end } = ik2(a.shoulder, t, H.upperArm, H.foreArm, pole);
      a.upper.place(a.shoulder, mid);
      a.fore.place(mid, end);
      a.hand.position.copy(end);
      // sleeve: first 40% of the upper arm
      const sl = a.shoulder.clone().lerp(mid, 0.36);
      a.sleeve.place(a.shoulder.clone().addScaledVector(mid.clone().sub(a.shoulder).normalize(), -0.02), sl);
    }
    // legs in root space
    for (const l of this.legs) {
      const hip = V(l.s * H.hipX, -0.05, 0);
      let t;
      if (l.target) t = this.worldToLocal(l.target.clone());
      else t = hip.clone().add(V(0, -1.82, 0.04));
      const { mid, end } = ik2(hip, t, H.thigh, H.shin, V(l.s * 0.15, 0.1, 1));
      l.thigh.place(hip, mid);
      l.shin.place(mid, end);
      l.foot.position.set(end.x, end.y - 0.07, end.z + 0.1);
    }
  }
}
