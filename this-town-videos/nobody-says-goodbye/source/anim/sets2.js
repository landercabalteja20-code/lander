// Bellwether sets: station (exterior, platform, train), hall interior, Lost Passengers terminal + records room, home + basement, school office.
import { THREE, mat, newMat, basic, box, put, cyl, sphere, prism, plane, canvasTex, rr, rng } from './core.js';
import { makeClock } from './sets.js';

const tex = {};
export function signTex(text, bg, fg, font, w = 1024, h = 256, border = '#ffffff') {
  return canvasTex(w, h, (g) => { g.fillStyle = bg; rr(g, 6, 6, w - 12, h - 12, 24); g.fill(); if (border) { g.lineWidth = 10; g.strokeStyle = border; g.stroke(); } g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 6); });
}
function noiseTex(c1, c2, n = 900, size = 256, rep = [8, 8]) {
  return canvasTex(size, size, (g, w, h) => { g.fillStyle = c1; g.fillRect(0, 0, w, h); const R = rng(n); for (let i = 0; i < n; i++) { g.fillStyle = c2; g.globalAlpha = 0.05 + R() * 0.12; g.fillRect(R() * w, R() * h, 2 + R() * 10, 2 + R() * 10); } g.globalAlpha = 1; }, { repeat: rep });
}
function brickTex(base = '#8a4b3b', mortar = '#5e3328', rep = [6, 3]) {
  return canvasTex(256, 128, (g, w, h) => { g.fillStyle = mortar; g.fillRect(0, 0, w, h); const R = rng(3); for (let r = 0; r < 8; r++) for (let c = -1; c < 5; c++) { const x = c * 64 + (r % 2) * 32, y = r * 16; const k = 0.85 + R() * 0.25; const col = new THREE.Color(base).multiplyScalar(k); g.fillStyle = '#' + col.getHexString(); g.fillRect(x + 2, y + 2, 60, 12); } }, { repeat: rep });
}
const instanced = (geo, material, mats) => { const m = new THREE.InstancedMesh(geo, material, mats.length); mats.forEach((mm, i) => m.setMatrixAt(i, mm)); m.castShadow = true; m.receiveShadow = true; return m; };
const M4 = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));

export function bench(color = '#7a5232', metal = '#2f3238') {
  const b = new THREE.Group(); b.add(put(box(5, 0.35, 1.6, mat(color), 0.05), 0, 1.4, 0)); b.add(put(box(5, 1.2, 0.3, mat(color), 0.05), 0, 2.2, -0.7)); for (const s of [-2, 2]) b.add(put(box(0.3, 1.4, 1.4, mat(metal), 0.03), s, 0.7, 0)); return b;
}
export function oldLamp(on = 0) {
  const g = new THREE.Group(); g.add(put(cyl(0.16, 0.24, 7, mat('#23262c'), 8), 0, 3.5, 0));
  const m = newMat('#fff1cc', { emissive: '#ffc874', ei: on }); g.add(put(box(0.9, 1.1, 0.9, m, 0.15, false), 0, 7.4, 0)); g.add(put(box(1.1, 0.25, 1.1, mat('#23262c'), 0.05), 0, 8.05, 0)); g.userData.m = m; return g;
}
export function umbrella(color = '#151519') {
  const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.ConeGeometry(2.2, 0.9, 8, 1, true), new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide })); c.position.y = 2.6; c.castShadow = true; g.add(c); g.add(put(cyl(0.05, 0.05, 2.6, mat('#2a2a2a'), 5), 0, 1.3, 0)); return g;
}
export function makeCarriage(color = '#2e4a3c', night = false) {
  const g = new THREE.Group(); const win = newMat('#3a4a5c', { rough: 0.2, metal: 0.2, emissive: '#ffcf80', ei: night ? 1.0 : 0 }); g.userData.win = win;
  g.add(put(box(20, 5.6, 5, mat(color, { rough: 0.55 }), 0.4), 0, 4.1, 0));
  g.add(put(box(20.06, 0.5, 5.06, mat('#e8dcc0'), 0.1), 0, 5.6, 0));
  g.add(put(box(20, 0.6, 5.3, mat('#3a3b40'), 0.3), 0, 7.1, 0));
  g.userData.windows = [];
  for (const s of [-1, 1]) for (let k = 0; k < 6; k++) { const w = box(2.0, 1.7, 0.12, win, 0.05, false); w.position.set(-7.5 + k * 3, 4.6, s * 2.53); g.add(w); g.userData.windows.push(w); }
  for (const x of [-7, 7]) for (const s of [-1, 1]) { const wh = cyl(0.75, 0.75, 0.4, mat('#18181c'), 14); wh.rotation.x = Math.PI / 2; wh.position.set(x, 0.9, s * 2.1); g.add(wh); }
  g.add(put(box(18, 0.6, 4, mat('#1d1d22'), 0.1), 0, 1.3, 0));
  return g;
}
export function makeTrain(night = false) {
  const g = new THREE.Group(); g.userData.cars = [];
  const loco = new THREE.Group(); loco.add(put(box(13, 5.4, 4.6, mat('#1d1d22', { rough: 0.4, metal: 0.3 }), 0.4), 0, 3.9, 0));
  loco.add(put(box(13.05, 0.5, 4.65, mat('#a8251f'), 0.1), 0, 3.1, 0)); loco.add(put(box(4.5, 2.2, 4.8, mat('#1d1d22', { rough: 0.4, metal: 0.3 }), 0.3), -3.5, 7.6, 0));
  loco.add(put(cyl(0.6, 0.7, 2.6, mat('#111114'), 12), 4.5, 7.7, 0)); const lamp = newMat('#fff6d6', { emissive: '#fff0c0', ei: night ? 2.5 : 0.4 }); loco.add(put(cyl(0.7, 0.7, 0.3, lamp, 14), 6.6, 4.4, 0)); loco.children.at(-1).rotation.z = Math.PI / 2;
  for (const x of [-4, 0, 4]) for (const s of [-1, 1]) { const wh = cyl(1.0, 1.0, 0.4, mat('#18181c'), 14); wh.rotation.x = Math.PI / 2; wh.position.set(x, 1.1, s * 2.1); loco.add(wh); }
  loco.position.x = 34; g.add(loco);
  for (let i = 0; i < 3; i++) { const c = makeCarriage('#2e4a3c', night); c.position.x = 16 - i * 21; g.add(c); g.userData.cars.push(c); }
  g.userData.loco = loco; return g;
}
export function departuresTex(rows, modern = false) {
  return canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = '#0d0f12'; g.fillRect(0, 0, w, h); g.fillStyle = modern ? '#ff9a2e' : '#f2d35b'; g.font = '700 54px "JetBrains Mono", monospace, Poppins'; g.textBaseline = 'middle';
    g.fillText('DEPARTURES', 40, 56); g.fillRect(40, 96, w - 80, 4);
    rows.forEach((r, i) => { g.fillText(r[0], 40, 160 + i * 80); g.fillText(r[1], 260, 160 + i * 80); g.textAlign = 'right'; g.fillText(r[2], w - 40, 160 + i * 80); g.textAlign = 'left'; });
  });
}

