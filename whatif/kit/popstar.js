// The pop star. A procedural, rigged, low-poly singer rebuilt from the reference videos.
//
//   const star = createPopStar('SUNNY');      // or 'EMERALD', or a custom preset object
//   scene.add(star.group);
//   star.update(t, { beat, mouth, vowel, armL:'hip', armR:'mic', look: camera.position, dance: 1 });
//
// Every pose is a pure function of (t, perf). There is no frame-to-frame state, so frames can be
// rendered out of order and in parallel.
import * as THREE from 'three';
import { limbGeometry, latheProfile, taperedTube, starShape, canvasTexture, rng, clamp, lerp, smooth } from './util.js';

export const PRESETS = {
  // Blonde star in the yellow sequin mini dress (ref: "What if a pop star was 100 times taller?")
  SUNNY: {
    skin: '#d39468', lips: '#b8323d', brows: '#7a5428', eyes: '#3a2414',
    hair: ['#ecd27e', '#dcbb5e', '#f4df9a', '#cfa94c'], hairStyle: 'volume',
    outfit: 'mini', dress: '#e9b51c', sequin: true, belt: '#7b4a22', buckle: 'star',
    boots: '#e6b320', jewelry: '#e2b450', lashes: '#1d1410',
  },
  // Red-haired star in the green satin gown (ref: "What if a Level 9 thunderstorm hit her concert?")
  EMERALD: {
    skin: '#e8b9a0', lips: '#4a2234', brows: '#6e1f12', eyes: '#2f6b3a',
    hair: ['#b3261b', '#9c1f17', '#c9372a', '#8a1a12'], hairStyle: 'straight',
    outfit: 'gown', dress: '#0f6a2c', sequin: false, belt: '#d6a94a', buckle: 'disc',
    boots: '#d6a94a', jewelry: '#d6a94a', lashes: '#120b0b',
  },
};

const ARM_UPPER = 0.27, ARM_FORE = 0.245;
const LEG_UPPER = 0.44, LEG_LOWER = 0.43;

// --------------------------------------------------------------------------------------------
function sequinTextures(base, seed = 7) {
  const r = rng(seed);
  const col = new THREE.Color(base);
  const map = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#' + col.clone().multiplyScalar(0.55).getHexString(); g.fillRect(0, 0, w, h);
    const s = 9;
    for (let y = 0; y < h + s; y += s * 0.82) {
      const row = Math.round(y / (s * 0.82));
      for (let x = (row % 2) * s * 0.5; x < w + s; x += s) {
        const k = 0.65 + r() * 0.6;
        const c = col.clone().multiplyScalar(k);
        g.fillStyle = '#' + c.getHexString();
        g.beginPath(); g.arc(x, y, s * 0.48, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,' + (0.08 + r() * 0.2) + ')';
        g.beginPath(); g.arc(x - 1.2, y - 1.2, s * 0.18, 0, Math.PI * 2); g.fill();
      }
    }
  }, { repeat: [3, 3] });
  const sparkle = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = r() * w, y = r() * h, s = 0.8 + r() * 2.2;
      g.fillStyle = `rgba(255,${235 + r() * 20},${190 + r() * 60},${0.5 + r() * 0.5})`;
      g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
    }
  }, { repeat: [3, 3] });
  return { map, sparkle };
}

function headGeometry() {
  const g = new THREE.SphereGeometry(1, 28, 22);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // jaw taper + chin
    if (y < -0.15) {
      const k = (-y - 0.15) / 0.85;
      x *= 1 - 0.38 * k;
      if (z > 0) z *= 1 - 0.1 * k; else z *= 1 - 0.3 * k;
    }
    // flatten the back of the face a little, push cheekbones
    if (z > 0.3 && y > -0.3 && y < 0.15) x *= 1.04;
    // forehead slightly flatter at the front
    if (z > 0.6 && y > 0.2) z *= 0.97;
    p.setXYZ(i, x * 0.092, y * 0.116, z * 0.1);
  }
  g.computeVertexNormals();
  return g;
}

// 2-bone IK. Returns elbow position. All vectors in the same space.
function solve2(S, T, a, b, pole) {
  const d0 = new THREE.Vector3().subVectors(T, S);
  let d = d0.length();
  const dir = d0.clone().divideScalar(d || 1);
  d = clamp(d, Math.abs(a - b) + 1e-3, a + b - 1e-3);
  const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  const perp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)));
  if (perp.lengthSq() < 1e-8) perp.set(0, 0, 1);
  perp.normalize();
  const E = S.clone().add(dir.clone().multiplyScalar(a * cosA)).add(perp.multiplyScalar(a * sinA));
  const W = S.clone().add(dir.multiplyScalar(d));
  return { E, W };
}

