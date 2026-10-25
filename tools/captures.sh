#!/usr/bin/env bash
# Captures pleine page avec Chrome headless (serveur local requis : node serve.mjs 8765).
# Usage : tools/captures.sh [port]
set -euo pipefail
cd "$(dirname "$0")/.."
PORT=${1:-8765}
OUT=_suivi/captures
mkdir -p "$OUT"
shot() { # nom largeur hauteur_max url
  local name=$1 w=$2 h=$3 url=$4 tmp
  tmp=$(mktemp --suffix=.png)
  google-chrome --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --virtual-time-budget=4000 --window-size="$w,$h" --screenshot="$tmp" "$url" >/dev/null 2>&1
  # recadre sous le footer (fond papier uni en bas de la fenêtre géante)
  local geo bottom
  geo=$(convert "$tmp" -fuzz 1% -trim -format '%h %Y' info:)
  bottom=$(( ${geo% *} + ${geo#* } ))
  convert "$tmp" -crop "${w}x${bottom}+0+0" +repage "$OUT/$name.png"
  rm -f "$tmp"
  echo "$OUT/$name.png ($(identify -format '%wx%h' "$OUT/$name.png"))"
}
shot accueil-320 320 16000 "http://localhost:$PORT/index.html"
shot accueil-360 360 16000 "http://localhost:$PORT/index.html"
shot accueil-390 390 16000 "http://localhost:$PORT/index.html"
shot accueil-1440 1440 12000 "http://localhost:$PORT/index.html"
shot mentions-320 320 8000 "http://localhost:$PORT/mentions-legales.html"
shot mentions-360 360 8000 "http://localhost:$PORT/mentions-legales.html"
shot mentions-390 390 8000 "http://localhost:$PORT/mentions-legales.html"
shot mentions-1440 1440 5000 "http://localhost:$PORT/mentions-legales.html"
