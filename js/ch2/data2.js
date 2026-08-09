'use strict';

/* ============================================================
   第2章「独立開業編」のデータ
   ------------------------------------------------------------
   ・第1章（js/data.js）とは完全に別。ここをいじっても第1章は一切変わらない
   ・game.js は CONF / EQ / TYPES … という名前を見ているので、
     章を切り替えるときに js/chapter.js がこのファイルの中身を差し込む
   ・設計は CHAPTER2.md ／ 台本は CHAPTER2_SCRIPT.md
   ※数値はすべて叩き台
   ============================================================ */

/* ============ 区画（館内案内図で行き来する5つの部屋） ============
   区画ごとに大きさが違ってよい（案内図で移るので、揃える必要がない）。
   gx/gy/gw/gh ＝ 館内案内図（4列×3行）のどこに、どの大きさで描くか。
   下が入口（ロビー＆駐車場）、上が浴室＝客の導線の順に並べてある。

   depth ＝ 建物のどのくらい奥か。0＝国道側のロビー、1＝休憩・食堂、2＝浴室。
   館内を行き来するとき、奥へ進むなら上の通路（entranceTop）から出て、
   表へ戻るなら下の戸から出る＝**受付を済ませた客が玄関へ引き返さない**（rules2.js の exitDoor） */
const AREAS2 = [
  { key: 'lobby', name: '🏮 ロビー＆駐車場', W: 13, H: 11, divideY: 4, entrance: { x: 6, y: 10 }, doorX: 6, depth: 0,
    entranceTop: { x: 9, y: 0 },   // 建物の奥（休憩・食堂・浴室）へ抜ける通路
    gx: 0, gy: 3, gw: 4, gh: 2, floor: 'wood', park: true, staffMax: 2,
    wear: '私服→館内着', desc: '客はここから入り、ここから帰る。中身はほぼ駐車場のカスタマイズ。' },
  { key: 'kyukei', name: '🛋 休憩スペース',   W: 13, H: 11, divideY: 0, entrance: { x: 6, y: 10 }, doorX: 6, depth: 1,
    entranceTop: { x: 3, y: 0 },   // 上（浴室側）からも入れる
    gx: 0, gy: 1, gw: 2, gh: 1, floor: 'tatami', staffMax: 1,
    wear: '館内着（男女共用）', desc: '居心地が良いほど客が延長する＝客数を増やさずに売上が伸びる。' },
  { key: 'shokudo', name: '🍚 食堂',          W: 13, H: 11, divideY: 0, entrance: { x: 6, y: 10 }, doorX: 6, depth: 1,
    entranceTop: { x: 9, y: 0 },   // 上（浴室側）からも入れる
    gx: 2, gy: 1, gw: 2, gh: 1, floor: 'wood', staffMax: 4, jobs: [['cook','🍳 調理',2],['hall','🍜 ホール',2]],
    wear: '館内着', desc: '席数がそのまま売上。灯がいない日は閉まる。' },
  /* 男湯・女湯だけ縦に広い（作者指定＝お風呂を広げる）。
     y=1〜3 が屋外の外気浴ゾーン（外気浴デッキ3×2やテントサウナが入る）、
     y=4〜10 が浴室（サウナ3室＋水風呂3槽＋浴槽＋洗い場＋垢すり台が無理なく入る）、
     y=11〜12 が脱衣所                                                            */
  { key: 'otoko', name: '♨ 男湯',            W: 13, H: 14, divideY: 11, outdoorY: 4, entrance: { x: 6, y: 13 }, doorX: 6, depth: 2,
    gx: 0, gy: 0, gw: 2, gh: 1, floor: 'bath', outdoor: true, sex: 'm', staffMax: 1,
    wear: '裸', desc: '脱衣所＋浴室＋屋外の外気浴デッキ。' },
  { key: 'onna', name: '♨ 女湯',            W: 13, H: 14, divideY: 11, outdoorY: 4, entrance: { x: 6, y: 13 }, doorX: 6, depth: 2,
    gx: 2, gy: 0, gw: 2, gh: 1, floor: 'bath', outdoor: true, sex: 'f', noPlayer: true, staffMax: 1,
    wear: '裸', desc: '男湯と同じものを置けるかが評価の核。主人公は入れない。' },
  /* ── 廊下（作者指定）──────────────────────────────
     **部屋と部屋のあいだを、実際に歩いて渡る場所。**

     これが無かったころは、戸口まで歩いた瞬間に隣の部屋の戸口へ**瞬間移動**していた。
     ロビーで受付を済ませた客が、次の瞬間には浴室の脱衣所に立っている＝
     移動に時間がかからず、すれ違いも起きない。

     廊下を1本入れると、館内の行き来はすべてここを通る：
       ロビー → 廊下 → 浴室 ／ 浴室 → 廊下 → 食堂 …
     **歩く時間がかかり、人がすれ違い、混む時間には廊下が詰まる。**

     横に長く、奥行きは浅い（13×5）。下辺の戸がロビー、
     上辺に**行き先のぶんだけ戸が並ぶ**（topDoors）＝どの戸がどこへ抜けるかが絵で分かる。
     スタッフは置けない（staffMax:0・noStaff）＝通り道であって、部屋ではない       */
  { key: 'rouka', name: '🚪 廊下',            W: 13, H: 5,  divideY: 0, entrance: { x: 6, y: 4 }, doorX: 6, depth: 1,
    topDoors: [2, 5, 7, 10],
    topLabels: { 2: '▲休憩', 5: '▲男湯', 7: '▲女湯', 10: '▲食堂' },
    gx: 0, gy: 2, gw: 4, gh: 1, floor: 'wood', staffMax: 0, noStaff: true, corridor: true,
    wear: '館内着', desc: '部屋と部屋をつなぐ通路。ここを通らないと、どこへも行けない。' },
  /* 家（作者指定）。店ではないので館内案内図には出さないし、客も来ない。
     ここへ帰ると一日が終わる＝8時間寝て、勝手に店へ戻ってくる。
     ベッド・台所・食卓、そして千夏。狭い借家から始まる               */
  /* 玄関は**上の中央**（作者指定）。帰ってきた主人公はそこに立つ＝
     下から画面を横切って歩いてくる、という妙な入り方をしない            */
  { key: 'home', name: '🏠 家',              W: 11, H: 9,  divideY: 0, entrance: { x: 5, y: 2 }, doorX: 5,
    entranceTop: { x: 5, y: 0 },
    floor: 'tatami', home: true, noPlayer: false,
    wear: '部屋着', desc: '千夏と暮らす借家。店に全部つぎ込むか、ここにも回すか。' },
];
/* 区画の番号（コードから読みやすくするための別名） */
const AR = { LOBBY: 0, KYUKEI: 1, SHOKUDO: 2, OTOKO: 3, ONNA: 4, ROUKA: 5, HOME: 6 };

/* ============ 基本設定 ============
   第1章の CONF を土台にして、第2章で変わるところだけ上書きする。
   （こうしておかないと、第1章にあって第2章に書き忘れた設定が undefined になって壊れる） */
const CONF2 = {
  ...CONF,

  areas: AREAS2,
  guideCol: 4, guideRow: 5,        // 館内案内図の枡目（廊下を1段はさむので5行）

  /* ── 開業資金（CHAPTER2.md §10-1／作者指定）──────────────────
     **物件の取得と基礎工事を終えた状態から始まる。**

       自己資金        ¥5,000,000
       公庫の創業融資  ¥10,000,000   ＝ ¥15,000,000
       − 物件の取得    ¥4,000,000
       − 基礎工事      ¥3,000,000
       − 開業までに消えた分 ¥3,000,000
         （内装の手直し・什器・求人広告・開業前の運転資金。
          計画どおりに収まる開業など無い、という一行ぶんの現実）
       ───────────────────────
       手元に残った        **¥5,000,000**

     ここから毎日、光熱費と5人ぶんの人件費が出ていく。
     公庫への返済は30日ごと¥165,000（CONF2.bills）＝**残債は少しずつ減る**       */
  startCash: 5000000,
  startDebt: 10000000,        // 公庫の創業融資（年2.0%・7年）。すでに借りている
  bukkenPrice: 4000000,       // 物件の取得（買い取り済み）
  kisoKouji: 3000000,         // 浴室の防水打ち直し・配管更新・ボイラーの部品交換（済み）

  /* ── 毎日の固定費（客が0人でも出ていく。ここは店の経費＝日報の収支に入る） */
  baseUtil: 6000,             // 基本光熱費（男湯・女湯の2系統）
  koteiShisan: 1500,          // 固定資産税・保険（買ったので家賃は無い）

  /* ── 時計と速度は第1章と同じ（作者指定）──────────────
     一週間を通しで回す作りをやめて、第1章と同じ「1日ごと」に戻した。
     速度表（[1,2,4,8]）も minPerSec も CONF から丸ごと引き継ぐので、
     ここには何も書かない＝**書かないことが仕様**。
     clockStep（時計の刻み）と subStepMin（計算の細分割）も廃止した＝分単位で滑らかに進む。

     ただし昼夜の演出は残すので、その目印だけ別に立てる（下の CONF2.dayNight）  */

  /* ── 男女別（第2章の看板）。女性客が来るようになる */
  menOnly: false,

  /* 親父の小言は出さない。第1章の夕凪湯の話（「銭湯にゃ要らん」）なので、
     自分で買った国道沿いの箱に電話が掛かってくるのは筋が通らない。
     第2章の登場人物の口出しは story2.js／mission2.js の側で作る */
  oyajiNag: false,

  /* 洗面所として数えるもの（第2章のID）。ここを渡さないと game.js が第1章の
     'sink'／'sink_old' を探し続け、ドライヤーと化粧水が永久に鍵つきのままになる */
  sinkIds: ['d2_sink', 'd2_powder'],

  /* ── 客足。郊外・国道沿い・駐車場40台（作者指定で上方修正）──────────
     第1章の夕凪湯は「路地裏の銭湯で、誰も来ない」ところから始まった。
     第2章は**国道沿いに駐車場40台**の箱を買った店で、部屋ごとに人を張る。
     開業初日から人件費が4人ぶん（約¥29,000）出ていくので、
     客が5人しか来ないと、どう組んでも黒字にならない＝判断そのものが成立しない。

     だから通りすがりの母数を、実在の郊外型温浴施設に寄せる。

       評判0   … 約 45人／日　（売上 ¥54,000）── 4人体制でぎりぎり黒字
       評判30  … 約 85人／日
       評判60  … 約125人／日
       評判100 … 約200人／日（上限300）

     **「開けた部屋が、その人の日給より多く稼ぐ」**という形にしてある。
     全部の部屋を開けるのが常に正解ではなく、開けられるようになったら開ける  */
  guestMul: 1.5,
  guestMax: 300,
  guestBase: 30,
  guestPerRep: 0.9,
  regularMax: 120,

  /* ── 屋号（章ごとに完全に別。第1章の「夕凪湯」とは混ざらない） */
  shopNaming: {
    def: 'サウナ ゆらぎ',
    title: '新しい店の名前を決めよう',
    note: '前の看板は下ろした。ここに掛ける名前は、あんたが決める。',
    suggests: ['サウナ ゆらぎ', '国道サウナ', 'ゆらぎ', '俺のサウナ'],
  },

  /* ── 駐車場（第1章に無かった軸） */
  parkBase: 20,               // 砂利のままで停められる台数（元健康ランドの敷地。区画線が無いので効率は悪い）
  parkPerSlot: 3,             // 駐車マス1組（3×2マス）で増える台数＝3台（車1台＝1×2マス）
  pavePricePerTile: 12000,    // アスファルト舗装の工事費（1マスあたり）
  gravelSatHit: 4,            // 砂利のままだと雨の日に落ちる満足度
  gravelWomanRate: 0.85,      // 砂利のままだと女性客がこの割合まで減る
  darkWomanRate: 0.7,         // 外灯が足りないと、夜の女性客がこの割合まで減る
};

/* ============ 運営メニューの初期値 ============ */
const DEFAULT_OPTS2 = {
  ...DEFAULT_OPTS,
  /* 開業直後の値段。**ボロい設備で¥1,200は取れない**（客足が7割減る）。
     設備を入れ替えてから値上げする、という順番になるよう安く始める */
  fee: 800,                   // 3時間パック（平日）
  feeHoliday: 1000,           // 3時間パック（土日祝）
  feeFree: 1200,              // フリータイム（平日）
  feeFreeHoliday: 1500,       // フリータイム（土日祝）
  extendFee: 300,             // 延長料（1時間）
  saunaFee: 0,                // サウナ料は取らない（入館料に込み＝サウナ特化の店なので）
  kidFee: 0,                  // 子どもは受け入れない（→ 嫌われる覚悟）
  banKids: true,
  timeLimit: 180,             // 3時間
  nightOpen: false,           // 深夜営業（深夜に立てるバイトを雇うと選べる）
};

