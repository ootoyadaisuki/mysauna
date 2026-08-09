'use strict';

/* ============================================================
   第2章「独立開業編」のふるまい
   ------------------------------------------------------------
   作者指定：**同じアプリの中で、まったく別のゲームを動かす**。
   だから第1章のコード（js/game.js）に「第2章のときはこうする」を書き足していくのではなく、
   第2章のやり方はこのファイルに集め、chapter.js の差し替え口（フック）から挿し込む。

   ・共通なのは「エンジン」＝評価・満足度・常連・日報・汚れ・修理・バイト・描画・経路探索
   ・別なのは「ゲーム」＝区画の回遊・週の進み方・開業フロー・家の金・食堂・登場人物

   共通の設定（CONF など）は第1章のものを土台にしているが、
   セーブも数値も物語も完全に分かれていて、互いに干渉しない。
   ============================================================ */

/* ============ 区画の役割 ============
   どのカテゴリの設備が、どの区画にあるか。
   客が「次はサウナ」と決めたとき、いま居る区画に無ければ、この表を見て移動する */
const AREA_OF_CAT = {
  sauna: [AR.OTOKO, AR.ONNA],     // 浴室（男湯・女湯）＝その客の性別のほう
  mizu:  [AR.OTOKO, AR.ONNA],
  furo:  [AR.OTOKO, AR.ONNA],
  wash:  [AR.OTOKO, AR.ONNA],
  locker:[AR.OTOKO, AR.ONNA],     // ロッカーは脱衣所＝浴室の区画の中
  datsui:[AR.OTOKO, AR.ONNA],
  rest:  [AR.KYUKEI],             // ととのいは休憩スペース（館内着で男女共用）
  shoku: [AR.SHOKUDO],            // 食堂
  lobby: [AR.LOBBY],
  park:  [AR.LOBBY],
  sys:   [AR.LOBBY],              // 受付
};

/* その客が使う浴室の区画（男湯 or 女湯） */
function bathAreaOf(c) {
  return (c.type && c.type.sex === 'f') ? AR.ONNA : AR.OTOKO;
}
/* その区画に、そのカテゴリの使える設備があるか */
function catInArea(cat, f) {
  return G.equip.some(e => (e.f | 0) === (f | 0) && EQ[e.id]
    && EQ[e.id].cat === cat && (EQ[e.id].cap === 0 || e.cond > 0));
}
/* そのカテゴリの設備が、その客にとってどの区画にあるか。
   **いま居る部屋にそれがあるなら、わざわざ移らない**（作者指定）。
   これが無いと、浴室に置いた外気浴デッキやととのいイスを使うために
   いちいち休憩スペースまで歩いて行ってしまう                       */
function areaForCat(c, cat) {
  const list = AREA_OF_CAT[cat];
  if (!list) return null;
  if (catInArea(cat, c.f | 0)) return c.f | 0;
  const want = list.length > 1 ? bathAreaOf(c) : list[0];   // 浴室系は男女で分かれる
  return areaOpen(want) ? want : null;             // 人のいない部屋へは行かせない
}

/* ============ 部屋には人が要る（作者指定）============
   **スタッフのいない部屋は「利用不可」。客は入れない。**
   雇うことが「効率」ではなく「部屋を開けること」になる＝5部屋あることに意味が出る。

     ・持ち場は1人1部屋（emp.f）
     ・主人公の持ち場はロビー（番台で会計をするので動かせない）
     ・女湯に立てるのは女性だけ
     ・**遅刻中は閉めない**（作者指定）。開いてはいるが無人＝汚れが溜まり、満足度が落ちる

   第1章は CONF.staffRooms を持たないので、この関門は一度も効かない          */
function staffRoomsOn() { return !!CONF.staffRooms; }
function playerAreaIdx() { return CONF.playerArea ?? 0; }
/* その部屋の担当（名簿から引く＝準備中でも分かる） */
/* 持ち場が未設定（f == null）の人を 0（ロビー）と数えないこと＝null|0 は 0 になる */
function empOfArea(f) { return (G.roster || []).find(e => e.f != null && (e.f | 0) === (f | 0)); }
/* 客がその部屋を使えるか */
function areaOpen(f) {
  if (!staffRoomsOn()) return true;
  const a = (CONF.areas || [])[f | 0];
  if (a && a.noStaff) return true;                 // 廊下＝通り道。人を置く場所ではない
  if ((f | 0) === playerAreaIdx()) return true;    // 主人公が番台に立っている
  return !!empOfArea(f);
}
/* 開いてはいるが、いま人がいない（遅刻中）＝汚れが溜まり、満足度が落ちる */
function areaUnmanned(f) {
  if (!staffRoomsOn() || G.phase !== 'biz') return false;
  const ar = (CONF.areas || [])[f | 0];
  if (ar && ar.noStaff) return false;              // 廊下に人がいないのは当たり前
  if ((f | 0) === playerAreaIdx()) return false;
  if (!empOfArea(f)) return false;                 // そもそも閉まっている
  const s = (G.staff || []).find(w => (w.f | 0) === (f | 0));
  return !s || s.lateT > 0;
}
/* 利用不可の理由（館内案内図と部屋の画面に出す）。開いていれば null */
function areaClosedWhy(f) {
  if (areaOpen(f)) return null;
  return 'スタッフがいません';
}
/* その部屋に女性しか立てないか（女湯） */
function areaSexOnly(f) { const a = areaDef(f); return a && a.sex === 'f' ? 'f' : null; }
/* 持ち場に付けられるか（女湯には女性だけ） */
function canStaffArea(emp, f) {
  const a = (CONF.areas || [])[f | 0];
  if (a && a.noStaff) return false;        // 廊下には持ち場を置けない
  const only = areaSexOnly(f);
  return !only || emp.sex === only;
}

/* 持ち場を選んだ直後（game.js の持ち場ボタンから）。
   役割のある部屋なら、**空いているほうを自動で当てる**＝
   食堂に3人目を入れたのに、3人とも厨房に立って誰も運ばない、を起こさない */
function onStaffPost(emp, f) {
  const a = (CONF.areas || [])[f | 0];
  if (!a || !a.jobs) { emp.job = null; return; }
  const cnt = k => (G.roster || []).filter(e => e !== emp && (e.f | 0) === (f | 0)
                                             && (e.job || a.jobs[0][0]) === k).length;
  if (emp.job && a.jobs.some(([k, , cap]) => k === emp.job && cnt(k) < cap)) return;
  const free = a.jobs.find(([k, , cap]) => cnt(k) < cap);
  emp.job = free ? free[0] : a.jobs[0][0];
}

/* そのスタッフの持ち場（game.js の makeStaff から呼ばれる）。
   持ち場が無い／立てない部屋なら、いちばん空いている部屋に回す */
function staffAreaOf(emp) {
  if (!staffRoomsOn()) return 0;
  if (emp && emp.f != null && canStaffArea(emp, emp.f)) return emp.f | 0;
  const shop = (CONF.areas || []).map((a, i) => i)
    .filter(i => !(CONF.areas[i] || {}).home && !(CONF.areas[i] || {}).noStaff);
  const free = shop.find(i => i !== playerAreaIdx() && !empOfArea(i) && canStaffArea(emp || {}, i));
  return free != null ? free : playerAreaIdx();
}

