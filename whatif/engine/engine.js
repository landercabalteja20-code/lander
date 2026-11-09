// Episode engine: owns the renderer, post-processing, overlay and the shot timeline.
// An episode module exports { fps, duration, audio, setup(engine), shots[], scenes{}, drawOverlay(ctx, ov) }.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Overlay, loadFonts } from './overlay.js';

export class Engine {
  constructor({ width = 1080, height = 1920, container = document.body, renderScale = 1 } = {}) {
    this.W = width; this.H = height;
    // 3D is rendered at renderScale and upscaled; captions/HUD are drawn at full resolution
    this.gW = Math.round(width * renderScale); this.gH = Math.round(height * renderScale);
    this.container = container;
    this.sceneCache = new Map();
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
    r.domElement.id = 'gl';
    this.container.appendChild(r.domElement);

    const rt = new THREE.WebGLRenderTarget(this.gW, this.gH, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(r, rt);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(this.gW, this.gH), 0.6, 0.55, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    const pmrem = new THREE.PMREMGenerator(r);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    this.camera = new THREE.PerspectiveCamera(40, this.W / this.H, 0.05, 6000);

    await loadFonts();
    this.overlay = new Overlay(this.W, this.H);
    this.overlay.canvas.id = 'overlay';
    this.container.appendChild(this.overlay.canvas);

    this.composite = document.createElement('canvas');
    this.composite.width = this.W; this.composite.height = this.H;
    this.cg = this.composite.getContext('2d');
    this.cg.imageSmoothingEnabled = true; this.cg.imageSmoothingQuality = 'high';

    if (episode.setup) await episode.setup(this);
  }

  getScene(name) {
    if (!this.sceneCache.has(name)) {
      const build = this.ep.scenes[name];
      if (!build) throw new Error('unknown scene ' + name);
      const s = build(this);
      if (!s.scene.environment && s.useEnv !== false) { s.scene.environment = this.envMap; if (s.scene.environmentIntensity === 1) s.scene.environmentIntensity = s.envIntensity ?? 0.3; }
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
    const ep = this.ep;
    const shot = this.shotAt(t);
    const ctx = ep.context ? ep.context(t) : { t };
    ctx.t = t; ctx.lt = t - shot.t0; ctx.shot = shot; ctx.dur = shot.t1 - shot.t0; ctx.u = ctx.lt / ctx.dur;
    ctx.camera = this.camera; ctx.engine = this;

    if (shot.scene) {
      const S = this.getScene(shot.scene);
      ctx.scene = S.scene;
      this.camera.fov = 40; this.camera.near = 0.05; this.camera.far = 6000; this.camera.up.set(0, 1, 0);
      this.camera.aspect = this.W / this.H;
      this.camera.rotation.set(0, 0, 0);
      if (shot.camera) shot.camera(this.camera, ctx.lt, ctx);
      this.camera.updateProjectionMatrix();
      this.camera.updateMatrixWorld(true);
      if (shot.update) shot.update(ctx);
      if (S.update) S.update(ctx, shot);
      const b = { strength: 0.5, radius: 0.45, threshold: 0.95, ...(S.bloom || {}), ...(shot.bloom || {}) };
      this.bloom.strength = b.strength; this.bloom.radius = b.radius; this.bloom.threshold = b.threshold;
      this.renderer.toneMappingExposure = shot.exposure ?? S.exposure ?? 1.0;
      this.renderPass.scene = S.scene;
      this.renderPass.camera = this.camera;
      this.composer.render();
    } else {
      this.renderer.setClearColor(0x000000, 1);
      this.renderer.clear();
    }

    this.overlay.clear();
    if (ep.drawOverlay) ep.drawOverlay(ctx, this.overlay);
  }

  // composite WebGL + overlay into one JPEG data URL
  frame(t, quality = 0.93) {
    this.renderAt(t);
    this.cg.fillStyle = '#000'; this.cg.fillRect(0, 0, this.W, this.H);
    this.cg.drawImage(this.renderer.domElement, 0, 0, this.W, this.H);
    this.cg.drawImage(this.overlay.canvas, 0, 0);
    return this.composite.toDataURL('image/jpeg', quality);
  }
}
