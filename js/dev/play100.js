/* ============================================================
   通し試遊（第2章「ととのい市編」）
   ------------------------------------------------------------
   **開業初日から、金も設備も自分で判断しながら100日ぶん回す。**
   これまでの検証は「7階を一度に生やして、評判100を書き込んで、1日だけ測る」
   だった＝**育っていく途中でしか起きない事故**が、まるごと落ちていた。

   ここは本物の操作と同じ道を通る。
     ・設備は startPlacing → #btnPlaceOk（＝placeCheck も妻の関門も通る）
     ・増築は yOrderZou()、融資は applyKouko()、採用は面接の【採用】ボタン
     ・一日は frame() を手回しして進める（updateNpcs は実時間で動くので stepBiz では足りない）

   使い方（コンソール）:
     await Play.run(100)        … 100日回す
     Play.days                  … 1日1行の記録
     Play.bugs                  … 途中で拾った異常

   ⚠ このファイルは検証専用。製品の動きには一切かかわらない
     （index.html からは localhost のときだけ読まれる）
   ============================================================ */
const Play = {
  days: [], bugs: [], ts: 0, halted: false, _raf: null, _render: null,
};

/* ── 時計を手で回す ───────────────────────────────────────
   本物の requestAnimationFrame が裏で回り続けていると lastTs が勝手に進み、
   こちらの ts を追い越して rDt が負になる（＝G.minutes がマイナスへ落ちる）。
   ループごと止めて、そのあとは必ず lastTs より先の ts を渡す        */
Play.halt = function () {
  if (Play.halted) return;
  Play._raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = () => 0;
  Play._render = render;
  Play.halted = true;
  Play.ts = (typeof lastTs === 'number' ? lastTs : 0) + 1000;
};
Play.resume = function () {
  if (!Play.halted) return;
  window.requestAnimationFrame = Play._raf;
  render = Play._render;
  Play.halted = false;
  Play._raf(ts => { lastTs = ts; Play._raf(frame); });
};
/* 描画を止める（100日ぶんの絵を描くと数分かかる。数字だけ要る） */
Play.blind = function (on) { render = on ? (() => {}) : Play._render; };
/* n フレーム（1フレーム＝実時間0.1秒）進める */
Play.fr = function (n) {
  for (let i = 0; i < n; i++) {
    Play.ts = Math.max(Play.ts, lastTs) + 100;
    frame(Play.ts);
  }
};

/* ── 記録 ───────────────────────────────────────────── */
Play.bug = function (day, what, detail) {
  Play.bugs.push({ day, what, detail });
  console.warn(`🐞 ${day}日目: ${what}`, detail || '');
};

/* ── 置ける場所を探す（本物の placeCheck だけを信じる）── */
Play.spot = function (id, f) {
  const back = G.actF;
  applyArea(f, true);
  let hit = null;
  for (let y = 1; y < CONF.H && !hit; y++)
    for (let x = 1; x < CONF.W && !hit; x++)
      for (const rot of [0, 1]) {
        const c = placeCheck(id, x, y, null, rot);
        if (c && c.ok) { hit = { x, y, rot }; break; }
      }
  applyArea(back, true);
  return hit;
};

/* ── 買って置く（プレイヤーの操作そのまま）──
   妻が止めたら「それでも、やる」を押す＝押し切った回数も機嫌もちゃんと動く */
Play.buy = function (id, f, n = 1) {
  const d = EQ[id];
  if (!d) { Play.bug(G.day, 'カタログに無い設備を買おうとした', id); return 0; }
  if ((d.rep || 0) > G.rep) return 0;
  let got = 0;
  applyArea(f, true);
  for (let i = 0; i < n; i++) {
    if (G.cash < eqPrice(id)) break;
    const s = Play.spot(id, f);
    if (!s) break;                                   // もう置く場所がない
    startPlacing(id);
    G.placing.gx = s.x; G.placing.gy = s.y; G.placing.rot = s.rot;
    const before = G.equip.length;
    document.getElementById('btnPlaceOk').click();
    if (!document.getElementById('wifeModal').classList.contains('hidden')) {
      yWifeAnswer(true);                             // 押し切る
    }
    if (G.equip.length > before) got++; else break;
    endPlacing();
  }
  endPlacing();
  return got;
};
Play.count = function (id, f) {
  return G.equip.filter(e => e.id === id && (f == null || (e.f | 0) === f)).length;
};

