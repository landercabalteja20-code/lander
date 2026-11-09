// Sets for "47 planets": eight alien tour stops, the galaxy map, Earth from orbit, and Earth's parking lot.
import * as THREE from 'three';
import { createSkyDome, createStars, createPlanet, createSun, createAurora, createGalaxy } from '../../kit/sky.js';
import { createStage, createFlatbedStage, createBeam } from '../../kit/stage.js';
import { createCrowd, createLightSea } from '../../kit/crowd.js';
import { createParticles, createRain } from '../../kit/particles.js';
import { createTerrain, createOcean } from '../../kit/terrain.js';
import * as City from '../../kit/city.js';
import { rng, fbm, smooth, clamp, lerp, textTexture, canvasTexture, heartShape, radialGlowTexture, std } from '../../kit/util.js';

export const PERFORMER = new THREE.Vector3(0, 1.8, -3.84);

// ---------------------------------------------------------------------------------------------- helpers
function base({ sky, fog = null, stars = false, hemi = ['#ffffff', '#333344', 0.5], env = 0.3 }) {
  const scene = new THREE.Scene();
  const ups = [];
  scene.add(createSkyDome(sky));
  if (fog) scene.fog = new THREE.Fog(fog[0], fog[1], fog[2]);
  if (stars) {
    const st = createStars(typeof stars === 'object' ? stars : {});
    scene.add(st);
    ups.push((c) => st.userData.update(c.t, c.engine.gH));
  }
  scene.add(new THREE.HemisphereLight(hemi[0], hemi[1], hemi[2]));
  scene.environmentIntensity = env;
  return { scene, ups };
}

// key (shadowed) + rim + fill spotlights aimed at the performer
function rig(scene, P, { key = '#fff1e0', keyI = 2.6, rim = '#ff7ad9', rimI = 2.0, fill = '#7aa0ff', fillI = 0.6, keyOff = [3.5, 8, 8], angle = 0.3 } = {}) {
  const tgt = new THREE.Object3D(); tgt.position.copy(P).add(new THREE.Vector3(0, 1.1, 0)); scene.add(tgt);
  const mk = (color, I, off, shadow) => {
    const pos = P.clone().add(new THREE.Vector3(...off));
    const d = pos.distanceTo(tgt.position);
    const l = new THREE.SpotLight(color, I * d * d, 0, angle, 0.65, 2);
    l.position.copy(pos); l.target = tgt;
    if (shadow) {
      l.castShadow = true; l.shadow.mapSize.set(1024, 1024); l.shadow.bias = -0.0003; l.shadow.normalBias = 0.02;
      l.shadow.camera.near = Math.max(0.5, d - 6); l.shadow.camera.far = d + 8;
    }
    scene.add(l);
    return l;
  };
  return { key: mk(key, keyI, keyOff, true), rim: mk(rim, rimI, [-3, 6.5, -5], false), fill: mk(fill, fillI, [-4.5, 2.5, 7], false), target: tgt };
}

export function perform(star, P, ctx, extra = {}) {
  ctx.scene.add(star.group);
  star.group.position.copy(P);
  star.group.rotation.set(0, extra.yaw || 0, 0);
  star.setWet(extra.wet || 0);
  star.update(ctx.t, { ...ctx.perf, look: ctx.camera.position, ...extra });
}

// random point in a trapezoid in front of the stage (z0..z1, half-width w0..w1)
function fan(R, z0, z1, w0, w1, gap = 0) {
  const z = lerp(z0, z1, Math.sqrt(R()));
  const w = lerp(w0, w1, (z - z0) / (z1 - z0));
  let x = (R() * 2 - 1) * w;
  if (gap && Math.abs(x) < gap) x = Math.sign(x || 1) * (gap + R() * 2);
  return { x, z };
}

function hillsFn(seed, amp, flatR = 70, falloff = 220, sharp = 1) {
  return (x, z) => {
    const d = Math.hypot(x, z * 0.8);
    const k = smooth((d - flatR) / falloff);
    return Math.pow(fbm(x * 0.0035, z * 0.0035, 4, seed), sharp) * amp * k - (sharp > 1 ? 0 : amp * 0.3 * k);
  };
}

function seaOfLights(groundFn, { count = 26000, z0 = 42, z1 = 800, w0 = 26, slope = 0.95, colors, seed = 2, size = 9 } = {}) {
  return createLightSea({
    count, seed, colors, size,
    place: (i, R) => { const z = lerp(z0, z1, Math.pow(R(), 1.6)); const w = w0 + (z - z0) * slope; const x = (R() * 2 - 1) * w; return { x, z, y: groundFn(x, z) + 1.4 }; },
  });
}

// ---------------------------------------------------------------------------------------------- planets
export function zorb(engine, star) {
  const { scene, ups } = base({ sky: { top: '#0b0522', horizon: '#9b3f98', bottom: '#12081c', exponent: 0.42 }, fog: ['#3a1a52', 90, 1100], stars: { count: 2600, seed: 1 }, hemi: ['#b9a0ff', '#24142e', 0.55], env: 0.25 });
  const hf = hillsFn(3, 120);
  scene.add(createTerrain({ size: 2400, seg: 110, heightFn: hf, colorFn: (x, z, y) => new THREE.Color('#2a1942').lerp(new THREE.Color('#6a4290'), clamp(y / 70)), roughness: 0.95 }));
  const giant = createPlanet({ radius: 330, type: 'gas', colors: ['#f2b07a', '#ffd9a8', '#c8705a', '#f7c48f', '#a8506a'], seed: 4, rings: { inner: 1.35, outer: 2.25, colors: ['#ffd9b0', '#d49a7a', '#f2c8a0'] }, glow: '#ff9ac8', tilt: 0.32 });
  giant.position.set(-400, 270, -1250); scene.add(giant);
  const moon = createPlanet({ radius: 55, type: 'rock', colors: ['#8d86a8', '#c9c1e0', '#6a6488'], seed: 9, glow: '#d7c8ff', glowSize: 1.2 });
  moon.position.set(420, 560, -1500); scene.add(moon);
  const stage = createStage({ led: ['#ff3fb4', '#7b3bff', '#ffd84f'], trim: '#ff4fd8', beamColors: ['#ff6ad5', '#8a7bff', '#fff2c8'] });
  scene.add(stage.group);
  const crowd = createCrowd({ species: 'blob', count: 1150, seed: 5, place: (i, R) => fan(R, 6.5, 38, 13, 28, 2.2), face: [0, -4], ground: () => 0 });
  scene.add(crowd.group);
  const sea = seaOfLights(hf, { colors: ['#ff4fd8', '#4ff0ff', '#ffe14f', '#b48bff'] });
  scene.add(sea);
  const dust = createParticles({ type: 'dust', count: 900, box: [40, 16, 40], center: [0, 7, 8], color: '#ffc8f0' });
  scene.add(dust);
  rig(scene, PERFORMER, { rim: '#ff5ad0', fill: '#5a8bff' });
  return {
    scene, bloom: { strength: 0.75, threshold: 0.92, radius: 0.55 },
    update(ctx) {
      ups.forEach((f) => f(ctx));
      stage.update(ctx.t, ctx.beat, ctx.energy); crowd.update(ctx.t, ctx.beat, ctx.energy);
      sea.userData.update(ctx.t, ctx.beat, engine.gH); dust.userData.update(ctx.t, engine.gH);
      giant.userData.spin(ctx.t, 0.008);
      perform(star, PERFORMER, ctx);
    },
  };
}

