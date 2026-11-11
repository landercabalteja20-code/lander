// Sets for "What if people never normalized wearing clothes?" (part 1: helpers, bedroom, studio cutaways, street,
// bus, kitchen, laundry). Every scene's update() is a pure function of time, so frames render the same on any worker.
// People are doll-smooth cartoon bodies with no anatomy; the shots keep the framing waist-up or behind props anyway.
import * as THREE from 'three';
import { makeCharacter, envAt, blink } from '../../kit/character.js';
import * as P from '../../kit/props.js';
import { skyDome, skyEnvironment, Text3D, ease, ramp, lerp, clamp01 } from '../../kit/fx.js';

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const PI = Math.PI;
export const TLref = { TL: null };

// ------------------------------------------------------------------ timing helpers
const norm = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, '');
export function at(ref) {
  const TL = TLref.TL;
  const [base, off] = ref.split('+');
  const [idEdge, word] = base.split('@');
  const [id, edge] = idEdge.split('.');
  const l = TL.lines.find((x) => x.id === id);
  if (!l) throw new Error('no line ' + id);
  let t = edge === 'end' ? l.end : l.start;
  if (word) {
    const [wd, nth] = word.split('#');
    const hits = l.words.filter((x) => norm(x.w).startsWith(norm(wd)));
    const w = hits[(parseInt(nth || '1', 10)) - 1];
    if (!w) throw new Error(`no word ${word} in ${id}`);
    t = w.s;
  }
  return t + (off ? parseFloat(off) : 0);
}
export function talk(who, t, gain = 1) {
  const TL = TLref.TL;
  let v = 0;
  for (const l of TL.lines) {
    if (l.who !== who) continue;
    if (t >= l.start - 0.03 && t <= l.end + 0.12) v = Math.max(v, envAt(l.env, TL.fps, t - l.start));
  }
  return clamp01(v * gain);
}
export function world(c, node, local = [0, 0, 0]) {
  c.root.updateMatrixWorld(true);
  return (node ? c.nodes[node] : c.root).localToWorld(V(...local));
}

// ------------------------------------------------------------------ people helpers
export function person(name, x = 0, y = 0, z = 0, ry = 0) {
  const c = makeCharacter(name);
  c.root.position.set(x, y, z); c.root.rotation.y = ry;
  return c;
}
export function wear(c, prefix, on) { for (const [k, o] of Object.entries(c.nodes)) if (k.startsWith(prefix)) o.visible = on; }
export const REST = { arm_l: [0.0, 0, 0.07], arm_r: [0.0, 0, -0.07], fore_l: [-0.14, 0, 0], fore_r: [-0.14, 0, 0] };
export const SIT = { leg_l: [-1.5, 0, 0.05], leg_r: [-1.5, 0, -0.05], shin_l: [1.48, 0, 0], shin_r: [1.48, 0, 0] };
export const SITBED = { leg_l: [-1.48, 0, 0.03], leg_r: [-1.48, 0, -0.03], shin_l: [0.05, 0, 0], shin_r: [0.05, 0, 0] };
// walk cycle: ph advances 2*PI per two steps (~1.4 m)
export function walkNodes(ph, amt = 1, arms = true) {
  const s = Math.sin(ph), c = Math.cos(ph);
  const n = {
    leg_l: [0.42 * s * amt, 0, 0.02], leg_r: [-0.42 * s * amt, 0, -0.02],
    shin_l: [(0.08 + 0.62 * Math.max(0, -c)) * amt, 0, 0], shin_r: [(0.08 + 0.62 * Math.max(0, c)) * amt, 0, 0],
  };
  if (arms) Object.assign(n, { arm_l: [-0.34 * s * amt, 0, 0.07], arm_r: [0.34 * s * amt, 0, -0.07],
    fore_l: [-0.22 - 0.2 * Math.max(0, -s) * amt, 0, 0], fore_r: [-0.22 - 0.2 * Math.max(0, s) * amt, 0, 0] });
  return n;
}
export const bob = (ph, amt = 1) => (Math.abs(Math.cos(ph)) - 0.6) * 0.03 * amt;
// a person walking from a to b (THREE.Vector3, y = floor height) starting at t0 with speed m/s; returns progress
export function walkTo(c, a, b, t, t0, speed = 1.15, extra = {}) {
  const L = a.distanceTo(b), d = clamp01((t - t0) * speed / L) * L;
  const p = a.clone().lerp(b, L > 0 ? d / L : 0);
  const ph = d / 1.4 * PI * 2, moving = d < L - 1e-4 && t > t0 ? 1 : 0;
  c.root.position.set(p.x, p.y + bob(ph, moving), p.z);
  c.root.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
  c.pose({ lids: blink(t, extra.seed ?? 1), ...extra, nodes: { ...REST, ...(moving ? walkNodes(ph) : {}), ...(extra.nodes || {}) } });
  return d / L;
}

// ------------------------------------------------------------------ lights + small builders
export function sun(scene, color, intensity, pos, target, size = 6, res = 2048) {
  const l = new THREE.DirectionalLight(color, intensity);
  l.position.copy(pos); l.target.position.copy(target);
  l.castShadow = true; res = Math.min(res, globalThis.RQ?.shadowMax ?? res); l.shadow.mapSize.set(res, res);
  const c = l.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = 0.5; c.far = 120;
  l.shadow.bias = -0.0003; l.shadow.normalBias = 0.02; l.shadow.radius = 3;
  scene.add(l, l.target);
  return l;
}
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
export function signTex(lines, { w = 1024, h = 512, bg = '#f6efe0', fg = '#c0281f', font = 'Helvetica, Arial, sans-serif', border = null, sizes = null } = {}) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    if (border) { g.strokeStyle = border; g.lineWidth = h * 0.05; g.strokeRect(h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1); }
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    const n = lines.length;
    lines.forEach((ln, i) => {
      const sz = sizes ? sizes[i] : Math.min(h / (n + 0.6), w / (ln.length * 0.62));
      g.font = `900 ${sz}px ${font}`;
      g.fillText(ln, w / 2, h * (i + 0.5 + 0.3 * (0.5 - (i + 0.5) / n)) / n + h * 0.02);
    });
  });
}
export function signPlane(lines, w, h, opts = {}) {
  const tex = signTex(lines, { w: 1024, h: Math.round(1024 * h / w), ...opts });
  return P.mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, ...(opts.glow ? { emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: opts.glow } : {}) }), { cast: false });
}
export function T3(str, { size = 0.5, depth = 0.15, color = '#ff5fa8', emissive = 0.0, bevel = 0.02, stone = false, align = 'center' } = {}) {
  const t = new Text3D({ size, depth, color, bevel, emissive, align });
  if (stone) { t.mat.roughness = 0.88; t.mat.clearcoat = 0.0; }
  t.setText(str);
  return t;
}
export const pop = (t, t0, d = 0.35) => Math.max(0.0001, ease.back(ramp(t, t0, t0 + d)));
const lathe = (pts, seg = 40) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
export function labelBox(w, h, d, color, lines, fg = '#ffffff') {
  const tex = signTex(lines, { w: 256, h: Math.round(256 * h / w), bg: color, fg });
  const side = P.phys(color, { roughness: 0.5 });
  return P.mesh(new THREE.BoxGeometry(w, h, d), [side, side, side, side, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }), side]);
}
export function fannyPack(col = '#1fa39a', trim = '#126b64', s = 1) {
  const g = new THREE.Group();
  g.add(P.mesh(P.rbox(0.23 * s, 0.145 * s, 0.07 * s, 0.03 * s, 4), P.phys(col, { roughness: 0.75, sheen: 0.5 })));
  g.add(P.mesh(new THREE.TorusGeometry(0.08 * s, 0.004 * s, 6, 40, PI), P.phys('#1c1c1c', { roughness: 0.4 }), { y: 0.035 * s, z: 0.036 * s, rz: 0 }));
  g.add(P.mesh(new THREE.BoxGeometry(0.2 * s, 0.006 * s, 0.004 * s), P.phys('#1c1c1c'), { y: 0.035 * s, z: 0.036 * s }));
  g.add(P.mesh(P.rbox(0.016 * s, 0.03 * s, 0.006 * s, 0.003 * s), P.phys('#d9d9d9', { metalness: 0.8, roughness: 0.3 }), { x: 0.07 * s, y: 0.022 * s, z: 0.04 * s }));
  return g;
}
export function towelMat(a, b) {
  const tex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = a; g.fillRect(0, 0, w, h); g.fillStyle = b; for (let i = 0; i < 4; i++) g.fillRect(0, i * 32 + 4, w, 12); });
  return P.phys('#ffffff', { map: tex, roughness: 0.95, sheen: 1, sheenRoughness: 0.8, sheenColor: new THREE.Color('#ffffff') });
}
function alarmClock(text) {
  const g = new THREE.Group();
  g.add(P.mesh(P.rbox(0.2, 0.1, 0.08, 0.025), P.phys('#1d1f24', { roughness: 0.35, clearcoat: 0.6 }), { y: 0.05 }));
  const digits = canvasTex(256, 112, (c, w, h) => {
    c.fillStyle = '#060202'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ff2a1f'; c.font = 'bold 92px "DejaVu Sans Mono", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = '#ff2a1f'; c.shadowBlur = 12; c.fillText(text, w / 2, h / 2 + 4);
  });
  g.add(P.mesh(new THREE.PlaneGeometry(0.16, 0.07), new THREE.MeshStandardMaterial({ map: digits, emissive: '#ffffff', emissiveMap: digits, emissiveIntensity: 2.2, roughness: 0.2 }), { y: 0.05, z: 0.0405, cast: false }));
  return g;
}
function tableLamp() {
  const g = new THREE.Group();
  g.add(P.mesh(lathe([[0.0001, 0], [0.08, 0], [0.07, 0.03], [0.02, 0.05], [0.02, 0.32], [0.0001, 0.32]]), P.phys('#c9a46a', { metalness: 0.6, roughness: 0.3 })));
  g.add(P.mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.2, 32, 1, true), P.phys('#f3e6c8', { side: THREE.DoubleSide, roughness: 0.9, emissive: '#ffcf8a', emissiveIntensity: 0.25 }), { y: 0.38 }));
  return g;
}
function phoneMesh() {
  const g = new THREE.Group();
  g.add(P.mesh(P.rbox(0.075, 0.15, 0.009, 0.008), P.phys('#16171b', { roughness: 0.25, clearcoat: 1 })));
  g.add(P.mesh(new THREE.PlaneGeometry(0.066, 0.138), P.phys('#203a66', { emissive: '#2a5aa8', emissiveIntensity: 0.6, roughness: 0.1 }), { z: 0.0047, cast: false }));
  return g;
}
function keysMesh() {
  const g = new THREE.Group();
  const met = P.phys('#c9c4b8', { metalness: 0.9, roughness: 0.3 });
  g.add(P.mesh(new THREE.TorusGeometry(0.018, 0.0025, 8, 24), met));
  g.add(P.mesh(P.rbox(0.012, 0.055, 0.003, 0.0015), met, { x: 0.01, y: -0.04, rz: 0.3 }));
  g.add(P.mesh(P.rbox(0.012, 0.05, 0.003, 0.0015), P.phys('#d4a64a', { metalness: 0.9, roughness: 0.3 }), { x: -0.012, y: -0.038, rz: -0.35 }));
  return g;
}
function walletMesh() { return P.mesh(P.rbox(0.1, 0.075, 0.018, 0.006), P.phys('#5a3820', { roughness: 0.6, sheen: 0.4 })); }
// item that rides in a hand until `drop`, then falls (deterministic ballistic + one bounce) to floor y
export function carried(item, c, node, local, t, drop, floorY, spin = [3, 5, 2], kick = [0, 0.4, 0.6]) {
  const hand = () => world(c, node, local);
  if (t < drop) { item.position.copy(hand()); item.rotation.set(0.2, 0.3, 0); return; }
  const p0 = hand();   // the hand holds still after the drop, so this is where the item left it
  const dt = t - drop, g = 9.8;
  let y = p0.y + kick[1] * dt - 0.5 * g * dt * dt;
  const tHit = (kick[1] + Math.sqrt(kick[1] ** 2 + 2 * g * (p0.y - floorY))) / g;
  let x = p0.x + kick[0] * dt, z = p0.z + kick[2] * dt;
  if (dt > tHit) {
    const d2 = dt - tHit, v2 = (g * tHit - kick[1]) * 0.28;
    y = Math.max(floorY, floorY + v2 * d2 - 0.5 * g * d2 * d2);
    x = p0.x + kick[0] * (tHit + d2 * 0.5); z = p0.z + kick[2] * (tHit + Math.min(d2, 0.3) * 0.5);
  }
  item.position.set(x, Math.max(floorY, y), z);
  const k = Math.min(dt, tHit + 0.25);
  item.rotation.set(0.2 + spin[0] * k, 0.3 + spin[1] * k, spin[2] * k);
}

