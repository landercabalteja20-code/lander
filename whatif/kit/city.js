// Low-poly city pieces (matching the reference look): window-grid buildings, water towers, cars,
// streetlights, trees, a strip mall with signs, and a wet parking lot.
import * as THREE from 'three';
import { rng, std, canvasTexture, textTexture } from './util.js';

export function windowTexture({ wall = '#c9b89a', win = '#3c4652', lit = '#ffd890', litChance = 0.0, cols = 8, rows = 16, seed = 1, night = false } = {}) {
  const R = rng(seed);
  return canvasTexture(256, 512, (g, w, h) => {
    g.fillStyle = wall; g.fillRect(0, 0, w, h);
    const cw = w / cols, rh = h / rows;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const on = R() < litChance;
      g.fillStyle = on ? lit : win;
      if (on && night) { g.shadowColor = lit; g.shadowBlur = 6; } else g.shadowBlur = 0;
      g.fillRect(x * cw + cw * 0.2, y * rh + rh * 0.22, cw * 0.6, rh * 0.56);
    }
  });
}

export function createBuilding({ w = 20, h = 60, d = 20, style = 'beige', seed = 1, night = false, litChance = 0.5 } = {}) {
  const styles = {
    beige: { wall: '#d8c9a8', win: '#56606c' }, brick: { wall: '#9c4a36', win: '#2e3540' }, grey: { wall: '#9aa0a6', win: '#4a525c' },
    glass: { wall: '#6f8496', win: '#9db4c8' }, dark: { wall: '#2a2d35', win: '#14161c' },
  };
  const s = styles[style] || styles.beige;
  const tex = windowTexture({ ...s, cols: Math.max(3, Math.round(w / 3)), rows: Math.max(4, Math.round(h / 3.4)), seed, night, litChance: night ? litChance : 0 });
  const side = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, emissive: night ? '#ffffff' : '#000000', emissiveMap: night ? tex : null, emissiveIntensity: night ? 0.55 : 0 });
  const top = std(new THREE.Color(s.wall).multiplyScalar(0.7));
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, top, top, side, side]);
  m.position.y = h / 2;
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function createWaterTower() {
  const g = new THREE.Group();
  const wood = std('#6b4a32', { roughness: 0.9 });
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 3, 12), wood); tank.position.y = 3.5; g.add(tank);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.75, 1.3, 12), std('#3a2a20')); roof.position.y = 5.65; g.add(roof);
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2, 5), std('#222')); l.position.set(x, 1, z); g.add(l); }
  return g;
}

export function createCar({ color = '#e8b81c', seed = 1, lights = false } = {}) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 4.2), paint); body.position.y = 0.6; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 2.2), paint); cab.position.set(0, 1.15, -0.2); g.add(cab);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.4, 2.0), new THREE.MeshStandardMaterial({ color: '#1b2430', roughness: 0.05, metalness: 0.8 })); glass.position.set(0, 1.18, -0.2); g.add(glass);
  for (const [x, z] of [[0.85, 1.3], [-0.85, 1.3], [0.85, -1.3], [-0.85, -1.3]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 12), std('#111')); w.rotation.z = Math.PI / 2; w.position.set(x, 0.36, z); g.add(w);
  }
  if (lights) {
    const hl = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4d6').multiplyScalar(3) });
    for (const x of [0.6, -0.6]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.05), hl); l.position.set(x, 0.7, 2.11); g.add(l); }
  }
  const tl = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a2a').multiplyScalar(lights ? 2.5 : 0.8) });
  for (const x of [0.65, -0.65]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.05), tl); l.position.set(x, 0.72, -2.11); g.add(l); }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function createStreetLight({ height = 7, arm = 1.8, color = '#ffcf8a', pointLight = true, intensity = 30 } = {}) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, height, 8), std('#3a3d42', { metalness: 0.6, roughness: 0.5 })); pole.position.y = height / 2; g.add(pole);
  const a = new THREE.Mesh(new THREE.BoxGeometry(arm, 0.1, 0.1), std('#3a3d42')); a.position.set(arm / 2, height, 0); g.add(a);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.35), std('#2a2c30')); head.position.set(arm, height - 0.05, 0); g.add(head);
  const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.25), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(4) })); bulb.position.set(arm, height - 0.16, 0); g.add(bulb);
  if (pointLight) {
    const l = new THREE.PointLight(color, intensity, 22, 1.6); l.position.set(arm, height - 0.5, 0); g.add(l);
  }
  return g;
}

