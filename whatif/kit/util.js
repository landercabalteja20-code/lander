// Shared helpers: seeded randomness, noise, easing, procedural geometry and canvas textures.
import * as THREE from 'three';

export function rng(seed = 1) {
  let a = seed >>> 0;
  const f = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + (hi - lo) * f();
  f.int = (lo, hi) => Math.floor(f.range(lo, hi + 1));
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.sign = () => (f() < 0.5 ? -1 : 1);
  return f;
}

// ---------- math ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const smoother = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = (t) => Math.pow(clamp(t), 3);
export const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const range01 = (x, a, b) => clamp((x - a) / (b - a));

// value noise
function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function noise2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(x, y, oct = 4, seed = 0) {
  let s = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += amp * noise2(x * f, y * f, seed + i * 17); n += amp; amp *= 0.5; f *= 2; }
  return s / n;
}

// ---------- canvas textures ----------
export function canvasTexture(w, h, draw, { srgb = true, repeat = null, mipmaps = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat[0], repeat[1]); }
  tex.generateMipmaps = mipmaps;
  tex.anisotropy = 4;
  tex.userData.canvas = c;
  return tex;
}

export function radialGlowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128) {
  return canvasTexture(size, size, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, inner); gr.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.55)'));
    gr.addColorStop(1, outer);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}

// text drawn into a texture (signs, banners, screens)
export function textTexture(lines, { w = 1024, h = 256, bg = '#111', fg = '#fff', font = '700 120px Inter', align = 'center', pad = 30, border = null, lineGap = 1.1 } = {}) {
  return canvasTexture(w, h, (g) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
    if (border) { g.strokeStyle = border; g.lineWidth = 12; g.strokeRect(8, 8, w - 16, h - 16); }
    g.fillStyle = fg; g.font = font; g.textAlign = align; g.textBaseline = 'middle';
    const arr = Array.isArray(lines) ? lines : [lines];
    const size = parseInt(font.match(/(\d+)px/)[1], 10);
    const total = arr.length * size * lineGap;
    arr.forEach((ln, i) => {
      const y = h / 2 - total / 2 + size * lineGap * (i + 0.5);
      const x = align === 'center' ? w / 2 : align === 'left' ? pad : w - pad;
      g.fillText(ln, x, y);
    });
  });
}

// ---------- geometry ----------
// Lathe along -Y from 0 to -len. radii: array of [t(0..1), r]. Optional elliptical scale.
export function limbGeometry(len, radii, { radial = 10, segs = 10, sx = 1, sz = 1 } = {}) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    let r = radii[0][1];
    for (let k = 0; k < radii.length - 1; k++) {
      const [t0, r0] = radii[k], [t1, r1] = radii[k + 1];
      if (t >= t0 && t <= t1) { r = lerp(r0, r1, smooth((t - t0) / (t1 - t0 || 1))); break; }
      if (t > t1) r = r1;
    }
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), -t * len));
  }
  // close the ends
  pts.unshift(new THREE.Vector2(0.0001, 0));
  pts.push(new THREE.Vector2(0.0001, -len));
  const g = new THREE.LatheGeometry(pts, radial);
  g.scale(sx, 1, sz);
  g.computeVertexNormals();
  return g;
}

// Lathe from an explicit profile [[y, r], ...] (y ascending or descending), elliptical scale
export function latheProfile(profile, { radial = 16, sx = 1, sz = 1, closeTop = false, closeBottom = false } = {}) {
  const pts = profile.map(([y, r]) => new THREE.Vector2(Math.max(r, 0.0001), y));
  if (closeBottom) pts.unshift(new THREE.Vector2(0.0001, profile[0][0]));
  if (closeTop) pts.push(new THREE.Vector2(0.0001, profile[profile.length - 1][0]));
  const g = new THREE.LatheGeometry(pts, radial);
  g.scale(sx, 1, sz);
  g.computeVertexNormals();
  return g;
}

// Tapered, flattened tube along a curve (hair locks, tentacles, ribbons)
export function taperedTube(points, { r0 = 0.03, r1 = 0.005, flat = 1, segs = 16, radial = 6, up = new THREE.Vector3(0, 0, 1), rFn = null } = {}) {
  const curve = new THREE.CatmullRomCurve3(points);
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], idx = [], uv = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPointAt(t);
    const T = curve.getTangentAt(t);
    // stable side vectors using provided up
    let N = new THREE.Vector3().crossVectors(T, up);
    if (N.lengthSq() < 1e-6) N = frames.normals[i].clone();
    N.normalize();
    const B = new THREE.Vector3().crossVectors(T, N).normalize();
    const r = rFn ? rFn(t) : lerp(r0, r1, Math.pow(t, 1.3));
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const cx = Math.cos(a) * r, cy = Math.sin(a) * r * flat;
      pos.push(p.x + N.x * cx + B.x * cy, p.y + N.y * cx + B.y * cy, p.z + N.z * cx + B.z * cy);
      uv.push(j / radial, t);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function starShape(outer = 1, inner = 0.45, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  s.closePath();
  return s;
}

export function heartShape(size = 1) {
  const s = new THREE.Shape();
  const k = size;
  s.moveTo(0, -0.9 * k);
  s.bezierCurveTo(0.6 * k, -0.4 * k, 1.05 * k, 0.05 * k, 0.75 * k, 0.5 * k);
  s.bezierCurveTo(0.5 * k, 0.85 * k, 0.1 * k, 0.75 * k, 0, 0.45 * k);
  s.bezierCurveTo(-0.1 * k, 0.75 * k, -0.5 * k, 0.85 * k, -0.75 * k, 0.5 * k);
  s.bezierCurveTo(-1.05 * k, 0.05 * k, -0.6 * k, -0.4 * k, 0, -0.9 * k);
  return s;
}

// ---------- camera paths ----------
// keys: [{t, pos:[x,y,z], look:[x,y,z], fov}] ; t in local shot time (seconds)
export function cameraPath(keys, ease = smoother) {
  const P = keys.map((k) => new THREE.Vector3(...k.pos));
  const L = keys.map((k) => new THREE.Vector3(...k.look));
  return (camera, lt) => {
    let i = 0;
    while (i < keys.length - 2 && lt > keys[i + 1].t) i++;
    const k0 = keys[i], k1 = keys[Math.min(i + 1, keys.length - 1)];
    const u = k1.t === k0.t ? 0 : ease(clamp((lt - k0.t) / (k1.t - k0.t)));
    camera.position.lerpVectors(P[i], P[Math.min(i + 1, P.length - 1)], u);
    const look = new THREE.Vector3().lerpVectors(L[i], L[Math.min(i + 1, L.length - 1)], u);
    const f0 = k0.fov ?? 40, f1 = k1.fov ?? f0;
    camera.fov = lerp(f0, f1, u);
    camera.updateProjectionMatrix();
    camera.lookAt(look);
    if (k0.roll || k1.roll) camera.rotateZ(lerp(k0.roll || 0, k1.roll || 0, u));
  };
}

// small handheld wobble added on top of a camera
export function handheld(camera, t, amt = 1) {
  camera.rotateX(Math.sin(t * 1.3) * 0.004 * amt + Math.sin(t * 3.1) * 0.0015 * amt);
  camera.rotateY(Math.sin(t * 0.9 + 1.2) * 0.005 * amt);
  camera.rotateZ(Math.sin(t * 0.7 + 2.1) * 0.003 * amt);
}

export function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...opts });
}
