// Mouth shapes from the vocal score + per-member expressions, blinks and eye contact.
import { NOTES_BY_MEMBER, LYRIC_LINES } from './song.js';
import { phonemes, VISEMES } from './phonetics.js';
import { INTERVIEWS, BAR } from './timeline.js';

const TALK_END = {};
for (const l of LYRIC_LINES) if (l.style === 'talk') TALK_END[l.who[0]] = l.t1;

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

function findNote(list, t) {
  let lo = 0, hi = list.length - 1, ans = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (list[mid].t <= t + 0.04) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
  return ans;
}

export function mouthAt(id, t) {
  const list = NOTES_BY_MEMBER[id];
  const i = findNote(list, t);
  const out = { open: 0, wide: 1, round: 0, singing: 0, high: 0, style: null };
  if (i < 0) return out;
  const n = list[i];
  const local = t - n.t;
  const end = n.dur;
  if (local > end + 0.12) return out;
  const ph = phonemes(n.syl);
  const v1 = VISEMES[ph.v1], v2 = ph.v2 ? VISEMES[ph.v2] : null;
  const k2 = v2 ? smooth(end * 0.45, end * 0.9, local) : 0;
  const open = v2 ? lerp(v1.open, v2.open, k2) : v1.open;
  const wide = v2 ? lerp(v1.wide, v2.wide, k2) : v1.wide;
  const round = v2 ? lerp(v1.round, v2.round, k2) : v1.round;
  let amt = smooth(-0.035, 0.05, local) * (1 - smooth(end - 0.04, end + 0.1, local));
  if (ph.onset === 'closed') amt *= smooth(0.0, 0.07, local);
  if (ph.onset === 'teeth') amt = Math.max(amt * smooth(0, 0.06, local), 0.12);
  if (ph.closeEnd) amt *= 1 - smooth(end - 0.09, end - 0.02, local);
  // legato: hold a little opening between close notes
  const next = list[i + 1];
  if (next && next.t - (n.t + n.dur) < 0.12 && local > end - 0.05) amt = Math.max(amt, 0.2);
  const mult = n.style === 'shout' ? 1.15 : n.style === 'talk' ? 0.6 : n.style === 'rap' ? 0.78 : 0.95;
  const vib = n.dur > 0.7 ? 1 + 0.06 * Math.sin(t * 33) * smooth(0.3, 0.6, local) : 1;
  out.open = clamp(open * amt * mult * vib, 0, 1.1);
  out.wide = lerp(1, wide, amt);
  out.round = round * amt;
  out.singing = amt;
  out.style = n.style;
  out.high = n.midi >= 79 && n.dur > 0.6 ? smooth(0.15, 0.5, local) * (1 - smooth(end - 0.1, end, local)) : 0;
  return out;
}

// Deterministic blinking per member.
function blink(id, t) {
  const seed = id.charCodeAt(0) * 0.37 + id.length;
  const period = 3.1 + (id.charCodeAt(1) % 7) * 0.28;
  const ph = ((t + seed) % period + period) % period;
  const d = 0.13;
  if (ph < d) return Math.sin((ph / d) * Math.PI);
  // occasional double blink
  if (id.charCodeAt(2) % 2 === 0 && ph > 0.3 && ph < 0.3 + d) return Math.sin(((ph - 0.3) / d) * Math.PI);
  return 0;
}

const win = (t, a, b, r = 0.15) => smooth(a - r, a, t) * (1 - smooth(b, b + r, t));

export function faceAt(member, t, look) {
  const id = member.id;
  const P = member.personality;
  const m = mouthAt(id, t);
  const f = {
    blinkL: 0, blinkR: 0, happy: 0, lookX: look ? look.x : 0, lookY: look ? look.y : 0,
    brow: 0, browTilt: 0, open: m.open, wide: m.wide, round: m.round,
    smile: P.smile * (1 - m.singing * 0.7), sparkle: 0, time: t,
  };
  const b = blink(id, t);
  f.blinkL = f.blinkR = b;

  // per-member signature
  if (id === 'yzel') { f.browTilt = 0.25; f.smile += 0.05; }
  if (id === 'saya') { f.browTilt = 0.15; }
  if (id === 'liway') { f.brow = 0.15; f.sparkle = 0.6; }
  if (id === 'tala') { f.sparkle = 1; f.brow = 0.1; }
  if (id === 'amara') { f.brow = 0.05; }

  // singing emotion: high notes close the eyes a little and lift the brows
  if (m.high > 0) { f.blinkL = f.blinkR = Math.max(b, 0.55 * m.high); f.brow += 0.35 * m.high; f.browTilt -= 0.5 * m.high; }
  if (m.style === 'shout' && m.singing > 0.2) { f.brow += 0.3; f.smile = 0.6; }
  if (m.style === 'rap') { f.browTilt += 0.25 * m.singing; }

  // scripted moments
  if (id === 'tala') for (const w of [47.4, 67.4, 85.4, 175.2]) { const k = win(t, w, w + 0.45, 0.1); if (k > 0) { f.blinkR = Math.max(f.blinkR, k); f.smile = Math.max(f.smile, 0.9 * k); } }
  if (id === 'yzel' && (win(t, 136, 148) > 0 || win(t, 104, 112) > 0)) { const k = Math.max(win(t, 136, 148), win(t, 104, 112)); f.browTilt += 0.45 * k; f.blinkL = Math.max(f.blinkL, 0.18 * k); f.blinkR = Math.max(f.blinkR, 0.18 * k); }
  if (id === 'saya' && win(t, 96, 104) > 0) f.browTilt += 0.3;
  if (id === 'amara' && win(t, 148, 156) > 0) { const k = win(t, 148, 156); f.brow += 0.25 * k; f.browTilt -= 0.4 * k; }
  // head down on the rising lifts, eyes closed until the drop
  const rise = win(t, 48.6, 51.85, 0.2);
  if (rise > 0) { f.blinkL = f.blinkR = Math.max(f.blinkL, rise); }
  // final pose: happy eyes for the sweet ones, confident for the rest
  if (t > 172.3 && t < 179.8) {
    if (id === 'liway') f.happy = 1;
    f.smile = Math.max(f.smile, 0.85);
    f.open = Math.max(f.open, id === 'tala' ? 0.3 : 0.12);
  }
  // interview laugh after the punchline
  for (const iv of INTERVIEWS) {
    if (iv.who !== id) continue;
    const t1 = iv.bar * BAR + 2 * BAR;
    const tl = (TALK_END[id] || iv.bar * BAR + 3.6) + 0.12;
    const k = win(t, tl, t1, 0.12);
    if (k > 0) { f.happy = Math.max(f.happy, k); f.smile = Math.max(f.smile, k); f.open = Math.max(f.open, k * (0.3 + 0.12 * Math.sin(t * 28))); f.brow += 0.2 * k; }
  }
  f.smile = clamp(f.smile, -0.3, 1);
  return f;
}
