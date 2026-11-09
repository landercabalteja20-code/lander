// Instanced crowds. Each species is a set of parts (one InstancedMesh per part) animated per instance
// from (t, beat, energy). Also: a "light sea" of thousands of glowing lightsticks for far crowds.
import * as THREE from 'three';
import { rng, std } from './util.js';

const _m = new THREE.Matrix4(), _r = new THREE.Matrix4(), _p = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function M(pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
  return new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scl));
}
function A(pos, rot, scl = [1, 1, 1]) {
  _e.set(rot[0], rot[1], rot[2]); _q.setFromEuler(_e);
  return _m.compose(_v.set(pos[0], pos[1], pos[2]), _q, _s.set(scl[0], scl[1], scl[2]));
}
const glow = (c, k = 3) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) });

// ---------------------------------------------------------------------------------------------
// species: return { parts: [{ geo, mat, base: Matrix4, color?: (i,R)=>Color, anim?: (c, t, beat, e) => Matrix4 }], jump, float }
const SPECIES = {
  // Zorb Prime: purple/teal blobs, one big eye, THREE arms (two clapping + one holding a lightstick)
  blob: ({ palette = ['#8e5cff', '#3fd6c6', '#ff6fb5', '#6f8bff'], stick = ['#ff4fd8', '#4ff0ff', '#ffe14f'] } = {}) => ({
    jump: 0.35,
    parts: [
      { geo: new THREE.SphereGeometry(0.5, 14, 10), mat: std('#ffffff', { roughness: 0.45 }), base: M([0, 0.62, 0], [0, 0, 0], [1, 1.2, 0.95]), color: (i, R) => new THREE.Color(palette[Math.floor(R() * palette.length)]) },
      { geo: new THREE.SphereGeometry(0.2, 12, 8), mat: std('#f7f7f2', { roughness: 0.3 }), base: M([0, 0.88, 0.4], [0, 0, 0], [1, 1, 0.6]) },
      { geo: new THREE.SphereGeometry(0.1, 10, 6), mat: std('#111', { roughness: 0.2 }), base: M([0, 0.88, 0.52], [0, 0, 0], [1, 1, 0.5]) },
      // clapping arms: swing toward each other on the beat
      { geo: new THREE.CapsuleGeometry(0.07, 0.45, 3, 6), mat: std('#ffffff', { roughness: 0.5 }), base: M([0.42, 0.75, 0.1]), color: (i, R, body) => body, anim: (c, t, b) => A([0, 0, 0], [-0.9, 0, -0.6 + Math.pow(Math.abs(Math.sin(b * Math.PI * 2 + c.ph)), 4) * 0.9]) },
      { geo: new THREE.CapsuleGeometry(0.07, 0.45, 3, 6), mat: std('#ffffff', { roughness: 0.5 }), base: M([-0.42, 0.75, 0.1]), color: (i, R, body) => body, anim: (c, t, b) => A([0, 0, 0], [-0.9, 0, 0.6 - Math.pow(Math.abs(Math.sin(b * Math.PI * 2 + c.ph)), 4) * 0.9]) },
      // third arm up top, waving a lightstick
      { geo: new THREE.CapsuleGeometry(0.06, 0.5, 3, 6), mat: std('#ffffff', { roughness: 0.5 }), base: M([0, 1.25, 0]), color: (i, R, body) => body, anim: (c, t, b) => A([0, 0.25, 0], [0, 0, Math.sin(b * Math.PI + c.ph) * 0.5], [1, 1, 1]) },
      { geo: new THREE.CylinderGeometry(0.06, 0.06, 0.55, 6), mat: new THREE.MeshBasicMaterial({ color: '#ffffff' }), base: M([0, 1.25, 0]), color: (i, R) => new THREE.Color(stick[i % stick.length]).multiplyScalar(4), anim: (c, t, b) => { const a = Math.sin(b * Math.PI + c.ph) * 0.5; return A([-Math.sin(a) * 0.55, 0.25 + Math.cos(a) * 0.55, 0], [0, 0, a]); } },
    ],
  }),
  // Glacia: faceted ice beings that bounce and flap
  crystal: () => ({
    jump: 0.25,
    parts: [
      { geo: new THREE.OctahedronGeometry(0.55, 0), mat: new THREE.MeshStandardMaterial({ color: '#bfe9ff', roughness: 0.1, metalness: 0.3, flatShading: true, emissive: '#2a6aa0', emissiveIntensity: 0.4 }), base: M([0, 0.75, 0], [0, 0.4, 0], [0.8, 1.35, 0.8]), color: (i, R) => new THREE.Color().setHSL(0.53 + R() * 0.08, 0.6, 0.75 + R() * 0.15) },
      { geo: new THREE.SphereGeometry(0.07, 8, 6), mat: std('#0a1a2a'), base: M([0.13, 1.0, 0.33]) },
      { geo: new THREE.SphereGeometry(0.07, 8, 6), mat: std('#0a1a2a'), base: M([-0.13, 1.0, 0.33]) },
      { geo: new THREE.BoxGeometry(0.08, 0.45, 0.2), mat: new THREE.MeshStandardMaterial({ color: '#9fd8ff', flatShading: true, roughness: 0.2 }), base: M([0.42, 0.85, 0]), anim: (c, t, b) => A([0, -0.2, 0], [0, 0, -0.3 - Math.abs(Math.sin(b * Math.PI + c.ph)) * 1.2]) },
      { geo: new THREE.BoxGeometry(0.08, 0.45, 0.2), mat: new THREE.MeshStandardMaterial({ color: '#9fd8ff', flatShading: true, roughness: 0.2 }), base: M([-0.42, 0.85, 0]), anim: (c, t, b) => A([0, -0.2, 0], [0, 0, 0.3 + Math.abs(Math.sin(b * Math.PI + c.ph)) * 1.2]) },
    ],
  }),
  // Nimbus: floating jellyfish with glowing bells
  jelly: ({ palette = ['#ff7ad9', '#7af0ff', '#b38bff', '#ffb27a'] } = {}) => {
    const tent = (() => {
      const geos = [];
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        const g = new THREE.CylinderGeometry(0.03, 0.008, 1.8, 4); g.translate(Math.cos(a) * 0.28, -0.9, Math.sin(a) * 0.28); geos.push(g);
      }
      return mergeGeos(geos);
    })();
    return {
      jump: 0, float: true,
      parts: [
        { geo: new THREE.SphereGeometry(0.6, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mat: new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, roughness: 0.2, emissive: '#ffffff', emissiveIntensity: 0.6, side: THREE.DoubleSide }), base: M([0, 0, 0]), color: (i, R) => new THREE.Color(palette[i % palette.length]), anim: (c, t, b) => { const p = 1 + Math.sin(t * 3 + c.ph) * 0.08; return A([0, 0, 0], [0, 0, 0], [p, 1 / p, p]); } },
        { geo: new THREE.SphereGeometry(0.22, 10, 8), mat: new THREE.MeshBasicMaterial({ color: '#ffffff' }), base: M([0, 0.05, 0]), color: (i, R) => new THREE.Color(palette[i % palette.length]).multiplyScalar(3.5) },
        { geo: tent, mat: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.8, transparent: true, opacity: 0.7 }), base: M([0, 0.05, 0]), color: (i, R) => new THREE.Color(palette[i % palette.length]), anim: (c, t) => A([0, 0, 0], [Math.sin(t * 2 + c.ph) * 0.15, 0, Math.cos(t * 1.7 + c.ph) * 0.15]) },
      ],
    };
  },
  // Vulcara: rock golems with glowing eyes, fist-pumping
  golem: () => ({
    jump: 0.15,
    parts: [
      { geo: new THREE.DodecahedronGeometry(0.6, 0), mat: new THREE.MeshStandardMaterial({ color: '#2a2422', roughness: 0.95, flatShading: true }), base: M([0, 0.75, 0], [0.2, 0.3, 0], [1, 1.15, 0.9]) },
      { geo: new THREE.DodecahedronGeometry(0.36, 0), mat: new THREE.MeshStandardMaterial({ color: '#332b28', roughness: 0.95, flatShading: true }), base: M([0, 1.55, 0.05]) },
      { geo: new THREE.BoxGeometry(0.34, 0.06, 0.05), mat: glow('#ff8a2a', 5), base: M([0, 1.6, 0.33]) },
      { geo: new THREE.SphereGeometry(0.48, 8, 6), mat: glow('#ff5a14', 2.2), base: M([0, 0.8, 0.12], [0, 0, 0], [0.8, 0.9, 0.7]) },
      { geo: new THREE.DodecahedronGeometry(0.22, 0), mat: new THREE.MeshStandardMaterial({ color: '#2a2422', roughness: 0.95, flatShading: true }), base: M([0.62, 1.3, 0.1]), anim: (c, t, b) => A([0, Math.pow(Math.abs(Math.sin(b * Math.PI + c.ph)), 2) * 0.7, 0], [0, 0, 0]) },
      { geo: new THREE.DodecahedronGeometry(0.22, 0), mat: new THREE.MeshStandardMaterial({ color: '#2a2422', roughness: 0.95, flatShading: true }), base: M([-0.62, 1.0, 0.1]) },
    ],
  }),
  // Tri-Sol: tall thin desert beings in sunglasses
  tall: ({ palette = ['#e0b07a', '#c98b5a', '#f0cf98', '#b97d4e'] } = {}) => ({
    jump: 0.2,
    parts: [
      { geo: new THREE.CylinderGeometry(0.14, 0.22, 2.4, 8), mat: std('#ffffff', { roughness: 0.8 }), base: M([0, 1.2, 0]), color: (i, R) => new THREE.Color(palette[Math.floor(R() * palette.length)]) },
      { geo: new THREE.SphereGeometry(0.26, 12, 8), mat: std('#ffffff', { roughness: 0.7 }), base: M([0, 2.6, 0], [0, 0, 0], [1, 1.25, 1]), color: (i, R, body) => body },
      { geo: new THREE.BoxGeometry(0.42, 0.09, 0.08), mat: std('#0b0b0d', { roughness: 0.1, metalness: 0.6 }), base: M([0, 2.66, 0.22]) },
      { geo: new THREE.CylinderGeometry(0.04, 0.04, 1.1, 5), mat: std('#ffffff'), base: M([0.18, 2.0, 0]), color: (i, R, body) => body, anim: (c, t, b) => A([0, 0, 0], [0, 0, -2.6 + Math.sin(b * Math.PI + c.ph) * 0.4]).multiply(_p.makeTranslation(0, 0.55, 0)) },
      { geo: new THREE.CylinderGeometry(0.04, 0.04, 1.1, 5), mat: std('#ffffff'), base: M([-0.18, 2.0, 0]), color: (i, R, body) => body, anim: (c, t, b) => A([0, 0, 0], [0, 0, 2.6 - Math.sin(b * Math.PI + c.ph + 1) * 0.4]).multiply(_p.makeTranslation(0, 0.55, 0)) },
    ],
  }),
  // Myco: glowing mushrooms swaying together
  mushroom: ({ palette = ['#4dffd2', '#8bff6a', '#5ab8ff', '#d87bff'] } = {}) => ({
    jump: 0,
    parts: [
      { geo: new THREE.CylinderGeometry(0.12, 0.2, 1.2, 8), mat: std('#e8e0cf', { roughness: 0.8 }), base: M([0, 0.6, 0]), anim: (c, t, b) => A([0, 0, 0], [0, 0, Math.sin(b * Math.PI * 0.5) * 0.12]) },
      { geo: new THREE.SphereGeometry(0.55, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), mat: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.4, roughness: 0.4 }), base: M([0, 1.15, 0], [0, 0, 0], [1, 0.7, 1]), color: (i, R) => new THREE.Color(palette[i % palette.length]).multiplyScalar(0.8), anim: (c, t, b) => { const s = 1 + Math.pow(1 - (b % 1), 3) * 0.12; return A([Math.sin(b * Math.PI * 0.5) * 0.14, 0, 0], [0, 0, Math.sin(b * Math.PI * 0.5) * 0.12], [s, s, s]); } },
    ],
  }),
  // Pluto: tiny round fans with big eyes and tiny lightsticks
  tiny: ({ palette = ['#f2d8cf', '#e8c6b8', '#fbe9e2', '#d9b2a5'] } = {}) => ({
    jump: 0.25,
    parts: [
      { geo: new THREE.SphereGeometry(0.28, 12, 8), mat: std('#ffffff', { roughness: 0.6 }), base: M([0, 0.3, 0]), color: (i, R) => new THREE.Color(palette[Math.floor(R() * palette.length)]) },
      { geo: new THREE.SphereGeometry(0.075, 8, 6), mat: std('#101010', { roughness: 0.15 }), base: M([0.09, 0.38, 0.23]) },
      { geo: new THREE.SphereGeometry(0.075, 8, 6), mat: std('#101010', { roughness: 0.15 }), base: M([-0.09, 0.38, 0.23]) },
      { geo: new THREE.CylinderGeometry(0.025, 0.025, 0.3, 5), mat: new THREE.MeshBasicMaterial({ color: '#ffffff' }), base: M([0.24, 0.55, 0.05]), color: (i) => new THREE.Color(['#ff77c8', '#7fe9ff', '#fff07a'][i % 3]).multiplyScalar(4), anim: (c, t, b) => A([0, 0, 0], [0, 0, Math.sin(b * Math.PI + c.ph) * 0.6]) },
    ],
  }),
  // Earth: ordinary people. Some hold umbrellas, many stare at phones.
  human: ({ clothes = ['#2f3b4c', '#6a2f2f', '#2f4f3a', '#4a4a52', '#7a6a4a', '#1f1f24', '#5a3f6a', '#8a8f96'], skins = ['#f1c7a5', '#c98f68', '#8d5a3b', '#e0aa84', '#5b3a29'], umbrella = 0.45, phone = 0.6 } = {}) => {
    const umb = (() => { const c = new THREE.ConeGeometry(0.6, 0.28, 8, 1, true); c.translate(0, 2.15, 0); const s = new THREE.CylinderGeometry(0.012, 0.012, 1.0, 4); s.translate(0.0, 1.7, 0); return mergeGeos([c, s]); })();
    return {
      jump: 0.0,
      parts: [
        { geo: new THREE.BoxGeometry(0.3, 0.85, 0.2), mat: std('#24262c', { roughness: 0.9 }), base: M([0, 0.43, 0]) },
        { geo: new THREE.BoxGeometry(0.42, 0.62, 0.26), mat: std('#ffffff', { roughness: 0.85 }), base: M([0, 1.15, 0]), color: (i, R) => new THREE.Color(clothes[Math.floor(R() * clothes.length)]) },
        { geo: new THREE.SphereGeometry(0.13, 10, 8), mat: std('#ffffff', { roughness: 0.7 }), base: M([0, 1.6, 0], [0, 0, 0], [1, 1.12, 1]), color: (i, R) => new THREE.Color(skins[Math.floor(R() * skins.length)]), anim: (c, t) => A([0, 0, 0], [c.phone ? 0.45 : Math.sin(t * 0.4 + c.ph) * 0.06, Math.sin(t * 0.3 + c.ph) * 0.25, 0]) },
        { geo: new THREE.SphereGeometry(0.14, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), mat: std('#ffffff', { roughness: 0.9 }), base: M([0, 1.63, -0.01]), color: (i, R) => new THREE.Color(['#1b1410', '#3a2618', '#6b4a2a', '#c9a86a', '#2a2a2a', '#8a8a8a'][Math.floor(R() * 6)]), anim: (c, t) => A([0, 0, 0], [c.phone ? 0.45 : Math.sin(t * 0.4 + c.ph) * 0.06, Math.sin(t * 0.3 + c.ph) * 0.25, 0]) },
        { geo: new THREE.BoxGeometry(0.11, 0.55, 0.11), mat: std('#ffffff', { roughness: 0.85 }), base: M([0.27, 1.2, 0]), color: (i, R, body) => body, anim: (c) => (c.phone ? A([0, 0.25, 0.05], [-1.2, 0, 0]).multiply(_p.makeTranslation(0, -0.25, 0)) : c.umb ? A([0, 0.25, 0.05], [-0.9, 0, 0.2]).multiply(_p.makeTranslation(0, -0.25, 0)) : A([0, 0, 0], [0, 0, 0.05])) },
        { geo: new THREE.BoxGeometry(0.11, 0.55, 0.11), mat: std('#ffffff', { roughness: 0.85 }), base: M([-0.27, 1.2, 0]), color: (i, R, body) => body, anim: (c) => (c.phone ? A([0, 0.25, 0.05], [-1.2, 0, 0]).multiply(_p.makeTranslation(0, -0.25, 0)) : A([0, 0, 0], [0, 0, -0.05])) },
        { geo: new THREE.BoxGeometry(0.08, 0.15, 0.015), mat: glow('#cfe3ff', 1.8), base: M([0, 1.32, 0.42], [-0.6, 0, 0]), show: (c) => c.phone },
        { geo: umb, mat: std('#ffffff', { roughness: 0.6, side: THREE.DoubleSide }), base: M([0.2, 0, 0.05]), color: (i, R) => new THREE.Color(['#1a1a1e', '#c22a2a', '#2a5ac2', '#e0c02a', '#2a2a2a', '#7a2ac2'][Math.floor(R() * 6)]), show: (c) => c.umb },
      ],
      init: (c, R) => { c.umb = R() < umbrella; c.phone = !c.umb && R() < phone; },
    };
  },
};

