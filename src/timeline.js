// Master clock for the whole film. 120 BPM, 4/4: one bar = 2 s, 90 bars = 180 s exactly.
export const BPM = 120;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const DURATION = 180;
export const bar = (b) => b * BAR;

// Sections in bars. `set` is which world is on screen.
export const SECTIONS = [
  { id: 'open', label: 'Cold Open', start: 0, end: 4, set: 'city' },
  { id: 'city', label: 'Manila 2026', start: 4, end: 13, set: 'city' },
  { id: 'backstage', label: 'Backstage', start: 13, end: 24, set: 'backstage' },
  { id: 'reveal', label: 'Showtime', start: 24, end: 26, set: 'stadium' },
  { id: 'drop', label: 'Intro', start: 26, end: 28, set: 'stadium' },
  { id: 'verse1', label: 'Verse', start: 28, end: 36, set: 'stadium' },
  { id: 'pre1', label: 'Pre-Chorus', start: 36, end: 40, set: 'stadium' },
  { id: 'chorus1', label: 'Chorus', start: 40, end: 48, set: 'stadium' },
  { id: 'rap', label: 'Rap', start: 48, end: 56, set: 'stadium' },
  { id: 'pre2', label: 'Pre-Chorus', start: 56, end: 60, set: 'stadium' },
  { id: 'chorus2', label: 'Chorus', start: 60, end: 68, set: 'stadium' },
  { id: 'dance', label: 'Dance Break', start: 68, end: 74, set: 'stadium' },
  { id: 'bridge', label: 'Bridge', start: 74, end: 78, set: 'stadium' },
  { id: 'final', label: 'Final Chorus', start: 78, end: 86, set: 'stadium' },
  { id: 'ending', label: 'Finale', start: 86, end: 88, set: 'stadium' },
  { id: 'outro', label: 'Epilogue', start: 88, end: 90, set: 'stadium' },
];

export function sectionAt(t) {
  const b = t / BAR;
  for (const s of SECTIONS) if (b >= s.start && b < s.end) return s;
  return SECTIONS[SECTIONS.length - 1];
}

// Documentary overlays (seconds).
export const CHYRONS = [
  { t0: 0.6, t1: 7.4, kind: 'title', title: 'What if P-POP was bigger than K-POP?', sub: 'An alternate-reality documentary' },
  { t0: 8.3, t1: 12.0, kind: 'lower', title: 'Manila, 2026', sub: 'Capital of the biggest music industry on Earth' },
  { t0: 12.3, t1: 16.0, kind: 'fact', title: 'Fact', sub: '“Kilig” is now taught in 194 countries. Nobody can translate it. Everybody feels it.' },
  { t0: 16.3, t1: 20.0, kind: 'fact', title: 'Fact', sub: 'Jeepneys have replaced limousines on every red carpet.' },
  { t0: 20.3, t1: 25.4, kind: 'fact', title: 'Fact', sub: 'Ube is now the official flavor of the Olympics.' },
  { t0: 26.4, t1: 29.6, kind: 'lower', title: 'Hiraya Dome · Backstage', sub: '100,000 fans. 10 minutes to showtime.' },
  { t0: 48.4, t1: 51.7, kind: 'fact', title: 'Fact', sub: 'Sold out in 0.4 seconds. 38 million people are still in the queue.' },
  { t0: 52.6, t1: 57.5, kind: 'song', title: 'HIRAYA', sub: '“KILIG (Worldwide)” · Live at Hiraya Dome, Manila' },
  { t0: 137.0, t1: 141.6, kind: 'fact', title: 'Live stat', sub: 'Dance challenge attempts this hour: 1.2 billion.' },
  { t0: 172.6, t1: 176.0, kind: 'quote', title: '', sub: 'In this universe, the whole world learned one word.' },
  { t0: 176.0, t1: 179.4, kind: 'end', title: 'KILIG.', sub: 'HIRAYA · “the fruit of our dreams”' },
];

export const TICKER = [
  'Global halo-halo shortage as HIRAYA world tour sells out in 0.3 seconds',
  'Seoul sends warm congratulations, also asks for concert tickets',
  'Videoke declared a UNESCO World Heritage activity',
  'Scientists confirm the “Mabuhay!” chant is visible from space',
  'Every lola on Earth is now a certified stan',
  'Tagalog overtakes Spanish as the most-studied language on language apps',
  'Jeepney horns now available as ringtones in 80 countries',
];

// Interview slots: two bars each, starting bar 14.
export const INTERVIEWS = [
  { who: 'amara', bar: 14, line: 'We started out at barangay fiestas. Now NASA wants us to open the next Moon landing.' },
  { who: 'yzel', bar: 16, line: 'Our dance challenge broke the internet. Literally. Sorry, Finland.' },
  { who: 'liway', bar: 18, line: 'My lola runs our fan club. It has more members than most countries.' },
  { who: 'saya', bar: 20, line: 'I rap in Tagalog, Bisaya and English. Sometimes all in one word.' },
  { who: 'tala', bar: 22, line: 'When 100,000 fans yell “Mabuhay!”, the Earth spins a little faster.' },
];

// Lightstick colour programs over time (seconds).
export const LIGHTSTICKS = [
  { t: 0, mode: 'pink' },
  { t: 48, mode: 'twinkle' },
  { t: 52, mode: 'rainbow' },
  { t: 56, mode: 'member', who: 'amara' },
  { t: 64, mode: 'member', who: 'liway' },
  { t: 72, mode: 'member', who: 'tala' },
  { t: 80, mode: 'wave' },
  { t: 96, mode: 'member', who: 'saya' },
  { t: 104, mode: 'member', who: 'yzel' },
  { t: 112, mode: 'member', who: 'liway' },
  { t: 116, mode: 'member', who: 'tala' },
  { t: 120, mode: 'wave' },
  { t: 136, mode: 'strobe' },
  { t: 148, mode: 'member', who: 'amara' },
  { t: 152, mode: 'twinkle' },
  { t: 156, mode: 'rainbow' },
  { t: 172, mode: 'heart' },
];

// Fireworks and confetti bursts (seconds).
export const FIREWORKS = [52, 52.5, 53, 80, 81, 94, 120, 121, 134, 136, 140, 144, 156, 156.5, 157, 158, 164, 166, 168, 170, 172, 172.4, 172.8, 173.4, 174, 175, 176.5, 177.5];
export const CONFETTI = [52, 80, 120, 156, 164, 172];
export const IMPACTS = [26, 40, 60, 68, 72, 78, 86].map((b) => bar(b));

// Scene transition overlays.
export const TRANSITIONS = [
  { t: 26, kind: 'flash', dur: 0.7 },
  { t: 48, kind: 'black', dur: 0.8 },
  { t: 52, kind: 'flash', dur: 0.6 },
  { t: 179.2, kind: 'fadeout', dur: 0.8 },
];

// Moments where character motion and particles slow down (hair flips in slow motion).
export const SLOWMO = [
  { t0: 148, t1: 155.6, rate: 0.35 },
];
export function timeRate(t) {
  for (const s of SLOWMO) {
    if (t >= s.t0 - 0.4 && t <= s.t1 + 0.4) {
      const a = Math.min(1, (t - (s.t0 - 0.4)) / 0.4);
      const b = Math.min(1, ((s.t1 + 0.4) - t) / 0.4);
      const k = Math.max(0, Math.min(a, b));
      return 1 + (s.rate - 1) * k;
    }
  }
  return 1;
}
