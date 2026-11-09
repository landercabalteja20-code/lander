// WHAT IF P-POP WAS BIGGER THAN K-POP? — real-time 3D animated musical (180 s).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { MEMBERS } from './members.js';
import { BEAT, DURATION, sectionAt, timeRate } from './timeline.js';
import { Character } from './characters.js';
import { MOVES, neutralPose, blendPose, direct } from './choreo.js';
import { faceAt, mouthAt } from './lipsync.js';
import { Stadium } from './stadium.js';
import { City } from './city.js';
import { Backstage } from './backstage.js';
import { CameraDirector } from './camera.js';
import { makeEnvironment, glitterTexture } from './materials.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';

const params = new URLSearchParams(location.search);
const QUALITY = {
  low: { crowd: 20000, dpr: 1, bloom: 0.5, face: 384 },
  medium: { crowd: 50000, dpr: 1.25, bloom: 0.75, face: 512 },
  high: { crowd: 100000, dpr: 1.75, bloom: 1, face: 512 },
};
function pickQuality() {
  const q = params.get('q');
  if (q && QUALITY[q]) return q;
  try { const s = localStorage.getItem('hiraya-quality'); if (s && QUALITY[s]) return s; } catch (e) { /* storage blocked */ }
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'low' : 'high';
}
const qName = pickQuality();
const Q = QUALITY[qName];

// fx clock: integral of the slow-motion time rate, so particles slow down in the bridge
const FX_STEP = 0.05;
const fxTable = new Float32Array(Math.ceil(DURATION / FX_STEP) + 2);
for (let i = 1; i < fxTable.length; i++) fxTable[i] = fxTable[i - 1] + timeRate((i - 0.5) * FX_STEP) * FX_STEP;
function fxClock(t) {
  const x = Math.max(0, Math.min(DURATION, t)) / FX_STEP;
  const i = Math.floor(x), f = x - i;
  return fxTable[i] + (fxTable[Math.min(i + 1, fxTable.length - 1)] - fxTable[i]) * f;
}

// make sure canvas textures (billboards, screens, neon) use the real fonts
if (document.fonts && document.fonts.load) {
  const fams = ['400 64px "Bagel Fat One"', '700 32px "DM Sans"', '600 32px "DM Sans"', '400 64px "Pacifico"'];
  await Promise.race([Promise.all(fams.map((f) => document.fonts.load(f).catch(() => null))), new Promise((r) => setTimeout(r, 3000))]);
}

// ---------- renderer ----------
const frame = document.getElementById('frame');
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('capture') });
renderer.setPixelRatio(params.has('pr') ? parseFloat(params.get('pr')) : Math.min(window.devicePixelRatio || 1, Q.dpr));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.environment = makeEnvironment(renderer);
const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.05, 3000);
camera.layers.enable(1);

const city = new City();
const backstage = new Backstage();
const stadium = new Stadium({ crowd: Q.crowd, fxClock });
scene.add(city.group, backstage.group, stadium.group);
const SETS = { city: city.group, backstage: backstage.group, stadium: stadium.group };
const FOG = { city: new THREE.FogExp2('#4b2470', 0.0011), backstage: null, stadium: new THREE.FogExp2('#160827', 0.0045) };
const BG = { city: null, backstage: new THREE.Color('#2a0f2a'), stadium: new THREE.Color('#080312') };

const chars = {};
for (const m of MEMBERS) { const c = new Character(m, { faceSize: Q.face }); chars[m.id] = c; scene.add(c.root); }
backstage.attachProps(chars);

const director = new CameraDirector(camera);

