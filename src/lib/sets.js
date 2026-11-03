// Environments: living room (sofa, window, plant, lamp), hallway, fridge/kitchen, city backdrop, props.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Toon, Limb, ellipsoid, sphere, V, clamp, GRADIENT } from './toon.js';
import { CanvasPlane, glowSprite } from './icons.js';

export const LIVING = { x: 0 }; // living room is centred on the origin
export const HALL = { x: 60 };
export const KITCHEN = { x: -60 };

const OUT = { outline: 6 };
const box = (w, h, d, r, color, o = OUT) => new Toon(new RoundedBoxGeometry(w, h, d, 5, r), color, o);

function woodTexture(base = '#5a3824', dark = '#2c1a10', light = '#6c4630', rows = 9, tilesX = 1) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 1024, 1024);
  const rh = 1024 / rows;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let r = 0; r < rows; r++) {
    // each row split in 2-3 boards with different tone
    let x = -rnd() * 300;
    while (x < 1024) {
      const w = 380 + rnd() * 420;
      const k = rnd();
      g.fillStyle = k < 0.33 ? base : k < 0.66 ? light : '#4d301f';
      g.globalAlpha = 0.55 + rnd() * 0.45;
      g.fillRect(x, r * rh, w, rh);
      g.globalAlpha = 0.18; g.strokeStyle = light; g.lineWidth = 2;
      for (let i = 0; i < 4; i++) { const yy = r * rh + rh * (0.2 + i * 0.2) + (rnd() - 0.5) * 6; g.beginPath(); g.moveTo(x + 10, yy); g.lineTo(x + w - 10, yy + (rnd() - 0.5) * 8); g.stroke(); }
      g.globalAlpha = 1; g.fillStyle = dark; g.fillRect(x, r * rh, 5, rh);
      x += w;
    }
    g.fillStyle = dark; g.fillRect(0, r * rh, 1024, 5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 8;
  return tex;
}
function floorPlane(w, d, repeatX, repeatZ, tex) {
  const t = tex.clone(); t.needsUpdate = true; t.repeat.set(repeatX, repeatZ);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshToonMaterial({ map: t, gradientMap: null, color: 0xffffff }));
  m.material.gradientMap = GRADIENT;
  return m;
}
const flat = (color) => new THREE.MeshToonMaterial({ color, gradientMap: GRADIENT });

// =============================================================================== CITY (canvas, animated)
export class City extends CanvasPlane {
  constructor() {
    super(512, 1024, 14, 28, (ctx, W, H, s) => {
      const { t = 0, speed = 0.15, warm = 0 } = s;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      // cold grey-blue sky; slightly warmer low on horizon with warm mood
      g.addColorStop(0, '#2b3350'); g.addColorStop(0.55, '#59627f'); g.addColorStop(1, warm ? '#c9b8a8' : '#8a90a6');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const layers = [
        { n: 7, minW: 60, maxW: 120, minH: 420, maxH: 760, col: '#8b90a4', par: 0.4, seed: 1 },
        { n: 6, minW: 70, maxW: 140, minH: 300, maxH: 620, col: '#6a7088', par: 0.8, seed: 2 },
        { n: 5, minW: 90, maxW: 170, minH: 200, maxH: 520, col: '#444b66', par: 1.5, seed: 3 },
        { n: 4, minW: 120, maxW: 220, minH: 140, maxH: 360, col: '#2a3048', par: 2.6, seed: 4 },
      ];
      const trails = speed > 0.5 ? 9 : 1;
      for (const L of layers) {
        let r = L.seed * 99;
        const rand = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
        const bs = [];
        let x = 0;
        for (let i = 0; i < L.n * 3; i++) { const w = L.minW + rand() * (L.maxW - L.minW); const h = L.minH + rand() * (L.maxH - L.minH); bs.push({ x, w, h }); x += w + 6; }
        const total = x;
        for (let k = trails - 1; k >= 0; k--) {
          const off = (((t * speed * 520 * L.par) - k * speed * 14 * L.par) % total + total) % total;
          ctx.globalAlpha = trails > 1 ? (k === 0 ? 0.9 : 0.16) : 1;
          ctx.fillStyle = L.col;
          for (const b of bs) {
            for (let rep = -1; rep <= 1; rep++) {
              const bx = b.x - off + rep * total;
              if (bx > W || bx + b.w < 0) continue;
              ctx.fillRect(bx, H - b.h - 60 * (L.par / 2.6), b.w, b.h + 60);
            }
          }
        }
        ctx.globalAlpha = 1;
      }
      // lit windows (flicker static per layer)
      ctx.fillStyle = 'rgba(230,230,215,.5)';
      for (let i = 0; i < 70; i++) { const x = (i * 97) % W, y = 380 + ((i * 211) % 560); ctx.fillRect((x - (t * speed * 600) % W + W) % W, y, 8, 10); }
      // speed streaks (cars / blur) on fast shot
      if (speed > 0.5) {
        for (let i = 0; i < 14; i++) {
          const y = 120 + ((i * 331) % 880); const len = 160 + (i * 53) % 260;
          const x = (((t * 2400 * (0.6 + (i % 5) * 0.25)) + i * 177) % (W + len * 2)) - len;
          ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,.35)' : 'rgba(190,200,220,.25)';
          ctx.fillRect(x, y, len, 3 + (i % 3));
        }
      }
    });
  }
}

