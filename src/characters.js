// 3D fashion-doll idols: blocky rounded limbs, oversized heads with painted
// anime faces, sculpted hair with spring physics, and custom microphones.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';
import { mat, starGeometry, glitterTexture } from './materials.js';
import { FacePainter } from './faces.js';

export const HEAD_R = 0.3;
const HIP_Y = 1.08;
const UPPER = 0.29, FORE = 0.27;

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

function rbox(w, h, d, r = 0.035, topPivot = false) {
  const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2));
  if (topPivot) g.translate(0, -h / 2, 0);
  return g;
}
function mesh(geo, material, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// Doll head shape: tapered jaw, rounder cranium.
export function deformHead(v, R) {
  const ny = v.y / R;
  if (ny < 0) {
    const k = Math.pow(-ny, 1.5);
    v.x *= 1 - 0.3 * k;
    v.z *= 1 - 0.12 * k;
    v.y *= 1 + 0.12 * k;
    if (v.z > 0) v.z += 0.03 * k * R;
  }
  if (v.z < 0) v.z *= 1.07;
  v.y *= 1.06; v.z *= 0.95;
  return v;
}
function deformGeo(g, R) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    _v.fromBufferAttribute(p, i);
    deformHead(_v, R);
    p.setXYZ(i, _v.x, _v.y, _v.z);
  }
  g.computeVertexNormals();
  return g;
}

// Hair cap whose hairline depth varies around the head.
function capGeometry(R, front, side, back) {
  const g = new ParametricGeometry((u, v, target) => {
    const phi = u * Math.PI * 2;
    const f = Math.max(0, Math.sin(phi)), b = Math.max(0, -Math.sin(phi));
    const tmax = side + (front - side) * Math.pow(f, 2.2) + (back - side) * Math.pow(b, 1.4);
    const th = v * tmax;
    target.set(-R * Math.cos(phi) * Math.sin(th), R * Math.cos(th), R * Math.sin(phi) * Math.sin(th));
    deformHead(target, R / 1.08);
  }, 48, 20);
  g.computeVertexNormals();
  return g;
}

// Fringe / face-framing hair shell with wispy scalloped tips.
function bangsGeometry(R, phiC, phiW, t0, t1, { scallops = 5, amp = 0.1, puff = 0.06, tilt = 0 } = {}) {
  const g = new ParametricGeometry((u, v, target) => {
    const phi = phiC + (u - 0.5) * phiW;
    const tip = amp * (0.5 + 0.5 * Math.cos(u * scallops * Math.PI * 2));
    const th = t0 + v * (t1 - t0 - tip + tilt * (u - 0.5));
    const r = R * (1 + puff * Math.sin(Math.PI * Math.min(1, v * 1.15)) + 0.02 * (1 - v));
    target.set(-r * Math.cos(phi) * Math.sin(th), r * Math.cos(th), r * Math.sin(phi) * Math.sin(th));
    deformHead(target, HEAD_R);
  }, 28, 10);
  g.computeVertexNormals();
  return g;
}

// ---- hair physics ----
class SpringChain {
  constructor(bones, rest, { stiff = 70, damp = 7, gain = 0.035, grav = 0.75 } = {}) {
    this.bones = bones; this.rest = rest;
    this.stiff = stiff; this.damp = damp; this.gain = gain; this.grav = grav;
    this.ang = bones.map(() => new THREE.Vector2());
    this.vel = bones.map(() => new THREE.Vector2());
    this.prev = new THREE.Vector3(); this.prevVel = new THREE.Vector3(); this.inited = false;
  }
  update(dt) {
    const root = this.bones[0];
    root.parent.updateWorldMatrix(true, false);
    root.getWorldPosition(_v);
    if (!this.inited || dt <= 0 || dt > 0.25 || _v.distanceTo(this.prev) > 1) {
      this.prev.copy(_v); this.prevVel.set(0, 0, 0); this.inited = true;
      if (dt > 0.25) for (let i = 0; i < this.ang.length; i++) { this.ang[i].set(0, 0); this.vel[i].set(0, 0); }
    }
    const vel = _v2.copy(_v).sub(this.prev).divideScalar(Math.max(dt, 1e-3));
    const acc = _v3.copy(vel).sub(this.prevVel).divideScalar(Math.max(dt, 1e-3));
    acc.clampLength(0, 60);
    this.prev.copy(_v); this.prevVel.copy(vel);
    root.parent.getWorldQuaternion(_q).invert();
    acc.applyQuaternion(_q);
    const down = _v.set(0, -1, 0).applyQuaternion(_q);
    const gx = Math.atan2(-down.z, -down.y) * this.grav;
    const gz = Math.atan2(down.x, -down.y) * this.grav;
    const bx = THREE.MathUtils.clamp(acc.z * this.gain + gx, -1.3, 1.3);
    const bz = THREE.MathUtils.clamp(-acc.x * this.gain + gz, -1.3, 1.3);
    const h = Math.min(dt, 1 / 30);
    for (let i = 0; i < this.bones.length; i++) {
      const tx = i === 0 ? bx : this.ang[i - 1].x;
      const tz = i === 0 ? bz : this.ang[i - 1].y;
      const s = this.stiff * (i === 0 ? 1 : 1.4);
      const a = this.ang[i], v = this.vel[i];
      v.x += (s * (tx - a.x) - this.damp * v.x) * h;
      v.y += (s * (tz - a.y) - this.damp * v.y) * h;
      a.x += v.x * h; a.y += v.y * h;
    }
    for (let i = 0; i < this.bones.length; i++) {
      const prevA = i === 0 ? null : this.ang[i - 1];
      const lx = this.ang[i].x - (prevA ? prevA.x : 0);
      const lz = this.ang[i].y - (prevA ? prevA.y : 0);
      this.bones[i].rotation.set(this.rest[i][0] + lx, this.rest[i][1] || 0, (this.rest[i][2] || 0) + lz);
    }
  }
}

