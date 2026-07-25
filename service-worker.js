/* 俺のサウナ Service Worker（ネットワーク優先＝更新は常に最新、オフライン時のみキャッシュ） */
const CACHE = 'orenosauna-v5';   // ← 版数を上げると、古いキャッシュを一掃して全ファイルを取り直す（新旧JS混在の黒画面対策）
const ASSETS = [
  './', './index.html', './css/style.css',
  './js/sfx.js', './js/data.js', './js/story.js', './js/game.js',
  './manifest.webmanifest', './icon.svg',
];

/* 開発中（localhost）はキャッシュを一切挟まない。
   古い index.html がキャッシュから復活して登録しにきても、ここで自分を外して手を引く
   ＝「直したのにブラウザが古い画面を出し続ける」の無限ループを断ち切る。
   ※サービスワーカー本体は必ずネットワークから取り直される決まりなので、この判定は確実に効く */
const DEV = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

if (DEV) {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', e => {
    e.waitUntil(
      caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.claim())
    );
  });
  // fetch は横取りしない＝そのままネットワークへ（開発サーバーが「保存するな」と返す）
} else {
  self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
  });

  self.addEventListener('activate', e => {
    e.waitUntil(
      caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
        .then(() => self.clients.claim())
    );
  });

  self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
  });
}