/* ============ 料金の選択肢 ============ */
const FEE_OPTIONS2 = [1000, 1200, 1500];
const FEE_RANGE2 = [800, 2500];
const FEE_BASE2 = 1200;
const FEE_CEIL2 = 2500;
/* 客が「まあこれなら」と思う額（評判ごと）。第1章の銭湯（¥600〜¥1,000）とは桁が違うので、
   第2章のサウナ施設の相場に置き換える。これを超えて取ると客足が細る（feeGripe）。

     評判0〜20  … ¥900　　開業直後。ボロい設備でも、国道沿いなら通りすがりは入る
     評判〜40   … ¥1,100
     評判〜60   … ¥1,400
     評判〜80   … ¥1,800
     それ以上   … ¥2,500（FEE_CEIL2）＝湯匠と正面から張り合える値段          */
CONF2.worthFee = [[20, 900], [40, 1100], [60, 1400], [80, 1800]];
/* サウナ料金＝入館料への上乗せ（作者指定で復活）。
   第2章は「入館料にサウナ込み」で始めたので **選択肢が [0] しか無く、
   運営メニューの行が永久に灰色だった**。実際の郊外施設と同じく
   「入浴のみ／サウナ付き」を分けられるようにする。
   既定は¥0＝込み。上乗せを取るかどうかは店の判断にする                     */
const SAUNA_FEE_OPTIONS2 = [0, 300, 500, 700];
const SAUNA_FEE_RANGE2 = [0, 1000];
const SAUNA_FEE_BASE2 = 0;
const KID_FEES2 = [0];
const TIME_LIMITS2 = [180, 240, 0];          // 3時間／4時間／フリータイム
const STAY_NEED_MIX2 = [[120, 0.35], [180, 0.45], [240, 0.20]];
const STAY_NEED_BATH2 = 90;

/* ============ 設備カタログ ============
   第1章の設備は1つも持ち込まない。全部この章専用。
   area ＝ 置ける区画（省略＝どこでも）。room/tab は第1章と同じ意味  */
