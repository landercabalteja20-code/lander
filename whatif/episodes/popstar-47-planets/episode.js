// What if a pop star's world tour included 47 planets, but Earth was her least successful market?
// Script: script.md · Song: music.py (build/song.wav, build/sing.json) · Sets: sets.js
import * as THREE from 'three';
import { createPopStar } from '../../kit/popstar.js';
import { cameraPath, handheld, clamp, smooth, smoother, easeInOut, lerp, range01 } from '../../kit/util.js';
import { COLORS, FONTS } from '../../engine/overlay.js';
import * as Sets from './sets.js';

const BEAT = 0.625;
const OPEN = { a: 1, o: 0.8, e: 0.65, i: 0.45, u: 0.4, m: 0 };
let star = null;
let sing = null;

// ------------------------------------------------------------------------------------------- script
const TITLE = { t0: 0.25, t1: 6.6, text: "What if a pop star's world tour included [47 planets], but Earth was her least successful market?" };
const CAPTIONS = [
  [7.0, 11.6, 'Stop 1: Zorb Prime. 9.4 billion fans.'],
  [12.0, 15.9, 'Every one of them has three hands to clap with.'],
  [16.2, 19.8, 'Her first note registered on two seismographs and a moon.'],
  [20.4, 24.8, "Stop 6: Glacia. It's −180 °C."],
  [25.2, 29.8, 'Her single has been #1 here for 600 years.'],
  [30.2, 34.8, 'Their years are four days long.'],
  [35.4, 39.8, 'Stop 12: Nimbus. There is no ground. The fans float in.'],
  [40.2, 44.8, 'Tickets sold out in 0.3 seconds. Nobody here has fingers.'],
  [45.4, 49.8, 'Stop 19: Vulcara. The stage is made of cooled lava.'],
  [50.2, 54.8, 'It is still cooling.'],
  [55.3, 59.8, 'Stop 27: Tri-Sol. Three suns, no night. The encore lasted 11 hours.'],
  [60.4, 64.8, 'Stop 33: Myco. The entire crowd is one fungus.'],
  [65.2, 69.8, 'It has no mouth. It hums along anyway.'],
  [70.4, 74.8, 'Stop 40: Aquos. Whales swam in from three oceans.'],
  [75.2, 79.8, "Her merch outsells the planet's entire economy."],
  [80.4, 84.8, 'Stop 46: Pluto. Technically not a planet.'],
  [85.2, 89.8, "Sold out anyway. Pluto knows what it's like to be underestimated."],
  [90.4, 95.0, 'Then her label ranked all 47 markets.'],
  [95.4, 100.6, "Pluto came 46th. Pluto isn't even a planet."],
  [100.9, 102.4, 'Which means 47th place was…'],
  [105.3, 109.8, 'Stop 47: Earth. 212 tickets sold.'],
  [110.2, 114.8, '80 of them were free.'],
  [115.2, 119.8, 'The venue is a parking lot. Parking is $12.'],
  [120.2, 124.8, "A man in row three asks if she's the opening act."],
  [125.2, 129.8, 'One person claps. Then stops.'],
  [130.2, 134.8, "On Earth, she's “that song from the phone commercial.”"],
  [135.2, 139.8, 'Monthly streams here: 4,100. Zorb Prime does that every second.'],
  [140.2, 144.8, 'Her label calls Earth “an emerging market.”'],
  [145.2, 149.8, 'Earth’s review: 2 stars. “Kind of loud.”'],
  [150.2, 154.8, 'She sings the full set anyway. Every note. In the rain.'],
  [155.2, 159.8, 'One guy films the whole thing. Vertically.'],
  [160.4, 164.8, 'He posts it. Nobody on Earth watches.'],
  [165.2, 169.8, 'But the signal leaves the atmosphere… and reaches 46 planets.'],
  [170.2, 174.8, 'It becomes the most-watched video in the galaxy.'],
  [175.3, 180.6, 'Next tour: 52 planets. Earth gets one night, in a smaller parking lot.'],
];
const END = {
  t0: 181.0,
  title: "What if a pop star's world tour included 47 planets, but Earth was her least successful market?",
  fact: ['Earth ranked 47 of 47 · Pluto ranked 46', 'Pluto is not a planet'],
  question: 'Which planet should she play next?',
  cta: 'Tell us in the comments ↓',
};
// tour stops: [t0, t1, stop#, name, crowd line, extra line]
const STOPS = [
  [0, 20, 1, 'Zorb Prime', 'Crowd 9.4 billion', 'Hands per fan 3'],
  [20, 35, 6, 'Glacia', 'Crowd 880 million', 'Temp −180 °C'],
  [35, 45, 12, 'Nimbus', 'Crowd 3.1 billion', 'Altitude 40 km'],
  [45, 55, 19, 'Vulcara', 'Crowd 1.2 billion', 'Floor 340 °C'],
  [55, 60, 27, 'Tri-Sol', 'Crowd 5.6 billion', 'Sunset never'],
  [60, 70, 33, 'Myco', 'Crowd 1 (fungus)', 'Area 2,400 km²'],
  [70, 80, 40, 'Aquos', 'Crowd 2.2 billion', 'Mostly whales'],
  [80, 90, 46, 'Pluto', 'Crowd 4.8 million', 'Status dwarf'],
];

