/* ============================================================
   章を行き来したときの DOM 残り検査（開発時のみ）
   ============================================================
   `applyChapter()` は画面を読み込み直さない。だから
   **第2章で遊ぶ → 保存してもどる → 第1章** が通常操作でできてしまい、
   第2章が書き換えた DOM が第1章の画面に残る。

   2026-08-08 の1日で、この型を3件踏んだ。壊れ方が毎回ちがう。

     ・`syncAreaBar`  … 外観・集客・増築のパネルが残る            → **class（hidden）**
     ・`renderKouko`  … 「🏦 横浜信用金庫／枠5000万円」が残る      → **innerHTML**
     ・融資タブ        … 資金繰りの中身3つの居場所が変わったまま    → **親要素と位置**

   共有側のフックは130か所超、第2章だけの CONF キーは70近い。目視で追う規模ではない。

   ── 使い方 ────────────────────────────────────────
     await chapDiff()            第1章を正として、第2章を経由した往復を測る
     await chapDiff({via: 1, base: 2})   逆向き（第2章を正として、第1章の残りかすを測る）
     await chapDiff({dry: true}) 空振り（第2章へ行かない）＝**揺れの下限**を測る

   本番の実行は、最初に必ず空振りを1本走らせる。そこで出た id は
   「遊ばなくても揺れるもの」なので、本番の結果でも**不安定**の印を付けて出す。

   ── 測り方 ────────────────────────────────────────
     ① guardBoot(base) → base章の画面をひととおり開く → 全部閉じる → 記録A（正）
     ② applyChapter(via) → guardBoot(via) → via章の画面をひととおり開く
     ③ guardBoot(base) → base章の画面を**①と同じ手順で**開く → 全部閉じる → 記録B
     ④ A と B を機械的に比べる

   ⚠ **①でも画面を開くこと。** 起動直後のDOMを正にすると、
     `renderKouko` 型（開いた瞬間に書き換わるもの）が丸ごと写らない。
     開いたまま記録するか閉じてから記録するかは、AとBで揃ってさえいればどちらでもよい。
     ここでは**全部閉じてから**記録する（開いた状態は重なり合って比較にならないため）。

   ⚠ **両端で `guardBoot(base)` して同じ初期状態を作り直す。**
     こうすると手持ち資金・日数・評判のような「遊べば当然変わるもの」が
     そもそも差分に出ない。除外リストを育てる形は、育て方を間違えたときに
     本物を隠すので採らない。

   ⚠ **canvas の中身は toDataURL のハッシュ1個しか見ない。**
     湯の色・吹き出しの大きさ・客の消える位置は全部 canvas 側で、
     DOM差分では1ピクセルも見えない。ハッシュが違えば「絵が違う」とだけ分かる。
     どこが違うかは目で見る。乱数で揺れるので、空振りで揺れたら不安定に落とす。
   ============================================================ */

/* 押してはいけないボタン（日を進める・作り直す・速度を変える＝測定そのものを壊す） */
const DIFF_SKIP_BTN = new Set([
  'btnOpen', 'btnKyugyo', 'btnPause', 'btnSpeed',
  'btnNewGame', 'btnNewGameOk', 'btnNewGameNo', 'btnTitle', 'btnSave',
]);

/* 画面を閉じる。**AとBで同じ手順を踏むためだけの処理**なので、
   ここで class を触ること自体は差分にならない（両方で同じことをする） */
function diffCloseAll() {
  document.querySelectorAll('.overlay').forEach(e => e.classList.add('hidden'));
  if (typeof G !== 'undefined' && G) G.paused = false;
  const g = document.getElementById('game-ui');
  if (g) g.classList.remove('hidden');
}

/* その要素がいま本当に見えているか。
   「開いたつもり」を防ぐのは呼び方ではなく、**確かめること**（第1章セッションの指摘） */
function diffVisible(el) {
  if (!el) return false;
  if (el.classList.contains('hidden') || el.hidden) return false;
  return getComputedStyle(el).display !== 'none';
}

