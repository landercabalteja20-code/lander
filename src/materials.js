import * as THREE from 'three';

export function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function canvasTexture(w, h, draw, { repeat = null, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 4;
  return t;
}

// Sparkle dots used as emissive maps: sequins, glitter floors, crystals.
let _glitter = null;
export function glitterTexture() {
  if (_glitter) return _glitter;
  const r = seeded(11);
  _glitter = canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 520; i++) {
      const x = r() * w, y = r() * h, s = r();
      c.fillStyle = `rgba(255,255,255,${0.25 + 0.75 * s})`;
      c.fillRect(x, y, s > 0.9 ? 2 : 1, s > 0.9 ? 2 : 1);
      if (s > 0.97) { c.fillRect(x - 3, y, 7, 1); c.fillRect(x, y - 3, 1, 7); }
    }
  }, { repeat: [3, 3] });
  return _glitter;
}

const matCache = new Map();
// Material presets: satin, sequin, chrome, gloss, skin, matte, pearl, holo, emissive
export function mat(kind, color, extra = {}) {
  const key = kind + color + JSON.stringify(extra);
  if (matCache.has(key) && !extra.unique) return matCache.get(key);
  const col = new THREE.Color(color);
  let m;
  switch (kind) {
    case 'skin':
      m = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color('#ffd9c7'), sheenRoughness: 0.5, clearcoat: 0.12, clearcoatRoughness: 0.6, emissive: col.clone().multiplyScalar(0.12) });
      break;
    case 'satin':
      m = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.36, metalness: 0.05, sheen: 0.7, sheenColor: new THREE.Color(extra.sheen || '#ffffff').lerp(col, 0.5), sheenRoughness: 0.35, clearcoat: 0.35, clearcoatRoughness: 0.25, emissive: col.clone().multiplyScalar(0.05) });
      break;
    case 'sequin': {
      const g = glitterTexture();
      m = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.25, metalness: extra.metal ?? 0.6, clearcoat: 0.8, clearcoatRoughness: 0.1, emissive: col.clone().lerp(new THREE.Color('#ffffff'), 0.4), emissiveMap: g, emissiveIntensity: extra.glow ?? 1.4 });
      break;
    }
    case 'chrome':
      m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.12, metalness: 1.0, envMapIntensity: 1.4 });
      break;
    case 'gloss':
      m = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.22, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.08, emissive: col.clone().multiplyScalar(0.05) });
      break;
    case 'pearl':
      m = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.2, metalness: 0.1, clearcoat: 1, iridescence: 0.7, iridescenceIOR: 1.4, iridescenceThicknessRange: [200, 500], sheen: 1, sheenColor: new THREE.Color('#ffe7f0') });
      break;
    case 'holo':
      m = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.15, metalness: 0.6, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [100, 900], clearcoat: 1, emissive: col.clone().multiplyScalar(0.15), transparent: extra.opacity !== undefined, opacity: extra.opacity ?? 1 });
      break;
    case 'hair':
      m = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.38, metalness: 0.05, sheen: 1, sheenColor: new THREE.Color(extra.sheen || '#ffffff'), sheenRoughness: 0.35, clearcoat: 0.45, clearcoatRoughness: 0.3, emissive: col.clone().multiplyScalar(0.08) });
      break;
    case 'emissive':
      m = new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(extra.intensity ?? 2), toneMapped: false, transparent: extra.opacity !== undefined, opacity: extra.opacity ?? 1, side: extra.side ?? THREE.FrontSide, depthWrite: extra.depthWrite ?? true, blending: extra.additive ? THREE.AdditiveBlending : THREE.NormalBlending });
      break;
    case 'matte':
    default:
      m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.75, metalness: 0.0 });
  }
  if (extra.side) m.side = extra.side;
  if (!extra.unique) matCache.set(key, m);
  return m;
}

// Gradient environment for glossy candy reflections.
export function makeEnvironment(renderer) {
  const scene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(50, 32, 16);
  const cols = [];
  const top = new THREE.Color('#fff0fb'), mid = new THREE.Color('#d18cff'), bot = new THREE.Color('#2a1446');
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 50;
    const c = y > 0 ? mid.clone().lerp(top, y) : mid.clone().lerp(bot, -y);
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = (color, x, y, z, w, h) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(4), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); scene.add(m);
  };
  panel('#ffffff', 0, 30, 20, 30, 10);
  panel('#ff7ac8', -35, 10, 10, 18, 24);
  panel('#7fd4ff', 35, 12, -5, 16, 22);
  panel('#ffd66b', 10, 8, -38, 26, 10);
  panel('#b07bff', -15, -5, -35, 20, 8);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(scene, 0.02);
  pm.dispose();
  return rt.texture;
}

// Soft round sprite for particles.
let _dot = null;
export function dotTexture() {
  if (_dot) return _dot;
  _dot = canvasTexture(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  });
  return _dot;
}
let _star = null;
export function starTexture() {
  if (_star) return _star;
  _star = canvasTexture(128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.12, 'rgba(255,255,255,0.7)'); g.addColorStop(0.4, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    c.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [w, h] of [[128, 3], [3, 128]]) { const lg = c.createLinearGradient(0, 0, w > h ? 128 : 0, w > h ? 0 : 128); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = lg; c.fillRect(64 - w / 2, 64 - h / 2, w, h); }
  });
  return _star;
}
let _heart = null;
export function heartTexture() {
  if (_heart) return _heart;
  _heart = canvasTexture(64, 64, (c) => {
    c.fillStyle = '#fff';
    c.shadowColor = '#fff'; c.shadowBlur = 8;
    c.beginPath(); c.moveTo(32, 52);
    c.bezierCurveTo(4, 34, 10, 10, 32, 22); c.bezierCurveTo(54, 10, 60, 34, 32, 52); c.fill();
  });
  return _heart;
}

// Star shape geometry (used for charms, parol lanterns, decorations).
export function starShape(points = 5, outer = 1, inner = 0.45) {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}
export function starGeometry(size, depth = 0.3, points = 5, inner = 0.45) {
  const g = new THREE.ExtrudeGeometry(starShape(points, size, size * inner), { depth: size * depth, bevelEnabled: true, bevelThickness: size * 0.08, bevelSize: size * 0.06, bevelSegments: 2 });
  g.center();
  return g;
}
