#!/bin/bash
# OGP画像を再生成する。テンプレート（ogp-ja.html / ogp-en.html）を 1200x630 に描画する。
# 使い方: bash scripts/ogp/render.sh   → img/ogp.png, img/ogp-en.png を上書き
# アイコン（appicon.png）は Texter iOS の AppIcon.appiconset/1024.png をコピーしたもの。
# 描画は puppeteer + システムの Google Chrome（pipe 接続）。Chrome CLI の --screenshot はこの環境でハングする。
set -e
cd "$(dirname "$0")/../.."
node scripts/ogp/render.js