// =========================================================================================================
// BEDROOM (day + night)
function bedroom(engine, night) {
  const scene = new THREE.Scene();
  const R = {};
  scene.environmentIntensity = night ? 0.25 : 0.35;
  scene.background = new THREE.Color(night ? '#0b1020' : '#cfe3f5');
  scene.add(P.mesh(new THREE.PlaneGeometry(7, 7).rotateX(-PI / 2), P.phys('#ffffff', { map: P.woodFloorTex('#b07a4e', [4, 4]), roughness: 0.55, clearcoat: 0.2 }), { cast: false }));
  const wallM = P.phys(night ? '#8c9cb6' : '#dfe6ee', { roughness: 0.9 });
  const box = (w, h, d, x, y, z, m = wallM) => scene.add(P.mesh(new THREE.BoxGeometry(w, h, d), m, { x, y, z }));
  box(7, 3, 0.1, 0, 1.5, -2.65);
  // left wall with the closet opening (z -1.3..0.3, y 0..2.2)
  box(0.1, 3, 2.2, -3.05, 1.5, -2.4); box(0.1, 3, 3.2, -3.05, 1.5, 1.9); box(0.1, 0.8, 1.6, -3.05, 2.6, -0.5);
  // right wall with the window opening (z -1.25..0.05, y 0.92..2.17)
  box(0.1, 3, 2.25, 3.05, 1.5, -2.375); box(0.1, 3, 3.45, 3.05, 1.5, 1.775); box(0.1, 0.92, 1.3, 3.05, 0.46, -0.6); box(0.1, 0.83, 1.3, 3.05, 2.585, -0.6);
  const win = P.windowWithBlinds({ w: 1.3, h: 1.25, sill: 0.92, open: 0.6 }); win.position.set(3.0, 0, -0.6); scene.add(win);
  scene.add(P.mesh(new THREE.PlaneGeometry(4, 3).rotateY(-PI / 2), new THREE.MeshBasicMaterial({ color: night ? '#1d2a4c' : '#e9f4ff' }), { x: 3.6, y: 1.6, z: -0.6, cast: false }));
  // skirting + a framed print above the bed
  box(7, 0.1, 0.03, 0, 0.05, -2.59, P.phys('#f4f1ea'));
  const art = signPlane(['GOOD', 'MORNING'], 0.9, 0.6, { bg: '#f2c64a', fg: '#2a3a5a' }); art.position.set(0.2, 1.75, -2.58); scene.add(art);
  scene.add(P.mesh(P.rbox(0.98, 0.68, 0.03, 0.01), P.phys('#3a2a1e'), { x: 0.2, y: 1.75, z: -2.6 }));
  const bed = P.bed(); bed.position.set(0.2, 0, -1.45); bed.scale.x = -1; scene.add(bed);
  const ns = P.nightstand(); ns.position.set(1.42, 0, -2.3); scene.add(ns);
  const ns2 = P.nightstand(); ns2.position.set(-1.05, 0, -2.3); scene.add(ns2);
  R.alarm = alarmClock('6:30'); R.alarm.position.set(1.36, 0.55, -2.24); R.alarm.rotation.y = -0.3; scene.add(R.alarm);
  const lamp = tableLamp(); lamp.position.set(-1.05, 0.55, -2.38); scene.add(lamp);
  scene.add(P.rug(1.1)); scene.children[scene.children.length - 1].position.set(0.3, 0, 0.6);
  // closet: frame, recessed interior with snack shelves, two doors
  const cl = new THREE.Group(); cl.position.set(-3.0, 0, -0.5); scene.add(cl);
  const trim = P.phys('#f4f1ea', { roughness: 0.5 });
  cl.add(P.mesh(P.rbox(0.12, 2.25, 0.1, 0.02), trim, { x: 0.02, y: 1.125, z: -0.85 }), P.mesh(P.rbox(0.12, 2.25, 0.1, 0.02), trim, { x: 0.02, y: 1.125, z: 0.85 }),
    P.mesh(P.rbox(0.12, 0.1, 1.8, 0.02), trim, { x: 0.02, y: 2.25 }));
  { const im = P.phys('#f3e9d6', { side: THREE.DoubleSide, roughness: 0.9 });
    cl.add(P.mesh(new THREE.PlaneGeometry(1.6, 2.2).rotateY(PI / 2), im, { x: -0.62, y: 1.1, cast: false }),
      P.mesh(new THREE.PlaneGeometry(0.62, 1.6).rotateX(PI / 2), im, { x: -0.31, y: 2.2, cast: false }),
      P.mesh(new THREE.PlaneGeometry(0.62, 2.2), im, { x: -0.31, y: 1.1, z: -0.8, cast: false }), P.mesh(new THREE.PlaneGeometry(0.62, 2.2), im, { x: -0.31, y: 1.1, z: 0.8, cast: false })); }
  const snacks = [['#e8423a', ['CHIPS']], ['#f4c22e', ['CEREAL']], ['#2e7ce0', ['COOKIES']], ['#3fae5a', ['PRETZELS']], ['#9b4fd1', ['CANDY']], ['#ff8a2a', ['PUFFS']]];
  const rr = P.rng(4);
  for (let s = 0; s < 4; s++) {
    const y = 0.35 + s * 0.5;
    cl.add(P.mesh(P.rbox(0.5, 0.03, 1.56, 0.01), P.phys('#d9c4a0', { roughness: 0.6 }), { x: -0.3, y }));
    for (let i = 0; i < 6; i++) {
      if (s >= 2 && (i === 2 || i === 3)) continue;
      const [col, lab] = snacks[(i + s * 2) % 6];
      const h = 0.22 + rr() * 0.12, w = 0.2;
      const b = labelBox(0.14, h, w, col, lab); b.rotation.y = PI / 2; b.position.set(-0.3 + rr() * 0.08, y + 0.015 + h / 2, -0.65 + i * 0.26);
      cl.add(b);
    }
  }
  R.pantryLight = new THREE.PointLight('#ffe7b8', 0, 2.5, 2); R.pantryLight.position.set(-0.3, 2.0, 0); cl.add(R.pantryLight);
  R.doors = [-1, 1].map((s) => {
    const hinge = new THREE.Group(); hinge.position.set(0.05, 0, s * 0.8); cl.add(hinge);
    const panel = P.mesh(P.rbox(0.04, 2.15, 0.79, 0.015), P.phys('#efe9de', { roughness: 0.55 }), { y: 1.1, z: -s * 0.4 });
    hinge.add(panel);
    for (const y of [0.6, 1.55]) hinge.add(P.mesh(P.rbox(0.01, 0.62, 0.6, 0.008), P.phys('#e2dbcc'), { x: 0.022, y, z: -s * 0.4 }));
    hinge.add(P.mesh(new THREE.SphereGeometry(0.025, 16, 12), P.phys('#c9a24a', { metalness: 0.8, roughness: 0.3 }), { x: 0.05, y: 1.05, z: -s * 0.72 }));
    return { hinge, s };
  });
  R.chips = labelBox(0.14, 0.26, 0.2, '#e8423a', ['CHIPS']); R.chips.visible = false; scene.add(R.chips);
  // people
  R.sam = person('sam', 0.6, 0, -1.9); scene.add(R.sam.root);
  wear(R.sam, 'pack', false); wear(R.sam, 'apron', false); wear(R.sam, 'watch', false);
  if (night) {
    R.dog = person('dog_sweater', 0.25, 0, 0.35, 0.15); scene.add(R.dog.root);
    const cushion = P.mesh(new THREE.CylinderGeometry(0.45, 0.48, 0.12, 40), P.phys('#5a6fa8', { roughness: 0.95, sheen: 1 }), { x: 0.25, y: 0.06, z: 0.3 });
    scene.add(cushion);
    { const g = new THREE.Group(), a = T3('0', { size: 0.2, depth: 0.06, color: '#ffd23f', emissive: 0.25 }), b = T3('SECONDS', { size: 0.06, depth: 0.02, color: '#ffd23f', emissive: 0.25 });
      b.group.position.y = -0.1; g.add(a.group, b.group); g.position.set(-0.05, 1.5, -1.1); scene.add(g); R.zero = { group: g }; }
    const bt = new THREE.BoxGeometry(0.92, 0.07, 1.4, 24, 1, 32), bp = bt.attributes.position;
    for (let i = 0; i < bp.count; i++) { const x = bp.getX(i), z = bp.getZ(i); bp.setY(i, bp.getY(i) + (bp.getY(i) > 0 ? 0.06 * Math.exp(-(x * x) / 0.05) + 0.01 * Math.sin(z * 17) : 0) - (Math.abs(x) > 0.38 ? (Math.abs(x) - 0.38) * 0.9 : 0)); }
    bt.computeVertexNormals();
    R.blanket = P.mesh(bt, P.phys('#7d9cc8', { map: P.stripeTex('#7d9cc8', '#8eabd3', 16, [1, 1], true), roughness: 0.92, sheen: 0.8, sheenColor: new THREE.Color('#dfe8ff') }));
    scene.add(R.blanket);
  } else {
    { const g = new THREE.Group(), a = T3('10', { size: 0.16, depth: 0.05, color: '#ffd23f', emissive: 0.15 }), b = T3('SECONDS', { size: 0.05, depth: 0.02, color: '#ffd23f', emissive: 0.15 });
      b.group.position.y = -0.085; g.add(a.group, b.group); scene.add(g); R.ten = { group: g }; }
    R.watchProp = new THREE.Group();
  }
  // lights
  if (night) {
    const moon = sun(scene, '#8fa8e0', 0.9, V(9, 4.0, -0.4), V(0, 0, -0.8), 4.5);
    scene.add(new THREE.HemisphereLight('#3a4a78', '#1a1410', 0.35));
    const lp = new THREE.PointLight('#ffc27a', 3.2, 6, 2); lp.position.set(-1.05, 1.0, -2.2); lp.castShadow = false; scene.add(lp);
    const fill = new THREE.PointLight('#7d8fc4', 1.5, 8, 2); fill.position.set(0.5, 2.4, 1.6); scene.add(fill);
    R.moon = moon;
  } else {
    sun(scene, '#ffe2b8', 2.6, V(9, 4.5, -0.2), V(0, 0, -0.8), 4.5);
    scene.add(new THREE.HemisphereLight('#e3eeff', '#8a6a50', 0.4));
    const fill = new THREE.PointLight('#fff2e0', 2.2, 9, 2); fill.position.set(0.0, 2.6, 1.8); scene.add(fill);
  }
  return {
    scene, R, exposure: night ? 0.95 : 0.85,
    grade: night ? { warmth: -0.02, saturation: 1.05, vignette: 0.45 } : {},
    update(c) {
      R.doors.forEach((d) => { d.hinge.rotation.y = 0; });
      R.pantryLight.intensity = 0;
      R.chips.visible = false;
      R.sam.root.visible = true; R.sam.root.rotation.set(0, 0, 0);
      R.alarm.rotation.set(0, -0.3, 0); R.alarm.position.y = 0.55;
      if (R.ten) R.ten.group.visible = false;
      if (R.zero) R.zero.group.visible = false;
      if (R.blanket) R.blanket.visible = false;
    },
  };
}

