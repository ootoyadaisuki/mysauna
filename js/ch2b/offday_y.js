'use strict';

/* ============================================================
   定休日と、二本のゲージ（第2章「ととのい市編」）
   ------------------------------------------------------------
   作者決定（2026-08-02）：

     ・**営業日と定休日は自分で選ぶ。** 既定は火曜定休。全部営業にもできる
     ・**各階にバイトがいれば、ずっと営業できる。** 人のいない階のぶんだけ体力が削れる
     ・**体力と妻の機嫌は常時出す。** 倒れるのも彼女が下りるのも、事故ではなく自分の判断
     ・**臨時休業はいつでも押せる。** ただし常連が減って評判も落ちる

   毎日の選択肢は作らない（それだと「休む日の値段」が計算できてしまい、
   序盤は一度も休まず、終盤は開けないほうが強い、という形になる）。
   **ゲージは毎日たまって、休みの日に使う。** 例外は3つ＝倒れる／彼女が下りる／臨時休業
   ============================================================ */

/* ============ 週の予定 ============
   G.ch2.week ＝ 月〜日の7つ。true が営業日。既定は火曜だけ定休（作者指定）  */
const WEEK_Y = ['月', '火', '水', '木', '金', '土', '日'];
const WEEK_DEF_Y = [true, false, true, true, true, true, true];

/* ============ 曜日（作者決定 8/8）============
   **ゲームは火曜から始まる。**共有側の `dayOfWeek` は「1日目＝月曜」なので、
   `startDow` のぶんだけずらす。`startDow: 0` にすれば元の月曜始まりに戻る */
function yDayOfWeek(d) {
  const day = (d == null ? G.day : d);
  return ((day - 1) + (CONF.startDow | 0)) % 7;
}
function yWeek() {
  const c = G.ch2; if (!c) return WEEK_DEF_Y.slice();
  if (!Array.isArray(c.week) || c.week.length !== 7) c.week = WEEK_DEF_Y.slice();
  return c.week;
}
/* ============ 一日の決め方（作者決定 8/5・作り直し）============
   **定休日も、営業する曜日も、臨時休業も無くした。**
   毎朝「今日は何をする？」を1枚出して、そこで決める。
     ・そのまま出勤する      … これまでどおり店に立つ
     ・寄り道する（休む・鍛える・妻と出かける…）
         → そのあと「**それでも出勤しますか？**」
             出勤する   … 寄り道の効果を持ったまま、店に立つ
             出勤しない … **妻がひとりで番台に立つ**。結果は日報で受け取る
   ＝「今日は開けるか」ではなく「**今日、自分はどう使うか**」を毎日決める     */
/* ============ 一日の決め方 ============
   **毎朝「今日は何をする？」を1枚はさむ**（作者決定 8/5 → 8/8 に再確認）。
   いちど「毎朝は多すぎる。火曜定休にして週1回にしよう」と作り替えたが、**戻した。**

   ゲージ（体力・ストレス・妻の機嫌）が実測でまったく動いていなかったのは、
   毎朝聞かれること自体が原因ではなく、**「そのまま出勤する」という選択肢が
   無かったから**だった。2日目から毎朝かならず寄り道を選ばされる＝
   毎日ただでストレスが抜けて体力が戻る＝ゲージが削れるはずがない。

   出勤の選択肢が入り、ゲージの端に**はっきりした罰**（下記）が付いた今、
   毎朝の問いは「**今日は金を取るか、体を取るか**」という本物の判断になる。
     ・体力ゼロ    → 倒れて病院。**翌日は強制的に休業**
     ・ストレスMAX → 主人公が帰る（その日、店に立たない）
     ・妻の機嫌ゼロ → 妻が帰る（その日、番台に立たない）
   **どれも翌日には戻る**（作者指定 8/8）＝一日ぶんの穴として効く          */
/* 今日は店を開けないか（＝倒れた翌日だけ。休んでも店は妻が開ける） */
function yClosedToday(d) {
  const c = G.ch2; if (!c) return false;
  const day = d == null ? G.day : d;
  /* **毎週この曜日は定休**（作者決定 8/8）。`weekOff: null` にすれば定休日なし＝元の形。
     ここが「月曜は強制イベントの日」の土台になる（店は開けない） */
  if (CONF.weekOff != null && yDayOfWeek(day) === (CONF.weekOff | 0)) return true;
  return c.downDay === day;                  // 体力が尽きて倒れた日
}
/* 店を開けない理由（画面の見出しに出す） */
function yClosedWhy(d) {
  const day = d == null ? G.day : d;
  if (CONF.weekOff != null && yDayOfWeek(day) === (CONF.weekOff | 0)) return 'week';
  return 'down';
}
/* 今日の予定（朝に決めたこと）。act＝選んだ寄り道／go＝出勤するか */
function yPlan() {
  const c = G.ch2; if (!c) return null;
  if (!c.plan || c.plan.day !== G.day) c.plan = { day: G.day, act: null, go: null, done: false };
  return c.plan;
}
/* 今日の朝の選択が済んでいるか */
function yPlanDone() { const p = yPlan(); return !!(p && p.done); }
/* 今日、主人公は店に立つか */
function yWorkToday() { const p = yPlan(); return !p || p.go !== false; }

/* ============ 営業時間（作者決定 8/5）============
   **1時間刻みで決める。開店は最も早くて6時、閉店は24時まで。**
   （24時より先は、これまでどおり「深夜営業」＝深夜に立てるバイトが要る。
     その時間は主人公と妻は帰っていて、体力も減らない）
   既定は **15時〜22時＝7時間**（作者決定 8/5）。朝を「今日は何をする？」に使うので、
   開店は遅い。**釣り合うのは12時間**なので、既定のうちは体力が毎日 +50 ずつ戻る＝
   **その余りを、床を拭くのに使う**（汚れ1つ＝15）。
   12時間を超えて伸ばすと、そこから先は毎日削れていく                        */
const HOURS_MIN_Y = 6, HOURS_MAX_Y = 24;
function yHours() {
  const c = G.ch2; if (!c) return { open: CONF.openHour, close: CONF.closeHour };
  if (!c.hours) c.hours = { open: CONF.openHour, close: CONF.closeHour };
  return c.hours;
}
function yOpenHour()  { return yHours().open; }
function yCloseHour() { return yHours().close; }
/* 主人公が店に立つ時間数。**深夜営業ぶんは数えない＝その時間は家にいる。**
   （2026-08-08、いちど `closeHourNow()` を見るように書き換えたが**誤りだったので戻した**。
     `yWorkerOff`＝「22時を過ぎたら、深夜バイト以外はみんな帰る（妻も）」のとおり、
     主人公は深夜シフトに立たない。深夜営業の代償は
     **妻の機嫌（−2／日）と清潔度（yScoreClean の −night×8）**のほうで払う）      */
function yWorkHours() { return Math.max(0, yCloseHour() - yOpenHour()); }
function ySetHours(open, close) {
  const h = yHours();
  h.open  = clamp(open,  HOURS_MIN_Y, HOURS_MAX_Y - 1);
  h.close = clamp(close, h.open + 1,  HOURS_MAX_Y);
  if (typeof saveGame === 'function') saveGame();
}

/* ============ 体力 ============
   **開けている1時間ごとに減り、閉めている1時間ごとに戻る。**
   ・営業中 … 1時間あたり 5（**全階にバイトが立っていれば 2**＝人を雇うほど楽になる）
   ・閉店中 … 1時間あたり 5
   ＝12時間営業なら差し引きゼロ。**伸ばすほど、毎日少しずつ削れていく**       */
const STAM_PER_HOUR_Y = 5, STAM_PER_HOUR_MIN_Y = 2;
/* **体力の上限は鍛えれば伸びる**（作者決定 8/5）。筋トレ1回で +2、150で頭打ち。
   上限が上がる＝長く開けても倒れにくくなる＝**鍛えた店主は無茶ができる**。
   ただし無限には効かない（150なら18時間営業でも2日はもつ、という程度）      */
const STAM_MAX_CAP_Y = 150, STAM_TRAIN_UP_Y = 2;
function yStamMax() {
  const up = (G.ch2 && G.ch2.stamUp) || 0;
  return Math.min((CONF.stamMax || 100) + up, STAM_MAX_CAP_Y);
}
/* 建っている階のうち、バイトも主人公も立っていない階の数 */
function yEmptyFloors() {
  const areas = CONF.areas || [];
  let n = 0;
  for (let f = 0; f < areas.length; f++) {
    const a = areas[f]; if (!a || a.home) continue;
    if (f === (CONF.playerArea ?? 0)) continue;                 // 主人公が立つ階
    if ((G.roster || []).some(e => e.f != null && (e.f | 0) === f)) continue;
    n++;
  }
  return n;
}
/* 1時間あたりの消耗。**全部の階にバイトが立っていれば2、1つでも空いていれば5**。
   ここを「空いた階の数だけ増える」にすると、
   **12時間＝ちょうど釣り合う**という物差しが消える（実測して直した）      */
function yStamPerHour() {
  const base = yEmptyFloors() === 0 ? STAM_PER_HOUR_MIN_Y : STAM_PER_HOUR_Y;
  // 【働き者】＝体の使い方を覚えた。同じ一日でも、減りが半分で済む
  return (typeof yHasSkill === 'function' && yHasSkill('hatarakimono')) ? base / 2 : base;
}
/* 1日開けたときに減る体力（＝その日の労働時間ぶん） */
function yStamDrain() { return yWorkHours() * yStamPerHour(); }
/* ============ 翌朝に戻る体力＝**固定 25**（作者決定 2026-08-08）============
   以前は `(24 - 営業時間) × 5`＝**85 も戻っていた。** どの寄り道よりも大きく、
   1日で減る35を大きく上回るので、**営業しているだけなら体力は永久に満タン**だった。
   ＝寄り道の意味そのものを消していた。いまは「一晩ぶん」の固定値にして、
   **開けるほど毎日削れていく**ようにしてある。
     7時間営業 … −35 +25 ＝ **−10／日**（実測：9日目に最初の一度）
   ＝**寄り道せずに開け続けたら、10日ももたない**。
   長く開けるほど（yCloseHour を後ろへ倒すほど）早く尽きる                    */
const STAM_BACK_Y = 25;
function yStamBack()  { return STAM_BACK_Y; }
/* ⚠ 下の3つ（体力・妻の機嫌・ストレス）は `gauges: false` の章では**動かさない。**
   数字も画面も残したまま、増減だけ止める＝`gauges: true` に戻せばその場で生き返る */
function yStamAdd(n) {
  if (!CONF.gauges) return;
  if (!CONF.stamMax) return;
  const max = yStamMax();
  G.stam = clamp((G.stam ?? max) + n, 0, max);
}

/* ============ 妻の機嫌 ============
   前は「限界メーター」を作らないことにしていた（溜まるだけのメーターは眺めるもので終わる）。
   **休みの日に「妻と出かける」で下げ戻せるようになった**ので、ここで初めて意味を持つ。   */
function yMood() {
  const w = (typeof yWife === 'function') ? yWife() : null;
  if (!w) return 70;
  if (w.mood == null) w.mood = 70;
  return w.mood;
}
function yMoodAdd(n, why) {
  if (!CONF.gauges) return;
  const w = (typeof yWife === 'function') ? yWife() : null;
  if (!w) return;
  /* 💗【察しがいい】＝水明で、値札を見て戻した手つきに何度も気づいた人。
     **下がるときだけ**半分になる（上がる側は変わらない・odekake_y.js） */
  if (n < 0 && typeof ySkillMoodDownMul === 'function') n = Math.round(n * ySkillMoodDownMul());
  const before = yMood();
  w.mood = clamp(before + n, 0, 100);
  if (why && Math.abs(w.mood - before) >= 5) {
    log((n < 0 ? '💢 ' : '💗 ') + WIFE_Y.name + 'の機嫌が' + (n < 0 ? '下がった' : '戻った')
        + '（' + why + '）');
  }
}
/* **機嫌が尽きると、彼女はフロントに立たなくなる。**
   会計の手が一つ減り、関門は出ない＝相談する相手がいない、ということ */
/* 妻が今日は店に来ないか。**機嫌がゼロになった、その日だけ**（作者指定 8/8）＝
   翌朝には yCheckAway が機嫌を20戻すので、帰りっぱなしにはならない */
function yWifeGone() { return !!(G.ch2 && G.ch2.wifeAwayDay === G.day); }

/* ============ ストレス（作者決定 8/2）============
   **体力の写しにしない。** 体力は「その日どれだけ動けるか」、
   ストレスは「朝どれだけ戻るか」を決める＝役目が重ならない。
   だから「体はきついが、気は晴れている」も、その逆も起きる。
   溜まるほど悪いゲージなので、画面では満タンに近いほど赤くなる    */
function yStress() {
  const c = G.ch2; if (!c) return 0;
  if (c.stress == null) c.stress = 0;
  return c.stress;
}
function yStressAdd(n, why) {
  if (!CONF.gauges) return;
  const c = G.ch2; if (!c || !CONF.stressMax) return;
  const before = yStress();
  c.stress = clamp(before + n, 0, CONF.stressMax);
  if (why && Math.abs(c.stress - before) >= 20) {
    log((n < 0 ? '♨️ ' : '💭 ') + 'ストレスが' + (n < 0 ? '抜けた' : '溜まってきた')
        + '（' + why + '）');
  }
}
/* ============================================================
   その日の商売が、そのままストレスになる（日報のときに1回）
   ------------------------------------------------------------
   **客に喜ばれた日は、体がきつくても気は晴れている。**
   逆に、文句を言われて客を帰した日は、楽をしていても気が重い
   ============================================================ */
function yStressOfDay() {
  const t = G.today || {};
  let n = CONF.stressPerDay || 6;                       // 店を開けただけのぶん
  const why = [];

  // 客の満足度。喜ばれたら抜け、呆れられたら溜まる
  /* **良い日でも、ゼロにはならない**（作者決定 8/8）。
     以前は満足75以上で −14、黒字で −4 だったので**ふつうにやっていると毎日減り**、
     100の上限に一度も届かなかった（30日の実測で最大52）。
     いまは最高の日でも +6 残る＝11〜16日でMAXに届く                        */
  const sat = t.satN ? t.satSum / t.satN : null;
  if (sat != null) {
    if (sat >= 75) { n -= 4; why.push('客が喜んで帰った'); }
    else if (sat >= 60) { n -= 1; }
    else if (sat <= 40) { n += 10; why.push('満足していない客が多い'); }
  }
  // 文句の数（gripes は「何に文句が出たか」の集計）
  const gripes = Object.values(t.gripes || {}).reduce((a, b) => a + b, 0);
  if (gripes >= 8) { n += 8; why.push('文句が多かった'); }
  else if (gripes >= 3) { n += 3; }
  // 入れずに帰した客・待ちきれず諦めた客
  const away = (t.turnedAway || 0) + (t.gaveUp || 0);
  if (away >= 5) { n += 7; why.push('入れずに帰した客がいる'); }
  else if (away >= 1) { n += 2; }
  // 金。赤字は効く
  const p = t.profit || 0;
  if (p < 0) { n += 6; why.push('赤字'); }        // 黒字の −4 は廃止（8/8）＝黒字は「当たり前」

  // 妻の機嫌が低い日は、家でも気が休まらない
  if (typeof yMood === 'function' && yMood() <= 30) { n += 5; why.push(WIFE_Y.name + 'と口をきいていない'); }

  yStressAdd(n);
  return { n, why };
}

