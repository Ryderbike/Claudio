#!/usr/bin/env python3
"""Place each voice-over clip on the 50 s timeline (tempo-fit to its cut), build the VO track and karaoke subtitles."""
import json, re, subprocess, wave, math, numpy as np, os

ROOT = '/home/user/Claudio'
SR = 48000
sc = json.load(open(f'{ROOT}/tools/script.json'))
align = json.load(open(f'{ROOT}/audio/vo/align.json'))


def dur(p):
    w = wave.open(p)
    return w.getnframes() / w.getframerate()


# ------------------------------------------------------------------ schedule
GAP, SPILL, MAXF = 0.07, 0.28, 1.3
LEAD = {1: 0.0}
sched = []
prev_end = 0.0
for c in sc:
    n = c['cut']
    d = dur(f'{ROOT}/audio/vo/trim_{n:02d}.wav')
    s = max(c['t0'] + LEAD.get(n, 0.0), prev_end + GAP)
    avail = (c['t1'] + SPILL) - s
    f = min(MAXF, max(1.0, d / avail))
    d2 = d / f
    sched.append(dict(cut=n, start=s, factor=f, dur=d2, end=s + d2))
    prev_end = s + d2

print('cut start  end   factor')
for x in sched:
    print(f"{x['cut']:>3} {x['start']:6.2f} {x['end']:6.2f} {x['factor']:.2f}")
assert sched[-1]['end'] <= 50.05, sched[-1]

# ------------------------------------------------------------------ tempo-adjusted clips + VO track
total = int(50.4 * SR)
vo = np.zeros(total, dtype=np.float32)
for x in sched:
    n = x['cut']
    src = f'{ROOT}/audio/vo/trim_{n:02d}.wav'
    dst = f'{ROOT}/audio/vo/fit_{n:02d}.wav'
    flt = f"atempo={x['factor']:.4f}," if x['factor'] > 1.001 else ''
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-af', flt + 'highpass=f=70,aresample=48000', '-ac', '1', dst], check=True)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', dst, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    a = np.frombuffer(raw, dtype=np.float32)
    # 6 ms fades
    fd = int(0.006 * SR); a = a.copy(); a[:fd] *= np.linspace(0, 1, fd); a[-fd:] *= np.linspace(1, 0, fd)
    i0 = int(x['start'] * SR); vo[i0:i0 + len(a)] += a[:total - i0]
