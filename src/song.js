// "KILIG (Worldwide)" — original song for HIRAYA.
// The vocal score below is the single source of truth: the audio engine sings it,
// the dolls lip-sync to it and the captions highlight it, so all three stay in sync.
import { BEAT, BAR, INTERVIEWS } from './timeline.js';
import { MEMBER_IDS } from './members.js';

const ALL = MEMBER_IDS;
const NOTE_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function noteToMidi(n) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(n);
  if (!m) throw new Error('bad note ' + n);
  return 12 * (parseInt(m[3], 10) + 1) + NOTE_PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

// Syllables are written with hyphens inside words: "Ma-bu-hay".
function syllabify(text) {
  const out = [];
  const words = text.trim().split(/\s+/);
  words.forEach((w, wi) => {
    const parts = w.split('-');
    parts.forEach((p, pi) => out.push({ text: p, wordEnd: pi === parts.length - 1, space: pi === parts.length - 1 && wi < words.length - 1 }));
  });
  return out;
}

const notes = [];   // { t, dur, midi, glide, who:[], syl, style, line, singer }
const lines = [];   // captions
let lineId = 0;

// Sung line: `score` tokens are "F#4/.5" or "r/.5"; "A5>Bb5/3" glides.
function sing(who, startBeat, text, score, opts = {}) {
  const syl = syllabify(text);
  const toks = score.trim().split(/\s+/);
  let beat = startBeat;
  let si = 0;
  const id = lineId++;
  const sylls = [];
  const transpose = opts.transpose || 0;
  for (const tok of toks) {
    const [n, d] = tok.split('/');
    const dur = parseFloat(d);
    if (n !== 'r') {
      const s = syl[si++];
      if (!s) { console.warn('extra note in', text); break; }
      const [a, b] = n.split('>');
      const t = beat * BEAT;
      notes.push({ t, dur: dur * BEAT, midi: noteToMidi(a) + transpose, glide: b ? noteToMidi(b) + transpose : null, who, syl: s.text, style: opts.style || 'sing', line: id, harmony: opts.harmony !== false });
      sylls.push({ text: s.text, space: s.space, t, end: t + dur * BEAT });
    }
    beat += dur;
  }
  if (si !== syl.length) console.warn('syllable/note mismatch', text, si, syl.length);
  lines.push({ id, who, text, sylls, t0: startBeat * BEAT, t1: beat * BEAT, style: opts.style || 'sing' });
  return beat;
}

// Rap line: syllables placed on a 16th grid with word-final syllables stretched.
function rap(who, barNo, text, base) {
  const syl = syllabify(text);
  const n = syl.length;
  const slots = new Array(n).fill(1);
  let extra = Math.max(0, 15 - n);
  const finals = syl.map((s, i) => (s.wordEnd ? i : -1)).filter((i) => i >= 0);
  let k = 0;
  while (extra > 0 && finals.length) { slots[finals[k % finals.length]] += 1; extra--; k++; }
  let beat = barNo * 4;
  const id = lineId++;
  const sylls = [];
  syl.forEach((s, i) => {
    const dur = slots[i] * 0.25;
    const first = i === 0 || syl[i - 1].wordEnd;
    let midi = base + (first ? 2 : 0) + (i === n - 1 ? -2 : 0) + ((i % 4 === 3) ? 1 : 0);
    const t = beat * BEAT;
    notes.push({ t, dur: Math.max(0.1, dur * BEAT * 0.92), midi, glide: i === n - 1 ? midi - 3 : null, who, syl: s.text, style: 'rap', line: id });
    sylls.push({ text: s.text, space: s.space, t, end: t + dur * BEAT });
    beat += dur;
  });
  lines.push({ id, who, text, sylls, t0: barNo * BAR, t1: beat * BEAT, style: 'rap' });
}

