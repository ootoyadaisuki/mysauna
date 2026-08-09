'use strict';

/* ============================================================
   食堂：注文 → 厨房 → カウンター → 配膳 → 食事（作者指定・作り直し）
   ------------------------------------------------------------
   ── 前の作りと、何を変えたか ─────────────────────────
   前は「厨房の床を1マスずつ工事し、器具を1つずつ買い、器具の組み合わせで
   作れる品が決まる」だった。手間のわりに画面には何も出ず、
   担当は1人が鍋の前に立って動かないだけだった。

   いまは：
     ・**厨房は一個の物**（k2_kitchen）。何が作れるかは【メニュー開発】で決まる
     ・**調理スタッフは求人で雇う。** 料理★が、出す速さと皿の出来に直に効く
     ・調理は「鍋の前で止まる」のをやめて、**厨房の中をわちゃわちゃ動く**
     ・出来上がった皿は**カウンターに並ぶ**（誰も運ばなくても、そこに在る）
     ・**ホールがカウンターから取って席へ運ぶ。** 空いていなければ調理が自分で運ぶ

   ── 人数（作者指定）──────────────────────────────
     調理 最大2人 ／ ホール 最大2人（食堂は計4人まで）
     ・**1人でも営業できる。** その1人が、作って、運んで、掃除まで全部やる
     ・調理が2人＝2皿を同時に火にかけられる
     ・ホールは配膳と掃除（手が空けば、いつもどおり床を拭く）
   ============================================================ */

/* 標準の調理時間（★3のときの1皿）。★1は3倍、★5は6割 */
const COOK_BASE2 = 22;
/* 皿が届いてから食べ終わるまで */
const EAT_TIME2 = 16;
/* この分数を超えて待たされると、待った時間に応じて満足度が削れていく */
const WAIT_OK2 = 40;

/* ---- 厨房 ---- */
function kitchenEq() {
  return G.equip.find(e => e.id === 'k2_kitchen' && (e.f | 0) === AR.SHOKUDO && e.cond > 0) || null;
}
/* 厨房の中で立てるところ（＝厨房に寄れるマス）。ここをうろうろする */
function kitchenSpots() {
  const k = kitchenEq(); if (!k) return [];
  return approachTiles(k);
}
/* カウンターの上（皿が並ぶマス）＝厨房のいちばん手前の列 */
function counterTiles() {
  const k = kitchenEq(); if (!k) return [];
  const y = k.y + eh(k) - 1, out = [];
  for (let x = k.x; x < k.x + ew(k); x++) out.push({ x, y });
  return out;
}

/* ---- 食堂に立っている人 ---- */
function shokudoCrew() {
  return G.staff.filter(s => (s.f | 0) === AR.SHOKUDO && !(s.lateT > 0));
}
function jobOf(s) { return (s.emp && s.emp.job) || 'cook'; }
function ryoriOf(s) { return (s.emp && s.emp.ryori) || 1; }
/* 厨房に入る人。**役割で決める**（求人で雇った調理スタッフ）。
   ただし調理が1人もいない日は、居る人が作る＝**1人でも店は開く** */
function cooks2() {
  const crew = shokudoCrew();
  const c = crew.filter(s => jobOf(s) === 'cook');
  return c.length ? c : crew;
}
/* 運ぶ人。ホールが居なければ、作った人が自分で運ぶ（cookStep2 で拾う） */
function halls2() {
  const crew = shokudoCrew();
  const cookSet = new Set(cooks2());
  return crew.filter(s => jobOf(s) === 'hall' || !cookSet.has(s));
}
/* 食堂ぜんぶを合わせた腕（皿の出来に効く）＝調理に入る人のいちばん上 */
function cookSkill2() {
  const c = cooks2();
  return c.length ? c.reduce((m, s) => Math.max(m, ryoriOf(s)), 0) : 0;
}

