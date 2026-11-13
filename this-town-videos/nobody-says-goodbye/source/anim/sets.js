// Sets: town (day/night/damaged/new), bedroom, highway + road end, stair shaft + door, underground, photo room, stack diagram.
import { THREE, mat, newMat, basic, box, put, add, cyl, sphere, prism, plane, canvasTex, rr, rng, Char } from './core.js';

const tint = (c, k, to = '#3a332c') => { const a = new THREE.Color(c), b = new THREE.Color(to); a.lerp(b, k); const hsl = {}; a.getHSL(hsl); a.setHSL(hsl.h, hsl.s * (1 - k * 0.6), hsl.l); return '#' + a.getHexString(); };

// ---------- shared textures ----------
export const TEX = {};
function stripeTex(c1, c2, n = 8) { return canvasTex(256, 64, (g, w, h) => { for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? c2 : c1; g.fillRect(i * w / n, 0, w / n, h); } g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < n; i++) { g.beginPath(); g.arc((i + 0.5) * w / n, h, w / n / 2, Math.PI, 0); g.fill(); } }); }
function signTex(text, bg, fg, font = '800 120px Poppins', w = 1024, h = 256) { return canvasTex(w, h, (g) => { rr(g, 8, 8, w - 16, h - 16, 36); g.fillStyle = bg; g.fill(); g.lineWidth = 12; g.strokeStyle = '#ffffff'; g.stroke(); g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 8); }); }
export function clockFaceTex(cracked = false) {
  return canvasTex(512, 512, (g, w) => {
    const c = w / 2; g.fillStyle = cracked ? '#d8d0bc' : '#fbf8ee'; g.beginPath(); g.arc(c, c, c - 6, 0, Math.PI * 2); g.fill();
    g.lineWidth = 18; g.strokeStyle = '#2b2b33'; g.stroke();
    g.fillStyle = '#2b2b33'; g.font = '700 64px Poppins'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const R = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.save(); g.translate(c + Math.sin(a) * 190, c - Math.cos(a) * 190); g.font = '700 50px Poppins'; g.fillText(R[i], 0, 0); g.restore(); }
    for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, r1 = i % 5 ? 232 : 222; g.lineWidth = i % 5 ? 4 : 9; g.beginPath(); g.moveTo(c + Math.sin(a) * r1, c - Math.cos(a) * r1); g.lineTo(c + Math.sin(a) * 244, c - Math.cos(a) * 244); g.stroke(); }
    if (cracked) { g.strokeStyle = '#3a3026'; g.lineWidth = 5; const R2 = rng(7); for (let k = 0; k < 4; k++) { g.beginPath(); let x = c + (R2() - 0.5) * 60, y = c + (R2() - 0.5) * 60; g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (R2() - 0.5) * 90; y += (R2() - 0.3) * 70; g.lineTo(x, y); } g.stroke(); } g.fillStyle = 'rgba(60,40,20,0.25)'; g.fillRect(0, 0, w, w); }
  });
}
export function makeClock(radius, cracked = false) {
  const g = new THREE.Group();
  g.add(put(new THREE.Mesh(new THREE.CircleGeometry(radius * 1.12, 48), mat('#3a3440')), 0, 0, -0.02));
  const face = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), new THREE.MeshStandardMaterial({ map: clockFaceTex(cracked), roughness: 0.6, emissive: '#fff3c8', emissiveIntensity: 0 }));
  g.add(face); g.userData.faceMat = face.material;
  const hand = (len, wd, col, z) => { const p = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(wd, len, 0.08), mat(col)); m.position.y = len / 2 - len * 0.12; p.add(m); p.position.z = z; g.add(p); return p; };
  const hh = hand(radius * 0.55, radius * 0.09, '#1d1d24', 0.06), mh = hand(radius * 0.82, radius * 0.06, '#1d1d24', 0.1), sh = hand(radius * 0.88, radius * 0.025, '#c81e2b', 0.14);
  g.add(put(new THREE.Mesh(new THREE.CircleGeometry(radius * 0.06, 16), mat('#1d1d24')), 0, 0, 0.18));
  g.userData.set = (h, m, s = 0) => { hh.rotation.z = -((h % 12) + m / 60) / 12 * Math.PI * 2; mh.rotation.z = -(m + s / 60) / 60 * Math.PI * 2; sh.rotation.z = -s / 60 * Math.PI * 2; };
  g.userData.set(7, 6, 0); return g;
}
export function calendarTex(day = 'TUESDAY') {
  return canvasTex(512, 640, (g, w, h) => {
    g.fillStyle = '#fbfaf6'; rr(g, 0, 0, w, h, 24); g.fill(); g.fillStyle = '#d7263d'; rr(g, 0, 0, w, 200, 24); g.fill(); g.fillRect(0, 120, w, 80);
    g.fillStyle = '#fff'; g.font = '800 92px Poppins'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(day, w / 2, 108);
    g.fillStyle = '#1d1d24'; g.font = '800 300px Poppins'; g.fillText('14', w / 2, 410);
    g.fillStyle = '#b8b2a6'; for (let i = 0; i < 3; i++) g.fillRect(70 + i * 140, 560, 90, 14);
  });
}

