#!/usr/bin/env bash
# Génère l'image de partage (1200×630) et l'apple-touch-icon (180×180) à partir de tools/og.html.
# À lancer une fois ; résultats versionnés dans src/assets/img.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT=${1:-8799}
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 & SRV=$!
trap 'kill $SRV' EXIT
sleep 1
TMP=$(mktemp --suffix=.png)
google-chrome --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --virtual-time-budget=3000 --window-size=1200,630 --screenshot="$TMP" "http://127.0.0.1:$PORT/tools/og.html" >/dev/null 2>&1
convert "$TMP" -strip -interlace Plane -quality 85 src/assets/img/og-image.jpg
rm -f "$TMP"
# apple-touch-icon : favicon (fond plein, pas de transparence) en 180×180
convert -background "#1C1F22" -density 600 src/assets/img/favicon.svg -resize 180x180 -flatten -strip src/assets/img/apple-touch-icon.png
ls -l src/assets/img/og-image.jpg src/assets/img/apple-touch-icon.png
