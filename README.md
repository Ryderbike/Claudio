# El Paréntesis del Viernes (Perro) — video en Three.js

Video vertical 9:16 de 50 s (17 cortes) generado con **Three.js** (toon shading + contornos *inverted hull*, rig con IK propio para humano y perro).

- `out/El_Perro_y_el_Sofa.mp4` — resultado final (1080×1920, 30 fps, audio -14 LUFS)
- `src/` — escena (`shots.js` = los 17 cortes como funciones puras del tiempo), modelos (`lib/human.js`, `lib/dog.js`), sets, íconos, subtítulos karaoke
- `tools/` — render determinista por frames (Playwright/Chromium), TTS (Kokoro-82M de Hugging Face, voz em_alex; `tts.py` = Piper, alternativa), alineación (faster-whisper), SFX/mezcla (`audio.py`), `build.sh`

Reproducir: `npm i && python3 tools/tts_kokoro.py 1.3 && (recorte+align.py+schedule.py) && python3 tools/schedule.py && python3 tools/audio.py && node tools/render.mjs 3 && ./tools/build.sh`
