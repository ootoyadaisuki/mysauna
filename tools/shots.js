#!/usr/bin/env node
/* App Store 用のスクリーンショットを撮るための「撮影用ビルド」を作る。
   ふつうの www/ を作ったあと、index.html の最後に撮影用のスクリプトを差し込む。
   ・一定時間ごとに見せたい画面へ勝手に切り替わる（タップしなくても撮れる）
   ・シミュレータ側は tools/shots.sh が simctl で順番に撮る
   ※このビルドは提出には使わない。撮り終わったら `npm run ios:sync` で元に戻す。 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
execFileSync(process.execPath, [path.join(__dirname, 'build-web.js')], { stdio: 'inherit' });

const DWELL = Number(process.env.SHOT_DWELL || 12);   // 1画面あたりの表示秒数
const inject = `
<script>
/* ── App Store スクリーンショット撮影モード ─────────────────────────
   ${DWELL}秒ごとに、見せたい画面へ自動で切り替わる。撮影が終わったら消えるコード。 */
(function () {
  const DWELL = ${DWELL} * 1000;
  const log = m => { try { console.log('[SHOT] ' + m); } catch (e) {} };

  // 見せる店を組む（?reina のデバッグ起動と同じ「いい感じの店」）
  function setupShop() {
    devStartReina();
    G.name = '夕凪湯';
    G.day = 42; G.cash = 1480000; G.najimi = 86; G.regulars = 38;
    G.dirts = [{ x: 3, y: 5 }];
    updateTopbar();
  }

  const STAGES = [
    // ① タイトル画面（何もしない＝そのまま）
    () => log('title'),
    // ② 営業中の店内
    () => { setupShop(); document.getElementById('btnOpen') && document.getElementById('btnOpen').click(); },
    // ③ サウナのカタログ
    () => { shopTab = 'sauna'; renderShop(); document.querySelector('#shop') && document.querySelector('#shop').scrollTo(0, 0); },
    // ④ データ画面（10項目の評価）
    () => { openData(); const t = document.querySelector('[data-tab="rep"]'); if (t) t.click(); },
    // ⑤ 田所との会話
    () => { document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
            G.tadokoro = { ...newTadokoro(), hello: true, met: true, done: 2 };
            openKuroda('intro'); },
    // ⑥ 玲奈編のテレビ（対決の告知）
    () => { document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
            StoryArt.tvTicker = 'サウナ天下分け目 投票対決　勝負は5日間！';
            Story.play(STORY_DUEL_TV, () => {}); },
    // ⑦ 投票対決の開票
    () => { window.DUEL = { yu: 612, so: 298, t0: Date.now() - 3000, mid: false };
            Story.play(STORY_DUEL_WIN, () => {}); },
  ];

  let i = 0;
  function next() {
    if (i >= STAGES.length) { log('done'); return; }
    try { STAGES[i](); } catch (e) { log('stage ' + i + ' error: ' + e.message); }
    log('stage ' + i);
    i++;
    setTimeout(next, DWELL);
  }
  // ゲームの初期化（initUI）が終わってから始める
  setTimeout(next, 1500);
})();
</script>
`;

const idx = path.join(ROOT, 'www', 'index.html');
let html = fs.readFileSync(idx, 'utf8');
html = html.replace('</body>', inject + '</body>');
if (!html.includes('[SHOT]')) html += inject;      // </body> が無い書き方でも入るように
fs.writeFileSync(idx, html);
console.log(`撮影モードを www/index.html に差し込んだ（1画面 ${DWELL}秒 × ${7}画面）`);
