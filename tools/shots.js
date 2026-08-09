#!/usr/bin/env node
/* App Store 用のスクリーンショットを撮る。
   シミュレータで「時間が来たら勝手に画面が変わる」方式はタイミング頼みで当てにならなかったので、
   ヘッドレスの Chrome を1枚ずつ操って撮る方式にした。

   ・1枚ごとに、ページを読み込む → 画面を作る JS を流す → 落ち着くまで待つ → 撮る
   ・端末の見た目（428×926 の3倍＝1284×2778）は Chrome 側で指定するので、
     どのMacで動かしても必ず提出できる大きさになる
   ・ゲーム本体（js/ css/）には撮影用のコードを一切入れない

   使い方:  node tools/shots.js          → shots/01.png … 07.png
            SHOTS=2,5 node tools/shots.js → 2枚目と5枚目だけ撮り直す */
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, process.env.OUT || 'shots');
const PORT = Number(process.env.PORT || 8945);
const CDP_PORT = Number(process.env.CDP_PORT || 9345);
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/* 提出する枠は 6.5インチ。1284×2778 は 428×926 の3倍。 */
const VIEW = { width: 428, height: 926, deviceScaleFactor: 3 };

/* ── 撮る画面 ────────────────────────────────────────────────
   url  : 開くアドレス（?reina は「玲奈編のいい感じの店」から始まるデバッグ起動）
   setup: 画面を作る JS。ゲームの関数をそのまま呼ぶ
   wait : setup のあと、絵が落ち着くまで待つミリ秒 */
const STAGES = [
  {
    name: 'title', url: '/',
    setup: 'null', wait: 2500,
  },
  {
    name: 'open', url: '/?reina',
    /* 開店して、客が入って賑わうまで回す（速度3で35秒＝昼のピーク） */
    setup: `(async () => {
      $('btnOpen').click(); $('btnSpeed').click(); $('btnSpeed').click();
      await new Promise(r => setTimeout(r, 35000));
    })()`,
    wait: 800,
  },
  {
    /* 客の声がいっせいに上がっている絵（作者指定 8/7。旧・設備カタログは
       2枚目の営業中とカタログ部分が丸かぶりで、並べる意味が薄かったので差し替え）。
       開店して賑わわせ、絵を止めてから、**いま各自がしていることに合った台詞**を吹き出しにする。
       湯に浸かっている客に「ととのった」と言わせない＝その場に噛み合う声だけを出す */
    name: 'koe', url: '/?reina',
    setup: `(async () => {
      $('btnOpen').click(); $('btnSpeed').click(); $('btnSpeed').click();
      /* 賑わうまで待つ（時間で切ると、たまたま客が捌けた瞬間に当たって4人しか居ない絵になる）。
         場内10人を上限60秒で待ち、それ以上は待たない */
      for (let i = 0; i < 120; i++) {
        await new Promise(r => setTimeout(r, 500));
        if (i > 40 && G.customers.length >= 10) break;
      }
      G.paused = true;                       // 絵を止める＝声が消えないうちに撮る
      const say = (c) => {
        const d = c.use ? EQ[c.use.item.id] : null;
        const cat = d ? d.cat : null;
        const t = c.use ? (c.use.item.temp ?? d.temp) : 0;
        if (cat === 'furo')  return d.old ? LINES.bathOld : (d.temp ?? 42) <= 40 ? LINES.furoNuruYoi
                                          : (d.temp ?? 42) >= 43 ? LINES.furoAtsu : LINES.bathGood;
        if (cat === 'sauna') return d.gentle ? LINES.saunaMist : t >= 95 ? LINES.saunaGoodHot : LINES.saunaGood;
        if (cat === 'mizu')  return t <= 14 ? LINES.mizuKinkin : LINES.mizuGood;
        if (cat === 'wash')  return d.old ? LINES.washOld : LINES.washGood;
        if (cat === 'rest')  return c.gotTotonoi ? LINES.totonoi : LINES.rest;
        if (c.state === 'toPay' || c.state === 'pay') return LINES.pay;
        return LINES.bathGood;
      };
      for (const c of G.customers) {
        const pool = say(c); if (!pool || !pool.length) continue;
        bubble(c, pool[Math.floor(Math.random() * pool.length)], 999);
      }
      /* 下のカタログは2枚目と同じ「サウナ」タブだと丸かぶりになるので、脱衣所に切り替える
         （畳んでしまうと画面の下半分が空っぽになる＝それはそれで見栄えが悪い） */
      shopTab = 'datsui'; renderShop();
    })()`,
    wait: 900,
  },
  {
    name: 'data', url: '/?reina',
    setup: `$('btnData').click()`, wait: 900,
  },
  {
    name: 'ouen', url: '/?reina',
    /* 常連が応援に来る場面。「応援するぜ！」の台詞まで進める */
    /* advance() は「字送りの途中なら最後まで表示する」ので、回数ではなく台詞で止める */
    setup: `(async () => {
      Story.play(STORY_JOREN_OUEN, () => {});
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 300));
        if (document.body.innerText.includes('応援するぜ')) break;
        Story.advance();
      }
    })()`,
    wait: 1200,
  },
  {
    /* 求人広告を出した2日後の朝＝面接（作者指定 8/7。旧・テレビのニュースと差し替え）。
       戻したくなったら、この中身を下の2行に差し替える（撮れていた絵は shots/old/06_tv.png）：
         StoryArt.tvTicker = 'サウナ天下分け目 投票対決　勝負は5日間！';
         Story.play(STORY_DUEL_TV, () => {});      // wait: 3200
       同じく旧・設備カタログ（3枚目）は shots/old/03_catalog.png ＝
         setup: (() => { shopTab = 'sauna'; renderShop(); })()  // wait: 1200
       ふだんは `G.jobAdDay` を待って朝に開くが、ここは面接の画面そのものを見せたいので直接開く */
    name: 'job', url: '/?reina',
    setup: `(() => { openJobModal(); })()`,
    wait: 1200,
  },
  {
    name: 'duel', url: '/?reina',
    /* 開票。t0 を少し前にしておくと、票のバーが伸び切った絵になる */
    setup: `(() => {
      window.DUEL = { yu: 612, so: 298, t0: Date.now() - 2600, mid: false };
      Story.play(STORY_DUEL_WIN, () => {});
    })()`,
    wait: 3200,
  },
  /* ここから下は「App Storeに並べる7枚」ではなく、審査に添える説明用の絵。
     App内課金（オート修理）の審査には「どこで売っているか分かる画面」を1枚出す決まりがある。
     ヘッドレスのChromeにはストアが無い＝ふだんは売り場が出ないので、
     ここでだけ「ストアにつながっている状態」のふりをさせて撮る（ゲーム本体はいじらない）。
       撮り方: SHOTS=8 OUT=shots-iap node tools/shots.js */
  {
    name: 'iap', url: '/?reina',
    setup: `(() => {
      IAP.available = () => true;
      IAP.price = () => '￥300';
      G.premium = { autoRepair: false, autoRepairOn: true };  // ?reina の店は買った状態で始まるので、買う前に戻す
      openMenu();
    })()`,
    wait: 900,
  },
];

