"""Transcreve um áudio e salva o tempo de início/fim de cada palavra (para sincronizar animações).

Uso: python tempos.py narracao.wav palavras.json
"""
import json
import sys

from faster_whisper import WhisperModel

modelo = WhisperModel("small", device="cpu", compute_type="int8")
segmentos, _ = modelo.transcribe(sys.argv[1], language="pt", word_timestamps=True)
palavras = [
    {"w": p.word.strip(), "s": round(p.start, 2), "e": round(p.end, 2)}
    for seg in segmentos
    for p in seg.words
]
json.dump(palavras, open(sys.argv[2], "w"), ensure_ascii=False)
print(" ".join(f"{i}:{p['w']}@{p['s']}" for i, p in enumerate(palavras)))