/* 開業前から各部屋に1人ずついる（作者指定）＝主人公が事前に求人広告を出して集めた。
   全員スキル低め。**この4人でも回る。ただし回るだけだ。** */
function initRoster() {
  return (CONF.initRoster || []).map(p => ({
    pid: p.pid, name: p.name, sex: p.sex, f: p.f, job: p.job || null, desc: p.desc,
    maji: p.maji, spd: p.spd, aiso: p.aiso, ryori: p.ryori,
    wage: staffWageOf(p), days: 0,
    skill: 30 + (p.maji + p.spd + p.aiso) * 2,
    sulk: false, raiseAsk: false, raiseAmt: 0, raiseNo: 0,
  }));
}

/* ============ 券売機の使い方が分からない客（作者指定）============
   券売機を入れると受付は速くなるが、**年配の客は立ち往生する。**
   ロビーにバイトが立っていれば横について教えてくれる＝何も起きない。
   誰もいなければ、券売機の前で困ったまま、機嫌を損ねて中へ入る。

   ＝**機械は人の代わりにならない。** 速くはなるが、人がいなくなるわけではない */
function ticketConfusion(c) {
  if (!staffRoomsOn()) return;
  if (!G.equip.some(e => e.id === 'f2_ticket' && e.cond > 0)) return;
  const t = c.type || {};
  if (t.key !== 'senior' && c.typeKey !== 'senior') return;      // 困るのは年配客だけ
  // ロビーに人が立っていれば、横について教えてくれる
  const helper = (G.staff || []).some(w => (w.f | 0) === playerAreaIdx() && !(w.lateT > 0));
  if (helper) {
    if (!c.bub && Math.random() < .4) bubble(c, pick(['……これ、どう押すの', 'ああ、なるほどね']), 3.0);
    return;
  }
  c.sat -= 10;
  if (!c.bub) bubble(c, pick(['この機械、分からん…', '誰か、いないのか', 'どこを押せばいいんだ…']), 3.6);
  logGripe(t.name || '年配の客', '券売機が分からない', 'ticket');
}

/* 汚れの落ちやすさ（game.js の cleanFactor から呼ばれる）。無人の部屋は溜まる */
function dirtMul(f) { return areaUnmanned(f) ? (CONF.noStaffDirt || 2) : 1; }
/* 設備を使い終わった客への減点。無人の部屋は「誰もいない」が効く */
function unmannedSat(c, f) {
  if (!areaUnmanned(f)) return;
  c.sat -= (CONF.noStaffSat || 8);
  if (!c.bub && Math.random() < .25)
    bubble(c, pick(['……誰もいないな', '人、いないの？', '声をかける相手がいない']), 3.2);
  logGripe(c.type.name, 'スタッフがいない', 'noStaff');
}

/* バイト画面の部屋ごとに1行そえる（game.js の renderStaffMgr から）。
   **「料理担当はどこで決めるのか」が画面のどこにも書いていなかった**（作者指摘）。
   決め方は「食堂に置いた人のうち、いちばん料理★の高い人が厨房に立つ」＝
   選ぶのではなく、**誰を食堂に置くか**がその選択そのものなので、そう書く   */
function staffAreaNote(f, here) {
  const a = (CONF.areas || [])[f];
  if (!a || !a.jobs) return '';
  if (!here || !here.length)
    return '<p class="sm-note">誰も置いていない＝<b>食堂は閉まる</b>。お品書きは一品も出せない</p>';
  const cook = here.filter(e => (e.job || 'cook') === 'cook');
  const hall = here.filter(e => (e.job || 'cook') === 'hall');
  const best = (cook.length ? cook : here).reduce((m, e) => Math.max(m, e.ryori || 1), 0);
  return `<p class="sm-note">🍳 調理 ${cook.length ? cook.map(e => e.name).join('・') : '（なし＝居る人が作る）'}
      ／ 腕は<b>料理★${best}</b>（出す速さと皿の出来に効く）<br>
    🍜 ホール ${hall.length ? hall.map(e => e.name).join('・')
                            : '（なし＝作った人が自分で運ぶ。そのぶん厨房が止まる）'}</p>`;
}

/* ============ 区画をまたぐ移動 ============
   区画のあいだは「通路」で繋がっている。歩いて通路まで行き、そこで隣の区画へ移る。
   （画面に出ていない区画でも、区画ごとに計算を回しているので、ちゃんと歩いて移動している） */

/* 館内の行き来は、**かならず廊下を通る**（作者指定）。

   これが無かったころは、部屋の戸口まで歩いた瞬間に**隣の部屋の戸口へ瞬間移動**していた。
   移動に時間がかからず、人がすれ違うこともない。
   ロビーで受付を済ませた客が、次の瞬間には脱衣所に立っている。

   いまは：
     ロビー → 廊下 → 浴室 ／ 浴室 → 廊下 → 食堂 …
   と、必ず1本挟む。廊下を歩くぶんの時間がかかり、混む時間には廊下が詰まる。

   ── 戸のありか ──
   ふつうの部屋は、廊下に面した**自分の戸を1つ**持っているだけでいい。
     ・ロビー … 上辺の通路（entranceTop）。下辺は国道に面した**玄関**なので使わない
     ・休憩・食堂・浴室 … 下辺の戸（entrance）
   廊下だけは行き先のぶんだけ戸が並ぶ（ROUKA_DOOR）＝どの戸がどこへ抜けるかが絵で分かる */
const ROUKA_DOOR = {};
function roukaDoor(to) {
  if (!Object.keys(ROUKA_DOOR).length) {
    const a = (CONF.areas || [])[AR.ROUKA] || {};
    const top = a.topDoors || [2, 5, 7, 10];
    ROUKA_DOOR[AR.LOBBY]   = a.entrance || { x: 6, y: 4 };   // 下辺＝ロビーへ降りる
    ROUKA_DOOR[AR.KYUKEI]  = { x: top[0], y: 0 };
    ROUKA_DOOR[AR.OTOKO]   = { x: top[1], y: 0 };
    ROUKA_DOOR[AR.ONNA]    = { x: top[2], y: 0 };
    ROUKA_DOOR[AR.SHOKUDO] = { x: top[3], y: 0 };
  }
  return ROUKA_DOOR[to] || ROUKA_DOOR[AR.LOBBY];
}
function backDoor(f) {                                   // 奥へ抜ける通路（無ければ表の戸）
  const a = (CONF.areas || [])[f];
  return (a && (a.entranceTop || a.entrance)) || { x: 6, y: 10 };
}
function frontDoor(f) {                                  // 表側の戸
  const a = (CONF.areas || [])[f];
  return (a && a.entrance) || { x: 6, y: 10 };
}
/* from の部屋の中で、to へ抜けるためにくぐる戸 */
function doorToward(from, to) {
  if (from === AR.ROUKA) return roukaDoor(to);
  if (from === AR.LOBBY) return backDoor(AR.LOBBY);      // ロビーは上の通路から廊下へ
  return frontDoor(from);                                // ほかの部屋は下辺の戸
}
/* いま居る部屋から goal へ行くとき、次に移る部屋（＝たいてい廊下） */
function nextHop(here, goal) {
  if (here === AR.ROUKA || goal === AR.ROUKA) return goal;
  return AR.ROUKA;
}
/* 移動を始める（人でもバイトでも使える） */
function startTransit(e, goal, stateKey) {
  const here = e.f | 0;
  if (goal === here) return false;
  const to = nextHop(here, goal);
  const t = doorToward(here, to);
  const cur = tileOf(e);
  const path = findPath(cur.x, cur.y, t.x, t.y);
  if (!path) return false;                               // 戸まで行けない
  e.moveGoal = goal; e.moveTo = to; e.path = path;
  return true;
}
/* 戸を抜けた。隣の部屋の、こちら側の戸口に立たせる */
function finishHop(e) {
  const to = e.moveTo | 0, from = e.f | 0;
  e.f = to;
  const inTile = doorToward(to, from);                   // 着いた部屋の、いま来た方向の戸
  e.px = inTile.x * T + T / 2;
  e.py = inTile.y * T + T / 2;
  e.path = null; e.moveTo = null;
  const goal = e.moveGoal;
  if (goal != null && (goal | 0) !== to && startTransit(e, goal | 0)) return false;  // 廊下から、その先へ
  e.moveGoal = null;
  return true;                                           // 着いた
}

