'use strict';

/* ============ 章の切り替えと、章をまたぐ持ち物 ============
   第1章「夕凪湯 再建記」と第2章「独立開業編」は、
   ・マップも設備も客もイベントも別
   ・セーブデータも別（片方を遊んでも、もう片方は一切変わらない）
   という作りにする。ここはその境目を引くファイル。

   game.js は CONF / EQ / TYPES … という名前を直接見ているので、
   章を切り替えるときは「その名前が指す中身を差し替える」＝applyChapter() でまとめて付け替える。
   （そのために data.js の const を let に変えてある。値も中身も、第1章のものは一切いじっていない）   */

/* ---- 課金コンテンツ（オート修理）は、章をまたいで共有する（作者指定） ----
   第1章で買えば第2章でも使えるし、第2章で買えば第1章でも使える。
   セーブデータの中に入れてしまうと章ごとに分かれてしまうので、独立したキーに出しておく。
   ＝「一度買えば、アプリ全体で使える」 */
const PREMIUM_KEY = 'orenoSauna_premium';

function defaultPremium() { return { autoRepair: false, autoRepairOn: true }; }

function loadPremium() {
  try {
    const d = JSON.parse(localStorage.getItem(PREMIUM_KEY));
    return d ? { ...defaultPremium(), ...d } : defaultPremium();
  } catch (e) { return defaultPremium(); }
}

function savePremium() {
  try { localStorage.setItem(PREMIUM_KEY, JSON.stringify(G.premium || defaultPremium())); } catch (e) {}
}

/* すでに第1章で買ってくれた人を取りこぼさないための引っ越し。
   共有キーがまだ無くて、章のセーブの中に「買った」記録が残っていたら、そちらを正として共有キーへ移す。
   （この関数は共有キーが未作成のときしか効かない＝あとから上書きすることはない） */
function migratePremiumFromSave(saved) {
  if (!saved || !saved.autoRepair) return;
  try { if (localStorage.getItem(PREMIUM_KEY)) return; } catch (e) { return; }
  G.premium = { ...defaultPremium(), ...saved };
  savePremium();
}

/* ---- 章ごとのデータ束 ----
   第2章のデータ（CONF2 など）は js/ch2/data2.js が読み込まれていれば入る。
   まだ無いあいだは第1章だけが登録される＝第2章を選んでも落ちない */
const CHAPTERS = {
  1: {
    name: '夕凪湯 再建記',
    saveKey: 'orenoSauna_v1',
    data: () => ({
      CONF, DEFAULT_OPTS, EQ, EQ_NOTE, CATS, ID_ALIAS, INIT_EQUIP, TYPES, STAFF_POOL, TEMP_RANGE, LINES, PROBLEMS,
      TIME_LIMITS, STAY_NEED_MIX, STAY_NEED_BATH,
      FEE_OPTIONS, SAUNA_FEE_OPTIONS, FEE_RANGE, SAUNA_FEE_RANGE, FEE_BASE, SAUNA_FEE_BASE, FEE_STEP, FEE_CEIL,
      DRYER_FEES, LOTION_FEES, AMENITY_PRICES, TEBURA_PRICES, KID_FEES,
    }),
  },
};

/* 第1章の「元の値」を、いちばん最初に控えておく。
   applyChapter(1) で必ずここへ戻せるようにしておくため
   （data.js の let を第2章の値で上書きしたあと、第1章に戻れなくなるのを防ぐ） */
let CH1_DATA = null;
function snapshotChapter1() { if (!CH1_DATA) CH1_DATA = CHAPTERS[1].data(); }

/* ---- 章ごとの「ふるまい」の差し替え口（フック） ----
   同じアプリの中で、まったく別のゲームを動かす（作者指定）。
   だから第1章のコードに「第2章のときはこうする」という例外を書き足していくのではなく、
   **章ごとに中身を差し替える** 形にする。

   ・第1章のふるまい … js/game.js の中の従来のコード（何も登録しない＝既定の動き）
   ・第2章のふるまい … js/ch2/ 以下のファイルが hooks として登録する

   game.js からは chHook('名前', 引数…) で呼ぶ。
   その章がフックを持っていなければ undefined が返るので、呼び出し側は従来どおりに進む。 */
function chHook(name, ...args) {
  const h = CHAPTERS[G.chapter] && CHAPTERS[G.chapter].hooks;
  const fn = h && h[name];
  return fn ? fn(...args) : undefined;
}
function hasHook(name) {
  const h = CHAPTERS[G.chapter] && CHAPTERS[G.chapter].hooks;
  return !!(h && h[name]);
}

