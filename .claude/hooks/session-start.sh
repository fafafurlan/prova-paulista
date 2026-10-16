#!/bin/bash
# Prepara as ferramentas de conteúdo do @daprapassar_ em sessões do Claude Code na nuvem:
# testes do site (Playwright), HyperFrames (vídeos), OmniVoice (narração),
# faster-whisper (tempos das palavras), auto-editor (cortar silêncios) e rembg (remover fundo).
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

REPO="${CLAUDE_PROJECT_DIR:-$(pwd)}"
VENV="$HOME/.ferramentas-venv"
CA="/root/.ccr/ca-bundle.crt"

# Proxy da nuvem: Python/Hugging Face precisam do certificado dele.
if [ -f "$CA" ]; then
  export REQUESTS_CA_BUNDLE="$CA" SSL_CERT_FILE="$CA"
fi

# 1. Testes do site
(cd "$REPO/tests" && npm install --no-audit --no-fund)

# 2. Skills do HyperFrames + navegador de render
npx -y skills add heygen-com/hyperframes -g --agent claude-code -y >/dev/null
npx -y hyperframes@0.8.153 browser ensure >/dev/null

# 3. Ambiente Python das ferramentas de áudio e imagem
if [ ! -x "$VENV/bin/python" ]; then
  python3 -m venv "$VENV"
fi
"$VENV/bin/pip" install -q --upgrade pip
"$VENV/bin/pip" install -q torch==2.8.0 torchaudio==2.8.0 --index-url https://download.pytorch.org/whl/cpu
"$VENV/bin/pip" install -q omnivoice soundfile scipy faster-whisper auto-editor "rembg[cpu]" edge-tts
"$VENV/bin/auto-editor" --version >/dev/null  # baixa o binário do auto-editor na primeira vez

# 4. Variáveis para o resto da sessão
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo "export FERRAMENTAS_PY=\"$VENV/bin/python\""
    echo "export PATH=\"$VENV/bin:\$PATH\""
    if [ -f "$CA" ]; then
      echo "export REQUESTS_CA_BUNDLE=\"$CA\" SSL_CERT_FILE=\"$CA\""
    fi
  } >> "$CLAUDE_ENV_FILE"
fi
