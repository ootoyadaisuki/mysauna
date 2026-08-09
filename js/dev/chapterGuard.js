'use strict';

/* ============================================================
   章の見張り（開発用・配信ビルドには読み込まれない）
   ------------------------------------------------------------
   第1章・第2章・これから増える第3章…が、**自分の知らないうちに
   書き換わっていないこと**を機械に見張らせる。

   ── なぜ要るか ──
   どの章も同じ game.js を共有している。ある章のために1行足すと、
   別の章の描画や計算にも届いてしまう。実際に起きた事故が3件ある。

     ・浴室の上壁から屋号の看板を外したら、**第1章の「夕凪湯」の看板も消えた**
     ・prepHint の判定を変えたら、第1章の案内が別のものに差し替わった
     ・areaClosedWhy を書き忘れて、**第2章のフック42本がまるごと消えた**

   1件目と2件目は、たまたま画面を見ていたから気づいた。
   3件目は、客の入りがおかしいのを追いかけて半日かかった。
   **どれも、見ていなければ通っていた。**

   ── 何を見張るか ──
   章ごとに指紋を4つ取って、控えてある基準値と突き合わせる。ひとつでも違えば落とす。

     ① データの指紋 … CONF・EQ・TYPES・料金表…（CHAPTERS[n].data() の全部）
                       data.js / data2.js を書き換えた瞬間に落ちる
     ② 見た目の指紋 … 各区画を、時刻を固定して描いてピクセルを数える
                       看板が消えた・壁の色が変わった、が落ちる
     ③ 動きの指紋   … 乱数を固定して、条件を変えて1日ずつ営業し、
                       客数・売上・収支・満足度を記録
     ④ フックの指紋 … その章に生えているフックの名前を並べる
                       第2章のフックが第1章に漏れた／第2章のフックが消えた、が落ちる

   ── 使い方 ──
     guardAll()                … 全部の章をまとめて確かめる（ふだんはこれ）
     chapterGuard(1)           … 第1章だけ
     chapterGuard(2, 'record') … 第2章の基準値を取り直す（JSONをコンソールへ）

   **基準値を更新していいのは、その章を意図して変えたときだけ。**
   第3章の作業中に第1章・第2章が落ちたら、それは事故だ。

   ── 章を増やすとき ──
   下の GUARD_SPECS に1つ足して、chapterGuard(3, 'record') で基準値を取るだけ。
   ============================================================ */

/* ---- 決定的な乱数（xorshift32）。走らせるあいだだけ Math.random を差し替える ---- */
function guardRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}
/* 文字列 → 32bit の指紋（FNV-1a）。中身が1文字違えば別の値になる */
function guardHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
/* 関数も含めて安定した文字列にする（キーを並べ替えて、関数は中身の文字列で表す） */
function guardStable(v, depth) {
  if (depth > 8) return '…';
  if (typeof v === 'function') return 'fn:' + v.toString().replace(/\s+/g, ' ');
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(x => guardStable(x, depth + 1)).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + guardStable(v[k], depth + 1)).join(',') + '}';
}

/* ============ ① データの指紋 ============ */
function guardDataPrint(n) {
  applyChapter(n);
  const bundle = CHAPTERS[n].data();
  const out = {};
  for (const k of Object.keys(bundle).sort()) out[k] = guardHash(guardStable(bundle[k], 0));
  return out;
}

/* ============ ④ フックの指紋 ============
   その章に生えているフックの名前を、並べ替えて全部。
   第1章は空のはず＝1本でも生えていたら第2章の書き足しが漏れている。
   第2章は42本あるはず＝1本でも欠けていたら、どこかで例外が出て登録に失敗している */
function guardHookPrint(n) {
  return Object.keys((CHAPTERS[n] && CHAPTERS[n].hooks) || {}).sort();
}

/* ============ 走らせる下ごしらえ ============
   タイトル → その章 → はじめから、を物語も名前も飛ばして作る。
   乱数は固定。実時間に依存するもの（吹き出し・ゴキブリ・エフェクト）は消しておく */