// =========================================================================================================
// STUDIO: pale cyclorama for the cutaways. Only one station is visible per shot (shot.station).
function studio(engine) {
  const scene = new THREE.Scene();
  const R = { st: {} };
  const bg = '#8ec3d8';
  scene.environmentIntensity = 0.3;
  scene.background = new THREE.Color(bg); scene.fog = new THREE.Fog(bg, 9, 26);
  scene.add(P.mesh(new THREE.PlaneGeometry(80, 80).rotateX(-PI / 2), P.phys('#a7d0df', { roughness: 0.95 }), { cast: false }));
  sun(scene, '#fff4e6', 2.3, V(3, 7, 5), V(0, 0.5, 0), 5);
  scene.add(new THREE.HemisphereLight('#ffffff', '#6f8f9c', 0.5));
  const rim = new THREE.DirectionalLight('#dfe9ff', 1.0); rim.position.set(-4, 3, -4); scene.add(rim);
  const st = (name) => { const g = new THREE.Group(); g.name = name; scene.add(g); R.st[name] = g; return g; };
  const ped = (r = 0.38, h = 0.6, col = '#ffffff') => P.mesh(new THREE.CylinderGeometry(r, r * 1.04, h, 48), P.phys(col, { roughness: 0.4, clearcoat: 0.3 }), { y: h / 2 });
  const xMark = () => {
    const g = new THREE.Group(); const m = P.phys('#e3342f', { roughness: 0.3, clearcoat: 0.8, emissive: '#e3342f', emissiveIntensity: 0.15 });
    g.add(P.mesh(P.rbox(0.62, 0.11, 0.08, 0.04), m, { rz: PI / 4 }), P.mesh(P.rbox(0.62, 0.11, 0.08, 0.04), m, { rz: -PI / 4 }));
    return g;
  };
  // --- icons: an outfit on a hanger, an iron, odd socks
  {
    const g = st('icons');
    const shirt = new THREE.Shape();
    shirt.moveTo(-0.12, 0.25); shirt.lineTo(-0.3, 0.17); shirt.lineTo(-0.36, 0.02); shirt.lineTo(-0.24, -0.02); shirt.lineTo(-0.2, 0.06);
    shirt.lineTo(-0.2, -0.3); shirt.lineTo(0.2, -0.3); shirt.lineTo(0.2, 0.06); shirt.lineTo(0.24, -0.02); shirt.lineTo(0.36, 0.02); shirt.lineTo(0.3, 0.17); shirt.lineTo(0.12, 0.25);
    shirt.quadraticCurveTo(0, 0.17, -0.12, 0.25);
    const items = [];
    const it1 = new THREE.Group();
    it1.add(P.mesh(new THREE.ExtrudeGeometry(shirt, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3 }), P.phys('#3d7fd6', { roughness: 0.8, sheen: 0.6 }), { y: 0.0, z: -0.02 }));
    it1.add(P.mesh(new THREE.TorusGeometry(0.035, 0.007, 8, 24, PI * 1.4), P.phys('#c9c4b8', { metalness: 0.9, roughness: 0.3 }), { y: 0.33, rz: -0.6 }));
    it1.add(P.mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 8).rotateZ(PI / 2 - 0.45), P.phys('#8a5a3a'), { x: -0.13, y: 0.24 }), P.mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 8).rotateZ(-PI / 2 + 0.45), P.phys('#8a5a3a'), { x: 0.13, y: 0.24 }));
    const it2 = new THREE.Group();
    const iron = new THREE.Shape(); iron.moveTo(-0.22, 0); iron.lineTo(0.18, 0); iron.quadraticCurveTo(0.3, 0.02, 0.32, 0.0); iron.quadraticCurveTo(0.12, 0.15, -0.22, 0.14); iron.lineTo(-0.22, 0);
    const ig = new THREE.ExtrudeGeometry(iron, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 4 }); ig.translate(0, 0, -0.1);
    it2.add(P.mesh(ig, P.phys('#e8e2d6', { roughness: 0.35, clearcoat: 0.6 }), { rx: 0, ry: -0.5 }));
    it2.add(P.mesh(new THREE.BoxGeometry(0.48, 0.03, 0.22), P.phys('#b9c2cc', { metalness: 0.9, roughness: 0.25 }), { y: -0.015, ry: -0.5 }));
    it2.add(P.mesh(new THREE.TorusGeometry(0.1, 0.022, 10, 24, PI), P.phys('#3d7fd6', { roughness: 0.4 }), { y: 0.16, ry: -0.5 }));
    const it3 = new THREE.Group();
    const sock = (col, stripe, x, ry) => {
      const s = new THREE.Group();
      const m1 = P.phys(col, { roughness: 0.9, sheen: 1, sheenColor: new THREE.Color('#ffffff') });
      s.add(P.mesh(new THREE.CapsuleGeometry(0.055, 0.26, 8, 16), m1, { y: 0.17 }), P.mesh(new THREE.CapsuleGeometry(0.052, 0.16, 8, 16).rotateX(PI / 2), m1, { y: 0.03, z: 0.09 }));
      if (stripe) for (const y of [0.22, 0.28]) s.add(P.mesh(new THREE.TorusGeometry(0.056, 0.012, 8, 24).rotateX(PI / 2), P.phys(stripe, { roughness: 0.9 }), { y }));
      s.position.x = x; s.rotation.y = ry; return s;
    };
    it3.add(sock('#f2f0ea', '#e3342f', -0.1, 0.4), sock('#5a5f6a', null, 0.12, -0.3));
    [[it1, -1.25, 0.95], [it2, 0, 0.72], [it3, 1.25, 0.66]].forEach(([it, x, y]) => {
      const p = ped(); p.position.x = x; g.add(p);
      it.position.set(x, y, 0); g.add(it);
      const xm = xMark(); xm.position.set(x, y + 0.05, 0.3); g.add(xm);
      items.push({ it, xm, x, y });
    });
    R.icons = items;
  }
  // --- the best-selling fanny pack, and the planet wearing one
  {
    const g = st('pack');
    const p = ped(0.6, 0.8, '#2a2d34'); g.add(p);
    R.packTurn = new THREE.Group(); R.packTurn.position.y = 0.8; g.add(R.packTurn);
    const fp = fannyPack('#1fa39a', '#126b64', 3.2); fp.position.y = 0.26; R.packTurn.add(fp);
    const strap = P.mesh(new THREE.TorusGeometry(0.62, 0.035, 10, 64), P.phys('#126b64', { roughness: 0.7 }), { y: 0.33, rx: PI / 2, s: [1, 0.55, 1] });
    strap.position.z = -0.35; R.packTurn.add(strap);
    R.one = T3('#1', { size: 0.62, depth: 0.16, color: '#f2c64a', emissive: 0.12 }); R.one.group.position.set(0, 2.05, 0); g.add(R.one.group);
    R.best = T3('BEST-SELLING', { size: 0.1, depth: 0.03, color: '#ffffff', emissive: 0.1 }); R.best.group.position.set(0, 1.78, 0.1); g.add(R.best.group);
    const spot = new THREE.SpotLight('#fff6e0', 30, 12, 0.5, 0.6, 1.5); spot.position.set(0, 6, 2); spot.target = p; g.add(spot);
  }
  {
    const g = st('globe');
    const tex = canvasTex(1024, 512, (c, w, h) => {
      c.fillStyle = '#2f6fb8'; c.fillRect(0, 0, w, h);
      const r = P.rng(8);
      const blob = (x, y, s, col) => { c.fillStyle = col; for (let i = 0; i < 26; i++) { c.beginPath(); c.arc(x + (r() - 0.5) * s * 1.6, y + (r() - 0.5) * s * 0.9, s * (0.25 + r() * 0.45), 0, PI * 2); c.fill(); } };
      [[180, 160, 110], [250, 330, 80], [520, 150, 120], [560, 300, 90], [760, 170, 130], [840, 360, 70], [430, 470, 160]].forEach(([x, y, s], i) => blob(x, y, s, i === 6 ? '#eef3f6' : (i % 2 ? '#5aa04a' : '#7ab356')));
      c.fillStyle = '#eef3f6'; c.fillRect(0, 0, w, 26); c.fillRect(0, h - 22, w, 22);
    });
    R.earth = P.mesh(new THREE.SphereGeometry(1.2, 64, 48), P.phys('#ffffff', { map: tex, roughness: 0.6, clearcoat: 0.4 }), { y: 1.5 });
    g.add(R.earth);
    const clouds = canvasTex(512, 256, (c, w, h) => { c.clearRect(0, 0, w, h); const r = P.rng(3); c.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 70; i++) { c.beginPath(); c.ellipse(r() * w, 30 + r() * (h - 60), 10 + r() * 30, 5 + r() * 9, 0, 0, PI * 2); c.fill(); } });
    R.clouds = P.mesh(new THREE.SphereGeometry(1.24, 48, 32), new THREE.MeshStandardMaterial({ map: clouds, transparent: true, depthWrite: false, roughness: 1 }), { y: 1.5, cast: false });
    g.add(R.clouds);
    const belt = P.mesh(new THREE.TorusGeometry(1.215, 0.045, 12, 96), P.phys('#126b64', { roughness: 0.7 }), { y: 1.5, rx: PI / 2 + 0.12 });
    g.add(belt);
    const gp = fannyPack('#1fa39a', '#126b64', 4.2); gp.position.set(0, 1.37, 1.2); gp.rotation.x = 0.12; g.add(gp);
    for (let i = 0; i < 60; i++) { const r = P.rng(i + 50); const s = P.mesh(new THREE.SphereGeometry(0.015 + r() * 0.02, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), { x: (r() - 0.5) * 14, y: r() * 7, z: -6 - r() * 6, cast: false }); g.add(s); }
    g.userData.dark = true;
  }
  // --- a police uniform that shrinks to a hat and a badge
  {
    const g = st('uniform');
    const navy = P.phys('#1d2a44', { roughness: 0.8, sheen: 0.5 });
    const shirt = new THREE.Shape();
    shirt.moveTo(-0.14, 0.3); shirt.lineTo(-0.36, 0.2); shirt.lineTo(-0.44, -0.1); shirt.lineTo(-0.32, -0.14); shirt.lineTo(-0.25, 0.02);
    shirt.lineTo(-0.25, -0.42); shirt.lineTo(0.25, -0.42); shirt.lineTo(0.25, 0.02); shirt.lineTo(0.32, -0.14); shirt.lineTo(0.44, -0.1); shirt.lineTo(0.36, 0.2); shirt.lineTo(0.14, 0.3);
    shirt.quadraticCurveTo(0, 0.2, -0.14, 0.3);
    R.uShirt = P.mesh(new THREE.ExtrudeGeometry(shirt, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 }), navy, { y: 1.55, z: -0.03 });
    R.uPants = new THREE.Group(); R.uPants.position.y = 0.95;
    for (const x of [-0.12, 0.12]) R.uPants.add(P.mesh(new THREE.CapsuleGeometry(0.1, 0.62, 6, 14), navy, { x, y: -0.36 }));
    R.uPants.add(P.mesh(P.rbox(0.5, 0.16, 0.2, 0.05), navy, { y: 0.02 }), P.mesh(P.rbox(0.52, 0.05, 0.22, 0.02), P.phys('#141414', { roughness: 0.3, clearcoat: 0.8 }), { y: 0.1 }));
    R.uShoes = new THREE.Group();
    for (const x of [-0.13, 0.13]) R.uShoes.add(P.mesh(P.rbox(0.13, 0.1, 0.3, 0.04), P.phys('#0c0c0e', { roughness: 0.2, clearcoat: 1 }), { x, y: 0.05, z: 0.05 }));
    R.uCap = new THREE.Group(); R.uCap.position.y = 2.05;
    R.uCap.add(P.mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.09, 32), navy), P.mesh(new THREE.CylinderGeometry(0.19, 0.16, 0.05, 32), navy, { y: 0.06, s: [1, 1, 1.08] }));
    R.uCap.add(P.mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.012, 24, 1, false, -PI / 2, PI), P.phys('#0c0c10', { roughness: 0.2, clearcoat: 1 }), { y: -0.04, z: 0.08, rx: 0.25 }));
    R.uCap.add(P.mesh(new THREE.BoxGeometry(0.26, 0.02, 0.01), P.phys('#e3c25a', { metalness: 0.9, roughness: 0.3 }), { y: -0.02, z: 0.141 }));
    R.uBadge = new THREE.Group(); R.uBadge.position.set(-0.13, 1.62, 0.07);
    const star = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2 + PI / 2, rr = i % 2 ? 0.035 : 0.08; (i ? star.lineTo : star.moveTo).call(star, Math.cos(a) * rr, Math.sin(a) * rr); }
    R.uBadge.add(P.mesh(new THREE.ExtrudeGeometry(star, { depth: 0.015, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 2 }), P.phys('#e2b84a', { metalness: 0.9, roughness: 0.25 })));
    g.add(R.uShirt, R.uPants, R.uShoes, R.uCap, R.uBadge);
    g.add(P.mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.9, 8), P.phys('#9a9a9a', { metalness: 0.8 }), { x: 0.0, y: 0.95, z: -0.25 }), P.mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.03, 24), P.phys('#9a9a9a', { metalness: 0.8 }), { y: 0.015, z: -0.25 }));
    R.minimum = T3('BARE MINIMUM', { size: 0.1, depth: 0.03, color: '#1d2a44' }); R.minimum.group.position.set(0, 2.38, 0); g.add(R.minimum.group);
  }
  // --- lice family tree
  {
    const g = st('lice');
    const mk = (pts) => new THREE.CatmullRomCurve3(pts.map((p) => V(...p)));
    R.trunk = mk([[0, 0.0, 0], [0.04, 0.5, 0], [-0.03, 1.0, 0], [0, 1.4, 0]]);
    R.brUp = mk([[0, 1.4, 0], [-0.15, 1.75, 0], [-0.5, 2.05, 0], [-0.62, 2.35, 0]]);
    R.brDn = mk([[0, 1.4, 0], [0.15, 1.75, 0], [0.5, 2.05, 0], [0.62, 2.35, 0]]);
    const lm = P.phys('#4a7fd6', { roughness: 0.3, clearcoat: 0.8, emissive: '#2a5ab0', emissiveIntensity: 0.2 });
    R.tubes = [R.trunk, R.brUp, R.brDn].map((cv) => { const m = P.mesh(new THREE.TubeGeometry(cv, 120, 0.045, 12, false), lm); g.add(m); return m; });
    R.node = P.mesh(new THREE.SphereGeometry(0.08, 24, 16), P.phys('#f2c64a', { emissive: '#f2c64a', emissiveIntensity: 0.25 }), { y: 1.4 }); g.add(R.node);
    R.lblHead = T3('HEAD LICE', { size: 0.075, depth: 0.025, color: '#1d2a44' }); R.lblHead.group.position.set(-0.62, 2.95, 0); g.add(R.lblHead.group);
    R.lblBody = T3('BODY LICE', { size: 0.075, depth: 0.025, color: '#1d2a44' }); R.lblBody.group.position.set(0.62, 2.95, 0); g.add(R.lblBody.group);
    R.lblYears = new THREE.Group(); R.lblYears.position.set(0, 1.12, 0.08); g.add(R.lblYears);
    const y1 = T3('170,000', { size: 0.12, depth: 0.04, color: '#c0392b' }), y2 = T3('YEARS AGO', { size: 0.055, depth: 0.02, color: '#c0392b' });
    y2.group.position.y = -0.1; R.lblYears.add(y1.group, y2.group); R.lblYears = { group: R.lblYears };
    R.hair = P.mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.9, 10).rotateZ(PI / 2 - 0.25), P.phys('#3a2618', { roughness: 0.4 }), { x: -0.62, y: 2.62 }); g.add(R.hair);
    const knit = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#c86a3a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#9a4a24'; c.lineWidth = 6; for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 8, y + 14); c.lineTo(x + 16, y); c.stroke(); } });
    R.cloth = P.mesh(new THREE.BoxGeometry(0.62, 0.04, 0.45), P.phys('#ffffff', { map: knit, roughness: 0.95, sheen: 0.8 }), { x: 0.62, y: 2.4, rx: 0.35 }); g.add(R.cloth);
    R.lh = person('headlouse'); R.lh.root.scale.setScalar(1.4); R.lh.root.position.set(-0.6, 2.63, 0.05); R.lh.root.rotation.set(0.5, 0.3, 0); g.add(R.lh.root);
    R.lb = person('louse'); R.lb.root.scale.setScalar(1.4); R.lb.root.position.set(0.62, 2.46, 0.12); R.lb.root.rotation.set(0.5, -0.3, 0); g.add(R.lb.root);
  }
  // --- a shot glass of sunscreen + every two hours
  {
    const g = st('shot');
    const glass = P.mesh(lathe([[0.0001, 0], [0.26, 0], [0.27, 0.06], [0.34, 0.85], [0.32, 0.85], [0.25, 0.08], [0.0001, 0.08]], 64),
      P.phys('#e8f4ff', { roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.38, side: THREE.DoubleSide }), { x: -0.85, y: 0.6 });
    g.add(glass, ped(0.5, 0.6)); g.children[g.children.length - 1].position.x = -0.85;
    const lotion = P.mesh(lathe([[0.0001, 0.08], [0.25, 0.08], [0.31, 0.74], [0.0001, 0.74]], 64), P.phys('#fbf7ee', { roughness: 0.3, clearcoat: 0.6, sheen: 0.5 }), { x: -0.85, y: 0.6 });
    g.add(lotion);
    g.add(P.mesh(new THREE.SphereGeometry(0.17, 24, 16).scale(1.6, 0.6, 1.6), P.phys('#fbf7ee', { roughness: 0.3, clearcoat: 0.6 }), { x: -0.85, y: 1.36 }));
    g.add(P.mesh(new THREE.ConeGeometry(0.06, 0.16, 16), P.phys('#fbf7ee', { roughness: 0.3 }), { x: -0.85, y: 1.48 }));
    R.oz = T3('1 SHOT GLASS', { size: 0.085, depth: 0.03, color: '#e0621a', emissive: 0.1 }); R.oz.group.position.set(-0.85, 1.75, 0.1); g.add(R.oz.group);
    const face = canvasTex(512, 512, (c, w, h) => {
      c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 6, 0, PI * 2); c.fill();
      c.fillStyle = '#2a2a2a'; c.font = '900 64px Helvetica, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
      for (let i = 1; i <= 12; i++) { const a = i / 12 * PI * 2; c.fillText(String(i), w / 2 + Math.sin(a) * 190, h / 2 - Math.cos(a) * 190); }
    });
    const clock = new THREE.Group(); clock.position.set(1.1, 1.2, 0); g.add(clock);
    clock.add(P.mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.12, 64).rotateX(PI / 2), P.phys('#e3342f', { roughness: 0.3, clearcoat: 0.7 })));
    clock.add(P.mesh(new THREE.CircleGeometry(0.56, 64), new THREE.MeshStandardMaterial({ map: face, roughness: 0.5 }), { z: 0.062, cast: false }));
    R.hourH = new THREE.Group(); R.minH = new THREE.Group(); R.hourH.position.z = R.minH.position.z = 0.08; clock.add(R.hourH, R.minH);
    R.hourH.add(P.mesh(P.rbox(0.045, 0.3, 0.02, 0.01), P.phys('#222'), { y: 0.13 }));
    R.minH.add(P.mesh(P.rbox(0.03, 0.46, 0.015, 0.008), P.phys('#222'), { y: 0.21 }));
    clock.add(P.mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 16).rotateX(PI / 2), P.phys('#222'), { z: 0.1 }));
    clock.add(P.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 12), P.phys('#9a9a9a', { metalness: 0.7 }), { y: -0.9 }));
    R.every = T3('EVERY 2 HOURS', { size: 0.095, depth: 0.03, color: '#1d2a44' }); R.every.group.position.set(1.1, 1.98, 0.05); g.add(R.every.group);
  }
  // --- one T-shirt vs 2,700 litres of water
  {
    const g = st('water');
    const shirt = new THREE.Shape();
    shirt.moveTo(-0.12, 0.25); shirt.lineTo(-0.3, 0.17); shirt.lineTo(-0.36, 0.02); shirt.lineTo(-0.24, -0.02); shirt.lineTo(-0.2, 0.06);
    shirt.lineTo(-0.2, -0.3); shirt.lineTo(0.2, -0.3); shirt.lineTo(0.2, 0.06); shirt.lineTo(0.24, -0.02); shirt.lineTo(0.36, 0.02); shirt.lineTo(0.3, 0.17); shirt.lineTo(0.12, 0.25);
    shirt.quadraticCurveTo(0, 0.17, -0.12, 0.25);
    const ts = P.mesh(new THREE.ExtrudeGeometry(shirt, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3 }), P.phys('#f6f4ee', { roughness: 0.85, sheen: 0.7 }), { x: -2.1, y: 1.0 });
    g.add(ts);
    g.add(P.mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.2, 8), P.phys('#9a9a9a', { metalness: 0.8 }), { x: -2.1, y: 0.6 }), P.mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 24), P.phys('#9a9a9a', { metalness: 0.8 }), { x: -2.1, y: 0.015 }));
    const bottle = lathe([[0.0001, 0], [0.034, 0], [0.036, 0.02], [0.036, 0.17], [0.03, 0.2], [0.014, 0.225], [0.014, 0.245], [0.0001, 0.245]], 12);
    const N = 2700, cols = 30, rows = 15, deep = 6;
    R.bottles = new THREE.InstancedMesh(bottle, P.phys('#2f8fe0', { roughness: 0.1, clearcoat: 1, emissive: '#0a3a70', emissiveIntensity: 0.25 }), N);
    const M = new THREE.Matrix4();
    for (let i = 0; i < N; i++) {
      const layer = Math.floor(i / (cols * deep)), rem = i % (cols * deep), col = rem % cols, d = Math.floor(rem / cols);
      M.makeTranslation(-0.9 + col * 0.082, layer * 0.25, -d * 0.082);
      R.bottles.setMatrixAt(i, M);
    }
    R.bottles.castShadow = true; R.bottles.receiveShadow = true;
    g.add(R.bottles);
    R.liters = T3('0 LITERS', { size: 0.26, depth: 0.08, color: '#ffffff', emissive: 0.15, align: 'center' }); R.liters.group.position.set(0.3, 4.15, 0.2); g.add(R.liters.group);
    R.oneShirt = T3('1 T-SHIRT', { size: 0.13, depth: 0.04, color: '#2a3a5a' }); R.oneShirt.group.position.set(-2.1, 1.45, 0.05); g.add(R.oneShirt.group);
  }
  // --- two and a half years
  {
    const g = st('years');
    const cal = new THREE.Group(); cal.position.set(0, 1.0, 0); g.add(cal);
    cal.add(P.mesh(P.rbox(1.1, 1.2, 0.12, 0.03), P.phys('#f6f2ea', { roughness: 0.6 })));
    cal.add(P.mesh(P.rbox(1.12, 0.26, 0.14, 0.03), P.phys('#e3342f', { roughness: 0.4 }), { y: 0.55 }));
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    R.pages = months.concat(months, months.slice(0, 6)).map((mth, i) => {
      const tex = signTex([mth], { w: 256, h: 256, bg: '#fbf9f4', fg: '#2a2a2a' });
      const pg = P.mesh(new THREE.PlaneGeometry(1.0, 0.86), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, side: THREE.DoubleSide }), { y: -0.1, z: 0.065 + (30 - i) * 0.0008, cast: false });
      cal.add(pg); return pg;
    });
    R.cal = cal;
    R.yrs = T3('2.5 YEARS', { size: 0.2, depth: 0.06, color: '#ffffff', emissive: 0.15 }); R.yrs.group.position.set(0, 2.05, 0); g.add(R.yrs.group);
    R.glass = P.mesh(lathe([[0.0001, 0], [0.12, 0], [0.15, 0.4], [0.14, 0.4], [0.11, 0.02], [0.0001, 0.02]], 40), P.phys('#e8f4ff', { roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.4, side: THREE.DoubleSide }), { x: 1.1, y: 0 });
    g.add(R.glass, P.mesh(lathe([[0.0001, 0.02], [0.11, 0.02], [0.135, 0.33], [0.0001, 0.33]], 40), P.phys('#7cc4ff', { roughness: 0.05, transparent: true, opacity: 0.75 }), { x: 1.1 }));
  }
  // --- 300 loads of laundry a year
  {
    const g = st('loads');
    const basket = new THREE.CylinderGeometry(0.2, 0.16, 0.22, 16, 1, true);
    const N = 300;
    R.baskets = new THREE.InstancedMesh(basket, P.phys('#5aa0d8', { roughness: 0.5, side: THREE.DoubleSide }), N);
    R.laundry = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 12, 8).scale(1, 0.45, 1), P.phys('#f2e6d0', { roughness: 0.95, sheen: 0.6 }), N);
    const cols = ['#e8423a', '#f4c22e', '#3fae5a', '#f2f0ea', '#9b4fd1', '#2e7ce0'];
    const M = new THREE.Matrix4(), C = new THREE.Color();
    R.basketPos = [];
    let i = 0;
    for (let layer = 0; layer < 12 && i < N; layer++) {
      const w = 13 - layer, d = 3;
      for (let z = 0; z < d && i < N; z++) for (let x = 0; x < w && i < N; x++) {
        const p = V((x - (w - 1) / 2) * 0.42, 0.11 + layer * 0.235, -z * 0.42 + (layer % 2) * 0.05);
        R.basketPos.push(p); M.makeTranslation(p.x, p.y, p.z); R.baskets.setMatrixAt(i, M);
        M.makeTranslation(p.x, p.y + 0.1, p.z); R.laundry.setMatrixAt(i, M); R.laundry.setColorAt(i, C.set(cols[i % cols.length])); i++;
      }
    }
    R.basketN = i;
    R.baskets.castShadow = R.laundry.castShadow = true;
    g.add(R.baskets, R.laundry);
    R.loads = T3('0 LOADS', { size: 0.3, depth: 0.09, color: '#e3342f', emissive: 0.1 }); R.loads.group.position.set(0, 3.45, 0.2); g.add(R.loads.group);
    R.puffs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.2, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0.85 }), 40);
    g.add(R.puffs);
  }
  return {
    scene, R, exposure: 0.95,
    update(c) {
      const name = c.shot.station;
      for (const [k, g] of Object.entries(R.st)) g.visible = k === name;
      scene.background.set(name === 'globe' ? '#0d1530' : bg);
      scene.fog.color.set(name === 'globe' ? '#0d1530' : bg);
      scene.fog.near = name === 'globe' ? 30 : 9; scene.fog.far = name === 'globe' ? 80 : 26;
    },
  };
}

