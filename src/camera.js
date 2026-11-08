// Shot list: every cut, dolly, orbit and crane for the 180-second film.
import * as THREE from 'three';
import { BEAT, IMPACTS, sectionAt } from './timeline.js';
import { DOME_POS } from './city.js';

const ease = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerpV = (a, b, t) => a.clone().lerp(b, t);

function closeUp(id, { dist = 2.0, side = 0.25, up = 0.04, push = 0.15, fov = 30, lookDrop = 0.08, sway = 0, roll = 0 } = {}) {
  return (u, t, c, o) => {
    const h = c.head(id);
    const rot = c.rot(id);
    const d = dist - push * ease(u);
    const s = side + sway * Math.sin(u * Math.PI);
    o.pos.set(h.x + Math.sin(rot) * d + Math.cos(rot) * s, h.y + up, h.z + Math.cos(rot) * d - Math.sin(rot) * s);
    o.look.set(h.x, h.y - lookDrop, h.z);
    o.fov = fov; o.roll = roll;
  };
}
function orbit(center, { r0 = 6, r1 = r0, h0 = 2, h1 = h0, a0 = -0.6, a1 = 0.6, fov = 40, e = ease, lookY = null } = {}) {
  return (u, t, c, o) => {
    const k = e(u);
    const C = typeof center === 'function' ? center(c) : center;
    const a = a0 + (a1 - a0) * k, r = r0 + (r1 - r0) * k;
    o.pos.set(C.x + Math.sin(a) * r, h0 + (h1 - h0) * k, C.z + Math.cos(a) * r);
    o.look.set(C.x, lookY ?? C.y, C.z);
    o.fov = fov; o.roll = 0;
  };
}
function dolly(p0, p1, l0, l1, { fov0 = 45, fov1 = fov0, e = ease, roll = 0 } = {}) {
  return (u, t, c, o) => {
    const k = e(u);
    o.pos.copy(p0).lerp(p1, k);
    o.look.copy(l0).lerp(l1 || l0, k);
    o.fov = fov0 + (fov1 - fov0) * k; o.roll = roll;
  };
}
const group = (c) => c.center();
const headOf = (id) => (c) => c.head(id);