// Shout: rhythmic, mostly pitchless.
function shout(who, startBeat, text, rhythm, midi = 72) {
  const syl = syllabify(text);
  const durs = rhythm.trim().split(/\s+/).map(parseFloat);
  let beat = startBeat;
  const id = lineId++;
  const sylls = [];
  syl.forEach((s, i) => {
    const d = durs[i] ?? 0.5;
    const t = beat * BEAT;
    notes.push({ t, dur: d * BEAT * 0.85, midi: midi + (i === syl.length - 1 ? 2 : 0), glide: i === syl.length - 1 ? midi - 4 : null, who, syl: s.text, style: 'shout', line: id });
    sylls.push({ text: s.text, space: s.space, t, end: t + d * BEAT });
    beat += d;
  });
  lines.push({ id, who, text, sylls, t0: startBeat * BEAT, t1: beat * BEAT, style: 'shout' });
}

// Spoken interview line: syllable blips with speech intonation.
function talk(who, t0, text, maxDur = 3.15) {
  // dry run to measure, then compress to fit the interview slot
  const words0 = text.split(/\s+/);
  let total = 0;
  words0.forEach((w, wi) => {
    const count = Math.max(1, (w.toLowerCase().match(/[aeiouy]+/g) || ['a']).length);
    for (let i = 0; i < count; i++) total += 0.105 + ((wi * 7 + i * 3) % 5) * 0.012;
    total += /[.,!?”]$/.test(w) ? 0.2 : 0.035;
  });
  const k = Math.min(1, maxDur / total);
  return talkScaled(who, t0, text, k);
}
function talkScaled(who, t0, text, k) {
  const words = text.split(/\s+/);
  const id = lineId++;
  const sylls = [];
  let t = t0;
  const basePitch = { amara: 67, yzel: 64, liway: 70, saya: 62, tala: 71 }[who];
  words.forEach((w, wi) => {
    const groups = w.toLowerCase().match(/[aeiouy]+/g) || ['a'];
    const count = Math.max(1, groups.length);
    const wordStart = t;
    for (let i = 0; i < count; i++) {
      const dur = (0.105 + ((wi * 7 + i * 3) % 5) * 0.012) * k;
      const rise = /[?]$/.test(w) && i === count - 1 ? 4 : 0;
      const fall = /[.!]$/.test(w) && i === count - 1 ? -3 : 0;
      const onset = i === 0 ? (w.toLowerCase().match(/^[^aeiouy]*/)[0] || '') : '';
      notes.push({ t, dur: dur * 0.85, midi: basePitch + ((wi + i) % 3) - 1 + rise + fall, glide: null, who: [who], syl: onset.replace(/[^a-z]/g, '') + groups[i], style: 'talk', line: id });
      t += dur;
    }
    sylls.push({ text: w, space: wi < words.length - 1, t: wordStart, end: t });
    t += (/[.,!?”]$/.test(w) ? 0.2 : 0.035) * k;
  });
  lines.push({ id, who: [who], text, sylls, t0, t1: t, style: 'talk' });
  return t;
}

// ---------- the score ----------
const B = (bar, beat = 0) => bar * 4 + beat;

// Intro drop call
shout(ALL, B(26), 'HI-RA-YA!', '.5 .5 1.5', 74);

// Verse 1 — Amara, then Liway
sing(['amara'], B(28), 'Sa i-la-lim ng i-law ng May-ni-la', 'r/.5 F#4/.5 F#4/.5 A4/.5 B4/.5 A4/.5 B4/.5 D5/1 C#5/.5 B4/.5 A4/.5 B4/1.5 r/.5');
sing(['amara'], B(30), 'Su-ma-sa-yaw ang bu-ong mun-do', 'r/.5 F#4/.5 A4/.5 B4/.5 D5/1 B4/.5 A4/.5 F#4/.5 F#4/1 E4/2 r/.5');
sing(['liway'], B(32), 'Ev-ery heart-beat, ev-ery light', 'r/.5 F#4/.5 A4/.5 B4/.5 D5/1 C#5/.5 B4/.5 A4/2.5 r/1.5');
sing(['liway'], B(34), 'Ti-na-ta-wag ang pa-nga-lan mo', 'r/.5 F#4/.5 A4/.5 B4/.5 D5/1 E5/.5 D5/.5 C#5/.5 B4/1 A4/2 r/.5');

