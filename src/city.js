// Alternate-universe Manila: pastel towers, holographic HIRAYA billboards,
// hover-jeepneys, a pink monorail, parol street lamps and the glowing Hiraya Dome.
import * as THREE from 'three';
import { mat, canvasTexture, seeded, dotTexture, starGeometry } from './materials.js';
import { MEMBERS } from './members.js';
import { drawPortrait, star as star2d } from './faces.js';

const TAU = Math.PI * 2;
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
export const DOME_POS = new THREE.Vector3(0, 0, -760);

export function skyDome(top, mid, horizon, radius = 1400) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color(top) }, uMid: { value: new THREE.Color(mid) }, uHor: { value: new THREE.Color(horizon) }, uT: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uTop,uMid,uHor; uniform float uT; varying vec3 vP;
      float h(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453); }
      void main(){ float y=vP.y; vec3 c=mix(uHor,uMid,smoothstep(-0.02,0.25,y)); c=mix(c,uTop,smoothstep(0.25,0.8,y));
        vec3 q=floor(vP*300.); float s=step(0.9965,h(q))*smoothstep(0.05,0.4,y); c+=vec3(1.,.9,1.)*s*(0.6+0.4*sin(uT*3.+h(q)*50.));
        gl_FragColor=vec4(c,1.);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), m);
  s.renderOrder = -10;
  return s;
}

function windowTexture() {
  const r = seeded(4);
  return canvasTexture(512, 512, (c, w, h) => {
    c.fillStyle = '#05030a'; c.fillRect(0, 0, w, h);
    const cols = 8, rows = 12;
    const cw = w / cols, rh = h / rows;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const v = r();
      if (v < 0.55) continue;
      const tint = v > 0.92 ? '#7fe0ff' : v > 0.84 ? '#ff9ad8' : v > 0.7 ? '#ffd9a8' : '#fff2e0';
      c.globalAlpha = 0.55 + r() * 0.45;
      c.fillStyle = tint; c.fillRect(x * cw + 6, y * rh + 7, cw - 12, rh - 14);
    }
    c.globalAlpha = 1;
  }, { repeat: null });
}

function billboardCanvas(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return { c, ctx, t };
}

export class City {
  constructor() {
    this.group = new THREE.Group();
    this.sky = skyDome('#0d0830', '#4a2384', '#ff8fcf');
    this.group.add(this.sky);
    this.group.add(new THREE.HemisphereLight('#ffc6ef', '#2a1050', 1.4));
    const d = new THREE.DirectionalLight('#ffd6f0', 1.2); d.position.set(200, 300, 100); this.group.add(d);
    this.buildGround();
    this.buildTowers();
    this.buildLandmarks();
    this.buildBillboards();
    this.buildTraffic();
    this.buildDome();
    this.buildLamps();
  }