export function glacia(engine, star) {
  const { scene, ups } = base({ sky: { top: '#030a1c', horizon: '#2f5f8f', bottom: '#06101c', exponent: 0.5 }, fog: ['#24456a', 80, 900], stars: { count: 2600, seed: 2 }, hemi: ['#9fc4ff', '#1a2a3a', 0.45], env: 0.22 });
  const hf = hillsFn(7, 160, 70, 200, 2.2);
  scene.add(createTerrain({ size: 2400, seg: 120, heightFn: hf, colorFn: (x, z, y) => new THREE.Color('#b8d4f0').lerp(new THREE.Color('#6f94bf'), clamp(fbm(x * 0.02, z * 0.02, 2, 3))), roughness: 0.55 }));
  // ice spires
  const R = rng(12);
  const spireMat = new THREE.MeshStandardMaterial({ color: '#a9dcff', roughness: 0.08, metalness: 0.2, flatShading: true, emissive: '#1d4a80', emissiveIntensity: 0.25, transparent: true, opacity: 0.9 });
  const spires = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 5), spireMat, 90);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 90; i++) {
    const a = R() * Math.PI - Math.PI, d = 60 + R() * 500;
    const x = Math.sin(a) * d * 1.3, z = -Math.cos(a) * d * 0.9 + (R() < 0.3 ? 200 : 0);
    if (Math.abs(x) < 40 && z > -20 && z < 60) continue;
    const h = 10 + R() * 70;
    m4.compose(new THREE.Vector3(x, hf(x, z) + h / 2 - 2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - 0.5) * 0.2, R() * 3, (R() - 0.5) * 0.2)), new THREE.Vector3(h * 0.18, h, h * 0.18));
    spires.setMatrixAt(i, m4);
  }
  scene.add(spires);
  const aur = createAurora({ y: 260, z: -1100, width: 2400, height: 420 });
  scene.add(aur);
  const iceMoon = createPlanet({ radius: 190, type: 'ice', colors: ['#dff2ff', '#9fc7ea', '#ffffff', '#7fa6cc'], seed: 14, glow: '#bfe6ff' });
  iceMoon.position.set(600, 380, -1400); scene.add(iceMoon);
  const stage = createStage({ deckMat: new THREE.MeshStandardMaterial({ color: '#9ccfff', roughness: 0.06, metalness: 0.25, emissive: '#1d4f86', emissiveIntensity: 0.5 }), trim: '#7ff4ff', led: ['#5ff2ff', '#ffffff', '#9a7bff'], beamColors: ['#9ff4ff', '#ffffff', '#b59bff'], trussColor: '#9fb6cc' });
  scene.add(stage.group);
  const crowd = createCrowd({ species: 'crystal', count: 950, seed: 6, place: (i, R) => fan(R, 6.5, 36, 13, 26, 2.2), face: [0, -4] });
  scene.add(crowd.group);
  const sea = seaOfLights(hf, { colors: ['#7ff4ff', '#ffffff', '#b59bff'], count: 18000 });
  scene.add(sea);
  const snow = createParticles({ type: 'snow', count: 3500, box: [50, 30, 50], center: [0, 10, 8] });
  scene.add(snow);
  rig(scene, PERFORMER, { key: '#f2f8ff', rim: '#7ff4ff', fill: '#9a7bff' });
  return {
    scene, bloom: { strength: 0.6, threshold: 0.95 },
    update(ctx) {
      ups.forEach((f) => f(ctx));
      stage.update(ctx.t, ctx.beat, ctx.energy); crowd.update(ctx.t, ctx.beat, ctx.energy);
      sea.userData.update(ctx.t, ctx.beat, engine.gH); snow.userData.update(ctx.t, engine.gH, ctx.camera.position.clone().add(new THREE.Vector3(0, 0, -10)));
      aur.userData.update(ctx.t);
      perform(star, PERFORMER, ctx);
    },
  };
}