export function createTree({ size = 1, color = '#2f6b33' } = {}) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * size, 0.18 * size, 1.6 * size, 6), std('#5a3c26')); trunk.position.y = 0.8 * size; g.add(trunk);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2 * size, 0), new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true })); crown.position.y = 2.3 * size; g.add(crown);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// Strip mall facade with lit shop signs. Origin at ground, facade facing +Z.
export function createStripMall({ shops = [['COIN LAUNDRY', '#9fe3ff'], ['TAX PREP', '#ffffff'], ['PIZZA · SUBS', '#ff6a4a'], ['MATTRESS SALE', '#ffd84a'], ['NAILS', '#ff8ad8']], width = 60, height = 6, seed = 3 } = {}) {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, 12), std('#b9ab95', { roughness: 0.95 }));
  wall.position.set(0, height / 2, -6); wall.receiveShadow = true; g.add(wall);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(width, 0.35, 2.4), std('#6f665a')); canopy.position.set(0, height - 1.6, 1.0); g.add(canopy);
  const shopW = width / shops.length;
  shops.forEach(([name, col], i) => {
    const x = -width / 2 + shopW * (i + 0.5);
    const glassTex = canvasTexture(256, 128, (gg, w, h) => { const gr = gg.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2b3a44'); gr.addColorStop(1, '#ffe8b8'); gg.fillStyle = gr; gg.fillRect(0, 0, w, h); gg.fillStyle = 'rgba(0,0,0,0.5)'; gg.fillRect(w * 0.48, 0, w * 0.04, h); });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(shopW * 0.8, 2.6), new THREE.MeshStandardMaterial({ map: glassTex, emissive: '#ffffff', emissiveMap: glassTex, emissiveIntensity: i === 3 ? 0.15 : 0.7, roughness: 0.1 }));
    glass.position.set(x, 1.4, 0.02); g.add(glass);
    const signTex = textTexture(name, { w: 1024, h: 160, bg: '#121418', fg: col, font: '800 96px Inter' });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(shopW * 0.8, shopW * 0.8 * 160 / 1024), new THREE.MeshStandardMaterial({ map: signTex, emissive: '#ffffff', emissiveMap: signTex, emissiveIntensity: i === 3 ? 0.4 : 1.8 }));
    sign.position.set(x, height - 0.8, 0.03); g.add(sign);
  });
  return g;
}

// Parking lot: wet asphalt with lines. Origin centre.
export function createParkingLot({ w = 80, d = 60, wet = true } = {}) {
  const g = new THREE.Group();
  const R = rng(4);
  const tex = canvasTexture(1024, 1024, (gg, W, H) => {
    gg.fillStyle = '#2a2b2e'; gg.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) { const v = 30 + R() * 30; gg.fillStyle = `rgb(${v},${v},${v + 3})`; gg.fillRect(R() * W, R() * H, 2, 2); }
    // puddles darker
    for (let i = 0; i < 30; i++) { gg.fillStyle = 'rgba(10,12,16,0.45)'; gg.beginPath(); gg.ellipse(R() * W, R() * H, 20 + R() * 60, 10 + R() * 30, R() * 3, 0, Math.PI * 2); gg.fill(); }
    // stall lines
    gg.strokeStyle = 'rgba(235,235,225,0.85)'; gg.lineWidth = 5;
    for (let row = 0; row < 3; row++) {
      const y0 = 140 + row * 300;
      for (let x = 20; x < W; x += 48) { gg.beginPath(); gg.moveTo(x, y0); gg.lineTo(x, y0 + 110); gg.stroke(); }
    }
  });
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: wet ? 0.18 : 0.9, metalness: wet ? 0.35 : 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  g.add(ground);
  return g;
}

// A free-standing sign on two posts (e.g. "EVENT PARKING $12")
export function createPostSign(lines, { w = 2.4, h = 1.4, bg = '#f2f2ec', fg = '#1b1b1b', post = 2.2 } = {}) {
  const g = new THREE.Group();
  const tex = textTexture(lines, { w: 1024, h: Math.round(1024 * h / w), bg, fg, font: '800 150px Inter', border: '#1b1b1b' });
  const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), [std(bg), std(bg), std(bg), std(bg), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), std('#9aa0a6')]);
  board.position.y = post + h / 2; g.add(board);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, post + h * 0.9, 6), std('#6a6d72', { metalness: 0.7 })); p.position.set(s * w * 0.35, (post + h * 0.9) / 2, -0.04); g.add(p); }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