/* 客を別の区画へ送り出す。true を返したら「移動を始めたので、今回の予定選びは中断」 */
function routeTo(c, cat) {
  const want = areaForCat(c, cat);
  if (want === null || want === (c.f | 0)) return false;   // 同じ区画にあるなら、いつもどおり
  if (!startTransit(c, want)) return false;
  c.state = 'ch2Transit';
  return true;
}

/* 戸まで歩き切ったら、隣の区画へ移す。廊下で乗り換えるので、2本ぶん歩く */
function stepTransit(c, dt) {
  if (!stepMove(c, dt)) return;
  if (finishHop(c)) c.state = 'plan';        // 着いた＝移った先で予定を選び直す
}

/* ============ 部屋ごとのカタログ ============
   いま入っている部屋に置けるものだけをタブに並べる（作者指定）。
   食堂を開いているのに駐車場の設備が並んでいると、どこの話なのか分からなくなる。 */
const TABS_OF_AREA = {
  [AR.LOBBY]:   ['lobby', 'park'],
  // 休憩スペースは【寝る】【座る】【過ごす】【設え】の4枚（作者指定）
  [AR.KYUKEI]:  ['ne', 'suwaru', 'sugosu', 'shitsurae'],
  // 食堂は【厨房】（何が作れるか）【メニュー】（何を出すか）【食堂】（どこで食べるか）の3枚
  [AR.SHOKUDO]: ['chubo', 'menu', 'shokudo'],
  [AR.OTOKO]:   ['sauna', 'mizu', 'furo', 'wash', 'gaiki', 'datsui'],
  [AR.ONNA]:    ['sauna', 'mizu', 'furo', 'wash', 'gaiki', 'datsui'],
  // 廊下は通り道＝何も置けない（カタログそのものを出さない）
  [AR.ROUKA]:   [],
};
function shopCats() {
  // 見ている部屋で決める（計算用の G.actF は区画ごとに切り替わるので当てにしない）
  const f = G.viewF >= 0 ? G.viewF : G.actF;
  const keys = TABS_OF_AREA[f];
  if (!keys) return CATS;
  return CATS.filter(c => keys.includes(c[0]));
}

/* ============ メニュー ============
   厨房に入れた設備で、出せる品が解放される（作者指定）。
   解放されただけでは出ない＝**枠のぶんだけ選んで、はじめてメニューに載る**。
   客は「自分の食べたいもの」が載っていないと不満を残す。      */

/* 厨房が在るか（一個物・壊れていないこと） */
function hasKitchen() {
  return G.equip.some(e => e.id === 'k2_kitchen' && (e.f | 0) === AR.SHOKUDO && e.cond > 0);
}
/* ============ メニュー開発（作者指定）============
   **金を払って開発した品が、そのままお品書きに載る。**
   器具の組み合わせで解放する作りはやめた＝「何を作れる店にするか」を
   金で選ぶ、という一本の線にする。開発は一度きりで、取り消せない。

   出すには、開発に加えて **厨房と、厨房に立つ人**が要る。
   どちらが欠けても一品も出せない＝バイトを引き上げた日は食堂が閉まる。   */
function menuDev() { return (G.ch2 && G.ch2.menuDev) || []; }
function menuDone(id) { return menuDev().includes(id); }
function menuAll() { return CONF.menu || []; }
/* 開発済みで、いま実際に出せる品 */
function menuReady(m) { return menuDone(m.id) && hasKitchen() && cookSkill() > 0; }
function menuOut() { return menuAll().filter(menuReady); }
/* 客に見せるお品書き（＝出せる品）。shokudo2.js が参照する */
function menuList() { return menuOut().map(m => m.id); }
function menuOn(id) { return menuDone(id); }

function developMenu(id) {
  if (!G.ch2) return;
  const m = menuAll().find(x => x.id === id); if (!m) return;
  if (menuDone(id)) return;
  if (m.akari && !akariOn()) { toast('灯が来てからでないと作れない'); return; }
  if (G.cash < m.dev) { toast('開発費が足りない'); return; }
  G.cash -= m.dev;
  G.invBuy += m.dev;                                   // 日報の「設備投資」に載る
  if (!G.ch2.menuDev) G.ch2.menuDev = [];
  G.ch2.menuDev.push(id);
  toast(`🍜 ${m.name}を開発した（${kgYen(m.dev)}）`);
  log(`🍜 ${m.name}を開発した（開発費 ${kgYen(m.dev)}）`);
  Sfx.play('register');
  updateTopbar(); renderShop(); saveGame();
}
/* 灯（あかり）はまだ登場していない。来たら true を返すようにする */
function akariOn() { return !!(G.ch2 && G.ch2.akari); }

