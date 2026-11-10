// Procedural props and set pieces (all original geometry + canvas textures).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o });
export const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.6, metalness: 0, ...o });
export function mesh(geo, mat, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, cast = true, recv = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(...s);
  m.castShadow = cast; m.receiveShadow = recv;
  return m;
}
export const rbox = (w, h, d, r = 0.02, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999);

// seeded random
export function rng(seed = 1) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function canvasTex(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------------ textures
export function woodFloorTex(base = '#b27a4b', repeat = [3, 3]) {
  return canvasTex(512, 512, (g, w, h) => {
    const r = rng(7);
    const rows = 8;
    for (let i = 0; i < rows; i++) {
      let x = -r() * 200;
      while (x < w) {
        const len = 160 + r() * 200;
        const c = new THREE.Color(base).offsetHSL((r() - 0.5) * 0.02, (r() - 0.5) * 0.1, (r() - 0.5) * 0.12);
        g.fillStyle = `#${c.getHexString()}`; g.fillRect(x, i * h / rows, len, h / rows);
        g.globalAlpha = 0.12;
        for (let k = 0; k < 14; k++) { g.fillStyle = r() > 0.5 ? '#000' : '#fff'; g.fillRect(x, i * h / rows + r() * h / rows, len, 1); }
        g.globalAlpha = 1;
        g.fillStyle = 'rgba(40,20,10,0.55)'; g.fillRect(x, i * h / rows, 2, h / rows);
        x += len;
      }
      g.fillStyle = 'rgba(40,20,10,0.6)'; g.fillRect(0, i * h / rows, w, 2);
    }
  }, { repeat });
}

export function stripeTex(a, b, n = 8, repeat = [1, 1], vertical = false) {
  return canvasTex(256, 256, (g, w, h) => {
    for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; if (vertical) g.fillRect(i * w / n, 0, w / n, h); else g.fillRect(0, i * h / n, w, h / n); }
  }, { repeat });
}

export function windowGridTex(wall = '#c9b8a2', glass = '#5c7590', cols = 6, rows = 10, lit = 0.15, seed = 3) {
  return canvasTex(512, 1024, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = wall; g.fillRect(0, 0, w, h);
    const cw = w / cols, ch = h / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const on = r() < lit;
      g.fillStyle = on ? '#ffe2a8' : glass;
      g.fillRect(i * cw + cw * 0.18, j * ch + ch * 0.2, cw * 0.64, ch * 0.6);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(i * cw + cw * 0.18, j * ch + ch * 0.2, cw * 0.64, ch * 0.08);
    }
  });
}

export function labelTex(text, { w = 512, h = 128, bg = '#d62f2f', fg = '#fff7e0', font = '900 86px Helvetica, Arial, sans-serif' } = {}) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4);
  });
}

// ------------------------------------------------------------------ bedroom pieces
export function alarmClock() {
  const g = new THREE.Group();
  g.add(mesh(rbox(0.2, 0.1, 0.08, 0.025), phys('#1d1f24', { roughness: 0.35, clearcoat: 0.6 }), { y: 0.05 }));
  const digits = canvasTex(256, 112, (c, w, h) => {
    c.fillStyle = '#060202'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ff2a1f'; c.font = 'bold 92px "DejaVu Sans Mono", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = '#ff2a1f'; c.shadowBlur = 12; c.fillText('5:00', w / 2, h / 2 + 4);
  });
  const face = mesh(new THREE.PlaneGeometry(0.16, 0.07), new THREE.MeshStandardMaterial({ map: digits, emissive: '#ffffff', emissiveMap: digits, emissiveIntensity: 2.2, roughness: 0.2 }), { y: 0.05, z: 0.0405, cast: false });
  g.add(face);
  return g;
}