const DOWN = new THREE.Vector3(0, -1, 0);
function aimDown(dirLocal) { return new THREE.Quaternion().setFromUnitVectors(DOWN, dirLocal.clone().normalize()); }

// arm targets, chest-local (x = her left)
const ARM_POSES = {
  mic: { L: null, R: [-0.06, 0.13, 0.2] },
  hip: { L: [0.215, -0.04, -0.03], R: [-0.215, -0.04, -0.03] },
  down: { L: [0.2, -0.3, 0.05], R: [-0.2, -0.3, 0.05] },
  up: { L: [0.2, 0.68, 0.1], R: [-0.2, 0.68, 0.1] },
  reach: { L: [0.42, 0.3, 0.3], R: [-0.42, 0.3, 0.3] },
  out: { L: [0.48, 0.05, 0.18], R: [-0.48, 0.05, 0.18] },
  wave: { L: [0.32, 0.55, 0.15], R: [-0.32, 0.55, 0.15] },
  heart: { L: [0.06, 0.22, 0.18], R: [-0.06, 0.22, 0.18] },
  point: { L: [0.2, 0.72, 0.3], R: [-0.2, 0.72, 0.3] },
  shield: { L: [0.12, 0.5, 0.22], R: [-0.12, 0.5, 0.22] },
};
// elbow pole directions, chest-local
const POLE = {
  hip: (s) => new THREE.Vector3(s * 1, -0.2, -0.6),
  default: (s) => new THREE.Vector3(s * 0.7, -1, -0.4),
  up: (s) => new THREE.Vector3(s * 1, 0.1, -0.3),
};

