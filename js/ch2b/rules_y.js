'use strict';

/* ============================================================
   第2章「ととのい市編」のふるまい
   ------------------------------------------------------------
   game.js は chHook('名前', …) で、その章だけのふるまいを呼ぶ。
   何も登録しなければ第1章（＝game.js の従来のコード）のまま動くので、
   **この章で変えたいところだけ**をここに書く。

   ・名前はすべて y から始める（保留中の候補1 js/ch2/rules2.js とぶつけないため）
   ・第1章のコードは1行も書き換えていない
   ============================================================ */

/* ============ どのフロアに、何があるか ============
   客が「次はサウナ」と決めたとき、いま居る階に無ければ、この表を見て階を移る。
   増築すると行き先が増える（女湯・ラウンジ・レストラン…）ので、
   **表は固定ではなく、そのとき建っている階から引く**                     */
function yAreaOfCat(cat) {
  switch (cat) {
    case 'sauna': case 'mizu': case 'furo': case 'wash':
    case 'locker': case 'datsui': return [AY.OTOKO, AY.ONNA];   // 浴室（客の性別のほう）
    /* 休む場所は浴室だけではない。**自分の浴室 → 屋上の外気浴 → 4Fラウンジ**の順。
       屋上を先に見るのは、水風呂のあとに風へ出るのがいちばん本筋だから */
    case 'rest':   return [AY.OTOKO, AY.ONNA, AY.ROOF, AY.LOUNGE];
    case 'shoku':  return [AY.SHOKUDO];
    /* マッサージ機は**種類ではなく設備そのもの**を指す予定（game.js の isMassage）。
       この章は1Fフロントの機械と4Fラウンジの椅子の2つ。ラウンジを先に見る＝
       湯上がりに館内着でくつろぐ流れに乗る                                 */
    case 'massage': return [AY.LOUNGE, AY.FRONT];
    /* 説明文で値段を約束している寄り道（uriage_y.js が課金する）。
       予定に足すのは yPlanExtra、設備の探し方は CONF_Y.catFind          */
    case 'akasuri': return [AY.OTOKO, AY.ONNA];   // 裸で受けるので浴室
    case 'lounge':  return [AY.LOUNGE];           // 館内着でくつろぐ4F
    case 'capsule': return [AY.CAPSULE];          // 泊まる6F
    case 'front':  case 'goods': case 'sys': return [AY.FRONT];
    default: return null;
  }
}
/* いま建っている階か（CONF.areas に入っていれば建っている） */
function yBuilt(f) { return (CONF.areas || []).length > (f | 0); }
/* その客が使う浴室（男湯 or 女湯） */
function yBathOf(c) { return (c.type && c.type.sex === 'f') ? AY.ONNA : AY.OTOKO; }
/* その階に、そのカテゴリの使える設備があるか */
function yCatIn(cat, f) {
  /* 探し方は game.js の catMatch に合わせる（'massage' は設備そのもの、
     'akasuri' は役目、'lounge' は階つき…＝ここで別の引き方をすると、
     「行き先はあるのに、着いたら設備が見つからない」で客が固まる） */
  const hit = (typeof catMatch === 'function') ? catMatch(cat) : (e => EQ[e.id].cat === cat);
  return G.equip.some(e => (e.f | 0) === (f | 0) && EQ[e.id]
    && hit(e) && (EQ[e.id].cap === 0 || e.cond > 0));
}
/* そのカテゴリが、その客にとってどの階にあるか。
   **いま居る階にそれがあるなら、わざわざ階を移らない**（エレベーターが無駄に混む） */
function yFloorForCat(c, cat) {
  const list = yAreaOfCat(cat);
  if (!list) return null;
  /* **深夜は、深夜バイトを置いた階しか開いていない**（yFloorOpenNow）。
     ここを通さないと、誰も立っていない浴室に客が上がっていく             */
  const ok = f => yBuilt(f) && yCatIn(cat, f) && yFloorOpenNow(f);
  if (yCatIn(cat, c.f | 0) && yFloorOpenNow(c.f | 0)) return c.f | 0;
  /* ⚠ **ここで「浴室のどちらか」だけを返していた**（2026-08-06 発見）。
     `list[0] === AY.OTOKO` という条件が `'rest'` にも一致してしまうので、
     ととのい・休憩の行き先が**必ず浴室になり、for ループに一度も到達しなかった**。
     ＝**4F休憩ラウンジ（¥1,200万・設備19品）と屋上外気浴（¥800万）へ、
        客が一人も上がっていなかった。**建てても飾りだった。

     直し方：一覧を順に見て、**よその性別の浴室だけを飛ばす。**
     浴室系（裸で使うもの）は一覧が [男湯, 女湯] なので、これまでと同じ結果になる */
  for (const f of list) {
    if ((f === AY.OTOKO || f === AY.ONNA) && f !== yBathOf(c)) continue;
    if (ok(f)) return f;
  }
  return null;
}

/* ============================================================
   深夜営業（作者決定 2026-08-05）
   ============================================================
   **22時〜翌10時。休憩ラウンジを建てて初めて解放される。**

     ・**主人公と妻は22時で帰る。** 深夜は深夜バイトだけで回る
       ＝体力ではなく**金で夜を買う**。体力の式には一切触らない
     ・**深夜バイトを置いた階だけ**が開く。ラウンジだけ開いて浴室は閉まっている夜もある
     ・1階に深夜バイトが立っていない夜は開けられない（**会計する人が居ない**）
     ・深夜料金 +¥500／深夜バイトの賃金 +25%（法定どおり）

   翌10時までにしてあるのは、のちにカプセルを建てたとき、
   **10時をチェックアウトにすればそのまま噛み合う**から（作者の逆算）。   */

/* 深夜が始まる時刻／終わる時刻（24を超える数え方＝同じ一日の続き） */
function yNightStart() { return (CONF.nightOpen && CONF.nightOpen.openHour) || 22; }
function yNightEnd()   { return (CONF.nightOpen && CONF.nightOpen.closeHour) || 34; }
/* 休憩ラウンジが建っているか＝深夜営業の鍵 */
function yNightUnlocked() { return yBuilt(AY.LOUNGE); }
/* その階に、深夜に立てるバイトが居るか */
function yNightStaffOn(f) {
  return (G.roster || []).some(e => e.night && e.f != null && (e.f | 0) === (f | 0));
}
/* 開けられない理由（空文字＝開けられる）。運営メニューの鍵の文言になる */
function yNightLockWhy() {
  if (!yNightUnlocked()) return '休憩ラウンジがまだ無い。客が夜を過ごせる場所が要る';
  if (!(G.roster || []).some(e => e.night)) return '深夜に立てるバイトがいない';
  if (!yNightStaffOn(AY.FRONT)) return '1階に深夜バイトがいない。会計する人がいない夜は開けられない';
  return '';
}
function yNightNote() {
  const off = (CONF.areas || []).map((a, f) => (f !== AY.FRONT && !yNightStaffOn(f)) ? a.short : null).filter(Boolean);
  return '主人公と' + WIFE_Y.name + 'は' + yNightStart() + '時で帰る。<b>深夜も全ての階が開く</b>'
       + (off.length
          ? '<br><b class="broken-note">無人になる階：' + off.join('・') + '</b>'
            + '<span class="opt-sub">（客は入れるが、朝まで誰も拭かない＝汚れが'
            + Math.round((CONF.dirtNightMul || 3.5) * 10) / 10 + '倍で溜まる）</span>'
          : '<br>全ての階に深夜バイトが立っている');
}
/* いま深夜帯か（G.minutes は開店からの分。24を超えてもそのまま数える） */
function yIsNight() {
  if (typeof nightOpenOn !== 'function' || !nightOpenOn()) return false;
  return (yOpenHour() + G.minutes / 60) >= yNightStart();
}
/* ============================================================
   深夜の無人フロア（作者指定 2026-08-06）
   ------------------------------------------------------------
   **以前は「深夜バイトを置いた階しか開かない」だった。それが崖になっていた。**
   実測：深夜に来た客が、入館料と深夜割増を払ったあと、行くべき階が一つも開いて
   いないので、そのまま出口へ歩いて帰っていた——**1日に107人。**
   プレイヤーから見ると、日報に「会計240人」と出るだけで、
   107人が風呂にも入らず帰ったことも、その理由も、どこにも出ない。
   ＝**黙って金を取る店**になっていた。

   いまは**深夜も全ての階が開く。**代わりに、人が立っていない階は
     ・汚れが `dirtNightMul` 倍で溜まる
     ・誰も拭かないので、朝までそのまま残る
   ＝「人を置かずに夜を回す」ことは**できるが高くつく**。崖ではなく坂になった。
   1階（会計する人）だけは、いまも深夜バイトが必須（yNightLockWhy）        */
function yFloorOpenNow(f) { return true; }
/* 深夜、その階が無人か（案内図の⚠️と、汚れ倍率の両方がこれを見る） */
function yFloorUnmanned(f) {
  if (!yIsNight()) return false;
  return !yNightStaffOn(f);
}
/* 汚れやすさ（game.js の cleanFactor が区画ごとに聞いてくる）。
   ・深夜の無人 … dirtNightMul（既定3.5倍）。**誰も拭かないので朝まで残る**
   ・昼の無人   … dirtEmptyMul（既定1.6倍）＝遅刻・持ち場を空けている部屋 */
function yDirtMul(f) {
  f = f | 0;
  /* 第1予選（清潔週）は汚れの進みが1.5倍。人が立っている階にも効く＝条件付き営業 */
  const q = (typeof yYosenNow === 'function') ? yYosenNow() : null;
  const battleMul = (q && q.theme === 'clean') ? 1.5 : 1;
  const manned = (G.staff || []).some(s => (s.f | 0) === f && !(s.lateT > 0))
              || (G.actF | 0) === f;                       // 主人公が立っている階は無人ではない
  if (manned) return battleMul;
  return battleMul * (yIsNight() ? (CONF.dirtNightMul || 3.5) : (CONF.dirtEmptyMul || 1.6));
}
/* ⚠ **汚れを、その設備のある階に落とす。**
   game.js の従来の道は reachableSet()／approachTiles() が「いま表示している区画」の
   盤面を読むので、別の階の設備を渡すと座標が噛み合わず**汚れが一つも落ちない**
   （実測：228人が風呂を使った一日で、床の汚れが0個）。
   ここでは盤面を切り替えずに、**その階の設備だけ**を見て置ける床を選ぶ。
   間仕切り越しかどうかまでは見ていない（汚れの落ちる場所なので、そこまでは要らない） */
function yDirtSpot(item) {
  const f = (item.f | 0);
  const a = (CONF.areas || [])[f] || {};
  const W = a.W || CONF.W, H = a.H || CONF.H;
  const eq = (G.equip || []).filter(e => (e.f | 0) === f);
  const busy = (x, y) => eq.some(e => x >= e.x && x < e.x + ew(e) && y >= e.y && y < e.y + eh(e));
  const w = ew(item), h = eh(item), out = [];
  for (let x = item.x - 1; x <= item.x + w; x++)
    for (let y = item.y - 1; y <= item.y + h; y++) {
      // 角は使わない（設備の縁に接している床だけ）
      if (((x === item.x - 1 || x === item.x + w) === (y === item.y - 1 || y === item.y + h))) continue;
      if (x < 1 || y < 1 || x > W - 2 || y > H - 2) continue;          // 外壁の内側だけ
      if (busy(x, y)) continue;
      if (G.dirts.some(d => d.x === x && d.y === y && (d.f | 0) === f)) continue;   // 1マスに1つ
      out.push({ x, y, f });
    }
  return out.length ? pick(out) : null;
}

/* 主人公が店に立つ時間（深夜まで開けても、22時で帰る） */
function yWorkHoursRange() { return [yOpenHour(), Math.min(yCloseHour(), yNightStart())]; }
/* その人がもう帰ったか。22時を過ぎたら、深夜バイト以外はみんな帰る（妻も） */
function yWorkerOff(s) {
  if (!yIsNight()) return false;
  return !(s && s.emp && s.emp.night);
}

registerChapter2Hooks({
  workHours: yWorkHoursRange,
  workerOff: yWorkerOff,
  nightLockWhy: yNightLockWhy,
  nightNote: yNightNote,
  dirtMul: yDirtMul,       // 無人の階は汚れが溜まる（深夜は3.5倍）
  dirtSpot: yDirtSpot,     // 汚れは、その設備のある階に落とす
});

/* ============ エレベーター ============
   **階と階のあいだは、この1基だけでつながっている**（作者指定）。
   廊下も階段も無い。客は各階の右下 2×2 のエレベーターまで歩き、
   扉の前で待ち、乗って、行き先の階の同じ場所から降りてくる。

   ・電気代は設備の run（毎日かかる）
   ・傷み・故障・修理業者は**第1章とまったく同じ仕組み**（設備として持たせてある）
   ・**壊れている間は上の階へ行けない**＝ビルが止まる                     */
/* その階のエレベーター（設備） */
function yElevOf(f) {
  return G.equip.find(e => e.id === 'y_elev' && (e.f | 0) === (f | 0));
}
/* 動いているか（壊れていたら動かない） */
function yElevOK(f) { const e = yElevOf(f); return !!(e && e.cond > 0); }
/* 扉の前に立つマス */
function yElevDoor(f) {
  const a = (CONF.areas || [])[f] || {};
  return a.elevDoor || { x: 12, y: 17 };
}
/* 乗っている時間（実秒）。離れた階ほど長くかかる */
function yRideTime(from, to) {
  const A = CONF.areas || [];
  const d = Math.abs(((A[to] || {}).lvl || 1) - ((A[from] || {}).lvl || 1));
  return 0.9 + d * 0.5;
}

/* ============ プレイヤーがEVを押す（作者指定 8/5）============
   **客と同じ順路でビルを見せる。** 押すたびに一つ上へ上がり、
   **上がもう建っていなければ1階へ戻る**＝押していれば全部の階を一周する。
   ・エレベーターが壊れている階では、当然どこへも行けない（ビルが止まる、を体で分かる）
   ・工事中の階はまだ CONF.areas に入っていない＝そこへは上がらない       */
function yEquipTap(it) {
  if (!it || it.id !== 'y_elev') return false;
  const cur = (G.viewF >= 0 ? G.viewF : G.actF) | 0;
  if (!yElevOK(cur)) { toast('エレベーターは止まっている…（修理を頼もう）'); return true; }
  let next = cur + 1;
  if (!yBuilt(next)) next = AY.FRONT;                       // 上がまだ無ければ、1階へ戻る
  if (next === cur) return true;                            // 上も下も無い＝1階だけの店
  Sfx.play('ui');
  enterAreaScreen(next);
  const a = (CONF.areas || [])[next] || {};
  toast('🛗 ' + (a.lvl ? a.lvl + 'F ' : '') + (a.short || a.name || ''));
  return true;
}
registerChapter2Hooks({ equipTap: yEquipTap });

/* 移動を始める（客でもバイトでも使える）。扉の前まで歩かせる */
function yStartTransit(e, goal) {
  const here = e.f | 0;
  if ((goal | 0) === here) return false;
  if (!yElevOK(here) || !yElevOK(goal | 0)) return false;   // 壊れている＝上がれない
  const t = yElevDoor(here);
  const cur = tileOf(e);
  const path = findPath(cur.x, cur.y, t.x, t.y);
  if (!path) return false;                                   // 扉まで行けない（物で塞がっている）
  e.moveGoal = goal | 0; e.path = path; e.yRide = 0;
  return true;
}
/* 客を別の階へ送り出す。true＝移動を始めたので、今回の予定選びは中断 */
function yRouteTo(c, cat) {
  const want = yFloorForCat(c, cat);
  if (want === null || want === (c.f | 0)) return false;
  if (!yStartTransit(c, want)) return false;
  /* 会計を済ませた客が「着替えに行く」ために階を移るときだけ、着いた先で
     そのまま脱衣所へ向かわせる                                          */
  c.yAfter = (cat === 'locker' && c.mode !== 'towel') ? 'lockerIn' : null;
  /* 状態の名前は game.js が見ている 'ch2Transit'（＝「章をまたぐ移動中」の意味）。
     ここを独自の名前にすると、game.js の switch に入らず客が固まる */
  c.state = 'ch2Transit';
  return true;
}
/* 扉の前に着いたら、箱を待って乗り、行き先の階で降りる */
function yStepTransit(c, dt) {
  if (!(c.yRide > 0)) {
    if (!stepMove(c, dt)) return;              // まだ扉まで歩いている
    c.yRide = yRideTime(c.f | 0, c.moveGoal | 0);   // 扉に着いた＝乗る
    return;
  }
  c.yRide -= dt;                               // 乗っている最中（箱の中なので描かない側でもよい）
  if (c.yRide > 0) return;
  const to = c.moveGoal | 0;
  const t = yElevDoor(to);
  c.f = to;                                    // 降りた
  c.px = t.x * T + T / 2; c.py = t.y * T + T / 2;
  c.path = null; c.moveGoal = null; c.yRide = 0;
  /* ⚠ **降りた階の地図に切り替えてから、次の道を引く。**
     ここは forEachArea が「乗る前の階」を CONF に載せている最中に走る。
     そのまま walkToExit を呼ぶと、**乗る前の階の玄関**（上の階＝EVの扉 (12,17)）へ
     向かう道を、降りた1階の盤面に引いてしまう＝これが
     「EVから左下へワープして帰らない」の正体（作者報告 8/8）。
     goLocker も同じ理由で、降りた階のロッカーを探せていなかった */
  const back = G.actF;
  applyArea(to, true);
  try {
    if (c.yAfter === 'lockerIn') { c.yAfter = null; goLocker(c, 'in'); return; }
    /* 帰る客は、1階で降りてから玄関へ歩く（yWalkToExit を見よ） */
    if (c.yAfter === 'exit') { c.yAfter = null; c.state = 'toExit'; walkToExit(c); return; }
    c.state = 'plan';                          // 降りた階で予定を選び直す
  } finally { applyArea(back, true); }
}

/* ============ 帰り道（作者指摘 8/8）============
   共有側の walkToExit は「その区画の入口まで歩いて、外の壁沿いに消える」。
   第2章の2階〜7階の「入口」はエレベーターの扉なので、そのままだと
   **扉まで行ったあと、その階の左下の壁に向かって歩いて消えていた。**

   上の階にいる客は、まずエレベーターで1階まで降ろす。降りたら 'exit' で
   ここに戻ってきて、1階の玄関から外へ出る＝**通ってきた道を、逆に辿る。**
   エレベーターが止まっている日は共有側に返す（その場で消えるが、詰まらせない） */
function yWalkToExit(c) {
  const front = AY.FRONT;
  if ((c.f | 0) === front) return false;               // 1階＝共有側の玄関でよい
  if (!yStartTransit(c, front)) return false;          // 箱が止まっている＝保険
  c.yAfter = 'exit';
  c.state = 'ch2Transit';
  return true;
}
registerChapter2Hooks({ walkToExit: yWalkToExit });

/* ============================================================
   主人公の見回り（作者指定 8/5）
   ============================================================
   第2章の主人公は、**画面に付いて来ない**。自分の判断でビルの中を回る。

     ・体力が尽きるまで動き続ける（営業中も番台に張り付かない）
     ・掃除の回数に上限は無い。上限は**体力ただ一つ**
     ・汚れの残っている階へ、客と同じエレベーターで上がっていく
     ・**バイトが立っている階には行かない**＝そこはその人の持ち場
     ・体力が尽きたら、番台のある階へ帰って、台の横で寝る

   ＝プレイヤーが5階の食堂を見ている間も、主人公は2階の男湯を拭いている。
     「どこを見ているか」と「誰がどこで働いているか」を、初めて切り離した。 */

/* その階に、遅刻していないバイトが立っているか。
   ⚠ **妻は数えない**（作者報告 8/8）。この判定は「そこはその人に任せた＝
   主人公は踏み込まない」という意味なので、**掃除をする人だけ**を数えなければならない。
   妻は番台に立つだけで床は拭かないので、妻を数えると
   **1階の汚れを誰も拭かないまま、主人公が2階で立ち尽くす**（実測：1階に汚れ6・主人公は420分ずっと2階）*/
