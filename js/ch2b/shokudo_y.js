'use strict';

/* ============================================================
   5F 食堂：板前を雇う → 注文 → 平均5分で机に並ぶ（作者指定 2026-08-06）
   ------------------------------------------------------------
   **一度、バイトに作らせて、バイトに運ばせていた。** その版はこう詰まった：
     席に着いた98人に対して、届いた皿は33枚。
     鍋は2口、運ぶ人は1人。カウンターに皿が溜まり、待ちくたびれた客が
     出来上がった皿を残して帰っていく。5階に3人張り付けても足りない。

   なので**厨房を「人を置く場所」ではなく「金を払う場所」にした。**
     ・板前を雇う（★2見習い／★3板前／★5一流）。**日給が毎日出ていく**
     ・注文は**平均5分で、客の机に直接並ぶ**。運ぶ人は要らない
     ・5階のバイトの仕事は、**床の汚れと、食べ終わった食器の片付け**だけ

   ── これで何が「決断」になったか ────────────────
     板前の日給は、客が0人の日も出ていく。
     ★5は日給¥45,000＝**1日に80皿を出して、やっと元が取れる**。
     席が少ないうちに一流を雇うと、食堂が店の足を引っ張る。
     ＝「席を並べてから、腕を上げる」という順番が、数字のほうから出てくる。

   ── ★が効くところ ──────────────────────────
     ・皿の出来（そのまま満足度。★2は −5、★5は +6）
     ・出てくる速さ（★2は7分、★3は5分、★5は3.5分）
   ============================================================ */

/* 標準の調理時間（★3のときの1皿）。作者指定＝平均5分 */
const COOK_BASE_Y = 5;
/* 皿が届いてから食べ終わるまで */
const EAT_TIME_Y = 16;
/* この分数を超えて待たされると、待った時間に応じて満足度が削れていく */
const WAIT_OK_Y = 20;

/* ============ 厨房 ============ */
function yKitchenEq() {
  return (G.equip || []).find(e => e.id === 'y_k_kitchen' && (e.f | 0) === AY.SHOKUDO && e.cond > 0) || null;
}
function yHasKitchen() { return !!yKitchenEq(); }

/* ============ 誰が鍋を持つか ============

   **① 源さんは、雇うのではなく来る**（作者指定 8/6）。求人には出てこない。
   `G.ch2.gen` が 3 になった日から厨房に立つ（→ 下の三幕）。

   **② 源さんは22時に帰る**（作者指定 8/6・二版）。61歳の男を19時間立たせない。
   店の従業員でひとりだけシフトを持っていなかったのを、バイトと同じ線に揃えた。

   **③ 源さんがいなくても、食堂は開く**（作者指定 8/6・二版）。
   5階に持ち場のあるバイトが立てば鍋は回る。ただし**腕は★2**＝
   遅い（yCookMul ×1.40）し、味も落ちる。源さんは「開けるための人質」ではなく、
   **いるとうまくなる人**になった。
   ＝深夜バイトを5階に置く理由ができ、ロウリュ街に6回行く前でも5階が金を生む。

   **厨房のマスに人を割り当てる操作は、いまも無い。**
   見ているのは「5階に、いまの時間帯に働いている人がいるか」だけ（yKitchenManned）。 */
function yItamaeTier() { return CONF.itamae || null; }
/* **源さんが自分から辞めることはない**（作者指定 8/7）。辞めるのは、こちらが言ったときだけ。
   `genQuit` が立ったら二度と来ない＝ロウリュ街の男に一度断ったら、二度は来ない */
function yGenQuit() { return !!(G.ch2 && G.ch2.genQuit); }
function yGenji() { return ((G.ch2 && G.ch2.gen) | 0) >= 3 && !yGenQuit(); }
/* 雇っているか（時刻に関係ない）。**日給はこちらで判定する**＝
   夜になった瞬間に日給が0円に化けると、日報の固定費が消えてしまう */
function yItamaeHired() { return yHasKitchen() && yGenji(); }
/* いま実際に立っているか。深夜（22時〜）は帰っている */
function yItamaeOn() {
  return yItamaeHired() && !(typeof yIsNight === 'function' && yIsNight());
}
function yItamaeR() { const t = yItamaeTier(); return yItamaeOn() && t ? (t.r | 0) : 0; }