export function bed({ duvet = '#7d9cc8', frame = '#8a5a3a' } = {}) {
  const g = new THREE.Group();
  const wood = phys(frame, { roughness: 0.55, clearcoat: 0.2 });
  g.add(mesh(rbox(1.7, 0.28, 2.2, 0.04), wood, { y: 0.2 }));                 // frame
  g.add(mesh(rbox(1.75, 1.0, 0.08, 0.04), wood, { y: 0.55, z: -1.12 }));       // headboard
  g.add(mesh(rbox(1.6, 0.22, 2.05, 0.08), phys('#f1eee8', { roughness: 0.9 }), { y: 0.42 }));  // mattress
  for (const x of [-0.4, 0.4]) g.add(mesh(rbox(0.62, 0.16, 0.4, 0.07, 4), phys('#fbfaf6', { roughness: 0.9, sheen: 0.6 }), { x, y: 0.6, z: -0.82, rx: -0.15 }));
  // duvet: a subdivided slab draped over a body-shaped bump
  const geo = new THREE.BoxGeometry(1.7, 0.08, 1.55, 60, 2, 60);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
    const body = Math.exp(-((x + 0.4) ** 2) / 0.07) * (0.2 + 0.06 * Math.exp(-((z + 0.25) ** 2) / 0.05));
    const knees = Math.exp(-((x + 0.38) ** 2) / 0.05 - ((z - 0.35) ** 2) / 0.04) * 0.07;
    const edge = Math.abs(x) > 0.8 ? -(Math.abs(x) - 0.8) * 3.5 : 0;
    const wrinkle = 0.01 * Math.sin(x * 23 + z * 7) * Math.sin(z * 13);
    p.setY(i, y + (y > 0 ? body + knees + wrinkle : 0) + edge * (y > 0 ? 1 : 1));
  }
  geo.computeVertexNormals();
  const tex = stripeTex('#7d9cc8', '#8eabd3', 16, [1, 1], true);
  g.add(mesh(geo, phys(duvet, { map: tex, roughness: 0.92, sheen: 0.8, sheenRoughness: 0.6, sheenColor: new THREE.Color('#dfe8ff') }), { y: 0.56, z: 0.22 }));
  return g;
}

export function nightstand() {
  const g = new THREE.Group();
  const wood = phys('#9a6a44', { roughness: 0.5, clearcoat: 0.25 });
  g.add(mesh(rbox(0.5, 0.55, 0.42, 0.02), wood, { y: 0.275 }));
  g.add(mesh(rbox(0.42, 0.18, 0.02, 0.01), phys('#b07c52', { roughness: 0.5 }), { y: 0.36, z: 0.215 }));
  g.add(mesh(new THREE.SphereGeometry(0.018, 16, 12), phys('#d9b26a', { metalness: 0.8, roughness: 0.3 }), { y: 0.36, z: 0.235 }));
  return g;
}

export function rug(r = 0.9, a = '#d7a74f', b = '#c4573c') {
  const tex = canvasTex(512, 512, (g, w, h) => {
    const rings = [a, b, '#efe2c4', b, a, '#efe2c4', b];
    rings.forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(w / 2, h / 2, w / 2 * (1 - i / rings.length), 0, Math.PI * 2); g.fill(); });
  });
  return mesh(new THREE.CylinderGeometry(r, r, 0.012, 64), phys('#ffffff', { map: tex, roughness: 0.95, sheen: 1, sheenRoughness: 0.7, sheenColor: new THREE.Color('#ffe9c0') }), { y: 0.006, cast: false });
}