function yStaffOnFloor(f) {
  return G.staff.some(s => !s.isWife && !(s.lateT > 0) && (s.f | 0) === (f | 0));
}
/* 番台のある階。主人公の帰る場所であり、寝る場所 */
function yDeskFloor() { const b = bandai(); return b ? (b.f | 0) : AY.FRONT; }
/* 番台に、主人公の代わりに立てる人が居るか。
   居るなら主人公は行列を気にせず掃除に出る（会計はその人の仕事） */
/* ============ 導線（作者報告 8/8）============
   共有側の判定は「1回の来店で歩いた総マス数」。第2章はエレベーターで7階を上下するので、
   **サウナと水風呂を隣に並べても基準を超える**＝置き方と無関係に不満が出ていた。

   数えるのは**浴室の階（男湯・女湯）で歩いたぶんだけ**にする。
   1階のロビーも、屋上へ上がるぶんも、置き方では縮められないので数えない。 */
function yNoWalkCount(e) {
  /* ⚠ **迷ったら「数える」側に倒すこと。**ここで誤って真を返すと、
     導線の不満が**永久に出なくなる**（出すぎるより気づきにくい壊れ方）*/
  if (!G.ch2 || !e || !e.type) return false;        // 客以外（主人公・バイト）は数えない側に回さない
  if (e.f == null) return false;                    // 階が分からない＝数える
  const f = e.f | 0;
  return f !== AY.OTOKO && f !== AY.ONNA;
}
/* ============ 導線を採点する浴室（作者指定 8/9）============
   評判の「導線」は4区間（入口→洗い場／風呂→サウナ／サウナ→水風呂／水風呂→イス）を
   測るが、**共有側は区画をひとつしか想定していなかった**（js/game.js の dosenParts）。
   この章は男湯2Fと女湯3Fに同じ種類の設備が並ぶので、そのままだと
     ・扉の座標が**表示中の階**のものになる（1Fを見ていると divideY=0 ＝ 扉が y=−1）
     ・サウナ=2F・水風呂=3F を「2マス」と数える
   という2つの壊れ方をする。**浴室ごとに測って、いちばん悪い浴室を採る。**

   ⚠ **客が使う設備が1つも無い浴室は、採点しない。** 3階を建てた直後は空っぽで、
     そこを0点で数えると「建てた瞬間に評判が落ちる」＝増築が罰になる。
     中身を入れた時点から数え始める（清潔度の cleanFloors と同じ考え方）      */
function yDosenFloors() {
  const out = [];
  for (const f of [AY.OTOKO, AY.ONNA]) {
    const a = (CONF.areas || [])[f];
    if (!a || a.floor !== 'bath') continue;                    // まだ建っていない階
    const used = G.equip.some(e => (e.f | 0) === f && EQ[e.id]
      && (EQ[e.id].cap || 0) > 0 && e.cond > 0);
    if (!used) continue;                                       // 空っぽの浴室は数えない
    out.push({ f, name: a.short || a.name, doorX: a.doorX, divideY: a.divideY });
  }
  return out;
}

/* サウナと水風呂が、本当に離れているか（同じ階で、遠いか） */
function ySaunaMizuFar() {
  const near = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  let best = Infinity;
  for (const s of G.equip) { if (!EQ[s.id] || EQ[s.id].cat !== 'sauna' || s.cond <= 0) continue;
    for (const m of G.equip) { if (!EQ[m.id] || EQ[m.id].cat !== 'mizu' || m.cond <= 0) continue;
      if ((s.f | 0) !== (m.f | 0)) continue;
      best = Math.min(best, near(s, m)); } }
  if (best === Infinity) return false;              // 片方が無い＝距離の話ではない
  return best > 8;                                  // 8マス以上離れていたら「遠い」と言ってよい
}
/* 台詞。歩かされたことへの不満であって、サウナ→水風呂の話とは限らない */
const Y_DOSEN = ['館内を歩かされるな…', '行ったり来たりで疲れた', 'この動線、無駄が多い', 'もう少しまとめて置いてくれ'];
const Y_DOSEN_PRO = ['導線が終わってる。無駄に歩かされる', '動線を考えてくれ。それだけで化けるぞ', '設備の並びが悪い。分かってないな'];
const Y_DOSEN_FAR = ['導線が終わってる。サウナ→水風呂が遠すぎだろ', 'サウナから水風呂まで歩かせるな、冷めるわ'];
function yDosenLines(c, pro) {
  if (!G.ch2) return null;
  if (pro && ySaunaMizuFar()) return Y_DOSEN_FAR;   // 本当に遠いときだけ名指しする
  return pro ? Y_DOSEN_PRO : Y_DOSEN;
}

function yDeskCovered() {
  return G.phase === 'biz' && yStaffOnFloor(yDeskFloor());
}
/* いま拭きに行きたい階を選ぶ。true＝移動を始めたので、今回の予定選びは中断 */
function yRoamPlayer(w, tired) {
  if (!G.ch2) return false;
  const here = w.f | 0;
  if (isHomeArea(here)) return false;               // 家に居る間は見回らない
  if (w.yRide > 0 || w.moveGoal != null) return false;   // もう箱を待っている
  const areas = CONF.areas || [];
  const want = [];
  /* 体力が残っているうちだけ、汚れを探す。
     使い切っていたら want は空のまま＝そのまま番台へ帰る（そして寝る） */
  if (!tired) for (let f = 0; f < areas.length; f++) {
    if (f === here || playerBanned(f) || areas[f].home) continue;
    if (yStaffOnFloor(f)) continue;                 // バイトの持ち場には踏み込まない
    if (G.dirts.some(d => (d.f | 0) === f)) want.push(f);
  }
  // 近い階から（階数の差が小さい順＝エレベーターの移動が短い順）
  want.sort((a, b) => Math.abs(a - here) - Math.abs(b - here));
  /* 汚れが無いときに帰る場所は、**バイト管理画面で決めた持ち場**（作者報告 8/8）。
     ここが番台のある階だったので、2階に配置しても手が空いた瞬間に1階へ降りていた。
     ただし**番台に誰も立っていなくて会計が待っている**ときだけは番台へ戻る＝
     店が止まるよりはいい（そのために主人公が居る）                           */
  const deskNeeded = !yDeskCovered() && G.payQueue.length > 0;
  const back = deskNeeded ? yDeskFloor() : yPlayerFloor();
  const to = want.length ? want[0] : (here === back ? -1 : back);
  if (to < 0) return false;                         // 行くところが無い＝その場で持ち場に戻る
  if (!yStartTransit(w, to)) return false;          // 箱が壊れている・扉まで行けない
  w.task = 'ch2go'; w.target = null;
  return true;
}
/* 扉の前まで歩き切ったら箱に乗り、着いた階で降りる（客の yStepTransit と同じ順） */
function yStepRoam(w, dt) {
  if (!(w.yRide > 0)) {
    if (!stepMove(w, dt)) return;
    w.yRide = yRideTime(w.f | 0, w.moveGoal | 0);
    return;
  }
  w.yRide -= dt;
  if (w.yRide > 0) return;
  const to = w.moveGoal | 0, t = yElevDoor(to);
  w.f = to;
  w.px = t.x * T + T / 2; w.py = t.y * T + T / 2;
  w.path = null; w.moveGoal = null; w.yRide = 0;
  w.task = null; w.target = null;                   // 降りた階で、いつもどおり汚れを探し直す
}
/* バイトの立ち位置は、面接で選んだ持ち場（emp.f）そのまま。
   ここを渡していなかったせいで、**どの持ち場を選んでも全員1階に湧いていた** */
/* その人を、その部屋に立たせられるか（作者決定 2026-08-07）。
   **女湯だけ女性限定。** 区画の説明文には最初から「女性スタッフがいない日は開けられない」と
   書いてあり、game.js にも門番（`canStaffArea`）の呼び出しがあったのに、
   この章がフックを持っていなかったので**男性バイトが女湯に立てていた**（100日通しで発見）。
   男湯は誰でも立てる＝実際の銭湯でも、女性スタッフが男湯を清掃するのは普通のこと */
function yCanStaffArea(emp, f) {
  const a = (CONF.areas || [])[f | 0];
  if (!a || a.home) return false;
  if (a.femaleOnly && (!emp || emp.sex !== 'f')) return false;
  return true;
}
/* 持ち場を決めずに雇った人を、どこに立たせるか。
   ⚠ 以前は無条件に1階へ回していたので、**主人公と妻で埋まっている受付に
   3人目を突っ込んで「3／2人」**になっていた（ロウリュ街・旧貿易地区のスカウトで実測 8/8）。
   空いている枠だけを候補にして、**誰も立っていない階＝閉まっている階**を先に開ける。
   どこも満杯なら null＝【持ち場なし】に並ぶ（嘘の配置をしない）        */
function yStaffAreaOf(emp) {
  const areas = CONF.areas || [];
  if (emp && emp.f != null) {
    const a0 = areas[emp.f | 0];
    if (a0 && !a0.home) return emp.f | 0;
  }
  const cands = [];
  areas.forEach((a, f) => {
    if (!a || a.home) return;
    if (a.sex === 'f' && emp && emp.sex !== 'f') return;          // 女湯に立てるのは女性だけ
    const max = a.staffMax || 1;
    const used = (G.roster || []).filter(e => e.f != null && (e.f | 0) === f).length
               + (typeof yAreaExtraWorker === 'function' ? (yAreaExtraWorker(f) | 0) : 0);
    if (used >= max) return;
    cands.push({ f, empty: used === 0 });
  });
  if (!cands.length) return null;
  return (cands.find(c => c.empty) || cands[0]).f;
}
/* ============ 持ち場を変えたら、その場で動かす（作者指定 2026-08-08）============
   `emp.f` を変えても、**すでに立っているバイトの実体（G.staff）は動かなかった。**
   実体は営業開始のときに `makeStaff` が作るので、営業中に配置し直すと
   「持ち場は男湯なのに、体は1階にいる」状態になる。
   その体は `home`（＝1階の待機マス）へ帰るので、**汚れが出れば男湯へ行くが、
   拭き終わると1階へ戻ってくる**＝作者が見た症状そのもの。

   妻（ySetWifeFloor）と同じく、ここで体ごと持ち場へ置き直す。         */
function yOnStaffPost(emp, f) {
  const s = (G.staff || []).find(x => x.emp === emp);
  if (!s) return;                                    // 準備中＝実体がいない（翌朝 makeStaff が正しく作る）
  const back = G.actF;
  if (typeof areaCount === 'function' && areaCount() > 1) applyArea(f | 0, true);
  const spot = (typeof staffSpot === 'function') ? staffSpot(s.sidx | 0) : { x: 2, y: 8 };
  if (typeof areaCount === 'function' && areaCount() > 1) applyArea(back, true);
  Object.assign(s, { f: f | 0, home: spot, px: spot.x * T + T / 2, py: spot.y * T + T / 2,
                     path: null, task: null, target: null, bub: null });
}

registerChapter2Hooks({
  roamPlayer: yRoamPlayer,
  stepRoam: yStepRoam,
  staffAreaOf: yStaffAreaOf,
  onStaffPost: yOnStaffPost,       // 営業中に配置し直しても、その場で体ごと動く
  canStaffArea: yCanStaffArea,     // 女湯に立てるのは女性だけ

  deskCovered: yDeskCovered,
  exitTile: () => ({ x: CONF.entrance.x, y: CONF.H - 1 }),   // 帰る客は玄関から下へ抜ける
  noWalkCount: yNoWalkCount,       // 導線は浴室の階で歩いたぶんだけ数える
  dosenFloors: yDosenFloors,       // 評判の導線は浴室ごとに測り、悪いほうを採る
  dosenLines: yDosenLines,         // 台詞は、本当に離れているものだけ名指しする
  playerKeepWorking: () => true,   // 体力が尽きるまで動き続ける
  noWarpPlayer: () => true,        // 画面に付いて来ない
  sleepAnyPhase: () => true,       // 営業中でも、力尽きたら番台の横で寝る
});

/* ============ 盤面を広げた日の、セーブの引っ越し（2026-08-08）============
   16×10（内側14×8・仕切り7）→ **20×14（内側18×12・仕切り9）** に変えたとき、
   **セーブの座標は前の間取りのまま**だった＝作者の遊んでいたセーブでは
   エレベーターが (13,7) のまま読まれ、**広くなった部屋のど真ん中に浮いていた**
   （作者指摘「部屋の中途半端な位置にあるなんて変だよ」）。番台も靴箱も同じ。

   引っ越しの決まり：
     ・エレベーターと受付カウンター＝**建物の一部**なので、新しい定位置へ据え直す
     ・浴室階の旧・脱衣所にあった物は、新しい脱衣所へ下ろす
       （下げないと、ロッカーや洗面所が浴室の中に立つ）
     ・仕切りの無い階（1階など）で**下の壁ぎわ**に置いてあった物も、同じだけ下ろす。
       旧盤面の内側は y 1〜8 で、y 8 は「入口のすぐ内側」だった。動かさないと
       靴箱が部屋の中程に取り残される（＝作者の言う「中途半端な位置」がここでも起きる）
     ・上寄りに置いてあった物は、そのままで意味が通るので動かさない
     ・はみ出した物だけ、盤面の内側へ寄せる
   重なりは、このあと共有側の fixEquipOverlap() が片づける                */
const BOARD_V_Y = 6;             // いまの盤面の版（13×19・仕切り14＝脱衣所4行）
/* 版ごとの間取り。**古いセーブを、いまの間取りへ順番に引っ越させる**ための表。
   盤面をまた変えるときは、ここに1行足して BOARD_V_Y を上げる             */
const BOARD_GEO_Y = {
  1: { W: 16, H: 10, divideY: 7 },   // 16×10（開発初期）
  2: { W: 20, H: 14, divideY: 9 },
  3: { W: 20, H: 17, divideY: 11 },
  4: { W: 16, H: 19, divideY: 13 },  // 横を16に戻してマスを大きくし、縦を伸ばした
  5: { W: 16, H: 19, divideY: 14 },  // 脱衣所を縦4マスに（作者指定 8/8）
  /* いま。**横を13にして、1マスを第1章とまったく同じ大きさに戻した**（作者指定 8/8）。
     縦と仕切りは据え置き＝脱衣所は4マスのまま。
     横が3マス縮むので、右端に置いてあった物は左へ寄せ直す（下のはみ出し処理） */
  6: { W: 13, H: 19, divideY: 14 },
};
function yMigrateEquip() {
  const c = G.ch2; if (!c) return;
  /* **ととのい市サウナバトルは最初から知っている**（作者決定 8/8）。
     旗の役目は無くなったので、古いセーブもここで揃える＝
     「五軒回るまで番付が出ない」状態のセーブが取り残されない */
  c.battleKnown = true;
  const from = Math.max(1, c.boardV | 0 || 1);
  if (from >= BOARD_V_Y) return;                   // もう引っ越し済み
  const areas = CONF.areas || [];
  const now = BOARD_GEO_Y[BOARD_V_Y];
  let moved = 0;
  for (const e of G.equip) {
    const d = EQ[e.id]; if (!d) continue;
    const a = areas[e.f | 0] || areas[0] || {};
    const W = a.W || CONF.W, H = a.H || CONF.H;
    if (e.id === 'y_elev' && a.elev) { e.x = a.elev.x; e.y = a.elev.y; moved++; continue; }
    /* 番台は毎回きっちり置き直す（版ごとに正しい位置が違う）。
       ⚠ 7 と直書きしていたので、横13の盤では中央からずれていた */
    if (e.id === 'bandai') { e.x = Math.min(6, W - 2); e.y = 1; moved++; continue; }
    /* 版を1つずつ上げていく（16×10 のセーブは 2 を経由して 3 へ）。
       浴室階は**旧・脱衣所にあった物を新しい脱衣所へ**、
       仕切りの無い階は**下の壁ぎわにあった物を下の壁ぎわのまま**下ろす      */
    for (let v = from; v < BOARD_V_Y; v++) {
      const o = BOARD_GEO_Y[v], n = BOARD_GEO_Y[v + 1];
      if (!o || !n) continue;
      if (a.divideY) { if (e.y >= o.divideY) { e.y += n.divideY - o.divideY; moved++; } }
      else if (e.y >= o.H - 4) { e.y += n.H - o.H; moved++; }
    }
    /* 横が縮んだ版（16→13）では、右端に置いてあった物が壁の外へ出る。
       ここで内側へ寄せ直す＝**消さずに、置ける場所まで左へ動かす** */
    e.x = Math.max(1, Math.min(e.x, W - 1 - (d.w || 1)));
    e.y = Math.max(1, Math.min(e.y, H - 1 - (d.h || 1)));
  }
  c.boardV = BOARD_V_Y;
  if (moved && typeof log === 'function') log('🏗 ビルの間取りが広くなった（設備を置き直した）');
}
registerChapter2Hooks({ migrateEquip: yMigrateEquip });

/* エレベーターの上には物を置けない（塞ぐとビルが止まる） */
function yPlaceBlock(id, gx, gy) {
  const f = G.viewF >= 0 ? G.viewF : G.actF;
  // 男湯だけ／女湯だけのもの（ひげ剃りブース＝男湯、パウダールーム・高級ドレッサー＝女湯）
  if (typeof ySexOK === 'function' && !ySexOK(id, f)) {
    return (EQ[id] || {}).name + 'は' + (EQ[id].sexOnly === 'm' ? '男湯' : '女湯') + 'にしか置けない';
  }
  const a = (CONF.areas || [])[f];
  if (!a || !a.elev) return null;
  const it = EQ[id] || {}; const w = it.w || 1, h = it.h || 1;
  /* 箱の大きさは設備の定義から取る。**2 と直書きしていた**ので、
     エレベーターを1×1にした日に、隣の1マスまで置けないままになるところだった */
  const ed = EQ['y_elev'] || {}, ew2 = ed.w || 1, eh2 = ed.h || 1;
  const ex = a.elev.x, ey = a.elev.y;
  const hit = gx < ex + ew2 && gx + w > ex && gy < ey + eh2 && gy + h > ey;
  if (hit) return 'エレベーターの上には置けない';
  const d = a.elevDoor || {};
  if (gx <= d.x && gx + w > d.x && gy <= d.y && gy + h > d.y) return 'エレベーターの前は空けておく';
  return null;
}

/* ============ フロアごとのカタログ ============
   いま入っている階に置けるものだけをタブに並べる。
   2F男湯を開いているのに券売機が並んでいると、どこの話なのか分からなくなる。 */
const Y_TABS_OF_AREA = {
  /* **1階に「脱衣所」タブは出さない**（作者指定 8/8）。1階に脱衣所は無いのに、
     ロッカーも洗面所もウォシュレットも並んでいた。
     ドリンク自販機だけは1階のロビーにも置きたいので、その品を【待合】へ移してある
     （2026-08-08、`front` タブを【受付】【待合】の2枚に割ったのに、
       ここを直し忘れて**1階からタブが消えていた**のも同時に修正） */
  [AY.FRONT]:   ['uketsuke', 'machiai', 'goods'],
  [AY.OTOKO]:   ['sauna', 'furo', 'mizu', 'wash', 'gaiki', 'datsui'],
  [AY.ONNA]:    ['sauna', 'furo', 'mizu', 'wash', 'gaiki', 'datsui'],
  [AY.LOUNGE]:  ['ne', 'suwaru', 'sugosu', 'shitsurae'],
  [AY.SHOKUDO]: ['chubo', 'menu', 'shokudo'],   // menu＝お品書きの開発（設備ではない）
  /* 泊まる設備と、寝床まわり（トイレ・洗面所・自販機は脱衣所のタブから借りる。
     カプセル階は divideY:0 なので room:'datsui' の品もどこにでも置ける） */
  [AY.CAPSULE]: ['capsule', 'datsui'],
  [AY.ROOF]:    ['gaiki'],
};
function yShopCats() {
  /* ⚠ **設備を置いたあとに必ず走るのが、いまは renderShop しか無い。**
     厨房を据えた「その場」に源さんを立たせたいので、ここに相乗りしている
     （game.js に新しいフックを足さずに済ませるため）。中で1フレーム遅らせる */
  if (typeof yGenKitchen === 'function') yGenKitchen();
  const f = G.viewF >= 0 ? G.viewF : G.actF;
  const keys = Y_TABS_OF_AREA[f];
  if (!keys) return CATS;
  return CATS.filter(c => keys.includes(c[0]));
}
/* 男湯だけ／女湯だけに置けるもの（候補1から引き継いだ sexOnly）。
   左右で別の作りになる＝**女湯を手抜きすると、女性客が二度と来ない** */
