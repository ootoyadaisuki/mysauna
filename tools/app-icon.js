#!/usr/bin/env node
/* アプリアイコンを作る。タイトルロゴをそのまま2行に組んだもの。
   ・ゲームと同じドット絵フォント（DotGothic16）で「俺の／サウナ」
   ・iOS用（1024×1024・角丸なし・透明なし。角丸はOSが付ける）
   ・Android用（普通のアイコンと、端を削られるアダプティブアイコンの前景）
   ・Google Play用（512×512）
   使い方:  node tools/app-icon.js */
'use strict';
const fs = require('fs');
const path = require('path');
const { renderPng, pngSize, ROOT } = require('./render-png');

/* 1024pxで組む。「俺」と「サウナ」を大きく、間の「の」だけ小さくして主役を立てる。
   k で全体の倍率を変える（アダプティブアイコンは外周が削られるので小さめに組む） */
const LOGO = (k, extra = '') => `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="/css/font-dotgothic16.css">
<style>
  html,body{margin:0;width:1024px;height:1024px;overflow:hidden}
  body{
    display:flex;align-items:center;justify-content:center;
    /* タイトル画面と同じ、湯気のこもった濃い茶色 */
    background:radial-gradient(115% 95% at 50% 34%, #5c4028 0%, #34210f 58%, #1b1108 100%);
    ${extra}
  }
  .t{
    font-family:'DotGothic16',sans-serif; color:#ffd98a;
    text-align:center; letter-spacing:.02em;
    /* ロゴと同じ、下に厚みのある立体感 */
    text-shadow:0 ${Math.round(18 * k)}px 0 #6b3a12, 0 ${Math.round(26 * k)}px ${Math.round(40 * k)}px rgba(0,0,0,.55);
  }
  /* 「の」は「俺」の右下に寄り添わせる */
  .r1{display:flex;align-items:flex-end;justify-content:center;line-height:.92}
  .ore{font-size:${Math.round(440 * k)}px}
  .no{font-size:${Math.round(210 * k)}px;margin-left:${Math.round(10 * k)}px;margin-bottom:${Math.round(24 * k)}px}
  .r2{display:block;font-size:${Math.round(300 * k)}px;line-height:1.0;margin-top:${Math.round(10 * k)}px}
</style>
<div class="t">
  <div class="r1"><span class="ore">俺</span><span class="no">の</span></div>
  <span class="r2">サウナ</span>
</div>`;

const HTML = LOGO(1);
/* 前景だけの版。外周18%ぶんが削られても文字が残るように7割の大きさで組む */
const HTML_FG = LOGO(0.7, 'background:transparent;');

const IOS = path.join(ROOT, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
const AND = path.join(ROOT, 'android/app/src/main/res');
const OUT = path.join(ROOT, 'shots');
const DL  = path.join(process.env.HOME, 'Downloads/orenosauna-android');

/* PNGを縮小する。Pillowを呼ぶ（Macに最初から入っているpython3で動く） */
function resize(src, dst, size, { circle = false } = {}) {
  const { execFileSync } = require('child_process');
  const code = `
from PIL import Image, ImageDraw
im = Image.open(${JSON.stringify(src)}).convert('RGBA')
im = im.resize((${size}, ${size}), Image.LANCZOS)
if ${circle ? 'True' : 'False'}:
    n = ${size} * 4
    mask = Image.new('L', (n, n), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, n, n), fill=255)
    im.putalpha(mask.resize((${size}, ${size}), Image.LANCZOS))
im.save(${JSON.stringify(dst)})
`;
  execFileSync('python3', ['-c', code]);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  const base = await renderPng({ html: HTML, width: 1024, height: 1024, wait: 3000 });
  const full = path.join(OUT, 'appicon-1024.png');
  fs.writeFileSync(full, base);
  console.log(`  ${path.relative(ROOT, full)}  ${pngSize(base).join('×')}`);

  /* iOS はこの1枚だけ（残りのサイズはXcodeが作る） */
  fs.writeFileSync(IOS, base);
  console.log(`  ${path.relative(ROOT, IOS)}`);

  /* Android：普通のアイコンと丸アイコン */
  const legacy = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [d, sz] of Object.entries(legacy)) {
    resize(full, `${AND}/mipmap-${d}/ic_launcher.png`, sz);
    resize(full, `${AND}/mipmap-${d}/ic_launcher_round.png`, sz, { circle: true });
  }

  /* Android：アダプティブアイコンの前景（背景色は values/ic_launcher_background.xml） */
  const fgFull = path.join(OUT, 'appicon-foreground-1024.png');
  fs.writeFileSync(fgFull, await renderPng({ html: HTML_FG, width: 1024, height: 1024, wait: 3000, port: 8948, cdpPort: 9348 }));
  const fg = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
  for (const [d, sz] of Object.entries(fg)) resize(fgFull, `${AND}/mipmap-${d}/ic_launcher_foreground.png`, sz);
  console.log('  android/ のアイコン一式');

  /* Google Play のストア用アイコン */
  fs.mkdirSync(DL, { recursive: true });
  resize(full, path.join(DL, 'icon-512.png'), 512);
  console.log(`  ${DL}/icon-512.png`);
  process.exit(0);
})();