// ---------- town ----------
export function buildTown(opts = {}) {
  const dmg = !!opts.damaged, R = rng(opts.seed ?? 3);
  const C = c => (dmg ? tint(c, 0.5) : c);
  const T = new THREE.Group(); T.userData = { windows: [], lamps: [], buildings: [], named: {} };
  const N = T.userData.named;
  // ground
  const grass = plane(700, 700, mat(C(opts.autumn ? '#8fa86a' : '#7fcf6b'), { rough: 0.95 })); grass.rotation.x = -Math.PI / 2; T.add(grass);
  const road = plane(13, 200, mat(C('#4a505e'), { rough: 0.9 })); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.03, 30); T.add(road);
  const plaza = plane(70, 34, mat(C('#d8d2c4'), { rough: 0.9 })); plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.04, -79); T.add(plaza);
  for (let z = 125; z > -66; z -= 7) T.add(put(box(0.35, 0.04, 3.4, mat(C('#f3d23c')), 0, false), 0, 0.07, z));
  for (const s of [-1, 1]) { const sw = box(5, 0.32, 192, mat(C('#c9ced6')), 0.06, false); sw.position.set(s * 8.9, 0.16, 30); T.add(sw); }
  for (let k = 0; k < 7; k++) T.add(put(box(1.1, 0.06, 4.5, mat(C('#f4f4f4')), 0, false), -5 + k * 1.65, 0.08, 8));
  const W = (b, w, h, x, y, z, ry = 0) => { // window with per-building emissive material
    const m = b.userData.winMat; const win = box(w, h, 0.25, m, 0.05, false); win.position.set(x, y, z); win.rotation.y = ry; b.add(win);
    b.add(put(box(w + 0.35, 0.22, 0.4, mat(C('#ffffff')), 0.04), x, y - h / 2 - 0.1, z + 0.05, ry));
    return win;
  };
  const newBuilding = (x, z, ry) => { const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = ry; b.userData.winMat = newMat('#9fd0f5', { rough: 0.2, metal: 0.1, emissive: '#ffcf70', ei: 0 }); T.userData.windows.push(b.userData.winMat); T.userData.buildings.push(b); T.add(b); return b; };
  const house = (x, z, ry, col, roofCol, w = 11, h = 9, d = 10) => {
    const b = newBuilding(x, z, ry);
    b.add(put(box(w, h, d, mat(C(col)), 0.25), 0, h / 2, 0));
    const roof = prism(w + 1.4, 4.6, d + 1.2, mat(C(roofCol))); roof.rotation.y = Math.PI / 2; roof.position.set(0, h, 0); b.add(roof);
    b.add(put(box(2.2, 4, 0.3, mat(C('#7a4b2c')), 0.08), 0, 2, d / 2 + 0.05));
    b.add(put(box(0.3, 0.3, 0.3, mat(C('#f5c542')), 0.05), 0.75, 2, d / 2 + 0.25));
    W(b, 2.4, 2.4, -3.2, 5.4, d / 2 + 0.05); W(b, 2.4, 2.4, 3.2, 5.4, d / 2 + 0.05); W(b, 2.4, 2.2, -3.2, 2.4, d / 2 + 0.05); W(b, 2.4, 2.2, 3.2, 2.4, d / 2 + 0.05);
    b.add(put(box(4, 0.3, 2.2, mat(C('#e9e4da')), 0.05), 0, 0.15, d / 2 + 1.1));
    return b;
  };
  const shop = (x, z, ry, col, awnA, awnB, label, w = 12, h = 10, d = 10) => {
    const b = newBuilding(x, z, ry);
    b.add(put(box(w, h, d, mat(C(col)), 0.25), 0, h / 2, 0));
    b.add(put(box(w + 0.6, 0.8, d + 0.6, mat(C('#ffffff')), 0.1), 0, h + 0.2, 0));
    W(b, w * 0.62, 3.6, -w * 0.12, 2.6, d / 2 + 0.05);
    b.add(put(box(2.3, 4.4, 0.3, mat(C('#6b3f26')), 0.08), w * 0.34, 2.2, d / 2 + 0.06));
    W(b, 2.2, 2.2, -w * 0.3, 7.2, d / 2 + 0.05); W(b, 2.2, 2.2, w * 0.05, 7.2, d / 2 + 0.05); W(b, 2.2, 2.2, w * 0.33, 7.2, d / 2 + 0.05);
    const aw = box(w * 0.95, 0.5, 2.6, new THREE.MeshStandardMaterial({ map: stripeTex(C(awnA), C(awnB)), roughness: 0.8 }), 0.12); aw.position.set(0, 5.1, d / 2 + 1.25); aw.rotation.x = 0.32; b.add(aw);
    if (label) { const s = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, w * 0.15), new THREE.MeshStandardMaterial({ map: signTex(label, C(awnA), '#ffffff'), roughness: 0.7, emissive: '#ffffff', emissiveIntensity: 0 })); s.position.set(0, 6.3, d / 2 + 0.2); b.add(s); b.userData.sign = s; }
    return b;
  };
  // left side (fronts face +x), right side (fronts face -x)
  const L = Math.PI / 2, Rt = -Math.PI / 2;
  house(-18, 44, L, '#bff2e3', '#3d8f86'); shop(-18, 24, L, '#d9cff7', '#8c64db', '#ffffff', 'BOOKS');
  N.bakery = shop(-18, -12, L, '#f7b9c8', '#e34968', '#ffffff', 'BAKERY');
  for (let k = 0; k < 4; k++) N.bakery.add(put(box(1, 0.7, 1.4, mat(C('#c98a3c')), 0.3), -2.8 + k * 1.5, 1.5, 4.6));
  shop(-18, -33, L, '#fff0c4', '#eda100', '#ffffff', 'MARKET'); house(-18, -52, L, '#bfe0ff', '#2f5fae');
  house(18, 44, Rt, '#fff1a8', '#c55b3a'); house(18, 26, Rt, '#ffd9c2', '#a1462e');
  N.cafe = shop(18, -22, Rt, '#bdf0ee', '#14a08c', '#ffffff', 'CAFE'); house(18, -44, Rt, '#e3d5ff', '#6a4fd0');
  // park on the right
  const park = plane(16, 20, mat(C('#6cc35a'), { rough: 0.95 })); park.rotation.x = -Math.PI / 2; park.position.set(17, 0.05, 4); T.add(park);
  const bench = new THREE.Group(); bench.add(put(box(5, 0.35, 1.6, mat(C('#9c6a3c')), 0.05), 0, 1.4, 0)); bench.add(put(box(5, 1.2, 0.3, mat(C('#9c6a3c')), 0.05), 0, 2.2, -0.7)); for (const s of [-2, 2]) bench.add(put(box(0.3, 1.4, 1.4, mat(C('#3a3a40')), 0.03), s, 0.7, 0)); put(bench, 19, 0, 6, Rt); T.add(bench);
  // second row + hills
  const P2 = ['#cfe9ff', '#ffe0ea', '#e9f7d0', '#f1e2ff', '#fff3d6'];
  for (let z = 70; z > -80; z -= 18) for (const s of [-1, 1]) { const b = newBuilding(s * 36, z + (s > 0 ? 6 : 0), s > 0 ? Rt : L); b.add(put(box(12, 12 + R() * 8, 11, mat(C(P2[Math.floor(R() * 5)])), 0.25), 0, 7, 0)); W(b, 2.4, 2.4, -3, 9, 5.6); W(b, 2.4, 2.4, 3, 9, 5.6); }
  for (let k = 0; k < 9; k++) { const h = sphere(40 + R() * 30, mat(C('#6fbf5d'), { rough: 1 }), 18, 10); h.scale.y = 0.35; h.position.set(-220 + k * 55, -4, -240 - R() * 60); h.castShadow = false; T.add(h); }
  // church + clock tower
  const ch = N.church = new THREE.Group(); ch.position.set(0, 0, -100); T.add(ch); T.userData.buildings.push(ch);
  ch.userData.winMat = newMat('#8fb6e8', { rough: 0.2, emissive: '#ffcf70', ei: 0 }); T.userData.windows.push(ch.userData.winMat);
  ch.add(put(box(20, 14, 26, mat(C('#f3ead8')), 0.3), 0, 7, 0));
  const croof = prism(22, 9, 27.5, mat(C('#9a3434'))); croof.position.y = 14; ch.add(croof);
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const w = box(0.3, 5, 2.4, ch.userData.winMat, 0.06, false); w.position.set(s * 10.05, 7.5, -7 + k * 7); ch.add(w); }
  const tw = new THREE.Group(); tw.position.set(0, 0, 13); ch.add(tw); N.tower = tw;
  tw.add(put(box(9, 32, 9, mat(C('#efe4cc')), 0.3), 0, 16, 0));
  tw.add(put(box(9.6, 1, 9.6, mat(C('#d8c9a8')), 0.1), 0, 32.2, 0));
  tw.add(put(box(9.6, 1, 9.6, mat(C('#d8c9a8')), 0.1), 0, 19, 0));
  for (const s of [-1, 1]) tw.add(put(box(2.6, 4.4, 9.4, mat(C('#3b3340')), 0.3), s * 2.2, 29.5, 0));
  const spire = new THREE.Mesh(new THREE.ConeGeometry(6.8, 13, 4), mat(C('#9a3434'))); spire.rotation.y = Math.PI / 4; spire.position.y = 39.2; spire.castShadow = true; tw.add(spire);
  tw.add(put(box(0.5, 3.4, 0.5, mat(C('#f2c230'), { metal: 0.5, rough: 0.3 }), 0.05), 0, 47.3, 0)); tw.add(put(box(2, 0.5, 0.5, mat(C('#f2c230'), { metal: 0.5, rough: 0.3 }), 0.05), 0, 47.8, 0));
  tw.add(put(box(4, 6.5, 0.4, mat(C('#5e3a22')), 0.2), 0, 3.25, 4.55));
  const clock = makeClock(3.3, dmg); clock.position.set(0, 24.5, 4.62); tw.add(clock); N.clock = clock;
  // trees and lamps along the street
  const tree = (x, z, s = 1) => { const g = new THREE.Group(); g.add(put(box(0.9 * s, 4 * s, 0.9 * s, mat(C('#7a4e2d')), 0.1), 0, 2 * s, 0)); const AUT = ['#d9822b', '#c9562d', '#e0b13a', '#b8452a', '#8a9a3a']; const fm = mat(C(dmg ? '#5b6b3a' : (opts.autumn ? AUT[Math.floor(Math.abs(Math.sin(x * 12.9 + z * 78.2)) * 5)] : '#4cb944')), { rough: 0.9 }); for (const [a, b, c, r] of [[0, 5.6, 0, 2.6], [1.4, 4.9, 0.6, 1.9], [-1.3, 5, -0.5, 2], [0.2, 6.9, -0.3, 1.8]]) g.add(put(sphere(r * s, fm, 12, 9), a * s, b * s, c * s)); g.position.set(x, 0, z); T.add(g); return g; };
  for (let z = 112; z > -60; z -= 22) { tree(-10.6, z); tree(10.6, z - 11); }
  tree(14, -2, 1.1); tree(21, 11, 0.9); tree(32, -60, 1.3); tree(-32, 60, 1.2);
  for (let z = 100; z > -60; z -= 20) for (const s of [-1, 1]) {
    const lg = new THREE.Group(); lg.add(put(cyl(0.18, 0.24, 7.5, mat(C('#2c3140')), 8), 0, 3.75, 0)); lg.add(put(box(1.9, 0.25, 0.3, mat(C('#2c3140')), 0.05), -s * 0.8, 7.4, 0));
    const lm = newMat('#e8e4d0', { emissive: '#ffd27a', ei: 0 }); lg.add(put(box(1.0, 0.45, 0.7, lm, 0.1, false), -s * 1.5, 7.2, 0)); T.userData.lamps.push(lm);
    lg.position.set(s * 7.3, 0, z + (s > 0 ? 10 : 0)); T.add(lg);
  }
  // vehicles
  N.bus = makeBus(C); T.add(N.bus);
  N.car = makeCar(C('#e8473f')); T.add(N.car); N.car2 = makeCar(C('#3b7be0')); T.add(N.car2);
  // abandoned house lot (right, behind)
  const ab = N.abandoned = new THREE.Group(); ab.position.set(46, 0, 78); T.add(ab);
  ab.add(put(box(13, 9, 11, mat(C('#9a948a')), 0.2), 0, 4.5, 0));
  const ar = prism(14.5, 5, 12.4, mat(C('#5a5048'))); ar.rotation.y = Math.PI / 2; ar.rotation.z = 0.04; ar.position.y = 9; ab.add(ar);
  for (const [x, y] of [[-3.3, 5.6], [3.3, 5.6], [-3.3, 2.4], [3.3, 2.4]]) { ab.add(put(box(2.4, 2.4, 0.2, mat('#1c1a18'), 0.02), x, y, 5.55)); for (let k = 0; k < 2; k++) { const p = box(3, 0.45, 0.2, mat('#8a6a48'), 0.04); p.position.set(x, y - 0.5 + k, 5.7); p.rotation.z = (k ? 0.25 : -0.2); ab.add(p); } }
  ab.add(put(box(2.2, 4, 0.2, mat('#3a2a1e'), 0.04), 0, 2, 5.6));
  for (let k = 0; k < 8; k++) { const f = box(0.3, 2 + (k % 3) * 0.3, 0.3, mat('#7a6a58'), 0.04); f.position.set(-8 + k * 2.2, 1, 9); f.rotation.z = (k % 3 - 1) * 0.12; ab.add(f); }
  const dt = new THREE.Group(); dt.add(put(box(0.8, 6, 0.8, mat('#5a4636'), 0.1), 0, 3, 0)); const br = box(0.4, 3, 0.4, mat('#5a4636'), 0.06); br.position.set(0.9, 5, 0); br.rotation.z = -0.8; dt.add(br); dt.position.set(9, 0, 6); ab.add(dt);
  if (dmg) damage(T, R);
  return T;
}
function damage(T, R) {
  for (const b of T.userData.buildings) {
    b.rotation.z += (R() - 0.5) * 0.12; b.rotation.x += (R() - 0.5) * 0.08; b.position.y -= R() * 0.6;
    for (let k = 0; k < 4; k++) { const d = box(1 + R() * 2.2, 0.6 + R() * 1.4, 1 + R() * 2, mat(tint('#9a8f80', 0.4)), 0.2); d.position.set(b.position.x + (R() - 0.5) * 12, 0.4, b.position.z + (R() - 0.5) * 12); d.rotation.set(R(), R(), R()); T.add(d); }
    for (let k = 0; k < 3; k++) { const c = box(0.25, 3 + R() * 4, 0.1, mat('#241d18'), 0.02); c.position.set((R() - 0.5) * 8, 3 + R() * 5, 5.3); c.rotation.z = (R() - 0.5) * 1.2; b.add(c); }
  }
  T.userData.named.tower.rotation.z = 0.06; T.userData.named.tower.rotation.x = -0.03;
}
export function makeBus(C = c => c) {
  const g = new THREE.Group(), y = C('#f5c518');
  g.add(put(box(5, 5, 15, mat(y), 0.6), 0, 3.3, 0));
  g.add(put(box(5.06, 0.45, 15.06, mat(C('#1d1d24')), 0.1), 0, 2.4, 0));
  g.add(put(box(5.06, 0.25, 15.06, mat(C('#1d1d24')), 0.08), 0, 3.4, 0));
  const glass = mat(C('#25324d'), { rough: 0.15, metal: 0.2 });
  for (const s of [-1, 1]) for (let k = 0; k < 5; k++) g.add(put(box(0.12, 1.7, 2.1, glass, 0.04), s * 2.52, 4.6, -5.2 + k * 2.6));
  g.add(put(box(4.2, 2.2, 0.12, glass, 0.06), 0, 4.5, 7.52));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.7), new THREE.MeshBasicMaterial({ map: signTex('TOWN LOOP', '#1d1d24', '#ffb23b', '800 130px Poppins', 1024, 200) })); sign.position.set(0, 5.95, 7.58); g.add(sign);
  for (const s of [-1, 1]) g.add(put(box(0.9, 0.6, 0.15, mat('#fff8d0', { emissive: '#fff3b0', ei: 0.6 }), 0.1, false), s * 1.8, 1.9, 7.55));
  for (const s of [-1, 1]) for (const z of [-4.8, 4.6]) { const w = cyl(1.15, 1.15, 0.8, mat('#151518'), 16); w.rotation.z = Math.PI / 2; w.position.set(s * 2.3, 1.15, z); g.add(w); }
  g.userData.kind = 'bus'; return g;
}
export function makeCar(color) {
  const g = new THREE.Group();
  g.add(put(box(3.6, 1.5, 6.6, mat(color, { rough: 0.35, metal: 0.15 }), 0.45), 0, 1.35, 0));
  g.add(put(box(3.1, 1.35, 3.6, mat(color, { rough: 0.35, metal: 0.15 }), 0.45), 0, 2.55, -0.4));
  const glass = mat('#22304a', { rough: 0.1, metal: 0.3 });
  g.add(put(box(2.9, 1.0, 0.1, glass, 0.03), 0, 2.6, 1.42)); g.add(put(box(2.9, 1.0, 0.1, glass, 0.03), 0, 2.6, -2.22));
  for (const s of [-1, 1]) g.add(put(box(0.1, 0.95, 3.0, glass, 0.03), s * 1.56, 2.6, -0.4));
  const hl = newMat('#fffbe8', { emissive: '#fff4c0', ei: 0.3 }); g.userData.headMat = hl;
  for (const s of [-1, 1]) { g.add(put(box(0.8, 0.45, 0.15, hl, 0.08, false), s * 1.2, 1.55, 3.3)); g.add(put(box(0.7, 0.4, 0.15, mat('#c4162a', { emissive: '#ff2030', ei: 0.4 }), 0.08, false), s * 1.25, 1.6, -3.3)); }
  for (const s of [-1, 1]) for (const z of [-2.1, 2.1]) { const w = cyl(0.8, 0.8, 0.6, mat('#151518'), 14); w.rotation.z = Math.PI / 2; w.position.set(s * 1.75, 0.8, z); g.add(w); }
  g.userData.kind = 'car'; return g;
}
export function makeHeadlights(car) { // two cones + spotlights, attached to the car front
  const beams = new THREE.Group();
  for (const s of [-1, 1]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(5, 34, 20, 1, true), basic('#fff6d0', { transparent: true, opacity: 0.07, add: true, side: THREE.DoubleSide }));
    cone.rotation.x = -Math.PI / 2; cone.position.set(s * 1.2, 1.5, 3.4 + 17); cone.castShadow = false; beams.add(cone);
  }
  const sp = new THREE.SpotLight('#fff1c8', 260, 80, 0.45, 0.5, 1.2); sp.position.set(0, 1.6, 3.4); sp.target.position.set(0, 0, 30); beams.add(sp, sp.target);
  car.add(beams); car.userData.beams = beams; return beams;
}