function ySexOK(id, f) {
  const only = EQ[id] && EQ[id].sexOnly;
  if (!only) return true;
  const a = (CONF.areas || [])[f | 0];
  return !!(a && a.sex === only);
}
/* その設備を、いま見ている階に置けるか */
function yShopItemOK(id) {
  const it = EQ[id]; if (!it) return false;
  const f = G.viewF >= 0 ? G.viewF : G.actF;
  if (!ySexOK(id, f)) return false;
  if (it.area != null) return (it.area | 0) === (f | 0);
  const keys = Y_TABS_OF_AREA[f] || [];
  /* `tabs`（複数タブ）を持つ設備は、そのどれか1つがこの階の一覧にあれば置ける。
     ドリンク自販機は「1階の待合」と「浴室階の脱衣所」の両方に出す（作者報告 8/8） */
  const tabs = it.tabs || [it.tab || it.cat];
  return tabs.some(t => keys.includes(t));
}

/* ============ 誰が来るか ============
   3F女湯を建てるまで、女性客は来ない（＝客の母数が半分のまま）。
   これが「3Fを建てる理由」そのものになる（CHAPTER2_B.md §11-3 ①）      */
/* 子連れが来なくなる時刻（作者決定 8/5）。**20時を回ったら、家族連れは来ない。**
   深夜まで開ける大人の店に、夜10時の子どもは居ない＝
   同じ店が、時間帯でまるごと別の店になる（昼は家族、夜は仕事帰りとサウナー） */
const KID_LAST_HOUR_Y = 20;
function yKidTimeOver() {
  return (yOpenHour() + G.minutes / 60) >= KID_LAST_HOUR_Y;
}
function yCanVisit(key) {
  const t = TYPES[key]; if (!t) return false;
  if (t.needArea != null && !yBuilt(t.needArea)) return false;
  // 深夜の客は、深夜営業を解放するまで来ない
  if (t.night && !(G.opts && G.opts.nightOpen)) return false;
  // 子連れ（と、その子ども）は20時まで
  if ((t.kid || t.withKid) && G.phase === 'biz' && yKidTimeOver()) return false;
  // 「小学生以下お断り」を掲げている日は、家族連れは来ない
  if ((t.kid || t.withKid) && G.opts && G.opts.banKids) return false;
  return true;
}
/* 子どもが浴室にいるときの、居合わせた客の不満（作者決定 8/5）。
   **老人がいちばん堪える。** 静かに浸かりに来ているので、はしゃぐ声が刺さる。
   ＝家族連れを呼ぶほど、常連の老人が離れていく。どちらを取るかの選択になる */
/* 刺青の客が居合わせたときの、ほかの客の不満（作者決定 8/5）。
   **いちばん堪えるのは子連れ。**子どもを風呂に入れに来た親は、
   その一点だけで「次はやめておこう」になる＝子連れの支持がそのまま落ちていく。
   ＝子どもの声で老人が離れ、刺青の客で子連れが離れる。**両側から効く選択**になる */
function yYakuzaGripe(c) {
  const t = (c && c.type) || {};
  if (t.withKid || t.kid) return 22;          // 子連れの父・母と、その子ども
  if (t.tolerant != null && t.tolerant <= -4) return 15;   // サウナ女子・OL・女子大生
  if (t.sex === 'f') return 12;
  return 8;                                    // 会社員・サウナー・老人は、そこまで気にしない
}

function yKidGripe(c) {
  const t = (c && c.type) || {};
  if (t.elder) return 16;                       // 老人（商店街の旦那）
  return (t.tolerant || 0) < 6 ? 8 : 0;         // ほかは第1章と同じ（我慢強い客は言わない）
}
registerChapter2Hooks({ kidGripe: yKidGripe, yakuzaGripe: yYakuzaGripe });

/* ============ 新しく始めるとき ============
   **ビルはもう買ってある**（作者指定）。金は払い終わっているので、ここでは引かない。
   ゲームが始まるのは「がらんどうの箱と、五千万の借金と、八百万」が手元にある朝から。 */
function yOnNewGame() {
  G.ch2 = {
    /* いまの盤面の版。新しく始めた店はもう今の間取りなので、引っ越し（yMigrateEquip）は要らない */
    boardV: BOARD_V_Y,
    /* 建っている階の数（1F・階段・2F＝3）。増築するとここが増える */
    floors: Y_START_AREAS,
    kouji: null,          // 工事中の階 { f, until }
    night: 0,             // 0=23時まで／1=翌2時／2=オールナイト
    goods: {},            // オリジナルグッズ（開発したもの）
    gaikan: {},           // 外観アイテム（看板）＝ { 看板のid: 付けた階 }。開業時はひとつも無い
    totalGuests: 0,       // 累計の来店人数（増築の条件に使う）
    /* 客層ごとの支持（SEGMENTS のキー → 人数）。満足した新規で +1／離れた常連で −1。
       これがそのまま**その層の来店数**になる（yMixAt / yCustWeightMul） */
    segFan: {},
    lastPaid: 0,          // 前の日の会計の件数（朝に累計へ足す）
    wife: { pushed: 0, stopped: 0, mood: 70 },   // 妻（共同経営者）。機嫌は上のバーに常時出る
    /* ── 持ち場の既定（作者指定 8/8）＝**妻は1階の番台、主人公は2階の男湯。**
       二人で番台に並ばせない。主人公は上の階を掃除して回り、会計は妻が受け持つ。
       どちらも【運営】→【バイト】でいつでも動かせる                        */
    wifeF: AY.FRONT,
    playerF: AY.OTOKO,
    /* ── 定休日（offday_y.js）── */
    week: WEEK_DEF_Y.slice(),   // 何曜日に開けるか。既定は**火曜定休**
    lastMorning: 0,             // 朝の一巡りを済ませた日（1日に一度だけ）
    kyugyoDay: 0, downDay: 0,   // 臨時休業を押した日／倒れた日
    downLog: [], hospital: 0,   // 倒れた日の記録（直近30日）／病院代の累計
    hours: null,                // 営業時間 { open, close }（初回に既定へ寄せる）
    visited: {},                // よその店に何回行ったか
    jinmyaku: 0,                // ロウリュ街で飲んだ回数（6回で源さんが志願する／§11-23）
    scoutPid: null,             // ロウリュ街で出会って、まだ返事をしていない人
    scoutNo: [],                // ロウリュ街で断った人（二度と声を掛けられない）
    gen: 0,                     // 源さん 0未／1妻が言った／2電話が来た／3厨房に立っている
    genDay: 0,                  // 段が上がった日
    genNag: 0,                  // 妻が料理人の小言を言った日
    genQuit: false,             // 源さんに辞めてもらった（自分からは辞めない・二度と来ない）
    waribikiUntil: 0,           // 買い出しの1割引きが効く日まで
    sale: null,                 // 買い出しの掘り出し物 { id, pct, until }
    stress: 0,                  // ストレス（0で満ち足りている・100で限界）
    koushu: 0,                  // 講習を受けた回数
    wifeOK: false,        // 「それでも、やる」を選んだ直後の1回だけ、関門を素通りさせる
    /* ── 借入まわり（data_y.js の CONF_Y.kouko）── */
    openedDay: 1,         // 開業した日。信金は「開業から何日か」を見る
    nextBill: 1 + (CONF.billEvery || 30),   // 次の支払日（地代・返済・生活費）
    profitDays: [],       // 直近10日、黒字だったか。**枠はここで開く**
    billMissed: false,    // 一度でも支払いを落としたか。落とすと信金の門が閉じる
    koukoAt: null, koukoAmt: 0,             // 申し込んだ融資（14日後に振り込まれる）
    /* **ととのい市サウナバトルは、最初から知っている**（作者決定 8/8）。
       開業の動機そのものが「あの大会で優勝する」なので、伏せる理由が無い。
       ⚠ 番付の**枠**は初日から出るが、**よその店の数字は行った店から埋まる**
         （`visited` で伏せる）＝偵察に行く理由はそのまま残る                */
    battleKnown: true,
    battle: null,         // 大会の進行（battle_y.js）
    rivals: JSON.parse(JSON.stringify(RIVALS_Y.map(r => ({ id: r.id, score: { ...r.score } })))),
  };
}

/* ============ 外観アイテム（看板）============
   買った看板は G.ch2.gaikan に { id: 階のindex } で持つ。
   壁に付ける看板は**2階以上だけ**（1階だと地面に刺さる／作者指定）。      */
function yGaikan() { return (G.ch2 && G.ch2.gaikan) || {}; }
function yHasGaikan(id) { return yGaikan()[id] != null; }
/* ============ 看板を付ける場所（作者指定 8/8）============
   壁の看板は**ビルの右側面なら、どの階にも**付けられる。
   ⚠ **左側面は使わない。** 階の名札（「2F 男湯」）がビルの左に出ているので、
     左に看板を出すと必ず字が重なる（作者指摘）。
   場所は階だけで足りるので、セーブは今までどおり数字1つのまま。         */
/* いま場所を選んでいる看板の id（フロア画面で設備を置くときと同じ手つき） */
let Y_SIGN_PLACE = null;
function ySignPlacing() { return Y_SIGN_PLACE; }
function ySignPlaceStart(id) {
  const s = GAIKAN_Y.find(x => x.id === id); if (!s || s.roof) return;
  if (!yHasGaikan(id)) {
    if (G.cash < s.price) { toast('お金が足りない'); return; }
    if (s.rep && G.rep < s.rep) { toast('評判' + s.rep + 'になれば頼める'); return; }
  }
  Y_SIGN_PLACE = id;
  toast('ビルの横側をタップして、付ける場所を選ぶ');
  yRenderGaikan();
}
function ySignPlaceCancel() { Y_SIGN_PLACE = null; yRenderGaikan(); }
/* 選んだ場所に付ける（外観の絵から呼ばれる） */
function ySignPlaceAt(f) {
  const id = Y_SIGN_PLACE; if (!id) return false;
  Y_SIGN_PLACE = null;
  yBuyGaikan(id, f);
  return true;
}
/* その看板を付けられる階（建っている階のうち、2階以上） */
function yGaikanFloors() {
  return (CONF.areas || []).map((a, f) => ({ a, f })).filter(o => o.a.lvl >= 2);
}
/* 看板ぶんの集客（1日の来店見込みへの上乗せ） */
function yGaikanGuests() {
  let n = 0;
  for (const s of GAIKAN_Y) if (yHasGaikan(s.id)) n += s.guest;
  // 🪧【見せ方上手】＝旧香料倉庫で行列を見て覚えたもの（odekake_y.js）
  if (typeof ySkillGaikanMul === 'function') n *= ySkillGaikanMul();
  return Math.round(n);
}
/* ============================================================
   受け入れ人数は、建物から決まる（作者決定 2026-08-05）
   ============================================================
   第2章は7階建てのビルなのに、**第1章（13×11の一部屋の銭湯）の数値を
   ひとつも上書きしていなかった**。`guestMax: 160` も、常連の上限50人も、
   バイトの上限3人も、そのまま継いでいた。160という壁は、建物と何の関係もなく効いていた。

   **定数をやめて、建物から出す。**

     同時に居られる人数 ＝ min（1階の靴箱, 浴室階の脱衣ロッカー）
     1日の上限         ＝ 同時人数 × 回転数 × 稼働率

   ・**需要**（yGuestBonus＝いい設備があるから来たい人が増える）と
     **供給**（yDailyCap＝その人数を受けられるか）は `Math.min` で出会う＝二重計上にならない
   ・入りきらなかったぶんは**入口で追い返さない**。「そもそも今日は来なかった」として
     静かに減らし、日報に「あと◯人来られた」と1行出す＝**増築しろ、という一番強い言い方**
   ・`stayAvgMin`（平均滞在）と `capUtil`（稼働率）が、あとから動かす2つのツマミ  */

/* いま使える靴箱の足数。壊れている台は数えない */
function yShoeSlots() {
  return (G.equip || []).reduce((n, e) => {
    const d = EQ[e.id];
    return n + ((d && d.shoes && e.cond > 0) ? d.shoes : 0);
  }, 0);
}
/* いま館内にいる客＝靴を預けている人。追い返し中の人は入っていない */
function yInHouse() {
  return (G.customers || []).filter(c => c.state !== 'turnAway' && c.state !== 'turnAwayExit').length;
}
/* その階の脱衣ロッカーの収容／いま使われている数 */
function yLockerCapOn(f) {
  return (G.equip || []).filter(e => (e.f | 0) === (f | 0) && EQ[e.id] && EQ[e.id].cat === 'locker' && e.cond > 0)
    .reduce((n, e) => n + (EQ[e.id].lock ?? CONF.lockerCap), 0);
}
function yLockersUsedOn(f) {
  return (G.customers || []).filter(c => c.hasLocker && (c.f | 0) === (f | 0)).length;
}
/* 浴室階の脱衣ロッカーの合計（評判の【脱衣所】【混雑度】が見る数字） */
function yBathCap() {
  let n = 0;
  for (const f of [AY.OTOKO, AY.ONNA]) if (yBuilt(f)) n += yLockerCapOn(f);
  return n;
}
/* 同時に館内に居られる人数＝**靴箱の足数だけ**（作者決定 2026-08-07）。

   ── なぜ脱衣ロッカーで縛るのをやめたか ──
   ロッカーは `cap: 0` で、`goLocker()` は空き状況を見ずに好きな台を選ぶ＝
   **動きの層では、ロッカーは一度も満杯にならない。** 満杯だったのは入口の抽象カウンタだけで、
   つまり「館内に何人いるか」を数える仕掛けが**靴箱とロッカーの二重**になっていた。
   しかも常にロッカーのほうがきつく（実測：靴箱900足に対してロッカー96人）、
   **「足りないと入口で帰られる」と書いてある靴箱が、一生効かない**状態だった。

   入館の関門は靴箱ひとつに絞る。ロッカーは評判で効き続ける
   （【脱衣所】に収容3点・【混雑度】に余裕2点）＝買う理由は残る            */
function yHoldCap() { return yShoeSlots(); }
/* 入館の関門。true＝今日はもう入れない。
   **数えるのは靴箱だけ**（作者決定 8/7・yHoldCap の説明を参照）。

   ただし「その客の行く浴室が**そもそも無い**」だけは、ここで止め続ける。
   階が建っていない／その階にロッカーが1台も無い店へ通してしまうと、
   `goLocker()` が着替え先を見つけられずに `c.state='toExit'` で黙って帰す＝
   金だけ取って、追い返した人数にも数えられない事故に戻る（実測で起きていた）。
   **これは満杯の話ではなく、有る／無いの話**なので残す                     */
function yEntryFull(c) {
  if (!G.ch2) return undefined;
  if (yInHouse() >= yShoeSlots()) { yTurnWhy('shoe'); return true; }
  const f = yBathOf(c);                       // 男は2F・女は3F
  if (!yBuilt(f) || yLockerCapOn(f) <= 0) { yTurnWhy('locker', f); return true; }
  /* **階ごとの入場制限**（作者指定 8/8）＝
     「靴箱が埋まったら1階で止める。男湯のロッカーが埋まったら男湯の客を止める」。
     男湯だけ満杯の日でも、女性客はふつうに通る＝制限が**階の話**として効く   */
  if (yLockersUsedOn(f) >= yLockerCapOn(f)) { yTurnWhy('locker', f); return true; }
  return false;
}
/* ============ 入場制限の札（館内案内図に出す）============
   1階＝靴箱が埋まった（＝ビル全体でもう受けられない）
   浴室階＝その階の脱衣ロッカーが埋まった（その性別の客だけ止まっている）
   出すのは営業中だけ。準備中に「制限中」と貼り出しても嘘になる          */
function yEntryLimited(f) {
  if (!G.ch2 || G.phase !== 'biz') return false;
  if ((f | 0) === AY.FRONT) return yInHouse() >= yShoeSlots();
  if ((f | 0) !== AY.OTOKO && (f | 0) !== AY.ONNA) return false;
  const cap = yLockerCapOn(f);
  return cap > 0 && yLockersUsedOn(f) >= cap;
}
/* 帰した理由を控えておく（翌朝の一言と日報が、名指しで言えるように） */
function yTurnWhy(kind, f) {
  const c = G.ch2; if (!c) return;
  if (!c.turnWhy) c.turnWhy = { shoe: 0, locker: {} };
  if (kind === 'shoe') c.turnWhy.shoe++;
  else c.turnWhy.locker[f | 0] = (c.turnWhy.locker[f | 0] || 0) + 1;
}

/* 客の入る時間帯で重みを付けた営業時間（分）。長く開けるほど、山の時間ほど、器が回る */
function yOpenWeightedMin() {
  const close = (typeof closeHourNow === 'function') ? closeHourNow() : yCloseHour();
  let w = 0;
  for (let h = yOpenHour(); h < close; h++) w += yHourWeight(h);
  return w * 60;
}
/* 1日に受け入れられる人数＝浴室の大きさ × 回転数 × 稼働率 */
function yDailyCap() {
  /* **1日の上限も靴箱から出す**（作者決定 8/7）。ここだけ浴室のロッカーから出していたので、
     「同時に居られる人数」と「1日の上限」が別の設備を見ていた＝
     靴箱を増やしても1日の上限が動かない／ロッカーを増やすと入口が混まないのに上限だけ伸びる、
     というねじれになっていた。いまは 靴箱 → 同時 → 1日 の一本道 */
  const turns = yOpenWeightedMin() / (CONF.stayAvgMin || 120);
  return Math.max(10, Math.round(yHoldCap() * turns * (CONF.capUtil || 0.6)));
}

/* 章の客足の補正。
   ①**看板を出した数だけ、新しい客が増える**
   ②**開けている時間ぶんを掛ける**（yHoursGuestMul。既定の15〜22時が1.0倍）
   ③**建物が受けきれる人数で頭打ち**（yDailyCap）                          */
function yGuestAdjust(n) {
  /* 第2予選（混雑週）は来たがる客が1.5倍。受けるか、入場制限で守るかは店の判断 */
  const q = (typeof yYosenNow === 'function') ? yYosenNow() : null;
  const battleMul = (q && q.theme === 'crowd') ? 1.5 : 1;
  const want = Math.max(1, Math.round((n + yGaikanGuests()) * battleMul
                                      * ((typeof yHoursGuestMul === 'function') ? yHoursGuestMul() : 1)
                                      * ((typeof ySkillGuestMul === 'function') ? ySkillGuestMul() : 1)));
  const cap = yDailyCap();
  if (G.ch2) G.ch2.lastOver = Math.max(0, want - cap);   // 入りきらなかった人数（日報に出す）
  return Math.min(want, cap);
}
/* ============ 券売機（作者指定・実装 2026-08-05）============
   カタログに「受付の行列がまるごと消える」と書いてありながら、**中身が無かった**。
   300人の店を回そうとして、初めてそれが致命傷になった。

   ── なぜ番台が壁になるのか ──
   番台の会計そのものは1分で終わる。詰まるのは**列の詰め直し**で、
   ひとり捌けるたびに次の人が番台の前まで歩いてくる＝1人あたり4分以上かかっていた。
   実測：見込み305人に対して会計244人、**61人が待ちくたびれて帰り、行列は71人**まで伸びた。

   ── 券売機がやること ──
   **並んでいる場所で券を買う。** 番台の前まで歩く必要がなくなるので、列がそのまま流れる。
   1台で1分あたり2人。台数を増やせばそのぶん速くなる＝**行列は金で買って消す**。
   置くのは番台のある階だけ（別の階の券売機では、入口の列は捌けない）          */
