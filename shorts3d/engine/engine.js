// Episode engine: renderer, post-processing (depth of field, bloom, film grade) and the shot timeline.
// An episode module exports { fps, duration, setup(engine), scenes: {name: build(engine) -> {scene, update?}},
// shots: [{t0, t1, scene, camera(cam, lt, ctx), update(ctx), dof: {focus, aperture, maxblur}, exposure}] }.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Film grade applied after tone mapping: lift/gamma tint, gentle S-curve, vignette, grain.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, time: { value: 0 }, vignette: { value: 0.32 }, grain: { value: 0.035 },
    warmth: { value: 0.03 }, contrast: { value: 1.06 }, saturation: { value: 1.08 }, flash: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, vignette, grain, warmth, contrast, saturation, flash;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time * 37.0) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, saturation);
      c = (c - 0.5) * contrast + 0.5;
      c += vec3(warmth, warmth * 0.35, -warmth * 0.6) * (1.0 - l);
      vec2 q = vUv - 0.5; q.x *= 0.62;
      c *= 1.0 - vignette * smoothstep(0.18, 0.62, length(q));
      c += (h(vUv * 1000.0) - 0.5) * grain;
      c = mix(c, vec3(1.0), flash);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export class Engine {
  constructor({ width = 1080, height = 1920, container = document.body, renderScale = 1 } = {}) {
    this.W = width; this.H = height;
    this.gW = Math.round(width * renderScale); this.gH = Math.round(height * renderScale);
    this.container = container;
    this.sceneCache = new Map();
    this.preRender = [];  // callbacks run before the main pass (thought bubbles render their sub-scenes here)
  }

  async init(episode) {
    this.ep = episode;
    const r = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    r.setPixelRatio(1);
    r.setSize(this.gW, this.gH, false);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = r;
    this.container.appendChild(r.domElement);

    const rt = new THREE.WebGLRenderTarget(this.gW, this.gH, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(r, rt);
    this.camera = new THREE.PerspectiveCamera(35, this.W / this.H, 0.02, 4000);
    this.renderPass = new RenderPass(new THREE.Scene(), this.camera);
    this.composer.addPass(this.renderPass);
    this.bokeh = new BokehPass(new THREE.Scene(), this.camera, { focus: 1.0, aperture: 0.002, maxblur: 0.008 });
    this.composer.addPass(this.bokeh);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(this.gW, this.gH), 0.35, 0.5, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);

    const pmrem = new THREE.PMREMGenerator(r);
    this.roomEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.pmrem = pmrem;

    this.out = document.createElement('canvas');
    this.out.width = this.W; this.out.height = this.H;
    this.og = this.out.getContext('2d');
    this.og.imageSmoothingEnabled = true; this.og.imageSmoothingQuality = 'high';

    if (episode.setup) await episode.setup(this);
  }

  getScene(name) {
    if (!this.sceneCache.has(name)) {
      const build = this.ep.scenes[name];
      if (!build) throw new Error('unknown scene ' + name);
      const s = build(this);
      if (!s.scene.environment) s.scene.environment = this.roomEnv;
      this.sceneCache.set(name, s);
    }
    return this.sceneCache.get(name);
  }

  shotAt(t) {
    const shots = this.ep.shots;
    for (let i = 0; i < shots.length; i++) if (t >= shots[i].t0 && t < shots[i].t1) return shots[i];
    return shots[shots.length - 1];
  }

  renderAt(t) {
    const shot = this.shotAt(t);
    const ctx = { t, lt: t - shot.t0, shot, dur: shot.t1 - shot.t0, camera: this.camera, engine: this };
    ctx.u = ctx.lt / ctx.dur;
    const S = this.getScene(shot.scene);
    ctx.scene = S.scene; ctx.S = S;
    const cam = this.camera;
    cam.fov = 35; cam.near = 0.02; cam.far = 4000; cam.up.set(0, 1, 0); cam.aspect = this.W / this.H;
    cam.rotation.set(0, 0, 0);
    this.preRender.length = 0;
    if (S.update) S.update(ctx);           // scene defaults first (characters idle, ambience)
    if (shot.update) shot.update(ctx);     // then the shot's acting
    if (shot.camera) shot.camera(cam, ctx.lt, ctx);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    if (S.post) S.post(ctx);               // camera-dependent work (billboards, thought bubbles)
    if (shot.post) shot.post(ctx);
    for (const f of this.preRender) f(ctx);

    const d = { focus: 1.0, aperture: 0.0, maxblur: 0.009, ...(S.dof || {}), ...(shot.dof || {}) };
    if (typeof d.focus === 'function') d.focus = d.focus(ctx);
    const u = this.bokeh.uniforms;
    u.focus.value = d.focus; u.aperture.value = d.aperture; u.maxblur.value = d.maxblur;
    u.nearClip.value = cam.near; u.farClip.value = cam.far; u.aspect.value = cam.aspect;
    this.bokeh.enabled = d.aperture > 0;
    this.bokeh.scene = S.scene; this.bokeh.camera = cam;
    const b = { strength: 0.3, radius: 0.5, threshold: 0.92, ...(S.bloom || {}), ...(shot.bloom || {}) };
    this.bloom.strength = b.strength; this.bloom.radius = b.radius; this.bloom.threshold = b.threshold;
    const g = { vignette: 0.34, grain: 0.024, warmth: 0.03, contrast: 1.12, saturation: 1.16, flash: 0, ...(S.grade || {}), ...(shot.grade || {}) };
    for (const k in g) if (this.grade.uniforms[k]) this.grade.uniforms[k].value = typeof g[k] === 'function' ? g[k](ctx) : g[k];
    this.grade.uniforms.time.value = (t * 30) % 97;
    this.renderer.toneMappingExposure = shot.exposure ?? S.exposure ?? 1.0;
    this.renderPass.scene = S.scene; this.renderPass.camera = cam;
    this.composer.render();
    return ctx;
  }

  frame(t, quality = 0.92) {
    this.renderAt(t);
    this.og.drawImage(this.renderer.domElement, 0, 0, this.W, this.H);
    return this.out.toDataURL('image/jpeg', quality);
  }
}