export function nimbus(engine, star) {
  const { scene, ups } = base({ sky: { top: '#2a1b57', horizon: '#ff9466', bottom: '#ffd2a1', sunDir: [0.55, 0.05, -1], sunColor: '#ffb27a', sunSize: 0.02, sunGlow: 0.7, exponent: 0.55 }, fog: ['#f2a688', 120, 1400], hemi: ['#ffd6c0', '#b07a9a', 0.75], env: 0.35 });
  // cloud sea of chunky puffs
  const R = rng(31);
  const puffs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true }), 420);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  for (let i = 0; i < 420; i++) {
    const x = (R() - 0.5) * 2600, z = -R() * 2200 + 500;
    const s = 30 + R() * 90;
    m4.compose(new THREE.Vector3(x, -60 - R() * 30 + (Math.abs(x) > 400 ? R() * 60 : 0), z), new THREE.Quaternion(), new THREE.Vector3(s * 1.6, s * 0.6, s));
    puffs.setMatrixAt(i, m4);
    puffs.setColorAt(i, col.set('#ffe6d6').lerp(new THREE.Color('#ff9fb0'), R() * 0.6));
  }
  scene.add(puffs);
  const below = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshBasicMaterial({ color: '#f7b8a0' }));
  below.rotation.x = -Math.PI / 2; below.position.y = -95; scene.add(below);
  const moon = createPlanet({ radius: 120, type: 'rock', colors: ['#f0d6e8', '#c7a0c0', '#ffffff'], seed: 22, glow: '#ffd0e8' });
  moon.position.set(-520, 420, -1500); scene.add(moon);
  // floating platform under the stage
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(19, 12, 5, 40), new THREE.MeshStandardMaterial({ color: '#3a3550', roughness: 0.35, metalness: 0.6 }));
  disc.position.set(0, -2.5, -5); scene.add(disc);
  const rimRing = new THREE.Mesh(new THREE.TorusGeometry(18.6, 0.25, 8, 80), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7ad9').multiplyScalar(4) }));
  rimRing.rotation.x = Math.PI / 2; rimRing.position.set(0, -0.2, -5); scene.add(rimRing);
  const thr = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialGlowTexture(), color: '#8fd8ff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  thr.scale.set(30, 30, 1); thr.position.set(0, -6, -5); scene.add(thr);
  const stage = createStage({ width: 22, depth: 11, screenH: 10, led: ['#ff7ad9', '#7af0ff', '#ffd28a'], trim: '#7af0ff', beamColors: ['#ffb0e6', '#9ff0ff', '#fff2c8'], beams: 6 });
  scene.add(stage.group);
  const jellies = createCrowd({ species: 'jelly', count: 240, seed: 8, scale: [0.9, 1.8], place: (i, R) => { const p = fan(R, 8, 70, 16, 60); return { ...p, y: 2 + R() * 26 }; }, face: [0, -4] });
  scene.add(jellies.group);
  const sparks = createParticles({ type: 'dust', count: 1200, box: [60, 30, 60], center: [0, 8, 10], color: '#ffe0c8' });
  scene.add(sparks);
  rig(scene, PERFORMER, { key: '#ffe6d2', rim: '#ff8ad8', fill: '#8fd8ff' });
  return {
    scene, bloom: { strength: 0.6, threshold: 0.95 },
    update(ctx) {
      ups.forEach((f) => f(ctx));
      const bob = Math.sin(ctx.t * 0.6) * 0.25;
      stage.group.position.y = bob; disc.position.y = -2.5 + bob; rimRing.position.y = -0.2 + bob; thr.position.y = -6 + bob;
      stage.update(ctx.t, ctx.beat, ctx.energy); jellies.update(ctx.t, ctx.beat, ctx.energy); sparks.userData.update(ctx.t, engine.gH);
      perform(star, PERFORMER.clone().add(new THREE.Vector3(0, bob, 0)), ctx);
    },
  };
}

function crackTexture(seed) {
  const R = rng(seed);
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ff7a1a'; g.lineCap = 'round';
    for (let k = 0; k < 26; k++) {
      let x = R() * w, y = R() * h; g.lineWidth = 1 + R() * 3; g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 12; s++) { x += (R() - 0.5) * 60; y += (R() - 0.5) * 60; g.lineTo(x, y); }
      g.stroke();
    }
  }, { repeat: [2, 2] });
}

