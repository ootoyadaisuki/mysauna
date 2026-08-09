'use strict';

/* ============================================================
   第2章の売上（作者指定 2026-08-06）
   ------------------------------------------------------------
   ここまでの第2章は、**建てた階が何も売っていなかった。**
   平均単価 ¥963／目標 ¥2,500。値付けの問題ではなく、
   説明文で約束していることに、金を受け取るコードが無かった。

   | 設備 | 説明文の約束 | それまで |
   |---|---|---|
   | 垢すり台 ¥90万 | 「専任の職人が要る。**ひとり¥3,000**」 | 1円も入らない |
   | マッサージ機 ¥30万 | 「**10分¥200**」 | 第1章の id 決め打ちで発火せず（→ game.js の isMassage で解決） |
   | 物販棚 ¥20万 | 「仕入れたタオルと石鹸から」 | 客が触らない |
   | よもぎ蒸し ¥48万 | 「女性専用・別料金で**ひとり¥3,500**」 | 1円も入らない |

   **売上を立てるのは、game.js の `useDone` フック1本**（設備を使い終わった瞬間）。
   共有コードには触らない＝第1章はこのファイルを読み込まないので、何も変わらない。
   ============================================================ */

/* その設備が「その役目」か。ID の名指しは章を跨ぐと壊れるので、
   CONF_Y.roleIds 経由で引く（game.js の hasRole / isMassage と同じ考え方） */
function yIsRole(role, id) {
  return (typeof roleIds === 'function') && roleIds(role, null).indexOf(id) >= 0;
}

/* ============ 垢すり（ひとり60分¥6,000・職人が要る）============
   作者指定 2026-08-08。**設備ではなく、人を売る商売**にする。

     ・台は¥10万と安い。**高いのは人のほう**
     ・その階に立っている【🧖 垢すり職人】が施術する。
       主人公でも、妻でも、バイトでもいい＝**誰が持っているかで店の回し方が変わる**
     ・ひとり60分¥6,000。**その60分、その人は他に何もできない**
       （番台にも立たないし、床も拭かない）
     ・職人は【🎓 講習を受ける】で、たまに生まれる（offday_y.js）

   ＝1時間まるごと人を売る。¥6,000は大きいが、その1時間は掃除も会計も止まる。
     **人が増えるまでは諸刃**で、増えて初めて「金のなる台」になる。

   ⚠ 台だけ置いて職人がいない日は、**1円も取らない**（取ると詐欺になる）。
     客の口から「職人、いないのか」と出る＝置いただけでは駄目だと分かる      */

/* 垢すり職人か。**持ち主が3種いる**ので、判定はここ1か所に集める */
function yIsAkaPro(e) {
  if (!e) return false;
  if (e.kind === 'player') return typeof yHasSkill === 'function' && yHasSkill('akasuriPro');
  if (e.isWife) return !!(G.ch2 && G.ch2.wifeAka);
  return !!(e.emp && e.emp.aka);
}
/* その階の職人を、主人公・妻・バイトの区別なく1つの列にする */
function yAkaProsOn(f) {
  const out = [];
  const p = G.player;
  if (p && (p.f | 0) === (f | 0) && yIsAkaPro(p)
      && !(typeof yAbsentToday === 'function' && yAbsentToday())) out.push(p);
  for (const s of (G.staff || [])) {
    if ((s.f | 0) !== (f | 0)) continue;
    if (s.isWife) { if (typeof yWifeGone === 'function' && yWifeGone()) continue; }
    else if (typeof workerHere === 'function' && !workerHere(s)) continue;
    if (yIsAkaPro(s)) out.push(s);
  }
  return out;
}
/* いま手の空いている職人（施術中の人は数えない） */
function yFreeAkaPro(f) { return yAkaProsOn(f).find(e => !(e.akaT > 0)) || null; }

/* ---- 客が台に乗った瞬間（game.js の useDur）----
   ここで職人をひとり押さえる。押さえられなければ、ただ寝るだけで終わる  */
