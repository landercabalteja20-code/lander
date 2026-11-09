#!/usr/bin/env bash
# One-shot installer for the What-If cartoon studio.
#   ./setup.sh            -> installs system tools, Python packages, voice model, fonts
# Safe to re-run: every step skips work that is already done.
set -euo pipefail
cd "$(dirname "$0")"

echo "==> System tools (ffmpeg with libass)"
if ! command -v ffmpeg >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    sudo_cmd=""; [ "$(id -u)" -ne 0 ] && sudo_cmd="sudo"
    $sudo_cmd apt-get update -y && $sudo_cmd apt-get install -y ffmpeg
  elif command -v brew >/dev/null 2>&1; then
    brew install ffmpeg
  else
    echo "Please install ffmpeg (https://ffmpeg.org/download.html) and re-run." >&2; exit 1
  fi
fi

echo "==> Python packages (.venv)"
PY=${PYTHON:-python3}
[ -d .venv ] || "$PY" -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt

echo "==> Kokoro-82M voice model (Apache-2.0) from Hugging Face"
M=assets/models/kokoro
mkdir -p "$M/voices"
HF=https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main
[ -s "$M/model.onnx" ] || curl -fL --retry 4 -o "$M/model.onnx" "$HF/onnx/model.onnx"
for v in af_heart af_bella af_nicole af_aoede af_kore af_sarah af_nova af_sky af_jessica af_river af_alloy \
         am_michael am_puck am_fenrir am_liam am_echo am_eric am_onyx am_adam \
         bf_emma bf_isabella bf_alice bf_lily bm_george bm_fable bm_lewis bm_daniel; do
  [ -s "$M/voices/$v.bin" ] || curl -fsL --retry 4 -o "$M/voices/$v.bin" "$HF/voices/$v.bin"
done
.venv/bin/python - <<'PY'
import glob, os, numpy as np
d = "assets/models/kokoro"
voices = {os.path.basename(p)[:-4]: np.fromfile(p, dtype=np.float32).reshape(-1, 1, 256)
          for p in sorted(glob.glob(f"{d}/voices/*.bin"))}
np.savez(f"{d}/voices.npz", **voices)
print(f"    packed {len(voices)} voices -> {d}/voices.npz")
PY

echo "==> Fonts (SIL Open Font License, Google Fonts)"
F=assets/fonts
dl() { [ -s "$F/$1" ] || curl -fsL --retry 4 -o "$F/$1" "$2"; }
dl Fredoka-SemiBold.ttf "https://fonts.gstatic.com/s/fredoka/v17/X7nP4b87HvSqjb_WIi2yDCRwoQ_k7367_B-i2yQag0-mac3OLyXMFg.ttf"
dl Fredoka-Bold.ttf     "https://fonts.gstatic.com/s/fredoka/v17/X7nP4b87HvSqjb_WIi2yDCRwoQ_k7367_B-i2yQag0-mac3OFiXMFg.ttf"
dl TitanOne-Regular.ttf "https://fonts.gstatic.com/s/titanone/v17/mFTzWbsGxbbS_J5cQcjykw.ttf"
dl Baloo2-ExtraBold.ttf "https://fonts.gstatic.com/s/baloo2/v23/wXK0E3kTposypRydzVT08TS3JnAmtdiayqpv.ttf"
dl Pacifico-Regular.ttf "https://fonts.gstatic.com/s/pacifico/v23/FwZY7-Qmy14u9lezJ96A.ttf"
dl Shrikhand-Regular.ttf "https://fonts.gstatic.com/s/shrikhand/v17/a8IbNovtLWfR7T7bMJwbBA.ttf"

echo "==> Done. Render an episode with:  .venv/bin/python -m studio episodes/blair_face_card.yaml"
