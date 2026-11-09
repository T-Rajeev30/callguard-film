"""
CallGuard film — sound design, score and mix from REAL recorded samples.

  * SFX: CC0 field/foley recordings (Sonic Pi library, from freesound.org)  -> assets/sfx
  * Score: FluidR3_GM instrument notes (piano, strings, cello, pizzicato, contrabass) played by a
    small sampler                                                           -> assets/inst
  * Voice (optional): files made by `npm run voice`, phone-EQ'd / polished here
  * Mix + master: Spotify Pedalboard (reverb, EQ, compression, sidechain-style ducking, limiter)

Reads src/timing.json (the cue sheet the animation is also timed from). Writes:
  public/audio/mix.wav          the only audio track the film plays
  src/audio/voice-timing.json   real durations of voice lines (drives the burnt-in captions)

Run:  python scripts/audio_build.py
"""
import json, os
import numpy as np
from pedalboard import (Pedalboard, Reverb, Compressor, Limiter, HighpassFilter, LowpassFilter,
                        HighShelfFilter, LowShelfFilter, Distortion, Gain, Chorus)
from pedalboard.io import AudioFile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = json.load(open(os.path.join(ROOT, 'src', 'timing.json'), encoding='utf-8'))
SR = 48000
DUR = T['duration']
N = int(DUR * SR)
rng = np.random.default_rng(11)

def path(*p): return os.path.join(ROOT, *p)

# ---------------------------------------------------------------- loading ----
def fix_wav_header(p):
    """Streaming TTS APIs often write WAV headers with an 'unknown' length (0xFFFFFFFF).
    Rewrite the RIFF and data sizes from the real file size so readers don't think it's ~2^31 frames."""
    if not p.lower().endswith('.wav'): return
    with open(p, 'r+b') as fh:
        data = bytearray(fh.read())
        if data[:4] != b'RIFF' or data[8:12] != b'WAVE': return
        pos, changed = 12, False
        while pos + 8 <= len(data):
            cid = bytes(data[pos:pos + 4]); size = int.from_bytes(data[pos + 4:pos + 8], 'little')
            if cid == b'data':
                real = len(data) - (pos + 8)
                real -= real % 2
                if size != real:
                    data[pos + 4:pos + 8] = real.to_bytes(4, 'little'); changed = True
                break
            pos += 8 + size + (size % 2)
        riff = len(data) - 8
        if int.from_bytes(data[4:8], 'little') != riff:
            data[4:8] = riff.to_bytes(4, 'little'); changed = True
        if changed:
            fh.seek(0); fh.write(data); fh.truncate()
            print(f'fixed WAV header: {os.path.basename(p)}')

_cache = {}
def load(p):
    """Load any audio file as (2, n) float32 at 48 kHz."""
    if p in _cache: return _cache[p]
    fix_wav_header(p)
    with AudioFile(p).resampled_to(SR) as f:
        n = f.frames
        if n > SR * 600:  # still implausible (>10 min): read in chunks until the data ends
            parts = []
            while True:
                c = f.read(SR * 5)
                if c.shape[-1] == 0: break
                parts.append(c)
            a = np.concatenate(parts, axis=1)
        else:
            a = f.read(n)
    if a.shape[0] == 1: a = np.vstack([a, a])
    a = a[:2].astype(np.float32)
    _cache[p] = a
    return a

def sfx(name): return load(path('assets', 'sfx', name + '.flac'))

NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def midi(n):  # 'A3' -> 57, 'C#4' -> 61
    name, octv = n[:-1], int(n[-1])
    v = NOTE[name[0]] + (1 if '#' in name else 0) - (1 if name.endswith('b') else 0)
    return 12 * (octv + 1) + v

def pitch(a, semis):
    """Resample-based pitch shift (like a classic sampler)."""
    if abs(semis) < 1e-3: return a
    r = 2 ** (semis / 12)
    idx = np.arange(0, a.shape[1] - 1, r)
    i0 = idx.astype(int); fr = (idx - i0).astype(np.float32)
    return a[:, i0] * (1 - fr) + a[:, i0 + 1] * fr

def stretch_to(a, seconds):
    """Varispeed a clip so it lasts `seconds` (used for rewinds and risers)."""
    return pitch(a, 12 * np.log2(a.shape[1] / (seconds * SR)))