export const SHOTS = [
  // ---- city ----
  [0, 8, dolly(V(0, 260, 240), V(0, 190, 40), V(0, 70, -500), V(0, 40, -620), { fov0: 52, fov1: 48 })],
  [8, 12, (u, t, c, o) => { const z = 0 - 140 * ease(u); o.pos.set(6, 92 - 14 * u, z); o.look.set(-42, 80, z - 70); o.fov = 48; o.roll = 0.04; }],
  [12, 16, (u, t, c, o) => { const j = c.jeep(t); o.pos.set(j.x + 15 - 4 * u, j.y + 5, j.z + 20 - 3 * u); o.look.set(j.x, j.y + 1, j.z - 6); o.fov = 50; o.roll = -0.03; }],
  [16, 20, dolly(V(-8, 4, -150), V(-4, 6, -170), V(12, 50, -212), V(4, 70, -230), { fov0: 62, fov1: 58 })],
  [20, 26, (u, t, c, o) => { const k = easeIn(u); o.pos.set(0, 40 + 30 * ease(u), -280 - 360 * k); o.look.set(DOME_POS.x, 60, DOME_POS.z); o.fov = 52 - 14 * k; o.roll = 0; }],
  // ---- backstage ----
  [26, 28, dolly(V(5.4, 3.1, 4.2), V(4.0, 2.7, 3.6), V(-1, 1.5, -2.5), V(-0.6, 1.5, -2.8), { fov0: 56, fov1: 54 })],
  [28, 32, closeUp('amara', { dist: 2.7, side: 0.5, push: 0.25, fov: 32, lookDrop: 0.3 })],
  [32, 36, closeUp('yzel', { dist: 2.7, side: -0.5, push: 0.25, fov: 32, lookDrop: 0.3 })],
  [36, 40, closeUp('liway', { dist: 2.7, side: 0.5, push: 0.25, fov: 32, lookDrop: 0.3 })],
  [40, 44, closeUp('saya', { dist: 2.7, side: -0.5, push: 0.25, fov: 32, lookDrop: 0.3 })],
  [44, 48, closeUp('tala', { dist: 2.7, side: 0.5, push: 0.25, fov: 32, lookDrop: 0.3 })],
  // ---- stadium ----
  [48, 50.2, (u, t, c, o) => { const a = 1.1 + 0.5 * u; o.pos.set(Math.cos(a) * 78, 58 - 10 * u, Math.sin(a) * 78); o.look.set(0, 0, 0); o.fov = 55; o.roll = 0; }],
  [50.2, 52, dolly(V(0, 0.5, 9.5), V(0, 0.7, 8.2), V(0, 1.6, 0), V(0, 1.9, 0), { fov0: 42, fov1: 40 })],
  [52, 56, (u, t, c, o) => { const k = easeOut(clamp(u * 1.6)); o.pos.copy(lerpV(V(0, 4, 18), V(0, 1.0, 7.2), k)); o.look.set(0, 2.0, 0); o.fov = 46 - 6 * k; o.roll = 0; }],
  [56, 60, closeUp('amara', { dist: 2.05, side: 0.3, push: 0.2, fov: 30 })],
  [60, 64, orbit(headOf('amara'), { r0: 3.4, r1: 2.9, h0: 1.9, h1: 1.7, a0: -0.55, a1: 0.45, fov: 36 })],
  [64, 68, closeUp('liway', { dist: 2.0, side: -0.3, push: 0.15, fov: 30, sway: 0.25 })],
  [68, 72, dolly(V(-3, 3.2, 13), V(3, 3.0, 12), V(0, 1.4, 0), V(0, 1.4, 0), { fov0: 40 })],
  [72, 76, closeUp('tala', { dist: 2.1, side: 0.2, push: 0.1, fov: 31 })],
  [76, 80, dolly(V(0, 0.35, 6.4), V(0, 3.2, 8.4), V(0, 2.2, 0), V(0, 1.4, 0), { fov0: 44, fov1: 40 })],
  [80, 84, dolly(V(0, 2.4, 12.5), V(0, 2.2, 11), V(0, 1.4, 0.3), V(0, 1.5, 0.3), { fov0: 42 })],
  [84, 88, orbit(V(0, 1.4, 0.3), { r0: 8, r1: 7, h0: 2.6, h1: 2.0, a0: 0.95, a1: -0.95, fov: 42 })],
  [88, 92, (u, t, c, o) => { o.pos.set(Math.sin(u * 0.8) * 2, 17 - 3 * u, 3.5); o.look.set(0, 0, 0.5); o.fov = 48; o.roll = u * 0.4; }],
  [92, 96, dolly(V(-1, 1.7, 7.4), V(1, 1.7, 6.9), V(0, 1.6, 0.5), V(0, 1.6, 0.5), { fov0: 40 })],
  [96, 100, closeUp('saya', { dist: 2.0, side: 0.35, push: 0.15, fov: 30, roll: 0.14 })],
  [100, 104, (u, t, c, o) => { const h = c.head('saya'); o.pos.set(h.x + 0.9 - 0.5 * u, 0.55, h.z + 2.4); o.look.set(h.x, h.y - 0.3, h.z); o.fov = 42; o.roll = -0.06; }],
  [104, 108, closeUp('yzel', { dist: 2.0, side: -0.3, push: 0.15, fov: 30, roll: -0.12 })],
  [108, 112, orbit(headOf('yzel'), { r0: 5, r1: 4.2, h0: 1.4, h1: 1.8, a0: -0.9, a1: 0.6, fov: 38, lookY: 1.3 })],
  [112, 116, closeUp('liway', { dist: 2.0, side: 0.25, push: 0.12, fov: 30 })],
  [116, 120, closeUp('tala', { dist: 2.0, side: -0.25, push: 0.12, fov: 30 })],
  [120, 124, dolly(V(-7, 2.0, 27), V(-2, 5.5, 15), V(0, 1.6, 0), V(0, 1.4, 0), { fov0: 42, fov1: 40 })],
  [124, 128, dolly(V(9.5, 2.0, 3), V(6.5, 2.2, 8), V(0, 1.5, 0.4), V(0, 1.5, 0.4), { fov0: 40 })],
  [128, 130, closeUp('tala', { dist: 2.2, side: 0.3, push: 0.2, fov: 32 })],
  [130, 132, closeUp('yzel', { dist: 2.2, side: -0.3, push: 0.2, fov: 32 })],
  [132, 136, dolly(V(0, 24, 38), V(0, 30, 50), V(0, 0, 0), V(0, 0, 0), { fov0: 50 })],
  [136, 140, orbit(headOf('yzel'), { r0: 3.4, r1: 3.0, h0: 1.2, h1: 1.5, a0: -1.25, a1: 1.25, fov: 40, lookY: 1.2 })],
  [140, 144, dolly(V(-2, 0.45, 8.5), V(2, 0.55, 8), V(0, 1.6, 0.4), V(0, 1.6, 0.4), { fov0: 46 })],
  [144, 146, (u, t, c, o) => { o.pos.set(0, 14 - 2 * u, 1.2); o.look.set(0, 0, 0.6); o.fov = 46; o.roll = -u * 0.6; }],
  [146, 148, orbit(V(0, 1.3, 0.4), { r0: 6.5, r1: 5.5, h0: 1.8, h1: 1.6, a0: -Math.PI, a1: Math.PI, fov: 42, e: (x) => x })],
  [148, 152, closeUp('amara', { dist: 1.6, side: 0.12, push: 0.3, fov: 26, lookDrop: 0.06 })],
  [152, 156, (u, t, c, o) => { const h = c.head('amara'); const k = ease(u); const a = 0.3 - 0.9 * k; const r = 2.6 + 9 * k; o.pos.set(h.x + Math.sin(a) * r, 1.9 + 6 * k, h.z + Math.cos(a) * r); o.look.set(h.x, h.y - 0.2 + 3 * k, h.z); o.fov = 34 + 12 * k; o.roll = 0; }],
  [156, 160, dolly(V(0, 6.5, 23), V(0, 3.6, 15), V(0, 4.5, 0), V(0, 2.0, 0), { fov0: 56, fov1: 46 })],
  [160, 164, orbit(V(0, 1.4, 0.4), { r0: 7, r1: 6, h0: 2.4, h1: 1.8, a0: -1.0, a1: 0.9, fov: 42 })],
  [164, 166, closeUp('amara', { dist: 2.1, side: -0.3, push: 0.2, fov: 31 })],
  [166, 168, closeUp('liway', { dist: 2.1, side: 0.3, push: 0.2, fov: 31 })],
  [168, 172, dolly(V(0, 7, 14), V(0, 70, 92), V(0, 1.5, 0), V(0, 0, 0), { fov0: 46, fov1: 56, e: easeIn })],
  [172, 176, dolly(V(0, 0.8, 6.9), V(0, 1.05, 6.1), V(0, 1.9, 0.4), V(0, 1.85, 0.4), { fov0: 43, fov1: 41 })],
  [176, 180.1, dolly(V(0, 3, 11), V(0, 64, 74), V(0, 2, 0), V(0, 6, 0), { fov0: 46, fov1: 58, e: (x) => x * x * (3 - 2 * x) })],
];

