#!/usr/bin/env bash
# Installs everything the narrated 3D shorts studio needs. Safe to re-run.
#   ./setup.sh               -> Node deps, Python tools, Kokoro voices, fonts
#   ./setup.sh --expressive  -> also Chatterbox expressive voices (CPU PyTorch, several GB; optional)
set -euo pipefail
cd "$(dirname "$0")"
export HF_HUB_DISABLE_XET=1   # Xet transfer hosts may be blocked; plain HTTPS downloads work

echo "==> Node packages (three.js, fonts)"
npm install --no-audit --no-fund --silent

echo "==> Python tools (.venv): modelling, audio, captions"
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt

echo "==> Kokoro-82M voices (Apache-2.0)"
M=assets/models/kokoro; mkdir -p "$M/voices"
HF=https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main
[ -s "$M/model.onnx" ] || curl -fL --retry 4 -o "$M/model.onnx" "$HF/onnx/model.onnx"
for v in af_heart af_bella bf_emma bf_isabella am_michael am_fenrir am_puck am_onyx am_eric am_adam bm_george bm_fable bm_lewis; do
  [ -s "$M/voices/$v.bin" ] || curl -fsL --retry 4 -o "$M/voices/$v.bin" "$HF/voices/$v.bin"
done
.venv/bin/python - <<'PY'
import glob, os, numpy as np
d = "assets/models/kokoro"
v = {os.path.basename(p)[:-4]: np.fromfile(p, dtype=np.float32).reshape(-1, 1, 256) for p in sorted(glob.glob(f"{d}/voices/*.bin"))}
np.savez(f"{d}/voices.npz", **v); print(f"    packed {len(v)} voices")
PY

if [ "${1:-}" = "--expressive" ]; then
  echo "==> Expressive voices: Chatterbox TTS (MIT), CPU PyTorch in .venv-tts (Python 3.12)"
  if ! .venv-tts/bin/python -c "import chatterbox" >/dev/null 2>&1; then
    PY312=$(command -v python3.12 || true)
    if [ -n "$PY312" ]; then "$PY312" -m venv .venv-tts; else uv venv -q --python 3.12 .venv-tts; fi
    .venv-tts/bin/pip install -q --upgrade pip
    .venv-tts/bin/pip install -q torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cpu \
      || .venv-tts/bin/pip install -q torch==2.6.0 torchaudio==2.6.0   # PyPI build (bigger, also runs on CPU)
    .venv-tts/bin/pip install -q chatterbox-tts soundfile
  fi
  .venv-tts/bin/python -c "from huggingface_hub import snapshot_download as s; s('ResembleAI/chatterbox', allow_patterns=['ve.safetensors','t3_cfg.safetensors','s3gen.safetensors','tokenizer.json','conds.pt'])" \
    || echo "    WARNING: expressive voices not installed; episodes use Kokoro voices"
fi
mkdir -p assets/fonts
for f in Inter-Bold.otf Inter-ExtraBold.otf; do
  [ -s "assets/fonts/$f" ] || cp "/usr/share/fonts/opentype/inter/$f" assets/fonts/ 2>/dev/null \
    || echo "    NOTE: install the Inter font (OFL) into assets/fonts/ for captions"
done
echo "==> Sculpting the cast (assets/chars)"
.venv/bin/python tools/characters.py > /dev/null
echo "==> Done"
