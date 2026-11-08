// Web Audio engine: an original P-POP track, five synthesized idol voices,
// kulintang gongs, and a 100,000-person crowd. Everything is generated in code.
import { BEAT, BAR, DURATION, SECTIONS } from './timeline.js';
import { VOCAL_NOTES, CHORDS, chordTones, keyShiftAtBar } from './song.js';
import { MEMBER_BY_ID } from './members.js';
import { phonemes, FORMANTS } from './phonetics.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const SCALE = [0, 2, 4, 5, 7, 9, 11];

function sectionIdOfBar(b) {
  for (const s of SECTIONS) if (b >= s.start && b < s.end) return s.id;
  return 'outro';
}
function chordAt(b, beat) {
  const c = CHORDS[b];
  if (Array.isArray(c)) return beat < 2 ? c[0] : c[1];
  return c || CHORDS[0];
}
function harmonyThird(m, tonic) {
  const rel = ((m - tonic) % 12 + 12) % 12;
  const d = SCALE.indexOf(rel);
  if (d < 0) return m + 4;
  return m + ((SCALE[(d + 2) % 7] - SCALE[d] + 12) % 12);
}
function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------- arrangement → event list ----------------
export function buildEvents() {
  const ev = [];
  const push = (t, type, p = {}) => ev.push({ t, type, ...p });
  const r = rng(7);
  const PENTA = [0, 2, 4, 7, 9];

  const gongMotif = (t, shift, v = 0.5) => {
    const seq = [81, 78, 76, 74, 76, 78, 81, 83, 81, 78, 76, 78, 74];
    const dur = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 2];
    let x = t;
    seq.forEach((m, i) => { push(x, 'gong', { midi: m + shift, v }); x += dur[i] * BEAT; });
  };
  const hook = (t, shift, inst = 'gong', v = 0.45) => {
    // chorus melody "Ki-lig, ki-lig, world-wide" + "Hi-ra-ya sa 'yong puso"
    const m = [[69, .5], [74, 1], [69, .5], [74, 1], [78, 1], [76, 1.5], [0, 2.5], [74, .5], [76, .5], [78, 1], [76, .5], [74, .5], [71, 1], [69, 2], [0, 2]];
    let x = t;
    for (const [n, d] of m) { if (n) push(x, inst, { midi: n + shift, v, dur: d * BEAT }); x += d * BEAT; }
  };

  for (let b = 0; b < 90; b++) {
    const sec = sectionIdOfBar(b);
    const t0 = b * BAR;
    const ks = keyShiftAtBar(b);
    const c0 = chordAt(b, 0);
    const c2 = chordAt(b, 2);
    const at = (beat) => t0 + beat * BEAT;
    const padBar = (v = 0.5, filt = 1400) => {
      if (Array.isArray(CHORDS[b])) {
        push(at(0), 'pad', { notes: chordTones(c0).map((n) => n + 12), dur: BAR / 2, v, filt });
        push(at(2), 'pad', { notes: chordTones(c2).map((n) => n + 12), dur: BAR / 2, v, filt });
      } else push(at(0), 'pad', { notes: chordTones(c0).map((n) => n + 12), dur: BAR, v, filt });
    };
    const bassNote = (beat, dur, v = 0.6, oct = 0) => {
      const c = chordAt(b, beat);
      push(at(beat), 'bass', { midi: c.root + oct, dur: dur * BEAT, v });
    };
    const fourFloor = (v = 0.95) => { for (let i = 0; i < 4; i++) push(at(i), 'kick', { v, pump: true }); };
    const clap13 = (v = 0.6) => { push(at(1), 'clap', { v }); push(at(3), 'clap', { v }); };
    const hats8 = (v = 0.18, off = true) => { for (let i = 0; i < 8; i++) push(at(i * 0.5), 'hat', { v: (i % 2 ? v : v * 0.6), open: off && i % 2 === 1 }); };
    const hats16 = (v = 0.13) => { for (let i = 0; i < 16; i++) push(at(i * 0.25), 'hat', { v: v * (i % 4 === 2 ? 1.2 : i % 2 ? 0.6 : 0.9) }); };
    const arp = (v = 0.22, rate = 0.25, oct = 24) => {
      const pat = [0, 1, 2, 1, 2, 3, 2, 1];
      for (let i = 0; i < 4 / rate; i++) {
        const c = chordAt(b, i * rate);
        const tones = chordTones(c);
        const idx = pat[i % pat.length] % (tones.length + 1);
        const m = idx === tones.length ? tones[0] + 12 : tones[idx];
        push(at(i * rate), 'pluck', { midi: m + oct, v, dur: rate * BEAT * 0.9 });
      }
    };
    const stabs = (v = 0.35) => {
      for (const [beat, d] of [[0, 0.5], [0.75, 0.5], [1.5, 0.5], [2.5, 0.5], [3.25, 0.5]]) {
        const c = chordAt(b, beat);
        push(at(beat), 'stab', { notes: chordTones(c).map((n) => n + 24), dur: d * BEAT, v });
      }
    };
    const snareRoll = (v = 0.5, div = 16) => {
      const n = div;
      for (let i = 0; i < n; i++) push(at(i * 4 / n), 'snare', { v: v * (0.25 + 0.75 * i / n) });
    };

    switch (sec) {
      case 'open':
        padBar(0.55, 900 + b * 200);
        if (b % 2 === 0) gongMotif(at(0), 0, 0.42);
        for (let i = 0; i < 4; i++) push(at(i + r() * 0.5), 'chime', { midi: 86 + PENTA[Math.floor(r() * 5)], v: 0.08 });
        break;
      case 'city':
        padBar(0.45, 1600);
        if (b < 8 && b % 2 === 0) gongMotif(at(0), 0, 0.38);
        if (b >= 8 && b < 12) {
          push(at(0), 'kick', { v: 0.8 }); push(at(1.75), 'kick', { v: 0.5 }); push(at(2.5), 'kick', { v: 0.7 });
          push(at(1), 'snare', { v: 0.42 }); push(at(3), 'snare', { v: 0.42 });
          hats8(0.12, false);
          bassNote(0, 0.75, 0.5); bassNote(1.5, 0.5, 0.4); bassNote(2.5, 1, 0.45);
          if (b === 8) hook(at(0), 12, 'pluck', 0.3);
        }
        if (b === 12) { push(at(0), 'riser', { dur: BAR, v: 0.5 }); push(at(3.5), 'whoosh', { v: 0.6 }); }
        break;
      case 'backstage':
        padBar(0.5, 1200);
        if (b >= 14) {
          push(at(0), 'kick', { v: 0.7 }); push(at(2.5), 'kick', { v: 0.6 });
          push(at(1), 'snare', { v: 0.35 }); push(at(3), 'snare', { v: 0.35 });
          hats8(0.1, false);
          bassNote(0, 1.5, 0.55); bassNote(2.5, 1.5, 0.45);
          if (b % 4 === 2) hook(at(0), 12, 'pluck', 0.22);
        }
        if (b === 23) push(at(2), 'whoosh', { v: 0.5 });
        break;
      case 'reveal':
        padBar(0.45, 700);
        for (let i = 0; i < 4; i += 1) { push(at(i), 'kick', { v: 0.75 }); push(at(i + 0.3), 'kick', { v: 0.45 }); }
        push(at(0), 'chant', { text: 'HI-RA-YA', v: 0.55 });
        push(at(2), 'clap', { v: 0.45 }); push(at(2.5), 'clap', { v: 0.45 }); push(at(3), 'clap', { v: 0.45 });
        if (b === 25) { push(at(0), 'riser', { dur: BAR, v: 0.7 }); snareRoll(0.45, 16); }
        if (b === 24) push(at(0), 'impact', { v: 0.45 });
        break;
      case 'drop':
        if (b === 26) { push(at(0), 'impact', { v: 1 }); push(at(0), 'crash', { v: 0.6 }); hook(at(0), 0, 'gong', 0.5); }
        fourFloor(); clap13(); hats8(0.2);
        for (let i = 0; i < 4; i++) bassNote(i + 0.5, 0.45, 0.6);
        stabs(0.32);
        break;
      case 'verse1':
        push(at(0), 'kick', { v: 0.95 }); push(at(1.5), 'kick', { v: 0.7 }); push(at(2.5), 'kick', { v: 0.85 });
        if (b % 2) push(at(3.5), 'kick', { v: 0.55 });
        push(at(1), 'snare', { v: 0.5 }); push(at(3), 'snare', { v: 0.5 });
        hats8(0.15, false);
        bassNote(0, 0.75, 0.6); bassNote(1.5, 0.5, 0.5); bassNote(2.5, 0.5, 0.55); bassNote(3.25, 0.5, 0.45, 12);
        arp(0.13, 0.5, 24);
        padBar(0.3, 1200);
        break;
      case 'pre1': case 'pre2':
        fourFloor(0.8); clap13(0.5);
        if (b % 4 === 3) { hats16(0.12); snareRoll(0.5, 16); push(at(0), 'riser', { dur: BAR, v: 0.6 }); }
        else hats8(0.15);
        for (let i = 0; i < 8; i++) bassNote(i * 0.5, 0.4, 0.45);
        padBar(0.45, 2000 + (b % 4) * 600);
        for (let i = 0; i < 8; i++) {
          const c = chordAt(b, i * 0.5);
          const tones = chordTones(c);
          push(at(i * 0.5), 'gong', { midi: tones[i % tones.length] + 24, v: 0.22 });
        }
        break;
      case 'chorus1': case 'chorus2': case 'final': {
        const startBar = sec === 'chorus1' ? 40 : sec === 'chorus2' ? 60 : 78;
        const k = b - startBar;
        if (k === 0) { push(at(0), 'impact', { v: 0.9 }); push(at(0), 'crash', { v: 0.6 }); }
        if (sec === 'final' && k % 4 === 0 && k) push(at(0), 'crash', { v: 0.45 });
        fourFloor(); clap13(0.62); hats8(0.2); hats16(0.06);
        for (let i = 0; i < 4; i++) { bassNote(i, 0.25, 0.5); bassNote(i + 0.5, 0.45, 0.62); }
        stabs(0.3);
        arp(0.11, 0.25, 24);
        padBar(0.25, 2400);
        if (k === 4 || (sec === 'final' && k === 0)) hook(at(0), 12 + ks, 'gong', 0.24);
        if (k === 7 && sec !== 'final') push(at(2), 'riser', { dur: BAR / 2, v: 0.35 });
        break;
      }
      case 'rap':
        push(at(0), 'kick', { v: 1 }); push(at(0.75), 'kick', { v: 0.7 }); push(at(2.25), 'kick', { v: 0.8 }); push(at(2.75), 'kick', { v: 0.6 });
        push(at(2), 'clap', { v: 0.7 }); push(at(2), 'snare', { v: 0.45 });
        if (b % 2) push(at(3.75), 'snare', { v: 0.3 });
        hats16(0.12);
        if (b % 2) for (let i = 0; i < 6; i++) push(at(3 + i / 6), 'hat', { v: 0.1 + i * 0.015 });
        push(at(0), 'sub', { midi: chordAt(b, 0).root, dur: 1.6 * BEAT, v: 0.75 });
        push(at(2.25), 'sub', { midi: chordAt(b, 2).root + 7, dur: 1.4 * BEAT, v: 0.6, glide: chordAt(b, 2).root });
        padBar(0.28, 900);
        if (b === 48) { push(at(0), 'crash', { v: 0.45 }); push(at(0), 'impact', { v: 0.5 }); }
        break;
      case 'dance': {
        const k = b - 68;
        if (k === 0 || k === 4) { push(at(0), 'impact', { v: 1 }); push(at(0), 'crash', { v: 0.55 }); }
        const stop = k === 5;
        for (let i = 0; i < 4; i++) if (!(stop && i === 3)) push(at(i), 'kick', { v: 1, pump: true });
        if (!stop) push(at(3.75), 'kick', { v: 0.6 });
        clap13(0.7);
        if (stop) { for (let i = 0; i < 12; i++) push(at(i * 0.25), 'snare', { v: 0.25 + i * 0.04 }); }
        else hats16(0.14);
        for (let i = 0; i < (stop ? 12 : 16); i++) { const c = chordAt(b, i * 0.25); push(at(i * 0.25), 'bass', { midi: c.root + (i % 2 ? 12 : 0), dur: 0.22 * BEAT, v: 0.55 }); }
        const lead = [83, 81, 78, 81, 83, 86, 83, 81, 78, 76, 78, 81, 83, 81, 78, 76];
        for (let i = 0; i < (stop ? 12 : 16); i++) push(at(i * 0.25), 'gong', { midi: lead[(i + k * 4) % 16], v: 0.3 });
        if (!stop) stabs(0.22);
        break;
      }
      case 'bridge': {
        const k = b - 74;
        padBar(0.5, 1800);
        for (let i = 0; i < 4; i++) {
          const c = chordAt(b, i);
          const tones = chordTones(c);
          push(at(i), 'keys', { midi: tones[i % tones.length] + 24, v: 0.22, dur: BEAT * 1.6 });
        }
        push(at(0), 'bass', { midi: chordAt(b, 0).root, dur: BAR * 0.95, v: 0.5 });
        if (k === 2) for (let i = 0; i < 4; i++) push(at(i), 'kick', { v: 0.55 + i * 0.08 });
        if (k === 3) { for (let i = 0; i < 8; i++) push(at(i * 0.5), 'kick', { v: 0.7 }); snareRoll(0.55, 24); push(at(0), 'riser', { dur: BAR, v: 0.8 }); }
        break;
      }
      case 'ending':
        if (b === 86) {
          push(at(0), 'impact', { v: 1.1 }); push(at(0), 'crash', { v: 0.8 });
          push(at(0), 'stab', { notes: chordTones(CHORDS[86]).map((n) => n + 24), dur: BAR * 0.9, v: 0.5 });
          push(at(0), 'pad', { notes: chordTones(CHORDS[86]).map((n) => n + 12), dur: BAR * 2, v: 0.5, filt: 3000 });
          push(at(0), 'sub', { midi: CHORDS[86].root - 12, dur: BAR, v: 0.8 });
          for (let i = 0; i < 6; i++) push(at(0.5 + i * 0.55), 'chime', { midi: 87 + PENTA[i % 5], v: 0.1 });
        }
        break;
      case 'outro':
        push(at(0), 'pad', { notes: chordTones(CHORDS[b]).map((n) => n + 12), dur: BAR, v: 0.38, filt: 1100 });
        if (b === 88) gongMotif(at(0), 1, 0.3);
        if (b === 89) push(at(1), 'chime', { midi: 99, v: 0.15 });
        break;
    }
  }
  for (const n of VOCAL_NOTES) push(n.t, 'voice', { note: n });
  ev.sort((a, b) => a.t - b.t);
  return ev;
}

