#!/bin/bash
# App Store 用のスクリーンショットを、iPhone のシミュレータから撮る。
#   使い方: bash tools/shots.sh
# 撮影用ビルド（tools/shots.js）を入れて、一定間隔で自動で切り替わる画面を順番に撮る。
# 撮り終わったら `npm run ios:sync` で提出用のビルドに戻すこと。
set -euo pipefail
cd "$(dirname "$0")/.."

export PATH="/opt/homebrew/bin:$PATH"
export LANG=en_US.UTF-8

DEVICE="${DEVICE:-iPhone 17 Pro Max}"     # 6.9インチ＝1290×2796（この1種類で全機種に使い回せる）
BUNDLE="com.contena.orenosauna"
OUT="${OUT:-shots}"
DWELL="${SHOT_DWELL:-12}"
SHOTS=7

UDID=$(xcrun simctl list devices available | grep -F "$DEVICE (" | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/')
[ -n "$UDID" ] || { echo "シミュレータ「$DEVICE」が見つからない"; exit 1; }
echo "device: $DEVICE ($UDID)"

xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b > /dev/null

echo "--- 撮影用ビルドを作る ---"
SHOT_DWELL="$DWELL" node tools/shots.js
npx cap sync ios > /dev/null

echo "--- ビルド ---"
DD=$(mktemp -d)
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug \
  -sdk iphonesimulator -destination "platform=iOS Simulator,id=$UDID" \
  -derivedDataPath "$DD" CODE_SIGNING_ALLOWED=NO build > "$DD/build.log" 2>&1 \
  || { tail -30 "$DD/build.log"; exit 1; }

xcrun simctl uninstall "$UDID" "$BUNDLE" 2>/dev/null || true
xcrun simctl install "$UDID" "$DD/Build/Products/Debug-iphonesimulator/App.app"
xcrun simctl launch "$UDID" "$BUNDLE" > /dev/null

mkdir -p "$OUT"
echo "--- 撮影（${SHOTS}枚 / 1枚あたり ${DWELL}秒） ---"
sleep 4                                    # 起動とタイトル画面の表示を待つ
for i in $(seq 1 $SHOTS); do
  xcrun simctl io "$UDID" screenshot "$OUT/$(printf '%02d' "$i").png" > /dev/null 2>&1
  echo "  $OUT/$(printf '%02d' "$i").png"
  [ "$i" -lt "$SHOTS" ] && sleep "$DWELL"
done

echo
echo "撮れた画像:"
for f in "$OUT"/*.png; do
  printf '  %s  %s\n' "$f" "$(python3 -c "from PIL import Image;print('x'.join(map(str,Image.open('$f').size)))" 2>/dev/null || echo '?')"
done
echo
echo "提出用のビルドに戻す: npm run ios:sync"