// ------------------------------------------------------------------------------------------- choreography
const ARM_L = ['hip', 'hip', 'reach', 'out', 'hip', 'wave', 'up', 'reach', 'hip', 'heart', 'out', 'up'];
function scheduleArm(t, pattern, xf = 0.18) {
  const bar = Math.floor(t / 2.5), u = (t % 2.5) / 2.5;
  return { a: pattern[bar % pattern.length], b: pattern[(bar + 1) % pattern.length], w: smooth((u - (1 - xf)) / xf) };
}
function singAt(t) {
  const fr = sing.frames; const f = clamp(Math.round(t * 30), 0, fr.length - 1);
  return fr[f];
}
function energyAt(t) {
  if (t < 10) return 0.6;
  if (t < 90) return 1;
  if (t < 105) return 0.5;
  if (t < 160) return 0.85;
  return 1;
}

function context(t) {
  const beat = t / BEAT;
  let mouth = 0, vowel = 'a';
  if (sing) {
    const [amp, v] = singAt(t);
    const [, vp] = singAt(t - 0.07);
    vowel = v;
    mouth = amp * OPEN[v] * (v !== vp ? 0.35 : 1) * (0.82 + 0.18 * Math.sin(t * 13.7));
    var near = 0;
    for (let k = -12; k <= 18; k += 3) near = Math.max(near, singAt(t + k / 30)[0]);
  }
  const L = scheduleArm(t, ARM_L);
  const energy = energyAt(t);
  const perf = {
    beat, mouth: clamp(mouth * 1.15), vowel, dance: energy,
    armL: L.a, armL2: L.b, armLw: L.w,
    armR: 'mic', armR2: 'out', armRw: 1 - smooth((near || 0) * 4),
    sparkle: 1,
  };
  return { beat, energy, perf };
}

// ------------------------------------------------------------------------------------------- shots
const P0 = [0, 3.05, -3.84];
const C = (keys, opts = {}) => {
  const path = cameraPath(keys);
  return (cam, lt, ctx) => {
    path(cam, lt);
    if (opts.hand) handheld(cam, ctx.t, opts.hand);
    if (opts.shake) { const k = opts.shake(ctx.t); cam.rotateX(Math.sin(ctx.t * 41) * 0.012 * k); cam.rotateZ(Math.sin(ctx.t * 37) * 0.01 * k); }
  };
};
const k = (t, pos, look, fov) => ({ t, pos, look, fov });

