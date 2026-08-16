'use strict';

/* ============================================================
   ととのい市サウナバトル（第2章「ととのい市編」）
   ------------------------------------------------------------
   ・8部門・各100点。**持っていない部門は0点**
   ・ゴールはSAUNA GATE 37（開幕650点）を超えること
   ・**ライバルはプレイヤーの動きに反応して伸びる**（＝一度取った1位は、守らないと取り返される）
   設計は CHAPTER2_B.md §7
   ============================================================ */

/* ============ 自店の8部門スコアを測る ============
   毎日の実測から出す＝**設備を置けば上がり、汚せば落ちる。**
   数値はすべて叩き台。ここを触ればバランスが変わる                        */

/* いま使える設備を集める（壊れているものは数えない） */
function yEquips(cat) {
  return G.equip.filter(e => EQ[e.id] && EQ[e.id].cat === cat && (e.cond > 0 || EQ[e.id].cap === 0));
}
/* **どの階に置いたかで、効く部門が変わる**（作者指定 8/8）。
   同じソファでも、浴室に置けば🌤ととのい（裸で過ごす）、
   ラウンジに置けば🛋くつろぎ（館内着で過ごす）＝部門の定義そのまま。
   以前は `yEquips('rest')` が全階をまとめて数えていたので、
   浴室のととのいイスがくつろぎの点にもなり、ラウンジのマンガ棚がととのいの点にもなっていた */
function yEquipsOn(cat, floors) {
  const set = new Set(floors);
  return yEquips(cat).filter(e => set.has(e.f | 0));
}
const TOTONO_F_Y = [AY.OTOKO, AY.ONNA, AY.ROOF];   // 裸で過ごす階
const KUTSU_F_Y  = [AY.LOUNGE, AY.CAPSULE];        // 館内着で過ごす階

/* 質（q=1〜5）と傷み（cond）から、その設備の「効いている度合い」を出す */
function yPower(e) {
  const it = EQ[e.id]; if (!it) return 0;
  return (it.q || 1) * (0.4 + 0.6 * clamp((e.cond || 0) / 100, 0, 1));
}
function ySum(cat) { return yEquips(cat).reduce((s, e) => s + yPower(e), 0); }

/* 🔥サウナ ―― 台数だけでは天井が来る。**温度帯の違う部屋を持つ**と伸びる（作り分け） */
/* ============ 浴室は男湯50点＋女湯50点（作者決定 2026-08-10）============
   🔥サウナ・💧風呂と水風呂・🌤ととのい の3部門は、**階ごとに採って半分ずつ持ち寄る。**

   以前は全階を合算して100点満点だったので、**男湯だけ磨けば満点**が取れた＝
   3F女湯は「客がもう1人入れる」以外に建てる理由が無かった。
   半分ずつにすると、**両方を同じ水準にしないと部門1位は取れない**＝増築が番付に直結する。

   ⚠ **最初からこの形なので、3Fを建てて点が下がることは無い。**
     男湯だけの店はもともと50が天井＝女湯は足すだけの側にしかならない
     （くつろぎがラウンジを建てた瞬間に+45入るのと同じ考え方＝増築は必ず報われる）。
   ⚠ **解放の段には使わせない。** 上限が半分になると、部門55点以上を要求する品が
     3Fを建てるまで開かなくなる。3部門とも解放は鎖（UNLOCK_CHAIN_Y）に移してある。
   ⚠ ライバル5軒は男女とも揃っている設定なので、向こうの持ち点は0〜100のまま      */
function yBathFloorsY() {
  return [AY.OTOKO, AY.ONNA].filter(f => {
    const a = (CONF.areas || [])[f];
    return a && a.floor === 'bath';
  });
}
/* 男湯の素点×0.5 ＋ 女湯の素点×0.5。女湯がまだ無ければ、その半分は0のまま */
function yBathHalves(fn) {
  const m = clamp(fn(AY.OTOKO), 0, 100);
  const w = yBathFloorsY().includes(AY.ONNA) ? clamp(fn(AY.ONNA), 0, 100) : 0;
  return clamp(Math.round(m * 0.5 + w * 0.5), 0, 100);
}
function yScoreSauna() { return yBathHalves(ySaunaOn); }
function ySaunaOn(f) {
  /* **その浴室のサウナ＋屋上のテントサウナ**（作者決定 2026-08-13）。
     屋上は男女共用なので、置いた1張りは男湯の客も女湯の客も使う＝
     ととのいイス（yTotonoOn）と同じ数え方に揃える */
  const list = yEquipsOn('sauna', [f, AY.ROOF]);
  if (!list.length) return 0;
  const power = list.reduce((s, e) => s + yPower(e), 0);         // 質×傷み
  const bands = new Set(list.map(e => {
    const t = (e.temp != null ? e.temp : (EQ[e.id].temp || 90));
    return t < 75 ? 'mild' : t < 95 ? 'mid' : t < 105 ? 'hot' : 'gekiatsu';
  }));
  const seats = list.reduce((s, e) => s + (EQ[e.id].cap || 0), 0);
  /* 【サウナ専門家】＝講習に3回通って身につけた腕。室温も湿度も人に聞かなくていい */
  const skill = (typeof yHasSkill === 'function' && yHasSkill('senmonka')) ? 10 : 0;
  return clamp(Math.round(power * 9 + (bands.size - 1) * 12 + Math.min(seats, 24) * 0.8) + skill, 0, 100);
}
/* 💧風呂・水風呂 ―― **SAUNA GATE 37の唯一の穴（70点）。この章で最初に刺せる部門**
   水風呂が主（65点ぶん・温度の段を揃えるほど伸びる）、湯船が従（35点ぶん）。
   湯船を独立した部門にすると9部門になってライバルの持ち点と噛み合わないので、
   **同じ「水まわり」としてひとつに束ねた**（作者指定 8/8）                */
function yScoreMizu() { return yBathHalves(yMizuOn); }
function yMizuOn(f) {
  /* 水風呂は**その浴室＋屋上のかけ流し**（湯船は浴室だけ＝屋上に湯は張らない） */
  const cold = yEquipsOn('mizu', [f, AY.ROOF]), hot = yEquipsOn('furo', [f]);
  if (!cold.length && !hot.length) return 0;
  const band = (list, f) => new Set(list.map(f)).size;
  /* 水風呂が主（65点ぶん）。サウナ専門店なので、ここが本丸 */
  const cPow = cold.reduce((s, e) => s + yPower(e), 0);
  const cBand = band(cold, e => { const t = (e.temp != null ? e.temp : (EQ[e.id].temp || 15));
    return t < 12 ? 'single' : t < 15 ? 'mid' : 'warm'; });
  const cSeat = cold.reduce((s, e) => s + (EQ[e.id].cap || 0), 0);
  const c = cold.length ? (cPow * 6.5 + Math.max(cBand - 1, 0) * 9 + Math.min(cSeat, 10) * 1.3) : 0;
  /* 湯船は従（35点ぶん）。**ぬる湯・あつ湯・超あつ湯の三段**が揃うほど伸びる */
  const hPow = hot.reduce((s, e) => s + yPower(e), 0);
  const hBand = band(hot, e => { const t = (e.temp != null ? e.temp : (EQ[e.id].temp || 42));
    return t >= 44 ? 'gekiatsu' : t >= 41 ? 'atsu' : 'nuru'; });
  const hSeat = hot.reduce((s, e) => s + (EQ[e.id].cap || 0), 0);
  const h = hot.length ? (hPow * 2.6 + Math.max(hBand - 1, 0) * 7 + Math.min(hSeat, 12) * 0.5) : 0;
  return clamp(Math.round(c + h), 0, 100);
}
/* 🌤ととのい ―― **裸で過ごす時間**（ととのいイス・外気浴・屋上）。
   客の数に対してイスが足りているかが効く＝置くだけでなく「足りているか」  */
function yScoreTotono() { return yBathHalves(yTotonoOn); }
function yTotonoOn(f) {
  /* **その浴室のイス＋屋上のイス。** 屋上は男女共用なので、どちらの半分にも数える＝
     屋上に置いた1脚は、男湯の客も女湯の客も使う（実際そのとおり） */
  const list = yEquipsOn('rest', [f, AY.ROOF]);
  const seats = list.reduce((s, e) => s + (EQ[e.id].cap || 1), 0);
  if (!seats) return 0;
  const power = list.reduce((s, e) => s + yPower(e), 0);
  /* 要る席数は**その浴室に来る客ぶん**＝全体の見込みを、開いている浴室の数で割る */
  const guests = (G.today && G.today.guests) ? G.today.guests : 10;
  const need = Math.max(4, Math.round(guests * 0.35 / Math.max(1, yBathFloorsY().length)));
  const enough = clamp(seats / need, 0, 1.2);
  const roof = yBuilt(AY.ROOF) ? 18 : 0;                        // 屋上の夜景（最後の切り札）
  return clamp(Math.round(power * 6 + enough * 30 + roof), 0, 100);
}
/* 🍜飯 ―― **5Fレストランを建てるまで0点。**
   茶煙楼と松乃湯が0なので、ここは**いちばん取りやすい部門1位**       */
