// Choreography: beat-synced dance moves, formations, and per-member direction.
import { BEAT, BAR, INTERVIEWS } from './timeline.js';
import { MEMBER_IDS } from './members.js';
import { PHRASES_BY_MEMBER } from './song.js';

const PI = Math.PI;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const dip = (b) => Math.pow(1 - Math.abs(Math.sin(PI * b)), 2);
const pulse = (b, k = 6) => Math.exp(-((b % 1 + 1) % 1) * k);

export function neutralPose() {
  return {
    rootDX: 0, rootDZ: 0, rootY: 0, rootRot: 0,
    hipX: 0, hipY: 0, hipZ: 0, hip: [0, 0, 0], torso: [0, 0, 0], chest: 0, head: [0, 0, 0],
    armL: [0.06, 0.13, 0, 0.18, 0], armR: [0.06, 0.13, 0, 0.18, 0],
    legL: [0, 0.035, 0, 0], legR: [0, 0.035, 0, 0],
  };
}
const KEYS = ['rootDX', 'rootDZ', 'rootY', 'rootRot', 'hipX', 'hipY', 'hipZ', 'chest'];
const ARRS = ['hip', 'torso', 'head', 'armL', 'armR', 'legL', 'legR'];
export function blendPose(a, b, t, out = neutralPose()) {
  for (const k of KEYS) out[k] = lerp(a[k] || 0, b[k] || 0, t);
  for (const k of ARRS) { const A = a[k], B = b[k], O = out[k]; for (let i = 0; i < Math.max(A.length, B.length); i++) O[i] = lerp(A[i] || 0, B[i] || 0, t); }
  return out;
}

function legsForDrop(p, drop, lean = 0) {
  const th = Math.acos(clamp(1 - Math.max(0, drop) / 0.88, -1, 1));
  p.hipY -= drop;
  p.legL[0] += th + lean; p.legR[0] += th + lean;
  p.legL[3] += 2 * th; p.legR[3] += 2 * th;
}

// keyframe track: keys [[beat, [values]]] over a cycle
function track(keys, c, len) {
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1][0] <= c) i++;
  const [b0, v0] = keys[i];
  const [b1, v1] = i + 1 < keys.length ? keys[i + 1] : [len + keys[0][0], keys[0][1]];
  const t = ease(clamp((c - b0) / Math.max(1e-3, b1 - b0)));
  return v0.map((x, k) => lerp(x, v1[k], t));
}
function snap(t, s) { // sharper motion for higher s
  return t < 0.5 ? 0.5 * Math.pow(2 * t, 1 + 2 * s) : 1 - 0.5 * Math.pow(2 - 2 * t, 1 + 2 * s);
}

