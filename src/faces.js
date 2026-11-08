// 2D anime/fashion-doll face painter. Draws eyes, lashes, shimmer shadow,
// brows and glossy lips onto a transparent canvas used as a decal on each 3D head.
// The same painter also draws full portraits for billboards and LED screens.

function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const DEFAULT_FACE = {
  blinkL: 0, blinkR: 0, happy: 0,
  lookX: 0, lookY: 0,
  brow: 0, browTilt: 0,
  open: 0, wide: 1, round: 0, smile: 0.4, teeth: 0,
  sparkle: 0, time: 0,
};

export class FacePainter {
  constructor(member, size = 512) {
    this.m = member;
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d');
    const r = seeded(member.id.length * 977 + member.id.charCodeAt(0));
    this.dots = Array.from({ length: 26 }, () => ({ x: r() * 2 - 1, y: r(), s: 0.5 + r(), p: r() * 6.28 }));
    this.last = '';
  }

  // Returns true when the canvas changed.
  paint(f) {
    const key = [f.blinkL, f.blinkR, f.happy, f.lookX, f.lookY, f.brow, f.browTilt, f.open, f.wide, f.round, f.smile, f.sparkle].map((v) => Math.round(v * 40)).join(',') + '|' + Math.floor(f.time * 8);
    if (key === this.last) return false;
    this.last = key;
    const c = this.ctx, S = this.size;
    c.clearRect(0, 0, S, S);
    c.save();
    c.scale(S / 512, S / 512);
    drawFeatures(c, this.m, f, this.dots);
    c.restore();
    return true;
  }
}

// Features in a 512×512 frame. Eyes on y≈256, mouth on y≈405.
export function drawFeatures(c, m, f, dots) {
  const E = m.eye;
  // blush
  for (const sx of [-1, 1]) {
    c.save(); c.translate(256 + sx * 122, 336); c.scale(1.5, 0.8);
    const g = c.createRadialGradient(0, 0, 2, 0, 0, 42);
    g.addColorStop(0, hexA(m.blush, 0.3)); g.addColorStop(0.6, hexA(m.blush, 0.12)); g.addColorStop(1, hexA(m.blush, 0));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 42, 0, Math.PI * 2); c.fill(); c.restore();
  }
  // nose
  c.strokeStyle = hexA(m.skinShade, 0.75); c.lineWidth = 3.2; c.lineCap = 'round';
  c.beginPath(); c.moveTo(247, 338); c.quadraticCurveTo(256, 345, 265, 338); c.stroke();

  const blinks = [f.blinkR, f.blinkL]; // viewer-left eye is the character's right eye
  for (let side = 0; side < 2; side++) {
    const sx = side === 0 ? -1 : 1;
    c.save();
    c.translate(256 + sx * 86, 258);
    c.scale(-sx, 1); // local +x points toward the nose
    drawEye(c, m, E, side === 0 ? f : { ...f, lookX: -f.lookX }, blinks[side], dots, side);
    c.restore();
  }
  drawMouth(c, m, f);
}