/* 第2章のデータを登録する（js/ch2b/data_y.js の末尾から呼ぶ）。

   第2章は「横浜編」に決定したが、保留にした候補1（js/ch2/）も消していない。
   どちらを読み込んでもこの関数1つで登録できるように、
   **章の名前とセーブキーは登録する側から渡す**（meta）。
   渡さなかった場合は候補1の値になる＝js/ch2/data2.js は書き換えずにそのまま動く */
function registerChapter2(bundle, meta) {
  const m = meta || {};
  CHAPTERS[2] = {
    name: m.name || '独立開業編',
    saveKey: m.saveKey || 'orenoSauna_ch2_v1',
    data: () => bundle, hooks: {},
  };
}
/* 第2章のふるまいを登録する（js/ch2/rules2.js から呼ぶ） */
function registerChapter2Hooks(hooks) {
  if (!CHAPTERS[2]) return;
  Object.assign(CHAPTERS[2].hooks, hooks);
}

/* 章を切り替える。game.js が見ている名前の中身を、まとめて付け替える */
/* ============================================================
   章を切り替えるときの、画面の巻き戻し（2026-08-08）
   ============================================================
   `applyChapter()` はページを読み込み直さない。だから
   **第2章で遊ぶ → 保存してもどる → 第1章** が通常操作でできてしまい、
   第2章が書き換えた表示が第1章の画面に残る。1日で3件踏んだ。

     ・外観・集客・増築のパネル（class）
     ・「🏦 横浜信用金庫／枠5000万円」（innerHTML）
     ・資金繰りの中身3つの居場所（親と位置）

   **去り際に片付ける形にはしない。**それは去る側の善意に依存する＝
   片付け漏れは章が育つたびに増えるし、第3章が来たら同じ関数をもう1本書くことになる。
   今日の3件が全部「戻す処理を書き忘れた」だった以上、**書き忘れが起きない形**にする。

     ① ページを読み込んだ直後（どの章も描く前）＝index.html のままの姿を控える
     ② applyChapter() の頭で、必ずそこへ戻す
     ③ そのあと、その章が自分の表示を描く

   これなら**章がどれだけ画面を増やしても、片付けコードを1行も足さずに済む。**
   起動直後の applyChapter(1) は「控えた直後の姿へ戻す」＝完全な空振りになる。

   ⚠ 親を丸ごと innerHTML で戻さない。中の要素の参照を握っているコードが壊れる。
     **違っている要素だけ**を、違っている欄だけ戻す。                        */
const CHAP_DOM0 = {};
function chapSnapshotDOM() {
  for (const el of document.querySelectorAll('[id]')) {
    CHAP_DOM0[el.id] = {
      cls: el.className, hidden: el.hidden,
      style: el.getAttribute('style'), html: el.innerHTML,
      /* キャンバスは**大きさも控える。**中身を消しても、寸法が前の章のままだと
         「空のキャンバス」の絵が別物になる（第2章の案内図は寸法から違う）*/
      cw: el.getAttribute('width'), chh: el.getAttribute('height'),
    };
  }
}
function chapRestoreDOM() {
  /* ── ① class・hidden・style を戻す。中身を作り直さないので、どの要素でも安全 ── */
  for (const id of Object.keys(CHAP_DOM0)) {
    const el = document.getElementById(id); if (!el) continue;
    const s = CHAP_DOM0[id];
    if (el.className !== s.cls) el.className = s.cls;
    if (el.hidden !== s.hidden) el.hidden = s.hidden;
    const st = el.getAttribute('style');
    if (st !== s.style) { if (s.style == null) el.removeAttribute('style'); else el.setAttribute('style', s.style); }
  }
  /* ── ② そのうえで、まだ中身が違う要素を数え直す ──
     ⚠ **①を全部終えてから数えること。**同じループで見ると、
     親を先に見た時点では子の class がまだ戻っておらず、
     「親の innerHTML が違う」と誤判定して**親ごと作り直してしまう**
     （実測：それで prepPanel が作り直され、【運営】【データ】【営業開始】が全部死んだ）*/
  const htmlDiff = [];
  for (const id of Object.keys(CHAP_DOM0)) {
    const el = document.getElementById(id); if (!el) continue;
    if (el.innerHTML !== CHAP_DOM0[id].html) htmlDiff.push(el);
  }
  /* ⚠ **innerHTML を戻すのは、いちばん内側だけ。**
     親を書き戻すと中の要素が作り直され、**起動時に付けたボタンの onclick が全部死ぬ**
     （実測：章を行き来したあと btnManage も btnOpen も反応しなくなった）。
     親が違って見えるのは中の誰かが違うからなので、その子を戻せば親も揃う。      */
  for (const el of htmlDiff) {
    if (htmlDiff.some(o => o !== el && el.contains(o))) continue;   // 下にもっと内側の違いがある
    /* ⚠ **最後の関門。**中に **index.html にもとから在る要素**（＝起動時に onclick を
       付けたボタン）を抱えているものは、作り直した瞬間にそのボタンが死ぬので触らない。
       （実測：これが無いと areaBar が作り直され、【← 外に出る】【🏠 家へ】が反応しなくなった）

       逆に、**中身がまるごと後から作られたもの**（カタログの一覧・外観のカード・
       バイト管理の中身…）は作り直して構わない。もとの姿は空で、
       ボタンも章が描くたびに付け直されるため                                */
    if (el.querySelector && [...el.querySelectorAll('[id]')].some(k => CHAP_DOM0[k.id])) continue;
    el.innerHTML = CHAP_DOM0[el.id].html;
  }
  /* キャンバスは中身を持たないので、寸法を戻してから消す
     （第2章のビルの絵・物語の一枚絵が第1章に残る）。
     `game` は毎フレーム resizeStage が張り直すので、ここで戻しても実害はない */
  for (const cid of ['game', 'guide', 'storyArt']) {
    const c = document.getElementById(cid); const s = CHAP_DOM0[cid];
    if (!c || !c.getContext) continue;
    if (s) {
      /* ⚠ 控えが null（index.html に width/height を書いていない）なら、**属性を消す。**
         そうしないと前の章が付けた寸法が残り、**空のキャンバスの絵が別物になる**
         （消しても大きさが違えば、画像として一致しない）*/
      if (s.cw == null) c.removeAttribute('width');
      else if (c.getAttribute('width') !== s.cw) c.setAttribute('width', s.cw);
      if (s.chh == null) c.removeAttribute('height');
      else if (c.getAttribute('height') !== s.chh) c.setAttribute('height', s.chh);
    }
    try { c.getContext('2d').clearRect(0, 0, c.width, c.height); } catch (e) { /* 描けない環境 */ }
  }
}
/* 控えるのは一度だけ。**どの章も描く前**でなければ意味がない */
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', chapSnapshotDOM, { once: true });
  else chapSnapshotDOM();
}

