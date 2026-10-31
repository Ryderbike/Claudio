#!/usr/bin/env python3
"""Synthesise the SFX + music bed from the script's sound cues and mix them with the voice-over (48 kHz stereo)."""
import json, wave, numpy as np

ROOT = '/home/user/Claudio'
SR = 48000
DUR = 50.4
N = int(DUR * SR)
rng = np.random.default_rng(7)
L = np.zeros(N, np.float32)
R = np.zeros(N, np.float32)
MUS_L = np.zeros(N, np.float32)
MUS_R = np.zeros(N, np.float32)


def t_(n): return np.arange(n) / SR
def noise(n): return rng.standard_normal(n).astype(np.float32)


def fft_filter(x, lo=None, hi=None, order=2):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if lo: m *= 1 / (1 + (lo / np.maximum(f, 1e-3)) ** (2 * order))
    if hi: m *= 1 / (1 + (f / hi) ** (2 * order))
    return np.fft.irfft(X * m, len(x)).astype(np.float32)


def env(n, a=0.005, d=0.2, curve=3.0):
    t = t_(n)
    e = np.minimum(t / max(a, 1e-4), 1) * np.exp(-t / max(d, 1e-4))
    return e.astype(np.float32)


def sine(f, n, ph=0.0):
    if np.isscalar(f): return np.sin(2 * np.pi * f * t_(n) + ph).astype(np.float32)
    return np.sin(2 * np.pi * np.cumsum(f) / SR + ph).astype(np.float32)


def sweep(f0, f1, n, expo=True):
    t = np.linspace(0, 1, n)
    f = f0 * (f1 / f0) ** t if expo else f0 + (f1 - f0) * t
    return sine(f, n)