/* ---- ① 注文 ---- */
function orderQ2() {
  /* 帰った客・もう届いた客を落としてから返す。
     ここを毎回洗い直しておかないと、いなくなった客の皿を延々と作り続ける */
  G.kitchenQ = (G.kitchenQ || []).filter(c =>
    c && c.order && !c.food && c.state === 'using' && G.customers.includes(c));
  return G.kitchenQ;
}
function useStart(c, item, cat) {
  if (cat !== 'shoku' || !EQ[item.id].cap) return;
  c.order = null; c.food = false; c.orderAt = null;
  const out = menuOut();
  if (!out.length) return;                                 // 出せる品が無い＝useDone で不満になる
  const want = out.filter(m => (m.likes || []).includes(c.typeKey));
  if (!want.length) {                                      // 好みのものが載っていない
    c.sat -= 5;
    if (Math.random() < .5) bubble(c, pick(['食いたいものが無いな…', 'これしかないのか', '……まあ、いいか']), 3.2);
    logGripe(c.type.name, '食べたいメニューが無い', 'menuWant');
  }
  if (out.length < 3) c.sat -= 3;                          // 品数が少なすぎる
  c.order = pick(want.length ? want : out);
  c.orderLiked = !!want.length;
  c.orderAt = G.minutes;
  orderQ2().push(c);
  if (!c.bub && Math.random() < .55) bubble(c, `${c.order.name}を…`, 2.8);
}

/* ---- カウンターに並んだ皿 ---- */
function passQ() {
  /* 席を立たれた皿は下げる（＝作った手間と原価は返ってこない） */
  G.pass = (G.pass || []).filter(p =>
    p.c && p.c.state === 'using' && !p.c.food && G.customers.includes(p.c));
  return G.pass;
}

/* ---- ②③ 厨房とホールの仕事（game.js の updateStaff から）---- */
function staffJob(s, dt) {
  if (!CONF.staffRooms || G.phase !== 'biz') return false;
  if ((s.f | 0) !== AR.SHOKUDO) return false;
  if (s.tray) return serveStep2(s, dt);                    // 盆を持っている＝運ぶのが最優先
  if (s.task === 'cook' || s.cookFor) return cookStep2(s, dt);
  /* カウンターに皿が出ていたら運ぶ。ホールが優先だが、
     ホールが居ない（＝1人で回している）日は、調理も取りに来る */
  if (s.task === 'topass' || (passQ().length && (halls2().includes(s) || !halls2().length)))
    return takeFromPass(s, dt);
  // 手が空いている調理が、列の先頭を火にかける
  if (cooks2().includes(s) && !cooking(s) && orderQ2().length) return startCook2(s);
  return false;                                            // 何も無い＝いつもどおり掃除へ
}
function cooking(s) { return s.task === 'cook' || !!s.cookFor; }

/* 腕による調理時間の倍率。★1は★5の3倍かかる＝客が待ちきれずに席を立つ */
function cookMul2() {
  const r = cookSkill2();
  return r >= 5 ? 0.60 : r === 4 ? 0.78 : r === 3 ? 1 : r === 2 ? 1.35 : 1.85;
}

/* 鍋に火を入れる時点で、**誰の一皿かを決める**（cookFor）。列から抜くので取り違えない。
   ここを「作り終えてから列の先頭に渡す」形にしていたときは、列がいっとき空になるだけで
   task が外れ、**火に掛けた鍋がまるごと捨てられていた** */
