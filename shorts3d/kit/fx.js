// Effects kit: gradient skies (background + lighting), chunky 3D text counters, thought bubbles.
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

export const ease = {
  in: (x) => Math.pow(THREE.MathUtils.clamp(x, 0, 1), 3),
  out: (x) => 1 - Math.pow(1 - THREE.MathUtils.clamp(x, 0, 1), 3),
  inOut: (x) => { x = THREE.MathUtils.clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
  back: (x) => { x = THREE.MathUtils.clamp(x, 0, 1); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  expo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * Math.max(0, x))),
};
export const clamp01 = (x) => THREE.MathUtils.clamp(x, 0, 1);
export const lerp = THREE.MathUtils.lerp;
export const ramp = (t, a, b) => clamp01((t - a) / (b - a));

// ------------------------------------------------------------------ sky
const SKY_VS = 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
const SKY_FS = `
  uniform vec3 top, horizon, bottom, sunDir, sunCol; uniform float sunSize, haze;
  varying vec3 vDir;
  void main(){
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 0.55)) : mix(horizon, bottom, pow(-h, 0.4));
    float s = max(dot(d, normalize(sunDir)), 0.0);
    c += sunCol * (pow(s, 800.0 / sunSize) * 6.0 + pow(s, 8.0) * haze);
    gl_FragColor = vec4(c, 1.0);
  }`;

export function skyDome({ top = '#3d8fe0', horizon = '#cfe6f7', bottom = '#9fb7c4', sunDir = [0.4, 0.5, -0.6],
  sunCol = '#fff2d8', sunSize = 1, haze = 0.35, radius = 1500 } = {}) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, vertexShader: SKY_VS, fragmentShader: SKY_FS,
    uniforms: {
      top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) }, bottom: { value: new THREE.Color(bottom) },
      sunDir: { value: new THREE.Vector3(...sunDir) }, sunCol: { value: new THREE.Color(sunCol) }, sunSize: { value: sunSize }, haze: { value: haze },
    },
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), mat);
  m.frustumCulled = false; m.renderOrder = -10;
  return m;
}

// environment map lit by a sky dome (for reflections and ambient on outdoor sets)
export function skyEnvironment(engine, opts) {
  const s = new THREE.Scene();
  s.add(skyDome({ ...opts, radius: 50 }));
  return engine.pmrem.fromScene(s, 0.02).texture;
}

// ------------------------------------------------------------------ 3D text
let FONT = null;
export async function loadFont() {
  if (!FONT) FONT = await new FontLoader().loadAsync(new URL('../node_modules/three/examples/fonts/helvetiker_bold.typeface.json', import.meta.url).href);
  return FONT;
}

// Text made of cached extruded glyphs: setText() is cheap, so numbers can count every frame.
export class Text3D {
  constructor({ size = 1, depth = 0.35, color = '#ff5fa8', bevel = 0.05, emissive = 0.0, align = 'center' } = {}) {
    this.group = new THREE.Group();
    this.size = size; this.depth = depth; this.bevel = bevel; this.align = align;
    this.mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.15, emissive: color, emissiveIntensity: emissive });
    this.cache = new Map(); this.pool = []; this.text = null;
  }
  glyph(ch) {
    if (!this.cache.has(ch)) {
      const g = new TextGeometry(ch, { font: FONT, size: this.size, depth: this.depth, curveSegments: 6, bevelEnabled: true,
        bevelThickness: this.bevel, bevelSize: this.bevel * 0.7, bevelSegments: 3 });
      const adv = ch === ' ' ? this.size * 0.32 : (FONT.data.glyphs[ch]?.ha ?? 600) * this.size / FONT.data.resolution;
      this.cache.set(ch, { g, adv });
    }
    return this.cache.get(ch);
  }
  setText(str) {
    if (str === this.text) return;
    this.text = str;
    const items = [...str].map((ch) => this.glyph(ch));
    const tracking = this.size * 0.04;
    const width = items.reduce((a, it) => a + it.adv + tracking, -tracking);
    let x = this.align === 'center' ? -width / 2 : this.align === 'right' ? -width : 0;
    items.forEach((it, i) => {
      let m = this.pool[i];
      if (!m) { m = new THREE.Mesh(it.g, this.mat); m.castShadow = true; m.receiveShadow = true; this.pool.push(m); this.group.add(m); }
      m.geometry = it.g; m.visible = true; m.position.set(x, 0, -this.depth / 2);
      x += it.adv + tracking;
    });
    for (let i = items.length; i < this.pool.length; i++) this.pool[i].visible = false;
  }
}

