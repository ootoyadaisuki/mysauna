'use strict';
/* ============================================================
   エンディング5種（第2章「ととのい市編」・#46）
   ------------------------------------------------------------
   台本 = docs/ENDINGS_SCRIPT.md（S級判定済・壁打ち3往復）
   分岐・発火・数値 = docs/ENDINGS.md §1〜§5
   ・発火 = nightStory フック（game.js の afterCareOK 内）。判定日+1 の夜に一度だけ
   ・「真」の表記は画面に出さない（shin も画面上は優勝の続き）
   ・廃業のみタイトルへ（G.flags.ended='haigyo'＋btnContinue で再開抑止）
   ============================================================ */

/* ---- ED種別の判定（ENDINGS.md §1。判定は上から） ---- */
function yEndingType(b) {
  const w = (typeof yWife === 'function') ? yWife() : {};
  const dateSum = Object.values((G.ch2 && G.ch2.dateBeen) || {}).reduce((a, x) => a + x, 0);
  /* 絆＝デート合計2 または 日単位ネット（rules_y.js の yWifeAnswer が数える） */
  const kizuna = dateSum >= 2 || ((w.stoppedDays || 0) >= (w.pushedDays || 0));
  if (b.result && b.result.win) return (b.profitSum > 0 && kizuna) ? 'shin' : 'win';

  /* ============ 敗北側の分け方（2026-08-09 作り替え）============
     **借金の「額」では分けない。「払えているか」で分ける。**

     ⚠ 前の版は `純借金（残債−現金）≥1,000万` を廃業の条件にしていた。
       だがビルの借入5,000万（CONF.startDebt）は**7年返済**で、120日では
       ほとんど減らない＝**誰も条件から抜けられない**。
       120日の通しプレイで実測：現金1,583万・通期利益558万・直近28日も黒字・
       客134人／日・6位で完走した店が「廃業」になった。
       あれは経営に失敗した店ではなく、**優勝しなかっただけの店**だった。

     いまの分け方：
       廃業 … 支払いを落とした／次の支払いが払えない（＝本当に続けられない）
       傘下 … 払えてはいるが**借り増して**ここまで来た。神代は数字を見て買う
       人気店 … 自力で回っている（借金があっても、返せているなら店は続く）      */
  const bill  = (typeof yBillLines === 'function') ? yBillLines().total : 0;   // 1か月の固定費
  const p28   = (b.profit || []).reduce((a, x) => a + x, 0);                   // 直近28営業日の利益
  const yami  = (G.yami && G.yami.debt) || 0;
  const score = (b.scoreSnap != null) ? b.scoreSnap : yBattleScore100().total;

  /* ⚠ **廃業は、もう大会の評価では出さない**（作者決定 2026-08-13）。
     ここで判定していたころは、30日目に一度支払いを落としただけで
     （`billMissed` は永久に消えない印だった）、そのあと90日どれだけ立て直しても
     120日目の結末が廃業で確定していた＝**潰れた店ではなく、つまずいた記録が残った店**が
     「あなたの店は終わりました」と言われていた（プレイヤー報告 8/13）。
     いまの廃業は yBankrupt()＝**本当に現金が尽きて、灰田の枠も尽きた夜**だけ。
     支払いを落としたことは、信用金庫の門が閉じるという形でちゃんと効いている。   */

  /* 傘下＝開業時より借金が増えている（借り増した）うえで、買う価値のある数字がある */
  const borrowed = (G.debt || 0) + yami - (CONF.startDebt || 0);
  if (borrowed > 0 && score >= 55) return 'sanka';

  return 'ninki';
}