/* 朝に戻る体力の倍率。**ストレスが高いほど、寝ても抜けない** */
function yStressMorningMul() {
  if (!CONF.stressMax) return 1;
  const d = CONF.stressDull || 60, v = yStress();
  if (v <= d) return 1;
  return Math.max(0.15, 1 - (v - d) / (CONF.stressMax - d) * 0.85);
}

/* ============ 朝の一巡り ============
   営業日は startDay から、定休日は準備画面に入った時に呼ばれる。
   **1日に一度しか走らない**（どちらから来ても二重に払わない）        */
function yMorning() {
  const c = G.ch2; if (!c) return;
  if (c.lastMorning === G.day) return;
  c.lastMorning = G.day;

  if (typeof yCheckAway === 'function') yCheckAway();   // 今日ひとが抜けるかを先に決める
  if (typeof yCheckKouji === 'function') yCheckKouji();
  if (typeof yCheckKouko === 'function') yCheckKouko();
  if (typeof yPayBill === 'function') yPayBill();

  // 昨日ぶんの来店を累計へ
  if (c.lastPaid) { c.totalGuests = (c.totalGuests || 0) + c.lastPaid; c.lastPaid = 0; }

  /* 5F食堂の板前・源さん（妻の提案 → 電話 → 妻の小言）。
     厨房を置いた瞬間の③だけは renderShop 側から走る（yGenKitchen） */
  if (typeof yGenMorning === 'function') yGenMorning();

  /* 営業日の朝だけ体力が戻る（休んだ日の回復は、その日に選んだ行き先ぶん）。
     **ストレスによる回復の目減りは廃止**（作者決定 8/8）＝1ゲージ1結果。
     ストレスの出口は「MAXで主人公が帰る」の1つだけにする                    */
  if (!yClosedToday()) yStamAdd(yStamBack());
  /* **倒れた日は丸一日寝ている＝体力が全部戻る。**
     ここで戻さないと、翌日も0のままでもう一度倒れ、抜け出せなくなる */
  else if (c.downDay === G.day) yStamAdd(yStamMax());
}

/* ============ 一日の終わり（定休日ぶん）============
   営業していないので日報は出さない。**日付だけ進めて、次の朝へ**   */
function yEndOffDay() {
  /* ⚠ **旗を必ず下ろす。**ライバル店の一枚絵は `yShowResult` を通らずに
     ここへ落ちるので、下ろし忘れると `Y_OFFDAY_OPEN` が立ったままになり、
     **次の定休日に朝の画面が二度と出なくなる**（実測 8/8）              */
  Y_OFFDAY_OPEN = false;
  G.day++;
  G.invBuy = 0; G.invMove = 0; G.invSell = 0; G.invFix = 0;
  G.cashAtDayStart = G.cash;
  if (typeof enterPrep === 'function') enterPrep();
  if (typeof updateTopbar === 'function') updateTopbar();
  if (typeof saveGame === 'function') saveGame();
}

/* ============ 準備画面に入るたび ============
   game.js の enterPrep が呼ぶ syncKaigyoBtn に相乗りしている。
   ここで①朝の一巡り②【営業開始】の文字③【臨時休業】の出し入れ、をまとめて片付ける */
function ySyncKaigyoBtn() {
  if (!G.ch2) return;
  yMorning();
  const closed = yClosedToday();
  const btn = document.getElementById('btnOpen');
  if (btn) {
    const why = yClosedWhy();
    btn.textContent = !closed ? '🏮 営業開始' : '🛌 今日は動けない';
    /* 定休日は**ボタンを出さない**（作者指定 8/10）。押して初めて月曜の一枚が出る形だと、
       押すまで外観画面で足止めされる＝店を開けられない日に「開く」以外の操作は要らない */
    btn.classList.toggle('hidden', !!closed);
  }
  /* 【臨時休業】は廃止（作者決定 8/5）。同じボタンを**朝の選択をやり直す**入口に使う＝
     一度決めたあとでも、営業を始める前なら考え直せる                       */
  /* 【臨時休業】は廃止（作者決定 8/5）。**ボタンそのものを出さない**＝
     館内案内図にも各フロアにも並べない。朝の選択は
     **一日の初めに画面を占有して1度だけ**出す（作者指定）                  */
  const kb = document.getElementById('btnKyugyo');
  if (kb) kb.classList.add('hidden');
  /* その一日の初めに、自動で【今日は何をする？】を開く。
     決め終われば yPlanDone() が立つので、同じ日に二度は出ない            */
  if (!closed && !yPlanDone() && G.day > 1 && G.phase === 'prep' && !Y_OFFDAY_OPEN) {
    yOffDay();
  }
  /* 定休日（月曜）は**その場で一枚を出す**（作者指定 8/10）。
     以前は【🛌 今日は動けない】を押させてから出していたので、
     押すまで外観画面を眺めるだけの間があった＝月曜は開いた瞬間にイベントが始まる */
  if (closed && G.phase === 'prep' && !Y_OFFDAY_OPEN) yOffDay();
  /* 体力が尽きたときの処理は **closeDay（rules_y.js）へ移した**（8/8）。
     ここで見ると翌朝の回復を足したあとになり、体力が25で張り付いて一度も倒れなかった */
}

/* ============ 倒れる（作者決定 8/5・8/8 に閉店時へ移した）============
   閉店の時点で体力が尽きていたら、その場で倒れる。**休むのは翌日。**
   翌朝は yMorning が体力を全快させる（丸一日寝ているので）              */
function yCollapse() {
  const c = G.ch2; if (!c) return;
  if (c.downDay === G.day + 1) return;              // 二重に倒れない
  c.downDay = G.day + 1;
  yHospitalBill();
}

/* ============ 倒れた日の病院代（作者決定 8/5）============
   **出勤は止めない。金で痛む。**
   ・初回 ¥30,000
   ・**直近30日のうちに繰り返すたび倍**（6万 → 12万 → 24万）。24万で頭打ち
   ＝体を壊し続ける店は、金のほうから畳まれていく。
   24時間営業を病院代で買い続けられないように、ここだけは容赦なく上がる    */
const HOSPITAL_BASE_Y = 30000, HOSPITAL_CAP_Y = 240000, HOSPITAL_WINDOW_Y = 30;
function yHospitalBill() {
  const c = G.ch2; if (!c) return;
  c.downLog = (c.downLog || []).filter(d => G.day - d < HOSPITAL_WINDOW_Y);   // 直近30日ぶんだけ数える
  const nth = c.downLog.length;                                              // これまでの回数（0＝初回）
  c.downLog.push(G.day);
  const fee = Math.min(HOSPITAL_BASE_Y * Math.pow(2, nth), HOSPITAL_CAP_Y);
  G.cash -= fee;
  c.hospital = (c.hospital || 0) + fee;
  toast('🏥 倒れた。今日は開けられない（病院代 ' + yen(fee) + '）');
  log('🏥 体力が尽きて倒れた。病院代 ' + yen(fee)
      + (nth ? '（直近30日で' + (nth + 1) + '度目）' : ''));
  if (typeof yStressAdd === 'function') yStressAdd(15);
  if (typeof yMoodAdd === 'function') yMoodAdd(-8, '倒れた');
}

/* ============ 臨時休業 ============ */
function yKyugyo() {
  if (!G.ch2 || yClosedToday()) return;
  const box = document.getElementById('offdayBody');
  document.getElementById('offdayTitle').textContent = '🚪 臨時休業';
  /* **常連減も評判減も無い**（作者決定 8/5）。休むこと自体は罰しない。
     痛むのは**売上がゼロなのに、地代も返済も生活費も待ってくれない**という一点だけ */
  document.getElementById('offdayNote').innerHTML =
    '今日は暖簾を出さない、ということ。<br>' +
    '<b>売上はゼロだが、支払いは待ってくれない。</b>体は、そのぶん戻る。';
  box.innerHTML = '';
  const yes = document.createElement('button');
  yes.className = 'big-btn danger'; yes.textContent = '休みにする';
  yes.onclick = () => {
    G.ch2.kyugyoDay = G.day;
    log('🚪 臨時休業にした');
    yOffDay();                                  // そのまま「今日どうする？」へ
  };
  const no = document.createElement('button');
  no.className = 'big-btn'; no.textContent = 'やめておく';
  no.onclick = () => yCloseDayScreen();
  box.appendChild(yes); box.appendChild(no);
  document.getElementById('btnOffdayClose').classList.add('hidden');
  yOpenDayScreen();
  return true;
}

/* ============================================================
   行き先（作者決定・6つ）
   ------------------------------------------------------------
   **1週間に1回しか動けない**から選択が重くなる。増やしすぎない。
     stam … 体力の増減 ／ mood … 妻の機嫌の増減 ／ cost … かかる金
   ============================================================ */
/* ============ 朝の行き先（作者決定 8/5 → 8/8 に「そのまま出勤する」を追加）============
   いちど4つに絞ったが、**毎朝の問いに戻したので全部残す。**
   毎朝の判断が意味を持つのは、**行き先ごとに払うものと戻るものが違う**からで、
   数が少ないと「いつもの一択」になってしまう。

   **配分の芯＝1回で1つだけ戻る**（作者決定 8/8）。
   以前は「妻と出かける」が体力+45・ストレス−40・機嫌+18 を **¥1,000** で三重取りしていて、
   ライバル店（月白 SPA TERRACE）は ¥4,500 でストレス−75＝**1回で全快**していた。
   それぞれに得意な1つを持たせ、他は少しか、むしろ払う形にした。
     🛌 寝る       … 体力の専門
     ♨️ ライバル店 … ストレスの専門（＋よその手の内が見える）
     🍶 ロウリュ街       … いちばん深く抜けるが、妻に払う
     💗 妻と出かける … 機嫌の専門                                            */
const OFFDAY_Y = [
  /* **そのまま出勤する**（2026-08-08 追加）。
     この一枚の設計には最初から書かれていたのに、**表に入っていなかった。**
     結果、2日目からは毎朝かならず寄り道を選ばされ、まっすぐ店を開けられなかった
     （作者は「火曜日に営業できない」として発見。火曜＝朝の画面が初めて出る2日目）。
     **これが3つのゲージが一度も効かなかった本当の原因でもある**＝
     毎日ただでストレスが抜けて体力が戻っていたので、端まで削れるはずがなかった。
     効果はゼロ。**何もしない選択肢がいちばん上にある**のが大事              */
  { id: 'shukkin', icon: '🏪', name: 'そのまま出勤する', stam: 0, mood: 0, stress: 0, cost: 0,
    sub: '寄り道はしない。いつもどおり店に立つ' },
  /* 体力に全振り。**金もかからないが、ストレスはほとんど抜けない**
     ＝寝ても、気がかりは消えない */
  { id: 'nero',   icon: '🛌', name: 'ひたすら寝る',   stam: 60, mood: 0,  stress: -5, cost: 0,
    sub: '体力が全部戻る。ただ、それだけの一日' },
  /* **筋トレ**。その日の体力ではなく、**上限**が上がる。
     効くのは今日ではなく、これからの毎日＝**唯一、積み上がる寄り道** */
  { id: 'kintore', icon: '💪', name: '筋トレ', stam: -10, mood: -2, stress: -5, cost: 2000,
    sub: '体力の上限が' + STAM_TRAIN_UP_Y + '上がる（' + STAM_MAX_CAP_Y + 'まで）。今日は疲れるが、明日からが変わる' },
  /* ストレスに全振り。**どの店へ行くかで、値段も効きも変わる**（RIVAL_VISIT_Y） */
  { id: 'sauna',  icon: '♨️', name: 'ライバル店へ',   stam: 0, mood: 0, stress: 0, cost: 0,
    sub: '店ごとに値段も効きも違う。よその店の中身も見えてくる' },
  /* 金をかけずに整える道。**自分の店にサウナがある日から出る** */
  { id: 'uchi',   icon: '🏮', name: 'うちの湯に入る', stam: 25, mood: 0,  stress: -25, cost: 0,
    need: 'hasSauna',
    sub: 'ただ働きではなく、客として入る。金はかからない' },
  /* 行き先で値段も効きも変わる（odekake_y.js の DATE_SPOTS_Y）＝ここは入口だけ */
  { id: 'wife',   icon: '💗', name: '妻と出かける',   stam: 0, mood: 0, stress: 0,  cost: 0,
    sub: '行き先はその日に決まる。風待公園から水明まで、値段も効きも違う' },
  /* **身勝手なほうの道。**妻の機嫌を払って、ストレスをいちばん深く抜く。
     3回に1回、うちで働きたいという人に出会う */
  { id: 'nomi',   icon: '🍶', name: 'ロウリュ街で飲む',     stam: -5, mood: -10, stress: -50, cost: 12000,
    sub: 'ストレスがいちばん深く抜ける。人と出会う夜もある' },
  /* 行き先で値引きも掘り出し物の確率も変わる（odekake_y.js の KAIDASHI_SPOTS_Y） */
  { id: 'kaidashi', icon: '🛍', name: '買い出し',      stam: -5, mood: -2, stress: 3,  cost: 0,
    sub: '地下街・地元のモール・郊外の大型店。遠くまで出た日ほど、当たりが出る' },
  /* **普通は選ばない一日。だからこそ、選んだ日には返す**（作者決定 8/5）。
     設備を自分の手で直し、汚れを消し、バイトの練度まで上がる */
  { id: 'mise',   icon: '🔧', name: '店に出る', stam: -25, mood: -3, stress: 5, cost: 0,
    sub: '自分の手で直す。傷みも汚れも消えて、バイトも締まる。彼女は黙っている' },
  /* サウナ経営の腕（サウナ専門家スキルの入口） */
  { id: 'kousyu', icon: '🎓', name: '講習を受ける', stam: -15, mood: -2, stress: 5, cost: 80000,
    sub: 'サウナ経営の腕が上がるかも。通うほど、身につくものがある' },
];

/* ============ スキル（作者決定 8/5・ここが第1号）============
   仕様は §9-6d に20個ぶん書いてあるが、**実装するのは覚えた順**。
   第1号は【働き者】＝「店に出る」を5回選ぶと付く。
   普通は選ばない一日を、5回も選んだ人にだけ返す                            */
const SKILL_NAME_Y = { hatarakimono: '💪 働き者', senmonka: '🔥 サウナ専門家',
                       akasuriPro: '🧖 垢すり職人' };
function ySkills() {
  const c = G.ch2; if (!c) return [];
  if (!Array.isArray(c.skills)) c.skills = [];
  return c.skills;
}
function yHasSkill(k) { return ySkills().indexOf(k) >= 0; }
function yGainSkill(k) {
  if (yHasSkill(k)) return false;
  ySkills().push(k);
  log('✨ ' + (SKILL_NAME_Y[k] || k) + ' を覚えた');
  return true;
}

/* ============ 🧖 垢すり職人（作者指定 2026-08-08）============
   講習に行くと、**たまに**ひとりだけ垢すりの腕を持って帰る。
   持ち主は3種いて、誰に付くかは選べない：

     ・主人公 … ySkills() に 'akasuriPro'
     ・妻　　 … G.ch2.wifeAka
     ・バイト … emp.aka

   狙って取れないので、**取れた人の持ち場が、そのまま台を置く階になる。**
   （番台に立つ人に付けば、会計と垢すりのどちらを優先するかを選ぶことになる）

   確率は1回あたり45%。まだ誰も持っていない間は必ず出す＝
   「垢すり台を買ったのに永久に職人が生まれない」で詰ませない            */