// window in a wall at x = wallX facing -X, with sill and horizontal blinds (cast striped light)
export function windowWithBlinds({ w = 1.3, h = 1.25, sill = 0.92, open = 0.45 } = {}) {
  const g = new THREE.Group();
  const trim = phys('#f4f1ea', { roughness: 0.5 });
  g.add(mesh(rbox(0.36, 0.06, w + 0.2, 0.02), trim, { x: -0.1, y: sill - 0.03 }));   // sill (cat sits here)
  g.add(mesh(rbox(0.1, 0.08, w + 0.2, 0.02), trim, { x: 0.02, y: sill + h + 0.04 }));
  for (const s of [-1, 1]) g.add(mesh(rbox(0.1, h + 0.16, 0.08, 0.02), trim, { x: 0.02, y: sill + h / 2, z: s * (w / 2 + 0.04) }));
  g.add(mesh(rbox(0.06, 0.05, w, 0.01), trim, { x: 0.03, y: sill + h / 2 }));
  const slats = new THREE.Group();
  const slatMat = phys('#f7f3ea', { roughness: 0.6, side: THREE.DoubleSide });
  const n = 22;
  for (let i = 0; i < n * (1 - open * 0.0); i++) {
    const y = sill + h - 0.03 - i * (h / n) * (1 - open * 0.55);
    if (y < sill + h * open * 0.55 - 0.02 && i > 4) break;
    slats.add(mesh(new THREE.BoxGeometry(0.05, 0.004, w - 0.04), slatMat, { x: 0.06, y, rz: 0.55 }));
  }
  g.add(slats);
  return g;
}

// ------------------------------------------------------------------ terrain & nature
export function hills({ size = 700, seg = 180, color = '#6fae4b', seed = 3, height = (x, z) => 0 } = {}) {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const cols = new Float32Array(p.count * 3);
  const base = new THREE.Color(color), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const y = height(x, z);
    p.setY(i, y);
    const v = 0.5 + 0.5 * Math.sin(x * 0.09 + Math.sin(z * 0.05) * 2) * Math.sin(z * 0.07);
    c.copy(base).offsetHSL(0.015 * (v - 0.5), 0.05 * v, (v - 0.5) * 0.08 + y * 0.004);
    cols.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  return mesh(geo, std('#ffffff', { vertexColors: true, roughness: 0.95 }), { cast: false });
}

export function treeInstances(points, { trunk = '#6b4a2e', leaves = '#3f7f3a', scale = 1 } = {}) {
  const g = new THREE.Group();
  const n = points.length;
  const t = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.22, 2.2, 8).translate(0, 1.1, 0), std(trunk), n);
  const l = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.5, 2).translate(0, 3.0, 0), std(leaves, { roughness: 0.9, flatShading: false }), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  points.forEach(([x, y, z, k], i) => {
    const sc = (k ?? 1) * scale;
    m.compose(new THREE.Vector3(x, y, z), q, s.set(sc, sc * (0.9 + 0.3 * ((i * 7) % 5) / 5), sc));
    t.setMatrixAt(i, m); l.setMatrixAt(i, m);
  });
  t.castShadow = l.castShadow = true; t.receiveShadow = l.receiveShadow = true;
  g.add(t, l);
  return g;
}

export function barn() {
  const g = new THREE.Group();
  const red = std('#b23a2c', { roughness: 0.8 });
  g.add(mesh(new THREE.BoxGeometry(10, 6, 14), red, { y: 3 }));
  const roof = new THREE.Shape(); roof.moveTo(-5.6, 0); roof.lineTo(0, 3.6); roof.lineTo(5.6, 0); roof.lineTo(-5.6, 0);
  g.add(mesh(new THREE.ExtrudeGeometry(roof, { depth: 14.6, bevelEnabled: false }).translate(0, 0, -7.3), std('#5a5a5f'), { y: 6 }));
  g.add(mesh(new THREE.PlaneGeometry(4, 4.5), std('#f2ebe0'), { y: 2.25, z: 7.02 }));
  return g;
}