function yAkasuriDur(c, item) {
  const f = item.f | 0;
  const pro = yFreeAkaPro(f);
  if (!pro) { c.akaNoPro = true; return 6; }        // 誰もいない＝6分で起き上がる
  c.akaNoPro = false;
  const min = CONF.akasuriMin || 60;
  pro.akaT = min;                                   // この60分、他のことをしない
  pro.akaFor = c;
  pro.task = null; pro.target = null; pro.path = null;
  /* 台のそばへ歩かせる（その場に突っ立ったまま60分は、絵として嘘になる）。
     ⚠ 経路は**その階の盤面**で引く。いま表示している階とは限らないので、
       yOnStaffPost と同じく applyArea で往復する                        */
  try {
    const back = G.actF;
    if (typeof areaCount === 'function' && areaCount() > 1) applyArea(f, true);
    const t0 = tileOf(pro), sp = approachTiles(item)[0];
    if (sp) pro.path = findPath(t0.x, t0.y, sp.x, sp.y) || null;
    if (typeof areaCount === 'function' && areaCount() > 1) applyArea(back, true);
  } catch (e) { pro.path = null; }
  return min;
}
/* ---- 施術中は他に何もしない（バイトと妻＝staffJob／主人公＝playerBusy）---- */
function yAkaBusy(e, dt) {
  if (!(e.akaT > 0)) return false;
  e.akaT -= dt;
  if (e.akaT <= 0) { e.akaT = 0; e.akaFor = null; e.task = null; return false; }
  e.task = 'akasuri'; e.target = null;
  if (e.path && e.path.length && typeof stepMove === 'function') stepMove(e, dt);
  if (!e.bub && Math.random() < 0.02 * dt)
    bubble(e, pick(['はい、うつ伏せで', 'よく温まってますね', '……力、抜いてください']));
  return true;
}
registerChapter2Hooks({ staffJob: (s, dt) => yAkaBusy(s, dt),
                        playerBusy: (p, dt) => yAkaBusy(p, dt) });

function yAkasuriDone(c, item) {
  if (c.akaNoPro) {
    c.akaNoPro = false;
    c.sat -= 2;
    if (!c.bub) bubble(c, pick(['職人、いないのか', '誰もいないな…', '垢すり、やってないのか']), 3.2);
    return;
  }
  const price = CONF.akasuriPrice || 6000;
  G.cash += price;
  G.today.revenue += price;
  G.today.akasuriRev = (G.today.akasuriRev || 0) + price;
  G.today.akasuriN = (G.today.akasuriN || 0) + 1;
  if (typeof addFloater === 'function') addFloater(c.px, c.py - 22, '+' + yen(price));
  c.sat += 16;                                   // 60分と¥6,000ぶんの手応え
  if (!c.bub) bubble(c, pick(['垢すり、最高だな', '肌が生まれ変わった', 'これ目当てで来てる']), 3.2);
}

/* ============ よもぎ蒸し（女性専用・ひとり¥3,500）============
   ラウンジの個室。`womenOnly` は EQ_Y 側に書いてあるが、
   game.js は womenOnly を見ないので、**男が座っても止まらない**。
   ここで「女性客のときだけ課金する」＝男が入っても金は取らない        */
function yYomogiDone(c, item) {
  if (!c.type || c.type.sex !== 'f') return;
  const price = CONF.yomogiPrice || 3500;
  G.cash += price;
  G.today.revenue += price;
  G.today.amenRev += price; G.today.amenN++;
  if (typeof addFloater === 'function') addFloater(c.px, c.py - 22, '+' + yen(price));
  c.sat += 10;
  if (!c.bub) bubble(c, pick(['体の芯からあったまる', 'これ、効くわ…', 'また来ようかな']), 3.2);
}

/* ============ 物販（帰りがけに買う）============
   `y_goods`（物販棚）＝仕入れたタオルと石鹸。`y_ice`（アイスの冷凍ケース）も同じ棚として扱う。
   ⚠ **サウナハット掛け（y_hat）は廃止した**（作者指定 8/8）。
     「掛けてあると3割が¥3,500のハットを買う」という分岐がここにあったが、設備ごと消したので
     物販は一律 `goodsPrice` になる。復活させるなら data_y.js の EQ_Y と roleIds の両方が要る。 */