// Build a hanging chain of hair segments. Returns bones.
function hairChain(parent, segs, material, pos, restFirst, curve, shape = 'ellipsoid', extra = null) {
  const bones = []; const rest = [];
  let p = parent;
  segs.forEach((s, i) => {
    const b = new THREE.Group();
    if (i === 0) { b.position.copy(pos); } else b.position.set(0, -segs[i - 1].len * 0.86, 0);
    const r = i === 0 ? restFirst : [curve[0], 0, curve[1] || 0];
    b.rotation.set(r[0], r[1] || 0, r[2] || 0);
    p.add(b);
    if (shape === 'braid') {
      const g = new THREE.SphereGeometry(1, 14, 10);
      for (const side of [-1, 1]) {
        const m = mesh(g, material, b, side * s.rad * 0.38, -s.len * 0.5, 0);
        m.scale.set(s.rad * 0.78, s.len * 0.62, s.rad * 0.8);
        m.rotation.z = side * 0.45 * (i % 2 ? 1 : -1);
      }
    } else {
      const m = mesh(new THREE.SphereGeometry(1, 16, 12), s.mat || material, b, 0, -s.len * 0.5, 0);
      m.scale.set(s.rad, s.len * (shape === 'bubble' ? 0.55 : 0.62), s.rad * (s.flat || 1));
    }
    if (extra) extra(b, s, i);
    bones.push(b); rest.push(r);
    p = b;
  });
  return { bones, rest };
}

// ---- microphones ----
export function makeMic(style) {
  const g = new THREE.Group();
  const cfg = {
    pearl: { body: mat('pearl', '#f4b6c8'), grille: mat('chrome', '#eceff5'), ring: mat('pearl', '#ffffff') },
    violet: { body: mat('chrome', '#8a4be8'), grille: mat('chrome', '#1b1622'), ring: mat('emissive', '#b26bff', { intensity: 3 }) },
    ice: { body: mat('holo', '#a8e4ff', { opacity: 0.72 }), grille: mat('chrome', '#e6f6ff'), ring: mat('emissive', '#c9f0ff', { intensity: 2 }) },
    flame: { body: mat('gloss', '#e0122f'), grille: mat('chrome', '#141015'), ring: mat('chrome', '#d9dbe2') },
    gold: { body: mat('chrome', '#e8c886'), grille: mat('pearl', '#fffaf0'), ring: mat('chrome', '#ffd36b') },
  }[style];
  const handle = mesh(new THREE.CylinderGeometry(0.024, 0.017, 0.2, 18), cfg.body, g, 0, 0, 0);
  handle.position.y = 0.02;
  mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.035, 18), cfg.ring, g, 0, 0.13, 0);
  const grille = mesh(new THREE.SphereGeometry(0.042, 20, 14), cfg.grille, g, 0, 0.175, 0);
  const wire = mesh(new THREE.SphereGeometry(0.0435, 10, 7), new THREE.MeshBasicMaterial({ color: style === 'violet' || style === 'flame' ? 0x444050 : 0xffffff, wireframe: true, transparent: true, opacity: 0.35 }), g, 0, 0.175, 0);
  wire.userData.noShadow = true;
  if (style === 'pearl') {
    const pg = new THREE.SphereGeometry(0.009, 8, 6);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; mesh(pg, cfg.ring, g, Math.cos(a) * 0.031, 0.13, Math.sin(a) * 0.031); }
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; mesh(pg, cfg.ring, g, Math.cos(a) * 0.022, 0.04 - i * 0.012, Math.sin(a) * 0.022); }
  }
  if (style === 'violet') {
    mesh(new THREE.TorusGeometry(0.022, 0.004, 8, 20), cfg.ring, g, 0, -0.03, 0).rotation.x = Math.PI / 2;
    mesh(new THREE.SphereGeometry(0.012, 10, 8), cfg.ring, g, 0, -0.08, 0);
  }
  if (style === 'ice') {
    const sg = starGeometry(0.018, 0.4);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; const s = mesh(sg, mat('emissive', '#e8f8ff', { intensity: 2.2 }), g, Math.cos(a) * 0.026, 0.06 - (i % 2) * 0.05, Math.sin(a) * 0.026); s.lookAt(Math.cos(a), s.position.y, Math.sin(a)); }
  }
  if (style === 'flame') {
    const fs = new THREE.Shape();
    fs.moveTo(0, 0); fs.quadraticCurveTo(0.012, 0.02, 0.004, 0.05); fs.quadraticCurveTo(-0.004, 0.03, -0.01, 0.035); fs.quadraticCurveTo(-0.004, 0.015, 0, 0);
    const fg = new THREE.ExtrudeGeometry(fs, { depth: 0.004, bevelEnabled: false });
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const f = mesh(fg, mat('chrome', '#e6e8ee'), g, Math.cos(a) * 0.022, -0.02, Math.sin(a) * 0.022); f.rotation.y = -a + Math.PI / 2; }
  }
  if (style === 'gold') {
    const sg = starGeometry(0.014, 0.4);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const chain = mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.03, 4), cfg.ring, g, Math.cos(a) * 0.028, 0.115, Math.sin(a) * 0.028);
      mesh(sg, cfg.ring, chain, 0, -0.022, 0);
    }
  }
  return g;
}

// ---- the character ----
export class Character {
  constructor(m, opts = {}) {
    this.m = m;
    this.root = new THREE.Group();
    this.root.name = m.id;
    this.base = { x: 0, z: 0, rot: 0, y: 0 };
    this.chains = [];
    this.face = new FacePainter(m, opts.faceSize || 512);
    this.faceTex = new THREE.CanvasTexture(this.face.canvas);
    this.faceTex.colorSpace = THREE.SRGBColorSpace;
    this.faceTex.anisotropy = 4;
    this.build();
    this.skirtSpring = { a: new THREE.Vector2(), v: new THREE.Vector2(), prev: new THREE.Vector3(), pv: new THREE.Vector3(), init: false };
  }