/* ---- 台本（ENDINGS_SCRIPT.md を組み立て関数で。const配列にしない＝条件行があるため） ---- */
function yEndingScenes(type) {
  const WIFE = (typeof WIFE_Y !== 'undefined' && WIFE_Y.name) || '奈津';
  const N = t => ({ narr: true, text: t });
  const S = (sp, t) => ({ sp, text: t });

  /* 優勝の五場面（クセ崩れ＝GONIN_OWNERS.md の聖域。一字も変えない） */
  const winScenes = [
    { art: 'y_five_town', lines: [
      N('熱波銀座。五軒ぶんの提灯の下、発表を待つ人だかり。'),
      N('会場の隅で、鉄治がレンチを仕舞った。'),
      N('空いた両手を、一度握って、開いた。'),
      S('鉄治', '……春江なら、あんたらの店に通ったろうな'),
      N('それだけ言って、背を向けた。'),
      N('妻が頭を下げる。鉄治は、振り返らなかった。'),
    ] },
    { art: 'y_five_town', lines: [
      N('インカムが鳴る。『社長、十五番ロッカー——』'),
      S('美和子', 'そっちは任せる'),
      N('耳に当てた手を下ろして、こちらを見た。'),
      S('美和子', 'あなたたち、ちゃんと続けたね'),
    ] },
    { art: 'y_five_town', lines: [
      S('司会', '優勝——『' + (G.name || '俺のサウナ') + '』'),
      N('拍手の中、玲華が茶缶を手に取る。——蓋は、開けない。'),
      S('玲華', '確かめる必要はありません。優勝は、お二方です'),
      N('玲華が茶缶を仕舞う。'),
      S('玲華', '……私が通うかどうかは、別の話ですが'),
      N('妻が吹き出した。玲華は真顔のままだった。'),
    ] },
    { art: 'y_five_town', lines: [
      S('澪', '素晴らしい営業でした'),
      N('澪が、会場受付のタオルを、一枚だけ直す。'),
      S('澪', 'こちら以外は'),
      N('——でも、少し笑う。'),
    ] },
    { art: 'y_five_town', lines: [
      N('最後に、神代が来た。'),
      S('神代', '看板の掛け替えは、手配済みです。——六名館、と'),
      N('タブレットの画面を、消す。'),
      S('神代', '数字はもう十分です。お二人の勝ちです'),
      N('消えた画面に会場の灯が映っていた。一礼して、去る。'),
    ] },
  ];

  if (type === 'win') {
    /* 翌朝の看板＝win単体のみの独立場面（shinでは出さない＝余韻を看板で潰さない） */
    winScenes.push({ art: 'y_five_town', lines: [
      N('翌朝——熱波銀座の看板は「六名館」になっていた。'),
    ] });
    return winScenes;
  }

  if (type === 'shin') {
    /* 残債3分岐（判定=名目G.debt。完済分岐は現行ビルド到達不能＝将来の繰上返済への保険） */
    const debt = G.debt || 0;
    const debtLine =
      (debt <= 0 && !(G.yami && G.yami.debt > 0)) ? '借金、先月で終わってたよ。言ってなかったっけ'
      : debt > 50000000 ? 'これ、担保にならないね'
      : '五千万、まだ残ってるけどね';
    return winScenes.concat([
      /* 絵は#47の描き下ろし（S級審査済・rival_art_y.js） */
      { art: 'y_night_road', lines: [
        N('祝賀の声を断って、二人で歩いて帰った。'),
        S(WIFE, '六名館かあ。うち、いちばん新入りの看板だね'),
        N('優勝旗が、街灯の下で揺れた。'),
        S(WIFE, debtLine),
        N('優勝旗は妻が持った。持たせてくれなかった。'),
      ] },
      { art: 'y_bandai_night', lines: [
        N('誰もいない店。のれんは、しまい忘れたことにした。'),
        N('妻が番台に座る。閉店後に座るのは、初めてだった。'),
        S(WIFE, 'ここから、ぜんぶ見えるんだよ。知ってた？'),
        N('がらんどうだった箱に、湯気の匂いが染みている。'),
        S(WIFE, 'ねえ。最後のお客さん、まだ間に合う？'),
      ] },
      { art: 'y_my_bath_night', lines: [
        N('湯を張った。客のいない風呂に、二人で入った。'),
        N('肩まで沈む。百二十日ぶんの息が、ひとつ出た。'),
        S(WIFE, '……いい湯'),
        N('湯気の向こうで、妻が笑っている。'),
        S(WIFE, '明日も、開けよう'),
        N('返事の代わりに、湯を——少しだけ、揺らした。'),
      ] },
    ]);
  }

  if (type === 'ninki') {
    const winner = (yBattleState() && yBattleState().result && yBattleState().result.rows[0]) || {};
    return [
      { art: 'y_five_town', lines: [
        N('読み上げられたのは、「' + (winner.name || 'よその店') + '」の名だった。'),
        N('妻は番台の鍵を握ったまま、最後まで拍手をしていた。'),
        N('帰り道、二人とも優勝の話をしなかった。'),
      ] },
      { art: 'y_my_front_morning', lines: [
        N('翌朝。開店前の店の前に、列ができていた。'),
        S('常連', '惜しかったなあ。……いや、言うのやめた'),
        S('常連', '優勝してたら混むとこだった'),
        N('列のうしろから、別の声がした。'),
        S('常連', '新聞に載ってたぞ。市長より写りが良かったな、番台の奥さん'),
        N('妻がシャッターを上げる。列が、順に頭を下げていく。'),
      ] },
      /* この常連は場面2のA〜Cとは別人＝絵の中では先頭の「札を掲げる男」がそれ */
      { art: 'y_my_front_morning', lines: [
        N('ひとり、列を離れて番台の前に立った。下足札を、目の高さに掲げて見せた。'),
        S('常連', '昨日の、続き。——いや、返さねえほうがいい気がしてな'),
        S('常連', '王者の店より、毎日開いてる店だ。俺の風呂は、ここだ'),
        N('常連は札を握り直して、のれんをくぐっていった——。'),
      ] },
    ];
  }

  /* 買収に判を捺した夜（【売る】を選んだときだけ流す。ここで店は人手に渡る） */
  if (type === 'sanka_sold') {
    return [
      { art: 'y_bandai_night', lines: [
        N('判を捺した夜。雨は、まだ降っていた。'),
        N('妻が番台の台を拭いている。'),
        S(WIFE, '明日も、ここに座っていい？'),
        N('番台の灯は——消さなかった。'),
      ] },
    ];
  }

  /* 断ったとき（作者決定 2026-08-13）。
     ⚠ **台詞は作者確認済み（2026-08-13）＝勝手に整えない。** */
  if (type === 'sanka_kept') {
    return [
      { art: 'y_bandai_night', lines: [
        N('傘を開いて帰る背中に、返事をした。'),
        S('俺', 'うちは、売らない'),
        N('神代は振り返らなかった。傘の下で、一度だけ頷いたように見えた。'),
        S(WIFE, '……言っちゃったね'),
        S(WIFE, 'じゃあ、来年も勝ちにいかなきゃ'),
        N('番台の灯を落とす。明日も、この店は開く——。'),
      ] },
    ];
  }

  if (type === 'sanka') {
    return [
      { art: 'y_tenku_out', lines: [
        N('雨の日に、神代は一人で来た。'),
        S('神代', '看板は残します。名前は、変わりますが'),
        N('妻は番台から動かずに、契約の話を聞いている。'),
        S('神代', 'サインは急ぎません。数字は、待っても同じです'),
        S('神代', '番台は、そのままで構いません。数字に影響しませんので'),
        N('こちらが答える前に、神代は傘を開いて帰った。'),
      ] },
    ];
  }

  /* ── 屋上が建った夜（作者指定 2026-08-13）──
     エンディングではない。**増築の完成そのものがご褒美**なので、優勝しなくても必ず見られる。
     外気ベイの向こうに花火（絵＝rival_art_y.js の y_roof_hanabi）。
     地名は架空のまま＝**実在の地名は出さない**（作者決定）。
     ⚠ **台詞は作者確認済み（2026-08-13）＝勝手に整えない。** */
  if (type === 'roof') {
    return [
      { art: 'y_roof_hanabi', lines: [
        N('最後の階が、載った。'),
        N('工事の幕が外れた夜、二人で上がってみた。'),
        N('手すりの向こう、外気ベイの観覧車が回っている。'),
        S(WIFE, '……あ'),
        N('湾の上に、花火が上がった。'),
        S(WIFE, '今日、花火の日だったんだ'),
        N('風が抜ける。湯上がりでもないのに、少しだけ、ととのった気がした。'),
        S('俺', 'ここ、いい店だな'),
        S(WIFE, '……うちの店だよ'),
        N('もう一発、上がった。二人とも、しばらく黙って見ていた——。'),
      ] },
    ];
  }

  /* haigyo（このままタイトルへ。「つづける」は出さない）
     絵の靴箱＝40枠にひと枠だけ空＝「最後の札が還る枠」（S級審査済の仕込み） */
  return [
    { art: 'y_bandai_night', lines: [
      N('靴箱の靴を、全部返した夜だった。'),
      N('四十の枠に、札が三十九。ひと枠が、空のままだった。'),
      N('がらんどうに戻った箱に、湯気の匂いが残っている。'),
      N('番台に灯がひとつ。妻が、帳面を最後まで付けている。'),
      N('帳面の最後の頁だけ、数字が赤いままだった。'),
    ] },
    { art: 'y_bandai_night', lines: [
      N('戸を叩く音。最後の客が、立っていた。'),
      S('客', 'これ、返しそびれてた'),
      N('差し出された手のひらに、下足札がひとつ。'),
      S('客', 'ここの熱さは、よそじゃ出なかったよ'),
      S('客', 'また、どこかで'),
      N('札を受け取る。木の札は、まだ温かい。'),
      N('靴箱の欠けたひと枠に、最後の札が収まった。'),
      N('番台の灯を、妻が落とす——。'),
    ] },
  ];
}

