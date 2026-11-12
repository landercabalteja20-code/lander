// Core helpers: math, materials, geometry, canvas textures, faces, characters, props.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export { THREE };

// ---------- math ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = t => t * t * (3 - 2 * t);
export const easeOut = t => 1 - Math.pow(1 - t, 3);
export const easeIn = t => t * t * t;
export const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const seg = (u, a, b) => clamp((u - a) / (b - a));
export function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
export function noise1(t, seed = 0) { const i = Math.floor(t), f = t - i; const a = hash(i + seed * 57.3), b = hash(i + 1 + seed * 57.3); return a + (b - a) * f * f * (3 - 2 * f); }
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const pop = (T, d = 0.18) => { const k = clamp(T / d); return k < 0.6 ? lerp(0.3, 1.12, k / 0.6) : lerp(1.12, 1, (k - 0.6) / 0.4); };

// ---------- materials & geometry ----------
const matCache = new Map();
export function mat(color, o = {}) {
  const key = String(color) + '|' + JSON.stringify(o);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({
      color, roughness: o.rough ?? 0.7, metalness: o.metal ?? 0,
      emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1,
      transparent: !!o.transparent, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide,
      depthWrite: o.depthWrite ?? true,
    }));
  }
  return matCache.get(key);
}
export function newMat(color, o = {}) { // uncached, for things we animate
  return new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.7, metalness: o.metal ?? 0, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 0, transparent: !!o.transparent, opacity: o.opacity ?? 1 });
}
export function basic(color, o = {}) {
  return new THREE.MeshBasicMaterial({ color, transparent: !!o.transparent, opacity: o.opacity ?? 1, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: o.depthWrite ?? !o.add, side: o.side ?? THREE.FrontSide, fog: o.fog ?? true });
}
const geoCache = new Map();
export function rboxGeo(w, h, d, r = 0.08) {
  const key = [w, h, d, r].join(',');
  if (!geoCache.has(key)) {
    const rr = Math.min(r, Math.min(w, h, d) / 2 - 0.002);
    geoCache.set(key, rr > 0.01 ? new RoundedBoxGeometry(w, h, d, 2, rr) : new THREE.BoxGeometry(w, h, d));
  }
  return geoCache.get(key);
}
export function box(w, h, d, material, r = 0.08, cast = true) {
  const m = new THREE.Mesh(rboxGeo(w, h, d, r), typeof material === 'string' ? mat(material) : material);
  m.castShadow = cast; m.receiveShadow = true; return m;
}
export function put(o, x = 0, y = 0, z = 0, ry = 0) { o.position.set(x, y, z); o.rotation.y = ry; return o; }
export function add(parent, ...objs) { for (const o of objs) parent.add(o); return parent; }
export function cyl(rt, rb, h, material, seg = 16) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof material === 'string' ? mat(material) : material); m.castShadow = true; m.receiveShadow = true; return m; }
export function sphere(r, material, ws = 16, hs = 12) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), typeof material === 'string' ? mat(material) : material); m.castShadow = true; m.receiveShadow = true; return m; }
export function prism(w, h, d, material) { // roof prism, ridge along z
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2);
  const m = new THREE.Mesh(g, typeof material === 'string' ? mat(material) : material); m.castShadow = true; m.receiveShadow = true; return m;
}
export function plane(w, h, material) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material); m.receiveShadow = true; return m; }

// ---------- canvas textures ----------
export function canvasTex(w, h, draw, o = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); }
  t.userData.canvas = c; return t;
}
export function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
export function gradientTex(stops) { // vertical sky gradient for scene.background
  return canvasTex(4, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); for (const [p, c] of stops) gr.addColorStop(p, c); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
}

