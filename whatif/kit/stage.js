// Concert stages: mega stadium stage (LED wall, truss, sweeping beams) and a sad flatbed-truck stage.
import * as THREE from 'three';
import { std, rng, textTexture, canvasTexture } from './util.js';

export function beamMaterial(color = '#ffffff', opacity = 0.22) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
    vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ float edge = pow(abs(dot(vN, vV)), 1.5); float a = pow(vY, 1.8) * edge * uOpacity; gl_FragColor = vec4(uColor * 1.5, a); }`,
  });
}

// cone of light pointing down -Y from its origin
export function createBeam({ length = 30, radius = 4, color = '#ffffff', opacity = 0.22 } = {}) {
  const g = new THREE.ConeGeometry(radius, length, 28, 1, true);
  g.translate(0, -length / 2, 0);
  const m = new THREE.Mesh(g, beamMaterial(color, opacity));
  m.renderOrder = 5;
  return m;
}

function ledWallMaterial(colors) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, c1: { value: new THREE.Color(colors[0]) }, c2: { value: new THREE.Color(colors[1]) }, c3: { value: new THREE.Color(colors[2] || colors[0]) }, uBeat: { value: 0 }, uMode: { value: 0 }, uBright: { value: 0.42 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime, uBeat, uMode, uBright; uniform vec3 c1, c2, c3; varying vec2 vUv;
      float star(vec2 p, float r){ float a = atan(p.y, p.x); float k = 0.5 + 0.5 * cos(a * 5.0); float rr = r * (0.55 + 0.45 * k); return smoothstep(rr, rr - 0.01, length(p)); }
      void main(){
        vec2 uv = vUv; vec2 grid = fract(uv * vec2(220.0, 110.0)); float px = 0.55 + 0.45 * smoothstep(0.0, 0.2, grid.x) * smoothstep(0.0, 0.2, grid.y) * smoothstep(1.0, 0.8, grid.x) * smoothstep(1.0, 0.8, grid.y);
        vec2 p = (uv - 0.5) * vec2(2.0, 1.0);
        float r = length(p);
        float rings = 0.5 + 0.5 * sin(r * 18.0 - uTime * 3.0);
        float sweep = 0.5 + 0.5 * sin(p.x * 6.0 + uTime * 1.5 + sin(p.y * 4.0 + uTime));
        vec3 col = mix(c1, c2, rings);
        col = mix(col, c3, sweep * 0.4);
        float pulse = 0.55 + 0.45 * pow(1.0 - fract(uBeat), 3.0);
        float s = star(p - vec2(0.0, 0.0), 0.42 + 0.04 * pulse);
        col = mix(col * 0.5, col * 1.6 + vec3(0.25), s * 0.6);
        gl_FragColor = vec4(col * px * uBright * pulse, 1.0);
      }`,
  });
}

// Big stadium stage. Origin: front-centre of the stage deck at ground level; performer stands at (0, height, -depth*0.35).
export function createStage({ width = 26, depth = 12, height = 1.8, deckColor = '#15151c', trim = '#ff4fd8', led = ['#ff3fb4', '#6b3bff', '#ffd84f'], beams = 8, beamColors = ['#ff6ad5', '#7b8bff', '#fff2c8'], screen = true, screenH = 13, trussColor = '#3a3c44', seed = 3, deckMat = null } = {}) {
  const R = rng(seed);
  const grp = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), deckMat || new THREE.MeshStandardMaterial({ color: deckColor, roughness: 0.25, metalness: 0.4 }));
  deck.position.set(0, height / 2, -depth / 2);
  deck.receiveShadow = true; deck.castShadow = true;
  grp.add(deck);
  // glowing trim along front edge + edges of deck top
  const trimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(trim).multiplyScalar(2) });
  const front = new THREE.Mesh(new THREE.BoxGeometry(width, 0.12, 0.12), trimMat); front.position.set(0, height - 0.06, 0.02); grp.add(front);
  const front2 = new THREE.Mesh(new THREE.BoxGeometry(width, 0.06, 0.06), trimMat); front2.position.set(0, 0.25, 0.02); grp.add(front2);
  // downstage floor lights
  const fl = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4d0').multiplyScalar(1.3) });
  for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.25, 12), fl); c.position.set((i - 4) * (width / 10), height + 0.12, -0.5); grp.add(c); }

  let wallMat = null;
  if (screen) {
    wallMat = ledWallMaterial(led);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.9, screenH), wallMat);
    wall.position.set(0, height + screenH / 2 + 0.6, -depth + 0.3);
    grp.add(wall);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(width * 0.92, screenH + 0.6, 0.4), std('#0c0c10', { roughness: 0.5 }));
    frame.position.set(0, height + screenH / 2 + 0.6, -depth + 0.05); grp.add(frame);
  }
  // truss: two towers + top span
  const trussMat = new THREE.MeshStandardMaterial({ color: trussColor, roughness: 0.4, metalness: 0.8 });
  const topY = height + screenH + 3;
  const towerGeo = new THREE.BoxGeometry(0.7, topY, 0.7);
  for (const s of [-1, 1]) {
    const tw = new THREE.Mesh(towerGeo, trussMat); tw.position.set(s * (width / 2 + 0.2), topY / 2, -depth * 0.55); tw.castShadow = true; grp.add(tw);
    // speaker stacks
    for (let k = 0; k < 4; k++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.3, 1.6), std('#101014', { roughness: 0.8 }));
      sp.position.set(s * (width / 2 - 1.6), height + 0.65 + k * 1.32, -1.4); grp.add(sp);
      const cone = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16), std('#26262c', { roughness: 0.5 }));
      cone.position.set(s * (width / 2 - 1.6), height + 0.65 + k * 1.32, -0.59); grp.add(cone);
    }
  }
  const span = new THREE.Mesh(new THREE.BoxGeometry(width + 1.2, 0.7, 0.7), trussMat); span.position.set(0, topY, -depth * 0.55); grp.add(span);
  const span2 = new THREE.Mesh(new THREE.BoxGeometry(width + 1.2, 0.5, 0.5), trussMat); span2.position.set(0, topY - 2, -0.6); grp.add(span2);

  // moving-head beams hanging from the front span
  const beamObjs = [];
  for (let i = 0; i < beams; i++) {
    const pivot = new THREE.Object3D();
    pivot.position.set((i / (beams - 1) - 0.5) * width * 0.95, topY - 2.4, -0.6);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.6), std('#1a1a1e'));
    pivot.add(head);
    const col = beamColors[i % beamColors.length];
    const beam = createBeam({ length: 70, radius: 6.5, color: col, opacity: 0.16 });
    pivot.add(beam);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.25, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(4) }));
    lens.rotation.x = Math.PI / 2; lens.position.y = -0.36; pivot.add(lens);
    grp.add(pivot);
    beamObjs.push({ pivot, ph: R() * 6.28, side: i % 2 ? 1 : -1 });
  }

  const performer = new THREE.Vector3(0, height, -depth * 0.32);
  function update(t, beat = t * 1.6, energy = 1) {
    if (wallMat) { wallMat.uniforms.uTime.value = t; wallMat.uniforms.uBeat.value = beat; }
    for (const b of beamObjs) {
      b.pivot.rotation.x = 0.55 + Math.sin(t * 0.7 + b.ph) * 0.35 * energy;
      b.pivot.rotation.z = Math.sin(t * 0.5 + b.ph * 1.7) * 0.6 * b.side * energy;
    }
  }
  return { group: grp, update, performer, topY };
}