const EQ2 = {
  /* ── システム（初期設置） ── */
  bandai:      { cat:'sys', name:'受付カウンター', w:3,h:1, price:0, q:1, run:0, cap:0, area:AR.LOBBY },

  /* ── ロビー（区画①の屋内・上3マス） ── */
  f2_ticket:   { cat:'datsui', tab:'lobby', area:AR.LOBBY, name:'券売機',       w:1,h:1, price:400000, q:3, run:200, cap:0,
                 desc:'先に券を買ってもらう。受付の行列が消える。' },
  f2_shoe:     { cat:'locker', tab:'lobby', area:AR.LOBBY, name:'靴箱',         w:2,h:1, price:90000,  q:2, run:0, cap:0, lock:12,
                 desc:'足りないと入館待ちの列ができる。' },
  f2_goods:    { cat:'etc',    tab:'lobby', area:AR.LOBBY, name:'物販棚',       w:2,h:1, price:200000, q:2, run:100, cap:1,
                 desc:'サウナハット・Tシャツ・オリジナルタオル。原価率50%。' },
  f2_vend:     { cat:'etc',    tab:'lobby', area:AR.LOBBY, name:'ドリンク自販機', w:1,h:1, price:200000, q:2, run:500, cap:1,
                 desc:'オロポにポカリ。湯上がりの喉が鳴る。' },
  f2_sofa:     { cat:'rest',   tab:'lobby', area:AR.LOBBY, name:'待合ソファ',   w:2,h:1, price:130000, q:2, run:0, cap:2,
                 pas:{ sat:2, score:2 }, desc:'混む時間の受け皿。無いと入口で客が滞る。' },
  f2_kasa:     { cat:'etc',    tab:'lobby', area:AR.LOBBY, name:'傘立て',       w:1,h:1, price:20000,  q:1, run:0, cap:0,
                 pas:{ sat:1, score:1 }, desc:'雨の日に濡れた傘を持ち込ませない。安いが効く。' },
  f2_maruta:   { cat:'etc',    tab:'lobby', area:AR.LOBBY, name:'丸太のベンチ',  w:2,h:1, price:70000,  q:2, run:0, cap:2,
                 pas:{ sat:2, score:2 }, desc:'待合の空気が和らぐ。木の匂いが残っている。' },
  f2_water:    { cat:'etc',    tab:'lobby', area:AR.LOBBY, name:'ウォーターサーバー', w:1,h:1, price:150000, q:3, run:400, cap:0,
                 pas:{ sat:3, score:3 }, desc:'入る前の一杯。地味だが「気が利く店」の印象が残る。' },
  f2_hat:      { cat:'etc',    tab:'lobby', area:AR.LOBBY, name:'サウナハット掛け', w:2,h:1, price:80000, q:3, run:0, cap:0, rep:20,
                 pas:{ sat:3, score:4 }, desc:'自分のハットを掛けて帰る客ができる＝通う理由になる。' },
  f2_ice:      { cat:'etc',    tab:'lobby', area:AR.LOBBY, name:'アイスの冷凍ケース', w:1,h:1, price:180000, q:3, run:700, cap:1, rep:15,
                 desc:'湯上がりのガリガリ君。単価は安いが、ほぼ全員が手を出す。' },
  f2_board:    { cat:'etc',    tab:'lobby', area:AR.LOBBY, name:'イベント黒板',   w:2,h:1, price:40000,  q:2, run:0, cap:0,
                 pas:{ sat:2, score:3 }, desc:'今日のロウリュの時間を書く。次に来る理由をここに書く。' },
  f2_coin:     { cat:'locker', tab:'lobby', area:AR.LOBBY, name:'貴重品ロッカー', w:2,h:1, price:140000, q:3, run:0, cap:0, lock:8, rep:15,
                 desc:'財布とスマホを預けられる。無いと遠征客が落ち着かない。' },
  f2_massage:  { cat:'etc',    tab:'lobby', area:AR.LOBBY, name:'マッサージ機（10分¥200）', w:1,h:1, price:260000, q:3, run:300, cap:1, rep:25,
                 desc:'待ち時間が売上に変わる。混む日ほど効く。' },

  /* ── 駐車場（区画①の屋外・下側）。第1章に無かった軸 ── */
  p2_pave:     { cat:'park', tab:'park', area:AR.LOBBY, name:'アスファルト舗装', w:2,h:2, price:150000, q:2, run:0, cap:0, outdoor:true, floorTile:true, floorCol:['#565049','#514b45'],
                 desc:'砂利のままでも停められるが、雨の日は泥はねで満足度が落ちる。舗装すればそれが無くなる。' },
  /* 車1台＝1×2マス（縦向き）。白線1組で3台ぶん＝3×2マス（作者指定） */
  p2_slot:     { cat:'park', tab:'park', area:AR.LOBBY, name:'駐車マス',        w:3,h:2, price:40000,  q:2, run:0, cap:0, outdoor:true,
                 desc:'白線を引くと、同じ面積で停められる台数が増える（1組で3台）。満車になると、客は入口にも来ずに素通りする。' },
  /* 大型車1台＝1×3マス（縦向き）。1組で3台ぶん＝3×3マス（作者指定） */
  p2_big:      { cat:'park', tab:'park', area:AR.LOBBY, name:'大型車スペース',  w:3,h:3, price:120000, q:3, run:0, cap:0, outdoor:true,
                 gate:'driver', desc:'これが無いとトラック運転手は停められない（1組で3台）。近所からの「夜中の車」の苦情もこれで収まる。' },
  p2_light:    { cat:'park', tab:'park', area:AR.LOBBY, name:'外灯',            w:1,h:1, price:80000,  q:2, run:150, cap:0, outdoor:true,
                 desc:'暗い駐車場に、女性客は夜来ない。' },
  p2_kanban:   { cat:'park', tab:'park', area:AR.LOBBY, name:'国道沿いの看板',  w:2,h:1, price:250000, q:3, run:100, cap:0, outdoor:true,
                 desc:'走っている車から見える。新規の客はここから入ってくる。' },
  p2_ev:       { cat:'park', tab:'park', area:AR.LOBBY, name:'EV充電器',        w:1,h:2, price:600000, q:4, run:400, cap:1, outdoor:true,
                 gate:'ev', desc:'これが無いと、電気自動車の客は来ない。' },
  p2_bicycle:  { cat:'park', tab:'park', area:AR.LOBBY, name:'駐輪場',          w:2,h:1, price:60000,  q:1, run:0, cap:0, outdoor:true,
                 gate:'senior', desc:'近所の年配客は自転車で来る。' },
  p2_yusetsu:  { cat:'park', tab:'park', area:AR.LOBBY, name:'融雪ヒーター',    w:2,h:2, price:500000, q:3, run:800, cap:0, outdoor:true,
                 desc:'雪の日に客足が落ちなくなる。地方の冬は長い。' },
  p2_camera:   { cat:'park', tab:'park', area:AR.LOBBY, name:'防犯カメラ',      w:1,h:1, price:120000, q:2, run:100, cap:0, outdoor:true,
                 desc:'車上荒らしを防ぐ。起きてからでは遅い。' },
  p2_nobori:   { cat:'park', tab:'park', area:AR.LOBBY, name:'幟（のぼり）',     w:1,h:1, price:15000,  q:1, run:50, cap:0, outdoor:true,
                 desc:'安い。数を立てるほど効く。湯匠は50本立ててくる。' },
  p2_gate:     { cat:'park', tab:'park', area:AR.LOBBY, name:'入口ゲート看板',   w:3,h:1, price:180000, q:3, run:80, cap:0, outdoor:true,
                 desc:'ここが入口だと分かる。国道は速度が速く、迷うと通り過ぎられる。' },
  p2_bike:     { cat:'park', tab:'park', area:AR.LOBBY, name:'バイク置き場',     w:2,h:1, price:70000,  q:2, run:0, cap:0, outdoor:true,
                 desc:'ツーリング帰りが寄る。夏の休日に効く。' },
  p2_tree:     { cat:'park', tab:'park', area:AR.LOBBY, name:'植栽',             w:1,h:1, price:45000,  q:2, run:100, cap:0, outdoor:true,
                 pas:{ sat:1, score:2 }, desc:'砂利の駐車場が「荒れ地」に見えなくなる。' },
  p2_smoke:    { cat:'park', tab:'park', area:AR.LOBBY, name:'喫煙所',           w:2,h:1, price:130000, q:2, run:150, cap:2, outdoor:true,
                 desc:'外に出す＝館内が匂わない。吸う客も、吸わない客も落ち着く。' },

  /* ── サウナ（③男湯／④女湯）。温度だけでなく「体験の作り分け」で評価する ──
     loyly: none/auto/self ／ light: red/green/dark/wood ／ bgm: none/ambient/talk
     style: normal/nesauna/kobeya/steam/tent                                    */
  /* 薪サウナ＝最初の一台（作者指定で廃止したテント／プレハブの代わり）。
     設備は安いが、火の番がいる＝手間で払う。本場フィンランド式で、温度は一定しない */
  s2_maki:     { room:'bath', cat:'sauna', name:'薪サウナ',           w:3,h:2, price:550000,  q:4, run:900,  cap:5, temp:80,
                 loyly:'self', light:'wood', bgm:'none', style:'normal',
                 desc:'薪ストーブで焚く本場フィンランド式。温度は一定しない。都内にも数えるほどしかない。' },
  s2_mushi:    { room:'bath', cat:'sauna', name:'蒸サウナ（薬草）',   w:1,h:2, price:380000,  q:4, run:1400, cap:1, temp:50, rep:15,
                 loyly:'none', light:'green', bgm:'ambient', style:'steam', gentle:true, tag:'薬草',
                 desc:'高野槙の樽にひとりで座る。伊吹山の薬草を9種。50℃の蒸気が下から立ちのぼる。' },
  s2_steam:    { room:'bath', cat:'sauna', name:'スチームサウナ',     w:2,h:2, price:600000,  q:3, run:2500, cap:8, temp:55, rep:25,
                 loyly:'none', light:'green', bgm:'ambient', style:'steam', gentle:true, tag:'ミスト',
                 desc:'55℃の蒸気。15分ごとに放水。熱いのが苦手な客は、まずここに来る。' },
  s2_kobeya:   { room:'bath', cat:'sauna', name:'半個室サウナ',       w:2,h:2, price:800000,  q:4, run:2800, cap:4, temp:88, rep:35,
                 loyly:'auto', light:'dark', bgm:'none', style:'kobeya',
                 desc:'仕切りのある席。一人になりたい客は、これが無いと来ない。' },
  s2_main:     { room:'bath', cat:'sauna', name:'メインサウナ',       w:3,h:2, price:900000,  q:3, run:3000, cap:14, temp:90, rep:20,
                 loyly:'auto', light:'red', bgm:'ambient', style:'normal',
                 desc:'15分ごとのオートロウリュ。赤い照明。この店の背骨。' },
  s2_big:      { room:'bath', cat:'sauna', name:'大型サウナ（寝サウナ付）', w:3,h:2, price:1100000, q:4, run:3800, cap:16, temp:95, rep:40,
                 loyly:'auto', light:'dark', bgm:'talk', style:'nesauna',
                 desc:'会話OKの広い部屋。寝ころべる段がある。カップルと学生はここ。' },
  s2_hot:      { room:'bath', cat:'sauna', name:'超高温ドライサウナ', w:3,h:2, price:1200000, q:5, run:4500, cap:14, temp:100, rep:45,
                 loyly:'auto', light:'red', bgm:'none', style:'normal',
                 desc:'100℃。無音。仕事帰りの男が黙って座る。' },
  s2_finland:  { room:'bath', cat:'sauna', name:'フィンランドサウナ', w:3,h:2, price:950000,  q:5, run:3200, cap:8, temp:90, rep:20,
                 loyly:'self', light:'wood', bgm:'none', style:'normal',
                 desc:'木の壁、石、柄杓。余計なものが何も無い部屋。分かる客ほど、ここに戻ってくる。' },
  s2_oto:      { room:'bath', cat:'sauna', name:'音サウナ',           w:3,h:2, price:1600000, q:5, run:4200, cap:10, temp:95, rep:40,
                 loyly:'auto', light:'red', bgm:'bass', style:'normal',
                 desc:'マグマのような真っ赤な照明と、腹に響く重低音。休むための部屋ではない。攻めの一室。' },
  s2_kero:     { room:'bath', cat:'sauna', name:'ケロ材セルフロウリュ室', w:2,h:2, price:1300000, q:5, run:4000, cap:6, temp:90, rep:50,
                 loyly:'self', light:'wood', bgm:'none', style:'normal',
                 desc:'自分で石に水をかけられる唯一の部屋。遠征サウナーの本命。湯匠には無い。' },

  /* ── 男湯だけ／女湯だけに置けるもの（作者指定）。
     sexOnly:'m' は男湯、'f' は女湯にしか置けない＝左右で作り分けが生まれる ── */
  b2_denki:    { room:'bath', cat:'furo', name:'電気風呂',           w:2,h:1, price:280000,  q:3, run:900,  cap:2, temp:41, rep:20,
                 desc:'ビリビリ効く腰痛の駆込寺。年配の常連が順番待ちをする。' },
  d2_shave:    { room:'datsui', cat:'datsui', name:'ひげ剃りブース', w:2,h:1, price:150000,  q:3, run:200,  cap:1, sexOnly:'m',
                 desc:'鏡と湯と、使い捨ての剃刀。出勤前に寄る客が、これ目当てで通う。男湯にしか置けない。' },
  d2_dresser:  { room:'datsui', cat:'datsui', name:'高級ドレッサー', w:3,h:1, price:380000,  q:5, run:400,  cap:2, rep:30, sexOnly:'f',
                 desc:'高級ドライヤーと基礎化粧品を並べた鏡台。ここが弱い店は、女性客が二度と来ない。女湯にしか置けない。' },

  /* ── 水風呂（温度の段を網羅するほど評判が伸びる） ── */
  m2_tank:     { room:'bath', cat:'mizu', name:'水風呂（チラー無し）', w:2,h:1, price:200000,  q:2, run:800,  cap:2, temp:18,
                 desc:'18℃。最初の一槽。ただし湯匠と同じ温度＝ここでは差がつかない。' },
  m2_cold:     { room:'bath', cat:'mizu', name:'冷たい水風呂',       w:2,h:1, price:350000,  q:3, run:1800, cap:2, temp:13, rep:25,
                 desc:'13℃。誰が入っても気持ちいい。' },
  m2_single:   { room:'bath', cat:'mizu', name:'シングル水風呂',     w:2,h:1, price:650000,  q:5, run:4000, cap:2, temp:9,  rep:40,
                 desc:'9℃。十人中六人には冷たすぎる。残りの四人が、片道八十キロ走って来る。' },
  m2_plunge:   { room:'bath', cat:'mizu', name:'寝転び水風呂',       w:3,h:1, price:700000,  q:4, run:2200, cap:3, temp:17, rep:35,
                 desc:'17℃のバイブラ。浅く寝そべる。' },
  m2_soda:     { room:'bath', cat:'mizu', name:'高濃度炭酸泉',       w:3,h:2, price:900000,  q:5, run:3200, cap:4, temp:37, rep:45,
                 desc:'37℃。ととのう前にも後にも効く。' },

  /* ── 浴槽・洗い場 ── */
  b2_nuru:     { room:'bath', cat:'furo', name:'ぬる湯',             w:2,h:2, price:380000,  q:2, run:1400, cap:4, temp:38 },
  /* あつ湯（作者指定・開業初日から置ける）。ぬる湯と対になる一槽で、
     44℃＝好みがはっきり割れる温度。**湯の温度の幅**がそのまま評判に効く（tempVariety）ので、
     ぬる湯とあつ湯を並べた店は、槽をひとつ増やすより点が伸びる               */
  b2_atsu:     { room:'bath', cat:'furo', name:'あつ湯',             w:2,h:2, price:400000,  q:3, run:1800, cap:4, temp:44,
                 desc:'44℃。長くは入れない。入れる客は、ここに入るために来る。' },
  b2_hot:      { room:'bath', cat:'furo', name:'ジェット付き温浴槽', w:3,h:2, price:500000,  q:3, run:2000, cap:6, temp:40, rep:20 },
  b2_roten:    { room:'bath', cat:'furo', name:'露天風呂',           w:3,h:2, price:1200000, q:5, run:2800, cap:6, temp:41, rep:45, outdoor:true,
                 desc:'屋外にしか置けない。郊外の特権。' },
  w2_kakeyu:   { room:'bath', cat:'wash', name:'かけ湯',             w:1,h:1, price:80000,   q:2, run:200, cap:1 },
  w2_shower:   { room:'bath', cat:'wash', name:'シャワーブース',     w:1,h:1, price:120000,  q:3, run:350, cap:1 },
  /* 洗い場は開業初日から置ける（作者指定）。体を洗う場所を評判で縛る道理がない＝
     ここを塞ぐと「風呂屋なのに洗えない店」で開業することになる                 */
  w2_bank:     { room:'bath', cat:'wash', name:'洗い場（5連）',      w:3,h:1, price:450000,  q:4, run:900, cap:5 },
  sv2_akasuri: { room:'bath', cat:'wash', name:'垢すり台',           w:2,h:2, price:700000,  q:4, run:600, cap:1, rep:40,
                 desc:'裸で受けるので浴室内に置く。専任の職人が要る。ひとり¥3,000。' },

  /* サウナマット／垢すりタオルの置き場（運営メニューのトグルから浴室に置く）。
     **第1章の EQ にしか定義が無く、第2章では「置く」を押しても何も起きなかった。**
     売り物ではないので noShop。無料で、壊れない                               */
  matrack:     { room:'bath', cat:'amenity', name:'サウナマット置き場', w:1,h:1, price:0, q:1, run:0, cap:0, noShop:true,
                 desc:'サウナ客が敷くマットの棚。浴室内に置く。' },
  akarack:     { room:'bath', cat:'amenity', name:'垢すりタオル置き場', w:1,h:1, price:0, q:1, run:0, cap:0, noShop:true,
                 desc:'体を洗う垢すりタオルのカゴ。浴室内に置く。' },

  /* ── 外気浴（③④の屋外ゾーン。裸のまま出る） ── */
  r2_gaiki:    { room:'bath', cat:'rest', tab:'gaiki', name:'外気浴デッキ',   w:3,h:2, price:350000,  q:4, run:0, cap:3, outdoor:true, rep:15,
                 desc:'風が通ると満足度が跳ねる。都心では作れない。' },
  /* ⚠ **座る／寝そべるものに outdoor:true を付けないこと**（作者指定）。
     付けると屋外ゾーンにしか置けなくなり、サウナのすぐ横で休ませられない。
     屋外限定でよいのは「屋根の無い場所そのもの」＝外気浴デッキ・露天風呂・
     アロマミストシャワーだけ                                                */
  r2_hammock:  { room:'bath', cat:'rest', tab:'gaiki', name:'ハンモック',     w:2,h:1, price:120000,  q:3, run:0, cap:1 },
  r2_aroma:    { room:'bath', cat:'rest', tab:'gaiki', name:'アロマミストシャワー', w:1,h:1, price:180000, q:3, run:300, cap:1, outdoor:true, rep:35 },
  /* ととのいイス（作者指定）。浴室にも外気浴ゾーンにも置ける＝サウナのすぐ横で休める */
  b2_totonoi:  { room:'bath', cat:'rest', tab:'gaiki', name:'ととのいイス',   w:1,h:1, price:60000,   q:3, run:0, cap:1,
                 desc:'これが無いと、整う前に客が浴室から出てしまう。いちばん安い決め手。' },
  b2_infinity: { room:'bath', cat:'rest', tab:'gaiki', name:'インフィニティチェア', w:1,h:2, price:180000, q:5, run:0, cap:1, rep:25,
                 desc:'背を倒すと視界から床が消える。一度座った客は、この椅子の話をしてから帰る。' },
  b2_bench:    { room:'bath', cat:'rest', tab:'gaiki', name:'ベンチ',         w:2,h:1, price:90000,   q:3, run:0, cap:2,
                 desc:'2人ぶんの長椅子。浴室の中にも、外の風の通る場所にも置ける。' },
  r2_cooler:   { room:'bath', cat:'etc', tab:'gaiki', name:'冷水機',     w:1,h:1, price:100000,  q:2, run:350, cap:0,
                 pas:{ sat:4, score:4 }, desc:'無いとサウナ客の満足度が伸びない。' },

  /* ── 脱衣所 ── */
  d2_locker:   { cat:'locker', tab:'datsui', room:'datsui', name:'大型ロッカー', w:2,h:1, price:180000, q:3, run:0, cap:0, lock:12 },
  d2_sink:     { cat:'datsui', room:'datsui', name:'洗面台',         w:2,h:1, price:120000, q:2, run:200, cap:0,
                 pas:{ sat:3, score:3 } },
  d2_toilet:   { cat:'datsui', room:'datsui', name:'ウォシュレット', w:1,h:1, price:320000, q:4, run:500, cap:0,
                 pas:{ sat:4, score:4 } },
  d2_powder:   { cat:'datsui', room:'datsui', name:'パウダールーム', w:3,h:1, price:380000, q:4, run:400, cap:0, rep:25,
                 pas:{ sat:5, score:5, likes:['ol2','mama','couple_f'], like:4 },
                 desc:'鏡とドライヤーが並ぶ。女湯に無いと、女性客の満足度は伸びない。' },

  /* ── 休憩スペース（⑤・館内着で男女共用）。ここが延長料の装置 ── */
  x2_bench:    { cat:'rest', tab:'suwaru', area:AR.KYUKEI, name:'長椅子',     w:2,h:1, price:60000,  q:1, run:0, cap:2, ext:0.02 },
  x2_goro:     { cat:'rest', tab:'ne', area:AR.KYUKEI, name:'ごろ寝マット', w:2,h:1, price:140000, q:3, run:0, cap:2, ext:0.06, rep:20,
                 desc:'床に転がる。第1章では置けなかったやつ。' },
  /* ── 追加（作者指定・実際のスパの写真から）──
     ビーズクッション … ヨギボーMAX系。人をだめにするやつ
     ロングソファ     … 背もたれ付きの長いソファ／デイベッド。複数人がだらける
     仮眠リクライナー … スパの「テレビ付きリクライニングシート」。休憩スペースの最上位

     ※〈リクライニングチェア〉（無印・¥16万）は廃止した。あれはサウナ用のイス。
       休憩スペースに置くのは、下の**テレビ付きの仮眠席**のほう（作者と確認）      */
  /* 1マス・1人がけ（作者指定＝2×2はでかすぎた）。ヨギボーは一人が沈むもので、
     部屋を占領する家具ではない。**安いので何個も並べる**のがこの品の使い方 */
  x2_beads:    { cat:'rest', tab:'ne', area:AR.KYUKEI, name:'ビーズクッション', w:1,h:1, price:70000, q:3, run:0, cap:1, ext:0.07, rep:15,
                 pas:{ sat:3, score:3, likes:['gakusei','ol2','hitori'], like:4 },
                 desc:'沈む。立てなくなる。安いので、並べるほど効く。' },
  x2_sofa2:    { cat:'rest', tab:'suwaru', area:AR.KYUKEI, name:'ロングソファ', w:3,h:1, price:200000, q:4, run:0, cap:3, ext:0.08, rep:20,
                 pas:{ sat:3, score:4, likes:['couple_m','couple_f','mama'], like:3 },
                 desc:'背もたれ付きの長いソファ。並んで座れる＝連れのある客が長居する。' },
  x2_nap:      { cat:'rest', tab:'ne', area:AR.KYUKEI, name:'仮眠リクライナー', w:1,h:2, price:280000, q:5, run:0, cap:1, ext:0.13, rep:35,
                 pas:{ sat:4, score:5, likes:['salary2','driver','ensei'], like:4 },
                 desc:'黒革の深いリクライニング。頭まで預けて倒れる。ここで寝てしまう客が出る＝延長がいちばん伸びる。' },
  x2_work:     { cat:'rest', tab:'sugosu', area:AR.KYUKEI, name:'ワークスペース', w:2,h:1, price:220000, q:4, run:400, cap:2, ext:0.10, rep:30,
                 pas:{ sat:3, score:4, likes:['salary2','ensei'], like:3 },
                 desc:'電源とWi-Fi。サウナ→仕事→サウナ。湯匠には絶対に置けない（本部の決裁が通らない）。' },
  x2_yomi:     { cat:'rest', tab:'sugosu', area:AR.KYUKEI, name:'静かな読書灯コーナー', w:2,h:1, price:130000, q:3, run:200, cap:2, ext:0.06,
                 pas:{ sat:2, score:3, likes:['hitori'], like:4 } },
  x2_massage:  { cat:'rest', tab:'suwaru', area:AR.KYUKEI, name:'マッサージチェア', w:1,h:1, price:230000, q:3, run:200, cap:1, ext:0.04,
                 desc:'¥100を入れて座る。売上にもなる。' },
  /* 〈給水機〉は廃止（作者指定）。給水は浴室側の〈冷水機〉(r2_cooler) に一本化する＝
     水を飲みに行く場所が2つある必然性がない。
     〈ボディケア台〉も廃止＝施術は垢すりとよもぎ蒸しの2つに絞る。               */
  /* よもぎ蒸しは裸で入る浴室のものではない（作者と確認）。
     マントを被って個室で受ける韓国式の施術＝**女性専用の個室**として休憩スペースに置く。
     別料金・予約制。垢すり／ボディケアと並ぶ、女性客向けの稼ぎ頭                */
  sv2_yomogi:  { cat:'rest', tab:'shitsurae', area:AR.KYUKEI, name:'よもぎ蒸しの個室', w:2,h:2, price:420000, q:4, run:1600, cap:1, rep:25, womenOnly:true,
                 desc:'韓国式。マントを被って座る個室。女性専用・別料金でひとり¥3,500。冷えとむくみに効くと口伝てで広がる。' },
  x2_hammock2: { cat:'rest', tab:'ne', area:AR.KYUKEI, name:'室内ハンモック', w:2,h:1, price:180000, q:4, run:0, cap:1, ext:0.09, rep:25,
                 desc:'揺れながら意識が飛ぶ。雨の日でも「ととのい」が続く。' },
  x2_tatami:   { cat:'rest', tab:'ne', area:AR.KYUKEI, name:'畳の小上がり', w:3,h:2, price:300000, q:4, run:0, cap:4, ext:0.10, rep:20,
                 desc:'靴を脱いで寝転がれる。グループが長居する。' },
  x2_manga:    { cat:'rest', tab:'sugosu', area:AR.KYUKEI, name:'サウナ雑誌の棚', w:2,h:1, price:90000, q:2, run:100, cap:1, ext:0.05,
                 pas:{ sat:3, score:3 }, desc:'サウナと旅の本だけを並べた棚。読みながら汗が引くのを待つ。' },
  /* マンガ棚（作者指定）。雑誌の棚とは別物＝**滞在時間を殴りに行く設備**。
     一度読み始めた客は、続きが気になって帰らない＝延長料がいちばん素直に伸びる。
     そのぶん席が埋まったまま回らなくなるので、席数との兼ね合いになる            */
  /* ★4。客は休憩の設備を**★の高い順に選ぶ**（equipFit）ので、★3にすると
     ロングソファ（★4）と仮眠リクライナー（★5）に埋もれて、
     いちばん長く居させる設備なのに一度も座られない（実測：2日で0人）        */
  x2_manga2:   { cat:'rest', tab:'sugosu', area:AR.KYUKEI, name:'マンガ棚', w:2,h:2, price:240000, q:4, run:150, cap:2, ext:0.12, rep:20,
                 pas:{ sat:4, score:4, likes:['gakusei','hitori','salary2'], like:4 },
                 desc:'続きが気になって帰れなくなる。滞在はいちばん伸びるが、席は埋まったままになる。' },
  x2_tv:       { cat:'rest', tab:'sugosu', area:AR.KYUKEI, name:'静かなテレビ（字幕）', w:2,h:1, price:150000, q:3, run:350, cap:2, ext:0.06,
                 pas:{ sat:3, score:3 }, desc:'音は出さない。字幕だけ。喋りたい客と静かな客を分ける。' },
  x2_aroma:    { cat:'etc',  tab:'shitsurae', area:AR.KYUKEI, name:'アロマディフューザー', w:1,h:1, price:60000, q:3, run:200, cap:0, rep:20,
                 pas:{ sat:4, score:4 }, desc:'部屋に入った瞬間の匂いが変わる。何が良いかは言葉にならない。' },
  x2_plant:    { cat:'etc',  tab:'shitsurae', area:AR.KYUKEI, name:'大きな観葉植物', w:1,h:1, price:50000, q:2, run:50, cap:0,
                 pas:{ sat:2, score:2 }, desc:'一本あるだけで、部屋が「休むところ」になる。' },
  x2_locker2:  { cat:'etc',  tab:'sugosu', area:AR.KYUKEI, name:'充電ステーション', w:1,h:1, price:110000, q:3, run:250, cap:2, ext:0.07, rep:15,
                 desc:'スマホを挿している間は帰れない。ワークスペースと相性がいい。' },
  /* 〈コインランドリー〉は廃止（作者指定）。銭湯の隣にあるのは自然だが、
     休憩スペースの中に洗濯機が回っているのは「休むところ」の空気を壊す。       */

  /* ── 食堂（②） ── */
  /* ── 厨房の工事（1マスずつ・作者指定）──
     「厨房」という一個の物は置かない。**箱のほうだけを、1マスずつ工事する。**
     フード・ガス管・シンク・排水。舗装（p2_pave）と同じ「床そのもの」＝
     上を歩けるし、上に物が置ける。厨房の機械は、ここに置いたぶんの床の上にしか置けない。

     ¥120万の「厨房」を買ったのに鍋が別売り、という気持ち悪さがこれで消える＝
     床が鍋を含んでいるとは誰も思わない。だからコンロも寸胴も炊飯器も、機械のまま残せる。

     広げるほど食堂の席が減る。**どこまでを厨房にするかが、そのまま売上の取引になる。**
     first:true ＝いちばん最初に要るものなので、値段の順に関係なくタブの先頭に出す         */
  /* cat は 'chubo'（＝据え付けのコンロと同じ）。'shoku' にすると
     **床を敷いただけの店が「食堂がある店」と数えられて**しまう          */
  /* ── 厨房（作者指定・作り直し）──────────────────────────
     **「厨房」は一個の物にする。** 1マスずつの工事も、コンロも寸胴も炊飯器も無くした。

     前の作りは「¥10万の床を何マスか買い、その上に器具を1つずつ置き、
     器具の組み合わせで作れる品が決まる」だった。手間のわりに画面には何も出ず、
     開業直後は**据え付けのコンロだけでは一品も作れない**という詰まり方までしていた。

     いまは **厨房を1つ置く → 金を払ってメニューを開発する** の2手だけ。
     何が作れるかは器具ではなく、**開発したかどうか**で決まる（MENU2 の dev）。

     4×2。奥の列が調理台で、**手前の列がカウンター**＝出来上がった皿はここに並ぶ。   */
  k2_kitchen:  { cat:'chubo', tab:'chubo', area:AR.SHOKUDO, name:'厨房', w:4,h:2, price:900000, q:3, run:1800, cap:0,
                 first:true,
                 desc:'コンロ・寸胴・炊飯器・冷蔵庫が一式。手前がカウンターで、出来た皿はここに並ぶ。何を出せるかは【メニュー】で開発する。' },
  k2_counter:  { cat:'shoku', tab:'shokudo', area:AR.SHOKUDO, name:'カウンター席', w:2,h:1, price:120000, q:2, run:0, cap:2,
                 desc:'2席。回転が速い。' },
  k2_table:    { cat:'shoku', tab:'shokudo', area:AR.SHOKUDO, name:'テーブル席', w:2,h:2, price:180000, q:3, run:0, cap:4,
                 desc:'4席。グループとカップルが座る。' },
  k2_beer:     { cat:'shoku', tab:'shokudo', area:AR.SHOKUDO, name:'生ビールサーバー', w:1,h:1, price:300000, q:3, run:600, cap:0, rep:20,
                 desc:'生ビールが出せるようになる。' },
  k2_bar:      { cat:'shoku', tab:'shokudo', area:AR.SHOKUDO, name:'立ち飲みカウンター', w:3,h:1, price:160000, q:3, run:0, cap:3,
                 desc:'3人ぶん。座らないぶん回転が速い。一人客が並ぶ。' },
  k2_zaseki:   { cat:'shoku', tab:'shokudo', area:AR.SHOKUDO, name:'座敷席',      w:3,h:2, price:260000, q:3, run:0, cap:6,
                 desc:'6席。グループが入る。長居もする。' },
  k2_terrace:  { cat:'shoku', tab:'shokudo', area:AR.SHOKUDO, name:'窓際のカウンター', w:3,h:1, price:200000, q:4, run:0, cap:3, rep:20,
                 desc:'外を見ながら食べる席。一人客がここを目当てに来る。' },
  k2_soft:     { cat:'shoku', tab:'shokudo', area:AR.SHOKUDO, name:'ソフトクリーム機', w:1,h:1, price:380000, q:3, run:800, cap:0, rep:15,
                 desc:'湯上がりに強い。子どもは来ないが、大人がよく食べる。' },
  k2_coffee:   { cat:'shoku', tab:'shokudo', area:AR.SHOKUDO, name:'コーヒーマシン', w:1,h:1, price:220000, q:3, run:400, cap:0,
                 desc:'食後の一杯。原価が低く、粗利がいい。' },
  k2_sara:     { cat:'shoku', tab:'shokudo', area:AR.SHOKUDO, name:'食器返却棚',   w:2,h:1, price:60000,  q:2, run:0, cap:0,
                 pas:{ sat:2, score:2 }, desc:'下げ膳が滞らない。無いとテーブルが空かない。' },

  /* ══ 残置物 ══════════════════════════════════════════════
     買った時点で最初から床に居座っているもの。カタログには並ばない（noShop）。
     開業準備で【撤去／売却／残す】を選ぶ相手（CHAPTER2.md §4-3）。

     ・撤去 … 金が出ていく。かわりに床が空く
     ・売却 … 金が入る。床も空く（値の付くものだけ）
     ・残す … 金は動かない。かわりに床を食い続ける（ものによっては悪さもする）

     ＝この章でいちばん最初の、そして一番テーマ的な選択。
       「残せば楽になる。でも残したら、この店を潰した店と同じになる」          */
  z2_ganban:  { cat:'rest', name:'岩盤浴の石床', w:3,h:3, price:0, q:1, run:800, cap:3, noShop:true,
                zanchi:{ cost:180000, sell:250000,
                         keep:'追加料金は取れる。ただし維持費が重く、サウナ2室ぶんの床を食う' },
                desc:'剥がすと金のかかる石床。前の店が最後に足したもの。' },
  z2_stage:   { cat:'rest', name:'大衆演劇のステージ', w:4,h:2, price:0, q:1, run:0, cap:2, noShop:true,
                zanchi:{ cost:150000, sell:0, keep:'座る場所にはなる。ただし床を大きく食う' },
                desc:'解体に金がかかるので置いていかれた。板はまだ鳴る。' },
  z2_enkai:   { cat:'rest', name:'大広間・宴会場', w:4,h:3, price:0, q:1, run:400, cap:4, noShop:true,
                pas:{ sat:-4, score:-6 },
                zanchi:{ cost:120000, sell:0,
                         keep:'宴会が受けられる＝町内会が来る。ただしサウナ客の満足度が下がる' },
                desc:'畳と座卓の跡。ここで何十年ぶんの宴会があった。' },
  z2_game:    { cat:'etc', name:'ゲームコーナーの跡', w:2,h:2, price:0, q:1, run:200, cap:0, noShop:true,
                zanchi:{ cost:30000, sell:0, keep:'筐体を入れれば学生が来る。ただし長居して回転が落ちる' },
                desc:'筐体は運び出された。配線と、床の焼けた跡だけが残っている。' },
  z2_furo:    { room:'bath', cat:'furo', name:'古い浴槽', w:3,h:2, price:0, q:1, run:700, cap:4, temp:40, noShop:true,
                zanchi:{ cost:50000, sell:30000, keep:'直せば使える。ただし質が低く、評判は伸びない' },
                desc:'タイルが浮いている。湯は張れる。' },
  z2_kagami:  { room:'datsui', cat:'datsui', name:'割れた大鏡', w:2,h:1, price:0, q:1, run:0, cap:0, noShop:true,
                zanchi:{ cost:30000, sell:10000, keep:'鏡は鏡。ただし割れたまま' },
                desc:'真ん中が縦に割れている。真鍮の枠は持っていかれた。' },

  /* ── ここから下は「置いていかれた最低限」（作者指定）──────────
     業者が引き上げそこねた、金にならない設備。**ボロいが、一応そろっている。**
     おかげで初日から店の形にはなる。ただしどれも質★1で、すぐ壊れ、評判は伸びない。

     **捨てると、その部屋が「利用不可」になる。** 引き算には、ちゃんと痛みがある  */
  z2_sauna:   { room:'bath', cat:'sauna', name:'古い電気サウナ', w:3,h:2, price:0, q:1, run:900, cap:6, temp:85, noShop:true,
                zanchi:{ cost:180000, sell:60000, keep:'一応サウナはある。ただしストーンが痩せていて、熱が薄い' },
                desc:'前の店のサウナ。ヒーターは生きているが、石はほとんど粉になっている。' },
  z2_mizu:    { room:'bath', cat:'mizu', name:'ヒビ割れた水風呂', w:2,h:1, price:0, q:1, run:250, cap:2, temp:22, noShop:true,
                zanchi:{ cost:90000, sell:20000, keep:'水風呂は水風呂。ただし22℃＝ぬるい' },
                desc:'底に細いヒビ。水は張れるが、チラーは死んでいる。' },
  z2_locker:  { room:'datsui', cat:'locker', tab:'datsui', name:'錆びたロッカー', w:2,h:1, price:0, q:1, run:0, cap:0, lock:8, noShop:true,
                zanchi:{ cost:40000, sell:10000, keep:'8人ぶん。ただし鍵が二つ壊れたまま' },
                desc:'扉の下が錆で膨らんでいる。閉まるものと、閉まらないものがある。' },
  z2_shoe:    { cat:'locker', tab:'lobby', area:AR.LOBBY, name:'古い下足箱', w:2,h:1, price:0, q:1, run:0, cap:0, lock:10, noShop:true,
                zanchi:{ cost:30000, sell:8000, keep:'10人ぶん。木札は半分無い' },
                desc:'木の下足箱。前の店の屋号が焼き印で残っている。' },
};
const ZANCHI_ORDER2 = ['z2_ganban', 'z2_stage', 'z2_enkai', 'z2_game', 'z2_furo', 'z2_kagami',
                       'z2_sauna', 'z2_mizu', 'z2_locker', 'z2_shoe'];