// ---------- fire, smoke, splash ----------
export function makeFire(n = 14, spread = 6, seed = 5) {
  const g = new THREE.Group(), R = rng(seed);
  const cols = ['#ff4a12', '#ff7a1a', '#ffb52e', '#ffe36a'];
  for (let i = 0; i < n; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.9 + R() * 1.2, 3 + R() * 4, 6), basic(cols[i % 4], { transparent: true, opacity: 0.85, add: true })); f.position.set((R() - 0.5) * spread, 0, (R() - 0.5) * spread * 0.5); f.userData.ph = R() * 10; f.userData.base = f.position.clone(); g.add(f); }
  const smoke = []; for (let i = 0; i < 10; i++) { const s = sphere(1.6 + R(), new THREE.MeshStandardMaterial({ color: '#4a4a4f', transparent: true, opacity: 0.5, depthWrite: false }), 10, 8); s.castShadow = false; s.userData.ph = R(); s.userData.x = (R() - 0.5) * spread; g.add(s); smoke.push(s); }
  const light = new THREE.PointLight('#ff8a30', 200, 40, 1.6); light.position.y = 4; g.add(light);
  g.userData.update = (t) => {
    for (const f of g.children) { if (f.userData.base) { const k = 0.75 + 0.35 * Math.sin(t * 9 + f.userData.ph) + 0.2 * Math.sin(t * 23 + f.userData.ph * 2); f.scale.set(1, k, 1); f.position.y = f.userData.base.y + (f.geometry.parameters.height * k) / 2; } }
    for (const s of smoke) { const p = (t * 0.35 + s.userData.ph) % 1; s.position.set(s.userData.x + Math.sin(p * 6) * 0.6, 4 + p * 14, 0); s.scale.setScalar(0.6 + p * 1.8); s.material.opacity = 0.45 * (1 - p); }
    light.intensity = 180 + 60 * Math.sin(t * 17) + 40 * Math.sin(t * 7.3);
  };
  return g;
}
export function makeSplash() {
  const g = new THREE.Group();
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 24), mat('#6b3e22', { rough: 0.2 })); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.36; g.add(pool);
  const drops = []; for (let i = 0; i < 9; i++) { const d = sphere(0.16, mat('#7a4a28', { rough: 0.2 }), 6, 5); d.castShadow = false; g.add(d); drops.push(d); }
  g.userData.update = (p) => { pool.scale.setScalar(0.1 + 1.6 * Math.min(1, p * 1.6)); drops.forEach((d, i) => { const a = i / drops.length * Math.PI * 2; const k = Math.min(1, p * 1.4); d.position.set(Math.cos(a) * k * 2.2, 0.4 + Math.sin(k * Math.PI) * 1.4, Math.sin(a) * k * 2.2); d.visible = p > 0.02 && p < 0.75; }); };
  return g;
}