  buildGround() {
    const tex = canvasTexture(256, 256, (c, w, h) => {
      c.fillStyle = '#140a24'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ff7ac8'; c.fillRect(0, 0, w, 3); c.fillRect(0, 0, 3, h);
      c.fillStyle = 'rgba(127,212,255,0.6)'; for (let i = 0; i < w; i += 32) c.fillRect(i, h / 2, 16, 2);
    }, { repeat: [40, 40] });
    const g = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshStandardMaterial({ color: '#2a1840', roughness: 0.25, metalness: 0.5, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.55, map: tex }));
    g.rotation.x = -Math.PI / 2; g.position.set(0, 0, -300);
    this.group.add(g);
  }

  buildTowers() {
    const r = seeded(21);
    const pastel = ['#f6b7d2', '#cbb8f4', '#f3dcb1', '#b7d8f6', '#f9d4e8', '#e3d4ff', '#ffe9c9', '#c8f0f0'].map((c) => new THREE.Color(c));
    const geos = [];
    const caps = [];
    const capCols = ['#ff7ac8', '#7fd4ff', '#ffd25a', '#b07bff', '#ffffff'].map((c) => new THREE.Color(c));
    const addBox = (x, z, w, d, h, col) => {
      const g = new THREE.BoxGeometry(w, h, d);
      const uv = g.attributes.uv;
      for (let f = 0; f < 6; f++) {
        for (let k = 0; k < 4; k++) {
          const i = f * 4 + k;
          if (f === 2 || f === 3) { uv.setXY(i, 0.001, 0.001); continue; }
          const span = f < 2 ? d : w;
          uv.setXY(i, uv.getX(i) * span / 24, uv.getY(i) * h / 24);
        }
      }
      g.translate(x, h / 2, z);
      const cols = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < cols.length; i += 3) { cols[i] = col.r; cols[i + 1] = col.g; cols[i + 2] = col.b; }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      geos.push(g);
    };
    for (let bx = -6; bx <= 6; bx++) {
      for (let bz = -13; bz <= 3; bz++) {
        const cx = bx * 64, cz = bz * 64;
        if (Math.abs(cx) < 40) continue; // central avenue
        if (Math.abs(cz - DOME_POS.z) < 180 && Math.abs(cx) < 220) continue; // dome plaza
        const n = 1 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) {
          const w = 14 + r() * 16, d = 14 + r() * 16;
          const near = Math.max(0, 1 - Math.abs(cx) / 400);
          const h = 25 + Math.pow(r(), 2.2) * 210 * (0.4 + near);
          const x = cx + (r() - 0.5) * 30, z = cz + (r() - 0.5) * 30;
          const col = pastel[Math.floor(r() * pastel.length)];
          addBox(x, z, w, d, h, col);
          if (r() < 0.55) {
            const cap = new THREE.BoxGeometry(w * 1.02, 1.6, d * 1.02); cap.translate(x, h - 3, z);
            const cc = capCols[Math.floor(r() * capCols.length)];
            const ca = new Float32Array(cap.attributes.position.count * 3); for (let i = 0; i < ca.length; i += 3) { ca[i] = cc.r; ca[i + 1] = cc.g; ca[i + 2] = cc.b; }
            cap.setAttribute('color', new THREE.BufferAttribute(ca, 3)); delete cap.attributes.uv; caps.push(cap);
          }
          if (r() < 0.25) addBox(x, z, w * 0.6, d * 0.6, h + 12 + r() * 30, col.clone().offsetHSL(0, 0, 0.05));
        }
      }
    }
    const merged = mergeGeos(geos, true);
    const tex = windowTexture(); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.15, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.85 });
    const towers = new THREE.Mesh(merged, m);
    this.group.add(towers);
    const capMesh = new THREE.Mesh(mergeGeos(caps, false), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: new THREE.Color(2.2, 2.2, 2.2) }));
    this.group.add(capMesh);
  }

  buildLandmarks() {
    const g = this.group;
    // Perlas Tower
    const perlas = new THREE.Group();
    perlas.add(at(new THREE.Mesh(new THREE.CylinderGeometry(12, 16, 250, 32), new THREE.MeshPhysicalMaterial({ color: '#f9d8ea', roughness: 0.15, metalness: 0.4, clearcoat: 1, iridescence: 0.6, emissive: '#3a1030' })), 0, 125, 0));
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(24, 40, 30), mat('pearl', '#fff4fb'));
    pearl.position.y = 272; perlas.add(pearl);
    for (let i = 0; i < 6; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(15 + i * 0.4, 0.6, 6, 48), mat('emissive', i % 2 ? '#ff8fbf' : '#7fd4ff', { intensity: 2.5 })); ring.rotation.x = Math.PI / 2; ring.position.y = 40 + i * 36; perlas.add(ring); }
    perlas.position.set(95, 0, -420); g.add(perlas);
    // Capiz Tower (twisted, capiz-lattice glass)
    const capizTex = canvasTexture(256, 256, (c, w, h) => {
      c.fillStyle = '#2a1a30'; c.fillRect(0, 0, w, h);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const gr = c.createLinearGradient(x * 32, y * 32, x * 32 + 28, y * 32 + 28); gr.addColorStop(0, '#fff5e8'); gr.addColorStop(1, '#f2c7e0'); c.fillStyle = gr; c.fillRect(x * 32 + 3, y * 32 + 3, 26, 26); }
    }, { repeat: [2, 3] });
    const capiz = new THREE.Group();
    for (let i = 0; i < 16; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(30, 14, 30), new THREE.MeshStandardMaterial({ map: capizTex, emissive: '#ffffff', emissiveMap: capizTex, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.2 }));
      b.position.y = 7 + i * 14; b.rotation.y = i * 0.09; b.scale.setScalar(1 - i * 0.025); capiz.add(b);
    }
    capiz.position.set(-110, 0, -340); g.add(capiz);
    // Sampaguita crown tower
    const samp = new THREE.Group();
    samp.add(at(new THREE.Mesh(new THREE.CylinderGeometry(9, 12, 180, 24), new THREE.MeshPhysicalMaterial({ color: '#cbb8f4', roughness: 0.2, metalness: 0.5, clearcoat: 1 })), 0, 90, 0));
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; const p = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 12), mat('emissive', '#fff7f0', { intensity: 1.5 })); p.scale.set(0.5, 1.2, 0.3); p.position.set(Math.cos(a) * 10, 190, Math.sin(a) * 10); p.lookAt(0, 175, 0); samp.add(p); }
    samp.add(at(new THREE.Mesh(new THREE.SphereGeometry(6, 16, 12), mat('emissive', '#ffd25a', { intensity: 2 })), 0, 190, 0));
    samp.position.set(-70, 0, -560); g.add(samp);
    // hologram logo floating over the avenue
    const holoTex = canvasTexture(1024, 384, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.font = '400 230px "Bagel Fat One", "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const tg = c.createLinearGradient(0, 0, w, 0); tg.addColorStop(0, '#ff8fbf'); tg.addColorStop(0.5, '#ffd25a'); tg.addColorStop(1, '#7fd4ff');
      c.shadowColor = '#ff8fbf'; c.shadowBlur = 40; c.fillStyle = tg; c.fillText('HIRAYA', w / 2, h / 2 + 10);
      for (let y = 0; y < h; y += 6) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, y, w, 2); }
    });
    this.holo = new THREE.Mesh(new THREE.PlaneGeometry(150, 56), new THREE.MeshBasicMaterial({ map: holoTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) }));
    this.holo.position.set(0, 150, -300); g.add(this.holo);
    // floating sparkles
    const N = 2500, p = new Float32Array(N * 3), r = seeded(55);
    for (let i = 0; i < N; i++) { p[i * 3] = (r() - 0.5) * 600; p[i * 3 + 1] = r() * 220; p[i * 3 + 2] = -r() * 900 + 100; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.sparkles = new THREE.Points(sg, new THREE.PointsMaterial({ size: 2.4, map: dotTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffd6f4' }));
    g.add(this.sparkles);
  }

  buildBillboards() {
    const g = this.group;
    this.portraits = [];
    // member portrait banners along the avenue
    MEMBERS.forEach((m, i) => {
      const bb = billboardCanvas(512, 820, () => {});
      const side = i % 2 ? 1 : -1;
      const z = -60 - i * 95;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(34, 54), new THREE.MeshBasicMaterial({ map: bb.t, toneMapped: false, color: new THREE.Color(1.25, 1.25, 1.25) }));
      mesh.position.set(side * 42, 70 + (i % 3) * 18, z);
      mesh.rotation.y = -side * Math.PI / 2;
      g.add(mesh);
      this.portraits.push({ m, bb, mesh });
    });
    // comedy ads
    const ads = [
      ['UBE', 'Official flavor of the Olympics', '#a66bff'],
      ['JEEPNEY', 'The new limousine.', '#ffd25a'],
      ['LEARN TAGALOG', '9 billion downloads', '#7fd4ff'],
      ['KILIG (WORLDWIDE)', '#1 in 194 countries', '#ff8fbf'],
      ['WORLD TOUR', 'Sold out on 7 continents', '#ff3b55'],
      ['VIDEOKE', 'Now a UNESCO heritage sport', '#ffd25a'],
    ];
    this.ads = ads.map(([a, b, col], i) => {
      const bb = billboardCanvas(1024, 512, (c, w, h) => {
        const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1a0830'); gr.addColorStop(1, col); c.fillStyle = gr; c.fillRect(0, 0, w, h);
        for (let k = 0; k < 40; k++) star2d(c, (k * 137) % w, (k * 89) % h, 4 + (k % 4) * 3, 'rgba(255,255,255,0.6)');
        c.textAlign = 'center'; c.fillStyle = '#fff'; c.shadowColor = col; c.shadowBlur = 30;
        c.font = `400 ${a.length > 12 ? 92 : 130}px "Bagel Fat One", "Arial Black", sans-serif`; c.fillText(a, w / 2, h * 0.52);
        c.shadowBlur = 0; c.font = '600 46px "DM Sans", sans-serif'; c.fillStyle = 'rgba(255,255,255,0.92)'; c.fillText(b, w / 2, h * 0.78);
        c.font = '700 26px "DM Sans", sans-serif'; c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillText('PRESENTED BY HIRAYA', w / 2, h * 0.16);
      });
      const side = i % 2 ? -1 : 1;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshBasicMaterial({ map: bb.t, toneMapped: false, color: new THREE.Color(1.15, 1.15, 1.15) }));
      mesh.position.set(side * 44, 40 + (i % 2) * 40, -110 - i * 80);
      mesh.rotation.y = -side * Math.PI / 2;
      g.add(mesh);
      return mesh;
    });
    this.drawPortraits(0, true);
  }

  drawPortraits(t, force = false) {
    const k = Math.floor(t * 6);
    if (!force && k === this._pk) return;
    this._pk = k;
    for (const p of this.portraits) {
      const { c, t: tex } = p.bb;
      const ctx = c.getContext('2d');
      const W = c.width, H = c.height;
      const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1c0a34'); gr.addColorStop(1, p.m.color);
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 30; i++) star2d(ctx, (i * 151 + t * 20) % W, (i * 97) % H, 3 + (i % 3) * 3, 'rgba(255,255,255,0.55)');
      const blink = ((t + p.m.name.length) % 3.7) < 0.14 ? 1 : 0;
      drawPortrait(ctx, p.m, W / 2, H * 0.42, 420, { blinkL: blink, blinkR: blink, happy: 0, lookX: 0, lookY: 0, brow: 0.1, browTilt: 0, open: 0, wide: 1, round: 0, smile: 0.75, sparkle: 1, time: t });
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.shadowColor = p.m.color; ctx.shadowBlur = 30;
      ctx.font = '400 104px "Bagel Fat One", "Arial Black", sans-serif'; ctx.fillText(p.m.name, W / 2, H - 120);
      ctx.shadowBlur = 0; ctx.font = '700 34px "DM Sans", sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillText('HIRAYA · ' + p.m.role.toUpperCase(), W / 2, H - 64);
      tex.needsUpdate = true;
    }
  }

  buildTraffic() {
    const g = this.group;
    // monorail
    const track = new THREE.Mesh(new THREE.BoxGeometry(1100, 2, 3), mat('chrome', '#d8c8f0'));
    track.position.set(0, 46, -210); g.add(track);
    for (let x = -500; x <= 500; x += 70) { const p = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 46, 10), mat('gloss', '#e9d8ff')); p.position.set(x, 23, -210); g.add(p); }
    this.train = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const car = new THREE.Mesh(new THREE.CapsuleGeometry(3.2, 13, 6, 16), mat('gloss', '#ff9fcf'));
      car.rotation.z = Math.PI / 2; car.position.x = i * 18; this.train.add(car);
      const win = new THREE.Mesh(new THREE.BoxGeometry(14, 1.6, 6.6), mat('emissive', '#fff2fb', { intensity: 2 }));
      win.position.set(i * 18, 0.8, 0); this.train.add(win);
    }
    this.train.position.set(0, 50.5, -210); g.add(this.train);
    // hover jeepneys
    const jeepGeo = jeepneyGeometry();
    const cols = ['#ff8fbf', '#ffd25a', '#7fd4ff', '#a66bff', '#ff3b55', '#c8f0f0', '#ffffff'];
    this.jeeps = [];
    const r = seeded(13);
    for (let i = 0; i < 34; i++) {
      const col = cols[i % cols.length];
      const body = new THREE.Mesh(jeepGeo, new THREE.MeshPhysicalMaterial({ vertexColors: true, color: col, roughness: 0.2, metalness: 0.45, clearcoat: 1 }));
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(9, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(cols[(i + 2) % cols.length]).multiplyScalar(2.5), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, map: dotTexture(), toneMapped: false }));
      glow.rotation.x = -Math.PI / 2; glow.position.y = -0.9;
      const j = new THREE.Group(); j.add(body, glow); g.add(j);
      const alongZ = i < 22;
      const lane = alongZ ? { x: (i % 4 - 1.5) * 9, y: 5 + (i % 5) * 7, dir: i % 2 ? 1 : -1 } : { z: -90 - (i % 6) * 128, y: 8 + (i % 4) * 9, dir: i % 2 ? 1 : -1 };
      this.jeeps.push({ j, alongZ, lane, speed: 28 + r() * 26, off: r() * 900 });
    }
  }

  buildDome() {
    const g = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(130, 64, 32, 0, TAU, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#f3c6ff', roughness: 0.15, metalness: 0.5, clearcoat: 1, iridescence: 0.8, emissive: '#5a1a6a', emissiveIntensity: 0.6 }));
    g.add(dome);
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(130 * Math.cos((i + 1) * 0.25), 1.6, 8, 96), mat('emissive', MEMBERS[i].color, { intensity: 3 }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 130 * Math.sin((i + 1) * 0.25); g.add(ring);
    }
    // sky beams from the dome
    const beamGeo = new THREE.CylinderGeometry(3, 12, 800, 20, 1, true); beamGeo.translate(0, 400, 0);
    this.domeBeams = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(MEMBERS[i % 5].color).multiplyScalar(0.55), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const b = new THREE.Mesh(beamGeo, m);
      const a = (i / 8) * TAU;
      b.position.set(Math.cos(a) * 90, 40, Math.sin(a) * 90);
      g.add(b); this.domeBeams.push(b);
    }
    g.position.copy(DOME_POS);
    this.group.add(g);
    this.dome = g;
  }

  buildLamps() {
    const N = 64;
    const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 12, 6), mat('chrome', '#e8dcff'), N);
    const stars = new THREE.InstancedMesh(starGeometry(1.4, 0.35, 5, 0.45), new THREE.MeshBasicMaterial({ toneMapped: false }), N);
    const m4 = new THREE.Matrix4();
    const cols = MEMBERS.map((m) => new THREE.Color(m.color).multiplyScalar(2.4));
    for (let i = 0; i < N; i++) {
      const side = i % 2 ? 1 : -1;
      const z = 60 - Math.floor(i / 2) * 26;
      m4.makeTranslation(side * 24, 6, z); poles.setMatrixAt(i, m4);
      m4.makeTranslation(side * 24, 13, z); stars.setMatrixAt(i, m4);
      stars.setColorAt(i, cols[i % 5]);
    }
    this.group.add(poles, stars);
  }

  update(t) {
    this.sky.material.uniforms.uT.value = t;
    this.drawPortraits(t);
    this.train.position.x = ((t * 34) % 1100) - 560;
    for (const q of this.jeeps) {
      const L = 1000;
      const s = ((t * q.speed + q.off) % L);
      if (q.alongZ) { q.j.position.set(q.lane.x, q.lane.y + Math.sin(t * 2 + q.off) * 0.6, q.lane.dir > 0 ? -800 + s : 200 - s); q.j.rotation.y = q.lane.dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
      else { q.j.position.set(q.lane.dir > 0 ? -500 + s : 500 - s, q.lane.y + Math.sin(t * 2 + q.off) * 0.6, q.lane.z); q.j.rotation.y = q.lane.dir > 0 ? 0 : Math.PI; }
    }
    this.holo.rotation.y = Math.sin(t * 0.3) * 0.35;
    this.holo.material.opacity = 0.85 + 0.15 * Math.sin(t * 9);
    this.domeBeams.forEach((b, i) => { b.rotation.z = Math.sin(t * 0.5 + i) * 0.35; b.rotation.x = Math.cos(t * 0.4 + i * 2) * 0.25; });
    this.sparkles.material.opacity = 0.7 + 0.3 * Math.sin(t * 2);
  }
}