// ---------------- moves ----------------
export const MOVES = {
  idle(b, P, p) {
    const s = Math.sin(PI * b / 4);
    legsForDrop(p, 0.012 * (1 + Math.sin(PI * b / 2)));
    p.torso[2] = 0.03 * s; p.head[2] = 0.05 * Math.sin(PI * b / 4 + 1) + P.tilt; p.head[0] = 0.02;
    p.hipX = 0.02 * s; p.hip[2] = -0.04 * s;
    p.armL = [0.08, 0.14 + 0.02 * s, 0, 0.25, 0]; p.armR = [0.08, 0.14 - 0.02 * s, 0, 0.25, 0];
    p.legL[1] = 0.05; p.legR[1] = 0.03; p.legR[0] -= 0.04;
  },
  groove(b, P, p) {
    const A = P.amp;
    const s = Math.sin(PI * b), d = dip(b);
    legsForDrop(p, 0.05 * d * A + 0.015);
    p.hipX = 0.065 * s * A; p.hip[2] = -0.09 * s * A; p.hip[1] = 0.12 * s * A;
    p.torso[2] = 0.07 * s * A; p.torso[0] = 0.04; p.torso[1] = -0.08 * s;
    p.head[0] = 0.08 * d - 0.02; p.head[2] = -0.06 * s + P.tilt; p.head[1] = 0.1 * s;
    p.armL = [0.35 + 0.32 * s * A, 0.28, -0.2, 1.35 + 0.3 * d, 0.1];
    p.armR = [0.35 - 0.32 * s * A, 0.28, -0.2, 1.35 + 0.3 * d, 0.1];
    p.legL[1] = 0.07 + 0.04 * Math.max(0, s); p.legR[1] = 0.07 + 0.04 * Math.max(0, -s);
  },
  point(b, P, p) {
    const A = P.amp;
    const c = ((b % 4) + 4) % 4;
    const side = c < 2 ? 1 : -1;
    const cc = c % 2;
    const ph = cc < 1 ? snap(clamp(cc / 0.3), P.sharp) : 1 - ease(clamp((cc - 1.2) / 0.8));
    legsForDrop(p, 0.05 * dip(b) * A + 0.02);
    p.hipX = 0.08 * ph * side * A; p.hip[2] = -0.13 * ph * side * A;
    p.torso[2] = 0.06 * ph * side; p.head[1] = 0.28 * ph * side; p.head[0] = -0.12 * ph; p.head[2] = P.tilt;
    const up = [1.25, 1.55, 0, 0.05, -0.2], rest = [0.35, 0.3, -0.2, 1.4, 0];
    const a = rest.map((x, i) => lerp(x, up[i], ph));
    if (side > 0) { p.armL = a; p.armR = [0.4, 0.3, -0.2, 1.5, 0]; } else { p.armR = a; p.armL = [0.4, 0.3, -0.2, 1.5, 0]; }
    p.legL[1] = 0.08; p.legR[1] = 0.08;
  },
  chorus(b, P, p) {
    const A = P.amp;
    const c = ((b % 8) + 8) % 8;
    const d = dip(b);
    legsForDrop(p, 0.05 * d * A + 0.02);
    p.armL = track([
      [0, [1.6, 0.35, -0.25, 2.45, 0.2]], [1.8, [1.6, 0.35, -0.25, 2.45, 0.2]],
      [2.1, [1.2, 0.0, 0.1, 2.05, 0]], [3.8, [1.2, 0.0, 0.1, 2.05, 0]],
      [4.1, [0.5, -0.25, 0, 0.35, 0]], [5.8, [2.6, 1.05, 0, 0.1, -0.2]],
      [6.0, [3.0, 0.35, 0, 0.1, 0]], [7.0, [3.0, 0.35, 0, 0.1, 0]], [7.5, [0.45, 0.3, 0, 0.6, 0]],
    ], c, 8);
    p.armR = track([
      [0, [0.5, 0.3, -0.2, 1.5, 0]], [4.1, [0.5, -0.2, 0, 0.35, 0]], [5.8, [2.4, 1.0, 0, 0.1, 0]],
      [6.0, [3.0, 0.35, 0, 0.1, 0]], [7.0, [3.0, 0.35, 0, 0.1, 0]], [7.5, [0.45, 0.3, 0, 0.6, 0]],
    ], c, 8);
    // shimmy + giddy knees during "ki-lig"
    if (c < 2) { p.torso[1] = 0.12 * Math.sin(4 * PI * b) * A; p.legL[2] = -0.25 * Math.max(0, Math.sin(2 * PI * b)); p.legR[2] = -0.25 * Math.max(0, -Math.sin(2 * PI * b)); p.head[2] = 0.16 + P.tilt; }
    else if (c < 4) { const s = Math.sin(PI * b); p.hipX = 0.08 * s * A; p.hip[2] = -0.12 * s * A; p.head[2] = -0.06 * s + P.tilt; }
    else if (c < 6) { const k = ease(clamp((c - 4) / 1.8)); p.torso[1] = lerp(0.35, -0.3, k) * A; p.head[0] = lerp(0.1, -0.3, k); p.head[1] = lerp(0.2, -0.25, k); }
    else {
      const j = clamp((c - 6) / 0.8);
      if (c < 6.8) p.rootY = 0.2 * Math.sin(PI * j) * A;
      if (c > 6.8 && c < 7.6) legsForDrop(p, 0.1 * Math.sin(PI * (c - 6.8) / 0.8));
      p.head[0] = -0.15;
    }
  },
  rap(b, P, p) {
    const A = P.amp;
    const d = dip(b), d8 = dip(b * 2);
    legsForDrop(p, 0.07 * d * A + 0.06, 0.05);
    p.legL[1] = 0.17; p.legR[1] = 0.17;
    p.torso[0] = 0.12 + 0.05 * d; p.hip[1] = 0.15 * Math.sin(PI * b / 2);
    p.head[0] = 0.1 * d8 + 0.03; p.head[2] = 0.05 * Math.sin(PI * b) + P.tilt;
    const s = Math.sin(2 * PI * b);
    p.armL = [0.95 + 0.3 * s * A, 0.4, -0.3, 1.55 - 0.45 * pulse(b * 2, 5), 0.3];
    p.armR = [0.95 - 0.3 * s * A, 0.4, -0.3, 1.55 - 0.45 * pulse(b * 2 + 0.5, 5), 0.3];
  },
  dance(b, P, p) {
    const A = P.amp, S = P.sharp;
    const c = ((b % 16) + 16) % 16;
    const d = dip(b);
    if (c < 4) { // arm wave + body roll
      const w = (x) => Math.sin(2 * PI * (b * 0.5 + x));
      p.armL = [0.0, 1.45, 0, 0.7 * (1 + w(0)) * 0.5, 0.4 * w(0.15)];
      p.armR = [0.0, 1.45, 0, 0.7 * (1 + w(0.3)) * 0.5, 0.4 * w(0.45)];
      p.torso[0] = 0.16 * Math.sin(PI * b) * A; p.hipZ = -0.06 * Math.sin(PI * b + 0.8) * A; p.head[0] = -0.1 * Math.sin(PI * b - 0.6);
      legsForDrop(p, 0.06 + 0.04 * d);
    } else if (c < 8) { // punches + knee lifts
      const beat = Math.floor(c), f = c - beat;
      const hit = snap(clamp(f / 0.35), S);
      const upL = beat % 2 === 0;
      const U = [2.95, 0.25, 0, 0.05, 0], D0 = [0.35, 0.3, -0.2, 1.75, 0];
      p.armL = upL ? D0.map((x, i) => lerp(x, U[i], hit)) : U.map((x, i) => lerp(x, D0[i], hit));
      p.armR = !upL ? D0.map((x, i) => lerp(x, U[i], hit)) : U.map((x, i) => lerp(x, D0[i], hit));
      legsForDrop(p, 0.05 * d + 0.03);
      if (beat === 5 || beat === 7) { const k = Math.sin(PI * clamp(f / 0.9)); (beat === 5 ? p.legR : p.legL)[0] += 1.15 * k; (beat === 5 ? p.legR : p.legL)[3] += 1.7 * k; p.hipY += 0.04 * k; }
      p.head[1] = (upL ? 0.2 : -0.2) * hit;
    } else if (c < 12) { // spin, squat, rise
      if (c < 9) { const k = snap(clamp(c - 8), 0.3 + S * 0.4); p.rootRot = 2 * PI * k; p.armL = [0.2, 1.1, 0, 1.6, 0]; p.armR = [0.2, 1.1, 0, 1.6, 0]; legsForDrop(p, 0.04); }
      else {
        const sq = Math.sin(PI * clamp((c - 9.5) / 2));
        legsForDrop(p, 0.25 * sq * A + 0.03);
        p.legL[1] = 0.25 * sq; p.legR[1] = 0.25 * sq;
        p.armL = [1.0 * sq + 0.3, 0.6, 0, 1.9 * sq + 0.2, 0]; p.armR = [1.0 * sq + 0.3, 0.6, 0, 1.9 * sq + 0.2, 0];
        p.head[1] = 0.5 * Math.sin(PI * clamp((c - 10.5) / 0.5)) * A; p.torso[0] = 0.2 * sq;
      }
    } else { // slide + finish pose
      const k = c - 12;
      p.rootDX = 0.35 * Math.sin(PI * k / 2) * A;
      legsForDrop(p, 0.06 * d + 0.03);
      p.armL = [0.6 + 0.5 * Math.sin(PI * k), 0.9, 0, 0.9, 0]; p.armR = [0.6 - 0.5 * Math.sin(PI * k), 0.9, 0, 0.9, 0];
      if (k > 3) { const e = snap(clamp((k - 3) / 0.3), S); p.armL = [2.6 * e, 0.9, 0, 0.1, 0]; p.armR = [2.6 * e, 0.9, 0, 0.1, 0]; p.head[0] = -0.2 * e; }
      p.hip[2] = 0.1 * Math.sin(PI * k);
    }
  },
  bridge(b, P, p) {
    const s = Math.sin(2 * PI * b / 8);
    legsForDrop(p, 0.03 + 0.02 * dip(b / 2));
    p.torso[2] = 0.08 * s; p.hipX = 0.05 * s; p.hip[2] = -0.06 * s; p.head[2] = 0.06 * s + P.tilt; p.head[0] = -0.1;
    p.armL = [2.65, 0.55 + 0.35 * s, 0, 0.3, 0]; p.armR = [2.65, 0.55 - 0.35 * s, 0, 0.3, 0];
  },
  reach(b, P, p) { // the singer in the bridge
    const s = Math.sin(2 * PI * b / 8);
    legsForDrop(p, 0.03);
    p.legR[0] -= 0.15; p.legL[0] += 0.12;
    p.torso[0] = -0.05; p.head[0] = -0.14 + 0.05 * s; p.head[2] = 0.08 * s;
    p.armL = [1.4 + 0.3 * s, 0.55, 0.4, 0.28 + 0.15 * s, -0.3];
  },
  hero(b, P, p, id) {
    const br = Math.sin(PI * b / 3) * 0.01;
    legsForDrop(p, 0.02 + br);
    const H = {
      amara: () => { p.armL = [-0.15, 0.85, 0.3, 1.95, 0]; p.armR = [2.9, 0.3, 0, 0.15, 0]; p.head[0] = -0.12; p.hip[2] = 0.08; p.hipX = -0.04; p.legL[1] = 0.12; },
      yzel: () => { p.armL = [1.5, 0.2, 0, 0.05, 0]; p.armR = [0.3, 0.5, 0, 1.6, 0]; p.legL[1] = 0.22; p.legR[1] = 0.22; p.torso[1] = 0.25; p.head[1] = -0.2; p.head[0] = 0.08; },
      liway: () => { p.armL = [1.95, 0.25, 0.3, 2.45, 0]; p.armR = [0.3, 0.25, 0, 0.9, 0]; p.head[2] = 0.25; p.legR[2] = -0.25; p.legR[0] += 0.12; p.legR[3] += 0.3; },
      saya: () => { p.armL = [2.6, 0.9, 0, 2.4, 0]; p.armR = [0.4, 0.4, 0, 1.4, 0]; p.hipX = 0.07; p.hip[2] = -0.15; p.torso[2] = 0.1; p.head[2] = -0.1; p.legL[1] = 0.15; },
      tala: () => { p.armL = [2.5, 1.25, 0, 0.1, 0]; p.armR = [2.5, 1.25, 0, 0.1, 0]; p.legR[0] -= 0.3; p.legR[3] += 1.2; p.head[2] = 0.12; p.head[0] = -0.08; },
    };
    H[id]();
  },
  rise(b, P, p) { legsForDrop(p, 0.01); p.head[0] = 0.42; p.armL = [0.05, 0.12, 0, 0.2, 0]; p.armR = [0.05, 0.12, 0, 0.2, 0]; },
  talk(b, P, p, id, g) {
    const s = Math.sin(PI * b / 3);
    legsForDrop(p, 0.015);
    p.hipX = 0.04 * s; p.hip[2] = -0.06 * s; p.legL[1] = 0.06; p.legR[0] -= 0.06;
    p.head[2] = 0.07 * Math.sin(PI * b / 2) + P.tilt; p.head[0] = 0.04 * g;
    p.armL = [0.75 + 0.3 * g, 0.28, -0.35, 1.55 + 0.35 * g, 0.2 * g];
    p.armR = [0.15, 0.16, 0, 0.35, 0];
  },
  vocal(b, P, p) { MOVES.idle(b, P, p); p.armL = [1.0, -0.2, 0.1, 2.25, 0]; p.head[0] = -0.08; },
  mirror(b, P, p) { MOVES.idle(b, P, p); const s = Math.sin(PI * b / 2); p.armL = [2.3, 0.85, 0, 2.35 + 0.15 * s, 0]; p.head[2] = 0.18; p.head[1] = 0.1 * s; },
  beatbox(b, P, p) { MOVES.idle(b, P, p); p.head[0] = 0.1 * dip(b); p.armL = [0.95, 0.35, -0.3, 1.6 - 0.4 * pulse(b, 5), 0.3]; legsForDrop(p, 0.03 * dip(b)); },
  eat(b, P, p) {
    MOVES.idle(b, P, p);
    p.armL = [0.9, 0.05, 0.3, 1.75, 0];
    const k = Math.pow(Math.max(0, Math.sin(PI * b / 2)), 3);
    p.armR = [0.9 + 0.5 * k, -0.25 * k, 0, 1.6 + 0.85 * k, 0];
    p.head[0] = 0.12 - 0.08 * k;
  },
};