// ---------- bedroom ----------
export function buildBedroom() {
  const G = new THREE.Group(); const N = G.userData.named = {};
  const floor = plane(30, 30, mat('#b98352', { rough: 0.8 })); floor.rotation.x = -Math.PI / 2; G.add(floor);
  const wallM = mat('#d9ccf2', { rough: 0.95 });
  G.add(put(box(30, 16, 0.6, wallM, 0, true), 0, 8, -10)); G.add(put(box(0.6, 16, 30, wallM, 0, true), -12, 8, 2)); G.add(put(box(0.6, 16, 30, wallM, 0, true), 12, 8, 2));
  G.add(put(box(30, 0.6, 30, mat('#efe9fb'), 0, false), 0, 16, 2));
  // window on back wall
  const win = new THREE.Mesh(new THREE.PlaneGeometry(7, 5.5), new THREE.MeshBasicMaterial({ color: '#ffffff' })); N.winMesh = win;
  win.position.set(4, 9, -9.65); G.add(win);
  N.winMorning = canvasTex(256, 200, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9fd3ff'); gr.addColorStop(1, '#fff1cf'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#7cc96b'; g.fillRect(0, h * 0.78, w, h); g.fillStyle = '#efe4cc'; g.fillRect(150, 40, 34, 140); g.fillStyle = '#9a3434'; g.beginPath(); g.moveTo(144, 42); g.lineTo(167, 4); g.lineTo(190, 42); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(167, 70, 11, 0, 7); g.fill(); });
  N.winNight = canvasTex(256, 200, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#060a1c'); gr.addColorStop(1, '#1b2650'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#10142a'; g.fillRect(0, h * 0.78, w, h); g.fillStyle = '#3a3f5a'; g.fillRect(150, 40, 34, 140); g.beginPath(); g.moveTo(144, 42); g.lineTo(167, 4); g.lineTo(190, 42); g.fill(); g.fillStyle = '#fff3c8'; g.beginPath(); g.arc(167, 70, 11, 0, 7); g.fill(); for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect((i * 53) % w, (i * 29) % 120, 2, 2); } });
  win.material.map = N.winMorning;
  for (const [w, h, x, y] of [[7.6, 0.4, 4, 11.9], [7.6, 0.4, 4, 6.1], [0.4, 6, 0.2, 9], [0.4, 6, 7.8, 9], [0.3, 5.6, 4, 9]]) G.add(put(box(w, h, 0.5, mat('#ffffff'), 0.05), x, y, -9.5));
  // bed
  const bed = N.bed = new THREE.Group(); bed.position.set(-5.5, 0, -2); G.add(bed);
  bed.add(put(box(7, 1.6, 12, mat('#ffffff'), 0.2), 0, 0.8, 0)); bed.add(put(box(7.2, 4.5, 0.6, mat('#ffffff'), 0.2), 0, 2.25, -6));
  bed.add(put(box(6.6, 1.0, 11.4, mat('#f6f2ea'), 0.3), 0, 2.0, 0)); bed.add(put(box(4.6, 0.9, 2.2, mat('#ffffff'), 0.4), 0, 2.8, -4.4));
  N.blanket = put(box(6.9, 0.7, 7.4, mat('#5cc6c0'), 0.3), 0, 2.6, 1.8); bed.add(N.blanket);
  // nightstand + alarm clock
  G.add(put(box(2.6, 2.8, 2.6, mat('#f0d6a8'), 0.15), -0.6, 1.4, -7.4));
  const ac = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#16161c'; rr(g, 0, 0, w, h, 20); g.fill(); g.fillStyle = '#ff4040'; g.font = '800 92px Poppins'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('7:00', w / 2, h / 2 + 4); });
  const acm = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshBasicMaterial({ map: ac })); acm.position.set(-0.6, 3.25, -6.75); G.add(acm); G.add(put(box(1.8, 1.0, 0.8, mat('#2a2a33'), 0.15), -0.6, 3.25, -7.2));
  // calendar
  const cal = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 3.5), new THREE.MeshStandardMaterial({ map: calendarTex('TUESDAY'), roughness: 0.9 })); cal.position.set(-11.65, 9, -4); cal.rotation.y = Math.PI / 2; G.add(cal); N.calendar = cal;
  // desk + notebook + notes wall
  const desk = N.desk = new THREE.Group(); desk.position.set(8, 0, 2); G.add(desk);
  desk.add(put(box(4, 0.4, 7, mat('#f4e3c4'), 0.1), 0, 3.6, 0)); for (const [x, z] of [[-1.7, -3.2], [1.7, -3.2], [-1.7, 3.2], [1.7, 3.2]]) desk.add(put(box(0.35, 3.5, 0.35, mat('#d9c3a0'), 0.05), x, 1.75, z));
  N.noteTex = (n) => canvasTex(512, 640, (g, w, h) => { g.fillStyle = '#fffdf3'; g.fillRect(0, 0, w, h); g.strokeStyle = '#b9d4f2'; g.lineWidth = 3; for (let y = 60; y < h; y += 44) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } g.strokeStyle = '#f2a0a0'; g.beginPath(); g.moveTo(60, 0); g.lineTo(60, h); g.stroke(); g.fillStyle = '#1d2a6b'; g.font = '64px "Permanent Marker"'; g.fillText('LOOP ' + n, 84, 120); g.strokeStyle = '#1d2a6b'; g.lineWidth = 6; const tally = Math.min(n, 95); for (let i = 0; i < tally; i++) { const grp = Math.floor(i / 5), k = i % 5, gx = 84 + (grp % 6) * 68, gy = 190 + Math.floor(grp / 6) * 92; g.beginPath(); if (k < 4) { g.moveTo(gx + k * 12, gy); g.lineTo(gx + k * 12, gy + 60); } else { g.moveTo(gx - 6, gy + 50); g.lineTo(gx + 46, gy + 8); } g.stroke(); } });
  N.notebook = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.2), new THREE.MeshStandardMaterial({ map: N.noteTex(8), roughness: 0.9 })); N.notebook.rotation.x = -Math.PI / 2; N.notebook.rotation.z = -0.15; N.notebook.position.set(8, 3.82, 2.5); G.add(N.notebook);
  N.pencil = put(box(0.18, 0.18, 2.2, mat('#f5c518'), 0.05), 8.6, 4.0, 2.5); N.pencil.rotation.y = 0.6; G.add(N.pencil);
  const notes = N.notes = new THREE.Group(); G.add(notes); const R = rng(11);
  const nc = ['#fff27a', '#ffb3c7', '#9fe6ff', '#c9ff9f'];
  for (let i = 0; i < 70; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), mat(nc[i % 4], { rough: 0.9 })); m.position.set(11.6, 4.5 + R() * 9.5, -8 + R() * 18); m.rotation.y = -Math.PI / 2; m.rotation.x = (R() - 0.5) * 0.3; notes.add(m); }
  for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 6 + R() * 6), mat('#d7263d')); s.position.set(11.5, 6 + R() * 7, -2 + R() * 8); s.rotation.x = (R() - 0.5) * 1.4; notes.add(s); }
  return G;
}

