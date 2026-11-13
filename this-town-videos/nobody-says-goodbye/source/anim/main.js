// "Nobody is allowed to say goodbye": stage, characters, photographs and 174 shots.
import { THREE, clamp, lerp, ease, easeOut, easeIn, easeInOut, seg, hash, noise1, rng, pop, mat, newMat, basic, box, put, cyl, sphere, canvasTex, gradientTex, rr, Char, ALL_CHARS, makeBadge } from './core.js';
import { buildTown, makeClock } from './sets.js';
import { buildStation, buildHall, buildTerminal, buildHome, buildOffice, makeCarriage, umbrella, ticketTex, ticketBackTex, bench } from './sets2.js';

const Q = new URLSearchParams(location.search);
const W = +(Q.get('w') || 720), H = Math.round(W * 16 / 9);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const vig = document.getElementById('vig'), fadeEl = document.getElementById('fade');
const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 1500);

// ---------- lights & presets ----------
const hemi = new THREE.HemisphereLight('#fff', '#444', 1); scene.add(hemi);
const amb = new THREE.AmbientLight('#fff', 0.2); scene.add(amb);
const sun = new THREE.DirectionalLight('#fff', 2); sun.castShadow = true; sun.shadow.mapSize.set(1536, 1536); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; scene.add(sun, sun.target);
const PTS = []; for (let i = 0; i < 6; i++) { const p = new THREE.PointLight('#fff', 0, 0, 2); scene.add(p); PTS.push(p); }
const bgCache = new Map(); const BG = s => { const k = JSON.stringify(s); if (!bgCache.has(k)) bgCache.set(k, typeof s === 'string' ? new THREE.Color(s) : gradientTex(s)); return bgCache.get(k); };
const PRE = {
  overcast: { bg: [[0, '#8e9aa6'], [0.6, '#b9c1c6'], [1, '#d9d6cc']], fog: ['#c3c5c2', 90, 420], hemi: ['#e6ebf0', '#7a6e5c', 1.25], sun: ['#fff1dc', 1.3, [30, 70, 40]], amb: 0.3, exp: 1.0 },
  autumn: { bg: [[0, '#7fa0c0'], [0.6, '#c7c9c2'], [1, '#e9d9bc']], fog: ['#d8cfbd', 110, 480], hemi: ['#f2ecdf', '#7a6448', 1.25], sun: ['#ffe2b8', 2.0, [50, 55, 30]], amb: 0.25, exp: 1.0 },
  dusk: { bg: [[0, '#2a2f55'], [0.6, '#a86a5a'], [1, '#e2a274']], fog: ['#a77a6a', 80, 400], hemi: ['#ffcfaa', '#3a3430', 0.8], sun: ['#ffa86a', 1.8, [80, 20, -30]], amb: 0.15, exp: 1.0 },
  night: { bg: [[0, '#02040f'], [0.7, '#0a1130'], [1, '#151d40']], fog: ['#080c22', 60, 360], hemi: ['#5d70b0', '#0e1018', 0.42], sun: ['#9fb6ff', 0.5, [-30, 60, 30]], amb: 0.09, exp: 1.08 },
  interior: { bg: '#141018', fog: null, hemi: ['#fff1dc', '#8a6a4a', 0.95], sun: ['#ffe2b0', 1.2, [20, 40, 30]], amb: 0.3, exp: 1.0 },
  interiorNight: { bg: '#05060c', fog: null, hemi: ['#ffd9a8', '#2a1d14', 0.55], sun: ['#9fb6ff', 0.35, [-20, 40, 30]], amb: 0.12, exp: 1.05 },
  hallNight: { bg: '#05060c', fog: ['#0a0c14', 40, 140], hemi: ['#c9d2e6', '#2a2620', 0.6], sun: ['#9fb6ff', 0.3, [-20, 40, 30]], amb: 0.14, exp: 1.05 },
  terminal: { bg: '#05060a', fog: ['#0d0f14', 40, 170], hemi: ['#8a9cc8', '#2a2018', 0.55], sun: ['#9fb6ff', 0.55, [10, 60, 8]], amb: 0.1, exp: 1.1 },
  records: { bg: '#05060a', fog: ['#0d0a08', 25, 90], hemi: ['#ffd9a8', '#2a1d14', 0.5], sun: null, amb: 0.1, exp: 1.08 },
  basement: { bg: '#050403', fog: ['#0b0907', 20, 80], hemi: ['#ffdcae', '#2a2018', 0.45], sun: null, amb: 0.08, exp: 1.08 },
  cold: { bg: [[0, '#9aa6b2'], [0.6, '#c3c9cf'], [1, '#dfe2e4']], fog: ['#c9ced3', 80, 380], hemi: ['#e8eef6', '#5e6066', 1.15], sun: ['#eef4ff', 1.0, [-30, 60, 30]], amb: 0.3, exp: 1.0 },
  void: { bg: '#000000', fog: ['#000000', 30, 160], hemi: ['#c9d6ff', '#000000', 0.5], sun: ['#ffffff', 0.6, [-20, 40, 30]], amb: 0.12, exp: 1.05 },
  black: { bg: '#000000', fog: null, hemi: ['#000', '#000', 0], sun: null, amb: 0, exp: 1 },
};
let FOCUS = new THREE.Vector3(), FOCUS_R = 40;
function applyPreset(name) {
  const p = PRE[name]; scene.background = BG(p.bg);
  if (p.fog) { if (!scene.fog) scene.fog = new THREE.Fog('#000', 1, 2); scene.fog.color.set(p.fog[0]); scene.fog.near = p.fog[1]; scene.fog.far = p.fog[2]; } else scene.fog = null;
  hemi.color.set(p.hemi[0]); hemi.groundColor.set(p.hemi[1]); hemi.intensity = p.hemi[2]; amb.intensity = p.amb; renderer.toneMappingExposure = p.exp;
  if (p.sun) { sun.visible = true; sun.color.set(p.sun[0]); sun.intensity = p.sun[1]; sun.userData.dir = new THREE.Vector3(...p.sun[2]).normalize(); } else sun.visible = false;
}
function updateSun() { if (!sun.visible) return; sun.target.position.copy(FOCUS); sun.position.copy(FOCUS).addScaledVector(sun.userData.dir, 150); const c = sun.shadow.camera; c.left = c.bottom = -FOCUS_R; c.right = c.top = FOCUS_R; c.near = 1; c.far = 320; c.updateProjectionMatrix(); }
const GRADES = { cine: 'saturate(0.86) contrast(1.06)', sepia: 'sepia(0.85) saturate(0.85) contrast(1.08) brightness(0.93)', memory: 'saturate(0.45) contrast(1.02) brightness(1.04)', cold: 'saturate(0.72) contrast(1.04) brightness(0.98)', none: 'none' };
function grade(g, v = 0.55) { renderer.domElement.style.filter = GRADES[g]; vig.style.opacity = v; }
function fade(k) { fadeEl.style.opacity = clamp(k); }

// ---------- sets ----------
const SETS = {
  st: { g: buildStation(), o: new THREE.Vector3(0, 0, 0) },
  hall: { g: buildHall(), o: new THREE.Vector3(0, 0, 400) },
  term: { g: buildTerminal(), o: new THREE.Vector3(-900, 0, 0) },
  home: { g: buildHome(), o: new THREE.Vector3(900, 0, 0) },
  town: { g: buildTown({ seed: 12, autumn: true }), o: new THREE.Vector3(0, 0, 1200) },
  office: { g: buildOffice(), o: new THREE.Vector3(1500, 0, 0) },
};
for (const k in SETS) { SETS[k].g.position.copy(SETS[k].o); scene.add(SETS[k].g); }
const SN = SETS.st.g.userData.named, HN = SETS.hall.g.userData.named, TM = SETS.term.g.userData.named, HM = SETS.home.g.userData.named, TN = SETS.town.g.userData.named, ON = SETS.office.g.userData.named;
let O = new THREE.Vector3();
function use(name, preset, g = 'cine', v = 0.55) { for (const k in SETS) SETS[k].g.visible = k === name; O = name ? SETS[name].o : new THREE.Vector3(); applyPreset(preset); grade(g, v); }
const V3 = (x, y, z) => new THREE.Vector3(O.x + x, O.y + y, O.z + z);
function focus(x, y, z, r = 40) { FOCUS.copy(V3(x, y, z)); FOCUS_R = r; }

// ---------- camera ----------
let U = 0, SHAKE = 0, TT = 0;
function cam(p0, p1, l0, l1, fov = 45, e = easeInOut, k = null) {
  const q = k ?? e(U);
  camera.position.set(O.x + lerp(p0[0], p1[0], q), O.y + lerp(p0[1], p1[1], q), O.z + lerp(p0[2], p1[2], q));
  camera.position.x += (noise1(TT * 0.5, 1) - 0.5) * 0.05; camera.position.y += (noise1(TT * 0.5, 2) - 0.5) * 0.05;
  if (SHAKE) { camera.position.x += (noise1(TT * 16, 4) - 0.5) * SHAKE; camera.position.y += (noise1(TT * 16, 5) - 0.5) * SHAKE; }
  camera.up.set(0, 1, 0); camera.lookAt(O.x + lerp(l0[0], l1[0], q), O.y + lerp(l0[1], l1[1], q), O.z + lerp(l0[2], l1[2], q)); camera.fov = fov; camera.updateProjectionMatrix();
}
function camW(pos, look, fov = 45, up = null) { camera.position.copy(pos); camera.up.set(...(up || [0, 1, 0])); camera.lookAt(look); camera.fov = fov; camera.updateProjectionMatrix(); }

// ---------- characters ----------
const SCARF = '#b8322a';
const base = { skin: '#e9b58f', inner: '#cdd0d6', shoes: '#5a3a26', scarf: SCARF };
const E17 = new Char({ ...base, hair: 'spiky', hairColor: '#3b2416', shirt: '#2f3f66', sleeve: '#2f3f66', pants: '#3a3f4a' });
const E25 = new Char({ ...base, hair: 'short', hairColor: '#3b2416', shirt: '#4a5a3a', pants: '#4a4038', inner: '#d8d2c2' });
const E39 = new Char({ ...base, hair: 'short', hairColor: '#4a3020', shirt: '#6b4a32', pants: '#3a3a40', inner: '#e2d8c8', stubble: true });
const E54 = new Char({ ...base, hair: 'short', hairColor: '#8d8d8d', shirt: '#3d3d46', pants: '#2e2e34', inner: '#cfcfcf', mustache: '#7a7a7a', wrinkles: true });
const E67 = new Char({ ...base, hair: 'old', hairColor: '#e6e6e6', shirt: '#2e2e36', pants: '#2a2a30', inner: '#d8d8d8', mustache: '#e6e6e6', wrinkles: true, glasses: true, hat: { type: 'flatcap', color: '#5a5048' } });
const ES = [E67, E54, E39, E25, E17];
const MOM = new Char({ skin: '#efc7a6', hair: 'bun', hairColor: '#bdbdbd', shirt: '#8e3b46', inner: '#f0e6d8', pants: '#4a3f45', shoes: '#3a2a26', female: true, wrinkles: true, glasses: true });
const MOM2 = new Char({ skin: '#efc7a6', hair: 'bun', hairColor: '#d6d6d6', shirt: '#5a5f6e', inner: '#e8e2d8', pants: '#3a3a44', shoes: '#2a2a2a', female: true, wrinkles: true, glasses: true, scarf: SCARF });
const DAD = new Char({ skin: '#e8bf9c', hair: 'old', hairColor: '#cfcfcf', shirt: '#4f6b5a', inner: '#e8e2d0', pants: '#3a3a40', shoes: '#2a2a2a', glasses: true, wrinkles: true });
const GIRL = new Char({ scale: 0.62, skin: '#efc7a6', hair: 'pigtails', hairColor: '#6b3e22', shirt: '#e3b23c', dress: '#e3b23c', pants: '#f2f2f2', shoes: '#5a2a1e', female: true });
const LADY = new Char({ skin: '#e2b48f', hair: 'bun', hairColor: '#ededed', shirt: '#5e6b8a', inner: '#d8cfc0', pants: '#3a3540', shoes: '#2a2620', female: true, glasses: true, wrinkles: true });
const COND = new Char({ skin: '#d9a37a', hair: 'short', hairColor: '#7a7a7a', hat: { type: 'police', color: '#1f2a44' }, shirt: '#1f2a44', inner: '#c9a227', pants: '#1f2a44', shoes: '#111111', mustache: '#5a5a5a' });
const BRIDE = new Char({ skin: '#f1c6a0', hair: 'long', hairColor: '#c9a25a', shirt: '#fafafa', dress: '#fafafa', pants: '#fafafa', shoes: '#eeeeee', female: true });
const GROOM = new Char({ skin: '#d9a37a', hair: 'short', hairColor: '#2a1d14', shirt: '#1d1d24', inner: '#ffffff', pants: '#1d1d24', shoes: '#111111' });
const BOYOLD = new Char({ scale: 0.7, skin: '#e9b58f', hair: 'short', hairColor: '#3b2416', hat: { type: 'flatcap', color: '#5a5048' }, shirt: '#6a5a48', pants: '#4a4038', shoes: '#3a2a20', scarf: SCARF });
const R0 = rng(321);
const SK = ['#f1c6a0', '#e0ac80', '#c68642', '#8d5a3b', '#f5d0b5', '#d9a37a'], CL = ['#7a5a48', '#5a6a5a', '#6a5a6e', '#8a7a5a', '#4a5a6a', '#7a4a42', '#9a8a6a', '#5e5040'], PA2 = ['#3a3530', '#4a4540', '#2e3238', '#4a3f35'];
const HS = ['short', 'spiky', 'bun', 'long', 'old', 'short'], HC = ['#2b1d14', '#5a3a22', '#1d1410', '#9a9a9a', '#3a2418', '#d9d9d9'];
const pick = a => a[Math.floor(R0() * a.length)];
const mk = (o = {}) => { const h = o.hair || pick(HS); return new Char({ skin: pick(SK), hair: h, hairColor: pick(HC), shirt: pick(CL), pants: pick(PA2), shoes: '#2a2622', female: h === 'long' || h === 'bun', ...o }); };
const folk = Array.from({ length: 12 }, () => mk({ shirt: pick(['#a8452a', '#c9822b', '#5a6a8a', '#6a7a4a', '#8a5a6a', '#d9b04a', '#4a6a7a']) }));
const pax = Array.from({ length: 18 }, (_, i) => mk({ circles: i % 2 === 0, hat: i % 4 === 0 ? { type: 'flatcap', color: pick(['#4a4038', '#3a3a3a', '#5a4a3a']) } : undefined, wrinkles: i % 3 === 0 }));
const mourners = Array.from({ length: 7 }, () => mk({ shirt: '#1d1d22', pants: '#1d1d22', inner: '#e8e8e8' }));
const kid = new Char({ scale: 0.7, skin: '#c68642', hair: 'spiky', hairColor: '#1d1410', shirt: '#e34968', pants: '#3d5a9e', shoes: '#f2f2f2' });
const kidChild = new Char({ scale: 0.55, skin: '#f1c6a0', hair: 'short', hairColor: '#8a5a3a', shirt: '#9a8a6a', pants: '#4a4038', shoes: '#3a2a20', circles: true });
for (const c of ALL_CHARS) scene.add(c.root);