def env(a, attack=0.005, release=0.25, length=None):
    a = a.copy()
    if length is not None:
        a = a[:, :int(length * SR)]
    n = a.shape[1]
    at, rl = max(1, int(attack * SR)), max(1, int(min(release, n / SR) * SR))
    a[:, :at] *= np.linspace(0, 1, at)
    a[:, n - rl:] *= np.linspace(1, 0, rl) ** 2
    return a

_inst_index = {}
def note(inst, n, length=None, release=0.4):
    """Play note `n` on `inst` from the nearest recorded sample."""
    if inst not in _inst_index:
        d = path('assets', 'inst', inst)
        _inst_index[inst] = {midi(f[:-4]): os.path.join(d, f) for f in os.listdir(d) if f.endswith('.mp3')}
    table = _inst_index[inst]
    m = midi(n)
    src = min(table, key=lambda k: abs(k - m))
    return env(pitch(load(table[src]), m - src), 0.004, release, length)

def reverse(a): return a[:, ::-1].copy()

# ------------------------------------------------------------------ buses ----
buses = {k: np.zeros((2, N), np.float32) for k in ('music', 'sfx', 'amb', 'voice')}
def place(bus, a, at, gain_db=0.0, pan=0.0):
    i = int(at * SR)
    if i >= N or a.shape[1] == 0: return
    a = a[:, : N - i] * (10 ** (gain_db / 20))
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buses[bus][0, i:i + a.shape[1]] += a[0] * l * 1.414
    buses[bus][1, i:i + a.shape[1]] += a[1] * r * 1.414

def loop(a, seconds, xfade=0.4):
    out = np.zeros((2, int(seconds * SR)), np.float32); pos = 0; xf = int(xfade * SR)
    while pos < out.shape[1]:
        seg = env(a, xfade, xfade)[:, : out.shape[1] - pos]
        out[:, pos:pos + seg.shape[1]] += seg
        pos += a.shape[1] - xf
    return out

C = T['cues']
beat = 60 / T['music']['bpm']

# ------------------------------------------------------------ SOUND DESIGN ----
# 0–3s: a real-feeling call — phone vibration buzz, line hiss in a telephone band
line = loop(sfx('ambi_soft_buzz'), 3.2) * 0.6 + loop(sfx('vinyl_hiss'), 3.2) * 0.5
line = Pedalboard([HighpassFilter(300), LowpassFilter(3400)])(line, SR)
place('amb', env(line, 0.02, 0.05), 0.0, -24)
for c in C['ring']:
    for k in range(2):  # two short vibration pulses
        place('sfx', env(Pedalboard([LowpassFilter(400)])(loop(sfx('ambi_soft_buzz'), 0.22), SR), 0.01, 0.05), c + k * 0.28, -10)
for i, c in enumerate(C['wordTick']): place('sfx', sfx('perc_snap'), c, -20, pan=-0.35 + i * 0.12)

# 3.0: the freeze — a tape-stop, then real silence
place('sfx', env(stretch_to(sfx('vinyl_backspin'), 0.35), 0.001, 0.05), C['tapeStop'][0] - 0.12, -6)

for c in C['bigImpact']:
    place('sfx', env(sfx('misc_cineboom'), 0.001, 1.4, 3.6), c, -3)
    place('sfx', sfx('bd_boom'), c, -5)
for c in C['impact']:
    place('sfx', env(sfx('misc_cineboom'), 0.001, 0.6, 1.4), c, -12)
    place('sfx', sfx('bd_808'), c, -12)
    place('sfx', env(sfx('elec_ping'), 0.001, 0.3, 0.8), c + 0.02, -17, pan=0.2)
for c in C['whoosh']:
    place('sfx', sfx('ambi_swoosh'), c - 0.45, -9)
for c in C['glitch']:
    place('sfx', env(sfx('glitch_perc1'), 0.001, 0.1, 0.35), c, -11)
    place('sfx', env(sfx('glitch_robot1'), 0.001, 0.1, 0.3), c + 0.06, -17, pan=-0.3)