// ---------- station: exterior, platform, tracks, train ----------
export function buildStation() {
  const G = new THREE.Group(); const N = G.userData.named = {}; G.userData.windows = []; G.userData.lamps = [];
  const ground = plane(600, 600, new THREE.MeshStandardMaterial({ color: '#8e8a84', map: noiseTex('#8e8a84', '#5e5a55', 1400, 256, [60, 60]), roughness: 0.95 })); ground.rotation.x = -Math.PI / 2; G.add(ground);
  const brick = new THREE.MeshStandardMaterial({ map: brickTex(), roughness: 0.9 });
  const B = N.building = new THREE.Group(); G.add(B);
  B.add(put(box(36, 13, 16, brick, 0.2), 0, 6.5, 0));
  B.add(put(box(36.6, 0.9, 16.6, mat('#efe4cc'), 0.1), 0, 13.3, 0)); B.add(put(box(36.6, 1.1, 16.6, mat('#6e6a66'), 0.1), 0, 0.55, 0));
  const roof = prism(17.6, 6, 37.6, mat('#3b3f4a')); roof.rotation.y = Math.PI / 2; roof.position.y = 13.7; B.add(roof);
  const tw = N.tower = new THREE.Group(); tw.position.set(0, 0, 6); B.add(tw);
  tw.add(put(box(8.5, 27, 8.5, new THREE.MeshStandardMaterial({ map: brickTex('#94523f', '#5e3328', [2, 6]), roughness: 0.9 }), 0.2), 0, 13.5, 0));
  tw.add(put(box(9.2, 1, 9.2, mat('#efe4cc'), 0.1), 0, 27.2, 0)); tw.add(put(box(9.2, 0.8, 9.2, mat('#efe4cc'), 0.1), 0, 15, 0));
  const pyr = new THREE.Mesh(new THREE.ConeGeometry(6.6, 7.5, 4), mat('#3b3f4a')); pyr.rotation.y = Math.PI / 4; pyr.position.y = 31.4; pyr.castShadow = true; tw.add(pyr);
  N.towerClock = makeClock(3.1); N.towerClock.position.set(0, 21, 4.38); tw.add(N.towerClock);
  tw.add(put(box(5, 7.5, 0.4, mat('#3b2a20'), 0.2), 0, 3.75, 4.3));
  const sgn = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 1.5), new THREE.MeshStandardMaterial({ map: signTex('BELLWETHER', '#1f2a24', '#efe4cc', '700 150px Poppins', 1024, 200, '#c9a227'), roughness: 0.7 })); sgn.position.set(0, 11.2, 4.38); tw.add(sgn);
  const winM = newMat('#3d4a5a', { rough: 0.25, metal: 0.2, emissive: '#ffc874', ei: 0 }); G.userData.windows.push(winM);
  for (const x of [-15, -10, 10, 15]) for (const y of [4.2, 10]) { B.add(put(box(2.6, y > 6 ? 3.4 : 4.6, 0.3, winM, 0.3, false), x, y, 8.08)); B.add(put(box(3.0, 0.3, 0.45, mat('#efe4cc'), 0.05), x, y - (y > 6 ? 1.85 : 2.45), 8.12)); }
  for (const x of [-15, -8, 0, 8, 15]) B.add(put(box(2.6, 4.6, 0.3, winM, 0.3, false), x, 4.6, -8.08));
  // forecourt dressing
  for (const x of [-22, 22]) { const l = oldLamp(); l.position.set(x, 0, 18); G.add(l); G.userData.lamps.push(l.userData.m); }
  for (const [x, z, c] of [[-40, 50, '#c9a98a'], [-20, 58, '#a9b8c8'], [0, 62, '#c8b48a'], [22, 56, '#b8a0a8'], [42, 48, '#a8b89a']]) { const h = 10 + (x % 3 + 3) * 2; G.add(put(box(14, h, 10, mat(c), 0.3), x, h / 2, z)); }
  for (const [x, z] of [[-30, 30], [30, 30], [-55, 25], [55, 22]]) { const t = new THREE.Group(); t.add(put(box(0.9, 4, 0.9, mat('#6a4a30'), 0.1), 0, 2, 0)); for (const [a, b, c, r, col] of [[0, 5.6, 0, 2.6, '#c9562d'], [1.3, 5, 0.5, 2, '#d9822b'], [-1.2, 5.1, -0.4, 2, '#e0b13a']]) t.add(put(sphere(r, mat(col, { rough: 0.9 }), 12, 9), a, b, c)); t.position.set(x, 0, z); G.add(t); }
  // platform + canopy
  G.add(put(box(130, 1.2, 12, new THREE.MeshStandardMaterial({ map: noiseTex('#b9b4aa', '#8a857c', 900, 256, [26, 3]), roughness: 0.9 }), 0.05), 0, 0.6, -14));
  G.add(put(box(130, 0.06, 0.45, mat('#e8c33a'), 0, false), 0, 1.24, -19.5));
  for (let x = -50; x <= 50; x += 10) G.add(put(cyl(0.22, 0.26, 7.6, mat('#2f4a3a'), 10), x, 5.0, -13.8));
  const can = box(112, 0.5, 9.5, mat('#2f4a3a'), 0.1); can.position.set(0, 8.9, -14.4); can.rotation.x = -0.05; G.add(can);
  G.add(put(box(112, 0.7, 0.2, mat('#efe4cc'), 0.05), 0, 8.5, -19.1));
  const pc = N.platformClock = new THREE.Group(); pc.position.set(5, 7.3, -15.4); G.add(pc);
  pc.add(put(cyl(1.55, 1.55, 0.5, mat('#1d1d22', { metal: 0.5, rough: 0.4 }), 28), 0, 0, 0)); pc.children[0].rotation.x = Math.PI / 2;
  N.clockA = makeClock(1.35); N.clockA.position.z = 0.27; pc.add(N.clockA); N.clockB = makeClock(1.35); N.clockB.position.z = -0.27; N.clockB.rotation.y = Math.PI; pc.add(N.clockB);
  pc.add(put(cyl(0.06, 0.06, 1.6, mat('#1d1d22'), 6), 0, 2.2, 0));
  N.setClock = (h, m, s = 0) => { N.clockA.userData.set(h, m, s); N.clockB.userData.set(h, m, s); N.towerClock.userData.set(h, m, s); };
  for (const x of [-24, -6, 12, 30]) { const b = bench(); b.position.set(x, 1.2, -11.5); b.rotation.y = Math.PI; G.add(b); }
  for (const x of [-40, -18, 18, 40]) { const l = oldLamp(); l.position.set(x, 1.2, -17.5); G.add(l); G.userData.lamps.push(l.userData.m); }
  const ps = new THREE.Group(); ps.add(put(box(0.25, 6, 0.25, mat('#2f4a3a'), 0.05), -3, 3, 0)); ps.add(put(box(0.25, 6, 0.25, mat('#2f4a3a'), 0.05), 3, 3, 0));
  const pst = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.5), new THREE.MeshStandardMaterial({ map: signTex('BELLWETHER', '#1f2a24', '#efe4cc', '700 150px Poppins', 1024, 200, '#efe4cc') })); pst.position.set(0, 5.6, 0.14); ps.add(pst);
  ps.position.set(-34, 1.2, -18.8); G.add(ps);
  // modern props for the epilogue (hidden by default)
  const modern = N.modern = new THREE.Group(); modern.visible = false; G.add(modern);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.5), new THREE.MeshBasicMaterial({ map: departuresTex([['11:47', 'NORTHGATE', 'ON TIME'], ['12:02', 'ASHFORD', 'DELAYED'], ['12:15', 'CARLOW', 'ON TIME']], true) }));
  board.position.set(10, 6.2, -10.2); board.rotation.y = Math.PI; modern.add(board); modern.add(put(box(7.4, 3.9, 0.4, mat('#1d1f24'), 0.1), 10, 6.2, -9.95));
  const mb = new THREE.Group(); mb.add(put(box(5, 0.25, 1.4, mat('#9aa3ad', { metal: 0.6, rough: 0.35 }), 0.05), 0, 1.4, 0)); mb.add(put(box(5, 1.1, 0.15, mat('#9aa3ad', { metal: 0.6, rough: 0.35 }), 0.05), 0, 2.1, -0.65)); for (const s of [-2, 2]) mb.add(put(box(0.2, 1.4, 1.2, mat('#5a6068', { metal: 0.6 }), 0.03), s, 0.7, 0)); mb.position.set(2.5, 1.2, -11.3); mb.rotation.y = Math.PI; modern.add(mb); N.modernBench = mb;
  // tracks (instanced sleepers)
  const sleepers = []; for (const z of [-24, -32]) for (let x = -400; x <= 400; x += 1.8) sleepers.push(M4(x, 0.12, z));
  G.add(instanced(new THREE.BoxGeometry(1.0, 0.25, 3.4), mat('#4a3a2c', { rough: 1 }), sleepers));
  for (const z of [-24, -32]) for (const s of [-0.75, 0.75]) G.add(put(box(800, 0.25, 0.22, mat('#8a8d92', { metal: 0.7, rough: 0.35 }), 0, false), 0, 0.38, z + s));
  const gravel = plane(800, 18, new THREE.MeshStandardMaterial({ map: noiseTex('#6d6a66', '#45423f', 1400, 256, [80, 2]), roughness: 1 })); gravel.rotation.x = -Math.PI / 2; gravel.position.set(0, 0.02, -28); G.add(gravel);
  N.train = makeTrain(false); N.train.position.set(0, 0, -24); G.add(N.train);
  N.trainNight = makeTrain(true); N.trainNight.position.set(0, 0, -24); N.trainNight.visible = false; G.add(N.trainNight);
  return G;
}