function earthMarkerCam(target, from, to) {
  return (cam, lt, ctx) => {
    const S = ctx.engine.getScene('space');
    const e = S.stops[46].pos;
    const u = smoother(lt / (ctx.dur || 1));
    cam.position.set(e.x + lerp(from[0], to[0], u), e.y + lerp(from[1], to[1], u), e.z + lerp(from[2], to[2], u));
    cam.fov = 40; cam.updateProjectionMatrix();
    cam.lookAt(e.x + target[0], e.y + target[1], e.z + target[2]);
  };
}

const SHOTS = [
  // Zorb Prime
  { t0: 0, t1: 7, scene: 'zorb', camera: C([k(0, [0, 30, 95], [0, 16, -6], 42), k(7, [0, 13, 44], [0, 8, -4], 38)]) },
  { t0: 7, t1: 12, scene: 'zorb', camera: C([k(0, [1.3, 3.0, -0.2], [0, 3.15, -3.84], 34), k(5, [-0.7, 3.1, -0.6], [0, 3.2, -3.84], 32)], { hand: 0.6 }) },
  { t0: 12, t1: 16.2, scene: 'zorb', camera: C([k(0, [0, 2.7, 21], [3.5, 1.2, 9], 46), k(4.2, [0, 2.6, 17.5], [3.5, 1.2, 7.5], 44)], { hand: 1 }) },
  { t0: 16.2, t1: 20, scene: 'zorb', camera: C([k(0, [0.7, 2.05, -0.6], [0, 3.6, -3.84], 44), k(3.8, [0.3, 2.1, -1.0], [0, 3.5, -3.84], 42)], { shake: (t) => (t > 16.4 && t < 17.6 ? Math.sin((t - 16.4) / 1.2 * Math.PI) : 0) }) },
  // Glacia
  { t0: 20, t1: 25, scene: 'glacia', camera: C([k(0, [-34, 16, 40], [0, 7, -6], 40), k(5, [-21, 9, 29], [0, 5, -5], 38)]) },
  { t0: 25, t1: 30, scene: 'glacia', camera: C([k(0, [-1.2, 3.1, -0.4], [0, 3.2, -3.84], 33), k(5, [1.0, 3.0, -0.7], [0, 3.2, -3.84], 32)], { hand: 0.6 }) },
  { t0: 30, t1: 35, scene: 'glacia', camera: C([k(0, [0, 3.0, 15], [-4, 0.6, 9.5], 44), k(5, [0, 2.9, 12], [-4, 0.6, 7.5], 42)], { hand: 1 }) },
  // Nimbus
  { t0: 35, t1: 40, scene: 'nimbus', camera: C([k(0, [32, 14, 48], [0, 5, -4], 40), k(5, [14, 8.5, 33], [0, 4, -4], 38)]) },
  { t0: 40, t1: 45, scene: 'nimbus', camera: C([k(0, [0.5, 3.3, 0.2], [0, 3.2, -3.84], 33), k(5, [-0.8, 3.1, -0.4], [0, 3.2, -3.84], 32)], { hand: 0.6 }) },
  // Vulcara
  { t0: 45, t1: 50, scene: 'vulcara', camera: C([k(0, [-20, 4.2, 38], [0, 4.5, -5], 42), k(5, [-9, 4.6, 26], [0, 4, -4], 40)], { hand: 0.5 }) },
  { t0: 50, t1: 55, scene: 'vulcara', camera: C([k(0, [1.0, 2.25, -1.6], [0, 2.1, -3.84], 40), k(1.8, [1.0, 2.3, -1.6], [0, 2.1, -3.84], 40), k(5, [1.1, 3.0, -0.9], [0, 3.15, -3.84], 38)]) },
  // Tri-Sol
  { t0: 55, t1: 60, scene: 'trisol', camera: C([k(0, [-16, 2.2, 30], [-2, 14, -20], 50), k(5, [-8, 2.4, 20], [0, 11, -16], 48)]) },
  // Myco
  { t0: 60, t1: 65, scene: 'myco', camera: C([k(0, [0, 27, 52], [0, 3, -4], 46), k(5, [0, 14, 31], [0, 3.5, -4], 42)]) },
  { t0: 65, t1: 70, scene: 'myco', camera: C([k(0, [1.3, 3.0, -0.3], [0, 3.2, -3.84], 33), k(5, [-1.0, 3.1, -0.7], [0, 3.2, -3.84], 32)], { hand: 0.6 }) },
  // Aquos
  { t0: 70, t1: 75, scene: 'aquos', camera: C([k(0, [-26, 8, 42], [0, 5, -14], 44), k(5, [-12, 6, 28], [0, 4.5, -10], 42)]) },
  { t0: 75, t1: 80, scene: 'aquos', camera: C([k(0, [0.4, 2.4, 1.8], [-0.4, 4.3, -3.84], 44), k(5, [0.9, 2.5, 0.8], [-0.4, 4.1, -3.84], 42)], { hand: 0.5 }) },
  // Pluto
  { t0: 80, t1: 85, scene: 'pluto', camera: C([k(0, [16, 6, 38], [-6, 9, -12], 48), k(5, [9, 4, 24], [-3, 6, -8], 46)]) },
  { t0: 85, t1: 90, scene: 'pluto', camera: C([k(0, [2.6, 1.0, 10.5], [0, 1.3, 4], 40), k(5, [1.7, 1.1, 9], [0, 1.9, 0], 40)], { hand: 0.8 }) },
  // the ranking
  { t0: 90, t1: 102.5, scene: 'space', camera: C([k(0, [0, 760, 1150], [0, 0, 0], 46), k(12.5, [380, 520, 880], [0, 0, 0], 44)]), update: (c) => { c.routeDraw = 1; c.lit = 46; } },
  { t0: 102.5, t1: 103.2, scene: null },
  { t0: 103.2, t1: 105, scene: 'space', camera: earthMarkerCam([0, 0, 0], [60, 40, 90], [40, 25, 60]), update: (c) => { c.routeDraw = 1; c.lit = 46; c.earthPulse = 0.5 + 0.5 * Math.sin(c.t * 10); } },
  // Earth
  { t0: 105, t1: 110, scene: 'earth', camera: C([k(0, [26, 16, 34], [0, 2, -6], 44), k(5, [17, 10, 23], [0, 2, -6], 42)]) },
  { t0: 110, t1: 115, scene: 'earth', camera: C([k(0, [-6.5, 1.7, 12.5], [0, 1.4, 2], 46), k(5, [-3.8, 1.7, 11], [0, 1.5, 0], 44)], { hand: 1 }) },
  { t0: 115, t1: 120, scene: 'earth', camera: C([k(0, [12.6, 2.3, 13.8], [8.0, 2.4, 3.2], 42), k(5, [12.1, 2.4, 12.9], [7.6, 2.5, 2.8], 40)], { hand: 0.8 }) },
  { t0: 120, t1: 125, scene: 'earth', camera: C([k(0, [3.4, 2.9, -5.4], [0, 1.4, 2.5], 42), k(5, [2.6, 2.8, -5.0], [0, 1.4, 3.0], 40)], { hand: 1 }) },
  { t0: 125, t1: 130, scene: 'earth', camera: C([k(0, [0, 3.3, 17], [0, 2.2, -7], 34), k(5, [0, 3.0, 14.5], [0, 2.4, -7], 32)]) },
  { t0: 130, t1: 135, scene: 'earth', camera: C([k(0, [1.6, 1.75, -3.4], [0, 2.6, -7.8], 36), k(5, [-1.0, 1.85, -3.6], [0, 2.6, -7.8], 36)], { hand: 0.6 }) },
  { t0: 135, t1: 140, scene: 'earth', camera: C([k(0, [-7.5, 2.4, -6.2], [0, 2.4, -7.8], 38), k(5, [-6.2, 2.6, -4.6], [0, 2.5, -7.8], 38)]) },
  { t0: 140, t1: 145, scene: 'earth', camera: C([k(0, [0.28, 3.02, -6.55], [0, 2.92, -7.8], 30), k(5, [0.08, 2.98, -6.85], [0, 2.92, -7.8], 30)]), update: (c) => { c.earthPerf = { eyesClosed: 0.75 * clamp(c.perf.mouth * 2), armL: 'heart', armLw: 0 }; } },
  { t0: 145, t1: 150, scene: 'earth', camera: C([k(0, [-4.5, 3.0, 9.5], [-0.5, 1.2, 3], 40), k(5, [-3.6, 2.8, 8.2], [0, 1.4, 1], 40)], { hand: 1 }) },
  { t0: 150, t1: 155, scene: 'earth', camera: C([k(0, [0, 1.6, 6.5], [0, 2.6, -7.8], 38), k(5, [0, 4.6, 0.6], [0, 2.9, -7.8], 38)]), update: (c) => { c.earthPerf = { armL: 'up', armLw: 0 }; } },
  { t0: 155, t1: 160, scene: 'earth', camera: C([k(0, [2.06, 2.02, 1.78], [1.6, 1.84, 0.98], 44), k(5, [1.92, 1.98, 1.5], [1.6, 1.86, 0.96], 40)], { hand: 0.35 }) },
  // the signal
  { t0: 160, t1: 165, scene: 'earth', camera: C([k(0, [6, 4, 22], [1.6, 2, 1], 50), k(5, [10, 260, 90], [1.6, 0, 0], 60)], { }) },
  { t0: 165, t1: 170, scene: 'orbit', camera: C([k(0, [60, 110, 250], [0, 0, 0], 40), k(5, [120, 190, 470], [30, 60, 100], 42)]) },
  { t0: 170, t1: 181, scene: 'space', camera: C([k(0, [200, 900, 1300], [0, 0, 0], 45), k(11, [-250, 1350, 1700], [0, 0, 0], 46)]), update: (c) => { const u = (c.t - 170) / 3.2; c.routeDraw = clamp(u); c.lit = Math.floor(clamp(u) * 46); c.earthPulse = c.t > 175 ? 0.25 + 0.25 * Math.sin(c.t * 4) : 0; } },
  // end card
  { t0: 181, t1: 192.5, scene: null },
];