# seven word-objects land: an ascending bell + tabla per word
bells = ['A4', 'B4', 'C5', 'E5', 'G5', 'A5', 'C6']
tablas = ['tabla_na', 'tabla_te1', 'tabla_tun1', 'tabla_ghe1', 'tabla_na', 'tabla_te1', 'tabla_tun1']
for i, c in enumerate(C['slab']):
    place('sfx', sfx(tablas[i]), c, -12, pan=(-1) ** i * 0.3)
    place('sfx', env(pitch(sfx('perc_bell'), midi(bells[i]) - midi('A4')), 0.001, 0.6, 1.2), c + 0.02, -19, pan=(-1) ** (i + 1) * 0.3)
# Prisma typing: soft keys while the transcript assembles
tt = C['typeStart']
while tt < C['typeEnd']:
    place('sfx', env(pitch(sfx('perc_snap'), rng.uniform(4, 9)), 0.001, 0.03, 0.06), tt, -27, pan=rng.uniform(-0.4, 0.4))
    tt += rng.uniform(0.07, 0.12)
for i, c in enumerate(C['uiTick']):
    place('sfx', env(sfx('elec_blip2' if i % 2 else 'elec_blip'), 0.001, 0.08, 0.25), c, -15, pan=0.35)
for a, b in C['riser']:
    r = reverse(env(sfx('misc_cineboom'), 0.001, 0.5, b - a))
    r2 = reverse(stretch_to(sfx('ambi_dark_woosh'), b - a))
    place('sfx', env(r, 0.2, 0.01), a, -9); place('sfx', env(r2, 0.2, 0.01), a, -12)
# the particle storm: shimmering glass + bell cluster
for a, b in C['shimmer']:
    place('sfx', env(loop(pitch(sfx('ambi_glass_hum'), 12), b - a), 0.05, 1.2), a, -17)
    for k in range(10):
        place('sfx', env(pitch(sfx('perc_bell'), rng.integers(0, 24)), 0.001, 0.4, 0.9), a + 0.05 + k * 0.11, -26, pan=rng.uniform(-0.8, 0.8))
# sonic signature on the lockup
for c in C['signature']:
    for k, n in enumerate(['E5', 'A5', 'B5']):
        place('music', note('acoustic_grand_piano', n, 2.6, 1.6), c + k * 0.16, -6, pan=-0.25 + 0.25 * k)
    place('sfx', env(sfx('elec_chime'), 0.001, 1.0, 2.5), c + 0.32, -14)

# ------------------------------------------------------------------ SCORE ----
PROG = [('A', ['A2', 'E3', 'C4']), ('F', ['F2', 'C3', 'A3']), ('C', ['C3', 'G3', 'E4']), ('G', ['G2', 'D3', 'B3'])]
ROOTS = {'A': 'A1', 'F': 'F1', 'C': 'C2', 'G': 'G1'}
PIZZ = {'A': ['A3', 'E4', 'A4', 'C5'], 'F': ['F3', 'C4', 'F4', 'A4'], 'C': ['C4', 'G4', 'C5', 'E5'], 'G': ['G3', 'D4', 'G4', 'B4']}