// ---------- props ----------
const PROPS = []; const prop = o => { PROPS.push(o); scene.add(o); o.visible = false; return o; };
const suitcase = new THREE.Group(); suitcase.add(put(box(2.2, 1.6, 0.8, mat('#7a4e2a', { rough: 0.6 }), 0.15), 0, -1.0, 0)); suitcase.add(put(box(0.9, 0.2, 0.2, mat('#3a2616'), 0.05), 0, -0.1, 0));
const steam = prop(new THREE.Group()); for (let i = 0; i < 14; i++) { const s = sphere(2.2, new THREE.MeshStandardMaterial({ color: '#e8e8ee', transparent: true, opacity: 0.4, depthWrite: false, roughness: 1 }), 10, 8); s.castShadow = false; s.userData = { x: (hash(i) - 0.5) * 30, ph: hash(i + 9) }; steam.add(s); }
function steamAt(x, y, z, k = 1) { steam.visible = true; steam.position.copy(V3(x, y, z)); steam.children.forEach(s => { const p = (TT * 0.18 + s.userData.ph) % 1; s.position.set(s.userData.x, p * 14, Math.sin(p * 6 + s.userData.x) * 2); s.scale.setScalar((0.6 + p * 1.6) * k); s.material.opacity = 0.42 * (1 - p); }); }
const graves = prop(new THREE.Group()); for (let i = 0; i < 9; i++) { const g = box(1.6, 2.4 + (i % 3) * 0.4, 0.5, mat('#8a8a8a', { rough: 1 }), 0.3); g.position.set((i % 3) * 5 - 5, 1.2, Math.floor(i / 3) * 5 - 5); graves.add(g); }
const coffin = prop(new THREE.Group()); coffin.add(put(box(2.6, 1.6, 6.5, mat('#3a2216', { rough: 0.5 }), 0.3), 0, 0.8, 0)); coffin.add(put(box(2.7, 0.2, 6.6, mat('#5a3a26', { rough: 0.5 }), 0.1), 0, 1.65, 0));
const umbs = Array.from({ length: 7 }, () => umbrella());
const welcome = prop(new THREE.Group()); { welcome.add(put(box(0.4, 5, 0.4, mat('#4a3020'), 0.05), -4, 2.5, 0)); welcome.add(put(box(0.4, 5, 0.4, mat('#4a3020'), 0.05), 4, 2.5, 0)); const t = canvasTex(1024, 384, (g, w, h) => { g.fillStyle = '#2f4a3a'; rr(g, 6, 6, w - 12, h - 12, 30); g.fill(); g.lineWidth = 10; g.strokeStyle = '#efe4cc'; g.stroke(); g.fillStyle = '#efe4cc'; g.textAlign = 'center'; g.font = '600 64px Poppins'; g.fillText('WELCOME TO', w / 2, 120); g.font = '800 130px Poppins'; g.fillText('BELLWETHER', w / 2, 250); g.font = '600 40px Poppins'; g.fillText('PLEASE DO NOT SAY GOODBYE', w / 2, 330); }); const p = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.4), new THREE.MeshStandardMaterial({ map: t })); p.position.set(0, 5.6, 0.25); welcome.add(p); welcome.add(put(box(9.4, 3.8, 0.4, mat('#4a3020'), 0.1), 0, 5.6, 0)); }
const baby = new THREE.Group(); baby.add(put(box(1.4, 1.0, 2.2, mat('#f4efe6', { rough: 1 }), 0.45), 0, 0, 0)); baby.add(put(box(0.8, 0.8, 0.8, mat('#f1c6a0'), 0.3), 0, 0.3, 0.9));
const cake = (n) => { const g = new THREE.Group(); g.add(put(cyl(1.4, 1.4, 1.1, mat('#f3e1c8'), 20), 0, 0.55, 0)); g.add(put(cyl(1.45, 1.45, 0.25, mat('#e34968'), 20), 0, 1.0, 0)); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; g.add(put(cyl(0.06, 0.06, 0.6, mat('#9fd0f5'), 6), Math.cos(a) * 0.8, 1.4, Math.sin(a) * 0.8)); g.add(put(sphere(0.1, basic('#ffcf40'), 6, 4), Math.cos(a) * 0.8, 1.78, Math.sin(a) * 0.8)); } return g; };
// photo cards (pool), ticket card, erased-name document
const CARDS = Array.from({ length: 6 }, () => { const g = new THREE.Group(); const f = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75 }); const b = new THREE.MeshStandardMaterial({ color: '#efe8da', roughness: 0.9 }); const pf = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.78), f); pf.position.z = 0.012; const pb = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.78), b); pb.rotation.y = Math.PI; pb.position.z = -0.012; g.add(pf, pb); g.userData = { f, b }; return prop(g); });
let cardIdx = 0;
function card(tex, x, y, z, rx = 0, ry = 0, rz = 0, s = 4, backTex = null) { const c = CARDS[cardIdx++ % CARDS.length]; scene.add(c); c.visible = true; c.userData.f.transparent = false; c.userData.f.opacity = 1; c.userData.b.visible = true; c.userData.f.map = tex; c.userData.f.needsUpdate = true; c.userData.b.map = backTex; c.userData.b.color.set(backTex ? '#ffffff' : '#efe8da'); c.userData.b.needsUpdate = true; c.position.copy(V3(x, y, z)); c.rotation.set(rx, ry, rz); c.scale.setScalar(s); return c; }
const ticketCard = prop(new THREE.Group()); { const f = new THREE.MeshStandardMaterial({ map: ticketTex('', 'NOV 13 2026', 'ELIAS', true), roughness: 0.9 }); const b = new THREE.MeshStandardMaterial({ map: ticketBackTex(), roughness: 0.9 }); ticketCard.userData.orig = f.map; const pf = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), f); pf.position.z = 0.01; const pb = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), b); pb.rotation.y = Math.PI; pb.position.z = -0.01; ticketCard.add(pf, pb); ticketCard.userData.f = f; }
const ticket1961 = ticketTex('NORTHGATE', 'NOV 13 1961', 'ELIAS');
const docA = canvasTex(768, 1024, (g, w, h) => docDraw(g, w, h, true)), docB = canvasTex(768, 1024, (g, w, h) => docDraw(g, w, h, false));
function docDraw(g, w, h, withName) { g.fillStyle = '#f2ead6'; g.fillRect(0, 0, w, h); g.fillStyle = '#3a2a1a'; g.font = '700 46px Poppins'; g.fillText('TOWN OF BELLWETHER', 60, 110); g.font = '600 32px Poppins'; g.fillText('REGISTER OF RESIDENTS', 60, 165); g.strokeStyle = '#8a7a5a'; g.lineWidth = 3; for (let y = 230; y < h - 60; y += 70) { g.beginPath(); g.moveTo(60, y); g.lineTo(w - 60, y); g.stroke(); } const names = ['Margaret Hale', 'Thomas Reid', 'Arthur Penn', 'Ada Morrow', 'Samuel Price', 'Edith Clarke', 'Walter Finch', 'Rose Kemp', 'Henry Shaw', 'Iris Doyle']; g.font = '40px "Permanent Marker"'; names.forEach((n, i) => { if (i === 4 && !withName) return; g.fillStyle = '#2a2a4a'; g.fillText(n, 80, 220 + 70 * (i + 1) - 18); }); }
const doc = prop(new THREE.Group()); { const a = new THREE.Mesh(new THREE.PlaneGeometry(3, 4), new THREE.MeshStandardMaterial({ map: docB, roughness: 0.9 })); const b = new THREE.Mesh(new THREE.PlaneGeometry(3, 4), new THREE.MeshStandardMaterial({ map: docA, roughness: 0.9, transparent: true })); b.position.z = 0.005; doc.add(a, b); doc.userData.top = b.material; }
const belongings = prop(new THREE.Group()); { belongings.add(put(box(0.6, 3.4, 1.4, mat('#a8452a'), 0.2), -2, 1.7, 0)); belongings.add(put(cyl(1.0, 1.0, 0.35, mat('#d9b04a'), 18), -2, 2.4, 0.75)); belongings.add(put(box(1.6, 0.4, 1.2, mat('#2a3a5a'), 0.05), 1.5, 0.2, 0)); belongings.add(put(box(1.4, 0.4, 1.1, mat('#6b2a22'), 0.05), 1.5, 0.6, 0)); belongings.add(put(box(1.5, 0.4, 1.2, mat('#3a4a2a'), 0.05), 1.5, 1.0, 0)); belongings.add(put(box(1.8, 2.4, 0.4, mat('#4a5a8a'), 0.3), 3.6, 3.5, -0.3)); }
const BADGES = new Map();
function badge(text, style, x, y, z, T, s = 1) { const k = text + style; if (!BADGES.has(k)) { const b = makeBadge(text, style); scene.add(b); PROPS.push(b); BADGES.set(k, b); } const b = BADGES.get(k); const p = T < 0 ? 0 : pop(T, 0.22); b.visible = T >= 0; b.position.copy(V3(x, y, z)); b.scale.set(4.2 * s * p, 1.05 * s * p, 1); return b; }
// window panel used to put a passenger "inside" a carriage window (for the final photograph)
function windowPanel() { const g = new THREE.Group(); const m = mat('#2e4a3c', { rough: 0.55 }); g.add(put(box(10, 2.0, 0.4, m, 0.05), 0, -1.85, 0)); g.add(put(box(10, 1.4, 0.4, m, 0.05), 0, 1.55, 0)); g.add(put(box(4, 1.7, 0.4, m, 0.05), -3, 0, 0)); g.add(put(box(4, 1.7, 0.4, m, 0.05), 3, 0, 0)); g.add(put(box(10.06, 0.5, 0.45, mat('#e8dcc0'), 0.05), 0, 1.0, 0)); g.add(put(box(2.6, 3.0, 0.2, basic('#1a1612'), 0.02, false), 0, -0.2, -3.2)); return g; }
const wpanel = prop(windowPanel());