function yScoreMeshi() {
  if (!yBuilt(AY.SHOKUDO)) return 0;
  const kitchen = ySum('chubo') + ySum('shoku');
  const menus = ((G.ch2 && G.ch2.menuDev) || []).length;
  return clamp(Math.round(30 + kitchen * 6 + menus * 6), 0, 100);
}
/* 🧼清潔 ―― 汚れの累積と、人が足りているか。**深夜営業と正面から衝突する** */
function yScoreClean() {
  const dirt = (G.dirts || []).length;
  const staff = (G.staff || []).length;
  const night = (G.ch2 && G.ch2.night) || 0;
  return clamp(Math.round(85 - dirt * 4 + staff * 4 - night * 8), 0, 100);
}
/* 🛋くつろぎ ―― **館内着で過ごす時間**（休憩ラウンジ・マンガ・深夜滞在・カプセル）。
   全ライバルが60点以上を持っている＝**いちばん取りにくい部門**（SAUNA GATE 3790が壁） */
function yScoreKutsu() {
  let s = 0;
  /* **ラウンジ階とカプセル階に置いたものだけ**を数える（作者指定 8/8）。
     以前は全階の rest を数えていたので、浴室のととのいイスでくつろぎが上がっていた */
  const lounge = yEquipsOn('rest', KUTSU_F_Y).reduce((s, e) => s + yPower(e), 0);
  /* ラウンジ階を建てた時点で **45点**（35から。作者指定 8/8）＝
     くつろぎの品の解放は30〜38点から始まるので、35のままだと
     **ラウンジを建てたのに何も置けない一瞬**ができた。建てるという決断が大きい投資なので、
     見返りは即座にあっていい。この数字を下げるときは、`dept:'kutsu'` の品の段も一緒に見ること */
  if (yBuilt(AY.LOUNGE)) s += 45 + Math.min(lounge * 2, 25);         // 休憩ラウンジ＋そこに置いた品の質
  const night = (G.ch2 && G.ch2.night) || 0;
  s += night >= 1 ? 10 : 0;                                          // 深夜営業（翌2時）
  s += night >= 2 ? 15 : 0;                                          // オールナイト
  if (yBuilt(AY.CAPSULE)) s += 20;                                   // カプセル＝最後の上積み
  return clamp(Math.round(s), 0, 95);
}
/* ✨個性 ―― グッズ・世界観・熱波。**評判と、うちにしかないもの**で伸びる */
function yScoreKosei() {
  const goods = Object.keys((G.ch2 && G.ch2.goods) || {}).length;
  const nappa = (G.staff || []).some(s => s.pid === 'y_nappa') ? 12 : 0;
  const rare = yEquips('sauna').filter(e => (EQ[e.id].q || 1) >= 5).length * 8;
  return clamp(Math.round((G.rep || 0) * 0.5 + goods * 9 + nappa + rare), 0, 100);
}
/* 💴コスパ ―― **安さではなく「払った額に見合ったか」**（作者決定）。
   第1章の worthFee（客が納得する額）をそのまま物差しに使う＝
   **設備を入れれば、値上げしても点は落ちない**                            */
function yScoreCospa() {
  const fee = (G.opts && (G.opts.feeCustom || G.opts.fee)) || FEE_BASE;
  const worth = (typeof worthFee === 'function') ? worthFee() : FEE_BASE;
  const ratio = worth / Math.max(1, fee);        // 1.0＝値段ちょうど。1超＝お得
  return clamp(Math.round(50 + (ratio - 1) * 120), 0, 100);
}

/* 自店の8部門スコア */
function yMyScore() {
  return {
    cospa: yScoreCospa(), sauna: yScoreSauna(), mizu: yScoreMizu(), totono: yScoreTotono(),
    meshi: yScoreMeshi(), clean: yScoreClean(), kutsu: yScoreKutsu(), kosei: yScoreKosei(),
  };
}
function yTotal(sc) { return BATTLE_CATS_Y.reduce((s, c) => s + (sc[c.key] || 0), 0); }

/* ============ 番付 ============
   合計点で並べる。同点は**部門1位の数**で割る（CHAPTER2_B.md §13 ④）  */
function yRanking() {
  const mine = yMyScore();
  const rows = [{ id: 'mine', name: G.name || '俺のサウナ', score: mine, total: yTotal(mine), mine: true }];
  for (const r of RIVALS_Y) {
    const cur = ((G.ch2 && G.ch2.rivals) || []).find(x => x.id === r.id);
    const sc = cur ? cur.score : r.score;
    rows.push({ id: r.id, name: r.name, score: sc, total: yTotal(sc) });
  }
  // 部門1位の数（同点は頭割り）
  const firsts = {};
  for (const c of BATTLE_CATS_Y) {
    const top = Math.max(...rows.map(x => x.score[c.key] || 0));
    if (top <= 0) continue;
    const win = rows.filter(x => (x.score[c.key] || 0) === top);
    for (const w of win) firsts[w.id] = (firsts[w.id] || 0) + 1 / win.length;
  }
  for (const r of rows) r.firsts = firsts[r.id] || 0;
  rows.sort((a, b) => (b.total - a.total) || (b.firsts - a.firsts));
  rows.forEach((r, i) => r.rank = i + 1);
  return rows;
}
/* 番付1位との差。**目安であってゴールではない**（ゴールは大会優勝＝docs/SAUNA_BATTLE.md）。
   「王者」という言葉は大会優勝者にだけ使う（呼び分けの決まり）ので、ここでは使わない */
function yGapToBoss() {
  const rows = yRanking();
  const me = rows.find(r => r.mine);
  const top = rows.find(r => !r.mine);        // 自分以外の最上位（据え置きならSAUNA GATE 37650）
  return { me: me ? me.total : 0, boss: top ? top.total : 650, gap: (top ? top.total : 650) - (me ? me.total : 0) };
}

/* ============ ライバルの反撃 ============
   **一度取った1位は、放っておくと取り返される。**
   これがあると、番付が「眺めるもの」から「守るもの」に変わる（作者に好評）。

   2026-08-09 作り替え（壁打ち反映・docs/SAUNA_BATTLE.md）。
   旧仕様は「1位を取るたびSAUNA GATE 37が無限に+5〜10」＝**追いつくほどゴールが逃げる**
   ラバーバンドだった。新仕様の縛りは4つ：
     ・**部門ごとに1回だけ**
     ・**7営業日連続で1位**を取られて初めて動く
     ・**七日前に予告**が出る（日報の⚔欄。守り直す猶予がある）
     ・**総点は据え置き**＝配分を振り替えるだけ（+8のぶん、別の2部門が薄くなる）
   さらに**開催14日前で全ライバルのスコアが凍結**する（他4軒のじわ伸びも止まる）。

   1日の終わりに呼ぶ。起きることは2つ：
     ① SAUNA GATE 37の反撃（上の縛りつき）
     ② 他の店は自分の得意な部門をゆっくり伸ばす（穴は埋めない＝店の性格は変わらない） */
function yRivalStrikeBack() {
  const st = G.ch2; if (!st || !st.rivals) return null;
  const bday = yBattleDay();
  if (yJoining() && G.day >= bday - 14) return null;            // 凍結。以降スコアは動かない
  const sk = st.strike || (st.strike = { lead: {}, done: {}, pending: null });
  const rows = yRanking();
  const me = rows.find(r => r.mine); if (!me) return null;
  const log = [];

  // ① 予告済みの反撃が今日になった → 実行（総点据え置きの配分振り替え）
  if (sk.pending && G.day >= sk.pending.day) {
    const cat = sk.pending.cat;
    const tenku = st.rivals.find(r => r.id === 'tenku');
    const c = BATTLE_CATS_Y.find(x => x.key === cat);
    if (tenku && c) {
      const before = tenku.score[cat] || 0;
      const up = Math.min(8, 100 - before);
      // 引く側＝手を入れていない部門のうち高い2つから 3＋残り（店の性格は保ったまま薄くなる）
      const others = BATTLE_CATS_Y.map(x => x.key)
        .filter(k => k !== cat && (tenku.score[k] || 0) > 10)
        .sort((a, b) => (tenku.score[b] || 0) - (tenku.score[a] || 0));
      if (up > 0 && others.length >= 2) {
        tenku.score[cat] = before + up;
        const d1 = Math.min(3, up); tenku.score[others[0]] -= d1;
        const d2 = Math.min(up - d1, tenku.score[others[1]] || 0); tenku.score[others[1]] -= d2;
        log.push('SAUNA GATE 37が【' + c.icon + c.name + '】を作り替えてきた（' + before + '→' + tenku.score[cat] + '）。そのぶん、どこかが薄くなったらしい');
      }
      sk.done[cat] = true;                                      // この部門の反撃はこれきり
    }
    sk.pending = null;
  }

  // 連続1位の日数を数える（この関数は営業日の終わりにしか呼ばれない＝営業日ベース）
  for (const c of BATTLE_CATS_Y) {
    const myV = me.score[c.key] || 0;
    const top = myV > 0 && rows.every(r => r.mine || (r.score[c.key] || 0) < myV);
    sk.lead[c.key] = top ? (sk.lead[c.key] || 0) + 1 : 0;
  }

  // ① の予告（同時に1件だけ。凍結までに仕上がらないなら、もう動かない）
  if (!sk.pending) {
    const target = BATTLE_CATS_Y.find(c => (sk.lead[c.key] || 0) >= 7 && !sk.done[c.key]);
    if (target && G.day + 7 < bday - 14) {
      sk.pending = { cat: target.key, day: G.day + 7 };
      log.push('SAUNA GATE 37が【' + target.icon + target.name + '】の改装を届け出た。仕上がりは七日後らしい');
    }
  }
  // ② 負けている店は、自分の得意な部門をゆっくり伸ばす（総合力で押し返す）
  for (const r of st.rivals) {
    if (r.id === 'tenku') continue;
    if (Math.random() > 0.12) continue;
    const def = RIVALS_Y.find(x => x.id === r.id);
    const keys = BATTLE_CATS_Y.map(c => c.key).filter(k => (r.score[k] || 0) > 0 && (r.score[k] || 0) < 95);
    if (!keys.length) continue;
    // 得意なところをさらに伸ばす（穴は埋めない＝店の性格は変わらない）
    keys.sort((a, b) => (r.score[b] || 0) - (r.score[a] || 0));
    const k = keys[0];
    r.score[k] = clamp((r.score[k] || 0) + 2 + ((Math.random() * 3) | 0), 0, 100);
    if (def && Math.random() < 0.15) log.push(def.name + 'が少し良くなったらしい');
  }
  return log.length ? log : null;
}