  build() {
    const m = this.m, o = m.outfit;
    const skin = mat('skin', m.skin);
    const root = this.root;
    const J = (this.j = {});
    const G = (parent, name, x = 0, y = 0, z = 0, order = 'XYZ') => { const g = new THREE.Group(); g.name = name; g.position.set(x, y, z); g.rotation.order = order; parent.add(g); J[name] = g; return g; };

    const jacketMat = o.jacketSparkle === false ? mat('satin', o.jacket, { sheen: o.jacketSheen }) : (m.id === 'tala' || m.id === 'liway') ? mat('sequin', o.jacket, { metal: 0.15, glow: 0.9 }) : mat('satin', o.jacket, { sheen: o.jacketSheen });
    const topMat = mat('satin', o.top, { sheen: '#ffffff' });
    const bootMat = mat('gloss', o.boots);
    const soleMat = mat('gloss', o.sole);
    const accentMat = m.id === 'tala' ? mat('chrome', '#f2c14e') : m.id === 'amara' ? mat('pearl', '#fbf6f2') : mat('chrome', '#dfe2ea');

    // shadow blob
    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.55, 32), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.55 }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; blob.renderOrder = 1;
    root.add(blob); this.blob = blob;

    const hips = G(root, 'hips', 0, HIP_Y, 0, 'YXZ');
    mesh(rbox(0.32, 0.2, 0.21, 0.07), o.bottomType === 'shorts' ? mat('chrome', o.bottom) : mat('satin', o.bottomType === 'cargo' ? o.bottom : o.top), hips, 0, 0.03, 0);

    // legs
    for (const side of [1, -1]) {
      const L = side > 0 ? 'L' : 'R';
      const thigh = G(hips, 'thigh' + L, side * 0.095, -0.02, 0, 'ZXY');
      mesh(rbox(0.14, 0.46, 0.15, 0.06, true), skin, thigh, 0, 0.02, 0);
      const knee = G(thigh, 'knee' + L, 0, -0.44, 0);
      const highBoot = o.bottomType !== 'shorts';
      mesh(rbox(0.125, 0.44, 0.135, 0.055, true), highBoot ? bootMat : skin, knee, 0, 0.02, 0);
      if (highBoot && m.id !== 'liway') mesh(rbox(0.145, 0.06, 0.155, 0.025), bootMat, knee, 0, -0.03, 0);
      if (m.id === 'liway') {
        // silver leg warmers over white boots
        const lw = mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.22, 16, 6), mat('sequin', '#d7dde8', { metal: 0.8, glow: 0.8 }), knee, 0, -0.27, 0);
        lw.scale.z = 0.95;
      }
      if (o.bottomType === 'shorts') {
        // ankle socks + chunky sneakers
        mesh(rbox(0.13, 0.08, 0.14, 0.03), mat('satin', '#ffffff'), knee, 0, -0.39, 0);
      }
      const ankle = G(knee, 'ankle' + L, 0, -0.42, 0);
      const sneaker = o.bottomType === 'shorts';
      mesh(rbox(0.155, sneaker ? 0.13 : 0.11, sneaker ? 0.32 : 0.28, 0.05), bootMat, ankle, 0, -0.07, 0.05);
      mesh(rbox(sneaker ? 0.17 : 0.155, sneaker ? 0.1 : 0.12, sneaker ? 0.34 : 0.29, 0.035), soleMat, ankle, 0, -0.17, 0.05);
      if (sneaker) mesh(rbox(0.16, 0.03, 0.2, 0.012), mat('emissive', '#b26bff', { intensity: 1.6 }), ankle, 0, -0.12, 0.05);
      if (m.id === 'saya') mesh(rbox(0.16, 0.025, 0.3, 0.01), mat('gloss', '#121014'), ankle, 0, -0.105, 0.05);
    }

    // bottoms
    const bottom = G(hips, 'bottom', 0, 0.06, 0);
    this.buildBottom(bottom);

    // torso
    const waist = G(hips, 'waist', 0, 0.12, 0, 'YXZ');
    mesh(rbox(0.25, 0.16, 0.17, 0.07), skin, waist, 0, 0.05, 0);
    if (m.id === 'yzel' || m.id === 'saya') mesh(rbox(0.26, 0.05, 0.18, 0.02), m.id === 'yzel' ? mat('chrome', '#d8dbe6') : mat('chrome', '#cfd2da'), waist, 0, -0.02, 0);
    const chest = G(waist, 'chest', 0, 0.12, 0, 'YXZ');
    mesh(rbox(0.34, 0.27, 0.2, 0.08), topMat, chest, 0, 0.12, 0);
    // bust shape
    mesh(rbox(0.3, 0.11, 0.06, 0.05), topMat, chest, 0, 0.1, 0.09);
    if (m.id === 'amara') {
      // corset lacing
      const lace = mat('pearl', '#f2dfe6');
      for (let i = 0; i < 4; i++) mesh(rbox(0.07, 0.008, 0.01, 0.003), lace, chest, 0, 0.03 + i * 0.045, 0.127).rotation.z = (i % 2 ? 0.5 : -0.5);
      mesh(rbox(0.3, 0.018, 0.21, 0.008), lace, chest, 0, 0.0, 0);
    }
    if (m.id === 'saya') mesh(rbox(0.36, 0.05, 0.21, 0.02), topMat, chest, 0.03, 0.0, 0).rotation.z = 0.25; // asymmetric hem
    // cropped jacket: back panel, side fronts, shoulders
    const jk = G(chest, 'jacket', 0, 0, 0);
    mesh(rbox(0.4, 0.27, 0.06, 0.03), jacketMat, jk, 0, 0.14, -0.09);
    for (const side of [1, -1]) {
      mesh(rbox(0.1, 0.27, 0.23, 0.04), jacketMat, jk, side * 0.155, 0.14, 0.0);
      const lapel = mesh(rbox(0.06, 0.2, 0.025, 0.012), o.jacket2 ? mat('satin', o.jacket2) : jacketMat, jk, side * 0.12, 0.17, 0.11);
      lapel.rotation.z = side * -0.25;
    }
    mesh(rbox(0.44, 0.06, 0.24, 0.03), jacketMat, jk, 0, 0.26, -0.005);
    if (m.id === 'saya') { // varsity trim + letter
      mesh(rbox(0.41, 0.025, 0.07, 0.01), mat('satin', '#fbf4f0'), jk, 0, 0.015, -0.09);
      const patch = mesh(new THREE.PlaneGeometry(0.06, 0.06), mat('emissive', '#fbf4f0', { intensity: 1.0 }), jk, 0.155, 0.19, 0.117);
      patch.material = new THREE.MeshBasicMaterial({ map: letterTexture('S', '#fbf4f0', '#d4142f') , transparent: true });
    }
    if (m.id === 'yzel') { // racing stripes
      for (const side of [1, -1]) mesh(rbox(0.025, 0.272, 0.235, 0.008), mat('satin', '#14101c'), jk, side * 0.19, 0.14, 0.0);
      mesh(rbox(0.41, 0.03, 0.065, 0.01), mat('chrome', '#d8dbe6'), jk, 0, 0.2, -0.095);
    }
    // necklace / choker
    if (m.id === 'amara') { const pg = new THREE.SphereGeometry(0.012, 8, 6); for (let i = 0; i < 16; i++) { const a = (i / 15) * Math.PI; mesh(pg, accentMat, chest, Math.cos(a) * 0.075, 0.27 - Math.sin(a) * 0.055, 0.06 + Math.sin(a) * 0.04); } }
    if (m.id === 'tala') { mesh(new THREE.TorusGeometry(0.06, 0.008, 8, 24), accentMat, chest, 0, 0.3, 0.0).rotation.x = Math.PI / 2; mesh(starGeometry(0.02, 0.4), accentMat, chest, 0, 0.27, 0.07); }
    if (m.id === 'saya' || m.id === 'yzel') { const lg = new THREE.TorusGeometry(0.012, 0.004, 6, 10); for (let i = 0; i < 9; i++) { const a = (i / 8) * Math.PI; const l = mesh(lg, accentMat, chest, Math.cos(a) * 0.08, 0.26 - Math.sin(a) * 0.07, 0.06 + Math.sin(a) * 0.045); l.rotation.y = i % 2 ? Math.PI / 2 : 0; } }
    if (m.id === 'liway') mesh(starGeometry(0.022, 0.4), mat('emissive', '#dff4ff', { intensity: 2 }), chest, 0, 0.27, 0.075);

    // arms
    for (const side of [1, -1]) {
      const L = side > 0 ? 'L' : 'R';
      const sh = G(chest, 'shoulder' + L, side * 0.225, 0.23, 0, 'ZXY');
      mesh(new THREE.SphereGeometry(0.075, 16, 12), jacketMat, sh, 0, -0.01, 0).scale.set(1, 0.9, 1);
      mesh(rbox(0.11, UPPER + 0.02, 0.115, 0.045, true), jacketMat, sh, 0, 0.0, 0);
      const el = G(sh, 'elbow' + L, 0, -UPPER, 0);
      mesh(rbox(0.1, FORE * 0.62, 0.105, 0.045, true), jacketMat, el, 0, 0.01, 0);
      mesh(rbox(0.088, FORE * 0.45, 0.092, 0.04, true), skin, el, 0, -FORE * 0.55, 0);
      mesh(new THREE.TorusGeometry(0.052, 0.012, 6, 16), mat('satin', o.jacket2 || o.jacket), el, 0, -FORE * 0.58, 0).rotation.x = Math.PI / 2;
      if (m.id === 'yzel' || m.id === 'tala' || m.id === 'saya') mesh(new THREE.TorusGeometry(0.047, 0.008, 6, 16), accentMat, el, 0, -FORE * 0.9, 0).rotation.x = Math.PI / 2;
      const wr = G(el, 'wrist' + L, 0, -FORE, 0);
      const hand = mesh(rbox(0.082, 0.1, 0.075, 0.035, true), skin, wr, 0, 0.0, 0);
      const thumb = mesh(rbox(0.03, 0.05, 0.03, 0.013), skin, wr, -side * 0.0, -0.04, 0.045);
      thumb.rotation.x = -0.4;
      J['hand' + L] = hand;
    }

    // neck + head
    const neck = G(chest, 'neck', 0, 0.26, 0, 'YXZ');
    mesh(new THREE.CylinderGeometry(0.052, 0.06, 0.16, 14), skin, neck, 0, 0.06, 0);
    const head = G(neck, 'head', 0, 0.36, 0.0, 'YXZ');
    const hg = deformGeo(new THREE.SphereGeometry(HEAD_R, 48, 36), HEAD_R);
    mesh(hg, skin, head);
    const faceGeo = deformGeo(new THREE.SphereGeometry(HEAD_R * 1.004, 56, 48, Math.PI / 2 - 1.15, 2.3, 0.6, 1.9), HEAD_R);
    const faceMat = new THREE.MeshStandardMaterial({ map: this.faceTex, transparent: true, roughness: 0.45, metalness: 0, emissive: 0xffffff, emissiveMap: this.faceTex, emissiveIntensity: 0.42, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false });
    const faceMesh = mesh(faceGeo, faceMat, head);
    faceMesh.renderOrder = 2;
    this.faceMesh = faceMesh;
    for (const side of [1, -1]) {
      const ear = mesh(new THREE.SphereGeometry(0.045, 12, 10), skin, head, side * 0.272, -0.03, -0.02);
      ear.scale.set(0.5, 1, 0.8);
      this.buildEarring(head, side, accentMat);
    }
    this.buildHair(head);

    // mic
    this.mic = makeMic(m.mic);
    J.wristR.add(this.mic);
    this.mic.position.set(0, -0.055, 0.005);
    this.micDefault = new THREE.Vector3(0, -0.35, 1).normalize();
    this.mic.quaternion.setFromUnitVectors(UP, this.micDefault);

    root.traverse((n) => { if (n.isMesh) { n.castShadow = false; n.receiveShadow = false; } });
  }

  buildEarring(head, side, accentMat) {
    const id = this.m.id;
    if (id === 'amara') mesh(new THREE.SphereGeometry(0.018, 10, 8), accentMat, head, side * 0.28, -0.1, -0.02);
    if (id === 'yzel' || id === 'saya') mesh(new THREE.TorusGeometry(0.035, 0.006, 8, 20), accentMat, head, side * 0.285, -0.12, -0.02).rotation.y = Math.PI / 2;
    if (id === 'liway') mesh(starGeometry(0.022, 0.4), mat('emissive', '#dff4ff', { intensity: 2 }), head, side * 0.29, -0.11, -0.01).rotation.y = Math.PI / 2;
    if (id === 'tala') { const e = mesh(new THREE.TorusGeometry(0.03, 0.006, 8, 20), accentMat, head, side * 0.285, -0.12, -0.02); e.rotation.y = Math.PI / 2; mesh(starGeometry(0.015, 0.4), accentMat, head, side * 0.29, -0.16, -0.02).rotation.y = Math.PI / 2; }
  }

  buildBottom(g) {
    const m = this.m, o = m.outfit;
    if (o.bottomType === 'pleated') {
      const geo = new THREE.CylinderGeometry(0.19, 0.34, 0.3, 48, 2, true);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        _v.fromBufferAttribute(p, i);
        const a = Math.atan2(_v.z, _v.x);
        const down = (0.15 - _v.y) / 0.3;
        const k = 1 + 0.07 * down * (Math.abs(Math.sin(a * 12)) - 0.5);
        p.setXYZ(i, _v.x * k, _v.y, _v.z * k * 0.88);
      }
      geo.computeVertexNormals();
      const sk = mesh(geo, o.bottomMetal > 0.5 ? mat('sequin', o.bottom, { metal: 0.9, glow: 1.1 }) : mat('satin', o.bottom), g, 0, -0.14, 0);
      sk.material = sk.material.clone(); sk.material.side = THREE.DoubleSide; sk.material.flatShading = true;
      mesh(new THREE.TorusGeometry(0.19, 0.02, 8, 32), mat('satin', m.id === 'amara' ? '#f3b9cc' : '#ffe680'), g, 0, 0.0, 0).scale.set(1, 1, 0.88);
      g.children.forEach((c) => { if (c.geometry && c.geometry.type === 'TorusGeometry') c.rotation.x = Math.PI / 2; });
      this.skirt = sk;
    } else if (o.bottomType === 'bubble') {
      const shape = (r0, r1, h) => { const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(r0 + (r1 - r0) * t + Math.sin(t * Math.PI) * 0.07, -t * h)); } return new THREE.LatheGeometry(pts, 40); };
      const s1 = mesh(shape(0.18, 0.24, 0.16), mat('sequin', o.bottom, { metal: 0.2, glow: 0.7 }), g, 0, 0.02, 0);
      const s2 = mesh(shape(0.22, 0.26, 0.15), mat('satin', o.bottom2), g, 0, -0.11, 0);
      for (const s of [s1, s2]) { s.material = s.material.clone(); s.material.side = THREE.DoubleSide; s.scale.z = 0.88; }
      this.skirt = s1;
    } else if (o.bottomType === 'cargo') {
      const geo = new THREE.CylinderGeometry(0.19, 0.25, 0.27, 10, 1, true);
      const sk = mesh(geo, mat('satin', o.bottom), g, 0, -0.12, 0);
      sk.material = sk.material.clone(); sk.material.side = THREE.DoubleSide; sk.scale.z = 0.86;
      for (const side of [1, -1]) mesh(rbox(0.09, 0.08, 0.04, 0.012), mat('satin', '#222026'), g, side * 0.2, -0.15, 0.04).rotation.y = side * 0.9;
      // chrome chain swag
      const lg = new THREE.TorusGeometry(0.011, 0.0035, 6, 10);
      for (let i = 0; i < 12; i++) { const t = i / 11; const l = mesh(lg, mat('chrome', '#dfe2ea'), g, -0.2 + t * 0.4, -0.08 - Math.sin(t * Math.PI) * 0.07, 0.2); l.rotation.y = i % 2 ? Math.PI / 2 : 0; }
      this.skirt = sk;
    } else if (o.bottomType === 'shorts') {
      for (const side of [1, -1]) {
        const leg = mesh(rbox(0.17, 0.14, 0.18, 0.04), mat('chrome', o.bottom), g, side * 0.095, -0.13, 0);
        leg.material = mat('satin', o.bottom, { sheen: '#e4c8ff' });
        mesh(rbox(0.05, 0.07, 0.07, 0.012), mat('satin', '#5e2aa8'), g, side * 0.18, -0.13, 0.02);
      }
      const lg = new THREE.TorusGeometry(0.012, 0.004, 6, 10);
      for (let i = 0; i < 10; i++) { const t = i / 9; const l = mesh(lg, mat('chrome', '#dfe2ea'), g, -0.17 + t * 0.34, -0.03 - Math.sin(t * Math.PI) * 0.05, 0.12); l.rotation.y = i % 2 ? Math.PI / 2 : 0; }
      this.skirt = null;
    }
  }

  buildHair(head) {
    const H = this.m.hair;
    const hm = mat('hair', H.color, { sheen: H.sheen });
    const am = mat('hair', H.accent, { sheen: '#ffffff' });
    const R = HEAD_R * 1.08;
    const style = H.style;
    if (style === 'ponytail') {
      mesh(capGeometry(R * 1.035, 1.02, 2.0, 2.2), hm, head).material = withSide(hm);
      // slicked volume on top
      const top = mesh(new THREE.SphereGeometry(R * 0.86, 24, 16), hm, head, 0, 0.1, -0.04); top.scale.set(1, 0.72, 1.02);
      const tie = mesh(new THREE.TorusGeometry(0.06, 0.02, 10, 22), mat('pearl', '#fbf6f2'), head, 0, 0.27, -0.19);
      tie.rotation.x = -0.9;
      const segs = [0.12, 0.13, 0.13, 0.13, 0.12, 0.12, 0.11].map((len, i) => ({ len, rad: [0.085, 0.1, 0.098, 0.09, 0.078, 0.062, 0.045][i] }));
      const ch = hairChain(head, segs, hm, new THREE.Vector3(0, 0.29, -0.21), [2.25, 0, 0], [-0.36, 0]);
      this.chains.push(new SpringChain(ch.bones, ch.rest, { stiff: 55, damp: 5.5, gain: 0.03 }));
    }
    if (style === 'wolf') {
      mesh(capGeometry(R * 1.06, 1.08, 2.0, 2.3), hm, head).material = withSide(hm);
      const cone = new THREE.ConeGeometry(0.055, 0.22, 8, 1);
      cone.translate(0, -0.11, 0);
      const add = (theta, phi, len, out, tilt = 0) => {
        const g = new THREE.Group();
        _v.set(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)).multiplyScalar(R * 1.02);
        deformHead(_v, R / 1.08);
        g.position.copy(_v);
        g.lookAt(_v2.copy(_v).multiplyScalar(2).add(new THREE.Vector3(0, -0.6, 0)));
        g.rotateX(-Math.PI / 2 + out);
        g.rotateZ(tilt);
        const c = mesh(cone, hm, g); c.scale.set(1.1, len, 0.8);
        head.add(g);
        return g;
      };
      for (let i = 0; i < 16; i++) { const phi = (i / 16) * Math.PI * 2; const front = Math.sin(phi); if (front > 0.6) continue; add(1.15 + 0.25 * Math.max(0, -front), phi, 1.1 + 0.5 * Math.max(0, -front), 0.25); }
      for (let i = 0; i < 10; i++) { const phi = (i / 10) * Math.PI * 2 + 0.3; add(0.6, phi, 0.95, 0.35); }
      // curtain bangs framing the face
      for (const s of [-1, 1]) { add(1.0, Math.PI / 2 + s * 0.3, 0.75, 0.1, s * 0.5); add(1.05, Math.PI / 2 + s * 0.58, 0.95, 0.1, s * 0.3); }
      // a few loose nape strands with physics
      for (const s of [-1, 1]) {
        const segs = [0.08, 0.08, 0.07].map((len, i) => ({ len, rad: [0.05, 0.04, 0.03][i] }));
        const ch = hairChain(head, segs, hm, new THREE.Vector3(s * 0.12, -0.14, -0.24), [0.25, 0, s * 0.25], [-0.05, 0]);
        this.chains.push(new SpringChain(ch.bones, ch.rest, { stiff: 80, damp: 6, gain: 0.025 }));
      }
    }
    if (style === 'bubbles') {
      mesh(capGeometry(R * 1.04, 1.05, 2.0, 2.2), hm, head).material = withSide(hm);
      // soft fringe with icy streaks + face-framing sides
      mesh(bangsGeometry(R * 1.06, Math.PI / 2, 1.35, 0.55, 1.22, { scallops: 5, amp: 0.12, puff: 0.04 }), hm, head).material = withSide(hm);
      mesh(bangsGeometry(R * 1.085, Math.PI / 2 + 0.38, 0.22, 0.5, 1.2, { scallops: 1, amp: 0.06, puff: 0.07 }), am, head).material = withSide(am);
      for (const s of [-1, 1]) mesh(bangsGeometry(R * 1.04, Math.PI / 2 + s * 1.05, 0.32, 1.0, 1.95, { scallops: 2, amp: 0.16, puff: 0.05 }), hm, head).material = withSide(hm);
      for (const s of [-1, 1]) {
        const segs = [0.1, 0.11, 0.1, 0.09].map((len, i) => ({ len, rad: [0.095, 0.09, 0.08, 0.065][i], mat: i === 3 ? am : hm }));
        const ch = hairChain(head, segs, hm, new THREE.Vector3(s * 0.24, 0.17, -0.06), [0.15, 0, s * 0.55], [0.0, -s * 0.12], 'bubble', (b, sg, i) => {
          const band = mesh(new THREE.TorusGeometry(sg.rad * 0.45, 0.013, 8, 16), mat('chrome', '#cfeeff'), b, 0, 0.0, 0); band.rotation.x = Math.PI / 2;
          const streak = mesh(new THREE.SphereGeometry(1, 12, 8), am, b, s * sg.rad * 0.55, -sg.len * 0.5, 0); streak.scale.set(sg.rad * 0.38, sg.len * 0.5, sg.rad * 0.5);
        });
        mesh(starGeometry(0.03, 0.4), mat('emissive', '#dff4ff', { intensity: 2.2 }), head, s * 0.2, 0.22, 0.1).rotation.set(-0.3, s * 0.4, 0);
        this.chains.push(new SpringChain(ch.bones, ch.rest, { stiff: 60, damp: 5, gain: 0.03 }));
        // icy face-framing strand
        const fs = [0.08, 0.08, 0.07].map((len, i) => ({ len, rad: [0.03, 0.026, 0.02][i] }));
        const fc = hairChain(head, fs, am, new THREE.Vector3(s * 0.25, 0.05, 0.12), [0.05, 0, s * 0.12], [0, 0]);
        this.chains.push(new SpringChain(fc.bones, fc.rest, { stiff: 90, damp: 7, gain: 0.02 }));
      }
    }
    if (style === 'braids') {
      mesh(capGeometry(R * 1.04, 1.02, 2.0, 2.25), hm, head).material = withSide(hm);
      const top = mesh(new THREE.SphereGeometry(R * 0.92, 24, 16), hm, head, 0, 0.09, -0.04); top.scale.set(1.04, 0.74, 1.04);
      // deep side-swept fringe + sleek sides
      mesh(bangsGeometry(R * 1.075, Math.PI / 2 - 0.3, 1.5, 0.42, 1.18, { scallops: 3, amp: 0.08, puff: 0.08, tilt: 0.3 }), hm, head).material = withSide(hm);
      for (const s of [-1, 1]) mesh(bangsGeometry(R * 1.05, Math.PI / 2 + s * 1.0, 0.45, 0.95, 2.2, { scallops: 2, amp: 0.12, puff: 0.06 }), hm, head).material = withSide(hm);
      for (const s of [-1, 1]) {
        const segs = Array.from({ length: 10 }, (_, i) => ({ len: 0.085, rad: 0.06 - i * 0.0015 }));
        const ch = hairChain(head, segs, hm, new THREE.Vector3(s * 0.19, -0.06, -0.2), [0.4, 0, s * 0.1], [-0.038, -s * 0.008], 'braid', (b, sg, i) => {
          if (i === 9) { const cuff = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 12), mat('chrome', '#e2e4ea'), b, 0, -sg.len * 0.9, 0); const tuft = mesh(new THREE.ConeGeometry(0.035, 0.1, 10), hm, b, 0, -sg.len * 1.4, 0); tuft.rotation.x = Math.PI; }
          if (i === 4) mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 14), mat('chrome', '#e2e4ea'), b, 0, -sg.len * 0.5, 0).rotation.x = Math.PI / 2;
        });
        this.chains.push(new SpringChain(ch.bones, ch.rest, { stiff: 45, damp: 4.5, gain: 0.03 }));
      }
    }
    if (style === 'buns') {
      mesh(capGeometry(R * 1.04, 1.04, 2.0, 2.3), hm, head).material = withSide(hm);
      for (const s of [-1, 1]) {
        const bun = mesh(new THREE.SphereGeometry(0.125, 24, 18), hm, head, s * 0.17, 0.27, -0.04);
        const sw = mesh(new THREE.TorusGeometry(0.1, 0.028, 10, 28), am, bun, 0, 0, 0); sw.rotation.set(Math.PI / 2 + 0.3, 0, s * 0.4);
        const sw2 = mesh(new THREE.TorusGeometry(0.06, 0.022, 10, 24), am, bun, 0, 0.06, 0.02); sw2.rotation.set(Math.PI / 2 - 0.2, 0, 0);
        const charm = mesh(starGeometry(0.035, 0.4), mat('chrome', '#ffd36b'), bun, s * 0.06, 0.02, 0.11); charm.rotation.y = s * 0.3;
      }
      mesh(bangsGeometry(R * 1.06, Math.PI / 2, 1.4, 0.55, 1.2, { scallops: 6, amp: 0.13, puff: 0.04 }), hm, head).material = withSide(hm);
      for (const s of [-1, 1]) mesh(bangsGeometry(R * 1.085, Math.PI / 2 + s * 0.45, 0.16, 0.48, 1.18, { scallops: 1, amp: 0.05, puff: 0.07 }), am, head).material = withSide(am);
      for (const s of [-1, 1]) mesh(bangsGeometry(R * 1.04, Math.PI / 2 + s * 1.05, 0.32, 1.0, 2.0, { scallops: 2, amp: 0.16, puff: 0.05 }), hm, head).material = withSide(hm);
      // loose hair at the back and tendrils
      for (let k = -1; k <= 1; k++) {
        const segs = [0.11, 0.11, 0.1, 0.09].map((len, i) => ({ len, rad: [0.09, 0.085, 0.075, 0.055][i], flat: 0.55 }));
        const ch = hairChain(head, segs, hm, new THREE.Vector3(k * 0.13, -0.05, -0.25), [0.2, 0, k * 0.12], [0.03, 0]);
        this.chains.push(new SpringChain(ch.bones, ch.rest, { stiff: 60, damp: 5, gain: 0.03 }));
      }
      for (const s of [-1, 1]) {
        const fs = [0.07, 0.07, 0.06].map((len, i) => ({ len, rad: [0.026, 0.022, 0.018][i] }));
        const fc = hairChain(head, fs, am, new THREE.Vector3(s * 0.25, 0.02, 0.13), [0.0, 0, s * 0.1], [0.1, -s * 0.15]);
        this.chains.push(new SpringChain(fc.bones, fc.rest, { stiff: 90, damp: 6, gain: 0.02 }));
      }
    }
  }

  // ---- per-frame ----
  applyPose(p) {
    const J = this.j;
    const r = this.root;
    const c = Math.cos(this.base.rot), s = Math.sin(this.base.rot);
    r.position.set(this.base.x + p.rootDX * c + p.rootDZ * s, this.base.y + p.rootY, this.base.z - p.rootDX * s + p.rootDZ * c);
    r.rotation.y = this.base.rot + p.rootRot;
    J.hips.position.set(p.hipX, HIP_Y + p.hipY, p.hipZ || 0);
    J.hips.rotation.set(p.hip[0], p.hip[1], p.hip[2]);
    J.waist.rotation.set(p.torso[0] * 0.5, p.torso[1] * 0.5, p.torso[2] * 0.5);
    J.chest.rotation.set(p.torso[0] * 0.5 + (p.chest || 0), p.torso[1] * 0.5, p.torso[2] * 0.5);
    J.neck.rotation.set(p.head[0] * 0.35, p.head[1] * 0.35, p.head[2] * 0.35);
    J.head.rotation.set(p.head[0] * 0.65, p.head[1] * 0.65, p.head[2] * 0.65);
    const arm = (L, a, sgn) => {
      J['shoulder' + L].rotation.set(-a[0], sgn * a[2], sgn * a[1]);
      J['elbow' + L].rotation.set(-a[3], 0, 0);
      J['wrist' + L].rotation.set(-(a[4] || 0), 0, 0);
    };
    arm('L', p.armL, 1); arm('R', p.armR, -1);
    const leg = (L, l, sgn) => {
      J['thigh' + L].rotation.set(-l[0], sgn * l[2], sgn * l[1]);
      J['knee' + L].rotation.set(l[3], 0, 0);
      J['ankle' + L].rotation.set(l[4] !== undefined ? l[4] : -(l[3] - l[0]) * 0.9, 0, 0);
    };
    leg('L', p.legL, 1); leg('R', p.legR, -1);
    // shadow stays on the floor
    this.blob.position.set(0, 0.012 - p.rootY, 0);
    this.blob.scale.setScalar(1 - Math.min(0.5, p.rootY * 1.2));
  }

  // Bring the mic to the mouth with two-bone IK; w = 0..1
  micToMouth(w) {
    const J = this.j;
    if (w <= 0.001) { this.mic.quaternion.setFromUnitVectors(UP, this.micDefault); return; }
    this.root.updateMatrixWorld(true);
    const head = J.head, chest = J.chest, sh = J.shoulderR;
    // target grip in head space: below and in front of the mouth
    const grip = _v.set(-0.03, -0.43, 0.42);
    head.localToWorld(grip);
    const mouth = _v2.set(0, -0.2, 0.34);
    head.localToWorld(mouth);
    // IK in chest space
    const T = chest.worldToLocal(grip.clone());
    const S = sh.position;
    const a = UPPER, b = FORE + 0.05;
    const D = T.clone().sub(S);
    let d = D.length();
    d = THREE.MathUtils.clamp(d, Math.abs(a - b) + 0.02, a + b - 0.005);
    const dir = D.normalize();
    const cosA = THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
    const alpha = Math.acos(cosA);
    const pole = new THREE.Vector3(-0.7, -1, -0.35).normalize();
    const pp = pole.sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
    const u = dir.clone().multiplyScalar(Math.cos(alpha)).add(pp.multiplyScalar(Math.sin(alpha))).normalize();
    const yL = u.clone().negate();
    const zL = dir.clone().sub(u.clone().multiplyScalar(dir.dot(u))).normalize();
    const xL = new THREE.Vector3().crossVectors(yL, zL);
    _m.makeBasis(xL, yL, zL);
    const qIK = _q.setFromRotationMatrix(_m);
    const cosE = THREE.MathUtils.clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1);
    const bend = Math.PI - Math.acos(cosE);
    const k = w * w * (3 - 2 * w);
    sh.quaternion.slerp(qIK, k);
    J.elbowR.rotation.x = THREE.MathUtils.lerp(J.elbowR.rotation.x, -bend, k);
    J.wristR.rotation.x *= 1 - k;
    sh.updateMatrixWorld(true);
    // mic points at the mouth
    const wristQ = J.wristR.getWorldQuaternion(_q2).invert();
    const micW = this.mic.getWorldPosition(_v3);
    const aim = mouth.sub(micW).normalize().applyQuaternion(wristQ);
    const dirL = this.micDefault.clone().lerp(aim, k).normalize();
    this.mic.quaternion.setFromUnitVectors(UP, dirL);
  }

  updatePhysics(dt) {
    for (const c of this.chains) c.update(dt);
    // skirt sway
    if (this.skirt) {
      const S = this.skirtSpring;
      this.j.hips.getWorldPosition(_v);
      if (!S.init || dt <= 0 || dt > 0.25) { S.prev.copy(_v); S.pv.set(0, 0, 0); S.init = true; }
      const vel = _v2.copy(_v).sub(S.prev).divideScalar(Math.max(dt, 1e-3));
      const acc = _v3.copy(vel).sub(S.pv).divideScalar(Math.max(dt, 1e-3)).clampLength(0, 40);
      S.prev.copy(_v); S.pv.copy(vel);
      this.j.hips.getWorldQuaternion(_q).invert(); acc.applyQuaternion(_q);
      const h = Math.min(dt, 1 / 30);
      S.v.x += (80 * (acc.z * 0.004 - S.a.x) - 8 * S.v.x) * h;
      S.v.y += (80 * (-acc.x * 0.004 - S.a.y) - 8 * S.v.y) * h;
      S.a.x += S.v.x * h; S.a.y += S.v.y * h;
      S.a.clampLength(0, 0.25);
      this.j.bottom.rotation.set(S.a.x, 0, S.a.y);
      const flare = 1 + Math.min(0.18, vel.length() * 0.05);
      this.skirt.scale.x = flare; this.skirt.scale.z = flare * 0.88;
    }
  }

  updateFace(f) {
    if (this.face.paint(f)) this.faceTex.needsUpdate = true;
  }

  headWorld(target) { return this.j.head.getWorldPosition(target); }
}

function withSide(m) { const c = m.clone(); c.side = THREE.DoubleSide; return c; }

let _blob = null;
function blobTexture() {
  if (_blob) return _blob;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(20,0,30,0.9)'); g.addColorStop(0.5, 'rgba(20,0,30,0.45)'); g.addColorStop(1, 'rgba(20,0,30,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  _blob = new THREE.CanvasTexture(c);
  return _blob;
}
function letterTexture(ch, fg, bg) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = fg; x.font = '900 52px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.strokeStyle = bg; x.lineWidth = 6; x.strokeText(ch, 32, 35); x.fillText(ch, 32, 35);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