function yGoodsDone(c, item) {
  /* アイスの冷凍ケースは**専用の単価**（作者指定 8/8）。説明文どおり「単価は安い」。
     物販棚は ¥1,000／¥2,000／¥3,000 から抽選＝タオル1枚か、Tシャツか、ハットか */
  const ice = item && item.id === 'y_ice';
  const price = ice ? (CONF.icePrice || 200) : pick(CONF.goodsPrices || [1000, 2000, 3000]);
  G.cash += price;
  G.today.revenue += price;
  G.today.amenRev += price; G.today.amenN++;
  if (typeof addFloater === 'function') addFloater(c.px, c.py - 22, '+' + yen(price));
  c.sat += ice ? 2 : 3;
  if (!c.bub) bubble(c, ice ? pick(['ガリガリ君、いくか', '風呂上がりのアイスは正義', '当たり出ないかな'])
    : price >= 3000 ? pick(['サウナハット、買っちゃった', 'ここのTシャツ、いいな'])
    : price >= 2000 ? pick(['Tシャツもらっとくか', 'ロゴ入り、意外と悪くない'])
    : pick(['タオル1枚もらうよ', '石鹸も買っとくか']), 3.0);
}

/* ============ ラウンジの延長料金（作者決定 8/6）============
   4F休憩ラウンジは**時間で課金する**（CHAPTER2_B.md §5「滞在時間＝売上」）。
   入館料に含めず、**30分ごと**に別で取る＝「回転より単価へ」という階の性格が値段に出る。

   `ext`（延長率）は EQ_Y の各設備が持っている値で、
   「その設備があると、どれだけ長く居座るか」。**候補1から連れてきたまま
   一度も使われていなかった**（data_y.js の注意書き）ので、ここで初めて効かせる。 */
function yLoungeExt() {
  let ext = 0;
  for (const e of (G.equip || [])) {
    if ((e.f | 0) !== AY.LOUNGE || e.cond <= 0) continue;
    ext += (EQ[e.id] || {}).ext || 0;
  }
  return ext;
}
function yLoungeDone(c, item) {
  const unit = CONF.extendFeeUnit || 30;                 // 何分ごとに取るか
  const fee = (G.opts && G.opts.extendFee) || 0;
  if (!fee) return;
  /* 居座った時間＝席の予定時間。ラウンジの設え（ext）が良いほど長居する */
  const stay = (c.use && c.use.dur) || 0;
  const mins = stay * (1 + yLoungeExt());
  const units = Math.max(1, Math.round(mins / unit));
  const take = units * fee;
  G.cash += take;
  G.today.revenue += take;
  /* ⚠ 日報の収入合計は `closeDay` が**決まった枠から作り直している**ので、
     新しい枠（extRev）だけに入れると、金は増えるのに日報に出ない。
     数えるのはこちら（内訳を出すため）、合計に載せるのは既存の枠（amenRev）  */
  G.today.extRev = (G.today.extRev || 0) + take;
  G.today.extN = (G.today.extN || 0) + units;
  G.today.amenRev += take; G.today.amenN++;
  if (typeof addFloater === 'function') addFloater(c.px, c.py - 22, '+' + yen(take));
  /* 気持ちよく延長したぶんは満足、取りすぎれば不満。
     **¥1,000を超えると、客は「高い」と言い出す**（入館料の目安と同じ考え方） */
  c.sat += take <= 1000 ? 4 : -Math.min(10, Math.round((take - 1000) / 200));
  if (take > 1000 && !c.bub) bubble(c, pick(['延長、高いな…', '長居しすぎたか']), 3.0);
}

/* ============ カプセル（1泊いくら・作者指定 8/6）============
   **終電を逃した客が、そのまま泊まっていく。**
   深夜営業（22時〜翌10時）の上に載る階＝翌10時をチェックアウトにしてあるので、
   深夜の終わりとそのまま噛み合う（CHAPTER2_B.md §11-16 の逆算）。

   **泊まる客は、最初から泊まるつもりで来る**（作者指定 8/6）。
   値段は寝床ごと（EQ_Y の `stay:`）＝二段¥2,500／プレミアム¥9,000

   ⚠ 前は「深夜に着替えた客の25%」だった。**それが全部を殺していた。**
     泊まるかを聞くのは着替えた瞬間の一度きりなので、21時に着替えた客は
     23時にまだ館内にいても泊まれない＝終電を逃すという動機が起きない。
     実測：22時の館内に47人いて、そのうち泊まるか聞かれたのは0人。
     45床に対して3日で1泊。**寝床が問題なのではなく、聞いていなかった。**  */
