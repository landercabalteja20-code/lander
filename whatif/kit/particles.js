// GPU particles animated purely from uTime (deterministic): snow, embers, spores, confetti, rain streaks.
import * as THREE from 'three';
import { rng } from './util.js';

const PRESET = {
  snow: { color: '#ffffff', size: 7, vel: [0.3, -1.4, 0.1], wobble: 0.6, additive: false, opacity: 0.9 },
  embers: { color: '#ffae4a', size: 6, vel: [0.2, 2.2, 0], wobble: 0.8, additive: true, opacity: 1, glow: 3 },
  spores: { color: '#7dffd8', size: 7, vel: [0.1, 0.35, 0.05], wobble: 0.9, additive: true, opacity: 0.9, glow: 2.2 },
  dust: { color: '#ffe2b0', size: 4, vel: [1.2, 0.05, 0.2], wobble: 0.4, additive: true, opacity: 0.5, glow: 1 },
  confetti: { color: '#ffffff', size: 9, vel: [0, -1.6, 0], wobble: 1.2, additive: false, opacity: 1, multicolor: true },
  bubbles: { color: '#bff4ff', size: 6, vel: [0, 1.0, 0], wobble: 0.5, additive: true, opacity: 0.6, glow: 1.2 },
};

// Points that drift through a box [w,h,d] centred on `center` and wrap around.
export function createParticles({ type = 'snow', count = 2000, box = [30, 20, 30], center = [0, 8, 0], seed = 5, color, size, vel, sizeRef = 1920 } = {}) {
  const P = { ...PRESET[type] };
  if (color) P.color = color; if (size) P.size = size; if (vel) P.vel = vel;
  const R = rng(seed);
  const pos = new Float32Array(count * 3), ph = new Float32Array(count), col = new Float32Array(count * 3);
  const palette = ['#ff4fa3', '#ffd34f', '#4fd1ff', '#9b6bff', '#5dff9b', '#ffffff'].map((c) => new THREE.Color(c));
  const base = new THREE.Color(P.color);
  for (let i = 0; i < count; i++) {
    pos.set([R() * box[0], R() * box[1], R() * box[2]], i * 3);
    ph[i] = R() * 100;
    const c = P.multicolor ? palette[i % palette.length] : base;
    col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, vertexColors: true,
    blending: P.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 }, uBox: { value: new THREE.Vector3(...box) }, uCenter: { value: new THREE.Vector3(...center) },
      uVel: { value: new THREE.Vector3(...P.vel) }, uWob: { value: P.wobble }, uSize: { value: P.size }, uScale: { value: 1 },
      uGlow: { value: P.glow || 1 }, uOpacity: { value: P.opacity }, uWind: { value: new THREE.Vector3() },
    },
    vertexShader: `attribute float phase; uniform float uTime, uWob, uSize, uScale; uniform vec3 uBox, uCenter, uVel, uWind; varying vec3 vC; varying float vTw;
      void main(){ vC = color; vec3 p = position + (uVel + uWind) * uTime * (0.7 + 0.6 * fract(phase * 7.13));
        p.x += sin(uTime * 0.9 + phase) * uWob; p.z += cos(uTime * 0.7 + phase * 1.3) * uWob;
        p = mod(p, uBox) - uBox * 0.5 + uCenter;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        vTw = 0.6 + 0.4 * sin(uTime * 3.0 + phase * 5.0);
        gl_PointSize = min(uSize * uScale * (0.6 + fract(phase * 3.7)) * 10.0 / max(-mv.z, 0.5), 28.0 * uScale); }`,
    fragmentShader: `uniform float uGlow, uOpacity; varying vec3 vC; varying float vTw;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d); gl_FragColor = vec4(vC * uGlow, a * uOpacity * vTw); }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.userData.update = (t, H = 1920, centerV = null) => {
    mat.uniforms.uTime.value = t; mat.uniforms.uScale.value = H / sizeRef;
    if (centerV) mat.uniforms.uCenter.value.copy(centerV);
  };
  pts.userData.uniforms = mat.uniforms;
  return pts;
}

// Rain as streak line segments, falling in a box around `center`.
export function createRain({ count = 4000, box = [30, 24, 30], center = [0, 10, 0], speed = 22, length = 0.7, color = '#a9c4e8', opacity = 0.45, wind = [2, 0, 0.5], seed = 9 } = {}) {
  const R = rng(seed);
  const pos = new Float32Array(count * 6), ph = new Float32Array(count * 2), end = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = R() * box[0], y = R() * box[1], z = R() * box[2], p = R() * 100;
    pos.set([x, y, z, x, y, z], i * 6);
    ph.set([p, p], i * 2); end.set([0, 1], i * 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
  g.setAttribute('isEnd', new THREE.BufferAttribute(end, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uBox: { value: new THREE.Vector3(...box) }, uCenter: { value: new THREE.Vector3(...center) }, uSpeed: { value: speed }, uLen: { value: length }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uWind: { value: new THREE.Vector3(...wind) } },
    vertexShader: `attribute float phase; attribute float isEnd; uniform float uTime, uSpeed, uLen; uniform vec3 uBox, uCenter, uWind; varying float vE;
      void main(){ vec3 vel = vec3(uWind.x, -uSpeed * (0.85 + 0.3 * fract(phase * 3.1)), uWind.z);
        vec3 p = position + vel * uTime; p = mod(p, uBox) - uBox * 0.5 + uCenter;
        p -= normalize(vel) * uLen * isEnd; vE = isEnd;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vE; void main(){ gl_FragColor = vec4(uColor, uOpacity * (1.0 - vE * 0.8)); }`,
  });
  const ls = new THREE.LineSegments(g, mat);
  ls.frustumCulled = false;
  ls.userData.update = (t, centerV = null) => { mat.uniforms.uTime.value = t; if (centerV) mat.uniforms.uCenter.value.copy(centerV); };
  ls.userData.uniforms = mat.uniforms;
  return ls;
}
