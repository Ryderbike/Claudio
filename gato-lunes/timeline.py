"""Ajusta la línea de tiempo a la voz real y escribe build/timeline.json."""
import json
vo = json.load(open("build/vo.json"))
cuts = json.load(open("cuts.json"))
LEAD, GAP = 0.09, 0.22
t, out = 0.0, []
for c, v in zip(cuts, vo):
    end_speech = v["words"][-1]["t"] + v["words"][-1]["d"]
    d = end_speech - LEAD + GAP + (1.2 if c["id"] == 17 else 0)
    if c["id"] == 1: d += 0.25  # deja sonar la alarma
    off = t + (0.25 if c["id"] == 1 else 0) - LEAD
    words = [{"w": w["w"], "t": round(off + w["t"], 3), "d": round(w["d"], 3)} for w in v["words"]]
    out.append({"id": c["id"], "start": round(t, 3), "end": round(t + d, 3), "text": c["text"],
                "vo": v["file"], "vo_at": round(off, 3), "words": words})
    t += d
json.dump(out, open("build/timeline.json", "w"), ensure_ascii=False, indent=1)
print("total", round(t, 2))

# ---------- Subtítulos karaoke: tokens del guion alineados a la voz ----------
import re, unicodedata


def nz(s):
    s = unicodedata.normalize("NFD", s.lower())
    return "".join(ch for ch in s if ch.isalnum())


subs = []
for c in out:
    toks, kw = [], False
    for raw in c["text"].replace("...", " ").split():
        if raw.startswith("["): kw = True
        word = raw.replace("[", "").replace("]", "")
        toks.append({"w": word, "kw": kw})
        if "]" in raw: kw = False
    # alinear: cada palabra TTS consume tokens hasta igualar el texto
    i, timed = 0, []
    for w in c["words"]:
        target, acc, grp = nz(w["w"]), "", []
        while i < len(toks) and len(acc) < len(target):
            acc += nz(toks[i]["w"]); grp.append(toks[i]); i += 1
        for k, g in enumerate(grp):
            dd = w["d"] / len(grp)
            timed.append({**g, "t": round(w["t"] + k * dd, 3), "d": round(dd, 3)})
    for g in toks[i:]:
        timed.append({**g, "t": timed[-1]["t"] + 0.2, "d": 0.2})
    # trocear en 3-4 palabras; no partir frases [CLAVE] multi-palabra
    chunk = []
    def flush():
        if chunk: subs.append({"cut": c["id"], "words": chunk.copy()}); chunk.clear()
    for j, tk in enumerate(timed):
        chunk.append(tk)
        nxt = timed[j + 1] if j + 1 < len(timed) else None
        inside_kw = tk["kw"] and nxt is not None and nxt["kw"] and "]" not in c["text"].replace("...", " ").split()[j]
        punct = tk["w"][-1] in ",.;:?!"
        if not inside_kw and (len(chunk) >= 4 or (punct and len(chunk) >= 2) or (len(chunk) >= 3 and nxt and nxt["kw"] and nxt["w"] != nxt["w"].lower() and len(timed) - j > 2)):
            flush()
    flush()
for k, s in enumerate(subs):
    s["start"] = s["words"][0]["t"] - 0.05
    cut_end = next(c["end"] for c in out if c["id"] == s["cut"])
    nxt = subs[k + 1]["words"][0]["t"] - 0.05 if k + 1 < len(subs) else cut_end
    s["end"] = min(nxt, s["words"][-1]["t"] + s["words"][-1]["d"] + 0.6) if subs[k + 1:] and subs[k + 1]["cut"] == s["cut"] else min(cut_end, nxt)
json.dump({"cuts": out, "subs": subs, "total": round(t, 3)}, open("build/data.json", "w"), ensure_ascii=False)
for s in subs:
    print(f'{s["start"]:6.2f}-{s["end"]:6.2f} ' + " ".join(("*" if w["kw"] else "") + w["w"] for w in s["words"]))
