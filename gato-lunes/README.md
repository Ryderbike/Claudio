# Guion #4 — El Gato y el Lunes (video estilo palitos)

Video final: `El_Gato_y_el_Lunes.mp4` (1080x1920, 30 fps, ~49 s). Sin créditos de IA: todo se genera con código.

Pipeline (cada paso es reproducible):
1. `python3 tts.py` → voz en off por corte (edge-tts, voz es-MX-JorgeNeural, +25 %) con tiempos por palabra.
2. `python3 timeline.py` → ajusta los 17 cortes a la voz y arma los subtítulos karaoke (3-4 palabras, [CLAVES] en #FFD700).
3. `python3 audio.py` → SFX sintetizados (alarma, cepillo, latido, maullido, puerta, ronroneo, piano, ding…), música y mezcla con ducking.
4. `node render.js preview` → hoja de contacto en `build/preview.png`; `node render.js` → video mudo.
5. `ffmpeg -i build/video_mudo.mp4 -i build/mix.wav -c:v copy -c:a aac -shortest El_Gato_y_el_Lunes.mp4`

Las escenas están en `scene.js` (una función `S[n]` por corte, más su cámara `S[n].cam`).
