// Tiny syllable → vowel/viseme mapping shared by the singing synth and the lip-sync.
const cache = new Map();

export function phonemes(syl) {
  if (cache.has(syl)) return cache.get(syl);
  const s = syl.toLowerCase().replace(/[^a-z']/g, '');
  const onsetMatch = /^[^aeiouy]*/.exec(s);
  const onset = onsetMatch ? onsetMatch[0] : '';
  let rest = s.slice(onset.length);
  if (!rest && /y/.test(s)) rest = 'i';
  let v1 = 'a', v2 = null;
  const special = [
    [/^ea/, 'a', null], [/^(ay|ai)/, 'a', 'i'], [/^(aw|ao|au)/, 'a', 'u'], [/^ow/, 'o', 'u'],
    [/^(oy|oi)/, 'o', 'i'], [/^(ey|ei)/, 'e', 'i'], [/^oo/, 'u', null], [/^ee/, 'i', null], [/^y/, 'i', null],
  ];
  let matched = false;
  for (const [re, a, b] of special) if (re.test(rest)) { v1 = a; v2 = b; matched = true; break; }
  if (!matched) {
    const m = /[aeiou]/.exec(rest);
    v1 = m ? m[0] : 'a';
  }
  // "ng" alone is sung on a nasal closed-ish vowel
  if (s === 'ng') { v1 = 'u'; }
  const coda = rest.replace(/^[aeiouy]+/, '');
  const closeEnd = /[mbp]$/.test(coda);
  const first = onset[0] || '';
  const kind = 'mbp'.includes(first) ? 'closed' : 'fv'.includes(first) ? 'teeth' : first ? 'open' : 'none';
  const noisy = /^(s|sh|ch|t|k|h|f|z|th|st|sl|sp)/.test(onset);
  const out = { v1, v2, onset: kind, noisy, closeEnd };
  cache.set(syl, out);
  return out;
}

// Mouth shapes per vowel: open (jaw), wide (lip spread), round (pucker).
export const VISEMES = {
  a: { open: 1.0, wide: 0.95, round: 0.0 },
  e: { open: 0.62, wide: 1.12, round: 0.0 },
  i: { open: 0.38, wide: 1.2, round: 0.0 },
  o: { open: 0.78, wide: 0.62, round: 0.9 },
  u: { open: 0.4, wide: 0.5, round: 1.0 },
};

// Formant frequencies (Hz) and relative gains, female voice.
export const FORMANTS = {
  a: [[850, 1.0], [1220, 0.55], [2810, 0.28]],
  e: [[610, 1.0], [2330, 0.38], [2990, 0.22]],
  i: [[330, 1.0], [2790, 0.3], [3310, 0.22]],
  o: [[520, 1.0], [920, 0.5], [2810, 0.15]],
  u: [[370, 1.0], [950, 0.32], [2670, 0.1]],
};
