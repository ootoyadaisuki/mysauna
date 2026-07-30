#!/usr/bin/env node
/* HTMLを決めた大きさのPNGにして返す小さな道具。
   ゲームと同じドット絵フォント（css/font-dotgothic16.css）を使いたい画像は、
   Canvasや画像編集ソフトを使わずにHTMLで組んで、ここで撮る。
   ストア用のフィーチャーグラフィックやアプリアイコンがこれを使う。 */
'use strict';
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MIME = {
  '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.js': 'text/javascript; charset=utf-8',
};
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

/* html を width×height（の scale 倍）で撮って、PNGのバイト列を返す。
   ページからは /css/... /assets/... のようにリポジトリ内のファイルを参照できる。 */
async function renderPng({ html, width, height, scale = 1, wait = 2500, port = 8947, cdpPort = 9347 }) {
  const srv = http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); return; }
    const file = path.join(ROOT, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  await new Promise(r => srv.listen(port, r));

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sauna-render-'));
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars',
    '--force-color-profile=srgb', 'about:blank'], { stdio: 'ignore' });

  let wsUrl = '';
  for (let i = 0; i < 60 && !wsUrl; i++) {
    await sleep(250);
    try { wsUrl = (await (await fetch(`http://127.0.0.1:${cdpPort}/json/version`)).json()).webSocketDebuggerUrl; } catch (e) {}
  }
  if (!wsUrl) { chrome.kill(); srv.close(); throw new Error('Chrome が起きてこない'); }

  const cdp = await CDP.open(wsUrl);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width, height, deviceScaleFactor: scale, mobile: false }, sessionId);
  const loaded = cdp.event('Page.loadEventFired');
  await cdp.send('Page.navigate', { url: `http://localhost:${port}/` }, sessionId);
  await loaded;
  await sleep(wait);                                       // フォントの読み込み待ち
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);

  chrome.kill(); srv.close();
  await sleep(400);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  return Buffer.from(shot.data, 'base64');
}

/* PNGのIHDRから縦横を読む（外部ライブラリを使わない） */
function pngSize(buf) { return [buf.readUInt32BE(16), buf.readUInt32BE(20)]; }

module.exports = { renderPng, pngSize, ROOT };