/* いま寝られる数（壊れている寝床は数えない） */
function yBedN() {
  return (G.equip || []).filter(e => (e.f | 0) === AY.CAPSULE
      && EQ[e.id] && EQ[e.id].cat === 'capsule' && e.cond > 0)
    .reduce((a, e) => a + (EQ[e.id].cap || 0), 0);
}
/* その客が泊まる確率。**評判に連れて 1%→10%**（CONF_Y.stayRepMin/Max）。
   ・遠征サウナー ×2.5／観光客 ×3.0（宿代わり）／飲んだ帰り ×2.0（終電）
   ・近所の年寄り ×0.1（歩いて帰る）／子連れは泊まらない
   倍率は客層ごとに TYPES_Y の `stayMul` で持たせてある                    */
function yStayRateOf(c) {
  const t = c.type || {};
  if (t.withKid) return 0;
  const lo = CONF.stayRepMin != null ? CONF.stayRepMin : 0.008;
  const hi = CONF.stayRepMax != null ? CONF.stayRepMax : 0.080;
  let rate = lo + clamp(G.rep || 0, 0, 100) / 100 * (hi - lo);
  rate *= (t.stayMul || 1);
  if (t.elder) rate *= 0.1;                                    // 近所の年寄りは帰る
  return rate;
}
/* 閉店（翌10時）まで、あと何分あるか */
function yMinsLeft() {
  const close = (typeof closeHourNow === 'function') ? closeHourNow() : 34;
  return (close - yOpenHour()) * 60 - (G.minutes || 0);
}
/* **泊まる客が来るのは深夜2時まで**（作者指定 2026-08-07）。
   終電を逃した客も、この時刻までには入ってくる。
   3時に入ってきて「今夜は泊まる」は、朝まで7時間しかないので宿ではない。

   ここを見ずに予約を取っていたころは、翌4時の客まで寝床を1つ押さえてしまい、
   **8床が“来ない客”で埋まって宿泊0件**だった（→ §11-32）。 */
const STAY_LAST_HOUR_Y = 26;          // 26時＝深夜2時
function yStayTimeOK() {
  const last = CONF.stayLastHour != null ? CONF.stayLastHour : STAY_LAST_HOUR_Y;
  return (yOpenHour() + (G.minutes || 0) / 60) < last;
}

function yCanStay(c) {
  if (!G.ch2 || c.isChild) return false;
  if (!(G.opts && G.opts.nightOpen)) return false;             // 朝までやっていない日は泊まれない
  if (!catExists('capsule')) return false;
  if (!yStayTimeOK()) return false;                            // 深夜2時を過ぎたら、もう泊まらない
  /* **寝床より多くは受けない。**満室の店に「泊まるつもり」の客を作ると、
     その客は寝床を探して館内をさまよったあげく不満だけ残して帰る       */
  if (((G.today.stayBooked) | 0) >= yBedN()) return false;
  if (Math.random() >= Math.min(yStayRateOf(c), 0.8)) return false;
  G.today.stayBooked = ((G.today.stayBooked) | 0) + 1;
  return true;
}
function yCapsuleDone(c, item) {
  const price = (EQ[item.id] || {}).stay || CONF.stayPrice || 3500;
  G.cash += price;
  G.today.revenue += price;
  G.today.stayRev = (G.today.stayRev || 0) + price;
  G.today.stayN = (G.today.stayN || 0) + 1;
  G.today.amenRev += price; G.today.amenN++;      // 日報の収入合計に載せる（上と同じ理由）
  if (typeof addFloater === 'function') addFloater(c.px, c.py - 22, '+' + yen(price));
  /* 寝床の格がそのまま手応えになる（二段は少し窮屈、キャビンは静か） */
  c.sat += Math.min(14, Math.round(price / 700));
  if (!c.bub) bubble(c, pick(['助かった、終電なくてさ', 'ここで寝られるのはでかい', '朝風呂も入って帰るか']), 3.2);
}
/* ============ 寝息（作者指定 2026-08-06）============
   館内案内図に「その階の客の声」を出すようにしたら、**カプセル階だけが無言**になった。
   14人が泊まっているのに、外から見ると誰も居ないビルに見える。
   寝ている客は喋らないので当然だが、**泊まっている人がいることは見せたい**。
   ＝寝息を、たまに一つ。声が出る階のひとつとして数えられる                */
const SLEEP_LINES_Y = ['…すぅ', '……zzz', 'ぐぅ…', '（寝返りをうつ）', '……ん'];