// ---------------- automation lanes (functions of song time) ----------------
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function lanes(t) {
  // muffle filter for music+crowd (backstage = through the walls)
  let muffle = 18000;
  if (t < 16) muffle = 2200 + smooth(0, 16, t) * 15800;
  if (t >= 26 && t < 48) muffle = 650;
  if (t >= 47 && t < 48) muffle = 650 + smooth(47, 48, t) * 17000;
  let crowd = 0;
  if (t >= 26 && t < 48) crowd = 0.16;
  if (t >= 48) {
    crowd = 0.55 + 0.45 * smooth(48, 51.5, t);
    if (t > 52) crowd = 0.38 + 0.6 * Math.exp(-(t - 52) * 0.5);
    const swells = [80, 96, 120, 136, 156, 172];
    for (const s of swells) if (t > s - 1 && t < s + 6) crowd = Math.max(crowd, 0.42 + 0.4 * Math.exp(-Math.abs(t - s) * 0.6));
    if (t >= 148 && t < 156) crowd = Math.min(crowd, 0.28);
    if (t >= 172) crowd = 0.5 + 0.55 * Math.exp(-(t - 172) * 0.35);
    if (t > 177) crowd *= Math.max(0, (180 - t) / 3);
  }
  let master = 1;
  if (t < 0.8) master = t / 0.8;
  if (t > 178.4) master = Math.max(0, (180 - t) / 1.6);
  let music = 1;
  if (t >= 26 && t < 48) music = 0.72;
  return { muffle, crowd, master, music };
}