// ---------- station hall interior ----------
export function buildHall() {
  const G = new THREE.Group(); const N = G.userData.named = {};
  const floor = plane(50, 34, new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (g, w, h) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#d9d2c2' : '#a89f8e'; g.fillRect(x * 32, y * 32, 32, 32); } }, { repeat: [12, 8] }), roughness: 0.5 }));
  floor.rotation.x = -Math.PI / 2; G.add(floor);
  const wallM = mat('#e3d6bc', { rough: 0.95 }), wain = mat('#2f4a3a', { rough: 0.8 });
  for (const [w, x, z, ry] of [[50, 0, -17, 0], [50, 0, 17, 0], [34, -25, 0, Math.PI / 2], [34, 25, 0, Math.PI / 2]]) { G.add(put(box(w, 18, 0.6, wallM, 0, true), x, 9, z, ry)); G.add(put(box(w, 4, 0.75, wain, 0.05), x, 2, z, ry)); }
  G.add(put(box(50, 0.6, 34, mat('#cfc2a6'), 0, false), 0, 18.3, 0));
  for (const x of [-14, 0, 14]) G.add(put(box(8, 0.2, 20, basic('#dfe9f0'), 0, false), x, 17.9, 0));
  // ticket office
  const tk = N.ticket = new THREE.Group(); tk.position.set(-14, 0, -13.6); G.add(tk);
  tk.add(put(box(12, 9, 6, mat('#6b4a32', { rough: 0.7 }), 0.2), 0, 4.5, 0));
  tk.add(put(box(8, 3, 0.2, mat('#9fc0d0', { rough: 0.1, metal: 0.2, transparent: true, opacity: 0.6 }), 0.05, false), 0, 5.4, 3.05));
  const ts = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.2), new THREE.MeshStandardMaterial({ map: signTex('TICKETS', '#1f2a24', '#f2d35b', '700 140px Poppins', 1024, 200, '#c9a227') })); ts.position.set(0, 8, 3.12); tk.add(ts);
  // the door with no handle
  const dr = N.door = new THREE.Group(); dr.position.set(-4.6, 0, -16.6); G.add(dr);
  dr.add(put(box(5.4, 9.0, 0.3, mat('#efe4cc'), 0.05), 0, 4.5, 0));
  N.doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 8.2), basic('#0a0806')); N.doorGlow.position.set(0, 4.1, 0.17); dr.add(N.doorGlow);
  const leaf = N.leaf = new THREE.Group(); leaf.position.set(-2.2, 0, 0.3); dr.add(leaf);
  leaf.add(put(box(4.4, 8.2, 0.25, mat('#2b3d33', { rough: 0.6 }), 0.04), 2.2, 4.1, 0));
  for (const y of [2.2, 6.2]) leaf.add(put(box(3.4, 2.8, 0.06, mat('#24342b', { rough: 0.6 }), 0.04), 2.2, y, 0.14));
  const lp = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshStandardMaterial({ map: signTex('LOST PASSENGERS', '#b8963c', '#2a2016', '700 92px Poppins', 1024, 256, '#6a5320'), metalness: 0.5, roughness: 0.4 }));
  lp.position.set(2.2, 6.0, 0.2); leaf.add(lp); N.lpSign = lp;
  // departures board + benches + windows
  const db = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshBasicMaterial({ map: departuresTex([['21:40', 'NORTHGATE', 'CANCELLED'], ['22:05', 'ASHFORD', 'CANCELLED'], ['23:59', '- - - - -', '']]) }));
  db.position.set(10, 11, -16.6); G.add(db); G.add(put(box(10.6, 5.6, 0.3, mat('#1d1f24'), 0.1), 10, 11, -16.8));
  for (const [x, z] of [[4, -2], [14, -2], [4, 6], [14, 6], [-14, 4]]) { const b = bench(); b.position.set(x, 0, z); G.add(b); }
  N.winMat = newMat('#9fb6d8', { rough: 0.2, emissive: '#1b2a4a', ei: 0.6 });
  for (const z of [-8, 0, 8]) for (const s of [-1, 1]) { const w = box(0.3, 7, 3.2, N.winMat, 0.4, false); w.position.set(s * 24.6, 9, z); G.add(w); }
  const wc = makeClock(2.2); wc.position.set(0, 13.5, 16.65); wc.rotation.y = Math.PI; G.add(wc); N.wallClock = wc;
  return G;
}

