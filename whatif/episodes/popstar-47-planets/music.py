"""Soundtrack for "What if a pop star's world tour included 47 planets...".

Her song, "Forty-Seven": an ethereal, hypnotic vocalise ("na-ah-oh, oo-oh-ah") over Am9-Fmaj7-Cadd9-G6
at 96 BPM, sitting under the captions as a background bed. On Earth it plays through a cheap outdoor PA
in the rain. It blooms back to full size when the signal leaves the atmosphere.

Run:  python3 -I episodes/popstar-47-planets/music.py
Writes build/song.wav and build/sing.json (per-frame mouth data for lip sync).
"""
import json, os, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'audio'))
import numpy as np
from scipy.io import wavfile
import synth as S
from synth import SR, n2m

BPM = 96
BEAT = 60 / BPM          # 0.625 s
BAR = 4 * BEAT           # 2.5 s
DUR = 192.5              # seconds (77 bars)
FPS = 30
T_RANK, T_STOP, T_EARTH, T_SIGNAL, T_END = 90.0, 102.5, 105.0, 160.0, 181.0

CHORDS = {
    'Am': dict(pad=['A3', 'C4', 'E4', 'B4'], root='A1', arp=['A3', 'E4', 'B4', 'C5', 'E5', 'C5', 'B4', 'E4'], choir=[('A3', 'a'), ('C4', 'a'), ('E4', 'a')]),
    'F': dict(pad=['F3', 'A3', 'C4', 'E4'], root='F1', arp=['F3', 'C4', 'G4', 'A4', 'E5', 'A4', 'G4', 'C4'], choir=[('A3', 'o'), ('C4', 'o'), ('F4', 'o')]),
    'C': dict(pad=['G3', 'C4', 'E4', 'D5'], root='C2', arp=['C4', 'G4', 'D5', 'E5', 'G5', 'E5', 'D5', 'G4'], choir=[('G3', 'a'), ('C4', 'a'), ('E4', 'a')]),
    'G': dict(pad=['G3', 'B3', 'D4', 'E4'], root='G1', arp=['G3', 'D4', 'A4', 'B4', 'D5', 'B4', 'A4', 'D4'], choir=[('G3', 'o'), ('B3', 'o'), ('D4', 'o')]),
}
LOOP = ['Am', 'F', 'C', 'G']
N_BARS = int(round(DUR / BAR))
# the ranking build uses a darker turn
PROG = [LOOP[b % 4] for b in range(N_BARS)]
for b in range(36, 42):
    PROG[b] = ['F', 'G', 'Am', 'Am', 'F', 'F'][b - 36]
for b in range(73, N_BARS):
    PROG[b] = ['F', 'F', 'Am', 'Am'][min(b - 73, 3)]

# hook phrases: (beat, length_beats, note, syllable)
HOOK_A = [(0.0, 0.5, 'A4', 'na'), (0.5, 0.5, 'C5', 'a'), (1.0, 1.5, 'E5', 'o'), (2.5, 0.5, 'D5', 'e'), (3.0, 1.0, 'C5', 'a'),
          (4.0, 1.0, 'D5', 'u'), (5.0, 0.5, 'E5', 'o'), (5.5, 0.5, 'D5', 'a'), (6.0, 1.6, 'C5', 'a'),
          (8.0, 0.5, 'G4', 'la'), (8.5, 0.5, 'C5', 'a'), (9.0, 1.5, 'E5', 'o'), (10.5, 0.5, 'G5', 'e'), (11.0, 1.0, 'E5', 'a'),
          (12.0, 2.5, 'D5', 'u'), (14.5, 1.0, 'B4', 'a')]
HOOK_B = [(0.0, 1.0, 'E5', 'e'), (1.0, 1.5, 'A5', 'a'), (2.5, 0.5, 'G5', 'o'), (3.0, 1.0, 'E5', 'a'),
          (4.0, 1.0, 'F5', 'u'), (5.0, 1.0, 'E5', 'a'), (6.0, 1.8, 'C5', 'o'),
          (8.0, 1.0, 'E5', 'e'), (9.0, 1.5, 'G5', 'a'), (10.5, 0.5, 'E5', 'o'), (11.0, 1.0, 'D5', 'a'),
          (12.0, 1.0, 'D5', 'u'), (13.0, 1.0, 'B4', 'a'), (14.0, 1.8, 'D5', 'o')]
INTRO = [(0.0, 7.6, 'E5', 'u'), (8.0, 7.4, 'D5', 'u')]
DESCANT = [(0.0, 7.6, 'A5', 'u'), (8.0, 7.4, 'G5', 'u')]

