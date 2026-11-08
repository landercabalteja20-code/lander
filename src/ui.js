// Documentary overlays, karaoke captions and player controls.
import { CHYRONS, TICKER, INTERVIEWS, SECTIONS, TRANSITIONS, DURATION, BAR } from './timeline.js';
import { LYRIC_LINES } from './song.js';
import { MEMBER_BY_ID, MEMBERS } from './members.js';

const $ = (s, r = document) => r.querySelector(s);
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export class UI {
  constructor(root) {
    this.root = root;
    this.els = {
      chyron: $('#chyron', root), ticker: $('#ticker', root), tickerText: $('#ticker-text', root),
      live: $('#live', root), viewers: $('#viewers', root), card: $('#namecard', root),
      cap: $('#captions', root), fade: $('#fade', root),
      time: $('#time'), scrub: $('#scrub'), marks: $('#marks'), play: $('#play'), cc: $('#cc'),
    };
    this.captionsOn = true;
    this.lastChyron = null; this.lastCap = null; this.lastCard = null;
    this.els.tickerText.textContent = TICKER.join('   ✦   ') + '   ✦   ';
    // section marks on the scrubber
    for (const s of SECTIONS) {
      const m = document.createElement('span');
      m.className = 'mark';
      m.style.left = `${(s.start * BAR / DURATION) * 100}%`;
      m.title = s.label;
      this.els.marks.appendChild(m);
    }
  }

  update(t) {
    this.updateChyron(t);
    this.updateCaptions(t);
    this.updateCard(t);
    const E = this.els;
    E.ticker.classList.toggle('on', t > 8 && t < 25.6);
    const live = t > 52.4 && t < 172.4;
    E.live.classList.toggle('on', live);
    if (live) E.viewers.textContent = Math.floor(2148000000 + (t - 52) * 1234567).toLocaleString('en-US');
    // transitions
    let fade = 0, color = '#fff';
    for (const tr of TRANSITIONS) {
      if (tr.kind === 'flash' && t >= tr.t - 0.12 && t < tr.t + tr.dur) { const k = t < tr.t ? (t - (tr.t - 0.12)) / 0.12 : 1 - (t - tr.t) / tr.dur; fade = Math.max(fade, k); color = '#fff5fb'; }
      if (tr.kind === 'black' && t >= tr.t - 0.35 && t < tr.t + tr.dur) { const k = t < tr.t ? (t - (tr.t - 0.35)) / 0.35 : 1 - (t - tr.t) / tr.dur; fade = Math.max(fade, k); color = '#05020a'; }
      if (tr.kind === 'fadeout' && t >= tr.t) { fade = Math.min(1, (t - tr.t) / tr.dur); color = '#05020a'; }
    }
    if (t < 0.5) { fade = 1 - t / 0.5; color = '#05020a'; }
    E.fade.style.opacity = fade.toFixed(3);
    E.fade.style.background = color;
    E.time.textContent = `${fmt(Math.min(t, DURATION))} / ${fmt(DURATION)}`;
    if (!this.scrubbing) E.scrub.value = String((t / DURATION) * 1000);
  }

  updateChyron(t) {
    const c = CHYRONS.find((x) => t >= x.t0 && t < x.t1) || null;
    if (c === this.lastChyron) return;
    this.lastChyron = c;
    const el = this.els.chyron;
    el.className = 'chyron';
    if (!c) { el.innerHTML = ''; return; }
    el.classList.add(c.kind);
    if (c.kind === 'title') el.innerHTML = `<div class="kicker">HIRAYA presents</div><h1>${c.title}</h1><p>${c.sub}</p>`;
    else if (c.kind === 'end') el.innerHTML = `<h1>${c.title}</h1><p>${c.sub}</p><div class="small">What if P-POP was bigger than K-POP?</div>`;
    else if (c.kind === 'quote') el.innerHTML = `<p>${c.sub}</p>`;
    else if (c.kind === 'song') el.innerHTML = `<div class="tag">ON STAGE</div><div class="artist">${c.title}</div><div class="track">${c.sub}</div>`;
    else el.innerHTML = `<div class="tag">${c.title}</div><div class="body">${c.sub}</div>`;
    void el.offsetWidth; el.classList.add('show');
  }

  updateCard(t) {
    const iv = INTERVIEWS.find((x) => t >= x.bar * BAR + 0.1 && t < x.bar * BAR + 3.7) || null;
    if (iv === this.lastCard) return;
    this.lastCard = iv;
    const el = this.els.card;
    if (!iv) { el.classList.remove('show'); return; }
    const m = MEMBER_BY_ID[iv.who];
    el.style.setProperty('--mc', m.color);
    el.innerHTML = `<div class="nm">${m.name}</div><div class="rl">${m.role} · HIRAYA</div>`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }

  updateCaptions(t) {
    const el = this.els.cap;
    if (!this.captionsOn) { el.innerHTML = ''; this.lastCap = null; return; }
    let line = null;
    for (const l of LYRIC_LINES) { if (t >= l.t0 - 0.25 && t < l.t1 + 0.45) { if (!line || l.t0 > line.t0) line = l; } }
    if (line !== this.lastCap) {
      this.lastCap = line;
      if (!line) { el.innerHTML = ''; el.className = 'captions'; return; }
      const multi = line.who.length > 1;
      const who = line.who.length === 5 ? 'ALL' : line.who.map((w) => MEMBER_BY_ID[w].name).join(' + ');
      const col = multi ? 'var(--pink)' : MEMBER_BY_ID[line.who[0]].color;
      el.className = `captions ${line.style}`;
      el.style.setProperty('--mc', col);
      const words = line.sylls.map((s, i) => `<span class="s" data-i="${i}">${escapeHtml(s.text)}</span>${s.space ? ' ' : ''}`).join('');
      el.innerHTML = `<span class="who">${who}${line.style === 'talk' ? '' : ' ♪'}</span><span class="txt">${words}</span>`;
      this.sylEls = [...el.querySelectorAll('.s')];
    }
    if (line && this.sylEls) line.sylls.forEach((s, i) => { const on = t >= s.t; const e = this.sylEls[i]; if (e && e.classList.contains('on') !== on) e.classList.toggle('on', on); });
  }
}

function escapeHtml(s) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
export { fmt, MEMBERS };
