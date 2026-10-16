#!/bin/bash
# Deixa a narração no padrão de Reels (-16 LUFS).
# Uso: ./tratar-voz.sh entrada saida.wav [gravada]
#   "gravada" = voz gravada no celular (tira ruído e realça a dicção); sem isso = voz de IA.
set -euo pipefail
if [ "${3:-}" = "gravada" ]; then
  FILTRO="highpass=f=80,afftdn=nf=-25,equalizer=f=3500:t=q:w=1.2:g=2.5,acompressor=threshold=-20dB:ratio=3:attack=8:release=120:makeup=3,loudnorm=I=-16:TP=-1.5:LRA=9"
else
  FILTRO="highpass=f=70,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120:makeup=2,loudnorm=I=-16:TP=-1.5:LRA=9"
fi
ffmpeg -loglevel error -y -i "$1" -af "$FILTRO" -ar 44100 "$2"