const HOT = new Set(['drop', 'chorus1', 'chorus2', 'final', 'dance']);

export class CameraDirector {
  constructor(camera) {
    this.camera = camera;
    this.o = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 45, roll: 0 };
  }
  shotAt(t) {
    for (let i = SHOTS.length - 1; i >= 0; i--) if (t >= SHOTS[i][0]) return SHOTS[i];
    return SHOTS[0];
  }
  update(t, ctx) {
    const [t0, t1, fn] = this.shotAt(t);
    const u = clamp((t - t0) / (t1 - t0));
    const o = this.o;
    fn(u, t, ctx, o);
    // beat zoom + impact shake
    let fov = o.fov;
    const sec = sectionAt(t).id;
    const beat = t / BEAT;
    if (HOT.has(sec)) fov *= 1 - 0.035 * Math.exp(-((beat % 1 + 1) % 1) * 7);
    let shake = 0;
    for (const it of IMPACTS) if (t >= it && t < it + 0.6) shake = Math.max(shake, 1 - (t - it) / 0.6);
    const cam = this.camera;
    cam.position.copy(o.pos);
    if (shake > 0) cam.position.add(new THREE.Vector3(Math.sin(t * 91) * 0.05, Math.sin(t * 77) * 0.05, 0).multiplyScalar(shake));
    cam.up.set(Math.sin(o.roll), Math.cos(o.roll), 0);
    cam.lookAt(o.look);
    if (Math.abs(cam.fov - fov) > 1e-3) { cam.fov = fov; cam.updateProjectionMatrix(); }
    return { cut: t0, shotIndex: SHOTS.findIndex((s) => s[0] === t0) };
  }
}