const TICKET_PER_MIN_Y = 2;
function yTicketN() {
  const deskF = (bandai() || { f: AY.FRONT }).f | 0;
  return (G.equip || []).filter(e => e.id === 'y_ticket' && e.cond > 0 && (e.f | 0) === deskF).length;
}
function yTick(dt) {
  if (!G.ch2 || G.phase !== 'biz') return;
  /* **フックは1名につき1つ**なので、毎分の仕事はここから呼び分ける。
     5F食堂の鍋（注文が火を通って机に並ぶまで）も、この列に並んでいる */
  if (typeof yShokuTick === 'function') yShokuTick(dt);
  if (typeof yHungerTick === 'function') yHungerTick(dt);   // 18〜20時、館内の客の腹が減る
  if (typeof yCapsuleSleepTick === 'function') yCapsuleSleepTick(dt);   // 6Fの寝息
  const n = yTicketN();
  if (!n) { G.ch2.tkT = 0; return; }
  G.ch2.tkT = (G.ch2.tkT || 0) + dt * n * TICKET_PER_MIN_Y;
  while (G.ch2.tkT >= 1 && G.payQueue.length) {
    const c = G.payQueue[0];
    // まだ通りを歩いている人（入口にすら着いていない）は、券売機まで届いていない
    if (c.state !== 'pay' && c.state !== 'toPay') break;
    G.ch2.tkT -= 1;
    takePayment(c);
  }
}
/* 翌朝の一言。**何がいっぱいだったのかを名指しで言う**（靴箱か、どの階のロッカーか）。
   「受入が足りない」だけでは、どのタブを開けばいいのか分からない            */
/* 壊れて数に入っていない台を数える。
   **「足りない」と「壊れている」は、打つ手がまるで違う。**
   持っているのに全部壊れている店に「増やそう」と言うと、
   直せば済む話で¥90万を使わせることになる（30日回して見つけた・2026-08-06） */
function yBrokenShoes() {
  return (G.equip || []).reduce((n, e) => {
    const d = EQ[e.id];
    return n + ((d && d.shoes && !(e.cond > 0)) ? d.shoes : 0);
  }, 0);
}
function yBrokenLockersOn(f) {
  return (G.equip || []).filter(e => (e.f | 0) === (f | 0)
    && EQ[e.id] && EQ[e.id].cat === 'locker' && !(e.cond > 0)).length;
}

function yTurnAwayHint(n) {
  const w = (G.ch2 && G.ch2.turnWhy) || { shoe: 0, locker: {} };
  const lockN = Object.entries(w.locker || {});
  const worst = lockN.sort((a, b) => b[1] - a[1])[0];
  if ((w.shoe || 0) >= (worst ? worst[1] : 0)) {
    const bs = yBrokenShoes();
    if (bs) {
      return `🚪 昨日、<b>${n}人</b>が入口で帰った。<b>靴箱が壊れている</b>`
           + `（いま使えるのは <b>${yShoeSlots()}人ぶん</b>／止まっているのが <b>${bs}人ぶん</b>）。<br>`
           + `1階の靴箱をタップして<b>修理</b>しよう。<br>`
           + `<span class="opt-sub">買い足す前に、まず直す。壊れた台は1人も預かれない</span>`;
    }
    return `🚪 昨日、<b>${n}人</b>が入口で帰った。<b>靴箱がいっぱい</b>だ（いま <b>${yShoeSlots()}人ぶん</b>）。<br>`
         + `1階の【フロント】タブで靴箱を大きくしよう。<br>`
         + `<span class="opt-sub">目安＝いちばん混む時間に館内にいる人数ぶん。浴室を広げたら、靴箱も一緒に大きくする</span>`;
  }
  const f = worst ? (worst[0] | 0) : AY.OTOKO;
  const a = (CONF.areas || [])[f] || {};
  const bl = yBrokenLockersOn(f);
  if (bl) {
    return `🚪 昨日、<b>${n}人</b>が入れずに帰った。<b>${a.short || a.name || ''}の脱衣ロッカーが壊れている</b>`
         + `（使えるのは <b>${yLockerCapOn(f)}人ぶん</b>／壊れた台が <b>${bl}台</b>）。<br>`
         + `${a.lvl ? a.lvl + 'F' : ''}のロッカーをタップして<b>修理</b>しよう。<br>`
         + `<span class="opt-sub">買い足す前に、まず直す。壊れた台は1人も入れられない</span>`;
  }
  return `🚪 昨日、<b>${n}人</b>が入れずに帰った。<b>${a.short || a.name || ''}の脱衣ロッカーが足りない</b>`
       + `（いま <b>${yLockerCapOn(f)}人ぶん</b>）。<br>`
       + `${a.lvl ? a.lvl + 'F' : ''}の【脱衣所】タブでロッカーを増やそう。<br>`
       + `<span class="opt-sub">男湯と女湯は別勘定。片方が満杯でも、もう片方は関係なく開いている</span>`;
}
/* 日報の下に足す2行（入れずに帰した人数と、器が足りずに来られなかった人数） */
function yCapReportRows() {
  const w = (G.ch2 && G.ch2.turnWhy) || { shoe: 0, locker: {} };
  const lock = Object.values(w.locker || {}).reduce((a, b) => a + b, 0);
  const over = (G.ch2 && G.ch2.lastOver) || 0;
  let html = '';
  if (w.shoe || lock) {
    const why = [];
    if (w.shoe) why.push('靴箱 ' + w.shoe + '人');
    if (lock) why.push('脱衣ロッカー ' + lock + '人');
    html += '<div class="rep-row">🚪 入口で帰した <b>' + (w.shoe + lock) + '人</b>'
          + '<span class="opt-sub">（' + why.join('／') + '）</span></div>';
  }
  if (over > 0) {
    html += '<div class="rep-row">🏗 <b>あと' + over + '人</b>は来られたのに、器が足りなかった'
          + '<span class="opt-sub">（いまの受入 ' + yDailyCap() + '人／日。靴箱を増やせば増える）</span></div>';
  }
  html += yShortageRow();
  return html;
}

/* ============================================================
   靴箱に対して、中の設備が足りているか（作者指定 2026-08-07）
   ------------------------------------------------------------
   入館の関門を靴箱ひとつに絞ったので、**靴箱を増やすほど中が混む**。
   「台数を増やす」ではなく **どれが何席足りないのか** まで言い切る。

   物差しは評判とまったく同じ（`CONF.scalePer` と、ロッカーの 客数×0.35）＝
   **ここで言われたとおりに足すと、評判の点がそのまま伸びる。**
   別の物差しで言うと「言われたとおりにしたのに点が動かない」になる
   ============================================================ */
const SHORT_KINDS_Y = [
  /* rate ＝ 入れた客のうち、その設備を使いたい人の割合（評判の wantSauna と同じ取り方） */
  { cat: 'sauna', name: 'サウナ',       rate: 0.5 },
  { cat: 'mizu',  name: '水風呂',       rate: 0.5 },
  { cat: 'rest',  name: 'ととのいイス', rate: 0.5 },
  { cat: 'furo',  name: '湯船',         rate: 1.0 },
];
function yShortage() {
  const n = yDailyCap();                                   // 靴箱で1日に入れられる人数
  const out = [];
  for (const k of SHORT_KINDS_Y) {
    const per = (CONF.scalePer || {})[k.cat] || 6;         // 1席あたり何人まで
    const cap = liveOf(k.cat).reduce((a, e) => a + (EQ[e.id].cap || 0), 0);
    const need = Math.ceil(n * k.rate / per);
    if (need > cap) out.push({ name: k.name, unit: '席', cap, need, ratio: cap ? need / cap : 99 });
  }
  const lockCap = yBathCap(), lockNeed = Math.ceil(n * 0.35);
  if (lockNeed > lockCap) out.push({ name: '脱衣ロッカー', unit: '人ぶん',
                                     cap: lockCap, need: lockNeed, ratio: lockCap ? lockNeed / lockCap : 99 });
  return out.sort((a, b) => b.ratio - a.ratio);
}
function yShortageRow() {
  const s = yShortage(); if (!s.length) return '';
  const gave = (G.today && G.today.gaveUp) | 0;
  /* **釣り合っている店では黙っている。** 実際に待ちきれず帰った人が出た日か、
     いちばん足りないものが2倍以上足りない時だけ言う＝毎日出る小言にしない */
  if (!gave && s[0].ratio < 2) return '';
  const top = s[0], also = s.slice(1, 3).map(x => x.name).join('・');
  return '<div class="rep-row">👞 靴箱は <b>' + yShoeSlots() + '人ぶん</b>'
       + '（1日 ' + yDailyCap() + '人まで入る）。中が追いついていない'
       + '<span class="opt-sub">▶ <b>' + top.name + '</b>が' + top.cap + top.unit + 'しかない（'
       + top.need + top.unit + '要る）'
       + (also ? '／' + also + 'も足りない' : '')
       + (gave ? '。昨日は' + gave + '人が待ちきれず帰った' : '') + '</span></div>';
}
registerChapter2Hooks({ entryFull: yEntryFull, tick: yTick, turnAwayHint: yTurnAwayHint });

/* 買う／付け替える */
function yBuyGaikan(id, f) {
  const s = GAIKAN_Y.find(x => x.id === id); if (!s) return;
  const had = yHasGaikan(id);
  if (!had) {
    if (G.cash < s.price) { toast('お金が足りない'); return; }
    if (s.rep && G.rep < s.rep) { toast('評判' + s.rep + 'になれば頼める'); return; }
    G.cash -= s.price;
    log('🪧 ' + s.name + 'を出した（' + yen(s.price) + '）');
  }
  if (!G.ch2.gaikan) G.ch2.gaikan = {};
  G.ch2.gaikan[id] = s.roof ? -1 : (f | 0);         // 屋上は -1（いちばん上に載る）
  toast(had ? s.name + 'を付け替えた' : s.name + 'を出した');
  yRenderGaikan();
  if (typeof updateTopbar === 'function') updateTopbar();
  if (typeof saveGame === 'function') saveGame();
}

/* ビルの外観の下に並ぶ買い物リスト（各階の設備カタログと同じ場所）。
   タブは【🪧 外観】＝看板 と【🏗 増築】＝上に階を積む の2枚               */
let Y_PANEL_TAB = 'gaikan';

function yRenderGaikan() {
  const tabs = document.getElementById('shopTabsG');
  const box = document.getElementById('gaikanList');
  if (!box) return;
  /* ⚠ **【🪧 外観】と【🏗 増築】のタブは廃止**（作者指定 8/8）。
     どちらも**外観図そのものを叩く**形に移した＝
       ・未建設の階の【＋】     → `yAskZou`（増築しますか？）
       ・ビルの横の【＋ 看板】 → `yAskSign`（どの看板を出す？）
     絵の中の、その場所を押す。メニューを開いて名前で選ぶより短い。
     残ったのは【集客】だけなのでタブ自体を出さない（1枚のタブは押す意味がない）。
     ⚠ 戻すなら、この `tabs.innerHTML` に3枚を並べ直すだけでいい
       （`yRenderZou` も `Y_PANEL_TAB` の分岐も消していない）             */
  Y_PANEL_TAB = 'shukyaku';
  if (tabs) tabs.innerHTML = '';
  box.innerHTML = '';
  /* 【外観】【増築】は**横スクロールの棚**（作者指定 8/8）。
     【集客】は共有の renderAds が縦のリストを作るので、そこだけ縦のまま */
  box.classList.toggle('hstrip', Y_PANEL_TAB !== 'shukyaku');
  box.classList.toggle('ads', Y_PANEL_TAB === 'shukyaku');
  if (Y_PANEL_TAB === 'zou') { yRenderZou(box); return; }
  /* 集客＝広告。中身は game.js の renderAds をそのまま使う */
  if (Y_PANEL_TAB === 'shukyaku') {
    const pane = document.createElement('div');
    pane.id = 'sendenPane';
    box.appendChild(pane);
    if (typeof renderAds === 'function') renderAds();
    return;
  }

  const floors = yGaikanFloors();
  for (const s2 of GAIKAN_Y) {
    const owned = yHasGaikan(s2.id);
    const at = yGaikan()[s2.id];
    const locked = !owned && s2.rep && G.rep < s2.rep;
    const div = document.createElement('div');
    div.className = 'shop-item' + (locked ? ' locked' : '');
    const where = owned
      ? (s2.roof ? '屋上に設置ずみ'
         : ((((CONF.areas || [])[at] || {}).lvl || '?') + 'Fに設置ずみ'))
      : '';
    /* **フロアのカタログと同じ形**（絵 → 名前 → 値段）にする（作者指定 8/8）。
       絵は看板そのもの（art_y.js の ySignIcon）＝一覧と外観で同じ物に見える */
    const card = document.createElement('div'); card.className = 'gk-card';
    const icon = (typeof ySignIcon === 'function')
      ? '<img class="shop-icon" src="' + ySignIcon(s2.id) + '">' : '';
    div.innerHTML = icon + '<div class="shop-body">'
      + '<div class="shop-name">' + s2.name
      + ' <span class="cap-chip">集客+' + s2.guest + '人</span>'
      + (locked ? ' <span class="lock-chip">🔒評判' + s2.rep + '</span>' : '')
      + (owned ? ' <span class="cap-chip">' + where + '</span>' : '')
      + '</div></div>'
      + '<div class="shop-price">' + (owned ? '―' : yenShort(s2.price)) + '</div>';
    card.appendChild(div);

    /* 付ける階を選ぶボタン。**壁の看板は2階以上だけ**（1階だと地面に刺さる） */
    const row = document.createElement('div');
    row.className = 'sel-actions';
    if (s2.roof) {
      row.innerHTML = '<button class="sm-btn' + (owned ? ' on' : '') + '" data-id="' + s2.id + '" data-f="-1"'
        + (locked ? ' disabled' : '') + '>' + (owned ? '屋上に設置ずみ' : '屋上に出す') + '</button>';
      row.querySelectorAll('button[data-id]').forEach(b => {
        b.onclick = () => yBuyGaikan(b.dataset.id, parseInt(b.dataset.f, 10));
      });
    } else {
      /* **階ごとのボタンを並べるのをやめた**（作者指定 8/8）＝
         ビルの横側なら左右どちらの・どの階にも付けられるので、
         フロア画面で設備を置くのと同じく**絵をタップして場所を選ぶ**  */
      const placing = ySignPlacing() === s2.id;
      row.innerHTML = '<button class="sm-btn' + (placing ? ' on' : '') + '" data-place="' + s2.id + '"'
        + (locked ? ' disabled' : '') + '>'
        + (placing ? '× やめる' : (owned ? '🪧 付け替える' : '🪧 場所を選んで付ける')) + '</button>';
      row.querySelectorAll('button[data-place]').forEach(b => {
        b.onclick = () => (ySignPlacing() === b.dataset.place) ? ySignPlaceCancel() : ySignPlaceStart(b.dataset.place);
      });
    }
    card.appendChild(row);
    box.appendChild(card);
  }
}

/* この2枚（増築・看板）は `kaigyoModal` を借りている。
   モーダルが自前で持つ【とじる】は「やめる」と重なるので、開いている間だけ畳む。
   ⚠ **必ず戻すこと。**開業準備の画面はこのボタンで閉じる                    */
function yLendKaigyo(open) {
  const b = document.getElementById('btnKaigyoClose');
  if (b) b.classList.toggle('hidden', !!open);
}

/* ============ 看板を出す（作者指定 8/8）============
   外観図の側面にある【＋ 看板】から呼ばれる。**どれを出すか**を、その場で選ぶ。
   屋上の大看板は側面ではなく屋根に載るので、この画面の下に別枠で並べる      */
function yAskSign(f) {
  const a = AREAS_Y[f | 0] || {};
  const m = document.getElementById('kaigyoModal');
  const box = document.getElementById('kaigyoBody');
  if (!m || !box) return;
  const own = yGaikan();
  m.querySelector('h2').textContent = '🪧 ' + a.lvl + '階に看板を出す';
  box.innerHTML = '<p class="modal-note">ビルの横に出す看板を選ぶ。あとから付け替えられる。</p>';
  for (const s of GAIKAN_Y) {
    const had = yHasGaikan(s.id);
    const why = (!had && s.rep && G.rep < s.rep) ? '評判' + s.rep + 'になれば頼める'
              : (!had && G.cash < s.price) ? 'お金が足りない' : null;
    const here = (own[s.id] | 0) === (f | 0) && typeof own[s.id] === 'number';
    const b = document.createElement('button');
    b.className = 'big-btn' + (s.roof ? ' sub' : '');
    b.disabled = !!why || here;
    b.innerHTML = (s.roof ? '🏢 ' : '🪧 ') + s.name
      + (had ? '<span class="soon">' + (here ? 'この階に出ている' : '付け替える（追加の代金なし）') + '</span>'
             : '<span class="soon">' + yen(s.price) + '　集客+' + s.guest + '人'
               + (why ? '　🔒' + why : '') + '</span>')
      + (s.roof ? '<span class="soon">屋上に載る（階は選べない）</span>' : '');
    /* **お金を払う物は、必ずもう一枚**（作者指定 8/9）＝増築と同じ確認画面を挟む。
       すでに買ってある看板の付け替えは**代金がかからない**ので、そのまま動かす      */
    b.onclick = () => had ? (yLendKaigyo(false), m.classList.add('hidden'), yBuyGaikan(s.id, f))
                          : yAskSignBuy(s, f);
    box.appendChild(b);
  }
  const no = document.createElement('button');
  no.className = 'big-btn sub'; no.textContent = 'やめる';
  no.onclick = () => { yLendKaigyo(false); m.classList.add('hidden'); };
  box.appendChild(no);
  yLendKaigyo(true);
  m.classList.remove('hidden');
}

/* 看板を買う前の確認（作者指定 8/9）＝増築の確認画面と同じ形。
   看板は10万〜100万の買い物なので、選んだ瞬間に金が飛ばないようにする       */
function yAskSignBuy(s, f) {
  const a = AREAS_Y[f | 0] || {};
  const m = document.getElementById('kaigyoModal');
  const box = document.getElementById('kaigyoBody');
  if (!m || !box) return;
  m.querySelector('h2').textContent = (s.roof ? '🏢 ' : '🪧 ') + s.name + 'を出しますか？';
  const after = G.cash - s.price;
  box.innerHTML =
    '<p class="modal-note">' + (s.desc || '') + '</p>'
    + '<div class="opt-row"><span>代金</span><span class="v">' + yen(s.price) + '</span></div>'
    + '<div class="opt-row"><span>出す場所</span><span class="v">'
      + (s.roof ? '屋上' : a.lvl + '階の壁') + '</span></div>'
    + '<div class="opt-row"><span>集客</span><span class="v">1日 +' + s.guest + '人</span></div>'
    + '<div class="opt-row"><span>いまの所持金</span><span class="v">' + yen(G.cash) + '</span></div>'
    + '<div class="opt-row"><span>払ったあと</span><span class="v">' + yen(after) + '</span></div>'
    + '<p class="modal-note">看板に出るのは、この店の名前「' + (G.name || '') + '」だ。'
      + (s.roof ? '' : 'あとから別の階へ付け替えられる（追加の代金はかからない）。') + '</p>';
  const ok = document.createElement('button');
  ok.className = 'big-btn';
  ok.textContent = '🪧 この看板を出す（' + yen(s.price) + '）';
  ok.onclick = () => { yLendKaigyo(false); m.classList.add('hidden'); yBuyGaikan(s.id, f); };
  const back = document.createElement('button');
  back.className = 'big-btn sub'; back.textContent = '← ほかの看板を見る';
  back.onclick = () => yAskSign(f);
  const no = document.createElement('button');
  no.className = 'big-btn sub'; no.textContent = 'やめる';
  no.onclick = () => { yLendKaigyo(false); m.classList.add('hidden'); };
  box.appendChild(ok); box.appendChild(back); box.appendChild(no);
  yLendKaigyo(true);
  m.classList.remove('hidden');
}

/* ============ 増築の確認（作者指定 8/8）============
   外観図の未建設の階にある【＋】から呼ばれる。
   **「3階（女湯）を増築しますか？」**とだけ聞く画面を1枚。
   ⚠ `confirm()` は使わない（この作品では禁止）。第2章が持っている
     `kaigyoModal` を借りて、そこに描く                                    */