// ---------- Lost Passengers terminal + records room ----------
export function buildTerminal() {
  const G = new THREE.Group(); const N = G.userData.named = {}; const R = rng(41);
  const floor = plane(124, 46, new THREE.MeshStandardMaterial({ map: noiseTex('#6f6a62', '#3e3a34', 1600, 256, [16, 6]), roughness: 1 })); floor.rotation.x = -Math.PI / 2; G.add(floor);
  for (const s of [-1, 1]) G.add(put(box(110, 1.2, 8, new THREE.MeshStandardMaterial({ map: noiseTex('#8d867a', '#5a544b', 900, 256, [20, 2]), roughness: 1 }), 0.05), 0, 0.6, s * 9));
  const sl = []; for (let x = -60; x <= 200; x += 1.8) sl.push(M4(x, 0.12, 0)); G.add(instanced(new THREE.BoxGeometry(1, 0.25, 3.4), mat('#3e3026', { rough: 1 }), sl));
  for (const s of [-0.75, 0.75]) G.add(put(box(260, 0.25, 0.22, mat('#6a6d72', { metal: 0.6, rough: 0.5 }), 0, false), 70, 0.38, s));
  const brick = new THREE.MeshStandardMaterial({ map: brickTex('#5a4038', '#2e221d', [14, 4]), roughness: 0.95 });
  for (const s of [-1, 1]) G.add(put(box(124, 26, 1.2, brick, 0, true), 0, 13, s * 21.5));
  G.add(put(box(1.2, 26, 44, brick, 0, true), -61.5, 13, 0));
  // end arch toward the tunnel (x = +62)
  for (const s of [-1, 1]) G.add(put(box(1.5, 26, 13, brick, 0, true), 62, 13, s * 15));
  G.add(put(box(1.5, 10, 18, brick, 0, true), 62, 21, 0));
  // roof: half-cylinder shell + trusses + broken skylights
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 124, 24, 1, true, 0, Math.PI), new THREE.MeshStandardMaterial({ color: '#2a2d33', roughness: 0.8, side: THREE.DoubleSide }));
  roof.rotation.set(0, 0, Math.PI / 2); roof.position.y = 26; G.add(roof);
  const tm = mat('#1d1f24', { metal: 0.6, rough: 0.5 });
  for (let x = -56; x <= 56; x += 8) { const t = new THREE.Mesh(new THREE.TorusGeometry(21.6, 0.35, 6, 32, Math.PI), tm); t.position.set(x, 26, 0); t.rotation.y = Math.PI / 2; G.add(t); }
  N.skylights = []; for (let k = 0; k < 9; k++) { const x = -48 + k * 12; if (k % 3 === 1) continue; const p = new THREE.Mesh(new THREE.PlaneGeometry(6, 9), basic('#5d76a8', { fog: false })); p.position.set(x, 47.6, 0); p.rotation.x = Math.PI / 2; G.add(p); N.skylights.push(p); }
  N.beams = []; for (const x of [-36, 0, 36]) { const c = new THREE.Mesh(new THREE.ConeGeometry(5, 46, 16, 1, true), basic('#9fb4e0', { transparent: true, opacity: 0.05, add: true, side: THREE.DoubleSide })); c.position.set(x, 24, 2); G.add(c); N.beams.push(c); }
  // photo walls (maps assigned later)
  N.photoWalls = []; for (const s of [-1, 1]) { const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }); const p = new THREE.Mesh(new THREE.PlaneGeometry(104, 13), m); p.position.set(-2, 10, s * 20.8); p.rotation.y = s > 0 ? Math.PI : 0; G.add(p); N.photoWalls.push(m); }
  // camp: tents, mattresses, crates, lanterns
  N.lanterns = [];
  const camp = [[-44, 10], [-30, -10], [-18, 11], [-4, -10], [10, 10], [24, -11], [38, 9], [-38, -9], [30, 12]];
  for (const [x, z] of camp) {
    const t = prism(5, 3.4, 6, mat(['#7a6a50', '#5d6b55', '#6b5050', '#55606e'][Math.floor(R() * 4)], { rough: 0.95 })); t.position.set(x, 1.2, z); G.add(t);
    G.add(put(box(3.4, 0.5, 2.2, mat(['#8e5a4a', '#4a5e7a', '#7a6a3a'][Math.floor(R() * 3)]), 0.2), x + 4, 1.45, z + (z > 0 ? -1.5 : 1.5)));
    G.add(put(box(1.4, 1.2, 1.4, mat('#6a4a2c'), 0.08), x - 3.6, 1.8, z));
    const l = basic('#ffbf66'); G.add(put(box(0.5, 0.7, 0.5, l, 0.1, false), x - 3.6, 2.75, z)); N.lanterns.push(V(x - 3.6, 3.2, z));
  }
  const oldCar = makeCarriage('#3a3a32', false); oldCar.position.set(-20, 0, 0); G.add(oldCar); N.oldCar = oldCar;
  // outside the arch: ground, tracks into the distance and down into a tunnel
  const out = plane(300, 120, mat('#1c1e22', { rough: 1 })); out.rotation.x = -Math.PI / 2; out.position.set(212, 0.01, 0); G.add(out);
  const hill = sphere(70, mat('#1a1d1a', { rough: 1 }), 24, 12); hill.scale.set(1, 0.55, 1.6); hill.position.set(300, -2, 0); hill.castShadow = false; G.add(hill);
  G.add(put(box(4, 10, 14, mat('#2a2622'), 0.1), 238, 5, 0)); G.add(put(box(4, 3, 14, mat('#2a2622'), 0.1), 238, 11, 0));
  G.add(put(box(3, 8.5, 10, basic('#000000'), 0, false), 239, 4.25, 0));
  // records room (west, beyond the end wall doorway)
  const rec = N.records = new THREE.Group(); rec.position.set(-80, 0, 0); G.add(rec);
  rec.add(put(box(36, 0.4, 30, mat('#5a4a3c', { rough: 1 }), 0), 0, -0.2, 0));
  for (const [w, x, z, ry] of [[30, 0, -12, 0], [30, 0, 12, 0], [24, -15, 0, Math.PI / 2]]) rec.add(put(box(w, 16, 0.8, mat('#4a3c32', { rough: 1 }), 0), x, 8, z, ry));
  const ledgers = []; const lc = ['#6b2a22', '#3a4a2a', '#2a3a5a', '#5a4022', '#4a2a3a'];
  for (const z of [-11.2, 11.2]) for (let sh = 0; sh < 6; sh++) { rec.add(put(box(26, 0.3, 1.4, mat('#3a2a1e'), 0.03), 0, 1 + sh * 2.4, z)); for (let k = 0; k < 40; k++) ledgers.push(M4(-12.5 + k * 0.62, 1.95 + sh * 2.4, z, 0, 0.5 + R() * 0.1, 1.4 + R() * 0.3, 1.1)); }
  rec.add(instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }), ledgers)); const im = rec.children.at(-1); ledgers.forEach((_, i) => im.setColorAt(i, new THREE.Color(lc[i % 5]))); im.instanceColor.needsUpdate = true;
  rec.add(put(box(9, 0.4, 5, mat('#5a3e28'), 0.1), 2, 3.4, 0)); for (const [x, z] of [[-1.8, -2], [5.8, -2], [-1.8, 2], [5.8, 2]]) rec.add(put(box(0.4, 3.2, 0.4, mat('#4a3020'), 0.05), x, 1.6, z));
  N.ledgerMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 3.2), new THREE.MeshStandardMaterial({ map: ledgerTex(), roughness: 0.9 })); N.ledgerMesh.rotation.x = -Math.PI / 2; N.ledgerMesh.position.set(2, 3.63, 0.2); rec.add(N.ledgerMesh);
  rec.add(put(box(5.0, 0.15, 3.4, mat('#5a2a22'), 0.05), 2, 3.55, 0.2));
  rec.add(put(cyl(0.12, 0.2, 1.6, mat('#2a2a2a'), 8), -1, 4.4, -1.6)); rec.add(put(cyl(0.5, 0.8, 0.6, newMat('#2a4a2a', { emissive: '#ffd27a', ei: 0.4 }), 12), -1, 5.3, -1.6));
  // doorway in the end wall
  G.add(put(box(1.4, 9, 6, basic('#120e0b'), 0, false), -61.5, 4.5, 0));
  return G;
}
function V(x, y, z) { return new THREE.Vector3(x, y, z); }
export function ledgerTex() {
  return canvasTex(1024, 680, (g, w, h) => {
    g.fillStyle = '#efe3c4'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(120,90,40,0.12)'; g.fillRect(w / 2 - 6, 0, 12, h);
    g.strokeStyle = 'rgba(80,110,150,0.35)'; g.lineWidth = 2; for (let y = 90; y < h; y += 58) { g.beginPath(); g.moveTo(20, y); g.lineTo(w - 20, y); g.stroke(); }
    g.fillStyle = '#2a2a4a'; g.font = '34px "Permanent Marker"';
    g.fillText('PASSENGER RECORDS', 40, 60); g.fillText('No. 98', w / 2 + 40, 60);
    const rows = [['1961', 'ELIAS', '67'], ['1984', 'ELIAS', '54'], ['1998', 'ELIAS', '39'], ['2009', 'ELIAS', '25'], ['2026', 'ELIAS', '17']];
    g.font = '30px "Permanent Marker"';
    rows.forEach((r, i) => { const y = 135 + i * 58 * 1.85; g.fillStyle = '#2a2a4a'; g.fillText(r[0], 40, y); g.fillText(r[1], 170, y); g.fillText('AGE ' + r[2], 330, y); g.fillStyle = '#8a1f1f'; g.fillText('FAREWELL ACCEPTED', w / 2 + 40, y); });
  });
}
export function ticketTex(dest, date = 'NOV 13 2026', name = 'ELIAS', blank = false) {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#f1e2b8'; rr(g, 4, 4, w - 8, h - 8, 18); g.fill(); g.strokeStyle = '#8a6a3a'; g.lineWidth = 6; g.stroke();
    g.setLineDash([8, 8]); g.beginPath(); g.moveTo(380, 10); g.lineTo(380, h - 10); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#5a3a1a'; g.font = '700 30px Poppins'; g.fillText('BELLWETHER RAILWAY', 24, 46);
    g.font = '700 26px Poppins'; g.fillText('PASSENGER: ' + name, 24, 104); g.fillText('TO: ' + (blank ? '' : dest), 24, 150); g.fillText(date, 24, 196);
    g.font = '700 22px Poppins'; g.fillText('ADMIT', 398, 110); g.fillText('ONE', 410, 146);
  });
}
export function ticketBackTex() {
  return canvasTex(512, 256, (g, w, h) => { g.fillStyle = '#f1e2b8'; rr(g, 4, 4, w - 8, h - 8, 18); g.fill(); g.strokeStyle = '#8a6a3a'; g.lineWidth = 6; g.stroke(); g.fillStyle = '#8a1f1f'; g.font = '40px "Permanent Marker"'; g.textAlign = 'center'; g.fillText('FINAL DEPARTURE.', w / 2, 112); g.fillText('NO RETURN SERVICE.', w / 2, 172); });
}