function startCook2(s) {
  const spots = kitchenSpots();
  if (!spots.length) return false;                         // 厨房が無い／道が通っていない
  const q = orderQ2();
  if (!q.length) return false;
  const t = tileOf(s);
  const spot = nearestSpot(spots, t);
  const p = findPath(t.x, t.y, spot.x, spot.y);
  if (!p) return false;
  s.task = 'cook'; s.target = null; s.path = p;
  s.cookFor = q.shift();
  s.cookT = COOK_BASE2 * cookMul2();
  s.wachaT = 0; s.atKitchen = false;
  return true;
}
function nearestSpot(spots, t) {
  let best = spots[0], bd = Infinity;
  for (const sp of spots) {
    const d = Math.abs(sp.x - t.x) + Math.abs(sp.y - t.y);
    if (d < bd) { bd = d; best = sp; }
  }
  return best;
}
function cookStep2(s, dt) {
  const c = s.cookFor;
  /* 待ちきれずに席を立たれた＝作りかけは捨てるしかない（ここだけが本当の無駄） */
  if (!c || !G.customers.includes(c) || c.state !== 'using' || c.food) {
    s.task = null; s.path = null; s.cookT = 0; s.cookFor = null; s.atKitchen = false; return false;
  }
  /* 厨房に着くまでは、まだ火にかけていない */
  const arrived = stepMove(s, dt);
  if (!s.atKitchen) { if (!arrived) return true; s.atKitchen = true; }
  /* ⚠ **着いたあとは、歩いていても調理時間を進める。**
     ここを `if (!stepMove()) return;` のままにすると、下の「わちゃわちゃ」が
     毎回あたらしい道順を入れるせいで stepMove がほぼ never 完了になり、
     **鍋にはいつまでも火が通らない**（実測：この1行で皿が8→0になった） */
  s.cookT -= dt;
  /* **わちゃわちゃ**（作者指定）。鍋の前で固まらせず、厨房のマスを渡り歩かせる。
     火にかけて、寸胴をのぞいて、冷蔵庫を開けて、また戻る。中身は変わらない演出 */
  s.wachaT = (s.wachaT || 0) - dt;
  if (s.wachaT <= 0) {
    s.wachaT = rand(3, 7);
    const spots = kitchenSpots();
    if (spots.length > 1) {
      const t = tileOf(s);
      const to = pick(spots.filter(p => p.x !== t.x || p.y !== t.y));
      if (to) s.path = findPath(t.x, t.y, to.x, to.y) || null;
    }
    if (!s.bub && Math.random() < .25)
      bubble(s, pick(['あいよ', 'はいはい', '……よし', '（鍋を混ぜる）']), 2.0);
  }
  if (s.cookT > 0) return true;
  /* 一皿できた。**カウンターに置く。** 誰かが取りに来るまで、そこに在る */
  passQ().push({ c, m: c.order, at: G.minutes });
  s.cookFor = null; s.task = null; s.path = null; s.cookT = 0; s.atKitchen = false;
  if (!s.bub && Math.random() < .4) bubble(s, pick(['はい、お待ち', 'あがりました', 'カウンターどうぞ']), 2.4);
  Sfx.play && Sfx.play('coin');
  return true;
}

/* ---- カウンターから盆を取る ---- */
function takeFromPass(s, dt) {
  const q = passQ();
  if (!q.length) { if (s.task === 'topass') { s.task = null; s.path = null; } return false; }
  const spots = kitchenSpots(); if (!spots.length) return false;
  /* ⚠ 道順を引くだけで **stepMove を呼び忘れると、その場に立ったまま true を返し続ける。**
     updateStaff は true を見て「この人はもう働いている」と次へ行くので、
     ホールは一歩も動かず、カウンターに皿が積み上がったまま一日が終わる（実測：
     ホールを1人足したら、皿が8→1に減った）                                     */
  if (s.task !== 'topass') {
    const t = tileOf(s), spot = nearestSpot(spots, t);
    const p = findPath(t.x, t.y, spot.x, spot.y);
    if (!p) return false;
    s.task = 'topass'; s.path = p;
  }
  if (!stepMove(s, dt)) return true;                       // カウンターへ歩いている途中
  s.tray = q.shift().c;                                    // いちばん先に出来た皿から
  s.task = null; s.path = null;
  return true;
}

function serveStep2(s, dt) {
  const c = s.tray;
  if (!c || !G.customers.includes(c) || c.state !== 'using' || c.food) {
    s.tray = null; s.task = null; s.path = null; return false;   // 席を立たれた＝皿は下げる
  }
  /* **火の通った皿は、必ず席まで届く。**
     ここを入れる前は、盆を持って部屋を横切っている数十歩のあいだに滞在時間が切れ、
     作った皿を目の前で捨てていた（実測：頼んだ8人のうち届いたのは1皿だけ）。
     待ちくたびれて帰るのは「**まだ火にも掛かっていない客**」の話に絞る       */
  c.timer = Math.max(c.timer, 6);
  if (s.task !== 'serve') {
    const t = tileOf(s), seat = c.use.approach;
    const p = findPath(t.x, t.y, seat.x, seat.y);
    if (!p) { s.tray = null; s.task = null; return false; }
    s.task = 'serve'; s.path = p;
  }
  if (!stepMove(s, dt)) return true;
  serveFood2(c);
  s.tray = null; s.task = null; s.path = null;
  return true;
}

