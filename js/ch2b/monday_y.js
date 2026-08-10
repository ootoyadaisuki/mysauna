/* ============================================================
   月曜日＝定休日の強制イベント（第2章「ととのい市編」・作者決定 2026-08-08）
   ============================================================
   **選ばせない。月曜になると、勝手に一日が起きる。**
   行き先は4つ。どれになるかは、店の進み具合で変わる。

     ♨️ ライバル店   … **ゲームの勝ち方を、よその店の客がこっそり教えてくれる。**
                        一度話を聞いた店へまた行くと、もう教えることは無い＝
                        ただととのって、金だけ減って帰ってくる
     💗 妻とデート   … 金が減る。人と出会う日もある
     🛍 買い出し     … 割引と掘り出し物。たまに、いらない物を買って帰る
     🍶 ロウリュ街で飲む   … 金が減る。人材に出会う夜も、バイトと鉢合わせる夜もある

   ⚠ **中身はほとんど既にある。**行き先の台本も一枚絵も、買い出しの割引も
     掘り出し物も、ロウリュ街のスカウトも `odekake_y.js` / `offday_y.js` の資産。
     ここがやるのは「月曜にどれを起こすか」と、足りなかった4つの継ぎ足しだけ。

   ⚠ 戻し方は `data_y.js` の `dayChoice: true`。毎朝の選択画面が生き返り、
     このファイルは呼ばれなくなる（消さなくていい）
   ============================================================ */

/* ============ どれを起こすか ============
   **序盤はライバル店に寄せる。**攻略のヒントは早く渡すほど効く＝
   まだ話を聞いていない店が残っているうちは、半分の確率でそこへ行く。
   全部回りきったら、実利（買い出し）と人（ロウリュ街・デート）に配り直す */
function yMondayUnheard() {
  const talked = (G.ch2 && G.ch2.talked) || {};
  return (typeof RIVALS_Y !== 'undefined' ? RIVALS_Y : []).filter(r => !talked[r.id]);
}
function yMondayKind() {
  const r = Math.random();
  if (yMondayUnheard().length) {
    // まだ手の内を知らない店がある：ライバル50／買い出し20／ロウリュ街15／デート15
    return r < 0.50 ? 'rival' : r < 0.70 ? 'kaidashi' : r < 0.85 ? 'noge' : 'date';
  }
  // 全部聞いた：買い出し35／ロウリュ街25／デート25／ライバル15
  return r < 0.35 ? 'kaidashi' : r < 0.60 ? 'noge' : r < 0.85 ? 'date' : 'rival';
}

/* ============ ライバル店 ============
   行き先は**まだ話を聞いていない店**を優先。無ければ、行ったことのある店へ。
   金が足りない店は外す（外した結果どこも行けない日は、買い出しへ振り替える） */
function yMondayRivalPick() {
  const all = (typeof RIVALS_Y !== 'undefined' ? RIVALS_Y : [])
    .filter(r => G.cash >= yVisitVal(r.id).cost);
  if (!all.length) return null;
  const unheard = all.filter(r => !((G.ch2.talked || {})[r.id]));
  const pool = unheard.length ? unheard : all;
  return pool[Math.floor(Math.random() * pool.length)];
}

/* 2回目以降＝**もう教わることが無い**日の地の文。
   金は減る。得るものは「気持ちよかった」だけ。それでいい */