// ---------- highway, road end, stairs, door ----------
export function buildHighway() {
  const G = new THREE.Group(); const N = G.userData.named = {}; const R = rng(21);
  const END = -520; N.END = END;
  for (const s of [-1, 1]) { const field = plane(193.5, 640, mat('#2f4a2a', { rough: 1 })); field.rotation.x = -Math.PI / 2; field.position.set(s * 103.25, 0, END + 320); G.add(field); }
  for (let k = 0; k < 60; k++) for (const s of [-1, 1]) { const row = box(1.2, 0.5, 600 - 0, mat(k % 2 ? '#3b5a30' : '#5a6b2f', { rough: 1 }), 0.1, false); row.position.set(s * (14 + k * 3), 0.25, END + 300); if (s * (14 + k * 3) < 190) G.add(row); }
  const roadA = plane(13, 620 - 12, mat('#3c414d', { rough: 0.9 })); roadA.rotation.x = -Math.PI / 2; roadA.position.set(0, 0.04, END + 12 + (620 - 12) / 2); G.add(roadA);
  // road pieces around the hatch (hatch at x 2.5..6.5, z END+4..END+10)
  for (const [w, x, d, z] of [[9, -2, 12, END + 6], [4, 4.5, 2.9, END + 10.55], [4, 4.5, 2.9, END + 1.45]]) { const p = plane(w, d, mat('#3c414d', { rough: 0.9 })); p.rotation.x = -Math.PI / 2; p.position.set(x, 0.04, z); G.add(p); }
  for (let z = END + 20; z < 90; z += 9) G.add(put(box(0.35, 0.04, 4, mat('#e9e4c8'), 0, false), 0, 0.08, z));
  for (let z = END + 14; z < 90; z += 24) for (const s of [-1, 1]) { const p = box(0.4, 2.2, 0.4, mat('#6a5a48'), 0.05); p.position.set(s * 9.5, 1.1, z); G.add(p); }
  for (let z = END + 40; z < 90; z += 60) { const p = cyl(0.3, 0.35, 16, mat('#5a4a3a'), 6); p.position.set(-14, 8, z); G.add(p); G.add(put(box(4, 0.3, 0.3, mat('#5a4a3a'), 0.05), -14, 15, z)); }
  // distant town lights behind (at start)
  for (let i = 0; i < 40; i++) { const l = box(1.2, 1.2, 1.2, basic('#ffcf70'), 0.1, false); l.position.set((R() - 0.5) * 120, 1 + R() * 10, 110 + R() * 40); G.add(l); }
  // void: black planes at the end line
  const voidM = basic('#000000', { fog: false }); const v1 = plane(900, 600, voidM); v1.position.set(0, 300, END); G.add(v1);
  const v2 = plane(900, 900, voidM); v2.rotation.x = -Math.PI / 2; v2.position.set(0, -0.2, END - 450); G.add(v2);
  // hatch
  const hatch = N.hatch = new THREE.Group(); hatch.position.set(4.5, 0, END + 6); G.add(hatch);
  hatch.add(put(box(4.2, 0.25, 0.3, mat('#7d8590', { metal: 0.6, rough: 0.4 }), 0.04), 0, 0.1, -3.1)); hatch.add(put(box(4.2, 0.25, 0.3, mat('#7d8590', { metal: 0.6, rough: 0.4 }), 0.04), 0, 0.1, 3.1));
  for (const s of [-1, 1]) hatch.add(put(box(0.3, 0.25, 6.4, mat('#7d8590', { metal: 0.6, rough: 0.4 }), 0.04), s * 1.95, 0.1, 0));
  const lid = N.lid = new THREE.Group(); lid.position.set(-1.9, 0.2, 0); hatch.add(lid);
  const lidM = new THREE.MeshStandardMaterial({ color: '#6c737d', metalness: 0.6, roughness: 0.45, map: canvasTex(128, 192, (g, w, h) => { g.fillStyle = '#6c737d'; g.fillRect(0, 0, w, h); g.strokeStyle = '#4d535b'; g.lineWidth = 4; for (let i = -h; i < w + h; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); } }) });
  lid.add(put(box(3.8, 0.2, 5.8, lidM, 0.04), 1.9, 0, 0));
  // stair shaft under the hatch
  const sh = N.shaft = new THREE.Group(); sh.position.set(4.5, 0, END + 6); G.add(sh);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 62, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#5f6268', roughness: 0.95, side: THREE.BackSide })); wall.position.y = -31; wall.receiveShadow = true; sh.add(wall); N.shaftWall = wall;
  sh.add(put(cyl(0.6, 0.6, 74, mat('#6e757e', { metal: 0.7, rough: 0.35 }), 12), 0, -37, 0));
  const stepM = mat('#8a919b', { metal: 0.7, rough: 0.35 });
  N.steps = []; N.rails = []; for (let i = 0; i < 120; i++) { const a = i * 0.32, y = -1 - i * 0.58; const s = box(4.6, 0.22, 1.7, stepM, 0.05); s.position.set(Math.cos(a) * 3.1, y, Math.sin(a) * 3.1); s.rotation.y = -a; sh.add(s); N.steps.push(s); const rail = cyl(0.06, 0.06, 2.6, stepM, 4); rail.position.set(Math.cos(a) * 5.3, y + 1.3, Math.sin(a) * 5.3); sh.add(rail); N.rails.push(rail); }
  N.stairY = i => -1 - i * 0.58; N.stairA = i => i * 0.32;
  const red = []; for (let k = 0; k < 7; k++) { const l = box(0.5, 0.3, 0.2, basic('#ff3b30'), 0.05, false); const a = k * 1.7; l.position.set(Math.cos(a) * 7.3, -6 - k * 9, Math.sin(a) * 7.3); l.lookAt(0, l.position.y, 0); sh.add(l); red.push(l); }
  // door at the bottom
  const door = N.door = new THREE.Group(); door.position.set(0, -71, 0); sh.add(door);
  door.add(put(box(16, 0.6, 30, mat('#4e5157'), 0.05), 0, -0.3, -7));
  const dwm = mat('#6a6d73', { rough: 0.95 }); door.add(put(box(3.6, 12, 0.8, dwm, 0.05), -4.2, 6, -13)); door.add(put(box(3.6, 12, 0.8, dwm, 0.05), 4.2, 6, -13)); door.add(put(box(4.8, 3.4, 0.8, dwm, 0.05), 0, 10.3, -13));
  for (const s of [-1, 1]) door.add(put(box(0.6, 12, 7.5, dwm, 0.05), s * 6, 6, -9.4)); door.add(put(box(12.6, 0.6, 7.5, dwm, 0.05), 0, 12.2, -9.4));
  const leaf = N.leaf = new THREE.Group(); leaf.position.set(-2.4, 0, -12.5); door.add(leaf);
  const doorTex = canvasTex(512, 900, (g, w, h) => { g.fillStyle = '#5b6470'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(120,70,40,0.35)'; for (let i = 0; i < 40; i++) g.fillRect((i * 97) % w, (i * 131) % h, 30 + (i % 5) * 9, 8 + (i % 3) * 6); g.fillStyle = '#a7aeb8'; for (const x of [30, w - 30]) for (let y = 40; y < h; y += 90) { g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); } g.fillStyle = '#f0ece2'; g.textAlign = 'center'; g.font = '128px "Saira Stencil One"'; g.fillText('TUESDAY', w / 2, 330); g.font = '104px "Saira Stencil One"'; g.fillText('NUMBER', w / 2, 470); g.font = '230px "Saira Stencil One"'; g.fillText('98', w / 2, 690); });
  leaf.add(put(box(4.8, 8.6, 0.4, new THREE.MeshStandardMaterial({ map: doorTex, metalness: 0.4, roughness: 0.6 }), 0.05), 2.4, 4.3, 0));
  leaf.add(put(box(0.3, 1.2, 0.3, mat('#2b2e33', { metal: 0.8 }), 0.05), 4.2, 4.2, 0.35));
  N.doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(6, 9.5), basic('#ffd8a0')); N.doorGlow.position.set(0, 4.3, -13.6); door.add(N.doorGlow);
  door.add(put(box(0.8, 0.5, 0.6, basic('#ffe6a8'), 0.1, false), 0, 10, -12.4));
  return G;
}

