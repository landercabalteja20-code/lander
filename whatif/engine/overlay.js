// 2D overlay drawn on a canvas: title, HUD counter, captions, end card.
// All sizes are in "design pixels" for a 1080-wide frame and scaled to the real width.
// See references/STYLE.md for the measurements these follow.
export const COLORS = {
  gold: '#E8C15A',
  cta: '#D9A93D',
  red: '#FF3B3B',
  endBg: '#141414',
};

const SERIF = 'Newsreader, "Bitstream Charter", Georgia, serif';
const SANS = 'Inter, system-ui, sans-serif';
const MONO = '"JetBrains Mono", "DejaVu Sans Mono", monospace';

export async function loadFonts(base = '../node_modules/@fontsource') {
  const faces = [
    ['Newsreader', `${base}/newsreader/files/newsreader-latin-400-normal.woff2`, { weight: '400', style: 'normal' }],
    ['Newsreader', `${base}/newsreader/files/newsreader-latin-400-italic.woff2`, { weight: '400', style: 'italic' }],
    ['Newsreader', `${base}/newsreader/files/newsreader-latin-500-italic.woff2`, { weight: '500', style: 'italic' }],
    ['Newsreader', `${base}/newsreader/files/newsreader-latin-500-normal.woff2`, { weight: '500', style: 'normal' }],
    ['Inter', `${base}/inter/files/inter-latin-500-normal.woff2`, { weight: '500' }],
    ['Inter', `${base}/inter/files/inter-latin-600-normal.woff2`, { weight: '600' }],
    ['Inter', `${base}/inter/files/inter-latin-700-normal.woff2`, { weight: '700' }],
    ['JetBrains Mono', `${base}/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2`, { weight: '400' }],
    ['JetBrains Mono', `${base}/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2`, { weight: '500' }],
  ];
  await Promise.all(faces.map(async ([fam, url, desc]) => {
    try { const f = new FontFace(fam, `url(${url})`, desc); await f.load(); document.fonts.add(f); }
    catch (e) { console.warn('font failed', url, e.message); }
  }));
}