CONF2.zanchiOrder = ZANCHI_ORDER2;

/* ============ ゴミ・瓦礫 ============
   二年放ったらかしの箱を買ったので、館内はゴミと瓦礫だらけから始まる（作者指定）。
   1マスに1つ。**設備は置けないが、人は上を歩ける**（拾いに行けないと困る）。
   タップすると主人公がそこまで歩いて行って、担いで運び出す。金はかからない。
   かかるのは主人公の足だけ＝「金が無いから自分でやる」という第2章の入口。      */
const JUNK2 = {
  gareki: { name:'瓦礫の山',        note:'コンクリの塊。重い。' },
  wood:   { name:'折れた木材',      note:'解体した内装の名残。釘が出ている。' },
  tile:   { name:'割れたタイル',    note:'浴室から剥がれ落ちたもの。' },
  bag:    { name:'ゴミ袋の山',      note:'中身は聞かないほうがいい。' },
  box:    { name:'濡れた段ボール',  note:'雨漏りで潰れている。' },
  can:    { name:'空の一斗缶',      note:'塗料の缶。振ると乾いた音がする。' },
  chair:  { name:'壊れたパイプ椅子',note:'脚が折れている。宴会場のもの。' },
  pipe:   { name:'錆びた配管',      note:'抜き取られた配管の切れ端。' },
};
CONF2.junkKinds = JUNK2;