# which phrase starts at which bar: lead line
LEAD_PLAN = [(0, INTRO, 0.55), (4, HOOK_A, 0.9), (8, HOOK_A, 0.9), (12, HOOK_B, 0.95), (16, HOOK_A, 0.9), (20, HOOK_B, 0.95),
             (24, HOOK_A, 1.0), (28, HOOK_B, 1.0), (32, HOOK_A, 0.75),
             (42, HOOK_A, 0.9), (46, HOOK_B, 0.9), (50, HOOK_A, 0.9), (54, HOOK_B, 0.95), (58, HOOK_A, 0.9),
             (64, HOOK_B, 1.0), (68, HOOK_A, 1.0), (72, INTRO, 0.6)]
DESCANT_PLAN = [24, 28, 64, 68]
CHOIR_BARS = list(range(8, 36)) + list(range(42, 62)) + list(range(64, 77))
# drum level per bar
DRUMS = {}
for b in range(N_BARS):
    lvl = 0
    if 4 <= b < 8: lvl = 1
    elif 8 <= b < 24: lvl = 2
    elif 24 <= b < 32: lvl = 3
    elif 32 <= b < 38: lvl = 1
    elif 42 <= b < 62: lvl = 2
    elif 66 <= b < 70: lvl = 3
    elif 70 <= b < 72: lvl = 2
    DRUMS[b] = lvl


def notes_from(plan, transpose=0, vel_scale=1.0, cut_after=None):
    out = []
    for bar, phrase, vel in plan:
        t0 = bar * BAR
        for (b, L, n, syl) in phrase:
            s = t0 + b * BEAT
            e = s + L * BEAT
            if cut_after and s >= cut_after:
                continue
            out.append((s, e, n2m(n) + transpose, syl, vel * vel_scale))
    return out