/* ============ 画面をひととおり開く ============
   **表を信じない。**押せるボタンを画面から拾って全部押す＝
   表に載せ忘れた画面も自動で入る。押した結果 `.overlay` が出たかを毎回確かめ、
   出なかったものは「開けなかった」として結果の先頭に出す。            */
function diffOpenAll() {
  const opened = [], failed = [], seenOverlay = new Set();

  const press = (btn, label) => {
    if (!btn || !btn.onclick || DIFF_SKIP_BTN.has(btn.id)) return;
    if (!diffVisible(btn)) { failed.push(label + '（ボタンが出ていない）'); return; }
    let before = [...document.querySelectorAll('.overlay')].filter(diffVisible).map(e => e.id);
    try { btn.onclick(); } catch (e) { failed.push(label + '（例外 ' + e.message + '）'); return; }
    const after = [...document.querySelectorAll('.overlay')].filter(diffVisible).map(e => e.id);
    const fresh = after.filter(id => !before.includes(id));
    if (fresh.length) { fresh.forEach(id => seenOverlay.add(id)); opened.push(label + ' → ' + fresh.join(',')); }
    else opened.push(label + '（画面は出ないボタン）');
    diffCloseAll();
  };

  /* ── 下のボタン（準備中・営業中・帯）を全部押す ── */
  for (const wrap of ['prepPanel', 'bizPanel', 'areaBar', 'topbar']) {
    const box = document.getElementById(wrap); if (!box) continue;
    for (const b of box.querySelectorAll('button')) press(b, wrap + '/' + (b.id || b.textContent.trim()));
  }

  /* ── 運営メニューの中のタブ（料金・ルール・バイト・融資）── */
  const bm = document.getElementById('btnManage');
  if (bm && bm.onclick) {
    try {
      bm.onclick();
      const tabs = [...document.querySelectorAll('#manageBody [data-mtab]')];
      for (const t of tabs) {
        try { t.onclick(); opened.push('運営タブ/' + t.dataset.mtab); }
        catch (e) { failed.push('運営タブ/' + t.dataset.mtab + '（例外 ' + e.message + '）'); }
      }
      if (!tabs.length) failed.push('運営タブ（1つも見つからない）');
    } catch (e) { failed.push('運営メニュー（例外 ' + e.message + '）'); }
    diffCloseAll();
  }

  /* ── 設備カタログ：**全部の区画 × 全部のタブ** ── */
  const back = (typeof G !== 'undefined' && G) ? G.actF : 0;
  const n = (typeof areaCount === 'function') ? areaCount() : 1;
  for (let f = 0; f < n; f++) {
    try {
      if (typeof applyArea === 'function') applyArea(f, true);
      if (typeof G !== 'undefined') G.viewF = f;
      const cats = (typeof chHook === 'function' && chHook('shopCats')) || (typeof CATS !== 'undefined' ? CATS : []);
      for (const [key] of cats) {
        if (typeof shopTab !== 'undefined') { /* 直に代入できないので描画側に渡す */ }
        try {
          window.shopTab = key;
          if (typeof renderShop === 'function') renderShop();
          opened.push('カタログ/' + f + '階/' + key);
        } catch (e) { failed.push('カタログ/' + f + '階/' + key + '（例外 ' + e.message + '）'); }
      }
      if (!cats.length) opened.push('カタログ/' + f + '階（置ける物が無い区画）');
    } catch (e) { failed.push('区画' + f + '（例外 ' + e.message + '）'); }
  }
  try { if (typeof applyArea === 'function') applyArea(back, true); } catch (e) { /* 戻せなくても測定は続ける */ }

  /* ── 館内案内図と、その中の外観・集客・増築 ── */
  if (typeof openGuide === 'function' && typeof areaCount === 'function' && areaCount() > 1) {
    try {
      openGuide();
      opened.push('館内案内図');
      for (const t of document.querySelectorAll('#shopTabsG .tab, #gaikanTabs .tab')) {
        try { t.onclick && t.onclick(); opened.push('外観タブ/' + t.textContent.trim()); }
        catch (e) { failed.push('外観タブ/' + t.textContent.trim() + '（例外 ' + e.message + '）'); }
      }
    } catch (e) { failed.push('館内案内図（例外 ' + e.message + '）'); }
  }

  /* ── ボタンから辿り着けない画面を、関数を直接呼んで開く ──
     押せるボタンが無い画面（日報・求人・バイト管理・屋号・休みの日）は、
     ここで名指しする。**開けたかどうかは必ず確かめる**（開いたつもりを作らない）*/
  const direct = [
    ['屋号',        'nameModal',    () => openNameModal && openNameModal()],
    ['求人',        'jobModal',     () => openJobModal && openJobModal()],
    ['バイト管理',   'staffMgrModal', () => openStaffMgr && openStaffMgr()],
    ['バイトの札',   'staffModal',   () => G.roster && G.roster[0] && openStaffPanel(G.roster[0])],
    ['休みの日',     'offdayModal',  () => typeof yOffDay === 'function' && yOffDay()],
    /* ── 物語のモーダル（第1章セッションの依頼で優先度を上げた）──
       **第2章が同じモーダルを使い回していると、残るのは台詞そのもの。**
       数字やタブの残りかすと違い、**プレイヤーが読んでしまう**種類の事故になる。
       本物の進行は再現しない。DOMに何が書かれるかだけ見たいので、描く関数を直接呼ぶ */
    ['田所の相談',   'tadokoroModal', () => openTadokoroConsult && openTadokoroConsult()],
    /* 黒田は「課題」の中身（d）が要る。作らずに開くと落ちるので、
       検査したいのは台詞の残りかすだけ＝**最小の課題**をその場で組む */
    ['黒田',         'kurodaModal',   () => openKuroda && openKuroda('ask',
                        { need: { type: 'rep', id: null, n: 30 }, advice: '' }, null)],
    ['玲奈の再戦',   'reinaModal',    () => openRematchPrompt && openRematchPrompt()],
    ['鬼頭の礼',     'kitoModal',     () => openKitoThanks && openKitoThanks()],
    ['灰田の集金',   'mikajimeModal', () => { G.mika = G.mika || { due: 30000, week: 1 }; showMikajimeModal(); }],
    /* 日報。開くには `closeDay()` が要り、その一回で日付も売上も動く。
       ⚠ **だからこそ空振りにも同じ手順で入れる。**
       空振りでも同じ差分が出るなら「揺れ」＝不安定の印が付く。
       出ないなら本物。**物差しに掛けていない項目は、判定できないのであって
       本物なのではない**（第1章セッションの指摘 8/8）。
       `diffOpenAll` は本番と空振りで同じものを使うので、ここに置くだけで両方に乗る */
    ['日報',         'reportModal',   () => { if (!G.today) startDay(); closeDay(); }],
  ];
  for (const [label, id, run] of direct) {
    try {
      run();
      if (diffVisible(document.getElementById(id))) { seenOverlay.add(id); opened.push('直接/' + label + ' → ' + id); }
      else failed.push('直接/' + label + '（' + id + ' が出なかった）');
    } catch (e) { failed.push('直接/' + label + '（例外 ' + e.message + '）'); }
    diffCloseAll();
  }

  /* ── 表に載っていない `.overlay` を数える（＝拾い漏れの見張り）── */
  const all = [...document.querySelectorAll('.overlay')].map(e => e.id).filter(Boolean);
  /* ⚠ **物語で出る画面（田所・黒田・玲奈・鬼頭・桑田・灰田の集金・妻の関門）は
        事件を起こさないと開かない。**このテストでは開けていない＝**検査していない。**
        黙って落とすと「全部見た」と読めてしまうので、必ず名前を出す */
  const never = all.filter(id => !seenOverlay.has(id));

  diffCloseAll();
  return { opened, failed, 開けなかった画面: never };
}