// =========================================================================================================
// STREET: front door, sidewalk crowd, police car, bus stop, sunscreen station
function street(engine) {
  const scene = new THREE.Scene();
  const R = {};
  const skyOpts = { top: '#3a86d8', horizon: '#d6ecfb', bottom: '#b8c4c8', sunDir: [0.5, 0.55, 0.45] };
  scene.add(skyDome(skyOpts));
  scene.environment = skyEnvironment(engine, skyOpts);
  const asphalt = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#4a4d52'; c.fillRect(0, 0, w, h); const r = P.rng(2); for (let i = 0; i < 3000; i++) { c.fillStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},0.05)`; c.fillRect(r() * w, r() * h, 2, 2); } });
  asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping; asphalt.repeat.set(20, 2);
  scene.add(P.mesh(new THREE.PlaneGeometry(160, 8).rotateX(-PI / 2), P.phys('#ffffff', { map: asphalt, roughness: 0.9 }), { cast: false }));
  for (let x = -78; x < 80; x += 4) scene.add(P.mesh(new THREE.PlaneGeometry(2, 0.14).rotateX(-PI / 2), P.std('#f2f0e6'), { x, y: 0.005, cast: false }));
  for (let i = 0; i < 8; i++) scene.add(P.mesh(new THREE.PlaneGeometry(0.5, 3.4).rotateX(-PI / 2), P.std('#f2f0e6'), { x: 22 + i * 0.9, y: 0.006, z: -2.0 + 0, cast: false }), P.mesh(new THREE.PlaneGeometry(0.5, 3.4).rotateX(-PI / 2), P.std('#f2f0e6'), { x: 22 + i * 0.9, y: 0.006, z: 2.0, cast: false }));
  const tile = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#c9c6bf'; c.fillRect(0, 0, w, h); c.strokeStyle = '#a9a69f'; c.lineWidth = 4; for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * 64, 0); c.lineTo(i * 64, h); c.stroke(); c.beginPath(); c.moveTo(0, i * 64); c.lineTo(w, i * 64); c.stroke(); } });
  tile.wrapS = tile.wrapT = THREE.RepeatWrapping; tile.repeat.set(80, 2);
  for (const s of [-1, 1]) {
    scene.add(P.mesh(new THREE.BoxGeometry(160, 0.15, 4), P.phys('#ffffff', { map: tile, roughness: 0.85 }), { y: 0.075, z: s * 6 }));
    scene.add(P.mesh(new THREE.BoxGeometry(160, 0.16, 0.18), P.phys('#bdb9b0', { roughness: 0.8 }), { y: 0.08, z: s * 4.05 }));
  }
  // facades
  const r = P.rng(12);
  const walls = ['#c9b8a2', '#b5866a', '#d8cbb4', '#9fb2c0', '#c79a7a', '#e0d6c4', '#a8b89a'];
  for (const s of [-1, 1]) for (let x = -66; x <= 66; x += 12) {
    if (s < 0 && Math.abs(x) < 2) continue;
    const h = 12 + r() * 22;
    const b = P.cityBlock({ w: 11.6, h, d: 12, wall: walls[Math.floor(r() * walls.length)], seed: Math.floor(r() * 99), lit: 0.05 });
    b.position.set(x, 0, s * 14.1); scene.add(b);
  }
  // Sam's building: brick facade with a front door (x = 0, facade at z = -8.1)
  const brick = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#a65a3e'; c.fillRect(0, 0, w, h); c.fillStyle = '#c9b8a2'; for (let y = 0; y < h; y += 32) { c.fillRect(0, y, w, 4); for (let x = (y / 32) % 2 ? 0 : 32; x < w; x += 64) c.fillRect(x, y, 4, 32); } });
  brick.wrapS = brick.wrapT = THREE.RepeatWrapping; brick.repeat.set(3, 4);
  const brickM = P.phys('#ffffff', { map: brick, roughness: 0.9 });
  scene.add(P.mesh(new THREE.BoxGeometry(5.18, 14, 12), brickM, { x: -3.21, y: 7, z: -14.1 }), P.mesh(new THREE.BoxGeometry(5.18, 14, 12), brickM, { x: 3.21, y: 7, z: -14.1 }),
    P.mesh(new THREE.BoxGeometry(1.24, 11.63, 12), brickM, { y: 8.185, z: -14.1 }));
  scene.add(P.mesh(new THREE.BoxGeometry(1.22, 2.36, 3.0), new THREE.MeshBasicMaterial({ color: '#16110d', side: THREE.BackSide }), { y: 1.18, z: -9.6, cast: false }));
  const trim = P.phys('#efe9de', { roughness: 0.5 });
  scene.add(P.mesh(P.rbox(1.5, 0.15, 0.25, 0.03), trim, { y: 2.45, z: -8.05 }), P.mesh(P.rbox(0.15, 2.4, 0.2, 0.03), trim, { x: -0.68, y: 1.3, z: -8.05 }), P.mesh(P.rbox(0.15, 2.4, 0.2, 0.03), trim, { x: 0.68, y: 1.3, z: -8.05 }));
  R.doorHinge = new THREE.Group(); R.doorHinge.position.set(-0.6, 0.15, -8.08); scene.add(R.doorHinge);
  R.doorHinge.add(P.mesh(P.rbox(1.2, 2.2, 0.06, 0.02), P.phys('#2c5a3e', { roughness: 0.35, clearcoat: 0.6 }), { x: 0.6, y: 1.1 }));
  R.doorHinge.add(P.mesh(new THREE.SphereGeometry(0.035, 16, 12), P.phys('#d9b26a', { metalness: 0.9, roughness: 0.3 }), { x: 1.08, y: 1.05, z: 0.05 }));
  scene.add(P.mesh(new THREE.BoxGeometry(1.6, 0.04, 0.6), P.phys('#3a2a20', { roughness: 0.9 }), { y: 0.17, z: -7.6 }));
  const num = signPlane(['42'], 0.3, 0.18, { bg: '#1c1c1c', fg: '#f2c64a' }); num.position.set(0, 2.65, -7.94); scene.add(num);
  // street furniture
  const tree = (x, z) => {
    const g = new THREE.Group(); g.position.set(x, 0.15, z);
    g.add(P.mesh(new THREE.CylinderGeometry(0.1, 0.14, 2.6, 10), P.std('#6b4a2e'), { y: 1.3 }));
    const lf = P.std('#4f9a3c', { roughness: 0.85 }); const rr = P.rng(Math.round(x * 7 + z));
    for (let i = 0; i < 6; i++) g.add(P.mesh(new THREE.IcosahedronGeometry(0.75 + rr() * 0.35, 2), lf, { x: (rr() - 0.5) * 1.2, y: 3.0 + rr() * 0.8, z: (rr() - 0.5) * 1.2 }));
    g.add(P.mesh(new THREE.BoxGeometry(1.0, 0.05, 1.0), P.std('#5a4232'), { y: 0.02 }));
    scene.add(g);
  };
  for (let x = -60; x <= 60; x += 9) { if (Math.abs(x - 3) > 2) tree(x + 3, -4.9); tree(x - 1, 4.9); }
  const lampPost = (x, z) => {
    const g = new THREE.Group(); g.position.set(x, 0.15, z);
    g.add(P.mesh(new THREE.CylinderGeometry(0.06, 0.09, 4.2, 10), P.phys('#2a2d33', { metalness: 0.5, roughness: 0.4 }), { y: 2.1 }));
    g.add(P.mesh(new THREE.SphereGeometry(0.22, 16, 12), P.phys('#fff8e0', { emissive: '#fff2c8', emissiveIntensity: 0.3 }), { y: 4.3 }));
    scene.add(g);
  };
  for (let x = -54; x <= 54; x += 18) { lampPost(x + 7.5, -4.4); lampPost(x - 1.5, 4.4); }
  // police car, cop
  const pc = new THREE.Group(); pc.position.set(7.5, 0, 2.6); pc.rotation.y = PI / 2; scene.add(pc);
  pc.add(P.car('#f4f4f2'));
  pc.add(P.mesh(P.rbox(1.82, 0.36, 2.0, 0.12), P.phys('#16181d', { roughness: 0.25, clearcoat: 1 }), { y: 0.58, z: -0.1 }));
  R.barR = P.mesh(P.rbox(0.5, 0.12, 0.25, 0.04), P.phys('#ff2a2a', { emissive: '#ff2a2a', emissiveIntensity: 1 }), { x: -0.3, y: 1.37, z: -0.2 });
  R.barB = P.mesh(P.rbox(0.5, 0.12, 0.25, 0.04), P.phys('#2a5aff', { emissive: '#2a5aff', emissiveIntensity: 1 }), { x: 0.3, y: 1.37, z: -0.2 });
  pc.add(R.barR, R.barB);
  const pol = signPlane(['POLICE'], 1.4, 0.3, { bg: '#16181d', fg: '#ffffff' });
  for (const s of [-1, 1]) { const m = pol.clone(); m.position.set(s * 0.92, 0.62, -0.1); m.rotation.y = s * PI / 2; pc.add(m); }
  R.lightR = new THREE.PointLight('#ff3030', 0, 6, 2); R.lightR.position.set(7.5, 1.6, 2.9); scene.add(R.lightR);
  R.lightB = new THREE.PointLight('#3060ff', 0, 6, 2); R.lightB.position.set(7.3, 1.6, 2.9); scene.add(R.lightB);
  R.cop = person('cop', 7.0, 0.15, 4.75, PI); scene.add(R.cop.root);
  // bus stop + bus
  const shelter = new THREE.Group(); shelter.position.set(-16, 0.15, 6.6); scene.add(shelter);
  shelter.add(P.mesh(P.rbox(3.2, 0.08, 1.4, 0.02), P.phys('#2e5a8a', { roughness: 0.4 }), { y: 2.5 }));
  for (const x of [-1.5, 1.5]) shelter.add(P.mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.5, 10), P.phys('#9aa4ad', { metalness: 0.6 }), { x, y: 1.25, z: -0.5 }));
  shelter.add(P.mesh(new THREE.PlaneGeometry(3.0, 2.0), P.phys('#cfe6f5', { transparent: true, opacity: 0.35, roughness: 0.05 }), { y: 1.4, z: 0.6, cast: false }));
  const busSign = signPlane(['BUS', '7'], 0.5, 0.7, { bg: '#2e5a8a', fg: '#ffffff' }); busSign.position.set(1.9, 2.4, -0.4); shelter.add(busSign);
  R.bus = busExterior(); R.bus.position.set(-16, 0, 2.0); scene.add(R.bus);
  // sunscreen station on the corner
  R.station = sunscreenStation(); R.station.position.set(14, 0.15, -6.4); scene.add(R.station);
  // people: Sam and a sidewalk crowd (everyone with a fanny pack)
  R.sam = person('sam', 0, 0.15, -7.4); scene.add(R.sam.root); wear(R.sam, 'apron', false); wear(R.sam, 'watch', false);
  R.items = [phoneMesh(), keysMesh(), walletMesh()]; R.items.forEach((m) => scene.add(m));
  R.zip = P.mesh(P.rbox(0.016, 0.03, 0.006, 0.003), P.phys('#d9d9d9', { metalness: 0.8, roughness: 0.3 })); scene.add(R.zip);
  R.crowd = ['diva', 'guest_b', 'painter', 'guest_d', 'leopard', 'stripes', 'guest_c', 'guest_a'].map((n, i) => {
    const c = person(n); scene.add(c.root);
    c.lane = -7.0 + (i % 3) * 0.8; c.dir = i % 2 ? 1 : -1; c.x0 = i * 1.55; c.speed = 1.0 + (i % 3) * 0.12; c.seed = i;
    return c;
  });
  R.sunscreener = R.crowd[4];
  sun(scene, '#fff1d8', 2.9, V(16, 22, 14), V(4, 0, -3), 14);
  scene.add(new THREE.HemisphereLight('#d6e8ff', '#8a8070', 0.55));
  return {
    scene, R, exposure: 0.9,
    update(c) {
      const t = c.t;
      R.doorHinge.rotation.y = 0;
      R.sam.root.visible = true; wear(R.sam, 'pack', true);
      R.items.forEach((m) => { m.visible = false; });
      R.zip.visible = false;
      // crowd strolls (wrapping along the sidewalk)
      R.crowd.forEach((p) => {
        const L = 12, x = ((p.x0 + p.dir * p.speed * t + L * 500) % L) - L / 2;
        const ph = (p.speed * t) / 1.4 * PI * 2 + p.seed;
        p.root.position.set(x, 0.15 + bob(ph), p.lane); p.root.rotation.y = p.dir * PI / 2;
        p.root.visible = true;
        p.pose({ lids: blink(t, p.seed), head: [0, 0.1 * Math.sin(t * 0.7 + p.seed), 0], nodes: { ...REST, ...walkNodes(ph, 0.9) } });
      });
      // police lights
      const f = Math.floor(t * 6) % 2;
      R.barR.material.emissiveIntensity = f ? 2.2 : 0.2; R.barB.material.emissiveIntensity = f ? 0.2 : 2.2;
      R.lightR.intensity = f ? 6 : 0; R.lightB.intensity = f ? 0 : 6;
      R.cop.pose({ lids: blink(t, 3), nodes: { ...REST } });
      R.bus.position.set(-16, 0, 2.0); R.bus.userData.doors.forEach((d) => { d.position.x = d.userData.x0; });
    },
  };
}
function busExterior() {
  const g = new THREE.Group();
  const body = P.phys('#f2b81f', { roughness: 0.3, clearcoat: 0.8 });
  g.add(P.mesh(P.rbox(11, 2.6, 2.55, 0.2), body, { y: 1.75 }));
  g.add(P.mesh(P.rbox(10.4, 0.95, 2.58, 0.06), P.phys('#1d2633', { roughness: 0.08, clearcoat: 1 }), { y: 2.2 }));
  g.add(P.mesh(P.rbox(0.1, 1.4, 2.3, 0.04), P.phys('#1d2633', { roughness: 0.08, clearcoat: 1 }), { x: -5.5, y: 2.0 }));
  for (const x of [-3.6, 3.4]) for (const z of [-1.1, 1.1]) g.add(P.mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 24).rotateX(PI / 2), P.std('#141414', { roughness: 0.9 }), { x, y: 0.5, z }));
  const s = signPlane(['7  DOWNTOWN'], 1.8, 0.28, { bg: '#111111', fg: '#ffb020', glow: 1.2 }); s.position.set(-5.56, 2.85, 0); s.rotation.y = -PI / 2; g.add(s);
  const doors = [];
  for (const dx of [-0.3, 0.3]) { const d = P.mesh(P.rbox(0.6, 2.1, 0.06, 0.02), P.phys('#1d2633', { roughness: 0.1, clearcoat: 1 }), { x: -4.2 + dx, y: 1.5, z: 1.29 }); d.userData.x0 = -4.2 + dx; doors.push(d); g.add(d); }
  g.userData.doors = doors;
  return g;
}
function sunscreenStation() {
  const g = new THREE.Group();
  g.add(P.mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.5, 16), P.phys('#d9dde2', { metalness: 0.6, roughness: 0.3 }), { y: 0.75 }));
  g.add(P.mesh(P.rbox(0.42, 0.6, 0.3, 0.06), P.phys('#ff8a2a', { roughness: 0.35, clearcoat: 0.6 }), { y: 1.55 }));
  g.add(P.mesh(P.rbox(0.34, 0.12, 0.08, 0.03), P.phys('#f6f2ea', { roughness: 0.4 }), { y: 1.82, z: 0.16 }));
  g.add(P.mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.12, 12).rotateX(PI / 2), P.phys('#f6f2ea'), { y: 1.36, z: 0.2 }));
  const sgn = signPlane(['SUNSCREEN', 'SPF 50', 'FREE'], 0.6, 0.62, { bg: '#fff3d6', fg: '#e0621a', sizes: [104, 150, 80] });
  sgn.position.set(0, 2.25, 0.02); g.add(sgn);
  g.add(P.mesh(P.rbox(0.66, 0.68, 0.04, 0.02), P.phys('#e0621a'), { y: 2.25, z: -0.01 }));
  const sunIcon = new THREE.Group(); sunIcon.position.set(0, 2.75, 0);
  sunIcon.add(P.mesh(new THREE.SphereGeometry(0.11, 24, 16), P.phys('#ffd23f', { emissive: '#ffb020', emissiveIntensity: 0.4 })));
  for (let i = 0; i < 8; i++) sunIcon.add(P.mesh(new THREE.ConeGeometry(0.03, 0.08, 8), P.phys('#ffd23f', { emissive: '#ffb020', emissiveIntensity: 0.4 }), { x: Math.cos(i / 8 * PI * 2) * 0.17, y: Math.sin(i / 8 * PI * 2) * 0.17, rz: i / 8 * PI * 2 - PI / 2 }));
  g.add(sunIcon);
  return g;
}