export function vulcara(engine, star) {
  const { scene, ups } = base({ sky: { top: '#140404', horizon: '#922c12', bottom: '#1a0503', exponent: 0.7 }, fog: ['#3a0f08', 60, 900], hemi: ['#ff9a6a', '#1a0a08', 0.5], env: 0.2 });
  const hf = hillsFn(17, 130);
  scene.add(createTerrain({
    size: 2400, seg: 140, heightFn: hf,
    colorFn: (x, z, y) => new THREE.Color('#1b1311').lerp(new THREE.Color('#3b2a24'), clamp(y / 60)),
    emissiveFn: (x, z) => { const n = fbm(x * 0.012, z * 0.012, 3, 5); const d = Math.abs(n - 0.5); const near = Math.hypot(x, z) < 45 ? 0 : 1; return new THREE.Color('#ff5a10').multiplyScalar(d < 0.018 ? 2.4 * near : 0); },
  }));
  // volcano with a glowing crater
  const vg = new THREE.ConeGeometry(420, 520, 28, 6, true);
  const vp = vg.attributes.position; const VR = rng(3);
  for (let i = 0; i < vp.count; i++) { const y = vp.getY(i); if (y < 250) { vp.setX(i, vp.getX(i) * (0.9 + VR() * 0.2)); vp.setZ(i, vp.getZ(i) * (0.9 + VR() * 0.2)); } else { vp.setX(i, vp.getX(i) + 30); } }
  vg.computeVertexNormals();
  const volcano = new THREE.Mesh(vg, new THREE.MeshStandardMaterial({ color: '#241816', roughness: 1, flatShading: true }));
  volcano.position.set(380, 200, -1300); volcano.scale.y = 1; scene.add(volcano);
  const crater = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialGlowTexture(), color: '#ff6a1a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  crater.scale.set(420, 300, 1); crater.position.set(380, 470, -1300); scene.add(crater);
  const lavaFlow = new THREE.Mesh(new THREE.CylinderGeometry(6, 40, 480, 6, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff5a10').multiplyScalar(2.5), fog: false }));
  lavaFlow.position.set(330, 230, -1170); lavaFlow.rotation.x = -0.72; scene.add(lavaFlow);
  const erupt = createParticles({ type: 'embers', count: 1600, box: [260, 380, 260], center: [380, 640, -1300], size: 300, vel: [0, 30, 0] });
  scene.add(erupt);
  const crack = crackTexture(9);
  const deck = new THREE.MeshStandardMaterial({ color: '#1e1614', roughness: 0.9, emissive: '#ffffff', emissiveMap: crack, emissiveIntensity: 1.6 });
  const stage = createStage({ deckMat: deck, trim: '#ff6a1a', led: ['#ff3a10', '#ff9a1a', '#ffd84f'], beamColors: ['#ff8a4a', '#ffd08a', '#ff5a3a'], trussColor: '#2a2422' });
  scene.add(stage.group);
  const crowd = createCrowd({ species: 'golem', count: 700, seed: 9, place: (i, R) => fan(R, 7, 36, 13, 26, 2.2), face: [0, -4], ground: () => 0 });
  scene.add(crowd.group);
  const sea = seaOfLights(hf, { colors: ['#ff6a1a', '#ffb02a', '#ff3a3a'], count: 14000 });
  scene.add(sea);
  const embers = createParticles({ type: 'embers', count: 1400, box: [40, 20, 40], center: [0, 6, 6] });
  scene.add(embers);
  const steam = createParticles({ type: 'dust', count: 260, box: [3, 2.5, 3], center: [0, 2.6, -3.8], color: '#ffd9c0', vel: [0, 0.8, 0], size: 26 });
  scene.add(steam);
  rig(scene, PERFORMER, { key: '#ffe2c8', rim: '#ff5a1a', fill: '#ff9a5a', fillI: 0.4 });
  return {
    scene, bloom: { strength: 0.7, threshold: 0.9 },
    update(ctx) {
      ups.forEach((f) => f(ctx));
      crack.offset.set(0, Math.sin(ctx.t * 0.3) * 0.002);
      deck.emissiveIntensity = 1.3 + Math.sin(ctx.t * 2.3) * 0.3;
      stage.update(ctx.t, ctx.beat, ctx.energy); crowd.update(ctx.t, ctx.beat, ctx.energy);
      sea.userData.update(ctx.t, ctx.beat, engine.gH); embers.userData.update(ctx.t, engine.gH); erupt.userData.update(ctx.t, engine.gH); steam.userData.update(ctx.t, engine.gH);
      const hop = ctx.t > 50.0 && ctx.t < 55 ? 1 : 0;
      perform(star, PERFORMER, ctx, { hop });
    },
  };
}

export function trisol(engine, star) {
  const { scene, ups } = base({ sky: { top: '#1d55a8', horizon: '#f2b878', bottom: '#c99460', exponent: 0.5 }, fog: ['#e0a878', 150, 2200], hemi: ['#ffe8c8', '#8a5a3a', 0.6], env: 0.3 });
  const flat = (x, z) => { const d = Math.hypot(x, z * 0.8); return smooth((d - 60) / 160); };
  const hf = (x, z) => (Math.sin(x * 0.018 + Math.sin(z * 0.009) * 2.2) * 9 + fbm(x * 0.006, z * 0.006, 3, 2) * 40) * flat(x, z);
  scene.add(createTerrain({ size: 2400, seg: 140, heightFn: hf, colorFn: (x, z, y) => new THREE.Color('#b9783e').lerp(new THREE.Color('#e3b070'), clamp(0.5 + y / 40)), roughness: 0.95 }));
  const suns = [[-420, 330, -1300, '#fff3c4', 70], [60, 560, -1400, '#ffd2a0', 52], [460, 260, -1200, '#ffd6f0', 40]].map(([x, y, z, c, r]) => { const s = createSun({ radius: r, color: c, halo: 7, intensity: 2.5 }); s.position.set(x, y, z); scene.add(s); return s; });
  const sun = new THREE.DirectionalLight('#fff0d0', 1.6); sun.position.set(-50, 60, -40); scene.add(sun);
  const stage = createStage({ deckColor: '#3a2a20', trim: '#ffcf4a', led: ['#ffcf4a', '#ff8a3a', '#fff6e0'], beamColors: ['#ffe6a0', '#fff6e0', '#ffb36a'], trussColor: '#c9b89a' });
  scene.add(stage.group);
  const crowd = createCrowd({ species: 'tall', count: 650, seed: 11, place: (i, R) => fan(R, 7, 38, 13, 28, 2.2), face: [0, -4], speciesOpts: { palette: ['#8a4a2a', '#b0603a', '#6a3a24', '#c47a4a', '#3a5a8a'] } });
  scene.add(crowd.group);
  const sea = seaOfLights(hf, { colors: ['#ffcf4a', '#ffffff', '#ff8a3a'], count: 12000, size: 6 });
  scene.add(sea);
  const dust = createParticles({ type: 'dust', count: 1200, box: [60, 15, 60], center: [0, 5, 10] });
  scene.add(dust);
  rig(scene, PERFORMER, { key: '#fff4e0', rim: '#ffcf8a', fill: '#ffd8b0', keyI: 2.2 });
  return {
    scene, bloom: { strength: 0.4, threshold: 1.0 }, exposure: 0.9,
    update(ctx) {
      ups.forEach((f) => f(ctx));
      stage.update(ctx.t, ctx.beat, ctx.energy); crowd.update(ctx.t, ctx.beat, ctx.energy); sea.userData.update(ctx.t, ctx.beat, engine.gH); dust.userData.update(ctx.t, engine.gH);
      perform(star, PERFORMER, ctx);
    },
  };
}

export function myco(engine, star) {
  const { scene, ups } = base({ sky: { top: '#010508', horizon: '#0b3236', bottom: '#010604', exponent: 0.6 }, fog: ['#062022', 40, 600], stars: { count: 1400, seed: 5 }, hemi: ['#4affd0', '#02100c', 0.35], env: 0.15 });
  const hf = hillsFn(23, 90);
  scene.add(createTerrain({ size: 2000, seg: 110, heightFn: hf, colorFn: (x, z, y) => new THREE.Color('#0b1d18').lerp(new THREE.Color('#1d3a2a'), clamp(fbm(x * 0.01, z * 0.01, 3, 4))), roughness: 0.95 }));
  const giants = createCrowd({ species: 'mushroom', count: 46, seed: 3, scale: [7, 20], place: (i, R) => { const a = (R() - 0.5) * Math.PI * 1.3; const d = 50 + R() * 200; const x = Math.sin(a) * d, z = -Math.cos(a) * d * 0.6 + 40; return { x: Math.abs(x) < 34 ? Math.sign(x) * (34 + R() * 20) : x, z }; }, face: [0, 0], ground: hf, speciesOpts: { palette: ['#3affc9', '#7aff5a', '#4ab0ff', '#c46bff'] } });
  scene.add(giants.group);
  const crowd = createCrowd({ species: 'mushroom', count: 1300, seed: 13, scale: [0.7, 1.4], place: (i, R) => fan(R, 6.5, 36, 13, 26, 2.2), face: [0, -4] });
  scene.add(crowd.group);
  const spores = createParticles({ type: 'spores', count: 2600, box: [70, 30, 70], center: [0, 10, 10] });
  scene.add(spores);
  const stage = createStage({ deckColor: '#0c1614', trim: '#3affc9', led: ['#2affb0', '#3a7bff', '#c46bff'], beamColors: ['#5affd0', '#7ab0ff', '#d08bff'] });
  scene.add(stage.group);
  rig(scene, PERFORMER, { key: '#e8fff6', rim: '#3affc9', fill: '#8b6bff', keyI: 2.4 });
  return {
    scene, bloom: { strength: 0.6, threshold: 0.95, radius: 0.5 },
    update(ctx) {
      ups.forEach((f) => f(ctx));
      giants.update(ctx.t, ctx.beat * 0.5, 1); crowd.update(ctx.t, ctx.beat, ctx.energy); spores.userData.update(ctx.t, engine.gH); stage.update(ctx.t, ctx.beat, ctx.energy);
      perform(star, PERFORMER, ctx);
    },
  };
}

function createWhale() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: '#2b3e52', roughness: 0.4, metalness: 0.1 });
  const belly = new THREE.MeshStandardMaterial({ color: '#c9d6e0', roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), skin); body.scale.set(2.6, 2.3, 9); g.add(body);
  const bel = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), belly); bel.scale.set(2.2, 1.6, 7.8); bel.position.set(0, -0.8, 0.6); g.add(bel);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(7, 0.35, 2.4), skin); tail.position.set(0, 0.3, -9.4); g.add(tail);
  for (const s of [-1, 1]) { const fin = new THREE.Mesh(new THREE.BoxGeometry(4, 0.25, 1.4), skin); fin.position.set(s * 3, -1, 2.5); fin.rotation.z = s * 0.4; g.add(fin); }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function aquos(engine, star) {
  const { scene, ups } = base({ sky: { top: '#050d22', horizon: '#2e6d94', bottom: '#04101c', exponent: 0.5 }, fog: ['#0a2236', 160, 1800], stars: { count: 2400, seed: 8 }, hemi: ['#8fc8ff', '#05121e', 0.4], env: 0.25 });
  const ocean = createOcean({ color: '#0b3a58', amp: 0.7 }); scene.add(ocean);
  const bigMoon = createPlanet({ radius: 240, type: 'ice', colors: ['#e8f4ff', '#a8c8e8', '#ffffff'], seed: 31, glow: '#cfe8ff' });
  bigMoon.position.set(520, 300, -1500); scene.add(bigMoon);
  const stage = createStage({ deckColor: '#16202a', trim: '#4ff0ff', led: ['#2ad8ff', '#3a6bff', '#7affd8'], beamColors: ['#7ae8ff', '#b0c8ff', '#7affd8'] });
  stage.group.position.y = 0.4; scene.add(stage.group);
  for (const x of [-10, 0, 10]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 14, 12), std('#c9d2da', { roughness: 0.5 })); p.rotation.x = Math.PI / 2; p.position.set(x, 0.2, -6); scene.add(p); }
  const glowSea = createLightSea({ count: 20000, seed: 4, colors: ['#4ff0ff', '#7affd8', '#3a8bff'], size: 7, sway: 0.2, place: (i, R) => { const z = lerp(8, 900, Math.pow(R(), 1.5)); const w = 20 + z * 1.1; return { x: (R() * 2 - 1) * w, z, y: 0.3 }; } });
  scene.add(glowSea);
  const whales = [[-34, -50, 70.6], [40, -80, 73.9], [-12, -45, 76.9], [60, 30, 72.4], [-70, 20, 75.3], [20, -140, 78.4]].map(([x, z, t0], i) => { const w = createWhale(); w.position.set(x, -30, z); w.userData = { x, z, t0, dir: i % 2 ? 1 : -1 }; scene.add(w); return w; });
  rig(scene, PERFORMER.clone().add(new THREE.Vector3(0, 0.4, 0)), { key: '#eaf6ff', rim: '#4ff0ff', fill: '#3a6bff' });
  return {
    scene, bloom: { strength: 0.7, threshold: 0.92 },
    update(ctx) {
      ups.forEach((f) => f(ctx));
      ocean.userData.update(ctx.t); stage.update(ctx.t, ctx.beat, ctx.energy); glowSea.userData.update(ctx.t, ctx.beat, engine.gH);
      for (const w of whales) {
        const { x, z, t0, dir } = w.userData;
        const u = (ctx.t - t0) / 3.8;
        if (u < 0 || u > 1) { w.position.y = -40; continue; }
        w.position.set(x + dir * u * 10, -14 + Math.sin(u * Math.PI) * 26, z);
        w.rotation.set(-(u - 0.5) * 2.4 - 0.2, dir * 0.5, dir * 0.3);
      }
      perform(star, PERFORMER.clone().add(new THREE.Vector3(0, 0.4, 0)), ctx);
    },
  };
}

