// Sets for the 3-minute "What if animals could somehow talk?" — a day in a world of talking animals.
// Every scene's update() is a pure function of time, so frames render identically on any worker, in any order.
import * as THREE from 'three';
import { makeCharacter, envAt, blink } from '../../kit/character.js';
import * as P from '../../kit/props.js';
import { skyDome, skyEnvironment, Text3D, ThoughtBubble, ease, ramp, lerp, clamp01, commas } from '../../kit/fx.js';

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const PI = Math.PI;
export const cast = {};
export const W = {};
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
export function talk(who, t, gain = 1, ids = null) {
  const TL = TLref.TL;
  let v = 0;
  for (const l of TL.lines) {
    if (l.who !== who || (ids && !ids.includes(l.id))) continue;
    if (t >= l.start - 0.03 && t <= l.end + 0.12) v = Math.max(v, envAt(l.env, TL.fps, t - l.start));
  }
  return clamp01(v * gain);
}
export function world(c, node, local = [0, 0, 0]) {
  c.root.updateMatrixWorld(true);
  return (node ? c.nodes[node] : c.root).localToWorld(V(...local));
}

// ------------------------------------------------------------------ lighting
export function sun(scene, color, intensity, pos, target, size = 6, res = 2048) {
  const l = new THREE.DirectionalLight(color, intensity);
  l.position.copy(pos); l.target.position.copy(target);
  l.castShadow = true; res = Math.min(res, globalThis.RQ?.shadowMax ?? res); l.shadow.mapSize.set(res, res);
  const c = l.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = 0.5; c.far = 120;
  l.shadow.bias = -0.0003; l.shadow.normalBias = 0.02; l.shadow.radius = 3;
  scene.add(l, l.target);
  return l;
}

// ------------------------------------------------------------------ small props
const lathe = (pts, seg = 40) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function vase() {
  const g = new THREE.Group();
  g.add(P.mesh(lathe([[0.0001, 0], [0.06, 0], [0.085, 0.07], [0.08, 0.15], [0.045, 0.21], [0.05, 0.25], [0.044, 0.25], [0.0001, 0.03]]),
    P.phys('#3f7fd0', { roughness: 0.2, clearcoat: 1, side: THREE.DoubleSide })));
  for (const y of [0.09, 0.12]) g.add(P.mesh(new THREE.TorusGeometry(0.083, 0.004, 6, 40).rotateX(PI / 2), P.phys('#f2d16b', { roughness: 0.3, metalness: 0.4 }), { y }));
  const stem = P.phys('#4f8a3d', { roughness: 0.6 });
  for (let i = 0; i < 3; i++) {
    g.add(P.mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.24, 6), stem, { x: (i - 1) * 0.02, y: 0.34, rz: (i - 1) * 0.25 }));
    g.add(P.mesh(new THREE.SphereGeometry(0.03, 12, 10), P.phys(['#ff7aa8', '#ffd84f', '#ff9a52'][i], { roughness: 0.6 }), { x: (i - 1) * 0.05, y: 0.46 - Math.abs(i - 1) * 0.02 }));
  }
  return g;
}
function shards() {
  const g = new THREE.Group();
  const r = P.rng(31), m = P.phys('#3f7fd0', { roughness: 0.2, clearcoat: 1, side: THREE.DoubleSide, flatShading: true });
  for (let i = 0; i < 16; i++) {
    const s = 0.02 + r() * 0.05;
    const geo = new THREE.TetrahedronGeometry(s, 0); geo.scale(1, 0.35, 1);
    g.add(P.mesh(geo, m, { x: (r() - 0.5) * 0.7, y: 0.01, z: (r() - 0.5) * 0.6, ry: r() * 6, rx: r() * 0.5 }));
  }
  for (let i = 0; i < 3; i++) g.add(P.mesh(new THREE.SphereGeometry(0.03, 12, 10), P.phys(['#ff7aa8', '#ffd84f', '#ff9a52'][i]), { x: -0.3 + i * 0.25, y: 0.03, z: 0.2 - i * 0.15 }));
  g.add(P.mesh(new THREE.CircleGeometry(0.22, 32).rotateX(-PI / 2), P.phys('#8fb7d8', { roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.55 }), { y: 0.003, x: 0.05, cast: false }));
  return g;
}
function door() {
  const g = new THREE.Group();
  const frame = P.phys('#f2eee6', { roughness: 0.5 });
  g.add(P.mesh(P.rbox(0.12, 2.2, 0.08, 0.02), frame, { y: 1.1, z: -0.5 }), P.mesh(P.rbox(0.12, 2.2, 0.08, 0.02), frame, { y: 1.1, z: 0.5 }), P.mesh(P.rbox(0.12, 0.1, 1.08, 0.02), frame, { y: 2.2 }));
  const panel = new THREE.Group();
  const pm = P.phys('#e9e2d3', { roughness: 0.55 });
  panel.add(P.mesh(P.rbox(0.05, 2.08, 0.92, 0.015), pm, { y: 1.04, z: 0.46 }));
  for (const y of [0.55, 1.5]) panel.add(P.mesh(P.rbox(0.01, 0.6, 0.7, 0.01), P.phys('#ddd4c2'), { x: 0.03, y, z: 0.46 }));
  panel.add(P.mesh(new THREE.SphereGeometry(0.03, 16, 12), P.phys('#c9a24a', { metalness: 0.8, roughness: 0.3 }), { x: 0.06, y: 1.0, z: 0.84 }));
  panel.position.z = -0.46;
  g.add(panel);
  return { group: g, panel };
}
function wallClock() {
  const g = new THREE.Group();
  const face = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#fbf7ee'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 4, 0, PI * 2); c.fill();
    c.fillStyle = '#333'; for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; c.fillRect(w / 2 + Math.sin(a) * 100 - 4, h / 2 - Math.cos(a) * 100 - 4, 8, 8); }
  });
  g.add(P.mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 40).rotateZ(PI / 2), P.phys('#c25b3f', { roughness: 0.4 })));
  g.add(P.mesh(new THREE.CircleGeometry(0.18, 40).rotateY(-PI / 2), new THREE.MeshStandardMaterial({ map: face, roughness: 0.6 }), { x: -0.021, cast: false }));
  const hm = P.phys('#222', { roughness: 0.4 });
  const hourH = new THREE.Group(), minH = new THREE.Group();
  hourH.add(P.mesh(new THREE.BoxGeometry(0.008, 0.09, 0.012), hm, { y: 0.04 }));
  minH.add(P.mesh(new THREE.BoxGeometry(0.006, 0.14, 0.008), hm, { y: 0.065 }));
  hourH.position.x = minH.position.x = -0.03;
  g.add(hourH, minH);
  return { group: g, hourH, minH };
}
function tree() {
  const g = new THREE.Group();
  g.add(P.mesh(new THREE.CylinderGeometry(0.18, 0.28, 4, 10), P.std('#6b4a2e'), { y: 2 }));
  const leaf = P.std('#4f9a3c', { roughness: 0.85 });
  const r = P.rng(5);
  for (let i = 0; i < 9; i++) g.add(P.mesh(new THREE.IcosahedronGeometry(0.9 + r() * 0.5, 2), leaf, { x: (r() - 0.5) * 2.2, y: 4.2 + r() * 1.4, z: (r() - 0.5) * 2.2 }));
  return g;
}
function leafMesh() {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.05, 0.04, 0, 0.12); s.quadraticCurveTo(-0.05, 0.04, 0, 0);
  return P.mesh(new THREE.ShapeGeometry(s), P.phys('#e0922e', { side: THREE.DoubleSide, roughness: 0.7 }), { cast: false });
}
function foodBag() {
  const tex = canvasTex(256, 384, (c, w, h) => {
    c.fillStyle = '#e04f2f'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff2d6'; c.font = '900 44px Helvetica, Arial'; c.textAlign = 'center';
    c.fillText('CHICKEN', w / 2, 110); c.fillText('FLAVOR', w / 2, 160);
    c.font = '700 26px Helvetica, Arial'; c.fillText('100% REAL TASTE*', w / 2, 330);
    c.fillStyle = '#ffd34a'; c.beginPath(); c.arc(w / 2, 240, 46, 0, PI * 2); c.fill();
  });
  const mats = [P.phys('#c8452a'), P.phys('#c8452a'), P.phys('#c8452a'), P.phys('#c8452a'), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }), P.phys('#c8452a')];
  return P.mesh(new THREE.BoxGeometry(0.34, 0.5, 0.14), mats, { y: 0.25 });
}
function sign(text, bg = '#f6efe0', fg = '#c0281f') {
  const g = new THREE.Group();
  const tex = canvasTex(512, 300, (c, w, h) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#7a5a3a'; c.lineWidth = 12; c.strokeRect(6, 6, w - 12, h - 12);
    c.fillStyle = fg; c.font = '900 74px Helvetica, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const lines = text.split('\n'); lines.forEach((ln, i) => c.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 86));
  });
  g.add(P.mesh(new THREE.BoxGeometry(0.9, 0.53, 0.025), [P.std('#d9c9a8'), P.std('#d9c9a8'), P.std('#d9c9a8'), P.std('#d9c9a8'), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), P.std('#d9c9a8')], { y: 1.55 }));
  g.add(P.mesh(new THREE.BoxGeometry(0.05, 1.5, 0.04), P.std('#8a6440'), { y: 0.75, z: -0.03 }));
  return g;
}
function milkJug() {
  const g = new THREE.Group();
  g.add(P.mesh(lathe([[0.0001, 0], [0.11, 0], [0.12, 0.03], [0.12, 0.26], [0.07, 0.33], [0.04, 0.36], [0.04, 0.39], [0.0001, 0.39]]), P.phys('#f7f7f3', { roughness: 0.35, clearcoat: 0.4 })));
  g.add(P.mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 20), P.phys('#d93a2c', { roughness: 0.4 }), { y: 0.4 }));
  return g;
}
function hayBale() {
  const tex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#d9b45a'; c.fillRect(0, 0, w, h);
    const r = P.rng(3); for (let i = 0; i < 400; i++) { c.strokeStyle = r() > 0.5 ? '#b8923f' : '#ecd27e'; c.lineWidth = 2; const x = r() * w, y = r() * h; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 10); c.stroke(); }
  });
  return P.mesh(P.rbox(1.1, 0.5, 0.6, 0.06), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }), { y: 0.25 });
}
function microphone() {
  const g = new THREE.Group();
  g.add(P.mesh(new THREE.CylinderGeometry(0.014, 0.01, 0.16, 12), P.phys('#222', { roughness: 0.4 }), { y: -0.08 }));
  g.add(P.mesh(new THREE.SphereGeometry(0.026, 16, 12), P.phys('#9a9aa0', { metalness: 0.7, roughness: 0.35 })));
  return g;
}
function flowers(n, area, seed = 7) {
  const g = new THREE.Group();
  const r = P.rng(seed);
  const stem = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.006, 0.008, 0.4, 5).translate(0, 0.2, 0), P.std('#3f8a37'), n);
  const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 10, 8).scale(1, 0.4, 1), P.phys('#ffffff', { roughness: 0.6 }), n);
  const mid = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 8, 6), P.std('#f6b21e'), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  const cols = ['#ff6f9f', '#ffffff', '#b98cff', '#ffd23f', '#ff8a3d'];
  for (let i = 0; i < n; i++) {
    const x = area[0] + r() * (area[1] - area[0]), z = area[2] + r() * (area[3] - area[2]), h = 0.7 + r() * 0.6, y = area[4](x, z);
    m.compose(V(x, y, z), q, V(1, h, 1)); stem.setMatrixAt(i, m);
    m.compose(V(x, y + 0.4 * h, z), q, V(1, 1, 1)); head.setMatrixAt(i, m); head.setColorAt(i, c.set(cols[i % cols.length]));
    m.compose(V(x, y + 0.4 * h + 0.012, z), q, V(1, 1, 1)); mid.setMatrixAt(i, m);
  }
  [stem, head, mid].forEach((x) => { x.castShadow = true; x.receiveShadow = true; g.add(x); });
  return g;
}