// =========================================================================================================
// BUS interior: towel dispensers on every seat back, passengers on towels
function busInterior(engine) {
  const scene = new THREE.Scene();
  const R = {};
  scene.background = new THREE.Color('#cfe6f5');
  const shell = P.phys('#efe9de', { roughness: 0.8, side: THREE.BackSide });
  scene.add(P.mesh(new THREE.BoxGeometry(2.5, 2.3, 12), shell, { y: 1.15, cast: false }));
  scene.add(P.mesh(new THREE.PlaneGeometry(2.48, 11.98).rotateX(-PI / 2), P.phys('#5a5f68', { roughness: 0.9 }), { y: 0.005, cast: false }));
  for (let z = -5; z <= 5; z += 2) scene.add(P.mesh(new THREE.PlaneGeometry(0.6, 1.2).rotateX(PI / 2), P.phys('#ffffff', { emissive: '#ffffff', emissiveIntensity: 1.2 }), { y: 2.29, z, cast: false }));
  // windows: a city that scrolls past
  const city = canvasTex(2048, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9fd0f5'); g.addColorStop(1, '#e8f4fb'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    const r = P.rng(5); let x = 0;
    while (x < w) { const bw = 60 + r() * 140, bh = 80 + r() * 160; c.fillStyle = ['#c9b8a2', '#b5866a', '#d8cbb4', '#9fb2c0', '#c79a7a'][Math.floor(r() * 5)]; c.fillRect(x, h - bh, bw, bh); c.fillStyle = 'rgba(60,90,120,0.6)'; for (let wy = h - bh + 12; wy < h - 10; wy += 24) for (let wx = x + 8; wx < x + bw - 12; wx += 20) c.fillRect(wx, wy, 10, 14); x += bw + 4; }
    c.fillStyle = '#4f9a3c'; for (let i = 0; i < 30; i++) { c.beginPath(); c.arc(r() * w, h - 20, 18 + r() * 20, 0, PI * 2); c.fill(); }
  });
  city.wrapS = THREE.RepeatWrapping; R.city = city;
  for (const s of [-1, 1]) {
    const m = P.mesh(new THREE.PlaneGeometry(11, 0.9), new THREE.MeshBasicMaterial({ map: city }), { x: s * 1.24, y: 1.55, ry: -s * PI / 2, cast: false });
    scene.add(m);
    for (let z = -5.5; z <= 5.5; z += 1.1) scene.add(P.mesh(new THREE.BoxGeometry(0.04, 0.95, 0.06), P.phys('#2a2d33'), { x: s * 1.22, y: 1.55, z }));
  }
  // poles + rails
  const yel = P.phys('#f2b81f', { roughness: 0.3, metalness: 0.3 });
  for (let z = -4.5; z <= 4.5; z += 1.5) scene.add(P.mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.3, 10), yel, { x: 0.36, y: 1.15, z }));
  for (const s of [-1, 1]) scene.add(P.mesh(new THREE.CylinderGeometry(0.018, 0.018, 11, 10).rotateX(PI / 2), yel, { x: s * 0.45, y: 2.0 }));
  // seats facing -z (the front of the bus), two per side; dispensers on the back of each seat
  const fab = P.phys('#2e5a8a', { roughness: 0.9, sheen: 0.8, sheenColor: new THREE.Color('#9fc4ff') });
  const towelCols = [['#e8423a', '#f2f0ea'], ['#f4c22e', '#2e7ce0'], ['#3fae5a', '#f2f0ea'], ['#9b4fd1', '#f4c22e'], ['#ff8a2a', '#f2f0ea'], ['#2e7ce0', '#f2f0ea']];
  R.seats = [];
  let k = 0;
  for (let z = -4.2; z <= 4.4; z += 1.05) for (const x of [-0.9, -0.45, 0.45, 0.9]) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    g.add(P.mesh(P.rbox(0.42, 0.12, 0.44, 0.04), fab, { y: 0.48 }));
    g.add(P.mesh(P.rbox(0.42, 0.62, 0.1, 0.04), fab, { y: 0.84, z: 0.2, rx: 0.08 }));
    g.add(P.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 8), P.phys('#9aa4ad', { metalness: 0.6 }), { y: 0.21 }));
    // dispenser on the seat back (faces the row behind, +z)
    const disp = new THREE.Group(); disp.position.set(0, 0.95, 0.27); g.add(disp);
    disp.add(P.mesh(P.rbox(0.26, 0.2, 0.08, 0.025), P.phys('#f6f4ef', { roughness: 0.35, clearcoat: 0.5 })));
    disp.add(P.mesh(new THREE.BoxGeometry(0.16, 0.012, 0.03), P.phys('#2a2a2a'), { y: -0.09, z: 0.03 }));
    const [a, b] = towelCols[k % towelCols.length];
    const tongue = P.mesh(new THREE.PlaneGeometry(0.14, 0.12), towelMat(a, b), { y: -0.15, z: 0.042, cast: false });
    tongue.material.side = THREE.DoubleSide; disp.add(tongue);
    const tw = P.mesh(P.rbox(0.4, 0.02, 0.5, 0.01), towelMat(a, b), { y: 0.55, z: 0.02 });
    tw.visible = false; g.add(tw);
    R.seats.push({ g, tw, disp, tongue, x, z }); k++;
  }
  R.sign = signPlane(['RULE #1:', 'ALWAYS SIT', 'ON A TOWEL'], 0.85, 0.56, { bg: '#fff7e0', fg: '#c0281f', border: '#c0281f', sizes: [150, 140, 140] });
  R.sign.position.set(0, 1.86, -5.95); scene.add(R.sign);
  scene.add(P.mesh(new THREE.PlaneGeometry(2.2, 1.0), new THREE.MeshBasicMaterial({ color: '#dff0fb' }), { y: 1.3, z: -5.98, cast: false }));
  // passengers, each on a towel
  const riders = [['diva', 0, 0], ['guest_d', 3, 1], ['guest_c', 6, 0], ['stripes', 9, 1], ['painter', 13, 0], ['guest_a', 16, 1]];
  R.riders = riders.map(([n, si, side]) => {
    const s = R.seats[si]; const c = person(n, s.x, -0.27, s.z + 0.08, PI); scene.add(c.root);
    s.tw.visible = true; c.seat = s; c.seed = si;
    wear(c, 'pack', true);
    return c;
  });
  R.sam = person('sam', 0, 0, 3.2, PI); scene.add(R.sam.root); wear(R.sam, 'apron', false); wear(R.sam, 'watch', false);
  R.samSeat = R.seats.find((s) => Math.abs(s.x - 0.45) < 0.01 && Math.abs(s.z - 2.1) < 0.01) || R.seats[24];
  R.samTowel = P.mesh(P.rbox(0.4, 0.02, 0.5, 0.01), towelMat('#1fa39a', '#f2f0ea')); scene.add(R.samTowel);
  scene.environmentIntensity = 0.3;
  scene.add(new THREE.HemisphereLight('#eaf4ff', '#7a7066', 0.5));
  const key = sun(scene, '#fff3e0', 1.6, V(6, 6, -2), V(0, 0.8, 0), 6);
  for (let z = -4; z <= 4; z += 4) { const pl = new THREE.PointLight('#fffaf0', 1.6, 6, 2); pl.position.set(0, 2.1, z); scene.add(pl); }
  R.sign.material.emissive = new THREE.Color('#ffffff'); R.sign.material.emissiveMap = R.sign.material.map; R.sign.material.emissiveIntensity = 0.25;
  return {
    scene, R, exposure: 0.85,
    update(c) {
      const t = c.t;
      R.city.offset.x = -(t * 0.09) % 1;
      R.riders.forEach((p) => p.pose({ lids: blink(t, p.seed), head: [0.05, 0.15 * Math.sin(t * 0.5 + p.seed), 0], nodes: { ...REST, ...SIT, arm_l: [-0.5, 0, 0.1], arm_r: [-0.5, 0, -0.1], fore_l: [-0.7, 0, 0], fore_r: [-0.7, 0, 0] } }));
      R.samTowel.visible = false;
    },
  };
}

