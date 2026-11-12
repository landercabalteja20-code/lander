// Stage, lighting presets, actors, and the 117 shots. window.renderAt(t) draws the frame at time t (seconds).
import { THREE, clamp, lerp, ease, easeOut, easeIn, easeInOut, seg, hash, noise1, rng, pop, mat, newMat, basic, box, put, cyl, sphere, canvasTex, gradientTex, Char, ALL_CHARS, makeCup, makeBalloon, makePhone, makeBadge } from './core.js';
import { buildTown, buildBedroom, buildHighway, buildUnder, buildPhotos, buildStack, makeFire, makeSplash, makeHeadlights, makeCar, assemble, calendarTex } from './sets.js';

const Q = new URLSearchParams(location.search);
const W = +(Q.get('w') || 1080), H = Math.round(W * 16 / 9);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 1500);

// ---------- lights ----------
const hemi = new THREE.HemisphereLight('#ffffff', '#444444', 1); scene.add(hemi);
const amb = new THREE.AmbientLight('#ffffff', 0.2); scene.add(amb);
const sun = new THREE.DirectionalLight('#ffffff', 2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; scene.add(sun, sun.target);
const PTS = []; for (let i = 0; i < 6; i++) { const p = new THREE.PointLight('#ffffff', 0, 0, 2); scene.add(p); PTS.push(p); }
const bgCache = new Map();
const BG = s => { const k = JSON.stringify(s); if (!bgCache.has(k)) bgCache.set(k, typeof s === 'string' ? new THREE.Color(s) : gradientTex(s)); return bgCache.get(k); };
const PRE = {
  day: { bg: [[0, '#3d9cf5'], [0.55, '#93cdfb'], [1, '#d6efff']], fog: ['#cfe7fb', 140, 560], hemi: ['#eaf5ff', '#7fb36a', 1.35], sun: ['#fff0d2', 2.7, [40, 80, 30]], amb: 0.25, exp: 1.0 },
  dusk: { bg: [[0, '#26306e'], [0.55, '#d9806a'], [1, '#ffcf9a']], fog: ['#d99a7c', 90, 460], hemi: ['#ffd2ad', '#4d5640', 0.85], sun: ['#ffae6e', 2.1, [80, 24, -30]], amb: 0.16, exp: 1.0 },
  night: { bg: [[0, '#02051a'], [0.7, '#0c1538'], [1, '#1c2752']], fog: ['#0a102c', 70, 360], hemi: ['#6f86d0', '#121624', 0.4], sun: ['#9fb6ff', 0.55, [-30, 60, 20]], amb: 0.1, exp: 1.05 },
  dark: { bg: [[0, '#000002'], [1, '#04050c']], fog: ['#010206', 30, 200], hemi: ['#33405f', '#020306', 0.12], sun: ['#7f96d6', 0.14, [-30, 60, 20]], amb: 0.035, exp: 1.0 },
  room: { bg: '#141018', fog: null, hemi: ['#fff6e6', '#a07a5a', 0.95], sun: ['#ffe0ad', 2.2, [4, 30, -50]], amb: 0.32, exp: 1.0 },
  roomNight: { bg: '#05060c', fog: null, hemi: ['#5d6fa8', '#0e0a10', 0.35], sun: ['#9fb6ff', 0.6, [4, 30, -50]], amb: 0.08, exp: 1.0 },
  highway: { bg: [[0, '#01030f'], [0.75, '#081030'], [1, '#121a3c']], fog: ['#060a1c', 60, 520], hemi: ['#6a82c8', '#0a0c14', 0.55], sun: ['#9fb6ff', 0.6, [-30, 60, 40]], amb: 0.1, exp: 1.08 },
  stairs: { bg: '#000000', fog: ['#000000', 14, 75], hemi: ['#8a9ab0', '#050505', 0.2], sun: null, amb: 0.06, exp: 1.12 },
  under: { bg: '#000000', fog: ['#1a120c', 45, 230], hemi: ['#ffd2a0', '#2a1d14', 0.95], sun: ['#ffd9a8', 0.7, [10, 60, 10]], amb: 0.16, exp: 1.1 },
  underRed: { bg: '#000000', fog: ['#260404', 40, 200], hemi: ['#ff5a48', '#1a0303', 0.85], sun: ['#ff6a58', 0.5, [10, 60, 10]], amb: 0.1, exp: 1.08 },
  photo: { bg: '#000000', fog: ['#0a0706', 40, 140], hemi: ['#ffdcb0', '#2a1d14', 0.6], sun: ['#ffe0b0', 1.25, [10, 30, 40]], amb: 0.16, exp: 1.0 },
  stack: { bg: [[0, '#04050d'], [1, '#141a30']], fog: null, hemi: ['#dfe8ff', '#3a2a20', 0.95], sun: ['#fff1d6', 1.7, [30, 60, 60]], amb: 0.22, exp: 1.0 },
  stackRed: { bg: [[0, '#0b0102'], [1, '#2a0606']], fog: null, hemi: ['#ff6a5a', '#200505', 0.8], sun: ['#ff7060', 1.2, [30, 60, 60]], amb: 0.15, exp: 1.0 },
  void: { bg: '#000000', fog: ['#000000', 40, 240], hemi: ['#57d8ff', '#000000', 0.32], sun: ['#8ae9ff', 0.8, [-20, 40, 30]], amb: 0.06, exp: 1.05 },
  black: { bg: '#000000', fog: null, hemi: ['#000', '#000', 0], sun: null, amb: 0, exp: 1 },
};
let FOCUS = new THREE.Vector3(), FOCUS_R = 50;
function applyPreset(name) {
  const p = PRE[name];
  scene.background = BG(p.bg);
  if (p.fog) { if (!scene.fog) scene.fog = new THREE.Fog('#000', 1, 2); scene.fog.color.set(p.fog[0]); scene.fog.near = p.fog[1]; scene.fog.far = p.fog[2]; } else scene.fog = null;
  hemi.color.set(p.hemi[0]); hemi.groundColor.set(p.hemi[1]); hemi.intensity = p.hemi[2];
  amb.intensity = p.amb; renderer.toneMappingExposure = p.exp;
  if (p.sun) { sun.visible = true; sun.color.set(p.sun[0]); sun.intensity = p.sun[1]; sun.userData.dir = new THREE.Vector3(...p.sun[2]).normalize(); } else sun.visible = false;
}
function updateSun() {
  if (!sun.visible) return; const d = sun.userData.dir;
  sun.target.position.copy(FOCUS); sun.position.copy(FOCUS).addScaledVector(d, 150);
  const c = sun.shadow.camera; c.left = c.bottom = -FOCUS_R; c.right = c.top = FOCUS_R; c.near = 1; c.far = 320; c.updateProjectionMatrix();
}

// ---------- sets ----------
const SETS = {
  town: { g: buildTown({ seed: 3 }), o: new THREE.Vector3(0, 0, 0) },
  bed: { g: buildBedroom(), o: new THREE.Vector3(400, 0, 0) },
  road: { g: buildHighway(), o: new THREE.Vector3(-700, 0, 0) },
  under: { g: buildUnder(), o: new THREE.Vector3(900, 0, 0) },
  photo: { g: buildPhotos(), o: new THREE.Vector3(400, 0, 600) },
  stack: { g: buildStack(), o: new THREE.Vector3(-400, 0, 700) },
};
for (const k in SETS) { SETS[k].g.position.copy(SETS[k].o); scene.add(SETS[k].g); }
const TN = SETS.town.g.userData.named, BN = SETS.bed.g.userData.named, RN = SETS.road.g.userData.named, UN = SETS.under.g.userData.named, PN = SETS.photo.g.userData.named, SN = SETS.stack.g.userData.named;
const UT = UN.town.userData.named, NT = UN.newTown.userData.named;
RN.car = makeCar('#e8473f'); RN.car.scale.setScalar(1.25); makeHeadlights(RN.car); RN.car.userData.headMat.emissiveIntensity = 2.5; SETS.road.g.add(RN.car);
let O = new THREE.Vector3();
function use(name, preset) { for (const k in SETS) SETS[k].g.visible = (k === name); O = name ? SETS[name].o : new THREE.Vector3(); applyPreset(preset); }
const V3 = (x, y, z) => new THREE.Vector3(O.x + x, O.y + y, O.z + z);
function focus(x, y, z, r = 50) { FOCUS.copy(V3(x, y, z)); FOCUS_R = r; }

// ---------- camera ----------
let U = 0, SHAKE = 0, TT = 0;
function cam(p0, p1, l0, l1, fov = 50, e = easeInOut, k = null) {
  const q = k ?? e(U);
  camera.position.set(O.x + lerp(p0[0], p1[0], q), O.y + lerp(p0[1], p1[1], q), O.z + lerp(p0[2], p1[2], q));
  const lx = O.x + lerp(l0[0], l1[0], q), ly = O.y + lerp(l0[1], l1[1], q), lz = O.z + lerp(l0[2], l1[2], q);
  const drift = 0.06; camera.position.x += (noise1(TT * 0.6, 1) - 0.5) * drift; camera.position.y += (noise1(TT * 0.6, 2) - 0.5) * drift;
  if (SHAKE) { camera.position.x += (noise1(TT * 18, 4) - 0.5) * SHAKE; camera.position.y += (noise1(TT * 18, 5) - 0.5) * SHAKE; }
  camera.up.set(0, 1, 0); camera.lookAt(lx, ly, lz); camera.fov = fov; camera.updateProjectionMatrix();
}
function camW(pos, look, fov = 50) { camera.position.copy(pos); camera.up.set(0, 1, 0); camera.lookAt(look); camera.fov = fov; camera.updateProjectionMatrix(); }

// ---------- actors ----------
const clara = new Char({ skin: '#f1c6a0', hair: 'long', hairColor: '#8a3b1e', shirt: '#f2c230', inner: '#ffffff', sleeve: '#f2c230', pants: '#3d5a9e', shoes: '#f5f5f5', female: true });
const clara2 = new Char({ ...clara.o });
const claras = [0, 1, 2, 3, 4].map(() => new Char({ ...clara.o }));
const woman = new Char({ skin: '#e8b48a', hair: 'bun', hairColor: '#5a3a22', shirt: '#d9b98a', inner: '#7a8fb0', pants: '#4a3b30', shoes: '#2b2b2b', female: true, belt: '#a8865a' });
const womanU = new Char({ skin: '#d6a27a', hair: 'messybun', hairColor: '#4a3020', shirt: '#7d6d58', inner: '#56607a', pants: '#3a3029', shoes: '#222222', female: true, scar: true, circles: true });
const boy = new Char({ scale: 0.72, skin: '#8d5a3b', hair: 'short', hairColor: '#1d1410', hat: { type: 'cap', color: '#2e6fd8' }, shirt: '#4caf50', pants: '#d8c08a', shoes: '#f2f2f2' });
const oldMan = new Char({ skin: '#f0c8a8', hair: 'old', hairColor: '#e8e8e8', shirt: '#8b5e3c', inner: '#e9e2d0', pants: '#6f7480', shoes: '#3a2a20', glasses: true });
const R0 = rng(123);
const SK = ['#f1c6a0', '#e0ac80', '#c68642', '#8d5a3b', '#f5d0b5', '#d9a37a'], SH = ['#e34968', '#2a78d6', '#14a08c', '#8c64db', '#eda100', '#ffffff', '#f28c38', '#4caf50'], PA = ['#3d5a9e', '#2b2b33', '#6f7480', '#4a3b30', '#1f4f7a'];
const HS = ['short', 'spiky', 'bun', 'long', 'short', 'spiky'], HC = ['#2b1d14', '#5a3a22', '#1d1410', '#d9b35a', '#3a2418'];
const pick = a => a[Math.floor(R0() * a.length)];
const extras = Array.from({ length: 14 }, () => { const h = pick(HS); return new Char({ skin: pick(SK), hair: h, hairColor: pick(HC), shirt: pick(SH), pants: pick(PA), female: h === 'long' || h === 'bun' }); });
const dim = c => { const a = new THREE.Color(c); a.lerp(new THREE.Color('#3a332c'), 0.45); return '#' + a.getHexString(); };
const extrasU = Array.from({ length: 22 }, () => { const h = pick(HS); return new Char({ skin: pick(SK), hair: h, hairColor: pick(HC), shirt: dim(pick(SH)), pants: dim(pick(PA)), shoes: '#2a2622', female: h === 'long' || h === 'bun', circles: R0() > 0.4 }); });
const sleeper = extras[3];
for (const c of ALL_CHARS) scene.add(c.root);

// ---------- props ----------
const PROPS = [];
const prop = o => { PROPS.push(o); scene.add(o); o.visible = false; return o; };
const cupA = makeCup(), cupB = prop(makeCup());
const balloonHand = makeBalloon(), balloonFree = prop(makeBalloon());
const splash = prop(makeSplash());
const fire = prop(makeFire(16, 12, 5)); const fireSmall = prop(makeFire(8, 5, 8));
const phone = makePhone(true);
const smoke = prop(new THREE.Group()); for (let i = 0; i < 8; i++) { const s = sphere(0.9, new THREE.MeshStandardMaterial({ color: '#77777d', transparent: true, opacity: 0.5, depthWrite: false }), 10, 8); s.castShadow = false; smoke.add(s); }
const dust = prop(new THREE.Group()); { const R = rng(66); for (let i = 0; i < 90; i++) { const d = box(0.3 + R() * 0.5, 0.3 + R() * 0.5, 0.3 + R() * 0.5, mat('#5a4a3c'), 0.05, false); d.userData = { x: (R() - 0.5) * 50, z: (R() - 0.5) * 50, ph: R(), sp: 0.5 + R() }; dust.add(d); } }
const thread = prop(new THREE.Group());
const glowM = basic('#ffe680', { transparent: true, opacity: 0.9, add: true });
const BADGES = new Map();
function badge(text, style, x, y, z, T, s = 1) {
  const k = text + style; if (!BADGES.has(k)) { const b = makeBadge(text, style); scene.add(b); PROPS.push(b); BADGES.set(k, b); }
  const b = BADGES.get(k); const p = T < 0 ? 0 : pop(T, 0.22); b.visible = T >= 0; b.position.copy(V3(x, y, z)); b.scale.set(4.2 * s * p, 1.05 * s * p, 1); return b;
}
const interior = prop(new THREE.Group()); { // car interior close-up rig
  interior.add(put(box(7, 1.4, 2, mat('#1b1c22'), 0.3), 0, 2.6, 2.2));
  const dash = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.6), basic('#5fd0ff')); dash.position.set(-0.6, 3.31, 1.6); dash.rotation.x = -Math.PI / 2.4; interior.add(dash);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.16, 8, 24), mat('#222228')); wheel.position.set(0, 3.15, 1.9); wheel.rotation.x = -1.0; interior.add(wheel);
  for (const s of [-1, 1]) { const p = box(0.35, 4.5, 0.35, mat('#a8251f'), 0.08); p.position.set(s * 3.3, 5.2, 2.6); p.rotation.x = -0.35; interior.add(p); }
  interior.add(put(box(7.2, 0.4, 3.2, mat('#a8251f'), 0.1), 0, 7.2, 0.6));
  const dl = new THREE.PointLight('#6fd0ff', 6, 8, 2); dl.position.set(0, 3.6, 1.2); interior.add(dl);
}
const doorway = prop(new THREE.Group()); { doorway.add(put(box(10, 12, 1.5, mat('#3a332c', { rough: 1 }), 0.1), -7, 6, 0)); doorway.add(put(box(10, 12, 1.5, mat('#3a332c', { rough: 1 }), 0.1), 7, 6, 0)); doorway.add(put(box(24, 3, 1.5, mat('#3a332c', { rough: 1 }), 0.1), 0, 10.5, 0)); const lf = box(4.6, 8.6, 0.4, mat('#5b6470', { metal: 0.4 }), 0.05); lf.position.set(-2.2, 4.3, -2.4); lf.rotation.y = 1.4; doorway.add(lf); }
const miniClaras = prop(new THREE.Group());
for (let i = 1; i < 14; i++) { const m = new THREE.Group(); m.add(put(box(0.7, 0.8, 0.45, mat('#f2c230'), 0.08), 0, 1.1, 0)); m.add(put(box(0.6, 0.7, 0.4, mat('#3d5a9e'), 0.08), 0, 0.35, 0)); m.add(put(box(0.6, 0.6, 0.6, mat('#f1c6a0'), 0.12), 0, 1.85, 0)); m.add(put(box(0.66, 0.25, 0.66, mat('#8a3b1e'), 0.08), 0, 2.2, 0)); const g = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 10), basic('#ffe680', { transparent: true, opacity: 0.18, add: true })); g.position.y = 1.2; m.add(g); m.position.set(-8 + (i % 3) * 7, -i * SN.GAP, 9); miniClaras.add(m); }
SETS.stack.g.add(miniClaras);