export function pluto(engine, star) {
  const { scene, ups } = base({ sky: { top: '#000003', horizon: '#0c0b16', bottom: '#000000', exponent: 0.6 }, fog: ['#0a0a12', 200, 1800], stars: { count: 4500, seed: 9, size: 2.4 }, hemi: ['#b8a8a0', '#0a0808', 0.22], env: 0.15 });
  const heart = (x, z) => { const X = (x + 110) / 80, Y = -(z - 60) / 80; const a = X * X + Y * Y - 1; return a * a * a - X * X * Y * Y * Y < 0; };
  const hf = hillsFn(41, 110, 60, 180, 1.6);
  scene.add(createTerrain({ size: 2200, seg: 150, heightFn: (x, z) => (heart(x, z) ? 0 : hf(x, z)), colorFn: (x, z, y) => (heart(x, z) ? new THREE.Color('#d9cec4') : new THREE.Color('#6a4c3e').lerp(new THREE.Color('#a8887a'), clamp(fbm(x * 0.01, z * 0.01, 3, 2) * 1.2))), roughness: 0.85 }));
  const charon = createPlanet({ radius: 300, type: 'rock', colors: ['#6f6a68', '#a9a3a0', '#4a4644', '#8a8482'], seed: 44, glow: null });
  charon.position.set(-560, 360, -1500); scene.add(charon);
  const sun = createSun({ radius: 7, color: '#fff8e8', halo: 14, intensity: 4 }); sun.position.set(400, 300, -1500); scene.add(sun);
  const sunL = new THREE.DirectionalLight('#fff6ea', 0.6); sunL.position.set(400, 300, -1500); scene.add(sunL);
  const stage = createStage({ width: 16, depth: 9, screenH: 8, beams: 4, led: ['#ff8ad8', '#ffffff', '#ffd0e8'], trim: '#ff8ad8', beamColors: ['#ffc0e8', '#ffffff'] });
  scene.add(stage.group);
  const P = new THREE.Vector3(0, 1.8, -2.9);
  const crowd = createCrowd({ species: 'tiny', count: 520, seed: 15, place: (i, R) => fan(R, 4.5, 22, 9, 16, 1.4), face: [0, -3], scale: [0.9, 1.2] });
  scene.add(crowd.group);
  // "WE ♥ U" sign held up in the front row
  const signTex = canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = '#fff6f0'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8336f'; g.font = '800 120px Inter'; g.textBaseline = 'middle';
    g.fillText('WE', 40, h / 2 + 6); g.fillText('U', 380, h / 2 + 6);
    g.save(); g.translate(300, h / 2); g.scale(52, -52); g.beginPath();
    const hs = heartShape(1); const pts = hs.getPoints(30); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.fill(); g.restore();
  });
  const sign = new THREE.Group();
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.8, side: THREE.DoubleSide })); board.position.y = 1.1; sign.add(board);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 5), std('#8a6a4a')); stick.position.y = 0.55; sign.add(stick);
  sign.position.set(1.2, 0, 6.2); scene.add(sign);
  const tinyCheer = createParticles({ type: 'confetti', count: 500, box: [20, 10, 14], center: [0, 6, 8], size: 6 });
  scene.add(tinyCheer);
  rig(scene, P, { key: '#fff2ea', rim: '#ff8ad8', fill: '#a8b8ff' });
  return {
    scene, bloom: { strength: 0.65, threshold: 0.92 },
    update(ctx) {
      ups.forEach((f) => f(ctx));
      stage.update(ctx.t, ctx.beat, ctx.energy); crowd.update(ctx.t, ctx.beat, ctx.energy); tinyCheer.userData.update(ctx.t, engine.gH);
      sign.position.y = Math.abs(Math.sin(ctx.beat * Math.PI)) * 0.12; sign.rotation.z = Math.sin(ctx.beat * Math.PI) * 0.12;
      perform(star, P, ctx);
    },
  };
}