const MON_RIVAL_AGAIN_Y = [
  ['もう一度あの店でととのいたくなって、気づいたら券売機の前に立っていた。',
   '目当ての情報は、前回ぜんぶ聞いてしまった。',
   'つまり今日は、ただの客だ。',
   '……いい湯だった。それ以上でも以下でもない。'],
  ['視察と言い張って出てきたが、館内着に着替えた時点で嘘になった。',
   '知りたいことはもう無い。あるのは「入りたい」だけである。',
   '水風呂で目を閉じたら、自分の店のことを一度も考えなかった。',
   '完敗だ。今日のところは。'],
  ['「勉強のため」と妻に言って出てきた。',
   '勉強はもう終わっている。単位も取った。',
   'それでも来てしまうのは、ここのロウリュが良いからだ。',
   '財布だけが正直に軽くなった。'],
  ['受付の人に顔を覚えられていた。',
   '「いつもありがとうございます」と言われて、視察の看板を静かに下ろした。',
   '常連である。よその店の。',
   '……次はうちに来てほしい。'],
];
function yMondayRival() {
  const r = yMondayRivalPick();
  if (!r) return yMondayKaidashi();               // どこにも行けない日は買い出しへ
  const heard = !!((G.ch2.talked || {})[r.id]);
  const v = yVisitVal(r.id);

  if (!heard) {
    /* **はじめての店＝手の内が見える日。**既存の一枚絵と立ち話をそのまま流す */
    const text = yVisitRival(r);
    const scenes = (typeof yRivalScenes === 'function') ? yRivalScenes(r) : [];
    if (scenes.length && typeof Story !== 'undefined') {
      Story.play(scenes, () => yEndOffDay());
      yCloseDayScreen();
    } else yShowResult(text);
    return;
  }

  /* **2回目以降＝ただの客。**金だけ減って、何も分からない */
  G.cash -= v.cost;
  G.ch2.visited = G.ch2.visited || {};
  G.ch2.visited[r.id] = (G.ch2.visited[r.id] | 0) + 1;
  if (typeof log === 'function') log('♨️ ' + r.name + 'へ（' + yen(v.cost) + '）');
  const lines = MON_RIVAL_AGAIN_Y[Math.floor(Math.random() * MON_RIVAL_AGAIN_Y.length)];
  const t = (G.ch2.talked || {})[r.id];
  yShowResult('<b>' + r.name + '</b>へ行った。<br>' + lines.join('<br>')
    + '<br><br><span class="opt-sub">' + yen(v.cost) + ' 使った。'
    + (t ? '（この店の見立て：◎ ' + t.good + '／▲ ' + t.bad + '）' : '') + '</span>');
}

/* ============ 買い出し ============
   割引も掘り出し物も既にある。足りなかったのは**無駄遣いの日**。
   6回に1回くらい、店の役に立たないものを買って帰る                        */
const MON_MUDA_Y = [
  { name: '業務用のわさび（1kg）', cost: 3800,
    say: 'なぜか安かった。サウナで使う場面を、まだ思いついていない。' },
  { name: '巨大なだるま', cost: 6000,
    say: '「縁起物ですから」と押し切られた。目はまだ両方とも白い。' },
  { name: '中古の血圧計', cost: 4500,
    say: '「サウナと言えば健康でしょう」と言われ、その勢いで買った。壊れていた。' },
  { name: '観葉植物（造花）', cost: 2800,
    say: '本物だと思って買った。値札を見て気づいた。水をやらなくていいのは、ありがたい。' },
  { name: 'よその店の名前が入ったタオル 20枚', cost: 5200,
    say: '安さに目がくらんだ。うちでは1枚も使えない。' },
  { name: '「ととのう」と書かれた掛け軸', cost: 9000,
    say: '書は達筆だった。値段も達筆だった。' },
];
function yMondayMuda() {
  if (Math.random() >= 0.17) return '';              // 6回に1回くらい
  const m = MON_MUDA_Y[Math.floor(Math.random() * MON_MUDA_Y.length)];
  if (G.cash < m.cost) return '';
  G.cash -= m.cost;
  if (typeof log === 'function') log('🛍 つい買った：' + m.name + '（' + yen(m.cost) + '）');
  return '<br><br>そして、<b>「' + m.name + '」</b>を買った。'
       + yen(m.cost) + '。<br><span class="opt-sub">' + m.say + '</span>';
}
function yMondayKaidashi() {
  const extra = yMondayMuda();
  /* 無駄遣いの一行は、買い出しの結果画面の末尾に足す。
     `yGoKaidashiRandom` は自分で絵と結果を出すので、ここに割り込ませるために
     結果の締め（yShowResult）を一度だけ包む                                  */
  if (extra) {
    const orig = window.yShowResult;
    window.yShowResult = function (text) { window.yShowResult = orig; return orig(text + extra); };
  }
  const r = yGoKaidashiRandom();
  if (r) yShowResult(r);
}