function yAskZou(f) {
  const z = ZOUCHIKU_Y.find(x => x.f === (f | 0));
  const a = AREAS_Y[f | 0] || {};
  const m = document.getElementById('kaigyoModal');
  const box = document.getElementById('kaigyoBody');
  if (!z || !m || !box) return;
  const why = yZouWhy(z);
  m.querySelector('h2').textContent = '🏗 ' + a.lvl + '階（' + (a.short || '') + '）を増築しますか？';
  box.innerHTML =
    '<p class="modal-note">' + (z.note || '') + '</p>'
    + '<div class="opt-row"><span>工事代</span><span class="v">' + yen(z.price) + '</span></div>'
    + '<div class="opt-row"><span>工期</span><span class="v">' + (z.days || 3) + '日</span></div>'
    + '<div class="opt-row"><span>いまの所持金</span><span class="v">' + yen(G.cash) + '</span></div>'
    + (why ? '<p class="modal-note" style="color:#e8a0a0">🔒 ' + why + '</p>'
           : '<p class="modal-note">工事のあいだ、下の階は少し落ち着かない。</p>');
  const ok = document.createElement('button');
  ok.className = 'big-btn'; ok.disabled = !!why;
  ok.textContent = why ? 'まだ頼めない' : '🏗 この階を建てる（' + yen(z.price) + '）';
  ok.onclick = () => { yLendKaigyo(false); m.classList.add('hidden'); yOrderZou(); };
  const no = document.createElement('button');
  no.className = 'big-btn sub'; no.textContent = 'やめる';
  no.onclick = () => { yLendKaigyo(false); m.classList.add('hidden'); };
  box.appendChild(ok); box.appendChild(no);
  yLendKaigyo(true);
  m.classList.remove('hidden');
}

/* 【🏗 増築】のタブ。いま頼める1階ぶんと、そのあとに積める階を並べる */
function yRenderZou(box) {
  const k = yKouji();
  if (k) {
    const a = AREAS_Y[k.f] || {};
    const left = Math.max(0, k.until - G.day);
    const div = document.createElement('div');
    div.className = 'shop-item';
    const card0 = document.createElement('div'); card0.className = 'gk-card';
    div.innerHTML = '<div class="shop-body"><div class="shop-name">🏗 ' + (a.lvl || '') + '階を工事中'
      + ' <span class="cap-chip">あと' + left + '日</span></div>'
      + '<div class="shop-note">建設業者が入っている。足場が外れるまで、下の階は少し落ち着かない。</div></div>'
      + '<div class="shop-price">工事中</div>';
    card0.appendChild(div); box.appendChild(card0);
  }
  for (const z of ZOUCHIKU_Y) {
    if (z.built) continue;
    const a = AREAS_Y[z.f] || {};
    const done = yFloorCount() > z.f;
    const next = !done && yFloorCount() === z.f;
    const why = next ? yZouWhy(z) : (done ? null : '下の階から順に積む');
    const card = document.createElement('div'); card.className = 'gk-card';
    const div = document.createElement('div');
    div.className = 'shop-item' + (done ? '' : (why ? ' locked' : ''));
    div.innerHTML = '<div class="shop-body"><div class="shop-name">' + (a.lvl || '') + 'F ' + (a.short || '')
      + (done ? ' <span class="cap-chip">完成</span>' : '')
      + (why ? ' <span class="lock-chip">🔒' + why + '</span>' : '')
      + '</div><div class="shop-note">' + (z.note || '') + '　工期' + (z.days || 3) + '日</div></div>'
      + '<div class="shop-price">' + (done ? '―' : yenShort(z.price)) + '</div>';
    card.appendChild(div); box.appendChild(card);
    /* 発注のボタンは**条件を満たしたときだけ**出す。
       押せない緑のボタンが並ぶと、押せるのか押せないのか分からない */
    if (next && !k && !why) {
      const row = document.createElement('div');
      row.className = 'sel-actions';
      row.innerHTML = '<button class="sm-btn ok" id="btnZouOrder">この階を建てる（' + yenShort(z.price) + '・' + (z.days || 3) + '日）</button>';
      row.querySelector('button').onclick = () => yOrderZou();
      card.appendChild(row);            // カードの中へ（横に並べるため）
    }
  }
}

/* ============ 準備中の一行 ============
   「いま何をすればいいか」を上に一行だけ出す。がらんどうから始まるので、
   最初は**サウナと水風呂を置くこと**だけを言う。 */
function yTopTip() {
  const has = cat => G.equip.some(e => EQ[e.id] && EQ[e.id].cat === cat && (e.cond > 0 || EQ[e.id].cap === 0));
  /* **何が足りなくて開けられないか**をそのまま言う（作者指摘 8/5）。
     「部門は、ここから始まる」では、まだ大会を知らない主人公には意味が通らない */
  if (!has('sauna')) return '2階にサウナを置こう。まだ営業できない';
  if (!has('locker'))return '脱衣所にロッカーを。無いと客が入れない';
  if (!has('mizu'))  return '水風呂が要る。サウナの相棒だ';
  if (!has('wash'))  return '洗い場のカランを置こう';
  if (!has('rest'))  return 'ととのいイスを置こう。無いと整う前に帰ってしまう';
  return '';
}

/* ============ 登録 ============
   ここに書いた名前だけが、第1章と違うふるまいになる。
   ※まだ書いていない関数を並べると、この呼び出しごと例外になってフックが全部消える。
     名前を足すときは、その関数が上にあることを必ず確かめる               */
registerChapter2Hooks({
  /* 台本はこれから（CHAPTER2_B_SCRIPT.md）。空の配列を返すと物語を飛ばして
     いきなり屋号決めへ行く＝**第1章の台本が流れてしまうのを止める**ためにも要る */
  /* 制作中は飛ばす（PLAY_INTRO_Y／この下の Y_INTRO_Y のところ）。**出す前に戻す** */
  introStory: () => (PLAY_INTRO_Y ? Y_INTRO_Y : []),
  routeTo: yRouteTo,
  stepTransit: yStepTransit,
  placeBlock: yPlaceBlock,
  shopCats: yShopCats,
  shopItemOK: yShopItemOK,
  canVisit: yCanVisit,
  guestAdjust: yGuestAdjust,
  renderGaikan: yRenderGaikan,
  onNewGame: yOnNewGame,
  topTip: yTopTip,
});

/* ============================================================
   増築（上に階を積む）
   ------------------------------------------------------------
   **この章の背骨**（CHAPTER2_B.md §5）。
     発注する → 工期のあいだ足場が架かる → 完成した翌朝、階が生える
   工事のあいだは下の階の満足度が落ちる＝**いつ工事するか**が判断になる。
   ============================================================ */
/* いま建っている階の数（1F＋上の階） */
function yFloorCount() { return (CONF.areas || []).length; }
/* 次に建てられる階の情報（もう全部建っていれば null） */
function yNextZou() {
  const n = yFloorCount();
  return ZOUCHIKU_Y.find(z => !z.built && z.f === n) || null;
}
/* 工事中か */
function yKouji() { return (G.ch2 && G.ch2.kouji) || null; }
/* 発注できるか（理由つきで返す） */
function yZouWhy(z) {
  if (!z) return 'これ以上は積めない';
  if (yKouji()) return '別の階を工事中';
  if ((G.rep || 0) < z.rep) return '評判' + z.rep + 'になれば頼める（いま' + Math.floor(G.rep || 0) + '）';
  if (yTotalGuests() < z.guests) return '累計' + z.guests + '人の来店が要る（いま' + yTotalGuests() + '人）';
  if (G.cash < z.price) return 'お金が足りない';
  return null;
}
/* 発注する */
function yOrderZou() {
  const z = yNextZou();
  const why = yZouWhy(z);
  if (why) { toast(why); return; }
  // 増築は大きな買い物＝**決める前に、妻がひと言はさむ**
  if (yAskWife('zou', z.price)) return;
  G.cash -= z.price;
  G.ch2.kouji = { f: z.f, start: G.day, until: G.day + z.days, days: z.days };
  const a = AREAS_Y[z.f] || {};
  log('🏗 ' + (a.lvl || '') + '階の工事を発注した（' + yen(z.price) + '・' + z.days + '日）');
  toast((a.lvl || '') + '階の工事が始まった');
  yRenderGaikan();
  if (typeof updateTopbar === 'function') updateTopbar();
  if (typeof saveGame === 'function') saveGame();
}
/* 毎朝の見まわり。工期が明けていたら、その階を生やす */
function yCheckKouji() {
  const k = yKouji(); if (!k) return;
  if (G.day < k.until) return;
  G.ch2.kouji = null;
  /* 建った＝フロアの配列を1つ伸ばす。**index は動かない**ので、
     すでに置いてある設備やセーブとの対応はそのまま                       */
  const b = buildFloorsY(k.f + 1);
  CONF.areas = b.list; CONF.guideRow = b.rows;
  const a = AREAS_Y[k.f] || {};
  // 新しい階にもエレベーターが要る（無いと誰も上がれない）
  if (a.elev) {
    const d = EQ['y_elev'];
    G.equip.push({ uid: ++G.uidN, id: 'y_elev', x: a.elev.x, y: a.elev.y, rot: 0, cond: 100,
                   f: k.f, temp: d.temp, occ: Array(d.cap || 0).fill(null) });
  }
  // 女湯が建った日から、女性客が来るようになる
  if (a.sex === 'f') CONF.menOnly = false;
  log('🎉 ' + (a.lvl || '') + '階（' + (a.short || '') + '）が完成した！');
  toast((a.lvl || '') + '階が完成した！');
  if (typeof saveGame === 'function') saveGame();
}
/* 工事の進み具合（0＝着工した朝／1＝完成）。外観のアニメーションはこれで描く */
function yKoujiProgress() {
  const k = yKouji(); if (!k) return 0;
  const d = k.days || 3;
  return clamp((G.day - (k.start || (k.until - d))) / d, 0, 1);
}

/* 工事中の階では、下の階の満足度が落ちる（騒音・振動）＝いつ工事するかの判断になる */
function yKoujiSatMul() { return yKouji() ? 0.9 : 1; }

/* 累計の来店人数（game.js は持っていないので、この章で数える）。
   前の日の会計の件数を、朝いちで積み上げる */
function yTotalGuests() { return (G.ch2 && G.ch2.totalGuests) || 0; }

/* 1日の始まりに呼ばれる（この章は第1章の来訪者イベントを使わない） */
/* 朝の一巡りは offday_y.js の yMorning() が持っている（定休日も同じ朝が来るので、
   営業日の startDay からだけ呼ぶわけにいかない）。**1日に一度しか走らない** */
function yScheduleDay() {
  if (typeof yMorning === 'function') yMorning();
  // 「入れずに帰した理由」は1日ぶんずつ数える（翌朝の一言と日報が使う）
  if (G.ch2) G.ch2.turnWhy = { shoe: 0, locker: {} };
}

/* ============================================================
   30日ごとの支払い（地代・返済・生活費）
   ------------------------------------------------------------
   **客が0人でも、この3つは必ず出ていく。**
   ・地代 ¥300,000（借地権＝土地は借り物）
   ・返済 残債の1.24%（元利均等。借りるほど毎月が重くなる）
   ・生活費 ¥250,000（家賃¥15万＋暮らし¥10万。**店の経費ではない**）
   落とすと billMissed が立つ＝**信金の門が二度と開かない**（数字の傷は消えない）
   ============================================================ */
function yBillLines() {
  const debt = G.debt || 0;
  const inter = Math.round(debt * (CONF.kouko ? CONF.kouko.apr : 0.02) / 12);
  let pay = Math.round(debt * (CONF.hensaiRate || 0.0124));
  let prin = Math.max(0, pay - inter);
  // 残りが少なくなったら、最後はまとめて払い切る（端数が永久に残らないように）
  if (debt > 0 && prin < 10000) { prin = debt; pay = debt + inter; }
  prin = Math.min(prin, debt);
  return { chidai: CONF.chidai || 0, pay, inter, prin, life: CONF.seikatsuhi || 0,
           total: (CONF.chidai || 0) + pay + (CONF.seikatsuhi || 0) };
}
function yPayBill() {
  const c = G.ch2; if (!c) return;
  if (!c.nextBill) c.nextBill = G.day + (CONF.billEvery || 30);
  if (G.day < c.nextBill) return;
  const b = yBillLines();
  c.nextBill = G.day + (CONF.billEvery || 30);
  const short = G.cash < b.total;                       // 払い切れない
  G.cash -= b.total;
  G.debt = Math.max(0, (G.debt || 0) - b.prin);
  log(`🏦 支払日。地代 ${yen(b.chidai)}／返済 ${yen(b.pay)}／生活費 ${yen(b.life)}`);
  if (b.prin > 0) log(`　　元本が ${yen(b.prin)} 減った（残債 ${manYen(G.debt)}）`);
  if (short) {
    c.billMissed = true;
    toast('⚠ 支払いが足りなかった…（信金の追加融資は、もう通らない）');
    log('⚠ 支払いを落とした。信用金庫の融資課は、この行を見る');
  } else {
    toast(`🏦 今月の支払い ${yen(b.total)} を済ませた`);
  }
}

/* 申し込んでおいた融資が振り込まれる日（14日かかる＝明日の金にはならない） */
function yCheckKouko() {
  const c = G.ch2; if (!c || !c.koukoAt) return;
  if (G.day < c.koukoAt) return;
  const amt = c.koukoAmt || 0;
  G.cash += amt; G.debt = (G.debt || 0) + amt;
  c.koukoAt = null; c.koukoAmt = 0;
  log(`🏦 信用金庫から ${manYen(amt)} が振り込まれた（残債 ${manYen(G.debt)}）`);
  toast(`🏦 融資 ${manYen(amt)} 入金`);
}

/* ============ サウナを建てるほど客が増える（作者指摘 8/5）============
   第1章は id を名指しして「サウナ1なら+3」と足していたが、第2章の id は別物なので
   **何室建てても客が1人も増えていなかった**。ここで章の側から足す。
   ・部屋の数ではなく**入れる人数**で効かせる＝大きい部屋ほど街から人を呼ぶ
   ・水風呂と、ととのいイスも同じ考え方（サウナだけあっても客は来ない）      */
function yGuestBonus() {
  let n = 0;
  for (const e of (G.equip || [])) {
    const d = EQ[e.id]; if (!d || e.cond <= 0) continue;
    if (d.cat === 'sauna') n += Math.round((d.cap || 1) * 0.5);   // 6人室で+3（第1章の一台目と同じ）
    else if (d.cat === 'mizu') n += 2;                            // 水風呂のある店だと分かると人が来る
    // ととのいイス（待合の丸太ベンチは数えない＝あれは整う場所ではない）
    else if (d.cat === 'rest' && d.area !== AY.FRONT) n += 0.4;
  }
  return Math.round(n);
}

/* 営業時間は章が持つ（game.js の openHourNow / closeHourNow から引かれる） */
/* ============ 営業時間ぶんの客足（作者決定 8/5）============
   **長く開ければ客は増える。ただし時間帯によって太さが違う。**
   1時間あたりの重み（既定の12〜24時を 1.0 として数える）
     朝6〜9時 … 0.35（朝ウナは細いが、確かに居る）
     9〜11時  … 0.5
     11〜17時 … 1.0（昼の本流）
     17〜22時 … 1.3（仕事帰り＝いちばん太い）
     22〜24時 … 0.8
   ＝**既定の12時間ぶんを1.0倍**として、伸ばした・縮めたぶんを掛ける。
   深夜（24時以降）は既存の深夜営業が受け持つので、ここでは数えない        */
function yHourWeight(h) {
  if (h < 6)  return 0;
  if (h < 9)  return 0.35;
  if (h < 11) return 0.5;
  if (h < 17) return 1.0;
  if (h < 22) return 1.3;
  if (h < 24) return 0.5;
  /* ここから先は**深夜**（24時＝翌0時以降。同じ一日の続きとして数える）。
     終電のあとに来る客なので数は少ないが、ゼロにはならない＝
     開けている店が他に無いぶん、遠くからでも来る。
     明け方（翌5時〜）は流し込みの朝風呂まで、いちばん薄い時間が続く。

     **深夜帯は意図して薄くしてある**（作者決定 8/5）。ここを厚くすると、
     ラウンジを建てて深夜を開けたその日に客数が1.55倍に跳ね、
     それまで積み上げた増築の手応えが一日で霞む。いまの重みなら **×1.32** に収まる。
     深夜の稼ぎは頭数ではなく**深夜料金 +¥500**で取る                       */
  if (h < 27) return 0.25;      // 翌0時〜3時（終電を逃した客・仕事帰り）
  if (h < 29) return 0.1;       // 翌3時〜5時
  if (h < 32) return 0.18;      // 翌5時〜8時（朝風呂）
  return 0.1;                   // 翌8時〜10時（チェックアウトの時間帯）
}
/* ============ 来店時刻（作者決定 8/5）============
   game.js が持っている曲線は**第1章の9時〜24時**の形で、第2章では
   `shrink = 営業時間/900` で機械的に伸縮されるだけだった。
   深夜営業（15時〜翌10時）だと、**第1章の夕方の山が翌1時に来ていた**。
   一方 yHourWeight は「17〜21時が山」と言っている＝**同じ店で2つの時計が動いていた**。
   ここで yHourWeight に一本化する＝「何人来るか」と「いつ来るか」が同じ物差しになる。
   ついでに、第1章の式が閉店間際に振って捨てていた約2.5%の取りこぼしも消える  */
function ySpawnTimes(n) {
  const o = yOpenHour();
  const close = (typeof closeHourNow === 'function') ? closeHourNow() : yCloseHour();
  const w = []; let sum = 0;
  /* 建物の時計（yHourWeight）だけでなく、**その時刻に来る客層をどれだけ掴んでいるか**
     （yMixAt）も掛ける＝老人にしか支持されていない店は、夕方だけが混んで夜は空く */
  for (let h = o; h < close; h++) { const v = yHourDemand(h); w.push(v); sum += v; }
  if (!sum) return [];
  const last = (close - o) * 60 - 30;          // 閉店30分前で締める（入っても何もできない）
  const out = [];
  for (let i = 0; i < n; i++) {
    let r = Math.random() * sum, h = 0;
    for (; h < w.length - 1; h++) { r -= w[h]; if (r <= 0) break; }
    out.push(Math.min((h + Math.random()) * 60, last));
  }
  return out;
}
registerChapter2Hooks({ spawnTimes: ySpawnTimes });
/* **物差しは「既定の営業時間」**（CONF.openHour〜closeHour）。そこがちょうど1.0倍で、
   伸ばせば増え、縮めれば減る。
   ここを 12〜24時と直書きしていたので、既定を 15〜22時に変えた瞬間、
   **何もしていないのに見込み客が3割5分消える**ところだった（作者決定 8/5 で発見）。
   時刻の直書きは章をまたぐと必ず壊れる＝既定そのものを見に行く            */
function yHoursGuestMul() {
  let now = 0, base = 0;
  // 深夜まで開けた夜は、その時間ぶんの客も数える（closeHourNow＝深夜なら34時）
  const close = (typeof closeHourNow === 'function') ? closeHourNow() : yCloseHour();
  /* 分子には客層の掴み具合（yMixAt）を掛け、**分母には掛けない**。
     分母＝「既定の時間だけ開けていて、どの層からも普通に支持されている店」＝1.0倍。
     ここを両方に掛けると比が約分されて消える＝昼だけの店では支持が総客数に
     1ミリも効かなくなる（実測で発見 8/5）。片側だけに掛けることで、

       ・どの層にも応えられていない → 1.0を下回る（開けていても客は来ない）
       ・全部の層に応えている       → 最大1.5倍（mixMax）
       ・子連れを断つ              → その層が来るはずだった時間帯ぶん、丸ごと減る

     ＝**売上を伸ばすには、全部の層に応えて、全部の時間帯を埋めるしかない**    */
  for (let h = yOpenHour(); h < close; h++) now += yHourDemand(h);
  for (let h = CONF.openHour; h < CONF.closeHour; h++) base += yHourWeight(h);
  return base ? now / base : 1;
}
registerChapter2Hooks({ scheduleDay: yScheduleDay, guestBonus: yGuestBonus,
                        openHour: () => yOpenHour(), closeHour: () => yCloseHour() });