/* 【メニュー】タブの中身。設備カタログではないので、ここで自前に描く */
function renderMenuTab(list) {
  const done = menuDev().length, out = menuOut().length;
  const head = document.createElement('div');
  head.className = 'menu-head';
  const why = !hasKitchen() ? '<br><b class="broken-note">厨房が無い＝開発しても一品も出せない</b>'
            : cookSkill() <= 0 ? '<br><b class="broken-note">食堂に人が立っていない＝今日は閉まっている</b>' : '';
  head.innerHTML = `<b>お品書き ${out}品</b>` +
    `<span class="shop-desc">金を払って**開発**した品が、そのままお品書きに載る。<br>` +
    `客は自分の食べたいものが無いと不満を残す。品数が少なすぎるのも同じ（3品未満）。${why}</span>`;
  list.appendChild(head);
  for (const m of menuAll()) {
    const dev = menuDone(m.id);
    const lock = m.akari && !akariOn();
    const div = document.createElement('div');
    div.className = 'shop-item menu-item' + (lock ? ' locked' : '') + (dev ? ' menu-on' : '');
    div.innerHTML = `<div class="shop-body">
        <div class="shop-name">${dev ? '<b class="menu-tag">出す</b> ' : ''}${m.name}${lock ? ' <span class="lock-chip">🔒 灯</span>' : ''}</div>
        <div class="shop-note">${m.note}</div>
        <div class="shop-desc">${dev ? `原価 ${kgYen(m.cost)}　粗利 ${kgYen(m.price - m.cost)}　売値 ${kgYen(m.price)}`
                                     : `開発すると出せる／売値 ${kgYen(m.price)}・原価 ${kgYen(m.cost)}`}</div>
      </div>
      <div class="shop-price">${dev ? '開発済' : kgYen(m.dev)}</div>`;
    div.onclick = () => {
      if (dev) { toast(`${m.name}はもう出している`); return; }
      if (lock) { toast('灯が来てからでないと作れない'); return; }
      developMenu(m.id);
    };
    list.appendChild(div);
  }
  return true;
}
function id0(m) { return m.id; }
/* いま見ている部屋のカタログに、その品を並べてよいか（男湯／女湯限定のもの） */
function shopItemOK(id) {
  const only = EQ[id] && EQ[id].sexOnly;
  if (!only) return true;
  const f = G.viewF >= 0 ? G.viewF : G.actF;
  const a = areaDef(f);
  return !!(a && a.sex === only);
}
/* 設備カタログの代わりに、章が自前で描くタブ（game.js の renderShop から呼ばれる） */
function shopTabRender(tab, list) {
  if (tab !== 'menu') return false;
  return renderMenuTab(list);
}

/* 客が席を立ったとき＝飯を食い終わったとき（game.js の finishUse から）。
   ここで「何を頼んだか」「そもそも食いたいものがあったか」が決まる          */
/* 席を立ったとき。**売上と満足は「運ばれてきた瞬間」に済ませてある**（shokudo2.js）ので、
   ここに残るのは「お品書きが無い」「頼んだのに出てこなかった」の後始末だけ */
function useDone(c, item, cat) {
  unmannedSat(c, item.f | 0);                           // 無人の部屋を使った＝誰もいなかった
  if (cat !== 'shoku' || !EQ[item.id].cap) return;      // 席に座っていた客だけ
  useDoneShoku(c, item);
}

/* ============ 厨房の腕（作者指定）============
   料理人という職種は作らない。**誰でも厨房に立てる。立たせた人の腕が出るだけ。**
   食堂の担当スタッフの【料理★】で、皿の上が変わる。

     ★5 … 「うまい」。満足度＋・たまに評判が動く
     ★3 … 何も起きない（標準）
     ★1 … **「マズい」**。満足度−・評判−

   厨房に誰も立っていない日は、そもそもメニューが出せない（menuReady）      */
/* 厨房に立つのは食堂の担当のうち**いちばん腕のいい人**（shokudo2.js の cookOf2 と同じ考え方）。
   2人置いたときに、腕の悪いほうの★で皿の出来が決まってしまうのを防ぐ */
function cookSkill() {
  /* 厨房に入るのは**調理の役割**の人（求人で雇った調理スタッフ）。
     調理が1人もいない日は、食堂に居る人が作る＝**1人でも店は開く**（作者指定） */
  const crew = (G.roster || []).filter(e => e.f != null && (e.f | 0) === AR.SHOKUDO);
  if (!crew.length) return 0;
  const c = crew.filter(e => (e.job || 'cook') === 'cook');
  return (c.length ? c : crew).reduce((m, e) => Math.max(m, e.ryori || 1), 0);
}
/* 席に着いてから食べ終わるまで。腕がいいほど早く出てくる＝席の回転が上がる。
   ★1を厨房に置くと、食堂で客が待たされ、**湯に入る時間まで食われる** */
/* useDur（席にいられる時間）は shokudo2.js が持つ＝
   腕の善し悪しは「調理時間」で効かせ、席の時間は**待てる限界**として固定する */
function cookQuality(c, m) {
  const r = cookSkill();
  if (r >= 5) {
    c.sat += 6;
    if (!c.bub && Math.random() < .5) bubble(c, pick([`${m.name}、うまい！`, 'これは当たりだ', 'また食いに来る']), 3.2);
    if (Math.random() < .12 && typeof addRep === 'function') addRep(1);
  } else if (r === 4) {
    c.sat += 3;
    if (!c.bub && Math.random() < .3) bubble(c, `${m.name}、うまい`, 3.0);
  } else if (r === 2) {
    c.sat -= 5;
    if (!c.bub && Math.random() < .35) bubble(c, pick(['……ぬるいな', 'まあ、腹は膨れる', '味は、うん']), 3.2);
  } else if (r <= 1) {
    c.sat -= 12;
    if (!c.bub) bubble(c, pick(['マズい！', '……これは無いだろ', '金返してほしい']), 3.6);
    logGripe(c.type.name, '料理がマズい', 'mazui');
  } else {
    if (!c.bub && Math.random() < .2) bubble(c, `${m.name}、悪くない`, 3.0);
  }
}

/* ============ 主人公の見回り ============
   第2章の主人公は、5つの部屋を歩いて回って掃除する。
   いまの部屋の汚れを拭き終えたら、汚れの残っている部屋へ移り、
   全部片づいたら番台へ戻る。女湯には入れないので、そこだけは通り過ぎる。

   ・移るのは**準備中だけ**。営業中は番台に張り付いていないと会計が止まる
   ・館内案内図で部屋を選ぶと、そのときはその部屋へ直接立たせる（enterAreaScreen）  */
function roamPlayer(w, tired) {
  if (G.phase !== 'prep') return false;
  /* 開店前でゴミが残っているうちは、部屋を渡り歩かない（作者指定の片付けが先）。
     勝手に別の部屋へ行かれると、タップしたゴミの前から居なくなってしまう */
  if (junkLeft()) return false;
  const here = w.f | 0;
  const areas = CONF.areas || [];
  // 汚れが残っている部屋のうち、主人公が入れるところ
  // （拭ける数を使い切っていたら、もう探さない＝そのまま番台へ帰る）
  const want = [];
  if (isHomeArea(here)) return false;                 // 家にいる間は見回らない
  if (!tired) for (let f = 0; f < areas.length; f++) {
    if (f === here || playerBanned(f) || areas[f].home) continue;
    if (G.dirts.some(d => (d.f | 0) === f)) want.push(f);
  }
  // 近い部屋から（案内図の並び順で隣にあるものを先に）
  want.sort((a, b) => Math.abs(a - here) - Math.abs(b - here));
  /* 拭くところが無くなったら番台へ帰る（作者指定）。
     番台のある部屋に居るならここでは何もしない＝いつもどおり持ち場へ戻る */
  const b = bandai();
  const deskF = b ? (b.f | 0) : AR.LOBBY;
  const to = want.length ? want[0] : (here === deskF ? -1 : deskF);
  if (to < 0) return false;
  // 部屋の移りかたは客と同じ＝**廊下を通って歩く**（startTransit / finishHop）
  if (!startTransit(w, to)) return false;
  w.task = 'ch2go'; w.target = null;
  return true;
}
/* 戸まで歩き切ったら、隣の部屋へ移す。廊下で乗り換えるので、2本ぶん歩く */
function stepRoam(w, dt) {
  if (!stepMove(w, dt)) return;
  if (finishHop(w)) w.task = null;        // 着いた
}