/* ============ 記録する ============ */
function diffHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return (h >>> 0).toString(36);
}
/* 1要素ぶんの指紋。**`textContent` だけでは足りない。**
   今日の3件が「文字列」「class」「居場所」でそれぞれ別の欄に出た（第1章セッションの指摘）*/
function diffSnapEl(el) {
  const p = el.parentElement;
  const html = el.innerHTML || '';
  return {
    tag: el.tagName,
    cls: el.className || '',
    hidden: el.hidden ? 1 : 0,
    disp: getComputedStyle(el).display,
    style: el.getAttribute('style') || '',
    htmlH: diffHash(html),
    htmlN: html.length,
    head: html.slice(0, 120).replace(/\s+/g, ' '),
    // 要素が消えも変わりもせず、**居場所だけ**変わる壊れ方（融資タブの引っ越し）
    parent: p ? (p.id || p.tagName) : '—',
    at: p ? [...p.children].indexOf(el) : -1,
  };
}
function diffSnap() {
  const out = {};
  for (const el of document.querySelectorAll('[id]')) out[el.id] = diffSnapEl(el);
  // canvas はハッシュ1つだけ。中身は見ない（見ていないことを結果に明記する）
  const cvs = {};
  for (const id of ['game', 'guide', 'storyArt']) {
    const c = document.getElementById(id);
    if (c && c.tagName === 'CANVAS') {
      try { cvs[id] = diffHash(c.toDataURL()); } catch (e) { cvs[id] = '取れない(' + e.message + ')'; }
    }
  }
  return { el: out, canvas: cvs };
}

