# Ferramentas de conteúdo do @daprapassar_

Instaladas sozinhas em toda sessão do Claude Code na nuvem pelo script `.claude/hooks/session-start.sh`.
O Python delas fica em `$FERRAMENTAS_PY` (ambiente `~/.ferramentas-venv`).

| Ferramenta | Para quê | Como usar |
|---|---|---|
| **HyperFrames** (`heygen-com/hyperframes`) | Montar e renderizar os Reels (HTML + GSAP → MP4) | `npx hyperframes@0.8.153 check .` · `snapshot . --at 1,5` · `render . -q high -o renders/video.mp4` |
| **OmniVoice** (`k2-fsa/OmniVoice`) | Narração com a voz oficial do perfil | `$FERRAMENTAS_PY ferramentas/narrar.py roteiro.txt narracao.wav` |
| **faster-whisper** | Tempo de cada palavra, para animar o texto junto com a fala | `$FERRAMENTAS_PY ferramentas/tempos.py narracao.wav palavras.json` |
| **ffmpeg** | Volume e limpeza da voz | `ferramentas/tratar-voz.sh entrada.wav saida.wav [gravada]` |
| **Playwright** | Exportar capas e carrosséis feitos em HTML | `node ferramentas/capa.js capa.html capa.jpg` |
| **auto-editor** (`WyattBlue/auto-editor`) | Cortar silêncios de vídeos/áudios gravados | `auto-editor video.mp4 --margin 0.15s -o video-cortado.mp4 --no-open` |
| **rembg** (`danielgatis/rembg`) | Remover fundo de fotos | `$FERRAMENTAS_PY -c "from rembg import remove; open('saida.png','wb').write(remove(open('foto.jpg','rb').read()))"` |
| **edge-tts** | Voz neural reserva (pt-BR-AntonioNeural) | ver observação abaixo |

Na primeira vez, o OmniVoice baixa uns 3 GB de modelo e o whisper uns 500 MB.
A voz oficial é fixada a partir de `voz/voz-dapra-referencia.wav` (voz masculina gerada pelo OmniVoice).

## Padrão visual
- Cores: azul `#1D3FD1`, azul-escuro `#0F1A4A`, amarelo `#FDE047`, fundo escuro `#04060f`.
- Fontes: Archivo (títulos), Inter (texto), Instrument Serif itálico (destaques).
- Formato: 1080×1920. Texto importante dentro do recorte 4:5 do grid (y entre 285 e 1635).
- Sempre: notas de corte como "estimadas, não oficiais"; números conferidos no simulador; sem nomes de alunos.

## Fluxo de um Reels narrado
1. Roteiro (1 frase por linha) → `narrar.py`
2. `tratar-voz.sh` → `tempos.py` (tempo de cada palavra)
3. Composição HyperFrames com cada palavra animada no seu tempo + trilha original
4. `check` → `snapshot` (conferir quadros) → `render`
5. Capa em HTML → `capa.js` → legenda com CTA "link na bio"

Observação sobre o edge-tts na nuvem: o certificado do proxy precisa ser passado ao `certifi`
(`certifi.where = lambda: '/root/.ccr/ca-bundle.crt'` antes de importar `edge_tts`).