peak = np.abs(vo).max(); vo *= 0.9 / peak
wave_out = (np.clip(vo, -1, 1) * 32767).astype(np.int16)
with wave.open(f'{ROOT}/audio/vo_track.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(wave_out.tobytes())
json.dump(sched, open(f'{ROOT}/audio/schedule.json', 'w'), indent=1)

# ------------------------------------------------------------------ subtitle words
def display_words(text):
    """-> list of (word, highlighted, ends_phrase)"""
    t = text.replace('...', ' ').replace('…', ' ')
    toks = t.split()
    out = []
    for tk in toks:
        hl = '[' in tk
        clean = re.sub(r'[\[\]\.,:;!]', '', tk)
        if clean: out.append((clean, hl, bool(re.search(r'[\.,:;?!]\]?$', tk))))
    if out: out[-1] = (out[-1][0], out[-1][1], True)
    return out


WEAK = set('a al de del el la lo los las un una tu su sus tus mi y o que en con para por si ni te se es no ese este'.split())


def smart_chunks(words):
    """phrase-aware chunks of <=4 words; never end a chunk on a weak function word"""
    phrases, cur = [], []
    for i, w in enumerate(words):
        cur.append(i)
        if w[2]: phrases.append(cur); cur = []
    if cur: phrases.append(cur)
    # merge tiny phrases into the next one when it fits
    merged = []
    for ph in phrases:
        if merged and len(merged[-1]) <= 2 and len(merged[-1]) + len(ph) <= 4: merged[-1] = merged[-1] + ph
        else: merged.append(ph)
    if len(merged) > 1 and len(merged[-1]) <= 1 and len(merged[-2]) + len(merged[-1]) <= 4:
        merged[-2] += merged.pop()
    out = []
    for ph in merged:
        while len(ph) > 4:
            best = None
            for k in (4, 3, 2):
                rest = len(ph) - k
                if rest == 1: continue
                if words[ph[k - 1]][0].lower() in WEAK: continue
                best = k; break
            if best is None: best = 3 if len(ph) - 3 != 1 else 2
            out.append(ph[:best]); ph = ph[best:]
        out.append(ph)
    return out


def chunk_sizes(n):
    if n <= 4: return [n]
    k = math.ceil(n / 4)
    base, extra = divmod(n, k)
    sizes = [base + (1 if i < extra else 0) for i in range(k)]
    sizes.sort(reverse=True)  # longer chunks first
    return sizes


def norm_tokens(ws):
    """merge pure-punct / % tokens into the previous token"""
    out = []
    for (s, e, t) in ws:
        if re.fullmatch(r'[%\.,¿?¡!]+', t) and out:
            out[-1] = (out[-1][0], e, out[-1][2] + t)
        else:
            out.append((s, e, t))
    return out



import difflib, unicodedata
def _norm(w):
    w = unicodedata.normalize('NFD', w.lower())
    return re.sub(r'[^a-z0-9]', '', ''.join(ch for ch in w if unicodedata.category(ch) != 'Mn'))


def align_times(words, ws, x, f):
    """Needleman-Wunsch between displayed words and whisper tokens -> (start,end) per displayed word (global seconds)."""
    A = [_norm(w[0]) for w in words]; B = [_norm(t[2]) for t in ws]
    n, m = len(A), len(B)
    sim = lambda a, b: difflib.SequenceMatcher(None, a, b).ratio()
    gap = -0.45
    D = np.zeros((n + 1, m + 1)); bt = np.zeros((n + 1, m + 1), dtype=int)
    for i in range(1, n + 1): D[i, 0] = i * gap; bt[i, 0] = 1
    for j in range(1, m + 1): D[0, j] = j * gap; bt[0, j] = 2
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cand = [D[i - 1, j - 1] + (sim(A[i - 1], B[j - 1]) * 2 - 0.9), D[i - 1, j] + gap, D[i, j - 1] + gap]
            k = int(np.argmax(cand)); D[i, j] = cand[k]; bt[i, j] = k
    i, j = n, m; pair = {}
    while i > 0 or j > 0:
        k = bt[i, j]
        if i > 0 and j > 0 and k == 0: pair[i - 1] = j - 1; i -= 1; j -= 1
        elif i > 0 and (j == 0 or k == 1): i -= 1
        else: j -= 1
    st = [None] * n; en = [None] * n
    for ii, jj in pair.items():
        if sim(A[ii], B[jj]) >= 0.35:
            st[ii] = ws[jj][0]; en[ii] = ws[jj][1]
    # interpolate unanchored words
    total = ws[-1][1] if ws else x['dur'] * f
    k = 0
    while k < n:
        if st[k] is None:
            a = k
            while k < n and st[k] is None: k += 1
            left = en[a - 1] if a > 0 else 0.0
            right = st[k] if k < n else total
            cnt = k - a
            for q in range(cnt):
                st[a + q] = left + (right - left) * q / cnt; en[a + q] = left + (right - left) * (q + 1) / cnt
        else:
            k += 1
    return [(x['start'] + a_ / f, x['start'] + b_ / f) for a_, b_ in zip(st, en)]

chunks = []
for x, c in zip(sched, sc):
    words = display_words(c['text'])
    ws = norm_tokens([tuple(w) for w in align[str(c['cut'])]])
    f = x['factor']
    times = align_times(words, ws, x, f)
    i = 0
    cc = []
    for idx in smart_chunks(words):
        part = [words[j] for j in idx]; tt = [times[j] for j in idx]
        cc.append(dict(start=tt[0][0] - 0.04, end=tt[-1][1], words=[dict(text=w[0], hl=w[1], start=t[0], end=t[1]) for w, t in zip(part, tt)]))
    chunks.extend(cc)

# visibility: keep chunk until the next one starts (or 0.45 s after its last word)
for i, ch in enumerate(chunks):
    nxt = chunks[i + 1]['start'] if i + 1 < len(chunks) else 50.0
    ch['end'] = min(nxt - 0.001, ch['end'] + 0.45)
    ch['start'] = max(0.0, ch['start'])
chunks[-1]['end'] = 50.0
os.makedirs(f'{ROOT}/out', exist_ok=True)
json.dump(chunks, open(f'{ROOT}/out/subs.json', 'w'), ensure_ascii=False, indent=1)
print(len(chunks), 'chunks')
for ch in chunks[:6]:
    print(f"{ch['start']:.2f}-{ch['end']:.2f}", ' '.join(('[' + w['text'] + ']') if w['hl'] else w['text'] for w in ch['words']))