def section(a, b, inten):
    t, k = a, 0
    while t < b - 0.05:
        name, chord = PROG[(k // 4) % 4]
        if k % 4 == 0:
            d = min(4 * beat, b - t)
            for n in chord: place('music', note('string_ensemble_1', n, d + 0.6, 0.6), t, -14 + 4 * inten)
            if inten >= 0.8: place('music', note('contrabass', ROOTS[name], d, 0.3), t, -8)
        if inten >= 0.45: place('music', sfx('elec_soft_kick'), t, -15 + 6 * inten)
        if inten >= 0.8:
            if k % 2 == 0: place('music', sfx('drum_heavy_kick'), t, -12)
            else: place('music', sfx('drum_snare_soft'), t, -15)
            place('music', env(sfx('drum_cymbal_closed'), 0.001, 0.05, 0.12), t + beat / 2, -22, pan=0.3)
        if inten >= 0.5:
            for h in (0, 1):
                n = PIZZ[name][(2 * k + h) % 4]
                place('music', note('pizzicato_strings', n, 0.5, 0.2), t + h * beat / 2, -16 + 5 * inten, pan=-0.2 if h else 0.2)
        t += beat; k += 1

for a, b, inten in T['music']['sections']:
    section(a, b, inten)
# the KAL timeline: low cello + drone under the freeze
place('music', env(note('cello', 'A2', 3.0, 1.2), 0.6, 1.0), 3.8, -12)
place('amb', env(loop(pitch(sfx('ambi_drone'), -5), 4.0), 0.8, 0.8), 3.8, -18)
# tabla groove returns under the reveal
place('music', env(loop(sfx('loop_tabla'), 4.4, 0.1), 0.3, 0.8), 35.0, -15)
# lockup: wide chord, strings and bass
for n in ['A2', 'E3', 'A3', 'C4', 'E4']:
    place('music', env(note('string_ensemble_1', n, 3.2, 2.0), 0.05, 2.0), 41.0, -11)
place('music', note('contrabass', 'A1', 3.0, 1.5), 41.0, -8)

# ------------------------------------------------------------------ VOICE ----
manifest_p = path('src', 'audio', 'manifest.json')
manifest = json.load(open(manifest_p, encoding='utf-8')) if os.path.exists(manifest_p) else {}
narrator_fx = Pedalboard([HighpassFilter(80), LowShelfFilter(200, -2), HighShelfFilter(6000, 2.5),
                          Compressor(-20, 3.5, 5, 80), Reverb(0.18, 0.6, 0.06, 0.94), Gain(2)])
phone_fx = Pedalboard([HighpassFilter(320), LowpassFilter(3300), Distortion(6), Compressor(-18, 4, 3, 60), Gain(-1)])
timbre_fx = Pedalboard([HighpassFilter(90), Compressor(-20, 3, 5, 80), Reverb(0.12, 0.5, 0.05, 0.95)])
vt = {}
for v in T['voice']:
    key = v['id']
    rel = manifest.get(key)
    if not rel: continue
    a = load(path('public', rel))
    fx = phone_fx if v['role'] == 'caller' else timbre_fx if v['role'] == 'timbre' else narrator_fx
    a = fx(a, SR)
    if v['role'] == 'caller':  # line crackle under the caller
        a = a + Pedalboard([HighpassFilter(300), LowpassFilter(3400)])(env(sfx('vinyl_hiss')[:, : a.shape[1]]), SR) * 0.08
    place('voice', a, v['at'], 0 if v['role'] != 'caller' else -2)
    vt[v['id']] = round(a.shape[1] / SR, 3)
json.dump(vt, open(path('src', 'audio', 'voice-timing.json'), 'w', encoding='utf-8'), indent=2)

# ------------------------------------------------------------- MIX/MASTER ----
music = Pedalboard([HighpassFilter(35), Reverb(0.55, 0.45, 0.22, 0.8, 1.0), Compressor(-18, 2.5, 15, 200)])(buses['music'], SR)
sfx_b = Pedalboard([HighpassFilter(25), Reverb(0.35, 0.5, 0.1, 0.92)])(buses['sfx'], SR)
amb = buses['amb']
voice = buses['voice']

# sidechain-style ducking: music and ambience dip ~8 dB under any voice
venv = np.abs(voice).max(axis=0)
win = int(0.12 * SR)
venv = np.convolve(venv, np.ones(win) / win, mode='same')
duck = 1 - 0.6 * np.clip(venv / (venv.max() + 1e-9) * 4, 0, 1)
mix = music * duck + amb * duck + sfx_b + voice

# the two silences are absolute
for a, b in C['silence']:
    mix[:, int(a * SR):int(b * SR)] = 0

master = Pedalboard([HighpassFilter(22), Compressor(-14, 2.2, 10, 120), LowShelfFilter(90, 1.5), HighShelfFilter(9000, 1.0), Limiter(-1.0, 80)])
peak = np.abs(mix).max() or 1
out = master((mix / peak * 0.7).astype(np.float32), SR)
out = np.clip(out, -0.891, 0.891)  # hard ceiling at -1 dBFS
for a, b in C['silence']:  # keep silences clean after the limiter's release tail
    i0, i1 = int(a * SR), int(b * SR)
    out[:, i0:i1] = 0
    f = int(0.004 * SR); out[:, i1:i1 + f] *= np.linspace(0, 1, f)
out[:, -int(1.2 * SR):] *= np.linspace(1, 0, int(1.2 * SR))

os.makedirs(path('public', 'audio'), exist_ok=True)
with AudioFile(path('public', 'audio', 'mix.wav'), 'w', SR, 2, bit_depth=24) as f:
    f.write(out)
print(f'mix.wav written ({DUR}s). Voice lines mixed: {len(vt)} ({", ".join(vt) or "none — run npm run voice to add narration"})')
