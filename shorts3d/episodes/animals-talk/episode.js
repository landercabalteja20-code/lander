// "What if animals could somehow talk?" — narrated 3D short (format: references/zackdfilms-3d-shorts/STYLE.md).
// Shots are anchored to words in build/timeline.json (tools/build_audio.py), so re-voicing never needs re-timing.
import * as THREE from 'three';
import { loadCast, makeCharacter, envAt, blink } from '../../kit/character.js';
import * as P from '../../kit/props.js';
import { skyDome, skyEnvironment, Text3D, loadFont, commas, ThoughtBubble, ease, ramp, lerp, clamp01 } from '../../kit/fx.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;
let TL = null;
const norm = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, '');
function at(ref) {
  const [base, off] = ref.split('+');
  const [idEdge, word] = base.split('@');
  const [id, edge] = idEdge.split('.');
  const l = TL.lines.find((x) => x.id === id);
  if (!l) throw new Error('no line ' + id);
  let t = edge === 'end' ? l.end : l.start;
  if (word) t = l.words.find((w) => norm(w.w).startsWith(norm(word))).s;
  return t + (off ? parseFloat(off) : 0);
}
function talk(who, t, gain = 1) {
  let v = 0;
  for (const l of TL.lines) if (l.who === who && t >= l.start - 0.03 && t <= l.end + 0.12) v = Math.max(v, envAt(l.env, TL.fps, t - l.start));
  return clamp01(v * gain);
}
// camera helpers -----------------------------------------------------------------------------------------
function hand(t, amp = 1) {  // gentle handheld drift
  return V(Math.sin(t * 1.3) * 0.006 + Math.sin(t * 3.1 + 1) * 0.002, Math.sin(t * 1.7 + 2) * 0.005, Math.sin(t * 1.1 + 4) * 0.004).multiplyScalar(amp);
}
function aim(cam, pos, target, { fov = 35, roll = 0, t = 0, amp = 1 } = {}) {
  cam.fov = fov;
  cam.position.copy(pos).add(hand(t, amp));
  cam.lookAt(target);
  if (roll) cam.rotateZ(roll);
}
const mixV = (a, b, k) => a.clone().lerp(b, k);
function world(c, node, local = [0, 0, 0]) {
  c.root.updateMatrixWorld(true);
  return (node ? c.nodes[node] : c.root).localToWorld(V(...local));
}
const dist = (a, b) => a.distanceTo(b);

// lighting rigs ------------------------------------------------------------------------------------------
function sun(scene, color, intensity, pos, target, size = 6, res = 2048) {
  const l = new THREE.DirectionalLight(color, intensity);
  l.position.copy(pos); l.target.position.copy(target);
  l.castShadow = true; l.shadow.mapSize.set(res, res);
  const c = l.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = 0.5; c.far = 80;
  l.shadow.bias = -0.0003; l.shadow.normalBias = 0.02; l.shadow.radius = 3;
  scene.add(l, l.target);
  return l;
}

// =========================================================================================================
const cast = {};
const W = {};   // shared scene objects