/* ============ 比べる ============ */
const DIFF_FIELDS = ['tag', 'cls', 'hidden', 'disp', 'style', 'htmlH', 'parent', 'at'];
function diffCompare(A, B) {
  const found = [];
  const ids = new Set([...Object.keys(A.el), ...Object.keys(B.el)]);
  for (const id of ids) {
    const a = A.el[id], b = B.el[id];
    if (!a) { found.push({ id, 欄: '要素そのもの', A: '（無い）', B: '（増えた）' }); continue; }
    if (!b) { found.push({ id, 欄: '要素そのもの', A: '（有る）', B: '（消えた）' }); continue; }
    for (const k of DIFF_FIELDS) {
      if (a[k] === b[k]) continue;
      const showA = k === 'htmlH' ? a.head + ' …(' + a.htmlN + '字)' : String(a[k]);
      const showB = k === 'htmlH' ? b.head + ' …(' + b.htmlN + '字)' : String(b[k]);
      const row = { id, 欄: k === 'htmlH' ? 'innerHTML' : k, A: showA, B: showB };
      /* **意図的に据え置いた親**（js/chapter.js の chapRestoreDOM）を名指しする。
         無印のまま残すと、半年後に誰かが「5件も漏れている」と読んで、
         **親ごと作り直す＝ボタンを殺す**直し方をする（第1章セッションの指摘）*/
      if (row.欄 === 'innerHTML') {
        const el = document.getElementById(id);
        const kids = el ? [...el.querySelectorAll('[id]')] : [];
        const stat = kids.filter(k2 => typeof CHAP_DOM0 !== 'undefined' && CHAP_DOM0[k2.id]);
        if (stat.length) {
          const ng = stat.filter(k2 => {
            const x = A.el[k2.id], y = B.el[k2.id];
            return x && y && DIFF_FIELDS.some(f => x[f] !== y[f]);
          });
          row.印 = '意図的に据え置き（中に index.html 由来のボタンを抱えるので親は作り直さない）'
                 + '／中の要素 ' + stat.length + '件中 ' + (stat.length - ng.length) + '件が一致'
                 + (ng.length ? '　★不一致：' + ng.map(k2 => k2.id).join(',') : '');
        }
      }
      found.push(row);
    }
  }
  const cvs = [];
  for (const k of new Set([...Object.keys(A.canvas), ...Object.keys(B.canvas)])) {
    if (A.canvas[k] !== B.canvas[k]) cvs.push({ canvas: k, A: A.canvas[k], B: B.canvas[k] });
  }
  return { found, cvs };
}