/* 大会の締め＝SAUNA GATE 37を超えたか */
function yBattleResult() {
  const rows = yRanking();
  const me = rows.find(r => r.mine);
  return { rank: me ? me.rank : rows.length, rows, win: me ? me.rank === 1 : false };
}

/* ============================================================
   ととのい市サウナバトル 総合点（0〜100）
   ------------------------------------------------------------
   配点・式の出どころは docs/SAUNA_BATTLE.md（作者承認 2026-08-09）。
     通期実績30 ＝ 地力24 ＋ 収支6
     予選4戦20 ＝ 各5点（点差の段階制。実施は #42）
     市民投票20 ＝ 20 × √(常連 ÷ 400)
     最終戦30   ＝ 実体験18＋一般客8＋事故なし4（実施は #44）
   ⚠ 番付の8部門に常連数は入っていない（実測で確認）ので、
     地力＝番付合計そのままで市民投票と二重にならない。
   ============================================================ */
function yBattleState() {
  const c = G.ch2; if (!c) return null;
  return c.battle || (c.battle = {
    jiriki: [],      // 番付合計の日次記録（直近28営業日）→ 地力24
    profit: [],      // 利益の日次記録（直近28営業日）→ 収支
    revenue: 0,      // 通期の売上（利益率用）
    profitSum: 0,    // 通期の利益
    debtSnap: null,  // 開催14日前の純借金（駆け込み借金の二重カウント用）
    qual: [],        // 予選の結果 {no, rival, theme, my, base, pt} が4つ入る
    week: null,      // 進行中の予選週 {no, sum, n}
    news: [],        // 日報に出す大会のお知らせ（出したら空にする）
    final: null      // 最終戦の結果 {taiken, guests, jiko, total}（#44）
  });
}

/* ============ シーズン（作者決定 2026-08-13）============
   **大会は「その年の区切り」であって、ゲームの終わりではない。**
   120日目に結果が出て結末の一幕が流れ、**翌朝は普通に来る**＝店はいつまでも続く。
   次の大会はその120日後。2回目からは【出る／今回は見送る】を選べる＝
   のんびり5階まで作り込む遊び方が、そのまま成立する。

   数え方：`b.base` ＝ そのシーズンが始まった日。開催日も予選の週も、
   ぜんぶ base からの相対で決める（1シーズン目は base=0＝これまでと同じ日付）。 */
function yBattleBase() { const b = yBattleState(); return (b && b.base) | 0; }
function yBattleDay()  { return yBattleBase() + (CONF.battleDayY || 120); }
function ySeason()     { const b = yBattleState(); return Math.max(1, (b && b.season) | 0 || 1); }
/* 予選の週を、いまのシーズンの日付に直す */
function yYosenFrom(q) { return yBattleBase() + q.from; }
function yYosenTo(q)   { return yBattleBase() + q.to; }
/* このシーズンに出るか。1シーズン目は必ず出る（物語）。2回目からは開催14日前に聞く */
function yJoining() {
  const b = yBattleState(); if (!b) return true;
  if (ySeason() <= 1) return true;
  return b.join !== false;
}
/* 次のシーズンへ。ライバルは少しずつ伸びる（作者決定＝見送るほど優勝は遠くなる） */
function yNextSeason() {
  const b = yBattleState(); if (!b) return;
  b.base = yBattleDay();
  b.season = ySeason() + 1;
  b.final = null; b.notice = null; b.scoreSnap = null;
  b.qual = []; b.week = null; b.qnote = {};
  b.judgeCame = null; b.debtSnap = null; b.result = null; b.ending = null;
  b.join = null;                       // 出るかどうかは、また開催14日前に聞く
  b.asked = false;
  if (G.ch2 && G.ch2.strike) G.ch2.strike = { lead: {}, done: {}, pending: null };  // 反撃も仕切り直し
  yRivalsGrow();
  b.news = b.news || [];
  b.news.push('🗓 <b>次のととのい市サウナバトルは' + yBattleDay() + '日目。</b>'
            + '五名館も、この百二十日で腕を上げてくる');
}
/* シーズンが変わるたび、ライバルの番付が少しずつ伸びる。
   **弱い部門から埋めてくる**＝こちらが伸ばした部門で殴り合う形にはしない */
function yRivalsGrow() {
  const st = G.ch2; if (!st || !st.rivals) return;
  const up = 6 + ySeason();                                   // 1シーズンごとに合計これだけ伸びる
  for (const r of st.rivals) {
    let left = up;
    const keys = BATTLE_CATS_Y.map(c => c.key).sort((a, b2) => (r.score[a] || 0) - (r.score[b2] || 0));
    for (const k of keys) {
      if (left <= 0) break;
      const room = 100 - (r.score[k] || 0);
      const add = Math.min(left, Math.max(0, Math.min(4, room)));
      r.score[k] = (r.score[k] || 0) + add; left -= add;
    }
  }
}

/* ============ 予選4戦（docs/SAUNA_BATTLE.md）============
   各予選は7日間の「テーマ週」。期間中は通常営業に条件が加わり（清潔週＝汚れが速い／
   混雑週＝来客1.5倍）、週の終わりに**テーマ指標の期間平均**と**相手の基準値**を比べて
   点差の段階制（5/4/3/2/1・営業日ゼロなら0）で採点する。負けても進行は止まらない。 */
const YOSEN_Y = [
  { no: 1, from: 25, to: 31, rival: 'fukurai', theme: 'clean',   name: '清潔',     icon: '🧼' },
  { no: 2, from: 45, to: 51, rival: 'rakuen',  theme: 'crowd',   name: '混雑対応', icon: '🌊' },
  { no: 3, from: 65, to: 71, rival: 'hama',    theme: 'kosei',   name: '個性',     icon: '✨' },
  { no: 4, from: 85, to: 91, rival: 'lumina',  theme: 'service', name: '接客',     icon: '🌙' },
];
function yYosenNow() {
  if (!yJoining()) return null;                                // 見送ったシーズンは予選も無い
  return YOSEN_Y.find(q => G.day >= yYosenFrom(q) && G.day <= yYosenTo(q)) || null;
}

/* その日のテーマ指標（0〜100）。部門があるテーマは自分の部門点、
   混雑＝捌けた率（会計 ÷ (会計＋待ちきれず＋入れず)）、接客＝評判「おもてなし」×10 */
function yYosenMetric(q) {
  if (q.theme === 'clean') return yMyScore().clean || 0;
  if (q.theme === 'kosei') return yMyScore().kosei || 0;
  if (q.theme === 'crowd') {
    const t = G.today || {};
    const paid = t.paid || 0, lost = (t.gaveUp || 0) + (t.turnedAway || 0);
    return paid + lost > 0 ? 100 * paid / (paid + lost) : 0;
  }
  if (q.theme === 'service') return 10 * ((typeof repDayScores === 'function' && repDayScores().omote) || 0);
  return 0;
}
/* 相手の基準値。部門のあるテーマは相手のいまの部門点。無いテーマは店の看板の固定値 */
function yYosenBase(q) {
  const r = ((G.ch2 && G.ch2.rivals) || []).find(x => x.id === q.rival);
  if (q.theme === 'clean') return r ? (r.score.clean || 0) : 60;
  if (q.theme === 'kosei') return r ? (r.score.kosei || 0) : 90;
  if (q.theme === 'crowd') return 90;      // 混雑でも九割を捌く、が相手の看板
  if (q.theme === 'service') return 90;    // おもてなし九・〇が相手の看板
  return 50;
}
function yYosenPt(diff) { return diff >= 10 ? 5 : diff >= 0 ? 4 : diff >= -9 ? 3 : diff >= -19 ? 2 : 1; }