function drawEye(c, m, E, f, blink, dots, side) {
  const U = 46; // unit
  const tilt = E.tilt;
  const H = E.height;
  const close = Math.min(1, Math.max(blink, f.happy));
  const openK = 1 - close;

  // eyeshadow with shimmer
  c.save();
  const sg = c.createRadialGradient(-0.15 * U, -0.5 * U, 4, -0.15 * U, -0.6 * U, 1.65 * U);
  sg.addColorStop(0, hexA(E.shadow, 0.95)); sg.addColorStop(0.55, hexA(E.shadow2, 0.55)); sg.addColorStop(1, hexA(E.shadow2, 0));
  c.fillStyle = sg;
  c.beginPath(); c.ellipse(-0.2 * U, -0.55 * U, 1.75 * U, 1.05 * U * H, -tilt * 0.6, Math.PI * 0.98, Math.PI * 2.02); c.closePath(); c.fill();
  for (const d of dots) {
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(f.time * 2.2 * d.s + d.p + side));
    c.fillStyle = hexA(E.shimmer, 0.75 * tw);
    const x = d.x * 1.4 * U - 0.15 * U, y = -0.35 * U - d.y * 0.9 * U * H;
    c.beginPath(); c.arc(x, y, 1.1 + 1.6 * d.s * tw, 0, Math.PI * 2); c.fill();
  }
  c.restore();

  // eye outline points (x from -1 outer to +1 inner)
  const oc = [-1.05 * U, -tilt * U - 0.05 * U];
  const ic = [1.0 * U, 0.12 * U];
  const top = -1.08 * U * H;
  const upY = (k) => top * k + (1 - k) * 0.42 * U;

  if (close > 0.82) {
    // closed or happy (^ ^) eye
    c.strokeStyle = '#120a0c'; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath();
    if (f.happy > 0.5) {
      c.moveTo(oc[0], oc[1] + 0.25 * U); c.quadraticCurveTo(0, -0.75 * U, ic[0], ic[1] + 0.15 * U);
    } else {
      c.moveTo(oc[0], oc[1]); c.quadraticCurveTo(0, 0.6 * U, ic[0], ic[1]);
    }
    c.stroke();
    // lashes on the closed lid
    c.lineWidth = 3.2;
    for (let i = 0; i < 4; i++) {
      const u = 0.12 + i * 0.13;
      const x = oc[0] + (ic[0] - oc[0]) * u;
      const y = f.happy > 0.5 ? oc[1] + 0.2 * U - Math.sin(u * Math.PI) * 0.62 * U : oc[1] + Math.sin(u * Math.PI) * 0.42 * U;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - 0.25 * U, y + (f.happy > 0.5 ? -0.2 : 0.25) * U, x - 0.42 * U, y + (f.happy > 0.5 ? -0.12 : 0.45) * U); c.stroke();
    }
    wing(c, oc, U, tilt, E);
    drawBrow(c, m, f, U, H);
    return;
  }

  const uy = upY(openK);
  const pathEye = () => {
    c.beginPath();
    c.moveTo(oc[0], oc[1]);
    c.bezierCurveTo(-0.55 * U, uy - 0.05 * U, 0.45 * U, uy + 0.02 * U, ic[0], ic[1]);
    c.bezierCurveTo(0.5 * U, 0.68 * U, -0.5 * U, 0.62 * U, oc[0], oc[1]);
    c.closePath();
  };
  // sclera
  c.save();
  pathEye();
  c.fillStyle = '#fffaf8'; c.fill();
  c.clip();
  // iris
  const ix = f.lookX * 0.32 * U + 0.05 * U, iy = 0.1 * U + f.lookY * 0.22 * U;
  const R = 0.68 * U;
  const ig = c.createRadialGradient(ix, iy + R * 0.35, R * 0.1, ix, iy, R);
  ig.addColorStop(0, E.irisLight); ig.addColorStop(0.62, E.iris); ig.addColorStop(1, '#120808');
  c.fillStyle = ig; c.beginPath(); c.arc(ix, iy, R, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#0b0507'; c.beginPath(); c.ellipse(ix, iy + 0.02 * U, R * 0.42, R * 0.46, 0, 0, Math.PI * 2); c.fill();
  // ring
  c.strokeStyle = hexA(E.irisLight, 0.6); c.lineWidth = 2; c.beginPath(); c.arc(ix, iy, R * 0.72, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
  // lid shadow
  const lg = c.createLinearGradient(0, uy, 0, uy + 0.7 * U);
  lg.addColorStop(0, 'rgba(60,20,40,0.55)'); lg.addColorStop(1, 'rgba(60,20,40,0)');
  c.fillStyle = lg; c.fillRect(-1.2 * U, uy - 0.1 * U, 2.4 * U, 0.9 * U);
  // highlights
  c.fillStyle = '#ffffff';
  c.beginPath(); c.ellipse(ix - 0.28 * U, iy - 0.3 * U, 0.2 * U, 0.16 * U, -0.4, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(ix + 0.28 * U, iy + 0.28 * U, 0.09 * U, 0, Math.PI * 2); c.fill();
  if (f.sparkle > 0.1) star(c, ix + 0.18 * U, iy - 0.12 * U, 0.16 * U * f.sparkle, 'rgba(255,255,255,0.95)');
  c.restore();

  // upper lash line (thick, glossy black)
  c.strokeStyle = '#100709'; c.lineCap = 'round'; c.lineJoin = 'round';
  c.lineWidth = 7.5;
  c.beginPath(); c.moveTo(oc[0], oc[1]); c.bezierCurveTo(-0.55 * U, uy - 0.05 * U, 0.45 * U, uy + 0.02 * U, ic[0], ic[1]); c.stroke();
  wing(c, oc, U, tilt, E);
  // lashes
  c.lineWidth = 3.4;
  for (let i = 0; i < 6; i++) {
    const u = 0.04 + i * 0.12;
    const p = bez([oc[0], oc[1]], [-0.55 * U, uy - 0.05 * U], [0.45 * U, uy + 0.02 * U], [ic[0], ic[1]], u);
    const len = (0.62 - i * 0.07) * U;
    c.beginPath(); c.moveTo(p[0], p[1]);
    c.quadraticCurveTo(p[0] - 0.12 * U, p[1] - len * 0.6, p[0] - len * 0.75, p[1] - len * 0.85); c.stroke();
  }
  // lower lid + lower lashes
  c.strokeStyle = 'rgba(40,16,22,0.55)'; c.lineWidth = 2.2;
  c.beginPath(); c.moveTo(ic[0] - 0.1 * U, ic[1] + 0.05 * U); c.bezierCurveTo(0.5 * U, 0.68 * U, -0.5 * U, 0.62 * U, oc[0] + 0.05 * U, oc[1] + 0.05 * U); c.stroke();
  c.strokeStyle = '#1a0c10'; c.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const x = -0.85 * U + i * 0.28 * U, y = 0.45 * U + i * 0.06 * U;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - 0.12 * U, y + 0.2 * U); c.stroke();
  }
  // double crease
  c.strokeStyle = hexA(m.skinShade, 0.6); c.lineWidth = 2;
  c.beginPath(); c.moveTo(oc[0] + 0.15 * U, oc[1] - 0.25 * U); c.quadraticCurveTo(0, uy - 0.42 * U, ic[0] - 0.1 * U, ic[1] - 0.35 * U); c.stroke();
  drawBrow(c, m, f, U, H);
}