// Pre-chorus 1 — Tala, group call
sing(['tala'], B(36), 'Ram-dam mo ba? Ram-dam mo ba?', 'D5/.5 D5/.5 E5/.5 F#5/1.5 r/.5 D5/.5 D5/.5 E5/.5 A5/1.5 r/1.5');
sing(['tala'], B(38), 'Ku-mi-ki-nang ang ga-bi, oh', 'F#5/.5 F#5/.5 E5/.5 D5/.5 E5/.5 F#5/.5 E5/1 C#5/2 r/2');
shout(ALL, B(39, 2), 'Rea-dy na ba ka-yo?', '.25 .25 .25 .25 .25 .75', 72);

function chorus(startBar, transpose = 0, adlibs = 0) {
  const o = { transpose };
  sing(ALL, B(startBar), 'Ki-lig, ki-lig, world-wide!', 'A4/.5 D5/1 A4/.5 D5/1 F#5/1 E5/1.5 r/2.5', o);
  shout(ALL, B(startBar + 1, 2.5), 'Hey!', '.5', 76 + transpose);
  sing(ALL, B(startBar + 2), 'Hi-ra-ya sa \'yong pu-so', 'D5/.5 E5/.5 F#5/1 E5/.5 D5/.5 B4/1 A4/2 r/2', o);
  sing(ALL, B(startBar + 4), 'Ki-lig, ki-lig, sa-ma-sa-ma', 'A4/.5 D5/1 A4/.5 D5/1 F#5/.5 E5/.5 D5/.5 E5/1.5 r/2', o);
  sing(ALL, B(startBar + 6), 'A-bot na-tin ang bi-tu-in!', 'D5/.5 E5/.5 F#5/.5 G5/.5 A5/1 F#5/.5 E5/.5 D5/2.5 r/1.5', o);
  if (adlibs === 1) {
    sing(['amara'], B(startBar + 3, 2), 'Woah-oh!', 'A5/1 F#5/1', { transpose, harmony: false });
    sing(['liway', 'tala'], B(startBar + 5, 2), 'Sa-ma-sa-ma!', 'F#5/.5 E5/.5 D5/.5 E5/.5', { transpose, harmony: false });
  } else if (adlibs === 2) {
    shout(['saya'], B(startBar + 3, 2.5), 'Let\'s go!', '.5 1', 66 + transpose);
    shout(['yzel'], B(startBar + 5, 2.5), 'Hey!', '1', 70 + transpose);
  }
}

chorus(40);

// Rap — Saya, then Yzel
rap(['saya'], 48, 'Mu-la Ton-do hang-gang To-kyo, si-gaw ni-la Ma-bu-hay!', 59);
rap(['saya'], 49, 'Pa-ris, Seoul, New York, sold out la-hat ng a-raw', 59);
rap(['saya'], 50, 'Hin-di lang ka-mi bi-tu-in, ka-mi\'y bag-yong may ki-nang', 60);
rap(['saya'], 51, 'Sa-ya sa mic, ta-ra na, sa-bay sa-bay!', 59);
rap(['yzel'], 52, 'Y-zel sa sa-hig, pa-ra kang na-ka-ki-ta ng kid-lat', 62);
rap(['yzel'], 53, 'Ga-law ng Pi-nay, bu-ong mun-do na-pa-wow', 62);
rap(['yzel'], 54, 'Step, slide, turn, sa-bay sa beat ko', 63);
rap(['yzel'], 55, 'From Ma-ni-la to the world, HI-RA-YA, go!', 62);

// Pre-chorus 2 — Liway, Tala
sing(['liway'], B(56), 'Ha-wak ka-may, ha-wak ka-may', 'D5/.5 D5/.5 E5/.5 F#5/1.5 r/.5 D5/.5 D5/.5 E5/.5 A5/1.5 r/1.5');
sing(['tala'], B(58), 'Sa-ma-sa-ma ta-yo nga-yon', 'F#5/.5 F#5/.5 E5/.5 D5/.5 E5/.5 F#5/.5 E5/1 C#5/2 r/2');
shout(ALL, B(59, 2), 'Rea-dy na ba ka-yo?', '.25 .25 .25 .25 .25 .75', 72);

chorus(60, 0, 1);

// Dance break calls
shout(ALL, B(68), 'Hey!', '.5', 76);
shout(ALL, B(70), 'Hey!', '.5', 76);
shout(['saya', 'tala'], B(71, 2), 'Go, Y-zel!', '.5 .5 1', 72);
shout(ALL, B(72), 'Hi-ra-ya!', '.5 .5 1', 74);
shout(['yzel'], B(73, 3), 'Ha!', '.5', 72);