/* ============================================================
   客層 × 時間帯 × 支持（作者決定 2026-08-05）
   ------------------------------------------------------------
   ここまでの第2章は、こういう店だった。

     ・一日じゅう同じ比率で客が来る（15時の風呂に女子大生、深夜3時に子連れ）
     ・客層ごとの満足度は**データ画面に出るだけ**。翌日の来店数に1ミリも効かない
     ・G.regulars は店全体でひとつの数字＝「老人には支持されているが
       女子大生には見放されている」が表せない

   現実の風呂屋はそうではない。**同じ店が、時間帯でまるごと別の店になる**し、
   応えた層は増え、裏切った層は消える。そこに合わせる。

     ① 時間帯ごとの客層比率 … TYPES_Y の `hour` ＝ HOUR_CURVES_Y（data_y.js）
     ② 層ごとの支持         … G.ch2.segFan。満足した新規で +1／離れた常連で −1
     ③ ①×② で「その時刻に、誰がどれだけ来るか」が決まる（yCustWeightMul）
     ④ ①×② をならしたものが「その時刻の客足の太さ」（yMixAt → yHourDemand）
        ＝**開けている時間ぶん来る**のではなく、**掴んでいる層が来る時間だけ来る**

   ＝売上を伸ばすには、**全部の層に応えて、全部の時間帯を埋める**しかない。
     どれかひとつを捨てれば、その層と、その層が来る時間帯が丸ごと欠ける。
   ============================================================ */
function ySegFanMap() {
  if (!G.ch2) return {};
  if (!G.ch2.segFan) G.ch2.segFan = {};
  return G.ch2.segFan;
}
function ySegFanOf(segKey) { return ySegFanMap()[segKey] || 0; }
/* game.js が常連の増減を書いた、まさにその場で呼ばれる（chHook('segFan', c, ±1)）。
   ＝**店全体の常連と、層ごとの支持は、必ず同じ出来事から動く**（二重計上しない） */
function ySegFan(c, d) {
  if (!G.ch2 || typeof segOf !== 'function') return;
  const k = segOf(c && c.typeKey); if (!k) return;
  const m = ySegFanMap();
  m[k] = clamp((m[k] || 0) + d, CONF.segFanMin, CONF.segFanMax);
}
/* 支持 → 来店の重みの倍率。支持ゼロ＝1.0（＝この仕掛けを入れる前とまったく同じ） */
function ySegMulOf(segKey) {
  if (!G.ch2 || !segKey) return 1;
  return clamp(1 + ySegFanOf(segKey) / (CONF.segFanFull || 80), CONF.segMulMin, CONF.segMulMax);
}
function ySegMul(typeKey) {
  if (!G.ch2 || typeof segOf !== 'function') return 1;
  return ySegMulOf(segOf(typeKey));
}
/* その客層が、その時刻にどれだけ来やすいか。`hour` を書いていない客は一日じゅう平ら */
function yHourCurve(typeKey, h) {
  const t = TYPES[typeKey]; if (!t) return 0;
  const cv = (typeof HOUR_CURVES_Y === 'object') && HOUR_CURVES_Y[t.hour];
  if (!cv) return 1;
  const hh = ((Math.floor(h) % 24) + 24) % 24;      // 翌1時＝25 も 1 として読む
  return (cv[hh] !== undefined) ? cv[hh] : (cv.d !== undefined ? cv.d : 1);
}
/* いま何時か。**開店からの経過**で数える（深夜営業なら 24 を超えて 34 まで伸びる） */
function yRawHour() { return yOpenHour() + (G.minutes || 0) / 60; }
/* game.js の custWeight から掛かる。抽選のたびに「いまの時刻」で引き直される */
function yCustWeightMul(k) {
  if (!G.ch2) return 1;
  return yHourCurve(k, yRawHour()) * ySegMul(k);
}
/* その時刻に、その客層が**構造的に**来られるか（増築・深夜解放・20時の締め切り）。
   これは店の都合ではないので、下の yMixAt では分母からも外す＝
   「3Fを建てていないから女性が来ない」は、夕方の客足が細る理由にはしない */
function yTypeAvail(k, h) {
  const t = TYPES[k]; if (!t || t.kid) return false;      // 子どもは親に付いてくる＝抽選に出ない
  if (CONF.menOnly && t.sex !== 'm') return false;        // 女湯を開けるまで女性客は来ない
  if (t.needArea != null && !yBuilt(t.needArea)) return false;
  if (t.night && !(G.opts && G.opts.nightOpen)) return false;
  if (t.withKid && h >= KID_LAST_HOUR_Y) return false;    // 20時以降に家族連れは居ない
  return true;
}
/* 評判の減点から「入墨・ヤクザが入店できる −30」を外す（作者判断 2026-08-06）。

   第1章の減点をそのまま引き継いでいて、**第2章では二重取りになっていた。**
   この章の強面の客は「熱波銀座の店で来ないほうが嘘」＝正規の客層のひとつで、
   デメリットはすでに2つ持っている。

     ・**子連れが来なくなる**（SEG_WANTS_Y の m_kozure / f_kozure が
       「怖い客がいない」を6点ぶん求めている＝断らない限り、その分が入らない）
     ・**居合わせた客の満足度が落ちる**（yYakuzaGripe。いちばん堪えるのは子連れ）

   そこへ評判−30が乗ると、受け入れている限り評判の天井が70点になり、
   実質「【刺青・ヤクザお断り】を選ばないと詰む」＝選択にならない。
   ついでに減点の説明文（`kitoAccepted() ? '鬼頭と交わした約束がある' : …`）も、
   鬼頭のいないこの章では宙に浮いていた。

   ※30日通してみて見つけた（CHAPTER2_B.md §11-30）。第1章の −30 はそのまま。

   ついでに副題も直す。共有側の文言は「置き場を設置する（**無料**）」で、
   **第1章では正しい**（js/data.js の matrack / akarack は price: 0）。
   値段が付いているのはこの章のほう（¥60,000／¥50,000）なので、
   直すのは第1章の文言ではなく、ここ。 */
const Y_RACK_PRICE = { mat: 'matrack', akasuri: 'akarack' };

function yRepPenalties(p) {
  return p.filter(x => x.k !== 'yakuza').map(x => {
    const id = Y_RACK_PRICE[x.k];
    if (!id || !EQ[id]) return x;
    return { ...x, sub: '浴室に置き場を設置する（' + yenShort(EQ[id].price) + '）' };
  });
}

/* **来られるのに、来させていない層**。ここだけは分子からしか引かない＝
   断った瞬間、その層が来るはずだった時間帯の客足が本当に細る */
function yTypeBanned(k) {
  if ((TYPES[k] || {}).tattoo) return !!(G.opts && G.opts.banYakuza);   // 刺青・ヤクザお断り
  if (!kidOf(k) && !(TYPES[k] || {}).kid) return false;
  if (G.opts && G.opts.banKids) return true;              // 小学生以下お断り
  if (typeof kidFeeOK === 'function' && !kidFeeOK()) return true;   // 子供料金が目安より高い
  return false;
}
function yBaseW(k) {
  const t = TYPES[k] || {};
  return (t.w || 0) + (hasCat('sauna') ? (t.wSauna || 0) : 0);
}
/* その時刻の客足が、いまの店でどれだけ太いか／細いか（1.0＝ならし）
     分母＝その時刻に来られる層が、**普通に**支持してくれている場合
     分子＝実際の支持ぶん、断っている層を抜いたぶん
   支持が全部ゼロで、誰も断っていなければ、分子＝分母＝1.0＝**従来とまったく同じ** */
function yMixAt(h) {
  let now = 0, base = 0;
  for (const k in TYPES) {
    if (!yTypeAvail(k, h)) continue;
    const w0 = yBaseW(k); if (!w0) continue;
    const cw = w0 * yHourCurve(k, h);
    base += cw;
    if (!yTypeBanned(k)) now += cw * ySegMul(k);
  }
  return base ? clamp(now / base, CONF.mixMin || 0.6, CONF.mixMax || 1.5) : 1;
}
/* 時刻ごとの客足＝**建物の時計 × そこに来る客層をどれだけ掴んでいるか** */
function yHourDemand(h) { return yHourWeight(h) * yMixAt(h); }

/* ── データ画面の「時間帯ごとの客」──────────────────────────
   何時が太くて、何時が空いていて、その時間に誰が来ているのか。
   **売上を伸ばす手が「どの層に応えるか」だけでなく「どの時間を埋めるか」でもある**
   ことを、数字で見せるための表。ここが読めないと、深夜を開ける判断ができない  */
function yHourTable() {
  const o = yOpenHour();
  const close = (typeof closeHourNow === 'function') ? closeHourNow() : yCloseHour();
  const rows = [];
  for (let h = o; h < close; h++) {
    const d = yHourDemand(h);
    // その時刻にいちばん多く来る層（実際の抽選と同じ重みで数える）
    const mix = {};
    for (const k in TYPES) {
      if (!yTypeAvail(k, h) || yTypeBanned(k)) continue;
      const w0 = yBaseW(k); if (!w0) continue;
      const sg = (typeof segOf === 'function') ? segOf(k) : null; if (!sg) continue;
      mix[sg] = (mix[sg] || 0) + w0 * yHourCurve(k, h) * ySegMul(k);
    }
    const top = Object.keys(mix).sort((a, b) => mix[b] - mix[a]).slice(0, 2);
    const segName = s => { const g = SEGMENTS.find(x => x.key === s); return g ? (g.sex === 'f' ? '♀' : '♂') + g.name : s; };
    rows.push({ h, demand: d, mix: yMixAt(h), top: top.map(segName) });
  }
  return rows;
}
/* 見込み客のうち、その1時間に何人来るか（yHourTable の重みを人数に割り直す） */
function yHourGuests(rows, total) {
  const sum = rows.reduce((a, r) => a + r.demand, 0);
  return rows.map(r => (sum ? Math.round(total * r.demand / sum) : 0));
}

registerChapter2Hooks({ custWeightMul: yCustWeightMul, segFan: ySegFan });

/* ============ 日報のあとに ============
   その日の会計の件数を控えて（累計来客＝増築の条件）、
   **ライバルの反撃**を1日ぶん動かす（battle_y.js）。
   日報の下に、増築と大会の状況を1行ずつ足す                                */
function yDayReportExtra() {
  if (G.ch2) G.ch2.lastPaid = (G.today && G.today.paid) || 0;
  /* 一日ぶんの疲れ。**立っていた時間ぶん**（人のいない階が多いほど1時間が重い） */
  let stamLine = '';
  if (CONF.gauges && typeof yStamDrain === 'function' && CONF.stamMax) {
    /* **出勤しなかった日は削れない**（立っていないので当たり前）。
       代わりに、その日の店は妻ひとりで回っている＝日報の数字がそれを語る */
    const worked = (typeof yWorkToday !== 'function') || yWorkToday();
    const d = worked ? yStamDrain() : 0, empty = yEmptyFloors(), hrs = yWorkHours(), per = yStamPerHour();
    yStamAdd(-d);
    /* **倒れるのは閉店の時点で見る**（2026-08-08 修正）。
       以前は準備画面で見ていたが、そこは**翌朝の回復（+25）を足したあと**なので、
       体力は 25 に張り付いて**一度も倒れなかった**（100日の実測で0回）。
       いま尽きたら、その場で倒れて**翌日を休業**にする＝病院の一枚絵もそこで出る */
    if (worked && (G.stam ?? CONF.stamMax) <= 0 && typeof yCollapse === 'function') yCollapse();
    if (!worked) {
      stamLine = '<div class="rep-row">🏠 今日は店に出なかった'
        + '<span class="opt-sub">（' + (WIFE_Y ? WIFE_Y.name : '妻') + 'がひとりで番台に立った）</span>'
        + '　体力 ' + Math.round((G.stam ?? CONF.stamMax)) + '</div>';
    } else
    stamLine = '<div class="rep-row">😮‍💨 一日ぶんの疲れ　−' + d
      + '<span class="opt-sub">（' + hrs + '時間 × ' + per
      + (empty ? '／人のいない階が' + empty + 'つ' : '') + '）</span>'
      + '　残り体力 ' + Math.round((G.stam ?? CONF.stamMax)) + '</div>';
  }
  /* 妻の機嫌は、その日の収支で静かに動く（大きく動くのは決断と、休みの日） */
  /* **妻の機嫌はコスト**（作者決定 8/8）。放っておくと下がる一方で、
     戻せるのは「妻と出かける」だけ。
     以前は**黒字の日に毎日 +2** 入っていたので、反対を押し切った −5〜−12 を
     数日で埋め戻してしまい、30日の実測で**ずっと100のまま**だった。
       ・毎日 −2 …… 家に帰らず店にいる
       ・深夜 −2 …… 帰りが翌朝になる（重ねて効く）
       ・赤字 −3 …… 金の心配は伝わる                                      */
  if (typeof yMoodAdd === 'function') {
    const p = (G.today && G.today.profit) || 0;
    yMoodAdd(-2);
    if (p < 0) yMoodAdd(-3);
    if (G.ch2 && G.ch2.night >= 1) yMoodAdd(-2);
  }
  /* **その日の商売が、そのままストレスになる**（下の yStressOfDay で計算） */
  if (typeof yStressOfDay === 'function') yStressOfDay();
  /* 直近10日、黒字だったかを覚えておく。**信金の枠はここで開く**（融資課は数字しか見ない） */
  if (G.ch2) {
    G.ch2.profitDays = (G.ch2.profitDays || [])
      .concat([((G.today && G.today.profit) || 0) > 0]).slice(-10);
  }
  if (typeof yBattleDaily === 'function') yBattleDaily();   // 大会の通期記録（番付・収支）
  const strikes = (typeof yRivalStrikeBack === 'function') ? yRivalStrikeBack() : null;
  let html = yUriageRows() + stamLine + yCapReportRows();   // 売上の内訳／入口で帰した人／器が足りずに来られなかった人
  const k = yKouji();
  if (k) {
    const a = AREAS_Y[k.f] || {};
    html += '<div class="rep-row">🏗 ' + (a.lvl || '') + '階の工事　あと' + Math.max(0, k.until - G.day) + '日</div>';
  }
  /* 支払日が近づいたら知らせる（**黙って持っていかれない**）。落とすと信金の門が閉じるので */
  if (G.ch2 && G.ch2.nextBill) {
    const d = G.ch2.nextBill - G.day;
    if (d <= 5) {
      const b = yBillLines();
      html += '<div class="rep-row">🏦 あと' + Math.max(0, d) + '日で支払日　'
           + yen(b.total) + '<span class="opt-sub">（地代・返済・生活費）</span></div>';
    }
  }
  if (G.ch2 && G.ch2.koukoAt) {
    html += '<div class="rep-row">🏦 融資の振り込みまで あと'
         + Math.max(0, G.ch2.koukoAt - G.day) + '日</div>';
  }
  /* 番付は**大会を知ってから**しか出さない（作者指定）。
     開業したての主人公は、そんな大会があることを知らない */
  if (G.ch2 && G.ch2.battleKnown && typeof yGapToBoss === 'function') {
    const g = yGapToBoss();
    html += '<div class="rep-row">🏆 ととのい番付　合計' + g.me + '点　'
         + (g.gap > 0 ? '1位まで あと' + g.gap + '点' : 'いま1位に立っている') + '</div>';
  }
  if (G.ch2 && G.ch2.battleKnown && strikes && strikes.length) {
    html += strikes.map(t => '<div class="rep-row">⚔ ' + t + '</div>').join('');
  }
  /* 大会のお知らせ（予選の開始・結果・中間発表）。出したら空にする */
  if (G.ch2 && G.ch2.battle && G.ch2.battle.news && G.ch2.battle.news.length) {
    html += G.ch2.battle.news.map(t => '<div class="rep-row">' + t + '</div>').join('');
    G.ch2.battle.news = [];
  }
  return html || null;
}

registerChapter2Hooks({ dayReportExtra: yDayReportExtra });

/* ============================================================
   妻（共同経営者）
   ------------------------------------------------------------
   **雇っていない。給料も出ていない。二人で決めて、二人で背負う。**
   ・1階のフロントに常時いる（スタッフ枠を使わない・日給ゼロ）
   ・**金の使いどころで、決める前に一度止める。** 通すか、引っ込めるかはプレイヤー
   ・メーターは持たない（作者指定）。押し切った回数は台詞の温度だけに使う
   ============================================================ */
const WIFE_Y = { name: '奈津', short: '妻', age: 38 };

/* ============================================================
   第2章のオープニング（作者決定 2026-08-08）
   ------------------------------------------------------------
   伝えるのは4つだけ。**説明ではなく、場面で**。
     ① 夕凪湯を建て直したあと、会社員に戻り、転勤でととのい市へ来た
     ② 結婚して、妻（奈津）がいる
     ③ 「自分のサウナを作りたい」で一念発起して起業した
     ④ 目指すのは**ととのい市サウナバトルの優勝**

   絵は `gate` `office` が第1章の描画、`y_living` `y_tenku_sauna_in` は第2章の使い回し、
   `y_intro_minato`（夜の外気ベイと観覧車）は**この冒頭のために描き下ろした一枚**。
   ⚠ 家の絵のキーは **`y_living`**（`living` ではない。ファイル名と食い違っている）。
   ⚠ 第1章の続きであることを、台詞ではなく**絵で**先に出す（1枚目が夕凪湯の門）。
   ⚠ **一枚絵の文字送りはタグを解釈しない**（textContent）＝`<b>` も `**` も
     そのまま画面に出る。強調したい語は**言葉の置き方**で立てること           */
const Y_INTRO_Y = [
  /* 台本の正本＝docs/INTRO_SCRIPT.md v4（壁打ち3往復・判定GO・2026-08-09）。
     直すときは正本を直してから、ここへ逐語で写す */
  { art: 'gate', lines: [
    { narr: true, text: '夕凪湯を建て直して、親父に返した。あれから、六年。' },
    { sp: '俺', text: '（暖簾は、出てる。……ここは、もう大丈夫だ）' },
  ]},
  { art: 'office', lines: [
    { narr: true, text: '俺はまた会社員に戻った。温浴メーカーの営業。サウナストーブを売って、人の店を回る毎日。' },
    { narr: true, text: '人の店を良くするたび、思った。俺の店なら、どうする。' },
    { narr: true, text: '三年目の春、転勤の辞令が出た。行き先は、ととのい市。' },
    { sp: '俺', text: 'ととのい市か' },
    { narr: true, text: '辞令を、二度読んだ。' },
  ]},
  { art: 'y_living', lines: [
    { narr: true, text: 'ととのい市で所帯を持った。妻の奈津とは社内結婚。' },
    { narr: true, text: '休みの日は、二人で市内のサウナを開拓した。ちゃぶ台の脇に、ノートが増えていった。' },
    { narr: true, text: '動線、椅子の数、水風呂の温度。' },
    { sp: '奈津', text: '水風呂、十六度だった。あなた、十七って書いてたけど' },
    { sp: '俺', text: '……直しとく' },
    { narr: true, text: '二冊目から、ノートの字は二人ぶんになった。' },
  ]},
  { art: 'y_intro_minato', lines: [
    { narr: true, text: 'ある夜。観覧車が海に映る、外気ベイの岸だった。' },
    { sp: '俺', text: 'なあ……俺たちのサウナを作らないか？　熱波銀座に、良い物件があるんだ' },
    { sp: '奈津', text: '知ってる。あなた、あの物件の前で三回、足を止めてた' },
    { sp: '俺', text: '……見てたのか' },
    { sp: '奈津', text: '帳簿は私。熱はあなた。それでよければ、契約しようか' },
    { sp: '俺', text: '元手は' },
    { sp: '奈津', text: '半分ある。三冊目のノートを買った日から、貯めてた' },
    { narr: true, text: 'それ以上は、聞けなかった。' },
  ]},
  { art: 'y_tenku_meshi', lines: [
    { narr: true, text: '契約の帰り、二人で王者の店に寄った。風呂を上がって、食事処で落ち合う。' },
    { sp: '俺', text: '悔しいが、ととのっちまった。サ室のストーブ、納めたのは俺だ' },
    { sp: '奈津', text: '言われなくても、顔に書いてある' },
    /* 上の帯「番付 N/800」に、ここで意味を渡す（呼称はUIの「ととのい番付」と一致させる） */
    { narr: true, text: '食事処の壁に、ととのい番付の額。八つの部門を百点ずつ、合わせて八百点。' },
    { sp: '奈津', text: 'サウナバトル六連覇、SAUNA GATE 37。番付は六百五十。頭ひとつ抜けてる' },
    { sp: '俺', text: '出る。次の大会に' },
    { narr: true, text: '——挑戦は、王者の店から始まった。' },
  ]},
];