export const commas = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// ------------------------------------------------------------------ thought bubbles
const BUBBLE_FS = `
  uniform sampler2D map; uniform float rim, open; varying vec2 vUv;
  float circ(vec2 p, vec2 c, float r){ return length(p - c) - r; }
  float cloud(vec2 p){
    float d = circ(p, vec2(0.0, 0.0), 0.62);
    d = min(d, circ(p, vec2(-0.52, -0.08), 0.42)); d = min(d, circ(p, vec2(0.52, -0.06), 0.43));
    d = min(d, circ(p, vec2(-0.3, 0.42), 0.4)); d = min(d, circ(p, vec2(0.3, 0.44), 0.42));
    d = min(d, circ(p, vec2(-0.26, -0.45), 0.38)); d = min(d, circ(p, vec2(0.28, -0.45), 0.38));
    d = min(d, circ(p, vec2(0.0, 0.55), 0.36));
    return d;
  }
  void main(){
    vec2 p = (vUv - 0.5) * 2.0;
    float d = cloud(p) / max(open, 0.001);
    if (d > 0.0) discard;
    vec3 col = texture2D(map, p * 0.5 + 0.5).rgb;
    float r = smoothstep(-rim - 0.012, -rim, d);
    gl_FragColor = vec4(mix(col, vec3(2.3), r), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export class ThoughtBubble {
  // build(sub) receives an empty scene to fill; returns {camera, update(lt)}.
  constructor(engine, build, { res = 640, size = 0.6 } = {}) {
    this.engine = engine;
    this.rt = new THREE.WebGLRenderTarget(res, res, { samples: 4, type: THREE.HalfFloatType });
    this.rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.sub = new THREE.Scene();
    this.inner = build(this.sub);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: this.rt.texture }, rim: { value: 0.055 }, open: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: BUBBLE_FS, toneMapped: false,
    });
    this.group = new THREE.Group();
    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(size * 2.2, size * 2.2), this.mat);
    this.group.add(this.plane);
    const dotMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(2.3) });
    this.dots = [0.11, 0.075, 0.05].map((r) => { const d = new THREE.Mesh(new THREE.CircleGeometry(size * r, 32), dotMat); this.group.add(d); return d; });
    this.size = size;
  }
  // from: world point (character's head); at: world point for bubble centre; open 0..1; lt: local time for the sub-scene
  update(camera, { from, at, open = 1, lt = 0 }) {
    const vis = open > 0.001;
    this.group.visible = vis;
    if (!vis) return;
    const s = Math.max(0.001, ease.back(open));
    this.plane.position.copy(at);
    this.plane.quaternion.copy(camera.quaternion);
    this.plane.scale.setScalar(s);
    const dir = from.clone().sub(at); const dist = dir.length(); dir.normalize();
    this.dots.forEach((d, i) => {
      const r0 = this.size * 1.05 * s, r1 = Math.max(r0 + 0.01, dist - this.size * 0.12);
      d.position.copy(at).addScaledVector(dir, r0 + (r1 - r0) * (0.2 + 0.32 * i));
      d.quaternion.copy(camera.quaternion);
      d.scale.setScalar(clamp01(open * 3 - (2 - i) * 0.6));
    });
    this.engine.preRender.push(() => {
      if (this.inner.update) this.inner.update(lt);
      const r = this.engine.renderer;
      const prevTarget = r.getRenderTarget();
      r.setRenderTarget(this.rt);
      r.render(this.sub, this.inner.camera);
      r.setRenderTarget(prevTarget);
    });
  }
}