// Bridge — Amara, ends on the big held note into the key change
sing(['amara'], B(74), 'Ka-hit sa-an ka man sa mun-do', 'r/.5 D5/.5 E5/.5 F#5/.5 G5/1 F#5/.5 E5/.5 D5/.5 E5/.5 F#5/2.5');
sing(['amara'], B(76), 'Hi-ra-ya ma-na-wa-ri, ah', 'F#5/.5 G5/.5 A5/1 G5/.5 F#5/.5 E5/.5 F#5/1 A5>Bb5/3.5');

// Final chorus — up a half step, with ad-libs
chorus(78, 1, 1);
shout(['saya'], B(85, 2.5), 'Let\'s go!', '.5 1', 67);
shout(ALL, B(86), 'Ma-bu-hay!', '.5 .5 2', 75);

// Backstage interviews
for (const iv of INTERVIEWS) talk(iv.who, iv.bar * BAR + 0.55, iv.line);

notes.sort((a, b) => a.t - b.t);
lines.sort((a, b) => a.t0 - b.t0);

export const VOCAL_NOTES = notes;
export const LYRIC_LINES = lines;

// Per-member note lists for lip-sync.
export const NOTES_BY_MEMBER = Object.fromEntries(MEMBER_IDS.map((id) => [id, notes.filter((n) => n.who.includes(id))]));

// Phrases (for raising the microphone ahead of singing).
export const PHRASES_BY_MEMBER = Object.fromEntries(MEMBER_IDS.map((id) => {
  const list = NOTES_BY_MEMBER[id].filter((n) => n.style !== 'talk');
  const out = [];
  for (const n of list) {
    const last = out[out.length - 1];
    if (last && n.t - last.t1 < 1.6) last.t1 = Math.max(last.t1, n.t + n.dur);
    else out.push({ t0: n.t, t1: n.t + n.dur });
  }
  return [id, out];
}));

// ---------- harmony ----------
// One chord per bar (or two per bar as an array). Roots in MIDI, octave 3.
const C = (root, q) => ({ root: noteToMidi(root), q });
const D = C('D3', 'maj'), A = C('A2', 'maj'), Bm = C('B2', 'min'), G = C('G2', 'maj'), Fsm = C('F#2', 'min');
const G7 = C('G2', 'maj7'), Fsm7 = C('F#2', 'm7'), Bm7 = C('B2', 'm7'), Asus = C('A2', 'sus4'), Bb = C('Bb2', 'maj');
const Eb = C('Eb3', 'maj'), Bbh = C('Bb2', 'maj'), Cm = C('C3', 'min'), Ab = C('Ab2', 'maj'), Ab7 = C('Ab2', 'maj7');

export const CHORDS = [];
const put = (from, prog) => prog.forEach((c, i) => { CHORDS[from + i] = c; });
put(0, [G7, A, Fsm7, Bm7]);
put(4, [G7, A, Fsm7, Bm7, D, A, Bm, G, Asus]);
put(13, [G7, D, A, Bm, G, D, A, Bm, G, D, A]);
put(24, [Bm, Asus]);
put(26, [Bm, [G, A]]);
put(28, [Bm, G, D, A, Bm, G, D, A]);
put(36, [G, A, Bm, A]);
put(40, [D, A, Bm, G, D, A, Bm, G]);
put(48, [Bm, G, D, A, Bm, G, D, A]);
put(56, [G, A, Bm, A]);
put(60, [D, A, Bm, G, D, A, Bm, G]);
put(68, [Bm, G, D, A, Bm, A]);
put(74, [G, A, Bm, Bb]);
put(78, [Eb, Bbh, Cm, Ab, Eb, Bbh, Cm, Ab]);
put(86, [Eb, Eb]);
put(88, [Ab7, Eb]);

export function chordTones(c) {
  const iv = { maj: [0, 4, 7], min: [0, 3, 7], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus4: [0, 5, 7] }[c.q];
  return iv.map((i) => c.root + i);
}

export function keyShiftAtBar(b) { return b >= 78 ? 1 : 0; }