export function mergeGeos(geos) {
  // minimal merge (positions, normals, uvs) for indexed or non-indexed geometries
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0; parts.forEach((g) => (n += g.attributes.position.count));
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of parts) {
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

// placement: array of {x, z, y?} or a function (i, R) => {x, z, y?}
export function createCrowd({ species = 'blob', count = 500, place, face = [0, 0], scale = [0.9, 1.15], seed = 1, speciesOpts = {}, ground = () => 0, energy = 1, shadows = false } = {}) {
  const R = rng(seed);
  const def = SPECIES[species](speciesOpts);
  const grp = new THREE.Group();
  const members = [];
  for (let i = 0; i < count; i++) {
    const p = typeof place === 'function' ? place(i, R) : place[i % place.length];
    const c = { x: p.x, z: p.z, y: p.y ?? ground(p.x, p.z), s: R.range(scale[0], scale[1]), ph: R() * 6.28, yaw: 0 };
    c.yaw = Math.atan2(face[0] - c.x, face[1] - c.z) + (R() - 0.5) * 0.5;
    if (def.init) def.init(c, R);
    members.push(c);
  }
  const meshes = def.parts.map((part) => {
    const im = new THREE.InstancedMesh(part.geo, part.mat, count);
    im.castShadow = shadows; im.receiveShadow = shadows;
    im.frustumCulled = false;
    grp.add(im);
    return im;
  });
  // colours (body colour passed to dependent parts)
  const Rc = rng(seed + 77);
  members.forEach((c, i) => {
    let body = null;
    def.parts.forEach((part, k) => {
      if (part.color) {
        const col = part.color(i, Rc, body);
        if (k === 0 || !body) body = col;
        meshes[k].setColorAt(i, col);
      }
    });
  });
  meshes.forEach((m) => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });

  const root = new THREE.Matrix4(), tmp = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  function update(t, beat = t * 1.6, e = energy) {
    for (let i = 0; i < members.length; i++) {
      const c = members[i];
      const bounce = def.float ? Math.sin(t * 0.9 + c.ph) * 0.4 + Math.sin(beat * Math.PI) * 0.1 : Math.pow(Math.abs(Math.sin(beat * Math.PI + c.ph * 0.15)), 2) * def.jump * e;
      _e.set(0, c.yaw, Math.sin(beat * Math.PI + c.ph) * 0.06 * e); _q.setFromEuler(_e);
      root.compose(_v.set(c.x, c.y + bounce * c.s, c.z), _q, _s.set(c.s, c.s, c.s));
      for (let k = 0; k < def.parts.length; k++) {
        const part = def.parts[k];
        if (part.show && !part.show(c)) { meshes[k].setMatrixAt(i, zero); continue; }
        tmp.multiplyMatrices(root, part.base);
        if (part.anim) tmp.multiply(part.anim(c, t, beat, e));
        meshes[k].setMatrixAt(i, tmp);
      }
    }
    meshes.forEach((m) => (m.instanceMatrix.needsUpdate = true));
  }
  update(0);
  return { group: grp, update, members };
}