/* ---- 廃業（作者決定 2026-08-13）----
   **本当に手が無くなった夜だけ、店は終わる。**
   1日の締めで、地代も返済も生活費も払い、灰田の枠（上限100万）まで自動で借りて、
   それでも現金がマイナス＝もう明日を開けられない。
   大会の順位も、支払いを落とした過去も、ここには関係しない            */
function yBankrupt() {
  return (G.cash || 0) < 0 && !(G.flags && G.flags.ended);
}

/* ---- 発火（nightStory フック）----
   ・その夜に流すものを、ここで決める：①廃業 ②大会（シーズン）の結末
   ・truthy を返すと game.js は enterPrepPhase を呼ばない（＝翌朝を作らない）
     ⇒ 返すのは**廃業のときだけ**。大会の結末は「その年の区切り」なので、
       翌朝はいつもどおり来る（作者決定 8/13）                                 */
function yNightStory() {
  /* ① 廃業。大会より先に見る（払えない夜に順位の話をしても仕方がない） */
  if (yBankrupt()) {
    G.flags.ended = 'haigyo';
    if (typeof saveGame === 'function') saveGame();       // prepへ進まないため、ここで保存
    Story.play(yEndingScenes('haigyo'), () => {
      if (typeof returnToTitle === 'function') returnToTitle();
    });
    return true;
  }

  /* ② 屋上が建った夜の一幕（一度だけ。増築のご褒美＝優勝しなくても見られる） */
  if (G.ch2 && G.ch2.roofNight) {
    G.ch2.roofNight = false;
    Story.play(yEndingScenes('roof'), () => { if (typeof saveGame === 'function') saveGame(); });
    return false;                                        // 翌朝は、いつもどおり来る
  }

  /* ③ 大会の結末（そのシーズンの結末。店は明日も開く） */
  const b = (typeof yBattleState === 'function') ? yBattleState() : null;
  if (!b || !b.final) return;
  if (b.ending && b.ending.played) return;
  if (!b.ending) b.ending = { type: yEndingType(b) };     // 旧セーブ＝現在値で再判定（甘め許容）
  b.ending.played = true;
  const type = b.ending.type;
  Story.play(yEndingScenes(type), () => {
    /* 5周前提の救済（作者決定 8/9）＝匂わせの一行だけ。
       ギャラリーも条件開示もしない——偶然たどり着いた結末は、その人のもの */
    if (typeof toast === 'function') toast('📖 この街の結末は、全部で五つある——');
    /* 傘下＝神代の申し出。**売るか、断るか**をここで聞く（作者決定 8/13）。
       売れば、その結末で店は人手に渡って終わる。断れば、店は続く              */
    if (type === 'sanka') { yAskKamishiro(); return; }
    if (typeof yNextSeason === 'function') yNextSeason();
  });
  return false;                                          // 翌朝は、いつもどおり来る
}