// ---------------- formations ----------------
const FORMS = {
  V: { tala: [0, 1.0], amara: [-1.45, 0.35], liway: [1.45, 0.35], yzel: [-2.8, -0.35], saya: [2.8, -0.35] },
  line: { yzel: [-2.9, 0.5], amara: [-1.45, 0.5], tala: [0, 0.5], liway: [1.45, 0.5], saya: [2.9, 0.5] },
  diamond: { yzel: [0, 1.55], amara: [-1.7, 0.45], saya: [1.7, 0.45], tala: [-0.85, -0.7], liway: [0.85, -0.7] },
  cluster: { tala: [0, 1.15], amara: [-0.95, 0.72], liway: [0.95, 0.72], yzel: [-1.85, 0.25], saya: [1.85, 0.25] },
};
function solo(id) {
  const slots = [[-2.7, -0.35], [-1.35, -0.8], [1.35, -0.8], [2.7, -0.35]];
  const out = { [id]: [0, 1.45] };
  let k = 0;
  for (const m of MEMBER_IDS) if (m !== id) out[m] = slots[k++];
  return out;
}
const FORM_KEYS = [
  [0, FORMS.V], [56, solo('amara')], [64, solo('liway')], [72, solo('tala')], [80, FORMS.V], [88, FORMS.line],
  [96, solo('saya')], [104, solo('yzel')], [112, solo('liway')], [116, solo('tala')], [120, FORMS.line], [128, FORMS.V],
  [136, FORMS.diamond], [148, solo('amara')], [156, FORMS.V], [164, FORMS.cluster],
];
export function formationPos(id, t) {
  let i = 0;
  while (i < FORM_KEYS.length - 1 && FORM_KEYS[i + 1][0] <= t) i++;
  const cur = FORM_KEYS[i][1][id];
  const prev = i > 0 ? FORM_KEYS[i - 1][1][id] : cur;
  const k = ease(clamp((t - FORM_KEYS[i][0] + 0.25) / 1.1));
  return [lerp(prev[0], cur[0], k), lerp(prev[1], cur[1], k)];
}