/* ============ 妻とデート ============
   既存の行き先・出来事・旧貿易地区のスカウトをそのまま使う。
   足りなかったのは**人材との出会い**が旧貿易地区だけだったこと＝
   どの行き先でも、たまに「うちで働きたい」という人に行き当たる            */
const MON_DATE_MEET_Y = [
  '帰りの電車で、隣に座った学生が『サウナー』と書かれたTシャツを着ていた。',
  '公園のベンチで、うちの店の話をしている二人組がいた。悪口ではなかった。',
  '妻の友達だという人に紹介された。開口一番「ロウリュって何ですか」と聞かれた。',
];
function yMondayDate() {
  const r = yGoDateRandom();
  if (r) yShowResult(r);
  /* 出会いは「次の求人が1人多い」という形で効かせる（面接の場を増やさない）*/
  if (Math.random() < 0.25) {
    G.ch2.jinmyaku = (G.ch2.jinmyaku || 0) + 1;
    if (typeof log === 'function')
      log('💗 ' + MON_DATE_MEET_Y[Math.floor(Math.random() * MON_DATE_MEET_Y.length)]);
  }
}

/* ============ ロウリュ街で飲む ============
   人脈も源さんもスカウトも既にある。足りなかったのは**バイトと飲む夜**。
   雇っている人がいる日は、4回に1回くらい路地で鉢合わせる                  */
const MON_NOMI_STAFF_Y = [
  '「店長、ここ来るんすか」と言われた。こっちの台詞である。',
  'うちの給料の話になった。安いと言われた。事実なので黙って注いだ。',
  '「サウナ、正直そんなに好きじゃないっす」と言われた。給料は上げないことにした。',
  '本人は覚えていないだろうが、閉店まで店の改善案を喋り続けていた。全部まともだった。',
  '「奥さん、怖いっすよね」と言われた。返事に困って、それも注いだ。',
];
function yMondayNoge() {
  const cost = 12000;
  if (G.cash < cost) return yMondayKaidashi();     // 飲む金が無い夜は買い出しへ
  G.cash -= cost;
  G.ch2.jinmyaku = (G.ch2.jinmyaku || 0) + 1;
  let text = 'ロウリュ街の路地で飲んだ。<br>'
           + '設備屋時代の後輩、熱波をやりたいという若いの、隣の店の店長。'
           + '名刺は配らなかったが、名前は覚えられた。<br>'
           + '<b>肩の力が、久しぶりに抜けた。</b>';
  /* バイトと鉢合わせる夜（作者指定 8/8） */
  const crew = (G.roster || []).filter(e => e && e.name);
  if (crew.length && Math.random() < 0.25) {
    const who = crew[Math.floor(Math.random() * crew.length)];
    const line = MON_NOMI_STAFF_Y[Math.floor(Math.random() * MON_NOMI_STAFF_Y.length)];
    text += '<br><br>三軒目で、<b>' + who.name + '</b>と鉢合わせた。<br>' + line;
    if (typeof log === 'function') log('🍶 ロウリュ街で' + who.name + 'と飲んだ');
  }
  if (typeof yNogeGenText === 'function') { const g = yNogeGenText(); if (g) text += '<br><br>' + g; }
  if (typeof yNogeLearn === 'function') text += yNogeLearn();
  const met = (typeof yNogeScout === 'function') ? yNogeScout() : null;
  if (met) { G.ch2.scoutPid = met.pid; text += '<br><br>' + yNogeScoutText(met); }
  if (typeof log === 'function') log('🍶 ロウリュ街で飲んだ（' + yen(cost) + '）');
  if (typeof yNogeScenes === 'function' && typeof yPlayOffdayScenes === 'function') {
    yPlayOffdayScenes(yNogeScenes(), text);
  } else yShowResult(text);
}

/* ============ 月曜の一日を起こす ============
   `offday_y.js` の `yShowMondayEvent()` から呼ばれる。
   どの道も最後は `yShowResult`（＝この章では【🌅 明日の朝へ】）に落ちる */