/* ============================================================
   プレイヤーの方針
   ------------------------------------------------------------
   ①店の形を作る → ②詰まったところを足す → ③金が貯まったら上に積む
   ============================================================ */
const AY_ = { FRONT: 0, OTOKO: 1, ONNA: 2, LOUNGE: 3, SHOKUDO: 4, CAPSULE: 5, ROOF: 6 };

/* 手元にこれだけは残す（30日ごとの支払いを落とすと信金の門が閉じる） */
Play.reserve = function () {
  const b = (typeof yBillLines === 'function') ? yBillLines().total : 550000;
  return b + 300000;
};

/* 欲しいものの一覧。上から順に、金が続くかぎり買う。
   （評判で解放されるものは、解放された日に自然と順番が回ってくる）*/
Play.wish = function () {
  const w = [];
  const add = (f, id, want) => w.push({ f, id, want });

  // ── 2F男湯：店の形 ──
  add(AY_.OTOKO, 'y_locker', 2);
  add(AY_.OTOKO, 'y_wash3', 1);
  add(AY_.OTOKO, 'y_sauna1', 1);
  add(AY_.OTOKO, 'y_mizu1', 1);
  add(AY_.OTOKO, 'y_furo_atsu', 1);
  add(AY_.OTOKO, 'matrack', 1);
  add(AY_.OTOKO, 'akarack', 1);
  add(AY_.OTOKO, 'y_chair', 3);
  add(AY_.OTOKO, 'y_kakeyu', 1);
  add(AY_.OTOKO, 'y_sink', 1);
  add(AY_.OTOKO, 'y_toilet', 1);
  add(AY_.FRONT, 'y_vend', 1);
  add(AY_.FRONT, 'y_goods', 1);
  // ── 育ってから ──
  add(AY_.OTOKO, 'y_wash5', 1);
  add(AY_.OTOKO, 'y_locker12', 2);
  add(AY_.FRONT, 'y_shoe40', 1);
  add(AY_.OTOKO, 'y_furo_nuru', 1);
  add(AY_.OTOKO, 'y_sauna_auto', 1);
  add(AY_.OTOKO, 'y_mizu_chiller', 1);
  add(AY_.FRONT, 'y_ice', 1);
  add(AY_.FRONT, 'y_massage', 1);
  add(AY_.OTOKO, 'y_chair', 6);
  add(AY_.FRONT, 'y_coin', 1);

  // ── 3F女湯（建ったら、同じ形をもう一度）──
  if (yFloorCount() > AY_.ONNA) {
    add(AY_.ONNA, 'y_locker12', 2);
    add(AY_.ONNA, 'y_wash5', 1);
    add(AY_.ONNA, 'y_sauna1', 1);
    add(AY_.ONNA, 'y_mizu1', 1);
    add(AY_.ONNA, 'y_furo_nuru', 1);
    add(AY_.ONNA, 'matrack', 1);
    add(AY_.ONNA, 'akarack', 1);
    add(AY_.ONNA, 'y_chair', 3);
    add(AY_.ONNA, 'y_sink', 1);
    add(AY_.ONNA, 'y_toilet', 1);
    add(AY_.ONNA, 'y_powder', 1);
    add(AY_.ONNA, 'y_sauna_auto', 1);
    add(AY_.ONNA, 'y_mizu_chiller', 1);
    add(AY_.ONNA, 'y_chair', 6);
  }
  // ── 4Fラウンジ ──
  if (yFloorCount() > AY_.LOUNGE) {
    add(AY_.LOUNGE, 'y_x_bench', 2);
    add(AY_.LOUNGE, 'y_x_sofa', 2);
    add(AY_.LOUNGE, 'y_x_tatami', 1);
    add(AY_.LOUNGE, 'y_x_manga', 1);
    add(AY_.LOUNGE, 'y_x_charge', 2);
    add(AY_.LOUNGE, 'y_x_nap', 2);
    add(AY_.LOUNGE, 'y_x_plant', 2);
  }
  // ── 5F食堂 ──
  if (yFloorCount() > AY_.SHOKUDO) {
    add(AY_.SHOKUDO, 'y_k_kitchen', 1);
    add(AY_.SHOKUDO, 'y_k_counter', 3);
    add(AY_.SHOKUDO, 'y_k_table', 3);
    add(AY_.SHOKUDO, 'y_k_sara', 1);
    add(AY_.SHOKUDO, 'y_k_coffee', 1);
    add(AY_.SHOKUDO, 'y_k_beer', 1);
    add(AY_.SHOKUDO, 'y_k_zaseki', 2);
  }
  // ── 6Fカプセル ──
  if (yFloorCount() > AY_.CAPSULE) {
    add(AY_.CAPSULE, 'y_cap_locker', 1);
    add(AY_.CAPSULE, 'y_cap', 6);
    add(AY_.CAPSULE, 'y_cap_style', 4);
  }
  // ── 詰まっているところを足す（前日の日報から）──
  const tw = (G.ch2 && G.ch2.turnWhy) || {};
  if ((tw.shoe | 0) > 0) { add(AY_.FRONT, 'y_shoe80', 1); add(AY_.FRONT, 'y_shoe40', 2); add(AY_.FRONT, 'y_shoe', 2); }
  for (const f of [AY_.OTOKO, AY_.ONNA]) {
    if (((tw.locker || {})[f] | 0) > 0) {
      add(f, 'y_locker24', 1); add(f, 'y_locker12', 1); add(f, 'y_locker', 2);
    }
  }
  return w;
};

