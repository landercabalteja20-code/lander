// Backstage: pink dressing room with bulb-lit vanity mirrors, a costume rack,
// the five customized mics in a display case, a neon sign and a holographic rehearsal screen.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, canvasTexture, seeded, starGeometry } from './materials.js';
import { MEMBERS } from './members.js';
import { makeMic } from './characters.js';
import { BEAT } from './timeline.js';

const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };

export class Backstage {
  constructor() {
    this.group = new THREE.Group();
    const g = this.group;
    // lights
    g.add(new THREE.HemisphereLight('#ffe0f2', '#6a2a5a', 0.75));
    const key = new THREE.DirectionalLight('#fff0f6', 0.8); key.position.set(2, 6, 8); g.add(key);
    for (const x of [-4.2, -0.6, 3.0]) { const p = new THREE.PointLight('#ffd9b0', 1.1, 6, 0); p.position.set(x, 2.6, -3.6); g.add(p); }
    const soft = new THREE.PointLight('#ff9ad8', 0.8, 10, 0); soft.position.set(0, 3.5, 3); g.add(soft);

    // room
    const floorTex = canvasTexture(256, 256, (c, w, h) => {
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { c.fillStyle = (x + y) % 2 ? '#e9a6c6' : '#f6dbe8'; c.fillRect(x * 64, y * 64, 64, 64); }
    }, { repeat: [7, 5] });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.MeshPhysicalMaterial({ map: floorTex, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 }));
    floor.rotation.x = -Math.PI / 2; g.add(floor);
    const wallTex = canvasTexture(256, 256, (c, w, h) => {
      c.fillStyle = '#e67fae'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(255,255,255,0.22)';
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        const cx = x * 64 + (y % 2) * 32, cy = y * 64 + 32;
        c.beginPath(); c.moveTo(cx, cy - 22); c.bezierCurveTo(cx + 18, cy - 10, cx + 18, cy + 10, cx, cy + 22); c.bezierCurveTo(cx - 18, cy + 10, cx - 18, cy - 10, cx, cy - 22); c.fill();
      }
    }, { repeat: [5, 2] });
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.7 });
    const wall = (w, h, x, y, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); };
    wall(14, 5, 0, 2.5, -5, 0); wall(10, 5, -7, 2.5, 0, Math.PI / 2); wall(10, 5, 7, 2.5, 0, -Math.PI / 2); wall(14, 5, 0, 2.5, 5, Math.PI);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.MeshStandardMaterial({ color: '#ffe6f2' })); ceil.rotation.x = Math.PI / 2; ceil.position.y = 5; g.add(ceil);
    const wains = mat('gloss', '#e9779f');
    for (const [w, x, z, ry] of [[14, 0, -4.98, 0], [10, -6.98, 0, Math.PI / 2], [10, 6.98, 0, -Math.PI / 2]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, 0.06), wains); m.position.set(x, 0.55, z); m.rotation.y = ry; g.add(m); const tr = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 0.1), mat('chrome', '#f2c14e')); tr.position.set(x, 1.12, z); tr.rotation.y = ry; g.add(tr); }

    // vanity stations
    const bulbGeo = new THREE.SphereGeometry(0.075, 12, 8);
    const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.7, 2.2), toneMapped: false });
    const bulbs = [];
    const mirrorMat = new THREE.MeshStandardMaterial({ color: '#f6e9f2', metalness: 1, roughness: 0.04, envMapIntensity: 1.2 });
    const tableMat = mat('gloss', '#ffffff');
    const gold = mat('chrome', '#f2c14e');
    const r = seeded(17);
    for (const x of [-4.2, -0.6, 3.0]) {
      const top = new THREE.Mesh(new RoundedBoxGeometry(2.7, 0.12, 1.0, 2, 0.04), tableMat); top.position.set(x, 0.92, -4.4); g.add(top);
      const front = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.5, 0.9, 2, 0.05), mat('gloss', '#ffc8df')); front.position.set(x, 0.62, -4.45); g.add(front);
      for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.4, 8), gold); leg.position.set(x + s * 1.2, 0.2, -4.1); g.add(leg); }
      const mirror = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.55), mirrorMat); mirror.position.set(x, 2.05, -4.95); g.add(mirror);
      const frame = new THREE.Mesh(new RoundedBoxGeometry(2.45, 1.9, 0.06, 2, 0.04), mat('gloss', '#ffffff')); frame.position.set(x, 2.05, -4.985); g.add(frame);
      for (let i = 0; i < 6; i++) bulbs.push([x - 1.1 + i * 0.44, 2.92, -4.92], [x - 1.1 + i * 0.44, 1.18, -4.92]);
      for (let i = 0; i < 3; i++) bulbs.push([x - 1.15, 1.48 + i * 0.4, -4.92], [x + 1.15, 1.48 + i * 0.4, -4.92]);
      // makeup props
      for (let i = 0; i < 4; i++) {
        const lp = new THREE.Group();
        lp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.13, 12), gold));
        const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.06, 12), mat('gloss', MEMBERS[i].lips.color)); tip.position.y = 0.09; lp.add(tip);
        lp.position.set(x - 0.9 + i * 0.13, 1.05, -4.15); g.add(lp);
      }
      const pal = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.04, 0.32, 2, 0.015), new THREE.MeshStandardMaterial({ map: paletteTexture(r), roughness: 0.4 }));
      pal.position.set(x + 0.4, 1.0, -4.2); pal.rotation.y = 0.2; g.add(pal);
      const bottle = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 14), new THREE.MeshPhysicalMaterial({ color: '#ffc0e0', roughness: 0.05, transmission: 0, transparent: true, opacity: 0.7, clearcoat: 1, iridescence: 1 }));
      bottle.position.set(x + 0.95, 1.08, -4.3); g.add(bottle);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 10), gold); cap.position.set(x + 0.95, 1.22, -4.3); g.add(cap);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.18, 14), mat('pearl', '#fff')); cup.position.set(x - 0.2, 1.06, -4.3); g.add(cup);
      for (let k = 0; k < 4; k++) { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.24, 6), mat('gloss', '#2a1a2a')); br.position.set(x - 0.2 + (k - 1.5) * 0.02, 1.2, -4.3); br.rotation.z = (k - 1.5) * 0.15; g.add(br); }
      // stools
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.12, 20), mat('satin', '#ff8fbf')); stool.position.set(x, 0.62, -3.5); g.add(stool);
      const st2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.56, 8), gold); st2.position.set(x, 0.3, -3.5); g.add(st2);
    }
    const bi = new THREE.InstancedMesh(bulbGeo, bulbMat, bulbs.length);
    const m4 = new THREE.Matrix4();
    bulbs.forEach((p, i) => { m4.makeTranslation(p[0], p[1], p[2]); bi.setMatrixAt(i, m4); });
    g.add(bi);

    // costume rack on the left wall
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 5.4, 10), mat('chrome', '#eef0f6')); rail.rotation.x = Math.PI / 2; rail.position.set(-6.25, 2.5, -0.3); g.add(rail);
    for (const z of [-3, 2.4]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.5, 8), mat('chrome', '#eef0f6')); post.position.set(-6.25, 1.25, z); g.add(post); }
    this.dresses = [];
    for (let i = 0; i < 9; i++) {
      const m = MEMBERS[i % 5];
      const d = new THREE.Group();
      const hanger = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI * 1.5), mat('chrome', '#f2c14e')); hanger.position.y = 0.0; d.add(hanger);
      const body = new THREE.Mesh(new RoundedBoxGeometry(0.12, 1.05, 0.6, 2, 0.05), i % 2 ? mat('sequin', m.outfit.jacket, { metal: 0.5, glow: 1 }) : mat('satin', m.outfit.jacket, { sheen: '#ffffff' }));
      body.position.y = -0.62; d.add(body);
      const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.55, 14, 1, true), mat('satin', m.outfit.bottom)); skirt.position.y = -1.2; skirt.scale.x = 0.35; d.add(skirt);
      d.position.set(-6.25, 2.46, -2.7 + i * 0.6); g.add(d); this.dresses.push(d);
    }
    // mic display case on the right wall
    const caseMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.16, roughness: 0.02, clearcoat: 1, depthWrite: false });
    const cs = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.4, 4.6), caseMat); cs.position.set(6.4, 1.75, -0.4); g.add(cs);
    const base = new THREE.Mesh(new RoundedBoxGeometry(1.05, 1.0, 4.7, 2, 0.04), mat('gloss', '#ffffff')); base.position.set(6.4, 0.5, -0.4); g.add(base);
    const labelTex = (m) => canvasTexture(256, 64, (c, w, h) => { c.fillStyle = '#1a0a24'; c.fillRect(0, 0, w, h); c.fillStyle = m.color; c.font = '700 34px "DM Sans", sans-serif'; c.textAlign = 'center'; c.fillText(m.name, w / 2, 44); });
    MEMBERS.forEach((m, i) => {
      const z = -2.2 + i * 0.9;
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.12, 20), mat('pearl', '#fff')); ped.position.set(6.4, 1.07, z); g.add(ped);
      const glow = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), mat('emissive', m.color, { intensity: 2.5 })); glow.rotation.x = -Math.PI / 2; glow.position.set(6.4, 1.135, z); g.add(glow);
      const mic = makeMic(m.mic); mic.position.set(6.4, 1.27, z); mic.scale.setScalar(1.6); mic.rotation.z = 0.08; g.add(mic);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.125), new THREE.MeshBasicMaterial({ map: labelTex(m), toneMapped: false })); label.position.set(5.86, 0.85, z); label.rotation.y = -Math.PI / 2; g.add(label);
      const spot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.25, 1.2, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(m.color).multiplyScalar(0.5), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      spot.position.set(6.4, 1.8, z); g.add(spot);
    });
    // neon sign
    const neon = canvasTexture(1024, 320, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.font = 'italic 400 190px "Pacifico", "Brush Script MT", cursive'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.shadowColor = '#ff4fb0'; c.shadowBlur = 40; c.strokeStyle = '#ffd0ea'; c.lineWidth = 10; c.strokeText('Hiraya', w / 2 - 60, h / 2);
      c.shadowBlur = 20; c.fillStyle = '#fff4fb'; c.fillText('Hiraya', w / 2 - 60, h / 2);
      c.shadowColor = '#ff2a6a'; c.shadowBlur = 30; c.strokeStyle = '#ff7aa8'; c.lineWidth = 12;
      const hx = w - 150, hy = h / 2;
      c.beginPath(); c.moveTo(hx, hy + 60); c.bezierCurveTo(hx - 90, hy, hx - 60, hy - 70, hx, hy - 25); c.bezierCurveTo(hx + 60, hy - 70, hx + 90, hy, hx, hy + 60); c.stroke();
    });
    this.neon = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.62), new THREE.MeshBasicMaterial({ map: neon, transparent: true, toneMapped: false, color: new THREE.Color(1.8, 1.8, 1.8), depthWrite: false }));
    this.neon.position.set(-0.6, 4.05, -4.94); g.add(this.neon);
    // holographic rehearsal screen
    this.holoC = document.createElement('canvas'); this.holoC.width = 512; this.holoC.height = 300;
    this.holoT = new THREE.CanvasTexture(this.holoC); this.holoT.colorSpace = THREE.SRGBColorSpace;
    this.holo = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.52), new THREE.MeshBasicMaterial({ map: this.holoT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.holo.position.set(4.6, 2.4, -3.2); this.holo.rotation.y = -0.7; g.add(this.holo);
    // sofa + coffee table + bouquet + halo-halo
    const velvet = mat('satin', '#ff7fb5', { sheen: '#ffd0e8' });
    const sofa = new THREE.Group();
    sofa.add(at(new THREE.Mesh(new RoundedBoxGeometry(2.8, 0.45, 1.0, 3, 0.18), velvet), 0, 0.35, 0));
    sofa.add(at(new THREE.Mesh(new RoundedBoxGeometry(2.8, 0.8, 0.3, 3, 0.14), velvet), 0, 0.75, -0.4));
    for (const s of [-1, 1]) sofa.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.6, 1.0, 3, 0.12), velvet), s * 1.4, 0.55, 0));
    sofa.position.set(-4.6, 0, 2.2); sofa.rotation.y = 0.9; g.add(sofa);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 32), mat('gloss', '#ffffff')); table.position.set(-3.2, 0.5, 3.2); g.add(table);
    const tl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.5, 10), gold); tl.position.set(-3.2, 0.25, 3.2); g.add(tl);
    const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.3, 14), mat('pearl', '#fff')); vase.position.set(-3.3, 0.68, 3.2); g.add(vase);
    for (let i = 0; i < 9; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), mat('satin', i % 3 ? '#ff8fbf' : '#ffffff')); f.position.set(-3.3 + Math.cos(i * 2.4) * 0.12, 0.92 + (i % 3) * 0.05, 3.2 + Math.sin(i * 2.4) * 0.12); g.add(f); }
    for (let i = 0; i < 3; i++) { const hh = haloHalo(); hh.position.set(-3.0 + i * 0.16, 0.53, 3.35 - i * 0.1); g.add(hh); }
    // a giant HIRAYA tour poster on the right of the back wall
    const poster = canvasTexture(400, 560, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a0b4a'); gr.addColorStop(1, '#ff8fbf'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = '400 76px "Bagel Fat One", "Arial Black", sans-serif'; c.fillText('HIRAYA', w / 2, 110);
      c.font = '700 26px "DM Sans", sans-serif'; c.fillText('WORLD TOUR 2026', w / 2, 152);
      const cities = ['MANILA', 'CEBU', 'DAVAO', 'TOKYO', 'SEOUL', 'PARIS', 'LAGOS', 'RIO', 'NEW YORK', 'THE MOON'];
      c.font = '600 24px "DM Sans", sans-serif'; cities.forEach((s, i) => { c.fillStyle = i === 9 ? '#ffd25a' : 'rgba(255,255,255,0.9)'; c.fillText(s + (i === 9 ? ' (TBA)' : '  ·  SOLD OUT'), w / 2, 210 + i * 32); });
    });
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.68), new THREE.MeshStandardMaterial({ map: poster, roughness: 0.5, emissive: '#ffffff', emissiveMap: poster, emissiveIntensity: 0.25 }));
    pm.position.set(5.6, 2.3, -4.96); g.add(pm);

    // Tala's halo-halo + spoon (attached to her hands while backstage)
    this.taleCup = haloHalo(1.1);
    this.spoon = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), mat('chrome', '#eef0f6'));
  }

  attachProps(chars) {
    const tala = chars.tala;
    tala.j.wristL.add(this.taleCup); this.taleCup.position.set(0, -0.08, 0.06); this.taleCup.rotation.x = 1.2;
    tala.j.wristR.add(this.spoon); this.spoon.position.set(0, -0.08, 0.05); this.spoon.rotation.x = 1.0;
  }

  update(t, propsOn) {
    this.taleCup.visible = propsOn; this.spoon.visible = propsOn;
    this.dresses.forEach((d, i) => (d.rotation.y = Math.sin(t * 0.7 + i) * 0.05));
    const c = this.holoC.getContext('2d');
    const W = this.holoC.width, H = this.holoC.height;
    c.clearRect(0, 0, W, H);
    c.strokeStyle = 'rgba(127,212,255,0.9)'; c.lineWidth = 2; c.strokeRect(4, 4, W - 8, H - 8);
    c.fillStyle = 'rgba(127,212,255,0.12)'; c.fillRect(4, 4, W - 8, H - 8);
    c.font = '700 22px "DM Sans", sans-serif'; c.fillStyle = '#c9f0ff'; c.fillText('REHEARSAL · FORMATION B', 18, 34);
    c.fillStyle = '#ff9ad8'; c.fillText('SYNC 99.8%', W - 160, 34);
    const beat = t / BEAT;
    for (let i = 0; i < 5; i++) {
      const x = 70 + i * 92, y = 200;
      const s = Math.sin(Math.PI * beat + i * 0.4);
      c.strokeStyle = MEMBERS[i].color; c.lineWidth = 5; c.lineCap = 'round';
      c.beginPath(); c.arc(x, y - 78, 14, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(x, y - 62); c.lineTo(x + s * 6, y - 10); c.stroke();
      c.beginPath(); c.moveTo(x, y - 50); c.lineTo(x - 30, y - 60 - 30 * Math.max(0, s)); c.moveTo(x, y - 50); c.lineTo(x + 30, y - 60 - 30 * Math.max(0, -s)); c.stroke();
      c.beginPath(); c.moveTo(x + s * 6, y - 10); c.lineTo(x - 18, y + 40); c.moveTo(x + s * 6, y - 10); c.lineTo(x + 18, y + 40); c.stroke();
    }
    for (let y = 8; y < H; y += 5) { c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(4, y, W - 8, 1.5); }
    this.holoT.needsUpdate = true;
    this.neon.material.color.setScalar(1.6 + 0.25 * Math.sin(t * 13) * Math.sin(t * 3.1));
  }
}