// ---------------- the engine ----------------
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.events = buildEvents();
    this.playing = false;
    this.live = new Set();
    this.idx = 0;
    this.t0ctx = 0;
    this.offset = 0;
  }

  async init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC({ latencyHint: 'playback' });
    this.graph = makeGraph(this.ctx);
    this.crowdSrc = null;
  }

  get time() {
    if (!this.ctx || !this.playing) return this.offset;
    const lat = (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0);
    return Math.max(0, Math.min(DURATION, this.ctx.currentTime - this.t0ctx - lat));
  }

  async play(from = this.offset) {
    await this.init();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.stopAll();
    this.offset = from;
    this.t0ctx = this.ctx.currentTime + 0.08 - from;
    this.idx = lowerBound(this.events, from - 0.001);
    this.playing = true;
    this.startCrowd();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
  }

  setVolume(v) {
    this.volume = v;
    if (this.graph) this.graph.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  pause() {
    if (!this.playing) return;
    this.offset = this.time;
    this.playing = false;
    clearInterval(this.timer);
    this.stopAll();
  }

  seek(t) {
    const was = this.playing;
    this.pause();
    this.offset = Math.max(0, Math.min(DURATION, t));
    if (was) this.play(this.offset);
  }

  stopAll() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const n of this.live) { try { n.stop(now + 0.02); } catch (e) { /* already stopped */ } }
    this.live.clear();
    if (this.crowdSrc) { try { this.crowdSrc.stop(now + 0.05); } catch (e) { /* */ } this.crowdSrc = null; }
    const g = this.graph;
    for (const p of [g.duck.gain, g.muffle.frequency, g.crowdGain.gain, g.master.gain, g.musicGain.gain]) p.cancelScheduledValues(now);
    g.duck.gain.setValueAtTime(1, now);
    g.master.gain.setValueAtTime(0, now);
  }

  startCrowd() {
    const g = this.graph;
    if (!g.crowdBuffer) g.crowdBuffer = makeCrowdBuffer(this.ctx);
    const src = this.ctx.createBufferSource();
    src.buffer = g.crowdBuffer; src.loop = true;
    src.connect(g.crowdIn);
    src.start(this.ctx.currentTime + 0.02, (this.offset * 0.37) % g.crowdBuffer.duration);
    this.crowdSrc = src;
  }

  tick() {
    if (!this.playing) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const songNow = now - this.t0ctx;
    const horizon = songNow + 0.25;
    while (this.idx < this.events.length && this.events[this.idx].t < horizon) {
      const e = this.events[this.idx++];
      if (e.t < songNow - 0.05) continue;
      const when = Math.max(now + 0.005, e.t + this.t0ctx);
      const nodes = play(ctx, this.graph, e, when);
      if (nodes) for (const n of nodes) { this.live.add(n); n.onended = () => this.live.delete(n); }
    }
    // lanes
    const L = lanes(Math.max(0, songNow + 0.06));
    const tt = now + 0.06;
    const g = this.graph;
    g.muffle.frequency.linearRampToValueAtTime(L.muffle, tt);
    g.crowdGain.gain.linearRampToValueAtTime(L.crowd * 0.55, tt);
    g.master.gain.linearRampToValueAtTime(L.master * 0.85, tt);
    g.musicGain.gain.linearRampToValueAtTime(L.music, tt);
    if (songNow >= DURATION) { this.pause(); this.offset = DURATION; this.onended && this.onended(); }
  }

  // Render the full 180 s offline (used for video export and testing).
  // Rendered in short chunks with a pre-roll so only a few seconds of nodes exist at once.
  static async renderOffline(sampleRate = 44100, { chunk = 10, pre = 4, onProgress } = {}) {
    const events = buildEvents();
    const total = Math.ceil(DURATION * sampleRate);
    const outL = new Float32Array(total), outR = new Float32Array(total);
    for (let a = 0; a < DURATION; a += chunk) {
      const b = Math.min(DURATION, a + chunk);
      const s = Math.max(0, a - pre);
      const ctx = new OfflineAudioContext(2, Math.ceil((b - s) * sampleRate), sampleRate);
      const g = makeGraph(ctx);
      g.master.gain.setValueAtTime(lanes(s).master * 0.85, 0);
      for (const e of events) if (e.t >= s && e.t < b) play(ctx, g, e, e.t - s);
      g.crowdBuffer = makeCrowdBuffer(ctx);
      const src = ctx.createBufferSource();
      src.buffer = g.crowdBuffer; src.loop = true; src.connect(g.crowdIn); src.start(0, s % g.crowdBuffer.duration);
      for (let t = s; t <= b + 0.001; t += 0.05) {
        const L = lanes(t), x = t - s;
        g.muffle.frequency.linearRampToValueAtTime(L.muffle, x);
        g.crowdGain.gain.linearRampToValueAtTime(L.crowd * 0.55, x);
        g.master.gain.linearRampToValueAtTime(L.master * 0.85, x);
        g.musicGain.gain.linearRampToValueAtTime(L.music, x);
      }
      const buf = await ctx.startRendering();
      const off = Math.round((a - s) * sampleRate), dst = Math.round(a * sampleRate);
      const n = Math.min(Math.round((b - a) * sampleRate), total - dst, buf.length - off);
      outL.set(buf.getChannelData(0).subarray(off, off + n), dst);
      outR.set(buf.getChannelData(1).subarray(off, off + n), dst);
      if (onProgress) onProgress(b / DURATION);
    }
    return { sampleRate, length: total, duration: DURATION, numberOfChannels: 2, getChannelData: (i) => (i ? outR : outL) };
  }
}