/* ============ 駐車場 ============
   国道沿いの店なので、**停められる台数が客数の上限**になる（第1章の銭湯には無かった軸）。

   ・**砂利のままでも停められる**（作者指定）。ただし白線が引けないので効率が悪く、
     雨の日は泥はねで満足度が落ちる
   ・舗装して駐車マスを引くと、同じ面積で停められる台数が増える
   ・駐車場も駐輪場も無い、ということは起きない（敷地がそのまま駐車場なので）
   ・大型車スペースが無いとトラック運転手は来ない／EV充電器が無いと電気自動車の客は来ない
     （サウナの作り分けと同じ「無いと来ない」の考え方）                                   */

/* その設備が、舗装された床の上に置かれているか（雨の日の泥はね判定に使う） */
function onPaved(e) {
  const d = EQ[e.id];
  for (let x = e.x; x < e.x + ew(e); x++)
    for (let y = e.y; y < e.y + eh(e); y++)
      if (!isPaved(x, y)) return false;
  return true;
}
/* いま停められる台数。砂利の敷地ぶん（parkBase）＋置いた駐車マスぶん */
function parkCapacity() {
  const back = G.actF;
  applyArea(AR.LOBBY, true);
  let cars = CONF.parkBase || 0;                 // 砂利のままでも、これだけは停まれる
  for (const e of G.equip) {
    if ((e.f | 0) !== AR.LOBBY || e.cond <= 0) continue;
    if (e.id === 'p2_slot') cars += CONF.parkPerSlot;
    if (e.id === 'p2_big') cars += 3;   // 大型車スペース1組で3台（作者指定）
  }
  applyArea(back, true);
  return cars;
}
/* 駐輪場があるか（近所の年配客は自転車で来る） */
function hasBicycle() { return G.equip.some(e => e.id === 'p2_bicycle' && e.cond > 0); }
/* 外灯の数（暗いと女性客が夜に来ない） */
function lightCount() { return G.equip.filter(e => e.id === 'p2_light' && e.cond > 0).length; }

/* その日の客数を、駐車場の状況で決め直す */
function guestAdjust(n) {
  // 桑田が仲間を連れてきた（最初のミッションを全部クリア）＝毎日の客足が太る
  n += (chHook('kuwataGuests') || 0);
  const cars = parkCapacity();
  // 車で来られる人数の上限。1台に平均1.4人乗ってくる
  const byCar = Math.floor(cars * 1.4);
  // 歩いて来られる近所の人＋自転車で来る人
  const onFoot = 4 + (hasBicycle() ? 6 : 0);
  const capacity = byCar + onFoot;
  G.parkFullLost = Math.max(0, n - capacity);
  if (n <= capacity) return n;
  // 停められないぶんは、そもそも来ない（入口の前で素通りする）
  return capacity;
}

/* 日報に出す「停められずに素通りした客」の一枚（week2 の dayReportExtra から）。

   ⚠ **これが無い間、第2章でいちばん効く梃子が画面のどこにも出ていなかった。**
   砂利の駐車場は20台＝1日32人で頭打ち。その裏で毎日**97人**が入口を素通りしていても、
   日報は「客32人・満足度81・評判40」と健やかな顔をしていた。
   桑田が仲間を12人連れてきても、客数は32のまま1人も増えない＝
   **ご褒美が丸ごと駐車場に飲まれていた。**                                   */
function parkLostHtml() {
  const lost = G.parkFullLost | 0;
  if (!lost) return '';
  const cars = parkCapacity();
  return `<div class="rep-park"><b>🚗 停められずに帰った</b>
    <div class="bill-row"><span>入口まで来て、素通りした客</span>
      <span class="yen">${lost}人</span></div>
    <div class="bill-note">いまの駐車場は${cars}台＝1日${Math.floor(cars * 1.4) + 4 + (hasBicycle() ? 6 : 0)}人が上限。
      舗装して白線を引けば、同じ広さでも停められる台数が増える</div></div>`;
}

/* その客が、そもそも来られるか（設備が無いと来ない客がいる） */
function canVisit(typeKey) {
  const t = TYPES[typeKey] || {};
  if (t.needs === 'driver') return G.equip.some(e => e.id === 'p2_big' && e.cond > 0);
  if (t.needs === 'ev')     return G.equip.some(e => e.id === 'p2_ev' && e.cond > 0);
  /* 自分の入る風呂が開いていなければ、そもそも来ない（作者指定）。
     **女湯にスタッフを置いていない日は、女性客が一人も来ない。** */
  if (!areaOpen(t.sex === 'f' ? AR.ONNA : AR.OTOKO)) return false;
  return true;
}

/* ============================================================
   開業フロー（CHAPTER2.md §4-2〜4-4）
   ------------------------------------------------------------
   第1章は「ボロ銭湯に足していく」ゲームだった。第2章は逆で、
   **処分費のかかるものが最初から床に居座っている**ところから始まる。

     ① 物件の取得   … 買った時点で払い済み（¥4,000,000）
     ② 残置物の処理 … 【撤去／売却／残す】をひとつずつ決める
     ③ 基礎工事     … 防水打ち直し・配管更新・釜の部品交換（¥3,000,000）
                       これが済むまで浴室に設備を置けない
     ④ 開業         … 残置物が全部決まったら、店を開けられる

   ③を後回しにして、屋外にテントサウナだけ張って開ける逃げ道は残してある。
   （金が尽きたときの最後の手 ＝ §8-2）                                    */

function newCh2() {
  return {
    bukken: false,      // 物件の取得を払ったか
    kiso: false,        // 基礎工事が済んだか
    opened: false,      // もう店を開けたか（開業準備の画面を出すのは開ける前だけ）
    zanchi: {},         // 残置物ごとの決着 { id: 'gone' | 'sold' | 'keep' }
    menu: [],           // いま出しているメニュー（枠のぶんだけ選ぶ）
  };
}

/* まだ決着していない残置物。
   **開業の関門ではない**（作者指定）。前の持ち主が置いていったものは、そこに在るだけだ。
   売るか・捨てるか・使うかは、遊びながら決めればいい＝**期限も、順番もない。**
   決めないまま開業してもよく、一年経ってから売ってもいい。

   男湯と女湯に同じものが1つずつあっても、別々の1件として数える  */
function zanchiPending() {
  if (!G.ch2) return [];
  return G.equip.filter(e => EQ[e.id] && EQ[e.id].zanchi && !e.keep);
}
function zanchiLeft() { return zanchiPending().length > 0; }
/* その1台が残置物で、まだ決めていないか（設備をタップした時の判定） */
function isPendingZanchi(it) {
  return !!(G.ch2 && it && EQ[it.id] && EQ[it.id].zanchi && !it.keep);
}