/* 朝の買い物 */
Play.shop = function () {
  const res = Play.reserve();
  for (const it of Play.wish()) {
    if (it.f >= yFloorCount()) continue;                 // まだ建っていない階
    const have = Play.count(it.id, it.f);
    if (have >= it.want) continue;
    const d = EQ[it.id];
    if (!d || (d.rep || 0) > G.rep) continue;
    const n = it.want - have;
    for (let i = 0; i < n; i++) {
      if (G.cash - eqPrice(it.id) < res) return;         // 支払いに手をつけない
      if (!Play.buy(it.id, it.f, 1)) break;
    }
  }
};

/* 人を雇う（面接の【採用】を押す）。客数に見合う人数まで */
Play.staffWant = function () {
  /* 昨日の客数。G.ch2.lastPaid は朝の一巡り（yMorning）が累計へ足して 0 に戻すので、
     こちらの記録から読む */
  const last = Play.days[Play.days.length - 1];
  const paid = last ? last.paid : 0;
  const floors = Math.max(1, yFloorCount() - 1);         // 1Fは主人公と妻がいる
  // 立てる枠の総数（部屋ごとの定員の合計）を超えて雇っても、給料が捨てるだけ
  let slots = 0;
  (CONF.areas || []).forEach(a => { if (a && !a.home) slots += (a.staffMax || 1); });
  return Math.min(CONF.maxStaff, slots, Math.max(floors, Math.ceil(paid / 40)));
};
/* どの階に立たせるか。**採用の既定は全員1F**なので、放っておくと
   浴室の汚れを誰も拭かない（＝清潔度が0点のまま戻らない）。
   建っている階へ1人ずつ配って、余りを1Fに残す */