/* 5階に、いまの時間帯に働いているバイトが居るか。
   深夜バイト以外は22時に帰るので、yWorkerOff がそのまま使える */
function yKitchenBaito() {
  return (G.staff || []).some(s => (s.f | 0) === AY.SHOKUDO
    && !(typeof yWorkerOff === 'function' && yWorkerOff(s)));
}
/* 厨房が回っているか＝厨房があって、源さんかバイトのどちらかが立っている */
function yKitchenManned() { return yHasKitchen() && (yItamaeOn() || yKitchenBaito()); }

const COOK_R_BAITO_Y = 2;      // バイトの腕。★5の源さんに対して、倍の時間がかかる
function yCookSkill() {
  if (yItamaeOn()) return yItamaeR();
  return yKitchenBaito() && yHasKitchen() ? COOK_R_BAITO_Y : 0;
}

/* ============ 章の固定費（game.js の closeDay が chHook で拾う）============
   板前の日給と、その日に出した皿の原価。**客が0人でも板前の日給は出ていく**。
   ※日報のチップは「返済・税」という第1章向けの名前のまま（closeDay の表示は
     申請待ちコードなので触っていない）。内訳は yUriageRows に自分で書いている */
function yItamaeWage() {
  const t = yItamaeTier();
  return (yItamaeHired() && t) ? (t.wage | 0) : 0;   // 日給。夜に帰っても、その日ぶんは出る
}
function yDailyExtraCost() {
  return yItamaeWage() + ((G.today && G.today.menuCost) || 0);
}

/* ============ お品書き（開発したものだけ載る）============ */
function yMenuDev() { return (G.ch2 && G.ch2.menuDev) || []; }
function yMenuDone(id) { return yMenuDev().includes(id); }
function yMenuAll() { return CONF.menu || []; }
/* 開発済みで、いま実際に出せる品＝**厨房があり、誰かが立っている**
   （源さんでもバイトでもいい。腕の差は yCookSkill が持つ） */
function yMenuReady(m) { return yMenuDone(m.id) && yKitchenManned(); }
function yMenuOut() { return yMenuAll().filter(yMenuReady); }

function yDevelopMenu(id) {
  if (!G.ch2) return;
  const m = yMenuAll().find(x => x.id === id); if (!m) return;
  if (yMenuDone(id)) return;
  if (G.cash < m.dev) { toast('開発費が足りない'); return; }
  G.cash -= m.dev;
  G.invBuy = (G.invBuy || 0) + m.dev;                  // 日報の「設備投資」に載る
  if (!G.ch2.menuDev) G.ch2.menuDev = [];
  G.ch2.menuDev.push(id);
  toast('🍜 ' + m.name + 'を開発した（' + yen(m.dev) + '）');
  log('🍜 ' + m.name + 'を開発した（開発費 ' + yen(m.dev) + '）');
  if (typeof Sfx !== 'undefined') Sfx.play('register');
  if (typeof updateTopbar === 'function') updateTopbar();
  if (typeof renderShop === 'function') renderShop();
  if (typeof saveGame === 'function') saveGame();
}

/* ============ ① 注文（席に着いた瞬間）============ */
function yShokuUseStart(c, item, cat) {
  if (cat !== 'shoku' || !EQ[item.id].cap) return;
  c.order = null; c.food = false; c.orderAt = null; c.cookT = 0;
  const out = yMenuOut();
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
  /* **火にかけた時点で、出てくる時刻が決まる。**
     途中で板前を替えることはできない（営業中は雇用画面を開けない）ので、
     ここで一度だけ倍率を掛ければいい                                        */
  c.cookT = COOK_BASE_Y * yCookMul() * rand(0.8, 1.25);
  if (!c.bub && Math.random() < .55) bubble(c, c.order.name + 'を…', 2.8);
}

/* 腕による調理時間の倍率。★2は★5の倍かかる */
function yCookMul() {
  const r = yCookSkill();
  return r >= 5 ? 0.70 : r === 4 ? 0.85 : r === 3 ? 1 : r === 2 ? 1.40 : 1.85;
}

/* ============ ② 火が通ったら、机に並ぶ（rules_y.js の yTick から毎分）============
   運ぶ人は要らない。**厨房から席までの数十歩が、そのまま消えた。**
   ここが、この階を「人を張り付ける階」から「金を払う階」に変えている一行 */
