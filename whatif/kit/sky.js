// Skies and space: gradient dome, twinkling stars, procedural planets with rings, suns, auroras, galaxy.
import * as THREE from 'three';
import { rng, canvasTexture, fbm, radialGlowTexture, lerp } from './util.js';

// Gradient sky dome. colors: top / horizon / bottom. Optional sun glow.
export function createSkyDome({ top = '#1a1440', horizon = '#7b4aa8', bottom = '#1a1020', radius = 2500, sunDir = null, sunColor = '#ffd9a0', sunSize = 0.03, sunGlow = 0.25, exponent = 0.6 } = {}) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) }, bottom: { value: new THREE.Color(bottom) },
      sunDir: { value: (sunDir ? new THREE.Vector3(...sunDir) : new THREE.Vector3(0, 1, 0)).normalize() },
      sunColor: { value: new THREE.Color(sunColor) }, sunSize: { value: sunDir ? sunSize : 0 }, sunGlow: { value: sunDir ? sunGlow : 0 },
      exponent: { value: exponent },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 top, horizon, bottom, sunDir, sunColor; uniform float sunSize, sunGlow, exponent; varying vec3 vDir;
      void main(){ float h = vDir.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(h, exponent)) : mix(horizon, bottom, pow(-h, 0.5));
        float d = max(dot(normalize(vDir), sunDir), 0.0);
        c += sunColor * (smoothstep(1.0 - sunSize, 1.0 - sunSize * 0.6, d) * 3.0 + pow(d, 40.0) * sunGlow + pow(d, 6.0) * sunGlow * 0.3);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), mat);
  m.frustumCulled = false; m.renderOrder = -10;
  m.userData.setColors = (t, h, b) => { mat.uniforms.top.value.set(t); mat.uniforms.horizon.value.set(h); mat.uniforms.bottom.value.set(b); };
  return m;
}