// ---------- faces ----------
const FACE = 256;
const EX = {
  neutral: { eyes: 'dot', brows: 'normal', mouth: 'smallsmile' },
  smile: { eyes: 'dot', brows: 'normal', mouth: 'smile' },
  happy: { eyes: 'happy', brows: 'raised', mouth: 'grin', blush: true },
  sad: { eyes: 'dot', brows: 'sad', mouth: 'frown' },
  shock: { eyes: 'wide', brows: 'raised', mouth: 'o' },
  scared: { eyes: 'wide', brows: 'worried', mouth: 'wavy', sweat: true },
  terrified: { eyes: 'wide', brows: 'worried', mouth: 'scream', sweat: true },
  angry: { eyes: 'dot', brows: 'angry', mouth: 'frown' },
  determined: { eyes: 'dot', brows: 'angry', mouth: 'flat' },
  tired: { eyes: 'half', brows: 'sad', mouth: 'flat', circles: true },
  laugh: { eyes: 'happy', brows: 'raised', mouth: 'laugh' },
  sleep: { eyes: 'sleep', brows: 'normal', mouth: 'small' },
  worried: { eyes: 'dot', brows: 'worried', mouth: 'smallfrown' },
  confused: { eyes: 'dot', brows: 'confused', mouth: 'flat' },
  blank: { eyes: 'dot', brows: 'normal', mouth: 'flat' },
  smirk: { eyes: 'dot', brows: 'normal', mouth: 'smirk' },
  sadsmile: { eyes: 'half', brows: 'sad', mouth: 'smallsmile', circles: true },
  shout: { eyes: 'angryWide', brows: 'angry', mouth: 'scream' },
};
const faceCache = new Map();
export function faceTex(expr, v = {}, talk = false) {
  const key = `${expr}|${talk ? 1 : 0}|${v.female ? 1 : 0}|${v.scar ? 1 : 0}|${v.glasses ? 1 : 0}|${v.skin}|${v.circles ? 1 : 0}`;
  if (!faceCache.has(key)) faceCache.set(key, canvasTex(FACE, FACE, g => drawFace(g, EX[expr] || EX.neutral, v, talk)));
  return faceCache.get(key);
}
function drawFace(g, e, v, talk) {
  const ink = '#1b1b22', skin = v.skin || '#f1c6a0';
  const ex = [84, 172], ey = 112;
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (e.circles || v.circles) { g.fillStyle = 'rgba(80,40,70,0.28)'; for (const x of ex) { g.beginPath(); g.ellipse(x, ey + 26, 22, 9, 0, 0, Math.PI * 2); g.fill(); } }
  if (e.blush) { g.fillStyle = 'rgba(255,90,110,0.35)'; for (const x of ex) { g.beginPath(); g.ellipse(x + (x < 128 ? -12 : 12), ey + 40, 20, 10, 0, 0, Math.PI * 2); g.fill(); } }
  // eyes
  for (const [i, x] of ex.entries()) {
    g.fillStyle = ink; g.strokeStyle = ink;
    if (e.eyes === 'dot' || e.eyes === 'half') {
      g.beginPath(); g.ellipse(x, ey, 13, 21, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x + 4, ey - 8, 4.5, 6, 0, 0, Math.PI * 2); g.fill();
      if (e.eyes === 'half') { g.fillStyle = skin; g.fillRect(x - 18, ey - 26, 36, 22); g.strokeStyle = ink; g.lineWidth = 5; g.beginPath(); g.moveTo(x - 16, ey - 4); g.lineTo(x + 16, ey - 4); g.stroke(); }
    } else if (e.eyes === 'wide' || e.eyes === 'angryWide') {
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, ey, 22, 25, 0, 0, Math.PI * 2); g.fill();
      g.lineWidth = 5; g.strokeStyle = ink; g.stroke();
      g.fillStyle = ink; g.beginPath(); g.arc(x + (i ? -2 : 2), ey + 2, 8, 0, Math.PI * 2); g.fill();
    } else if (e.eyes === 'happy') {
      g.lineWidth = 8; g.beginPath(); g.arc(x, ey + 8, 15, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    } else if (e.eyes === 'sleep') {
      g.lineWidth = 7; g.beginPath(); g.arc(x, ey - 4, 15, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
    }
    if (v.female && e.eyes !== 'happy' && e.eyes !== 'sleep') { g.strokeStyle = ink; g.lineWidth = 4; const s = i ? 1 : -1; g.beginPath(); g.moveTo(x + s * 11, ey - 16); g.lineTo(x + s * 20, ey - 24); g.stroke(); }
  }
  // brows
  g.strokeStyle = ink; g.lineWidth = 8;
  const B = (x1, y1, x2, y2) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
  const by = ey - 38;
  if (e.brows === 'normal') { B(64, by + 2, 100, by - 2); B(156, by - 2, 192, by + 2); }
  if (e.brows === 'raised') { B(62, by - 8, 100, by - 14); B(156, by - 14, 194, by - 8); }
  if (e.brows === 'angry') { B(62, by - 6, 102, by + 8); B(154, by + 8, 194, by - 6); }
  if (e.brows === 'sad') { B(62, by + 6, 100, by - 6); B(156, by - 6, 194, by + 6); }
  if (e.brows === 'worried') { B(60, by + 2, 100, by - 12); B(156, by - 12, 196, by + 2); }
  if (e.brows === 'confused') { B(62, by - 12, 100, by - 8); B(156, by + 4, 194, by + 2); }
  // glasses
  if (v.glasses) { g.lineWidth = 5; g.strokeStyle = '#2a2a2a'; for (const x of ex) { rr(g, x - 26, ey - 22, 52, 44, 10); g.stroke(); } B(110, ey - 6, 146, ey - 6); }
  // mouth
  g.strokeStyle = ink; g.fillStyle = '#3a1820'; g.lineWidth = 7;
  const my = 178; let m = e.mouth;
  if (talk) m = ({ smile: 'open', smallsmile: 'open', flat: 'openSmall', frown: 'openSmall', small: 'openSmall', smallfrown: 'openSmall', wavy: 'scream', o: 'o', grin: 'laugh', laugh: 'laugh', smirk: 'open', scream: 'scream' })[m] || 'open';
  const openMouth = (w, h, tongue = true) => { g.beginPath(); g.ellipse(128, my, w, h, 0, 0, Math.PI * 2); g.fill(); if (tongue) { g.fillStyle = '#e0607a'; g.beginPath(); g.ellipse(128, my + h * 0.45, w * 0.55, h * 0.4, 0, 0, Math.PI * 2); g.fill(); } };
  if (m === 'smile') { g.beginPath(); g.arc(128, my - 26, 32, Math.PI * 0.2, Math.PI * 0.8); g.stroke(); }
  if (m === 'smallsmile') { g.beginPath(); g.arc(128, my - 18, 20, Math.PI * 0.25, Math.PI * 0.75); g.stroke(); }
  if (m === 'grin' || m === 'laugh') { g.beginPath(); g.moveTo(92, my - 8); g.quadraticCurveTo(128, my + (m === 'laugh' ? 48 : 34), 164, my - 8); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.fillRect(100, my - 8, 56, 8); }
  if (m === 'flat') { B(108, my, 148, my); }
  if (m === 'frown') { g.beginPath(); g.arc(128, my + 26, 26, Math.PI * 1.22, Math.PI * 1.78); g.stroke(); }
  if (m === 'smallfrown') { g.beginPath(); g.arc(128, my + 20, 18, Math.PI * 1.25, Math.PI * 1.75); g.stroke(); }
  if (m === 'small') { B(118, my, 138, my); }
  if (m === 'o') { openMouth(13, 17, false); }
  if (m === 'open') { openMouth(22, 15); }
  if (m === 'openSmall') { openMouth(15, 10); }
  if (m === 'scream') { openMouth(24, 26); }
  if (m === 'smirk') { g.beginPath(); g.moveTo(108, my + 2); g.quadraticCurveTo(136, my + 10, 154, my - 10); g.stroke(); }
  if (m === 'wavy') { g.lineWidth = 6; g.beginPath(); g.moveTo(102, my); for (let k = 0; k <= 6; k++) g.lineTo(102 + k * 9, my + (k % 2 ? -6 : 6)); g.stroke(); }
  if (e.sweat) { g.fillStyle = '#7fd0ff'; g.beginPath(); g.moveTo(206, 60); g.quadraticCurveTo(220, 86, 206, 94); g.quadraticCurveTo(192, 86, 206, 60); g.fill(); }
  if (v.scar) { g.strokeStyle = 'rgba(150,40,50,0.85)'; g.lineWidth = 7; B(58, 66, 150, 170); g.lineWidth = 4; for (let k = 0; k < 5; k++) { const x = 70 + k * 18, y = 79 + k * 18.5; B(x - 8, y + 9, x + 8, y - 9); } }
}

// ---------- characters ----------
export const ALL_CHARS = [];
export class Char {
  constructor(o) {
    this.o = o; ALL_CHARS.push(this);
    const hs = o.head ?? 1.75;
    this.root = new THREE.Group(); this.root.scale.setScalar(o.scale ?? 1);
    this.body = new THREE.Group(); this.root.add(this.body);
    const skinM = mat(o.skin), pantsM = mat(o.pants), shoeM = mat(o.shoes ?? '#f2f2f2');
    this.legL = new THREE.Group(); this.legR = new THREE.Group();
    this.legL.position.set(-0.5, 2, 0); this.legR.position.set(0.5, 2, 0);
    for (const L of [this.legL, this.legR]) {
      L.add(put(box(0.97, 1.62, 1, pantsM, 0.14), 0, -0.82, 0));
      L.add(put(box(1.0, 0.42, 1.12, shoeM, 0.14), 0, -1.78, 0.06));
      this.body.add(L);
    }
    this.torso = new THREE.Group(); this.torso.position.y = 2; this.body.add(this.torso);
    this.torso.add(put(box(2, 2, 1, mat(o.shirt), 0.16), 0, 1, 0));
    if (o.inner) this.torso.add(put(box(0.62, 1.86, 0.06, mat(o.inner), 0.02), 0, 1, 0.5));
    if (o.belt) this.torso.add(put(box(2.02, 0.22, 1.02, mat(o.belt), 0.05), 0, 0.12, 0));
    this.armL = new THREE.Group(); this.armR = new THREE.Group();
    this.armL.position.set(-1.5, 1.85, 0); this.armR.position.set(1.5, 1.85, 0);
    for (const A of [this.armL, this.armR]) {
      A.add(put(box(0.96, 1.5, 0.96, mat(o.sleeve ?? o.shirt), 0.14), 0, -0.58, 0));
      A.add(put(box(0.92, 0.55, 0.92, skinM, 0.14), 0, -1.55, 0));
      this.torso.add(A);
    }
    this.handR = new THREE.Group(); this.handR.position.set(0, -1.75, 0.1); this.armR.add(this.handR);
    this.handL = new THREE.Group(); this.handL.position.set(0, -1.75, 0.1); this.armL.add(this.handL);
    this.head = new THREE.Group(); this.head.position.y = 2.02; this.torso.add(this.head);
    const hy = hs * 0.46;
    this.head.add(put(box(hs, hs * 0.94, hs * 0.94, skinM, 0.32), 0, hy, 0));
    this.faceMat = new THREE.MeshStandardMaterial({ map: faceTex('neutral', o), transparent: true, roughness: 0.8, depthWrite: false });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(hs * 0.96, hs * 0.9), this.faceMat);
    face.position.set(0, hy, hs * 0.47 + 0.01); face.renderOrder = 2; this.head.add(face);
    this.hy = hy; this.hs = hs;
    buildHair(this.head, o.hair, o.hairColor, hs, hy);
    if (o.hat) buildHat(this.head, o.hat, hs, hy);
    this.root.traverse(m => { if (m.isMesh && m !== face) m.castShadow = true; });
    this.reset();
  }
  reset() {
    this.root.visible = false; this.root.position.set(0, 0, 0); this.root.rotation.set(0, 0, 0); this.root.scale.setScalar(this.o.scale ?? 1);
    this.body.position.set(0, 0, 0); this.body.rotation.set(0, 0, 0);
    for (const j of [this.legL, this.legR, this.armL, this.armR, this.head, this.torso]) j.rotation.set(0, 0, 0);
    this.torso.position.y = 2; this.exprName = null; this.expr('neutral');
    for (const h of [this.handR, this.handL]) for (const c of [...h.children]) h.remove(c);
  }
  place(x, y, z, ry = 0) { this.root.visible = true; this.root.position.set(x, y, z); this.root.rotation.y = ry; return this; }
  expr(name, talk = false) { const k = name + (talk ? '+t' : ''); if (this.exprName !== k) { this.faceMat.map = faceTex(name, this.o, talk); this.exprName = k; this.faceMat.needsUpdate = true; } return this; }
  talk(name, T, on = true) { const open = on && Math.sin(T * 26) > -0.2 && noise1(T * 7, 3) > 0.25; return this.expr(name, open); }
  walk(phase, amt = 1) {
    const s = Math.sin(phase);
    this.legL.rotation.x = s * 0.65 * amt; this.legR.rotation.x = -s * 0.65 * amt;
    this.armL.rotation.x = -s * 0.55 * amt; this.armR.rotation.x = s * 0.55 * amt;
    this.body.position.y = Math.abs(Math.cos(phase)) * 0.12 * amt; return this;
  }
  idle(T, amt = 1) { this.body.position.y = Math.sin(T * 2.2) * 0.04 * amt; this.head.rotation.z = Math.sin(T * 1.3) * 0.025 * amt; this.armL.rotation.z = -0.04; this.armR.rotation.z = 0.04; return this; }
  arms(lx, lz, rx, rz) { this.armL.rotation.set(lx, 0, lz); this.armR.rotation.set(rx, 0, rz); return this; }
  look(x = 0, y = 0) { this.head.rotation.x = x; this.head.rotation.y = y; return this; }
  sit() { this.legL.rotation.x = this.legR.rotation.x = -Math.PI / 2; this.body.position.y = -1.0; return this; }
  hold(obj, left = false) { (left ? this.handL : this.handR).add(obj); return this; }
  headWorld(v = new THREE.Vector3()) { this.head.updateWorldMatrix(true, false); return this.head.localToWorld(v.set(0, this.hy, 0)); }
}
function buildHair(head, style, color, hs, hy) {
  if (!style) return;
  const m = mat(color, { rough: 0.85 });
  const top = hy + hs * 0.47;
  const H = (w, h, d, x, y, z, rx = 0, rz = 0, r = 0.18) => { const b = box(w, h, d, m, r); b.position.set(x, y, z); b.rotation.set(rx, 0, rz); head.add(b); return b; };
  if (style === 'long') {
    H(hs * 1.1, 0.5, hs * 1.04, 0, top + 0.06, -0.02);
    H(hs * 1.1, hs * 1.5, 0.55, 0, top - hs * 0.72, -hs * 0.5);
    for (const s of [-1, 1]) H(0.34, hs * 1.25, hs * 0.75, s * hs * 0.56, top - hs * 0.55, -hs * 0.1);
    H(hs * 0.62, 0.42, 0.34, -hs * 0.22, top - 0.2, hs * 0.44, 0, 0.18);
    H(hs * 0.5, 0.36, 0.32, hs * 0.28, top - 0.17, hs * 0.44, 0, -0.12);
  } else if (style === 'bun') {
    H(hs * 1.08, 0.46, hs * 1.02, 0, top + 0.04, -0.02);
    H(hs * 1.08, hs * 0.75, 0.42, 0, top - hs * 0.35, -hs * 0.47);
    H(0.9, 0.85, 0.85, 0, top + 0.5, -hs * 0.35, 0, 0, 0.36);
    for (const s of [-1, 1]) H(0.26, hs * 0.55, hs * 0.6, s * hs * 0.53, top - hs * 0.25, -hs * 0.12);
  } else if (style === 'messybun') {
    H(hs * 1.08, 0.46, hs * 1.02, 0, top + 0.04, -0.02);
    H(hs * 1.08, hs * 0.75, 0.42, 0, top - hs * 0.35, -hs * 0.47);
    H(0.95, 0.8, 0.9, 0.15, top + 0.46, -hs * 0.33, 0.2, 0.3, 0.32);
    H(0.22, hs * 0.7, 0.22, hs * 0.45, top - hs * 0.4, hs * 0.38, 0, 0.25, 0.08);
    H(0.2, hs * 0.6, 0.2, -hs * 0.5, top - hs * 0.35, hs * 0.3, 0, -0.3, 0.08);
  } else if (style === 'spiky') {
    H(hs * 1.08, 0.42, hs * 1.02, 0, top + 0.02, -0.02);
    H(hs * 1.06, hs * 0.5, 0.36, 0, top - hs * 0.22, -hs * 0.46);
    for (let k = 0; k < 5; k++) H(0.5, 0.6, 0.6, -hs * 0.36 + k * hs * 0.18, top + 0.32, hs * 0.1 - (k % 2) * 0.3, 0.3, (k - 2) * 0.22, 0.12);
  } else if (style === 'short') {
    H(hs * 1.08, 0.44, hs * 1.02, 0, top + 0.03, -0.02);
    H(hs * 1.06, hs * 0.5, 0.36, 0, top - hs * 0.22, -hs * 0.46);
    H(hs * 0.8, 0.3, 0.3, 0.05, top - 0.12, hs * 0.44, 0, 0.08);
  } else if (style === 'old') {
    H(hs * 1.06, hs * 0.45, 0.32, 0, top - hs * 0.3, -hs * 0.46);
    for (const s of [-1, 1]) H(0.28, hs * 0.38, hs * 0.6, s * hs * 0.52, top - hs * 0.32, -hs * 0.1);
  }
}
function buildHat(head, hat, hs, hy) {
  const top = hy + hs * 0.47;
  if (hat.type === 'cap') {
    const m = mat(hat.color);
    head.add(put(box(hs * 1.1, 0.55, hs * 1.06, m, 0.25), 0, top + 0.12, -0.02));
    head.add(put(box(hs * 0.9, 0.12, 0.8, m, 0.05), 0, top - 0.08, hs * 0.65));
  } else if (hat.type === 'police') {
    const m = mat(hat.color);
    head.add(put(cyl(hs * 0.62, hs * 0.6, 0.6, m, 20), 0, top + 0.2, 0));
    head.add(put(box(hs * 0.95, 0.1, 0.7, mat('#111'), 0.04), 0, top - 0.02, hs * 0.6));
  }
}