def main():
    t_start = time.time()
    N = int(DUR * SR)
    music = np.zeros((2, N), np.float32)   # everything that is "her song" (goes through PA on Earth)
    vox_bus = np.zeros((2, N), np.float32)
    sfx = np.zeros((2, N), np.float32)
    ir_long = S.make_ir(4.2, seed=1, damp=0.45)
    ir_mid = S.make_ir(2.4, seed=2, damp=0.6)

    # ---- pads ----
    pads = np.zeros((2, N), np.float32)
    for b in range(N_BARS):
        if b in (41,):
            continue
        ch = CHORDS[PROG[b]]
        x = S.pad_chord([n2m(n) for n in ch['pad']], BAR, seed=b, cutoff=1500 if b < 64 else 2200, attack=0.5, release=1.2)
        S.place(pads, x, b * BAR, 0.5)
    music += pads + S.reverb(pads, ir_mid, 0.35)
    print('pads', round(time.time() - t_start, 1))

    # ---- arp (FM bells, 16ths) ----
    arp = np.zeros((2, N), np.float32)
    for b in range(N_BARS):
        if b < 2 or b == 41 or b >= 75:
            continue
        ch = CHORDS[PROG[b]]
        for step in range(16):
            t = b * BAR + step * BEAT / 4
            n = ch['arp'][step % 8]
            vel = (0.9 if step % 4 == 0 else 0.55) * (0.6 if b < 4 else 1.0)
            x = S.fm_bell(float(S.mtof(n2m(n))), dur=0.7, index=2.2, decay=0.28)
            S.place(arp, S.pan(x, -0.35 if step % 2 else 0.35), t, 0.12 * vel)
    arp = S.highpass(arp, 300)
    music += arp + S.pingpong(arp, BEAT * 0.75, fb=0.45) * 0.6 + S.reverb(arp, ir_long, 0.25)
    print('arp', round(time.time() - t_start, 1))

    # ---- sub bass + drums ----
    bass = np.zeros((2, N), np.float32)
    drums = np.zeros((2, N), np.float32)
    kicks = []
    K, C, H, OH, SH = S.kick(1), S.clap(2), S.hat(3), S.hat(4, True), S.shaker(5)
    for b in range(N_BARS):
        lvl = DRUMS[b]
        t0 = b * BAR
        root = float(S.mtof(n2m(CHORDS[PROG[b]]['root'])))
        if 4 <= b < 41 or 42 <= b < 62 or 65 <= b < 74:
            for (bt, L, mul) in ((0, 1.4, 1), (1.5, 0.9, 1), (2.5, 0.6, 2), (3.0, 0.9, 1)):
                S.place(bass, S.sub_note(root * mul, L * BEAT), t0 + bt * BEAT, 0.8 if mul == 1 else 0.35)
        if lvl >= 1:
            for bt in (0, 2.5):
                S.place(drums, K, t0 + bt * BEAT, 0.8); kicks.append(t0 + bt * BEAT)
            for s16 in range(16):
                S.place(drums, S.pan(SH, 0.3), t0 + s16 * BEAT / 4, 0.5 if s16 % 2 else 0.25)
        if lvl >= 2:
            for bt in (1, 3):
                S.place(drums, C, t0 + bt * BEAT, 0.55)
            for e8 in range(8):
                sw = 0.035 if e8 % 2 else 0.0
                S.place(drums, S.pan(H, -0.25), t0 + e8 * BEAT / 2 + sw, 0.5 if e8 % 2 else 0.3)
        if lvl >= 3:
            S.place(drums, K, t0 + 1.75 * BEAT, 0.5); kicks.append(t0 + 1.75 * BEAT)
            S.place(drums, S.pan(OH, 0.2), t0 + 3.5 * BEAT, 0.35)
    duck = S.duck_env(N, kicks, depth=0.55, rel=0.18)
    bass *= duck
    pads *= 1.0
    music *= (0.65 + 0.35 * duck)[None, :]
    music += bass * 0.9 + drums * 0.75 + S.reverb(drums, ir_mid, 0.12)
    print('drums', round(time.time() - t_start, 1))

    # ---- vocals ----
    lead_notes = notes_from(LEAD_PLAN)
    lead = S.choir_voice(lead_notes, DUR, seed=7, voices=3, spread=0.35, cents=7, breath=0.1, vib_depth=30)
    _, ctrl = S.sing(lead_notes, DUR, seed=7 * 31 + 1, return_ctrl=True, kmax_hz=400)  # control curves for lip sync
    print('lead', round(time.time() - t_start, 1))
    desc_notes = notes_from([(b, DESCANT, 0.45) for b in DESCANT_PLAN])
    descant = S.choir_voice(desc_notes, DUR, seed=11, voices=2, spread=0.8, cents=10, breath=0.15, vib_depth=22, tilt=1.5)
    print('descant', round(time.time() - t_start, 1))
    choir = np.zeros((2, N), np.float32)
    for part in range(3):
        cn = []
        for b in CHOIR_BARS:
            n, v = CHORDS[PROG[b]]['choir'][part]
            cn.append((b * BAR + 0.02, b * BAR + BAR - 0.04, n2m(n), v, 0.32))
        choir += S.choir_voice(cn, DUR, seed=20 + part, voices=2, spread=0.9, cents=12, breath=0.18, vib_depth=18, kmax_hz=5000, attack=0.35, release=0.4, tilt=1.4)
    print('choir', round(time.time() - t_start, 1))
    # vocal chops in the ranking build: "ah-ah-ah"
    chops = []
    for b in range(37, 41):
        ch = CHORDS[PROG[b]]['arp']
        for s16 in range(0, 16, 2 if b < 39 else 1):
            t = b * BAR + s16 * BEAT / 4
            chops.append((t, t + BEAT / 4 * 0.7, n2m(ch[(s16 // 2) % 8]) + 12, 'a', 0.5 + 0.1 * (b - 37)))
    chop = S.choir_voice(chops, DUR, seed=33, voices=2, spread=0.9, cents=6, attack=0.008, release=0.03, glide=0.01, vib_depth=0)
    vox = lead * 1.0 + descant * 0.8 + choir * 0.55 + chop * 0.6
    vox = S.highpass(vox, 140)
    vox_bus = vox + S.reverb(vox, ir_long, 0.45) + S.pingpong(vox, BEAT * 0.75, fb=0.38, lp=5000) * 0.35
    music += vox_bus * 1.25
    print('vox done', round(time.time() - t_start, 1))

    # ---- ranking build: riser, tape stop, boom ----
    S.place(music, S.pan(S.riser(6.0, seed=3), 0.0), T_STOP - 6.0, 0.35)
    music = S.tape_stop(music, T_STOP - 1.3, T_STOP, resume=T_EARTH)

    # ---- Earth: her song through a cheap outdoor PA in the rain ----
    i0, i1 = int(T_EARTH * SR), int(T_SIGNAL * SR)
    pa = S.cheap_pa(music[:, i0:i1 + 2 * SR])
    xf = 2 * SR
    clean_part = music[:, i0:i1 + xf].copy()
    pa_mix = pa * 0.55
    music[:, i0:i1] = pa_mix[:, : i1 - i0]
    # crossfade back to the full mix as the signal leaves the atmosphere
    ramp = np.linspace(0, 1, xf)[None, :]
    music[:, i1:i1 + xf] = pa_mix[:, i1 - i0:i1 - i0 + xf] * (1 - ramp) + clean_part[:, i1 - i0:i1 - i0 + xf] * ramp
    print('pa', round(time.time() - t_start, 1))

    # ---- sound effects ----
    cheers = [(0.4, 0.8, 1.3, 60), (20.2, 1.35, 0.8, 35), (35.2, 1.1, 0.9, 40), (45.2, 0.65, 1.0, 40), (55.2, 1.0, 1.0, 40), (70.2, 0.9, 1.0, 30), (80.2, 1.75, 0.6, 30)]
    for k, (t, pitch, size, voices) in enumerate(cheers):
        c = S.crowd_cheer(5.0, seed=50 + k, pitch=pitch, voices=voices, size=size)
        S.place(sfx, c + S.reverb(c, ir_mid, 0.3), t, 0.55)
    # Myco: the fungus hums along (one enormous low voice)
    hum = S.sing([(60.3, 69.5, n2m('A2'), 'm', 0.5)], DUR, seed=60, kmax_hz=1500, vib_depth=8, breath=0.0, formant_shift=0.8)
    S.place(sfx, S.pan(hum, 0), 0, 0.9)
    for k, t in enumerate((71.0, 74.4, 77.2)):
        w = S.whale(3.6, f0=150 + 40 * k, seed=70 + k)
        S.place(sfx, S.pan(w, (-0.5, 0.4, -0.1)[k]) + S.reverb(w, ir_long, 0.6), t, 0.45)
    S.place(sfx, S.pan(S.boom(1), 0), 103.2, 0.9)
    # Earth ambience
    r = S.rain(T_SIGNAL + 6 - (T_EARTH - 0.3), seed=8)
    fade_in = np.clip(np.arange(r.shape[1]) / (0.4 * SR), 0, 1)
    fade_out = np.clip((r.shape[1] - np.arange(r.shape[1])) / (5 * SR), 0, 1)
    S.place(sfx, r * (fade_in * fade_out)[None, :], T_EARTH - 0.3, 0.55)
    for k, t in enumerate((125.4, 126.35, 127.5)):  # one lonely clap
        S.place(sfx, S.pan(S.clap(90 + k), 0.4) * 0.8 + S.reverb(S.clap(90 + k), ir_mid, 0.2), t, 0.6)
    # the signal goes out: rising whoosh + sparkle
    S.place(sfx, S.riser(3.5, seed=9), T_SIGNAL - 3.0, 0.35)
    sp = np.zeros((2, int(4 * SR)), np.float32)
    for k in range(24):
        f = float(S.mtof(n2m('A5') + [0, 3, 7, 10, 12, 15, 19, 22][k % 8] + 12 * (k // 8)))
        S.place(sp, S.pan(S.fm_bell(f, 0.8, ratio=3.5, index=1.5, decay=0.4), (k % 5 - 2) / 2.5), k * 0.08, 0.08)
    S.place(sfx, sp + S.reverb(sp, ir_long, 0.5), 165.2, 1.0)

    # ---- master ----
    mix = music + sfx
    end_fade = np.clip((N - np.arange(N)) / (4.0 * SR), 0, 1)
    mix *= end_fade[None, :]
    start_fade = np.clip(np.arange(N) / (0.05 * SR), 0, 1)
    mix *= start_fade[None, :]
    mix = S.compress(mix, thresh=0.35, ratio=2.5)
    mix = np.tanh(mix / np.abs(mix).max() * 1.15) / np.tanh(1.15)
    mix *= 10 ** (-1.0 / 20)
    os.makedirs(os.path.join(HERE, 'build'), exist_ok=True)
    wavfile.write(os.path.join(HERE, 'build', 'song.wav'), SR, (mix.T * 32767).astype(np.int16))

    # ---- lip sync data (lead vocal) ----
    tc, amp, vowel = ctrl['t'], ctrl['amp'], ctrl['vowel']
    frames = []
    for f in range(int(DUR * FPS) + 1):
        t = f / FPS
        i = int(t * 1000)
        w = amp[max(0, i - 15):i + 16]
        a = float(w.max()) if len(w) else 0.0
        v = S.VOWEL_LIST[int(vowel[min(i, len(vowel) - 1)])]
        frames.append([round(a, 3), v])
    json.dump({'fps': FPS, 'bpm': BPM, 'duration': DUR, 'frames': frames,
               'sections': {'rank': T_RANK, 'stop': T_STOP, 'earth': T_EARTH, 'signal': T_SIGNAL, 'end': T_END}},
              open(os.path.join(HERE, 'build', 'sing.json'), 'w'), separators=(',', ':'))
    print('done in', round(time.time() - t_start, 1), 's')


if __name__ == '__main__':
    main()
