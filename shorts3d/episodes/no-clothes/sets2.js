// Sets for "What if people never normalized wearing clothes?" (part 2: runway, restaurant, office, cave, stadium,
// factory, snowy street, dinner party). Imports from sets.js are only used inside functions (the modules import
// each other).
import * as THREE from 'three';
import { blink } from '../../kit/character.js';
import * as P from '../../kit/props.js';
import { skyDome, skyEnvironment, ThoughtBubble, ease, ramp, lerp, clamp01 } from '../../kit/fx.js';
import { V, PI, person, wear, REST, SIT, walkNodes, bob, sun, canvasTex, signTex, signPlane, T3, labelBox, towelMat, world } from './sets.js';

const lathe = (pts, seg = 40) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
function nameTag(name) {
  const tex = canvasTex(256, 180, (c, w, h) => {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#d62f2f'; c.fillRect(0, 0, w, 74); c.fillRect(0, h - 14, w, 14);
    c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.font = '900 40px Helvetica, Arial'; c.fillText('HELLO', w / 2, 38);
    c.font = '700 20px Helvetica, Arial'; c.fillText('my name is', w / 2, 63);
    c.fillStyle = '#1a1a1a'; c.font = 'italic 900 58px Helvetica, Arial'; c.fillText(name, w / 2, 128);
  });
  return P.mesh(new THREE.PlaneGeometry(0.1, 0.07), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }), { cast: false });
}
// stick a name tag on a person's chest (body-local; the torso front at x 0.075, y 1.33 faces ~(0.28, 0.24, 0.93))
export function tagOn(c, name, belly = 0) {
  const t = nameTag(name);
  t.position.set(0.075, 1.33, 0.097 + belly * 0.07); t.rotation.set(-0.24, 0.29, 0);
  c.nodes.body.add(t);
  return t;
}
function audience(n, seed, area, dark = true) {
  const r = P.rng(seed);
  const bodies = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.2, 0.35, 4, 10), P.phys('#ffffff', { roughness: 0.8 }), n);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 14, 10), P.phys('#ffffff', { roughness: 0.7 }), n);
  const M = new THREE.Matrix4(), C = new THREE.Color();
  const skins = ['#e3b28f', '#c58c66', '#8d5a3c', '#f0c8a8', '#5a3a28', '#d9a27e'];
  const pos = [];
  for (let i = 0; i < n; i++) {
    const p = area(i, r); pos.push(p);
    M.makeTranslation(p.x, p.y + 0.38, p.z); bodies.setMatrixAt(i, M);
    bodies.setColorAt(i, C.set(dark ? ['#2a2440', '#3a2a30', '#1e2a3a', '#40303a'][i % 4] : skins[i % skins.length]));
    M.makeTranslation(p.x, p.y + 0.82, p.z); heads.setMatrixAt(i, M); heads.setColorAt(i, C.set(skins[(i * 7) % skins.length]).multiplyScalar(dark ? 0.55 : 1));
  }
  bodies.castShadow = heads.castShadow = !dark;
  return { bodies, heads, pos };
}

// =========================================================================================================
// RUNWAY ("Paint Week") + backstage vanity
export function runway(engine) {
  const scene = new THREE.Scene();
  const R = {};
  scene.background = new THREE.Color('#06060b');
  scene.add(P.mesh(new THREE.PlaneGeometry(60, 60).rotateX(-PI / 2), P.phys('#121218', { roughness: 0.35, clearcoat: 0.6 }), { cast: false }));
  scene.add(P.mesh(P.rbox(2.4, 0.5, 14, 0.03), P.phys('#f2f0ec', { roughness: 0.12, clearcoat: 1 }), { y: 0.25, z: -5.2 }));
  for (const s of [-1, 1]) scene.add(P.mesh(new THREE.BoxGeometry(0.04, 0.04, 14), P.phys('#ffffff', { emissive: '#ff5fa8', emissiveIntensity: 2.5 }), { x: s * 1.21, y: 0.48, z: -5.2, cast: false }));
  scene.add(P.mesh(new THREE.PlaneGeometry(16, 8), P.phys('#1a1030', { roughness: 0.6 }), { y: 4, z: -12.6, cast: false }));
  const sign = signPlane(['PAINT WEEK'], 5.2, 1.0, { bg: '#1a1030', fg: '#ff5fa8', glow: 1.8 }); sign.position.set(0, 4.7, -12.55); scene.add(sign);
  R.curtains = [-1, 1].map((s) => { const m = P.mesh(P.rbox(1.3, 3.0, 0.1, 0.05), P.phys('#6a1a4a', { roughness: 0.9, sheen: 1, sheenColor: new THREE.Color('#ff7ab8') }), { x: s * 0.65, y: 2.0, z: -12.25 }); scene.add(m); return m; });
  scene.add(P.mesh(P.rbox(3.0, 0.3, 0.3, 0.05), P.phys('#2a2a33', { metalness: 0.6 }), { y: 3.6, z: -12.2 }));
  // audience in the dark on both sides, a few phone screens
  for (const s of [-1, 1]) {
    const a = audience(66, s > 0 ? 3 : 4, (i, r) => V(s * (2.2 + (i % 3) * 0.75 + r() * 0.1), (i % 3) * 0.25, -11 + Math.floor(i / 3) * 0.6 + r() * 0.1));
    scene.add(a.bodies, a.heads);
    for (let i = 0; i < 9; i++) { const p = a.pos[i * 7 + 2]; scene.add(P.mesh(new THREE.PlaneGeometry(0.07, 0.12), P.phys('#ffffff', { emissive: '#bfe0ff', emissiveIntensity: 2.2 }), { x: p.x - s * 0.18, y: p.y + 0.95, z: p.z, ry: -s * PI / 2, cast: false })); }
  }
  // photographers at the end of the runway
  R.flashes = [];
  for (let i = 0; i < 7; i++) {
    const x = -2.4 + i * 0.8, z = 3.2 + (i % 2) * 0.5;
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    g.add(P.mesh(new THREE.CapsuleGeometry(0.22, 0.8, 4, 10), P.phys('#20202a', { roughness: 0.8 }), { y: 0.75 }), P.mesh(new THREE.SphereGeometry(0.13, 14, 10), P.phys('#4a3a30'), { y: 1.42 }));
    g.add(P.mesh(P.rbox(0.18, 0.12, 0.14, 0.02), P.phys('#111111', { roughness: 0.3 }), { y: 1.38, z: -0.18 }));
    const f = P.mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }), { y: 1.5, z: -0.22, cast: false });
    g.add(f); R.flashes.push(f);
  }
  R.flashLight = new THREE.PointLight('#ffffff', 0, 14, 1.6); scene.environmentIntensity = 0.25; R.flashLight.position.set(0, 1.8, 2.6); scene.add(R.flashLight);
  // lights
  scene.add(new THREE.HemisphereLight('#5a4a7a', '#0a0a10', 0.35));
  R.spots = [];
  for (const [x, z, col] of [[0, -9, '#ffd6f0'], [0, -4.5, '#ffffff'], [0, 0, '#ffffff'], [-2.5, -2, '#ff8ad0'], [2.5, -2, '#8ad0ff']]) {
    const s = new THREE.SpotLight(col, 32, 22, 0.36, 0.5, 1.4); s.position.set(x, 7.5, z + 1.5); s.target.position.set(0, 0.5, z); s.castShadow = x === 0 && z === 0; scene.add(s, s.target); R.spots.push(s);
  }
  R.spots[2].shadow.mapSize.set(1024, 1024);
  // models
  R.leopard = person('leopard', 0, 0.5, -10); scene.add(R.leopard.root); wear(R.leopard, 'pack', false);
  R.tux = person('tux', 0, 0.5, -12); scene.add(R.tux.root);
  // backstage vanity (x = 12): mirror with bulbs, the painter at work on the diva's arm, a tattooed guest
  const bs = new THREE.Group(); bs.position.set(12, 0, 0); scene.add(bs); R.bs = bs;
  bs.add(P.mesh(new THREE.PlaneGeometry(8, 4), P.phys('#2a2238', { roughness: 0.8 }), { y: 2, z: -1.4, cast: false }));
  bs.add(P.mesh(new THREE.PlaneGeometry(8, 8).rotateX(-PI / 2), P.phys('#3a3040', { roughness: 0.6 }), { y: 0.002, cast: false }));
  bs.add(P.mesh(P.rbox(1.6, 1.1, 0.06, 0.03), P.phys('#d9c8a8', { roughness: 0.4 }), { x: -0.2, y: 1.55, z: -1.35 }));
  bs.add(P.mesh(new THREE.PlaneGeometry(1.4, 0.9), P.phys('#b8c4d0', { roughness: 0.05, metalness: 0.9 }), { x: -0.2, y: 1.55, z: -1.31, cast: false }));
  for (let i = 0; i < 14; i++) { const t = i / 13; const [x, y] = t < 0.5 ? [-1.0 + t * 2 * 1.6, 2.1] : [-1.0, 1.0 + (t - 0.5) * 2 * 1.1]; bs.add(P.mesh(new THREE.SphereGeometry(0.04, 12, 8), P.phys('#fff2d0', { emissive: '#ffe8b0', emissiveIntensity: 2.2 }), { x, y, z: -1.3, cast: false })); }
  for (let i = 0; i < 7; i++) bs.add(P.mesh(new THREE.SphereGeometry(0.04, 12, 8), P.phys('#fff2d0', { emissive: '#ffe8b0', emissiveIntensity: 2.2 }), { x: 0.6, y: 1.0 + i * 0.18, z: -1.3, cast: false }));
  bs.add(P.mesh(P.rbox(2.0, 0.06, 0.6, 0.02), P.phys('#efe6d6', { roughness: 0.5 }), { x: -0.2, y: 0.9, z: -1.05 }));
  const pots = ['#e8423a', '#2e7ce0', '#f4c22e', '#3fae5a', '#9b4fd1'];
  pots.forEach((col, i) => bs.add(P.mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 20), P.phys(col, { roughness: 0.3, clearcoat: 0.8 }), { x: -0.8 + i * 0.15, y: 0.965, z: -1.0 })));
  const vl = new THREE.PointLight('#ffe8c8', 2.4, 6, 2); vl.position.set(0.6, 1.9, 0.3); bs.add(vl);
  const vk = new THREE.DirectionalLight('#ffffff', 0.7); vk.position.set(14, 4, 3); vk.target.position.set(12, 1.2, 0); scene.add(vk, vk.target);
  R.diva = person('diva', 11.75, -0.38, -0.55, 0.5); scene.add(R.diva.root);
  R.painter = person('painter', 12.55, 0, -0.1, -1.6); scene.add(R.painter.root); wear(R.painter, 'pack', false);
  R.tat = person('guest_d', 13.6, 0, -0.5, -0.4); scene.add(R.tat.root); wear(R.tat, 'pack', false);
  scene.add(P.mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.5, 24), P.phys('#d23b6a', { roughness: 0.5 }), { x: 11.75, y: 0.25, z: -0.55 }));
  // brush + the stroke it paints (a spiral on the diva's upper arm)
  R.brush = new THREE.Group(); scene.add(R.brush);
  R.brush.add(P.mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.2, 10), P.phys('#2a2a2a', { roughness: 0.4 }), { y: 0.1 }));
  R.brush.add(P.mesh(new THREE.ConeGeometry(0.012, 0.035, 12).rotateX(PI), P.phys('#2e7ce0', { roughness: 0.5 }), { y: -0.017 }));
  {
    const a = new THREE.Vector3(0.0, -0.02, 0.0), d = new THREE.Vector3(0.035, -0.24, 0.01);
    const ax = d.clone().normalize(), p1 = new THREE.Vector3().crossVectors(ax, V(0, 0, 1)).normalize(), p2 = new THREE.Vector3().crossVectors(ax, p1).normalize();
    const pts = [];
    for (let i = 0; i <= 80; i++) { const u = i / 80, th = u * PI * 5; pts.push(a.clone().addScaledVector(d, u).addScaledVector(p1, Math.cos(th) * 0.05).addScaledVector(p2, Math.sin(th) * 0.05)); }
    R.strokeGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.0075, 8, false);
    R.stroke = P.mesh(R.strokeGeo, P.phys('#2e7ce0', { roughness: 0.25, clearcoat: 0.8 }), { cast: false });
    R.diva.nodes.arm_l.add(R.stroke);
    R.strokePts = pts;
  }
  return {
    scene, R, bloom: { strength: 0.35, threshold: 0.9 }, exposure: 0.9,
    update(c) {
      const t = c.t;
      const fl = (i) => { const k = (t * 3.1 + i * 0.37) % 1; return k < 0.06 ? 1 : 0; };
      let any = 0;
      R.flashes.forEach((f, i) => { const on = fl(i) * (c.shot.flashes ?? 0); f.visible = on > 0; any = Math.max(any, on); });
      R.flashLight.intensity = any * 22;
      R.curtains.forEach((m, i) => { m.position.x = (i ? 1 : -1) * 0.65; });
      R.leopard.root.visible = R.tux.root.visible = true;
      R.leopard.root.position.set(0, 0.5, -13.5); R.tux.root.position.set(0.5, 0.5, -13.5);
      R.stroke.geometry.setDrawRange(0, 0);
      R.diva.pose({ lids: blink(t, 2), head: [0.05, -0.35, 0], nodes: { ...REST, ...SIT, arm_l: [-0.2, 0, 0.75], fore_l: [-0.1, 0, 0] } });
      R.painter.pose({ lids: blink(t, 5), head: [0.25, 0.1, 0], nodes: { ...REST, arm_r: [-1.1, 0.3, -0.1], fore_r: [-0.7, 0, 0], arm_l: [-0.5, 0, 0.1], fore_l: [-0.9, 0, 0] } });
      R.tat.pose({ lids: blink(t, 7), nodes: { ...REST } });
    },
  };
}