/* ============ 「今日は定休日だ」を、いちばん最初に言う（作者指定 8/8）============
   **プレイヤーは日付を見ていない。**いきなり旧貿易地区の絵が出ても、
   なぜ店を開けていないのか分からない。一日の頭に、必ずこれを挟む */
const MON_OPEN_Y = [
  ['月曜日。', '暖簾は出さない。うちの定休日だ。', '……さて、どうするか。'],
  ['月曜日。', '目覚ましを止めて、もう一度目を閉じた。', '定休日というのは、そういう日だ。'],
  ['月曜日。', 'いつもの時間に目が覚めてしまうのが、我ながら情けない。', '店は閉まっている。今日はうちの休みだ。'],
  ['月曜日。', '暖簾を出しに行きかけて、途中で引き返した。', '定休日。三度目だが、まだ体が覚えていない。'],
];
function yMondayOpening() {
  const lines = MON_OPEN_Y[Math.floor(Math.random() * MON_OPEN_Y.length)];
  /* ⚠ 家の絵のキーは **`y_living`**。`living` と書くと**絵が出ない**（実測 8/8。
     ファイル名は living.webp だが、登録キーは y_living／shokudo_y.js:457）*/
  return (typeof yScene === 'function') ? yScene('y_living', lines) : [];
}

function yMondayGo(kind) {
  if (kind === 'rival') return yMondayRival();
  if (kind === 'kaidashi') return yMondayKaidashi();
  if (kind === 'noge') return yMondayNoge();
  return yMondayDate();
}
function yMondayRun() {
  const kind = yMondayKind();
  if (typeof ySetSpotArt === 'function') ySetSpotArt(null);
  const intro = yMondayOpening();
  if (intro.length && typeof Story !== 'undefined') {
    /* 定休日の一枚を出してから、その日の一日へ。
       ⚠ **朝の画面は開き直すこと。**行き先によっては（ライバル店の2回目など）
         絵を出さずに結果だけ書くので、閉じたままだと文章の行き場が無くなる */
    Story.play(intro, () => { yOpenDayScreen(); yMondayGo(kind); });
    yCloseDayScreen();
    return;
  }
  yMondayGo(kind);
}

/* ============ 日曜日＝「明日は休みだ」（作者指定 8/8）============
   定休日の前の日は、主人公がそわそわする。
   **日付を見なくても、休みが近いことが伝わる**のがねらい */
const MON_SUNDAY_Y = [
  '明日は休みだ', '今日を乗り切れば定休日…', 'あと一日、あと一日',
  '明日は寝るぞ。何もしないぞ', '日曜が終われば、うちの正月だ',
  'この最後の一時間が長い', '明日の予定？ 無いのが予定だ',
];
let Y_SUN_COOL = 0;
function yMondaySundayTalk(dt) {
  if (!G.ch2 || !CONF.weekOff) { /* 定休日の無い設定では何も言わない */ }
  if (CONF.weekOff == null) return;
  // 定休日の前の日か（月曜が休みなら日曜）
  const eve = ((CONF.weekOff | 0) + 6) % 7;
  if (yDayOfWeek() !== eve) return;
  Y_SUN_COOL -= dt;
  if (Y_SUN_COOL > 0) return;
  const p = G.player;
  /* ⚠ **喋れなかった回で間隔を食い潰さない。**
     先に間隔をリセットしていたら、主人公が別のことを喋っている最中に順番が来るたび
     1回ぶん捨てられて、**一日中まったく出なかった**（実測）。
     言えたときだけ次の間隔を置く                                            */
  if (!p || p.bub || typeof bubble !== 'function') return;
  /* 1日（約420分）で2〜4回。主人公は掃除や会計でもよく喋るので、
     間隔を長く取ると**丸一日ひとことも言わない日**ができる（実測で1回だった）*/
  Y_SUN_COOL = 50 + Math.random() * 70;
  bubble(p, MON_SUNDAY_Y[Math.floor(Math.random() * MON_SUNDAY_Y.length)], 3.2);
}
if (typeof registerChapter2Hooks === 'function') {
  registerChapter2Hooks({ bizTick: yMondaySundayTalk });
}