Play.post = function () {
  const areas = (CONF.areas || []);
  /* **部屋ごとの定員（a.staffMax）を守る。** ここを無視して直に e.f を書くと、
     プレイヤーには絶対にできない配り方（男湯に7人）で測ってしまう */
  const cap = {};
  areas.forEach((a, f) => { if (a && !a.home) cap[f] = (a.staffMax || 1); });
  const put = (e, f) => { cap[f]--; if ((e.f | 0) !== f) { e.f = f; chHook('onStaffPost', e, f); } };
  // 女湯に立てるのは女性だけ＝プレイヤーにできない配り方で測らない
  const take = (e, f) => (cap[f] > 0 && chHook('canStaffArea', e, f) !== false) ? (put(e, f), true) : false;

  const night = G.roster.filter(e => e.night);
  const rest = G.roster.filter(e => !e.night);
  const queue = [];
  /* **深夜に立てる人は1人だけ1階に置く**（会計する人がいない夜は開けられない）。
     ここを配り忘れると、深夜営業の項目に一生鍵がかかったままになる */
  if (night.length && take(night[0], AY_.FRONT)) queue.push(...rest, ...night.slice(1));
  else queue.push(...rest, ...night);

  /* ①まず全部の階に1人ずつ。**立てる人が少ない階から先に埋める**＝
     女湯（女性しか立てない）を、男で埋まった後回しにしない
     ②余ったら、**汚れの出る浴室から**埋める（他の階はほとんど汚れない・実測） */
  const left = queue.filter(e => { if (e.f != null && cap[e.f | 0] === undefined) e.f = null; return true; });
  const elig = f => left.filter(e => chHook('canStaffArea', e, f) !== false);
  const once = Object.keys(cap).map(Number).sort((a, b) => a - b);
  const scarce = once.slice().sort((a, b) => elig(a).length - elig(b).length);
  const pick1 = f => {
    const c = elig(f)[0];
    if (c && take(c, f)) { left.splice(left.indexOf(c), 1); return true; }
    return false;
  };
  for (const f of scarce) if (cap[f] === (areas[f].staffMax || 1)) pick1(f);
  for (const f of [AY_.OTOKO, AY_.ONNA, ...once]) while (cap[f] > 0 && elig(f).length && pick1(f));
  for (const e of left) e.f = null;                               // 立つ場所が無い＝持ち場なし
};
Play.hire = function () {
  // 面接が来ている朝（enterPrep が開く）
  const m = document.getElementById('jobModal');
  if (m && !m.classList.contains('hidden')) {
    const want = Play.staffWant();
    const btns = [...m.querySelectorAll('.job-hire')];
    for (const b of btns) {
      if (G.roster.length >= want) break;
      b.click();
    }
    const close = document.getElementById('btnJobClose');
    if (close) close.click();
    m.classList.add('hidden');
    G.paused = false;
  }
  Play.post();
  // 足りなければ求人を出す（2日後に面接）
  if (!G.jobAdDay && G.roster.length < Play.staffWant()
      && G.cash - 50000 > Play.reserve()) {
    G.cash -= 50000; G.jobAdDay = G.day + 2;
  }
};

/* 上に積む／借りる */
Play.build = function () {
  if (yKouji()) return;
  const z = yNextZou();
  if (!z) return;
  const why = yZouWhy(z);
  if (!why) {
    if (G.cash - z.price < Play.reserve()) return;
    yOrderZou();
    if (!document.getElementById('wifeModal').classList.contains('hidden')) yWifeAnswer(true);
    return;
  }
  // 金が足りないだけなら、信金に頼む
  if (why === 'お金が足りない' && !(G.ch2 && G.ch2.koukoAt) && koukoOK()) {
    const k = CONF.kouko;
    const room = Math.floor(koukoRoom() / k.unit) * k.unit;
    if (room <= 0) return;
    const need = Math.ceil((z.price + Play.reserve() - G.cash) / k.unit) * k.unit;
    const amt = Math.min(room, Math.max(k.unit, need));
    if (chHook('askWife', 'kouko', amt)) { yWifeAnswer(true); return; }
    applyKouko(amt);
  }
};

/* 運営の設定（値段・営業時間・深夜・食堂） */
Play.tune = function () {
  // 入館料は「納得される額」に合わせる（worthFee が目安を返す）
  if (typeof worthFee === 'function') {
    const w = worthFee();
    if (w && Math.abs(w - G.opts.fee) >= 100) G.opts.fee = Math.round(w / 50) * 50;
  }
  G.opts.soapMode = 'free';
  // 営業時間。体力と釣り合うのは12時間まで
  if (typeof ySetHours === 'function') {
    if (G.roster.length >= 2) ySetHours(13, 23); else ySetHours(15, 22);
  }
  // 深夜営業は、開けられるようになったら開ける
  if (typeof canNightOpen === 'function' && canNightOpen()) G.opts.nightOpen = true;
  // 食堂：厨房が建った日から、安いものから順に開発する
  if (typeof yMenuAll === 'function' && typeof yDevelopMenu === 'function'
      && G.equip.some(e => e.id === 'y_k_kitchen')) {
    const rest = yMenuAll().filter(m => !yMenuDone(m.id)).sort((a, b) => a.dev - b.dev);
    for (const m of rest) {
      if (G.cash - m.dev < Play.reserve()) break;
      yDevelopMenu(m.id);
    }
  }
};