// ---------- props ----------
export function makeCup() {
  const g = new THREE.Group();
  g.add(put(cyl(0.3, 0.24, 0.75, '#f7f3ea', 14), 0, 0, 0));
  g.add(put(cyl(0.33, 0.33, 0.12, '#6b3e22', 14), 0, 0.42, 0));
  g.add(put(cyl(0.31, 0.27, 0.28, '#c99a62', 14), 0, -0.05, 0));
  return g;
}
export function makeBalloon() {
  const g = new THREE.Group();
  const b = sphere(1.05, mat('#e8212e', { rough: 0.25 }), 20, 16); b.scale.set(1, 1.18, 1); b.position.y = 4.2; g.add(b);
  g.add(put(cyl(0.18, 0.02, 0.3, '#c1121f', 6), 0, 2.95, 0));
  const s = cyl(0.025, 0.025, 2.9, mat('#eeeeee'), 4); s.position.y = 1.45; s.castShadow = false; g.add(s);
  return g;
}
export function makePhone(withBeam = false) {
  const g = new THREE.Group();
  g.add(put(box(0.55, 0.95, 0.12, '#1d1d26', 0.05), 0, 0, 0));
  if (withBeam) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(4.5, 16, 24, 1, true), basic('#fff6d6', { transparent: true, opacity: 0.13, add: true, side: THREE.DoubleSide }));
    cone.rotation.x = Math.PI / 2; cone.position.z = 8.2; cone.castShadow = false; g.add(cone); g.userData.beam = cone;
    const spot = new THREE.SpotLight('#fff3d1', 60, 45, 0.42, 0.55, 1.4); spot.position.set(0, 0, 0.1); spot.target.position.set(0, 0, 10); g.add(spot, spot.target); g.userData.spot = spot;
  }
  return g;
}
export function makeBadge(text, style = 'time') {
  const S = { time: ['#2F406F', '#ffffff'], loop: ['#6FFFC5', '#13213b'], alert: ['#CF1336', '#ffffff'], gold: ['#EECF68', '#13213b'], dark: ['#1b1b28', '#E1FE00'] }[style];
  const tex = canvasTex(768, 192, (g, w, h) => {
    g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 14; g.shadowOffsetY = 6;
    rr(g, 12, 12, w - 24, h - 30, 70); g.fillStyle = '#ffffff'; g.fill(); g.shadowColor = 'transparent';
    rr(g, 24, 24, w - 48, h - 54, 58); g.fillStyle = S[0]; g.fill();
    const cx = 100, cy = (h - 30) / 2 + 12;
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx, cy, 44, 0, Math.PI * 2); g.fill();
    g.strokeStyle = S[0] === '#ffffff' ? '#13213b' : S[0]; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy - 28); g.moveTo(cx, cy); g.lineTo(cx + 20, cy + 8); g.stroke();
    g.fillStyle = S[1]; g.font = '800 88px Poppins'; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.fillText(text, 164, cy + 6);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, fog: false }));
  sp.scale.set(4, 1, 1); sp.renderOrder = 10; return sp;
}