// ------------------------------------------------------------------------------------------- overlay
function fmtNum(v) {
  if (v === 1) return '1 (FUNGUS)';
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return Math.round(v / 1e6) + 'M';
  return String(Math.round(v));
}

function fadeIn(t, t0, t1, f = 0.35) { return clamp(Math.min((t - t0) / f, (t1 - t) / f)); }

function drawHUD(t, ov) {
  for (let i = 0; i < STOPS.length; i++) {
    const [t0, t1, num, name, crowd, extra] = STOPS[i];
    if (t >= t0 && t < t1) {
      const prev = i ? STOPS[i - 1][2] : 0;
      const roll = Math.round(lerp(prev, num, smooth((t - t0) / 0.6)));
      const a = i === 0 ? clamp((t - 6.4) / 0.4) : 1;
      ov.hud({ label: 'Tour stop', big: roll, of: 47, sub: [name, crowd, extra], pill: `Next stop in ${Math.max(0, t1 - t).toFixed(1)} s`, alpha: a });
      return;
    }
  }
  if (t >= 105 && t < 160) {
    const roll = Math.round(lerp(46, 47, smooth((t - 105) / 0.6)));
    const sub = t < 135 ? ['Earth', 'Crowd 212', 'Parking $12'] : t < 145 ? ['Earth', 'Monthly streams 4,100', 'Zorb Prime: 4,100 / s'] : ['Earth', 'Crowd 212', 'Review 2/5'];
    ov.hud({ label: 'Tour stop', big: roll, of: 47, sub, pill: 'Final stop', alpha: 1 });
    return;
  }
  if (t >= 160 && t < 175) {
    const u = clamp((t - 165.6) / 8.6);
    const views = t < 165.6 ? Math.round(11 * clamp((t - 160.3) / 2.5)) : 11 + Math.pow(u, 2.2) * 84e12;
    const big = views < 1e3 ? String(Math.round(views)) : views < 1e6 ? Math.round(views / 1e3) + 'K' : views < 1e9 ? Math.round(views / 1e6) + 'M' : views < 1e12 ? (views / 1e9).toFixed(1) + 'B' : (views / 1e12).toFixed(1) + 'T';
    ov.hud({ label: 'Views', big, sub: ['From Earth: 11', `Planets reached ${Math.min(46, Math.floor(clamp((t - 165) / 5) * 46))}`], pill: t > 170 ? 'Most watched in the galaxy' : 'Uploading…', pillDot: COLORS.gold });
    return;
  }
  if (t >= 175 && t < 181) {
    ov.hud({ label: 'Next tour', big: Math.round(lerp(47, 52, smooth((t - 175.2) / 0.8))), of: 'planets', sub: ['Earth: 1 night', 'Venue: smaller parking lot'], pill: 'On sale now', pillDot: COLORS.gold });
  }
}