// =========================================================================================================
// KITCHEN (Sam's): island cooktop facing the camera, bacon, a glass of water
function kitchen(engine) {
  const scene = new THREE.Scene();
  const R = {};
  scene.background = new THREE.Color('#e9e2d6');
  scene.add(P.mesh(new THREE.PlaneGeometry(10, 10).rotateX(-PI / 2), P.phys('#ffffff', { map: P.woodFloorTex('#9c6f4a', [5, 5]), roughness: 0.5 }), { cast: false }));
  const tiles = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, w, h); c.strokeStyle = '#d8d2c6'; c.lineWidth = 5; for (let y = 0; y < h; y += 42) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); for (let x = ((y / 42) % 2) * 42; x < w; x += 84) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 42); c.stroke(); } } });
  tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping; tiles.repeat.set(3, 1.5);
  scene.add(P.mesh(new THREE.PlaneGeometry(8, 3), P.phys('#ffffff', { map: tiles, roughness: 0.4, clearcoat: 0.3 }), { y: 1.5, z: -1.8, cast: false }));
  const cab = P.phys('#3d6f7a', { roughness: 0.5, clearcoat: 0.3 });
  scene.add(P.mesh(P.rbox(5, 0.9, 0.62, 0.02), cab, { y: 0.45, z: -1.48 }), P.mesh(P.rbox(5.02, 0.04, 0.66, 0.01), P.phys('#efe9e0', { roughness: 0.3 }), { y: 0.92, z: -1.48 }));
  for (let x = -2.2; x <= 2.2; x += 0.88) scene.add(P.mesh(P.rbox(0.84, 0.7, 0.36, 0.02), cab, { x, y: 2.0, z: -1.6 }));
  const win = P.mesh(new THREE.PlaneGeometry(1.1, 0.8), new THREE.MeshBasicMaterial({ color: '#dff0ff' }), { x: 1.4, y: 1.35, z: -1.79, cast: false }); scene.add(win);
  scene.add(P.mesh(P.rbox(1.2, 0.9, 0.04, 0.02), P.phys('#f6f4ef'), { x: 1.4, y: 1.35, z: -1.81 }));
  // island with cooktop (Sam stands behind it, facing +z)
  scene.add(P.mesh(P.rbox(2.2, 0.9, 0.9, 0.03), cab, { y: 0.45, z: 0.2 }), P.mesh(P.rbox(2.24, 0.05, 0.94, 0.015), P.phys('#efe9e0', { roughness: 0.25, clearcoat: 0.5 }), { y: 0.925, z: 0.2 }));
  scene.add(P.mesh(P.rbox(0.8, 0.012, 0.55, 0.01), P.phys('#141416', { roughness: 0.15, clearcoat: 1 }), { y: 0.956, z: 0.2 }));
  R.burner = P.mesh(new THREE.TorusGeometry(0.11, 0.012, 8, 40).rotateX(PI / 2), P.phys('#ff4a1a', { emissive: '#ff3a10', emissiveIntensity: 1.6 }), { x: 0.0, y: 0.964, z: 0.2 }); scene.add(R.burner);
  const pan = new THREE.Group(); pan.position.set(0, 0.965, 0.2); scene.add(pan); R.pan = pan;
  pan.add(P.mesh(lathe([[0.0001, 0], [0.16, 0], [0.18, 0.05], [0.172, 0.05], [0.152, 0.008], [0.0001, 0.008]], 48), P.phys('#2a2b2e', { roughness: 0.35, metalness: 0.5, side: THREE.DoubleSide })));
  pan.add(P.mesh(P.rbox(0.3, 0.025, 0.04, 0.01), P.phys('#141414', { roughness: 0.5 }), { x: 0.32, y: 0.04 }));
  const bacon = canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#b8483a'; c.fillRect(0, 0, w, h); c.fillStyle = '#f2d6c0'; c.fillRect(0, 22, w, 8); c.fillRect(0, 46, w, 5); c.fillStyle = '#8a2a20'; c.fillRect(0, 0, w, 6); });
  R.strips = [];
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.PlaneGeometry(0.26, 0.05, 24, 1).rotateX(-PI / 2);
    const p = geo.attributes.position; for (let j = 0; j < p.count; j++) p.setY(j, 0.012 * Math.sin(p.getX(j) * 40 + i));
    geo.computeVertexNormals();
    const m = P.mesh(geo, P.phys('#ffffff', { map: bacon, roughness: 0.4, clearcoat: 0.6, side: THREE.DoubleSide }), { y: 0.022, z: -0.07 + i * 0.07, ry: 0.1 * (i - 1) });
    pan.add(m); R.strips.push(m);
  }
  // grease droplets (deterministic particles)
  R.drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.008, 8, 6), P.phys('#ffe6a0', { emissive: '#ffcf6a', emissiveIntensity: 0.8, roughness: 0.1 }), 60);
  R.drops.castShadow = false; scene.add(R.drops);
  R.glass = new THREE.Group(); scene.add(R.glass);
  R.glass.add(P.mesh(lathe([[0.0001, 0], [0.035, 0], [0.042, 0.13], [0.04, 0.13], [0.033, 0.006], [0.0001, 0.006]], 32), P.phys('#e8f4ff', { roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.4, side: THREE.DoubleSide })));
  R.water = P.mesh(lathe([[0.0001, 0.006], [0.033, 0.006], [0.04, 0.11], [0.0001, 0.11]], 32), P.phys('#9fd3ff', { roughness: 0.05, transparent: true, opacity: 0.7 }));
  R.glass.add(R.water);
  R.sam = person('sam', 0, 0, -0.55); scene.add(R.sam.root); wear(R.sam, 'watch', false);
  scene.environmentIntensity = 0.3;
  scene.add(new THREE.HemisphereLight('#fff6ea', '#7a6a58', 0.4));
  sun(scene, '#fff0d8', 2.0, V(3, 5, 4), V(0, 0.8, 0), 3);
  const pl = new THREE.PointLight('#ffe2b8', 1.8, 6, 2); pl.position.set(-1.5, 2.3, 1.2); scene.add(pl);
  R.fire = new THREE.PointLight('#ff7a3a', 0.6, 2, 2); R.fire.position.set(0, 1.0, 0.2); scene.add(R.fire);
  return {
    scene, R, exposure: 0.85,
    update(c) {
      R.glass.visible = false; R.drops.count = 0;
      wear(R.sam, 'apron', false); wear(R.sam, 'pack', true);
      R.sam.root.position.set(0, 0, -0.55); R.sam.root.rotation.set(0, 0, 0);
    },
  };
}