/* 週の判定。qual に積み、中間発表を news へ（日報が拾って表示する） */
function yYosenJudge(b) {
  const q = YOSEN_Y.find(x => x.no === b.week.no); if (!q) { b.week = null; return; }
  const def = (typeof RIVALS_Y !== 'undefined' ? RIVALS_Y : []).find(x => x.id === q.rival);
  const my = b.week.n > 0 ? Math.round(b.week.sum / b.week.n) : 0;
  const base = Math.round(yYosenBase(q));
  const pt = b.week.n > 0 ? yYosenPt(my - base) : 0;
  b.qual.push({ no: q.no, rival: q.rival, theme: q.theme, my, base, pt });
  b.week = null;
  const s = yBattleScore100();
  b.news.push('🏆 第' + q.no + '予選【' + q.icon + q.name + '】が終わった。うち ' + my
            + ' ─ ' + (def ? def.name : '相手') + ' ' + base + '　→ <b>+' + pt + '点</b>');
  const meR = yBattleStanding().find(r => r.mine);
  b.news.push('📣 サウナバトル総合点 ' + s.total + '点（暫定' + (meR ? meR.rank : '-') + '位／6軒）。'
            + 'ここから最大 ' + s.remain + '点まで積める。優勝予測ライン ' + yYosouLine() + '点前後');
  /* 実況テロップ（#47・GONIN_OWNERS.md「実況テロップ5本」）。
     その予選の相手オーナーの一言を、中間発表に混ぜる。
     神代の1本（点差もの）は最終戦の予告で流す＝5本を出す場所が全部埋まる */
  const telop = YOSEN_TELOP_Y[q.rival];
  if (telop) b.news.push('📺 実況席から——' + telop);
}

/* 大会実況の各オーナーの一言（GONIN_OWNERS.md の表。一字も変えない） */
const YOSEN_TELOP_Y = {
  fukurai: '鉄治「熱いだけじゃ駄目だ。客の顔を見ろ」',
  rakuen:  '美和子「ピーク来るよ。廊下は走らない！」',
  hama:    '玲華「香りは届きました。理由は、まだです」',
  lumina:  '澪「素敵ですね。三分待たせたこと以外は」',
};

/* ============ ライバル側の総合点（近似・ChatGPT実装相談 2026-08-09）============
   大会は全店リーグではなく**市全体のテーマ審査**。各予選で一軒だけが「基準施設」として
   主人公との公開対決を担当し、残りの店も裏で同じテーマの採点を受ける（結果だけ出る）。
   ライバルは実シミュレーションせず、番付8部門＋店ごとの固定値7個から近似する。 */
const RIVAL_BATTLE_Y = {
  //        収支6       地元支持(市民投票用)  予選プロフィール(テーマ×0〜5)                  一般客8      安全4
  tenku:   { shushi: 5.5, shiji: 100, yosen: { clean: 5, crowd: 4, kosei: 4, service: 5 }, guests: 5.4, anzen: 3.8 },
  fukurai: { shushi: 2.5, shiji: 400, yosen: { clean: 5, crowd: 2, kosei: 2, service: 4 }, guests: 5.7, anzen: 3.0 },
  rakuen:  { shushi: 4.3, shiji: 240, yosen: { clean: 4, crowd: 5, kosei: 2, service: 3 }, guests: 5.0, anzen: 3.6 },
  hama:    { shushi: 3.5, shiji: 80,  yosen: { clean: 4, crowd: 3, kosei: 5, service: 4 }, guests: 6.1, anzen: 3.8 },
  lumina:  { shushi: 4.8, shiji: 160, yosen: { clean: 5, crowd: 3, kosei: 3, service: 4 }, guests: 7.1, anzen: 4.0 },
};
/* 最終戦の「実体験18」＝8部門の加重平均。**いまの部門点**を読むので、
   神代の配分振り替え反撃がここに効く（総点は同じでも、大会で刺さる場所が変わる） */
const TAIKEN_W_Y = { cospa: .10, sauna: .18, mizu: .14, totono: .16, meshi: .10, clean: .14, kutsu: .12, kosei: .06 };

function yRivalBattleScore(id, opt) {
  const prof = RIVAL_BATTLE_Y[id]; if (!prof) return null;
  const cur = ((G.ch2 && G.ch2.rivals) || []).find(x => x.id === id);
  const sc = (cur && cur.score) || ((RIVALS_Y.find(x => x.id === id) || {}).score) || {};
  const total800 = BATTLE_CATS_Y.reduce((a, c) => a + (sc[c.key] || 0), 0);
  const jiriki = 24 * total800 / 800;
  const shimin = 20 * Math.sqrt(Math.min(400, prof.shiji) / 400);
  const b = yBattleState();
  let yosen = 0;
  for (const q of YOSEN_Y) {
    const done = b && b.qual.some(x => x.no === q.no);
    if (done || (opt && opt.predict)) yosen += prof.yosen[q.theme] || 0;
  }
  const taiken = 18 * BATTLE_CATS_Y.reduce((a, c) => a + (sc[c.key] || 0) * (TAIKEN_W_Y[c.key] || 0), 0) / 100;
  const fin = (opt && (opt.predict || opt.final)) ? taiken + prof.guests + prof.anzen : 0;
  return { total: Math.round((jiriki + prof.shushi + shimin + yosen + fin) * 10) / 10,
           jiriki, shimin, yosen, final: Math.round(fin * 10) / 10 };
}

/* 優勝予測ライン＝ライバル5軒の「最終予測総合点」の最大値（動的。固定表は調整時に嘘になる） */
function yYosouLine() {
  let mx = 0;
  for (const id in RIVAL_BATTLE_Y) {
    const s = yRivalBattleScore(id, { predict: true });
    if (s && s.total > mx) mx = s.total;
  }
  return Math.round(mx);
}

/* 暫定順位（実施済みの要素だけで6軒を並べる）。final:true で最終結果になる */
function yBattleStanding(opt) {
  const rows = [{ id: 'mine', name: G.name || '俺のサウナ', total: yBattleScore100().total, mine: true }];
  for (const id in RIVAL_BATTLE_Y) {
    const def = RIVALS_Y.find(x => x.id === id);
    rows.push({ id, name: def ? def.name : id, total: yRivalBattleScore(id, opt).total });
  }
  rows.sort((a, b) => b.total - a.total);
  rows.forEach((r, i) => r.rank = i + 1);
  return rows;
}

/* ============ 最終戦（開催日＝battleDayY。docs/SAUNA_BATTLE.md）============
   専用ミニゲームは作らない。**その日の営業の実測**で30点を採点する：
     実体験18 ＝ 客の平均満足度（審査員も同じ湯に浸かった、という建付け）
     一般客8  ＝ 捌けた率（会計 ÷ (会計＋待ちきれず＋入れず)）
     事故なし4＝ 4項目×1点。**乱数でなくプレイヤーの準備**に紐づく：
       ①壊れたままの設備が無い ②濃い汚れが残っていない
       ③サウナマットと垢すりタオルの置き場がある ④詰め込みすぎていない（帰した客5%以下）
   ライバルの30点は近似（yRivalBattleScore の final）。 */
function yFinalJudge(b) {
  const t = G.today || {};
  const sat = (t.satN || 0) > 0 ? clamp(t.satSum / t.satN, 0, 100) : 0;
  const taiken = Math.round(18 * sat / 100 * 10) / 10;
  const paid = t.paid || 0, lost = (t.gaveUp || 0) + (t.turnedAway || 0);
  const guests = Math.round(8 * (paid + lost > 0 ? paid / (paid + lost) : 0) * 10) / 10;
  const has = s => (G.equip || []).some(e => e.id && e.id.indexOf(s) >= 0 && e.cond > 0);
  const j1 = !(G.equip || []).some(e => e.dead || e.cond <= 0) ? 1 : 0;
  const j2 = (typeof oldDirtCount === 'function' ? oldDirtCount() : 0) === 0 ? 1 : 0;
  const j3 = has('matrack') && has('akarack') ? 1 : 0;
  const j4 = lost <= Math.max(2, paid * 0.05) ? 1 : 0;
  const jiko = j1 + j2 + j3 + j4;
  b.final = { taiken, guests, jiko, jikoParts: [j1, j2, j3, j4],
              total: Math.round((taiken + guests + jiko) * 10) / 10 };
  const rows = yBattleStanding({ final: true });
  const me = rows.find(r => r.mine);
  b.result = { rank: me ? me.rank : rows.length, rows: rows.map(r => ({ name: r.name, total: r.total, mine: !!r.mine })),
               win: me ? me.rank === 1 : false };
  b.news.push('🏁 最終戦の採点：実体験 ' + taiken + '/18・一般客 ' + guests + '/8・事故なし ' + jiko + '/4 ＝ <b>'
            + b.final.total + '/30</b>');
  b.news.push('🏆 最終結果：' + rows.slice(0, 3).map(r => r.rank + '位 ' + r.name + ' ' + r.total + '点').join('　'));
  /* エンディング種別はここで確定して保存（news の文言も種別で差し替える＝ENDINGS.md §4）。
     演出そのものは今夜の nightStory フック（ending_y.js）が流す */
  b.ending = { type: (typeof yEndingType === 'function') ? yEndingType(b) : (b.result.win ? 'win' : 'ninki') };
  b.news.push(b.result.win
    ? '👑 <b>ととのい市サウナバトル、優勝。</b>五名館の看板が、掛け替えられる——'
    : b.ending.type === 'haigyo' ? '📣 うちは' + b.result.rank + '位。……最後の夜になった'
    : b.ending.type === 'sanka'  ? '📣 うちは' + b.result.rank + '位。夜、神代から連絡が入った'
    : '📣 うちは' + b.result.rank + '位。店は明日も開く');
}

