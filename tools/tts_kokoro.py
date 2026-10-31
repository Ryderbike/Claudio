#!/usr/bin/env python3
"""Voice-over with Kokoro-82M (Hugging Face: onnx-community/Kokoro-82M-v1.0-ONNX), Spanish male voice em_alex."""
import json, sys, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
speed = float(sys.argv[1]) if len(sys.argv) > 1 else 1.2
k = Kokoro('/tmp/work/kok/model.onnx', '/tmp/work/kok/voices.npz')
for c in json.load(open('/home/user/Claudio/tools/script.json')):
    a, sr = k.create(c['say'], voice='em_alex', speed=speed, lang='es')
    sf.write(f"/home/user/Claudio/audio/vo/raw_{c['cut']:02d}.wav", a, sr)
    print(c['cut'], round(len(a) / sr, 2), 'slot', c['t1'] - c['t0'])