// =========================================================================================================
// RESTAURANT: the chef behind a steel pass
export function restaurant(engine) {
  const scene = new THREE.Scene();
  const R = {};
  scene.background = new THREE.Color('#2a2420');
  const tiles = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#f2f2ee'; c.fillRect(0, 0, w, h); c.strokeStyle = '#c8c8c2'; c.lineWidth = 6; for (let y = 0; y <= h; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } for (let x = 0; x <= w; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } });
  tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping; tiles.repeat.set(5, 2);
  scene.add(P.mesh(new THREE.PlaneGeometry(8, 3.2), P.phys('#ffffff', { map: tiles, roughness: 0.3, clearcoat: 0.4 }), { y: 1.6, z: -1.6, cast: false }));
  scene.add(P.mesh(new THREE.PlaneGeometry(8, 8).rotateX(-PI / 2), P.phys('#5a504a', { roughness: 0.8 }), { cast: false }));
  const steel = P.phys('#c9cdd2', { metalness: 0.85, roughness: 0.28 });
  scene.add(P.mesh(P.rbox(3.2, 1.0, 0.7, 0.02), steel, { y: 0.5, z: 0.65 }));
  scene.add(P.mesh(P.rbox(3.0, 0.9, 0.7, 0.02), steel, { y: 0.45, z: -1.2 }));
  for (const x of [-0.6, 0.6]) scene.add(P.mesh(new THREE.TorusGeometry(0.12, 0.015, 8, 30).rotateX(PI / 2), P.phys('#2a2a2a'), { x, y: 0.91, z: -1.15 }));
  R.flamesBack = [-0.6, 0.6].map((x) => { const f = P.mesh(new THREE.ConeGeometry(0.1, 0.22, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#4aa8ff', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }), { x, y: 1.0, z: -1.15, cast: false }); scene.add(f); return f; });
  scene.add(P.mesh(new THREE.CylinderGeometry(0.02, 0.02, 3, 8).rotateZ(PI / 2), steel, { y: 2.25, z: -1.45 }));
  for (let i = 0; i < 6; i++) { const g = new THREE.Group(); g.position.set(-1.25 + i * 0.5, 2.15, -1.45); scene.add(g); g.add(P.mesh(new THREE.CylinderGeometry(0.13 + (i % 3) * 0.03, 0.12 + (i % 3) * 0.03, 0.05, 28), P.phys('#3a3a3e', { metalness: 0.6, roughness: 0.35 }), { y: -0.25, rx: PI / 2 })); g.add(P.mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 6), steel, { y: -0.1 })); }
  scene.add(P.mesh(P.rbox(2.8, 0.04, 0.3, 0.01), steel, { y: 1.55, z: -1.45 }));
  for (let i = 0; i < 9; i++) scene.add(P.mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.18, 14), P.phys(['#d9a03a', '#8a3a2a', '#3a6a2a', '#efe6d6'][i % 4], { roughness: 0.3, clearcoat: 0.6 }), { x: -1.2 + i * 0.3, y: 1.66, z: -1.45 }));
  scene.add(P.mesh(P.rbox(0.9, 0.06, 0.35, 0.02), P.phys('#8a5a3a', { roughness: 0.6 }), { x: 0.9, y: 1.03, z: 0.6 }));
  for (let i = 0; i < 4; i++) scene.add(P.mesh(new THREE.SphereGeometry(0.06, 14, 10), P.phys(['#e8423a', '#f4c22e', '#3fae5a', '#ff8a2a'][i], { roughness: 0.4 }), { x: 0.65 + i * 0.16, y: 1.1, z: 0.6 }));
  R.chef = person('chef', 0, 0, -0.25); scene.add(R.chef.root); wear(R.chef, 'pack', false);
  R.pan = new THREE.Group(); scene.add(R.pan);
  R.pan.add(P.mesh(lathe([[0.0001, 0], [0.15, 0], [0.17, 0.06], [0.162, 0.06], [0.142, 0.008], [0.0001, 0.008]], 40), P.phys('#2a2b2e', { metalness: 0.5, roughness: 0.35, side: THREE.DoubleSide })));
  R.pan.add(P.mesh(P.rbox(0.04, 0.025, 0.28, 0.01), P.phys('#141414'), { y: 0.04, z: -0.28 }));
  R.food = ['#e8423a', '#3fae5a', '#f4c22e', '#ff8a2a', '#e8423a', '#3fae5a'].map((col) => { const m = P.mesh(new THREE.BoxGeometry(0.035, 0.035, 0.035), P.phys(col, { roughness: 0.4 })); scene.add(m); return m; });
  R.flame = P.mesh(new THREE.ConeGeometry(0.16, 0.5, 18, 1, true), new THREE.MeshBasicMaterial({ color: '#ff8a2a', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), { cast: false });
  scene.add(R.flame);
  scene.environmentIntensity = 0.3;
  scene.add(new THREE.HemisphereLight('#fff2e0', '#5a4a3a', 0.3));
  sun(scene, '#fff0dc', 1.6, V(2, 4, 4), V(0, 1.1, 0), 3);
  R.fireL = new THREE.PointLight('#ff8a3a', 1.5, 3, 2); scene.add(R.fireL);
  return {
    scene, R, bloom: { strength: 0.35, threshold: 0.9 }, exposure: 0.8,
    update(c) {
      const t = c.t;
      R.flamesBack.forEach((f, i) => { f.scale.set(1, 0.8 + 0.25 * Math.sin(t * 23 + i * 2), 1); });
      const toss = (t * 1.25) % 1;
      const lift = Math.sin(Math.min(1, toss / 0.3) * PI) * 0.12;
      R.chef.pose({ lids: blink(t, 4), head: [0.18, 0.05, 0], look: [0, -0.3], nodes: { ...REST, arm_r: [-0.95 - lift * 2, 0.15, -0.15], fore_r: [-0.75, 0, 0], arm_l: [-0.6, 0, 0.15], fore_l: [-1.0, 0, 0] } });
      const hand = world(R.chef, 'fore_r', [-0.01, -0.29, 0.06]);
      R.pan.position.copy(hand).add(V(0.0, -0.02, 0.3)); R.pan.rotation.set(-0.1 - lift * 1.5, 0, 0);
      R.food.forEach((m, i) => {
        const k = ((t * 1.25 + i * 0.03) % 1), h = Math.max(0, Math.sin(k * PI)) * 0.35;
        m.position.copy(R.pan.position).add(V((i - 2.5) * 0.04, 0.05 + h, Math.sin(i * 2.1) * 0.05 - h * 0.15)); m.rotation.set(t * 6 + i, t * 4, i);
      });
      R.flame.position.copy(R.pan.position).add(V(0, 0.3, 0)); R.flame.scale.set(1, 0.7 + 0.4 * Math.abs(Math.sin(t * 11)), 1);
      R.fireL.position.copy(R.pan.position).add(V(0, 0.35, 0.1)); R.fireL.intensity = 1.5 + 0.7 * Math.sin(t * 17);
    },
  };
}

// =========================================================================================================
// OFFICE: open plan with low cubicles, thermostat, printer; the boss's office; the dress-code poster
export function office(engine) {
  const scene = new THREE.Scene();
  const R = {};
  scene.background = new THREE.Color('#dfe6ec');
  const carpet = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#5f6f86'; c.fillRect(0, 0, w, h); const r = P.rng(3); for (let i = 0; i < 4000; i++) { c.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'; c.fillRect(r() * w, r() * h, 2, 2); } });
  carpet.wrapS = carpet.wrapT = THREE.RepeatWrapping; carpet.repeat.set(10, 10);
  scene.add(P.mesh(new THREE.PlaneGeometry(40, 20).rotateX(-PI / 2), P.phys('#ffffff', { map: carpet, roughness: 0.95 }), { x: 4, cast: false }));
  const wallM = P.phys('#eef1f4', { roughness: 0.9 });
  scene.add(P.mesh(new THREE.BoxGeometry(40, 3.2, 0.2), wallM, { x: 4, y: 1.6, z: -6 }));
  const sky = canvasTex(1024, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#8cc4f2'); g.addColorStop(1, '#dff0fb'); c.fillStyle = g; c.fillRect(0, 0, w, h); const r = P.rng(7); let x = 0; while (x < w) { const bw = 40 + r() * 90, bh = 60 + r() * 170; c.fillStyle = ['#9fb2c0', '#c9b8a2', '#b8c4cc'][Math.floor(r() * 3)]; c.fillRect(x, h - bh, bw, bh); x += bw + 6; } });
  for (let x = -12; x <= 20; x += 4) scene.add(P.mesh(new THREE.PlaneGeometry(3.6, 1.8), new THREE.MeshBasicMaterial({ map: sky }), { x, y: 1.7, z: -5.88, cast: false }));
  for (let x = -14; x <= 22; x += 4) scene.add(P.mesh(new THREE.BoxGeometry(0.2, 3.2, 0.3), P.phys('#d9dde2'), { x, y: 1.6, z: -5.85 }));
  // open office: cubicle pods with seated coworkers (heads above the low walls)
  R.workers = [];
  const pods = [[0.9, 0.6], [0.25, -0.65], [-0.4, -1.9], [-1.05, -3.15]];
  const names = ['guest_a', 'stripes', 'guest_c', 'guest_b'];
  pods.forEach(([x, z], i) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const w1 = P.cubicleWall(1.3, 1.05, '#7f91a6'); w1.position.z = 0.95; g.add(w1);
    const w2 = P.cubicleWall(1.2, 1.05, '#7f91a6'); w2.rotation.y = PI / 2; w2.position.set(-0.68, 0, 0.35); g.add(w2);
    g.add(P.mesh(P.rbox(1.5, 0.04, 0.65, 0.01), P.phys('#d9c4a0', { roughness: 0.5 }), { y: 0.74, z: 0.5 }));
    g.add(P.mesh(P.rbox(0.34, 0.015, 0.24, 0.005), P.phys('#2a2b30'), { y: 0.77, z: 0.45 }), P.mesh(P.rbox(0.34, 0.22, 0.012, 0.005), P.phys('#2a2b30'), { y: 0.88, z: 0.57, rx: 0.25 }));
    const c = person(names[i], x, -0.33, z - 0.05, 0); scene.add(c.root); c.seed = i + 1;
    tagOn(c, ['MAYA', 'LEO', 'JUNE', 'OMAR'][i]);
    R.workers.push(c);
  });
  // thermostat on a pillar
  scene.add(P.mesh(new THREE.BoxGeometry(0.6, 3.2, 0.6), wallM, { x: 3.4, y: 1.6, z: -1.2 }));
  R.thermo = new THREE.Group(); R.thermo.position.set(3.4, 1.45, -0.89); scene.add(R.thermo);
  R.thermo.add(P.mesh(P.rbox(0.22, 0.3, 0.04, 0.02), P.phys('#f7f7f5', { roughness: 0.3, clearcoat: 0.6 })));
  R.thermoCanvas = document.createElement('canvas'); R.thermoCanvas.width = 256; R.thermoCanvas.height = 160;
  R.thermoTex = new THREE.CanvasTexture(R.thermoCanvas); R.thermoTex.colorSpace = THREE.SRGBColorSpace;
  R.thermo.add(P.mesh(new THREE.PlaneGeometry(0.16, 0.1), new THREE.MeshStandardMaterial({ map: R.thermoTex, emissive: '#ffffff', emissiveMap: R.thermoTex, emissiveIntensity: 1.2 }), { y: 0.05, z: 0.021, cast: false }));
  for (const [y, col] of [[-0.06, '#e3342f'], [-0.11, '#2e7ce0']]) R.thermo.add(P.mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 16).rotateX(PI / 2), P.phys(col), { y, z: 0.024 }));
  R.setTemp = (v) => {
    if (R.lastTemp === v) return; R.lastTemp = v;
    const g = R.thermoCanvas.getContext('2d');
    g.fillStyle = '#0d1a14'; g.fillRect(0, 0, 256, 160);
    g.fillStyle = v >= 80 ? '#ffb020' : '#7dffb0'; g.font = 'bold 110px "DejaVu Sans Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(`${v}°`, 128, 84); R.thermoTex.needsUpdate = true;
  };
  R.setTemp(68);
  R.big82 = T3('82°F', { size: 0.42, depth: 0.12, color: '#ff6a2a', emissive: 0.15 }); R.big82.group.position.set(0.0, 2.15, -1.2); scene.add(R.big82.group);
  // printer + the heating bill
  const pr = new THREE.Group(); pr.position.set(4.6, 0, 0.6); scene.add(pr);
  pr.add(P.mesh(P.rbox(0.9, 0.95, 0.7, 0.03), P.phys('#3a3d44', { roughness: 0.5 }), { y: 0.475 }));
  pr.add(P.mesh(P.rbox(0.9, 0.22, 0.7, 0.04), P.phys('#efefec', { roughness: 0.4, clearcoat: 0.4 }), { y: 1.06 }));
  pr.add(P.mesh(new THREE.BoxGeometry(0.4, 0.015, 0.05), P.phys('#1a1a1a'), { y: 1.13, z: 0.34 }));
  pr.add(P.mesh(P.rbox(0.3, 0.04, 0.2, 0.01), P.phys('#2a5a8a', { emissive: '#3a8aff', emissiveIntensity: 0.5 }), { x: 0.25, y: 1.18, z: 0.15 }));
  const billTex = canvasTex(256, 2048, (c, w, h) => { c.fillStyle = '#fbfbf7'; c.fillRect(0, 0, w, h); c.fillStyle = '#1a1a1a'; c.font = '900 34px Helvetica'; c.textAlign = 'center'; c.fillText('HEATING BILL', w / 2, 60); c.font = '20px "DejaVu Sans Mono", monospace'; c.textAlign = 'left'; for (let y = 110; y < h - 40; y += 30) { c.fillText('HEAT ......', 20, y); c.textAlign = 'right'; c.fillText('$' + (900 + (y * 7) % 4000).toLocaleString('en-US'), w - 20, y); c.textAlign = 'left'; } });
  billTex.wrapT = THREE.RepeatWrapping;
  const segs = 120;
  R.billGeo = new THREE.PlaneGeometry(0.34, 1, 1, segs);
  R.bill = P.mesh(R.billGeo, new THREE.MeshStandardMaterial({ map: billTex, roughness: 0.8, side: THREE.DoubleSide }), { cast: true });
  scene.add(R.bill);
  R.printer = pr;
  const slot = V(4.6, 1.13, 0.96), rad = 0.14;
  const sA = 0.2, sB = sA + rad * PI / 2, sC = sB + (slot.y - rad - 0.004);
  const path = (sv) => {
    if (sv <= sA) return V(slot.x, slot.y, slot.z + sv);
    if (sv <= sB) { const th = (sv - sA) / rad; return V(slot.x, slot.y - rad + rad * Math.cos(th), slot.z + sA + rad * Math.sin(th)); }
    if (sv <= sC) return V(slot.x, slot.y - rad - (sv - sB), slot.z + sA + rad);
    const u = sv - sC; return V(slot.x + 0.05 * Math.sin(u * 3), 0.004 + 0.012 * Math.abs(Math.sin(u * 6)), slot.z + sA + rad + u);
  };
  R.setBill = (L) => {
    const pa = R.billGeo.attributes.position, uv = R.billGeo.attributes.uv;
    R.bill.visible = L > 0.01;
    for (let j = 0; j < pa.count; j++) {
      const row = Math.floor(j / 2), sv = Math.max(0, L * (row / segs));
      const q = path(sv);
      pa.setXYZ(j, q.x + (j % 2 ? 0.17 : -0.17), q.y, q.z);
      uv.setY(j, Math.min(0.97, (L - sv) / 6 + 0.36));   // text reads top-down along the hanging paper
    }
    pa.needsUpdate = true; uv.needsUpdate = true; R.billGeo.computeVertexNormals(); R.billGeo.computeBoundingSphere();
  };
  // the boss's office (x = 11): glass walls, executive desk with a modesty panel
  const bo = new THREE.Group(); bo.position.set(11, 0, -1.5); scene.add(bo);
  for (const [x, z, w, ry] of [[-2.2, 0, 4.4, PI / 2], [0, 2.2, 1.6, 0]]) bo.add(P.mesh(new THREE.BoxGeometry(w, 2.6, 0.04), P.phys('#d9eef8', { roughness: 0.05, transparent: true, opacity: 0.22 }), { x: x + (ry ? 0 : -1.2), y: 1.3, z, ry, cast: false }));
  bo.add(P.mesh(P.rbox(1.9, 0.07, 0.9, 0.02), P.phys('#5a3a24', { roughness: 0.35, clearcoat: 0.6 }), { y: 0.78, z: 0.4 }));
  bo.add(P.mesh(P.rbox(1.85, 0.72, 0.06, 0.02), P.phys('#4a2e1c', { roughness: 0.4, clearcoat: 0.4 }), { y: 0.38, z: 0.82 }));
  for (const x of [-0.9, 0.9]) bo.add(P.mesh(P.rbox(0.08, 0.75, 0.86, 0.02), P.phys('#4a2e1c'), { x, y: 0.38, z: 0.4 }));
  const plate = signPlane(['THE BOSS'], 0.42, 0.09, { bg: '#d9b04a', fg: '#2a1a0a' }); plate.position.set(0, 0.86, 0.8); plate.rotation.x = -0.35; bo.add(plate);
  bo.add(P.mesh(P.rbox(0.44, 0.1, 0.06, 0.01), P.phys('#3a2414'), { y: 0.84, z: 0.78, rx: -0.35 }));
  bo.add(P.mesh(P.rbox(0.36, 0.02, 0.25, 0.01), P.phys('#2a2b30'), { x: -0.55, y: 0.825, z: 0.3 }));
  bo.add(P.mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.1, 16), P.phys('#f4f2ee', { roughness: 0.25, clearcoat: 0.6 }), { x: 0.6, y: 0.87, z: 0.45 }));
  bo.add(P.mesh(P.rbox(0.62, 1.0, 0.12, 0.05), P.phys('#1e1e22', { roughness: 0.4, clearcoat: 0.6 }), { y: 1.0, z: -0.9 }));
  bo.add(P.mesh(P.rbox(0.6, 0.1, 0.55, 0.04), P.phys('#1e1e22', { roughness: 0.4, clearcoat: 0.6 }), { y: 0.5, z: -0.55 }));
  const shelf = new THREE.Group(); shelf.position.set(1.5, 0, -1.2); bo.add(shelf);
  shelf.add(P.mesh(P.rbox(1.2, 2.0, 0.35, 0.02), P.phys('#6a4a30'), { y: 1.0 }));
  for (let i = 0; i < 18; i++) shelf.add(P.mesh(P.rbox(0.06, 0.26, 0.22, 0.005), P.phys(['#8a2a2a', '#2a4a8a', '#2a6a3a', '#d9b04a'][i % 4]), { x: -0.5 + (i % 9) * 0.12, y: 0.55 + Math.floor(i / 9) * 0.6, z: 0.08 }));
  const pl = P.plant(); pl.position.set(-1.6, 0, -1.0); bo.add(pl);
  R.boss = person('boss', 11, -0.32, -2.0, 0); scene.add(R.boss.root);
  R.boss2 = person('boss', 4.6, 0, 0.0, 0); scene.add(R.boss2.root);
  // the dress-code poster on an easel at the entrance (x = -7)
  const easel = new THREE.Group(); easel.position.set(-7, 0, 2.6); easel.rotation.y = 0.5; scene.add(easel); R.easel = easel;
  for (const x of [-0.35, 0.35]) easel.add(P.mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.7, 8), P.phys('#3a2a1e'), { x, y: 0.85, z: 0.0, rx: -0.08 }));
  const poster = signPlane(['DRESS CODE:', 'NAME TAG', 'ONLY'], 0.9, 1.15, { bg: '#fff7e0', fg: '#1d3a6a', border: '#1d3a6a', sizes: [96, 150, 120] });
  poster.position.set(0, 1.35, 0.05); easel.add(poster);
  R.sam = person('sam', -6.2, 0, 3.2, -2.4); scene.add(R.sam.root); wear(R.sam, 'apron', false); wear(R.sam, 'watch', false);
  R.samTag = tagOn(R.sam, 'SAM');
  scene.environmentIntensity = 0.3;
  scene.add(new THREE.HemisphereLight('#f6faff', '#6a6a70', 0.4));
  sun(scene, '#fff6ea', 2.0, V(4, 9, 6), V(2, 0, -1), 12);
  for (const [x, z] of [[-2, -1], [2, -1], [6, -1], [11, -1], [-6, 2]]) { const l = new THREE.PointLight('#fffaf2', 2.0, 7, 2); l.position.set(x, 2.9, z); scene.add(l); }
  return {
    scene, R, exposure: 0.85,
    update(c) {
      const t = c.t;
      R.workers.forEach((w) => w.pose({ lids: blink(t, w.seed), head: [0.05, 0.12 * Math.sin(t * 0.6 + w.seed), 0], nodes: { ...REST, ...SIT, arm_l: [-0.75, 0, 0.12], arm_r: [-0.75, 0, -0.12], fore_l: [-0.7, 0, 0], fore_r: [-0.7, 0, 0] } }));
      R.boss.pose({ lids: blink(t, 6), nodes: { ...REST, ...SIT, arm_l: [-0.6, 0, 0.15], arm_r: [-0.6, 0, -0.15], fore_l: [-0.9, 0, 0], fore_r: [-0.9, 0, 0] } });
      R.big82.group.visible = false;
      R.samTag.visible = true; R.samTag.scale.setScalar(1);
      R.sam.root.visible = true; R.boss2.root.visible = false;
      R.setTemp(68);
      R.setBill(0);
    },
  };
}