// Hover-jeepney: long body, front hood + grille, roof rack, chrome horse ornaments, stripes.
function jeepneyGeometry() {
  const parts = [];
  const add = (g, col) => {
    const c = new THREE.Color(col);
    const a = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); delete g.attributes.uv; parts.push(g);
  };
  const box = (w, h, d, x, y, z, col) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); add(g, col); };
  box(7, 2.4, 3, 0, 0.6, 0, '#ffffff'); // cabin
  box(2.4, 1.4, 2.8, 4.6, 0.1, 0, '#ffffff'); // hood
  box(0.2, 1.2, 2.4, 5.85, 0.1, 0, '#d0d4de'); // grille
  box(7.4, 0.25, 3.3, 0, 1.95, 0, '#d0d4de'); // roof
  box(6.4, 0.5, 2.6, -0.2, 2.3, 0, '#2a1840'); // roof rack
  box(7.1, 0.35, 3.05, 0, 0.0, 0, '#ff3b55'); // stripe
  box(7.1, 0.2, 3.05, 0, 0.45, 0, '#ffd25a'); // stripe
  for (let i = 0; i < 5; i++) box(1.0, 0.8, 3.06, -2.8 + i * 1.3, 1.1, 0, '#3a2a5a'); // windows
  box(0.4, 0.8, 0.2, 5.2, 1.2, 0.6, '#e8eaf0'); box(0.4, 0.8, 0.2, 5.2, 1.2, -0.6, '#e8eaf0'); // horse ornaments
  box(0.3, 0.3, 3.4, 5.9, -0.4, 0, '#e8eaf0'); // bumper
  box(0.15, 0.4, 0.5, 5.95, 0.4, 1.0, '#fff7c0'); box(0.15, 0.4, 0.5, 5.95, 0.4, -1.0, '#fff7c0'); // lights
  return mergeGeos(parts, false);
}

function mergeGeos(geos, withUV) {
  const pos = [], nor = [], col = [], uv = [], idx = [];
  let base = 0;
  for (const g of geos) {
    const ng = g.index ? g : g;
    const p = ng.attributes.position, n = ng.attributes.normal, c = ng.attributes.color, u = ng.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i));
      col.push(c.getX(i), c.getY(i), c.getZ(i));
      if (withUV) uv.push(u.getX(i), u.getY(i));
    }
    for (let i = 0; i < ng.index.count; i++) idx.push(ng.index.getX(i) + base);
    base += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (withUV) out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}