/* 残置物を1つ決める。'gone'＝撤去（金が出る）／'sold'＝売却（金が入る）／'keep'＝残す */
function decideZanchi(it, how) {
  if (!isPendingZanchi(it)) return;
  const def = EQ[it.id], z = def.zanchi;
  if (how === 'gone' || how === 'sold') {
    const amount = (how === 'sold' ? z.sell : -z.cost);
    if (amount < 0 && G.cash < -amount) { toast('お金が足りない'); return; }
    G.cash += amount;
    // 盤面から消す＝床が空く。ここが第2章の「引き算」の手触り
    const i = G.equip.indexOf(it);
    if (i >= 0) G.equip.splice(i, 1);
    toast(how === 'sold' ? `${def.name}を売った（+¥${amount.toLocaleString()}）`
                         : `${def.name}を撤去した（−¥${(-amount).toLocaleString()}）`);
    log(how === 'sold' ? `💸 ${def.name}を売った（+¥${amount.toLocaleString()}）`
                       : `🗑 ${def.name}を撤去した（−¥${(-amount).toLocaleString()}）`);
  } else {
    it.keep = true;                       // 残す＝床を食い続ける。決着はした
    toast(`${def.name}は残した`);
    log(`✋ ${def.name}は残した。${z.keep}`);
  }
  deselect();
  refreshDead();
  renderKaigyo();
  saveGame();
}

/* ============ ゴミ・瓦礫 ============ */
/* ⚠ 制作中だけゴミを湧かせない（作者指定）＝
   毎回35個の残置物を運び出してからでないと中身を触れないのは、作りながら確かめるには重すぎる。
   **開発サーバーで開いたときだけ**空にするので、配信するアプリでは今までどおり35個から始まる。

   ＝＝ 出す前に必ずここを見直すこと ＝＝
   ゴミ処理は第2章の掴みそのもの（「ボロい箱を作り替えていく章」）なので、
   本番から消してはいけない。消えていないことは、iOS/Android のビルドで実際に確かめる。 */
function devEmptyStart() {
  return location.protocol === 'http:'
    && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    && location.port !== '';
}
function initJunk() {
  if (devEmptyStart()) return [];
  return (CONF.initJunk || []).map(([kind, x, y, f]) => ({ kind, x, y, f }));
}
function junkLeft() { return G.junk ? G.junk.length : 0; }
function junkName(j) { const k = (CONF.junkKinds || {})[j.kind]; return k ? k.name : 'ゴミ'; }

/* ============ 開業の最低条件 ============
   1日目に各エリアを回らせて、やることを指示する（作者指定）。
   **最低限スタートできる状態を強制的に作らせる**＝これが揃うまで【この店を開ける】は押せない。

   浴室は基礎工事が済むまで何も置けないので、工事前の男湯・女湯は「まだ数えない」。
   先に工事を発注させてから、順に指差していく。                            */
function reqHas(f, r) {
  return G.equip.filter(e => {
    if ((e.f | 0) !== (f | 0)) return false;
    const d = EQ[e.id]; if (!d || d.cat !== r.cat) return false;
    return !r.tab || d.tab === r.tab;
  }).length;
}
/* その区画に残っている宿題（満たしていない条件の配列） */
function openReqLeft(f) {
  const row = (CONF.openReq || []).find(r => r.f === (f | 0));
  if (!row) return [];
  // 浴室は工事が済むまで置けない＝まだ数えない
  const a = areaDef(f);
  if (a && a.sex && !G.ch2.kiso) return [];
  return row.need.filter(r => reqHas(f, r) < r.n);
}
/* 館内ぜんぶで、まだ足りていないもの。開業ボタンの関門はこれ */
function openReqAll() {
  return (CONF.openReq || [])
    .map(r => ({ f: r.f, left: openReqLeft(r.f) }))
    .filter(x => x.left.length);
}
function openReqOK() { return !openReqAll().length && !junkLeft() && !!G.ch2.kiso; }
/* 館内案内図の部屋に出す札（game.js の areaStatus から呼ばれる）。
   **見ていない部屋で何も起きていないことに気づけない**のが5部屋ある章の弱点なので、
   地図の上で、宿題の残っている部屋に印を立てる                              */
function areaTodo(f) {
  if (!G.ch2) return null;
  const left = openReqLeft(f);
  return left.length ? `🔨 あと${left.length}` : null;
}

/* 基礎工事を発注する */
function orderKiso() {
  if (G.ch2.kiso) return;
  if (junkLeft()) { toast('先にゴミと瓦礫を片付けよう'); return; }
  const price = CONF.kisoKouji;
  if (G.cash < price) { toast('お金が足りない'); return; }
  G.cash -= price;
  G.ch2.kiso = true;
  /* 釜が生きているから、この額で済んでいる。
     二年間ボイラーを売って歩いた男だけが、それを見抜けた */
  toast('基礎工事が済んだ。浴室に火が入る');
  renderKaigyo();
  saveGame();
}

/* 店を開ける（開業準備の画面を畳んで、ふつうの準備画面に戻る） */
function doOpen() {
  if (junkLeft()) { toast('ゴミと瓦礫が残っている'); return; }
  // 残置物は関門にしない（作者指定）＝決めないまま開けてよい
  G.ch2.opened = true;
  G.ch2.openedDay = G.day;      // 公庫の追加融資は「開業から何日か」を見る
  $('kaigyoModal').classList.add('hidden');
  syncKaigyoBtn();
  saveGame();
}

/* いま入口から歩いて行けるマスを数える（間仕切りの引き戸もちゃんと通る）。
   block を渡すと、そこに物が在るものとして数える＝「置いたらどうなるか」が分かる */
function reachCount(block) {
  const inBlock = (x, y) => !!block && x >= block.x && x < block.x + block.w
                                    && y >= block.y && y < block.y + block.h;
  const ent = CONF.entrance;
  if (inBlock(ent.x, ent.y)) return -1;                     // 戸口そのものを塞いだ
  const seen = new Set([ent.x + ',' + ent.y]);
  const q = [ent];
  while (q.length) {
    const t = q.shift();
    for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = t.x + d[0], y = t.y + d[1], k = x + ',' + y;
      if (seen.has(k) || x < 0 || y < 0 || x >= CONF.W || y >= CONF.H) continue;
      if (inBlock(x, y) || !walkable(x, y) || crossBlocked(x, y, t.x, t.y)) continue;
      seen.add(k); q.push({ x, y });
    }
  }
  return seen.size;
}
/* そこに置くと、部屋のどこかへ行けなくなるか。なるなら理由を返す */
function wouldSeal(id, gx, gy) {
  const w = ew(id), h = eh(id);
  const before = reachCount(null);
  const after = reachCount({ x: gx, y: gy, w, h });
  if (after < 0) return '入口を塞いでしまいます';
  // 置いたぶんのマスは当然減る。それ以上に減ったら、その先が切り離されている
  const lost = before - after - w * h;
  if (lost > 0) return `ここに置くと、${lost}マスに行けなくなります`;
  return null;
}

/* 浴室に置けるかの関門。基礎工事が済むまで、浴室だけ手が付けられない。
   屋外の外気浴ゾーン・脱衣所・食堂・ロビー・休憩スペースは工事なしで使える  */