/* ============ 体力 ============
   第2章は主人公が自分の手で店を建てるので、**一日ぶんの手**を数える（作者指定）。
   第1章の「1晩に5つまで拭ける」「営業中は3つまで」という別々の上限を、これ1本に置き換える。
   金で人を雇えば体力は減らない＝**金と体力は交換できる**、というのがこの章の芯。
   第1章は CONF.stamMax を持たないので、従来どおりの数え方のまま動く。          */
CONF2.stamMax = 100;
CONF2.stamCost = {
  clean: 15,     // 汚れを1つ拭く（1日6つ＝第1章の5つより少しだけ多い）
  junk:  6,      // ゴミ・瓦礫を1つ運び出す（1日16個）
  roach: 10,     // ゴキブリを1匹仕留める
};
CONF2.openDays = 7;        // 「一週間後にオープン」＝開業までの猶予（作者指定）

/* ============ 開業の最低条件（作者指定）============
   1日目に各エリアを回らせて、やることを指示する。
   **最低限スタートできる状態を強制的に作らせる**＝これが揃うまで暖簾は出せない。

   第1章は1部屋しかなかったので「ロッカーと風呂」だけで足りた。
   第2章は5部屋あって、**見ていない部屋で何も起きていないことに気づけない。**
   だから部屋ごとに「ここに何が要るか」を名指しで出す。

   休憩スペースと食堂は必須にしない（無くても店は開く）＝
   **強制するのは、風呂屋が風呂屋であるための最低限だけ。**

     tab … 同じ cat でも置き場所で別物のとき（靴箱と脱衣ロッカーはどちらも locker）  */
CONF2.openReq = [
  { f: AR.LOBBY, need: [
    { cat: 'locker', tab: 'lobby', n: 1, label: '靴箱' },
  ] },
  { f: AR.OTOKO, need: [
    { cat: 'sauna',  n: 1, label: 'サウナ' },
    { cat: 'mizu',   n: 1, label: '水風呂' },
    { cat: 'furo',   n: 1, label: 'お風呂' },
    { cat: 'locker', tab: 'datsui', n: 1, label: 'ロッカー' },
  ] },
  { f: AR.ONNA, need: [
    { cat: 'sauna',  n: 1, label: 'サウナ' },
    { cat: 'mizu',   n: 1, label: '水風呂' },
    { cat: 'furo',   n: 1, label: 'お風呂' },
    { cat: 'locker', tab: 'datsui', n: 1, label: 'ロッカー' },
  ] },
];

/* ============ バイト（第2章）============
   給料は**スキルの合計だけ**で決まる（男女差なし・作者指定）。
   第2章は【料理】を足した4スキルなので、3スキルのままの幅（¥7,000〜¥10,000）だと
   合計12以上が全員上限に張り付く。第2章だけ幅を広げる。

     合計4（全部★1）… ¥7,000　　合計20（全部★5）… ¥13,000

   **万能な人間は高い。** 一部屋しか任せないのに全部★5を雇うのは損、という当たり前が効く */
CONF2.staffSkills = ['maji', 'spd', 'aiso', 'ryori'];
CONF2.staffSkillFloor = 8;
CONF2.staffWageMax = 14000;
CONF2.maxStaff = 6;              // 5部屋＋予備1（第1章は3人まで）

/* ── 部屋には人が要る（作者指定）────────────────────
   **スタッフのいない部屋は「利用不可」。客は入れない。**
   これで人を雇うことが「効率」ではなく「部屋を開けること」になる＝
   5部屋あることに、はじめて意味が出る。

     ・持ち場は1人1部屋。その部屋に立って、その部屋を掃除する
     ・女湯に立てるのは女性だけ（男性スタッフは入れない）
     ・遅刻中は**閉めない**（作者指定）。開いてはいるが無人＝汚れが溜まり、満足度が落ちる
     ・主人公の持ち場はロビー（番台で会計をするので動かせない）

   第1章は1部屋しかないので、この仕組みを持たない（CONF.staffRooms が無い）      */
CONF2.staffRooms = true;

/* ── 深夜営業（作者指定）──────────────────────────
   **主人公は21時で帰る。** 24時までは、ロビーに立つバイトが受付を回している。
   そこから先＝深夜0時を過ぎて開けるには、**深夜に立てる人間が要る。**

     ・`night:true` のバイトを1人以上雇っていないと、深夜営業は選べない
     ・深夜割増 25%（法定どおり）＝その人たちの日給に上乗せされる
     ・深夜料金 +¥500（0時以降の入館）
     ・深夜に来るのは、トラック運転手・仕事帰り・遠征サウナー

   **大手がやらない選択、というテーマにそのまま乗る。**
   湯匠（上場チェーン）は労務管理で深夜を切る。個人店だから開けられる      */
CONF2.nightOpen = { closeHour: 26, fee: 500, wageRate: 1.25 };

/* ============ 金の借り方は三層（作者指定）============
   第1章は「信用金庫に門前払い、あとはサラ金だけ」だった＝**借りられない苦しさ**。
   第2章は逆で、**借りられる苦しさ**。公庫から1,000万を引っぱれた男が主人公で、
   その返済が30日ごとに、客が0人でも来る。

     ① 公庫（日本政策金融公庫・宮下里佳）
        年2.0%・上限1,000万・**審査あり・申し込んでから2週間**
        安い。だが**明日の金にはならない。**
     ② 灰田ファイナンス（サラ金）
        年20%・上限100万・**審査なし・即日**
        高い。だが**今日の金になる。**
     ③ 自己資金
        もう無い。

   釜が壊れた翌朝に要るのは①ではなく②だ、という形にしてある。
   そして②に手を出したことは、①の審査に響く（宮下は通帳を見る）。      */
CONF2.kouko = {
  apr: 0.02,            // 年2.0%
  waitDays: 14,         // 申し込んでから振り込まれるまで
  unit: 1000000,        // 100万円きざみ
  needDays: 30,         // 開業から30日は実績を見てから
  noSarakin: true,      // サラ金に手を出していると通らない（宮下は通帳を見る）

  /* ── 枠は「実績」で上がる（作者指定の考え方）─────────────────
     返した分を借り直せるだけでは、追加融資とは言わない
     （30日で元本¥120,000しか減らないので、1年払っても144万しか空かない）。

     **宮下は数字を見て、枠そのものを上げてくる。**
     評判と、直近10日の黒字の数。この2つだけ。感情は最後まで出さない。

       開業直後                    ¥10,000,000 ＝ もう使い切っている
       評判25＋黒字5日   → ＋500万  ¥15,000,000
       評判50＋黒字7日   → ＋500万  ¥20,000,000
       評判70＋黒字9日   → ＋1,000万 ¥30,000,000（＝2号店が見えてくる額）  */
  tiers: [
    { rep: 0,  profit: 0, max: 10000000 },
    { rep: 25, profit: 5, max: 15000000 },
    { rep: 50, profit: 7, max: 20000000 },
    { rep: 70, profit: 9, max: 30000000 },
  ],
};
/* 事業ローンの返済（CONF2.bills の 'loan'）で、毎回いくら元本が減るか。
   1,000万・年2.0%・7年（84回）の元利均等なら、初回の元本はおよそこのくらい */
CONF2.loanPrincipal = 120000;

/* 会計待ちの列は**館内**に作る。番台が奥にあるので、第1章のように
   入口の外へ並ばせると、ひとり会計するたびに次の人が館内を縦断してくる＝行列が捌けない */
CONF2.queueInside = true;
CONF2.playerArea = AR.LOBBY;     // 主人公の持ち場＝番台のある部屋
// CONF2.initRoster は INIT_ROSTER2 を定義したあとで入れる（この下のほう）
CONF2.noStaffDirt = 2.2;         // 無人の部屋で汚れが溜まる速さ（倍）
CONF2.noStaffSat = 8;            // 無人の部屋を使った客の満足度（減点）

