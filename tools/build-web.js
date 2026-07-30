#!/usr/bin/env node
/* iOSアプリの中に入れる web 一式を www/ にまとめる。
   ビルド工程は「コピーするだけ」＝Web版とアプリ版でコードが分かれない（作者は非エンジニアなので、
   直すファイルは js/ と css/ の1か所だけにしておく）。
   ・service-worker.js はアプリには入れない（Capacitorはローカルから配信するので不要。
     入れると古いキャッシュを掴んで「直したのに変わらない」が起きる）
   ・scenes-preview.html のような確認用ファイルも入れない */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'www');
const COPY = ['index.html', 'css', 'js', 'assets', 'manifest.webmanifest', 'icon.svg'];

function rm(p) { fs.rmSync(p, { recursive: true, force: true }); }
function cp(src, dst) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const f of fs.readdirSync(src)) cp(path.join(src, f), path.join(dst, f));
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

rm(OUT);
fs.mkdirSync(OUT, { recursive: true });
let n = 0;
for (const name of COPY) {
  const src = path.join(ROOT, name);
  if (!fs.existsSync(src)) continue;
  cp(src, path.join(OUT, name));
  n++;
}
console.log(`www/ に ${n} 件をまとめた（${COPY.filter(c => fs.existsSync(path.join(ROOT, c))).join(', ')}）`);
