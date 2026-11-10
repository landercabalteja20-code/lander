// Loads sculpted characters (assets/chars/<name>.glb + .json) and gives them materials, eyes and a pose API.
//
//   await loadCast(['dog', 'cat']);
//   const dog = makeCharacter('dog');   scene.add(dog.root);
//   dog.pose({ head: [rx, ry, rz], jaw: 0..1, lids: 0..1, look: [x, y], ears: [l, r], tail: angle, nodes: {...} });
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE = new URL('../assets/chars/', import.meta.url);
const templates = new Map();

// ---------------------------------------------------------------- materials
const NOISE_GLSL = `
  float fz_h(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float fz_n(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(fz_h(i), fz_h(i + vec3(1,0,0)), f.x), mix(fz_h(i + vec3(0,1,0)), fz_h(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(fz_h(i + vec3(0,0,1)), fz_h(i + vec3(1,0,1)), f.x), mix(fz_h(i + vec3(0,1,1)), fz_h(i + vec3(1,1,1)), f.x), f.y), f.z); }`;

// Fine noise on the shading normal (object space) breaks up highlights so fur and skin don't read as plastic.
function addFuzz(mat, amount, freq) {
  if (globalThis.RQ && !globalThis.RQ.fuzz) return mat;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.fuzzAmt = { value: amount }; sh.uniforms.fuzzFreq = { value: freq };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vObj;\nuniform float fuzzAmt, fuzzFreq;\n${NOISE_GLSL}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec3 q = vObj * fuzzFreq; vec3 g = vec3(fz_n(q), fz_n(q + 31.7), fz_n(q + 71.3)) - 0.5;
          normal = normalize(normal + fuzzAmt * g); }`);
  };
  mat.customProgramCacheKey = () => `fuzz${amount}_${freq}`;
  return mat;
}

const MATS = {};
export function material(kind) {
  if (MATS[kind]) return MATS[kind];
  const P = (o) => new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: 0, ...o });
  let m;
  switch (kind) {
    case 'fur': m = addFuzz(P({ roughness: 0.84, sheen: 0.7, sheenRoughness: 0.4, sheenColor: new THREE.Color(0.75, 0.66, 0.55) }), 0.2, 650); break;
    case 'feather': m = addFuzz(P({ roughness: 0.62, sheen: 0.6, sheenRoughness: 0.35, sheenColor: new THREE.Color(0.6, 0.65, 0.7) }), 0.15, 500); break;
    case 'skin': m = addFuzz(P({ roughness: 0.5, sheen: 0.3, sheenRoughness: 0.5, sheenColor: new THREE.Color(0.8, 0.5, 0.42), clearcoat: 0.06 }), 0.06, 700); break;
    case 'hair': m = addFuzz(P({ roughness: 0.45, sheen: 0.7, sheenRoughness: 0.3, sheenColor: new THREE.Color(0.7, 0.65, 0.6) }), 0.35, 520); break;
    case 'cloth': m = addFuzz(P({ roughness: 0.82, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.7, 0.7, 0.7) }), 0.15, 800); break;
    case 'glossy': m = P({ roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.15 }); break;
    case 'plastic': m = P({ roughness: 0.4, clearcoat: 0.3 }); break;
    case 'wing': m = P({ roughness: 0.15, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false, iridescence: 1.0, iridescenceIOR: 1.4, clearcoat: 0.5 }); break;
    default: m = P({ roughness: 0.7 });
  }
  MATS[kind] = m;
  return m;
}

// ---------------------------------------------------------------- eyes
function eyeMaterial(spec) {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.18, clearcoat: 1.0, clearcoatRoughness: 0.04 });
  const iris = new THREE.Color(spec.iris);
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      irisCol: { value: iris }, irisAng: { value: spec.iris_size }, pupil: { value: spec.pupil_size },
      slit: { value: spec.pupil === 'slit' ? 1 : 0 }, dilate: { value: 1 },
    });
    m.userData.shader = sh;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vObj; uniform vec3 irisCol; uniform float irisAng, pupil, slit, dilate;`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
        vec3 d = normalize(vObj);
        vec2 q = d.xy / sin(irisAng);
        float rr = length(q);
        float front = step(0.0, d.z);
        float ang = atan(q.y, q.x);
        vec3 ic = mix(irisCol * 1.45 + 0.04, irisCol * 0.45, smoothstep(0.15, 1.0, rr));
        ic *= 0.88 + 0.12 * sin(ang * 23.0) * sin(ang * 7.0 + 1.3);
        ic = mix(ic, irisCol * 0.2, smoothstep(0.82, 0.99, rr));
        float pr = pupil * dilate;
        float pm = slit > 0.5 ? step(pow(q.x / (pr * 0.32), 2.0) + pow(q.y / (pr * 1.75), 2.0), 1.0) : step(rr, pr);
        vec3 col = vec3(0.96, 0.94, 0.9) * (0.9 + 0.1 * d.z);
        float inIris = front * (1.0 - smoothstep(0.97, 1.03, rr));
        col = mix(col, ic, inIris);
        col = mix(col, vec3(0.012), front * pm);
        float cl = smoothstep(0.16, 0.1, distance(d, normalize(vec3(-0.33, 0.38, 0.86))));
        vec4 diffuseColor = vec4(col, opacity);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.6) * cl * front;`);
  };
  m.customProgramCacheKey = () => `eye_${spec.pupil}_${spec.iris}_${spec.iris_size}_${spec.pupil_size}`;
  return m;
}

function buildEye(spec) {
  const g = new THREE.Group();
  g.position.fromArray(spec.pos);
  const look = new THREE.Vector3().fromArray(spec.look).normalize();
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), look);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(spec.r, 48, 32).rotateX(Math.PI / 2), eyeMaterial(spec));
  ball.castShadow = false; ball.receiveShadow = true;
  g.add(ball);
  // upper eyelid: a hemisphere shell slightly larger than the eye; rotation.x -1.2 (open) .. +1.57 (closed)
  const lidMat = addFuzz(new THREE.MeshPhysicalMaterial({ color: new THREE.Color(spec.lid), roughness: 0.86, sheen: 0.7, sheenRoughness: 0.4, sheenColor: new THREE.Color(0.75, 0.66, 0.55) }), 0.2, 650);
  lidMat.customProgramCacheKey = () => 'lidfuzz';
  const lid = new THREE.Mesh(new THREE.SphereGeometry(spec.r * 1.04, 40, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), lidMat);
  lid.rotation.x = -1.2;
  // dark lash line along the lid's edge, so a half-closed lid reads as an eyelid rather than a dome
  const lash = new THREE.Mesh(new THREE.TorusGeometry(spec.r * 1.05, spec.r * 0.075, 8, 40).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(spec.lid).multiplyScalar(0.25), roughness: 0.6 }));
  lid.add(lash);
  lid.receiveShadow = true; lash.receiveShadow = true;  // match the shading of the fur around the eye
  g.add(lid);
  return { group: g, ball, lid, spec };
}

// ---------------------------------------------------------------- loading
export async function loadCast(names) {
  const loader = new GLTFLoader();
  await Promise.all(names.map(async (n) => {
    if (templates.has(n)) return;
    const [gltf, rig] = await Promise.all([
      loader.loadAsync(new URL(`${n}.glb`, BASE).href),
      fetch(new URL(`${n}.json`, BASE)).then((r) => r.json()),
    ]);
    templates.set(n, { scene: gltf.scene, rig });
  }));
}

export function makeCharacter(name, { scale = 1, shadows = true } = {}) {
  const T = templates.get(name);
  if (!T) throw new Error(`character ${name} not loaded`);
  const root = new THREE.Group();
  root.name = name;
  const model = T.scene.clone(true);
  root.add(model);
  root.scale.setScalar(scale);
  const nodes = {};
  model.traverse((o) => {
    if (o.name) nodes[o.name] = o;
    if (o.isMesh) {
      const partName = o.name in T.rig.materials ? o.name : o.parent?.name;
      o.material = material(T.rig.materials[partName] || 'fur');
      o.castShadow = shadows; o.receiveShadow = true;
    }
  });
  const eyes = T.rig.eyes.map((spec) => {
    const e = buildEye(spec);
    (nodes[spec.part] || model).add(e.group);
    return e;
  });
  for (const s of (T.rig.strands || [])) {  // whiskers
    const a = new THREE.Vector3().fromArray(s.a), b = new THREE.Vector3().fromArray(s.b);
    const len = a.distanceTo(b);
    const geo = new THREE.CylinderGeometry(s.r * 0.35, s.r, len, 5, 1).translate(0, len / 2, 0);
    const w = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: s.color, roughness: 0.35 }));
    w.position.copy(a);
    w.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    (nodes[s.part] || model).add(w);
  }
  const rest = {};
  for (const [k, o] of Object.entries(nodes)) rest[k] = o.rotation.clone();
  const c = {
    name, root, nodes, eyes, rig: T.rig,
    // pose is absolute: anything not given returns to rest
    pose(p = {}) {
      for (const [k, o] of Object.entries(nodes)) o.rotation.copy(rest[k]);
      const rot = (n, v) => { if (nodes[n] && v) { nodes[n].rotation.x += v[0] || 0; nodes[n].rotation.y += v[1] || 0; nodes[n].rotation.z += v[2] || 0; } };
      rot('head', p.head);
      rot('body', p.body);
      if (p.jaw !== undefined && nodes.jaw) nodes.jaw.rotation.x += p.jaw * (p.jawMax ?? 0.42);
      if (p.ears) { rot('ear_l', [p.ears[0] * 0.3, 0, p.ears[0]]); rot('ear_r', [p.ears[1] * 0.3, 0, -p.ears[1]]); }
      if (p.tail !== undefined) rot('tail', [0, p.tail, 0]);
      for (const [n, v] of Object.entries(p.nodes || {})) rot(n, v);
      const lids = Array.isArray(p.lids) ? p.lids : [p.lids ?? 1, p.lids ?? 1];
      const look = p.look || [0, 0];
      eyes.forEach((e, i) => {
        const open = THREE.MathUtils.clamp(lids[i % 2], 0, 1);
        e.lid.rotation.x = THREE.MathUtils.lerp(1.57, -1.2, open);
        e.ball.rotation.set(-look[1] * 0.45, look[0] * 0.5, 0);
        if (e.ball.material.userData.shader && p.dilate) e.ball.material.userData.shader.uniforms.dilate.value = p.dilate;
      });
      return c;
    },
  };
  return c;
}

// Talking helper: mouth openness from a per-frame envelope array at time t (seconds since line start).
export function envAt(env, fps, t) {
  if (!env || t < 0) return 0;
  const f = t * fps, i = Math.floor(f);
  if (i >= env.length - 1) return 0;
  return env[i] + (env[i + 1] - env[i]) * (f - i);
}

// Deterministic blink: returns lid openness for time t (closes ~0.12 s every few seconds).
export function blink(t, seed = 0, every = 3.4) {
  const ph = (t + seed * 1.37) % every;
  const x = ph / 0.14;
  return x < 1 ? Math.abs(1 - 2 * x) * 0.9 + 0.1 : 1;
}