const scenes = {
  // ------------------------------------------------------------------------------------------- bedroom
  bedroom(engine) {
    const scene = new THREE.Scene();
    scene.add(skyDome({ top: '#4e6fb3', horizon: '#ffc59a', bottom: '#5a6a80', sunDir: [1, 0.12, -0.15], sunCol: '#ffb070', sunSize: 3, haze: 0.7 }));
    scene.environment = engine.roomEnv; scene.environmentIntensity = 0.28;
    const floor = P.mesh(new THREE.PlaneGeometry(9, 9).rotateX(-PI / 2), P.phys('#ffffff', { map: P.woodFloorTex('#a8703f', [4, 4]), roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.35 }), { cast: false });
    scene.add(floor);
    const wallMat = P.phys('#b8c6d6', { roughness: 0.92 });
    scene.add(P.mesh(new THREE.BoxGeometry(9, 2.8, 0.1), wallMat, { y: 1.4, z: -3.05 }));
    scene.add(P.mesh(new THREE.BoxGeometry(0.1, 2.8, 9), wallMat, { x: -2.45, y: 1.4 }));
    // right wall with a window opening (z -1.55..-0.25, y 0.92..2.17)
    const R = (z0, z1, y0, y1) => P.mesh(new THREE.BoxGeometry(0.12, y1 - y0, z1 - z0), wallMat, { x: 2.66, y: (y0 + y1) / 2, z: (z0 + z1) / 2 });
    scene.add(R(-4.5, -1.55, 0, 2.8), R(-0.25, 4.5, 0, 2.8), R(-1.55, -0.25, 0, 0.92), R(-1.55, -0.25, 2.17, 2.8));
    scene.add(P.mesh(new THREE.BoxGeometry(0.06, 0.12, 9), P.phys('#f3efe6'), { x: -2.38, y: 0.06 }));
    scene.add(P.mesh(new THREE.BoxGeometry(9, 0.12, 0.06), P.phys('#f3efe6'), { y: 0.06, z: -2.98 }));
    const win = P.windowWithBlinds({ w: 1.3, h: 1.25, sill: 0.92, open: 0.5 });
    win.position.set(2.6, 0, -0.9); scene.add(win);
    // distant rooftops outside
    for (let i = 0; i < 7; i++) scene.add(P.mesh(new THREE.BoxGeometry(6, 3 + (i * 37 % 5), 6), P.std('#59647a'), { x: 22 + (i % 3) * 7, y: 1.5, z: -14 + i * 4.5, cast: false }));
    const bed = P.bed(); bed.position.set(0.2, 0, -1.9); scene.add(bed);
    const ns = P.nightstand(); ns.position.set(-1.27, 0, -2.75); scene.add(ns);
    const clock = P.alarmClock(); clock.position.set(-1.22, 0.55, -2.78); clock.rotation.y = PI / 2 - 0.25; scene.add(clock);
    W.clock = clock;
    const lamp = new THREE.Group();
    lamp.add(P.mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.25, 20), P.phys('#d8c7a8'), { y: 0.125 }));
    lamp.add(P.mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.18, 24, 1, true), P.phys('#f6ead2', { side: THREE.DoubleSide, emissive: '#ffcf8a', emissiveIntensity: 0.6 }), { y: 0.33 }));
    lamp.position.set(-1.38, 0.55, -2.88); scene.add(lamp);
    const rug = P.rug(0.95); rug.position.set(0.55, 0, 0.75); scene.add(rug);
    // characters
    const dog = makeCharacter('dog'); scene.add(dog.root); cast.dog = dog;
    const cat = makeCharacter('cat'); scene.add(cat.root); cast.cat = cat;
    cat.root.position.set(2.43, 0.925, -0.9); cat.root.rotation.y = -PI / 2;
    const owner = makeCharacter('owner'); scene.add(owner.root); cast.ownerBed = owner;
    owner.root.position.set(-0.2, 0.58, -0.93); owner.root.rotation.x = -PI / 2 + 0.12;
    // words + counter for the vocabulary shot
    const counter = new Text3D({ size: 0.26, depth: 0.1, bevel: 0.016, color: '#ff4fa3', emissive: 0.15 });
    const label = new Text3D({ size: 0.12, depth: 0.05, bevel: 0.008, color: '#ffffff', emissive: 0.05 });
    label.setText('WORDS');
    const cgrp = new THREE.Group(); cgrp.add(counter.group, label.group); label.group.position.y = -0.2;
    cgrp.position.set(0.55, 1.62, 0.55); scene.add(cgrp);
    W.counter = counter; W.cgrp = cgrp;
    const vocab = ['SIT', 'BALL', 'TREAT', 'PARK', 'BACON', 'NO!', 'GOOD BOY', 'SQUIRREL', 'DINNER', 'CHEESE'];
    W.words = vocab.map((w, i) => { const t = new Text3D({ size: 0.062, depth: 0.025, bevel: 0.005, color: ['#ffd23f', '#6fd3ff', '#ff8a3d', '#9ff07a'][i % 4], emissive: 0.1 }); t.setText(w); scene.add(t.group); return t; });
    // food bubble
    W.foodBubble = new ThoughtBubble(engine, (sub) => {
      sub.background = new THREE.Color('#ffd76a');
      sub.environment = engine.roomEnv; sub.environmentIntensity = 0.6;
      const bowl = P.dogBowl(); sub.add(bowl);
      const k = new THREE.DirectionalLight('#fff3dd', 2.5); k.position.set(1, 2, 1.5); sub.add(k, new THREE.HemisphereLight('#fff', '#c98a3a', 1.0));
      const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 20);
      camera.position.set(0, 0.75, 1.15); camera.lookAt(0, 0.2, 0);
      return { camera, update(lt) { bowl.rotation.y = 0.4 + lt * 0.25; } };
    }, { size: 0.34 });
    scene.add(W.foodBubble.group);
    // light: low dawn sun through the window + cool fill + warm lamp
    sun(scene, '#ffc896', 3.4, V(9, 3.4, -0.6), V(0, 0.4, -1.3), 4.5);
    scene.add(new THREE.HemisphereLight('#a9c1ea', '#6a5242', 0.55));
    const lampLight = new THREE.PointLight('#ffc27a', 1.4, 4, 2); lampLight.position.set(-1.38, 0.95, -2.75); scene.add(lampLight);
    const face = new THREE.PointLight('#ffe6cf', 0.0, 3, 2); scene.add(face); W.faceLight = face;
    return {
      scene, dof: { aperture: 0.02, maxblur: 0.012 },
      update(ctx) {
        const t = ctx.t;
        dog.root.visible = true; owner.root.visible = true; cat.root.visible = true;
        dog.root.position.set(-1.05, 0, -2.35); dog.root.rotation.set(0, PI / 2, 0);
        dog.pose({ head: [0.05, 0, 0], tail: Math.sin(t * 9) * 0.5, lids: blink(t, 1), look: [0, 0.1] });
        owner.pose({ head: [0, 0.35, 0], lids: 0 });
        cat.pose({ head: [0, 0, 0], tail: Math.sin(t * 1.3) * 0.08, lids: blink(t, 4, 4.4) });
        W.cgrp.visible = false; W.words.forEach((w) => (w.group.visible = false));
        W.foodBubble.group.visible = false;
        face.intensity = 0;
      },
    };
  },

  // ------------------------------------------------------------------------------------------- farm
  farm(engine) {
    const scene = new THREE.Scene();
    const skyOpts = { top: '#2f7fe0', horizon: '#cfe8fb', bottom: '#8fb07a', sunDir: [0.5, 0.75, 0.3], sunCol: '#fff3d6', haze: 0.25 };
    scene.add(skyDome(skyOpts));
    scene.environment = skyEnvironment(engine, skyOpts); scene.environmentIntensity = 0.7;
    scene.fog = new THREE.Fog('#cfe3f2', 70, 330);
    const H = (x, z) => 5.5 * Math.sin(x * 0.021 + 0.4) * Math.cos(z * 0.018) + 2.6 * Math.sin(x * 0.055 + 1.3) * Math.sin(z * 0.043 + 0.5) + 1.2 * Math.sin(x * 0.13 + z * 0.09);
    scene.add(P.hills({ size: 800, seg: 200, color: '#5c9a3c', height: H }));
    // herd (instanced)
    const T = cast.cowTemplate;
    const n = 340;
    const herd = new THREE.InstancedMesh(T.geometry, T.material, n);
    const r = P.rng(21), m = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let i = 0; i < n; i++) {
      const x = (r() - 0.5) * 130, z = -150 + r() * 175;
      if (Math.abs(x) < 9 && z < -95) { i--; continue; }
      q.setFromEuler(new THREE.Euler(0, r() * PI * 2, 0));
      const s = 1.1 + r() * 0.25;
      m.compose(V(x, H(x, z) - 0.05, z), q, V(s, s, s));
      herd.setMatrixAt(i, m);
    }
    herd.castShadow = true; herd.receiveShadow = true;
    scene.add(herd);
    const trees = [];
    const r2 = P.rng(4);
    for (let i = 0; i < 60; i++) { const x = (r2() < 0.5 ? -1 : 1) * (60 + r2() * 120), z = -260 + r2() * 300; trees.push([x, H(x, z), z, 1.4 + r2() * 1.4]); }
    for (let i = 0; i < 26; i++) { const x = (r2() < 0.5 ? -1 : 1) * (14 + r2() * 30), z = -150 + r2() * 110; trees.push([x, H(x, z), z, 1.0 + r2() * 0.9]); }
    scene.add(P.treeInstances(trees));
    const barn = P.barn(); barn.position.set(-52, H(-52, -70), -70); barn.rotation.y = 0.6; scene.add(barn);
    scene.add(P.fenceLine([-30, 0, -20], [30, 0, -20], H, { n: 30 }));
    scene.add(P.fenceLine([-30, 0, -20], [-45, 0, -110], H, { n: 30 }));
    // giant counter on the hillside
    const num = new Text3D({ size: 2.6, depth: 0.9, bevel: 0.14, color: '#ff4fa3', emissive: 0.1 });
    const word = new Text3D({ size: 1.9, depth: 0.7, bevel: 0.11, color: '#ffffff', emissive: 0.05 }); word.setText('COWS');
    const g = new THREE.Group(); g.add(num.group, word.group); word.group.position.y = -2.8;
    g.position.set(0, H(0, -125) + 4.6, -125); g.rotation.x = -0.12; scene.add(g);
    W.farmNum = num;
    sun(scene, '#fff0d2', 3.4, V(120, 70, 10), V(0, 0, -60), 140, 4096);
    scene.add(new THREE.HemisphereLight('#cfe6ff', '#4a6332', 0.5));
    return { scene, H, dof: { aperture: 0.0 } };
  },

  // ------------------------------------------------------------------------------------------- drive-thru
  drivethru(engine) {
    const scene = new THREE.Scene();
    const skyOpts = { top: '#3a86de', horizon: '#d8ecfa', bottom: '#77746e', sunDir: [-0.6, 0.6, 0.4], sunCol: '#fff1d0', haze: 0.3 };
    scene.add(skyDome(skyOpts));
    scene.environment = skyEnvironment(engine, skyOpts); scene.environmentIntensity = 0.65;
    const car = P.carInterior(); scene.add(car);
    scene.add(P.mesh(new THREE.PlaneGeometry(200, 200).rotateX(-PI / 2), P.std('#4b4c51', { roughness: 0.95 }), { y: -0.5, cast: false }));
    for (let i = -6; i < 6; i++) scene.add(P.mesh(new THREE.PlaneGeometry(0.15, 2.4).rotateX(-PI / 2), P.std('#e8e4d6'), { x: -2.8, y: -0.49, z: i * 3.2, cast: false }));
    // the restaurant across the lane
    const wall = P.mesh(new THREE.BoxGeometry(1, 5, 30), P.std('#f1e2c6'), { x: -6.5, y: 2.0 });
    scene.add(wall);
    scene.add(P.mesh(new THREE.BoxGeometry(0.2, 0.6, 30), P.std('#c8352b'), { x: -5.95, y: 3.4 }));
    const sign = P.mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshStandardMaterial({ map: P.labelTex('MOO BURGER', { w: 1024, h: 256, font: '900 170px Helvetica, Arial, sans-serif' }), emissive: '#ffffff', emissiveIntensity: 0.25 }), { x: -5.93, y: 3.0, z: -3, ry: PI / 2, cast: false });
    scene.add(sign);
    scene.add(P.mesh(P.rbox(0.1, 1.2, 1.6, 0.02), P.phys('#9fc6dc', { roughness: 0.05, clearcoat: 1 }), { x: -5.96, y: 1.0, z: 1.5 }));
    for (const z of [-9, 7]) { const c = P.car(z < 0 ? '#2f6fb3' : '#e8c33a'); c.position.set(-3.6, -0.5, z); scene.add(c); }
    const cow = makeCharacter('cow_head'); scene.add(cow.root); cast.cowHead = cow;
    const hb = new THREE.Group();
    const handC = makeCharacter('hand'); hb.add(handC.root);
    const burger = P.burger(1.0); burger.position.set(0, 0.016, 0.0); hb.add(burger);
    scene.add(hb); W.handBurger = hb;
    sun(scene, '#fff0d4', 3.0, V(-14, 12, 9), V(-1, 0.5, 0), 8);
    scene.add(new THREE.HemisphereLight('#d4e7ff', '#6b6660', 0.55));
    const inside = new THREE.PointLight('#ffe9d2', 0.9, 3, 2); inside.position.set(0.2, 1.1, 0.4); scene.add(inside);
    return { scene, dof: { aperture: 0.02, maxblur: 0.01 } };
  },

  // ------------------------------------------------------------------------------------------- city ledge
  ledge(engine) {
    const scene = new THREE.Scene();
    const skyOpts = { top: '#3d88dc', horizon: '#dbeaf6', bottom: '#8d8f94', sunDir: [0.4, 0.7, -0.5], sunCol: '#fff3dc', haze: 0.3 };
    scene.add(skyDome(skyOpts));
    scene.environment = skyEnvironment(engine, skyOpts); scene.environmentIntensity = 0.7;
    scene.fog = new THREE.Fog('#d4e3ef', 60, 260);
    const stone = P.phys('#d9cfbf', { roughness: 0.85 });
    scene.add(P.mesh(P.rbox(24, 0.32, 0.62, 0.04), stone, { y: 14.84, z: -0.05 }));
    scene.add(P.mesh(P.rbox(24, 0.16, 0.5, 0.03), stone, { y: 14.6, z: 0.02 }));
    const ours = P.cityBlock({ w: 40, h: 14.5, d: 12, wall: '#d4c4ad', seed: 2, lit: 0.05 }); ours.position.set(0, 0, 6.25); scene.add(ours);
    scene.add(P.mesh(new THREE.BoxGeometry(40, 3, 12), P.std('#cdbda6'), { y: 16.0, z: 6.4 }));
    scene.add(P.mesh(new THREE.PlaneGeometry(200, 60).rotateX(-PI / 2), P.std('#55565c', { roughness: 0.95 }), { y: 0, z: -20, cast: false }));
    scene.add(P.mesh(new THREE.BoxGeometry(200, 0.15, 3.2), P.std('#b9b4aa'), { y: 0.075, z: -1.6, cast: false }));
    scene.add(P.mesh(new THREE.BoxGeometry(200, 0.15, 3.2), P.std('#b9b4aa'), { y: 0.075, z: -17.4, cast: false }));
    for (let i = -20; i < 20; i++) scene.add(P.mesh(new THREE.PlaneGeometry(2.4, 0.18).rotateX(-PI / 2), P.std('#efe9d0'), { x: i * 5, y: 0.01, z: -9.5, cast: false }));
    const cols = ['#c9b8a2', '#a7b3c2', '#d8c2a6', '#b9a8a0', '#c5cdd6'];
    for (let i = 0; i < 8; i++) {
      const b = P.cityBlock({ w: 16, h: 22 + (i * 13) % 26, d: 14, wall: cols[i % 5], seed: 10 + i, lit: 0.08 });
      b.position.set(-56 + i * 16, 0, -26); scene.add(b);
    }
    [['#d23b32', -6, -6.5], ['#f0f0ea', 9, -12.5], ['#2f6fb3', 22, -6.5]].forEach(([c, x, z]) => { const k = P.car(c); k.position.set(x, 0, z); k.rotation.y = z < -9 ? -PI / 2 : PI / 2; scene.add(k); W[`car${x}`] = k; });
    W.pigeons = [-1.15, -0.58, 0.0, 0.52, 1.08].map((x, i) => {
      const p = makeCharacter('pigeon'); p.root.position.set(x, 15.0, -0.08 + (i % 2) * 0.06); p.root.rotation.y = PI + (i - 2) * 0.12;
      p.root.scale.setScalar(1.0 + (i % 3) * 0.06); scene.add(p.root); return p;
    });
    const man = makeCharacter('bald'); scene.add(man.root); cast.bald = man;
    sun(scene, '#fff2da', 3.0, V(14, 30, -16), V(0, 8, -4), 22, 4096);
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
        const w = (t - at('n5')) * 1.25;
        man.root.position.set(2.6 - w, 0.15, -1.55); man.root.rotation.set(0, -PI / 2, 0);
        const sw = Math.sin(t * 7.5);
        man.pose({ body: [0, 0, sw * 0.02], nodes: { arm_l: [sw * 0.4, 0, 0], arm_r: [-sw * 0.4, 0, 0] }, lids: blink(t, 2), head: [0.1, 0, 0] });
        for (const k of ['car-6', 'car9', 'car22']) { const c = W[k]; if (c) c.position.x += 0; }
      },
    };
  },

  // ------------------------------------------------------------------------------------------- office
  office(engine) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#c9d6e0');
    scene.environment = engine.roomEnv; scene.environmentIntensity = 0.35;
    scene.add(P.mesh(new THREE.PlaneGeometry(30, 30).rotateX(-PI / 2), P.phys('#6f7a86', { roughness: 0.98, sheen: 0.6, sheenColor: new THREE.Color('#9fb0c0') }), { cast: false }));
    const back = P.mesh(new THREE.BoxGeometry(30, 3.2, 0.2), P.phys('#c4cfda', { roughness: 0.9 }), { y: 1.6, z: -3.2 });
    scene.add(back);
    for (let i = -4; i <= 4; i++) {
      const win = P.mesh(new THREE.PlaneGeometry(1.6, 1.7), new THREE.MeshBasicMaterial({ color: new THREE.Color('#cfe4f5').multiplyScalar(1.6) }), { x: i * 2.0, y: 1.75, z: -3.09, cast: false });
      scene.add(win);
    }
    for (let i = -3; i <= 3; i++) for (let j = 0; j < 3; j++) scene.add(P.mesh(new THREE.PlaneGeometry(1.1, 0.5).rotateX(PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(2.2) }), { x: i * 2.4, y: 3.0, z: -2 + j * 2.5, cast: false }));
    scene.add(P.mesh(new THREE.PlaneGeometry(30, 30).rotateX(PI / 2), P.std('#f2f2ee'), { y: 3.02, cast: false }));
    const cub = P.cubicleWall(2.6); cub.position.set(0, 0, -0.62); scene.add(cub);
    const cub2 = P.cubicleWall(1.8); cub2.position.set(-1.33, 0, 0.25); cub2.rotation.y = PI / 2; scene.add(cub2);
    const cub3 = P.cubicleWall(2.6, 1.45, '#8a9bb0'); cub3.position.set(3.4, 0, -1.5); scene.add(cub3);
    const desk = P.desk(); scene.add(desk);
    const perch = P.perch(); perch.position.set(-0.52, 0.775, -0.12); scene.add(perch);
    const plant = P.plant(); plant.position.set(2.2, 0, -2.6); plant.scale.setScalar(1.6); scene.add(plant);
    const parrot = makeCharacter('macaw'); parrot.root.position.set(-0.52, 1.2, -0.11); scene.add(parrot.root); cast.parrot = parrot;
    const gary = makeCharacter('gary'); scene.add(gary.root); cast.gary = gary;
    // memory bubble: you ranting at home while the parrot takes notes
    W.memory = new ThoughtBubble(engine, (sub) => {
      sub.background = new THREE.Color('#f2c98f');
      sub.environment = engine.roomEnv; sub.environmentIntensity = 0.55;
      sub.add(P.mesh(new THREE.PlaneGeometry(10, 6), P.std('#e9b57a'), { z: -1.2, y: 1.5 }));
      sub.add(P.mesh(new THREE.PlaneGeometry(10, 10).rotateX(-PI / 2), P.std('#a8754a'), { y: 0 }));
      const c = P.couch('#5b8fc1'); c.position.set(0, 0, -0.75); sub.add(c);
      const o = makeCharacter('owner'); o.root.position.set(-0.25, 0, 0.1); o.root.rotation.y = 0.35; sub.add(o.root);
      const pp = P.perch(); pp.position.set(0.75, 0, 0.0); pp.scale.setScalar(2.2); sub.add(pp);
      const pa = makeCharacter('macaw'); pa.root.position.set(0.75, 0.86, 0.0); pa.root.rotation.y = -0.6; sub.add(pa.root);
      const k = new THREE.DirectionalLight('#fff1dc', 2.4); k.position.set(1.5, 3, 2.5); sub.add(k, new THREE.HemisphereLight('#fff6e8', '#8a6040', 0.8));
      const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 30);
      camera.position.set(0.25, 1.45, 3.0); camera.lookAt(0.25, 1.15, 0);
      return {
        camera,
        update(lt) {
          const g = Math.sin(lt * 7.0), g2 = Math.sin(lt * 5.3 + 1);
          o.pose({ jaw: clamp01(0.5 + 0.5 * Math.sin(lt * 17) * Math.sin(lt * 5.7)), head: [0.05, 0.25 + 0.1 * g2, 0.05 * g],
            nodes: { arm_l: [-1.0 - 0.4 * g, 0, 0.3], fore_l: [-0.8 + 0.4 * g2, 0, 0], arm_r: [-0.9 + 0.4 * g2, 0, -0.35], fore_r: [-1.1, 0, 0] },
            lids: 0.85, look: [0.5, 0], dilate: 1 });
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
        gary.root.visible = true;
        gary.root.position.set(1.0, 0, 0.35); gary.root.rotation.set(0, -PI / 2 + 0.25, 0);
        gary.pose({ lids: blink(t, 3), look: [-0.3, 0] });
        W.memory.group.visible = false;
      },
    };
  },
};