/* 1営業日の終わりに1回。番付と収支を記録し、予選週を集計する（rules_y.js の日報づくりから呼ぶ） */
function yBattleDaily() {
  const b = yBattleState(); if (!b) return;
  const rows = yRanking();
  const me = rows.find(r => r.mine);
  if (me) { b.jiriki.push(me.total); if (b.jiriki.length > 28) b.jiriki = b.jiriki.slice(-28); }
  b.profit.push((G.today && G.today.profit) || 0);
  if (b.profit.length > 28) b.profit = b.profit.slice(-28);
  b.profitSum += (G.today && G.today.profit) || 0;
  b.revenue += (G.today && G.today.revenue) || 0;
  /* 開催14日前の純借金を一度だけ写す。以降に増えた借金は二重に数える（使い捨て攻略対策）。
     古いセーブで通り過ぎていたら、気づいた日に写す（遅れても無いよりまし） */
  const bday = yBattleDay();
  if (b.debtSnap == null && yJoining() && G.day >= bday - 14) {
    b.debtSnap = Math.max(0, ((G.debt || 0) + ((G.yami && G.yami.debt) || 0)) - (G.cash || 0));
  }
  /* 予選週の集計。週が明けた最初の営業日に前の週を判定する */
  if (!b.news) b.news = [];                       // 旧セーブの穴埋め
  /* 予選の前ぶれ（#47）。開催前の最後の営業日に一度だけ＝最終戦の予告と同じ作り
     （前日が定休日だと G.day===from-1 の日報が無い）。
     第1予選だけ鉄治の一言つき（docs/SHISATSU_LINES.md「第1予選の前日・固定」。
     あさって告知に回った日は「明日」が嘘になるので、言葉だけ日に合わせる） */
  if (!b.qnote) b.qnote = {};
  for (const q0 of YOSEN_Y) {
    if (!yJoining()) break;                                  // 見送ったシーズンは予告も出さない
    const qFrom = yYosenFrom(q0);
    if (b.qnote[q0.no] || b.qual.some(x => x.no === q0.no)) continue;
    if (G.day < qFrom - 2 || G.day >= qFrom) continue;
    /* 明日が営業日なら、予告は明日の夜に譲る（＝なるべく前日に出す）。
       ⚠ **休みかどうかは `yClosedToday` に聞くこと。**以前ここは `yWeek()`（＝
         【営業】画面で選ぶ曜日の表・既定は火曜が休み）を見ていたが、実際の定休は
         `CONF.weekOff`＝**月曜**。前日が月曜の第4予選【接客】は
         「明日は営業日だから譲ろう」と誤判定→その明日は定休で日報が無く、
         **前ぶれが一度も出ないまま予選が始まっていた**（実測 8/14）           */
    if (G.day === qFrom - 2
        && (typeof yClosedToday === 'function' ? !yClosedToday(qFrom - 1) : true)) continue;
    b.qnote[q0.no] = true;
    const when0 = (G.day === qFrom - 1) ? '明日' : 'あさって';
    const def0 = (typeof RIVALS_Y !== 'undefined' ? RIVALS_Y : []).find(x => x.id === q0.rival);
    let t0 = '🗞 ' + when0 + 'から<b>第' + q0.no + '予選【' + q0.icon + q0.name + '】</b>。'
           + '相手は' + (def0 ? def0.name : 'ライバル') + '。七日間の期間平均で採点される';
    if (q0.no === 1) t0 += '<br>　鉄治「' + when0 + 'から七日だ。掃除くらい、今からやっとけ」';
    b.news.push(t0);
  }
  if (b.week && !(yYosenNow() && yYosenNow().no === b.week.no)) yYosenJudge(b);
  const q = yYosenNow();
  if (q && !b.qual.some(x => x.no === q.no)) {
    if (!b.week) {
      b.week = { no: q.no, sum: 0, n: 0 };
      const def = (typeof RIVALS_Y !== 'undefined' ? RIVALS_Y : []).find(x => x.id === q.rival);
      b.news.push('🏁 第' + q.no + '予選【' + q.icon + q.name + '】が始まった。相手は'
                + (def ? def.name : 'ライバル') + '。' + yYosenTo(q) + '日目まで');
    }
    b.week.sum += yYosenMetric(q); b.week.n++;
  }
  /* 最終戦の予告と本番。
     予告は「開催日前の最後の営業日」に一度だけ（119日目は月曜定休＝日報が無いので、
     G.day===bday-1 の判定は一度も発火しない。実質118日の夜＝壁打ち3回目）。
     予告時の総合点を b.scoreSnap に写し、**廃業/傘下の判定はこの値で行う**
     ＝「予告に出た点で審査される」がプレイヤーへの約束（ENDINGS.md §5） */
  if (yJoining() && !b.notice && !b.final && G.day >= bday - 2 && G.day < bday) {
    b.notice = true;
    b.scoreSnap = yBattleScore100().total;
    const when = (G.day === bday - 1) ? '明日' : 'あさって';
    b.news.push('🔥 ' + when + '、<b>ととのい市サウナバトル・最終戦</b>。審査員が朝・昼・夜に来店する。'
              + 'いまの総合点 ' + b.scoreSnap + '点／優勝予測ライン ' + yYosouLine() + '点前後');
    /* 神代の実況（#47・GONIN_OWNERS.md）。{差}は実数を差し込む */
    const gap = Math.abs(Math.round(yYosouLine() - b.scoreSnap));
    b.news.push('📺 実況席から——神代「現在、' + gap + '点差。まだ誤差ではありません」');
  }
  /* 開催日。出るなら採点、見送ったならそのまま次のシーズンへ（店は続く） */
  if (G.day >= bday) {
    if (!yJoining()) {
      b.news.push('🏁 ととのい市サウナバトルが終わった。今年は見送った＝'
                + '<b>うちの名前は番付に載らない</b>。次は' + (yBattleDay() + (CONF.battleDayY || 120)) + '日目');
      yNextSeason();
    } else if (!b.final) yFinalJudge(b);
  }
}

/* 通期実績30 ＝ 地力24 ＋ 収支6 */
function yScoreTsuuki() {
  const b = yBattleState();
  if (!b || !b.jiriki.length) return { jiriki: 0, debtPt: 0, ratePt: 0, p28Pt: 0, total: 0 };
  /* 地力24：直近28営業日の番付合計の平均。王者の650で満点。
     平均なので、最終日に設備を買っても 1/28 しか効かない（駆け込み対策） */
  const avg = b.jiriki.reduce((a, x) => a + x, 0) / b.jiriki.length;
  const jiriki = Math.min(24, 24 * avg / 650);
  /* 収支6 ＝ 借金返済能力4 ＋ 通期利益率1 ＋ 直近28営業日の黒字1。
     ヤミ金も負債に含める（含めないと「サラ金を借りるほど信用点が上がる」逆転が
     55点境界で起きる＝壁打ち3回目。影響は最大+0.3点程度） */
  const debtNow = Math.max(0, ((G.debt || 0) + ((G.yami && G.yami.debt) || 0)) - (G.cash || 0));
  const spike = b.debtSnap != null ? Math.max(0, debtNow - b.debtSnap) : 0;
  const hyoka = debtNow + spike;                       // 直前の借入増は二重に数える
  const p28 = b.profit.reduce((a, x) => a + x, 0);
  let debtPt = 0;
  if (hyoka <= 0) debtPt = 4;                          // 実質無借金
  else if (p28 > 0) {
    const M = hyoka / p28;                             // 直近28営業日の利益の何倍か
    debtPt = 4 * clamp((4 - M) / 3, 0, 1);             // M≤1で満点、M≥4で0点
  }                                                    // 赤字で借金あり＝0点
  const ratePt = b.revenue > 0 ? clamp((b.profitSum / b.revenue) / 0.15, 0, 1) : 0;
  const p28Pt = p28 > 0 ? 1 : 0;
  return { jiriki, debtPt, ratePt, p28Pt, total: jiriki + debtPt + ratePt + p28Pt };
}

