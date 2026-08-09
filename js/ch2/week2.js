'use strict';

/* ============================================================
   第2章「独立開業編」の一日と、金の周期（CHAPTER2.md §5）
   ------------------------------------------------------------
   **第1章とまったく同じ「1日ごと」で進む**（作者指定）。

     準備（時計は止まる）→【営業開始】→ 1日営業 → **日報** → また準備

   いちど「一週間を通しでノンストップに回す」形を作ったが、作者が却下した。
   1日の途中で手を入れられないのが理由＝設備をひとつ買って結果を見る、という
   第1章の呼吸が、7日ぶん回りきるまで戻ってこない。だから週ごと捨てた。
   時計の刻み（15分〜1時間）も速度表の作り替えも一緒に捨ててある（data2.js 参照）。

   この章だけの上乗せは、次の3つ。

     ① 開業までの7日   … 【🌙 今日は終わり】を押すと1日進む＝7回ぶんの作業日
     ② 開けるための最低限 … 部屋ごとに「ここに何が要るか」を名指しする（rules2.js の openReq）
     ③ 10日ごとの出費  … 事業ローン・住宅ローン・生活費が、順番に殴りに来る
   ============================================================ */

function newWeek2() {
  return {
    home: 60,           // 千夏の機嫌（0〜100）
    prepDay: 1,         // 開業準備の何日目か（CONF.openDays 日で開業の約束）
    prepMin: 0,         // 準備開始（1日目9:00）からの経過分。日付はこれで数える
  };
}
/* 古いセーブ（この作り替えより前）にも足りないものを埋める */
function ensureWeek2() {
  if (!G.ch2) return;
  const w = newWeek2();
  for (const k in w) if (G.ch2[k] === undefined) G.ch2[k] = w[k];
}

/* ---- game.js から呼ばれる差し替え口 ---- */
/* 章ごとの1日ぶんの固定費。買った店なので家賃は無いが、
   固定資産税・保険が、客が0人でも毎日出ていく（CHAPTER2.md §10-2）。
   事業ローンの返済はここから外した＝30日にいちどの一括に畳んである（下の CONF.bills） */
function dailyExtraCost() {
  return (CONF.koteiShisan || 0) + ((G.today && G.today.menuCost) || 0);
}
function weekDayOfWeek(d) { return ((d ?? G.day) - 1) % 7; }
function weekDayText() {
  // 開業の関門は廃止した（初日から店を開ける）ので、日付は第1章と同じ「○日目（曜）」
  return undefined;
}

/* ============ 家 ============
   店と家を行き来する（作者指定）。**帰れば、その日は終わる。**
   モーダルは出さない（作者指定）＝**勝手に帰って、勝手に戻ってくる**。
   起きるのはログと、上の日付が1日進むことだけ。

     ・体力が尽きた      … 黙って帰って寝る。翌朝、体力は全快。千夏の機嫌は少し下がる
     ・【🏠 早く帰る】    … 手が残っているうちに切り上げる＝家族と過ごせる。
                            機嫌は上向くが、翌朝の体力は戻りきらない

   店を建てるのは主人公ひとりの仕事だが、家を保たせるのも同じ一日の中にある。 */
const HOME_MOOD_SLEEP = -4;      // 帰って寝ただけの夜。何もしなければ、じわじわ下がる
const HOME_MOOD_FAMILY = 20;     // 千夏と話した
const HOME_MOOD_COOK = 8;        // 飯を作った
const HOME_TALK_MIN = 120;       // 話すのに2時間
const HOME_COOK_MIN = 60;        // 作るのに1時間
const HOME_COOK_STAM = 10;       // 作るのは自分＝体力を使う