function wing(c, oc, U, tilt, E) {
  c.fillStyle = '#100709';
  c.beginPath();
  c.moveTo(oc[0] + 0.25 * U, oc[1] - 0.18 * U);
  c.quadraticCurveTo(oc[0] - 0.2 * U, oc[1] - 0.1 * U, oc[0] - (E.liner ? 0.75 : 0.42) * U, oc[1] - (E.liner ? 0.62 : 0.4) * U - tilt * 0.3 * U);
  c.quadraticCurveTo(oc[0] - 0.05 * U, oc[1] + 0.08 * U, oc[0] + 0.3 * U, oc[1] + 0.02 * U);
  c.closePath(); c.fill();
  if (E.liner) {
    // graphic double liner
    c.strokeStyle = hexA(E.shadow, 1); c.lineWidth = 3;
    c.beginPath(); c.moveTo(oc[0] + 0.6 * U, oc[1] - 0.55 * U); c.quadraticCurveTo(oc[0] - 0.1 * U, oc[1] - 0.5 * U, oc[0] - 0.95 * U, oc[1] - 1.0 * U); c.stroke();
  }
}

function drawBrow(c, m, f, U, H) {
  const lift = f.brow * 0.35 * U;
  const tiltIn = f.browTilt * 0.3 * U; // + = angry (inner down)
  c.fillStyle = m.brow;
  c.beginPath();
  const y0 = -1.95 * U * Math.max(0.9, H) - lift;
  c.moveTo(1.0 * U, y0 + 0.25 * U + tiltIn);
  c.quadraticCurveTo(-0.1 * U, y0 - 0.55 * U - lift * 0.3, -1.25 * U, y0 + 0.2 * U - tiltIn * 0.4);
  c.quadraticCurveTo(-0.1 * U, y0 - 0.3 * U - lift * 0.3, 1.0 * U, y0 + 0.08 * U + tiltIn);
  c.closePath(); c.fill();
}