function drawLeaderboard(t, ov) {
  const g = ov.g, px = (v) => ov.px(v);
  const a = clamp((t - 90.2) / 0.5) * (t < 102.5 ? 1 : t >= 103.2 ? 1 : 0);
  if (a <= 0) return;
  const X = px(60), Y = ov.H * 0.12, W = ov.W - px(120), H = ov.H * 0.38;
  g.save(); g.globalAlpha = a;
  g.fillStyle = 'rgba(8,8,16,0.78)'; g.beginPath(); g.roundRect(X, Y, W, H, px(28)); g.fill();
  g.font = `600 ${px(24)}px ${FONTS.SANS}`; g.letterSpacing = `${px(4.5)}px`; g.fillStyle = 'rgba(255,255,255,0.9)';
  g.fillText('MARKET RANKING', X + px(36), Y + px(58));
  g.font = `500 ${px(18)}px ${FONTS.MONO}`; g.letterSpacing = `${px(3)}px`; g.fillStyle = 'rgba(255,255,255,0.55)'; g.textAlign = 'right';
  g.fillText('MONTHLY LISTENERS', X + W - px(36), Y + px(58)); g.textAlign = 'left'; g.letterSpacing = '0px';
  const rowH = px(70), top = Y + px(90), visible = Math.floor((H - px(110)) / rowH);
  const maxScroll = Sets.MARKETS.length - visible;
  const scroll = t >= 103.2 ? maxScroll : lerp(0, maxScroll, easeInOut((t - 91) / 9.6));
  g.save(); g.beginPath(); g.rect(X, top - px(6), W, visible * rowH + px(4)); g.clip();
  const lmax = Math.log10(9.4e9);
  Sets.MARKETS.forEach(([name, v], i) => {
    const y = top + (i - scroll) * rowH;
    if (y < top - rowH || y > top + visible * rowH) return;
    const isEarth = i === 46, isPluto = i === 45;
    const revealed = t >= 103.2;
    if (isEarth && revealed) { g.fillStyle = `rgba(255,59,59,${0.18 + 0.12 * Math.sin(t * 10)})`; g.fillRect(X + px(16), y, W - px(32), rowH - px(8)); }
    if (isPluto && t > 95.4 && t < 102.5) { g.strokeStyle = COLORS.gold; g.lineWidth = px(2.5); g.strokeRect(X + px(16), y, W - px(32), rowH - px(8)); }
    const cy = y + rowH * 0.62;
    g.font = `500 ${px(24)}px ${FONTS.MONO}`; g.fillStyle = isEarth && revealed ? '#ff6a6a' : COLORS.gold; g.fillText('#' + (i + 1), X + px(36), cy);
    g.font = `400 ${px(38)}px ${FONTS.SERIF}`; g.fillStyle = isEarth && revealed ? '#ff8a8a' : '#fff';
    g.fillText(isEarth && !revealed ? '?????' : name, X + px(140), cy);
    if (!(isEarth && !revealed)) {
      const bw = Math.max(px(6), (Math.max(0, Math.log10(Math.max(v, 1)) - 1) / (lmax - 1)) * px(260));
      g.fillStyle = isEarth ? '#ff3b3b' : 'rgba(232,193,90,0.85)';
      g.fillRect(X + px(470), cy - px(16), bw, px(16));
      g.font = `500 ${px(22)}px ${FONTS.MONO}`; g.textAlign = 'right'; g.fillStyle = 'rgba(255,255,255,0.8)';
      g.fillText(fmtNum(v), X + W - px(36), cy); g.textAlign = 'left';
    }
  });
  g.restore(); g.restore();
}