// Thousands of glowing lightstick points swaying to the beat (far crowd / "billions of fans").
export function createLightSea({ count = 20000, place, seed = 2, colors = ['#ff4fd8', '#4ff0ff', '#ffe14f', '#9b6bff'], size = 9, sway = 0.4 } = {}) {
  const R = rng(seed);
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), ph = new Float32Array(count);
  const cs = colors.map((c) => new THREE.Color(c));
  for (let i = 0; i < count; i++) {
    const p = place(i, R);
    pos.set([p.x, p.y ?? 0, p.z], i * 3);
    const c = cs[i % cs.length]; col.set([c.r, c.g, c.b], i * 3); ph[i] = R() * 6.28;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    uniforms: { uTime: { value: 0 }, uBeat: { value: 0 }, uSize: { value: size }, uScale: { value: 1 }, uSway: { value: sway } },
    vertexShader: `attribute float phase; uniform float uTime, uBeat, uSize, uScale, uSway; varying vec3 vC; varying float vA;
      void main(){ vec3 p = position; float w = sin(uBeat * 3.14159 + phase * 0.3 + p.x * 0.02);
        p.x += w * uSway; p.y += abs(w) * uSway * 0.6;
        vC = color; vA = 0.65 + 0.35 * sin(uTime * 4.0 + phase * 7.0);
        vec4 mv = modelViewMatrix * vec4(p,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uSize * uScale * 40.0 / max(-mv.z, 1.0); }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC * 2.5, a * vA); }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.userData.update = (t, beat, H = 1920) => { mat.uniforms.uTime.value = t; mat.uniforms.uBeat.value = beat; mat.uniforms.uScale.value = H / 1920; };
  return pts;
}