/* 壊れたものを直す（放置は評判−10）。
   **業者は実時間で歩いてくる**ので、準備中もフレームを回して直し終わるまで待つ
   （ここを回さないと、直したつもりの設備が永久に壊れたままになる） */
Play.fix = function () {
  let asked = 0;
  // 壊れてしまったものが先。**壊れた台は支払いを削ってでも直す**（開店できなくなる）
  const list = [...G.equip].sort((a, b) => a.cond - b.cond);
  for (const e of list) {
    if (!fixable(e) || e.cond > 55) continue;
    const fee = fixFee(e);
    const room = e.cond <= 0 ? G.cash : G.cash - Play.reserve();
    if (room < fee) continue;
    callRepairman(e, true);
    asked++;
  }
  if (!asked) return;
  for (let i = 0; i < 4000 && G.npcs.some(n => n.role === 'fixer'); i++) Play.fr(1);
  const left = G.equip.filter(e => fixable(e) && e.cond <= 0);
  if (left.length) Play.bug(G.day, '修理を頼んだのに直らなかった', left.map(e => e.id + '@' + e.f));
};

/* 朝の一枚（今日をどう使うか） */
Play.morning = function () {
  if (typeof yPlan !== 'function') return;
  const p = yPlan();
  if (p.done) return;
  const stam = G.stam ?? 100, stress = (G.ch2 && G.ch2.stress) | 0;
  let pick = null;
  if (yClosedToday()) { G.stam = yStamMax(); p.act = 'nero'; p.go = false; p.done = true; return; }
  if (stam < 35) pick = 'nero';
  else if (stress > 70) pick = G.cash > 200000 ? 'nomi' : 'uchi';
  else if (typeof yMoodPct === 'function' && yMoodPct() < 35 && G.cash > 200000) pick = 'wife';
  if (pick) {
    const a = OFFDAY_Y.find(x => x.id === pick);
    if (a && !(a.need === 'hasSauna' && !yHasSaunaOfMine()) && G.cash >= (a.cost || 0)) {
      p.act = a.id;
      yOffdayDo(a);
    }
  }
  /* 寄り道は一枚絵を流す（第2章）。手回しなので、最後まで送って閉じる。
     選択が出た日は、いちばん上（＝やる側）を押す */
  for (let i = 0; i < 60; i++) {
    const st = document.getElementById('story');
    if (!st || st.classList.contains('hidden')) break;
    Story.advance();
  }
  const choice = document.querySelector('#offdayBody .y-cmd:not([disabled])');
  const om = document.getElementById('offdayModal');
  if (choice && om && !om.classList.contains('hidden')) choice.click();
  yCloseDayScreen();
  if (typeof Y_OFFDAY_OPEN !== 'undefined') Y_OFFDAY_OPEN = false;
  p.go = true; p.done = true;
};