function placeBlock(id, gx, gy) {
  if (!G.ch2) return null;
  /* 男湯だけ／女湯だけに置けるもの（作者指定）。
     左右で別の作りになる＝女湯を手抜きすると、女性客が二度と来ない */
  const only = EQ[id] && EQ[id].sexOnly;
  if (only) {
    const a = areaDef(G.actF);
    if (!a || a.sex !== only) return `${EQ[id].name}は${only === 'm' ? '男湯' : '女湯'}にしか置けません`;
  }
  // ゴミ・瓦礫の上には置けない（人は上を歩けるが、床としては使えない）
  const w = ew(id), h = eh(id);
  for (const j of (G.junk || [])) {
    if ((j.f | 0) !== (G.actF | 0)) continue;
    if (j.x >= gx && j.x < gx + w && j.y >= gy && j.y < gy + h)
      return `${junkName(j)}をどけてから置いてください`;
  }
  /* 厨房は一個の物になったので、「工事した床の上にしか置けない」という縛りは廃止した。
     食堂は1部屋しかないので、置けるかどうかは**空いているか**だけで決まる     */
  if (id === 'k2_kitchen' && hasKitchen()) return '厨房は一つで足ります';
  /* ⚠ **戸口を塞ぐ置きかたを、置く前に止める。**
     浴室の出入口は下辺の1マスきりで、そこから踏み出せるのも1マスだけ。
     そこを塞ぐと部屋がまるごと「入れない部屋」になり、置いた設備も、
     もとから在った設備も、全部「道が通っていない飾り」になる。
     **絵は正しく描かれ、日報も出るので、画面を見ても分からない**（実際に
     錆びたロッカーが男湯の戸口に乗っていて、開業から誰も湯に入れていなかった）  */
  const seal = wouldSeal(id, gx, gy);
  if (seal) return seal;
  if (G.ch2.kiso) return null;
  const oy = CONF.outdoorY || 0;
  if (!oy) return null;                                  // 浴室のない区画（ロビー等）は関係ない
  if (gy < oy) return null;                              // 屋外の外気浴ゾーンは工事前でも使える
  if (gy >= CONF.divideY) return null;                   // 脱衣所も使える
  return '基礎工事（防水・配管・釜）が済んでいません';
}

/* 開業前の初期の汚れ。二年ぶん埃をかぶっている＝館内のあちこちに散っている */
function initDirts() {
  return [
    { x: 4, y: 6, f: AR.LOBBY }, { x: 9, y: 8, f: AR.LOBBY },
    { x: 6, y: 6, f: AR.KYUKEI }, { x: 10, y: 8, f: AR.KYUKEI },
    { x: 7, y: 7, f: AR.SHOKUDO }, { x: 3, y: 9, f: AR.SHOKUDO },
    { x: 3, y: 6, f: AR.OTOKO }, { x: 6, y: 9, f: AR.OTOKO }, { x: 9, y: 12, f: AR.OTOKO },
    { x: 3, y: 6, f: AR.ONNA }, { x: 6, y: 9, f: AR.ONNA }, { x: 9, y: 12, f: AR.ONNA },
  ];
}

/* ニューゲームのとき、物件の代金を払う。
   継ぐのではなく**買う**。ここが「独立」の芯（CHAPTER2.md §0-2） */
function onNewGame() {
  G.ch2 = newCh2();
  /* **物件の取得と基礎工事は、始まった時点で終わっている**（作者指定）。
     金はもう払った（startCash がその残り＝¥5,000,000）ので、ここでは引かない。
     ゲームが始まるのは「箱と、借金と、五百万」が手元にある朝から。

     そして**開業の関門も無い**（作者指定）＝【開業準備】のボタンは廃止した。
     初日から【▶ 営業開始】が押せる。**ゴミだらけのまま開けてもいい。**
     どうなるかは、その日の客が教えてくれる                              */
  G.ch2.bukken = true;
  G.ch2.kiso = true;
  G.ch2.opened = true;
  G.ch2.openedDay = 1;
  // 主人公が事前に求人広告を出して集めた5人。開業前から各部屋に立っている（作者指定）
  G.roster = initRoster();
}

/* 準備中の案内。第1章の「ここが夕凪湯だ」は第1章の台詞なので、第2章は自前で出す。
   空文字を返すと、第1章と共通の案内（荒れた日・故障・要望）にそのまま流れる */
/* ============ 上の一行（作者指定）============
   「いま何をすればいいか」を、**一行だけ**上に出す。
   下のヒント帯は長くなりがちで、毎回同じことを言って画面を食っていた。
   数えるもの（あと何個・あと何件）は、こちらに集める。                    */
/* 上に出す優先順位。**いちばん手前にある「やること」をひとつだけ。**
   開業前は開業までの段取り、開業後はいま受けている注文（ミッション）。
   ここが今後のミッションの置き場になる（作者指定）＝新しい依頼人を足すときは、
   下の chHook('topTip') の列に一行足せばいい                              */
function topTip() {
  if (!G.ch2) return '';
  /* ① 前の店のゴミ。開けてはいけない訳ではないが、**転がっていれば客は見る**。
     営業中は出さない（そのあいだは拾いに行けない） */
  if (G.phase !== 'biz') {
    const jn = junkLeft();
    if (jn) return `🗑 ゴミを片付けよう。あと <b>${jn}個</b>`;
    // ② 売り払って足りなくなった設備があれば、それ
    const rest = openReqAll();
    if (rest.length) {
      const n = rest.reduce((s, x) => s + x.left.length, 0);
      return `🔨 足りない設備がある。あと <b>${n}件</b>（${rest.map(x => (areaDef(x.f) || {}).name).join('・')}）`;
    }
  }
  // ③ いま受けている注文（達成していれば「できている」に変わる）
  return chHook('missionTip') || '';
}

/* 下のヒント帯。上の一行に移したぶんは、ここでは黙る（作者指定＝長い文を毎回出さない）。
   ここに残すのは「その場でしか言えないこと」だけ                          */
function prepHint() {
  if (!G.ch2) return '';
  // ゴミが残っているうちは、上の一行が全部言っている
  if (junkLeft()) return '';
  // いま立っている部屋に足りないものだけ、その場で名指しする
  const f = G.viewF >= 0 ? G.viewF : G.actF;
  const here = openReqLeft(f);
  if (here.length) return `🔨 ここに要る：${here.map(r => `<b>${r.label}</b>`).join('・')}`;
  if (G.day === 1 && !G.flags.tut)
    return `♨ <b>${G.name}、今日から店を開ける。</b>設備を見て、【▶ 営業開始】`;
  return '';
}

/* ============ 開業準備の画面 ============ */
function openKaigyo() {
  renderKaigyo();
  $('kaigyoModal').classList.remove('hidden');
}
function kgYen(n) { return '¥' + Math.round(n).toLocaleString(); }