// ---------- underground (damaged town + water + ceiling with crack) ----------
export function buildUnder() {
  const G = new THREE.Group(); const N = G.userData.named = {};
  const town = N.town = buildTown({ damaged: true, seed: 9 }); G.add(town);
  // water
  const waterTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#20343a'; g.fillRect(0, 0, w, h); const R = rng(4); for (let i = 0; i < 260; i++) { g.strokeStyle = `rgba(160,210,220,${0.05 + R() * 0.12})`; g.lineWidth = 2; const x = R() * w, y = R() * h; g.beginPath(); g.ellipse(x, y, 8 + R() * 22, 2 + R() * 3, 0, 0, Math.PI * 2); g.stroke(); } }, { repeat: [30, 30] });
  N.water = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshStandardMaterial({ color: '#4a7a80', map: waterTex, roughness: 0.15, metalness: 0.35, transparent: true, opacity: 0.88 }));
  N.water.rotation.x = -Math.PI / 2; N.water.position.y = 0.9; N.water.receiveShadow = true; G.add(N.water);
  // cavern ceiling with a crack above the plaza (x -3..3, z -82..-56)
  const rockM = mat('#2e2620', { rough: 1 }); const CY = 62;
  for (const [w, d, x, z] of [[314, 600, -143, -60], [300, 600, 170, -60], [6, 304, 17, 88], [6, 270, 17, -225]]) G.add(put(box(w, 4, d, rockM, 0, false), x, CY, z));
  const R = rng(17); N.crackRocks = [];
  N.crack = { x: 17, z0: -90, z1: -64, y: CY };
  N.crackGlow = new THREE.Mesh(new THREE.PlaneGeometry(30, 44), basic('#c9f6ff', { fog: false })); N.crackGlow.rotation.x = Math.PI / 2; N.crackGlow.position.set(17, 100, -77); G.add(N.crackGlow);
  for (let i = 0; i < 26; i++) { const z = -90 + i; const s = (i % 2 ? 1 : -1); const w = 1.2 + R() * 1.5; const b = box(w, 4, 1.2, rockM, 0.1, false); b.position.set(17 + s * (3 - w / 2 + (R() - 0.5) * 0.8), CY, z + 0.5); b.rotation.y = (R() - 0.5) * 0.4; G.add(b); N.crackRocks.push(b); }
  for (let i = 0; i < 160; i++) { const b = box(2 + R() * 5, 3 + R() * 9, 2 + R() * 5, rockM, 0.4, false); const a = R() * Math.PI * 2, r = 12 + R() * 110; const x = Math.cos(a) * r, z = Math.sin(a) * r - 40; if (Math.abs(x - 17) < 9 && z > -96 && z < -58) continue; b.position.set(x, CY - 3 - R() * 3, z); G.add(b); }
  const wallM = new THREE.MeshStandardMaterial({ color: '#241c17', roughness: 1, side: THREE.BackSide });
  const cave = new THREE.Mesh(new THREE.CylinderGeometry(170, 170, 70, 24, 1, true), wallM); cave.position.set(0, 30, -30); G.add(cave);
  // lanterns
  N.lanterns = []; const LP = [[-10, -6], [10, 18], [-12, -30], [11, -40], [-6, -70], [8, -66], [-12, 30], [12, 36]];
  for (const [x, z] of LP) { const l = new THREE.Group(); l.add(put(cyl(0.12, 0.12, 5, mat('#2a2420'), 6), 0, 2.5, 0)); const m = basic('#ffc070'); l.add(put(box(0.8, 1, 0.8, m, 0.1, false), 0, 5.2, 0)); l.position.set(x, 0, z); G.add(l); N.lanterns.push({ g: l, m }); }
  // shop interiors with people (open fronts) handled by placing people in front of shops
  // red siren beacon on a pole in the plaza
  const beacon = N.beacon = new THREE.Group(); beacon.position.set(-14, 0, -64); G.add(beacon);
  beacon.add(put(cyl(0.25, 0.3, 10, mat('#3a3a40'), 8), 0, 5, 0));
  N.beaconMat = basic('#5a1010'); beacon.add(put(cyl(0.8, 0.8, 1.2, N.beaconMat, 12), 0, 10.6, 0));
  const beam = new THREE.Mesh(new THREE.ConeGeometry(3.2, 26, 16, 1, true), basic('#ff2020', { transparent: true, opacity: 0.0, add: true, side: THREE.DoubleSide })); beam.rotation.z = Math.PI / 2; beam.position.set(13, 0, 0); const bp = N.beamPivot = new THREE.Group(); bp.position.y = 10.6; bp.add(beam); beacon.add(bp); N.beam = beam;
  // the new town above the ceiling
  const nt = N.newTown = buildTown({ seed: 31 }); nt.position.y = CY + 2; G.add(nt);
  for (const b of nt.children) if (b.isMesh && b.geometry.type === 'PlaneGeometry' && (b.geometry.parameters.width === 70 || b.geometry.parameters.width === 700)) b.visible = false; // the rock slab is the ground up there
  prepAssemble(nt);
  return G;
}
export function prepAssemble(town) {
  const R = rng(55); town.userData.parts = [];
  town.traverse(o => { if (o.isMesh && o !== town && (o.geometry.type !== 'PlaneGeometry' || o.geometry.parameters.width < 12)) { o.userData.base = { p: o.position.clone(), s: o.scale.clone() }; o.userData.delay = R() * 0.65; o.userData.off = new THREE.Vector3((R() - 0.5) * 10, 8 + R() * 18, (R() - 0.5) * 10); town.userData.parts.push(o); } });
}
export function assemble(town, p) {
  for (const o of town.userData.parts) { const k = Math.min(1, Math.max(0, (p - o.userData.delay) / 0.35)); const e = 1 - Math.pow(1 - k, 3); o.visible = k > 0; o.position.copy(o.userData.base.p).addScaledVector(o.userData.off, 1 - e); o.scale.copy(o.userData.base.s).multiplyScalar(0.3 + 0.7 * e); }
}