function paletteTexture(r) {
  return canvasTexture(128, 80, (c, w, h) => {
    c.fillStyle = '#1a1018'; c.fillRect(0, 0, w, h);
    const cols = ['#ff8fbf', '#a66bff', '#7fd4ff', '#ffd25a', '#ff3b55', '#f3d9a8', '#e8b98a', '#9b4dff'];
    for (let y = 0; y < 2; y++) for (let x = 0; x < 4; x++) { c.fillStyle = cols[y * 4 + x]; c.beginPath(); c.arc(18 + x * 31, 22 + y * 36, 12, 0, Math.PI * 2); c.fill(); }
  });
}

// Halo-halo: layered Filipino dessert in a tall glass with an ube scoop on top.
function haloHalo(scale = 1) {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.16, 16, 1, true), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }));
  glass.position.y = 0.08; g.add(glass);
  const layers = [['#7a2a3a', 0.03], ['#ffe08a', 0.025], ['#ff9ac0', 0.025], ['#ffffff', 0.04]];
  let y = 0.005;
  for (const [col, h] of layers) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.046, h, 14), mat('satin', col)); l.position.y = y + h / 2; g.add(l); y += h; }
  const ube = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), mat('satin', '#8a4bd6')); ube.position.y = y + 0.025; g.add(ube);
  const flan = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.02, 12), mat('gloss', '#f2b14e')); flan.position.set(0.02, y + 0.06, 0.01); g.add(flan);
  g.scale.setScalar(scale);
  return g;
}
