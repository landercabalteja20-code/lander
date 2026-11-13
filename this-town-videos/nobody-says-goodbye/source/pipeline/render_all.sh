#!/bin/bash
# Renders every frame of the video with three headless-Chromium workers.
# usage: render_all.sh <frames-dir>   (serve source/anim on http://127.0.0.1:8766 first)
set -e
OUT=${1:-frames}; HERE=$(cd "$(dirname "$0")" && pwd); N=12131; mkdir -p "$OUT"
for w in 0 1 2; do
  R=$(python3 -c "print(','.join(f'{a}-{min(a + 199, $N - 1)}' for k, a in enumerate(range(0, $N, 200)) if k % 3 == $w))")
  node "$HERE/render.js" "$OUT" 720 30 "$R" > "$OUT/log$w.txt" 2>&1 &
done
wait
echo "frames: $(ls "$OUT" | grep -c '^f_.*jpg$')"
