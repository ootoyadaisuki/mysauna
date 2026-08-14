#!/bin/sh
# ============================================================
#  本番（contena.co.jp/mysauna/）へ上げる
# ------------------------------------------------------------
#  使い方:  sh tools/deploy-web.sh
#
#  ⚠ **`assets/story/_原本/` を除外すること。**（作者指定 2026-08-14）
#    頭に `_` が付いたフォルダは配布用ではない元画像の置き場で、
#    ゲームからは一切参照していない。いちど素で rsync して 96MB を
#    公開サーバーへ上げてしまい（本番が111MBになった）、消した。
#
#  ⚠ **`.htaccess` を消さないこと。** サーバー側にしか無いファイルで、
#    中身は `X-Robots-Tag: noindex, nofollow`＝検索に載せないための指定。
#    `--delete` を付けている以上、除外を外すと消える。
# ============================================================
set -e
cd "$(dirname "$0")/.."

rsync -rlvz --delete \
  --exclude='.htaccess' \
  --exclude='.git' \
  --exclude='.DS_Store' \
  --exclude='story/_原本' \
  index.html manifest.webmanifest service-worker.js privacy.html icon.svg \
  css js assets \
  xserver-sakaitaishi:~/contena.co.jp/public_html/mysauna/

echo
echo "--- 本番の大きさ ---"
ssh xserver-sakaitaishi 'du -sh ~/contena.co.jp/public_html/mysauna'
echo "--- noindex が生きているか ---"
curl -sI https://contena.co.jp/mysauna/ | grep -i 'x-robots-tag' || echo '★ noindex が消えている'
echo
echo "https://contena.co.jp/mysauna/"