/* ---- ④ 席に届いた ---- */
function serveFood2(c) {
  const m = c.order; if (!m) return;
  c.food = true;
  G.cash += m.price;
  G.today.revenue += m.price;
  G.today.menuRev = (G.today.menuRev || 0) + m.price;
  G.today.menuCost = (G.today.menuCost || 0) + m.cost;
  G.today.menuN = (G.today.menuN || 0) + 1;
  addFloater(c.px, c.py - 24, '+' + yen(m.price));
  c.sat += c.orderLiked ? 8 : 3;
  /* 待たされたぶんの不満。長い行列は、味の良し悪しより先に効く */
  const waited = G.minutes - (c.orderAt ?? G.minutes);
  if (waited > WAIT_OK2) {
    c.sat -= Math.min(14, Math.round((waited - WAIT_OK2) / 5));
    if (!c.bub && Math.random() < .5) bubble(c, pick(['やっと来た…', '遅い', '待ったぞ']), 3);
    logGripe(c.type.name, '料理が遅い', 'slowFood');
  }
  cookQuality(c, m);                                       // 腕による「うまい」「マズい」
  c.timer = Math.min(c.timer, EAT_TIME2);                  // 食べ終わったら席を立つ
}

/* ---- 席を立つとき（game.js の finishUse → useDone）---- */
function useDoneShoku(c, item) {
  const out = menuOut();
  if (!out.length) {                                       // お品書きが1品も無い
    c.sat -= 10;
    bubble(c, pick(['……食うものが無いのか', '席だけあっても、なあ', 'メニューは？']), 3.4);
    logGripe(c.type.name, 'メニューが無い', 'menu');
  } else if (c.order && !c.food) {
    /* 頼んだのに、出てこないまま席を立った。**売上はゼロ** */
    c.sat -= 18;
    bubble(c, pick(['……もういい', '待ちくたびれた', '頼んだやつ、まだか']), 3.4);
    logGripe(c.type.name, '料理が出てこない', 'noFood');
    const i = (G.kitchenQ || []).indexOf(c);
    if (i >= 0) G.kitchenQ.splice(i, 1);
  }
  c.order = null; c.food = false; c.orderAt = null;
}

/* 席に座っていられる時間＝**待てる限界**。
   腕による回転の速さは「早く出れば早く帰る」（serveFood2）で効かせるので、
   ここは腕で変えない＝★1の厨房では、待ちきれずに出ていく客が出る       */
function useDur(c, item, cat, dur) {
  if (cat !== 'shoku' || !EQ[item.id].cap) return dur;
  return 78;
}

/* ============ カウンターに並んだ皿を描く（game.js の描画から）============
   出来上がった皿は、運ばれるまでカウンターの上に置かれている。
   **「作った」と「届いた」のあいだが目に見える**＝ホールが足りているかが一目で分かる */
function drawPass(ctx) {
  const q = (G.pass || []);
  if (!q.length || (G.viewF | 0) !== AR.SHOKUDO) return;
  const tiles = counterTiles();
  if (!tiles.length) return;
  for (let i = 0; i < q.length && i < tiles.length; i++) {
    const t = tiles[i], x = t.x * T + T / 2, y = t.y * T + T / 2 - 4;
    ctx.fillStyle = '#f2eee6';                                     // 丼
    ctx.beginPath(); ctx.ellipse(x, y, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c9a86a';
    ctx.beginPath(); ctx.ellipse(x, y - 1, 6, 3.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(60,44,28,.35)';
    ctx.fillRect(x - 8, y + 4, 16, 2);                             // 影
    // 湯気
    const rt = (G.rt || 0) + i;
    for (let k = 0; k < 2; k++) {
      const p = ((rt * .8 + k * .5) % 1);
      ctx.fillStyle = `rgba(255,255,255,${(1 - p) * .35})`;
      ctx.beginPath();
      ctx.arc(x + Math.sin(rt * 2 + k) * 2.5, y - 6 - p * 10, 2.2 - p, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // 溜まっている数（3皿以上＝運ぶ人が足りていない）
  if (q.length > tiles.length) {
    const t = tiles[tiles.length - 1];
    ctx.fillStyle = '#ffcf7a'; ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(`＋${q.length - tiles.length}`, t.x * T + T - 6, t.y * T + T / 2);
  }
}

registerChapter2Hooks({ useStart, staffJob, useDur, drawPass });