// ---------- home: living room, storage room, basement ----------
export function buildHome() {
  const G = new THREE.Group(); const N = G.userData.named = {};
  const floor = plane(40, 30, new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#8a5a38' : '#7a4e30'; g.fillRect(0, i * 16, w, 16); } }, { repeat: [6, 6] }), roughness: 0.75 })); floor.rotation.x = -Math.PI / 2; G.add(floor);
  const wp = new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#a9b49a'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,0.18)'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 10, h); }, { repeat: [8, 3] }), roughness: 0.95 });
  for (const [w, x, z, ry] of [[40, 0, -10, 0], [30, -20, 5, Math.PI / 2], [15.9, 20, -2.05, Math.PI / 2], [9.9, 20, 15.05, Math.PI / 2]]) G.add(put(box(w, 16, 0.6, wp, 0, true), x, 8, z, ry));
  G.add(put(box(4.2, 7.4, 0.6, wp, 0, true), 20, 12.3, 8, Math.PI / 2));
  G.add(put(box(40, 0.6, 30, mat('#efe6d6'), 0, false), 0, 16.3, 5));
  // fireplace + mantel + frames
  G.add(put(box(10, 7, 2, mat('#8a7a6a'), 0.2), 0, 3.5, -9)); G.add(put(box(5, 4, 0.5, basic('#1a1210'), 0.05, false), 0, 2.2, -7.9)); G.add(put(box(12, 0.6, 2.8, mat('#5a3a26'), 0.1), 0, 7.2, -9));
  N.frames = [];
  for (const [x, y, z, w, h] of [[-3.2, 9.2, -8.6, 2.6, 2.0], [0, 9.4, -8.6, 3.0, 2.3], [3.2, 9.2, -8.6, 2.6, 2.0], [-9, 10, -9.6, 4.2, 3.2], [9, 10, -9.6, 4.2, 3.2]]) {
    const fr = new THREE.Group(); fr.position.set(x, y, z); G.add(fr); fr.add(put(box(w + 0.4, h + 0.4, 0.2, mat('#3a2616'), 0.05), 0, 0, 0));
    const pm = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }); const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), pm); p.position.z = 0.12; fr.add(p); N.frames.push({ g: fr, m: pm, w, h });
  }
  G.add(put(box(12, 2.6, 4.5, mat('#6b3a3a', { rough: 0.9 }), 0.4), 0, 1.3, 3)); G.add(put(box(12, 3.4, 1.2, mat('#6b3a3a', { rough: 0.9 }), 0.4), 0, 3.2, 5.3));
  G.add(put(box(2.2, 3, 2.2, mat('#5a3a26'), 0.1), -9, 1.5, 0)); const lamp = put(cyl(0.9, 1.3, 1.4, newMat('#f2e6c8', { emissive: '#ffcf80', ei: 0.8 }), 14), -9, 4.6, 0); G.add(lamp);
  N.winMat = new THREE.MeshBasicMaterial({ color: '#1a2440' }); G.add(put(new THREE.Mesh(new THREE.PlaneGeometry(6, 6), N.winMat), -19.65, 9, 2, Math.PI / 2));
  // door on the right wall leading to the old bedroom (storage room behind)
  const dr = N.door = new THREE.Group(); dr.position.set(19.65, 0, 8); dr.rotation.y = -Math.PI / 2; G.add(dr);
  for (const sx of [-1, 1]) dr.add(put(box(0.4, 8.6, 0.35, mat('#efe6d6'), 0.04), sx * 2.3, 4.3, 0)); dr.add(put(box(5, 0.6, 0.35, mat('#efe6d6'), 0.04), 0, 8.3, 0)); const leaf = N.leaf = new THREE.Group(); leaf.position.set(-2.1, 0, 0.18); dr.add(leaf);
  leaf.add(put(box(4.2, 8.0, 0.2, mat('#d9cbb2'), 0.04), 2.1, 4.0, 0)); leaf.add(put(sphere(0.18, mat('#c9a227', { metal: 0.6 }), 8, 6), 3.7, 4, 0.2));
  // storage room behind the door (x 20..40)
  const st = N.storage = new THREE.Group(); st.position.set(30, 0, 8); G.add(st);
  st.add(put(box(20, 0.2, 16, mat('#7a5a3e'), 0), 0, 0.05, 0)); for (const [w, x, z, ry] of [[20, 0, -8, 0], [20, 0, 8, 0], [16, 10, 0, Math.PI / 2]]) st.add(put(box(w, 16, 0.5, mat('#bdb3a2'), 0), x, 8, z, ry));
  const R = rng(13); for (let i = 0; i < 16; i++) { const s = 1.4 + R() * 1.4; st.add(put(box(s, s * 0.8, s, mat(['#b08a5a', '#a07a4a', '#c9a77a'][i % 3], { rough: 1 }), 0.08), -2 + R() * 10, s * 0.4 + Math.floor(i / 6) * 1.6, -6 + R() * 12)); }
  st.add(put(box(3, 2.4, 1.6, mat('#2a2a30'), 0.2), 6, 4.0, -5)); st.add(put(box(4, 0.3, 2.4, mat('#6b4a32'), 0.05), 6, 2.7, -5));
  const bulb = put(sphere(0.35, basic('#fff1c8'), 10, 8), 4, 14.5, 0); st.add(bulb);
  // basement (separate room below)
  const bm = N.basement = new THREE.Group(); bm.position.set(0, -40, 60); G.add(bm);
  bm.add(put(box(30, 0.4, 32, mat('#5e5852', { rough: 1 }), 0), 0, -0.2, 4));
  const stone = new THREE.MeshStandardMaterial({ map: noiseTex('#6d6660', '#3e3934', 1200, 256, [6, 3]), roughness: 1 });
  for (const [w, x, z, ry] of [[30, 0, -12, 0], [32, -15, 4, Math.PI / 2], [32, 15, 4, Math.PI / 2], [30, 0, 20, 0]]) bm.add(put(box(w, 14, 0.8, stone, 0), x, 7, z, ry));
  bm.add(put(box(30, 0.6, 32, mat('#3a332d'), 0, false), 0, 14.3, 4));
  for (let k = 0; k < 9; k++) bm.add(put(box(4, 0.4, 1.4, mat('#6b4a32'), 0.05), -11, 1 + k * 1.4, -9 + k * 1.6));
  const cab = N.cabinet = new THREE.Group(); cab.position.set(4, 0, -11.2); bm.add(cab);
  { const cm = mat('#4a3020', { rough: 0.7 }); cab.add(put(box(8, 11, 0.3, mat('#2e1d12', { rough: 0.8 }), 0.05), 0, 5.5, -0.95)); for (const sx of [-1, 1]) cab.add(put(box(0.3, 11, 2.2, cm, 0.05), sx * 3.85, 5.5, 0)); for (const y of [0.15, 10.85]) cab.add(put(box(8, 0.3, 2.2, cm, 0.05), 0, y, 0)); for (let sh = 0; sh < 4; sh++) cab.add(put(box(7.4, 0.2, 2.0, cm, 0.03), 0, 0.5 + sh * 2.6, 0)); }
  N.cabDoorL = new THREE.Group(); N.cabDoorL.position.set(-3.9, 0, 1.15); cab.add(N.cabDoorL); N.cabDoorL.add(put(box(3.9, 10.4, 0.2, mat('#5a3a26'), 0.05), 1.95, 5.5, 0));
  N.cabDoorR = new THREE.Group(); N.cabDoorR.position.set(3.9, 0, 1.15); cab.add(N.cabDoorR); N.cabDoorR.add(put(box(3.9, 10.4, 0.2, mat('#5a3a26'), 0.05), -1.95, 5.5, 0));
  N.padlock = put(box(0.6, 0.8, 0.3, mat('#b8963c', { metal: 0.7, rough: 0.3 }), 0.1), 0, 5.5, 1.4); cab.add(N.padlock);
  for (let sh = 0; sh < 4; sh++) for (let k = 0; k < 9; k++) cab.add(put(box(0.7, 2.0, 1.6, mat(['#6b2a22', '#2a3a5a', '#3a4a2a', '#5a4022'][(k + sh) % 4]), 0.05), -3.2 + k * 0.8, 1.6 + sh * 2.6, 0.1));
  bm.add(put(box(10, 0.4, 6, mat('#6b4a32'), 0.1), 2, 3.4, 0)); for (const [x, z] of [[-2.6, -2.6], [6.6, -2.6], [-2.6, 2.6], [6.6, 2.6]]) bm.add(put(box(0.4, 3.2, 0.4, mat('#5a3a26'), 0.05), x, 1.6, z));
  N.album = new THREE.Group(); N.album.position.set(2, 3.62, 0.3); bm.add(N.album);
  N.album.add(put(box(6.6, 0.3, 4.4, mat('#3a2016'), 0.05), 0, 0, 0)); N.pageL = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }); N.pageR = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 });
  const pl1 = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 4.1), N.pageL); pl1.rotation.x = -Math.PI / 2; pl1.position.set(-1.6, 0.17, 0); N.album.add(pl1);
  const pr1 = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 4.1), N.pageR); pr1.rotation.x = -Math.PI / 2; pr1.position.set(1.6, 0.17, 0); N.album.add(pr1);
  for (let i = 0; i < 3; i++) bm.add(put(box(3.6, 0.6, 4.4, mat(['#6b2a22', '#2a3a5a', '#3a4a2a'][i]), 0.05), -6.2, 0.3 + i * 0.62, 1.2, i * 0.15));
  // wooden box of tickets
  const tb = N.ticketBox = new THREE.Group(); tb.position.set(5.6, 3.6, 1.0); bm.add(tb);
  tb.add(put(box(2.4, 0.9, 1.6, mat('#7a4e2a', { rough: 0.6 }), 0.08), 0, 0.45, 0)); N.lid = new THREE.Group(); N.lid.position.set(0, 0.9, -0.8); tb.add(N.lid); N.lid.add(put(box(2.5, 0.2, 1.7, mat('#8a5a32', { rough: 0.6 }), 0.06), 0, 0.1, 0.8));
  N.tickets = []; for (let i = 0; i < 6; i++) { const m = new THREE.MeshStandardMaterial({ map: ticketTex(['NORTHGATE', 'ASHFORD', 'CARLOW', 'HALE CROSS', 'MILLBROOK', ''][i], ['1961', '1984', '1998', '2009', '2019', 'NOV 13 2026'][i], 'ELIAS', i === 5), roughness: 0.9 }); const t = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.95), m); t.rotation.x = -Math.PI / 2; t.position.set(-0.1 + i * 0.03, 0.92 + i * 0.01, 0.02 - i * 0.04); t.rotation.z = (i - 3) * 0.05; tb.add(t); N.tickets.push(t); }
  N.bulbLight = V(2, 11, 0);
  bm.add(put(sphere(0.4, basic('#fff1c8'), 10, 8), 2, 12, 0)); bm.add(put(cyl(0.03, 0.03, 2, mat('#222'), 4), 2, 13.2, 0));
  return G;
}

