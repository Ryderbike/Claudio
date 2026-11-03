import json, subprocess, sys, wave, os
ls = sys.argv[1] if len(sys.argv) > 1 else '0.85'
sc = json.load(open('/home/user/Claudio/tools/script.json'))
for c in sc:
    out = f"/home/user/Claudio/audio/vo/raw_{c['cut']:02d}.wav"
    subprocess.run(['/tmp/work/venv/bin/python','-m','piper','-m','/tmp/work/voices/es_MX-claude-high.onnx','-f',out,'--length-scale',ls,'--sentence-silence','0.12'],input=c['say'].encode(),check=True,capture_output=True)
    w = wave.open(out); d = w.getnframes()/w.getframerate()
    print(c['cut'], f"slot {c['t1']-c['t0']:.2f}  voice {d:.2f}  ratio {d/(c['t1']-c['t0']):.2f}")
