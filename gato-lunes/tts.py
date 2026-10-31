"""Genera la voz en off por corte con edge-tts (gratis) + tiempos por palabra."""
import asyncio, json, re, subprocess, sys
import certifi
certifi.where = lambda: "/root/.ccr/ca-bundle.crt"  # CA del proxy del entorno
import edge_tts

VOICE = sys.argv[1] if len(sys.argv) > 1 else "es-MX-JorgeNeural"
RATE = sys.argv[2] if len(sys.argv) > 2 else "+12%"

def dur(p):
    return float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p]))

async def one(cut):
    clean = re.sub(r"[\[\]]", "", cut["text"]).replace("...", " ").strip()
    c = edge_tts.Communicate(clean, VOICE, rate=RATE, boundary="WordBoundary")
    audio, words = b"", []
    async for ch in c.stream():
        if ch["type"] == "audio": audio += ch["data"]
        elif ch["type"] == "WordBoundary":
            words.append({"w": ch["text"], "t": ch["offset"]/1e7, "d": ch["duration"]/1e7})
    p = f"build/vo_{cut['id']:02d}.mp3"
    open(p, "wb").write(audio)
    return {"id": cut["id"], "file": p, "dur": dur(p), "words": words}

async def main():
    cuts = json.load(open("cuts.json"))
    out = await asyncio.gather(*[one(c) for c in cuts])
    json.dump(out, open("build/vo.json","w"), ensure_ascii=False, indent=1)
    for c, o in zip(cuts, out):
        slot = c["slot"][1]-c["slot"][0]
        print(f"{o['id']:2d} slot {slot:4.1f}s  voz {o['dur']:4.2f}s  {'!!' if o['dur']>slot else ''}")
    print("total voz", sum(o["dur"] for o in out))
asyncio.run(main())
