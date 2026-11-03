#!/usr/bin/env bash
# Encode rendered frames + mixed audio into the final MP4 (1080x1920, 30 fps, -14 LUFS)
set -e
FR=${1:-/tmp/work/frames}
ffmpeg -y -v error -framerate 30 -i "$FR/f_%05d.png" -i audio/mix.wav \
  -filter_complex "[1:a]atrim=0:50,loudnorm=I=-14:TP=-1.5:LRA=11[a]" \
  -map 0:v -map "[a]" -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -profile:v high -movflags +faststart \
  -c:a aac -b:a 192k -t 50 out/El_Perro_y_el_Sofa.mp4
ls -la out/El_Perro_y_el_Sofa.mp4