function homeMood() { return G.ch2 ? clamp(G.ch2.home ?? 60, 0, 100) : 60; }
function moodWord(m) {
  return m >= 80 ? '機嫌がいい' : m >= 55 ? 'ふつう' : m >= 30 ? '少し不機嫌' : m >= 12 ? '口をきいてくれない' : '限界だ';
}
/* 帰った夜の千夏の一言。機嫌と、店の進み具合で変わる */
function chinatsuLine(family) {
  const m = homeMood();
  if (m < 12) return '（背を向けたまま、何も言わない）';
  if (m < 30) return '「……お店とわたし、どっちが大事なの」';
  if (family) return '「今日は早いんだ。……ごはん、あっためるね」';
  if (m < 55) return '「ごはん、置いてあるから」';
  if (junkLeft()) return '「手、真っ黒だよ。……お風呂わかしてある」';
  return '「おかえり。……あの箱が、お店になっていくんだね」';
}

/* 家に帰って寝る＝一日が終わる。朝には勝手に店へ戻っている。
   family＝手が残っているうちに自分から切り上げた（＝家族と過ごせた）夜   */
/* 帰ってから店に戻るまでの内訳（分）。合計 9時間15分＝**寝るのはタダではない**。
   体力は満タンに戻るが、そのぶん7日間の持ち時間が削れる（作者指定：8時間睡眠） */
const HOME_WIND_DOWN = 45;       // 帰って、飯を食って、風呂に入って、寝るまで
const HOME_SLEEP_MIN = 8 * 60;   // 8時間睡眠
const HOME_COMMUTE = 30;         // 起きて、店に着くまで

/* 一日の区切り。いま何日目かの目印（1日1回だけできることに使う） */
function dayKey() { return G.ch2.opened ? G.day : (G.ch2.prepDay || 1); }

/* ---- 店 ↔ 家 ---- */
function toggleHome() {
  if (!homeOn()) return;
  const f = homeAreaIdx(); if (f < 0) return;
  if (onHome()) {
    advanceClock(HOME_COMMUTE);
    enterAreaScreen(AR.LOBBY);
    log(`♨ ${clockText(G.minutes)} 店に戻った`);
  } else {
    advanceClock(HOME_COMMUTE);
    enterAreaScreen(f);
    log(`🏠 ${clockText(G.minutes)} 家に帰った`);
    bubble(G.player, chinatsuLine(false), 4.5);
  }
  syncHomeBtn();
  saveGame();
}
/* 家の中でタップしたもの */
function homeAction(key) {
  if (!homeOn()) return;
  ensureWeek2();
  const c = G.ch2;
  if (key === 'bed') return sleepAtHome();
  if (key === 'wife') return talkChinatsu();
  if (key === 'kit') return cookAtHome();
  if (key === 'table') return showKakei();
}
/* ベッド＝8時間寝る。朝、勝手に店へ戻る */
function sleepAtHome() {
  const c = G.ch2;
  const bed = clockText(G.minutes + HOME_WIND_DOWN);
  const up = clockText(G.minutes + HOME_WIND_DOWN + HOME_SLEEP_MIN);
  c.home = clamp(homeMood() + HOME_MOOD_SLEEP, 0, 100);
  advanceClock(HOME_WIND_DOWN + HOME_SLEEP_MIN);
  restStamina();
  G.tiredSaid = false;
  log(`💤 ${bed} 就寝 → 8時間 → ${up} 起床`);
  toast('💤 8時間寝た（体力が戻った）');
  advanceClock(HOME_COMMUTE);
  enterAreaScreen(AR.LOBBY);
  log(`♨ ${clockText(G.minutes)} 店に着いた`);
  syncHomeBtn();
  saveGame();
}
/* 千夏と話す＝家族サービス。1日1回 */
function talkChinatsu() {
  const c = G.ch2;
  if (c.talkDay === dayKey()) { toast('今日はもう、たっぷり話した'); return; }
  c.talkDay = dayKey();
  c.home = clamp(homeMood() + HOME_MOOD_FAMILY, 0, 100);
  advanceClock(HOME_TALK_MIN);
  log(`👪 千夏と2時間、なんでもない話をした（機嫌 +${HOME_MOOD_FAMILY} ―― ${moodWord(homeMood())}）`);
  bubble(G.player, chinatsuLine(true), 4.5);
  toast(`👪 千夏の機嫌 +${HOME_MOOD_FAMILY}`);
  saveGame();
}
/* 台所＝飯を作る。体力を使うぶん、話すより安く機嫌が上がる。1日1回 */
function cookAtHome() {
  const c = G.ch2;
  if (c.cookDay === dayKey()) { toast('今日はもう作った'); return; }
  if (stamLeft() < HOME_COOK_STAM) { toast('もう包丁を持つ気力もない'); return; }
  c.cookDay = dayKey();
  G.stam = Math.max(0, stamLeft() - HOME_COOK_STAM);
  c.home = clamp(homeMood() + HOME_MOOD_COOK, 0, 100);
  advanceClock(HOME_COOK_MIN);
  log(`🍳 台所に立った。1時間かけて飯を作った（機嫌 +${HOME_MOOD_COOK}／体力 −${HOME_COOK_STAM}）`);
  bubble(G.player, '「……たまには、こういうのもいいね」', 4.5);
  toast('🍳 千夏と晩飯を食った');
  saveGame();
}
/* 食卓＝家計。金と機嫌を並べて見る */
function showKakei() {
  const m = homeMood();
  log('📋 ── 家計 ──');
  log(`　手持ち ${kgYen(G.cash)}　／　借入 ${kgYen(G.debt)}`);
  for (const b of (CONF.bills || [])) log(`　${b.icon} ${b.name} ${kgYen(b.amount)}／${b.every}日`);
  const n = nextBill();
  if (n) log(`　次は ${n.bill.icon} ${n.bill.name}（あと${n.left}日）`);
  log(`　千夏の機嫌 ${m}（${moodWord(m)}）`);
  toast(`📋 千夏の機嫌 ${m}（${moodWord(m)}）`);
}
/* 開業準備の時計を進める。
   G.minutes は開店時刻（9:00）からの分なので、そのままだと日付が朝9時に変わってしまう。
   経過した総分数（prepMin）を別に持って、**日付は0時で変える**。          */