// Flatbed truck "stage" for a parking lot. Origin at ground under the truck bed centre.
export function createFlatbedStage({ banner = ['LIVE TONITE!', 'PARKING $12'] } = {}) {
  const grp = new THREE.Group();
  const paint = std('#c9cdd2', { roughness: 0.5, metalness: 0.3 });
  const darkM = std('#1b1c20', { roughness: 0.9 });
  // bed
  const bed = new THREE.Mesh(new THREE.BoxGeometry(6, 0.25, 3), std('#5b4a3a', { roughness: 0.85 }));
  bed.position.set(0, 1.2, 0); bed.castShadow = bed.receiveShadow = true; grp.add(bed);
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.4, 2.4), darkM); chassis.position.set(0.4, 0.85, 0); grp.add(chassis);
  // cab
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2, 2.2, 2.4), paint); cab.position.set(4.2, 1.9, 0); cab.castShadow = true; grp.add(cab);
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.8, 2.0), std('#223040', { roughness: 0.1, metalness: 0.6 })); win.position.set(5.21, 2.4, 0); grp.add(win);
  for (const [x, z] of [[-2, 1.1], [-2, -1.1], [-0.6, 1.1], [-0.6, -1.1], [4.2, 1.1], [4.2, -1.1]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 16), darkM); w.rotation.x = Math.PI / 2; w.position.set(x, 0.5, z); grp.add(w);
  }
  // sad little truss + one light
  const trussM = std('#6a6d75', { roughness: 0.4, metalness: 0.8 });
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.2, 0.15), trussM); p.position.set(s * 2.8, 2.9, -1.3); grp.add(p); }
  const top = new THREE.Mesh(new THREE.BoxGeometry(5.9, 0.15, 0.15), trussM); top.position.set(0, 4.45, -1.3); grp.add(top);
  // banner
  const tex = textTexture(banner, { w: 1024, h: 256, bg: '#f3efe2', fg: '#c2281f', font: '800 92px Inter', lineGap: 1.05 });
  const ban = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.35), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide }));
  ban.position.set(0, 3.7, -1.33); grp.add(ban);
  // one clip light
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 0.35, 10), darkM); lamp.position.set(-1.5, 4.25, -1.1); lamp.rotation.x = 0.8; grp.add(lamp);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff1c9').multiplyScalar(3) }));
  lens.position.set(-1.5, 4.12, -0.98); lens.rotation.x = -0.75 + Math.PI / 2 - Math.PI / 2; grp.add(lens);
  // a single speaker on a stand, and an orange extension cord
  const spk = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.5), darkM); spk.position.set(2.5, 1.8, 0.9); grp.add(spk);
  const cord = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.03, 6, 20), std('#ff7a1a')); cord.rotation.x = Math.PI / 2; cord.position.set(1.8, 1.34, 1.1); grp.add(cord);
  // folding chair on stage (for the one roadie)
  const chair = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 0.45), std('#3b3f47')); chair.position.set(-2.4, 1.75, 0.9); grp.add(chair);
  grp.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const performer = new THREE.Vector3(0, 1.33, 0.2);
  return { group: grp, performer };
}