// =========================================================================================================
// CAVE: firelight, cave people in pelts, stone numbers; plus a macro "fur forest" (x = 40) for the louse
export function cave(engine) {
  const scene = new THREE.Scene();
  const R = {};
  scene.background = new THREE.Color('#050302');
  const shell = new THREE.SphereGeometry(6, 64, 40, 0, PI * 2, 0, PI * 0.62);
  const pos = shell.attributes.position, col = [];
  const r = P.rng(9);
  for (let i = 0; i < pos.count; i++) {
    const v = V(pos.getX(i), pos.getY(i), pos.getZ(i));
    const n = Math.sin(v.x * 1.3 + v.y * 0.7) * 0.25 + Math.sin(v.z * 2.1 + v.x * 0.4) * 0.18 + Math.sin(v.y * 3.3 + v.z) * 0.1;
    v.multiplyScalar(1 + n * 0.12); pos.setXYZ(i, v.x, v.y * 0.62, v.z);
    const k = 0.75 + n * 0.5; col.push(0.36 * k, 0.27 * k, 0.2 * k);
  }
  shell.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); shell.computeVertexNormals();
  scene.add(P.mesh(shell, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.BackSide }), { cast: false }));
  const dirt = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#4a3a2a'; c.fillRect(0, 0, w, h); const rr = P.rng(4); for (let i = 0; i < 3000; i++) { c.fillStyle = rr() > 0.5 ? 'rgba(255,230,200,0.06)' : 'rgba(0,0,0,0.1)'; c.fillRect(rr() * w, rr() * h, 3, 3); } });
  dirt.wrapS = dirt.wrapT = THREE.RepeatWrapping; dirt.repeat.set(4, 4);
  scene.add(P.mesh(new THREE.CircleGeometry(6.5, 48).rotateX(-PI / 2), P.phys('#ffffff', { map: dirt, roughness: 0.95 }), { cast: false }));
  for (let i = 0; i < 14; i++) { const a = r() * PI * 2, d = 2.5 + r() * 2.5; scene.add(P.mesh(new THREE.DodecahedronGeometry(0.15 + r() * 0.35, 0), P.std('#5a4a3a', { roughness: 0.95, flatShading: true }), { x: Math.cos(a) * d, y: 0.05, z: Math.sin(a) * d, ry: r() * 6 })); }
  // cave paintings
  const art = canvasTex(1024, 512, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.fillStyle = 'rgba(170,70,30,0.85)';
    const animal = (x, y, s) => { c.beginPath(); c.ellipse(x, y, 60 * s, 28 * s, 0, 0, PI * 2); c.fill(); c.fillRect(x - 45 * s, y + 10 * s, 8 * s, 50 * s); c.fillRect(x + 35 * s, y + 10 * s, 8 * s, 50 * s); c.beginPath(); c.ellipse(x + 65 * s, y - 18 * s, 22 * s, 14 * s, -0.4, 0, PI * 2); c.fill(); c.fillRect(x + 70 * s, y - 50 * s, 5 * s, 30 * s); };
    animal(250, 220, 1.4); animal(620, 180, 1.0); animal(800, 330, 0.8);
    c.fillStyle = 'rgba(60,30,20,0.8)'; for (let i = 0; i < 6; i++) { const x = 120 + i * 150, y = 420; c.beginPath(); c.arc(x, y, 22, 0, PI * 2); c.fill(); for (let f = 0; f < 5; f++) { c.save(); c.translate(x, y); c.rotate(-0.9 + f * 0.45); c.fillRect(-4, -55, 8, 34); c.restore(); } }
  });
  scene.add(P.mesh(new THREE.PlaneGeometry(4, 2), new THREE.MeshStandardMaterial({ map: art, transparent: true, roughness: 1 }), { y: 1.9, z: -4.3, cast: false }));
  // fire
  const fire = new THREE.Group(); scene.add(fire);
  for (let i = 0; i < 4; i++) fire.add(P.mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.8, 10).rotateZ(PI / 2), P.std('#3a2414', { roughness: 0.9 }), { y: 0.08, ry: i * PI / 4 }));
  for (let i = 0; i < 9; i++) { const a = i / 9 * PI * 2; fire.add(P.mesh(new THREE.DodecahedronGeometry(0.11, 0), P.std('#6a6058', { flatShading: true }), { x: Math.cos(a) * 0.5, y: 0.05, z: Math.sin(a) * 0.5 })); }
  R.flames = [];
  const fm = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 7; i++) { const f = P.mesh(new THREE.ConeGeometry(0.12 + (i % 3) * 0.05, 0.6 + (i % 2) * 0.3, 14, 1, true), fm(i % 2 ? '#ff7a1a' : '#ffc04a', 0.75), { x: Math.cos(i * 2.4) * 0.12, y: 0.35, z: Math.sin(i * 2.4) * 0.12, cast: false }); fire.add(f); R.flames.push(f); }
  scene.environmentIntensity = 0.12;
  R.fireLight = new THREE.PointLight('#ff8a3a', 6, 12, 1.6); R.fireLight.position.set(0, 0.9, 0); R.fireLight.castShadow = true; R.fireLight.shadow.mapSize.set(1024, 1024); scene.add(R.fireLight);
  scene.add(new THREE.HemisphereLight('#2a2a4a', '#1a0a04', 0.25));
  // logs to sit on + cave people
  for (const [x, z, ry] of [[-0.95, 0.35, 0.3], [0.95, 0.45, -0.3]]) scene.add(P.mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.1, 14).rotateZ(PI / 2), P.std('#4a3020', { roughness: 0.9 }), { x, y: 0.2, z, ry: ry + PI / 2 }));
  R.man = person('caveman', -0.9, -0.48, 0.38, PI / 2 - 0.25); scene.add(R.man.root);
  R.woman = person('cavewoman', 0.95, -0.48, 0.5, -PI / 2 + 0.25); scene.add(R.woman.root);
  const yg = new THREE.Group(); yg.position.set(0, 1.9, -1.6); scene.add(yg);
  const ya = T3('170,000', { size: 0.34, depth: 0.14, color: '#c9b89e', stone: true }), yb = T3('YEARS AGO', { size: 0.16, depth: 0.08, color: '#c9b89e', stone: true });
  yb.group.position.y = -0.3; yg.add(ya.group, yb.group); R.years = { group: yg };
  R.louse = person('louse'); R.louse.root.scale.setScalar(0.3); scene.add(R.louse.root);
  // macro fur forest (x = 40)
  const mac = new THREE.Group(); mac.position.set(40, 0, 0); scene.add(mac); R.mac = mac;
  mac.add(P.mesh(new THREE.PlaneGeometry(8, 8).rotateX(-PI / 2), P.phys('#6a4224', { roughness: 0.9 }), { cast: false }));
  const N = 2600, hair = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.004, 0.009, 0.5, 5).translate(0, 0.25, 0), P.phys('#8a5a32', { roughness: 0.6, sheen: 0.8 }), N);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), C = new THREE.Color(), rr = P.rng(21);
  for (let i = 0; i < N; i++) {
    let x = (rr() - 0.5) * 6, z = (rr() - 0.5) * 6;
    if (Math.abs(z) < 0.75 && x > -3 && x < 3) z += Math.sign(z || 1) * 0.75;
    E.set((rr() - 0.5) * 0.7, 0, (rr() - 0.5) * 0.7 + 0.25); Q.setFromEuler(E); S.set(1, 0.6 + rr() * 0.8, 1);
    M.compose(V(x, 0, z), Q, S); hair.setMatrixAt(i, M); hair.setColorAt(i, C.set('#8a5a32').multiplyScalar(0.6 + rr() * 0.6));
  }
  hair.castShadow = true; mac.add(hair);
  R.bigLouse = person('louse'); R.bigLouse.root.scale.setScalar(1.6); mac.add(R.bigLouse.root);
  const ml = new THREE.PointLight('#ffb070', 10, 8, 1.6); ml.position.set(1.2, 1.6, 1.5); mac.add(ml);
  const ml2 = new THREE.DirectionalLight('#ffd8a8', 1.5); ml2.position.set(42, 3, 2); ml2.target.position.set(40, 0, 0); scene.add(ml2, ml2.target);
  return {
    scene, R, bloom: { strength: 0.4, threshold: 0.85 }, grade: { warmth: 0.06, vignette: 0.5 }, exposure: 0.95,
    update(c) {
      const t = c.t;
      R.flames.forEach((f, i) => { const k = 0.75 + 0.35 * Math.sin(t * (13 + i * 3) + i) + 0.15 * Math.sin(t * 29 + i * 5); f.scale.set(1, k, 1); f.rotation.y = t * 2 + i; });
      R.fireLight.intensity = 6 + 1.3 * Math.sin(t * 17) + 0.8 * Math.sin(t * 31);
      R.man.pose({ lids: blink(t, 2), head: [0.15, 0.1, 0], nodes: { ...REST, ...SIT, arm_l: [-0.7, 0, 0.1], fore_l: [-0.8, 0, 0], arm_r: [-0.6, 0, -0.1], fore_r: [-0.8, 0, 0] } });
      R.woman.pose({ lids: blink(t, 5), head: [0.12, -0.1, 0], nodes: { ...REST, ...SIT, arm_l: [-0.9, 0, 0.1], fore_l: [-0.9, 0, 0], arm_r: [-0.9, 0, -0.1], fore_r: [-0.9, 0, 0] } });
      R.years.group.visible = false; R.louse.root.visible = false;
      R.louse.pose({});
    },
  };
}