// =========================================================================================================
// shots: [start anchor, scene, camera, update, extras]
function shotList() {
  const dogHead = () => world(cast.dog, 'head', [0, 0.13, 0.12]);
  const S = [];
  const add = (start, scene, o) => S.push({ start, scene, ...o });

  // 1. dog's face inches from the camera (POV from the pillow)
  add('n1', 'bedroom', {
    update(c) {
      cast.ownerBed.root.visible = false;
      cast.dog.pose({ head: [0.12, -0.25, 0.05], tail: Math.sin(c.t * 9) * 0.5, lids: blink(c.t, 1, 2.6), look: [0.05, 0.2], ears: [0.05, 0.05] });
    },
    camera(cam, lt, c) {
      const e = dogHead();
      const k = ease.inOut(lt / c.dur);
      aim(cam, mixV(V(-0.12, 0.92, -2.05), V(-0.3, 0.9, -2.15), k), V(e.x, e.y - 0.02, e.z), { fov: 32, t: c.t });
    },
    dof: { focus: (c) => dist(c.camera.position, dogHead()), aperture: 0.05 },
  });
  // 2. swoop back: you asleep, dog beside the bed
  add('n1@your', 'bedroom', {
    update(c) { cast.dog.pose({ head: [0.1, -0.2, 0], tail: Math.sin(c.t * 10) * 0.6, lids: 1, look: [0.2, 0] }); },
    camera(cam, lt, c) {
      const k = ease.out(lt / c.dur);
      aim(cam, mixV(V(-0.35, 1.05, -1.75), V(1.05, 2.0, 0.55), k), mixV(V(-0.7, 0.8, -2.35), V(-0.45, 0.7, -2.35), k), { fov: 40, t: c.t });
    },
    dof: { focus: (c) => dist(c.camera.position, V(-0.6, 0.75, -2.4)), aperture: 0.012 },
  });
  // 3. the alarm clock: 5:00
  add('n1@5', 'bedroom', {
    update(c) {
      cast.dog.root.position.set(-1.0, 0, -2.25); cast.dog.root.rotation.y = PI / 2 - 0.6;
      const lean = ease.inOut(ramp(c.t, at('n1@5') + 0.6, at('n1@to')));
      cast.dog.pose({ head: [0.25 + 0.1 * lean, 0.35 * lean, 0], lids: 1, look: [0.6, -0.3], tail: Math.sin(c.t * 9) * 0.4 });
    },
    camera(cam, lt, c) {
      const k = ease.inOut(lt / c.dur);
      aim(cam, mixV(V(-0.55, 0.7, -2.45), V(-0.66, 0.68, -2.52), k), V(-1.22, 0.6, -2.78), { fov: 30, t: c.t });
    },
    dof: { focus: (c) => dist(c.camera.position, V(-1.22, 0.6, -2.78)), aperture: 0.06 },
  });
  // 4. the dog leans in: "to say one word"
  add('n1@to', 'bedroom', {
    update(c) { cast.ownerBed.root.visible = false; cast.dog.pose({ head: [0.0, -0.3, 0.1], lids: 1, look: [0.1, 0.25], ears: [0.15, 0.15], tail: Math.sin(c.t * 12) * 0.7 }); },
    camera(cam, lt, c) {
      const e = dogHead(); const k = ease.inOut(lt / c.dur);
      aim(cam, mixV(V(-0.1, 0.95, -2.0), V(-0.25, 0.92, -2.12), k), V(e.x, e.y, e.z), { fov: 30, t: c.t });
    },
    dof: { focus: (c) => dist(c.camera.position, dogHead()), aperture: 0.05 },
  });
  // 5-7. "Walk. Walk? WALK!" — snap push-in on every word
  ['dog1', 'dog2', 'dog3'].forEach((id, i) => add(`${id}+-0.06`, 'bedroom', {
    update(c) {
      cast.ownerBed.root.visible = false;
      const m = talk('dog', c.t, 1.15);
      const ear = i === 2 ? 0.25 + 0.35 * Math.sin(c.lt * 30) * Math.exp(-c.lt * 3) : 0.08 * i;
      cast.dog.pose({ head: [0.0 - m * 0.12, -0.3 + i * 0.05, 0.08 * (i - 1)], jaw: m, jawMax: 0.5, lids: 1, look: [0.08, 0.2], ears: [ear, ear], tail: Math.sin(c.t * 14) * 0.8, dilate: 1.1 + i * 0.1 });
    },
    camera(cam, lt, c) {
      const e = dogHead();
      const d0 = [1.0, 0.76, 0.58][i], d1 = d0 * 0.9;
      const k = ease.expo(lt / 0.22) * 0.7 + 0.3 * (lt / c.dur);
      const dir = V(0.85, 0.08, 0.5).normalize();
      const shake = i === 2 ? Math.exp(-lt * 6) * 0.012 : 0.0;
      const pos = e.clone().addScaledVector(dir, lerp(d0 * 1.12, d1, k)).add(V(Math.sin(lt * 70) * shake, Math.cos(lt * 63) * shake, 0));
      aim(cam, pos, e, { fov: 32, t: c.t, roll: (i - 1) * 0.04 });
    },
    dof: { focus: (c) => dist(c.camera.position, dogHead()), aperture: 0.05 },
  }));
  // 8. "You see, the average dog knows about 165 words" — words orbit (8a close), then the counter climbs (8b wide)
  const vocab = {
    update(c) {
      const d = cast.dog;
      d.root.position.set(0.55, 0, 0.6); d.root.rotation.y = 0;
      const tilt = Math.sin(c.t * 1.6) * 0.18;
      d.pose({ head: [0.08, 0.1 * Math.sin(c.t), tilt], lids: blink(c.t, 1), look: [0, 0.15], tail: Math.sin(c.t * 8) * 0.5, ears: [0.1, -0.05] });
      const n = Math.round(165 * ease.out(ramp(c.t, at('n2@knows'), at('n2@words') + 0.25)));
      W.counter.setText(String(n));
      W.cgrp.visible = c.t > at('n2@knows') - 0.2;
      const pop = ease.back(ramp(c.t, at('n2@knows') - 0.2, at('n2@knows') + 0.25));
      W.cgrp.scale.setScalar(Math.max(0.001, pop) * (n === 165 ? 1 + 0.08 * Math.exp(-(c.t - at('n2@words') - 0.25) * 6) : 1));
      W.cgrp.position.set(0.55, 2.15, 0.5);
    },
    post(c) {
      const head = world(cast.dog, 'head', [0, 0.12, 0.05]);
      W.words.forEach((w, j) => {
        const a = c.t * 0.9 + (j / W.words.length) * PI * 2, rr = 0.42 + 0.04 * Math.sin(j * 2.1);
        w.group.visible = true;
        w.group.position.set(head.x + Math.cos(a) * rr, head.y + 0.3 + 0.05 * Math.sin(a * 2 + j), head.z + Math.sin(a) * rr * 0.8);
        w.group.lookAt(c.camera.position.x, w.group.position.y, c.camera.position.z);
        w.group.scale.setScalar(Math.max(0.001, ease.back(ramp(c.t, at('n2') + j * 0.12, at('n2') + 0.4 + j * 0.12))));
      });
      W.cgrp.lookAt(c.camera.position);
    },
  };
  add('n2', 'bedroom', {
    ...vocab,
    camera(cam, lt, c) {
      const k = ease.inOut(lt / c.dur);
      const a = lerp(0.32, 0.08, k);
      aim(cam, V(0.55 + Math.sin(a) * 1.45, 0.72 + 0.06 * k, 0.6 + Math.cos(a) * 1.45), V(0.55, 0.92, 0.75), { fov: 40, t: c.t });
    },
    dof: { focus: (c) => dist(c.camera.position, V(0.55, 0.9, 0.75)), aperture: 0.02 },
  });
  add('n2@165+-0.1', 'bedroom', {
    ...vocab,
    camera(cam, lt, c) {
      const k = ease.inOut(lt / c.dur);
      const a = lerp(-0.4, 0.2, k);
      aim(cam, V(0.55 + Math.sin(a) * 3.2, 1.5 - 0.1 * k, 0.6 + Math.cos(a) * 3.2), V(0.55, 1.45, 0.6), { fov: 40, t: c.t });
    },
    dof: { focus: (c) => dist(c.camera.position, V(0.55, 0.9, 0.7)), aperture: 0.012 },
  });
  // 9. "and it would use all of them to ask for food." — thought bubble
  add('n2@and', 'bedroom', {
    update(c) {
      const d = cast.dog;
      d.root.position.set(0.55, 0, 0.6); d.root.rotation.y = 0;
      const look = ease.inOut(ramp(c.t, at('n2@and'), at('n2@and') + 0.6));
      d.pose({ head: [-0.35 * look, 0.15 * look, 0.12 * look], jaw: 0.25 + 0.1 * Math.sin(c.t * 7), lids: 1, look: [0.3 * look, 0.7 * look], tail: Math.sin(c.t * 13) * 0.8, ears: [0.15, 0.15], dilate: 1.25 });
    },
    post(c) {
      const head = world(cast.dog, 'head', [0, 0.16, 0.08]);
      const open = ease.out(ramp(c.t, at('n2@use') - 0.2, at('n2@use') + 0.25));
      W.foodBubble.update(c.camera, { from: head, at: head.clone().add(V(0.3, 0.5, 0.05)), open, lt: c.lt });
    },
    camera(cam, lt, c) {
      const k = ease.inOut(lt / c.dur);
      aim(cam, mixV(V(1.05, 1.3, 3.0), V(0.95, 1.4, 2.6), k), mixV(V(0.7, 1.35, 0.6), V(0.75, 1.45, 0.6), k), { fov: 40, t: c.t });
    },
    dof: { focus: (c) => dist(c.camera.position, V(0.6, 1.1, 0.65)), aperture: 0.008 },
  });
  // 10. the cat on the windowsill says nothing
  add('n3', 'bedroom', {
    update(c) {
      const sl = clamp01(Math.sin(ramp(c.t, at('n3@wouldn') - 0.1, at('n3@thing') + 0.3) * PI));
      cast.cat.pose({ head: [0.05, 0.25, 0.04], lids: 1 - 0.65 * sl, look: [0.15, 0], tail: Math.sin(c.t * 2.1) * 0.12 });
    },
    camera(cam, lt, c) {
      const k = ease.inOut(lt / c.dur);
      const a = lerp(-0.55, -0.25, k);
      const cp = V(2.43, 1.1, -0.9);
      aim(cam, V(cp.x - Math.cos(a) * 1.15, 1.08, cp.z - Math.sin(a) * 1.15), V(2.43, 1.12, -0.88), { fov: 34, t: c.t });
    },
    dof: { focus: (c) => dist(c.camera.position, V(2.43, 1.2, -0.9)), aperture: 0.03 },
    exposure: 1.05,
  });
  // 11. the herd + 1.5 billion
  add('n4', 'farm', {
    update(c) {
      const v = 1.5e9 * ease.out(ramp(c.t, at('n4@earth'), at('n4@cows')));
      W.farmNum.setText(commas(v));
    },
    camera(cam, lt, c) {
      const k = ease.inOut(lt / c.dur);
      const H = c.S.H; aim(cam, mixV(V(-7, 40, -28), V(2, 18, -55), k), V(0, H(0, -125) + 3.2, -125), { fov: 42, t: c.t, amp: 4 });
    },
  });
  // 12. drive-thru: a cow arrives at your window
  add('n4@and', 'drivethru', {
    update(c) {
      const k = ease.out(ramp(c.t, at('n4@and') + 0.15, at('n4@burgers')));
      const cow = cast.cowHead;
      cow.root.position.set(lerp(-2.6, -1.32, k), -0.5, 0.18); cow.root.rotation.set(0, PI / 2, 0);
      cow.pose({ head: [0.1, -0.15 * (1 - k), 0], lids: blink(c.t, 2, 3.0), look: [0.35, -0.1], ears: [0.2 * Math.sin(c.t * 3), 0.1] });
      W.handBurger.position.set(-0.32, 0.74, 0.08); W.handBurger.rotation.set(0.25, -PI / 2 + 0.3, -0.15);
    },
    camera(cam, lt, c) {
      const k = ease.inOut(lt / c.dur);
      aim(cam, V(0.02, 1.02, 0.32), mixV(V(-0.7, 0.62, -0.2), V(-0.85, 0.78, 0.12), k), { fov: 44, t: c.t });
    },
    dof: { focus: 1.0, aperture: 0.01 },
  });
  // 13. "We need to talk."
  add('cow+-0.1', 'drivethru', {
    update(c) {
      const cow = cast.cowHead;
      cow.root.position.set(-1.27, -0.5, 0.18); cow.root.rotation.set(0, PI / 2, 0);
      const m = talk('cow', c.t, 1.0);
      cow.pose({ head: [0.12 - m * 0.04, 0.05, 0], jaw: m, jawMax: 0.32, lids: 0.72, look: [0.45, -0.05], ears: [-0.15, -0.15] });
      const lower = ease.inOut(ramp(c.t, at('cow@to'), at('cow.end') + 0.2));
      W.handBurger.position.set(-0.32, 0.74 - lower * 0.18, 0.08 + lower * 0.04); W.handBurger.rotation.set(0.25 + lower * 0.3, -PI / 2 + 0.3, -0.15);
    },
    camera(cam, lt, c) {
      const k = ease.inOut(lt / c.dur);
      const e = world(cast.cowHead, 'head', [0, -0.07, 0.24]);
      aim(cam, mixV(V(0.02, 0.95, 0.32), V(-0.2, 0.9, 0.26), k), e, { fov: 38, t: c.t });
    },
    dof: { focus: (c) => dist(c.camera.position, world(cast.cowHead, 'head', [0, 0.06, 0.22])), aperture: 0.03 },
  });
  // 14. pigeons on the ledge
  add('n5', 'ledge', {
    camera(cam, lt, c) {
      const k = ease.inOut(lt / c.dur);
      aim(cam, V(lerp(-2.7, -2.15, k), 15.24, lerp(-0.42, -0.36, k)), V(lerp(0.6, 0.9, k), 15.06, -0.05), { fov: 30, t: c.t });
    },
    dof: { focus: (c) => dist(c.camera.position, V(-1.15, 15.12, -0.08)), aperture: 0.01 },
  });
  // 15. "Nice bald spot!" — the pigeon's view straight down onto the man's head
  const pigeonTalk = (c) => {
    const m = talk('pigeon', c.t, 1.0);
    W.pigeons[2].pose({ head: [0.55 + m * 0.15, 0.0, 0.0], jaw: m, jawMax: 0.7, lids: 1, look: [0, -0.4] });
    const laugh = ramp(c.t, at('pigeon@spot') + 0.15, at('pigeon@spot') + 0.35);
    W.pigeons.forEach((q, i) => {
      if (i === 2 || laugh <= 0) return;
      const b = Math.abs(Math.sin(c.t * 12 + i * 1.3));
      q.pose({ head: [-0.2 + 0.45 * b * laugh, (i < 2 ? 0.55 : -0.55) * laugh, 0], jaw: 0.8 * b * laugh, jawMax: 0.7, lids: 1 - 0.5 * laugh });
    });
    cast.bald.root.position.set(0.35 - (c.t - at('pigeon')) * 0.9, 0.15, -1.55);
  };
  add('pigeon+-0.12', 'ledge', {
    update(c) { pigeonTalk(c); },
    camera(cam, lt, c) {
      const k = ease.inOut(lt / c.dur);
      const head = world(cast.bald, 'head', [0, 0.18, 0]);
      aim(cam, V(head.x + 0.35, 15.35, -0.62), head.clone().add(V(0, 0, -0.1)), { fov: lerp(7.5, 6.2, k), t: c.t, amp: 0.15 });
    },
    dof: { focus: (c) => dist(c.camera.position, world(cast.bald, 'head', [0, 0.18, 0])), aperture: 0.0 },
  });
  // 15b. the pigeons cackle
  add('pigeon@spot+0.12', 'ledge', {
    update(c) {
      W.pigeons.forEach((p, i) => { p.root.position.set((i - 2) * 0.2, 15.0, -0.1 + (i % 2) * 0.05); p.root.rotation.y = PI + (i - 2) * 0.25; });
      pigeonTalk(c);
    },
    camera(cam, lt, c) {
      const k = ease.out(lt / c.dur);
      aim(cam, mixV(V(0.2, 15.12, -1.75), V(0.08, 15.12, -1.5), k), V(0.0, 15.12, -0.05), { fov: 38, t: c.t });
    },
    dof: { focus: (c) => dist(c.camera.position, V(0, 15.13, -0.08)), aperture: 0.01 },
  });
  // 16. the parrot remembers everything you said
  add('n6', 'office', {
    update(c) {
      const pa = cast.parrot;
      pa.pose({ head: [0.1, 0.35 * Math.sin(c.t * 0.9), 0.3 * Math.sin(c.t * 2.4)], lids: blink(c.t, 5), look: [0.3, 0.2] });
      cast.gary.root.visible = false;
    },
    post(c) {
      const head = world(cast.parrot, 'head', [0, 0.08, 0.02]);
      W.memory.update(c.camera, { from: head, at: head.clone().add(V(0.3, 0.3, 0.05)), open: ease.out(ramp(c.t, at('n6@repeat') - 0.15, at('n6@repeat') + 0.3)), lt: c.lt });
    },
    camera(cam, lt, c) {
      const k = ease.inOut(lt / c.dur);
      aim(cam, mixV(V(-0.12, 1.55, 1.95), V(-0.02, 1.62, 1.62), k), mixV(V(-0.3, 1.55, -0.1), V(-0.25, 1.65, -0.1), k), { fov: 40, t: c.t });
    },
    dof: { focus: (c) => dist(c.camera.position, V(-0.45, 1.5, -0.1)), aperture: 0.01 },
  });
  // 17. "...to your boss." — the camera swings over to Gary walking up
  const garyWalk = (c) => {
    const g = cast.gary;
    const k = ease.out(ramp(c.t, at('n6@to') - 0.25, at('parrot') - 0.05));
    g.root.visible = true;
    g.root.position.set(lerp(2.7, 1.0, k), 0, 0.35); g.root.rotation.set(0, -PI / 2 + 0.25, 0);
    const step = Math.sin(c.t * 9) * (1 - k);
    g.pose({ body: [0, 0, step * 0.03], nodes: { arm_l: [step * 0.35, 0, 0.05], arm_r: [-step * 0.35, 0, -0.05] }, lids: 1, look: [-0.5, 0], head: [0, -0.2, 0] });
  };
  add('n6@to+-0.05', 'office', {
    update(c) { garyWalk(c); },
    camera(cam, lt, c) {
      const k = ease.inOut(lt / c.dur);
      const f = ease.out(clamp01(lt / (c.dur * 0.55)));
      const gh = world(cast.gary, 'head', [0, -0.1, 0]);
      aim(cam, mixV(V(-0.1, 1.55, 1.6), V(0.7, 1.5, 2.5), k), mixV(V(-0.4, 1.5, -0.1), gh, f), { fov: 42, t: c.t });
    },
    dof: { focus: (c) => dist(c.camera.position, world(cast.gary, 'head')), aperture: 0.006 },
  });
  // 18. "Gary smells like soup!" — wings out
  add('parrot+-0.12', 'office', {
    update(c) {
      const pa = cast.parrot;
      const m = talk('parrot', c.t, 1.0);
      const spread = ease.out(ramp(c.t, at('parrot') - 0.1, at('parrot') + 0.15));
      pa.pose({ head: [-0.1 + m * 0.15, 0.45, 0.1 * Math.sin(c.t * 9)], jaw: m, jawMax: 0.5, lids: 1, look: [0.6, 0], dilate: 0.7,
        nodes: { wing_l: [0, -0.2 * spread, 1.1 * spread + 0.15 * Math.sin(c.t * 18) * spread], wing_r: [0, 0.2 * spread, -1.1 * spread - 0.15 * Math.sin(c.t * 18) * spread], beak: [0, 0, 0] } });
      cast.gary.root.visible = true;
    },
    camera(cam, lt, c) {
      const e = world(cast.parrot, 'head', [0, 0.04, 0.05]);
      const k = ease.out(lt / c.dur);
      aim(cam, e.clone().add(V(lerp(0.75, 0.55, k), lerp(0.02, 0.0, k), lerp(0.55, 0.42, k))), e.clone().add(V(0.05, -0.05, 0)), { fov: 38, t: c.t, roll: -0.05 });
    },
    dof: { focus: (c) => dist(c.camera.position, world(cast.parrot, 'head', [0, 0.04, 0.05])), aperture: 0.03 },
  });
  // 19. Gary sniffs his shirt
  add('parrot.end+0.12', 'office', {
    update(c) {
      const g = cast.gary;
      g.root.visible = true;
      const k = ease.inOut(ramp(c.t, at('parrot.end') + 0.12, at('parrot.end') + 0.55));
      const sn = Math.max(0, Math.sin((c.t - at('parrot.end')) * 9)) * k;
      g.pose({ head: [0.5 * k + 0.06 * sn, 0.3 * k, 0.05 * k], nodes: { arm_l: [-1.25 * k, 0, -0.35 * k], fore_l: [-2.05 * k, -0.3 * k, 0] }, lids: 1 - 0.35 * k, look: [0.3 * k - 0.6 * (1 - k), -0.5 * k] });
    },
    camera(cam, lt, c) {
      const e = world(cast.gary, 'head', [0, 0.0, 0.0]);
      aim(cam, e.clone().add(V(-0.95, -0.02, 0.85)), e.clone().add(V(0, -0.14, 0.05)), { fov: 36, t: c.t });
    },
    dof: { focus: (c) => dist(c.camera.position, world(cast.gary, 'head')), aperture: 0.015 },
  });
  // 20. "But when someone finally asked the cat why it never said a word..."
  const catAsked = (c) => {
    const turn = ease.inOut(ramp(c.t, at('n7@why'), at('n7@word') + 0.2));
    cast.cat.pose({ head: [0.05, 0.25 + 0.45 * turn, 0.04 - 0.05 * turn], lids: blink(c.t, 4, 4.4) * (1 - 0.2 * turn), look: [0.15 + 0.4 * turn, 0], tail: Math.sin(c.t * 2.1) * 0.12 });
  };
  add('n7', 'bedroom', {
    update: catAsked,
    camera(cam, lt, c) {
      const k = ease.inOut(lt / c.dur);
      aim(cam, mixV(V(0.6, 1.35, 0.9), V(0.95, 1.3, 0.55), k), V(2.43, 1.15, -0.88), { fov: 36, t: c.t });
    },
    dof: { focus: (c) => dist(c.camera.position, V(2.43, 1.22, -0.9)), aperture: 0.015 },
    exposure: 1.05,
  });
  add('n7@cat+-0.08', 'bedroom', {
    update: catAsked,
    camera(cam, lt, c) {
      const k = ease.inOut(lt / c.dur);
      aim(cam, mixV(V(1.55, 1.18, -0.2), V(1.78, 1.17, -0.42), k), V(2.43, 1.17, -0.88), { fov: 34, t: c.t });
    },
    dof: { focus: (c) => dist(c.camera.position, V(2.43, 1.22, -0.9)), aperture: 0.03 },
    exposure: 1.05,
  });
  // 21. "Oh, we could always talk. We just didn't want to." — then it turns away
  const catAnswers = (c) => {
    const m = talk('cat', c.t, 1.0);
    const away = ease.inOut(ramp(c.t, at('cat.end') - 0.05, at('cat.end') + 0.6));
    const bored = ramp(c.t, at('cat@just') - 0.2, at('cat@just') + 0.2);
    cast.cat.pose({ head: [0.0 + m * 0.05, 0.7 - 1.25 * away, 0.0 + 0.1 * away], jaw: m, jawMax: 0.9, lids: lerp(0.55, 0.4, bored) * (1 - 0.6 * away),
      look: [0.15 - 0.6 * away, 0.05], tail: Math.sin(c.t * 2.4) * 0.15 + away * 0.3 });
  };
  add('cat+-0.1', 'bedroom', {
    update: catAnswers,
    camera(cam, lt, c) {
      const e = world(cast.cat, 'head', [0, 0.04, 0.06]);
      const k = ease.out(lt / c.dur);
      aim(cam, e.clone().add(V(-0.6 + 0.05 * k, -0.03, 0.3 - 0.03 * k)), e.clone().add(V(0, -0.025, 0)), { fov: 32, t: c.t });
    },
    dof: { focus: (c) => dist(c.camera.position, world(cast.cat, 'head', [0, 0.04, 0.06])), aperture: 0.04 },
    exposure: 1.05,
  });
  add('cat@just+-0.12', 'bedroom', {
    update: catAnswers,
    camera(cam, lt, c) {
      const e = world(cast.cat, 'head', [0, 0.04, 0.06]);
      const k = ease.out(lt / Math.min(c.dur, 1.6));
      aim(cam, e.clone().add(V(-0.5 + 0.06 * k, 0.0, 0.1 + 0.02 * k)), e.clone().add(V(0, -0.02, 0)), { fov: 30, t: c.t });
    },
    dof: { focus: (c) => dist(c.camera.position, world(cast.cat, 'head', [0, 0.04, 0.06])), aperture: 0.045 },
    exposure: 1.05,
  });
  return S;
}

// =========================================================================================================
const episode = {
  fps: 30,
  duration: 44,
  scenes,
  shots: [],
  async setup(engine) {
    TL = await fetch(new URL('./build/timeline.json', import.meta.url)).then((r) => r.json());
    episode.duration = TL.duration;
    await Promise.all([loadCast(['dog', 'cat', 'cow_head', 'cow', 'pigeon', 'macaw', 'gary', 'owner', 'bald', 'hand']), loadFont()]);
    // herd template: the single-mesh low-detail cow
    const probe = makeCharacter('cow');
    let m = null; probe.root.traverse((o) => { if (o.isMesh && !m) m = o; });
    cast.cowTemplate = { geometry: m.geometry, material: m.material };
    const S = shotList();
    episode.shots = S.map((s, i) => ({ ...s, t0: i === 0 ? 0 : at(s.start), t1: i + 1 < S.length ? at(S[i + 1].start) : TL.duration + 1 }));
  },
};
export default episode;