function advanceClock(min) {
  const c = G.ch2;
  G.minutes = ((G.minutes + min) % DAY_END_MIN + DAY_END_MIN) % DAY_END_MIN;
  if (c.opened) return;
  const before = prepDayOf(c.prepMin || 0);
  c.prepMin = (c.prepMin || 0) + min;
  const now = prepDayOf(c.prepMin);
  if (now === before) return;
  c.prepDay = now;
  const left = (CONF.openDays || 7) - now + 1;
  log(left > 0 ? `☀ 日付が変わった。開業まであと${left}日`
               : `☀ 日付が変わった。……開業の予定日は、もう過ぎている`);
  if (left === 1) log('⚠ 明日にはもう、暖簾を出すと言ってしまった');
}
/* 準備開始（1日目の9:00）から min 分経ったとき、それは何日目か。境目は0時 */
function prepDayOf(min) {
  return 1 + Math.floor((min + CONF.openHour * 60) / DAY_END_MIN);
}
/* G.minutes（開店時刻からの分）を「○:○○」に */
function clockText(min) {
  const m = ((min % DAY_END_MIN) + DAY_END_MIN) % DAY_END_MIN;
  const h = (CONF.openHour + Math.floor(m / 60)) % 24;
  return `${h}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
}
/* 帯の【🏠 家へ】／【♨ 店へ】。営業中は店を離れられないので出さない */
function homeOn() { return CONF.homeOn !== false && homeAreaIdx() >= 0; }
function syncHomeBtn() {
  const b = $('btnHome'); if (!b) return;
  const show = !!(G.ch2 && G.phase === 'prep') && homeOn();
  b.classList.toggle('hidden', !show);
  if (show) b.textContent = onHome() ? '♨ 店へ' : '🏠 家へ';
}
/* 体力が尽きた主人公は、番台で寝るのではなく家に帰る（第2章）。
   やりかけの仕事を放り出さないよう、手が空いてから帰す                */
function homeAutoCheck() {
  if (!homeOn()) return;
  if (!G.ch2 || G.phase !== 'prep') return;
  if (!staminaOn() || canSpendStam('clean') || canSpendStam('junk')) return;
  if (onHome()) return;                                        // もう帰っている
  const p = G.player;
  if (!p || p.moving) return;
  if (p.task && p.task !== 'home') return;                     // やりかけの仕事は先に終わらせる
  /* 力尽きた＝勝手に帰る（作者指定）。モーダルは出さない。
     帰るだけで、寝るかどうかは家でベッドをタップして決める */
  const f = homeAreaIdx(); if (f < 0) return;
  advanceClock(HOME_COMMUTE);
  enterAreaScreen(f);
  log(`🌙 ${clockText(G.minutes)}、体も頭も動かない。店を閉めて帰った`);
  bubble(G.player, chinatsuLine(false), 4.5);
  toast('🌙 家に帰った（ベッドで寝ると朝になる）');
  syncHomeBtn();
}

/* 準備画面のいちばん左のボタンの文字を、いまの状態に合わせる。
   開業したあとは第1章とまったく同じ【▶ 営業開始】＝押せば1日が始まる */
function syncKaigyoBtn() {
  const b = $('btnOpen'); if (!b) return;
  if (!G.ch2) return;
  // 【開業準備】は廃止（作者指定）＝初日から【営業開始】。ゴミだらけでも開けられる
  b.textContent = '▶ 営業開始';
}

const DAY_END_MIN = 24 * 60;                       // 1日＝24時間ぶんの分数（開業準備の日送りが使う）

/* 準備中に画面を動かさない（毎晩、案内図に飛ばされない）。
   第2章は区画が5つあるので、放っておくと閉店のたびに案内図へ戻されてしまう */
function nightKeepView() { return true; }

/* ============ 開業準備の一日を締める ============
   準備中は時計が止まっているので、日付はプレイヤーが自分で送る（作者指定）。
   開業ボードの【🌙 今日は終わり】から呼ばれる。7日＝7回ぶんの作業日   */
function endPrepDay() {
  ensureWeek2();
  const c = G.ch2;
  if (c.opened) return;
  c.prepDay = (c.prepDay || 1) + 1;
  c.prepMin = (c.prepDay - 1) * DAY_END_MIN;       // 家システム用の時計と辻褄を合わせる
  G.minutes = 0;
  G.prepCleaned = 0;                               // 明日また拭ける
  G.tiredSaid = false;
  restStamina();
  const left = (CONF.openDays || 7) - c.prepDay + 1;
  log(left > 0 ? `☀ 朝になった。開業まであと${left}日`
               : '☀ 朝になった。……開業の予定日は、もう過ぎている');
  if (left === 1) log('⚠ 明日にはもう、暖簾を出すと言ってしまった');
  toast(left > 0 ? `☀ 開業まであと${left}日` : '☀ 予定日は過ぎている');
  if (typeof renderKaigyo === 'function') renderKaigyo();
  updateTopbar();
  saveGame();
}

/* ============ 10日ごとに来る、重い出費 ============
   事業ローン・住宅ローン・生活費。1つ1つは30日周期で、10日ずつずれている（CONF.bills）。
   店の損益ではない（元金の返済も生活費も経費ではない）ので、
   日報の収支には混ぜず、**日報の下に別枠**で出す。                        */
function billsDue(day) {
  return (CONF.bills || []).filter(b => day >= b.day && (day - b.day) % b.every === 0);
}
/* 次に来るのはどれで、あと何日か */
function nextBill() {
  let best = null;
  for (const b of (CONF.bills || [])) {
    const left = G.day < b.day ? b.day - G.day
               : (b.every - ((G.day - b.day) % b.every)) % b.every || b.every;
    if (!best || left < best.left) best = { bill: b, left };
  }
  return best;
}
/* 日報の下に足す一枚（game.js の日報から呼ばれる）。
   **引くのと見せるのを同じ場所でやる**のが肝。nightFlow は日報を閉じたあとに走るので、
   そちらで引くと日報の額と手持ちがずれる。ここで引けば、表示と支払いが必ず一致する。
   日報を開き直しても二度引かないよう、その日ぶんは billHtml に取っておく          */
function dayReportExtra() {
  const c = G.ch2;
  if (!c || !c.opened) return '';
  // 停められずに素通りした客は、引き落としの有無に関わらず毎日出す
  const park = parkLostHtml();
  if (c.billDay === G.day) return park + (c.billHtml || '');
  c.billDay = G.day;
  const due = billsDue(G.day);
  if (!due.length) { c.billHtml = ''; return park; }

  const total = due.reduce((s, b) => s + b.amount, 0);
  G.cash -= total;
  /* 事業ローンを払った回は、公庫の残債が元本ぶんだけ減る（利息は消えるだけ）。
     1,000万・年2.0%・7年＝84回。この章のあいだに完済することは無いが、
     **払っている実感**と、追加融資の枠が空いていく手応えはここから出る       */
  if (due.some(b => b.key === 'loan')) {
    G.debt = Math.max(0, (G.debt || 0) - (CONF.loanPrincipal || 0));
    if (!G.debt) log('🏦 公庫への返済が終わった');
  }
  // 払えない月は、店より先に家のほうが軋む。滞納は公庫の審査にも響く
  if (G.cash < 0) {
    c.billMissed = true;
    if (homeOn()) c.home = Math.max(0, homeMood() - 30);
  }
  for (const b of due) log(`${b.icon} ${b.name} −${kgYen(b.amount)}`);

  const rows = due.map(b => `<div class="bill-row">
      <span>${b.icon} ${b.name}${b.note ? `<span class="bill-note">（${b.note}）</span>` : ''}</span>
      <span class="yen">−${kgYen(b.amount)}</span></div>`);
  const n = nextBill();
  return park + (c.billHtml = `<div class="rep-bill"><b>🧾 今日の引き落とし</b>（店の収支とは別）
    ${rows.join('')}
    <div class="bill-row bill-sum"><span>差し引き 手持ち</span>
      <span>${kgYen(G.cash)}</span></div>
    ${n ? `<div class="bill-next">次は ${n.bill.icon} ${n.bill.name} ${kgYen(n.bill.amount)}（あと${n.left}日）</div>` : ''}
  </div>`);
}

/* ============ 1日の締め ============
   日報を閉じたあとに呼ばれる。第1章と同じく、そのまま翌日の準備へ戻る。 */
function nightFlow(finishedDay) {
  ensureWeek2();
  const c = G.ch2;
  chHook('kuwataTick');          // 「安くしろ」のように、日数を数える注文を進める

  /* ── 開業初日の夜、桑田芳雄が入ってくる（第2章 最初のミッション）──
     暖簾を下ろしたあとの店に、閉めたはずの戸を開けて勝手に入ってくる。
     場面が終わったら、その場でひとつ目の注文を突きつけてくる          */
  const kw = c.kuwata;
  if (c.opened && (!kw || !kw.met)) {
    const meet = chHook('kuwataMeet');
    if (meet && meet.length) {
      if (!c.kuwata) c.kuwata = { met: false, i: 0, asked: false, done: 0, ally: false, failed: [] };
      c.kuwata.met = true;
      Sfx.bgmStop();
      Story.play(meet, () => { openKuwata('ask'); enterPrep(); saveGame(); });
      return;
    }
  }
  /* 直近の黒字／赤字を10日ぶん覚えておく。公庫の追加融資はここを見る（宮下は数字しか見ない） */
  c.profitDays = (c.profitDays || []).concat([(G.today && G.today.profit || 0) > 0]).slice(-10);
  /* 申し込んでおいた追加融資が振り込まれる日（2週間かかる＝明日の金にはならない） */
  if (c.koukoAt && G.day >= c.koukoAt) {
    const amt = c.koukoAmt || 0;
    G.cash += amt; G.debt = (G.debt || 0) + amt;
    c.koukoAt = null; c.koukoAmt = 0;
    log(`🏦 公庫から ${kgYen(amt)} が振り込まれた`);
    toast(`🏦 公庫の融資 ${kgYen(amt)} 入金`);
  }
  enterPrep();
  saveGame();
}

/* ============ 登録 ============ */
registerChapter2Hooks({
  nightFlow,
  nightKeepView,
  syncKaigyoBtn,
  toggleHome,
  homeAction,
  syncHomeBtn,
  dayOfWeek: weekDayOfWeek,
  dayText: weekDayText,
  dailyExtraCost,
  dayReportExtra,
});