// ---------- per-frame reset ----------
function resetAll() {
  for (const c of ALL_CHARS) c.reset(); for (const p of PROPS) p.visible = false; for (const p of PTS) p.intensity = 0;
  for (const u of umbs) u.removeFromParent(); suitcase.removeFromParent(); baby.removeFromParent(); scene.add(ticketCard); ticketCard.scale.setScalar(1); if (ticketCard.userData.f.map !== ticketCard.userData.orig) { ticketCard.userData.f.map = ticketCard.userData.orig; ticketCard.userData.f.needsUpdate = true; }
  HM.tickets.forEach((t, i) => { t.position.x = -0.1 + i * 0.03; t.rotation.z = (i - 3) * 0.05; }); renderer.domElement.style.filter = GRADES.cine;
  SHAKE = 0; fade(0); camera.up.set(0, 1, 0);
  SN.setClock(10, 8, 0); SN.train.visible = true; SN.train.position.set(0, 0, -24); SN.trainNight.visible = false; SN.trainNight.position.set(0, 0, -24); SN.modern.visible = false;
  for (const m of SETS.st.g.userData.windows) m.emissiveIntensity = 0; for (const m of SETS.st.g.userData.lamps) m.emissiveIntensity = 0; SN.towerClock.userData.faceMat.emissiveIntensity = 0;
  HN.leaf.rotation.y = 0; HN.winMat.emissiveIntensity = 0.6;
  HM.leaf.rotation.y = 0; HM.cabDoorL.rotation.y = 0; HM.cabDoorR.rotation.y = 0; HM.padlock.visible = true; HM.lid.rotation.x = 0;
  TM.oldCar.position.set(-20, 0, 0);
  for (const m of SETS.town.g.userData.windows) m.emissiveIntensity = 0; for (const m of SETS.town.g.userData.lamps) m.emissiveIntensity = 0;
  TN.bus.position.set(3.2, 0, 400); TN.car.position.set(-4.4, 0, 30); TN.car.rotation.set(0, Math.PI, 0); TN.car2.position.set(4.4, 0, -30);
}
const pl = (c, x, y, z, ry = 0) => c.place(O.x + x, O.y + y, O.z + z, ry);
function pt(i, x, y, z, color, intensity, dist = 0) { const p = PTS[i]; p.position.copy(V3(x, y, z)); p.color.set(color); p.intensity = intensity; p.distance = dist; }
let SHOTT = [], LINEWORDS = [], CUR = 0;
function wt(word, n = 1) { const ws = LINEWORDS[CUR] || []; let k = 0; for (const w of ws) { if (w.w.toLowerCase().replace(/[^a-z0-9:']/g, '').startsWith(word.toLowerCase())) { k++; if (k === n) return w.t - SHOTT[CUR].start; } } return 0; }
function walkers(n, T, o = {}) {
  const seed = o.seed ?? 0;
  for (let i = 0; i < n; i++) { if (o.skip && o.skip.includes(i)) continue; const e = folk[i % folk.length]; const side = i % 2 ? 1 : -1, dir = (i % 4 < 2) ? 1 : -1, sp = 3 + hash(i + seed) * 1.2; const z = 120 - ((hash(i * 7 + seed) * 170 + dir * T * sp + 1000) % 170);
    if (o.avoid && Math.abs(side * 9 - o.avoid.x) < o.avoid.r && Math.abs(z - o.avoid.z) < o.avoid.r) continue;
    pl(e, side * (8.2 + (i % 3) * 0.9), 0.32, z, dir > 0 ? 0 : Math.PI); e.walk(T * sp * 1.7 + i, 1); e.expr(o.expr || 'neutral'); }
}
function townNight(win = 1.2, lamp = 1.6) { for (const m of SETS.town.g.userData.windows) m.emissiveIntensity = win; for (const m of SETS.town.g.userData.lamps) m.emissiveIntensity = lamp; }
function stationNight(win = 1.1, lamp = 1.8) { for (const m of SETS.st.g.userData.windows) m.emissiveIntensity = win; for (const m of SETS.st.g.userData.lamps) m.emissiveIntensity = lamp; SN.towerClock.userData.faceMat.emissiveIntensity = 0.5; }
function termLights() { const L = TM.lanterns; pt(0, L[0].x, 4, L[0].z, '#ffb45a', 140); pt(1, L[2].x, 4, L[2].z, '#ffb45a', 140); pt(2, L[4].x, 4, L[4].z, '#ffb45a', 140); pt(3, L[6].x, 4, L[6].z, '#ffb45a', 140); }
function lineup(T, k, x0, z0, dx, opts = {}) { ES.forEach((e, i) => { if (i >= k) return; const life = T - (opts.t0 ? opts.t0[i] : 0); if (life < 0) return; pl(e, x0 + i * (opts.dz ? 0 : dx), opts.y ?? 0, z0 + i * (opts.dz ?? 0), opts.ry ?? 0).idle(T + i, 0.6).expr(opts.expr || 'blank'); e.root.scale.setScalar(opts.pop ? pop(life, 0.25) : 1); }); }

// ---------- photographs (rendered from the sets, graded, framed) ----------
const PH = {};
function snap(setup, camPos, look, fov, o = {}) {
  resetAll(); setup(); updateSun(); const w = 768, h = 576;
  renderer.setSize(w, h); camera.aspect = w / h; camW(V3(...camPos), V3(...look), fov); renderer.render(scene, camera);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(renderer.domElement, 0, 0, w, h);
  renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix();
  return frame(c, o);
}
function frame(src, o = {}) {
  const w = src.width, h = src.height, m = Math.round(w * 0.06), mb = o.polaroid ? Math.round(h * 0.2) : m;
  const c = document.createElement('canvas'); c.width = w + 2 * m; c.height = h + m + mb; const g = c.getContext('2d');
  g.fillStyle = o.paper || '#f3ede0'; g.fillRect(0, 0, c.width, c.height);
  g.filter = o.sepia ? 'sepia(1) contrast(1.15) brightness(0.92)' : o.faded ? 'sepia(0.35) saturate(0.7) contrast(0.9) brightness(1.06)' : o.bw ? 'grayscale(1) contrast(1.1)' : 'saturate(0.95)';
  g.drawImage(src, m, m); g.filter = 'none';
  const vg = g.createRadialGradient(m + w / 2, m + h / 2, h * 0.3, m + w / 2, m + h / 2, h * 0.85); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(40,25,10,${o.sepia ? 0.45 : 0.25})`); g.fillStyle = vg; g.fillRect(m, m, w, h);
  if (o.worn) { const R = rng(o.worn); g.strokeStyle = 'rgba(255,250,235,0.5)'; for (let i = 0; i < 14; i++) { g.lineWidth = 1 + R() * 2; g.beginPath(); const x = m + R() * w; g.moveTo(x, m); g.lineTo(x + (R() - 0.5) * 60, m + h); g.stroke(); } g.fillStyle = 'rgba(120,90,50,0.18)'; for (let i = 0; i < 60; i++) g.fillRect(m + R() * w, m + R() * h, 2 + R() * 6, 2 + R() * 6); }
  if (o.date) { g.fillStyle = '#2a2a3a'; g.font = `${Math.round(mb * (o.polaroid ? 0.42 : 0.62))}px "Permanent Marker"`; g.textAlign = o.polaroid ? 'center' : 'right'; g.fillText(o.date, o.polaroid ? c.width / 2 : c.width - m * 1.2, c.height - mb * (o.polaroid ? 0.38 : 0.22)); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.userData.canvas = c; return t;
}
function buildPhotos() {
  const St = (k) => { for (const s in SETS) SETS[s].g.visible = s === k; O = SETS[k].o; };
  // rule: a family photo with and without the son
  for (const withSon of [true, false]) PH[withSon ? 'ruleWith' : 'ruleWithout'] = snap(() => { St('town'); applyPreset('autumn'); FOCUS.copy(V3(-12, 0, 44)); pl(folk[0], -10.4, 0.3, 46.6, Math.PI / 2).expr('smile'); pl(folk[5], -10.4, 0.3, 41.4, Math.PI / 2).expr('smile'); if (withSon) pl(kid, -10.2, 0.3, 44, Math.PI / 2).expr('happy'); }, [1.5, 4, 44], [-10.4, 3.5, 44], 34, { date: 'SUMMER' });
  for (const withSon of [true, false]) PH[withSon ? 'famWith' : 'famAlone'] = snap(() => { St('home'); applyPreset('interior'); FOCUS.copy(V3(0, 0, 0)); pl(MOM, -2.6, 0, 8, 0).expr('smile'); pl(DAD, 2.6, 0, 8, 0).expr('smile'); if (withSon) pl(E17, 0, 0, 9, 0).expr('happy'); pt(0, 0, 9, 16, '#ffe2b0', 260); }, [0, 5.2, 18.5], [0, 4.4, 8.5], 40, { date: '' });
  PH.p1961 = snap(() => { St('st'); applyPreset('overcast'); FOCUS.copy(V3(0, 0, 14)); FOCUS.copy(V3(4, 0, -16)); pl(E67, 3.0, 1.2, -16.6, 0.15).expr('neutral'); SN.setClock(10, 8); }, [3.4, 5.4, -9.0], [3.9, 5.6, -16], 48, { sepia: true, worn: 3, date: '1961' });
  PH.p1984 = snap(() => { St('town'); applyPreset('autumn'); FOCUS.copy(V3(0, 0, -72)); pl(GROOM, -1.4, 0, -74, 0.1).expr('happy'); pl(BRIDE, 1.4, 0, -74, -0.1).expr('happy'); pl(E54, 4.8, 0, -73, -0.3).expr('smile'); pl(folk[2], -5, 0, -73.5, 0.3).expr('smile'); pl(folk[7], 8, 0, -74.5, -0.4).expr('smile'); }, [1.5, 5, -56], [1.5, 6, -76], 40, { faded: true, date: '1984' });
  PH.p2003 = snap(() => { St('home'); applyPreset('interior'); FOCUS.copy(V3(0, 0, 0)); pl(E39, 0, 0, 9, 0).expr('happy'); E39.arms(-1.0, 0.3, -1.0, -0.3); baby.position.set(0, -0.6, 0.9); baby.rotation.set(0, Math.PI / 2, 0); E39.hold(baby); pt(0, 0, 9, 16, '#ffe2b0', 240); }, [0, 5.0, 17.5], [0, 4.0, 9], 40, { date: '2003' });
  PH.newest = snap(() => { St('st'); applyPreset('overcast'); FOCUS.copy(V3(0, 0, -12)); pl(E17, 2, 1.2, -12, Math.PI).expr('smile'); }, [2, 6.2, -21.5], [2, 5.6, -12], 36, { date: '2025' });
  PH.oldest = snap(() => { St('st'); applyPreset('overcast'); FOCUS.copy(V3(0, 0, 14)); pl(E67, 2.4, 0, 14, -0.1).expr('smile'); pl(GIRL, -0.4, 0, 14.6, 0.15).expr('happy'); E67.armL.rotation.set(0, 0, -0.5); }, [1.2, 4.8, 27], [1.2, 3.8, 13], 34, { sepia: true, worn: 7, date: '1961' });
  PH.final = snap(() => { St('st'); applyPreset('overcast'); FOCUS.copy(V3(0, 0, 14)); pl(E17, 1.6, 0, 15, -0.1).expr('gentle'); }, [1.6, 4.8, 27], [1.6, 4.4, 13], 34, { polaroid: true, date: '' });
  PH.oldAlone = snap(() => { St('st'); applyPreset('overcast'); FOCUS.copy(V3(0, 0, -16)); pl(GIRL, 2, 1.2, -15.6, Math.PI).expr('sad'); wpanel.visible = true; wpanel.position.copy(V3(6.5, 4.6, -18.9)); pl(E67, 6.5, 0.0, -20.8, 0).expr('sadsmile'); }, [2.4, 3.6, -5], [4, 3.2, -24], 38, { sepia: true, worn: 7, date: '1961' });
  PH.oldWindow = snap(() => { St('st'); applyPreset('overcast'); FOCUS.copy(V3(0, 0, -16)); wpanel.visible = true; wpanel.position.copy(V3(6.5, 4.6, -18.9)); pl(E67, 6.5, 0.0, -20.8, 0).expr('sadsmile'); }, [6.5, 4.7, -13.2], [6.5, 4.5, -20], 26, { sepia: true, worn: 7, date: '1961' });
  PH.mid = snap(() => { St('town'); applyPreset('autumn'); FOCUS.copy(V3(-12, 0, 26)); pl(E54, -10.6, 0.32, 34, Math.PI / 2).expr('smile'); }, [-2, 5.4, 34], [-10.6, 4.6, 34], 34, { faded: true, date: '1979' });
  PH.bday25 = snap(() => { St('home'); applyPreset('interior'); FOCUS.copy(V3(0, 0, 0)); pl(E25, 0, 0, 8, 0).expr('happy'); const ck = cake(); ck.add(put(box(4, 2.2, 3, mat('#6b4a32'), 0.1), 0, -1.1, 0)); ck.position.copy(V3(0, 2.2, 11)); scene.add(ck); pt(0, 0, 8, 16, '#ffe2b0', 240); PH._ck = ck; }, [0, 5, 18], [0, 3.8, 9.5], 40, { faded: true, date: '' });
  scene.remove(PH._ck);
  PH.bday17 = snap(() => { St('home'); applyPreset('interior'); FOCUS.copy(V3(0, 0, 0)); pl(E17, 0, 0, 8, 0).expr('happy'); const ck = cake(); ck.add(put(box(4, 2.2, 3, mat('#6b4a32'), 0.1), 0, -1.1, 0)); ck.position.copy(V3(0, 2.2, 11)); scene.add(ck); pt(0, 0, 8, 16, '#ffe2b0', 240); PH._ck = ck; }, [0, 5, 18], [0, 3.8, 9.5], 40, { date: '' });
  scene.remove(PH._ck);
  PH.child = snap(() => { St('town'); applyPreset('overcast'); FOCUS.copy(V3(-12, 0, 26)); pl(BOYOLD, -10.6, 0.32, 34, Math.PI / 2).expr('neutral'); }, [-3, 3.6, 34], [-10.6, 3.0, 34], 34, { sepia: true, worn: 11, date: '1903' });
  PH.group = []; for (let k = 0; k < 4; k++) PH.group.push(snap(() => { St('st'); applyPreset(['overcast', 'autumn', 'dusk', 'overcast'][k]); FOCUS.copy(V3(0, 0, 14)); const ppl = pax.slice(k * 4, k * 4 + 4); ppl.forEach((p, i) => pl(p, -4.5 + i * 3, 0, 14 + (i % 2) * 0.6, 0).expr(['smile', 'neutral', 'happy', 'smile'][i])); pl(ES[k % 5], 4.6, 0, 14.3, -0.1).expr('smile'); }, [0.5, 4.8, 28], [0.5, 4, 13], 38, { sepia: k % 2 === 0, faded: k % 2 === 1, worn: 20 + k }));
  // album pages and the photo wall atlas
  const page = (photos, labels, title) => { const c = document.createElement('canvas'); c.width = 620; c.height = 820; const g = c.getContext('2d'); g.fillStyle = '#2a2420'; g.fillRect(0, 0, 620, 820); photos.forEach((p, i) => { const cv = p.userData.canvas, w = 380, x = 120, y = 50 + i * 380, hh = w * cv.height / cv.width; g.save(); g.translate(x + w / 2, y + hh / 2); g.rotate((i % 2 ? 1 : -1) * 0.03); g.drawImage(cv, -w / 2, -hh / 2, w, hh); g.restore(); if (labels[i]) { g.fillStyle = '#efe4cc'; g.font = '30px "Permanent Marker"'; g.textAlign = 'center'; g.fillText(labels[i], x + w / 2, y + hh + 42); } }); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  PH.pageBday = [page([PH.bday25, PH.bday17], ['HAPPY 25TH', 'HAPPY 17TH']), page([PH.p2003, PH.mid], ['', ''])];
  PH.pageChild = [page([PH.child, PH.group[1]], ['', '']), page([PH.group[3], PH.newest], ['', ''])];
  PH.pageNames = [page([PH.mid, PH.p2003], ['THOMAS · 1979', 'HENRY · 2003']), page([PH.bday25, PH.newest], ['DANIEL · 2009', 'ELIAS · 2025'])];
  const pool = [PH.p1961, PH.p1984, PH.p2003, PH.newest, PH.mid, PH.child, PH.oldest, ...PH.group, ...PH.group];
  const atlas = document.createElement('canvas'); atlas.width = 4096; atlas.height = 512; const ag = atlas.getContext('2d'); ag.fillStyle = '#3a2e26'; ag.fillRect(0, 0, 4096, 512);
  const R = rng(5); for (let r = 0; r < 4; r++) for (let c = 0; c < 32; c++) { const p = pool[Math.floor(R() * pool.length)].userData.canvas; const x = c * 128 + 6 + R() * 6, y = r * 128 + 10 + R() * 6; ag.save(); ag.translate(x + 56, y + 44); ag.rotate((R() - 0.5) * 0.12); ag.filter = ['none', 'sepia(0.6)', 'grayscale(0.7)', 'brightness(0.85)'][Math.floor(R() * 4)]; ag.drawImage(p, -56, -44, 112, 88); ag.restore(); ag.filter = 'none'; ag.fillStyle = ['#c43', '#36c', '#ca3', '#3a6'][Math.floor(R() * 4)]; ag.beginPath(); ag.arc(x + 56, y + 3, 3, 0, 7); ag.fill(); }
  const at = new THREE.CanvasTexture(atlas); at.colorSpace = THREE.SRGBColorSpace; at.anisotropy = 8; for (const m of TM.photoWalls) { m.map = at; m.needsUpdate = true; }
  PH.backText = canvasTex(1024, 800, (g, w, h) => { g.fillStyle = '#efe8da'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d2a6b'; g.font = '50px "Permanent Marker"'; const L = ["When I come back,", "don't tell me who I am.", "Just let me live", "a normal life."]; L.forEach((s, i) => g.fillText(s, 70, 130 + i * 80)); g.fillStyle = '#5a1d1d'; g.fillText('And when the time comes,', 70, 560); g.fillText('please let me go.', 70, 640); g.fillStyle = '#3a3a3a'; g.font = '40px "Permanent Marker"'; g.fillText('- E.', 760, 740); });
  for (const m of HM.frames.slice(0, 3)) { m.m.map = PH.famWith; m.m.needsUpdate = true; } HM.frames[3].m.map = PH.p2003; HM.frames[4].m.map = PH.mid; HM.frames.forEach(f => f.m.needsUpdate = true);
  HM.pageL.map = PH.pageBday[0]; HM.pageR.map = PH.pageBday[1];
}
function famFrames(alone) { for (const m of HM.frames.slice(0, 3)) { const t = alone ? PH.famAlone : PH.famWith; if (m.m.map !== t) { m.m.map = t; m.m.needsUpdate = true; } } }
function albumPages(p) { if (HM.pageL.map !== p[0]) { HM.pageL.map = p[0]; HM.pageR.map = p[1]; HM.pageL.needsUpdate = HM.pageR.needsUpdate = true; } }

// ---------- shot helpers ----------
function photoInsert(tex, u, T, o = {}) { // a photo held in front of a dim backdrop, camera close
  use(o.set || 'term', o.pre || 'records', o.grade || 'cine', 0.6); const Y = 300, z0 = 0; const c = card(tex, 0, Y, z0, 0, 0, (o.rz ?? -0.03), o.s ?? 4);
  const lx = lerp(o.l0?.[0] ?? 0, o.l1?.[0] ?? 0, ease(U)), ly = Y + lerp(o.l0?.[1] ?? 0, o.l1?.[1] ?? 0, ease(U));
  const d = lerp(o.d0 ?? 5.2, o.d1 ?? 4.4, ease(U)); camW(V3(lx * 0.95, ly, z0 + d), V3(lx, ly, z0), o.fov ?? 40);
  pt(0, 0, Y + 3, z0 + 6, o.light || '#ffe6c0', 140); FOCUS.copy(V3(0, Y, z0)); FOCUS_R = 10;
  return c;
}
function tableInsert(set, pre, x, y, z, tex, o = {}) { // photo lying on a table, camera from above
  use(set, pre, o.grade || 'cine', 0.6); const c = card(tex, x, y + 0.05, z, -Math.PI / 2, 0, o.rz ?? 0.06, o.s ?? 3); const d = lerp(o.d0 ?? 4.6, o.d1 ?? 3.6, ease(U));
  camW(V3(x + (o.dx ?? 0), y + d, z + (o.dz ?? 0.4)), V3(x + (o.lx ?? 0), y, z + (o.lz ?? 0)), o.fov ?? 40, [0, 0, -1]); FOCUS.copy(V3(x, y, z)); FOCUS_R = 10; return c;
}
const HOMEB = (x, y, z) => [x, y - 40, z + 60]; // basement coords → home-set coords
const BX = 0, BY = -40, BZ = 60;
const S = [];
// cu(): camera on a horizontal circle around a look point; a = direction from the point to the camera (0 = from +z, PI/2 = from +x)
function cu(x, y, z, a, o = {}) { const d = o.d ?? 7.5, p = o.push ?? 0.5, dy = o.dy ?? 0.35, s = Math.sin(a), c = Math.cos(a); cam([x + s * d, y + dy, z + c * d], [x + s * (d - p), y + dy, z + c * (d - p)], [x, y, z], [x, y, z], o.fov ?? 42, o.e ?? easeInOut); }
// platform: Elias faces +x, his mother faces -x, both cheated toward the camera
const PE = [-5, 1.2, -17.2], PM = [-2.6, 1.2, -17.2];
function platformPair(T, eExpr, mExpr, o = {}) { pl(E17, PE[0], PE[1], PE[2], Math.PI / 2 - 0.3 + (o.er ?? 0)).idle(T, 0.4).expr(eExpr); pl(MOM, PM[0] + (o.mdx ?? 0), PM[1], PM[2], -Math.PI / 2 + 0.3 + (o.mr ?? 0)).idle(T, 0.4).expr(mExpr); }
const pTwo = (o = {}) => cu(o.x ?? -3.8, 5.0, PE[2], 0, { d: 8.6, fov: 56, dy: 0.8, ...o });
const cuE = (x = PE[0], o = {}) => cu(x, 5.55, PE[2], Math.PI / 2 - 0.95, o);
const cuM = (x = PM[0], o = {}) => cu(x, 5.55, PM[2], -(Math.PI / 2 - 0.95), o);
// basement: they face each other in front of the table
const BE = [0.5, BY, BZ + 4.4], BM = [-1.9, BY, BZ + 4.4];
const bTwo = (o = {}) => cu(-0.7, BY + 4.4, BZ + 4.4, 0, { d: 10.5, fov: 50, dy: 0.9, ...o });
const camE = (o = {}) => cu(BE[0], BY + 4.35, BE[2], -(Math.PI / 2 - 0.95), o);
const camM = (o = {}) => cu(BM[0], BY + 4.35, BM[2], Math.PI / 2 - 0.95, o);
// terminal: camera on the far side of the platform (-z)
const PEM = [-48.4, 1.2, -7], PLD = [-46.0, 1.2, -7];
const tTwo = (o = {}) => cu(-47.2, 5.0, -7, Math.PI, { d: 9.5, fov: 54, dy: 0.8, ...o });
const cuEt = (o = {}) => cu(PEM[0], 5.55, PEM[2], Math.PI / 2 + 0.95, o);
const cuL = (o = {}) => cu(PLD[0], 5.55, PLD[2], -(Math.PI / 2 + 0.95), o);

// ===================== SHOTS =====================
// --- the town's strangest rule ---
// 0 In this town, nobody is allowed to say goodbye.
S.push((u, T) => { use('town', 'autumn'); walkers(12, T); welcome.visible = true; welcome.position.copy(V3(-12, 0, 96)); welcome.rotation.y = 0.5; focus(0, 0, 0, 90); cam([10, 80, 175], [0, 48, 110], [0, 4, 20], [0, 8, -40], 50, easeOut); });
// 1 When children leave for school, their parents say, "See you later."
S.push((u, T, D, LD) => { use('town', 'autumn'); TN.car.position.z = 90; walkers(8, T, { seed: 3, avoid: { x: -9, z: 32, r: 9 } }); pl(folk[1], -10.6, 0.32, 37.5, Math.PI - 0.15).idle(T).talk('smile', T, T > wt('see') - 0.1 && T < LD); folk[1].armR.rotation.set(-2.5 + 0.3 * Math.sin(T * 9), 0, 0.3); pl(kid, -8.6, 0.32, 34.5 - T * 1.5, Math.PI).walk(T * 7, 0.9).expr('happy'); kid.armL.rotation.set(-2.4 + 0.3 * Math.sin(T * 8), 0, -0.3); focus(-9.5, 0, 33, 25); cam([-6.6, 4.6, 24.2], [-6.8, 4.6, 25.0], [-9.4, 3.6, 34], [-9.4, 3.6, 34], 46); });
// 2 When couples break up, they say, "Until next time."
S.push((u, T, D, LD) => { use('town', 'overcast'); walkers(6, T, { seed: 5, avoid: { x: -9, z: 12, r: 9 } }); const a = folk[2], b = folk[5]; const tu = wt('until'); pl(a, -9.4, 0.32, 13.2, Math.PI - 0.55).idle(T).talk('sad', T, T > tu - 0.1 && T < LD); const g = T > tu + 0.6; pl(b, -9.4, 0.32, 10.6 - Math.max(0, T - tu - 0.6) * 1.8, g ? Math.PI - 0.3 : 0.55).walk(g ? T * 5 : 0, 0.8).expr('sad'); focus(-9, 0, 12, 20); cam([0.6, 4.9, 11.9], [0.0, 4.9, 11.9], [-9.4, 4.2, 11.9], [-9.4, 4.2, 11.9], 52); });
// 3 Even at funerals, people are forbidden from saying the word.
S.push((u, T) => { use('town', 'overcast', 'cine', 0.7); graves.visible = true; graves.position.copy(V3(16, 0, -72)); mourners.forEach((m, i) => { pl(m, 8 + (i % 4) * 2.6, 0, -64 - Math.floor(i / 4) * 2.4, Math.PI - 0.3 + i * 0.05).expr(i === 1 ? (T > 1.2 ? 'scared' : 'sad') : 'sad'); if (i < 5) { const ub = umbs[i]; ub.position.set(0, -0.9, 0); m.hold(ub); m.armR.rotation.x = -0.3; } }); mourners[1].armL.rotation.set(T > 1.2 ? -2.6 : 0, 0, 0.3); focus(12, 0, -68, 30); cam([11, 4.8, -80], [11.5, 4.9, -79], [12, 4, -65], [12, 4.2, -65], 48); });
// 4 Nobody knows exactly when the rule began.
S.push((u, T) => { use('town', 'dusk'); townNight(0.4, 0.5); focus(0, 0, -82, 40); cam([0, 16, -40], [0, 21, -60], [0, 24, -82], [0, 24.5, -82], 38); });
// 5 But everyone knows what happens when someone breaks it.
S.push((u, T) => { use('town', 'overcast', 'cine', 0.75); [0, 1, 2, 3, 4, 5, 6].forEach((i, k) => { pl(folk[i], -6 + k * 2.1, k % 2 ? 0 : 0, 6 - (k % 3) * 2.2, 0).expr('stare'); folk[i].look(0, 0); }); focus(0, 0, 4, 20); cam([0, 4.6, 22], [0, 4.6, 17], [0, 4.4, 4], [0, 4.5, 4], 46, easeIn); });
// 6 The person they say goodbye to disappears.
S.push((u, T, D, LD) => { use('town', 'overcast'); const a = folk[3], b = folk[8]; const td = wt('disappears'); pl(a, -1.3, 0, 6, Math.PI / 2 - 0.5).idle(T).talk(T > td + 0.4 ? 'confused' : 'sad', T, T < 0.9); a.armR.rotation.set(T < td + 0.3 ? -2.5 + 0.3 * Math.sin(T * 9) : -0.2, 0, 0.3); pl(b, 1.3, 0, 6, -Math.PI / 2 + 0.5).idle(T).expr('smile'); b.root.visible = T < td + 0.1 || (T < td + 0.45 && Math.sin(T * 70) > 0); focus(0, 0, 6, 15); cam([0, 5.0, 17.6], [0, 5.0, 16.8], [0, 4.4, 6], [0, 4.4, 6], 46); });
// 7 Not physically.
S.push((u, T) => { use('town', 'overcast'); const b = folk[8]; pl(b, 2.2, 0, 6.4, 0).idle(T).expr('worried'); b.armR.rotation.set(-2.2 + 0.3 * Math.sin(T * 8), 0, 0.3); focus(2, 0, 6, 15); cam([2.2, 4.8, 11.5], [2.2, 4.8, 10.6], [2.2, 4.6, 6.4], [2.2, 4.6, 6.4], 40); });
// 8 They disappear from everyone's memories.
S.push((u, T) => { use('town', 'overcast', 'cine', 0.7); walkers(12, T, { seed: 9 }); const b = folk[8]; pl(b, 0.5, 0, 6, 0.4).idle(T).expr('scared'); b.armR.rotation.set(-2.0 + 0.3 * Math.sin(T * 7), 0, 0.3); const a = folk[3]; pl(a, -2.8, 0, 3.5 - T * 2.2, Math.PI).walk(T * 6, 0.8).expr('neutral'); focus(0, 0, 4, 25); cam([4, 5, 16], [3, 5, 15], [0, 4, 4], [0, 4, 3], 46); });
// 9 Their photographs change.
S.push((u, T) => { use('home', 'interior'); const k = ease(seg(u, 0.25, 0.85)); card(PH.ruleWith, -9, 10, -9.25, 0, 0, 0, 4.3); const c2 = card(PH.ruleWithout, -9, 10, -9.22, 0, 0, 0, 4.3); c2.userData.f.transparent = true; c2.userData.f.opacity = k; c2.userData.b.visible = false; pt(0, -9, 12, -4, '#ffe2b0', 90); focus(-9, 0, -8, 15); camW(V3(-9, 10, lerp(-0.6, -1.3, ease(u))), V3(-9, 10, -9.3), 50); });
// 10 Their belongings vanish.
S.push((u, T) => { use('home', 'interior'); belongings.visible = true; belongings.position.copy(V3(-12, 0, 8)); belongings.children.forEach((m, i) => { const t0 = 0.25 + i * 0.12; m.visible = T < t0 || (T < t0 + 0.15 && Math.sin(T * 60) > 0); }); pt(0, -10, 10, 14, '#ffe2b0', 140); focus(-12, 0, 8, 15); cam([-6.5, 5, 17], [-7, 5, 16.4], [-11.4, 2.4, 8], [-11.4, 2.4, 8], 46); });
// 11 Even their names disappear from official records.
S.push((u, T) => { use('office', 'interior'); doc.visible = true; doc.position.copy(V3(-2.2, 3.84, -2.6)); doc.rotation.set(-Math.PI / 2, 0, 0.08); doc.userData.top.opacity = 1 - ease(seg(u, 0.4, 0.9)); pt(0, -2, 9, 0, '#fff1dc', 120); FOCUS.copy(V3(-2, 3.8, -2.6)); FOCUS_R = 8; camW(V3(-2.2, 10.4 - u * 0.6, -2.5), V3(-2.2, 3.85, -2.6), 50, [0, 0, -1]); });
// 12 And by the following morning, nobody remembers they ever existed.
S.push((u, T) => { use('town', 'autumn'); walkers(12, T, { seed: 13 }); const b = folk[8]; pl(b, 0, 0, 10, 0).idle(T, 0.5).expr('sad'); focus(0, 0, 0, 60); cam([0, 30, 60], [0, 18, 34], [0, 3, 0], [0, 4, 6], 48); });
// 13 For 17-year-old Elias, this was nothing more than an old superstition.
S.push((u, T) => { use('town', 'autumn'); const z = 42 - T * 3.2; walkers(10, T, { seed: 15, avoid: { x: -9, z: z - 4, r: 8 } }); pl(E17, -9.2, 0.32, z, Math.PI).walk(T * 6.5, 1).expr(T > wt('superstition') ? 'smirk' : 'smile'); focus(-9, 0, z, 20); cam([-6.0, 5.2, z - 8.5], [-6.2, 5.2, z - 8], [-9.2, 5.6, z], [-9.2, 5.6, z], 44); badge('ELIAS, 17', 'loop', -9.2, 8.8, z, T - wt('elias'), 0.85); });
// 14 Until the day his mother said goodbye.
S.push((u, T) => { use('st', 'overcast', 'cine', 0.7); pl(MOM, PM[0], PM[1], PM[2], -Math.PI / 2 + 0.45).idle(T, 0.4).expr('sad'); focus(-3, 0, -17, 20); cuM(PM[0], { d: 8.4, push: 1.0, e: ease }); });
// --- the boy who was forgotten ---
// 15 It happened at the train station.
S.push((u, T) => { use('st', 'overcast'); SN.setClock(10, 4, T * 6); for (let i = 0; i < 6; i++) { const f = folk[i]; const z = 40 - ((hash(i) * 30 + T * 3) % 30); pl(f, -12 + i * 4.6, 0, z, Math.PI).walk(T * 5 + i, 0.9); } focus(0, 0, 10, 50); cam([0, 9, 74], [0, 8, 60], [0, 14, 8], [0, 15, 8], 46, easeOut); });
// 16 Elias was leaving town for university.
S.push((u, T) => { use('st', 'overcast'); platformPair(T, 'smile', 'smile'); suitcase.position.set(0, 0, 0); E17.hold(suitcase, true); focus(-4, 0, -17, 25); pTwo(); });
// 17 His mother hugged him, kissed his forehead, and whispered something she had never said before.
S.push((u, T) => { use('st', 'overcast'); const k = ease(clamp(T / 0.7)); pl(E17, PE[0], PE[1], PE[2], Math.PI / 2 - 0.6).idle(T, 0.5).expr(T > 2.2 ? 'gentle' : 'smile'); E17.arms(-1.0 * k, 0, -1.0 * k, 0.4 * k); pl(MOM, lerp(PM[0], -3.0, k), PM[1], PM[2], -Math.PI / 2 + 0.7).idle(T, 0.4).expr('sadsmile'); MOM.arms(-1.1 * k, -0.4 * k, -1.1 * k, 0.4 * k); MOM.torso.rotation.x = 0.08 * k; MOM.look(T > 1.2 ? 0.15 : 0, 0); focus(-4, 0, -17, 20); pTwo({ x: -4.0, d: 8.4, fov: 52, push: 0.8 }); });
// 18 "Goodbye, Elias."
S.push((u, T, D, LD) => { use('st', 'overcast', 'cine', 0.8); pl(MOM, -3.4, PM[1], PM[2], -Math.PI / 2 + 0.6).idle(T, 0.3).talk('sad', T, T < LD); MOM.arms(-1.0, -0.4, -1.0, 0.4); pl(E17, PE[0], PE[1], PE[2], Math.PI / 2 - 0.25).idle(T, 0.3).expr('gentle'); focus(-4, 0, -17, 15); cu(-3.4, 5.55, PE[2], -(Math.PI / 2 - 1.2), { d: 7.5 }); });
// 19 The moment she spoke, the station clock stopped.
S.push((u, T) => { use('st', 'overcast', 'cine', 0.7); const ts = wt('stopped') + 0.1; const s = T < ts ? 20 + T * 1 : 20 + ts; SN.setClock(10, 9, Math.floor(s)); focus(5, 0, -15, 15); camW(V3(5.3, 7.2, lerp(-9.6, -10.6, ease(u))), V3(5, 7.3, -15.1), 30); });
// 20 His mother stepped backward.
S.push((u, T) => { use('st', 'overcast'); const k = ease(clamp(T / 0.8)); pl(MOM, lerp(-3.4, -1.6, k), PM[1], PM[2], -Math.PI / 2 + 0.3).walk(T < 0.8 ? T * 6 : 0, 0.5).expr('blank'); pl(E17, PE[0], PE[1], PE[2], Math.PI / 2 - 0.3).expr('confused'); E17.armR.rotation.set(-0.9 * (1 - k * 0.3), 0, 0.2); focus(-3, 0, -17, 20); pTwo({ x: -3.3, fov: 58 }); });
// 21 She stared at him like he was a stranger.
S.push((u, T) => { use('st', 'overcast', 'cine', 0.75); pl(MOM, -1.6, PM[1], PM[2], -Math.PI / 2 + 0.35).idle(T, 0.3).expr('stare'); focus(-2, 0, -17, 15); cuM(-1.6, { d: 7.0 }); });
// 22 Then she asked why he was holding her hand.
S.push((u, T, D, LD) => { use('st', 'overcast'); pl(MOM, -2.4, PM[1], PM[2], -Math.PI / 2 + 0.3).idle(T, 0.3).talk('confused', T, T > 0.4 && T < LD); MOM.armR.rotation.set(-0.7, 0, -0.1); MOM.look(0.35, 0); pl(E17, PE[0], PE[1], PE[2], Math.PI / 2 - 0.3).expr('worried'); E17.armR.rotation.set(-1.0, 0, 0.25); focus(-4, 0, -17, 15); pTwo({ x: -3.7 }); });
// 23 Elias thought she was joking.
S.push((u, T) => { use('st', 'overcast'); pl(E17, PE[0], PE[1], PE[2], Math.PI / 2 - 0.45).idle(T, 0.4).expr('smirk'); pl(MOM, -2.4, PM[1], PM[2], -Math.PI / 2 + 0.3).idle(T, 0.3).expr('confused'); focus(-5, 0, -17, 15); cuE(PE[0]); });
// 24 But when he returned home, his bedroom was gone.
S.push((u, T) => { use('home', 'interior'); const k = ease(seg(u, 0.05, 0.35)); HM.leaf.rotation.y = 1.6 * k; pl(E17, 18.6, 0, 8.4, Math.PI / 2).idle(T).expr(k > 0.7 ? 'shock' : 'neutral'); pt(0, 26, 12, 8, '#fff1c8', 170); pt(1, 10, 10, 12, '#ffe2b0', 80); focus(22, 0, 8, 14); cam([25.4, 6.2, 9.0], [24.9, 6.1, 8.9], [19, 4.9, 8.3], [19, 4.9, 8.3], 56); });
// 25 His father insisted they never had a son.
S.push((u, T, D, LD) => { use('home', 'interior'); pl(DAD, -1.4, 0, 10, Math.PI / 2 - 0.4).idle(T).talk('angry', T, T < LD); DAD.look(0, Math.sin(T * 7) * 0.12); DAD.arms(-0.9, 0.5, -0.9, -0.5); pl(E17, 1.4, 0, 10.4, -Math.PI / 2 + 0.4).idle(T).expr('scared'); pt(0, 0, 10, 16, '#ffe2b0', 180); focus(0, 0, 10, 20); cu(0, 4.4, 10.2, 0, { d: 11, fov: 48, dy: 0.8 }); });
// 26 His school had no record of him.
S.push((u, T) => { use('office', 'interior'); pl(folk[6], -3.6, 0, -0.6, 0.6).idle(T).expr('confused'); folk[6].look(0, Math.sin(T * 8) * 0.18); focus(0, 0, -3, 15); camW(V3(lerp(0.6, 0.3, ease(u)), 6.0, lerp(6.2, 5.0, ease(u))), V3(0, 5.9, -4.1), 40); pt(0, 0, 9, 3, '#e8f0ff', 140); });
// 27 And every family photograph showed his parents standing alone.
S.push((u, T) => { use('home', 'interior', 'cine', 0.65); famFrames(true); pt(0, 0, 13, -3, '#ffe2b0', 140); focus(0, 0, -8, 12); cam([-1.8, 9.6, -2.6], [1.8, 9.6, -2.6], [-1.6, 9.2, -8.6], [1.6, 9.2, -8.6], 34); });
// 28 Elias had been completely erased.
S.push((u, T) => { use('home', 'interior', 'cine', 0.7); famFrames(true); pl(DAD, -4, 2.1, 3.0, Math.PI).sit(); DAD.expr('neutral'); pl(MOM, 4, 2.1, 3.0, Math.PI).sit(); MOM.expr('neutral'); pl(E17, 0, 0, -5.5, 0).idle(T, 0.4).expr('sad'); pt(0, 0, 12, 2, '#ffe2b0', 160); focus(0, 0, 0, 20); cam([0, 9, 18], [0, 8.6, 15], [0, 4, -4], [0, 4, -4], 46); });
// 29 Except he was still standing there.
S.push((u, T) => { use('home', 'interior', 'cine', 0.8); famFrames(true); pl(E17, 0, 0, -5.5, 0).idle(T, 0.3).expr('scared'); pt(0, 0, 10, 0, '#ffe2b0', 120); focus(0, 0, -5, 12); cam([0, 5.2, -0.6], [0, 5.4, 4.5], [0, 4.9, -5.5], [0, 4.7, -5.5], 40, easeOut); });
// --- the people nobody remembers ---
// 30 That night, Elias returned to the train station.
S.push((u, T) => { use('st', 'night'); stationNight(); SN.setClock(10, 9, 20); pt(0, 0, 8, 22, '#ffc874', 200); const z = 32 - T * 3.4; pl(E17, 1, 0, z, Math.PI).walk(T * 6, 0.9).expr('worried'); focus(0, 0, 16, 40); cam([4, 3.2, z + 9], [3, 3.6, z + 8], [0, 9, 8], [0, 11, 8], 50, easeInOut, null); });
// 31 He noticed a door behind the ticket office.
S.push((u, T) => { use('hall', 'hallNight'); pl(E17, 2, 0, -4, Math.PI + 0.45).idle(T).expr('confused'); pt(0, -4, 12, -10, '#ffdcae', 200); pt(1, 6, 10, 4, '#c9d6ff', 120); focus(-2, 0, -10, 25); cam([6.2, 6.4, 5.5], [5.4, 6.2, 4.4], [-4.6, 4.6, -16], [-4.6, 4.6, -16], 46); });
// 32 It had no handle, only a small sign.
S.push((u, T) => { use('hall', 'hallNight', 'cine', 0.7); pt(0, -4.6, 9, -11, '#ffdcae', 160); focus(-4.6, 0, -15, 12); cam([-2.6, 4.6, -7.5], [-3.2, 4.8, -9.5], [-4.6, 4.6, -16.4], [-4.6, 5.2, -16.4], 40); });
// 33 LOST PASSENGERS.
S.push((u, T) => { use('hall', 'hallNight', 'cine', 0.8); pt(0, -4.6, 8, -12, '#ffdcae', 160); focus(-4.6, 0, -15, 10); camW(V3(-4.6, 6.0, lerp(-9.6, -10.6, easeOut(u))), V3(-4.6, 6.0, -16.1), 36); });
// 34 Inside, he discovered dozens of people living in what appeared to be an abandoned railway terminal.
S.push((u, T) => { use('term', 'terminal', 'cine', 0.7); termLights(); pax.forEach((p, i) => { const s = i % 2 ? 1 : -1; pl(p, -50 + i * 5.6, 1.2, s * (6.5 + (i % 3) * 1.6), s > 0 ? Math.PI : 0).idle(T + i).expr(i % 3 ? 'tired' : 'sad'); if (i % 4 === 0) { p.sit(); p.root.position.y = O.y + 0.7; } }); pl(E17, -52, 1.2, 7, 1.2).idle(T).expr('shock'); focus(-20, 0, 0, 60); cam([-58, 8, 9], [-56, 12, 6], [-20, 6, 0], [10, 10, 0], 52); });
// 35 An elderly woman approached him.
S.push((u, T) => { use('term', 'terminal'); termLights(); const x = lerp(-40, PLD[0], clamp(T / 1.6)); pl(LADY, x, 1.2, PLD[2], -Math.PI / 2 - (T > 1.6 ? 0.3 : 0)).walk(T < 1.6 ? T * 4 : 0, 0.6).expr('gentle'); pl(E17, PEM[0], PEM[1], PEM[2], Math.PI / 2 + 0.3).idle(T).expr('worried'); pt(4, -47, 7, -12, '#ffb45a', 160); focus(-47, 0, -7, 20); tTwo(); });
// 36 "Someone said goodbye to you, didn't they?"
S.push((u, T, D, LD) => { use('term', 'terminal'); termLights(); pl(LADY, PLD[0], PLD[1], PLD[2], -Math.PI / 2 - 0.4).idle(T, 0.4).talk('gentle', T, T < LD); pl(E17, PEM[0], PEM[1], PEM[2], Math.PI / 2 + 0.3).idle(T, 0.3).expr('worried'); pt(4, -49, 7, -11, '#ffb45a', 150); focus(-46, 0, -7, 15); cuL(); });
// 37 Elias nodded.
S.push((u, T) => { use('term', 'terminal'); termLights(); pl(E17, PEM[0], PEM[1], PEM[2], Math.PI / 2 + 0.4).idle(T, 0.3).expr('sad'); E17.look(Math.max(0, Math.sin(T * 7)) * 0.3, 0); pl(LADY, PLD[0], PLD[1], PLD[2], -Math.PI / 2 - 0.3).idle(T, 0.3).expr('gentle'); pt(4, -45, 7, -11, '#ffb45a', 150); focus(-48, 0, -7, 15); cuEt(); });
// 38 She explained that everyone there had been forgotten.
S.push((u, T) => { use('term', 'terminal', 'cine', 0.7); termLights(); pt(4, lerp(-34, 2, ease(u)), 8, 6, '#ffb45a', 240); pax.forEach((p, i) => { if (i > 9 || i === 5) return; pl(p, -40 + i * 4.2, 1.2, 9 + (i % 2) * 1.5, Math.PI).idle(T + i).expr(['sad', 'tired', 'blank'][i % 3]); if (i % 3 === 0) { p.sit(); p.root.position.y = O.y + 0.7; } }); focus(-22, 0, 9, 30); cam([-42, 10.5, -1.5], [-6, 10.5, -1.5], [-36, 4.2, 10], [0, 4.2, 10], 46); });
// 39 Some had been there for weeks.
S.push((u, T) => { use('term', 'terminal'); termLights(); pl(pax[5], -36, 0.7, 6.4, Math.PI).sit(); pax[5].expr('worried'); pt(4, -36, 5, 1, '#ffb45a', 140); focus(-36, 0, 6, 15); cu(-36, 4.05, 6.4, Math.PI - 0.2, { d: 7.5 }); });
// 40 Others for decades.
S.push((u, T) => { use('term', 'terminal'); termLights(); pl(pax[0], -52, 0.7, -6.2, 0).sit(); pax[0].expr('tired'); pt(4, -52, 5, -1, '#ffb45a', 140); focus(-52, 0, -6, 15); cu(-52, 4.05, -6.2, 0.2, { d: 7.5 }); });
// 41 But none of them could remember how they arrived in Bellwether.
S.push((u, T) => { use('term', 'terminal', 'cine', 0.7); termLights(); [[1, 9.8, -6.2, 0.35], [2, 12.0, -7.6, 0], [3, 14.2, -6.2, -0.35]].forEach(([i, x, z, r], k) => { pl(pax[i], x, 1.2, z, r).idle(T + k).expr('confused'); pax[i].look(0, Math.sin(T * 1.3 + k * 2) * 0.35); }); pt(4, 12, 7, -1, '#ffb45a', 160); focus(12, 0, -7, 20); cu(12, 4.4, -6.8, 0, { d: 12.5, fov: 56, dy: 0.9 }); });
// 42 Elias asked why they didn't simply leave.
S.push((u, T, D, LD) => { use('term', 'terminal'); termLights(); pl(E17, PEM[0], PEM[1], PEM[2], Math.PI / 2 + 0.3).idle(T).talk('confused', T, T < LD); E17.arms(-0.4, 0, -0.6 - 0.3 * Math.abs(Math.sin(T * 4)), 0.4); pl(LADY, PLD[0], PLD[1], PLD[2], -Math.PI / 2 - 0.3).idle(T).expr('gentle'); pt(4, -47, 7, -12, '#ffb45a', 160); focus(-47, 0, -7, 15); tTwo(); });
// 43 The woman pointed to the railway tracks.
S.push((u, T) => { use('term', 'terminal'); termLights(); pl(LADY, PLD[0], PLD[1], PLD[2], Math.PI / 2 - 0.15).idle(T).expr('sad'); LADY.armR.rotation.set(-1.45 * ease(clamp(T / 0.5)), 0, 0.1); pl(E17, PEM[0], PEM[1], PEM[2] + 0.4, Math.PI / 2 + 0.1).idle(T).expr('worried'); pt(4, -47, 7, -12, '#ffb45a', 160); focus(-40, 0, -4, 30); cam([-56, 6.6, -12.5], [-55.4, 6.6, -12], [-36, 3.8, -2], [-26, 3.4, 0], 46); });
// 44 They extended into the distance before disappearing beneath the earth.
S.push((u, T) => { use('term', 'night', 'cine', 0.6); termLights(); scene.fog.color.set('#56607a'); scene.fog.near = 25; scene.fog.far = 150; scene.background = new THREE.Color('#56607a'); pt(4, 100, 10, 4, '#b8c6e0', 700); pt(5, 170, 10, -4, '#b8c6e0', 700); focus(150, 0, 0, 90); cam([40, 3.2, 1.6], [130, 3.0, 1.6], [120, 1.5, 0], [240, 2, 0], 46, easeInOut); });
// 45 "Because every train that leaves this station comes back empty."
S.push((u, T) => { use('term', 'terminal', 'cine', 0.75); termLights(); TM.oldCar.position.set(lerp(40, 4, easeOut(clamp(T / 2.4))), 0, 0); steamAt(lerp(40, 4, easeOut(clamp(T / 2.4))), 7, 0, 0.8); focus(10, 0, 0, 30); cam([2, 3.2, 9], [2, 3.4, 8.6], [16, 4, 0], [10, 4.2, 0], 50); });
// 46 Elias noticed something strange.
S.push((u, T) => { use('term', 'terminal'); termLights(); pl(E17, -30, 1.2, 12, Math.PI - 0.3).idle(T).expr('confused'); E17.look(-0.1, 0.4 * ease(u)); pt(4, -29, 7, 6, '#ffb45a', 160); focus(-30, 0, 12, 15); cu(-30, 5.55, 12, Math.PI - 0.05, { d: 7.5 }); });
// 47 Along the walls were thousands of photographs.
S.push((u, T) => { use('term', 'terminal'); termLights(); pt(5, 0, 12, 14, '#ffd9a8', 400); focus(0, 0, 15, 50); cam([-40, 9, 6], [30, 9, 6], [-30, 10, 20.8], [40, 10, 20.8], 50); });
// 48 Every photograph showed a different group of people.
S.push((u, T) => { use('term', 'terminal'); termLights(); pt(5, -6, 10, 16, '#ffd9a8', 300); focus(-6, 0, 18, 20); cam([-12, 10, 14.5], [0, 10, 14.5], [-12, 10, 20.8], [0, 10, 20.8], 40); });
// 49 Except one face appeared in almost all of them.
S.push((u, T) => { use('term', 'terminal', 'cine', 0.75); pt(5, -4, 10, 17, '#ffd9a8', 250); focus(-4, 0, 19, 12); cam([-4, 10, 15.6], [-4, 10.2, 18.2], [-4, 10, 20.8], [-4, 10.2, 20.8], 40, easeIn); });
// 50 His own.
S.push((u, T) => { use('term', 'terminal', 'cine', 0.85); pl(E17, -30, 1.2, 12, 0.1).expr('shock'); pt(4, -30, 7, 18, '#ffd9a8', 160); focus(-30, 0, 12, 10); cu(-30, 5.75, 12, 0.1, { d: 6.4, push: 0.4 }); });
// --- the first revelation ---
// 51 Elias found a photograph dated 1961.
S.push((u, T) => photoInsert(PH.p1961, u, T, { d0: 5.6, d1: 4.6 }));
// 52 He was standing beside the station clock.
S.push((u, T) => photoInsert(PH.p1961, u, T, { d0: 3.2, d1: 2.4, l0: [0.3, 0.3], l1: [0.5, 0.4] }));
// 53 In another photograph from 1984, he was attending a wedding.
S.push((u, T) => photoInsert(PH.p1984, u, T, { d0: 5.2, d1: 4.4, rz: 0.04 }));
// 54 And in one dated 2003, he was holding a newborn baby.
S.push((u, T) => photoInsert(PH.p2003, u, T, { d0: 5.2, d1: 4.2, rz: -0.05 }));
// 55 He looked different in every picture.
S.push((u, T) => { use('term', 'records', 'cine', 0.6); const Y = 300; [PH.p1961, PH.p1984, PH.p2003].forEach((t, i) => card(t, (i - 1) * 0.35, Y + (1 - i) * 3.4, 0, 0, 0, (i - 1) * 0.04, 4)); pt(0, 0, Y + 3, 9, '#ffe6c0', 220); camW(V3(0, Y + lerp(1.2, -1.2, ease(u)), 12.5), V3(0, Y + lerp(1.2, -1.2, ease(u)), 0), 44); FOCUS.copy(V3(0, Y, 0)); FOCUS_R = 12; });
// 56 In the oldest, he appeared to be a man in his sixties.
S.push((u, T) => photoInsert(PH.p1961, u, T, { d0: 2.8, d1: 2.2, l0: [-0.6, 0.2], l1: [-0.62, 0.25] }));
// 57 In the newest, he was 17.
S.push((u, T) => photoInsert(PH.newest, u, T, { d0: 4.4, d1: 3.4, rz: 0.03 }));
// 58 Elias asked the elderly woman how this was possible.
S.push((u, T, D, LD) => { use('term', 'terminal'); termLights(); pl(E17, PEM[0], PEM[1], PEM[2], Math.PI / 2 + 0.3).idle(T).talk('worried', T, T < LD); pl(LADY, PLD[0], PLD[1], PLD[2], -Math.PI / 2 - 0.3).idle(T).expr('sad'); E17.arms(-1.0, 0.2, -1.0, -0.2); const c = card(PH.p1961, 0, 0, 0, 0, 0, 0, 1.1); c.removeFromParent(); E17.hold(c, true); c.position.set(0.5, -0.2, 0.4); c.rotation.set(-1.0, 0, 0); pt(4, -47, 7, -12, '#ffb45a', 160); focus(-47, 0, -7, 15); tTwo(); });
// 59 She brought him to a room filled with handwritten passenger records.
S.push((u, T) => { use('term', 'records'); const x = lerp(-63, -71, clamp(T / 2.2)); pl(LADY, x - 1.5, 0, -0.2, -Math.PI / 2 + 0.1).walk(T * 4, 0.6).expr('sad'); pl(E17, x + 1.6, 0, 1.6, -Math.PI / 2 + 0.15).walk(T * 4 + 1, 0.6).expr('worried'); pt(0, -81, 5.3, -1.6, '#ffcf80', 140); pt(1, -70, 10, 4, '#ffd9a8', 150); focus(-70, 0, 1, 25); cam([-86, 6.6, 3.2], [-85.2, 6.5, 3.0], [-68, 4.6, 0.6], [-69, 4.6, 0.6], 44); });
// 60 His name appeared hundreds of times.
S.push((u, T) => { use('term', 'records'); pt(0, -78, 8, 1, '#ffd9a8', 120); FOCUS.copy(V3(-78, 3.6, 0.2)); FOCUS_R = 8; camW(V3(-78 + lerp(-1.2, 0.6, ease(u)), 7.6, 1.6), V3(-78 + lerp(-1.0, 0.4, ease(u)), 3.63, 0.25), 40, [0, 0, -1]); });
// 61 Each entry contained a date, an age, and 2 words.
S.push((u, T) => { use('term', 'records'); pt(0, -78, 8, 1, '#ffd9a8', 120); FOCUS.copy(V3(-78, 3.6, 0.2)); FOCUS_R = 8; camW(V3(-79.2, 6.2, 0.7), V3(-79.0, 3.63, -0.4), 36, [0, 0, -1]); });
// 62 FAREWELL ACCEPTED.
S.push((u, T) => { use('term', 'records', 'cine', 0.75); pt(0, -78, 8, 1, '#ffd9a8', 120); FOCUS.copy(V3(-78, 3.6, 0.2)); FOCUS_R = 8; camW(V3(-77.2, lerp(9.4, 8.8, ease(u)), -0.4), V3(-77.2, 3.63, -0.6), 34, [0, 0, -1]); });
// 63 But something was wrong.
S.push((u, T) => { use('term', 'records', 'cine', 0.75); pl(E17, -78, 0, 4.0, Math.PI - 0.15).expr('worried'); E17.look(0.3, 0); pt(0, -75, 8, 0, '#ffcf80', 150); focus(-78, 0, 3, 10); cu(-78, 4.25, 4.0, Math.PI - 0.75, { d: 7.2 }); });
// 64-68 the ages, one Elias version per line, lined up along the back of the records room
S.push((u, T) => { use('term', 'records'); lineup(T, 1, -90, -7.2, 0, { ry: Math.PI / 2, dz: 3.6, pop: true }); badge('AGE 67', 'dark', -90, 7.6, -7.2, T - 0.2, 0.62); pt(0, -84, 8, -7.2, '#ffd9a8', 160); focus(-88, 0, -7.2, 20); cu(-90, 4.8, -7.7, Math.PI / 2, { d: 10, fov: 50, dy: 0.6 }); });
S.push((u, T) => { use('term', 'records'); lineup(T, 2, -90, -7.2, 0, { ry: Math.PI / 2, dz: 3.6 }); ES[1].root.scale.setScalar(pop(T, 0.25)); badge('AGE 54', 'dark', -90, 7.6, -3.6, T - 0.2, 0.62); pt(0, -84, 8, -3.6, '#ffd9a8', 160); focus(-88, 0, -3.6, 20); cu(-90, 4.8, -4.1, Math.PI / 2, { d: 10, fov: 50, dy: 0.6 }); });
S.push((u, T) => { use('term', 'records'); lineup(T, 3, -90, -7.2, 0, { ry: Math.PI / 2, dz: 3.6 }); ES[2].root.scale.setScalar(pop(T, 0.25)); badge('AGE 39', 'dark', -90, 7.6, 0.0, T - 0.2, 0.62); pt(0, -84, 8, 0.0, '#ffd9a8', 160); focus(-88, 0, 0.0, 20); cu(-90, 4.8, -0.5, Math.PI / 2, { d: 10, fov: 50, dy: 0.6 }); });
S.push((u, T) => { use('term', 'records'); lineup(T, 4, -90, -7.2, 0, { ry: Math.PI / 2, dz: 3.6 }); ES[3].root.scale.setScalar(pop(T, 0.25)); badge('AGE 25', 'dark', -90, 7.6, 3.6, T - 0.2, 0.62); pt(0, -84, 8, 3.6, '#ffd9a8', 160); focus(-88, 0, 3.6, 20); cu(-90, 4.8, 3.1, Math.PI / 2, { d: 10, fov: 50, dy: 0.6 }); });
S.push((u, T) => { use('term', 'records'); lineup(T, 5, -90, -7.2, 0, { ry: Math.PI / 2, dz: 3.6 }); ES[4].expr('shock'); ES[4].root.scale.setScalar(pop(T, 0.25)); badge('AGE 17', 'alert', -90, 7.6, 7.2, T - 0.2, 0.62); pt(0, -84, 8, 6, '#ffd9a8', 190); focus(-88, 0, 5, 20); cu(-90, 4.8, 6.7, Math.PI / 2, { d: 10, fov: 50, dy: 0.6 }); });
// 69 He wasn't growing older.
S.push((u, T) => { use('term', 'records', 'cine', 0.8); pl(E17, -90, 0, 7.2, Math.PI / 2 + 0.2).expr('shock'); pt(0, -84, 6, 6, '#ffd9a8', 150); focus(-89, 0, 7, 10); cu(-90, 4.5, 7.2, Math.PI / 2 + 0.2, { d: 6.8 }); });
// 70 Every time somebody said goodbye to him, he returned younger.
S.push((u, T) => { use('term', 'records', 'cine', 0.7); lineup(T, 5, -90, -7.2, 0, { ry: Math.PI / 2, dz: 3.6, expr: 'blank' }); pt(0, -82, 9, 0, '#ffd9a8', 220); focus(-88, 0, 0, 25); cam([-77, 5.2, 0], [-68, 6.2, 0], [-90, 4.4, 0], [-90, 4.2, 0], 50, easeOut); });
// 71 Elias rushed home and confronted his mother.
S.push((u, T) => { use('home', 'interiorNight'); famFrames(true); const x = lerp(12, 1.4, easeOut(clamp(T / 1.2))); pl(E17, x, 0, 10.4, -Math.PI / 2 + (T > 1.2 ? 0.4 : 0)).walk(T < 1.2 ? T * 9 : 0, 1.1).expr('angry'); pl(MOM, -1.3, 0, 10, lerp(0.3, Math.PI / 2 - 0.4, ease(seg(u, 0.4, 0.75)))).idle(T).expr('worried'); pt(0, -9, 6, 4, '#ffcf80', 160); pt(1, 3, 12, 16, '#ffe2b0', 170); focus(0, 0, 10, 20); cu(0, 4.4, 10.2, 0, { d: 11.5, fov: 50, dy: 0.9 }); });
// 72 At first, she pretended not to recognize him.
S.push((u, T) => { use('home', 'interiorNight'); pl(MOM, -1.3, 0, 10, Math.PI / 2 - 0.4 - 0.4 * ease(u)).idle(T, 0.4).expr('blank'); pl(E17, 1.4, 0, 10.4, -Math.PI / 2 + 0.4).idle(T).expr('angry'); pt(0, 2, 8, 15, '#ffcf80', 150); focus(-1.3, 0, 10, 10); cu(-1.3, 4.35, 10, Math.PI / 2 - 0.95, { d: 7.5 }); });
// 73 But when he showed her the photographs, she started crying.
S.push((u, T) => { use('home', 'interiorNight'); pl(E17, 1.4, 0, 10.4, -Math.PI / 2 + 0.35).idle(T).expr('angry'); E17.arms(-1.2, 0.2, -1.4, -0.2); const c = card(PH.p1961, 0, 0, 0, 0, 0, 0, 1.4); c.removeFromParent(); E17.hold(c); c.position.set(0, -0.2, 0.45); c.rotation.set(-0.4, 0, 0); pl(MOM, -1.3, 0, 10, Math.PI / 2 - 0.4).idle(T).expr(T > wt('crying') - 0.3 ? 'cry' : 'worried'); pt(0, 0, 8, 15, '#ffcf80', 180); focus(0, 0, 10, 12); cu(0.1, 4.3, 10.2, 0, { d: 10.5, fov: 48, dy: 0.8 }); });
// 74 She took him into the basement.
S.push((u, T) => { use('home', 'basement'); const k = clamp(T / 1.4); const step = j => [-11, BY + 1.2 + j * 1.4, BZ - 9 + j * 1.6]; const a = step(Math.max(0, 7 - 6 * k)), b = step(Math.min(8, 9 - 6 * k)); pl(MOM, a[0], a[1], a[2], Math.PI).walk(T * 5, 0.6).expr('cry'); pl(E17, b[0], b[1], b[2], Math.PI).walk(T * 5 + 1, 0.6).expr('worried'); pt(0, 2, BY + 11.5, BZ, '#ffd9a8', 260); pt(1, -8, BY + 8, BZ - 6, '#ffd9a8', 120); focus(-8, BY, BZ - 4, 20); camW(V3(-1.5, BY + 6.5, BZ - 11.5), V3(-11, BY + 7.5, BZ - 1), 50); });
// 75 Behind a locked cabinet were dozens of photo albums.
S.push((u, T) => { use('home', 'basement'); const k = ease(seg(u, 0.3, 0.8)); HM.padlock.visible = k < 0.05; HM.cabDoorL.rotation.y = -1.9 * k; HM.cabDoorR.rotation.y = 1.9 * k; pt(0, 4, BY + 9, BZ - 3, '#ffd9a8', 260); focus(4, BY, BZ - 10, 14); camW(V3(4, BY + 7.2, BZ + 3.6 - u), V3(4, BY + 5.8, BZ - 11.2), 50); });
// 76 Every album contained pictures of Elias.
S.push((u, T) => { use('home', 'basement'); albumPages(PH.pageBday); pt(0, 2, BY + 9, BZ + 2, '#ffd9a8', 140); FOCUS.copy(V3(2, BY + 3.6, BZ)); FOCUS_R = 10; camW(V3(2, BY + 10.5 - u, BZ + 2.2), V3(2, BY + 3.6, BZ + 0.2), 40, [0, 0, -1]); });
// 77 Different birthdays.
S.push((u, T) => { use('home', 'basement'); albumPages(PH.pageBday); pt(0, 2, BY + 9, BZ + 2, '#ffd9a8', 170); FOCUS.copy(V3(2, BY + 3.6, BZ)); FOCUS_R = 10; const x = lerp(0.4, 0.4, ease(u)); camW(V3(x, BY + lerp(11.2, 10.6, ease(u)), BZ + 0.35), V3(x, BY + 3.8, BZ + 0.3), 44, [0, 0, -1]); });
// 78 Different childhoods.
S.push((u, T) => { use('home', 'basement'); albumPages(PH.pageChild); pt(0, 2, BY + 9, BZ + 2, '#ffd9a8', 170); FOCUS.copy(V3(2, BY + 3.6, BZ)); FOCUS_R = 10; const x = lerp(0.4, 0.4, ease(u)); camW(V3(x, BY + lerp(11.2, 10.6, ease(u)), BZ + 0.35), V3(x, BY + 3.8, BZ + 0.3), 44, [0, 0, -1]); });
// 79 Different names.
S.push((u, T) => { use('home', 'basement'); albumPages(PH.pageNames); pt(0, 2, BY + 9, BZ + 2, '#ffd9a8', 170); FOCUS.copy(V3(2, BY + 3.6, BZ)); FOCUS_R = 10; const x = lerp(0.4, 3.6, ease(u)); camW(V3(x, BY + lerp(11.2, 10.6, ease(u)), BZ + 0.35), V3(x, BY + 3.8, BZ + 0.3), 44, [0, 0, -1]); });
// 80 In one photograph, he was a middle-aged man.
S.push((u, T) => photoInsert(PH.mid, u, T, { d0: 4.8, d1: 4.0 }));
// 81 In another, he was a teenager.
S.push((u, T) => photoInsert(PH.bday17, u, T, { d0: 4.8, d1: 4.0, rz: 0.04 }));
// 82 Then Elias found the oldest photograph.
S.push((u, T) => { use('home', 'basement'); pl(E17, 2, BY, BZ + 4.6, Math.PI).idle(T, 0.5).expr('worried'); E17.arms(-1.0, 0.2, -1.0, -0.2); const c = card(PH.oldest, 0, 0, 0, 0, 0, 0, 1.5); c.removeFromParent(); E17.hold(c); c.position.set(-0.8, -0.2, 0.6); c.rotation.set(-0.9, 0, 0.1); pt(0, 2, BY + 9, BZ + 2, '#ffd9a8', 180); focus(2, BY, BZ + 3, 12); cam([0.4, BY + 7.4, BZ - 1.4], [0.6, BY + 7.2, BZ - 1.0], [1.6, BY + 4.4, BZ + 4.4], [1.6, BY + 4.4, BZ + 4.4], 44); });
// 83 It showed a little girl standing beside an elderly man.
S.push((u, T) => photoInsert(PH.oldest, u, T, { d0: 5.4, d1: 4.6, light: '#ffd9a8' }));
// 84 The little girl was his mother.
S.push((u, T) => photoInsert(PH.oldest, u, T, { d0: 2.4, d1: 1.9, l0: [-0.2, -0.2], l1: [-0.25, -0.15], light: '#ffd9a8' }));
// 85 The elderly man was Elias.
S.push((u, T) => photoInsert(PH.oldest, u, T, { d0: 2.4, d1: 1.9, l0: [0.4, 0.1], l1: [0.45, 0.2], light: '#ffd9a8' }));
// 86 He turned toward her.
S.push((u, T) => { use('home', 'basement'); const k = ease(clamp(T / 0.7)); pl(E17, BE[0], BE[1], BE[2], lerp(Math.PI, -Math.PI / 2 + 0.35, k)).idle(T, 0.4).expr('shock'); pl(MOM, BM[0], BM[1], BM[2], Math.PI / 2 - 0.35).idle(T).expr('cry'); pt(0, 0, BY + 9, BZ + 10, '#ffd9a8', 190); focus(-0.7, BY, BZ + 4, 12); bTwo(); });
// 87 "Who am I?"
S.push((u, T, D, LD) => { use('home', 'basement', 'cine', 0.75); pl(E17, BE[0], BE[1], BE[2], -Math.PI / 2 + 0.45).idle(T, 0.3).talk('scared', T, T < LD); pl(MOM, BM[0], BM[1], BM[2], Math.PI / 2 - 0.35).idle(T, 0.3).expr('cry'); pt(0, -2, BY + 7, BZ + 10, '#ffd9a8', 150); focus(0.5, BY, BZ + 4, 10); camE(); });
// 88 His mother covered her mouth.
S.push((u, T) => { use('home', 'basement', 'cine', 0.75); pl(MOM, BM[0], BM[1], BM[2], Math.PI / 2 - 0.45).idle(T, 0.5).expr('cry'); MOM.armR.rotation.set(-2.5 * ease(clamp(T / 0.5)), 0, 0.5); pl(E17, BE[0], BE[1], BE[2], -Math.PI / 2 + 0.35).idle(T, 0.3).expr('scared'); pt(0, 1, BY + 7, BZ + 10, '#ffd9a8', 150); focus(-1.9, BY, BZ + 4, 10); camM(); });
// 89 And finally told him the truth.
S.push((u, T) => { use('home', 'basement', 'cine', 0.75); pl(MOM, BM[0], BM[1], BM[2], Math.PI / 2 - 0.45).idle(T, 0.4).expr('sad'); pl(E17, BE[0], BE[1], BE[2], -Math.PI / 2 + 0.35).idle(T, 0.3).expr('scared'); pt(0, 1, BY + 7, BZ + 10, '#ffd9a8', 150); focus(-1.9, BY, BZ + 4, 10); camM({ d: 7.2 }); });
// 90 "You're my father."
S.push((u, T, D, LD) => { use('home', 'basement', 'cine', 0.85); pl(MOM, BM[0], BM[1], BM[2], Math.PI / 2 - 0.45).idle(T, 0.3).talk('cry', T, T < LD); pt(0, 1, BY + 7, BZ + 10, '#ffd9a8', 150); focus(-1.9, BY, BZ + 4, 10); camM({ d: 6.6 }); });
// 91 Elias couldn't speak.
S.push((u, T) => { use('home', 'basement', 'cine', 0.85); pl(E17, BE[0], BE[1], BE[2], -Math.PI / 2 + 0.45).expr('shock'); pl(MOM, BM[0], BM[1], BM[2], Math.PI / 2 - 0.35).idle(T, 0.3).expr('cry'); pt(0, -2, BY + 7, BZ + 10, '#ffd9a8', 140); focus(0.5, BY, BZ + 4, 10); camE({ d: 6.6 }); });
// 92 She explained that he had died when she was 7.
S.push((u, T) => { use('home', 'interior', 'sepia', 0.8); famFrames(false); pl(GIRL, -12, 0, 2, 0.7).idle(T, 0.3).expr('sad'); pt(0, -10, 9, 6, '#fff1dc', 140); focus(-12, 0, 2, 12); cam([-7.6, 3.6, 7.2], [-8.2, 3.6, 6.6], [-12, 3.0, 2], [-12, 3.0, 2], 42); badge('1961', 'gold', -12, 4.6, 2, T - 0.3, 0.32); });
// 93 But the night of his funeral, she refused to say goodbye.
S.push((u, T) => { use('town', 'dusk', 'sepia', 0.85); townNight(0.6, 0.8); coffin.visible = true; coffin.position.copy(V3(12, 0, -70)); coffin.rotation.y = 0.3; mourners.forEach((m, i) => { if (i > 4) return; pl(m, 8 + i * 2.2, 0, -64 - (i % 2) * 1.4, Math.PI - 0.2).expr('sad'); const ub = umbs[i]; ub.position.set(0, -0.9, 0); m.hold(ub); m.armR.rotation.x = -0.3; }); pl(GIRL, 11.2, 0, -66.4, 0.2).expr('sad'); GIRL.look(0, Math.sin(T * 6) * 0.35); pt(0, 12, 8, -62, '#ffd9a8', 300); focus(12, 0, -68, 25); cam([12.5, 4.0, -75.5], [12.3, 4.0, -74.8], [11.6, 2.8, -66], [11.6, 3.0, -66], 46); });
// 94 The next morning, he was standing outside their house.
S.push((u, T) => { use('town', 'autumn', 'sepia', 0.8); pl(E54, 10.6, 0.32, 26, -Math.PI / 2).idle(T, 0.4).expr('blank'); pl(GIRL, 13.4, 0, 28.6, -Math.PI / 2).idle(T).expr('shock'); focus(12, 0, 26, 20); cam([1.5, 4.8, 29], [2.2, 4.8, 28.6], [11.5, 4.2, 26.6], [11.5, 4.2, 26.6], 46); });
// 95 Alive.
S.push((u, T) => { use('town', 'autumn', 'sepia', 0.85); pl(E54, 10.6, 0.32, 26, -Math.PI / 2 + 0.2).idle(T, 0.3).expr(T % 1.6 < 0.12 ? 'sleep' : 'blank'); focus(10.6, 0, 26, 10); cu(10.6, 4.65, 26, -Math.PI / 2 + 0.25, { d: 7 }); });
// 96 Except he was younger.
S.push((u, T) => { use('town', 'autumn', 'sepia', 0.8); card(PH.p1961, 8.6, 5.4, 23.6, 0, -1.2, 0, 2.2); pl(E54, 10.6, 0.32, 26, -Math.PI / 2).idle(T, 0.3).expr('blank'); focus(10, 0, 25, 12); cam([4.0, 5.4, 26.4], [4.4, 5.4, 26.2], [9.6, 5.1, 25], [9.6, 5.1, 25], 42); });
// 97 And nobody remembered his death.
S.push((u, T) => { use('town', 'autumn', 'sepia', 0.8); walkers(10, T, { seed: 17, avoid: { x: 9, z: 24, r: 8 } }); const z = 30 - T * 2.2; pl(E54, 9.2, 0.32, z, Math.PI).walk(T * 5, 0.8).expr('neutral'); pl(folk[2], 12.2, 0.32, z - 3, -2.6).idle(T).expr('happy'); folk[2].armR.rotation.set(-2.5 + 0.3 * Math.sin(T * 9), 0, 0.3); focus(10, 0, z - 2, 20); cam([5.6, 5.0, z - 10], [5.8, 5.0, z - 9.4], [9.8, 4.4, z - 1.5], [9.8, 4.4, z - 1.5], 46); });
// 98 Over the following decades, his age continued reversing whenever she said goodbye to him.
S.push((u, T, D) => { use('home', 'interior', 'memory', 0.7); const n = 4, per = D / n, k = Math.min(n - 1, Math.floor(T / per)), life = T - k * per; const e = [E54, E39, E25, E17][k]; pl(e, 1.4, 0, 9, -0.35).idle(T).expr('blank'); e.root.scale.setScalar(pop(life, 0.25)); pl(MOM, -1.4, 0, 9, 0.35).idle(T).expr('sad'); badge(['1961', '1984', '2003', '2009'][k], 'gold', 0, 8.4, 9, life - 0.05, 0.7); pt(0, 0, 10, 16, '#ffe2b0', 220); focus(0, 0, 9, 15); cu(0, 4.8, 9, 0, { d: 11.5, fov: 48, dy: 0.6 }); });
// 99 His identity changed with every return.
S.push((u, T, D) => { use('home', 'interior', 'memory', 0.7); const names = ['THOMAS', 'HENRY', 'DANIEL', 'ELIAS']; const n = 4, per = D / n, k = Math.min(n - 1, Math.floor(T / per)), life = T - k * per; pl([E54, E39, E25, E17][k], 0, 0, 9, 0).idle(T).expr('blank'); badge(names[k], 'loop', 0, 8.0, 9, life - 0.05, 0.75); pt(0, 0, 10, 16, '#ffe2b0', 220); focus(0, 0, 9, 12); cu(0, 5.0, 9, 0, { d: 10, fov: 44, dy: 0.4 }); });
// 100 Eventually, he became younger than his own daughter.
S.push((u, T) => { use('home', 'interior'); pl(MOM, -1.6, 0, 9, 0.25).idle(T).expr('sadsmile'); pl(E17, 1.6, 0, 9, -0.25).idle(T + 1).expr('blank'); pt(0, 0, 10, 16, '#ffe2b0', 220); focus(0, 0, 9, 12); cam([0, 5.2, 17.6], [0, 5.2, 16.8], [0, 4.6, 9], [0, 4.6, 9], 46); });
// 101 And the town began treating him as her son.
S.push((u, T) => { use('town', 'autumn'); walkers(8, T, { seed: 19, avoid: { x: 9, z: 22, r: 9 } }); const z = 30 - T * 2.0; pl(MOM, 8.0, 0.32, z, Math.PI).walk(T * 5, 0.7).expr('smile'); pl(E17, 9.8, 0.32, z, Math.PI).walk(T * 5 + 1, 0.7).expr('neutral'); MOM.armL.rotation.set(-0.4, 0, 0.9); pl(folk[4], 12.4, 0.32, z - 4, -2.5).idle(T).expr('happy'); folk[4].armR.rotation.set(-2.5 + 0.3 * Math.sin(T * 9), 0, 0.3); focus(9, 0, z - 2, 20); cam([3.6, 5.2, z - 12], [3.9, 5.2, z - 11.5], [9.6, 4.4, z - 1.5], [9.6, 4.4, z - 1.5], 48); });
// --- the third revelation ---
// 102 Elias asked why she kept saying goodbye if she knew what would happen.
S.push((u, T, D, LD) => { use('home', 'basement'); pl(E17, BE[0], BE[1], BE[2], -Math.PI / 2 + 0.35).idle(T).talk('angry', T, T < LD); E17.arms(-0.4, 0, -0.5 - 0.3 * Math.abs(Math.sin(T * 4)), 0.3); pl(MOM, BM[0], BM[1], BM[2], Math.PI / 2 - 0.35).idle(T).expr('cry'); pt(0, 0, BY + 9, BZ + 10, '#ffd9a8', 190); focus(-0.7, BY, BZ + 4, 12); bTwo(); });
// 103 His mother didn't answer.
S.push((u, T) => { use('home', 'basement', 'cine', 0.75); pl(MOM, BM[0], BM[1], BM[2], Math.PI / 2 - 0.4).idle(T, 0.3).expr('cry'); MOM.look(0.35 * ease(u), 0); pl(E17, BE[0], BE[1], BE[2], -Math.PI / 2 + 0.35).idle(T, 0.3).expr('angry'); pt(0, 1, BY + 7, BZ + 10, '#ffd9a8', 150); focus(-1.9, BY, BZ + 4, 10); camM(); });
// 104 Instead, she opened a small wooden box.
S.push((u, T) => { use('home', 'basement'); HM.lid.rotation.x = -1.9 * ease(seg(u, 0.2, 0.8)); pt(0, 5.6, BY + 8, BZ + 4, '#ffd9a8', 160); FOCUS.copy(V3(5.6, BY + 3.6, BZ + 1)); FOCUS_R = 8; camW(V3(5.6, BY + 7.4, BZ + 5.6), V3(5.6, BY + 4.0, BZ + 1.0), 40); });
// 105 Inside were dozens of train tickets.
S.push((u, T) => { use('home', 'basement'); HM.lid.rotation.x = -1.9; pt(0, 5.6, BY + 8, BZ + 3, '#ffd9a8', 140); FOCUS.copy(V3(5.6, BY + 4.5, BZ + 1)); FOCUS_R = 8; camW(V3(5.6, BY + 8.6 - u, BZ + 1.4), V3(5.6, BY + 4.5, BZ + 1.0), 34, [0, 0, -1]); });
// 106 Every ticket bore his name.
S.push((u, T) => { use('home', 'basement'); HM.lid.rotation.x = -1.9; pt(0, 5.6, BY + 8, BZ + 3, '#ffd9a8', 140); FOCUS.copy(V3(5.6, BY + 4.5, BZ + 1)); FOCUS_R = 8; camW(V3(5.3, BY + 6.0, BZ + 1.1), V3(5.3, BY + 4.5, BZ + 1.0), 30, [0, 0, -1]); });
// 107 But each had a different destination.
S.push((u, T) => { use('home', 'basement'); HM.lid.rotation.x = -1.9; HM.tickets.forEach((t, i) => { t.position.x = -0.9 + i * 0.36 * ease(u) * 1.0; t.rotation.z = (i - 3) * 0.12 * ease(u); }); pt(0, 5.6, BY + 8, BZ + 3, '#ffd9a8', 140); FOCUS.copy(V3(5.6, BY + 4.5, BZ + 1)); FOCUS_R = 8; camW(V3(5.6, BY + 7.0, BZ + 1.3), V3(5.6, BY + 4.5, BZ + 1.0), 36, [0, 0, -1]); });
// 108 The last ticket had been issued that morning.
S.push((u, T) => { use('home', 'basement'); ticketCard.visible = true; ticketCard.position.copy(V3(0, 300, 0)); ticketCard.rotation.set(0, 0, 0.03); ticketCard.scale.setScalar(2); pt(0, 0, 303, 5, '#ffe6c0', 160); FOCUS.copy(V3(0, 300, 0)); FOCUS_R = 6; camW(V3(-0.9, 299.7, lerp(5.2, 4.4, ease(u))), V3(-0.9, 299.7, 0), 40); });
// 109 Its destination was blank.
S.push((u, T) => { use('home', 'basement', 'cine', 0.75); ticketCard.visible = true; ticketCard.position.copy(V3(0, 300, 0)); ticketCard.rotation.set(0, 0, 0.03); ticketCard.scale.setScalar(2); pt(0, 0, 303, 5, '#ffe6c0', 160); FOCUS.copy(V3(0, 300, 0)); FOCUS_R = 6; camW(V3(-1.25, 299.85, lerp(3.0, 2.5, ease(u))), V3(-1.25, 299.85, 0), 36); });
// 110 Elias noticed something written on the back.
S.push((u, T) => { use('home', 'basement'); ticketCard.visible = true; ticketCard.position.copy(V3(0, 300, 0)); ticketCard.rotation.set(0, Math.PI * ease(seg(u, 0.3, 0.9)), 0.03); ticketCard.scale.setScalar(2); pt(0, 0, 303, 5, '#ffe6c0', 140); pt(1, 0, 303, -5, '#ffe6c0', 140); FOCUS.copy(V3(0, 300, 0)); FOCUS_R = 6; camW(V3(0, 300, 4.2), V3(0, 300, 0), 40); });
// 111 FINAL DEPARTURE. NO RETURN SERVICE.
S.push((u, T) => { use('home', 'basement', 'cine', 0.8); ticketCard.visible = true; ticketCard.position.copy(V3(0, 300, 0)); ticketCard.rotation.set(0, Math.PI, -0.03); ticketCard.scale.setScalar(2); pt(1, 0, 303, 6, '#ffe6c0', 180); FOCUS.copy(V3(0, 300, 0)); FOCUS_R = 8; camW(V3(0, 300, lerp(9.4, 8.8, ease(u))), V3(0, 300, 0), 40); });
// 112 His mother began shaking.
S.push((u, T) => { use('home', 'basement', 'cine', 0.75); pl(MOM, BM[0], BM[1], BM[2], Math.PI / 2 - 0.5).idle(T).expr('cry'); MOM.root.rotation.z = Math.sin(T * 34) * 0.018; MOM.arms(-0.9 + Math.sin(T * 30) * 0.05, 0.3, -0.9, -0.3); pt(0, 1, BY + 7, BZ + 10, '#ffd9a8', 150); focus(-1.9, BY, BZ + 4, 10); cu(BM[0], BY + 4.0, BM[2], 0.55, { d: 8.4, fov: 44 }); });
// 113 She confessed that the people in the railway terminal weren't simply forgotten.
S.push((u, T) => { use('term', 'terminal', 'cine', 0.7); termLights(); const spots = [[-44, -1.9], [-44, 1.9], [-47.5, -3.8], [-47.5, 0], [-47.5, 3.8], [-51, -1.9], [-51, 1.9], [-54.5, -3.8], [-54.5, 0], [-54.5, 3.8]]; pax.forEach((p, i) => { if (i >= spots.length) return; const [x, z] = spots[i]; pl(p, x, 0, z, Math.PI / 2 + (i % 3 - 1) * 0.12).idle(T + i, 0.3).expr('blank'); }); pt(4, -38, 7, 0, '#ffb45a', 220); pt(5, -50, 8, 0, '#ffb45a', 160); focus(-48, 0, 0, 20); cam([-31.5, 5.4, 0.4], [-33.5, 5.3, 0.3], [-47, 4.6, 0], [-47, 4.6, 0], 50); });
// 114 They were people who had already reached the end of their lives.
S.push((u, T) => { use('term', 'terminal'); termLights(); pl(LADY, PLD[0], PLD[1], PLD[2], -0.4).idle(T, 0.3).expr('sadsmile'); pt(4, -47, 7, -1, '#ffb45a', 150); focus(-46, 0, -7, 10); cu(PLD[0], 5.55, PLD[2], -0.15, { d: 7.2 }); });
// 115 People who had been brought back because someone couldn't accept losing them.
S.push((u, T) => { use('term', 'terminal'); termLights(); pl(pax[9], -36, 0.7, 6.4, Math.PI).sit(); pax[9].expr('sad'); pax[9].arms(-1.2, 0.3, -1.2, -0.3); const c = card(PH.group[2], 0, 0, 0, 0, 0, 0, 1.4); c.removeFromParent(); pax[9].hold(c); c.position.set(-0.7, -0.2, 0.6); c.rotation.set(-0.9, 0, 0); pt(4, -36, 6, 1, '#ffb45a', 150); focus(-36, 0, 6, 10); cu(-36, 3.7, 6.4, Math.PI - 0.15, { d: 8, fov: 44 }); });
// 116 And every time someone said goodbye, the town returned them at an earlier point in their lives.
S.push((u, T, D) => { use('term', 'terminal', 'memory', 0.7); termLights(); const n = 5, per = D / n, k = Math.min(n - 1, Math.floor(T / per)), life = T - k * per; const e = ES[k]; pl(e, -20, 1.2, 8, Math.PI).idle(T).expr('blank'); e.root.scale.setScalar(pop(life, 0.22)); pt(4, -20, 6, 4, '#ffb45a', 140); focus(-20, 0, 8, 12); cam([-20, 5.4, 1.4], [-20, 5.4, 1.8], [-20, 5, 8], [-20, 5, 8], 42); });
// 117 But this couldn't continue forever.
S.push((u, T) => { use('hall', 'hallNight'); HN.wallClock.userData.set(11, 52, T * 6); pt(0, 0, 12, 10, '#ffdcae', 120); focus(0, 0, 14, 12); camW(V3(0.3, 13.4, lerp(10.4, 11.4, ease(u))), V3(0, 13.5, 16.6), 32); });
// 118 Eventually, they would become too young to remember who they were.
S.push((u, T) => { use('term', 'terminal'); termLights(); pl(kidChild, -32, 1.2, 9, Math.PI + 0.2).idle(T).expr('blank'); kidChild.look(0, Math.sin(T * 1.2) * 0.35); pt(4, -32, 5, 5, '#ffb45a', 120); focus(-32, 0, 9, 10); cam([-31, 3.4, 4.2], [-31.2, 3.4, 4.6], [-32, 2.8, 9], [-32, 2.8, 9], 40); });
// 119 And then they would disappear completely.
S.push((u, T) => { use('term', 'terminal', 'cine', 0.8); termLights(); const vis = T < 0.5 || (T < 1.2 && Math.sin(T * 50) > 0); if (vis) { pl(kidChild, -32, 1.2, 9, Math.PI + 0.2).expr('blank'); } pt(4, -32, 5, 5, '#ffb45a', 120); focus(-32, 0, 9, 10); cam([-31.2, 3.4, 4.6], [-31.2, 3.4, 4.6], [-32, 2.8, 9], [-32, 2.8, 9], 40); });
// 120 Elias looked at the ticket again.
S.push((u, T) => { use('home', 'basement'); pl(E17, BE[0], BE[1], BE[2], 0.25).idle(T, 0.4).expr('worried'); E17.look(0.45, 0); E17.arms(-1.1, 0.25, -1.1, -0.25); ticketCard.visible = true; ticketCard.scale.setScalar(0.8); ticketCard.removeFromParent(); E17.hold(ticketCard); ticketCard.position.set(-0.7, -0.2, 0.6); ticketCard.rotation.set(-0.9, 0, 0); pt(0, 1, BY + 8, BZ + 11, '#ffd9a8', 180); focus(0.5, BY, BZ + 4, 12); cu(0.5, BY + 3.6, BZ + 4.4, 0.25, { d: 8, fov: 46 }); });
// 121 For the first time, he understood.
S.push((u, T) => { use('home', 'basement', 'cine', 0.8); pl(E17, BE[0], BE[1], BE[2], 0.25).idle(T, 0.3).expr(T < 0.6 ? 'worried' : 'shock'); E17.look(lerp(0.45, 0, ease(clamp(T / 0.6))), 0); pt(0, 0, BY + 7, BZ + 11, '#ffd9a8', 150); focus(0.5, BY, BZ + 4, 10); cu(0.5, BY + 4.35, BZ + 4.4, 0.25, { d: 6.8 }); });
// 122 His mother hadn't accidentally said goodbye at the station.
S.push((u, T, D, LD) => { use('st', 'overcast', 'memory', 0.8); pl(E17, PE[0], PE[1], PE[2], Math.PI / 2 - 0.6).idle(T, 0.4); pl(MOM, -3.0, PM[1], PM[2], -Math.PI / 2 + 0.7).idle(T, 0.3); MOM.talk('sad', T, T > 0.5 && T < 1.6); MOM.arms(-1.0, -0.4, -1.0, 0.4); E17.expr('gentle'); E17.arms(-1.0, 0, -1.0, 0.4); focus(-4, 0, -17, 15); pTwo({ x: -4.0, d: 8.4, fov: 52 }); });
// 123 She had done it deliberately.
S.push((u, T) => { use('st', 'overcast', 'memory', 0.85); pl(MOM, -3.4, PM[1], PM[2], -Math.PI / 2 + 0.6).idle(T, 0.3).expr('determined'); MOM.arms(-1.0, -0.4, -1.0, 0.4); pl(E17, PE[0], PE[1], PE[2], Math.PI / 2 - 0.25).idle(T, 0.3).expr('gentle'); focus(-3, 0, -17, 10); cu(-3.4, 5.55, PM[2], -(Math.PI / 2 - 1.2), { d: 7.2 }); });
// --- the final twist ---
// 124 "Why?" he asked.
S.push((u, T, D, LD) => { use('home', 'basement', 'cine', 0.8); pl(E17, BE[0], BE[1], BE[2], -Math.PI / 2 + 0.45).idle(T, 0.3).talk('sad', T, T < 0.5); pl(MOM, BM[0], BM[1], BM[2], Math.PI / 2 - 0.35).idle(T, 0.3).expr('cry'); pt(0, -2, BY + 7, BZ + 10, '#ffd9a8', 140); focus(0.5, BY, BZ + 4, 10); camE({ d: 7 }); });
// 125 His mother began crying.
S.push((u, T) => { use('home', 'basement', 'cine', 0.8); pl(MOM, BM[0], BM[1], BM[2], Math.PI / 2 - 0.45).idle(T, 0.6).expr('sob'); MOM.body.position.y = Math.abs(Math.sin(T * 6)) * 0.08; pl(E17, BE[0], BE[1], BE[2], -Math.PI / 2 + 0.35).idle(T, 0.3).expr('sad'); pt(0, 1, BY + 7, BZ + 10, '#ffd9a8', 140); focus(-1.9, BY, BZ + 4, 10); camM(); });
// 126 "Because you asked me to."
S.push((u, T, D, LD) => { use('home', 'basement', 'cine', 0.85); pl(MOM, BM[0], BM[1], BM[2], Math.PI / 2 - 0.45).idle(T, 0.3).talk('cry', T, T < LD); pt(0, 1, BY + 7, BZ + 10, '#ffd9a8', 140); focus(-1.9, BY, BZ + 4, 10); camM({ d: 6.6 }); });
// 127 She handed him one final photograph.
S.push((u, T) => { use('home', 'basement'); const k = ease(seg(u, 0.15, 0.75)); pl(MOM, BM[0], BM[1], BM[2], Math.PI / 2 - 0.3).idle(T).expr('cry'); MOM.armR.rotation.set(-1.4 * k, 0, 0); pl(E17, BE[0], BE[1], BE[2], -Math.PI / 2 + 0.3).idle(T).expr('worried'); E17.armR.rotation.set(-1.3 * k, 0, 0); const a = MOM.handR.getWorldPosition(new THREE.Vector3()), b = E17.handR.getWorldPosition(new THREE.Vector3()); const c = card(PH.final, 0, 0, 0, -0.3, 0, 0, 1.3); c.position.lerpVectors(a, b, 0.5); c.position.y += 0.4; pt(0, 0, BY + 9, BZ + 10, '#ffd9a8', 190); focus(-0.7, BY, BZ + 4, 12); bTwo({ d: 9.6, fov: 48 }); });
// 128 It showed Elias standing outside the station.
S.push((u, T) => photoInsert(PH.final, u, T, { d0: 5.8, d1: 5.0, s: 3.6 }));
// 129 He looked almost identical to how he looked now.
S.push((u, T) => { use('home', 'basement', 'cine', 0.7); pl(E17, BE[0], BE[1], BE[2], 0.25).idle(T, 0.3).expr('stare'); E17.arms(-1.2, 0.3, -1.2, -0.3); const c = card(PH.final, 0, 0, 0, 0, 0, 0, 1.6); c.removeFromParent(); E17.hold(c, true); c.position.set(0.8, -0.1, 0.9); c.rotation.set(-0.15, 0.5, 0); pt(0, 1, BY + 7, BZ + 11, '#ffd9a8', 170); focus(0.5, BY, BZ + 4, 10); cu(0.5, BY + 3.9, BZ + 4.4, 0.25, { d: 8.4, fov: 44 }); });
// 130 On the back, written in his own handwriting, were the words:
S.push((u, T) => { use('home', 'basement'); const c = card(PH.final, 0, 300, 0, 0, Math.PI * ease(seg(u, 0.25, 0.85)), 0.02, 4, PH.backText); pt(0, 0, 303, 7, '#ffe6c0', 150); pt(1, 0, 303, -7, '#ffe6c0', 150); FOCUS.copy(V3(0, 300, 0)); FOCUS_R = 8; camW(V3(0, 300, 9.6), V3(0, 300, 0), 44); });
// 131 "When I come back, don't tell me who I am. Just let me live a normal life."
S.push((u, T) => { use('home', 'basement', 'cine', 0.72); card(PH.final, 0, 300, 0, 0, Math.PI, 0.02, 4, PH.backText); pt(1, 0, 303, 7, '#ffe6c0', 180); FOCUS.copy(V3(0, 300, 0)); FOCUS_R = 8; camW(V3(-0.45, 300.62, lerp(8.4, 7.6, ease(u))), V3(-0.45, 300.62, 0), 40); });
// 132 Below that was another message.
S.push((u, T) => { use('home', 'basement', 'cine', 0.72); card(PH.final, 0, 300, 0, 0, Math.PI, 0.02, 4, PH.backText); pt(1, 0, 303, 7, '#ffe6c0', 180); FOCUS.copy(V3(0, 300, 0)); FOCUS_R = 8; const y = lerp(300.62, 299.3, ease(u)); camW(V3(-0.45, y, 8.2), V3(-0.45, y, 0), 40); });
// 133 "And when the time comes, please let me go."
S.push((u, T) => { use('home', 'basement', 'cine', 0.72); card(PH.final, 0, 300, 0, 0, Math.PI, 0.02, 4, PH.backText); pt(1, 0, 303, 7, '#ffe6c0', 180); FOCUS.copy(V3(0, 300, 0)); FOCUS_R = 8; camW(V3(-0.45, 299.3, lerp(7.8, 7.0, ease(u))), V3(-0.45, 299.3, 0), 40); });
// 134 Elias realized that every time he returned, he eventually discovered the truth.
S.push((u, T, D) => { use('term', 'terminal', 'memory', 0.75); termLights(); const n = 3, per = D / n, k = Math.min(n - 1, Math.floor(T / per)), life = T - k * per; const e = [E54, E39, E25][k]; pl(e, -30, 1.2, 12, 0).idle(T).expr(life > 0.5 ? 'shock' : 'worried'); e.root.scale.setScalar(pop(life, 0.2)); pt(4, -30, 6, 17, '#ffd9a8', 150); focus(-30, 0, 12, 10); cu(-30, 5.55, 12, 0, { d: 7.5 }); });
// 135 And every time, he begged his daughter to release him.
S.push((u, T, D, LD) => { use('home', 'interior', 'memory', 0.75); pl(E39, 1.4, 0, 9.5, -1.2).idle(T).talk('sad', T, T < LD); E39.arms(-1.3, 0.3, -1.3, -0.3); pl(MOM, -2.0, 0, 9, 1.0).idle(T).expr('cry'); pt(0, 0, 10, 16, '#ffe2b0', 220); focus(0, 0, 9, 12); cam([0.2, 5.2, 18], [0.0, 5.2, 17.4], [-0.3, 4.6, 9.2], [-0.3, 4.6, 9.2], 44); });
// 136 But she couldn't.
S.push((u, T) => { use('home', 'interior', 'memory', 0.8); pl(MOM, -2.0, 0, 9, 0.5).idle(T).expr('sob'); MOM.look(0, Math.sin(T * 6) * 0.3); pt(0, 0, 10, 15, '#ffe2b0', 180); focus(-2, 0, 9, 10); cu(-2.0, 4.35, 9, 0.35, { d: 7.2 }); });
// 137 So she brought him back again.
S.push((u, T) => { use('st', 'overcast', 'memory', 0.75); pl(E25, 1, 0, 16 - T * 2, Math.PI).walk(T * 5, 0.7).expr('blank'); focus(0, 0, 14, 30); cam([6, 5, 30], [5, 5, 28], [0, 5, 12], [0, 5, 12], 44); });
// 138 And again.
S.push((u, T) => { use('st', 'overcast', 'memory', 0.75); pl(E17, -1, 0, 16 - T * 2, Math.PI).walk(T * 5, 0.7).expr('blank'); focus(0, 0, 14, 30); cam([-6, 5, 30], [-5, 5, 28], [0, 5, 12], [0, 5, 12], 44); });
// 139 Until this morning.
S.push((u, T) => { use('st', 'overcast', 'cine', 0.7); SN.setClock(10, 9, 20); pl(E17, PE[0], PE[1], PE[2], Math.PI / 2 - 0.6).idle(T, 0.4); pl(MOM, -3.0, PM[1], PM[2], -Math.PI / 2 + 0.7).idle(T, 0.3); MOM.expr('sad'); MOM.arms(-1.0, -0.4, -1.0, 0.4); E17.expr('gentle'); E17.arms(-1.0, 0, -1.0, 0.4); focus(-3, 0, -17, 25); cam([-2.0, 8.3, -8.5], [-2.4, 8.0, -9.0], [-3.6, 5.0, -17.2], [-3.6, 5.0, -17.2], 52); });
// 140 Elias looked at her.
S.push((u, T) => { use('hall', 'hallNight', 'cine', 0.7); pl(E17, 3.2, 1.1, 6, 0.4).sit(); pl(MOM, 5.0, 1.1, 6, -0.4).sit(); E17.expr('sad'); E17.look(0, -0.6 * ease(clamp(T / 0.6))); MOM.expr('cry'); pt(0, 4, 9, 13, '#ffdcae', 180); focus(4, 0, 6, 12); cam([4.1, 4.8, 15], [4.1, 4.8, 14.4], [4.1, 4.0, 6], [4.1, 4.0, 6], 44); });
// 141 "Then why didn't you let me leave?"
S.push((u, T, D, LD) => { use('hall', 'hallNight', 'cine', 0.75); pl(E17, 3.2, 1.1, 6, 0.4).sit(); E17.talk('sad', T, T < LD); E17.look(0, -0.3); pl(MOM, 4.5, 1.1, 6, -0.4).sit(); MOM.expr('cry'); MOM.torso.rotation.z = 0.12; pt(0, 3, 7, 12, '#ffdcae', 150); focus(3, 0, 6, 10); cu(3.2, 4.5, 6, -0.2, { d: 7.5 }); });
// 142 His mother whispered:
S.push((u, T) => { use('hall', 'hallNight', 'cine', 0.75); const k = ease(clamp(T / 0.8)); pl(E17, 3.2, 1.1, 6, 0.4).sit(); E17.expr('sad'); pl(MOM, lerp(5.0, 4.5, k), 1.1, 6, -0.4).sit(); MOM.expr('cry'); MOM.torso.rotation.z = 0.12 * k; pt(0, 4, 8, 12, '#ffdcae', 160); focus(4, 0, 6, 10); cam([3.9, 4.9, 13], [3.9, 4.9, 12.4], [3.9, 4.4, 6], [3.9, 4.4, 6], 40); });
// 143 "Because I was 7 when you died."
S.push((u, T, D, LD) => { use('hall', 'hallNight', 'cine', 0.82); pl(MOM, 4.5, 1.1, 6, -0.15).sit(); MOM.talk('cry', T, T < LD); MOM.torso.rotation.z = 0.1; pl(E17, 3.2, 1.1, 6, 0.4).sit(); E17.expr('sad'); pt(0, 6, 7, 12, '#ffdcae', 150); focus(4.2, 0, 6, 10); cu(4.2, 4.5, 6, 0.3, { d: 7.60 }); });
// 144 "And I thought if I could just keep you here long enough…"
S.push((u, T, D, LD) => { use('hall', 'hallNight', 'cine', 0.82); pl(MOM, 4.5, 1.1, 6, -0.15).sit(); MOM.talk('sob', T, T < LD); MOM.torso.rotation.z = 0.1; pl(E17, 3.2, 1.1, 6, 0.4).sit(); E17.expr('sad'); pt(0, 6, 7, 12, '#ffdcae', 150); focus(4.2, 0, 6, 10); cu(4.2, 4.5, 6, 0.3, { d: 7.15 }); });
// 145 "…eventually, I'd be old enough to lose you."
S.push((u, T, D, LD) => { use('hall', 'hallNight', 'cine', 0.82); pl(MOM, 4.5, 1.1, 6, -0.15).sit(); MOM.talk('smileTears', T, T < LD); MOM.torso.rotation.z = 0.1; pl(E17, 3.2, 1.1, 6, 0.4).sit(); E17.expr('sad'); pt(0, 6, 7, 12, '#ffdcae', 150); focus(4.2, 0, 6, 10); cu(4.2, 4.5, 6, 0.3, { d: 6.70 }); });
// 146 A train whistle echoed through the station.
S.push((u, T) => { use('st', 'night'); stationNight(); SN.train.visible = false; SN.trainNight.visible = true; steamAt(10, 8, -24, 1.4); pt(0, 0, 10, -14, '#ffc874', 160); focus(0, 0, 0, 50); cam([-24, 5, 46], [-22, 6, 42], [0, 14, -10], [0, 16, -10], 46); });
// 147 Elias turned toward the window.
S.push((u, T) => { use('hall', 'hallNight'); HN.winMat.emissiveIntensity = 0.6 + 1.6 * ease(seg(u, 0.1, 0.6)); HN.winMat.emissive.set('#ffd9a0'); const k = ease(clamp(T / 0.7)); pl(E17, 3.2, 1.1, 6, lerp(0.4, 1.2, k)).sit(); E17.expr('worried'); pl(MOM, 4.5, 1.1, 6, -0.4).sit(); MOM.expr('cry'); pt(0, 16, 9, 6, '#ffd9a0', 240 * k); focus(4, 0, 6, 12); cam([9.5, 5.8, 15.5], [9.1, 5.8, 15.0], [3.8, 4.4, 6], [3.8, 4.4, 6], 46); });
// 148 For the first time, a train was waiting at the platform.
S.push((u, T) => { use('st', 'night'); stationNight(); SN.train.visible = false; SN.trainNight.visible = true; steamAt(12, 6, -24, 1.2); pt(0, 0, 7, -14, '#ffc874', 200); pt(1, 20, 6, -18, '#ffcf80', 140); focus(0, 0, -16, 40); cam([-30, 4, -6], [-26, 4.4, -8], [0, 4, -22], [4, 4.2, -22], 46); });
// 149 His mother reached for his hand.
S.push((u, T) => { use('st', 'night', 'cine', 0.75); stationNight(); SN.train.visible = false; SN.trainNight.visible = true; const k = ease(seg(u, 0.1, 0.7)); pl(E17, PE[0], PE[1], PE[2], Math.PI / 2 - 0.3).idle(T, 0.4).expr('sad'); E17.armR.rotation.set(-0.8 * k, 0, 0.2); pl(MOM, PM[0], PM[1], PM[2], -Math.PI / 2 + 0.3).idle(T, 0.4).expr('cry'); MOM.armR.rotation.set(-0.9 * k, 0, -0.2); pt(0, -4, 7, -12, '#ffc874', 210); focus(-4, 0, -17, 15); pTwo({ d: 8.4, fov: 54 }); });
// 150 He smiled.
S.push((u, T) => { use('st', 'night', 'cine', 0.75); stationNight(); SN.train.visible = false; SN.trainNight.visible = true; pl(E17, PE[0], PE[1], PE[2], Math.PI / 2 - 0.45).idle(T, 0.3).expr(T > 0.2 ? 'smileTears' : 'sad'); pl(MOM, PM[0], PM[1], PM[2], -Math.PI / 2 + 0.3).idle(T, 0.3).expr('cry'); pt(0, -1, 7, -12, '#ffc874', 170); focus(-5, 0, -17, 10); cuE(PE[0], { d: 7.2 }); });
// 151 "See you later."
S.push((u, T, D, LD) => { use('st', 'night', 'cine', 0.75); stationNight(); SN.train.visible = false; SN.trainNight.visible = true; pl(E17, PE[0], PE[1], PE[2], Math.PI / 2 - 0.45).idle(T, 0.3).talk('smileTears', T, T < LD); pl(MOM, PM[0], PM[1], PM[2], -Math.PI / 2 + 0.3).idle(T, 0.3).expr('cry'); pt(0, -1, 7, -12, '#ffc874', 170); focus(-5, 0, -17, 10); cuE(PE[0], { d: 6.8 }); });
// 152 She shook her head.
S.push((u, T) => { use('st', 'night', 'cine', 0.75); stationNight(); SN.train.visible = false; SN.trainNight.visible = true; pl(MOM, PM[0], PM[1], PM[2], -Math.PI / 2 + 0.45).idle(T, 0.3).expr('cry'); MOM.look(0, Math.sin(T * 7) * 0.3); pl(E17, PE[0], PE[1], PE[2], Math.PI / 2 - 0.3).idle(T, 0.3).expr('smileTears'); pt(0, -6, 7, -12, '#ffc874', 170); focus(-3, 0, -17, 10); cuM(PM[0], { d: 7.2 }); });
// 153 "No, Dad."
S.push((u, T, D, LD) => { use('st', 'night', 'cine', 0.75); stationNight(); SN.train.visible = false; SN.trainNight.visible = true; pl(MOM, PM[0], PM[1], PM[2], -Math.PI / 2 + 0.45).idle(T, 0.3).talk('smileTears', T, T < LD); pl(E17, PE[0], PE[1], PE[2], Math.PI / 2 - 0.3).idle(T, 0.3).expr('smileTears'); pt(0, -6, 7, -12, '#ffc874', 170); focus(-3, 0, -17, 10); cuM(PM[0], { d: 6.8 }); });
// 154 Then, after almost 70 years, she finally said it.
S.push((u, T) => { use('st', 'night', 'cine', 0.75); stationNight(); SN.train.visible = false; SN.trainNight.visible = true; steamAt(14, 6, -24, 1.2); pl(E17, PE[0], PE[1], PE[2], Math.PI / 2 - 0.2).idle(T, 0.3).expr('smileTears'); E17.armR.rotation.set(-0.8, 0, 0.2); pl(MOM, PM[0], PM[1], PM[2], -Math.PI / 2 + 0.3).idle(T, 0.3).expr('smileTears'); MOM.armR.rotation.set(-0.9, 0, -0.2); pt(0, -5, 7, -11, '#ffc874', 220); focus(-4, 0, -18, 25); cam([-12.5, 7.0, -8.6], [-12.0, 6.9, -9.0], [-3.6, 5.0, -17.6], [-3.6, 5.0, -17.6], 50); });
// 155 "Goodbye."
S.push((u, T, D, LD) => { use('st', 'night', 'cine', 0.75); stationNight(); SN.train.visible = false; SN.trainNight.visible = true; pl(MOM, PM[0], PM[1], PM[2], -Math.PI / 2 + 0.45).idle(T, 0.3).talk('smileTears', T, T < LD); pt(0, -6, 7, -12, '#ffc874', 170); focus(-3, 0, -17, 10); cuM(PM[0], { d: 7.4, push: 0.9, e: ease }); });
// 156 The screen fades to black.
S.push((u, T) => { use('st', 'night', 'cine', 0.8); stationNight(); SN.train.visible = false; SN.trainNight.visible = true; SN.trainNight.position.x = -easeIn(clamp(T / 2.2)) * 40; steamAt(14 - easeIn(clamp(T / 2.2)) * 40, 6, -24, 1.3); pl(MOM, -2.6, PM[1], -18.4, Math.PI).expr('smileTears'); pt(0, -2, 7, -12, '#ffc874', 160); focus(0, 0, -18, 40); cam([-2.2, 6.6, -8.5], [-2.2, 6.8, -8.9], [-1.4, 5.0, -26], [-1.4, 5.0, -26], 56); fade(ease(seg(u, 0.25, 1))); });
// 157 But just before the video ends, we see the oldest photograph again.
S.push((u, T) => { photoInsert(PH.oldAlone, u, T, { d0: 6.2, d1: 5.4, grade: 'cine', light: '#ffd9a8' }); fade(1 - ease(seg(u, 0.1, 0.6))); });
// 158 The little girl is standing outside the station.
S.push((u, T) => photoInsert(PH.oldAlone, u, T, { d0: 3.2, d1: 2.6, l0: [-0.45, -0.2], l1: [-0.5, -0.15], light: '#ffd9a8' }));
// 159 Alone.
S.push((u, T) => photoInsert(PH.oldAlone, u, T, { d0: 2.2, d1: 1.8, l0: [-0.5, -0.1], l1: [-0.5, -0.1], light: '#ffd9a8' }));
// 160 And behind her, through one of the train windows, is an elderly man.
S.push((u, T) => { const c = photoInsert(PH.oldAlone, u, T, { d0: 3.0, d1: 1.6, l0: [-0.2, 0], l1: [0.75, 0.38], light: '#ffd9a8' }); });
// 161 It's Elias.
S.push((u, T) => photoInsert(PH.oldWindow, u, T, { d0: 3.0, d1: 2.2, l0: [0, 0.1], l1: [0, 0.15], light: '#ffd9a8' }));
// 162 He never returned from the train.
S.push((u, T) => { use('st', 'overcast', 'sepia', 0.85); SN.train.position.x = -easeIn(clamp(T / 1.6)) * 30 - 6; wpanel.visible = true; wpanel.position.copy(V3(6.5 + SN.train.position.x + 6, 4.6, -18.9)); pl(E67, 6.5 + SN.train.position.x + 6, 0.0, -20.8, 0).expr('sadsmile'); E67.armR.rotation.set(-2.4, 0, 0.3); pl(GIRL, 2, 1.2, -14.6, Math.PI).expr('sad'); GIRL.armR.rotation.set(-2.4 + 0.3 * Math.sin(T * 8), 0, -0.3); steamAt(SN.train.position.x + 34, 7, -24, 1.0); focus(0, 0, -18, 30); cam([2.2, 4.6, -9.6], [2.2, 4.8, -10.2], [2, 3.6, -22], [0, 3.6, -22], 46); });
// 163 He was never resurrected.
S.push((u, T) => { use('st', 'overcast', 'sepia', 0.85); SN.train.visible = false; pl(GIRL, 2, 1.2, -14.6, Math.PI).idle(T, 0.3).expr('sad'); focus(0, 0, -16, 40); cam([2, 6, -9.2], [2, 7.4, -9.6], [2, 3, -24], [2, 3, -24], 48, easeOut); });
// 164 Everything that happened in Bellwether was what his daughter imagined her life could have been if she had never lost him.
S.push((u, T) => { const k = ease(seg(u, 0.35, 0.95)); use('town', 'autumn', 'cine', 0.6); renderer.domElement.style.filter = `sepia(${0.85 * k}) saturate(${0.86 - 0.1 * k}) contrast(1.06) brightness(${1 - 0.07 * k})`; walkers(12, T, { seed: 23 }); pl(MOM, -9.4, 0.32, 20 - T * 1.2, Math.PI).walk(T * 4, 0.6).expr('smile'); pl(E17, -8.0, 0.32, 20 - T * 1.2, Math.PI).walk(T * 4 + 1, 0.6).expr('smile'); MOM.root.visible = E17.root.visible = u < 0.7; focus(0, 0, 0, 80); cam([0, 14, 44], [0, 60, 120], [-6, 4, 14], [0, 6, -30], 50, easeInOut); });
// 165 And the station?
S.push((u, T) => { use('st', 'dusk', 'cine', 0.8); stationNight(0.4, 0.8); SN.train.visible = false; focus(0, 0, 10, 50); cam([0, 6, 60], [0, 7, 52], [0, 14, 8], [0, 15, 8], 44); });
// 166 It was the last place she saw him alive.
S.push((u, T) => { use('st', 'dusk', 'sepia', 0.9); SN.train.visible = false; pl(GIRL, 2, 1.2, -18.6, Math.PI).idle(T, 0.3).expr('sad'); focus(2, 0, -20, 40); cam([2.6, 4.6, -8.5], [2.6, 4.6, -9.3], [2, 2.8, -40], [2, 2.8, -40], 46); fade(ease(seg(u, 0.75, 1))); });
// --- epilogue ---
// 167 A very old woman sits alone at a train station outside Bellwether.
S.push((u, T) => { use('st', 'cold', 'cold', 0.7); SN.train.visible = false; SN.modern.visible = true; for (const m of SETS.st.g.userData.lamps) m.emissiveIntensity = 0.6; pl(MOM2, 2.5, 2.2, -11.6, Math.PI).sit(); MOM2.expr('gentle'); focus(3, 0, -14, 30); cam([3, 6.4, -34], [3, 5.8, -30], [3, 5, -11.5], [3, 5, -11.5], 46); fade(1 - ease(seg(u, 0, 0.25))); });
// 168 She's holding a ticket printed with a date from 1961.
S.push((u, T) => { use('st', 'cold', 'cold', 0.7); SN.modern.visible = true; ticketCard.visible = true; ticketCard.userData.f.map = ticket1961; ticketCard.userData.f.needsUpdate = true; ticketCard.position.copy(V3(0, 300, 0)); ticketCard.rotation.set(0, 0, -0.04); ticketCard.scale.setScalar(2); pt(0, 0, 303, 5, '#eef4ff', 160); FOCUS.copy(V3(0, 300, 0)); FOCUS_R = 8; camW(V3(0, 300, lerp(11.6, 10.6, ease(u))), V3(0, 300, 0), 40); });
// 169 A conductor approaches and asks:
S.push((u, T) => { use('st', 'cold', 'cold', 0.7); SN.train.visible = false; SN.modern.visible = true; for (const m of SETS.st.g.userData.lamps) m.emissiveIntensity = 0.6; pl(MOM2, 2.5, 2.2, -11.6, Math.PI).sit(); MOM2.expr('gentle'); const w = T < 1.7; const x = lerp(-12, -0.2, easeOut(clamp(T / 1.7))); pl(COND, x, 1.2, -14.2, w ? Math.PI / 2 : 0.8).walk(w ? T * 5 : 0, 0.7).expr('neutral'); focus(1.5, 0, -13, 25); cam([0.8, 6.4, -27.5], [1.0, 6.3, -26.6], [1.0, 5.0, -13.4], [1.0, 5.0, -13.4], 48); });
// 170 "Are you waiting for somebody?"
S.push((u, T, D, LD) => { use('st', 'cold', 'cold', 0.7); SN.train.visible = false; SN.modern.visible = true; for (const m of SETS.st.g.userData.lamps) m.emissiveIntensity = 0.6; pl(MOM2, 2.5, 2.2, -11.6, Math.PI).sit(); MOM2.expr('gentle'); pl(COND, -0.2, 1.2, -14.2, 0.8).idle(T, 0.4).talk('gentle', T, T < LD); COND.torso.rotation.x = 0.12; focus(0, 0, -14, 10); cu(-0.2, 5.55, -14.2, 1.4, { d: 7 }); });
// 171 She answers:
S.push((u, T) => { use('st', 'cold', 'cold', 0.7); SN.train.visible = false; SN.modern.visible = true; for (const m of SETS.st.g.userData.lamps) m.emissiveIntensity = 0.6; pl(MOM2, 2.5, 2.2, -11.6, Math.PI).sit(); MOM2.expr('gentle'); MOM2.look(-0.2 * ease(u), 0.4 * ease(u)); pl(COND, -0.2, 1.2, -14.2, 0.8).idle(T, 0.3).expr('gentle'); focus(2.5, 0, -12, 10); cu(2.5, 5.55, -11.6, Math.PI + 0.15, { d: 7 }); });
// 172 "No. I think somebody's been waiting for me."
S.push((u, T, D, LD) => { use('st', 'cold', 'cold', 0.7); SN.train.visible = false; SN.modern.visible = true; for (const m of SETS.st.g.userData.lamps) m.emissiveIntensity = 0.6; pl(MOM2, 2.5, 2.2, -11.6, Math.PI).sit(); MOM2.talk('smileTears', T, T < LD); MOM2.look(-0.2, 0.4); focus(2.5, 0, -12, 10); cu(2.5, 5.55, -11.6, Math.PI + 0.15, { d: 6.3 }); });
// 173 And behind her, the station clock begins moving backward.
S.push((u, T, D, LD) => { use('st', 'cold', 'cold', 0.7); SN.train.visible = false; SN.modern.visible = true; for (const m of SETS.st.g.userData.lamps) m.emissiveIntensity = 0.6; pl(MOM2, 2.5, 2.2, -11.6, Math.PI).sit(); MOM2.expr('gentle'); const tb = Math.max(0, T - wt('backward') + 0.4); const mins = 11 * 60 + 47 - tb * tb * 40; SN.setClock(Math.floor(mins / 60), mins % 60, 0); focus(3.5, 0, -14, 15); cam([2.4, 5.6, -23], [2.6, 5.9, -20.5], [3.6, 6.4, -13.5], [4.0, 6.8, -14.5], 40, easeIn); fade(T > LD + 0.5 ? 1 : 0); });
// ---------- timeline ----------
async function loadTimeline() {
  const tl = await (await fetch('timeline.json')).json(); const words = await (await fetch('words.json')).json();
  LINEWORDS = tl.map(() => []); for (const w of words) LINEWORDS[w.line].push(w);
  const end = tl[tl.length - 1].end + 1.6;
  SHOTT = tl.map((m, i) => ({ start: i === 0 ? 0 : m.start, end: i < tl.length - 1 ? tl[i + 1].start : end, ld: m.end - m.start }));
  window.DURATION = end;
}
window.renderAt = (t) => {
  TT = t; let i = SHOTT.findIndex(s => t >= s.start && t < s.end); if (i < 0) i = t <= 0 ? 0 : SHOTT.length - 1; CUR = i;
  const s = SHOTT[i], D = s.end - s.start, T = t - s.start; U = clamp(T / D);
  resetAll(); cardIdx = 0; S[i](U, T, D, s.ld); updateSun(); renderer.render(scene, camera); return i;
};
window.shotCount = S.length;
await loadTimeline();
buildPhotos();
window.SHOTT = SHOTT; window.__pick = (x, y) => { const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(x, y), camera); const hit = rc.intersectObjects(scene.children, true).find(h => { let o = h.object; while (o) { if (!o.visible) return false; o = o.parent; } return true; }); if (!hit) return null; const o = hit.object; const c = o.material && o.material.color ? '#' + o.material.color.getHexString() : null; const p = new THREE.Vector3(); o.getWorldPosition(p); return { d: +hit.distance.toFixed(2), color: c, type: o.geometry && o.geometry.type, params: o.geometry && o.geometry.parameters, objPos: p.toArray().map(v => +v.toFixed(2)), point: hit.point.toArray().map(v => +v.toFixed(2)), cam: camera.position.toArray().map(v => +v.toFixed(2)) }; }; window.dumpPhotos = () => Object.fromEntries(Object.entries(PH).filter(([k, v]) => v && v.userData && v.userData.canvas).map(([k, v]) => [k, v.userData.canvas.toDataURL('image/jpeg', 0.8)]));
window.ready = true;