function lowerBound(arr, t) {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid].t < t) lo = mid + 1; else hi = mid; }
  return lo;
}

// ---------------- graph ----------------
function makeGraph(ctx) {
  const g = {};
  g.master = ctx.createGain(); g.master.gain.value = 0;
  g.comp = ctx.createDynamicsCompressor();
  g.comp.threshold.value = -16; g.comp.knee.value = 12; g.comp.ratio.value = 3.5; g.comp.attack.value = 0.004; g.comp.release.value = 0.18;
  g.pre = ctx.createGain(); g.pre.gain.value = 0.8;
  g.out = ctx.createGain(); g.out.gain.value = 1;
  g.pre.connect(g.comp); g.comp.connect(g.master); g.master.connect(g.out); g.out.connect(ctx.destination);

  g.muffle = ctx.createBiquadFilter(); g.muffle.type = 'lowpass'; g.muffle.frequency.value = 18000; g.muffle.Q.value = 0.5;
  g.musicGain = ctx.createGain();
  g.muffle.connect(g.musicGain); g.musicGain.connect(g.pre);
  g.duck = ctx.createGain(); g.duck.connect(g.muffle);
  g.drums = ctx.createGain(); g.drums.gain.value = 0.9; g.drums.connect(g.muffle);
  g.music = ctx.createGain(); g.music.gain.value = 0.7; g.music.connect(g.duck);
  g.bass = ctx.createGain(); g.bass.gain.value = 0.75; g.bass.connect(g.duck);
  g.vox = ctx.createGain(); g.vox.gain.value = 1.0; g.vox.connect(g.pre);
  g.fx = ctx.createGain(); g.fx.gain.value = 0.7; g.fx.connect(g.pre);

  g.crowdIn = ctx.createGain();
  g.crowdGain = ctx.createGain(); g.crowdGain.gain.value = 0;
  g.crowdLP = ctx.createBiquadFilter(); g.crowdLP.type = 'lowpass'; g.crowdLP.frequency.value = 6000;
  g.crowdIn.connect(g.crowdGain); g.crowdGain.connect(g.crowdLP); g.crowdLP.connect(g.muffle);

  g.verb = ctx.createConvolver(); g.verb.buffer = makeIR(ctx, 2.6);
  g.verbRet = ctx.createGain(); g.verbRet.gain.value = 0.55;
  g.verb.connect(g.verbRet); g.verbRet.connect(g.pre);
  g.verbSend = ctx.createGain(); g.verbSend.connect(g.verb);

  g.delay = ctx.createDelay(1); g.delay.delayTime.value = BEAT * 0.75;
  g.delayFb = ctx.createGain(); g.delayFb.gain.value = 0.32;
  g.delayLP = ctx.createBiquadFilter(); g.delayLP.type = 'lowpass'; g.delayLP.frequency.value = 3200;
  g.delay.connect(g.delayLP); g.delayLP.connect(g.delayFb); g.delayFb.connect(g.delay);
  g.delayOut = ctx.createGain(); g.delayOut.gain.value = 0.35; g.delayLP.connect(g.delayOut); g.delayOut.connect(g.duck);

  const len = ctx.sampleRate * 2;
  g.noise = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = g.noise.getChannelData(0);
  const r = rng(99);
  for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;
  return g;
}