function guardBoot(n) {
  /* **測る前に、必ず全部の章を一度ずつ通してから目的の章に入る。**
     章を切り替えると、間取り・キャンバスの寸法・区画の番号が付け替わる。
     直前に何章を見ていたかで、そのときの残りかすが少しだけ違う＝
     「第1章のあとの第2章」と「第2章のあとの第2章」で絵が変わってしまう（実測）。
     毎回おなじ順路で入れば、履歴は毎回おなじになる                        */
  for (const k of Object.keys(CHAPTERS).map(Number).sort((a, b) => a - b)) applyChapter(k);
  applyChapter(n);
  resetState();
  /* resetState が消し残すもの（実測）。ここが残っていると、
     2回目の計測が1回目の続きから始まってしまい、**毎回ちがう指紋**が出る。
       uidN       … 客や設備に振る通し番号
       spawnQueue … 前の日に来そこねた客の予約
       today / minutes / bizCleaned … 途中で止めた日の残骸           */
  G.uidN = 0; G.spawnQueue = []; G.today = null; G.minutes = 0; G.bizCleaned = 0;
  G.lastStats = null; G.crisisAt = null; G.repeatShareToday = 0; G.homeRested = false;
  G.logLines = []; G.roughDays = 0; G.lastTurnedAway = 0;
  G.flags.intro = true;
  /* ゴキブリの「次に湧くまで」の残り時間。**これが最後まで残っていた犯人。**
     測り終わったあと画面を放っておくと、実時間で動くゴキブリの処理がここに値を書く。
     resetState では消えないので、次に測るときはゴキブリの湧く時刻がずれて、
     営業中の絵と客の動きが変わる＝**測るたびに違う答えが出る**（実測で突き止めた） */
  G.roachCool = {};
  document.querySelectorAll('.overlay').forEach(e => e.classList.add('hidden'));
  $('game-ui').classList.remove('hidden');
  enterPrep();
  G.paused = false;
  floaters.length = 0; sparkles.length = 0;
  G.roaches = []; G.roachSplats = []; G.npcs = [];
}

/* 設備を1台、決まった場所に置く（買い物のUIを通さない＝金も乱数も動かさない） */
function guardPut(id, x, y, f) {
  G.equip.push({ uid: ++G.uidN, id, x, y, f: f | 0, cond: 100, rot: 0,
                 temp: EQ[id].temp, occ: Array(EQ[id].cap || 1).fill(null), t: 0 });
}

/* ============ ② 見た目の指紋 ============
   時刻を固定して描いてから、キャンバスの画素を粗く数える。
   まるごとハッシュにすると1画素のアンチエイリアスでも落ちるので、
   16×16 の枡目ごとに平均色を取って、その並びを指紋にする（＝構図が変われば落ちる） */
function guardCanvasPrint(label) {
  /* **2回描いてから数える。** 1回目は、その画面に初めて出る文字や絵文字の下ごしらえが
     間に合わないことがあり、同じ状態なのに違う絵になる（実測：営業中の客の顔、
     ロビーの屋号の看板が、測るたびに2通りの指紋を行き来した）。
     いちど描いてしまえば2回目からは必ず同じなので、1回目は捨てる            */
  render(1.5); render(1.5);                      // rt を固定＝湯気も波も同じ位相で描く
  const cv = $('game');
  const g = cv.getContext('2d');
  const { width: W, height: H } = cv;
  const img = g.getImageData(0, 0, W, H).data;
  const GX = 16, GY = 16, cells = [];
  for (let gy = 0; gy < GY; gy++) for (let gx = 0; gx < GX; gx++) {
    const x0 = Math.floor(W * gx / GX), x1 = Math.floor(W * (gx + 1) / GX);
    const y0 = Math.floor(H * gy / GY), y1 = Math.floor(H * (gy + 1) / GY);
    let r = 0, gg = 0, b = 0, cnt = 0;
    for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
      const i = (y * W + x) * 4;
      r += img[i]; gg += img[i + 1]; b += img[i + 2]; cnt++;
    }
    if (!cnt) { cells.push('0'); continue; }
    // 4段階に丸める＝わずかな色ゆらぎは無視し、構図の変化だけを拾う
    cells.push(((r / cnt) >> 6) + '' + ((gg / cnt) >> 6) + '' + ((b / cnt) >> 6));
  }
  return { label, print: guardHash(cells.join('|')) };
}
/* 区画を全部まわって描く。第1章は1区画なので1枚だけ。
   第2章は6区画＝ロビー・休憩・食堂・男湯・女湯・家を1枚ずつ */