function yShokuTick(dt) {
  if (G.phase !== 'biz') return;
  for (const c of G.customers) {
    if (!c.order || c.food || c.state !== 'using') continue;
    if (!(c.cookT > 0)) continue;
    c.cookT -= dt;
    if (c.cookT <= 0) yServeFood(c);
  }
}

/* 一皿の原価。**仕入れ先を見つけた期間は安く入る**（旧貿易地区の出来事・odekake_y.js）。
   期限が切れれば、そのまま元の原価に戻る */
function yMenuCost(m) {
  const g = G.ch2 && G.ch2.genkaOff;
  let off = (g && G.day <= g.until) ? (g.pct || 0) : 0;
  // 🥟【目利き】＝旧貿易地区に通って身につけたもの。期限は無い（odekake_y.js）
  if (typeof ySkillGenkaOff === 'function') off += ySkillGenkaOff();
  return Math.round((m.cost || 0) * (1 - Math.min(off, 0.5)));
}

/* ============ ③ 机に届いた＝ここで金が入る ============ */
function yServeFood(c) {
  const m = c.order; if (!m) return;
  c.food = true; c.cookT = 0;
  G.cash += m.price;
  G.today.revenue += m.price;
  G.today.menuRev = (G.today.menuRev || 0) + m.price;
  G.today.menuCost = (G.today.menuCost || 0) + yMenuCost(m);
  G.today.menuN = (G.today.menuN || 0) + 1;
  if (typeof addFloater === 'function') addFloater(c.px, c.py - 24, '+' + yen(m.price));
  if (typeof Sfx !== 'undefined' && Sfx.play) Sfx.play('coin');
  c.sat += c.orderLiked ? 8 : 3;
  /* 待たされたぶんの不満。★2の板前で混んだ日は、ここが効いてくる */
  const waited = G.minutes - (c.orderAt != null ? c.orderAt : G.minutes);
  if (waited > WAIT_OK_Y) {
    c.sat -= Math.min(14, Math.round((waited - WAIT_OK_Y) / 3));
    if (!c.bub && Math.random() < .5) bubble(c, pick(['やっと来た…', '遅い', '待ったぞ']), 3);
    logGripe(c.type.name, '料理が遅い', 'slowFood');
  }
  yCookQuality(c, m);                                      // 腕による「うまい」「マズい」
  c.ate = true;                                            // 腹は膨れた（もう腹は減らない・yHungerTick）
  c.timer = Math.min(c.timer, EAT_TIME_Y);                 // 食べ終わったら席を立つ
}

/* 腕がそのまま皿の出来になる。★2を雇うと、金を取ったうえで客を怒らせる */
function yCookQuality(c, m) {
  const r = yCookSkill();
  if (r >= 5) {
    c.sat += 6;
    if (!c.bub && Math.random() < .5) bubble(c, pick([m.name + '、うまい！', 'これは当たりだ', 'また食いに来る']), 3.2);
    /* ⚠ ここは `G.repBonus` を**直に足していた**（上限なし）。皿を出すたびに12%で+1なので、
       食堂が回りはじめて40日で **+189** まで積み上がり、評判が100に張り付いていた
       （100日通しで発見・2026-08-07）＝清潔度0点・風呂2.5点の店が、評判100になる。
       共通の addRep は物語ぶんの加点を [-40, +25] に収める＝板前の腕も、その枠の中で効かせる */
    if (Math.random() < .12 && typeof addRep === 'function') addRep(1);
  } else if (r === 4) {
    c.sat += 3;
    if (!c.bub && Math.random() < .3) bubble(c, m.name + '、うまい', 3.0);
  } else if (r === 2) {
    c.sat -= 5;
    if (!c.bub && Math.random() < .35) bubble(c, pick(['……ぬるいな', 'まあ、腹は膨れる', '味は、うん']), 3.2);
  } else if (r <= 1) {
    c.sat -= 12;
    if (!c.bub) bubble(c, pick(['マズい！', '……これは無いだろ', '金返してほしい']), 3.6);
    logGripe(c.type.name, '料理がマズい', 'mazui');
  }
}