function makeIR(ctx, seconds) {
  const sr = ctx.sampleRate, len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, len, sr);
  const r = rng(3);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const n = r() * 2 - 1;
      lp += (n - lp) * (0.9 - 0.6 * (t / seconds));
      d[i] = lp * Math.pow(1 - t / seconds, 2.2) * (t < 0.012 ? t / 0.012 : 1);
    }
  }
  return buf;
}

function makeCrowdBuffer(ctx) {
  const sr = ctx.sampleRate, secs = 8, len = sr * secs;
  const buf = ctx.createBuffer(2, len, sr);
  const r = rng(42);
  const screams = [];
  for (let i = 0; i < 70; i++) screams.push({ t: r() * secs, d: 0.4 + r() * 1.4, f: 700 + r() * 1300, v: 0.04 + r() * 0.05, vib: 4 + r() * 4, ch: r() < 0.5 ? 0 : 1, ph: 0 });
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b1 = 0, b2 = 0, env = 0.6, target = 0.6;
    for (let i = 0; i < len; i++) {
      if (i % 2205 === 0) target = 0.45 + r() * 0.55;
      env += (target - env) * 0.0004;
      const n = r() * 2 - 1;
      b1 += (n - b1) * 0.12; // low murmur
      b2 += (n - b2) * 0.45;
      d[i] = (b1 * 0.9 + (b2 - b1) * 0.5) * env * 0.6;
    }
    for (const s of screams) {
      if (s.ch !== ch) continue;
      const i0 = Math.floor(s.t * sr), n = Math.floor(s.d * sr);
      let ph = 0;
      for (let k = 0; k < n; k++) {
        const i = (i0 + k) % len;
        const tt = k / sr;
        const f = s.f * (1 + 0.15 * Math.min(1, tt * 3)) * (1 + 0.012 * Math.sin(2 * Math.PI * s.vib * tt));
        ph += 2 * Math.PI * f / sr;
        const e = Math.sin(Math.PI * k / n);
        d[i] += (Math.sin(ph) + 0.35 * Math.sin(2 * ph) + 0.2 * (r() - 0.5)) * s.v * e * e;
      }
    }
    // seamless loop
    const fade = sr * 0.5;
    for (let i = 0; i < fade; i++) { const a = i / fade; d[i] = d[i] * a + d[len - fade + i] * (1 - a); }
  }
  return buf;
}

// ---------------- instruments ----------------
function env(g, t, a, peak, hold, rel) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  if (hold > 0) g.gain.setValueAtTime(peak, t + a + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
  return t + a + hold + rel;
}
function noiseSrc(ctx, g, t, dur) {
  const s = ctx.createBufferSource();
  s.buffer = g.noise; s.loop = true;
  s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  return s;
}
function panner(ctx, p) {
  if (ctx.createStereoPanner) { const n = ctx.createStereoPanner(); n.pan.value = p; return n; }
  return ctx.createGain();
}