export function fenceLine(a, b, height, { n = 20, color = '#e9e2d4' } = {}) {
  const g = new THREE.Group();
  const mat = std(color, { roughness: 0.8 });
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  for (let i = 0; i <= n; i++) {
    const p = A.clone().lerp(B, i / n);
    g.add(mesh(new THREE.BoxGeometry(0.15, 1.3, 0.15), mat, { x: p.x, y: height(p.x, p.z) + 0.65, z: p.z }));
  }
  for (const h of [0.55, 1.05]) {
    const len = A.distanceTo(B);
    const mid = A.clone().lerp(B, 0.5);
    const rail = mesh(new THREE.BoxGeometry(len, 0.1, 0.06), mat, { x: mid.x, y: height(mid.x, mid.z) + h, z: mid.z });
    rail.rotation.y = -Math.atan2(B.z - A.z, B.x - A.x);
    g.add(rail);
  }
  return g;
}

// ------------------------------------------------------------------ food
function lathe(points, seg = 48) { return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg); }

export function burger(scale = 1) {
  const g = new THREE.Group();
  const bun = phys('#c9822f', { roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.4, sheenColor: new THREE.Color('#ffd9a0') });
  const top = []; for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI / 2; top.push([Math.cos(a) * 0.06, Math.sin(a) * 0.04]); }
  top.unshift([0.06, -0.006]); top.push([0.0001, 0.04]);
  g.add(mesh(lathe(top), bun, { y: 0.058 }));
  const seeds = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0035, 8, 6).scale(1, 0.5, 1.8), phys('#f6ecd2', { roughness: 0.5 }), 26);
  const r = rng(5), m = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 0.05, h = 0.04 * Math.sqrt(Math.max(0, 1 - (rr / 0.06) ** 2));
    q.setFromEuler(new THREE.Euler(-Math.asin(rr / 0.07) * Math.sin(a), r() * 3, Math.asin(rr / 0.07) * Math.cos(a)));
    m.compose(new THREE.Vector3(Math.cos(a) * rr, 0.058 + h, Math.sin(a) * rr), q, new THREE.Vector3(1, 1, 1));
    seeds.setMatrixAt(i, m);
  }
  g.add(seeds);
  const lettuce = new THREE.TorusGeometry(0.058, 0.007, 8, 64);
  const lp = lettuce.attributes.position;
  for (let i = 0; i < lp.count; i++) { const x = lp.getX(i), y = lp.getY(i); lp.setZ(i, lp.getZ(i) + 0.006 * Math.sin(Math.atan2(y, x) * 14)); }
  lettuce.computeVertexNormals();
  g.add(mesh(lettuce, phys('#5bb544', { roughness: 0.5, side: THREE.DoubleSide }), { y: 0.055, rx: Math.PI / 2 }));
  g.add(mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.008, 40), phys('#d63a2a', { roughness: 0.4, clearcoat: 0.4 }), { y: 0.05 }));
  const cheese = new THREE.BoxGeometry(0.11, 0.005, 0.11, 12, 1, 12);
  const cp = cheese.attributes.position;
  for (let i = 0; i < cp.count; i++) { const x = cp.getX(i), z = cp.getZ(i); const d = Math.max(Math.abs(x), Math.abs(z)); cp.setY(i, cp.getY(i) - Math.max(0, d - 0.045) * 0.6); }
  cheese.computeVertexNormals();
  g.add(mesh(cheese, phys('#f5b52a', { roughness: 0.35, clearcoat: 0.5 }), { y: 0.043, ry: 0.4 }));
  g.add(mesh(lathe([[0.0001, -0.013], [0.057, -0.013], [0.061, -0.008], [0.062, 0.0], [0.061, 0.008], [0.057, 0.013], [0.0001, 0.013]]),
    phys('#5a3220', { roughness: 0.85, sheen: 0.3 }), { y: 0.03 }));
  g.add(mesh(lathe([[0.0001, 0.0], [0.056, 0.0], [0.061, 0.006], [0.06, 0.014], [0.0001, 0.016]]), bun, { y: 0.0 }));
  g.scale.setScalar(scale);
  return g;
}