function guardViewAll(label, out) {
  const nA = Math.max(1, areaCount());
  for (let f = 0; f < nA; f++) {
    applyArea(f);                 // quiet を付けない＝キャンバスの大きさもその区画に合わせる
    G.viewF = f;
    const a = areaDef(f);
    out.push(guardCanvasPrint(nA > 1 ? `${label}／${(a && a.name) || f}` : label));
  }
  applyArea(0); G.viewF = 0;
}

/* ============ ③ 動きの指紋 ============
   **日をまたいで連鎖させない。** 夜の物語や日報の分岐で乱数の消費数が変わり、
   2日目以降が毎回ずれてしまう（実測で確認した）。
   代わりに「きれいな状態から1日だけ」を、条件を変えて何通りも測る。
   こちらのほうが再現も確実だし、どの条件で壊れたかも分かる                */
function guardOneDay() {
  startDay();
  /* 営業が始まらなかった（開業条件を満たしていない等）なら、そのことを記録する。
     ここを 0 で埋めて素通りさせると、**壊れても永久に気づけない基準値**ができる */
  if (G.phase !== 'biz') return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  let n = 0;
  while (G.phase === 'biz' && n < 40000) { stepBiz(5); n++; }
  const t = G.today || {};
  return [1, t.paid | 0, t.revenue | 0, t.profit | 0, t.gaveUp | 0, t.turnedAway | 0,
          Math.round(t.satSum / Math.max(t.satN, 1)), t.util | 0, t.water | 0,
          /* 食堂（第2章）。注文→調理→配膳が通っているかは、この2つで分かる */
          t.menuN | 0, t.menuRev | 0];
}
const GUARD_COLS = ['条件', '営業できたか', '客数', '売上', '収支', '待ちきれず帰った',
                    '入れず帰った', '平均満足度', '光熱費', '水道代', '食堂の皿数', '食堂の売上'];

/* ============================================================
   章ごとの測りかた
   ------------------------------------------------------------
   views … 見た目を撮るときの下ごしらえ（biz を書くと、その手数だけ営業してから撮る）
   cases … 動きを測る条件。どれも**きれいな状態から1日だけ**
   conf  … 数字で控えておきたい設定（変わったら名指しで報告される）
   ============================================================ */