// =========================================================================================================
// LAUNDRY room: dusty machines, cobwebs; the washer full of towels
function laundry(engine) {
  const scene = new THREE.Scene();
  const R = {};
  scene.background = new THREE.Color('#d9d4ca');
  scene.add(P.mesh(new THREE.PlaneGeometry(6, 6).rotateX(-PI / 2), P.phys('#bcb6aa', { roughness: 0.8 }), { cast: false }));
  scene.add(P.mesh(new THREE.PlaneGeometry(6, 3), P.phys('#d9e2e6', { roughness: 0.9 }), { y: 1.5, z: -0.8, cast: false }));
  scene.add(P.mesh(new THREE.PlaneGeometry(6, 3).rotateY(PI / 2), P.phys('#cfd8dc', { roughness: 0.9 }), { x: -1.6, y: 1.5, cast: false }));
  const machine = (x, dryer) => {
    const g = new THREE.Group(); g.position.set(x, 0, -0.45); scene.add(g);
    g.add(P.mesh(P.rbox(0.68, 0.86, 0.65, 0.04), P.phys('#f4f4f2', { roughness: 0.3, clearcoat: 0.6 }), { y: 0.43 }));
    g.add(P.mesh(P.rbox(0.66, 0.12, 0.02, 0.01), P.phys('#d9dde2', { roughness: 0.3 }), { y: 0.8, z: 0.33 }));
    g.add(P.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 16).rotateX(PI / 2), P.phys('#2a2a2a'), { x: 0.2, y: 0.8, z: 0.345 }));
    g.add(P.mesh(new THREE.TorusGeometry(0.2, 0.035, 12, 40), P.phys('#c9cdd2', { metalness: 0.7, roughness: 0.25 }), { y: 0.4, z: 0.33 }));
    g.add(P.mesh(new THREE.CircleGeometry(0.19, 40), P.phys('#9fb6c8', { roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.35 }), { y: 0.4, z: 0.345, cast: false }));
    // dust on top
    g.add(P.mesh(new THREE.PlaneGeometry(0.66, 0.63).rotateX(-PI / 2), new THREE.MeshStandardMaterial({ color: '#b8b0a2', roughness: 1, transparent: true, opacity: 0.55 }), { y: 0.865, cast: false }));
    return g;
  };
  R.washer = machine(-0.4, false); machine(0.32, true);
  // drum with tumbling towels (seen through the washer door)
  R.drum = new THREE.Group(); R.drum.position.set(-0.4, 0.4, -0.2); scene.add(R.drum);
  R.drum.add(P.mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.4, 32, 1, true).rotateX(PI / 2), P.phys('#9aa4ad', { metalness: 0.7, roughness: 0.4, side: THREE.BackSide })));
  R.towels = [['#e8423a', '#f2f0ea'], ['#2e7ce0', '#f2f0ea'], ['#f4c22e', '#e8423a'], ['#3fae5a', '#f2f0ea']].map(([a, b], i) => {
    const m = P.mesh(new THREE.IcosahedronGeometry(0.075, 2).scale(1.3, 0.8, 1), towelMat(a, b)); R.drum.add(m); return m;
  });
  // cobwebs: thin strands
  const web = P.phys('#f6f6f6', { roughness: 0.6, transparent: true, opacity: 0.7 });
  const strand = (a, b) => { const d = b.clone().sub(a); const m = P.mesh(new THREE.CylinderGeometry(0.0015, 0.0015, d.length(), 4), web, { cast: false }); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); scene.add(m); };
  for (let i = 0; i < 7; i++) { strand(V(-0.74, 0.86, -0.12), V(-0.74 + i * 0.12, 0.5 + i * 0.05, -0.12 - i * 0.01)); strand(V(-0.74, 0.86 - i * 0.05, -0.12), V(-0.3 + i * 0.03, 0.87, -0.12)); }
  for (let i = 0; i < 6; i++) strand(V(-1.58, 1.8, -0.78), V(-1.58 + 0.1 + i * 0.12, 1.3 + i * 0.08, -0.78 + 0.3));
  const bask = P.mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.3, 24, 1, true), P.phys('#5aa0d8', { roughness: 0.5, side: THREE.DoubleSide }), { x: 1.0, y: 0.15, z: 0.2 }); scene.add(bask);
  scene.environmentIntensity = 0.3;
  scene.add(new THREE.HemisphereLight('#f2f6ff', '#8a8070', 0.4));
  sun(scene, '#fff6e6', 1.6, V(2, 4, 3), V(0, 0.4, -0.3), 2.5);
  const pl = new THREE.PointLight('#fff6e6', 1.0, 5, 2); pl.position.set(0, 2.2, 1.2); scene.add(pl);
  R.drumLight = new THREE.PointLight('#fff6e6', 0.3, 1, 2); R.drumLight.position.set(-0.4, 0.4, 0.15); scene.add(R.drumLight);
  return {
    scene, R, exposure: 0.85,
    update(c) {
      const t = c.t;
      R.drum.rotation.z = -t * 3.2;
      R.towels.forEach((m, i) => { const a = i * 1.6 + 0.4 * Math.sin(t * 2 + i); m.position.set(Math.cos(a) * 0.1, Math.sin(a) * 0.1 - 0.02, -0.02 + (i % 2) * 0.08); m.rotation.set(t * (1 + i * 0.3), i, t * 0.7); });
    },
  };
}

// =========================================================================================================
import { runway, restaurant, office, cave, stadium, factory, snow, dining } from './sets2.js';
export function buildScenes() {
  return {
    bedroom: (e) => bedroom(e, false), bedroomNight: (e) => bedroom(e, true), studio, street, bus: busInterior, kitchen, laundry,
    runway, restaurant, office, cave, stadium, factory, snow, dining,
  };
}
