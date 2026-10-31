#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")/.."

dest="$HOME/.local/share/verto"
rev="$(date +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD)"
git diff --quiet HEAD || rev="$rev-dirty"

npm run package

mkdir -p "$dest/releases" "$HOME/.local/share/applications" "$HOME/.local/share/icons/hicolor/scalable/apps"
cp -r release/linux-unpacked "$dest/releases/$rev"
ln -sfn "$dest/releases/$rev" "$dest/current"
ls -1dt "$dest"/releases/* | tail -n +5 | xargs -r rm -rf   # mantém os 4 últimos
cp "src/public/verto.svg" "$HOME/.local/share/icons/hicolor/scalable/apps/verto.svg"

cat > "$HOME/.local/share/applications/verto.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Verto
Icon=verto
Exec=$dest/current/verto
Terminal=false
Categories=Office;Finance;
EOF