/* ---- 神代の申し出（買収）に答える ---- */
function yAskKamishiro() {
  yAskChoice('神代', '「看板は残します。名前は、変わりますが」<br>'
    + '<span class="opt-sub">売れば、この店は神代のものになる（ここで物語は終わる）。'
    + '断れば、店はこのまま続く</span>',
    '判を捺す（売る）', '断る', sold => {
      if (sold) {
        G.flags.ended = 'sanka';
        if (typeof saveGame === 'function') saveGame();
        Story.play(yEndingScenes('sanka_sold'), () => {
          if (typeof returnToTitle === 'function') returnToTitle();
        });
        return;
      }
      Story.play(yEndingScenes('sanka_kept'), () => {
        if (typeof yNextSeason === 'function') yNextSeason();
      });
    });
}

/* ---- 2択を聞く小さな器（妻のモーダルを借りる）----
   専用の画面を増やさない。答えは rules_y.js の yWifeAnswer が、
   この待ち行列を先に見て呼び返してくれる                                    */
let Y_CHOICE = null;
function yAskChoice(title, html, yes, no, cb) {
  Y_CHOICE = cb;
  document.getElementById('wifeName').textContent = title;
  document.getElementById('wifeLine').innerHTML = html;
  document.getElementById('btnWifeGo').textContent = yes;
  document.getElementById('btnWifeNo').textContent = no;
  document.getElementById('wifeModal').classList.remove('hidden');
}
/* 答えが来た（yWifeAnswer から）。器を元の妻の文言に戻す */
function yChoiceAnswer(go) {
  const cb = Y_CHOICE; if (!cb) return false;
  Y_CHOICE = null;
  document.getElementById('wifeModal').classList.add('hidden');
  document.getElementById('btnWifeGo').textContent = 'それでも、やる';
  document.getElementById('btnWifeNo').textContent = '……やめておく';
  cb(!!go);
  return true;
}