/* ── 1日 ─────────────────────────────────────────────── */
Play.day = function () {
  const d0 = G.day;
  Play.morning();
  Play.hire();
  Play.fix();
  Play.tune();
  Play.shop();
  Play.build();

  /* **準備中も時間を回す。** 主人公はここで館内を歩いて汚れを拭く（prepCleanMax まで）。
     ここを飛ばしていたので「深夜に溜まった汚れが朝そのまま残る」ように見えていた
     ＝道具側の穴。拭ける数を使い切るか、汚れが無くなるまで回す */
  for (let i = 0; i < 3000 && G.phase === 'prep'; i++) {
    if (!G.dirts.length || playerTired(G.player)) break;
    Play.fr(1);
  }

  // 開店できるか（本物のボタンと同じ条件）
  const okLocker = G.equip.some(e => EQ[e.id].cat === 'locker' && e.cond > 0);
  const okBath = hasCat('furo') || hasCat('sauna');
  if (!okLocker || !okBath) {
    Play.bug(d0, '開店できない', { okLocker, okBath, cash: G.cash });
    // 何もできないまま日付だけ進める
    yEndOffDay();
    return { day: d0, skipped: true };
  }
  document.getElementById('btnOpen').click();
  if (G.phase !== 'biz') {                                // 朝の画面が割り込んだ
    const p = yPlan(); p.go = true; p.done = true;
    yCloseDayScreen();
    document.getElementById('btnOpen').click();
  }
  if (G.phase !== 'biz') { Play.bug(d0, '営業が始まらなかった', { phase: G.phase }); return { day: d0, skipped: true }; }

  // 営業を回す
  let guard = 0;
  const cap = 30000;
  while (G.phase === 'biz' && guard < cap) { Play.fr(20); guard += 20; }
  if (guard >= cap) Play.bug(d0, '閉店しないまま打ち切った', { minutes: G.minutes, phase: G.phase });

  const t = { ...G.today };
  const rec = {
    day: d0, paid: t.paid | 0, rev: t.revenue | 0, profit: t.profit | 0,
    cash: 0, rep: G.rep, reg: G.regulars | 0, floors: yFloorCount(),
    staff: G.roster.length, away: t.turnedAway | 0, gave: t.gaveUp | 0,
    over: (G.ch2 && G.ch2.lastOver) | 0, debt: (G.debt | 0) + ((G.yami && G.yami.debt) | 0),
    stam: Math.round(G.stam ?? 0), stress: (G.ch2 && G.ch2.stress) | 0,
    menuN: t.menuN | 0, stay: t.stayN | 0, night: t.nightRev | 0,
    dirt: t.dirtN ? Math.round(t.dirtSum / t.dirtN * 100) / 100 : 0,
  };
  // 評判の10項目（どこが伸びていないのかを、日ごとに残す）
  const rp = repScoreParts();
  rp.items.forEach(i => { rec['r_' + i.key] = i.v; });
  rec.pens = rp.pens.map(p => p.k).join(',');

  // 日報を閉じて翌朝へ
  if (G.phase === 'report') afterReport();
  // 物語の一枚が出ていたら送る（第2章は台本未接続だが、保険）
  for (let i = 0; i < 40 && G.phase !== 'prep'; i++) {
    const st = document.getElementById('storyModal');
    if (st && !st.classList.contains('hidden')) { st.click(); continue; }
    break;
  }
  rec.cash = G.cash;
  if (G.day === d0) Play.bug(d0, '日付が進まなかった', { phase: G.phase });
  Play.days.push(rec);
  return rec;
};

/* ── 通し ───────────────────────────────────────────── */
Play.run = async function (n = 100, opts = {}) {
  Play.halt();
  Play.blind(!opts.draw);
  Play.days = []; Play.bugs = [];
  guardBoot(2);
  G.name = 'ととのいサウナ';
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    const before = { cash: G.cash, rep: G.rep, day: G.day };
    try { Play.day(); }
    catch (e) { Play.bug(G.day, '例外で止まった: ' + e.message, e.stack); break; }
    // 破綻の見張り
    if (G.cash < -1000000) Play.bug(G.day, '資金がマイナス百万を割った', { cash: G.cash });
    if (G.rep < 0 || G.rep > 100) Play.bug(G.day, '評判が範囲外', { rep: G.rep });
    if (G.day === before.day) break;
    if (i % 10 === 9) await new Promise(r => setTimeout(r, 0));   // 画面を殺さない
  }
  Play.blind(false);
  const sec = ((performance.now() - t0) / 1000).toFixed(1);
  console.log(`▶ ${Play.days.length}日ぶん回した（${sec}秒）／異常 ${Play.bugs.length}件`);
  return Play.summary();
};

Play.summary = function () {
  const d = Play.days;
  if (!d.length) return null;
  const at = k => { const r = d.find(x => x.day === k) || d[d.length - 1]; return r; };
  return {
    days: d.length,
    last: d[d.length - 1],
    milestones: [1, 10, 20, 30, 45, 60, 75, 90, 100].filter(k => k <= d.length).map(at),
    bugs: Play.bugs,
  };
};
Play.table = function () {
  console.table(Play.days.map(r => ({
    日: r.day, 階: r.floors, 客: r.paid, 売上: r.rev, 損益: r.profit,
    所持金: r.cash, 借入: r.debt, 評判: r.rep, 常連: r.reg, バイト: r.staff,
    帰した: r.away, 来られず: r.over, 体力: r.stam, ストレス: r.stress,
  })));
};
window.Play = Play;