// Twinkling star field on a sphere shell (above horizon by default)
export function createStars({ count = 3000, radius = 2000, seed = 3, size = 2.2, minY = -0.15, color = '#ffffff' } = {}) {
  const R = rng(seed);
  const pos = new Float32Array(count * 3), ph = new Float32Array(count), sz = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let v;
    do { v = new THREE.Vector3(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1); } while (v.lengthSq() > 1 || v.lengthSq() < 0.01 || v.normalize().y < minY);
    v.multiplyScalar(radius);
    pos.set([v.x, v.y, v.z], i * 3); ph[i] = R() * 100; sz[i] = Math.pow(R(), 3) * 2.5 + 0.6;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
  g.setAttribute('sz', new THREE.BufferAttribute(sz, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uSize: { value: size }, uColor: { value: new THREE.Color(color) }, uScale: { value: 1 } },
    vertexShader: `attribute float phase; attribute float sz; uniform float uTime, uSize, uScale; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
        vA = 0.55 + 0.45 * sin(uTime * (1.5 + fract(phase) * 2.0) + phase);
        gl_PointSize = uSize * sz * uScale; }`,
    fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(uColor * 1.6, a * vA); }`,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false; p.renderOrder = -9;
  p.userData.update = (t, H = 1920) => { mat.uniforms.uTime.value = t; mat.uniforms.uScale.value = H / 1920; };
  return p;
}

// Planet textures
function planetTexture(type, colors, seed) {
  const R = rng(seed);
  return canvasTexture(512, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    const cs = colors.map((c) => new THREE.Color(c));
    const offs = R() * 100;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h;
        let k;
        if (type === 'gas') {
          k = (Math.sin(v * 38 + fbm(u * 6, v * 20, 3, seed) * 6) * 0.5 + 0.5) * 0.7 + fbm(u * 10 + offs, v * 40, 3, seed + 1) * 0.3;
        } else if (type === 'earth') {
          const n = fbm(u * 7 + offs, v * 4, 5, seed);
          const lat = Math.abs(v - 0.5) * 2;
          if (lat > 0.85) k = 1; else k = n > 0.53 ? 0.55 + (n - 0.53) * 1.5 : 0.1 + n * 0.3;
        } else {
          k = fbm(u * 8 + offs, v * 4, 5, seed);
          if (type === 'lava') k = Math.pow(k, 1.6);
        }
        k = Math.min(0.999, Math.max(0, k));
        const f = k * (cs.length - 1), i0 = Math.floor(f), tt = f - i0;
        const c = cs[i0].clone().lerp(cs[Math.min(i0 + 1, cs.length - 1)], tt);
        if (type === 'earth') {
          // explicit palette: ocean -> coast -> land -> ice
          const n = fbm(u * 7 + offs, v * 4, 5, seed); const lat = Math.abs(v - 0.5) * 2;
          const ocean = new THREE.Color('#123f8a'), land = new THREE.Color('#3c7a3a'), desert = new THREE.Color('#b59a5a'), ice = new THREE.Color('#eef4ff');
          let cc = n > 0.53 ? land.clone().lerp(desert, Math.min(1, (n - 0.53) * 4) * (1 - lat)) : ocean.clone().multiplyScalar(0.8 + n * 0.5);
          if (lat > 0.82) cc = ice;
          c.copy(cc);
        }
        const o = (y * w + x) * 4;
        img.data[o] = c.r * 255; img.data[o + 1] = c.g * 255; img.data[o + 2] = c.b * 255; img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  });
}

function cloudTexture(seed) {
  return canvasTexture(512, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = fbm(x / w * 9, y / h * 5, 5, seed);
      const a = Math.max(0, (n - 0.56) * 3.0);
      const o = (y * w + x) * 4;
      img.data[o] = 255; img.data[o + 1] = 255; img.data[o + 2] = 255; img.data[o + 3] = Math.min(255, a * 255);
    }
    g.putImageData(img, 0, 0);
  });
}

// A planet (for skies or space shots). type: gas | rock | ice | lava | earth
export function createPlanet({ radius = 100, type = 'gas', colors = ['#d9a066', '#f3d9a4', '#a86b3c', '#e8c48a'], seed = 1, rings = null, glow = '#ffd9a0', glowSize = 1.35, emissive = 0, tilt = 0.35, clouds = false, segments = 48 } = {}) {
  const grp = new THREE.Group();
  const tex = planetTexture(type, colors, seed);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0, emissive: emissive ? new THREE.Color('#ffffff') : new THREE.Color('#000'), emissiveMap: emissive ? tex : null, emissiveIntensity: emissive, fog: false });
  const body = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, Math.round(segments / 2)), mat);
  grp.add(body);
  if (clouds) {
    const cl = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.015, segments, Math.round(segments / 2)), new THREE.MeshStandardMaterial({ map: cloudTexture(seed + 5), transparent: true, depthWrite: false, roughness: 1, fog: false }));
    grp.add(cl); grp.userData.clouds = cl;
  }
  if (glow) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialGlowTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)'), color: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.45, fog: false }));
    sp.scale.setScalar(radius * 2 * glowSize * 1.25);
    sp.renderOrder = -1;
    grp.add(sp); grp.userData.glow = sp;
  }
  if (rings) {
    const { inner = 1.4, outer = 2.3, colors: rc = ['#e8d2a8', '#b8946a', '#f1e3c4'], opacity = 0.85 } = rings;
    const g = new THREE.RingGeometry(radius * inner, radius * outer, 128, 1);
    const uv = g.attributes.uv, p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) { const r = Math.hypot(p.getX(i), p.getY(i)); uv.setXY(i, (r - radius * inner) / (radius * (outer - inner)), 0.5); }
    const R = rng(seed + 9);
    const rt = canvasTexture(512, 4, (gg, w, h) => {
      for (let x = 0; x < w; x++) {
        const k = x / w;
        const c = new THREE.Color(rc[Math.floor(R() * rc.length)]);
        const a = (0.35 + 0.65 * Math.abs(Math.sin(k * 40 + R()))) * (k > 0.05 && k < 0.97 ? 1 : 0.2) * (Math.abs(k - 0.62) < 0.025 ? 0.1 : 1);
        gg.fillStyle = `rgba(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0},${a})`; gg.fillRect(x, 0, 1, h);
      }
    });
    const rm = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: rt, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, roughness: 1, fog: false }));
    rm.rotation.x = -Math.PI / 2 + 0.22;
    grp.add(rm); grp.userData.rings = rm;
  }
  body.rotation.z = tilt;
  grp.userData.body = body;
  grp.userData.spin = (t, speed = 0.02) => { body.rotation.y = t * speed; if (grp.userData.clouds) grp.userData.clouds.rotation.y = t * speed * 1.3; };
  return grp;
}

// glowing sun disc + halo sprite
export function createSun({ radius = 60, color = '#fff2c0', halo = 6, intensity = 3 } = {}) {
  const grp = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), fog: false }));
  grp.add(disc);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialGlowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8, fog: false }));
  sp.scale.setScalar(radius * halo);
  grp.add(sp);
  return grp;
}

// Aurora curtains (additive animated shader on vertical ribbons)
export function createAurora({ width = 1600, height = 260, y = 220, z = -900, colors = ['#3dffb0', '#7a5cff'], count = 3, seed = 4 } = {}) {
  const grp = new THREE.Group();
  const R = rng(seed);
  for (let i = 0; i < count; i++) {
    const g = new THREE.PlaneGeometry(width, height, 80, 1);
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { uTime: { value: 0 }, c1: { value: new THREE.Color(colors[0]) }, c2: { value: new THREE.Color(colors[1]) }, seed: { value: R() * 10 } },
      vertexShader: `uniform float uTime, seed; varying vec2 vUv; void main(){ vUv = uv; vec3 p = position; p.z += sin(p.x * 0.004 + uTime * 0.3 + seed) * 120.0 + sin(p.x * 0.011 + uTime * 0.5) * 40.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }`,
      fragmentShader: `uniform float uTime, seed; uniform vec3 c1, c2; varying vec2 vUv;
        void main(){ float band = 0.5 + 0.5 * sin(vUv.x * 60.0 + sin(vUv.x * 9.0 + uTime * 0.6 + seed) * 4.0 + uTime * 0.8);
          float a = pow(1.0 - vUv.y, 1.6) * smoothstep(0.0, 0.08, vUv.y) * (0.35 + 0.65 * band) * smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
          vec3 c = mix(c1, c2, vUv.y * 1.2); gl_FragColor = vec4(c * 1.4, a * 0.55); }`,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set((R() - 0.5) * 300, y + i * 40, z - i * 120);
    mesh.rotation.y = (R() - 0.5) * 0.4;
    grp.add(mesh);
  }
  grp.userData.update = (t) => grp.children.forEach((c) => (c.material.uniforms.uTime.value = t));
  return grp;
}

// Spiral galaxy of points (for the tour map)
export function createGalaxy({ count = 30000, radius = 900, arms = 3, seed = 21, colors = ['#ffd9a8', '#9fb8ff', '#ff9ad5'] } = {}) {
  const R = rng(seed);
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), sz = new Float32Array(count), ph = new Float32Array(count);
  const cs = colors.map((c) => new THREE.Color(c));
  for (let i = 0; i < count; i++) {
    const r = Math.pow(R(), 1.6) * radius;
    const arm = (i % arms) / arms * Math.PI * 2;
    const a = arm + r * 0.006 + (R() - 0.5) * (0.6 - r / radius * 0.3);
    const spread = (1 - r / radius) * 40 + 8;
    pos.set([Math.cos(a) * r + (R() - 0.5) * spread, (R() - 0.5) * spread * 0.5 * (1.2 - r / radius), Math.sin(a) * r + (R() - 0.5) * spread], i * 3);
    const c = r < radius * 0.18 ? new THREE.Color('#fff1d6') : cs[i % cs.length].clone().lerp(new THREE.Color('#ffffff'), R() * 0.4);
    col.set([c.r, c.g, c.b], i * 3); sz[i] = R() < 0.02 ? 3 : 1 + R(); ph[i] = R() * 50;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('sz', new THREE.BufferAttribute(sz, 1));
  g.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, fog: false,
    uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
    vertexShader: `attribute float sz; attribute float phase; uniform float uTime, uScale; varying vec3 vC; varying float vA;
      void main(){ vC = color; vA = 0.7 + 0.3 * sin(uTime * 2.0 + phase); vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = sz * uScale * 900.0 / -mv.z; }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vC, smoothstep(0.5, 0.0, d) * vA * 0.8); }`,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false;
  p.userData.update = (t, H = 1920) => { mat.uniforms.uTime.value = t; mat.uniforms.uScale.value = H / 1920; };
  return p;
}