// --------------------------------------------------------------------------------------------
export function createPopStar(presetName = 'SUNNY', opts = {}) {
  const P = typeof presetName === 'string' ? { ...PRESETS[presetName], ...opts } : { ...presetName, ...opts };
  const R = rng(opts.seed || 11);

  const M = {
    skin: new THREE.MeshStandardMaterial({ color: P.skin, roughness: 0.55, metalness: 0 }),
    lips: new THREE.MeshStandardMaterial({ color: P.lips, roughness: 0.35 }),
    dark: new THREE.MeshStandardMaterial({ color: '#160a0a', roughness: 0.9 }),
    eyeW: new THREE.MeshStandardMaterial({ color: '#f4efe8', roughness: 0.3 }),
    iris: new THREE.MeshStandardMaterial({ color: P.eyes, roughness: 0.25 }),
    pupil: new THREE.MeshStandardMaterial({ color: '#050505', roughness: 0.2 }),
    hi: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    brow: new THREE.MeshStandardMaterial({ color: P.brows, roughness: 0.8 }),
    lash: new THREE.MeshStandardMaterial({ color: P.lashes, roughness: 0.8 }),
    teeth: new THREE.MeshStandardMaterial({ color: '#f3efe6', roughness: 0.4 }),
    gold: new THREE.MeshStandardMaterial({ color: P.jewelry, roughness: 0.25, metalness: 1 }),
    silver: new THREE.MeshStandardMaterial({ color: '#d9dde3', roughness: 0.2, metalness: 1 }),
    black: new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.4, metalness: 0.3 }),
    belt: new THREE.MeshStandardMaterial({ color: P.belt, roughness: P.outfit === 'gown' ? 0.3 : 0.6, metalness: P.outfit === 'gown' ? 1 : 0 }),
    boots: new THREE.MeshStandardMaterial({ color: P.boots, roughness: 0.35, metalness: P.outfit === 'gown' ? 1 : 0.15 }),
    hair: P.hair.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.72, metalness: 0.0, flatShading: true })),
  };
  let sparkleTex = null;
  if (P.sequin) {
    const { map, sparkle } = sequinTextures(P.dress);
    sparkleTex = sparkle;
    M.dress = new THREE.MeshStandardMaterial({
      color: '#ffffff', map, roughness: 0.32, metalness: 0.55,
      emissive: new THREE.Color('#fff2c8'), emissiveMap: sparkle, emissiveIntensity: 1.4, side: THREE.DoubleSide,
    });
  } else {
    M.dress = new THREE.MeshPhysicalMaterial({ color: P.dress, roughness: 0.3, metalness: 0.05, clearcoat: 0.7, clearcoatRoughness: 0.25, sheen: 0.6, sheenColor: new THREE.Color('#7dffb0'), side: THREE.DoubleSide });
  }

  const mesh = (geo, mat, parent, pos, rot, scl) => {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    if (scl) m.scale.set(...scl);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const node = (parent, pos = [0, 0, 0]) => { const o = new THREE.Object3D(); o.position.set(...pos); parent.add(o); return o; };

  const group = new THREE.Group();
  group.name = 'popstar';
  const root = node(group);
  const hips = node(root, [0, 0.96, 0]);
  const spine = node(hips, [0, 0.02, 0]);
  const chest = node(spine, [0, 0.2, 0]);
  const neck = node(chest, [0, 0.238, 0]);
  const head = node(neck, [0, 0.072, 0]);

  // ---- torso ----
  mesh(latheProfile([[-0.1, 0.15], [-0.04, 0.162], [0.04, 0.152], [0.12, 0.13], [0.2, 0.116], [0.23, 0.116]], { radial: 18, sz: 0.68 }), M.skin, spine);
  mesh(latheProfile([[-0.06, 0.117], [0.0, 0.115], [0.07, 0.128], [0.13, 0.142], [0.19, 0.146], [0.225, 0.135], [0.25, 0.1], [0.262, 0.05]], { radial: 18, sz: 0.66, closeTop: true }), M.skin, chest);
  mesh(new THREE.CylinderGeometry(0.043, 0.048, 0.12, 12), M.skin, neck, [0, 0.03, 0]);
  // shoulders (deltoids)
  for (const s of [1, -1]) mesh(new THREE.SphereGeometry(0.05, 14, 10), M.skin, chest, [s * 0.158, 0.205, 0], null, [1, 0.9, 1]);

  // ---- outfit ----
  if (P.outfit === 'mini') {
    mesh(latheProfile([[-0.07, 0.124], [0.0, 0.121], [0.07, 0.136], [0.12, 0.149], [0.16, 0.152]], { radial: 22, sz: 0.69 }), M.dress, chest);
    for (const s of [1, -1]) mesh(new THREE.SphereGeometry(1, 16, 12), M.dress, chest, [s * 0.055, 0.128, 0.072], [0.25, 0, 0], [0.066, 0.06, 0.052]);
    mesh(latheProfile([[0.215, 0.124], [0.12, 0.142], [0.02, 0.172], [-0.1, 0.186], [-0.22, 0.2], [-0.33, 0.218]], { radial: 22, sz: 0.8 }), M.dress, spine);
  } else {
    mesh(latheProfile([[-0.07, 0.124], [0.0, 0.121], [0.07, 0.136], [0.13, 0.149], [0.2, 0.152], [0.235, 0.14]], { radial: 22, sz: 0.69 }), M.dress, chest);
    for (const s of [1, -1]) mesh(new THREE.SphereGeometry(1, 16, 12), M.dress, chest, [s * 0.055, 0.128, 0.072], [0.25, 0, 0], [0.066, 0.06, 0.052]);
    // V neckline in skin over the bodice
    mesh(latheProfile([[0.215, 0.124], [0.12, 0.142], [0.0, 0.172], [-0.3, 0.18], [-0.6, 0.2], [-0.85, 0.27], [-0.955, 0.33]], { radial: 26, sz: 0.82 }), M.dress, spine);
    // puffed shoulders
    for (const s of [1, -1]) mesh(new THREE.SphereGeometry(0.078, 16, 12), M.dress, chest, [s * 0.17, 0.215, 0], null, [1, 1.05, 1]);
  }
  // belt
  mesh(new THREE.CylinderGeometry(0.132, 0.13, 0.036, 22, 1, true), M.belt, spine, [0, 0.17, 0], null, [1, 1, 0.7]);
  if (P.buckle === 'star') {
    mesh(new THREE.ExtrudeGeometry(starShape(0.032, 0.014), { depth: 0.008, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 1 }), M.silver, spine, [0, 0.17, 0.092]);
  } else {
    mesh(new THREE.SphereGeometry(0.03, 14, 10), M.belt, spine, [0, 0.165, 0.09], null, [1, 1, 0.5]);
  }

  // ---- face ----
  mesh(headGeometry(), M.skin, head, [0, 0.1, 0]);
  const face = node(head, [0, 0.1, 0]);
  const eyes = [];
  for (const s of [1, -1]) {
    const e = node(face, [s * 0.033, 0.012, 0.083]);
    mesh(new THREE.SphereGeometry(0.0175, 14, 10), M.eyeW, e, [0, 0, 0], null, [1, 0.72, 0.5]);
    mesh(new THREE.SphereGeometry(0.0098, 12, 8), M.iris, e, [0, -0.0005, 0.0068], null, [1, 1, 0.45]);
    mesh(new THREE.SphereGeometry(0.0052, 10, 6), M.pupil, e, [0, -0.0005, 0.0098], null, [1, 1, 0.4]);
    mesh(new THREE.SphereGeometry(0.0024, 6, 4), M.hi, e, [s * -0.003 + 0.002, 0.0035, 0.0112]);
    // upper lid (rotates down to blink) + lash line
    const lid = node(e, [0, 0, 0]);
    const lidShape = node(lid, [0, 0, 0]); lidShape.scale.set(1, 0.78, 0.6);
    mesh(new THREE.SphereGeometry(0.0195, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), M.skin, lidShape);
    mesh(new THREE.TorusGeometry(0.0195, 0.0026, 4, 14, Math.PI), M.lash, lidShape, [0, 0, 0], [Math.PI / 2, 0, 0]);
    // wing liner
    mesh(new THREE.BoxGeometry(0.012, 0.0024, 0.003), M.lash, e, [s * 0.019, 0.006, 0.004], [0, 0, s * 0.45]);
    // brow
    mesh(new THREE.BoxGeometry(0.036, 0.0055, 0.006), M.brow, face, [s * 0.036, 0.04, 0.09], [0.15, s * 0.22, s * -0.12]);
    eyes.push({ e, lid });
  }
  // nose
  mesh(new THREE.ConeGeometry(0.0125, 0.044, 4), M.skin, face, [0, -0.008, 0.096], [-0.38, Math.PI / 4, 0], [1, 1, 0.8]);
  mesh(new THREE.SphereGeometry(0.0095, 10, 8), M.skin, face, [0, -0.027, 0.103]);
  // mouth: interior + teeth + lips (lower lip on jaw)
  const mouth = node(face, [0, -0.052, 0.088]);
  const interior = mesh(new THREE.SphereGeometry(1, 14, 8), M.dark, mouth, [0, 0, -0.002], null, [0.02, 0.003, 0.006]);
  const teeth = mesh(new THREE.BoxGeometry(0.026, 0.005, 0.004), M.teeth, mouth, [0, 0.003, 0.002]);
  const upperLip = mesh(new THREE.SphereGeometry(1, 16, 8), M.lips, mouth, [0, 0.0055, 0.004], null, [0.025, 0.0062, 0.0095]);
  const jaw = node(mouth, [0, 0, 0]);
  const lowerLip = mesh(new THREE.SphereGeometry(1, 16, 8), M.lips, jaw, [0, -0.006, 0.004], null, [0.023, 0.0078, 0.0105]);
  // ears + earrings
  for (const s of [1, -1]) {
    mesh(new THREE.SphereGeometry(0.016, 8, 6), M.skin, face, [s * 0.088, 0.0, -0.005], null, [0.5, 1.2, 0.8]);
    mesh(new THREE.TorusGeometry(0.017, 0.0028, 6, 18), M.gold, face, [s * 0.091, -0.033, 0.0], [0, Math.PI / 2, 0]);
  }
  // choker
  mesh(new THREE.TorusGeometry(0.047, 0.0045, 6, 24), M.gold, neck, [0, 0.0, 0], [Math.PI / 2, 0, 0], [1, 0.9, 1]);

  // ---- hair ----
  const hairRoot = node(head, [0, 0.1, 0]);
  const locks = [];
  const capMat = M.hair[0];
  // top cap, sitting a little above the forehead
  mesh(new THREE.SphereGeometry(1, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.36), capMat, hairRoot, [0, 0.008, -0.004], null, [0.101, 0.13, 0.112]);
  // back/sides shell, leaving the face open
  const open = P.hairStyle === 'straight' ? 1.25 : 1.35;
  mesh(new THREE.SphereGeometry(1, 22, 14, Math.PI / 2 + open / 2, Math.PI * 2 - open, Math.PI * 0.25, Math.PI * 0.42), capMat, hairRoot, [0, 0.005, -0.006], null, [0.104, 0.124, 0.113]);
  const addLock = (pts, r0, r1, flat, mat, swayAmt = 1) => {
    const base = pts[0].clone();
    const rel = pts.map((p) => p.clone().sub(base));
    const pivot = node(hairRoot, [base.x, base.y, base.z]);
    const m = mesh(taperedTube(rel, { r0, r1, flat, segs: 14, radial: 6, up: new THREE.Vector3(0, 0, 1).add(base.clone().normalize()).normalize() }), mat, pivot);
    locks.push({ pivot, phase: R() * 6.28, amt: swayAmt * (0.6 + R() * 0.6), base: base.clone() });
    return m;
  };
  if (P.hairStyle === 'volume') {
    // chunky voluminous locks, shoulder/chest length, big outward volume
    const N = 30;
    for (let i = 0; i < N; i++) {
      // angle around head; 0 = back, ±PI = front. skip the face window
      const u = i / (N - 1);
      const a = lerp(-2.25, 2.25, u) + (R() - 0.5) * 0.08; // radians from back (-z)
      const sx = Math.sin(a), sz = -Math.cos(a);
      const front = Math.max(0, -sz); // 0..1 how far toward the front
      const y0 = 0.07 + R() * 0.05;
      const S = new THREE.Vector3(sx * 0.09, y0, sz * 0.095);
      const vol = 0.16 + R() * 0.03 + front * 0.02;
      const len = 0.31 + R() * 0.08 - front * 0.02;
      const out = new THREE.Vector3(sx, 0, sz).normalize();
      const fwd = front > 0.25 ? 0.07 * front : 0;
      const pts = [
        S,
        S.clone().add(out.clone().multiplyScalar(0.05)).add(new THREE.Vector3(0, -0.02, 0)),
        new THREE.Vector3(out.x * vol * 0.95, -0.07, out.z * vol * 0.9 + fwd),
        new THREE.Vector3(out.x * vol, -0.19, out.z * vol * 0.85 + fwd * 1.4),
        new THREE.Vector3(out.x * (vol - 0.02), -len, out.z * (vol - 0.04) + fwd * 1.8),
        new THREE.Vector3(out.x * (vol - 0.06), -len - 0.03, out.z * (vol - 0.07) + fwd * 1.9),
      ];
      addLock(pts, 0.042 + R() * 0.012, 0.012, 0.5, M.hair[i % M.hair.length]);
    }
    // inner back fill so no gaps show between locks
    mesh(latheProfile([[0.08, 0.1], [0.0, 0.135], [-0.1, 0.15], [-0.2, 0.15], [-0.3, 0.13]], { radial: 14 }), M.hair[1], hairRoot, [0, 0, -0.035], null, [1, 1, 0.75]);
    // center-parted side bangs framing the face
    for (const s of [1, -1]) {
      addLock([
        new THREE.Vector3(s * 0.01, 0.12, 0.075), new THREE.Vector3(s * 0.05, 0.11, 0.1),
        new THREE.Vector3(s * 0.09, 0.05, 0.1), new THREE.Vector3(s * 0.11, -0.04, 0.085),
        new THREE.Vector3(s * 0.12, -0.14, 0.09), new THREE.Vector3(s * 0.12, -0.25, 0.1),
      ], 0.036, 0.014, 0.55, M.hair[2], 0.6);
      addLock([
        new THREE.Vector3(s * 0.03, 0.125, 0.06), new THREE.Vector3(s * 0.075, 0.1, 0.085),
        new THREE.Vector3(s * 0.115, 0.02, 0.06), new THREE.Vector3(s * 0.14, -0.1, 0.05),
        new THREE.Vector3(s * 0.15, -0.22, 0.06),
      ], 0.04, 0.014, 0.55, M.hair[0], 0.8);
    }
  } else {
    // long straight hair to the waist with blunt bangs
    const N = 32;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const a = lerp(-2.15, 2.15, u) + (R() - 0.5) * 0.06;
      const sx = Math.sin(a), sz = -Math.cos(a);
      const front = Math.max(0, -sz);
      const S = new THREE.Vector3(sx * 0.092, 0.06 + R() * 0.03, sz * 0.098);
      const out = new THREE.Vector3(sx, 0, sz).normalize();
      const len = 0.62 + R() * 0.12 - front * 0.12;
      const pts = [
        S,
        new THREE.Vector3(out.x * 0.115, -0.02, out.z * 0.12),
        new THREE.Vector3(out.x * 0.125, -0.12, out.z * 0.12 + front * 0.03),
        new THREE.Vector3(out.x * 0.135, -0.3, out.z * 0.12 + front * 0.05),
        new THREE.Vector3(out.x * 0.14, -len, out.z * 0.11 + front * 0.06),
      ];
      addLock(pts, 0.03, 0.012, 0.45, M.hair[i % M.hair.length], 0.7);
    }
    mesh(latheProfile([[0.06, 0.1], [-0.05, 0.13], [-0.3, 0.13], [-0.6, 0.12]], { radial: 14 }), M.hair[1], hairRoot, [0, 0, -0.045], null, [1, 1, 0.7]);
    for (let i = 0; i < 9; i++) {
      const x = lerp(-0.07, 0.07, i / 8);
      addLock([
        new THREE.Vector3(x * 0.5, 0.13, 0.06), new THREE.Vector3(x * 0.8, 0.115, 0.095),
        new THREE.Vector3(x, 0.08, 0.108), new THREE.Vector3(x * 1.05, 0.05, 0.11),
      ], 0.02, 0.014, 0.4, M.hair[i % 3], 0.2);
    }
  }

  // ---- arms ----
  const arms = {};
  const armMat = P.outfit === 'gown' ? M.dress : M.skin;
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const shoulder = node(chest, [s * 0.165, 0.2, 0]);
    mesh(limbGeometry(ARM_UPPER, [[0, 0.052], [0.45, 0.046], [1, 0.037]], { radial: 12 }), armMat, shoulder);
    const elbow = node(shoulder, [0, -ARM_UPPER, 0]);
    mesh(new THREE.SphereGeometry(0.035, 10, 8), armMat, elbow);
    mesh(limbGeometry(ARM_FORE, [[0, 0.036], [0.3, 0.038], [1, 0.028]], { radial: 12 }), armMat, elbow);
    const wrist = node(elbow, [0, -ARM_FORE, 0]);
    if (P.outfit === 'gown') mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12), M.gold, wrist, [0, 0.03, 0]);
    // bracelets
    mesh(new THREE.TorusGeometry(0.03, 0.005, 6, 16), M.gold, wrist, [0, 0.02, 0], [Math.PI / 2, 0, 0]);
    mesh(new THREE.TorusGeometry(0.031, 0.004, 6, 16), M.gold, wrist, [0, 0.036, 0], [Math.PI / 2 + 0.15, 0, 0]);
    // hand: palm + finger block (curlable) + thumb
    const hand = node(wrist, [0, 0, 0]);
    mesh(new THREE.SphereGeometry(1, 10, 8), M.skin, hand, [0, -0.038, 0], null, [0.017, 0.042, 0.033]);
    const fingers = node(hand, [0, -0.068, 0]);
    mesh(new THREE.CapsuleGeometry(0.013, 0.04, 3, 8), M.skin, fingers, [0, -0.026, 0], null, [1, 1, 2.1]);
    const thumb = node(hand, [s * -0.004, -0.03, 0.026]);
    mesh(new THREE.CapsuleGeometry(0.0085, 0.03, 3, 6), M.skin, thumb, [0, -0.018, 0.006], [0.5, 0, 0]);
    arms[side] = { s, shoulder, elbow, wrist, hand, fingers, thumb };
  }
  // microphone in her right hand
  const mic = node(arms.R.hand, [0, -0.06, 0.0]);
  mesh(new THREE.CylinderGeometry(0.0135, 0.0105, 0.17, 12), M.black, mic, [0, 0.03, 0]);
  mesh(new THREE.CylinderGeometry(0.0175, 0.0145, 0.025, 14), M.silver, mic, [0, 0.118, 0]);
  mesh(new THREE.SphereGeometry(0.024, 16, 12), M.silver, mic, [0, 0.14, 0]);
  mesh(new THREE.SphereGeometry(0.0245, 10, 8), new THREE.MeshStandardMaterial({ color: '#555', wireframe: true }), mic, [0, 0.14, 0]);

  // ---- legs ----
  const legs = {};
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const thigh = node(hips, [s * 0.088, -0.03, 0]);
    mesh(limbGeometry(LEG_UPPER, [[0, 0.084], [0.45, 0.07], [1, 0.049]], { radial: 12 }), M.skin, thigh);
    const knee = node(thigh, [0, -LEG_UPPER, 0]);
    mesh(new THREE.SphereGeometry(0.046, 10, 8), M.skin, knee);
    mesh(limbGeometry(LEG_LOWER, [[0, 0.046], [0.25, 0.053], [0.65, 0.038], [1, 0.03]], { radial: 12 }), M.skin, knee);
    const ankle = node(knee, [0, -LEG_LOWER, 0]);
    if (P.outfit === 'mini') {
      // yellow boots up the calf
      mesh(limbGeometry(0.25, [[0, 0.056], [0.3, 0.054], [1, 0.04]], { radial: 12 }), M.boots, knee, [0, -0.19, 0]);
    }
    const foot = node(ankle, [0, 0, 0]);
    mesh(new THREE.CapsuleGeometry(0.033, 0.1, 4, 10), M.boots, foot, [0, -0.058, 0.055], [Math.PI / 2 - 0.35, 0, 0], [1, 1, 0.75]);
    mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.07, 6), M.boots, foot, [0, -0.06, -0.02]);
    legs[side] = { s, thigh, knee, ankle, foot };
  }

  if (P.outfit === 'gown') for (const L of Object.values(legs)) { L.thigh.children.filter((c) => c.isMesh).forEach((m) => (m.visible = false)); L.knee.children.filter((c) => c.isMesh).forEach((m) => (m.visible = false)); }
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  // ========================================================================================
  // animation
  const tmpQ = new THREE.Quaternion();
  const curArm = { L: new THREE.Vector3(), R: new THREE.Vector3() };

  function armTarget(name, side) {
    const p = ARM_POSES[name] || ARM_POSES.down;
    const v = p[side] || ARM_POSES.down[side];
    return new THREE.Vector3(...v);
  }
  function poleFor(name, s) {
    if (name === 'hip') return POLE.hip(s);
    if (name === 'up' || name === 'wave' || name === 'point' || name === 'shield') return POLE.up(s);
    return POLE.default(s);
  }

  function setArm(side, target, pole) {
    const A = arms[side];
    const S = A.shoulder.position.clone();
    const { E, W } = solve2(S, target, ARM_UPPER, ARM_FORE, pole);
    const dU = E.clone().sub(S).normalize();
    const qU = aimDown(dU);
    A.shoulder.quaternion.copy(qU);
    const dF = W.clone().sub(E).normalize();
    const dFl = dF.clone().applyQuaternion(qU.clone().invert());
    A.elbow.quaternion.copy(aimDown(dFl));
    return { E, W };
  }

  function headAngles(t, perf) {
    const b = perf.beat ?? t * 1.6;
    const yaw = Math.sin(t * 0.45 + 0.6) * 0.18 + (perf.headYaw || 0);
    const pitch = Math.sin(b * Math.PI * 2) * 0.035 * (perf.dance ?? 1) - 0.04 + (perf.headPitch || 0) - (perf.mouth || 0) * 0.06;
    const roll = Math.sin(t * 0.7 + 1.1) * 0.08 + Math.sin(b * Math.PI) * 0.04 * (perf.dance ?? 1);
    return { yaw, pitch, roll };
  }

  function update(t, perf = {}) {
    const dance = perf.dance ?? 1;
    const beat = perf.beat ?? t * 1.6;
    const ph = beat * Math.PI; // one sway cycle per two beats
    const bounce = Math.pow(Math.abs(Math.sin(beat * Math.PI)), 2.0);

    // hips / spine
    const sway = Math.sin(ph) * dance;
    hips.position.set(sway * 0.035 + (perf.hipX || 0), 0.96 - bounce * 0.02 * dance - (perf.crouch || 0), 0);
    hips.rotation.set(0.02, Math.sin(ph * 0.5) * 0.12 * dance, -sway * 0.07);
    spine.rotation.set(0.03 + (perf.lean || 0), Math.sin(ph * 0.5 + 0.5) * 0.06 * dance, sway * 0.09);
    chest.rotation.set(-0.03, Math.sin(ph * 0.5 + 1) * 0.05 * dance, sway * 0.03);

    // legs: planted feet via IK, in hips-local space
    hips.updateMatrix();
    const hipsInv = hips.matrix.clone().invert();
    const hop = perf.hop || 0;
    for (const side of ['L', 'R']) {
      const L = legs[side];
      const lift = side === 'L' ? Math.max(0, Math.sin(t * 7)) * hop : Math.max(0, -Math.sin(t * 7)) * hop;
      const footW = new THREE.Vector3(L.s * (0.11 + (perf.stance || 0)), 0.085 + lift * 0.12, (side === 'L' ? 0.04 : -0.02) + lift * 0.04);
      const footH = footW.applyMatrix4(hipsInv);
      const S = L.thigh.position.clone();
      const pole = new THREE.Vector3(L.s * 0.15, 0, 1);
      const { E, W } = solve2(S, footH, LEG_UPPER, LEG_LOWER, pole);
      const qU = aimDown(E.clone().sub(S));
      L.thigh.quaternion.copy(qU);
      const dF = W.clone().sub(E).normalize().applyQuaternion(qU.clone().invert());
      L.knee.quaternion.copy(aimDown(dF));
      // keep feet level with the ground
      L.thigh.updateMatrixWorld(true);
      const kneeWorldQ = new THREE.Quaternion();
      L.ankle.getWorldQuaternion(kneeWorldQ);
      const groupQ = new THREE.Quaternion();
      group.getWorldQuaternion(groupQ);
      L.foot.quaternion.copy(kneeWorldQ.invert().multiply(groupQ));
    }

    // arms: pose blend
    const sideAmp = (side) => (side === 'L' ? 1 : -1);
    for (const side of ['L', 'R']) {
      const spec = side === 'L' ? (perf.armL || 'hip') : (perf.armR || 'mic');
      const specB = side === 'L' ? perf.armL2 : perf.armR2;
      const w = side === 'L' ? (perf.armLw ?? 0) : (perf.armRw ?? 0);
      let tgt = armTarget(spec, side);
      let pole = poleFor(spec, sideAmp(side));
      if (specB && w > 0) {
        tgt.lerp(armTarget(specB, side), smooth(w));
        pole.lerp(poleFor(specB, sideAmp(side)), smooth(w));
      }
      // groove
      const g = Math.sin(ph + (side === 'L' ? 0 : 1.7)) * 0.02 * dance;
      tgt.x += g; tgt.y += Math.abs(Math.sin(ph)) * 0.015 * dance;
      if (spec === 'wave' || specB === 'wave') tgt.x += Math.sin(t * 5) * 0.08 * (specB === 'wave' ? w : 1);
      if (spec === 'up' && side === 'L') tgt.x += Math.sin(ph) * 0.04;
      curArm[side].copy(tgt);
      setArm(side, tgt, pole);
      const A = arms[side];
      // hand orientation: follow forearm, slight flex
      A.hand.rotation.set(-0.15, 0, sideAmp(side) * 0.1);
      const curl = side === 'R' ? 1.35 : (spec === 'hip' ? 0.6 : spec === 'heart' ? 1.1 : 0.25);
      A.fingers.rotation.set(curl, 0, 0);
    }

    // head looks toward camera / target
    const h = headAngles(t, perf);
    let yaw = h.yaw, pitch = h.pitch;
    if (perf.look) {
      group.updateMatrixWorld(true);
      const hp = new THREE.Vector3(); neck.getWorldPosition(hp);
      const lookL = perf.look.clone().sub(hp);
      const gq = new THREE.Quaternion(); chest.getWorldQuaternion(gq);
      lookL.applyQuaternion(gq.invert());
      const ly = Math.atan2(lookL.x, lookL.z);
      const lp = Math.atan2(lookL.y, Math.hypot(lookL.x, lookL.z));
      const k = perf.lookAmt ?? 0.65;
      yaw = lerp(yaw, clamp(ly, -0.7, 0.7), k);
      pitch = lerp(pitch, clamp(lp + 0.05, -0.35, 0.4), k * 0.8);
    }
    neck.rotation.set(-pitch * 0.4, yaw * 0.4, h.roll * 0.4);
    head.rotation.set(-pitch * 0.6, yaw * 0.6, h.roll * 0.6);

    // hair secondary motion (lag behind head)
    const hp = headAngles(t - 0.14, perf);
    const dYaw = (hp.yaw - h.yaw), dRoll = (hp.roll - h.roll), dPitch = (hp.pitch - h.pitch);
    const wind = perf.wind || 0;
    for (const L of locks) {
      const sAmt = L.amt * (1 + wind * 3);
      L.pivot.rotation.set(
        (Math.sin(t * 1.9 + L.phase) * 0.03 + dPitch * 1.2 + wind * 0.25 * Math.sin(t * 6 + L.phase)) * sAmt,
        dYaw * 0.6 * sAmt,
        (Math.sin(t * 1.4 + L.phase * 1.3) * 0.035 - dRoll * 1.5 - (hips.rotation.z + spine.rotation.z) * 0.5 + wind * 0.3) * sAmt * (L.base.x >= 0 ? 1 : 1)
      );
    }

    // mouth / lip sync
    const open = clamp(perf.mouth || 0);
    const vowel = perf.vowel || 'a';
    const round = vowel === 'u' || vowel === 'o' ? 1 : 0;
    const wide = vowel === 'i' || vowel === 'e' ? 1 : 0;
    jaw.position.y = -open * 0.017;
    interior.scale.set(0.02 * (1 - round * 0.35 + wide * 0.15), 0.003 + open * 0.0105, 0.006);
    interior.position.y = -open * 0.008;
    teeth.visible = open > 0.15 && !round;
    upperLip.scale.x = 0.025 * (1 - round * 0.28 + wide * 0.08);
    lowerLip.scale.x = 0.023 * (1 - round * 0.28 + wide * 0.08);
    upperLip.position.y = 0.0055 + open * 0.0015;

    // blink (deterministic)
    const bt = (t + 0.37) % 3.9;
    const blink = bt < 0.14 ? Math.sin((bt / 0.14) * Math.PI) : 0;
    const eyesClosed = perf.eyesClosed || 0;
    for (const E of eyes) E.lid.rotation.x = lerp(-0.62, 1.45, Math.max(blink, eyesClosed));

    // mic aims at mouth when in mic pose
    const micAim = (perf.armR || 'mic') === 'mic' ? 1 - (perf.armRw || 0) : (perf.armR2 === 'mic' ? perf.armRw : 0);
    group.updateMatrixWorld(true);
    const mouthW = new THREE.Vector3(); mouth.getWorldPosition(mouthW);
    const micW = new THREE.Vector3(); mic.getWorldPosition(micW);
    const handQ = new THREE.Quaternion(); arms.R.hand.getWorldQuaternion(handQ);
    const dirW = mouthW.sub(micW).normalize();
    const qAim = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirW);
    const local = handQ.clone().invert().multiply(qAim);
    const neutral = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    mic.quaternion.copy(neutral).slerp(local, clamp(micAim));

    // sequin twinkle
    if (sparkleTex) {
      const f = Math.floor(t * 15);
      sparkleTex.offset.set(((f * 0.618) % 1), ((f * 0.382) % 1));
      M.dress.emissiveIntensity = 1.0 + 0.6 * (perf.sparkle ?? 1);
    }
  }

  function setWet(w) {
    for (const m of M.hair) m.roughness = lerp(0.55, 0.25, w);
    M.skin.roughness = lerp(0.55, 0.3, w);
  }

  return { group, update, setWet, materials: M, bones: { root, hips, spine, chest, neck, head, arms, legs, mouth, mic }, preset: P };
}