/* ---- 「つづきから」（btnContinue から chHook('continueLoaded')）----
   ・廃業セーブ＝タイトル残留（再開抑止）
   ・旧セーブ（b.final済み・ED未再生）＝画面を出してから再判定して再生   */
/* ---- タイトルに出す一言（game.js の syncTitleStart から、セーブの中身を渡される）----
   廃業で終わったセーブは【つづきから】を出さない。
   **押しても何も起きないボタンは、故障にしか見えない**（プレイヤー報告 2026-08-13＝
   「つづきからを押しても反応しない。もしやゲームオーバー？」）。
   もとは toast で伝えていたが、**toast は #game-ui の中にある**＝
   タイトルでは器ごと隠れていて、一度も表示されていなかった。
   結末のあとに出していた「五つある」の一行も、同じ理由で誰にも見えていない       */
function ySaveNote(d) {
  const end = d && d.flags && d.flags.ended;
  if (!end) return null;
  const head = end === 'sanka'
    ? 'この店は、神代のものになった。'
    : 'この店は、灯を落とした。';
  return head + '<br>——【はじめから】で、次の店を。<br>'
       + '<span class="ended-hint">📖 この街の結末は、全部で五つある——</span>';
}

function yContinueLoaded() {
  if (G.flags && G.flags.ended === 'haigyo') {
    if (typeof toast === 'function') toast('この店の百二十日は、終わった。——【はじめから】で、次の店を');
    return true;
  }
  const b = (typeof yBattleState === 'function') ? yBattleState() : null;
  if (b && b.final && !(b.ending && b.ending.played)) {
    document.getElementById('title').classList.add('hidden');
    document.getElementById('game-ui').classList.remove('hidden');
    enterPrep();
    yNightStory();
    return true;
  }
  return false;
}

if (typeof registerChapter2Hooks === 'function') {
  registerChapter2Hooks({ nightStory: yNightStory, continueLoaded: yContinueLoaded, saveNote: ySaveNote });
}
