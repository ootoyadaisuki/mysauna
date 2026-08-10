'use strict';
/* =========================================================
   俺のサウナ - メインゲームロジック
   ========================================================= */

const $ = id => document.getElementById(id);
const T = CONF.TILE;
const yen = n => '¥' + Math.round(n).toLocaleString('ja-JP');
/* ボタンなど幅の狭い場所用の短い金額表記（省略記号で切れるくらいなら「2.5万」で言い切る） */
const yenShort = n => n >= 10000 ? (Math.round(n / 1000) / 10) + '万' : yen(n);
/* 融資画面などの「300万円」表記（作者指定＝全部数字だと長いので万円で省スペース化） */
const manYen = n => n >= 10000 ? (Math.round(n / 1000) / 10) + '万円' : yen(n);
const rand = (a, b) => a + Math.random() * (b - a);
const irand = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ============ ゲーム状態 ============ */
const G = {
  phase: 'title',            // title / prep / biz / report
  actF: 0,                   // いま CONF が指している区画（計算対象）。表示は viewF
  viewF: 0,                  // 画面に出している区画（-1＝館内案内図）
  chapter: 1,                // いま遊んでいる章（1＝夕凪湯 再建記 / 2＝独立開業編）。セーブ先もデータもここで分かれる
  day: 1, cash: CONF.startCash, debt: CONF.startDebt, rep: 10, name: '夕凪湯',
  // 銀行融資は廃止（作者指定）。debt/loanPending/loanArrive は旧セーブの読み込み用に残してあるだけで、もう増えない
  loanPending: 0, loanArrive: 0,
  profitStreak: 0,          // 連続黒字日数（データ画面の表示に使う）
  repHist: [],              // 直近7日ぶんの「10項目の採点」（新評判システム）
  repBonus: 0,              // 物語の出来事による評判の加点・減点（10項目とは別枠）
  uidN: 0,
  equip: [],                 // {uid,id,x,y,rot,cond,occ[]}
  dirts: [],                 // {x,y}
  junk: [],                  // 開店前のゴミ・瓦礫 {kind,x,y,f}（第2章のみ）
  stam: null,                // 体力（第2章のみ。null＝体力のない章）
  minutes: 0,                // 9:00からの経過(分)
  speedIdx: 0, paused: false,
  customers: [], payQueue: [],
  // ゴキブリは区画に1匹（その区画の濃い汚れが5つを超えると現れる・保存しない）
  player: null, staff: [], roaches: [], roachCool: {}, roachSplats: [],
  spawnQueue: [],
  adBoost: 0, adBought: {},
  placing: null, selected: null,
  flags: {},
  seenEq: {},                // 解放済みで既に確認した設備ID（新着マーク用）
  opts: { ...DEFAULT_OPTS },
  staffCount: 0,             // （旧仕様の人数。フェーズ3からはrosterが本体。旧セーブ移行用に残す）
  roster: [],                // 採用中のバイト名簿 [{pid,name,maji,spd,aiso,desc,wage,days,skill,sulk,raiseAsk}]
  jobAdDay: 0,               // 求人広告を出した（2日後の朝、応募者3人が来る）
  today: null,
  logLines: [],
  benz: null,                // 黒塗りベンツの演出オブジェクト {x,phase,hold,...}。右下から走ってきて入口に停まり、左へ去る
  mikajimeAt: null,          // 今日みかじめ料の来訪が起きる予定時刻（分）。nullなら無し
  mikaFired: false,          // 今日すでに来訪が起きたか
  mika: null,                // 進行中のみかじめイベント {amount}
  kito: null,              // 反社ボス「鬼頭」の進行 {met,encounters,paid,refused,destroyed,resolved,outcome,ally,...}
  tadokoro: null,            // ライバル「田所源造」の進行 {met,stage,resolved,ally,nextDay}。常連客問題を統合
  kuroda: null,              // ライバル「黒田修司」（同級生・数字/継続）の進行 {met,stage,resolved,ally,nextDay}
  reina: null,               // ライバル「桐生玲奈」（蒼天SPA・設備/業界）の進行 {met,stage,resolved,ally,nextDay,poachDone}。買収/引き抜き/競合圧
  yami: null,                // サラ金「灰田ファイナンス」{debt,met,missed}。毎週水曜に集金が来る
  npcs: [],                  // 歩いて入ってくる面々（重要人物の来訪・修理業者・バットの若い衆）
  visitKey: null, visitAt: null, visitFired: false,   // 今日の来訪者（1日ひとりだけ）
  yamiAt: null, yamiFired: false,                     // サラ金の集金予定（水曜のみ）
  najimi: 8,                 // 常連（親父時代からの常連）との絆 0–100。田所の決戦＆鬼頭の街ぐるみに効く
  oyajiRel: 0,               // （廃止）旧・親父との関係ゲージ。セーブ互換のため器だけ残す。態度は評判連動
  recentProfits: [],         // 直近5日の日次収支（黒田の「直近5日で3日黒字」判定に使う）
  recentUtil: [],            // 直近5日の {util,water,revenue}（データ画面の水道光熱費と売上比率に使う）
  lastWorthFee: null,        // 直前に知らせた「客が受け入れる入浴料」の目安（段が動いた時だけ通知する）
  lastWorthSauna: null,      // 同じくサウナ料の目安
  lastShortfallDay: 0,       // 直近で資金ショート自動借入をした日（黒田の「健全経営」判定に使う）
  solved: null,              // 4つの対立の解決フラグ {tadokoro,yakuza,kuroda,reina}＋親父和解oyaji。全対立解決＋親父和解で復活エンド
};
function newKito() { return { met: false, encounters: 0, paid: 0, paidTotal: 0, refused: 0, destroyed: 0, resolved: false, outcome: null, ally: false, nextShowdownDay: 0, lastAllyDay: 0, showdowns: 0 }; }
function newTadokoro() { return { hello: false, met: false, stage: 0, resolved: false, ally: false, nextDay: 0, demand: null, done: 0, doneKeys: [], holdCount: 0, filler: 0, fillerDay: 0 }; }
function newKuroda() { return { met: false, stage: 0, resolved: false, ally: false, nextDay: 0, demand: null, done: 0, doneKeys: [], lastKey: null, discountKey: null, discountDay: 0 }; }
function newReina() { return { met: false, metDay: 0, stage: 0, resolved: false, ally: false, nextDay: 0, poachDone: false, duel: 'none', duelDay: 0, lost: 0 }; }
function newSolved() { return { tadokoro: false, yakuza: false, kuroda: false, reina: false, oyaji: false }; }
// 親父の和解ゲージ（OYAJI_CLEAR_AT / OYAJI_CARE_GAIN）は廃止（作者指定）。態度は評判連動＝STORY_CARE_PAID
const TADOKORO_HELLO_DAY = 4;                       // 田所の名乗り＝4日目の営業終了後（作者指定。2〜3日目の母の電話と重ねない）
// 「田所が現れる評判30」の縛りは撤廃（作者指定）。サウナを置いた翌日から、いつでも来る
const TADOKORO_KESSEN_NAJIMI = 55, TADOKORO_KESSEN_REP = 52, TADOKORO_KYOZON_GAIN = 18;  // 田所が認める条件と、共存の選択で伸びる絆
const TADOKORO_DEMAND_CLEAR = 5;                    // 田所の要求をこの回数だけ叶えると、認めさせる資格（作者指定で3→5）
const KITO_APPEAR_REP = 39;                         // 鬼頭の集金が始まる評判（新評判方式＝繁盛の匂いがし始めた店にヤクザが来る）
/* 田所が割って入る条件（作者指定 8/5）。どちらか片方でいい＝
   みかじめを3回以上払った／連中が5回以上来た。突っぱね続ける店でも、来訪の数で必ず話が進む */
const KITO_RESCUE_PAID = 3, KITO_RESCUE_VISITS = 5;
/* 以下の登場しきい値は、店の格のカーブ（GRADE_SCALE）を作者指定で上げ直したのに合わせて再換算した値。
   換算のしかたは「同じ充実度なら同じ相手が出る」＝旧しきい値を充実度に戻し、新しいカーブで評判に直した。
   狙い（作者指定）：黒田の決着がつく頃に評判75前後、玲奈への再戦の目標が評判90 */
const KURODA_APPEAR_REP = 65;                       // 【廃止】黒田が現れる評判の条件（作者指定で撤廃。順番と日数だけで登場する）
                                                    // 黒田の要求は高価な設備ばかりなので、中盤以降＝買える体力が付いてから現れる
const KURODA_KEIEI_STAGE = 2;                       // 「数字で示す」を選んだ回数がこの値に達すると決戦の資格
const KURODA_DEMAND_CLEAR = 2;                      // 黒田の課題は最低この回数（それ以降は評判が目標に届くまで出し続ける）
const KURODA_GOAL_REP = 70;                         // 黒田編を終えた時の評判の目安（作者指定）＝ここに届いたら黒田が認める
const KURODA_DEMAND_GIVEUP = 15;                    // この日数たっても届かない課題は、黒田が別の手に切り替える
const KURODA_NAG_DAYS = 3;                          // 課題が未達なら、黒田が次に来るのは3日後（作者指定＝毎日来ると煩わしい）
const KURODA_MISS_SWAP = 3;                         // 3回続けて未達だったら、黒田が別の課題に差し替える（作者指定）
const DEMAND_NAJIMI_GAIN = 12;                      // 田所の要求を叶えたときに伸びる常連との絆
const DEMAND_REP_GAIN = 3;                          // 要求を叶えたときの評判の伸び
const KURODA_CASH_OK = 500000;                      // 健全経営の基準＝手元資金50万（＋資金ショートしていないこと）
const KURODA_KEIEI_GAIN_NAJIMI = 6;                 // 黒田イベントで「現場」を選んだ時に伸びる常連との絆
const REINA_APPEAR_REP = 68;                        // 玲奈が現れる評判（黒田の決着が済むまで現れない）
const REINA_STAGE = 2;                              // 買収を断り“孤高を貫いた回数”の上限目安（投票の共感票に加算）
const REINA_BUYOUT = 20000000;                      // 買収額（2,000万）＝受けると売却エンド分岐
/* 蒼天SPAの競合圧は「1日に来られる客数の上限」で表す（作者指定）。
   割合で減らすと、評判が高いほど減り方が大きく見えて（そして下手をすると気づかれずに）済んでしまう。
   30人・50人と数で頭を押さえれば、どれだけ店を磨いても客が来ない＝資本の壁が、毎日そのまま数字に出る */
const REINA_CAP_SHOCK = 30;                         // 出会いから3日間／初戦に敗れたあと（1日あたりの客数上限）
const REINA_CAP_DUEL = 50;                          // 買収を断ってから、初戦に敗れるまで
const REINA_BUYOUT_DAY = 3;                         // 出会いから何日後に買収提案が来るか（＝4日目）
const REINA_POACH_COST = 150000;                    // 引き抜きに対し「待遇を上げて引き留める」費用
const REINA_STAY_NAJIMI = 40;                       // 「本人に任せる」でバイトが忠義で残ってくれる常連絆の下限
const REINA_EQ_OFF = 0.85;                          // 玲奈が仲間＝設備15%引き（業界の伝手で安く仕入れられる）
// ── サウナ天下分け目の投票対決（第1章クライマックス）。※数値は叩き台
const REINA_DUEL_APPEAR_REP = 71;                   // この評判に達すると玲奈が“挑戦状”＝公開投票対決を仕掛けてくる
                                                    // 玲奈の初登場（69）とは少しだけ離す＝引き抜き・買収の揺さぶりを挟む余地を残す
const REINA_DUEL_PREP_DAYS = 5;                     // 初戦：テレビ放送から投票日までの5日間（作者指定）
const REINA_REMATCH_DUEL_DAYS = 3;                  // 再戦：テレビ放送から投票日までの3日間（作者指定）
const REINA_LOSE_REP = 20;
/* 再挑戦の条件は「決戦仕様の一台を組み上げること」だけ（作者指定で評判90の縛りは撤廃）。
   評判で足止めすると、勝つ手が揃っているのに待たされる＝物語が止まって見えるため */
const SOUTEN_DUEL_VOTES = 300;                      // 蒼天SPAの基礎票（規模・話題の壁）＝これを上回れば勝ち
const DUEL_W_REP = 3.2;                             // 夕凪票：評判の重み
const DUEL_W_NAJIMI = 2.4;                          // 夕凪票：常連の絆＝「また帰りたい」票の核
const DUEL_W_KOKO = 16;                             // 夕凪票：孤高stage＝買収を断ってきた物語への共感票
const DUEL_PREMIUM_V = 24;                          // 夕凪票：一級設備1つあたりの“ととのい”票
const DUEL_NAPPA_V = 70;                            // 夕凪票：世界一の熱波師＝体験の質の票（フェーズ4）
const DUEL_STAFF_V = 8;                             // 夕凪票：バイト1人あたり（本人と家族の票）
const DUEL_TOWN_V = 20;                             // 夕凪票：店に関わってきた人たち（修理業者・牛乳屋…）
const DUEL_TADOKORO_V = 20;                         // 夕凪票：田所が仲間＝地元票のあと押し
const REINA_PREMIUM_EQ = ['bath2', 'sauna3', 'sauna2', 'sauna_sp', 'mizu2', 'chair2']; // 一級品（個性ある設備）

function newToday() {
  return { paid: 0, sauna: 0, milk: 0, revenue: 0, satSum: 0, satN: 0,
           newN: 0, repeatN: 0, regularsUp: 0, regularsDown: 0,
           turnedAway: 0, totonoi: 0, voices: [], loanPay: 0, loanIn: 0,
           towelRev: 0, towelN: 0, akasuriRev: 0, akasuriN: 0, soapRev: 0, soapN: 0,
           teburaRev: 0, teburaN: 0, soapUnits: 0, totonoiTry: 0, gaveUp: 0, mikajime: 0,
           amenRev: 0, amenN: 0, milkRev: 0, autoYami: 0, yamiPaid: 0, repairCost: 0, unpaid: false,
           care: 0, queueMiss: 0, gripes: {}, satSeg: {}, dirtSum: 0, dirtN: 0, timeUpN: 0,
           /* 自販機は台ごとに本数・売上を分けて数える（作者指定 8/5）。
              以前は牛乳もドリンクも milk に合算していたので、**日報では牛乳しか売れていないように見えた** */
           vendN: {}, vendRev: {},
           waitSum: 0 };   // waitSum＝客が設備待ち・ロッカー待ちで立っていた時間の合計（混雑度に効く）
}

/* ---- 客層別の満足度（データ画面の診断表示。作者指定＝案3のタイプ別） ----
   狙いは「どこかに偏ると全体が歪む」のを目に見えるようにすること。
   ※これは評判スコアには一切混ぜない（作者と合意）。評判は1本のまま、ここは“どこが弱いか”を読む計器。
     5本の平均にしてしまうと、どこが悪いのか逆に分からなくなり、天井＋速度のカーブも壊れる */
/* ============================================================
   客層＝**性別5分類 × 2**（作者決定 8/2）
   ------------------------------------------------------------
   前は 老人/若者＝年齢・サウナー＝目的・女性客＝性別 と軸が混ざっていて、
   一人が複数に当てはまっていた（サウナ女子がサウナーに数えられない等）。
   **性別を先に切れば、中の5分類は同じ物差しになる。**
   風呂屋はそもそも男湯と女湯で部屋が別なので、建物の構造とも一致する。

   hint ＝ その層が見ているもの。**実在する仕組みだけを書く**
   （湯温は設備ごとの固定値なので「安定」は測れない＝「好みに合っているか」）
   ============================================================ */
const SEGMENTS = [
  { key: 'm_rojin',  sex: 'm', name: '老人',       types: ['jisan', 'shoten'],
    hint: 'あつ湯（42℃前後）・電気風呂・清潔さ・料金の安さ' },
  { key: 'm_sauner', sex: 'm', name: 'サウナー',   types: ['wakamono', 'sauner'],
    hint: 'サウナの温度・水風呂の冷たさ・サウナマット・ととのいイス' },
  { key: 'm_kaisha', sex: 'm', name: '会社員',     types: ['salaryman', 'shigoto', 'nomikaeri', 'oyaji'],
    hint: '待たされないこと・サウナ・帰りの一杯・遅い時間まで開いているか' },
  { key: 'm_wakai',  sex: 'm', name: '若者',       types: ['kinpatsu', 'gakusei', 'gaikoku'],
    hint: '設備の新しさ・手ぶらセット・ドライヤー・物販' },
  { key: 'm_kozure', sex: 'm', name: '子連れ',     types: ['oyako', 'kodomo'],
    hint: '子供料金・怖い客がいないか・ぬるめの湯・清潔さ' },

  { key: 'f_obasan', sex: 'f', name: 'オバサン',   types: ['obachan', 'okusan'],
    hint: 'ぬるめの湯・清潔さ・料金の安さ・洗い場の数' },
  { key: 'f_saunajo', sex: 'f', name: 'サウナ女子', types: ['saunajo'],
    hint: 'サウナの温度・水風呂・ととのいイス・パウダールーム' },
  { key: 'f_ol',     sex: 'f', name: 'OL',         types: ['ol', 'josei'],
    hint: 'アメニティ・ドライヤー・清潔さ・女性スタッフ' },
  { key: 'f_wakai',  sex: 'f', name: '若者',       types: ['joshidai'],
    hint: 'ドライヤー・パウダー・物販・設備の新しさ' },
  { key: 'f_kozure', sex: 'f', name: '子連れ',     types: ['hahako', 'musume'],
    hint: '子供料金・安心して入れるか・ぬるめの湯・清潔さ' },
];
function segOf(typeKey) {
  for (const s of SEGMENTS) if (s.types.includes(typeKey)) return s.key;
  return null;                                    // 強面の客（yakuza）はどの層にも入れない
}
function addSegSat(c) {
  const k = segOf(c.typeKey); if (!k) return;
  const m = (G.today.satSeg = G.today.satSeg || {});
  const e = (m[k] = m[k] || { sum: 0, n: 0 });
  e.sum += c.sat; e.n++;
}
/* 直近3日ぶんをならして返す。1日ぶんだと、その層が2〜3人しか来なかった日に数字が跳ねて読めない */
function segSatParts() {
  const hist = Array.isArray(G.recentSegSat) ? G.recentSegSat : [];
  const all = hist.concat(G.today && G.today.satSeg ? [G.today.satSeg] : []);
  return SEGMENTS.map(sg => {
    let sum = 0, n = 0;
    for (const day of all) { const e = day[sg.key]; if (e) { sum += e.sum; n += e.n; } }
    return { ...sg, avg: n ? Math.round(sum / n) : null, n };
  });
}

/* ---- 客の不満の集計（データ画面の「客の不満」欄） ----
   これまでは何が満足度を削っているのかを吹き出しで目撃するしかなかった。
   不満の声が出るたびに種類ごとに数えておいて、あとから内訳として読めるようにする */
const GRIPE_LABEL = {
  dirty:   '浴室が汚い',
  crowd:   '設備が混んでいて待たされた',
  locker:  'ロッカーが空かない・入れなかった',
  bandai:  '番台で待たされた',
  price:   '料金が高い',
  broken:  '設備が壊れている',
  temp:    '湯・サウナの温度が合わない',
  totonoi: 'ととのえなかった',
  dosen:   '導線が悪い（設備の配置）',
  lack:    '欲しい設備・備品がない',
  timeup:  '時間制限で途中で追い出された',
};
/* お客の声を1件ためる。w＝その声が満足度から奪った点数（＝評判への効きめ）。
   日報では種類ごとにまとめ、「奪った点数の合計」の多い順に出す＝その日の実態が上に来る。
   以前は先着6件＋抽選で拾っていたので、午前中にたまたま当たった声しか載らなかった。
   褒め言葉は w=0 で入れておき、不満の少ない日だけ顔を出す */
function voice(c, line, key, w, mark) {
  const vs = G.today && G.today.voices;
  if (!vs || vs.length >= 200) return;
  vs.push({ line, who: (c && c.type) ? c.type.name : '客', key, w: w || 0, mark: mark || '' });
}
function gripe(key, n) {
  if (!G.today.gripes) G.today.gripes = {};
  G.today.gripes[key] = (G.today.gripes[key] || 0) + (n || 1);
}
/* 直近3日＋今日の不満を、種類ごとに数えたもの。
   「客の不満」欄と、評判のマイナス評価の内訳（何点ぶん損しているか）の両方で使う */
function gripeSummary() {
  const sum = {};
  for (const g of (G.recentGripes || [])) for (const k in g) sum[k] = (sum[k] || 0) + g[k];
  for (const k in ((G.today && G.today.gripes) || {})) sum[k] = (sum[k] || 0) + G.today.gripes[k];
  return { sum, total: Object.values(sum).reduce((a, b) => a + b, 0) };
}

/* 設備の実寸（回転を考慮） */
// rot は 0〜3（90°刻み）。奇数のとき幅と高さが入れ替わる
function ew(idOrIt, rot) {
  if (typeof idOrIt === 'object') { rot = idOrIt.rot; idOrIt = idOrIt.id; }
  return (rot & 1) ? EQ[idOrIt].h : EQ[idOrIt].w;
}
function eh(idOrIt, rot) {
  if (typeof idOrIt === 'object') { rot = idOrIt.rot; idOrIt = idOrIt.id; }
  return (rot & 1) ? EQ[idOrIt].w : EQ[idOrIt].h;
}
// 全設備を回転可能に（正方形の設備も向きを変えられる＝見た目が変わる）
function canRotate(id) { return true; }

/* ============ 区画（マップ）============
   第1章は区画がひとつ＝画面1枚（CONF.areas を持たない）。
   第2章は【館内案内図】から5区画（ロビー＆駐車場／食堂／男湯／女湯／休憩スペース）を行き来する。

   仕掛けはひとつだけ。**CONF.W/H/divideY/entrance/doorX は「いま開いている区画」の値を指す**。
   区画を移るたびにここを差し替えるので、CONF.W を見ている既存のコード（74箇所）には一切手を入れなくていい。
   区画ごとに分けるのは、地図そのものを扱う数カ所（設備の当たり判定・到達チェック・描画）だけ。
   日々の傷み・修理・評判・カタログ・売上は、これまでどおり全区画をまとめて見る。          */
function areaList() { return (CONF.areas && CONF.areas.length) ? CONF.areas : null; }
function areaCount() { const l = areaList(); return l ? l.length : 1; }
function areaDef(f) { const l = areaList(); return l ? l[clamp(f | 0, 0, l.length - 1)] : null; }
/* いま CONF が指している区画＝「計算中の区画」。
   営業中は5区画ぶんを順番に計算するので、画面に出ている区画（G.viewF）とは別に持つ。
   ・G.actF … CONF.W/H が指している区画（設備の当たり判定・経路探索はここを見る）
   ・G.viewF … 画面に出している区画（-1 なら館内案内図）                        */
function inArea(o) { return (o.f | 0) === (G.actF | 0); }
function areaEquip() { return G.equip.filter(inArea); }

/* CONF の間取りを、その区画のものに差し替える */
function applyArea(f, quiet) {
  const l = areaList();
  /* 区画を持たない章（第1章）。間取りは CONF に直接書いてあるので付け替えるものは無いが、
     **キャンバスの寸法だけは張り直す。** 第2章から戻ってきたとき、
     画面が第2章の部屋の大きさのままになり、第1章がその中に描かれてしまう */
  if (!l) { G.actF = 0; if (G.viewF !== -1) G.viewF = 0; if (!quiet) resizeStage(); return; }
  G.actF = clamp(f | 0, 0, l.length - 1);
  const a = l[G.actF];
  CONF.W = a.W; CONF.H = a.H; CONF.divideY = a.divideY;
  CONF.outdoorY = a.outdoorY || 0;        // これより上が屋外ゾーン（外気浴デッキ・テントサウナ）
  CONF.entrance = a.entrance; CONF.doorX = a.doorX;
  CONF.entranceTop = a.entranceTop || null;   // 上壁の通路（無い区画は null）
  CONF.topDoors = a.topDoors || null;         // 上壁の通路が複数ある区画（廊下）
  CONF.topLabels = a.topLabels || null;       // その戸の行き先（▲男湯 など）
  if (!quiet) resizeStage();
}
/* 区画ごとに順番に計算する（営業中の客・バイトの更新）。終わったら表示中の区画へ戻す */
function forEachArea(fn) {
  const n = areaCount();
  if (n <= 1) { fn(0); return; }
  const back = G.actF;
  for (let f = 0; f < n; f++) { applyArea(f, true); fn(f); }
  applyArea(back, true);
}
/* 描画用のキャンバスを、いまの区画の大きさに張り直す */
function resizeStage() {
  if (typeof cv === 'undefined' || !cv) return;
  const w = CONF.W * T * CONF.SS, h = CONF.H * T * CONF.SS;
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
}

/* ============ 屋号（章ごとに別）============
   第1章は親父から継いだ「夕凪湯」、第2章は自分で買った施設の名前。
   **章をまたいで名前が漏れないようにする**（作者指定）＝
   章を切り替えた時点でその章の既定に戻し、セーブから読んだらそのセーブの名前にする */
function nameConf() {
  return (CONF.shopNaming) || {
    def: '夕凪湯',
    title: '銭湯の屋号を決めよう',
    note: 'のれんに書く名前だ。親父の「夕凪湯」のままでもいい。',
    suggests: ['夕凪湯', 'サウナ夕凪', '俺のサウナ'],
  };
}
function defaultShopName() { return nameConf().def; }
function openNameModal() {
  const n = nameConf();
  $('nameTitle').textContent = n.title;
  $('nameNote').textContent = n.note;
  $('nameInput').value = n.def;
  const box = $('nameSuggests');
  box.innerHTML = '';
  for (const s of n.suggests) {
    const b = document.createElement('button');
    b.className = 'chip'; b.textContent = s;
    b.onclick = () => $('nameInput').value = s;
    box.appendChild(b);
  }
  $('nameModal').classList.remove('hidden');
}

/* ============ 館内案内図（第2章）============
   区画が5つに散るので、タブではなく「施設の間取り1枚」で行き来する。
   ナビと状況把握を兼ねる＝どこが汚れ・混み・壊れているかが、この画面で分かる。
   第1章は区画がひとつなので、この画面自体を出さない                       */
/* 案内図を並べるマス目。ロビー＆駐車場だけ縦2つぶん取る＝
   中身がほぼ駐車場なので、横に潰れると何台停まっているか読めなくなる */
/* 館内案内図の枡目。区画データ側で上書きできる（廊下を1段足したので第2章は5行） */
let GUIDE_COL = 4, GUIDE_ROW = 4;
let guideRects = [];                      // タップ判定用（区画ごとの矩形）

/* いま案内図を開いているか（区画の中に居ない状態） */
/* 飲み物の自販機と、その1本の値段。**章をまたいで1か所にまとめる**
   （id を各所に散らすと、章が変わったとき静かに売れなくなる） */
/* y_milk＝第2章の牛乳の自販機（2026-08-09 追加）。ここに無いと**1本も売れない**
   （設備として置けるのに、客が買いに来る機械の一覧から漏れていた） */
const DRINK_VEND = { vend1: 130, vend2: 180, y_vend: 180, y_milk: 130 };
// 日報に出す短い名前（台の正式名は長いので、ここで「牛乳」「ドリンク」に縮める）
const DRINK_VEND_LABEL = { vend1: '牛乳', vend2: 'ドリンク', y_vend: 'ドリンク', y_milk: '牛乳' };
function onGuide() { return G.viewF < 0; }
/* 開店時刻。**章が営業時間を持っていれば、そちらが正**（第2章＝プレイヤーが1時間刻みで決める）。
   第1章はフックを持たないので CONF.openHour のまま＝何も変わらない */
function openHourNow() { const h = chHook('openHour'); return h == null ? CONF.openHour : h; }
/* いまの時刻（0〜24の実数）。G.minutes は開店時刻からの分 */
function nowHour() { return ((((openHourNow() + G.minutes / 60) % 24) + 24) % 24); }
/* 主人公がいま店にいるか（作者指定＝9:00に来て21:00に帰る）。
   店にいない時間は、家にいることになっている＝画面にも出ないし、掃除もしない。
   第1章は CONF.workHours を持たないので、いつでも店にいる            */
function onDuty() {
  /* 章が「主人公が店に立つ時間」を持っていれば、そちらが正
     （第2章＝15時〜22時。深夜まで開けても、主人公は22時で帰る） */
  const w = chHook('workHours') || CONF.workHours;
  if (!w) return true;
  /* ⚠ **勤務時間は「営業中」の話。** 準備中は時計が止まっていて、`nowHour()` は
     前の日の閉店時刻を指したままになる。それを勤務時間と突き合わせていたので、
     第2章の主人公は**準備中に一度も掃除していなかった**（100日通しで発見・2026-08-07）。
     ＝深夜に溜まった汚れが朝まで残り、開店の瞬間に濃い汚れ12個から始まっていた。
     第1章は workHours を持たないので上の行で抜ける＝挙動は変わらない */
  if (G.phase !== 'biz') return true;
  const h = nowHour();
  return h >= w[0] && h < w[1];
}
/* その人がいま店にいるか（バイト・妻）。遅刻中は来ていないし、
   章が「もう帰った」と言えば居ない（第2章＝22時で日勤は上がる）。
   **動かす側と描く側の両方でこれを使う**＝帰ったのに絵だけ残る、を防ぐ */
function workerHere(s) { return !(s.lateT > 0) && !chHook('workerOff', s); }
/* 主人公がその部屋に入れないか。女湯は**営業中だけ**入れない（作者指定）＝
   客がいない準備中・開業前は、掃除も設備の配置も自分の手でやる */
function playerBanned(f) {
  const a = areaDef(f);
  return !!(a && a.noPlayer && G.phase === 'biz');
}
/* 家は「区画」として持っているが、店ではない＝館内案内図にも出ないし、客も来ない */
function isHomeArea(f) { const a = areaDef(f); return !!(a && a.home); }
function onHome() { return G.viewF >= 0 && isHomeArea(G.viewF); }
function homeAreaIdx() { return (CONF.areas || []).findIndex(a => a.home); }
/* 店の区画だけ（＝家を抜いたもの）。案内図と、主人公の見回りが使う */
function shopAreas() { return (CONF.areas || []).filter(a => !a.home); }

/* 案内図を開く */
function openGuide() {
  if (areaCount() <= 1) return;
  G.viewF = -1;
  applyArea(0, true);          // 表示は案内図。計算の足場だけ1つ目の区画に置いておく
  deselect(); endPlacing();
  $('game').classList.add('hidden');
  $('guide').classList.remove('hidden');
  syncAreaBar();                       // 帯は残す（家と体力は案内図からも見える）
  $('hint').classList.add('hidden');
  /* 案内図では設備カタログを出さない（作者指定）。
     ここは「どの部屋へ行くか」を選ぶ画面で、買い物は部屋に入ってからやる。
     カタログを畳むぶん、間取り図がスマホの画面にそのまま収まる */
  $('shopPanel').classList.add('hidden');
  drawGuide();
}
/* 【← 館内案内図】の帯を、いまの状態に合わせる。
   区画が2つ以上あって、案内図そのものを開いていないときだけ出す。
   はじめから／つづきから で最初の部屋に立ったときも、ここを通らないと帯が出ない */
function syncAreaBar() {
  const bar = $('areaBar'); if (!bar) return;
  const show = areaCount() > 1;
  bar.classList.toggle('hidden', !show);
  /* ⚠ **ここで素通りに return すると、下の【外観・集客・増築】を畳み忘れる。**
     区画が1つの章（第1章）はこの行で抜けるので、第2章で外観のメニューを開いたあと
     第1章へ戻ると、**そのメニューが第1章の画面に残ったまま**になっていた
     （作者指摘 8/8。実測＝第2章の案内図 → 第1章 でカード3枚が残る）。
     区画が1つの章に外観のメニューは無いので、抜ける前に必ず畳む            */
  if (!show) {
    const gp0 = $('gaikanPanel');
    if (gp0) gp0.classList.add('hidden');
    return;
  }
  /* 案内図を見ている間は「案内図へ戻る」だけ引っ込める。
     帯そのものは残す＝【🏠 家へ】と体力バーは、どの画面からでも見える */
  const guide = onGuide();
  $('btnToGuide').classList.toggle('hidden', guide);
  /* 【🪧 外観】＝看板を買う画面。**ビルの外観を見ているときだけ**出す（第2章）。
     その章が openGaikan フックを持っていなければ、ボタンごと出さない */
  /* ビルの外観を見ている間は、下に**外観アイテム**を並べる（第2章）。
     各階では設備カタログが出る場所と同じ＝買い物の場所が画面の中で一定になる */
  const gp = $('gaikanPanel');
  if (gp) {
    const on = guide && hasHook('renderGaikan') && (G.phase === 'prep' || G.phase === 'biz');
    gp.classList.toggle('hidden', !on);
    if (on) chHook('renderGaikan');
  }
  const a = areaDef(G.actF);
  /* 見出しは【🏢 外観】（作者指定 8/8）。画面に映っているのは案内図というより
     ビルを外から見た絵なので、そのまま呼ぶ。中へ入る帯のボタンは【← 外に出る】 */
  $('areaLabel').textContent = guide ? '🏢 外観'
    : a ? a.name + (playerBanned(G.actF) ? '（営業中は入れない）' : '') : '';
}
/* 区画に入る */
function enterAreaScreen(f) {
  applyArea(f);
  G.viewF = G.actF;            // 画面もその区画に切り替える
  /* 案内図のあいだ畳んでいたヒントを戻す。
     ただし家では出さない＝店の話（ゴミ・工事・開業）は、家の中では関係ない。
     章が部屋ごとの案内を持っていれば（第2章の開業前）、入った部屋のものに差し替える＝
     **いま立っている部屋に何が足りないかを、その場で名指しで言う** */
  if (isHomeArea(f)) $('hint').classList.add('hidden');
  else {
    /* 章が部屋ごとの案内を持っていれば、その部屋のものに差し替える。
       空を返したら**黙る**（第2章は上の一行に移したので、下は出さない場面がある） */
    if (G.phase === 'prep' && hasHook('prepHint')) setHint(chHook('prepHint'));
    else setHint(lastHint);
  }
  syncTip();                   // 上の一行も、入った部屋に合わせて引き直す
  // 部屋に入ったら設備カタログを戻す（買い物は部屋の中でやる）。家では出さない
  if ((G.phase === 'prep' || G.phase === 'biz') && !isHomeArea(f)) $('shopPanel').classList.remove('hidden');
  else $('shopPanel').classList.add('hidden');
  $('guide').classList.add('hidden');     // 区画の中に入ったら案内図は畳む（第1章でも必ず畳む）
  $('game').classList.remove('hidden');
  const multi = areaCount() > 1;
  syncAreaBar();
  if (multi) {
    const a = areaDef(f);
    /* 主人公は、案内図で選んだ部屋にそのまま立たせる（作者指定）。
       部屋から部屋へ歩かせる必要はない＝入った瞬間、そこに居る。
       女湯だけは入れないので、居場所は動かさない（画面だけ覗く）

       **第2章は付いて来ない**（作者指定 8/5）＝主人公は自分の判断で、
       汚れの残っている階へエレベーターで上がっていく。画面を切り替えるのは
       「見に行く」であって「連れて行く」ではない。noWarpPlayer で止める */
    if (!playerBanned(f) && G.player && !chHook('noWarpPlayer')) warpPlayerTo(f);
    // カタログを、いま入った部屋に置けるものだけに並べ直す
    if (G.phase === 'prep' || G.phase === 'biz') renderShop();
  }
}
/* 主人公をその区画の入口に立たせる。やりかけの仕事は畳む */
function warpPlayerTo(f) {
  const p = G.player;
  if ((p.f | 0) === f) return;
  const back = G.actF;
  applyArea(f, true);
  /* 受付のある区画（ロビー）では番台の横。それ以外の部屋は、入口を入ってすぐのところ */
  const s = bandai() && (bandai().f | 0) === f
    ? playerSpot()
    : { x: CONF.entrance.x, y: CONF.entrance.y - 1 };
  applyArea(back, true);
  p.f = f;
  p.px = s.x * T + T / 2; p.py = s.y * T + T / 2;
  p.path = null; p.target = null; p.task = null; p.timer = 0;
}

/* 区画ごとの状態（案内図に出す数字）。まだ客の回遊が入っていないので、
   いまは汚れと故障だけが本物で、客数は0のまま */
function areaStatus(f) {
  const eq = G.equip.filter(e => (e.f | 0) === f);
  return {
    guests: G.customers.filter(c => (c.f | 0) === f).length,
    dirt: G.dirts.filter(d => (d.f | 0) === f).length,
    broken: eq.filter(e => (CONF.wearPerDay[EQ[e.id].cat] ?? 0) > 0 && e.cond <= 0).length,
    empty: eq.length === 0,
    player: G.player && onDuty() && (G.player.f | 0) === f,
    /* その部屋に残っている宿題。第2章の開業前だけ立つ（第1章はフックを持たない）。
       部屋が5つあると、見ていない部屋で何も起きていないことに気づけない */
    todo: chHook('areaTodo', f) || null,
    /* スタッフがいない部屋は客が入れない（第2章）。理由の文字列、開いていれば null */
    closed: chHook('areaClosedWhy', f) || null,
    unmanned: !!chHook('areaUnmanned', f),      // 開いているが、担当が遅刻中
  };
}

const CORRIDOR_COL = '#7d6647';           // 廊下の床
const GUIDE_GAP = 15;                     // 部屋と部屋のあいだ＝廊下の幅（片側）

function drawGuide() {
  const list = shopAreas(); if (!list || !list.length) return;   // 家は間取り図に出さない
  GUIDE_COL = CONF.guideCol || 4; GUIDE_ROW = CONF.guideRow || 4;
  const gcv = $('guide');
  const W = 1040, H = 1150;
  if (gcv.width !== W) { gcv.width = W; gcv.height = H; }
  const g = gcv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  guideRects = [];

  /* 章ごとに、この画面そのものを差し替えられる（第2章＝ビルを横から見た外観）。
     フックが true を返したら、以下の「間取り図」は描かない。
     第1章はフックを持たないので、これまでどおり                          */
  if (chHook('drawGuide', g, W, H, list)) return;

  const cw = (W - 24) / GUIDE_COL, ch = (H - 24) / GUIDE_ROW;
  const rect = a => ({
    x: 12 + a.gx * cw + GUIDE_GAP, y: 12 + a.gy * ch + GUIDE_GAP,
    w: a.gw * cw - GUIDE_GAP * 2, h: a.gh * ch - GUIDE_GAP * 2,
  });

  /* ここは「監視カメラの画面を並べたもの」ではなく、**一枚の間取り図**にする。
     ・部屋と部屋のあいだの隙間は黒ではなく【廊下】
     ・どの部屋にも廊下へ抜ける【戸口】がある
     ・建物の外側は敷地（駐車場・国道）                                    */
  g.fillStyle = '#241f1b'; g.fillRect(0, 0, W, H);      // 敷地（屋外）

  // 建物の輪郭。ロビー区画の「屋内のところまで」が建物の下端になる
  const lobby = list.find(a => a.park) || list[list.length - 1];
  const lr = rect(lobby);
  const buildBottom = lr.y + lr.h * (lobby.divideY / lobby.H);
  const bx = 12, by = 12, bw = W - 24, bh = buildBottom - 12;
  g.fillStyle = CORRIDOR_COL; g.fillRect(bx, by, bw, bh);
  // 廊下の床目地
  g.strokeStyle = 'rgba(0,0,0,.10)'; g.lineWidth = 2;
  for (let lx = bx; lx < bx + bw; lx += 30) { g.beginPath(); g.moveTo(lx, by); g.lineTo(lx, by + bh); g.stroke(); }
  for (let ly = by; ly < by + bh; ly += 30) { g.beginPath(); g.moveTo(bx, ly); g.lineTo(bx + bw, ly); g.stroke(); }

  for (let f = 0; f < list.length; f++) {
    const a = list[f], st = areaStatus(f);
    const { x, y, w, h } = rect(a);
    guideRects.push({ x, y, w, h, f });

    /* 部屋の中身を、上から見下ろした見取り図として描く（実際に置いてある設備をそのまま縮小して並べる）。
       名前だけの札より、どの部屋に何がどう入っているかが一目で分かる */
    drawAreaMini(g, f, a, x, y, w, h, st);
    /* スタッフのいない部屋は客が入れない＝閉まっているのが一目で分かるよう暗く落とす。
       名札とバッジはこの上に乗るので、読めなくならない（第1章はこのフックを持たない） */
    if (st.closed) { g.fillStyle = 'rgba(12,10,8,.62)'; g.fillRect(x, y, w, h); }

    g.lineWidth = 5;
    g.strokeStyle = st.player ? '#6ab0d8' : '#8a7a5a';
    g.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);

    /* 廊下へ抜ける戸口。部屋の入口（entrance）の位置に、壁をくり抜いて廊下の床を通す。
       ロビーだけは上（廊下側）に開く＝客は入口→ロビー→廊下→各部屋、と歩く */
    drawGuideDoor(g, a, x, y, w, h);

    // 部屋の名札（左上に小さく置く＝見取り図を隠さない）
    g.textAlign = 'left';
    const lw = a.name.length * 24 + 30;
    g.fillStyle = 'rgba(20,16,12,.78)'; guideRound(g, x + 10, y + 8, lw, 40, 6); g.fill();
    g.fillStyle = '#f5ead8'; g.font = 'bold 26px "DotGothic16",sans-serif';
    g.fillText(a.name, x + 22, y + 36);
    g.textAlign = 'center';

    // 客の数（右上）
    if (st.guests) {
      g.fillStyle = 'rgba(20,16,12,.78)'; guideRound(g, x + w - 108, y + 8, 96, 40, 6); g.fill();
      g.fillStyle = '#ffd98a'; g.font = 'bold 26px "DotGothic16",sans-serif';
      g.fillText('👤 ' + st.guests, x + w - 60, y + 36);
    }

    const badges = [];
    if (st.closed) badges.push(['#8a3030', '🚫 利用不可']);
    else if (st.unmanned) badges.push(['#c9863a', '🕒 無人']);
    if (st.todo) badges.push(['#c9a86a', st.todo]);
    if (st.dirt) badges.push(['#c46a6a', '汚れ ' + st.dirt]);
    if (st.broken) badges.push(['#8a3030', '⚠ 故障']);
    let bx = x + w / 2 - (badges.length * 112) / 2;
    for (const [c, t] of badges) {
      g.fillStyle = c; guideRound(g, bx, y + h - 56, 104, 34, 6); g.fill();
      g.fillStyle = '#1c1714'; g.font = 'bold 20px "DotGothic16",sans-serif';
      g.fillText(t, bx + 52, y + h - 32);
      bx += 112;
    }
    if (st.player) {
      g.fillStyle = '#6ab0d8'; guideRound(g, x + w - 130, y + 12, 118, 32, 6); g.fill();
      g.fillStyle = '#0e1a20'; g.font = 'bold 20px "DotGothic16",sans-serif';
      g.fillText('いまここ', x + w - 71, y + 35);
    }
  }
  // 建物の外壁（いちばん外側に一本）
  g.strokeStyle = '#4a3a2c'; g.lineWidth = 8;
  g.strokeRect(bx + 4, by + 4, bw - 8, bh - 8);
}

/* 部屋と廊下をつなぐ戸口。壁をくり抜いて、廊下の床をそのまま部屋の際まで通す */
function drawGuideDoor(g, a, x, y, w, h) {
  const scx = w / a.W, scy = h / a.H;
  const dw = 3 * scx, dx = x + (a.doorX - 1) * scx;
  g.fillStyle = CORRIDOR_COL;
  if (a.park) {
    // ロビーは上（廊下側）に開く
    g.fillRect(dx, y - GUIDE_GAP - 2, dw, scy + GUIDE_GAP + 4);
  } else {
    // ほかの部屋は下（廊下側）に開く
    g.fillRect(dx, y + h - scy - 2, dw, scy + GUIDE_GAP + 4);
  }
  // 敷居（戸のあるところが分かるように、細い線を1本）
  g.strokeStyle = 'rgba(60,44,30,.7)'; g.lineWidth = 3;
  const ly = a.park ? y + 2 : y + h - 2;
  g.beginPath(); g.moveTo(dx, ly); g.lineTo(dx + dw, ly); g.stroke();
}
/* ============ 国道を走る車 ============
   敷地の下端を国道が横切っている。そこに車を流す。
   ゲームの計算には一切関わらない**ただの飾り**だが、これがあるだけで店が生きて見える。

   ・日本の道なので左側通行＝上の車線は左へ、下の車線は右へ流れる
   ・**追い越しはしない**（作者指定）。前の車に追いつくと、その後ろで速度を落とす   */
const TRAFFIC = {
  road: [],        // 国道を流れる車
  last: 0,         // 前に描いた時刻（秒）
  seed: 20260731,  // 見た目のばらつき用（ゲームの乱数には触らない）
};
const CAR_COLORS = ['#c0473a', '#e8e2d4', '#4a6f9a', '#5a8a5a', '#d8a84a', '#8a8f96', '#6a5a8a', '#2f3238'];
function tRand() {                                   // 飾り専用の乱数（Math.random を使わない）
  TRAFFIC.seed = (TRAFFIC.seed * 1103515245 + 12345) & 0x7fffffff;
  return TRAFFIC.seed / 0x7fffffff;
}
function tPick(a) { return a[(tRand() * a.length) | 0]; }

/* 上から見た車を1台描く。(px,py)＝中心、ang＝進行方向（0=右） */
function drawCar(g, px, py, len, wid, ang, col, big) {
  g.save();
  g.translate(px, py); g.rotate(ang);
  const L = len / 2, W = wid / 2;
  g.fillStyle = 'rgba(0,0,0,.30)'; g.fillRect(-L + 1.5, -W + 2, len, wid);   // 影
  g.fillStyle = '#241f1c';                                                   // タイヤ
  for (const k of [-0.28, 0.28]) {
    g.fillRect(k * len - len * 0.07, -W - 1.2, len * 0.14, 1.6);
    g.fillRect(k * len - len * 0.07, W - 0.4, len * 0.14, 1.6);
  }
  g.fillStyle = col; g.fillRect(-L, -W, len, wid);                           // 車体
  if (big) {
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(L - len * 0.28, -W, len * 0.28, wid);       // 運転台
    g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(-L + len * 0.04, -W * 0.8, len * 0.6, wid * 0.8); // 荷台
  } else {
    g.fillStyle = 'rgba(0,0,0,.20)'; g.fillRect(-len * 0.24, -W * 0.8, len * 0.44, wid * 0.8);  // 屋根
    g.fillStyle = 'rgba(190,225,245,.80)'; g.fillRect(L - len * 0.34, -W * 0.66, len * 0.10, wid * 0.66);
    g.fillStyle = 'rgba(190,225,245,.55)'; g.fillRect(-L + len * 0.22, -W * 0.62, len * 0.08, wid * 0.62);
    g.fillStyle = col;                                                       // ドアミラー
    g.fillRect(L - len * 0.30, -W - 1.4, len * 0.06, 1.4);
    g.fillRect(L - len * 0.30, W, len * 0.06, 1.4);
  }
  g.fillStyle = '#ffe9a8';                                                   // ヘッドライト
  g.fillRect(L - 2, -W + 0.5, 2, wid * 0.22); g.fillRect(L - 2, W - wid * 0.22 - 0.5, 2, wid * 0.22);
  g.fillStyle = '#d8483a';                                                   // テールランプ
  g.fillRect(-L, -W + 0.5, 1.5, wid * 0.2); g.fillRect(-L, W - wid * 0.2 - 0.5, 1.5, wid * 0.2);
  g.restore();
}

/* 1フレームぶん進める（描く直前に呼ぶ） */
function stepTraffic(a, dt) {
  const W = a.W;
  // ── 国道
  if (TRAFFIC.road.length < 7 && tRand() < dt * 1.1) {
    const lane = tRand() < .5 ? 0 : 1;                  // 0=上（左へ）／1=下（右へ）
    const big = tRand() < .18;
    TRAFFIC.road.push({ lane, big, col: tPick(CAR_COLORS),
      x: lane ? -3 : W + 3, want: 1.6 + tRand() * 2.6, spd: 0 });
  }
  for (const c of TRAFFIC.road) {
    const dir = c.lane ? 1 : -1;
    const len = c.big ? 2.2 : 1.1;
    /* 追い越さない＝同じ車線の前の車との間合いを見て、速度を落とす */
    let cap = c.want;
    for (const o of TRAFFIC.road) {
      if (o === c || o.lane !== c.lane) continue;
      const ahead = (o.x - c.x) * dir;                  // 前にいるほど正
      if (ahead <= 0) continue;
      const need = len / 2 + (o.big ? 1.1 : 0.55) + 0.5;
      if (ahead < need) cap = 0;                        // 詰まった＝止まる
      else if (ahead < need * 2.4) cap = Math.min(cap, o.spd * 0.92);
    }
    c.spd += Math.max(-8 * dt, Math.min(2.2 * dt, cap - c.spd));   // 急発進・急停止はしない
    c.x += dir * c.spd * dt;
  }
  TRAFFIC.road = TRAFFIC.road.filter(c => c.x > -6 && c.x < W + 6);
}

/* 国道の車を描く（ロビー＆駐車場の区画からだけ呼ばれる） */
function drawTraffic(g, a, ox, oy, scx, scy) {
  const now = performance.now() / 1000;
  const dt = Math.min(0.1, TRAFFIC.last ? now - TRAFFIC.last : 0.016);
  TRAFFIC.last = now;
  stepTraffic(a, dt);

  const roadY = a.H - 1;
  const wid = scy * 0.30, len = wid * 2.4;
  for (const c of TRAFFIC.road) {
    const py = oy + (roadY + (c.lane ? 0.72 : 0.28)) * scy;
    drawCar(g, ox + c.x * scx, py, c.big ? len * 2.2 : len, wid, c.lane ? 0 : Math.PI, c.col, c.big);
  }
}

/* 案内図の中の1部屋を、上から見下ろした見取り図として描く。
   その区画のマス目をそのまま縮小し、床・壁・設備・汚れ・客を実データから並べる */
function drawAreaMini(g, f, a, x, y, w, h, st) {
  /* 区画ごとに縦横の比率が違うので、比率を保つと札の中に黒い余白ができてしまう。
     見取り図は「間取りの記号」であって写真ではないので、**札いっぱいに引き伸ばして**埋める。
     縦横で別々の倍率を持つのはそのため                                              */
  const scx = w / a.W, scy = h / a.H;
  const ox = x, oy = y;
  const back = G.actF;
  applyArea(f, true);                                // その区画の間取りで色を引く

  g.fillStyle = '#1c1714'; g.fillRect(x, y, w, h);
  // 床
  for (let ty = 1; ty < a.H - 1; ty++) {
    const outdoor = a.park && ty >= a.divideY;
    const x0 = outdoor ? 0 : 1, x1 = outdoor ? a.W : a.W - 1;
    for (let tx = x0; tx < x1; tx++) {
      g.fillStyle = floorColor(tx, ty);
      g.fillRect(ox + tx * scx, oy + ty * scy, scx + .5, scy + .5);
    }
  }
  // 壁（駐車場のある区画は、屋外に壁が無い）
  const wallBottom = a.park ? a.divideY : a.H - 1;
  g.fillStyle = '#5a4436';
  g.fillRect(ox, oy, a.W * scx, scy);                                 // 上
  g.fillRect(ox, oy, scx, wallBottom * scy);                          // 左
  g.fillRect(ox + (a.W - 1) * scx, oy, scx, wallBottom * scy);        // 右
  if (!a.park) g.fillRect(ox, oy + (a.H - 1) * scy, a.W * scx, scy);  // 下
  // 浴室と脱衣所の間仕切り（引き戸のぶんだけ空ける）
  if (a.divideY && !a.park) {
    g.fillStyle = '#6b533c';
    g.fillRect(ox + scx, oy + a.divideY * scy - scy * .18, (a.doorX - 1) * scx, scy * .36);
    g.fillRect(ox + (a.doorX + 1) * scx, oy + a.divideY * scy - scy * .18,
               (a.W - 2 - a.doorX) * scx, scy * .36);
  }
  // 建物の正面（ロビー↔駐車場）と、敷地の下端に走る国道
  if (a.park) {
    const ry = oy + (a.H - 1) * scy;
    g.fillStyle = '#3a3a3c'; g.fillRect(ox, ry, a.W * scx, scy);      // 路面
    g.strokeStyle = 'rgba(240,230,180,.6)'; g.lineWidth = Math.max(2, scy * .08);
    g.setLineDash([scx * .5, scx * .4]);
    g.beginPath(); g.moveTo(ox, ry + scy / 2); g.lineTo(ox + a.W * scx, ry + scy / 2); g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#5a4436';
    g.fillRect(ox, oy + a.divideY * scy - scy * .22, a.W * scx, scy * .44);
    g.fillStyle = 'rgba(198,232,242,.7)';
    g.fillRect(ox + (a.doorX - 1) * scx, oy + a.divideY * scy - scy * .3, 3 * scx, scy * .6);
  }

  /* 設備（舗装は床として塗ってあるので、ここでは描かない）。
     カテゴリごとの色板で置く＝どこに何系統のものがどう並んでいるかが、形で読める */
  for (const e of G.equip) {
    if ((e.f | 0) !== f || EQ[e.id].floorTile) continue;
    const d = EQ[e.id];
    const ew2 = ew(e) * scx, eh2 = eh(e) * scy;
    const px = ox + e.x * scx, py = oy + e.y * scy;
    const dead = e.cond <= 0 && (CONF.wearPerDay[d.cat] ?? 0) > 0;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(px + 2, py + 2, ew2, eh2);
    g.fillStyle = dead ? '#8a3030' : (CH2_TILE_COL[d.cat] || '#7a6a5a');
    g.fillRect(px + 1, py + 1, ew2 - 2, eh2 - 2);
    g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1.5;
    g.strokeRect(px + 1.5, py + 1.5, ew2 - 3, eh2 - 3);
  }

  // 国道を流れる車（設備の上に重ねる）
  if (a.park) drawTraffic(g, a, ox, oy, scx, scy);

  // 汚れ
  for (const d of G.dirts) {
    if ((d.f | 0) !== f) continue;
    g.fillStyle = '#5a4630';
    g.beginPath(); g.ellipse(ox + (d.x + .5) * scx, oy + (d.y + .5) * scy, scx * .22, scy * .16, 0, 0, 7); g.fill();
  }
  // 客（いる場所にそのまま点を打つ）
  for (const c of G.customers) {
    if ((c.f | 0) !== f) continue;
    g.fillStyle = (c.type && c.type.sex === 'f') ? '#e29ac0' : '#8ab4e0';
    g.beginPath(); g.arc(ox + c.px / T * scx, oy + c.py / T * scy, Math.min(scx, scy) * .24, 0, 7); g.fill();
  }
  // 主人公（顔だけの姿で、いま居る場所に立つ）
  if (st.player && G.player)
    if (onDuty()) drawMiniFace(g, ox + G.player.px / T * scx, oy + G.player.py / T * scy, Math.min(scx, scy) * .62);
  applyArea(back, true);
}

/* 案内図の中の主人公＝顔だけ（作者指定）。
   部屋を歩き回るのを、点ではなく「その人」として見せる。
   d ＝ 顔の大きさ（マスの6割ほど） */
function drawMiniFace(g, cx, cy, d) {
  /* ゲーム本編（drawCharBody）の主人公の頭を、そのまま縮めて描く。
     本編は頭の半径6・髪は少し上にずらした半円・目は四角・頭に白いタオル、で出来ている。
     ここで別の描き方をすると「知らない誰か」になってしまうので、数字ごと合わせてある */
  const R = Math.max(6, d / 2), k = R / 6;
  g.save();
  g.translate(cx, cy); g.scale(k, k);
  g.fillStyle = 'rgba(0,0,0,.30)';                                       // 足元の影
  g.beginPath(); g.ellipse(0, 7.5, 5.5, 2, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f2c9a0';                                               // 顔
  g.beginPath(); g.arc(0, 0, 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2a2a2a';                                               // 髪
  g.beginPath(); g.arc(0, -1.5, 6, Math.PI, 0); g.fill();
  g.fillStyle = '#fff';                                                  // 頭に巻いたタオル
  g.fillRect(-6, -5, 12, 3.5);
  g.fillStyle = 'rgba(0,0,0,.10)'; g.fillRect(-6, -1.8, 12, 0.6);        // タオルの下端の影
  g.fillStyle = '#333';                                                  // 目
  g.fillRect(-3, 0, 1.7, 1.7); g.fillRect(1.5, 0, 1.7, 1.7);
  g.restore();
}

function guideRound(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

/* ============ マップ・経路 ============ */
/* 駐車場は屋外なので、左右に壁が無い（作者指定）。
   仕切りから下・国道の手前までは、いちばん外の列まで敷地＝歩けるし、物も置ける。
   第1章には区画が無いので、この関数は常に false ＝ 何も変わらない */
function inOpenLot(y) {
  const a = areaDef(G.actF);
  return !!(a && a.park && y >= a.divideY && y < CONF.H - 1);
}
function isWall(x, y) {
  // 上壁にも通路がある区画（ロビーの奥／休憩・食堂の浴室側）。
  // 開いているのは y=0 の1マスだけ。y<0 まで開けると、経路探索が盤外へ流れ出す
  if (y < 0) return true;
  /* 上壁の通路。ふつうは1マスだが、**廊下だけは行き先のぶんだけ戸が要る**ので
     topDoors（x の並び）を持てるようにしてある */
  if (y === 0) {
    if (CONF.topDoors) return CONF.topDoors.indexOf(x) < 0;
    return !(CONF.entranceTop && x === CONF.entranceTop.x);
  }
  if (y >= CONF.H - 1) return !(x === CONF.entrance.x && y === CONF.entrance.y);
  if (x <= 0 || x >= CONF.W - 1) return !inOpenLot(y);
  return false;
}
function equipAt(x, y, except) {
  for (const it of G.equip) {
    if (it === except || !inArea(it)) continue;      // 別の区画の設備は、この区画の座標には居ない
    /* 章を切り替えた直後の1〜2フレームだけ、前の章の盤面が残ったまま
       設備表（EQ）が入れ替わっていることがある。知らない id は無いものとして飛ばす
       （ここで落ちると描画ループごと止まって、画面が真っ黒になる） */
    if (!EQ[it.id]) continue;
    if (EQ[it.id].floorTile) continue;               // 舗装のような「床そのもの」は、上を歩けるし物も置ける
    if (x >= it.x && x < it.x + ew(it) && y >= it.y && y < it.y + eh(it)) return it;
  }
  return null;
}
function walkable(x, y) { return !isWall(x, y) && !equipAt(x, y); }

/* 浴室(y<divideY)と脱衣所(y>=divideY)を隔てる間仕切り。
   行き来できるのは中央のガラス引き戸（doorX の列）だけ */
function crossBlocked(x1, y1, x2, y2) {
  if (y1 === y2) return false;
  const lo = Math.min(y1, y2), hi = Math.max(y1, y2);
  // 浴室↔脱衣所の引き戸
  if (lo === CONF.divideY - 1 && hi === CONF.divideY) return x1 !== CONF.doorX;
  // 浴室↔屋外（外気浴デッキ）の戸。第2章の浴室だけにある
  if (CONF.outdoorY && lo === CONF.outdoorY - 1 && hi === CONF.outdoorY) return x1 !== CONF.doorX;
  return false;
}
// 引き戸をふさぐ場所（戸の前後2マス）には設備を置けない
function isDoorway(x, y) {
  /* 上壁の通路（第2章＝階段・エレベーターへ抜ける戸）の**すぐ内側**も塞げない。
     ここに券売機ひとつ置くと、その階から誰も出られなくなり、
     客は金だけ払って帰る（第1章は上壁の通路を持たないので、この行は効かない） */
  if (y === 1) {
    if (CONF.topDoors) { if (CONF.topDoors.indexOf(x) >= 0) return true; }
    else if (CONF.entranceTop && x === CONF.entranceTop.x) return true;
  }
  if (x !== CONF.doorX) return false;
  if (y === CONF.divideY - 1 || y === CONF.divideY) return true;
  if (CONF.outdoorY && (y === CONF.outdoorY - 1 || y === CONF.outdoorY)) return true;
  return false;
}

function findPath(sx, sy, tx, ty) {
  if (sx === tx && sy === ty) return [];
  const W = CONF.W, H = CONF.H;
  const prev = new Int16Array(W * H).fill(-1);
  const k = (x, y) => y * W + x;
  prev[k(sx, sy)] = -2;
  const q = [[sx, sy]];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev[k(nx, ny)] !== -1) continue;
      if (crossBlocked(x, y, nx, ny)) continue;
      if (!walkable(nx, ny) && !(nx === tx && ny === ty)) continue;
      prev[k(nx, ny)] = k(x, y);
      if (nx === tx && ny === ty) {
        const path = [];
        let cur = k(nx, ny);
        while (cur !== k(sx, sy)) { path.unshift({ x: cur % W, y: (cur / W) | 0 }); cur = prev[cur]; }
        return path;
      }
      q.push([nx, ny]);
    }
  }
  return null;
}

function tileOf(e) { return { x: (e.px / T) | 0, y: (e.py / T) | 0 }; }

// 設備の周囲の「立てるマス」
function approachTiles(it) {
  const w = ew(it), h = eh(it), out = [];
  for (let x = it.x - 1; x <= it.x + w; x++)
    for (let y = it.y - 1; y <= it.y + h; y++) {
      const edge = (x === it.x - 1 || x === it.x + w) !== (y === it.y - 1 || y === it.y + h);
      if (!edge || !walkable(x, y)) continue;
      // 間仕切り越しには設備を使えない（引き戸を通って回り込む必要がある）
      const cx = clamp(x, it.x, it.x + w - 1), cy = clamp(y, it.y, it.y + h - 1);
      if (crossBlocked(x, y, cx, cy)) continue;
      out.push({ x, y });
    }
  return out;
}
function pathToEquip(e, it) {
  const t0 = tileOf(e);
  let best = null;
  for (const a of approachTiles(it)) {
    const p = findPath(t0.x, t0.y, a.x, a.y);
    if (p && (!best || p.length < best.path.length)) best = { path: p, tile: a };
  }
  return best;
}

/* 客や店主が「そこまで歩いて行く必要がある」設備か。
   ポスター・観葉植物・テレビ・体重計のような“眺めるだけ・その場のもの”は、隅に押し込んでも構わない。
   ただし冷水機・扇風機・洗面所は「実際に歩いて行って使う」設備なので、必ず道が要る（PAS_USE） */
function needsAccess(id) {
  const d = EQ[id];
  if (d.floorTile) return false;                     // 床そのもの（舗装）は、道が通っている必要がない
  if (pasUseIds().has(id)) return true;
  return !(d.cap === 0 && (d.pas || id === 'plant1'));
}
/* その設備を客が実際に使いに行けるか。手前に立てるマスがあり、かつ“飾り”でないこと */
function usable(it) { return !it.dead && approachTiles(it).length > 0; }
/* 「飾り」＝道が通っていないので誰にも使われない設備。
   置く時点で弾いているので新しく生まれることはないが、
   古いセーブ（ロッカー・洗い場を囲んで置けた頃のもの）には残っていることがある */
function refreshDead() {
  // 区画が複数ある章（第2章）は、区画ごとに間取りが違うので1つずつ見ていく
  const n = areaCount();
  if (n <= 1) { refreshDeadHere(); return; }
  forEachArea(() => refreshDeadHere());
}
function refreshDeadHere() {
  const reach = reachableSet();
  for (const it of areaEquip())
    it.dead = needsAccess(it.id) && !approachTiles(it).some(a => reach.has(a.y * CONF.W + a.x));
}
function deadEquip() { return G.equip.filter(e => e.dead); }

/* 壁掛け（ポスター・テレビ・扇風機）。左右の壁は“内側の壁”＝掛けられる面として扱う */
function isWallMount(id) { return !!EQ[id].wall; }
function isInnerWall(x, y) {
  return (x === 0 || x === CONF.W - 1) && y >= 1 && y <= CONF.H - 2;
}
/* タップしたマスから実際の原点（左上）を決める。返り値の ok は「その置き方が成立したか」。
   2×2 のサウナのような大きい設備は、タップしたマスを必ず含む置き方を、
   タップ位置に近い順に総当たりする＝浴槽の左隣をタップしたら、1マス左にずらして置く。
   （そのマスを左上に固定すると浴槽と重なって「置けない」になってしまうため）
   置ける／置けないの色分けもこの関数を通す＝見た目とタップ結果が必ず一致する */
function snapAnchor(id, rot, tx, ty, moving) {
  const w = ew(id, rot), h = eh(id, rot);
  if (w > 1 || h > 1) {
    const cands = [];
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++) cands.push({ gx: tx - dx, gy: ty - dy, d: dx + dy });
    cands.sort((a, b) => a.d - b.d);                       // タップしたマスが左上に近い置き方を優先
    for (const c of cands)
      if (placementValid(id, c.gx, c.gy, moving, rot)) return { gx: c.gx, gy: c.gy, ok: true };
  }
  // どう置いても無理／1×1のものは、枠内に収めた位置をそのまま返す（赤で出す）
  const wm = isWallMount(id) && w === 1 && h === 1;
  const gy = clamp(ty, 1, CONF.H - 1 - h);
  // 駐車場（壁の無い屋外）は、いちばん外の列まで寄せられる
  const lot = inOpenLot(gy) && inOpenLot(gy + h - 1);
  const gx = wm ? clamp(tx, 0, CONF.W - 1)
           : lot ? clamp(tx, 0, CONF.W - w)
           : clamp(tx, 1, CONF.W - 1 - w);
  return { gx, gy, ok: placementValid(id, gx, gy, moving, rot) };
}
/* その設備をそのマスに置けるか（床か、壁掛けなら左右の壁か） */
function surfaceOK(id, gx, gy, w, h) {
  if (isWallMount(id) && w === 1 && h === 1 && isInnerWall(gx, gy)) return true;
  // 駐車場（壁の無い屋外）は、いちばん外の列まで使える
  const lot = inOpenLot(gy) && inOpenLot(gy + h - 1);
  const xMin = lot ? 0 : 1, xMax = lot ? CONF.W : CONF.W - 1;
  return gx >= xMin && gy >= 1 && gx + w <= xMax && gy + h <= CONF.H - 1;
}

/* 置ける部屋か（room:'bath'=浴室のみ / 'datsui'=脱衣所のみ / 無指定=どちらでも） */
function roomOK(id, gy, h) {
  const d = EQ[id];
  const oy = CONF.outdoorY || 0;
  // 屋外にしか置けないもの（外気浴デッキ・テントサウナ・露天・駐車場のもの）
  if (d.outdoor) return oy ? (gy + (h || 1) <= oy)
                           : (CONF.areas ? gy >= CONF.divideY : true);   // 駐車場のある区画は仕切りより下が屋外
  // 屋外ゾーンには、屋外用でないものは置けない
  if (oy && gy < oy) return false;
  const r = d.room;
  if (r === 'bath') return gy < CONF.divideY;
  if (r === 'datsui') return gy >= CONF.divideY;
  return true;
}
function roomLabel(id) {
  const r = EQ[id].room;
  return r === 'bath' ? '浴室' : r === 'datsui' ? '脱衣所' : null;
}

/* 配置の妥当性（重なり・全設備への到達性）。
   置いた結果どれか1台でも道から切り離されるなら、その置き方は成立しない。
   ロッカーや洗い場を並べて「奥の列」を作ることもできない＝
   誰にも使われない“飾り”は、置く時点で生まれないようにしている。
   返り値の why は、なぜ置けないかを一言で出すためのもの（置けるときは null） */
/* サウナの入り口＝「高温」「ミスト」等の札の前1ブロック。
   ここに物を置くと客が入れない“画”になるので、設置禁止マスとして扱う（作者指定）。
   絵は drawEquip が rot×90°ぶん回して描いているので、入り口も回した先の辺に付いてくる＝
   回転させれば浴室の一番下の列（入口を上に向ける）にも、左端（入口を右に向ける）にも置ける。
   rot 0=下 / 1=左 / 2=上 / 3=右（絵の回転と同じ向き） */
function saunaDoorTile(it) {
  const w = ew(it), h = eh(it);
  switch ((it.rot || 0) & 3) {
    case 1:  return { x: it.x - 1,     y: it.y };
    case 2:  return { x: it.x + w - 1, y: it.y - 1 };
    case 3:  return { x: it.x + w,     y: it.y + h - 1 };
    default: return { x: it.x,         y: it.y + h };
  }
}
function placeCheck(id, gx, gy, moving, rot) {
  const w = ew(id, rot), h = eh(id, rot);
  // 章ごとの追加の関門（第2章＝基礎工事が済むまで浴室に置けない）
  const blocked = chHook('placeBlock', id, gx, gy);
  if (blocked) return { ok: false, why: blocked };
  if (!surfaceOK(id, gx, gy, w, h)) return { ok: false, why: null };
  const onWall = isInnerWall(gx, gy);
  for (let x = gx; x < gx + w; x++)
    for (let y = gy; y < gy + h; y++)
      if ((!onWall && isWall(x, y)) || equipAt(x, y, moving) || isDoorway(x, y)) return { ok: false, why: null };
  // 既にあるサウナの入り口（札の前1マス）をふさぐ置き方はできない
  for (const s of areaEquip()) {
    if (s === moving || EQ[s.id].cat !== 'sauna') continue;
    const d = saunaDoorTile(s);
    if (d.x >= gx && d.x < gx + w && d.y >= gy && d.y < gy + h)
      return { ok: false, why: `${EQ[s.id].name}の入り口（札の前）は空けておく必要があります` };
  }
  // サウナ自身を置く時は、入り口の1マスが浴室内の空きマスであること（入り口の向きは rot で決まる）
  if (EQ[id].cat === 'sauna') {
    const d = saunaDoorTile({ id, x: gx, y: gy, rot });
    const inBath = d.x >= 1 && d.x <= CONF.W - 2 && d.y >= 1 && d.y < CONF.divideY;
    if (!inBath || isWall(d.x, d.y) || isDoorway(d.x, d.y) || equipAt(d.x, d.y, moving))
      return { ok: false, why: 'サウナの入り口（札の前1マス）が空いていません。回すと入り口の向きが変わります' };
  }
  // 間仕切りをまたぐ設備は置けない（浴室と脱衣所は別の部屋）
  if (gy < CONF.divideY && gy + h > CONF.divideY) return { ok: false, why: null };
  // 置ける部屋の指定（浴室だけ／脱衣所だけ）
  if (!roomOK(id, gy, h)) return { ok: false, why: null };
  // 営業中は客が立っているマスに置けない
  if (G.phase === 'biz') {
    for (const c of G.customers) {
      const t = tileOf(c);
      if (t.x >= gx && t.x < gx + w && t.y >= gy && t.y < gy + h) return { ok: false, why: null };
    }
  }
  /* 到達チェック。見るのは「この置き方のせいで新しく切り離される設備」だけ。
     古いセーブには既に切り離された“飾り”が残っていることがあり、
     そこまで数えると盤面のどこにも何も置けなくなってしまう（＝詰み）。
     いま切り離されている物は、この判定では最初から居ないものとして扱う */
  const cut = (reach, it) => !approachTiles(it).some(a => reach.has(a.y * CONF.W + a.x));
  const before = reachableSet();
  const wasDead = new Set();
  for (const it of areaEquip())
    if (it !== moving && needsAccess(it.id) && cut(before, it)) wasDead.add(it);
  const ghost = { uid: -1, id, x: gx, y: gy, rot, f: G.actF };
  const saved = moving ? { x: moving.x, y: moving.y, rot: moving.rot } : null;
  if (moving) { moving.x = gx; moving.y = gy; moving.rot = rot; } else G.equip.push(ghost);
  const reach = reachableSet();
  let self = false;
  const lost = [];                                         // 使えなくなる“既にある設備”そのもの（画面で印を付ける）
  for (const it of areaEquip()) {
    if (!needsAccess(it.id) || wasDead.has(it)) continue;   // ポスターや観葉植物は、隅に置けて当たり前
    if (!cut(reach, it)) continue;
    if (it === ghost || it === moving) self = true; else lost.push(it);
  }
  if (moving) { moving.x = saved.x; moving.y = saved.y; moving.rot = saved.rot; } else G.equip.pop();
  if (!lost.length && !self) return { ok: true, why: null, lost: [] };
  // 置こうとしている物そのものが孤立するのか、既にある設備を塞ぐのかで言い方を変える
  const names = [...new Set(lost.map(it => EQ[it.id].name))];
  return { ok: false, lost, why: names.length
    ? `利用不可になるアイテムがあります（${names.slice(0, 3).join('・')}）`
    : '通路につながっていません' };
}
function placementValid(id, gx, gy, moving, rot) { return placeCheck(id, gx, gy, moving, rot).ok; }
function reachableSet() {
  const W = CONF.W, seen = new Set();
  const q = [[CONF.entrance.x, CONF.entrance.y]];
  seen.add(CONF.entrance.y * W + CONF.entrance.x);
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, kk = ny * W + nx;
      if (crossBlocked(x, y, nx, ny)) continue;
      if (!seen.has(kk) && walkable(nx, ny)) { seen.add(kk); q.push([nx, ny]); }
    }
  }
  return seen;
}

function bandai() { return G.equip.find(e => e.id === 'bandai'); }
/* ============ 番台まわりの立ち位置 ============
   第1章の番台は2マスで、「客は右・主人公は上」で自然に向かい合う。
   第2章の受付カウンターは**3マス幅**なので、この決め方だと
   客が右端・主人公が左端に立ち、**カウンターの端と端で金を渡す**絵になっていた。
   章が deskLayout を持っていれば、客・主人公・2人目・行列をまとめて章側が決める。
   持たない章（第1章）は下の従来どおりの計算＝1マスも動かない            */
function deskLayout() { return chHook('deskLayout') || null; }
function bandaiFront() {
  const L = deskLayout(); if (L && L.pay) return L.pay;
  const b = bandai();
  const ts = approachTiles(b);
  ts.sort((p, q) => (q.x - b.x) - (p.x - b.x));   // 右側優先
  return ts[0] || { x: CONF.entrance.x, y: CONF.entrance.y - 1 };
}
/* 主人公の持ち場。番台のある区画なら番台の横、ほかの部屋にいる間はその部屋の入口の内側 */
function playerHome() {
  const b = bandai();
  if (b && (b.f | 0) === G.actF) return playerSpot();
  return { x: CONF.entrance.x, y: CONF.entrance.y - 1 };
}
function playerSpot() {
  const L = deskLayout(); if (L && L.staff) return L.staff;
  const b = bandai(), front = bandaiFront();
  const ts = approachTiles(b).filter(t => !(t.x === front.x && t.y === front.y));
  ts.sort((p, q) => (p.y - b.y) - (q.y - b.y));   // 上側優先
  return ts[0] || front;
}
function hasCat(cat) { return G.equip.some(e => EQ[e.id].cat === cat && (EQ[e.id].cap === 0 || e.cond > 0)); }
/* サウナマット・垢すりタオルは浴室に「置き場」を設置して初めて使える（運営メニューのフラグではなく現物で管理） */
function hasEquip(id) { return G.equip.some(e => e.id === id); }
/* 故障していない現物があるか（置くだけで効く設備＝pas はこれで判定する） */
function hasWorking(id) { return G.equip.some(e => e.id === id && e.cond > 0); }
/* ============ 「その働きをする設備」があるか ============
   ⚠ **設備の ID を名指しすると、章が変わった瞬間に静かに効かなくなる。**
   実測（2026-08-06）：第2章の冷水機は `y_cooler` なのに game.js は `'cooler'` を探していたので、
   **何台建てても「給水が無い」判定**＝サウナ客が全員 −2 を食らい続け、
   「冷水機を置け」というヒントも永久に出続けていた。ミスト（`sauna_mist`）も同じ。

   章が `CONF.roleIds` で名前の一覧を持っていればそれを見る。
   持たない章（第1章）は、これまでどおり第1章の ID ひとつを見る＝挙動は変わらない */
function roleIds(role, ch1Id) {
  return (CONF.roleIds && CONF.roleIds[role]) || [ch1Id];
}
function hasRole(role, ch1Id) {
  return roleIds(role, ch1Id).some(id => hasWorking(id));
}
/* **そもそもカタログに在るか**（買えるか）。建ててあるかは見ない。
   置ける物が無いのに欲しがらせると、**直しようのない不満**になる＝
   その役目の設備が1つもカタログに無い章では、誰もそれを欲しがらない。
   ＝章に塩サウナを足した日から、勝手に欲しがる客が現れる（設定を直さなくていい） */
function roleBuildable(role, ch1Id) {
  return roleIds(role, ch1Id).some(id => !!EQ[id]);
}
/* マッサージ機だけは「種類(cat)」ではなく**その設備そのもの**を指す予定として扱う
   （脱衣所のロッカーや棚と混ざらないように）。ID の名指しは章を跨ぐと壊れるので、
   ここも役目で引く＝第2章の `y_massage` / `y_x_massage` が同じ扱いになる */
function isMassage(id) { return roleIds('massage', 'massage').indexOf(id) >= 0; }
/* 硬貨を入れて使う設備の単価（マッサージ機）。設備ごとに違ってよい
   （第2章：フロントの機械は10分¥200、ラウンジの椅子は¥100） */
function coinPrice(id) { return (EQ[id] && EQ[id].coin) || CONF.massagePrice || 100; }
/* 洗面所があるか。親父の代からの「古い洗面台」も、洗面所として数える
   （ドライヤーも化粧水も、あの台の上に置ける＝設備としては同じもの） */
/* ⚠ ここは**第1章のIDべた書き**だったので、第2章では洗面台（d2_sink）を置いても
   hasSink() が永久に false ＝ 運営メニューのドライヤーと化粧水が一生「🔒 洗面所の設置で解放」
   のままだった。章ごとの表（CONF.sinkIds）があればそちらを見る                */
const SINK_IDS = ['sink', 'sink_old'];
function sinkIds() { return CONF.sinkIds || SINK_IDS; }
function hasSink() { return sinkIds().some(hasWorking); }
/* 「ちゃんとした洗面所」か「親父の代の古い洗面台」か。評判の【脱衣所】は
   この2つを別々に点にしているが、そこだけ第1章のIDを直書きしていたので、
   第2章の `y_sink` を置いても 1.2点が永久に入らなかった（100日通しで実測）。
   古いかどうかは設備の `old` で見る＝第1章の並び（sink / sink_old）と同じ答えになる */
function hasGoodSink() { return sinkIds().some(id => EQ[id] && !EQ[id].old && hasWorking(id)); }
function hasOldSink()  { return sinkIds().some(id => EQ[id] &&  EQ[id].old && hasWorking(id)); }
/* トイレ（作者指定）。親父の代からのボットン便所も「トイレはある」に数えるが、
   洋式かどうかは別に見る＝ボットンのままだと、使った客がその都度文句を言う */
/* ⚠ ここも**第1章のIDべた書き**だった。第2章のウォシュレット（`y_toilet`）を
   何台置いても hasToilet() が false ＝ **全ての客が満足度−5**、しかも
   「トイレは無いの!?」が永久に出続けていた（100日通しで実測・1日43件）。
   章ごとの表（CONF.toiletIds / toiletNewIds）があればそちらを見る          */
const TOILET_IDS = ['toilet_old', 'toilet1', 'toilet_multi', 'toilet2'];
const TOILET_NEW = ['toilet1', 'toilet_multi', 'toilet2'];
function toiletIds()    { return CONF.toiletIds    || TOILET_IDS; }
function toiletNewIds() { return CONF.toiletNewIds || TOILET_NEW; }
function hasToilet() { return toiletIds().some(hasWorking); }
function hasNewToilet() { return toiletNewIds().some(hasWorking); }
/* 自販機。第1章は牛乳とドリンクの2台。章が表を持てばそちらを見る
   （第2章は `y_vend` の1台＝脱衣所の点も、出る不満も、その1台ぶんになる） */
const VEND_IDS = ['vend1', 'vend2'];
function vendIds() { return (CONF.roleIds && CONF.roleIds.vend) || VEND_IDS; }
/* 小綺麗に見せる緑。第1章は `plant1`、第2章は4Fラウンジの `y_x_plant`。
   ここを直書きしていたので、第2章は**清潔度が8点で頭打ちのまま**、
   1株ごとの満足度（最大+6）も一度も入っていなかった                       */
function plantIds() { return roleIds('plant', 'plant1'); }
/* 熱波師が店にいるか（フェーズ4：決戦仕様のサウナを組むと、黒田が連れてくる） */
/* 熱波師が“いま振れる”か。台（決戦仕様の一台）が据わるまでは、来ていても振れない＝効果も出ない */
function nappaOn() { return !!(G.nappa && G.nappa.hired) && hasRole('nappa', 'sauna_sp'); }
/* 置くだけで効く設備（洗面所・体重計・テレビ・冷水機…）を種類ごとに1つだけ数える */
/* 小綺麗に見せる備品（観葉植物など）は、汚れの出かたを少し抑える。
   置いた台数ぶん効くが、効きすぎると掃除が要らなくなるので5割で打ち止め */
/* f＝どの区画の汚れやすさを聞いているか。省略すると、これまでどおり主人公のいる区画。
   区画が1つしかない章（第1章）はどちらでも同じ値になる */
function cleanFactor(f) {
  let cut = 0;
  for (const e of G.equip) { const d = EQ[e.id]; if (d.clean && e.cond > 0) cut += d.clean; }
  // 第2章：担当が遅刻していて無人の部屋は、汚れが溜まりやすい
  const mul = chHook('dirtMul', f == null ? G.actF : (f | 0)) ?? 1;
  return Math.max(0.5, 1 - cut) * mul;
}
function passiveEquips() {
  const seen = {}, out = [];
  for (const e of G.equip) {
    const d = EQ[e.id];
    if (!d.pas || e.cond <= 0 || seen[e.id]) continue;
    seen[e.id] = true; out.push(e.id);
  }
  return out;
}
function hasMat() { return hasEquip('matrack'); }
function hasAkasuri() { return hasEquip('akarack'); }
function soapOn() { return G.opts.soapMode !== 'none'; }
/* ドライサウナを既定室温より高く設定したぶんの追加光熱費（1℃=¥100/日）。
   既定より下げても割引はなく、既定額（=下限）のまま。
   浴槽・水風呂・ミスト・塩サウナは温度固定なので、そもそも上乗せは発生しない */
function tempSurcharge(it) {
  const def = EQ[it.id];
  if (!canSetTemp(def)) return 0;
  const base = def.temp ?? 90;
  const cur = it.temp ?? base;
  return Math.max(0, cur - base) * CONF.tempCostPerDeg;
}
/* 水道代／日＝カラン・風呂・水風呂の占有面積(マス)×CONF.waterPerTile。
   大きい湯船ほど水を多く使う。状態や修理では変わらない（一定） */
function waterCost(it) {
  const def = EQ[it.id];
  if (def.cat === 'wash' || def.cat === 'furo' || def.cat === 'mizu') return def.w * def.h * CONF.waterPerTile;
  return 0;
}
/* 光熱費／日（電気・ガスで湯を沸かす・室温を上げる・冷やす分）。カランは水道代のみで光熱費は取らない */
function heatCost(it) {
  const def = EQ[it.id];
  if (def.cat === 'wash') return 0;
  return def.run || 0;
}
/* 1日ぶんの光熱費（作者指定＝固定制。従量ぶんは廃止した）。
   「客がひとりも来なくても、湯は毎日沸かす」＝置いてある設備の数だけで決まる。
   温度の上乗せも同じく固定＝設定温度は毎日の固定費、というプレイヤーの選択がそのまま効く。
   guests は呼び出し側の互換のために受け取るだけで、額には効かない */
function dailyUtil(guests) {
  const standby = Math.round(G.equip.reduce((a, e) => a + heatCost(e), 0) * CONF.utilRunRate);
  const temp = G.equip.reduce((a, e) => a + tempSurcharge(e), 0);
  return { base: CONF.baseUtil + standby, temp, guest: 0, total: CONF.baseUtil + standby + temp };
}
/* 水道代だけは従量のまま（かけ湯・シャワー・洗い場・清掃は客の数だけ水を使う）。
   基本（設備の待機ぶん）＋客1人あたり。作者指定で全体を2倍にしてある */
function dailyWater(guests) {
  const base = Math.round(G.equip.reduce((a, e) => a + waterCost(e), 0) * CONF.waterStandby);
  const guest = Math.round(guests * CONF.waterPerGuest);
  return { base, guest, total: base + guest };
}
/* ============ 曜日 ============
   1日目＝月曜。土日が休日で、平日の客数は休日の CONF.weekdayGuestRate（＝70%）。
   平日・休日の倍率は「週の平均がちょうど1.0」になるよう正規化してから掛ける＝
   曜日を入れても週あたりの客足の総量は変わらず、日ごとの濃淡だけがつく */
const WEEK = ['月', '火', '水', '木', '金', '土', '日'];
/* ============ 主人公の持ち場（作者指定 2026-08-08）============
   章が `playerArea` を持てばそちらに従う＝**第2章はバイト管理画面で動かせる。**
   7階建てなので「主人公は常に1F受付」だと、上の階が手薄なときに打つ手が1つ足りない。
   フックの無い章＝これまでどおり `CONF.playerArea`（第1章は区画が1つなので常に 0） */
function playerArea() {
  const h = chHook('playerArea');
  return h == null ? (CONF.playerArea ?? 0) : (h | 0);
}
function dayOfWeek(d) {
  // 第2章は1週ずつ進み、その週に「何曜日を営業するか」をプレイヤーが選ぶ
  const h = chHook('dayOfWeek', d);
  if (h !== undefined) return h;
  return ((d ?? G.day) - 1) % 7;
}
// その日以降で最初に来る月曜（＝dayOfWeek 0）の日番号。治療費を毎週月曜に揃えるのに使う
function mondayOnOrAfter(d) { let x = Math.max(d || 1, 1); while (dayOfWeek(x) !== 0) x++; return x; }
function dayLabel(d) { return WEEK[dayOfWeek(d)]; }
function isHoliday(d) { return dayOfWeek(d) >= 5; }
function dowGuestMul(d) {
  const r = CONF.weekdayGuestRate;
  const holiday = 7 / (5 * r + 2);          // 平日5日＋休日2日の平均が1.0になる休日側の倍率
  return isHoliday(d) ? holiday : holiday * r;
}
/* ---- 新規客と常連客 ----
   G.regulars ＝ 夕凪湯を「行きつけ」にしている人数。満足して帰った新規の一部が積み上がり、
   がっかりして帰った常連のぶんだけ減る。常連は3日に1回のペースで顔を出す想定なので、
   その日の来店見込みのうち何割が常連になるかは「常連の数×来店頻度 ÷ 来店見込み」で決まる。
   ※いまは日報の内訳表示だけに使っていて、1日の来店数そのものには効かせていない。
     広告→新規→常連 の循環を数字として回しておき、集客に効かせるかは後で決める */
function repeatShare() {
  const planned = Math.max(G.plannedGuests || 0, 1);
  return clamp(G.regulars * CONF.regularVisitRate / planned, 0, CONF.regularRepeatCap);
}
function lockerCapacity() {
  return G.equip.filter(e => EQ[e.id].cat === 'locker' && e.cond > 0)
    .reduce((n, e) => n + (EQ[e.id].lock ?? CONF.lockerCap), 0);
}
/* 実際に荷物が入っているロッカーの数。満杯なら着替えられず、新しい客も入れない */
function lockersInUse() { return G.customers.filter(c => c.hasLocker).length; }
function lockersFull() { return lockersInUse() >= lockerCapacity(); }
/* 「放置された汚れ」の数＝落ちてから一定時間たった汚れだけを数える。
   「汚い店」の判定はこれを使う＝落ちた直後の汚れで客が怒らないように（作者指摘で緩和）。
   前日から持ち越した汚れ（tなし・時刻が今日より大きい）は問答無用で放置扱い */
/* 汚れの濃さを数える（作者指定の2段階）。
   薄い＝落ちたばかり／濃い＝dirtOldMin ぶん放置され、こびり付いたもの。
   t が無い・未来の汚れ（前日からの持ち越し）は最初から濃い扱い */
function isThickDirt(d) { return d.t == null || d.t > G.minutes || G.minutes - d.t >= CONF.dirtOldMin; }
/* ゴキブリ（作者指定）。こびり付いた汚れが5つ以上たまると、浴室に1匹現れる。
   出てくるのは汚れの無いマス＝どこからともなく湧く。そのあとは浴室じゅうを
   （何も置かれていない床も、汚れの上も）歩き回る。汚れを5つ未満まで拭けば消える。
   掃除は、そのとき居座っている汚れが最優先で、客が近くを通ると悲鳴が上がる */
const ROACH_FROM = 5;
const ROACH_SPD = 58;                 // 実時間1秒あたりに進むピクセル数（すばしっこく走る）
// 浴室の、客も設備も無いマス（ゴキブリはここを歩き回る）
function roachTiles(noDirt) {
  const out = [];
  // 仕切りより上＝屋内。休憩スペースや食堂のように仕切りが無い区画は、部屋ぜんぶが歩く範囲
  const bottom = CONF.divideY || CONF.H - 1;
  for (let y = 1; y < bottom; y++)
    for (let x = 1; x < CONF.W - 1; x++) {
      if (!walkable(x, y)) continue;
      if (noDirt && G.dirts.some(d => d.x === x && d.y === y)) continue;
      out.push({ x, y });
    }
  return out;
}
/* いまその区画に居る1匹。第1章は区画が1つしか無いので、これまでどおり「店に1匹」 */
function roachAt(f) { return G.roaches.find(r => (r.f | 0) === (f | 0)) || null; }
function removeRoach(r) { const i = G.roaches.indexOf(r); if (i >= 0) G.roaches.splice(i, 1); }

function updateRoach(rDt) {
  if (G.phase !== 'biz' && G.phase !== 'prep') { G.roaches = []; return; }
  forEachArea(f => updateRoachIn(f, rDt));
}
/* ゴキブリは**区画ごと**に湧く。汚れの数も、歩き回る範囲も、その区画のぶんだけ数える。
   店ぜんぶの合計で数えると、5区画あるだけで開店初日から湧くことになってしまう */
function updateRoachIn(f, rDt) {
  const mine = G.dirts.filter(d => (d.f | 0) === (f | 0));
  let thick = 0;
  for (const d of mine) if (isThickDirt(d)) thick++;
  if (thick < ROACH_FROM) {
    const gone = roachAt(f); if (gone) removeRoach(gone);
    for (const d of mine) d.roach = false;
    return;
  }
  /* 仕留めた直後はしばらく出てこない（叩いた端から湧いたら、ずっと追いかけ回すことになる）。
     ここは実時間の秒。最速だと1日が50秒ほどなので、長く取りすぎると
     「濃い汚れが5つ以上あるのに、何日も1匹も出ない」ことになる（実際そうなっていた） */
  if (G.roachCool[f] > 0) { G.roachCool[f] -= rDt; return; }
  if (!roachAt(f)) {
    const start = pick(roachTiles(true) || []) || pick(roachTiles(false));   // 汚れの無いマスから現れる
    if (!start) return;
    G.roaches.push({ f, px: start.x * T + T / 2, py: start.y * T + T / 2, tx: start.x, ty: start.y, wait: 0 });
  }
  const r = roachAt(f);
  const gx = r.tx * T + T / 2, gy = r.ty * T + T / 2;
  const dx = gx - r.px, dy = gy - r.py, dist = Math.hypot(dx, dy);
  if (dist < 1.5) {
    r.px = gx; r.py = gy;
    r.wait -= rDt;
    if (r.wait <= 0) {                                    // 次に向かうマスを選ぶ（となりのマスを優先）
      const near = roachTiles(false).filter(t => Math.abs(t.x - r.tx) + Math.abs(t.y - r.ty) === 1);
      const t = near.length ? pick(near) : pick(roachTiles(false));
      if (t) { r.tx = t.x; r.ty = t.y; }
      r.wait = rand(0.05, 0.45);                          // 時々ぴたりと止まる（すぐまた走り出す）
    }
  } else {
    const step = Math.min(ROACH_SPD * rDt, dist);
    r.px += dx / dist * step; r.py += dy / dist * step;
    r.ang = Math.atan2(dy, dx);   // 進む向きに体を向ける（上下に動く時は縦になる）
    r.dir = dx >= 0 ? 1 : -1;
  }
  // いま乗っている汚れを「最優先で拭く」印にする
  for (const d of mine) d.roach = (d.x === r.tx && d.y === r.ty);
}
function roachCount() { return G.roaches.length; }
/* 掃除しきった瞬間、そのマスの周り1マス以内にゴキブリがいたら仕留める（作者指定）。
   「バシッ！」と一発、跡だけ残して消える。次に汚れが5つを超えれば、また別の1匹が現れる */
function killRoachNear(w, tile) {
  const r = roachAt(w ? w.f : G.actF);
  if (!r || !tile) return;
  if (Math.abs(r.tx - tile.x) > 1 || Math.abs(r.ty - tile.y) > 1) return;
  killRoach(w, tile);
}
/* その場で仕留める。ゴキブリを追いかけて追いついた時（task:'roach'）と、
   すぐそばの汚れを拭ききった時（killRoachNear）の両方から呼ばれる */
function killRoach(w, tile) {
  const f = (w ? w.f : G.actF) | 0;
  const r = roachAt(f);
  if (!r) return;
  tile = tile || { x: r.tx, y: r.ty };
  G.roachSplats.push({ f, x: r.px, y: r.py, t: 1.4 });
  removeRoach(r);
  G.roachCool[f] = rand(8, 16);           // 次の1匹が出てくるまでの間（実時間の秒）
  for (const d of G.dirts) if ((d.f | 0) === f) d.roach = false;
  if (f === (G.viewF | 0)) {              // 見ていない区画の演出は出さない（音と跡だけが宙に浮く）
    addSparkle(tile.x * T + T / 2, tile.y * T + T / 2);
    Sfx.play('fix');
    floaters.push({ x: tile.x * T + T / 2, y: tile.y * T + T / 2 - 12, text: 'バシッ！', t: 1.6 });
  }
  if (w) bubble(w, pick(w.kind === 'player' ? LINES.roachKillMe : LINES.roachKill), 3.6);
  log('🪳 ゴキブリを仕留めた。……こいつが出る前に、掃除の手を増やそう');
}
// 仕留めたあとの跡（すぐ消える）。いま見ている区画のぶんだけ描く
function drawRoachSplat(rDt) {
  for (let i = G.roachSplats.length - 1; i >= 0; i--) {
    const sp = G.roachSplats[i];
    sp.t -= rDt;
    if (sp.t <= 0) { G.roachSplats.splice(i, 1); continue; }
    if ((sp.f | 0) !== (G.actF | 0)) continue;
    const a = clamp(sp.t / 1.4, 0, 1);
    ctx.save(); ctx.globalAlpha = a * 0.8;
    ctx.fillStyle = '#2b211a';
    ctx.beginPath(); ctx.ellipse(sp.x, sp.y, 5.5 - a * 1.5, 3 - a * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1e1712'; ctx.lineWidth = 0.9;
    for (let k = 0; k < 6; k++) {                       // 潰れて飛び散った脚
      const ang = k * Math.PI / 3 + 0.4;
      ctx.beginPath(); ctx.moveTo(sp.x + Math.cos(ang) * 3, sp.y + Math.sin(ang) * 2);
      ctx.lineTo(sp.x + Math.cos(ang) * (6 + (1 - a) * 3), sp.y + Math.sin(ang) * (4 + (1 - a) * 2)); ctx.stroke();
    }
    ctx.restore();
  }
}
function dirtCounts() {
  let thin = 0, thick = 0;
  for (const d of G.dirts) { if (isThickDirt(d)) thick++; else thin++; }
  return { thin, thick, total: thin + thick };
}
function oldDirtCount() { return dirtCounts().thick; }

/* ============ エンティティ ============ */
function makeEntity(x, y, spd, f) {
  // f＝いる区画（第1章は常に0）。人は区画をまたいで動くので、本人が今どこに居るかを持たせる
  return { px: x * T + T / 2, py: y * T + T / 2, path: null, spd, moving: false, bub: null,
           wob: Math.random() * 9, f: (f === undefined ? (G.actF | 0) : f) };
}
function stepMove(e, dt) {
  e.moving = false;
  if (!e.path || !e.path.length) return true;
  // ox/oy＝マスの中央からのずれ（サウナの座布団のように、1マスに複数人を座らせるために使う）
  const n = e.path[0], tx = n.x * T + T / 2 + (n.ox || 0), ty = n.y * T + T / 2 + (n.oy || 0);
  const dx = tx - e.px, dy = ty - e.py, dist = Math.hypot(dx, dy), step = e.spd * dt;
  e.moving = true;
  /* 歩かされた距離＝導線の悪さの目安（客の不満の判定に使う）。
     章が「ここは数えない」と言えば数えない＝第2章はエレベーターで階を上下するぶんを外し、
     **浴室の階で歩いたぶんだけ**を見る（そうしないと配置と無関係に基準を超える）。

     ⚠ **数え方が2つある**（第1章セッションの指摘 8/9）。
       もとの数え方は「到着しなかったとき」だけ足していたので、次のマスにその1フレームで
       着いてしまうと歩数が丸ごと落ちる＝**フレームの粗さで距離が変わる。**
       実測（同じ店・同じ日）：dt を変えると中央値が 0／4／24／21 と動く。
       重い端末ほど文句が減る、という形で出る。

       `CONF.walkExact` を立てた章だけ、**到着したぶんも足す**＝実際に動いた距離になる。
       ⚠ **第1章では立てないこと。** 直したほうが正しいのだが、歩数が変わると満足度と
         売上が動く（`guardAll` で 売上 29,700 → 30,300 のズレを実測）。
         第1章は基準95に一度も届かない（実測：最長51マス）ので、直す実利も無い    */
  if (!chHook('noWalkCount', e)) {
    const moved = dist <= step ? (CONF.walkExact ? dist : 0) : step;
    if (moved) e.walkPx = (e.walkPx || 0) + moved;
  }
  if (dist <= step) {
    e.px = tx; e.py = ty; e.path.shift();
    // 最後の1マスに着いた瞬間に「歩いている」を降ろす。ここを立てたままにしていたので、
    // 目的地に着いても歩行中の扱いが残り、番台についた判定（＝突っ伏して寝る絵）が出なかった
    if (!e.path.length) { e.moving = false; return true; }
    return false;
  }
  e.px += dx / dist * step; e.py += dy / dist * step;
  return false;
}
/* その客が「今なにをしているか」の指紋。これが変わったら吹き出しは場違いになるので消す。
   （番台で「やってる？」と言った客が、そのまま浴槽やサウナまで持ち歩いてしまうのを防ぐ） */
function bubKey(e) {
  if (e.kind !== 'cust') return '';
  return `${e.state}|${e.use && e.use.item ? e.use.item.id : ''}|${e.mode || ''}`;
}
/* 吹き出しは「実時間で読める長さ」と「ゲーム内で居座らない長さ」の両方で切る。
   実時間だけで管理すると、速度MAX（16分/秒）では3.4秒＝ゲーム内54分。
   その間に客は番台→脱衣所→浴室→サウナまで歩き、セリフだけが頭に残る（作者報告のバグ） */
const BUB_GAME_MIN = 20;                                             // 吹き出しが持つゲーム内の分数
/* `f` ＝**その台詞を言った区画**。吹き出しは数秒残るので、言ったあとに階を移ると、
   移った先の階の声として拾われてしまう（第2章の館内案内図で、
   受付の「よろしく〜」が2階に、風呂上がりの「ととのった〜！！」が
   カプセル階に出ていた）。区画が1つしかない章では、常に 0 ＝これまでと同じ */
function bubble(e, text, dur) { e.bub = { text, t: dur || 3.4, gm: BUB_GAME_MIN, key: bubKey(e), f: e.f | 0 }; }
// 運営メニューで直せる不満は赤枠で長めに出す＝プレイヤーへの改善サイン
function hintBubble(e, text) {
  e.bub = { text, t: 5.0, gm: BUB_GAME_MIN * 1.5, hint: true, key: bubKey(e), f: e.f | 0 };
  // 赤枠の吹き出し＝運営で直せる不満。画面直下のお知らせ欄にも赤文字で流す
  if (e.kind === 'cust' && e.type) logGripe(e.type.name, text);
}
/* 「そこまで歩いて行けない」＝設備で通路を塞いでいる時の赤い吹き出し。
   不満（！）とは別の印（⚠）にしてある。運営メニューでは直せず、配置を直すしかない問題なので。
   同じ相手が延々と喋り続けないよう、6秒に1回までに絞る */
function stuckBubble(e, text) {
  if (e.stuckCd > 0) return;
  e.stuckCd = 6.0;
  e.bub = { text, t: 5.0, gm: BUB_GAME_MIN * 1.5, hint: true, stuck: true, key: bubKey(e), f: e.f | 0 };
  if (!G.stuckLogged) { G.stuckLogged = true; log(`⚠ ${text}（通路が塞がっている）`); }
}
// 設備名つきで「たどり着けない」と言わせる
function stuckAt(e, name) { stuckBubble(e, `${name}にたどり着けない`); }

/* ---- 客 ---- */
/* 子ども向けの備品（ガチャガチャ・絵本の棚）。置いた数で子供料金の上限が決まる（作者指定）。
   大人料金との連動はやめた＝「大人を高くすれば子どもも高くできる」より、
   「子どもから金を取るなら、子どもが喜ぶものを置け」のほうが素直で、置き場所の選択にもなる */
function kidsGoods() { return G.equip.filter(e => EQ[e.id].kids && e.cond > 0 && usable(e)); }
/* 子供料金の上限。
   第1章＝**子ども向けの備品の数**だけで決まる（[¥100,¥200,¥300]）。
   `kidFeeTiers` を持つ章（第2章）＝**評判と備品の数の両方**が要る。
   備品を並べただけでは上がらないし、評判だけでも上がらない＝
   「子どもに何をしてあげたか」と「店として認められているか」が揃って初めて値上げできる */
function kidFeeCap() {
  const tiers = CONF.kidFeeTiers;
  if (tiers) {
    const n = kidsGoods().length;
    let v = tiers[0][2];
    for (const [rep, need, price] of tiers) if (G.rep >= rep && n >= need) v = price;
    return v;
  }
  return KID_FEES[clamp(kidsGoods().length, 0, KID_FEES.length - 1)];
}
/* 次の段に上がるには何が足りないか（運営メニューの一行説明）。届いていれば null */
function kidFeeNext() {
  const tiers = CONF.kidFeeTiers;
  if (!tiers) {
    const n = kidsGoods().length;
    return n >= KID_FEES.length - 1 ? null : { price: KID_FEES[n + 1], rep: 0, need: n + 1 };
  }
  const n = kidsGoods().length;
  for (const [rep, need, price] of tiers) {
    if (G.rep >= rep && n >= need) continue;
    return { price, rep: G.rep < rep ? rep : 0, need: n < need ? need : 0 };
  }
  return null;
}
function kidFeeOK() { return (G.opts.kidFee || KID_FEES[0]) <= kidFeeCap(); }
let custId = 0;
/* forceKey を渡すと、その客タイプで1人だけ湧かせる（親のあとに続く子ども用） */
/* 来店する客層の重み。
   第1章はここの表（従来の値）をそのまま使う＝挙動は1ミリも変わらない。
   第2章は TYPES2 の各客に w（基本の重み）と wSauna（サウナがある時の上乗せ）を書いておけば、
   この表を書き換えずに客層をまるごと入れ替えられる */
const LEGACY_CUST_W = { jisan: 26, oyaji: 24, obachan: 22, salaryman: 20, wakamono: 14,
                        ol: 12, kinpatsu: 14, yakuza: 9, oyako: 24, kodomo: 0 };
const LEGACY_CUST_W_SAUNA = { oyaji: 6, salaryman: 14, wakamono: 16, ol: 6, kinpatsu: 8, yakuza: 6 };
function custWeight(k) {
  const t = TYPES[k] || {};
  let w = (t.w !== undefined) ? t.w : (LEGACY_CUST_W[k] || 0);
  if (hasCat('sauna')) w += (t.wSauna !== undefined) ? t.wSauna : (LEGACY_CUST_W_SAUNA[k] || 0);
  /* 章が「いま何時か」「その層にどれだけ支持されているか」で重みを動かす（第2章）。
     ・時間帯　… 夕方は老人と子連れ、19〜21時は仕事帰り、終電後は飲んだ帰り
     ・層の支持… その層を満足させた日が続けば、その層が増える／裏切れば減る
     フックを持たない章（第1章）は掛け算が起きない＝挙動は1ミリも変わらない */
  const mul = chHook('custWeightMul', k);
  if (mul !== undefined && mul !== null) w = Math.max(0, w * mul);
  return w;
}

/* その客タイプの後ろに続く子ども（いなければ null）。
   第1章の TYPES は据え置きなので、oyako だけは名前で拾う */
function kidOf(k) {
  const t = TYPES[k] || {};
  return t.withKid || (k === 'oyako' ? 'kodomo' : null);
}

function spawnCustomer(forceKey) {
  // 夕凪湯は男湯：menOnlyの間は男性客だけが来る（女性タイプは女湯・新店で解放）
  // 「刺青・ヤクザお断り」中は強面客は普通には来店しない（代わりにみかじめ料の来訪がある）
  const keys = Object.keys(TYPES).filter(k =>
    // 「お断り」の対象も**名前ではなく `tattoo`**で見る（章が変わっても効き続ける）
    (!CONF.menOnly || TYPES[k].sex === 'm') && !(G.opts.banYakuza && TYPES[k].tattoo)
    // 子どもはひとりでは来ない（作者指定）＝必ず親のあとに続けて湧かせる
    && !TYPES[k].kid
    // 子連れの家族は「刺青・ヤクザお断り」を掲げ、子供料金が高すぎない店にだけ来る（作者指定）
    /* ※第2章は**この関門を持たない**（作者決定 8/5）。
         第1章の「子連れは刺青お断りの店にしか来ない」は**来る／来ない**の関門だが、
         第2章では**来たうえで、居合わせたら評価が下がる**（yYakuzaGripe＝子連れが最大）。
         第1章の書き方のままだと `banYakuza` の既定が false なので、
         第2章では**子連れ客が一度も来なかった**（子供料金も子供向け設備も空回り）。
         関門を2つに割り、章が札を持っていれば前半を飛ばす                     */
    && !(kidOf(k) && !CONF.kidsWithoutBan && !G.opts.banYakuza)
    && !(kidOf(k) && !kidFeeOK())
    // 章ごとの「そもそも来られるか」（第2章＝大型車スペースが無いとトラック運転手は来ない等）
    && (chHook('canVisit', k) !== false));
  // サウナがあるとサウナ好きが来やすい
  // ※TYPES の全キーぶん必ず書くこと。1つでも欠けると重みの合計が NaN になり、
  //   抽選が回らず keys[0]（＝常連のじいさん）だけが延々と来店してしまう
  // 夕凪湯は男性専用（CONF.menOnly=true で女性タイプは上のkeysから除外済み）。
  // obachan/ol の重みは第2章（menOnly:false＝女湯解放）用に残してある＝消すと解放時にNaNで抽選が壊れる
  const weights = {};
  for (const kk of keys) weights[kk] = custWeight(kk);
  // 黒田が仲間＝会社帰りのサラリーマン客を回してくれる（第1章の話）
  if (weights.salaryman !== undefined && kurodaAllyOn()) weights.salaryman += 12;
  let sum = 0; for (const kk of keys) sum += weights[kk];
  let r = Math.random() * sum, tk = keys[0];
  for (const kk of keys) { r -= weights[kk]; if (r <= 0) { tk = kk; break; } }
  if (forceKey) tk = forceKey;

  const c = makeEntity(CONF.entrance.x, CONF.entrance.y, CONF.custSpd);
  Object.assign(c, {
    kind: 'cust', id: ++custId, type: TYPES[tk], typeKey: tk,
    state: 'toPay', sat: 50 + (tadokoroAllyOn() ? 3 : 0), mode: 'clothed', plan: [], seq: [],
    use: null, timer: 0, waitT: 0, waitNag: 0, waitItem: null,
    dirtHits: 0, noSauna: false, gotTotonoi: false, carry: null, amen: false, walkPx: 0,
    // 親子はサウナには入らない（作者指定）＝likesSauna が0なので、ここで必ず false になる
    wantsSauna: Math.random() < TYPES[tk].likesSauna,
    // 「これだけ居られれば満足」という時間。滞在時間の制限を掛けたとき、これを下回ると不満になる
    needMin: STAY_NEED_BATH, inAt: null, timeUp: false, told: false,
    isChild: !!TYPES[tk].kid,          // 子ども＝小さく描き、料金は子供料金、浴室が汚れやすい
    // 湯温の好みは1人ごとに転がす（じいさんだけ個人差あり＝あつ湯派とぬる湯長湯派が混ざる）
    /* 個人差は残しつつ、上側だけ CONF.furoPrefMax（＝その章で出せるいちばん熱い湯）で頭打ちにする。
       この札を持たない章は頭打ちなし＝これまでどおり（第2章は44℃の湯船があるので設定していない） */
    furoPref: Math.min(TYPES[tk].furoPref + (TYPES[tk].furoVar ? rand(-TYPES[tk].furoVar, TYPES[tk].furoVar) : 0),
                       CONF.furoPrefMax ?? 99),
    tebura: Math.random() < 0.45,      // 手ぶらで来た客。セットがあれば買う／無ければ不満
    // フェーズ3：“ないものねだり”。ミスト・塩・熱波師を欲しがる客が一定数いる
    // （設置・獲得しなくてもゲーム進行は詰まらないが、満足度＝評判の伸びがそのぶん重くなる）
    /* **買える物だけを欲しがる。**その役目の設備がカタログに1つも無い章では、
       誰も欲しがらない＝直しようのない不満を作らない。
       第1章はミスト・塩・決戦仕様のどれも EQ に在るので、これまでどおり全員が転がす */
    wantsMist: roleBuildable('mist', 'sauna_mist') && Math.random() < CONF.wantMistRate,
    wantsShio: roleBuildable('shio', 'sauna_shio') && Math.random() < CONF.wantShioRate,
    wantsNappa: roleBuildable('nappa', 'sauna_sp') && Math.random() < CONF.wantNappaRate,
    // フェーズ4：上位志向の客（10%）。いつでも「今より上の設備」を求める＝満足の天井が常に少し下がる。
    // 全部を満たす日は来ない＝評判の伸びを構造的に鈍らせ、クリアを遠くする（作者指定）
    snob: Math.random() < CONF.snobRate,
    // 初めて暖簾をくぐる客か、行きつけにしている常連か。
    // 割合は開店時に決めておく（今日はじめて常連になった人が、その日のうちにもう一度来ないように）
    isNew: Math.random() >= (G.repeatShareToday || 0),
  });
  // サウナに入る客だけ、満足に必要な時間を1人ずつ転がす（90分:50% / 120分:35% / 150分:15%）
  if (c.wantsSauna) {
    let r = Math.random();
    for (const [min, share] of STAY_NEED_MIX) { c.needMin = min; if ((r -= share) <= 0) break; }
  }
  /* 導線：来る客は入口の右手から歩いてくる（帰る客は左へ抜ける＝出入りがぶつからない）。
     外の行列も入口の右に伸びるので、来店の列と帰り道が交差しない */
  c.px += T * 2.2;
  c.outside = true;
  /* 受入キャパ確認。ロッカーが埋まりきっている間は新しい客を入れられない。
     **章が独自の関門を持っていれば、そちらが正**（第2章＝1階の靴箱と、
     その客が行く浴室階の脱衣ロッカー。入口で見ないと、階をまたいで詰まる） */
  const entryFull = chHook('entryFull', c);
  if (entryFull === undefined ? lockersFull() : entryFull) {
    c.state = 'turnAway'; c.timer = 1.5;
    G.customers.push(c);
    const p = findPath(CONF.entrance.x, CONF.entrance.y, CONF.entrance.x, CONF.entrance.y - 1);
    c.path = [{ x: CONF.entrance.x, y: CONF.entrance.y }].concat(p || []);   // 右手から戸口まで歩いてくる
    return;
  }
  // フェーズ3：ベンツは鬼頭本人の登場時だけ（作者指定）。強面のモブ客は歩いて来る
  G.customers.push(c);
  G.payQueue.push(c);
  sendToQueueSpot(c);
  chHook('arrived', c);        // 第2章：券売機の前で立ち往生する年配客
  /* 子連れの後ろには、必ず子どもが続く（作者指定＝子どもひとりでは来ない）。
     **どの子が続くかは客タイプに書く**（withKid）＝章ごとに親子を足せる。
     第1章のデータは1バイトも触らないので、oyako だけは従来どおり決め打ちで拾う */
  const kid = kidOf(tk);
  if (kid && !forceKey) spawnCustomer(kid);
}

/* 番台の前に立てるのは1人だけ。2人目以降は店の外＝入口から右の壁沿いに並ぶ。
   外の行列が伸びているほど「捌けていない＝機会損失」がひと目で分かる */
/* 会計待ちの列。第1章は**入口の外の路上**に並ぶ（番台が入口のすぐ内側なので、
   外に並んでいても一歩で番台に着く）。

   第2章のロビーは番台が奥にあり、入口との間に駐車場をまたぐ距離がある。
   外に並ばせると、ひとり会計するたびに次の人が館内を縦断してくる＝
   **行列がまったく捌けず、来た客の6割が待ちくたびれて帰っていた**（実測）。
   だから CONF.queueInside を持つ章は、番台の前から屋内に列を作る。       */
function outsideSpots() {
  if (CONF.queueInside) {
    const f = bandaiFront(), out = [];
    for (let d = 1; d <= 10 && out.length < 6; d++) {
      const x = f.x + d;
      if (x <= CONF.W - 2 && walkable(x, f.y)) out.push({ x, y: f.y });
    }
    for (let d = 1; d <= 10 && out.length < 6; d++) {
      const x = f.x - d;
      if (x >= 1 && walkable(x, f.y)) out.push({ x, y: f.y });
    }
    if (out.length) return out;
  }
  const out = [];
  for (let i = 1; i <= 6; i++) {
    const x = CONF.entrance.x + i;
    if (x > CONF.W - 1) break;
    out.push({ x, y: CONF.H - 1 });
  }
  return out;
}
function isOutsideSpot(s) { return !!s && s.y === CONF.H - 1 && s.x !== CONF.entrance.x; }
function queueSpots() {
  const L = deskLayout(); if (L && L.queue && L.queue.length) return L.queue;
  return [bandaiFront(), ...outsideSpots()];
}

function sendToQueueSpot(c) {
  const spots = queueSpots();
  const idx = clamp(G.payQueue.indexOf(c), 0, spots.length - 1);
  const s = spots[idx];
  const ent = CONF.entrance, t0 = tileOf(c);
  if (isOutsideSpot(s)) {
    // 外周のマスは経路探索の対象外なので、入口を経由して壁沿いにスライドさせる
    c.path = c.outside ? [s] : (findPath(t0.x, t0.y, ent.x, ent.y) || []).concat([s]);
    c.outside = true;
  } else {
    const pth = c.outside ? findPath(ent.x, ent.y, s.x, s.y) : findPath(t0.x, t0.y, s.x, s.y);
    // 番台の前まで歩けない＝誰も金を払えない。放っておくと客が全員待ちくたびれて帰る
    if (!pth) stuckAt(c, '番台');
    c.path = c.outside ? [ent].concat(pth || []) : (pth || []);
    c.outside = false;
  }
  c.qSpot = s;
}

function buildPlan(c) {
  const plan = [];
  // 浴室の設備は CONF.stayMul ぶんだけ長く居座る＝1台の回転が落ちて行列ができる。
  // 脱衣所のマッサージチェアは「ついで」なので伸ばさない
  const m = CONF.stayMul || 1;
  const st = (a, b) => rand(a, b) * m;
  if (hasCat('wash')) plan.push(['wash', st(3.5, 5.5)]);
  if (hasCat('furo')) plan.push(['furo', st(7, 11)]);
  const wantsSauna = c.wantsSauna;
  if (wantsSauna) {
    if (hasCat('sauna')) {
      const rounds = irand(1, 2);
      for (let i = 0; i < rounds; i++) {
        plan.push(['sauna', st(5.5, 8)]);
        if (hasRole('cooler', 'cooler')) plan.push(['drink', 0]);   // サウナ上がりの給水（冷水機まで歩いて飲む）
        if (hasCat('mizu')) plan.push(['mizu', st(1.5, 2.5)]);
        if (hasCat('rest')) plan.push(['rest', st(3, 5)]);
      }
    } else { c.noSauna = true; }
  } else if (hasCat('rest') && Math.random() < .3) plan.push(['rest', st(2, 4)]);
  // 湯から上がったあと、脱衣所のマッサージチェアで一息ついてから着替える客（作者指定＝ちゃんと座らせる）
  if (hasRole('massage', 'massage') && Math.random() < .35) plan.push(['massage', rand(2.5, 4)]);
  /* 湯上がりの飯（第2章の食堂）。**いちばん最後**に入れる＝
     風呂→ととのい→飯、の順に館内を回る。
     第1章には shoku の設備が1つも無いので、この行は一度も通らない。
     席の時間は useDur が「待てる限界」に置き換えるので、ここの数字は使われない */
  /* 「席が実際にあるか」で見る（hasCat だとコンロや炊飯器＝cap0 の厨房機器も数えてしまい、
     座る場所が1つも無い店で客が食堂を予定に入れてしまう） */
  if (catExists('shoku') && Math.random() < (CONF.eatRate ?? 0.45)) plan.push(['shoku', st(6, 9)]);
  /* 章ごとの寄り道を、ここで足せる（第2章＝垢すり・ラウンジ・物販・カプセル）。
     **予定そのものを作り替えるのではなく、最後に足すだけ**にしてある＝
     風呂→ととのい→飯 の背骨は章が変わっても動かない。
     フックを持たない章（第1章）は `plan` に一切触られない＝挙動は不変 */
  chHook('planExtra', c, plan, st);
  return plan;
}

/* ============ 予定の名前 → その設備の探し方 ============
   ふつうは「予定の名前＝設備の種類(cat)」で引ける（'sauna' なら cat:'sauna'）。
   そうでないものが章ごとにある：
     ・`massage` … 種類ではなく**その設備そのもの**（脱衣所のロッカーと混ざらないように）
     ・第2章の `akasuri` … 設備は cat:'wash'（＝カランと同じ枠）なので、cat では引けない
     ・第2章の `lounge`  … 設備は cat:'rest'。**どの階にあるか**で浴室のイスと分ける

   章が `CONF.catFind` を持てば、そこで引き方を差し替えられる。
     { akasuri: { role: 'akasuri' },  lounge: { cat: 'rest', area: 3 } }
   持たない章（第1章）は、これまでどおり cat 一致と massage 特例だけ＝挙動は不変 */
function catMatch(cat) {
  if (cat === 'massage') return (e => isMassage(e.id));
  const f = CONF.catFind && CONF.catFind[cat];
  if (!f) return (e => EQ[e.id].cat === cat);
  return (e => {
    if (f.role && roleIds(f.role, null).indexOf(e.id) < 0) return false;
    if (f.cat && EQ[e.id].cat !== f.cat) return false;
    if (f.area != null && (e.f | 0) !== (f.area | 0)) return false;
    return true;
  });
}

/* 客の「好みの温度」にどれだけ合っているか。
   温度の違う台が並んでいれば、客はそれぞれ自分好みの一台を選ぶ＝
   あつ湯とぬる湯、90℃と110℃、キンキンとぬるめ、両方置かないと全員は満たせない。
   浴槽の湯温は設備ごとに固定なので、「湯船をもう1種類買う」以外に応える手はない */
/* その客が「ちょうどいい」と感じる水温。キンキン好き＝8℃（＝シングルの水風呂）／
   ぬるめ好き＝19℃。水温は設備ごとに固定なので、実際に選べるのは 15℃ か 8℃ の二択になる */
function idealCold(c) { return 8 + (1 - c.type.coldLove) * 11; }
/* その客が「ちょうどいい」と感じる湯温。じいさんのように個人差(furoVar)を持つタイプは、
   来店した1人ごとに好みがずれる（＝同じじいさんでも、あつ湯派とぬる湯長湯派がいる） */
function furoPrefOf(c) { return c.furoPref ?? c.type.furoPref; }

function equipFit(it, c) {
  const d = EQ[it.id];
  let s = (d.q || 1) * 2 + rand(-0.8, 0.8);
  if (!c) return s;
  const t = canSetTemp(d) ? (it.temp ?? d.temp) : d.temp;   // 固定温度の設備は設備の値がすべて
  const near = (a, b) => 10 - Math.min(Math.abs(a - b), 10);
  /* 湯船も水風呂と同じ問題を持っている＝**★の差に負けて、合わない湯へ入る客が出る**。
     `CONF.furoFitMul` を持つ章だけ、湯温の一致を強めに見る（第2章は1.5）。
     この札を持たない章は ×1＝これまでとまったく同じ計算（作者指定 8/8） */
  if (d.cat === 'furo') s += d.old ? 0 : near(t, furoPrefOf(c)) * (CONF.furoFitMul || 1);
  // 水風呂だけは水温の一致を強めに見る。温度を弄れない＝「合う方の槽を選ぶ」以外に好みを満たす道がなく、
  // ★の差（シングルは★5）に負けて、寒すぎる槽へ入って満足度を落とす客が出てしまうため
  else if (d.cat === 'mizu') s += near(t, idealCold(c)) * 1.5;
  else if (d.cat === 'sauna') {
    /* 蒸し系（ミスト・スチーム・薬草）をどれだけ好むかは客ごとに違う（gentleLove）。
       女性客はここが高く、熱いドライサウナには上限（saunaMax）がある＝
       同じ設備を並べても、男湯と女湯では選ばれる部屋が変わる（第2章）    */
    if (d.gentle) s += (c.type.gentleLove ?? 6);
    else {
      s += near(t, c.type.saunaPref);
      const cap = c.type.saunaMax;
      if (cap && t > cap) s -= (t - cap);      // 限界を超える熱さの部屋は、そもそも選ばない
    }
  }
  return s;
}
function findFreeEquip(cat, c) {
  // 列の奥に埋まって手前が空いていない台（ロッカー・洗い場を並べた時の奥側）は選ばない
  // 'massage' だけは種類(cat)ではなく設備そのものを指す予定＝脱衣所の他の設備(ロッカー等)と混ざらないように
  const match = catMatch(cat);
  /* 区画が複数ある章（第2章）では、**いまいる階の設備だけ**から選ぶ。
     別の階の台を選んでしまうと、いまの間取りの座標で道を探すことになり、
     「空いているのにたどり着けない」で客が固まる。第1章は区画がひとつなので素通り */
  const cands = G.equip.filter(e => (areaCount() <= 1 || (e.f | 0) === ((c && c.f | 0) || 0))
    && match(e) && e.cond > 0 && EQ[e.id].cap > 0
    && e.occ.some(o => o === null) && usable(e));
  if (!cands.length) return null;
  cands.sort((a, b) => equipFit(b, c) - equipFit(a, c));
  return cands[0];
}

/* ---- サウナの座席（作者指定：客は絵に描いてある座布団の上に座る） ----
   座布団の並びは drawEquipArt の case 'sauna' とまったく同じ式で出している。
   片方だけ直すと「誰も座っていない座布団があるのに満席」になるので、必ず両方そろえて直すこと。
   遠赤・ミスト・塩・フィンランド式（2×2）＝2段×3枚＝6人／大型（3×2）＝3段×6枚＝18人。
   スペシャル（3×2）だけは階段ベンチではなく、中央のサウナストーンを囲むコの字の6席（作者指定） */
function saunaTiers(id) { return id === 'sauna3' ? 3 : 2; }
function saunaCushions(def) { return def.w >= 3 ? 6 : 3; }
/* スペシャルの座席（局所座標・足元）。左2・奥2・右2でストーンを囲む。
   手前中央は開けておく＝そこがドアであり、熱波師の立ち位置 */
const SP_SEATS = [{ lx: 30, ly: 24 }, { lx: 66, ly: 24 }, { lx: 15, ly: 36 }, { lx: 15, ly: 52 }, { lx: 81, ly: 36 }, { lx: 81, ly: 52 }];
function saunaSeatLocal(id, idx) {
  if (id === 'sauna_sp') return SP_SEATS[Math.min(idx, SP_SEATS.length - 1)];
  const def = EQ[id], w = def.w * T, h = def.h * T;
  const tiers = saunaTiers(id), n = saunaCushions(def);
  const i = Math.min(Math.floor(idx / n), tiers - 1), k = idx % n;
  const step = ((h - 6) - 14) / tiers, by = 4 + i * step;
  const pitch = (w - 12) / n, cw = pitch - 3;
  // 客は足元の座標で描かれるので、座布団の中心よりすこし下げて座らせる（そうしないと頭がサウナ室からはみ出す）
  return { lx: 7 + k * pitch + cw / 2, ly: by + 1 + Math.max(step - 5, 3) / 2 + 6 };
}
/* 客が実際に居座る場所。マス目だけだと1マスに1人しか立てないので、
   「マス＋マス内のずれ(ox,oy)」で返す。サウナだけ座布団の上、他は今までどおりマスの中央 */
function slotPos(item, slotIdx) {
  const def = EQ[item.id];
  const iw = ew(item), ih = eh(item);
  if (def.cat !== 'sauna') {
    return { x: item.x + (slotIdx % iw), y: item.y + Math.min(((slotIdx / iw) | 0), ih - 1), ox: 0, oy: 0 };
  }
  // 設備の絵は回転前の向きで描いてから canvas ごと回している。座席も同じ回転をかけて実座標に直す
  const { lx, ly } = saunaSeatLocal(item.id, slotIdx);
  const fw = iw * T, fh = ih * T;
  const cx = item.x * T + fw / 2, cy = item.y * T + fh / 2;
  const a = Math.PI / 2 * (item.rot || 0);
  const X = lx - def.w * T / 2, Y = ly - def.h * T / 2;
  const wx = cx + X * Math.cos(a) - Y * Math.sin(a);
  const wy = cy + X * Math.sin(a) + Y * Math.cos(a);
  const tx = clamp(Math.floor(wx / T), item.x, item.x + iw - 1);
  const ty = clamp(Math.floor(wy / T), item.y, item.y + ih - 1);
  return { x: tx, y: ty, ox: wx - (tx * T + T / 2), oy: wy - (ty * T + T / 2) };
}

function startUse(c, item, dur) {
  const d = EQ[item.id];
  // 章ごとに滞在時間をいじる（第2章＝厨房の腕で、食事の待ち時間が変わる）
  dur = chHook('useDur', c, item, d.cat, dur) ?? dur;
  const slotIdx = item.occ.findIndex(o => o === null);
  const ap = pathToEquip(c, item);
  if (slotIdx < 0 || !ap) return false;
  item.occ[slotIdx] = c;
  c.use = { item, slotIdx, slot: slotPos(item, slotIdx), approach: ap.tile, cat: d.cat, dur };
  c.path = ap.path;
  c.state = 'goEquip';
  return true;
}

function finishUse(c) {
  const { item, cat } = c.use;
  const def = EQ[item.id];
  // 満足度
  let d = def.q * 3 + (item.cond > 70 ? 2 : item.cond > 40 ? 0 : -3);
  if (def.old) d -= 2;
  c.sat += d;
  // アメニティの効果
  if (cat === 'sauna' && hasMat()) { c.sat += 3; if (!c.bub && Math.random() < .25) bubble(c, pick(LINES.matGood)); }
  if (cat === 'wash' && hasAkasuri()) { c.sat += 2; if (!c.bub && Math.random() < .18) bubble(c, pick(LINES.akasuri)); }
  // シャンプー・ボディソープ。無料なら素直に嬉しい／販売なら買う客だけ（高いほど買わない）
  if (cat === 'wash' && (G.opts.soapMode === 'free' || c.boughtTebura)) {
    c.sat += 2; if (!c.bub && Math.random() < .2) bubble(c, pick(c.boughtTebura ? LINES.teburaGood : LINES.soap));
    if (c.boughtTebura && !c.usedSoap) { c.usedSoap = true; G.today.soapUnits += 2; }   // セットに含まれるぶんも仕入れはかかる
  } else if (cat === 'wash' && G.opts.soapMode === 'sell' && !c.boughtSoap) {
    c.boughtSoap = true;
    const buy = (price) => Math.random() < clamp(0.55 - (price - 50) / 400, 0.1, 0.6);
    let spent = 0, units = 0;
    if (buy(G.opts.shampooPrice)) { spent += G.opts.shampooPrice; units++; }
    if (buy(G.opts.bodysoapPrice)) { spent += G.opts.bodysoapPrice; units++; }
    G.today.soapUnits += units;                          // 売れた本数だけ自動で仕入れる
    if (spent) {
      G.cash += spent; G.today.soapRev += spent; G.today.soapN++; G.today.revenue += spent;
      addFloater(c.px, c.py - 24, `+${yen(spent)}`);
      c.sat += 1;
      if (!c.bub && Math.random() < .2) bubble(c, pick(LINES.soapBuy));
    } else c.sat -= 1;   // 手ぶら客は買わずに我慢＝ちょっと不満
  }
  // 湯温の好み（浴槽・水風呂）。どちらも設備ごとに固定なので、客は“合う湯船を選ぶ”しかない。
  // 選べる湯船が1種類しかないと外れを引く＝それが「風呂の種類を増やせ」という不満になる。
  // ただし温度は自分では直せない不満なので、外した時の下げ幅は水風呂と同じくらいに抑えてある
  c.tempReact = null;
  if (cat === 'furo' && !def.old) {
    /* **湯温で採点しない湯**（`noTemp` を持つ設備だけ。作者指定 8/8）。
       炭酸泉は「ぬるいのに芯まで温まる」のが売り、電気風呂は「ビリビリ効く」のが目的＝
       どちらも湯温を目当てに入る湯ではないのに、★の高さで客を引き寄せておいて
       「ぬるい」「熱い」と文句を言わせていた（第2章の炭酸泉で客の4割が文句）。
       サウナのミスト・薬草（`gentle`）とまったく同じ考え方。
       この印を持たない設備＝第1章の湯船はすべて、これまでどおり湯温で採点する      */
    if (def.noTemp) {
      /* 湯温で測らないぶん、**★の高さがそのまま満足になる**。
         炭酸泉(★5)は+6＝湯温がぴったり合った湯(+5)より上＝¥130万を出す値打ちがある。
         電気風呂(★3)は+5。ここを一律の数字にすると、目玉を買うほど満足が下がる  */
      c.sat += 3 + Math.round((def.q || 2) * 0.6);
    } else {
    const pref = furoPrefOf(c);
    const temp = def.temp ?? 42, diff = Math.abs(temp - pref);
    c.sat += diff <= 1 ? 5 : diff <= 3 ? 2 : -Math.min(diff, 5);
    /* 「熱すぎ」「ぬるい」は、どちらも**その客にとって**外れた時だけ言わせる。
       熱い側は「44℃以上かつ好み43未満」という決め打ちだったが、超あつ湯(45℃)を入れた以上、
       好み42〜43の客が45℃に入ると満足しているのに文句を言う（差3＝満足度は+2）。
       満足度がマイナスに転じる差4以上で言わせる＝**上の行の採点と噛み合わせた**（作者指定 8/8） */
    c.tempReact = (temp - pref >= 4) ? 'hot'
                : (pref - temp >= 3) ? 'nuru'
                : diff <= 1 ? 'atsu' : null;
    }
  } else if (cat === 'mizu') {
    const temp = item.temp ?? def.temp ?? 15;
    const diff = Math.abs(temp - idealCold(c));
    c.sat += diff <= 2 ? 4 : diff <= 5 ? 1 : -3;
    c.tempReact = temp <= 14 ? 'kinkin' : temp >= 20 ? 'nurui' : null;
  } else if (cat === 'sauna') {
    if (def.gentle) {
      /* ミスト・スチーム・薬草は“別ジャンル”。熱さの好みでは評価されない。
         どれだけ嬉しいかは客ごと（gentleLove）＝女性客はここが本命になる */
      c.sat += Math.round((c.type.gentleLove ?? 6) * 0.7);
    } else {
      const temp = item.temp ?? def.temp ?? 90, diff = temp - c.type.saunaPref, ad = Math.abs(diff);
      c.sat += ad <= 4 ? 5 : ad <= 10 ? 2 : -Math.min(Math.round(ad / 2), 8);
      /* 熱さの限界（saunaMax）。ここを超えると、好みの幅とは別に、はっきり嫌がる。
         女性客は85℃あたりが限界＝100℃のドライサウナを並べても女湯は埋まらない（作者指定） */
      const cap = c.type.saunaMax;
      const over = cap ? temp - cap : 0;
      if (over > 0) c.sat -= Math.min(3 + Math.round(over / 2), 12);
      // atsusa=好みより熱すぎ(不満) / nurusa=ぬるすぎ / gekinetsu=許容範囲の高温を堪能(満足)
      c.tempReact = (diff >= 12 || over > 0) ? 'atsusa' : diff <= -12 ? 'nurusa' : (temp >= 100 ? 'gekinetsu' : null);
    }
    // サウナに給水（冷水機）がないと、いいサウナでも満足しきれない
    if (!hasRole('cooler', 'cooler')) c.sat -= 2;
    /* 熱波師のアウフグース。決戦仕様の一台に限り満足度が上乗せ。
       ※以前はマッサージチェアの分岐の中に書かれていて、一度も発動していなかった */
    if (item.id === 'sauna_sp' && nappaOn()) { c.sat += 3; if (!c.bub && Math.random() < .3) bubble(c, pick(LINES.aufguss)); }
  } else if (isMassage(item.id)) {
    // マッサージチェア＝¥100を入れて座る。売上はここで立つ（座った客からだけ取る）
    c.sat += 5;
    const coin = coinPrice(item.id);
    G.cash += coin; G.today.amenRev += coin; G.today.amenN++; G.today.revenue += coin;
    addFloater(c.px, c.py - 22, '+' + yen(coin));
    c.massaged = true;
  }
  /* 周辺の汚れ。薄い汚れは数えない（作者指定）＝薄いうちはプレイヤーに掃除する手がなく、
     見えた瞬間に怒られるのは理不尽だった。こびり付いた濃い汚れだけが客の目に入る */
  if (c.dirtHits < 3) {
    const nearD = G.dirts.filter(p => isThickDirt(p) && (p.f | 0) === (c.f | 0)
      && Math.abs(p.x - c.use.approach.x) <= 2 && Math.abs(p.y - c.use.approach.y) <= 2);
    const near = nearD.length;
    if (near > 0) {
      c.sat -= Math.min(near * 2, 6); c.dirtHits++; gripe('dirty');
      // ゴキブリを見てしまった客は、汚れを見ただけの客とは比べものにならないくらい怒る（作者指定）
      if (nearD.some(p => p.roach)) { c.sat -= 8; hintBubble(c, pick(LINES.roach)); }
      else if (Math.random() < .4) bubble(c, pick(LINES.dirty));
    }
  }
  /* 店ぜんたいの汚れ具合。使った設備の近くかどうかに関係なく効く。判定は客ひとりにつき一度だけ。
     ・薄い汚れ → セーフ。何も起きない（作者指定＝薄いうちは掃除できないので罰しない）
     ・濃いのが1つでも → 小さな不満（一部の客が漏らす。満足度は少しだけ落ちる）
     ・濃いのが3つ以上 → 大きな不満（全員が口に出し、満足度がごっそり落ちる）
     こまめに掃除していれば汚れは濃くならない＝バイトを置く価値がここで効く（作者指定） */
  const dc = dirtCounts();
  if (dc.thick >= CONF.dirtAngryN && !c.dirtAngry) {
    c.dirtAngry = true;
    if (Math.random() < CONF.dirtAngryRate) {
      c.sat -= CONF.dirtAngryHit;
      gripe('dirty');
      const line = pick(LINES.dirtyBad);
      hintBubble(c, line);
      voice(c, line, 'dirty', CONF.dirtAngryHit, '⚠');
    }
  } else if (dc.thick >= 1 && !c.dirtAnnoy) {
    c.dirtAnnoy = true;
    c.sat -= CONF.dirtThinHit;
    if (Math.random() < CONF.dirtThinRate) { gripe('dirty'); bubble(c, pick(LINES.dirty)); }
  }
  // セリフ
  if (!c.bub) {
    if (cat === 'furo') {
      if (def.old) bubble(c, pick(LINES.bathOld));
      /* 「ぬる湯も置いてくれ」は、店にぬる湯（40℃以下）が無い時だけ（作者指摘）。
         あるのにそう言われると、何を求められているのか分からない */
      else if (c.tempReact === 'hot') {
        gripe('temp');
        gripeBubble(c, pick(furoTemps().some(v => v <= 40) ? LINES.furoHotOnly : LINES.furoHot), 'temp');
      }
      else if (c.tempReact === 'nuru') { gripe('temp'); gripeBubble(c, pick(LINES.furoNuru), 'temp'); }
      else if (item.id === 'bath2') bubble(c, pick(LINES.bathHinoki));
      else if (item.id === 'bath_tansan') bubble(c, pick(LINES.furoTansan));
      /* 設備が自分で「言わせたい台詞」を持っている場合はそれを使う（作者指定 8/8）。
         下の湯温での言い分けに落ちると、電気風呂(43℃)が「あ〜熱い！」と言ってしまい、
         ビリビリを目当てに入った客の台詞として噛み合わない。
         `line` を持たない設備＝第1章の湯船はすべて、これまでどおり湯温で言い分ける */
      else if (def.line && LINES[def.line]) bubble(c, pick(LINES[def.line]));
      /* 湯温で言い分けする（作者指摘）。40℃以下の湯で「あ〜熱い！最高！」と言うと、
         入っている湯船と噛み合わない。42℃前後はふつうの「いい湯だ」 */
      else if ((def.temp ?? 42) <= 40) bubble(c, pick(LINES.furoNuruYoi));
      else if ((def.temp ?? 42) >= 43) bubble(c, pick(LINES.furoAtsu));
      else bubble(c, pick(LINES.bathGood));
    }
    else if (cat === 'sauna') {
      // ミスト・塩は低温多湿の“別ジャンル”＝「熱すぎ」「カリカリ」系は出さず、専用のセリフで（作者指定）
      if (def.gentle) bubble(c, pick(item.id === 'sauna_shio' ? LINES.saunaShio : LINES.saunaMist));
      else if ((item.id === 'sauna2' || item.id === 'sauna_sp') && (item.temp ?? def.temp) >= 100 && c.tempReact !== 'atsusa') bubble(c, pick(LINES.saunaSuper));
      else if (c.tempReact === 'gekinetsu') bubble(c, pick(LINES.saunaHot));
      else if (c.tempReact === 'atsusa') { gripe('temp'); gripeBubble(c, pick(LINES.saunaTooHot), 'temp'); }
      else if (c.tempReact === 'nurusa') { gripe('temp'); gripeBubble(c, pick(LINES.saunaNuru), 'temp'); }
      // 通常セリフも室温で言い分ける（中温の部屋で「あっつ〜！最高！」と言わせない・作者指定）
      else bubble(c, pick((item.temp ?? def.temp ?? 90) >= 95 ? LINES.saunaGoodHot : LINES.saunaGood));
    }
    else if (cat === 'mizu') {
      if (c.tempReact === 'kinkin') bubble(c, pick(LINES.mizuKinkin));
      else if (c.tempReact === 'nurui') { gripe('temp'); gripeBubble(c, pick(LINES.mizuNurui), 'temp'); }
      else bubble(c, pick(LINES.mizuGood));
    }
    else if (cat === 'wash') bubble(c, pick(def.old ? LINES.washOld : LINES.washGood));
    else if (cat === 'rest') bubble(c, pick(LINES.rest));
    else if (isMassage(item.id)) bubble(c, pick(LINES.massageGood));
  }
  // ととのいコンボ
  c.seq.push(cat);
  if (cat === 'sauna') c.lastSaunaGentle = !!def.gentle;   // 直前がミスト/塩なら、ととのいのセリフも穏やかに
  const s3 = c.seq.slice(-3).join(',');
  if (cat === 'rest' && s3 === 'sauna,mizu,rest' && !c.gotTotonoi) {
    G.today.totonoiTry++;
    if (Math.random() < totonoiChance()) {
      c.sat += 18; c.gotTotonoi = true; G.today.totonoi++;
      // ミスト・塩発のととのいは低温なので「あまみが出た」とは言わない（作者指定）
      const tLines = c.lastSaunaGentle ? LINES.totonoiSoft : LINES.totonoi;
      bubble(c, pick(tLines), 3.2);
      addSparkle(c.px, c.py - 20);
      voice(c, pick(tLines), 'totonoi', 0);
    } else {
      // 順番は踏んだのに、ととのいきらなかった＝設備か清潔さが足りない
      c.sat += 6;
      gripe('totonoi');
      bubble(c, pick(LINES.totonoiMiss), 3);
    }
  }
  // 設備消耗と汚れ発生（1回の利用でこれだけ減る。古い設備ほど早くヘタる）
  // フェーズ3：田所が仲間でも維持費は軽くしない（簡単すぎたため減額特典を廃止。作者指定）
  item.cond -= (def.old ? rand(0.9, 1.6) : rand(0.3, 0.6)) / CONF.durability;
  if (item.cond <= 0) {
    breakEquip(item);
    log(`💥 ${def.name}が壊れた！（${faultLabel(item)}）`);
  }
  // 子どもは湯をはねさせ、走り回る＝浴室が汚れやすい（作者指定）
  if ((cat === 'furo' || cat === 'wash' || cat === 'sauna')
      && Math.random() < (c.isChild ? CONF.dirtChanceKid : CONF.dirtChance) * cleanFactor(item.f) && G.dirts.length < CONF.dirtMax) {
    /* 章が「どのマスに落とすか」を持っていれば、そちらに任せる。
       ⚠ **区画が複数ある章では、ここは主人公のいる階しか見られない。**
         下の reachableSet() も approachTiles() も「いま表示している区画」の盤面を読むので、
         別の階の設備を渡すと座標が噛み合わず、**汚れが一つも落ちない**（第2章で実測：
         228人が風呂を使った一日で、床の汚れが0個だった）。しかも f に G.actF を刻むので、
         落ちたとしても「主人公が立っている階が汚れた」ことになってしまう。
       第1章はこのフックを持たないので、下の従来どおりの道を通る＝挙動は不変 */
    if (hasHook('dirtSpot')) {
      const sp = chHook('dirtSpot', item);
      if (sp) G.dirts.push({ x: sp.x, y: sp.y, t: G.minutes, f: sp.f | 0 });
    } else {
      /* 汚れが落ちるのは「掃除しに行けるマス」だけ。しかも1マスに1つまで。
         壁際などで誰もたどり着けないマスに落ちると、主人公もバイトも一生掃除できず、
         汚れが上限まで溜まったまま店が永久に「汚い店」になる（実測で発生した） */
      const reach = reachableSet();
      const ts = approachTiles(item).filter(p =>
        reach.has(p.y * CONF.W + p.x) && !G.dirts.some(d => d.x === p.x && d.y === p.y));
      if (ts.length) { const p = pick(ts); G.dirts.push({ x: p.x, y: p.y, t: G.minutes, f: G.actF }); }   // t＝落ちた時刻（放置判定に使う）
    }
  }
  // 章ごとの後始末（第2章＝食堂の席を立った客が、何を頼んだかを決める）
  chHook('useDone', c, item, cat);
  c.use = null;
}

// そのカテゴリの設備が「存在する」か（故障中も含む）
function catExists(cat) {
  const match = catMatch(cat);
  return G.equip.some(e => match(e) && EQ[e.id].cap > 0 && usable(e));
}

/* 満員 or 故障で使えない → その設備の前まで歩いて行って並ぶ */
function goWaitFor(c, cat, dur) {
  c.plan.unshift([cat, dur]);
  c.state = 'waitEquip'; c.waitT = 0; c.waitNag = 0;
  const matchW = catMatch(cat);
  const items = G.equip.filter(e => matchW(e) && EQ[e.id].cap > 0 && usable(e));
  if (!items.length) return;
  const it = pick(items);
  c.waitItem = it;
  /* 並ぶ位置は「設備の手前で、かつ客がそこまで歩けるマス」から選ぶ（作者報告）。
     以前は手前のマスを順番だけで選んでいたので、設備に囲まれて孤立した1マスが混ざっていると、
     2人目に並ぼうとした客がそこを割り当てられて「ととのいイスにたどり着けない」と言い出していた。
     イスは目の前にあるのに、たまにしか出ない＝並ぶ順番によって当たり外れがあったのが理由 */
  const t0 = tileOf(c);
  const spots = approachTiles(it).map(sp => ({ sp, path: findPath(t0.x, t0.y, sp.x, sp.y) })).filter(o => o.path);
  /* 行列に並ぶのは「そこまで歩けるマス」だけ。順番だけで手前のマスを割り当てていた頃は、
     設備に囲まれて孤立した1マスが混ざっていると、2人目の客が「たどり着けない」と言い出していた。
     どの手前マスにも道が無い時も、ここでは黙ってその場で待たせる＝待ち時間は【混雑】として数える（作者指定）。
     配置がほんとうに悪い（誰も使えない）設備は、準備画面の「使えない設備」で別に知らせている */
  const ahead = G.customers.filter(o => o !== c && o.state === 'waitEquip' && o.waitItem === it).length;
  c.path = spots.length ? spots[ahead % spots.length].path : [];
}

/* 洗い場なら垢すりタオル、サウナならサウナマットを手に持って向かう。
   借りるのは1来店につき1回きり（＝置き場で一式まとめて受け取る扱い）。
   以前は使う設備が変わるたびに置き場まで往復していて、その往復だけで客ひとり100分を溶かしていた。
   c.carry は「いま手に持って見せているもの」＝見た目だけの値で、c.amen が「借りているか」の実体 */
function carryFor(cat) { return cat === 'wash' ? 'aka' : cat === 'sauna' ? 'mat' : null; }
function rackIdOf(kind) { return kind === 'mat' ? 'matrack' : 'akarack'; }

/* 置き場まで歩かせる。dir='get'で手に取り、'back'で返す */
function goRack(c, kind, dir) {
  const rack = G.equip.find(e => e.id === rackIdOf(kind));
  if (!rack) return false;
  const ap = pathToEquip(c, rack);
  if (!ap) { stuckAt(c, EQ[rack.id].name); return false; }
  /* 実際に手に取った枚数を数える（**枚数で洗濯代がかかる章だけ**）。
     返しに来たとき（back）は数えない＝1人1枚。
     第1章は akasuriCostPer を持たないので、この行は通らない */
  if (dir === 'get' && kind === 'aka' && CONF.akasuriCostPer && G.today)
    G.today.akasuriUseN = (G.today.akasuriUseN || 0) + 1;
  c.path = ap.path;
  c.rackKind = kind; c.rackDir = dir;
  c.state = 'atRack'; c.timer = 0.7;
  return true;
}

/* ---- 「置くだけで効く設備」を、実際に使いに行かせる（冷水機・扇風機・洗面所） ----
   満足度そのものは帰り際にまとめて効いている（customerLeave）。ここは“画”のための振る舞い＝
   サウナ上がりに水を飲み、湯上がりに扇風機で涼み、着替えてから鏡の前で髪を乾かす。
   1台につき同時に1人まで（pasBy に客の id を入れて場所取りする） */
/* ============ 子どものおしゃべり（作者指定 2026-08-08・両章共通）============
   `LINES.kidLine` は**いま何に入っているかを一切見ない**表だったので、
   38℃のぬる湯で「あちー！」、45℃の超あつ湯で「つめたっ！」が出ていた。
   `furoAtsu` / `saunaGoodHot` を湯温で分けた回の、取りこぼし。

     ・「あちー！」   … **サウナ**か、**`kidHotTemp`（既定43℃）以上の湯**のときだけ
     ・「つめたっ！」 … **水風呂**のときだけ
     ・残りの4語（パパー、まだー？／およぐ！／牛乳のむ！／もう一回！）は**どこでも出る**
       ＝にぎやかさの演出は殺さない

   43℃の根拠は第1章のあつ湯43・超あつ湯45（js/data.js:249,255）。
   42℃以下の湯で「あちー！」と言わせない。境目を変えたい章は `CONF.kidHotTemp` を持つ。
   ⚠ `LINES.kidLine` の6語は**触らない。**落とすのは選ぶ側（章の指紋が動くため）*/
const KID_HOT_LINE = 'あちー！';
const KID_COLD_LINE = 'つめたっ！';
function kidLinePool(c) {
  const u = c && c.use;
  const d = u && u.item && EQ[u.item.id];
  const cat = u ? (u.cat || (d && d.cat)) : null;
  const temp = d ? (u.item.temp != null ? u.item.temp : d.temp) : null;
  const hotOK  = cat === 'sauna' || (temp != null && temp >= (CONF.kidHotTemp || 43));
  const coldOK = cat === 'mizu';
  if (hotOK && coldOK) return LINES.kidLine;                 // 起こりえないが、素通りさせる
  return LINES.kidLine.filter(t =>
    (t !== KID_HOT_LINE  || hotOK) &&
    (t !== KID_COLD_LINE || coldOK));
}

const PAS_USE = {
  drink: { id:'cooler',   dur:[1.4, 2.6], say:0.35 },   // 冷水機で給水
  fan:   { id:'fan_bath', dur:[3.5, 6.0], say:0.30 },   // 扇風機の前でひと涼み
  sink:  { ids:SINK_IDS, dur:[3.0, 5.0], say:0.30 },   // 洗面所で髪を乾かす（古い洗面台でも同じ）
  scale: { id:'scale',    dur:[2.0, 3.4], say:0.5 },    // 体重計に乗って一喜一憂（針がぐるっと振れる）
  gacha: { id:'gacha',    dur:[2.2, 3.6], say:0.6 },    // 子どもが¥100を入れて回す（売上になる）
  /* 駄菓子コーナー（第2章の y_dagashi）。**第1章にこの id の設備は無い**ので、
     goPasUse が必ず false になり、第1章の挙動は1ミリも変わらない */
  dagashi: { id:'y_dagashi', dur:[2.5, 4.0], say:0.6 },
  ehon:  { id:'ehon',     dur:[4.0, 7.0], say:0.6 },    // 絵本の棚の前に座って読む（子どもだけ）
  // トイレ（作者指定）。便器の上に座って（ボットンはしゃがんで）用を足し、出てきた時に一言
  toilet:{ ids:TOILET_IDS, dur:[3.0, 5.0], say:0 },
};
const GACHA_PRICE = 100;      // ガチャガチャ1回（作者指定）
const GACHA_KID_RATE = 0.30;  // 子どものうち、回していく割合（作者指定）
/* ⚠ 上の表のIDは**第1章のもの**。章ごとの表（sinkIds / toiletIds / roleIds）があれば
   そちらを見る。ここを直さないあいだ、第2章では
   **冷水機にも洗面所にもトイレにも、客が一度も歩いて行っていなかった**
   （100日通しで発見・2026-08-07）。章が表を持たなければ [p.id] に落ちる＝第1章は同じ */
function pasIds(kind) {
  const p = PAS_USE[kind]; if (!p) return [];
  if (kind === 'sink')   return sinkIds();
  if (kind === 'toilet') return toiletIds();
  if (kind === 'drink')  return roleIds('cooler', 'cooler');
  if (kind === 'fan')    return roleIds('fan', 'fan_bath');
  if (kind === 'scale')  return roleIds('scale', 'scale');
  return p.ids || [p.id];
}
// これらは「置くだけ」に見えて実際に歩いて行く＝道が要る（needsAccess で使う）
function pasUseIds() { return new Set(Object.keys(PAS_USE).flatMap(pasIds)); }
function pasLineFor(kind) {
  if (kind === 'drink') return LINES.coolerGood;
  if (kind === 'fan') return LINES.fanGood;
  if (kind === 'scale') return LINES.scaleGood;
  if (kind === 'gacha') return LINES.gachaGood;
  if (kind === 'dagashi') return ['ラムネ、1本だけな', '10円チョコ、まだあるんだ', '駄菓子、懐かしいなあ'];
  if (kind === 'ehon') return LINES.ehonGood;
  if (kind === 'toilet') return LINES.toiletDone;
  return G.opts.dryerFee ? LINES.dryerPaid : LINES.dryerFree;
}
function goPasUse(c, kind, next) {
  const p = PAS_USE[kind];
  const ids = pasIds(kind);
  const items = G.equip.filter(e => ids.includes(e.id) && e.cond > 0 && !e.pasBy && usable(e));
  if (!items.length) return false;
  const it = pick(items);
  const ap = pathToEquip(c, it);
  if (!ap) return false;
  it.pasBy = c.id;                                   // ふさがっている印（他の客は別の台へ／諦める）
  c.pas = { kind, item: it, next: next || 'plan' };
  c.path = ap.path; c.state = 'toPas'; c.timer = rand(p.dur[0], p.dur[1]);
  if (!c.bub && Math.random() < p.say) bubble(c, pick(pasLineFor(kind)));
  return true;
}
function endPasUse(c) {
  if (!c.pas) return;
  if (c.pas.item.pasBy === c.id) c.pas.item.pasBy = null;
  c.pas = null;
}

function nextPlan(c) {
  /* 持っているマット・垢すりは、次に別のものが要るときだけ返しに行く。
     以前は「次が風呂・水風呂・休憩なら即返却」だったので、サウナ→水風呂→休憩→サウナのたびに
     置き場まで往復していた。客ひとりの滞在400分のうち100分が、この往復に消えていた */
  while (c.plan.length) {
    const [cat, dur] = c.plan[0];
    // 冷水機での給水は「設備の予定」ではなく、その場に行って飲むだけ
    if (PAS_USE[cat]) { c.plan.shift(); if (goPasUse(c, cat)) return; continue; }
    // これから使う設備に対応するアメニティがあるなら、まだ借りていないときだけ取りに行く
    const want = carryFor(cat);
    if (want && !c.amen && hasEquip(rackIdOf(want)) && goRack(c, want, 'get')) return;
    c.carry = c.amen ? want : null;                  // 手に持って見せるものを、使う設備に合わせて持ち替える
    /* 第2章：次に使うものが別の区画（休憩スペース・食堂など）にあるなら、まずそこへ移る。
       第1章は区画がひとつなので、このフックは登録されていない＝素通りする */
    if (hasHook('routeTo') && chHook('routeTo', c, cat)) return;
    c.plan.shift();
    const item = findFreeEquip(cat, c);
    // 空いているのに startUse が失敗する＝その台まで歩いて行く道が無い
    if (item) { if (startUse(c, item, dur)) return; stuckAt(c, EQ[item.id].name); continue; }
    // 設備はあるのに使えない（満員・故障）→ 前で並んで不満を言う
    if (catExists(cat)) { goWaitFor(c, cat, dur); return; }
  }
  // やることを終えた → 借りたものを返してから、湯上がりに風に当たって着替えて帰る
  if (c.amen) { if (goRack(c, c.carry || 'mat', 'back')) return; c.amen = false; c.carry = null; }
  if (!c.didFan && Math.random() < 0.6 && goPasUse(c, 'fan')) { c.didFan = true; return; }
  goLocker(c, 'out');
}

/* 着替え終わったあと（洗面所で髪を乾かす → 自販機 → 帰る） */
function afterChange(c) {
  // 子どもは3割がガチャガチャを回して帰る（¥100が売上に立つ・作者指定）
  if (c.isChild && !c.didGacha && Math.random() < GACHA_KID_RATE && goPasUse(c, 'gacha', 'leave')) { c.didGacha = true; return; }
  /* 駄菓子コーナー（第2章）。子どもは半分が寄り、大人も15%が湯上がりの1本を買って帰る。
     ⚠ **設備の有無を最初に見る**＝第1章に y_dagashi は無いので Math.random() まで
     到達しない。先に乱数を引くと、第1章でも乱数列が1つずれて挙動指紋が変わる
     （chapterGuard(1) が落ちる。実測 8/9） */
  if (!c.didDagashi && G.equip.some(e => e.id === 'y_dagashi' && e.cond > 0)
      && Math.random() < (c.isChild ? 0.5 : 0.15) && goPasUse(c, 'dagashi', 'leave')) { c.didDagashi = true; return; }
  // 親の着替えを待つあいだ、絵本の棚の前に座って読む子ども（作者指定）
  if (c.isChild && !c.didEhon && Math.random() < 0.5 && goPasUse(c, 'ehon', 'leave')) { c.didEhon = true; return; }
  // 帰る前にトイレへ寄る客（作者指定）。トイレが無ければ、そのまま我慢して帰ることになる
  if (!c.didToilet && Math.random() < 0.35 && goPasUse(c, 'toilet', 'leave')) { c.didToilet = true; return; }
  if (!c.didSink && Math.random() < 0.7 && goPasUse(c, 'sink', 'leave')) { c.didSink = true; return; }
  // 風呂上がり、つい体重計に乗って一喜一憂する（乗るまでが風呂、という田所の言い分）
  if (!c.didScale && Math.random() < 0.55 && goPasUse(c, 'scale', 'leave')) { c.didScale = true; return; }
  /* **飲み物を売る機械の一覧**（作者指定 8/5）。
     ここを id で名指ししていたせいで、**第2章の自販機は1本も売れていなかった**。
     表に出しておけば、章が増えても足すだけで済む。値段はここが正             */
  const vends = G.equip.filter(e => DRINK_VEND[e.id] && e.cond > 0 && usable(e)
                                 && (areaCount() <= 1 || (e.f | 0) === (c.f | 0)));
  const vend = vends.length ? pick(vends) : null;
  if (vend && Math.random() < c.type.milk) {
    const ap = pathToEquip(c, vend);
    if (ap) { c.path = ap.path; c.vendId = vend.id; c.state = 'toVend'; return; }
  }
  customerLeave(c);
}

function goLocker(c, dir) {
  /* 区画が複数ある章（第2章）＝**脱衣ロッカーは自分の階にある。**
     受付は1階、脱衣所は2階、という作りなので、金を払った客はまず階を移る。
     移動が始まったらここでは何もしない（着いた先で、あらためて着替えに向かう）。
     第1章は区画がひとつなので、この行は素通りする                        */
  if (dir === 'in' && areaCount() > 1 && hasHook('routeTo') && chHook('routeTo', c, 'locker')) return;
  // 壁一面に並べたロッカーは、手前に立てる1台の前で着替える（奥の列は開けに行けない）
  // 区画が複数ある章では、**いまいる区画のロッカーだけ**を見る（別の階の台まで歩けない）
  const lockers = G.equip.filter(e => (areaCount() <= 1 || (e.f | 0) === (c.f | 0))
    && EQ[e.id].cat === 'locker' && e.cond > 0 && usable(e));
  const lk = lockers.length ? pick(lockers) : null;
  if (!lk) { c.state = 'toExit'; walkToExit(c); return; }
  // 脱衣ロッカーに近づけない＝着替えられずに帰るしかない。いちばん痛い塞ぎ方なので必ず知らせる
  const ap = pathToEquip(c, lk);
  if (!ap) { stuckAt(c, 'ロッカー'); c.state = 'toExit'; walkToExit(c); return; }
  c.path = ap.path;
  c.state = dir === 'in' ? 'lockerIn' : 'lockerOut';
  c.timer = 1.2;
}
/* 帰り道。戸を出たあとは入口の左手へ抜けていく（来る客は右手から来る＝すれ違わない） */
/* 帰り道。**その区画の入口まで歩いて、外の壁沿いに消える。**
   ⚠ 区画が階になっている章（第2章）では、これが嘘になる。2階の男湯の「入口」は
   エレベーターの扉なので、**扉まで歩いたあと、その階の左下の壁へ向かって消えて**いた
   （作者指摘 8/8「一回EVに行ってから左下の壁を通って消える」）。
   章が帰し方を持っていればそちらに任せる＝第1章はフックが無いので従来どおり */
function walkToExit(c) {
  if (chHook('walkToExit', c)) return;
  const t0 = tileOf(c);
  const ent = CONF.entrance;
  /* 玄関に着いたあと、盤の外へ消えるための最後の一歩。
     第1章は玄関そのものが (0, H-1) ＝同じ升目を2回指しているだけで、動きは起きない。
     第2章は玄関が下辺の真ん中(8,18)なので、ここが左下の角だと**そこまで突っ切る**＝
     「EVから左下へワープする」の正体（作者報告 8/8）。章が行き先を持てばそちらへ */
  const gone = chHook('exitTile') || { x: 0, y: CONF.H - 1 };
  c.path = (findPath(t0.x, t0.y, ent.x, ent.y) || []).concat([gone]);
}

/* ---- 施設の充実度と、料金への納得感 ----
   充実した銭湯なら高くても文句は出ない。ボロいまま高いと不満が出る。 */
/* condFloor（0〜1）を渡すと、消耗した設備の点の目減りをそこで下支えする。
   評判の天井（repFacility）はこれを0.5で呼ぶ＝壊れていなければ格の半分は認める。
   消耗をそのまま効かせると、終盤は常に設備の3〜4割が草臥れていて、天井が万年伸び悩み
   評判65（玲奈の投票対決）に届かなくなる（シム実測）。0.7だと逆に速すぎた */
/* 充実度を「設備の質／品揃え／サービス・備品／汚れ」に分けて返す。
   データ画面で内訳を見せる（＝どこを伸ばせば格が上がるか分かる）ために分解した */
function facilityParts(condFloor) {
  let equip = 0;
  for (const e of G.equip) {
    const d = EQ[e.id];
    if (e.dead) continue;                          // 道が通っていない“飾り”は、あっても無いのと同じ
    const f = e.cond <= 0 ? 0 : clamp(e.cond, 0, 100) / 100;   // 故障中は0点のまま
    if (d.cap > 0) equip += (d.q || 1) * 2 * (condFloor && f > 0 ? condFloor + (1 - condFloor) * f : f);
  }
  // 湯・サウナ・水風呂の“品揃え”＝好みの違う客を取りこぼさない店ほど充実している
  let variety = 0;
  if (hasCat('sauna')) variety += 8;
  if (hasCat('mizu')) variety += 6;
  variety += furoKinds() * 3 + tempVariety('sauna') * 3 + tempVariety('mizu') * 3 + (hasGentleSauna() ? 3 : 0);
  /* サービス・備品（無料の石鹸・タオル・マット類・置くだけ設備）。
     何を入れているから何点なのかが評判の内訳で読めるよう、名前も一緒に控えておく（作者指定） */
  let system = 0;
  const sysList = [];
  const sysAdd = (name, pts) => { system += pts; sysList.push(name); };
  if (G.opts.soapMode === 'free') sysAdd('石鹸（無料）', 4);
  else if (G.opts.soapMode === 'sell') sysAdd('石鹸（有料）', 2);   // 有料は「充実」としては半分の評価
  if (hasMat()) sysAdd('サウナマット', 3);
  if (hasAkasuri()) sysAdd('垢すりタオル', 3);
  if (G.opts.towel === 'free') sysAdd('タオル無料', 4);
  if (G.opts.tebura && G.opts.towel !== 'free') sysAdd('手ぶらセット', 4);   // 手ぶらで来られる＝立派な充実
  for (const id of passiveEquips()) sysAdd(EQ[id].name, EQ[id].pas.score || 2);
  /* 汚れていると台無し。薄い汚れは軽く、放置してこびり付いた濃い汚れは重く効く（作者指定＝罰を厳しく）。
     こまめに掃除していれば濃い汚れは出ないので、ここが重くても掃除さえすれば痛くない */
  const dcf = dirtCounts();
  const dirt = -Math.min(dcf.thick * 3, 25);   // 薄い汚れは数えない（作者指定）
  return { equip, variety, system, sysList, dirt, total: Math.max(0, equip + variety + system + dirt) };
}
function facilityScore(condFloor) { return facilityParts(condFloor).total; }   // 目安: 初日10前後 〜 充実で70超
/* ============ 評判＝10項目の採点方式（作者指定・新評判システム） ============
   旧方式（設備の充実度＋おもてなし の2本立て）は、設備を積むだけで簡単に高得点になった。
   新方式は「10項目 × 10点満点 ＝ 100点」。どれか1つを極めても100にはならず、
   清潔・混雑・値ごろ感・湯とサウナ・脱衣所・導線・接客の全部を同時に立てて初めて高得点になる。
   ・10項目は毎晩その日ぶんを採点し、直近7日の平均を表に出す＝良い営業を続けた店だけが伸びる
   ・最初の7日は母数が足りないので「集計中」と表示し、評判は開店時の10のまま据え置く
   ・【その他】の減点だけは即時反映。直せばその場で消える＝手を打った手応えがすぐ出る
   ※「店の格」という言い方はユーザーには見せない（内部の都合でしかないため・作者指定） */
const REP_DAYS = 7;                                 // 何日ぶんの平均で採点するか
const REP_WARMUP = 7;                               // この日数までは「集計中」（評判は据え置き）
const REP_START = 10;                               // 集計中のあいだの評判＝開店時の値

const REP_ITEMS = [
  { key: 'clean',  name: '清潔度',           hint: '汚れを残さない・バイトを増やす' },
  { key: 'crowd',  name: '混雑度',           hint: '待たせない・ロッカーを増やす' },
  { key: 'cospa',  name: 'コスパ',           hint: '料金を目安より安く・それでも黒字に' },
  { key: 'sauna',  name: 'サウナ',           hint: 'いい台・席数・温度の違う2台目' },
  { key: 'furo',   name: 'お風呂',           hint: 'いい湯船・種類・湯船の大きさ' },
  { key: 'mizu',   name: '水風呂',           hint: 'いい水風呂・水温の選択肢・槽の数' },
  { key: 'datsui', name: '脱衣所サービス',   hint: '備品・洗面所・ロッカーの余裕' },
  { key: 'rest',   name: 'ととのいスペース', hint: 'いいイス・脚数・種類' },
  { key: 'dosen',  name: '導線',             hint: '客が使う順に設備を近く並べる' },
  { key: 'omote',  name: 'おもてなし',       hint: '愛想のいいバイト・アメニティを安く' },
];

/* ---- 料金の値ごろ感（作者指定） ----
   適正値 +2.5 ／ 適正値より安い +3.5 ／ 適正値より高い 0。
   「適正値」＝客が受け入れる上限（worthFee など）と同じ¥100の段。
   その1段でも下げれば「安い」＝満点、超えたら一発で0。入浴料・子供料金・サウナ料の3本立て。 */
const FEE_FAIR = 2.0, FEE_CHEAP = 3.0;   // 3本とも「適正より安い」で9点。残り1点は黒字経営（作者指定）
/* 「適正」と見なす帯の幅も、章の値段の幅で変わる（feeUnit）。
   ¥100固定のままだと、¥2,300幅の第2章では帯が実質ゼロ＝
   **目安の¥100手前まではずっと満点、1円でも超えたら0点**という崖になっていた */
function feeScore(price, fair) { return price > fair ? 0 : price > fair - feeUnit(fair) ? FEE_FAIR : FEE_CHEAP; }

/* ---- アメニティ1品ごとの評価（作者指定）＝「おもてなし」の1要素 ----
   適正値 +1.5 ／ 適正値より安い +2 ／ 適正値より高い 0 ／ なし 0。
   ドライヤーだけは 無料 +1・有料 +0.5（そもそも取れる額が小さいので幅も小さい）。
   合計は AMEN_MAX 点満点で、おもてなしの3点ぶんに換算して入る。 */
const AMEN_CHEAP = 2, AMEN_FAIR = 1.5;
const AMEN_MAX = 11;
function amenityParts() {
  const o = G.opts;
  const list = [];
  /* max＝その品で取れる満点。ドライヤーだけは満点が1点しかないので、
     「無料にしてあるのに、まだ伸ばせます」と言われないよう品ごとに持たせる */
  const add = (name, v, note, max) => list.push({ name, v, note, max: max ?? AMEN_CHEAP });
  // タオル：無料がいちばん安い／¥50 安い／¥100 適正／¥150以上は高い
  if (o.towel === 'free') add('タオル', AMEN_CHEAP, '無料');
  else if (o.towel === 'paid')
    add('タオル', o.towelPrice < 100 ? AMEN_CHEAP : o.towelPrice === 100 ? AMEN_FAIR : 0, `¥${o.towelPrice}`);
  else add('タオル', 0, 'なし');
  // シャンプー・ボディソープ（適正は¥100）
  const soap = (label, price) => {
    if (o.soapMode === 'free') add(label, AMEN_CHEAP, '無料');
    else if (o.soapMode === 'sell')
      add(label, price < 100 ? AMEN_CHEAP : price === 100 ? AMEN_FAIR : 0, `¥${price}`);
    else add(label, 0, 'なし');
  };
  soap('シャンプー', o.shampooPrice);
  soap('ボディソープ', o.bodysoapPrice);
  // 化粧水・乳液とドライヤーは、洗面所を置いてはじめて客が使える
  if (hasSink()) {
    add('化粧水・乳液', o.lotionOn === false ? 0 : AMEN_CHEAP, o.lotionOn === false ? '置いていない' : '無料');
    add('ドライヤー', o.dryerFee ? 0.5 : 1, o.dryerFee ? `¥${o.dryerFee}` : '無料', 1);
  } else {
    add('化粧水・乳液', 0, '洗面所がない');
    add('ドライヤー', 0, '洗面所がない', 1);
  }
  /* 手ぶらセット。タオルも石鹸も無料の店は、そもそも手ぶらで来られる＝満点扱い
     （無料にすると手ぶらセットが売れなくなる＝黙って2点損する、では筋が通らない） */
  if (o.towel === 'free' && o.soapMode === 'free') add('手ぶらセット', AMEN_CHEAP, '全部無料＝手ぶらで来られる');
  else if (o.tebura && o.towel !== 'free')
    add('手ぶらセット', o.teburaPrice < 400 ? AMEN_CHEAP : o.teburaPrice === 400 ? AMEN_FAIR : 0, `¥${o.teburaPrice}`);
  else add('手ぶらセット', 0, 'なし');
  return { list, total: list.reduce((a, b) => a + b.v, 0) };
}
/* コスパ部門の中身。**どの料金で測るかは章ごと**（CONF.cospaAxes）。
   第2章は子どもを受け入れず（banKids）サウナ料も取らない（noSaunaFee）ので、
   その2本を並べると**使っていない軸から自動で5点入る**＝
   入浴料の値付けがコスパ部門の3割しか動かせなくなっていた。
   使う軸だけを並べて、9点ぶんをその中で山分けする（残り1点は黒字経営）    */
function cospaParts() {
  const o = G.opts;
  const axes = CONF.cospaAxes || ['fee', 'kid', 'sauna'];
  const list = [];
  const fw = worthFee();
  if (axes.includes('fee'))
    list.push({ name: '入浴料', v: feeScore(o.fee, fw), note: `¥${o.fee}（適正 ¥${fw}）` });
  if (axes.includes('kid')) {
    const kw = kidFeeCap();
    const kf = o.kidFee || KID_FEES[0];
    list.push({ name: '子供料金', v: kf > kw ? 0 : kf === kw ? FEE_FAIR : FEE_CHEAP, note: `¥${kf}（適正 ¥${kw}）` });
  }
  if (axes.includes('sauna')) {
    // サウナがまだ無い店は、サウナ料で損も得もしない（サウナ自体の点で評価される）
    if (!hasCat('sauna')) list.push({ name: 'サウナ料金', v: FEE_FAIR, note: 'サウナがない' });
    else {
      const sw = worthSaunaFee();
      list.push({ name: 'サウナ料金', v: feeScore(o.saunaFee, sw), note: `¥${o.saunaFee}（適正 ¥${sw}）` });
    }
  }
  // 3本ある章（第1章）は ×1 ＝これまでと1点も変わらない
  const scale = 3 / Math.max(list.length, 1);
  for (const it of list) it.v = Math.round(it.v * scale * 10) / 10;
  return { list, total: list.reduce((a, b) => a + b.v, 0) };
}

/* ---- 導線＝設備の並び順（作者指定） ----
   浴室入口→洗い場→風呂→サウナ→水風呂→ととのいイス。
   となり合う工程の「いちばん近い設備どうしの距離」を測り、3マス以内なら+3、4マス以内なら+1。
   4本ぜんぶ近ければ12点ぶん取れるが上限10＝どこか1本が遠くても他で埋められる余地を残してある。
   距離は設備のふちどうしの歩数（となり合っていれば1マス）。 */
function equipRect(e) { const d = EQ[e.id]; return { x1: e.x, y1: e.y, x2: e.x + d.w - 1, y2: e.y + d.h - 1 }; }
function rectDist(a, b) {
  return Math.max(0, Math.max(a.x1 - b.x2, b.x1 - a.x2)) + Math.max(0, Math.max(a.y1 - b.y2, b.y1 - a.y2));
}
/* 生きている設備。`f` を足すと**その階のものだけ**（導線を浴室ごとに測るのに使う）。
   省けばこれまでどおり全部＝既存の呼び出しは1つも挙動が変わらない */
function liveOf(cat, f) {
  return G.equip.filter(e => EQ[e.id].cat === cat && !e.dead && e.cond > 0
    && (f == null || (e.f | 0) === (f | 0)));
}
// 脱衣所の備品（ロッカーは数えない・作者指定）。洗面所・体重計・扇風機・自販機・テレビなど
function datsuiGoods() {
  return G.equip.filter(e => EQ[e.id].room === 'datsui' && EQ[e.id].cat !== 'locker'
    && !e.dead && e.cond > 0);
}
/* そのカテゴリどうしで、いちばん近い組み合わせの距離（片方でも無ければ null＝測れない）。
   `f` を渡すと**その階の設備だけ**で測る。渡さなければ全部＝これまでどおり（第1章は区画が
   ひとつなので、渡しても渡さなくても同じ結果になる）                          */
function catDist(a, b, f) {
  const A = Array.isArray(a) ? a : liveOf(a, f).map(equipRect);
  const B = liveOf(b, f).map(equipRect);
  if (!A.length || !B.length) return null;
  let m = Infinity;
  for (const p of A) for (const q of B) m = Math.min(m, rectDist(p, q));
  return m;
}
/* 1つの浴室について4区間を測る。扉の座標は**その浴室のもの**を受け取る */
function dosenLegsOn(doorX, divideY, f) {
  // 浴室の入口＝脱衣所とのあいだのガラス引き戸（浴室側の1マス）
  const doorRect = [{ x1: doorX, y1: divideY - 1, x2: doorX, y2: divideY - 1 }];
  const legs = [
    { name: '入口 → 洗い場', d: catDist(doorRect, 'wash', f) },
    { name: '風呂 → サウナ', d: catDist('furo', 'sauna', f) },
    { name: 'サウナ → 水風呂', d: catDist('sauna', 'mizu', f) },
    { name: '水風呂 → イス', d: catDist('mizu', 'rest', f) },
  ];
  for (const l of legs) {
    // 4本すべて3マス以内で10点ちょうど。1本でも遠いと満点は取れない（作者指定でシビアに）
    l.v = l.d == null ? 0 : l.d <= 3 ? 2.5 : l.d <= 4 ? 1.2 : 0;
    l.note = l.d == null ? 'どちらかが無い' : `${l.d}マス`;
  }
  return { list: legs, total: legs.reduce((a, b) => a + b.v, 0) };
}
/* ---- 導線の採点（作者指定 8/9 に浴室ごとへ作り替え）--------------------
   ⚠ **浴室が複数ある章で、2つ壊れていた**（第2章で実測）。

   ①**点が「いま見ている階」で変わっていた。** 扉の座標に `CONF.doorX` /
     `CONF.divideY` を使っていたが、これは**表示中の区画**の値。第2章で1Fを
     表示していると `divideY = 0` になり、扉が y=−1 という無い場所に置かれる。
     同じ店・同じ配置で 1F表示中=6.2点／2F表示中=8.7点 になっていた。
   ②**階をまたいでいるのに「隣」と数えていた。** サウナ=2F・水風呂=3F の店で
     「サウナ → 水風呂 = 2マス」。男湯に水風呂が1つも無いのに高得点だった。

   章が `dosenFloors` を返せば、**浴室ごとに測って、いちばん悪い浴室を採る**
   （男湯7点・女湯3点なら3点＝片方だけ良くしても逃げられない）。
   **フックを持たない章＝第1章は、これまでとまったく同じ1回の計算がそのまま走る。** */
function dosenParts() {
  const rooms = chHook('dosenFloors');
  if (!rooms || !rooms.length) return dosenLegsOn(CONF.doorX, CONF.divideY);
  const each = rooms.map(r => Object.assign({ f: r.f, name: r.name },
    dosenLegsOn(r.doorX, r.divideY, r.f)));
  const worst = each.reduce((a, b) => (b.total < a.total ? b : a));
  return { list: worst.list, total: worst.total, rooms: each, worstName: worst.name };
}

/* ---- △・×の項目に出す「次にやること」（作者指定） ----
   REP_ITEMS の hint はただの説明文だった（「設備の台数と収容力を増やす」）。
   ここでは今の店の中身を読んで、あと何をいくつ足せばいいかを名指しで返す。
   1行に収める＝折り返すと読めない（作者指定）ので、言うことは1つだけ。 */
function repAdvice(key) {
  const t = G.today || {};
  const kinds = cat => new Set(liveOf(cat).map(e => e.id)).size;
  const upgrade = cat => {
    // まだ置いていないもののうち、いま置いてある一番いい台より質(q)が上で、いちばん安いもの
    const best = bestQ(cat);
    // 決戦仕様（◯◯スペシャル）は物語の内緒なので、ここでは勧めない（作者指定）
    /* まだ買えない設備を勧めない。**`(d.rep||0) <= G.rep` の直書きだった**（2026-08-08 修正）＝
       解放を8部門スコアに移した第2章で、ここだけ旧ゲートのまま残っていた。
       `unlockOk` はフックの無い章では同じ比較に落ちるので、第1章は不変 */
    const up = Object.entries(EQ).filter(([id, d]) => d.cat === cat && (d.q || 1) > best
      && unlockOk(id) && !d.old && id !== DUEL_ONLY_EQ).sort((a, b) => a[1].price - b[1].price)[0];
    return up ? `${up[1].name}に買い替えると伸びる` : '種類を増やすほうが早い';
  };
  switch (key) {
    case 'clean': {
      const d = dirtCounts();
      /* 階ごとに採点する章は、**どの階が汚いのかを名指しする**（作者指定 8/7）。
         「バイトはあと◯人」だけでは、いちばん効く手＝どの階に立たせるか、が伝わらない */
      if (CONF.dirtPerFloor) {
        const f = dirtiestFloor(t);
        if (f != null) {
          const a = (CONF.areas || [])[f] || {};
          const here = G.roster.filter(e => (e.f | 0) === f && e.f != null).length;
          const max = a.staffMax || 1;
          return here < max ? `${a.name}が汚れている。もう1人立たせる（いま${here}／${max}人）`
                            : `${a.name}が汚れている。${max}人では手が足りない`;
        }
      }
      // 営業中に汚れを拭けるのはバイトだけ（主人公は番台から動けない）
      if (d.thick) return G.roster.length ? `濃い汚れが${d.thick}つ。バイトが足りていない`
        : `濃い汚れが${d.thick}つ。拭けるのはバイトだけ`;
      if (d.thin >= CONF.dirtThinN) return `薄い汚れが${d.thin}つ。濃くなる前に拭く`;
      // 満点には観葉植物が要る（作者指定）＝床が綺麗なだけでは10点にならない
      if (!G.equip.some(e => plantIds().includes(e.id) && e.cond > 0 && usable(e))) return '観葉植物が無いと8点止まり';
      /* 掃除の人手が客数に足りていないと、点そのものが大きく削られる（バイト0なら1.5点どまり）。
         目安は客25人につき1人だが、**雇えるのは CONF.maxStaff 人まで**（作者指定 8/7）＝
         上限を超えた数を「あと◯人」と言わない。以前は客150人で「あと5人」と、
         雇いようのない人数を指示していた */
      const need = Math.min(Math.max(1, Math.ceil((t.paid || 0) / 25)), CONF.maxStaff);
      if (!G.roster.length) return 'バイトを雇わないと点が伸びない';
      if (G.roster.length < need) return `客${t.paid || 0}人なら、バイトはあと${need - G.roster.length}人`;
      // 上限まで雇っても手が足りない＝人ではなく「汚れの出方」を減らすしかない
      if (G.roster.length >= CONF.maxStaff && (t.paid || 0) > CONF.maxStaff * 25)
        return `バイトは上限の${CONF.maxStaff}人。あとは汚れの出る設備を減らすか、客を捌ける配置に`;
      return '汚れの無い日を7日続ければ満点';
    }
    case 'crowd': {
      if (t.turnedAway) return `満杯で${t.turnedAway}人帰した。ロッカー増設`;
      if (t.gaveUp) return `待ちきれず${t.gaveUp}人帰った。台数を増やす`;
      const g = t.gripes || {};
      if (g.crowd) return `「待たされた」が${g.crowd}件。台数を増やす`;
      const w = Math.round((t.waitSum || 0) / Math.max(t.paid || 0, 1));
      if (w >= 3) return `平均${w}分待たせている。もう1台置く`;
      const lc = lockerCapacity(), need = Math.round((t.paid || 0) * 0.35);
      if (lc < need) return `ロッカー${lc}人ぶん。あと${need - lc}人ぶん増やす`;
      return '設備の台数と収容力を増やす';
    }
    /* 設備の項目は「質・規模・幅」の3軸（作者指定）。足りていない軸を1つだけ名指しする＝
       いちばん点が伸びる一手を出す。※1行に収める（折り返すと読めない） */
    case 'sauna': {
      if (!hasCat('sauna')) return 'サウナがまだ1台もない。まず1台';
      const sc = scaleNote('sauna', Math.max(t.sauna || 0, Math.round((t.paid || 0) * 0.5)), 4);
      if (sc.r > sc.per) return `席${sc.cap}に対し${sc.want}人。もう1台で伸びる`;
      if (bestQ('sauna') < 4) return upgrade('sauna');
      return kinds('sauna') < 2 ? '温度のちがうサウナ2台目で伸びる' : 'ミストか塩サウナで幅が出る';
    }
    case 'furo': {
      if (!hasCat('furo')) return '浴槽がまだ1台もない';
      // どんな品揃えでも当てはまるように「種類を増やす」で統一（作者指定）。
      // あつ湯とぬる湯を両方持っている店に「揃えろ」と言ってしまっていた
      if (furoKindCount() < 3) return `お風呂の種類を増やすと伸びる（いま${furoKindCount()}種類）`;
      const sc = scaleNote('furo', t.paid || 0, 5);
      if (sc.r > sc.per) return `湯船が${sc.cap}人ぶん。客${sc.want}人には狭い`;
      return bestQ('furo') < 4 ? upgrade('furo') : '種類をもう1つ増やすと満点';
    }
    case 'mizu': {
      if (!hasCat('mizu')) return '水風呂がまだ1台もない';
      const sc = scaleNote('mizu', Math.max(t.sauna || 0, Math.round((t.paid || 0) * 0.5)), 12);
      if (sc.r > sc.per) return `水風呂が${sc.cap}人ぶん。もう1槽で伸びる`;
      if (kinds('mizu') < 2) return '水温のちがう水風呂2台目で伸びる';
      return bestQ('mizu') < 4 ? upgrade('mizu') : '水温の選択肢をもう1つ';
    }
    case 'datsui': {
      const n = datsuiGoods().length;
      const lc = lockerCapacity(), need = Math.round((t.paid || 0) * 0.35);
      if (lc < need) return `ロッカー${lc}人ぶん。客${t.paid || 0}人には足りない`;
      if (!hasToilet()) return 'トイレが1つもない。まず1つ置く';
      if (!hasSink()) return '洗面所を置くと大きく伸びる';
      if (!hasNewToilet()) return '古いボットン便所を洋式に替える';
      if (!hasGoodSink()) return '古い洗面台をちゃんとした洗面所に替える';
      if (n < 6) return `脱衣所の備品あと${6 - n}個で満点`;
      return hasRole('massage', 'massage') ? '脱衣所はもう十分' : 'マッサージチェアで満点に届く';
    }
    case 'rest': {
      const ch = liveOf('rest'), k = new Set(ch.map(e => e.id)).size;
      if (!ch.length) return 'ととのいイスがまだ1脚もない';
      if (bestQ('rest') < 3) return upgrade('rest');
      const sc = scaleNote('rest', Math.max(t.sauna || 0, Math.round((t.paid || 0) * 0.5)), 6);
      if (sc.r > sc.per) return `イス${ch.length}脚では足りない。増やす`;
      return k < 3 ? `種類あと${3 - k}つで満点` : 'ととのいスペースは十分';
    }
    case 'omote': {
      const aiso = G.roster.length ? G.roster.reduce((x, r) => x + (r.aiso || 3), 0) / G.roster.length : 0;
      if (!G.roster.length) return '愛想のいいバイトを雇うと上がる';
      if (aiso < 4) return `バイトの愛想が平均★${aiso.toFixed(1)}。★4を雇う`;
      return '客の満足度80点で満点に近づく';
    }
  }
  return '';
}

/* そのカテゴリでいちばん良い設備の質（q）。壊れている台は数えない */
function bestQ(cat) {
  let q = 0;
  for (const e of G.equip) {
    const d = EQ[e.id];
    if (d.cat !== cat || e.dead || e.cond <= 0) continue;
    q = Math.max(q, d.q || 1);
  }
  return q;
}
function capOf(cat) {
  return G.equip.filter(e => EQ[e.id].cat === cat && !e.dead && e.cond > 0)
    .reduce((n, e) => n + (EQ[e.id].cap || 0), 0);
}

/* ---- その日ぶんの10項目の採点（0〜10点） ----
   不満の声は「客1人あたり何回出たか」で見る＝客が増えたぶんだけ点が下がる、を防ぐ。
   設備そのものの点（サウナ・お風呂・水風呂・脱衣所）は日によって動かないが、
   買った翌日からしか平均に入らないので、7日かけてじわじわ効いてくる。 */
/* 規模＝その日の客数に対して、その設備が足りているか（作者指定）。
   「1台置けば◯点」の下駄を外し、席数が客数に追いついているかで測る＝
   評判が上がって客が増えるほど足りなくなり、次の投資が要る、という循環をつくる。
   per＝1席で1日に何人まで無理なく捌けるか（滞在時間の長い設備ほど小さい） */
/* per は「1席で1日に何人まで無理なく捌けるか」。**章ごとに差し替えられる**
   （第2章＝都市型サウナは風呂に浸かりに来る店ではないので、浴槽の per が大きい）。
   CONF.scalePer を持たない第1章は、呼び出し側の数字がそのまま効く */
function perOf(cat, per) { return ((CONF.scalePer || {})[cat]) || per; }
function scaleScore(cat, want, per0, max) {
  const per = perOf(cat, per0);
  const cap = liveOf(cat).reduce((a, e) => a + (EQ[e.id].cap || 0), 0);
  if (!cap) return 0;
  const r = want / cap;                                   // 1席あたりの人数
  return clamp((per * 2 - r) / per, 0, 1) * max;          // r<=per で満点、r>=per*2 で0点
}
// 収容の内訳（データ画面の▶に出す）
function scaleNote(cat, want, per0) {
  const per = perOf(cat, per0);          // 点数と同じ物差しで説明する（食い違うと読めない）
  const cap = liveOf(cat).reduce((a, e) => a + (EQ[e.id].cap || 0), 0);
  return { cap, want, r: cap ? want / cap : Infinity, per };
}
/* ============ 清潔度の物差し（作者決定 2026-08-07）============
   **章が `CONF.dirtPerFloor` を立てていれば、階ごとに点をつけて平均する。**

   汚れは「その階を使った客の数」ぶん出る。それを建物ぜんぶの合計ひとつで測っていたので、
   **階を建てるほど不利になっていた。** 実測（第2章・5階建て・客180人）：
     男湯 8.17／女湯 2.49／ラウンジ・食堂・受付 0　→ 合計 10.67 → **清潔度0点**
   合計だと「濃い汚れ2.7個で0点」の線を、7階建ては1階あたり0.4個で越えてしまう。
   雇える人（10人）を全部つぎ込んでも0点のままだった。

   階ごとに測れば、上の店は 6.2点。浴室に2人目を立てれば 7.5点まで戻る＝
   **人手が効くようになる**（いままでは何人雇っても0点だった）。
   採点するのは**客が使う設備が1つでもある階**だけ＝廊下や空の階で薄めない。
   フラグを持たない章（第1章）は、これまでどおり建物の合計をそのまま見る＝値は変わらない */
function dirtScoreOf(x) { return clamp(10 - x * 2.4 - x * x * 0.5, 0, 10); }
function cleanFloors() {
  const areas = areaList();
  if (!areas) return [];
  const out = [];
  areas.forEach((a, f) => {
    if (!a || a.home) return;
    if (!G.equip.some(e => (e.f | 0) === f && EQ[e.id] && (EQ[e.id].cap || 0) > 0 && e.cond > 0)) return;
    out.push(f);
  });
  return out;
}
/* その日、階ごとに床へ転がっていた濃い汚れの平均個数 */
function dirtAvgOn(t, f) {
  return t.dirtN ? (((t.dirtSumF && t.dirtSumF[f]) || 0) / t.dirtN) : 0;
}
function cleanDirtScore(t) {
  const whole = t.dirtN ? t.dirtSum / t.dirtN : dirtCounts().thick;
  if (!CONF.dirtPerFloor) return dirtScoreOf(whole);
  const fs = cleanFloors();
  if (!fs.length) return dirtScoreOf(whole);
  return fs.reduce((a, f) => a + dirtScoreOf(dirtAvgOn(t, f)), 0) / fs.length;
}
/* いちばん汚れている階（日報のひと言に名前を出す） */
function dirtiestFloor(t) {
  const fs = cleanFloors();
  if (!fs.length) return null;
  const f = fs.slice().sort((a, b) => dirtAvgOn(t, b) - dirtAvgOn(t, a))[0];
  return dirtAvgOn(t, f) > 0 ? f : null;
}
function repDayScores() {
  const t = G.today || {};
  const g = t.gripes || {};
  const paid = Math.max(t.paid || 0, 1);
  const rate = k => (g[k] || 0) / paid;
  const s = {};
  const wantSauna = Math.max(t.sauna || 0, Math.round(paid * 0.5));   // サウナに入りたかった人数

  /* ── 清潔度：その日の汚れ具合に「掃除の人手」を掛ける（作者指定でさらにシビアに）。
     人手は客25人につきバイト1人が目安。ひとりも雇っていない店は、その日たまたま床が綺麗でも
     15点満点中1.5点どまり＝「放っておけば10日で汚れだらけ、15日でゴキブリが出る」店として扱う。
     店主ひとりで拭いて回るのには限界がある、という当たり前を数字にした。
     さらに満点には観葉植物（緑がないと「気持ちのいい店」にはならない） */
  const dirtScore = cleanDirtScore(t);
  /* 客何人につきバイト1人か。**章ごとに違う**（第2章は7階建てなので60人に1人）。
     ここを25で直書きしていたので、300人の店は 12人 雇わないと頭打ちだった */
  const hands = clamp(G.roster.length / Math.max(paid / (CONF.cleanPerStaff || 25), 1), 0, 1);
  s.clean = dirtScore * (0.15 + 0.85 * hands);
  if (!G.equip.some(e => plantIds().includes(e.id) && e.cond > 0 && usable(e))) s.clean = Math.min(s.clean, 8);

  /* ── 混雑度：待たせなかったか6点＋ロッカーの余裕2点＋番台の捌け2点（作者指定）。
     客が少ない日は待ちが出ないので、以前はそれだけで満点だった＝
     受け入れる器（ロッカー）と、入口の捌けも見る */
  const crowdN = (g.crowd || 0) + (g.locker || 0) + (g.bandai || 0)
    + (t.turnedAway || 0) * 2 + (t.gaveUp || 0) * 2 + (t.queueMiss || 0);
  const waitPer = (t.waitSum || 0) / paid;
  // 待たせた分の減点を1.3倍にする（作者指定）
  s.crowd = clamp(6 - Math.max(crowdN / paid - 0.1, 0) / 0.17 - waitPer / 1.55, 0, 6)
    + clamp((lockerCapacity() / Math.max(paid * 0.35, 1)), 0, 1) * 2
    + clamp(1 - ((g.bandai || 0) + (t.turnedAway || 0) * 2) / paid * 5, 0, 1) * 2;

  /* ── コスパ：3本の料金で9点＋「それでも黒字」で1点（作者指定）。
     安くするだけなら誰でもできる＝安くしたうえで店が回っていることまで見る */
  const cp = cospaParts();
  const profitable = (G.recentProfits || []).length ? (G.recentProfits || []).slice(-5).every(v => v > 0) : false;
  s.cospa = clamp(cp.total + (profitable ? 1 : 0), 0, 10);

  // 湯の温度が合わない不満は、サウナ・風呂・水風呂で分け合う（同じ声を3回引かない）
  const tempPen = Math.min(rate('temp') * 4, 1.5);
  /* ── サウナ：質5＋規模3＋幅2（作者指定）。
     「1台あれば3点」の下駄をやめ、何を置いたか（質）と、客数に足りているか（規模）で決める */
  s.sauna = !hasCat('sauna') ? 0 : clamp(
    bestQ('sauna') + scaleScore('sauna', wantSauna, 4, 3)
    + Math.min(tempVariety('sauna') + (hasGentleSauna() ? 1 : 0), 2)
    + (nappaOn() ? 1.5 : 0) - tempPen, 0, 10);
  // ── お風呂：質4＋幅4（1種0/2種2/3種3/4種4）＋規模2
  s.furo = !hasCat('furo') ? 0 : clamp(
    bestQ('furo') * 0.8 + Math.min(furoKindCount() - 1, 4)
    + scaleScore('furo', paid, 5, 2) - tempPen, 0, 10);
  // ── 水風呂：質4＋幅3＋規模3
  s.mizu = !hasCat('mizu') ? 0 : clamp(
    bestQ('mizu') * 0.8 + Math.min(tempVariety('mizu'), 3)
    + scaleScore('mizu', wantSauna, 12, 3) - tempPen, 0, 10);

  /* ── 脱衣所：小物4点（6つで満点）＋高い備品3点（洗面所・マッサージチェア・自販機）
     ＋ロッカーの収容3点。1.5万のポスターを並べるだけでは満点にならない（作者指定） */
  const gd = datsuiGoods().length;
  // 古い洗面台は「あるだけまし」＝ちゃんとした洗面所の半分以下しか効かない（作者指定）
  const bigDatsui = (hasGoodSink() ? 1.2 : hasOldSink() ? 0.5 : 0) + (hasRole('massage', 'massage') ? 1 : 0)
    + vendIds().filter(hasWorking).length * 0.4;
  s.datsui = clamp(Math.min(gd, 6) / 6 * 4 + Math.min(bigDatsui, 3)
    + clamp(lockerCapacity() / Math.max(paid * 0.35, 1), 0, 1) * 3, 0, 10);

  /* ── ととのいスペース：質5＋脚数3＋種類2（作者指定）。
     3万のベンチを5脚並べるより、いいイスを置くほうが効く */
  const chairs = liveOf('rest');
  s.rest = !chairs.length ? 0 : clamp(
    bestQ('rest') * 1.25 + scaleScore('rest', wantSauna, 6, 3)
    + Math.min(new Set(chairs.map(e => e.id)).size - 1, 2), 0, 10);

  // ── 導線：4本すべて3マス以内で満点（1本でも遠いと満点は取れない・作者指定）
  s.dosen = clamp(dosenParts().total, 0, 10);

  /* ── おもてなし：満足度4＋バイトの愛想2＋番台で待たせない1＋アメニティ3（作者指定）。
     満足度の下駄を外した（35基準→50基準）＝ふつうに回しているだけでは点にならない。
     バイトがいない店は愛想の2点が丸ごと入らない */
  const avgSat = t.satN ? t.satSum / t.satN : 50;
  const aiso = G.roster.length ? G.roster.reduce((x, r) => x + (r.aiso || 3), 0) / G.roster.length : 0;
  s.omote = clamp(clamp((avgSat - 50) / 40, 0, 1) * 4 + clamp(aiso / 5, 0, 1) * 2
    + clamp(1 - ((g.bandai || 0) + (t.gaveUp || 0) * 2) / paid * 4, 0, 1)
    + amenityParts().total / AMEN_MAX * 3, 0, 10);

  return s;
}

/* ---- 【その他】直せばその場で消える減点（作者指定・即時反映） ---- */
function repPenalties() {
  const p = [];
  // k＝章ごとに拾い直すための目印（文言で照合すると、言い回しを直した日に静かに外れる）
  const add = (k, l, v, sub) => p.push({ k, l, v, sub });
  if (!G.opts.banYakuza)
    add('yakuza', '入墨・ヤクザが入店できる', 30,
      kitoAccepted() ? '鬼頭と交わした約束がある' : '運営メニューで「お断り」にすれば消える');
  const olds = G.equip.filter(e => EQ[e.id].old && !e.dead);
  if (olds.length) add('old', '親父の代からの古い設備', 10,
    olds.map(e => EQ[e.id].name).slice(0, 2).join('・') + (olds.length > 2 ? ` ほか${olds.length - 2}台` : ''));
  const broken = G.equip.filter(e => e.cond <= 0);
  if (broken.length) add('broken', '故障したまま放置している設備', 10, `${broken.length}台。修理すれば消える`);
  if (hasCat('sauna') && !hasMat()) add('mat', 'サウナマットがない', 5, '浴室に置き場を設置する（無料）');
  if (!hasAkasuri()) add('akasuri', '垢すりタオルがない', 5, '浴室に置き場を設置する（無料）');
  /* 「ドライヤー有料 −2」「アメニティが高い −10」はここから外した（作者指定）。
     高い＝一発で引かれる、ではなく、1品ごとの評価（amenityParts）が
     「おもてなし」の3点ぶんとして増減する形にしてある */
  /* 減点の顔ぶれは章で変わる（第2章は「強面の客」が正規の客層）。
     フックを持たない章（第1章）はそのまま返る＝いままでと同じ並び・同じ点 */
  return chHook('repPenalties', p) || p;
}

/* ---- 直近7日の平均。今日ぶんは客が入り始めてから混ぜる ---- */
function repItemAvgs() {
  const hist = Array.isArray(G.repHist) ? G.repHist : [];
  const all = (G.today && G.today.satN) ? hist.concat([repDayScores()]) : hist.slice();
  const use = all.length ? all : [repDayScores()];
  const out = {};
  for (const it of REP_ITEMS) out[it.key] = use.reduce((a, d) => a + (d[it.key] || 0), 0) / use.length;
  return { avgs: out, days: hist.length };
}
/* 画面に出す数字がそのまま足し算で合うように、項目は先に小数第1位へ丸めてから合計する */
function repScoreParts() {
  const { avgs, days } = repItemAvgs();
  const items = REP_ITEMS.map(it => ({ ...it, v: Math.round(avgs[it.key] * 10) / 10 }));
  const base = Math.round(items.reduce((a, b) => a + b.v, 0) * 10) / 10;
  const pens = repPenalties();
  const penSum = pens.reduce((a, b) => a + b.v, 0);
  const bonus = Math.round(G.repBonus || 0);
  return { items, base, pens, penSum, bonus, days, total: clamp(Math.round(base - penSum + bonus), 0, 100) };
}
function repCounting() { return G.day <= REP_WARMUP; }              // 集計中（8日目から数字が出る）
function repScore() { return repCounting() ? REP_START : repScoreParts().total; }
/* 評判は10項目＋減点から毎回そのまま計算し直す＝減点を直せばその場で数字が戻る */
function syncRep() { G.rep = repScore(); watchWorthFee(); }

/* 料金の目安（客が受け入れる上限）が動いたら、その場で知らせる（作者指定）。
   目安は評判とサウナの台数で段が変わる＝黙って上がると「値上げできる」ことに気付けないし、
   黙って下がると、いつのまにか「高すぎる店」になっている。段が動いた時だけ1回鳴らす */
function watchWorthFee() {
  if (G.phase === 'title') return;
  const f = worthFee(), s = hasCat('sauna') ? worthSaunaFee() : 0;
  if (G.lastWorthFee == null) { G.lastWorthFee = f; G.lastWorthSauna = s; return; }
  if (f !== G.lastWorthFee) {
    const up = f > G.lastWorthFee;
    toast(`${up ? '📈' : '📉'} 入浴料の目安が ¥${G.lastWorthFee} → ¥${f} に${up ? '上がった' : '下がった'}`);
    log(`${up ? '📈' : '📉'} 客が受け入れる入浴料の目安が ¥${f} に${up ? '上がった（値上げできる）' : '下がった（今の料金は高いかもしれない）'}`);
    G.lastWorthFee = f;
  }
  if (s !== G.lastWorthSauna) {
    if (G.lastWorthSauna) {
      const up = s > G.lastWorthSauna;
      toast(`${up ? '📈' : '📉'} サウナ料の目安が ¥${G.lastWorthSauna} → ¥${s} に${up ? '上がった' : '下がった'}`);
      log(`${up ? '📈' : '📉'} 客が受け入れるサウナ料の目安が ¥${s} に${up ? '上がった（値上げできる）' : '下がった'}`);
    }
    G.lastWorthSauna = s;
  }
}

/* 物語の出来事（要求を叶えた／勝負に負けた／支払いきれなかった）は、
   10項目とは別の“加点・減点”として持っておく。ここを持たないと、
   計算し直したときに出来事ぶんが毎回消えてしまう */
function addRep(d) { G.repBonus = clamp((G.repBonus || 0) + d, -40, 25); syncRep(); }

/* カタログの⭐の元になる、その設備1台ぶんの充実度（買い物の指針。数字そのものは出さない） */
function gradePts(id) {
  const d = EQ[id];
  if (d.pas) return d.pas.score || 2;
  if (id === 'matrack' || id === 'akarack') return 3;
  if (d.cap > 0) return (d.q || 1) * 2;
  return 0;
}

/* 【廃止】ミッションのクリア状況による評判の上限（30/40/55/70/100）。
   旧方式で「何もしなくても評判が上がる」のを無理やり押さえるための仕掛けだったが、
   天井＋速度方式では店の格そのものが天井になるので不要。むしろ
   「設備を入れたのに評判が動かない」という不可解な壁になっていたので撤廃した（作者指定）。
   ※ 旧方式の addRep（G.rep へ直接足す）もここに残っていて、上の repBonus 版を
     同名の後勝ちで隠していた＝直接足しても毎晩の syncRep で消える＝
     物語イベントの評判の増減が全部無効になっていた。残骸のほうを削除した（2026-08-09）。 */

/* その種類の湯温が何段階に分かれているか（1種類だけ=0／熱いのとぬるいの=1…）。
   90℃派と110℃派、キンキン派とぬるめ派の両方に応えられているかの指標。
   ※浴槽は湯温を弄れない＝“温度の幅”ではなく“風呂の種類”で数える（furoKinds） */
function tempVariety(cat) {
  const temps = G.equip.filter(e => EQ[e.id].cat === cat && e.cond > 0 && EQ[e.id].cap > 0 && !EQ[e.id].gentle)
    .map(e => e.temp ?? EQ[e.id].temp);
  if (temps.length < 2) return 0;
  const span = Math.max(...temps) - Math.min(...temps);
  const step = cat === 'sauna' ? 8 : 3;                          // この差があれば「別の選択肢」とみなす
  return Math.min(Math.floor(span / step), 3);
}
// ミスト・塩など“低温の別ジャンル”のサウナが動いているか（tempVarietyの集計からは外れているので別枠で見る）
function hasGentleSauna() {
  return G.equip.some(e => EQ[e.id].cat === 'sauna' && e.cond > 0 && EQ[e.id].cap > 0 && EQ[e.id].gentle);
}
/* 使える風呂が何種類あるか（同じ設備を2台置いても1種類）。1種類=0／2種類=1…最大3。
   客は「湯温をいじれ」ではなく「風呂の種類を増やせ」と言ってくるので、充実度もこれで測る */
function furoKinds() { return Math.min(Math.max(furoKindCount() - 1, 0), 3); }
// いま入れる風呂の一覧（故障中は数えない）と、その種類数・湯温（℃）
function furoUsable() { return G.equip.filter(e => EQ[e.id].cat === 'furo' && e.cond > 0 && EQ[e.id].cap > 0); }
function furoKindCount() { return new Set(furoUsable().map(e => e.id)).size; }
/* データ画面の「品揃え」表示（作者指定）。同じ設備を何台置いても1種類。
   1種類=△／2種類=○／3種類以上=◎。まだ無ければ「なし」 */
function kindCount(cat) {
  return new Set(G.equip.filter(e => EQ[e.id].cat === cat && e.cond > 0 && EQ[e.id].cap > 0).map(e => e.id)).size;
}
function kindMark(cat) {
  const n = kindCount(cat);
  return n ? `${n}種類 ${n >= 3 ? '◎' : n === 2 ? '○' : '△'}` : 'なし';
}
function furoTemps() { return furoUsable().map(e => EQ[e.id].temp); }
/* ととのい率。サウナ→水風呂→休憩の順を踏んだ客が実際に「ととのう」確率。
   設備が充実して清潔なほど上がる＝評判の伸びに直結する */
function totonoiChance() {
  const clean = clamp(1 - dirtCounts().thick / 6, 0.25, 1);   // 濃い汚れだけが響く（薄いうちはセーフ・作者指定）
  return clamp(0.3 + facilityScore() / 90, 0.3, 0.95) * clean;
}
// 客が受け入れられる入浴料の水準。設備の数ではなく「街での評判」で決まる（作者指定）。
// 評判50まで¥600／60まで¥700／80まで¥800／90まで¥900／それ以上¥1,000。名の知れた湯だけが高くても許される
/* 客が「まあこれなら」と思う入館料。評判が上がるほど高く取れる。
   金額の帯は章ごとに違う（第1章＝路地裏の銭湯 ¥600〜¥1,000／
   第2章＝国道沿いのサウナ施設 ¥900〜¥2,500）ので、表は CONF に置く。
   第1章は CONF.worthFee を持たないので、これまでどおりの数字が出る          */
function worthFee() {
  const r = G.rep;
  /* **評判いくらにつき¥いくら**、という決め方を持つ章はそちらが正（第2章＝評判×¥30）。
     評判が10上がるごとに1段（＝¥300）上がる階段にしてある＝
     「上がった」が数字で分かるが、1点ごとにチャラチャラ動かない。
     第1章は段の表（CONF.worthFee）を持っているので、これまでどおり表から引く */
  const per = CONF.worthFeePerRep;
  if (per) {
    const step = CONF.worthFeeStep || 10;
    const v = Math.floor(r / step) * step * per;
    return clamp(Math.round(v), CONF.worthFeeMin || 0, FEE_CEIL);
  }
  const tbl = CONF.worthFee || [[50, 600], [60, 700], [80, 800], [90, 900]];
  for (const [upTo, yenv] of tbl) if (r <= upTo) return yenv;
  return FEE_CEIL;
}
/* ============ 料金の物差し（作者決定 2026-08-05）============
   「¥100ちがう」の重みは、章の値段の幅で変わる。
   第1章は¥600〜¥800（上限¥1,000）＝幅¥400なので、¥100は大きな一歩。
   第2章は¥700〜¥3,000＝**幅が7.7倍**なので、同じ¥100きざみで殴ると、
   目安どおりの値付け（評判90で¥2,700）が満足度−42・集客−28人になっていた＝
   **目安がいくつでも「安いほど良い」が勝つ**状態だった。

   ・`feeVsWorth` を持つ章（第2章）は、**基準を目安（worthFee）そのものに置く**＝
     目安どおりなら±0、安くすれば喜ばれ、超えれば痛い。画面が言っているとおりの意味になる
   ・きざみも**目安の1割**にする（¥2,700なら¥270が1目盛）
   ・第1章はフラグを持たないので、基準は FEE_BASE、きざみは¥100のまま        */
function feeUnit(fair) {
  if (!CONF.feeVsWorth) return 100;
  return Math.max(50, Math.round((fair != null ? fair : worthFee()) * 0.1));
}
function feeBaseFor() { return CONF.feeVsWorth ? worthFee() : FEE_BASE; }
// 料金への不満の強さ。0=不満なし。充実度が上がるほど小さくなる
function feeGripe() { return Math.max(0, (G.opts.fee - worthFee()) / feeUnit()); }
// 客が受け入れられるサウナ料。サウナ1つで¥300、1つ増えるごとに＋¥100（作者指定）
function worthSaunaFee() {
  const n = G.equip.filter(e => EQ[e.id].cat === 'sauna').length;
  return n > 0 ? 300 + (n - 1) * 100 : 300;
}
function saunaFeeGripe() {
  if (!hasCat('sauna') || !G.opts.saunaFee) return 0;
  return Math.max(0, (G.opts.saunaFee - worthSaunaFee()) / 100);
}
function feeSatMod() {
  // フェーズ2：目安超過の痛みを2倍に強化（1目盛の超過あたり-2→-4）
  return Math.round((feeBaseFor() - G.opts.fee) / feeUnit() * 3) - Math.round(feeGripe() * 4 + saunaFeeGripe() * 2);
}

/* ヒントの吹き出し1件が、実際にどれくらい満足度を削っているか（日報の並び順に使う）。
   料金は feeSatMod、汚れは dirtThinHit、ないものねだりは-3が毎回の客に効いている */
const HINT_WEIGHT = { price: 6, dirty: 8, lack: 3 };
/* 不満の吹き出しを「客の不満」欄のどの項目として数えるか */
const GRIPE_OF_HINT = {
  hintFee: 'price', hintSaunaFee: 'price', priceyTebura: 'price', teburaPricey: 'price',
  priceyShampoo: 'price', priceyBodysoap: 'price', priceyTowel: 'price', hintSoapPricey: 'price',
  hintDirty: 'dirty', hintStaff: 'dirty',
};

/* 運営メニューで直せる不満のうち、今いちばん的を射ているものを選ぶ */
function pickHintKey() {
  const cands = [];
  const g = feeGripe();
  if (g > 0.2) cands.push(['hintFee', 2 + g * 2]);
  if (saunaFeeGripe() > 0.2) cands.push(['hintSaunaFee', 2]);
  // 手ぶらセットがあれば「手ぶらで来たい」は解決済み。ただし高すぎると別の不満になる
  const teburaOK = G.opts.tebura && G.opts.towel !== 'free';
  // 「いちばん高い設定」にすると、値段そのものへの文句になる（作者指定）
  if (teburaOK && G.opts.teburaPrice >= TEBURA_PRICES[TEBURA_PRICES.length - 1]) cands.push(['priceyTebura', 2.0]);
  else if (teburaOK && G.opts.teburaPrice >= 500) cands.push(['teburaPricey', 1.2]);
  else if (G.opts.towel !== 'free' && !teburaOK) cands.push(['hintTowel', 1.2]);
  if (!teburaOK) {
    if (G.opts.soapMode === 'none') cands.push(['hintSoap', 1.2]);
    else if (G.opts.soapMode === 'sell') {
      const top = AMENITY_PRICES[AMENITY_PRICES.length - 1];
      if (G.opts.shampooPrice >= top) cands.push(['priceyShampoo', 2.0]);
      if (G.opts.bodysoapPrice >= top) cands.push(['priceyBodysoap', 2.0]);
      if (Math.max(G.opts.shampooPrice, G.opts.bodysoapPrice) >= 150
        && G.opts.shampooPrice < top && G.opts.bodysoapPrice < top) cands.push(['hintSoapPricey', 1.0]);
    }
  }
  // タオルも、いちばん高い値付けなら文句になる（有料貸出のときだけ）
  if (G.opts.towel === 'paid' && G.opts.towelPrice >= AMENITY_PRICES[AMENITY_PRICES.length - 1])
    cands.push(['priceyTowel', 2.0]);
  if (!hasAkasuri()) cands.push(['hintAkasuri', 0.9]);
  if (hasCat('sauna') && !hasMat()) cands.push(['hintMat', 1.1]);
  // 設備そのものが足りない不満（買えば直る）
  // 洗面所がない＝ドライヤーも化粧水もない。不満のセリフは髪と肌の2種類から選ぶ
  if (!hasSink()) cands.push([Math.random() < 0.65 ? 'hintDryer' : 'hintLotion', 1.6]);
  if (hasCat('sauna') && !hasRole('cooler', 'cooler')) cands.push(['hintCooler', 2.0]);
  if (!hasCat('rest')) cands.push(['hintRest', 1.6]);
  /* 脱衣所の備品が無い（作者指定）。「牛乳ないの？」のように名指しで言わせる＝
     何を置けばいいのかが、そのままカタログへの案内になる */
  /* トイレ（作者指定）。1つも無いのはいちばん基本的な欠落なので、いちばん強く言わせる。
     ボットンしか無い店は、使った客がその場で文句を言う（usingPas）ので、ここでは弱めでいい */
  if (!hasToilet()) cands.push(['hintToilet', 2.6]);
  else if (!hasNewToilet()) cands.push(['toiletOld', 0.8]);
  /* ⚠ **カタログに1つも無い物を欲しがらせない**（roleBuildable）。
     第2章には扇風機も体重計もテレビも無いので、直書きのままだと
     「扇風機ないのか…」が100日間ずっと出続ける＝直しようのない不満になっていた */
  const vends = vendIds();
  if (!hasWorking(vends[0])) cands.push(['hintMilk', 1.5]);
  if (roleBuildable('fan', 'fan_bath') && !hasRole('fan', 'fan_bath')) cands.push(['hintFan', 1.1]);
  if (roleBuildable('scale', 'scale') && !hasRole('scale', 'scale')) cands.push(['hintScale', 0.7]);
  if (roleBuildable('tv', 'tv') && !hasRole('tv', 'tv')) cands.push(['hintTv', 0.7]);
  if (vends[1] && hasWorking(vends[0]) && !hasWorking(vends[1])) cands.push(['hintDrink', 0.8]);
  if (!hasRole('massage', 'massage')) cands.push(['hintMassage', 0.6]);
  // 品揃え＝好みの違う客を取りこぼしている。風呂は「種類」、サウナ・水風呂は「温度の幅」で見る
  const ft = furoTemps();
  if (ft.length) {
    if (furoKinds() === 0) cands.push(['hintFuroKind', 1.6]);                       // 風呂が1種類しかない
    // 種類はあっても全部あつ湯／全部ぬる湯なら、足りない方の湯を欲しがる
    else if (!(ft.some(v => v >= 41) && ft.some(v => v <= 40)))
      cands.push([Math.max(...ft) >= 41 ? 'hintNuruFuro' : 'hintAtsuFuro', 1.4]);
  }
  // サウナの品揃え＝「熱い方の幅」と「低温の別ジャンル(ミスト・塩)があるか」は別軸。
  // 片方しか見ないと、ミストを置いても「低温が欲しい」と言われる矛盾が起きる
  if (hasCat('sauna')) {
    // 高温(100℃以上)のドライサウナが1台でも動いていれば「高温が欲しい」とは言わない
    // （フェーズ3：温度の“幅”で見ていたせいで、110℃の1台持ちでも高温を欲しがるバグがあった）
    const hotMax = Math.max(0, ...G.equip.filter(e => EQ[e.id].cat === 'sauna' && e.cond > 0 && EQ[e.id].cap > 0 && !EQ[e.id].gentle)
      .map(e => e.temp ?? EQ[e.id].temp));
    if (hotMax < 100) cands.push(['hintSaunaHot', 1.4]);
    // フェーズ3：「低温が欲しい」は廃止（低温・マイルド好きの客ごと排除）。ミスト・塩は客の“ないものねだり”セリフで伝える
  }
  if (hasCat('mizu') && tempVariety('mizu') === 0) cands.push(['hintMizuVar', 1.2]);
  const brokenN = G.equip.filter(e => (CONF.wearPerDay[EQ[e.id].cat] ?? 0) > 0 && e.cond <= 0).length;
  if (G.dirts.length >= 3 + G.roster.length * 2 || brokenN >= 2) cands.push(['hintStaff', 2.5]);
  else if (G.dirts.length >= 2) cands.push(['hintDirty', 1.2]);
  if (!cands.length) return null;
  const sum = cands.reduce((a, b) => a + b[1], 0);
  let r = Math.random() * sum;
  for (const [k, w] of cands) { r -= w; if (r <= 0) return k; }
  return cands[0][0];
}

function customerLeave(c) {
  c.sat += c.type.tolerant;
  // フェーズ2：汚れは「触れた設備の近く」だけでなく、目に入るだけでも印象を下げる（設備接触分の減点とは別枠）
  c.sat -= Math.min(G.dirts.length * 0.8, 10);
  // 混雑＝ロッカーが埋まれば次の客はそもそも入店できないので、店全体の人数では二重に絞らない。
  // 「混んでて入れなかった」は浴室内の設備待ち（waitEquip）の話＝そちらで扱う
  const plants = G.equip.filter(e => plantIds().includes(e.id)).length;
  c.sat += Math.min(plants * 1.5, 6);
  /* 導線（作者指定）。1回の来店で歩かされたマス数で判定する。
     設備をばらばらに置くと、客はそのぶん館内を歩かされる＝それが不満として返ってくる。
     ロッカー→洗い場→湯→サウナ→水風呂→イスが近くにまとまっているほど良い。
     玄人のサウナ客は導線にうるさく、基準が厳しい */
  const tiles = (c.walkPx || 0) / T;
  const pro = c.wantsSauna && (c.type.likesSauna || 0) >= 0.9;
  const lim = pro ? CONF.dosenProTiles : CONF.dosenTiles;
  if (tiles > lim) {
    // 基準をどれだけ超えたかで痛みが増す（最大2倍まで）
    c.sat -= Math.round(CONF.dosenHit * Math.min(tiles / lim, 2));
    gripe('dosen');
    /* 台詞は章に選ばせる（作者報告 8/8）。この判定は**歩いた総マス数**であって
       サウナと水風呂の距離ではないので、「サウナ→水風呂が遠すぎ」と決め打ちすると、
       隣に並べてある店で言われて嘘になる。第1章はフックが無い＝これまでどおり */
    const lines = chHook('dosenLines', c, pro) || (pro ? LINES.dosenPro : LINES.dosen);
    if (!c.bub) hintBubble(c, pick(lines));
    voice(c, pick(lines), 'dosen',
          Math.round(CONF.dosenHit * Math.min(tiles / lim, 2)), '⚠');
  }
  /* トイレが1つも無い（作者指定）。用を足せない銭湯は、それだけで話にならない＝
     一律で効く減点にしてある（ボットンでも、あるだけましという扱い） */
  if (!hasToilet()) { c.sat -= 5; gripe('lack'); }
  // フェーズ3：ないものねだり（ミスト・塩・熱波師）。帰り際に「あれが無かったな…」とがっかりする
  if (c.wantsMist && !hasRole('mist', 'sauna_mist')) { c.sat -= 3; gripe('lack'); if (!c.bub && Math.random() < .5) bubble(c, pick(LINES.wantMist)); }
  if (c.wantsShio && !hasRole('shio', 'sauna_shio')) { c.sat -= 3; gripe('lack'); if (!c.bub && Math.random() < .5) bubble(c, pick(LINES.wantShio)); }
  if (c.wantsSauna && c.wantsNappa && !nappaOn()) { c.sat -= 2; gripe('lack'); if (!c.bub && Math.random() < .5) bubble(c, pick(LINES.wantNappa)); }
  // フェーズ3：バイトの愛想。感じのいい接客は帰り際の印象に少し乗る（店にいる中でいちばん愛想のいい子基準・最大+2）
  const present = G.staff.filter(s => workerHere(s) && s.emp);
  if (present.length) c.sat += Math.min(Math.max(...present.map(s => s.emp.aiso)) * 0.5 - 0.5, 2);
  // 置くだけで効く設備（脱衣所の洗面所・体重計・テレビ・ポスター／扇風機・冷水機…）
  // 客のタイプによって刺さるものが違う＝爺さんはポスターと将棋、若いのはテレビと化粧水
  let pasSum = 0, pasLine = null;
  for (const id of passiveEquips()) {
    const pa = EQ[id].pas;
    let v = pa.sat || 0;
    if (pa.likes && pa.likes.includes(c.typeKey)) { v += pa.like || 2; if (!pasLine) pasLine = id; }
    pasSum += v;
  }
  c.sat += Math.min(pasSum, 20);          // 盛りすぎても頭打ち
  // 洗面所にあるドライヤーと化粧水は、それぞれ「無料か、いくら取るか」で反応が変わる
  if (hasSink()) {
    if (!G.opts.dryerFee) c.sat += 2;
    else if (Math.random() < 0.65) { const p = G.opts.dryerFee; G.cash += p; G.today.amenRev += p; G.today.amenN++; G.today.revenue += p; }
    // 化粧水・乳液は「置く／置かない」だけ（作者指定で販売は廃止）。置いてあれば喜ぶ
    if (G.opts.lotionOn !== false) c.sat += 2;
  }
  // ※マッサージチェアの¥100は「実際に座った時」に入る（customerLeaveでの一律抽選は廃止）
  // お気に入りの設備があった客は、たまにそれを口にする
  if (!c.bub && pasLine && Math.random() < 0.22) {
    const key = { poster:'posterGood', shogi:'shogiGood', scale:'scaleGood', tv:'tvGood',
                  massage:'massageGood', sink:'lotionGood', sink_old:'lotionGood', fan_bath:'fanGood' }[pasLine];
    if (key && LINES[key]) bubble(c, pick(LINES[key]));
  }
  if (!c.bub && hasSink() && Math.random() < 0.12) bubble(c, pick(G.opts.dryerFee ? LINES.dryerPaid : LINES.dryerFree));
  if (!c.bub && hasRole('cooler', 'cooler') && Math.random() < 0.10) bubble(c, pick(LINES.coolerGood));
  // フェーズ4：上位志向の客（10%）＝どんな店でも「上には上がある」と少し不満げに帰る。
  // 満足の天井が常に下がる＝評判の伸びが構造的に鈍る（作者指定）
  if (c.snob) {
    c.sat -= 6;
    if (!c.bub && Math.random() < 0.35) {
      const line = pick(LINES.snobWant);
      bubble(c, line);
      voice(c, line, 'snob', 6, '💎');
    }
  }
  // 運営メニューの影響
  c.sat += feeSatMod();
  if (G.opts.towel === 'free') c.sat += 2;
  if (G.opts.soapMode === 'free') c.sat += 2;
  // たまに本音がこぼれる。運営メニューで直せる不満は赤枠＝改善のサインなので、
  // 他の吹き出しが出ていても上書きして必ず見せる
  let hinted = false;
  if (Math.random() < 0.18) {
    const key = pickHintKey();
    if (key) {
      gripe(GRIPE_OF_HINT[key] || 'lack');
      const line = pick(LINES[key]);
      hintBubble(c, line);
      hinted = true;
      const gk = GRIPE_OF_HINT[key] || 'lack';
      voice(c, line, gk, HINT_WEIGHT[gk] || 4, '⚠');
    }
  }
  if (!hinted && !c.bub) {
    const r = Math.random();
    if (r < 0.15) {
      if (G.opts.fee <= FEE_OPTIONS[0]) bubble(c, pick(LINES.feeCheap));
      else if (G.opts.towel === 'free') bubble(c, pick(LINES.towelFree));
      else if (G.opts.towel === 'paid' && G.opts.towelPrice >= 150) bubble(c, pick(LINES.towelPricey));
    }
  }
  /* **客層ごとの「求めるもの」**（第2章・chHook で章を跨がない）。
     老人は電気風呂、OLは女性スタッフ…と、層ごとに加減点する。
     ここを通さない章では satisfaction の式は一切変わらない            */
  const want = hasHook('segWant') ? (chHook('segWant', c) || 0) : 0;
  if (want) c.sat += want;
  c.sat = clamp(c.sat, 0, 100);
  G.today.satSum += c.sat; G.today.satN++;
  addSegSat(c);
  /* 行きつけになるか、足が遠のくか。
     気持ちよく帰った新規の一部が常連に変わり、がっかりした常連はそのぶん離れる＝
     「客をどれだけ集めたか」より「集めた客をどれだけ満足させたか」が効いてくる */
  /* **その層の常連が増えたか、減ったか**も同時に控える（第2章）。
     G.regulars は店全体でひとつの数字なので、「老人には支持されているが
     女子大生には見放されている」が表せない。章が受け口を持っていれば、
     同じ出来事を層ごとにも数えておく＝来店する客層の比率がそこから決まる。
     フックを持たない章（第1章）では何も起きない                       */
  if (c.isNew) {
    if (c.sat >= CONF.regularSatKeep && Math.random() < CONF.regularConvert) {
      G.regulars = clamp(G.regulars + 1, 0, CONF.regularMax); G.today.regularsUp++;
      chHook('segFan', c, 1);
    }
  } else if (c.sat < CONF.regularSatLose) {
    G.regulars = clamp(G.regulars - 1, 0, CONF.regularMax); G.today.regularsDown++;
    chHook('segFan', c, -1);
  }
  // 帰り際の一言。ヒントの吹き出しが出ている時は上書きしない（赤枠を消さない）
  if (c.sat >= 70) { if (!c.bub) bubble(c, pick(LINES.leaveGood)); voice(c, pick(LINES.leaveGood), 'leaveGood', 0); }
  else if (c.sat < 45) {
    const bad = pick(LINES.leaveBad);
    if (!c.bub) bubble(c, bad);
    logGripe(c.type.name, bad, 'leaveBad');                              // 不満顔で帰った客は赤文字で知らせる
    voice(c, bad, 'leaveBad', Math.round(50 - c.sat), '⚠');
  }
  c.state = 'toExit';
  walkToExit(c);
}

/* 強面・刺青の客が浴室に入っている（脱衣を済ませて中にいる）か */
/* **客のIDではなく `tattoo` で見る**（第2章対応 8/5）。
   'yakuza' と名指ししていたので、章が変わって客の名前が変わると静かに効かなくなる。
   第1章で tattoo を持っているのは強面の親分ただひとり＝挙動は変わらない */
function tattooPresent() {
  return G.customers.some(o => o.type && o.type.tattoo && o.mode === 'towel');
}
/* 子どもが浴室にいるか。「刺青・ヤクザお断り」にすると家族連れが増える＝
   そのぶん、静かに浸かりたい客からは不満も出る（作者指定＝どちらを取るかの選択） */
function kidPresent() {
  return G.customers.some(o => o.isChild && o.mode === 'towel');
}

function updateCustomer(c, dt) {
  /* 強面・刺青の客が中にいると、居合わせた一般客が怖がって満足度を落とす
     （運営メニューの「お断り」で避けられる）。
     **どれだけ堪えるかは章が決められる**（第2章＝子連れがいちばん堪える。作者決定 8/5）。
     子どもの声（下の kidGripe）と同じ形＝**どちらを取るかの選択**が、両側から効く */
  if (!c.sawYakuza && !(c.type && c.type.tattoo) && c.mode === 'towel' && tattooPresent()) {
    const yh = chHook('yakuzaGripe', c);
    const hit = yh !== undefined ? yh : 12;                  // フェーズ2で-7→-12に強化
    if (hit > 0) {
      c.sawYakuza = true; c.sat = clamp(c.sat - hit, 0, 100);
      if (!c.bub) hintBubble(c, pick(LINES.yakuzaGripe));
    }
  }
  /* 子ども連れが騒がしくて落ち着かない客（親子連れ本人と、寛容な客は言わない）。
     **連れて来た親を外すのは `withKid` を持っているかで見る**（`kidOf`）＝
     'oyako' と名指ししていたので、第2章の「子連れの母」が自分の子に文句を言っていた。
     どれだけ堪えるかは章が決められる（第2章＝老人がいちばん堪える） */
  if (!c.sawKid && !c.isChild && !kidOf(c.typeKey) && c.mode === 'towel' && kidPresent()) {
    const hook = chHook('kidGripe', c);
    const hit = hook !== undefined ? hook : ((c.type.tolerant || 0) < 6 ? 8 : 0);
    if (hit > 0) {
      c.sawKid = true; c.sat = clamp(c.sat - hit, 0, 100);
      if (!c.bub) bubble(c, pick(LINES.kidGripe), 3.0);
    }
  }
  // 子どもは湯でも脱衣所でもよく喋る（にぎやかさの演出）
  if (c.isChild && !c.bub && Math.random() < dt * 0.12) bubble(c, pick(kidLinePool(c)), 2.4);
  /* 滞在時間の制限。時間が来た客に印を付けるだけ＝実際に伝えに行くのは人間の仕事で、
     バイト（いなければ主人公）がそこまで歩いて行く。その間、掃除も会計も止まる（作者指定） */
  if (G.opts.timeLimit && c.inAt != null && !c.told && !c.timeUp && c.mode === 'towel'
      && (c.plan.length || c.state === 'using' || c.state === 'waitEquip')
      && G.minutes - c.inAt >= G.opts.timeLimit) c.timeUp = true;
  switch (c.state) {
    // 第2章：区画のあいだを移動している最中（通路まで歩いて、隣の区画へ移る）
    case 'ch2Transit': chHook('stepTransit', c, dt); break;
    // 移った先で、あらためて次の予定を選び直す
    case 'plan': nextPlan(c); break;
    case 'turnAway':
      if (stepMove(c, dt)) {
        c.timer -= dt;
        if (c.timer < 1 && !c.bub) bubble(c, pick(LINES.full));
        if (c.timer <= 0) { walkToExit(c); c.state = 'turnAwayExit'; }
      }
      break;
    case 'turnAwayExit':
      if (stepMove(c, dt)) { removeCustomer(c); G.today.turnedAway++; gripe('locker'); }
      break;
    case 'toPay':
      if (stepMove(c, dt)) c.state = 'pay';
      break;
    case 'pay': {
      // 前が空いたら詰める
      const idx = G.payQueue.indexOf(c);
      const spots = queueSpots();
      const want = spots[Math.min(idx, spots.length - 1)];
      const t0 = tileOf(c);
      if (want && (t0.x !== want.x || t0.y !== want.y)) { sendToQueueSpot(c); c.state = 'toPay'; break; }
      c.waitT += dt;
      /* 章が「客の我慢」を持っていれば、そのぶん粘る（第2章＝山下公園で大道芸を見た週）。
         フックを持たない章は 1.0 が返る＝これまでどおり45分で帰る */
      const pat = chHook('waitPatience') || 1;
      c.sat -= dt * 0.12 / pat;
      if (c.waitT > 25 * pat && !c.bub && Math.random() < .02) bubble(c, pick(LINES.crowded));
      // 待ちくたびれて帰る＝取り逃がし。受付が追いつかないと外の行列がそのまま損になる
      if (c.waitT > 45 * pat) {
        bubble(c, pick(LINES.giveUp), 2.6);
        const qi = G.payQueue.indexOf(c); if (qi >= 0) G.payQueue.splice(qi, 1);
        G.today.gaveUp++; gripe('bandai');
        log(`💸 ${c.type.name}が待ちきれず帰ってしまった`);
        c.state = 'leaveQueue';
        c.path = c.outside ? [{ x: CONF.W - 1, y: CONF.H - 1 }]
                           : (findPath(t0.x, t0.y, CONF.entrance.x, CONF.entrance.y) || [])
                               .concat([{ x: CONF.W - 1, y: CONF.H - 1 }]);
        for (const c2 of G.payQueue) if (c2.state === 'pay') { sendToQueueSpot(c2); c2.state = 'toPay'; }
      }
      // 支払い処理は updatePlayer 側
      break;
    }
    case 'leaveQueue':
      if (stepMove(c, dt)) removeCustomer(c);
      break;
    case 'toLocker':
      // goLocker で state が変わるためここは通らない
      break;
    case 'lockerIn':
      if (stepMove(c, dt)) {
        // ロッカーがパンパンなら荷物を置けない。空くまで脱衣所で立ち往生する
        if (!c.hasLocker && lockersFull()) {
          c.state = 'waitLocker'; c.waitNag = 99; break;
        }
        c.timer -= dt;
        if (c.timer <= 0) {
          c.hasLocker = true;
          c.mode = 'towel';
          c.plan = buildPlan(c);
          if (c.noSauna) { c.sat -= 12; bubble(c, pick(LINES.noSauna), 3); }
          if (!c.plan.length) { c.sat -= 20; bubble(c, pick(LINES.broken)); }
          c.state = 'plan';
        }
      }
      break;
    // ロッカー待ち。他の客が着替えて出ていくまで、脱衣所で突っ立ったまま不満をためる
    case 'waitLocker':
      stepMove(c, dt);
      c.waitT += dt;
      G.today.waitSum += dt;                 // 待たされた時間は、声にならなくても混雑度に効く（作者指摘）
      c.sat -= dt * 0.2;
      c.waitNag += dt;
      // 他の吹き出しが出ている間は流さず、消えたらすぐ不満を言わせる
      // ロッカー待ちは「ロッカーを増やせ」で直る＝改善のヒント（赤枠）にする
      if (c.waitNag > 20 && !c.bub) { c.waitNag = 0; hintBubble(c, pick(LINES.lockerWait)); }
      if (!lockersFull()) { c.state = 'lockerIn'; c.timer = 1.2; c.waitNag = 0; }
      else if (c.waitT > 70) {                    // しびれを切らして帰る＝ロッカー不足の代償
        c.sat -= 25;
        gripe('locker');
        bubble(c, pick(LINES.lockerGiveUp), 3);
        log(`💸 ${c.type.name}がロッカーの空き待ちで帰ってしまった`);
        G.today.gaveUp++;
        customerLeave(c);
      }
      break;
    case 'plan':
      nextPlan(c);
      break;
    case 'waitEquip': {
      stepMove(c, dt);                       // 並び位置まで歩きながら待つ
      c.waitT += dt;
      G.today.waitSum += dt;                 // 待たされた時間は、声にならなくても混雑度に効く（作者指摘）
      c.sat -= dt * 0.20;                    // フェーズ2：待たされる不満を2倍に強化（じわじわ→はっきり溜まる）
      c.waitNag += dt;
      if (c.waitNag > 20) {                  // 定期的に不満の声を上げる（何が混んでいるかを名指しする）
        c.waitNag = 0;
        const brk = c.waitItem && c.waitItem.cond <= 0;
        gripe(brk ? 'broken' : 'crowd');
        const name = c.waitItem && EQ[c.waitItem.id].name;
        // 行列の文句は赤枠で出す（作者指定）＝台数を増やせば直る、という改善のサイン
        hintBubble(c, name ? pick(brk ? LINES.waitBroken : LINES.waitFullName).replace('{name}', name)
                           : pick(brk ? LINES.waitBroken : LINES.waitFull));
      }
      if (c.waitT > 60) {                    // しびれを切らして諦める
        c.plan.shift(); c.sat -= 8;
        G.today.queueMiss = (G.today.queueMiss || 0) + 1;   // フェーズ2：日報の「順番待ちで機嫌を損ねた客」に集計
        gripe('crowd');
        const name = c.waitItem && EQ[c.waitItem.id].name;
        bubble(c, name ? pick(LINES.crowdedName).replace('{name}', name) : pick(LINES.crowded));
        c.waitItem = null; c.state = 'plan'; break;
      }
      const [cat, dur] = c.plan[0];
      const item = findFreeEquip(cat, c);
      if (item) {
        c.plan.shift();
        if (startUse(c, item, dur)) c.waitItem = null;
        else c.plan.unshift([cat, dur]);
      }
      break;
    }
    case 'toPas':                             // 冷水機・扇風機・洗面所まで歩く
      if (stepMove(c, dt)) c.state = 'usingPas';
      break;
    case 'usingPas':                          // 水を飲む／風に当たる／髪を乾かす
      c.timer -= dt;
      if (c.timer <= 0) {
        const next = c.pas ? c.pas.next : 'plan';
        // ガチャガチャは1回¥100。子どもが回した瞬間に売上が立つ
        if (c.pas && c.pas.kind === 'gacha') {
          G.cash += GACHA_PRICE; G.today.amenRev += GACHA_PRICE; G.today.amenN++; G.today.revenue += GACHA_PRICE;
          addFloater(c.px, c.py - 24, '+' + yen(GACHA_PRICE));
          c.sat += 6;
        }
        /* 駄菓子コーナー：子どもは10円菓子の袋（¥100）、大人は湯上がりの1本（¥250）。
           値段は章の CONF が持つ（第1章はこの kind に到達しない＝設備が無い） */
        if (c.pas && c.pas.kind === 'dagashi') {
          const dp = c.isChild ? (CONF.dagashiKidPrice || 100) : (CONF.dagashiPrice || 250);
          G.cash += dp; G.today.amenRev += dp; G.today.amenN++; G.today.revenue += dp;
          addFloater(c.px, c.py - 24, '+' + yen(dp));
          c.sat += c.isChild ? 6 : 3;
        }
        /* トイレから出てきた一言（作者指定）。洋式なら「スッキリ〜」、
           親父の代からのボットンなら、顔をしかめて出てくる＝替えろ、の合図 */
        if (c.pas && c.pas.kind === 'toilet') {
          if (c.pas.item.id === 'toilet_old') {
            c.sat = clamp(c.sat - 6, 0, 100);
            gripe('lack');
            const line = pick(LINES.toiletOld);
            gripeBubble(c, line, 'toiletOld');
            voice(c, line, 'lack', 6, '⚠');
          } else {
            const line = pick(LINES.toiletDone);
            bubble(c, line, 2.6);
            voice(c, line, 'toiletDone', 0);
          }
        }
        endPasUse(c);
        if (next === 'leave') afterChange(c); else c.state = 'plan';
      }
      break;
    case 'atRack':                            // 置き場でマット／垢すりを取る・返す
      if (stepMove(c, dt)) {
        c.timer -= dt;
        if (c.timer <= 0) {
          c.amen = c.rackDir === 'get';
          c.carry = c.amen ? c.rackKind : null;
          c.state = 'plan';
        }
      }
      break;
    case 'goEquip':
      if (stepMove(c, dt)) {
        c.path = [c.use.slot];      // 設備の上へスライド
        c.state = 'slideIn';
      }
      break;
    case 'slideIn':
      if (stepMove(c, dt)) {
        c.state = 'using'; c.timer = c.use.dur;
        /* 使い始めた瞬間。第2章の食堂は、ここで**注文を取る**
           （席に着いた＝食べた、ではなく、頼んで・作られて・運ばれてくる） */
        chHook('useStart', c, c.use.item, c.use.cat);
      }
      break;
    case 'using':
      c.timer -= dt;
      if (c.timer <= 0) {
        c.use.item.occ[c.use.slotIdx] = null;
        c.path = [c.use.approach];
        c.state = 'slideOut';
      }
      break;
    case 'slideOut':
      if (stepMove(c, dt)) { finishUse(c); c.state = 'plan'; }
      break;
    case 'lockerOut':
      if (stepMove(c, dt)) {
        c.timer -= dt;
        if (c.timer <= 0) {
          c.mode = 'clothed';
          c.hasLocker = false;              // ロッカーが1つ空く＝待っている客が動ける
          afterChange(c);                   // 洗面所で髪を乾かす → 風呂上がりの一本 → 帰る
        }
      }
      break;
    case 'toVend':
      if (stepMove(c, dt)) { c.state = 'vend'; c.timer = 1.4; }
      break;
    case 'vend':
      c.timer -= dt;
      if (c.timer <= 0) {
        const pr = DRINK_VEND[c.vendId] || 130;
        G.cash += pr; G.today.milk++; G.today.milkRev += pr; G.today.revenue += pr;
        // 台ごとの内訳（日報で「牛乳」「ドリンク」を分けて見せる）
        const vk = c.vendId || 'vend1';
        const tv = G.today; (tv.vendN || (tv.vendN = {})); (tv.vendRev || (tv.vendRev = {}));
        tv.vendN[vk] = (tv.vendN[vk] || 0) + 1; tv.vendRev[vk] = (tv.vendRev[vk] || 0) + pr;
        bubble(c, pick(LINES.milk));
        addFloater(c.px, c.py - 24, '+' + yen(pr));
        c.sat += 4;
        customerLeave(c);
      }
      break;
    case 'toExit':
      if (stepMove(c, dt)) removeCustomer(c);
      break;
  }
}

function removeCustomer(c) {
  if (c.use) { c.use.item.occ[c.use.slotIdx] = null; c.use = null; }
  endPasUse(c);                     // 冷水機・扇風機・洗面所の場所取りを解放する
  c.waitItem = null;
  const qi = G.payQueue.indexOf(c); if (qi >= 0) G.payQueue.splice(qi, 1);
  const i = G.customers.indexOf(c); if (i >= 0) G.customers.splice(i, 1);
}

/* ============ 番台に立って会計する ============
   主人公も、ロビー担当のバイトも、同じことをする（第2章＝**番台の2人目**）。
   番台に着いた人が呼ぶ。列の先頭が目の前に立っていれば、金を受け取って中へ通す。  */
function tendBandai(w, dt) {
  const front = G.payQueue[0];
  const fs = queueSpots()[0];
  if (!front || front.state !== 'pay') { if (!G.payQueue.length) w.task = null; return; }
  const t0 = tileOf(front);
  if (t0.x !== fs.x || t0.y !== fs.y) return;
  w.timer += dt;
  if (w.timer < 0.7) return;
  w.timer = 0;
  takePayment(front);
}
/* 金を受け取って、暖簾の内側へ通す。**番台でも、券売機でも、やることは同じ**なので
   ここに切り出してある（第2章の券売機が、番台を通さずに同じ処理を呼ぶ）。
   切り出しただけで、中身は1行も変えていない＝第1章の会計はそのまま        */
function takePayment(front) {
  const extra = front.wantsSauna && hasCat('sauna') ? G.opts.saunaFee : 0;
  if (front.wantsSauna && hasCat('sauna')) G.today.sauna++;
  // 子どもは子供料金（作者指定）。サウナには入らないので上乗せもない
  let take = front.isChild ? (G.opts.kidFee || 0) : G.opts.fee + extra;
  /* 深夜の入館は割増。開けている店が他に無いので、客は払う。
     G.minutes は**開店からの分**なので、深夜の始まりも開店時刻から数える。
     ここを 24時と直書きしていたので、深夜が22時から始まる第2章では
     **22時〜24時の2時間ぶんだけ割増が取れていない**ところだった（nightStartHour） */
  if (!front.isChild && nightOpenOn() && G.minutes >= (nightStartHour() - openHourNow()) * 60) {
    take += CONF.nightOpen.fee || 0;
    G.today.nightRev = (G.today.nightRev || 0) + (CONF.nightOpen.fee || 0);
  }
  // 手ぶらセット。手ぶらで来た客が買う（高いほど手が出ない）。タオルが無料なら買う理由がない
  // 手ぶらセットは¥300〜¥500の3段（作者指定）。¥300ならほぼ全員が買い、¥500だと半分を切る
  if (!front.isChild && G.opts.tebura && front.tebura && G.opts.towel !== 'free'
      && Math.random() < clamp(0.95 - (G.opts.teburaPrice - 300) / 400, 0.35, 0.95)) {
    take += G.opts.teburaPrice;
    G.today.teburaRev += G.opts.teburaPrice; G.today.teburaN++;
    front.boughtTebura = true; front.boughtTowel = true;
  }
  // 有料タオルを買う客（手ぶらセットに含まれている客は買わない）
  if (!front.isChild && !front.boughtTebura && G.opts.towel === 'paid' && Math.random() < 0.45) {
    take += G.opts.towelPrice; G.today.towelRev += G.opts.towelPrice; G.today.towelN++;
    front.boughtTowel = true;
  }
  /* 無料貸出の日に、実際に借りていった枚数を数える（**枚数で維持費がかかる章だけ**）。
     借りるのは手ぶらで来た客＝自前のタオルを持っている客は借りない。
     金は動かないので、数えるだけ。第1章は towelCostPer を持たないので、この行は通らない */
  if (CONF.towelCostPer && !front.isChild && G.opts.towel === 'free' && front.tebura)
    G.today.towelFreeN = (G.today.towelFreeN || 0) + 1;
  G.cash += take; G.today.paid++; G.today.revenue += take;
  if (front.isNew) G.today.newN++; else G.today.repeatN++;
  const b = bandai();
  if (b) addFloater(b.x * T + T / 2, b.y * T - 6, '+' + yen(take));
  bubble(front, pick(LINES.pay), 1.6);
  G.payQueue.shift();
  front.inAt = G.minutes;          // 滞在時間はここから数える（＝金を払って暖簾をくぐった時刻）
  goLocker(front, 'in');
  for (const c2 of G.payQueue) if (c2.state === 'pay') { sendToQueueSpot(c2); c2.state = 'toPay'; }
}

/* ---- 主人公 ---- */
function makePlayer() {
  const s = playerSpot();
  const p = makeEntity(s.x, s.y, CONF.playerSpd);
  Object.assign(p, { kind: 'player', task: null, timer: 0, target: null });
  return p;
}
function updatePlayer(p, dt) {
  /* 勤務時間の外＝店にいない（家にいる）。やりかけの仕事は畳んで、次の朝までいなくなる。
     ※時刻は onDuty と同じところから引く。ここで CONF.workHours を直に読んでいたので、
       それを持たない第2章が深夜営業を始めた瞬間に落ちていた                */
  const wh = chHook('workHours') || CONF.workHours || [0, 24];
  if (!onDuty()) {
    if (p.task || p.path) { p.task = null; p.target = null; p.path = null; p.moving = false; }
    p.bub = null; p.dozeT = 0;
    if (!G.offDutySaid) { G.offDutySaid = true; log(`🏠 ${wh[1]}時。今日はここまで。店を出た`); }
    return;
  }
  if (G.offDutySaid) { G.offDutySaid = false; log(`🌅 ${wh[0]}時。店に来た`); }
  /* 章が「いま主人公は手が離せない」と言うなら、番台にも掃除にも回さない
     （第2章＝垢すりの施術中。60分は他に何もできない）。
     フックを持たない章は素通り＝これまでどおり                          */
  if (chHook('playerBusy', p, dt)) return;
  /* バイトが誰も居ない（全員まだ来ていない場合も含む）店では、営業中も主人公が
     掃除・ゴキブリ退治・時間切れの声かけまで全部やる（作者指定）。
     受付・掃除・声かけをひとりで回す＝どれかが必ず後手に回り、店が回らない。
     手を付けた仕事は最後までやり切る。番台へ戻るのはそれからなので、その間、行列は伸びる */
  /* **主人公が出勤しない日**（第2章）＝立っているのは妻ひとり。
     番台だけを回して、掃除にも他の階にも手が回らない＝汚れが残り、行列が伸びる */
  if (p.wifeOnly) {
    const deskF = areaCount() <= 1 || ((bandai() || { f: 0 }).f | 0) === (p.f | 0);
    if (deskF && G.payQueue.length) {
      if (p.task !== 'bandai') {
        p.task = 'bandai'; p.target = null;
        const sp = playerSpot(), t0 = tileOf(p);
        p.path = findPath(t0.x, t0.y, sp.x, sp.y) || [];
      }
      if (stepMove(p, dt)) tendBandai(p, dt);
    } else { p.task = null; p.target = null; }
    return;
  }
  /* **第2章の主人公は、体力が尽きるまで動き続ける**（作者指定 8/5）。
     バイトが居ようが居まいが番台に張り付かない＝汚れのある階へ自分で上がっていく。
     止まるのは体力がゼロになった時だけで、そこで番台の横に崩れ落ちる。
     第1章はフックを持たないので、これまでどおり「バイトが1人でも居れば番台」のまま */
  const keepWork = !!chHook('playerKeepWorking');
  const solo = G.phase === 'biz' && (keepWork || !G.staff.some(workerHere));
  if (solo) {
    const busy = p.task === 'clean' || p.task === 'tell' || p.task === 'roach' || p.task === 'ch2go';
    /* 時間切れの声かけだけは番台より先（客を裸で待たせたまま放ってはおけない）。
       掃除に出られるのは行列が切れた時だけ＝ひとりで回す店の床は、まず片づかない。
       **番台に人が立っている店（deskCovered）は、行列があっても掃除に出る**＝
       会計はその人の仕事。主人公は自分の体を、床とゴキブリのほうに使う */
    if (busy || findTimeUpTarget(p) || !G.payQueue.length || chHook('deskCovered')) {
      if (p.task === 'bandai') { p.task = null; p.target = null; }   // 番台を離れる（maintain は手が空いた人しか動かせない）
      maintain(p, dt, playerHome());
      playerDoze(p, dt);
      return;
    }
  }
  /* 支払い待ちが最優先。ただし**番台のある部屋に居るときだけ。**

     ここに部屋の確認が無かったせいで、休憩スペースや食堂に立っている主人公が
     その部屋の何もない床へ歩いて行き、**客のいないところで会計を始めていた**
     （番台は別の部屋にあるので、その部屋の地図で「番台の隣」を計算すると、
     ただの床のどこかが出てくる）。バイト側（deskHelper）には最初から入っている確認 */
  const deskArea = areaCount() <= 1 || ((bandai() || { f: 0 }).f | 0) === (p.f | 0);
  if (deskArea && G.payQueue.length && (!p.task || p.task !== 'bandai')) {
    p.task = 'bandai'; p.target = null;
    const s = playerSpot(), t0 = tileOf(p);
    const pth = findPath(t0.x, t0.y, s.x, s.y);
    if (!pth) stuckBubble(p, '番台に戻れない…');   // 自分が番台へ帰れない＝会計が止まる
    p.path = pth || [];
  }
  if (p.task === 'bandai') {
    if (!deskArea) { p.task = null; p.target = null; p.path = null; }   // 部屋を移った＝番台の仕事は持ち越さない
    else { if (stepMove(p, dt)) tendBandai(p, dt); return; }
  }
  /* バイトが1人でも出勤していれば、営業中の主人公は番台から離れない（作者指定）。
     会計をさばきながら床まで拭いて回れるなら、バイトを雇う理由が無くなる。
     ＝雇ったその日から、掃除も声かけもバイトの仕事になる。
     バイトが誰も居ない日だけは主人公が全部やる（この関数の頭の solo）＝店が回らない、を体で分からせる */
  if (G.phase === 'biz' && !keepWork) {
    const t0 = tileOf(p), home = playerHome();
    if (!p.task && (t0.x !== home.x || t0.y !== home.y)) { p.task = 'home'; p.path = findPath(t0.x, t0.y, home.x, home.y) || []; }
    if (p.task === 'home' && stepMove(p, dt)) p.task = null;
    return;
  }
  /* 手が空いた時に戻る場所は、その人がいる部屋で決まる（playerHome）。
     番台のあるロビーなら台の横、それ以外の部屋なら入口のそば、家なら玄関の内側。
     ここで番台の座標をそのまま使うと、家に居るのに番台の前に立とうとする */
  maintain(p, dt, playerHome());
  playerDoze(p, dt);
}
/* 番台に戻ってきても、すぐには寝ない。ひと息ついてから、ゆっくり崩れ落ちる（作者指定）。
   いきなり突っ伏すと、一瞬で切り替わって見えてしまう */
function playerDoze(p, dt) { p.dozeT = playerSpent() ? (p.dozeT || 0) + dt : 0; }
/* 開店前に、主人公ひとりで拭いて回れる汚れの数（作者指定）。
   準備中は時間が無限に使えるので、ここに上限が無いと毎朝ぴかぴかになってしまう */
const PREP_CLEAN_MAX_BASE = 5;
/* 章ごとに増やせるようにしてある（いまはどの章も上乗せなし） */
function prepCleanMax() { return PREP_CLEAN_MAX_BASE + (chHook('prepCleanBonus') || 0); }
/* 営業中、バイトが誰も居ない日に、主人公が番台を離れて拭ける数（作者指定）。
   受付を放り出して掃除し続けられるなら、やはりバイトを雇う理由が無くなる。
   ここを使い切ったら、汚れが残っていても番台に張り付く＝「人を雇え」の合図 */
const BIZ_CLEAN_MAX = 3;

/* ============ 体力 ============
   主人公の**一日ぶんの手**。第2章だけ（CONF.stamMax がある章だけ）動く。
   汚れを拭く・ゴミを運ぶ・ゴキブリを叩く——主人公が自分の体でやることは、全部ここから引く。
   金を出して人を雇えば減らない＝**金と体力は交換できる**。
   第1章は CONF.stamMax を持たないので、従来の「1晩に5つ／営業中は3つ」のまま動く。 */
// CONF.staminaOn === false でまるごと止まる（数値は残したまま隠せる）
function staminaOn() { return !!CONF.stamMax && CONF.staminaOn !== false; }
function stamCost(kind) { return (CONF.stamCost || {})[kind] || 0; }
function stamLeft() { return staminaOn() ? (G.stam ?? CONF.stamMax) : Infinity; }
function canSpendStam(kind) { return stamLeft() >= stamCost(kind); }
function spendStam(kind) {
  if (!staminaOn()) return;
  G.stam = Math.max(0, stamLeft() - stamCost(kind));
}
/* 朝が来た＝寝て回復する。まるまる1日ぶん戻る */
function restStamina() { if (staminaOn()) G.stam = CONF.stamMax; }
/* 主人公がもう動けないか。体力のある章はこれ1本、無い章は従来の数え方 */
function playerTired(w) {
  if (!w || w.kind !== 'player') return false;
  /* 店を開けない日は、主人公はそもそも店に居ない（第2章の定休日）。
     ここを塞がないと、行き先を選んでいる間に館内の掃除で体力を使い切ってしまう */
  if (G.phase !== 'biz' && chHook('offDayNoWork')) return true;
  if (staminaOn()) {
    if (!canSpendStam('clean')) return true;
    /* **夜（準備中）に拭ける数は、体力とは別に頭打ちにする**（2026-08-07）。
       体力のある章は「尽きるまで動き続ける」だけを見ていたので、
       準備中に主人公が掃除できるようになった日から、
       **カタログを眺めている間に体力を使い切って開店する**ようになった
       （汚れ1つ15・体力100＝朝のうちに6つ拭くと空になる）。
       ここは第1章と同じ prepCleanMax() で止める＝夜に拭けるのは5つまで */
    if (G.phase !== 'biz' && (G.prepCleaned || 0) >= prepCleanMax()) return true;
    return false;
  }
  /* 営業中の上限は章が上書きできる（CONF.bizCleanMax）。
     ⚠ 第2章が体力制を廃止（staminaOn:false）した日から、ここが第1章の
     「営業中3つまで」に落ちて、**主人公が3つ拭いた後は全階の汚れを放置**していた
     （2026-08-09 実測：2Fの持ち場に汚れ8つ・主人公は棒立ち）。
     第2章のバイトを雇う理由は「階ごとの管理」と「女湯に入れない」で立っているので、
     枚数の上限は持たない。フックの無い章（第1章）は従来の3つのまま               */
  return G.phase === 'biz'
    ? (G.bizCleaned || 0) >= (CONF.bizCleanMax || BIZ_CLEAN_MAX)
    : (G.prepCleaned || 0) >= prepCleanMax();
}
/* 汚れ1つを拭き終えるまでの時間（秒）。バイトは主人公の2倍かかる（作者指定）。
   雇った初日から床が一瞬で片づいてしまうと、人数を増やす意味も、
   汚れを溜めない工夫（掃除しやすい配置・客を捌く速さ）も要らなくなる */
const CLEAN_SEC = 7;
function cleanSec(w) { return w.kind === 'player' ? CLEAN_SEC : CLEAN_SEC * 2; }
/* 拭ける数を使い切って、番台まで戻ってきた夜＝そこで力尽きて寝ている（作者指定）。
   汚れが残っていようが、今日はもう動けない。掃除はバイトの仕事だと、絵で伝える */
function playerSpent() {
  const p = G.player;
  if (!p || p.task || p.moving) return false;
  /* **第2章は営業中でも寝る**（作者指定 8/5）＝体力が尽きたその場で一日が終わる。
     第1章は夜（準備中）だけ。フックを持たないので、これまでどおり */
  if (G.phase !== 'prep' && !chHook('sleepAnyPhase')) return false;
  if (isHomeArea(p.f)) return false;          // 家では番台に突っ伏さない（寝るのはベッド）
  /* 寝るのは**番台のある階**だけ。部屋が複数ある章で、ここを見ていないと
     6階のなにも無い床の上で 💤 が浮く（playerSpot は「いま計算中の部屋」の座標を返すため） */
  const b0 = bandai();
  if (areaCount() > 1 && b0 && (b0.f | 0) !== (p.f | 0)) return false;
  // 5つ拭いて力尽きた夜だけでなく、拭ききって汚れが無くなった夜も番台で寝る（作者指定）
  if (!playerTired(p) && G.dirts.length) return false;
  const t = tileOf(p), h = playerSpot();
  return t.x === h.x && t.y === h.y;
}
/* 番台に着いてから、実際に寝入るまでの間（秒）。ここで一拍おく＝いきなり寝ない */
const DOZE_WAIT = 2.4;
/* 崩れ落ちる動きにかける時間（秒）。0→1 で頭が台の高さまで沈む */
const DOZE_FALL = 0.9;
function playerAsleep() { return playerSpent() && (G.player.dozeT || 0) >= DOZE_WAIT; }
/* 寝入り具合（0＝まだ座っている／1＝完全に突っ伏している） */
function dozeAmt() { return clamp((((G.player && G.player.dozeT) || 0) - DOZE_WAIT) / DOZE_FALL, 0, 1); }
// 番台でうとうとしている印。💤 がゆっくり浮かんで消える
function drawSleep(p, rt) {
  const b = bandai();
  const x = b ? b.x * T + T / 2 + 4 : p.px;      // 突っ伏している頭のすぐ上
  const y = b ? b.y * T - 2 : p.py - 26;
  for (let i = 0; i < 2; i++) {
    const ph = ((rt * 0.45 + i * 0.5) % 1);
    ctx.globalAlpha = (1 - ph) * 0.9 * dozeAmt();   // 突っ伏しきってから、じわりと出る
    ctx.font = `${8 + ph * 5}px "DotGothic16",sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(255,255,255,.95)';
    ctx.strokeText('💤', x + 6 + ph * 7, y - ph * 12);
    ctx.fillStyle = '#6a8fb8';
    ctx.fillText('💤', x + 6 + ph * 7, y - ph * 12);
  }
  ctx.globalAlpha = 1;
}

/* ---- スタッフ（アルバイト） ---- */
function makeStaff(i) {
  const emp = G.roster[i];
  /* 第2章は持ち場が1人1部屋（emp.f）。その部屋の間取りで立ち位置を決める。
     第1章は部屋がひとつなので、これまでどおり */
  const f = hasHook('staffAreaOf') ? (chHook('staffAreaOf', emp) | 0) : 0;
  const back = G.actF;
  if (areaCount() > 1) applyArea(f, true);
  const s = staffSpot(i);
  // スピードと慣れ（働きぶり）で足の速さが変わる。ふてくされ中はダラダラ歩く ※係数は叩き台
  const spd = CONF.staffSpd * (0.8 + (emp.spd || 3) * 0.07) * (0.9 + (emp.skill || 40) / 500) * (emp.sulk ? 0.8 : 1);
  const w = makeEntity(s.x, s.y, spd);
  Object.assign(w, { kind: 'staff', task: null, timer: 0, target: null, home: s, sidx: i, emp, f });
  // 真面目さが低いと遅刻してくる（真面目5=遅刻なし〜真面目1=3割弱）
  if (Math.random() < (5 - (emp.maji || 3)) * 0.07) w.lateT = rand(60, 200);
  if (areaCount() > 1) applyArea(back, true);
  return w;
}
function staffSpot(i) {
  // 脱衣所側の空きマスに待機（部屋が浅いときは上から探す）
  const cands = [];
  const y0 = Math.min(7, Math.max(1, CONF.H - 4));
  for (let y = y0; y < CONF.H - 1; y++)
    for (let x = 1; x < CONF.W - 1; x++)
      if (walkable(x, y)) cands.push({ x, y });
  return cands[(i * 3 + 2) % Math.max(cands.length, 1)] || { x: 2, y: 8 };
}
function allWorkers() { return [G.player, ...G.staff].filter(Boolean); }
function claimedBy(target, self) { return allWorkers().some(w => w !== self && w.target === target); }

/* 掃除・待機（主人公とスタッフ共通）。
   ※主人公もバイトも「代金の受け取り」と「掃除」しかできない。
     壊れた設備は自分たちでは直せない（勝手に修理業者が来て、直して、代金を持っていく） */
/* 「そろそろお時間です」を伝えに行く相手を1人選ぶ。掃除より優先する＝
   時間制限を掛けるほど、バイトの手が声かけに取られて汚れが残る（作者指定） */
function findTimeUpTarget(w) {
  if (!G.opts.timeLimit) return null;
  const t0 = tileOf(w);
  const cands = G.customers.filter(c => c.timeUp && !c.told && !claimedBy(c, w));
  if (!cands.length) return null;
  const far = c => { const t = tileOf(c); return Math.abs(t.x - t0.x) + Math.abs(t.y - t0.y); };
  return cands.sort((a, b) => far(a) - far(b))[0];
}
/* その客のそばまでの道。客が湯船の中など歩けないマスにいるので、隣接マスも試す */
function pathToNear(w, tx, ty) {
  const t0 = tileOf(w);
  for (const p of [{ x: tx, y: ty }, { x: tx, y: ty + 1 }, { x: tx, y: ty - 1 }, { x: tx + 1, y: ty }, { x: tx - 1, y: ty }]) {
    if (!walkable(p.x, p.y)) continue;
    const pth = findPath(t0.x, t0.y, p.x, p.y);
    if (pth) return pth;
  }
  return null;
}
/* 声をかけた。まだ足りていない客は不満を残して切り上げる＝
   サウナ料を取っている店ほど「金を取っておいて追い出すのか」と重く響く */
function tellTimeUp(w, c) {
  c.told = true; c.timeUp = false;
  bubble(w, pick(w.kind === 'player' ? LINES.timeUpMe : LINES.timeUp), 3.2);
  const short = c.needMin > (G.opts.timeLimit || 0);
  if (short) {
    const paidSauna = c.wantsSauna && hasCat('sauna') && (G.opts.saunaFee || 0) > 0;
    c.sat = clamp(c.sat - (paidSauna ? 14 : 8), 0, 100);
    gripe('timeup');
    gripeBubble(c, pick(LINES.timeUpMad), 'timeUp');
    G.today.timeUpN++;
  } else if (!c.bub) bubble(c, pick(LINES.timeUpOk), 2.4);
  c.plan = [];                       // 残りの予定は打ち切り。今使っている湯から上がったら着替えに向かう
  if (c.state === 'waitEquip') { c.waitItem = null; c.state = 'plan'; }   // 並んでいた列からも抜ける
}

function maintain(w, dt, home) {
  // 時間切れの客への声かけが最優先（掃除の前に割り込む）
  if (!w.task || w.task === 'home') {
    const c0 = findTimeUpTarget(w);
    if (c0) {
      const t = tileOf(c0), pth = pathToNear(w, t.x, t.y);
      if (pth) { w.task = 'tell'; w.target = c0; w.path = pth; w.timer = 1.2; }
      // そばまで行けない客は諦める（伝えられないまま、毎フレーム狙い続けるのを防ぐ）
      else c0.told = true, c0.timeUp = false;
    }
  }
  /* ゴキブリが出ていたら、掃除より先に仕留めに行く（作者指定）。
     以前は「ゴキブリが乗っている汚れを優先して拭く」だけだったので、
     着く頃には別のマスへ走り去っていて、いつまでも仕留められなかった。
     ここでは相手そのものを追いかけ、隣のマスまで詰めたところで叩く */
  /* ただし主人公が力尽きていたら、ゴキブリが出ても動かない（作者指定）。
     営業中は番台を離れられる回数のうちだけ。夜は拭ける数を使い切った時点で終わり
     ＝番台で寝ている主人公は、目の前を走られても、そのまま寝ている */
  const outOfSteam = playerTired(w);
  /* 第2章の開店前：運べと言われたゴミが最優先（掃除より・ゴキブリより先）。
     これは主人公の仕事で、拭ける数（5つ）の枠には数えない＝金の代わりに足で払う */
  if (w.kind === 'player' && canSpendStam('junk')
      && (!w.task || w.task === 'home' || w.task === 'clean' || w.task === 'roach')) {
    const j0 = nextJunk(w);
    if (j0 && j0 !== w.target) {
      const t0 = tileOf(w);
      const pth = findPath(t0.x, t0.y, j0.x, j0.y);
      if (pth) { w.task = 'haul'; w.target = j0; w.path = pth; w.timer = 1.1; }
      else { j0.want = false; stuckBubble(w, 'そこまで行けない…'); }
    }
  }
  if (w.task === 'haul') {
    const j = w.target;
    if (!j || !G.junk.includes(j)) { w.task = null; w.target = null; }
    else if (stepMove(w, dt)) {
      w.timer -= dt;
      if (w.timer <= 0) {
        const i = G.junk.indexOf(j);
        if (i >= 0) G.junk.splice(i, 1);
        spendStam('junk');
        addSparkle(j.x * T + T / 2, j.y * T + T / 2);
        Sfx.play('fix');
        floaters.push({ x: j.x * T + T / 2, y: j.y * T + T / 2 - 12, text: 'よいしょ', t: 1.4 });
        const left = G.junk.length;
        const nm = chHook('junkName', j) || 'ゴミ';
        log(`🗑 ${nm}を運び出した（残り${left}個）`);
        // 上の一行に「片付けた」を出す＝手を動かした結果が、その場で数字になって減る
        flashTip(left ? `🗑 <b>${nm}</b>を片付けた。あと <b>${left}個</b>`
                      : '🧹 <b>ゴミは全部出し切った</b>');
        if (!left) { log('🧹 これで、ゴミは全部出し切った'); bubble(w, '……ようやく、床が見えた', 4.5); }
        w.task = null; w.target = null;
        if (hasHook('prepHint')) setHint(chHook('prepHint'));   // 「残り○個」を数え直す
        saveGame();
      }
    }
    return;
  }
  const myRoach = roachAt(w.f);            // 追いかけるのは、自分がいる区画の1匹だけ
  if (!outOfSteam && (!w.task || w.task === 'home' || w.task === 'clean') && myRoach && !claimedBy(myRoach, w)) {
    const pth = pathToNear(w, myRoach.tx, myRoach.ty);
    if (pth) { w.task = 'roach'; w.target = myRoach; w.path = pth; }
  }
  if (w.task === 'roach') {
    const r = myRoach;
    if (!r || r !== w.target) { w.task = null; w.target = null; }
    else {
      const arrived = stepMove(w, dt);
      const t0 = tileOf(w);
      if (Math.abs(t0.x - r.tx) <= 1 && Math.abs(t0.y - r.ty) <= 1) {
        killRoach(w, t0); w.task = null; w.target = null;
        // 番台を離れて叩きに行った1回ぶん（掃除と同じ枠で数える）
        if (w.kind === 'player') {
          spendStam('roach');
          if (G.phase === 'biz') G.bizCleaned = (G.bizCleaned || 0) + 1;
        }
      } else if (arrived) {                       // 逃げられた＝いまの居場所へ追い直す
        const pth = pathToNear(w, r.tx, r.ty);
        if (pth) w.path = pth; else { w.task = null; w.target = null; }
      }
      return;
    }
  }
  if (w.task === 'ch2go') { chHook('stepRoam', w, dt); return; }   // 第2章：部屋を移っている最中
  if (w.task === 'tell') {
    const c0 = w.target;
    if (!c0 || c0.told || !G.customers.includes(c0)) { w.task = null; w.target = null; }
    else if (stepMove(w, dt)) {
      const t = tileOf(c0), t0 = tileOf(w);
      // 歩いている客を追いかける（着いた時にもう居なければ、その場から追い直す）
      if (Math.abs(t.x - t0.x) + Math.abs(t.y - t0.y) > 1) {
        const pth = pathToNear(w, t.x, t.y);
        if (pth) w.path = pth; else { w.task = null; w.target = null; }
      } else {
        w.timer -= dt;
        if (w.timer <= 0) { tellTimeUp(w, c0); w.task = null; w.target = null; }
      }
    }
    return;
  }
  if (!w.task) {
    /* 主人公が営業中にここへ来るのは、バイトが誰も居ない時だけ（updatePlayer の solo）。
       その日は受付も掃除も声かけも全部ひとりで背負う。開店前の「5つで手が止まる」上限は
       夜の話なので、営業中には掛けない */
    const soloPlayer = w.kind === 'player' && G.phase === 'biz';
    /* 主人公が拭ける数には限りがある。夜（準備中）は prepCleanMax()、
       営業中に番台を離れて拭けるのは BIZ_CLEAN_MAX まで（作者指定）。
       ここに上限が無いと、客の少ない序盤は主人公ひとりで床が全部片づいてしまい、
       汚れも、ゴキブリも、バイトを雇う理由も丸ごと消える */
    const tired = playerTired(w);
    // 拭ける数を使い切ったのに、まだ汚れが残っている＝そこで音を上げる（1回だけ）
    if (tired && G.dirts.length && !G.tiredSaid) {
      G.tiredSaid = true;
      bubble(w, pick(soloPlayer ? LINES.bizTired : LINES.prepTired), 5.0);
      log(staminaOn()
        ? `🧹 体力が尽きた。残り${G.dirts.length}つは、明日か、人の手だ`
        : soloPlayer
        ? `🧹 ${BIZ_CLEAN_MAX}つ拭いたところで手を止め、番台に戻った。ひとりでは、これ以上は手が回らない`
        : `🧹 ${prepCleanMax()}つ拭いたところで手が止まった。残り${G.dirts.length}つはバイトの仕事だ`);
    }
    // 掃除できるのは、その人がいる区画の汚れだけ（第2章＝主人公は女湯に入れない・バイトは担当区画のみ）
    const avail = tired ? [] : G.dirts.filter(d => (d.f | 0) === (w.f | 0) && !claimedBy(d, w));
    if (avail.length) {
      const t0 = tileOf(w);
      /* 近い順に、実際にたどり着ける汚れを探す。
         「いちばん近い1つ」だけを見て、そこへの道が無いと何もせず終わっていたため、
         設備で囲まれた汚れが1つでもあると、他に掃除できる汚れがあっても
         毎フレーム同じ汚れを選び直して棒立ちになっていた */
      // ゴキブリが出ている汚れが最優先。そのあとは近い順（作者指定）
      const sorted = avail.slice().sort((a, b) =>
        ((b.roach ? 1 : 0) - (a.roach ? 1 : 0)) * 1000
        + (Math.abs(a.x - t0.x) + Math.abs(a.y - t0.y)) - (Math.abs(b.x - t0.x) + Math.abs(b.y - t0.y)));
      for (const d0 of sorted) {
        const pth = findPath(t0.x, t0.y, d0.x, d0.y);
        if (pth) { w.task = 'clean'; w.target = d0; w.path = pth; w.timer = cleanSec(w); break; }
      }
      // どの汚れにも道が通っていない＝設備で通路を塞いでいる。赤字で知らせる
      if (!w.task) stuckBubble(w, '汚れの所まで行けない…');
    } else {
      // 第2章：いまの部屋に汚れが無くても、ほかの部屋に残っていれば歩いて拭きに行く
      if (w.kind === 'player' && chHook('roamPlayer', w, tired)) return;
      const t0 = tileOf(w);
      if (t0.x !== home.x || t0.y !== home.y) { w.task = 'home'; w.path = findPath(t0.x, t0.y, home.x, home.y) || []; }
    }
  }
  if (w.task === 'clean') {
    if (stepMove(w, dt)) {
      w.timer -= dt;
      if (w.timer <= 0) {
        const i = G.dirts.indexOf(w.target);
        if (i >= 0) G.dirts.splice(i, 1);
        if (w.kind === 'player') {
          spendStam('clean');              // 体力のある章（第2章）はここから引く
          if (G.phase === 'biz') G.bizCleaned = (G.bizCleaned || 0) + 1;
          else G.prepCleaned = (G.prepCleaned || 0) + 1;
        }
        killRoachNear(w, w.target);        // 拭いた場所のそばにいたら、その場で仕留める
        w.task = null; w.target = null;
      }
    }
  } else if (w.task === 'home') {
    if (stepMove(w, dt)) w.task = null;
  }
}
function updateStaff(dt, onlyF) {
  for (const s of G.staff) {
    // 第2章は区画ごとに計算するので、担当区画にいるバイトだけを動かす（第1章は onlyF が来ない）
    if (onlyF !== undefined && (s.f | 0) !== onlyF) continue;
    if (s.lateT > 0) {                              // 遅刻中＝まだ店に来ていない
      s.lateT -= dt;
      if (s.lateT <= 0) { toast(`⏰ ${s.emp.name}が遅刻してきた…`); log(`⏰ ${s.emp.name}が遅刻してきた`); }
      continue;
    }
    /* もう帰った人（第2章＝22時で日勤は上がる）。やりかけの仕事は畳んでおく＝
       持ち主のいない「予約済みの汚れ」が残ると、他の人がそこを拭けなくなる */
    if (chHook('workerOff', s)) { s.task = null; s.target = null; s.path = null; s.bub = null; continue; }
    if (s.slackT > 0) { s.slackT -= dt; continue; }  // サボり中（真面目さが低いと起きる）
    /* ロビー担当は**番台の2人目**（第2章）。主人公が番台を離れている間
       （＝21時に帰ったあと、他の用事の最中）に、代わって会計をさばく。
       行列が切れているあいだは、いつもどおり掃除して回る                */
    if (deskHelper(s, dt)) continue;
    /* 章ごとの持ち場の仕事（第2章の食堂＝作る・運ぶ）。
       手が空いていれば false が返るので、いつもどおり掃除に回る */
    if (chHook('staffJob', s, dt)) continue;
    // 真面目さが低いバイトは、手が空くとたまにサボる（毎秒 真面目1=4%〜真面目5=0%）
    if (s.emp && !s.task && G.dirts.length && Math.random() < (5 - s.emp.maji) * 0.01 * dt) {
      s.slackT = rand(8, 16);
      if (!s.bub) bubble(s, pick(['ふぅ…', 'ちょっと休憩…', '（スマホちら見）']));
      continue;
    }
    maintain(s, dt, s.home);
  }
}
/* ロビー担当のバイトが番台に入るか。
   主人公が番台に着いていれば任せる＝2人で同じ客を捌かない。
   主人公が帰ったあと（21時〜）や、他の用事で離れている間はこの人が受付を回す。
   券売機の使い方が分からない客の相手も、この人の仕事（tellTicket）           */
function deskHelper(s, dt) {
  if (!CONF.staffRooms || G.phase !== 'biz') return false;
  const b = bandai();
  if (!b || (b.f | 0) !== (s.f | 0)) return false;      // ロビー（番台のある部屋）の担当だけ
  const p = G.player;
  const playerOnDesk = p && onDuty() && p.task === 'bandai' && !p.moving;
  if (!G.payQueue.length || playerOnDesk) {
    if (s.task === 'bandai') { s.task = null; s.target = null; }
    return false;                                       // 手が空いた＝いつもどおり掃除へ
  }
  if (s.task !== 'bandai') {
    s.task = 'bandai'; s.target = null;
    const spot = deskHelperSpot(), t0 = tileOf(s);
    s.path = findPath(t0.x, t0.y, spot.x, spot.y) || [];
  }
  if (stepMove(s, dt)) tendBandai(s, dt);
  return true;
}
/* 番台の2人目が立つところ。主人公の隣（番台に寄れるマスのうち、主人公と別のところ） */
function deskHelperSpot() {
  const L = deskLayout(); if (L && L.staff2) return L.staff2;
  const b = bandai(); if (!b) return { x: 2, y: 2 };
  const ps = playerSpot();
  const ts = approachTiles(b).filter(t => !(t.x === ps.x && t.y === ps.y));
  return ts[0] || ps;
}

/* 日給の合計（フェーズ3：人ごとにスペックで違う）。
   深夜営業をしている日は、深夜に立てる人に**割増25%**（法定どおり）が付く */
function rosterWages() {
  const rate = nightOpenOn() ? (CONF.nightOpen.wageRate || 1.25) : 1;
  return G.roster.reduce((a, e) =>
    a + Math.round((e.wage || CONF.staffWage) * (e.night ? rate : 1)), 0);
}

/* ============ 一日の流れ ============ */
function startDay() {
  G.phase = 'biz';
  G.minutes = 0;
  G.bizCleaned = 0;                        // 営業中に主人公が拭いた数（バイト0人の日だけ増える）
  G.roachCool = {};                        // 前日の「仕留めた直後」は持ち越さない（朝は出直し）
  /* 朝＝体力が戻る（第1章）。**第2章はここを通さない。**
     第2章は「閉めていた時間ぶんだけ戻す」という自前の仕組みを持っていて、
     ここで毎朝満タンに戻してしまうと**営業時間を伸ばす代償が消える**
     （実際、これを見落としていて18時間営業でも一度も倒れなかった）        */
  if (!G.homeRested && !chHook('keepStamina')) restStamina();
  G.homeRested = false;
  G.tiredSaid = false;                     // 「これ以上は手が回らない」の独り言は1日1回
  for (const d of G.dirts) d.t = -9999;    // 前日から持ち越した汚れは、開店の時点で「放置」扱い
  refreshDead();                 // 開店前に、道が通っていない設備を洗い直す
  G.today = newToday();
  // 融資の入金は enterPrep（朝の準備）で済ませてある。日報に「入金」の1行を出すのはここ（作者指定）
  if (G.loanInToday > 0) { G.today.loanIn = G.loanInToday; G.loanInToday = 0; }
  G.customers = []; G.payQueue = [];
  G.riotDone = false;              // 暴動は1日に1回まで（毎日ぶっ壊されたら立て直せない）
  for (const it of G.equip) { it.occ = Array(EQ[it.id].cap).fill(null); it.pasBy = null; }
  autoRepair();                    // 昨日の傷みで壊れたものがあれば、開店と同時に業者が来る
  /* 主人公は**必ず番台のある部屋**に立たせる（第2章）。
     男湯を見ている状態で【営業開始】を押すと、これまでは主人公が男湯に湧いて、
     ロビーの番台に一生たどり着けず、**客が誰も金を払えないまま一日が終わっていた**。
     第1章は部屋がひとつなので、これまでどおり                              */
  if (areaCount() > 1) {
    /* **持ち場（playerArea）に立たせる**（2026-08-08 修正）。
       それまでは `bandai()` のある区画に固定していたので、バイト管理画面で
       主人公を男湯へ動かしても、**毎朝かならず番台の階に湧き直していた**
       ＝配置そのものが効いていなかった（第1章は区画が1つなので永久に同値＝気づけない）。
       持ち場に番台があれば、これまでどおりそこで会計をする。
       離れているあいだの会計は、妻かロビー担当のバイト（deskHelper）が受ける      */
    const deskF = playerArea(), back = G.actF;
    applyArea(deskF, true);
    G.player = makePlayer(); G.player.f = deskF;
    applyArea(back, true);
  } else G.player = makePlayer();
  /* 章が「今日は主人公が出ない」と言えば、立っているのは妻ひとり（第2章） */
  if (G.player && chHook('absentToday')) G.player.wifeOnly = true;
  G.staff = [];
  for (let i = 0; i < G.roster.length; i++) G.staff.push(makeStaff(i));
  /* 章が「バイト以外にも店に立つ人」を持っていれば、ここで足す（第2章＝妻）。
     **G.roster には入れない**＝給料もクビも面接も無い。持ち場だけを持つ人 */
  for (const ex of (chHook('extraWorkers') || [])) if (ex) G.staff.push(ex);
  /* 求人広告を出した翌朝、応募者3人が面接に来る。
     第2章は**準備中**に来る（enterPrep）＝どの部屋に立たせるかを、開店前に決められる。
     第1章はこれまでどおり、開店と同時に面接が始まる                        */
  if (!CONF.staffRooms && G.jobAdDay && G.day >= G.jobAdDay) { G.jobAdDay = 0; openJobModal(); }
  // ── 今日の来訪者を1人だけ決める（田所 → 鬼頭 → 黒田 → 玲奈 の順に焦点が移る）
  G.benz = null; G.mika = null; G.mikaFired = false; G.mikajimeAt = null;
  G.npcs = G.npcs.filter(n => n.role === 'fixer');   // 作業中の修理業者は開店をまたいでも居残る（作者指定）
  G.visitKey = null; G.visitAt = null; G.visitFired = false;
  G.yamiFired = false; G.yamiAt = null;
  /* 「今日は誰が来るか」も章ごとに別。第2章が自前の仕掛けを持っていればそちらへ渡す */
  if (hasHook('scheduleDay')) { chHook('scheduleDay'); } else {
    if (G.flags.reinaTV === 1) G.flags.reinaRumorAt = rand(120, 480);   // テレビ特集の翌日は常連が噂する
    const v = pickTodaysVisitor();
    if (v === 'mikajime') G.mikajimeAt = rand(120, 720);
    // 田所の顔合わせだけは開店まもなく（10〜12時台）。「暖簾を出して間もなく」の一幕なので
    else if (v) { G.visitKey = v; G.visitAt = (v === 'tadokoro' && !G.tadokoro.hello) ? rand(60, 190) : rand(150, 660); }
    // サラ金の集金は毎週水曜、開店直後にやってくる（作者指定＝毎日の取り立ては廃止）
    G.yamiAt = (G.yami && G.yami.debt > 0 && dayOfWeek(G.day) === 2) ? 30 : null;
  }
  // 客の来店予定を作る。土台は評判＝評判が上がるほど客が増える。
  // フェーズ3.5：傾きを0.7→0.45に緩和（評判50で行列が捌けなくなっていたため。※数値は叩き台）
  let n = CONF.guestBase + G.rep * CONF.guestPerRep + G.adBoost;
  /* 行きつけにしてくれている人の来店（作者指定）。常連ひとりは3日に1回来るので、その頭数を足す。
     序盤は常連ゼロ＝難易度は変わらず、満足度を上げて常連を積むほど毎日の客足が太っていく。
     評判の傾き（＝ミッションの進行ペース）には触らない */
  const regularsToday = Math.min((G.regulars || 0) * CONF.regularVisitRate, CONF.regularGuestCap);
  n += regularsToday;
  if (G.equip.some(e => e.id === 'sauna1' && e.cond > 0)) n += 3;
  if (G.equip.some(e => e.id === 'sauna3' && e.cond > 0)) n += 5;
  if (G.equip.some(e => e.id === 'sauna2' && e.cond > 0)) n += 7;
  if (G.equip.some(e => e.id === 'sauna_sp' && e.cond > 0)) n += 7;   // 決戦仕様＝この店にしかない一台
  /* 上の4行は**第1章の設備の id を名指ししている**。章が変われば id も変わるので、
     章が自前の足し算を持っていればそれも足す（第2章＝サウナ室の数と広さで増える）。
     ここが無いと、第2章はサウナを何室建てても客がまったく増えなかった（作者指摘 8/5） */
  n += chHook('guestBonus') || 0;
  // 運営メニューの集客補正
  // 安ければ客は増える。**基準もきざみも章ごと**（第2章は目安そのものが基準）
  n += (feeBaseFor() - G.opts.fee) / feeUnit() * 2;   // 安いほど客が増える（基準は定額ボタンの真ん中¥700）
  if (G.opts.towel === 'free') n += 3;
  if (G.opts.towel === 'paid') n -= 1;
  if (G.opts.soapMode === 'free') n += 2;
  else if (G.opts.soapMode === 'sell') n += 1;
  if (G.opts.tebura && G.opts.towel !== 'free') n += 3;   // 手ぶら客の取りこぼしを拾える
  if (hasAkasuri()) n += 1;
  if (hasMat() && hasCat('sauna')) n += 2;
  if (tadokoroAllyOn()) n += 4;   // 田所が仲間＝地元の常連を呼び込んでくれる
  if (reinaAllyOn()) n += 5;      // 玲奈が仲間＝業界の伝手で集客を回してくれる
  if (hasCat('sauna')) n += (worthSaunaFee() - G.opts.saunaFee) / 100 * 1.5;   // サウナ料が目安より高いとサウナ客が減る
  // フェーズ2：入浴料が「この設備なら納得できる額」を超えた分だけ、客足が目に見えて細る（¥100超過ごとに-25%、最大-70%）
  const gripe = feeGripe();
  if (gripe > 0) n *= clamp(1 - gripe * 0.5, 0.3, 1);
  // フェーズ2：田所の要求に応えきれなかった罰＝常連の足が一時的に遠のく（5日間 客足-10%）
  if (G.day <= (G.tadokoroPenaltyUntil || 0)) n *= 0.9;
  n *= CONF.guestMul;                                       // 客足の倍率（作者指定で1.3倍）
  n *= dowGuestMul();                                       // 曜日（平日は休日の70%。週の平均は変わらない）
  n = clamp(Math.round(n * rand(0.85, 1.15)), 3, CONF.guestMax);
  // 競合圧＝蒼天SPAに客を吸われて、この人数までしか来ない（段階制・作者指定）
  const cap = soutenGuestCap();
  const capped = n > cap;
  if (capped) n = cap;
  /* 章ごとの客足の補正。第2章は国道沿いなので、**停められる台数で客数が決まる**。
     砂利のままだと誰も停めない＝歩いて来られる近所の人しか来ない */
  const adj = chHook('guestAdjust', n);
  if (adj !== undefined) n = adj;
  G.plannedGuests = n;      // 新規／常連の振り分けはこの見込み数を母数にする
  G.repeatShareToday = repeatShare();
  G.stuckLogged = false;    // 「通路が塞がっている」の営業ログは1日1回だけ
  // 9時→23時。開店直後(9〜11時)は待ち時間が間延びするので少し底上げしてある
  const hw = [4, 4, 4, 4, 4, 4, 5, 6, 8, 9, 9, 8, 6, 4, 2];
  const hwSum = hw.reduce((a, b) => a + b, 0);
  /* この曲線は**15時間の店**（第1章＝9時〜24時）に合わせて作ってある。
     第2章はそれより短い（既定15時〜22時の7時間）ので、そのまま使うと
     **閉店後の時刻に振られた客が一人も来ない**＝見込みの2割強が黙って消えていた（作者指摘 8/5）。
     開けている長さに合わせて時刻を縮める。第1章は 900分＝等倍なので、何も変わらない */
  const dayLen = Math.max(60, (closeHourNow() - openHourNow()) * 60);
  const shrink = dayLen / 900;
  /* 章が自前の時間割を持っていれば、そちらが正（第2章＝yHourWeight で抽選する）。
     伸縮では、深夜まで開けたときに**第1章の夕方の山が翌1時に来てしまう** */
  const times = chHook('spawnTimes', n);
  if (times) G.spawnQueue = times.slice();
  else {
    G.spawnQueue = [];
    for (let i = 0; i < n; i++) {
      let r = Math.random() * hwSum, h = 0;
      for (let j = 0; j < hw.length; j++) { r -= hw[j]; if (r <= 0) { h = j; break; } }
      const m = (h * 60 + rand(0, 60)) * shrink;
      if (m < 870 * shrink) G.spawnQueue.push(m);
    }
  }
  G.spawnQueue.sort((a, b) => a - b);
  G.adBoost = 0;
  // UI
  $('prepPanel').classList.add('hidden');
  $('selPanel').classList.add('hidden');
  $('confirmBar').classList.add('hidden');
  $('bizPanel').classList.remove('hidden');
  if (!onGuide() && !onHome()) $('shopPanel').classList.remove('hidden');   // 営業中も設備を買える（案内図では出さない）
  renderShop();
  G.paused = false; $('btnPause').textContent = '⏸ 一時停止';
  setHint(null);
  G.logLines = [];
  Sfx.bgm('biz');                              // 暖簾を出したらBGMが流れ出す
  log(`🏮 ${G.name}、開店！（本日の見込み ${G.spawnQueue.length}人）`);
  /* 蒼天SPAに頭を押さえられている日は、それを日誌に書き、営業中に主人公が声に出す（作者指定）。
     見込み人数が減っているだけでは「今日はたまたま暇な日」に見えてしまう */
  G.crisisAt = [];
  if (soutenCrisisOn()) {
    if (capped) log(`😨 蒼天SPAに客を吸われている……今日の見込みは、たったの${n}人だ`);
    G.crisisAt = [rand(100, 220), rand(340, 460), rand(560, 700)];
  }
}

/* 1フレームぶんの営業を進める。
   速度を上げすぎた章が出てきたとき用の保険。まとめて1回で計算すると
   行列・滞在時間・汚れの蓄積が壊れる（客が湯に入る前に一日が終わる）ので、
   CONF.subStepMin より大きい幅は、その幅に分けて何回も回す＝精度は落ちない。
   いまはどの章も subStepMin を持たない（速度表は [1,2,4,8] 共通）ので、常に1回で回る */
function stepBiz(dt) {
  const sub = CONF.subStepMin || 0;
  if (!sub || dt <= sub) { updateBiz(dt); return; }
  let left = dt;
  while (left > 0.0001 && G.phase === 'biz') {
    const d = Math.min(sub, left);
    updateBiz(d);
    left -= d;
  }
}
function updateBiz(dt) {
  G.minutes += dt;
  chHook('bizTick', dt);   // 第2章：桑田がふらりと番台の前に立つ
  /* 清潔度の採点用に「その日、床に平均いくつ汚れが転がっていたか」を測り続ける（新評判システム）。
     不満の声（dirty）の数で測ると、汚れ1つの脇を客が何度も通るだけで数百件に膨れ、
     満足度95の店が清潔度1点になってしまった（シム実測）。見るべきは、掃除できていたかどうか */
  const dcNow = dirtCounts();
  G.today.dirtSum += dcNow.thick * dt;        // 薄い汚れは数えない（作者指定）
  G.today.dirtN += dt;
  /* 階ごとの内訳も測る（清潔度を階ごとに採点する章＝第2章）。
     フラグを持たない章はここを通らない＝これまでどおり合計だけを見る */
  if (CONF.dirtPerFloor) {
    const bf = G.today.dirtSumF || (G.today.dirtSumF = {});
    for (const d of G.dirts) if (isThickDirt(d)) { const f = d.f | 0; bf[f] = (bf[f] || 0) + dt; }
  }
  /* 客は**必ず番台のある部屋**＝入口のある部屋に湧かせる。
     ここは下の forEachArea の外なので、放っておくと「いま画面に映している部屋」に湧く。
     男湯を見たまま【営業開始】を押すと、客が全員その浴室に湧いて、
     ありもしない番台の前に並んだまま一日が終わっていた（**客0人**）。
     主人公については同じ手当てを startDay で済ませてある。
     第1章は部屋がひとつなので、ここは素通りする                          */
  if (G.spawnQueue.length && G.spawnQueue[0] <= G.minutes) {
    const back = G.actF, b = bandai();
    applyArea(b ? (b.f | 0) : playerArea(), true);
    while (G.spawnQueue.length && G.spawnQueue[0] <= G.minutes) {
      G.spawnQueue.shift();
      spawnCustomer();
    }
    applyArea(back, true);
  }
  /* 客・主人公・バイトは、区画ごとに計算する。
     CONF（間取り）を区画ぶんだけ差し替えながら回すので、経路探索も当たり判定も
     その区画の地図で正しく動く。第1章は区画がひとつなので、これまでと同じく一周だけ回る */
  forEachArea(f => {
    for (const c of [...G.customers]) if ((c.f | 0) === f) updateCustomer(c, dt);
    if (G.player && (G.player.f | 0) === f) updatePlayer(G.player, dt);
    updateStaff(dt, f);
  });
  chHook('tick', dt);                 // 章ごとの毎分の処理（第2章＝券売機が列を捌く）
  autoRepair();                       // 壊れた設備があれば、勝手に業者がやって来る
  maybeRiot(dt);                      // 汚れ・混雑を何日も放置していると、ついに客がキレる
  if (G.yamiAt !== null && !G.yamiFired && G.minutes >= G.yamiAt) startYamiCollect();
  if (G.mikajimeAt !== null && !G.mikaFired && G.minutes >= G.mikajimeAt) startMikajime();
  if (G.visitAt !== null && !G.visitFired && G.minutes >= G.visitAt) startVisit(G.visitKey);
  // 蒼天SPA導線②：テレビ特集の翌営業日、常連が噂する（この翌日の夜、主人公が視察に行く）
  if (G.flags.reinaTV === 1 && G.flags.reinaRumorAt != null && G.minutes >= G.flags.reinaRumorAt) {
    const c = G.customers.find(cc => !cc.bub && !cc.outside);
    if (c) {
      bubble(c, '蒼天SPA、すごかったよ', 4.5);
      log('🗣 常連が駅前の「蒼天SPA」の噂で持ちきりだ');
      G.flags.reinaTV = 2; G.flags.reinaRumorDay = G.day; G.flags.reinaRumorAt = null;
    }
  }
  // 蒼天SPAに押されている日の、主人公の独り言（1日3回まで・作者指定）
  if (Array.isArray(G.crisisAt) && G.crisisAt.length && G.minutes >= G.crisisAt[0]) {
    G.crisisAt.shift();
    if (G.player && !G.player.bub) bubble(G.player, pick(SOUTEN_CRISIS), 4.5);
  }
  if (G.minutes >= (closeHourNow() - openHourNow()) * 60) closeDay();
}

/* ---- 暴動（作者指定） ----
   汚れや行列を「放置しても痛くない」ままにしておくと、掃除も設備の増設もやらなくていいことになる。
   荒れた日が続いた翌日から、我慢の限界を超えた客が設備をひとつ壊していく＝修理費という形で必ず跳ね返る。
   1日1台まで。壊れる前に必ず準備画面で警告を出しているので、不意打ちにはならない */
function maybeRiot(dt) {
  if (G.riotDone || (G.roughDays || 0) < CONF.riotDays) return;
  // 「今まさに荒れている」時だけ起きる＝今日ちゃんと掃除して捌けていれば起きない
  const badNow = oldDirtCount() >= CONF.dirtAngryN || (G.today.queueMiss || 0) >= 3;
  if (!badNow) return;
  if (Math.random() > dt / 240) return;                 // 判定はおよそ店内4分に1回
  const angry = G.customers.filter(c => !c.isChild && !c.outside && c.sat < 40);
  if (!angry.length) return;
  const cands = G.equip.filter(e => e.cond > 0 && (CONF.wearPerDay[EQ[e.id].cat] ?? 0) > 0);
  if (!cands.length) return;
  const c = pick(angry);
  // いちばん近い設備に八つ当たりする
  const it = cands.reduce((a, b) =>
    Math.hypot(c.px - a.x * T, c.py - a.y * T) <= Math.hypot(c.px - b.x * T, c.py - b.y * T) ? a : b);
  G.riotDone = true;
  it.cond = 0;
  breakEquip(it);
  c.sat = 0;
  bubble(c, pick(LINES.riot), 4.5);
  Sfx.play('fix');
  log(`💢 ${c.type.name}がキレて ${EQ[it.id].name} を壊した！（汚れ・行列の放置が${G.roughDays}日続いている）`);
  toast('💢 客が暴れた！設備が壊された');
}

/* ============ 黒塗りベンツの演出（横向き・右下から来て入口に停まり左へ去る） ============ */
const BENZ_Y = (CONF.H - 1) * T + 15;                 // 走行する高さ（入口の外＝下端）
const BENZ_STOP_X = (CONF.entrance.x + 0.5) * T;      // 入口の真下で停まる
function startBenz(opts) {
  opts = opts || {};
  G.benz = {
    x: CONF.W * T + 70,        // 画面右外から登場
    phase: 'in',               // in（入場）→ wait（停車）→ out（退場）
    hold: !!opts.hold,         // true=停車したまま外部の合図で発進（みかじめ）／false=少し停まって自動発進
    waitT: 0, parkedCalled: false,
    thugs: !!opts.thugs,       // 停車中に強面が降りて立つ
    car: opts.car || 'benz',   // フェーズ3：'benz'（鬼頭）／'ferrari'（玲奈＝真っ赤なスポーツカー）
    onPark: opts.onPark || null,
    onDone: opts.onDone || null,
  };
}
function updateBenz(rDt) {
  const b = G.benz; if (!b) return;
  // 走っているあいだだけエンジンを鳴らす（停車中は切る＝エンジンが止まる間が“降りてくる”前触れになる）
  Sfx.engine(b.phase !== 'wait');
  // 速度は画面のゲーム速度に連動。速度1はわざとゆっくり＝じわりと迫ってくる怖さ
  const spd = ([70, 130, 230][G.speedIdx] ?? 130) * rDt;
  if (b.phase === 'in') {
    b.x -= spd;
    if (b.x <= BENZ_STOP_X) {
      b.x = BENZ_STOP_X; b.phase = 'wait'; b.waitT = 0;
      if (!b.parkedCalled) { b.parkedCalled = true; if (b.onPark) b.onPark(); }   // 停まったら降車＝モーダル
    }
  } else if (b.phase === 'wait') {
    if (!b.hold) { b.waitT += rDt; if (b.waitT > 1.1) b.phase = 'out'; }           // 送迎はすぐ発進
  } else if (b.phase === 'out') {
    b.x -= spd;                                                                     // 左へ去る
    if (b.x < -80) { const done = b.onDone; G.benz = null; Sfx.engine(false); if (done) done(); }
  }
}
function releaseBenz() { if (G.benz) { G.benz.phase = 'out'; G.benz.thugs = false; } }  // 強面が乗り込み発進

/* ============ みかじめ料の来訪（ヤクザお断りの副作用） ============ */
function startMikajime() {
  G.mikaFired = true; G.mikajimeAt = null;
  G.paused = true; $('btnPause').textContent = '▶ 再開';
  Sfx.bgmStop();   // 曲を止める＝静けさ（＋本人の時はベンツのエンジン音）だけが残る（決着したら戻す）
  const k = G.kito;
  /* 新フロー（作者指定）：出会い→毎回「鬼頭の要求」の選択画面→田所が割って入って解決。
     割って入るのは【田所が主人公を「認めた」あと】＝それまでは、みかじめを何回払っても助けは来ない。
     認められていないうちは若い衆が7日ごとに集金に来続ける（作者指定）。
     500万の手切れ金はいつ選んでもいい（選択画面に常に並ぶ） */
  /* 田所が割って入る条件は【みかじめを3回以上払った】か【連中が5回以上来た】のどちらか（作者指定 8/5）。
     払った回数だけで数えていたころは、**修理代のほうが安いと踏んで一度も払わない店**で
     田所が永久に動かず、話が止まってしまった。突っぱね続けても、来られた回数は積み上がる */
  if (kitoRescueReady()) {
    G.flags.lastMikaDay = G.day;
    log('🚗 黒塗りのベンツが乗りつけてきた…また集金だ');
    startBenz({ hold: true, thugs: true, onPark: () => startKitoRescue() });
    return;
  }
  const ally = !!(k && k.resolved && k.ally);   // 付き合いの集金（決着後）
  const firstMeet = !!(k && !k.met);            // 初めての顔合わせ
  // 鬼頭本人が来る時（初対面／付き合い）だけベンツ。普段の集金は若い衆が歩いてくる（作者指定）
  const inPerson = ally || firstMeet;
  let amount = clamp(Math.round((25000 + G.rep * 1200 + G.day * 400) / 1000) * 1000, 25000, 120000);
  if (ally) { amount = clamp(Math.round(amount * 0.5 / 1000) * 1000, 10000, 60000); k.lastAllyDay = G.day; }
  G.mika = { amount, ally, inPerson };
  if (inPerson) {
    log(ally ? '🚗 鬼頭のベンツだ…“付き合い”の集金に顔を出しに来た' : '🚗 黒塗りのベンツが乗りつけてきた…みかじめ料の要求だ');
    // ベンツが入口に停まったら（onPark）モーダルを出す。決着したらベンツを去らせ、その場で営業再開
    startBenz({ hold: true, thugs: true, onPark: showMikajimeModal });
  } else {
    log('🚶 鬼頭組の若い衆が、暖簾をくぐって歩いてきた…集金だ');
    const n = makeNpc('thug'); n.role = 'visit';
    walkNpcTo(n, npcSpot());
    n.onArrive = showMikajimeModal;
    G.npcs.push(n);
  }
}
/* みかじめの話がついた瞬間に営業を再開する。
   以前はベンツが画面外へ消えるまで店ごと止めていたが、去っていく車を眺めているあいだ
   客が全員かたまったまま棒立ちになるので、「連中が帰るところ」と「客の湯浴み」を同時に動かす */
function resumeBiz() {
  G.paused = false; $('btnPause').textContent = '⏸ 一時停止';
  Sfx.bgm('biz');   // 連中が引き上げたら、また営業の曲に戻る
}
function showMikajimeModal() {
  if (!G.mika) return;
  const k = G.kito;
  // 初対面だけ、先に湯船の二人芝居を挟んでから本題（作者指定）。フラグで一度きり
  if (k && !k.met && !G.flags.bathKitoMeet) {
    bathCutThen(STORY_KITO_MEET, 'bathKitoMeet', showMikajimeModal);
    return;
  }
  const amount = G.mika.amount;
  const ally = G.mika.ally;
  const firstMeet = k && !k.met;
  if (k) k.met = true;
  // 選択画面のタイトルは常に「鬼頭の要求」（作者指定）。決着後の“付き合い”だけは別
  $('mikajimeTitle').textContent = ally ? '🤝 鬼頭の“付き合い”' : '🚬 鬼頭の要求';
  $('mikajimeInfo').innerHTML = ally
    ? `顔なじみになった鬼頭が、若い衆を連れて上機嫌でやってきた。<br><br>` +
      `「よぉ大将、景気はどうだ。今日は<b>付き合い</b>で ${yen(amount)}、頼むわ。<br>` +
      `なぁに、俺と付き合っときゃ、この辺で悪さする奴はいねえよ。」<br><br>` +
      `<span class="mika-note">断ってもいい。壊されはしないが、せっかくの顔を潰すことになる。</span>`
    : firstMeet
    ? `入口に横付けされたベンツから、上等なスーツの大男が降りてきた。あご髭に、酷薄そうな目。<br><br>` +
      `「よぉ。この辺を仕切ってる<b>鬼頭</b>ってもんだ。……<b>刺青お断り</b>にしたそうじゃねえか。<br>` +
      `うちの若いのが、暖簾の前で追い返されてな。恥をかかされたわけだ。」<br>` +
      `「<b>俺たちを入れねえってんなら、みかじめ料をもらうぞ。</b>${yen(amount)}。<br>` +
      `払っときゃ、お前んとこの“お客”は俺らが見といてやるよ。」<br><br>` +
      `<span class="mika-note">断ると、バットを持った若い衆が上がってきて設備を叩き壊す。</span>`
    : `また鬼頭組の若い衆だ。肩で風を切って入ってくる。<br><br>` +
      `「よぉ大将、集金の時間だ。<b>みかじめ料</b>、${yen(amount)}。」<br><br>` +
      `<span class="mika-note">断ると、バットを持った若い衆が上がってきて設備を叩き壊す。</span>`;
  $('btnMikaPay').textContent = `払う（${yen(amount)}）`;
  // 手切れ金（500万で即解決）は毎回の要求画面に並べる（作者指定の新フロー）。付き合いの集金では出さない
  const po = $('btnMikaPayoff');
  po.style.display = ally ? 'none' : '';
  po.disabled = G.cash < KITO_PAYOFF;
  po.textContent = `💴 大金で手を切る（${yen(KITO_PAYOFF)}）` + (G.cash < KITO_PAYOFF ? '…資金不足' : '');
  $('mikajimeModal').classList.remove('hidden');
}
/* 「鬼頭の要求」画面から手切れ金を選んだ＝その場でヤクザ問題を決着させる */
function payoffFromMika() {
  if (G.cash < KITO_PAYOFF) return;
  $('mikajimeModal').classList.add('hidden');
  G.mika = null;
  resolveKito('payoff');   // 支払い・解決処理・結末画面はここが担う（閉じると見送り→営業再開）
}
/* 来た時の姿（ベンツの本人／歩いてきた若い衆）に合わせて帰らせる */
function seeOffMika() {
  if (G.mika && G.mika.inPerson) { releaseBenz(); return; }   // 強面が乗り込み、ベンツは左へ去る
  const n = G.npcs.find(v => v.role === 'visit'); if (n) sendNpcHome(n);
}
function endMikajime() {
  $('mikajimeModal').classList.add('hidden');
  seeOffMika();   // 去るのを待たずに営業は再開する
  G.mika = null;
  resumeBiz();
}
/* 断ったあと、若い衆がバットを提げて店に上がってくる（叩き壊してから引き上げる） */
function endMikajimeWithRaid(targets) {
  $('mikajimeModal').classList.add('hidden');
  // 叩き壊しているあいだは止めたまま（見せ場）。若い衆が引き上げたら、来た時の見送りは待たずに再開する
  seeOffMika();
  G.mika = null;
  startRaid(targets, 'break', () => { resumeBiz(); saveGame(); });
}
function payMikajime() {
  G.flags.lastMikaDay = G.day;      // 集金は7日ごと（作者指定）。払っても断っても、次は7日後
  const amount = G.mika ? G.mika.amount : 0;
  G.cash -= amount;
  G.today.mikajime = (G.today.mikajime || 0) + amount;
  if (G.kito) {
    G.kito.paid++; G.kito.encounters++; G.kito.paidTotal += amount;
    // 新フロー：2回目の集金が済んだら、翌日に田所が異変を察して声をかけてくる（打ち明け→3回目で田所が動く）
    if (G.kito.encounters >= 2 && !G.kito.resolved && !G.flags.tadokoroConsulted) G.flags.tadokoroConsultDay = G.day + 1;
  }
  log(`💸 みかじめ料 ${yen(amount)}を払った。連中は満足げに帰っていった`);
  toast(`みかじめ料 ${yen(amount)}を払った…`);
  Sfx.play('pay');   // 修理業者への支払いと同じ音（マイナスの現象なので、chariinの「儲け」音は使わない）
  endMikajime(); saveGame();
}
function refuseMikajime() {
  G.flags.lastMikaDay = G.day;      // 集金は7日ごと（作者指定）。払っても断っても、次は7日後
  // 「付き合い」の集金（決着後・味方）を断った場合は壊されない。顔を潰すだけ
  if (G.mika && G.mika.ally) {
    log('💢 鬼頭の“付き合い”を断った。若い衆が舌打ちして引き上げていった');
    toast('鬼頭の顔を潰してしまった…');
    endMikajime(); saveGame(); return;
  }
  // 断ると腹いせに、バットを持った若い衆が上がってきて設備を叩き壊していく
  const cands = G.equip.filter(e => e.id !== 'bandai' && EQ[e.id].cat !== 'amenity' && e.cond > 0);
  const targets = [];
  const n = Math.min(irand(1, 2), cands.length);
  for (let i = 0; i < n; i++) targets.push(...cands.splice(Math.floor(Math.random() * cands.length), 1));
  if (G.kito) {
    G.kito.refused++; G.kito.encounters++; G.kito.destroyed += targets.length;
    // 断っても回数は進む＝2回目のあと田所が声をかけ、3回目は田所が割って入る（新フロー）
    if (G.kito.encounters >= 2 && !G.kito.resolved && !G.flags.tadokoroConsulted) G.flags.tadokoroConsultDay = G.day + 1;
  }
  if (targets.length) {
    log('💢 みかじめを断った。若い衆がバットを持って降りてきた…');
    endMikajimeWithRaid(targets);
  } else {
    log('💢 みかじめを断った。連中は捨て台詞を吐いて帰っていった');
    toast('連中は捨て台詞を吐いて帰っていった');
    endMikajime();
  }
  saveGame();
}

/* ============ ボス「鬼頭」との決着（分岐） ============ */
/* ※セリフは叩き台＝作者リライト前提 */
const KITO_PAYOFF = 5000000;   // 大金で手を切る一括額（500万円）
/* 「札を下ろして受け入れる」結末を選んだ店に乗る、店の格への固定ペナルティ（作者指定）。
   -30 は「投票対決（評判65）には事実上届かない」重さ＝物語は進むが第1章はクリアできない道 */
const KITO_ACCEPT_PEN = 30;
/* 世界一の熱波師が常駐している店、という格（作者指定＝決戦仕様の一台＋熱波師で評判90を超えさせる）。
   設備ではなく「人」なので充実度の内訳では独立した行にして、何がそこまで効いたのかを見えるようにする */
const NAPPA_GRADE = 45;
const KITO_OUT = {
  payoff: {
    title: '💴 金で、縁を切った',
    log: `鬼頭に${'¥' + KITO_PAYOFF.toLocaleString('ja-JP')}を払って手を切った`,
    text: `耳を揃えて渡すと、鬼頭は札を数えもせず懐に入れた。<br>` +
      `「話の分かる大将で助かるよ。もう来ねえ。あんたの店に用はねえ」<br><br>` +
      `後味は良くない。だが、これで集金は終わりだ。静かな夜が戻ってくる。`,
  },
  /* 旧「顔を立てて付き合う（話をつける）」。作者指定で「みかじめ料を払う」に改名＝
     ハッピーエンドではない。縁は切れず、以後も週1でみかじめの集金が続く。選択後の湯船の映像も流さない */
  ally: {
    title: '💸 みかじめ料を、払い続けることにした',
    log: '鬼頭と事は構えず、みかじめ料を払い続けることを選んだ',
    text: `「毎度きっちり払う度胸、嫌いじゃねえ」。鬼頭は札を数えもせず懐に入れ、口の端だけで笑った。<br>` +
      `「これからも“よろしく”頼むぜ、大将。困ったことがありゃ、俺の名を出しな」<br><br>` +
      `事は荒立てずに済んだ。だが、縁が切れたわけでもない。<br>` +
      `<span class="mika-note">以後も週に一度ほど、鬼頭が集金に顔を出す。決着ではない――金で、時間を買っただけだ。</span>`,
  },
  // ※「田所が割って入る」決着はモーダルではなく特別シーン3枚（STORY_KITO_RESCUE）に置き換えた（作者指定）
};
/* フェーズ4：決着3回目＝田所が割って入る特別シーン（①みかじめ要求→②田所が止める→③感謝）。
   シーンが終わったら、その場でヤクザ問題解決 */
function startKitoRescue() {
  Sfx.bgmStop();
  Story.play(STORY_KITO_RESCUE, () => {
    const k = G.kito;
    k.resolved = true; k.outcome = 'tadokoroHelp';
    if (G.solved) G.solved.yakuza = true;
    G.flags.kitoEndDay = G.day;   // 鬼頭が来なくなった日。黒田はこの10日後から（作者指定）
    startMissionCooldown();   // 鬼頭編クリア→次のミッションまで10日空ける（作者指定）
    addRep(6);
    log('🧓 田所が鬼頭を追い返してくれた。もう、集金は来ない');
    toast('🧓 田所が鬼頭を追い返した！（ヤクザ問題・解決）');
    dismissVisitor(); updateTopbar(); saveGame();
  });
}
/* 鬼頭との決着も「本人が歩いて店に来る」形（dueKitoShowdown→startVisit）で始まる */
/* フェーズ3：みかじめ2回の翌日、田所が声をかけてくる（→翌日、鬼頭との決着へ）。※セリフは叩き台 */
function openTadokoroConsult() {
  $('tadokoroTitle').textContent = '🧓 田所源造';
  $('tadokoroInfo').innerHTML =
    `湯上がりの田所が番台の前で足を止め、じっとこちらの顔を見た。<br><br>` +
    `「おい、最近困ってることはないか？　……顔色が悪いぞ。」`;
  const box = $('tadokoroChoices'); box.innerHTML = '';
  const b1 = document.createElement('button');
  b1.className = 'big-btn';
  b1.innerHTML = `😔 実は…ヤクザにみかじめ料を払ってるんです…<br><span class="opt-sub">田所に打ち明ける</span>`;
  b1.onclick = () => {
    $('tadokoroInfo').innerHTML =
      `「なんだと？　……鬼頭の野郎か。」<br><br>` +
      `田所の眉が、見たことのない角度で吊り上がった。<br><br>` +
      `「いいか、<b>今度は俺に相談しろ</b>。この街の湯は、親父さんの代から、わしらが守ってきたんだ。」`;
    box.innerHTML = '';
    const b2 = document.createElement('button');
    b2.className = 'big-btn';
    b2.innerHTML = `🙇 …はい<br><span class="opt-sub">明日から、けじめの話が始まる気がする</span>`;
    b2.onclick = () => {
      $('tadokoroModal').classList.add('hidden');
      G.flags.tadokoroConsulted = true;
      G.flags.tadokoroConsultDay = 0;
      G.kito.nextShowdownDay = G.day + 1;
      log('🧓 田所にみかじめの件を打ち明けた。「今度は俺に相談しろ」');
      toast('🧓 田所が気に掛けてくれている。明日から、鬼頭とのけじめの話が始まる');
      dismissVisitor(); saveGame();
    };
    box.appendChild(b2);
  };
  box.appendChild(b1);
  $('tadokoroModal').classList.remove('hidden');
}

/* フェーズ3：「刺青・ヤクザお断り」を下ろした翌日、鬼頭が礼を言いに来る。※セリフは叩き台 */
function openKitoThanks() {
  G.flags.kitoThanksDay = 0;
  $('kitoTitle').textContent = '🚬 鬼頭';
  $('kitoInfo').innerHTML =
    `お断りの札が消えた入口を、鬼頭がゆっくりとくぐってきた。今日は若い衆を連れていない。<br><br>` +
    `「……札、下ろしたんだってな。」<br><br>` +
    `鬼頭は番台に小銭を置き、少しだけ目を伏せた。<br><br>` +
    `「<b>ありがとな。もう悪いことはしねえよ。</b>」<br><br>` +
    `鬼頭は湯気の向こうへ消えていった。みかじめの話は、二度と出なかった。<br><br>` +
    `<span class="mika-note">これで鬼頭とのけじめは付いた。もう札は掲げられない（受け入れると約束したのだから）。` +
    `代わりに、この店は「そういう店」として街に知られる ——<b>評判 -${KITO_ACCEPT_PEN}</b></span>`;
  const box = $('kitoChoices'); box.innerHTML = '';
  const b = document.createElement('button');
  b.className = 'big-btn';
  b.innerHTML = `…ゆっくりしていってくれ<br><span class="opt-sub">これも、ひとつの終わらせ方だ</span>`;
  b.onclick = () => {
    $('kitoModal').classList.add('hidden');
    resolveKitoByAccept();
    dismissVisitor(); saveGame();
  };
  box.appendChild(b);
  $('kitoModal').classList.remove('hidden');
}

/* 【第3の結末】札を下ろして彼らを受け入れる（作者指定＝案a）。
   鬼頭との縁は切れないが、けじめは付いた扱いにする＝物語は先へ進み、黒田編が始まる。
   ただし代償は重い。強面の客が出入りする店として街に知れ渡り、店の格が -30 される。
   これは事実上「投票対決（評判65）には届かない」＝第1章はクリアできない道。
   抜け道を塞ぐため、以後「刺青・ヤクザお断り」は掲げられない（受け入れると約束したのだから）。 */
function resolveKitoByAccept() {
  const k = G.kito; if (!k || k.resolved) return;
  k.resolved = true;
  k.endedBy = 'accept';
  k.ally = false;                              // 集金には来ない＝みかじめの取り立ては完全に終わる
  if (G.solved) G.solved.yakuza = true;
  G.opts.banYakuza = false;
  log('🚬 鬼頭と和解した。もう取り立ては来ない。だが、この店は「そういう店」になった');
  toast('🚬 けじめは付いた。だが街の目は冷たい（評判が大きく下がる）');
}
// 受け入れる形で決着したか＝格に重い罰が乗り、お断りの札も掲げられなくなる
function kitoAccepted() { return !!(G.kito && G.kito.endedBy === 'accept'); }

function buildKitoShowdown() {
  const k = G.kito;
  $('kitoTitle').textContent = '🚬 鬼頭との決着';
  $('kitoInfo').innerHTML =
    `鬼頭の集金は止まらない。` +
    (k.paidTotal ? `これまで払ったみかじめは <b>${yen(k.paidTotal)}</b>。` : '') +
    (k.destroyed ? `壊された設備は <b>${k.destroyed}点</b>。` : '') +
    `<br>そろそろ、けじめを付けるときだ。どう終わらせる？`;
  const box = $('kitoChoices'); box.innerHTML = '';
  // フェーズ4：1〜2回目の決着に「田所に相談する」は無い（作者指定）。田所が動くのは3回目
  const opts = [
    { id: 'payoff', label: `💴 大金で手を切る（${yen(KITO_PAYOFF)}）`, ok: true,
      sub: 'きっぱり縁を切る。静かな夜が戻る' },
    { id: 'ally',   label: '💸 みかじめ料を払う', ok: k.paid >= 2,
      sub: k.paid >= 2 ? '事は構えない。ただし以後も週1でみかじめの集金が続く' : '🔒 みかじめを2回以上払うと選べる' },
    { id: 'hold',   label: '…今日は決めない', ok: true,
      sub: '設備をひとつ、鬼頭の若い衆に壊される' + ((k.showdowns || 0) >= 2 ? '。……田所が、何か言いたげにこちらを見ていた' : '') },
  ];
  for (const o of opts) {
    const b = document.createElement('button');
    b.className = 'big-btn'; b.disabled = !o.ok;
    b.innerHTML = `${o.label}<br><span class="opt-sub">${o.sub}</span>`;
    b.onclick = () => resolveKito(o.id);
    box.appendChild(b);
  }
}
function resolveKito(id) {
  const k = G.kito;
  if (id === 'hold') {
    $('kitoModal').classList.add('hidden');
    k.nextShowdownDay = G.day + KITO_INTERVAL_DAYS;   // 見送ったら、次に来るのは7日後（作者指定）
    // 決着を2回見送ると、翌日に田所が異変を察して声をかけてくる（打ち明け→3回目の決着で田所が動く）
    if ((k.showdowns || 0) >= 2 && !G.flags.tadokoroConsulted) G.flags.tadokoroConsultDay = G.day + 1;
    // フェーズ2の罰ゲーム：先延ばしにするたび、若い衆が腹いせに設備をひとつ壊していく
    const cands = G.equip.filter(e => e.id !== 'bandai' && EQ[e.id].cat !== 'amenity' && e.cond > 0);
    if (cands.length) {
      const it = pick(cands);
      breakEquip(it, true);   // 壊されたぶんは手加減なし＝必ず大規模修理
      k.destroyed = (k.destroyed || 0) + 1;
      log(`💥 決着を先延ばしにした腹いせに、${EQ[it.id].name}を壊された`);
      toast(`💥 ${EQ[it.id].name}を壊された…（決着を先延ばしにした代償）`);
    }
    dismissVisitor(); saveGame(); return;
  }
  // 街ぐるみ・親父ルートは廃止。残る3つの決着（金・みかじめ継続・田所）はどれも確実に決まる
  if (id === 'payoff') G.cash -= KITO_PAYOFF;
  k.resolved = true; k.outcome = id;
  if (G.solved) G.solved.yakuza = true;   // ヤクザ問題クリア（どの結末でも鬼頭とのけじめは付いた）
  G.flags.kitoEndDay = G.day;             // 鬼頭との決着が付いた日。黒田はこの10日後から（作者指定）
  if (id === 'ally') { k.ally = true; k.lastAllyDay = G.day; }
  startMissionCooldown();                 // 鬼頭編に区切り→次のミッションまで10日空ける（作者指定）
  const out = KITO_OUT[id];
  $('kitoTitle').textContent = out.title;
  $('kitoInfo').innerHTML = out.text;
  const box = $('kitoChoices'); box.innerHTML = '';
  const b = document.createElement('button'); b.className = 'big-btn'; b.textContent = 'とじる';
  b.onclick = () => {
    $('kitoModal').classList.add('hidden');
    // 「もう来ねえ」の湯船の二人芝居（別れの映像）は、本当に縁が切れる決着＝手切れ金の時だけ。
    // 「みかじめ料を払う」は集金が続く＝別れの映像を流すと嘘になるので流さない（作者指定）
    if (id === 'payoff') bathCutThen(STORY_KITO_BOND, 'bathKitoBond', () => { dismissVisitor(); updateTopbar(); });
    else { dismissVisitor(); updateTopbar(); }
  };
  box.appendChild(b);
  log('🚬 ' + out.log);
  saveGame();
}

/* ============ ライバル①「田所源造」＝地域・伝統（古参常連の顔）／常連客問題を統合 ============ */
/* ※セリフは叩き台。倒す敵でなく“味方に引き込む”。「共存」を選び続け、常連の絆と評判を育てると認める */
function tadokoroAllyOn() { return !!(G.tadokoro && G.tadokoro.ally); }
/* 田所が割って入る番かどうか（作者指定 8/5）＝【田所が主人公を認めた】×【みかじめ3回以上 または 来訪5回以上】。
   認められていないうちは、何回来られても、何回払っても助けは来ない */
function kitoRescueReady() {
  const k = G.kito;
  return !!(k && !k.resolved && tadokoroAllyOn()
    && ((k.paid || 0) >= KITO_RESCUE_PAID || (k.encounters || 0) >= KITO_RESCUE_VISITS));
}
/* 田所の来訪：初対面 → 要求（無茶ぶり）→ 達成報告 → …を3回 → 認められる */
/* 湯船の二人芝居を一度だけ流してから本題（モーダル）を開く。
   フラグで「その場面で一度きり」を保証する＝毎回の来訪で繰り返さない */
function bathCutThen(scenes, flagKey, next) {
  if (!scenes || G.flags[flagKey]) { next(); return; }
  G.flags[flagKey] = true;
  Sfx.bgmStop();
  Story.play(scenes, next);
}
/* 鬼頭のあと、黒田が来るまでの繋ぎの一幕（作者指定）。
   1度目は「古参とサウナーの衝突」、2度目は「田所の、不器用な手伝い（水漏れ）」を1回ずつ */
function openTadokoroFiller() {
  const t = G.tadokoro;
  t.fillerNow = true;
  openTadokoro((t.filler || 0) === 0 ? 'eventA' : 'eventB');
}
function openTadokoroVisit() {
  const t = G.tadokoro;
  // 名乗り（hello）は初日の夜に会話画面だけで済ませる（afterReport）。ここには hello 前では来ない
  if (!t.hello) { resumeAfterVisit(); return; }
  if (!t.met) { openTadokoro('intro'); return; }
  // 「田所が認める」場面は夜に移した（maybeTadokoroKessenNight）。昼の来訪ではもう起こさない
  const d = demandOf('tadokoro');
  if (d && demandMet(d)) { openTadokoro('done', d); return; }
  // フェーズ2：確認は2回まで。1回目は「まだ間に合う」の猶予、2回目で応えられていなければ罰ゲーム
  if (d) { openTadokoro((t.holdCount || 0) >= 1 ? 'nagFinal' : 'nag', d); return; }
  const nd = pickDemand('tadokoro');
  if (nd) { openTadokoro('ask', nd); return; }
  openTadokoro(Math.random() < 0.5 ? 'eventA' : 'eventB');   // 要求が尽きたら、日常の一幕（共存を問う）
}
const TADOKORO_TEXT = {
  // 1営業日目の顔合わせ（作者指定）。要求は出さない＝「先に名乗らせてから、後で突きつける」
  hello: {
    title: '🧓 古株の常連',
    info: `暖簾を出して間もなく、白髪に太い眉の爺さんが、勝手知ったる足取りで入ってきた。<br>` +
      `番台の前で立ち止まり、じろりとこちらを見上げる。<br><br>` +
      `「わしは<b>田所</b>。親父さんの代から40年、この湯に通っとる。<br>` +
      `お前さんがガキの頃から知っとるよ。番台の脇で寝こけとったのを、わしが起こしてやったんだ。」<br><br>` +
      `「……お前さんが夕凪湯を継ぐのは構わん。構わんがな。<br>` +
      `<b>わしらの憩いの場を、壊さんでくれよ。</b>」<br><br>` +
      `<span class="mika-note">言うだけ言って、田所は下足箱の方へ歩いていった。</span>`,
  },
  intro: {
    title: '🧓 田所源造',
    info: `湯上がりの田所が、番台の前で足を止めた。じろりとこちらを見据える。<br><br>` +
      `「……で、だ。一度、ちゃんと聞いておきたかった。<br>` +
      `<b>お前は、この銭湯をどうするつもりなんだ？</b><br>` +
      `サウナだ何だと若いのが騒がしいが……昔からの客の居場所は、どうなる。」<br><br>` +
      `<span class="mika-note">この店を、どういう湯にしていく？</span>`,
  },
  eventA: {
    title: '🧓 古参とサウナーの衝突',
    info: `夕方、脱衣所で古参客と若いサウナーが揉めていた。「長湯だ」「マナーがなってない」と一触即発。田所がこちらを睨む。<br><br>` +
      `「ほら見ろ。新しい客と古い客は、水と油だ。大将、どうするつもりだ。」<br><br>` +
      `<span class="mika-note">この店の作法を、どちらに寄せる？</span>`,
  },
  eventB: {
    title: '🧓 田所の、不器用な手伝い',
    info: `閉店間際、田所が古い配管の水漏れを黙って直しているのを見つけた。<br><br>` +
      `「……昔取った杵柄だ。この店の配管は図面にないクセがある。わししか知らん。」<br><br>` +
      `照れ隠しに悪態をつく田所。少しずつ、心を開きかけている。<br>` +
      `<span class="mika-note">どう応える？</span>`,
  },
  kessen: {
    title: '🧓 田所が、認めた',
    info: `常連の絆が戻り、店も評判を集めるようになったある日。田所が湯上がりに、番台の前で足を止めた。<br><br>` +
      `「……新しい客も古い客も、みんないい顔で帰っていく。<br>` +
      `お前さんは、変えちゃいけないものを、ちゃんと残しやがった。<br>` +
      `参ったよ。この湯は――親父さんの夕凪湯のまま、ちゃんと前へ進んでる。」<br><br>` +
      `田所は照れくさそうに笑い、常連たちの顔役として、店の力になってくれることになった。<br>` +
      `<span class="mika-note">✅ 田所と常連の心を、取り戻した（仲間に：地元客↑・満足度↑・維持/修理費↓）</span>`,
  },
};
function openTadokoro(kind, d) {
  const t = G.tadokoro;
  if (kind === 'intro') { t.met = true; G.flags.tadokoroMet = true; }
  const box = $('tadokoroChoices'); box.innerHTML = '';
  const addBtn = (label, sub, fn) => {
    const b = document.createElement('button');
    b.className = 'big-btn'; b.innerHTML = `${label}<br><span class="opt-sub">${sub}</span>`;
    b.onclick = fn; box.appendChild(b);
  };
  if (kind === 'ask' || kind === 'done' || kind === 'nag' || kind === 'nagFinal') {
    const n = (t.done || 0) + 1;
    $('tadokoroTitle').textContent = kind === 'done' ? '🧓 田所が、ちょっとだけ笑った'
      : kind === 'nagFinal' ? '🧓 田所が、いよいよ愛想を尽かしかけている' : `🧓 田所の“注文”（${n}件目）`;
    if (kind === 'ask') {
      $('tadokoroInfo').innerHTML = `田所が番台の前で腕を組み、店をぐるりと見回した。<br><br>${d.ask}<br><br>` +
        `<span class="mika-note">📌 ${demandLabel(d)}　→ 次に田所が来た時に見せれば、認めてもらえる</span>`;
      addBtn('🧓 …わかった、やってみる', '要求を引き受ける（達成すると常連との絆↑・評判↑）', () => resolveTadokoro('accept', d));
      addBtn('🙅 今回は勘弁してくれ', '断る（田所は不機嫌になる・常連との絆↓）', () => resolveTadokoro('refuse', d));
    } else if (kind === 'done') {
      $('tadokoroInfo').innerHTML = `${d.ok}<br><br><span class="mika-note">✅ ${demandLabel(d)}　――田所の注文をひとつ、こなした</span>`;
      addBtn('とじる', `常連との絆↑・評判↑（叶えた注文 ${(t.done || 0) + 1}/${TADOKORO_DEMAND_CLEAR}）`, () => resolveTadokoro('clear', d));
    } else if (kind === 'nagFinal') {
      $('tadokoroInfo').innerHTML = `田所の目つきが、いつもよりずっと鋭い。番台に肘をつき、じろりとこちらを見る。<br><br>` +
        `「……<b>${demandLabel(d)}</b>、まだ手をつけとらんのか。前も同じことを言ったよな。<br>` +
        `口ばっかりの若いのは、山ほど見てきた。この店から、常連が離れていくのを黙って見とるわけにはいかん。」<br><br>` +
        `<span class="mika-note">⚠ ${demandLabel(d)}　――これが最後の猶予。応えられなければ常連が離れる</span>`;
      addBtn('とじる', '肝に銘じる（応えられていなければ、常連の足が遠のく）', () => resolveTadokoro('holdFinal', d));
    } else {
      $('tadokoroInfo').innerHTML = `田所はまだ不機嫌そうだ。番台に肘をつき、じろりとこちらを見る。<br><br>` +
        `「……で、この前の話はどうなった。<b>${demandLabel(d)}</b>、まだだろう。<br>口ばっかりの若いのは、山ほど見てきたんでな。」<br><br>` +
        `<span class="mika-note">📌 ${demandLabel(d)}</span>`;
      addBtn('とじる', 'まだ間に合う。やっておこう', () => resolveTadokoro('hold', d));
    }
    $('tadokoroModal').classList.remove('hidden');
    return;
  }
  const TX = TADOKORO_TEXT[kind];
  $('tadokoroTitle').textContent = TX.title;
  $('tadokoroInfo').innerHTML = shopify(TX.info);
  if (kind === 'hello') {
    // 顔合わせだけ。ここでは何も要求されないし、選択肢もない（後の“注文”への布石）
    addBtn('🧓 ……ああ、覚えてるよ', '田所と顔を合わせた（この店の古株だ）', () => resolveTadokoro('hello'));
  } else if (kind === 'kessen') {
    addBtn('とじる', '田所が仲間になった', () => resolveTadokoro('kessen'));
  } else {
    /* 選択肢は場面ごとに変える（作者指摘）。中身（絆を取るか、評判を取るか）は同じでも、
       水漏れを直してもらった場面で「サウナ路線を貫く」と答えるのは、話が噛み合っていない */
    const CH = {
      intro:  [['🤝 昔からの湯を守る', '古い常連の居場所を残すと約束する（絆↑）'],
               ['🔥 サウナで新しい客を呼ぶ', '正直に路線を告げる（評判↑・田所は渋い顔）']],
      eventA: [['🤝 古参の作法に合わせる', '長湯も昔からの流儀だと収める（絆↑）'],
               ['🔥 サウナーの作法を通す', '新しい客のマナーを店の基準にする（評判↑）']],
      eventB: [['🤝 礼を言って、教えを乞う', 'この店の配管を教わる（絆↑）'],
               ['🔥 業者を呼ぶから無理はするな', '筋を通して断る（評判↑・田所は渋い顔）']],
    };
    const c = CH[kind] || CH.intro;
    addBtn(c[0][0], c[0][1], () => resolveTadokoro(kind, 'kyozon'));
    addBtn(c[1][0], c[1][1], () => resolveTadokoro(kind, 'kaikaku'));
  }
  $('tadokoroModal').classList.remove('hidden');
}
function resolveTadokoro(kind, arg) {
  const t = G.tadokoro;
  $('tadokoroModal').classList.add('hidden');
  if (kind === 'hello') {
    t.hello = true; t.nextDay = G.day + irand(0, 1);
    G.najimi = clamp(G.najimi + 2, 0, 100);          // 顔を合わせただけでも、常連との糸は繋がる
    log('🧓 古株の田所源造と顔を合わせた。「憩いの場を壊してくれるな」');
    toast('🧓 田所源造――親父さんの代からの常連だ');
  } else if (kind === 'kessen') {
    t.resolved = true; t.ally = true;
    if (G.solved) G.solved.tadokoro = true;
    startMissionCooldown();   // 田所編クリア→次のミッションまで10日空ける（作者指定）
    log(`🧓 田所が${G.name}を認めた。常連の心が戻り、田所が店の力になってくれる`);
    toast('田所が仲間に！ 地元客↑・満足度↑・維持/修理費↓');
  } else if (kind === 'accept') {
    // フェーズ2：要求→翌日チェック→…のサイクルにする（頻度アップ、作者指定で1日ごとに）
    t.demand = arg.key; t.holdCount = 0; t.nextDay = G.day + 1;
    toast(`🧓 田所の注文：${demandLabel(arg)}`);
    log(`🧓 田所から注文を受けた：${demandLabel(arg)}`);
  } else if (kind === 'refuse') {
    G.najimi = clamp(G.najimi - 4, 0, 100); t.nextDay = G.day + 1;   // 断っても翌日また来る（作者指定）
    toast('田所は舌打ちして帰っていった（常連との絆↓）');
  } else if (kind === 'clear') {
    t.doneKeys = (t.doneKeys || []).concat([arg.key]);
    t.done = (t.done || 0) + 1; t.demand = null; t.holdCount = 0; t.nextDay = G.day + 1;
    G.najimi = clamp(G.najimi + DEMAND_NAJIMI_GAIN, 0, 100);
    addRep(DEMAND_REP_GAIN);
    toast(`✅ 田所の注文をこなした（${t.done}/${TADOKORO_DEMAND_CLEAR}）常連との絆↑・評判↑`);
    log(`🧓 田所の注文をこなした（${demandLabel(arg)}）`);
  } else if (kind === 'hold') {
    // フェーズ2：1回目の未達成はまだ猶予（軽い減点のみ）。次に来た時も未達成なら罰ゲームへ
    t.holdCount = (t.holdCount || 0) + 1;
    G.najimi = clamp(G.najimi - 2, 0, 100);
    t.nextDay = G.day + 1;
  } else if (kind === 'holdFinal') {
    // フェーズ2の罰ゲーム：2回連続で応えられなかった＝常連の足が一時的に遠のく
    G.najimi = clamp(G.najimi - 6, 0, 100);
    G.tadokoroPenaltyUntil = G.day + 5;
    t.demand = null; t.holdCount = 0; t.nextDay = G.day + 1;
    log(`🧓 田所の要求（${demandLabel(arg)}）に応えられず、常連の足が遠のいた`);
    toast('🧓 常連客の足が遠のいた…（しばらく客足-10%）');
  } else {
    if (arg === 'kyozon') { G.najimi = clamp(G.najimi + TADOKORO_KYOZON_GAIN, 0, 100); toast('田所との距離が縮まった（常連との絆↑）'); }
    else { addRep(3); toast('サウナ路線で評判↑（田所は渋い顔だ）'); }
    t.stage = Math.max(t.stage || 0, 1);
    t.nextDay = G.day + 1;
    // 鬼頭〜黒田のあいだの繋ぎで来ていた回は、その回数を数えて次を4日後に置く
    if (t.fillerNow) { t.filler = (t.filler || 0) + 1; t.fillerDay = G.day + 3; t.fillerNow = false; }
  }
  dismissVisitor();
  updateTopbar(); saveGame();
}

/* ============ ライバル「黒田修司」（同級生・数字/継続）＝味方に引き込む ============ */
/* エリート会社員の同級生。銭湯を「数字で詰んでる商売」と見下す。経営重視の選択を重ね、
   数字（直近5日で3日黒字／手元50万＋／健全経営）を2つ以上示すと、逃げていた自分に気づいて認め、仲間になる */
function kurodaAllyOn() { return !!(G.kuroda && G.kuroda.ally); }
// 黒田が認める「数字」の3条件のうち、いま満たしている数を返す
function kurodaBiz() {
  const hist = Array.isArray(G.recentProfits) ? G.recentProfits : [];
  const profitDays = hist.filter(p => p > 0).length;                       // 直近5日の黒字日数
  const c1 = profitDays >= 3;                                              // ①直近5日で3日以上黒字
  const c2 = G.cash >= KURODA_CASH_OK;                                     // ②手元資金50万以上
  // ③健全経営＝5日間、資金ショートで灰田に駆け込んでいないこと
  const c3 = (G.day - (G.lastShortfallDay || 0)) >= 5 && (!G.yami || G.yami.debt <= 0);
  return { c1, c2, c3, profitDays, count: [c1, c2, c3].filter(Boolean).length };
}
/* 黒田の来訪：初対面 → 高価な設備投資の要求 → 達成報告 → …を2回＋数字を示す → 認められる */
function openKurodaVisit() {
  const k = G.kuroda;
  if (!k.met) { bathCutThen(STORY_KURODA_MEET, 'bathKurodaMeet', () => openKuroda('intro')); return; }
  if (kurodaKessenOK()) { bathCutThen(STORY_KURODA_BOND, 'bathKurodaBond', () => openKuroda('kessen')); return; }
  const d = demandOf('kuroda');
  if (d && demandMet(d)) { openKuroda('done', d); return; }
  /* 届かない課題を永久に抱え込ませない（作者指定の狙い＝黒田編で待つだけの区間を作らない）。
     引き受けてから KURODA_DEMAND_GIVEUP 日たっても届かなければ、黒田が別の手を出し直す。
     通しシムでは「評判+3」「満足度65」が店の作りしだいで何十日も届かず、そこで止まっていた */
  /* 同じ課題で3回続けて空振りしたら、日数を待たずに別の手へ切り替える（作者指定）。
     3回来て3回とも届いていない＝その店の作りでは無理な筋、という見立て */
  if (d && ((G.day - (k.demandDay || 0)) >= KURODA_DEMAND_GIVEUP || (k.miss || 0) >= KURODA_MISS_SWAP)) {
    const alt = pickDemand('kuroda');
    if (alt && alt.key !== d.key) { openKuroda('swap', alt, d); return; }
  }
  if (d) { openKuroda('nag', d); return; }
  // まだ基準に届いていない課題がある限り、黒田は次の宿題を出す（達成済みのものは出さない）
  const nd = pickDemand('kuroda');
  if (nd) { openKuroda('ask', nd); return; }
  openKuroda('event');
}
const KURODA_TEXT = {
  intro: {
    title: '💼 黒田修司',
    info: `評判が界隈に広がってきた頃。仕立てのいいスーツの男が、革靴のまま暖簾をくぐってきた。<br><br>` +
      `「よう、久しぶりだな。……同窓会で聞いたぞ。お前、親父さんの<b>銭湯</b>を継いだんだって？<br>` +
      `<b>黒田</b>だよ、覚えてるだろ。悪いが、数字で見たら――こんな商売、とっくに詰んでる。」<br><br>` +
      `見下すような、それでいてどこか探るような目。<br>` +
      `<span class="mika-note">この男に、どう応える？</span>`,
  },
  event: {
    title: '💼 黒田の、値踏み',
    info: `黒田はまた来た。番台の前で、脱衣所を見回しながら電卓を叩く。<br><br>` +
      `「客単価、回転、光熱費……原価計算、ちゃんとやってるのか？<br>` +
      `情でやってける商売じゃないぞ。俺の会社なら、こんな数字は一日で切られる。」<br><br>` +
      `<span class="mika-note">どう応える？</span>`,
  },
  kessen: {
    title: '💼 黒田が、認めた',
    info: `黒字が続き、資金にも余裕が出てきたある日。黒田が渡した通帳と日報に、しばらく黙って目を落としていた。<br><br>` +
      `「……ちゃんと、数字になってるじゃないか。<br>` +
      `続けることが一番むずかしいって、口では言えても、実際にやれる奴はいない。お前は、やってる。」<br><br>` +
      `黒田は、めずらしく自嘲するように笑った。<br>` +
      `「――逃げてたのは、俺の方だったのかもな。<br>` +
      `会社の看板に隠れて、"安全な数字"の中でな。……いい店だよ、ここは。」<br><br>` +
      `黒田は経営の目線で、夕凪湯の力になってくれることになった。<br>` +
      `<span class="mika-note">✅ 数字と継続を証明し、黒田を認めさせた（仲間に：人件費・経費↓／会社員客↑）</span>`,
  },
};
function openKuroda(kind, d, oldD) {
  const k = G.kuroda;
  if (kind === 'intro') { k.met = true; G.flags.kurodaMet = true; }
  const box = $('kurodaChoices'); box.innerHTML = '';
  const addBtn = (label, sub, fn) => {
    const b = document.createElement('button');
    b.className = 'big-btn'; b.innerHTML = `${label}<br><span class="opt-sub">${sub}</span>`;
    b.onclick = fn; box.appendChild(b);
  };
  if (kind === 'swap') {
    // 届かない課題を、黒田のほうから引っ込める。プレイヤーを責めずに次の手へ移す
    $('kurodaTitle').textContent = '💼 黒田が、電卓を閉じた';
    $('kurodaInfo').innerHTML =
      `黒田は日報をめくり、しばらく黙っていた。<br><br>` +
      `「<b>${demandLabel(oldD)}</b>――この店の今の形じゃ、そこには届かんな。<br>` +
      `見立てを誤ったのは俺だ。筋を変える。」<br><br>${askText(d)}<br><br>` +
      (d.advice ? `<span class="opt-sub">「${d.advice}」</span><br><br>` : '') +
      `<span class="mika-note">📌 ${demandLabel(d)}<br>${demandNow(d)}</span>`;
    addBtn('💼 …やってやる', '課題を差し替える（前の課題はここで終わり）', () => resolveKuroda('accept', d));
    $('kurodaModal').classList.remove('hidden');
    return;
  }
  if (kind === 'ask' || kind === 'done' || kind === 'nag') {
    const price = d.need.type === 'equip' ? eqPrice(d.need.id) : 0;
    $('kurodaTitle').textContent = kind === 'done' ? '💼 黒田が、電卓を置いた' : `💼 黒田の“課題”（${(k.done || 0) + 1}件目）`;
    if (kind === 'ask') {
      $('kurodaInfo').innerHTML = `黒田は番台に電卓を置き、こちらの目を見ずに言った。<br><br>${askText(d)}<br><br>` +
        (d.advice ? `<span class="opt-sub">「――やり方が分からんとは言わせないぞ。${d.advice}」</span><br><br>` : '') +
        `<span class="mika-note">📌 ${demandLabel(d)}${price ? `（${yen(price)}）` : ''}` +
        (price ? `<br>💡 引き受ければ、黒田の口利きで<b>${Math.round(KURODA_DISCOUNT * 100)}%オフ</b>（課題を果たすまで）` : '') +
        `<br>${demandNow(d)}　→ 数字で示せば、黒田は認めざるを得なくなる</span>`;
      addBtn('💼 …やってやる', `引き受ける${price ? `（${Math.round(KURODA_DISCOUNT * 100)}%オフの ${yen(Math.round(price * (1 - KURODA_DISCOUNT)))}／通常${yen(price)}）` : ''}。達成で評判↑・数字↑`, () => resolveKuroda('accept', d));
      addBtn('🙅 今の身の丈じゃない', '断る（黒田は鼻で笑う）', () => resolveKuroda('refuse', d));
    } else if (kind === 'done') {
      $('kurodaInfo').innerHTML = `${fillGoal(d.ok, d)}<br><br><span class="mika-note">✅ ${demandLabel(d)}　――黒田の出した課題をひとつ、達成した</span>`;
      addBtn('とじる', `評判↑・数字を積む姿勢↑（達成した課題 ${(k.done || 0) + 1}/${KURODA_DEMAND_CLEAR}）`, () => resolveKuroda('clear', d));
    } else {
      $('kurodaInfo').innerHTML = `黒田はロビーを一瞥し、電卓を叩いた。<br><br>` +
        `「まだ<b>${demandLabel(d)}</b>、届いてないな。<br>言い訳は数字にならないぞ。」<br><br>` +
        (d.advice ? `<span class="opt-sub">「${d.advice}」</span><br><br>` : '') +
        `<span class="mika-note">📌 ${demandLabel(d)}　（${demandNow(d)}）</span>`;
      addBtn('とじる', '数字で示そう', () => resolveKuroda('hold', d));
    }
    $('kurodaModal').classList.remove('hidden');
    return;
  }
  const TX = KURODA_TEXT[kind];
  $('kurodaTitle').textContent = TX.title;
  $('kurodaInfo').innerHTML = shopify(TX.info);
  if (kind === 'kessen') {
    addBtn('とじる', '黒田が仲間になった', () => resolveKuroda('kessen'));
  } else {
    addBtn('📊 数字で示す', '経営者の顔で応える（数字を積む姿勢↑＝決戦に近づく）', () => resolveKuroda(kind, 'suuji'));
    addBtn('🤝 現場を見せる', '客と湯の温もりで返す（常連との絆↑・黒田は納得しない）', () => resolveKuroda(kind, 'genba'));
  }
  $('kurodaModal').classList.remove('hidden');
}
function resolveKuroda(kind, arg) {
  const k = G.kuroda;
  $('kurodaModal').classList.add('hidden');
  if (kind === 'kessen') {
    k.resolved = true; k.ally = true;
    if (G.solved) G.solved.kuroda = true;
    startMissionCooldown();   // 黒田編クリア→次のミッションまで10日空ける（作者指定）
    log(`💼 黒田が${G.name}の経営を認めた。数字の目線で店の力になってくれる`);
    toast('黒田が仲間に！ 人件費・経費↓／会社員客↑');
  } else if (kind === 'accept') {
    k.demand = arg.key; k.lastKey = arg.key;
    k.goal = computeGoal(arg);                    // 目標値はここで確定＝あとから逃げない
    k.demandDay = G.day;                          // 出し直しの判定に使う（届かないまま抱え込ませない）
    k.miss = 0;                                   // 空振りの回数はここから数え直す
    k.nextDay = G.day + 1;                        // 引き受けたら、黒田は翌日に確かめに来る（作者指定）
    // 黒田が話を通した品は、その日のうちだけ30%引きで入る（作者指定）
    k.discountKey = arg.need.type === 'equip' ? arg.need.id : null;
    k.discountDay = G.day;
    toast(k.discountKey ? `💼 ${EQ[k.discountKey].name}が今だけ${Math.round(KURODA_DISCOUNT * 100)}%オフ！（要求を果たすまで）`
                        : `💼 黒田の課題：${demandLabel(arg)}`);
    log(`💼 黒田から課題を受けた：${demandLabel(arg)}` +
      (k.discountKey ? `（黒田の口利きで今だけ${Math.round(KURODA_DISCOUNT * 100)}%オフ・要求を果たすまで）` : ''));
    if (k.discountKey && G.phase === 'prep') renderShop();
  } else if (kind === 'refuse') {
    k.lastKey = arg.key;      // 断られた品は、次にすぐ蒸し返さない（作者指定＝毎回ちがう提案をする）
    k.nextDay = G.day + 3;    // 断ったら、次に黒田が来るのは3日後（作者指定。周期はプレイヤーには見せない）
    toast('黒田は鼻で笑って帰っていった');
  } else if (kind === 'clear') {
    k.doneKeys = (k.doneKeys || []).concat([arg.key]);
    k.done = (k.done || 0) + 1; k.demand = null; k.goal = null;
    k.discountKey = null;                    // 揃ったら口利きの割引はおしまい
    k.stage = (k.stage || 0) + 1;
    k.miss = 0;
    k.nextDay = G.day + 1;                   // 果たした翌日には、次の課題を持って来る（作者指定）
    addRep(DEMAND_REP_GAIN + 1);
    toast(`✅ 黒田の課題を達成した（残り${kurodaTodo().length}件）評判↑・数字↑`);
    log(`💼 黒田の課題を達成した（${demandLabel(arg)}）`);
  } else if (kind === 'hold') {
    // 未達のまま帰った＝次に来るのは3日後（作者指定）。空振りを数えて3回で別の課題に切り替える
    k.miss = (k.miss || 0) + 1;
    k.nextDay = G.day + KURODA_NAG_DAYS;
  } else {
    /* 選択のあとにもうひと言（作者指定）。ここは何を選んでも、どんな経営状況でも必ず小言で終わる。
       この場面のあとはプレイヤーが黒田の指示を聞く側に回るので、「認めた」空気を作らない。
       借金 → 赤字 → 黒字の順に、刺さるところを突く */
    let follow;
    if (arg === 'suuji') {
      k.stage = (k.stage || 0) + 1;
      const last = G.recentProfits && G.recentProfits.length ? G.recentProfits[G.recentProfits.length - 1] : 0;
      const debt = (G.yami ? G.yami.debt : 0) + (G.debt || 0);
      follow = debt > 0
        ? `黒田は帳面をめくり、借入の行で指を止めた。<br><br>「……おい。<b>借金があるじゃないか。</b><br>${yen(debt)}。この規模の店で、これは軽くないぞ。<br>数字で語るなら、まずここを消してから言え。」<br><br><span class="opt-sub">（数字を積む姿勢↑。借金を抱えた店の言葉は、黒田には届かない）</span>`
        : last < 0
        ? `黒田は日報を一瞥して、電卓を叩く手を止めた。<br><br>「……<b>全然ダメじゃないか。</b>昨日の収支、赤字だぞ。数字は嘘をつかない。」<br><br><span class="opt-sub">（数字を積む姿勢↑。だが認めさせるには黒字を見せるしかない）</span>`
        : `黒田は日報にしばらく目を落とし、ふんと鼻を鳴らした。<br><br>「ほう、黒字か。……<b>だが一日の数字だ。これを何ヶ月続けられる？</b><br>続かない黒字は、ただの偶然だぞ。」<br><br><span class="opt-sub">（数字を積む姿勢↑。黒田はまだ認めていない）</span>`;
    } else {
      G.najimi = clamp(G.najimi + KURODA_KEIEI_GAIN_NAJIMI, 0, 100);
      follow = `黒田は湯気の向こうの常連たちを眺め、電卓をしまった。<br><br>「……情で湯は沸かないぞ。<br>だが、まあ。客のあの顔は、数字にならない資産だ。」<br><br><span class="opt-sub">（常連との絆↑。黒田はまだ納得していない）</span>`;
    }
    /* 出す宿題がもう無い＝鬼頭が片付いた時点で11の基準を全部満たしていた店。
       同じことを言い渡さず、そのまま「認めた」へ持っていく（作者指定＝挨拶だけで終わる） */
    k.nextDay = kurodaKessenOK() ? G.day : G.day + 1;
    $('kurodaTitle').textContent = '💼 黒田のひと言';
    $('kurodaInfo').innerHTML = follow;
    const box = $('kurodaChoices'); box.innerHTML = '';
    const b = document.createElement('button');
    b.className = 'big-btn'; b.textContent = '…とじる';
    b.onclick = () => { $('kurodaModal').classList.add('hidden'); dismissVisitor(); updateTopbar(); saveGame(); };
    box.appendChild(b);
    $('kurodaModal').classList.remove('hidden');
    saveGame();
    return;   // 小言を閉じた時に見送る
  }
  dismissVisitor();
  updateTopbar(); saveGame();
}

/* 親父の"ながら確執"＝新設備や借入のたびに、親父が電話口で軽く小言を言う（通奏低音）。
   全画面イベントにはせず log＋toast で軽く。評判が育つと口調が和らぎ、1日1回まで、エンディング後は言わない */
/* delaySec を渡すと、トーストだけ遅らせて出す。
   設備を置いた直後は「○○を設置した！」を先に読ませたいので、親父の小言は少し待たせる
   （即出しすると設置のトーストが一瞬で上書きされ、置いた実感が消える） */
function oyajiNag(kind, delaySec) {
  /* 親父の小言は**夕凪湯の話**（「銭湯にゃ要らん」「銭湯は身の丈だ」）。
     その台詞表（OYAJI_NAG）は第1章のデータで、章を切り替えても差し替わらない＝
     第2章で設備を置くたびに、出てくるはずのない親父から電話が掛かってきていた。
     CONF に oyajiNag: false を持つ章では黙らせる（第1章はこの欄を持たない＝従来どおり） */
  if (CONF.oyajiNag === false) return false;
  if (G.solved && G.solved.oyaji) return false;         // 和解後はもう小言を言わない
  if (G.day <= 1) return false;                          // 初日は控える（チュートリアル中）
  if (G.flags.lastOyajiNagDay === G.day) return false;   // 同じ日に何度も言わせない
  const set = OYAJI_NAG[kind]; if (!set) return false;
  const pool = (G.rep >= 50 ? set.yawa : set.karai);  // 評判が育つと口調が和らぐ（和解ゲージは廃止）
  if (!pool || !pool.length) return false;
  const line = pool[Math.floor(Math.random() * pool.length)].replace(/\{店名\}/g, G.name || 'うち');
  G.flags.lastOyajiNagDay = G.day;
  log('📞 親父：「' + line + '」');
  if (delaySec) setTimeout(() => toast('📞 親父：' + line), delaySec * 1000);
  else toast('📞 親父：' + line);
  saveGame();
  return true;
}

/* ============ ライバル「桐生玲奈」（蒼天SPA・設備/業界）＝味方に引き込む ============ */
/* 巨大スーパー銭湯の開発責任者。買収(2,000万)・引き抜き・競合圧で揺さぶる。孤高を貫き（買収を断り）、
   評判と“個性ある設備”を示すと、資本では買えない価値を認めて仲間になる。買収を受けると別エンド（売却）へ分岐 */
function reinaAllyOn() { return !!(G.reina && G.reina.ally); }
// 蒼天SPAの競合圧＝玲奈と出会って以降、仲間にする（resolved）まで客足が落ちる
function soutenPressureOn() { return !!(G.reina && G.reina.met && !G.reina.resolved); }
/* 蒼天SPAに吸われて、その日この店に来られる客数の上限（作者指定の段階制）。
   出会いから3日間は30人＝「駅前に化け物ができた」衝撃を、いきなり客数で突きつける。
   4日目の買収提案を断ると50人まで戻り、初戦に負けるとまた30人まで落ちる。
   決戦仕様の一台（◯◯スペシャル）を据えた時点で上限は消える＝勝てる土俵に立ったことが客足で分かる */
function soutenGuestCap() {
  const r = G.reina;
  if (!r || !r.met || r.resolved) return Infinity;
  if (hasWorking('sauna_sp')) return Infinity;                     // 決戦仕様の一台が据わったら完全復帰
  /* 常連たちが応援に来た日に上限は解ける（作者指定）。ここを塞いだままだと、
     上限30人＝固定費割れの赤字なので、決戦仕様の一台の代金がいつまでも貯まらない */
  if (G.flags.reinaOuen) return Infinity;
  if ((r.lost || 0) >= 1) return REINA_CAP_SHOCK;                  // 初戦敗北後は再び30人
  if (G.day - (r.metDay || 0) < 3) return REINA_CAP_SHOCK;         // 出会いから3日間
  return REINA_CAP_DUEL;                                            // 以降、初戦の敗北までは50人
}
/* 蒼天SPAの影に押されている日＝主人公が危機感を口にする（作者指定）。
   「客が減っている」と本人に言わせないと、上限で頭を押さえられていることが伝わらない */
function soutenCrisisOn() { return soutenGuestCap() !== Infinity && G.day > ((G.reina && G.reina.metDay) || 0); }
// 玲奈が認める“個性ある設備”＝本格サウナ＋水風呂に、資本店に負けない一級の設えが1つ以上
function reinaHasCharacter() {
  const has = id => G.equip.some(e => e.id === id && e.cond > 0);
  return hasCat('sauna') && hasCat('mizu') && REINA_PREMIUM_EQ.some(has);
}
// 一級設備（個性ある設え）の設置数＝投票の“ととのい票”に効く
function reinaPremiumCount() { return REINA_PREMIUM_EQ.filter(id => G.equip.some(e => e.id === id && e.cond > 0)).length; }
// 夕凪湯の獲得票＝評判・常連の絆・個性設備・孤高への共感・親父/田所の物語（規模では蒼天に届かないが、心で上回れる）
function computeYuVotes() {
  const r = G.reina || {};
  const v = G.rep * DUEL_W_REP + G.najimi * DUEL_W_NAJIMI
    + reinaPremiumCount() * DUEL_PREMIUM_V
    + Math.min(r.stage || 0, REINA_STAGE) * DUEL_W_KOKO
    + (nappaOn() ? DUEL_NAPPA_V : 0)                 // 世界一の熱波師＝再戦の切り札
    + G.roster.length * DUEL_STAFF_V                 // バイトと家族の票
    + DUEL_TOWN_V                                    // 修理業者・牛乳屋…店に関わってきた人たちの票
    + (tadokoroAllyOn() ? DUEL_TADOKORO_V : 0);
  return Math.round(v);
}
function computeSoutenVotes() { return Math.round(SOUTEN_DUEL_VOTES + rand(-15, 15)); }
/* 玲奈のうち“全画面で見せる節目”は夜（準備画面に入る前）に流す。
   ①蒼天SPAへの招待＝初登場 ②投票対決の中間発表 ③投票日の開票 */
function maybeReinaCinematic() {
  const r = G.reina;
  if (!r || r.resolved) return false;
  if (!r.met) {
    if (G.day >= (r.nextDay || 0) && G.rep >= REINA_APPEAR_REP && !!(G.kuroda && G.kuroda.resolved)) {
      // フェーズ3の導線（作者指定）：①夜のテレビ特集 → ②翌営業日に常連の噂 → ③その翌日、主人公が蒼天SPAを訪ねて玲奈と初対面
      if (!G.flags.reinaTV) {
        G.flags.reinaTV = 1;
        Story.play(STORY_TV_SOUTEN, () => { log('📺 テレビが駅前の巨大サウナ「蒼天SPA」を特集していた'); saveGame(); });
        return true;
      }
      if (G.flags.reinaTV === 2 && G.day > (G.flags.reinaRumorDay || 0)) { openReinaVisit(); return true; }
    }
    return false;
  }
  /* ── 出会いから買収提案までの3日間（作者指定）。客足が細っていく夜を2回見せてから、
     4日目に2,000万をぶつける＝「勝てない」と思っているところに、逃げ道の金が差し出される */
  if (!G.flags.reinaChallenged && r.duel !== 'announced' && !(r.lost > 0)) {
    const d = G.day - (r.metDay || 0);
    if (d === 1 && !G.flags.reinaShock1) {
      G.flags.reinaShock1 = true;
      Story.play(STORY_REINA_SHOCK1, () => { log('😨 蒼天SPAの影で、客足がはっきり細りはじめた'); saveGame(); });
      return true;
    }
    if (d === 2 && !G.flags.reinaShock2) {
      G.flags.reinaShock2 = true;
      Story.play(STORY_REINA_SHOCK2, () => { log('😨 常連まで駅前に流れている。このままでは、店がもたない'); saveGame(); });
      return true;
    }
  }
  /* ── 買収を断ってからの導線（作者指定）。2日後に挑戦状、その翌日にテレビ放送＝勝負開始 */
  if (G.flags.reinaChallengeDay && r.duel !== 'announced' && r.duel !== 'done' && !(r.lost > 0)) {
    if (!G.flags.reinaChallenged && G.day >= G.flags.reinaChallengeDay) {
      G.flags.reinaChallenged = true;
      Story.play(STORY_REINA_CHALLENGE, () => {
        toast('❄ 玲奈から挑戦状が届いた……明日、テレビが動く');
        log('❄ 蒼天SPAから「サウナ天下分け目 公開投票対決」の申し入れ書が届いた');
        saveGame();
      });
      return true;
    }
    if (G.flags.reinaChallenged && !G.flags.reinaTVDuel && G.day > G.flags.reinaChallengeDay) {
      G.flags.reinaTVDuel = true;
      startReinaDuelPeriod();
      // テレビのテロップを対決用に差し替える（開業ニュースの使い回しに見えないように）
      StoryArt.tvTicker = `サウナ天下分け目 投票対決　勝負は${REINA_DUEL_PREP_DAYS}日間！`;
      Story.play(STORY_DUEL_TV, () => {
        StoryArt.tvTicker = null;
        toast(`🗳 投票対決が始まった！ 勝負は5日間・投票日はあと${Math.max(0, r.duelDay - G.day)}日`);
        log(`❄ テレビが投票対決の開始を伝えた。勝負は5日間。投票日は${r.duelDay}日目`);
        saveGame();
      });
      return true;
    }
  }
  /* ── 勝負の5日間。毎晩ひとつずつ場面が入る（作者指定＝空っぽの日を作らない）。
     残り4日＝田所の激励／3日＝中間発表／2日＝田所の叱咤／1日＝結果発表の前夜／0日＝開票。
     再戦は3日間（作者指定）＝残り2日＝テレビが夕凪湯の盛況を伝える／1日＝中間発表／0日＝開票 */
  if (r.duel === 'announced' && (r.lost || 0) >= 1) {
    const left = r.duelDay - G.day;
    if (left <= 0) { openReinaDuel(); return true; }
    if (left === 2 && !G.flags.duelTV2B) {
      G.flags.duelTV2B = true;
      // テロップに屋号は入れない（作者指定）。絵の中の文字は、どの屋号でも通る言い方にしておく
      StoryArt.tvTicker = '街の銭湯が特注サウナ!?連日の大行列';
      Story.play(STORY_DUEL_TV2B, () => {
        StoryArt.tvTicker = null;
        log(`📺 テレビが【${EQ.sauna_sp.name}】と世界一の熱波師を特集。店の盛況が街に流れた`);
        saveGame();
      });
      return true;
    }
    if (left === 1 && !r.midDone) { openDuelMid(); return true; }
    return false;
  }
  if (r.duel === 'announced') {
    const left = r.duelDay - G.day;
    if (left <= 0) { openReinaDuel(); return true; }
    if (left === 4 && !G.flags.duelD4) {
      G.flags.duelD4 = true;
      Story.play(STORY_DUEL_D4, () => { log('🧓 田所「お前なら大丈夫だ。自分を信じろ」'); saveGame(); });
      return true;
    }
    if (left === 3 && !r.midDone) { openDuelMid(); return true; }
    if (left === 2 && !G.flags.duelD2) {
      G.flags.duelD2 = true;
      Story.play(STORY_DUEL_D2, () => { log('🧓 田所「お前が諦めてどうする！ 頭を振り絞れ！」'); saveGame(); });
      return true;
    }
    if (left === 1 && !G.flags.duelEve) {
      G.flags.duelEve = true;
      Story.play(STORY_DUEL_EVE, () => { toast('🗳 明日、結果発表'); saveGame(); });
      return true;
    }
    return false;
  }
  /* ── フェーズ4：敗北後の再挑戦チェーン（作者指定の順番）。
     負ける → ①黒田と話し合う（「世界一の熱波師に会わせてやる」）
     → ②翌日、黒田と熱波師に会う。熱波師が【屋号スペシャル】を提案＝ここでカタログに並ぶ
     → ③（足りなければ常連のカンパ）→ 組み上げた夜に火入れ → そのまま再挑戦を挑める
     → ④申し込みの翌日にテレビが再戦を告知（3日間の勝負） */
  if ((r.lost || 0) >= 1 && !r.resolved) {
    const step = G.flags.reinaRematch || 0;
    if (step === 0) {   // 敗戦の夜が明けたら、黒田と田所が集まる（特別映像②）
      G.flags.reinaRematch = 1;
      Story.play(STORY_REINA_STRATEGY, () => {
        toast('💼 黒田が世界一の熱波師を連れてくる。明日の夜だ');
        log('💼 作戦会議：黒田が、蒼天のスカウトを断った世界一の熱波師に会わせてくれる');
        saveGame();
      });
      return true;
    }
    if (step === 1) {   // その翌日の夜、熱波師と会う。ここで専用サウナが提案される（特別映像③）
      G.flags.reinaRematch = 2;
      G.nappa = { hired: true };            // ※台が据わるまでは振れない（nappaOn は設備も見る）
      G.flags.nappaDay = G.day;
      /* 熱波師が加わった翌日、常連たちが押しかけて応援してくれる（作者指定）。
         この場面で蒼天SPAに吸われていた客足が完全に戻る＝再戦の金を作れる状態になる */
      Story.play(STORY_NAPPA_MEET, () => {
        Story.play(STORY_JOREN_OUEN, () => {
          G.flags.reinaOuen = true;
          toast('🤝 常連が戻ってきた！ 客数の上限が解けた');
          log(`🤝 常連たちが${G.name}を応援しに来た。蒼天SPAに流れていた客足が戻った（客数の上限が解けた）`);
          G.najimi = clamp(G.najimi + 5, 0, 100);
          openSpecialCatalog();
          updateTopbar(); saveGame();
        });
      });
      return true;
    }
    if (step === 2) {
      if (!hasWorking('sauna_sp')) {
        /* 常連たちのカンパ（作者指定）。自力で八十万まで積んだ夜にだけ起きて、百二十万に足りない分（最大40万）を街が埋める。
           ＝「資本の力ではない、この店の戦い方」を、玲奈の2,000万と対にして見せる場面 */
        if (!G.flags.kampaDone && G.cash >= KAMPA_TRIGGER && G.cash < EQ.sauna_sp.price) {
          G.flags.kampaDone = true;
          const gift = Math.min(EQ.sauna_sp.price - G.cash, KAMPA_MAX);
          G.cash += gift;
          Story.play(STORY_KAMPA, () => {
            toast(`🤝 常連たちのカンパ ${yen(gift)}！ これで【${EQ.sauna_sp.name}】が組める`);
            log(`🤝 常連たちが${yen(gift)}のカンパを持ってきた。田所「借りじゃねえ。湯銭の前払いだ」`);
            G.najimi = clamp(G.najimi + 5, 0, 100);
            updateTopbar(); saveGame();
          });
          return true;
        }
        return false;
      }
      if (!G.flags.spFired) {   // 組み上がった夜＝火入れ。そのまま「再挑戦するか」を聞く
        G.flags.spFired = true;
        Story.play(STORY_NAPPA_FIRE, () => {
          log(`🔥 【${EQ.sauna_sp.name}】に火が入った。熱波師が中央に立ち、六つの席へ左右に風を送る`);
          saveGame();
          openRematchPrompt();
        });
        return true;
      }
      if (G.day >= (G.flags.rematchAskDay || 0)) { openRematchPrompt(); return true; }
      return false;
    }
    if (step === 3) {   // 申し込みの翌日の夜 → テレビが再戦を告知（勝負は3日間）
      G.flags.reinaRematch = 4;
      startReinaDuelPeriod(REINA_REMATCH_DUEL_DAYS);
      StoryArt.tvTicker = `サウナ天下分け目 再戦　明日から${REINA_REMATCH_DUEL_DAYS}日間！`;
      Story.play(STORY_DUEL_TV2A, () => {
        StoryArt.tvTicker = null;
        toast(`🗳 再戦が告知された！ 勝負は${REINA_REMATCH_DUEL_DAYS}日間・投票日は${r.duelDay}日目`);
        log(`❄ テレビが再戦を伝えた。勝負は${REINA_REMATCH_DUEL_DAYS}日間。投票日は${r.duelDay}日目`);
        saveGame();
      });
      return true;
    }
  }
  return false;
}
/* 決戦仕様の一台に火が入った夜の「玲奈に再チャレンジしますか？」（作者指定）。
   承諾＝特別映像①（蒼天ビル前で申し込む）→翌日夜のテレビで再戦の告知 */
function openRematchPrompt() {
  $('reinaTitle').textContent = '❄ 再挑戦';
  $('reinaInfo').innerHTML =
    `【${EQ.sauna_sp.name}】が湯気を上げ、世界一の熱波師が中央でタオルを振っている。<br><br>` +
    `……蒼天SPAに、<b>再チャレンジ</b>しますか？`;
  const box = $('reinaChoices'); box.innerHTML = '';
  const b1 = document.createElement('button');
  b1.className = 'big-btn';
  b1.innerHTML = `🔥 再チャレンジする<br><span class="opt-sub">蒼天SPAへ行き、玲奈に再戦を申し込む</span>`;
  b1.onclick = () => {
    $('reinaModal').classList.add('hidden');
    G.flags.reinaRematch = 3;
    Story.play(STORY_REINA_RECHALLENGE, () => {
      toast('❄ 玲奈が再戦を受けた。明日、テレビが動く');
      log('❄ 玲奈に再戦を申し込んだ。「今度も、手加減はしないわよ」');
      saveGame();
    });
  };
  const b2 = document.createElement('button');
  b2.className = 'big-btn';
  b2.innerHTML = `…まだ早い<br><span class="opt-sub">数日おいて、また考える</span>`;
  b2.onclick = () => { $('reinaModal').classList.add('hidden'); G.flags.rematchAskDay = G.day + 3; saveGame(); };
  box.appendChild(b1); box.appendChild(b2);
  $('reinaModal').classList.remove('hidden');
}
/* 玲奈が店まで来る揺さぶり（引き抜き→買収→挑戦状）。歩いて入ってくる */
function openReinaVisit2() {
  /* 作者指定の流れ：出会いの4日目に玲奈が店へ来て、買収を持ちかける。それ一度きり。
     受ければゲーム終了（売却エンド）、断れば2日後に挑戦状が届いて勝負が始まる。
     引き抜き（poach）・挑戦状モーダル（duel）は、この直列の流れからは外した */
  openReina('buyout');
}
/* 中間発表：いまの見込み票をもとに、僅差に見える“途中経過”を出す */
function openDuelMid() {
  const r = G.reina;
  r.midDone = true;
  const yu = Math.round(computeYuVotes() * 0.55);
  // フェーズ4：初戦（or 土俵未達）は中間発表の時点でボロ負け（作者指定＝資本の壁を見せる）
  const wall = !(r.lost > 0) || !stageReadyForReina();
  const so = wall ? Math.round(yu * 2.2 + 40) : Math.round(SOUTEN_DUEL_VOTES * 0.55 + rand(-8, 8));
  window.DUEL = { yu, so, t0: Date.now(), mid: true };
  Story.play(wall ? STORY_DUEL_MID_WALL : STORY_DUEL_MID, () => {
    toast(`📺 中間発表：夕凪 ${yu} 対 蒼天 ${so}　投票日まであと${Math.max(0, r.duelDay - G.day)}日！`);
    log(`📺 投票対決の中間発表：夕凪 ${yu} 対 蒼天 ${so}。${wall ? '……桁が、違う' : 'まだ届く'}`);
    saveGame();
  });
}
function openReinaVisit() {
  const r = G.reina;
  Story.play(STORY_SOUTEN_VISIT, () => {
    r.met = true; G.flags.reinaMet = true;
    r.metDay = G.day; r.nextDay = G.day + REINA_BUYOUT_DAY;   // 出会いの4日目に買収提案（作者指定）
    toast('❄ 蒼天SPAの開業で、しばらく客足が鈍りそうだ…');
    updateTopbar(); saveGame();
  });
}
function openReina(kind) {
  const T = REINA_TEXT[kind];
  $('reinaTitle').textContent = T.title;
  $('reinaInfo').innerHTML = shopify(T.info);
  const box = $('reinaChoices'); box.innerHTML = '';
  const addBtn = (label, sub, fn) => {
    const b = document.createElement('button');
    b.className = 'big-btn'; b.innerHTML = `${label}<br><span class="opt-sub">${sub}</span>`;
    b.onclick = fn; box.appendChild(b);
  };
  if (kind === 'duel') {
    addBtn('🗳 受けて立つ', `準備期間中は競合圧が最高潮。投票日に備えよう`, () => acceptReinaDuel());
  } else if (kind === 'poach') {
    addBtn(`💴 待遇を上げて引き留める（${yen(REINA_POACH_COST)}）`, 'バイトを守る（現場が回り続ける）', () => resolveReina('poach', 'retain'));
    addBtn('🤝 本人に任せる', `絆が深ければ残ってくれる（常連絆 ${Math.round(G.najimi)}／薄いと引き抜かれる）`, () => resolveReina('poach', 'trust'));
  } else if (kind === 'buyout') {
    addBtn(shopify('🛁 断る（夕凪湯は売らない）'), '孤高を貫く（投票対決の共感票が増える・評判↑）', () => resolveReina('buyout', 'refuse'));
    addBtn(`💰 ${yen(REINA_BUYOUT)}で売る…`, 'もうひとつの結末へ（親父は…）', () => openReina('sell'));
  } else if (kind === 'sell') {   // 売る直前の確認ゲート（誤操作で終わらせない）
    addBtn('🛁 やっぱり、売れない', shopify('夕凪湯を守る（孤高ルートへ戻る）'), () => resolveReina('buyout', 'refuse'));
    addBtn(`💰 それでも、売る（${yen(REINA_BUYOUT)}）`, '契約書にサインする', () => doReinaSell());
  }
  $('reinaModal').classList.remove('hidden');
}
/* 勝負の5日間を始める（テレビ放送の夜＝初戦／再戦の告知＝再戦、どちらもここを通る）。
   毎晩の場面のフラグをここで一度クリアする＝再戦でも同じ5日間の流れがそのまま走る */
function startReinaDuelPeriod(days) {
  const r = G.reina;
  const span = days || REINA_DUEL_PREP_DAYS;
  r.duel = 'announced'; r.duelDay = G.day + span; r.midDone = false;
  G.flags.duelD4 = false; G.flags.duelD2 = false; G.flags.duelEve = false; G.flags.duelTV2B = false;
  log(`❄ サウナ天下分け目の投票対決が始まった。勝負は${span}日間。設備と常連の絆を磨いて投票日に備えろ`);
  updateTopbar(); saveGame();
}
/* 【決戦仕様の一台＝「◯◯スペシャル」は、初戦に負けたあとまで取っておく（作者指定）】
   カタログで金を出せば買えるサウナでは、資本の店に勝つ理由にならない。
   熱波師本人が「あんたの店専用に組ませてくれ」と言った、その夜からカタログに並ぶ。値引きはしない＝自分で稼ぐ */
function openSpecialCatalog() {
  if (G.flags.duelBoost) return;
  G.flags.duelBoost = true;
  toast(`🔥 【${EQ.sauna_sp.name}】が組めるようになった（${yen(EQ.sauna_sp.price)}）`);
  log(`🔥 熱波師「部屋の真ん中に石を据えて、六人で囲む。${EQ.sauna_sp.name}だ。……${yen(EQ.sauna_sp.price)}、稼いでみせろ」`);
  updateTopbar(); saveGame();
}
/* 常連たちのカンパ（作者指定）。自力でここまで積んだら、足りない分を街が出してくれる */
const KAMPA_TRIGGER = 800000;
const KAMPA_MAX = 400000;
// （旧）挑戦状のモーダルから受けて立つ導線。いまは挑戦状→テレビ放送で自動的に始まるので使われない
function acceptReinaDuel() {
  $('reinaModal').classList.add('hidden');
  startReinaDuelPeriod();
  dismissVisitor();
}
// 投票日：両施設に通った客が一人一票。夕凪票が蒼天票以上なら勝ち（同数は挑戦者＝夕凪湯の勝ち）
// フェーズ4：初戦は必敗（資本の壁）。決戦仕様の一台＋熱波師が揃わない限り、何度やっても勝てない（作者指定）
function stageReadyForReina() { return hasWorking('sauna_sp') && nappaOn(); }
function openReinaDuel() {
  const first = !(G.reina.lost > 0);
  const yu = computeYuVotes();
  let so = computeSoutenVotes();
  // 初戦・土俵未達は“勝負にならない”＝蒼天票が夕凪票を必ず大きく上回る（ボロ負けの画）
  if (first || !stageReadyForReina()) so = Math.max(so, Math.round(yu * 1.8 + 60));
  const win = !first && stageReadyForReina() && yu >= so;
  window.DUEL = { yu, so, t0: Date.now(), mid: false };
  Story.play(win ? STORY_DUEL_WIN : STORY_DUEL_LOSE, () => finishReinaDuel(win, yu, so));
}
function finishReinaDuel(win, yu, so) {
  const r = G.reina;
  r.duel = win ? 'done' : 'none';
  if (win) {
    r.resolved = true; r.ally = true;
    if (G.solved) G.solved.reina = true;
    startMissionCooldown();   // 対決の直後にすぐ次が来ないように
    log(`❄ 投票対決に勝利！ 夕凪 ${yu} 対 蒼天 ${so}。玲奈が脱帽し、業界の伝手で店の力になってくれる（競合圧が解けた）`);
    toast(`🏆 投票対決に勝った！（夕凪${yu}-蒼天${so}）玲奈が仲間に：設備15%引き・集客↑・常連化↑`);
  } else {
    // 敗北＝評判-20（作者指定）。玲奈の来訪は止まり、翌日の夜に黒田と田所が作戦会議に集まる
    r.lost = (r.lost || 0) + 1;
    r.nextDay = 99999; r.midDone = false;
    startMissionCooldown();   // 敗戦の直後は立て直しの期間
    addRep(-REINA_LOSE_REP);
    log(`❄ 投票対決に大敗…（夕凪 ${yu} 対 蒼天 ${so}）。評判が大きく落ちた。だが終わりじゃない。明日の夜、黒田と田所が集まる`);
    toast(`😖 投票対決にボロ負け（夕凪${yu}-蒼天${so}）。評判-${REINA_LOSE_REP}…まずは店を立て直せ`);
  }
  updateTopbar(); saveGame();
}
function resolveReina(kind, choice) {
  const r = G.reina;
  $('reinaModal').classList.add('hidden');
  if (kind === 'poach') {
    if (choice === 'retain') {
      G.cash -= REINA_POACH_COST;
      toast('待遇を上げて、バイトを引き留めた');
      log('❄ 蒼天SPAの引き抜きに対抗し、時給を上げてバイトを引き留めた');
    } else if (G.najimi >= REINA_STAY_NAJIMI) {
      addRep(2);
      toast('バイトは「この店で働きたい」と残ってくれた');
      log(`❄ バイトは高待遇を蹴って${G.name}に残った。この店には、金より大事なものがある`);
    } else if (G.roster.length > 0) {
      const gone = G.roster.splice(irand(0, G.roster.length - 1), 1)[0];
      G.staff = G.staff.filter(s => s.emp !== gone);
      toast(`${gone.name}が蒼天SPAに引き抜かれた…（人手が一人減った）`);
      log(`❄ ${gone.name}が蒼天SPAに引き抜かれた。人手が一人減った`);
    }
    r.poachDone = true; r.nextDay = G.day + 4;
    startMissionCooldown();   // 玲奈の揺さぶりもミッション扱い＝次まで10日空ける（作者指定）
    dismissVisitor();
    updateTopbar(); saveGame(); return;
  }
  // buyout: 断る＝孤高を貫く（確認ゲートで思い直した場合もここに来る）
  r.stage = (r.stage || 0) + 1;
  addRep(2);
  toast(`「${G.name}は売らない」と突っぱねた（孤高を貫いた）`);
  log(`❄ 玲奈の買収を断った。${G.name}は、売らない`);
  /* 断った2日後に挑戦状が届く（作者指定）。以後、玲奈が店に揺さぶりに来ることはない＝
     ここから先は「挑戦状 → テレビ放送 → 5日間の勝負」の一本道 */
  G.flags.reinaChallengeDay = G.day + 2;
  r.nextDay = 99999;
  dismissVisitor();
  updateTopbar(); saveGame();
}
// 買収を受ける＝もうひとつの結末（売却エンド）。悲しそうな親父を見せてタイトルへ（セーブは残す）
function doReinaSell() {
  $('reinaModal').classList.add('hidden');
  G.cash += REINA_BUYOUT;
  G.reina.resolved = true;            // 玲奈の一件は（別の形で）片付いた＝この盤面はここで幕
  G.flags.ended = 'sold';             // 復活エンドの再判定を止める
  saveGame();
  Story.play(STORY_REINA_SELL, () => returnToTitle());
}
function returnToTitle() {
  Sfx.bgmStop(); Sfx.engine(false);                // タイトルへ戻ったら音は全部止める
  G.npcs = [];
  deselect(); endPlacing(); G.placing = null;      // 配置や選択の途中で戻っても、次に入った時に持ち越さない
  /* 盤面を空にしてから戻る。ここを残したまま別の章を選ぶと、
     前の章の設備を新しい章の設備表で引くことになり、描画ループが落ちる */
  G.phase = 'title';
  G.equip = []; G.dirts = []; G.junk = []; G.customers = []; G.staff = []; G.player = null;
  G.roaches = []; G.roachSplats = [];
  ['reinaModal', 'reportModal', 'manageModal', 'dataModal', 'yamiModal', 'menuModal', 'sendenModal', 'loanModal']
    .forEach(id => { const el = $(id); if (el) el.classList.add('hidden'); });
  $('game-ui').classList.add('hidden');
  if (localStorage.getItem(saveKey())) $('btnContinue').classList.remove('hidden');
  // タイトルに戻ったら、まず章の選択からやり直す
  $('titleStart').classList.add('hidden');
  $('titleChapters').classList.remove('hidden');
  $('title').classList.remove('hidden');
}

/* ============ ☰ メニュー（保存・トップ画面へ・ウェブサイト） ============ */
function menuBtn(label, cls, fn) {
  const b = document.createElement('button');
  b.className = 'big-btn' + (cls ? ' ' + cls : '');
  b.textContent = label;
  b.onclick = fn;
  return b;
}
function closeMenu() { $('menuModal').classList.add('hidden'); }
function openMenu() { renderMenu(false); $('menuModal').classList.remove('hidden'); }
/* ストアの返事は遅れて届く（値段の取り寄せ・購入・復元）。
   ☰メニューを開いたまま返事が来たら、その場で描き直す＝押したのに変わらない、を防ぐ */
IAP.onChange(() => {
  if ($('menuModal').classList.contains('hidden')) return;
  if (menuConfirming) return;      // 「トップへもどる？」の確認中に横入りして消さない
  renderMenu(false);
});
let menuConfirming = false;
/* confirming=true＝「トップ画面へ」を押した後の確認。保存し忘れで進行を失わせない */
function renderMenu(confirming) {
  menuConfirming = !!confirming;
  const box = $('menuBody'); box.innerHTML = '';
  if (confirming) {
    $('menuInfo').textContent = '保存していないぶんは消える。どうする？';
    /* 「保存してもどる」を赤にして、押してほしい方を目立たせる（作者指定 8/7）。
       赤は「営業開始」と同じ**いちばん押す色**（危険色ではない）。
       保存せずに戻る方は、うっかり選ばないように地味なままにしておく */
    box.appendChild(menuBtn('💾 保存してもどる', 'open-btn', () => { saveGame(); closeMenu(); returnToTitle(); }));
    box.appendChild(menuBtn('保存せずもどる', '', () => { closeMenu(); returnToTitle(); }));
    box.appendChild(menuBtn('やめる', '', () => renderMenu(false)));
    return;
  }
  // 保存はその日の頭までしか残らない（営業中の途中経過は保存できない）ので、営業中はそう断っておく
  $('menuInfo').textContent = `${G.name}／${G.day}日目（${dayLabel()}）・${G.phase === 'biz' ? '営業中' : '準備中'}`
    + (G.phase === 'biz' ? '（保存すると、この日は準備中からやり直しになる）' : '');
  box.appendChild(menuBtn('💾 いまの状態を保存', '', () => { saveGame(); toast(`${G.day}日目の状態を保存した`); closeMenu(); }));
  box.appendChild(menuBtn(Sfx.on ? '🔊 効果音 ON' : '🔇 効果音 OFF', '', () => { Sfx.toggle(); renderMenu(false); }));
  box.appendChild(menuBtn(Sfx.music ? '🎵 BGM ON' : '🎵 BGM OFF', '', () => { Sfx.toggleMusic(); renderMenu(false); }));
  /* オート修理＝課金コンテンツ（作者指定）。耐久5%で自動で修理業者が来る。修理費は手動と同じ。
     売り場は「ストアにつながっていて、値段が言えるとき」だけ出す（＝iOS/Androidのアプリ版だけ）。
     PCのブラウザで遊んでいるときは何も出ない＝買えないのに購入ボタンがある画面を作らない。
     解禁の判定は IAP 側に集約してある（購入・復元・起動時の問い合わせが全部そこへ合流する）。
     PREMIUM_SALE は、何かあったときに売り場ごと引っ込めるための手元スイッチ */
  if (!(G.premium && G.premium.autoRepair)) {
    if (PREMIUM_SALE && IAP.available()) {
      const yen = IAP.price();
      box.appendChild(menuBtn('🔧 オート修理を購入' + (yen ? `（${yen}）` : ''), '', () => IAP.buy()));
      // Appleは買い切り商品に「復元」を必ず求める（機種変更・入れ直しのため）
      box.appendChild(menuBtn('🔄 購入を復元', '', () => IAP.restore()));
    }
    /* 開発用（localhost のときだけ出る）。6階ぶんの故障を毎朝タップして回るのは
       確かめたいことの邪魔でしかないので、作っている間は業者を勝手に呼べるようにしておく。
       **「買った」印（autoRepair）は立てない**＝製品版の売り場には一切さわらない。
       第1章では効かせない＝chapterGuard の「5通りの営業」が動かなくなるのを避ける      */
    if (devBuild() && G.chapter !== 1) {
      const dv = !!(G.premium && G.premium.devAutoRepair);
      box.appendChild(menuBtn(dv ? '🔧 オート修理 ON（開発用）' : '🔧 オート修理 OFF（開発用）',
        '買わずに切り替えられる。製品版には出ない', () => {
          G.premium.devAutoRepair = !dv;
          savePremium();
          toast(dv ? '🔧 オート修理をOFFにした' : '🔧 オート修理をONにした（開発用）');
          renderMenu(false);
        }));
    }
  } else {
    const on = G.premium.autoRepairOn !== false;
    box.appendChild(menuBtn(on ? '🔧 オート修理 ON（購入済み）' : '🔧 オート修理 OFF（購入済み）', '', () => {
      G.premium.autoRepairOn = !on;
      savePremium();              // ON/OFFの状態も章をまたいで共有する
      toast(on ? '🔧 オート修理をOFFにした（手動修理のみ）' : '🔧 オート修理をONにした');
      saveGame(); renderMenu(false);
    }));
  }
  box.appendChild(menuBtn('🏠 トップ画面へもどる', '', () => renderMenu(true)));
  for (const l of MENU_LINKS) box.appendChild(menuBtn(l.label, '', () => window.open(l.url, '_blank', 'noopener')));
  box.appendChild(menuBtn('とじる', '', closeMenu));
}

/* 1営業日ぶんの傷み。使われなくても設備は必ずヘタっていく。
   ロッカーはいちばん傷みが早く、10日ほどで一度は壊れる（壊れたぶんは業者が勝手に来て直し、その代金が飛ぶ） */
function applyDailyWear() {
  const broke = [];
  for (const it of G.equip) {
    const d = EQ[it.id];
    const w = CONF.wearPerDay[d.cat] ?? 0;
    if (!w || it.cond <= 0) continue;
    const mul = d.old ? 1.4 : 1;   // フェーズ3：田所仲間の消耗減額は廃止
    it.cond = Math.max(0, it.cond - w * mul * rand(0.85, 1.15) / CONF.durability);
    if (it.cond <= 0) { breakEquip(it); broke.push(`${d.name}（${faultLabel(it)}）`); }
  }
  return broke;
}

/* 親父の治療費がまだ続いているか。和解ゲートは廃止（作者指定）＝治療費は第1章のエンディングまで
   15日ごとに続く固定費。親父の復活＝和解はエンディング（玲奈撃破後）で描く */
/* 治療費は「玲奈編が終わるまで」の重石（作者指定）。玲奈の一件が片付いたら、
   母からの電話も病院での支払いも起きない＝終盤は自由営業に金を回せる */
function careOn() {
  if (G.flags && G.flags.ended) return false;
  if (G.solved && G.solved.reina) return false;
  return !(G.reina && G.reina.resolved);
}
/* 営業結果を確認したあと、病院へお見舞いに行く一幕。ここで実際に治療費を払い（所持金を削り）、
   次回（15日後）を予約し、親父と話す。親父のセリフは支払い回数(G.careCount)で3段階に和らげる。
   ※支払いを営業収支と分けたので、金の増減はこの場面で起きる（closeDayでは引かない） */
/* 今回いくら用意しなければならないか。母の電話（治療の中身）で5万〜15万に変わる（作者指定）。
   まだ電話が来ていない＝額が決まっていない時は、いちばん重い15万で見積もっておく */
function careDue() { return G.careAmt || CONF.careCost; }
function careScene() {
  const before = G.cash;
  G.cash -= G.today.care;                                  // 病院で今回ぶんを手渡す（私費）
  const after = G.cash;
  G.careCount = (G.careCount || 0) + 1;
  G.careNext = (G.careNext || CONF.careFirstDay) + CONF.careEvery;   // 次の請求＝15日後（周期は15日のまま）
  G.careAmt = 0;                                           // 次回の額は、次の母の電話で決まる
  // 親父の態度は「評判」で決まる（作者指定＝和解ゲージ廃止。街に認められた事実だけが病室に届く）。
  // 段階ごとに複数パターンからランダムに選ぶ
  const tier = STORY_CARE_PAID.find(t => G.rep < t.max) || STORY_CARE_PAID[STORY_CARE_PAID.length - 1];
  const lines = pick(tier.vars);
  // 鍵の画像は使わない（作者指定）。毎回、素の病室で
  return [{ art: 'hospitalPlain', lines: [
    // 次回の日付はここでは見せない（作者指定＝15日周期をプレイヤーに悟らせない。次は母の電話で知る）
    { narr: true, text: `病院へ寄り、親父の治療費 ${yen(G.today.care)} を手渡した。所持金 ${yen(before)} → ${yen(after)}。` },
    ...lines,
  ] }];
}
/* 母からの電話。台本の {曜日} を支払日の曜日に差し替える（作者指定＝「15日ごと」とは言わせず、
   毎回「次の○曜日に十五万円」と頼まれる）。元の台本は書き換えず、複製したものを返す */
function careCallScene(scenes) {
  const wd = dayLabel(G.careNext || CONF.careFirstDay);
  // 治療の中身で額が変わる（作者指定＝5万〜15万）。台本の amt を、この回の請求額として控えておく
  const amt = scenes[0] && scenes[0].amt ? scenes[0].amt : CONF.careCost;
  G.careAmt = amt;
  const kanji = manKanji(amt);
  return scenes.map(s => ({ ...s, lines: s.lines.map(l => ({ ...l,
    text: l.text.replace(/\{曜日\}/g, wd).replace(/\{金額\}/g, kanji + '円').replace(/\{額\}/g, kanji) })) }));
}
/* 金額を漢数字の「万」表記にする（母のセリフ用）。5万→五万、12万→十二万 */
function manKanji(n) {
  const man = Math.round(n / 10000);
  const d = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const body = man < 10 ? d[man] : man === 10 ? '十' : man < 20 ? '十' + d[man - 10]
    : d[Math.floor(man / 10)] + '十' + d[man % 10];
  return body + '万';
}
/* 準備中、治療費が続いているあいだ主人公が漏らす独り言（作者指定＝日報ではなく吹き出しで見せる） */
/* 営業を終えた夜、主人公が一言こぼす（作者指定）。優先順位は
   ①治療費のカウントダウン（3日前・2日前・前日だけ）②資金30万以下 ③みかじめを払った日 ④黒字/赤字 の順。
   その日いちばん重たいことを一つだけ言う＝毎晩なにか喋るが、うるさくならない。※セリフは叩き台 */
function careBubbleText() {
  // ① 治療費のカウントダウン。3日前・2日前・前日だけ出す（それ以外の日は言わない）
  if (careOn() && G.flags.careNag) {
    const left = (G.careNext || CONF.careFirstDay) - G.day;
    if (left === 1) return `明日、治療費${yenShort(careDue())}…`;
    if (left === 2) return 'いつまで治療費を払えばいいんだ…';
    if (left === 3) return `3日後に治療費${yenShort(careDue())}…`;
  }
  // ② 手持ちが治療費に届かない夜
  if (careOn() && G.cash <= careDue()) return '親父の治療費が払えない…';
  // ③ みかじめを払った日
  if (G.today && G.today.mikajime > 0) return pick(LINES.nightMika);
  /* ④ 灰田に借りているあいだ、集金日（水曜）の朝だけ（作者指定）。
     ※この関数は日付が翌日に進んだあと（準備画面に入る時）に呼ばれるので、G.day はもう当日 */
  if (G.yami && G.yami.debt > 0 && dayOfWeek(G.day) === 2) return `今日は灰田の集金日だ…（金利 ${yenShort(yamiDue())}）`;
  // ④ その日の収支（closeDayが計算してG.recentProfitsの末尾に積んだ値＝日報と同じ数字）
  const hist = Array.isArray(G.recentProfits) ? G.recentProfits : [];
  if (!hist.length) return null;
  return pick(hist[hist.length - 1] >= 0 ? LINES.nightPlus : LINES.nightMinus);
}
/* 治療費が払えず親父が亡くなる＝ゲームオーバー。融資枠の有無は関係ない（作者指定）。
   日報もへったくれもない、一枚絵だけで終わる。セーブは消す＝この店の物語はここで終わり */
function triggerCareGameOver() {
  G.phase = 'gameover';
  G.paused = true;
  Sfx.bgmStop(); Sfx.engine(false);
  G.benz = null; G.npcs = [];
  $('bizPanel').classList.add('hidden');
  $('shopPanel').classList.add('hidden');
  Story.play(STORY_CARE_GAMEOVER, () => {
    localStorage.removeItem(saveKey());   // 本当のゲームオーバー＝「つづきから」は無い
    returnToTitle();
  });
}

function closeDay() {
  // 治療費の支払い判定は「営業結果を見たあと、病院で」に移した（afterReport）。
  // 払えず看取れない＝ゲームオーバーも、その病院の場面で断ち切る（作者指定）
  Sfx.bgmStop();   // 暖簾を下ろす＝BGMを止める（日報のガッチャーンを静かなところで鳴らす）
  Sfx.engine(false);
  G.benz = null;   // 走行中のベンツが残っていても営業終了で片付ける
  // 来訪者は引き上げる。ただし修理業者だけは、頼まれた作業を終えるまで帰らない（作者指定＝
  // 営業中↔営業後の切り替えで作業が途中で消えると、呼んだのに直っていない事故になる）
  G.npcs = G.npcs.filter(n => n.role === 'fixer');
  // 残っている客は精算して退店扱い
  for (const c of [...G.customers]) {
    if (c.state !== 'turnAway' && c.state !== 'turnAwayExit') {
      c.sat = clamp(c.sat + c.type.tolerant, 0, 100);
      G.today.satSum += c.sat; G.today.satN++;
      addSegSat(c);
    } else { G.today.turnedAway++; gripe('locker'); }
    removeCustomer(c);
  }
  G.phase = 'report';
  const t = G.today;
  // 光熱費・水道代は変動制（基本＋客数ぶん）。内訳は日報に出す
  const utilBd = dailyUtil(t.paid), waterBd = dailyWater(t.paid);
  const util = utilBd.total, water = waterBd.total;
  // 銀行融資は廃止（作者指定）。サラ金の返済は集金の場面でその都度払うので、ここでは引かない
  const loanPay = 0;
  const bathRev = t.paid * G.opts.fee, saunaRev = t.sauna * G.opts.saunaFee, milkRev = t.milkRev || t.milk * 130;
  /* 運営メニューの経費＝アメニティは一律の定額（作者指定）。
     無料でも有料でも、置いている限り毎日この額。「1本いくらの仕入れ」は廃止した＝
     無料にすると経費が跳ね上がる／売れば売るほど仕入れが伸びる、という読みにくさをなくす */
  const keihiCut = kurodaAllyOn() ? 0.94 : 1;   // 黒田が仲間なら経費6%off（仕入れ・タオルの無駄を締める）
  /* ── アメニティの経費（作者決定 2026-08-05）──────────────────────
     **`〜CostPer` を持つ章（第2章）は「使われたぶん」、持たない章（第1章）は一律の定額。**
     定額だと、客が何人来ても経費が同じ＝**大箱ほど得をする**という逆の絵になる。

       シャンプー・ボディソープ … 客ひとりにつき（浴びれば必ず使う）
       化粧水・乳液             … 客ひとりにつき（洗面所がある日だけ）
       サウナマット             … **サウナに入った客**ひとりにつき
       垢すりタオル             … 手に取られた枚数ぶん（goRack で数えている）           */
  const guests = t.paid || 0, saunaGuests = t.sauna || 0;
  const soapOn = G.opts.soapMode !== 'none';
  const lotionOn = hasSink() && G.opts.lotionOn !== false;
  const soapCost = !soapOn ? 0
    : (CONF.soapCostPer ? guests * CONF.soapCostPer : CONF.soapCostPerDay);
  const lotionCost = !lotionOn ? 0
    : (CONF.lotionCostPer ? guests * CONF.lotionCostPer : CONF.lotionCostPerDay);
  const matCost = !hasMat() ? 0
    : (CONF.matCostPer ? saunaGuests * CONF.matCostPer : 500);
  const akasuriCost = !hasAkasuri() ? 0
    : (CONF.akasuriCostPer ? (t.akasuriUseN || 0) * CONF.akasuriCostPer : 500);
  const amenityCost = Math.round((soapCost + lotionCost + matCost + akasuriCost) * keihiCut);
  /* タオルの維持費。
     ・`towelCostPer` を持つ章（第2章）＝**貸した枚数 × 単価**（リネン業者の従量課金と同じ）。
       枚数＝有料で買った人＋手ぶらセットを買った人＋（無料貸出の日に）手ぶらで来た人
     ・持たない章（第1章）＝これまでどおり一律の定額 */
  const towelUsed = (t.towelN || 0) + (t.teburaN || 0) + (t.towelFreeN || 0);
  const towelCost = Math.round((CONF.towelCostPer
    ? towelUsed * CONF.towelCostPer
    : (G.opts.towel !== 'none' ? CONF.towelCostPerDay : 0)) * keihiCut);
  // 牛乳・ドリンクも売れた本数ぶんだけ仕入れる（1本¥50）
  const milkStock = Math.round(t.milk * CONF.milkUnitCost * keihiCut);
  const shiire = amenityCost + towelCost + milkStock;                                          // 日報ではこの3つを「仕入れ」にまとめる
  const staffCost = Math.round(rosterWages() * (kurodaAllyOn() ? 0.96 : 1));   // 黒田が仲間なら人件費4%off（シフト最適化）
  // フェーズ3：バイトの成長。働くほど慣れて働きぶりが上がり、節目（10日ごと）に賃上げを言い出す
  for (const e of G.roster) {
    e.days = (e.days || 0) + 1;
    if (!e.sulk) e.skill = Math.min(100, (e.skill || 40) + 3);
    // 賃上げの要求額は¥100〜¥500（100円刻み）。慣れている子ほど強気に出る（作者指定）
    // ふてくされている子も相談には来る（来ないと「3回連続で断ると辞める」が成立しないため）
    if (e.days % 10 === 0 && e.skill >= 60) {
      e.raiseAsk = true;
      e.raiseAmt = clamp(irand(1, 3) + Math.floor(((e.skill || 60) - 60) / 20), 1, 5) * 100;
    }
  }
  /* 親父の治療費。店の経費ではない（＝営業の収支には入れない）が、金は確実に減る。
     終わるのは第1章のエンディング（親父復活）＝それまで15日ごと15万の固定費として続く（作者指定） */
  // 今日が請求日（15日ごと）なら「病院で払う予定額」を立てるだけ。実際の支払い・親父との一幕・
  // 支払い回数や関係の深まりは、営業結果を確認したあとの病院の場面（careScene）で処理する
  if (careOn() && G.day >= (G.careNext || CONF.careFirstDay)) t.care = careDue();
  /* 章ごとの固定費。第2章は「買った店」なので、家賃の代わりに
     事業ローンの返済と固定資産税・保険が、客が0人でも毎日出ていく（CHAPTER2.md §10-2）。
     第1章はこのフックが無いので 0＝何も変わらない */
  const extraFix = chHook('dailyExtraCost') || 0;
  t.extraFix = extraFix;
  G.cash -= util + water + loanPay + shiire + staffCost + extraFix;   // 治療費は営業収支に含めない（私費）
  /* 資金ショート → 頼れるのは灰田だけ（銀行は貸してくれない）。10万刻みで足りるぶんだけ自動で借りる。
     限度は100万＝ここで借り切ってしまうと、次に足りなくなった日は本当に打つ手がない */
  while (G.cash < 0 && G.yami.debt < CONF.sarakinMax) { G.cash += CONF.sarakinUnit; G.yami.debt += CONF.sarakinUnit; t.autoYami += CONF.sarakinUnit; G.yami.met = true; }
  // どこも貸してくれない日は、店の信用が落ちる。マイナスは0で隠さず、そのまま残す（作者指定）
  if (G.cash < 0) { t.unpaid = true; addRep(-2); }
  // 設備の傷み（1日ぶん）
  const brokeToday = applyDailyWear();
  const profit = bathRev + saunaRev + milkRev + t.amenRev + t.towelRev + t.akasuriRev + t.soapRev + t.teburaRev
                 + (t.menuRev || 0)                     // 第2章：食堂のメニュー売上（原価は extraFix 側で引く）
                 + (t.nightRev || 0)                    /* 深夜の割増（第2章）。入浴料は t.paid×定価で計算し直しているので、
                                                           ここに足さないと**受け取ったのに日報から消える**（現金には入っている）。
                                                           第1章は深夜営業が無いので 0 が足されるだけ */
                 - util - water - loanPay - shiire - staffCost - extraFix
                 - (t.mikajime || 0) - (t.yamiPaid || 0) - (t.repairCost || 0);
  // 日報に出ている内訳を、あとから読めるように残しておく（バランス計測用）
  t.util = util; t.water = water; t.shiire = shiire; t.staffCost = staffCost;
  t.bathRev = bathRev; t.saunaRev = saunaRev; t.milkRev = milkRev; t.profit = profit;
  /* 「荒れた日」を数える＝汚れをためたまま閉めた／待たせて帰した客が多かった日。
     これが続くと翌日から暴動が起きる。ちゃんと掃除して捌けた日が1日あればリセットされる */
  const roughLeft = (t.gaveUp || 0) + (t.turnedAway || 0) + (t.queueMiss || 0);
  // 暴動の引き金は「本当に放置した日」だけ。客が文句を言い出す量（dirtAngryN）で
  // 数えてしまうと、大きな店では毎日そこに触れてしまい、暴動が日常になる
  const rough = G.dirts.length >= CONF.riotDirtN
    || (t.paid > 0 && roughLeft / t.paid >= CONF.riotRough);
  G.roughDays = rough ? (G.roughDays || 0) + 1 : 0;
  // 直近3日ぶんの不満の内訳を残す（データ画面の「客の不満」欄で読む）
  if (!Array.isArray(G.recentGripes)) G.recentGripes = [];
  G.recentGripes.push(t.gripes || {});
  if (G.recentGripes.length > 3) G.recentGripes.shift();
  // 客層別の満足度も同じく直近3日ぶん残す（データ画面の診断表示で読む）
  if (!Array.isArray(G.recentSegSat)) G.recentSegSat = [];
  G.recentSegSat.push(t.satSeg || {});
  if (G.recentSegSat.length > 3) G.recentSegSat.shift();
  G.lastTurnedAway = t.turnedAway || 0;   // ロッカー満杯で帰した人数＝翌日の準備画面で真っ先に知らせる
  // 黒田の判定用：直近5日の収支を記録し、資金ショートした日を覚えておく
  if (!Array.isArray(G.recentProfits)) G.recentProfits = [];
  G.recentProfits.push(profit); if (G.recentProfits.length > 5) G.recentProfits.shift();
  // 直近5日の水道光熱費と売上（データ画面で「平均いくら・売上の何%か」を見せるため・作者指定）
  if (!Array.isArray(G.recentUtil)) G.recentUtil = [];
  G.recentUtil.push({ util, water, revenue: t.revenue || 0 });
  if (G.recentUtil.length > 5) G.recentUtil.shift();
  /* 黒田の“経営課題”の判定に使う、その日の成績（作者指定＝黒田は設備を買わせる役ではなく数字を要求する役）。
     売上・利益・客単価・満足度は日報と同じ数字。あとから読めるようにここで確定させる */
  G.lastStats = { profit, tanka: t.paid ? Math.round(t.revenue / t.paid) : 0,
                  avgSat: t.satN ? Math.round(t.satSum / t.satN) : 0, paid: t.paid };
  if (t.autoYami > 0) G.lastShortfallDay = G.day;
  // 連続黒字日数＝信用金庫の審査条件（フェーズ4）。赤字が1日でも出るとゼロに戻る
  G.profitStreak = profit > 0 ? (G.profitStreak || 0) + 1 : 0;
  const avgSat = t.satN ? t.satSum / t.satN : 50;
  // 常連との絆：満足度の高い日は、親父時代からの常連が通い続け、絆がゆっくり深まる
  const oldNajimi = G.najimi;
  if (t.satN >= 3 && avgSat >= 62) G.najimi = clamp(G.najimi + (avgSat >= 78 ? 2 : 1), 0, 100);
  // 親父との関係ゲージ(oyajiRel)は廃止（作者指定）。親父の態度は評判連動でお見舞いシーンに出る
  const najimiUp = Math.round((G.najimi - oldNajimi) * 10) / 10;
  // ととのった客の比率が高いほど評判が伸びる（口コミはここから生まれる）
  const totonoiRate = t.satN ? t.totonoi / t.satN : 0;
  /* 評判＝10項目の採点（新評判システム・作者指定）。
     その日ぶんの10項目を採点して直近7日ぶんに積み、その平均から【その他】の減点を引いたものが評判。
     ・良い日を1日だけ作っても動かない＝7日ならして初めて数字になる
     ・逆に、荒れた日は7日ぶん尾を引く＝「今日だけ頑張る」が効かない
     ・最初の7日は母数が足りないので「集計中」（評判は開店時の10のまま据え置き） */
  if (!Array.isArray(G.repHist)) G.repHist = [];
  G.repHist.push(repDayScores());
  if (G.repHist.length > REP_DAYS) G.repHist.shift();
  const oldRep = G.rep;
  syncRep();
  const repD = Math.round((G.rep - oldRep) * 10) / 10;

  const row = (l, v, minus, cls) =>
    `<div class="rep-row ${minus ? 'minus' : ''} ${cls || ''}"><span>${l}</span><span class="v">${v}</span></div>`;
  // 枠付きチップ（2列グリッドで横並び）。金額の内訳は省いてコンパクトに、件数はラベル側へ
  const chip = (l, v, cls) =>
    `<div class="rep-chip ${cls || ''}"><span class="cl">${l}</span><span class="cv">${v}</span></div>`;
  let html = '';
  /* フェーズ3：日報を「収入／支払い」の2欄P/Lに再構成（作者指定）。項目は枠付きチップの2列グリッドで
     横並びにして縦を圧縮。常連の数・絆・所持金・明日の曜日の行は削除（ステータスバー／データ画面で見られる）。
     評判は手ごたえチップに残す。お客の声は“改善のヒント”＝クレーム中心に並べ替える */
  // 本日の収支＝この画面の主役。最上部に大きく
  html += `<div class="rep-headline ${profit >= 0 ? 'plus' : 'minus'}">
      <span class="rh-label">本日の収支</span>
      <span class="rh-value">${profit >= 0 ? '+' : '-'}${yen(Math.abs(profit))}</span>
    </div>`;
  // 来店人数・入れずの独立行は廃止（作者指定）。人数の内訳は入浴料チップに寄せる
  const mix = (t.newN || t.repeatN) ? `（新規${t.newN}・常連${t.repeatN}）` : '';

  // ── 収入の欄（チップ2列） ─────────────────────
  html += `<div class="rep-sec in">▼ 収入</div><div class="rep-grid">`;
  /* 食堂の売上（第2章）も合計に入れる。収支の計算（profit）には元から入っていたので、
     ここに足さないと**日報の中だけ辻褄が合わない**（収入合計と収支がずれる）。
     第1章は menuRev を持たないので 0 が足されるだけ */
  const income = bathRev + saunaRev + milkRev + t.amenRev + t.towelRev + t.akasuriRev + t.soapRev + t.teburaRev
                 + (t.menuRev || 0) + (t.nightRev || 0);
  // 入浴料も他の項目と同じ通常チップに統一（来店人数の内訳はラベルに収める）
  html += chip(`入浴 ${t.paid}人${mix}`, yen(bathRev));
  // 深夜の割増（第2章）。入浴料とは別の行にして、「遅くまで開けた分」が見えるようにする
  if (t.nightRev) html += chip('深夜割増', yen(t.nightRev));
  if (t.sauna) html += chip(`サウナ ${t.sauna}人`, saunaRev ? yen(saunaRev) : '無料');
  if (t.towelRev) html += chip(`タオル ${t.towelN}本`, yen(t.towelRev));
  if (t.teburaRev) html += chip(`手ぶら ${t.teburaN}人`, yen(t.teburaRev));
  if (t.soapRev) html += chip(`アメニティ ${t.soapN}人`, yen(t.soapRev));
  // 垢すりは「人」で数える（第2章の垢すり台＝ひとり¥3,000。もとは垢すりタオルの枚数として作った行）
  if (t.akasuriRev) html += chip(`垢すり ${t.akasuriN}人`, yen(t.akasuriRev));
  if (t.amenRev) html += chip(`ドライヤー等 ${t.amenN}回`, yen(t.amenRev));
  /* 自販機は台ごとに1行ずつ出す（作者指定 8/5）。牛乳とドリンクを合算していたので、
     ドリンクが売れていても日報からは見えなかった。内訳が無い古いデータは、
     これまで通り1行にまとめて出す（drinkLabel を持つ章はその見出しを使う） */
  const vendKeys = Object.keys(t.vendN || {}).filter(k => t.vendN[k] > 0);
  if (vendKeys.length) {
    for (const k of vendKeys) {
      /* 台ごとの短い名前が正（y_milk＝牛乳）。無い台だけ章の見出しに落ちる。
         以前の「vend1以外は章の見出し」だと、第2章の牛乳が「ドリンク」と出てしまう */
      const lbl = DRINK_VEND_LABEL[k] || CONF.drinkLabel || 'ドリンク';
      html += chip(`${lbl} ${t.vendN[k]}本`, yen(t.vendRev[k] || 0));
    }
  } else if (t.milk) html += chip(`${CONF.drinkLabel || '牛乳'} ${t.milk}本`, yen(milkRev));
  /* 食堂（第2章）。原価は支払いの「仕入れ」に入っているので、ここは売上だけ。
     第1章は menuRev を持たないので、この行は出ない */
  if (t.menuRev) html += chip(`食堂 ${t.menuN}皿`, yen(t.menuRev));
  html += chip('収入 合計', yen(income), 'wide total');
  // 融資の振込は営業の売上ではないので、収支には混ぜず「別枠のお知らせ」として並べる（作者指定）
  if (t.autoYami) html += chip('💳 灰田から やむなく借入', '+' + yen(t.autoYami), 'wide');
  html += `</div>`;

  // ── 支払いの欄（チップ2列） ───────────────────
  html += `<div class="rep-sec out">▼ 支払い</div><div class="rep-grid">`;
  const outlay = util + water + shiire + staffCost + (t.extraFix || 0) + (t.repairCost || 0) + (t.loanPay || 0) + (t.mikajime || 0) + (t.yamiPaid || 0);
  html += chip('光熱費', '-' + yen(util), 'minus');
  if (water) html += chip('水道代', '-' + yen(water), 'minus');
  if (shiire) html += chip('仕入れ', '-' + yen(shiire), 'minus');
  if (staffCost) html += chip(`人件費 ${G.roster.length}人`, '-' + yen(staffCost), 'minus');
  // 章ごとの固定費。何の金かは章によって違う（第1章＝出番なし／第2章＝板前の日給と皿の原価）
  if (t.extraFix) html += chip(chHook('extraFixLabel') || '返済・税', '-' + yen(t.extraFix), 'minus');
  if (t.repairCost) html += chip('修理業者', '-' + yen(t.repairCost), 'minus');

  if (t.mikajime) html += chip('⚠ みかじめ料', '-' + yen(t.mikajime), 'minus');
  if (t.yamiPaid) html += chip('💳 灰田への返済', '-' + yen(t.yamiPaid), 'minus');
  html += chip('支払い 合計', '-' + yen(outlay), 'wide total minus');
  /* 設備にかけた金は営業の収支には入らない（買い物であって経費ではない）。
     支払いグリッドの末尾に、色を分けた横長チップで別立て（本日の収支＝収入合計−支払い合計は変わらない） */
  const invest = G.invBuy + G.invMove + G.invFix - G.invSell;
  if (invest !== 0) {
    const invWord = (G.invBuy || G.invMove || G.invSell) ? '設備投資' : '設備の修理';
    html += chip(invWord, (invest > 0 ? '-' : '+') + yen(Math.abs(invest)), 'wide capex');
  }
  html += `</div>`;

  // 本日の手ごたえ＝満足度・ととのい・評判（常連数／絆／所持金の行は削除・作者指定。評判は残す）
  html += `<div class="rep-grid">`;
  html += chip('平均満足度', `${Math.round(avgSat)}/100`);
  if (t.totonoiTry) html += chip('ととのい', `${t.totonoi}人`);
  html += repCounting()
    ? chip('評判', `集計中（あと${REP_WARMUP - G.day + 1}日）`)
    : chip('評判', `${G.rep}（${repD >= 0 ? '+' : ''}${repD}）`, repD < 0 ? 'minus' : '');
  html += `</div>`;

  // 警告・事件系（起きた日だけ出す）
  if (t.gaveUp) html += row('⚠ 待ちきれず帰った客', `${t.gaveUp}人（受付が追いつかない）`, true);
  if (t.queueMiss) html += row('⏳ 順番待ちで機嫌を損ねた客', `${t.queueMiss}人（設備が混んでいた）`, true);
  if (t.autoYami) html += row('💳 やむなく灰田から借りた', yen(t.autoYami) + `（残債 ${yen(G.yami.debt)}／限度 ${yen(CONF.sarakinMax)}）`, true);
  if (t.unpaid) html += row('⚠ 支払いきれなかった', '信用が落ちた（評判-2）', true);
  if (brokeToday.length) html += row('💥 今日壊れた設備', brokeToday.join('・') + (autoRepairEnabled() ? '（オート修理：業者が来て直す）' : '（設備をタップ→【修理】で直そう）'), true);

  // 開店直後は赤字が正常。焦って借りさせないための一言
  if (profit < 0 && G.day <= 5 && repD > 0) {
    html += `<div class="rep-voice">💡 まだ赤字だが、評判は上がっている。銭湯は客足が戻るまで数日かかる。慌てて借りるな。</div>`;
  }
  /* お客の声＝その日の実態を、効いた順に出す（作者指定）。
     種類ごとにまとめ、「奪った満足度の合計＝件数×1件あたりの重さ」の多い順に並べる。
     件数順にしないのは、軽い不満が数だけで、致命的な不満（壊れている等）を押しのけるため。
     不満が3件に満たない日だけ、余った枠に褒め言葉を入れる＝序盤は不満だらけでいい */
  if (t.voices.length) {
    const agg = {};
    for (const v of t.voices) {
      const a = agg[v.key] || (agg[v.key] = { ...v, n: 0, sum: 0, by: {} });
      a.n++; a.sum += v.w; a.by[v.who] = (a.by[v.who] || 0) + 1;
    }
    // 代表して名前を出すのは、その不満をいちばん多く言った客層（1人だけの声を全体の顔にしない）
    for (const a of Object.values(agg))
      a.who = Object.keys(a.by).sort((x, y) => a.by[y] - a.by[x])[0] || a.who;
    const list = Object.values(agg).sort((a, b) => b.sum - a.sum);
    const bad = list.filter(v => v.sum > 0), good = list.filter(v => v.sum <= 0);
    const show = bad.concat(good).slice(0, 4);
    const line = v => `${v.mark}${v.who}「${v.line}」${v.n > 1 ? `（${v.n}人）` : ''}`;
    html += `<div class="rep-voice">🗣 お客の声（評判に効いた順）<br>${show.map(line).join('<br>')}</div>`;
  } else {
    html += `<div class="rep-voice">🗣 お客の声<br>（今日は特に不満の声はなかった）</div>`;
  }
  /* 章ごとに、日報の下へ足したいものがあれば足す。
     第2章＝10日ごとに来る事業ローン・住宅ローン・生活費（店の損益ではないので別枠）。
     第1章はこのフックを持たないので、日報はこれまでどおり営業の数字だけ */
  const extra = chHook('dayReportExtra');
  if (extra) html += extra;

  $('repTitle').textContent = `${G.day}日目（${dayLabel()}）の営業結果`;
  $('repBody').innerHTML = html;
  $('bizPanel').classList.add('hidden');
  $('shopPanel').classList.add('hidden');
  $('reportModal').classList.remove('hidden');
  Sfx.play('register');   // 一日を締めるレジのガッチャーン
}

function afterReport() {
  $('reportModal').classList.add('hidden');
  const finishedDay = G.day;
  G.day++;
  /* 夜の物語は章ごとに丸ごと別のものを動かす（作者指定＝同じアプリの中の別ゲーム）。
     第1章＝田所・鬼頭・黒田・玲奈・親父の治療費。第2章＝寒川・宮下・東條・灯・千夏。
     第2章は js/ch2/rules2.js が nightFlow を持っているので、そちらへ丸ごと渡す */
  if (hasHook('nightFlow')) {
    G.invBuy = 0; G.invMove = 0; G.invSell = 0; G.invFix = 0;
    G.cashAtDayStart = G.cash;
    chHook('nightFlow', finishedDay);
    return;
  }
  // 設備にかけた金の集計はここで仕切り直す＝「日報を閉じてから、次の日報まで」が1日ぶん。
  // 設備を買うのは主に準備中なので、この区切りだと「明日のために使った金」が明日の日報に出る
  G.invBuy = 0; G.invMove = 0; G.invSell = 0; G.invFix = 0;
  G.cashAtDayStart = G.cash;
  // 重要人物との一幕は「営業中に本人が歩いて来る」形に変わった（1日ひとりだけ）。
  // 夜に流すのは、全画面で見せたい節目だけ（蒼天SPAへの招待・投票の中間発表・投票日・エンディング）
  // 田所の初登場は「4日目の営業終了後（夜）」＝閉店後の浴室で並ぶ一幕（作者指定）。
  // 2〜3日目の夜は母からの電話が入りうるので、そこを避けて4日目にずらしてある
  const tadokoroNightHello = (finishedDay === TADOKORO_HELLO_DAY && G.tadokoro && !G.tadokoro.hello);
  /* 治療費が足りない夜は、まず灰田に頭を下げる道を出す（作者指定）。
     借りて払えば物語は続く。断る・もう借りられない＝そこで親父を看取れない（ゲームオーバー） */
  if (G.today.care > 0 && G.cash < G.today.care) {
    openCareShortfall(() => afterCareOK(finishedDay, tadokoroNightHello));
    return;
  }
  afterCareOK(finishedDay, tadokoroNightHello);
}
/* 治療費が足りない時の分岐（作者指定）。サラ金の枠が残っていれば「借りる／借りない」を聞き、
   枠が無ければ断られる場面だけを見せる。どちらも「借りない・借りられない」ならゲームオーバー */
function openCareShortfall(next) {
  const need = G.today.care - G.cash;
  const room = CONF.sarakinMax - ((G.yami && G.yami.debt) || 0);
  const unit = CONF.sarakinUnit;
  const amt = Math.ceil(need / unit) * unit;                 // 10万円きざみで、足りるところまで
  const canBorrow = amt <= room;
  $('yamiTitle').textContent = '💳 治療費が、足りない';
  $('yamiInfo').innerHTML =
    `今日は親父の治療費 <b>${yen(G.today.care)}</b> を病院に届ける日だ。手元にあるのは <b>${yen(G.cash)}</b>。<br>` +
    `<b>${yen(need)}</b> 足りない。<br><br>` +
    (canBorrow
      ? `番台の引き出しから、あの男の名刺を出した。灰田ファイナンス――審査なし、即日。<br>` +
        `<span class="mika-note">借りれば払える。断れば、親父の治療は止まる</span>`
      : `名刺を出して、番号を押した。灰田は少し黙ってから、こう言った。<br>` +
        `「……もう、お貸しできる枠がありません。」<br>` +
        `<span class="mika-note">借りる先は、もうない</span>`);
  const box = $('yamiChoices'); box.innerHTML = '';
  const add = (label, sub, fn, danger) => {
    const b = document.createElement('button');
    b.className = 'big-btn' + (danger ? ' danger' : '');
    b.innerHTML = `${label}<br><span class="opt-sub">${sub}</span>`;
    b.onclick = fn; box.appendChild(b);
  };
  if (canBorrow) {
    add(`💳 灰田から ${yen(amt)} 借りる`, `金利は年${Math.round(CONF.sarakinApr * 100)}%。毎週水曜に集金が来る`, () => {
      $('yamiModal').classList.add('hidden');
      borrowYami(amt);
      toast(`💳 灰田から ${yen(amt)} 借りた…治療費は払える`);
      log(`💳 治療費のために灰田から ${yen(amt)} 借りた`);
      updateTopbar(); next();
    });
  }
  add('🙇 …借りない', '親父の治療費は、用意できない', () => {
    $('yamiModal').classList.add('hidden');
    triggerCareGameOver();
  }, true);
  $('yamiModal').classList.remove('hidden');
}
/* 治療費の目処が立ったあとの夜（お見舞い→母の電話→親父の小言→…） */
function afterCareOK(finishedDay, tadokoroNightHello) {
  const enterPrepPhase = () => {
    enterPrep(); saveGame();
    if (checkGrandEnding()) return;
    if (maybeReinaCinematic()) return;
    maybeTadokoroKessenNight();   // 田所が認めるのは営業終了後の夜（作者指定）
  };
  /* 夜の物語は**章ごとに別**。ここから下（母の電話・治療費・親父・田所・黒田・玲奈）は
     すべて第1章「夕凪湯」の話なので、**自前の台本を持つ章では一切流さない**。
     CONF.noLegacyStory を立てた章（第2章「横浜編」）は、ここで朝へ抜ける */
  /* nightStory が truthy を返した夜は朝を作らない（第2章の廃業エンド＝ending_y.js）。
     フックが無い／falsy の章は従来どおり enterPrepPhase へ */
  if (CONF.noLegacyStory) { if (chHook('nightStory', finishedDay)) return; enterPrepPhase(); return; }
  // その夜に流すストーリーを積む（治療費の見舞い→母の電話→親父の小言→親父の承認、の順）
  const scenes = [];
  if (G.today.care > 0) {
    scenes.push(...careScene());   // careScene が支払い・次回予約・親父との一幕を担う
  }
  if (finishedDay === 1 && !G.flags.s1) { G.flags.s1 = true; scenes.push(...STORY_DAY1); }
  // 4日目の夜：田所の名乗り。会話画面だけで完結させ、モーダルは出さない（作者指定）。
  // 名乗りの効果（hello成立・次の来訪予約・絆+2）もここで済ませる
  if (tadokoroNightHello) {
    G.flags.bathTadokoroMeet = true; scenes.push(...STORY_TADOKORO_MEET);
    const t2 = G.tadokoro;
    // 名乗った翌日か、その次の日にはもう小言を言いに来る（作者指定＝名乗り以降ずっと出ないのは間延び）。
    // ここでの G.day は「明日」＝ irand(0,1) で 名乗りの翌日／翌々日
    t2.hello = true; t2.nextDay = G.day + irand(0, 1);
    G.najimi = clamp(G.najimi + 2, 0, 100);
  }
  // 親父の小言（STORY_LOAN）は、資金ショートで灰田に駆け込んだ日に流れる
  // 母からの電話＝支払いの5日前に「5日後に15万円持ってきて」の予告が入る（作者指定）。
  // 初回は事情説明つきのSTORY_CARE、2回目以降はSTORY_CARE_CALLSの5パターンを順番に。
  // お見舞い（病院）と同じ夜には流さない（作者指定）
  if (careOn() && !(G.today.care > 0)) {
    const careLeft = (G.careNext || CONF.careFirstDay) - G.day;
    if (!G.flags.careNag && careLeft <= 5) { G.flags.careNag = true; scenes.push(...careCallScene(STORY_CARE)); }
    else if (G.flags.careNag && careLeft === 5) {
      // 2回目以降は5パターンを順番に。毎回ちがう理由で「次の○曜日に十五万」と頼まれる（作者指定）
      const i = (G.flags.careCallIdx || 0) % STORY_CARE_CALLS.length;
      G.flags.careCallIdx = (G.flags.careCallIdx || 0) + 1;
      scenes.push(...careCallScene([STORY_CARE_CALLS[i]]));
    }
  }
  // 親父は最後まで病院から出ない（作者指定）。評判が広まったと母から電話が来るだけで、店には現れない。
  // これもお見舞いの夜とは重ねない（見舞いのない夜に繰り下げ）
  if (G.rep >= 30 && !G.flags.father && !(G.today.care > 0)) {
    G.flags.father = true; scenes.push(...STORY_FATHER);   // 評判のマイルストーン演出。関係ゲージは廃止
  }
  /* 鬼頭が来なくなってから黒田が現れるまでの7日間に、感謝の場面を2つ挟む（作者指定＝中弛み防止）。
     2日目＝親子連れ、5日目＝金髪の兄ちゃん。何も起きない日が7日続くと、緊張が抜けてしまう */
  const kEnd = G.flags.kitoEndDay || 0;
  if (kEnd > 0 && !scenes.length) {
    if (G.day - kEnd === 2 && !G.flags.kitoAfterKazoku) {
      G.flags.kitoAfterKazoku = true; scenes.push(...STORY_KITO_AFTER_KAZOKU);
      G.najimi = clamp(G.najimi + 4, 0, 100);
    } else if (G.day - kEnd === 5 && !G.flags.kitoAfterKinpatsu) {
      G.flags.kitoAfterKinpatsu = true; scenes.push(...STORY_KITO_AFTER_KINPATSU);
      G.najimi = clamp(G.najimi + 4, 0, 100);
    }
  }
  // 常連客イベント：評判が育つと、数日おきに常連との一幕が起きて絆(najimi)が深まる
  if (!scenes.length && G.rep >= 18 && finishedDay - (G.flags.lastNajimiDay || 0) >= 6) {
    const ev = STORY_NAJIMI[G.flags.najimiIdx || 0];
    if (ev) {
      G.flags.najimiIdx = (G.flags.najimiIdx || 0) + 1; G.flags.lastNajimiDay = finishedDay;
      G.najimi = clamp(G.najimi + ev.gain, 0, 100); scenes.push(...ev.scenes);
    }
  }
  // 親父の和解イベント（STORY_OYAJI_CLEAR）は廃止（作者指定）。和解＝親父復活はエンディングで描く
  if (scenes.length) Story.play(scenes, enterPrepPhase);
  else enterPrepPhase();
}

/* 4つの対立をすべておさめたらエンディング（第1章 完 → 第2章 独立編へ）。
   親父の和解ゲートは廃止（作者指定）＝玲奈を倒せばどうせ和解する。復活はエンディング内で描く */
function checkGrandEnding() {
  if (!G.solved || G.flags.ended) return false;
  if (!PROBLEMS.every(p => G.solved[p.key])) return false;
  G.solved.oyaji = true;                 // エンディング＝和解成立（投票の親父票などの整合用）
  G.flags.ended = true; saveGame();
  Story.play(STORY_ENDING, () => {
    // クリア後はタイトルに戻さず、そのまま自由に営業を続けられる（フェーズ4・作者指定）
    G.flags.freePlay = true;
    toast(`🎉 第1章クリア！ このまま${G.name}を自由に営業できる`);
    enterPrep(); saveGame();       // enterPrep が夜の曲に戻す
  });
  Sfx.bgm('ending');               // ストーリー用の曲より、こちらを優先してかける
  return true;
}

function enterPrep() {
  G.phase = 'prep';
  /* 第2章は準備も【館内案内図】から始める（どこへ手を入れるかを、まず選ぶ）。
     第1章は区画がひとつなので、いつもの画面をそのまま出す */
  if (areaCount() > 1) { if (!chHook('nightKeepView')) openGuide(); }
  else enterAreaScreen(0);
  Sfx.bgm('prep');                 // 暖簾を下ろしたあとの夜の曲
  G.customers = []; G.payQueue = [];
  /* 準備中の主人公は掃除して回る（1晩に拭ける数は prepCleanMax() まで）。
     第2章は表示中の区画がどこでも、番台のある区画で作って立たせる */
  if (areaCount() > 1) {
    /* 準備中も**持ち場に立たせる**（2026-08-08 修正）。
       ここは `: 0`（1区画目の直書き）のままだった＝営業開始側だけ直して、
       こちらを見落としていた。**第1章では区画が1つなので永久に同値**で捕まらない  */
    const deskF = playerArea(), back = G.actF;
    applyArea(deskF, true);
    G.player = makePlayer(); G.player.f = deskF;
    applyArea(back, true);
  } else G.player = makePlayer();
  G.prepCleaned = 0;               // 今夜これから拭いた数
  G.tiredSaid = false;             // 「もう動けない」の独り言は1晩に1回
  // 銀行融資は廃止（作者指定）。サラ金はその場で現金が出るので、振込待ちという状態はもう無い
  G.staff = [];                    // バイトは準備中いなくなる。営業開始で戻る（作者指定）
  /* 章が「準備中も立っている人」を持っていれば置く（第2章＝妻が番台に立つ）。
     準備中は updateStaff が回らないので、立ち姿の絵として置くだけ＝掃除も会計もしない。
     これが無いと、**開店前の受付から妻が消えて「番台に誰も立たない」ように見えていた**
     （作者報告 8/9・第1章はフックが無いので今までどおり誰も居ない）             */
  for (const ex of (chHook('prepWorkers') || [])) if (ex) G.staff.push(ex);
  const careLine = careBubbleText();
  // 治療費の話は日報でなく主人公の独り言で（作者指定）。融資入金の吹き出しが出ている朝はそちらを優先
  if (careLine && !G.player.bub) bubble(G.player, careLine, 5.0);
  G.adBought = {};
  $('bizPanel').classList.add('hidden');
  $('prepPanel').classList.remove('hidden');
  if (!onGuide() && !onHome()) $('shopPanel').classList.remove('hidden');   // 案内図では出さない
  syncAreaBar();               // 第2章：最初の部屋に立った時点から【← 館内案内図】を出す
  $('btnStaffMgr').classList.add('hidden');   // 【運営】の中へ移した（作者指定 8/2）
  // 【📰 広告】も、第2章では【館内案内図】の「集客」タブへ移した（作者指定 8/2）
  $('btnSenden').classList.toggle('hidden', !!CONF.staffRooms);
  // 【🏦 融資】も【運営】の中へ移した（作者指定 8/8）。持たない章は下に出したまま
  $('btnLoan').classList.toggle('hidden', !!CONF.loanInManage);
  $('btnLoanBiz').classList.toggle('hidden', !!CONF.loanInManage);
  // 【📌 注文】は、誰かに何か言われてから出す（第1章では一度も出ない）
  $('btnMission').classList.toggle('hidden', !chHook('kuwataBoard'));
  syncTip();                   // 上の一行（「ゴミを片付けよう。あと○個」）
  // 第2章：応募者は朝の準備中に来る＝開店前に持ち場まで決められる
  if (CONF.staffRooms && G.jobAdDay && G.day >= G.jobAdDay) { G.jobAdDay = 0; openJobModal(); }
  chHook('syncKaigyoBtn');     // 第2章：開業前は【営業開始】が【開業準備】になる
  chHook('syncHomeBtn');       // 第2章：【🏠 家】は準備中だけ出す
  renderShop();
  const broken = G.equip.filter(e => (CONF.wearPerDay[EQ[e.id].cat] ?? 0) > 0 && e.cond <= 0);
  const demands = demandHint();
  /* 章が自前の案内を持っていれば、そちらに任せきる（空なら黙る）。
     第2章は「あと何個」を上の一行へ移したので、下は出さない場面が多い（作者指定） */
  if (hasHook('prepHint')) {
    setHint(chHook('prepHint'));
  } else if (G.day === 1 && !G.flags.tut && (G.chapter || 1) === 1) {
    /* ⚠ 第1章だけ。第2章はこの文を持たない（上の帯「2階にサウナを置こう」が
       案内役なので、同じ話を下の帯でもう一度しない・作者指定 8/9） */
    setHint('🛁 ここが夕凪湯だ。下のメニューで設備を買って配置しよう。<br>おすすめは【サウナ】＋【水風呂】＋【ととのいイス】。<br>準備ができたら「🏮 営業開始」！');
  } else if ((G.roughDays || 0) >= 1) {
    // 汚れ・行列を放置した日が続くと、客が設備を壊しに来る。壊れてから知らせても遅い
    const limit = CONF.riotDays;
    setHint((G.roughDays >= limit
      ? `💢 <b>客の我慢は限界だ。</b>今日にも誰かが設備を壊しに来るぞ。<br>`
      : `😠 昨日は<b>荒れた一日</b>だった。あと${limit - G.roughDays}日続くと客が暴れ出す。<br>`) +
      `原因は<b>汚れの放置</b>と<b>待たせすぎ</b>。開店前に掃除して、混んでいる設備を増やそう。<br>` +
      `<span class="opt-sub">【データ】の「客の不満」を見れば、何に怒っているか分かる</span>`);
  } else if (G.lastTurnedAway > 0) {
    /* 入れずに帰した客がいた日は、それが何より先に直すべきこと（日報の数字だけでは気づけない）。
       **理由は章によって違う**（第2章＝1階の靴箱か、どの階の脱衣ロッカーか）。
       ここを決め打ちにしていたので、第2章では「【脱衣所】タブでロッカーを増やそう」と
       毎朝ウソを言うところだった */
    setHint(chHook('turnAwayHint', G.lastTurnedAway) ||
      `🚪 昨日、<b>${G.lastTurnedAway}人</b>がロッカー満杯で入れずに帰った。<br>` +
      `いまの受入は<b>${lockerCapacity()}人</b>。【脱衣所】タブでロッカーを増やそう。<br>` +
      `<span class="opt-sub">目安＝1日の客数の半分。12連結ロッカーなら2マスで12人ぶん</span>`);
  } else if (broken.length) {
    // 修理は手動が基本。オート修理（課金）を購入した店だけ、開店すれば勝手に業者が来る
    setHint(`🔧 <b>${broken.map(e => EQ[e.id].name).join('・')}</b> が故障中。<br>設備をタップして【🔧 修理】を押して業者を呼ぼう。<br>` +
      (autoRepairEnabled() ? '（オート修理が有効：放っておいても業者が来る）' : '直すまで、客はその設備を使えない'));
  } else if (demands.length) {
    setHint(demands.join('<br>'));
  } else if (G.reina && G.reina.duel === 'announced') {
    // 投票対決の準備期間：残り日数と見込み票を最優先で見せる（追い込みの目標）
    const d = Math.max(0, G.reina.duelDay - G.day);
    setHint(`🗳 サウナ天下分け目の投票対決まであと${d}日！　見込み票 夕凪 ${computeYuVotes()} / 蒼天 約${SOUTEN_DUEL_VOTES}<br>設備を磨き、常連の絆を深めて“帰ってきたい湯”にしろ（準備期間は競合圧が最高潮）`);
  } else if (G.flags.freePlay) {
    // クリア後の自由営業。もう追われるものはない＝好きなだけ理想の湯を育てられる（フェーズ4）
    const next = nextUnlockEq();
    setHint(`🎉 第1章クリア！ 夕凪湯は街の湯として蘇った。<br>ここからは自由営業。追い立てるものはもう無い。` +
      (G.rep < 100 ? `<br>🎯 評判100を目指して全設備を解放しよう（いま ${G.rep}）`
                   : (next ? `<br>🎯 次の解放：${nextUnlockText(next)}` : `<br>評判は最高の100。あとは思うまま、最高の湯を`)));
  } else {
    // 次に解放される設備を準備画面に出しておく（目標が見えるように）
    const next = nextUnlockEq();
    setHint(next ? `🎯 次の解放：${nextUnlockText(next)}（いま ${G.rep}）` : null);
  }
  updateTopbar();
  // 閉店後の人事イベント＝賃上げ相談。
  // ※旧「熱波師の紹介」（黒田クリア＋サウナ設置で自動加入）はフェーズ4で廃止。
  //   熱波師は玲奈への再挑戦チェーン（作戦会議→決戦仕様のサウナ→特別映像③）でだけ加入する（作者指定）
  maybeStaffRaise();
}

/* =========================================================
   重要人物・修理業者・取り立ての“歩いてくる”演出
   モブ客と同じようにドット絵で入口から歩いてきて、番台の前で話しかけてくる。
   顔つき（髪・髭・サングラス・ヘルメット）で誰なのかが分かるようにしてある。
   ========================================================= */
const NPC_LOOK = {
  tadokoro: { name:'田所',     hair:'#e6e6e6', cloth:'#6a7a5a', beard:'#dcdcdc', brow:true },
  kuroda:   { name:'黒田',     hair:'#1e1e22', cloth:'#2b3340', tie:'#7a1f2b', part:true },
  reina:    { name:'玲奈',     hair:'#e6c860', cloth:'#8e1f38', female:true, lips:true, dress:true },   // 金髪ロング＋ドレス（作者指定）
  kito:     { name:'鬼頭',     hair:'#161616', cloth:'#3a2030', bald:true, shades:true, tie:'#c9a86a', beard:'#2a2a2a' },
  haida:    { name:'灰田',     hair:'#2a2a2a', cloth:'#4a4a52', glasses:true, bag:true },
  fixer:    { name:'修理業者', hair:'#3a2a1a', cloth:'#3a6a8a', helmet:'#ffd24a' },
  thug:     { name:'若い衆',   hair:'#161616', cloth:'#20222b', bald:true, shades:true },
};
function makeNpc(key, ox) {
  const L = NPC_LOOK[key];
  const e = makeEntity(CONF.entrance.x, CONF.entrance.y, CONF.npcSpd);
  if (ox) e.px += ox;
  Object.assign(e, {
    kind: 'npc', npc: key, look: L, role: 'visit', state: 'in', timer: 0, hit: 0, targets: [],
    type: { name: L.name, hair: L.hair, cloth: L.cloth, sex: L.female ? 'f' : 'm', bald: !!L.bald, shades: !!L.shades },
  });
  return e;
}
/* 番台の前の“話しかけてくる位置”（行列の客と重ならないよう1マス奥） */
function npcSpot() {
  const ex = CONF.entrance.x, ey = CONF.entrance.y;
  for (const t of [{ x: ex, y: ey - 2 }, { x: ex + 1, y: ey - 1 }, { x: ex - 1, y: ey - 1 }, { x: ex, y: ey - 1 }])
    if (walkable(t.x, t.y)) return t;
  return { x: ex, y: ey - 1 };
}
function walkNpcTo(n, tile) {
  const t0 = tileOf(n);
  n.path = findPath(t0.x, t0.y, tile.x, tile.y) || [];
}
function sendNpcHome(n) { n.state = 'out'; walkNpcTo(n, CONF.entrance); }

/* その区画の間取りを当ててから中身を実行する（第1章＝区画がひとつなら、そのまま実行するだけ）。
   来訪者・修理業者は部屋をまたいで動くので、経路探索も当たり判定も
   **その人が今いる部屋の地図**でやらないと、永久に目的地へ着かない */
function inAreaOf(e, fn) {
  if (areaCount() <= 1) return fn();
  const back = G.actF;
  applyArea(e.f | 0, true);
  try { return fn(); } finally { applyArea(back, true); }
}
function updateNpcs(dt, only) {
  for (const n of (only ? [only] : [...G.npcs])) {
    switch (n.state) {
      case 'in':
        if (stepMove(n, dt)) { n.state = 'wait'; if (n.onArrive) { const f = n.onArrive; n.onArrive = null; f(n); } }
        break;
      case 'wait': break;
      case 'work': {           // 修理業者：トンカチでガンガンやる
        n.timer -= dt;
        n.hit += dt;
        if (n.hit > 3) { n.hit = 0; addSparkle(n.target.x * T + T / 2, n.target.y * T + T / 2); Sfx.play('fix'); }   // カンカン！（作者指定）
        if (n.timer <= 0) finishFix(n);
        break;
      }
      case 'smash': {          // 若い衆：バットで設備をバンバン叩く
        n.timer -= dt; n.hit += dt;
        if (n.hit > 2.4) { n.hit = 0; bashTarget(n); }
        break;
      }
      case 'out':
        if (stepMove(n, dt)) {
          const done = n.onDone;
          G.npcs.splice(G.npcs.indexOf(n), 1);
          if (done) done();
        }
        break;
    }
  }
}

/* ---- 修理業者 ----
   設備は耐久がゼロになると勝手に壊れ、勝手に業者がやって来て、直し終わった瞬間に
   業者の頭の上へ修理費がポーンと出て、その場で財布から引かれる。
   それに加えて、まだ動いている設備も【🔧 修理】ボタンで自分から呼べる（作者指定で復活）。
   ・代金は減った耐久のぶんだけ＝早く直しても損はしない（fixFee）
   ・自分で呼ぶぶんには準備中（営業時間外）でも来てくれる＝客に迷惑をかけずに直せる
   ・業者は1台直すたびに帰らない。近いものから続けて直して、用が済んでから引き上げる */
function fixerNpc() { return G.npcs.find(n => n.role === 'fixer'); }
function fixTargetCond(it) { return EQ[it.id].old ? 75 : 100; }
/* その設備を業者が直せるか（傷む設備で、まだ直す余地がある。作業中のものは除く） */
function fixable(it) {
  return (CONF.wearPerDay[EQ[it.id].cat] ?? 0) > 0 && it.cond < fixTargetCond(it) && !fixerOn(it);
}
function callRepairman(it, byPlayer) {
  const on = fixerNpc();
  if (on) {   // すでに来ている業者に「ついでにこれも」と頼む＝一度帰ってまた出直す、が無くなる
    if (on.target !== it && !on.queue.includes(it)) on.queue.push(it);
    if (byPlayer) toast(`🔧 ${EQ[it.id].name}も見てもらう（この後まわってくれる）`);
    return on;
  }
  const n = makeNpc('fixer');
  n.role = 'fixer'; n.queue = [];
  G.npcs.push(n);
  startFixTarget(n, it);
  // オート修理は耐久5%＝まだ壊れる前に業者を呼ぶ。壊れていないのに「壊れた」と書かない（作者指摘）
  toast(byPlayer ? `🔧 修理業者を呼んだ（${EQ[it.id].name}・${yen(n.fee)}）`
                 : `🔧 ${EQ[it.id].name}が${it.cond > 0 ? '壊れそうだ' : '壊れた'}。修理業者が来る（${yen(n.fee)}）`);
  return n;
}
/* いま直す1台を決めて、そこへ歩かせる */
function startFixTarget(n, it) {
  n.target = it; n.timer = 24; n.hit = 0;          // トンカチでガンガンやっている時間（実時間で3秒ほど）
  n.fee = fixFee(it);                              // 頼んだ時点の金額で固定（直し終わりに支払う）
  /* 直す相手が別の部屋にいるなら、業者もその部屋へ移す＝館内を歩いてきた扱いにして、
     その部屋の戸口から現れる。道順も、必ずその部屋の地図で引く */
  const to = it.f | 0;
  const ap = inAreaOf({ f: to }, () => {
    if ((n.f | 0) !== to) {
      n.f = to;
      n.px = CONF.entrance.x * T + T / 2;
      n.py = CONF.entrance.y * T + T / 2;
    }
    return pathToEquip(n, it);
  });
  n.path = ap ? ap.path : [];
  n.state = 'in';
  n.onArrive = () => { n.state = 'work'; log(`🔧 修理業者が${EQ[it.id].name}を直しはじめた`); };
}
/* 続けて直す相手を選ぶ。頼まれたぶん（queue）が先で、次に壊れているもの。
   どちらも「いま業者が立っている場所から近い順」＝店内を行ったり来たりしない */
function nextFixTarget(n) {
  /* 道が通っているかは、**その設備がある部屋の地図**で見る（部屋をまたいで頼まれることがある） */
  const ok = e => G.equip.includes(e) && e !== n.target && fixable(e) && G.cash >= fixFee(e)
                  && inAreaOf(e, () => {
                       // 同じ部屋なら今いる場所から、別の部屋ならその部屋の戸口から見る
                       const from = (e.f | 0) === (n.f | 0) ? n
                         : { px: CONF.entrance.x * T + T / 2, py: CONF.entrance.y * T + T / 2 };
                       return pathToEquip(from, e);
                     });
  const nearest = list => {
    let best = null, bd = Infinity;
    for (const e of list) {
      if (!ok(e)) continue;
      // 別の部屋のものは「遠い」扱い＝同じ部屋にあるものから片付けて、そのあと隣の部屋へ移る
      const same = (e.f | 0) === (n.f | 0);
      const d = Math.hypot(e.x * T + T / 2 - n.px, e.y * T + T / 2 - n.py) + (same ? 0 : 100000);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  };
  n.queue = (n.queue || []).filter(e => G.equip.includes(e));
  const asked = nearest(n.queue);
  if (asked) { n.queue.splice(n.queue.indexOf(asked), 1); return asked; }
  // ついで修理はオート修理（課金）の店だけ。手動の店は頼まれたぶんを直したら帰る
  if (!autoRepairEnabled()) return null;
  return nearest(G.equip.filter(e => e.cond <= AUTO_REPAIR_COND));
}
function finishFix(n) {
  const it = n.target;
  if (G.equip.includes(it)) {
    it.cond = fixTargetCond(it);
    addSparkle(it.x * T + T / 2, it.y * T + T / 2);
    // 支払いは直し終わってから。業者の頭の上に金額を出して、そのぶん現金が減る
    const fee = n.fee ?? fixFee(it);
    it.fault = null;                                               // 直ったので故障の規模は持ち越さない
    G.cash -= fee;                                                 // 足りなければマイナスのまま出す（作者指定）
    if (G.phase === 'biz' && G.today) G.today.repairCost += fee;   // 日報の「修理業者への支払い」に載る
    else G.invFix += fee;                                          // 準備中に直したぶんは「設備投資」の行に載る
    addFloater(n.px, n.py - 30, '-' + yen(fee));
    log(`✅ ${EQ[it.id].name}の修理が終わった（${yen(fee)}）`);
    toast(`🔧 ${EQ[it.id].name}を直してもらった（${yen(fee)}）`);
    updateTopbar();
    if (G.selected === it) selectEquip(it);                        // 開いているパネルの状態バーを描き直す
  }
  // 用が済んでいなければ、帰らずにそのまま次の1台へ
  const next = nextFixTarget(n);
  if (next) { startFixTarget(n, next); saveGame(); return; }
  sendNpcHome(n);
  saveGame();
}
/* オート修理（課金コンテンツ）が有効か。
   修理は手動が基本＝壊れたら設備をタップして【🔧 修理】で業者を呼ぶ。
   「オート修理」を購入した店だけ、耐久が5%まで減った設備に自動で業者が来る（修理費は手動と同じ） */
const AUTO_REPAIR_COND = 5;   // オート修理が発動する耐久(%)
/* 課金の売り場を出すか＝手元の非常スイッチ。false にすれば売り場ごと消える。
   実際に画面に出るかどうかは、これに加えて「ストアにつながっているか」（IAP.available()）で決まる＝
   PCのブラウザ版には出ない。決済は js/iap.js（StoreKit / Google Play Billing）*/
const PREMIUM_SALE = true;
/* 開発中か（localhost で開いているか）。製品版では常に false＝下の開発用スイッチは出ない */
function devBuild() {
  return location.protocol === 'http:'
    && (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
}
function autoRepairEnabled() {
  // 開発用スイッチ（買っていなくても効く。第1章では効かせない＝章の見張りを狂わせない）
  if (devBuild() && G.chapter !== 1 && G.premium && G.premium.devAutoRepair) return true;
  return !!(G.premium && G.premium.autoRepair && G.premium.autoRepairOn !== false);
}
/* 傷んだ設備を見つけたら、勝手に業者を呼ぶ（オート修理を購入した店だけ。同時に来るのは1人まで）。
   修理代が払えない日は業者が来てくれない＝壊れたまま営業することになる */
function autoRepair() {
  if (!autoRepairEnabled()) return;                            // 手動が基本。オート修理（課金）購入者だけ自動で来る
  if (G.npcs.some(n => n.role === 'thug')) return;             // 若い衆が暴れている最中は呼ばない
  if (G.npcs.some(n => n.role === 'fixer')) return;
  const broken = G.equip.filter(e => e.cond <= AUTO_REPAIR_COND && (CONF.wearPerDay[EQ[e.id].cat] ?? 0) > 0);
  if (!broken.length) return;
  // 直す順は「店が止まるものから」。ロッカーが全滅すると客は一人も入れないので、
  // 客席の多い風呂やサウナより先に直す（cap0なので、単純な人数順だと最後尾に回ってしまう）
  const prio = (e) => {
    const d = EQ[e.id];
    if (d.cat === 'locker' && lockerCapacity() <= 0) return 300;   // 入店そのものが止まっている
    if (!catExists(d.cat) || !hasWorking(e.id)) return 200 + (d.cap || 0);   // その種類が全滅している
    return 100 + (d.cap || 0);
  };
  broken.sort((a, b) => (prio(b) - prio(a)) || (EQ[b.id].price - EQ[a.id].price));
  // 一番直したいものが払えなくても、いま払える中でいちばん困っているものは直してもらう
  // （そうしないと高い設備の修理代が貯まるまで、安いロッカー1台さえ直らず店が死ぬ）
  const it = broken.find(e => G.cash >= fixFee(e));
  if (!it) {
    if (G.flags.noFixDay !== G.day) {
      G.flags.noFixDay = G.day;
      const top = broken[0];
      // オート修理は耐久5%で業者を呼ぶ＝まだ壊れてはいない。実際に壊れている時だけ「壊れた」と書く
      const yet = top.cond > 0;
      log(`⚠ ${EQ[top.id].name}が${yet ? '壊れそうだ' : '壊れたままだ'}（修理代 ${yen(repairCost(top))} が払えない）`);
      toast(`修理代が足りない…業者が来てくれない`);
    }
    return;
  }
  callRepairman(it);
}
function fixerOn(it) { return G.npcs.some(n => n.role === 'fixer' && n.target === it); }

/* ---- バットを持った若い衆が設備を壊しに来る（みかじめ拒否／ヤミ金の取り立て） ---- */
/* mode: 'break'=壊していく / 'take'=壊したうえで持って行く（借金のカタ） */
function startRaid(targets, mode, onDone) {
  if (!targets.length) { onDone && onDone(); return; }
  const queue = targets.slice(0, 3);
  const n = makeNpc('thug');
  n.role = 'thug'; n.mode = mode; n.targets = queue; n.onDone = onDone;
  nextRaidTarget(n);
  G.npcs.push(n);
  log(mode === 'take' ? '🏏 若い衆がバットを提げて上がってきた…' : '🏏 若い衆がバットを持って乗り込んできた！');
}
function nextRaidTarget(n) {
  while (n.targets.length) {
    const it = n.targets.shift();
    if (!G.equip.includes(it)) continue;
    const ap = pathToEquip(n, it);
    if (!ap) continue;
    n.target = it; n.path = ap.path; n.state = 'in'; n.timer = 9; n.hit = 0;
    n.onArrive = () => { n.state = 'smash'; toast(`🏏 ${EQ[it.id].name}が叩かれている…！`); };
    return;
  }
  sendNpcHome(n);
}
function bashTarget(n) {
  const it = n.target;
  if (!G.equip.includes(it)) { nextRaidTarget(n); return; }
  it.cond = Math.max(0, it.cond - 40);
  addFloater(it.x * T + ew(it) * T / 2, it.y * T + 6, '💥 バンッ！');
  addSparkle(it.x * T + ew(it) * T / 2, it.y * T + eh(it) * T / 2);
  // 客はこの光景に震え上がる
  for (const c of G.customers) if (Math.random() < 0.5 && !c.bub) { c.sat = clamp(c.sat - 6, 0, 100); bubble(c, pick(['ひっ…！', 'な、なんだ！？', '帰る…帰ります…'])); }
  if (it.cond <= 0) {
    breakEquip(it, true);   // 叩き壊されたぶんは手加減なし＝必ず大規模修理
    if (n.mode === 'take') {
      G.equip.splice(G.equip.indexOf(it), 1);
      log(`🚚 ${EQ[it.id].name}を借金のカタに持って行かれた`);
      toast(`🚚 ${EQ[it.id].name}を持って行かれた…`);
    } else {
      log(`💥 ${EQ[it.id].name}を叩き壊された`);
    }
    nextRaidTarget(n);
  }
}
/* 壊される候補（番台とアメニティ置き場は除く。高いものから狙われる） */
function raidTargets(nMax) {
  return G.equip.filter(e => e.id !== 'bandai' && EQ[e.id].cat !== 'amenity' && e.cond > 0)
    .sort((a, b) => EQ[b.id].price - EQ[a.id].price)
    .slice(0, nMax);
}

/* =========================================================
   サラ金「灰田ファイナンス」＝毎週水曜、集金が来る（作者指定＝銀行・ヤミ金は廃止し、ここ一本）
   ========================================================= */
function newYami() { return { debt: 0, met: false, missed: 0, lastDay: 0 }; }
/* 全額返済に要る額＝元本＋今週ぶんの金利。払えば残債0になり、灰田はもう来ない */
function yamiPayoff() {
  const y = G.yami; if (!y || y.debt <= 0) return 0;
  return y.debt + yamiDue();
}
/* 今週の金利。年率20%を52週で割ったぶん＝毎週これだけは払わされる。
   金利そのものは軽い（100万借りて週4千円弱）。効いてくるのは「限度が100万しかない」ことのほう＝
   借金で設備を揃えることはできず、稼いで返すしかない（作者指定の狙い） */
function yamiDue() {
  const y = G.yami; if (!y || y.debt <= 0) return 0;
  return Math.max(100, Math.round(y.debt * CONF.sarakinApr / 52 / 100) * 100);
}
function borrowYami(amount) {
  G.yami.debt += amount; G.cash += amount; G.yami.met = true;
  log(`💳 灰田ファイナンスから ${yen(amount)} 借りた。毎週水曜に集金が来る`);
  saveGame();
}
/* 開店直後に灰田が集金に来る（歩いてくる→モーダル） */
function startYamiCollect() {
  G.yamiFired = true;
  const due = yamiDue();
  if (due <= 0) return;
  G.paused = true; $('btnPause').textContent = '▶ 再開';
  Sfx.bgmStop();   // 取り立てのあいだは無音（みかじめと同じ扱い）
  const n = makeNpc('haida');
  n.role = 'visit';
  walkNpcTo(n, npcSpot());
  n.onArrive = () => showYamiModal(due);
  G.npcs.push(n);
  log('💳 灰田ファイナンスの集金だ…');
}
function showYamiModal(due) {
  G.yamiAsk = due;
  $('yamiTitle').textContent = YAMI_TEXT.collect.title;
  $('yamiInfo').innerHTML = YAMI_TEXT.collect.info(yen(due), yen(G.yami.debt));
  const box = $('yamiChoices'); box.innerHTML = '';
  const add = (label, sub, fn, danger, off) => {
    const b = document.createElement('button');
    b.className = 'big-btn' + (danger ? ' danger' : '');
    b.disabled = !!off;
    b.innerHTML = `${label}<br><span class="opt-sub">${sub}</span>`;
    b.onclick = fn; box.appendChild(b);
  };
  /* 返し方は3つ（作者指定）：ジャンプ（金利のみ）／返済する（金額バーで10万円刻み）／完済する。
     ジャンプを選び続ける限り、元本は1円も減らない＝いつまでも灰田が毎週やって来る */
  const debt = G.yami.debt;
  add(`🔄 ジャンプする（${yen(due)}）`,
    G.cash >= due ? `金利だけ。元本 ${yen(debt)} は1円も減らない` : '🔒 手元の資金が足りない',
    () => payYami(due, 0), false, G.cash < due);
  // 返せる元本の上限＝手元から今週の金利を引いた残りを10万円刻みに丸めたもの（残債は超えない）
  const unit = CONF.sarakinPrincipal;
  const maxPrin = Math.min(debt, Math.floor(Math.max(0, G.cash - due) / unit) * unit);
  add('💴 返済する', maxPrin >= unit
    ? `元本を10万円きざみで返す（最大 ${manYen(maxPrin)}）`
    : '🔒 金利のぶんを引くと、10万円も残らない',
    () => showYamiRepayBar(due, maxPrin), false, maxPrin < unit);
  const off = yamiPayoff();
  add(`💰 完済する（${yen(off)}）`,
    G.cash >= off ? '元本＋今週の金利。これで集金は二度と来ない' : '🔒 手元の資金が足りない',
    () => payYami(off, debt), false, G.cash < off);
  add('🙇 待ってくれ…', '金利が元本に乗り、設備を持って行かれる', () => failYami(), true);
  $('yamiModal').classList.remove('hidden');
}
/* 「返済する」を選んだあとの金額バー。つまみを動かして返す元本を決める（10万円きざみ）。
   渡す額は「金利＋選んだ元本」＝ジャンプぶんは必ず乗る。戻れば元の三択に帰れる */
function showYamiRepayBar(due, maxPrin) {
  const unit = CONF.sarakinPrincipal;
  const box = $('yamiChoices');
  box.innerHTML =
    `<div class="yami-bar">
       <div class="yami-bar-val">元本 <b id="yamiPrinVal">${manYen(unit)}</b> ＋ 金利 ${yen(due)}
         <br><span class="opt-sub">渡す額 <b id="yamiPayVal">${yen(due + unit)}</b>・残り <b id="yamiLeftVal">${yen(G.yami.debt - unit)}</b></span></div>
       <input type="range" id="yamiPrin" min="${unit}" max="${maxPrin}" step="${unit}" value="${unit}">
     </div>`;
  const b1 = document.createElement('button');
  b1.className = 'big-btn';
  b1.innerHTML = 'この額で返す<br><span class="opt-sub">灰田に渡す</span>';
  const b2 = document.createElement('button');
  b2.className = 'big-btn';
  b2.innerHTML = '↩ 戻る<br><span class="opt-sub">返し方を選び直す</span>';
  b2.onclick = () => showYamiModal(due);
  box.appendChild(b1); box.appendChild(b2);
  const sl = $('yamiPrin');
  const sync = () => {
    const p = +sl.value;
    $('yamiPrinVal').textContent = manYen(p);
    $('yamiPayVal').textContent = yen(due + p);
    $('yamiLeftVal').textContent = yen(G.yami.debt - p);
  };
  sl.oninput = sync;
  b1.onclick = () => { const p = +sl.value; payYami(due + p, p); };
}
function closeYamiVisit() {
  $('yamiModal').classList.add('hidden');
  const n = G.npcs.find(v => v.npc === 'haida');
  if (n) { n.onDone = resumeAfterVisit; sendNpcHome(n); } else resumeAfterVisit();
}
/* pay=実際に渡す額／principal=そのうち元本の返済に充てる額（利息ぶんは元本を減らさない） */
function payYami(pay, principal) {
  G.cash -= pay;
  G.yami.debt = Math.max(0, G.yami.debt - principal);
  G.today.yamiPaid += pay;
  if (G.yami.debt <= 0) { G.yami.debt = 0; toast('🎉 灰田ファイナンスを完済した…！'); log('💳 灰田への返済を終えた。もう来ない'); }
  else if (principal > 0) { toast(`灰田に ${yen(pay)} 払った（残り ${yen(G.yami.debt)}）`); log(`💳 灰田に ${yen(pay)} 払った`); }
  else { toast(`ジャンプした（金利 ${yen(pay)}）…元本は減っていない`); log(`💳 灰田にジャンプ。元本 ${yen(G.yami.debt)} はそのまま`); }
  closeYamiVisit(); updateTopbar(); saveGame();
}
function failYami() {
  G.yami.missed++;
  G.yami.debt += yamiDue();                                     // 払えなければ今週の金利が元本に乗る
  addRep(-2);
  log('💳 今週ぶんを払えなかった。灰田は笑って若い衆を呼んだ');
  $('yamiModal').classList.add('hidden');
  const h = G.npcs.find(v => v.npc === 'haida');
  if (h) sendNpcHome(h);
  startRaid(raidTargets(1), 'take', resumeAfterVisit);
  updateTopbar(); saveGame();
}

/* =========================================================
   重要人物の来訪スケジュール（作者指定）
   ・来訪は1日ひとりだけ。
   ・ミッションは一度始まったら毎日発生する＝要求→翌日確認→また要求…のリズム。
   ・田所編と鬼頭編は並行して進むが、同じ日には来ない＝両方その気なら1日おきに交代。
     例外は「鬼頭との決着3回目」＝主人公・鬼頭・田所が集合する場面。
   ・黒田編は鬼頭編が終わってから10日のクールダウンを置いて始まる。
   ========================================================= */
/* ミッションとミッションの間に置く休み（作者指定）：ひと編を終えてから10日間は次の編を始めない。
   稼いで立て直す期間を挟むためのもの。編の途中（要求→確認のサイクル）には挟まない */
const MISSION_COOLDOWN_DAYS = 10;
/* 鬼頭が来なくなってから黒田が現れるまで（作者指定で10日→7日）。
   間の2日目・5日目に感謝の場面が入るので、空っぽの日は実質4日だけになる */
const KURODA_AFTER_KITO_DAYS = 7;
/* 鬼頭編の登場間隔（作者指定）：鬼頭本人も若い衆も、ミッション中は7日ごとにしか来ない。
   毎日集金に来ると立て直す時間がなく、店が死ぬだけだったため */
const KITO_INTERVAL_DAYS = 7;
function missionCoolOK() { return G.day >= (G.flags.missionCoolUntil || 0); }
function startMissionCooldown() { G.flags.missionCoolUntil = G.day + MISSION_COOLDOWN_DAYS; }

/* 田所が夕凪湯を認める一幕は、昼の飛び込みではなく営業終了後の夜に流す（作者指定）。
   湯船の二人芝居 →「認めた」のモーダル、の順。条件を満たした夜に一度だけ起きる */
function maybeTadokoroKessenNight() {
  const t = G.tadokoro;
  if (!t || t.resolved || !t.met || !tadokoroKessenOK()) return false;
  bathCutThen(STORY_TADOKORO_BOND, 'bathTadokoroBond', () => openTadokoro('kessen'));
  return true;
}
/* 田所が認める条件は「注文を5つこなした」だけ（作者指定で評判52・絆55の縛りは撤廃）。
   評判の縛りがあると、店の格が伸び悩んだ時点で田所編も鬼頭編もまとめて止まってしまう＝
   プレイヤーの手でどうにもできない行き止まりになっていた。
   ここから【注文5つ × みかじめ2回】で、3回目の集金に田所が割って入る */
function tadokoroKessenOK() {
  const t = G.tadokoro;
  return t.met && (t.done || 0) >= TADOKORO_DEMAND_CLEAR;
}
/* 黒田が認めるのは「出す課題がもう無くなった時」（作者指定）。
   課題は評判70から逆算した11の基準（評価10項目＋減点ゼロ）で、満たすほど評判が70に近づく。
   評判70に届いた時点で評価の課題は役目を終え、最後に「手元資金50万」だけが残る。
   それも済んでいれば挨拶だけで終わる＝すでにやり切っている店に、同じ宿題は出さない */
function kurodaKessenOK() {
  const k = G.kuroda;
  if (!k || !k.met) return false;
  return kurodaTodo().length === 0;
}
function dueTadokoro() {
  const t = G.tadokoro; if (!t || t.resolved) return false;
  // 顔合わせ（名乗り）は昼の飛び込み来訪ではなく、1日目の営業終了後の夜に流す（作者指定）。
  // よって hello 前は昼の来訪者には選ばない
  if (!t.hello) return false;
  // 評判の縛りは撤廃（作者指定）。サウナに手を出した店を見て、小言を言いに来る――それだけが条件
  if (!t.met) return G.day >= (t.nextDay || 0) && hasCat('sauna');
  if (tadokoroKessenOK()) return false;   // 「認める」場面は昼ではなく、その日の営業終了後の夜に流す（作者指定）
  // 田所ミッションが始まったら、以降は毎日来る＝要求→確認→要求→確認…（作者指定）。
  // 途中でクールダウンは挟まない（挟むのは鬼頭編の終了後＝黒田編が始まる前だけ）
  return G.day >= (t.nextDay || 0);
}
function dueKitoShowdown() {
  // 新フロー（作者指定）：独立した「決着イベント」は廃止。毎回の来訪が「鬼頭の要求」の選択画面になり、
  // 3回目の来訪（startMikajime内で判定）で田所が割って入って解決する
  return false;
}
function dueMikajime() {
  const k = G.kito; if (!k) return false;
  if (!k.resolved && G.opts.banYakuza) {
    // 評判が出はじめる前の閑古鳥の店には、ヤクザも集金に来ない（繁盛の匂いを嗅ぎつけて来る）
    if (!k.met && G.rep < KITO_APPEAR_REP) return false;
    if (G.flags.banFirst && !k.met) return true;               // 初めてお断りにした翌営業日は必ず来る
    // 若い衆の集金も7日ごと（作者指定）。毎日たかられると立て直す間がない
    return G.day - (G.flags.lastMikaDay || 0) >= KITO_INTERVAL_DAYS;
  }
  if (k.resolved && k.ally && G.day - (k.lastAllyDay || 0) >= KITO_INTERVAL_DAYS) return Math.random() < 1 / 3;
  return false;
}
function dueKuroda() {
  const k = G.kuroda; if (!k || k.resolved) return false;
  // 黒田は「田所の一件が落ち着いてから」現れる＝焦点をひとつずつ
  // フェーズ4：黒田はヤクザ問題（鬼頭との決着）が片付くまで現れない（作者指定＝対立の完全直列化）
  // 黒田の初登場は「鬼頭との決着が付いてから10日後」（作者指定）。
  // 鬼頭編が終わった日（kitoEndDay）を起点にする＝決着前に黒田が割り込むことはない。
  // ※「みかじめを払い続ける」結末を選んだ場合、以後も“付き合い”の集金は続くが、
  //   ミッションとしての鬼頭編はそこで終わっているので、その日を起点にしてよい
  const kitoEnd = G.flags.kitoEndDay || 0;
  /* 評判の縛り（KURODA_APPEAR_REP）は撤廃（作者指定）。田所と同じ理由で、
     店の格が伸び悩むと物語まで止まってしまうため。順番（田所→鬼頭→10日）だけで進む */
  if (!k.met) return G.day >= (k.nextDay || 0)
    && !!(G.tadokoro && G.tadokoro.resolved) && !!(G.kito && G.kito.resolved)
    && kitoEnd > 0 && G.day >= kitoEnd + KURODA_AFTER_KITO_DAYS;
  // 黒田も始まったら毎日来る＝提案→確認→提案→確認…（作者指定）。
  // met済みでも鬼頭の決着チェックは外さない＝旧版で先走って登場してしまったセーブでも、決着前は黙らせる
  return G.day >= (k.nextDay || 0) && !!(G.kito && G.kito.resolved);
}
function dueReina() {
  const r = G.reina; if (!r || r.resolved || !r.met) return false;
  if (r.duel === 'announced') return false;                    // 勝負の5日間は揺さぶらない
  /* 買収提案は「出会いの4日目」ちょうどに来る（作者指定）＝ミッションのクールダウンでは遅らせない。
     ここを空けてしまうと、客足が半減したまま何日も何も起きない時間ができる */
  return G.day >= (r.nextDay || 0);
}
/* 鬼頭が片付いてから黒田が現れるまでの繋ぎ（作者指定）。
   仲間になった田所が2度だけ顔を出す＝1度目は古参とサウナーの衝突、2度目は水漏れの手伝い。
   ここを空けておくと、10日ぶん「誰も来ない日」が続いて物語が止まって見える */
function dueTadokoroFiller() {
  const t = G.tadokoro;
  if (!t || !t.resolved || !t.met) return false;
  if (!(G.kito && G.kito.resolved)) return false;      // 鬼頭が片付くまでは出さない
  if (G.kuroda && G.kuroda.met) return false;          // 黒田が来たら、もう繋ぎは要らない
  if ((t.filler || 0) >= 2) return false;              // 2回で打ち止め
  // 決着の2日後と5日後＝黒田が現れる7日後より前に、2回とも終わるようにする
  const start = (G.flags.kitoEndDay || 0) + 2;
  return G.day >= Math.max(start, t.fillerDay || 0);
}
function pickTodaysVisitor() {
  if (dueTadokoroConsult()) return 'tadokoroConsult';   // みかじめ2回の翌日、田所が異変を察して来る（最優先）
  if (dueKitoThanks()) return 'kitoThanks';             // お断りを下ろした翌日、鬼頭が礼を言いに来る
  /* 黒田の課題を果たしたのに、本人が受け取りに来ない問題（作者報告 8/7）。
     **田所は編が始まると毎日来る**ので、後ろに置かれた黒田の順番が永久に回らず、
     データ画面に「達成！次に来た時に見せよう」と出たまま止まっていた。
     果たした報告が待ちになっている日は、黒田を先に通す（1日ぶん田所を待たせるだけ） */
  if (kurodaReportDue()) return 'kuroda';
  /* 田所編と鬼頭編は並行して進むが、同じ日に二人は来ない＝両方その気なら1日おきに交代（作者指定）。
     ※鬼頭の来訪（みかじめ＝要求の選択画面）は必ずこの交代に混ぜること。
       田所は編が始まると「毎日来る」ので、鬼頭を後回しの判定に置くと永久に順番が回らず、
       ヤクザ編が一度も始まらないまま詰む（通しテストで実際に発生した）。
     例外は「鬼頭の3回目＝田所が割って入る決着」で、主人公・鬼頭・田所が集合する場面なので必ず優先する */
  const mikaDue = dueMikajime(), tadoDue = dueTadokoro();
  if (mikaDue && tadoDue) {
    // 田所の来訪とかち合った日は、田所が割って入る回を優先する（条件は kitoRescueReady に集約）
    const finale = kitoRescueReady();
    const who = finale ? 'mikajime' : (G.flags.lastDuo === 'mikajime' ? 'tadokoro' : 'mikajime');
    G.flags.lastDuo = who;
    return who;
  }
  if (mikaDue) { G.flags.lastDuo = 'mikajime'; return 'mikajime'; }
  if (tadoDue) { G.flags.lastDuo = 'tadokoro'; return 'tadokoro'; }
  if (dueKuroda()) return 'kuroda';
  if (dueTadokoroFiller()) return 'tadokoroFiller';     // 鬼頭のあと、黒田が来るまでの繋ぎ
  if (dueReina()) return 'reina';
  return null;
}
/* みかじめを2回払い、かつ田所が主人公を「認めた」あとで、田所が「困ってることはないか」と声をかけてくる。
   条件は【田所が認める × みかじめ2回以上】の掛け算（作者指定）＝
   認められていない相手のために、あの爺さんが体を張ることはない。それまでは自力で耐えるしかない */
function dueTadokoroConsult() {
  if (G.flags.tadokoroConsulted || !tadokoroAllyOn() || !G.kito || G.kito.resolved) return false;
  /* 予約日が入っていれば、その日から。入っていなくても【田所が認めた×集金2回以上】が揃っていれば来る
     （作者指定 8/5）＝一度も払わずに突っぱねてきた店でも、田所は異変に気づく。
     以前は「払った回数」でしか予約日が立たなかったので、この声かけごと来なかった */
  if (G.flags.tadokoroConsultDay) return G.day >= G.flags.tadokoroConsultDay;
  return (G.kito.encounters || 0) >= 2;
}
/* フェーズ3：「刺青・ヤクザお断り」を下ろした翌日、鬼頭が礼を言いに来る */
function dueKitoThanks() {
  return !!(G.flags.kitoThanksDay && G.day >= G.flags.kitoThanksDay &&
    !G.opts.banYakuza && G.kito && !G.kito.resolved);
}
/* 来訪＝ポーズして、そのキャラを入口から歩かせ、番台の前に着いたら本題（モーダル） */
function startVisit(key) {
  G.visitFired = true;
  if (key === 'mikajime') { startMikajime(); return; }
  G.paused = true; $('btnPause').textContent = '▶ 再開';
  Sfx.bgmStop();   // 歩いてくる姿が見えた時点で曲を止める＝本題が始まる前の緊張感（作者指定）
  // 鬼頭との決着だけはベンツで乗りつける（客の足も止まる。作者指定）。他は今までどおり歩いて来る
  if (key === 'kitoShowdown') {
    // フェーズ4：決着は3回構成（作者指定）。1〜2回目は自力（金で切るか・付き合うか・耐えるか）。
    // 3回目に田所が割って入り、特別シーン3枚で解決する
    G.kito.showdowns = (G.kito.showdowns || 0) + 1;
    G.kito.nextShowdownDay = G.day + KITO_INTERVAL_DAYS;   // 次に乗りつけるのは7日後（作者指定）
    log('🚗 黒塗りのベンツが乗りつけてきた…鬼頭との決着だ');
    if (G.kito.showdowns >= 3) {
      startBenz({ hold: true, thugs: true, onPark: () => startKitoRescue() });
    } else {
      startBenz({ hold: true, thugs: true, onPark: () => { buildKitoShowdown(); $('kitoModal').classList.remove('hidden'); } });
    }
    return;
  }
  // フェーズ3：玲奈の来店は真っ赤なフェラーリで乗りつける（作者指定）。降りて歩いて入ってくる
  if (key === 'reina') {
    log('🏎 真っ赤なフェラーリが乗りつけてきた…蒼天SPAの桐生玲奈だ');
    startBenz({ hold: true, car: 'ferrari', onPark: () => {
      const n = makeNpc('reina');
      walkNpcTo(n, npcSpot());
      n.onArrive = () => openReinaVisit2();
      G.npcs.push(n);
    } });
    return;
  }
  const who = (key === 'tadokoroConsult' || key === 'tadokoroFiller') ? 'tadokoro' : key === 'kitoThanks' ? 'kito' : key;
  const n = makeNpc(who);
  walkNpcTo(n, npcSpot());
  n.onArrive = () => {
    if (key === 'tadokoro') openTadokoroVisit();
    else if (key === 'tadokoroFiller') openTadokoroFiller();
    else if (key === 'tadokoroConsult') openTadokoroConsult();
    else if (key === 'kitoThanks') openKitoThanks();
    else if (key === 'kuroda') openKurodaVisit();
  };
  G.npcs.push(n);
  const first = key === 'tadokoro' && !G.tadokoro.hello;   // 名乗る前は名前を出さない
  log(first ? '🚶 白髪の爺さんが、勝手知ったる足取りで入ってきた…' : `🚶 ${NPC_LOOK[who].name}が暖簾をくぐってきた…`);
}
/* モーダルを閉じたら、そのキャラは帰っていき、営業が再開する（鬼頭決着はベンツで来ているので、その見送り） */
function dismissVisitor() {
  const n = G.npcs.find(v => v.role === 'visit');
  // 車で来ている来訪者（玲奈のフェラーリ）は、本人が入口まで戻って“乗り込んで”から発進させる。
  // 先に releaseBenz すると、玲奈を店に置き去りにして車だけ走り去ってしまう
  if (n) {
    n.onDone = () => { if (G.benz) releaseBenz(); resumeAfterVisit(); };
    sendNpcHome(n);
    return;
  }
  if (G.benz) { releaseBenz(); resumeAfterVisit(); return; }
  resumeAfterVisit();
}
function resumeAfterVisit() {
  if (G.phase === 'biz') { G.paused = false; $('btnPause').textContent = '⏸ 一時停止'; Sfx.bgm('biz'); }
}

/* =========================================================
   田所・黒田の「無茶な要求」＝ミッション
   ========================================================= */
/* 黒田の課題＝データ画面の10評価項目それぞれの「合格点」（作者指定）。
   評判70に到達するところから逆算した表で、10項目の合計は72。
   減点をゼロにしたうえでこの表を全部満たせば、評判は必ず70以上になる
   （どんなセーブから始めても同じ表を使う＝到達できない店が出ない）。
   すでに合格している項目は言い渡されない＝残っているものだけが課題になる */
const KURODA_ITEM_GOALS = {
  clean: 7, crowd: 7, cospa: 7, sauna: 8, furo: 7,
  mizu: 7, datsui: 8, rest: 7, dosen: 8, omote: 6,
};
const KURODA_ITEM_DEMANDS = REP_ITEMS.map(it => ({
  key: `item_${it.key}`,
  need: { type: 'item', key: it.key },
  ask: `データを見た。<b>${it.name}</b>が弱い。<br>そこを<b>{目標}</b>まで上げろ。客はちゃんと見てるぞ。`,
  get advice() { return repAdvice(it.key); },
  ok: `${it.name}が{目標}か。……数字で返してくるのは、悪くない。`,
}));
/* 減点はいくら項目を磨いても評判から直接引かれる＝ここを潰さないと70には届かない。
   黒田の課題のひとつとして「マイナスを全部消せ」を出す */
const KURODA_PEN_DEMAND = {
  key: 'nopen',
  need: { type: 'nopen' },
  ask: 'いくら中身を磨いても、<b>マイナスを抱えたまま</b>じゃ数字は伸びん。<br>データの<b>評判の減点</b>を、ぜんぶ消せ。',
  get advice() { return (repPenalties()[0] || {}).sub || 'データ画面の「評判の減点」を見ろ'; },
  ok: 'マイナスがゼロか。……守りを固めた店は、そう簡単には落ちない。',
};
/* 黒田の課題ぜんぶ（評価10項目＋減点ゼロ）。この11個が「基準」で、
   全部満たした時に黒田が認める＝そこから玲奈の話が始まる。
   ※旧・経営課題（利益/単価/常連/現金…）は KURODA_DEMANDS に残してあるが、
     合否の基準からは外した（達成しても評判70に効かないため。台詞は将来の別ミッション用） */
function kurodaMissions() { return KURODA_ITEM_DEMANDS.concat([KURODA_PEN_DEMAND]); }
/* 評判が目標に届いたあとの“最後の課題”（作者指定）＝手元資金50万円。
   評価をいくら磨いても、金が残っていなければ経営ではない――という黒田の締めくくり。
   すでに50万あれば言い渡されずに、そのまま認められる */
const KURODA_CASH_GOAL = 500000;
const KURODA_CASH_DEMAND = {
  key: 'cash50',
  need: { type: 'cash', yen: KURODA_CASH_GOAL },
  ask: `評判は届いた。だが最後に一つ。<br><b>手元に{目標}</b>、残してみせろ。<br>売上が立つ店と、金が残る店は別物だ。`,
  advice: '設備を買う手を止めて、数日ぶんの利益を手元に積め',
  ok: '{目標}か。……売上じゃなく、手元に残す。それができる奴は少ない。',
};
// 評判が目標に届いた（＝評価の課題は役目を終えた）か
function kurodaFinalPhase() { return G.rep >= KURODA_GOAL_REP || kurodaMissions().every(demandMet); }
/* まだ達成していない黒田の課題（達成済みのものは言い渡されない）。
   評判70に届いたら、残っている評価項目ではなく「資金50万」の一本に切り替わる */
/* 黒田が「受け取りに来る番」か＝課題を出したまま、その課題がもう達成されている状態（作者指定 8/7）。
   鬼頭の決着待ちで黙らせる縛り（dueKuroda の met 側）も、この報告だけは通す＝
   **プレイヤーがやることをやり終えているのに、話が進まない**状態を作らない */
function kurodaReportDue() {
  const k = G.kuroda;
  if (!k || !k.met || k.resolved || !k.demand) return false;
  const d = demandList('kuroda').find(x => x.key === k.demand);
  return !!d && demandMet(d) && G.day >= (k.nextDay || 0);
}
function kurodaTodo() {
  if (kurodaFinalPhase()) return demandMet(KURODA_CASH_DEMAND) ? [] : [KURODA_CASH_DEMAND];
  return kurodaMissions().filter(d => !demandMet(d));
}
// いまのその項目の点（データ画面の評価と同じ数字）
function itemScore(key) {
  const it = repScoreParts().items.find(i => i.key === key);
  return it ? it.v : 0;
}
function demandList(who) { return who === 'tadokoro' ? TADOKORO_DEMANDS : kurodaMissions().concat([KURODA_CASH_DEMAND]); }
function demandOf(who) {
  const st = who === 'tadokoro' ? G.tadokoro : G.kuroda;
  if (!st || !st.demand) return null;
  return demandList(who).find(d => d.key === st.demand) || null;
}
function cmpOp(a, op, b) { return op === '>=' ? a >= b : op === '<=' ? a <= b : a === b; }
/* 黒田の経営課題の目標値。rep と regular は「引き受けた時点の店＋α」なので、
   受けた瞬間に確定させて st.goal に焼き付ける（そうしないと、評判が上がるたびに目標も逃げていく）。
   まだ引き受けていない提示中の課題は、いまの店から計算した見込み値を返す */
function computeGoal(d) {
  const n = d.need;
  if (n.type === 'rep') return Math.min(96, Math.ceil(G.rep) + n.add);
  if (n.type === 'regular') return (G.regulars || 0) + n.add;
  if (n.type === 'profit' || n.type === 'tanka' || n.type === 'cash') return n.yen;
  if (n.type === 'sat') return n.v;
  // 評価項目の合格点は逆算表で固定（店の状態で目標が動かない＝どのセーブでも同じゴール）
  if (n.type === 'item') return KURODA_ITEM_GOALS[n.key] || 7;
  return 0;
}
// いま有効な目標値（引き受け済みなら焼き付けた値、まだなら見込み値）
function goalOf(d) {
  for (const st of [G.tadokoro, G.kuroda])
    if (st && st.demand === d.key && st.goal != null) return st.goal;
  return computeGoal(d);
}
function demandMet(d) {
  const n = d.need;
  const ls = G.lastStats || {};
  const g = goalOf(d);
  if (n.type === 'rep') return G.rep >= g;
  if (n.type === 'regular') return (G.regulars || 0) >= g;
  if (n.type === 'cash') return G.cash >= g;
  // 利益・客単価・満足度は「直近の営業日の成績」で見る＝1日だけでも出せば認められる
  if (n.type === 'profit') return (ls.profit || 0) >= g;
  if (n.type === 'tanka') return (ls.tanka || 0) >= g;
  if (n.type === 'sat') return (ls.avgSat || 0) >= g;
  if (n.type === 'item') return itemScore(n.key) >= g;
  if (n.type === 'nopen') return repPenalties().length === 0;
  if (n.type === 'equip') return hasWorking(n.id);
  if (n.type === 'remove') return !hasEquip(n.id);
  if (n.type === 'opt') return cmpOp(G.opts[n.opt], n.op, n.v);
  if (n.type === 'temp') return G.equip.some(e => EQ[e.id].cat === n.cat && e.cond > 0 && cmpOp(e.temp ?? EQ[e.id].temp, n.op, n.v));
  return false;
}
function demandLabel(d) {
  const n = d.need;
  const g = goalOf(d);
  if (n.type === 'rep') return `評判を ${g} まで上げる`;
  if (n.type === 'regular') return `常連を ${g}人 まで増やす`;
  if (n.type === 'cash') return `手元資金を ${yen(g)} まで積む`;
  if (n.type === 'profit') return `1日の利益を ${yen(g)} 以上にする`;
  if (n.type === 'tanka') return `客単価を ${yen(g)} 以上にする`;
  if (n.type === 'sat') return `客の満足度を ${g}点 以上にする`;
  if (n.type === 'item') return `${(REP_ITEMS.find(i => i.key === n.key) || {}).name}を ${g}点 まで上げる`;
  if (n.type === 'nopen') return '評判の減点をゼロにする';
  if (n.type === 'equip') return `【${EQ[n.id].name}】を置く`;
  if (n.type === 'remove') return `【${EQ[n.id].name}】を撤去する`;
  if (n.type === 'opt') return `入浴料を ¥${n.v} 以下にする`;
  // 浴槽・水風呂は温度固定＝「その温度の湯を置く」。サウナだけは今ある部屋の設定を上げても達成できる
  if (n.type === 'temp') return n.cat === 'sauna'
    ? `サウナを ${n.v}℃以上にする`
    : `${n.v}℃以上の${n.cat === 'furo' ? '風呂' : '水風呂'}を置く`;
  return '';
}
/* いま田所・黒田に要求されている設備か。要求中の品は、あとで評判が下がっても
   カタログでロックし直さない。ロックすると「要求されたのに買えない」＝物語が完全に止まる
   （通しシムで実際に発生：黒田が炭酸泉を要求 → その後わずかに評判が下がって再ロック →
     金も場所もあるのに買えず、黒田編が140日止まった） */
function isDemandedEquip(id) {
  for (const who of ['tadokoro', 'kuroda']) {
    const d = demandOf(who);
    if (d && d.need.type === 'equip' && d.need.id === id) return true;
  }
  return false;
}
/* ============ 設備の解放（作者指定 8/8）============
   章が `unlockInfo` を持てば、そちらが解放条件のすべてを決める。
   返すのは { ok: 買えるか, label: 🔒に出す文字 }、ゲートの無い品には null。
   （第2章＝8部門スコア。「水風呂60点で深い水風呂」のように部門ごとに開く。
     評判ひとつで開けていたら、飯0点・くつろぎ0点の2階建ての店が
     カタログ44品のうち41品を開けきっていた＝ゲートが機能していなかった）

   **フックを持たない章＝これまでどおり `def.rep` と `G.rep` の比較だけ**＝第1章は不変 */
function unlockOf(id) {
  const d = EQ[id]; if (!d) return null;
  if (hasHook('unlockInfo')) return chHook('unlockInfo', id, d) || null;
  return d.rep ? { ok: G.rep >= d.rep, label: '評判' + d.rep } : null;
}
function unlockOk(id) { const u = unlockOf(id); return !u || u.ok; }
/* 準備画面に出す「次に開くもの」。章が持たなければ、評判のいちばん近い1品 */
function nextUnlockEq() {
  if (hasHook('nextUnlock')) return chHook('nextUnlock') || null;
  return Object.keys(EQ).filter(k => k !== DUEL_ONLY_EQ && EQ[k].rep && EQ[k].rep > G.rep)
    .map(k => EQ[k]).sort((a, b) => a.rep - b.rep)[0] || null;
}
/* その1品の「あと何が要るか」を一言で。第1章は「評判45で【大カラン】」 */
function nextUnlockText(d) {
  if (!d) return null;
  return chHook('nextUnlockText', d) || `評判${d.rep}で【${d.name}】`;
}

/* まだ評判が足りずカタログに並んでいない設備は、要求されても買えない＝出題しない
   （替わり湯もフィンランド式サウナも、解放される評判まで来てから言い出す）。
   さらに「置ける場所が1マスも無い設備」も出題しない＝買えても置けない要求は詰みになる */
function demandBuyable(d) {
  if (d.need.type !== 'equip') return true;
  if (!unlockOk(d.need.id)) return false;
  return canPlaceAnywhere(d.need.id);
}
// その設備を置ける場所が、いまの間取りに1つでもあるか
function canPlaceAnywhere(id) {
  for (let y = 0; y < CONF.H; y++)
    for (let x = 0; x < CONF.W; x++)
      for (const rot of [0, 1]) { const c = placeCheck(id, x, y, null, rot); if (c && c.ok) return true; }
  return false;
}
function pickDemand(who) {
  const st = who === 'tadokoro' ? G.tadokoro : G.kuroda;
  st.doneKeys = st.doneKeys || [];
  /* 評価項目の課題は何度でも出せる（作者指定）＝「サウナを5点」の次は「8点」と、
     同じ項目をさらに上へ詰めていける。ここを一度きりにすると、
     16個の課題を配り終えた時点で評判が目標に届かず、また日常の一幕だけになる */
  const cands = demandList(who).filter(d => (d.need.type === 'item' || !st.doneKeys.includes(d.key))
    && d.key !== st.lastKey                            // 直前に出したものは続けて出さない（作者指定＝毎回ちがう提案）
    && !demandMet(d)                                   // すでに満たしているものは要求しない
    && demandBuyable(d)                                // まだ解放されていない設備は要求しない
    && (!d.only || !d.only.has || hasEquip(d.only.has)));
  if (!cands.length) {
    // lastKey を外した結果ゼロになった時だけ、条件を緩めて選び直す（提案が尽きて詰まらないように）
    const relaxed = demandList(who).filter(d => !st.doneKeys.includes(d.key) && !demandMet(d) && demandBuyable(d)
      && (!d.only || !d.only.has || hasEquip(d.only.has)));
    return relaxed.length ? pick(relaxed) : null;
  }
  /* 黒田は「まだ基準に届いていない課題」だけを出す（作者指定）。
     順番は合格点までの差がいちばん大きいところから＝どこから手を付けるかで迷わせない。
     減点ゼロの課題は、減点が残っているうちは最優先（磨いても引かれてしまうので） */
  if (who === 'kuroda') {
    const todo = kurodaTodo().filter(d => d.key !== st.lastKey);
    const list = todo.length ? todo : kurodaTodo();
    if (!list.length) return null;
    const pen = list.find(d => d.need.type === 'nopen');
    if (pen) return pen;
    return list.slice().sort((a, b) =>
      (itemScore(a.need.key) - goalOf(a)) - (itemScore(b.need.key) - goalOf(b)))[0];
  }
  return pick(cands);
}
/* セリフ中の {目標} を、その課題の目標値の表記に差し替える */
function fillGoal(text, d) {
  const n = d.need, g = goalOf(d);
  const label = (n.type === 'rep' || n.type === 'sat') ? `${g}`
    : n.type === 'item' ? `${g}点`
    : n.type === 'nopen' ? '0'
    : n.type === 'regular' ? `${g}人`
    : yen(g);
  return String(text || '').replace(/\{目標\}/g, label);
}
function askText(d) { return fillGoal(d.ask, d); }

/* 黒田の経営課題の「いまの数字」＝進捗。どれだけ足りないかを見せる */
function demandNow(d) {
  const n = d.need, ls = G.lastStats || {};
  if (n.type === 'rep') return `いま ${Math.round(G.rep)}`;
  if (n.type === 'regular') return `いま ${G.regulars || 0}人`;
  if (n.type === 'cash') return `いま ${yen(G.cash)}`;
  if (n.type === 'profit') return ls.paid ? `昨日 ${yen(ls.profit || 0)}` : 'まだ営業していない';
  if (n.type === 'tanka') return ls.paid ? `昨日 ${yen(ls.tanka || 0)}` : 'まだ営業していない';
  if (n.type === 'sat') return ls.paid ? `昨日 ${ls.avgSat || 0}点` : 'まだ営業していない';
  if (n.type === 'item') return `いま ${itemScore(n.key)}点`;
  if (n.type === 'nopen') { const p2 = repPenalties(); return p2.length ? `いま −${p2.reduce((a, b) => a + b.v, 0)}点（${p2.length}件）` : 'いま 減点なし'; }
  return '';
}
/* 準備画面や「データ」に出す、いま抱えている宿題の1行 */
function demandHint() {
  const rows = [];
  for (const who of ['tadokoro', 'kuroda']) {
    const d = demandOf(who);
    if (d) rows.push(`${who === 'tadokoro' ? '🧓 田所' : '💼 黒田'}の要求：<b>${demandLabel(d)}</b>${demandMet(d) ? '（達成！次に来た時に見せよう）' : ''}`);
  }
  // 作戦会議で決めた目標＝再戦の条件。ここに出しておかないと「次に何をすればいいか」が消える
  const rm = G.flags && G.flags.reinaRematch;
  if (rm === 1) rows.push('❄ 今夜、黒田が世界一の熱波師を連れてくる');
  else if (rm === 2 && !hasWorking('sauna_sp'))
    rows.push(`❄ 再戦の支度：<b>${EQ.sauna_sp.name}</b>を組む（${yen(EQ.sauna_sp.price)}・据わった日に再挑戦できる）`
      // 終盤は床が埋まりきっていることがある＝ここで詰まると物語が止まるので、逃げ道を出す
      + (canPlaceAnywhere('sauna_sp') ? '' : '<br><span class="opt-sub">置き場所がない。古いサウナを売れば、その跡地に置ける</span>'));
  /* 【その他】の減点は直せばその場で消える＝いちばん割のいい一手なので、タスクの先頭に出す（作者指定）。
     とくに「お断り看板」「マット置き場」「垢すり置き場」「ドライヤー無料」はタダで直せる */
  const pen = repPenalties();
  if (pen.length) rows.unshift(`😠 評判の減点 <b>−${pen.reduce((a, b) => a + b.v, 0)}点</b>：`
    + pen.slice(0, 3).map(x => `${x.l}（−${x.v}）`).join('・') + (pen.length > 3 ? ` ほか${pen.length - 3}件` : '')
    + '<br><span class="opt-sub">直せばその日のうちに数字が戻る（データ画面に直し方）</span>');
  return rows;
}

/* ============ ログ・エフェクト ============ */
const floaters = [], sparkles = [];
// 金額がポーンと飛び出すやつ。売上はチャリーン、出費はバコーンと鳴らす
/* ============ ふわっと出る演出（+¥ と ✦）============
   **どの区画で起きたかを刻む**（作者指摘 8/8）。区画のある章（第2章）は
   営業中に全階ぶんを順番に計算するので、階を持たせないと
   **2階で拭いた✦が、表示している1階に出る**。
   実際に「誰も掃除していない1階でキラキラだけ光る（汚れは無いのに）」が起きていた。
   区画が1つしかない章では `G.actF` は常に 0 ＝これまでとまったく同じ            */
function addFloater(x, y, text) {
  floaters.push({ x, y, text, t: 1.6, f: G.actF | 0 });
  Sfx.play(String(text)[0] === '-' ? 'pay' : 'cash');
}
function addSparkle(x, y) {
  for (let i = 0; i < 6; i++)
    sparkles.push({ x: x + rand(-12, 12), y: y + rand(-10, 10), t: rand(.5, 1.1), f: G.actF | 0 });
}
/* 屋号の読み替え（作者指定）。台本もモーダルも通知も、書かれているのは親父の代の「夕凪湯」。
   プレイヤーが暖簾に別の名前を書いたら、画面に出る時にその屋号へ差し替える＝
   台本のあちこちに {店名} を書いて回らなくても、屋号がちゃんと物語に出てくる */
function shopify(s) {
  /* 章に関係なく読み替える。ログ・お知らせ・データ画面などは第1章の文面を共有していて、
     そこに「夕凪湯」と書いてあるものがある＝第2章でそのまま出ると、前の章の店の名前が
     いまの店として画面に出てしまう。
     例外は**物語の台本だけ**（js/story.js）。第2章の台本の「夕凪湯」は、
     本当に前の章の店を指しているので、そこだけは読み替えない */
  const nm = (typeof G !== 'undefined' && G.name) ? G.name : '';
  if (!nm || nm === '夕凪湯' || s == null) return s;
  return String(s).split('夕凪湯').join(nm);
}
function log(text) {
  text = shopify(text);
  const h = openHourNow() + (G.minutes / 60) | 0;
  G.logLines.unshift(`${String(Math.min(h, 23)).padStart(2)}時 ${text}`);
  G.logLines = G.logLines.slice(0, 2);
  $('bizLog').innerHTML = G.logLines.join('<br>');
}
/* 客の不満を、画面直下のお知らせ欄に赤文字で流す（作者指定）。
   これまで不満は日報を開くまで見えなかった＝営業中に手の打ちようがなかった。
   同じ不満を連呼させないよう、種類ごとにクールダウンを持たせる */
let gripeLogCd = {};
// 不満のセリフ＝吹き出し＋お知らせ欄の赤文字をセットで出す
function gripeBubble(c, line, kind) { bubble(c, line); logGripe(c.type.name, line, kind); }
function logGripe(who, line, kind) {
  const k = kind || line;
  const now = performance.now() / 1000;
  if (gripeLogCd[k] && now - gripeLogCd[k] < 12) return;
  gripeLogCd[k] = now;
  log(`<span class="log-gripe">😠 ${who}「${line}」</span>`);
}
/* 運営・データを開いているあいだは時間を止める（作者指定）。
   数字を読みながら考えている間に客が帰っていくのは理不尽なので。
   開く前の一時停止の状態は覚えておき、閉じた時にそこへ戻す（自分で止めていたなら止まったまま） */
let modalPauseMemo = {};
function openPausedModal(id) {
  const el = $(id);
  modalPauseMemo[id] = G.paused;
  if (G.phase === 'biz') { G.paused = true; $('btnPause').textContent = '▶ 再開'; }
  el.classList.remove('hidden');
  // 開くたびに必ず一番上から見せる（前回のスクロール位置を引きずらない。作者指定）
  const body = el.querySelector('.modal');
  if (body) body.scrollTop = 0;
}
function closePausedModal(id) {
  $(id).classList.add('hidden');
  if (G.phase === 'biz' && !modalPauseMemo[id]) { G.paused = false; $('btnPause').textContent = '⏸ 一時停止'; }
  delete modalPauseMemo[id];
}
let toastTimer = null;
function toast(text) {
  let el = $('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; $('game-ui').appendChild(el); }
  /* 上の一行（#tip・第2章の「2階にサウナを置こう」等）が出ている間は、その下に出す。
     CSSの定位置（topbar直下）だと帯と重なって両方読めなかった（作者報告 8/9）。
     帯を持たない章（第1章）は tip が無い＝これまでどおり定位置 */
  const tip = $('tip');
  el.style.top = (tip && tip.offsetParent && tip.offsetHeight)
    ? (tip.getBoundingClientRect().bottom + 6) + 'px' : '';
  el.textContent = shopify(text); el.style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.style.opacity = 0, 2200);
}
let lastHint = '';
/* ============ 上の一行 ============
   「いま何をすればいいか」を、上に短く一行だけ出す（作者指定）。
   下のヒント帯は長くて画面を食うので、**数えるもの**はこちらに持ってくる。
   第1章は topTip フックを持たないので、この帯は一度も出ない。          */
let tipFlashT = 0;
function syncTip() {
  const el = $('tip'); if (!el) return;
  if (tipFlashT > 0) return;                       // 「片付けた」を出している最中は上書きしない
  const t = chHook('topTip');
  el.classList.remove('flash');
  if (!t) { el.classList.add('hidden'); return; }
  el.innerHTML = t;
  el.classList.remove('hidden');
}
/* 何かを片付けた瞬間だけ、緑にして数秒出す。そのあと元の一行に戻る */
function flashTip(html, sec) {
  const el = $('tip'); if (!el) return;
  el.innerHTML = html;
  el.classList.remove('hidden');
  el.classList.add('flash');
  tipFlashT = sec || 2.2;
}
function stepTip(rDt) {
  if (tipFlashT <= 0) return;
  tipFlashT -= rDt;
  if (tipFlashT <= 0) { tipFlashT = 0; syncTip(); }
}

function setHint(html) {
  lastHint = html || '';
  const el = $('hint');
  // 案内図を開いているあいだは、ヒントの帯が間取りを隠してしまうので出さない
  if (!html || onGuide()) { el.classList.add('hidden'); return; }
  el.innerHTML = shopify(html); el.classList.remove('hidden');
}

/* ============ 描画 ============ */
const cv = $('game'), ctx = cv.getContext('2d');
resizeStage();                       // 画面の大きさは「いま開いている区画」に合わせる

function render(rt) {
  ctx.setTransform(CONF.SS, 0, 0, CONF.SS, 0, 0);
  ctx.imageSmoothingEnabled = false;
  drawFloorAndWalls(rt);
  if (G.benz) drawBenz(rt);
  if (isHomeArea(G.actF)) drawHome(rt);                     // 家の中（第2章）
  for (const d of G.dirts) if (inArea(d)) drawDirt(d);
  for (const j of G.junk) if (inArea(j)) drawJunk(j, rt);   // 開店前のゴミ・瓦礫（第2章）
  const shownRoach = roachAt(G.actF);
  if (shownRoach) drawRoach(rt, shownRoach);          // ゴキブリは床の上（設備の下）を這う
  drawRoachSplat(1 / 60);                             // 仕留めた跡
  /* 舗装や厨房の工事は「床そのもの」なので、設備の絵としては描かない（floorColor が塗る）。
     ここを id 名指しにしていたせいで、厨房の工事が床ではなく
     「厨房の工事」と書かれた札として1マスずつ並んでしまった              */
  const items = areaEquip().filter(e => !(EQ[e.id] && EQ[e.id].floorTile)).sort((a, b) => a.y - b.y);
  for (const it of items) drawEquip(ctx, it, rt);
  if (G.placing) drawGhost(rt);
  // 勤務時間の外は、主人公は店にいない（家にいる）＝画面にも出さない
  const ents = [...G.customers, ...G.staff.filter(workerHere), ...G.npcs, ...((G.player && onDuty()) ? [G.player] : [])]
    .filter(inArea).sort((a, b) => a.py - b.py);
  for (const e of ents) drawChar(e, rt);
  if (G.phase === 'biz' && nappaOn()) drawNappa();   // 熱波師は営業中だけサウナ室の前に立つ（夜は帰る）
  // 拭ける数（第2章は体力）を使い切ったら、番台で寝てしまう。※いま映している階に居るときだけ描く
  if (onDuty() && inArea(G.player || {}) && playerAsleep()) drawSleep(G.player, rt);
  drawSky();       // 屋外だけ、時刻に応じて暗くする（第2章のみ）
  drawLamps();     // 暗くなったら外灯が点く
  for (const e of ents) if (e.bub) drawBubble(e);
  drawEffects();
  drawEntryLimit(rt);
  if (G.selected) {
    const it = G.selected;
    ctx.strokeStyle = '#ffd98a'; ctx.lineWidth = 2;
    ctx.strokeRect(it.x * T + 1, it.y * T + 1, ew(it) * T - 2, eh(it) * T - 2);
  }
}

/* ロッカーが埋まって客を入れられない間、入口に「入場制限中」の立て看板を出す（作者指定）。
   黄色地に黒文字＝画面のどこよりも目立つ配色にして、「入れていない」ことに一目で気づけるようにする。
   ※番台の行列では出さない（並んでいるだけなら入場はできている。作者指摘で条件をロッカー満杯だけに絞った） */
function drawEntryLimit(rt) {
  if (G.phase !== 'biz') return;
  const waiting = lockersFull()
    || G.customers.some(c => c.state === 'waitLocker' || c.state === 'turnAway');
  if (!waiting) return;
  const cx = (CONF.entrance.x + 0.5) * T;
  // 番台の絵にかぶらないよう、店の外（下端の帯）の高さに置く。
  // 下壁を表示から削る章（第2章＝cropBottomWall）は、その帯が画面の外なので1行ぶん上げる
  const y = (CONF.H - 1 - (CONF.cropBottomWall ? 1 : 0)) * T - 5 + Math.sin(rt * 4) * 1.5;    // かすかに揺らして視線を引く
  const w = 84, h = 17;
  ctx.fillStyle = '#6b5a2a'; ctx.fillRect(cx - 2, y + h, 4, 9);        // 立て看板の脚
  ctx.fillStyle = 'rgba(0,0,0,.30)'; ctx.fillRect(cx - w / 2 + 2, y + 2, w, h);
  ctx.fillStyle = '#ffd400'; ctx.fillRect(cx - w / 2, y, w, h);
  ctx.strokeStyle = '#2e2400'; ctx.lineWidth = 2; ctx.strokeRect(cx - w / 2, y, w, h);
  ctx.fillStyle = '#000'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('入場制限中', cx, y + h - 5);
}

/* フェーズ4：熱波師。決戦仕様のサウナの中＝サウナストーンの横に立ち、
   左斜め上（座席の方）を向いて、1枚のタオルを両手で頭上からブオン！と振り下ろす（作者指定）。
   営業中だけ描く（夜は帰る） */
function drawNappa() {
  const it = G.equip.find(e => e.id === 'sauna_sp' && e.cond > 0);
  if (!it) return;
  /* 立ち位置は、部屋の真ん中のサウナストーンの手前（作者指定）。
     客は左・奥・右の三方から囲んでいるので、ここに立って右へ左へ振ると、全員に風が当たる */
  const x = (it.x + ew(it) / 2) * T;
  const y = (it.y + eh(it)) * T - 14;
  const t = Date.now() / 1000;
  /* 振りのリズム：構えて（0〜0.7）→一気に振り抜く（0.7〜0.85）→余韻。
     1周ごとに右・左と向きを変える＝右へ左へ、順番に風を送る */
  const cyc = t * 0.9, p = cyc % 1;
  const dir = Math.floor(cyc) % 2 ? -1 : 1;          // +1=右へ振る／-1=左へ振る
  const UP = -Math.PI / 2 - 0.35 * dir;              // 頭上やや後ろ
  const DOWN = dir > 0 ? -0.25 : Math.PI + 0.25;     // 振り抜き（右下／左下）
  const ease = p < 0.7 ? p / 0.7 : p < 0.85 ? 1 - (p - 0.7) / 0.15 * 1.9 : -0.9 + (p - 0.85) / 0.15 * 0.9;
  let d = DOWN - UP;                                  // 角度は近い方向に回す（一周してしまうのを防ぐ）
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const ang = UP + d * clamp(1 - ease, 0, 1);
  const snap = p >= 0.7 && p < 0.9;                  // 振り抜いた瞬間
  // 影
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath(); ctx.ellipse(x, y + 10, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
  // 体（熱波師の法被＝橙）
  ctx.fillStyle = '#c9502a'; ctx.fillRect(x - 5, y - 4, 10, 13);
  ctx.fillStyle = '#7a2a12'; ctx.fillRect(x - 5, y - 4, 2, 13); ctx.fillRect(x + 3, y - 4, 2, 13);
  // 頭＋白い鉢巻。振っている方を向く
  ctx.fillStyle = '#e8b890'; ctx.fillRect(x - 4, y - 13, 8, 9);
  ctx.fillStyle = '#f4f0e6'; ctx.fillRect(x - 4, y - 13, 8, 3);            // 鉢巻
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(x - 3 + dir, y - 9, 2, 2); ctx.fillRect(x + 1 + dir, y - 9, 2, 2);
  // 両腕＋タオル：両手で1枚のタオルの端を握り、頭上から左右へ振り抜く
  const grip = 10;
  const gx = x + Math.cos(ang) * grip, gy = (y - 8) + Math.sin(ang) * grip;
  ctx.strokeStyle = '#e8b890'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 3, y - 5); ctx.lineTo(gx, gy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 3, y - 5); ctx.lineTo(gx, gy); ctx.stroke();
  // タオル本体（振りの速い瞬間はしなって長く見せる）
  ctx.save(); ctx.translate(gx, gy); ctx.rotate(ang);
  const tl = snap ? 15 : 12;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, -2.5, tl, 5);
  ctx.fillStyle = '#cfe0e8'; ctx.fillRect(tl - 3, -2.5, 3, 5);
  ctx.restore();
  // 振った側へ飛んでいく熱波の弧。振り抜いた瞬間だけ濃く、遠くまで届く
  ctx.strokeStyle = snap ? 'rgba(255,200,130,.75)' : 'rgba(255,190,110,.45)';
  ctx.lineWidth = snap ? 1.5 : 1;
  for (let i = 0; i < 3; i++) {
    const ph = (t * 1.6 + i / 3) % 1;
    const dx = dir * (10 + ph * 26), dy = -6 - ph * 10;
    ctx.globalAlpha = 1 - ph;
    ctx.beginPath(); ctx.moveTo(x + dx - 6, y + dy); ctx.quadraticCurveTo(x + dx, y + dy - 4, x + dx + 6, y + dy); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  /* 「ブオン！」の文字は削除した（作者指定）。
     風の弧（左右のストローク）とタオルの動きだけで振り抜きを見せる＝
     文字が入ると、狭いサウナ室の絵がそれに食われてしまう */
}

/* そのマスに敷いてある「床そのもの」（舗装・厨房の工事）。無ければ null。
   floorTile の設備は、置いた範囲の床の見た目そのものを変える＝
   上を歩けるし、上に別の設備も置ける                                     */
function floorTileAt(x, y) {
  for (const e of G.equip) {
    const d = EQ[e.id];
    if (!d || !d.floorTile || !inArea(e)) continue;
    if (x >= e.x && x < e.x + ew(e) && y >= e.y && y < e.y + eh(e)) return e;
  }
  return null;
}
/* そのマスが舗装済みか（駐車場だけの話） */
function isPaved(x, y) { const t = floorTileAt(x, y); return !!t && t.id === 'p2_pave'; }
/* そのマスの床の色。第2章は区画ごとに床が違う（浴場タイル／畳／木床／砂利・アスファルト）。
   第1章は areaDef が null なので、これまでどおり「上が浴室・下が脱衣所」で描く */
function floorColor(x, y) {
  /* 章が内装（床の張り替え）を持っていれば、そちらを先に使う。
     第1章はこのフックを持たないので、これまでどおり */
  const nc = chHook('floorCol', x, y);
  if (nc) return nc;
  const a = areaDef(G.actF);
  if (!a) return (y < 7) ? ((x + y) % 2 ? '#cfd8d4' : '#c4cec9')     // 浴場タイル
                         : ((x + y) % 2 ? '#d9b98a' : '#d2b181');    // 脱衣所の木床
  /* ── 敷いてある「床そのもの」があれば、その色で塗る（厨房の工事・舗装）。
     工事した範囲がひと目で分かる＝どこまでが厨房かを、線ではなく色で見せる */
  const ft = floorTileAt(x, y);
  if (ft && EQ[ft.id].floorCol) {
    const c = EQ[ft.id].floorCol;
    return (x + y) % 2 ? c[0] : c[1];
  }
  // ── 駐車場（ロビー区画の下側）。買った時点は草の伸びた砂利。舗装すると色が変わる
  if (a.park && y >= a.divideY) {
    if (!isPaved(x, y)) {
      // 砂利＝粒のばらついた土色。マスごとに少しだけ濃さを散らして「均されていない」感じを出す
      const n = (x * 7 + y * 13) % 3;
      return n === 0 ? '#8d8272' : n === 1 ? '#877c6d' : '#918676';
    }
    return (x + y) % 2 ? '#565049' : '#514b45';                      // アスファルト
  }
  // ── 屋外ゾーン（浴室の上＝外気浴デッキを置く場所）
  if (a.outdoorY && y < a.outdoorY) return (x + y) % 2 ? '#6f7f5c' : '#677755';   // 屋外＝土と芝
  if (a.floor === 'bath')
    return (a.divideY && y >= a.divideY) ? ((x + y) % 2 ? '#d9b98a' : '#d2b181')   // 脱衣所の木床
                                        : ((x + y) % 2 ? '#cfd8d4' : '#c4cec9');  // 浴場タイル
  if (a.floor === 'tatami') return (x + y) % 2 ? '#cdc79a' : '#c5bf92';            // 畳
  return (x + y) % 2 ? '#d9b98a' : '#d2b181';                                     // 木床
}

/* 仕切りの無い区画（休憩スペース・食堂・駐車場のある区画）の、ただの四方の壁 */
/* 上壁の通路（作者指定）。ロビーの奥、休憩スペース・食堂の浴室側に開いている口。
   ここを抜けると建物の奥（廊下）へ出る＝下の入口からしか入れない部屋にしない */
function drawTopDoor() {
  /* 廊下は行き先のぶんだけ戸が並ぶ（topDoors）。ふつうの部屋は1つ（entranceTop） */
  if (CONF.topDoors) {
    const lab = CONF.topLabels || {};
    for (const dx of CONF.topDoors) drawOneTopDoor(dx * T, lab[dx] || '▲');
    return;
  }
  const e = CONF.entranceTop; if (!e) return;
  const x = e.x * T;
  if (isHomeArea(G.actF)) { drawHomeDoor(x); return; }   // 家は「奥への通路」ではなく玄関
  drawOneTopDoor(x, '▲奥へ');
}
function drawOneTopDoor(x, label) {
  ctx.fillStyle = '#7d6647';                                  // 向こう側＝廊下の床
  ctx.fillRect(x, 0, T, T);
  ctx.strokeStyle = 'rgba(0,0,0,.10)'; ctx.lineWidth = 1;
  for (let ly = 6; ly < T; ly += 10) { ctx.beginPath(); ctx.moveTo(x, ly + .5); ctx.lineTo(x + T, ly + .5); ctx.stroke(); }
  ctx.fillStyle = '#4a3528';                                  // 木枠
  ctx.fillRect(x - 3, 0, 4, T); ctx.fillRect(x + T - 1, 0, 4, T);
  ctx.fillStyle = '#8a6a3a';                                  // 敷居
  ctx.fillRect(x + 1, T - 4, T - 2, 4);
  ctx.fillStyle = '#c9a86a'; ctx.font = 'bold 8px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(label, x + T / 2, T - 7);
}
/* 家の玄関（上の中央）。店の自動ドアや引き戸ではなく、**片開きの玄関ドア**（作者指定）。
   左が丁番、右に縦長のハンドル。上に採光の小窓。内側は一段低いたたき。
   帰ってきた主人公はこの真下に立つ＝下から歩いて入ってこない            */
function drawHomeDoor(x) {
  const dw = T - 6, dx = x + 3, dh = T - 8;
  ctx.fillStyle = '#3b2f26'; ctx.fillRect(x - 4, 0, T + 8, T);          // 玄関まわりの壁
  ctx.fillStyle = '#6b5241'; ctx.fillRect(dx - 3, 0, dw + 6, dh + 2);   // ドア枠
  ctx.fillStyle = '#4a3528'; ctx.fillRect(dx - 3, 0, 3, dh + 2); ctx.fillRect(dx + dw, 0, 3, dh + 2);
  // 扉そのもの（一枚板）。丁番は左＝右へ引いて開ける
  ctx.fillStyle = '#8a5f3a'; ctx.fillRect(dx, 0, dw, dh);
  ctx.fillStyle = '#9c6d43'; ctx.fillRect(dx, 0, dw, 3);                // 上の面取り
  ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 1;               // framed パネルの彫り
  ctx.strokeRect(dx + 3.5, 6.5, dw - 7, dh - 11);
  ctx.strokeStyle = 'rgba(255,255,255,.10)';
  ctx.strokeRect(dx + 4.5, 7.5, dw - 9, dh - 13);
  ctx.fillStyle = 'rgba(214,228,236,.6)';                               // 採光の小窓
  ctx.fillRect(dx + dw / 2 - 6, 5, 12, 5);
  ctx.strokeStyle = '#c9d6dc'; ctx.lineWidth = 1;
  ctx.strokeRect(dx + dw / 2 - 5.5, 5.5, 11, 4);
  ctx.fillStyle = '#2b2119'; ctx.fillRect(dx + 1.5, 2, 1.5, dh - 4);    // 丁番側の合わせ目（左）
  ctx.fillStyle = '#3a3f44'; ctx.fillRect(dx + 1, 4, 2.5, 3);           // 丁番2つ
  ctx.fillRect(dx + 1, dh - 8, 2.5, 3);
  ctx.fillStyle = '#c9b06a'; ctx.fillRect(dx + dw - 6, dh / 2 - 5, 2.5, 10);   // 縦長のハンドル（右）
  ctx.fillStyle = '#8d7a44'; ctx.fillRect(dx + dw - 6, dh / 2 - 5, 2.5, 2);
  // 内側のたたき（三和土）＝一段低い土間。ここで靴を脱ぐ
  ctx.fillStyle = '#6b5a48'; ctx.fillRect(x + 1, dh, T - 2, T - dh);
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x + 1, dh, T - 2, 2);
  ctx.fillStyle = '#3f4348';                                            // 脱いだ靴ふたつ
  ctx.fillRect(x + 5, T - 5, 6, 3.5); ctx.fillRect(x + T - 12, T - 5, 6, 3.5);
}
/* 下壁の通路。休憩スペース・食堂は、下（ロビー側）からも入れる（作者指定）。
   壁の内部では entrance がもともと開いていたが、絵として描いていなかったので
   「行き止まりの部屋」に見えていた                                        */
function drawBottomDoor(W, H) {
  const e = CONF.entrance;
  if (!e || e.y !== H - 1) return;                             // 下壁に入口が無い区画は何もしない
  const x = e.x * T, y = (H - 1) * T;
  ctx.fillStyle = '#7d6647';                                   // 向こう側＝廊下の床
  ctx.fillRect(x, y, T, T);
  ctx.strokeStyle = 'rgba(0,0,0,.10)'; ctx.lineWidth = 1;
  for (let ly = y + 6; ly < y + T; ly += 10) { ctx.beginPath(); ctx.moveTo(x, ly + .5); ctx.lineTo(x + T, ly + .5); ctx.stroke(); }
  ctx.fillStyle = '#4a3528';                                   // 木枠
  ctx.fillRect(x - 3, y, 4, T); ctx.fillRect(x + T - 1, y, 4, T);
  ctx.fillStyle = '#8a6a3a';                                   // 敷居
  ctx.fillRect(x + 1, y, T - 2, 4);
  ctx.fillStyle = '#c9a86a'; ctx.font = 'bold 8px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('▼入口', x + T / 2, y + 13);
}
/* 壁の色。章が内装を持っていれば、そちらに差し替える（第2章＝壁の張り替え）。
   何も返さなければ、これまでどおりの色＝第1章の見た目は1ミリも変わらない */
function wallColA() { return chHook('wallCol') || '#5a4436'; }
function wallColB() { return chHook('wallCol2') || '#6b5241'; }

function drawPlainWalls(W, H) {
  ctx.fillStyle = wallColA();
  ctx.fillRect(0, 0, W * T, T);
  ctx.fillRect(0, 0, T, H * T); ctx.fillRect((W - 1) * T, 0, T, H * T);
  ctx.fillRect(0, (H - 1) * T, W * T, T);
  for (const wx of [0, (W - 1) * T]) {
    ctx.fillStyle = wallColB();
    ctx.fillRect(wx + (wx ? 0 : 3), T, T - 3, (H - 2) * T);
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1;
    for (let y = T + 8; y < (H - 1) * T; y += 10) {
      ctx.beginPath(); ctx.moveTo(wx + (wx ? 0 : 3), y + .5); ctx.lineTo(wx + (wx ? T : T), y + .5); ctx.stroke();
    }
  }
  drawBandaiSign(W);
  drawTopDoor();
  drawBottomDoor(W, H);
  /* 下壁を表示から削る章（第2章）は、見えている最下列に入口のマットを描く。
     フックの無い章（第1章）は何も起きない */
  chHook('drawEntryTile');
}
/* ============ 屋号の看板 ============
   店の名前は**番台の脇の壁**に一枚だけ掛ける（作者指定）。
   浴室の上壁からは外した＝湯に浸かって見上げるのは、店の名前ではなく富士山だ。
   だから看板が出るのは、番台のある部屋（ロビー）に立っているときだけ。      */
function drawBandaiSign(W) {
  const b = bandai();
  if (!b || (b.f | 0) !== (G.actF | 0) || !G.name) return;
  // 番台の左側。番台に寄せすぎず、左の壁からも離す
  const right = Math.max(T * 2.2, b.x * T - 6);
  const wd = Math.min(T * 3.6, right - T * 1.0);
  if (wd < T * 1.4) return;
  const x = right - wd;
  ctx.fillStyle = '#2f2116'; ctx.fillRect(x - 2, 4, wd + 4, T - 8);        // 縁（濃い木）
  ctx.fillStyle = '#4a3526'; ctx.fillRect(x, 6, wd, T - 12);               // 板
  ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(x, 6, wd, 2);      // 上端の艶
  // 吊り金具
  ctx.fillStyle = '#8a7a5a';
  ctx.fillRect(x + 5, 2, 2, 5); ctx.fillRect(x + wd - 7, 2, 2, 5);
  ctx.fillStyle = '#ffd98a';
  ctx.font = `bold ${wd > T * 3 ? 13 : 11}px "DotGothic16",sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(G.name, x + wd / 2, T - 11);
}

/* ============ 昼と夜 ============
   第2章は屋外（駐車場）があるので、朝・昼・夕・夜が画面に出る。
   暗くするのは**屋外だけ**（駐車場と外気浴デッキ）。屋内は照明があるので明るいまま。
   第1章は屋外が無いので CONF.dayNight を持たない＝この演出は一度も走らない */
function skyPhase() {
  if (!CONF.dayNight) return null;                  // ＝第1章
  const h = (((openHourNow() + G.minutes / 60) % 24) + 24) % 24;
  /* 時間帯の切れ目（作者指定 8/8）
       15〜17時 … 昼間      17〜19時 … 夕方
       19〜翌6時 … 夜       翌6時〜  … 昼間（＝深夜営業の終わりは、もう朝）
     ⚠ ここは `CONF.dayNight` を持つ章＝第2章しか通らない（上で null を返している） */
  let light;                                        // 1.0＝真昼 0.0＝真夜中
  if (h < 6) light = 0;                             // 夜（翌6時まで）
  else if (h < 6.5) light = (h - 6) / 0.5;          // 夜明けの30分で明ける
  else if (h < 17) light = 1;                       // 昼間
  else if (h < 19) light = 1 - (h - 17) / 2;        // 夕方（17〜19時で暮れきる）
  else light = 0;                                   // 夜
  const dusk = (h >= 17 && h < 19) ? Math.sin(Math.PI * (h - 17) / 2) : 0;       // 夕焼け
  const dawn = (h >= 5.5 && h < 7) ? Math.sin(Math.PI * (h - 5.5) / 1.5) : 0;    // 朝焼け
  return { h, light, dusk, dawn };
}
/* いまの区画の屋外の範囲（マスの行）。無ければ null
   外気浴デッキは**昼夜の差をつけない**（作者指定）。浴室の夜は富士山のペンキ絵で見せる */
function outdoorBand() {
  const a = areaDef(G.actF);
  if (!a || !a.park) return null;
  return { y0: a.divideY, y1: CONF.H };                        // 仕切りから下＝駐車場と国道
}
/* 空の色をかぶせる（屋外だけ） */
function drawSky() {
  const s = skyPhase(), b = outdoorBand();
  if (!s || !b) return;
  const top = b.y0 * T, hgt = (b.y1 - b.y0) * T, wid = CONF.W * T;
  const dark = (1 - s.light) * 0.58;
  if (dark > 0.01) { ctx.fillStyle = `rgba(14,22,52,${dark.toFixed(3)})`; ctx.fillRect(0, top, wid, hgt); }
  if (s.dusk > 0.02) { ctx.fillStyle = `rgba(214,118,46,${(s.dusk * 0.20).toFixed(3)})`; ctx.fillRect(0, top, wid, hgt); }
  if (s.dawn > 0.02) { ctx.fillStyle = `rgba(240,192,150,${(s.dawn * 0.15).toFixed(3)})`; ctx.fillRect(0, top, wid, hgt); }
}
/* 2色を混ぜる。t=0 で a、t=1 で b（#rrggbb のみ） */
function mixCol(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  const p = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const A = p(a), B = p(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}
/* 外灯の光。暗くなると点く＝「暗い駐車場に女性客は夜来ない」が目で分かるようになる */
function drawLamps() {
  const s = skyPhase();
  if (!s || s.light > 0.55) return;
  const on = 1 - s.light;
  for (const e of areaEquip()) {
    if (e.id !== 'p2_light' || e.cond <= 0) continue;
    const cx = e.x * T + ew(e) * T / 2, cy = e.y * T + eh(e) * T / 2;
    const r = T * 3.2;
    const g2 = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
    g2.addColorStop(0, `rgba(255,232,160,${(0.42 * on).toFixed(3)})`);
    g2.addColorStop(1, 'rgba(255,232,160,0)');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,244,200,${(0.9 * on).toFixed(2)})`;
    ctx.fillRect(cx - 3, cy - 3, 6, 6);
  }
}

function drawFloorAndWalls(rt) {
  const W = CONF.W, H = CONF.H;
  const area = areaDef(G.actF);
  // 駐車場は屋外＝左右に壁が無い。端(x=0/W-1)まで敷地で、いちばん下の行は敷地の外＝国道
  const parkY = (area && area.park) ? area.divideY : 0;
  // 床
  for (let y = 1; y < H - 1; y++) {
    const outdoor = parkY && y >= parkY;
    const x0 = outdoor ? 0 : 1, x1 = outdoor ? W : W - 1;
    for (let x = x0; x < x1; x++) {
      ctx.fillStyle = floorColor(x, y); ctx.fillRect(x * T, y * T, T, T);
      ctx.strokeStyle = 'rgba(0,0,0,.06)'; ctx.strokeRect(x * T + .5, y * T + .5, T - 1, T - 1);
    }
  }
  // 砂利の粒（舗装していない駐車場だけ。ざらついた見た目にする）
  if (parkY) {
    for (let y = parkY; y < H - 1; y++)
      for (let x = 0; x < W; x++) {
        if (isPaved(x, y)) continue;
        ctx.fillStyle = 'rgba(60,52,40,.35)';
        for (let i = 0; i < 5; i++) {
          const gx2 = x * T + ((x * 31 + y * 17 + i * 53) % T);
          const gy2 = y * T + ((x * 19 + y * 41 + i * 29) % T);
          ctx.fillRect(gx2, gy2, 2, 2);
        }
        // ところどころ雑草（二年ぶん伸びている）
        if ((x * 5 + y * 11) % 7 === 0) {
          ctx.fillStyle = '#5f6b46';
          ctx.fillRect(x * T + 12, y * T + 20, 2, 7);
          ctx.fillRect(x * T + 16, y * T + 23, 2, 4);
        }
      }
  }
  /* ── 建物の正面（ロビー↔駐車場）。ここから外は屋外なので、間仕切りではなく外壁と自動ドアを描く ── */
  if (parkY) {
    const fy = parkY * T;
    ctx.fillStyle = '#5a4436'; ctx.fillRect(0, fy - 9, W * T, 13);
    ctx.fillStyle = '#6b5241'; ctx.fillRect(0, fy - 9, W * T, 4);
    const ax0 = (CONF.doorX - 1) * T;
    ctx.fillStyle = 'rgba(198,232,242,.65)'; ctx.fillRect(ax0, fy - 14, 3 * T, 22);
    ctx.strokeStyle = '#4a3528'; ctx.lineWidth = 2; ctx.strokeRect(ax0, fy - 14, 3 * T, 22);
    ctx.fillStyle = '#c9a86a'; ctx.font = 'bold 9px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('自動ドア', ax0 + 1.5 * T, fy + 4);
    // 上壁は毎フレーム塗り直す（部屋を切り替えた時に、前の部屋の通路が残らないように）
    ctx.fillStyle = '#5a4436'; ctx.fillRect(0, 0, W * T, T);
    drawBandaiSign(W);             // 屋号は番台の脇の壁に一枚だけ（作者指定）
    drawTopDoor();                 // ロビーの奥＝建物の中へ抜ける通路
    // 国道の白い破線（敷地の外＝いちばん下）
    ctx.fillStyle = '#3d3b39'; ctx.fillRect(0, (H - 1) * T, W * T, T);
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    for (let x = 0; x < W * T; x += 26) ctx.fillRect(x, (H - 1) * T + T / 2 - 1, 14, 2);
    return;                      // ロビー＆駐車場は、この先の銭湯用の飾りは描かない
  }
  // 仕切りの無い区画（休憩スペース・食堂）は、間仕切りも引き戸も描かない
  // 家は店ではないので、屋号の看板は出さない
  /* 仕切りの無い区画（休憩スペース・食堂・家）は、間仕切りも引き戸も描かない。
     屋号の看板は**番台のある部屋にだけ**掛かる（drawBandaiSign）＝
     同じ名前が全部屋に並ぶとうるさいし、浴室で見上げるのは店の名前ではなく富士山だ */
  if (!CONF.divideY) { drawPlainWalls(W, H); return; }
  /* 屋外ゾーンと浴室の境（外気浴デッキへ出る戸）。
     ここを開けて外に出る＝サウナ→水風呂→外気浴、の導線がこの戸を通る */
  if (CONF.outdoorY) {
    const oy = CONF.outdoorY * T;
    ctx.fillStyle = '#6b533c'; ctx.fillRect(T, oy - 5, (W - 2) * T, 9);
    ctx.fillStyle = '#9c8465'; ctx.fillRect(T, oy - 5, (W - 2) * T, 3);
    const dx0 = CONF.doorX * T;
    ctx.fillStyle = '#3a2a1c'; ctx.fillRect(dx0 - 5, oy - 12, T + 10, 4);
    ctx.fillStyle = 'rgba(198,232,242,.6)'; ctx.fillRect(dx0, oy - 10, T, 18);
    ctx.strokeStyle = '#4a3528'; ctx.lineWidth = 2; ctx.strokeRect(dx0, oy - 10, T, 18);
    ctx.fillStyle = '#c9a86a'; ctx.font = 'bold 8px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('外気浴へ', dx0 + T / 2, oy + 14);
  }
  // ── 浴室と脱衣所の間仕切り壁＋中央のガラス引き戸 ──
  // ここが唯一の通り道。客も主人公もこの戸からしか行き来できない
  const dvy = CONF.divideY * T, dxL = CONF.doorX * T;
  const wTop = dvy - 5, wH = 9;
  ctx.fillStyle = '#6b533c';
  ctx.fillRect(T, wTop, dxL - T, wH);
  ctx.fillRect(dxL + T, wTop, (W - 1) * T - dxL - T, wH);
  ctx.fillStyle = '#9c8465';                                   // 腰壁のタイル面
  ctx.fillRect(T, wTop, dxL - T, 3);
  ctx.fillRect(dxL + T, wTop, (W - 1) * T - dxL - T, 3);
  ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1;      // タイル目地
  for (let vx = T + 8; vx < (W - 1) * T; vx += 16) {
    if (vx > dxL - 2 && vx < dxL + T + 2) continue;
    ctx.beginPath(); ctx.moveTo(vx + .5, wTop); ctx.lineTo(vx + .5, wTop + wH); ctx.stroke();
  }
  // 引き戸の枠（壁より上下に張り出させて「出入口」だと分かるようにする）
  const fTop = wTop - 7, fH = wH + 13;
  ctx.fillStyle = '#4a3528';
  ctx.fillRect(dxL - 5, fTop, 6, fH);
  ctx.fillRect(dxL + T - 1, fTop, 6, fH);
  ctx.fillStyle = '#3a2a1c'; ctx.fillRect(dxL - 5, fTop, T + 11, 4);        // 上レール
  ctx.fillStyle = '#6b4a2e'; ctx.fillRect(dxL - 5, fTop + fH - 3, T + 11, 3); // 敷居
  // ガラス2枚（左右に引き分けて中央が開いている）
  const paneW = T / 2 - 5;
  for (const px of [dxL + 1, dxL + T - 1 - paneW]) {
    ctx.fillStyle = 'rgba(198,232,242,.6)';
    ctx.fillRect(px, fTop + 4, paneW, fH - 7);
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1;
    ctx.strokeRect(px + .5, fTop + 4.5, paneW - 1, fH - 8);
    ctx.strokeStyle = 'rgba(255,255,255,.55)';                              // 映り込み
    ctx.beginPath(); ctx.moveTo(px + 1.5, fTop + fH - 5); ctx.lineTo(px + paneW - 2, fTop + 5); ctx.stroke();
    ctx.fillStyle = '#d8b46a';                                              // 引き手
    ctx.fillRect(px + (px === dxL + 1 ? paneW - 3 : 1), fTop + fH / 2 - 2, 2, 5);
  }
  // 開口部（通れる隙間）＝湯気が抜けて明るい
  const gapX = dxL + paneW + 2, gapW = T - paneW * 2 - 4;
  ctx.fillStyle = 'rgba(232,244,248,.5)';
  ctx.fillRect(gapX, fTop + 4, gapW, fH - 7);
  // 壁
  ctx.fillStyle = wallColA();
  ctx.fillRect(0, 0, W * T, T);
  ctx.fillRect(0, 0, T, H * T); ctx.fillRect((W - 1) * T, 0, T, H * T);
  ctx.fillRect(0, (H - 1) * T, W * T, T);
  // 左右は“内側の壁”＝ポスターや扇風機を掛けられる面。板張りに見せて、掛けられると分かるようにする
  for (const wx of [0, (W - 1) * T]) {
    ctx.fillStyle = wallColB();
    ctx.fillRect(wx + (wx ? 0 : 3), T, T - 3, (H - 2) * T);
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1;
    for (let y = T + 8; y < (H - 1) * T; y += 10) {                 // 板の継ぎ目
      ctx.beginPath(); ctx.moveTo(wx + (wx ? 0 : 3), y + .5); ctx.lineTo(wx + (wx ? T : T), y + .5); ctx.stroke();
    }
    ctx.fillStyle = '#8a6c52';                                       // 腰の見切り縁
    ctx.fillRect(wx + (wx ? 0 : 3), CONF.divideY * T - 3, T - 3, 3);
  }
  /* 上壁: 富士山のペンキ絵。**銭湯の絵なので、章によっては描かない**
     （第2章「横浜編」＝都市型サウナのビルに富士山は無い）。
     CONF.noMural を立てた章では、代わりに素の壁面だけを残す              */
  if (CONF.noMural) { drawTopDoor(); return; }
  const sky = skyPhase();
  const lit = sky ? sky.light : 1;
  const skyCol = mixCol('#1a2a4e', '#7ab8d8', lit);

  /* 上壁の絵は章で違う。
     第1章＝**屋号の看板＋その右に富士山**（これまでどおり。1行も変えない）。
     第2章＝**富士山だけ**（作者指定）＝湯に浸かって見上げるのは、店の名前ではなく山だ。
             店の名前はロビーの番台の脇に掛けてある（drawBandaiSign）          */
  if (!CONF.fujiWide) {
    ctx.fillStyle = skyCol; ctx.fillRect(T * 5.5, 4, T * 6.7, T - 8);
    ctx.fillStyle = mixCol('#9aa8c4', '#e8f0f2', lit);
    ctx.beginPath();
    ctx.moveTo(T * 7, T - 4); ctx.lineTo(T * 8.6, 8); ctx.lineTo(T * 10.2, T - 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = mixCol('#c8d2e6', '#ffffff', lit);
    ctx.beginPath();
    ctx.moveTo(T * 8.2, 13); ctx.lineTo(T * 8.6, 8); ctx.lineTo(T * 9, 13); ctx.lineTo(T * 8.6, 15); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffcf6a'; ctx.fillRect(T * 11.4, 8, 8, 8);
    ctx.fillStyle = '#3a2a1c'; ctx.fillRect(T * 1.2, 5, T * 3.6, T - 10);
    ctx.fillStyle = '#ffd98a'; ctx.font = 'bold 12px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(G.name, T * 3, T - 11);
  } else {
    const bx = T * 0.8, bw = T * (W - 1.6);            // 壁いっぱいに広げる
    ctx.fillStyle = skyCol; ctx.fillRect(bx, 4, bw, T - 8);
    const peak = bx + bw * 0.42;                       // 山の頂（すこし左寄り＝ペンキ絵らしく）
    ctx.fillStyle = mixCol('#9aa8c4', '#e8f0f2', lit);
    ctx.beginPath();
    ctx.moveTo(peak - T * 1.9, T - 4); ctx.lineTo(peak, 7); ctx.lineTo(peak + T * 1.9, T - 4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = mixCol('#c8d2e6', '#ffffff', lit); // 冠雪
    ctx.beginPath();
    ctx.moveTo(peak - T * 0.42, 13); ctx.lineTo(peak, 7); ctx.lineTo(peak + T * 0.42, 13);
    ctx.lineTo(peak + T * 0.12, 15.5); ctx.lineTo(peak - T * 0.16, 13.5);
    ctx.closePath(); ctx.fill();
    // 裾野の松（ペンキ絵の定番）。右下に小さく二本
    ctx.fillStyle = mixCol('#25402f', '#3f6a4a', lit);
    for (const px of [bx + bw * 0.74, bx + bw * 0.80]) {
      ctx.beginPath();
      ctx.moveTo(px - 5, T - 5); ctx.lineTo(px, T - 15); ctx.lineTo(px + 5, T - 5);
      ctx.closePath(); ctx.fill();
    }
    const sx = bx + bw * 0.92;
    if (lit > 0.5) {                                   // 昼＝お日さま（四角いペンキ絵のまま）
      ctx.fillStyle = '#ffcf6a'; ctx.fillRect(sx - 4, 8, 8, 8);
    } else {                                           // 夜＝三日月
      const my = 12;
      ctx.fillStyle = '#f2f4ff';
      ctx.beginPath(); ctx.arc(sx, my, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skyCol;                          // 空の色でえぐって欠けさせる
      ctx.beginPath(); ctx.arc(sx + 2.8, my - 1.6, 4.4, 0, Math.PI * 2); ctx.fill();
    }
  }
  /* 入口（下壁の開口部）を"入口らしく"。
     **下の壁に開いている階だけ**＝第2章の2階から上は、外への入口を持たない
     （エレベーターで上がってくるので、のれんも玄関マットも要らない）。
     第1章の入口は必ず下壁にあるので、これまでどおり描かれる            */
  if (CONF.entrance.y < CONF.H - 1) return;
  const ex = CONF.entrance.x, ey = CONF.entrance.y;
  const exX = ex * T, eyY = ey * T;
  // 開口部の外＝夜の外気
  ctx.fillStyle = '#1c2436'; ctx.fillRect(exX, eyY, T, T);
  // 両脇の木枠
  ctx.fillStyle = '#4a3528'; ctx.fillRect(exX - 3, eyY, 4, T); ctx.fillRect(exX + T - 1, eyY, 4, T);
  // 自動ドア風のガラス2枚
  ctx.fillStyle = 'rgba(190,225,235,.5)';
  ctx.fillRect(exX + 3, eyY + 8, (T - 8) / 2 - 1, T - 12);
  ctx.fillRect(exX + 3 + (T - 8) / 2 + 1, eyY + 8, (T - 8) / 2 - 1, T - 12);
  ctx.strokeStyle = '#cfe0e6'; ctx.lineWidth = 1;
  ctx.strokeRect(exX + 3, eyY + 8, T - 6, T - 12);
  ctx.beginPath(); ctx.moveTo(exX + T / 2, eyY + 8); ctx.lineTo(exX + T / 2, eyY + T - 4); ctx.stroke();
  // 敷居
  ctx.fillStyle = '#8a6a3a'; ctx.fillRect(exX + 1, eyY + T - 5, T - 2, 5);
  // のれん（開口の上に垂らす）＝男湯なのでネイビー（紺）
  ctx.fillStyle = '#1f3a6b'; ctx.fillRect(exX + 1, eyY, T - 2, 12);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fillRect(exX + T / 2 - 1, eyY + 2, 2, 10); ctx.fillRect(exX + 6, eyY + 2, 1, 10); ctx.fillRect(exX + T - 7, eyY + 2, 1, 10);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 9px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('ゆ', exX + T / 2, eyY + 10);
  // 内側の玄関マットと「入口」表示
  const my = (ey - 1) * T;
  ctx.fillStyle = 'rgba(180,90,70,.35)';
  ctx.beginPath(); ctx.roundRect(exX + 3, my + 10, T - 6, T - 12, 3); ctx.fill();
  ctx.fillStyle = '#7a4a3a'; ctx.font = 'bold 8px "DotGothic16",sans-serif';
  ctx.fillText('▼入口', exX + T / 2, my + T - 4);
  // 「刺青・ヤクザお断り」の掲示（運営メニューでオンにすると、入口右の壁に貼り出される。作者指定）
  if (G.opts.banYakuza) {
    const bx = exX + T + 5, by = eyY + 5, bw = 46, bh = 22;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(bx + 1, by + 2, bw, bh);   // 影
    ctx.fillStyle = '#f2ead8'; ctx.fillRect(bx, by, bw, bh);                  // 白い掲示板
    ctx.strokeStyle = '#a33028'; ctx.lineWidth = 1.5; ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
    ctx.fillStyle = '#a33028'; ctx.font = 'bold 7px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('刺青・ヤクザ', bx + bw / 2, by + 9);
    ctx.fillText('お断り', bx + bw / 2, by + 18);
  }
}

/* 黒塗りのベンツ（横向き・一昔前の角ばった高級セダンの側面図）。左へ進む＝前（ボンネット）は左側。
   角ばったボディ＋濃いスモークガラス＋クロームの縦格子グリルで、威圧感のある「その筋の車」に */
/* フェーズ3：玲奈の真っ赤なフェラーリ風スポーツカー（低いウェッジボディ・前を左に） */
function drawFerrari(rt) {
  const b = G.benz;
  const moving = b.phase !== 'wait';
  const cx = b.x, cy = BENZ_Y + (moving ? Math.sin(rt * 18) * 0.3 : 0) + 3;   // 車高が低い
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.beginPath(); ctx.ellipse(0, 9, 36, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  // 低いウェッジボディ（赤）
  ctx.fillStyle = '#d0231c';
  ctx.beginPath(); ctx.moveTo(-38, 8); ctx.lineTo(-38, 3); ctx.lineTo(-30, -2); ctx.lineTo(-8, -4);
  ctx.lineTo(26, -4); ctx.lineTo(36, 0); ctx.lineTo(38, 8); ctx.closePath(); ctx.fill();
  // 低く流れるキャビン＋スモークガラス
  ctx.fillStyle = '#a01812';
  ctx.beginPath(); ctx.moveTo(-12, -4); ctx.lineTo(-6, -11); ctx.lineTo(14, -11); ctx.lineTo(22, -4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(20,26,36,.92)';
  ctx.beginPath(); ctx.moveTo(-9, -4.5); ctx.lineTo(-4.5, -10); ctx.lineTo(13, -10); ctx.lineTo(19.5, -4.5); ctx.closePath(); ctx.fill();
  // リアウィング
  ctx.fillStyle = '#8e120d'; ctx.fillRect(29, -8, 9, 2); ctx.fillRect(33, -6, 2, 5);
  // ボディの照り
  ctx.fillStyle = 'rgba(255,200,190,.35)'; ctx.fillRect(-30, -1, 55, 1.2);
  // ライト（前＝白／後＝暗い赤）
  ctx.fillStyle = '#f2e6c8'; ctx.fillRect(-37, 0, 3, 3);
  ctx.fillStyle = '#5a0d0a'; ctx.fillRect(35, 0, 2.5, 3);
  if (moving) {
    ctx.fillStyle = 'rgba(250,240,210,.13)';
    ctx.beginPath(); ctx.moveTo(-36, 1.5); ctx.lineTo(-56, -2); ctx.lineTo(-56, 6); ctx.closePath(); ctx.fill();
  }
  // タイヤ（5本スポーク）
  const wob = moving ? -(rt * 18) : 0;
  for (const wx of [-22, 22]) {
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(wx, 6, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c8c8cc';
    ctx.save(); ctx.translate(wx, 6); ctx.rotate(wob);
    for (let i = 0; i < 5; i++) { ctx.rotate(Math.PI * 2 / 5); ctx.fillRect(-0.7, -4, 1.4, 4); }
    ctx.restore();
  }
  ctx.restore();
}

function drawBenz(rt) {
  const b = G.benz;
  if (b.car === 'ferrari') { drawFerrari(rt); return; }
  const moving = b.phase !== 'wait';
  const cx = b.x, cy = BENZ_Y + (moving ? Math.sin(rt * 16) * 0.35 : 0);   // 走行中だけ僅かに揺れる
  ctx.save();
  ctx.translate(cx, cy);
  // 影
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.beginPath(); ctx.ellipse(0, 12, 38, 5, 0, 0, Math.PI * 2); ctx.fill();
  // 車体下部（角ばったロングセダン。前を左に）
  ctx.fillStyle = '#08080b';
  ctx.beginPath(); ctx.moveTo(-38, 11); ctx.lineTo(-38, 0); ctx.lineTo(-33, -3); ctx.lineTo(33, -3);
  ctx.lineTo(38, 0); ctx.lineTo(38, 11); ctx.closePath(); ctx.fill();
  // キャビン（角ばった直立ルーフ）
  ctx.fillStyle = '#0a0a0e';
  ctx.beginPath(); ctx.moveTo(-19, -3); ctx.lineTo(-16, -15); ctx.lineTo(17, -15); ctx.lineTo(20, -3); ctx.closePath(); ctx.fill();
  // 濃いスモークガラス（中が見えない＝怖さ）。細いピラーで仕切る
  ctx.fillStyle = 'rgba(26,34,46,.92)';
  ctx.beginPath(); ctx.moveTo(-15, -4); ctx.lineTo(-13.5, -13); ctx.lineTo(-0.8, -13); ctx.lineTo(-0.8, -4); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(1, -4); ctx.lineTo(1, -13); ctx.lineTo(16, -13); ctx.lineTo(18, -4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(90,110,130,.25)';   // ガラスのわずかな写り込み（上辺だけ）
  ctx.fillRect(-13, -13, 12, 1.4); ctx.fillRect(2, -13, 14, 1.4);
  // ボディサイドの硬いハイライト（黒塗りの照り・金色は使わない）
  ctx.fillStyle = 'rgba(120,140,165,.22)'; ctx.fillRect(-33, 1.5, 66, 1.6);
  // クロームバンパー（前後）
  ctx.fillStyle = '#8a8f98'; ctx.fillRect(-39, 6.5, 5, 3); ctx.fillRect(34, 6.5, 5, 3);
  // フロントの縦格子グリル（メルセデス風・威圧感）＋丸目2灯
  ctx.fillStyle = '#9aa0aa';
  for (let gx = -37; gx <= -34; gx += 1.3) ctx.fillRect(gx, -1.5, 0.7, 6.5);
  ctx.fillStyle = '#0a0a0e'; ctx.fillRect(-38, -1.5, 1, 6.5);
  ctx.fillStyle = '#dfe4ea';   // ヘッドライト（前＝左・角目）
  ctx.beginPath(); ctx.roundRect(-33, -1, 3, 4.5, 1); ctx.fill();
  ctx.fillStyle = '#7a1418'; ctx.fillRect(35.5, -0.5, 2.5, 4);   // テールランプ（後＝右・暗い赤）
  if (moving) {   // 走行中はヘッドライトの薄い光芒
    ctx.fillStyle = 'rgba(220,230,245,.14)';
    ctx.beginPath(); ctx.moveTo(-33, 1); ctx.lineTo(-54, -3); ctx.lineTo(-54, 7); ctx.closePath(); ctx.fill();
  }
  // タイヤ（角張ったフェンダー＋太いタイヤ）。車は常に左へ進む＝転がるタイヤは反時計回り（左回り）
  const wob = moving ? -(rt * 16) : 0;
  for (const wx of [-22, 22]) {
    ctx.fillStyle = '#05050a'; ctx.fillRect(wx - 7, 4, 14, 3);          // フェンダーの陰
    ctx.fillStyle = '#0e0e12'; ctx.beginPath(); ctx.arc(wx, 11, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a3a42'; ctx.beginPath(); ctx.arc(wx, 11, 2.8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(150,150,160,.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(wx, 11); ctx.lineTo(wx + Math.cos(wob) * 2.6, 11 + Math.sin(wob) * 2.6); ctx.stroke();
  }
  ctx.restore();
  // 停車中は強面が2人、入口の前に降りて立つ
  if (b.thugs && b.phase === 'wait') {
    drawThug(cx - 12, BENZ_Y - 10, rt, 0);
    drawThug(cx + 10, BENZ_Y - 13, rt, 0.7);
  }
}
/* 降車した強面（スーツ＋スキンヘッド＋サングラス）を簡易に立たせる */
function drawThug(x, y, rt, ph) {
  const sway = Math.sin(rt * 1.6 + ph) * 0.6;
  ctx.save();
  ctx.translate(x + sway, y);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, 15, 7, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#20222b'; ctx.beginPath(); ctx.roundRect(-6, 0, 12, 15, 3); ctx.fill();   // 黒スーツ
  ctx.fillStyle = '#e8e2d6'; ctx.fillRect(-1.5, 1, 3, 8);                                      // シャツの前
  ctx.fillStyle = '#7a1f2b'; ctx.fillRect(-1, 1, 2, 5);                                        // ネクタイ
  ctx.fillStyle = '#e6c2a0'; ctx.beginPath(); ctx.arc(0, -5, 5, 0, Math.PI * 2); ctx.fill();   // 頭（スキンヘッド）
  ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.arc(0, -6.5, 5, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#141414'; ctx.fillRect(-4, -6, 3, 2.2); ctx.fillRect(1, -6, 3, 2.2);        // サングラス
  ctx.fillRect(-1, -5.3, 2, 1);
  ctx.restore();
}

function drawDirt(d) {
  // 汚れ1つずつを濃さで描き分ける＝放置してこびり付いたものは黒ずみ、画面を見ただけで分かる
  ctx.fillStyle = isThickDirt(d) ? 'rgba(58,40,18,.85)' : 'rgba(110,85,50,.45)';
  ctx.beginPath();
  ctx.ellipse(d.x * T + T / 2, d.y * T + T / 2, 9, 6, 0, 0, Math.PI * 2);
  ctx.ellipse(d.x * T + T / 2 - 6, d.y * T + T / 2 + 4, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
}
/* ============ 家の中 ============
   店ではないので設備（EQ）は置かない。間取りは固定で、ここに直接描く。
   タップできるのは ベッド／台所／食卓 と、千夏。                    */
function homeSpots() { return CONF.homeSpots || []; }
function homeSpotAt(x, y) {
  for (const s of homeSpots())
    if (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h) return s;
  const w = CONF.chinatsuSpot;
  if (w && Math.abs(x - w.x) <= 1 && Math.abs(y - w.y) <= 1) return { key: 'wife', name: '千夏' };
  return null;
}
function drawHome(rt) {
  const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  for (const s of homeSpots()) {
    const x = s.x * T, y = s.y * T, w = s.w * T, h = s.h * T;
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x + 3, y + 5, w, h);   // 影
    if (s.key === 'bed') {
      px(x, y, w, h, '#6b5241');                                   // 木のフレーム
      px(x + 3, y + 3, w - 6, h - 8, '#d8cdbc');                    // 敷布団
      px(x + 3, y + 3, w - 6, 10, '#f0e8dc');                       // 枕
      px(x + 5, y + 5, 16, 6, '#fff');
      px(x + 3, y + h * 0.42, w - 6, h * 0.5, '#7a94b8');           // 掛け布団
      px(x + 3, y + h * 0.42, w - 6, 4, '#94aacc');
      ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        const ly = y + h * 0.42 + i * (h * 0.5) / 3;
        ctx.beginPath(); ctx.moveTo(x + 4, ly); ctx.lineTo(x + w - 4, ly); ctx.stroke();
      }
    } else if (s.key === 'kit') {
      px(x, y, w, h, '#8a7a68');                                   // 流し台
      px(x, y, w, 5, '#a2917c');
      px(x + 5, y + 8, w * 0.45, h - 14, '#c6ccc8');                // シンク
      ctx.strokeStyle = '#8d9490'; ctx.lineWidth = 1;
      ctx.strokeRect(x + 5.5, y + 8.5, w * 0.45 - 1, h - 15);
      ctx.strokeStyle = '#b8bdc0'; ctx.lineWidth = 2;               // 蛇口
      ctx.beginPath(); ctx.moveTo(x + 10, y + 10); ctx.lineTo(x + 10, y + 3); ctx.lineTo(x + 20, y + 3); ctx.stroke();
      px(x + w * 0.55, y + 9, w * 0.36, h - 16, '#3f4348');         // コンロ
      for (let i = 0; i < 2; i++) {
        ctx.fillStyle = '#6d7278';
        ctx.beginPath(); ctx.arc(x + w * 0.63 + i * 15, y + h / 2 + 1, 5, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      px(x + 2, y + 4, w - 4, h - 10, '#a07a4e');                   // 卓
      px(x + 2, y + 4, w - 4, 4, '#bb9264');
      px(x + 5, y + h - 8, 5, 7, '#6d4f30'); px(x + w - 10, y + h - 8, 5, 7, '#6d4f30');
      ctx.fillStyle = '#e8ddc8';                                     // 茶碗ふたつ
      ctx.beginPath(); ctx.arc(x + w * 0.34, y + h * 0.45, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + w * 0.66, y + h * 0.45, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c9b89a';
      ctx.beginPath(); ctx.arc(x + w * 0.34, y + h * 0.45, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + w * 0.66, y + h * 0.45, 3, 0, Math.PI * 2); ctx.fill();
    }
    // 名札
    ctx.fillStyle = 'rgba(20,16,12,.6)';
    const lw = s.name.length * 9 + 8;
    ctx.fillRect(x + 2, y + h - 13, lw, 12);
    ctx.fillStyle = '#f0e2c8'; ctx.font = 'bold 9px "DotGothic16",sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(s.name, x + 5, y + h - 4);
  }
  drawChinatsu(rt);
  ctx.textAlign = 'center';
}
/* 千夏。エプロン姿で台所の横に立っている */
function drawChinatsu(rt) {
  const w = CONF.chinatsuSpot; if (!w) return;
  const cx = w.x * T + T / 2, cy = w.y * T + T / 2 + Math.sin(rt * 1.6) * 0.6;
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.ellipse(0, 9, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d88aa0'; ctx.fillRect(-6, -2, 12, 11);          // 部屋着
  ctx.fillStyle = '#f2e4d0'; ctx.fillRect(-4.5, 1, 9, 8);           // エプロン
  ctx.fillStyle = '#f0c9a8';                                        // 顔
  ctx.beginPath(); ctx.arc(0, -6, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5a3a2a';                                        // 髪（後ろでまとめている）
  ctx.beginPath(); ctx.arc(0, -7.5, 6, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillRect(-6, -8, 2.5, 7); ctx.fillRect(3.5, -8, 2.5, 7);
  ctx.beginPath(); ctx.arc(0, -1.5, 3, Math.PI, Math.PI * 2, true); ctx.fill();
  ctx.fillStyle = '#2b2119';                                        // 目
  ctx.fillRect(-2.6, -6, 1.7, 1.7); ctx.fillRect(1, -6, 1.7, 1.7);
  ctx.restore();
}

/* ============ ゴミ・瓦礫（第2章の開店前） ============
   1マスに1つ。**設備は置けないが、人は上を歩ける**（そうでないと拾いに行けない）。
   タップすると印が付き、主人公がそこまで歩いて行って担ぎ出す。金はかからない。
   かかるのは主人公の足だけ＝「金が無いから自分でやる」という第2章の入口（作者指定） */
function junkAt(x, y, f) {
  const ff = (f === undefined ? G.actF : f) | 0;
  return G.junk.find(j => j.x === x && j.y === y && (j.f | 0) === ff) || null;
}
function junkInArea(f) { return G.junk.filter(j => (j.f | 0) === (f | 0)); }
/* タップ＝運ぶ指示。もう一度タップすると取り消す */
function markJunk(j) {
  const name = chHook('junkName', j) || 'ゴミ';
  if (j.want) { j.want = false; toast(`${name}はそのままにした`); return; }
  j.want = true;
  const p = G.player;
  // 主人公が入れない部屋（女湯）は自分では運べない
  const a = areaDef(j.f | 0);
  if (playerBanned(j.f | 0)) { j.want = false; toast('営業中は女湯に入れない'); return; }
  /* 「○○を運び出す」のトーストは出さない（作者指定）。
     運び終わった瞬間に上の一行が「○○を片付けた。あと○個」と言うので、
     押した時と終わった時で二度、同じことを画面に重ねることになる。
     押したことは、主人公がそこへ歩き出す動きで分かる                    */
  if (!hasHook('topTip')) toast(`${name}を運び出す`);
  if (p && (p.f | 0) !== (j.f | 0)) warpPlayerTo(j.f | 0);
}
/* 主人公が次に運ぶゴミ（自分がいる部屋の、印の付いたもののうち、たどり着けるいちばん近いもの） */
function nextJunk(w) {
  const mine = junkInArea(w.f).filter(j => j.want);
  if (!mine.length) return null;
  const t0 = tileOf(w);
  mine.sort((a, b) => (Math.abs(a.x - t0.x) + Math.abs(a.y - t0.y)) - (Math.abs(b.x - t0.x) + Math.abs(b.y - t0.y)));
  return mine[0];
}
/* ゴミ・瓦礫（第2章の開店前）。1マスに1つ。タップすると主人公が担ぎに行く。
   運ぶ順番が決まっているものには、待っている印を出す                       */
function drawJunk(j, rt) {
  const cx = j.x * T + T / 2, cy = j.y * T + T / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(0,0,0,.30)';                       // 影
  ctx.beginPath(); ctx.ellipse(0, 7, 10, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  const p = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  switch (j.kind) {
    case 'gareki':                                          // コンクリの塊
      p(-9, 0, 8, 7, '#8c8478'); p(-9, 0, 8, 2, '#a9a196');
      p(0, -3, 9, 10, '#7d766b'); p(0, -3, 9, 2, '#9a9288');
      p(-4, -6, 6, 6, '#948c80'); p(-4, -6, 6, 2, '#b0a89c');
      ctx.strokeStyle = '#5d574e'; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.moveTo(-6, 3); ctx.lineTo(-2, 5); ctx.stroke();
      ctx.strokeStyle = '#c2762e'; ctx.lineWidth = 1;       // 飛び出した鉄筋
      ctx.beginPath(); ctx.moveTo(4, -3); ctx.lineTo(9, -8); ctx.stroke();
      break;
    case 'wood':                                            // 折れた木材
      p(-10, 2, 20, 3.5, '#8a6a44'); p(-10, 2, 20, 1, '#a9855a');
      ctx.save(); ctx.rotate(-.35);
      p(-9, -3, 18, 3.5, '#9a7850'); p(-9, -3, 18, 1, '#b8926a'); ctx.restore();
      ctx.save(); ctx.rotate(.5);
      p(-7, -6, 14, 3, '#7d6039'); ctx.restore();
      p(6, 1, 1.4, 1.4, '#d8d0c0'); p(-4, 3, 1.4, 1.4, '#d8d0c0');   // 出ている釘
      break;
    case 'tile':                                            // 割れたタイル
      p(-9, 1, 7, 6, '#cfd8d6'); p(-9, 1, 7, 1.5, '#e6eeec');
      p(-1, -2, 8, 8, '#c3ccca'); p(-1, -2, 8, 1.5, '#dde5e3');
      p(-5, -5, 5, 5, '#d6dedc');
      ctx.strokeStyle = '#8f9a98'; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.moveTo(-1, 2); ctx.lineTo(6, -1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8, 4); ctx.lineTo(-3, 6); ctx.stroke();
      break;
    case 'bag':                                             // ゴミ袋
      ctx.fillStyle = '#3f4348';
      ctx.beginPath(); ctx.ellipse(-4, 2, 6.5, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(4, 3, 5.5, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#585d64';
      ctx.beginPath(); ctx.ellipse(-5, 0, 3.5, 3, 0, 0, Math.PI * 2); ctx.fill();
      p(-6, -6, 4, 4, '#3f4348'); p(2, -4, 3.5, 3.5, '#3f4348');   // 縛った口
      break;
    case 'box':                                             // 濡れた段ボール
      p(-9, -2, 11, 9, '#a07a4e'); p(-9, -2, 11, 2, '#bb9264');
      p(-9, 3, 11, 4, '#7d5c38');                           // 下側が水を吸って黒い
      p(0, 0, 9, 7, '#98704a'); p(0, 0, 9, 2, '#b0885c');
      ctx.strokeStyle = '#6d4f30'; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.moveTo(-3.5, -2); ctx.lineTo(-3.5, 7); ctx.stroke();
      break;
    case 'can':                                             // 一斗缶
      p(-7, -6, 10, 13, '#8f9aa2'); p(-7, -6, 10, 2, '#adb7bf');
      p(-7, 2, 10, 2, '#6f7982');
      p(2, -4, 7, 11, '#7f8992'); p(2, -4, 7, 2, '#9aa4ac');
      p(-4, -8, 3, 2.5, '#6a747c');                         // 注ぎ口
      p(-6, 0, 3, 2, '#b06a3a');                            // 錆
      break;
    case 'chair':                                           // 壊れたパイプ椅子
      ctx.strokeStyle = '#7f8a92'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-8, 6); ctx.lineTo(-3, -4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6, 6); ctx.lineTo(2, -4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-9, 6); ctx.lineTo(4, 7); ctx.stroke();
      p(-6, -6, 11, 4, '#5d6a58'); p(-6, -6, 11, 1.2, '#7b8a74');   // 座面
      ctx.strokeStyle = '#7f8a92'; ctx.lineWidth = 1.6;              // 折れた脚
      ctx.beginPath(); ctx.moveTo(6, 2); ctx.lineTo(10, 7); ctx.stroke();
      break;
    default:                                                // 錆びた配管
      p(-10, 0, 20, 4, '#8a7a68'); p(-10, 0, 20, 1.2, '#a29280');
      p(-11, -1, 3, 6, '#6e6154'); p(8, -1, 3, 6, '#6e6154');
      p(-2, 0, 5, 4, '#a8672e');                            // 錆
      ctx.save(); ctx.rotate(-.6);
      p(-5, -8, 12, 3, '#7d6f5e'); p(-5, -8, 12, 1, '#98897a'); ctx.restore();
      break;
  }
  ctx.restore();
  // 運ぶ順番待ちの印（タップ済み）
  if (j.want) {
    const a = .55 + Math.sin(rt * 5) * .25;
    ctx.strokeStyle = `rgba(255,214,120,${a.toFixed(2)})`; ctx.lineWidth = 2;
    ctx.strokeRect(j.x * T + 2, j.y * T + 2, T - 4, T - 4);
    ctx.fillStyle = `rgba(255,214,120,${a.toFixed(2)})`;
    ctx.font = 'bold 10px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('▼', cx, j.y * T + 10);
  }
}
/* ゴキブリ1匹。浴室の床を歩き回る（作者指定）。
   卵形の黒い胴・脚6本・長い触角。進む向きに体を向け、脚は小刻みに動く */
function drawRoach(rt, roach) {
  const r = roach || roachAt(G.actF); if (!r) return;
  const cx = r.px, cy = r.py;
  const dir = 1;                                             // 体は常に進行方向（+x）向きに描き、canvasごと回す
  const moving = Math.hypot(r.tx * T + T / 2 - r.px, r.ty * T + T / 2 - r.py) > 1.5;
  ctx.save(); ctx.translate(cx, cy);
  ctx.rotate((r.ang || 0) + Math.sin(rt * 4) * (moving ? 0.12 : 0.03));
  ctx.strokeStyle = '#1e1712'; ctx.lineWidth = 0.9;            // 脚（左右3本ずつ・小刻みに動く）
  for (let i = 0; i < 3; i++) {
    const ly = -1.8 + i * 1.8, kick = Math.sin(rt * 18 + i * 2) * (moving ? 1.1 : 0.3);
    ctx.beginPath(); ctx.moveTo(-1, ly); ctx.lineTo(-4, ly + kick); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1, ly); ctx.lineTo(4, ly - kick); ctx.stroke();
  }
  ctx.strokeStyle = '#241c16'; ctx.lineWidth = 0.8;            // 触角
  ctx.beginPath(); ctx.moveTo(dir * 2, -1.4); ctx.lineTo(dir * 6, -3.4 + Math.sin(rt * 9) * 0.8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(dir * 2, 1.4); ctx.lineTo(dir * 6, 3.4 + Math.cos(rt * 9) * 0.8); ctx.stroke();
  ctx.fillStyle = '#2b211a';                                    // 胴
  ctx.beginPath(); ctx.ellipse(0, 0, 4.2, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3d2f24';                                    // 背中のツヤ
  ctx.beginPath(); ctx.ellipse(-dir * 0.8, -0.6, 2.2, 1.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawEquip(c2, it, rt) {
  const def = EQ[it.id];
  /* 知らない id は無いものとして飛ばす。
     制作中に設備を廃止すると、それを置いたままの古いセーブが残る。
     ここで落ちると描画ループごと止まって**画面が真っ黒になる**（equipAt と同じ手当て） */
  if (!def) return;
  // 壊れる（＝耐久度が意味を持つ）かどうかは cap ではなく wearPerDay で見る。
  // 洗面所など cap:0 の“置くだけ”設備も日々傷むので、ここを cap>0 限定にすると
  // 壊れても「故障中」表示も耐久度バーも一切出ない穴になる
  const decays = (CONF.wearPerDay[def.cat] ?? 0) > 0;
  const broken = decays && it.cond <= 0;
  const fw = ew(it) * T, fh = eh(it) * T;   // 実寸（回転後）
  const ox = it.x * T, oy = it.y * T;
  c2.save();
  if (it.rot) {                              // footprintの中心で rot×90° 回転（0〜3の4方向）
    c2.translate(ox + fw / 2, oy + fh / 2);
    c2.rotate(Math.PI / 2 * it.rot);
    c2.translate(-def.w * T / 2, -def.h * T / 2);
    drawEquipArt(c2, it, def, 0, 0, def.w * T, def.h * T, rt, broken);
  } else {
    drawEquipArt(c2, it, def, ox, oy, def.w * T, def.h * T, rt, broken);
  }
  c2.restore();
  // 「飾り」＝道が通っておらず誰にも使われない設備。色を落として⚠を出す（タップで理由が読める）
  if (it.dead) {
    c2.fillStyle = 'rgba(30,26,20,.55)'; c2.fillRect(ox, oy, fw, fh);
    c2.fillStyle = '#ff9a8a'; c2.font = 'bold 11px sans-serif'; c2.textAlign = 'center';
    c2.fillText('⚠', ox + fw / 2, oy + fh / 2 + 4);
  }
  // 状態表示（回転しても水平のまま。画面座標で描く）
  if (broken) {
    c2.fillStyle = 'rgba(40,40,40,.45)'; c2.fillRect(ox, oy, fw, fh);
    c2.fillStyle = '#ffdc9a'; c2.fillRect(ox + fw / 2 - 15, oy + fh / 2 - 7, 30, 14);
    c2.fillStyle = '#b3402e'; c2.font = 'bold 9px sans-serif'; c2.textAlign = 'center';
    c2.fillText('故障中', ox + fw / 2, oy + fh / 2 + 3);
  } else if (decays && it.cond < 30) {
    c2.fillStyle = '#ffdc3a'; c2.font = 'bold 10px sans-serif'; c2.textAlign = 'center';
    c2.fillText('⚠', ox + fw - 7, oy + 10);
  }
  // 耐久度バー（設備の下辺に細く常時表示。ひと目で状態がわかる）
  if (decays) {
    const pct = clamp(it.cond, 0, 100) / 100;
    const bw = fw - 6, bx = ox + 3, by = oy + fh - 3.5;
    c2.fillStyle = 'rgba(20,15,10,.55)'; c2.fillRect(bx, by, bw, 3);
    c2.fillStyle = pct > .5 ? '#7ac96a' : pct > .2 ? '#e8c84a' : '#e85a5a';
    c2.fillRect(bx, by, bw * pct, 3);
  }
  // 応急修理中マーク（誰かが直しに来ている設備）
  if (broken && allWorkers().some(w => w.task === 'repair' && w.target === it)) {
    c2.fillStyle = '#ffd98a'; c2.font = 'bold 9px "DotGothic16",sans-serif'; c2.textAlign = 'center';
    c2.fillText('🔧修理中', ox + fw / 2, oy + fh / 2 + 15);
  }
  // 温度ラベル（浴槽・水風呂・サウナ）
  if ((def.cat === 'furo' || def.cat === 'mizu' || def.cat === 'sauna') && !broken) {
    // 温度を設定できない設備は、設備の既定値がそのまま表示になる
    const temp = (canSetTemp(def) ? it.temp ?? def.temp : def.temp)
      ?? (def.cat === 'mizu' ? 15 : def.cat === 'sauna' ? 90 : 42);
    // サウナだけは数字ではなく熱さの言葉で出す（作者指定）。「110℃」より「灼熱」のほうが伝わる。
    // ミスト・塩は固有の札（def.tag）＝別ジャンルであることが札の時点で伝わる。正確な室温は設備をタップすれば読める
    const txt = def.cat === 'sauna' ? (def.tag || saunaBand(temp).label) : temp + '℃';
    const bw2 = txt.length > 3 ? 33 : 27;
    /* サウナの札は入り口のそばに掛ける（回すと入り口が動くので、札も付いてくる）。
       文字は読めないと意味がないので、向きは変えずに掛ける位置だけを移す */
    let lx = ox + 2, ly = oy + fh - 16;
    if (def.cat === 'sauna') {
      const r = (it.rot || 0) & 3;
      if (r === 1) { lx = ox + 2;            ly = oy + 2; }             // 入り口＝左 → 左上
      else if (r === 2) { lx = ox + fw - bw2 - 2; ly = oy + 2; }        // 入り口＝上 → 右上
      else if (r === 3) { lx = ox + fw - bw2 - 2; ly = oy + fh - 16; }  // 入り口＝右 → 右下
    }
    c2.fillStyle = 'rgba(20,15,10,.55)'; c2.fillRect(lx, ly, bw2, 10);
    c2.fillStyle = '#fff'; c2.font = 'bold 8px "DotGothic16",sans-serif'; c2.textAlign = 'left';
    c2.fillText(txt, lx + 2, ly + 8);
  }
}

/* 第2章の設備の色（ドット絵を1つずつ描くまでの、当座の見た目）。
   カテゴリごとに色を決めて、名前の短縮形を載せた札として描く。
   ※第1章の設備はこれまでどおり1つずつ描いてある（下の switch）ので、ここは通らない */
const CH2_TILE_COL = {
  park: '#5a5a5a', shoku: '#8a6a3a', lobby: '#8a6a44',
  sauna: '#8a5a3a', mizu: '#4a86a8', furo: '#6a9a9a', wash: '#7a9a9a',
  rest: '#7a5a8a', datsui: '#8a8a7a', locker: '#7a6a54', etc: '#6a7a6a', sys: '#8a6a44',
};
/* 名前を札に収まる長さに詰める（全角5文字くらいまで） */
function shortName(s) { return s.length <= 5 ? s : s.slice(0, 5); }
function drawGenericEquip(c2, it, def, x, y, w, h, broken) {
  const col = CH2_TILE_COL[def.cat] || '#7a6a5a';
  c2.fillStyle = 'rgba(0,0,0,.25)'; c2.fillRect(x + 2, y + 3, w, h);
  c2.fillStyle = broken ? '#6a5a55' : col; c2.fillRect(x, y, w, h);
  c2.strokeStyle = 'rgba(255,255,255,.22)'; c2.lineWidth = 2; c2.strokeRect(x + 1, y + 1, w - 2, h - 2);
  c2.strokeStyle = 'rgba(0,0,0,.35)'; c2.lineWidth = 1; c2.strokeRect(x + .5, y + .5, w - 1, h - 1);
  c2.fillStyle = '#fff8ea'; c2.textAlign = 'center';
  c2.font = 'bold 9px "DotGothic16",sans-serif';
  c2.fillText(shortName(def.name), x + w / 2, y + h / 2 + 3);
}

function drawEquipArt(c2, it, def, x, y, w, h, rt, broken) {
  /* 第2章は id ごとの絵を自前で持っている（js/ch2/art_eq2.js ／ js/ch2b/art_y.js）。
     **自前の絵が無い品は、下の第1章の絵にそのまま落とす。**
     サウナ・水風呂・浴槽・カラン・イス・ロッカーは、章が変わっても同じ物なので、
     わざわざ描き直す必要がない（名前だけの札が並ぶ見た目も、これで無くなる）。
     cat に当てはまる絵が1つも無い品だけ、最後に共通の札へ落ちる            */
  if (G.chapter !== 1 && chHook('equipArt', c2, it, def, x, y, w, h, rt, broken)) return;
  const HAS_ART = ['sys', 'furo', 'mizu', 'sauna', 'wash', 'locker', 'rest', 'datsui', 'etc', 'amenity'];
  if (G.chapter !== 1 && !HAS_ART.includes(def.cat)) { drawGenericEquip(c2, it, def, x, y, w, h, broken); return; }
  switch (def.cat) {
    case 'sys': { // 番台
      c2.fillStyle = '#6b432a'; c2.fillRect(x + 2, y + 6, w - 4, h - 8);
      c2.fillStyle = '#8a5a3a'; c2.fillRect(x, y + 2, w, 8);
      c2.fillStyle = '#ffd98a'; c2.fillRect(x + w - 11, y + 4, 8, 5);
      break;
    }
    case 'furo': case 'mizu': {
      const old = def.old;
      const rim = old ? '#8a8578' : it.id === 'bath2' ? '#a9743f' : '#b8a89a';
      const temp = it.temp ?? def.temp ?? (def.cat === 'mizu' ? 15 : 42);
      const band = tempBand(temp);
      c2.fillStyle = rim; c2.fillRect(x, y, w, h);
      c2.fillStyle = broken ? '#9a9a92' : (old ? '#9fb8b5' : band.water);
      c2.fillRect(x + 4, y + 4, w - 8, h - 8);
      // 波
      if (!broken) {
        c2.strokeStyle = 'rgba(255,255,255,.55)'; c2.lineWidth = 1.5;
        for (let i = 0; i < def.w; i++) {
          const wy = y + h / 2 + Math.sin(rt * 2 + i * 2 + it.x) * 3;
          c2.beginPath(); c2.moveTo(x + 8 + i * 26, wy); c2.quadraticCurveTo(x + 16 + i * 26, wy - 4, x + 24 + i * 26, wy); c2.stroke();
        }
      }
      // 設備ごとの見せ場（ジェットの水流・炭酸のシュワシュワ・電気のビリビリ）
      if (!broken) drawFuroFx(c2, it, x, y, w, h, rt);
      if (old) { // ヒビ
        c2.strokeStyle = '#5a5548'; c2.lineWidth = 1;
        c2.beginPath(); c2.moveTo(x + 6, y + 2); c2.lineTo(x + 14, y + 12); c2.lineTo(x + 10, y + 20);
        c2.moveTo(x + w - 8, y + h - 4); c2.lineTo(x + w - 14, y + h - 14); c2.stroke();
      }
      // 湯気（湯温が高いほど。冷たい水風呂は出ない）
      if (!broken && band.steam) drawSteam(c2, x + w / 2, y + 6, rt + it.x, band.steam);
      break;
    }
    case 'sauna': {                                    // 中が見える断面図（階段状ベンチ）
      const sp = it.id === 'sauna_sp';                 // 決戦仕様＝熱波師のために組んだ特注の一台
      /* ── スペシャルだけは造りがまったく違う（作者指定）。
         部屋の真ん中にサウナストーンを据え、六つの席がそれを囲む（左2・奥2・右2）。
         手前の中央は空けてある＝そこがドアであり、熱波師が立って左右へ風を送る場所 */
      if (sp) {
        const sb2 = saunaBand(it.temp ?? def.temp ?? 100);
        c2.fillStyle = '#4a2c18'; c2.fillRect(x, y, w, h);                        // 外枠（濃い木）
        c2.fillStyle = broken ? '#8a8078' : '#b5824a'; c2.fillRect(x + 3, y + 3, w - 6, h - 6);
        c2.strokeStyle = 'rgba(80,48,20,.28)'; c2.lineWidth = 1;                  // 縦板の目地
        for (let vx = x + 9; vx < x + w - 4; vx += 8) { c2.beginPath(); c2.moveTo(vx, y + 3); c2.lineTo(vx, y + h - 4); c2.stroke(); }
        const bench = broken ? '#9a9088' : '#c69457';
        c2.fillStyle = bench;
        c2.fillRect(x + 6, y + 6, w - 12, 14);                                    // 奥ベンチ
        c2.fillRect(x + 6, y + 20, 16, h - 34);                                   // 左ベンチ
        c2.fillRect(x + w - 22, y + 20, 16, h - 34);                              // 右ベンチ
        c2.fillStyle = 'rgba(55,32,14,.4)';                                       // 座面の影
        c2.fillRect(x + 6, y + 18, w - 12, 2); c2.fillRect(x + 20, y + 20, 2, h - 34); c2.fillRect(x + w - 22, y + 20, 2, h - 34);
        if (!broken) {                                                            // 座布団6枚（座席と同じ位置）
          c2.fillStyle = '#e8d29a';
          c2.fillRect(x + 20, y + 7, 20, 11); c2.fillRect(x + 56, y + 7, 20, 11);  // 奥2
          c2.fillRect(x + 7, y + 24, 14, 11); c2.fillRect(x + 7, y + 40, 14, 11);  // 左2
          c2.fillRect(x + w - 21, y + 24, 14, 11); c2.fillRect(x + w - 21, y + 40, 14, 11); // 右2
        }
        // 中央のサウナストーン（この台の主役）。石を山盛りにした炉
        c2.fillStyle = '#26221e'; c2.fillRect(x + 37, y + 28, 22, 15);
        c2.fillStyle = '#15120f'; c2.fillRect(x + 37, y + 28, 22, 3);
        for (let i = 0; i < 7; i++) {
          const sx2 = x + 40 + (i % 4) * 5, sy2 = y + 30 + (i > 3 ? 4 : 0);
          c2.fillStyle = broken ? '#666' : (i % 2 ? '#8d8d90' : '#77777c');
          c2.beginPath(); c2.arc(sx2, sy2 + 2, 2.6, 0, Math.PI * 2); c2.fill();
        }
        if (!broken) {                                                            // 石の間の熾き火
          const gl = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(rt * 3 + it.x));
          c2.fillStyle = `rgba(255,90,26,${gl.toFixed(2)})`;
          c2.fillRect(x + 42, y + 35, 3, 2); c2.fillRect(x + 50, y + 34, 3, 2);
          c2.fillStyle = 'rgba(255,150,60,.18)';
          c2.beginPath(); c2.arc(x + 48, y + 35, 13, 0, Math.PI * 2); c2.fill();
        }
        c2.fillStyle = '#7a4a26'; c2.fillRect(x + 62, y + 36, 7, 6);              // ロウリュの木桶
        c2.fillStyle = '#3a6a7a'; c2.fillRect(x + 63, y + 37, 5, 1);
        if (!broken) {                                                            // 積んだ薪（左手前）
          c2.fillStyle = '#8a5f33';
          for (let i = 0; i < 3; i++) c2.fillRect(x + 7, y + h - 13 + i * 3, 12, 2);
          c2.fillStyle = 'rgba(255,235,190,.55)';
          for (let i = 0; i < 3; i++) c2.fillRect(x + 7, y + h - 13 + i * 3, 2, 2);
        }
        c2.fillStyle = '#2f1f12'; c2.fillRect(x + w / 2 - 9, y + h - 6, 18, 6);   // ガラスドア
        c2.fillStyle = 'rgba(185,222,235,.4)'; c2.fillRect(x + w / 2 - 7, y + h - 5, 14, 4);
        c2.fillStyle = '#1f4e78'; c2.fillRect(x + w / 2 - 10, y + h - 7, 20, 4);  // 屋号の小暖簾
        c2.fillStyle = '#e8eef4'; c2.fillRect(x + w / 2 - 1, y + h - 6, 2, 2);
        if (!broken) drawSteam(c2, x + 48, y + 24, rt + it.y, `rgba(255,200,120,${(0.3 + sb2.heat * 0.3).toFixed(2)})`);
        break;
      }
      const fin = it.id === 'sauna2';
      const mist = it.id === 'sauna_mist', shio = it.id === 'sauna_shio';
      const tiers = saunaTiers(it.id);
      const sb = saunaBand(it.temp ?? def.temp ?? 90);   // 室温で光・湯気の強さが変わる
      // 外枠（ミストはタイル張りの水色系＝木の小屋ではなく浴室の一角に見せる）
      c2.fillStyle = mist ? '#4a6a72' : fin ? '#4a2c18' : '#5f3a20'; c2.fillRect(x, y, w, h);
      // 内壁（ミスト＝湿ったタイル／塩＝白っぽい岩塩壁／それ以外＝明るい裸木）
      c2.fillStyle = broken ? '#8a8078' : mist ? '#9fbcc2' : shio ? '#d8cfc0' : '#b5824a';
      c2.fillRect(x + 3, y + 3, w - 6, h - 6);
      // 目地（ミストはタイルの横目地、木の部屋は縦板の目地）
      if (mist) {
        c2.strokeStyle = 'rgba(60,90,100,.3)'; c2.lineWidth = 1;
        for (let hy2 = y + 9; hy2 < y + h - 4; hy2 += 7) { c2.beginPath(); c2.moveTo(x + 3, hy2); c2.lineTo(x + w - 3, hy2); c2.stroke(); }
      } else {
        c2.strokeStyle = shio ? 'rgba(150,135,110,.3)' : 'rgba(80,48,20,.28)'; c2.lineWidth = 1;
        for (let vx = x + 9; vx < x + w - 4; vx += 8) { c2.beginPath(); c2.moveTo(vx, y + 3); c2.lineTo(vx, y + h - 4); c2.stroke(); }
      }
      // 階段状ベンチ（奥＝上ほど高い。下辺14pxはドア/ヒーター用に空ける）
      const benchTop = y + 4, benchH = (h - 6) - 14, step = benchH / tiers;
      for (let i = 0; i < tiers; i++) {
        const by = benchTop + i * step;
        c2.fillStyle = broken ? '#9a9088' : (i % 2 ? '#c69457' : '#b9884b');   // ベンチ板
        c2.fillRect(x + 4, by, w - 8, step - 2);
        c2.fillStyle = 'rgba(55,32,14,.4)'; c2.fillRect(x + 4, by + step - 3, w - 8, 2); // 段差の影
        if (!broken) {                                                          // 座布団マット
          const n = saunaCushions(def), cw = (w - 12) / n - 3;
          c2.fillStyle = '#e8d29a';
          for (let k = 0; k < n; k++) c2.fillRect(x + 7 + k * ((w - 12) / n), by + 1, cw, Math.max(step - 5, 3));
        }
      }
      // 右下隅の熱源。ここがサウナの「顔」＝種類ごとに描き分ける（作者指定）
      const hx = x + w - 13, hy = y + h - 16;
      if (fin) {
        // フィンランド式＝サウナストーン（黒い籠に丸石）＋セルフロウリュの桶とラドル
        c2.fillStyle = '#26221e'; c2.fillRect(hx - 2, hy + 3, 13, 9);              // ストーブの籠
        const stone = broken ? '#666' : '#8d8d90';
        for (let i = 0; i < 5; i++) {                                              // 積んだ丸石（2段）
          c2.fillStyle = i % 2 ? stone : '#77777c';
          c2.beginPath(); c2.arc(hx + i * 2.6, hy + (i % 2 ? 3 : 6), 2.4, 0, Math.PI * 2); c2.fill();
        }
        if (!broken && Math.sin(rt * 3 + it.x) > 0.2) {                            // 石の間で熾きが光る
          c2.fillStyle = '#ff5a1a'; c2.fillRect(hx + 2, hy + 7, 2, 2); c2.fillRect(hx + 6, hy + 6, 2, 2);
        }
        c2.fillStyle = '#7a4a26'; c2.fillRect(hx - 9, hy + 7, 6, 5);               // ロウリュ用の木桶
        c2.fillStyle = '#3a6a7a'; c2.fillRect(hx - 8, hy + 8, 4, 1);               // 桶の水面
        c2.strokeStyle = '#9a6a3a'; c2.lineWidth = 1.5;                            // ラドル（柄杓）
        c2.beginPath(); c2.moveTo(hx - 6, hy + 7); c2.lineTo(hx - 1, hy + 1); c2.stroke();
      } else if (mist) {
        // ミスト＝ヒーターの代わりに噴霧ノズル。天井から白い蒸気が絶えず湧く
        c2.fillStyle = '#8a949c'; c2.fillRect(hx + 3, hy, 3, 12);                  // 立ち上がりの配管
        c2.fillStyle = '#b9c4cc'; c2.fillRect(hx, hy, 9, 4);                       // 噴霧ノズル
        if (!broken) {
          c2.fillStyle = 'rgba(240,250,255,.5)';                                   // 噴き出すミスト
          for (let i = 0; i < 4; i++) {
            const t2 = (rt * 12 + i * 4 + it.x) % 12;
            c2.beginPath(); c2.arc(hx + 4 - i * 3 + Math.sin(rt * 2 + i) * 2, hy + 4 + t2 * 0.6, 2 + t2 * 0.25, 0, Math.PI * 2); c2.fill();
          }
        }
      } else if (shio) {
        // 塩サウナ＝白い塩の山を盛った鉢。ベンチにも塩の粒を散らす
        c2.fillStyle = '#8a6a48'; c2.fillRect(hx - 2, hy + 8, 13, 4);              // 木の台
        c2.fillStyle = broken ? '#aaa' : '#f4f2ea';                                // 塩の山
        c2.beginPath(); c2.moveTo(hx - 1, hy + 8); c2.lineTo(hx + 4.5, hy); c2.lineTo(hx + 10, hy + 8); c2.closePath(); c2.fill();
        c2.fillStyle = 'rgba(255,255,255,.85)';                                    // ベンチの塩粒
        for (let i = 0; i < 8; i++) c2.fillRect(x + 8 + ((i * 37 + it.x * 13) % (w - 20)), y + 6 + ((i * 23) % (h - 26)), 1.5, 1.5);
      } else {
        // 遠赤サウナ・大型サウナ＝遠赤ヒーター（室温が高いほど赤く強く光る）
        c2.fillStyle = '#2f2a26'; c2.fillRect(hx, hy, 10, 12);
        const hotCol = sb.heat >= 0.8 ? '#ff3a10' : '#ff5a1a';
        for (let i = 0; i < 3; i++) {
          c2.fillStyle = broken ? '#555' : (Math.sin(rt * 3 + i * 1.4) > 0 ? hotCol : '#ff8a3a');
          c2.fillRect(hx + 1, hy + 2 + i * 3, 8, 2);
        }
      }
      // ランタン（左下隅）。ミストはタイル張りなので置かない
      if (!broken && !mist) {
        c2.fillStyle = 'rgba(255,200,120,.35)'; c2.beginPath(); c2.arc(x + 8, y + h - 10, 7, 0, Math.PI * 2); c2.fill();
        c2.fillStyle = '#ffcf6a'; c2.fillRect(x + 6, y + h - 13, 5, 7);
      }
      // ガラスドア（下辺・中央）
      c2.fillStyle = mist ? '#2a4a52' : '#2f1f12'; c2.fillRect(x + w / 2 - 9, y + h - 6, 18, 6);
      c2.fillStyle = 'rgba(185,222,235,.4)'; c2.fillRect(x + w / 2 - 7, y + h - 5, 14, 4);
      // 部屋にたちこめる湯気。ミストは白く濃く、塩はやわらかく、木の部屋は琥珀色
      if (!broken) {
        if (mist) {
          drawSteam(c2, x + w * 0.3, y + 4, rt + it.y, 'rgba(240,250,255,.6)');
          drawSteam(c2, x + w * 0.7, y + 8, rt * 1.3 + it.x, 'rgba(240,250,255,.45)');
        } else if (shio) {
          drawSteam(c2, hx + 4, y + 2, rt + it.y, 'rgba(250,248,240,.4)');
        } else {
          drawSteam(c2, hx + 4, y + 2, rt + it.y, `rgba(255,200,120,${(0.24 + sb.heat * 0.3).toFixed(2)})`);
        }
      }
      break;
    }
    case 'wash': {
      if (it.id === 'wash_shower') {
        // 立ちシャワー＝座らない。鏡・桶・腰掛けがなく、頭上のシャワーヘッドと足元の排水口だけ
        c2.fillStyle = '#cfd8dc'; c2.fillRect(x + 2, y + 2, w - 4, h - 4);               // 立ち位置のタイル
        c2.fillStyle = 'rgba(255,255,255,.5)';
        for (let i = 1; i < 3; i++) c2.fillRect(x + 2, y + 2 + i * ((h - 4) / 3), w - 4, 1);
        c2.fillStyle = '#9aa4ac'; c2.fillRect(x + w / 2 - 1, y + 5, 2, 9);               // 立ち上がりの配管
        c2.fillStyle = '#b9c4cc'; c2.fillRect(x + w / 2 - 6, y + 3, 12, 4);              // シャワーヘッド
        c2.fillStyle = '#8a949c'; c2.fillRect(x + w / 2 - 5, y + 7, 10, 2);              // 散水面
        c2.fillStyle = '#7f8a92'; c2.fillRect(x + w / 2 + 5, y + 10, 3, 4);              // 混合栓のレバー
        if (!broken) {                                                                   // 落ちてくる湯（本数をずらして流れに見せる）
          c2.fillStyle = 'rgba(190,225,240,.75)';
          for (let i = 0; i < 5; i++) {
            const sx = x + w / 2 - 4 + i * 2;
            const t = (rt * 26 + i * 5.5 + it.x * 3) % 14;
            c2.fillRect(sx, y + 9 + t, 1, 4);
          }
          c2.fillStyle = 'rgba(210,235,245,.35)'; c2.fillRect(x + w / 2 - 5, y + h - 9, 10, 2);   // 足元のはね
        }
        c2.fillStyle = '#6f7a80'; c2.fillRect(x + w / 2 - 5, y + h - 6, 10, 4);          // 排水口
        c2.fillStyle = '#4a5359';
        for (let i = 0; i < 3; i++) c2.fillRect(x + w / 2 - 4 + i * 3, y + h - 5, 1, 2);
        break;
      }
      if (it.id === 'wash_triple') {
        // 三連カラン＝2マスぶんの幅に、鏡・カラン・桶の1人分セットを3つ並べる
        const slot = w / 3;
        for (let i = 0; i < 3; i++) {
          const sx = x + i * slot;
          c2.fillStyle = '#dcdcd4'; c2.fillRect(sx + 2, y + 2, slot - 4, h - 4);
          c2.fillStyle = '#bfe3f2'; c2.fillRect(sx + 3, y + 4, slot - 6, 7);              // 鏡
          c2.fillStyle = '#9a9a9a'; c2.fillRect(sx + slot / 2 - 1.5, y + 12, 3, 5);       // カラン
          c2.fillStyle = '#e8c84a'; c2.fillRect(sx + 3, y + h - 8, slot - 6, 5);          // 桶
        }
        c2.strokeStyle = 'rgba(0,0,0,.2)'; c2.lineWidth = 1;
        for (let i = 1; i < 3; i++) { c2.beginPath(); c2.moveTo(x + i * slot, y + 2); c2.lineTo(x + i * slot, y + h - 2); c2.stroke(); }
        break;
      }
      c2.fillStyle = def.old ? '#a8a498' : '#dcdcd4'; c2.fillRect(x + 2, y + 2, w - 4, h - 4);
      c2.fillStyle = '#bfe3f2'; c2.fillRect(x + 6, y + 4, w - 12, 8);                    // 鏡
      c2.fillStyle = def.old ? '#8a6a48' : '#9a9a9a'; c2.fillRect(x + w / 2 - 2, y + 13, 4, 6); // カラン
      c2.fillStyle = '#e8c84a'; c2.fillRect(x + 8, y + h - 10, 8, 6);                    // 桶
      c2.fillStyle = def.old ? '#b3402e' : '#e86a5a'; c2.fillRect(x + w - 15, y + h - 10, 8, 6); // 腰掛け
      break;
    }
    case 'locker': {
      // 扉の数＝収容人数に合わせる（普通=2列×2段の4室／12連結=6列×2段の12室。見た目と数字を一致させる）
      const cols = it.id === 'locker2' ? 6 : 2;
      c2.fillStyle = def.old ? '#8a6a48' : it.id === 'locker2' ? '#7f8fa6' : '#c98f4e';
      c2.fillRect(x + 1, y + 1, w - 2, h - 2);
      c2.strokeStyle = 'rgba(0,0,0,.35)'; c2.lineWidth = 1;
      for (let i = 1; i < cols; i++) { c2.beginPath(); c2.moveTo(x + i * (w / cols), y + 2); c2.lineTo(x + i * (w / cols), y + h - 2); c2.stroke(); }
      c2.beginPath(); c2.moveTo(x + 2, y + h / 2); c2.lineTo(x + w - 2, y + h / 2); c2.stroke();
      if (it.id === 'locker2') {   // 扉の取っ手をひとつずつ光らせる＝金属の質感
        c2.fillStyle = 'rgba(255,255,255,.5)';
        for (let i = 0; i < cols; i++) for (let j = 0; j < 2; j++)
          c2.fillRect(x + i * (w / cols) + w / cols - 4, y + 4 + j * (h / 2), 2, 4);
      }
      if (def.old) { c2.strokeStyle = '#3a2a1c'; c2.beginPath(); c2.moveTo(x + w - 10, y + 4); c2.lineTo(x + w - 3, y + h / 2 + 3); c2.stroke(); }
      break;
    }
    case 'rest': {
      if (it.id === 'chair1') {                          // ととのいイス（白）
        c2.fillStyle = '#f0f0e8'; c2.fillRect(x + 5, y + 4, w - 10, h - 8);
        c2.fillStyle = '#d8d8cc'; for (let i = 0; i < 3; i++) c2.fillRect(x + 7, y + 7 + i * 7, w - 14, 3);
        c2.fillStyle = '#f0f0e8'; c2.fillRect(x + 3, y + 8, 4, 12); c2.fillRect(x + w - 7, y + 8, 4, 12);
      } else if (it.id === 'chair2') {                   // リクライニングチェア（青）
        c2.fillStyle = '#34566e'; c2.fillRect(x + 3, y + 4, w - 6, h - 8);
        c2.fillStyle = '#5a86a8'; c2.fillRect(x + 5, y + 8, w - 10, h - 15);
        c2.fillStyle = '#2c4356'; c2.fillRect(x + 5, y + h - 8, w - 10, 4);
        c2.fillStyle = '#dfe8ea'; c2.fillRect(x + 7, y + 6, w - 14, 4);
      } else if (it.id === 'chair_inf') {                // インフィニティチェア（銀フレーム＋深く倒れた座面）
        c2.fillStyle = '#9aa4ac'; c2.fillRect(x + 3, y + 6, 3, 20); c2.fillRect(x + w - 6, y + 6, 3, 20);
        c2.fillStyle = '#2f4a5a'; c2.fillRect(x + 4, y + 8, w - 8, 16);
        c2.fillStyle = '#4a6f86'; c2.fillRect(x + 6, y + 10, w - 12, 6);
        c2.fillStyle = '#cfe0e8'; c2.fillRect(x + 6, y + 18, w - 12, 3);
        c2.fillStyle = '#9aa4ac'; c2.fillRect(x + 6, y + h - 6, w - 12, 2);
      } else {                                           // 木のベンチ
        c2.fillStyle = '#a9743f'; c2.fillRect(x + 3, y + 10, w - 6, 12);
        c2.fillStyle = '#8a5a2f'; c2.fillRect(x + 5, y + 22, 4, 6); c2.fillRect(x + w - 9, y + 22, 4, 6);
      }
      break;
    }
    // ── 脱衣所に置くもの（洗面所・体重計・テレビ・ポスター・将棋台・自販機・マッサージチェア）
    case 'datsui': {
      if (it.id === 'vend1' || it.id === 'vend2') {
        const milk = it.id === 'vend1';
        c2.fillStyle = '#f0f0f0'; c2.fillRect(x + 3, y + 1, w - 6, h - 2);
        c2.fillStyle = milk ? '#3a6ea5' : '#b3402e'; c2.fillRect(x + 3, y + 1, w - 6, 9);
        c2.fillStyle = '#fff'; c2.font = 'bold 7px sans-serif'; c2.textAlign = 'center';
        c2.fillText(milk ? '牛乳' : 'ドリンク', x + w / 2, y + 8);
        c2.fillStyle = '#e8e8e8'; c2.fillRect(x + 7, y + 13, w - 14, 10);
        if (!milk) { c2.fillStyle = '#4a8ac9'; c2.fillRect(x + 8, y + 14, 4, 8); c2.fillStyle = '#e8c84a'; c2.fillRect(x + 14, y + 14, 4, 8); }
        c2.fillStyle = '#b3402e'; c2.fillRect(x + w - 9, y + 15, 3, 5);
      } else if (TOILET_IDS.includes(it.id)) {
        /* トイレ（作者指定）。床のタイルの上に便器を置く。
           ボットン＝和式の細長い便器と金隠し（臭いが立ちのぼる）。
           洋式＝タンク・便座・フタ。ウォシュレットは操作パネル、多目的は手すりとおむつ台 */
        const boton = it.id === 'toilet_old';
        c2.fillStyle = boton ? '#b9b3a4' : '#e4e8ea';                       // 床のタイル
        c2.fillRect(x + 2, y + 2, w - 4, h - 4);
        c2.strokeStyle = 'rgba(0,0,0,.10)'; c2.lineWidth = 1;
        for (let gx2 = x + 2; gx2 < x + w - 2; gx2 += 8) { c2.beginPath(); c2.moveTo(gx2, y + 2); c2.lineTo(gx2, y + h - 2); c2.stroke(); }
        const cx0 = x + w / 2;
        if (boton) {
          c2.fillStyle = '#cfcabc';                                          // 和式便器（縦長）
          c2.beginPath(); c2.ellipse(cx0, y + 17, 6, 10, 0, 0, Math.PI * 2); c2.fill();
          c2.fillStyle = '#2a2622';                                          // 落とし穴
          c2.beginPath(); c2.ellipse(cx0, y + 19, 3.4, 6, 0, 0, Math.PI * 2); c2.fill();
          c2.fillStyle = '#d8d3c6';                                          // 金隠し
          c2.beginPath(); c2.ellipse(cx0, y + 8, 5.5, 4, 0, Math.PI, 0); c2.fill();
          c2.strokeStyle = 'rgba(90,80,60,.45)'; c2.lineWidth = 0.8;         // 立ちのぼる臭い
          for (let i = 0; i < 2; i++) {
            const ph = (rt * 0.5 + i * 0.5) % 1;
            c2.globalAlpha = (1 - ph) * 0.7;
            c2.beginPath();
            c2.moveTo(cx0 - 3 + i * 6, y + 14 - ph * 10);
            c2.quadraticCurveTo(cx0 - 1 + i * 6, y + 10 - ph * 10, cx0 - 3 + i * 6, y + 6 - ph * 10);
            c2.stroke();
          }
          c2.globalAlpha = 1;
        } else {
          const multi = it.id === 'toilet_multi';
          if (multi) {                                                       // 手すり（横棒2本）とおむつ台
            c2.fillStyle = '#e8c34a'; c2.fillRect(x + 3, y + 20, 7, 2.4); c2.fillRect(x + w - 10, y + 20, 7, 2.4);
            c2.fillStyle = '#cfd8dc'; c2.fillRect(x + 3, y + 5, 8, 6);
          }
          c2.fillStyle = '#f4f6f6'; c2.fillRect(cx0 - 6, y + 4, 12, 7);      // タンク
          c2.fillStyle = '#dfe4e6'; c2.fillRect(cx0 - 6, y + 10, 12, 2);
          c2.fillStyle = '#f8fafa';                                          // 便座（楕円）
          c2.beginPath(); c2.ellipse(cx0, y + 18, 6.5, 8, 0, 0, Math.PI * 2); c2.fill();
          c2.fillStyle = '#cfd8dc';
          c2.beginPath(); c2.ellipse(cx0, y + 18.5, 3.6, 5, 0, 0, Math.PI * 2); c2.fill();
          c2.fillStyle = '#eef2f4';                                          // 上げたフタ
          c2.beginPath(); c2.ellipse(cx0, y + 10, 6, 3, 0, Math.PI, 0); c2.fill();
          if (it.id === 'toilet2') {                                         // ウォシュレットの操作パネル
            c2.fillStyle = '#f0f2f2'; c2.fillRect(cx0 + 6, y + 12, 5, 8);
            c2.fillStyle = broken ? '#8a8a84' : '#4aa3e0'; c2.fillRect(cx0 + 7, y + 14, 3, 2);
            c2.fillStyle = '#b3402e'; c2.fillRect(cx0 + 7, y + 17, 3, 1.6);
          }
        }
      } else if (it.id === 'sink' || it.id === 'sink_old') {  // 洗面所（鏡＋洗面台2つ＋ドライヤー＋化粧水と乳液のボトル）
        // 親父の代からの古い洗面台は、鏡が曇り、カウンターも黄ばんでいる（＋ヒビが1本入る）
        const worn = it.id === 'sink_old';
        c2.fillStyle = worn ? '#9aa8a8' : '#9fd0e0'; c2.fillRect(x + 4, y + 3, w - 8, 9);   // 鏡
        c2.fillStyle = `rgba(255,255,255,${worn ? .2 : .45})`; c2.fillRect(x + 5, y + 4, (w - 10) / 2, 3);
        c2.fillStyle = worn ? '#6b6b62' : '#8a8a84'; c2.fillRect(x + 4, y + 3, w - 8, 1);
        c2.fillStyle = worn ? '#d8cfba' : '#e8e4dc'; c2.fillRect(x + 3, y + 15, w - 6, 9);  // 洗面台のカウンター
        c2.fillStyle = worn ? '#6b4f36' : '#8a6a4a'; c2.fillRect(x + 3, y + 24, w - 6, 3);
        c2.fillStyle = worn ? '#bcc2c2' : '#cfd8dc';                                        // 洗面ボウル2つ
        for (const bx of [x + 8, x + w - 20]) {
          c2.beginPath(); c2.ellipse(bx + 6, y + 20, 6, 3.5, 0, 0, Math.PI * 2); c2.fill();
          c2.fillStyle = worn ? '#7f7f78' : '#9a9a9a'; c2.fillRect(bx + 5, y + 13, 2, 4);
          c2.fillStyle = worn ? '#bcc2c2' : '#cfd8dc';
        }
        if (worn) {                                                             // 鏡のヒビ
          c2.strokeStyle = 'rgba(60,58,54,.7)'; c2.lineWidth = 0.8;
          c2.beginPath(); c2.moveTo(x + w - 12, y + 3); c2.lineTo(x + w - 16, y + 8); c2.lineTo(x + w - 10, y + 12); c2.stroke();
        }
        c2.fillStyle = '#bfe3f2'; c2.fillRect(x + w / 2 - 5, y + 9, 4, 7);      // 化粧水
        c2.fillStyle = '#4a8ac9'; c2.fillRect(x + w / 2 - 4.5, y + 7, 3, 2);
        c2.fillStyle = '#f2e8d8'; c2.fillRect(x + w / 2 + 1, y + 10, 4, 6);     // 乳液
        c2.fillStyle = '#d9a34f'; c2.fillRect(x + w / 2 + 1.5, y + 8, 3, 2);
        const dx = x + w / 2 + 7;                                               // ドライヤー（カウンターに立てて置いてある）
        c2.fillStyle = '#f4efe6'; c2.fillRect(dx, y + 9, 7, 5);                 // 本体
        c2.fillStyle = '#b3402e'; c2.fillRect(dx, y + 11, 7, 1.5);              // 赤いライン
        c2.fillStyle = '#f4efe6'; c2.fillRect(dx + 4, y + 14, 3, 3);            // 握り
        c2.fillStyle = '#6b6b66'; c2.fillRect(dx - 2, y + 10, 2, 3);            // 吹き出し口（左向き）
      } else if (it.id === 'scale') {                    // アナログ体重計（針が振れる）
        c2.fillStyle = '#cfcfc8'; c2.fillRect(x + 5, y + 10, w - 10, 14);
        c2.fillStyle = '#8a8a84'; c2.fillRect(x + 5, y + 22, w - 10, 3);
        c2.fillStyle = '#f8f8f0'; c2.beginPath(); c2.arc(x + w / 2, y + 15, 6, 0, Math.PI * 2); c2.fill();
        c2.strokeStyle = '#b3402e'; c2.lineWidth = 1.4;
        // 誰かが乗っている間は針が大きく暴れてから、じわじわ目盛りへ収束していく
        let a;
        if (it.pasBy) {
          const damp = Math.exp(-((rt * 2) % 3) * 1.1);                 // 乗った瞬間ほど大きく振れ、やがて落ち着く
          a = -Math.PI / 2 + (0.5 + Math.sin(rt * 9 + it.x) * 1.6 * damp);
        } else {
          a = -Math.PI / 2 + Math.sin(rt * 1.2 + it.x) * 0.9;          // 無人のときはゆらゆら
        }
        c2.beginPath(); c2.moveTo(x + w / 2, y + 15); c2.lineTo(x + w / 2 + Math.cos(a) * 4.5, y + 15 + Math.sin(a) * 4.5); c2.stroke();
      } else if (it.id === 'tv') {                       // ブラウン管テレビ（画面が明滅）
        c2.fillStyle = '#2c2a28'; c2.fillRect(x + 3, y + 6, w - 6, 18);
        const on = broken ? '#555' : (Math.sin(rt * 5 + it.x) > 0 ? '#9fd8ff' : '#7ab8e8');
        c2.fillStyle = on; c2.fillRect(x + 6, y + 9, w - 16, 12);
        c2.fillStyle = 'rgba(255,255,255,.35)'; c2.fillRect(x + 6, y + 9, w - 16, 2);
        c2.fillStyle = '#4a4640'; c2.fillRect(x + w - 9, y + 10, 5, 10);
        c2.fillStyle = '#8a8a84'; c2.fillRect(x + 8, y + 3, 2, 4); c2.fillRect(x + 15, y + 2, 2, 5);
      } else if (it.id === 'poster') {                   // 昭和アイドルのポスター
        c2.fillStyle = '#f4e6c8'; c2.fillRect(x + 5, y + 4, w - 10, 22);
        c2.fillStyle = '#e8a0b0'; c2.fillRect(x + 7, y + 6, w - 14, 18);
        c2.fillStyle = '#f2c9a0'; c2.beginPath(); c2.arc(x + w / 2, y + 13, 5, 0, Math.PI * 2); c2.fill();
        c2.fillStyle = '#3a2a1c'; c2.beginPath(); c2.arc(x + w / 2, y + 11.5, 5, Math.PI, 0); c2.fill();
        c2.fillStyle = '#333'; c2.fillRect(x + w / 2 - 2.5, y + 13, 1.4, 1.4); c2.fillRect(x + w / 2 + 1.2, y + 13, 1.4, 1.4);
        c2.fillStyle = '#b3402e'; c2.fillRect(x + w / 2 - 4, y + 19, 8, 4);
        c2.fillStyle = '#c9a86a'; c2.fillRect(x + 5, y + 4, w - 10, 2);
      } else if (it.id === 'shogi') {                    // 将棋台（駒が並ぶ）
        c2.fillStyle = '#d9b98a'; c2.fillRect(x + 4, y + 8, w - 8, 16);
        c2.fillStyle = '#a9743f'; c2.fillRect(x + 6, y + 22, 3, 5); c2.fillRect(x + w - 9, y + 22, 3, 5);
        c2.strokeStyle = 'rgba(80,50,20,.5)'; c2.lineWidth = 1;
        for (let i = 1; i < 4; i++) { c2.beginPath(); c2.moveTo(x + 4 + i * ((w - 8) / 4), y + 8); c2.lineTo(x + 4 + i * ((w - 8) / 4), y + 24); c2.stroke(); }
        for (let i = 1; i < 3; i++) { c2.beginPath(); c2.moveTo(x + 4, y + 8 + i * 5.3); c2.lineTo(x + w - 4, y + 8 + i * 5.3); c2.stroke(); }
        c2.fillStyle = '#f0e0b8'; c2.fillRect(x + 7, y + 10, 4, 3); c2.fillRect(x + w - 12, y + 19, 4, 3);
      } else if (it.id === 'gacha') {                    // ガチャガチャ（カプセルの詰まった丸い頭＋つまみ）
        c2.fillStyle = '#7a2f2a'; c2.fillRect(x + 6, y + 14, w - 12, 12);          // 台座
        c2.fillStyle = '#5a231f'; c2.fillRect(x + 6, y + 24, w - 12, 3);
        c2.fillStyle = '#e8eef2'; c2.beginPath(); c2.arc(x + w / 2, y + 11, 8, 0, Math.PI * 2); c2.fill();  // ガラス球
        const caps = ['#e05a5a', '#e8c34a', '#4aa3e0', '#6ac96a', '#c96ac9'];
        for (let i = 0; i < 5; i++) {                                              // 中のカプセル
          c2.fillStyle = caps[i];
          c2.beginPath(); c2.arc(x + w / 2 - 4.5 + (i % 3) * 4.5, y + 9 + (i > 2 ? 4 : 0), 2, 0, Math.PI * 2); c2.fill();
        }
        c2.fillStyle = 'rgba(255,255,255,.5)'; c2.beginPath(); c2.arc(x + w / 2 - 3, y + 8, 2.5, 0, Math.PI * 2); c2.fill();
        const ga = it.pasBy ? rt * 6 : 0;                                          // 回している間だけつまみが回る
        c2.strokeStyle = '#f0d060'; c2.lineWidth = 2;
        c2.beginPath(); c2.moveTo(x + w / 2, y + 19); c2.lineTo(x + w / 2 + Math.cos(ga) * 3.5, y + 19 + Math.sin(ga) * 3.5); c2.stroke();
        c2.fillStyle = '#2f2a26'; c2.fillRect(x + w / 2 - 4, y + 22, 8, 3);        // 取り出し口
      } else if (it.id === 'ehon') {                     // 絵本の棚（背の低い本棚に絵本が並ぶ）
        c2.fillStyle = '#a9743f'; c2.fillRect(x + 4, y + 8, w - 8, 18);
        c2.fillStyle = '#c9a86a'; c2.fillRect(x + 5, y + 9, w - 10, 7);
        c2.fillStyle = '#c9a86a'; c2.fillRect(x + 5, y + 18, w - 10, 7);
        const bk = ['#e05a5a', '#4aa3e0', '#e8c34a', '#6ac96a', '#c96ac9', '#e8845a'];
        for (let i = 0; i < 5; i++) { c2.fillStyle = bk[i]; c2.fillRect(x + 6 + i * 3.4, y + 9, 2.6, 7); }
        for (let i = 0; i < 5; i++) { c2.fillStyle = bk[(i + 2) % 6]; c2.fillRect(x + 6 + i * 3.4, y + 18, 2.6, 7); }
        c2.fillStyle = '#8a5a2f'; c2.fillRect(x + 4, y + 25, w - 8, 3);
      } else if (isMassage(it.id)) {                     // マッサージチェア
        c2.fillStyle = '#3a3a44'; c2.fillRect(x + 4, y + 5, w - 8, 20);
        c2.fillStyle = '#5a5a6a'; c2.fillRect(x + 6, y + 8, w - 12, 9);
        c2.fillStyle = '#2c2c34'; c2.fillRect(x + 6, y + 19, w - 12, 5);
        c2.fillStyle = '#8a8a9a'; c2.fillRect(x + 2, y + 12, 3, 8); c2.fillRect(x + w - 5, y + 12, 3, 8);
        c2.fillStyle = broken ? '#555' : '#7ae06a'; c2.fillRect(x + w - 10, y + 6, 4, 2);
      }
      break;
    }
    case 'etc': {
      if (it.id === 'cooler') {
        /* 冷水機（作者指定＝学校にあるあの水飲み器）。グレーの縦長の箱に、
           ステンレスの天板と水受け。天板の噴き口から水が真上に噴き上がり、
           客は身を乗り出して、その水に直接口をつけて飲む（紙コップは使わない） */
        c2.fillStyle = '#b9bdc0'; c2.fillRect(x + 8, y + 10, w - 16, 17);      // 本体（グレーの箱）
        c2.fillStyle = '#a3a8ab'; c2.fillRect(x + 8, y + 10, 2.5, 17);         // side shade
        c2.fillStyle = '#8f9498'; c2.fillRect(x + 8, y + 26, w - 16, 2);       // 足もと
        c2.fillStyle = '#6f7478'; c2.fillRect(x + 11, y + 24, w - 22, 2);      // 足踏みペダル
        c2.fillStyle = '#d7dcdf'; c2.fillRect(x + 6, y + 6, w - 12, 6);        // ステンレスの天板
        c2.fillStyle = '#eef2f4'; c2.fillRect(x + 6, y + 6, w - 12, 1.6);      // 天板のハイライト
        c2.fillStyle = '#9aa1a5';                                              // 天板にくぼんだ水受け
        c2.beginPath(); c2.ellipse(x + w / 2, y + 9.6, (w - 18) / 2, 2.6, 0, 0, Math.PI * 2); c2.fill();
        c2.fillStyle = '#7f868a';                                              // 噴き口
        c2.beginPath(); c2.ellipse(x + w / 2, y + 8.6, 1.8, 1.1, 0, 0, Math.PI * 2); c2.fill();
        if (!broken) {
          /* 水は誰も居なくてもちょろちょろ出ている。飲んでいる間は勢いよく噴き上がる。
             噴水は客の体の後ろになる（設備は客より先に描く）ので、口もとで自然に隠れる */
          const jx = x + w / 2, jy = y + 8;
          const hgt = it.pasBy ? 11 + Math.sin(rt * 7) * 1.2 : 3.5;
          c2.strokeStyle = 'rgba(150,215,245,.95)'; c2.lineWidth = 2.0; c2.lineCap = 'round';
          c2.beginPath(); c2.moveTo(jx, jy); c2.lineTo(jx, jy - hgt); c2.stroke();
          c2.strokeStyle = 'rgba(255,255,255,.7)'; c2.lineWidth = 0.8;
          c2.beginPath(); c2.moveTo(jx - 0.5, jy - 0.5); c2.lineTo(jx - 0.5, jy - hgt + 0.8); c2.stroke();
          if (it.pasBy) {
            c2.fillStyle = 'rgba(200,240,255,.95)';                            // 噴き上がった先で散る粒
            for (let i = 0; i < 4; i++) {
              const ph = (rt * 1.8 + i * 0.25) % 1;
              const sway = (i % 2 ? 1 : -1) * (1 + ph * 3.5);
              c2.globalAlpha = 1 - ph;
              c2.beginPath(); c2.arc(jx + sway, jy - hgt + ph * ph * 9, 1.2 * (1 - ph) + .5, 0, Math.PI * 2); c2.fill();
            }
            c2.globalAlpha = 1;
          }
        }
      } else if (it.id === 'fan_bath') {                 // 扇風機（首振り・羽根が回る）
        c2.fillStyle = '#8a8a84'; c2.fillRect(x + w / 2 - 1.5, y + 18, 3, 8);
        c2.fillStyle = '#6b6b66'; c2.fillRect(x + 9, y + 25, w - 18, 3);
        const sw = Math.sin(rt * 0.8 + it.x) * 3;
        c2.fillStyle = '#d8d8d0'; c2.beginPath(); c2.arc(x + w / 2 + sw, y + 12, 8, 0, Math.PI * 2); c2.fill();
        c2.fillStyle = broken ? '#8a8a84' : '#9fc8d8';
        for (let i = 0; i < 3; i++) {
          const a = rt * (broken ? 0 : 9) + i * 2.1;
          c2.beginPath(); c2.moveTo(x + w / 2 + sw, y + 12);
          c2.arc(x + w / 2 + sw, y + 12, 7, a, a + 0.9); c2.closePath(); c2.fill();
        }
        c2.fillStyle = '#5a5a54'; c2.beginPath(); c2.arc(x + w / 2 + sw, y + 12, 2, 0, Math.PI * 2); c2.fill();
      } else {                                                    // 観葉植物
        c2.fillStyle = '#b3402e'; c2.fillRect(x + 10, y + 20, 12, 9);
        c2.fillStyle = '#4a8a3a';
        c2.beginPath(); c2.arc(x + 16, y + 14, 9, 0, Math.PI * 2); c2.arc(x + 10, y + 18, 6, 0, Math.PI * 2); c2.arc(x + 22, y + 18, 6, 0, Math.PI * 2); c2.fill();
      }
      break;
    }
    case 'amenity': {                                   // マット／垢すりタオルの置き場
      // 台の上に1枚だけ乗っている絵。小さく描き分けても縮小すると潰れるので大きな長方形で
      c2.fillStyle = '#8a6a4a'; c2.fillRect(x + 3, y + 6, w - 6, h - 9);      // 木の台
      c2.fillStyle = '#6a4f34'; c2.fillRect(x + 3, y + 6, w - 6, 2);
      c2.fillStyle = it.id === 'matrack' ? '#4a8ac9' : '#d9534f';
      c2.fillRect(x + 6, y + 10, w - 12, h - 17);                             // マット／垢すり1枚
      c2.fillStyle = 'rgba(255,255,255,.25)'; c2.fillRect(x + 6, y + 10, w - 12, 2);
      break;
    }
  }
}

/* 湯船の“売り”を絵で見せる（ジェットバス・高濃度炭酸泉・電気風呂の3つだけ特別扱い）。
   湯面より後に描くので、客が浸かっていても効果は見える。
   乱数は使わず時間と番号から作る＝毎フレーム泡が飛び回らない */
function drawFuroFx(c2, it, x, y, w, h, rt) {
  const ix = x + 4, iy = y + 4, iw = w - 8, ih = h - 8;   // 湯の内側
  c2.save();
  c2.beginPath(); c2.rect(ix, iy, iw, ih); c2.clip();     // 湯船からはみ出させない
  if (it.id === 'bath_jet') {
    // 左右の壁の噴き出し口から、泡を巻き込んだ水流が中央へ向かって伸びる
    for (let s = 0; s < 2; s++) {
      const sx = s ? ix + iw : ix, dir = s ? -1 : 1;
      for (let n = 0; n < 2; n++) {
        const jy = iy + ih * (n === 0 ? 0.32 : 0.68);
        c2.fillStyle = 'rgba(226,240,248,.9)';            // 噴き出し口の金具
        c2.fillRect(s ? sx - 3 : sx, jy - 2.5, 3, 5);
        for (let k = 0; k < 5; k++) {
          const ph = (rt * 1.5 + n * 0.31 + k * 0.2) % 1;
          const bx = sx + dir * (3 + ph * iw * 0.5);
          const by = jy + Math.sin(rt * 4 + k * 1.3 + n) * 1.6;
          c2.fillStyle = `rgba(255,255,255,${(0.6 * (1 - ph)).toFixed(2)})`;
          c2.beginPath(); c2.arc(bx, by, 2.6 * (1 - ph * 0.55), 0, Math.PI * 2); c2.fill();
        }
      }
    }
  } else if (it.id === 'bath_tansan') {
    // 細かい泡が底から湯面へ立ちのぼり続ける＝炭酸泉のシュワシュワ
    for (let i = 0; i < 26; i++) {
      const r0 = ((Math.sin(i * 12.9898 + it.x) * 43758.5453) % 1 + 1) % 1;   // 番号ごとの定位置
      const bx = ix + 1.5 + r0 * (iw - 3);
      const ph = (rt * (0.3 + (i % 5) * 0.05) + i * 0.137) % 1;
      const by = iy + ih - ph * ih;
      c2.fillStyle = `rgba(255,255,255,${(0.2 + 0.5 * (1 - ph)).toFixed(2)})`;
      c2.beginPath(); c2.arc(bx, by, 0.7 + (i % 3) * 0.35, 0, Math.PI * 2); c2.fill();
    }
  } else if (it.id === 'bath_denki') {
    // 左右の電極板と、ときどき走る電気。出しっぱなしにはしない（目に痛いのと、常時光ると安っぽい）
    c2.fillStyle = '#cfc8b8';
    c2.fillRect(ix, iy + ih / 2 - 6, 2.5, 12); c2.fillRect(ix + iw - 2.5, iy + ih / 2 - 6, 2.5, 12);
    if (Math.sin(rt * 3.4 + it.x) > 0.25) {
      const y0 = iy + ih / 2;
      const zig = () => {
        c2.beginPath(); c2.moveTo(ix + 2.5, y0);
        for (let i = 1; i <= 6; i++)
          c2.lineTo(ix + 2.5 + (iw - 5) * i / 6, y0 + (i % 2 ? -1 : 1) * (2 + Math.sin(rt * 22 + i) * 1.8));
        c2.stroke();
      };
      c2.strokeStyle = 'rgba(255,255,255,.3)'; c2.lineWidth = 3.5; zig();   // 光のにじみ
      c2.strokeStyle = 'rgba(255,240,150,.95)'; c2.lineWidth = 1.4; zig();
    }
  }
  c2.restore();
}

function drawSteam(c2, x, y, rt, color) {
  c2.fillStyle = color || 'rgba(255,255,255,.4)';
  for (let i = 0; i < 3; i++) {
    const ph = (rt * .8 + i * .37) % 1;
    const sy = y - ph * 18, sx = x + Math.sin((rt + i) * 3) * 5 + (i - 1) * 9;
    c2.beginPath(); c2.arc(sx, sy, 4 * (1 - ph) + 1, 0, Math.PI * 2); c2.fill();
  }
}

/* 客と同じ描き方をするが、髪型・髭・サングラス・ヘルメットなどで「誰なのか」が分かる相手 */
function hasFace(e) { return e.kind === 'cust' || e.kind === 'npc'; }

/* 主人公が番台についているか＝番台のとなりに立ち止まっている。
   このあいだは台の向こう側に立っている扱いにして、上から頭だけ出す（作者指定） */
function atBandaiPost(e) {
  if (e.kind !== 'player' || e.moving) return false;
  /* 番台はロビーにしかない。別の部屋（とくに家）に居るのに番台扱いになると、
     台の高さで胴を切って描くので「顔だけの主人公」になってしまう */
  const b = bandai(); if (!b || (b.f | 0) !== (e.f | 0)) return false;
  const s = playerSpot(), t = tileOf(e);
  return t.x === s.x && t.y === s.y && Math.abs(s.x - b.x) + Math.abs(s.y - b.y) === 1;
}

/* 子どもは大人と同じ絵を、足もとを軸に縮めて描く（作者指定＝子供の画像）。
   頭は縮めすぎると顔が潰れるので、体より控えめに縮む＝頭が大きい子どもの体型になる */
const KID_SCALE = 0.66;
/* 設備の「上に」乗る／座るもの（作者指定）。体重計は乗って針を見る、トイレは座って（和式はしゃがんで）用を足す。
   立ち位置ではなく設備そのものの真上に描き、dy で高さを変える＝乗っている・座っているように見せる */
function pasOn(e) {
  if (!(e.state === 'usingPas' && e.pas)) return null;
  if (e.pas.kind === 'scale') return { item: e.pas.item, dy: -3 };
  if (e.pas.kind === 'toilet') return { item: e.pas.item, dy: e.pas.item.id === 'toilet_old' ? 5 : 2 };
  return null;
}
function drawChar(e, rt) {
  if (!e.isChild) { drawCharBody(e, rt); return; }
  ctx.save();
  // 縮める軸は「その子が実際に立っている足もと」。体重計に乗っている間は台の上が足もとになる
  const onScale = pasOn(e);
  const gx = onScale ? onScale.item.x * T + T / 2 : e.px;
  const gy = (onScale ? onScale.item.y * T + T / 2 + onScale.dy : e.py) + 8;
  ctx.translate(gx, gy); ctx.scale(KID_SCALE, KID_SCALE); ctx.translate(-gx, -gy);
  drawCharBody(e, rt);
  ctx.restore();
}
/* ============ 設備ごとの姿勢 ============
   イスには座るし、リクライナーでは横になるし、本棚では本をめくる（作者指定）。
   どの格好になるかは **設備の側（EQ の pose）** に書いてある＝
   設備を1つ足したら、その設備の定義に pose を1語書くだけで芝居が付く。

   第1章の設備は pose を持たないので、第1章の客はこれまでどおり立ったまま。   */
/* ============ 装い ============
   **裸なのは浴室だけ**（作者指定）。ロッカーで着替えたあとの客も、
   休憩スペース・食堂・ロビーでは館内着を着ている。
   どこで何を着ているかは区画の wear に書いてあるので、そこから引く。
   第1章は区画を持たない（areaDef が null）ので、これまでどおり腰タオルのまま。 */
function inHouseWear(e) {
  if (e.kind !== 'cust' || e.mode !== 'towel') return false;
  const a = areaDef(e.f | 0);
  return !!(a && a.wear && a.wear.indexOf('裸') < 0);
}
function poseOf(e) {
  if (e.kind !== 'cust' || e.state !== 'using' || !e.use || !e.use.item) return null;
  const d = EQ[e.use.item.id];
  return (d && d.pose) || null;
}
/* 姿勢の土台。芝居（eat・work…）は、どれかの座り方／寝方の上に乗る */
const POSE_BASE = {
  sit: 'sit', sink: 'sink', lie: 'lie', read: 'read',
  eat: 'sit', work: 'sit', tv: 'sit', yomogi: 'sit', massage: 'sit',
  shave: 'sit', dress: 'sit', stage: 'sit',
  ganban: 'lie',
  phone: 'stand', buy: 'stand', smoke: 'stand', shower: 'stand',
  eatStand: 'stand',              // 立ち飲みカウンター＝立ったまま食う
};
/* 体そのものの変形。息づかいのぶんだけ、ゆっくり伸び縮みさせる。
   客は設備の「左上のマス」に立たされるので、**縦に長い設備では体が上半分に寄る。**
   横になるときだけは、その設備の丈に合わせて中央へ送り、丈なりに伸ばす
   （仮眠リクライナーは1×2＝縦長。ごろ寝マットやハンモックは2×1なので送らない） */
function poseTransform(pose, e, rt) {
  const br = Math.sin(rt * 1.15 + e.wob);            // ゆっくりした呼吸
  const tall = Math.max(0, eh(e.use.item) - 1);      // 何マスぶん縦に長いか
  switch (POSE_BASE[pose]) {
    // 座る：腰を落として脚をたたむ
    case 'sit':  return { dy: 3.5, sx: 1.00, sy: 0.85 + br * 0.010 };
    // 沈む（ビーズクッション）：さらに低く、横に広がる
    case 'sink': return { dy: 6.0, sx: 1.10, sy: 0.72 + br * 0.012 };
    // 横になる：背もたれに預けて、体が縦に伸びる
    case 'lie':  return { dy: 7.0 + tall * T * 0.30, sx: 0.94,
                          sy: 1.16 + tall * 0.22 + br * 0.020 };
    // 本を読む：浅く腰かけて、少し前かがみ
    case 'read': return { dy: 3.0, sx: 1.00, sy: 0.90 };
  }
  return null;                                        // stand ＝ 立ったまま（芝居だけ付く）
}
/* 立ちのぼる湯気・煙。何本か、順ぐりに上がって消える */
function poseSteam(x, y, rt, seed, col, n) {
  const N = n || 3;
  ctx.fillStyle = col || 'rgba(255,255,255,.75)';
  for (let i = 0; i < N; i++) {
    const ph = (rt * 0.9 + i / N + seed) % 1;
    ctx.globalAlpha = 0.7 * (1 - ph);
    ctx.fillRect(x - 3 + Math.sin(rt * 3 + i * 2) * 2 + i * 3, y - ph * 9, 1.6, 3);
  }
  ctx.globalAlpha = 1;
}
/* 目を閉じる（脱力・居眠り） */
function poseShutEyes(x, y) {
  ctx.fillStyle = '#2a2320';
  ctx.fillRect(x - 4, y - 7.6, 3, 1); ctx.fillRect(x + 1, y - 7.6, 3, 1);
}
/* 姿勢ごとの小芝居。体と同じ変形の中で描くので、座れば道具も一緒に下がる */
function drawPoseExtra(pose, e, x, y, rt, skin) {
  const wob = e.wob;
  switch (pose) {
    case 'lie': case 'ganban': {                                       // 寝ている
      poseShutEyes(x, y);
      if (pose === 'ganban') poseSteam(x - 1, y - 14, rt, wob, 'rgba(255,236,210,.7)');
      const ph = (rt * 0.45 + wob) % 1;                                 // 寝息がひとつ、ふわりと上がる
      ctx.globalAlpha = 0.85 * (1 - ph);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('z', x + 7 + ph * 3, y - 13 - ph * 8);
      ctx.globalAlpha = 1;
      break;
    }
    case 'read': {
      /* 開いた本を胸の前に持つ。ページの割れ目が左右に動く＝パラパラめくっている */
      const flip = Math.sin(rt * 3.2 + wob);
      ctx.fillStyle = '#efe9da'; ctx.fillRect(x - 6.5, y - 3.5, 13, 7.5);
      ctx.fillStyle = '#d8d0bc'; ctx.fillRect(x - 6.5, y - 3.5, 13, 1.2);   // 小口
      ctx.strokeStyle = '#a2977f'; ctx.lineWidth = 1;                       // めくれているページ
      ctx.beginPath();
      ctx.moveTo(x + flip * 3.2, y - 3.5); ctx.lineTo(x + flip * 3.2, y + 4); ctx.stroke();
      ctx.fillStyle = skin;                                                 // 本を持つ両手
      ctx.fillRect(x - 8.5, y - 0.5, 2.6, 3.2); ctx.fillRect(x + 5.9, y - 0.5, 2.6, 3.2);
      break;
    }
    case 'eat': case 'eatStand': {
      /* **料理が届くまでは、まだ食べない。** 頼んだものを待っている（作者指定）＝
         注文 → 厨房が作る → ホールが運ぶ、が済んではじめて丼を持つ */
      if (e.order && !e.food) {
        const t3 = (rt * 0.8 + wob) % 1;                                    // 「…」がひとつずつ増える
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        for (let i = 0; i < 3; i++) {
          ctx.globalAlpha = i / 3 <= t3 ? 0.85 : 0.18;
          ctx.beginPath(); ctx.arc(x + 8 + i * 3.2, y - 12, 1.1, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      }
      /* 丼を持って、箸を口へ運ぶ。湯気が立ちのぼる */
      const beat = Math.sin(rt * 2.6 + wob);                                // 箸の上下
      poseSteam(x + 1, y - 8, rt, wob, 'rgba(255,255,255,.6)', 2);
      ctx.fillStyle = '#d8cdb8'; ctx.beginPath();                           // 丼
      ctx.moveTo(x - 5, y - 1); ctx.lineTo(x + 5, y - 1);
      ctx.lineTo(x + 3.4, y + 4); ctx.lineTo(x - 3.4, y + 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b9ab92'; ctx.fillRect(x - 5, y - 1.6, 10, 1.2);     // 縁
      ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 1;                       // 箸
      ctx.beginPath();
      ctx.moveTo(x + 5.5, y + 1); ctx.lineTo(x + 1.5, y - 4.5 - beat * 1.6); ctx.stroke();
      ctx.fillStyle = skin;                                                 // 丼を支える手
      ctx.fillRect(x - 7.5, y - 0.5, 2.6, 3); ctx.fillRect(x + 5, y + 0.5, 2.4, 2.8);
      break;
    }
    case 'work': {
      /* ノートPC。画面の光が顔に当たり、指が動く */
      /* 画面は**胸の高さ**に置く。顔にかぶせると、目もとが液晶で隠れて別人になる */
      const tap = Math.sin(rt * 9 + wob) > 0 ? 0 : 1;
      ctx.fillStyle = 'rgba(160,220,255,.26)';                              // 画面の照り返し
      ctx.fillRect(x - 6, y - 5.5, 12, 3.5);
      ctx.fillStyle = '#3a3f46'; ctx.fillRect(x - 6, y - 2, 12, 6);         // 天板（画面）
      ctx.fillStyle = '#6ab0d8'; ctx.fillRect(x - 5, y - 1.2, 10, 4.4);
      ctx.fillStyle = '#5a6167'; ctx.fillRect(x - 6.5, y + 4, 13, 2.4);     // キーボード
      ctx.fillStyle = skin;                                                 // 打つ手
      ctx.fillRect(x - 4.5, y + 3.4 + tap, 2.4, 2.4);
      ctx.fillRect(x + 2.2, y + 3.4 + (1 - tap), 2.4, 2.4);
      break;
    }
    case 'tv': case 'stage': {
      /* 画面（舞台）の明かりが、点いたり消えたりして顔を照らす */
      ctx.globalAlpha = 0.16 + 0.12 * Math.abs(Math.sin(rt * 1.7 + wob));
      ctx.fillStyle = pose === 'tv' ? '#bfe4ff' : '#ffd9a0';
      ctx.fillRect(x - 7, y - 14, 14, 9);
      ctx.globalAlpha = 1;
      break;
    }
    case 'yomogi': {                                                        // よもぎ蒸し＝足もとから湯気
      poseSteam(x - 1, y - 2, rt, wob, 'rgba(200,235,190,.75)', 4);
      poseShutEyes(x, y);
      break;
    }
    case 'massage': {
      /* 体が細かく揺れ、目を閉じ、頭の上に癒しの湯気が立つ（第1章の massage と同じ芝居） */
      poseShutEyes(x, y);
      poseSteam(x - 1, y - 15, rt, wob);
      break;
    }
    case 'shave': {                                                         // ひげ剃り
      const stroke = Math.sin(rt * 6 + wob) * 2;
      ctx.fillStyle = '#c8ccd2'; ctx.fillRect(x + 2 + stroke, y - 7, 4.5, 1.6);
      ctx.fillStyle = skin; ctx.fillRect(x + 5.5 + stroke, y - 7.6, 2.6, 3);
      break;
    }
    case 'dress': {                                                         // ドレッサーで髪を整える
      const comb = Math.sin(rt * 4.5 + wob) * 2.2;
      ctx.fillStyle = '#d8a0b0'; ctx.fillRect(x - 7.5, y - 12 + comb, 3.4, 5.5);
      ctx.fillStyle = skin; ctx.fillRect(x - 7.8, y - 8 + comb, 2.6, 3);
      break;
    }
    case 'phone': {                                                         // スマホを見ている
      const lit = 0.5 + 0.5 * Math.abs(Math.sin(rt * 1.1 + wob));
      ctx.fillStyle = '#2a2e34'; ctx.fillRect(x - 2.2, y - 4, 4.4, 6.4);
      ctx.globalAlpha = lit; ctx.fillStyle = '#9fd8ff';
      ctx.fillRect(x - 1.6, y - 3.4, 3.2, 5.2); ctx.globalAlpha = 1;
      ctx.fillStyle = skin; ctx.fillRect(x - 4.4, y - 1, 2.4, 3);
      break;
    }
    case 'buy': {                                                           // 小銭を出す／受け取る
      const reach = Math.sin(rt * 2.4 + wob) * 2;
      ctx.fillStyle = skin; ctx.fillRect(x + 4.5 + reach, y - 5, 2.8, 3.2);
      ctx.fillStyle = '#e8c45a';
      ctx.beginPath(); ctx.arc(x + 6 + reach, y - 6.4, 1.5, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'smoke': {                                                         // 一服
      ctx.fillStyle = '#e8e2d2'; ctx.fillRect(x + 3.5, y - 6.4, 3.6, 1.2);  // 煙草
      ctx.fillStyle = '#e07a4a'; ctx.fillRect(x + 7.1, y - 6.4, 1, 1.2);    // 火
      poseSteam(x + 6, y - 10, rt, wob, 'rgba(210,210,205,.5)', 3);
      break;
    }
    case 'shower': {                                                        // アロマミストを浴びる
      ctx.strokeStyle = 'rgba(205,235,215,.7)'; ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const sx2 = x - 4.5 + i * 3, t = (rt * 26 + i * 6 + wob * 3) % 16;
        ctx.beginPath(); ctx.moveTo(sx2, y - 20 + t); ctx.lineTo(sx2, y - 16 + t); ctx.stroke();
      }
      break;
    }
  }
}

function drawCharBody(e, rt) {
  const inWater = e.kind === 'cust' && e.state === 'using' && (e.use.cat === 'furo' || e.use.cat === 'mizu');
  const bob = e.moving ? Math.sin(rt * 14 + e.wob) * 1.6 : 0;
  // 番台についている間は、立ち位置ではなく番台そのものの上に描き、台の高さで胴を切る＝頭だけ出る。
  // 寝ている夜も同じ扱い（atBandaiPost は番台の真横に立った時しか真にならないので、
  // 番台の角に立っていると「立ったまま💤だけ出る」ことがあった）
  const asleepHere = e.kind === 'player' && playerAsleep();
  const post = (atBandaiPost(e) || asleepHere) ? bandai() : null;
  // 体重計は「乗る」もの（作者指定）。使っているあいだは台の真上に立たせ、板の厚みぶん少し持ち上げる
  const onScale = e.kind === 'cust' ? pasOn(e) : null;
  /* 冷水機の水は上から弧を描いて出る（作者指定）。飲む客は、その頂点に口をつけるために
     機械の上へ身を乗り出す＝立ち位置から半分ほど設備側へ寄せて描く */
  const lean = (e.kind === 'cust' && e.state === 'usingPas' && e.pas && e.pas.kind === 'drink') ? e.pas.item : null;
  const leanX = lean ? (lean.x * T + ew(lean) * T / 2 - e.px) * 0.38 : 0;
  const leanY = lean ? (lean.y * T + eh(lean) * T / 2 - e.py) * 0.38 : 0;
  const x = post ? post.x * T + T / 2 : onScale ? onScale.item.x * T + ew(onScale.item) * T / 2 : e.px + leanX;
  // 拭ける数を使い切った夜は、番台に突っ伏して寝ている（作者指定）＝台の高さまで沈める。
  // 一気に沈めず、ひと息おいてから 0.9 秒かけて崩れ落ちる（dozeAmt）
  const asleep = !!post && asleepHere;
  const fall = asleep ? 6 * (1 - Math.cos(Math.PI * dozeAmt())) / 2 : 0;
  const y = post ? post.y * T + 2 + fall : onScale ? onScale.item.y * T + T / 2 + onScale.dy : e.py + bob + leanY;
  if (post) {
    ctx.save();
    ctx.beginPath(); ctx.rect((post.x - 1) * T, 0, T * 3, post.y * T + 5); ctx.clip();
  }
  // 影
  if (!inWater && !post) {
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.ellipse(x, (onScale ? y : e.py) + 8, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  /* 姿勢の変形は**影のあと**からかける＝影は床に残したまま、体だけが沈んだり伸びたりする。
     x,y はそのまま使い続けたいので、いったん (x,y) を原点に寄せてから拡大縮小する */
  const pose = poseOf(e);
  const poseT = pose ? poseTransform(pose, e, rt) : null;
  if (poseT) {
    ctx.save();
    ctx.translate(x, y + poseT.dy);
    ctx.scale(poseT.sx, poseT.sy);
    ctx.translate(-x, -y);
  }
  const skin = '#f2c9a0';
  // 妻（第2章）はバイトと同じ kind='staff' で立つので、髪と制服の色だけ分ける
  const hair = e.kind === 'player' ? '#2a2a2a' : e.isWife ? '#3b2d24' : e.kind === 'staff' ? '#3a2a1a' : e.type.hair;
  if (inWater) {                                     // 湯に浸かる: 頭だけ
    // 湯船の中でも“その人”に見えるよう、スキンヘッド・サングラス・髭は頭だけ描画でも再現する。
    // ここを省くと強面の客が湯に浸かった瞬間、髪が生えた別人の顔になる
    const wBald = hasFace(e) && e.type.bald;
    const wShades = hasFace(e) && e.type.shades;
    const wBeard = hasFace(e) && e.type.beard;
    if (e.kind === 'cust' && e.type.sex === 'f') {   // 女性は湯面に髪が広がる
      ctx.fillStyle = hair;
      ctx.beginPath(); ctx.roundRect(x - 6, y - 1, 12, 6, 3); ctx.fill();
    }
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(x, y + 2, 5.5, 0, Math.PI * 2); ctx.fill();
    if (wBald) {                                     // 剃り上げ：髪の代わりに陰だけ
      ctx.fillStyle = 'rgba(0,0,0,.10)'; ctx.beginPath(); ctx.arc(x, y + 0.8, 5.5, Math.PI, 0); ctx.fill();
    } else {
      ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(x, y, 5.5, Math.PI, 0); ctx.fill();
    }
    if (wBeard) { ctx.fillStyle = wBeard; ctx.fillRect(x - 3.4, y + 4.6, 6.8, 2.2); }
    if (wShades) {
      ctx.fillStyle = '#141414';
      ctx.beginPath(); ctx.roundRect(x - 4, y + 1.2, 3.4, 2.6, 1); ctx.fill();
      ctx.beginPath(); ctx.roundRect(x + 0.6, y + 1.2, 3.4, 2.6, 1); ctx.fill();
      ctx.fillRect(x - 0.7, y + 2, 1.4, 0.7);
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ctx.fillRect(x - 3.4, y + 1.6, 1.3, 0.8); ctx.fillRect(x + 1.2, y + 1.6, 1.3, 0.8);
    } else {
      ctx.fillStyle = '#333'; ctx.fillRect(x - 3, y + 2, 1.6, 1.6); ctx.fillRect(x + 1.6, y + 2, 1.6, 1.6);
    }
    if (e.use.cat === 'furo') {
      ctx.fillStyle = '#fff'; ctx.font = '8px sans-serif'; ctx.textAlign = 'center';
      if (Math.sin(rt * 2 + e.wob) > 0.4) ctx.fillText('～', x + 9, y);
    }
    return;
  }
  // サウナでは持ってきたマットを敷いて、その上に座る（体より先に描く＝下敷きになる）
  if (e.kind === 'cust' && e.carry === 'mat' && e.state === 'using' && e.use.cat === 'sauna') {
    ctx.fillStyle = '#4a8ac9'; ctx.fillRect(x - 8, y + 2, 16, 6);
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x - 8, y + 2, 16, 1.5);
  }
  const isFemale = hasFace(e) && e.type.sex === 'f';
  if (isFemale) {                                    // ロングヘアの背面（体より先に描いて肩の後ろに垂らす）
    ctx.fillStyle = hair;
    ctx.beginPath(); ctx.roundRect(x - 6.2, y - 11, 12.4, 15, 4); ctx.fill();
  }
  // 体
  let cloth = e.kind === 'player' ? '#3a6ea5' : e.isWife ? '#5a6b8a' : e.kind === 'staff' ? '#3a8a5a' : e.type.cloth;
  // 着替えたあと：男は腰にタオルを巻いて前を隠す、女は体にタオルを巻く
  /* 浴室を出れば館内着（第2章）。裸で大広間や食堂を歩かせない */
  const house = inHouseWear(e);
  const bare = e.kind === 'cust' && e.mode === 'towel' && !house && e.type.sex === 'm';
  if (house) cloth = '#6d8398';                                          // 館内着（藍の作務衣）
  else if (e.kind === 'cust' && e.mode === 'towel') cloth = bare ? skin : '#f5f0e8';
  ctx.fillStyle = cloth;
  ctx.beginPath(); ctx.roundRect(x - 5.5, y - 4, 11, 12, 3); ctx.fill();
  // ドレス（玲奈）＝腰から下が広がるシルエット。上半身の四角い体に台形の裾を足すだけ
  if (e.kind === 'npc' && e.look && e.look.dress) {
    ctx.fillStyle = cloth;
    ctx.beginPath(); ctx.moveTo(x - 5.5, y + 1); ctx.lineTo(x + 5.5, y + 1);
    ctx.lineTo(x + 7.5, y + 9.5); ctx.lineTo(x - 7.5, y + 9.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(x - 5.5, y + 1, 11, 1);   // 切り替えの照り
  }
  if (bare) {
    ctx.fillStyle = '#f5f0e8'; ctx.fillRect(x - 5.5, y + 1.5, 11, 6.5);   // 腰に巻いたタオル
    ctx.fillStyle = '#e2dccc'; ctx.fillRect(x - 5.5, y + 1.5, 11, 1);
    ctx.fillStyle = '#e8ded0'; ctx.fillRect(x + 0.5, y + 1.5, 1.2, 6.5);  // 合わせ目
  } else if (house) {
    /* 館内着の襟。合わせを描くだけで「巻いたタオル」と見分けが付く */
    ctx.fillStyle = '#8ea4b6';
    ctx.beginPath();
    ctx.moveTo(x - 4.5, y - 4); ctx.lineTo(x, y + 0.5); ctx.lineTo(x + 4.5, y - 4);
    ctx.lineTo(x + 2.6, y - 4); ctx.lineTo(x, y - 1.4); ctx.lineTo(x - 2.6, y - 4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#56697b'; ctx.fillRect(x - 5.5, y + 2.6, 11, 1.6);   // 帯
  } else if (e.kind === 'cust' && e.mode === 'towel') {
    ctx.fillStyle = '#e2dccc'; ctx.fillRect(x - 5.5, y - 2.5, 11, 1);     // 巻きタオルの上端
    ctx.fillStyle = '#e8ded0'; ctx.fillRect(x + 1.5, y - 2, 1.2, 9.5);
  }
  if (bare && e.type.tattoo) {                        // 胸割りの和彫り（両胸に藍＋緋色＋白抜きの波）
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x - 5.5, y - 4, 11, 5.4, 3); ctx.clip();
    ctx.fillStyle = 'rgba(38,68,132,.86)';
    ctx.fillRect(x - 5.5, y - 2.9, 4.7, 4.3);         // 左胸の藍
    ctx.fillRect(x + 0.8, y - 2.9, 4.7, 4.3);         // 右胸の藍（中央に地肌のスジ＝胸割り）
    ctx.fillStyle = 'rgba(180,44,54,.82)';            // 緋色の牡丹
    ctx.beginPath(); ctx.arc(x - 2.8, y - 0.5, 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 3.1, y - 0.8, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(220,228,248,.55)';          // 白抜きの波
    ctx.fillRect(x - 5, y - 2.4, 3.4, 0.7); ctx.fillRect(x + 1.4, y - 2.4, 3, 0.7);
    ctx.fillStyle = 'rgba(255,224,110,.6)';           // 金の差し
    ctx.beginPath(); ctx.arc(x - 2.8, y - 0.5, 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // 頭
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(x, y - 8, 6, 0, Math.PI * 2); ctx.fill();
  const bald = hasFace(e) && e.type.bald;
  if (bald) {                                        // スキンヘッド：髪キャップ無し、剃り上げの陰だけ
    ctx.fillStyle = 'rgba(0,0,0,.10)'; ctx.beginPath(); ctx.arc(x, y - 9.3, 6, Math.PI, 0); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(x - 6, y - 9, 1.5, 3.2); ctx.fillRect(x + 4.5, y - 9, 1.5, 3.2);
  } else {
    ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(x, y - 9.5, 6, Math.PI, 0); ctx.fill();
  }
  if (isFemale) {                                    // 顔の両脇に垂らす前側の毛束
    ctx.fillStyle = hair;
    ctx.beginPath(); ctx.roundRect(x - 6.4, y - 10, 2.7, 9, 1.3); ctx.fill();
    ctx.beginPath(); ctx.roundRect(x + 3.7, y - 10, 2.7, 9, 1.3); ctx.fill();
  }
  if (e.kind === 'player') { ctx.fillStyle = '#fff'; ctx.fillRect(x - 6, y - 13, 12, 3.5); } // 頭のタオル
  /* 審査員（第2章・最終戦）：部門色の帽子＋白い腕章＋クリップボード。
     e.judgeCap を持つ客だけ＝第1章は誰にも付かないので描画は変わらない。
     浴室では脱ぐ（mode が towel の間は素の客と同じ）＝審査員も同じ湯に浸かる建付け */
  if (e.judgeCap && e.mode === 'clothed') {
    ctx.fillStyle = e.judgeCap;
    ctx.beginPath(); ctx.arc(x, y - 9.8, 6.2, Math.PI, 0); ctx.fill();     // 帽子の山
    ctx.fillRect(x - 6.2, y - 10.2, 12.4, 2.2);                            // 帽子の縁
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x - 6.2, y - 8.4, 12.4, 0.8);
    ctx.fillStyle = '#f5f2ea'; ctx.fillRect(x - 7.4, y - 2.5, 3.2, 4.5);   // 白い腕章
    ctx.fillStyle = '#c34a3a'; ctx.fillRect(x - 6.8, y - 1.4, 2, 2.2);
    ctx.fillStyle = '#e8e2d2'; ctx.fillRect(x + 5.4, y - 1, 4.5, 6.5);     // クリップボード
    ctx.fillStyle = '#8a8272'; ctx.fillRect(x + 6.2, y - 1.6, 3, 1.4);
    ctx.fillStyle = '#a89e8a'; ctx.fillRect(x + 6.2, y + 1, 3, 0.7); ctx.fillRect(x + 6.2, y + 2.8, 3, 0.7);
  }
  if (e.kind === 'staff') { ctx.fillStyle = '#2f7a4a'; ctx.fillRect(x - 6, y - 13, 12, 3.5); } // 三角巾
  // ととのった客は休憩中に目がキラリと光る
  const totonoiEyes = e.kind === 'cust' && e.gotTotonoi && e.state === 'using' && e.use && e.use.cat === 'rest';
  const shades = hasFace(e) && e.type.shades;
  if (shades) {                                      // サングラス
    ctx.fillStyle = '#20161a';                       // への字の怒り眉（内側が下がる）
    ctx.save(); ctx.translate(x - 2.7, y - 10.3); ctx.rotate(0.36); ctx.fillRect(-2, -0.85, 4, 1.7); ctx.restore();
    ctx.save(); ctx.translate(x + 2.7, y - 10.3); ctx.rotate(-0.36); ctx.fillRect(-2, -0.85, 4, 1.7); ctx.restore();
    ctx.fillStyle = '#141414';
    ctx.beginPath(); ctx.roundRect(x - 4.3, y - 9, 3.6, 2.8, 1); ctx.fill();        // 左レンズ
    ctx.beginPath(); ctx.roundRect(x + 0.7, y - 9, 3.6, 2.8, 1); ctx.fill();        // 右レンズ
    ctx.fillRect(x - 0.7, y - 8.2, 1.4, 0.7);                                       // 細いブリッジ
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.fillRect(x - 3.7, y - 8.6, 1.4, 0.8); ctx.fillRect(x + 1.3, y - 8.6, 1.4, 0.8); // 各レンズの反射
  } else {
    ctx.fillStyle = '#333'; ctx.fillRect(x - 3, y - 8, 1.7, 1.7); ctx.fillRect(x + 1.5, y - 8, 1.7, 1.7);
  }
  if (totonoiEyes) {
    const tw = 0.55 + Math.abs(Math.sin(rt * 2.2 + e.wob)) * 0.45;   // ゆっくり瞬く
    for (const ex of [x - 2.5, x + 2.5]) {                          // サングラス客はレンズ越しにキラリと反射
      const cy = shades ? y - 7.6 : y - 7.2, ry = 3.4 * tw, rx = 2.2 * tw;
      ctx.fillStyle = '#fff8c0';
      ctx.beginPath();                                              // 目の上に収まる四芒星
      ctx.moveTo(ex, cy - ry); ctx.lineTo(ex + rx, cy);
      ctx.lineTo(ex, cy + ry);  ctx.lineTo(ex - rx, cy);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(ex - 0.55, cy - 0.55, 1.1, 1.1);
    }
    ctx.fillStyle = 'rgba(255,246,180,.9)';                          // 頭上のきらめき（強面でも出る）
    for (let i = 0; i < 2; i++) {
      const a = rt * 1.4 + i * Math.PI;
      ctx.beginPath(); ctx.arc(x + Math.sin(a) * 9, y - 17 + Math.cos(a) * 2.5, 1.3, 0, Math.PI * 2); ctx.fill();
    }
  }
  // マッサージチェアに座っている客＝体が揺れ、目を閉じて、頭の上に癒しの湯気マークが立つ
  if (e.kind === 'cust' && e.state === 'using' && e.use && e.use.item && isMassage(e.use.item.id)) {
    ctx.fillStyle = '#2a2320';                                       // 閉じた目（への字ではなく水平線＝脱力）
    ctx.fillRect(x - 4, y - 7.4, 3, 1); ctx.fillRect(x + 1, y - 7.4, 3, 1);
    ctx.fillStyle = 'rgba(255,255,255,.75)';                         // 頭上に立ちのぼる癒しの湯気
    for (let i = 0; i < 3; i++) {
      const ph = (rt * 0.9 + i / 3) % 1;
      ctx.globalAlpha = 0.7 * (1 - ph);
      ctx.fillRect(x - 3 + Math.sin(rt * 3 + i * 2) * 2 + i * 3, y - 15 - ph * 9, 1.6, 3);
    }
    ctx.globalAlpha = 1;
  }
  // 番台に突っ伏して寝ている主人公＝目を閉じ、頭が台に着いている（💤 は drawSleep が出す）
  if (asleep) {
    ctx.fillStyle = '#2a2320';
    ctx.fillRect(x - 4, y - 8.2, 3, 1); ctx.fillRect(x + 1, y - 8.2, 3, 1);
  }
  // ── 重要人物の“それらしさ”（髭・眼鏡・ヘルメット・ネクタイ＋頭上の名札で誰なのか分かる）
  if (e.kind === 'npc') {
    const L = e.look;
    if (L.helmet) {
      ctx.fillStyle = L.helmet; ctx.beginPath(); ctx.arc(x, y - 9.5, 6.6, Math.PI, 0); ctx.fill();
      ctx.fillRect(x - 6.6, y - 9.8, 13.2, 1.8);
    }
    if (L.part) { ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(x - 1.6, y - 14.5, 1.2, 4.5); }   // 七三分け
    if (L.brow) { ctx.fillStyle = '#d8d8d8'; ctx.fillRect(x - 4.2, y - 10.4, 3.2, 1.3); ctx.fillRect(x + 1, y - 10.4, 3.2, 1.3); }  // 太い白眉
    if (L.beard) { ctx.fillStyle = L.beard; ctx.fillRect(x - 3.4, y - 4.8, 6.8, 2.8); }                    // 顎髭
    if (L.glasses) {
      ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1;
      ctx.strokeRect(x - 4.4, y - 9.4, 3.8, 3.2); ctx.strokeRect(x + 0.6, y - 9.4, 3.8, 3.2);
      ctx.beginPath(); ctx.moveTo(x - 0.6, y - 7.8); ctx.lineTo(x + 0.6, y - 7.8); ctx.stroke();
    }
    if (L.lips) { ctx.fillStyle = '#c94a5a'; ctx.fillRect(x - 1.2, y - 5.2, 2.4, 1.2); }
    if (L.tie) { ctx.fillStyle = '#e8e2d6'; ctx.fillRect(x - 2, y - 4, 4, 8); ctx.fillStyle = L.tie; ctx.fillRect(x - 0.8, y - 3.6, 1.6, 6); }
    if (L.bag) { ctx.fillStyle = '#3a2a1c'; ctx.fillRect(x + 5, y + 0.5, 5, 6); ctx.fillStyle = '#6a5340'; ctx.fillRect(x + 5, y + 0.5, 5, 1.2); }
    if (e.role === 'visit') {                       // 頭上の名札＝誰が来たのか一目で分かる
      ctx.font = 'bold 8px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
      const nw = ctx.measureText(L.name).width + 8;
      ctx.fillStyle = 'rgba(20,14,10,.88)'; ctx.strokeStyle = '#ffd98a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(x - nw / 2, y - 27, nw, 11, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd98a'; ctx.fillText(L.name, x, y - 19);
    }
    // 道具（修理業者のトンカチ／若い衆のバット）
    if (e.state === 'work') drawSwing(x, y, rt, 'hammer');
    else if (e.state === 'smash') drawSwing(x, y, rt, 'bat');
    else if (e.role === 'thug') drawSwing(x, y, rt, 'batIdle');
    else if (e.role === 'fixer') drawSwing(x, y, rt, 'hammerIdle');
  }
  // 手に持っているアメニティ（サウナで敷いている間は手から離れている）
  if (e.kind === 'cust' && e.carry && !(e.carry === 'mat' && e.state === 'using' && e.use.cat === 'sauna')) {
    ctx.fillStyle = e.carry === 'mat' ? '#4a8ac9' : '#d9534f';
    ctx.fillRect(x + 5, y - 3, 6, 8);
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x + 5, y - 3, 6, 1.5);
    ctx.fillStyle = skin; ctx.fillRect(x + 4, y - 1, 2.5, 3);          // 握っている手
  }
  // カランでシャンプー：頭を洗って泡が立つ
  if (e.kind === 'cust' && e.state === 'using' && e.use.cat === 'wash' && e.use.item.id === 'wash_shower') {
    // 立ちシャワーは座らない＝泡を立てず、頭から湯を浴びて立っているだけ
    ctx.strokeStyle = 'rgba(200,232,245,.8)'; ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const sx = x - 4.5 + i * 3, t = (rt * 30 + i * 6 + e.wob * 3) % 16;
      ctx.beginPath(); ctx.moveTo(sx, y - 20 + t); ctx.lineTo(sx, y - 16 + t); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.7)';                              // 肩で跳ねる湯
    for (let i = 0; i < 3; i++) {
      const ph = (rt * 2.2 + i * .34 + e.wob) % 1;
      ctx.beginPath(); ctx.arc(x + (i - 1) * 6, y - 9 - ph * 3, 1.5 * (1 - ph) + .5, 0, Math.PI * 2); ctx.fill();
    }
  } else if (e.kind === 'cust' && e.state === 'using' && e.use.cat === 'wash') {
    const scrub = Math.sin(rt * 7 + e.wob);
    ctx.fillStyle = '#fff';                                            // 頭の泡
    ctx.beginPath();
    ctx.arc(x - 3, y - 13 + scrub * 0.6, 3.4, 0, Math.PI * 2);
    ctx.arc(x + 3, y - 13.5 - scrub * 0.6, 3.8, 0, Math.PI * 2);
    ctx.arc(x, y - 15, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin;                                              // 泡を立てる両手
    ctx.fillRect(x - 7 + scrub, y - 12, 3, 3.5);
    ctx.fillRect(x + 4 - scrub, y - 12, 3, 3.5);
    ctx.fillStyle = 'rgba(255,255,255,.85)';                           // 飛び散る泡
    for (let i = 0; i < 3; i++) {
      const ph = (rt * 1.6 + i * .33 + e.wob) % 1;
      ctx.beginPath(); ctx.arc(x + (i - 1) * 7, y - 16 - ph * 8, 1.8 * (1 - ph) + .6, 0, Math.PI * 2); ctx.fill();
    }
  }
  // 冷水機で水を飲む／扇風機で涼む／洗面所で髪を乾かす
  if (e.kind === 'cust' && e.state === 'usingPas' && e.pas) drawPasUse(e, x, y, rt, skin, hair);
  // サウナで汗
  if (e.kind === 'cust' && e.state === 'using' && e.use.cat === 'sauna') {
    ctx.fillStyle = '#9fd8ff';
    ctx.beginPath(); ctx.arc(x + 6, y - 10 + (rt * 8 % 6), 1.5, 0, Math.PI * 2); ctx.fill();
  }
  /* 厨房で火を入れているバイト＝鍋をかき混ぜる手と、立ちのぼる湯気（第2章の食堂）。
     第1章のバイトは cook という仕事を持たないので、ここは通らない */
  if (e.kind === 'staff' && e.task === 'cook' && !e.moving) {
    const stir = Math.sin(rt * 6 + e.wob);
    ctx.fillStyle = '#8d9599';                                             // 鍋
    ctx.beginPath(); ctx.ellipse(x + 1, y + 1, 6, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c8b48a';                                             // 中身
    ctx.beginPath(); ctx.ellipse(x + 1, y + 0.6, 4.4, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a9855a'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    ctx.beginPath();                                                       // お玉
    ctx.moveTo(x + 1 + stir * 2.5, y + 0.5); ctx.lineTo(x + 6 + stir, y - 6); ctx.stroke();
    ctx.fillStyle = skin; ctx.fillRect(x + 5 + stir, y - 7.5, 2.4, 2.6);   // 握る手
    ctx.fillStyle = 'rgba(255,255,255,.72)';                               // 湯気
    for (let i = 0; i < 3; i++) {
      const ph = (rt * 1.1 + i / 3 + e.wob) % 1;
      ctx.globalAlpha = 0.7 * (1 - ph);
      ctx.fillRect(x - 2 + Math.sin(rt * 3 + i * 2) * 2 + i * 3, y - 3 - ph * 10, 1.6, 3);
    }
    ctx.globalAlpha = 1;
  }
  /* 皿を運んでいるバイト＝盆の上に丼をひとつ載せて、席まで歩く */
  if (e.kind === 'staff' && e.tray) {
    ctx.fillStyle = '#6b4a2a'; ctx.fillRect(x + 4, y - 4, 9, 5.5);         // 盆
    ctx.fillStyle = '#8a6640'; ctx.fillRect(x + 4, y - 4, 9, 1.2);
    ctx.fillStyle = '#d8cdb8';                                             // 丼
    ctx.beginPath();
    ctx.moveTo(x + 6, y - 5.4); ctx.lineTo(x + 11, y - 5.4);
    ctx.lineTo(x + 10.2, y - 2.6); ctx.lineTo(x + 6.8, y - 2.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.6)';                                // 湯気
    const ph2 = (rt * 1.4 + e.wob) % 1;
    ctx.globalAlpha = 0.6 * (1 - ph2);
    ctx.fillRect(x + 8, y - 7 - ph2 * 6, 1.4, 2.6);
    ctx.globalAlpha = 1;
    ctx.fillStyle = skin; ctx.fillRect(x + 3.2, y - 2.4, 2.4, 3);          // 支える手
  }
  // 掃除中：モップを左右に動かす（何をしているか一目でわかるように）
  if ((e.kind === 'player' || e.kind === 'staff') && e.task === 'clean' && !e.moving) {
    const sw = Math.sin(rt * 5);                 // 前後にこする動き
    ctx.save();
    ctx.translate(x + 5, y - 4);
    ctx.rotate(0.55 + sw * 0.28);
    ctx.strokeStyle = '#c8a06a'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 13); ctx.stroke();      // 柄
    ctx.fillStyle = '#5a6a7a'; ctx.fillRect(-4.5, 12, 9, 2.5);               // 金具
    ctx.fillStyle = '#e8e2d2';                                               // モップの糸
    for (let i = 0; i < 5; i++) ctx.fillRect(-4 + i * 2, 14, 1.4, 4 + (i % 2) * 1.5);
    ctx.restore();
    // water splash / 泡
    ctx.fillStyle = 'rgba(190,225,240,.75)';
    for (let i = 0; i < 3; i++) {
      const a = rt * 3 + i * 2.1;
      ctx.beginPath(); ctx.arc(x + 9 + Math.sin(a) * 4, y + 8 - (a % 1) * 5, 1.4, 0, Math.PI * 2); ctx.fill();
    }
  }
  /* 芝居は、姿勢の変形の中で描く＝座れば道具も一緒に下がる。
     立ったまま使う設備（喫煙所・充電ステーション）は変形が無いので、そのまま描く */
  if (pose) drawPoseExtra(pose, e, x, y, rt, skin);
  if (poseT) ctx.restore();
  if (post) ctx.restore();
}

/* 「置くだけの設備」を使っている絵。何をしているのか一目で分かるように、
   道具（紙コップ・ドライヤー）と風・水を、設備の側から客へ向けて描く */
function drawPasUse(e, x, y, rt, skin, hair) {
  const it = e.pas.item;
  const cx = it.x * T + ew(it) * T / 2;                 // 設備の中心
  const d = cx < e.px ? -1 : 1;                         // 設備は左か右か（道具はそちら側の手に持つ）
  if (e.pas.kind === 'drink') {
    /* 冷水機の上から弧を描いて出る水に、直接口をつけて飲む（作者指定＝紙コップは使わない）。
       水は機械の天板の吹き出し口から出て、身を乗り出した客の口もとへ落ちる */
    /* 水の弧そのものは冷水機の絵（drawEquip）が出す＝客の体の後ろを通り、
       身を乗り出した口もとで隠れる。ここでは客の側の芝居だけを描く */
    const beat = (rt * 3.4 + e.wob) % 1;                // ごくり1回ぶんの拍
    // 喉の動き（首もとの小さな影が、ごくりのたびに上下する）
    ctx.fillStyle = 'rgba(180,120,80,.55)';
    ctx.beginPath(); ctx.arc(x - d * 0.5, y - 2.8 - beat * 1.8, 1.4, 0, Math.PI * 2); ctx.fill();
    // 「ゴク」が頭の斜め上でぽんぽん跳ねる（白フチ付きで背景に負けない）
    ctx.font = 'bold 8px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.globalAlpha = 0.55 + (1 - beat) * 0.45;
    ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(255,255,255,.95)';
    ctx.strokeText('ゴク', x - d * 9, y - 15 - beat * 3);
    ctx.fillStyle = '#2f8fc4';
    ctx.fillText('ゴク', x - d * 9, y - 15 - beat * 3);
    ctx.globalAlpha = 1;
    // 水を受けに伸ばした両手（機械の側に差し出す）
    ctx.fillStyle = skin;
    ctx.fillRect(x - d * 5 - 1.2, y - 4.2, 2.4, 3.2);
    ctx.fillRect(x - d * 2.5 - 1.2, y - 3.6, 2.4, 3.0);
  } else if (e.pas.kind === 'toilet') {
    /* トイレ（作者指定）。洋式は便座に腰かけて膝を抱える、ボットンは深くしゃがむ。
       どちらも頭の上で「…」が明滅して、力んでいるのが分かる */
    const boton = it.id === 'toilet_old';
    ctx.strokeStyle = skin; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    if (boton) {                                        // しゃがむ＝膝が両脇に張り出す
      ctx.beginPath(); ctx.moveTo(x - 3, y + 1); ctx.lineTo(x - 6, y + 4); ctx.lineTo(x - 3, y + 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 3, y + 1); ctx.lineTo(x + 6, y + 4); ctx.lineTo(x + 3, y + 7); ctx.stroke();
    } else {                                            // 腰かける＝膝が手前にそろって出る
      ctx.beginPath(); ctx.moveTo(x - 3, y + 2); ctx.lineTo(x - 4, y + 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 3, y + 2); ctx.lineTo(x + 4, y + 7); ctx.stroke();
      ctx.strokeStyle = skin; ctx.lineWidth = 1.8;      // 膝の上に置いた両ひじ
      ctx.beginPath(); ctx.moveTo(x - 4, y - 3); ctx.lineTo(x - 5, y + 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 4, y - 3); ctx.lineTo(x + 5, y + 2); ctx.stroke();
    }
    const bl = Math.abs(Math.sin(rt * 1.8 + e.wob));
    ctx.globalAlpha = 0.35 + bl * 0.6;
    ctx.font = 'bold 9px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(255,255,255,.95)';
    ctx.strokeText('…', x + 7, y - 13);
    ctx.fillStyle = boton ? '#7a6a4a' : '#6a8fb8';
    ctx.fillText('…', x + 7, y - 13);
    ctx.globalAlpha = 1;
  } else if (e.pas.kind === 'fan') {
    // 扇風機の風。設備の側から3本の風が流れてきて、髪と巻きタオルの裾がなびく
    ctx.strokeStyle = 'rgba(214,242,250,.95)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const ph = (rt * 1.6 + i * .34) % 1;
      const wx = x + d * (18 - ph * 13), wy = y - 10 + i * 5.5;
      ctx.globalAlpha = 0.4 + (1 - ph) * 0.55;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.quadraticCurveTo(wx + d * 4, wy - 2, wx + d * 9, wy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const fl = Math.sin(rt * 6 + e.wob) * 1.6;          // なびく髪
    ctx.fillStyle = hair;
    ctx.beginPath(); ctx.moveTo(x - d * 4, y - 12); ctx.lineTo(x - d * (8 + fl), y - 13.5); ctx.lineTo(x - d * 4, y - 9);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f5f0e8';                          // 腰タオルの裾もめくれる
    ctx.beginPath(); ctx.moveTo(x - d * 5, y + 3); ctx.lineTo(x - d * (8 + fl), y + 6.5); ctx.lineTo(x - d * 5, y + 8);
    ctx.closePath(); ctx.fill();
  } else if (e.pas.kind === 'ehon') {
    // 棚の前に座り込んで絵本を広げている（作者指定）。ページが時々めくれる
    const flip = Math.sin(rt * 1.6 + e.wob) > 0.85;
    ctx.fillStyle = '#f4ecd8';                                  // 開いた本
    ctx.fillRect(x - 6, y - 6, 12, 7);
    ctx.fillStyle = '#c9a86a'; ctx.fillRect(x - 6, y - 6, 12, 1.2);
    ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 1); ctx.stroke();
    if (flip) { ctx.fillStyle = '#fffaf0'; ctx.fillRect(x, y - 6, 5, 7); }   // めくった1ページ
    ctx.strokeStyle = skin; ctx.lineWidth = 2;                  // 本を持つ両手
    ctx.beginPath(); ctx.moveTo(x - 3, y - 5); ctx.lineTo(x - 6, y - 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 3, y - 5); ctx.lineTo(x + 6, y - 2); ctx.stroke();
  } else if (e.pas.kind === 'gacha') {
    // つまみを回す腕＝設備側の手を、くるくると回す。頭の上に「カチッ」
    const a = rt * 6 + e.wob;
    ctx.strokeStyle = skin; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + d * 2, y - 6);
    ctx.lineTo(x + d * 5 + Math.cos(a) * 2.5, y - 4 + Math.sin(a) * 2.5); ctx.stroke();
    if (Math.sin(rt * 3 + e.wob) > 0.6) {
      ctx.font = 'bold 8px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(255,255,255,.95)';
      ctx.strokeText('カチッ', x - d * 9, y - 16); ctx.fillStyle = '#c9622a';
      ctx.fillText('カチッ', x - d * 9, y - 16);
    }
    // ころんと落ちてくるカプセル（回すたびに色が変わる）
    const drop = (rt * 0.5 + e.wob) % 1;
    if (drop > 0.6) {
      const dp = (drop - 0.6) / 0.4;
      ctx.fillStyle = ['#e05a5a', '#e8c34a', '#4aa3e0', '#6ac96a'][Math.floor(rt * 0.5 + e.wob) % 4];
      ctx.beginPath(); ctx.arc(x + d * 6, y - 4 + dp * 8, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.beginPath(); ctx.arc(x + d * 5.2, y - 5 + dp * 8, 0.9, 0, Math.PI * 2); ctx.fill();
    }
  } else if (e.pas.kind === 'scale') {
    // 体重計の上で足元の目盛りをのぞき込み、針の振れに一喜一憂する
    const react = Math.abs(Math.sin(rt * 4.5 + e.wob));
    // うつむいた視線（頭から足元へ短い線を2本）
    ctx.strokeStyle = 'rgba(60,60,70,.30)'; ctx.lineWidth = 0.8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 1.5, y - 7); ctx.lineTo(x - 2.5, y + 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 1.5, y - 7); ctx.lineTo(x + 0.7, y + 7); ctx.stroke();
    // 頭上に「！」がひょこっと跳ねる（増えた／減ったの一喜一憂）
    if (react > 0.55) {
      const my = y - 14 - react * 2;
      ctx.fillStyle = '#e2a33a';
      ctx.fillRect(x + d * 5 - 0.8, my, 1.6, 3.2);        // 棒
      ctx.fillRect(x + d * 5 - 0.8, my + 4, 1.6, 1.6);    // 点
    }
  } else {
    // 洗面所でドライヤー。ノズルを頭に向けて、温風で毛先が跳ねる
    const sh = Math.sin(rt * 9 + e.wob) * 1.2;          // 手元の細かい揺れ
    ctx.fillStyle = hair;                               // 乾かされて逆立つ毛先
    for (let i = 0; i < 4; i++) {
      const hx = x - 4.6 + i * 3, sway = Math.sin(rt * 7 + i * 1.3 + e.wob) * 1.3;
      ctx.beginPath();
      ctx.moveTo(hx, y - 12.6); ctx.lineTo(hx + 1.8, y - 12.6);
      ctx.lineTo(hx + 0.9 - d * 2 + sway, y - 16.8);
      ctx.closePath(); ctx.fill();
    }
    ctx.save();
    ctx.translate(x + d * 8, y - 10 + sh);
    ctx.scale(d, 1);                                    // 吹き出し口が必ず頭のほうを向くように反転
    ctx.rotate(0.5);
    ctx.fillStyle = '#f4efe6'; ctx.fillRect(-3.5, -2.5, 7, 5);          // 本体
    ctx.fillStyle = '#b3402e'; ctx.fillRect(-3.5, -0.6, 7, 1.4);        // 赤いライン
    ctx.fillStyle = '#f4efe6'; ctx.fillRect(0.5, 2.5, 3, 4);            // 握り
    ctx.fillStyle = '#6b6b66'; ctx.fillRect(-5.5, -2, 2, 4);            // 吹き出し口
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,220,170,.85)'; ctx.lineWidth = 1;       // 温風
    for (let i = 0; i < 3; i++) {
      const ph = (rt * 2.4 + i * .33) % 1;
      const wx = x + d * (7 - ph * 4), wy = y - 13 + i * 2.6 + sh;
      ctx.globalAlpha = 0.3 + (1 - ph) * 0.6;
      ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx - d * 3.2, wy - 0.8); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

/* 道具を振る（修理業者のトンカチ／若い衆のバット）。振り下ろした瞬間に打点が出る */
function drawSwing(x, y, rt, kind) {
  const swinging = kind === 'hammer' || kind === 'bat';
  const sw = swinging ? Math.sin(rt * (kind === 'bat' ? 7 : 9)) : 0;
  const ang = swinging ? (-1.0 + sw * 1.0) : -0.3;
  ctx.save();
  ctx.translate(x + 6, y - 4); ctx.rotate(ang);
  if (kind === 'bat' || kind === 'batIdle') {          // 金属バット
    ctx.fillStyle = '#b9bcc4'; ctx.fillRect(-2, -22, 4, 11);
    ctx.fillStyle = '#8e939c'; ctx.fillRect(-1.4, -12, 2.8, 10);
    ctx.fillStyle = '#3a2a1c'; ctx.fillRect(-1.6, -3, 3.2, 4);
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(-1.6, -21, 1, 9);
  } else {                                             // トンカチ
    ctx.strokeStyle = '#8a5a2f'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -11); ctx.stroke();
    ctx.fillStyle = '#6a6a72'; ctx.fillRect(-4, -15, 8, 5);
    ctx.fillStyle = '#8a8a92'; ctx.fillRect(-4, -15, 8, 2);
  }
  ctx.restore();
  if (swinging && sw > 0.82) {
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = kind === 'bat' ? '#ff7a4a' : '#ffe86a';
    ctx.fillText(kind === 'bat' ? '💥' : '✳', x + 14, y - 12);
  }
}

function drawBubble(e) {
  const text = e.bub.text;
  const hint = !!e.bub.hint;                       // 運営メニューで直せる不満＝赤枠で目立たせる
  const stuck = !!e.bub.stuck;                     // 通路が塞がって歩いて行けない＝配置を直すしかない問題
  /* 吹き出しの大きさ。**章が盤面を広げると、画面の中の字はその分だけ小さくなる。**
     キャンバスは横幅いっぱいに縮めて表示するので、
     第2章を 16×10 から 20×14 にした日から縮尺が 0.78 → 0.625 に下がり、
     9px の字が実寸 7.0px → 5.6px になって読めなくなっていた（作者報告 8/8）。
     `bubScale` を持つ章だけ、縮んだぶんを掛け戻す。
     持たない章（第1章）は 1 ＝これまでと1pxも変わらない                    */
  const s = CONF.bubScale || 1;
  ctx.font = (hint ? 'bold ' : '') + (9 * s) + 'px "DotGothic16",sans-serif';
  const w = ctx.measureText(text).width + (hint ? 16 : 10) * s;
  let bx = clamp(e.px - w / 2, 2, CONF.W * T - w - 2);
  /* **吹き出しは頭の上に伸びるので、最上段の客ぶんが画面の外へ出る。**
     s を上げるほど伸びる（第2章は 34×1.6＝54px ＝ 上端 y=1 の客で −6px）。
     `bubScale` を持つ章だけ上端で止める。持たない章（第1章）は素通り＝これまでどおり */
  let by = e.py - 34 * s;
  if (CONF.bubScale) by = Math.max(2, by);
  const bh = 15 * s;
  ctx.fillStyle = stuck ? 'rgba(255,228,224,.98)' : hint ? 'rgba(255,240,238,.97)' : 'rgba(255,255,255,.94)';
  ctx.strokeStyle = hint ? '#e03a3a' : '#5a4436'; ctx.lineWidth = hint ? (stuck ? 2.2 : 1.6) : 1;
  ctx.beginPath(); ctx.roundRect(bx, by, w, bh, 4 * s); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(e.px - 3 * s, by + bh); ctx.lineTo(e.px + 3 * s, by + bh); ctx.lineTo(e.px, by + 20 * s); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.textAlign = 'left';
  if (hint) {
    ctx.fillStyle = '#e03a3a'; ctx.fillText(stuck ? '⚠' : '！', bx + 4 * s, by + 11 * s);
    ctx.fillStyle = stuck ? '#c00000' : '#8a1a1a'; ctx.fillText(text, bx + 12 * s, by + 11 * s);
  } else {
    ctx.fillStyle = '#222'; ctx.fillText(text, bx + 5 * s, by + 11 * s);
  }
}

function drawEffects() {
  ctx.textAlign = 'center';
  chHook('drawPass', ctx);        // 第2章：厨房のカウンターに並んだ皿
  /* **いま見ている区画で起きたものだけ描く。** 区画が1つの章は f が常に 0 ＝素通り */
  const vf = G.viewF | 0;
  for (const f of floaters) {
    if ((f.f | 0) !== vf) continue;
    ctx.globalAlpha = clamp(f.t, 0, 1);
    // 金額の飛び出しも、吹き出しと同じ理由で縮んでいた（bubScale を参照）
    ctx.fillStyle = '#ffd98a'; ctx.font = 'bold ' + (10 * (CONF.bubScale || 1)) + 'px "DotGothic16",sans-serif';
    ctx.fillText(f.text, f.x, f.y - (1.6 - f.t) * 18);
  }
  for (const s of sparkles) {
    if ((s.f | 0) !== vf) continue;
    ctx.globalAlpha = clamp(s.t, 0, 1);
    ctx.fillStyle = '#ffe86a'; ctx.font = '10px sans-serif';
    ctx.fillText('✦', s.x, s.y - (1 - s.t) * 10);
  }
  ctx.globalAlpha = 1;
  /* **いちばん上に載せるもの**（第2章＝タップした客の札）。
     吹き出しも floaters も、この下をくぐる＝
     プレイヤーが自分で開いたものが、勝手に出るものに隠されない */
  chHook('drawTop', ctx);
  ctx.textAlign = 'center';
}

/* 置ける／置けないマスの一覧（原点マス基準）。回転や設備の増減があった時だけ計算し直す */
function placeMask(p) {
  const sig = `${p.rot}_${G.equip.length}_${G.customers.length}`;
  if (p.mask && p.maskSig === sig) return p.mask;
  const m = new Set();
  const wm = isWallMount(p.id);
  for (let y = 1; y < CONF.H - 1; y++) {
    const edge = wm || inOpenLot(y);                 // 駐車場（壁の無い屋外）は端の列まで見る
    const x0 = edge ? 0 : 1, x1 = CONF.W - (edge ? 0 : 1);
    for (let x = x0; x < x1; x++)
      if (snapAnchor(p.id, p.rot, x, y, p.moving).ok) m.add(y * CONF.W + x);   // タップ後に寄る位置で判定する
  }
  p.mask = m; p.maskSig = sig;
  return m;
}
/* 配置中は、置けるエリア（緑）と置けないエリア（赤）を塗り分けて見せる */
function drawPlaceZones(p) {
  const mask = placeMask(p);
  const wm = isWallMount(p.id);
  for (let y = 1; y < CONF.H - 1; y++) {
    const edge = wm || inOpenLot(y);                 // 駐車場は端の列まで塗る
    for (let x = edge ? 0 : 1; x < CONF.W - (edge ? 0 : 1); x++) {
      const ok = mask.has(y * CONF.W + x);
      /* 床の色が透けると、同じ「置ける」でも部屋ごとに違う色に見えてしまう
         （ロビーの板張りは黄色く、駐車場の砂利は緑に見える＝置けないと勘違いする）。
         いちど暗く沈めてから緑／赤を乗せて、どの部屋でも同じ色に揃える（作者指定） */
      ctx.fillStyle = 'rgba(24,26,22,.42)';
      ctx.fillRect(x * T, y * T, T, T);
      ctx.fillStyle = ok ? 'rgba(96,222,110,.34)' : 'rgba(236,70,70,.34)';
      ctx.fillRect(x * T, y * T, T, T);
      if (!ok) {                                   // 禁止エリアは斜線を入れて“ダメ”を強調
        ctx.strokeStyle = 'rgba(255,120,120,.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x * T, y * T + T); ctx.lineTo(x * T + T, y * T); ctx.stroke();
      }
    }
  }
  // 浴室と脱衣所で置けるものが違う設備は、部屋そのものを目立たせる
  const rm = EQ[p.id].room;
  if (rm) {
    const y0 = rm === 'bath' ? T : CONF.divideY * T;
    const h = rm === 'bath' ? (CONF.divideY - 1) * T : (CONF.H - 1 - CONF.divideY) * T;
    ctx.strokeStyle = 'rgba(150,255,160,.75)'; ctx.lineWidth = 2;
    const rx = wm ? 1 : T + 1, rw = (wm ? CONF.W : CONF.W - 2) * T - 2;
    ctx.strokeRect(rx, y0 + 1, rw, h - 2);
  }
}

/* 「この置き方のせいで使えなくなる設備」に印を付ける。
   赤い斜線で塗り、⚠を重ね、点滅させる＝どれが巻き添えになるのかを一目で分からせる */
function drawLostMarks(lost, rt) {
  const pulse = 0.55 + 0.45 * Math.abs(Math.sin(rt * 3));
  for (const it of lost) {
    const w = ew(it) * T, h = eh(it) * T, ox = it.x * T, oy = it.y * T;
    ctx.save();
    ctx.beginPath(); ctx.rect(ox, oy, w, h); ctx.clip();
    ctx.fillStyle = `rgba(200,40,40,${0.30 * pulse})`;
    ctx.fillRect(ox, oy, w, h);
    ctx.strokeStyle = `rgba(255,140,120,${0.85 * pulse})`; ctx.lineWidth = 2;
    for (let d = -h; d < w; d += 7) {                       // 斜線ハッチ
      ctx.beginPath(); ctx.moveTo(ox + d, oy + h); ctx.lineTo(ox + d + h, oy); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = `rgba(255,90,70,${pulse})`; ctx.lineWidth = 2;
    ctx.strokeRect(ox + 1, oy + 1, w - 2, h - 2);
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(20,10,8,.75)';
    ctx.fillText('⚠', ox + w / 2 + 1, oy + h / 2 + 6);
    ctx.fillStyle = `rgba(255,210,90,${pulse})`;
    ctx.fillText('⚠', ox + w / 2, oy + h / 2 + 5);
  }
}

function drawGhost(rt) {
  const p = G.placing;
  const gw = ew(p.id, p.rot) * T, gh = eh(p.id, p.rot) * T;
  const chk = placeCheck(p.id, p.gx, p.gy, p.moving, p.rot);
  const ok = chk.ok;
  p.valid = ok;
  drawPlaceZones(p);
  ctx.globalAlpha = .8;
  drawEquip(ctx, { uid: -1, id: p.id, x: p.gx, y: p.gy, rot: p.rot, cond: 100 }, rt);
  ctx.globalAlpha = 1;
  ctx.fillStyle = ok ? 'rgba(120,220,120,.3)' : 'rgba(230,80,80,.4)';
  ctx.fillRect(p.gx * T, p.gy * T, gw, gh);
  ctx.strokeStyle = ok ? '#7ac96a' : '#e85a5a'; ctx.lineWidth = 2;
  ctx.strokeRect(p.gx * T + 1, p.gy * T + 1, gw - 2, gh - 2);
  // 巻き添えで使えなくなる設備は、ゴーストの上から印を重ねる
  if (chk.lost && chk.lost.length) drawLostMarks(chk.lost, rt);
}

/* ============ メインループ ============ */
let lastTs = 0;
/* メインループの外枠。
   中でひとつでも例外が飛ぶと requestAnimationFrame が二度と積まれず、
   画面が止まる（区画を切り替えた直後だとキャンバスが消えた直後なので、真っ黒になる）。
   1フレームの失敗でゲームごと死なないよう、ここで受け止めて次のフレームを必ず積む */
let frameErrLogged = false;
function frame(ts) {
  try { frameBody(ts); }
  catch (e) {
    console.error('frame:', e);
    if (!frameErrLogged) { frameErrLogged = true; log('⚠ 画面の更新でつまずいた（続行します）'); }
  }
  requestAnimationFrame(frame);
}
function frameBody(ts) {
  const rDt = Math.min((ts - lastTs) / 1000, .1);
  updateRoach(rDt);                                  // ゴキブリは実時間で歩き回る
  stepTip(rDt);                                      // 上の一行の「片付けた」を数秒で戻す
  lastTs = ts;
  const rt = ts / 1000;
  // 今フレームで進んだゲーム内の分数（吹き出しの寿命にも使う）
  let gDt = 0;
  if (G.phase === 'biz' && !G.paused) {
    const dt = Math.min(rDt * CONF.minPerSec * CONF.speeds[G.speedIdx], 45);
    gDt = dt;
    stepBiz(dt);
  } else if (G.phase === 'prep' && G.player) {
    // 準備中は時計が進まない（速度倍率なし）ので、等速1倍ぶんだけ動かして掃除させる。
    // 第2章は主人公が部屋をまたいで掃除して回るので、その人が居る区画の間取りで動かす
    const dtp = Math.min(rDt * CONF.minPerSec, 45);
    if (areaCount() > 1) {
      const back = G.actF;
      applyArea(G.player.f | 0, true);
      updatePlayer(G.player, dtp);
      applyArea(back, true);
    } else updatePlayer(G.player, dtp);
  }
  // 時計や売上は、イベントで一時停止している間も正しい表示のままにしておく
  if (G.phase === 'biz' && G.today) {
    updateTopbar();
    $('bizStats').textContent = `客 ${G.today.paid}人 / 売上 ${yen(G.today.revenue)} / 場内 ${G.customers.length}人`;
  }
  // ベンツの演出は一時停止（みかじめのカットシーン中も）に関係なく実時間で動かす
  if (G.benz && G.phase === 'biz') updateBenz(rDt); else Sfx.engine(false);
  // 来訪者・修理業者・若い衆も実時間で動く（イベント中で止まっていても歩いてくる／叩きに来る）
  /* 第2章は部屋ごとに間取りが違うので、**その人が居る部屋の地図で動かす**（主人公と同じ手当て）。
     ここを揃えていなかったせいで、浴室の設備を頼んだ修理業者が
     ロビーの地図の上を歩き続け、修理代だけ取られて何も直らなかった */
  if (G.npcs.length && G.phase !== 'title') {
    if (areaCount() > 1) for (const n of [...G.npcs]) inAreaOf(n, () => updateNpcs(rDt * 8, n));
    else updateNpcs(rDt * 8);
  }
  // バブル・エフェクトは実時間で減衰（一時停止中は止める＝吹き出しを読める）
  if (!G.paused) {
    for (const e of [...G.customers, ...G.staff, ...(G.player ? [G.player] : [])]) {
      // 実時間・ゲーム内時間のどちらかが尽きたら消す。
      // さらに、客がやっていることが変わった瞬間も消す（場面に合わないセリフが居座るのを防ぐ）
      if (e.bub) {
        e.bub.t -= rDt;
        if (e.bub.gm != null) e.bub.gm -= gDt;
        const moved = e.bub.key != null && e.bub.key !== bubKey(e);
        if (e.bub.t <= 0 || (e.bub.gm != null && e.bub.gm <= 0) || moved) e.bub = null;
      }
      if (e.stuckCd > 0) e.stuckCd -= rDt;      // 「たどり着けない」の連呼を防ぐクールダウン
    }
    for (let i = floaters.length - 1; i >= 0; i--) if ((floaters[i].t -= rDt) <= 0) floaters.splice(i, 1);
    for (let i = sparkles.length - 1; i >= 0; i--) if ((sparkles[i].t -= rDt) <= 0) sparkles.splice(i, 1);
  }
  // 館内案内図を開いている間は、区画の中を描かない（案内図そのものを描く）
  if (G.phase !== 'title') { if (onGuide()) drawGuide(); else render(rt); }
}

function updateTopbar() {
  syncSpecialName();   // 決戦仕様の名前は屋号から作る（ログやトーストにも屋号で出す）
  // クリア後はゲームクリアの証（⭐）を日数の隣に出す（フェーズ4・自由営業中）
  $('uiDay').textContent = (chHook('dayText') || `${G.day}日目（${dayLabel()}）`)
    + (G.flags && G.flags.freePlay ? ' ⭐' : '');
  if (G.phase === 'biz') {
    const h = (openHourNow() + Math.floor(G.minutes / 60)) % 24;
    const m = Math.floor(G.minutes % 60);
    $('uiClock').textContent = `${h}:${String(m).padStart(2, '0')}`;
  } else $('uiClock').textContent = '準備中 🌙';
  // 借金の表示はサラ金の残債（銀行融資は廃止）
  const sDebt = G.yami ? G.yami.debt : 0;
  // 資金がマイナスの日は、赤字の額をそのまま出す（0で隠さない＝作者指定）
  $('uiCash').textContent = (G.cash < 0 ? '−' + yen(-G.cash) : yen(G.cash))
    + (sDebt ? ` (借金${(sDebt / 10000) | 0}万)` : '');
  $('uiCash').classList.toggle('minus', G.cash < 0);
  syncTip();   // 上の一行（開店したら消える／営業中は出さない）
  syncRep();   // 減点は即時反映＝運営メニューで直したその場で数字が戻る
  /* 上のバーの評判。章が `topRep` を持てば、その文字をそのまま出す（作者指定 8/8）＝
     第2章は8部門の総合スコア（800点満点）。0-100の評判と0-800の番付スコアが
     2つ並んでいて、しかも設備の解放は800点側なので、何を見ればいいのか分からなかった。
     フックの無い章＝これまでどおり「評判 N」／「評判 集計中」 */
  $('uiRep').textContent = chHook('topRep') || (repCounting() ? '評判 集計中' : `評判 ${G.rep}`);
  /* ゲージの帯（第2章だけ）。**体力と妻の機嫌は常時出す**（作者指定）＝
     倒れるのも、彼女が下りるのも、事故ではなく自分の判断だと分かるように */
  const st = $('uiStam'), md = $('uiMood'), sa = $('uiStress'), bar = $('gaugeBar');
  const moodPct = hasHook('moodPct') ? chHook('moodPct') : null;
  const stressPct = hasHook('stressPct') ? chHook('stressPct') : null;
  if (!staminaOn() && moodPct == null && stressPct == null) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  // 体力＝主人公が今日あと何をできるか。減るほど緑→黄→赤
  st.classList.toggle('hidden', !staminaOn());
  if (staminaOn()) {
    /* 上限は章で変わりうる（第2章は筋トレで150まで伸びる）ので、帯の長さは割合、
       **文字は実数**で出す（作者指定 8/8）＝「体力 62 / 100」。
       「62%」だと、上限が伸びたときに同じ%でも中身が違うことが読み取れない。
       `stamText` を持たない章＝これまでどおり「体力 62%」 */
    const max = chHook('stamMax') || CONF.stamMax;
    const now = Math.round(stamLeft());
    const pct = clamp(Math.round(now / max * 100), 0, 100);
    st.style.setProperty('--stam', pct + '%');
    st.style.setProperty('--stam-col', pct > 50 ? '#8fd4a0' : pct > 20 ? '#e8c84a' : '#e85a5a');
    st.classList.toggle('low', pct <= 20);
    st.querySelector('b').textContent = chHook('stamText') || `体力 ${pct}%`;
  }
  // 妻の機嫌。下がりきると、彼女はフロントに立たなくなる
  md.classList.toggle('hidden', moodPct == null);
  if (moodPct != null) {
    const p = clamp(Math.round(moodPct), 0, 100);
    md.style.setProperty('--mood', p + '%');
    md.style.setProperty('--mood-col', p > 55 ? '#f0a0bc' : p > 25 ? '#e8c84a' : '#e85a5a');
    md.classList.toggle('low', p <= 25);
    md.querySelector('b').textContent = `${chHook('moodName') || '機嫌'} ${p}%`;
  }
  /* ストレス。**これだけは溜まるほど悪い**＝満タンに近いほど赤くなる。
     体力とは別物で、「体はきついが気は晴れている」も起きる */
  sa.classList.toggle('hidden', stressPct == null);
  if (stressPct != null) {
    const p = clamp(Math.round(stressPct), 0, 100);
    sa.style.setProperty('--stress', p + '%');
    sa.style.setProperty('--stress-col', p < 50 ? '#7ec8e8' : p < 80 ? '#e8c84a' : '#e85a5a');
    sa.classList.toggle('low', p >= 80);
    sa.querySelector('b').textContent = `${chHook('stressName') || 'ストレス'} ${p}%`;
  }
}

/* ============ ショップ・準備UI ============ */
let shopTab = 'sauna';
/* ============ カタログのタブは、章ごとに覚える（2026-08-08）============
   `shopTab` は変数なので**章を移っても残る。**第2章で【ととのい】を開いたまま
   第1章へ戻ると、その値は第1章の一覧に無い＝`renderShop` が「無ければ先頭」に落ちて
   **【風呂】で開いていた**（差分テストが見つけた／第1章は【サウナ】で開くのが仕様）。

   ⚠ **セーブには入れない。**遊びの状態ではなく画面の都合なので、
     アプリを開き直したら第1章は【サウナ】から、が正しい（第1章セッションの指定）。
   ⚠ **その章に無いタブは覚えない。**`renderShop` の「無ければ先頭」はそのまま残したうえで、
     記憶する側でも弾く＝章のタブ構成を変えた日に、また同じ形で漏れないように二重にする */
const SHOP_TAB_MEM = {};
let SHOP_TAB_LAST_CH = null;   // 最後に描いた章。**章が変わった一度だけ**思い出す
const iconCache = {};
function iconFor(id) {
  if (iconCache[id]) return iconCache[id];
  const def = EQ[id];
  const c = document.createElement('canvas');
  c.width = 68; c.height = 68;
  const cc = c.getContext('2d');
  cc.imageSmoothingEnabled = false;
  const s = 60 / (Math.max(def.w, def.h) * T);
  cc.translate(34 - def.w * T * s / 2, 34 - def.h * T * s / 2);
  cc.scale(s, s);
  drawEquip(cc, { uid: -1, id, x: 0, y: 0, cond: 100 }, 0.5);
  iconCache[id] = c.toDataURL();
  return iconCache[id];
}

// 収容人数を出すカテゴリ（占有面積×1人）
const CAP_CATS = ['furo', 'sauna', 'mizu', 'wash'];
/* カタログのタブ。tab を持つ設備はそちらに並べる（ロッカー＝【脱衣所】タブ） */
/* **1つの設備を2つのタブに出せるようにする**（作者指定 8/8）。
   第2章のドリンク自販機は「1階の待合」にも「浴室階の脱衣所」にも置ける約束なのに、
   タブを1つしか持てず、**脱衣所から消えていた。**
   `tabs` を持たない設備＝js/data.js の全部は、これまでどおり1つのタブに出る */
function shopTabsOf(id) { const d = EQ[id]; return d.tabs || [d.tab || d.cat]; }
/* 決戦仕様の一台は、熱波師が提案するまで一覧に出さない（作者指定）。
   鍵付きで並べておくと、始めたばかりの店にも「◯◯スペシャル」が見えてしまい、物語の先が割れる */
function shopIds(cat) {
  /* 並び順は「解放される評判」→「値段」の昇順（作者指定）。
     上から順に鍵が外れ、下へ行くほど高くなる＝いま買えるものが必ず上に集まる。
     ただし first:true のものだけは値段に関係なく先頭に出す＝
     **それが無いと他が置けない土台**（第2章の厨房の工事）を、いちばん上に見せる */
  const ids = Object.keys(EQ).filter(id => shopTabsOf(id).includes(cat) && !EQ[id].old && !EQ[id].noShop && id !== 'bandai'
    && !EQ[id].retired                           // 廃止した品はカタログに出さない（置いてある店ではそのまま使える）
    && (chHook('shopItemOK', id) !== false)      // 第2章：男湯／女湯限定のものは、その部屋でだけ並べる
    && !(id === DUEL_ONLY_EQ && !duelEqReady()));
  /* **サイズ違いは縦に並べる**（作者指定 8/5）。
     並び順の基本は今までどおり評判（上から順に鍵が外れる）だが、
     `fam` が同じ品（小カラン・中カラン・大カラン／小中大のロッカー）は
     **いちばん早く解禁される1つの位置に、まとめて置く**＝大きさで選べるようになる */
  const famAt = {};
  for (const id of ids) {
    const f = EQ[id].fam; if (!f) continue;
    const r = EQ[id].rep || 0;
    if (famAt[f] === undefined || r < famAt[f]) famAt[f] = r;
  }
  const slot = id => (EQ[id].fam !== undefined ? famAt[EQ[id].fam] : (EQ[id].rep || 0));
  return ids.sort((a, b) => (EQ[b].first ? 1 : 0) - (EQ[a].first ? 1 : 0)
               || slot(a) - slot(b)                                     // 一族はひとかたまりで動く
               || String(EQ[a].fam || '').localeCompare(String(EQ[b].fam || ''))
               || (EQ[a].rep || 0) - (EQ[b].rep || 0)                    // 一族の中では 小 → 中 → 大
               || (EQ[a].ord || 0) - (EQ[b].ord || 0)                    // 章が並びを指で直したい時だけ（第2章のマット置き場）
               || EQ[a].price - EQ[b].price);
}
// 「評判で解放されたのに、まだ見ていない」設備があるか
function isNewItem(id) { const u = unlockOf(id); return !!u && u.ok && !G.seenEq[id]; }
function newInCat(cat) { return shopIds(cat).some(isNewItem); }

// 設備の仕入れ値。玲奈が仲間なら15%引き（業界の伝手で安く回してもらえる）
/* 黒田の課題が設備の購入だった場合の30%引き（作者指定）。課題を果たすまで有効。
   黒田の課題は経営の数字に作り替えたので今は出番がないが、仕組みは残してある
   （田所側や、今後この形の課題を足す時のため）。
   ※以前は「引き受けた翌朝まで」で、240万の設備が貯まる頃には定価に戻っていた＝死んだ選択肢だった */
const KURODA_DISCOUNT = 0.30;
const DUEL_ONLY_EQ = 'sauna_sp';
// 決戦仕様の設備は、投票対決を受けて立つまでカタログに並ばない（評判では解放されない）
function duelEqReady() { return !!(G.flags && G.flags.duelBoost); }
function kurodaDiscountId() {
  const k = G.kuroda;
  if (!k || !k.discountKey || k.resolved) return null;
  return k.discountKey;
}
function eqPrice(id) {
  let p = EQ[id].price * (reinaAllyOn() ? REINA_EQ_OFF : 1);
  if (kurodaDiscountId() === id) p *= (1 - KURODA_DISCOUNT);
  // 章ごとの値引き（第2章＝休みの日に買い出しへ行った週）
  const d = hasHook('eqDiscount') ? (chHook('eqDiscount', id) || 0) : 0;
  if (d > 0) p *= (1 - d);
  return Math.round(p);
}
/* 決戦仕様の名前は屋号から作る（作者指定）＝「夕凪湯スペシャル」。
   店の名前はプレイヤーが決めるので、カタログに並べる直前にここで名乗らせる */
function syncSpecialName() {
  // 決戦仕様は第1章だけの設備。第2章のカタログには無いので、何もしない
  if (!EQ.sauna_sp) return;
  EQ.sauna_sp.name = `${G.name || '夕凪湯'}スペシャル`;
}
function renderShop(markSeen) {
  syncSpecialName();
  /* いま入っている部屋に置けるものだけを並べる（作者指定）。
     食堂を開いているのに駐車場の設備が並んでいると、どこに何を置く話なのか分からなくなる。
     第1章は区画がひとつなので、いつもどおり全部のタブが出る */
  const cats = chHook('shopCats') || CATS;
  /* その章で最後に開いていたタブに戻す。
     ⚠ **思い出すのは「章が変わった最初の1回」だけ。**毎回戻すと、
       タブを押す側（`shopTab = key; renderShop()`）を即座に上書きして
       **タブが1つも切り替わらなくなる**（実測 8/8）*/
  const chNow = G.chapter || 1;
  if (SHOP_TAB_LAST_CH !== chNow) {
    if (SHOP_TAB_MEM[chNow] != null) shopTab = SHOP_TAB_MEM[chNow];
    SHOP_TAB_LAST_CH = chNow;
  }
  /* 何も置けない部屋（第2章の廊下＝通り道）は、カタログごと隠す。
     ここを出しておくと、廊下で「サウナ」タブが並んで、どこに置く話なのか分からなくなる */
  $('shopPanel').classList.toggle('no-shop', !cats.length);
  if (!cats.length) { $('shopTabs').innerHTML = ''; $('shopList').innerHTML =
    '<p class="shop-empty">🚪 廊下には物を置けない。通り抜けるだけの場所だ</p>'; return; }
  /* 覚えるのは**その章の一覧にある値だけ**。
     ⚠ **「無ければ先頭」に落ちる前に覚える。**第2章はタブが階ごとに変わるので、
       落ちた先を覚えると、【ととのい】を開いたまま1階へ降りただけで
       記憶が【受付】に書き換わる＝章へ戻ったときに思い出せない（実測 8/8）*/
  if (cats.some(c => c[0] === shopTab)) SHOP_TAB_MEM[chNow] = shopTab;
  /* 「無ければ先頭」に落ちる前に、**覚えているタブが使えるならそちらを優先**。
     第2章はタブが階ごとに変わるので、【ととのい】を開いたまま1階へ降りて戻ってきたとき、
     先頭ではなく【ととのい】に戻る＝「最後に開いたタブを覚える」が階をまたいでも効く */
  if (!cats.some(c => c[0] === shopTab)) {
    const mem = SHOP_TAB_MEM[chNow];
    shopTab = (mem != null && cats.some(c => c[0] === mem)) ? mem
            : (cats[0] ? cats[0][0] : shopTab);
  }
  const tabs = $('shopTabs');
  tabs.innerHTML = '';
  for (const [key, label] of cats) {
    const b = document.createElement('button');
    b.className = 'tab' + (key === shopTab ? ' on' : '');
    b.innerHTML = label + (newInCat(key) ? '<i class="new-dot"></i>' : '');   // 🔴 新着マーク
    b.onclick = () => { shopTab = key; renderShop(true); };                   // 開いたら既読
    tabs.appendChild(b);
  }
  const list = $('shopList');
  list.classList.toggle('compact', hasHook('placeInfo'));   // 一行説明を置く画面に譲った章だけ、行を詰める
  list.innerHTML = '';
  /* 設備カタログではないタブ（第2章の【メニュー】）は、章のほうが自前で描く */
  if (chHook('shopTabRender', shopTab, list)) return;
  for (const id of shopIds(shopTab)) {
    const def = EQ[id];
    const price = eqPrice(id);
    const discounted = reinaAllyOn() && price < def.price;
    const unl = unlockOf(id);
    const locked = id === DUEL_ONLY_EQ
      ? !duelEqReady()                                   // 決戦仕様は投票対決を受けて立つまで並ばない
      : (!!unl && !unl.ok && !isDemandedEquip(id));
    const isNew = isNewItem(id);
    // 収容チップを出さない章（第2章＝作者指定 8/9「設備カードに収容人数は不要」）
    const capTxt = !CONF.noCapChip && CAP_CATS.includes(def.cat) && def.cap > 0 ? ` <span class="cap-chip">収容${def.cap}人</span>` : '';
    // ⭐（店の格への貢献）は廃止した（作者指定）。名前・収容・値段・鍵だけを1行に置く
    const div = document.createElement('div');
    div.className = 'shop-item' + (locked ? ' locked' : '') + (isNew ? ' is-new' : '');
    // 名前の下に一行だけ短い説明（EQ_NOTE）。長い説明は設備をタップした時の詳細に置いてある
    /* 置く画面に詳細を出す章（第2章）は、この一行をそちらへ譲る＝
       カタログの行が縮んで、小さい画面に並ぶ数が増える。
       フックの無い第1章は、いままでどおり一行説明つきのまま */
    const noteTxt = hasHook('placeInfo') ? '' : (EQ_NOTE[id] || '');
    const note = noteTxt ? `<div class="shop-note">${noteTxt.replace('{店名}', G.name)}</div>` : '';
    div.innerHTML = `<img class="shop-icon" src="${iconFor(id)}">
      <div class="shop-body"><div class="shop-name">${isNew ? '<b class="new-tag">NEW</b> ' : ''}${def.name}${capTxt}${locked ? (id === DUEL_ONLY_EQ ? ' <span class="lock-chip">🔒決戦仕様</span>' : ` <span class="lock-chip">🔒${CONF.noUnlockLabel ? '' : unl.label}</span>`) : ''}</div>${note}</div>
      <div class="shop-price">${
        // 黒田割引中は「定価を消して、赤で割引後の額」。定価のほうを赤で出すと、どちらを払うのか分からなくなる
        kurodaDiscountId() === id
          ? `<span class="price-was">通常${yenShort(def.price)}</span>/<span class="kuroda-off">今だけ${yenShort(price)}（黒田割引）</span>`
          : yenShort(price) + (discounted ? '<br><span style="font-size:10px;color:#37a">玲奈割15%引き</span>' : '')}</div>`;
    div.onclick = () => {
      if (locked) {
        // 章が言い回しごと持っていればそれを使う（第2章の解放の鎖＝「【◯◯】を設置すると…」）
        toast(id === DUEL_ONLY_EQ ? 'これは、まだ手が届く代物じゃない…' : (unl.lockText || `${unl.label}になったら仕入れられる`));
        return;
      }
      if (G.cash < price) { toast('資金が足りない…（融資も検討しよう）'); return; }
      startPlacing(id, null);
    };
    list.appendChild(div);
  }
  // このタブを自分で開いたときだけ既読にする（見ていないのに消えないように）
  if (markSeen) {
    let changed = false;
    for (const id of shopIds(shopTab)) if (isNewItem(id)) { G.seenEq[id] = true; changed = true; }
    if (changed) { saveGame(); renderShop(); }
  }
}

/* opts.once=連続設置しない（アメニティ置き場）  opts.onPlaced=設置できたときの後始末 */
function startPlacing(id, moving, opts) {
  setHint(null);
  G.selected = null;
  $('selPanel').classList.add('hidden');
  G.placing = {
    id, gx: moving ? moving.x : 5, gy: moving ? moving.y : 4, moving,
    rot: moving ? (moving.rot || 0) : 0, valid: false, placedN: 0,
    once: !!(opts && opts.once), onPlaced: opts && opts.onPlaced, onCancel: opts && opts.onCancel,
  };
  $('prepPanel').classList.add('hidden');
  $('shopPanel').classList.add('hidden');
  // 設備の詳細（章が持っていれば）。まだ金は払っていない＝ここが「買う前に読む」場所になる
  const pinf = chHook('placeInfo', id);
  $('placeInfo').innerHTML = pinf || '';
  $('placeInfo').classList.toggle('hidden', !pinf);
  /* 【向き・ここに置く・やめる】が、スクロールしないと見えないことがある（作者報告 8/8）。
     `stickyPlaceBar` を持つ章だけ、パネルの下に貼り付けて必ず画面に入れる。
     持たない章（第1章）は class が付かない＝これまでどおりの並びのまま */
  $('confirmBar').classList.toggle('stick', !!CONF.stickyPlaceBar);
  $('confirmBar').classList.remove('hidden');
  $('btnRotate').style.display = canRotate(id) ? '' : 'none';
  const rl = roomLabel(id);
  // 設置開始時の説明は「名前＋置ける部屋」だけのシンプル表記（作者指定）
  /* 詳細の箱をすぐ上に出している章（第2章）は、名前がそこに大きく出ている＝
     ここで繰り返すと長い名前が3行に折り返して、ボタンを潰してしまう */
  $('confirmText').textContent = pinf
    ? (rl ? `${rl}のみ` : '場所をタップ')
    : EQ[id].name + (rl ? `（${rl}のみ）` : '');
}
function endPlacing() {
  if (G.placing && G.placing.onCancel && !G.placing.placedN) G.placing.onCancel();
  G.placing = null;
  $('confirmBar').classList.add('hidden');
  $('placeInfo').classList.add('hidden');
  if (G.phase === 'prep') $('prepPanel').classList.remove('hidden');
  if (!onGuide() && !onHome()) $('shopPanel').classList.remove('hidden');
  // 置き終わった直後に案内を引き直す＝第2章の「あと何が足りないか」がその場で減る
  if (G.phase === 'prep' && hasHook('prepHint')) { const h = chHook('prepHint'); if (h) setHint(h); }
}
/* 配置確認バーの文言（移動なら費用を出す） */
function updateConfirmText() {
  const p = G.placing; if (!p) return;
  const chk = placeCheck(p.id, p.gx, p.gy, p.moving, p.rot);
  p.valid = chk.ok;
  if (!chk.ok) {
    // 理由が分かるものは添える（部屋違い／通路が途切れる）。それ以外は重なり
    const rl = roomLabel(p.id);
    const wrongRoom = rl && !roomOK(p.id, p.gy);
    // 確認バーは横に短い。理由がある時は理由だけを出す（前置きを重ねると折り返してボタンを潰す）
    $('confirmText').textContent = wrongRoom ? `⚠ ${rl}にしか置けない`
      : chk.why ? `⚠ ${chk.why}`
      : '⚠ ここ（赤いマス）には置けない';
    return;
  }
  if (p.moving) {
    const c = moveCost(p.moving, p.gx, p.gy, p.rot);
    // 担いで動かせるものは費用の行を出さない（金の話が無いことが伝わればいい）
    $('confirmText').textContent = c ? `移動費 ${yen(c)}`
      : isPortable(EQ[p.id]) ? 'ここでいい？（自分で運べる＝無料）'
      : 'ここでいい？（元の位置）';
  } else {
    // 連続設置中は何個置いたかを出す。終わりたくなったら「やめる」
    $('confirmText').textContent = p.placedN ? `ここでいい？（${p.placedN + 1}個目）` : 'ここでいい？';
  }
}

function selectEquip(it) {
  G.selected = it;
  const def = EQ[it.id];
  $('prepPanel').classList.add('hidden');
  $('shopPanel').classList.add('hidden');
  $('selPanel').classList.remove('hidden');
  // 第2章の残置物は、修理も移動も売却もできない。売る／撤去／残す の3択だけ（作者指定）
  if (chHook('isPendingZanchi', it)) { selectZanchi(it); return; }
  $('zanchiActions').style.display = 'none';
  $('selPanel').querySelector('.sel-actions').style.display = 'flex';
  const condPct = (CONF.wearPerDay[def.cat] ?? 0) > 0 ? Math.round(it.cond) : null;
  // 温度を弄れるのはドライサウナだけ。浴槽・水風呂・ミスト・塩は設備ごとに固定（表示はする）
  const canTemp = canSetTemp(def);
  const showTemp = def.temp != null && (canTemp || def.cat === 'furo' || def.cat === 'mizu' || def.cat === 'sauna');
  const temp = canTemp ? (it.temp ?? def.temp) : def.temp;
  const tempLabel = def.cat === 'mizu' ? '水温' : def.cat === 'sauna' ? '室温' : '湯温';
  const capTxt = CAP_CATS.includes(def.cat) && def.cap > 0
    ? ` <span class="cap-chip">収容${def.cap}人</span>` : '';
  $('selInfo').innerHTML = `<b>${def.name}</b> ${'★'.repeat(def.q)}${capTxt}<br>` +
    // 道が通っていない設備＝誰も使えない「飾り」。なぜ効かないのかを、この場で言い切る
    (it.dead ? `<div class="dead-note">⚠ 通路につながっていません`
      + `<span class="shop-desc">まわりを設備で囲まれていて、誰もたどり着けません。`
      + `置いてあるだけで、客も使えず、店の充実度にも数えられません。`
      + `まわりの設備を動かすか、この設備を売ってください。</span></div>` : '') +
    (condPct !== null ? `状態: <span class="cond-bar"><i style="width:${condPct}%;background:${condPct > 50 ? '#7ac96a' : condPct > 20 ? '#e8c84a' : '#e85a5a'}"></i></span> ${condPct}%<br>` : '') +
    // 黄色文字の説明書き（修理のうんちく・従量の内訳・温度の解説）は作者指定で削除＝コンパクト化。
    // 壊れている時だけ“いま何が起きているか”を1行出す
    (it.cond <= 0 ? `<b class="broken-note">${fixerOn(it) ? '🔧 修理中…'
      : `🔧 ${it.fault === 'major' ? '大がかりな修理が要る' : '不調（部品交換で直る）'}（下の【修理】で業者を呼ぶ）`}</b><br>` : '') +
    // 修理費・売却額はボタンに入れると幅が足りず「¥2…」と切れるので、ここに1行で出す
    (fixable(it) ? `修理費: ${yen(fixFee(it))}　` : '') +
    (it.id !== 'bandai' && def.cat !== 'amenity' ? `売却額: ${yen(sellValue(it))}` : '') +
    (fixable(it) || (it.id !== 'bandai' && def.cat !== 'amenity') ? '<br>' : '') +
    (heatCost(it) ? `光熱費: ${yen(Math.round(heatCost(it) * CONF.utilRunRate))}/日（固定）<br>` : '') +
    (waterCost(it) ? `水道代: ${yen(Math.round(waterCost(it) * CONF.waterStandby))}/日＋従量<br>` : '') +
    equipDesc(def, condPct) +
    (showTemp ? `<div class="temp-ctrl"><span>${tempLabel}</span>` +
      (canTemp ? `<button class="opt-btn" id="tempDown">−</button><b id="tempVal">${temp}℃</b><button class="opt-btn" id="tempUp">＋</button>`
               : `<b id="tempVal">${temp}℃</b>`) +
      `<span class="temp-band">${bandLabel(def.cat, temp)}</span></div>` : '');
  if (canTemp) {
    const [lo, hi] = TEMP_RANGE[def.cat];
    // フェーズ3：温度は10℃刻み（作者指定）。旧セーブの中途半端な値は最寄りの10℃に丸めてから動かす
    const setT = d => { it.temp = clamp(Math.round(((it.temp ?? def.temp) + d) / 10) * 10, lo, hi); selectEquip(it); saveGame(); };
    $('tempDown').onclick = () => setT(-10);
    $('tempUp').onclick = () => setT(10);
  }
  // アメニティ置き場は運営メニューのOFFで撤去する（売り物ではない）
  const sellable = it.id !== 'bandai' && def.cat !== 'amenity';
  // 営業中でも移動・売却できる（使用中の客は追い出して作業する）。表示内容は準備中とまったく同じ
  $('btnMove').style.display = '';
  $('btnSell').style.display = sellable ? '' : 'none';
  /* 修理は「傷んでいて、まだ業者が手をつけていない設備」にだけ出す。
     準備中でも呼べる＝夜のうちに直しておけば、客に迷惑をかけずに済む */
  // ボタンは一列に収める＝金額はボタンに入れない（selInfoの「修理費/売却額」の行で見せる）
  const canFix = fixable(it);
  $('btnFix').style.display = canFix ? '' : 'none';
  if (canFix) {
    $('btnFix').textContent = '🔧 修理';
    $('btnFix').disabled = G.cash < fixFee(it);
  }
  $('btnSell').textContent = '💸 売却';
}
/* 第2章：まだ決めていない残置物を選んだとき。
   売る（金が入る）／撤去（金が出る）／残す（床を食い続ける）の3択を出す */
function selectZanchi(it) {
  const def = EQ[it.id], z = def.zanchi;
  $('selPanel').querySelector('.sel-actions').style.display = 'none';
  $('zanchiActions').style.display = 'flex';
  $('selInfo').innerHTML = `<b>${def.name}</b> <span class="cap-chip">残置物</span><br>` +
    `<span class="shop-desc">${def.desc}</span><br>` +
    `<b class="broken-note">前の持ち主が置いていったもの。始末を決めるまで、この床は使えない。</b><br>` +
    `<span class="shop-desc">✋ 残すと：${z.keep}</span>`;
  const bs = $('btnZanSell');
  bs.style.display = z.sell ? '' : 'none';
  // ボタンは4つ並ぶので、金額は万で詰める（¥250,000 だと「+¥…」に切れる）
  if (z.sell) bs.textContent = `💸 売る +${yenShort(z.sell)}`;
  const bg = $('btnZanGone');
  bg.textContent = `🗑 撤去 −${yenShort(z.cost)}`;
  bg.disabled = G.cash < z.cost;
}
/* 移動・売却の前に、その設備を使っている客・並んでいる客をどかす（営業中の改装） */
function evictUsers(it) {
  let n = 0;
  for (const c of G.customers) {
    if (c.use && c.use.item === it) {
      it.occ[c.use.slotIdx] = null; c.use = null; c.path = null;
      c.state = 'plan'; c.sat = clamp(c.sat - 8, 0, 100);
      bubble(c, pick(['え、いま使ってたのに…', 'おいおい、営業中だぞ', '追い出された…']));
      n++;
    } else if (c.waitItem === it) { c.waitItem = null; c.state = 'plan'; }
  }
  if (n) log(`⚠ 使用中の${EQ[it.id].name}をどかした（客 ${n}人の満足度が下がった）`);
  return n;
}
function deselect() {
  G.selected = null;
  $('selPanel').classList.add('hidden');
  if (G.phase === 'prep') $('prepPanel').classList.remove('hidden');
  if (!onGuide() && !onHome()) $('shopPanel').classList.remove('hidden');
}
/* 修理費＝購入額の12%（古い設備は一律¥25,000）。壊れると自動で業者が来て取っていくので、
   維持費として毎日じわじわ効いてくる。※数値は叩き台 */
/* 修理代。故障には2つの規模があり、どちらになったかは壊れた瞬間に決まって it.fault に残る。
   ・軽微な不調（85%）＝購入額の1.5%。パッキン・部品交換・詰まりの類い。ふだんはこっち
   ・大規模修理（15%）＝購入額の7%。数年に一度のオーバーホールで、フィンランド式サウナなら¥168,000
   1回の額そのものは現実の比率どおり（¥2,400,000の設備に¥168,000）。現実的でなかったのは頻度のほうで、
   全部の故障を7%にすると年間で購入額の70〜105%を修理に払うことになっていた */
function repairCost(it, kind) {
  const def = EQ[it.id];
  const major = (kind || it.fault) === 'major';
  const rate = major ? CONF.repairMajorRate : CONF.repairMinorRate;
  const floor = major ? CONF.repairMajorFloor : CONF.repairMinorFloor;
  const base = def.old ? (major ? CONF.repairMajorOld : CONF.repairMinorOld)
                       : Math.max(Math.floor(def.price * rate / 1000) * 1000, floor);
  // 壊れてから呼ぶと1.5倍（作者指定）。kind指定あり＝予防修理の基準額の計算なので倍率は掛けない
  if (!kind && it.cond <= 0) return Math.round(base * CONF.brokenRepairMul / 1000) * 1000;
  return base;   // フェーズ3：田所仲間の修理費20%offは廃止（簡単すぎたため。作者指定）
}
/* 業者に払う実際の額。
   ・壊れている設備＝上の repairCost（故障後は1.5倍。作者指定＝壊れる前に手を打つ方が得）
   ・まだ動く設備を先に直す（予防修理）＝減った耐久のぶんだけ、倍率なしの基準額で払う。
     壊れるまで待つと同じ修理が1.5倍になるので、予防が明確にお得 */
function fixFee(it) {
  if (it.cond <= 0) return repairCost(it);
  const worn = clamp(fixTargetCond(it) - it.cond, 0, 100) / 100;
  const avg = repairCost(it, 'minor') * (1 - CONF.repairMajorChance)
            + repairCost(it, 'major') * CONF.repairMajorChance;
  return Math.max(Math.round(avg * worn / 1000) * 1000, 1000);
}
/* 設備を故障させる。規模の抽選はここ1か所に集約する＝日々の劣化・使用による摩耗・ヤクザの破壊で
   同じ判定になる（ヤクザに叩き壊されたぶんだけは必ず大規模修理） */
function breakEquip(it, forceMajor) {
  it.cond = 0;
  it.occ = it.occ.map(() => null);
  it.fault = (forceMajor || Math.random() < CONF.repairMajorChance) ? 'major' : 'minor';
  return it.fault;
}
/* 「大型サウナ（大規模修理）」のように、日報とログで規模が分かるようにする */
function faultLabel(it) { return it.fault === 'major' ? '大規模修理' : '不調'; }
/* 売却額は購入額の10%。買い直すと丸損＝置き場所と品揃えは、よく考えて決めろということ */
function sellValue(it) { return EQ[it.id].old ? 3000 : Math.floor(EQ[it.id].price * CONF.sellRate); }

/* 設備の移動費。大きいものほど、遠くへ運ぶほど高くなる（配管・電気の引き直し代）。
   向きを変えるだけでも1マスぶんの手間として計上する。
   ただし床に固定されていないもの（イス・置き場・小物）は**無料**＝
   自分で担いで動かせるのに金を取られるのは理不尽だった（作者指定 8/5） */
function moveCost(it, gx, gy, rot) {
  const def = EQ[it.id], area = def.w * def.h;
  if (isPortable(def)) return 0;
  const dist = Math.abs(gx - it.x) + Math.abs(gy - it.y)
             + (((rot || 0) !== (it.rot || 0)) ? 1 : 0);
  if (dist === 0) return 0;
  return Math.round(CONF.moveBase * area * (1 + dist * 0.15) / 100) * 100;
}

/* ============ 入力 ============ */
function canvasTile(ev) {
  const r = cv.getBoundingClientRect();
  const x = (ev.clientX - r.left) / r.width * CONF.W * T;
  const y = (ev.clientY - r.top) / r.height * CONF.H * T;
  return { x: clamp((x / T) | 0, 0, CONF.W - 1), y: clamp((y / T) | 0, 0, CONF.H - 1) };
}
/* 館内案内図：区画をタップするとその部屋へ入る（第2章だけ） */
let guideTapAt = 0;
$('guide').addEventListener('pointerup', ev => {
  /* タッチ端末では、指を離したあとにブラウザが「マウスのふり」をした操作をもう一度送ってくる。
     区画へ入った直後は下のゲーム画面が同じタップを拾って、音が二重に鳴っていた。
     ここで既定の動作を止めたうえ、直後のゲーム画面のタップを短時間だけ無視する */
  ev.preventDefault();
  guideTapAt = performance.now();
  const g = $('guide'), r = g.getBoundingClientRect();
  const px = (ev.clientX - r.left) / r.width * g.width;
  const py = (ev.clientY - r.top) / r.height * g.height;
  /* 章が案内図の上に自前の当たり判定を持っていれば、そちらを先に見る
     （第2章＝「⚠ スタッフがいません」の帯を押すと、バイトの管理画面へ飛ぶ）。
     フックを持たない章（第1章）は、これまでどおり区画の矩形だけを見る */
  if (chHook('guideTap', px, py)) return;
  const hit = guideRects.find(q => px >= q.x && px <= q.x + q.w && py >= q.y && py <= q.y + q.h);
  if (!hit) return;
  Sfx.play('ui');
  enterAreaScreen(hit.f);
});
$('btnToGuide').onclick = () => { Sfx.play('ui'); openGuide(); };

cv.addEventListener('pointerup', ev => {
  // 館内案内図から区画へ入った直後の、鳴り残りのタップは無視する（音が二重に鳴るのを防ぐ）
  if (performance.now() - guideTapAt < 400) return;
  setHint(null);
  Sfx.play('ui');                        // マップも「押した手ごたえ」を返す（設置場所を選ぶ・設備を選ぶ）
  const t = canvasTile(ev);
  if (G.placing) {                       // 準備中でも営業中でも配置操作を受け付ける
    const p = G.placing;
    const a = snapAnchor(p.id, p.rot, t.x, t.y, p.moving);   // 壁掛けは左右の壁へ、大きい設備は置ける側へ寄る
    p.gx = a.gx; p.gy = a.gy;
    updateConfirmText();
    return;
  }
  if (isHomeArea(G.actF)) {              // 家の中：ベッド・台所・食卓・千夏をタップ
    const s = homeSpotAt(t.x, t.y);
    if (s) chHook('homeAction', s.key); else deselect();
    return;
  }
  if (G.phase === 'prep') {
    // 第2章の開店前：ゴミをタップ＝主人公に「これを運べ」と言う（設備より先に見る）
    const j = junkAt(t.x, t.y);
    if (j) { markJunk(j); return; }
    const it = equipAt(t.x, t.y);
    /* 章が「この設備は押すと何かが起きる」を持っていれば、そちらが先（第2章＝エレベーター）。
       true を返したら、その設備は選ばない＝説明パネルを出さない */
    if (it && chHook('equipTap', it)) return;
    if (it) selectEquip(it); else deselect();
  } else if (G.phase === 'biz') {
    /* 人をタップ＝**その人の札**（第2章。custcard_y.js）。
       客なら「何を求めているか」、バイト・妻・主人公なら「いまどうしているか」。
       設備より先に見る＝設備の上に立っている人を拾えるようにするため。
       章がフックを持たなければ、この分岐ごと素通りする＝第1章は何も変わらない */
    if (hasHook('custTap')) {
      const view = (G.viewF >= 0 ? G.viewF : G.actF) | 0;
      const tx = t.x * T + T / 2, ty = t.y * T + T / 2;
      /* **1マスぴったりでは当たらない。**人は歩いていて、マスの間にいることのほうが多い。
         タップした点にいちばん近い人を、1マス強の範囲から拾う */
      let hit = null, best = T * 1.1;
      const people = G.customers.concat(
        G.staff.filter(workerHere),
        (G.player && onDuty()) ? [G.player] : []);
      for (const c of people) {
        if ((c.f | 0) !== view) continue;
        const d = Math.hypot(c.px - tx, c.py - ty);
        if (d < best) { best = d; hit = c; }
      }
      /* false が返る＝**同じバイトを2度叩いた**＝札から先へ進む合図。
         そのときは章の側が給料パネルを開いているので、ここは何もしない */
      if (chHook('custTap', hit)) return;
    }
    // フェーズ3：働いているスタッフをタップ→給料変更・クビのパネル
    const st = G.staff.find(s => { if (!workerHere(s)) return false; const tt = tileOf(s); return tt.x === t.x && tt.y === t.y; });
    if (st && st.emp) { openStaffPanel(st.emp); return; }
    const it = equipAt(t.x, t.y);
    if (it && chHook('equipTap', it)) return;
    if (it) selectEquip(it); else deselect();
  }
});

/* ============ バイト（フェーズ3：求人・面接・給料・クビ） ============ */
/* スキルの並び。第2章は【料理】が4つ目に付く（CONF.staffSkills で章ごとに差し替え） */
const SKILL_LABEL = { maji: '真面目', spd: 'スピード', aiso: '愛想', ryori: '料理' };
function skillLine(p) {
  return (CONF.staffSkills || ['maji', 'spd', 'aiso'])
    .map(k => `${SKILL_LABEL[k] || k}${'★'.repeat(p[k] || 0)}`).join('　');
}
/* 性別（第2章だけ意味を持つ＝女湯に立てるのは女性だけ）。第1章は何も出さない */
function sexTag(p) {
  if (!CONF.staffRooms || !p.sex) return '';
  return p.sex === 'f' ? '<span class="sex-f">♀</span>' : '<span class="sex-m">♂</span>';
}
function staffFace(p) { return (CONF.staffRooms && p.sex === 'f') ? '👩‍🔧' : '🧑‍🔧'; }
/* いまの持ち場の名前 */
function staffAreaName(emp) {
  if (!CONF.staffRooms || emp.f == null) return '';
  const a = (CONF.areas || [])[emp.f | 0];
  return a ? a.name : '';
}
/* 求人広告の翌朝：プールから未採用の3人を引いて面接モーダルを開く */
let jobHiredThisRound = 0;   // この面接で何人採用したか（閉じるボタンの文言と、0人で閉じる時の確認に使う）
let jobCloseAsked = false;   // 「誰も採らずに閉じる？」を一度聞いたか（面接のたびに false へ戻す）
/* 閉じるボタンの文言は採用人数で変わる（作者指定）＝0人なら「今回は見送る」、1人以上なら「○人採用する」 */
function updateJobCloseBtn() {
  $('btnJobClose').textContent = jobHiredThisRound ? `${jobHiredThisRound}人採用する` : '今回は見送る';
}
/* 面接の中の「どこに立たせるか」。空いている部屋を先に、詰まっている部屋は灰色で出す。
   女湯は女性の応募者にしか出さない（立てないので） */
let jobPost = {};                      // pid → 選んだ持ち場
function renderJobPost(box, p) {
  if (!box) return;
  const areas = CONF.areas || [];
  const cands = [];
  areas.forEach((a, f) => {
    if (a.home) return;
    if (a.sex === 'f' && p.sex !== 'f') return;                     // 女湯は女性だけ
    if (chHook('canStaffArea', p, f) === false) return;             // 章のほうにも門番があれば
    const desk = f === playerArea();
    /* ⚠ ここは**1部屋1人**の前提のままだった（`G.roster.find` で1人でも見つかれば選べない）。
       階ごとに枠が2つになった日から、**1人立っているだけでその部屋が選べなく**なっていた。
       枠の数（`a.staffMax`）で数える＝バイト管理画面と同じ勘定にする */
    const max = a.staffMax || 1;
    const used = G.roster.filter(e => e.f != null && (e.f | 0) === f).length
               + (chHook('areaExtraWorker', f) | 0);               // 章の立ち手（第2章＝主人公と妻）も枠を使う
    cands.push({ f, name: a.name, used, max, full: used >= max, desk });
  });
  if (jobPost[p.pid] === undefined) {
    const free = cands.find(c => !c.full && !c.desk) || cands.find(c => !c.full);
    jobPost[p.pid] = free ? free.f : null;
  }
  box.innerHTML = '<span class="job-post-h">立たせる部屋</span>' + cands.map(c =>
    `<button class="opt-btn ${jobPost[p.pid] === c.f ? 'on' : ''}"${c.full ? ' disabled' : ''} data-f="${c.f}">${
      c.name}（${c.used}／${c.max}人${c.desk && !c.used ? '・番台の2人目' : ''}）</button>`).join('');
  box.querySelectorAll('button').forEach(b => {
    b.onclick = (ev) => { ev.stopPropagation(); jobPost[p.pid] = +b.dataset.f; renderJobPost(box, p); };
  });
}

function openJobModal() {
  jobPost = {};
  // 面接に来る人数は章が決める（第2章＝野毛で飲んだぶんだけ、来る顔ぶれが増える）
  const poolN = chHook('jobPoolN') || 3;
  const pool = STAFF_POOL.filter(p => !G.roster.some(e => e.pid === p.pid))
    .sort(() => Math.random() - 0.5).slice(0, poolN);
  if (!pool.length) { toast('応募が来なかった…（もう街に人材がいない）'); return; }
  jobHiredThisRound = 0;
  jobCloseAsked = false;      // 面接ごとに聞き直す
  updateJobCloseBtn();
  G.paused = true;
  $('jobNote').innerHTML = `求人広告を見て、${pool.length}人が面接に来た。雇うのは<b>${CONF.maxStaff}人まで</b>（現在${G.roster.length}人）。<br>日給はスペックで決まる。見送った人はもう来ない。`;
  const list = $('jobList');
  list.innerHTML = '';
  for (const p of pool) {
    const div = document.createElement('div');
    div.className = 'senden-item';
    /* 第2章は「どこに立たせるか」を採用と同時に決める（作者指定の流れ）。
       部屋に人がいないと客が使えないので、雇う理由はいつも「あの部屋を開けたい」だから */
    const nightTag = p.night ? '<span class="sm-night">🌙深夜可</span>' : '';
    div.innerHTML = `<span>${staffFace(p)}</span><div><b>${p.name}</b>${sexTag(p)}${nightTag}　<span class="shop-price">日給${yen(staffWageOf(p))}</span><br>
      <span class="shop-desc">${skillLine(p)}<br>${p.desc}</span>
      ${CONF.staffRooms ? `<div class="job-post" data-pid="${p.pid}"></div>` : ''}</div>
      <button class="opt-btn job-hire">採用</button>`;
    if (CONF.staffRooms) renderJobPost(div.querySelector('.job-post'), p);
    const hireBtn = div.querySelector('.job-hire');
    hireBtn.onclick = (ev) => {
      ev.stopPropagation();
      if (G.roster.length >= CONF.maxStaff) { toast(`スタッフは${CONF.maxStaff}人まで`); return; }
      const emp = { pid: p.pid, name: p.name, sex: p.sex, age: p.age, night: p.night, maji: p.maji, spd: p.spd, aiso: p.aiso, ryori: p.ryori, desc: p.desc,
        wage: staffWageOf(p), days: 0, skill: 30 + (p.maji + p.spd + p.aiso) * 2, sulk: false, raiseAsk: false, raiseAmt: 0, raiseNo: 0 };
      // 第2章：面接の場で選んだ部屋にそのまま立たせる（あとで【👥 バイト】から動かせる）
      if (CONF.staffRooms) emp.f = jobPost[p.pid] != null ? jobPost[p.pid] : chHook('staffAreaOf', emp);
      G.roster.push(emp);
      // 採用したその日から働く（営業中なら今すぐ出勤）
      if (G.phase === 'biz') G.staff.push(makeStaff(G.roster.length - 1));
      jobHiredThisRound++;
      updateJobCloseBtn();
      const post = CONF.staffRooms ? staffAreaName(emp) : '';
      log(`🧑‍🔧 ${p.name}を採用した（日給${yen(staffWageOf(p))}${post ? `／${post}` : ''}）`);
      toast(post ? `🧑‍🔧 ${p.name}を${post}へ` : `🧑‍🔧 ${p.name}を採用した！`);
      // 誰かが埋まったので、まだ選んでいない応募者の選択肢を引き直す
      list.querySelectorAll('.job-post').forEach(el => {
        const q = pool.find(x => x.pid === el.dataset.pid);
        if (q && !G.roster.some(e => e.pid === q.pid)) renderJobPost(el, q);
      });
      div.classList.add('done');
      hireBtn.disabled = true;
      div.querySelectorAll('.job-post button').forEach(b => b.disabled = true);
      saveGame();
    };
    list.appendChild(div);
  }
  $('staffModal').classList.add('hidden');
  $('jobModal').classList.remove('hidden');
}

/* ============ バイト管理ページ（第2章）============
   部屋が5つあって、誰がどこに立っているかで**店の開いている範囲が変わる**。
   マップ上の人をひとりずつタップして確かめるのでは追えないので、一覧で持つ。

     ・部屋ごとに、誰が立っているか（空いている部屋は「利用不可」と出る）
     ・その人の4スキル・日給・勤続・機嫌
     ・押せば持ち場を移せる。名前を押せば給料とクビ
     ・下から求人広告を出せる                                            */
function openStaffMgr() {
  if (!CONF.staffRooms) return;
  G.paused = true;
  smPickF = null;                       // 前に開いた【＋】は畳んでおく
  /* **先に出してから描く。** 隠れたままの器に描くと、renderStaffMgr が
     「表示されているほう」＝【運営】タブの器を選んでしまう */
  $('staffMgrModal').classList.remove('hidden');
  renderStaffMgr();
}
/* 章ごとのタブに置いた器は、**表示されているときだけ**使う（隠れた器に描かない） */
function paneIfShown(id) {
  const el = document.getElementById(id);
  return (el && el.isConnected && !el.closest('.hidden')) ? el : null;
}
/* いま【＋】を開いている階（開いていなければ null）。
   人を選ぶ画面を別に作らず、その階の枠の下にそのまま開く＝**どこに立たせる話なのか**が
   画面から消えない（別モーダルにすると、選んでいる最中に階が見えなくなる） */
let smPickF = null;
/* 部屋ぜんぶの枠の数（＝立てる場所の数）。雇える人数（CONF.maxStaff）とは別物 */
function staffSlotsTotal() {
  return (CONF.areas || []).reduce((n, a) => n + (a && !a.home ? (a.staffMax || 1) : 0), 0);
}
function staffSlotsUsed() {
  let n = G.roster.filter(e => e.f != null).length;
  // 章の立ち手（第2章＝妻）も枠を1つ使う
  (CONF.areas || []).forEach((a, f) => { if (a && !a.home) n += (chHook('areaExtraWorker', f) | 0); });
  return n;
}
function renderStaffMgr() {
  /* **【運営】タブの中と、独立したモーダルの両方から呼ばれる。**
     ⚠ 以前はいつも【運営】のタブを先に見ていたので、**運営メニューを
     バイトのタブで開いたまま案内図の警告を叩く**と、中身がそちらへ描かれて
     独立したモーダルは空のまま開いた＝**題名と「📰 求人広告を出す」しか出ない**。
     「バイトを押すと求人広告が出る」の正体はこれ。
     自分のモーダルが出ているときは、必ず自分の中に描く                     */
  /* ⚠ **「見えているか」で選んではいけない**（作者報告 8/8）。
     【運営】は `renderManage()` →**そのあと**モーダルを開く順なので、
     描く時点ではタブの枠はまだ見えていない＝`paneIfShown` が null を返し、
     中身がまるごと第1章側のモーダル（staffMgrBody）へ流れていた。
     結果、第2章の【バイト】タブには「📰 求人広告を出す」しか出ない
     （＝作者の言う「バイトを押すと1章の画面になる」）。

     `staffMgrPane` は **`renderManage` がバイトのタブを描いたときにだけ在る**
     ＝在れば必ずそちらが宛先。第1章はこの枠を作らないので、いつもどおり
     `staffMgrBody` に描かれる（実測で確認）                                  */
  const pane = document.getElementById('staffMgrPane');
  const box = (pane && pane.isConnected) ? pane : $('staffMgrBody');
  if (!box) return;
  const rows = [];
  const areas = CONF.areas || [];
  const wages = G.roster.reduce((a, e) => a + (e.wage || 0), 0);
  const free = G.roster.filter(e => e.f == null);

  /* 上の一行は**2つの数を別々に**出す（作者指定 8/7）。
     ・雇っている人数 … CONF.maxStaff まで
     ・立てる枠　　　 … 建っている階ぶん（増築すると増える）
     ここを1つにまとめていたので、「8人まで雇えるのに枠が3つしかない」ことが
     どこにも出ていなかった */
  rows.push(`<p class="modal-note">部屋に人がいないと、客はそこを使えない。<br>
    雇っている <b>${G.roster.length}／${CONF.maxStaff}人</b>　・
    立てる枠 <b>${staffSlotsUsed()}／${staffSlotsTotal()}</b>　・
    人件費 <b>${yen(wages)}</b>／日</p>`);
  // 章が「バイト以外の立ち手」を持っていれば、その持ち場をここで選ばせる（第2章＝妻）
  rows.push(chHook('staffMgrTop') || '');

  areas.forEach((a, f) => {
    if (a.home) return;
    const isDesk = f === playerArea();
    const here = G.roster.filter(e => e.f != null && (e.f | 0) === f);
    const max = a.staffMax || 1;
    /* 章の立ち手（第2章＝妻）も**バイトと同じ扱い**（作者指定 8/7）＝
       その階の1枚として並び、枠も1つ使う。上に独立した欄は作らない */
    const extra = chHook('areaStaffCard', f) || '';
    const used = here.length + (chHook('areaExtraWorker', f) | 0);
    const open = Math.max(0, max - used);
    const closed = !isDesk && !used;
    /* 空いている枠は**空いたまま描く**（作者指定 8/7）。
       押せば、そこに立たせる人を選べる＝「枠が余っている」ことが絵で分かる */
    const slots = [];
    for (let i = 0; i < open; i++) {
      const on = smPickF === f && i === 0;   // 開いているのは先頭の枠（一覧はその下に出る）
      slots.push(`<button class="sm-slot${on ? ' on' : ''}" data-f="${f}">${on ? '×' : '＋'}<span>${
        on ? '閉じる' : 'スタッフを配置'}</span></button>`);
    }
    rows.push(`<div class="sm-area${closed ? ' closed' : ''}">
      <div class="sm-area-h"><b>${a.name}</b>
        <span class="${closed ? '' : open ? 'sm-free' : 'sm-full'}">${
          closed ? '🚫 利用不可' : `${used}／${max}人`}</span></div>
      ${isDesk && !here.length ? '<p class="sm-note">主人公が番台で会計をしている。バイトを足せば、掃除と客あしらいが回る</p>' : ''}
      ${chHook('staffAreaNote', f, here) || ''}
      ${extra}
      ${here.map(e => staffCard(e)).join('')}
      ${slots.join('')}
      ${smPickF === f ? staffPickList(f) : ''}
    </div>`);
  });

  if (free.length) rows.push(`<div class="sm-area"><div class="sm-area-h"><b>持ち場なし</b>
    <span>${free.length}人</span></div>
    <p class="sm-note">給料は出ているが、どの部屋も開けていない</p>
    ${free.map(e => staffCard(e)).join('')}</div>`);

  box.innerHTML = rows.join('');
  // data-i を持たない札（章の立ち手＝妻）は、章のほうが繋ぐ
  box.querySelectorAll('.sm-card[data-i]').forEach(el => {
    el.onclick = () => { $('staffMgrModal').classList.add('hidden'); openStaffPanel(G.roster[+el.dataset.i]); };
  });
  box.querySelectorAll('.sm-slot').forEach(el => {
    el.onclick = () => { const f = +el.dataset.f; smPickF = (smPickF === f) ? null : f; renderStaffMgr(); };
  });
  box.querySelectorAll('.sm-pick').forEach(el => {
    el.onclick = () => {
      const e = G.roster[+el.dataset.i], f = +el.dataset.f;
      e.f = f; chHook('onStaffPost', e, f);
      smPickF = null; saveGame(); renderStaffMgr();
    };
  });
  /* 【＋】を開いたのに立たせられる人がいない、という行き止まりを作らない＝
     その場から求人を出せるようにしておく（下の【運営】タブのボタンと同じ処理） */
  const jb = box.querySelector('.sm-hire');
  if (jb) jb.onclick = () => {
    if (G.jobAdDay) return;
    if (G.cash < 50000) { toast('広告費が足りない'); return; }
    G.cash -= 50000; G.jobAdDay = G.day + 2;
    log('📰 求人広告を出した（' + yen(50000) + '）。2日後の朝、応募が来る');
    toast('📰 求人広告を出した');
    smPickF = null; updateTopbar(); saveGame(); renderStaffMgr();
  };
  chHook('staffMgrBind', box);          // 章が足したボタンを繋ぎ直す（innerHTML で消えるため）
}
/* 【＋】を押したときに開く、その階に立たせられる人の一覧。
   **持ち場なしの人が先、他の階から動かす人が後**（動かせば、その階が1人減る） */
function staffPickList(f) {
  const a = (CONF.areas || [])[f] || {};
  const ok = e => chHook('canStaffArea', e, f) !== false;
  const free = G.roster.filter(e => e.f == null && ok(e));
  const move = G.roster.filter(e => e.f != null && (e.f | 0) !== f && ok(e));
  const row = (e, sub) => `<button class="sm-pick" data-i="${G.roster.indexOf(e)}" data-f="${f}">
    <span class="sm-face">${staffFace(e)}</span>
    <div><b>${e.name}</b>${sexTag(e)}${e.night ? '<span class="sm-night">🌙深夜可</span>' : ''}
      <span class="shop-price">${yen(e.wage)}</span><br>
      <span class="shop-desc">${skillLine(e)}${sub ? `<br>${sub}` : ''}</span></div></button>`;
  const out = [];
  // 章の立ち手（第2章＝妻）も、ここに同じ形で並ぶ。彼女もどこかの階から動いてくる
  const ex = chHook('extraPickRows', f) || '';
  if (free.length) out.push(free.map(e => row(e, null)).join(''));
  if (ex || move.length) out.push(`<p class="sm-note">ほかの階から動かす</p>` + ex
    + move.map(e => row(e, `いまは ${staffAreaName(e)}`)).join(''));
  if (!ex && !free.length && !move.length) {
    /* 立たせられる人が1人もいない。**なぜ居ないのか**で言い分ける＝
       「雇えないのか」「女湯だから駄目なのか」が分からないまま止まらせない */
    const why = a.femaleOnly
      ? `${a.name}に立てるのは女性だけ。いま動かせる女性がいない`
      : G.roster.length >= CONF.maxStaff
      ? `バイトは上限の${CONF.maxStaff}人。誰かを他の階から動かすしかない`
      : '立たせられる人がいない';
    out.push(`<p class="sm-note">${why}</p>`);
  }
  if (G.roster.length < CONF.maxStaff) {
    out.push(G.jobAdDay
      ? `<p class="sm-note">📰 求人を出している（2日後の朝、応募が来る）</p>`
      : `<button class="opt-btn sm-hire">📰 求人広告を出す（${yen(50000)}）</button>`);
  }
  return `<div class="sm-picker">${out.join('')}</div>`;
}
/* 一覧に並ぶ1枚。押すと個別パネル（給料・持ち場・クビ）へ */
function staffCard(e) {
  const i = G.roster.indexOf(e);
  const mood = e.sulk ? '<span class="sm-sulk">😾</span>' : '';
  const night = e.night ? '<span class="sm-night">🌙深夜可</span>' : '';
  return `<div class="sm-card" data-i="${i}">
    <span class="sm-face">${staffFace(e)}</span>
    <div><b>${e.name}</b>${sexTag(e)}${mood}${night}
      <span class="shop-price">${yen(e.wage)}</span><br>
      <span class="shop-desc">${skillLine(e)}<br>勤続${e.days || 0}日／働きぶり${e.skill || 40}</span></div>
    <span class="sm-go">›</span></div>`;
}

/* スタッフ個別パネル：給料変更（500円単位）とクビ */
function openStaffPanel(emp) {
  if (!G.roster.includes(emp)) return;
  G.paused = true;
  $('staffTitle').textContent = `${staffFace(emp)} ${emp.name}`;
  const mood = emp.sulk ? '／😾ふてくされ中（給料を上げれば機嫌が直る）' : '';
  const post = CONF.staffRooms ? `<br>持ち場 <b>${staffAreaName(emp) || '（未定）'}</b>` : '';
  $('staffInfo').innerHTML = `${emp.desc}${sexTag(emp)}<br>${skillLine(emp)}<br>` +
    `日給 <b>${yen(emp.wage)}</b>／働きぶり ${emp.skill}／勤続${emp.days || 0}日${mood}${post}`;
  const box = $('staffActions');
  box.innerHTML = '';

  /* 第2章：持ち場を選ぶ。**その部屋に人がいないと、客は入れない。**
     女湯には女性しか立てない。すでに誰かが立っている部屋は選べない（1部屋1人） */
  if (CONF.staffRooms) {
    const posts = document.createElement('div');
    posts.className = 'post-pick';
    posts.innerHTML = '<p class="modal-note">持ち場（この部屋を開けられる）</p>';
    (CONF.areas || []).forEach((a, f) => {
      if (a.home) return;                                      // 家だけは持ち場にならない
      const b = document.createElement('button');
      b.className = 'opt-btn' + (emp.f === f ? ' on' : '');
      /* ロビーだけは主人公と2人で立てる（番台の2人目・掃除・券売機の案内）。
         ほかの部屋は1部屋1人＝すでに誰か立っていれば選べない */
      /* 部屋ごとに立てる人数（区画データの staffMax）。
         食堂だけ4人＝調理2＋ホール2（作者指定）。書いていない部屋は1人 */
      const desk = f === playerArea();
      const max = a.staffMax || 1;
      const here = G.roster.filter(e => e !== emp && e.f != null && (e.f | 0) === f);
      const full = here.length >= max;
      const ok = chHook('canStaffArea', emp, f) !== false;
      b.textContent = a.name + (max > 1 ? `（${here.length + (emp.f === f ? 1 : 0)}／${max}人）`
                                        : here.length ? `（${here[0].name}）` : '');
      b.disabled = (full && emp.f !== f) || !ok;
      if (!ok) b.title = '女湯に立てるのは女性だけ';
      b.onclick = () => { emp.f = f; chHook('onStaffPost', emp, f); saveGame(); openStaffPanel(emp); };
      posts.appendChild(b);
    });
    box.appendChild(posts);

    /* その部屋に役割があるなら選ばせる（食堂＝調理／ホール）。
       **「調理担当をどこで決めるのか分からない」** という詰まり方をしていたので、
       持ち場のすぐ下に、同じ形のボタンで並べる                              */
    const a = (CONF.areas || [])[emp.f | 0];
    if (emp.f != null && a && a.jobs) {
      const jw = document.createElement('div');
      jw.className = 'post-pick';
      jw.innerHTML = `<p class="modal-note">役割（${a.name}）</p>`;
      for (const [key, label, cap] of a.jobs) {
        const n = G.roster.filter(e => e !== emp && (e.f | 0) === (emp.f | 0)
                                    && (e.job || a.jobs[0][0]) === key).length;
        const b2 = document.createElement('button');
        b2.className = 'opt-btn' + ((emp.job || a.jobs[0][0]) === key ? ' on' : '');
        b2.textContent = `${label}（${n + ((emp.job || a.jobs[0][0]) === key ? 1 : 0)}／${cap}人）`;
        b2.disabled = n >= cap && (emp.job || a.jobs[0][0]) !== key;
        b2.onclick = () => { emp.job = key; saveGame(); openStaffPanel(emp); };
        jw.appendChild(b2);
      }
      box.appendChild(jw);
    }
  }

  const wrap = document.createElement('div');
  wrap.className = 'loan-actions';
  const bDown = document.createElement('button'); bDown.className = 'big-btn'; bDown.textContent = '💴 −¥500';
  const bUp = document.createElement('button'); bUp.className = 'big-btn'; bUp.textContent = '💴 ＋¥500';
  bDown.onclick = () => { emp.wage = Math.max(5000, emp.wage - 500); saveGame(); openStaffPanel(emp); };
  bUp.onclick = () => {
    emp.wage = Math.min(20000, emp.wage + 500);
    if (emp.sulk) { emp.sulk = false; toast(`${emp.name}の機嫌が直った`); }
    saveGame(); openStaffPanel(emp);
  };
  wrap.appendChild(bDown); wrap.appendChild(bUp);
  box.appendChild(wrap);
  const bFire = document.createElement('button'); bFire.className = 'big-btn danger'; bFire.textContent = '🗑 クビにする…';
  bFire.onclick = () => {
    // 確認画面（作者指定）。押し間違いで即クビは事故のもと
    box.innerHTML = `<p class="modal-note">本当に${emp.name}をクビにする？　言い渡したら、今日のうちに帰ってしまう。</p>`;
    const yes = document.createElement('button'); yes.className = 'big-btn danger'; yes.textContent = 'クビにする';
    yes.onclick = () => {
      const i = G.roster.indexOf(emp);
      if (i >= 0) G.roster.splice(i, 1);
      G.staff = G.staff.filter(s => s.emp !== emp);
      log(`🗑 ${emp.name}をクビにした`);
      toast(`${emp.name}は帰っていった…`);
      $('staffModal').classList.add('hidden');
      G.paused = false;
      saveGame();
    };
    const no = document.createElement('button'); no.className = 'big-btn'; no.textContent = 'やめておく';
    no.onclick = () => openStaffPanel(emp);
    box.appendChild(yes); box.appendChild(no);
  };
  box.appendChild(bFire);
  $('btnStaffClose').style.display = '';
  $('staffModal').classList.remove('hidden');
}

/* 夜の賃上げ相談（closeDayでraiseAskが立った子から順に）。断ると辞めるか、ふてくされる */
function maybeStaffRaise() {
  // 相談は1日ひとりまで（作者指定）。2人が同じ夜に並んで頼みに来ると、断る側が理不尽になる
  if (G.flags.raiseDay === G.day) return;
  const emp = G.roster.find(e => e.raiseAsk);
  if (!emp) return;
  G.flags.raiseDay = G.day;
  emp.raiseAsk = false;
  const amt = emp.raiseAmt || 300;              // 要求額は¥100〜¥500（作者指定）
  const noCount = emp.raiseNo || 0;             // ここまで連続で断った回数（3回で辞める）
  // 何度も断られている子は、言い方に諦めがにじむ
  const plea = noCount === 0 ? `「あの…だいぶ仕事にも慣れてきたので、日給を<b>${yen(amt)}</b>上げてもらえませんか…」`
    : noCount === 1 ? `「この前の話なんですけど……日給、<b>${yen(amt)}</b>だけでも上げてもらえませんか」`
    : `「……もう一度だけ聞きます。日給、<b>${yen(amt)}</b>。これで駄目なら、俺、考えます」`;
  $('staffTitle').textContent = `🧑‍🔧 ${emp.name}の相談`;
  $('staffInfo').innerHTML = `閉店後、${emp.name}が番台の前でもじもじしている。<br><br>` + plea + '<br>' +
    `（いま日給${yen(emp.wage)}／働きぶり${emp.skill}／勤続${emp.days}日）`;
  const box = $('staffActions');
  box.innerHTML = '';
  const ok = document.createElement('button'); ok.className = 'big-btn'; ok.textContent = `💴 上げてやる（日給${yen(emp.wage + amt)}へ）`;
  ok.onclick = () => {
    emp.wage += amt;
    emp.raiseNo = 0;                             // 応じたら「連続で断った回数」はリセット
    log(`💴 ${emp.name}の日給を${yen(emp.wage)}に上げた`);
    toast(`${emp.name}はうれしそうだ`);
    $('staffModal').classList.add('hidden');
    saveGame(); maybeStaffRaise();
  };
  const ng = document.createElement('button'); ng.className = 'big-btn danger'; ng.textContent = '💨 今は無理だ（拒否）';
  ng.onclick = () => {
    $('staffModal').classList.add('hidden');
    emp.raiseNo = noCount + 1;
    // 3回続けて断ると辞める。それ以外は50%の確率でふてくされる（＝働きぶり↓）（作者指定）
    if (emp.raiseNo >= 3) {
      const i = G.roster.indexOf(emp);
      if (i >= 0) G.roster.splice(i, 1);
      log(`💨 ${emp.name}が辞めてしまった…`);
      toast(`${emp.name}が辞めてしまった…`);
    } else if (Math.random() < 0.5) {
      emp.sulk = true;
      log(`😾 賃上げを断った。${emp.name}はふてくされてしまった（働きぶり↓）`);
      toast(`${emp.name}はふてくされてしまった…（働きぶり↓）`);
    } else {
      // あと何回で辞めるかは、あえて知らせない（作者指定）。伝えるのは働きぶりのことだけ
      log(`🤐 賃上げを断った。${emp.name}は黙って引き下がった`);
      toast(`${emp.name}は黙って引き下がった`);
    }
    saveGame(); maybeStaffRaise();
  };
  box.appendChild(ok); box.appendChild(ng);
  $('btnStaffClose').style.display = 'none';   // 相談は逃げられない（返事をするまで閉じない）
  $('staffModal').classList.remove('hidden');
}

/* ============ セーブ ============ */
/* セーブ先は章ごとに別（js/chapter.js の saveKey()）。
   第1章のセーブは第2章から見えないし、上書きもされない。
   SAVE_KEY は昔のコードが参照していた名残（＝第1章のキーそのもの）として残してある */
const SAVE_KEY = 'orenoSauna_v1';
function saveGame() {
  const data = {
    day: G.day, cash: G.cash, debt: G.debt, rep: G.rep, name: G.name,
    loanPending: G.loanPending, loanArrive: G.loanArrive, loanInToday: G.loanInToday || 0, profitStreak: G.profitStreak,
    ceilHist: G.ceilHist || [], satHist: G.satHist || [], repHist: G.repHist || [], repBonus: G.repBonus || 0,
    flags: G.flags, seenEq: G.seenEq, dirts: G.dirts, junk: G.junk, stam: G.stam, opts: G.opts, staffCount: G.staffCount, kito: G.kito,
    tadokoro: G.tadokoro, kuroda: G.kuroda, reina: G.reina, yami: G.yami, najimi: G.najimi, oyajiRel: G.oyajiRel,
    lastWorthFee: G.lastWorthFee, lastWorthSauna: G.lastWorthSauna,
    recentProfits: G.recentProfits, recentUtil: G.recentUtil, recentGripes: G.recentGripes, recentSegSat: G.recentSegSat, roughDays: G.roughDays,
    lastShortfallDay: G.lastShortfallDay, solved: G.solved,
    invBuy: G.invBuy, invMove: G.invMove, invSell: G.invSell, invFix: G.invFix,
    cashAtDayStart: G.cashAtDayStart, regulars: G.regulars, careNext: G.careNext, careCount: G.careCount, careAmt: G.careAmt,
    tadokoroPenaltyUntil: G.tadokoroPenaltyUntil,
    roster: G.roster, jobAdDay: G.jobAdDay, nappa: G.nappa, premium: G.premium,
    ch2: G.ch2,                    // 第2章の開業状況（第1章のセーブには入らない）
    // f＝その設備がある区画（第1章は全部0）
    equip: G.equip.map(e => ({ id: e.id, x: e.x, y: e.y, rot: e.rot || 0, cond: e.cond, f: e.f | 0, temp: e.temp, fault: e.fault })),
  };
  try { localStorage.setItem(saveKey(), JSON.stringify(data)); } catch (e) {}
}
function loadGame() {
  try {
    const d = JSON.parse(localStorage.getItem(saveKey()));
    if (!d) return false;
    Object.assign(G, { day: d.day, cash: d.cash, debt: d.debt, rep: d.rep, name: d.name, flags: d.flags || {}, seenEq: d.seenEq || {}, dirts: d.dirts || [], junk: d.junk || [], stam: d.stam ?? null });
    // 融資の新システム（旧セーブには無い＝振込待ちなし。旧debtはそのまま「残り返済額」として引き継ぐ）
    G.loanPending = d.loanPending || 0; G.loanArrive = d.loanArrive || 0; G.loanInToday = d.loanInToday || 0; G.profitStreak = d.profitStreak || 0;
    G.ceilHist = Array.isArray(d.ceilHist) ? d.ceilHist : [];   // 評判の行き先の直近履歴（旧セーブは空でOK＝初日から積み直す）
    G.satHist = Array.isArray(d.satHist) ? d.satHist : [];      // 直近5日の満足度（おもてなし点のもと）
    // 新評判システム：直近7日ぶんの10項目の採点と、物語の出来事ぶんの加減点
    // （旧セーブには無い＝空から積み直す。8日目以降なら、その日の営業が1日ぶん入った時点で数字が出そろう）
    G.repHist = Array.isArray(d.repHist) ? d.repHist : [];
    G.repBonus = d.repBonus || 0;
    G.opts = { ...DEFAULT_OPTS, ...(d.opts || {}) };
    G.staffCount = d.staffCount || 0;
    // フェーズ3：バイトは名簿制。旧セーブ（人数だけ）は、プール先頭から同じ人数を勤続扱いで移行する
    G.roster = Array.isArray(d.roster) ? d.roster
      : STAFF_POOL.slice(0, G.staffCount).map(p => ({ pid: p.pid, name: p.name, maji: p.maji, spd: p.spd, aiso: p.aiso,
          desc: p.desc, wage: staffWageOf(p), days: 5, skill: 50, sulk: false, raiseAsk: false, raiseAmt: 0, raiseNo: 0 }));
    G.jobAdDay = d.jobAdDay || 0;
    G.nappa = d.nappa || null;
    /* 第2章の開業状況。第1章のセーブには無いので null のまま＝何も変わらない。
       第2章のセーブなのに入っていない（開業フローより前に作った）ときは、開業済みとして読む */
    G.ch2 = d.ch2 || chHook('legacyCh2') || null;
    /* 課金コンテンツ（オート修理）は章をまたいで共有する＝正はセーブの中ではなく localStorage の共有キー。
       共有キーがまだ無い旧セーブだけ、中の記録を共有キーへ引き上げる（すでに買った人が失わないように） */
    migratePremiumFromSave(d.premium);
    G.premium = loadPremium();
    G.kito = { ...newKito(), ...(d.kito || {}) };
    G.tadokoro = { ...newTadokoro(), ...(d.tadokoro || {}) };
    /* 名乗ったのに次の来訪が先すぎるセーブを引き上げる。旧版は名乗りの2〜4日後を予約していて、
       最悪4日ぶん「田所が出てこない日」が続いた。読み込み時に翌日へ寄せて待ちを解消する */
    if (G.tadokoro.hello && !G.tadokoro.met && (G.tadokoro.nextDay || 0) > G.day)
      G.tadokoro.nextDay = G.day;
    G.kuroda = { ...newKuroda(), ...(d.kuroda || {}) };
    G.reina = { ...newReina(), ...(d.reina || {}) };
    G.yami = { ...newYami(), ...(d.yami || {}) };
    G.npcs = [];
    G.najimi = d.najimi ?? 8; G.oyajiRel = d.oyajiRel ?? 0;
    G.recentProfits = Array.isArray(d.recentProfits) ? d.recentProfits : [];
    G.recentUtil = Array.isArray(d.recentUtil) ? d.recentUtil : [];
    G.lastWorthFee = d.lastWorthFee ?? null; G.lastWorthSauna = d.lastWorthSauna ?? null;
    G.recentGripes = Array.isArray(d.recentGripes) ? d.recentGripes : [];
    G.recentSegSat = Array.isArray(d.recentSegSat) ? d.recentSegSat : [];
    G.roughDays = d.roughDays || 0;
    G.lastShortfallDay = d.lastShortfallDay || 0;
    // 設備投資の集計と常連の数（旧セーブには無いので0から）
    G.invBuy = d.invBuy || 0; G.invMove = d.invMove || 0; G.invSell = d.invSell || 0; G.invFix = d.invFix || 0;
    G.cashAtDayStart = d.cashAtDayStart ?? d.cash;
    G.regulars = d.regulars || 0; G.plannedGuests = 0; G.stuckLogged = false;
    // 治療費は15日ごと（作者指定＝曜日には揃えない）。旧セーブの次回請求日はそのまま引き継ぐ
    G.careNext = d.careNext ?? (d.day || 1) + CONF.careEvery;
    G.careAmt = d.careAmt || 0;
    G.careCount = d.careCount || 0;
    G.tadokoroPenaltyUntil = d.tadokoroPenaltyUntil || 0;
    refreshDead();      // 古いセーブには“飾り”が残っていることがある
    G.solved = { ...newSolved(), ...(d.solved || {}) };
    if (G.kito.resolved) G.solved.yakuza = true;      // 旧セーブ救済：鬼頭決着済みならヤクザ問題は解決扱い
    if (G.kito.resolved && !G.flags.kitoEndDay) G.flags.kitoEndDay = G.day;   // 起点が無い旧セーブは今日を起点に
    // 旧版の穴の修復：鬼頭との決着前に黒田が登場してしまっていたセーブは、黒田を「未登場」に巻き戻す。
    // 決着が付けば、10日のクールダウンを経て正規の手順で改めて現れる
    if (G.kito && !G.kito.resolved && G.kuroda && G.kuroda.met && !G.kuroda.resolved) G.kuroda = newKuroda();
    if (G.tadokoro.resolved) G.solved.tadokoro = true;
    if (G.kuroda.resolved) G.solved.kuroda = true;
    if (G.reina.resolved && G.reina.ally) G.solved.reina = true;   // 仲間化で解決（売却エンドは ally=false のまま）
    applyArea(0, true);        // 間取り（CONF.W/H）を1つ目の区画に合わせてから設備を読む
    G.equip = d.equip
      .map(e => ID_ALIAS[e.id] ? { ...e, id: ID_ALIAS[e.id] } : e)   // 旧IDを今のIDに読み替える（化粧水→洗面所）
      .filter(e => EQ[e.id])                  // 廃止/未知IDの設備は読み飛ばす（第2章送りのマット系など）
      // 温度を設定できるのはドライサウナだけになったので、
      // 昔のセーブで浴槽・水風呂・ミスト・塩に入っていた設定値は捨てて設備の既定に戻す
      .map(e => ({ uid: ++G.uidN, ...e, rot: e.rot || 0, f: e.f | 0, occ: Array(EQ[e.id].cap).fill(null),
        temp: canSetTemp(EQ[e.id]) ? (e.temp ?? EQ[e.id].temp) : EQ[e.id].temp }));
    /* 化粧水・乳液は1マスだったが、洗面所は2マス。右隣が壁や他の設備で埋まっていると置けないので、
       その場合だけ撤去して代金を返す（黙って消して損をさせない）。
       ※これは第1章の旧セーブを直すための処理。第2章には 'sink' という設備が無いので通さない */
    if (G.chapter === 1) {
    const covers = (o, x, y) => x >= o.x && x < o.x + ew(o.id, o.rot) && y >= o.y && y < o.y + eh(o.id, o.rot);
    // 旧セーブにドライヤーと化粧水の両方があると洗面所が2つできるので、洗面所どうしの重なりも見る
    const others = G.equip.filter(e => e.id !== 'sink'), kept = [];
    G.equip = G.equip.filter(e => {
      if (e.id !== 'sink') return true;
      const busy = (tx) => others.some(o => covers(o, tx, e.y)) || kept.some(o => covers(o, tx, e.y));
      const ok = e.x + 1 <= CONF.W - 2 && !busy(e.x + 1) && !kept.some(o => covers(o, e.x, e.y));
      if (ok) kept.push(e); else G.cash += EQ.sink.price;
      return ok;
    });
    /* トイレを足したのは後からなので、旧セーブには1つも無い（作者指定の初期設備なのに）。
       まだ1つも持っていないセーブにだけ、親父の代からのボットン便所を脱衣所の右下に据える。
       そこが埋まっていたら、脱衣所の空いているマスを1つ借りる */
    if (!G.equip.some(e => TOILET_IDS.includes(e.id))) {
      const taken = (tx, ty) => G.equip.some(o => covers(o, tx, ty));
      let sp = !taken(CONF.W - 2, CONF.H - 2) ? { x: CONF.W - 2, y: CONF.H - 2 } : null;
      for (let y = CONF.H - 2; y >= CONF.divideY && !sp; y--)
        for (let x = CONF.W - 2; x >= 1 && !sp; x--) if (!taken(x, y)) sp = { x, y };
      if (sp) G.equip.push({ uid: ++G.uidN, id: 'toilet_old', x: sp.x, y: sp.y, rot: 0, cond: 35, f: 0,
                             occ: [], temp: undefined, fault: undefined });
    }
    }   // ← 第1章の旧セーブ移行はここまで
    /* 章が「間取りを変えた」ときの引っ越し。**セーブの座標は前の間取りのまま**なので、
       盤面の広さや仕切りの位置を動かした章は、ここで自分のセーブを移し替える。
       フックを持たない章（第1章）は素通り＝1マスも動かない */
    chHook('migrateEquip');
    fixEquipOverlap();
    return true;
  } catch (e) { return false; }
}

/* 設備の大きさを作り替えたときの後始末（作者指定 8/5 の小/中/大ロッカーで実際に起きた）。
   1マスだった品を2マスにすると、**古いセーブでは隣の設備と重なる**。
   重なったまま読むと、通路の判定も客の経路も壊れる（画面では気づけない）。
   ・同じ階で空いている場所へ**そっと動かす**（近いところから探す）
   ・どこにも入らないものだけ**撤去して代金を返す**（黙って消して損をさせない）      */
function fixEquipOverlap() {
  const spanX = e => ew(e.id, e.rot), spanY = e => eh(e.id, e.rot);
  const hit = (a, b) => a.f === b.f && a.x < b.x + spanX(b) && a.x + spanX(a) > b.x
                                    && a.y < b.y + spanY(b) && a.y + spanY(a) > b.y;
  const all = G.equip, placed = [], moved = [], sold = [];
  for (const e of all) {
    if (!placed.some(o => hit(e, o))) { placed.push(e); continue; }
    /* 置き直し先は**本番と同じ判定**（placeCheck）で探す＝浴室のものは浴室、
       脱衣所のものは脱衣所、エレベーターの前は空ける…がそのまま効く。
       判定のあいだだけ G.equip を「すでに確定した分」に差し替える（自分自身とぶつからないように） */
    const back = G.actF;
    G.equip = placed; applyArea(e.f | 0, true);
    let spot = null;
    for (let r = 1; r <= 14 && !spot; r++) {
      for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r && !spot; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = e.x + dx, ny = e.y + dy;
        const c = placeCheck(e.id, nx, ny, null, e.rot || 0);
        if (c && c.ok) spot = { x: nx, y: ny };
      }
    }
    applyArea(back, true); G.equip = all;
    if (spot) { e.x = spot.x; e.y = spot.y; placed.push(e); moved.push(EQ[e.id].name); }
    else { G.cash += eqPrice(e.id); sold.push(EQ[e.id].name); }
  }
  if (moved.length || sold.length) G.equip = placed;
  if (moved.length) log(`🔧 ${[...new Set(moved)].join('・')}の置き場所を直した（大きさが変わったため）`);
  if (sold.length)  log(`📦 ${[...new Set(sold)].join('・')}は置けなくなったので撤去し、代金を返した`);
}

/* ============ ゲーム開始 ============ */
function resetState() {
  applyArea(0, true);          // 章を切り替えた直後は、いつも1つ目の区画から
  Object.assign(G, {
    actF: 0, viewF: 0, day: 1, cash: CONF.startCash, debt: CONF.startDebt, rep: 10,
    name: defaultShopName(),          // 屋号の既定は章ごとに違う
    loanPending: 0, loanArrive: 0, profitStreak: 0, ceilHist: [], satHist: [], repHist: [], repBonus: 0,
    equip: [], dirts: [], junk: [], stam: null, flags: {}, seenEq: {}, adBoost: 0, adBought: {},
    opts: { ...DEFAULT_OPTS }, staffCount: 0, staff: [], roster: [], jobAdDay: 0, nappa: null, paused: false,
    customers: [], payQueue: [], placing: null, selected: null,
    kito: newKito(), tadokoro: newTadokoro(), kuroda: newKuroda(), reina: newReina(), yami: newYami(),
    npcs: [], visitKey: null, visitAt: null, visitFired: false, yamiAt: null, yamiFired: false,
    benz: null, mika: null, mikajimeAt: null, mikaFired: false,
    najimi: 8, oyajiRel: 0, lastWorthFee: null, lastWorthSauna: null, recentProfits: [], recentUtil: [], recentGripes: [], recentSegSat: [], roughDays: 0, riotDone: false,
    lastShortfallDay: 0, solved: newSolved(),
    invBuy: 0, invMove: 0, invSell: 0, invFix: 0, cashAtDayStart: CONF.startCash,
    regulars: 0, plannedGuests: 0, stuckLogged: false, lastTurnedAway: 0,
    /* 「勤務時間の外＝主人公は家にいる」と言ったかどうかの覚え書き（勤務時間のある章だけ使う）。
       ここで消しておかないと、第2章で立ったまま第1章を始めたときに持ち込まれて、
       勤務時間を持たない第1章が CONF.workHours を読みに行って落ちる */
    offDutySaid: false,
    careNext: CONF.careFirstDay, careCount: 0, careAmt: 0, tadokoroPenaltyUntil: 0,
    // 課金コンテンツはニューゲームでも章をまたいでも引き継ぐ（買い直しをさせない）。正は共有キー
    premium: loadPremium(),
  });
  for (const e of INIT_EQUIP)
    G.equip.push({ uid: ++G.uidN, id: e.id, x: e.x, y: e.y, rot: e.rot || 0, cond: e.cond, f: e.f | 0,
                   temp: EQ[e.id].temp, occ: Array(EQ[e.id].cap).fill(null) });
  refreshDead();
  // 初期の汚れ（章ごとに違う。第1章は従来どおり）
  // f＝その汚れがある区画（第1章は全部0）
  G.dirts = chHook('initDirts') || [{ x: 3, y: 3, f: 0 }, { x: 5, y: 5, f: 0 }, { x: 8, y: 6, f: 0 },
             { x: 3, y: 8, f: 0 }, { x: 9, y: 4, f: 0 }, { x: 6, y: 2, f: 0 }];
  // 開店前のゴミ・瓦礫（第2章だけ。マップ上をタップして主人公に運ばせる）
  G.junk = chHook('initJunk') || [];
  restStamina();                     // 体力のある章は満タンから始める
  // 章ごとの開始処理（第2章＝物件の代金を払う）
  G.ch2 = null;
  chHook('onNewGame');
}

function initUI() {
  Story.init();
  /* 課金コンテンツ（オート修理）は章をまたいで共有する。
     セーブを読む前に一度だけ読み込んでおく＝タイトル画面の時点でもう「買ってある」状態になる */
  G.premium = loadPremium();
  // どの章も選ばれていない起動直後は、第1章のデータを入れておく（applyChapter(1) は元の値を入れるだけ）
  applyChapter(1);
  /* タイトル：章の選択 → 章を選ぶと「はじめから／つづきから」を出す。
     セーブがある章では、その下に「はじめからだと消える」という注意書きも出す（作者指定 8/7） */
  const showTitleStart = () => {
    const has = !!localStorage.getItem(saveKey());
    $('btnContinue').classList.toggle('hidden', !has);
    $('newGameWarn').classList.toggle('hidden', !has);
    $('titleChapters').classList.add('hidden');
    $('titleStart').classList.remove('hidden');
  };
  if (localStorage.getItem(saveKey())) $('btnContinue').classList.remove('hidden');
  $('btnChapter1').onclick = () => {
    applyChapter(1);
    showTitleStart();   // その章のセーブがあるときだけ「つづきから」と注意書きを出す（章ごとに別のセーブ）
  };
  /* 第2章のボタン。名前は「いま読み込まれている第2章」から取る（index.html の束を入れ替えれば追従する）。
     第2章の束を1つも読み込んでいないときは CHAPTERS[2] が無い＝ロックしたまま、押しても案内を出すだけ */
  const ch2Name = CHAPTERS[2] ? CHAPTERS[2].name : '第2章';
  $('btnChapter2').onclick = () => toast('「' + ch2Name + '」は近日公開！　いまは第1章をどうぞ');
  /* 【制作中の第2章を見るための入口】
     開発機（このMacの開発サーバー）で開いたときだけ、第2章が押せるようになる。
     配信するアプリ（iOS/Android のビルド）では、今までどおりロックのまま＝
     第1章で遊んでいる人には何も見えない。

     見分け方は「http で・localhost に・ポート番号を付けて」開いているか。
     Capacitor で包んだアプリも中身は localhost を名乗るが、
     ポート番号は付かない（iOS は capacitor:// スキーム）ので、ここには入らない。
     URL に ?ch2 を付ける昔のやり方も、そのまま残してある                        */
  const onDevServer = location.protocol === 'http:'
    && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    && location.port !== '';
  if ((onDevServer || location.search.indexOf('ch2') >= 0) && CHAPTERS[2]) {
    const b = $('btnChapter2');
    b.classList.remove('locked');
    b.innerHTML = ch2Name + '<span class="soon">（制作中）</span>';
    b.onclick = () => { applyChapter(2); showTitleStart(); };
  }
  // 実際にサウナ施設をやっている人向けの案内（施設のゲーム化）。外部サイトを別タブで開く
  $('btnForOwners').onclick = () => window.open(OWNER_LINK, '_blank', 'noopener');
  $('btnChapterBack').onclick = () => {
    $('titleStart').classList.add('hidden');
    $('titleChapters').classList.remove('hidden');
  };
  $('btnNewGame').onclick = () => {
    /* セーブがある章で「はじめから」＝その店は消える（新しい1日目を保存した時点で上書きされる）。
       押す前に、何日目のどの店が消えるのかを見せて確認する（作者指定 8/7）。
       「つづきから」の押し間違いで60日の店を失う、という取り返しのつかない事故を防ぐ。
       **ブラウザの confirm は使わない**（環境によっては何も出さずに false を返す＝
       「はじめから」を押しても始まらない、という別の事故になった。作者報告 8/7） */
    const raw = localStorage.getItem(saveKey());
    if (raw) {
      let d = null; try { d = JSON.parse(raw); } catch (e) { /* 壊れたセーブは中身を出さない */ }
      // 中身が読めた時だけ「何日目のどの店か」を出す（読めない時は言い切らない）
      const what = d && d.name ? `${d.day ? d.day + '日目の' : ''}「${d.name}」のセーブデータ`
                              : 'いまのセーブデータ';
      $('newGameInfo').innerHTML = `${what}は消えます。<br>はじめからやり直しますか？<br><br>`
        + `<span class="opt-sub">続きを遊ぶなら「つづきから」を選んでください。</span>`;
      $('newGameModal').classList.remove('hidden');
      return;
    }
    startNewGame();
  };
  $('btnNewGameNo').onclick = () => $('newGameModal').classList.add('hidden');
  $('btnNewGameYes').onclick = () => { $('newGameModal').classList.add('hidden'); startNewGame(); };
  // 「はじめから」の本体（確認を通ったあと、または消えるセーブが無いとき）
  function startNewGame() {
    $('title').classList.add('hidden');
    resetState();
    const intro = chHook('introStory') || STORY_INTRO;
    // 台本が空のときは物語を飛ばして、いきなり屋号決めへ（制作中の章を何度も通すため）
    if (!intro.length) { openNameModal(); return; }
    Story.play(intro, openNameModal);
  }
  $('btnContinue').onclick = () => {
    if (!loadGame()) { toast('セーブデータが読めなかった'); return; }
    /* 章側が画面遷移まで面倒を見る場合は truthy（第2章：廃業後の再開抑止と
       ED未再生セーブの再生＝ending_y.js）。フックが無い章は従来どおり */
    if (chHook('continueLoaded')) return;
    $('title').classList.add('hidden');
    $('game-ui').classList.remove('hidden');
    enterPrep();
  };
  // 屋号（見出し・説明・候補は章ごとに違う＝openNameModal が組み立てる）
  $('btnNameOk').onclick = () => {
    const v = $('nameInput').value.trim();
    G.name = v || defaultShopName();
    $('nameModal').classList.add('hidden');
    $('game-ui').classList.remove('hidden');
    G.flags.intro = true;
    enterPrep();
    saveGame();
  };
  // 準備アクション
  $('btnOpen').onclick = () => {
    /* 第2章にも【開業準備】のボードは無い（作者指定）＝初日から営業開始。
       ゴミだらけのまま開けてもいい。どうなるかは、その日の客が教えてくれる */
    /* 定休日は店を開けない＝その一日をどう使うかを決める画面へ（第2章）。
       ボタンの文字も【🚪 今日は定休日】に変えてあるので、押し間違いにはならない */
    if (chHook('offDay')) return;
    if (!G.equip.some(e => EQ[e.id].cat === 'locker' && e.cond > 0)) { toast('使えるロッカーがないと開店できない！'); return; }
    if (!(hasCat('furo') || hasCat('sauna'))) { toast('風呂もサウナもない…これでは銭湯じゃない！'); return; }
    deselect(); endPlacing(); G.placing = null;
    G.flags.tut = true;
    startDay();
    saveGame();
  };
  // ☰ メニュー（準備中でも営業中でも、右上からいつでも開ける）
  $('btnMenu').onclick = openMenu;
  // データ（準備中でも営業中でも開ける）
  const openData = () => {
    // 見出しの「夕凪湯の数字」も屋号に合わせる（作者指定）
    $('dataNote').textContent = shopify('いまの夕凪湯の数字。判断に迷ったらここを見ろ。');
    renderData(); openPausedModal('dataModal');
  };
  $('btnData').onclick = openData;
  $('btnDataBiz').onclick = openData;
  $('btnDataClose').onclick = () => closePausedModal('dataModal');
  // 一覧の組み立てで転んでも画面自体は必ず開く（スマホで「押しても広告画面が出ない」報告への対策）
  $('btnSenden').onclick = () => {
    try { renderAds(); } catch (e) { toast('広告の一覧を出せなかった：' + e.message); }
    $('sendenModal').classList.remove('hidden');
  };
  $('btnSendenClose').onclick = () => $('sendenModal').classList.add('hidden');
  // 妻のひと言（第2章）。中身と結果は章のほうが決める
  if ($('btnWifeGo')) $('btnWifeGo').onclick = () => chHook('wifeAnswer', true);
  if ($('btnWifeNo')) $('btnWifeNo').onclick = () => chHook('wifeAnswer', false);
  /* 誰も採らずに閉じようとした時のひと押し。**ブラウザの confirm は使わない**（作者指定 8/7）＝
     環境によっては何も出さずに false を返し、「閉じられない」と受け取られる。
     ここは一度だけ聞いて、もう一度押されたらそのまま閉じる（画面を増やさない） */
  $('btnJobClose').onclick = () => {
    if (!jobHiredThisRound && !jobCloseAsked) {
      jobCloseAsked = true;
      $('btnJobClose').textContent = '本当に採用しない（広告費は戻らない）';
      toast('誰も採用しないなら、もう一度押す');
      return;
    }
    jobCloseAsked = false;
    $('jobModal').classList.add('hidden');
    /* 採った人がいるなら、そのままバイト管理画面へ（作者指定 8/8）＝
       「誰をどこに立たせたか」を、面接のすぐあとに一覧で確かめられる。
       持ち場のない章（第1章）はこの画面を持たないので、これまでどおり閉じて終わり */
    if (jobHiredThisRound && CONF.staffRooms) { openStaffMgr(); return; }
    if (G.phase === 'biz') { G.paused = false; $('btnPause').textContent = '⏸ 一時停止'; }
  };
  $('btnStaffClose').onclick = () => {
    $('staffModal').classList.add('hidden');
    if (G.phase === 'biz') { G.paused = false; $('btnPause').textContent = '⏸ 一時停止'; }
  };
  const openLoan = () => {
    loanHost(null);   // 運営メニューへ貸し出したままなら、必ずモーダルへ返してから開く
    /* 初回だけ、まず信用金庫に断られる場面を挟む（作者指定）。
       「銀行は選択肢にない」ことを説明文ではなく場面で分からせてから、サラ金の欄を見せる */
    /* ただし**銀行が本当に貸してくれる章**（CONF.kouko がある＝第2章）では、この場面は流さない。
       断られる話ではないので、いきなり融資課の欄を開く */
    if (!G.flags.bankIntro && !CONF.kouko) {
      G.flags.bankIntro = true; saveGame();
      Story.play(STORY_BANK_INTRO, () => { renderLoan(); openPausedModal('loanModal'); });
      return;
    }
    renderLoan(); openPausedModal('loanModal');
  };
  $('btnLoan').onclick = openLoan;
  $('btnLoanBiz').onclick = openLoan;   // 営業中も借りられる（運営とデータの間・作者指定）
  // 臨時休業（第2章）。今日を休みにする＝逃げ道はあるが、常連が減って評判も落ちる
  /* 第2章＝【今日は何をする？】をもう一度開く（臨時休業は廃止して、朝の選択に吸収した）。
     第1章はこのフックを持たないので、これまでどおり何も起きない */
  $('btnKyugyo').onclick = () => chHook('offDayAgain') || chHook('kyugyo');
  $('btnOffdayClose').onclick = () => chHook('offdayClose');
  // 第2章の開業準備（第1章では一度も開かない）
  $('btnKaigyoClose').onclick = () => $('kaigyoModal').classList.add('hidden');
  // 第2章の注文（ミッション）
  $('btnMission').onclick = () => {
    const html = chHook('kuwataBoard') || '';
    $('missionBody').innerHTML = html || '<p class="modal-note">いまのところ、誰も何も言ってこない。</p>';
    openPausedModal('missionModal');
  };
  $('btnMissionClose').onclick = () => closePausedModal('missionModal');
  // 第2章のバイト管理
  $('btnStaffMgr').onclick = openStaffMgr;
  $('btnStaffMgrClose').onclick = () => closePausedModal('staffMgrModal');
  $('btnStaffMgrJob').onclick = () => {
    if (G.jobAdDay) { toast('もう求人を出している（2日後の朝に来る）'); return; }
    const cost = 50000;
    if (G.cash < cost) { toast('広告費が足りない'); return; }
    G.cash -= cost; G.jobAdDay = G.day + 2;
    log(`📰 求人広告を出した（${yen(cost)}）。2日後の朝、応募が来る`);
    toast('📰 求人広告を出した');
    closePausedModal('staffMgrModal');
    saveGame();
  };
  $('btnLoanClose').onclick = () => closePausedModal('loanModal');   // 営業中に開いた時は、閉じたら再開する
  /* サラ金は審査なし・即日。10万円刻みで好きな額を、限度100万まで一度に借りられる（作者指定）。
     銀行は廃止したので、ここが唯一の資金調達口。
     限度が低いのが肝＝借金で設備を揃えることはできず、稼いで返すしかない */
  window.doBorrowSarakin = (amount) => {
    const room = CONF.sarakinMax - (G.yami.debt || 0);
    const amt = Math.min(amount, room);
    if (amt < CONF.sarakinUnit) { toast('灰田も、これ以上は貸さないと言った'); return; }
    // 章によっては、ここでも一度止まる（第2章＝サラ金に手を出すことに、妻はいちばん強く反対する）
    if (chHook('askWife', 'sarakin', amt)) return;
    /* 初回は店の前で灰田と会う（全画面シーン）→ その場で受け取る。
       ただし**夕凪湯の場面**なので、第1章の物語を流さない章では出さない（台本ができるまで） */
    if (!G.yami.met && !CONF.noLegacyStory) {
      $('loanModal').classList.add('hidden');
      Story.play(STORY_YAMI_INTRO, () => {
        borrowYami(amt);
        toast(`💳 灰田から ${yen(amt)} 借りた…毎週水曜に集金が来る`);
        updateTopbar();
        // 借りたことは、なぜか親父に伝わっている（初回だけ全画面の小言）
        if (!G.flags.loanNag) { G.flags.loanNag = true; saveGame(); Story.play(STORY_LOAN, () => {}); }
      });
      return;
    }
    borrowYami(amt);
    renderLoan(); updateTopbar();
    toast(`灰田から ${yen(amt)} 借りた…`);
    oyajiNag('loan', 2.4);                       // 2回目以降は“ながら”の小言だけ
  };
  // 返済のボタンは renderYamiRepayBar が毎回作る（額をバーで決めるため）
  // 配置
  $('btnPlaceOk').onclick = () => {
    const p = G.placing;
    const chk = p && placeCheck(p.id, p.gx, p.gy, p.moving, p.rot);
    if (!p || !chk.ok) { toast(chk && chk.why ? '⚠ ' + chk.why : 'ここには置けない'); return; }
    if (p.moving) {
      const mc = moveCost(p.moving, p.gx, p.gy, p.rot);
      if (mc > G.cash) { toast(`移動費 ${yen(mc)} が足りない…`); return; }
      G.cash -= mc;
      G.invMove += mc;
      p.moving.x = p.gx; p.moving.y = p.gy; p.moving.rot = p.rot;
      if (mc) toast(`${EQ[p.id].name}を動かした（${yen(mc)}）`);
      else if (isPortable(EQ[p.id])) toast(`${EQ[p.id].name}を動かした`);   // 担いで運んだ＝金は動かない
      endPlacing();
    } else {
      if (G.cash < eqPrice(p.id)) { toast('資金が足りない…'); return; }
      /* 章が「買う前にひと言はさむ」仕組みを持っていれば、そこへ渡す（第2章＝妻）。
         true が返ったら、章のほうが確認を出している＝ここでは何もしない。
         「通す」を選んだら、章が同じ操作をもう一度呼び直す（G.ch2.wifeOK が立った状態で） */
      if (chHook('askWife', 'equip', eqPrice(p.id), p.id)) return;
      G.cash -= eqPrice(p.id);
      G.invBuy += eqPrice(p.id);
      G.equip.push({ uid: ++G.uidN, id: p.id, x: p.gx, y: p.gy, rot: p.rot, cond: 100, f: G.actF,
                     temp: EQ[p.id].temp, occ: Array(EQ[p.id].cap).fill(null) });
      p.placedN++;
      toast(`🔨 ${EQ[p.id].name}を設置した！`);
      log(`🔨 ${EQ[p.id].name}を設置した`);
      // 立派な（金のかかる）設備を入れると、親父がぼやく（安い小物＝観葉植物やイスには反応しない）
      if (EQ[p.id].price >= 200000 && Math.random() < 0.6) oyajiNag('equip', 2.4);
      if (p.onPlaced) p.onPlaced();
      /* 決戦仕様の一台は、夜を待たずに据えた“その場”で火入れの一幕へ（作者指定）。
         組み上げた瞬間がいちばん見せたい場面なので、閉店後まで持ち越さない */
      if (p.id === 'sauna_sp' && !G.flags.spFired) {
        G.flags.spFired = true;
        endPlacing();
        refreshDead(); updateTopbar(); renderShop(); saveGame();
        Story.play(STORY_NAPPA_FIRE, () => {
          log(`🔥 【${EQ.sauna_sp.name}】に火が入った。熱波師が中央に立ち、六つの席へ左右に風を送る`);
          saveGame();
          openRematchPrompt();
        });
        return;
      }
      // 「やめる」を押すまで同じものを続けて置ける（ととのいイスや牛乳をまとめて並べる用）
      if (p.once) endPlacing();
      else if (G.cash < eqPrice(p.id)) { toast('資金が足りない…（ここまで）'); endPlacing(); }
      else {
        // 置いた直後は同じマスが埋まっているだけなので「置けない」ではなく次を促す
        p.valid = false;
        $('confirmText').textContent = `${EQ[p.id].name} ${p.placedN}個設置。次の場所をタップ（やめるで終了）`;
      }
    }
    refreshDead();
    updateTopbar(); renderShop(); saveGame();
  };
  $('btnPlaceNo').onclick = endPlacing;
  // 設備選択
  // 帯の【🏠 家へ】／【♨ 店へ】＝店と家の行き来（30分かかる）
  $('btnHome').onclick = () => { Sfx.play('ui'); chHook('toggleHome'); };
  $('btnSelClose').onclick = deselect;
  // 第2章：残置物の始末（売る／撤去／残す）
  $('btnZanClose').onclick = deselect;
  $('btnZanSell').onclick = () => chHook('decideZanchi', G.selected, 'sold');
  $('btnZanGone').onclick = () => chHook('decideZanchi', G.selected, 'gone');
  $('btnZanKeep').onclick = () => chHook('decideZanchi', G.selected, 'keep');
  $('btnMove').onclick = () => {
    const it = G.selected; if (!it) return;
    if (G.phase === 'biz') evictUsers(it);   // 営業中でも動かせる。使っている客はどいてもらう
    startPlacing(it.id, it);
  };
  /* 自分から修理業者を呼ぶ。準備中（営業時間外）でも来てくれる＝客に迷惑をかけずに直せる。
     代金は減った耐久のぶんだけなので、早く直しても損はしない */
  $('btnFix').onclick = () => {
    const it = G.selected; if (!it || !fixable(it)) return;
    const fee = fixFee(it);
    if (G.cash < fee) { toast(`修理代が足りない（${yen(fee)}）`); return; }
    callRepairman(it, true);
    selectEquip(it);
  };
  $('btnSell').onclick = () => {
    const it = G.selected; if (!it || it.id === 'bandai') return;
    if (G.phase === 'biz') evictUsers(it);
    G.cash += sellValue(it);
    G.invSell += sellValue(it);
    G.equip.splice(G.equip.indexOf(it), 1);
    refreshDead();
    toast(`${EQ[it.id].name}を売却した（${yen(sellValue(it))}）`);
    deselect(); updateTopbar(); saveGame();
  };
  // 回転（全設備が0〜3の4方向に向きを変えられる）
  $('btnRotate').onclick = () => {
    const p = G.placing; if (!p) return;
    p.rot = ((p.rot || 0) + 1) % 4;
    p.gx = clamp(p.gx, 1, CONF.W - 1 - ew(p.id, p.rot));
    p.gy = clamp(p.gy, 1, CONF.H - 1 - eh(p.id, p.rot));
    updateConfirmText();
  };
  // 運営メニュー
  // 運営メニューは準備中でも営業中でも開ける（料金やアメニティは営業中に手直ししたくなる）
  const openManage = () => { renderManage(); openPausedModal('manageModal'); };
  $('btnManage').onclick = openManage;
  $('btnManageBiz').onclick = openManage;
  $('btnManageClose').onclick = () => { closePausedModal('manageModal'); updateTopbar(); };
  // 営業
  $('btnPause').onclick = () => {
    G.paused = !G.paused;
    $('btnPause').textContent = G.paused ? '▶ 再開' : '⏸ 一時停止';
  };
  $('btnSpeed').onclick = () => {
    G.speedIdx = (G.speedIdx + 1) % CONF.speeds.length;
    $('btnSpeed').textContent = `▶ 速度${CONF.speedLabels[G.speedIdx]}`;
  };
  $('btnRepOk').onclick = afterReport;
  // みかじめ料（ヤクザの来訪）
  $('btnMikaPay').onclick = payMikajime;
  $('btnMikaRefuse').onclick = refuseMikajime;
  $('btnMikaPayoff').onclick = payoffFromMika;
  // URLに ?reina を付けて開くと、玲奈編の直前から始まる（作者の見直し用）
  if (/(^|[?&])reina(&|=|$)/.test(location.search)) devStartReina();
}

/* ============ 玲奈編から遊ぶ（?reina）============
   ゲームオーバーでセーブが消えても、玲奈編の入り口を何度でも作り直せるようにしてある。
   田所・鬼頭・黒田まで片付いた「いい感じの店」を組み、玲奈はまだ現れていない状態から始まる＝
   1日ぶん営業を回した夜に、テレビが蒼天SPAを特集するところから物語が動く */
/* 通路は y3・y6・y8 の3本と x6 の1本。設備はその間の島に置く＝どれも通路に面していて、
   「⚠ 客が近づけない」が出ない。(8,1)〜(10,2) は空けてある＝夕凪湯スペシャル（3×2）の置き場 */
const DEV_REINA_LAYOUT = [
  // 浴室（y1〜6）
  ['sauna1', 1, 1], ['sauna_mist', 3, 1], ['cooler', 5, 1], ['matrack', 5, 2], ['akarack', 7, 1],
  ['bath1', 1, 4], ['bath_denki', 3, 4], ['bath_yuzu', 3, 5], ['wash1', 5, 4], ['wash1', 5, 5],
  ['mizu1', 7, 4], ['mizu_single', 7, 5], ['chair1', 9, 4], ['chair2', 10, 4],
  ['chair1', 9, 5], ['bench1', 10, 5], ['wash1', 11, 4], ['wash1', 11, 5],
  // 脱衣所（y7〜9）
  ['sink', 1, 7], ['vend2', 3, 7], ['vend1', 4, 7], ['gacha', 5, 7],
  ['locker2', 7, 7], ['locker1', 9, 7], ['locker1', 10, 7], ['locker1', 11, 7],
  ['fan_bath', 1, 9], ['shogi', 2, 9], ['scale', 3, 9], ['ehon', 4, 9], ['bandai', 5, 9],
  ['locker1', 7, 9], ['massage', 8, 9], ['toilet1', 9, 9], ['plant1', 10, 9], ['locker1', 11, 9],
  // 壁掛け
  ['poster', 0, 8], ['tv', 12, 8],
];
function devStartReina() {
  resetState();
  G.equip = [];
  for (const [id, x, y] of DEV_REINA_LAYOUT) {
    const d = EQ[id]; if (!d) continue;
    G.equip.push({ uid: ++G.uidN, id, x, y, rot: 0, cond: 100, f: G.actF, temp: d.temp, occ: Array(d.cap || 0).fill(null) });
  }
  refreshDead();
  G.dirts = [];
  G.day = 60; G.cash = 3500000; G.debt = 0; G.najimi = 100; G.regulars = 45;
  G.opts = { ...DEFAULT_OPTS, fee: 800, saunaFee: 400, towel: 'paid', towelPrice: 300,
    tebura: true, teburaPrice: 400, soapMode: 'sell', shampooPrice: 150, bodysoapPrice: 150,
    kidFee: 300, banYakuza: true, timeLimit: 120, dryerFee: 20, lotionOn: true };
  G.roster = [
    { pid:'shufu', name:'主婦', maji:5, spd:3, aiso:4, desc:'家事20年のプロ。汚れは見逃さない', wage:10900, days:40, skill:100, sulk:false, raiseAsk:false, raiseAmt:400, raiseNo:0 },
    { pid:'gakusei', name:'学生', maji:4, spd:5, aiso:4, desc:'体力自慢の大学生。動きが速い', wage:10200, days:20, skill:80, sulk:false, raiseAsk:false, raiseAmt:300, raiseNo:0 },
  ];
  G.staffCount = G.roster.length;
  G.premium = { autoRepair: true, autoRepairOn: true };
  /* 直近7日ぶんの採点を黒田の合格ラインで埋める＝初日から評判72。
     ここを空にすると1日ぶんの採点だけで評判が決まり、玲奈の登場条件（68）を割りうる */
  G.repHist = Array.from({ length: REP_DAYS }, () => ({ ...KURODA_ITEM_GOALS }));
  G.repBonus = 0; G.rep = repScoreParts().total;
  // 田所・鬼頭・黒田は決着済み。玲奈だけが残っている
  G.tadokoro = { ...newTadokoro(), hello: true, met: true, resolved: true, ally: true, done: TADOKORO_DEMAND_CLEAR };
  G.kito = { ...newKito(), met: true, paid: 2, paidTotal: 2, resolved: true, outcome: 'tadokoroHelp' };
  G.kuroda = { ...newKuroda(), met: true, resolved: true, ally: true };
  G.yami = { ...newYami(), met: true, debt: 0 };
  G.solved = { tadokoro: true, yakuza: true, kuroda: true, reina: false, oyaji: false };
  G.reina = newReina();
  G.flags = { intro: true, tut: true, s1: true, father: true, careNag: true, bankIntro: true,
    tadokoroMet: true, bathTadokoroMeet: true, bathTadokoroBond: true, tadokoroConsulted: true,
    bathKitoMeet: true, kitoEndDay: G.day - 20, kitoAfterKazoku: true, kitoAfterKinpatsu: true, lastMikaDay: G.day - 20,
    kurodaMet: true, bathKurodaMeet: true, bathKurodaBond: true, missionCoolUntil: 0 };
  // 治療費は12日後＝玲奈編の5日間と重ならない
  G.careNext = G.day + 12; G.careCount = 4; G.careAmt = 0;
  G.nappa = null;
  $('title').classList.add('hidden');
  $('game-ui').classList.remove('hidden');
  enterPrep();
  saveGame();
  toast('🧪 玲奈編の直前から開始（評判72・現金350万）');
}

/* ============ 運営メニュー（料金・アメニティ・スタッフ） ============ */
/* サウナマット／垢すりタオルの置き場。ONなら浴室内の場所を選ばせ、OFFなら撤去する */
function toggleRack(id) {
  const cur = G.equip.find(e => e.id === id);
  if (cur) {
    G.equip.splice(G.equip.indexOf(cur), 1);
    toast(`${EQ[id].name}を片付けた`);
    renderManage(); saveGame(); return;
  }
  const reopen = () => { $('manageModal').classList.remove('hidden'); renderManage(); saveGame(); };
  $('manageModal').classList.add('hidden');
  startPlacing(id, null, { once: true, onPlaced: reopen, onCancel: reopen });
}

let manageTab = 'fee';   // 運営メニューのタブ（料金／アメニティ／ルール）
/* ============ 営業時間（第2章）============
   **主人公は21時で帰る。** 24時までは、ロビーに立つバイトが受付を回している。
   そこから先を開けるには、**深夜に立てる人間**（`night:true`）が要る。
   雇っていなければ、この項目は鍵がかかったまま＝大手がやらない選択の入口。   */
function nightStaffN() { return (G.roster || []).filter(e => e.night).length; }
/* 深夜営業を開けられるか。**章が条件を持っていればそちらが正**
   （第2章＝休憩ラウンジが建っていて、1階に深夜バイトが立っていること） */
function nightLockWhy() {
  if (!CONF.nightOpen) return '—';
  const why = chHook('nightLockWhy');
  if (why !== undefined && why !== null) return why || '';
  return nightStaffN() > 0 ? '' : '深夜に立てるバイトがいない';
}
function canNightOpen() { return !!CONF.nightOpen && !nightLockWhy(); }
function nightOpenOn() { return !!(CONF.nightOpen && G.opts.nightOpen && canNightOpen()); }
/* 深夜が始まる時刻（既定は24時。第2章は22時＝主人公が帰る時刻から） */
function nightStartHour() { return (CONF.nightOpen && CONF.nightOpen.openHour) || 24; }
/* いまの閉店時刻（深夜営業なら CONF.nightOpen.closeHour ＝第2章は34時＝翌10時） */
function closeHourNow() {
  if (nightOpenOn()) return CONF.nightOpen.closeHour;
  const h = chHook('closeHour');            // 第2章＝プレイヤーが決めた閉店時刻
  return h == null ? CONF.closeHour : h;
}
function nightOpenRow() {
  if (!CONF.nightOpen) return '';
  const n = CONF.nightOpen;
  const lock = nightLockWhy();
  if (lock)
    return `<div class="opt-row locked"><span>深夜営業（${n.openHour || 24}時〜翌${n.closeHour - 24}時）<br>
      <span class="opt-sub">🔒 ${lock}</span></span>
      <button class="opt-btn" disabled>—</button></div>`;
  return `<div class="opt-row"><span>深夜営業（${n.openHour || 24}時〜翌${n.closeHour - 24}時）<br>
    <span class="opt-sub">深夜料金 +¥${n.fee}／深夜割増賃金 +${Math.round((n.wageRate - 1) * 100)}%（${nightStaffN()}人）<br>
    ${chHook('nightNote') || '運転手・仕事帰り・遠征サウナーが来る'}</span></span>
    <span>${[['', 'なし'], ['on', '開ける']].map(([k, l]) =>
      `<button class="opt-btn ${(G.opts.nightOpen ? 'on' : '') === k ? 'on' : ''}" data-act="nightOpen" data-v="${k}">${l}</button>`).join('')}</span></div>`;
}

function renderManage() {
  const o = G.opts;
  const box = $('manageBody');
  // 定額ボタン＋いちばん右の「自由」。自由を選ぶとスライダー（入浴料¥500〜¥1,000／サウナ料¥200〜¥700）で決められる
  const feeBtnRow = (opts, cur, custom, act) =>
    opts.map(f => `<button class="opt-btn ${!custom && cur === f ? 'on' : ''}" data-act="${act}" data-v="${f}">¥${f}</button>`).join('') +
    `<button class="opt-btn ${custom ? 'on' : ''}" data-act="${act}Custom">自由</button>`;
  const feeSlider = (act, cur) => {
    const R = act === 'fee' ? FEE_RANGE : SAUNA_FEE_RANGE;
    // 目安＝いまの設備なら客が納得して払う額。これを超えると満足度が落ちる
    const guide = act === 'fee' ? worthFee() : Math.min(SAUNA_FEE_RANGE[0] + Math.round(facilityScore() * 6), SAUNA_FEE_RANGE[1]);
    /* スライダーは指では狙った額に止められない（作者指定 8/7）＝【−】【＋】で刻む形にした。
       長押しで連続して動くので、端から端まででも指1本で届く */
    return `<div class="opt-row slider-row"><span>${act === 'fee' ? '入浴料' : 'サウナ料'}を決める<br>
      <span class="opt-sub">目安 ¥${guide.toLocaleString()}</span></span>
      <span class="fee-step">
        <button class="opt-btn step" id="${act}Minus" ${cur <= R[0] ? 'disabled' : ''}>−</button>
        <b id="${act}SliderVal">¥${cur.toLocaleString()}</b>
        <button class="opt-btn step" id="${act}Plus" ${cur >= R[1] ? 'disabled' : ''}>＋</button>
      </span></div>`;
  };
  const feeBtns = feeBtnRow(FEE_OPTIONS, o.fee, o.feeCustom, 'fee');
  /* サウナ料は入浴料への上乗せ。サウナを設置して初めて設定できる。
     **サウナ料を取らない章（第2章＝入館料込みのサウナ専門店）では、行ごと出さない。**
     幅ゼロのスライダーと、取れない料金の「目安」が並んで壊れて見えていた（作者指摘 8/5） */
  const saunaFeeRow = CONF.noSaunaFee ? '' : hasCat('sauna')
    ? `<div class="opt-row"><span>サウナ料<br><span class="opt-sub">目安 ¥${worthSaunaFee()}。高すぎるとサウナ客が減る</span></span><span>${
        feeBtnRow(SAUNA_FEE_OPTIONS, o.saunaFee, o.saunaFeeCustom, 'saunaFee')
      }</span></div>` + (o.saunaFeeCustom ? feeSlider('saunaFee', o.saunaFee) : '')
    : `<div class="opt-row locked"><span>サウナ料<br><span class="opt-sub">🔒 サウナ設置で解放</span></span><button class="opt-btn" disabled>—</button></div>`;
  const towelBtns = [['none', 'なし'], ['free', '無料貸出'], ['paid', '有料']].map(([k, l]) =>
    `<button class="opt-btn ${o.towel === k ? 'on' : ''}" data-act="towel" data-v="${k}">${l}</button>`).join('');
  const towelPriceRow = o.towel === 'paid'
    ? `<div class="opt-row"><span>タオル料金</span><span>${[100, 200, 300].map(pp =>
        `<button class="opt-btn ${o.towelPrice === pp ? 'on' : ''}" data-act="towelPrice" data-v="${pp}">¥${pp}</button>`).join('')}</span></div>` : '';
  /* 時間制限の一行説明。いま選んでいる値で、何が起きるかだけを言う。
     サウナを持っているかで意味が変わる＝持つ前は「タダで回転が上がる」、持った後は「客を切る」 */
  const timeLimitSub = () => {
    const v = o.timeLimit || 0;
    // ボタンが4つ並ぶので、ここは12文字までに収める（折り返させない）
    if (!v) return '客は好きなだけ居る';
    if (!hasCat('sauna')) return '回転だけが上がる';
    return { 90: 'サウナ客の半分を切る', 120: 'サウナ客の15%を切る', 150: 'ほぼ全員が満足する' }[v];
  };
  const tog = (act, on, label, sub) =>
    `<div class="opt-row"><span>${label}<br><span class="opt-sub">${sub}</span></span>
      <button class="opt-btn toggle ${on ? 'on' : ''}" data-act="${act}">${on ? 'ON' : 'OFF'}</button></div>`;
  // シャンプー・ボディソープ: なし / 無料設置 / 販売（販売なら1本ずつ値付け）
  // 手ぶらセットにアメニティが含まれるので、セット導入中は「無料設置」は選べない
  const soapBtns = [['none', 'なし'], ['free', '無料設置'], ['sell', '販売']].map(([k, l]) =>
    `<button class="opt-btn ${o.soapMode === k ? 'on' : ''}" data-act="soapMode" data-v="${k}"${
      k === 'free' && o.tebura ? ' disabled title="手ぶらセット導入中は選べない"' : ''}>${
      k === 'free' && o.tebura ? '🔒無料' : l}</button>`).join('');
  // 手ぶらセット＝タオル＋シャンプー＋ボディソープのバンドル。手ぶらで来た客が買う
  const teburaRow =
    `<div class="opt-row"><span>手ぶらセット<br><span class="opt-sub">タオル＋アメニティ込み。手ぶら客が買う${
      o.towel === 'free' ? '<b>（タオル無料だと売れない）</b>' : ''}</span></span>
      <button class="opt-btn toggle ${o.tebura ? 'on' : ''}" data-act="tebura">${o.tebura ? 'ON' : 'OFF'}</button></div>` +
    (o.tebura ? `<div class="opt-row"><span>手ぶらセットの値段<br><span class="opt-sub">入浴料に上乗せ</span></span><span>${
      TEBURA_PRICES.map(pp => `<button class="opt-btn ${o.teburaPrice === pp ? 'on' : ''}" data-act="teburaPrice" data-v="${pp}">¥${pp}</button>`).join('')
    }</span></div>` : '');
  /* 子供料金（作者指定）。「刺青・ヤクザお断り」を掲げると子連れの家族が来るようになる＝
     そこで初めて効いてくる料金なので、掲げていない間はその旨を添えておく */
  // 上限＝子ども向けの備品の数（第2章は評判も要る）。超えると家族連れが来ない（作者指定）
  const kidGuide = kidFeeCap(), kidN = kidsGoods().length, kidNext = kidFeeNext();
  const kidFeeRow =
    `<div class="opt-row"><span>子供料金<br><span class="opt-sub">${
      !kidNext ? `上限¥${kidGuide}　子ども向けの備品${kidN}個`
      : `上限¥${kidGuide}（備品${kidN}個）　¥${kidNext.price}には` + [
          kidNext.rep ? `評判${kidNext.rep}` : '',
          kidNext.need ? `備品${kidNext.need}個` : '',
        ].filter(Boolean).join('と')
    }</span></span><span>${KID_FEES.map(pp =>
      `<button class="opt-btn ${o.kidFee === pp ? 'on' : ''}" data-act="kidFee" data-v="${pp}">¥${pp}</button>`).join('')}</span></div>`;
  const priceRow = (act, label, cur) =>
    `<div class="opt-row"><span>${label}</span><span>${AMENITY_PRICES.map(pp =>
      `<button class="opt-btn ${cur === pp ? 'on' : ''}" data-act="${act}" data-v="${pp}">¥${pp}</button>`).join('')}</span></div>`;
  const soapPriceRows = o.soapMode === 'sell'
    ? priceRow('shampooPrice', 'シャンプー', o.shampooPrice) + priceRow('bodysoapPrice', 'ボディソープ', o.bodysoapPrice) : '';
  /* 3つのタブに分ける（作者指定）。1本のリストに全部並べると1.2画面ぶんになり、
     料金を触りに来ただけでも垢すりタオルのトグルまで通り過ぎることになる。
     見る目的が違う（料金＝客足と売上／アメニティ＝経費と満足度／ルール＝1個）ので、混ぜない */
  /* **バイトは【運営】の中に入れる**（作者指定 8/2）。
     準備画面のボタンが多すぎたので、料金・アメニティ・ルールと同じ棚へ移した */
  /* **アメニティは料金タブの中へ**（作者指定 8/2）。
     タオルもシャンプーも「いくら取るか」の話なので、料金と同じ棚でいい */
  /* **融資も【運営】の中に入れる**（作者指定 8/8）。
     準備画面の下のボタンが5つに増えて折り返していたので、バイトと同じ棚へ移した。
     `loanInManage` を持たない章（第1章）はタブが増えず、ボタンも下に残る＝これまでどおり */
  const tabs = [['fee', '💴 料金'], ['rule', '🚪 ルール']]
    .concat(CONF.staffRooms ? [['staff', '👥 バイト']] : [])
    .concat(CONF.loanInManage ? [['loan', '🏦 融資']] : []);
  const tabBar = `<div class="opt-tabs${tabs.length > 2 ? ' many' : ''}">` + tabs.map(([k, l]) =>
    `<button class="tab ${manageTab === k ? 'on' : ''}" data-mtab="${k}">${l}</button>`).join('') + `</div>`;
  const feePane = `
    <div class="opt-row"><span>入浴料<br><span class="opt-sub">目安 ¥${worthFee()}。高すぎると客が減る</span></span><span>${feeBtns}</span></div>
    ${o.feeCustom ? feeSlider('fee', o.fee) : ''}
    ${kidFeeRow}
    ${saunaFeeRow}
    <div class="opt-row"><span>タオル<br><span class="opt-sub">${CONF.towelCostPer
      ? `洗濯代 <b>¥${CONF.towelCostPer}/枚</b>（貸した枚数ぶん）。無料=集客↑／有料=売上↑`
      : `維持¥${CONF.towelCostPerDay.toLocaleString()}/日。無料=集客↑／有料=売上↑`
      }</span></span><span>${towelBtns}</span></div>
    ${towelPriceRow}
    ${teburaRow}`;
  const amenPane = `
    <div class="opt-row"><span>シャンプー・ボディソープ<br><span class="opt-sub">${CONF.soapCostPer ? `仕入れ <b>¥${CONF.soapCostPer}/人</b>（来た客ぶん）` : `無料でも販売でも一律¥${CONF.soapCostPerDay.toLocaleString()}/日`}</span></span><span>${soapBtns}</span></div>
    ${soapPriceRows}
    ${hasSink()
      ? `<div class="opt-row"><span>ドライヤー<br><span class="opt-sub">無料=満足度↑／¥20=売上</span></span><span>${
          DRYER_FEES.map(f => `<button class="opt-btn ${o.dryerFee === f ? 'on' : ''}" data-act="dryerFee" data-v="${f}">${f ? '¥' + f : '無料'}</button>`).join('')
        }</span></div>`
      : `<div class="opt-row locked"><span>ドライヤー<br><span class="opt-sub">🔒 洗面所の設置で解放</span></span><button class="opt-btn" disabled>—</button></div>`}
    ${hasSink()
      ? tog('lotionOn', o.lotionOn !== false, '化粧水・乳液',
          CONF.lotionCostPer ? `置けば満足度↑／仕入れ ¥${CONF.lotionCostPer}/人` : `置けば満足度↑／¥${CONF.lotionCostPerDay.toLocaleString()}/日`)
      : `<div class="opt-row locked"><span>化粧水・乳液<br><span class="opt-sub">🔒 洗面所の設置で解放</span></span><button class="opt-btn" disabled>—</button></div>`}
    ${/* サウナマットと垢すりタオルは、章によっては**運営メニューに出さない**（第2章＝作者指定）。
          置き場そのものを【洗い場】タブの設備として買うので、ここに同じものが並ぶと二重になる */
      CONF.noAmenityToggle ? '' :
      tog('akasuriTowel', hasAkasuri(), '垢すりタオル',
          CONF.akasuriCostPer ? `満足度↑／洗濯代 ¥${CONF.akasuriCostPer}/枚` : '満足度↑／¥500/日')
      + tog('saunaMat', hasMat(), 'サウナマット',
            CONF.matCostPer ? `サウナ満足度↑／洗濯代 ¥${CONF.matCostPer}/人（サウナ客ぶん）` : 'サウナ満足度↑／¥500/日')
      + `<div class="opt-row locked"><span>垢すりサービス（プロが担当）<br><span class="opt-sub">🔒 新店で解放予定</span></span><button class="opt-btn" disabled>近日</button></div>`}`;
  const rulePane = `
    ${kitoAccepted()
      /* 鬼頭を受け入れる形で決着した店は、もう札を掲げられない（受け入れると約束したのだから）。
         ここを開けておくと「下ろして決着 → すぐ掲げ直す」で罰だけ踏み倒せてしまう */
      ? `<div class="opt-row locked"><span>刺青・ヤクザお断り<br><span class="opt-sub">🔒 鬼頭と交わした約束がある（評判 -${KITO_ACCEPT_PEN}）</span></span><button class="opt-btn" disabled>—</button></div>`
      /* 説明文は章ごと。**みかじめ料は第1章の物語**（鬼頭）で、
         第2章にはその相手がいない＝そのままだと**起きないことを約束するボタン**になる */
      : tog('banYakuza', o.banYakuza, '刺青・ヤクザお断り',
            chHook('banYakuzaNote') || '「怖い」不満が消える。ただし連中がみかじめ料を要求しに来る')}
    ${/* 滞在時間の制限。**持たない章もある**（第2章＝食堂もラウンジもある、長居させる施設なので
          そもそも時間で切らない）。行ごと出さない＝動かせないボタンを並べない */
      CONF.noTimeLimit ? '' :
      `<div class="opt-row"><span>滞在時間の制限<br><span class="opt-sub">${timeLimitSub()}</span></span><span>${
        TIME_LIMITS.map(v => `<button class="opt-btn ${(o.timeLimit || 0) === v ? 'on' : ''}" data-act="timeLimit" data-v="${v}">${v ? v + '分' : 'なし'}</button>`).join('')
      }</span></div>`}
    ${nightOpenRow()}
    ${/* 章が自前で足す行（第2章＝【小学生以下お断り】） */ chHook('manageRuleExtra') || ''}
    ${/* 【女湯の開放】は**押せない案内**でしかない（作者指定 8/8）。
          第2章は3Fを増築すれば女湯が開くので、ここに「近日」と出ていると嘘になる。
          `noOnnaRow` を持たない章＝これまでどおり出す */
      CONF.noOnnaRow ? '' :
      `<div class="opt-row locked"><span>女湯の開放<br><span class="opt-sub">🔒 新店で解放予定</span></span><button class="opt-btn" disabled>近日</button></div>`}`;
  if (manageTab === 'staff' && !CONF.staffRooms) manageTab = 'fee';   // 章が戻ったとき用
  if (manageTab === 'loan' && !CONF.loanInManage) manageTab = 'fee';  // 同上（融資タブを持たない章）
  if (manageTab === 'amen') manageTab = 'fee';        // 前の版のタブが残っていても迷子にしない
  /* ⚠ **中身を書き換える前に、借りているものを必ず返す。**
     融資タブは資金繰りモーダルの中身を借りて表示する（loanHost）。
     返す前に innerHTML で消すと、借りた3つのまるごと消滅する＝
     以降どの章からも資金繰りが開けなくなる（実測 8/8）                     */
  loanHost(null);
  box.innerHTML = tabBar + (manageTab === 'staff' ? '<div id="staffMgrPane"></div>'
    : manageTab === 'loan' ? '<div id="loanPane"></div>'
    : manageTab === 'fee' ? (feePane + '<div class="opt-sec">🧴 アメニティ</div>' + amenPane) : rulePane);
  if (manageTab === 'loan') { loanHost($('loanPane')); renderLoan(); }
  box.querySelectorAll('[data-mtab]').forEach(b => b.onclick = () => { manageTab = b.dataset.mtab; renderManage(); });
  if (manageTab === 'staff') {
    renderStaffMgr();                                // 中身は既存のバイト管理をそのまま使う
    const pane = $('staffMgrPane');
    if (pane) {                                      // 求人はモーダル側の下ボタンだったので、ここに置き直す
      const jb = document.createElement('button');
      jb.className = 'big-btn';
      jb.textContent = G.jobAdDay ? '📰 求人を出している（2日後の朝）' : '📰 求人広告を出す（' + yen(50000) + '）';
      jb.disabled = !!G.jobAdDay;
      jb.onclick = () => {
        if (G.jobAdDay) return;
        if (G.cash < 50000) { toast('広告費が足りない'); return; }
        G.cash -= 50000; G.jobAdDay = G.day + 2;
        log('📰 求人広告を出した（' + yen(50000) + '）。2日後の朝、応募が来る');
        toast('📰 求人広告を出した');
        renderManage(); updateTopbar(); saveGame();
      };
      pane.appendChild(jb);
    }
  }
  box.querySelectorAll('.opt-btn').forEach(b => b.onclick = () => {
    const act = b.dataset.act, v = b.dataset.v;
    /* 値上げは、章によっては一度止まる（第2章＝妻）。
       止まった時は**何も触らずに戻る**＝押した瞬間に値段が動いてしまわないようにする */
    if (act === 'fee') {
      if (chHook('askWife', 'fee', +v, { act: 'fee', from: o.fee, to: +v, custom: false })) return;
      o.fee = +v; o.feeCustom = false;
    }
    else if (act === 'saunaFee') {
      if (chHook('askWife', 'fee', +v, { act: 'saunaFee', from: o.saunaFee, to: +v, custom: false })) return;
      o.saunaFee = +v; o.saunaFeeCustom = false;
    }
    else if (act === 'feeCustom') o.feeCustom = !o.feeCustom;
    else if (act === 'saunaFeeCustom') o.saunaFeeCustom = !o.saunaFeeCustom;
    else if (act === 'timeLimit') o.timeLimit = +v;
    else if (act === 'nightOpen') o.nightOpen = (v === 'on');
    else if (act === 'towel') o.towel = v;
    else if (act === 'kidFee') o.kidFee = +v;
    else if (act === 'towelPrice') o.towelPrice = +v;
    else if (act === 'soapMode') { if (v === 'free' && o.tebura) { toast('手ぶらセット導入中は無料設置にできない'); return; } o.soapMode = v; }
    else if (act === 'tebura') {
      o.tebura = !o.tebura;
      // セットにアメニティが含まれるので、無料設置のままにはできない
      if (o.tebura && o.soapMode === 'free') { o.soapMode = 'sell'; toast('無料設置 → 販売に切り替えた（セットに含まれる）'); }
    }
    else if (act === 'teburaPrice') o.teburaPrice = +v;
    else if (act === 'banYakuza') {
      o.banYakuza = !o.banYakuza;
      // 初めて「お断り」にした時は、断られた連中が必ず挨拶に来る（次の営業日）
      if (o.banYakuza && !G.flags.banFirst && G.kito && !G.kito.met) {
        G.flags.banFirst = true;
        toast('⚠ 断られた連中が、黙っているとは思えない…');
      }
      // フェーズ3：お断りを下ろすと、翌日に鬼頭が礼を言いに来る
      if (!o.banYakuza && G.kito && G.kito.met && !G.kito.resolved) {
        G.flags.kitoThanksDay = G.day + 1;
        // これは実質「鬼頭を受け入れる結末」を選ぶ操作。重い代償があることは伏せずに知らせる
        toast('⚠ 札を下ろした。明日、鬼頭が来る…（受け入れれば取り立ては終わるが、街の目は変わる）');
      }
    }
    else if (act === 'dryerFee') o.dryerFee = +v;
    else if (act === 'lotionOn') o.lotionOn = !(o.lotionOn !== false);
    else if (act === 'shampooPrice' || act === 'bodysoapPrice') o[act] = +v;
    // 置き場のあるアメニティ。ONなら浴室内の場所選び、OFFなら撤去
    else if (act === 'akasuriTowel' || act === 'saunaMat') { toggleRack(act === 'saunaMat' ? 'matrack' : 'akarack'); return; }
    else if (act.startsWith('ch:')) { if (chHook('manageAct', act.slice(3), v) === false) return; }
    renderManage(); saveGame();
  });
  /* 【−】【＋】で刻む（作者指定 8/7・旧スライダー）。押している間は画面を作り直さない＝
     押した指の下でボタンが消えないようにする。指を離した時だけ保存して描き直す。
     長押しすると連続して動く（最初はゆっくり、そのあと速く＝行き過ぎない） */
  for (const act of ['fee', 'saunaFee']) {
    const minus = $(act + 'Minus'), plus = $(act + 'Plus');
    if (!minus || !plus) continue;
    const R = act === 'fee' ? FEE_RANGE : SAUNA_FEE_RANGE;
    const before = o[act];                       // 断られた時に戻す先
    let timer = null, repeat = null;
    const show = () => {
      $(act + 'SliderVal').textContent = '¥' + o[act].toLocaleString();
      minus.disabled = o[act] <= R[0]; plus.disabled = o[act] >= R[1];
    };
    const bump = (d) => { o[act] = clamp(o[act] + d * FEE_STEP, R[0], R[1]); show(); };
    const stop = () => {
      clearTimeout(timer); clearInterval(repeat); timer = repeat = null;
      if (o[act] === before) return;             // 動いていなければ何もしない
      if (chHook('askWife', 'fee', o[act], { act, from: before, to: o[act], custom: true })) return;
      saveGame(); renderManage();
    };
    for (const [btn, d] of [[minus, -1], [plus, 1]]) {
      btn.onpointerdown = (ev) => {
        ev.preventDefault(); if (btn.disabled) return;
        bump(d);
        timer = setTimeout(() => { repeat = setInterval(() => { bump(d); if (btn.disabled) stop(); }, 70); }, 400);
      };
      btn.onpointerup = stop;
      btn.onpointerleave = () => { if (repeat || timer) stop(); };
      btn.onpointercancel = stop;
    }
  }
}
/* 料金を決める（関門を通ったあと／断られた時に元へ戻す、の両方から呼ぶ） */
function setFeeVal(act, v, custom) {
  const o = G.opts;
  o[act] = v;
  if (custom != null) o[act + 'Custom'] = !!custom;
  renderManage(); saveGame();
}
window.setFeeVal = setFeeVal;

/* ============ データ（いまの店の数字を確かめる） ============ */
/* 攻略チェックリストにはしない。あくまで「今どうなっているか」の計器盤。
   まだ会っていない相手のことは出さない（先の展開は見せない） */
let dataTab = 'rep';   // データ画面のタブ。開いた時は【評判】＝「今やるべきこと」が最初に目に入る
function renderData() {
  const box = $('dataBody');
  const row = (l, v, cls) => `<div class="rep-row ${cls || ''}"><span>${l}</span><span class="v">${v}</span></div>`;
  const sec = t => `<div class="opt-sec">${t}</div>`;
  /* 章ごとに増えるタブ（第2章の【🏆 番付】など）。chHook が無い章では何も足さない */
  const extraTabs = (hasHook('dataTabs') ? (chHook('dataTabs') || []) : []);
  /* タブが3つ以上ある章（第2章＝評判・経営・ライバル・スキル）は**2段**にする
     （運営メニューと同じ決まり・作者指定 8/8）。第1章は2つなので1段のまま */
  const dTabs = [['rep', '🏮 評判'], ['kei', '📊 経営']].concat(extraTabs);
  const tabBar = `<div class="opt-tabs${dTabs.length > 2 ? ' many' : ''}">` +
    dTabs.map(([k, l]) =>
      `<button class="tab ${dataTab === k ? 'on' : ''}" data-dtab="${k}">${l}</button>`).join('') + `</div>`;

  /* ── 経営タブ（金まわり） */
  const keiPane = () => {
    const hist = Array.isArray(G.recentProfits) ? G.recentProfits : [];
    const avg = hist.length ? Math.round(hist.reduce((x, y) => x + y, 0) / hist.length) : 0;
    let k = '';
    k += row('手元資金', yen(G.cash));
    if (G.yami && G.yami.debt > 0)
      k += row('💳 灰田ファイナンスの残債',
        `${yen(G.yami.debt)}<br><span class="opt-sub">今週の金利 ${yen(yamiDue())}・集金は毎週水曜</span>`, 'minus');
    k += row('直近5日の平均収支', `${avg >= 0 ? '+' : ''}${yen(avg)}`, avg < 0 ? 'minus' : '');
    k += row('直近5日の黒字日数', `${hist.filter(p => p > 0).length}日 / ${hist.length}日`);
    const ls = G.lastStats;
    const tt = G.today || {};
    const tankaNow = tt.paid ? Math.round(tt.revenue / tt.paid) : 0;
    k += row('昨日の利益', ls ? `${ls.profit >= 0 ? '+' : ''}${yen(ls.profit)}` : 'まだ営業していない', ls && ls.profit < 0 ? 'minus' : '');
    k += row('客単価', ls
      ? `${yen(ls.tanka)}<br><span class="opt-sub">昨日 ${ls.paid}人・${tankaNow ? `今日は ${yen(tankaNow)}` : '今日はまだ0人'}</span>`
      : 'まだ営業していない');
    k += row('常連', `${G.regulars || 0}人<br><span class="opt-sub">満足して帰った客が、また来てくれる</span>`);
    /* 水道光熱費＝直近5日の平均額と、それが売上の何%を食っているか。目安は30%（実在の銭湯もこのくらい） */
    const uh = Array.isArray(G.recentUtil) ? G.recentUtil : [];
    if (uh.length) {
      const uAvg = Math.round(uh.reduce((x, y) => x + y.util + y.water, 0) / uh.length);
      const rSum = uh.reduce((x, y) => x + y.revenue, 0);
      const pct = rSum ? Math.round(uh.reduce((x, y) => x + y.util + y.water, 0) / rSum * 100) : 0;
      k += row('水道光熱費', `${yen(uAvg)}/日<br><span class="opt-sub">直近${uh.length}日の平均・売上の${pct}%（目安は30%まで）</span>`,
        pct > 40 ? 'minus' : '');
    } else k += row('水道光熱費', 'まだ営業していない');
    k += row('入浴料', `¥${G.opts.fee}` + (hasCat('sauna') ? `（＋サウナ ¥${G.opts.saunaFee}）` : ''));
    k += row('客が受け入れる入浴料', `〜¥${worthFee()}`, G.opts.fee > worthFee() ? 'minus' : '');
    if (hasCat('sauna')) k += row('客が受け入れるサウナ料', `〜¥${worthSaunaFee()}`, G.opts.saunaFee > worthSaunaFee() ? 'minus' : '');
    k += row('受入人数（ロッカー）', `${lockerCapacity()}人（${G.equip.filter(e => EQ[e.id].cat === 'locker' && e.cond > 0).length}台）`);
    return k;
  };

  /* ── 評判タブ。いちばん上に「今やるべきこと」、その下は10項目を1行ずつのバーで（作者指定）。
     点数の細かい内訳を読ませるのではなく、どこが凹んでいて、次に何をすればいいかだけを見せる */
  const repPane = () => {
    syncRep();
    const sp = repScoreParts();
    const lo = sp.items.reduce((x, y) => (y.v < x.v ? y : x));
    const badCospa = cospaParts().list.filter(x => x.v === 0);
    /* 浴室が複数ある章では、点を決めているのは**いちばん悪い浴室**。
       どの浴室の話か言わないと、直しに行く先が分からない（第2章＝男湯／女湯） */
    const dsn = dosenParts();
    const dsnWho = dsn.worstName ? dsn.worstName + '：' : '';
    /* ⚠ ここは `x.v < 3` だった＝**満点の区間（2.5点）まで「遠い」に数えていた**。
       区間の配点は 3マス以内=2.5／4マス=1.2／5マス以上=0 なので、満点は 2.5。
       閾値が配点より大きいままだったので、4本とも3マス以内の完璧な店でも
       「遠い：入口 → 洗い場 0マス」と出ていた（点数には影響しない・表示だけの取り違え）。
       ついでに**遠い順**に並べる＝先頭がいちばん直す価値のある区間になる           */
    const badDosen = dsn.list.filter(x => x.v < 2.5).sort((x, y) => x.v - y.v);
    const am = amenityParts();
    const badAmen = am.list.filter(x => x.v < x.max).sort((x, y) => (x.v / x.max) - (y.v / y.max));
    // その項目に出す「次の一手」。コスパ・導線・おもてなしは、取りこぼしを名指しできる
    const adviceOf = it => {
      if (it.key === 'cospa' && badCospa.length)
        return `高い：${badCospa[0].name} ${badCospa[0].note}` + (badCospa.length > 1 ? ` ほか${badCospa.length - 1}件` : '');
      if (it.key === 'dosen' && badDosen.length)
        return `遠い：${dsnWho}${badDosen[0].name} ${badDosen[0].note}` + (badDosen.length > 1 ? ` ほか${badDosen.length - 1}件` : '');
      if (it.key === 'omote' && badAmen.length)
        return `伸ばせる：${badAmen[0].name} ${badAmen[0].note}`;
      return repAdvice(it.key) || it.hint;
    };
    let r = '';
    /* ── 今やるべきこと（作者指定）。順番は「効きの早い順」＝
       ①直せばその日に戻る減点 ②いちばん凹んでいる項目 ③引き受けている宿題 */
    const todo = [];
    if (sp.pens.length) {
      const p0 = sp.pens[0];
      todo.push(`<b>${p0.l}</b>を直す（−${p0.v}点）${sp.pens.length > 1 ? `　ほか${sp.pens.length - 1}件` : ''}`
        + (p0.sub ? `<br><span class="opt-sub">${p0.sub}</span>` : ''));
    }
    if (lo.v < 8) todo.push(`<b>${lo.name}</b>が${lo.v.toFixed(1)}点<br><span class="opt-sub">▶ ${adviceOf(lo)}</span>`);
    /* **客が欲しがっているもの**は、下に置くと見落とすので【今やるべきこと】へ入れる（作者指定 8/2） */
    const wants = [];
    if (!hasRole('cooler', 'cooler')) wants.push('冷水機');
    if (!hasSink()) wants.push('洗面所');
    if (wants.length) todo.push(`<b>客が欲しがっているもの</b><br><span class="opt-sub">▶ ${wants.join('・')}</span>`);
    // 減点のまとめ（😠）は上の1件目と同じ話なので、ここでは省く（準備画面のほうには出る）
    for (const d of demandHint()) if (!d.startsWith('😠')) todo.push(d);
    r += sec('📌 今やるべきこと');
    r += todo.length
      ? todo.slice(0, 3).map(t => `<div class="rep-voice">${t}</div>`).join('')
      : `<div class="rep-voice">✨ いまは大きな穴がない。設備を足して、さらに上を狙おう</div>`;
    /* ── 「🏮 評判」以下は、章ごとに中身を入れ替えられる（作者指定 8/2）。
       第2章では**大会の8部門**がここに来る＝この章のチェックポイントはそっちだから。
       フックを持たない章は、下の第1章の10項目がそのまま出る                */
    const repMain = hasHook('repMain') ? chHook('repMain', sp) : null;
    if (repMain != null) { r += repMain; }
    else {
    // ── 総合スコアと10項目のバー
    r += sec('🏮 評判');
    r += repCounting()
      ? row('総合スコア', `集計中<br><span class="opt-sub">8日目に出る（あと${REP_WARMUP - G.day + 1}日）</span>`)
      : row('総合スコア', `${G.rep} / 100<br><span class="opt-sub">10項目×10点。直近${Math.min(sp.days, REP_DAYS)}日をならした点</span>`);
    for (const it of sp.items) {
      const cls = it.v >= 8 ? 'ok' : it.v >= 6 ? 'mid' : it.v >= 4 ? 'low' : 'bad';
      r += `<div class="rep-bar-row"><span class="nm">${it.name}</span>` +
        `<span class="bar"><i class="${cls}" style="width:${Math.round(it.v * 10)}%"></i></span>` +
        `<span class="bv ${cls}">${it.v.toFixed(1)}</span></div>`;
    }
    if (sp.penSum) {
      r += `<div class="rep-row sub minus"><span>− マイナス評価</span><span class="v">−${sp.penSum}</span></div>`;
      // 直し方はここには書かない（上の「今やるべきこと」に出るので二重になる・作者指定）
      for (const it of sp.pens) r += row(`　${it.l}`, `−${it.v}`, 'minus');
    }
    if (sp.bonus) r += row(sp.bonus > 0 ? '街での出来事（加点）' : '街での出来事（減点）',
      `${sp.bonus > 0 ? '+' : ''}${sp.bonus}`, sp.bonus < 0 ? 'minus' : '');
    }
    /* 黒田の合格表（作者指定）。11の基準を全部満たせば黒田が認め、そこから玲奈の話が始まる＝
       あと何が残っているのかを、いつでもここで確かめられるようにしておく */
    if (G.kuroda && G.kuroda.met && !G.kuroda.resolved) {
      // 評判が目標に届いたら、表は「最後の課題＝手元資金」だけに切り替わる（作者指定）
      const list = kurodaFinalPhase() ? [KURODA_CASH_DEMAND] : kurodaMissions();
      const todoN = kurodaTodo().length;
      r += sec(kurodaFinalPhase()
        ? `💼 黒田の合格表（最後の課題／評判${KURODA_GOAL_REP}達成）`
        : `💼 黒田の合格表（残り${todoN}件 / 全${list.length}件）`);
      for (const d of list) {
        const ok = demandMet(d);
        r += row(`${ok ? '✅' : '⬜'} ${demandLabel(d)}`, ok ? '達成' : demandNow(d), ok ? '' : 'minus');
      }
    }
    /* 「品揃え」の行は削除した（作者指定）。種類の数は、お風呂・サウナ・水風呂のバーに入っている。
       「客が欲しがっているもの」は【今やるべきこと】へ移した（作者指定 8/2） */
    if ((G.roughDays || 0) >= 1)
      r += row('客の我慢', `荒れた日 ${G.roughDays}日連続`
        + (G.roughDays >= CONF.riotDays ? '<br><span class="opt-sub">いつ暴れてもおかしくない</span>' : ''), 'minus');
    if (G.reina && G.reina.duel === 'announced')
      r += sec('🗳 投票対決') +
        row('投票日まで', `あと${Math.max(0, G.reina.duelDay - G.day)}日`) +
        row('見込み票', `夕凪 ${computeYuVotes()} / 蒼天 約${SOUTEN_DUEL_VOTES}`);
    return r;
  };

  const extra = extraTabs.some(([k]) => k === dataTab)
    ? (chHook('dataPane', dataTab) || '') : null;
  box.innerHTML = tabBar + (extra != null ? extra : dataTab === 'kei' ? keiPane() : repPane());
  box.querySelectorAll('[data-dtab]').forEach(b => b.onclick = () => { dataTab = b.dataset.dtab; renderData(); });
}

function renderAds() {
  /* 広告（作者指定 8/2）。**guests＝明日の来店に上乗せする人数／rep＝評判**。
     新聞・ラジオ・テレビは第2章だけ（第1章の町の銭湯には桁が合わない）。
     求人は第2章では【運営 → バイト】に移したので、ここには出さない            */
  const big = !!CONF.staffRooms;
  const ads = [
    { key: 'flyer', icon: '📄', name: 'チラシ配り', cost: 30000, guests: 6,
      desc: '明日 +6人ほど' },
    { key: 'mag', icon: '📖', name: '地元ミニコミ誌に掲載', cost: 100000, guests: 14, rep: 1,
      desc: '明日 +14人・評判+1' },
    ...(big ? [
      { key: 'paper', icon: '📰', name: '新聞広告', cost: 300000, guests: 32, rep: 2,
        desc: '明日 +32人・評判+2　朝刊の地域面に載る' },
      { key: 'radio', icon: '📻', name: 'ラジオCM', cost: 800000, guests: 65, rep: 3,
        desc: '明日 +65人・評判+3　通勤中の車に流れる' },
      { key: 'tv', icon: '📺', name: 'テレビCM', cost: 3000000, guests: 160, rep: 6,
        desc: '明日 +160人・評判+6　県域局の夕方枠' },
    ] : [
      { key: 'job', icon: '📰', name: '求人広告', cost: 50000,
        desc: '2日後の朝、応募が3人来る' },
    ]),
  ];
  /* **【館内案内図】の「集客」タブと、独立したモーダルの両方から呼ばれる。**
     タブの器（sendenPane）が**画面に出ているときだけ**そちらへ描く。
     隠れた器に描いてしまうと、章を切り替えたときに広告がどこにも出なくなる */
  const list = paneIfShown('sendenPane') || $('sendenList');
  list.innerHTML = '';
  for (const ad of ads) {
    const div = document.createElement('div');
    div.className = 'senden-item' + (G.adBought[ad.key] ? ' done' : '');
    div.innerHTML = `<span>${ad.icon || '📣'}</span><div><b>${ad.name}</b><br><span class="shop-desc">${ad.desc}</span></div>
      <span class="shop-price">${G.adBought[ad.key] ? '手配済' : yen(ad.cost)}</span>`;
    div.onclick = () => {
      if (G.adBought[ad.key]) return;
      if (ad.key === 'job' && G.roster.length >= CONF.maxStaff) { toast(`スタッフはもう${CONF.maxStaff}人いる`); return; }
      if (G.cash < ad.cost) { toast('資金が足りない…'); return; }
      G.cash -= ad.cost;
      G.adBought[ad.key] = true;
      G.adBoost += ad.guests || 0;
      if (ad.rep) addRep(ad.rep);
      if (ad.key === 'job') G.jobAdDay = G.day + 2;   // 求人の応募は2日後の朝（作者指定で翌日→2日後に変更）
      toast(`${ad.name}を手配した！`);
      renderAds(); updateTopbar(); saveGame();
    };
    list.appendChild(div);
  }
}
/* 資金繰りメニュー（作者指定）：銀行もヤミ金も廃止し、サラ金「灰田ファイナンス」一本。
   銀行の欄は「審査が通らない」という断り文句だけを置いてある＝借りられない理由を物語で見せる。
   借りられない時はボタンをグレーにして押せなくする。金額はボタンでなく説明側に出す */
/* ============ 公庫の追加融資（第2章）============
   宮下里佳は数字でしか喋らない。だから条件も数字で出す。
   **安いが、明日の金にはならない**（申し込んでから2週間）。
   そこが灰田ファイナンス（即日・年20%）との分かれ目で、
   釜が壊れた翌朝に手が伸びるのは、いつも高いほうだ。                     */
/* 直近10日のうち、黒字だった日の数（宮下が見る2つ目の数字） */
function koukoProfitDays() {
  return ((G.ch2 && G.ch2.profitDays) || []).slice(-10).filter(Boolean).length;
}
/* いまの枠。**返した分を借り直せるだけでは追加融資とは言わない**ので、
   評判と黒字の日数で段が上がる＝数字を良くすると、次の500万が開く */
function koukoTier() {
  const rep = G.rep, prof = koukoProfitDays();
  let best = CONF.kouko.tiers[0];
  for (const t of CONF.kouko.tiers) if (rep >= t.rep && prof >= t.profit) best = t;
  return best;
}
/* 次の段（あと何を伸ばせば枠が開くか）。もう最上段なら null */
function koukoNextTier() {
  const cur = koukoTier();
  const i = CONF.kouko.tiers.indexOf(cur);
  return CONF.kouko.tiers[i + 1] || null;
}
function koukoMax() { return koukoTier().max; }
function koukoRoom() { return Math.max(0, koukoMax() - (G.debt || 0)); }

function koukoChecks() {
  const k = CONF.kouko, c = G.ch2;
  if (!k || !c) return [];
  const days = c.openedDay ? G.day - c.openedDay : 0;
  return [
    { ok: days >= k.needDays, t: `開業から${k.needDays}日以上（いま${days}日）` },
    { ok: !c.billMissed, t: '返済の遅れが無いこと' },
    { ok: !k.noSarakin || !(G.yami && G.yami.debt > 0), t: 'サラ金の残債が無いこと' },
    { ok: koukoRoom() >= k.unit,
      t: `枠が残っていること（枠${manYen(koukoMax())}・残債${manYen(G.debt || 0)}）` },
  ];
}
function koukoOK() { return koukoChecks().every(x => x.ok); }
function renderKouko() {
  const k = CONF.kouko;
  $('loanBankTitle').textContent = k.title || '🏦 日本政策金融公庫（宮下）';
  const waiting = G.ch2 && G.ch2.koukoAt;
  if (waiting) {
    $('loanInfoBank').innerHTML = `「${manYen(G.ch2.koukoAmt)}のご融資、審査に入っております。」<br>
      <b>あと${Math.max(0, G.ch2.koukoAt - G.day)}日</b>で振り込まれる。`;
    $('koukoAmts').innerHTML = '';
    return;
  }
  const checks = koukoChecks();
  const list = checks.map(c => `<span class="${c.ok ? 'kou-ok' : 'kou-ng'}">${c.ok ? '✔' : '✕'} ${c.t}</span>`).join('<br>');
  /* 枠がどうすれば開くかを、いつも下に出しておく。宮下は理由を説明しないが、
     見せた数字がそのまま額になる、というのは分かるようにしておく */
  const nx = koukoNextTier();
  const grow = nx
    ? `<div class="kou-next">次の枠 ${manYen(nx.max)}：評判${nx.rep}以上（いま${G.rep}）／
       直近10日の黒字${nx.profit}日以上（いま${koukoProfitDays()}日）</div>`
    : `<div class="kou-next">枠はこれ以上ない（${manYen(koukoMax())}）</div>`;
  const head = `<span class="opt-sub">年${(k.apr * 100).toFixed(1)}%・いまの枠 <b>${manYen(koukoMax())}</b>
    ／残債 ${manYen(G.debt || 0)}・<b>振り込みは申し込みから${k.waitDays}日後</b></span>`;

  if (!koukoOK()) {
    $('loanInfoBank').innerHTML = `「追加のご融資は、<b>数字を拝見してから</b>になります。」<br>
      ${head}<div class="kou-checks">${list}</div>${grow}`;
    $('koukoAmts').innerHTML = '';
    return;
  }
  $('loanInfoBank').innerHTML = `「……数字は見せていただきました。<b>お貸しできます。</b>」<br>
    ${head}<br><span class="opt-sub">借りられるのは <b>${manYen(koukoRoom())}</b> まで（今日の金にはならない）</span>${grow}`;
  // 100万円きざみ。端数は切り捨てる＝「50万円」のような半端なボタンは出さない
  const room = Math.floor(koukoRoom() / k.unit) * k.unit;
  const amts = [k.unit, k.unit * 3, k.unit * 5].filter(a => a <= room);
  if (room > 0 && !amts.includes(room)) amts.push(room);
  $('koukoAmts').innerHTML = amts.map(a =>
    `<button class="opt-btn" data-amt="${a}">${manYen(a)}</button>`).join('');
  $('koukoAmts').querySelectorAll('button').forEach(b => {
    b.onclick = () => {
      const amt = +b.dataset.amt;
      // 章によっては、申し込む前に一度止まる（第2章＝妻と二人で決める）
      if (chHook('askWife', 'kouko', amt)) return;
      applyKouko(amt);
    };
  });
}
/* 追加融資の申し込みそのもの。**関門（妻）を通ったあとから、もう一度ここへ来られるように**
   ボタンの中から出してある */
function applyKouko(amt) {
  const k = CONF.kouko; if (!k || !G.ch2) return;
  G.ch2.koukoAt = G.day + k.waitDays;
  G.ch2.koukoAmt = amt;
  log(`🏦 ${k.short || '公庫'}に${manYen(amt)}の追加融資を申し込んだ（${k.waitDays}日後に振り込み）`);
  toast(`🏦 申し込んだ。${k.waitDays}日後に振り込まれる`);
  renderLoan(); saveGame();
}
window.applyKouko = applyKouko;

/* 【🏦 融資】を運営メニューの中で見せる章（第2章）のための引っ越し係。
   資金繰りモーダルの中身3つを、運営メニューの `pane` へ**貸し出す**。
   `pane` が null なら元のモーダルへ返す（並び順は【とじる】の前に入れ直せば保たれる）。
   中身を作り直さず動かすだけなので、renderLoan() はどちらに居ても素通りで効く。
   ⚠ 返す処理は renderManage と openLoan の両方から必ず通すこと。
      `loanInManage` を持たない章（第1章）は、そもそもここへ来ない            */
function loanHost(pane) {
  const modal = $('loanModal');
  const back = modal && modal.querySelector('.modal');
  const dest = pane || back;
  if (!dest) return;
  const close = $('btnLoanClose');
  for (const id of ['loanCash', 'loanSecBank', 'loanSecYami']) {
    const el = $(id);
    if (!el || el.parentElement === dest) continue;
    if (dest === back && close && close.parentElement === back) back.insertBefore(el, close);
    else dest.appendChild(el);
  }
}

function renderLoan() {
  $('loanCash').innerHTML = `手持ち資金: <b>${yen(G.cash)}</b>`
    + (CONF.kouko && G.debt ? `　／　${CONF.kouko.short || '公庫'}の残債 <b>${manYen(G.debt)}</b>` : '');
  if (CONF.kouko) renderKouko();
  /* 銀行が貸してくれない章（第1章）へ戻したとき、第2章が書き換えた3つを index.html の原文へ戻す。
     これが無いと、章を行き来したあと第1章の資金繰りに「🏦 横浜信用金庫（融資課）／枠5000万円」が
     残る（第1章セッションの指摘で実測 8/8）。正は index.html:280-282。
     第1章だけを起動している限り書き換わらないので、そこでは何も変わらない */
  else {
    $('loanBankTitle').textContent = '🏦 銀行から借りる';
    $('loanInfoBank').innerHTML = '「申し訳ありませんが、<b>審査は通りません</b>。……失礼ですが、赤字の銭湯さんですので。」<br>—— 信用金庫 融資担当';
    $('koukoAmts').innerHTML = '';
  }
  const yDebt = G.yami ? G.yami.debt : 0;
  const canBorrow = yDebt + CONF.sarakinUnit <= CONF.sarakinMax;   // 10万すら借りられない＝枠いっぱい
  $('loanInfoYami').innerHTML =
    `審査なし・即日融資・上限${manYen(CONF.sarakinMax)}。<br>` +
    `金利は年${Math.round(CONF.sarakinApr * 100)}%。毎週水曜に集金が来る。` +
    (yDebt > 0
      ? `<br>残債 <b>${manYen(yDebt)}</b>（今週の金利 ${yen(yamiDue())}）`
      : '') +
    (canBorrow ? '' : '<br><b>限度額いっぱい＝これ以上は貸してくれない</b>');
  /* 借入額のボタンを10万円刻みで並べる（作者指定）。残枠を超える額は押せない。
     枠が広いと10本並んで折り返すので、10万・30万・50万・残り全部、の4つに絞ってある */
  const room = CONF.sarakinMax - yDebt;
  const amts = [CONF.sarakinUnit, CONF.sarakinUnit * 3, CONF.sarakinUnit * 5];
  if (room > 0 && !amts.includes(room)) amts.push(room);
  $('borrowAmts').innerHTML = amts
    .filter(a => a >= CONF.sarakinUnit && a <= CONF.sarakinMax)
    .map(a => `<button class="opt-btn" data-amt="${a}"${a > room ? ' disabled' : ''}>${manYen(a)}${a === room && room > CONF.sarakinUnit ? '<br><span class="opt-sub">残り全部</span>' : ''}</button>`)
    .join('');
  $('borrowAmts').querySelectorAll('button').forEach(b => {
    b.onclick = () => window.doBorrowSarakin(+b.dataset.amt);
  });
  renderYamiRepayBar(yDebt);
}
/* 返済はバーで額を決める（作者指定）。10万円きざみで、残債と手持ちの小さいほうが上限。
   集金の場面と違って金利は乗せない＝ここで返すのは元本そのもの（前倒しの繰上返済） */
function renderYamiRepayBar(yDebt) {
  const box = $('yamiRepayBox');
  if (!yDebt) { box.innerHTML = '<p class="modal-note">借金はない。</p>'; return; }
  const unit = CONF.sarakinPrincipal;
  const max = Math.min(yDebt, Math.floor(G.cash / unit) * unit);
  if (max < unit) {
    box.innerHTML = `<p class="modal-note">返すには最低 ${manYen(unit)} 要る（手持ち ${yen(G.cash)}）。</p>`;
    return;
  }
  box.innerHTML =
    `<div class="yami-bar">
       <div class="yami-bar-val">返す額 <b id="loanRepVal">${manYen(unit)}</b>
         <br><span class="opt-sub">残り <b id="loanLeftVal">${yen(yDebt - unit)}</b></span></div>
       <input type="range" id="loanRep" min="${unit}" max="${max}" step="${unit}" value="${unit}">
     </div>
     <button id="btnLoanRepay" class="big-btn">この額を返す<br><span class="opt-sub">灰田の口座へ振り込む</span></button>`;
  const sl = $('loanRep');
  sl.oninput = () => {
    $('loanRepVal').textContent = manYen(+sl.value);
    $('loanLeftVal').textContent = yen(yDebt - +sl.value);
  };
  $('btnLoanRepay').onclick = () => {
    const p = +sl.value;
    G.cash -= p; G.yami.debt = Math.max(0, G.yami.debt - p);
    G.today.yamiPaid = (G.today.yamiPaid || 0) + p;
    if (G.yami.debt <= 0) { G.yami.debt = 0; toast('🎉 灰田ファイナンスを完済した…！'); log('💳 灰田への返済を終えた。もう来ない'); }
    else { toast(`灰田に ${yen(p)} 返した（残り ${yen(G.yami.debt)}）`); log(`💳 灰田に ${yen(p)} 返した`); }
    renderLoan(); updateTopbar(); saveGame();
  };
}

/* ============ 起動 ============ */
Sfx.init();      // 効果音（音のファイルは持たず、その場で合成する）
initUI();
requestAnimationFrame(ts => { lastTs = ts; requestAnimationFrame(frame); });