const GUARD_SPECS = {
  1: {
    title: '第1章 夕凪湯 再建記',
    views: [
      { label: '準備中', setup: () => {} },
      { label: '準備中・設備あり', setup: () => {
          guardPut('sauna1', 2, 2, 0); guardPut('mizu1', 6, 2, 0); guardPut('locker1', 2, 8, 0);
        } },
      { label: '営業中', setup: () => {
          guardPut('sauna1', 2, 2, 0); guardPut('mizu1', 6, 2, 0); guardPut('locker1', 2, 8, 0);
        }, biz: 120 },
    ],
    cases: [
      { name: '素の店・種A', seed: 1001, setup: () => {} },
      { name: '素の店・種B', seed: 2002, setup: () => {} },
      { name: '設備を足した店', seed: 3003, setup: () => {
          guardPut('sauna1', 2, 2, 0); guardPut('mizu1', 6, 2, 0); guardPut('locker1', 2, 8, 0);
          G.rep = 40; G.regulars = 12;
        } },
      /* 値上げは**ほんの少しだけ**にする（¥600の目安に対して¥700）。
         ¥900まで上げると客足の下げ幅が下限（0.3倍）に張り付いて、
         計算式を書き換えても数字が動かない＝**壊れても気づけない条件**になっていた（実測） */
      { name: '少し値上げした店', seed: 4004, setup: () => {
          G.opts.fee = 700; G.opts.towel = 'paid'; G.rep = 10;
        } },
      { name: 'バイトを雇った店', seed: 5005, setup: () => {
          const p = STAFF_POOL[2];
          G.roster.push({ pid: p.pid, name: p.name, maji: p.maji, spd: p.spd, aiso: p.aiso,
                          desc: p.desc, wage: staffWageOf(p), days: 0, skill: 40, sulk: false });
          guardPut('sauna1', 2, 2, 0); G.rep = 25;
        } },
    ],
    conf: () => ({
      speeds: CONF.speeds, openHour: CONF.openHour, closeHour: CONF.closeHour,
      maxStaff: CONF.maxStaff, startCash: CONF.startCash, worthFee: worthFee(),
      wage: staffWageOf(STAFF_POOL[0]), areas: areaCount(),
    }),
  },

  2: {
    title: '第2章 独立開業編',
    forSaveKey: 'orenoSauna_ch2_v1',      // 旧・候補1の測りかた（いまの第2章＝横浜編には使えない）
    views: [
      { label: '開業前', setup: () => {} },
      { label: '営業中', setup: () => {}, biz: 120 },
    ],
    cases: [
      { name: '素の店・種A', seed: 1001, setup: () => {} },
      { name: '素の店・種B', seed: 2002, setup: () => {} },
      /* ボロい置き土産の隣に、まともなサウナと水風呂を男女とも入れた店 */
      { name: '設備を足した店', seed: 3003, setup: () => {
          for (const f of [AR.OTOKO, AR.ONNA]) {
            guardPut('s2_main', 9, 5, f); guardPut('m2_cold', 3, 8, f);
          }
          G.rep = 40; G.regulars = 30;
        } },
      /* 評判10のときの目安は¥900。そこから¥1,200＝**高いと思われる**ところまで上げる。
         ¥1,000では客数が28人のまま動かず、料金への不満の計算を書き換えても
         数字が1つも変わらなかった（実測）＝**壊れても気づけない条件**だった。
         ¥1,200なら28人→17人と効いていて、下限に張り付いてもいない            */
      { name: '高いと思われる店', seed: 4004, setup: () => {
          G.opts.fee = 1200; G.rep = 10;
        } },
      /* **第2章にしかない壊れ方を測る条件。**
         バイトを2人に減らす＝担当のいない部屋が「利用不可」になり、
         女湯が無人なら女性客はそもそも来ない。この筋道が変わったら落ちる */
      { name: 'バイトが足りない店', seed: 5005, setup: () => {
          G.roster = G.roster.slice(0, 2); G.rep = 25;
        } },
      /* **男湯を見たまま【営業開始】を押した日。**
         客も主人公も、番台のある部屋ではなく画面に映っている部屋に湧いてしまい、
         誰も金を払えないまま一日が終わる（客0人）という事故が実際に起きた。
         どの部屋から始めても、ロビーから始めたときと同じ数字になるはず           */
      { name: '男湯を見たまま開店', seed: 1001, setup: () => { enterAreaScreen(3); } },
      /* **食堂を開けた店。** 注文 → 厨房が作る → ホールが運ぶ → 客が食べる、が
         丸ごと通る唯一の条件。ここが動かなくなると、皿の数と食堂売上が変わる */
      { name: '食堂を開けた店', seed: 7007, setup: () => {
          /* 厨房は一個物（4×2）。**戸口の列（x=6）を避ける**＝
             ここに乗せると食堂が「入れない部屋」になる（rooms の指紋が落ちる） */
          guardPut('k2_kitchen', 7, 8, AR.SHOKUDO);
          /* 席は厨房の近くに置く。見張りは1手で1マスしか歩かせないので、
             部屋の端に置くと運ぶだけで一日が終わり、皿数が0近くまで潰れて
             **壊れても気づけない基準値**になる（実測：端だと1皿・近くだと8皿） */
          guardPut('k2_counter', 2, 8, AR.SHOKUDO);
          guardPut('k2_table', 4, 6, AR.SHOKUDO);
          guardPut('k2_zaseki', 2, 4, AR.SHOKUDO);
          G.ch2.menuDev = menuAll().filter(m => !m.akari).map(m => m.id);   // 全部開発済み
          /* **ホールを1人雇う**（移すのではなく増やす）。
             休憩スペースから引き抜くと、その部屋が無人になって満足度が崩れ、
             食堂を測っているのか休憩を測っているのか分からなくなる */
          G.roster.push({ pid: 'guard_hall', name: 'ホール', sex: 'm',
                          maji: 3, spd: 5, aiso: 4, ryori: 1,
                          f: AR.SHOKUDO, job: 'hall', wage: 9000, days: 0, skill: 54 });
          G.rep = 30;
        } },
      /* 深夜バイトを雇って、夜も開けている店。第2章にしかない道すじ＝
         深夜割増の給料と、閉店時刻が伸びるぶんの客を測る */
      { name: '夜も開ける店', seed: 6006, setup: () => {
          for (const p of STAFF_POOL.filter(p => p.night).slice(0, 2))
            G.roster.push({ pid: p.pid, name: p.name, maji: p.maji, spd: p.spd, aiso: p.aiso,
                            ryori: p.ryori, night: true, desc: p.desc, wage: staffWageOf(p),
                            days: 0, skill: 40, sulk: false });
          G.opts.nightOpen = true;
        } },
    ],
    conf: () => ({
      speeds: CONF.speeds, openHour: CONF.openHour, closeHour: CONF.closeHour,
      maxStaff: CONF.maxStaff, startCash: CONF.startCash, startDebt: CONF.startDebt,
      worthFee: worthFee(), wage: staffWageOf(STAFF_POOL[0]), areas: areaCount(),
      bills: (CONF.bills || []).map(b => [b.key, b.day, b.every, b.amount]),
      /* 開幕の残置物の数。**制作中は 0**（毎回35個運び出すのが重いので開発サーバーでだけ空にしてある）。
         出す前に本番の35個へ戻すとき、ここが必ず落ちる＝戻し忘れないための仕掛け */
      junk: (chHook('initJunk') || []).length,
    }),
  },
};