// =========================================================================================================
// STADIUM: ancient Greek track, stone stands with toga spectators, colonnade, finish ribbon
export function stadium(engine) {
  const scene = new THREE.Scene();
  const R = {};
  const skyOpts = { top: '#2f7fd6', horizon: '#dff0fb', bottom: '#e2d2b0', sunDir: [0.3, 0.7, 0.5] };
  scene.add(skyDome(skyOpts)); scene.environment = skyEnvironment(engine, skyOpts);
  const sand = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#d9bf8f'; c.fillRect(0, 0, w, h); const r = P.rng(6); for (let i = 0; i < 5000; i++) { c.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(120,80,40,0.08)'; c.fillRect(r() * w, r() * h, 2, 2); } });
  sand.wrapS = sand.wrapT = THREE.RepeatWrapping; sand.repeat.set(30, 30);
  scene.add(P.mesh(new THREE.PlaneGeometry(300, 300).rotateX(-PI / 2), P.phys('#ffffff', { map: sand, roughness: 0.95 }), { cast: false }));
  for (const z of [-2.4, -0.8, 0.8, 2.4]) scene.add(P.mesh(new THREE.PlaneGeometry(90, 0.06).rotateX(-PI / 2), P.std('#f6efe0'), { y: 0.004, z, cast: false }));
  // stands (north) with spectators
  const stone = P.phys('#bfae92', { roughness: 0.9 });
  for (let i = 0; i < 5; i++) scene.add(P.mesh(new THREE.BoxGeometry(80, 0.45 * (i + 1), 0.9), stone, { y: 0.225 * (i + 1), z: -5.0 - i * 0.9 }));
  const a = audience(260, 11, (i, r) => V(-38 + (i % 52) * 1.45 + r() * 0.3, 0.45 * (Math.floor(i / 52) + 1) - 0.12, -5.0 - Math.floor(i / 52) * 0.9 - 0.1), false);
  scene.add(a.bodies, a.heads);
  R.fans = [['greek_a', 1.2], ['greek_b', 2.3], ['greek_a', -1.5], ['greek_b', 4.2], ['greek_a', 6.0], ['greek_b', -3.6]].map(([n, x], i) => {
    const c = person(n, 14 + x, 0.45 * (i % 2) + 0.45 - 0.82, -5.0 - (i % 2) * 0.9 + 0.1, 0); scene.add(c.root); c.seed = i; return c;
  });
  // colonnade (south) + a temple on the hill
  for (let x = -40; x <= 40; x += 3.2) {
    scene.add(P.mesh(new THREE.CylinderGeometry(0.35, 0.4, 5, 20), P.phys('#efe8da', { roughness: 0.7 }), { x, y: 2.5, z: 9 }));
    scene.add(P.mesh(P.rbox(1.0, 0.25, 1.0, 0.03), P.phys('#efe8da'), { x, y: 5.1, z: 9 }));
  }
  scene.add(P.mesh(new THREE.BoxGeometry(84, 0.6, 1.4), P.phys('#efe8da'), { y: 5.5, z: 9 }));
  const hill = P.mesh(new THREE.SphereGeometry(40, 32, 16, 0, PI * 2, 0, PI / 2), P.phys('#8aa860', { roughness: 0.95 }), { y: -28, z: -90, s: [2.4, 1, 1], cast: false }); scene.add(hill);
  const tmp = new THREE.Group(); tmp.position.set(-10, 12, -85); scene.add(tmp);
  tmp.add(P.mesh(new THREE.BoxGeometry(16, 1, 8), P.phys('#efe8da'), { y: 0.5 }));
  for (let x = -7; x <= 7; x += 2) tmp.add(P.mesh(new THREE.CylinderGeometry(0.4, 0.45, 5, 14), P.phys('#efe8da'), { x, y: 3.5, z: 3.5 }));
  const roof = new THREE.Shape(); roof.moveTo(-8.5, 0); roof.lineTo(8.5, 0); roof.lineTo(0, 2.5); roof.lineTo(-8.5, 0);
  tmp.add(P.mesh(new THREE.ExtrudeGeometry(roof, { depth: 8, bevelEnabled: false }), P.phys('#efe8da'), { y: 6, z: -4 }));
  // finish line
  for (const z of [-3.6, 3.6]) scene.add(P.mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.8, 12), P.phys('#efe8da'), { x: 20, y: 0.9, z }));
  R.ribbonL = P.mesh(new THREE.BoxGeometry(0.02, 0.06, 3.6), P.phys('#d62f2f', { roughness: 0.6 }), { x: 20, y: 1.25, z: -1.8 });
  R.ribbonR = P.mesh(new THREE.BoxGeometry(0.02, 0.06, 3.6), P.phys('#d62f2f', { roughness: 0.6 }), { x: 20, y: 1.25, z: 1.8 });
  scene.add(R.ribbonL, R.ribbonR);
  // runners
  R.runners = [['runner1', -1.6], ['runner2', 0], ['runner3', 1.6]].map(([n, z], i) => { const c = person(n, 0, 0, z, PI / 2); scene.add(c.root); c.lane = z; c.seed = i; wear(c, 'hat', false); return c; });
  // runner2's loincloth (on his body) and the one that flies away
  const clothM = P.phys('#f6f2e8', { roughness: 0.9, sheen: 0.6, side: THREE.DoubleSide });
  R.loin = P.mesh(new THREE.CylinderGeometry(0.19, 0.215, 0.2, 28, 1, true), clothM, { y: 0.88 });
  R.runners[1].nodes.body.add(R.loin);
  const fg = new THREE.PlaneGeometry(0.5, 0.26, 16, 8);
  R.flyGeo = fg; R.flyBase = Float32Array.from(fg.attributes.position.array);
  R.fly = P.mesh(fg, clothM); scene.add(R.fly);
  // stone letters
  R.word1 = T3('GYMNASIUM', { size: 0.21, depth: 0.09, color: '#b5532e', stone: true }); scene.add(R.word1.group);
  R.word2 = T3('GYMNOS', { size: 0.3, depth: 0.12, color: '#b5532e', stone: true }); scene.add(R.word2.group);
  R.word3 = T3('= NAKED', { size: 0.24, depth: 0.1, color: '#ffcf4a', emissive: 0.15 }); scene.add(R.word3.group);
  sun(scene, '#fff3dc', 2.6, V(10, 18, 12), V(4, 0, 0), 18);
  scene.add(new THREE.HemisphereLight('#dceeff', '#c9a87a', 0.35));
  return {
    scene, R, exposure: 0.88,
    update(c) {
      const t = c.t;
      R.fans.forEach((f) => f.pose({ lids: blink(t, f.seed), head: [0, 0.3 * Math.sin(t * 0.8 + f.seed), 0], nodes: { ...REST, ...SIT, arm_l: [-2.6 - 0.3 * Math.sin(t * 7 + f.seed), 0, 0.3], arm_r: [-2.6 - 0.3 * Math.sin(t * 7 + f.seed + 1), 0, -0.3], fore_l: [-0.3, 0, 0], fore_r: [-0.3, 0, 0] } }));
      R.ribbonL.position.set(20, 1.25, -1.8); R.ribbonR.position.set(20, 1.25, 1.8); R.ribbonL.rotation.set(0, 0, 0); R.ribbonR.rotation.set(0, 0, 0);
      R.loin.visible = true; R.fly.visible = false;
      R.runners.forEach((r) => { wear(r, 'hat', false); if (r.nodes.hat) r.nodes.hat.scale.setScalar(1); });
      R.word1.group.visible = R.word2.group.visible = R.word3.group.visible = false;
    },
  };
}