// ---------- post ----------
const rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(16, 16), 0.6 * Q.bloom, 0.5, 1.05);
composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.85 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime,uVig; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){ vec2 d=vUv-.5; float r=dot(d,d);
      vec3 c; c.r=texture2D(tDiffuse,vUv+d*0.006).r; c.g=texture2D(tDiffuse,vUv).g; c.b=texture2D(tDiffuse,vUv-d*0.006).b;
      c*=1.-r*uVig; c=mix(c,c*vec3(1.04,0.98,1.05),0.6);
      c+=(h(vUv*vec2(1733.,977.)+fract(uTime))-.5)*0.018;
      gl_FragColor=vec4(c,1.); }`,
});
composer.addPass(grade);
composer.addPass(new OutputPass());

function resize() {
  const w = frame.clientWidth, h = frame.clientHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(frame);
resize();

// ---------- per-member animation state ----------
const anim = {};
for (const m of MEMBERS) anim[m.id] = { cur: null, prev: null, switchT: 0, prevPose: neutralPose(), gesture: 0 };
const tmpPose = neutralPose(), tmpPose2 = neutralPose();
const _v = new THREE.Vector3();

function poseFor(id, move, b, t) {
  const p = neutralPose();
  const P = chars[id].m.personality;
  const g = anim[id].gesture;
  MOVES[move](b, P, p, id, g);
  return p;
}

function updateCharacters(t, dt, setName) {
  const b = t / BEAT;
  for (const m of MEMBERS) {
    const id = m.id, ch = chars[id], A = anim[id];
    const d = direct(id, t);
    const vis = d.visible && d.set === setName;
    ch.root.visible = vis;
    if (!vis) continue;
    ch.base.x = d.x; ch.base.z = d.z; ch.base.rot = d.rot; ch.base.y = d.y;
    if (A.cur !== d.move || t < A.switchT) { A.prev = A.cur; A.cur = d.move; A.switchT = t; }
    const mo = mouthAt(id, t);
    A.gesture += ((d.talk ? mo.open : 0) - A.gesture) * Math.min(1, dt * 10);
    let pose = poseFor(id, d.move, b, t);
    const k = Math.min(1, (t - A.switchT) / 0.4);
    if (A.prev && k < 1 && MOVES[A.prev]) pose = blendPose(poseFor(id, A.prev, b, t), pose, k * k * (3 - 2 * k), tmpPose);
    ch.applyPose(pose);
    ch.mic.visible = d.mic;
    ch.micToMouth(d.mic ? d.sing : 0);
    A.sing = d.sing;
  }
}

function updateFaces(t, dt) {
  const camPos = camera.position;
  for (const m of MEMBERS) {
    const ch = chars[m.id];
    if (!ch.root.visible) continue;
    const loc = ch.j.head.worldToLocal(_v.copy(camPos));
    let look = { x: 0, y: 0 };
    if (loc.z > 0.3) look = { x: THREE.MathUtils.clamp(loc.x / loc.z * 1.4, -0.9, 0.9), y: THREE.MathUtils.clamp(-loc.y / loc.z * 1.2, -0.8, 0.8) };
    ch.updateFace(faceAt(m, t, look));
    ch.updatePhysics(dt * timeRate(t));
  }
}

// camera context
const camCtx = {
  head: (id) => chars[id].j.head.getWorldPosition(new THREE.Vector3()),
  rot: (id) => chars[id].root.rotation.y,
  center: () => new THREE.Vector3(0, 1.4, 0.3),
  jeep: (() => {
    let pick = null;
    return (t) => {
      if (!pick) {
        pick = city.jeeps.find((q) => { if (!q.alongZ || q.lane.dir > 0) return false; const s0 = (12 * q.speed + q.off) % 1000, s1 = (16 * q.speed + q.off) % 1000; return s1 > s0 && 200 - s0 < 120 && 200 - s0 > -150; }) || city.jeeps[0];
      }
      return pick.j.position;
    };
  })(),
};

let frameNo = 0;
let lastSet = null;
function renderAt(t, dt, draw = true) {
  const sec = sectionAt(t);
  const setName = sec.set;
  if (setName !== lastSet) {
    for (const [k, g] of Object.entries(SETS)) g.visible = k === setName;
    scene.fog = FOG[setName]; scene.background = BG[setName];
    camera.far = setName === 'city' ? 3000 : setName === 'stadium' ? 900 : 60;
    camera.near = setName === 'city' ? 0.5 : 0.05;
    camera.updateProjectionMatrix();
    lastSet = setName;
  }
  updateCharacters(t, dt, setName);
  director.update(t, camCtx);
  updateFaces(t, dt);
  if (setName === 'city') city.update(t);
  if (setName === 'backstage') backstage.update(t, true);
  else backstage.update(t, false);
  const pointScale = renderer.domElement.height / (2 * Math.tan((camera.fov * Math.PI) / 360));
  if (!draw) return;
  if (setName === 'stadium') {
    stadium.update(t, dt, { pointScale });
    const singing = MEMBERS.filter((m) => (anim[m.id].sing || 0) > 0.5).map((m) => m.id);
    const focus = singing.length === 1 ? singing : [];
    if (frameNo % 2 === 0) stadium.renderScreens(renderer, scene, chars, t, focus);
    if (frameNo % 4 === 0) { stadium.drawOverlay(t, focus); stadium.drawGfx(t, focus, sec.id); }
  }
  glitterTexture().offset.set((t * 0.013) % 1, (t * 0.007) % 1);
  grade.uniforms.uTime.value = t;
  composer.render();
  ui.update(t);
  frameNo++;
}

// ---------- transport ----------
if (params.has('capture')) document.body.classList.add('capture');
const ui = new UI(document.getElementById('frame'), { capture: params.has('capture') });
const engine = new AudioEngine();
const PREVIEW = [80, 96];
const state = { mode: 'intro', t: 0, wall: 0 };
const startT = params.has('t') ? parseFloat(params.get('t')) : null;

function currentTime() {
  if (state.mode === 'playing') {
    if (engine.ctx && engine.playing) return engine.time;
    return Math.min(DURATION, state.t + (performance.now() / 1000 - state.wall));
  }
  if (state.mode === 'intro') return PREVIEW[0] + ((performance.now() / 1000) % (PREVIEW[1] - PREVIEW[0]));
  return state.t;
}

async function play(from) {
  document.body.classList.remove('intro');
  document.body.classList.add('playing');
  state.t = from ?? (state.mode === 'intro' || state.t >= DURATION ? 0 : state.t);
  state.mode = 'playing';
  state.wall = performance.now() / 1000;
  try { await engine.play(state.t); engine.setVolume(muted ? 0 : 1); } catch (e) { console.warn('audio unavailable', e); }
  setPlayIcon();
}
function pause() {
  if (state.mode !== 'playing') return;
  state.t = currentTime();
  state.mode = 'paused';
  engine.pause();
  setPlayIcon();
}
function seek(t) {
  t = Math.max(0, Math.min(DURATION, t));
  if (state.mode === 'playing') { state.t = t; state.wall = performance.now() / 1000; engine.seek(t); }
  else { state.t = t; if (state.mode === 'intro') { state.mode = 'paused'; document.body.classList.remove('intro'); } }
}
engine.onended = () => { state.t = DURATION; state.mode = 'paused'; setPlayIcon(); document.body.classList.add('ended'); };

let muted = false;
const playBtn = document.getElementById('play');
function setPlayIcon() {
  const p = state.mode === 'playing';
  playBtn.setAttribute('aria-label', p ? 'Pause' : 'Play'); playBtn.dataset.state = p ? 'pause' : 'play';
  document.body.classList.toggle('playing', p);
}
document.getElementById('start').addEventListener('click', () => play(startT ?? 0));
playBtn.addEventListener('click', () => (state.mode === 'playing' ? pause() : play()));
document.getElementById('replay').addEventListener('click', () => { document.body.classList.remove('ended'); play(0); });
const scrub = document.getElementById('scrub');
scrub.addEventListener('input', () => { ui.scrubbing = true; seek((scrub.value / 1000) * DURATION); });
scrub.addEventListener('change', () => { ui.scrubbing = false; });
document.getElementById('cc').addEventListener('click', (e) => { ui.captionsOn = !ui.captionsOn; e.currentTarget.setAttribute('aria-pressed', String(ui.captionsOn)); });
document.getElementById('mute').addEventListener('click', (e) => { muted = !muted; engine.setVolume(muted ? 0 : 1); e.currentTarget.setAttribute('aria-pressed', String(muted)); });
document.getElementById('fs').addEventListener('click', () => { const el = document.getElementById('player'); if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen?.().catch(() => {}); });
const qSel = document.getElementById('quality');
qSel.value = qName;
qSel.addEventListener('change', () => {
  try { localStorage.setItem('hiraya-quality', qSel.value); } catch (e) { /* storage blocked: URL param still works */ }
  if (params.has('q')) { const u = new URL(location.href); u.searchParams.set('q', qSel.value); location.href = u.toString(); } else location.reload();
});
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
  if (e.code === 'Space') { e.preventDefault(); state.mode === 'playing' ? pause() : play(); }
  if (e.code === 'ArrowRight') seek(currentTime() + 5);
  if (e.code === 'ArrowLeft') seek(currentTime() - 5);
  if (e.key === 'c') document.getElementById('cc').click();
  if (e.key === 'f') document.getElementById('fs').click();
  if (e.key === 'm') document.getElementById('mute').click();
});
let idleTimer = 0;
document.getElementById('player').addEventListener('pointermove', () => { document.body.classList.add('active'); clearTimeout(idleTimer); idleTimer = setTimeout(() => document.body.classList.remove('active'), 2600); });

if (startT !== null && !params.has('autoplay')) { state.mode = 'paused'; state.t = startT; document.body.classList.remove('intro'); }

let lastWall = performance.now();
function loop() {
  const now = performance.now();
  const dt = Math.min(0.1, (now - lastWall) / 1000);
  lastWall = now;
  const t = currentTime();
  renderAt(t, state.mode === 'paused' ? 0 : dt);
  if (!params.has('capture')) requestAnimationFrame(loop);
}
document.fonts && document.fonts.ready.then(() => { city.drawPortraits(0, true); });
if (!params.has('capture')) requestAnimationFrame(loop);
document.body.classList.add('ready');

// testing / capture hooks
window.__film = {
  renderAt: (t, dt = 1 / 24) => renderAt(t, dt),
  // advance animation + hair physics without drawing (video export warm-up)
  step: (t, dt = 1 / 24) => renderAt(t, dt, false),
  // warm up physics so hair settles, then draw t
  frame: (t, fps = 24) => { for (let k = 8; k >= 1; k--) renderAt(Math.max(0, t - k / fps), 1 / fps); renderAt(t, 1 / fps); },
  play, pause, seek, engine, AudioEngine, chars, camera, renderer, scene, state,
  info: () => renderer.info,
  composer, bloom, rt,
};