/* 測り終わったら、ゲームをタイトルまで戻して**動くのをやめさせる**。
   ------------------------------------------------------------
   これをやらないと、測り終わったあとも画面の更新（requestAnimationFrame）が
   準備中の主人公を歩かせ続け、ゴキブリを湧かせ続ける。その残りかすが次の測定に紛れ込んで、
   **打つたびに答えが変わる**（実測：待ち時間を挟むと営業中の絵の指紋がころころ変わった）。
   phase を 'title' にしておけば、更新の中身がまるごと素通りになる。
   どのみち測定はセーブしていない状態を壊すので、タイトルへ戻すのが正しい後始末でもある */
function guardPark() {
  G.phase = 'title';
  G.player = null; G.customers = []; G.staff = []; G.npcs = [];
  G.roaches = []; G.roachSplats = []; G.roachCool = {};
  floaters.length = 0; sparkles.length = 0;
  $('game-ui').classList.add('hidden');
}

/* ============ 一式を取る ============ */
/* ============ 部屋が「入れる部屋」になっているか ============
   ------------------------------------------------------------
   **これは実際に起きた事故を二度と起こさないための関門。**

   男湯・女湯の出入口は下辺の1マス（6,13）きりで、そこから踏み出せるのは (6,12) だけ。
   そこへ初期配置の錆びたロッカー（横2マス）が x=5 で乗っていた＝(5,12)(6,12) を塞ぎ、
   **男湯・女湯が丸ごと「入れない部屋」になっていた**。サウナも水風呂も浴槽も
   「道が通っていない飾り」（dead）のまま、開業から誰ひとり湯に入っていなかった。

   絵は正しく描かれ、日報も出て、客数も満足度も並の数字が出る。**画面を見ても分からない。**
   だから、部屋ごとに次の2つを控える：
     ・入口から歩いて行けるマスの数（＝部屋がひとつながりか）
     ・道が通っていない設備の数（＝置いたのに使えないものが無いか）           */
