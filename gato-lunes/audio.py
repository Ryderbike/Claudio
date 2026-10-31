"""Sintetiza los SFX (sin samples externos), música de fondo y mezcla con la voz.
Salida: build/mix.wav"""
import json, subprocess
import numpy as np

SR = 44100
rng = np.random.default_rng(7)
TL = json.load(open("build/timeline.json"))
TOTAL = TL[-1]["end"]


def t_(d):
    return np.arange(int(d * SR)) / SR


def env(n, a=0.005, r=0.1):
    e = np.ones(n)
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na)
    e[-nr:] *= np.linspace(1, 0, nr)
    return e


def band(x, lo, hi):
    """Filtro pasabanda por FFT."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(X, len(x))


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) or 1
    return x / m * peak


def noise(d):
    return rng.standard_normal(int(d * SR))


# ---------------- SFX ----------------
def alarm():
    out = np.zeros(int(1.6 * SR))
    for i in range(6):
        t = t_(0.11)
        f = 1320 if i % 2 else 988
        b = (np.sign(np.sin(2 * np.pi * f * t)) * 0.3 + np.sin(2 * np.pi * f * t)) * env(len(t), 0.003, 0.02)
        s = int((i * 0.13 + (0.25 if i >= 3 else 0)) * SR)
        out[s:s + len(t)] += b
    return norm(out, 0.5)


def groan():
    t = t_(0.9)
    f = 140 - 40 * t / t[-1]
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = sum(np.sin(k * ph) / k for k in range(1, 12))
    x = band(x, 80, 1500) * env(len(t), 0.15, 0.4)
    return norm(x, 0.35)


def whoosh(d=0.8, up=True):
    x = noise(d)
    n = len(x)
    out = np.zeros(n)
    seg = 2048
    for i in range(0, n, seg):
        p = i / n
        c = 300 + 2500 * (p if up else 1 - p)
        out[i:i + seg] = band(x[i:i + seg], c * 0.6, c * 1.6)[: len(out[i:i + seg])]
    return norm(out * np.sin(np.pi * np.linspace(0, 1, n)) ** 2, 0.4)


def brush(d=1.6):
    x = band(noise(d), 2500, 9000)
    t = t_(d)
    am = (0.5 + 0.5 * np.sin(2 * np.pi * 4.5 * t)) ** 2
    return norm(x * am * env(len(t), 0.05, 0.2), 0.28)


def drone(d=2.4):
    t = t_(d)
    x = np.sin(2 * np.pi * 55 * t) + 0.6 * np.sin(2 * np.pi * 82.4 * t) + 0.3 * np.sin(2 * np.pi * 110.7 * t)
    return norm(x * env(len(t), 0.8, 0.6), 0.35)


def pop(f0=420, f1=980, d=0.12, peak=0.5):
    t = t_(d)
    f = f0 + (f1 - f0) * (t / d) ** 0.5
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 30)
    return norm(x, peak)


def ticktock(d=2.4):
    out = np.zeros(int(d * SR))
    for i in range(int(d / 0.16)):
        t = t_(0.03)
        f = 2400 if i % 2 else 1700
        c = np.sin(2 * np.pi * f * t) * np.exp(-t * 220)
        s = int(i * 0.16 * SR)
        out[s:s + len(c)] += c
    return norm(out, 0.35)


def beep(f=1046, d=0.09, peak=0.3):
    t = t_(d)
    return norm(np.sin(2 * np.pi * f * t) * env(len(t), 0.003, 0.02), peak)


def zipper(d=0.45):
    out = np.zeros(int(d * SR))
    k = 0.0
    while k < d - 0.01:
        c = band(noise(0.006), 1500, 7000) * np.exp(-np.arange(int(0.006 * SR)) / 60)
        s = int(k * SR)
        out[s:s + len(c)] += c
        k += 0.011
    return norm(out * env(len(out), 0.02, 0.05), 0.3)


def keys(d=0.6):
    out = np.zeros(int(d * SR))
    for _ in range(9):
        s = int(rng.uniform(0, d - 0.25) * SR)
        t = t_(0.25)
        f = rng.uniform(3000, 6500)
        c = sum(np.sin(2 * np.pi * f * m * t) for m in (1, 1.47, 2.09)) * np.exp(-t * 28)
        out[s:s + len(t)] += c * rng.uniform(0.4, 1)
    return norm(out, 0.28)


def heartbeat(d=3.0, period=0.95):
    out = np.zeros(int(d * SR))
    for i in range(int(d / period) + 1):
        for off, amp in ((0, 1), (0.22, 0.7)):
            t = t_(0.18)
            c = np.sin(2 * np.pi * (55 - 20 * t / 0.18) * t) * np.exp(-t * 25) * amp
            s = int((i * period + off) * SR)
            if s + len(c) <= len(out):
                out[s:s + len(c)] += c
    return norm(out, 0.6)


def meow(d=0.55):
    t = t_(d)
    p = t / d
    f = 520 + 330 * np.sin(np.pi * p ** 0.7) - 120 * p
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = sum(np.sin(k * ph) * (0.8 ** k) for k in range(1, 9))
    form = 0.5 + 0.5 * np.sin(np.pi * np.clip(p * 1.3, 0, 1))
    x = band(x * form, 300, 5000) * env(len(t), 0.04, 0.18)
    return norm(x, 0.35)


def door(d=1.5):
    t = t_(0.25)
    thump = np.sin(2 * np.pi * (75 - 30 * t / 0.25) * t) * np.exp(-t * 18)
    click = band(noise(0.25), 1500, 6000) * np.exp(-t * 90) * 0.5
    dry = np.zeros(int(d * SR))
    dry[: len(t)] = thump + click
    out = dry.copy()
    for k, g in ((0.11, 0.45), (0.23, 0.3), (0.37, 0.18), (0.53, 0.1)):
        s = int(k * SR)
        out[s:] += dry[: len(out) - s] * g
    return norm(out, 0.7)


def sniff():
    out = np.zeros(int(0.7 * SR))
    for k in (0.0, 0.32):
        n = band(noise(0.16), 1800, 7000) * np.sin(np.pi * np.linspace(0, 1, int(0.16 * SR))) ** 2
        s = int(k * SR)
        out[s:s + len(n)] += n
    return norm(out, 0.28)


def cloth(d=0.9):
    x = band(noise(d), 400, 3500)
    t = t_(d)
    am = np.abs(np.sin(2 * np.pi * 2.2 * t)) ** 1.5
    return norm(x * am * env(len(t), 0.05, 0.2), 0.22)


def shimmer(d=1.4):
    out = np.zeros(int(d * SR))
    for i, f in enumerate((1568, 1976, 2349, 2637, 3136, 3951)):
        t = t_(0.7)
        c = np.sin(2 * np.pi * f * t) * np.exp(-t * 6)
        s = int(i * 0.09 * SR)
        out[s:s + len(t)] += c
    return norm(out, 0.22)


def purr(d=2.4):
    t = t_(d)
    x = band(noise(d), 40, 400) * (0.5 + 0.5 * np.sin(2 * np.pi * 26 * t)) ** 3
    return norm(x * env(len(t), 0.4, 0.6), 0.3)


def piano_chord(notes=(130.8, 164.8, 196.0, 246.9, 329.6), d=3.2):
    t = t_(d)
    out = np.zeros(len(t))
    for i, f in enumerate(notes):
        tt = np.clip(t - i * 0.06, 0, None)
        x = sum(np.sin(2 * np.pi * f * h * tt) * (0.55 ** h) for h in range(1, 7))
        out += x * np.exp(-tt * 1.4) * (t >= i * 0.06)
    return norm(out * env(len(t), 0.005, 0.4), 0.45)


def ding(d=1.5):
    t = t_(d)
    x = sum(np.sin(2 * np.pi * 1318 * m * t) * a for m, a in ((1, 1), (2.76, 0.4), (5.4, 0.2))) * np.exp(-t * 3.5)
    return norm(x, 0.35)


# ---------------- Música de fondo (pad suave) ----------------
def pad(d, chord, peak):
    t = t_(d)
    x = np.zeros(len(t))
    for f in chord:
        for det in (-0.6, 0.6):
            x += np.sin(2 * np.pi * (f + det) * t) + 0.3 * np.sin(4 * np.pi * (f + det) * t)
    x *= 0.85 + 0.15 * np.sin(2 * np.pi * 0.25 * t)
    return norm(x * env(len(t), 0.6, 0.6), peak)


def main():
    n = int((TOTAL + 0.5) * SR)
    sfx = np.zeros(n)
    mus = np.zeros(n)

    def put(buf, x, at):
        s = int(at * SR)
        e = min(n, s + len(x))
        if s < n:
            buf[s:e] += x[: e - s]

    S = {c["id"]: c["start"] for c in TL}
    D = {c["id"]: c["end"] - c["start"] for c in TL}
    put(sfx, alarm(), S[1] + 0.0)
    put(sfx, groan(), S[1] + 1.4)
    put(sfx, whoosh(0.9), S[2] - 0.25)
    put(sfx, whoosh(0.7, up=False), S[2] + D[2] * 0.62)
    put(sfx, brush(D[3] - 0.2), S[3] + 0.1)
    put(sfx, drone(D[4] + 0.3), S[4])
    put(sfx, pop(), S[5] + 0.45)
    put(sfx, ticktock(D[6] - 0.1), S[6])
    for k in range(3):
        put(sfx, beep(1046 + 120 * k), S[7] + 0.35 + k * 0.4)
    put(sfx, brush(0.9), S[8] + 0.05)
    put(sfx, zipper(), S[8] + D[8] / 3 + 0.05)
    put(sfx, keys(), S[8] + 2 * D[8] / 3 + 0.05)
    put(sfx, heartbeat(D[9]), S[9] + 0.1)
    put(sfx, meow(), S[10] + 0.9)
    put(sfx, door(), S[11] + 0.55)
    put(sfx, beep(880, 0.18, 0.25), S[12] + 0.2)
    put(sfx, beep(880, 0.18, 0.2), S[12] + 0.6)
    put(sfx, heartbeat(D[12] - 0.3, 0.45) * 0.5, S[12] + 0.2)
    put(sfx, sniff(), S[13] + 0.6)
    put(sfx, cloth(), S[14] + 0.4)
    put(sfx, cloth(0.6), S[14] + 1.6)
    put(sfx, shimmer(), S[15] + 0.1)
    put(sfx, purr(D[15] + D[16]), S[15] + 0.4)
    put(sfx, piano_chord(), S[16] + 0.05)
    HT = TL[-1]["words"][-1]["t"]
    put(sfx, pop(500, 1200, 0.14, 0.55), HT - 0.02)
    put(sfx, ding(), HT + 0.08)

    # pad: frío (La menor) -> cálido (Do mayor 7) desde el corte 13
    put(mus, pad(S[2] + D[2], (220, 261.6, 329.6), 1), 0)
    put(mus, pad(S[13] - S[3] + 0.6, (174.6, 220, 261.6), 1), S[3] - 0.3)
    put(mus, pad(TOTAL - S[13] + 0.5, (261.6, 329.6, 392, 493.9), 1), S[13] - 0.3)

    vo = np.zeros(n)
    for c in TL:
        raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", c["vo"], "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"])
        put(vo, np.frombuffer(raw, np.float32).astype(np.float64), c["vo_at"])

    # ducking de la música bajo la voz
    venv = np.convolve(np.abs(vo), np.ones(4410) / 4410, "same")
    duck = 1 - 0.55 * np.clip(venv / (venv.max() * 0.3), 0, 1)
    mix = vo * 0.95 + sfx * 0.75 + mus * 0.06 * duck
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)  # limitador suave
    mix = norm(mix, 0.93)
    fade = int(0.6 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)
    pcm = (np.stack([mix, mix], 1) * 32767).astype("<i2")
    import wave
    with wave.open("build/mix.wav", "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print("mix ok", round(len(mix) / SR, 2), "s")


if __name__ == "__main__":
    main()