/* ============ チェックアウト（作者指定の宿泊を、実際に精算まで届かせる）============

   ⚠ **30日回して見つけた（2026-08-07）。宿泊料金が一度も入っていなかった。**
   予約199件・宿泊0件・売上¥0。カプセル階が丸ごと死んでいた。

   原因は**20分のずれ**。`yStayDur` は「閉店の20分前に起きる」長さを返すが、
   その長さが決まるのは**寝床を決めた瞬間**で、実際に横になるのは
   エレベーターで6階へ上がって寝床の前まで歩いたあと＝**20〜25分あと**。
   タイマーはそこから動き出すので、**起きるのは閉店の数分後**になる。
   実測：閉店（1141分）の時点でタイマーが 6 残っていた。
   一歩も間に合わず、`finishUse` が呼ばれず、`yCapsuleDone`（＝会計）も走らない。

   歩く時間は先に読めないので、**時計のほうから起こす**。
   閉店30分前になったら、まだ寝ている客を全員起こす（会計まで歩く時間ぶん）。 */
const CHECKOUT_LEAD_Y = 30;

function yCapsuleCheckout() {
  if (G.phase !== 'biz') return;
  if (yMinsLeft() > CHECKOUT_LEAD_Y) return;
  for (const c of G.customers) {
    if (c.use && c.use.cat === 'capsule' && c.state === 'using' && c.timer > 0) c.timer = 0;
  }
}

function yCapsuleSleepTick(dt) {
  if (G.phase !== 'biz') return;
  yCapsuleCheckout();
  for (const c of G.customers) {
    if (!c.use || c.use.cat !== 'capsule' || c.state !== 'using') continue;
    /* ⚠ 「吹き出しを持っていたら黙る」だけにすると、**一人も寝息を立てない。**
       泊まる客は風呂→飯→寝床と歩いてくるので、寝床に入った時点で
       まだ湯上がりの台詞（「足の裏まで脈打ってる」）を抱えている。
       **いまの階で言ったものだけ**を「喋っている最中」と見なす            */
    if (c.bub && (c.bub.f | 0) === (c.f | 0)) continue;
    // ひとりにつき、およそ50分に一度。泊まりが15人いれば3分に一度は寝息がする
    if (Math.random() < 0.02 * dt) bubble(c, pick(SLEEP_LINES_Y), 4.0);
  }
}

/* 寝ている時間。**閉店（翌10時）まで**＝チェックアウトまで席を空けない。
   ここを短くすると、泊まったのに夜中に出ていく客になる                     */
function yStayDur(c, item, cat, dur) {
  if (typeof yShokuUseDur === 'function') {          // 食堂の席（待てる限界）
    const d = yShokuUseDur(c, item, cat, dur);
    if (d !== undefined) return d;
  }
  /* 垢すりは**60分。**ここで職人をひとり押さえる（yAkasuriDur） */
  if (yIsRole('akasuri', item.id)) return yAkasuriDur(c, item);
  if (cat !== 'capsule') return undefined;
  const close = (typeof closeHourNow === 'function') ? closeHourNow() : 34;
  const left = (close - yOpenHour()) * 60 - (G.minutes || 0);
  return Math.max(30, left - 20);            // 20分前に起きて、朝風呂へ
}

/* ============ 受け口（game.js の finishUse の最後）============ */
function yUseDone(c, item, cat) {
  if (!G.ch2 || !c || !item) return;
  /* 5F食堂は別ファイル（shokudo_y.js）が受け持つ。**フックは1つしか登録できない**ので、
     ここから渡す＝どちらか一方しか動かない、という事故を起こさない */
  if (typeof yShokuUseDone === 'function' && yShokuUseDone(c, item, cat)) return;
  if (yIsRole('akasuri', item.id)) { yAkasuriDone(c, item); return; }
  if (yIsRole('yomogi', item.id))  { yYomogiDone(c, item); return; }
  if (yIsRole('goods', item.id))   { yGoodsDone(c, item); return; }
  /* 延長料金は**4Fにある席**なら取る。
     ⚠ `cat` で判定してはいけない：ここに渡ってくるのは**設備の種類**（'rest'）で、
        予定の名前（'lounge'）ではない。cat === 'lounge' と書いて一度も発火しなかった。
     マッサージチェアは席そのものに¥100を入れているので、時間では二重に取らない */
  if ((item.f | 0) === AY.LOUNGE && !isMassage(item.id)) { yLoungeDone(c, item); return; }
  if ((EQ[item.id] || {}).cat === 'capsule') { yCapsuleDone(c, item); return; }
}