const AKA_KOUSHU_P = 0.45;
function yAkasuriHolders() {
  const c = G.ch2 || {};
  const out = [];
  if (!yHasSkill('akasuriPro')) out.push({ who: 'me',   name: '自分' });
  if (!c.wifeAka)               out.push({ who: 'wife', name: (typeof WIFE_Y !== 'undefined' ? WIFE_Y.name : '妻') });
  for (const e of (G.roster || [])) if (!e.aka) out.push({ who: 'emp', name: e.name, emp: e });
  return out;
}
function yHasAnyAkasuriPro() {
  const c = G.ch2 || {};
  return yHasSkill('akasuriPro') || !!c.wifeAka || (G.roster || []).some(e => e.aka);
}
function yKoushuAkasuri() {
  const cands = yAkasuriHolders();
  if (!cands.length) return '';                       // もう全員が持っている
  // まだ店に一人も居ないうちは必ず、居るなら45%
  if (yHasAnyAkasuriPro() && Math.random() >= AKA_KOUSHU_P) return '';
  const t = cands[Math.floor(Math.random() * cands.length)];
  if (t.who === 'me') yGainSkill('akasuriPro');
  else if (t.who === 'wife') { G.ch2.wifeAka = true; log('✨ ' + t.name + 'が【🧖 垢すり職人】を覚えた'); }
  else { t.emp.aka = true; log('✨ ' + t.name + 'が【🧖 垢すり職人】を覚えた'); }
  return '<br><br><b>🧖【垢すり職人】' + (t.who === 'me' ? 'を覚えた。' : 'を' + t.name + 'が覚えた。') + '</b><br>'
       + '<span class="opt-sub">垢すり台のある階に立たせると、ひとり60分¥6,000の垢すりができる。'
       + 'ただし<b>その60分は他に何もできない</b></span>';
}

/* 自分の店にサウナが1つでもあるか（「うちの湯に入る」が出る条件） */
function yHasSaunaOfMine() {
  return (G.equip || []).some(e => (EQ[e.id] || {}).cat === 'sauna');
}


/* その一日の結末（短い一幕。ここに台本を足していく） */
function yOffdayDo(a) {
  let text = '';
  if (G.cash < (a.cost || 0)) { toast('金が足りない…'); return null; }
  G.cash -= a.cost || 0;

  /* **そのまま出勤＝結果画面を挟まない。** 何も起きていないのに
     「〜した」という一枚を読ませるのは、毎朝のことなので煩わしい。
     この画面を閉じて、いつもの準備画面へまっすぐ戻す（日付は進めない）      */
  if (a.id === 'shukkin') {
    const p = yPlan(); p.act = 'shukkin'; p.go = true; p.done = true;
    Y_OFFDAY_OPEN = false;
    yCloseDayScreen();
    if (typeof enterPrep === 'function') enterPrep();
    if (typeof updateTopbar === 'function') updateTopbar();
    if (typeof saveGame === 'function') saveGame();
    return null;                                            // null＝結果画面を出さない
  }
  if (a.id === 'wife') { return yGoDateRandom(); }          // 行き先はその日に決まる（選ばない）
  else if (a.id === 'nero') {
    const n = (G.ch2.neroCount = (G.ch2.neroCount || 0) + 1);
    text = n === 1
      ? '何もしなかった。<br>'
        + '起きたら昼で、また寝た。次に目を開けたら日が落ちていた。<br>'
        + '<b>体力が全部戻った。</b>ただ、湯の匂いだけがずっと頭にあった。'
      : '布団から出なかった。<br>'
        + WIFE_Y.name + 'が一度だけ様子を見に来て、何も言わずに戸を閉めた。<br>'
        + '<b>体力が全部戻った。</b>';
  }
  else if (a.id === 'kintore') {
    /* **唯一、積み上がる寄り道。** その日の体力ではなく上限が上がる＝
       効くのは今日ではなく、これからの毎日                                 */
    const c = G.ch2;
    const before = yStamMax();
    c.stamUp = (c.stamUp || 0) + STAM_TRAIN_UP_Y;
    const after = yStamMax();
    const n = (c.kintoreCount = (c.kintoreCount || 0) + 1);
    text = after > before
      ? (n === 1
        ? '温見のジムに入った。三十を過ぎてから、初めて鉄を持った。<br>'
          + '思っていたより持てなかった。思っていたより、悔しかった。<br>'
          + '<b>体力の上限が' + after + 'になった。</b>'
        : '同じ時間に行くと、同じ顔ぶれがいる。誰も何も言わないが、来なかった日は分かるらしい。<br>'
          + '<b>体力の上限が' + after + 'になった。</b>（' + n + '回目）')
      : 'ジムには行った。だが、もうこれ以上は変わらない気がした。<br>'
        + '<b>体力の上限はこれで頭打ちだ（' + after + '）。</b>あとは、使い方の問題だろう。';
  }
  else if (a.id === 'uchi') {
    const n = (G.ch2.uchiCount = (G.ch2.uchiCount || 0) + 1);
    text = n === 1
      ? '休みの日に、自分の店の湯へ入った。掃除ではなく、客として。<br>'
        + '座ってみて初めて分かることがあった。時計が見えにくい。'
        + '水風呂までの二歩が、濡れた床で滑る。<br>'
        + '<b>——うちの店を、初めて客の目で見た。</b>'
      : '誰もいない館内で、自分の湯に入った。<br>'
        + '静かだった。この静けさに、金を払ってもらっているのだと思った。';
  }
  else if (a.id === 'sauna') { return 'pickRival'; }             // 行き先をもう一段選ぶ
  /* ── 妻とサウナへ ────────────────────────────────
     **主人公は男湯しか見ていない。** 女湯を見た人間の話を聞いて初めて、
     女性客のための設備が「置くと良いもの」から「無いと選ばれないもの」に変わる */
  else if (a.id === 'wifesauna') {
    const w = yWife();
    const n = (G.ch2.wifeSauna = (G.ch2.wifeSauna || 0) + 1);
    if (n === 1) {
      G.ch2.onnayu = true;
      text = '休みの日に、二人で他所のサウナへ行った。館内着で待ち合わせて、飯を食った。<br>'
           + '「……ねえ。ここ、女湯のほうが混んでたわよ」<br>'
           + '言われて、少し黙った。俺は今まで、男湯しか見ていない。<br>'
           + '「ドライヤーが六台あったの。うちは二台でしょう。<br>'
           + '女の人はね、髪を乾かし終わるまでが風呂なのよ」<br><br>'
           + '<b>——女湯の目が手に入った。うちに足りないものが見えるようになった。</b>';
      log('💗 ' + WIFE_Y.name + 'と他店へ行った。女湯の目が手に入った');
    } else if (n === 2) {
      text = '二度目。今日は' + WIFE_Y.name + 'のほうが先に見つけてきた。<br>'
           + '「化粧水が置いてあったわ。あれ、たぶん原価は知れてる。<br>'
           + 'でも“ここは女を客だと思ってる”って伝わるの。それが全部よ」<br>'
           + '帰り道、彼女はずっと店の話をしていた。俺ではなく、自分の店の話を。';
    } else {
      text = '二人でサウナへ行くのが、いつのまにか習慣になっていた。<br>'
           + '「あなた、最近ちょっと楽しそうね」と' + WIFE_Y.name + 'が言った。<br>'
           + '否定しなかった。';
      w.pushed = Math.max(0, w.pushed - 1);
    }
  }
  else if (a.id === 'nomi') {
    G.ch2.jinmyaku = (G.ch2.jinmyaku || 0) + 1;
    text = 'ロウリュ街の路地で飲んだ。<br>'
         + '設備屋時代の後輩、熱波をやりたいという若いの、隣の店の店長。'
         + '名刺は配らなかったが、名前は覚えられた。<br>'
         + '<b>肩の力が、久しぶりに抜けた。</b>';
    /* **通うほど、焼き場の男との距離が縮む**（作者指定 8/6）。
       6回目で源さんは「あんたんとこで腕を振る」と言い出すが、そこに至るまでを
       ここで見せておかないと、電話が唐突になる＝**関係は、数字ではなく場面で貯める** */
    const g = yNogeGenText();
    if (g) text += '<br><br>' + g;
    if (typeof yNogeLearn === 'function') text += yNogeLearn();
    /* **隠れイベント。**3回に1回くらい、うちで働きたいという人に出会う（作者指定 8/6）。
       面接まで待たせない＝**その場で決める**（次の画面に採用ボタンが出る） */
    const met = yNogeScout();
    if (met) {
      G.ch2.scoutPid = met.pid;
      text += '<br><br>' + yNogeScoutText(met);
    }
    /* 夜の路地の一枚絵。**通うほど絵が変わる**（odekake_y.js の NOGE_IMGS_Y） */
    if (typeof yNogeScenes === 'function' && typeof yPlayOffdayScenes === 'function') {
      yStamAdd(a.stam || 0); yMoodAdd(a.mood || 0, a.name); yStressAdd(a.stress || 0, a.name);
      yPlayOffdayScenes(yNogeScenes(), text);
      return null;                       // 絵のほうで結果まで出すので、ここでは何も返さない
    }
  }
  else if (a.id === 'kaidashi') { return yGoKaidashiRandom(); }   // 同上
  else if (a.id === 'hataraku') {
    const c = G.ch2;
    const hard = yHasSkill('hatarakimono');      // 【働き者】＝手が早い
    const heal = hard ? 45 : 30;                 // 傷みの戻り（自分で直すので修理代はゼロ）
    let fixed = 0, revived = 0;
    for (const e of G.equip) {
      if ((CONF.wearPerDay[EQ[e.id] ? EQ[e.id].cat : ''] ?? 0) <= 0) continue;
      if ((e.cond || 0) >= 100) continue;
      /* **壊れた設備も、自分で直してしまう**（作者決定 8/5）＝業者を呼ばずに済む。
         これが「店に出る」の、いちばん分かりやすい見返り */
      if ((e.cond || 0) <= 0) { e.fault = null; revived++; }
      e.cond = clamp((e.cond || 0) + heal, 0, 100); fixed++;
    }
    const dirt = (G.dirts || []).length;
    G.dirts = [];
    /* **やる気が戻る**（作者指定 8/5）。
       ふてくされていたバイト（sulk）は、給料を上げなくても機嫌が直る＝
       店主が黙って手を動かしている横で、拗ねたままではいられない。
       ※以前ここで「練度」を上げていたが、**あれは0〜100の数字を10で頭打ちに
         していた壊れたコード**で、実際には一度も上がっていなかった        */
    let up = 0;
    for (const e of (G.roster || [])) if (e.sulk) { e.sulk = false; up++; }
    const n = (c.hatarakuCount = (c.hatarakuCount || 0) + 1);
    text = '店に出た。<br>'
         + '客を入れずに、ネジを締め直し、目地を洗い、床を拭いた。'
         + '<b>設備' + fixed + '点の傷みが戻り'
         + (revived ? '（うち' + revived + '点は壊れていたのを直した）' : '')
         + '、汚れ' + dirt + 'つが消えた。</b>'
         + (up ? '<br>拗ねていた' + up + '人が、黙って手伝いに来た。<b>やる気が戻った。</b>' : '')
         + '<br>夜に帰ると、飯はラップがかかっていた。' + WIFE_Y.name + 'はもう寝ていた。';
    // 5回で【働き者】
    if (n >= 5 && !yHasSkill('hatarakimono')) {
      yGainSkill('hatarakimono');
      text += '<br><br><b>💪【働き者】を覚えた。</b><br>'
            + '<span class="opt-sub">立っている1時間あたりの消耗が半分になる。'
            + '「店に出る」日の直りも早くなる</span>';
    }
  }
  /* ⚠ 選択肢の id は `kousyu`（OFFDAY_Y）なのに、ここは `koushu` を見ていた＝
     **この一節は一度も動いていなかった**（2026-08-08 発見）。
     ★の底上げも【🔥 サウナ専門家】も、通っても何も起きていなかったことになる。
     id はセーブ（yPlan().act）にも入るので、直すのは**綴りではなくこちら側**。
     両方受けるようにして、古いセーブも取りこぼさない                      */
  else if (a.id === 'kousyu' || a.id === 'koushu') {
    /* **★の能力をひとつ上げる**（作者指定 8/5）。
       いちばん低いところが伸びる＝苦手を埋める講習。5つ星で頭打ち。
       ※ここも「練度」を10で頭打ちにしていて、**一度も上がっていなかった** */
    const KEYS = (CONF.staffSkills || ['maji', 'spd', 'aiso']);
    const LABEL = { maji: '真面目', spd: 'スピード', aiso: '愛想', ryori: '料理' };
    let up = 0; const gained = [];
    for (const e of (G.roster || [])) {
      let lowKey = null, low = 99;
      for (const k of KEYS) { const v = e[k] || 0; if (v < low && v < 5) { low = v; lowKey = k; } }
      if (!lowKey) continue;                                  // 全部★5＝もう教えることがない
      e[lowKey] = (e[lowKey] || 0) + 1; up++;
      gained.push(e.name + 'の' + (LABEL[lowKey] || lowKey));
    }
    text = up
      ? '温見の会館で、熱波と衛生の講習を受けた。<br>'
        + '教わったことを、そのままバイトに落とした。<br>'
        + '<b>' + gained.join('・') + 'が★1つ上がった。</b>'
      : '温見の会館で、熱波と衛生の講習を受けた。<br>教わったことを、落とす相手がまだいない。';
    const n = (G.ch2.koushu = (G.ch2.koushu || 0) + 1);
    /* **3回で【サウナ専門家】**（作者決定・§9-6d の2番目）。
       バイトに配るだけでなく、**自分の中に残るもの**がここで初めて出る       */
    if (n >= 3 && !yHasSkill('senmonka')) {
      yGainSkill('senmonka');
      text += '<br><br><b>🔥【サウナ専門家】を覚えた。</b><br>'
            + '<span class="opt-sub">🔥サウナの評価が10上がる。'
            + '室温も湿度も、もう人に聞かなくていい</span>';
    } else if (!yHasSkill('senmonka')) {
      text += '<br><span class="opt-sub">通ったのは' + n + '回。あと' + (3 - n) + '回で、何かが身につきそうだ</span>';
    }
    text += yKoushuAkasuri();
  }
  yStamAdd(a.stam || 0);
  yMoodAdd(a.mood || 0, a.name);
  yStressAdd(a.stress || 0, a.name);
  return text;
}

/* ── 他店めぐり。大会は冒頭のイントロで既知（battleKnown常時true・作者決定 8/8）＝
      ここで知らせるのではなく、**出場者としてどう見られるか**を描く ── */
