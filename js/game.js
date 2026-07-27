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
  day: 1, cash: CONF.startCash, debt: CONF.startDebt, rep: 10, name: '夕凪湯',
  // 銀行融資は廃止（作者指定）。debt/loanPending/loanArrive は旧セーブの読み込み用に残してあるだけで、もう増えない
  loanPending: 0, loanArrive: 0,
  profitStreak: 0,          // 連続黒字日数（データ画面の表示に使う）
  repHist: [],              // 直近7日ぶんの「10項目の採点」（新評判システム）
  repBonus: 0,              // 物語の出来事による評判の加点・減点（10項目とは別枠）
  uidN: 0,
  equip: [],                 // {uid,id,x,y,rot,cond,occ[]}
  dirts: [],                 // {x,y}
  minutes: 0,                // 9:00からの経過(分)
  speedIdx: 0, paused: false,
  customers: [], payQueue: [],
  player: null, staff: [], roach: null,   // ゴキブリ1匹（汚れが5つを超えると現れる・保存しない）
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
function newTadokoro() { return { hello: false, met: false, stage: 0, resolved: false, ally: false, nextDay: 0, demand: null, done: 0, doneKeys: [], holdCount: 0 }; }
function newKuroda() { return { met: false, stage: 0, resolved: false, ally: false, nextDay: 0, demand: null, done: 0, doneKeys: [], lastKey: null, discountKey: null, discountDay: 0 }; }
function newReina() { return { met: false, metDay: 0, stage: 0, resolved: false, ally: false, nextDay: 0, poachDone: false, duel: 'none', duelDay: 0, lost: 0 }; }
function newSolved() { return { tadokoro: false, yakuza: false, kuroda: false, reina: false, oyaji: false }; }
// 親父の和解ゲージ（OYAJI_CLEAR_AT / OYAJI_CARE_GAIN）は廃止（作者指定）。態度は評判連動＝STORY_CARE_PAID
const TADOKORO_HELLO_DAY = 4;                       // 田所の名乗り＝4日目の営業終了後（作者指定。2〜3日目の母の電話と重ねない）
const TADOKORO_APPEAR_REP = 30;                     // 田所が現れる評判（いちばん最初のライバル）
const TADOKORO_KESSEN_NAJIMI = 55, TADOKORO_KESSEN_REP = 52, TADOKORO_KYOZON_GAIN = 18;  // 田所が認める条件と、共存の選択で伸びる絆
const TADOKORO_DEMAND_CLEAR = 5;                    // 田所の要求をこの回数だけ叶えると、認めさせる資格（作者指定で3→5）
const KITO_APPEAR_REP = 39;                         // 鬼頭の集金が始まる評判（新評判方式＝繁盛の匂いがし始めた店にヤクザが来る）
/* 以下の登場しきい値は、店の格のカーブ（GRADE_SCALE）を作者指定で上げ直したのに合わせて再換算した値。
   換算のしかたは「同じ充実度なら同じ相手が出る」＝旧しきい値を充実度に戻し、新しいカーブで評判に直した。
   狙い（作者指定）：黒田の決着がつく頃に評判75前後、玲奈への再戦の目標が評判90 */
const KURODA_APPEAR_REP = 65;                       // 黒田が現れる評判（田所＋鬼頭の一件が片付いてから）
                                                    // 黒田の要求は高価な設備ばかりなので、中盤以降＝買える体力が付いてから現れる
const KURODA_KEIEI_STAGE = 2;                       // 「数字で示す」を選んだ回数がこの値に達すると決戦の資格
const KURODA_DEMAND_CLEAR = 2;                      // 黒田の課題をこの回数だけ達成すると決戦へ
const KURODA_DEMAND_GIVEUP = 15;                    // この日数たっても届かない課題は、黒田が別の手に切り替える
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
           care: 0, queueMiss: 0, gripes: {}, satSeg: {}, dirtSum: 0, dirtN: 0,
           waitSum: 0 };   // waitSum＝客が設備待ち・ロッカー待ちで立っていた時間の合計（混雑度に効く）
}

/* ---- 客層別の満足度（データ画面の診断表示。作者指定＝案3のタイプ別） ----
   狙いは「どこかに偏ると全体が歪む」のを目に見えるようにすること。
   ※これは評判スコアには一切混ぜない（作者と合意）。評判は1本のまま、ここは“どこが弱いか”を読む計器。
     5本の平均にしてしまうと、どこが悪いのか逆に分からなくなり、天井＋速度のカーブも壊れる */
const SEGMENTS = [
  { key: 'jimoto', name: '昔ながらの常連', types: ['jisan', 'obachan'],   hint: '湯温・ぬるめの湯船・清潔さ・料金' },
  { key: 'sauner', name: 'サウナー',       types: ['salaryman', 'kinpatsu'], hint: 'サウナの種類・水風呂・マット・ととのい' },
  { key: 'sentou', name: '銭湯ファン',     types: ['oyaji', 'ol'],        hint: '風呂の種類・アメニティ・洗い場' },
  { key: 'wakai',  name: '若者',           types: ['wakamono'],           hint: '設備の新しさ・手ぶら・ドライヤー' },
  { key: 'kozure', name: '子連れ',         types: ['oyako'],              hint: '子供料金・怖い客・清潔さ・混雑' },
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
};
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