/* ============ ④ 席を立つとき（game.js の useDone）============ */
function yShokuUseDone(c, item, cat) {
  if (cat !== 'shoku' || !EQ[item.id].cap) return false;
  const out = yMenuOut();
  if (!out.length) {                                       // 板前が居ない／お品書きが空
    c.sat -= 10;
    bubble(c, pick(['……食うものが無いのか', '席だけあっても、なあ', 'メニューは？']), 3.4);
    logGripe(c.type.name, 'メニューが無い', 'menu');
  } else if (c.order && !c.food) {
    /* 頼んだのに、出てこないまま席を立った。**売上はゼロ** */
    c.sat -= 18;
    bubble(c, pick(['……もういい', '待ちくたびれた', '頼んだやつ、まだか']), 3.4);
    logGripe(c.type.name, '料理が出てこない', 'noFood');
  } else if (c.food) {
    yLeaveDishes(c);                                       // 食器が机に残る＝5階のバイトの仕事
  }
  c.order = null; c.food = false; c.orderAt = null; c.cookT = 0;
  return true;
}

/* **食べ終わった机に、食器が残る。**
   5階に人を置く理由は、もう調理でも配膳でもなく、これ（と床）だけ。
   汚れの上限（dirtMax）は建物ぜんぶで共通なので、そこは必ず見る          */
function yLeaveDishes(c) {
  if (Math.random() >= (CONF.dishRate != null ? CONF.dishRate : 0.4)) return;
  if (G.dirts.length >= CONF.dirtMax) return;
  const t = tileOf(c);
  if (G.dirts.some(d => d.x === t.x && d.y === t.y && (d.f | 0) === (c.f | 0))) return;
  G.dirts.push({ x: t.x, y: t.y, t: G.minutes, f: c.f | 0 });
}

/* 席に座っていられる時間。
   ・出せる品がある日＝**待てる限界**（平均5分で出るので、まず届く）
   ・1品も出せない日＝座ってすぐ立つ。**空の食堂に席を占領させない**   */
function yShokuUseDur(c, item, cat, dur) {
  if (cat !== 'shoku' || !EQ[item.id].cap) return undefined;
  return yMenuOut().length ? 52 : 8;
}

/* ============ 机の上の皿を描く（drawPass の層）============
   カウンターに並んでいた皿はもう無い（運ぶ人が要らなくなったので）。
   代わりに、**食べている客の手元に丼を置く**＝食堂が回っているのが目で分かる */