function yVisitRival(r) {
  const c = G.ch2;
  c.visited = c.visited || {};
  const first = !c.visited[r.id];
  c.visited[r.id] = (c.visited[r.id] || 0) + 1;
  /* 連続で同じ店に通っている週数（オーナーの「三週連続ですね」用） */
  const vs = c.visitStreak || (c.visitStreak = { id: null, n: 0 });
  if (vs.id === r.id) vs.n++; else { vs.id = r.id; vs.n = 1; }
  const v = yVisitVal(r.id);
  let text = '<b>' + r.name + '</b>（' + r.area + '）<br>' + r.desc + '<br><br>';

  if (r.id === 'tenku') {
    /* 大会はイントロで既知（壁打ち3往復・INTRO_SCRIPT.md）。初耳の顔をさせない */
    text += first
      ? '設備屋だったころ、この店にストーブを納めた。支配人は、こちらの顔を覚えていた。<br>'
        + '「自分の店を持ったんだってな。出るんだろ、<b>サウナバトル</b>」<br>'
        + '返事の前に、支配人は笑った。<br>'
        + '「うちが六年連続で獲ってる。悪いことは言わん、無理はするな」'
      : '相変わらず、水風呂は一槽しかない。<br>'
        + '六年連続の王者が、そこだけ直さないでいる。理由があるのか、気づいていないのか。';
  } else {
    text += first
      ? 'まずは客として入った。脱衣所の導線、椅子の数、掃除の入り方。<br>'
        + '帰り際、番台の人と少し話した。同じ商売をしている、というだけで話は通じる。'
      : '二度目。前は見えなかったところが見えた。<br>'
        + '良い店ほど、金をかけていない場所に工夫がある。';
  }
  /* **店ごとに、値段も効きも違う。**（RIVAL_VISIT_Y）
     土日のSAUNA GATE 37のように、曜日で効きが落ちる店もある */
  G.cash -= v.cost;
  yStamAdd(v.stam);
  yMoodAdd(v.mood, r.name);
  yStressAdd(v.stress, r.name);
  if (v.crowded) log('😣 ' + r.name + 'は混みすぎていた（ととのい半減）');
  return text;
}

/* ============ 画面 ============ */
let Y_OFFDAY_OPEN = false;
/* 【営業開始】を押したときに割り込む。
   **朝の選択がまだなら、まずそれを出す**（＝毎朝かならず1枚はさむ）。
   選び終わっていれば false を返して、いつもどおり店を開ける                */
function yOffDay() {
  if (!G.ch2) return false;
  /* ============ 「今日は何をする？」を出さない章（作者決定 8/8）============
     **主役はサウナ。**毎朝の選択は廃止した。営業日は何も聞かずに店を開け、
     定休日（月曜）は**強制イベントの一枚**を出す。
     `dayChoice: true` に戻せば、下の従来どおりの選択画面がそのまま生き返る */
  if (!CONF.dayChoice) {
    const p0 = yPlan(); p0.act = 'shukkin'; p0.go = true; p0.done = true;
    if (!yClosedToday()) return false;                  // 営業日＝そのまま開ける
    if (Y_OFFDAY_OPEN) return true;                     // もう出している
    Y_OFFDAY_OPEN = true;
    yOpenDayScreen();
    yShowMondayEvent();
    return true;
  }
  /* **初日は出さない**（作者指定 8/5）。開業の日に「今日はどう過ごす？」と聞かれても、
     やることは一つしかない＝暖簾を出す。選ばせるのは2日目から               */
  if (G.day <= 1 && !yClosedToday()) {
    const p = yPlan(); p.act = 'shukkin'; p.go = true; p.done = true;
    return false;
  }
  if (yPlanDone() && !yClosedToday()) return false;      // 今朝はもう決めた＝そのまま開ける
  Y_OFFDAY_OPEN = true;
  yRenderOffday();
  return true;
}
/* 朝の一枚は**画面ごと**（作者指定 8/5）。店の上にかぶせず、その日の朝として1画面を占める */
function yOpenDayScreen() {
  const m = document.getElementById('offdayModal');
  m.classList.add('y-day'); m.classList.remove('hidden');
  /* **上の帯（日数・所持金・評判・体力・ストレス・妻の機嫌）は隠さない**（作者指定 8/5）。
     今日をどう使うかは、その6つを見ながら決めるものなので、
     朝の画面はその**下から**始める（帯の高さぶんだけ天井を下げる）        */
  const app = document.getElementById('app');
  const bar = document.getElementById('gaugeBar');
  const top = document.getElementById('topbar');
  const last = (bar && !bar.classList.contains('hidden')) ? bar : top;
  if (app && last) {
    const y = last.getBoundingClientRect().bottom - app.getBoundingClientRect().top;
    m.style.top = Math.max(0, Math.round(y)) + 'px';
  }
}
function yCloseDayScreen() {
  const m = document.getElementById('offdayModal');
  m.classList.add('hidden'); m.classList.remove('y-day');
  m.style.top = '';
}

/* ============ ゲージが振り切れた日（作者決定 2026-08-08）============
   3つのゲージは、**端に来たとき1回だけ、はっきりした形で罰する。**
   途中の目減り（朝の回復が鈍る、など）は全部やめた＝**1ゲージ1結果**。

     体力ゼロ    → 倒れて病院。**その日は開けられない**（yClosedToday／実装済み）
     ストレスMAX → **主人公が帰る。** その日、店に立たない
     妻の機嫌ゼロ → **妻が帰る。** その日、番台に立たない（yWifeGone／実装済み）

   **どれも翌朝には戻る**（作者指定）。端に張り付いたままにせず少しだけ戻す＝
   一日ぶんの穴として効き、下り坂で詰まない。
   主人公と妻が同時に抜ける日もありうる。**そのときは店が回らない。それでいい**
   （作者判断＝バイトだけで客の不満だらけになる、その一日が罰そのもの）      */
function yBurnout() {
  return !!(G.ch2 && CONF.stressMax && G.ch2.awayDay === G.day);
}
/* 朝に、今日ひとが抜けるかを決める（yMorning から一度だけ呼ばれる） */
function yCheckAway() {
  const c = G.ch2; if (!c) return;
  /* 昨日抜けた人は、今朝には戻っている＝ゲージを端から少しだけ引き戻す */
  if (c.awayDay === G.day - 1)     yStressAdd(-30);
  if (c.wifeAwayDay === G.day - 1) yMoodAdd(20, '一晩たって');
  if (CONF.stressMax && yStress() >= CONF.stressMax && c.awayDay !== G.day) {
    c.awayDay = G.day;
    toast('🚪 もう店に行く気力がない。今日は家にいる');
    log('🚪 ストレスが振り切れた。今日は主人公が店に立たない');
  }
  if (yMood() <= 0 && c.wifeAwayDay !== G.day) {
    c.wifeAwayDay = G.day;
    toast('💢 ' + WIFE_Y.name + 'は出ていった。今日は番台に立たない');
    log('💢 ' + WIFE_Y.name + 'の機嫌が尽きた。今日は店に来ない');
  }
}
/* 今日、主人公は出勤しないか（game.js の startDay が見る）。
   朝の選択で「出勤しない」を選んだ日か、**ストレスが振り切れた日** */
function yAbsentToday() { return !yWorkToday() || yBurnout(); }
/* 【🌤 今日は何をする？】をもう一度開く（営業を始める前なら考え直せる） */
function yOffDayAgain() {
  if (!G.ch2 || yClosedToday()) return false;
  const p = yPlan(); p.done = false; p.act = null; p.go = null;
  Y_OFFDAY_OPEN = true;
  yRenderOffday();
  return true;
}
/* ============ 朝の一枚（作者指定 8/5・億女ゲームと同じ作り）============
   上に**リビングの絵**、下に選択肢を2列で並べる。
   絵はコードのドット絵 y_living（rival_art_y.js・作者決定 8/9）  */