// ---------------------------------------------------------------------------------------------- space
export const MARKETS = [
  ['Zorb Prime', 9.4e9], ['Tri-Sol', 5.6e9], ['Nimbus', 3.1e9], ['Velloria', 2.9e9], ['Aquos', 2.2e9], ['Qorr-7', 2.0e9], ['Halcyon IX', 1.9e9],
  ['Blipp', 1.7e9], ['Neo-Thule', 1.5e9], ['Vulcara', 1.2e9], ['Ozymandia', 1.1e9], ['Gleeb', 9.9e8], ['Glacia', 8.8e8], ['Harmonia', 8.1e8],
  ['Krell Major', 7.5e8], ['Wub', 7.0e8], ['Sylvane', 6.6e8], ['Thrumm', 6.1e8], ['Lumos-4', 5.7e8], ['Dorrigan', 5.2e8], ['Xanthe', 4.9e8],
  ['Peebles', 4.4e8], ['Cindral', 4.0e8], ['Murmur', 3.7e8], ['Ostara', 3.3e8], ['Vexl', 3.0e8], ['Quillon', 2.7e8], ['Saffra', 2.4e8],
  ['Bongo VI', 2.1e8], ['Tessaly', 1.9e8], ['Ignis', 1.6e8], ['Myco', 1], ['Rhoon', 1.3e8], ['Zephyria', 1.1e8], ['Kadoo', 9.4e7],
  ['Lyrae', 8.0e7], ['Nubb', 6.6e7], ['Corvax', 5.5e7], ['Elysia', 4.4e7], ['Fennic', 3.5e7], ['Gorbo', 2.6e7], ['Hush', 1.9e7],
  ['Ivory Reach', 1.3e7], ['Jinx', 9.0e6], ['Kepler Rest', 6.2e6], ['Pluto', 4.8e6], ['Earth', 212],
];

export function space(engine) {
  const { scene, ups } = base({ sky: { top: '#02020a', horizon: '#07071a', bottom: '#02020a' }, stars: { count: 5000, seed: 12, minY: -1 }, hemi: ['#ffffff', '#111122', 0.6], env: 0.2 });
  const galaxy = createGalaxy({ count: 34000, radius: 900 });
  scene.add(galaxy);
  // 47 tour stops along the arms; Earth is #47 at the outer rim
  const R = rng(77);
  const glowTex = radialGlowTexture();
  const stops = [];
  for (let i = 0; i < 47; i++) {
    const earth = i === 46;
    const r = earth ? 860 : 140 + (i / 46) * 650 + R() * 40;
    const a = (i % 3) / 3 * Math.PI * 2 + r * 0.006 + (R() - 0.5) * 0.3;
    const pos = new THREE.Vector3(Math.cos(a) * r, (R() - 0.5) * 30, Math.sin(a) * r);
    const col = earth ? new THREE.Color('#5a7aa8') : new THREE.Color().setHSL(R(), 0.6, 0.65);
    const sph = new THREE.Mesh(new THREE.SphereGeometry(earth ? 7 : 9 + R() * 8, 16, 10), new THREE.MeshStandardMaterial({ color: col, roughness: 0.7, emissive: col, emissiveIntensity: earth ? 0.15 : 0.5 }));
    sph.position.copy(pos); scene.add(sph);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: earth ? '#6a8ab8' : '#ffd88a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: earth ? 0.25 : 0.8 }));
    sp.scale.setScalar(earth ? 30 : 70); sp.position.copy(pos); scene.add(sp);
    stops.push({ pos, sph, sp, earth });
  }
  const routePts = stops.map((s) => s.pos);
  const routeGeo = new THREE.BufferGeometry().setFromPoints(new THREE.CatmullRomCurve3(routePts.slice(0, 46)).getPoints(600));
  const route = new THREE.Line(routeGeo, new THREE.LineBasicMaterial({ color: new THREE.Color('#ffcf6a').multiplyScalar(2.2), transparent: true, opacity: 0.9 }));
  scene.add(route);
  // dashed, faint leg to Earth
  const leg = new THREE.Line(new THREE.BufferGeometry().setFromPoints([routePts[45], routePts[46]]), new THREE.LineDashedMaterial({ color: '#6a7a90', dashSize: 12, gapSize: 10, transparent: true, opacity: 0.6 }));
  leg.computeLineDistances(); scene.add(leg);
  scene.add(new THREE.PointLight('#fff1d6', 3e5, 0, 2));
  return {
    scene, stops, bloom: { strength: 0.9, threshold: 0.7, radius: 0.6 },
    update(ctx) {
      ups.forEach((f) => f(ctx));
      galaxy.userData.update(ctx.t, engine.gH);
      const draw = ctx.routeDraw ?? 1;
      route.geometry.setDrawRange(0, Math.floor(601 * draw));
      const lit = ctx.lit ?? 46;
      stops.forEach((s, i) => { if (!s.earth) { const on = i < lit ? 1 : 0.15; s.sp.material.opacity = 0.85 * on; s.sph.material.emissiveIntensity = 0.6 * on + 0.1; } });
      const pulse = ctx.earthPulse ?? 0;
      stops[46].sp.material.opacity = 0.2 + pulse * 0.6;
      stops[46].sp.material.color.set(pulse > 0.01 ? '#ff4a4a' : '#6a8ab8');
    },
  };
}