// =============================================================================== LIVING ROOM
export function buildLiving(ctxInfo = {}) {
  const g = new THREE.Group();
  const floorTex = woodTexture('#6a4429', '#2c180d', '#7a5035', 10);
  const floor = floorPlane(40, 18, 5, 2.4, floorTex); floor.position.set(0, 0, 3); g.add(floor);

  // rug
  const rug = box(8.6, 0.05, 4.4, 0.02, 0x34426b, { outline: 0 }); rug.position.set(0, 0.03, 2.1); g.add(rug);
  const rug2 = box(7.8, 0.06, 3.6, 0.02, 0x42538a, { outline: 0 }); rug2.position.set(0, 0.04, 2.1); g.add(rug2);

  // back wall in pieces around the window opening
  const wallC = 0x232a4a;
  const wallMat = flat(wallC);
  const wp = (x0, x1, y0, y1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), wallMat); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, -2.8); g.add(m); };
  const WX0 = -9.2, WX1 = -6.4, WY0 = 0.15, WY1 = 7.6;
  wp(-30, WX0, 0, 11); wp(WX1, 30, 0, 11); wp(WX0, WX1, WY1, 11); wp(WX0, WX1, 0, WY0);
  // wainscot + baseboard
  const wain = new THREE.Mesh(new THREE.PlaneGeometry(40, 2.4), flat(0x1b2140)); wain.position.set(0, 1.2, -2.78); wain.visible = true; g.add(wain);
  const rail = box(40, 0.14, 0.12, 0.03, 0x39426e, { outline: 4 }); rail.position.set(0, 2.45, -2.74); g.add(rail);
  const base = box(40, 0.28, 0.12, 0.03, 0x39426e, { outline: 4 }); base.position.set(0, 0.14, -2.74); g.add(base);

  // window: frame + mullions + glass-less opening onto the city plane
  const fr = 0x151a32;
  const wf = (w, h, x, y) => { const b = box(w, h, 0.3, 0.05, fr, { outline: 5 }); b.position.set(x, y, -2.72); g.add(b); };
  wf(0.22, WY1 - WY0 + 0.3, WX0, (WY0 + WY1) / 2); wf(0.22, WY1 - WY0 + 0.3, WX1, (WY0 + WY1) / 2);
  wf(WX1 - WX0 + 0.3, 0.22, (WX0 + WX1) / 2, WY1 + 0.05); wf(WX1 - WX0 + 0.3, 0.2, (WX0 + WX1) / 2, WY0);
  wf(0.12, WY1 - WY0, (WX0 + WX1) / 2, (WY0 + WY1) / 2); wf(WX1 - WX0, 0.12, (WX0 + WX1) / 2, 4.2);
  const city = new City(); city.position.set((WX0 + WX1) / 2, 6.8, -10); city.scale.set(1.0, 1.0, 1); city.renderOrder = -5;
  city.material.depthWrite = true; city.material.transparent = false; g.add(city);
  // sunlit sill glow card (used in the warm mood)
  const sunGlow = glowSprite(0xffc46b, 9); sunGlow.position.set((WX0 + WX1) / 2, 3.8, -2.6); sunGlow.material.opacity = 0; g.add(sunGlow);

  // wall art
  const frame = (x, y, w, h, c1, c2) => {
    const f = box(w, h, 0.14, 0.04, 0x10142a, { outline: 5 }); f.position.set(x, y, -2.68); g.add(f);
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, h * 0.8), flat(c1)); inner.position.set(x, y, -2.6); g.add(inner);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(Math.min(w, h) * 0.22, 32), flat(c2)); dot.position.set(x + w * 0.1, y + h * 0.08, -2.59); g.add(dot);
  };
  frame(-1.5, 5.0, 1.7, 2.2, 0x394a85, 0xf0b35e); frame(1.2, 4.6, 2.6, 1.7, 0x2a6a74, 0xf2e6c0); frame(3.6, 5.1, 1.4, 1.9, 0x7a4a74, 0xf7c4a8);

  // ------------------------------------------------------------ sofa (seat top y = 1.0, front edge z ≈ 1.2)
  const sofa = new THREE.Group(); g.add(sofa);
  const SOF = 0x646b80, SOF2 = 0x727a90, SOFD = 0x545a6e;
  const baseBox = box(6.4, 0.7, 2.6, 0.14, SOFD); baseBox.position.set(0, 0.55, 0.0); sofa.add(baseBox);
  [[-2.9, -1.0], [2.9, -1.0], [-2.9, 1.0], [2.9, 1.0]].forEach(([x, z]) => {
    const l = box(0.22, 0.28, 0.22, 0.05, 0x2c1a10, { outline: 4 }); l.position.set(x, 0.14, z); sofa.add(l);
  });
  const backrest = box(6.4, 1.7, 0.75, 0.22, SOF); backrest.position.set(0, 1.75, -1.05); sofa.add(backrest);
  const armL = box(0.7, 1.3, 2.6, 0.24, SOF); armL.position.set(-3.05, 1.35, 0.0); sofa.add(armL);
  const armR = box(0.7, 1.3, 2.6, 0.24, SOF); armR.position.set(3.05, 1.35, 0.0); sofa.add(armR);
  const seats = [-1.75, 0, 1.75].map((x) => {
    const s = box(1.75, 0.42, 2.0, 0.17, SOF2); s.position.set(x, 0.79, 0.28); sofa.add(s); return s;
  });
  const backs = [-1.75, 0, 1.75].map((x) => {
    const s = box(1.7, 1.1, 0.4, 0.17, SOF2); s.position.set(x, 1.9, -0.55); s.rotation.x = -0.12; sofa.add(s); return s;
  });
  // throw pillow
  const pillow = box(0.9, 0.85, 0.28, 0.12, 0xc79245, { outline: 5 }); pillow.position.set(-2.3, 1.62, -0.2); pillow.rotation.set(-0.15, 0.25, 0.2); sofa.add(pillow);
  const SEAT_TOP = 1.0;

  // ------------------------------------------------------------ plant
  const plant = new THREE.Group(); plant.position.set(4.3, 0, -0.7); g.add(plant);
  const pot = new Toon(new THREE.CylinderGeometry(0.62, 0.45, 0.95, 28), 0xc9794a, OUT); pot.position.y = 0.48; plant.add(pot);
  const rim = new Toon(new THREE.CylinderGeometry(0.7, 0.66, 0.2, 28), 0xd98a58, OUT); rim.position.y = 1.0; plant.add(rim);
  const leaves = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3, tilt = 0.35 + (i % 3) * 0.18;
    const pv = new THREE.Group(); pv.position.set(0, 1.0, 0); pv.rotation.set(0, a, 0);
    const lf = ellipsoid(0.22, 0.95 + (i % 2) * 0.3, 0.07, i % 2 ? 0x3f9d5a : 0x2e8450, { outline: 5 });
    lf.position.set(0, 0.95, 0); const inner = new THREE.Group(); inner.rotation.z = tilt; inner.add(lf); pv.add(inner); plant.add(pv); leaves.push({ pv, inner, base: tilt, i });
  }

  // ------------------------------------------------------------ floor lamp
  const lamp = new THREE.Group(); lamp.position.set(-4.7, 0, -1.4); g.add(lamp);
  const pole = new Limb(0.05, 0x1a1a22, { outline: 4 }); pole.place(V(0, 0.1, 0), V(0, 3.9, 0)); lamp.add(pole);
  const lbase = new Toon(new THREE.CylinderGeometry(0.5, 0.55, 0.14, 24), 0x1a1a22, { outline: 4 }); lbase.position.y = 0.07; lamp.add(lbase);
  const shade = new Toon(new THREE.CylinderGeometry(0.45, 0.7, 0.9, 28, 1, true), 0x7a7a94, { outline: 5 });
  shade.fill.material.side = THREE.DoubleSide; shade.position.y = 4.1; lamp.add(shade);
  const shadeMat = shade.fillMat;
  const lampGlow = glowSprite(0xffc46b, 4.5); lampGlow.position.set(-4.7, 4.0, -1.0); lampGlow.material.opacity = 0; g.add(lampGlow);

  return { group: g, sofa, seats, backs, pillow, plant, leaves, city, sunGlow, shadeMat, lampGlow, SEAT_TOP, floor };
}