// =========================================================================================================
// FACTORY: sewing machines, racks of clothes, a conveyor; $1.7 trillion
export function factory(engine) {
  const scene = new THREE.Scene();
  const R = {};
  scene.background = new THREE.Color('#cfd6dc');
  scene.add(P.mesh(new THREE.PlaneGeometry(60, 60).rotateX(-PI / 2), P.phys('#9a9c9e', { roughness: 0.6, clearcoat: 0.2 }), { cast: false }));
  for (let x = -20; x <= 20; x += 5) scene.add(P.mesh(new THREE.BoxGeometry(0.3, 0.4, 40), P.phys('#5a6068', { metalness: 0.6 }), { x, y: 7, cast: false }));
  for (let z = -12; z <= 12; z += 4) scene.add(P.mesh(new THREE.PlaneGeometry(40, 1.2).rotateX(PI / 2), P.phys('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 }), { y: 6.8, z, cast: false }));
  scene.add(P.mesh(new THREE.PlaneGeometry(60, 10), P.phys('#b9c0c6'), { y: 5, z: -14, cast: false }));
  // sewing tables + machines (instanced)
  const T = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 0.05, 0.7), P.phys('#d9c8a8', { roughness: 0.5 }), 48);
  const Mc = new THREE.InstancedMesh(P.rbox(0.42, 0.3, 0.2, 0.05), P.phys('#f2f0ea', { roughness: 0.3, clearcoat: 0.6 }), 48);
  const Ar = new THREE.InstancedMesh(P.rbox(0.12, 0.08, 0.16, 0.03), P.phys('#d23b32', { roughness: 0.3 }), 48);
  const M = new THREE.Matrix4(); let i = 0;
  for (let row = 0; row < 6; row++) for (let col = 0; col < 8; col++) {
    const x = -7 + col * 2, z = -10 + row * 1.7;
    M.makeTranslation(x, 0.75, z); T.setMatrixAt(i, M); M.makeTranslation(x - 0.1, 0.93, z); Mc.setMatrixAt(i, M); M.makeTranslation(x + 0.12, 1.12, z); Ar.setMatrixAt(i, M); i++;
  }
  T.castShadow = Mc.castShadow = true; scene.add(T, Mc, Ar);
  // racks of clothes (each shirt can vanish)
  const shirt = new THREE.Shape();
  shirt.moveTo(-0.12, 0.25); shirt.lineTo(-0.3, 0.17); shirt.lineTo(-0.36, 0.02); shirt.lineTo(-0.24, -0.02); shirt.lineTo(-0.2, 0.06);
  shirt.lineTo(-0.2, -0.3); shirt.lineTo(0.2, -0.3); shirt.lineTo(0.2, 0.06); shirt.lineTo(0.24, -0.02); shirt.lineTo(0.36, 0.02); shirt.lineTo(0.3, 0.17); shirt.lineTo(0.12, 0.25);
  shirt.quadraticCurveTo(0, 0.17, -0.12, 0.25);
  const sg = new THREE.ExtrudeGeometry(shirt, { depth: 0.02, bevelEnabled: false });
  const NS = 160;
  R.shirts = new THREE.InstancedMesh(sg, P.phys('#ffffff', { roughness: 0.85 }), NS);
  const cols = ['#e8423a', '#2e7ce0', '#f4c22e', '#3fae5a', '#f2f0ea', '#9b4fd1', '#1d2633', '#ff8a2a'];
  R.shirtPos = [];
  const Cc = new THREE.Color();
  for (let k = 0; k < NS; k++) {
    const rack = Math.floor(k / 40), j = k % 40;
    const p = V(-6 + rack * 4, 1.25, 2.2 + j * 0.07);
    R.shirtPos.push(p); R.shirts.setColorAt(k, Cc.set(cols[(k * 3) % cols.length]));
  }
  R.shirts.castShadow = true; scene.add(R.shirts);
  for (let rack = 0; rack < 4; rack++) {
    const x = -6 + rack * 4;
    scene.add(P.mesh(new THREE.CylinderGeometry(0.02, 0.02, 3.0, 8).rotateX(PI / 2), P.phys('#c9cdd2', { metalness: 0.8 }), { x, y: 1.55, z: 3.55 }));
    for (const z of [2.1, 5.0]) scene.add(P.mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.55, 8), P.phys('#c9cdd2', { metalness: 0.8 }), { x, y: 0.78, z }));
  }
  // conveyor with folded shirts
  scene.add(P.mesh(P.rbox(14, 0.12, 0.9, 0.03), P.phys('#2a2d33', { roughness: 0.6 }), { y: 0.9, z: -1.2 }));
  R.folded = new THREE.InstancedMesh(P.rbox(0.36, 0.06, 0.3, 0.03), P.phys('#ffffff', { roughness: 0.85 }), 24);
  for (let k = 0; k < 24; k++) R.folded.setColorAt(k, Cc.set(cols[k % cols.length]));
  R.folded.castShadow = true; scene.add(R.folded);
  const mg = new THREE.Group(); scene.add(mg);
  const ma = T3('$1.7', { size: 0.62, depth: 0.2, color: '#f2c64a', emissive: 0.12 }), mb = T3('TRILLION', { size: 0.3, depth: 0.1, color: '#f2c64a', emissive: 0.12 });
  mb.group.position.y = -0.48; mg.add(ma.group, mb.group); R.money = { group: mg };
  R.coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.12, 0.025, 24), P.phys('#e6b84a', { metalness: 0.9, roughness: 0.25 }), 120);
  for (let k = 0; k < 120; k++) { const st = Math.floor(k / 15), h = k % 15; M.makeTranslation(-4 + st * 1.0, 3.0 - 0.9 + h * 0.028 + 0.6, 0.6 + (st % 2) * 0.2); R.coins.setMatrixAt(k, M); }
  R.coins.castShadow = true; scene.add(R.coins);
  scene.environmentIntensity = 0.3;
  scene.add(new THREE.HemisphereLight('#f2f6ff', '#7a7a7a', 0.45));
  sun(scene, '#fff8ee', 1.8, V(6, 12, 8), V(-1, 0, 0), 12);
  return {
    scene, R, exposure: 0.85,
    update(c) {
      const t = c.t;
      const gone = c.shot.vanish ?? -1;   // start time of the vanishing wave, or -1
      const Mm = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
      R.shirtPos.forEach((p, k) => {
        const tk = gone < 0 ? 1 : 1 - clamp01((t - gone - (k % 40) * 0.025 - Math.floor(k / 40) * 0.12) / 0.18);
        S.setScalar(Math.max(0.0001, tk)); Mm.compose(p, Q, S); R.shirts.setMatrixAt(k, Mm);
      });
      R.shirts.instanceMatrix.needsUpdate = true;
      for (let k = 0; k < 24; k++) {
        const x = -7 + (((k * 0.6 + t * 0.5) % 14) + 14) % 14;
        const tk = gone < 0 ? 1 : 1 - clamp01((t - gone - k * 0.03) / 0.2);
        S.setScalar(Math.max(0.0001, tk)); Mm.compose(V(x, 0.99, -1.2), Q, S); R.folded.setMatrixAt(k, Mm);
      }
      R.folded.instanceMatrix.needsUpdate = true;
      R.money.group.visible = false; R.coins.visible = false;
    },
  };
}