/* ============ 客の寄り道を足す（game.js の buildPlan の最後）============
   **背骨（風呂→ととのい→飯）には触らない。**足すだけ。
   垢すりだけは洗い場の直後に差し込む＝裸のうちに済ませる                  */
function yPlanExtra(c, plan, st) {
  if (!G.ch2 || c.isChild) return;

  /* ── 垢すり。**頼む人だけ**（全員に¥3,000は取れない）──
     台が cat:'wash' なのでカランと同じ枠で取り合っていた＝1日1件しか出なかった。
     予定として持たせて、洗い場のあとに回す                               */
  if (catExists('akasuri') && Math.random() < (CONF.akasuriRate || 0.12)) {
    const i = plan.findIndex(p => p[0] === 'wash');
    plan.splice(i >= 0 ? i + 1 : 0, 0, ['akasuri', st(2, 4)]);
  }

  /* ── ラウンジでくつろぐ。**いちばん最後**（湯上がり・館内着）──
     ここに来る客が延長料金を落とす＝4Fが「売上のある階」になる           */
  if (catExists('lounge') && Math.random() < (CONF.loungeRate || 0.4)) {
    plan.push(['lounge', st(6, 12)]);
  }

  /* ── 物販。**帰りがけ**なので、いちばん後ろ ── */
  if (catExists('goods') && Math.random() < yGoodsRate(c)) {
    plan.push(['goods', 1.2]);
  }

  /* ── 泊まる。**いちばん最後**（風呂も飯も済ませてから寝る）──
     ここが立つと、その客は翌10時のチェックアウトまで帰らない            */
  if (yCanStay(c)) plan.push(['capsule', 0]);
}
/* 買っていく確率は客層で違う。若者・サウナー・観光客はよく買い、老人は買わない */
function yGoodsRate(c) {
  const base = CONF.goodsRate || 0.18;
  const t = c.type || {};
  if (t.elder) return base * 0.4;
  if (c.wantsSauna) return base * 1.6;
  if ((t.age && t.age[1] <= 25)) return base * 1.4;
  return base;
}

/* ============ 日報の内訳（rules_y.js の yDayReportExtra から）============
   `closeDay` の収入欄は**決まった枠から作り直している**ので、この章で足した売上は
   「ドライヤー等」に混ざって1行になる。それでは何が効いたのか分からないので、
   ここで**この階が今日いくら稼いだか**を、階ごとに並べ直す。
   （合計は上の欄が正しい。ここは内訳の読み物）                             */
function yUriageRows() {
  const t = G.today; if (!t) return '';
  const rows = [];
  const add = (icon, label, n, unit, yenv) => {
    if (!n) return;
    rows.push('<div class="rep-row">' + icon + ' ' + label
      + '<span class="opt-sub">　' + n + unit + '</span>　' + yen(yenv) + '</div>');
  };
  add('🧖', '垢すり',   t.akasuriN || 0, '人', t.akasuriRev || 0);
  add('🛏', '宿泊',     t.stayN || 0,    '泊', t.stayRev || 0);
  add('🛋', '延長料金', t.extN || 0,     'コマ', t.extRev || 0);
  /* 5F食堂だけは**出ていくぶんも並べる**。板前の日給と皿の原価は
     日報の上のほうでは「返済・税」にまとめて入ってしまうので、
     ここで名前を付けて出しておかないと、儲かっているのか分からない */
  const wage = (typeof yItamaeWage === 'function') ? yItamaeWage() : 0;
  const cost = t.menuCost || 0;
  if (t.menuRev || wage) {
    rows.push('<div class="rep-row">🍜 食堂の粗利'
      + '<span class="opt-sub">　' + (t.menuN || 0) + '皿　売上' + yen(t.menuRev || 0)
      + ' − 板前' + yen(wage) + ' − 原価' + yen(cost) + '</span>　'
      + yen((t.menuRev || 0) - wage - cost) + '</div>');
  }
  if (!rows.length) return '';
  return '<div class="rep-row"><b>― この階が稼いだぶん ―</b></div>' + rows.join('');
}

registerChapter2Hooks({ useDone: yUseDone, planExtra: yPlanExtra, useDur: yStayDur });