/* ── ゲームを配る小さなサーバー ───────────────────────────── */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const file = path.join(ROOT, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        res.end(buf);
      });
    });
    srv.listen(PORT, () => resolve(srv));
  });
}

/* ── Chrome とのやりとり ──────────────────────────────────── */
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

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  console.log(`サーバー: http://localhost:${PORT}`);

  const profile = fs.mkdtempSync(path.join(require('os').tmpdir(), 'sauna-shot-'));
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
    '--force-color-profile=srgb', '--disable-lcd-text', 'about:blank',
  ], { stdio: 'ignore' });

  let wsUrl = '';
  for (let i = 0; i < 60 && !wsUrl; i++) {
    await sleep(250);
    try {
      const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      wsUrl = (await r.json()).webSocketDebuggerUrl;
    } catch (e) { /* まだ起きていない */ }
  }
  if (!wsUrl) { console.error('Chrome が起きてこない'); process.exit(1); }
  const cdp = await CDP.open(wsUrl);

  const pick = (process.env.SHOTS || '').split(',').map(s => Number(s.trim())).filter(Boolean);
  const done = [];

  for (let i = 0; i < STAGES.length; i++) {
    const st = STAGES[i], no = i + 1;
    if (pick.length && !pick.includes(no)) continue;

    /* 1枚ごとに新しいタブ＝前の画面やセーブを引きずらない */
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', { ...VIEW, mobile: true }, sessionId);

    const loaded = cdp.event('Page.loadEventFired');
    await cdp.send('Page.navigate', { url: `http://localhost:${PORT}${st.url}` }, sessionId);
    await loaded;
    await sleep(1800);                                  // initUI とフォントの読み込みを待つ

    const r = await cdp.send('Runtime.evaluate', {
      expression: st.setup, awaitPromise: true, returnByValue: true,
    }, sessionId);
    if (r.exceptionDetails) {
      console.error(`  ${no} ${st.name}: setup が失敗 → ${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description || ''}`);
    }
    await sleep(st.wait);

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
    const file = path.join(OUT, `${String(no).padStart(2, '0')}_${st.name}.png`);
    fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
    done.push(file);
    console.log(`  ${path.relative(ROOT, file)}`);

    await cdp.send('Target.closeTarget', { targetId });
  }

  chrome.kill();
  srv.close();
  await sleep(500);                                     // Chrome が profile を離すのを待つ
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* 消し残しは放っておく */ }

  console.log('\n撮れた画像:');
  for (const f of done) {
    const b = fs.readFileSync(f);
    /* PNG の IHDR から縦横を読む（外部ライブラリを使わない） */
    console.log(`  ${path.relative(ROOT, f)}  ${b.readUInt32BE(16)}×${b.readUInt32BE(20)}`);
  }
  process.exit(0);
})();