/* 昼と夜の演出（駐車場が暗くなる・外灯が点く・富士山の空に月）。
   第1章は屋外が無いので、この目印を持たない＝演出は一度も走らない */
CONF2.dayNight = true;
/* 浴室の上壁は富士山だけにする（屋号の看板は番台の脇へ移した・作者指定）。
   第1章はこの目印を持たないので、看板＋富士山のいつもの絵のまま */
CONF2.fujiWide = true;

/* ============ 10日ごとに来る、重い出費（作者指定）============
   1つ1つは30日周期。それを10日ずつずらしてあるので、
   **主人公の体感は「10日ごとに殴られる」**。30日ぶんの合計は ¥563,000 で、
   事業ローンを毎日 ¥5,500 引いていた頃と同額＝重さは変えず、リズムだけ変えた。

   毎日の収支は軽く見える（日々の −¥5,500 が消えた）。そして忘れた頃に来る。
   **油断させてから殴る**のがこの周期の狙い＝現金を寝かせておく理由になる。

   ここは店の損益ではない（元金の返済も生活費も経費ではない）ので、
   日報の収支には入れず、日報の下に別枠で出す（week2.js の dayReportExtra）。

   開業初日にいきなり殴らないよう、10日目から始める。
   軽い（住宅ローン）→重い（生活費）→中くらい（事業ローン）の順に来るので、
   毎回おなじ重さではない＝どれが来る番かを覚える意味がある。

     day   … 開業から何日目に、最初に来るか
     every … 周期（日）                                              */
CONF2.bills = [
  { key: 'home',   day: 10, every: 30, amount:  98000, icon: '🏠',
    name: '住宅ローン', note: 'あと34年' },
  { key: 'living', day: 20, every: 30, amount: 300000, icon: '🍚',
    name: '生活費',     note: '千夏と二人ぶん' },
  { key: 'loan',   day: 30, every: 30, amount: 165000, icon: '🏦',
    name: '事業ローン', note: '公庫・年2.0%・7年' },
];

/* ============================================================
   【いまはオフ】体力システムと、家のシステム（作者指定）
   ------------------------------------------------------------
   消してはいない。復活させるかもしれないので、この2行を true に戻すだけで、
   体力バー・体力の消費・店↔家の行き来・千夏の機嫌が、そのまま元に戻る。

     staminaOn … 体力（汚れ15／ゴミ6／ゴキブリ10・寝ると全快）
     homeOn    … 家（ベッド・台所・食卓・千夏／【🏠 家へ】の帯ボタン）
   ============================================================ */
CONF2.staminaOn = false;
CONF2.homeOn = false;

/* 主人公が店にいる時間（作者指定）。9:00に来て、21:00に帰る。
   それ以外の時間は店にいない＝家にいることになっている。
   第1章はこの設定を持たないので、従来どおり一日じゅう店にいる           */
CONF2.workHours = [9, 21];
// 家をオフにしている間は、区画そのものを外す＝間違って迷い込む道が1本も残らない
if (!CONF2.homeOn) CONF2.areas = AREAS2.filter(a => !a.home);

/* ============ 家の中 ============
   タップできる場所。設備（EQ）ではないので売り買いはしない＝間取りは固定。
   金をかけて広げる話は後回し（作者指定でまず1画面）                    */
CONF2.homeSpots = [
  { key: 'bed',   name: 'ベッド', x: 1, y: 1, w: 3, h: 3, act: '💤 寝る',
    note: '8時間眠る。朝、店に戻る' },
  { key: 'kit',   name: '台所',   x: 7, y: 1, w: 3, h: 2, act: '🍳 飯を作る',
    note: '1時間。体力を10使うが、千夏は喜ぶ' },
  { key: 'table', name: '食卓',   x: 4, y: 5, w: 3, h: 2, act: '📋 家計を見る',
    note: '住宅ローンと生活費、千夏の機嫌' },
];
CONF2.chinatsuSpot = { x: 8, y: 5 };     // 千夏の立ち位置（タップで話す）

/* 開店前のゴミの散らばり方。部屋ごとに「ここは何の跡か」が分かる撒き方にする */
const INIT_JUNK2 = [
  // ロビー＝雨漏りと、運び出しかけて放置されたもの
  ['box', 2, 2, AR.LOBBY], ['bag', 8, 2, AR.LOBBY], ['gareki', 10, 3, AR.LOBBY],
  ['can', 11, 2, AR.LOBBY],
  // 駐車場＝不法投棄されたもの
  ['bag', 2, 6, AR.LOBBY], ['tile', 5, 8, AR.LOBBY], ['gareki', 9, 6, AR.LOBBY],
  ['wood', 11, 9, AR.LOBBY], ['can', 3, 9, AR.LOBBY],
  // 休憩スペース＝岩盤浴とステージの解体跡
  ['gareki', 6, 5, AR.KYUKEI], ['wood', 9, 3, AR.KYUKEI], ['tile', 2, 7, AR.KYUKEI],
  ['box', 11, 6, AR.KYUKEI], ['chair', 4, 8, AR.KYUKEI], ['bag', 8, 8, AR.KYUKEI],
  // 食堂＝宴会場の椅子と、厨房から出たゴミ
  ['chair', 7, 6, AR.SHOKUDO], ['chair', 10, 7, AR.SHOKUDO], ['bag', 2, 8, AR.SHOKUDO],
  ['box', 5, 9, AR.SHOKUDO], ['can', 11, 4, AR.SHOKUDO], ['wood', 4, 5, AR.SHOKUDO],
  // 男湯＝剥がれたタイルと抜かれた配管
  ['tile', 3, 8, AR.OTOKO], ['tile', 5, 5, AR.OTOKO], ['pipe', 10, 9, AR.OTOKO],
  ['gareki', 6, 6, AR.OTOKO], ['wood', 11, 5, AR.OTOKO], ['box', 5, 12, AR.OTOKO],
  ['bag', 2, 2, AR.OTOKO],
  // 女湯＝同じ荒れ方
  ['tile', 3, 8, AR.ONNA], ['tile', 9, 6, AR.ONNA], ['pipe', 5, 9, AR.ONNA],
  ['gareki', 7, 5, AR.ONNA], ['wood', 2, 6, AR.ONNA], ['box', 10, 12, AR.ONNA],
  ['bag', 11, 2, AR.ONNA],
];
CONF2.initJunk = INIT_JUNK2;

/* カタログの一行説明（名前の下の小さい黄色い文字。全角14〜16文字まで） */
const EQ_NOTE2 = {
  f2_ticket:'受付の行列がまるごと消える', f2_shoe:'足りないと入館待ちの列', f2_goods:'サウナハットは売れる',
  f2_vend:'オロポで喉が鳴る', f2_sofa:'混む時間の受け皿',
  p2_pave:'砂利は雨の日に泥はねする', p2_slot:'白線1組で3台停まる', p2_big:'大型3台。トラックが停まれる',
  p2_light:'暗い駐車場に女性は来ない', p2_kanban:'走る車から見える入口',
  p2_ev:'無いと電気自動車は来ない', p2_bicycle:'年寄りは自転車で来る',
  p2_yusetsu:'雪でも客足が落ちない', p2_camera:'起きてからでは遅い',
  s2_maki:'まずはこの一台から。火の番が要る', s2_mushi:'高野槙の樽にひとり。薬草9種',
  s2_finland:'木と石と柄杓だけの本式', s2_oto:'真っ赤な照明と重低音。攻めの一室',
  s2_steam:'45℃の蒸気に女性が居着く',
  b2_totonoi:'これが無いと整う前に出て行く', b2_infinity:'座った客が必ず話題にする',
  b2_bench:'風の通る場所に2人ぶん',
  b2_denki:'年配の常連が順番待ちをする', d2_shave:'男湯だけ。出勤前に寄る',
  sv2_yomogi:'女性専用の個室。ひとり¥3,500', d2_dresser:'女湯だけ。ここが弱いと二度と来ない',
  s2_kobeya:'一人になりたい客の指定席', s2_main:'15分ごとに天井から', s2_big:'喋れる部屋は貴重',
  s2_hot:'100℃・無音・赤い照明', s2_kero:'自分で水をかけられる唯一',
  m2_tank:'18℃。湯匠と同じ温度', m2_cold:'13℃。誰でも気持ちいい', m2_single:'9℃。遠征が始まる',
  m2_plunge:'17℃に寝そべる贅沢', m2_soda:'37℃。前にも後にも効く',
  b2_nuru:'38℃。長湯派が根を張る', b2_hot:'背中に効くと噂が立つ', b2_roten:'空の下で湯に浸かる',
  w2_kakeyu:'ここから始まる作法', w2_shower:'サッと流して回転が上がる', w2_bank:'5人ぶん並ぶ働き者',
  sv2_akasuri:'ひとり¥3,000の腕仕事',
  r2_gaiki:'風が通ると跳ねる', r2_hammock:'揺れながら意識が飛ぶ', r2_aroma:'香りで格が上がる', r2_cooler:'無いと満足が伸びない',
  d2_locker:'12人ぶん・省スペース', d2_sink:'ここで人並みになる', d2_toilet:'綺麗な便所は信用される',
  d2_powder:'女湯にこれが無いと詰む',
  x2_bench:'とりあえず座れる', x2_goro:'床に転がる幸せ',
  x2_beads:'沈む。立てなくなる', x2_sofa2:'並んで座れる。連れが長居する',
  x2_nap:'黒革。ここで寝てしまう',
  x2_work:'湯匠が絶対に置けない席', x2_yomi:'一人の時間が買える',
  x2_massage:'¥100で極楽。売上にも',
  k2_kitchen:'これ一つで食堂が回る', k2_counter:'2席。回転が速い', k2_table:'4席。長っ尻の元',
  k2_beer:'湯上がりの一杯が出せる',
  f2_kasa:'雨の日の傘を入口で預かる', f2_maruta:'木の匂いが待合に残る', f2_water:'入る前の一杯が効く',
  f2_hat:'自分のハットを掛けて帰る', f2_ice:'湯上がりはほぼ全員が買う', f2_board:'次に来る理由をここに書く',
  f2_coin:'遠征客は財布が気になる', f2_massage:'待ち時間が売上に変わる',
  p2_nobori:'安い。数を立てるほど効く', p2_gate:'入口が分かる＝通り過ぎない', p2_bike:'ツーリング帰りが寄る',
  p2_tree:'荒れ地に見えなくなる', p2_smoke:'外に出せば館内が匂わない',
  x2_hammock2:'雨でもととのいが続く', x2_tatami:'靴を脱いで寝転がれる',
  x2_manga:'サウナと旅の本だけ', x2_manga2:'続きが気になって帰らない',
  x2_tv:'音は出さない。字幕だけ', x2_aroma:'入った瞬間の匂いが変わる',
  x2_plant:'一本で「休むところ」になる', x2_locker2:'挿している間は帰れない',
  k2_bar:'座らないぶん回転が速い', k2_zaseki:'6席。グループが入る', k2_terrace:'一人客がここを目当てに来る',
  k2_soft:'湯上がりに強い', k2_coffee:'原価が低く粗利がいい', 
  k2_sara:'無いとテーブルが空かない',
};

/* カタログのタブ */
const CATS2 = [
  ['sauna','サウナ'], ['mizu','水風呂'], ['furo','風呂'], ['wash','洗い場'],
  ['gaiki','ととのい'], ['datsui','脱衣所'],
  /* 休憩スペースは1本のリストだと17品が縦にだらだら並ぶので、
     **何をしに来た客のためのものか**で4枚に割る（作者指定） */
  ['ne','寝る'], ['suwaru','座る'], ['sugosu','過ごす'], ['shitsurae','設え'],
  ['chubo','厨房'], ['menu','メニュー'], ['shokudo','食堂'],
  ['lobby','ロビー'], ['park','駐車場'],
];

/* 旧IDの読み替え（第2章はまだ無い） */
const ID_ALIAS2 = {};

/* ============ 初期配置 ============
   金目のもの（ゲーム機・漫画・什器）は、閉店時に業者が全部持っていった。
   残っているのは「動かせない・金にならない」ものだけ。

   ── ボロいが、一応そろっている（作者指定）──────────────────
   **各部屋に、最低限スタートできるだけの設備が最初から入っている。**
   ただしどれも前の店の置き土産＝質★1、傷みだらけ、評判はまるで伸びない。
   買い直すか、直して使うか、売って金にするかは、遊びながら決めればいい。

   これで開業初日から店の形にはなる。**ゼロから積む章ではなく、
   ボロい箱を作り替えていく章**になる（第1章の夕凪湯と同じ入り方）。          */