export function dogBowl() {
  const g = new THREE.Group();
  const prof = [[0.0001, 0], [0.16, 0], [0.2, 0.09], [0.19, 0.095], [0.15, 0.015], [0.0001, 0.015]];
  g.add(mesh(lathe(prof), phys('#d8433a', { roughness: 0.3, clearcoat: 0.8, metalness: 0.0 })));
  const n = 900, kib = new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 10, 8).scale(1, 0.65, 1), phys('#8a4f25', { roughness: 0.7 }), n);
  const r = rng(11), m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const rr = 0.19 * Math.sqrt(r()), a = r() * Math.PI * 2;
    const h = Math.max(0, 0.42 * (1 - rr / 0.19) ** 1.2) * r() ** 0.15 + 0.06;
    q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3));
    m.compose(new THREE.Vector3(Math.cos(a) * rr, h, Math.sin(a) * rr), q, new THREE.Vector3(1, 1, 1));
    kib.setMatrixAt(i, m); kib.setColorAt(i, c.set('#8a4f25').offsetHSL(0, 0, (r() - 0.5) * 0.12));
  }
  kib.castShadow = true; kib.receiveShadow = true;
  g.add(kib);
  // a bone and a string of sausages on top
  const bone = new THREE.Group();
  const bm = phys('#f1e7d2', { roughness: 0.6 });
  bone.add(mesh(new THREE.CapsuleGeometry(0.02, 0.16, 6, 12).rotateZ(Math.PI / 2), bm));
  for (const x of [-0.1, 0.1]) for (const z of [-0.022, 0.022]) bone.add(mesh(new THREE.SphereGeometry(0.03, 16, 12), bm, { x, z }));
  bone.position.set(0.02, 0.5, 0.0); bone.rotation.set(0.2, 0.6, 0.35);
  g.add(bone);
  const sm = phys('#b6542e', { roughness: 0.45, clearcoat: 0.5 });
  for (let i = 0; i < 4; i++) g.add(mesh(new THREE.CapsuleGeometry(0.022, 0.07, 6, 12), sm, { x: -0.14 + i * 0.05, y: 0.36 - Math.abs(i - 1.5) * 0.06, z: 0.09, rz: 1.2 - i * 0.6 }));
  return g;
}

// ------------------------------------------------------------------ car interior (driver's side, left window)
export function carInterior() {
  const g = new THREE.Group();
  const panel = phys('#2b2e35', { roughness: 0.65 });
  const trim = phys('#3c4049', { roughness: 0.5, clearcoat: 0.3 });
  // door panel with a window opening (shape with hole), at x = -0.75 facing +X
  const s = new THREE.Shape();
  s.moveTo(-1.2, -0.6); s.lineTo(1.2, -0.6); s.lineTo(1.2, 1.2); s.lineTo(-1.2, 1.2); s.lineTo(-1.2, -0.6);
  const hole = new THREE.Path();
  hole.moveTo(-0.62, 0.42); hole.lineTo(0.55, 0.42); hole.quadraticCurveTo(0.62, 0.42, 0.6, 0.5);
  hole.lineTo(0.42, 0.98); hole.quadraticCurveTo(0.38, 1.04, 0.3, 1.04); hole.lineTo(-0.58, 1.04);
  hole.quadraticCurveTo(-0.66, 1.04, -0.66, 0.96); hole.lineTo(-0.66, 0.48); hole.quadraticCurveTo(-0.66, 0.42, -0.62, 0.42);
  s.holes.push(hole);
  const door = mesh(new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 }), panel);
  door.rotation.y = Math.PI / 2; door.position.set(-0.78, 0, 0.05);
  g.add(door);
  g.add(mesh(rbox(0.1, 0.06, 1.3, 0.02), trim, { x: -0.7, y: 0.4, z: 0.1 }));   // window ledge
  g.add(mesh(rbox(0.12, 0.05, 0.5, 0.02), phys('#1b1d22', { roughness: 0.4 }), { x: -0.66, y: 0.15, z: 0.3 }));  // armrest
  // dashboard + steering wheel ahead (-Z)
  g.add(mesh(rbox(2.2, 0.35, 0.7, 0.12), phys('#24262b', { roughness: 0.55 }), { y: 0.25, z: -0.85 }));
  const wheel = new THREE.Group();
  wheel.add(mesh(new THREE.TorusGeometry(0.19, 0.022, 12, 48), phys('#15161a', { roughness: 0.45 })));
  wheel.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 24).rotateX(Math.PI / 2), trim));
  for (const a of [0, 2.1, -2.1]) wheel.add(mesh(new THREE.BoxGeometry(0.03, 0.17, 0.02), trim, { x: Math.sin(a) * 0.09, y: -Math.cos(a) * 0.09, rz: a }));
  wheel.position.set(0, 0.42, -0.45); wheel.rotation.x = -0.35;
  g.add(wheel);
  // A-pillar and roof edge
  g.add(mesh(rbox(0.1, 1.0, 0.1, 0.03), panel, { x: -0.72, y: 0.95, z: -0.6, rx: -0.45 }));
  g.add(mesh(rbox(1.8, 0.08, 1.8, 0.03), phys('#8c8a86', { roughness: 0.9 }), { y: 1.3, z: 0.1 }));
  return g;
}