// ---------- photo room ----------
export function buildPhotos() {
  const G = new THREE.Group(); const N = G.userData.named = {};
  const floor = plane(60, 40, mat('#3a2f2a', { rough: 0.9 })); floor.rotation.x = -Math.PI / 2; G.add(floor);
  G.add(put(box(60, 26, 0.6, mat('#5a4a40', { rough: 1 }), 0), 0, 13, -12));
  for (const s of [-1, 1]) G.add(put(box(0.6, 26, 40, mat('#4a3c34', { rough: 1 }), 0), s * 30, 13, 8));
  const cols = 14, rows = 7, pw = 2.6, ph = 2.0, gap = 0.55;
  const atlas = canvasTex(cols * 256, rows * 200, (g) => {
    const R = rng(77);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const n = r * cols + c + 1, x = c * 256, y = r * 200, sk = R();
      g.fillStyle = '#f7f3ea'; g.fillRect(x + 6, y + 6, 244, 188);
      const gr = g.createLinearGradient(0, y + 16, 0, y + 150); const skies = [['#7ec8ff', '#d8f0ff'], ['#f6a96b', '#ffe1b3'], ['#3b4b8c', '#a3b1e8'], ['#9fd3ff', '#fff4d6']][Math.floor(sk * 4)];
      gr.addColorStop(0, skies[0]); gr.addColorStop(1, skies[1]); g.fillStyle = gr; g.fillRect(x + 16, y + 16, 224, 134);
      g.fillStyle = '#7ccf6a'; g.fillRect(x + 16, y + 128, 224, 22);
      g.fillStyle = '#efe4cc'; g.fillRect(x + 140, y + 40, 40, 100); g.fillStyle = '#9a3434'; g.beginPath(); g.moveTo(x + 134, y + 42); g.lineTo(x + 160, y + 14); g.lineTo(x + 186, y + 42); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 160, y + 66, 12, 0, 7); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 2; g.stroke();
      const cx = x + 96 + (R() - 0.5) * 20; g.fillStyle = '#f2c230'; g.fillRect(cx - 14, y + 92, 28, 26); g.fillStyle = '#3d5a9e'; g.fillRect(cx - 12, y + 118, 24, 20); g.fillStyle = '#f1c6a0'; g.fillRect(cx - 12, y + 70, 24, 22); g.fillStyle = '#8a3b1e'; g.fillRect(cx - 14, y + 64, 28, 8); g.fillRect(cx - 14, y + 64, 6, 30); g.fillRect(cx + 8, y + 64, 6, 30);
      g.fillStyle = '#1b1b22'; g.fillRect(cx - 6, y + 78, 3, 5); g.fillRect(cx + 3, y + 78, 3, 5);
      g.fillStyle = '#3a3340'; g.font = '30px "Permanent Marker"'; g.textAlign = 'left'; g.fillText('#' + n, x + 18, y + 184);
      g.fillStyle = 'rgba(0,0,0,' + (0.04 + R() * 0.12) + ')'; g.fillRect(x + 6, y + 6, 244, 188);
    }
  });
  const wallW = cols * (pw + gap), wallH = rows * (ph + gap);
  const photos = new THREE.Group(); photos.position.set(0, 13.5, -11.6); G.add(photos); N.photos = photos;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const geo = new THREE.PlaneGeometry(pw, ph); const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (c + uv.getX(i)) / cols, 1 - (r + 1 - uv.getY(i)) / rows);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.8 })); const R2 = (r * 31 + c * 17) % 7;
    m.position.set(-wallW / 2 + c * (pw + gap) + pw / 2, wallH / 2 - r * (ph + gap) - ph / 2, 0.02 * (R2 % 3)); m.rotation.z = (R2 - 3) * 0.012; photos.add(m);
    photos.add(put(sphere(0.12, mat(['#e34968', '#2a78d6', '#eda100', '#14a08c'][R2 % 4]), 8, 6), m.position.x, m.position.y + ph / 2 - 0.15, 0.12));
  }
  N.wall = { w: wallW, h: wallH, pw, ph, gap, cols, rows };
  return G;
}