/* ============ 制作中のスイッチ（作者指定 8/9）============
   テストのたびに冒頭の5枚を見るのがしんどいので、いまは飛ばす。
   台本（Y_INTRO_Y）は上にそのまま残してあるので、**ここを true に戻せば流れる。**
   ⚠ **出す前に必ず true へ戻すこと。**
   空の配列を返すと game.js（11129行）が物語を飛ばして、いきなり屋号決めへ進む。
   旧候補の PLAY_PROLOGUE2（js/ch2/story2.js:115）と同じやり方             */
const PLAY_INTRO_Y = true;    // 本番に戻した（2026-08-09。制作中だけ false）


function yWife() {
  if (G.ch2 && !G.ch2.wife) G.ch2.wife = { pushed: 0, stopped: 0 };
  return (G.ch2 && G.ch2.wife) || { pushed: 0, stopped: 0 };
}

/* ============ 妻が口を出す「正当性」（作者指定 8/5） ============
   **金額の大きさでは止めない。** 彼女が止めるのは、
   ・その買い物のせいで、来月の支払いが危うくなる時
   ・手元が薄くなる時
   ・一度に手元の半分が飛ぶ時
   ――つまり「言うだけの理由がある」時だけ。
   逆に、**まだ一つも無い部門の一台目**（＝店として要る物）には、いくらしても何も言わない。
   水風呂もサウナも湯船もない店で「¥40万は高い」と言うのは、彼女の言い分ではない。   */
const WIFE_MUST_CATS_Y = ['sauna', 'mizu', 'furo', 'wash', 'datsui', 'locker', 'rest', 'front'];
const WIFE_THIN_Y = 1000000;      // 買ったあと手元がこれを切ると、さすがに一度止める
const WIFE_MIN_Y  = 200000;       // これ未満の買い物には、いちいち口を出さない
/* **一日の積み重ね**（作者指定 8/5）。一つ一つは小さくても、朝からの合計が
   その日の所持金の2割を超えたら、彼女は「今日はもうやめて」と言う。
   ただし**一発目には言わない**（まだ何も使っていない日に「使いすぎ」は言えない）  */
const WIFE_DAY_RATE_Y = 0.2;
const WIFE_DAY_MIN_Y  = 50000;    // 積み重ねでも、これ未満の小物では止めない
/* **最初の一週間は黙っている**（作者指定 8/5）。
   店を開ける形にするまでの買い物に一々口を出されると、始まりが重い。
   ここは「一緒に始めた側」として、彼女も黙って見ている               */
const WIFE_GRACE_Y = 7;
/* **小言は一日一回まで**（同上）。言われた日は、その日はもう止めない＝
   何度も同じ顔で出てくると小言そのものが軽くなる                     */

/* 押し切られた時に、機嫌がどれだけ下がるか（→ CHAPTER2_B.md §9-6） */
const WIFE_PUSH_MOOD_Y = { equip: -5, fee: -8, zou: -8, kouko: -12, sarakin: -12 };

/* 今日、店の金をいくら出したか（買い物・移動・修理。朝にゼロへ戻る） */
function ySpentToday() {
  return (G.invBuy || 0) + (G.invMove || 0) + (G.invFix || 0);
}

/* その部門の一台目か（＝これが無いと商売にならない物） */
function yWifeMustHave(id) {
  const cat = ((typeof EQ !== 'undefined' && EQ[id]) || {}).cat;
  if (!cat || WIFE_MUST_CATS_Y.indexOf(cat) < 0) return false;
  return !(G.equip || []).some(e => ((EQ[e.id] || {}).cat) === cat);
}

/* 止める理由。無ければ null＝黙って通す */
function yWifeWhy(amount, id) {
  if (yWifeMustHave(id)) return null;                    // 一台目には何も言わない
  /* 一日の合計。**今日すでに何か買っている時だけ**＝「まだ買うの？」が成り立つ場面。
     一つ一つは小さくても積み重なるので、ここだけは¥20万の線より下でも見る */
  const am = G.cashAtDayStart || 0, spent = ySpentToday();
  const today = (am > 0 && spent > 0 && amount >= WIFE_DAY_MIN_Y
              && (spent + amount) >= am * WIFE_DAY_RATE_Y) ? 'today' : null;
  if (amount < WIFE_MIN_Y) return today;                 // 小物は、積み重ねの時だけ止める
  const cash = Math.max(0, G.cash), left = cash - amount;
  const bill = (typeof yBillLines === 'function') ? yBillLines().total : 0;
  if (bill && left < bill)  return 'bill';               // 買うと、来月の支払いが払えない
  if (left < WIFE_THIN_Y)   return 'thin';               // 手元が百万を切る
  if (amount > cash * 0.5)  return 'half';               // 一度に手元の半分
  if (G.ch2 && G.ch2.billMissed && amount >= 500000) return 'missed';  // 一度落としている
  return today;
}

/* 妻が口を出す場面か（金額が小さいものにはいちいち言わない） */
function yWifeSpeaks(kind, amount, id) {
  if (kind === 'zou') return true;                       // 増築は必ず一度止まる
  if (kind === 'kouko') return true;                     // 借金は、額の大小にかかわらず必ず止まる
  if (kind === 'sarakin') return true;                   // サラ金はなおさら
  if (kind === 'equip') {
    if ((G.day || 1) <= WIFE_GRACE_Y) return false;         // 最初の一週間は黙っている
    if (yWife().nagDay === G.day) return false;             // 今日はもう一度言った
    return !!yWifeWhy(amount, id);
  }
  /* 値上げは**上げる時だけ**止まる。しかも「目安」を超えた時だけ＝
     設備に見合った値付けなら、彼女は何も言わない（払った額に見合っているから）  */
  if (kind === 'fee') {
    if (!id || id.to <= id.from) return false;           // 据え置き・値下げには口を出さない
    const guide = id.act === 'saunaFee'
      ? (typeof worthSaunaFee === 'function' ? worthSaunaFee() : 0)
      : (typeof worthFee === 'function' ? worthFee() : 0);
    return id.to > guide;                                // 目安を超えた＝客が納得しない値付け
  }
  return true;
}

/* その場のひと言。**残りの金**と、**押し切られた回数**で温度が変わる */
function yWifeLine(kind, amount, id) {
  const left = G.cash - amount;
  const tight = left < 2000000;
  const w = yWife();
  /* 信金からの追加融資。**返すのは二人**なので、ここがいちばん長く止まる */
  if (kind === 'kouko') {
    const b = (typeof yBillLines === 'function') ? yBillLines() : null;
    const add = Math.round(amount * (CONF.hensaiRate || 0.0124));
    return (G.ch2 && G.ch2.billMissed)
      ? '一度落としてるのよ、私たち。それでもまだ借りるの。'
      : (w.pushed >= 3
        ? 'もう止めない。ただ、毎月あと' + yen(add) + '。それを稼ぐのはあなたじゃなくて、この店よ。'
        : manYen(amount) + '。……返すのは7年。毎月の支払いが '
          + (b ? yen(b.total) : '') + ' から、あと ' + yen(add) + ' 増える。それでも、いま借りる？');
  }
  /* サラ金。ここだけは、彼女の声が変わる */
  if (kind === 'sarakin') {
    return '待って。……そこは駄目。<br>年20%よ。それに、そこに手を出したら信用金庫はもう貸してくれない。'
         + '一度借りたら、あの人たちは毎週水曜に来るの。';
  }
  /* 値上げ。金を出す時とは逆で、**客のほうを向いて**止める */
  if (kind === 'fee') {
    const guide = id && id.act === 'saunaFee'
      ? (typeof worthSaunaFee === 'function' ? worthSaunaFee() : 0)
      : (typeof worthFee === 'function' ? worthFee() : 0);
    return w.pushed >= 3
      ? 'また上げるの。……いいわ。でも、離れた常連は戻ってこないからね。'
      : '¥' + (id ? id.to : amount).toLocaleString() + 'は、いまのうちの中身に見合ってない。'
        + '目安は¥' + guide.toLocaleString() + 'よ。<br>'
        + '一度「高い店」だと思われたら、設備を足しても、その人はもう来ないの。';
  }
  if (kind === 'zou') {
    return tight
      ? '……上に積むのはいい。でも、それを払ったら手元がほとんど残らない。工事のあいだも、うちは毎日開けるのよ。'
      : (w.pushed >= 3
        ? 'また建てるの。……いいわ。あなたがそう言うなら、そういう店なんでしょう。'
        : '上に積むのね。工事のあいだ、下の階は落ち着かなくなる。それを分かって決めた？');
  }
  if (kind === 'equip') return yWifeEquipLine(amount, id);
  return 'ちょっと待って。それ、いま決めることかしら。';
}

/* ============ 買い物のときのひと言 ============
   止めた理由ごとに引き出しを持たせる（作者指定 8/5＝レパートリーが少ない）。
   同じ理由でも、前に言った台詞は続けて出ない                                */
const WIFE_EQ_LINES_Y = {
  /* 来月の支払いが払えなくなる。いちばん強く止まるのはここ */
  bill: [
    'それを買ったら、来月の支払いが回らない。……本当に、いまじゃないと駄目？',
    '待って。地代と返済と、うちの生活費。来月出ていくぶんが手元に残らないの。',
    '欲しいのは分かる。でも、支払日はこっちの都合を待ってくれないのよ。',
    '買うのは自由よ。ただ、月末に頭を下げに行くのは私だからね。'
  ],
  /* 買うと手元が薄くなる */
  thin: [
    '……それを払うと、手元がほとんど残らない。ボイラーが一台止まったら、それで終わりよ。',
    'それを払ったら、あと百万も無い。何かあった時のぶんは、残しておきたいの。',
    '足りなくなってから借りるのって、いちばん高くつくのよ。分かってる？',
    'いま買わないと死ぬ物なの？　来月でもいい物なら、来月にして。'
  ],
  /* 一度に手元の半分が飛ぶ */
  half: [
    '一回で、いまある金の半分。……それ、後戻りできる買い物？',
    'まとめて使うのが怖いんじゃないの。減ったあとに何ができるか、見えてないのが怖いの。',
    '半分よ、半分。せめて、それが何日で戻ってくるか言ってみて。',
    'それを置いたら、次の一手は当分打てない。それでもいい？'
  ],
  /* 一日でそれだけ使った。金額そのものより、**手が止まらないこと**を止める */
  today: [
    'まだそんなもの買うの？　今日、もうずいぶん出ていってるのよ。',
    '今日、お金使いすぎじゃない？　一日で減ったぶん、私はちゃんと見てるからね。',
    '朝からいくつ買ったか、数えてる？　……私は数えてるの。',
    '一日で全部やらなくていいでしょう。明日も明後日も、この店は開くのよ。'
  ],
  /* 一度支払いを落としている。声が少し硬くなる */
  missed: [
    '一度落としてるのよ、私たち。それを忘れて、また大きい買い物？',
    '前に払えなかった月のこと、信金はまだ覚えてる。……私も覚えてる。',
    '欲しい物を我慢しろとは言わない。ただ、順番だけは間違えないで。'
  ],
  /* 何度も押し切られたあと。止めるのをやめた声 */
  pushed: [
    '止めても買うでしょう。分かった。そのかわり、ちゃんと使い倒してよ。',
    'もう聞かない。あなたが決めたことなら、私は帳簿を合わせるだけ。',
    'いいわ。……ただ、これで客が増えなかった時の言い訳だけは、考えておいて。',
    '好きにして。文句を言う体力も、そろそろ無くなってきたの。'
  ]
};

/* 同じ引き出しから、前と同じ台詞を続けて出さない */
function yWifePick(key) {
  const pool = WIFE_EQ_LINES_Y[key] || WIFE_EQ_LINES_Y.thin;
  const w = yWife();
  if (!w.said) w.said = {};
  let i = Math.floor(Math.random() * pool.length);
  if (pool.length > 1 && i === w.said[key]) i = (i + 1) % pool.length;
  w.said[key] = i;
  return pool[i];
}

function yWifeEquipLine(amount, id) {
  const w = yWife();
  const why = yWifeWhy(amount, id) || 'thin';
  /* 何度も押し切られていると、彼女はもう理屈で止めない（ただし支払いの話だけは別） */
  const key = (w.pushed >= 3 && why !== 'bill') ? 'pushed' : why;
  /* 積み重ねで止めた時は、**今日のしめ**を先に置く（一つの値札の話ではないから） */
  if (key === 'today') {
    return '今日はこれで ' + yen(ySpentToday() + amount) + '。' + yWifePick('today');
  }
  const head = (why === 'bill' || why === 'missed') ? '' : yen(amount) + '。';
  return head + yWifePick(key);
}

/* game.js から呼ばれる関門。true を返すと、その操作はいったん止まる */
let Y_WIFE_ASK = null;
function yAskWife(kind, amount, id) {
  if (!G.ch2) return false;
  /* **機嫌が尽きると、彼女はもう止めない。**
     好きにすればいい、という状態＝関門が消えるのは、楽になったのではなく相談相手を失ったということ */
  if (typeof yWifeGone === 'function' && yWifeGone()) return false;
  if (G.ch2.wifeOK) { G.ch2.wifeOK = false; return false; }   // 「それでも、やる」の直後＝素通り
  if (!yWifeSpeaks(kind, amount, id)) return false;
  if (kind === 'equip') yWife().nagDay = G.day;             // 小言は一日一回まで
  Y_WIFE_ASK = { kind, amount, id };
  document.getElementById('wifeName').textContent = WIFE_Y.name;
  document.getElementById('wifeLine').innerHTML = yWifeLine(kind, amount, id);
  document.getElementById('wifeModal').classList.remove('hidden');
  return true;
}
/* 「それでも、やる」／「やめておく」 */
function yWifeAnswer(go) {
  document.getElementById('wifeModal').classList.add('hidden');
  const a = Y_WIFE_ASK; Y_WIFE_ASK = null;
  if (!a) return;
  const w = yWife();
  if (!go) {
    w.stopped++;
    /* **引っ込めても機嫌は上がらない**（作者指定 8/5）。
       言うことを聞いたご褒美ではない＝彼女は機嫌を取引の材料にしない。
       機嫌が戻るのは、休みの日に**一緒に出かけた**時だけ                */
    /* エンディングの絆＝**日単位ネット**（ENDINGS.md §1・壁打ち3回目）。
       equip/zou（実物の買い物）だけ数える。融資キャンセルや値上げ戻しは
       無コストで積める「農場」になるので数えない。
       あわせて nagDay を無効化＝やめておいたら同じ日の次の買い物でもう一度止まる
       （「1個目でやめておく→残りを無関門で買い漁る」洗浄の封鎖）              */
    if (a.kind === 'equip' || a.kind === 'zou') {
      if (w.pushDayY !== G.day && w.stopDayY !== G.day) {
        w.stopDayY = G.day; w.stoppedDays = (w.stoppedDays || 0) + 1;
      }
      w.nagDay = -1;
    }
    // 値上げだけは、つまみを動かしたぶんが残っているので**元の値段に戻す**
    if (a.kind === 'fee' && a.id && typeof setFeeVal === 'function') {
      setFeeVal(a.id.act, a.id.from, a.id.custom);
    }
    toast('やめておいた');
    return;
  }
  w.pushed++;
  /* 押し切った日は「思いとどまった日」に数えない（同日のstopは取り消す＝ENDINGS.md §1） */
  if (a.kind === 'equip' || a.kind === 'zou') {
    if (w.pushDayY !== G.day) {
      w.pushDayY = G.day; w.pushedDays = (w.pushedDays || 0) + 1;
      if (w.stopDayY === G.day) w.stoppedDays = Math.max(0, (w.stoppedDays || 0) - 1);
    }
  }
  /* **押し切ったぶんだけ、機嫌が下がる。** 買えないわけではない。
     ただ「二人で決める」と言った以上、通した回数は残る                   */
  if (typeof yMoodAdd === 'function') {
    yMoodAdd(WIFE_PUSH_MOOD_Y[a.kind] || -5, '反対を押し切った');
  }
  G.ch2.wifeOK = true;                                       // 次の1回だけ素通りさせる
  if (a.kind === 'zou')     { yOrderZou(); return; }
  /* 融資の申し込みは、関門をもう一度通らない＝**素通り券を持ったままにしない**
     （持ったままだと、次に何を買っても彼女が黙ってしまう） */
  if (a.kind === 'kouko')   { G.ch2.wifeOK = false;
                              if (typeof applyKouko === 'function') applyKouko(a.amount); return; }
  if (a.kind === 'sarakin') { if (typeof doBorrowSarakin === 'function') doBorrowSarakin(a.amount);
                              else G.ch2.wifeOK = false; return; }
  if (a.kind === 'fee') {
    G.ch2.wifeOK = false;                                    // ここは押し直さない＝素通り券は使わない
    if (a.id && typeof setFeeVal === 'function') setFeeVal(a.id.act, a.id.to, a.id.custom);
    return;
  }
  if (a.kind === 'equip') {                                  // 置く操作をもう一度通す
    const b = document.getElementById('btnPlaceOk');
    if (b) b.click(); else G.ch2.wifeOK = false;
  }
}

/* ============================================================
   妻は「持ち場のある人」（作者指定 2026-08-05）
   ============================================================
   これまでの奈津は、1階の受付に**描いてあるだけの絵**だった。
   立ってはいるが、会計もしないし掃除もしない。機嫌のゲージは、
   小言と朝の選択肢の中だけで閉じていた。

   **バイトとまったく同じように、各階へ配置できるようにする。既定は1階（番台）。**

     ・バイトと同じ `G.staff` に入る＝番台の会計も、掃除も、そのまま回る
     ・**ただし `G.roster` には入れない**＝給料もクビも面接も無い。持ち場だけを持つ
     ・機嫌が尽きた日（yWifeGone）は店に立たない＝その階が丸ごと手薄になる
     ・主人公は、彼女の立っている階には掃除に行かない（バイトと同じ扱い）

   ＝設備を買いすぎて機嫌を下げると、**次の日その階から人が消える。**
     小言が、初めて店の数字につながった。                               */

/* 彼女の持ち場。既定は1階（番台のある階）。家は持ち場にならない */
function yWifeFloor() {
  const f = (G.ch2 && G.ch2.wifeF != null) ? (G.ch2.wifeF | 0) : AY.FRONT;
  const a = (CONF.areas || [])[f];
  return (a && !a.home) ? f : AY.FRONT;
}
function ySetWifeFloor(f) {
  if (!G.ch2) return;
  const a = (CONF.areas || [])[f | 0];
  if (!a || a.home) return;
  G.ch2.wifeF = f | 0;
  // その日のうちに動かせる（バイトの持ち場は翌朝からだが、彼女は隣にいるので今すぐ動く）
  const w = (G.staff || []).find(s => s.isWife);
  if (w) { const nw = yMakeWife(); if (nw) Object.assign(w, { f: nw.f, home: nw.home, px: nw.px, py: nw.py, path: null, task: null, target: null }); }
  if (typeof saveGame === 'function') saveGame();
}
/* 立ち位置。番台のある階なら受付の内側、それ以外の階は入口のそば */
function yWifeSpot() {
  const b = bandai();
  if (b && (b.f | 0) === G.actF && typeof deskHelperSpot === 'function') return deskHelperSpot();
  const e = CONF.entrance || { x: 8, y: 9 };
  for (const p of [{ x: e.x - 1, y: e.y - 1 }, { x: e.x + 1, y: e.y - 1 }, { x: e.x, y: e.y - 1 }])
    if (walkable(p.x, p.y)) return p;
  return staffSpot(9);
}
/* 開店のたびに作る（バイトと同じ）。機嫌が尽きていれば、その日は誰も立たない */
function yMakeWife() {
  if (!G.ch2) return null;
  if (typeof yWifeGone === 'function' && yWifeGone()) return null;
  const f = yWifeFloor(), back = G.actF;
  applyArea(f, true);
  const s = yWifeSpot();
  const w = makeEntity(s.x, s.y, CONF.staffSpd);
  Object.assign(w, {
    kind: 'staff', isWife: true, task: null, timer: 0, target: null, home: s, f,
    /* updateStaff は emp.maji でサボりを判定する。彼女はサボらない（真面目5）。
       G.roster に入れないので、給料の合計にも面接にも出てこない */
    emp: { name: WIFE_Y.name, age: WIFE_Y.age, wife: true, maji: 5, spd: 3, aiso: 4, skill: 60, wage: 0, days: 0 },
  });
  applyArea(back, true);
  return w;
}
function yExtraWorkers() { const w = yMakeWife(); return w ? [w] : []; }
/* その階に、バイト以外の立ち手（＝妻）が居るか。バイト管理ページの「利用不可」に使う */
function yAreaExtraWorker(f) {
  /* **主人公も妻も、バイトと同じく1枠を使う**（作者指定 8/8）＝
     「立てる枠 3／6」の数え方に両方が乗る。返すのは人数（0/1/2）          */
  let n = 0;
  if (yPlayerFloor() === (f | 0) && !(typeof yAbsentToday === 'function' && yAbsentToday())) n++;
  if (yWifeFloor() === (f | 0) && !(typeof yWifeGone === 'function' && yWifeGone())) n++;
  return n;
}