function drawMouth(c, m, f) {
  const U = 74;
  const cx = 256, cy = 404;
  const open = Math.max(0, Math.min(1, f.open));
  const round = f.round;
  const w = 0.82 * U * f.wide * (1 - 0.32 * round) * (1 + 0.08 * f.smile);
  const h = open * 0.95 * U * (1 + 0.25 * round);
  const cyc = -f.smile * 0.2 * U + open * 0.05 * U; // corner height
  const tu = 0.19 * U, tl = 0.29 * U;
  const L = m.lips;
  c.save();
  c.translate(cx, cy);
  const kx = 0.78 - 0.25 * round;

  const innerTop = () => { c.moveTo(-w, cyc); c.bezierCurveTo(-w * kx, -h * 0.55, w * kx, -h * 0.55, w, cyc); };
  const innerBot = () => { c.bezierCurveTo(w * kx, h * 0.72 + 0.02 * U, -w * kx, h * 0.72 + 0.02 * U, -w, cyc); };

  // mouth interior
  if (h > 1.5) {
    c.beginPath(); innerTop(); innerBot(); c.closePath();
    c.fillStyle = '#3d0c1c'; c.fill();
    c.save(); c.clip();
    if (open > 0.22) { c.fillStyle = '#fbf6f4'; c.beginPath(); c.ellipse(0, -h * 0.5, w * 0.62, 0.17 * U, 0, 0, Math.PI * 2); c.fill(); }
    if (open > 0.4) { c.fillStyle = '#d4566f'; c.beginPath(); c.ellipse(0, h * 0.62, w * 0.52, h * 0.32, 0, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }
  const lg = c.createLinearGradient(0, -h * 0.5 - tu, 0, h * 0.7 + tl);
  lg.addColorStop(0, L.dark); lg.addColorStop(0.35, L.color); lg.addColorStop(1, L.color);
  // upper lip
  c.beginPath();
  c.moveTo(-w, cyc);
  c.quadraticCurveTo(-w * 0.6, -h * 0.45 - tu * 0.9, -w * 0.24, -h * 0.5 - tu * 1.05);
  c.quadraticCurveTo(-w * 0.08, -h * 0.5 - tu * 1.0, 0, -h * 0.5 - tu * 0.68);
  c.quadraticCurveTo(w * 0.08, -h * 0.5 - tu * 1.0, w * 0.24, -h * 0.5 - tu * 1.05);
  c.quadraticCurveTo(w * 0.6, -h * 0.45 - tu * 0.9, w, cyc);
  c.bezierCurveTo(w * kx, -h * 0.55, -w * kx, -h * 0.55, -w, cyc);
  c.closePath();
  c.fillStyle = lg; c.fill();
  // lower lip
  c.beginPath();
  c.moveTo(w, cyc);
  c.bezierCurveTo(w * 0.72, h * 0.72 + tl * 1.25, -w * 0.72, h * 0.72 + tl * 1.25, -w, cyc);
  c.bezierCurveTo(-w * kx, h * 0.72 + 0.02 * U, w * kx, h * 0.72 + 0.02 * U, w, cyc);
  c.closePath();
  c.fillStyle = lg; c.fill();
  // seam when closed
  if (h <= 1.5) {
    c.strokeStyle = hexA(L.dark, 0.95); c.lineWidth = 2.6;
    c.beginPath(); c.moveTo(-w, cyc); c.quadraticCurveTo(0, 0.07 * U, w, cyc); c.stroke();
  }
  // gloss
  c.fillStyle = `rgba(255,255,255,${0.35 + 0.4 * L.gloss})`;
  c.beginPath(); c.ellipse(w * 0.18, h * 0.62 + tl * 0.62, w * 0.3, tl * 0.2, -0.1, 0, Math.PI * 2); c.fill();
  c.fillStyle = `rgba(255,255,255,${0.25 + 0.3 * L.gloss})`;
  c.beginPath(); c.ellipse(-w * 0.32, -h * 0.5 - tu * 0.55, w * 0.14, tu * 0.18, 0.2, 0, Math.PI * 2); c.fill();
  // smile dimples
  if (f.smile > 0.3) {
    c.strokeStyle = hexA(m.skinShade, 0.5); c.lineWidth = 2;
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * (w + 4), cyc - 6); c.quadraticCurveTo(s * (w + 9), cyc, s * (w + 5), cyc + 7); c.stroke(); }
  }
  c.restore();
}

