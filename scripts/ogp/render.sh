#!/bin/bash
# OGP画像を再生成する。テンプレート（ogp-ja.html / ogp-en.html）をヘッドレスChromeで1200x630に描画する。
# 使い方: bash scripts/ogp/render.sh   → img/ogp.png, img/ogp-en.png を上書き
# アイコン（appicon.png）は Texter iOS の AppIcon.appiconset/1024.png をコピーしたもの。
set -e
cd "$(dirname "$0")"
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
render() {
  "$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --virtual-time-budget=10000 --window-size=1200,630 --user-data-dir="$(mktemp -d)" \
    --screenshot="../../img/$2" "file://$PWD/$1" >/dev/null 2>&1
  echo "rendered img/$2"
}
render ogp-ja.html ogp.png
render ogp-en.html ogp-en.png
