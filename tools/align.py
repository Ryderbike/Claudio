# Word-level timings of each voice-over clip via faster-whisper (audio decoded with ffmpeg, no PyAV decoding)
import json, subprocess, numpy as np, re, sys
from faster_whisper import WhisperModel
m = WhisperModel(sys.argv[1] if len(sys.argv)>1 else "base", device="cpu", compute_type="int8", download_root="/tmp/work/whisper")
def load(path):
    raw = subprocess.run(['ffmpeg','-v','error','-i',path,'-f','f32le','-ac','1','-ar','16000','-'],capture_output=True,check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)
sc = json.load(open('/home/user/Claudio/tools/script.json'))
out = {}
for c in sc:
    p = f"/home/user/Claudio/audio/vo/trim_{c['cut']:02d}.wav"
    segs, _ = m.transcribe(load(p), language="es", word_timestamps=True, beam_size=5)
    ws = [(w.start, w.end, w.word.strip()) for s in segs for w in s.words]
    out[c['cut']] = ws
    print(c['cut'], ' | '.join(f"{w[2]}@{w[0]:.2f}" for w in ws))
json.dump(out, open('/home/user/Claudio/audio/vo/align.json','w'), ensure_ascii=False, indent=1)