// =========================================================================================================
// SNOW: winter street, a café door, coats that come off the second you get in
export function snow(engine) {
  const scene = new THREE.Scene();
  const R = {};
  const skyOpts = { top: '#8a9bb2', horizon: '#d9dee6', bottom: '#e8ecf0', sunDir: [0.2, 0.3, 0.6], haze: 0.1 };
  scene.add(skyDome(skyOpts)); scene.environment = skyEnvironment(engine, skyOpts);
  scene.fog = new THREE.Fog('#d9dee6', 15, 70);
  scene.add(P.mesh(new THREE.PlaneGeometry(200, 200).rotateX(-PI / 2), P.phys('#f4f6f8', { roughness: 0.85, sheen: 0.4 }), { cast: false }));
  scene.add(P.mesh(new THREE.PlaneGeometry(200, 7).rotateX(-PI / 2), P.phys('#8a8e94', { roughness: 0.4, clearcoat: 0.4 }), { y: 0.01, z: 4, cast: false }));
  const r = P.rng(31);
  for (let x = -40; x <= 40; x += 1.6) scene.add(P.mesh(new THREE.SphereGeometry(0.6 + r() * 0.4, 14, 10), P.phys('#f7f9fb', { roughness: 0.8 }), { x, y: -0.15, z: 0.4 + r() * 0.3, s: [1.4, 0.6, 0.8] }));
  for (let x = -48; x <= 48; x += 12) { if (Math.abs(x) < 3) continue; const b = P.cityBlock({ w: 11.6, h: 10 + r() * 14, d: 10, wall: ['#b5866a', '#9fb2c0', '#c9b8a2'][Math.floor(r() * 3)], seed: Math.floor(r() * 50), lit: 0.45 }); b.position.set(x, 0, -11); scene.add(b); }
  // café: facade, window, door, awning
  const cafe = new THREE.Group(); cafe.position.set(0, 0, -6); scene.add(cafe);
  const wd = P.phys('#3a2a20', { roughness: 0.6 });
  cafe.add(P.mesh(new THREE.BoxGeometry(5.6, 0.4, 0.3), wd, { y: 3.6 }));
  for (const [x, w, y, h] of [[-2.6, 0.4, 1.8, 3.6], [2.6, 0.4, 1.8, 3.6], [-0.1, 1.0, 1.8, 3.6], [1.95, 0.9, 1.8, 3.6], [0.95, 1.1, 2.95, 0.9], [-1.5, 1.8, 0.2, 0.4], [-1.5, 1.8, 3.1, 0.6]]) cafe.add(P.mesh(new THREE.BoxGeometry(w, h, 0.3), wd, { x, y }));
  cafe.add(P.mesh(new THREE.PlaneGeometry(1.8, 2.4), P.phys('#ffd9a0', { emissive: '#ffb860', emissiveIntensity: 0.9, roughness: 0.1 }), { x: -1.5, y: 1.6, z: 0.0, cast: false }));
  cafe.add(P.mesh(P.rbox(5.8, 0.12, 1.3, 0.04), P.phys('#c8323c', { roughness: 0.6 }), { y: 3.25, z: 0.6, rx: 0.25 }));
  const cs = signPlane(['CAFÉ'], 1.6, 0.42, { bg: '#3a2a20', fg: '#ffd9a0', glow: 1.2 }); cs.position.set(0, 3.62, 0.17); cafe.add(cs);
  R.door = new THREE.Group(); R.door.position.set(0.4, 0, 0.0); cafe.add(R.door);
  R.door.add(P.mesh(P.rbox(1.1, 2.4, 0.06, 0.02), P.phys('#2a1a12', { roughness: 0.4 }), { x: 0.55, y: 1.2 }));
  R.door.add(P.mesh(new THREE.PlaneGeometry(0.8, 1.6), P.phys('#ffd9a0', { emissive: '#ffb860', emissiveIntensity: 0.6, roughness: 0.05 }), { x: 0.55, y: 1.35, z: 0.035, cast: false }));
  // interior behind the door
  cafe.add(P.mesh(new THREE.PlaneGeometry(6, 4).rotateX(-PI / 2), P.phys('#ffffff', { map: P.woodFloorTex('#8a5a3a', [3, 2]), roughness: 0.5 }), { y: 0.005, z: -2, cast: false }));
  cafe.add(P.mesh(new THREE.PlaneGeometry(6, 3.6), P.phys('#d9a46a', { roughness: 0.8 }), { y: 1.8, z: -3.9, cast: false }));
  for (const x of [-2.8, 2.8]) cafe.add(P.mesh(new THREE.PlaneGeometry(4, 3.6).rotateY(x > 0 ? -PI / 2 : PI / 2), P.phys('#c98f5a', { roughness: 0.8 }), { x, y: 1.8, z: -2, cast: false }));
  const rack = new THREE.Group(); rack.position.set(-0.35, 0, -0.95); cafe.add(rack); R.rack = rack;
  rack.add(P.mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.9, 10), P.phys('#3a2414'), { y: 0.95 }), P.mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.05, 20), P.phys('#3a2414'), { y: 0.025 }));
  const coatShape = (col) => { const g = new THREE.Group(); const m = P.phys(col, { roughness: 0.8, sheen: 0.6 }); g.add(P.mesh(new THREE.CapsuleGeometry(0.2, 0.5, 6, 14).scale(1, 1, 0.55), m, { y: -0.45 }), P.mesh(new THREE.CapsuleGeometry(0.07, 0.4, 6, 10), m, { x: -0.2, y: -0.4, rz: 0.15 }), P.mesh(new THREE.CapsuleGeometry(0.07, 0.4, 6, 10), m, { x: 0.2, y: -0.4, rz: -0.15 })); return g; };
  [['#1f8a8a', 0.5], ['#e0b040', 2.1], ['#5a5a6a', 3.6]].forEach(([col, a]) => { const c = coatShape(col); c.position.set(Math.cos(a) * 0.2, 1.85, Math.sin(a) * 0.2); c.rotation.y = -a; rack.add(c); });
  R.flyCoat = coatShape('#c8323c'); scene.add(R.flyCoat);
  const warm = new THREE.PointLight('#ffb870', 12, 9, 1.6); warm.position.set(0, 2.5, -7.8); scene.add(warm);
  R.warm = warm;
  // snow
  const NF = 1600;
  R.flakes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' }), NF);
  R.flakeSeed = []; const rf = P.rng(77);
  for (let k = 0; k < NF; k++) R.flakeSeed.push([rf() * 24 - 12, rf() * 8, rf() * 14 - 7, 0.6 + rf() * 0.6, rf() * 6]);
  scene.add(R.flakes);
  R.coatA = person('coat_a', -3, 0, -3.5, PI / 2); scene.add(R.coatA.root);
  R.coatB = person('coat_b', 2.5, 0, -2.2, -PI / 2); scene.add(R.coatB.root);
  wear(R.coatA, 'pack', false); wear(R.coatB, 'pack', false);
  sun(scene, '#e8eef8', 1.6, V(-6, 12, 10), V(0, 0, -4), 10);
  scene.add(new THREE.HemisphereLight('#dfe6f0', '#b8bcc4', 0.9));
  return {
    scene, R, grade: { warmth: -0.03, saturation: 1.05 },
    update(c) {
      const t = c.t;
      const Mm = new THREE.Matrix4();
      R.flakeSeed.forEach(([x, y, z, v, ph], k) => {
        const yy = ((y - t * v) % 8 + 8) % 8;
        Mm.makeTranslation(x + Math.sin(t * 0.8 + ph) * 0.3, yy, z - 2); R.flakes.setMatrixAt(k, Mm);
      });
      R.flakes.instanceMatrix.needsUpdate = true;
      R.door.rotation.y = 0; R.flyCoat.visible = false;
      for (const p of [R.coatA, R.coatB]) { wear(p, 'coat', true); wear(p, 'cs', true); wear(p, 'scarf', true); wear(p, 'pack', false); p.root.visible = true; }
    },
  };
}