// =============================================================================== HALLWAY
export function buildHallway() {
  const g = new THREE.Group(); g.position.x = HALL.x;
  const floorTex = woodTexture('#4b2e1b', '#1f1008', '#5e3b25', 8);
  const floor = floorPlane(34, 14, 4.5, 1.9, floorTex); floor.position.set(0, 0, 2); g.add(floor);
  // back wall: upper teal-navy, lower wood paneling
  const up = new THREE.Mesh(new THREE.PlaneGeometry(40, 9), flat(0x17242f)); up.position.set(0, 7.5, -2.6); g.add(up);
  const low = new THREE.Mesh(new THREE.PlaneGeometry(40, 3.4), flat(0x3a2415)); low.position.set(0, 1.7, -2.58); g.add(low);
  for (let i = -8; i <= 8; i++) { const pn = box(2.7, 2.7, 0.1, 0.06, 0x4a2e1c, { outline: 4 }); pn.position.set(i * 3.0, 1.75, -2.5); g.add(pn); }
  const rail = box(40, 0.2, 0.2, 0.05, 0x5b3822, { outline: 4 }); rail.position.set(0, 3.4, -2.5); g.add(rail);
  const base = box(40, 0.3, 0.16, 0.05, 0x5b3822, { outline: 4 }); base.position.set(0, 0.15, -2.52); g.add(base);
  // door at left
  const dfr = box(2.8, 6.4, 0.3, 0.08, 0x2a1a10, { outline: 6 }); dfr.position.set(-7.5, 3.2, -2.4); g.add(dfr);
  const door = box(2.3, 6.0, 0.2, 0.06, 0x6c4528, { outline: 5 }); door.position.set(-7.5, 3.0, -2.2); g.add(door);
  const knob = sphere(0.1, 0xd9b45b, { outline: 3 }); knob.position.set(-6.7, 3.0, -2.05); g.add(knob);
  // frames
  const fr = (x, y, w, h, c) => { const f = box(w, h, 0.16, 0.05, 0x1d120b, { outline: 5 }); f.position.set(x, y, -2.45); g.add(f); const i = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.78, h * 0.78), flat(c)); i.position.set(x, y, -2.36); g.add(i); };
  fr(-3.2, 5.3, 1.6, 2.0, 0x3d5a80); fr(0.8, 5.5, 2.4, 1.6, 0x8a5a44); fr(4.2, 5.2, 1.4, 1.9, 0x4a6f5d);
  // sconce (warm)
  const sc = ellipsoid(0.3, 0.38, 0.3, 0xffd9a0, { outline: 5 }); sc.position.set(-0.8, 4.4, -2.2); sc.fillMat.emissive = new THREE.Color(0xffa84a).multiplyScalar(0.7); g.add(sc);
  const scGlow = glowSprite(0xff9d3c, 4.2); scGlow.position.set(-0.8, 4.4, -2.0); scGlow.material.opacity = 0.55; g.add(scGlow);
  // far end: cold glow of the living room
  const end = glowSprite(0x6a90ff, 11); end.position.set(11, 3.4, -2.0); end.material.opacity = 0.5; g.add(end);
  return { group: g, floor };
}

