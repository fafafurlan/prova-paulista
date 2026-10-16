"""Gera a narração com a voz oficial do @daprapassar_ (OmniVoice, voz fixada).

Uso: python narrar.py roteiro.txt saida.wav
roteiro.txt: uma frase por linha. Linha em branco = pausa maior.
"""
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from omnivoice import OmniVoice

AQUI = Path(__file__).parent
REF_AUDIO = AQUI / "voz" / "voz-dapra-referencia.wav"
REF_TEXT = "E se eu te dissesse que dá pra saber se você passa na faculdade antes do resultado sair?"
SR = 24000

roteiro, saida = sys.argv[1], sys.argv[2]
linhas = Path(roteiro).read_text(encoding="utf-8").splitlines()

modelo = OmniVoice.from_pretrained("k2-fsa/OmniVoice", device_map="cpu", dtype=torch.float32)
voz = modelo.create_voice_clone_prompt(ref_audio=str(REF_AUDIO), ref_text=REF_TEXT)

partes = []
for linha in linhas:
    if not linha.strip():
        partes.append(np.zeros(int(SR * 0.4), dtype=np.float32))
        continue
    audio = modelo.generate(text=linha.strip(), language="pt", voice_clone_prompt=voz)[0]
    partes += [audio, np.zeros(int(SR * 0.5), dtype=audio.dtype)]
    print("ok:", linha.strip()[:50], flush=True)

sf.write(saida, np.concatenate(partes), SR)