// ---------- per-frame reset ----------
function townDefaults(town, day = true) {
  const N = town.userData.named;
  N.bus.position.set(3.2, 0, 300); N.bus.rotation.set(0, Math.PI, 0); N.bus.visible = true;
  N.car.position.set(-4.4, 0, 30); N.car.rotation.set(0, Math.PI, 0); N.car.scale.setScalar(1);
  N.car2.position.set(4.4, 0, -30); N.car2.rotation.set(0, 0, 0);
  N.clock.userData.set(7, 0, 0); N.clock.userData.faceMat.emissiveIntensity = 0;
  for (const m of town.userData.windows) m.emissiveIntensity = 0;
  for (const m of town.userData.lamps) m.emissiveIntensity = 0;
}
function townNight(town, win = 1.3, lamp = 1.8) { for (const m of town.userData.windows) m.emissiveIntensity = win; for (const m of town.userData.lamps) m.emissiveIntensity = lamp; town.userData.named.clock.userData.faceMat.emissiveIntensity = 0.55; }
function resetAll() {
  for (const c of ALL_CHARS) c.reset();
  for (const p of PROPS) p.visible = false;
  for (const p of PTS) p.intensity = 0;
  SHAKE = 0; camera.up.set(0, 1, 0);
  townDefaults(SETS.town.g); townDefaults(UN.town); townDefaults(UN.newTown);
  UT.bus.position.set(9, -1.3, 22); UT.bus.rotation.set(0.05, 0.5, 0.12); UT.clock.userData.set(11, 57, 0);
  for (const [i, m] of UN.town.userData.windows.entries()) m.emissiveIntensity = i % 3 ? 0.55 : 0.05;
  assemble(UN.newTown, 1);
  BN.notes.visible = false; BN.notebook.material.map = notebookTex(24); BN.blanket.position.y = 2.6; BN.blanket.scale.y = 1; BN.winMesh.material.map = BN.winMorning;
  RN.lid.rotation.z = 0; RN.leaf.rotation.y = 0; RN.doorGlow.visible = false; RN.car.visible = false; RN.car.userData.beams.children.forEach(c => { if (c.isMesh) c.visible = true; });
  for (const st of RN.steps) st.visible = true; for (const r of RN.rails) r.visible = true; UN.crackGlow.visible = false; RN.shaftWall.visible = true;
  UN.beamPivot.rotation.y = 0; UN.beam.material.opacity = 0; UN.beaconMat.color.set('#5a1010');
  for (const l of UN.lanterns) l.m.color.set('#ffc070');
  SN.layers.forEach((L, i) => { L.position.y = -i * SN.GAP; L.visible = true; }); SN.top.visible = false; miniClaras.visible = false;
  phone.removeFromParent(); cupA.removeFromParent(); balloonHand.removeFromParent();
}
const nbCache = new Map(); function notebookTex(n) { if (!nbCache.has(n)) nbCache.set(n, BN.noteTex(n)); return nbCache.get(n); }

