#!/usr/bin/env node
/* iOSアプリの中に入れる web 一式を www/ にまとめる。
   ビルド工程は「コピーするだけ」＝Web版とアプリ版でコードが分かれない（作者は非エンジニアなので、
   直すファイルは js/ と css/ の1か所だけにしておく）。
   ・service-worker.js はアプリには入れない（Capacitorはローカルから配信するので不要。
     入れると古いキャッシュを掴んで「直したのに変わらない」が起きる）
   ・scenes-preview.html のような確認用ファイルも入れない
   ・**制作中の第2章（js/ch2, js/ch2b）も入れない**（作者指定 8/12）。
     配信アプリでは元々ロックしてあって遊べないが、遊べないものを店に並べる必要はない＝
     ストアに上げるのは第1章だけにする。タイトルの「独立開業編（近日公開！）」は
     index.html に直接書いてあるボタンなので、中身が無くても今までどおり出る。
     www/ はアプリ専用（.gitignore 済み）なので、開発サーバーとブラウザ版（GitHub Pages）は
     今までどおり第2章を開ける＝作者の確認作業は何も変わらない */
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

/* ---- 制作中の第2章を、アプリ用の www/ からだけ取り除く ---- */
const CH2_DIRS = ['js/ch2', 'js/ch2b'];
for (const d of CH2_DIRS) rm(path.join(OUT, d));

/* index.html から、消したファイルを読みに行く <script> の行も落とす。
   残したままだと 404 が並ぶ（動きはするが、起動のたびに読み込みを空振りする） */
const htmlPath = path.join(OUT, 'index.html');
const before = fs.readFileSync(htmlPath, 'utf8');
const after = before
  .split('\n')
  .filter(line => !/<script[^>]+src=["']js\/ch2b?\//.test(line))
  .join('\n');
fs.writeFileSync(htmlPath, after);
const dropped = before.split('\n').length - after.split('\n').length;
console.log(`第2章はアプリに入れない：${CH2_DIRS.join(', ')} を削り、index.html の <script> を ${dropped} 行外した`);