// ------------------------------------------------------------------ city
export function cityBlock({ w = 20, h = 30, d = 14, wall = '#c9b8a2', seed = 1, lit = 0.12 } = {}) {
  const tex = windowGridTex(wall, '#58708c', Math.max(3, Math.round(w / 3)), Math.max(4, Math.round(h / 3.2)), lit, seed);
  const mats = [0, 1, 2, 3, 4, 5].map((i) => (i === 2 || i === 3 ? std(wall) : std('#ffffff', { map: tex, roughness: 0.8 })));
  return mesh(new THREE.BoxGeometry(w, h, d), mats, { y: h / 2 });
}

export function car(color = '#d23b32') {
  const g = new THREE.Group();
  const body = phys(color, { roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 });
  g.add(mesh(rbox(1.8, 0.6, 4.2, 0.25, 4), body, { y: 0.55 }));
  g.add(mesh(rbox(1.6, 0.5, 2.2, 0.22, 4), phys('#20262e', { roughness: 0.1, clearcoat: 1 }), { y: 1.05, z: -0.2 }));
  for (const x of [-0.82, 0.82]) for (const z of [-1.35, 1.35]) g.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 24).rotateZ(Math.PI / 2), std('#141414', { roughness: 0.9 }), { x, y: 0.34, z }));
  return g;
}