function yMorningVisual() {
  return (typeof yArtVisual === 'function') ? yArtVisual('y_living') : '';
}
function yRenderOffday() {
  const down = yClosedToday();                       // 倒れた日は選べない
  if (typeof ySetSpotArt === 'function') ySetSpotArt(null);   // まだどこにも行っていない朝
  const box = document.getElementById('offdayBody');
  document.getElementById('offdayTitle').textContent = down ? '🛌 動けない' : '🌤 今日は何をする？';
  document.getElementById('offdayNote').innerHTML =
    ((down && typeof yHospitalVisual === 'function') ? yHospitalVisual() : yMorningVisual())
    + (down
      ? '体が動かない。今日は何もできない。<br><span class="opt-sub">寝て、明日にそなえる</span>'
      : '<b>' + G.day + '日目の朝。</b>この一日を、どう使う？<br>'
        + '<span class="opt-sub">体力 ' + Math.round(G.stam ?? yStamMax()) + ' / ' + yStamMax()
        + '　　寄り道しても、そのあと出勤はできる</span>');
  box.innerHTML = '';
  document.getElementById('btnOffdayClose').classList.add('hidden');

  if (down) {
    const b = document.createElement('button');
    b.className = 'big-btn'; b.textContent = '🛌 一日じゅう寝る';
    b.onclick = () => {
      G.stam = yStamMax();
      yMoodAdd(-3, '倒れた');
      /* ⚠ ここは yShowResult に流していた＝【🏮 出勤する】が出る。
         ところが倒れた日は yOffDay() が必ずこの画面を開き直すので、
         押しても店は開かず、**日付も進まない**＝
         「営業開始が出ずに『今日は動けない』しか出ない」で詰んでいた
         （作者報告 8/8）。倒れた日は店を開けないのだから、
         読み終えたら**そのまま明日の朝へ送る**のが正しい            */
      yShowDownResult('丸一日、泥のように眠った。<br>'
        + WIFE_Y.name + 'は何も言わずに、店の鍵を掛けに行ってくれた。<br><b>体力が全部戻った。</b>');
    };
    box.appendChild(b);
    yOpenDayScreen();
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'y-cmd-grid';
  for (const a of OFFDAY_Y) {
    // 条件つきの行き先（妻とサウナへ＝五軒を見終わってから出る）
    if (a.need === 'hasSauna') { if (!yHasSaunaOfMine()) continue; }
    else if (a.need && !G.ch2[a.need]) continue;
    if (a.id === 'wifesauna' && yWifeGone()) continue;     // 彼女が下りていたら誘えない
    const b = document.createElement('button');
    b.className = 'y-cmd';
    b.innerHTML = '<b>' + a.icon + ' ' + a.name + '</b>'
      + (a.cost ? '<span class="y-cmd-cost">' + yen(a.cost) + '</span>' : '')
      + '<span class="y-cmd-sub">' + a.sub + '</span>';
    // **金のかからない行き先は、素寒貧でも押せる**（寝るのに金は要らない）
    b.disabled = (a.cost || 0) > 0 && G.cash < a.cost;
    b.onclick = () => {
      const p = yPlan();
      p.act = a.id;
      const r = yOffdayDo(a);
      if (r === null) return;
      if (r === 'pickRival') { yRenderRivalPick(); return; }
      yShowResult(r);
    };
    grid.appendChild(b);
  }
  box.appendChild(grid);
  yOpenDayScreen();
}
/* どの店へ行くか */
function yRenderRivalPick() {
  const box = document.getElementById('offdayBody');
  document.getElementById('offdayNote').innerHTML =
    'どこへ行く？<br><span class="opt-sub">よその店を見ると、そこの中身が分かるようになる</span>';
  box.innerHTML = '';
  for (const r of RIVALS_Y) {
    const b = document.createElement('button');
    b.className = 'big-btn';
    const n = ((G.ch2.visited || {})[r.id] || 0);
    /* **一度でも客の話を聞いた店は、良し悪しがここに残る。**
       行き先を選ぶたびに「どこが強くて、どこが穴か」を思い出せる */
    const t = (G.ch2.talked || {})[r.id] || null;
    /* **値段と効きは店ごとに違う。**選ぶ前に見えていないと選べない */
    const v = yVisitVal(r.id);
    const money = G.cash < v.cost;
    b.disabled = money;
    b.innerHTML = '♨️ ' + r.name + '　' + yen(v.cost)
                + '<br><span class="opt-sub">' + r.area
                + (n ? '　（' + n + '回行った）' : '　はじめて')
                + '<br>ストレス ' + v.stress + '　体力 +' + v.stam
                + (v.crowded ? '　<b>※今日は混む</b>' : '')
                + (money ? '　<b>※金が足りない</b>' : '')
                + (t ? '<br>◎ ' + t.good + '　／　▲ ' + t.bad : '') + '</span>';
    b.onclick = () => {
      /* **館内図を先に見せてから、話にする。**（第1章の蒼天SPAと同じ作り）
         数字で「水風呂70」と言われても伝わらないが、一槽に並んでいる絵なら分かる */
      /* **一枚絵と立ち話で終わり。あとから同じ話をまとめ直さない**（作者決定 8/2）。
         最後の一行で締めたところに説明文を足すと、余韻がそこで切れる */
      const text = yVisitRival(r);
      const scenes = yRivalScenes(r);
      if (scenes.length && typeof Story !== 'undefined') {
        /* **先に一枚絵を出してから、この画面を閉じる。**
           順番が逆だと、あいだの一瞬だけ自分の店の画面が見えてしまう */
        Story.play(scenes, () => yEndOffDay());
        yCloseDayScreen();
      } else {
        yShowResult(text);       // 台本が無い店（保険）。この画面のまま結果だけ出す
      }
    };
    box.appendChild(b);
  }
}

/* ── 館内図と、その場で目に入るもの（一枚絵＋短い地の文）──
   台詞ではなく**見たもの**を書く。判断の材料になるのは、いつも設備の並びのほう。
   ⚠ 一枚絵の文字送りはタグを解釈しない（textContent）＝**<br>や<b>は書かない。**
     行を分けたいときは、配列を分ける                                        */
const RIVAL_SCENE_Y = {
  /* ⚠ **文体は「紹介体」で統一**（作者決定 2026-08-08）。
     主人公はととのい市に何年も住み、五軒とも通っている＝**初めて見た人の驚き方はしない。**
     店の名前を頭に置き、惚れている人間として**プレイヤーに紹介する。**

     ⚠ **主人公にマイナスは言わせない。**「看板が小さい」「派手さはない」のような、
       欠点に読める説明は全部落とす。**穴を明かすのは、その店の客の役目**
       （RIVAL_TALK_Y。建物の古さも、墨の常連も、値段の高さも、全部あちらが持っている）。
       主人公が誉めるほど、あとの立ち話の一言が効く。

     ⚠ ただし**「うちは〜」という自分の店への引け目は残す。**
       それは相手の欠点ではなく、この章を動かしている当人の話だから              */
  tenku: [
    ['y_tenku_bath', [
      'SAUNA GATE 37。ととのい市のサウナの聖地と言えば、間違いなくここだ。',
      '蒸都ターミナルの十四階。ととのい中央駅の改札から、雨の日でも濡れずに着く。',
      '八角形の檜の湯。十六度の水風呂。ジャグジー。寝湯。',
      '——欲しいものが、全部ここにある。',
    ]],
    ['y_tenku_sauna_in', [
      'サウナ室は二つ。ここがSAUNA GATE 37の本丸だ。',
      'メインサウナには、タワーストーブが二台。一時間ごとにアウフグースが入る。',
      '窓の向こうには、ととのい湾が視界の端まで広がっている。',
      'もう一室は、セルフロウリュ。二百キロ以上のサウナストーンが積み上げられている。',
      '柔らかいのに、身体の芯まで届く熱だ。檜の匂いと、落とされた照明。',
      'この部屋では、誰も喋らない。',
      '——自分の呼吸と、石に水が落ちる音だけが聞こえる。',
    ]],
    ['y_tenku_meshi', [
      '食事処には、長い一枚板のテーブルが中央を一本まっすぐに通っている。',
      '定番のサ飯から、つまみ、スイーツまで何でも揃う。名物はチゲ鍋。もちろんビールもある。',
      '——外に出る理由が、ひとつも無い。',
    ]],
    ['y_tenku_rest', [
      '休憩スペースは、足を伸ばしてそのまま目を閉じられる造り。',
      'ただ、アウフグースが終わる時刻になると、扉から六十人が一斉に出てくる。',
      '椅子は全部埋まっていた。壁ぎわに、体を冷ましながら立っている人が並んでいる。',
      '空いた椅子に、すぐ次の人が沈んだ。',
      '——これで一日二千六百円。最大十四時間。',
      'うちは、何で戦えばいいんだ。',
    ]],
    ['y_tenku_capsule', [
      'そして、疲れたらそのまま泊まれる。平日なら一泊五千円ほど。',
      '眠って、翌朝もう一度風呂に入る。チェックアウトはなんと十二時。',
      '——強い。強すぎる。',
    ]],
  ],

  rakuen: [
    ['y_rakuen_bath', [
      'ととのいの森。市の外れ、雑木林をまるごと抱き込んで建つ大箱だ。',
      '湯は黄金色の天然温泉。浸かったまま顔を上げると、窓いっぱいに緑が広がる。',
      '木を眺めながら、風に当たる。ここでは、何も考えなくていい。',
      '——この広さで外気浴までできるのは、ずるい。',
    ]],
    ['y_rakuen_sauna', [
      'サウナはタイル張りの四角い部屋。オートロウリュが入る。',
      '熱がゆっくり体を回りはじめ、その直後に汗が一気に噴き出してくる。',
      '奇をてらわない、まっすぐな熱だ。',
      '——蒸されることだけを考えていられる。',
    ]],
    ['y_rakuen_meshi', [
      'レストランが二つある。定番サ飯。サラダボウルにスイーツ。キッズメニュー。',
      'アニメやゲームと組んだ限定メニューまで用意されている。',
      '家族も、カップルも、サウナ客も、全部ここで満足させるつもりらしい。',
      '——付け入る隙が、ない。',
    ]],
    ['y_rakuen_beads', [
      '上の階は、広い休憩スペース。そこら中にビーズクッションが転がっている。',
      '好きな場所に沈んで、好きな格好で休める。',
      '奥の窓の向こうには、林。',
      '——うちの窓から見えるのは、雑居ビルの壁だけだ。',
    ]],
    ['y_rakuen_rest', [
      '反対側の壁は、一面が漫画で埋まっている。一万冊。',
      'しかも、漫画を持ち込める個室まである。',
      '若いカップルが、隣り合って一冊ずつ読んでいた。楽しそうだった。',
      '——俺には、そんな青春はなかった。',
    ]],
    ['y_rakuen_terrace', [
      '屋上にも出られる。寝椅子に体を預けると、林を抜けてきた風が吹き抜けていく。',
      '一日ぶんの疲れが、そのまま風に溶ける。',
      '下の広場から、子どもの声が上がってきた。',
      '——これで一日千五百円。最大十三時間。',
      '大箱の資本力というやつに、俺は打ちのめされた。',
    ]],
  ],

  hama: [
    ['y_hama_bath', [
      '茶煙楼。旧貿易地区のど真ん中、築百十年の貿易商館をそのまま使っている。',
      '煉瓦の壁と剥き出しの配管。その下で、音楽が低く鳴っている。',
      'ここは造りで殴ってくる店だ。入った瞬間に、気分が上がる。',
      '水風呂は漢方の色。同じ通りの老舗薬局と組んでつくった、ここだけのものだ。',
      '——うちの水風呂は、ただの水だ。',
    ]],
    ['y_hama_sauna', [
      '部屋の中央に、日本で初めて導入されたという水車式のサウナストーブが鎮座している。',
      '観覧車のような水車が回り、くみ上げた水をサウナストーンへ落としていく。',
      '三十分ごとに蒸気が広がり、部屋の熱がゆっくりと濃くなる。',
      '見ているだけで、わくわくする。',
      '——ここには、ひと目で覚える仕掛けがある。',
      'うちにあるのは、よそにもあるものばかりだ。',
    ]],
    ['y_hama_rest', [
      '休憩はフランスの老舗アウトドアブランドの椅子。頭上に送風装置がある。',
      '体を預けて目を閉じると、狙ったようにちょうどいい風が落ちてくる。',
      '——ここのととのいは、ととのい市で一番かもしれない。',
    ]],
    ['y_hama_capsule', [
      '同じ建物の中には宿まである。豪華な寝台列車を思わせるカプセルだ。',
      '眠るだけでも旅をしている気分になれる。',
      'ラウンジの窓際には長いベンチが続き、色とりどりのクッションが無造作に並ぶ。',
      '——センスで勝負しても、この店には勝てない。',
    ]],
  ],

  lumina: [
    ['y_lumina_bath', [
      '月白 SPA TERRACE。外気ベイの高層階にある、天然温泉だ。',
      '扉の向こうでは、琥珀色の湯が静かに揺れている。',
      '源泉かけ流し、ジェットバス、水風呂。どれから入るか、毎回迷う。',
      '街の真ん中にいるはずなのに、ここだけ時間の流れが違う。',
      '——駅の近くに、ここまで揃っている。それだけで、もう強い。',
    ]],
    ['y_lumina_sauna', [
      'サウナは六段の大型。座る段によって、熱さがまるで違う。',
      'アロマの蒸気が広がると、汗がゆっくりと浮いてくる。',
      '初めての人が、いちばん上の段で平気な顔をして座っていた。',
      '——ここは、こういう熱でいいんだ。',
    ]],
    ['y_lumina_roten', [
      '露天へ出れば、火照った体を風が撫でていく。',
      '湯に浸かって空を見上げていると、ととのい市の真ん中にいることさえ忘れる。',
      '——もう一サイクル、やっちゃおうか。',
    ]],
    ['y_lumina_meshi', [
      'レストランとカフェがある。湯上がりの体が求めるのは、温かくて腹にたまる飯だ。',
      '御膳にするか、麺にするか、カツカレーか。選んでいる時間まで楽しい。',
      '冷たい一杯を流し込んだ瞬間、今日の疲れが全部報われた気がする。',
      '——風呂上がりの客を、腹まで満たして帰すつもりらしい。',
    ]],
    ['y_lumina_sauna_im', [
      'そしてここには、巨大なスクリーンのある部屋がある。',
      '映像とアロマと熱風に包まれているうちに、自分がどこにいるのかも分からなくなる。',
      'これは、ただのサウナじゃない。',
      '——全身で浴びる、ひとつの物語だ。',
    ]],
    ['y_lumina_rest', [
      '休憩は大きなソファ。体を預けた瞬間、全身から力が抜ける。',
      '眠るのも、本を読むのも、何も考えずに過ごすのも自由だ。慌てて帰る必要はない。',
      '——客が帰らない理由まで、ちゃんと用意されている。',
    ]],
  ],

  fukurai: [
    ['y_fukurai_1f', [
      '松乃湯。松乃町商店街の奥にある、昔ながらの銭湯だ。',
      '電気、ジャグジー、ラドン。攻略したくなる湯がずらりと並ぶ。',
      'ひとつずつ巡っているうちに、日々の疲れが体の奥からほどけていく。',
      '——この多彩さが、中年の俺には妙に落ち着く。',
    ]],
    ['y_fukurai_sauna', [
      'サウナは一室だけ。百八度、詰めて八人。扉を開けた瞬間に熱が顔を殴ってくる。',
      'たっぷり汗を流したら、名水の水風呂で一気に体を冷ます。',
      '——この水のために、わざわざ来る人がいるのが分かる。',
    ]],
    ['y_fukurai_2f', [
      'これだけ揃って、サウナ込み八百五十円。',
      '休憩用の椅子は、脱衣所の隅に二脚だけ置いてあった。',
      '——このコスパと六十八年の歴史に、俺はどう立ち向かう。',
    ]],
  ],
};


/* ============================================================
   他店へ行く日の中身（作者決定 8/2）
   ------------------------------------------------------------
   **どの店へ行くかで、値段も、抜けるストレスも、戻る体力も変わる。**
   高い店ほどよく抜けるが、毎週は行けない。安い店は日常使いになる。
     cost   … その日かかる金
     stress … 抜けるストレス（マイナス）
     stam   … 戻る体力
     mood   … 妻の機嫌（黙って一人で行くので、どこも少し下がる）
   ============================================================ */
/* ============ ライバル店＝**ストレスの専門**（作者決定 8/8・配分し直し）============
   以前は 月白 SPA TERRACEが ¥5,800 で **ストレス−75・体力+55**＝1回でほぼ全快しており、
   ¥12,000 払う「ロウリュ街で飲む」（−45）が完全に食われていた。
   いまは **抜けは −30〜−45 に圧縮し、体力の戻りは +15 前後で横並び**。
   店ごとの個性は「値段」と「土日に混むか」と「何が見えるか」で出す。
   いちばん深く抜きたい夜はロウリュ街（−50）へ行く、という住み分けにした            */
const RIVAL_VISIT_Y = {
  // 全部が高水準。**ただし土日は混みすぎて、ととのえない**（常連の言うとおり）
  tenku:   { cost: 2600, stress: -40, stam: 15, mood: -3,
             crowd: [0, 0, 0, 0, 0, 0.45, 0.45] },   // 月〜日。土日は効きが55%落ちる
  // 安い・長くいられる＝**体力がいちばん戻る**。ただしサウナは弱い
  rakuen:  { cost: 1500, stress: -30, stam: 25, mood: -3 },
  // **二時間しかいられない**＝体は休まらないが、ととのいはととのい市一
  hama:    { cost: 2500, stress: -42, stam: 8,  mood: -3 },
  // いちばん高く、いちばん抜ける。**妻の機嫌だけは下がらない**（連れて行ける店だから）
  lumina:  { cost: 5800, stress: -45, stam: 18, mood: 0 },
  // 日常使い。安いぶん抜けは浅いが、**毎週でも行ける**
  fukurai: { cost: 850,  stress: -30, stam: 15, mood: -2 },
};

/* その日その店へ行ったときの実効値（土日の混雑をここで効かせる） */
function yVisitVal(id) {
  const v = RIVAL_VISIT_Y[id];
  if (!v) return { cost: 3000, stress: -40, stam: 50, mood: -2, crowded: false };
  const c = v.crowd ? (v.crowd[dayOfWeek()] || 0) : 0;
  return { cost: v.cost, stam: v.stam, mood: v.mood,
           stress: Math.round(v.stress * (1 - c)), crowded: c > 0 };
}

/* ============================================================
   客との立ち話（作者決定 8/2）
   ------------------------------------------------------------
   **弱点は主人公に言わせない。その店の客に言わせる。**
   自分で見て回るだけだと、どうしても「見た目の判断」になる。
   一日いる客のほうが、その店の何が足りないかを知っている。

   館内を一巡りしたあと、最後に一人だけ声をかけられる。
   good / bad は、話を聞いたあとに店選びの画面へ残るひとこと
   ============================================================ */
const RIVAL_TALK_Y = {
  tenku: {
    art: 'y_tenku_rest', who: '常連らしい男',
    talks: [
      { good: '全部が高い水準', bad: '水風呂が一つ。土日は混みすぎる',
        intro: '上がりぎわに、一人だけ声をかけてみた。',
        lines: [
          '兄さん、初めて？',
          'ここはね、全部いいの。全部だよ。文句のつけようがない。',
          'ただね、水風呂が一つしかないんだ。',
          'アウフグースのあと、あの部屋の全員が一斉に来るでしょう。あれが並ぶ。',
          '土日なんて、混みすぎて全然くつろげない。',
          '聖地なんて呼ばれちゃったから、こうなるんだよな。',
        ] },
      { good: '王者の貫禄', bad: '水風呂が一つ。土日は混みすぎる',
        intro: '前に話した男が、同じ席にいた。',
        lines: [
          'また来たの。好きだねえ。',
          '……あんた、この辺で店やってる人だろ。',
          '客の見方が違うもの。俺たちは湯を見るけど、あんたは人を見てる。',
          '言っとくけどね、ここに勝とうと思わないほうがいい。',
          'ここは、勝つ店じゃないんだ。基準になっちゃった店だから。',
        ] },
      { good: '王者の貫禄', bad: '水風呂が一つ。期待値が高すぎる',
        intro: '男は今日、水を飲みながら座っていた。',
        lines: [
          'この店にも困ってることはあるよ。',
          'ここまで来ると、もう「普通にいい日」が作れないの。',
          '客が全員、期待値を上げきって来るからね。',
          'その点、あんたの店はいいよ。',
          'まだ何にもなってないから、何にでもなれる。',
        ] },
    ],
  },
  rakuen: {
    art: 'y_rakuen_beads', who: '漫画を抱えた男',
    talks: [
      { good: 'コスパ。一日いられる', bad: '休日は子どもの声で、静かではない',
        intro: '上がりぎわに、一人だけ声をかけてみた。',
        lines: [
          '安いでしょう、ここ。一日いても。',
          '風呂入って、漫画読んで、飯食って、また風呂入って。それで終わる日があってもいいじゃない。',
          'ただ、休みの日はうるさいよ。子どもが走り回ってるから。',
          '静かにととのいたい人には、たぶん向いてない。',
          '悪い意味じゃなくてさ。ここ、サウナの店じゃないんだよ。',
        ] },
      { good: '子ども連れの逃げ場', bad: '休日は子どもの声で、静かではない',
        intro: '同じ男が、同じクッションに沈んでいた。',
        lines: [
          'お、また会ったね。',
          'こないだ言ったこと、悪く聞こえたかな。',
          '俺、ここ好きなんだよ。子どもがいる家はさ、ここしか行き場がないの。',
          '静けさが無いんじゃない。静けさを一番にしてないだけ。',
          '一番にしてる店は、この街に無いけどね。',
        ] },
      { good: '夫婦で行ける', bad: '休日は子どもの声で、静かではない',
        intro: '男は今日、漫画を持っていなかった。',
        lines: [
          '今日は女房と来たんだ。あっちは女湯。',
          'こういう店じゃないと、二人で来られないんだよ。',
          '夫婦で行ける風呂屋って、意外とないの。',
          '……あんたの店、そこ考えてる？',
        ] },
    ],
  },
  lumina: {
    art: 'y_lumina_cafe', who: '連れを待っている男',
    talks: [
      { good: '清潔。湯の種類が多い', bad: 'サウナがぬるい。高い',
        intro: '上がりぎわに、一人だけ声をかけてみた。',
        lines: [
          '彼女と来るなら、ここが一番だよ。',
          'きれいだし、湯の種類も多い。連れに文句を言われたことがない。',
          'ただ、サウナはぬるいよ。俺には物足りない日もある。',
          'そして、高い。五千八百円。毎週は来られないよ。',
          'ここは、自分を甘やかす日専用だ。',
        ] },
      { good: '女性に喜ばれる仕組み', bad: 'サウナがぬるい。高い',
        intro: '前と同じ席に、同じ男がいた。',
        lines: [
          '今日も待ってるんだ。長いんだよ、女は。',
          'でもさ、待ってる時間が苦じゃないの。ここは。',
          'ソファがあって、コーヒーがあって、本が読める。',
          '待たせる側じゃなく、待つ側のことまで考えてある。',
          'そういう店、そうないよ。',
        ] },
      { good: '女性に喜ばれる仕組み', bad: '高い。日常には使えない',
        intro: '男が、コーヒーを二つ頼んでいた。',
        lines: [
          'こないだ「高い」って言ったろ。あれ、半分は照れ隠しだ。',
          '月に一回ここに来る日を作ってから、うちは喧嘩が減った。',
          '金の話じゃないんだよ。',
          '連れが機嫌よく帰る店ってのは、それだけで価値がある。',
          '……あんたの店は、女の人が来るかい？',
        ] },
    ],
  },
  hama: {
    art: 'y_hama_rest', who: '寝椅子から起きた男',
    talks: [
      { good: '空間も設備もいい', bad: '二時間二千五百円。観光客と、墨',
        intro: '上がりぎわに、一人だけ声をかけてみた。',
        lines: [
          'ここ、居心地がいいでしょう。',
          '空間も設備もいい。',
          '俺はここでなら寝られる。',
          'でもね、二時間で二千五百円。',
          'ととのい市でこの値段はちょっとね。都心じゃないんだから。',
          '観光の人が多いから、うるさい日もある。',
          '墨の入った人も来る。まあ、ここは誰も気にしないけどね。',
        ] },
      { good: '二時間だから濃い', bad: '二時間二千五百円。観光客と、墨',
        intro: '同じ男が、同じ椅子で目を開けた。',
        lines: [
          'また会ったね。ここ、そういう店なんだよ。',
          '定員二十四人、二時間の入れ替え制。だからみんな全力なの。',
          '長くいられる店は、どうしてもだらける。ここにはそれがない。',
          '高いって言ったけどさ。二時間で二千五百円を、高いと思うか、濃いと思うか。',
          '俺はだんだん、濃いほうだと思うようになってきた。',
        ] },
      { good: '二時間だから濃い', bad: '客が地元じゃない',
        intro: '男は、帰り支度をしながら話した。',
        lines: [
          'ここね、外から来た客のほうが多いの。',
          'ととのい市の人間は、こういう店に金を出さない。もったいないけどね。',
          '……あんた、地元の店？',
          'なら、逆をやればいい。地元しか来ない店。',
          'それはそれで、強いよ。',
        ] },
    ],
  },
  fukurai: {
    art: 'y_fukurai_1f', who: '番台の前にいた爺さん',
    talks: [
      { good: '安い。名水の水風呂。町の銭湯', bad: '建物が古い。休む場所が無い',
        intro: '上がりぎわに、一人だけ声をかけてみた。',
        lines: [
          '兄ちゃん、初めてか。',
          'この銭湯、なかなかいいだろう？',
          '風呂もサウナも、こういうので良いんだよ。',
          '建物は古いし、上がったあとに座る場所も無いがな。',
          'でも、それが町の銭湯だろう？',
          '昔からだ。誰も何も言わん。',
          '春江さんがいた頃から、あの親父は愛想ねえんだ。',
          'わしは二十年以上通っとる。',
        ] },
      { good: '六十八年ぶんの常連', bad: '建物が古い。休む場所が無い',
        intro: '爺さんは、今日も番台の前にいた。',
        lines: [
          '兄ちゃん、また来たな。',
          '……自分の店？ どこだい。',
          'ああ、あそこか。',
          '続けなよ。この街、風呂屋が減りすぎた。',
          'わしが若い頃は、この商店街だけで三軒あったんだ。',
          '今は、ここと、あんたのとこだけだよ。',
        ] },
      { good: '六十八年ぶんの常連', bad: '安すぎて、体で払っている',
        intro: '爺さんは、俺の顔を見るなり笑った。',
        lines: [
          '兄ちゃん、うちの真似はするなよ。',
          '安いのは、わしらが年寄りだからだ。',
          '若いあんたが安売りしたら、体のほうが先に潰れる。',
          '高くていい。その代わり、来た客を一人も粗末にするな。',
          'それだけ守れば、風呂屋は潰れん。',
        ] },
    ],
  },
};

/* 五軒すべてで話を聞き終えた夜。大会は冒頭から既知＝ここは「敵の全貌が揃った」の節目 */
const FIVE_DONE_Y = [
  '五軒、全部見た。',
  'SAUNA GATE 37には、王者の貫禄がある。',
  'ととのいの森には、街いちばんの広さがある。',
  '茶煙楼には、ひと目で覚えるセンスがある。',
  '月白 SPA TERRACEには、女性に喜ばれる仕組みがある。',
  '松乃湯には、六十八年ぶんの常連がいる。',
  '帰り道、うちのビルの前で足が止まった。',
  '灯りがひとつも点いていない。',
  '——うちには、何がある。',
];

/* ============ 五名館オーナーの視察台詞（S級凍結・docs/SHISATSU_LINES.md）============
   OWNER_LINES_ON_Y ＝ 地名置換の完了と同時に true（2026-08-09）。
     旧店名のままオーナーだけ出すと世界が混ざるので、この順番は動かさない。
   段階は G.day と予選の進行から導く＝日数は戻らないので、**関係が後退しない**
   （S維持の唯一の注意「発火順序を壊さない」を構造で守る）。
   台詞内の「＊」始まりは地の文（ト書き）。関数エントリは実数を差し込んで返す（null=不発） */
const OWNER_LINES_ON_Y = true;

const OWNER_LINES_Y = {
  tenku: { who: '神代',
    first: ['初めまして——ではありませんね', '四年前の三月', '納品は二日遅れました',
            'いい店ですね。ただ、小さい店が美しいのは、経営が苦しくなるまでです'],
    value: [
      ['番付は見ています。伸び方に、癖がありますね。——設備屋の買い方だ'],
      ['この導線は短くしました。客が速く動くためではなく、迷わないためです'],
      (o) => {   // 清潔の前回比。前回の視察時より上がっていれば言う
        const c = (typeof yMyScore === 'function') ? (yMyScore().clean || 0) : 0;
        const d = o.lastClean != null ? c - o.lastClean : 0; o.lastClean = c;
        return d > 0 ? ['清潔評価、前回比' + d + 'ポイント上昇。改善されていますね'] : null;
      },
    ],
    qual: [
      ['改装は事実です。公開情報はそこまで。——続きは当日ご覧ください'],
      ['予選の点は見ました。感想は、大会が終わってから'],
      ['森園さんが、あなたたちの話ばかりします。数字より先に名前が挙がる店は、久しぶりです'],
    ],
    late: [
      () => { const me = yRanking().find(r => r.mine);
              return ['番付' + (me ? me.rank : 6) + '位。……あの納品書に、この未来はありませんでした']; },
      ['審査員三人の経歴は確認しました。公平です。——うちにも、お二人にも'],
      ['妻の方に伝えてください。二人での決裁は、最も時間がかかる方式です。そして、壊れにくい'],
      ['今日は数字の話がありません。それが一番いい報告です'],
    ],
    state: [
      { key: 'pass', cond: () => { const rows = yRanking(); const me = rows.find(x => x.mine);
          return me && me.rank === 1; },
        lines: ['結果は事実です。事実は、尊重します'] },   // 初めて番付でGATE37を抜いた日
      { key: 'broke', cond: () => (G.equip || []).some(e => e.cond <= 0 && !e.dead),
        lines: ['故障は修理費だけの問題ではありません。信用も、同時に減価します'] },
    ],
    streak: ['三週連続ですね。そろそろ“視察”という説明が、苦しくなってきました'],
    win: null, lose: null,   // 神代の担当は最終戦のみ＝予選勝敗では発火しない
  },

  fukurai: { who: '鉄治',
    first: ['サウナ屋じゃねえ。風呂屋だ。そこを間違える店は長くねえ', '三年続けてから風呂屋を名乗れ'],
    value: [
      ['＊鉄治は返事の前に、レンチで配管を一度叩いた', '……排水の音、変わったな'],
      ['床、ちゃんと乾いてるな。……別に褒めてねえぞ'],
      ['うちの客が一人、あんたらの店に行った。今日も行くってよ。それだけだ'],
      ['＊排水溝を外しながら', '見えねえ場所だから毎朝洗うんだ。見える頃じゃ遅え'],
    ],
    qual: [
      ['勝った負けたは大会の話だ。風呂は毎日の話だ'],
    ],
    yokoku: ['明日から七日だ。掃除くらい、今からやっとけ'],      // 第1予選が始まる週の前
    taikou: ['薬湯？　余ってたから入れただけだ'],
    late: [
      ['＊コン。コン。', '……近いうちに、二階の配管が鳴く。直しとけ'],
      () => ((G.regulars || 0) >= 20 ? ['常連が' + G.regulars + '人か。増えたな。増えたぶん、雑に扱うなよ'] : null),
      ['夫婦で店をやるなら、一人で抱えるな。俺みてえになる'],
      ['＊コン。', '今日は問題ねえ'],
    ],
    state: [
      { key: 'night', cond: () => G.ch2 && G.ch2.night >= 1,
        lines: ['夜通し開けるのか。……体は、二人で一つじゃねえぞ'] },
    ],
    streak: ['三週目だぞ。自分の風呂も見ろ'],
    win: ['負けた顔してんな。明日も店は開くだろ'],
    lose: ['勝ったのは昨日だ。今日は今日の湯を見ろ'],
  },

  rakuen: { who: '美和子',
    first: ['あなたたちの店ね、悪くないと思——',
            '＊インカムが鳴る', '五番テーブル、配膳が二分止まってる。厨房から一人。廊下は走らない',
            '——ごめんね、続けて？'],
    value: [
      ['客は増えたね。でも受付に一人足りない。土曜の十九時、見てきたから'],
      ['三番、補充お願い。——で、今日は何を見に来たの？'],
      ['＊床の靴下を拾いながら', 'はい、落とし物。子どもの靴下、今日二足目'],
      ['＊キッズスペースを指して', 'ここ、食堂から見えるでしょ。親が座ったまま見守れるようにしてるの'],
    ],
    qual: [
      ['ごめんね。仲良くすることと、商売で譲ることは別なの'],
      ['混雑で店が壊れるかどうかはね、いちばん忙しい日じゃなくて、その翌日に分かるの'],
    ],
    taikou: ['ペア回数券、うちも始めたわよ。真似じゃなくて、商売'],
    late: [
      ['＊インカムが鳴る。手で止めて', '——今は、あなたたちの話が先'],
      ['休みってね、空いた日に取るものじゃないの。先に空けるの。……覚えるの、ちょっと遅かったけどね'],
      ['あなたたちは百人を集めない。その代わり、一人を百回呼ぶのね'],
      ['今日は視察？　息抜き？　……どっちでもいいけど、お茶くらい飲んでって'],
    ],
    state: [
      { key: 'staff0', cond: () => !(G.staff || []).length,
        lines: ['二人だけで回してるの？　……それ、いつまで持つか、私は知ってるわよ'] },
    ],
    streak: ['また来たの？　そろそろスタッフに制服渡されるわよ'],
    win: ['うちが勝ったのは場数よ。悔しがっていいけど、落ち込むのは違う'],
    lose: ['やるじゃない。今度は、客として見に行くから'],
  },

  hama: { who: '玲華',
    first: ['＊玲華は納入業者の茶葉を検品していた。茶缶を開ける',
            '香りはあります。理由がありません',
            '＊スタッフが茶缶を下げる。玲華が振り返る', '……お二方が、あの新しい店の'],
    value: [
      ['悪くはありません。お二方の店である必要も、ありませんが'],
      ['＊茶を一杯、出してくれた', 'この茶だけは、市外から仕入れません。この建物で使う理由が、なくなるので'],
    ],
    qual: [
      ['個性とは、増やすことではありません。減らしても残るもののことです'],
      ['この香り、流行のサイトの三ページ目に載っていたものですね'],
    ],
    taikou: ['新作を出します。予約は埋まりました。……勝負の前に、勝敗以外の話を済ませておきたくて'],
    late: [
      ['今の香りは、残してください'],
      ['……これは、どなたの思い出ですか'],
      ['設備は真似できる。物語は真似できない'],
      ['今日は、茶だけにしましょう'],
    ],
    state: [
      { key: 'dup', cond: () => { const n = {}; let mx = 0;
          for (const e of (G.equip || [])) { n[e.id] = (n[e.id] || 0) + 1; if (n[e.id] > mx) mx = n[e.id]; }
          return mx >= 4; },
        lines: ['同じものを並べて増やすのは、台数だけですよ'] },
    ],
    streak: ['＊茶缶を差し出す', '……常連の淹れ方に、しますか'],
    win: ['削っても残ったもの。その差でしょう'],
    lose: ['＊茶缶を開ける。閉じる', '……理由の、ある店でした'],
  },

  lumina: { who: '澪',
    first: ['＊澪はスタッフの持ち場を見て回っていた',
            'きれいにしていらっしゃいますね。奥から六番目の棚、その裏側を除けば',
            '＊スタッフが青ざめる。澪が振り返る', '失礼いたしました。お二人さまですね'],
    value: [
      ['＊歩きながら、突然止まる', 'ここで、お客さまの視線が一度止まります', '＊二歩戻る', 'ですから案内板は、この位置です'],
      ['＊タオルを一枚、わざと落とす。拾って渡すと', 'ありがとうございます。——お客さまは、拾いません'],
      ['鏡は出口へ正対させません。帰る方の流れを、止めるからです'],
    ],
    qual: [
      ['高級に見せるのは簡単です。高い料金を払ったことを忘れさせるのが難しいのです'],
      ['お店を続けるために、お二人の関係を消耗品にしてはいけません'],
    ],
    taikou: ['ムーンライトプラン、始めます。夜の九十分だけ。……価格の話ではありません。時間の話です'],
    late: [
      ['＊ソファに座る。三秒。立って直す。また座る', '休んでおります'],
      ['一緒に来た方が、別々の満足だけ持って帰るのは、少し寂しいでしょう？'],
      ['＊棚を見る。触らない', '本日は、見るだけにいたします'],
    ],
    state: [
      { key: 'sink', cond: () => !(G.equip || []).some(e => /sink|powder|dresser/.test(e.id || '')),
        lines: ['湯上がりの三十分まで、が入浴です。鏡の前が、勝負ですよ'] },
    ],
    streak: ['三週続けてのご来館。——会員のご案内、お持ちしましょうか'],
    win: ['良い勝負でした。——差は、細部です'],
    lose: ['お客さまの選んだ結果です。私が言い足すことは、ありません'],
  },
};

/* 段階＝日数と予選の進行から。日数は戻らない＝関係も戻らない */
function yOwnerStage() {
  const b = (typeof yBattleState === 'function') ? yBattleState() : null;
  if ((b && b.qual.length >= 4) || G.day >= 92) return 3;   // 終盤
  if (G.day >= 25) return 2;                                 // 予選期
  return 1;                                                  // 値踏み
}

/* その視察で出すオーナーの台詞ひとかたまりを選ぶ。
   優先順＝初回 → 予選結果直後 → 予告・対抗策 → 連続訪問 → 状態対応 → 段階プール */
function yOwnerLine(r) {
  const def = OWNER_LINES_Y[r.id]; if (!def || !G.ch2) return null;
  const c = G.ch2;
  const st = c.owner || (c.owner = {});
  const o = st[r.id] || (st[r.id] = { bagStage: 0, bag: [], seen: {} });
  const vis = (c.visited || {})[r.id] || 1;
  if (vis <= 1) return { who: def.who, lines: def.first };

  const b = (typeof yBattleState === 'function') ? yBattleState() : null;
  const q = (typeof YOSEN_Y !== 'undefined') ? YOSEN_Y.find(x => x.rival === r.id) : null;
  // 予選結果直後（1回だけ。主語は PLAYER_WIN / RIVAL_WIN で固定）
  if (q && b && !o.seen.qualResult) {
    const res = b.qual.find(x => x.no === q.no);
    if (res) {
      o.seen.qualResult = true;
      const PLAYER_WIN = res.pt >= 4;
      const l = PLAYER_WIN ? def.lose : def.win;
      if (l) return { who: def.who, lines: l };
    }
  }
  // 予告（開始前の週）と対抗策（期間中）。各1回
  if (q && def.yokoku && !o.seen.yokoku && G.day >= q.from - 7 && G.day < q.from) {
    o.seen.yokoku = true; return { who: def.who, lines: def.yokoku };
  }
  if (q && def.taikou && !o.seen.taikou && G.day >= q.from && G.day <= q.to) {
    o.seen.taikou = true; return { who: def.who, lines: def.taikou };
  }
  // 連続訪問（3週連続・1回だけ）
  if (c.visitStreak && c.visitStreak.id === r.id && c.visitStreak.n >= 3 && !o.seen.streak) {
    o.seen.streak = true; return { who: def.who, lines: def.streak };
  }
  // 状態対応（各1回）
  for (const sdef of (def.state || [])) {
    if (!o.seen['st_' + sdef.key] && sdef.cond()) {
      o.seen['st_' + sdef.key] = true; return { who: def.who, lines: sdef.lines };
    }
  }
  // 段階プール（シャッフルバッグ＝一周するまで同じ台詞を出さない）
  const stage = yOwnerStage();
  const pool = stage >= 3 ? def.late : stage === 2 ? def.qual : def.value;
  if (o.bagStage !== stage || !o.bag.length) {
    o.bagStage = stage;
    o.bag = pool.map((_, i) => i).sort(() => Math.random() - 0.5);
  }
  while (o.bag.length) {
    const e = pool[o.bag.shift()];
    const lines = (typeof e === 'function') ? e(o) : e;
    if (lines) return { who: def.who, lines };
  }
  return null;   // このバッグは空振り＝今日はオーナーに会えなかった、でいい
}

/* [絵のキー, 地の文の配列] の並び → Story の scenes へ。
   最後に、その店の客との立ち話をくっつける */
function yRivalScenes(r) {
  const scenes = RIVAL_SCENE_Y[r.id];
  if (!scenes) return [];
  const talk = RIVAL_TALK_Y[r.id];
  const keys = scenes.map(s => s[0]).concat(talk ? [talk.art] : []);
  // その店の絵だけ先に読み込む（場面が始まった瞬間に黒くならないように）
  if (typeof storyImgPreload === 'function') storyImgPreload(keys);
  const out = scenes.map(([art, lines]) => ({ art, lines: lines.map(text => ({ narr: true, text })) }));
  /* 五名館オーナーの一言（地名置換までフラグで封印）。「＊」始まりはト書き */
  if (OWNER_LINES_ON_Y && typeof yOwnerLine === 'function') {
    const ol = yOwnerLine(r);
    if (ol) out.push({ art: (scenes[0] || [])[0], lines: ol.lines.map(tx =>
      tx.charAt(0) === '＊' ? { narr: true, text: tx.slice(1) } : { sp: ol.who, text: tx }) });
  }
  if (talk) {
    /* **二度目からは、前に話したのと同じ客から違う話を聞ける。**
       yVisitRival が先に visited を足しているので、1回目＝1。用意した数で頭打ち */
    const c = G.ch2 || {};
    const n = ((c.visited || {})[r.id] || 1);
    const t = talk.talks[Math.min(n, talk.talks.length) - 1];
    if (G.ch2) { if (!c.talked) c.talked = {}; c.talked[r.id] = t; }
    out.push({ art: talk.art, lines:
      [{ narr: true, text: t.intro }]
        .concat(t.lines.map(text => ({ sp: talk.who, text }))) });

    /* 五軒すべてで話を聞いた夜（一度きり）。番付の伏せ字が全部埋まった節目 */
    if (G.ch2 && !c.fiveDone && RIVALS_Y.every(x => c.talked[x.id])) {
      c.fiveDone = true;
      c.battleKnown = true;                       // （いまは初めから true。念のため残す）
      out.push({ art: 'y_five_town', lines: FIVE_DONE_Y.map(text => ({ narr: true, text })) });
      log('🏆 五軒すべてを見た。ととのい番付の数字が、全部埋まった');
    }
  }
  return out;
}
/* 結末を出して、その日を閉じる。
   **押せばそのまま出勤**（作者決定 8/6）。
   ここで「それでも出勤しますか？」をもう一枚挟んでいたが、
   寄り道を選んだ時点でその日の使い道は決まっている＝**同じことを二度訊いていた。**
   朝の画面は1枚で終える＝「今日、自分をどう使うか」を選んだら、そのまま店に立つ */
/* ============ ロウリュ街で人に出会う（隠れイベント・作者指定 2026-08-06）============
   「自分の店で働きたい人と、たまに出会う」。**3回飲みに行ったら1人**くらい。
   面接まで待たせない＝その場で決める。求人広告（¥◯万）を出さずに1人採れる夜、
   ということでもある＝**¥12,000の飲み代が、たまに求人費に化ける**。

   ⚠ 既に雇っている人・一度断った人は出てこない。街の人材は有限なので、
     出せる顔が尽きたら、ただ飲んで帰るだけの夜になる（それでいい）      */
/* ============ 焼き場の男（源さんに至る六つの夜）============
   §11-23 の三幕は**電話が来る前の下地**。ここで顔と名前と過去を渡しておく。
   6回目で「あんたんとこで腕を振る」と言い出す＝そのあと店で電話が鳴る。
   回数（`G.ch2.jinmyaku`）の何回目かで、1つだけ出す。7回目以降は何も出さない */
const NOGE_GEN_Y = {
  1: '焼き台の向こうに、白髪の男が立っていた。<br>'
   + '注文を通しても返事はしない。皿だけが、黙って出てくる。',
  2: '「あんた、サウナやってるんだって？」<br>'
   + '手を止めずに、男が言った。こちらの顔は見ない。<br>'
   + '「熱波銀座のほう、な。……ふうん」',
  3: '常連が笑って教えてくれた。<br>'
   + '「<b>源さん</b>だよ。この先で、二十六年やってた人」<br>'
   + '当の本人は、聞こえていない振りをしていた。',
  4: '「潰したのは俺だよ」<br>'
   + '聞いてもいないのに、そう言った。<br>'
   + '「味じゃなくて、勘定のほうでな。……もう鍋は持たない。ここは焼くだけだから」',
  5: '「あんた、いつも一人で飲んでるな」<br>'
   + 'そう言って、頼んでいない小鉢が出てきた。<br>'
   + '<span class="opt-sub">——勘定には、載っていなかった</span>',
  6: '「<b>杉本 源治</b>」<br>'
   + '名刺は無い、と言って、伝票の裏に書いてよこした。<br>'
   + '「あんた、五階を食堂にするんだってな」<br>'
   + '<b>「——作るんなら、俺が腕を振るぜ」</b>',
};
function yNogeGenText() {
  if (typeof yGen === 'function' && yGen() >= 3) return '';   // もう厨房に立っている
  return NOGE_GEN_Y[(G.ch2 && G.ch2.jinmyaku) | 0] || '';
}

const NOGE_SCOUT_RATE = 1 / 3;
function yNogeScout() {
  if (Math.random() >= NOGE_SCOUT_RATE) return null;
  if (G.roster.length >= CONF.maxStaff) return null;          // 満員の日は声も掛からない
  const no = (G.ch2 && G.ch2.scoutNo) || [];
  const pool = (STAFF_POOL || []).filter(p =>
    !G.roster.some(e => e.pid === p.pid) && no.indexOf(p.pid) < 0);
  return pool.length ? pick(pool) : null;
}
/* 出会いの一幕。**誰と会ったかで入り方が変わる**（夜に強い人は夜の店で会う） */
function yNogeScoutText(p) {
  const line = p.night
    ? 'カウンターの端で、閉店まで居座っている' + (p.sex === 'f' ? '女' : '男') + 'がいた。'
    : '隣の席から、ふいに話しかけられた。';
  return line + '<br>'
    + '「熱波銀座のサウナ、あんたのとこか」<br>'
    + '<b>' + p.name + '</b>（' + (p.age || '？') + '）。' + p.desc + '。<br>'
    + '「……働き口、探してるんだけど」';
}
function yScoutHire(p) {
  const emp = { pid: p.pid, name: p.name, sex: p.sex, age: p.age, night: p.night,
    maji: p.maji, spd: p.spd, aiso: p.aiso, desc: p.desc,
    wage: staffWageOf(p), days: 0, skill: 30 + (p.maji + p.spd + p.aiso) * 2,
    sulk: false, raiseAsk: false, raiseAmt: 0, raiseNo: 0 };
  /* 持ち場はこちらで決める（面接画面のような選び直しはしない）。
     あとから【👥 バイト】でいくらでも動かせる */
  emp.f = chHook('staffAreaOf', emp);
  G.roster.push(emp);
  const post = staffAreaName(emp);
  log('🧑‍🔧 ' + p.name + 'をロウリュ街で採用した（日給' + yen(emp.wage) + (post ? '／' + post : '') + '）');
  toast('🧑‍🔧 ' + p.name + 'が仲間になった');
}
/* 【雇う／今日はやめておく】。**断った人は二度と出てこない**（`scoutNo`）＝
   その場の返事に重みが出る。求人広告のほうには相変わらず並ぶので、詰みはしない */
/* ============ 応募者の顔と経歴（作者指定 8/8）============
   これまでは★の並びと日給しか出ていなかった＝**誰を雇うのかが分からない。**
   顔（一枚絵があればその絵、無ければ絵文字）・歳・性別・深夜の可否・
   ひとこと・日給・立たせる先を、1枚のカードにまとめて出す。

   絵は assets/story/y_staff_<pid>.webp。無ければ絵文字に落ちる＝
   絵が届いていなくても画面は成立する（他の一枚絵と同じ作り）            */
function yScoutProfile(p) {
  const face = (typeof staffFace === 'function') ? staffFace(p) : '🧑‍🔧';
  const sex = p.sex === 'f' ? '♀ 女性' : '♂ 男性';
  const night = p.night ? '　🌙 深夜も入れる' : '';
  const src = (typeof STORY_IMG !== 'undefined' && STORY_IMG['y_staff_' + p.pid])
            || ('assets/story/y_staff_' + p.pid + '.webp');
  return '<div class="y-scout">'
    + '<div class="y-scout-img"><img src="' + src + '" alt="" '
    +   'onerror="this.style.display=\'none\';this.parentElement.classList.add(\'noimg\')">'
    +   '<span class="y-scout-face">' + face + '</span></div>'
    + '<div class="y-scout-txt">'
    +   '<b>' + p.name + '</b>'
    +   '<span class="y-scout-meta">' + (p.age ? p.age + '歳・' : '') + sex + night + '</span>'
    +   '<span class="y-scout-skill">' + (typeof skillLine === 'function' ? skillLine(p) : '') + '</span>'
    +   '<span class="y-scout-desc">' + (p.desc || '') + '</span>'
    +   '<span class="y-scout-wage">日給 ' + yen(staffWageOf(p)) + '</span>'
    + '</div></div>';
}
/* 雇ったあとは**バイト管理画面へ**（作者指定 8/8）＝
   どこに立ったのかを、その足で確かめられる。閉じれば元の画面に戻る */
function yAfterScoutHire() {
  if (typeof openStaffMgr === 'function') openStaffMgr();
}
function yRenderScoutPick(box, p, text) {
  document.getElementById('offdayTitle').textContent = '🧑‍🔧 雇いますか？';
  const prof = document.createElement('div');
  prof.innerHTML = yScoutProfile(p);
  box.appendChild(prof);
  const grid = document.createElement('div');
  grid.className = 'y-cmd-grid';
  const yes = document.createElement('button');
  yes.className = 'y-cmd go';
  yes.innerHTML = '<b>🍶 雇う</b><span class="y-cmd-cost">日給' + yen(staffWageOf(p)) + '</span>'
    + '<span class="y-cmd-sub">持ち場はこちらで決める。あとで動かせる</span>';
  yes.onclick = () => {
    yScoutHire(p);
    G.ch2.scoutPid = null;
    yShowResult(text + '<br><br><b>「……ありがとう。明日から入るわ」</b>');
    yAfterScoutHire();
  };
  const no = document.createElement('button');
  no.className = 'y-cmd';
  no.innerHTML = '<b>🚭 今日はやめておく</b>'
    + '<span class="y-cmd-sub">この人はもう、こちらから声を掛けられない</span>';
  no.onclick = () => {
    if (!G.ch2.scoutNo) G.ch2.scoutNo = [];
    G.ch2.scoutNo.push(p.pid);
    G.ch2.scoutPid = null;
    log('🍶 ロウリュ街で' + p.name + 'の話を聞いたが、雇わなかった');
    yShowResult(text + '<br><br>曖昧に笑って、勘定を頼んだ。<br>'
      + '<span class="opt-sub">——次に会っても、あの話はもう出ない</span>');
  };
  grid.appendChild(yes); grid.appendChild(no);
  box.appendChild(grid);
}

/* ============ 倒れた日の締め（作者報告 8/8 で追加）============
   倒れた日は**店を開けない。**だから【🏮 出勤する】を出してはいけない。
   結果を読んだら、そのまま日付を進めて明日の朝へ送る。

   ⚠ ここが無かったせいで、一度倒れると
     「今日は動けない → 寝る → 出勤する → また今日は動けない」で永久に回っていた。 */
/* ============ 月曜＝定休日の一枚（作者決定 8/8）============
   **強制イベントの置き場所。中身はまだ決まっていない。**
   いまは「今日は定休日」とだけ出して、翌朝へ送る。
   イベントを入れるときは、この関数の中で `yShowDownResult` の代わりに
   場面を組み立てて、最後に同じ【🌅 明日の朝へ】へ落とせばいい。
   ⚠ お出かけ（odekake_y.js）も講習も**コードは残してある。**呼び出しをここに繋ぐだけ */
function yShowMondayEvent() {
  /* 中身は monday_y.js（行き先は4つ。どれになるかは店の進み具合で変わる）。
     読み込まれていない環境では、これまでどおり「定休日」とだけ出す */
  if (typeof yMondayRun === 'function') { yMondayRun(); return; }
  yShowDownResult(
    '<b>' + WEEK_Y[yDayOfWeek()] + '曜日 —— 定休日</b><br>'
    + '<span class="opt-sub">暖簾は出さない。店の中は静かだ。</span>'
  );
}

function yShowDownResult(text) {
  const box = document.getElementById('offdayBody');
  document.getElementById('offdayNote').innerHTML = text;
  box.innerHTML = '';
  const btn = document.getElementById('btnOffdayClose');
  btn.textContent = '🌅 明日の朝へ';
  btn.classList.remove('hidden');
  btn.onclick = () => {
    yCloseDayScreen();
    Y_OFFDAY_OPEN = false;
    yEndOffDay();                       // ここで G.day が進む＝倒れた日が終わる
  };
  if (typeof updateTopbar === 'function') updateTopbar();
  if (typeof saveGame === 'function') saveGame();
}

function yShowResult(text) {
  const box = document.getElementById('offdayBody');
  /* 行き先の一枚絵は【🏮 出勤する】を押すまで上に残す（作者指定 8/8）。
     寄り道をしていない日は空文字が返る＝これまでどおり文章だけ */
  /* 体力の一行は、ゲージを使う章だけ（`gauges: false` の章では出さない） */
  document.getElementById('offdayNote').innerHTML =
    (typeof ySpotVisual === 'function' ? ySpotVisual() : '') + text
    + (CONF.gauges
        ? '<br><span class="opt-sub">体力 ' + Math.round(G.stam ?? yStamMax()) + ' / ' + yStamMax()
          + '　　立てば ' + yWorkHours() + '時間ぶん（−' + yStamDrain() + '）削れる</span>'
        : '');
  box.innerHTML = '';
  const btn = document.getElementById('btnOffdayClose');
  /* ロウリュ街で人に会った夜は、**出勤するより先に返事をする**。
     返事を待たせたまま店に立たせない＝【🏮 出勤する】はいったん隠す */
  const sc = G.ch2 && G.ch2.scoutPid
    && (STAFF_POOL || []).find(p => p.pid === G.ch2.scoutPid);
  if (sc) { btn.classList.add('hidden'); yRenderScoutPick(box, sc, text); return; }
  /* 題名を戻す。**返事のあとも「雇いますか？」のままだった**（作者指摘 8/8）。
     ここに残っているボタンは【🏮 出勤する】ひとつなので、題名もそれに合わせる */
  /* ============ 締めのボタン ============
     **選択のある章**（`dayChoice: true`）＝寄り道のあと、その日そのまま店に立つ。
     **月曜が定休の章**（いま）＝店は開けないので、そのまま翌朝へ送る。
     ここ1か所で、デートも買い出しもロウリュ街もライバル店もスカウトも同じ締めになる */
  if (!CONF.dayChoice) {
    document.getElementById('offdayTitle').textContent = '🌙 定休日';
    btn.textContent = '🌅 明日の朝へ';
    btn.classList.remove('hidden');
    btn.onclick = () => {
      if (typeof ySetSpotArt === 'function') ySetSpotArt(null);
      yCloseDayScreen();
      Y_OFFDAY_OPEN = false;
      yEndOffDay();                       // ここで日付が進む
    };
    if (typeof updateTopbar === 'function') updateTopbar();
    if (typeof saveGame === 'function') saveGame();
    return;
  }
  document.getElementById('offdayTitle').textContent = '🏮 店を開ける';
  btn.textContent = '🏮 出勤する';
  btn.classList.remove('hidden');
  btn.onclick = () => {
    if (typeof ySetSpotArt === 'function') ySetSpotArt(null);   // 店に立つ＝寄り道の絵はここで畳む
    const p = yPlan(); p.go = true; p.done = true;
    yCloseDayScreen();
    Y_OFFDAY_OPEN = false;
    if (typeof ySyncKaigyoBtn === 'function') ySyncKaigyoBtn();
    if (typeof saveGame === 'function') saveGame();
  };
  if (typeof updateTopbar === 'function') updateTopbar();
  if (typeof saveGame === 'function') saveGame();
}

/* ============ 「それでも出勤しますか？」（作者決定 8/5 → **8/6 に外した**）============
   ⚠ **いまはどこからも呼んでいない。**朝の画面は1枚で終える形にしたので、
   寄り道のあとは yShowResult の【🏮 出勤する】でそのまま店に立つ。

   ＝**「今日は出ない（妻がひとりで番台に立つ）」日は、いま選べない。**
   仕掛け（yRunAbsentDay・yAbsentToday・ySegWant の店主不在 −6）はそのまま残してある。
   戻すなら、OFFDAY_Y に「🏠 今日は出ない」を1つ足して、その onclick で
   `yPlan().go = false; yRunAbsentDay();` を呼ぶのがいちばん素直
   （画面を1枚増やさずに、選択肢として並べられる）                          */
function yAskShukkin() {
  const box = document.getElementById('offdayBody');
  const stam = Math.round(G.stam ?? yStamMax());
  document.getElementById('offdayTitle').textContent = '🏮 出勤しますか？';
  document.getElementById('offdayNote').innerHTML = yMorningVisual()
    + '店を開ける時間だ。<br><span class="opt-sub">体力 ' + stam + ' / ' + yStamMax()
    + '　　立てば ' + yWorkHours() + '時間ぶん（−' + yStamDrain() + '）削れる</span>';
  box.innerHTML = '';
  document.getElementById('btnOffdayClose').classList.add('hidden');
  const grid = document.createElement('div');
  grid.className = 'y-cmd-grid';
  const go = document.createElement('button');
  go.className = 'y-cmd go';
  go.innerHTML = '<b>🏮 出勤する</b><span class="y-cmd-sub">自分で番台に立つ。掃除も自分の手でやる</span>';
  go.onclick = () => {
    const p = yPlan(); p.go = true; p.done = true;
    yCloseDayScreen();
    Y_OFFDAY_OPEN = false;
    if (typeof ySyncKaigyoBtn === 'function') ySyncKaigyoBtn();
    if (typeof saveGame === 'function') saveGame();
  };
  const no = document.createElement('button');
  no.className = 'y-cmd';
  no.innerHTML = '<b>🏠 今日は出ない</b><span class="y-cmd-sub">'
    + WIFE_Y.name + 'がひとりで番台に立つ。掃除までは手が回らない</span>';
  no.onclick = () => {
    const p = yPlan(); p.go = false; p.done = true;
    yCloseDayScreen();
    Y_OFFDAY_OPEN = false;
    yRunAbsentDay();
  };
  grid.appendChild(go); grid.appendChild(no);
  box.appendChild(grid);
  yOpenDayScreen();
}
/* ============ 出勤しない日を、その場で1日ぶん回す ============
   **統計で近似せず、いつもの営業をそのまま早送りする。**
   （近似すると、画面で見ている日と数字の出方が食い違って、何を直せばいいのか分からなくなる）
   主人公は居ない＝妻がひとり番台に立つので、掃除は誰もしない・行列は伸びる。
   終わればいつもの日報がそのまま出る＋「なぜそうなったか」を1行足す              */
function yRunAbsentDay() {
  if (!G.equip.some(e => EQ[e.id].cat === 'locker' && e.cond > 0)
      || !(hasCat('furo') || hasCat('sauna'))) {
    // そもそも開けられない店＝今日は閉めたまま
    log('🚪 店を開けられる形になっていない。今日は閉めたままだった');
    yEndOffDay();
    return;
  }
  if (typeof deselect === 'function') deselect();
  if (typeof endPlacing === 'function') endPlacing();
  G.placing = null;
  /* **ワンオペの一日**。彼女はひとりで開けて、ひとりで閉める */
  if (typeof yMoodAdd === 'function') yMoodAdd(-5, 'ひとりで店を回した');
  startDay();                                   // いつもの一日を始める（主人公は妻ひとり扱い）
  /* **1分刻み**（実測で決めた）。粗いと客が歩き切れず会計までたどり着かない＝
     4分刻みだと同じ日が14人→8人に化けた。1分なら実際に見ている日と一致し、
     しかも1日ぶんが0.1秒で終わる                                          */
  const step = 1;
  for (let i = 0; i < 5000 && G.phase === 'biz'; i++) stepBiz(step);
  if (G.phase === 'biz') closeDay();            // 念のため（止まらなかった時の受け皿）
}

function yOffdayClose() {
  yCloseDayScreen();
  if (!Y_OFFDAY_OPEN) return;
  Y_OFFDAY_OPEN = false;
  yEndOffDay();
}

/* ============ 運営メニューの「営業時間」と「週の予定」 ============ */
function yManageRuleExtra() {
  const empty = yEmptyFloors();
  /* ── 営業時間（1時間刻み）──
     その場で**差し引き**を出す。伸ばした瞬間に代償が見えないと、ただの数字になる。
     ※**週の予定（営業する曜日）は廃止**（作者決定 8/5）＝毎朝その日を決める形にした */
  const h = yHours(), work = yWorkHours();
  const per = yStamPerHour(), drainH = yStamDrain(), backH = yStamBack();
  const net = backH - drainH;
  const netTxt = net === 0 ? '体力は<b>差し引きゼロ</b>'
    : net > 0 ? '体力が毎日 <b>+' + net + '</b>'
              : '体力が毎日 <b>' + net + '</b>＝<b>'
                + Math.max(1, Math.ceil((G.stam ?? yStamMax()) / -net)) + '日で倒れる</b>';
  /* **営業時間を選ぶボタンは廃止**（作者決定 8/5）。
     15時〜22時に固定し、そこから先を伸ばす道は**深夜営業ただ一つ**にした＝
     ダイヤルを回して稼ぐのではなく、**ラウンジを建てて、夜に立つ人を雇う**。
     数字を出しているのは、そのぶん体が楽になっていることを見せるため      */
  /* ── 小学生以下お断り（作者決定 8/5）──
     **答えのある選択にしない。**掲げれば夕方の家族連れが丸ごと消えるが、
     子どもの声に堪えていた老人の不満も消える＝老人の支持が伸びて夕方が埋め直される。
     どちらが得かは、その店が老人に応えられているかで決まる                */
  const bk = !!(G.opts && G.opts.banKids);
  const rojin = (typeof ySegFanOf === 'function') ? ySegFanOf('m_rojin') : 0;
  const kidRow = '<div class="opt-row"><span>小学生以下お断り<br><span class="opt-sub">'
    + '掲げると<b>夕方の家族連れが来なくなる</b>。代わりに子どもの声が無くなる＝'
    + '老人の不満が消える。<br>いまの老人の支持 <b>' + rojin + '</b>'
    + (bk ? '（子連れの支持は落ちていく）' : '')
    + '</span></span><button class="opt-btn ' + (bk ? 'on' : '') + '" data-act="ch:banKids">'
    + (bk ? 'お断り' : '受け入れる') + '</button></div>';

  /* **【営業時間】【体力の上限】【覚えたこと】は出さない**（作者指定 8/8）。
       ・営業時間 …… 15時〜22時に固定で、ここでは動かせない＝読むだけの行だった
       ・体力の上限 … 上のバーが「体力 62 / 120」と実数で出すようになったので二重
       ・覚えたこと … 【データ】の【✨ スキル】タブに移した（そちらが本体）
     残すのは**押せるもの**だけ＝この欄は【小学生以下お断り】ひとつになる          */
  return kidRow;
}
/* 営業時間の増減ボタンは廃止（作者決定 8/5）。
   時間を伸ばす道は**深夜営業ただ一つ**＝運営メニューの「深夜営業」の行。
   いまここが受けているのは【小学生以下お断り】だけ */
function yManageAct(act, v) {
  if (act === 'banKids') { G.opts.banKids = !G.opts.banKids; return; }
  return;
}

/* 【刺青・ヤクザお断り】の説明文（第2章）。**みかじめ料は無い**（作者決定 8/5）＝
   鬼頭は第1章の人で、この章にはいない。代わりに書くのは**この店で実際に起きること**  */
function yBanYakuzaNote() {
  return '掲げると<b>遅い時間の強面の客が来なくなる</b>（21〜23時が山）。'
       + '掲げなければ、居合わせた客の満足度が下がる＝<b>いちばん堪えるのは子連れ</b>。';
}

/* ============ 登録 ============ */
/* 買い出しの1割引き（1週間だけ効く） */
/* 掘り出し物を1点選ぶ。**買える見込みのある品だけ**が対象＝
   1億円の設備が3割引になっても、序盤の意味にならない                    */
function yBargainPick(rate) {
  if (Math.random() > (rate == null ? 0.55 : rate)) return null;   // 出ない日もある
  const pool = Object.keys(EQ).filter(id => {
    const d = EQ[id];
    if (!d || d.fixed || !d.price) return false;
    if (d.rep && G.rep < d.rep) return false;            // まだ解放されていない品は出さない
    return d.price <= Math.max(600000, (G.cash || 0) * 1.6);
  });
  if (!pool.length) return null;
  const id = pool[(Math.random() * pool.length) | 0];
  const pct = [0.2, 0.25, 0.3, 0.4][(Math.random() * 4) | 0];
  return { id, pct, name: EQ[id].name };
}
/* 買い出しの1割引きと、掘り出し物の値引きを合わせる（同じ品なら大きいほうを使う） */
function yEqDiscount(id) {
  const c = G.ch2; if (!c) return 0;
  let d = (G.day <= (c.waribikiUntil || 0)) ? (c.waribikiPct || 0.1) : 0;
  // 🏷【値切り上手】＝熱波銀座の古道具屋で覚えたもの。期限は無い（odekake_y.js）
  if (typeof ySkillEqOff === 'function') d = Math.max(d, ySkillEqOff());
  const s2 = c.sale;
  if (s2 && s2.id === id && G.day <= s2.until) d = Math.max(d, s2.pct);
  return d;
}
/* 面接に来る人数は第1章と同じ3人（作者指定 8/6）。
   ロウリュ街で飲んだ回数で増やすのはやめた＝あの夜の価値は
   「ストレスが抜ける」と「たまに人に出会う」の二つに寄せてある */
function yJobPoolN() { return 3 + ((typeof ySkillJobAdd === 'function') ? ySkillJobAdd() : 0); }

registerChapter2Hooks({
  /* 定休日は主人公が館内で掃除を始めない（店に居ないので）。
     【🔧 店に出る】を選んだ日も歩き回りはしない＝あの行動は、汚れも傷みも
     その場でまとめて片づける形にしてあるので、館内をうろつく必要がない */
  /* 【今日は何をする？】を開いている間は、主人公を働かせない。
     ここを塞がないと、行き先を選んでいる間に館内の掃除で体力を使い切ってしまう
     （倒れた日だけを見ていたが、**朝の画面を開いている間も同じ**・2026-08-07） */
  offDayNoWork: () => !!(G.ch2 && (yClosedToday() || Y_OFFDAY_OPEN)),
  eqDiscount: yEqDiscount,
  jobPoolN: yJobPoolN,
  syncKaigyoBtn: ySyncKaigyoBtn,
  offDay: yOffDay,
  offdayClose: yOffdayClose,
  absentToday: yAbsentToday,
  keepStamina: () => true,     // 朝の全快をさせない（体力はこの章が自分で管理する）
  offDayAgain: yOffDayAgain,
  dayOfWeek: (d) => yDayOfWeek(d),   // **火曜始まり**（startDow）。0 に戻せば月曜始まり
  moodPct: () => (G.ch2 && CONF.gauges ? yMood() : null),
  /* ゲージの見出しは**「妻の機嫌」**（作者指定 8/2）。
     名前だけだと、それが何のゲージなのかが分からない */
  moodName: () => '妻の機嫌',
  stressPct: () => (CONF.gauges && CONF.stressMax ? yStress() / CONF.stressMax * 100 : null),
  /* 帯の文字は**実数**で（作者指定 8/8）。上限が筋トレで伸びるので、%では中身が読めない */
  stamMax:  () => yStamMax(),
  stamText: () => '体力 ' + Math.round(G.stam ?? yStamMax()) + ' / ' + yStamMax(),
  stressName: () => 'ストレス',
  manageRuleExtra: yManageRuleExtra,
  manageAct: yManageAct,
  banYakuzaNote: yBanYakuzaNote,
});