export class Overlay {
  constructor(width, height) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width; this.canvas.height = height;
    this.g = this.canvas.getContext('2d');
    this.W = width; this.H = height;
    this.s = width / 1080; // design scale
  }
  clear() { this.g.clearRect(0, 0, this.W, this.H); }
  px(v) { return v * this.s; }

  // rich text: segments wrapped in [brackets] are drawn in gold
  _segments(text) {
    const out = [];
    const re = /\[([^\]]+)\]/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push({ t: text.slice(last, m.index), hl: false });
      out.push({ t: m[1], hl: true });
      last = re.lastIndex;
    }
    if (last < text.length) out.push({ t: text.slice(last), hl: false });
    return out;
  }
  _wrapWords(text, font, maxW) {
    const g = this.g; g.font = font;
    const words = [];
    for (const seg of this._segments(text)) for (const w of seg.t.split(/(\s+)/)) if (w) words.push({ w, hl: seg.hl });
    const lines = []; let cur = []; let curW = 0;
    for (const wd of words) {
      const ww = g.measureText(wd.w).width;
      if (/^\s+$/.test(wd.w)) { if (cur.length) { cur.push(wd); curW += ww; } continue; }
      if (curW + ww > maxW && cur.length) {
        while (cur.length && /^\s+$/.test(cur[cur.length - 1].w)) cur.pop();
        lines.push(cur); cur = []; curW = 0;
      }
      cur.push(wd); curW += ww;
    }
    if (cur.length) lines.push(cur);
    return lines.map((ln) => ({ words: ln, width: ln.reduce((a, w) => a + g.measureText(w.w).width, 0) }));
  }
  _balanced(text, font, maxW) {
    // narrow the wrap width until the line count would grow: gives balanced lines like the refs
    let lines = this._wrapWords(text, font, maxW);
    if (lines.length < 2) return lines;
    let lo = maxW * 0.5, hi = maxW, best = lines;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      const l2 = this._wrapWords(text, font, mid);
      if (l2.length > lines.length) lo = mid; else { hi = mid; best = l2; }
    }
    return best;
  }
  _drawLines(lines, font, cx, y, lh, color, alpha, shadow = true) {
    const g = this.g;
    g.save();
    g.font = font; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    g.globalAlpha = alpha;
    if (shadow) { g.shadowColor = 'rgba(0,0,0,0.75)'; g.shadowBlur = this.px(18); g.shadowOffsetY = this.px(2); }
    lines.forEach((ln, i) => {
      let x = cx - ln.width / 2;
      for (const wd of ln.words) {
        g.fillStyle = wd.hl ? COLORS.gold : color;
        g.fillText(wd.w, x, y + i * lh);
        x += g.measureText(wd.w).width;
      }
    });
    g.restore();
  }

  title(text, alpha = 1, { y = 0.235, size = 66 } = {}) {
    if (alpha <= 0) return;
    const font = `400 ${this.px(size)}px ${SERIF}`;
    const lines = this._balanced(text, font, this.px(900));
    const lh = this.px(size * 1.12);
    const y0 = this.H * y - ((lines.length - 1) * lh) / 2;
    this._drawLines(lines, font, this.W / 2, y0, lh, '#ffffff', alpha);
  }

  caption(text, alpha = 1, { y = 0.6, size = 54, color = '#ffffff' } = {}) {
    if (alpha <= 0 || !text) return;
    const font = `italic 500 ${this.px(size)}px ${SERIF}`;
    const lines = this._balanced(text, font, this.px(860));
    const lh = this.px(size * 1.2);
    const y0 = this.H * y - ((lines.length - 1) * lh) / 2;
    this._drawLines(lines, font, this.W / 2, y0, lh, color, alpha);
  }

  _spaced(text, x, y, spacing, font, color, alpha) {
    const g = this.g;
    g.save(); g.font = font; g.fillStyle = color; g.globalAlpha = alpha; g.textBaseline = 'alphabetic';
    g.letterSpacing = `${spacing}px`;
    g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = this.px(8);
    g.fillText(text, x, y);
    const w = g.measureText(text).width;
    g.restore();
    return w;
  }

  // HUD block, left side: LABEL / big number with "/of" / sub lines / pill
  hud({ label, big, of = null, sub = [], pill = null, pillDot = COLORS.red, alpha = 1, x = 62, y = 0.415, bigColor = '#fff' }) {
    if (alpha <= 0) return;
    const g = this.g;
    const X = this.px(x);
    let Y = this.H * y;
    this._spaced(label.toUpperCase(), X, Y, this.px(4.5), `600 ${this.px(25)}px ${SANS}`, 'rgba(255,255,255,0.92)', alpha);
    Y += this.px(92);
    g.save();
    g.globalAlpha = alpha; g.font = `400 ${this.px(98)}px ${SERIF}`; g.fillStyle = bigColor; g.textBaseline = 'alphabetic';
    g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = this.px(12);
    g.fillText(String(big), X - this.px(3), Y);
    const bw = g.measureText(String(big)).width;
    if (of) {
      g.font = `400 ${this.px(44)}px ${SERIF}`; g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillText(` /${of}`, X + bw + this.px(4), Y);
    }
    g.restore();
    Y += this.px(44);
    for (const line of sub) {
      this._spaced(line.toUpperCase(), X, Y, this.px(3), `500 ${this.px(20)}px ${MONO}`, 'rgba(255,255,255,0.72)', alpha);
      Y += this.px(32);
    }
    if (pill) {
      Y += this.px(6);
      g.save();
      g.globalAlpha = alpha;
      g.font = `500 ${this.px(19)}px ${MONO}`; g.letterSpacing = `${this.px(2.5)}px`;
      const txt = pill.toUpperCase();
      const tw = g.measureText(txt).width;
      const ph = this.px(40), pw = tw + this.px(64);
      g.fillStyle = 'rgba(10,10,14,0.55)';
      g.beginPath(); g.roundRect(X - this.px(6), Y - ph * 0.68, pw, ph, ph / 2); g.fill();
      g.fillStyle = pillDot;
      g.beginPath(); g.arc(X + this.px(14), Y - ph * 0.18, this.px(6), 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff';
      g.fillText(txt, X + this.px(30), Y);
      g.restore();
    }
  }

  endCard({ title, fact, question, cta, alpha = 1 }) {
    const g = this.g;
    g.save(); g.globalAlpha = alpha; g.fillStyle = COLORS.endBg; g.fillRect(0, 0, this.W, this.H); g.restore();
    const tf = `400 ${this.px(68)}px ${SERIF}`;
    const tl = this._balanced(title, tf, this.px(900));
    const lh = this.px(78);
    const ty = this.H * 0.4 - ((tl.length - 1) * lh) / 2;
    this._drawLines(tl, tf, this.W / 2, ty, lh, '#f2f2f2', alpha, false);
    let y = ty + (tl.length - 1) * lh + this.px(96);
    if (fact) {
      const ff = `400 ${this.px(19)}px ${MONO}`;
      g.save(); g.font = ff; g.letterSpacing = `${this.px(4)}px`; g.fillStyle = 'rgba(255,255,255,0.42)'; g.globalAlpha = alpha; g.textAlign = 'center';
      const lines = Array.isArray(fact) ? fact : [fact];
      lines.forEach((ln, i) => g.fillText(ln.toUpperCase(), this.W / 2, y + i * this.px(32)));
      g.restore();
      y += (Array.isArray(fact) ? fact.length : 1) * this.px(32) + this.px(110);
    }
    if (question) {
      const qf = `italic 400 ${this.px(56)}px ${SERIF}`;
      const ql = this._balanced(question, qf, this.px(900));
      this._drawLines(ql, qf, this.W / 2, y, this.px(66), '#f2f2f2', alpha, false);
      y += (ql.length - 1) * this.px(66) + this.px(64);
    }
    if (cta) {
      g.save(); g.font = `600 ${this.px(23)}px ${SANS}`; g.letterSpacing = `${this.px(5)}px`; g.fillStyle = COLORS.cta; g.globalAlpha = alpha; g.textAlign = 'center';
      g.fillText(cta.toUpperCase(), this.W / 2, y);
      g.restore();
    }
  }

  fill(color, alpha) {
    if (alpha <= 0) return;
    const g = this.g; g.save(); g.globalAlpha = alpha; g.fillStyle = color; g.fillRect(0, 0, this.W, this.H); g.restore();
  }

  vignette(amount = 0.35) {
    const g = this.g;
    const grd = g.createRadialGradient(this.W / 2, this.H / 2, this.H * 0.25, this.W / 2, this.H / 2, this.H * 0.75);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, `rgba(0,0,0,${amount})`);
    g.fillStyle = grd; g.fillRect(0, 0, this.W, this.H);
  }
}

export const FONTS = { SERIF, SANS, MONO };