// Backstage marks (set-local coordinates), activity and facing.
export const BACKSTAGE = {
  amara: { pos: [-2.6, -1.6], rot: 0.35, act: 'vocal' },
  yzel: { pos: [3.4, -2.2], rot: -0.6, act: 'groove' },
  liway: { pos: [-0.6, -2.9], rot: Math.PI, act: 'mirror' },
  saya: { pos: [1.4, -1.0], rot: -0.25, act: 'beatbox' },
  tala: { pos: [0.4, 0.6], rot: 0.1, act: 'eat' },
};

// ---------------- the director ----------------
// For a given member and time: where she stands, what she does, mic state.
export function direct(id, t) {
  const b = t / BEAT;
  const out = { visible: true, set: 'stadium', x: 0, z: 0, rot: 0, y: 0, move: 'idle', move2: null, mix: 0, mic: true, sing: 0, talk: false };
  if (t < 26) { out.visible = false; out.set = 'city'; return out; }
  if (t < 48) {
    out.set = 'backstage'; out.mic = false;
    const B = BACKSTAGE[id];
    out.x = B.pos[0]; out.z = B.pos[1]; out.rot = B.rot; out.move = B.act;
    for (const iv of INTERVIEWS) {
      const t0 = iv.bar * BAR, t1 = t0 + 2 * BAR;
      if (iv.who === id && t >= t0 - 0.6 && t < t1) {
        const k = ease(clamp((t - (t0 - 0.6)) / 0.6));
        out.rot = lerp(B.rot, 0.12, k);
        out.move = 'talk'; out.talk = true;
      }
    }
    return out;
  }
  const [x, z] = formationPos(id, t);
  out.x = x; out.z = z;
  // rise on the lifts
  if (t < 52) { out.y = -2.6 + 2.6 * ease(clamp((t - 49.2) / 2.6)); out.move = 'rise'; }
  else if (t < 53.5) out.move = 'hero';
  else if (t < 56) out.move = 'groove';
  else if (t < 72) out.move = 'groove';
  else if (t < 80) out.move = 'point';
  else if (t < 96) out.move = 'chorus';
  else if (t < 112) out.move = 'rap';
  else if (t < 120) out.move = 'point';
  else if (t < 136) out.move = 'chorus';
  else if (t < 148) out.move = 'dance';
  else if (t < 156) out.move = id === 'amara' ? 'reach' : 'bridge';
  else if (t < 172) out.move = 'chorus';
  else out.move = 'hero';
  // mic arm
  out.sing = micWeight(id, t);
  if (out.move === 'hero' && t >= 172) out.sing = 0;
  return out;
}

function micWeight(id, t) {
  let w = 0;
  for (const ph of PHRASES_BY_MEMBER[id]) {
    if (t < ph.t0 - 1) break;
    const a = smooth(ph.t0 - 0.45, ph.t0 - 0.1, t);
    const r = 1 - smooth(ph.t1 + 0.25, ph.t1 + 0.7, t);
    w = Math.max(w, Math.min(a, r));
  }
  return w;
}

export { clamp, smooth, ease, lerp };
