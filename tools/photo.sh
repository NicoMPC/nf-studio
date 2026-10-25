#!/usr/bin/env bash
# Génère les variantes du portrait (à lancer une fois, résultat versionné dans src/assets/img).
# Recadrage 4:5 serré sur le visage, légère désaturation pour s'accorder à la palette.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=docs/photo-originale.jpeg
OUT=src/assets/img
mkdir -p "$OUT"
CROP="512x640+74+0"   # 4:5 maximal tiré de la source 640×640, centré sur le visage
for W in 512 448 320; do
  H=$(( W * 5 / 4 ))
  convert "$SRC" -crop "$CROP" +repage -strip -modulate 100,85 -resize "${W}x${H}" -unsharp 0x0.6 \
    -quality 80 "$OUT/nicolas-follezou-${W}.webp"
  convert "$SRC" -crop "$CROP" +repage -strip -modulate 100,85 -resize "${W}x${H}" -unsharp 0x0.6 \
    -interlace Plane -quality 82 "$OUT/nicolas-follezou-${W}.jpg"
done
ls -l "$OUT"