export function earthOrbit(engine) {
  const { scene, ups } = base({ sky: { top: '#010108', horizon: '#03030c', bottom: '#010108' }, stars: { count: 5000, seed: 33, minY: -1 }, hemi: ['#ffffff', '#000000', 0.08], env: 0.1 });
  const earth = createPlanet({ radius: 60, type: 'earth', seed: 5, clouds: true, glow: '#6ab4ff', glowSize: 1.08, tilt: 0.4, segments: 64 });
  earth.userData.glow.material.opacity = 0.22;
  scene.add(earth);
  const sun = new THREE.DirectionalLight('#fff6e8', 3.2); sun.position.set(-200, 80, 150); scene.add(sun);
  // signal rings: expand from a point on the surface facing the camera
  const src = new THREE.Vector3(0.25, 0.45, 0.86).normalize().multiplyScalar(60);
  const ringMat = () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a').multiplyScalar(1.6), transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const rings = [0, 1, 2, 3, 4].map(() => { const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 6, 96), ringMat()); m.lookAt(src); m.position.copy(src); scene.add(m); return m; });
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialGlowTexture(), color: '#ffe0a0', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  beacon.position.copy(src.clone().multiplyScalar(1.02)); scene.add(beacon);
  // distant planets that light up when the signal reaches them
  const R = rng(8);
  const far = [];
  for (let i = 0; i < 9; i++) {
    const dir = new THREE.Vector3(R() - 0.5, (R() - 0.5) * 0.8, R() - 0.2).normalize();
    const d = 260 + i * 70;
    const p = createPlanet({ radius: 6 + R() * 10, type: R() < 0.5 ? 'gas' : 'rock', colors: [new THREE.Color().setHSL(R(), 0.5, 0.6).getStyle(), '#ffffff', new THREE.Color().setHSL(R(), 0.6, 0.4).getStyle()], seed: 90 + i, glow: '#ffd27a', glowSize: 3, segments: 24 });
    p.position.copy(src).add(dir.multiplyScalar(d)); scene.add(p); far.push({ p, d });
  }
  return {
    scene, bloom: { strength: 0.6, threshold: 0.9, radius: 0.5 },
    update(ctx) {
      ups.forEach((f) => f(ctx));
      earth.userData.spin(ctx.t, 0.02);
      const lt = ctx.t - 165.0;
      rings.forEach((r, i) => { const u = lt * 0.55 - i * 0.35; const rad = Math.max(0.01, u) * 260; r.scale.setScalar(rad); r.material.opacity = u > 0 ? Math.max(0, 1 - u / 3.5) : 0; });
      beacon.scale.setScalar(7 + Math.sin(ctx.t * 8) * 1.5);
      for (const f of far) { const reach = Math.max(0, lt * 0.55) * 260; const on = clamp((reach - f.d) / 60); f.p.userData.glow.material.opacity = 0.05 + on * 0.85; }
    },
  };
}