/* ============ 乱数と時刻を固定する（第1章セッションの指摘 8/8）============
   空振りを2回3回に増やすのは筋が悪い。**サンプルを増やしているだけで、原理が変わらない。**
   ①②③をすべて**同じ引き**にすれば、`bizLog` も応募者も天気も**そもそも差分に出ない**＝
   「不安定」という分類自体が要らなくなり、**揺れに埋もれて見落とす**こともなくなる。

   ⚠ 戻し忘れると本編の乱数が死ぬので、必ず `try / finally` で戻す。         */
function diffSeeded(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const DIFF_SEED = 20260808;
const DIFF_NOW  = 1767225600000;   // 固定の時刻（案内図の空の色が実時間で変わるため）

/* ============ 本体 ============ */
async function chapDiff(opts) {
  const o = opts || {};
  const base = o.base || 1;                 // 正とする章
  const via = o.dry ? null : (o.via || (base === 1 ? 2 : 1));   // 経由する章（空振りなら無し）
  if (typeof guardBoot !== 'function') return '⚠ chapterGuard.js が読み込まれていない';
  const origRandom = Math.random, origNow = Date.now;
  try {
  Date.now = () => DIFF_NOW;

  /* 1つの手順を走らせるたびに、**乱数を同じ種から引き直す。**
     こうすると①②③が同じ引きになり、差分＝本物になる */
  const run = (n) => { Math.random = diffSeeded(DIFF_SEED); guardBoot(n); return diffOpenAll(); };

  /* ⓪ **ならし運転**（結果は捨てる）。
     初回の描画だけ違うものがある（🔴新着マークは一度描くと既読になる、など）。
     ならさずに①を正にすると、**道具そのものが9文字の差を作る**（実測 8/8）。
     ここを入れる前は `shopPanel` が 18290字 → 18299字 で本物のように見えていた */
  run(base);

  // ① 正
  const s1 = run(base);
  const A = diffSnap();
  // ② 経由
  let s2 = null;
  if (via != null) s2 = run(via);
  // ③ 戻す（①とまったく同じ手順）
  const s3 = run(base);
  const B = diffSnap();

  const { found, cvs } = diffCompare(A, B);

  const res = {
    向き: via == null ? '空振り（' + base + '章 → ' + base + '章）' : base + '章 → ' + via + '章 → ' + base + '章',
    差分の件数: found.length,
    差分: found,
    canvasの差: cvs,
    canvasについて: 'toDataURL のハッシュ1個しか見ていない。中身のどこが違うかは見ていない',
    開けなかった画面: { 正: s1.失敗 || s1.failed, 経由: s2 ? (s2.failed) : '—', 戻り: s3.failed },
    表に無い画面: { 正: s1.開けなかった画面, 経由: s2 ? s2.開けなかった画面 : '—' },
    開いた画面の数: { 正: s1.opened.length, 経由: s2 ? s2.opened.length : 0, 戻り: s3.opened.length },
  };

  /* 空振りでないときは、続けて空振りも走らせて**揺れの下限**を出し、
     そこに出た id には自動で「不安定」の印を付ける（第1章セッションの指摘） */
  if (via != null && !o.noDry) {
    const dry = await chapDiff({ base, dry: true, noDry: true });
    const noise = new Set(dry.差分.map(d => d.id + '/' + d.欄));
    res.空振りで出た件数 = dry.差分.length;
    res.空振りで出たもの = dry.差分;
    res.canvasは不安定か = dry.canvasの差.length > 0;
    for (const d of res.差分) if (noise.has(d.id + '/' + d.欄)) d.印 = '不安定（空振りでも出る）';
    res.本物らしい件数 = res.差分.filter(d => !d.印).length;
  }

  /* 読みやすい形でも出す（コンソールで眺める用） */
  if (typeof console !== 'undefined' && console.table && res.差分.length) {
    console.log('=== ' + res.向き + ' ===');
    console.table(res.差分);
  }
  return res;
  } finally {
    // **必ず戻す。**ここを落とすと、本編の乱数と時刻が固定されたままになる
    Math.random = origRandom; Date.now = origNow;
  }
}