function play(ctx, g, e, t) {
  switch (e.type) {
    case 'kick': {
      const o = ctx.createOscillator(); const a = ctx.createGain();
      o.frequency.setValueAtTime(165, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
      const end = env(a, t, 0.002, e.v * 1.1, 0.03, 0.38);
      o.connect(a); a.connect(g.drums); o.start(t); o.stop(end);
      const c = noiseSrc(ctx, g, t, 0.02); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
      const cg = ctx.createGain(); env(cg, t, 0.001, e.v * 0.12, 0, 0.015); c.connect(hp); hp.connect(cg); cg.connect(g.drums);
      if (e.pump) { g.duck.gain.setValueAtTime(0.38, t); g.duck.gain.linearRampToValueAtTime(1, t + BEAT * 0.48); }
      return [o, c];
    }
    case 'snare': {
      const n = noiseSrc(ctx, g, t, 0.2); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.7;
      const a = ctx.createGain(); const end = env(a, t, 0.001, e.v * 0.9, 0, 0.17);
      n.connect(bp); bp.connect(a); a.connect(g.drums);
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.06);
      const og = ctx.createGain(); env(og, t, 0.001, e.v * 0.5, 0, 0.08); o.connect(og); og.connect(g.drums); o.start(t); o.stop(end);
      const s = ctx.createGain(); s.gain.value = 0.15; a.connect(s); s.connect(g.verbSend);
      return [n, o];
    }
    case 'clap': {
      const n = noiseSrc(ctx, g, t, 0.3); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 1.1;
      const a = ctx.createGain(); a.gain.setValueAtTime(0.0001, t);
      for (let i = 0; i < 3; i++) { a.gain.setValueAtTime(e.v, t + i * 0.011); a.gain.exponentialRampToValueAtTime(e.v * 0.2, t + i * 0.011 + 0.009); }
      a.gain.setValueAtTime(e.v * 0.8, t + 0.034); a.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      n.connect(bp); bp.connect(a); a.connect(g.drums);
      const s = ctx.createGain(); s.gain.value = 0.3; a.connect(s); s.connect(g.verbSend);
      return [n];
    }
    case 'hat': {
      const n = noiseSrc(ctx, g, t, e.open ? 0.3 : 0.06); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7500;
      const a = ctx.createGain(); env(a, t, 0.001, e.v * 0.7, 0, e.open ? 0.22 : 0.045);
      n.connect(hp); hp.connect(a); a.connect(g.drums);
      return [n];
    }
    case 'crash': {
      const n = noiseSrc(ctx, g, t, 2.2); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000;
      const a = ctx.createGain(); env(a, t, 0.002, e.v * 0.55, 0, 2.0);
      n.connect(hp); hp.connect(a); a.connect(g.drums);
      const s = ctx.createGain(); s.gain.value = 0.35; a.connect(s); s.connect(g.verbSend);
      return [n];
    }
    case 'impact': {
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(28, t + 1.2);
      const a = ctx.createGain(); const end = env(a, t, 0.003, e.v * 0.9, 0.05, 1.4);
      o.connect(a); a.connect(g.fx); o.start(t); o.stop(end);
      const n = noiseSrc(ctx, g, t, 1.8); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(9000, t); lp.frequency.exponentialRampToValueAtTime(400, t + 1.6);
      const na = ctx.createGain(); env(na, t, 0.002, e.v * 0.35, 0, 1.6); n.connect(lp); lp.connect(na); na.connect(g.fx);
      const s = ctx.createGain(); s.gain.value = 0.6; na.connect(s); s.connect(g.verbSend);
      return [o, n];
    }
    case 'riser': {
      const n = noiseSrc(ctx, g, t, e.dur); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.5;
      bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(7000, t + e.dur);
      const a = ctx.createGain(); a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(e.v * 0.45, t + e.dur * 0.97); a.gain.linearRampToValueAtTime(0.0001, t + e.dur);
      n.connect(bp); bp.connect(a); a.connect(g.fx);
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(880, t + e.dur);
      const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(e.v * 0.06, t + e.dur * 0.97); og.gain.linearRampToValueAtTime(0.0001, t + e.dur);
      o.connect(og); og.connect(g.fx); o.start(t); o.stop(t + e.dur);
      const s = ctx.createGain(); s.gain.value = 0.4; a.connect(s); s.connect(g.verbSend);
      return [n, o];
    }
    case 'whoosh': {
      const n = noiseSrc(ctx, g, t, 0.9); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.5;
      bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(5000, t + 0.45); bp.frequency.exponentialRampToValueAtTime(600, t + 0.9);
      const a = ctx.createGain(); a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(e.v * 0.5, t + 0.45); a.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      n.connect(bp); bp.connect(a); a.connect(g.fx);
      return [n];
    }
    case 'chime': {
      const nodes = [];
      for (const [mult, dec, v] of [[1, 1.6, 1], [2.01, 0.6, 0.35], [3.98, 0.25, 0.15]]) {
        const o = ctx.createOscillator(); o.frequency.value = mtof(e.midi) * mult;
        const a = ctx.createGain(); const end = env(a, t, 0.002, e.v * v, 0, dec);
        o.connect(a); a.connect(g.music); const s = ctx.createGain(); s.gain.value = 1.2; a.connect(s); s.connect(g.verbSend);
        o.start(t); o.stop(end); nodes.push(o);
      }
      return nodes;
    }
    case 'gong': {
      // kulintang: bright struck gong with a little pitch dip and inharmonic partials
      const f = mtof(e.midi);
      const nodes = [];
      const out = ctx.createGain(); out.gain.value = 1; out.connect(g.music);
      const s = ctx.createGain(); s.gain.value = 0.5; out.connect(s); s.connect(g.verbSend);
      for (const [mult, dec, v] of [[1, 1.1, 1], [2.76, 0.32, 0.4], [5.4, 0.1, 0.22], [1.5, 0.5, 0.12]]) {
        const o = ctx.createOscillator(); o.frequency.setValueAtTime(f * mult * 1.012, t); o.frequency.exponentialRampToValueAtTime(f * mult, t + 0.05);
        const a = ctx.createGain(); const end = env(a, t, 0.002, e.v * v * 0.5, 0, dec);
        o.connect(a); a.connect(out); o.start(t); o.stop(end); nodes.push(o);
      }
      const n = noiseSrc(ctx, g, t, 0.03); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 4; bp.Q.value = 3;
      const na = ctx.createGain(); env(na, t, 0.001, e.v * 0.15, 0, 0.02); n.connect(bp); bp.connect(na); na.connect(out); nodes.push(n);
      return nodes;
    }
    case 'pad': {
      const nodes = [];
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = e.filt || 1400; lp.Q.value = 0.6;
      const a = ctx.createGain(); a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(e.v * 0.12, t + 0.35);
      a.gain.setValueAtTime(e.v * 0.12, t + Math.max(0.36, e.dur - 0.25)); a.gain.linearRampToValueAtTime(0.0001, t + e.dur + 0.5);
      lp.connect(a); a.connect(g.music); const s = ctx.createGain(); s.gain.value = 0.6; a.connect(s); s.connect(g.verbSend);
      for (const m of e.notes) for (const det of [-8, 7]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
        o.connect(lp); o.start(t); o.stop(t + e.dur + 0.6); nodes.push(o);
      }
      return nodes;
    }
    case 'stab': {
      const nodes = [];
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
      lp.frequency.setValueAtTime(5200, t); lp.frequency.exponentialRampToValueAtTime(900, t + e.dur);
      const a = ctx.createGain(); const end = env(a, t, 0.004, e.v * 0.14, e.dur * 0.4, e.dur * 0.6 + 0.08);
      lp.connect(a); a.connect(g.music); const s = ctx.createGain(); s.gain.value = 0.35; a.connect(s); s.connect(g.verbSend);
      for (const m of e.notes) for (const det of [-14, 0, 13]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
        o.connect(lp); o.start(t); o.stop(end + 0.02); nodes.push(o);
      }
      return nodes;
    }
    case 'pluck': {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = mtof(e.midi);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.18);
      const a = ctx.createGain(); const end = env(a, t, 0.002, e.v * 0.3, 0, Math.max(0.12, e.dur || 0.2));
      o.connect(lp); lp.connect(a); a.connect(g.music); const s = ctx.createGain(); s.gain.value = 0.5; a.connect(s); s.connect(g.delay);
      o.start(t); o.stop(end + 0.02);
      return [o];
    }
    case 'keys': {
      const nodes = [];
      const a = ctx.createGain(); const end = env(a, t, 0.004, e.v * 0.4, 0.05, e.dur);
      a.connect(g.music); const s = ctx.createGain(); s.gain.value = 0.8; a.connect(s); s.connect(g.verbSend);
      for (const [mult, v] of [[1, 1], [2, 0.25], [3, 0.08]]) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(e.midi) * mult;
        const og = ctx.createGain(); og.gain.value = v; o.connect(og); og.connect(a); o.start(t); o.stop(end + 0.02); nodes.push(o);
      }
      return nodes;
    }
    case 'bass': {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(e.midi);
      const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = mtof(e.midi);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4;
      lp.frequency.setValueAtTime(1400, t); lp.frequency.exponentialRampToValueAtTime(260, t + 0.2);
      const a = ctx.createGain(); const end = env(a, t, 0.004, e.v * 0.32, Math.max(0, e.dur - 0.08), 0.08);
      const sg = ctx.createGain(); sg.gain.value = 1.2;
      o.connect(lp); lp.connect(a); sub.connect(sg); sg.connect(a); a.connect(g.bass);
      o.start(t); sub.start(t); o.stop(end + 0.02); sub.stop(end + 0.02);
      return [o, sub];
    }
    case 'sub': {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(mtof(e.midi), t);
      if (e.glide) o.frequency.exponentialRampToValueAtTime(mtof(e.glide), t + e.dur * 0.8);
      const sh = ctx.createWaveShaper(); sh.curve = SAT;
      const a = ctx.createGain(); const end = env(a, t, 0.005, e.v * 0.6, e.dur * 0.6, e.dur * 0.4);
      o.connect(sh); sh.connect(a); a.connect(g.bass); o.start(t); o.stop(end + 0.02);
      return [o];
    }
    case 'chant': {
      // crowd chanting "HI-RA-YA" — many detuned shouting voices
      const nodes = [];
      const sylls = ['hi', 'ra', 'ya'];
      const r = rng(Math.floor(t * 100));
      for (let v = 0; v < 7; v++) {
        sylls.forEach((s, i) => {
          const note = { syl: s, midi: 64 + Math.floor(r() * 6) + (i === 2 ? 2 : 0), dur: i === 2 ? BEAT * 0.9 : BEAT * 0.42, style: 'shout', glide: i === 2 ? 60 : null };
          const voice = { formant: 0.9 + r() * 0.3, breath: 0.35, vibRate: 5, vibCents: 0, bright: 3000, gain: e.v * 0.28, pan: r() * 1.6 - 0.8 };
          nodes.push(...singVoice(ctx, g, t + i * BEAT * 0.5 + r() * 0.03, note, voice, 0, g.fx, 0.7));
        });
      }
      return nodes;
    }
    case 'voice': {
      const n = e.note;
      const nodes = [];
      const multi = n.who.length > 1;
      const tonic = 62 + (n.t >= 78 * BAR - 0.01 ? 1 : 0);
      n.who.forEach((id, i) => {
        const m = MEMBER_BY_ID[id];
        let shift = 0;
        if (multi && n.who.length === 5 && n.style === 'sing' && n.harmony !== false) {
          if (id === 'liway') shift = harmonyThird(n.midi, tonic) - n.midi;
          if (id === 'yzel' || id === 'saya') shift = -12;
        }
        const gain = multi ? 0.55 : 1;
        nodes.push(...singVoice(ctx, g, t, n, m.voice, shift, g.vox, gain));
      });
      return nodes;
    }
  }
  return null;
}