function drawEarthLabel(t, ov, engine) {
  if (t < 175.4 || t >= 181) return;
  const S = engine.getScene('space');
  const p = S.stops[46].pos.clone().project(engine.camera);
  const x = (p.x * 0.5 + 0.5) * ov.W, y = (-p.y * 0.5 + 0.5) * ov.H;
  const g = ov.g, a = clamp((t - 175.4) / 0.4);
  g.save(); g.globalAlpha = a; g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = ov.px(2);
  g.beginPath(); g.arc(x, y, ov.px(22), 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(x + ov.px(16), y - ov.px(16)); g.lineTo(x + ov.px(70), y - ov.px(70)); g.lineTo(x + ov.px(180), y - ov.px(70)); g.stroke();
  g.font = `500 ${ov.px(22)}px ${FONTS.MONO}`; g.letterSpacing = `${ov.px(3)}px`; g.fillStyle = '#fff';
  g.fillText('EARTH · 1 NIGHT', x + ov.px(76), y - ov.px(82));
  g.restore();
}

function drawOverlay(ctx, ov) {
  const t = ctx.t;
  if (ctx.shot.scene) ov.vignette(0.32);
  // title
  ov.title(TITLE.text, fadeIn(t, TITLE.t0, TITLE.t1, 0.45));
  if (t >= 90 && t < 105) drawLeaderboard(t, ov);
  if (t < END.t0) drawHUD(t, ov);
  for (const [t0, t1, text] of CAPTIONS) {
    if (t >= t0 - 0.01 && t < t1) { ov.caption(text, fadeIn(t, t0, t1, 0.25), { y: t >= 90 && t < 105 ? 0.68 : 0.6 }); break; }
  }
  drawEarthLabel(t, ov, ctx.engine);
  // flash on the Earth reveal
  if (t >= 103.2 && t < 103.8) ov.fill('#ffffff', 0.85 * (1 - (t - 103.2) / 0.6));
  if (t >= END.t0) ov.endCard({ ...END, alpha: clamp((t - END.t0) / 0.5) });
}

// ------------------------------------------------------------------------------------------- export
const ep = {
  title: TITLE.text,
  fps: 30,
  duration: 192.5,
  audio: 'build/song.wav',
  async setup(engine) {
    try { sing = await (await fetch(new URL('./build/sing.json', import.meta.url))).json(); }
    catch (e) { console.warn('no sing.json; mouth will not move', e); sing = null; }
    star = createPopStar('SUNNY');
  },
  context,
  scenes: {
    zorb: (e) => Sets.zorb(e, star),
    glacia: (e) => Sets.glacia(e, star),
    nimbus: (e) => Sets.nimbus(e, star),
    vulcara: (e) => Sets.vulcara(e, star),
    trisol: (e) => Sets.trisol(e, star),
    myco: (e) => Sets.myco(e, star),
    aquos: (e) => Sets.aquos(e, star),
    pluto: (e) => Sets.pluto(e, star),
    space: (e) => Sets.space(e),
    orbit: (e) => Sets.earthOrbit(e),
    earth: (e) => Sets.earthLot(e, star),
  },
  shots: SHOTS,
  drawOverlay,
};
export default ep;