// ---------- helpers for shots ----------
const pl = (c, x, y, z, ry = 0) => c.place(O.x + x, O.y + y, O.z + z, ry);
function walkers(n, T, o = {}) {
  const seed = o.seed ?? 0, expr = o.expr ?? 'smile';
  for (let i = 0; i < n; i++) {
    if (o.skip && o.skip.includes(i)) continue;
    const e = extras[i % extras.length]; const side = i % 2 ? 1 : -1, dir = (i % 4 < 2) ? 1 : -1, sp = 3.2 + hash(i + seed) * 1.2;
    const z = 120 - ((hash(i * 7 + seed) * 170 + dir * T * sp + 1000) % 170);
    if (o.avoid && Math.abs(side * 9 - o.avoid.x) < o.avoid.r && Math.abs(z - o.avoid.z) < o.avoid.r) continue;
    pl(e, side * (8.2 + (i % 3) * 0.9), 0.32, z, dir > 0 ? 0 : Math.PI); e.walk(T * sp * 1.7 + i, 1); e.expr(expr);
  }
}
function busAt(N, x, z, ry) { N.bus.position.set(x, 0, z); N.bus.rotation.set(0, ry, 0); }
function pt(i, x, y, z, color, intensity, dist = 0) { const p = PTS[i]; p.position.copy(V3(x, y, z)); p.color.set(color); p.intensity = intensity; p.distance = dist; }
function wt(word, n = 1) { // local time of the n-th caption word matching `word` in the current line
  const ws = LINEWORDS[CUR] || []; let k = 0; for (const w of ws) { if (w.w.toLowerCase().replace(/[^a-z0-9:']/g, '').startsWith(word.toLowerCase())) { k++; if (k === n) return w.t - SHOTT[CUR].start; } } return 0;
}
function underPeople(T, expr = 'tired', n = 22, shout = false) {
  const spots = [[-12, -2, 1.57], [-11.5, 4, 1.4], [-12.5, 9, 1.7], [-12, 26, 1.5], [-11.5, 30, 1.6], [-12.4, -28, 1.5], [-11.6, -36, 1.65], [-12, -40, 1.45], [12, -18, -1.57], [11.5, -24, -1.4], [12.3, -27, -1.7], [12, 22, -1.6], [11.4, 28, -1.5], [12.2, 31, -1.45], [11.8, -40, -1.6], [12.4, -47, -1.5], [-11.8, -48, 1.5], [-12.3, 46, 1.6], [12.1, 40, -1.55], [-11.6, 18, 1.5], [11.6, 6, -1.5], [-12.2, 36, 1.55]];
  for (let i = 0; i < n; i++) { const c = extrasU[i], s = spots[i]; pl(c, s[0], 0, s[1], s[2]); if (shout) { c.expr('shout', true); c.arms(-2.6 - 0.3 * Math.sin(T * 9 + i), -0.3, -2.6 - 0.3 * Math.sin(T * 9 + i + 1), 0.3); c.look(-0.25, 0); } else { c.idle(T + i, 1); c.expr(i % 3 ? expr : 'sad'); if (i % 4 === 0) c.sit(); } }
}
function hideSteps() { RN.steps.forEach((st, i) => { if (i >= 98) st.visible = false; }); RN.rails.forEach((r, i) => { if (i >= 98) r.visible = false; }); }
function noBeams() { RN.car.userData.beams.children.forEach(c => { if (c.isMesh) c.visible = false; }); }
function lanternLights(red = false) { const c = red ? '#ff2a1a' : '#ffaa55'; for (const l of UN.lanterns) l.m.color.set(red ? '#ff3020' : '#ffc070'); pt(0, -10, 6, -6, c, 220); pt(1, 10, 6, 18, c, 160); pt(2, -6, 6, -70, c, 200); pt(3, 8, 6, -40, c, 160); }
function stackGlow(red) { pt(0, 0, 10, 40, red ? '#ff4030' : '#bcd6ff', red ? 900 : 500); }

// ---------- shots ----------
const S = [];
// 0 In this town, everyone wakes up on the same day.
S.push((u, T) => { use('town', 'day'); walkers(14, T); busAt(TN, 3.2, 40 - T * 6, Math.PI); focus(0, 0, -20, 90); cam([0, 92, 170], [0, 55, 75], [0, 6, -10], [0, 12, -60], 50, easeOut); });
// 1 Every morning at exactly 7:06, a yellow bus passes the church.
S.push((u, T) => { use('town', 'day'); walkers(10, T, { seed: 3 }); TN.clock.userData.set(7, 6, T * 4); busAt(TN, -36 + u * 66, -72, Math.PI / 2); focus(0, 0, -75, 45); cam([-20, 4.2, -61], [-18, 4.6, -62], [2, 15, -86], [3, 16, -86], 54); badge('7:06 AM', 'time', 10, 30.5, -82, T - 0.3, 1.5); });
// 2 At 8:15, a woman drops her coffee outside the bakery.
S.push((u, T, D) => { use('town', 'day'); walkers(8, T, { seed: 7 }); const td = wt('drops') + 0.15; const wz = lerp(2, -9.5, clamp(T / Math.max(0.5, td))); pl(woman, -9.6, 0.32, wz, Math.PI);
  if (T < td) { woman.walk(T * 6, 1).expr('smile'); woman.hold(cupA); woman.armR.rotation.x = -0.8; } else { woman.expr('shock').arms(-0.6, -0.3, -1.4, 0.4); woman.look(0.35, 0); const k = clamp((T - td) / 0.32); cupB.visible = true; cupB.position.copy(V3(-11.1, lerp(2.9, 0.75, k * k), wz - 0.8)); cupB.rotation.z = k * 1.6; if (k >= 1) { cupB.rotation.z = Math.PI / 2; cupB.position.y = 0.6; splash.visible = true; splash.position.copy(V3(-11.1, 0, wz - 1.6)); splash.userData.update(clamp((T - td - 0.32) / 0.8)); } }
  focus(-10, 0, -10, 30); cam([-0.5, 5, -19.5], [-1.5, 4.8, -17.5], [-10, 3.6, -9], [-10.5, 3.2, -10.5], 46); badge('8:15 AM', 'time', -11.5, 8.6, -12, T - 0.2, 1.3); });
// 3 And at 4:30, a little boy loses his red balloon.
S.push((u, T) => { use('town', 'day'); walkers(6, T, { seed: 9 }); const tr = wt('loses') + 0.1; pl(boy, 13, 0.06, 2, -1.1); balloonFree.visible = true;
  if (T < tr) { boy.armR.rotation.x = -2.5; boy.expr('happy'); const h = boy.handR.getWorldPosition(new THREE.Vector3()); balloonFree.position.copy(h); balloonFree.rotation.z = Math.sin(T * 2) * 0.08; } else { const k = T - tr; boy.expr(k < 0.5 ? 'shock' : 'sad').arms(0, -0.2, -3.0, 0.2); boy.look(-0.5, 0); const h0 = V3(12.4, 4.2, 2.3); balloonFree.position.copy(h0).add(new THREE.Vector3(k * 0.8, k * 3.2 + k * k * 0.6, -k * 0.5)); balloonFree.rotation.z = Math.sin(k * 2) * 0.2; }
  focus(13, 0, 2, 25); cam([3.5, 2.2, 11], [4.5, 2.6, 10], [12.5, 4.5, 2], [12.5, 6.5 + u * 5, 2], 50); badge('4:30 PM', 'time', 13.5, 13.5 + u * 3, -2, T - 0.2, 1.1); });
// 4 Nothing unusual ever happens here.
S.push((u, T) => { use('town', 'day'); walkers(14, T, { seed: 11 }); TN.car2.position.set(4.4, 0, 30 - T * 7); TN.car2.rotation.y = Math.PI; focus(0, 0, 10, 60); cam([2, 7, 62], [1, 7, 54], [0, 7, -20], [0, 7, -28], 50); });
// 5 Except that tomorrow never comes.
S.push((u, T) => { use('town', 'dusk'); townNight(SETS.town.g, 0.5, 0.6); TN.clock.userData.set(11, 50, T * 6); focus(0, 0, -80, 50); cam([0, 17, -30], [0, 22, -56], [0, 24, -82], [0, 24.5, -82], 40); });
// 6 Every night, at exactly 11:59, the town's clock stops.
S.push((u, T) => { use('town', 'night'); townNight(SETS.town.g); const ts = wt('stops') + 0.1; const s = T < ts ? 40 + T : 40 + ts; TN.clock.userData.set(11, 59, Math.floor(s) + (T < ts ? 0 : 0)); focus(0, 0, -82, 30); cam([0, 24.5, -58], [0, 24.5, -63], [0, 24.5, -82.4], [0, 24.5, -82.4], 34); badge('11:59 PM', 'time', 0, 29.8, -78, T - 0.3, 1.2); });
// 7 The lights go out.
S.push((u, T) => { use('town', u > 0.6 ? 'dark' : 'night'); const bl = SETS.town.g.userData.buildings; bl.forEach((b, i) => { const off = 0.15 + (1 - clamp((b.position.z + 80) / 200)) * 0.0 + (i % 7) * 0.09; b.userData.winMat.emissiveIntensity = T < off ? 1.3 : 0; }); SETS.town.g.userData.lamps.forEach((m, i) => m.emissiveIntensity = T < 0.25 + (i % 5) * 0.08 ? 1.8 : 0); TN.clock.userData.set(11, 59, 52); focus(0, 0, 0, 70); cam([0, 9, 56], [0, 9, 52], [0, 8, -20], [0, 8, -24], 52); });
// 8 And when everyone opens their eyes, it's Tuesday again.
S.push((u, T) => { use('bed', 'room'); const to = wt('opens'); BN.blanket.position.y = 3.35; BN.blanket.scale.y = 1.3; pl(sleeper, -5.5, 3.0, -1.5); sleeper.root.rotation.x = -Math.PI / 2; sleeper.expr(T < to + 0.1 ? 'sleep' : (T < to + 0.5 ? 'blank' : 'smile'));
  focus(-5.5, 0, -2, 20); cam([-5.5, 11.5, -6.4], [-5.5, 10, -6.4], [-5.5, 3, -6.45], [-5.5, 3, -6.45], 40); camera.up.set(0, 0, -1); camera.lookAt(V3(-5.5, 3, -6.45)); badge('TUESDAY', 'gold', -5.5, 4.4, -8.9, T - wt('tuesday'), 0.9); });
// 9 For most people, this is perfectly normal.
S.push((u, T) => { use('town', 'day'); walkers(14, T, { seed: 21, avoid: { x: -9, z: 4, r: 6 } }); const wz = 6 - T * 2.4; pl(woman, -9.2, 0.32, wz, Math.PI).walk(T * 6).expr('smile'); woman.hold(cupA); woman.armR.rotation.x = -0.8; busAt(TN, 3.2, -14 - T * 9, Math.PI); focus(-4, 0, 0, 40); cam([3, 5.6, 16], [1.5, 5.6, 13], [-6, 4, 0], [-7, 4, -2], 52); });
// 10 Because nobody remembers yesterday.
S.push((u, T, D, LD) => { use('town', 'day'); walkers(8, T, { seed: 31, skip: [1, 4], avoid: { x: -9, z: 4.5, r: 5 } }); const a = extras[1], b = extras[4]; pl(a, -9.7, 0.32, 4.2, 0.7).idle(T).talk('smile', T, T < LD * 0.5); pl(b, -7.1, 0.32, 4.6, -0.6).idle(T + 1).talk('happy', T, T >= LD * 0.5 && T < LD); a.armR.rotation.x = -0.5 - 0.2 * Math.sin(T * 5);
  focus(-8, 0, 4, 20); cam([-5.2, 5.2, 13.5], [-5.6, 5.2, 12.5], [-8.4, 4.5, 4.4], [-8.4, 4.6, 4.4], 44); });
// 11 Nobody, except a 17-year-old girl named Clara.
S.push((u, T) => { use('town', 'day'); walkers(14, T, { seed: 41 }); pl(clara, 0, 0, 8, 0).idle(T).expr(T < wt('clara') ? 'worried' : 'determined'); focus(0, 0, 8, 30); cam([0, 4.8, 26], [0, 5.2, 17.5], [0, 4.6, 8], [0, 5.2, 8], 42, easeOut); badge('CLARA, 17', 'loop', 0, 8.3, 8, T - wt('clara'), 0.85); });
// 12 At first, Clara thinks she's dreaming.
S.push((u, T) => { use('bed', 'room'); BN.blanket.position.y = 3.0; pl(clara, -5.5, 2.0, -3.6, 0).sit(); clara.expr(T % 1.6 < 0.9 ? 'confused' : 'sleep'); clara.armR.rotation.set(-2.4, 0, 0.5 + 0.15 * Math.sin(T * 8)); clara.look(0.1, 0.2 * Math.sin(T * 1.5));
  focus(-5.5, 0, -2, 20); cam([1.5, 6.2, 7], [0.5, 6, 5], [-5.5, 5.2, -3.4], [-5.6, 5.4, -3.6], 44); });
// 13 She tries changing things.
S.push((u, T) => { use('town', 'day'); const z = 22 - T * 4.5; walkers(10, T, { seed: 51, avoid: { x: -9, z: z - 4, r: 7 } }); pl(clara, -9.2, 0.32, z, Math.PI).walk(T * 7, 1.1).expr('determined'); focus(-9, 0, z, 25); cam([-7.6, 5, z - 8.5], [-7.8, 5, z - 8], [-9.2, 4.3, z], [-9.2, 4.3, z], 46); });
// 14 On her 8th loop, she stops the woman from spilling her coffee.
S.push((u, T) => { use('town', 'day'); walkers(6, T, { seed: 61, avoid: { x: -9, z: -12, r: 8 } }); const td = wt('stops'); pl(woman, -10.4, 0.32, -10.2, Math.PI / 2).idle(T); pl(clara, -10.0, 0.32, -14.0, Math.PI / 2 - 0.35).idle(T);
  const from = V3(-10.3, 2.4, -11.7);
  if (T < td) { woman.hold(cupA); woman.armR.rotation.x = -0.9; woman.expr('smile'); clara.expr('determined'); }
  else { const k = clamp((T - td) / 0.28); woman.expr(k < 1 ? 'shock' : 'happy').arms(0, 0, -0.5, 0.3); clara.expr(k < 1 ? 'determined' : 'happy'); clara.arms(0, 0, -1.3 * ease(k), -0.5 * ease(k)); cupB.visible = true; const hand = clara.handR.getWorldPosition(new THREE.Vector3()); const fall = from.clone(); fall.y -= 0.9 * k; cupB.position.lerpVectors(fall, hand.add(new THREE.Vector3(0, 0.25, 0)), ease(k)); cupB.rotation.z = 0.5 * (1 - k); }
  focus(-10, 0, -12, 25); cam([-1, 4.8, -11.2], [-2, 4.7, -11.6], [-10, 3.8, -12], [-10, 3.9, -12], 48); badge('LOOP 8', 'loop', -10.0, 8.3, -14.0, T - 0.15, 0.9); });
// 15 On her 15th, she prevents a car accident.
S.push((u, T) => { use('town', 'day'); walkers(6, T, { seed: 71, avoid: { x: -9, z: 9, r: 7 } }); const tg = wt('prevents'); const cz = 70 - T * 26; TN.car.position.set(-3.2, 0, cz); TN.car.rotation.y = Math.PI;
  const ox = T < tg ? -7 + T * 1.1 : lerp(-7 + tg * 1.1, -8.6, clamp((T - tg) / 0.3)); pl(oldMan, ox, ox < -6.4 ? 0.32 : 0, 8, Math.PI / 2).walk(T < tg ? T * 5 : 0, 0.6).expr(T < tg + 0.4 ? 'neutral' : 'shock');
  pl(clara, -9.8, 0.32, 9.8, Math.PI / 2 + 0.5).expr('determined'); clara.arms(0, 0, T < tg ? -0.3 : -1.5, 0.3);
  focus(-6, 0, 8, 30); cam([-18, 5.5, 23], [-17, 5.5, 22], [-5, 3.2, 6], [-5, 3.2, 5], 52); badge('LOOP 15', 'loop', -9.8, 8.4, 9.8, T - 0.15, 0.95); });
// 16 On her 23rd, she sets fire to an abandoned house.
S.push((u, T) => { use('town', 'dusk'); townNight(SETS.town.g, 0.4, 0.5); fire.visible = true; fire.position.copy(V3(46, 0, 84.5)); fire.scale.setScalar(0.5 + 0.7 * ease(clamp(T / 1.6))); fire.userData.update(TT); pl(clara, 39, 0, 95.5, 2.5).idle(T).expr('determined');
  focus(44, 0, 88, 30); cam([28, 5.2, 106], [29, 5.6, 104], [44, 6.5, 86], [44, 7, 86], 52); badge('LOOP 23', 'loop', 39, 8.4, 95.5, T - 0.15, 0.95); });
// 17 But whatever she does, the next morning, everything returns to normal.
S.push((u, T) => { use('town', 'day'); walkers(14, T, { seed: 81 }); busAt(TN, 3.2, 30 - T * 9, Math.PI); TN.clock.userData.set(7, 6, T * 4); focus(0, 0, -10, 80); cam([-46, 60, 70], [-34, 46, 50], [0, 6, -20], [0, 8, -30], 52); });
// 18 The coffee spills.
S.push((u, T) => { use('town', 'day'); const td = 0.25; pl(woman, -9.6, 0.32, -9.5, Math.PI); if (T < td) { woman.hold(cupA); woman.armR.rotation.x = -0.8; woman.expr('smile'); } else { woman.expr('shock').arms(-0.6, -0.3, -1.4, 0.4); woman.look(0.35, 0); const k = clamp((T - td) / 0.3); cupB.visible = true; cupB.position.copy(V3(-11.1, lerp(2.9, 0.75, k * k), -10.3)); cupB.rotation.z = k * 1.6; if (k >= 1) { cupB.rotation.z = Math.PI / 2; cupB.position.y = 0.6; splash.visible = true; splash.position.copy(V3(-11.1, 0, -11.1)); splash.userData.update(clamp((T - td - 0.3) / 0.7)); } }
  focus(-10, 0, -10, 20); cam([-4.0, 2.6, -15.5], [-4.4, 2.6, -15], [-10.2, 2.0, -10.4], [-10.3, 1.9, -10.6], 50); });
// 19 The accident happens.
S.push((u, T) => { use('town', 'day'); walkers(4, T, { seed: 91 }); const tc = 0.45; const cz = T < tc ? lerp(26, 1.8, T / tc) : 1.8; const cx = T < tc ? lerp(-3.2, -5.6, T / tc) : -5.6; TN.car.position.set(cx, 0, cz); TN.car.rotation.y = Math.PI + (T < tc ? 0.15 : 0.32); TN.car.rotation.z = T > tc ? Math.sin((T - tc) * 30) * 0.03 * Math.max(0, 1 - (T - tc) * 2) : 0;
  if (T > tc) { smoke.visible = true; smoke.position.copy(V3(-5.8, 2.6, 0)); smoke.children.forEach((s, i) => { const p = ((T - tc) * 0.6 + i / 8) % 1; s.position.set(Math.sin(i * 2) * 0.8, p * 5, Math.cos(i * 3) * 0.6); s.scale.setScalar(0.5 + p * 1.5); s.material.opacity = 0.55 * (1 - p); }); SHAKE = Math.max(0, 0.5 - (T - tc) * 1.2); }
  pl(oldMan, -9.6, 0.32, 13, Math.PI * 0.85).idle(T).expr(T > tc ? 'shock' : 'neutral'); focus(-5, 0, 5, 30); cam([7, 3.8, 15], [6, 3.8, 14], [-5, 2, 2], [-5.5, 2, 1.5], 50); });
// 20 The house is standing again.
S.push((u, T) => { use('town', 'day'); pl(clara, 40, 0, 96.5, 2.6).idle(T).expr('shock'); focus(44, 0, 88, 30); cam([25, 6.2, 110], [26, 6.2, 108.5], [44, 6.5, 84], [44, 6.8, 84], 52); });
// 21 Even the people who died are alive.
S.push((u, T) => { use('town', 'day'); walkers(10, T, { seed: 101, avoid: { x: -9, z: 10, r: 10 } }); const z = 15 - T * 1.8; pl(oldMan, -9.0, 0.32, z, Math.PI).walk(T * 5, 0.7).expr('happy'); oldMan.armR.rotation.set(-2.6 + 0.3 * Math.sin(T * 9), 0, 0.3);
  focus(-8, 0, z, 25); cam([-4.6, 5.0, z - 9.5], [-4.8, 5.0, z - 9.0], [-9.0, 4.5, z], [-9.0, 4.5, z], 46); });
// 22 Clara starts keeping a record of every repetition.
S.push((u, T) => { use('bed', 'room'); BN.notebook.material.map = notebookTex(20 + Math.floor(u * 4.99)); BN.pencil.position.copy(V3(7.6 + 0.6 * Math.sin(T * 7), 4.0, 2.4 + 0.4 * Math.sin(T * 3.1))); focus(8, 0, 2, 15); cam([8.6, 9.6, 4.6], [8.4, 8.6, 4.0], [8, 3.8, 2.5], [8, 3.8, 2.5], 38); });
// 23 By the time she reaches her 99th loop, she's convinced there's only one way out.
S.push((u, T) => { use('bed', 'room'); BN.notes.visible = true; BN.notebook.material.map = notebookTex(99); const turn = clamp((T - wt('convinced')) / 0.5); pl(clara, 4.5, 0, 1.5, lerp(-Math.PI / 2, Math.PI * 0.12, ease(turn))).idle(T).expr(turn > 0.5 ? 'determined' : 'worried');
  focus(5, 0, 1, 20); cam([-4, 6, 10], [-2.5, 5.8, 8.5], [5, 5, 0.5], [5, 5, 0.5], 46); badge('LOOP 99', 'loop', 4.5, 8.8, 1.5, T - 0.2, 0.95); });
// 24 She has to leave town before midnight.
S.push((u, T) => { use('bed', 'roomNight'); BN.winMesh.material.map = BN.winNight; BN.notes.visible = true; pl(clara, 4, 0, -6.6, Math.PI).idle(T); focus(4, 0, -6, 15); cam([5.5, 6.5, 3.5], [5, 6.8, 1.5], [4, 8, -9.6], [4, 8.4, -9.6], 46); pt(0, 4, 9, -8, '#9fb6ff', 30); badge('BEFORE 12:00', 'alert', 4, 12.6, -9.2, T - 0.4, 0.9); });
// 25 At 10:47 that evening, Clara steals a car.
S.push((u, T) => { use('town', 'night'); townNight(SETS.town.g); TN.clock.userData.set(10, 47, T * 4); const tin = 0.55 * 3.2; const on = T > tin + 0.2; TN.car.position.set(-4.4, 0, 20 - (T > tin + 0.6 ? (T - tin - 0.6) ** 2 * 3 : 0)); TN.car.rotation.y = Math.PI; TN.car.userData.headMat.emissiveIntensity = on ? 2.5 : 0.1;
  if (T < tin) { const k = T / tin; pl(clara, lerp(-10, -6.6, k), k < 0.6 ? 0.32 : 0, lerp(26, 20.5, k), Math.PI - 0.6).walk(T * 8, 1.2).expr('determined'); }
  if (on) pt(0, -4.4, 2, 12, '#fff1c8', 120);
  focus(-4, 0, 18, 30); cam([8, 4.5, 34], [7, 4.5, 32], [-4.4, 2.6, 20], [-4.4, 2.6, 19], 48); badge('10:47 PM', 'time', -4.4, 7.4, 18, T - 0.3, 1.0); });
// 26 She drives past the last houses, through the fields, and toward the highway.
S.push((u, T) => { use('road', 'highway'); const car = RN.car; car.visible = true; car.rotation.set(0, Math.PI, 0); const z = 70 - T * 30; car.position.set(-3.2, 0, z); car.rotation.z = Math.sin(T * 13) * 0.004;
  focus(-3, 0, z, 30); cam([12, 5.5, z + 14], [12, 5.5, z + 14], [-3.2, 1.8, z - 6], [-3.2, 1.8, z - 6], 46, easeInOut, 0); });
// 27 But something strange happens.
S.push((u, T) => { use('road', 'highway'); interior.visible = true; interior.position.copy(V3(-3, 0, -200)); pl(clara, -3, 0.9, -200 - 0.3, 0).sit(); clara.expr('confused'); clara.arms(-1.2, 0.2, -1.2, -0.2); clara.look(0, 0.15 * Math.sin(T * 1.7)); pt(0, -2.5, 5.6, -193, '#ffd9b0', 30);
  camW(V3(-2.6, 5.0, -200 + 7.5 + 0.03 * Math.sin(T * 20)), V3(-3, 4.8, -200), 40); FOCUS.copy(V3(-3, 0, -200)); FOCUS_R = 15; });
// 28 The road doesn't lead back into town.
S.push((u, T) => { use('road', 'highway'); const car = RN.car; car.visible = true; car.rotation.set(0, Math.PI, 0); const z = -300 - T * 26; car.position.set(-3.2, 0, z); focus(-3, 0, z, 40); cam([2, 12, z + 26], [2, 12, z + 26], [-2, 2, z - 70], [-2, 2, z - 70], 52, easeInOut, 0); });
// 29 It simply ends.
S.push((u, T) => { use('road', 'highway'); noBeams(); const car = RN.car; car.visible = true; car.rotation.set(0, Math.PI, 0); const k = easeOut(clamp(T / 1.2)); car.position.set(-3.2, 0, lerp(-468, -506.5, k)); car.rotation.x = k < 1 ? -0.03 * Math.sin(k * Math.PI) : 0; focus(-3, 0, -505, 30); cam([-14, 3.4, -496], [-13.5, 3.5, -497], [-1.5, 1.8, -515], [-1.5, 1.6, -516], 50); });
// 30 Not at a wall.
S.push((u, T) => { use('road', 'highway'); noBeams(); const car = RN.car; car.visible = true; car.position.set(-3.2, 0, -506.5); car.rotation.set(0, Math.PI, 0); pl(clara, 1.2, 0, -517.6, Math.PI + 0.3).idle(T).expr('worried'); focus(0, 0, -515, 25); cam([18, 6.5, -507], [17, 6.5, -508], [-2, 3, -520], [-2, 3, -520], 50); pt(0, 2, 6, -514, '#fff1c8', 60); });
// 31 Not at a cliff.
S.push((u, T) => { use('road', 'highway'); noBeams(); const car = RN.car; car.visible = true; car.position.set(-3.2, 0, -506.5); car.rotation.set(0, Math.PI, 0); pl(clara, 0.5, 0, -518.6, Math.PI).expr('worried'); clara.root.rotation.x = 0.0; clara.torso.rotation.x = -0.5; clara.look(0.6, 0); clara.arms(-0.3, -0.2, -0.3, 0.2); pt(0, 3, 5, -514, '#fff1c8', 80); focus(0, 0, -515, 20); cam([11, 2.6, -514], [10.5, 2.4, -514.5], [0, 2.2, -520], [0, 1.8, -520], 50); });
// 32 At a perfectly straight line in the ground.
S.push((u, T) => { use('road', 'highway'); pl(clara, -1, 0, -517.8, Math.PI).idle(T); focus(-1, 0, -518, 15); camW(V3(-1, 16 - u * 2, -520.001), V3(-1, 0, -520), 45); camera.up.set(0, 0, -1); camera.lookAt(V3(-1, 0, -520)); camera.rotation.z += 0.0; });
// 33 Beyond it, there is nothing but darkness.
S.push((u, T) => { use('road', 'highway'); noBeams(); const car = RN.car; car.visible = true; car.position.set(-3.2, 0, -506.5); car.rotation.set(0, Math.PI, 0); pl(clara, -0.6, 0, -517.4, Math.PI).idle(T); focus(0, 0, -514, 25); cam([1.5, 5.2, -497], [1.2, 5.0, -501], [0, 4, -540], [0, 4, -540], 50); });
// 34 Then she notices something beneath the road.
S.push((u, T) => { use('road', 'highway'); pl(clara, -0.5, 0, -513.5, Math.PI / 2).idle(T).expr('worried'); clara.look(0.55 * ease(u), 0); focus(2, 0, -514, 15); cam([8.5, 3.0, -509], [8.5, 3.0, -509.5], [-0.3, 4.4, -513.5], [-0.3, 4.2, -513.5], 38); pt(0, 4.5, -1, -514, '#ffd9a0', 30); });
// 35 A metal staircase.
S.push((u, T) => { use('road', 'highway'); RN.lid.rotation.z = -1.9 * ease(clamp(T / 0.6)); pt(0, 4.5, -4, -514, '#ffe2b0', 120); pt(1, 4.5, -20, -514, '#ff4030', 80); focus(4.5, 0, -514, 15); cam([4.6, 8.5, -507.5], [4.6, 8.0, -508.5], [4.5, -10, -515], [4.5, -12, -515], 52); });
// 36 It leads underground.
S.push((u, T) => { use('road', 'stairs'); RN.lid.rotation.z = -1.9; pt(0, 4.5, -10 - u * 15, -514, '#ffe2b0', 110); pt(1, 4.5, -40, -514, '#ff4030', 140); camW(V3(4.5 + 0.3, lerp(-1, -18, easeIn(u)), -514 + 0.3), V3(4.5, -70, -514), 62); camera.up.set(0, 0, -1); camera.lookAt(V3(4.5, -70, -514)); });
// 37 And from somewhere below, she hears people shouting.
S.push((u, T) => { use('road', 'stairs'); RN.lid.rotation.z = -1.9; pl(clara, 4.4, 0, -510.4, Math.PI).expr('scared'); clara.root.rotation.x = -0.55; clara.look(0.55, 0); clara.arms(-0.9, 0, -0.9, 0); pt(0, 4.5, 6, -512, '#9fb6ff', 60); pt(1, 4.5, -2, -514, '#ff4030', 50); camW(V3(4.5, -9, -514.2), V3(4.4, 3.5, -511.4), 50); SHAKE = 0; });
// 38 She follows the voices.
S.push((u, T) => { use('road', 'stairs'); RN.shaftWall.visible = false; const i = 4 + T * 2.6, a = i * 0.32, y = -1 - i * 0.58; const cx = 4.5 + Math.cos(a) * 3.1, cz = -514 + Math.sin(a) * 3.1; pl(clara, cx, y + 0.1, cz, -a).walk(T * 6, 0.8).expr('scared'); clara.hold(phone); clara.armR.rotation.x = -1.5;
  pt(1, 4.5, y - 8, -514, '#ff4030', 60); const ca = a + 0.75; pt(2, 4.5 + Math.cos(ca) * 8, y + 5, -514 + Math.sin(ca) * 8, '#b8c8ff', 70); camW(V3(4.5 + Math.cos(ca) * 10, y + 4.2, -514 + Math.sin(ca) * 10), V3(cx, y + 3.4, cz), 46); });
// 39 After descending for what feels like an hour, she reaches a door.
S.push((u, T, D) => { use('road', 'stairs'); const i = 40 + u * 76, a = i * 0.32, y = -1 - i * 0.58; const cx = 4.5 + Math.cos(a) * 3.1, cz = -514 + Math.sin(a) * 3.1; pl(clara, cx, y + 0.1, cz, -a).walk(T * 7, 0.8).expr('tired'); clara.hold(phone); clara.armR.rotation.x = -1.5; RN.doorGlow.visible = false;
  pt(0, 4.5, -68, -516, '#ffe6a8', 60); camW(V3(4.5 + 0.2, y + 22, -514 + 0.2), V3(4.5, y - 20, -514), 56); camera.up.set(0, 0, -1); camera.lookAt(V3(4.5, y - 20, -514)); });
// 40 On it are 3 words.
S.push((u, T) => { use('road', 'stairs'); hideSteps(); pl(clara, 3.6, -71, -519.5, Math.PI).idle(T).expr('scared'); clara.hold(phone); clara.armR.rotation.x = -1.45; pt(0, 4.5, -62, -523, '#ffe6a8', 120); camW(V3(8.2, -64.5, lerp(-510, -511.5, u)), V3(4.2, -67, -527), 48); });
// 41 TUESDAY, NUMBER 98.
S.push((u, T) => { use('road', 'stairs'); hideSteps(); pt(0, 4.5, -63, -520, '#fff0c8', 90); pt(1, 6, -67, -522, '#ffe6a8', 30); camW(V3(4.5, -67.2, lerp(-515.6, -516.6, easeOut(u))), V3(4.5, -67.2, -526.4), 46); });
// 42 Clara opens the door.
S.push((u, T) => { use('road', 'stairs'); hideSteps(); const k = ease(seg(u, 0.15, 0.8)); RN.leaf.rotation.y = -1.7 * k; RN.doorGlow.visible = true; pl(clara, 4.2, -71, -523.2, Math.PI).idle(T).expr(k > 0.3 ? 'shock' : 'scared'); clara.arms(0, 0, -1.4 + 0.4 * k, 0.1);
  pt(0, 4.5, -66, -526, '#ffd8a0', 40 + 300 * k); camW(V3(9, -65, -515.5), V3(4.3, -66.5, -526), 46); });
// 43 And finds her town.
S.push((u, T) => { use('under', 'under'); scene.fog.near = 90; scene.fog.far = 420; lanternLights(); underPeople(T, 'tired', 8); pl(clara, 0, 0.6, 112, Math.PI).idle(T).expr('shock'); pt(4, 0, 14, 96, '#ffc080', 400); pt(5, 0, 18, 40, '#ffb060', 900); focus(0, 0, 60, 90); cam([3, 12, 124], [2.5, 11, 120], [0, 8, 30], [0, 9, 20], 52, easeOut); });
// 44 The same church.
S.push((u, T) => { use('under', 'under'); lanternLights(); focus(0, 0, -85, 50); cam([-12, 6, -42], [-10, 7, -46], [0, 20, -88], [0, 22, -88], 48); });
// 45 The same bakery.
S.push((u, T) => { use('under', 'under'); lanternLights(); underPeople(T, 'tired', 8); focus(-14, 0, -12, 25); cam([-2, 4.5, -2], [-3, 4.6, -4], [-14, 5, -12], [-14, 5, -12.5], 48); pt(4, -8, 5, -10, '#ffb060', 140); });
// 46 The same yellow bus.
S.push((u, T) => { use('under', 'under'); lanternLights(); focus(9, 0, 22, 25); cam([-6, 3.5, 40], [-5, 3.8, 37], [9, 3, 22], [9, 3, 22], 46); pt(4, 2, 6, 30, '#ffb060', 160); });
// 47 But everything is destroyed.
S.push((u, T) => { use('under', 'under'); lanternLights(); underPeople(T, 'tired', 22); focus(0, 0, -10, 90); cam([34, 30, 70], [-34, 30, 70], [0, 4, -20], [0, 4, -20], 52); });
// 48 The buildings are damaged.
S.push((u, T) => { use('under', 'under'); lanternLights(); focus(16, 0, 26, 25); cam([2, 7, 38], [3, 6.8, 36], [16, 6, 26], [16, 6.2, 25.5], 50); pt(4, 6, 5, 30, '#ffb060', 160); });
// 49 The streets are flooded.
S.push((u, T) => { use('under', 'under'); lanternLights(); UN.water.material.map.offset.set(TT * 0.01, TT * 0.02); const z = 28 - T * 2.5; pl(clara, 0.5, -0.2, z, Math.PI).walk(T * 5, 0.6).expr('worried'); focus(0, 0, 18, 30); cam([2.5, 2.2, z + 13], [2.5, 2.2, z + 12], [0, 2.6, z - 8], [0, 2.6, z - 8], 52, easeInOut, 0); });
// 50 Hundreds of people are living inside the empty shops.
S.push((u, T) => { use('under', 'under'); lanternLights(); underPeople(T, 'tired', 22); focus(-10, 0, 10, 45); cam([-1, 5, 38], [-1, 5, 22], [-13, 4, 22], [-13, 4, 4], 50); });
// 51 Then a woman approaches her.
S.push((u, T) => { use('under', 'under'); lanternLights(); underPeople(T, 'tired', 10); const z = lerp(-28, -15, clamp(T / 2.4)); pl(womanU, -7.5, 0, z, 0.15).walk(T * 5, T < 2.4 ? 0.7 : 0).expr('blank'); pl(clara, -4.5, 0, -6.5, Math.PI - 0.25).idle(T).expr('worried');
  focus(-6, 0, -12, 30); cam([1.5, 5.4, -3.5], [1, 5.4, -4.2], [-6.5, 4.2, -16], [-6.5, 4.4, -16], 48); pt(4, -2, 6, -10, '#ffb060', 120); });
// 52 It's the woman who drops her coffee every morning.
S.push((u, T) => { use('under', 'under'); lanternLights(); pl(womanU, -6, 0, -13.5, 0).idle(T).expr('blank'); focus(-6, 0, -13, 15); cam([-5.2, 5.0, -6.6], [-5.6, 4.9, -8.0], [-6, 4.7, -13.5], [-6, 4.7, -13.5], 40); pt(4, -3, 6, -8, '#ffb060', 70); });
// 53 Except this version looks exhausted.
S.push((u, T) => { use('under', 'under'); lanternLights(); pl(womanU, -6, 0, -13.5, 0).idle(T, 0.5).expr('tired'); focus(-6, 0, -13, 15); cam([-6, 4.9, -9.6], [-6, 4.9, -10.2], [-6, 4.85, -13.5], [-6, 4.85, -13.5], 38); pt(4, -4, 6, -9, '#ffb060', 60); });
// 54 She has a scar across her face.
S.push((u, T) => { use('under', 'under'); lanternLights(); pl(womanU, -6, 0, -13.5, -0.25).idle(T, 0.4).expr('tired'); focus(-6, 0, -13, 15); cam([-7.4, 4.95, -10.6], [-7.0, 4.95, -10.9], [-6, 4.95, -13.5], [-6, 4.95, -13.5], 36); pt(4, -8, 6, -10, '#ffb060', 60); });
// 55 Clara asks what happened to the town.
S.push((u, T, D, LD) => { use('under', 'under'); lanternLights(); pl(clara, -6, 0, -9.5, Math.PI).idle(T).talk('confused', T, T < LD); clara.arms(-0.3 - 0.3 * Math.abs(Math.sin(T * 3)), 0, -0.6, 0.4); pl(womanU, -6, 0, -13.5, 0).idle(T).expr('blank');
  focus(-6, 0, -11, 20); cam([9, 5, -11.5], [8.4, 5, -11.4], [-6, 4.2, -11.5], [-6, 4.2, -11.5], 44); pt(4, 0, 6, -10, '#ffb060', 120); });
// 56 The woman looks at her.
S.push((u, T) => { use('under', 'under'); lanternLights(); pl(clara, -6.8, 0, -8.8, Math.PI + 0.1).idle(T); pl(womanU, -6, 0, -13.5, 0).idle(T).expr('blank'); womanU.look(0, 0.12 * ease(u)); focus(-6, 0, -11, 20); cam([-4.0, 5.5, -4.6], [-4.2, 5.5, -5.2], [-5.6, 4.7, -13.5], [-5.6, 4.7, -13.5], 42); pt(4, -3, 6, -9, '#ffb060', 90); });
// 57 "What do you mean?"
S.push((u, T, D, LD) => { use('under', 'under'); lanternLights(); pl(womanU, -6, 0, -13.5, 0).idle(T).talk('confused', T, T < LD); womanU.look(0, 0.15); focus(-6, 0, -13, 15); cam([-5.4, 4.9, -8.8], [-5.6, 4.9, -9.4], [-6, 4.8, -13.5], [-6, 4.8, -13.5], 38); pt(4, -3, 6, -9, '#ffb060', 70); });
// 58 Clara explains the time loop.
S.push((u, T, D, LD) => { use('under', 'under'); lanternLights(); pl(clara, -6, 0, -8.5, Math.PI).idle(T).talk('worried', T, T < LD); clara.armR.rotation.set(-1.5 + 0.6 * Math.sin(T * 6), 0, 0.6 * Math.cos(T * 6)); clara.armL.rotation.set(-1.2 - 0.5 * Math.sin(T * 6 + 1), 0, -0.5 * Math.cos(T * 6 + 1));
  focus(-6, 0, -9, 15); cam([-6.6, 5.0, -15.0], [-6.4, 5.0, -14.4], [-6, 4.4, -8.5], [-6, 4.4, -8.5], 42); pt(4, -3, 6, -12, '#ffb060', 80); });
// 59 And the woman begins laughing.
S.push((u, T) => { use('under', 'under'); lanternLights(); pl(womanU, -6, 0, -13.5, 0).expr('laugh'); womanU.body.position.y = Math.abs(Math.sin(T * 9)) * 0.15; womanU.torso.rotation.x = -0.12 + 0.06 * Math.sin(T * 9); womanU.arms(-0.6, -0.2, -0.6, 0.2); pl(clara, -6, 0, -8.5, Math.PI).expr('confused');
  focus(-6, 0, -12, 20); cam([-2, 5, -5.5], [-2.5, 5, -6.5], [-6, 4, -13.5], [-6, 4.2, -13.5], 44); pt(4, -3, 6, -9, '#ffb060', 80); });
// 60 Then she says something Clara will never forget.
S.push((u, T) => { use('under', 'under'); lanternLights(); pl(womanU, -6, 0, -13.5, 0).idle(T, 0.3).expr('sadsmile'); focus(-6, 0, -13, 15); cam([-6, 4.9, -5.0], [-6, 4.9, -9.6], [-6, 4.8, -13.5], [-6, 4.85, -13.5], 40, ease); pt(4, -4, 6, -9, '#ffb060', 70); });
// 61 "Sweetheart, time doesn't repeat here."
S.push((u, T, D, LD) => { use('under', 'under'); lanternLights(); pl(womanU, -6, 0, -13.5, 0.1).idle(T, 0.3).talk('sadsmile', T, T < LD); focus(-6, 0, -13, 15); cam([-6.8, 4.9, -9.4], [-6.6, 4.9, -9.8], [-6, 4.85, -13.5], [-6, 4.85, -13.5], 38); pt(4, -4, 6, -9, '#ffb060', 70); });
// 62 "Every midnight, they build another town directly above us."
S.push((u, T, D, LD) => { use('under', 'under'); lanternLights(); pl(womanU, -6, 0, -13.5, 0).idle(T, 0.3).talk('blank', T, T < LD); womanU.armR.rotation.set(-2.9 * ease(clamp(T / 0.6)), 0, 0.1); womanU.look(-0.4 * ease(u), 0); focus(-6, 0, -13, 20); cam([-4.5, 4, -6], [-4.5, 5, -7], [-6, 5, -13.5], [-6, 34, -24], 48, easeInOut); pt(4, -4, 6, -9, '#ffb060', 70); pt(1, -6, 48, -20, '#ffb060', 600); });
// 63 "They copy our houses."
S.push((u, T) => { use('under', 'void'); assemble(UN.newTown, lerp(0.15, 0.85, u)); focus(18, 64, 30, 40); cam([-14, 72, 54], [-12, 71.5, 51], [18, 68, 44], [18, 68, 43], 46); pt(0, 4, 80, 50, '#57d8ff', 900); });
// 64 Our streets.
S.push((u, T) => { use('under', 'void'); assemble(UN.newTown, lerp(0.25, 0.8, u)); focus(0, 64, 40, 50); cam([0, 70, 110], [0, 69, 104], [0, 64, 40], [0, 64, 36], 50); pt(0, 0, 78, 70, '#57d8ff', 400); });
// 65 Even our people."
S.push((u, T) => { use('under', 'void'); assemble(UN.newTown, 0.9); for (let i = 0; i < 6; i++) { const e = extras[i]; const k = clamp((T - i * 0.18) / 0.3); if (k <= 0) continue; pl(e, -6 + i * 2.6, 64, 30, 0).expr('blank'); e.root.scale.setScalar(pop(T - i * 0.18, 0.3)); }
  focus(0, 64, 30, 30); cam([0, 69, 46], [0, 69, 44], [0, 67, 30], [0, 67, 30], 46); pt(0, 0, 74, 40, '#57d8ff', 400); });
// 66 "And they leave the old ones underneath."
S.push((u, T) => { use('stack', 'stack'); SN.top.visible = true; SN.top.position.y = lerp(SN.GAP, 0, ease(u)); SN.layers.forEach((L, i) => L.position.y = -i * SN.GAP - SN.GAP * ease(u)); assemble(SN.top, 1); stackGlow(false); cam([40, 6, 72], [36, 0, 66], [0, -14, 0], [0, -18, 0], 50); FOCUS.copy(V3(0, -10, 0)); FOCUS_R = 60; });
// 67 Clara looks around.
S.push((u, T) => { use('under', 'under'); lanternLights(); underPeople(T, 'tired', 14); pl(clara, 2, 0, -30, Math.PI + Math.sin(T * 2) * 0.5).idle(T).expr('scared'); clara.look(0.1, Math.sin(T * 2.6) * 0.5); const a = lerp(-2.0, -1.2, u); focus(2, 0, -30, 30); camW(V3(2 + Math.cos(a) * 10, 6, -30 + Math.sin(a) * 10), V3(2, 4.5, -30), 48); pt(4, 2, 8, -38, '#ffb060', 150); });
// 68 The woman explains that there are 98 towns buried below the surface.
S.push((u, T) => { use('stack', 'stack'); stackGlow(false); cam([0, 6, 60], [0, -30, 118], [0, -10, 0], [0, -46, 0], 52); FOCUS.copy(V3(0, -30, 0)); FOCUS_R = 80; badge('98 TOWNS', 'dark', 0, -36, 62, T - wt('98'), 4.2); });
// 69 Every single one is filled with people who believe they lived through an ordinary Tuesday.
S.push((u, T) => { use('stack', 'stack'); stackGlow(false); pt(1, 0, -16, 20, '#ffe6c0', 400); cam([-10, -18.4, 36], [-7, -18.6, 33], [-2, -19.8, 0], [0, -19.8, 0], 34); FOCUS.copy(V3(0, -21, 0)); FOCUS_R = 30; });
// 70 But at midnight, a new copy appears above them.
S.push((u, T) => { use('stack', 'stack'); stackGlow(false); SN.top.visible = true; SN.top.position.y = SN.GAP; assemble(SN.top, ease(clamp(T / (0.85 * 2.4)))); cam([10, 18, 48], [8, 16, 44], [0, 4, 0], [0, 5, 0], 48); FOCUS.copy(V3(0, 0, 0)); FOCUS_R = 50; badge('12:00 AM', 'time', 0, 19, 0, T - 0.2, 2); });
// 71 The old town sinks underground.
S.push((u, T) => { use('stack', 'stack'); stackGlow(false); SN.top.visible = true; assemble(SN.top, 1); const k = ease(u); SN.top.position.y = SN.GAP * (1 - k); SN.layers.forEach((L, i) => L.position.y = -i * SN.GAP - SN.GAP * k); cam([24, 8, 50], [22, 4, 48], [0, -2, 0], [0, -5, 0], 46); FOCUS.copy(V3(0, -5, 0)); FOCUS_R = 50; });
// 72 And the new residents wake up without any memory of what happened.
S.push((u, T) => { use('bed', 'room'); BN.blanket.position.y = 3.35; BN.blanket.scale.y = 1.3; const e = extras[8]; pl(e, -5.5, 3.0, -1.5); e.root.rotation.x = -Math.PI / 2; const tw = wt('wake'); e.expr(T < tw ? 'sleep' : 'smile'); focus(-5.5, 0, -2, 20); camW(V3(-2.2, 9.5, -6.2), V3(-5.5, 3.1, -6.4), 38); });
// 73 Except Clara.
S.push((u, T) => { use('under', 'under'); lanternLights(); pl(clara, -6, 0, -8.5, 0.3).idle(T).expr('determined'); focus(-6, 0, -8, 15); cam([-4.6, 4.9, -2.6], [-4.9, 4.9, -3.3], [-6, 4.8, -8.5], [-6, 4.8, -8.5], 38); pt(4, -2, 6, -3, '#ffb060', 80); });
// 74 For some reason, every new version of Clara inherits the memories of the girl before her.
S.push((u, T) => { use('under', 'void'); assemble(UN.newTown, 0); thread.visible = true; const heads = []; claras.forEach((c, i) => { pl(c, -10 + i * 5, 64, -i * 7, 0.3).idle(T + i).expr(i === 0 ? 'determined' : 'blank'); heads.push(c.headWorld(new THREE.Vector3())); });
  while (thread.children.length < 24) { const s = sphere(0.22, glowM, 8, 6); s.castShadow = false; thread.add(s); } thread.children.forEach((s, j) => { const seg2 = j % 4, f = ((TT * 0.6 + j / 24) % 1); const a = heads[4 - seg2], b = heads[3 - seg2]; s.position.lerpVectors(a, b, f).y += Math.sin(f * Math.PI) * 1.6; });
  focus(0, 64, -14, 40); cam([18, 70, 14], [16, 69, 11], [0, 67, -12], [0, 67, -12], 50); pt(0, 0, 76, 0, '#57d8ff', 600); pt(1, 10, 70, 2, '#ffe680', 80); });
// 75 The woman leads her to a room filled with photographs.
S.push((u, T) => { use('photo', 'photo'); const z = lerp(14, 4, u); pl(womanU, -1.5, 0, z - 3, Math.PI).walk(T * 5, 0.8).expr('blank'); pl(clara, 1.8, 0, z, Math.PI).walk(T * 5 + 1, 0.8).expr('worried'); focus(0, 0, 0, 30); cam([3, 7, 26], [2.5, 7, 20], [0, 11, -11], [0, 11, -11], 50); pt(0, 0, 18, 6, '#ffd9a0', 200); });
// 76 In every photograph, Clara is standing beside the clock tower.
S.push((u, T) => { use('photo', 'photo'); focus(0, 0, -10, 20); cam([-10, 16.6, -5.5], [-6, 16.4, -5.5], [-10, 16.4, -11.6], [-6, 16.2, -11.6], 32); pt(0, -8, 16, -4, '#ffe0b0', 120); });
// 77 There are 98 photographs.
S.push((u, T) => { use('photo', 'photo'); focus(0, 0, -6, 30); cam([0, 13.5, -4], [0, 13.5, 28], [0, 13.5, -11.6], [0, 13.5, -11.6], 50, easeOut); pt(0, 0, 18, 6, '#ffd9a0', 220); badge('98', 'dark', 0, 23.6, -10, T - 0.3, 1.0); });
// 78 98 different Claras.
S.push((u, T) => { use('photo', 'photo'); focus(0, 0, -6, 30); cam([-16, 14, 1], [16, 14, 1], [-16, 13.5, -11.6], [16, 13.5, -11.6], 40); pt(0, 0, 18, 6, '#ffd9a0', 220); });
// 79 Clara realizes something horrible.
S.push((u, T) => { use('photo', 'photo'); pl(clara, 0, 0, -3, 0).idle(T, 0.5).expr(T < 0.4 ? 'worried' : 'shock'); focus(0, 0, -4, 15); cam([0, 4.9, 3.2], [0, 4.9, 2.4], [0, 4.8, -3], [0, 4.8, -3], 40); pt(0, 0, 8, 6, '#ffd9a0', 120); });
// 80 She hasn't been surviving the same day.
S.push((u, T) => { use('photo', 'photo'); pl(clara, 0, 0, -1, Math.PI).idle(T, 0.4); focus(0, 0, -4, 30); cam([0, 6, 34], [0, 6.5, 30], [0, 11, -11], [0, 11, -11], 48); pt(0, 0, 18, 4, '#ffd9a0', 220); });
// 81 She's been watching 98 different versions of herself replace one another.
S.push((u, T, D) => { use('under', 'void'); assemble(UN.newTown, 0); const n = 5, per = D / n; const k = Math.min(n - 1, Math.floor(T / per)), life = T - k * per; const c = claras[k]; pl(c, 0, 64, 0, 0.15).idle(T).expr('blank'); c.root.scale.setScalar(pop(life, 0.22)); if (k > 0 && life < 0.25) { const p = claras[k - 1]; pl(p, 0, 64, 0, 0.15).expr('blank'); p.root.scale.setScalar(Math.max(0.01, 1 - life / 0.25)); }
  badge('CLARA #' + (94 + k), 'gold', 0, 72.2, 0, life - 0.05, 0.9); focus(0, 64, 0, 20); cam([0, 68.6, 15], [0, 68.4, 13], [0, 67.2, 0], [0, 67.2, 0], 44); pt(0, 3, 72, 8, '#fff1dc', 260); pt(1, -6, 70, -4, '#57d8ff', 200); });
// 82 And somewhere beneath her feet, all the previous versions are still alive.
S.push((u, T) => { use('stack', 'stack'); stackGlow(false); miniClaras.visible = true; miniClaras.children.forEach((m, i) => { m.children[4].material.opacity = 0.14 + 0.1 * Math.sin(TT * 3 + i); }); cam([28, 4, 44], [24, -50, 56], [0, -8, 0], [0, -70, 0], 46); FOCUS.copy(V3(0, -40, 0)); FOCUS_R = 80; });
// 83 Suddenly, the underground lights turn red.
S.push((u, T) => { const red = T > wt('red') - 0.1; use('under', red ? 'underRed' : 'under'); lanternLights(red); underPeople(T, red ? 'scared' : 'tired', 22); pl(clara, -6, 0, -8.5, 0.4).idle(T).expr(red ? 'shock' : 'worried'); pl(womanU, -8.5, 0, -12, 0.6).idle(T).expr(red ? 'scared' : 'blank'); focus(-6, 0, -10, 40); cam([-2.5, 7, 7], [-2.8, 7, 6], [-6, 4.5, -12], [-6, 4.5, -12], 50); });
// 84 A siren sounds.
S.push((u, T) => { use('under', 'underRed'); lanternLights(true); UN.beamPivot.rotation.y = TT * 5; UN.beam.material.opacity = 0.35; UN.beaconMat.color.set(Math.sin(TT * 10) > 0 ? '#ff2a2a' : '#7a1010'); pt(5, -14, 11, -64, '#ff2020', 200 + 150 * Math.sin(TT * 10)); focus(-14, 0, -64, 30); cam([-6, 7, -50], [-7, 7.5, -52], [-14, 10, -64], [-14, 10.4, -64], 46); });
// 85 The woman grabs Clara's arm.
S.push((u, T) => { use('under', 'underRed'); lanternLights(true); const tg = wt('grabs'); pl(clara, -6.4, 0, -8.6, -Math.PI / 2 + 0.3).idle(T).expr(T > tg ? 'shock' : 'scared'); pl(womanU, -9.8, 0, -9.6, Math.PI / 2 - 0.2).idle(T).expr('scared'); womanU.arms(0, 0, T > tg ? -1.45 : -0.3, 0.35);
  focus(-8, 0, -9, 20); cam([-8, 5.4, 1.5], [-8, 5.4, 0.5], [-8, 4, -9], [-8, 4, -9], 46); pt(5, -8, 9, -4, '#ff2020', 160 + 80 * Math.sin(TT * 10)); });
// 86 "You need to get back upstairs."
S.push((u, T, D, LD) => { use('under', 'underRed'); lanternLights(true); SHAKE = 0.04; pl(womanU, -6, 0, -13.5, 0).idle(T).talk('scared', T, T < LD); focus(-6, 0, -13, 15); cam([-5.4, 4.9, -9.0], [-5.6, 4.9, -9.6], [-6, 4.8, -13.5], [-6, 4.8, -13.5], 38); pt(5, -4, 6, -9, '#ff2020', 120 + 60 * Math.sin(TT * 10)); });
// 87 Clara asks why.
S.push((u, T, D, LD) => { use('under', 'underRed'); lanternLights(true); pl(clara, -6, 0, -8.5, Math.PI).idle(T).talk('confused', T, T > wt('why') - 0.05 && T < LD); focus(-6, 0, -9, 15); cam([-6.4, 4.9, -14.4], [-6.3, 4.9, -14.0], [-6, 4.75, -8.5], [-6, 4.75, -8.5], 38); pt(5, -4, 6, -13, '#ff2020', 120 + 60 * Math.sin(TT * 10)); });
// 88 The woman points to the clock.
S.push((u, T) => { use('under', 'underRed'); lanternLights(true); pl(womanU, -6, 0, -13.5, Math.PI + 0.15).idle(T).expr('scared'); womanU.armR.rotation.set(-2.6 * ease(clamp(T / 0.5)), 0, -0.2); pl(clara, -8.6, 0, -12, Math.PI - 0.3).idle(T).expr('scared'); clara.look(-0.3, 0);
  focus(-5, 0, -14, 30); cam([-3, 6, -1], [-3.4, 6.5, -2.5], [-2, 12, -60], [-1, 17, -82], 46); });
// 89 It's 11:58.
S.push((u, T) => { use('under', 'underRed'); lanternLights(true); UT.clock.userData.set(11, 58, 0); const c = UT.clock.getWorldPosition(new THREE.Vector3()); camW(c.clone().add(new THREE.Vector3(0.6, -0.3, lerp(15, 11, easeOut(u)))), c, 34); FOCUS.copy(c); FOCUS_R = 20; badge('11:58 PM', 'alert', 0, 17.6, -78, T - wt('11:58'), 1.3); pt(5, 0, 26, -70, '#ff3030', 220); });
// 90 Then the ground begins to shake.
S.push((u, T) => { use('under', 'underRed'); lanternLights(true); SHAKE = 0.35 * ease(clamp(T / 0.5)); underPeople(T, 'scared', 12); pl(clara, -6, 0, -8.5, 0.2).idle(T).expr('scared'); clara.root.rotation.z = Math.sin(T * 13) * 0.06; pl(womanU, -8.5, 0, -11.5, 0.5).idle(T).expr('scared'); womanU.root.rotation.z = Math.sin(T * 11 + 1) * 0.06;
  dust.visible = true; dust.position.copy(V3(-6, 0, -12)); dust.children.forEach(d => { const p = (TT * d.userData.sp * 0.5 + d.userData.ph) % 1; d.position.set(d.userData.x, 60 - p * 62, d.userData.z); d.rotation.set(p * 5, p * 3, 0); }); UN.water.material.map.offset.set(Math.sin(TT * 9) * 0.01, TT * 0.03);
  focus(-6, 0, -10, 40); cam([4, 6, 8], [3.5, 6, 7], [-6, 6, -12], [-6, 6, -12], 54); });
// 91 Clara hears a deep mechanical noise coming from above.
S.push((u, T) => { use('under', 'underRed'); lanternLights(true); UN.crackGlow.visible = true; SHAKE = 0.12; pl(clara, -6, 0, -8.5, 0.3).idle(T).expr('scared'); clara.look(-0.7 * ease(clamp(T / 0.8)), 0); dust.visible = true; dust.position.copy(V3(-6, 0, -9)); dust.children.forEach(d => { const p = (TT * d.userData.sp * 0.5 + d.userData.ph) % 1; d.position.set(d.userData.x * 0.4, 60 - p * 62, d.userData.z * 0.4); });
  focus(-6, 0, -8, 20); camW(V3(-5.6, 3.6, -4.4), V3(-6, 6.2, -8.5), 46); pt(4, -5, 6, -4, '#ff3020', 90); });
// 92 She looks up through a crack in the ceiling.
S.push((u, T) => { use('under', 'underRed'); lanternLights(true); UN.crackGlow.visible = true; SHAKE = 0.08; pt(5, 17, 40, -77, '#ff3020', 300); focus(17, 0, -76, 40); camW(V3(19, 6 + u, -66), V3(17, 62, -78), 55); });
// 93 And sees an entire new town slowly forming in the darkness.
S.push((u, T) => { use('under', 'void'); assemble(UN.newTown, lerp(0.05, 0.55, u)); focus(0, 64, -10, 90); cam([70, 125, 70], [62, 112, 58], [0, 64, -20], [0, 64, -24], 52); pt(0, 0, 100, -10, '#57d8ff', 2500); });
// 94 Another church.
S.push((u, T) => { use('under', 'void'); assemble(UN.newTown, lerp(0.45, 0.8, u)); focus(0, 64, -90, 45); cam([-6, 70, -58], [-5, 70.5, -60], [0, 82, -90], [0, 84, -90], 50); pt(0, 0, 100, -60, '#57d8ff', 1500); });
// 95 Another bakery.
S.push((u, T) => { use('under', 'void'); assemble(UN.newTown, lerp(0.55, 0.85, u)); focus(-14, 64, -12, 25); cam([-2, 68.5, -1], [-3, 68.6, -3], [-14, 69, -12], [-14, 69, -12.5], 48); pt(0, -4, 76, -6, '#57d8ff', 600); });
// 96 Another yellow bus.
S.push((u, T) => { use('under', 'void'); NT.bus.position.set(3.2, 0, 10); NT.bus.rotation.set(0, 0.3, 0); assemble(UN.newTown, lerp(0.6, 0.95, u)); focus(3, 64, 10, 25); cam([-10, 67, 26], [-9, 67.5, 24], [3, 66, 10], [3, 66, 10], 48); pt(0, -2, 76, 20, '#57d8ff', 700); });
// 97 And standing outside one of the houses…
S.push((u, T) => { use('under', 'void'); assemble(UN.newTown, 1); pl(clara2, 10.5, 64.3, -44, Math.PI / 2).idle(T, 0.5); focus(12, 64, -44, 25); cam([-6, 69, -38], [-3, 68.5, -40], [11, 67, -44], [11, 67, -44], 46, ease); pt(0, 9, 72, -42, '#ffd9a0', 120); pt(1, -10, 80, -40, '#57d8ff', 600); });
// 98 Another Clara.
S.push((u, T) => { use('under', 'void'); assemble(UN.newTown, 1); const k = ease(clamp(T / 0.7)); pl(clara2, 10.5, 64.3, -44, lerp(Math.PI / 2, -Math.PI / 2, k)).idle(T, 0.4).expr('blank'); focus(12, 64, -44, 20); cam([4.5, 68.9, -42.8], [5.3, 68.9, -43.1], [10.5, 68.7, -44], [10.5, 68.7, -44], 40); pt(0, 6, 72, -43, '#ffd9a0', 160); pt(1, -10, 80, -40, '#57d8ff', 500); });
// 99 The new girl looks down through the same crack.
S.push((u, T) => { use('under', 'void'); scene.background = BG('#000000'); assemble(UN.newTown, 1); pl(clara2, 17, 64, -64.8, Math.PI).idle(T, 0.3).expr('blank'); clara2.look(0.75 * ease(clamp(T / 0.8)), 0); pt(0, 17, 55, -72, '#ff3020', 400); pt(1, 17, 71, -61, '#ffd9a0', 300); focus(17, 60, -66, 20); camW(V3(17.3, 56.5, -70.5), V3(17, 68.4, -64.6), 42); });
// 100 Their eyes meet.
S.push((u, T) => { use('under', 'underRed'); lanternLights(true); UN.crackGlow.visible = true; pl(clara, 17, 0, -72, 0).expr('shock'); clara.look(-0.85, 0); focus(17, 0, -72, 15); camW(V3(17, lerp(10.5, 9.6, u), -69.6), V3(17, 5.2, -72.3), 34); pt(5, 17, 12, -68, '#ffd9a0', 60); });
// 101 Then, from somewhere even deeper underground, hundreds of voices begin shouting the same thing.
S.push((u, T) => { use('stack', 'stackRed'); stackGlow(true); cam([30, -10, 46], [26, -78, 40], [0, -30, 0], [0, -96, 0], 50, easeIn); FOCUS.copy(V3(0, -60, 0)); FOCUS_R = 90; });
// 102 "DON'T LET HER FIND THE STAIRS!"
S.push((u, T) => { use('under', 'underRed'); lanternLights(true); SHAKE = 0.22; for (let i = 0; i < 22; i++) { const c = extrasU[i]; const row = Math.floor(i / 6), col = i % 6; pl(c, -8 + col * 4 + (row % 2) * 2, 0, -36 - row * 4.5, 0).expr('shout', true); c.arms(-2.6 - 0.3 * Math.sin(T * 9 + i), -0.3, -2.6 - 0.3 * Math.sin(T * 9 + i + 1), 0.3); c.body.position.y = Math.abs(Math.sin(T * 7 + i)) * 0.25; }
  focus(0, 0, -42, 40); cam([2, 3.2, -20], [2, 3.6, -21], [2, 5, -44], [2, 5.5, -44], 54); pt(5, 2, 10, -28, '#ff2020', 400); });
// 103 Clara turns to the woman.
S.push((u, T) => { use('under', 'underRed'); lanternLights(true); const k = ease(clamp(T / 0.8)); pl(clara, -6, 0, -8.5, lerp(0.4, Math.PI, k)).idle(T).expr('scared'); pl(womanU, -6, 0, -13.5, 0).idle(T).expr('scared'); focus(-6, 0, -11, 20); cam([3, 5.2, -11.5], [2.5, 5.2, -11.5], [-6, 4.3, -11], [-6, 4.3, -11], 46); pt(5, -2, 7, -8, '#ff2020', 150); });
// 104 "Why?"
S.push((u, T, D, LD) => { use('under', 'underRed'); lanternLights(true); pl(clara, -6, 0, -8.5, Math.PI).idle(T).talk('scared', T, T < LD); focus(-6, 0, -9, 15); cam([-5.6, 4.9, -14.0], [-5.7, 4.9, -13.6], [-6, 4.75, -8.5], [-6, 4.75, -8.5], 36); pt(5, -4, 6, -13, '#ff2020', 130); });
// 105 The woman looks terrified.
S.push((u, T) => { use('under', 'underRed'); lanternLights(true); pl(womanU, -6, 0, -13.5, 0).idle(T, 1.5).expr('terrified'); womanU.root.rotation.z = Math.sin(T * 30) * 0.01; focus(-6, 0, -13, 15); cam([-6, 4.9, -9.0], [-6, 4.9, -10.0], [-6, 4.85, -13.5], [-6, 4.85, -13.5], 36); pt(5, -4, 6, -9, '#ff2020', 140); });
// 106 "Because every time one of you finds out what this place is…
S.push((u, T, D, LD) => { use('under', 'underRed'); lanternLights(true); pl(womanU, -6, 0, -13.5, 0.15).idle(T).talk('scared', T, T < LD); focus(-6, 0, -13, 15); cam([-7.0, 4.95, -9.6], [-6.8, 4.95, -10.0], [-6, 4.85, -13.5], [-6, 4.85, -13.5], 38); pt(5, -4, 6, -9, '#ff2020', 130); });
// 107 She points toward the other underground towns.
S.push((u, T) => { use('under', 'underRed'); lanternLights(true); pl(womanU, -6, 0, -13.5, -0.95).idle(T).expr('scared'); womanU.armR.rotation.set(-1.45 * ease(clamp(T / 0.4)), 0, 0.1); womanU.look(0.15, 0); focus(-5, 0, -13, 25); cam([0.5, 5.2, -5], [0.2, 5.2, -5.6], [-6, 4, -14], [-6.5, 3.8, -14.5], 48); pt(5, -2, 7, -8, '#ff2020', 140); });
// 108 …you try to destroy it."
S.push((u, T) => { use('stack', 'stackRed'); stackGlow(true); const L = SN.layers[4]; fireSmall.visible = true; fireSmall.position.copy(V3(-6, L.position.y + 0.2, 0)); fireSmall.userData.update(TT); fire.visible = true; fire.position.copy(V3(8, L.position.y + 0.2, 2)); fire.scale.setScalar(0.5); fire.userData.update(TT + 3); SHAKE = 0.3;
  cam([-2, -22, 30], [0, -24, 26], [0, -28, 0], [0, -28, 0], 44); FOCUS.copy(V3(0, -28, 0)); FOCUS_R = 40; });
// 109 A long silence follows.
S.push((u, T) => { use('under', 'underRed'); lanternLights(true); pl(clara, -6, 0, -8.5, Math.PI).expr('scared'); pl(womanU, -6, 0, -13.5, 0).expr('sad'); UN.water.material.map.offset.set(TT * 0.004, TT * 0.008); focus(-6, 0, -11, 30); cam([6, 4, -4], [5.4, 4, -4.6], [-6, 3.8, -11.2], [-6, 3.8, -11.2], 42, ease); pt(5, -6, 10, -11, '#ff2020', 90); });
// 110 Then she whispers:
S.push((u, T) => { use('under', 'underRed'); lanternLights(true); const k = ease(clamp(T / 0.9)); pl(clara, -6, 0, -8.5, Math.PI).idle(T, 0.3).expr('scared'); pl(womanU, lerp(-6, -5.2, k), 0, lerp(-13.5, -10.8, k), lerp(0, 0.6, k)).idle(T, 0.3).expr('sad'); womanU.torso.rotation.x = 0.15 * k; womanU.look(0.1, 0.5 * k);
  focus(-6, 0, -10, 20); cam([2.5, 5.2, -9.8], [2, 5.1, -9.8], [-5.8, 4.6, -9.8], [-5.8, 4.6, -9.8], 40); pt(5, -2, 7, -9, '#ff2020', 110); });
// 111 "And every time you destroy it, they have to build another one to keep you inside."
S.push((u, T) => { use('stack', 'stackRed'); stackGlow(true); SN.top.visible = true; SN.top.position.y = SN.GAP; assemble(SN.top, ease(clamp(u * 1.3))); cam([0, 4, 30], [0, -40, 170], [0, 0, 0], [0, -40, 0], 50); FOCUS.copy(V3(0, -40, 0)); FOCUS_R = 90; });
// 112 The clock strikes midnight.
S.push((u, T) => { use('town', 'night'); townNight(SETS.town.g); const ts = wt('midnight'); const s = Math.min(60, 57 + T * 2); TN.clock.userData.set(T < ts ? 11 : 12, T < ts ? 59 : 0, T < ts ? s : 0); const flash = T > ts ? Math.max(0, 1 - (T - ts) * 1.5) : 0; TN.clock.userData.faceMat.emissiveIntensity = 0.55 + flash * 4; renderer.toneMappingExposure = 1.05 + flash * 1.4;
  focus(0, 0, -82, 30); cam([0, 24.5, -60], [0, 24.5, -66], [0, 24.5, -82.4], [0, 24.5, -82.4], 32); });
// 113 The screen goes black.
S.push((u, T) => { use(null, 'black'); for (const k in SETS) SETS[k].g.visible = false; camW(new THREE.Vector3(0, 1000, 0), new THREE.Vector3(0, 1000, -10), 50); });
// 114 And somewhere above them, a girl wakes up.
S.push((u, T) => { use('bed', 'room'); BN.blanket.position.y = 3.35; BN.blanket.scale.y = 1.3; pl(clara2, -5.5, 3.0, -1.5); clara2.root.rotation.x = -Math.PI / 2; const tw = wt('wakes'); clara2.expr(T < tw ? 'sleep' : 'blank'); focus(-5.5, 0, -2, 20); camW(V3(-5.5, 10.4 - u * 0.8, -6.45), V3(-5.5, 3, -6.5), 40); camera.up.set(0, 0, -1); camera.lookAt(V3(-5.5, 3, -6.5)); });
// 115 It's Tuesday.
S.push((u, T) => { use('bed', 'room'); focus(-11, 0, -4, 15); camW(V3(lerp(-3.4, -4.4, easeOut(u)), 9, -4), V3(-11.6, 9, -4), 40); });
// 116 Again.
S.push((u, T) => { use('bed', 'room'); BN.blanket.position.y = 3.0; pl(clara2, -5.5, 2.0, -3.6, 0).sit(); clara2.expr('shock'); clara2.look(-0.05, 0); focus(-5.5, 0, -2, 20); cam([-5.5, 5.4, 6], [-5.5, 5.6, 1.2], [-5.5, 5.3, -3.6], [-5.5, 5.5, -3.6], 40, easeOut); });

// ---------- timeline ----------
let SHOTT = [], LINEWORDS = [], CUR = 0;
async function loadTimeline() {
  const tl = await (await fetch('timeline.json')).json(); const words = await (await fetch('words.json')).json();
  LINEWORDS = tl.map(() => []); for (const w of words) LINEWORDS[w.line].push(w);
  const end = tl[tl.length - 1].end + 0.5;
  SHOTT = tl.map((m, i) => ({ start: i === 0 ? 0 : m.start, end: i < tl.length - 1 ? tl[i + 1].start : end, ld: m.end - m.start }));
  window.DURATION = end;
}
window.renderAt = (t) => {
  TT = t; let i = SHOTT.findIndex(s => t >= s.start && t < s.end); if (i < 0) i = t <= 0 ? 0 : SHOTT.length - 1; CUR = i;
  const s = SHOTT[i], D = s.end - s.start, T = t - s.start; U = clamp(T / D);
  resetAll(); S[i](U, T, D, s.ld); updateSun();
  renderer.render(scene, camera); return i;
};
window.shotCount = S.length;
await document.fonts.ready;
await loadTimeline();
window.SHOTT = SHOTT;
window.ready = true;