/* ============ マップ・経路 ============ */
function isWall(x, y) {
  if (x <= 0 || x >= CONF.W - 1 || y <= 0) return true;
  if (y >= CONF.H - 1) return !(x === CONF.entrance.x && y === CONF.entrance.y);
  return false;
}
function equipAt(x, y, except) {
  for (const it of G.equip) {
    if (it === except) continue;
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
  if (lo !== CONF.divideY - 1 || hi !== CONF.divideY) return false;
  return x1 !== CONF.doorX;
}
// 引き戸をふさぐ場所（戸の前後2マス）には設備を置けない
function isDoorway(x, y) {
  return x === CONF.doorX && (y === CONF.divideY - 1 || y === CONF.divideY);
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
  if (PAS_USE_IDS.has(id)) return true;
  return !(d.cap === 0 && (d.pas || id === 'plant1'));
}
/* その設備を客が実際に使いに行けるか。手前に立てるマスがあり、かつ“飾り”でないこと */
function usable(it) { return !it.dead && approachTiles(it).length > 0; }
/* 「飾り」＝道が通っていないので誰にも使われない設備。
   置く時点で弾いているので新しく生まれることはないが、
   古いセーブ（ロッカー・洗い場を囲んで置けた頃のもの）には残っていることがある */
function refreshDead() {
  const reach = reachableSet();
  for (const it of G.equip)
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
  const gx = wm ? clamp(tx, 0, CONF.W - 1) : clamp(tx, 1, CONF.W - 1 - w);
  const gy = clamp(ty, 1, CONF.H - 1 - h);
  return { gx, gy, ok: placementValid(id, gx, gy, moving, rot) };
}
/* その設備をそのマスに置けるか（床か、壁掛けなら左右の壁か） */
function surfaceOK(id, gx, gy, w, h) {
  if (isWallMount(id) && w === 1 && h === 1 && isInnerWall(gx, gy)) return true;
  return gx >= 1 && gy >= 1 && gx + w <= CONF.W - 1 && gy + h <= CONF.H - 1;
}

/* 置ける部屋か（room:'bath'=浴室のみ / 'datsui'=脱衣所のみ / 無指定=どちらでも） */
function roomOK(id, gy) {
  const r = EQ[id].room;
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
/* サウナの入り口＝「高温」「ミスト」等の札の前1ブロック（札は下辺左端に描かれる）。
   ここに物を置くと客が入れない“画”になるので、設置禁止マスとして扱う（作者指定） */
function saunaDoorTile(it) { return { x: it.x, y: it.y + eh(it) }; }
function placeCheck(id, gx, gy, moving, rot) {
  const w = ew(id, rot), h = eh(id, rot);
  if (!surfaceOK(id, gx, gy, w, h)) return { ok: false, why: null };
  const onWall = isInnerWall(gx, gy);
  for (let x = gx; x < gx + w; x++)
    for (let y = gy; y < gy + h; y++)
      if ((!onWall && isWall(x, y)) || equipAt(x, y, moving) || isDoorway(x, y)) return { ok: false, why: null };
  // 既にあるサウナの入り口（札の前1マス）をふさぐ置き方はできない
  for (const s of G.equip) {
    if (s === moving || EQ[s.id].cat !== 'sauna') continue;
    const d = saunaDoorTile(s);
    if (d.x >= gx && d.x < gx + w && d.y >= gy && d.y < gy + h)
      return { ok: false, why: `${EQ[s.id].name}の入り口（札の前）は空けておく必要があります` };
  }
  // サウナ自身を置く時は、入り口の1マスが浴室内の空きマスであること
  if (EQ[id].cat === 'sauna') {
    const dx = gx, dy = gy + h;
    if (dy >= CONF.divideY || isWall(dx, dy) || equipAt(dx, dy, moving))
      return { ok: false, why: 'サウナの入り口（札の前1マス）が空いていません' };
  }
  // 間仕切りをまたぐ設備は置けない（浴室と脱衣所は別の部屋）
  if (gy < CONF.divideY && gy + h > CONF.divideY) return { ok: false, why: null };
  // 置ける部屋の指定（浴室だけ／脱衣所だけ）
  if (!roomOK(id, gy)) return { ok: false, why: null };
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
  for (const it of G.equip)
    if (it !== moving && needsAccess(it.id) && cut(before, it)) wasDead.add(it);
  const ghost = { uid: -1, id, x: gx, y: gy, rot };
  const saved = moving ? { x: moving.x, y: moving.y, rot: moving.rot } : null;
  if (moving) { moving.x = gx; moving.y = gy; moving.rot = rot; } else G.equip.push(ghost);
  const reach = reachableSet();
  let self = false;
  const lost = [];                                         // 使えなくなる“既にある設備”そのもの（画面で印を付ける）
  for (const it of G.equip) {
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
function bandaiFront() {
  const b = bandai();
  const ts = approachTiles(b);
  ts.sort((p, q) => (q.x - b.x) - (p.x - b.x));   // 右側優先
  return ts[0] || { x: CONF.entrance.x, y: CONF.entrance.y - 1 };
}
function playerSpot() {
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
/* 熱波師が店にいるか（フェーズ4：決戦仕様のサウナを組むと、黒田が連れてくる） */
/* 熱波師が“いま振れる”か。台（決戦仕様の一台）が据わるまでは、来ていても振れない＝効果も出ない */
function nappaOn() { return !!(G.nappa && G.nappa.hired) && hasWorking('sauna_sp'); }
/* 置くだけで効く設備（洗面所・体重計・テレビ・冷水機…）を種類ごとに1つだけ数える */
/* 小綺麗に見せる備品（観葉植物など）は、汚れの出かたを少し抑える。
   置いた台数ぶん効くが、効きすぎると掃除が要らなくなるので5割で打ち止め */
function cleanFactor() {
  let cut = 0;
  for (const e of G.equip) { const d = EQ[e.id]; if (d.clean && e.cond > 0) cut += d.clean; }
  return Math.max(0.5, 1 - cut);
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
function dayOfWeek(d) { return ((d ?? G.day) - 1) % 7; }
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
  for (let y = 1; y < CONF.divideY; y++)
    for (let x = 1; x < CONF.W - 1; x++) {
      if (!walkable(x, y)) continue;
      if (noDirt && G.dirts.some(d => d.x === x && d.y === y)) continue;
      out.push({ x, y });
    }
  return out;
}
function updateRoach(rDt) {
  if (G.phase !== 'biz' && G.phase !== 'prep') { G.roach = null; return; }
  if (dirtCounts().thick < ROACH_FROM) { G.roach = null; for (const d of G.dirts) d.roach = false; return; }
  if (!G.roach) {
    const start = pick(roachTiles(true) || []) || pick(roachTiles(false));   // 汚れの無いマスから現れる
    if (!start) return;
    G.roach = { px: start.x * T + T / 2, py: start.y * T + T / 2, tx: start.x, ty: start.y, wait: 0 };
  }
  const r = G.roach;
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
  for (const d of G.dirts) d.roach = (d.x === r.tx && d.y === r.ty);
}
function roachCount() { return G.roach ? 1 : 0; }
/* 掃除しきった瞬間、そのマスの周り1マス以内にゴキブリがいたら仕留める（作者指定）。
   「バシッ！」と一発、跡だけ残して消える。次に汚れが5つを超えれば、また別の1匹が現れる */
function killRoachNear(w, tile) {
  const r = G.roach;
  if (!r || !tile) return;
  if (Math.abs(r.tx - tile.x) > 1 || Math.abs(r.ty - tile.y) > 1) return;
  G.roachSplat = { x: r.px, y: r.py, t: 1.4 };
  G.roach = null;
  for (const d of G.dirts) d.roach = false;
  addSparkle(tile.x * T + T / 2, tile.y * T + T / 2);
  Sfx.play('fix');
  floaters.push({ x: tile.x * T + T / 2, y: tile.y * T + T / 2 - 12, text: 'バシッ！', t: 1.6 });
  if (w) bubble(w, pick(w.kind === 'player' ? LINES.roachKillMe : LINES.roachKill), 3.6);
  log('🪳 ゴキブリを仕留めた。……こいつが出る前に、掃除の手を増やそう');
}
// 仕留めたあとの跡（すぐ消える）
function drawRoachSplat(rDt) {
  const sp = G.roachSplat; if (!sp) return;
  const a = clamp(sp.t / 1.4, 0, 1);
  ctx.save(); ctx.globalAlpha = a * 0.8;
  ctx.fillStyle = '#2b211a';
  ctx.beginPath(); ctx.ellipse(sp.x, sp.y, 5.5 - a * 1.5, 3 - a * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1e1712'; ctx.lineWidth = 0.9;
  for (let i = 0; i < 6; i++) {                       // 潰れて飛び散った脚
    const ang = i * Math.PI / 3 + 0.4;
    ctx.beginPath(); ctx.moveTo(sp.x + Math.cos(ang) * 3, sp.y + Math.sin(ang) * 2);
    ctx.lineTo(sp.x + Math.cos(ang) * (6 + (1 - a) * 3), sp.y + Math.sin(ang) * (4 + (1 - a) * 2)); ctx.stroke();
  }
  ctx.restore();
  sp.t -= rDt;
  if (sp.t <= 0) G.roachSplat = null;
}
function dirtCounts() {
  let thin = 0, thick = 0;
  for (const d of G.dirts) { if (isThickDirt(d)) thick++; else thin++; }
  return { thin, thick, total: thin + thick };
}
function oldDirtCount() { return dirtCounts().thick; }

/* ============ エンティティ ============ */
function makeEntity(x, y, spd) {
  return { px: x * T + T / 2, py: y * T + T / 2, path: null, spd, moving: false, bub: null, wob: Math.random() * 9 };
}
function stepMove(e, dt) {
  e.moving = false;
  if (!e.path || !e.path.length) return true;
  // ox/oy＝マスの中央からのずれ（サウナの座布団のように、1マスに複数人を座らせるために使う）
  const n = e.path[0], tx = n.x * T + T / 2 + (n.ox || 0), ty = n.y * T + T / 2 + (n.oy || 0);
  const dx = tx - e.px, dy = ty - e.py, dist = Math.hypot(dx, dy), step = e.spd * dt;
  e.moving = true;
  if (dist <= step) {
    e.px = tx; e.py = ty; e.path.shift();
    return e.path.length === 0;
  }
  e.px += dx / dist * step; e.py += dy / dist * step;
  e.walkPx = (e.walkPx || 0) + step;      // 歩かされた距離＝動線の悪さの目安（客の不満の判定に使う）
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
function bubble(e, text, dur) { e.bub = { text, t: dur || 3.4, gm: BUB_GAME_MIN, key: bubKey(e) }; }
// 運営メニューで直せる不満は赤枠で長めに出す＝プレイヤーへの改善サイン
function hintBubble(e, text) {
  e.bub = { text, t: 5.0, gm: BUB_GAME_MIN * 1.5, hint: true, key: bubKey(e) };
  // 赤枠の吹き出し＝運営で直せる不満。画面直下のお知らせ欄にも赤文字で流す
  if (e.kind === 'cust' && e.type) logGripe(e.type.name, text);
}
/* 「そこまで歩いて行けない」＝設備で通路を塞いでいる時の赤い吹き出し。
   不満（！）とは別の印（⚠）にしてある。運営メニューでは直せず、配置を直すしかない問題なので。
   同じ相手が延々と喋り続けないよう、6秒に1回までに絞る */
function stuckBubble(e, text) {
  if (e.stuckCd > 0) return;
  e.stuckCd = 6.0;
  e.bub = { text, t: 5.0, gm: BUB_GAME_MIN * 1.5, hint: true, stuck: true, key: bubKey(e) };
  if (!G.stuckLogged) { G.stuckLogged = true; log(`⚠ ${text}（通路が塞がっている）`); }
}
// 設備名つきで「たどり着けない」と言わせる
function stuckAt(e, name) { stuckBubble(e, `${name}にたどり着けない`); }

/* ---- 客 ---- */
/* 子ども向けの備品（ガチャガチャ・絵本の棚）。置いた数で子供料金の上限が決まる（作者指定）。
   大人料金との連動はやめた＝「大人を高くすれば子どもも高くできる」より、
   「子どもから金を取るなら、子どもが喜ぶものを置け」のほうが素直で、置き場所の選択にもなる */
function kidsGoods() { return G.equip.filter(e => EQ[e.id].kids && e.cond > 0 && usable(e)); }
function kidFeeCap() { return KID_FEES[clamp(kidsGoods().length, 0, KID_FEES.length - 1)]; }
function kidFeeOK() { return (G.opts.kidFee || KID_FEES[0]) <= kidFeeCap(); }
let custId = 0;
/* forceKey を渡すと、その客タイプで1人だけ湧かせる（親のあとに続く子ども用） */
function spawnCustomer(forceKey) {
  // 夕凪湯は男湯：menOnlyの間は男性客だけが来る（女性タイプは女湯・新店で解放）
  // 「刺青・ヤクザお断り」中は強面客は普通には来店しない（代わりにみかじめ料の来訪がある）
  const keys = Object.keys(TYPES).filter(k =>
    (!CONF.menOnly || TYPES[k].sex === 'm') && !(G.opts.banYakuza && k === 'yakuza')
    // 子どもはひとりでは来ない（作者指定）＝必ず親のあとに続けて湧かせる
    && k !== 'kodomo'
    // 子連れの家族は「刺青・ヤクザお断り」を掲げ、子供料金が高すぎない店にだけ来る（作者指定）
    && !(k === 'oyako' && !(G.opts.banYakuza && kidFeeOK())));
  // サウナがあるとサウナ好きが来やすい
  // ※TYPES の全キーぶん必ず書くこと。1つでも欠けると重みの合計が NaN になり、
  //   抽選が回らず keys[0]（＝常連のじいさん）だけが延々と来店してしまう
  // 夕凪湯は男性専用（CONF.menOnly=true で女性タイプは上のkeysから除外済み）。
  // obachan/ol の重みは第2章（menOnly:false＝女湯解放）用に残してある＝消すと解放時にNaNで抽選が壊れる
  const weights = { jisan: 26, oyaji: 24, obachan: 22, salaryman: 20, wakamono: 14, ol: 12, kinpatsu: 14, yakuza: 9,
                    oyako: 24, kodomo: 0 };
  if (hasCat('sauna')) { weights.oyaji += 6; weights.salaryman += 14; weights.wakamono += 16; weights.ol += 6; weights.kinpatsu += 8; weights.yakuza += 6; }
  if (kurodaAllyOn()) weights.salaryman += 12;   // 黒田が仲間＝会社帰りのサラリーマン客を回してくれる
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
    isChild: !!TYPES[tk].kid,          // 子ども＝小さく描き、料金は子供料金、浴室が汚れやすい
    // 湯温の好みは1人ごとに転がす（じいさんだけ個人差あり＝あつ湯派とぬる湯長湯派が混ざる）
    furoPref: TYPES[tk].furoPref + (TYPES[tk].furoVar ? rand(-TYPES[tk].furoVar, TYPES[tk].furoVar) : 0),
    tebura: Math.random() < 0.45,      // 手ぶらで来た客。セットがあれば買う／無ければ不満
    // フェーズ3：“ないものねだり”。ミスト・塩・熱波師を欲しがる客が一定数いる
    // （設置・獲得しなくてもゲーム進行は詰まらないが、満足度＝評判の伸びがそのぶん重くなる）
    wantsMist: Math.random() < CONF.wantMistRate,
    wantsShio: Math.random() < CONF.wantShioRate,
    wantsNappa: Math.random() < CONF.wantNappaRate,
    // フェーズ4：上位志向の客（10%）。いつでも「今より上の設備」を求める＝満足の天井が常に少し下がる。
    // 全部を満たす日は来ない＝評判の伸びを構造的に鈍らせ、クリアを遠くする（作者指定）
    snob: Math.random() < CONF.snobRate,
    // 初めて暖簾をくぐる客か、行きつけにしている常連か。
    // 割合は開店時に決めておく（今日はじめて常連になった人が、その日のうちにもう一度来ないように）
    isNew: Math.random() >= (G.repeatShareToday || 0),
  });
  /* 動線：来る客は入口の右手から歩いてくる（帰る客は左へ抜ける＝出入りがぶつからない）。
     外の行列も入口の右に伸びるので、来店の列と帰り道が交差しない */
  c.px += T * 2.2;
  c.outside = true;
  // 受入キャパ確認。ロッカーが埋まりきっている間は新しい客を入れられない
  if (lockersFull()) {
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
  // 子連れのお父さんの後ろには、必ず子どもが続く（作者指定＝子どもひとりでは来ない）
  if (tk === 'oyako' && !forceKey) spawnCustomer('kodomo');
}

/* 番台の前に立てるのは1人だけ。2人目以降は店の外＝入口から右の壁沿いに並ぶ。
   外の行列が伸びているほど「捌けていない＝機会損失」がひと目で分かる */
function outsideSpots() {
  const out = [];
  for (let i = 1; i <= 6; i++) {
    const x = CONF.entrance.x + i;
    if (x > CONF.W - 1) break;
    out.push({ x, y: CONF.H - 1 });
  }
  return out;
}
function isOutsideSpot(s) { return !!s && s.y === CONF.H - 1 && s.x !== CONF.entrance.x; }
function queueSpots() { return [bandaiFront(), ...outsideSpots()]; }

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
        if (hasWorking('cooler')) plan.push(['drink', 0]);   // サウナ上がりの給水（冷水機まで歩いて飲む）
        if (hasCat('mizu')) plan.push(['mizu', st(1.5, 2.5)]);
        if (hasCat('rest')) plan.push(['rest', st(3, 5)]);
      }
    } else { c.noSauna = true; }
  } else if (hasCat('rest') && Math.random() < .3) plan.push(['rest', st(2, 4)]);
  // 湯から上がったあと、脱衣所のマッサージチェアで一息ついてから着替える客（作者指定＝ちゃんと座らせる）
  if (hasWorking('massage') && Math.random() < .35) plan.push(['massage', rand(2.5, 4)]);
  return plan;
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
  if (d.cat === 'furo') s += d.old ? 0 : near(t, furoPrefOf(c));
  // 水風呂だけは水温の一致を強めに見る。温度を弄れない＝「合う方の槽を選ぶ」以外に好みを満たす道がなく、
  // ★の差（シングルは★5）に負けて、寒すぎる槽へ入って満足度を落とす客が出てしまうため
  else if (d.cat === 'mizu') s += near(t, idealCold(c)) * 1.5;
  else if (d.cat === 'sauna') s += d.gentle ? 6 : near(t, c.type.saunaPref);
  return s;
}
function findFreeEquip(cat, c) {
  // 列の奥に埋まって手前が空いていない台（ロッカー・洗い場を並べた時の奥側）は選ばない
  // 'massage' だけは種類(cat)ではなく設備そのものを指す予定＝脱衣所の他の設備(ロッカー等)と混ざらないように
  const match = cat === 'massage' ? (e => e.id === 'massage') : (e => EQ[e.id].cat === cat);
  const cands = G.equip.filter(e => match(e) && e.cond > 0 && EQ[e.id].cap > 0
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
    const pref = furoPrefOf(c);
    const temp = def.temp ?? 42, diff = Math.abs(temp - pref);
    c.sat += diff <= 1 ? 5 : diff <= 3 ? 2 : -Math.min(diff, 5);
    // 「ぬるい」は“その客にとって”ぬるい時だけ言わせる（38℃を好む客に文句を言わせない）
    c.tempReact = (temp >= 44 && pref < 43) ? 'hot'
                : (pref - temp >= 3) ? 'nuru'
                : diff <= 1 ? 'atsu' : null;
  } else if (cat === 'mizu') {
    const temp = item.temp ?? def.temp ?? 15;
    const diff = Math.abs(temp - idealCold(c));
    c.sat += diff <= 2 ? 4 : diff <= 5 ? 1 : -3;
    c.tempReact = temp <= 14 ? 'kinkin' : temp >= 20 ? 'nurui' : null;
  } else if (cat === 'sauna') {
    if (def.gentle) {
      // ミスト・塩サウナは“別ジャンル”。熱さの好みでは評価されず、誰が入ってもそこそこ気持ちいい
      c.sat += 4;
    } else {
      const temp = item.temp ?? def.temp ?? 90, diff = temp - c.type.saunaPref, ad = Math.abs(diff);
      c.sat += ad <= 4 ? 5 : ad <= 10 ? 2 : -Math.min(Math.round(ad / 2), 8);
      // atsusa=好みより熱すぎ(不満) / nurusa=ぬるすぎ / gekinetsu=許容範囲の高温を堪能(満足)
      c.tempReact = diff >= 12 ? 'atsusa' : diff <= -12 ? 'nurusa' : (temp >= 100 ? 'gekinetsu' : null);
    }
    // サウナに給水（冷水機）がないと、いいサウナでも満足しきれない
    if (!hasWorking('cooler')) c.sat -= 2;
    /* 熱波師のアウフグース。決戦仕様の一台に限り満足度が上乗せ。
       ※以前はマッサージチェアの分岐の中に書かれていて、一度も発動していなかった */
    if (item.id === 'sauna_sp' && nappaOn()) { c.sat += 3; if (!c.bub && Math.random() < .3) bubble(c, pick(LINES.aufguss)); }
  } else if (item.id === 'massage') {
    // マッサージチェア＝¥100を入れて座る。売上はここで立つ（座った客からだけ取る）
    c.sat += 5;
    G.cash += 100; G.today.amenRev += 100; G.today.amenN++; G.today.revenue += 100;
    c.massaged = true;
  }
  /* 周辺の汚れ。薄い汚れは数えない（作者指定）＝薄いうちはプレイヤーに掃除する手がなく、
     見えた瞬間に怒られるのは理不尽だった。こびり付いた濃い汚れだけが客の目に入る */
  if (c.dirtHits < 3) {
    const nearD = G.dirts.filter(p => isThickDirt(p)
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
      if (G.today.voices.length < 6) G.today.voices.push(`⚠ ${c.type.name}「${line}」`);
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
      else bubble(c, pick(LINES.saunaGood));
    }
    else if (cat === 'mizu') {
      if (c.tempReact === 'kinkin') bubble(c, pick(LINES.mizuKinkin));
      else if (c.tempReact === 'nurui') { gripe('temp'); gripeBubble(c, pick(LINES.mizuNurui), 'temp'); }
      else bubble(c, pick(LINES.mizuGood));
    }
    else if (cat === 'wash') bubble(c, pick(def.old ? LINES.washOld : LINES.washGood));
    else if (cat === 'rest') bubble(c, pick(LINES.rest));
    else if (item.id === 'massage') bubble(c, pick(LINES.massageGood));
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
      if (G.today.voices.length < 6) G.today.voices.push(`${c.type.name}「${pick(tLines)}」`);
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
      && Math.random() < (c.isChild ? CONF.dirtChanceKid : CONF.dirtChance) * cleanFactor() && G.dirts.length < CONF.dirtMax) {
    /* 汚れが落ちるのは「掃除しに行けるマス」だけ。しかも1マスに1つまで。
       壁際などで誰もたどり着けないマスに落ちると、主人公もバイトも一生掃除できず、
       汚れが上限まで溜まったまま店が永久に「汚い店」になる（実測で発生した） */
    const reach = reachableSet();
    const ts = approachTiles(item).filter(p =>
      reach.has(p.y * CONF.W + p.x) && !G.dirts.some(d => d.x === p.x && d.y === p.y));
    if (ts.length) { const p = pick(ts); G.dirts.push({ x: p.x, y: p.y, t: G.minutes }); }   // t＝落ちた時刻（放置判定に使う）
  }
  c.use = null;
}

// そのカテゴリの設備が「存在する」か（故障中も含む）
function catExists(cat) {
  const match = cat === 'massage' ? (e => e.id === 'massage') : (e => EQ[e.id].cat === cat);
  return G.equip.some(e => match(e) && EQ[e.id].cap > 0 && usable(e));
}

/* 満員 or 故障で使えない → その設備の前まで歩いて行って並ぶ */
function goWaitFor(c, cat, dur) {
  c.plan.unshift([cat, dur]);
  c.state = 'waitEquip'; c.waitT = 0; c.waitNag = 0;
  const matchW = cat === 'massage' ? (e => e.id === 'massage') : (e => EQ[e.id].cat === cat);
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
  c.path = ap.path;
  c.rackKind = kind; c.rackDir = dir;
  c.state = 'atRack'; c.timer = 0.7;
  return true;
}

/* ---- 「置くだけで効く設備」を、実際に使いに行かせる（冷水機・扇風機・洗面所） ----
   満足度そのものは帰り際にまとめて効いている（customerLeave）。ここは“画”のための振る舞い＝
   サウナ上がりに水を飲み、湯上がりに扇風機で涼み、着替えてから鏡の前で髪を乾かす。
   1台につき同時に1人まで（pasBy に客の id を入れて場所取りする） */
const PAS_USE = {
  drink: { id:'cooler',   dur:[1.4, 2.6], say:0.35 },   // 冷水機で給水
  fan:   { id:'fan_bath', dur:[3.5, 6.0], say:0.30 },   // 扇風機の前でひと涼み
  sink:  { id:'sink',     dur:[3.0, 5.0], say:0.30 },   // 洗面所で髪を乾かす
  scale: { id:'scale',    dur:[2.0, 3.4], say:0.5 },    // 体重計に乗って一喜一憂（針がぐるっと振れる）
  gacha: { id:'gacha',    dur:[2.2, 3.6], say:0.6 },    // 子どもが¥100を入れて回す（売上になる）
  ehon:  { id:'ehon',     dur:[4.0, 7.0], say:0.6 },    // 絵本の棚の前に座って読む（子どもだけ）
};
const GACHA_PRICE = 100;      // ガチャガチャ1回（作者指定）
const GACHA_KID_RATE = 0.30;  // 子どものうち、回していく割合（作者指定）
// この3つは「置くだけ」に見えて実際に歩いて行く＝道が要る（needsAccess で使う）
const PAS_USE_IDS = new Set(Object.values(PAS_USE).map(p => p.id));
function pasLineFor(kind) {
  if (kind === 'drink') return LINES.coolerGood;
  if (kind === 'fan') return LINES.fanGood;
  if (kind === 'scale') return LINES.scaleGood;
  if (kind === 'gacha') return LINES.gachaGood;
  if (kind === 'ehon') return LINES.ehonGood;
  return G.opts.dryerFee ? LINES.dryerPaid : LINES.dryerFree;
}
function goPasUse(c, kind, next) {
  const p = PAS_USE[kind];
  const items = G.equip.filter(e => e.id === p.id && e.cond > 0 && !e.pasBy && usable(e));
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
  // 親の着替えを待つあいだ、絵本の棚の前に座って読む子ども（作者指定）
  if (c.isChild && !c.didEhon && Math.random() < 0.5 && goPasUse(c, 'ehon', 'leave')) { c.didEhon = true; return; }
  if (!c.didSink && Math.random() < 0.7 && goPasUse(c, 'sink', 'leave')) { c.didSink = true; return; }
  // 風呂上がり、つい体重計に乗って一喜一憂する（乗るまでが風呂、という田所の言い分）
  if (!c.didScale && Math.random() < 0.55 && goPasUse(c, 'scale', 'leave')) { c.didScale = true; return; }
  const vends = G.equip.filter(e => (e.id === 'vend1' || e.id === 'vend2') && e.cond > 0 && usable(e));
  const vend = vends.length ? pick(vends) : null;
  if (vend && Math.random() < c.type.milk) {
    const ap = pathToEquip(c, vend);
    if (ap) { c.path = ap.path; c.vendId = vend.id; c.state = 'toVend'; return; }
  }
  customerLeave(c);
}

function goLocker(c, dir) {
  // 壁一面に並べたロッカーは、手前に立てる1台の前で着替える（奥の列は開けに行けない）
  const lockers = G.equip.filter(e => EQ[e.id].cat === 'locker' && e.cond > 0 && usable(e));
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
function walkToExit(c) {
  const t0 = tileOf(c);
  const ent = CONF.entrance;
  c.path = (findPath(t0.x, t0.y, ent.x, ent.y) || []).concat([{ x: 0, y: CONF.H - 1 }]);
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
   清潔・混雑・値ごろ感・湯とサウナ・脱衣所・動線・接客の全部を同時に立てて初めて高得点になる。
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
  { key: 'dosen',  name: '動線',             hint: '客が使う順に設備を近く並べる' },
  { key: 'omote',  name: 'おもてなし',       hint: '愛想のいいバイト・アメニティを安く' },
];

/* ---- 料金の値ごろ感（作者指定） ----
   適正値 +2.5 ／ 適正値より安い +3.5 ／ 適正値より高い 0。
   「適正値」＝客が受け入れる上限（worthFee など）と同じ¥100の段。
   その1段でも下げれば「安い」＝満点、超えたら一発で0。入浴料・子供料金・サウナ料の3本立て。 */
const FEE_FAIR = 2.0, FEE_CHEAP = 3.0;   // 3本とも「適正より安い」で9点。残り1点は黒字経営（作者指定）
function feeScore(price, fair) { return price > fair ? 0 : price > fair - 100 ? FEE_FAIR : FEE_CHEAP; }

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
  if (hasWorking('sink')) {
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
function cospaParts() {
  const o = G.opts;
  const list = [];
  const fw = worthFee();
  list.push({ name: '入浴料', v: feeScore(o.fee, fw), note: `¥${o.fee}（適正 ¥${fw}）` });
  const kw = kidFeeCap();
  const kf = o.kidFee || KID_FEES[0];
  list.push({ name: '子供料金', v: kf > kw ? 0 : kf === kw ? FEE_FAIR : FEE_CHEAP, note: `¥${kf}（適正 ¥${kw}）` });
  // サウナがまだ無い店は、サウナ料で損も得もしない（サウナ自体の点で評価される）
  if (!hasCat('sauna')) list.push({ name: 'サウナ料金', v: FEE_FAIR, note: 'サウナがない' });
  else {
    const sw = worthSaunaFee();
    list.push({ name: 'サウナ料金', v: feeScore(o.saunaFee, sw), note: `¥${o.saunaFee}（適正 ¥${sw}）` });
  }
  return { list, total: list.reduce((a, b) => a + b.v, 0) };
}

/* ---- 動線＝設備の並び順（作者指定） ----
   浴室入口→洗い場→風呂→サウナ→水風呂→ととのいイス。
   となり合う工程の「いちばん近い設備どうしの距離」を測り、3マス以内なら+3、4マス以内なら+1。
   4本ぜんぶ近ければ12点ぶん取れるが上限10＝どこか1本が遠くても他で埋められる余地を残してある。
   距離は設備のふちどうしの歩数（となり合っていれば1マス）。 */
function equipRect(e) { const d = EQ[e.id]; return { x1: e.x, y1: e.y, x2: e.x + d.w - 1, y2: e.y + d.h - 1 }; }
function rectDist(a, b) {
  return Math.max(0, Math.max(a.x1 - b.x2, b.x1 - a.x2)) + Math.max(0, Math.max(a.y1 - b.y2, b.y1 - a.y2));
}
function liveOf(cat) { return G.equip.filter(e => EQ[e.id].cat === cat && !e.dead && e.cond > 0); }
// 脱衣所の備品（ロッカーは数えない・作者指定）。洗面所・体重計・扇風機・自販機・テレビなど
function datsuiGoods() {
  return G.equip.filter(e => EQ[e.id].room === 'datsui' && EQ[e.id].cat !== 'locker'
    && !e.dead && e.cond > 0);
}
// そのカテゴリどうしで、いちばん近い組み合わせの距離（片方でも無ければ null＝測れない）
function catDist(a, b) {
  const A = Array.isArray(a) ? a : liveOf(a).map(equipRect);
  const B = liveOf(b).map(equipRect);
  if (!A.length || !B.length) return null;
  let m = Infinity;
  for (const p of A) for (const q of B) m = Math.min(m, rectDist(p, q));
  return m;
}
function dosenParts() {
  // 浴室の入口＝脱衣所とのあいだのガラス引き戸（浴室側の1マス）
  const doorRect = [{ x1: CONF.doorX, y1: CONF.divideY - 1, x2: CONF.doorX, y2: CONF.divideY - 1 }];
  const legs = [
    { name: '入口 → 洗い場', d: catDist(doorRect, 'wash') },
    { name: '風呂 → サウナ', d: catDist('furo', 'sauna') },
    { name: 'サウナ → 水風呂', d: catDist('sauna', 'mizu') },
    { name: '水風呂 → イス', d: catDist('mizu', 'rest') },
  ];
  for (const l of legs) {
    // 4本すべて3マス以内で10点ちょうど。1本でも遠いと満点は取れない（作者指定でシビアに）
    l.v = l.d == null ? 0 : l.d <= 3 ? 2.5 : l.d <= 4 ? 1.2 : 0;
    l.note = l.d == null ? 'どちらかが無い' : `${l.d}マス`;
  }
  return { list: legs, total: legs.reduce((a, b) => a + b.v, 0) };
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
    const up = Object.entries(EQ).filter(([id, d]) => d.cat === cat && (d.q || 1) > best
      && (d.rep || 0) <= G.rep && !d.old && id !== DUEL_ONLY_EQ).sort((a, b) => a[1].price - b[1].price)[0];
    return up ? `${up[1].name}に買い替えると伸びる` : '種類を増やすほうが早い';
  };
  switch (key) {
    case 'clean': {
      const d = dirtCounts();
      // 営業中に汚れを拭けるのはバイトだけ（主人公は番台から動けない）
      if (d.thick) return G.roster.length ? `濃い汚れが${d.thick}つ。バイトが足りていない`
        : `濃い汚れが${d.thick}つ。拭けるのはバイトだけ`;
      if (d.thin >= CONF.dirtThinN) return `薄い汚れが${d.thin}つ。濃くなる前に拭く`;
      // 満点には観葉植物が要る（作者指定）＝床が綺麗なだけでは10点にならない
      if (!G.equip.some(e => e.id === 'plant1' && e.cond > 0 && usable(e))) return '観葉植物が無いと8点止まり';
      /* 掃除の人手が客数に足りていないと、点そのものが大きく削られる（バイト0なら1.5点どまり） */
      const need = Math.max(1, Math.ceil((t.paid || 0) / 25));
      if (!G.roster.length) return 'バイトを雇わないと点が伸びない';
      if (G.roster.length < need) return `客${t.paid || 0}人なら、バイトはあと${need - G.roster.length}人`;
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
      if (furoKindCount() < 3) return 'あつ湯とぬる湯を揃えると伸びる';
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
      if (!hasWorking('sink')) return '洗面所を置くと大きく伸びる';
      if (n < 6) return `脱衣所の備品あと${6 - n}個で満点`;
      return hasWorking('massage') ? '脱衣所はもう十分' : 'マッサージチェアで満点に届く';
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
function scaleScore(cat, want, per, max) {
  const cap = liveOf(cat).reduce((a, e) => a + (EQ[e.id].cap || 0), 0);
  if (!cap) return 0;
  const r = want / cap;                                   // 1席あたりの人数
  return clamp((per * 2 - r) / per, 0, 1) * max;          // r<=per で満点、r>=per*2 で0点
}
// 収容の内訳（データ画面の▶に出す）
function scaleNote(cat, want, per) {
  const cap = liveOf(cat).reduce((a, e) => a + (EQ[e.id].cap || 0), 0);
  return { cap, want, r: cap ? want / cap : Infinity, per };
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
  const dirtAvg = t.dirtN ? t.dirtSum / t.dirtN : dirtCounts().thick;
  const dirtScore = clamp(10 - dirtAvg * 2.4 - dirtAvg * dirtAvg * 0.5, 0, 10);
  const hands = clamp(G.roster.length / Math.max(paid / 25, 1), 0, 1);
  s.clean = dirtScore * (0.15 + 0.85 * hands);
  if (!G.equip.some(e => e.id === 'plant1' && e.cond > 0 && usable(e))) s.clean = Math.min(s.clean, 8);

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
  const bigDatsui = (hasWorking('sink') ? 1.2 : 0) + (hasWorking('massage') ? 1 : 0)
    + (hasWorking('vend1') ? 0.4 : 0) + (hasWorking('vend2') ? 0.4 : 0);
  s.datsui = clamp(Math.min(gd, 6) / 6 * 4 + Math.min(bigDatsui, 3)
    + clamp(lockerCapacity() / Math.max(paid * 0.35, 1), 0, 1) * 3, 0, 10);

  /* ── ととのいスペース：質5＋脚数3＋種類2（作者指定）。
     3万のベンチを5脚並べるより、いいイスを置くほうが効く */
  const chairs = liveOf('rest');
  s.rest = !chairs.length ? 0 : clamp(
    bestQ('rest') * 1.25 + scaleScore('rest', wantSauna, 6, 3)
    + Math.min(new Set(chairs.map(e => e.id)).size - 1, 2), 0, 10);

  // ── 動線：4本すべて3マス以内で満点（1本でも遠いと満点は取れない・作者指定）
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
  const add = (l, v, sub) => p.push({ l, v, sub });
  if (!G.opts.banYakuza)
    add('入墨・ヤクザが入店できる', 30,
      kitoAccepted() ? '鬼頭と交わした約束がある' : '運営メニューで「お断り」にすれば消える');
  const olds = G.equip.filter(e => EQ[e.id].old && !e.dead);
  if (olds.length) add('親父の代からの古い設備', 10,
    olds.map(e => EQ[e.id].name).slice(0, 2).join('・') + (olds.length > 2 ? ` ほか${olds.length - 2}台` : ''));
  const broken = G.equip.filter(e => e.cond <= 0);
  if (broken.length) add('故障したまま放置している設備', 10, `${broken.length}台。修理すれば消える`);
  if (hasCat('sauna') && !hasMat()) add('サウナマットがない', 5, '浴室に置き場を設置する（無料）');
  if (!hasAkasuri()) add('垢すりタオルがない', 5, '浴室に置き場を設置する（無料）');
  /* 「ドライヤー有料 −2」「アメニティが高い −10」はここから外した（作者指定）。
     高い＝一発で引かれる、ではなく、1品ごとの評価（amenityParts）が
     「おもてなし」の3点ぶんとして増減する形にしてある */
  return p;
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
   「設備を入れたのに評判が動かない」という不可解な壁になっていたので撤廃した（作者指定）。 */
function addRep(d) { G.rep = clamp(G.rep + d, 0, 100); }

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
function worthFee() {
  const r = G.rep;
  if (r <= 50) return 600;
  if (r <= 60) return 700;
  if (r <= 80) return 800;
  if (r <= 90) return 900;
  return FEE_CEIL;   // 1000
}
// 料金への不満の強さ。0=不満なし。充実度が上がるほど小さくなる
function feeGripe() { return Math.max(0, (G.opts.fee - worthFee()) / 100); }
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
  // フェーズ2：目安超過の痛みを2倍に強化（¥100超過あたり-2→-4）
  return Math.round((FEE_BASE - G.opts.fee) / 100 * 3) - Math.round(feeGripe() * 4 + saunaFeeGripe() * 2);
}

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
  if (!hasWorking('sink')) cands.push([Math.random() < 0.65 ? 'hintDryer' : 'hintLotion', 1.6]);
  if (hasCat('sauna') && !hasWorking('cooler')) cands.push(['hintCooler', 2.0]);
  if (!hasCat('rest')) cands.push(['hintRest', 1.6]);
  /* 脱衣所の備品が無い（作者指定）。「牛乳ないの？」のように名指しで言わせる＝
     何を置けばいいのかが、そのままカタログへの案内になる */
  if (!hasWorking('vend1')) cands.push(['hintMilk', 1.5]);
  if (!hasWorking('fan_bath')) cands.push(['hintFan', 1.1]);
  if (!hasWorking('scale')) cands.push(['hintScale', 0.7]);
  if (!hasWorking('tv')) cands.push(['hintTv', 0.7]);
  if (hasWorking('vend1') && !hasWorking('vend2')) cands.push(['hintDrink', 0.8]);
  if (!hasWorking('massage')) cands.push(['hintMassage', 0.6]);
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
  const plants = G.equip.filter(e => e.id === 'plant1').length;
  c.sat += Math.min(plants * 1.5, 6);
  /* 動線（作者指定）。1回の来店で歩かされたマス数で判定する。
     設備をばらばらに置くと、客はそのぶん館内を歩かされる＝それが不満として返ってくる。
     ロッカー→洗い場→湯→サウナ→水風呂→イスが近くにまとまっているほど良い。
     玄人のサウナ客は動線にうるさく、基準が厳しい */
  const tiles = (c.walkPx || 0) / T;
  const pro = c.wantsSauna && (c.type.likesSauna || 0) >= 0.9;
  const lim = pro ? CONF.dosenProTiles : CONF.dosenTiles;
  if (tiles > lim) {
    // 基準をどれだけ超えたかで痛みが増す（最大2倍まで）
    c.sat -= Math.round(CONF.dosenHit * Math.min(tiles / lim, 2));
    gripe('dosen');
    if (!c.bub) hintBubble(c, pick(pro ? LINES.dosenPro : LINES.dosen));
    if (G.today.voices.length < 6 && Math.random() < 0.4)
      G.today.voices.push(`⚠ ${c.type.name}「${pick(pro ? LINES.dosenPro : LINES.dosen)}」`);
  }
  // フェーズ3：ないものねだり（ミスト・塩・熱波師）。帰り際に「あれが無かったな…」とがっかりする
  if (c.wantsMist && !hasWorking('sauna_mist')) { c.sat -= 3; gripe('lack'); if (!c.bub && Math.random() < .5) bubble(c, pick(LINES.wantMist)); }
  if (c.wantsShio && !hasWorking('sauna_shio')) { c.sat -= 3; gripe('lack'); if (!c.bub && Math.random() < .5) bubble(c, pick(LINES.wantShio)); }
  if (c.wantsSauna && c.wantsNappa && !nappaOn()) { c.sat -= 2; gripe('lack'); if (!c.bub && Math.random() < .5) bubble(c, pick(LINES.wantNappa)); }
  // フェーズ3：バイトの愛想。感じのいい接客は帰り際の印象に少し乗る（店にいる中でいちばん愛想のいい子基準・最大+2）
  const present = G.staff.filter(s => !(s.lateT > 0) && s.emp);
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
  if (hasWorking('sink')) {
    if (!G.opts.dryerFee) c.sat += 2;
    else if (Math.random() < 0.65) { const p = G.opts.dryerFee; G.cash += p; G.today.amenRev += p; G.today.amenN++; G.today.revenue += p; }
    // 化粧水・乳液は「置く／置かない」だけ（作者指定で販売は廃止）。置いてあれば喜ぶ
    if (G.opts.lotionOn !== false) c.sat += 2;
  }
  // ※マッサージチェアの¥100は「実際に座った時」に入る（customerLeaveでの一律抽選は廃止）
  // お気に入りの設備があった客は、たまにそれを口にする
  if (!c.bub && pasLine && Math.random() < 0.22) {
    const key = { poster:'posterGood', shogi:'shogiGood', scale:'scaleGood', tv:'tvGood',
                  massage:'massageGood', sink:'lotionGood', fan_bath:'fanGood' }[pasLine];
    if (key && LINES[key]) bubble(c, pick(LINES[key]));
  }
  if (!c.bub && hasWorking('sink') && Math.random() < 0.12) bubble(c, pick(G.opts.dryerFee ? LINES.dryerPaid : LINES.dryerFree));
  if (!c.bub && hasWorking('cooler') && Math.random() < 0.10) bubble(c, pick(LINES.coolerGood));
  // フェーズ4：上位志向の客（10%）＝どんな店でも「上には上がある」と少し不満げに帰る。
  // 満足の天井が常に下がる＝評判の伸びが構造的に鈍る（作者指定）
  if (c.snob) {
    c.sat -= 6;
    if (!c.bub && Math.random() < 0.35) {
      const line = pick(LINES.snobWant);
      bubble(c, line);
      if (G.today.voices.length < 6 && Math.random() < 0.5) G.today.voices.push(`💎 ${c.type.name}「${line}」`);
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
      if (G.today.voices.length < 6) G.today.voices.push(`⚠ ${c.type.name}「${line}」`);
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
  c.sat = clamp(c.sat, 0, 100);
  G.today.satSum += c.sat; G.today.satN++;
  addSegSat(c);
  /* 行きつけになるか、足が遠のくか。
     気持ちよく帰った新規の一部が常連に変わり、がっかりした常連はそのぶん離れる＝
     「客をどれだけ集めたか」より「集めた客をどれだけ満足させたか」が効いてくる */
  if (c.isNew) {
    if (c.sat >= CONF.regularSatKeep && Math.random() < CONF.regularConvert) {
      G.regulars = clamp(G.regulars + 1, 0, CONF.regularMax); G.today.regularsUp++;
    }
  } else if (c.sat < CONF.regularSatLose) {
    G.regulars = clamp(G.regulars - 1, 0, CONF.regularMax); G.today.regularsDown++;
  }
  // 帰り際の一言。ヒントの吹き出しが出ている時は上書きしない（赤枠を消さない）
  if (c.sat >= 70) { if (!c.bub) bubble(c, pick(LINES.leaveGood)); if (G.today.voices.length < 6 && Math.random() < .4) G.today.voices.push(`${c.type.name}「${pick(LINES.leaveGood)}」`); }
  else if (c.sat < 45) {
    const bad = pick(LINES.leaveBad);
    if (!c.bub) bubble(c, bad);
    logGripe(c.type.name, bad, 'leaveBad');                              // 不満顔で帰った客は赤文字で知らせる
    if (G.today.voices.length < 6 && Math.random() < .5) G.today.voices.push(`${c.type.name}「${bad}」`);
  }
  c.state = 'toExit';
  walkToExit(c);
}

/* 強面・刺青の客が浴室に入っている（脱衣を済ませて中にいる）か */
function yakuzaPresent() {
  return G.customers.some(o => o.typeKey === 'yakuza' && o.mode === 'towel');
}
/* 子どもが浴室にいるか。「刺青・ヤクザお断り」にすると家族連れが増える＝
   そのぶん、静かに浸かりたい客からは不満も出る（作者指定＝どちらを取るかの選択） */
function kidPresent() {
  return G.customers.some(o => o.isChild && o.mode === 'towel');
}

function updateCustomer(c, dt) {
  // 強面・刺青の客が中にいると、居合わせた一般客が怖がって満足度を落とす（運営メニューの「お断り」で避けられる）
  if (!c.sawYakuza && c.typeKey !== 'yakuza' && c.mode === 'towel' && yakuzaPresent()) {
    c.sawYakuza = true; c.sat = clamp(c.sat - 12, 0, 100);   // フェーズ2で-7→-12に強化
    if (!c.bub) hintBubble(c, pick(LINES.yakuzaGripe));
  }
  // 子ども連れが騒がしくて落ち着かない客（親子連れ本人と、寛容な客は言わない）
  if (!c.sawKid && !c.isChild && c.typeKey !== 'oyako' && c.mode === 'towel' && kidPresent()
      && (c.type.tolerant || 0) < 6) {
    c.sawKid = true; c.sat = clamp(c.sat - 8, 0, 100);
    if (!c.bub) bubble(c, pick(LINES.kidGripe), 3.0);
  }
  // 子どもは湯でも脱衣所でもよく喋る（にぎやかさの演出）
  if (c.isChild && !c.bub && Math.random() < dt * 0.12) bubble(c, pick(LINES.kidLine), 2.4);
  switch (c.state) {
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
      c.sat -= dt * 0.12;
      if (c.waitT > 25 && !c.bub && Math.random() < .02) bubble(c, pick(LINES.crowded));
      // 待ちくたびれて帰る＝取り逃がし。受付が追いつかないと外の行列がそのまま損になる
      if (c.waitT > 45) {
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
      if (stepMove(c, dt)) { c.state = 'using'; c.timer = c.use.dur; }
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
        const pr = c.vendId === 'vend2' ? 180 : 130;
        G.cash += pr; G.today.milk++; G.today.milkRev += pr; G.today.revenue += pr;
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

/* ---- 主人公 ---- */
function makePlayer() {
  const s = playerSpot();
  const p = makeEntity(s.x, s.y, CONF.playerSpd);
  Object.assign(p, { kind: 'player', task: null, timer: 0, target: null });
  return p;
}
function updatePlayer(p, dt) {
  // 支払い待ちが最優先
  if (G.payQueue.length && (!p.task || p.task !== 'bandai')) {
    p.task = 'bandai'; p.target = null;
    const s = playerSpot(), t0 = tileOf(p);
    const pth = findPath(t0.x, t0.y, s.x, s.y);
    if (!pth) stuckBubble(p, '番台に戻れない…');   // 自分が番台へ帰れない＝会計が止まる
    p.path = pth || [];
  }
  if (p.task === 'bandai') {
    const done = stepMove(p, dt);
    if (done) {
      const front = G.payQueue[0];
      const fs = queueSpots()[0];
      if (front && front.state === 'pay') {
        const t0 = tileOf(front);
        if (t0.x === fs.x && t0.y === fs.y) {
          p.timer += dt;
          if (p.timer >= 0.7) {
            p.timer = 0;
            const extra = front.wantsSauna && hasCat('sauna') ? G.opts.saunaFee : 0;
            if (front.wantsSauna && hasCat('sauna')) G.today.sauna++;
            // 子どもは子供料金（作者指定）。サウナには入らないので上乗せもない
            let take = front.isChild ? (G.opts.kidFee || 0) : G.opts.fee + extra;
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
            G.cash += take; G.today.paid++; G.today.revenue += take;
            if (front.isNew) G.today.newN++; else G.today.repeatN++;
            addFloater(bandai().x * T + T / 2, bandai().y * T - 6, '+' + yen(take));
            bubble(front, pick(LINES.pay), 1.6);
            G.payQueue.shift();
            goLocker(front, 'in');
            for (const c2 of G.payQueue) if (c2.state === 'pay') { sendToQueueSpot(c2); c2.state = 'toPay'; }
          }
        }
      } else if (!G.payQueue.length) { p.task = null; }
    }
    return;
  }
  /* 営業中、主人公は番台から離れない（作者指定）。
     ひとりで会計をさばきながら床まで拭いて回れるなら、バイトを雇う理由が無くなる。
     ＝営業中に落ちた汚れを片づけられるのはバイトだけ。掃除は「人を雇う」ことでしか買えない。
     開店前（準備中）は自分で拭いて回るが、それも1日に拭ける数に限りがある（PREP_CLEAN_MAX） */
  if (G.phase === 'biz') {
    const t0 = tileOf(p), home = playerSpot();
    if (!p.task && (t0.x !== home.x || t0.y !== home.y)) { p.task = 'home'; p.path = findPath(t0.x, t0.y, home.x, home.y) || []; }
    if (p.task === 'home' && stepMove(p, dt)) p.task = null;
    return;
  }
  maintain(p, dt, playerSpot());
}
/* 開店前に、主人公ひとりで拭いて回れる汚れの数（作者指定）。
   準備中は時間が無限に使えるので、ここに上限が無いと毎朝ぴかぴかになってしまう */
const PREP_CLEAN_MAX = 5;
/* 拭ける数を使い切って、番台まで戻ってきた夜＝そこで力尽きて寝ている（作者指定）。
   汚れが残っていようが、今日はもう動けない。掃除はバイトの仕事だと、絵で伝える */
function playerAsleep() {
  const p = G.player;
  if (G.phase !== 'prep' || !p || p.task) return false;
  if ((G.prepCleaned || 0) < PREP_CLEAN_MAX) return false;
  const t = tileOf(p), h = playerSpot();
  return t.x === h.x && t.y === h.y;
}
// 番台でうとうとしている印。💤 がゆっくり浮かんで消える
function drawSleep(p, rt) {
  const b = bandai();
  const x = b ? b.x * T + T / 2 + 4 : p.px;      // 突っ伏している頭のすぐ上
  const y = b ? b.y * T - 2 : p.py - 26;
  for (let i = 0; i < 2; i++) {
    const ph = ((rt * 0.45 + i * 0.5) % 1);
    ctx.globalAlpha = (1 - ph) * 0.9;
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
  const s = staffSpot(i);
  // スピードと慣れ（働きぶり）で足の速さが変わる。ふてくされ中はダラダラ歩く ※係数は叩き台
  const spd = CONF.staffSpd * (0.8 + (emp.spd || 3) * 0.07) * (0.9 + (emp.skill || 40) / 500) * (emp.sulk ? 0.8 : 1);
  const w = makeEntity(s.x, s.y, spd);
  Object.assign(w, { kind: 'staff', task: null, timer: 0, target: null, home: s, sidx: i, emp });
  // 真面目さが低いと遅刻してくる（真面目5=遅刻なし〜真面目1=3割弱）
  if (Math.random() < (5 - (emp.maji || 3)) * 0.07) w.lateT = rand(60, 200);
  return w;
}
function staffSpot(i) {
  // 脱衣所側の空きマスに待機
  const cands = [];
  for (let y = 7; y < CONF.H - 1; y++)
    for (let x = 1; x < CONF.W - 1; x++)
      if (walkable(x, y)) cands.push({ x, y });
  return cands[(i * 3 + 2) % Math.max(cands.length, 1)] || { x: 2, y: 8 };
}
function allWorkers() { return [G.player, ...G.staff].filter(Boolean); }
function claimedBy(target, self) { return allWorkers().some(w => w !== self && w.target === target); }

/* 掃除・待機（主人公とスタッフ共通）。
   ※主人公もバイトも「代金の受け取り」と「掃除」しかできない。
     壊れた設備は自分たちでは直せない（勝手に修理業者が来て、直して、代金を持っていく） */
function maintain(w, dt, home) {
  if (!w.task) {
    // 主人公が開店前に拭ける数には限りがある（それ以上は番台で待つ＝バイトの仕事）
    const tired = w.kind === 'player' && (G.prepCleaned || 0) >= PREP_CLEAN_MAX;
    // 拭ける数を使い切ったのに、まだ汚れが残っている＝そこで音を上げる（1晩に1回だけ）
    if (tired && G.dirts.length && !G.tiredSaid) {
      G.tiredSaid = true;
      bubble(w, pick(LINES.prepTired), 5.0);
      log(`🧹 ${PREP_CLEAN_MAX}つ拭いたところで手が止まった。残り${G.dirts.length}つはバイトの仕事だ`);
    }
    const avail = tired ? [] : G.dirts.filter(d => !claimedBy(d, w));
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
        if (pth) { w.task = 'clean'; w.target = d0; w.path = pth; w.timer = 7; break; }
      }
      // どの汚れにも道が通っていない＝設備で通路を塞いでいる。赤字で知らせる
      if (!w.task) stuckBubble(w, '汚れの所まで行けない…');
    } else {
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
        if (w.kind === 'player') G.prepCleaned = (G.prepCleaned || 0) + 1;
        killRoachNear(w, w.target);        // 拭いた場所のそばにいたら、その場で仕留める
        w.task = null; w.target = null;
      }
    }
  } else if (w.task === 'home') {
    if (stepMove(w, dt)) w.task = null;
  }
}
function updateStaff(dt) {
  for (const s of G.staff) {
    if (s.lateT > 0) {                              // 遅刻中＝まだ店に来ていない
      s.lateT -= dt;
      if (s.lateT <= 0) { toast(`⏰ ${s.emp.name}が遅刻してきた…`); log(`⏰ ${s.emp.name}が遅刻してきた`); }
      continue;
    }
    if (s.slackT > 0) { s.slackT -= dt; continue; }  // サボり中（真面目さが低いと起きる）
    // 真面目さが低いバイトは、手が空くとたまにサボる（毎秒 真面目1=4%〜真面目5=0%）
    if (s.emp && !s.task && G.dirts.length && Math.random() < (5 - s.emp.maji) * 0.01 * dt) {
      s.slackT = rand(8, 16);
      if (!s.bub) bubble(s, pick(['ふぅ…', 'ちょっと休憩…', '（スマホちら見）']));
      continue;
    }
    maintain(s, dt, s.home);
  }
}
/* 日給の合計（フェーズ3：人ごとにスペックで違う） */
function rosterWages() { return G.roster.reduce((a, e) => a + (e.wage || CONF.staffWage), 0); }

/* ============ 一日の流れ ============ */
function startDay() {
  G.phase = 'biz';
  G.minutes = 0;
  for (const d of G.dirts) d.t = -9999;    // 前日から持ち越した汚れは、開店の時点で「放置」扱い
  refreshDead();                 // 開店前に、道が通っていない設備を洗い直す
  G.today = newToday();
  // 融資の入金は enterPrep（朝の準備）で済ませてある。日報に「入金」の1行を出すのはここ（作者指定）
  if (G.loanInToday > 0) { G.today.loanIn = G.loanInToday; G.loanInToday = 0; }
  G.customers = []; G.payQueue = [];
  G.riotDone = false;              // 暴動は1日に1回まで（毎日ぶっ壊されたら立て直せない）
  for (const it of G.equip) { it.occ = Array(EQ[it.id].cap).fill(null); it.pasBy = null; }
  autoRepair();                    // 昨日の傷みで壊れたものがあれば、開店と同時に業者が来る
  G.player = makePlayer();
  G.staff = [];
  for (let i = 0; i < G.roster.length; i++) G.staff.push(makeStaff(i));
  // 求人広告を出した翌朝は、開店と同時に応募者3人が面接に来る
  if (G.jobAdDay && G.day >= G.jobAdDay) { G.jobAdDay = 0; openJobModal(); }
  // ── 今日の来訪者を1人だけ決める（田所 → 鬼頭 → 黒田 → 玲奈 の順に焦点が移る）
  G.benz = null; G.mika = null; G.mikaFired = false; G.mikajimeAt = null;
  G.npcs = G.npcs.filter(n => n.role === 'fixer');   // 作業中の修理業者は開店をまたいでも居残る（作者指定）
  G.visitKey = null; G.visitAt = null; G.visitFired = false;
  if (G.flags.reinaTV === 1) G.flags.reinaRumorAt = rand(120, 480);   // テレビ特集の翌日は常連が噂する
  const v = pickTodaysVisitor();
  if (v === 'mikajime') G.mikajimeAt = rand(120, 720);
  // 田所の顔合わせだけは開店まもなく（10〜12時台）。「暖簾を出して間もなく」の一幕なので
  else if (v) { G.visitKey = v; G.visitAt = (v === 'tadokoro' && !G.tadokoro.hello) ? rand(60, 190) : rand(150, 660); }
  // サラ金の集金は毎週水曜、開店直後にやってくる（作者指定＝毎日の取り立ては廃止）
  G.yamiFired = false;
  G.yamiAt = (G.yami && G.yami.debt > 0 && dayOfWeek(G.day) === 2) ? 30 : null;
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
  // 運営メニューの集客補正
  n += (FEE_BASE - G.opts.fee) / 100 * 2;   // 安いほど客が増える（基準は定額ボタンの真ん中¥700）
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
  G.plannedGuests = n;      // 新規／常連の振り分けはこの見込み数を母数にする
  G.repeatShareToday = repeatShare();
  G.stuckLogged = false;    // 「通路が塞がっている」の営業ログは1日1回だけ
  // 9時→23時。開店直後(9〜11時)は待ち時間が間延びするので少し底上げしてある
  const hw = [4, 4, 4, 4, 4, 4, 5, 6, 8, 9, 9, 8, 6, 4, 2];
  const hwSum = hw.reduce((a, b) => a + b, 0);
  G.spawnQueue = [];
  for (let i = 0; i < n; i++) {
    let r = Math.random() * hwSum, h = 0;
    for (let j = 0; j < hw.length; j++) { r -= hw[j]; if (r <= 0) { h = j; break; } }
    const m = h * 60 + rand(0, 60);
    if (m < 870) G.spawnQueue.push(m);
  }
  G.spawnQueue.sort((a, b) => a - b);
  G.adBoost = 0;
  // UI
  $('prepPanel').classList.add('hidden');
  $('selPanel').classList.add('hidden');
  $('confirmBar').classList.add('hidden');
  $('bizPanel').classList.remove('hidden');
  $('shopPanel').classList.remove('hidden');   // 営業中も設備を買える
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

function updateBiz(dt) {
  G.minutes += dt;
  /* 清潔度の採点用に「その日、床に平均いくつ汚れが転がっていたか」を測り続ける（新評判システム）。
     不満の声（dirty）の数で測ると、汚れ1つの脇を客が何度も通るだけで数百件に膨れ、
     満足度95の店が清潔度1点になってしまった（シム実測）。見るべきは、掃除できていたかどうか */
  const dcNow = dirtCounts();
  G.today.dirtSum += dcNow.thick * dt;        // 薄い汚れは数えない（作者指定）
  G.today.dirtN += dt;
  while (G.spawnQueue.length && G.spawnQueue[0] <= G.minutes) {
    G.spawnQueue.shift();
    spawnCustomer();
  }
  for (const c of [...G.customers]) updateCustomer(c, dt);
  updatePlayer(G.player, dt);
  updateStaff(dt);
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
  if (G.minutes >= (CONF.closeHour - CONF.openHour) * 60) closeDay();
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
  /* 数えるのは「みかじめ料を払った回数」（作者指定）。集金に来た回数（encounters）で数えると、
     突っぱねて設備を壊された回まで頭数に入り、1回しか払っていないのに田所が助けに来てしまう */
  if (k && !k.resolved && (k.paid || 0) >= 2 && tadokoroAllyOn()) {
    G.flags.lastMikaDay = G.day;
    log('🚗 黒塗りのベンツが乗りつけてきた…3度目の集金だ');
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
    // 新フロー：2回目の要求が済んだら、翌日に田所が異変を察して声をかけてくる（打ち明け→3回目で田所が動く）
    if (G.kito.paid >= 2 && !G.kito.resolved && !G.flags.tadokoroConsulted) G.flags.tadokoroConsultDay = G.day + 1;
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
    if (G.kito.paid >= 2 && !G.kito.resolved && !G.flags.tadokoroConsulted) G.flags.tadokoroConsultDay = G.day + 1;
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
/* 田所の来訪：初対面 → 要求（無茶ぶり）→ 達成報告 → …を3回 → 認められる */
/* 湯船の二人芝居を一度だけ流してから本題（モーダル）を開く。
   フラグで「その場面で一度きり」を保証する＝毎回の来訪で繰り返さない */
function bathCutThen(scenes, flagKey, next) {
  if (!scenes || G.flags[flagKey]) { next(); return; }
  G.flags[flagKey] = true;
  Sfx.bgmStop();
  Story.play(scenes, next);
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
  $('tadokoroInfo').innerHTML = TX.info;
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
    t.hello = true; t.nextDay = G.day + irand(2, 4);
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
  if (d && (G.day - (k.demandDay || 0)) >= KURODA_DEMAND_GIVEUP) {
    const alt = pickDemand('kuroda');
    if (alt && alt.key !== d.key) { openKuroda('swap', alt, d); return; }
  }
  if (d) { openKuroda('nag', d); return; }
  const nd = pickDemand('kuroda');
  if (nd && (k.done || 0) < KURODA_DEMAND_CLEAR) { openKuroda('ask', nd); return; }
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
  $('kurodaInfo').innerHTML = TX.info;
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
    k.nextDay = G.day + 1;
    addRep(DEMAND_REP_GAIN + 1);
    toast(`✅ 黒田の課題を達成した（${k.done}/${KURODA_DEMAND_CLEAR}）評判↑・数字↑`);
    log(`💼 黒田の課題を達成した（${demandLabel(arg)}）`);
  } else if (kind === 'hold') {
    k.nextDay = G.day + 1;
  } else {
    // フェーズ3：選択のあとにもうひと言（作者指定）。「数字で示す」は直近の収支を見て小言／賛辞が返ってくる
    let follow;
    if (arg === 'suuji') {
      k.stage = (k.stage || 0) + 1;
      const last = G.recentProfits && G.recentProfits.length ? G.recentProfits[G.recentProfits.length - 1] : 0;
      follow = last < 0
        ? `黒田は日報を一瞥して、電卓を叩く手を止めた。<br><br>「……<b>全然ダメじゃないか。</b>昨日の収支、赤字だぞ。数字は嘘をつかない。」<br><br><span class="opt-sub">（数字を積む姿勢↑。だが認めさせるには黒字を見せるしかない）</span>`
        : `黒田は日報にしばらく目を落とし、ふんと鼻を鳴らした。<br><br>「ほう……<b>お前なりに頑張ってるじゃないか。せいぜい頑張れ。</b>」<br><br><span class="opt-sub">（数字を積む姿勢↑＝決戦に近づく）</span>`;
    } else {
      G.najimi = clamp(G.najimi + KURODA_KEIEI_GAIN_NAJIMI, 0, 100);
      follow = `黒田は湯気の向こうの常連たちを眺め、電卓をしまった。<br><br>「……情で湯は沸かないぞ。<br>だが、まあ。客のあの顔は、数字にならない資産だ。」<br><br><span class="opt-sub">（常連との絆↑。黒田はまだ納得していない）</span>`;
    }
    k.nextDay = G.day + 1;
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
      StoryArt.tvTicker = '夕凪湯に世界一の熱波師！　連日の大行列';
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
      Story.play(STORY_NAPPA_MEET, () => {
        openSpecialCatalog();
        saveGame();
      });
      return true;
    }
    if (step === 2) {
      if (!hasWorking('sauna_sp')) {
        /* 常連たちのカンパ（作者指定）。自力で百万まで積んだ夜にだけ起きて、二百万に足りない分を街が埋める。
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
  $('reinaInfo').innerHTML = T.info;
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
    addBtn('🛁 断る（夕凪湯は売らない）', '孤高を貫く（投票対決の共感票が増える・評判↑）', () => resolveReina('buyout', 'refuse'));
    addBtn(`💰 ${yen(REINA_BUYOUT)}で売る…`, 'もうひとつの結末へ（親父は…）', () => openReina('sell'));
  } else if (kind === 'sell') {   // 売る直前の確認ゲート（誤操作で終わらせない）
    addBtn('🛁 やっぱり、売れない', '夕凪湯を守る（孤高ルートへ戻る）', () => resolveReina('buyout', 'refuse'));
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
const KAMPA_TRIGGER = 1000000;
const KAMPA_MAX = 1000000;
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
  ['reinaModal', 'reportModal', 'manageModal', 'dataModal', 'yamiModal', 'menuModal', 'sendenModal', 'loanModal']
    .forEach(id => { const el = $(id); if (el) el.classList.add('hidden'); });
  $('game-ui').classList.add('hidden');
  if (localStorage.getItem(SAVE_KEY)) $('btnContinue').classList.remove('hidden');
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
/* confirming=true＝「トップ画面へ」を押した後の確認。保存し忘れで進行を失わせない */
function renderMenu(confirming) {
  const box = $('menuBody'); box.innerHTML = '';
  if (confirming) {
    $('menuInfo').textContent = '保存していないぶんは消える。どうする？';
    box.appendChild(menuBtn('💾 保存してもどる', '', () => { saveGame(); closeMenu(); returnToTitle(); }));
    box.appendChild(menuBtn('保存せずもどる', 'danger', () => { closeMenu(); returnToTitle(); }));
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
     ※ストア（App Store / Google Play）の決済連携は未実装＝今はタップで即有効になる開発用スタブ */
  if (!(G.premium && G.premium.autoRepair)) {
    box.appendChild(menuBtn('🔧 オート修理を購入（課金・準備中）', '', () => {
      G.premium = G.premium || {};
      G.premium.autoRepair = true; G.premium.autoRepairOn = true;
      toast('🔧 オート修理を購入した！ 耐久5%で自動で業者が来る（費用は手動と同額）');
      log('🔧 オート修理を購入した。以後、傷んだ設備には自動で業者が来る');
      saveGame(); renderMenu(false);
    }));
  } else {
    const on = G.premium.autoRepairOn !== false;
    box.appendChild(menuBtn(on ? '🔧 オート修理 ON（購入済み）' : '🔧 オート修理 OFF（購入済み）', '', () => {
      G.premium.autoRepairOn = !on;
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
function careOn() { return !(G.flags && G.flags.ended); }
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
    localStorage.removeItem(SAVE_KEY);   // 本当のゲームオーバー＝「つづきから」は無い
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
  const amenityCost = Math.round(((G.opts.soapMode !== 'none' ? CONF.soapCostPerDay : 0)
                    + (hasWorking('sink') && G.opts.lotionOn !== false ? CONF.lotionCostPerDay : 0)
                    + (hasMat() ? 500 : 0) + (hasAkasuri() ? 500 : 0)) * keihiCut);
  // タオルも一律の定額（無料貸出の洗濯代という従量ぶんは廃止・作者指定）
  const towelCost = Math.round((G.opts.towel !== 'none' ? CONF.towelCostPerDay : 0) * keihiCut);
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
  G.cash -= util + water + loanPay + shiire + staffCost;   // 治療費は営業収支に含めない（私費）
  /* 資金ショート → 頼れるのは灰田だけ（銀行は貸してくれない）。10万刻みで足りるぶんだけ自動で借りる。
     限度は100万＝ここで借り切ってしまうと、次に足りなくなった日は本当に打つ手がない */
  while (G.cash < 0 && G.yami.debt < CONF.sarakinMax) { G.cash += CONF.sarakinUnit; G.yami.debt += CONF.sarakinUnit; t.autoYami += CONF.sarakinUnit; G.yami.met = true; }
  if (G.cash < 0) { G.cash = 0; t.unpaid = true; addRep(-2); }   // どこも貸してくれない日は、店の信用が落ちる
  // 設備の傷み（1日ぶん）
  const brokeToday = applyDailyWear();
  const profit = bathRev + saunaRev + milkRev + t.amenRev + t.towelRev + t.akasuriRev + t.soapRev + t.teburaRev
                 - util - water - loanPay - shiire - staffCost - (t.mikajime || 0) - (t.yamiPaid || 0) - (t.repairCost || 0);
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
  const income = bathRev + saunaRev + milkRev + t.amenRev + t.towelRev + t.akasuriRev + t.soapRev + t.teburaRev;
  // 入浴料も他の項目と同じ通常チップに統一（来店人数の内訳はラベルに収める）
  html += chip(`入浴 ${t.paid}人${mix}`, yen(bathRev));
  if (t.sauna) html += chip(`サウナ ${t.sauna}人`, saunaRev ? yen(saunaRev) : '無料');
  if (t.towelRev) html += chip(`タオル ${t.towelN}本`, yen(t.towelRev));
  if (t.teburaRev) html += chip(`手ぶら ${t.teburaN}人`, yen(t.teburaRev));
  if (t.soapRev) html += chip(`アメニティ ${t.soapN}人`, yen(t.soapRev));
  if (t.akasuriRev) html += chip(`垢すり ${t.akasuriN}本`, yen(t.akasuriRev));
  if (t.amenRev) html += chip(`ドライヤー等 ${t.amenN}回`, yen(t.amenRev));
  if (t.milk) html += chip(`牛乳 ${t.milk}本`, yen(milkRev));
  html += chip('収入 合計', yen(income), 'wide total');
  // 融資の振込は営業の売上ではないので、収支には混ぜず「別枠のお知らせ」として並べる（作者指定）
  if (t.autoYami) html += chip('💳 灰田から やむなく借入', '+' + yen(t.autoYami), 'wide');
  html += `</div>`;

  // ── 支払いの欄（チップ2列） ───────────────────
  html += `<div class="rep-sec out">▼ 支払い</div><div class="rep-grid">`;
  const outlay = util + water + shiire + staffCost + (t.repairCost || 0) + (t.loanPay || 0) + (t.mikajime || 0) + (t.yamiPaid || 0);
  html += chip('光熱費', '-' + yen(util), 'minus');
  if (water) html += chip('水道代', '-' + yen(water), 'minus');
  if (shiire) html += chip('仕入れ', '-' + yen(shiire), 'minus');
  if (staffCost) html += chip(`人件費 ${G.roster.length}人`, '-' + yen(staffCost), 'minus');
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
  // お客の声＝改善のヒント中心（クレーム・要望を先に、褒め言葉は後に・作者指定）
  if (t.voices.length) {
    const isClaim = s => /^(⚠|💎)/.test(s) ||
      s.includes('高い') || s.includes('欲しい') || s.includes('ないの') || s.includes('足りない') || s.includes('ほしい');
    const claims = t.voices.filter(isClaim), rest = t.voices.filter(s => !isClaim(s));
    const show = claims.concat(rest).slice(0, 4);
    html += `<div class="rep-voice">🗣 お客の声（改善のヒント）<br>${show.join('<br>')}</div>`;
  } else {
    html += `<div class="rep-voice">🗣 お客の声<br>（今日は特に不満の声はなかった）</div>`;
  }
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
    t2.hello = true; t2.nextDay = G.day + irand(2, 4);
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
  Sfx.bgm('prep');                 // 暖簾を下ろしたあとの夜の曲
  G.customers = []; G.payQueue = [];
  G.player = makePlayer();         // 準備中の主人公は掃除して回る（1日に拭ける数は PREP_CLEAN_MAX まで）
  G.prepCleaned = 0;               // 今夜これから拭いた数
  G.tiredSaid = false;             // 「もう動けない」の独り言は1晩に1回
  // 銀行融資は廃止（作者指定）。サラ金はその場で現金が出るので、振込待ちという状態はもう無い
  G.staff = [];                    // バイトは準備中いなくなる。営業開始で戻る（作者指定）
  const careLine = careBubbleText();
  // 治療費の話は日報でなく主人公の独り言で（作者指定）。融資入金の吹き出しが出ている朝はそちらを優先
  if (careLine && !G.player.bub) bubble(G.player, careLine, 5.0);
  G.adBought = {};
  $('bizPanel').classList.add('hidden');
  $('prepPanel').classList.remove('hidden');
  $('shopPanel').classList.remove('hidden');
  renderShop();
  const broken = G.equip.filter(e => (CONF.wearPerDay[EQ[e.id].cat] ?? 0) > 0 && e.cond <= 0);
  const demands = demandHint();
  if (G.day === 1 && !G.flags.tut) {
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
    // 入れずに帰した客がいた日は、それが何より先に直すべきこと（日報の数字だけでは気づけない）
    setHint(`🚪 昨日、<b>${G.lastTurnedAway}人</b>がロッカー満杯で入れずに帰った。<br>` +
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
    const next = Object.keys(EQ).filter(k => k !== DUEL_ONLY_EQ && EQ[k].rep && EQ[k].rep > G.rep).map(k => EQ[k]).sort((a, b) => a.rep - b.rep)[0];
    setHint(`🎉 第1章クリア！ 夕凪湯は街の湯として蘇った。<br>ここからは自由営業。追い立てるものはもう無い。` +
      (G.rep < 100 ? `<br>🎯 評判100を目指して全設備を解放しよう（いま ${G.rep}）`
                   : (next ? `<br>🎯 次の解放：評判${next.rep}で【${next.name}】` : `<br>評判は最高の100。あとは思うまま、最高の湯を`)));
  } else {
    // 次に解放される設備を準備画面に出しておく（目標が見えるように）
    const next = Object.keys(EQ).filter(k => k !== DUEL_ONLY_EQ && EQ[k].rep && EQ[k].rep > G.rep).map(k => EQ[k]).sort((a, b) => a.rep - b.rep)[0];
    setHint(next ? `🎯 次の解放：評判${next.rep}で【${next.name}】（いま ${G.rep}）` : null);
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

function updateNpcs(dt) {
  for (const n of [...G.npcs]) {
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
  const ap = pathToEquip(n, it);
  n.path = ap ? ap.path : [];
  n.state = 'in';
  n.onArrive = () => { n.state = 'work'; log(`🔧 修理業者が${EQ[it.id].name}を直しはじめた`); };
}
/* 続けて直す相手を選ぶ。頼まれたぶん（queue）が先で、次に壊れているもの。
   どちらも「いま業者が立っている場所から近い順」＝店内を行ったり来たりしない */
function nextFixTarget(n) {
  const ok = e => G.equip.includes(e) && e !== n.target && fixable(e) && G.cash >= fixFee(e) && pathToEquip(n, e);
  const nearest = list => {
    let best = null, bd = Infinity;
    for (const e of list) {
      if (!ok(e)) continue;
      const d = Math.hypot(e.x * T + T / 2 - n.px, e.y * T + T / 2 - n.py);
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
    G.cash = Math.max(0, G.cash - fee);
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
function autoRepairEnabled() { return !!(G.premium && G.premium.autoRepair && G.premium.autoRepairOn !== false); }
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
function tadokoroKessenOK() {
  const t = G.tadokoro;
  return t.met && (t.done || 0) >= TADOKORO_DEMAND_CLEAR
    && G.najimi >= TADOKORO_KESSEN_NAJIMI && G.rep >= TADOKORO_KESSEN_REP;
}
function kurodaKessenOK() {
  const k = G.kuroda;
  return k.met && (k.done || 0) >= KURODA_DEMAND_CLEAR && k.stage >= KURODA_KEIEI_STAGE && kurodaBiz().count >= 2;
}
function dueTadokoro() {
  const t = G.tadokoro; if (!t || t.resolved) return false;
  // 顔合わせ（名乗り）は昼の飛び込み来訪ではなく、1日目の営業終了後の夜に流す（作者指定）。
  // よって hello 前は昼の来訪者には選ばない
  if (!t.hello) return false;
  if (!t.met) return G.day >= (t.nextDay || 0) && hasCat('sauna') && G.rep >= TADOKORO_APPEAR_REP;
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
  if (!k.met) return G.day >= (k.nextDay || 0) && G.rep >= KURODA_APPEAR_REP
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
function pickTodaysVisitor() {
  if (dueTadokoroConsult()) return 'tadokoroConsult';   // みかじめ2回の翌日、田所が異変を察して来る（最優先）
  if (dueKitoThanks()) return 'kitoThanks';             // お断りを下ろした翌日、鬼頭が礼を言いに来る
  /* 田所編と鬼頭編は並行して進むが、同じ日に二人は来ない＝両方その気なら1日おきに交代（作者指定）。
     ※鬼頭の来訪（みかじめ＝要求の選択画面）は必ずこの交代に混ぜること。
       田所は編が始まると「毎日来る」ので、鬼頭を後回しの判定に置くと永久に順番が回らず、
       ヤクザ編が一度も始まらないまま詰む（通しテストで実際に発生した）。
     例外は「鬼頭の3回目＝田所が割って入る決着」で、主人公・鬼頭・田所が集合する場面なので必ず優先する */
  const mikaDue = dueMikajime(), tadoDue = dueTadokoro();
  if (mikaDue && tadoDue) {
    const finale = !!(G.kito && !G.kito.resolved && (G.kito.paid || 0) >= 2 && tadokoroAllyOn());
    const who = finale ? 'mikajime' : (G.flags.lastDuo === 'mikajime' ? 'tadokoro' : 'mikajime');
    G.flags.lastDuo = who;
    return who;
  }
  if (mikaDue) { G.flags.lastDuo = 'mikajime'; return 'mikajime'; }
  if (tadoDue) { G.flags.lastDuo = 'tadokoro'; return 'tadokoro'; }
  if (dueKuroda()) return 'kuroda';
  if (dueReina()) return 'reina';
  return null;
}
/* みかじめを2回払い、かつ田所が主人公を「認めた」あとで、田所が「困ってることはないか」と声をかけてくる。
   条件は【田所が認める × みかじめ2回以上】の掛け算（作者指定）＝
   認められていない相手のために、あの爺さんが体を張ることはない。それまでは自力で耐えるしかない */
function dueTadokoroConsult() {
  return !!(G.flags.tadokoroConsultDay && G.day >= G.flags.tadokoroConsultDay &&
    !G.flags.tadokoroConsulted && tadokoroAllyOn() && G.kito && !G.kito.resolved);
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
  const who = key === 'tadokoroConsult' ? 'tadokoro' : key === 'kitoThanks' ? 'kito' : key;
  const n = makeNpc(who);
  walkNpcTo(n, npcSpot());
  n.onArrive = () => {
    if (key === 'tadokoro') openTadokoroVisit();
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
function demandList(who) { return who === 'tadokoro' ? TADOKORO_DEMANDS : KURODA_DEMANDS; }
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
/* まだ評判が足りずカタログに並んでいない設備は、要求されても買えない＝出題しない
   （替わり湯もフィンランド式サウナも、解放される評判まで来てから言い出す）。
   さらに「置ける場所が1マスも無い設備」も出題しない＝買えても置けない要求は詰みになる */
function demandBuyable(d) {
  if (d.need.type !== 'equip') return true;
  const def = EQ[d.need.id];
  if (def.rep > G.rep) return false;
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
  const cands = demandList(who).filter(d => !st.doneKeys.includes(d.key)
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
  return pick(cands);
}
/* セリフ中の {目標} を、その課題の目標値の表記に差し替える */
function fillGoal(text, d) {
  const n = d.need, g = goalOf(d);
  const label = (n.type === 'rep' || n.type === 'sat') ? `${g}`
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
function addFloater(x, y, text) {
  floaters.push({ x, y, text, t: 1.6 });
  Sfx.play(String(text)[0] === '-' ? 'pay' : 'cash');
}
function addSparkle(x, y) { for (let i = 0; i < 6; i++) sparkles.push({ x: x + rand(-12, 12), y: y + rand(-10, 10), t: rand(.5, 1.1) }); }
function log(text) {
  const h = CONF.openHour + (G.minutes / 60) | 0;
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
  el.textContent = text; el.style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.style.opacity = 0, 2200);
}
function setHint(html) {
  const el = $('hint');
  if (!html) { el.classList.add('hidden'); return; }
  el.innerHTML = html; el.classList.remove('hidden');
}

/* ============ 描画 ============ */
const cv = $('game'), ctx = cv.getContext('2d');
cv.width = CONF.W * T * CONF.SS; cv.height = CONF.H * T * CONF.SS;

function render(rt) {
  ctx.setTransform(CONF.SS, 0, 0, CONF.SS, 0, 0);
  ctx.imageSmoothingEnabled = false;
  drawFloorAndWalls(rt);
  if (G.benz) drawBenz(rt);
  for (const d of G.dirts) drawDirt(d);
  if (G.roach) drawRoach(rt);                        // ゴキブリは床の上（設備の下）を這う
  if (G.roachSplat) drawRoachSplat(1 / 60);           // 仕留めた跡
  const items = [...G.equip].sort((a, b) => a.y - b.y);
  for (const it of items) drawEquip(ctx, it, rt);
  if (G.placing) drawGhost(rt);
  const ents = [...G.customers, ...G.staff.filter(s => !(s.lateT > 0)), ...G.npcs, ...(G.player ? [G.player] : [])].sort((a, b) => a.py - b.py);
  for (const e of ents) drawChar(e, rt);
  if (G.phase === 'biz' && nappaOn()) drawNappa();   // 熱波師は営業中だけサウナ室の前に立つ（夜は帰る）
  if (playerAsleep()) drawSleep(G.player, rt);      // 拭ける数を使い切った夜は、番台で寝てしまう
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
  // 番台の絵にかぶらないよう、店の外（下端の帯）の高さに置く
  const y = (CONF.H - 1) * T - 5 + Math.sin(rt * 4) * 1.5;    // かすかに揺らして視線を引く
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

function drawFloorAndWalls(rt) {
  const W = CONF.W, H = CONF.H;
  // 床
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const bathArea = y < 7;
      let c;
      if (bathArea) c = (x + y) % 2 ? '#cfd8d4' : '#c4cec9';       // 浴場タイル
      else c = (x + y) % 2 ? '#d9b98a' : '#d2b181';               // 脱衣所の木床
      ctx.fillStyle = c; ctx.fillRect(x * T, y * T, T, T);
      ctx.strokeStyle = 'rgba(0,0,0,.06)'; ctx.strokeRect(x * T + .5, y * T + .5, T - 1, T - 1);
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
  ctx.fillStyle = '#5a4436';
  ctx.fillRect(0, 0, W * T, T);
  ctx.fillRect(0, 0, T, H * T); ctx.fillRect((W - 1) * T, 0, T, H * T);
  ctx.fillRect(0, (H - 1) * T, W * T, T);
  // 左右は“内側の壁”＝ポスターや扇風機を掛けられる面。板張りに見せて、掛けられると分かるようにする
  for (const wx of [0, (W - 1) * T]) {
    ctx.fillStyle = '#6b5241';
    ctx.fillRect(wx + (wx ? 0 : 3), T, T - 3, (H - 2) * T);
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1;
    for (let y = T + 8; y < (H - 1) * T; y += 10) {                 // 板の継ぎ目
      ctx.beginPath(); ctx.moveTo(wx + (wx ? 0 : 3), y + .5); ctx.lineTo(wx + (wx ? T : T), y + .5); ctx.stroke();
    }
    ctx.fillStyle = '#8a6c52';                                       // 腰の見切り縁
    ctx.fillRect(wx + (wx ? 0 : 3), CONF.divideY * T - 3, T - 3, 3);
  }
  // 上壁: 富士山のペンキ絵
  ctx.fillStyle = '#7ab8d8'; ctx.fillRect(T * 5.5, 4, T * 6.7, T - 8);
  ctx.fillStyle = '#e8f0f2';
  ctx.beginPath();
  ctx.moveTo(T * 7, T - 4); ctx.lineTo(T * 8.6, 8); ctx.lineTo(T * 10.2, T - 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(T * 8.2, 13); ctx.lineTo(T * 8.6, 8); ctx.lineTo(T * 9, 13); ctx.lineTo(T * 8.6, 15); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffcf6a'; ctx.fillRect(T * 11.4, 8, 8, 8);
  // 屋号看板
  ctx.fillStyle = '#3a2a1c'; ctx.fillRect(T * 1.2, 5, T * 3.6, T - 10);
  ctx.fillStyle = '#ffd98a'; ctx.font = 'bold 12px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(G.name, T * 3, T - 11);
  // 入口（下壁の開口部）を"入口らしく"
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
/* ゴキブリ1匹。浴室の床を歩き回る（作者指定）。
   卵形の黒い胴・脚6本・長い触角。進む向きに体を向け、脚は小刻みに動く */
function drawRoach(rt) {
  const r = G.roach; if (!r) return;
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
    c2.fillStyle = 'rgba(20,15,10,.55)'; c2.fillRect(ox + 2, oy + fh - 16, txt.length > 3 ? 33 : 27, 10);
    c2.fillStyle = '#fff'; c2.font = 'bold 8px "DotGothic16",sans-serif'; c2.textAlign = 'left';
    c2.fillText(txt, ox + 4, oy + fh - 8);
  }
}

function drawEquipArt(c2, it, def, x, y, w, h, rt, broken) {
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
      } else if (it.id === 'sink') {                     // 洗面所（鏡＋洗面台2つ＋ドライヤー＋化粧水と乳液のボトル）
        c2.fillStyle = '#9fd0e0'; c2.fillRect(x + 4, y + 3, w - 8, 9);          // 鏡
        c2.fillStyle = 'rgba(255,255,255,.45)'; c2.fillRect(x + 5, y + 4, (w - 10) / 2, 3);
        c2.fillStyle = '#8a8a84'; c2.fillRect(x + 4, y + 3, w - 8, 1);
        c2.fillStyle = '#e8e4dc'; c2.fillRect(x + 3, y + 15, w - 6, 9);         // 洗面台のカウンター
        c2.fillStyle = '#8a6a4a'; c2.fillRect(x + 3, y + 24, w - 6, 3);
        c2.fillStyle = '#cfd8dc';                                               // 洗面ボウル2つ
        for (const bx of [x + 8, x + w - 20]) {
          c2.beginPath(); c2.ellipse(bx + 6, y + 20, 6, 3.5, 0, 0, Math.PI * 2); c2.fill();
          c2.fillStyle = '#9a9a9a'; c2.fillRect(bx + 5, y + 13, 2, 4); c2.fillStyle = '#cfd8dc';
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
      } else if (it.id === 'massage') {                  // マッサージチェア
        c2.fillStyle = '#3a3a44'; c2.fillRect(x + 4, y + 5, w - 8, 20);
        c2.fillStyle = '#5a5a6a'; c2.fillRect(x + 6, y + 8, w - 12, 9);
        c2.fillStyle = '#2c2c34'; c2.fillRect(x + 6, y + 19, w - 12, 5);
        c2.fillStyle = '#8a8a9a'; c2.fillRect(x + 2, y + 12, 3, 8); c2.fillRect(x + w - 5, y + 12, 3, 8);
        c2.fillStyle = broken ? '#555' : '#7ae06a'; c2.fillRect(x + w - 10, y + 6, 4, 2);
      }
      break;
    }
    case 'etc': {
      if (it.id === 'cooler') {                          // 冷水機（青いタンク＋蛇口＋水しぶき）
        c2.fillStyle = '#e8ecee'; c2.fillRect(x + 6, y + 8, w - 12, 18);
        c2.fillStyle = '#4a8ac9'; c2.fillRect(x + 8, y + 3, w - 16, 8);
        c2.fillStyle = '#bfe3f2'; c2.fillRect(x + 9, y + 4, w - 18, 5);
        c2.fillStyle = '#9a9a9a'; c2.fillRect(x + w / 2 - 1, y + 14, 2, 5);
        c2.fillStyle = '#cfe8f2'; c2.fillRect(x + 9, y + 20, w - 18, 4);
        if (!broken) { c2.fillStyle = 'rgba(160,220,245,.9)'; c2.fillRect(x + w / 2 - 0.7, y + 18 + (rt * 12 % 3), 1.4, 2); }
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
  const b = bandai(); if (!b) return false;
  const s = playerSpot(), t = tileOf(e);
  return t.x === s.x && t.y === s.y && Math.abs(s.x - b.x) + Math.abs(s.y - b.y) === 1;
}

/* 子どもは大人と同じ絵を、足もとを軸に縮めて描く（作者指定＝子供の画像）。
   頭は縮めすぎると顔が潰れるので、体より控えめに縮む＝頭が大きい子どもの体型になる */
const KID_SCALE = 0.66;
function drawChar(e, rt) {
  if (!e.isChild) { drawCharBody(e, rt); return; }
  ctx.save();
  // 縮める軸は「その子が実際に立っている足もと」。体重計に乗っている間は台の上が足もとになる
  const onScale = (e.state === 'usingPas' && e.pas && e.pas.kind === 'scale') ? e.pas.item : null;
  const gx = onScale ? onScale.x * T + T / 2 : e.px;
  const gy = (onScale ? onScale.y * T + T / 2 - 3 : e.py) + 8;
  ctx.translate(gx, gy); ctx.scale(KID_SCALE, KID_SCALE); ctx.translate(-gx, -gy);
  drawCharBody(e, rt);
  ctx.restore();
}
function drawCharBody(e, rt) {
  const inWater = e.kind === 'cust' && e.state === 'using' && (e.use.cat === 'furo' || e.use.cat === 'mizu');
  const bob = e.moving ? Math.sin(rt * 14 + e.wob) * 1.6 : 0;
  // 番台についている間は、立ち位置ではなく番台そのものの上に描き、台の高さで胴を切る＝頭だけ出る
  const post = atBandaiPost(e) ? bandai() : null;
  // 体重計は「乗る」もの（作者指定）。使っているあいだは台の真上に立たせ、板の厚みぶん少し持ち上げる
  const onScale = (e.kind === 'cust' && e.state === 'usingPas' && e.pas && e.pas.kind === 'scale') ? e.pas.item : null;
  const x = post ? post.x * T + T / 2 : onScale ? onScale.x * T + T / 2 : e.px;
  // 拭ける数を使い切った夜は、番台に突っ伏して寝ている（作者指定）＝台の高さまで沈める
  const asleep = !!post && playerAsleep();
  const y = post ? post.y * T + (asleep ? 8 : 2) : onScale ? onScale.y * T + T / 2 - 3 : e.py + bob;
  if (post) {
    ctx.save();
    ctx.beginPath(); ctx.rect((post.x - 1) * T, 0, T * 3, post.y * T + 5); ctx.clip();
  }
  // 影
  if (!inWater && !post) {
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.ellipse(x, (onScale ? y : e.py) + 8, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  const skin = '#f2c9a0';
  const hair = e.kind === 'player' ? '#2a2a2a' : e.kind === 'staff' ? '#3a2a1a' : e.type.hair;
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
  let cloth = e.kind === 'player' ? '#3a6ea5' : e.kind === 'staff' ? '#3a8a5a' : e.type.cloth;
  // 着替えたあと：男は腰にタオルを巻いて前を隠す、女は体にタオルを巻く
  const bare = e.kind === 'cust' && e.mode === 'towel' && e.type.sex === 'm';
  if (e.kind === 'cust' && e.mode === 'towel') cloth = bare ? skin : '#f5f0e8';
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
  if (e.kind === 'cust' && e.state === 'using' && e.use && e.use.item && e.use.item.id === 'massage') {
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
  if (post) ctx.restore();
}

/* 「置くだけの設備」を使っている絵。何をしているのか一目で分かるように、
   道具（紙コップ・ドライヤー）と風・水を、設備の側から客へ向けて描く */
function drawPasUse(e, x, y, rt, skin, hair) {
  const it = e.pas.item;
  const cx = it.x * T + ew(it) * T / 2;                 // 設備の中心
  const d = cx < e.px ? -1 : 1;                         // 設備は左か右か（道具はそちら側の手に持つ）
  if (e.pas.kind === 'drink') {
    // 紙コップでごくごく給水（作者指定）。コップは口元に固定したまま、
    // 喉が上下して「ゴク」が飛び、飲むほど水面が下がって、最後に雫がこぼれる
    const beat = (rt * 3.4 + e.wob) % 1;                // ごくり1回ぶんの拍
    const tilt = 0.55 + Math.sin(rt * 3.4 + e.wob) * 0.3;
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
    ctx.save();
    ctx.translate(x + d * 4.5, y - 6);                  // 口元まで持ち上げた紙コップ
    ctx.rotate(-d * tilt * 0.7);
    ctx.fillStyle = '#f6f2ea';                          // 紙コップ（下すぼまり）
    ctx.beginPath(); ctx.moveTo(-2.6, -3.4); ctx.lineTo(2.6, -3.4); ctx.lineTo(1.8, 2.6); ctx.lineTo(-1.8, 2.6);
    ctx.closePath(); ctx.fill();
    const lvl = 1 - ((rt * 0.4 + e.wob) % 1);           // 飲むほど水が減っていく（減りきったら次の一杯）
    ctx.fillStyle = '#9fd8ff';
    ctx.fillRect(-2.2, 2.2 - 5.2 * lvl, 4.4, 5.2 * lvl);   // 水面
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(-2.6, -3.4, 5.2, 0.8);
    ctx.restore();
    ctx.fillStyle = skin; ctx.fillRect(x + d * 3 - 1.4, y - 4.5, 2.8, 3.4);   // コップを持つ手
    ctx.fillStyle = 'rgba(160,220,245,.9)';             // 口からこぼれる雫
    for (let i = 0; i < 2; i++) {
      const ph = (rt * 1.9 + i * .5 + e.wob) % 1;
      if (tilt > 0.5) { ctx.beginPath(); ctx.arc(x + d * 2.4, y - 3 + ph * 7, 1.2 * (1 - ph) + .5, 0, Math.PI * 2); ctx.fill(); }
    }
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
  ctx.font = (hint ? 'bold ' : '') + '9px "DotGothic16",sans-serif';
  const w = ctx.measureText(text).width + (hint ? 16 : 10);
  let bx = clamp(e.px - w / 2, 2, CONF.W * T - w - 2);
  const by = e.py - 34;
  ctx.fillStyle = stuck ? 'rgba(255,228,224,.98)' : hint ? 'rgba(255,240,238,.97)' : 'rgba(255,255,255,.94)';
  ctx.strokeStyle = hint ? '#e03a3a' : '#5a4436'; ctx.lineWidth = hint ? (stuck ? 2.2 : 1.6) : 1;
  ctx.beginPath(); ctx.roundRect(bx, by, w, 15, 4); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(e.px - 3, by + 15); ctx.lineTo(e.px + 3, by + 15); ctx.lineTo(e.px, by + 20); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.textAlign = 'left';
  if (hint) {
    ctx.fillStyle = '#e03a3a'; ctx.fillText(stuck ? '⚠' : '！', bx + 4, by + 11);
    ctx.fillStyle = stuck ? '#c00000' : '#8a1a1a'; ctx.fillText(text, bx + 12, by + 11);
  } else {
    ctx.fillStyle = '#222'; ctx.fillText(text, bx + 5, by + 11);
  }
}

function drawEffects() {
  ctx.textAlign = 'center';
  for (const f of floaters) {
    ctx.globalAlpha = clamp(f.t, 0, 1);
    ctx.fillStyle = '#ffd98a'; ctx.font = 'bold 10px "DotGothic16",sans-serif';
    ctx.fillText(f.text, f.x, f.y - (1.6 - f.t) * 18);
  }
  for (const s of sparkles) {
    ctx.globalAlpha = clamp(s.t, 0, 1);
    ctx.fillStyle = '#ffe86a'; ctx.font = '10px sans-serif';
    ctx.fillText('✦', s.x, s.y - (1 - s.t) * 10);
  }
  ctx.globalAlpha = 1;
}

/* 置ける／置けないマスの一覧（原点マス基準）。回転や設備の増減があった時だけ計算し直す */
function placeMask(p) {
  const sig = `${p.rot}_${G.equip.length}_${G.customers.length}`;
  if (p.mask && p.maskSig === sig) return p.mask;
  const m = new Set();
  const x0 = isWallMount(p.id) ? 0 : 1, x1 = CONF.W - (isWallMount(p.id) ? 0 : 1);
  for (let y = 1; y < CONF.H - 1; y++)
    for (let x = x0; x < x1; x++)
      if (snapAnchor(p.id, p.rot, x, y, p.moving).ok) m.add(y * CONF.W + x);   // タップ後に寄る位置で判定する
  p.mask = m; p.maskSig = sig;
  return m;
}
/* 配置中は、置けるエリア（緑）と置けないエリア（赤）を塗り分けて見せる */
function drawPlaceZones(p) {
  const mask = placeMask(p);
  const wm = isWallMount(p.id);
  for (let y = 1; y < CONF.H - 1; y++)
    for (let x = wm ? 0 : 1; x < CONF.W - (wm ? 0 : 1); x++) {
      const ok = mask.has(y * CONF.W + x);
      ctx.fillStyle = ok ? 'rgba(110,225,120,.20)' : 'rgba(230,70,70,.22)';
      ctx.fillRect(x * T, y * T, T, T);
      if (!ok) {                                   // 禁止エリアは斜線を入れて“ダメ”を強調
        ctx.strokeStyle = 'rgba(255,120,120,.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x * T, y * T + T); ctx.lineTo(x * T + T, y * T); ctx.stroke();
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
function frame(ts) {
  const rDt = Math.min((ts - lastTs) / 1000, .1);
  updateRoach(rDt);                                  // ゴキブリは実時間で歩き回る
  lastTs = ts;
  const rt = ts / 1000;
  // 今フレームで進んだゲーム内の分数（吹き出しの寿命にも使う）
  let gDt = 0;
  if (G.phase === 'biz' && !G.paused) {
    const dt = Math.min(rDt * CONF.minPerSec * CONF.speeds[G.speedIdx], 45);
    gDt = dt;
    updateBiz(dt);
  } else if (G.phase === 'prep' && G.player) {
    // 準備中は時計が進まない（速度倍率なし）ので、等速1倍ぶんだけ動かして掃除させる
    updatePlayer(G.player, Math.min(rDt * CONF.minPerSec, 45));
  }
  // 時計や売上は、イベントで一時停止している間も正しい表示のままにしておく
  if (G.phase === 'biz' && G.today) {
    updateTopbar();
    $('bizStats').textContent = `客 ${G.today.paid}人 / 売上 ${yen(G.today.revenue)} / 場内 ${G.customers.length}人`;
  }
  // ベンツの演出は一時停止（みかじめのカットシーン中も）に関係なく実時間で動かす
  if (G.benz && G.phase === 'biz') updateBenz(rDt); else Sfx.engine(false);
  // 来訪者・修理業者・若い衆も実時間で動く（イベント中で止まっていても歩いてくる／叩きに来る）
  if (G.npcs.length && G.phase !== 'title') updateNpcs(rDt * 8);
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
  if (G.phase !== 'title') render(rt);
  requestAnimationFrame(frame);
}

function updateTopbar() {
  syncSpecialName();   // 決戦仕様の名前は屋号から作る（ログやトーストにも屋号で出す）
  // クリア後はゲームクリアの証（⭐）を日数の隣に出す（フェーズ4・自由営業中）
  $('uiDay').textContent = `${G.day}日目（${dayLabel()}）` + (G.flags && G.flags.freePlay ? ' ⭐' : '');
  if (G.phase === 'biz') {
    const h = CONF.openHour + Math.floor(G.minutes / 60);
    const m = Math.floor(G.minutes % 60);
    $('uiClock').textContent = `${h}:${String(m).padStart(2, '0')}`;
  } else $('uiClock').textContent = '準備中 🌙';
  // 借金の表示はサラ金の残債（銀行融資は廃止）
  const sDebt = G.yami ? G.yami.debt : 0;
  $('uiCash').textContent = yen(G.cash) + (sDebt ? ` (借金${(sDebt / 10000) | 0}万)` : '');
  syncRep();   // 減点は即時反映＝運営メニューで直したその場で数字が戻る
  $('uiRep').textContent = repCounting() ? '評判 集計中' : `評判 ${G.rep}`;
}

/* ============ ショップ・準備UI ============ */
let shopTab = 'sauna';
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
function shopTabOf(id) { return EQ[id].tab || EQ[id].cat; }
/* 決戦仕様の一台は、熱波師が提案するまで一覧に出さない（作者指定）。
   鍵付きで並べておくと、始めたばかりの店にも「◯◯スペシャル」が見えてしまい、物語の先が割れる */
function shopIds(cat) {
  /* 並び順は「解放される評判」→「値段」の昇順（作者指定）。
     上から順に鍵が外れ、下へ行くほど高くなる＝いま買えるものが必ず上に集まる */
  return Object.keys(EQ).filter(id => shopTabOf(id) === cat && !EQ[id].old && id !== 'bandai'
    && !(id === DUEL_ONLY_EQ && !duelEqReady()))
    .sort((a, b) => (EQ[a].rep || 0) - (EQ[b].rep || 0) || EQ[a].price - EQ[b].price);
}
// 「評判で解放されたのに、まだ見ていない」設備があるか
function isNewItem(id) { const d = EQ[id]; return !!d.rep && G.rep >= d.rep && !G.seenEq[id]; }
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
  return Math.round(p);
}
/* 決戦仕様の名前は屋号から作る（作者指定）＝「夕凪湯スペシャル」。
   店の名前はプレイヤーが決めるので、カタログに並べる直前にここで名乗らせる */
function syncSpecialName() { EQ.sauna_sp.name = `${G.name || '夕凪湯'}スペシャル`; }
function renderShop(markSeen) {
  syncSpecialName();
  const tabs = $('shopTabs');
  tabs.innerHTML = '';
  for (const [key, label] of CATS) {
    const b = document.createElement('button');
    b.className = 'tab' + (key === shopTab ? ' on' : '');
    b.innerHTML = label + (newInCat(key) ? '<i class="new-dot"></i>' : '');   // 🔴 新着マーク
    b.onclick = () => { shopTab = key; renderShop(true); };                   // 開いたら既読
    tabs.appendChild(b);
  }
  const list = $('shopList');
  list.innerHTML = '';
  for (const id of shopIds(shopTab)) {
    const def = EQ[id];
    const price = eqPrice(id);
    const discounted = reinaAllyOn() && price < def.price;
    const locked = id === DUEL_ONLY_EQ
      ? !duelEqReady()                                   // 決戦仕様は投票対決を受けて立つまで並ばない
      : (def.rep && G.rep < def.rep && !isDemandedEquip(id));
    const isNew = isNewItem(id);
    const capTxt = CAP_CATS.includes(def.cat) && def.cap > 0 ? ` <span class="cap-chip">収容${def.cap}人</span>` : '';
    // ⭐（店の格への貢献）は廃止した（作者指定）。名前・収容・値段・鍵だけを1行に置く
    const div = document.createElement('div');
    div.className = 'shop-item' + (locked ? ' locked' : '') + (isNew ? ' is-new' : '');
    // 名前の下に一行だけ短い説明（EQ_NOTE）。長い説明は設備をタップした時の詳細に置いてある
    const note = EQ_NOTE[id] ? `<div class="shop-note">${EQ_NOTE[id].replace('{店名}', G.name)}</div>` : '';
    div.innerHTML = `<img class="shop-icon" src="${iconFor(id)}">
      <div class="shop-body"><div class="shop-name">${isNew ? '<b class="new-tag">NEW</b> ' : ''}${def.name}${capTxt}${locked ? (id === DUEL_ONLY_EQ ? ' <span class="lock-chip">🔒決戦仕様</span>' : ` <span class="lock-chip">🔒評判${def.rep}</span>`) : ''}</div>${note}</div>
      <div class="shop-price">${
        // 黒田割引中は「定価を消して、赤で割引後の額」。定価のほうを赤で出すと、どちらを払うのか分からなくなる
        kurodaDiscountId() === id
          ? `<span class="price-was">通常${yenShort(def.price)}</span>/<span class="kuroda-off">今だけ${yenShort(price)}（黒田割引）</span>`
          : yenShort(price) + (discounted ? '<br><span style="font-size:10px;color:#37a">玲奈割15%引き</span>' : '')}</div>`;
    div.onclick = () => {
      if (locked) {
        toast(id === DUEL_ONLY_EQ ? 'これは、まだ手が届く代物じゃない…' : `評判${def.rep}になったら仕入れられる`);
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
  $('confirmBar').classList.remove('hidden');
  $('btnRotate').style.display = canRotate(id) ? '' : 'none';
  const rl = roomLabel(id);
  // 設置開始時の説明は「名前＋置ける部屋」だけのシンプル表記（作者指定）
  $('confirmText').textContent = EQ[id].name + (rl ? `（${rl}のみ）` : '');
}
function endPlacing() {
  if (G.placing && G.placing.onCancel && !G.placing.placedN) G.placing.onCancel();
  G.placing = null;
  $('confirmBar').classList.add('hidden');
  if (G.phase === 'prep') $('prepPanel').classList.remove('hidden');
  $('shopPanel').classList.remove('hidden');
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
    $('confirmText').textContent = c ? `移動費 ${yen(c)}` : 'ここでいい？（元の位置）';
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
  $('shopPanel').classList.remove('hidden');
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
   向きを変えるだけでも1マスぶんの手間として計上する */
function moveCost(it, gx, gy, rot) {
  const def = EQ[it.id], area = def.w * def.h;
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
cv.addEventListener('pointerup', ev => {
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
  if (G.phase === 'prep') {
    const it = equipAt(t.x, t.y);
    if (it) selectEquip(it); else deselect();
  } else if (G.phase === 'biz') {
    // フェーズ3：働いているスタッフをタップ→給料変更・クビのパネル
    const st = G.staff.find(s => { if (s.lateT > 0) return false; const tt = tileOf(s); return tt.x === t.x && tt.y === t.y; });
    if (st && st.emp) { openStaffPanel(st.emp); return; }
    const it = equipAt(t.x, t.y);
    if (it) selectEquip(it); else deselect();
  }
});

/* ============ バイト（フェーズ3：求人・面接・給料・クビ） ============ */
/* 求人広告の翌朝：プールから未採用の3人を引いて面接モーダルを開く */
let jobHiredThisRound = 0;   // この面接で何人採用したか（閉じるボタンの文言と、0人で閉じる時の確認に使う）
/* 閉じるボタンの文言は採用人数で変わる（作者指定）＝0人なら「今回は見送る」、1人以上なら「○人採用する」 */
function updateJobCloseBtn() {
  $('btnJobClose').textContent = jobHiredThisRound ? `${jobHiredThisRound}人採用する` : '今回は見送る';
}
function openJobModal() {
  const pool = STAFF_POOL.filter(p => !G.roster.some(e => e.pid === p.pid))
    .sort(() => Math.random() - 0.5).slice(0, 3);
  if (!pool.length) { toast('応募が来なかった…（もう街に人材がいない）'); return; }
  jobHiredThisRound = 0;
  updateJobCloseBtn();
  G.paused = true;
  $('jobNote').innerHTML = `求人広告を見て、3人が面接に来た。雇うのは<b>${CONF.maxStaff}人まで</b>（現在${G.roster.length}人）。<br>日給はスペックで決まる。見送った人はもう来ない。`;
  const list = $('jobList');
  list.innerHTML = '';
  for (const p of pool) {
    const div = document.createElement('div');
    div.className = 'senden-item';
    div.innerHTML = `<span>🧑‍🔧</span><div><b>${p.name}</b>　<span class="shop-price">日給${yen(staffWageOf(p))}</span><br>
      <span class="shop-desc">真面目${'★'.repeat(p.maji)}　スピード${'★'.repeat(p.spd)}　愛想${'★'.repeat(p.aiso)}<br>${p.desc}</span></div>
      <button class="opt-btn">採用</button>`;
    div.querySelector('button').onclick = (ev) => {
      ev.stopPropagation();
      if (G.roster.length >= CONF.maxStaff) { toast(`スタッフは${CONF.maxStaff}人まで`); return; }
      G.roster.push({ pid: p.pid, name: p.name, maji: p.maji, spd: p.spd, aiso: p.aiso, desc: p.desc,
        wage: staffWageOf(p), days: 0, skill: 30 + (p.maji + p.spd + p.aiso) * 2, sulk: false, raiseAsk: false, raiseAmt: 0, raiseNo: 0 });
      // 採用したその日から働く（営業中なら今すぐ出勤）
      if (G.phase === 'biz') G.staff.push(makeStaff(G.roster.length - 1));
      jobHiredThisRound++;
      updateJobCloseBtn();
      log(`🧑‍🔧 ${p.name}を採用した（日給${yen(staffWageOf(p))}）`);
      toast(`🧑‍🔧 ${p.name}を採用した！`);
      div.classList.add('done');
      div.querySelector('button').disabled = true;
      saveGame();
    };
    list.appendChild(div);
  }
  $('staffModal').classList.add('hidden');
  $('jobModal').classList.remove('hidden');
}

/* スタッフ個別パネル：給料変更（500円単位）とクビ */
function openStaffPanel(emp) {
  if (!G.roster.includes(emp)) return;
  G.paused = true;
  $('staffTitle').textContent = `🧑‍🔧 ${emp.name}`;
  const mood = emp.sulk ? '／😾ふてくされ中（給料を上げれば機嫌が直る）' : '';
  $('staffInfo').innerHTML = `${emp.desc}<br>真面目${'★'.repeat(emp.maji)}　スピード${'★'.repeat(emp.spd)}　愛想${'★'.repeat(emp.aiso)}<br>` +
    `日給 <b>${yen(emp.wage)}</b>／働きぶり ${emp.skill}／勤続${emp.days || 0}日${mood}`;
  const box = $('staffActions');
  box.innerHTML = '';
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
  const emp = G.roster.find(e => e.raiseAsk);
  if (!emp) return;
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
const SAVE_KEY = 'orenoSauna_v1';
function saveGame() {
  const data = {
    day: G.day, cash: G.cash, debt: G.debt, rep: G.rep, name: G.name,
    loanPending: G.loanPending, loanArrive: G.loanArrive, loanInToday: G.loanInToday || 0, profitStreak: G.profitStreak,
    ceilHist: G.ceilHist || [], satHist: G.satHist || [], repHist: G.repHist || [], repBonus: G.repBonus || 0,
    flags: G.flags, seenEq: G.seenEq, dirts: G.dirts, opts: G.opts, staffCount: G.staffCount, kito: G.kito,
    tadokoro: G.tadokoro, kuroda: G.kuroda, reina: G.reina, yami: G.yami, najimi: G.najimi, oyajiRel: G.oyajiRel,
    lastWorthFee: G.lastWorthFee, lastWorthSauna: G.lastWorthSauna,
    recentProfits: G.recentProfits, recentUtil: G.recentUtil, recentGripes: G.recentGripes, recentSegSat: G.recentSegSat, roughDays: G.roughDays,
    lastShortfallDay: G.lastShortfallDay, solved: G.solved,
    invBuy: G.invBuy, invMove: G.invMove, invSell: G.invSell, invFix: G.invFix,
    cashAtDayStart: G.cashAtDayStart, regulars: G.regulars, careNext: G.careNext, careCount: G.careCount, careAmt: G.careAmt,
    tadokoroPenaltyUntil: G.tadokoroPenaltyUntil,
    roster: G.roster, jobAdDay: G.jobAdDay, nappa: G.nappa, premium: G.premium,
    equip: G.equip.map(e => ({ id: e.id, x: e.x, y: e.y, rot: e.rot || 0, cond: e.cond, temp: e.temp, fault: e.fault })),
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) {}
}
function loadGame() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!d) return false;
    Object.assign(G, { day: d.day, cash: d.cash, debt: d.debt, rep: d.rep, name: d.name, flags: d.flags || {}, seenEq: d.seenEq || {}, dirts: d.dirts || [] });
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
    G.premium = d.premium || { autoRepair: false };   // 課金コンテンツの所持状況（オート修理）
    G.kito = { ...newKito(), ...(d.kito || {}) };
    G.tadokoro = { ...newTadokoro(), ...(d.tadokoro || {}) };
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
    G.equip = d.equip
      .map(e => ID_ALIAS[e.id] ? { ...e, id: ID_ALIAS[e.id] } : e)   // 旧IDを今のIDに読み替える（化粧水→洗面所）
      .filter(e => EQ[e.id])                  // 廃止/未知IDの設備は読み飛ばす（第2章送りのマット系など）
      // 温度を設定できるのはドライサウナだけになったので、
      // 昔のセーブで浴槽・水風呂・ミスト・塩に入っていた設定値は捨てて設備の既定に戻す
      .map(e => ({ uid: ++G.uidN, ...e, rot: e.rot || 0, occ: Array(EQ[e.id].cap).fill(null),
        temp: canSetTemp(EQ[e.id]) ? (e.temp ?? EQ[e.id].temp) : EQ[e.id].temp }));
    /* 化粧水・乳液は1マスだったが、洗面所は2マス。右隣が壁や他の設備で埋まっていると置けないので、
       その場合だけ撤去して代金を返す（黙って消して損をさせない） */
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
    return true;
  } catch (e) { return false; }
}

/* ============ ゲーム開始 ============ */
function resetState() {
  Object.assign(G, {
    day: 1, cash: CONF.startCash, debt: CONF.startDebt, rep: 10, name: '夕凪湯',
    loanPending: 0, loanArrive: 0, profitStreak: 0, ceilHist: [], satHist: [], repHist: [], repBonus: 0,
    equip: [], dirts: [], flags: {}, seenEq: {}, adBoost: 0, adBought: {},
    opts: { ...DEFAULT_OPTS }, staffCount: 0, staff: [], roster: [], jobAdDay: 0, nappa: null, paused: false,
    customers: [], payQueue: [], placing: null, selected: null,
    kito: newKito(), tadokoro: newTadokoro(), kuroda: newKuroda(), reina: newReina(), yami: newYami(),
    npcs: [], visitKey: null, visitAt: null, visitFired: false, yamiAt: null, yamiFired: false,
    benz: null, mika: null, mikajimeAt: null, mikaFired: false,
    najimi: 8, oyajiRel: 0, lastWorthFee: null, lastWorthSauna: null, recentProfits: [], recentUtil: [], recentGripes: [], recentSegSat: [], roughDays: 0, riotDone: false,
    lastShortfallDay: 0, solved: newSolved(),
    invBuy: 0, invMove: 0, invSell: 0, invFix: 0, cashAtDayStart: CONF.startCash,
    regulars: 0, plannedGuests: 0, stuckLogged: false, lastTurnedAway: 0,
    careNext: CONF.careFirstDay, careCount: 0, careAmt: 0, tadokoroPenaltyUntil: 0,
    premium: G.premium || { autoRepair: false },   // 課金コンテンツはニューゲームでも引き継ぐ（買い直しをさせない）
  });
  for (const e of INIT_EQUIP)
    G.equip.push({ uid: ++G.uidN, id: e.id, x: e.x, y: e.y, rot: 0, cond: e.cond, temp: EQ[e.id].temp, occ: Array(EQ[e.id].cap).fill(null) });
  refreshDead();
  // 初期の汚れ
  G.dirts = [{ x: 3, y: 3 }, { x: 5, y: 5 }, { x: 8, y: 6 }, { x: 3, y: 8 }, { x: 9, y: 4 }, { x: 6, y: 2 }];
}

function initUI() {
  Story.init();
  // タイトル：章の選択 → 第1章を選ぶと「はじめから／つづきから」を出す
  if (localStorage.getItem(SAVE_KEY)) $('btnContinue').classList.remove('hidden');
  $('btnChapter1').onclick = () => {
    $('titleChapters').classList.add('hidden');
    $('titleStart').classList.remove('hidden');
  };
  $('btnChapter2').onclick = () => toast('「独立開業編」は近日公開！　いまは第1章をどうぞ');
  $('btnChapterBack').onclick = () => {
    $('titleStart').classList.add('hidden');
    $('titleChapters').classList.remove('hidden');
  };
  $('btnNewGame').onclick = () => {
    $('title').classList.add('hidden');
    resetState();
    Story.play(STORY_INTRO, () => $('nameModal').classList.remove('hidden'));
  };
  $('btnContinue').onclick = () => {
    if (!loadGame()) { toast('セーブデータが読めなかった'); return; }
    $('title').classList.add('hidden');
    $('game-ui').classList.remove('hidden');
    enterPrep();
  };
  // 屋号
  document.querySelectorAll('.name-suggests .chip').forEach(b =>
    b.onclick = () => $('nameInput').value = b.dataset.name);
  $('btnNameOk').onclick = () => {
    const v = $('nameInput').value.trim();
    G.name = v || '夕凪湯';
    $('nameModal').classList.add('hidden');
    $('game-ui').classList.remove('hidden');
    G.flags.intro = true;
    enterPrep();
    saveGame();
  };
  // 準備アクション
  $('btnOpen').onclick = () => {
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
  const openData = () => { renderData(); openPausedModal('dataModal'); };
  $('btnData').onclick = openData;
  $('btnDataBiz').onclick = openData;
  $('btnDataClose').onclick = () => closePausedModal('dataModal');
  // 一覧の組み立てで転んでも画面自体は必ず開く（スマホで「押しても広告画面が出ない」報告への対策）
  $('btnSenden').onclick = () => {
    try { renderAds(); } catch (e) { toast('広告の一覧を出せなかった：' + e.message); }
    $('sendenModal').classList.remove('hidden');
  };
  $('btnSendenClose').onclick = () => $('sendenModal').classList.add('hidden');
  $('btnJobClose').onclick = () => {
    if (!jobHiredThisRound && !confirm('誰も採用しなくていいですか？\n求人広告費が無駄になります')) return;
    $('jobModal').classList.add('hidden');
    if (G.phase === 'biz') { G.paused = false; $('btnPause').textContent = '⏸ 一時停止'; }
  };
  $('btnStaffClose').onclick = () => {
    $('staffModal').classList.add('hidden');
    if (G.phase === 'biz') { G.paused = false; $('btnPause').textContent = '⏸ 一時停止'; }
  };
  const openLoan = () => {
    /* 初回だけ、まず信用金庫に断られる場面を挟む（作者指定）。
       「銀行は選択肢にない」ことを説明文ではなく場面で分からせてから、サラ金の欄を見せる */
    if (!G.flags.bankIntro) {
      G.flags.bankIntro = true; saveGame();
      Story.play(STORY_BANK_INTRO, () => { renderLoan(); openPausedModal('loanModal'); });
      return;
    }
    renderLoan(); openPausedModal('loanModal');
  };
  $('btnLoan').onclick = openLoan;
  $('btnLoanBiz').onclick = openLoan;   // 営業中も借りられる（運営とデータの間・作者指定）
  $('btnLoanClose').onclick = () => closePausedModal('loanModal');   // 営業中に開いた時は、閉じたら再開する
  /* サラ金は審査なし・即日。10万円刻みで好きな額を、限度100万まで一度に借りられる（作者指定）。
     銀行は廃止したので、ここが唯一の資金調達口。
     限度が低いのが肝＝借金で設備を揃えることはできず、稼いで返すしかない */
  window.doBorrowSarakin = (amount) => {
    const room = CONF.sarakinMax - (G.yami.debt || 0);
    const amt = Math.min(amount, room);
    if (amt < CONF.sarakinUnit) { toast('灰田も、これ以上は貸さないと言った'); return; }
    // 初回は店の前で灰田と会う（全画面シーン）→ その場で受け取る
    if (!G.yami.met) {
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
      endPlacing();
    } else {
      if (G.cash < eqPrice(p.id)) { toast('資金が足りない…'); return; }
      G.cash -= eqPrice(p.id);
      G.invBuy += eqPrice(p.id);
      G.equip.push({ uid: ++G.uidN, id: p.id, x: p.gx, y: p.gy, rot: p.rot, cond: 100, temp: EQ[p.id].temp, occ: Array(EQ[p.id].cap).fill(null) });
      p.placedN++;
      toast(`🔨 ${EQ[p.id].name}を設置した！`);
      log(`🔨 ${EQ[p.id].name}を設置した`);
      // 立派な（金のかかる）設備を入れると、親父がぼやく（安い小物＝観葉植物やイスには反応しない）
      if (EQ[p.id].price >= 200000 && Math.random() < 0.6) oyajiNag('equip', 2.4);
      if (p.onPlaced) p.onPlaced();
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
  $('btnSelClose').onclick = deselect;
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
    return `<div class="opt-row slider-row"><span>${act === 'fee' ? '入浴料' : 'サウナ料'}を決める<br>
      <span class="opt-sub">目安 ¥${guide.toLocaleString()}</span></span>
      <span class="fee-slider"><input type="range" id="${act}Slider" min="${R[0]}" max="${R[1]}" step="${FEE_STEP}" value="${cur}">
      <b id="${act}SliderVal">¥${cur.toLocaleString()}</b></span></div>`;
  };
  const feeBtns = feeBtnRow(FEE_OPTIONS, o.fee, o.feeCustom, 'fee');
  // サウナ料は入浴料への上乗せ。サウナを設置して初めて設定できる
  const saunaFeeRow = hasCat('sauna')
    ? `<div class="opt-row"><span>サウナ料<br><span class="opt-sub">目安 ¥${worthSaunaFee()}。高すぎるとサウナ客が減る</span></span><span>${
        feeBtnRow(SAUNA_FEE_OPTIONS, o.saunaFee, o.saunaFeeCustom, 'saunaFee')
      }</span></div>` + (o.saunaFeeCustom ? feeSlider('saunaFee', o.saunaFee) : '')
    : `<div class="opt-row locked"><span>サウナ料<br><span class="opt-sub">🔒 サウナ設置で解放</span></span><button class="opt-btn" disabled>—</button></div>`;
  const towelBtns = [['none', 'なし'], ['free', '無料貸出'], ['paid', '有料']].map(([k, l]) =>
    `<button class="opt-btn ${o.towel === k ? 'on' : ''}" data-act="towel" data-v="${k}">${l}</button>`).join('');
  const towelPriceRow = o.towel === 'paid'
    ? `<div class="opt-row"><span>タオル料金</span><span>${[100, 200, 300].map(pp =>
        `<button class="opt-btn ${o.towelPrice === pp ? 'on' : ''}" data-act="towelPrice" data-v="${pp}">¥${pp}</button>`).join('')}</span></div>` : '';
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
  // 上限＝ガチャガチャ・絵本の棚を置いた数（0個なら¥100まで）。超えると家族連れが来ない（作者指定）
  const kidGuide = kidFeeCap(), kidN = kidsGoods().length;
  const kidFeeRow =
    `<div class="opt-row"><span>子供料金<br><span class="opt-sub">${
      kidN >= KID_FEES.length - 1 ? `上限¥${kidGuide}　子ども向けの備品${kidN}個`
      : `上限¥${kidGuide}（子ども向けの備品${kidN}個）　あと1個で¥${KID_FEES[kidN + 1]}`
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
  const tabs = [['fee', '💴 料金'], ['amen', '🧴 アメニティ'], ['rule', '🚪 ルール']];
  const tabBar = `<div class="opt-tabs">` + tabs.map(([k, l]) =>
    `<button class="tab ${manageTab === k ? 'on' : ''}" data-mtab="${k}">${l}</button>`).join('') + `</div>`;
  const feePane = `
    <div class="opt-row"><span>入浴料<br><span class="opt-sub">目安 ¥${worthFee()}。高すぎると客が減る</span></span><span>${feeBtns}</span></div>
    ${o.feeCustom ? feeSlider('fee', o.fee) : ''}
    ${kidFeeRow}
    ${saunaFeeRow}
    <div class="opt-row"><span>タオル<br><span class="opt-sub">維持¥1,000/日。無料=集客↑／有料=売上↑</span></span><span>${towelBtns}</span></div>
    ${towelPriceRow}
    ${teburaRow}`;
  const amenPane = `
    <div class="opt-row"><span>シャンプー・ボディソープ<br><span class="opt-sub">無料でも販売でも一律¥${CONF.soapCostPerDay.toLocaleString()}/日</span></span><span>${soapBtns}</span></div>
    ${soapPriceRows}
    ${hasWorking('sink')
      ? `<div class="opt-row"><span>ドライヤー<br><span class="opt-sub">無料=満足度↑／¥20=売上</span></span><span>${
          DRYER_FEES.map(f => `<button class="opt-btn ${o.dryerFee === f ? 'on' : ''}" data-act="dryerFee" data-v="${f}">${f ? '¥' + f : '無料'}</button>`).join('')
        }</span></div>`
      : `<div class="opt-row locked"><span>ドライヤー<br><span class="opt-sub">🔒 洗面所の設置で解放</span></span><button class="opt-btn" disabled>—</button></div>`}
    ${hasWorking('sink')
      ? tog('lotionOn', o.lotionOn !== false, '化粧水・乳液', `置けば満足度↑／¥${CONF.lotionCostPerDay.toLocaleString()}/日`)
      : `<div class="opt-row locked"><span>化粧水・乳液<br><span class="opt-sub">🔒 洗面所の設置で解放</span></span><button class="opt-btn" disabled>—</button></div>`}
    ${tog('akasuriTowel', hasAkasuri(), '垢すりタオル', '満足度↑／¥500/日')}
    ${tog('saunaMat', hasMat(), 'サウナマット', 'サウナ満足度↑／¥500/日')}
    <div class="opt-row locked"><span>垢すりサービス（プロが担当）<br><span class="opt-sub">🔒 新店で解放予定</span></span><button class="opt-btn" disabled>近日</button></div>`;
  const rulePane = `
    ${kitoAccepted()
      /* 鬼頭を受け入れる形で決着した店は、もう札を掲げられない（受け入れると約束したのだから）。
         ここを開けておくと「下ろして決着 → すぐ掲げ直す」で罰だけ踏み倒せてしまう */
      ? `<div class="opt-row locked"><span>刺青・ヤクザお断り<br><span class="opt-sub">🔒 鬼頭と交わした約束がある（評判 -${KITO_ACCEPT_PEN}）</span></span><button class="opt-btn" disabled>—</button></div>`
      : tog('banYakuza', o.banYakuza, '刺青・ヤクザお断り', '「怖い」不満が消える。ただし連中がみかじめ料を要求しに来る')}
    <div class="opt-row locked"><span>女湯の開放<br><span class="opt-sub">🔒 新店で解放予定</span></span><button class="opt-btn" disabled>近日</button></div>`;
  box.innerHTML = tabBar + (manageTab === 'fee' ? feePane : manageTab === 'amen' ? amenPane : rulePane);
  box.querySelectorAll('[data-mtab]').forEach(b => b.onclick = () => { manageTab = b.dataset.mtab; renderManage(); });
  box.querySelectorAll('.opt-btn').forEach(b => b.onclick = () => {
    const act = b.dataset.act, v = b.dataset.v;
    if (act === 'fee') { o.fee = +v; o.feeCustom = false; }
    else if (act === 'saunaFee') { o.saunaFee = +v; o.saunaFeeCustom = false; }
    else if (act === 'feeCustom') o.feeCustom = !o.feeCustom;
    else if (act === 'saunaFeeCustom') o.saunaFeeCustom = !o.saunaFeeCustom;
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
    renderManage(); saveGame();
  });
  // スライダーは動かしている間は再描画しない（つまみが飛ぶ）。指を離した時だけ保存して描き直す
  for (const act of ['fee', 'saunaFee']) {
    const sl = $(act + 'Slider'); if (!sl) continue;
    sl.oninput = () => { o[act] = +sl.value; $(act + 'SliderVal').textContent = '¥' + (+sl.value).toLocaleString(); };
    sl.onchange = () => { saveGame(); renderManage(); };
  }
}

/* ============ データ（いまの店の数字を確かめる） ============ */
/* 攻略チェックリストにはしない。あくまで「今どうなっているか」の計器盤。
   まだ会っていない相手のことは出さない（先の展開は見せない） */
let dataTab = 'rep';   // データ画面のタブ。開いた時は【評判】＝「今やるべきこと」が最初に目に入る
function renderData() {
  const box = $('dataBody');
  const row = (l, v, cls) => `<div class="rep-row ${cls || ''}"><span>${l}</span><span class="v">${v}</span></div>`;
  const sec = t => `<div class="opt-sec">${t}</div>`;
  const tabBar = `<div class="opt-tabs">` +
    [['rep', '🏮 評判'], ['kei', '📊 経営']].map(([k, l]) =>
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
    const badDosen = dosenParts().list.filter(x => x.v < 3);
    const am = amenityParts();
    const badAmen = am.list.filter(x => x.v < x.max).sort((x, y) => (x.v / x.max) - (y.v / y.max));
    // その項目に出す「次の一手」。コスパ・動線・おもてなしは、取りこぼしを名指しできる
    const adviceOf = it => {
      if (it.key === 'cospa' && badCospa.length)
        return `高い：${badCospa[0].name} ${badCospa[0].note}` + (badCospa.length > 1 ? ` ほか${badCospa.length - 1}件` : '');
      if (it.key === 'dosen' && badDosen.length)
        return `遠い：${badDosen[0].name} ${badDosen[0].note}` + (badDosen.length > 1 ? ` ほか${badDosen.length - 1}件` : '');
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
    // 減点のまとめ（😠）は上の1件目と同じ話なので、ここでは省く（準備画面のほうには出る）
    for (const d of demandHint()) if (!d.startsWith('😠')) todo.push(d);
    r += sec('📌 今やるべきこと');
    r += todo.length
      ? todo.slice(0, 3).map(t => `<div class="rep-voice">${t}</div>`).join('')
      : `<div class="rep-voice">✨ いまは大きな穴がない。設備を足して、さらに上を狙おう</div>`;
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
      for (const it of sp.pens)
        r += row(`　${it.l}${it.sub ? `<br><span class="opt-sub">　${it.sub}</span>` : ''}`, `−${it.v}`, 'minus');
    }
    if (sp.bonus) r += row(sp.bonus > 0 ? '街での出来事（加点）' : '街での出来事（減点）',
      `${sp.bonus > 0 ? '+' : ''}${sp.bonus}`, sp.bonus < 0 ? 'minus' : '');
    // 品揃えの評価は「種類の数」で見る＝1種類△／2種類○／3種類以上◎
    r += row('品揃え', `風呂 ${kindMark('furo')}　サウナ ${kindMark('sauna')}　水風呂 ${kindMark('mizu')}`);
    const lacks = [];
    if (!hasWorking('cooler')) lacks.push('冷水機');
    if (!hasWorking('sink')) lacks.push('洗面所');
    if (lacks.length) r += row('客が欲しがっているもの', lacks.join('・'), 'minus');
    if ((G.roughDays || 0) >= 1)
      r += row('客の我慢', `荒れた日 ${G.roughDays}日連続`
        + (G.roughDays >= CONF.riotDays ? '<br><span class="opt-sub">いつ暴れてもおかしくない</span>' : ''), 'minus');
    if (G.reina && G.reina.duel === 'announced')
      r += sec('🗳 投票対決') +
        row('投票日まで', `あと${Math.max(0, G.reina.duelDay - G.day)}日`) +
        row('見込み票', `夕凪 ${computeYuVotes()} / 蒼天 約${SOUTEN_DUEL_VOTES}`);
    return r;
  };

  box.innerHTML = tabBar + (dataTab === 'kei' ? keiPane() : repPane());
  box.querySelectorAll('[data-dtab]').forEach(b => b.onclick = () => { dataTab = b.dataset.dtab; renderData(); });
}

function renderAds() {
  const ads = [
    { key: 'flyer', name: 'チラシ配り', cost: 30000, desc: '明日 +6人ほど' },
    { key: 'mag', name: '地元ミニコミ誌に掲載', cost: 100000, desc: '明日 +14人・評判+1' },
    { key: 'job', name: '求人広告', cost: 50000, desc: '2日後の朝、応募が3人来る' },
  ];
  const list = $('sendenList');
  list.innerHTML = '';
  for (const ad of ads) {
    const div = document.createElement('div');
    div.className = 'senden-item' + (G.adBought[ad.key] ? ' done' : '');
    div.innerHTML = `<span>📣</span><div><b>${ad.name}</b><br><span class="shop-desc">${ad.desc}</span></div>
      <span class="shop-price">${G.adBought[ad.key] ? '手配済' : yen(ad.cost)}</span>`;
    div.onclick = () => {
      if (G.adBought[ad.key]) return;
      if (ad.key === 'job' && G.roster.length >= CONF.maxStaff) { toast(`スタッフはもう${CONF.maxStaff}人いる`); return; }
      if (G.cash < ad.cost) { toast('資金が足りない…'); return; }
      G.cash -= ad.cost;
      G.adBought[ad.key] = true;
      G.adBoost += ad.key === 'flyer' ? 6 : ad.key === 'mag' ? 14 : 0;
      if (ad.key === 'mag') addRep(1);
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
function renderLoan() {
  $('loanCash').innerHTML = `手持ち資金: <b>${yen(G.cash)}</b>`;
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