const INIT_EQUIP2 = [
  // ロビー＝番台と、屋号の焼き印が残った下足箱
  { id:'bandai',    x:5, y:1,  f:AR.LOBBY,   cond:100 },
  { id:'z2_shoe',   x:9, y:2,  f:AR.LOBBY,   cond:30 },
  /* 休憩スペースと食堂は、**がらんどうで始める**（作者指定）。
     ステージ・宴会場・ゲームコーナーは、閉店のときに業者が持っていった扱いにして外した。

     ただし**岩盤浴の石床だけは置いたまま。** ここは桑田の二つ目の注文
     （「あの石床、剥がすんじゃねえだろうな」＝婆さんと並んで寝た床）の的で、
     盤面から消すと、注文が出たその瞬間に「もう手遅れだ」で失敗が確定する。
     石床も消すなら、注文のほうを別のものに書き換えることになる（mission2.js）   */
  { id:'z2_ganban', x:2, y:2,  f:AR.KYUKEI,  cond:60 },
  /* 食堂もがらんどう。厨房も据え付けのコンロも置いていない＝
     ¥90万の【厨房】を1つ買うところから始まる（作者指定）        */
  { id:'z2_sauna',  x:1, y:5,  f:AR.OTOKO,   cond:30 },
  { id:'z2_mizu',   x:5, y:5,  f:AR.OTOKO,   cond:25 },
  { id:'z2_furo',   x:8, y:7,  f:AR.OTOKO,   cond:35 },
  { id:'z2_locker', x:8, y:12, f:AR.OTOKO,   cond:25 },
  { id:'z2_kagami', x:2, y:12, f:AR.OTOKO,   cond:20 },
  { id:'z2_sauna',  x:1, y:5,  f:AR.ONNA,    cond:30 },
  { id:'z2_mizu',   x:5, y:5,  f:AR.ONNA,    cond:25 },
  { id:'z2_furo',   x:8, y:7,  f:AR.ONNA,    cond:35 },
  { id:'z2_locker', x:8, y:12, f:AR.ONNA,    cond:25 },
  { id:'z2_kagami', x:2, y:12, f:AR.ONNA,    cond:20 },
];

/* ============ 最初からいる5人（作者指定）============
   「主人公が事前に求人広告を出して、集めました」という体で、
   開業前から各部屋に1人ずつ立っている。**全員スキル低め**＝日給は下限に近い。

   女湯には女性しか立てないので、ここは必ず女性。
   ロビーは主人公が番台に立つが、**そこにもう一人**（作者指定）＝
   掃除と客あしらいをしながら、主人公が離れている間は番台に入って会計をする。
   券売機の使い方が分からない年配客の相手も、この人の仕事。

   この5人でも店は回る。ただし回るだけだ。
   ・料理★2の若者が厨房に立っている＝ときどき「マズい」が出る
   ・掃除の速い人間がひとりもいない＝濃い汚れが残りはじめる
   ・**深夜に立てる人間がひとりもいない**＝深夜営業はできない
   **入れ替えたくなったときが、求人を開くときになる。**                     */
const INIT_ROSTER2 = [
  { pid:'ini_lobby', name:'受付のおばちゃん',   sex:'f', maji:4, spd:2, aiso:3, ryori:2, f:AR.LOBBY,
    desc:'前の店の常連だった。券売機は自分もよく分かっていない' },
  { pid:'ini_otoko', name:'無愛想な兄ちゃん',   sex:'m', maji:2, spd:3, aiso:1, ryori:1, f:AR.OTOKO,
    desc:'口はきかないが、来いと言えば来る。前の職場は工場' },
  { pid:'ini_onna',  name:'近所のパートさん',   sex:'f', maji:3, spd:2, aiso:3, ryori:2, f:AR.ONNA,
    desc:'子どもが学校にいる間だけ。女湯を任せられる、ただ一人' },
  { pid:'ini_kyukei',name:'元警備員のおじさん', sex:'m', maji:3, spd:1, aiso:2, ryori:1, f:AR.KYUKEI,
    desc:'定年まで夜勤だった。座っていても、目は動いている' },
  /* 食堂はこの1人から始まる＝**調理もホールも掃除も、この若者が一人でやる。**
     調理★2なので出すのは遅い。求人で調理スタッフを雇うか、ホールを足すかで、
     食堂の売上がはっきり変わる（作者指定）                                   */
  { pid:'ini_chubo', name:'料理未経験の若者',   sex:'m', maji:2, spd:2, aiso:2, ryori:2, f:AR.SHOKUDO, job:'cook',
    desc:'厨房に立たされている。レシピは見ながら作る' },
];
CONF2.initRoster = INIT_ROSTER2;

/* ============ 客 ============
   ── 熱さの好み（作者指定）─────────────────────────────
   男湯と女湯には同じ設備を置けるが、**来る客の好みが違う**。

     saunaPref  … いちばん気持ちいいと感じるサウナの温度
     saunaMax   … 熱さの限界。ここを超えると、好みの幅とは別にはっきり嫌がる
     gentleLove … 蒸し系（スチーム・ミスト・薬草）をどれだけ好むか

   女性客は 85℃あたりが限界で、55℃のスチームサウナが本命。
   男性客は 100℃前後を好み、蒸し系にはあまり価値を感じない。
   ＝100℃のドライサウナを女湯にも並べても、女湯は埋まらない。          */
const TYPES2 = {
  /* w＝来店の重み ／ wSauna＝サウナがある時の上乗せ（game.js の custWeight が読む） */
  ensei:     { name:'遠征サウナー',        sex:'m', hair:'#8a5a2f', cloth:'#2e6b4f', w:6,  wSauna:22,
               likesSauna:1.0, tolerant:-6, milk:0.4, furoPref:42, coldLove:1.0, saunaPref:100, saunaMax:115, gentleLove:2,
               wantLoyly:'self', wantLight:'wood', wantBgm:'none', extBase:0.55 },
  salary2:   { name:'仕事帰りのサラリーマン', sex:'m', hair:'#3a3a3a', cloth:'#4a5568', w:18, wSauna:14,
               likesSauna:0.9, tolerant:0, milk:0.5, furoPref:42, coldLove:0.8, saunaPref:100, saunaMax:115, gentleLove:2,
               wantLoyly:'auto', wantLight:'red', wantBgm:'none', extBase:0.35 },
  ol2:       { name:'仕事帰りのOL',        sex:'f', hair:'#4a3728', cloth:'#e2b04a', w:16, wSauna:10,
               likesSauna:0.7, tolerant:-6, milk:0.4, furoPref:40, coldLove:0.4, saunaPref:70, saunaMax:85, gentleLove:10,
               wantLoyly:'none', wantLight:'green', wantBgm:'ambient', extBase:0.30 },
  couple_m:  { name:'カップル（彼）',      sex:'m', hair:'#3b3128', cloth:'#7f9a6a', w:10, wSauna:6,
               likesSauna:0.7, tolerant:2, milk:0.6, furoPref:41, coldLove:0.5, saunaPref:95, saunaMax:110, gentleLove:3,
               wantBgm:'talk', wantStyle:'nesauna', extBase:0.45, pair:'couple_f' },
  couple_f:  { name:'カップル（彼女）',    sex:'f', hair:'#5a3a2a', cloth:'#d88aa0', w:0,  wSauna:0,
               likesSauna:0.6, tolerant:2, milk:0.6, furoPref:39, coldLove:0.3, saunaPref:75, saunaMax:85, gentleLove:9,
               wantBgm:'talk', wantStyle:'nesauna', extBase:0.45 },
  hitori:    { name:'一人になりたい客',    sex:'m', hair:'#2f2a26', cloth:'#5a5a66', w:9,  wSauna:8,
               likesSauna:0.8, tolerant:4, milk:0.3, furoPref:41, coldLove:0.6, saunaPref:95, saunaMax:110, gentleLove:3,
               wantStyle:'kobeya', wantBgm:'none', extBase:0.50 },
  mama:      { name:'ママ友',              sex:'f', hair:'#6a4a3a', cloth:'#c77bb0', w:12, wSauna:4,
               likesSauna:0.4, tolerant:3, milk:0.5, furoPref:39, coldLove:0.1, saunaPref:55, saunaMax:75, gentleLove:13,
               wantStyle:'steam', wantLight:'green', extBase:0.40 },
  driver:    { name:'トラック運転手',      sex:'m', hair:'#4a4038', cloth:'#6a5a4a', w:8,  wSauna:8,
               likesSauna:0.6, tolerant:8, milk:0.7, furoPref:43, coldLove:0.5, saunaPref:100, saunaMax:115, gentleLove:2,
               needs:'driver', extBase:0.35 },
  gakusei:   { name:'大学生グループ',      sex:'m', hair:'#2f2822', cloth:'#e2743f', w:10, wSauna:6,
               likesSauna:0.5, tolerant:6, milk:0.8, furoPref:40, coldLove:0.4, saunaPref:95, saunaMax:110, gentleLove:3,
               wantBgm:'talk', extBase:0.30, messy:1.6 },
  senior:    { name:'地元の年配夫婦',      sex:'m', hair:'#d8d8d8', cloth:'#7a8a6f', w:11, wSauna:2,
               likesSauna:0.2, tolerant:8, milk:0.7, furoPref:42, furoVar:4, coldLove:0.1, saunaPref:80, saunaMax:95, gentleLove:8,
               needs:'senior', extBase:0.20 },
  evcar:     { name:'EVで来た客',          sex:'m', hair:'#3a3a4a', cloth:'#4a7a8a', w:5,  wSauna:6,
               likesSauna:0.8, tolerant:0, milk:0.4, furoPref:41, coldLove:0.7, saunaPref:98, saunaMax:112, gentleLove:3,
               needs:'ev', extBase:0.45 },
  tuber:     { name:'サウナ系配信者',      sex:'m', hair:'#7a5a3a', cloth:'#3a6ea8', w:0,  wSauna:0,
               likesSauna:1.0, tolerant:-8, milk:0.3, furoPref:42, coldLove:1.0, saunaPref:105, saunaMax:120, gentleLove:2,
               wantLoyly:'self', wantBgm:'bass', extBase:0.60 },
};

/* ============ 食堂のメニュー ============ */
/* ============ メニュー ============
   厨房に何を入れたかで、出せる品が決まる（作者指定）。
   needs ＝ この品を作るのに要る厨房設備（全部そろって、壊れていないこと）。
   likes ＝ この品を目当てにする客。出していないと「食べたいものが無い」と不満になる。
   枠   ＝ 一度に出せる品数。基本3枠＋冷蔵庫で+1＋冷凍庫で+1（仕込みが置けるぶん）。   */
/* ============ お品書き ============
   **金を払って「開発」すると、その品が出せるようになる**（作者指定）。
   厨房に入れた器具の組み合わせで解放する作りはやめた＝
   何が作れるかは、器具ではなく**開発したかどうか**で決まる。

     dev   … 開発費（一度きり）。試作・仕入れ先の開拓・レシピを決めるまでの金
     price … 客に出す値段　　cost … 一皿の原価
     likes … この品を目当てにする客の種類

   開発した品は、そのままお品書きに載る（出す・出さないの切り替えは無い）。
   ただし**厨房と、厨房に立つ人が要る**＝どちらが欠けても一品も出せない。   */
const MENU2 = [
  { id:'oropo',   name:'オロポ',                  dev:80000,  price:500,  cost:120,
    note:'ポカリで割るだけ。いちばん安く始められる',  likes:['ensei','salary2','hitori'] },
  { id:'coffee',  name:'コーヒー',                dev:120000, price:350,  cost:70,
    note:'原価がいちばん低い。長居も呼ぶ',            likes:['senior','hitori','ol2'] },
  { id:'edamame', name:'枝豆と冷やしトマト',      dev:150000, price:450,  cost:130,
    note:'凍らせておいて、出すだけ',                  likes:['salary2','senior','mama'] },
  { id:'beer',    name:'生ビール',                dev:260000, price:600,  cost:180,
    note:'湯上がりの一杯。サーバーの契約が要る',      likes:['salary2','gakusei','senior'] },
  { id:'soft',    name:'ソフトクリーム',          dev:280000, price:400,  cost:110,
    note:'食後でも入る。粗利がいい',                  likes:['ol2','couple_f','mama'] },
  { id:'ramen',   name:'醤油ラーメン',            dev:320000, price:850,  cost:260,
    note:'締めに強い。スープを決めるまでが長い',      likes:['driver','gakusei','salary2'] },
  { id:'curry',   name:'サウナ飯カレー',          dev:350000, price:900,  cost:280,
    note:'仕込んで置ける＝回転が上がる',              likes:['ensei','salary2','gakusei'] },
  { id:'yakisoba',name:'鉄板焼きそば',            dev:360000, price:800,  cost:250,
    note:'音と匂いで、通りかかった客が座る',          likes:['gakusei','couple_m','driver'] },
  { id:'washoku', name:'朝の和定食',              dev:420000, price:900,  cost:350,
    note:'朝まで居た客に出す。手はかかる',            likes:['senior','driver','hitori'] },
  { id:'karaage', name:'唐揚げ定食',              dev:450000, price:1100, cost:400,
    note:'揚げ物＋飯。腹を空かせた客の本命',          likes:['gakusei','driver','salary2'] },
  { id:'keema',   name:'キーマカレー（灯レシピ）', dev:600000, price:1300, cost:420, akari:true,
    note:'灯が来てから。この店の名物になる',          likes:['ol2','ensei','couple_f'] },
  { id:'ahijo',   name:'アヒージョとハイボール',   dev:650000, price:1400, cost:450, akari:true,
    note:'灯が来てから。夜の食堂が変わる',            likes:['couple_m','couple_f','ol2'] },
];
/* game.js からは CONF 越しに見る（applyChapter が配るのは決まった名前だけなので） */
CONF2.menu = MENU2;