def reverb(x, tail=1.4, mix=0.3, seed=1):
    r = np.random.default_rng(seed)
    n = int(tail * SR)
    ir = r.standard_normal(n) * np.exp(-np.arange(n) / (SR * tail / 5.5))
    ir = fft_filter(ir.astype(np.float32), lo=200, hi=6500)
    ir[:int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    ir /= np.sqrt((ir ** 2).sum()) + 1e-9
    nn = len(x) + n
    y = np.fft.irfft(np.fft.rfft(x, nn) * np.fft.rfft(ir, nn), nn).astype(np.float32)
    out = np.zeros(nn, np.float32); out[:len(x)] += x * (1 - mix); out += y * mix * 1.4
    return out


def put(sig, t0, gain=1.0, pan=0.0, bus='sfx'):
    i0 = int(t0 * SR)
    if i0 >= N: return
    sig = sig[:N - i0]
    gl = gain * np.cos((pan + 1) * np.pi / 4); gr = gain * np.sin((pan + 1) * np.pi / 4)
    if bus == 'mus':
        MUS_L[i0:i0 + len(sig)] += sig * gl; MUS_R[i0:i0 + len(sig)] += sig * gr
    else:
        L[i0:i0 + len(sig)] += sig * gl; R[i0:i0 + len(sig)] += sig * gr


# ------------------------------------------------------------------------------------ sound library
def fridge_open():
    n = int(2.6 * SR); t = t_(n)
    seal = fft_filter(noise(n), lo=300, hi=2600) * env(n, 0.01, 0.14) * 0.8          # gasket release "fwup"
    latch = (sine(1900, n) * env(n, 0.001, 0.012) * 0.5 + fft_filter(noise(n), lo=2500, hi=9000) * env(n, 0.0005, 0.01) * 0.6)
    latch2 = np.roll(latch, int(0.19 * SR)) * 0.5
    hum = (sine(120, n) * 0.5 + sine(240, n) * 0.25 + sine(360, n) * 0.1) * np.minimum(t / 0.35, 1)
    hum *= (1 + 0.06 * np.sin(2 * np.pi * 7 * t))
    shimmer = fft_filter(noise(n), lo=5000, hi=11000) * 0.05 * np.minimum(t / 0.5, 1)
    fade = np.clip((2.6 - t) / 0.15, 0, 1)
    return (seal + latch + latch2 + (hum * 0.16 + shimmer)) * fade


def thud(depth=1.0):
    n = int(0.9 * SR); t = t_(n)
    body = sweep(95, 38, n) * np.exp(-t / 0.16) * 1.0
    cush = fft_filter(noise(n), hi=520) * env(n, 0.004, 0.09) * 1.5
    spring = fft_filter(noise(n), lo=700, hi=2500) * env(n, 0.002, 0.04) * 0.25
    return (body + cush + spring) * depth


def beep_pair():
    n = int(0.5 * SR)
    a = sine(1250, n) * env(n, 0.002, 0.07) * 0.5
    b = np.roll(sine(830, n) * env(n, 0.002, 0.09) * 0.5, int(0.17 * SR))
    return a + b


def tick(f=2600):
    n = int(0.06 * SR)
    return (sine(f, n) * env(n, 0.0005, 0.008) * 0.6 + fft_filter(noise(n), lo=3500, hi=9000) * env(n, 0.0003, 0.005) * 0.6)


def mind_hum(dur):
    n = int(dur * SR); t = t_(n)
    s = (sine(98, n) + sine(98.7, n) * 0.8 + sine(147, n) * 0.35 + sine(196.4, n) * 0.18)
    s *= (0.75 + 0.25 * np.sin(2 * np.pi * 0.9 * t)) * np.minimum(t / 0.8, 1) * np.clip((dur - t) / 0.5, 0, 1)
    s += fft_filter(noise(n), lo=250, hi=900) * 0.08 * np.minimum(t / 0.8, 1)
    return s * 0.3


def sonar(f=1250):
    n = int(2.2 * SR); t = t_(n)
    s = sine(f, n) * env(n, 0.004, 0.32) + sine(f * 2.01, n) * env(n, 0.004, 0.12) * 0.25
    sw = sweep(f * 1.5, f, int(0.06 * SR)); s[:len(sw)] += sw * 0.4
    return reverb(s * 0.5, 1.6, 0.35, 3)[:n]


def whoosh(dur=0.8, f0=300, f1=3500, peak=0.4, gain=0.8):
    n = int(dur * SR); t = t_(n)
    x = noise(n)
    out = np.zeros(n, np.float32)
    k = 6
    for i in range(k):
        a = i / k; b = (i + 1) / k
        fc = f0 * (f1 / f0) ** (0.5 * (a + b))
        seg = fft_filter(x, lo=fc * 0.6, hi=fc * 1.6)
        w = np.exp(-(((t / dur) - (0.5 * (a + b)) * 1.0) ** 2) / (2 * 0.12 ** 2))
        out += seg * w
    shape = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
    shape = np.where(t / dur < peak, (t / dur / peak) ** 1.5, ((1 - t / dur) / (1 - peak)) ** 1.5)
    return out / (np.abs(out).max() + 1e-9) * shape * gain


def pop():
    n = int(0.35 * SR); t = t_(n)
    return (sweep(850, 190, n) * np.exp(-t / 0.045) * 0.8 + fft_filter(noise(n), lo=1500, hi=6000) * env(n, 0.0005, 0.008) * 0.4)


def heartbeat(n_beats, bpm=68, gain=1.0):
    per = 60 / bpm; n = int((n_beats * per + 0.6) * SR); out = np.zeros(n, np.float32)
    for i in range(n_beats):
        i0 = int(i * per * SR)
        lub = sweep(70, 45, int(0.18 * SR)) * np.exp(-t_(int(0.18 * SR)) / 0.05)
        dub = sweep(62, 42, int(0.18 * SR)) * np.exp(-t_(int(0.18 * SR)) / 0.05) * 0.7
        out[i0:i0 + len(lub)] += lub * 1.0
        j0 = i0 + int(0.27 * SR); out[j0:j0 + len(dub)] += dub
    return out * gain * 0.9


def exhale(dur=0.9):
    n = int(dur * SR); t = t_(n)
    x = noise(n)
    f = fft_filter(x, lo=500, hi=3200)
    lo = fft_filter(x, lo=250, hi=900)
    mixf = np.clip(t / dur, 0, 1)
    sig = f * (1 - mixf * 0.6) + lo * mixf * 0.8
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.2
    return sig * e * 0.6


def bubbling(dur):
    n = int(dur * SR); out = np.zeros(n, np.float32)
    t = 0.0
    while t < dur - 0.15:
        f0 = rng.uniform(350, 1200); ln = int(rng.uniform(0.03, 0.07) * SR)
        b = sweep(f0, f0 * rng.uniform(1.5, 2.4), ln) * np.exp(-t_(ln) / 0.02) * rng.uniform(0.15, 0.45)
        i0 = int(t * SR); out[i0:i0 + ln] += b
        t += rng.exponential(0.06) + 0.015
    out += fft_filter(noise(n), lo=150, hi=700) * 0.05
    tt = t_(n)
    return out * np.minimum(tt / 0.2, 1) * np.clip((dur - tt) / 0.3, 0, 1) * 0.8


def sniff():
    n = int(0.22 * SR); t = t_(n)
    s = fft_filter(noise(n), lo=1400, hi=5200)
    e = np.minimum(t / 0.05, 1) * np.exp(-((t - 0.07) ** 2) / (2 * 0.04 ** 2))
    return s * e * 0.55


def ding(f=1568, dur=1.8, gain=0.5):
    n = int(dur * SR)
    s = (sine(f, n) * env(n, 0.002, 0.6) + sine(f * 2.76, n) * env(n, 0.002, 0.25) * 0.3 + sine(f * 5.4, n) * env(n, 0.002, 0.1) * 0.12)
    return reverb(s * gain, 1.2, 0.25, 5)[:n]


def wood_tok(a=1.0):
    n = int(0.3 * SR); t = t_(n)
    body = sweep(280, 160, n) * np.exp(-t / 0.035) * 0.9
    knock = fft_filter(noise(n), lo=700, hi=3400) * env(n, 0.0005, 0.012) * 0.7
    low = sine(95, n) * np.exp(-t / 0.05) * 0.4
    return (body + knock + low) * a


def power_down(dur=2.4):
    n = int(dur * SR); t = t_(n)
    f = 520 * (70 / 520) ** (t / dur) ** 0.8
    s = sine(f, n) * 0.5 + sine(f * 2, n) * 0.2 + sine(f * 1.5, n) * 0.12
    s *= np.minimum(t / 0.1, 1) * (1 - (t / dur)) ** 1.3
    return fft_filter(s, hi=1800) * 0.7


def fabric_sink():
    n = int(0.7 * SR)
    return (fft_filter(noise(n), lo=80, hi=600) * env(n, 0.05, 0.16) * 1.6 + sine(68, n) * env(n, 0.03, 0.2) * 0.5)


def dog_sigh(dur=1.0):
    n = int(dur * SR); t = t_(n)
    x = noise(n)
    fc = np.linspace(900, 500, n)
    s = fft_filter(x, lo=400, hi=1600) * 0.8
    voiced = (sweep(260, 140, n) * 0.25 + sweep(520, 280, n) * 0.1)
    e = np.minimum(t / 0.12, 1) * np.exp(-t / 0.4) * np.clip((dur - t) / 0.2, 0, 1)
    return (s * 0.5 + voiced) * e * 0.8


def rise(dur=1.2):
    n = int(dur * SR); t = t_(n)
    f = 220 * (1760 / 220) ** (t / dur) ** 1.4
    s = sine(f, n) * 0.5 + sine(f * 2, n) * 0.25 + sine(f * 3, n) * 0.1
    s *= (t / dur) ** 1.5 * np.clip((dur - t) / 0.05, 0, 1)
    sp = fft_filter(noise(n), lo=4000, hi=11000) * (t / dur) ** 2 * 0.1
    return (s * 0.5 + sp) * 0.9


def click():
    n = int(0.2 * SR); t = t_(n)
    return (fft_filter(noise(n), lo=2000, hi=8000) * env(n, 0.0002, 0.004) * 0.9 + sine(1500, n) * np.exp(-t / 0.015) * 0.5 + sine(210, n) * np.exp(-t / 0.03) * 0.5)


def shimmer_chord(freqs, dur=3.0, gain=0.35):
    n = int(dur * SR); t = t_(n); s = np.zeros(n, np.float32)
    for k, f in enumerate(freqs):
        s += (sine(f, n) + 0.4 * sine(f * 2, n) + 0.15 * sine(f * 3.01, n)) * np.minimum(t / 0.08, 1) * np.exp(-t / (1.4 + 0.2 * k)) * (1 + 0.08 * np.sin(2 * np.pi * (4 + k) * t))
    return reverb(s * gain / len(freqs) * 1.6, 1.6, 0.3, 6)[:n]


def bell(f, dur=1.4, gain=0.4):
    n = int(dur * SR)
    s = sine(f, n) * env(n, 0.002, 0.45) + sine(f * 2.0, n) * env(n, 0.002, 0.2) * 0.35 + sine(f * 3.0, n) * env(n, 0.002, 0.1) * 0.15
    return s * gain


def traffic(dur):
    n = int(dur * SR); t = t_(n)
    base = fft_filter(noise(n), lo=60, hi=900) * 1.0 * (0.75 + 0.25 * np.sin(2 * np.pi * 0.7 * t))
    out = base.copy()
    for st, ln in [(0.05, 0.9), (0.45, 1.0), (0.85, 0.8)]:
        w = whoosh(ln, 250, 2600, 0.5, 0.7)
        i0 = int(st * SR); m = min(len(w), n - i0)
        if m > 0: out[i0:i0 + m] += w[:m] * 0.8
    out += fft_filter(noise(n), lo=1200, hi=4000) * 0.12
    out *= np.minimum(t / 0.05, 1) * np.clip((dur - t) / 0.012, 0, 1)   # abrupt cut
    return out * 0.55


def piano_note(f, dur=4.0, vel=1.0):
    n = int(dur * SR); t = t_(n); s = np.zeros(n, np.float32)
    for k in range(1, 9):
        fk = f * k * np.sqrt(1 + 0.0004 * k * k)
        if fk > 9000: break
        s += sine(fk, n) * (1.0 / k ** 1.15) * np.exp(-t / (dur / (1.4 + 0.9 * k)) ) * (1.2 if k == 1 else 1.0)
    s *= np.minimum(t / 0.004, 1)
    ham = fft_filter(noise(n), lo=800, hi=4200) * env(n, 0.0005, 0.02) * 0.18
    return fft_filter(s + ham, hi=7500) * vel


def piano_chord(freqs, dur=4.5, gain=0.7):
    n = int(dur * SR); s = np.zeros(n, np.float32)
    for k, f in enumerate(freqs):
        i0 = int(k * 0.018 * SR)
        nt = piano_note(f, dur - 0.05, 1.0 - 0.07 * k)
        m = min(len(nt), n - i0); s[i0:i0 + m] += nt[:m]
    s = s / (np.abs(s).max() + 1e-9) * gain
    return reverb(s, 2.4, 0.33, 9)[:n]


def tink(f=2300):
    n = int(0.5 * SR)
    return bell(f, 0.5, 0.35)


def pad(freqs, dur, gain=1.0, shift=0.0):
    n = int(dur * SR); t = t_(n); s = np.zeros(n, np.float32)
    for k, f in enumerate(freqs):
        for det in (-0.12, 0.0, 0.14):
            s += sine(f * (1 + det / 100), n, ph=k + det) * (0.6 + 0.4 * np.sin(2 * np.pi * (0.05 + 0.013 * k) * t + k)) / (1 + 0.3 * k)
    s = fft_filter(s, hi=1400)
    return s * gain / len(freqs) * np.minimum(t / 2.0, 1) * np.clip((dur - t) / 2.0, 0, 1)


# ------------------------------------------------------------------------------------ cue sheet
# --- cut 1 (0-2.5): fridge
put(fridge_open(), 0.0, 1.0)
# --- cut 2 (2.5-5.5): collapse + low battery
put(thud(), 4.25, 1.2); put(fabric_sink(), 4.27, 0.7)
for k, tb in enumerate([4.75, 5.12]):
    put(beep_pair(), tb, 0.45 - 0.05 * k, pan=0.15)
# --- cut 3 (5.5-8.5): phone
put(mind_hum(3.0), 5.5, 0.9)
for tt in [5.7, 5.98, 6.22, 6.5, 6.72, 7.0, 7.26, 7.5, 7.72, 8.0, 8.24]:
    put(tick(rng.choice([2200, 2600, 3000])), tt, 0.5, pan=rng.uniform(-0.3, 0.3))
# --- cut 4 (8.5-11): protocol
for k in range(3):
    put(sonar(1250 + 150 * k), 8.85 + 0.5 * k, 0.55 - 0.1 * k, pan=0.0)
put(whoosh(0.5, 400, 5000, 0.75, 0.9), 9.5, 0.7)
# --- cut 5 (11-14): bubble pop
put(pop(), 11.5, 0.9, pan=0.3)
put(pop(), 12.1, 0.35, pan=0.3)
# --- cut 6 (14-17): air whoosh + heartbeat
put(whoosh(0.9, 250, 2800, 0.45, 0.8), 14.0, 0.6)
put(heartbeat(5, 68), 14.35, 0.9)
# --- cut 7 (17-20): sigh
put(exhale(0.95), 17.9, 0.65); put(heartbeat(2, 62), 17.2, 0.45)
# --- cut 8 (20-23): chemical bubbling
put(bubbling(3.0), 20.0, 0.6)
# --- cut 9 (23-26): sniffs + ding
put(sniff(), 23.95, 0.7, pan=0.2); put(sniff(), 24.45, 0.7, pan=0.2)
put(ding(1568, 1.8, 0.55), 25.0, 0.8); put(ding(2093, 1.6, 0.35), 25.4, 0.6)
# --- cut 10 (26-29): ball on wood (times probed from the engine: first impact 28.25, second 28.83)
put(wood_tok(1.0), 28.25, 1.0, pan=0.1); put(wood_tok(0.6), 28.83, 0.8, pan=0.1); put(wood_tok(0.25), 29.12, 0.5, pan=0.1)
# --- cut 11 (29-32): warm power-down
put(power_down(2.6), 29.1, 0.8)
# --- cut 12 (32-35.5): hop onto the sofa + settle sigh
put(fabric_sink(), 33.35, 0.9); put(thud(0.5), 33.33, 0.6)
put(dog_sigh(1.1), 34.2, 0.9, pan=-0.2)
# --- cut 13 (35.5-39): golden wave, switch
put(rise(1.15), 36.1, 0.75)
put(click(), 37.28, 1.0); put(shimmer_chord([523.25, 659.25, 783.99, 987.77, 1318.5], 3.0, 0.8), 37.3, 0.8)
# --- cut 14 (39-42): charge
put(bell(1046.5, 1.4, 0.5), 39.5, 0.8)
for k, f in enumerate([523.25, 659.25, 783.99, 1046.5, 1318.5]):
    put(bell(f, 1.2, 0.35), 39.7 + 0.46 * k, 0.6, pan=-0.2 + 0.1 * k)
# --- cut 15 (42-44.5): traffic cut dead
put(traffic(1.25), 42.0, 0.9)
# --- cut 16 (44.5-47.5): warm deep piano chord
put(piano_chord([65.41, 130.81, 196.0, 329.63, 493.88, 659.25], 5.2, 0.95), 44.5, 1.0)
# --- cut 17 (47.5-50): subscribe pop + tail hits
put(pop(), 48.72, 0.8); put(bell(1318.5, 1.2, 0.5), 48.76, 0.7); put(bell(1760.0, 1.2, 0.4), 48.9, 0.6)
put(tink(2300), 49.07, 0.8, pan=-0.3); put(tink(2600), 49.55, 0.7, pan=-0.3)

# ------------------------------------------------------------------------------------ music bed
am = [110.0, 164.81, 220.0, 261.63]       # A minor: dark, tired
fm = [87.31, 130.81, 174.61, 261.63]      # F
cm = [130.81, 164.81, 196.0, 261.63, 329.63]  # C major: warm
put(pad(am, 14.0, 0.35), 0.0, 1.0, bus='mus')
put(pad(fm, 14.0, 0.33), 12.5, 1.0, bus='mus')
put(pad([98.0, 146.83, 196.0, 246.94], 14.0, 0.33), 24.5, 1.0, bus='mus')
put(pad(cm, 14.0, 0.45), 37.0, 1.0, bus='mus')

# ------------------------------------------------------------------------------------ voice-over + ducking + mix
w = wave.open(f'{ROOT}/audio/vo_track.wav')
vo = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
vo = np.pad(vo, (0, max(0, N - len(vo))))[:N]
# slight presence EQ + compression-ish
vo = fft_filter(vo, lo=80)
vo = np.tanh(vo * 1.6) / np.tanh(1.6)
# envelope for ducking
k = int(0.12 * SR)
e = np.convolve(np.abs(vo), np.ones(k) / k, mode='same'); e = e / (e.max() + 1e-9)
duck = 1 - 0.55 * np.clip(e * 3.0, 0, 1)
sfx_gain = 0.85
mus_gain = 0.38
outL = vo * 1.0 + L * sfx_gain * (0.45 + 0.55 * duck) + MUS_L * mus_gain * duck
outR = vo * 1.0 + R * sfx_gain * (0.45 + 0.55 * duck) + MUS_R * mus_gain * duck
# stems for loudness analysis
def _w(name, a):
    with wave.open(f'{ROOT}/audio/{name}.wav', 'wb') as wo:
        wo.setnchannels(1); wo.setsampwidth(2); wo.setframerate(SR); wo.writeframes((np.clip(a, -1, 1) * 32767).astype(np.int16).tobytes())
_w('stem_vo', vo); _w('stem_sfx', (L + R) * 0.5 * sfx_gain); _w('stem_mus', (MUS_L + MUS_R) * 0.5 * mus_gain)
# gentle limiter
m = max(np.abs(outL).max(), np.abs(outR).max())
outL = np.tanh(outL / m * 0.9) / np.tanh(0.9) * 0.9; outR = np.tanh(outR / m * 0.9) / np.tanh(0.9) * 0.9
# end fade
fl = int(0.25 * SR); outL[int(50.0 * SR) - fl:int(50.0 * SR)] *= np.linspace(1, 0, fl); outR[int(50.0 * SR) - fl:int(50.0 * SR)] *= np.linspace(1, 0, fl)
outL[int(50.0 * SR):] = 0; outR[int(50.0 * SR):] = 0
st = np.stack([outL, outR], 1)
with wave.open(f'{ROOT}/audio/mix.wav', 'wb') as wo:
    wo.setnchannels(2); wo.setsampwidth(2); wo.setframerate(SR); wo.writeframes((np.clip(st, -1, 1) * 32767).astype(np.int16).tobytes())
print('mix written', st.shape, 'peak', np.abs(st).max())