function renderKaigyo() {
  const box = $('kaigyoBody'); if (!box) return;
  const rows = [];

  rows.push(`<div class="kg-step done"><b>① 物件の取得と基礎工事</b>
    <span>${kgYen(CONF.bukkenPrice + CONF.kisoKouji)}　✔ 支払い済み</span>
    <p class="kg-note">二年売れなかった箱を、言い値で買った。防水を打ち直し、配管を替え、釜に部品を入れた。<br>
    <b>釜と排水が生きていたから、この額で済んだ。</b>二年ボイラーを売って歩いた男だけが、それを見抜けた。<br>
    <span class="kg-keep">ここから先は、全部あんたの持ち物だ</span></p></div>`);

  /* ②はマップ上でやる仕事なので、ここは進み具合を出すだけ（作者指定）。
     ボタンを並べて済ませてしまうと、店が荒れているという事実が画面に一度も出てこない */
  const jn = junkLeft();
  const junkBy = {};
  for (const j of (G.junk || [])) junkBy[j.f | 0] = (junkBy[j.f | 0] || 0) + 1;
  const areaNames = (CONF.areas || []).map(a => a.name);
  const junkWhere = Object.keys(junkBy).map(f => `${areaNames[f] || ''} ${junkBy[f]}`).join(' ／ ');

  rows.push(`<div class="kg-step${jn ? '' : ' done'}"><b>② ゴミ・瓦礫の片付け</b>
    <span>${jn ? `残り ${jn} 個` : '✔ 片付いた'}</span>
    <p class="kg-note">${jn
      ? 'マップの<b>ゴミをタップ</b>すると、主人公がそこまで歩いて行って担ぎ出す。金はかからない。<br>' +
        '<span class="kg-keep">' + junkWhere + '</span>'
      : '二年ぶんの埃とゴミを、全部自分の手で運び出した。'}</p></div>`);

  const kisoDone = true;   // 基礎工事は始まった時点で済んでいる（作者指定）
  const ready = !jn;

  /* ④ 部屋ごとの宿題。**見ていない部屋のことは、言われないと気づけない。**
     部屋名を押せばその部屋へ飛ぶ＝指差してから、そこへ連れて行く */
  const todo = openReqAll();
  const reqRows = (CONF.openReq || []).map(r => {
    const nm = areaNames[r.f] || '';
    const left = openReqLeft(r.f);
    const a = areaDef(r.f);
    const locked = a && a.sex && !kisoDone;
    const body = locked ? '<span class="kg-keep">基礎工事が済むまで置けない</span>'
      : left.length ? left.map(x => `<b>${x.label}</b>×${x.n}`).join('　')
      : '<span class="kg-keep">✔ そろった</span>';
    return `<div class="kg-item kg-go" data-f="${r.f}"><b>${nm}</b>
      <span>${locked ? '—' : left.length ? `あと ${left.length}` : '✔'}</span>
      <p class="kg-note">${body}</p></div>`;
  });
  rows.push(`<div class="kg-step${todo.length ? '' : ' done'}"><b>③ 開けるための最低限</b>
    <span>${todo.length ? `あと ${todo.reduce((s, t) => s + t.left.length, 0)} 件` : '✔ そろった'}</span>
    <p class="kg-note">風呂屋が風呂屋であるための、いちばん少ない形。<br>
    <b>部屋の名前を押すと、その部屋へ行ける。</b>下のカタログから買って置こう。<br>
    <span class="kg-keep">休憩スペースと食堂は、無くても開けられる</span></p>
    ${reqRows.join('')}</div>`);

  const canOpenNow = ready && openReqOK();
  rows.push(`<div class="kg-step"><b>④ 開業</b>
    <p class="kg-note">ゴミを出し切って、上の最低限がそろえば、この店を開けられる。<br>
    あとは足していけばいい。<b>豪華である必要はない。</b></p>
    <button id="btnDoOpen" class="big-btn"${canOpenNow ? '' : ' disabled'}>この店を開ける</button></div>`);

  /* 前の持ち主が置いていったもの。**関門ではない**（作者指定）ので、
     ここには件数も一覧も出さない。マップに転がったまま、遊びながら決めればいい。
     決めないまま開業してもいいし、一年経ってから売ってもいい */
  const zn = zanchiPending();
  if (zn.length)
    rows.push(`<p class="kg-cash" style="color:#9a8a72;font-size:11px">
      前の持ち主の置き土産が ${zn.length}件 残っている（急がなくていい。マップでタップすれば決められる）</p>`);

  rows.push(`<p class="kg-cash">手持ち ${kgYen(G.cash)}　／　借入 ${kgYen(G.debt)}</p>`);

  /* 準備中は時計が止まっている（第1章と同じ）ので、日付はここで自分で送る。
     開業までの猶予は「7日」ではなく「7回ぶんの作業日」＝押した回数で減る */
  const left = (CONF.openDays || 7) - (G.ch2.prepDay || 1) + 1;
  rows.push(`<button id="btnPrepDayEnd" class="big-btn sub">🌙 今日は終わり${
    left > 0 ? `（開業まであと${left}日）` : '（予定日は過ぎている）'}</button>`);

  box.innerHTML = rows.join('');

  const bk = $('btnKiso'); if (bk) bk.onclick = orderKiso;
  const bo = $('btnDoOpen'); if (bo) bo.onclick = doOpen;
  const bd = $('btnPrepDayEnd'); if (bd) bd.onclick = endPrepDay;
  // 部屋の名前を押す＝ボードを畳んで、その部屋へ行く
  box.querySelectorAll('.kg-go').forEach(el => {
    el.onclick = () => {
      $('kaigyoModal').classList.add('hidden');
      enterAreaScreen(+el.dataset.f);
    };
  });
}

/* ============ その日の仕込み ============
   第1章の「今日は誰が来るか」（来訪者・みかじめ・サラ金の集金）に相当するもの。
   第2章は寒川・東條・配信者などが来るが、まだ台本が入っていないので何も仕込まない。 */
function scheduleDay() {
  /* 桑田は、注文が片付いていようが片付いていまいが顔を出す。
     この爺さんは忘れないし、催促を遠慮もしない（1日1回・営業中のどこかで） */
  if (G.ch2 && G.ch2.opened && G.ch2.kuwata && G.ch2.kuwata.met && !G.ch2.kuwata.ally)
    G.ch2.kuwataAt = rand(90, 540);
  else G.ch2 && (G.ch2.kuwataAt = null);
}
/* 営業中の見張り（game.js の stepBiz から毎フレーム）。時刻が来たら番台の前に立つ */
function bizTick() {
  const c = G.ch2;
  if (!c || !c.kuwataAt || G.phase !== 'biz') return;
  if (G.minutes < c.kuwataAt) return;
  c.kuwataAt = null;
  chHook('kuwataVisit');
}

/* ============ 登録 ============ */
registerChapter2Hooks({
  routeTo,
  onStaffPost,
  staffAreaNote,
  stepTransit,
  scheduleDay,
  bizTick,
  guestAdjust,
  canVisit,
  onNewGame,
  shopCats,
  roamPlayer,
  stepRoam,
  legacyCh2: () => ({ bukken: true, kiso: true, opened: true, zanchi: {} }),
  initDirts,
  initJunk,
  junkName,
  isPendingZanchi,
  decideZanchi,
  areaTodo,
  placeBlock,
  openKaigyo,
  prepHint,
  topTip,
  shopTabRender,
  shopItemOK,
  useDone,
  /* useDur / useStart / staffJob は shokudo2.js が登録する。
     **ここに名前だけ残すと、まだ読み込まれていない関数を参照して
     この registerChapter2Hooks 呼び出しごと例外になり、フックが全部消える。** */
  areaOpen,
  areaClosedWhy,
  areaUnmanned,
  arrived: ticketConfusion,
  dirtMul,
  staffAreaOf,
  canStaffArea,
  initRoster,
});