const SAT = (() => { const c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 2.2); } return c; })();

// Formant singing voice: sawtooth + breath → three parallel band-pass formants.
function singVoice(ctx, g, t, n, voice, shift, dest, gainMul) {
  const ph = phonemes(n.syl);
  const style = n.style;
  const f0 = mtof(n.midi + shift);
  const dur = Math.max(0.06, n.dur);
  const nodes = [];

  const src = ctx.createOscillator(); src.type = 'sawtooth';
  const scoop = style === 'sing' ? 0.97 : style === 'shout' ? 1.06 : 1.0;
  src.frequency.setValueAtTime(f0 * scoop, t);
  src.frequency.exponentialRampToValueAtTime(f0, t + 0.045);
  if (n.glide) {
    src.frequency.setValueAtTime(f0, t + dur * 0.35);
    src.frequency.exponentialRampToValueAtTime(mtof(n.glide + shift), t + dur * 0.75);
  }
  if (style === 'talk') src.frequency.exponentialRampToValueAtTime(f0 * 0.94, t + dur);
  const pre = ctx.createGain(); pre.gain.value = 1;
  const lite = gainMul < 0.7; // group voices: cheaper graph
  if (lite) src.connect(pre);
  else { const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = voice.bright; tone.Q.value = 0.4; src.connect(tone); tone.connect(pre); }

  if (style === 'sing' && dur > 0.32 && voice.vibCents > 0) {
    const lfo = ctx.createOscillator(); lfo.frequency.value = voice.vibRate;
    const lg = ctx.createGain(); const depth = f0 * (Math.pow(2, voice.vibCents / 1200) - 1);
    lg.gain.setValueAtTime(0, t); lg.gain.setValueAtTime(0, t + 0.16); lg.gain.linearRampToValueAtTime(depth * (dur > 1 ? 1.3 : 1), t + Math.min(dur, 0.6));
    lfo.connect(lg); lg.connect(src.frequency); lfo.start(t); lfo.stop(t + dur + 0.15); nodes.push(lfo);
  }
  const breathAmt = voice.breath + (style === 'shout' ? 0.3 : 0) + (style === 'rap' ? 0.05 : 0);
  if (breathAmt > 0.02 && !lite) {
    const ns = noiseSrc(ctx, g, t, dur + 0.1);
    const nb = ctx.createBiquadFilter(); nb.type = 'highpass'; nb.frequency.value = 900;
    const ng = ctx.createGain(); ng.gain.value = breathAmt * 0.9;
    ns.connect(nb); nb.connect(ng); ng.connect(pre); nodes.push(ns);
  }

  const sum = ctx.createGain(); sum.gain.value = 1;
  const F1 = FORMANTS[ph.v1];
  const F2 = ph.v2 ? FORMANTS[ph.v2] : null;
  const qs = [7, 11, 13];
  F1.forEach(([f, a], k) => {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = qs[k];
    let ff = f * voice.formant;
    if (k === 0) ff = Math.max(ff, f0 * 1.15);
    bp.frequency.setValueAtTime(ff, t);
    if (F2) {
      let f2 = F2[k][0] * voice.formant; if (k === 0) f2 = Math.max(f2, f0 * 1.15);
      bp.frequency.setValueAtTime(ff, t + dur * 0.55);
      bp.frequency.linearRampToValueAtTime(f2, t + dur * 0.9);
    }
    const ga = ctx.createGain(); ga.gain.value = a * (k === 0 ? 4.5 : 6);
    pre.connect(bp); bp.connect(ga); ga.connect(sum);
  });
  // body
  if (!lite) { const body = ctx.createBiquadFilter(); body.type = 'lowpass'; body.frequency.value = 520; const bg = ctx.createGain(); bg.gain.value = 0.22; pre.connect(body); body.connect(bg); bg.connect(sum); }

  const amp = ctx.createGain();
  const peak = 0.16 * voice.gain * gainMul * (style === 'shout' ? 1.25 : style === 'talk' ? 0.75 : style === 'rap' ? 1.05 : 1);
  const att = style === 'sing' ? 0.035 : 0.012;
  const rel = style === 'sing' ? 0.09 : 0.05;
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(peak, t + att);
  amp.gain.setValueAtTime(peak * (style === 'shout' ? 0.8 : 0.92), t + Math.max(att + 0.01, dur - 0.02));
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
  sum.connect(amp);
  const pan = panner(ctx, voice.pan);
  amp.connect(pan); pan.connect(dest);
  const vs = ctx.createGain(); vs.gain.value = style === 'talk' ? 0.08 : 0.32; amp.connect(vs); vs.connect(g.verbSend);

  // consonant burst
  if (ph.noisy || style === 'shout') {
    const tc = Math.max(0, t - 0.01);
    const cs = noiseSrc(ctx, g, tc, 0.06);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3800;
    const cg = ctx.createGain(); env(cg, tc, 0.004, peak * 0.9, 0.01, 0.04);
    cs.connect(hp); hp.connect(cg); cg.connect(pan); nodes.push(cs);
  }
  src.start(t); src.stop(t + dur + rel + 0.05); nodes.push(src);
  return nodes;
}