/* 市民投票20 ＝ 20 × √(常連 ÷ 400)。逓減＝100人で10点・225人で15点・400人で20点 */
function yScoreShimin() {
  const max = CONF.regularMax || 400;
  const n = clamp(G.regulars || 0, 0, max);
  return 20 * Math.sqrt(n / max);
}

/* 予選20（各5点）。未実施のぶんは0のまま */
function yScoreYosen() {
  const b = yBattleState();
  return b ? b.qual.reduce((a, q) => a + (q.pt || 0), 0) : 0;
}

/* 最終戦30。未実施は0 */
function yScoreFinal() {
  const b = yBattleState();
  return (b && b.final) ? (b.final.total || 0) : 0;
}

/* サウナバトル総合点。remain＝残り獲得可能点（中間発表用）。
   予選は終わった戦の取り逃しだけが確定で消える。通期・市民は開催日まで動く */
function yBattleScore100() {
  const b = yBattleState();
  const t = yScoreTsuuki();
  const shimin = yScoreShimin();
  const yosen = yScoreYosen();
  const fin = yScoreFinal();
  const lost = b ? b.qual.reduce((a, q) => a + (5 - (q.pt || 0)), 0) : 0;
  const r1 = x => Math.round(x * 10) / 10;
  return {
    tsuuki: r1(t.total), jiriki: r1(t.jiriki), shushi: r1(t.debtPt + t.ratePt + t.p28Pt),
    shimin: r1(shimin), yosen: yosen, final: fin,
    total: r1(t.total + shimin + yosen + fin),
    remain: r1(100 - lost - (t.total + shimin + yosen + fin))   // 今からまだ取れる点
  };
}

/* ============================================================
   番付のページ（作者依頼 8/2）
   ------------------------------------------------------------
   【📊 データ】に【🏆 番付】タブを足す。**ライバル5軒と同じ物差しで、
   自分の店の8部門と合計が見られる。**
   ここが無いと「何を伸ばせばいいか」を数字で確かめる場所が無かった。

   ・**行ったことのない店の数字は伏せる**（visited で判定）＝偵察に意味を残す
   ・自分が部門1位なら 👑、最下位なら ▲ を付ける
   ・**番付は最初から出す**（作者決定 8/8）。伏せるのは行っていない店の**数字**だけ
   ============================================================ */
function yDataTabs() {
  return [['banzuke', '🏆 ライバル']];   // 中身はよその5軒との比べ（作者指定 8/2）
}

/* 8部門の1本＝名前・バー・点数（評判の rep-bar-row と同じ形にそろえる） */
function yBarRow(cat, val, tag) {
  const v = clamp(val | 0, 0, 100);
  const cls = v >= 80 ? 'ok' : v >= 60 ? 'mid' : v >= 35 ? 'low' : 'bad';
  return '<div class="rep-bar-row">'
       + '<span class="nm">' + cat.icon + ' ' + cat.name + (tag || '') + '</span>'
       + '<span class="bar"><i class="' + cls + '" style="width:' + v + '%"></i></span>'
       + '<span class="bv ' + cls + '">' + v + '</span>'
       + '</div>';
}

function yDataPane(tab) {
  if (tab !== 'banzuke') return null;
  const c = G.ch2 || {};
  const rows = yRanking();
  const me = rows.find(r => r.mine);
  const visited = c.visited || {};
  let h = '';

  /* **番付は最初から出す**（作者決定 8/8）。開業の動機が「あの大会で優勝する」なので、
     並びを伏せる理由が無い。伏せるのは**よその店の数字**だけ（行った店から埋まる）＝
     偵察に行く理由はそのまま残る。
     ⚠ 以前は「五軒すべてを回って話を聞くと、ここに並びが出る」という一枚を挟んでいたが、
       冒頭で大会を伝えるようにしたので消した（`battleKnown` は常に true）*/

  /* ── 5軒との比べ（行った店だけ数字を出す）── */
  /* 見出しは店名と順位だけ（作者指定 8/2）。タブが【🏆 ライバル】なので大会名は要らない */
  h += '<div class="opt-sec">' + (G.name || 'うち') + ' は ' + me.rank + '位 / ' + rows.length + '軒</div>';
  h += '<div class="banzuke-tbl"><table><thead><tr><th>店</th><th>合計</th>'
     + BATTLE_CATS_Y.map(x => '<th title="' + x.name + '">' + x.icon + '</th>').join('')
     + '</tr></thead><tbody>';
  for (const r of rows) {
    const seen = r.mine || visited[r.id];
    h += '<tr class="' + (r.mine ? 'me' : '') + '">'
       + '<td class="nm">' + r.rank + '　' + r.name + '</td>'
       + '<td class="tot">' + (seen ? r.total : '？') + '</td>'
       + BATTLE_CATS_Y.map(x => {
           if (!seen) return '<td>-</td>';
           const v = r.score[x.key] || 0;
           const top = Math.max(...rows.map(q => q.score[x.key] || 0));
           return '<td class="' + (v > 0 && v === top ? 'top' : '') + '">' + v + '</td>';
         }).join('')
       + '</tr>';
  }
  h += '</tbody></table></div>';
  // まだ行っていない店が残っているときだけ、伏せ字の説明を出す
  if (rows.some(r => !r.mine && !visited[r.id])) {
    h += '<div class="opt-sub">「？」は<b>まだ行っていない店</b>。休みの日に見に行くと数字が出る。</div>';
  }

  /* ── サウナバトル総合点（#47）──
     上の表は番付（800点＝地力の物差し）。こちらは**大会そのものの100点**。
     暫定順位は中間発表と同じ yBattleStanding（大会は公開情報なので伏せない） */
  const bs = yBattleScore100();
  const std = yBattleStanding();
  const meStd = std.find(r => r.mine);
  h += '<div class="opt-sec">🏆 サウナバトル総合点　<b>' + bs.total + '</b> / 100'
     + '（暫定' + (meStd ? meStd.rank : '-') + '位 / ' + std.length + '軒）</div>';
  const bRow = (nm, v, mx) => '<div class="rep-row"><span>' + nm + '</span><span class="v">'
                            + v + ' / ' + mx + '</span></div>';
  h += bRow('通期実績（地力＋収支）', bs.tsuuki, 30)
     + bRow('予選4戦', bs.yosen, 20)
     + bRow('市民投票（常連）', bs.shimin, 20)
     + bRow('最終戦', bs.final, 30);
  h += '<div class="opt-sub">優勝予測ライン <b>' + yYosouLine() + '点</b>前後／'
     + 'ここから最大 <b>' + bs.remain + '点</b>まで積める</div>';
  h += '<div class="opt-sub">' + std.map(r => r.rank + '位 '
     + (r.mine ? '<b>' + r.name + '</b>' : r.name) + ' ' + r.total).join('　') + '</div>';

  /* **SAUNA GATE 37との差はここに出さない**（作者指定 8/2）。
     表を見れば差は分かるし、外観画面の下帯にも出ている */
  return h;
}

/* ============================================================
   【🏮 評判】タブの中身＝**大会の8部門**（作者決定 8/2）
   ------------------------------------------------------------
   第1章の10項目（湯温・清潔・導線…）は、第2章では番付とほぼ同じことを
   別の言葉で言っているだけになる。**この章のチェックポイントは8部門のほう。**
   評判の数字（G.rep）は設備の解放や信金の枠に効き続けるので、1行だけ残す
   ============================================================ */