function guardRooms(n) {
  const out = [];
  const list = (CONF.areas || []);
  if (!list.length) {                                   // 区画を持たない章（第1章）
    let walk = 0;
    for (let y = 0; y < CONF.H; y++) for (let x = 0; x < CONF.W; x++) if (walkable(x, y)) walk++;
    return [['（1枚だけ）', walk, guardReach(), G.equip.filter(e => e.dead).length]];
  }
  for (let f = 0; f < list.length; f++) {
    if (list[f].home) continue;                         // 家は店ではない＝客も来ない
    applyArea(f, true);
    let walk = 0;
    for (let y = 0; y < CONF.H; y++) for (let x = 0; x < CONF.W; x++) if (walkable(x, y)) walk++;
    out.push([list[f].key, walk, guardReach(),
              G.equip.filter(e => (e.f | 0) === f && e.dead).length]);
  }
  return out;
}
/* 入口から歩いて行けるマスの数（間仕切りの引き戸もちゃんと通る） */
function guardReach() {
  const ent = CONF.entrance;
  const seen = new Set([ent.x + ',' + ent.y]);
  const q = [ent];
  while (q.length) {
    const t = q.shift();
    for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = t.x + d[0], y = t.y + d[1], k = x + ',' + y;
      if (seen.has(k) || x < 0 || y < 0 || x >= CONF.W || y >= CONF.H) continue;
      if (!walkable(x, y) || crossBlocked(x, y, t.x, t.y)) continue;
      seen.add(k); q.push({ x, y });
    }
  }
  return seen.size;
}

function guardCollect(n) {
  const spec = GUARD_SPECS[n];
  const realRandom = Math.random;
  const back = G.chapter;
  let snap = null;
  try {
    /* ── 見た目 ── */
    const view = [];
    for (const v of spec.views) {
      Math.random = guardRng(20260801);
      guardBoot(n);
      Math.random = guardRng(20260801);   // 種を撒き直す＝boot が何回引いても以降は同じ並び
      v.setup();
      refreshDead();
      if (v.biz) { startDay(); for (let i = 0; i < v.biz; i++) stepBiz(5); }
      guardViewAll(v.label, view);
    }

    /* ── 動き（条件ごとに、きれいな状態から1日だけ）── */
    const days = spec.cases.map(cs => {
      Math.random = guardRng(cs.seed);
      guardBoot(n);
      Math.random = guardRng(cs.seed);
      cs.setup();
      refreshDead();
      return [cs.name].concat(guardOneDay());
    });

    Math.random = guardRng(20260801);
    guardBoot(n);                                    // 測り終わりは、きれいな状態で置いておく
    const rooms = guardRooms(n);                     // ← guardBoot 直後＝まっさらな盤面で測る
    snap = { data: guardDataPrint(n), rooms, view, days, conf: spec.conf(), hooks: guardHookPrint(n) };
  } finally {
    Math.random = realRandom;
    applyChapter(back);
    guardPark();
  }
  return snap;
}

/* ============ ページを開いて最初の1回だけ、捨て打ちする ============
   ------------------------------------------------------------
   読み込んだ直後にいきなり測ると、営業中の絵の2枚だけが「冷えた」値になる。
   一度まるごと測ってから **50ms でも実時間を待つ**と、以後はずっと同じ値になる。
   （実測：捨て打ちだけでは足りない・requestAnimationFrame でも足りない・
     setTimeout を50ms待つと必ず温まる。ブラウザ側の描画の下ごしらえの都合）

   ここを省くと、**ページを開いていちばん最初に打った guardAll() だけが
   嘘の FAIL を出す**。いちばん信用してほしい瞬間に嘘をつくことになる。   */
let guardWarmed = false;
async function guardWarmup() {
  if (guardWarmed) return;
  /* 温めは全部の章を一度なぞるが、**その章の測りかたが合っていない**ことがある
     （例：第2章の枠に別の章が入っている＝旧・候補1用の測りかたが残っている）。
     ここで落とすと第1章の点検までできなくなるので、章ごとに握りつぶす */
  for (const k of Object.keys(CHAPTERS).map(Number).sort((a, b) => a - b)) {
    try { guardCollect(k); } catch (e) { console.warn(`第${k}章は温められなかった（測りかたが合っていない）：`, e.message); }
  }
  await new Promise(r => setTimeout(r, 200));
  guardWarmed = true;
}