// gently moving sea: vertex waves + fresnel-ish tint, driven by a time uniform
function sea(size = 400) {
  const geo = new THREE.PlaneGeometry(size, size, 220, 220).rotateX(-PI / 2);
  const mat = new THREE.MeshPhysicalMaterial({ color: '#1f8fb5', roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 });
  const u = { time: { value: 0 } };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.time = u.time;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float time;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float w1 = sin(position.x * 0.35 + time * 1.3) * 0.12 + sin(position.z * 0.5 + time * 1.7) * 0.08 + sin((position.x + position.z) * 1.3 + time * 2.6) * 0.03;
        transformed.y += w1;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float dx = cos(position.x * 0.35 + time * 1.3) * 0.042 + cos((position.x + position.z) * 1.3 + time * 2.6) * 0.039;
        float dz = cos(position.z * 0.5 + time * 1.7) * 0.04 + cos((position.x + position.z) * 1.3 + time * 2.6) * 0.039;
        objectNormal = normalize(vec3(-dx, 1.0, -dz));`);
  };
  mat.customProgramCacheKey = () => 'sea';
  const m = new THREE.Mesh(geo, mat); m.receiveShadow = true;
  return { mesh: m, u };
}
function ring() {
  return P.mesh(new THREE.TorusGeometry(1, 0.03, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(2.0), transparent: true, opacity: 1, depthWrite: false }), { cast: false });
}
function fries() {
  const g = new THREE.Group();
  const box = new THREE.Shape(); box.moveTo(-0.05, 0); box.lineTo(0.05, 0); box.lineTo(0.065, 0.12); box.lineTo(-0.065, 0.12); box.lineTo(-0.05, 0);
  g.add(P.mesh(new THREE.ExtrudeGeometry(box, { depth: 0.05, bevelEnabled: false }).translate(0, 0, -0.025), P.phys('#d8302a', { roughness: 0.5 })));
  const f = P.phys('#f2c14a', { roughness: 0.6 });
  const r = P.rng(8);
  for (let i = 0; i < 14; i++) g.add(P.mesh(new THREE.BoxGeometry(0.011, 0.11, 0.011), f, { x: (r() - 0.5) * 0.09, y: 0.13 + r() * 0.03, z: (r() - 0.5) * 0.035, rz: (r() - 0.5) * 0.4 }));
  return g;
}
function umbrella() {
  const g = new THREE.Group();
  const tex = canvasTex(512, 64, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#e8453c'; c.fillRect(i * w / 8, 0, w / 8, h); } });
  g.add(P.mesh(new THREE.ConeGeometry(1.4, 0.45, 32, 1, true), P.phys('#ffffff', { map: tex, side: THREE.DoubleSide, roughness: 0.7 }), { y: 2.2 }));
  g.add(P.mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.3, 10), P.phys('#eee', { roughness: 0.4 }), { y: 1.15 }));
  return g;
}
function pole() {
  const g = new THREE.Group();
  g.add(P.mesh(new THREE.CylinderGeometry(0.12, 0.16, 7.5, 12), P.std('#6e5a44', { roughness: 0.9 }), { y: 3.75 }));
  g.add(P.mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), P.std('#5d4b38'), { y: 6.6 }));
  return g;
}
function wire(a, b, sag = 0.25, r = 0.012) {
  const pts = []; for (let i = 0; i <= 16; i++) { const k = i / 16; const p = a.clone().lerp(b, k); p.y -= sag * 4 * k * (1 - k); pts.push(p); }
  return P.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, r, 6), P.std('#222', { roughness: 0.5 }), { cast: false });
}
function net() {
  const g = new THREE.Group();
  g.add(P.mesh(new THREE.TorusGeometry(0.28, 0.012, 8, 32), P.std('#888'), { rx: PI / 2 }));
  g.add(P.mesh(new THREE.ConeGeometry(0.28, 0.45, 16, 1, true), new THREE.MeshStandardMaterial({ color: '#dddddd', wireframe: true }), { y: -0.22, rx: PI }));
  g.add(P.mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.1, 8), P.std('#8a6440'), { x: 0.28, y: 0.45, rz: -0.7 }));
  return g;
}
function cakePlate() {
  const g = new THREE.Group();
  g.add(P.mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.02, 40), P.phys('#ffffff', { roughness: 0.2, clearcoat: 0.8 })));
  const r = P.rng(12), crumbM = P.phys('#e8c38a', { roughness: 0.8 }), frost = P.phys('#ff9ac2', { roughness: 0.5 });
  for (let i = 0; i < 18; i++) g.add(P.mesh(new THREE.SphereGeometry(0.008 + r() * 0.01, 6, 5), r() > 0.7 ? frost : crumbM, { x: (r() - 0.5) * 0.25, y: 0.015, z: (r() - 0.5) * 0.25 }));
  g.add(P.mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.08, 8), P.phys('#6fc3ff'), { x: 0.05, y: 0.016, rz: PI / 2 - 0.2 }));
  const tag = canvasTex(256, 96, (c, w, h) => { c.fillStyle = '#f7f1d7'; c.fillRect(0, 0, w, h); c.fillStyle = '#222'; c.font = '700 44px Helvetica'; c.textAlign = 'center'; c.fillText('EXHIBIT A', w / 2, 64); });
  g.add(P.mesh(new THREE.PlaneGeometry(0.16, 0.06).rotateX(-PI / 2 + 0.2), new THREE.MeshStandardMaterial({ map: tag }), { x: 0.12, y: 0.03, z: 0.2, ry: -0.3, cast: false }));
  return g;
}
function gavel() {
  const g = new THREE.Group();
  const w = P.phys('#6a3a22', { roughness: 0.35, clearcoat: 0.5 });
  g.add(P.mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 20).rotateZ(PI / 2), w, { y: 0.0 }));
  g.add(P.mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.22, 10), w, { y: -0.11 }));
  return g;
}

// ===================================================================================================== scenes
export function buildScenes() {
  return {
    bedroom: (e) => bedroom(e, false),
    bedroomNight: (e) => bedroom(e, true),
    farm,
    drivethru,
    vetlot,
    city,
    beach,
    office,
    court,
  };
}

// ------------------------------------------------------------------ bedroom (day / night)
function bedroom(engine, night) {
  const scene = new THREE.Scene();
  const R = {};
  scene.add(night
    ? skyDome({ top: '#0b1430', horizon: '#2a3a66', bottom: '#141a2c', sunDir: [1, 0.3, -0.2], sunCol: '#dfe8ff', sunSize: 0.4, haze: 0.15 })
    : skyDome({ top: '#4e6fb3', horizon: '#ffc59a', bottom: '#5a6a80', sunDir: [1, 0.12, -0.15], sunCol: '#ffb070', sunSize: 3, haze: 0.7 }));
  scene.environment = engine.roomEnv; scene.environmentIntensity = night ? 0.06 : 0.28;
  scene.add(P.mesh(new THREE.PlaneGeometry(9, 9).rotateX(-PI / 2), P.phys('#ffffff', { map: P.woodFloorTex('#a8703f', [4, 4]), roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.35 }), { cast: false }));
  const wallMat = P.phys('#b8c6d6', { roughness: 0.92 });
  scene.add(P.mesh(new THREE.BoxGeometry(9, 2.8, 0.1), wallMat, { y: 1.4, z: -3.05 }));
  // left wall with a door opening (z 1.15..2.05, y 0..2.15)
  const Lw = (z0, z1, y0, y1) => P.mesh(new THREE.BoxGeometry(0.1, y1 - y0, z1 - z0), wallMat, { x: -2.45, y: (y0 + y1) / 2, z: (z0 + z1) / 2 });
  scene.add(Lw(-4.5, 1.15, 0, 2.8), Lw(2.05, 4.5, 0, 2.8), Lw(1.15, 2.05, 2.15, 2.8));
  scene.add(P.mesh(new THREE.BoxGeometry(3, 2.6, 3), P.phys('#8a8f9a', { roughness: 0.95, side: THREE.BackSide }), { x: -4.0, y: 1.3, z: 1.6, cast: false }));
  const hallLight = new THREE.PointLight('#ffe2b8', night ? 0.6 : 1.2, 5, 2); hallLight.position.set(-3.6, 2.2, 1.6); scene.add(hallLight);
  const D = door(); D.group.position.set(-2.42, 0, 1.6); scene.add(D.group); R.door = D;
  const Rw = (z0, z1, y0, y1) => P.mesh(new THREE.BoxGeometry(0.12, y1 - y0, z1 - z0), wallMat, { x: 2.66, y: (y0 + y1) / 2, z: (z0 + z1) / 2 });
  scene.add(Rw(-4.5, -1.55, 0, 2.8), Rw(-0.25, 4.5, 0, 2.8), Rw(-1.55, -0.25, 0, 0.92), Rw(-1.55, -0.25, 2.17, 2.8));
  scene.add(P.mesh(new THREE.BoxGeometry(0.06, 0.12, 9), P.phys('#f3efe6'), { x: -2.38, y: 0.06 }));
  scene.add(P.mesh(new THREE.BoxGeometry(9, 0.12, 0.06), P.phys('#f3efe6'), { y: 0.06, z: -2.98 }));
  const win = P.windowWithBlinds({ w: 1.3, h: 1.25, sill: 0.92, open: 0.5 }); win.position.set(2.6, 0, -0.9); scene.add(win);
  const roofMat = P.std('#59647a');
  for (let i = 0; i < 7; i++) scene.add(P.mesh(new THREE.BoxGeometry(6, 3 + (i * 37 % 5), 6), night ? P.std('#262c40') : roofMat, { x: 22 + (i % 3) * 7, y: 1.5, z: -14 + i * 4.5, cast: false }));
  if (night) for (let i = 0; i < 26; i++) { const r = P.rng(40 + i); scene.add(P.mesh(new THREE.PlaneGeometry(0.6, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd58a').multiplyScalar(1.6) }), { x: 18.9 + (i % 3) * 7, y: 1.0 + r() * 2.4, z: -15 + (i % 7) * 4.5 + r() * 2, ry: -PI / 2, cast: false })); }
  const tr = tree(); tr.position.set(7.5, -1.5, -2.2); scene.add(tr);
  const lf = leafMesh(); scene.add(lf); R.leaf = lf;
  const bed = P.bed(); bed.position.set(0.2, 0, -1.9); scene.add(bed);
  const ns = P.nightstand(); ns.position.set(-1.27, 0, -2.75); scene.add(ns);
  const clock = P.alarmClock(); clock.position.set(-1.22, 0.55, -2.78); clock.rotation.y = PI / 2 - 0.25; scene.add(clock);
  const wc = wallClock(); wc.group.position.set(2.58, 1.95, 0.55); scene.add(wc.group); R.wallClock = wc;
  const lamp = new THREE.Group();
  lamp.add(P.mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.25, 20), P.phys('#d8c7a8'), { y: 0.125 }));
  lamp.add(P.mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.18, 24, 1, true), P.phys('#f6ead2', { side: THREE.DoubleSide, emissive: '#ffcf8a', emissiveIntensity: night ? 1.4 : 0.6 }), { y: 0.33 }));
  lamp.position.set(-1.38, 0.55, -2.88); scene.add(lamp);
  const rug = P.rug(0.95); rug.position.set(0.55, 0, 0.75); scene.add(rug);
  const vz = vase(); scene.add(vz); R.vase = vz;
  const sh = shards(); sh.position.set(2.0, 0, -0.5); scene.add(sh); R.shards = sh;
  sh.children.forEach((c) => (c.userData.home = c.position.clone()));
  const bowl = P.dogBowl(); bowl.scale.setScalar(0.75); bowl.position.set(0.35, 0, 1.45); scene.add(bowl); R.bowl = bowl;
  const bag = foodBag(); bag.position.set(0.82, 0, 1.05); bag.rotation.y = -0.4; scene.add(bag);
  // characters
  const dog = makeCharacter('dog'); scene.add(dog.root);
  const cat = makeCharacter('cat'); scene.add(cat.root);
  const owner = makeCharacter('owner'); scene.add(owner.root);
  const ownerUp = makeCharacter('owner'); scene.add(ownerUp.root);
  const mos = makeCharacter('mosquito'); mos.root.scale.setScalar(0.1); scene.add(mos.root);
  const S = night ? 'N' : 'D';
  cast['dog' + S] = dog; cast['cat' + S] = cat; cast['ownerBed' + S] = owner; cast['ownerUp' + S] = ownerUp; cast['mosq' + S] = mos;
  // vocabulary counter, words, food bubble (day only)
  if (!night) {
    const counter = new Text3D({ size: 0.26, depth: 0.1, bevel: 0.016, color: '#ff4fa3', emissive: 0.15 });
    const label = new Text3D({ size: 0.12, depth: 0.05, bevel: 0.008, color: '#ffffff', emissive: 0.05 }); label.setText('WORDS');
    const cgrp = new THREE.Group(); cgrp.add(counter.group, label.group); label.group.position.y = -0.2; scene.add(cgrp);
    W.counter = counter; W.cgrp = cgrp;
    const vocab = ['SIT', 'BALL', 'TREAT', 'PARK', 'BACON', 'NO!', 'GOOD BOY', 'SQUIRREL', 'DINNER', 'CHEESE'];
    W.words = vocab.map((w, i) => { const t = new Text3D({ size: 0.062, depth: 0.025, bevel: 0.005, color: ['#ffd23f', '#6fd3ff', '#ff8a3d', '#9ff07a'][i % 4], emissive: 0.1 }); t.setText(w); scene.add(t.group); return t; });
    W.foodBubble = new ThoughtBubble(engine, (sub) => {
      sub.background = new THREE.Color('#ffd76a'); sub.environment = engine.roomEnv; sub.environmentIntensity = 0.6;
      const b = P.dogBowl(); sub.add(b);
      const k = new THREE.DirectionalLight('#fff3dd', 2.5); k.position.set(1, 2, 1.5); sub.add(k, new THREE.HemisphereLight('#fff', '#c98a3a', 1.0));
      const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 20); camera.position.set(0, 0.75, 1.15); camera.lookAt(0, 0.2, 0);
      return { camera, update(lt) { b.rotation.y = 0.4 + lt * 0.25; } };
    }, { size: 0.34 });
    scene.add(W.foodBubble.group);
    const hours = new Text3D({ size: 0.092, depth: 0.035, bevel: 0.006, color: '#ff4fa3', emissive: 0.15 }); hours.setText('8 HOURS');
    hours.group.position.set(2.5, 2.33, 0.55); hours.group.rotation.y = -PI / 2; scene.add(hours.group); W.hours = hours;
  }
  // light
  if (night) {
    sun(scene, '#9fb6ff', 1.3, V(9, 4.0, -0.6), V(0, 0.4, -1.3), 4.5);
    scene.add(new THREE.HemisphereLight('#3a4a7a', '#1a1410', 0.25));
    const lampLight = new THREE.PointLight('#ffb766', 2.6, 5, 2); lampLight.position.set(-1.38, 0.95, -2.75); scene.add(lampLight);
    const fill = new THREE.PointLight('#ffcf9a', 0.5, 6, 2); fill.position.set(0.5, 2.2, 1.0); scene.add(fill);
    const pillow = new THREE.PointLight('#ffc98a', 0.35, 1.2, 2); pillow.position.set(-0.55, 1.0, -2.35); scene.add(pillow);
  } else {
    sun(scene, '#ffc896', 3.4, V(9, 3.4, -0.6), V(0, 0.4, -1.3), 4.5);
    scene.add(new THREE.HemisphereLight('#a9c1ea', '#6a5242', 0.55));
    const lampLight = new THREE.PointLight('#ffc27a', 1.4, 4, 2); lampLight.position.set(-1.38, 0.95, -2.75); scene.add(lampLight);
  }
  W['bed' + S] = R;
  const vaseT = () => ({ tip: at('n3@snitch') + 0.25, fall: at('n3.end') - 0.35, hit: at('n3.end') + 0.08 });
  return {
    scene, dof: { aperture: 0.02, maxblur: 0.012 }, exposure: night ? 1.15 : 1.0,
    grade: night ? { warmth: -0.01, saturation: 1.05, vignette: 0.42 } : undefined,
    update(ctx) {
      const t = ctx.t;
      dog.root.visible = true; owner.root.visible = true; cat.root.visible = true; ownerUp.root.visible = false; mos.root.visible = false;
      dog.root.position.set(-1.05, 0, -2.35); dog.root.rotation.set(0, PI / 2, 0);
      dog.pose({ head: [0.05, 0, 0], tail: Math.sin(t * 9) * 0.5, lids: blink(t, 1), look: [0, 0.1] });
      owner.root.position.set(-0.2, 0.58, -0.93); owner.root.rotation.set(-PI / 2 + 0.12, 0, 0);
      owner.pose({ head: [0, 0.35, 0], lids: 0 });
      cat.root.position.set(2.43, 0.925, -0.9); cat.root.rotation.set(0, -PI / 2, 0);
      cat.pose({ head: [0, 0, 0], tail: Math.sin(t * 1.3) * 0.08, lids: blink(t, 4, 4.4) });
      // the vase on the sill: stands, tips, falls, shatters
      const T = vaseT();
      const base = V(2.43, 0.925, -0.42);
      R.vase.visible = t < T.hit; R.shards.visible = t >= T.hit;
      const burst = ease.out(ramp(t, T.hit, T.hit + 0.35));
      R.shards.children.forEach((c) => { const h = c.userData.home; c.position.set(h.x * (0.15 + 0.85 * burst), h.y + 0.12 * Math.sin(PI * burst) * (1 - burst * 0.5), h.z * (0.15 + 0.85 * burst)); });
      if (t < T.fall) {
        const k = ease.inOut(ramp(t, T.tip, T.fall));
        R.vase.position.copy(base); R.vase.rotation.set(0, 0, 0.9 * k);
      } else {
        const k = clamp01((t - T.fall) / (T.hit - T.fall));
        R.vase.position.set(lerp(base.x, 2.05, k), lerp(base.y, 0.08, k * k), lerp(base.z, -0.5, k));
        R.vase.rotation.set(0.4 * k, 0, 0.9 + 2.2 * k);
      }
      // the door: opens for the goodbye, closes after
      const dOpen = ease.inOut(ramp(t, at('n5') + 0.2, at('n5') + 1.0)) * (1 - ease.inOut(ramp(t, at('bye.end') - 0.35, at('bye.end') + 0.05)));
      R.door.panel.rotation.y = -1.25 * dOpen;
      // wall clock spins through 8 hours during the window time-lapse
      const span = ease.inOut(ramp(t, at('n16b@stare'), at('n16b@reporting')));
      R.wallClock.minH.rotation.x = -(t * 0.02 + span * 8 * PI * 2); R.wallClock.hourH.rotation.x = -(t * 0.002 + span * 8 / 12 * PI * 2 + 2.0);
      // a leaf drifting down outside the window
      const lt = (t - at('leaf') + 1.2) / 2.4;
      R.leaf.visible = lt > 0 && lt < 1;
      R.leaf.position.set(3.4 + Math.sin(lt * 9) * 0.12, lerp(2.3, 0.6, lt), -0.95 + Math.sin(lt * 5) * 0.2); R.leaf.rotation.set(lt * 6, lt * 3, Math.sin(lt * 8));
      if (W.cgrp && !night) W.counter.setText(String(Math.round(165 * ease.out(ramp(t, at('n2@knows'), at('n2@words') + 0.25)))));
      if (W.cgrp) { W.cgrp.visible = false; W.words.forEach((w) => (w.group.visible = false)); W.foodBubble.group.visible = false; W.hours.group.visible = false; }
    },
  };
}

// ------------------------------------------------------------------ farm (herd, chicken yard, strike line, flowers)
function farm(engine) {
  const scene = new THREE.Scene();
  const skyOpts = { top: '#2f7fe0', horizon: '#cfe8fb', bottom: '#8fb07a', sunDir: [0.5, 0.75, 0.3], sunCol: '#fff3d6', haze: 0.25 };
  scene.add(skyDome(skyOpts));
  scene.environment = skyEnvironment(engine, skyOpts); scene.environmentIntensity = 0.7;
  scene.fog = new THREE.Fog('#cfe3f2', 70, 330);
  const H = (x, z) => 5.5 * Math.sin(x * 0.021 + 0.4) * Math.cos(z * 0.018) + 2.6 * Math.sin(x * 0.055 + 1.3) * Math.sin(z * 0.043 + 0.5) + 1.2 * Math.sin(x * 0.13 + z * 0.09);
  scene.add(P.hills({ size: 800, seg: 200, color: '#5c9a3c', height: H }));
  const T = cast.cowTemplate;
  const n = 340, herd = new THREE.InstancedMesh(T.geometry, T.material, n);
  const r = P.rng(21), m = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * 130, z = -150 + r() * 175;
    if ((Math.abs(x) < 9 && z < -95) || (x > -4 && x < 14 && z > -30 && z < -12) || (x < -30 && z > -75 && z < -45)) { i--; continue; }
    q.setFromEuler(new THREE.Euler(0, r() * PI * 2, 0)); const s = 1.1 + r() * 0.25;
    m.compose(V(x, H(x, z) - 0.05, z), q, V(s, s, s)); herd.setMatrixAt(i, m);
  }
  herd.castShadow = true; herd.receiveShadow = true; scene.add(herd);
  const trees = []; const r2 = P.rng(4);
  for (let i = 0; i < 60; i++) { const x = (r2() < 0.5 ? -1 : 1) * (60 + r2() * 120), z = -260 + r2() * 300; trees.push([x, H(x, z), z, 1.4 + r2() * 1.4]); }
  for (let i = 0; i < 26; i++) { const x = (r2() < 0.5 ? -1 : 1) * (14 + r2() * 30), z = -150 + r2() * 110; trees.push([x, H(x, z), z, 1.0 + r2() * 0.9]); }
  scene.add(P.treeInstances(trees));
  const barn = P.barn(); barn.position.set(-52, H(-52, -70), -70); barn.rotation.y = 0.6; scene.add(barn);
  scene.add(P.fenceLine([-30, 0, -20], [30, 0, -20], H, { n: 30 }));
  scene.add(P.fenceLine([-30, 0, -20], [-45, 0, -110], H, { n: 30 }));
  const num = new Text3D({ size: 2.6, depth: 0.9, bevel: 0.14, color: '#ff4fa3', emissive: 0.1 });
  const word = new Text3D({ size: 1.9, depth: 0.7, bevel: 0.11, color: '#ffffff', emissive: 0.05 }); word.setText('COWS');
  const g = new THREE.Group(); g.add(num.group, word.group); word.group.position.y = -2.8;
  g.position.set(0, H(0, -125) + 4.6, -125); g.rotation.x = -0.12; scene.add(g);
  W.farmNum = num;
  // chicken yard by the barn: hay bale, hero hen, flock, scientist with a microphone, 30 billion counter
  const yard = V(-40, 0, -58); yard.y = H(yard.x, yard.z);
  const bale = hayBale(); bale.position.copy(yard); bale.rotation.y = 0.5; scene.add(bale);
  const hen = makeCharacter('chicken'); hen.root.position.set(yard.x, yard.y + 0.5, yard.z); hen.root.rotation.y = 0.9; scene.add(hen.root); cast.hen = hen;
  W.flock = [];
  const r3 = P.rng(9);
  for (let i = 0; i < 18; i++) {
    const c = makeCharacter('chicken'); const a = r3() * PI * 2, d = 1.6 + r3() * 4.5;
    const x = yard.x + Math.cos(a) * d, z = yard.z + Math.sin(a) * d;
    c.root.position.set(x, H(x, z), z); c.root.rotation.y = r3() * PI * 2; c.root.scale.setScalar(0.9 + r3() * 0.2);
    scene.add(c.root); W.flock.push(c);
  }
  const sci = makeCharacter('sci'); sci.root.position.set(yard.x + 1.1, yard.y, yard.z + 0.9); sci.root.rotation.y = -PI / 2 - 0.35; scene.add(sci.root); cast.sci = sci;
  const mic = microphone(); scene.add(mic); W.mic = mic;
  const chickNum = new Text3D({ size: 0.9, depth: 0.3, bevel: 0.05, color: '#ff4fa3', emissive: 0.1 });
  const chickWord = new Text3D({ size: 0.6, depth: 0.22, bevel: 0.04, color: '#ffffff', emissive: 0.05 }); chickWord.setText('CHICKENS');
  const cg = new THREE.Group(); cg.add(chickNum.group, chickWord.group); chickWord.group.position.y = -0.9;
  cg.position.set(yard.x - 3.5, yard.y + 4.2, yard.z - 4.5); cg.rotation.y = 0.75; scene.add(cg);
  W.chickNum = chickNum; W.chickGroup = cg;
  // the picket line: three cows behind the fence with signs, seven milk jugs on the grass
  W.strikers = [5.25, 6.3, 7.35].map((x, i) => {
    const c = makeCharacter('cow_head'); c.root.position.set(x, H(x, -21.6) - 0.62, -21.6); c.root.rotation.y = (i - 1) * -0.18; scene.add(c.root); return c;
  });
  W.signs = [['NO GRASS\nNO MILK', '#f6efe0', '#c0281f'], ['MOO-NION\nSTRONG', '#fff6c8', '#2a4f9a'], ['UDDER\nINJUSTICE', '#f6efe0', '#1f7a3a']].map(([txt, bg, fg], i) => {
    const s = sign(txt, bg, fg); const x = [5.15, 6.3, 7.45][i]; s.position.set(x, H(x, -19.3), -19.3 + Math.abs(i - 1) * 0.15); s.rotation.y = (i - 1) * -0.2; s.scale.setScalar(0.85); scene.add(s); return s;
  });
  W.jugs = Array.from({ length: 7 }, (_, i) => { const j = milkJug(); const x = 3.2 + i * 0.85, z = -17.6; j.position.set(x, H(x, z), z); scene.add(j); return j; });
  const galNum = new Text3D({ size: 0.3, depth: 0.11, bevel: 0.02, color: '#ff4fa3', emissive: 0.1 }); galNum.setText('7 GALLONS');
  const galWord = new Text3D({ size: 0.2, depth: 0.07, bevel: 0.012, color: '#ffffff', emissive: 0.05 }); galWord.setText('A DAY');
  const gg = new THREE.Group(); gg.add(galNum.group, galWord.group); galWord.group.position.y = -0.3;
  gg.position.set(5.9, H(5.9, -18) + 2.15, -18.2); scene.add(gg); W.galGroup = gg;
  // flower patch with the bee, and "1 IN 3 BITES"
  const fx = 22, fz = -2;
  scene.add(flowers(420, [fx - 5, fx + 5, fz - 5, fz + 4, H], 7));
  const bee = makeCharacter('bee'); bee.root.scale.setScalar(2.2); scene.add(bee.root); cast.bee = bee;
  const biteNum = new Text3D({ size: 0.34, depth: 0.12, bevel: 0.02, color: '#ff4fa3', emissive: 0.1 }); biteNum.setText('1 IN 3');
  const biteWord = new Text3D({ size: 0.16, depth: 0.06, bevel: 0.01, color: '#ffffff', emissive: 0.05 }); biteWord.setText('BITES OF FOOD');
  const bg = new THREE.Group(); bg.add(biteNum.group, biteWord.group); biteWord.group.position.y = -0.28;
  bg.position.set(fx, H(fx, fz) + 1.75, fz - 1.4); scene.add(bg); W.biteGroup = bg;
  W.flowerSpot = V(fx, H(fx, fz), fz);
  sun(scene, '#fff0d2', 3.4, V(120, 70, 10), V(0, 0, -60), 140, 4096);
  scene.add(new THREE.HemisphereLight('#cfe6ff', '#4a6332', 0.5));
  return {
    scene, H, dof: { aperture: 0.0 },
    update(ctx) {
      const t = ctx.t;
      W.farmNum.setText(commas(1.5e9 * ease.out(ramp(t, at('n10@earth'), at('n10@cows')))));
      W.chickNum.setText(commas(3e10 * ease.out(ramp(t, at('n11@more'), at('n11@chickens') + 0.2))));
      hen.pose({ head: [0.1 * Math.sin(t * 3), 0.3 * Math.sin(t * 1.3), 0], lids: blink(t, 2), look: [0, 0] });
      W.flock.forEach((c, i) => { const pk = Math.max(0, Math.sin(t * 2.2 + i * 1.7)) ** 8; c.pose({ head: [0.9 * pk, 0.4 * Math.sin(t * 0.7 + i), 0], lids: blink(t, i, 3 + (i % 3) * 0.4) }); });
      sci.pose({ lids: blink(t, 6), look: [0.4, -0.2], nodes: { arm_l: [-0.3, 0, 0], fore_l: [-1.3, 0, 0] } });
      W.mic.visible = false;
      W.strikers.forEach((c, i) => c.pose({ head: [0.12, 0.08 * Math.sin(t * 1.1 + i), 0], lids: blink(t, i + 3, 3.3), look: [0, -0.1] }));
      W.signs.forEach((s, i) => { s.rotation.z = 0.05 * Math.sin(t * 2 + i); });
      W.jugs.forEach((j) => j.scale.setScalar(1));
      W.galGroup.visible = false; W.chickGroup.visible = false; W.biteGroup.visible = false;
      const fl = W.flowerSpot;
      bee.root.position.set(fl.x + Math.sin(t * 1.1) * 0.6, fl.y + 0.85 + Math.sin(t * 2.3) * 0.12, fl.z + Math.sin(t * 0.8) * 0.3);
      bee.root.rotation.set(0, Math.sin(t * 0.6) * 0.5 + 0.3, 0);
      const fl2 = Math.sin(t * 95);
      bee.pose({ lids: blink(t, 8, 2.4), look: [0, 0.05], nodes: { wing_l: [0, 0, 0.7 * fl2], wing_r: [0, 0, -0.7 * fl2] } });
    },
  };
}

// ------------------------------------------------------------------ drive-thru (car interior)
function drivethru(engine) {
  const scene = new THREE.Scene();
  const skyOpts = { top: '#3a86de', horizon: '#d8ecfa', bottom: '#77746e', sunDir: [-0.6, 0.6, 0.4], sunCol: '#fff1d0', haze: 0.3 };
  scene.add(skyDome(skyOpts));
  scene.environment = skyEnvironment(engine, skyOpts); scene.environmentIntensity = 0.65;
  scene.add(P.carInterior());
  scene.add(P.mesh(new THREE.PlaneGeometry(200, 200).rotateX(-PI / 2), P.std('#4b4c51', { roughness: 0.95 }), { y: -0.5, cast: false }));
  for (let i = -6; i < 6; i++) scene.add(P.mesh(new THREE.PlaneGeometry(0.15, 2.4).rotateX(-PI / 2), P.std('#e8e4d6'), { x: -2.8, y: -0.49, z: i * 3.2, cast: false }));
  scene.add(P.mesh(new THREE.BoxGeometry(1, 5, 30), P.std('#f1e2c6'), { x: -6.5, y: 2.0 }));
  scene.add(P.mesh(new THREE.BoxGeometry(0.2, 0.6, 30), P.std('#c8352b'), { x: -5.95, y: 3.4 }));
  scene.add(P.mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshStandardMaterial({ map: P.labelTex('MOO BURGER', { w: 1024, h: 256, font: '900 170px Helvetica, Arial, sans-serif' }), emissive: '#ffffff', emissiveIntensity: 0.25 }), { x: -5.93, y: 3.0, z: -3, ry: PI / 2, cast: false }));
  scene.add(P.mesh(P.rbox(0.1, 1.2, 1.6, 0.02), P.phys('#9fc6dc', { roughness: 0.05, clearcoat: 1 }), { x: -5.96, y: 1.0, z: 1.5 }));
  for (const z of [-9, 7]) { const c = P.car(z < 0 ? '#2f6fb3' : '#e8c33a'); c.position.set(-3.6, -0.5, z); scene.add(c); }
  const cow = makeCharacter('cow_head'); scene.add(cow.root); cast.cowHead = cow;
  const hb = new THREE.Group(); hb.add(makeCharacter('hand').root);
  const burger = P.burger(1.0); burger.position.set(0, 0.016, 0.0); hb.add(burger);
  scene.add(hb); W.handBurger = hb;
  sun(scene, '#fff0d4', 3.0, V(-14, 12, 9), V(-1, 0.5, 0), 8);
  scene.add(new THREE.HemisphereLight('#d4e7ff', '#6b6660', 0.55));
  const inside = new THREE.PointLight('#ffe9d2', 0.9, 3, 2); inside.position.set(0.2, 1.1, 0.4); scene.add(inside);
  return {
    scene, dof: { aperture: 0.02, maxblur: 0.01 },
    update() { cow.root.position.set(-6, -0.5, 0.18); W.handBurger.position.set(-0.32, 0.74, 0.08); W.handBurger.rotation.set(0.25, -PI / 2 + 0.3, -0.15); },
  };
}

// ------------------------------------------------------------------ vet parking lot
function vetlot(engine) {
  const scene = new THREE.Scene();
  const skyOpts = { top: '#3a86de', horizon: '#d8ecfa', bottom: '#77746e', sunDir: [0.6, 0.55, 0.5], sunCol: '#fff1d0', haze: 0.3 };
  scene.add(skyDome(skyOpts));
  scene.environment = skyEnvironment(engine, skyOpts); scene.environmentIntensity = 0.7;
  scene.add(P.mesh(new THREE.PlaneGeometry(120, 120).rotateX(-PI / 2), P.std('#55565b', { roughness: 0.95 }), { cast: false }));
  for (let i = -5; i < 6; i++) scene.add(P.mesh(new THREE.PlaneGeometry(0.12, 4).rotateX(-PI / 2), P.std('#ecebe2'), { x: i * 2.8 - 1.4, y: 0.005, z: -1, cast: false }));
  scene.add(P.mesh(new THREE.BoxGeometry(24, 5, 1), P.std('#cfe5de'), { y: 2.5, z: -6 }));
  scene.add(P.mesh(new THREE.PlaneGeometry(6, 1.2), new THREE.MeshStandardMaterial({ map: P.labelTex('ANIMAL HOSPITAL', { w: 1024, h: 210, bg: '#1f8d8a', fg: '#ffffff', font: '900 120px Helvetica, Arial, sans-serif' }), emissive: '#ffffff', emissiveIntensity: 0.2 }), { y: 4.0, z: -5.49, cast: false }));
  scene.add(P.mesh(P.rbox(2.2, 2.4, 0.1, 0.03), P.phys('#9fc6dc', { roughness: 0.05, clearcoat: 1 }), { x: -3, y: 1.2, z: -5.45 }));
  const car = P.car('#d23b32'); car.position.set(2.4, 0, -1.0); car.rotation.y = 0.1; scene.add(car);
  const dog = makeCharacter('dog'); scene.add(dog.root); cast.dogVet = dog;
  const owner = makeCharacter('owner'); scene.add(owner.root); cast.ownerVet = owner;
  const leash = P.mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6), P.phys('#d23b6a'), { cast: false }); scene.add(leash); W.leash = leash;
  sun(scene, '#fff0d4', 3.2, V(10, 14, 10), V(0, 0, -1), 9);
  scene.add(new THREE.HemisphereLight('#d4e7ff', '#6b6660', 0.6));
  return {
    scene, dof: { aperture: 0.015, maxblur: 0.01 },
    update(ctx) {
      const t = ctx.t;
      owner.root.position.set(0.9, 0, 0.2); owner.root.rotation.set(0, -1.2, 0);
      owner.pose({ lids: blink(t, 3), look: [0.3, -0.4], head: [0.25, 0.1, 0], nodes: { arm_r: [-0.75, 0.0, -0.25], fore_r: [-0.35, 0, 0] } });
      dog.root.position.set(-0.6, 0, 0.6); dog.root.rotation.set(0, 1.9, 0);
      dog.pose({ body: [-0.22, 0, 0], head: [0.15, 0, 0], ears: [-0.35, -0.35], lids: blink(t, 1), look: [0, 0], tail: 0.6 });
    },
    leash(from, to) {
      const d = to.clone().sub(from); const L = d.length();
      W.leash.position.copy(from).addScaledVector(d, 0.5); W.leash.scale.set(1, L, 1);
      W.leash.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
    },
  };
}

// ------------------------------------------------------------------ city: ledge pigeons + crows on a wire at street level
function city(engine) {
  const scene = new THREE.Scene();
  const skyOpts = { top: '#3d88dc', horizon: '#dbeaf6', bottom: '#8d8f94', sunDir: [0.4, 0.7, -0.5], sunCol: '#fff3dc', haze: 0.3 };
  scene.add(skyDome(skyOpts));
  scene.environment = skyEnvironment(engine, skyOpts); scene.environmentIntensity = 0.7;
  scene.fog = new THREE.Fog('#d4e3ef', 60, 260);
  const stone = P.phys('#d9cfbf', { roughness: 0.85 });
  scene.add(P.mesh(P.rbox(24, 0.32, 0.62, 0.04), stone, { y: 14.84, z: -0.05 }));
  scene.add(P.mesh(P.rbox(24, 0.16, 0.5, 0.03), stone, { y: 14.6, z: 0.02 }));
  const ours = P.cityBlock({ w: 80, h: 14.5, d: 12, wall: '#d4c4ad', seed: 2, lit: 0.05 }); ours.position.set(20, 0, 6.25); scene.add(ours);
  scene.add(P.mesh(new THREE.BoxGeometry(80, 3, 12), P.std('#cdbda6'), { x: 20, y: 16.0, z: 6.4 }));
  scene.add(P.mesh(new THREE.PlaneGeometry(240, 60).rotateX(-PI / 2), P.std('#55565c', { roughness: 0.95 }), { y: 0, z: -20, cast: false }));
  scene.add(P.mesh(new THREE.BoxGeometry(240, 0.15, 3.2), P.std('#b9b4aa'), { y: 0.075, z: -1.6, cast: false }));
  scene.add(P.mesh(new THREE.BoxGeometry(240, 0.15, 3.2), P.std('#b9b4aa'), { y: 0.075, z: -17.4, cast: false }));
  for (let i = -24; i < 24; i++) scene.add(P.mesh(new THREE.PlaneGeometry(2.4, 0.18).rotateX(-PI / 2), P.std('#efe9d0'), { x: i * 5, y: 0.01, z: -9.5, cast: false }));
  const cols = ['#c9b8a2', '#a7b3c2', '#d8c2a6', '#b9a8a0', '#c5cdd6'];
  for (let i = 0; i < 10; i++) { const b = P.cityBlock({ w: 16, h: 22 + (i * 13) % 26, d: 14, wall: cols[i % 5], seed: 10 + i, lit: 0.08 }); b.position.set(-56 + i * 16, 0, -26); scene.add(b); }
  [['#d23b32', -6, -6.5], ['#f0f0ea', 9, -12.5], ['#2f6fb3', 22, -6.5], ['#e8c33a', 31, -12.5]].forEach(([c, x, z]) => { const k = P.car(c); k.position.set(x, 0, z); k.rotation.y = z < -9 ? -PI / 2 : PI / 2; scene.add(k); });
  W.pigeons = [-1.15, -0.58, 0.0, 0.52, 1.08].map((x, i) => { const p = makeCharacter('pigeon'); p.root.scale.setScalar(1.0 + (i % 3) * 0.06); scene.add(p.root); return p; });
  const man = makeCharacter('bald'); scene.add(man.root); cast.bald = man;
  // poles + wire on our sidewalk, crows on it
  const p1 = pole(); p1.position.set(26, 0, -2.9); scene.add(p1);
  const p2 = pole(); p2.position.set(40, 0, -2.9); scene.add(p2);
  scene.add(wire(V(26, 6.6, -2.9), V(40, 6.6, -2.9), 0.35));
  scene.add(wire(V(26, 6.6, -2.4), V(40, 6.6, -2.4), 0.35, 0.01), wire(V(26, 6.6, -3.4), V(40, 6.6, -3.4), 0.35, 0.01));
  const wireY = (x) => 6.6 - 0.35 * 4 * ((x - 26) / 14) * (1 - (x - 26) / 14);
  W.crows = [31.5, 32.1, 32.7, 33.3, 33.9, 34.5].map((x, i) => { const c = makeCharacter('crow'); c.root.position.set(x, wireY(x) + 0.012, -2.9); c.root.rotation.y = PI; scene.add(c.root); return c; });
  W.wireY = wireY;
  const owner = makeCharacter('owner'); scene.add(owner.root); cast.ownerCity = owner;
  const sci = makeCharacter('sci'); scene.add(sci.root); cast.sciCity = sci;
  W.crowBubble = new ThoughtBubble(engine, (sub) => {
    sub.background = new THREE.Color('#bfe0f5'); sub.environment = engine.roomEnv; sub.environmentIntensity = 0.6;
    sub.add(P.mesh(new THREE.PlaneGeometry(20, 20).rotateX(-PI / 2), P.std('#6fae4b')));
    const s2 = makeCharacter('sci'); s2.root.position.set(-0.35, 0, 0); s2.root.rotation.y = 0.6; sub.add(s2.root);
    const c2 = makeCharacter('crow'); c2.root.position.set(0.45, 0, 0.1); c2.root.rotation.y = -0.8; c2.root.scale.setScalar(1.6); sub.add(c2.root);
    const nt = net(); nt.position.set(0.45, 0.55, 0.1); sub.add(nt);
    const k = new THREE.DirectionalLight('#fff3dd', 2.5); k.position.set(1, 3, 2); sub.add(k, new THREE.HemisphereLight('#fff', '#6a8a4a', 0.9));
    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 30); camera.position.set(0.05, 1.05, 3.6); camera.lookAt(0.05, 0.85, 0);
    return { camera, update(lt) { s2.pose({ nodes: { arm_r: [-1.1, 0, -0.4], fore_r: [-0.6, 0, 0] }, lids: 1, look: [0.4, -0.3] }); c2.pose({ head: [0.2 * Math.sin(lt * 9), 0, 0], jaw: 0.6 * Math.abs(Math.sin(lt * 11)), jawMax: 0.7 }); nt.position.y = 0.55 - 0.1 * Math.sin(lt * 2); } };
  }, { size: 0.55 });
  scene.add(W.crowBubble.group);
  sun(scene, '#fff2da', 3.0, V(14, 30, -16), V(0, 8, -4), 22, 4096);
  const street = sun(scene, '#fff2da', 0.6, V(48, 30, -20), V(32, 0, -2.5), 12, 2048);
  scene.add(new THREE.HemisphereLight('#d6e8ff', '#7a7570', 0.6));
  return {
    scene, dof: { aperture: 0.012, maxblur: 0.01 },
    update(ctx) {
      const t = ctx.t;
      W.pigeons.forEach((p, i) => {
        p.root.position.set([-1.15, -0.58, 0.0, 0.52, 1.08][i], 15.0, -0.08 + (i % 2) * 0.06); p.root.rotation.y = PI + (i - 2) * 0.12;
        const bob = Math.max(0, Math.sin(t * 5.3 + i * 1.7)) ** 6;
        p.pose({ head: [0.25 * bob, Math.sin(t * 0.9 + i * 2) * 0.6, 0], lids: blink(t, i * 3, 2.6 + i * 0.3), jaw: 0 });
      });
      const w = (t - at('n7')) * 1.25;
      man.root.position.set(2.6 - w, 0.15, -1.55); man.root.rotation.set(0, -PI / 2, 0);
      const sw = Math.sin(t * 7.5);
      man.pose({ body: [0, 0, sw * 0.02], nodes: { arm_l: [sw * 0.4, 0, 0], arm_r: [-sw * 0.4, 0, 0] }, lids: blink(t, 2), head: [0.1, 0, 0] });
      W.crows.forEach((c, i) => { c.pose({ head: [0.35, 0.3 * Math.sin(t * 0.7 + i * 1.3), 0], lids: blink(t, i + 7, 3.1), jaw: 0 }); });
      owner.root.position.set(90, 0.15, -1.4); sci.root.position.set(92, 0.15, -0.9);
      W.crowBubble.group.visible = false;
    },
  };
}

// ------------------------------------------------------------------ beach
function beach(engine) {
  const scene = new THREE.Scene();
  const skyOpts = { top: '#2b86e3', horizon: '#d9f0fb', bottom: '#d9c9a0', sunDir: [0.3, 0.6, -0.7], sunCol: '#fff4dc', haze: 0.35 };
  scene.add(skyDome(skyOpts));
  scene.environment = skyEnvironment(engine, skyOpts); scene.environmentIntensity = 0.8;
  scene.fog = new THREE.Fog('#d6ecf6', 80, 380);
  const Hs = (x, z) => (z > 0 ? 0.35 * Math.sin(x * 0.2) * Math.sin(z * 0.3) + z * 0.05 : z * 0.12);
  const Hb = (x, z) => Math.max(-1.5, Hs(x, z) + 0.15);
  scene.add(P.hills({ size: 300, seg: 160, color: '#e6cf9c', height: Hb }));
  const S = sea(400); S.mesh.position.y = -0.02; scene.add(S.mesh); W.sea = S;
  scene.add(P.mesh(new THREE.PlaneGeometry(300, 1.6).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(1.3), transparent: true, opacity: 0.55, depthWrite: false }), { y: 0.11, z: -1.0, cast: false }));
  const um = umbrella(); um.position.set(-1.6, Hb(-1.6, 4.2) - 0.05, 4.2); um.rotation.z = 0.08; scene.add(um);
  scene.add(P.mesh(P.rbox(1.0, 0.02, 1.9, 0.01), P.phys('#ffffff', { map: P.stripeTex('#2f8fd8', '#ffffff', 10, [1, 1], true) }), { x: -0.3, y: Hb(-0.3, 4.6) + 0.02, z: 4.6, ry: 0.15, cast: false }));
  const owner = makeCharacter('owner'); scene.add(owner.root); cast.ownerBeach = owner;
  const fr = fries(); scene.add(fr); W.fries = fr;
  const fry = P.mesh(new THREE.BoxGeometry(0.011, 0.11, 0.011), P.phys('#f2c14a'), { cast: false }); scene.add(fry); W.fry = fry;
  const gull = makeCharacter('gull'); scene.add(gull.root); cast.gull = gull;
  W.dolphins = [0, 1].map(() => { const d = makeCharacter('dolphin'); scene.add(d.root); return d; });
  W.rings = [0, 1, 2, 3].map(() => { const r = ring(); scene.add(r); return r; });
  const splash = new THREE.Group();
  const drop = new THREE.SphereGeometry(0.06, 8, 6), dm = P.phys('#e8f6ff', { roughness: 0.05, transparent: true, opacity: 0.8 });
  for (let i = 0; i < 26; i++) splash.add(P.mesh(drop, dm, { cast: false }));
  scene.add(splash); W.splash = splash;
  sun(scene, '#fff3dc', 3.2, V(12, 22, -18), V(0, 0, 0), 16, 4096);
  scene.add(new THREE.HemisphereLight('#d0eaff', '#c9b48a', 0.6));
  return {
    scene, Hb, dof: { aperture: 0.012, maxblur: 0.01 }, exposure: 0.95,
    update(ctx) {
      const t = ctx.t;
      S.u.time.value = t;
      owner.root.position.set(0.25, Hb(0.25, 3.6) - 0.02, 3.6); owner.root.rotation.set(0, PI - 0.25, 0);
      owner.pose({ lids: blink(t, 3), look: [0.2, -0.3], head: [0.2, -0.2, 0], nodes: { arm_r: [-0.55, 0, -0.15], fore_r: [-1.1, 0.2, 0] } });
      const hand = world(owner, 'fore_r', [-0.012, -0.29, 0.04]);
      W.fries.position.copy(hand).add(V(0, 0.02, 0)); W.fries.rotation.set(0, 0.3, 0);
      gull.root.position.set(1.05, Hb(1.05, 2.9) - 0.01, 2.9); gull.root.rotation.set(0, -0.9, 0);
      gull.pose({ head: [0.1, 0.2 * Math.sin(t * 1.4), 0], lids: blink(t, 5, 2.8), look: [0, 0] });
      W.fry.visible = false;
      W.dolphins.forEach((d, i) => { d.root.position.set(-3 + i * 5, -3, -14 - i * 3); d.root.visible = false; d.pose({}); });
      W.rings.forEach((r) => (r.visible = false));
      W.splash.visible = false;
    },
  };
}

// ------------------------------------------------------------------ office
function office(engine) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#c9d6e0');
  scene.environment = engine.roomEnv; scene.environmentIntensity = 0.35;
  scene.add(P.mesh(new THREE.PlaneGeometry(30, 30).rotateX(-PI / 2), P.phys('#6f7a86', { roughness: 0.98, sheen: 0.6, sheenColor: new THREE.Color('#9fb0c0') }), { cast: false }));
  scene.add(P.mesh(new THREE.BoxGeometry(30, 3.2, 0.2), P.phys('#c4cfda', { roughness: 0.9 }), { y: 1.6, z: -3.2 }));
  for (let i = -4; i <= 4; i++) scene.add(P.mesh(new THREE.PlaneGeometry(1.6, 1.7), new THREE.MeshBasicMaterial({ color: new THREE.Color('#cfe4f5').multiplyScalar(1.6) }), { x: i * 2.0, y: 1.75, z: -3.09, cast: false }));
  for (let i = -3; i <= 3; i++) for (let j = 0; j < 3; j++) scene.add(P.mesh(new THREE.PlaneGeometry(1.1, 0.5).rotateX(PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(2.2) }), { x: i * 2.4, y: 3.0, z: -2 + j * 2.5, cast: false }));
  scene.add(P.mesh(new THREE.PlaneGeometry(30, 30).rotateX(PI / 2), P.std('#f2f2ee'), { y: 3.02, cast: false }));
  const cub = P.cubicleWall(2.6); cub.position.set(0, 0, -0.62); scene.add(cub);
  const cub2 = P.cubicleWall(1.8); cub2.position.set(-1.33, 0, 0.25); cub2.rotation.y = PI / 2; scene.add(cub2);
  const cub3 = P.cubicleWall(2.6, 1.45, '#8a9bb0'); cub3.position.set(3.4, 0, -1.5); scene.add(cub3);
  scene.add(P.desk());
  const perch = P.perch(); perch.position.set(-0.52, 0.775, -0.12); scene.add(perch);
  const plant = P.plant(); plant.position.set(2.2, 0, -2.6); plant.scale.setScalar(1.6); scene.add(plant);
  const parrot = makeCharacter('macaw'); parrot.root.position.set(-0.52, 1.2, -0.11); scene.add(parrot.root); cast.parrot = parrot;
  const gary = makeCharacter('gary'); scene.add(gary.root); cast.gary = gary;
  const pn = new Text3D({ size: 0.2, depth: 0.07, bevel: 0.012, color: '#ff4fa3', emissive: 0.15 });
  const pw = new Text3D({ size: 0.1, depth: 0.04, bevel: 0.007, color: '#ffffff', emissive: 0.05 }); pw.setText('WORDS');
  const pg = new THREE.Group(); pg.add(pn.group, pw.group); pw.group.position.y = -0.16; pg.position.set(-0.3, 1.95, -0.15); scene.add(pg);
  W.parrotNum = pn; W.parrotGroup = pg;
  W.memory = new ThoughtBubble(engine, (sub) => {
    sub.background = new THREE.Color('#f2c98f'); sub.environment = engine.roomEnv; sub.environmentIntensity = 0.55;
    sub.add(P.mesh(new THREE.PlaneGeometry(10, 6), P.std('#e9b57a'), { z: -1.2, y: 1.5 }));
    sub.add(P.mesh(new THREE.PlaneGeometry(10, 10).rotateX(-PI / 2), P.std('#a8754a'), { y: 0 }));
    const c = P.couch('#5b8fc1'); c.position.set(0, 0, -0.75); sub.add(c);
    const o = makeCharacter('owner'); o.root.position.set(-0.25, 0, 0.1); o.root.rotation.y = 0.35; sub.add(o.root);
    const pp = P.perch(); pp.position.set(0.75, 0, 0.0); pp.scale.setScalar(2.2); sub.add(pp);
    const pa = makeCharacter('macaw'); pa.root.position.set(0.75, 0.86, 0.0); pa.root.rotation.y = -0.6; sub.add(pa.root);
    const k = new THREE.DirectionalLight('#fff1dc', 2.4); k.position.set(1.5, 3, 2.5); sub.add(k, new THREE.HemisphereLight('#fff6e8', '#8a6040', 0.8));
    const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 30); camera.position.set(0.25, 1.45, 3.0); camera.lookAt(0.25, 1.15, 0);
    return {
      camera,
      update(lt) {
        const g = Math.sin(lt * 7.0), g2 = Math.sin(lt * 5.3 + 1);
        o.pose({ jaw: clamp01(0.5 + 0.5 * Math.sin(lt * 17) * Math.sin(lt * 5.7)), head: [0.05, 0.25 + 0.1 * g2, 0.05 * g],
          nodes: { arm_l: [-1.0 - 0.4 * g, 0, 0.3], fore_l: [-0.8 + 0.4 * g2, 0, 0], arm_r: [-0.9 + 0.4 * g2, 0, -0.35], fore_r: [-1.1, 0, 0] }, lids: 0.85, look: [0.5, 0] });
        pa.pose({ head: [0.1, -0.3, 0.25 * Math.sin(lt * 2.2)], lids: blink(lt, 2), look: [-0.6, 0] });
      },
    };
  }, { size: 0.3 });
  scene.add(W.memory.group);
  sun(scene, '#ffefd8', 2.4, V(3.5, 5, 3), V(0, 0.8, 0), 4);
  scene.add(new THREE.HemisphereLight('#e6efff', '#6e6a64', 0.5));
  return {
    scene, dof: { aperture: 0.015, maxblur: 0.01 },
    update(ctx) {
      const t = ctx.t;
      parrot.pose({ head: [0.05, 0.25 * Math.sin(t * 0.8), 0.15 * Math.sin(t * 1.9)], lids: blink(t, 5), look: [0, 0] });
      gary.root.visible = true; gary.root.position.set(1.0, 0, 0.35); gary.root.rotation.set(0, -PI / 2 + 0.25, 0);
      gary.pose({ lids: blink(t, 3), look: [-0.3, 0] });
      W.parrotNum.setText(Math.round(1000 * ease.out(ramp(t, at('n16@more'), at('n16@words') + 0.2))).toLocaleString('en-US') + (t > at('n16@words') + 0.2 ? '+' : ''));
      W.memory.group.visible = false; W.parrotGroup.visible = false;
    },
  };
}

// ------------------------------------------------------------------ courtroom
function court(engine) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#3a2a20');
  scene.environment = engine.roomEnv; scene.environmentIntensity = 0.3;
  const panel = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#7a4a2c'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#80502f' : '#714428'; c.fillRect(i * 64, 0, 64, h); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(i * 64, 0, 3, h); }
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 300, w, 8);
  });
  panel.wrapS = panel.wrapT = THREE.RepeatWrapping; panel.repeat.set(6, 1);
  const wallM = new THREE.MeshStandardMaterial({ map: panel, roughness: 0.6 });
  scene.add(P.mesh(new THREE.BoxGeometry(16, 4.5, 0.2), wallM, { y: 2.25, z: -4.2 }));
  scene.add(P.mesh(new THREE.BoxGeometry(0.2, 4.5, 12), wallM, { x: -6, y: 2.25 }), P.mesh(new THREE.BoxGeometry(0.2, 4.5, 12), wallM, { x: 6, y: 2.25 }));
  scene.add(P.mesh(new THREE.PlaneGeometry(16, 14).rotateX(-PI / 2), P.phys('#ffffff', { map: P.woodFloorTex('#5a3a26', [5, 5]), roughness: 0.5, clearcoat: 0.3 }), { cast: false }));
  const seal = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#c9a24a'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 6, 0, PI * 2); c.fill();
    c.fillStyle = '#8a6a2a'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 40, 0, PI * 2); c.fill();
    c.fillStyle = '#f3e3b0'; c.beginPath(); c.ellipse(w / 2, h / 2 + 40, 70, 58, 0, 0, PI * 2); c.fill();
    for (const [dx, dy] of [[-88, -30], [-34, -80], [34, -80], [88, -30]]) { c.beginPath(); c.ellipse(w / 2 + dx, h / 2 + dy, 30, 38, 0, 0, PI * 2); c.fill(); }
    c.font = '900 40px Helvetica'; c.textAlign = 'center'; c.fillText('ANIMAL COURT', w / 2, 92);
  });
  scene.add(P.mesh(new THREE.CircleGeometry(0.8, 48), new THREE.MeshStandardMaterial({ map: seal, roughness: 0.4, metalness: 0.3 }), { y: 3.15, z: -4.09, cast: false }));
  const wood = P.phys('#6a3e24', { roughness: 0.45, clearcoat: 0.4 });
  scene.add(P.mesh(P.rbox(3.6, 1.35, 1.0, 0.04), wood, { y: 0.675, z: -2.9 }));
  scene.add(P.mesh(P.rbox(3.8, 0.08, 1.1, 0.02), P.phys('#4e2c18', { roughness: 0.3, clearcoat: 0.6 }), { y: 1.38, z: -2.9 }));
  scene.add(P.mesh(P.rbox(1.4, 0.95, 1.0, 0.04), wood, { x: 2.7, y: 0.475, z: -1.6 }));
  scene.add(P.mesh(P.rbox(1.5, 0.06, 1.1, 0.02), P.phys('#4e2c18', { roughness: 0.3, clearcoat: 0.6 }), { x: 2.7, y: 0.98, z: -1.6 }));
  scene.add(P.mesh(P.rbox(1.2, 0.4, 0.9, 0.03), wood, { x: 2.7, y: 0.2, z: -1.75 }));
  scene.add(P.mesh(P.rbox(1.6, 0.06, 0.8, 0.02), P.phys('#7a4a2c', { roughness: 0.4, clearcoat: 0.4 }), { x: -0.2, y: 0.78, z: 0.2 }));
  for (const x of [-0.9, 0.5]) for (const z of [-0.12, 0.52]) scene.add(P.mesh(new THREE.BoxGeometry(0.06, 0.75, 0.06), wood, { x, y: 0.375, z }));
  const cake = cakePlate(); cake.position.set(-0.2, 0.82, 0.2); scene.add(cake);
  const judge = makeCharacter('judge'); judge.root.position.set(0, 0.12, -3.72); scene.add(judge.root); cast.judge = judge;
  const gv = gavel(); gv.position.set(-0.012, -0.29, 0.07); gv.rotation.set(0, 0, PI / 2); judge.nodes.fore_r.add(gv); W.gavel = gv;
  const dog = makeCharacter('dog'); dog.root.position.set(2.7, 0.4, -1.75); dog.root.rotation.y = -0.55; scene.add(dog.root); cast.dogCourt = dog;
  const key = new THREE.SpotLight('#ffe7c4', 30, 14, 0.7, 0.5, 1.5); key.position.set(1.5, 4.2, 2.5); key.target.position.set(1.2, 1.0, -2.2);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0003; scene.add(key, key.target);
  scene.add(new THREE.HemisphereLight('#ffe9d0', '#3a2414', 0.5));
  const fill = new THREE.PointLight('#ffd7a8', 2.0, 10, 2); fill.position.set(-2, 3, 1.5); scene.add(fill);
  return {
    scene, dof: { aperture: 0.015, maxblur: 0.01 },
    update(ctx) {
      const t = ctx.t;
      const tg = at('judge') - 0.45;   // two gavel strikes, matching the SFX
      const lift = clamp01(1 - Math.abs(t - (tg - 0.1)) / 0.12) + clamp01(1 - Math.abs(t - (tg + 0.18)) / 0.12);
      const m = talk('judge', t, 1.0);
      judge.pose({ lids: blink(t, 2) * 0.8, look: [0.45, -0.2], head: [0.1 - m * 0.04, 0.35, 0], jaw: m, jawMax: 0.35,
        nodes: { arm_r: [-0.95 - 0.35 * lift, 0, -0.25], fore_r: [-0.7 - 0.5 * lift, 0, 0] } });
      dog.pose({ head: [0.05, 0.25, 0], lids: blink(t, 1), look: [-0.4, 0], tail: Math.sin(t * 6) * 0.3, ears: [0.1, 0.1] });
    },
  };
}