// =========================================================================================================
// DINING: a front door at night (x = 12) and a dinner party where the guests wear only jewellery
export function dining(engine) {
  const scene = new THREE.Scene();
  const R = {};
  scene.background = new THREE.Color('#0d0f1a');
  const paper = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#5a2a3a'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(240,200,140,0.18)'; for (let y = 0; y < h; y += 64) for (let x = (y / 64) % 2 * 32; x < w; x += 64) { c.beginPath(); c.moveTo(x, y + 8); c.lineTo(x + 12, y + 32); c.lineTo(x, y + 56); c.lineTo(x - 12, y + 32); c.fill(); } });
  paper.wrapS = paper.wrapT = THREE.RepeatWrapping; paper.repeat.set(4, 2);
  scene.add(P.mesh(new THREE.PlaneGeometry(9, 9).rotateX(-PI / 2), P.phys('#ffffff', { map: P.woodFloorTex('#6a3a24', [4, 4]), roughness: 0.45, clearcoat: 0.3 }), { cast: false }));
  const wall = P.phys('#ffffff', { map: paper, roughness: 0.85 });
  scene.add(P.mesh(new THREE.PlaneGeometry(9, 3.2), wall, { y: 1.6, z: -3.6, cast: false }));
  scene.add(P.mesh(new THREE.PlaneGeometry(9, 3.2).rotateY(PI / 2), wall, { x: -2.8, y: 1.6, cast: false }));
  scene.add(P.mesh(new THREE.PlaneGeometry(9, 3.2).rotateY(-PI / 2), wall, { x: 2.8, y: 1.6, cast: false }));
  // doorway in the back wall (the suit guy appears here)
  scene.add(P.mesh(new THREE.PlaneGeometry(1.1, 2.2), new THREE.MeshBasicMaterial({ color: '#2a2018' }), { x: 1.4, y: 1.1, z: -3.58, cast: false }));
  for (const x of [0.8, 2.0]) scene.add(P.mesh(P.rbox(0.12, 2.3, 0.1, 0.02), P.phys('#efe6d6'), { x, y: 1.15, z: -3.55 }));
  scene.add(P.mesh(P.rbox(1.32, 0.12, 0.1, 0.02), P.phys('#efe6d6'), { x: 1.4, y: 2.3, z: -3.55 }));
  // table along z, chairs, plates, glasses, candles
  scene.add(P.mesh(P.rbox(1.1, 0.06, 3.0, 0.02), P.phys('#f6f2ea', { roughness: 0.9, sheen: 0.6 }), { y: 0.76, z: -0.6 }));
  scene.add(P.mesh(P.rbox(1.12, 0.3, 3.02, 0.02), P.phys('#f6f2ea', { roughness: 0.9 }), { y: 0.62, z: -0.6 }));
  for (const z of [-1.6, -0.6, 0.4]) for (const s of [-1, 1]) {
    scene.add(P.mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.015, 32), P.phys('#ffffff', { roughness: 0.2, clearcoat: 0.8 }), { x: s * 0.32, y: 0.8, z }));
    scene.add(P.mesh(lathe([[0.0001, 0], [0.035, 0], [0.006, 0.01], [0.006, 0.1], [0.04, 0.14], [0.042, 0.22], [0.038, 0.22], [0.0001, 0.12]], 24), P.phys('#f0f6ff', { roughness: 0.05, transparent: true, opacity: 0.35, side: THREE.DoubleSide }), { x: s * 0.3, y: 0.79, z: z + 0.22 }));
    scene.add(P.mesh(P.rbox(0.45, 1.0, 0.08, 0.03), P.phys('#3a2414', { roughness: 0.4 }), { x: s * 0.98, y: 0.5, z, ry: PI / 2 }));
  }
  R.flames = [];
  for (const z of [-1.3, -0.6, 0.1]) {
    scene.add(P.mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 12), P.phys('#f6f0e0', { roughness: 0.5 }), { y: 0.9, z }));
    const f = P.mesh(new THREE.SphereGeometry(0.018, 10, 8).scale(1, 2.2, 1), new THREE.MeshBasicMaterial({ color: '#ffd080' }), { y: 1.04, z, cast: false }); scene.add(f); R.flames.push(f);
  }
  const chand = new THREE.Group(); chand.position.set(0, 2.5, -0.6); scene.add(chand);
  chand.add(P.mesh(new THREE.TorusGeometry(0.35, 0.02, 8, 40).rotateX(PI / 2), P.phys('#d9b04a', { metalness: 0.9, roughness: 0.3 })));
  for (let i = 0; i < 8; i++) chand.add(P.mesh(new THREE.SphereGeometry(0.04, 10, 8), P.phys('#fff2d0', { emissive: '#ffe0a0', emissiveIntensity: 2 }), { x: Math.cos(i / 8 * PI * 2) * 0.35, y: 0.05, z: Math.sin(i / 8 * PI * 2) * 0.35, cast: false }));
  scene.environmentIntensity = 0.25;
  const cl = new THREE.PointLight('#ffd6a0', 5.5, 8, 1.6); cl.position.set(0, 2.2, -0.6); cl.castShadow = true; cl.shadow.mapSize.set(1024, 1024); scene.add(cl);
  const candle = new THREE.PointLight('#ffb060', 1.5, 3, 2); candle.position.set(0, 1.15, -0.6); scene.add(candle);
  scene.add(new THREE.HemisphereLight('#ffe2c0', '#2a1a14', 0.3));
  // guests (seated, facing the table)
  const seats = [['guest_a', -1, -1.6], ['guest_c', -1, -0.6], ['leopard', -1, 0.4], ['guest_b', 1, -1.6], ['guest_d', 1, -0.6], ['stripes', 1, 0.4]];
  R.guests = seats.map(([n, s, z], i) => { const c = person(n, s * 0.72, -0.4, z, -s * PI / 2); scene.add(c.root); c.seed = i; c.side = s; return c; });
  R.suit = person('suit', 1.4, 0, -3.3, 0); scene.add(R.suit.root); R.suit.root.visible = false;
  // front door at night (x = 12)
  const fd = new THREE.Group(); fd.position.set(12, 0, 0); scene.add(fd);
  fd.add(P.mesh(new THREE.PlaneGeometry(6, 4), P.phys('#d9cfc0', { roughness: 0.9 }), { y: 2, z: -0.1, cast: false }));
  fd.add(P.mesh(new THREE.PlaneGeometry(6, 6).rotateX(-PI / 2), P.phys('#3a3a40', { roughness: 0.8 }), { y: 0.002, z: 2, cast: false }));
  fd.add(P.mesh(P.rbox(1.1, 2.3, 0.08, 0.02), P.phys('#2a3a5a', { roughness: 0.3, clearcoat: 0.8 }), { y: 1.15 }));
  for (const [x, y] of [[-0.22, 1.6], [0.22, 1.6], [-0.22, 0.75], [0.22, 0.75]]) fd.add(P.mesh(P.rbox(0.36, 0.6, 0.02, 0.01), P.phys('#23324e'), { x, y, z: 0.045 }));
  fd.add(P.mesh(new THREE.TorusGeometry(0.22, 0.07, 10, 30), P.phys('#2f6a3a', { roughness: 0.9 }), { y: 1.75, z: 0.1 }));
  fd.add(P.mesh(new THREE.SphereGeometry(0.03, 12, 8), P.phys('#d9b04a', { metalness: 0.9, roughness: 0.3 }), { x: 0.42, y: 1.05, z: 0.08 }));
  fd.add(P.mesh(P.rbox(0.06, 0.1, 0.02, 0.01), P.phys('#d9b04a', { metalness: 0.8 }), { x: 0.75, y: 1.3, z: 0.0 }));
  fd.add(P.mesh(P.rbox(0.5, 1.5, 6.0, 0.2), P.phys('#2f5a32', { roughness: 0.95 }), { x: -2.4, y: 0.75, z: 2.9 }));
  fd.add(P.mesh(new THREE.BoxGeometry(6, 4, 0.2), P.phys('#d9cfc0', { roughness: 0.9 }), { y: 2, z: -0.25 }));
  const porch = new THREE.PointLight('#ffd08a', 3, 6, 1.8); porch.position.set(12.7, 2.4, 0.6); scene.add(porch);
  fd.add(P.mesh(new THREE.SphereGeometry(0.1, 14, 10), P.phys('#fff0c8', { emissive: '#ffd08a', emissiveIntensity: 2 }), { x: 0.75, y: 2.4, z: 0.1, cast: false }));
  const moon = new THREE.DirectionalLight('#7f9bd6', 0.6); moon.position.set(16, 6, 6); moon.target.position.set(12, 1, 0); scene.add(moon, moon.target);
  R.sam = person('sam', 12.0, 0, 1.0, PI); scene.add(R.sam.root); wear(R.sam, 'apron', false); wear(R.sam, 'watch', true);
  R.samTable = person('sam', -0.72, -0.4, 1.1, PI * 0.75); scene.add(R.samTable.root); wear(R.samTable, 'apron', false); wear(R.samTable, 'watch', true); R.samTable.root.visible = false;
  // thought bubble: a guest pictures someone arriving in a pumpkin costume
  R.bubble = new ThoughtBubble(engine, (sub) => {
    sub.background = new THREE.Color('#2a1f3a');
    sub.add(new THREE.HemisphereLight('#ffe2c0', '#2a1a14', 1.2));
    const k = new THREE.DirectionalLight('#ffffff', 2.2); k.position.set(1, 2, 3); sub.add(k);
    sub.add(P.mesh(new THREE.PlaneGeometry(6, 6).rotateX(-PI / 2), P.phys('#5a3a24'), { cast: false }));
    const g = person('guest_b', 0, 0, 0, 0); sub.add(g.root); wear(g, 'pack', false);
    const pumpkin = P.mesh(new THREE.SphereGeometry(0.42, 32, 20).scale(1, 0.85, 0.95), P.phys('#ff8a1a', { roughness: 0.6 }), { y: 1.1 });
    sub.add(pumpkin);
    for (let i = 0; i < 8; i++) sub.add(P.mesh(new THREE.TorusGeometry(0.42, 0.012, 6, 40, PI).rotateZ(PI / 2).rotateY(i / 8 * PI), P.phys('#d96a10'), { y: 1.1, s: [1, 0.85, 0.95] }));
    sub.add(P.mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.12, 8), P.phys('#3a6a2a'), { y: 1.5 }));
    const cam = new THREE.PerspectiveCamera(35, 1, 0.05, 50); cam.position.set(0, 1.35, 2.6); cam.lookAt(0, 1.2, 0);
    return { camera: cam, update(lt) { g.pose({ lids: 1, head: [0, 0.2 * Math.sin(lt * 2), 0], nodes: { ...REST, arm_r: [0, 0, -2.4 - 0.3 * Math.sin(lt * 9)], fore_r: [0, 0, -0.4] } }); } };
  }, { size: 0.45 });
  scene.add(R.bubble.group);
  return {
    scene, R, bloom: { strength: 0.35, threshold: 0.9 }, exposure: 0.9,
    update(c) {
      const t = c.t;
      R.flames.forEach((f, i) => { f.scale.set(1, 0.85 + 0.2 * Math.sin(t * 19 + i * 2), 1); });
      R.guests.forEach((g) => g.pose({ lids: blink(t, g.seed), head: [0.05, 0.1 * Math.sin(t * 0.7 + g.seed), 0], nodes: { ...REST, ...SIT, arm_l: [-0.7, 0, 0.12], arm_r: [-0.7, 0, -0.12], fore_l: [-0.8, 0, 0], fore_r: [-0.8, 0, 0] } }));
      R.bubble.group.visible = false; R.suit.root.visible = false;
    },
  };
}
