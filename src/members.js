// HIRAYA — the five members. Every system (3D dolls, 2D faces, voices,
// captions, lightsticks) reads from this one table so the designs never drift.

export const MEMBERS = [
  {
    id: 'amara', name: 'AMARA', role: 'Leader & Main Vocalist',
    color: '#ff8fbf', glow: '#ffc2dc',
    skin: '#b97c52', skinShade: '#94603c',
    eye: { iris: '#5a3020', irisLight: '#a8683c', shadow: '#f4d9a8', shadow2: '#e8b98a', tilt: 0.10, height: 1.0, shimmer: '#fff3d6' },
    lips: { color: '#e0567f', dark: '#a83058', gloss: 0.6 },
    brow: '#1f1410', blush: '#ff7f9a',
    hair: { style: 'ponytail', color: '#17121a', sheen: '#6a6fa8', accent: '#f5eef0' },
    outfit: {
      top: '#fbf7f4', jacket: '#f59bbd', bottom: '#c9ccd8', boots: '#fbf8f6', sole: '#e9dfe6',
      bottomType: 'pleated', bottomMetal: 0.85, jacketSheen: '#ffd6e6', accent: '#f8f2ec',
    },
    mic: 'pearl',
    voice: { formant: 1.04, breath: 0.05, vibRate: 5.6, vibCents: 38, bright: 6200, gain: 1.0, pan: 0.0 },
    personality: { amp: 1.0, sharp: 0.45, tilt: 0.0, smile: 0.35 },
  },
  {
    id: 'yzel', name: 'YZEL', role: 'Main Dancer',
    color: '#a66bff', glow: '#cfb0ff',
    skin: '#c98f5e', skinShade: '#a5713f',
    eye: { iris: '#6b33c9', irisLight: '#b98cff', shadow: '#9b4dff', shadow2: '#5e1fb0', tilt: 0.16, height: 0.86, shimmer: '#e6d4ff' },
    lips: { color: '#a8577a', dark: '#723652', gloss: 0.5 },
    brow: '#5d4a6e', blush: '#e07aa0',
    hair: { style: 'wolf', color: '#c7b6ea', sheen: '#ffffff', accent: '#8e78c8' },
    outfit: {
      top: '#1a1324', jacket: '#7b3fe0', jacket2: '#14101c', bottom: '#8d4bd6', boots: '#f1eef7', sole: '#7b3fe0',
      bottomType: 'shorts', bottomMetal: 0.7, jacketSheen: '#d9c2ff', accent: '#d8dbe6',
    },
    mic: 'violet',
    voice: { formant: 0.98, breath: 0.17, vibRate: 5.0, vibCents: 18, bright: 4200, gain: 0.95, pan: -0.28 },
    personality: { amp: 1.25, sharp: 0.9, tilt: 0.0, smile: 0.15 },
  },
  {
    id: 'liway', name: 'LIWAY', role: 'Vocalist',
    color: '#7fd4ff', glow: '#c6eeff',
    skin: '#d9a577', skinShade: '#b9845a',
    eye: { iris: '#6a3b22', irisLight: '#c98a52', shadow: '#6ec6ff', shadow2: '#3b8fe0', tilt: 0.02, height: 1.12, shimmer: '#ffffff' },
    lips: { color: '#f39a7a', dark: '#c76a52', gloss: 0.75 },
    brow: '#5a3725', blush: '#ff9aa6',
    hair: { style: 'bubbles', color: '#6b4430', sheen: '#c6996f', accent: '#a8e4ff' },
    outfit: {
      top: '#ffffff', jacket: '#86c9ff', bottom: '#74bdf2', bottom2: '#ffffff', boots: '#ffffff', sole: '#dfeefa',
      bottomType: 'bubble', bottomMetal: 0.1, jacketSheen: '#ffffff', accent: '#d7dde8',
    },
    mic: 'ice',
    voice: { formant: 1.1, breath: 0.3, vibRate: 5.8, vibCents: 26, bright: 3800, gain: 0.9, pan: 0.26 },
    personality: { amp: 0.85, sharp: 0.3, tilt: 0.22, smile: 0.5 },
  },
  {
    id: 'saya', name: 'SAYA', role: 'Rapper',
    color: '#ff3b55', glow: '#ff9aa8',
    skin: '#8a5636', skinShade: '#6b3f24',
    eye: { iris: '#4a2212', irisLight: '#a85a2a', shadow: '#7a1020', shadow2: '#2a0a10', tilt: 0.26, height: 0.84, shimmer: '#ffb0b8', liner: true },
    lips: { color: '#c8102e', dark: '#7c0718', gloss: 0.7 },
    brow: '#1c0f0a', blush: '#d0506a',
    hair: { style: 'braids', color: '#c4122f', sheen: '#ff6a7a', accent: '#d8dbe6' },
    outfit: {
      top: '#121014', jacket: '#d4142f', jacket2: '#fbf4f0', bottom: '#141216', boots: '#cf1430', sole: '#121014',
      bottomType: 'cargo', bottomMetal: 0.1, jacketSheen: '#ff8a96', accent: '#e2e4ea',
    },
    mic: 'flame',
    voice: { formant: 0.94, breath: 0.12, vibRate: 5.2, vibCents: 14, bright: 5000, gain: 1.0, pan: 0.34 },
    personality: { amp: 1.1, sharp: 0.75, tilt: -0.05, smile: 0.2 },
  },
  {
    id: 'tala', name: 'TALA', role: 'Center',
    color: '#ffd25a', glow: '#fff0b8',
    skin: '#c48a55', skinShade: '#a06a3a',
    eye: { iris: '#6e3f1a', irisLight: '#d39a4a', shadow: '#ffc94a', shadow2: '#e8963a', tilt: 0.06, height: 1.1, shimmer: '#fffbe0' },
    lips: { color: '#ff6f5e', dark: '#c8443a', gloss: 0.7 },
    brow: '#5a3416', blush: '#ff8a7a',
    hair: { style: 'buns', color: '#c0803a', sheen: '#ffd36b', accent: '#ffd36b' },
    outfit: {
      top: '#fff9ec', jacket: '#ffd23f', bottom: '#ffffff', boots: '#ffffff', sole: '#f6e7b8',
      bottomType: 'pleated', bottomMetal: 0.05, jacketSheen: '#fffbd0', accent: '#f2c14e',
    },
    mic: 'gold',
    voice: { formant: 1.15, breath: 0.08, vibRate: 6.2, vibCents: 24, bright: 8000, gain: 0.92, pan: -0.36 },
    personality: { amp: 1.05, sharp: 0.55, tilt: 0.12, smile: 0.65 },
  },
];

export const MEMBER_BY_ID = Object.fromEntries(MEMBERS.map((m) => [m.id, m]));
export const MEMBER_IDS = MEMBERS.map((m) => m.id);