/* ============ 3回測って、多数決を採る ============
   ------------------------------------------------------------
   数字（データ・営業・設定・フック）は何度測っても寸分たがわず同じ。
   ところが**絵の指紋だけ**、10枚のうちどれか1枚が、たまに別の値になる。
   ブラウザが絵を描くときの下ごしらえの都合で、こちらから止められない類のもの。

   1回しか測らないと、この1枚のせいで「第1章が変わっている」と嘘の警報が鳴る。
   **嘘の警報を1回でも出したら、この見張りは信用されなくなって誰も使わなくなる。**
   なので3回測って、絵ごとに多いほうを採る。
   本当に絵を変えたときは3回とも新しい値になるので、ちゃんと落ちる。            */
function guardCollectStable(n, times) {
  const runs = [];
  for (let i = 0; i < (times || 3); i++) runs.push(guardCollect(n));
  const out = runs[runs.length - 1];
  out.view = out.view.map((_, i) => {
    const tally = {};
    for (const r of runs) { const p = r.view[i].print; tally[p] = (tally[p] || 0) + 1; }
    const best = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
    return { label: runs[0].view[i].label, print: best };
  });
  /* 数字がぶれたら、それは多数決で隠していい話ではない＝そのまま言う */
  const key = r => JSON.stringify([r.data, r.days, r.conf, r.hooks]);
  if (new Set(runs.map(key)).size > 1)
    console.warn('⚠ 測るたびに数字が変わっている。見張りの下ごしらえに漏れがある');
  return out;
}

/* ============ 突き合わせ ============
   **非同期にしてあるのはフォントのため。** 読み込み直後の1回目だけ
   DotGothic16 が間に合わず、代替フォントで描かれて見た目の指紋が変わる
   （実測：ページを読み直した直後だけ「営業中」の指紋がずれた）。         */