function yRepMain() {
  const rows = yRanking();
  const me = rows.find(r => r.mine);
  /* 8部門は最初から「勝負の物差し」（作者決定 8/8）＝冒頭で大会を伝えるようにしたので、
     「客がこの店をどう見ているか」という言い換えは要らなくなった */
  let h = '<div class="opt-sec">🏮 評判スコア　合計 ' + me.total + ' / 800</div>';
  for (const cat of BATTLE_CATS_Y) {
    const v = me.score[cat.key] || 0;
    const vals = rows.map(r => r.score[cat.key] || 0);
    const top = Math.max(...vals), bottom = Math.min(...vals);
    const tag = (v > 0 && v === top) ? ' 👑' : (v === bottom && top > bottom) ? ' ▲' : '';
    h += yBarRow(cat, v, tag);
    h += '<div class="opt-sub" style="margin:-2px 0 6px 2px">' + cat.note + '</div>';
  }
  /* **順位はここに出さない**（作者指定 8/2）＝【🏆 ライバル】タブの役目。
     このタブは「自分の店がどう見られているか」だけに絞る。
     ⚠ ここに「五軒すべて回ると並びが出る」の一行があったが、
       番付を最初から出すようにした日（8/8）に**変数 `known` だけ消して参照が残り、
       データ画面が丸ごと開かなくなっていた**（`known is not defined`）。
       案内そのものも要らなくなったので、行ごと落とした                    */
  /* ── 客の満足度（作者指定 8/2）────────────────────────
     **性別5分類×2。**男・女それぞれ小計を出してから、5行ずつ並べる。
     「まだ来ていない」と「来ているが満足していない」は別のものとして書く。
     **人数も「応えられている N/M」も出さない**（作者指定 8/5）＝
     ここで知りたいのは**点数と、何を見られているか**だけ。
     何人来たかは日報と【経営】の役目。どこまで応えられているかは点数そのものが語る */
  if (typeof segSatParts === 'function') {
    const all = segSatParts();
    h += '<div class="opt-sec">🧑‍🤝‍🧑 客の満足度<span class="opt-sub">　直近3日</span></div>';
    const block = (sex, icon, label, emptyWhy) => {
      const segs = all.filter(x => x.sex === sex);
      const got = segs.filter(x => x.n);
      const sum = got.reduce((a2, x) => a2 + x.avg * x.n, 0);
      const n = got.reduce((a2, x) => a2 + x.n, 0);
      const avg = n ? Math.round(sum / n) : null;
      const cls = avg == null ? '' : avg >= 75 ? 'ok' : avg >= 60 ? 'mid' : avg >= 45 ? 'low' : 'bad';
      let r = '<div class="rep-row"><span>' + icon + ' <b>' + label + '</b></span><span class="v ' + cls + '">'
            + (avg == null ? '<span class="opt-sub">' + emptyWhy + '</span>' : avg)
            + '</span></div>';
      for (const sg of segs) {
        /* **支持**＝その層の常連の頭数（作者決定 8/5）。満足して帰った新規で +1、
           がっかりして離れた常連で −1。この数字がそのまま**その層の来店数**になる＝
           点数を見るだけの表だったここが、初めて「明日の客」とつながる */
        const fan = (typeof ySegFanOf === 'function') ? ySegFanOf(sg.key) : 0;
        const mul = (typeof ySegMulOf === 'function') ? ySegMulOf(sg.key) : 1;
        const fanTxt = !G.ch2 ? ''
          : '<br>支持 <b>' + (fan > 0 ? '+' : '') + fan + '</b> 人'
            + '　▶ この層の来店 <b>×' + mul.toFixed(2) + '</b>'
            + (mul >= 1.3 ? '（掴んでいる）' : mul <= 0.75 ? '（離れていっている）' : '');
        if (!sg.n) {
          r += '<div class="rep-row sub"><span>　' + sg.name + '</span>'
             + '<span class="v opt-sub">まだ来ていない</span></div>';
          continue;
        }
        const v = sg.avg, c2 = v >= 75 ? 'ok' : v >= 60 ? 'mid' : v >= 45 ? 'low' : 'bad';
        r += '<div class="rep-bar-row">'
           + '<span class="nm">　' + sg.name + '</span>'
           + '<span class="bar"><i class="' + c2 + '" style="width:' + clamp(v, 0, 100) + '%"></i></span>'
           + '<span class="bv ' + c2 + '">' + v + '</span></div>'
           + '<div class="opt-sub" style="margin:-2px 0 6px 14px">' + sg.hint + fanTxt + '</div>';
      }
      return { html: r, avg, n };
    };
    const bm = block('m', '♂', '男性客', '—');
    const bf = block('f', '♀', '女性客', CONF.menOnly ? '女湯がまだ無い' : 'まだ来ていない');
    h += bm.html + bf.html;
    // 男女の差（この設計のいちばんの利点）
    if (bm.avg != null && bf.avg != null && Math.abs(bm.avg - bf.avg) >= 8) {
      const g2 = bm.avg - bf.avg;
      h += '<div class="opt-sub">▶ <b>' + (g2 > 0 ? '女性客' : '男性客') + 'のほうが' + Math.abs(g2) + '点低い。</b>'
         + (g2 > 0 ? 'アメニティ・ドライヤー・女性スタッフを見直す' : 'サウナ・水風呂・ととのいを見直す') + '</div>';
    }
    // いちばん低い層を名指しする
    const got = all.filter(x => x.n);
    if (got.length >= 2) {
      const low = got.slice().sort((x, y) => x.avg - y.avg)[0];
      const high = got.slice().sort((x, y) => y.avg - x.avg)[0];
      if (high.avg - low.avg >= 10) {
        h += '<div class="opt-sub">▶ <b>' + (low.sex === 'f' ? '女性の' : '男性の') + low.name
           + '</b>がいちばん低い（' + low.avg + '点）。' + low.hint + 'を見直す</div>';
      }
    }
  }

  /* ── 時間帯ごとの客 ──
     **出さない（作者指定 8/8）。** 読み物としては面白いが、
     ここで手を打てることが無く、8部門と番付の下に長い表が続くだけだった。
     計算そのもの（yHourTable / yHourGuests）は集客の心臓なので残してある     */

  /* 評判の総合スコアは出さない（作者指定 8/2）。
     上の8部門と二重に見えるうえ、100点満点と800点満点が並ぶと読みにくい。
     G.rep 自体は設備の解放と信金の枠に効き続ける（上のバーに出ている） */
  return h;
}

registerChapter2Hooks({ dataTabs: yDataTabs, dataPane: yDataPane, repMain: yRepMain });

/* ============ 設備の解放＝8部門スコア（作者決定 2026-08-08）============
   評判ひとつで開けていたときは、**2階建て・飯0点・くつろぎ0点・総合408/800（番付最下位）の店が、
   ゲートのある44品のうち41品を開けきっていた。** 評判の10項目は男湯だけで満点近くが取れる
   （実測 水風呂94・ととのい91・清潔81）ので、ビルの2/7しか建っていなくても評判48まで届く。
   プレミアムカプセル（くつろぎ0点の店）まで並んでいたのが、作者の指摘の発端。

   この章は「**伸ばした部門の設備が開く**」＝水風呂を良くするほど、いい水風呂が買える。
   どの部門を見るかは、その設備の cat で決まる（下の表）。          */
const UNLOCK_DEPT_Y = {
  sauna: 'sauna',      // 🔥サウナ室 → サウナの点
  mizu:  'mizu',       // 💧水風呂 → 水風呂の点
  rest:  'totono',     // 🌤イス・ラウンジの品 → ととのいの点
  chubo: 'meshi', shoku: 'meshi',        // 🍜厨房・食堂の品 → 飯の点
  capsule: 'kutsu',                      // 🛋カプセル → くつろぎの点
  locker: 'clean', wash: 'clean', datsui: 'clean', amenity: 'clean',   // 🧼脱衣所・洗い場 → 清潔の点
  etc:   'kosei',      // ✨アロマ・充電など「その他」 → 個性の点
  /* 湯船とフロントは部門になっていない。**店ぜんたいの格（8部門の合計・800点満点）**で開く。
     とくに靴箱は入館できる人数そのもの＝1部門の出来で閉じてはいけない器なので、ここに置く */
  front: 'total',   // 靴箱は入館できる人数そのもの＝1部門の出来で閉じてはいけない器
  furo:  'mizu',    // 湯船は💧風呂・水風呂の一部（2026-08-08 total から変更）
};
const UNLOCK_NAME_Y = { sauna: '🔥サウナ', mizu: '💧風呂・水風呂', totono: '🌤ととのい', meshi: '🍜飯',
                        clean: '🧼清潔', kutsu: '🛋くつろぎ', kosei: '✨個性', cospa: '💴コスパ',
                        total: '総合スコア' };
/* もとの「評判N」の段を、そのまま部門の段へ移す＝**何番目に開くかの順番は変えない**。
   total 列は800点満点なので別の目盛り                                       */
const UNLOCK_TIER_Y = {
  15: { d: 30, t: 200 }, 20: { d: 38, t: 240 }, 25: { d: 46, t: 280 },
  30: { d: 55, t: 330 }, 35: { d: 63, t: 380 }, 40: { d: 70, t: 430 },
  45: { d: 78, t: 480 }, 50: { d: 85, t: 530 }, 55: { d: 90, t: 570 },
  60: { d: 95, t: 610 },
};
/* 8部門の採点。**キャッシュしない**（2026-08-08）。
   いちど「日×設備の数×階数」を鍵にしたキャッシュを入れたが、**設備の数が変わらない変化を
   取りこぼす**＝修理して cond が戻っても、湯温を変えても、深夜営業を伸ばしても、
   メニューを開発しても、解放の判定が古いままになる。実際、G.equip を壊した状態でも
   同じ点を返し続けて、壊れていることに気づけなかった。
   採点は G.equip を数回なめるだけで、カタログ1画面ぶんでも数万回の演算にしかならない */
function yUnlockScores() { return yMyScore(); }
/* ============ 鎖の解放は「一度開いたら、開いたまま」============
   （プレイヤー報告 2026-08-14）
   「上位のイスで揃えようと思って、浴場の下位のイスを消したら、上位が買えなくなった」

   もとは**いま持っているか**だけを見ていたので、下位を売った瞬間に上位が閉じた。
   買い替えは自然な遊び方で、しかも**先に下位を撤去してから上位を買う**のは
   置き場所の都合でむしろ普通＝そこで詰む。

   これからは、次のどれかを満たせば開いたままにする。
     ・ひとつ前の品を、いま持っている（従来どおり）
     ・**一度でも開いたことがある**（`G.ch2.chainOK` に記録＝セーブに残る）
     ・その品自身、または**鎖のもっと先の品**を持っている
       （古いセーブの救済。上位を持てている＝下位は必ず通っている）        */