// ---------- school office ----------
export function buildOffice() {
  const G = new THREE.Group(); const N = G.userData.named = {};
  const floor = plane(24, 20, mat('#8a8f96', { rough: 0.9 })); floor.rotation.x = -Math.PI / 2; G.add(floor);
  for (const [w, x, z, ry] of [[24, 0, -8, 0], [20, -12, 2, Math.PI / 2]]) G.add(put(box(w, 14, 0.5, mat('#d8dfe3'), 0), x, 7, z, ry));
  G.add(put(box(10, 0.4, 5, mat('#c9b48a'), 0.1), 0, 3.6, -3)); for (const [x, z] of [[-4.6, -5.2], [4.6, -5.2], [-4.6, -0.8], [4.6, -0.8]]) G.add(put(box(0.4, 3.4, 0.4, mat('#7a6a5a'), 0.05), x, 1.7, z));
  G.add(put(box(4.4, 3, 0.3, mat('#1d1f24'), 0.1), 0, 5.9, -4.3)); G.add(put(box(0.5, 1.4, 0.5, mat('#1d1f24'), 0.05), 0, 4.4, -4.4));
  N.screen = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 2.6), new THREE.MeshBasicMaterial({ map: canvasTex(640, 416, (g, w, h) => { g.fillStyle = '#e9eef4'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a4a7a'; g.fillRect(0, 0, w, 64); g.fillStyle = '#fff'; g.font = '700 30px Poppins'; g.fillText('BELLWETHER HIGH · STUDENT RECORDS', 20, 42); g.fillStyle = '#1d1d24'; g.font = '700 32px Poppins'; g.fillText('Search: ELIAS', 30, 130); g.strokeStyle = '#9aa'; g.strokeRect(24, 96, w - 48, 52); g.fillStyle = '#c4162a'; g.font = '800 54px Poppins'; g.textAlign = 'center'; g.fillText('NO RECORD FOUND', w / 2, 270); g.font = '600 26px Poppins'; g.fillStyle = '#556'; g.fillText('0 results', w / 2, 330); }) }));
  N.screen.position.set(0, 5.9, -4.12); G.add(N.screen);
  for (let k = 0; k < 3; k++) G.add(put(box(3, 3.4, 2.6, mat('#9aa3ad', { metal: 0.4 }), 0.1), -9, 1.7 + k * 3.5, -6));
  return G;
}