// =============================================================================== FRIDGE + KITCHEN
export function buildKitchen() {
  const g = new THREE.Group(); g.position.x = KITCHEN.x;
  const W = 2.4, H0 = 0.1, H1 = 5.9, Z0 = -1.6, Z1 = 1.0;
  const inner = 0xdcecff;
  const wallM = (c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide });
  const pl = (w, h, pos, rot, c) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallM(c)); m.position.copy(pos); m.rotation.set(...rot); g.add(m); return m; };
  pl(W, H1 - H0, V(0, (H0 + H1) / 2, Z0), [0, 0, 0], inner);
  pl(Z1 - Z0, H1 - H0, V(-W / 2, (H0 + H1) / 2, (Z0 + Z1) / 2), [0, Math.PI / 2, 0], 0xcfe3fa);
  pl(Z1 - Z0, H1 - H0, V(W / 2, (H0 + H1) / 2, (Z0 + Z1) / 2), [0, -Math.PI / 2, 0], 0xc4dbf6);
  pl(W, Z1 - Z0, V(0, H1, (Z0 + Z1) / 2), [Math.PI / 2, 0, 0], 0xffffff);
  pl(W, Z1 - Z0, V(0, H0, (Z0 + Z1) / 2), [-Math.PI / 2, 0, 0], 0xa9c4e4);
  // rim (front frame of the fridge body)
  const rim = 0.35, rc = 0xc4ccd8;
  const rb = (w, h, x, y) => { const b = box(w, h, 0.34, 0.1, rc, { outline: 7 }); b.position.set(x, y, Z1); g.add(b); };
  rb(rim, H1 - H0 + rim, -W / 2 - rim / 2 + 0.02, (H0 + H1) / 2); rb(rim, H1 - H0 + rim, W / 2 + rim / 2 - 0.02, (H0 + H1) / 2);
  rb(W + rim * 2, rim, 0, H1 + rim / 2 - 0.02); rb(W + rim * 2, rim, 0, H0 - rim / 2 + 0.02);
  // glass shelves + a few sad items
  const shelfY = [1.3, 2.45, 3.75, 4.9];
  shelfY.forEach((y, k) => {
    const sm = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.06, Z1 - Z0 - 0.2), new THREE.MeshBasicMaterial({ color: 0xe9f6ff, transparent: true, opacity: 0.85 }));
    sm.position.set(0, y, (Z0 + Z1) / 2 - 0.1); g.add(sm);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.08, 0.05), new THREE.MeshBasicMaterial({ color: 0x7fb4dd }));
    edge.position.set(0, y, Z1 - 0.2); g.add(edge);
  });
  const item = (mesh, x, y, z) => { mesh.scale.multiplyScalar(0.62); mesh.position.set(x, y + (y % 1) * 0, z + 0.45); g.add(mesh); return mesh; };
  item(box(0.5, 0.95, 0.5, 0.08, 0xffffff, { outline: 5 }), -0.65, 2.45 + 0.52, 0.45);          // milk carton
  item(box(0.52, 0.14, 0.52, 0.04, 0x4c78d8, { outline: 4 }), -0.65, 2.45 + 0.86, 0.45);
  item(new Toon(new THREE.CylinderGeometry(0.26, 0.26, 0.55, 24), 0xaee0ff, OUT), 0.55, 2.45 + 0.33, 0.35);   // jar
  item(new Toon(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 24), 0xd94a3a, { outline: 4 }), 0.55, 2.45 + 0.64, 0.35);
  item(ellipsoid(0.34, 0.26, 0.3, 0x6fbf5a, OUT), 0.1, 3.75 + 0.3, 0.2);                       // lonely lettuce
  item(new Toon(new THREE.CylinderGeometry(0.16, 0.2, 0.75, 20), 0xd93a2e, OUT), -0.7, 3.75 + 0.42, 0.5); // ketchup
  item(ellipsoid(0.2, 0.15, 0.2, 0xf2d73a, { outline: 5 }), 0.7, 1.55 + 0.17, 0.4);             // lemon
  // light inside
  const lightSrc = glowSprite(0xdff3ff, 5); lightSrc.position.set(0, 5.5, 0.3); g.add(lightSrc);

  // door (hinged at the left edge of the opening); pivot at hinge
  const hinge = new THREE.Group(); hinge.position.set(-W / 2 - rim, 0, Z1 + 0.25); g.add(hinge);
  const doorW = W + rim * 2, doorH = H1 - H0 + rim * 2;
  const door = box(doorW, doorH, 0.5, 0.14, 0xd5dbe5, { outline: 8 }); door.position.set(doorW / 2, (H0 + H1) / 2, 0.25); hinge.add(door);
  const bins = [1.6, 3.0, 4.4].map((y) => { const b = box(doorW - 0.5, 0.16, 0.5, 0.05, 0xf4f8ff, { outline: 5 }); b.position.set(doorW / 2, y, -0.28); hinge.add(b); return b; });
  const innerPanel = box(doorW - 0.3, doorH - 0.3, 0.1, 0.05, 0x2d3a52, { outline: 0 }); innerPanel.position.set(doorW / 2, (H0 + H1) / 2, -0.05); hinge.add(innerPanel);

  // kitchen backdrop behind the character (dark blue)
  const KZ = 11;
  const bw = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), flat(0x0e1630)); bw.position.set(0, 7, KZ + 3); bw.rotation.y = Math.PI; g.add(bw);
  const kfloor = new THREE.Mesh(new THREE.PlaneGeometry(40, 30).rotateX(-Math.PI / 2), flat(0x0d1226)); kfloor.position.set(0, 0, 8); g.add(kfloor);
  const cab = (x, y, w, h, c) => { const b = box(w, h, 1.2, 0.1, c, { outline: 6 }); b.position.set(x, y, KZ + 2); g.add(b); return b; };
  cab(-4.5, 6.6, 3.6, 2.2, 0x18244d); cab(-0.6, 6.6, 3.6, 2.2, 0x1a2852); cab(3.4, 6.6, 3.6, 2.2, 0x18244d); cab(7, 6.6, 3.2, 2.2, 0x1a2852);
  cab(-4.5, 1.6, 3.6, 3.2, 0x152046); cab(-0.6, 1.6, 3.6, 3.2, 0x17234a); cab(3.4, 1.6, 3.6, 3.2, 0x152046); cab(7, 1.6, 3.2, 3.2, 0x17234a);
  const counter = box(16, 0.22, 1.8, 0.05, 0x2a3a6a, { outline: 6 }); counter.position.set(1.4, 3.3, KZ + 2); g.add(counter);
  return { group: g, hinge, W };
}