function yChainOpen(chainIds, i) {
  const c = G.ch2; if (!c) return false;
  const id = chainIds[i];
  const memo = (c.chainOK = c.chainOK || {});
  if (memo[id]) return true;
  const have = x => (G.equip || []).some(e => e.id === x);
  const ok = have(chainIds[i - 1])                        // ひとつ前を持っている
          || chainIds.slice(i).some(have);                // 自分か、もっと上位を持っている
  if (ok) memo[id] = true;                                // 開いた事実を残す
  return ok;
}
/* その設備の解放条件。ゲートの無い品は null（＝最初から買える） */
function yUnlockInfo(id, def) {
  if (!def) return null;
  /* 解放の鎖（サウナ・風呂・水風呂＝作者決定 8/9）。
     カタログの左から順＝**前の設備を1台でも置くと、次が開く**。
     部門スコア式は「スコアを上げる手段が解放待ちの設備自身」という循環で詰んでいた */
  if (def.chain && typeof UNLOCK_CHAIN_Y !== 'undefined') {
    const chainIds = UNLOCK_CHAIN_Y[def.chain] || [];
    const i = chainIds.indexOf(id);
    if (i <= 0) return null;                       // 鎖の先頭は最初から買える
    const prev = EQ[chainIds[i - 1]] || {};
    const ok = yChainOpen(chainIds, i);
    return { ok, label: '【' + prev.name + '】の次', chainPrev: chainIds[i - 1],
             lockText: '【' + prev.name + '】を設置すると仕入れられる' };
  }
  if (!def.rep) return null;
  /* `dept` を持つ品は、その部門で開く（ラウンジの品＝🛋くつろぎ など）。
     同じ cat でも置く階で性格が変わるものがあるため（作者指定 8/8） */
  const dept = def.dept || UNLOCK_DEPT_Y[def.cat] || 'total';
  const tier = UNLOCK_TIER_Y[def.rep] || { d: def.rep, t: def.rep * 8 };
  const sc = yUnlockScores();
  const now = (dept === 'total') ? yTotal(sc) : (sc[dept] || 0);
  const need = (dept === 'total') ? tier.t : tier.d;
  return { ok: now >= need, label: UNLOCK_NAME_Y[dept] + need, dept: dept, need: need, now: now };
}
/* 準備画面の「次の解放」＝**いちばん手が届きそうなもの**（不足点がいちばん小さい1品）。
   評判の一本道と違って部門ごとに進むので、「あと何点足りないか」で並べないと的外れになる */
function yNextUnlock() {
  let best = null, gap = Infinity;
  for (const id of Object.keys(EQ)) {
    const u = yUnlockInfo(id, EQ[id]);
    if (!u || u.ok) continue;
    const g = u.need - u.now;
    if (g < gap) { gap = g; best = EQ[id]; best.__u = u; }
  }
  return best;
}
function yNextUnlockText(d) {
  const u = d && d.__u ? d.__u : yUnlockInfo(Object.keys(EQ).find(k => EQ[k] === d), d);
  if (!u) return null;
  return `${UNLOCK_NAME_Y[u.dept]} <b>${u.need}</b> で【${d.name}】<span class="opt-sub">（いま ${Math.round(u.now)}）</span>`;
}

/* 上のバーに出す文字＝**8部門の総合スコア（800点満点）**（作者指定 8/8）。
   0-100の評判と0-800の番付スコアが2つ並んでいて、しかも設備の解放は800点側なので、
   どちらを見ればいいのか分からなかった。**この章は800点に一本化する。**
   （G.rep 自体は集客・料金の目安・信金の枠に効き続ける＝画面に出さないだけ） */
function yTopRep() {
  /* **絶対に空文字を返さない**（第1章セッションの指摘 8/8）。
     `chHook('topRep') || 従来の文字列` という受け方なので、'' を返すと `||` の右をすり抜けて
     上のバーに0-100の評判が復活する＝いちばん紛らわしい形になる。
     採点は G.equip などを見るので、初期化前や壊れた状態では例外もありうる。ここで受け止める */
  /* **初日から出す。7日間の「集計中」は無し**（作者指定 8/8）。
     8部門は10項目の評判と違って**日ごとの平均をとっていない**＝いま建っている物から
     その場で出している。だから初日から正しい数字が出るし、設備を置いた瞬間に動く。
     （評判0-100のほうは7日ならしなので `repCounting()` が要る。あれとは別物） */
  try {
    const t = yTotal(yMyScore());
    /* 呼称はUIの「ととのい番付」に統一（INTRO_SCRIPT.md 壁打ち3回目） */
    /* **大会までの日数を、番付の隣に常に出す**（プレイヤー報告 2026-08-13）＝
       「バトルのことをあまり考えていなかった。データ画面の下に小さく書いてあるだけで
       気づかなかった」。この作品の目的は大会なので、目的は上のバーに置く。
       見送ったシーズンは日数を出さない（急かす相手がいない） */
    const rank = '番付 ' + (Number.isFinite(t) ? t : 0) + '/800';
    const left = yBattleDay() - G.day;
    if (!yJoining()) return rank + '　🏆 見送り中';
    return rank + (left >= 0 ? '　🏆 あと' + left + '日' : '');
  } catch (e) { return '番付 —'; }
}

/* ============ 大会に出るか（2回目のシーズンから・作者決定 2026-08-13）============
   開催14日前＝ライバルのスコアが凍結する日に、一度だけ聞く。
   見送れば予選も最終戦も無く、店づくりだけの百二十日になる。
   1シーズン目は聞かない（そこは物語＝出るところから始まる）              */
function yAskJoin() {
  const b = yBattleState(); if (!b) return;
  if (ySeason() <= 1 || b.asked || b.join != null) return;
  if (G.day < yBattleDay() - 14 || G.day >= yBattleDay()) return;
  b.asked = true;
  if (typeof yAskChoice !== 'function') { b.join = true; return; }
  yAskChoice('ととのい市サウナバトル',
    '第' + ySeason() + '回の申し込みが来た。開催は<b>' + yBattleDay() + '日目</b>。<br>'
    + '<span class="opt-sub">出れば予選4戦と最終戦。見送れば、その百二十日は'
    + '店づくりに使える（順位も結末もつかない）。次の回でまた申し込める</span>',
    '出る', '今回は見送る', go => {
      b.join = !!go;
      if (typeof toast === 'function') toast(go ? '🏆 エントリーした' : '🏆 今回は見送った');
      if (typeof saveGame === 'function') saveGame();
    });
}

registerChapter2Hooks({
  unlockInfo: yUnlockInfo,
  nextUnlock: yNextUnlock,
  nextUnlockText: yNextUnlockText,
  topRep: yTopRep,
});

/* ============ 審査員の来店（#47）============
   最終戦の当日、審査員3人が朝・昼・夜に分かれて来店する（docs/SAUNA_BATTLE.md
   「3回来店の平均化」）。専用の行動AIは持たない＝**普通の客として湯を使う**
   （実体験18が「客の平均満足度」なのと同じ建付け。審査員も同じ湯に浸かった）。
   見た目だけ変える：部門担当ごとに色の違う帽子＋白い腕章＋クリップボード
   （描画は game.js drawCharBody の e.judgeCap ゲート＝第1章は誰も持たない）。
   一日の 1/3 ずつに区切り、その区間で最初に入館できた客を審査員に差し替える */
const JUDGE_SLOTS_Y = [
  { name: '朝の部', dept: '🧼 清潔・設備 担当', cap: '#e8e4da' },
  { name: '昼の部', dept: '🔥 体験 担当',       cap: '#2e4a78' },
  { name: '夜の部', dept: '🛋 くつろぎ・接客 担当', cap: '#6a4a7a' },
];
function yJudgeArrive(c) {
  if (!yJoining()) return;                                     // 見送ったシーズンに審査員は来ない
  const bday = yBattleDay();
  if (G.day < bday) return;
  const b = yBattleState(); if (!b || b.final) return;      // 採点が済んだら出ない
  const came = b.judgeCame || (b.judgeCame = [false, false, false]);
  const dayLen = Math.max(60, (closeHourNow() - openHourNow()) * 60);
  const slot = Math.min(2, Math.floor((G.minutes / dayLen) * 3));
  if (came[slot]) return;
  /* 子どもを審査員にしない（見た目が嘘になる）。次の大人を待つ */
  if (c.isChild) return;
  came[slot] = true;
  c.judgeCap = JUDGE_SLOTS_Y[slot].cap;
  if (typeof toast === 'function') {
    toast('⚖ 審査員が来店（' + JUDGE_SLOTS_Y[slot].name + '・' + JUDGE_SLOTS_Y[slot].dept + '）');
  }
}
registerChapter2Hooks({ arrived: yJudgeArrive });