/* ============ 客の姿勢（作者指定）============
   「椅子には座るし、リクライナーでは横になるし、本棚では本をパラパラする」。
   どの格好になるかは**設備の側**に書く＝設備を1つ足したら pose を1語書くだけで芝居が付く。

     sit  … 腰を落として座る（席・小上がり・机）
     sink … さらに深く沈む（ビーズクッション）
     lie  … 横になる。目を閉じて寝息が上がる（リクライナー・マット・ハンモック・岩盤浴）
     read … 浅く腰かけて、開いた本のページをめくる（本棚・読書灯）

   第1章の設備（EQ）には一切書かないので、第1章の客はこれまでどおり立ち姿のまま。   */
const POSE2 = {
  // 横になる
  lie:    ['x2_nap', 'x2_goro', 'x2_hammock2',
           'b2_infinity', 'b2_totonoi', 'r2_hammock', 'r2_gaiki', 'sv2_akasuri'],
  ganban: ['z2_ganban'],                       // 横になる＋岩から湯気
  sink:   ['x2_beads'],                        // 沈む
  read:   ['x2_manga', 'x2_manga2', 'x2_yomi'],// 本をめくる
  eat:    ['k2_counter', 'k2_table', 'k2_zaseki', 'k2_terrace', 'k2_bar', 'z2_enkai'],
  work:   ['x2_work'],                         // ノートPCを打つ
  tv:     ['x2_tv'],                           // 画面の明かりが顔に映る
  stage:  ['z2_stage'],                        // 舞台の明かり
  yomogi: ['sv2_yomogi'],                      // 足もとから湯気
  massage:['x2_massage', 'f2_massage'],        // 揺れて、目を閉じる
  shave:  ['d2_shave'],                        // ひげを剃る
  dress:  ['d2_dresser'],                      // 髪を整える
  phone:  ['x2_locker2'],                      // 充電しながらスマホ
  buy:    ['f2_goods', 'f2_vend', 'f2_ice'],   // 小銭を出して買う
  smoke:  ['p2_smoke'],                        // 一服
  shower: ['r2_aroma'],                        // アロマミストを浴びる
};
/* 浴室の設備（サウナ・風呂・水風呂・洗い場）には pose を付けない＝
   汗・湯に浸かる頭・洗髪の泡という**専用の芝居が game.js にもとから在る**。
   ここで座らせると、湯船の中で正座している絵になってしまう              */
POSE2.sit  = ['f2_maruta'];                    // 待合の丸太ベンチ
POSE2.phone= (POSE2.phone || []).concat('p2_ev');  // EV充電の待ち時間はスマホを見ている
for (const pose of Object.keys(POSE2))
  for (const id of POSE2[pose]) if (EQ2[id]) EQ2[id].pose = pose;
/* 立ち飲みカウンターだけは「座らないぶん回転が速い」のが売りなので、立ったまま食べさせる */
if (EQ2.k2_bar) EQ2.k2_bar.pose = 'eatStand';
const POSE_STAND2 = [];
/* 残りは「席のあるもの＝座って使うもの」を、まとめて座らせる。
   休憩スペースの椅子も、食堂の席も、立ったまま使う道理がない            */
for (const id of Object.keys(EQ2)) {
  const d = EQ2[id];
  if (POSE_STAND2.includes(id)) continue;
  if (!d.pose && d.cap > 0 && (d.cat === 'rest' || d.cat === 'shoku')) d.pose = 'sit';
}
/* 出す品数に上限は無い（作者指定）。作れるものは、作れるだけ出していい。
   冷蔵庫・冷凍庫は「枠を増やすもの」ではなく、
   それが無いと作れない品（朝の和定食・枝豆・灯レシピ）の条件として効く   */

/* ============ バイト（第2章の人材プール） ============
   第2章は女湯に主人公が入れない＝女性のバイトがいないと女湯が回らない。
   sex を持たせているのはそのため                                        */
/* ============ バイト（第2章）============
   第1章は3つのスキル（真面目・スピード・愛想）だった。第2章は**料理**を足して4つ（作者指定）。

   ── 性別は職種ではなく属性（作者指定）──
   求人の枠を「男スタッフ／女スタッフ」に分けると、
   「暇な大学生」「ギャル」「無口な職人肌」という**個人が来る**手触りが消える。
   だから10人はそのまま。性別が決めるのは**入れる部屋だけ**。

     女性 … 全部の部屋に入れる（現実の温浴施設でも、女性スタッフは男湯を掃除する）
     男性 … 女湯には入れない

   給料に男女差はつけない（作者指定）。**スキルの合計だけで決まる**（staffWageOf）。

   ── 料理（ryori）──
   厨房に立たせた人の★で、提供の速さと味が変わる。★1を置くと「マズい」が出る。
   料理人という職種は作らない＝**誰でも厨房に立てる。立たせた人の腕が出るだけ。**   */
const STAFF_POOL2 = [
  { pid:'moto_yulagi', name:'元ゆらぎの従業員', sex:'f', maji:5, spd:3, aiso:4, ryori:3, desc:'前の店で15年。ここの配管を全部知っている' },
  { pid:'gakusei2',    name:'近所の大学生',     sex:'m', maji:2, spd:4, aiso:3, ryori:1, desc:'車で20分かけて通ってくる' },
  { pid:'shufu2',      name:'主婦',             sex:'f', maji:5, spd:3, aiso:4, ryori:5, desc:'家事20年のプロ。汚れは見逃さないし、飯もうまい' },
  { pid:'nekkyo',      name:'熱波師見習い',     sex:'m', maji:3, spd:5, aiso:5, ryori:1, desc:'タオルを回したくて来た。掃除も料理も二の次' },
  { pid:'teinen2',     name:'定年後のおじさん', sex:'m', maji:5, spd:1, aiso:3, ryori:2, desc:'動きはゆっくり。だが決して休まない' },
  { pid:'gal2',        name:'ギャル',           sex:'f', maji:1, spd:3, aiso:5, ryori:2, desc:'遅刻はする。でも客はなぜか上機嫌' },
  { pid:'shokunin2',   name:'無口な職人肌',     sex:'m', maji:5, spd:4, aiso:1, ryori:2, desc:'口より先に手が動く' },
  /* ── 調理スタッフ（作者指定・求人で雇う）──────────────────
     食堂の厨房に入れる人。**料理★が、出す速さと皿の出来に直に効く。**
     ★1は★5の3倍の時間がかかり、皿の出来も落ちる＝給料の差がそのまま行列の差になる */
  { pid:'cook_teishoku', name:'定食屋の親父',   sex:'m', maji:4, spd:3, aiso:2, ryori:4,
    desc:'畳んだ定食屋の主人。二十年、同じ味を出し続けた手が残っている' },
  { pid:'cook_ramen',   name:'ラーメン屋の元店主', sex:'m', maji:3, spd:4, aiso:2, ryori:4,
    desc:'とにかく速い。丼を出すまでの動きに無駄が一つも無い' },
  { pid:'cook_hotel',   name:'ホテルの元調理人', sex:'f', maji:5, spd:3, aiso:4, ryori:5,
    desc:'宴会場を仕切っていた腕。給料は高いが、出す皿の格が変わる' },
  { pid:'cook_part',    name:'調理補助のパート', sex:'f', maji:3, spd:2, aiso:3, ryori:2,
    desc:'家庭料理の範囲。安く雇えて、二人目の手としては十分' },
  { pid:'hall_izakaya', name:'居酒屋あがりのホール', sex:'m', maji:3, spd:5, aiso:4, ryori:1,
    desc:'盆を持って走れる。運びながら床まで見ている' },
  { pid:'hall_gakusei', name:'ホールの学生バイト', sex:'f', maji:2, spd:4, aiso:4, ryori:1,
    desc:'安い。よく喋る。皿は落とさない' },
  { pid:'akasuri_pro', name:'垢すりの職人',     sex:'f', maji:4, spd:3, aiso:3, ryori:2, desc:'韓国で修行した腕。垢すり台があれば稼ぐ' },
  { pid:'freeter2',    name:'フリーター',       sex:'m', maji:2, spd:2, aiso:2, ryori:1, desc:'なんとなく応募してきたらしい' },
  { pid:'sauna_joshi', name:'サウナ好きの女子', sex:'f', maji:4, spd:4, aiso:4, ryori:3, desc:'週4で通っていた客。気づいたら履歴書を持ってきた' },
  // 厨房を任せられる人材。掃除は並だが、飯で客を呼べる
  { pid:'motoita',     name:'元定食屋の店主',   sex:'m', maji:4, spd:2, aiso:3, ryori:5, desc:'店を畳んだばかり。鍋を振る手はまだ落ちていない' },
  { pid:'chubo_gaku',  name:'調理学校の学生',   sex:'f', maji:3, spd:4, aiso:3, ryori:4, desc:'現場を見たくて来た。まかないの研究に余念がない' },
  /* ── 深夜に立てる人材（作者指定）──────────────────────
     主人公は21時で帰る。**この人たちを雇わないと、深夜営業はできない。**
     深夜割増25%（法定どおり）が付くので、日給は同じスキルでも高くつく。
     深夜バイトも昼に立てる＝雇っておいて損はないが、そのぶん人件費が重い */
  { pid:'yakin1',  name:'夜勤明けの元看護師', sex:'f', maji:5, spd:3, aiso:3, ryori:2, night:true,
    desc:'夜のほうが目が冴える。人の顔色をよく見ている' },
  { pid:'yakin2',  name:'昼夜逆転の若者',     sex:'m', maji:2, spd:4, aiso:2, ryori:1, night:true,
    desc:'朝は起きられない。夜だけは、なぜか働く' },
  { pid:'yakin3',  name:'元長距離運転手',     sex:'m', maji:4, spd:2, aiso:3, ryori:3, night:true,
    desc:'徹夜には慣れている。深夜の客が何を求めているかを知っている' },
];

/* ============ 湯温の帯 ============ */
const TEMP_RANGE2 = { sauna: [40, 110] };

/* ============ 章の登録 ============
   js/chapter.js の registerChapter2() に、game.js が見る名前をまとめて渡す */
registerChapter2({
  CONF: CONF2, DEFAULT_OPTS: DEFAULT_OPTS2, EQ: EQ2, EQ_NOTE: EQ_NOTE2, CATS: CATS2,
  ID_ALIAS: ID_ALIAS2, INIT_EQUIP: INIT_EQUIP2, TYPES: TYPES2, STAFF_POOL: STAFF_POOL2,
  TEMP_RANGE: TEMP_RANGE2, LINES, PROBLEMS,
  TIME_LIMITS: TIME_LIMITS2, STAY_NEED_MIX: STAY_NEED_MIX2, STAY_NEED_BATH: STAY_NEED_BATH2,
  FEE_OPTIONS: FEE_OPTIONS2, SAUNA_FEE_OPTIONS: SAUNA_FEE_OPTIONS2,
  FEE_RANGE: FEE_RANGE2, SAUNA_FEE_RANGE: SAUNA_FEE_RANGE2,
  FEE_BASE: FEE_BASE2, SAUNA_FEE_BASE: SAUNA_FEE_BASE2, FEE_STEP, FEE_CEIL: FEE_CEIL2,
  DRYER_FEES, LOTION_FEES, AMENITY_PRICES, TEBURA_PRICES, KID_FEES: KID_FEES2,
  MENU: MENU2, AREAS: AREAS2,
});