/* 立っている彼女に名札を添える。準備中（バイトが居ない時間）は、絵だけ置く */
function yDrawWife(c2) {
  if (typeof yWifeGone === 'function' && yWifeGone()) return;   // 機嫌が尽きた日は店に立たない
  const view = (G.viewF >= 0 ? G.viewF : G.actF) | 0;
  const font = 'bold 8px "DotGothic16",sans-serif';
  const live = (G.staff || []).find(s => s.isWife);
  if (live) {                                   // 営業中＝本物の人として歩いている。名札だけ
    if ((live.f | 0) !== view) return;
    c2.fillStyle = '#f5ead8'; c2.font = font; c2.textAlign = 'center';
    c2.fillText(WIFE_Y.short, live.px, live.py - 16);
    return;
  }
  if (view !== yWifeFloor()) return;
  const back = G.actF; applyArea(view, true);
  const s = yWifeSpot(); applyArea(back, true);
  const x = s.x * T + T / 2, y = s.y * T + T / 2;
  const t = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
  const bob = Math.sin(t * 1.6) * 0.8;
  c2.fillStyle = 'rgba(0,0,0,.25)'; c2.fillRect(x - 6, y + 11, 12, 3);
  c2.fillStyle = '#5a6b8a'; c2.fillRect(x - 5, y - 1 + bob, 10, 13);      // 制服
  c2.fillStyle = '#e8c39a'; c2.fillRect(x - 4, y - 9 + bob, 8, 9);        // 顔
  c2.fillStyle = '#3b2d24'; c2.fillRect(x - 5, y - 11 + bob, 10, 5);      // 髪
  c2.fillRect(x - 6, y - 8 + bob, 2, 7); c2.fillRect(x + 4, y - 8 + bob, 2, 7);
  c2.fillStyle = '#f5ead8'; c2.font = font; c2.textAlign = 'center';
  c2.fillText(WIFE_Y.short, x, y - 14);
}

/* バイト管理ページの頭に置く「妻の持ち場」。並びも押し心地もバイトの持ち場と同じ */
/* 妻は**バイトと同じ扱い**（作者指定 8/7）＝上に独立した欄を作らず、
   立っている階の1枚として並ぶ。だからここは深夜バイト欄だけを返す */
function yStaffMgrTop() {
  if (!G.ch2) return '';
  return yStaffMgrLead() + yNightStaffBlock();
}
/* その階に立っている妻の1枚（バイトの札と同じ形）。
   data-i を持たない＝game.js の一覧は繋がない。動かすのは【＋】のほうから */
/* ============ 主人公の持ち場（作者指定 2026-08-08）============
   **主人公もバイトと同じくバイト管理画面で階に置ける。**
   7階建てなので「常に1F受付」だと、上の階が手薄なときに打つ手が足りなかった。
   妻とまったく同じ作り＝札が並び、枠を1つ使い、【＋】の一覧から動かせる      */
function yPlayerFloor() {
  /* 既定は**2階の男湯**（作者指定 8/8）。まだ2階が建っていないセーブでは1階に落ちる */
  const f = (G.ch2 && G.ch2.playerF != null) ? (G.ch2.playerF | 0) : AY.OTOKO;
  const a = (CONF.areas || [])[f];
  return (a && !a.home && !playerBanned(f)) ? f : AY.FRONT;
}
function ySetPlayerFloor(f) {
  if (!G.ch2) return;
  const a = (CONF.areas || [])[f | 0];
  if (!a || a.home) return;
  G.ch2.playerF = f | 0;
  /* その日のうちに動く（自分の足で移動するので、翌朝を待つ理由がない）。
     いま立っている場所から、新しい階の持ち場へ置き直す                       */
  if (G.player) { G.player.f = f | 0; G.player.path = null; G.player.task = null; G.player.target = null; }
  if (typeof saveGame === 'function') saveGame();
}
/* 主人公の札（その階にいるときだけ出る） */
function yPlayerCard(f) {
  if (!G.ch2 || yPlayerFloor() !== (f | 0)) return '';
  if (typeof yAbsentToday === 'function' && yAbsentToday()) return '';   // 今日は店にいない
  const desk = bandai() && (bandai().f | 0) === (f | 0);
  return `<div class="sm-card sm-wife sm-me">
    <span class="sm-face">🧑</span>
    <div><b>あなた</b><span class="sm-tag">店主</span>
      <span class="shop-price">給料なし</span><br>
      <span class="shop-desc">${desk ? '番台で会計を受け持つ。手が空けば掃除に回る'
                                     : 'この階を開けて、掃除して回る'}</span></div></div>`;
}
/* 【＋】の一覧に出す主人公の行（いまその階にいなければ「動かす」候補） */
function yPlayerPickRow(f) {
  if (!G.ch2 || yPlayerFloor() === (f | 0)) return '';
  if (typeof yAbsentToday === 'function' && yAbsentToday()) return '';
  return `<button class="sm-pick sm-wife-pick" data-playerf="${f}">
    <span class="sm-face">🧑</span>
    <div><b>あなた</b><span class="sm-tag">店主</span>
      <span class="shop-price">給料なし</span><br>
      <span class="shop-desc">いまは ${(CONF.areas[yPlayerFloor()] || {}).name || ''}</span></div></button>`;
}

/* バイト画面のいちばん上に出す一言（第2章）。**画面そのものの一部**なので、
   描き直すたびに作られ、章を移っても残らない */
function yStaffMgrLead() {
  if (!G.ch2) return '';
  const nm = (typeof WIFE_Y !== 'undefined') ? WIFE_Y.name : '妻';
  return '<p class="modal-note">あなたと' + nm + 'の持ち場は、いつでも動かせる。<br>'
    + '番台に二人並ぶ必要はない。<b>人のいない階は、客が使えない。</b></p>';
}

function yAreaStaffCard(f) {
  if (!G.ch2) return '';
  const me = yPlayerCard(f);                       // 主人公の札を先に（店主なので上）
  if (typeof yWifeGone === 'function' && yWifeGone()) return me;
  if (yWifeFloor() !== (f | 0)) return me;
  const desk = bandai() && (bandai().f | 0) === (f | 0);
  return me + `<div class="sm-card sm-wife">
    <span class="sm-face">💗</span>
    <div><b>${WIFE_Y.name}</b><span class="sm-tag">妻・共同経営者</span>
      <span class="shop-price">給料なし</span><br>
      <span class="shop-desc">${desk ? '番台で会計も受け持つ。手が空けば掃除に回る'
                                     : 'この階を開けて、掃除して回る'}</span></div></div>`;
}
/* 【＋】の一覧に出す妻の行（いまその階にいなければ「動かす」候補として並ぶ） */
function yExtraPickRows(f) {
  if (!G.ch2) return '';
  const me = yPlayerPickRow(f);
  if (typeof yWifeGone === 'function' && yWifeGone()) return me;
  if (yWifeFloor() === (f | 0)) return me;
  return me + `<button class="sm-pick sm-wife-pick" data-wifef="${f}">
    <span class="sm-face">💗</span>
    <div><b>${WIFE_Y.name}</b><span class="sm-tag">妻・共同経営者</span>
      <span class="shop-price">給料なし</span><br>
      <span class="shop-desc">いまは ${(CONF.areas[yWifeFloor()] || {}).name || ''}</span></div></button>`;
}
/* 🌙 深夜バイト欄。**休憩ラウンジを建てて初めて現れる**（作者指定）。
   最初から空欄で出していると「まだ使えない何か」になるが、
   建てた瞬間にページが一つ増えるなら、建てた実感が別の画面に出る          */
function yNightStaffBlock() {
  if (!yNightUnlocked()) return '';
  const night = (G.roster || []).filter(e => e.night);
  const lock = yNightLockWhy();
  const on = (typeof nightOpenOn === 'function') && nightOpenOn();
  const rows = night.length
    ? night.map(e => `<div class="sm-card" data-i="${G.roster.indexOf(e)}">
        <span class="sm-face">🌙</span>
        <div><b>${e.name}</b><span class="sm-night">🌙深夜可</span>
          <span class="shop-price">${yen(Math.round((e.wage || 0) * (CONF.nightOpen.wageRate || 1.25)))}</span><br>
          <span class="shop-desc">持ち場 ${staffAreaName(e) || '（未定）'}
            ／深夜割増 +${Math.round(((CONF.nightOpen.wageRate || 1.25) - 1) * 100)}%</span></div>
        <span class="sm-go">›</span></div>`).join('')
    : '<p class="sm-note">まだ誰もいない。求人で🌙の付いた人を採ると、ここに並ぶ</p>';
  return `<div class="sm-area${lock ? ' closed' : ''}"><div class="sm-area-h">
      <b>🌙 深夜バイト</b><span>${on ? `${yNightStart()}時〜翌${yNightEnd() - 24}時` : lock ? '🚫 開けられない' : '待機中'}</span></div>
    <p class="sm-note">${lock || '深夜は' + WIFE_Y.name + 'も主人公も帰る。<b>階はぜんぶ開いたまま</b>で、'
      + 'この人たちが置かれていない階は<b>誰も拭かない</b>（汚れが'
      + (CONF.dirtNightMul || 3.5) + '倍で朝まで残る）'}</p>
    ${rows}</div>`;
}
function yStaffMgrBind(box) {
  if (!box) return;
  box.querySelectorAll('[data-wifef]').forEach(b => {
    b.onclick = () => { ySetWifeFloor(+b.dataset.wifef); smPickF = null; renderStaffMgr(); };
  });
  box.querySelectorAll('[data-playerf]').forEach(b => {
    b.onclick = () => { ySetPlayerFloor(+b.dataset.playerf); smPickF = null; renderStaffMgr(); };
  });
  // 5階の源さん（辞めてもらうボタン）。札そのものは staffAreaNote が出している
  if (typeof yGenMgrBind === 'function') yGenMgrBind(box);
}

registerChapter2Hooks({
  /* 主人公の持ち場。**バイト管理画面で動かせる**（作者指定 8/8）＝
     game.js の playerArea() がここを見る。持たない章は CONF.playerArea のまま */
  playerArea: () => yPlayerFloor(),
  askWife: yAskWife,
  wifeAnswer: yWifeAnswer,
  /* 客や設備の上に重ねる層。妻の名札と、食堂のカウンターに並んだ皿。
     **フックは1つしか登録できない**ので、ここで両方を呼ぶ
     （shokudo_y.js は後から読み込むので、あるときだけ） */
  drawPass: (c2) => {
    yDrawWife(c2);
    if (typeof yDrawShokuPass === 'function') yDrawShokuPass(c2);
  },
  extraWorkers: yExtraWorkers,
  areaExtraWorker: yAreaExtraWorker,
  areaStaffCard: yAreaStaffCard,     // 妻の1枚（バイトと同じ形で、その階に並ぶ）
  extraPickRows: yExtraPickRows,     // 【＋】の一覧に出す妻の行
  staffMgrTop: yStaffMgrTop,
  staffMgrBind: yStaffMgrBind,
  deskLayout: yDeskLayout,
});

/* ============ 会計の立ち位置（作者指定 8/8） ============
   第2章の受付カウンターは**3マス幅**（(6,1)〜(8,1)）で、寄れるマスは
   左端(5,1)／正面(6,2)(7,2)(8,2)／右端(9,1)の5つ。
   game.js の既定は「客＝いちばん右／主人公＝いちばん上」なので、
   **客が右端・主人公が左端＝カウンターの端と端で金を渡していた**（4マス離れている）。

   直したあと：
     主人公 = 左端(5,1)          ＝カウンターの内側に立つ
     客     = 正面の左端(6,2)    ＝主人公の**真ん前**
     2人目  = 正面の2番目(7,2)   ＝客の隣。妻やロビー担当のバイトが入る
     行列   = (8,2) → 右端(9,1) → それでも余ったら屋内の壁沿い

   ※ カウンターの裏（y=0）は壁なので、向かい合わせにはできない。
     「内側の端に立つ店主／正面に立つ客」が、この形でいちばん自然に読める     */
function yDeskLayout() {
  const b = bandai(); if (!b) return null;
  const ts = approachTiles(b);
  const face = ts.filter(t => t.y !== b.y).sort((p, q) => p.x - q.x);   // 正面＝客の側
  const ends = ts.filter(t => t.y === b.y).sort((p, q) => p.x - q.x);   // 左端・右端＝内側
  if (!face.length) return null;
  const pay    = face[0];
  const staff  = ends[0] || face[1] || pay;
  const staff2 = face[1] || ends[ends.length - 1] || staff;
  /* ⚠ ここで outsideSpots() を呼んではいけない。
     outsideSpots() → bandaiFront() → deskLayout() → ここ、で**無限に回る**。
     並びきらないぶんは、正面の列の続き（ロビーの床）を自分で伸ばす      */
  const tail = [];
  for (let d = 1; d <= 10 && tail.length < 6; d++) {
    const x = pay.x + d;
    if (x <= CONF.W - 2 && walkable(x, pay.y)) tail.push({ x, y: pay.y });
  }
  for (let d = 1; d <= 10 && tail.length < 6; d++) {
    const x = pay.x - d;
    if (x >= 1 && walkable(x, pay.y)) tail.push({ x, y: pay.y });
  }
  const key = t => t.x + ',' + t.y;
  const taken = new Set([key(staff), key(staff2)]);
  const queue = [], seen = new Set();
  for (const t of [pay, ...face.slice(1), ...ends.slice(1), ...tail]) {
    const k = key(t);
    if (taken.has(k) || seen.has(k)) continue;
    seen.add(k); queue.push(t);
  }
  return { pay, staff, staff2, queue };
}

/* ============================================================
   客層ごとの「求めるもの」（作者決定 8/2・CHAPTER2_B.md §9-6h）
   ------------------------------------------------------------
   これまで満足度は全客共通の式（湯温の近さ・サウナ・清潔・待ち時間）だけで動いていた。
   **層ごとに ±6〜8点を足す**＝老人は電気風呂、OLは女性スタッフ、というのが数字になる。

   平均70点に対して ±6〜8 なら十分効き、他の要素を潰さない。
   **第2章だけ**（chHook 経由なので、第1章の満足度の式は1ミリも変わらない）
   ============================================================ */

/* 置いてあるか（壊れていても「ある」とみなす＝傷みは別の減点で効いている） */
function yHasEq(id) { return (G.equip || []).some(e => e.id === id); }
/* 湯温がその範囲に入っている浴槽があるか */
function yHasFuroTemp(lo, hi) {
  return (G.equip || []).some(e => {
    const d = EQ[e.id]; if (!d || d.cat !== 'furo') return false;
    const t = e.temp != null ? e.temp : d.temp;
    return t >= lo && t <= hi;
  });
}
/* 水風呂のいちばん冷たい温度 */
function yColdest() {
  let t = 99;
  for (const e of (G.equip || [])) {
    const d = EQ[e.id]; if (!d || d.cat !== 'mizu') continue;
    t = Math.min(t, e.temp != null ? e.temp : (d.temp || 15));
  }
  return t;
}
function yCountCat(cat) { return (G.equip || []).filter(e => (EQ[e.id] || {}).cat === cat).length; }
function ySeatsCat(cat) {
  return (G.equip || []).reduce((s, e) => s + ((EQ[e.id] || {}).cat === cat ? (EQ[e.id].cap || 0) : 0), 0);
}
/* **スタッフの女性比率**（主人公は男なので分母に入れる） */
function yStaffFemaleRate() {
  const all = (G.roster || []);
  if (!all.length) return 0;
  const f = all.filter(p => p.sex === 'f').length;
  return f / (all.length + 1);          // +1＝主人公
}
/* ドライヤーが無料か（有料だと若い客に効かない） */
function yDryerFree() { return !(G.opts && G.opts.dryerFee); }
/* 子供料金が安いか（大人の半額以下なら「安い」） */
function yKidFeeCheap() {
  const o = G.opts || {};
  return (o.kidFee || 0) <= Math.round(((o.feeCustom || o.fee) || 0) * 0.5);
}

/* 層 → [条件, 点, **見出し**] の並び。条件が真なら足す（偽でも引かない＝**加点だけ**）。
   引く形にすると開業直後に全層が沈んで、何をしても上がらない画面になる。

   3つ目の**見出し**は、客をタップしたときに出す「求めるもの」の一行（custcard_y.js）。
   満たしていれば緑、まだなら赤で出る＝**この表がそのまま画面に出る**ので、
   条件を足したら見出しも必ず書くこと（書き忘れると、その一行だけ出ない）      */
const SEG_WANTS_Y = {
  m_rojin:   [[() => yHasEq('y_furo_denki'), 6, '電気風呂'], [() => yHasFuroTemp(41, 44), 5, 'あつ湯（41〜44℃）']],
  m_sauner:  [[() => yCountCat('sauna') >= 2, 6, 'サウナが2室以上'], [() => yColdest() <= 15, 5, '15℃以下の水風呂']],
  m_kaisha:  [[() => !G.today || (G.today.queueMiss || 0) <= 2, 5, '待たされないこと'],   // まだ開けていない日は「待たせていない」
              [() => !!(G.opts && G.opts.nightOpen), 5, '遅い時間まで開いている']],
  m_wakai:   [[() => yHasEq('y_goods'), 4, '物販棚'], [yDryerFree, 4, 'ドライヤーが無料']],
  m_kozure:  [[yKidFeeCheap, 6, '子供料金が安い'], [() => !!(G.opts && G.opts.banYakuza), 6, '怖い客がいない']],
  f_obasan:  [[() => yHasFuroTemp(38, 40), 5, 'ぬる湯（38〜40℃）'], [() => ySeatsCat('wash') >= 12, 5, 'カランが12席以上']],
  f_saunajo: [[() => yCountCat('sauna') >= 2, 6, 'サウナが2室以上'], [() => ySeatsCat('rest') >= 6, 5, 'ととのいイスが6席以上']],
  f_ol:      [[() => yStaffFemaleRate() >= 0.5, 8, '女性スタッフが半分以上'], [() => yHasEq('y_powder') || yHasEq('y_vanity'), 5, 'パウダールーム']],
  f_wakai:   [[yDryerFree, 5, 'ドライヤーが無料'], [() => yHasEq('y_goods'), 4, '物販棚']],
  f_kozure:  [[yKidFeeCheap, 6, '子供料金が安い'], [() => !!(G.opts && G.opts.banYakuza), 6, '怖い客がいない']],
};

/* game.js の帰り際から呼ばれる。その客の層ぶんだけ加点して返す */
function ySegWant(c) {
  if (!c || typeof segOf !== 'function') return 0;
  let n = 0;
  /* **店主が居ない日は、客に伝わる**（作者決定 8/5）。
     妻ひとりでも会計は回るが、湯を見る目も、声をかける手も足りない。
     ここが無いと「出勤しない」が一方的に得になる（実測して入れた）      */
  if (typeof yWorkToday === 'function' && !yWorkToday()) n -= 6;
  const k = segOf(c.typeKey); if (!k) return n;
  const list = SEG_WANTS_Y[k]; if (!list) return n;
  for (const [cond, v] of list) { try { if (cond()) n += v; } catch (e) { /* 判定できない品は無視 */ } }
  return n;
}

/* いま各層に何点ぶん応えられているか（データ画面で「あと何が足りないか」を出す） */
function ySegWantParts(key) {
  const list = SEG_WANTS_Y[key] || [];
  let got = 0, max = 0;
  for (const [cond, v] of list) { max += v; try { if (cond()) got += v; } catch (e) {} }
  return { got, max };
}

registerChapter2Hooks({ segWant: ySegWant, repPenalties: yRepPenalties });