function yDrawShokuPass(ctx) {
  if (((G.viewF >= 0 ? G.viewF : G.actF) | 0) !== AY.SHOKUDO) return;
  for (const c of G.customers) {
    if (!c.food || c.state !== 'using' || (c.f | 0) !== AY.SHOKUDO) continue;
    const x = c.px, y = c.py - 2;
    ctx.fillStyle = 'rgba(60,44,28,.30)';
    ctx.fillRect(x - 7, y + 4, 14, 2);                             // 影
    ctx.fillStyle = '#f2eee6';                                     // 丼
    ctx.beginPath(); ctx.ellipse(x, y, 7, 4.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c9a86a';
    ctx.beginPath(); ctx.ellipse(x, y - 1, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
  }
}

/* ============ 【お品書き】タブ（設備カタログではないので自前で描く）============ */
function yRenderMenuTab(list) {
  /* ── 板前（選ぶものではないので、いま誰が立っているかを出すだけ）── */
  const t = yItamaeTier();
  const head = document.createElement('div');
  head.className = 'menu-head';
  /* 誰が立っているかを出すだけ（選ぶものではない）。
     源さんがいなくても、5階に持ち場のあるバイトが立てば鍋は回る＝★2 */
  const baito = yKitchenBaito();
  head.innerHTML = '<b>厨房</b><span class="shop-desc">'
    + (!yHasKitchen() ? '<b class="broken-note">厨房が無い＝誰も手が出せない</b>'
       : yGenji()
         ? '<b>' + t.name + '</b>（' + t.age + '）★' + t.r + '　日給 <b>' + yen(t.wage) + '</b><br>'
           + '<span class="opt-sub">' + t.note + '。客が0人の日も出ていく</span><br>'
           + '<span class="opt-sub">22時に上がる。<b>それ以降は5階のバイト（★' + COOK_R_BAITO_Y
           + '）</b>＝遅くなるし、味も落ちる</span>'
         : baito
           ? '<b>5階のバイト</b>★' + COOK_R_BAITO_Y + '<br>'
             + '<span class="opt-sub">出せることは出せる。ただ、料理人ではない</span>'
           : '<b class="broken-note">5階に誰も居ない＝食堂は閉まっている</b><br>'
             + '<span class="opt-sub">バイトの持ち場を5階にすれば開く（腕は★'
             + COOK_R_BAITO_Y + '）</span>')
    + '</span>';
  list.appendChild(head);

  /* ── お品書き ── */
  const done = yMenuDev().length, out = yMenuOut().length;
  const h2 = document.createElement('div');
  h2.className = 'menu-head';
  h2.innerHTML = '<b>お品書き ' + out + '品</b>'
    + '<span class="shop-desc">開発済み ' + done + '品'
    + '<br><span class="opt-sub">原価は、その日に出した皿のぶんだけ出ていく</span></span>';
  list.appendChild(h2);

  for (const m of yMenuAll()) {
    const has = yMenuDone(m.id);
    const div = document.createElement('div');
    div.className = 'shop-item' + (has ? ' owned' : '');
    div.innerHTML =
      '<div class="shop-body"><div class="shop-name">' + m.name
      + (has ? ' <span class="lock-chip">開発済み</span>' : '') + '</div>'
      + '<div class="shop-desc">' + m.note + '<br>'
      + '客が払う <b>' + yen(m.price) + '</b>／原価 ' + yen(m.cost) + '</div></div>'
      + (has ? '' : '<div class="shop-price">' + yen(m.dev) + '</div>');
    if (!has) div.onclick = () => yDevelopMenu(m.id);
    list.appendChild(div);
  }
  return true;
}
function yShopTabRender(tab, list) {
  if (tab !== 'menu') return false;
  return yRenderMenuTab(list);
}

/* ============================================================
   杉本源治が厨房に立つまでの三幕（作者指定 2026-08-06）
   ------------------------------------------------------------
   **求人には出てこない。金でも雇えない。**
     ① 建設費が貯まった朝、妻が「五階、食堂にしてもいいんじゃない？」と言う
     ② その翌朝、本人から電話が来る「もし作るんなら、俺が腕を振るぜ」
     ③ 厨房を据えたその場に、立っている

   **②にはロウリュ街で6回飲んでいることが要る**（作者指定 8/6）。
   見ず知らずの男が電話をかけてくるはずがない＝**それまでの関係があるから志願する**。
   通っていなければ電話は来ない。来ないあいだ、妻が小言を言い続ける（yGenNag）＝
   **「ロウリュ街に行け」が、詰みではなく催促として伝わる**。

   `G.ch2.gen` … 0 未／1 妻が言った／2 電話が来た／3 厨房に立っている
   `G.ch2.genDay` … 段が上がった日（②はその翌日以降）
   `G.ch2.genNag` … 妻が小言を言った日                                     */
const GEN_NOMI_N = 6;                       // ロウリュ街で飲む回数（源さんが電話をかけてくるまで）
function yGen() { return (G.ch2 && G.ch2.gen) | 0; }
function yGenSet(n) { if (G.ch2) { G.ch2.gen = n; G.ch2.genDay = G.day; } }
function yGenPlay(scenes, after) {
  if (typeof Story === 'undefined') { if (after) after(); return; }
  Story.play(scenes, after || (() => { if (typeof saveGame === 'function') saveGame(); }));
}
function yNomiN() { return (G.ch2 && G.ch2.jinmyaku) | 0; }
function yGenReady() { return yNomiN() >= GEN_NOMI_N; }

/* ① 妻が食堂を勧める。条件＝**次に積める階が5F食堂で、いま発注できる**
   ＝「建設費が貯まった」を、評判と累計来客まで込みで言い当てている       */
function yGenMorning() {
  if (!G.ch2 || G.phase === 'biz') return;
  const g = yGen();
  if (g === 0) {
    /* **提案を飛び越えて、5階がもう建っている場合**（30日回して見つけた・2026-08-06）。
       ①の妻の提案は「食堂が“次の増築”になった朝」にしか出ない。
       その一瞬をまたいでしまうと gen が 0 のまま止まり、②の電話も、
       命綱の小言（yGenNag は①②の中からしか呼ばれない）も永久に出ない＝
       **厨房を据えても誰も立たず、理由もどこにも出ない店**になる。
       建ってしまっているなら提案の台詞は合わないので、小言のほうから始める */
    if ((CONF.areas || []).length > AY.SHOKUDO) { yGenSet(1); yGenNag(); return; }
    if (typeof yNextZou !== 'function' || typeof yZouWhy !== 'function') return;
    const z = yNextZou();
    if (!z || z.f !== AY.SHOKUDO || yZouWhy(z)) return;
    yGenSet(1);
    log('💬 ' + WIFE_Y.name + 'が、五階を食堂にしないかと言い出した');
    yGenPlay([{ art: 'y_living', lines: [
      { sp: WIFE_Y.name, text: 'ねえ。お金、たまってるでしょう' },
      { narr: true, text: '通帳を見ていたわけではない。彼女は毎晩、レジを締めている。' },
      { sp: WIFE_Y.name, text: '五階、そろそろ食堂にしてもいいんじゃない？' },
      { sp: WIFE_Y.name, text: '湯上がりに、何も食べずに帰る人。あなた、見てるでしょう' },
    ] }]);
    return;
  }
  /* ② 翌朝の電話。**ロウリュ街で6回飲んでいないと、鳴らない。**
     知らない相手に「腕を振るぜ」と言う男ではない＝関係が先にある。
     **返事をする前に切れる**＝こちらに選択肢は無い                        */
  if (g === 1 && G.day > ((G.ch2.genDay) | 0)) {
    if (!yGenReady()) { yGenNag(); return; }
    yGenSet(2);
    log('☎ ロウリュ街の杉本源治から電話があった');
    yGenPlay([{ art: 'phone', lines: [
      { narr: true, text: '朝、店の電話が鳴った。' },
      { sp: '男', text: '杉本だ。ロウリュ街の' },
      { narr: true, text: '——名乗られるまでもなかった。あの焼き場の、カウンターの向こうの男だ。' },
      { sp: '杉本', text: 'あんたんとこ、食堂やるって聞いた' },
      { sp: '杉本', text: 'もし作るんなら——俺が、腕を振るぜ' },
      { narr: true, text: '返事をする前に、電話は切れた。' },
    ] }]);
    return;
  }
  if (g === 2 && !yHasKitchen()) yGenNag();       // 電話は来た。まだ鍋が無い
}

/* **妻の小言＝詰みを催促に変える一本の線**（作者指定 8/6）。
   ロウリュ街に6回通っていないと源さんは来ない。それを知らないプレイヤーの5階が
   金だけ食う空き部屋になるのを、ここで防ぐ。
     ・5階が建ってしまってから言うぶんは、はっきりロウリュ街を名指しする
     ・数日おきに一度だけ。毎朝言われると、ただの騒音になる               */
function yGenNag() {
  if (!G.ch2 || yGen() >= 3) return;
  const last = (G.ch2.genNag) | 0;
  if (G.day - last < 5) return;
  G.ch2.genNag = G.day;
  const built = (CONF.areas || []).length > AY.SHOKUDO;     // 5階が建っている
  const n = yNomiN();
  const lines = built
    ? [ { sp: WIFE_Y.name, text: 'ねえ。五階、まだ誰も鍋を持ってないじゃない' },
        { sp: WIFE_Y.name, text: '料理人は、見つからないの？' },
        { narr: true, text: '見つからない、のではない。探していない。' },
        { sp: WIFE_Y.name, text: 'あなた、ロウリュ街でよく飲んでるでしょう。……ああいうところに、いるんじゃないの' } ]
    : [ { sp: WIFE_Y.name, text: '食堂をやるなら、鍋を持つ人が要るわよ' },
        { sp: WIFE_Y.name, text: '広告を出して来るような人じゃ、たぶん駄目' },
        { narr: true, text: '彼女は、そういうことだけは外さない。' } ];
  if (n >= GEN_NOMI_N - 2 && n < GEN_NOMI_N)
    lines.push({ narr: true, text: '——ロウリュ街の焼き場の、あの男の顔が浮かんだ。もう少しだ。' });
  log('💬 ' + WIFE_Y.name + 'に、料理人のことを言われた');
  yGenPlay([{ art: 'y_living', lines }]);
}

/* ③ 厨房を据えた、その場に立っている。
   **置いた瞬間に出したい**ので、設備を置いたあと必ず走る renderShop に相乗りしている
   （game.js に新しいフックを足さずに済ませるため）。描画の途中で場面を始めると
   画面が二重に走るので、1フレーム遅らせてから開く                        */
let Y_GEN_PENDING = false;
function yGenKitchen() {
  if (!G.ch2 || Y_GEN_PENDING) return;
  if (yGen() !== 2 || !yHasKitchen() || G.phase === 'biz') return;
  Y_GEN_PENDING = true;
  setTimeout(() => {
    Y_GEN_PENDING = false;
    if (yGen() !== 2 || !yHasKitchen()) return;
    yGenSet(3);
    const t = CONF.itamae || {};
    log('🍜 ' + t.name + 'が厨房に立った（日給 ' + yen(t.wage) + '）');
    toast('🍜 ' + t.short + 'が厨房に立った');
    yGenPlay([{ art: 'gate', lines: [
      { narr: true, text: '厨房の据え付けが終わった夕方、店の前に男が立っていた。' },
      { sp: '杉本', text: '五階か' },
      { narr: true, text: '手には何も持っていない。エプロンも、包丁も。' },
      { sp: '杉本', text: '勘定は、あんたがやってくれ。俺は鍋だけでいい' },
      { narr: true, text: '日給一万。二十六年ぶんの腕に、その男が自分でつけた値段だった。' },
    ] }, ]);
  }, 0);
}

/* ⚠ 家の絵の登録は **odekake_y.js へ移した**（2026-08-08）。
   このファイルは index.html の 422行＝`js/story.js`（434行）より**先**に読まれるので、
   ここで `typeof STORY_IMG !== 'undefined'` を見ても常に false ＝
   **登録が一度も走っていなかった**（源さんの場面も、家の絵が出ていなかった）*/

/* ============ 腹が減る（作者指定 2026-08-07）============

   直す前は、飯は**予定のいちばん最後**に固定だった（js/game.js:1719）。
   風呂 → サウナ2周 → ととのい → 飯。滞在が2時間以上あるので、

     ・20時に来た客が食べるのは 23〜24時
     ・**皿の山が来るころに閉店する**（昼だけの店だと、食べたい客の半分が食べ損ねる）

   実測：`eatRate` は 0.45 なのに、実際に食べたのは
   深夜営業あり 41.3% ／ **昼だけ 20.8%**。

   そこで「予定のどこに入れるか」ではなく、**その時刻に腹が減る**という形にした。

     18〜20時のあいだ、館内にいる客の ◯% が腹を減らす（CONF.mealPeakRate）
     腹が減った客は、**いま並んでいる予定を追い越して**食堂へ行く

   ・もともと飯を予定に入れていた客 … その飯が前に出てくる（＝サウナ→飯→サウナ になる）
   ・入れていなかった客              … 飯が1つ増える

   共有コードは触っていない。`c.plan[0]` を取り出して `shift()` する作りなので、
   先頭に `unshift` すれば「次にやること」になる。                          */
function yMealPeak() { return CONF.mealPeak || [18, 20]; }
function yMealPeakRate() { return CONF.mealPeakRate != null ? CONF.mealPeakRate : 0.4; }

function yInMealPeak() {
  const [a, b] = yMealPeak();
  const h = yOpenHour() + (G.minutes || 0) / 60;
  return h >= a && h < b;
}
/* ピーク帯を通しで居た客の ◯% が腹を減らす→ 1分あたりの確率に直す */
function yHungerP() {
  const [a, b] = yMealPeak();
  const mins = Math.max(1, (b - a) * 60);
  return 1 - Math.pow(1 - clamp(yMealPeakRate(), 0, 0.99), 1 / mins);
}

function yHungerTick(dt) {
  if (G.phase !== 'biz' || !G.ch2) return;
  if (!yInMealPeak()) return;
  if (!yKitchenManned() || !yMenuOut().length) return;      // 開いていない食堂には行かない
  const p = yHungerP();
  for (const c of G.customers) {
    if (c.isChild || c.hungry || c.ate) continue;
    if (!c.plan || c.state === 'turnAway' || c.state === 'turnAwayExit' || c.state === 'toExit') continue;
    if (Math.random() >= p * dt) continue;
    c.hungry = true;
    /* すでに飯を予定に入れていたら、それを前に出すだけ（二皿にはしない） */
    const i = c.plan.findIndex(e => e && e[0] === 'shoku');
    if (i >= 0) { const m = c.plan.splice(i, 1)[0]; c.plan.unshift(m); }
    else c.plan.unshift(['shoku', rand(6, 9)]);
    if (!c.bub && Math.random() < 0.25) bubble(c, pick(['腹減ったな…', '何か食うか', 'いい匂いがする']), 3.0);
  }
}

/* 日報のチップの名前。共有側の既定は「返済・税」だが、
   この章の `dailyExtraCost` の中身は **源さんの日給＋その日に出した皿の原価**。
   （第1章セッションが closeDay に chHook('extraFixLabel') を入れてくれた） */
function yExtraFixLabel() { return '板前・原価'; }

/* ============ バイト管理画面の5階に、源さんを出す（作者指定 8/7）============
   源さんは求人から雇う人ではないので `G.roster` には入っていない。
   でも**辞めてもらう道は要る**（自分からは辞めない）ので、
   5階の欄に一枚だけ、バイトの札と並べて出す。

   ブラウザの confirm は使わない（第1章セッションの申し送り 8/7＝
   環境によっては何も出さずに false を返す）。**ボタンを2度押させる**形にする。 */
/* 構えは**6秒で自然に解ける**。押しっぱなしで画面を閉じて、あとで開き直したときに
   一度のタップで消えてしまうのを防ぐ（時刻で持つので、閉じ方に依らない） */
let Y_GEN_FIRE_AT = 0;
const Y_GEN_FIRE_MS = 6000;
function yGenFireArmed() { return Date.now() - Y_GEN_FIRE_AT < Y_GEN_FIRE_MS; }

function yGenMgrBlock(f) {
  if (!G.ch2 || f !== AY.SHOKUDO || !yGenji()) return '';
  const t = yItamaeTier(); if (!t) return '';
  const armed = yGenFireArmed();
  return `<div class="sm-area-sub">
    <div class="sm-card gen-card">
      <b>🍜 ${t.name}（${t.age}）</b>★${t.r}
      <span class="shop-price">${yen(t.wage)}／日</span><br>
      <span class="shop-desc">${t.note}。22時に上がる<br>
        求人で雇った人ではないので、持ち場は動かせない</span>
    </div>
    <button class="opt-btn${armed ? ' danger' : ''}" data-genfire="1">${
      armed ? '⚠ 本当に辞めてもらう（もう戻らない）' : '🍜 辞めてもらう'}</button>
    ${armed ? '<p class="sm-note">ロウリュ街の男に一度断ったら、二度は来ない。<br>'
      + '厨房は5階のバイト（★' + COOK_R_BAITO_Y + '）が回すことになる</p>' : ''}
  </div>`;
}
function yGenMgrBind(box) {
  if (!box) return;
  const b = box.querySelector('[data-genfire]');
  if (!b) { Y_GEN_FIRE_AT = 0; return; }
  b.onclick = () => {
    if (!yGenFireArmed()) { Y_GEN_FIRE_AT = Date.now(); renderStaffMgr(); return; }
    Y_GEN_FIRE_AT = 0;
    G.ch2.genQuit = true;
    const t = yItamaeTier();
    log('🍜 ' + (t ? t.name : '板前') + 'に、辞めてもらった');
    if (typeof toast === 'function') toast('厨房から鍋の音が消えた');
    if (typeof Sfx !== 'undefined') Sfx.play('ui');
    if (typeof saveGame === 'function') saveGame();
    renderStaffMgr();
    if (typeof renderShop === 'function') renderShop();
  };
}
function yStaffAreaNote(f) { return yGenMgrBlock(f); }

/* ⚠ staffJob フックはもう登録しない。**5階のバイトは、いつもどおり掃除に行く** */
registerChapter2Hooks({ useStart: yShokuUseStart, shopTabRender: yShopTabRender,
                        dailyExtraCost: yDailyExtraCost, extraFixLabel: yExtraFixLabel,
                        staffAreaNote: yStaffAreaNote });