function bez(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
}
export function star(c, x, y, r, color, points = 4) {
  c.fillStyle = color; c.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.28;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath(); c.fill();
}
export function hexA(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---- Portrait: full 2D head with hair, for billboards and screens ----
export function drawPortrait(c, m, x, y, size, f) {
  const s = size / 512;
  c.save();
  c.translate(x, y); c.scale(s, s); c.translate(-256, -256);
  const H = m.hair;
  // back hair
  c.fillStyle = H.color;
  if (H.style === 'braids') {
    for (const sx of [-1, 1]) for (let i = 0; i < 9; i++) { c.beginPath(); c.ellipse(256 + sx * (150 + (i % 2) * 8), 330 + i * 34, 30, 22, sx * 0.4, 0, Math.PI * 2); c.fill(); }
  }
  if (H.style === 'ponytail') { c.beginPath(); c.ellipse(390, 120, 70, 110, 0.6, 0, Math.PI * 2); c.fill(); }
  if (H.style === 'bubbles') for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) { c.fillStyle = i === 3 ? H.accent : H.color; c.beginPath(); c.arc(256 + sx * (205 + i * 10), 170 + i * 66, 46 - i * 6, 0, Math.PI * 2); c.fill(); }
  if (H.style === 'buns') { c.fillStyle = H.color; c.fillRect(110, 200, 292, 260); for (const sx of [-1, 1]) { c.beginPath(); c.arc(256 + sx * 120, 70, 62, 0, Math.PI * 2); c.fill(); c.strokeStyle = H.accent; c.lineWidth = 12; c.beginPath(); c.arc(256 + sx * 120, 70, 44, 0.3, 4.2); c.stroke(); } }
  if (H.style === 'wolf') { c.beginPath(); c.ellipse(256, 250, 215, 230, 0, 0, Math.PI * 2); c.fill(); }
  // neck + face
  c.fillStyle = m.skinShade; c.fillRect(214, 420, 84, 100);
  c.fillStyle = m.skin;
  c.beginPath();
  c.moveTo(256, 492);
  c.bezierCurveTo(150, 470, 92, 360, 96, 250);
  c.bezierCurveTo(100, 110, 180, 60, 256, 60);
  c.bezierCurveTo(332, 60, 412, 110, 416, 250);
  c.bezierCurveTo(420, 360, 362, 470, 256, 492);
  c.fill();
  drawFeatures(c, m, f, PORTRAIT_DOTS);
  // front hair / bangs
  c.fillStyle = H.color;
  c.beginPath();
  if (H.style === 'ponytail') { c.moveTo(92, 250); c.bezierCurveTo(90, 60, 420, 40, 420, 250); c.bezierCurveTo(400, 120, 300, 100, 256, 112); c.bezierCurveTo(200, 100, 110, 130, 92, 250); }
  else if (H.style === 'wolf') { c.moveTo(80, 300); c.bezierCurveTo(60, 40, 450, 40, 432, 300); c.lineTo(400, 200); c.lineTo(350, 165); c.lineTo(300, 175); c.lineTo(256, 140); c.lineTo(212, 175); c.lineTo(160, 165); c.lineTo(112, 200); c.closePath(); }
  else if (H.style === 'buns') { c.moveTo(92, 260); c.bezierCurveTo(80, 50, 432, 50, 420, 260); c.lineTo(390, 170); c.lineTo(340, 150); c.lineTo(300, 165); c.lineTo(256, 150); c.lineTo(212, 165); c.lineTo(170, 150); c.lineTo(122, 170); c.closePath(); }
  else { c.moveTo(90, 270); c.bezierCurveTo(80, 50, 432, 50, 422, 270); c.bezierCurveTo(400, 150, 330, 140, 256, 150); c.bezierCurveTo(180, 140, 112, 150, 90, 270); }
  c.fill();
  if (H.style === 'bubbles') { c.fillStyle = H.accent; c.fillRect(150, 118, 30, 70); c.fillRect(332, 118, 30, 70); }
  // sheen
  c.strokeStyle = hexA(H.sheen, 0.5); c.lineWidth = 10; c.lineCap = 'round';
  c.beginPath(); c.arc(256, 210, 150, Math.PI * 1.15, Math.PI * 1.45); c.stroke();
  c.restore();
}
const PORTRAIT_DOTS = Array.from({ length: 18 }, (_, i) => ({ x: Math.sin(i * 12.9) , y: (Math.sin(i * 7.3) + 1) / 2, s: 0.6 + (i % 3) * 0.3, p: i }));