async function chapterGuard(n, mode) {
  n = n || 1;
  const spec = GUARD_SPECS[n];
  if (!spec) { console.warn(`第${n}章の測りかたが GUARD_SPECS にない`); return null; }
  if (!CHAPTERS[n]) { console.warn(`第${n}章がまだ登録されていない`); return null; }
  /* 測りかたは「その章のセーブキー」に紐づく。枠に別の章が入っていたら測らない
     （第2章の枠は、いま「横浜編」＝旧・候補1用の測りかたでは測れない） */
  if (spec.forSaveKey && CHAPTERS[n].saveKey !== spec.forSaveKey) {
    console.warn(`第${n}章の枠には別の章（${CHAPTERS[n].name}）が入っている。この測りかたは使えない`);
    return null;
  }
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  await guardWarmup();

  const now = guardCollectStable(n);

  if (mode === 'record') {
    const notRun = now.days.filter(r => !r[1]).map(r => r[0]);
    if (notRun.length)
      console.warn(`⚠ 営業が始まらなかった条件がある：${notRun.join('・')}\n`
                 + '  このまま控えると、その条件は**壊れても気づけない**基準値になる');
    console.log(`/* ${spec.title} */\n`
              + JSON.stringify(now, null, 1));
    try { navigator.clipboard && navigator.clipboard.writeText(JSON.stringify(now, null, 1)); } catch (e) {}
    console.log(`%c↑ これを js/dev/ch-baselines.js の "${n}": の中身に貼る（クリップボードにも入れた）`,
                'color:#c9a86a');
    return now;
  }

  const base = (typeof CH_BASELINE !== 'undefined') && CH_BASELINE[n];
  if (!base) {
    console.warn(`第${n}章の基準値がない。chapterGuard(${n}, 'record') で取って js/dev/ch-baselines.js に貼る`);
    return null;
  }

  const bad = [];
  // ① データ
  for (const k of Object.keys(base.data))
    if (now.data[k] !== base.data[k]) bad.push(`データ ${k} が変わっている`);
  for (const k of Object.keys(now.data))
    if (!(k in base.data)) bad.push(`データ ${k} が増えている`);
  /* ①-2 部屋。「入口から行けるマス」が減っていたら、どこかを塞いだ＝すぐ名指しする */
  (base.rooms || []).forEach((r, i) => {
    const got = (now.rooms || [])[i];
    if (!got) { bad.push(`部屋「${r[0]}」が測れていない`); return; }
    if (got[1] !== r[1]) bad.push(`部屋「${r[0]}」の歩けるマス：${r[1]} → ${got[1]}`);
    if (got[2] !== r[2]) bad.push(`部屋「${r[0]}」の入口から行けるマス：${r[2]} → ${got[2]}`
                               + (got[2] < r[2] ? '　⚠ どこかを塞いでいる' : ''));
    if (got[3] !== r[3]) bad.push(`部屋「${r[0]}」の道が通っていない設備：${r[3]} → ${got[3]}`);
  });
  (now.rooms || []).forEach((r, i) => {
    if (!(base.rooms || [])[i]) bad.push(`部屋「${r[0]}」が増えている`);
    /* 基準値そのものが「入れない部屋」でも落とす＝控え違いを見逃さない */
    if (r[2] < r[1]) bad.push(`⚠ 部屋「${r[0]}」は入口から全部に行けない（${r[2]}／${r[1]}マス）`);
  });
  // ② 見た目
  base.view.forEach((v, i) => {
    if (!now.view[i]) bad.push(`画面「${v.label}」が撮れていない`);
    else if (now.view[i].print !== v.print) bad.push(`画面「${v.label}」の見た目が変わっている`);
  });
  if (now.view.length > base.view.length)
    bad.push(`画面が増えている（${base.view.length} → ${now.view.length}）`);
  // ③ 動き
  base.days.forEach((row, i) => {
    const got = now.days[i] || [];
    row.forEach((v, j) => {
      if (got[j] !== v) bad.push(`［${row[0]}］の${GUARD_COLS[j]}：${v} → ${got[j]}`);
    });
  });
  // 設定
  for (const k of Object.keys(base.conf))
    if (JSON.stringify(now.conf[k]) !== JSON.stringify(base.conf[k]))
      bad.push(`設定 ${k}：${JSON.stringify(base.conf[k])} → ${JSON.stringify(now.conf[k])}`);
  // ④ フック（消えたほうも、増えたほうも）
  const lost = base.hooks.filter(h => now.hooks.indexOf(h) < 0);
  const gain = now.hooks.filter(h => base.hooks.indexOf(h) < 0);
  if (lost.length) bad.push(`フックが消えている：${lost.join(', ')}`);
  if (gain.length) bad.push(`フックが増えている：${gain.join(', ')}`);

  if (!bad.length) {
    console.log(`%c✅ ${spec.title} は変わっていない`
              + `（データ・${now.view.length}枚の画面・${now.days.length}通りの営業・フック${now.hooks.length}本）`,
                'color:#8fd4a0;font-weight:bold');
    return { ok: true, chapter: n };
  }
  console.log(`%c❌ ${spec.title} が変わっている`, 'color:#ff8a7a;font-weight:bold');
  bad.forEach(b => console.log('   ' + b));
  console.log(`%c意図した変更なら chapterGuard(${n}, 'record') で基準値を更新する`, 'color:#9a8a72');
  return { ok: false, chapter: n, bad };
}

/* ============ 全部の章をまとめて ============
   ふだんはこれを打つ。どこかの章が落ちたら、その章だけ見に行く */
async function guardAll() {
  const out = [];
  for (const n of Object.keys(GUARD_SPECS).map(Number).sort((a, b) => a - b)) {
    if (!CHAPTERS[n]) continue;
    out.push(await chapterGuard(n));
  }
  const ng = out.filter(r => r && !r.ok);
  if (!ng.length) console.log('%c✅ 全部の章が、控えたときのまま', 'color:#8fd4a0;font-weight:bold');
  else console.log(`%c❌ ${ng.map(r => '第' + r.chapter + '章').join('・')}が変わっている`,
                   'color:#ff8a7a;font-weight:bold');
  return out;
}

/* 昔の名前でも動くようにしておく（手が覚えているので） */
function ch1Guard(mode) { return chapterGuard(1, mode); }