// ------------------------------------------------------------------ office
export function desk() {
  const g = new THREE.Group();
  const top = phys('#b98a5b', { roughness: 0.45, clearcoat: 0.3 });
  g.add(mesh(rbox(1.6, 0.05, 0.8, 0.015), top, { y: 0.75 }));
  for (const x of [-0.75, 0.75]) g.add(mesh(rbox(0.05, 0.75, 0.75, 0.01), phys('#9b9ea6', { metalness: 0.6, roughness: 0.35 }), { x, y: 0.375 }));
  // monitor
  const screen = canvasTex(512, 300, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2c5ea8'); gr.addColorStop(1, '#173561');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 7; i++) c.fillRect(40, 40 + i * 32, 200 + (i * 53) % 220, 12);
    c.fillStyle = '#f2b81f'; c.fillRect(300, 40, 160, 110);
  });
  g.add(mesh(rbox(0.62, 0.38, 0.03, 0.01), phys('#18191d', { roughness: 0.3 }), { y: 1.1, z: -0.22 }));
  g.add(mesh(new THREE.PlaneGeometry(0.58, 0.34), new THREE.MeshStandardMaterial({ map: screen, emissive: '#ffffff', emissiveMap: screen, emissiveIntensity: 0.9 }), { y: 1.1, z: -0.204, cast: false }));
  g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 12), phys('#2a2b30'), { y: 0.88, z: -0.24 }));
  g.add(mesh(rbox(0.22, 0.015, 0.16, 0.005), phys('#2a2b30'), { y: 0.78, z: -0.24 }));
  g.add(mesh(rbox(0.44, 0.02, 0.14, 0.008), phys('#e9e9ea', { roughness: 0.5 }), { y: 0.785, z: 0.12 }));
  // mug
  const mug = new THREE.Group();
  mug.add(mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.1, 24, 1, true), phys('#f4f2ee', { roughness: 0.25, clearcoat: 0.6, side: THREE.DoubleSide })));
  mug.add(mesh(new THREE.TorusGeometry(0.025, 0.007, 8, 20, Math.PI), phys('#f4f2ee', { roughness: 0.25 }), { x: 0.04, rz: -Math.PI / 2 }));
  mug.add(mesh(new THREE.CircleGeometry(0.037, 24).rotateX(-Math.PI / 2), phys('#4a2a16', { roughness: 0.2 }), { y: 0.035 }));
  mug.position.set(0.5, 0.825, 0.05);
  g.add(mug);
  return g;
}

export function perch() {
  const g = new THREE.Group();
  const wood = phys('#8a6040', { roughness: 0.6 });
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 32), wood, { y: 0.015 }));
  g.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 16), wood, { y: 0.27 }));
  g.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 16).rotateZ(Math.PI / 2), wood, { y: 0.52 }));
  return g;
}

export function cubicleWall(w = 2.4, h = 1.45, color = '#7f91a6') {
  const g = new THREE.Group();
  g.add(mesh(rbox(w, h, 0.07, 0.02), phys(color, { roughness: 0.95, sheen: 0.8, sheenRoughness: 0.8, sheenColor: new THREE.Color('#c8d6e6') }), { y: h / 2 }));
  g.add(mesh(rbox(w + 0.02, 0.04, 0.09, 0.01), phys('#c7c9cf', { metalness: 0.5, roughness: 0.35 }), { y: h + 0.01 }));
  return g;
}

export function plant() {
  const g = new THREE.Group();
  g.add(mesh(lathe([[0.0001, 0], [0.13, 0], [0.16, 0.3], [0.15, 0.3], [0.0001, 0.28]]), phys('#e5d8c4', { roughness: 0.6 })));
  const leaf = phys('#3f8a43', { roughness: 0.55, side: THREE.DoubleSide });
  const r = rng(9);
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2, tilt = 0.3 + r() * 0.7, len = 0.35 + r() * 0.3;
    const l = mesh(new THREE.SphereGeometry(1, 12, 8).scale(0.06, len / 2, 0.012), leaf, { y: 0.3 + len * 0.45 * Math.cos(tilt), x: Math.cos(a) * len * 0.45 * Math.sin(tilt), z: Math.sin(a) * len * 0.45 * Math.sin(tilt) });
    l.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt);
    g.add(l);
  }
  return g;
}

export function couch(color = '#c46f4e') {
  const g = new THREE.Group();
  const fab = phys(color, { roughness: 0.95, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffd2b8') });
  g.add(mesh(rbox(2.0, 0.42, 0.9, 0.08, 4), fab, { y: 0.21 }));
  g.add(mesh(rbox(2.0, 0.6, 0.25, 0.1, 4), fab, { y: 0.6, z: -0.33 }));
  for (const x of [-0.95, 0.95]) g.add(mesh(rbox(0.22, 0.6, 0.9, 0.1, 4), fab, { x, y: 0.35 }));
  for (const x of [-0.45, 0.45]) g.add(mesh(rbox(0.88, 0.14, 0.7, 0.06, 4), fab, { x, y: 0.48, z: 0.05 }));
  return g;
}