// ---------- stacked towns diagram ----------
export function buildStack() {
  const G = new THREE.Group(); const N = G.userData.named = {}; const R = rng(91);
  const LAYERS = 16, GAP = 7; N.GAP = GAP; N.layers = [];
  const pal = ['#f7b9c8', '#bff2e3', '#d9cff7', '#fff0c4', '#bfe0ff', '#ffd9c2'];
  const earth = mat('#4a3427', { rough: 1 });
  G.add(put(box(64, LAYERS * GAP + 20, 2, mat('#2a1d16', { rough: 1 }), 0), 0, -(LAYERS * GAP) / 2 + 2, -16));
  for (let i = 0; i < LAYERS; i++) {
    const L = new THREE.Group(); L.position.y = -i * GAP; G.add(L); N.layers.push(L);
    const k = Math.min(1, i / 9);
    L.add(put(box(60, 1.2, 30, mat(tint(i === 0 ? '#7fcf6b' : '#8a8478', k * 0.7, '#120c09'), { rough: 1 }), 0.1), 0, -0.6, 0));
    L.add(put(box(60, GAP - 1.2 - 4.6, 30, earth, 0.1, false), 0, -1.2 - (GAP - 5.8) / 2, 0));
    const tc = (c) => tint(c, i === 0 ? 0 : 0.35 + k * 0.5, '#0d0a08');
    for (let b = 0; b < 12; b++) { const h = 1.2 + R() * 2.4; const m = box(2.4 + R() * 1.5, h, 2.4, mat(tc(pal[b % 6])), 0.15); m.position.set(-26 + b * 4.6, h / 2, (R() - 0.5) * 16); if (i > 0) m.rotation.z = (R() - 0.5) * 0.15 * k; L.add(m); }
    const t = box(2, 5, 2, mat(tc('#efe4cc')), 0.15); t.position.set(0, 2.5, -4); L.add(t); L.add(put(sphere(0.55, basic(i === 0 ? '#ffffff' : tc('#fff3c8')), 10, 8), 0, 3.8, -2.95));
    for (let p = 0; p < 10; p++) L.add(put(box(0.35, 0.8, 0.35, mat(tc(['#f2c230', '#e34968', '#2a78d6', '#14a08c'][p % 4])), 0.08), -24 + p * 5.3 + R(), 0.4, 6 + R() * 4));
    if (i > 0) { const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(256, 128, (g, w, h) => { g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = '800 72px Poppins'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('#' + (99 - i), w / 2, h / 2); }), transparent: true, fog: false })); lab.scale.set(4, 2, 1); lab.position.set(34, 1.5, 0); L.add(lab); }
  }
  N.top = new THREE.Group(); G.add(N.top); // the newest layer (assembling)
  N.top.add(put(box(60, 1.2, 30, mat('#7fcf6b', { rough: 1 }), 0.1), 0, -0.6, 0));
  for (let b = 0; b < 12; b++) { const h = 1.2 + R() * 2.4; const m = box(2.4 + R() * 1.5, h, 2.4, mat(pal[b % 6]), 0.15); m.position.set(-26 + b * 4.6, h / 2, (R() - 0.5) * 16); N.top.add(m); }
  N.top.add(put(box(2, 5, 2, mat('#efe4cc'), 0.15), 0, 2.5, -4));
  prepAssemble(N.top);
  return G;
}