function applyChapter(n) {
  chapRestoreDOM();      // まず index.html のままの姿へ戻してから、その章を描く
  snapshotChapter1();
  const ch = CHAPTERS[n] || CHAPTERS[1];
  const d = (n === 1) ? CH1_DATA : ch.data();
  CONF = d.CONF; DEFAULT_OPTS = d.DEFAULT_OPTS; EQ = d.EQ; EQ_NOTE = d.EQ_NOTE; CATS = d.CATS;
  ID_ALIAS = d.ID_ALIAS; INIT_EQUIP = d.INIT_EQUIP; TYPES = d.TYPES; STAFF_POOL = d.STAFF_POOL;
  TEMP_RANGE = d.TEMP_RANGE; LINES = d.LINES; PROBLEMS = d.PROBLEMS;
  TIME_LIMITS = d.TIME_LIMITS; STAY_NEED_MIX = d.STAY_NEED_MIX; STAY_NEED_BATH = d.STAY_NEED_BATH;
  FEE_OPTIONS = d.FEE_OPTIONS; SAUNA_FEE_OPTIONS = d.SAUNA_FEE_OPTIONS;
  FEE_RANGE = d.FEE_RANGE; SAUNA_FEE_RANGE = d.SAUNA_FEE_RANGE;
  FEE_BASE = d.FEE_BASE; SAUNA_FEE_BASE = d.SAUNA_FEE_BASE; FEE_STEP = d.FEE_STEP; FEE_CEIL = d.FEE_CEIL;
  DRYER_FEES = d.DRYER_FEES; LOTION_FEES = d.LOTION_FEES; AMENITY_PRICES = d.AMENITY_PRICES;
  TEBURA_PRICES = d.TEBURA_PRICES; KID_FEES = d.KID_FEES;
  G.chapter = (CHAPTERS[n] ? n : 1);
  // 区画（マップ）も1つ目に戻す。第1章は区画がひとつなので何も起きない
  if (typeof applyArea === 'function') applyArea(0, true);
  /* 屋号は章ごとに別（作者指定）。章を切り替えた時点でその章の既定に戻す＝
     第2章で付けた名前が第1章の物語に出てくる、といった混ざり方をしない。
     セーブから読み込んだ場合は、そのセーブの名前で上書きされる */
  if (typeof defaultShopName === 'function') G.name = defaultShopName();
  // タイトル画面の副題を、いま選ばれている章の名前にする
  const sub = document.getElementById('titleSub');
  if (sub) sub.textContent = '― ' + (CHAPTERS[G.chapter] || CHAPTERS[1]).name + ' ―';
}

/* いま遊んでいる章のセーブ先。章ごとに別のキー＝互いに上書きしない */
function saveKey() { return (CHAPTERS[G.chapter] || CHAPTERS[1]).saveKey; }