// ---------------------------------------------------------------------------------------------- Earth
export function earthLot(engine, star) {
  const { scene, ups } = base({ sky: { top: '#0b1019', horizon: '#3b4656', bottom: '#0e0f12', exponent: 0.7 }, fog: ['#2b333f', 25, 230], hemi: ['#8aa0c0', '#16161a', 0.4], env: 0.3 });
  const lot = City.createParkingLot({ w: 120, d: 100 }); scene.add(lot);
  const mall = City.createStripMall({ width: 70 }); mall.position.set(0, 0, -24); scene.add(mall);
  // distant skyline at night
  const R = rng(5);
  for (let i = 0; i < 26; i++) {
    const b = City.createBuilding({ w: 18 + R() * 20, h: 30 + R() * 110, d: 18 + R() * 20, style: R() < 0.5 ? 'dark' : 'grey', seed: 100 + i, night: true, litChance: 0.25 + R() * 0.3 });
    b.position.x = (i - 13) * 38 + (R() - 0.5) * 12; b.position.z = -170 - R() * 160; scene.add(b);
  }
  // truck stage
  const truck = createFlatbedStage(); truck.group.position.set(0, 0, -8); scene.add(truck.group);
  const P = truck.performer.clone().add(truck.group.position);
  // streetlights
  for (const [x, z, r] of [[-22, -4, 0], [22, -4, Math.PI], [-22, 22, 0], [22, 22, Math.PI], [0, 34, Math.PI / 2]]) {
    const sl = City.createStreetLight({ height: 8, intensity: 60 }); sl.position.set(x, 0, z); sl.rotation.y = r; scene.add(sl);
  }
  // parked cars
  const carCols = ['#8a8f96', '#2a2d33', '#7a1f1f', '#e8e8e8', '#2f4f7a', '#3a3a3a', '#b8a888'];
  for (let i = 0; i < 16; i++) {
    const side = i < 8 ? -1 : 1, k = i % 8;
    const c = City.createCar({ color: carCols[i % carCols.length] }); c.position.set(side * (28 + (k % 2) * 6), 0, -10 + Math.floor(k / 2) * 9); c.rotation.y = side * Math.PI / 2; scene.add(c);
  }
  for (let i = 0; i < 6; i++) { const c = City.createCar({ color: carCols[(i + 3) % carCols.length] }); c.position.set(-14 + i * 5.5, 0, 26 + (i % 2) * 0.6); c.rotation.y = Math.PI; scene.add(c); }
  const sign = City.createPostSign(['EVENT PARKING', '$12'], { w: 2.4, h: 1.5 }); sign.position.set(8.5, 0, 4); sign.rotation.y = 0.35; scene.add(sign);
  for (const [x, z] of [[-34, 30], [34, 30], [-40, -14], [40, -14]]) { const t = City.createTree({ size: 1.6, color: '#1f3a24' }); t.position.set(x, 0, z); scene.add(t); }
  // the crowd: 212 tickets, mostly not here yet, umbrellas and phones
  const crowd = createCrowd({ species: 'human', count: 64, seed: 21, place: (i, R) => { let z = -3 + R() * 13; const w = 4 + (z + 3) * 0.55; let x = (R() * 2 - 1) * w; if (x > 0.2 && x < 3.6 && z > -0.2 && z < 3.6) { x += x > 1.9 ? 2.6 : -3.4; } if (x > 7 && z < 6 && z > 1) x -= 10; return { x, z }; }, face: [0, -8], scale: [0.95, 1.08], shadows: true });
  scene.add(crowd.group);
  // the guy filming vertically (row 2, centre right)
  const filmer = new THREE.Group();
  const jacket = std('#c4561c', { roughness: 0.8 });
  const fTorso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.64, 0.28), jacket); fTorso.position.y = 1.16; filmer.add(fTorso);
  const fLegs = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.86, 0.2), std('#24262c')); fLegs.position.y = 0.43; filmer.add(fLegs);
  const fHead = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), std('#e0aa84')); fHead.scale.y = 1.12; fHead.position.y = 1.62; filmer.add(fHead);
  const fCap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), std('#1f2a44')); fCap.position.y = 1.66; filmer.add(fCap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.14), std('#1f2a44')); brim.position.set(0, 1.67, 0.15); filmer.add(brim);
  for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.5, 0.11), jacket); arm.position.set(s * 0.13, 1.56, 0.22); arm.rotation.set(0.75, 0, s * 0.25); filmer.add(arm); }
  const phone = new THREE.Group(); phone.position.set(0, 1.86, 0.42); phone.rotation.x = 0.1; filmer.add(phone);
  phone.add(new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.17, 0.01), std('#111')));
  const rt = new THREE.WebGLRenderTarget(180, 360);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.076, 0.158), new THREE.MeshBasicMaterial({ map: rt.texture, toneMapped: false }));
  screen.position.z = 0.006; screen.rotation.y = Math.PI; screen.position.z = -0.006; phone.add(screen);
  const rec = new THREE.Mesh(new THREE.CircleGeometry(0.005, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a2a').multiplyScalar(3) }));
  rec.position.set(0.026, 0.066, -0.0075); rec.rotation.y = Math.PI; phone.add(rec);
  filmer.position.set(1.6, 0, 1.4); filmer.rotation.y = Math.PI; scene.add(filmer);
  const phoneCam = new THREE.PerspectiveCamera(40, 0.5, 0.1, 400);
  // stage clip light + rain
  const clip = new THREE.SpotLight('#ffe2b0', 0, 0, 0.42, 0.5, 2);
  const tg = new THREE.Object3D(); tg.position.copy(P).add(new THREE.Vector3(0, 1.0, 0)); scene.add(tg);
  clip.position.set(-1.5, 5.5, -3.2); clip.target = tg; clip.intensity = 2.2 * clip.position.distanceToSquared(tg.position);
  clip.castShadow = true; clip.shadow.mapSize.set(1024, 1024); clip.shadow.bias = -0.0003; scene.add(clip);
  const rimL = new THREE.SpotLight('#9ab8ff', 0, 0, 0.5, 0.6, 2); rimL.position.set(3, 5, -14); rimL.target = tg; rimL.intensity = 1.6 * rimL.position.distanceToSquared(tg.position); scene.add(rimL);
  const fillL = new THREE.PointLight('#ffb070', 8, 12, 2); fillL.position.set(0, 2.5, 2); scene.add(fillL);
  const rain = createRain({ count: 5500, box: [36, 26, 36], speed: 20, opacity: 0.38 });
  scene.add(rain);
  // the signal: beam of light up from the phone + rings in the sky
  const beam = createBeam({ length: 400, radius: 3, color: '#ffe2a0', opacity: 0.0 });
  beam.rotation.x = Math.PI; beam.position.set(1.6, 1.6, 1.0); scene.add(beam);
  const clouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#4a5260', roughness: 1, flatShading: true, transparent: true, opacity: 0.9 }), 160);
  const CR = rng(17); const m4 = new THREE.Matrix4();
  for (let i = 0; i < 160; i++) { const s = 18 + CR() * 40; m4.compose(new THREE.Vector3((CR() - 0.5) * 600, 150 + CR() * 50, (CR() - 0.5) * 600), new THREE.Quaternion(), new THREE.Vector3(s * 1.6, s * 0.5, s)); clouds.setMatrixAt(i, m4); }
  scene.add(clouds);
  return {
    scene, P, bloom: { strength: 0.55, threshold: 0.95 }, exposure: 1.05,
    update(ctx) {
      ups.forEach((f) => f(ctx));
      crowd.update(ctx.t, ctx.beat * 0.25, 0.2);
      rain.userData.update(ctx.t, ctx.camera.position.clone().add(new THREE.Vector3(0, 2, -6)));
      clip.intensity = 2.2 * clip.position.distanceToSquared(tg.position) * (0.92 + 0.08 * Math.sin(ctx.t * 17) * Math.sin(ctx.t * 3.1));
      const sig = clamp((ctx.t - 160.6) / 1.5);
      beam.material.uniforms.uOpacity.value = sig * 0.45;
      beam.scale.set(1 + sig * 2, 1, 1 + sig * 2);
      perform(star, P, ctx, { wet: 1, ...(ctx.earthPerf || {}) });
      if (ctx.t >= 154.9 && ctx.t < 160.2) {
        phone.updateMatrixWorld(true);
        phone.getWorldPosition(phoneCam.position);
        phoneCam.lookAt(P.clone().add(new THREE.Vector3(0, 1.1, 0)));
        const r = engine.renderer;
        r.setRenderTarget(rt); r.render(scene, phoneCam); r.setRenderTarget(null);
      }
    },
  };
}