// =============================================================================== PROPS
export function buildPhone() {
  const g = new THREE.Group();
  const body = box(0.62, 1.12, 0.07, 0.07, 0x15171f, { outline: 4 }); g.add(body);
  const screen = new CanvasPlane(256, 460, 0.54, 1.0, (ctx, W, H, s) => {
    const { t = 0 } = s;
    ctx.fillStyle = '#10234a'; ctx.fillRect(0, 0, W, H);
    // scrolling feed cards
    const off = (t * 340) % 190;
    for (let i = -1; i < 5; i++) {
      const y = i * 190 - off + 20;
      ctx.fillStyle = i % 2 ? '#2d4f9a' : '#3d6bd1'; ctx.beginPath(); ctx.roundRect(14, y, W - 28, 170, 14); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(46, y + 36, 18, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(76, y + 24, 110 + (i * 37) % 60, 10); ctx.fillRect(76, y + 44, 70, 8);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(28, y + 80, W - 56, 66);
    }
  });
  screen.material.depthWrite = true; screen.material.transparent = false; screen.material.opacity = 1; screen.renderOrder = 0;
  screen.position.z = 0.04; g.add(screen);
  return { group: g, screen };
}

export function buildBall() {
  const g = new THREE.Group();
  const b = sphere(0.24, 0x7dff2a, { outline: 6 });
  g.add(b);
  // white seam arcs (tennis-ball style)
  const seamMat = new THREE.MeshBasicMaterial({ color: 0xf4fff0 });
  const seam1 = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.016, 6, 40, Math.PI * 1.2), seamMat); seam1.position.set(0, 0, 0); seam1.rotation.set(0.9, 0.4, 0);
  const seam2 = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.016, 6, 40, Math.PI * 1.2), seamMat); seam2.rotation.set(-0.9, 0.4 + Math.PI, 0);
  g.add(seam1, seam2);
  return { group: g, body: b };
}

// soft contact shadow blob on the floor
export function shadowBlob(rx, rz) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(rx * 2, rz * 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.renderOrder = 1; m.position.y = 0.06;
  return m;
}
