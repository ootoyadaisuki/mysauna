#!/usr/bin/env node
/* Google Play の「フィーチャーグラフィック」（1024×500・必須）を作る。
   ゲームと同じドット絵フォントを使いたいので、HTMLを組んでヘッドレスChromeで撮る。
   使い方:  node tools/feature-graphic.js  →  shots/feature-1024x500.png */
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'shots', 'feature-1024x500.png');
const PORT = 8946, CDP_PORT = 9346;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/* Playは端によせた文字を切ることがあるので、左右に余白を大きくとる */
const HTML = `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="/css/font-dotgothic16.css">
<style>
  html,body{margin:0;width:1024px;height:500px;overflow:hidden}
  body{
    font-family:'DotGothic16',sans-serif; color:#f4e6c8;
    background:
      radial-gradient(120% 90% at 22% 40%, #6b4a2e 0%, #3a2617 55%, #1e140c 100%);
    display:flex; align-items:center; justify-content:center; padding:0 96px; box-sizing:border-box;
  }
  /* 板張りの横線をうっすら重ねて銭湯の壁に見せる */
  body::before{content:'';position:absolute;inset:0;
    background:repeating-linear-gradient(180deg,rgba(0,0,0,.18) 0 2px,transparent 2px 26px);}
  .wrap{position:relative;display:flex;align-items:center;justify-content:center;text-align:center}
  h1{margin:0;font-size:96px;letter-spacing:.06em;color:#ffd98a;white-space:nowrap;
     text-shadow:0 6px 0 #6b3a12, 0 10px 22px rgba(0,0,0,.5)}
  p{margin:22px 0 0;font-size:29px;line-height:1.6;color:#f0e2c4;white-space:nowrap}
</style>
<div class="wrap">
  <div>
    <h1>俺のサウナ</h1>
    <p>たぶん世界初、サウナの経営シミュレーション。<br>あなただけのオリジナルサウナを作ろう。</p>
  </div>
</div>`;

const sleep = ms => new Promise(r => setTimeout(r, ms));

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.waits = new Map(); this.once = new Map(); }
  static async open(url) {
    const ws = new WebSocket(url);
    await new Promise((ok, ng) => { ws.onopen = ok; ws.onerror = () => ng(new Error('Chromeに繋がらない')); });
    const cdp = new CDP(ws);
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && cdp.waits.has(m.id)) {
        const { ok, ng } = cdp.waits.get(m.id); cdp.waits.delete(m.id);
        m.error ? ng(new Error(m.error.message)) : ok(m.result);
      } else if (m.method && cdp.once.has(m.method)) {
        const fns = cdp.once.get(m.method); cdp.once.delete(m.method);
        for (const fn of fns) fn(m.params);
      }
    };
    return cdp;
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((ok, ng) => {
      this.waits.set(id, { ok, ng });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  event(method, ms = 20000) {
    return new Promise((ok, ng) => {
      const t = setTimeout(() => ng(new Error(method + ' が来ない')), ms);
      const fns = this.once.get(method) || [];
      fns.push(p => { clearTimeout(t); ok(p); });
      this.once.set(method, fns);
    });
  }
}

const MIME = { '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.html': 'text/html; charset=utf-8', '.png': 'image/png' };

(async () => {
  const srv = http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') { res.writeHead(200, { 'Content-Type': MIME['.html'] }); res.end(HTML); return; }
    const file = path.join(ROOT, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  await new Promise(r => srv.listen(PORT, r));

  const profile = fs.mkdtempSync(path.join(require('os').tmpdir(), 'sauna-fg-'));
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });

  let wsUrl = '';
  for (let i = 0; i < 60 && !wsUrl; i++) {
    await sleep(250);
    try { wsUrl = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch (e) {}
  }
  const cdp = await CDP.open(wsUrl);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1024, height: 500, deviceScaleFactor: 1, mobile: false }, sessionId);
  const loaded = cdp.event('Page.loadEventFired');
  await cdp.send('Page.navigate', { url: `http://localhost:${PORT}/` }, sessionId);
  await loaded;
  await sleep(2500);                                    // フォントの読み込み待ち
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));

  chrome.kill(); srv.close();
  await sleep(400);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  const b = fs.readFileSync(OUT);
  console.log(`${path.relative(ROOT, OUT)}  ${b.readUInt32BE(16)}×${b.readUInt32BE(20)}`);
  process.exit(0);
})();
