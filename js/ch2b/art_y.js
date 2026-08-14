'use strict';

/* ============================================================
   ビルの外観（第2章「ととのい市編」のホーム画面）
   ------------------------------------------------------------
   **横から見た、ビルの外観だけ**（作者指定／Project Highrise のような絵）。
   中の間取りは見せない。見えるのは、
     ・階が積み上がっていく躯体と、窓の灯り
     ・看板（屋号）と、1階の入口
     ・まだ建っていない階＝**空に浮かぶ点線の枠**（伸びしろが見えている）
     ・下に、ととのい番付とSAUNA GATE 37との差

   窓の灯りが「いま何階に何人いるか」を伝える＝
   **中を描かなくても、店が動いているのが分かる。**
   階の帯をタップすると、その階の中（俯瞰マップ）へ入る。
   ============================================================ */

/* 夜の街の色。熱波銀座の裏通り＝飲み屋とネオンの明かりが下から当たる */
const Y_SKY_TOP = '#12161f';
const Y_SKY_BOT = '#2a2233';
/* ============ 空の色（作者指定 8/8）============
   15〜17時＝昼間／17〜19時＝夕方／19〜翌6時＝夜／翌6時〜＝昼間。

   ⚠ game.js の drawSky（屋外を暗くする演出）は `CONF.dayNight` を持つ章だけが
     通る作りで、**第2章はそのキーを持っていない＝一度も走っていなかった。**
     しかも第2章に屋外の区画（`park`）は無いので、実際に空が見えるのは
     この館内案内図だけ。だから時間帯はここで持つ。

   `night`（0〜1）は「夜らしさ」＝遠くのビルの明かり・星・窓の灯りの濃さに掛ける。
   昼間に窓が煌々と光っていると、絵が夜のままに見えるので                */
const Y_SKY_DAY   = ['#4d86c0', '#a6c6da'];   // 昼間（熱波銀座の上の、やや白い空）
const Y_SKY_EVE   = ['#2d3663', '#d9814a'];   // 夕方（下から焼ける）
const Y_SKY_NIGHT = [Y_SKY_TOP, Y_SKY_BOT];   // 夜
function ySkyNow() {
  /* 営業前（準備中・朝の画面）は開店時刻の空を出す＝15時＝昼間 */
  const h = (typeof G !== 'undefined' && G.phase === 'biz' && typeof openHourNow === 'function')
    ? ((((openHourNow() + (G.minutes || 0) / 60) % 24) + 24) % 24)
    : (typeof openHourNow === 'function' ? openHourNow() % 24 : 15);
  /* **切り替えではなく、混ぜて渡す。**（作者指定 8/8）
     節目の時刻で色が入れ替わると、19時ちょうどに空がパチンと変わって見える。
     どの瞬間も「前の色」と「次の色」を割合で混ぜ、その割合を
     ease（両端がなだらかな曲線）に通す＝暮れ際がいちばんゆっくり動く   */
  const ease = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  let a, b, t, night;
  if (h < 5)        { a = Y_SKY_NIGHT; b = Y_SKY_NIGHT; t = 0;                night = 1; }
  else if (h < 6)   { a = Y_SKY_NIGHT; b = Y_SKY_DAY;   t = ease(h - 5);      night = 1 - ease(h - 5); }
  else if (h < 17)  { a = Y_SKY_DAY;   b = Y_SKY_DAY;   t = 0;                night = 0; }
  else if (h < 18)  { a = Y_SKY_DAY;   b = Y_SKY_EVE;   t = ease(h - 17);     night = ease(h - 17) * 0.45; }
  else if (h < 19)  { a = Y_SKY_EVE;   b = Y_SKY_NIGHT; t = ease(h - 18);     night = 0.45 + ease(h - 18) * 0.55; }
  else              { a = Y_SKY_NIGHT; b = Y_SKY_NIGHT; t = 0;                night = 1; }
  const mix = (typeof mixCol === 'function') ? mixCol : ((p) => p);
  return { h, night, top: mix(a[0], b[0], t), bot: mix(a[1], b[1], t) };
}
const Y_WALL = '#4a4038';        // 躯体（タイル貼りの外壁）
const Y_WALL_DK = '#3a3229';
const Y_WIN_ON = '#ffd98a';      // 灯りのついた窓
const Y_WIN_OFF = '#232a33';     // 消えている窓
const Y_STREET = '#1b1714';

/* ============ 通りを歩く人 ============
   **左右から歩いてきて、入口から入っていく。**
   ただの飾りではなく、**実際に来た客のぶんだけ**歩いてくる（会計が1件増えたら1人）。
   帰った客は、入口から出て左右へ散っていく。
   そこに、店に用のない通行人が少しだけ混ざる＝熱波銀座の裏通りの人通り。       */
let Y_WALKERS = [];
let Y_WALK_T = 0;            // 前のフレームの時刻（performance.now）
let Y_LAST_PAID = 0;         // 会計の件数。増えたぶんだけ「入っていく人」を出す
let Y_LAST_IN = 0;           // 館内の人数。減ったぶんだけ「出ていく人」を出す
let Y_DOOR_X = 520;          // 入口の位置（描くときに入れ替わる）
let Y_DOOR_OPEN = 0;         // 自動ドアの開き具合（0＝閉／1＝全開）

const Y_WALK_COL = [
  ['#4a5568', '#3a3a3a'], ['#2e6b4f', '#6b4a2f'], ['#7a8a6f', '#d8d8d8'],
  ['#8a6a5a', '#4a4038'], ['#5a7ab8', '#8a7a5a'], ['#c96a3a', '#2f2822'],
];

/* **強面の客が、通りにも出る**（作者指定 8/5）。
   店に入っている刺青の客の割合に連動させる＝
   「お断り」を掲げた日は、店に入る人にも出てくる人にも一人も混ざらない。
   ただし**通り過ぎるだけの人**（`pass`）は別勘定＝熱波銀座の裏通りには、
   うちが断ろうが断るまいが、そういう人が歩いている                        */
function yYakuWalkRate(kind) {
  if (kind === 'pass') return 0.12;                       // 街の人通り。店の方針とは関係ない
  if (G.opts && G.opts.banYakuza) return 0;               // 断っている店には来ない
  const cs = G.customers || [];
  if (!cs.length) return 0;
  const n = cs.filter(c => c.type && c.type.tattoo).length;
  return Math.min(0.5, n / cs.length * 2.2);              // 実際に居るぶんだけ、通りにも出る
}

function ySpawnWalker(kind) {
  const fromLeft = Math.random() < 0.5;
  const col = Y_WALK_COL[(Math.random() * Y_WALK_COL.length) | 0];
  const yaku = Math.random() < yYakuWalkRate(kind);
  Y_WALKERS.push({
    kind,                                   // 'in'＝入る／'out'＝出てきた／'pass'＝通り過ぎるだけ
    x: kind === 'out' ? Y_DOOR_X : (fromLeft ? -40 : 1080),
    dir: kind === 'out' ? (fromLeft ? -1 : 1) : (fromLeft ? 1 : -1),
    /* **急がない。**肩で風を切って、ゆっくり歩く（歩幅は広く、揺れは大きい） */
    spd: yaku ? (26 + Math.random() * 14) : (46 + Math.random() * 34),
    body: col[0], hair: col[1],
    yaku,
    /* **濃い色のスーツ**（作者指定 8/5）。白や赤にすると戦隊モノに見える＝
       濃紺と黒だけで振る。違いは髪（オールバックの白髪まじり／黒のパンチパーマ） */
    suit: yaku ? (Math.random() < 0.55) : false,   // true＝濃紺／false＝黒
    grey: yaku ? (Math.random() < 0.5) : false,    // 白髪まじりのオールバック
    t: Math.random() * 6.28,                // 歩幅の位相（上下に揺れる）
    fade: 1,
  });
  if (Y_WALKERS.length > 24) Y_WALKERS.shift();
}

/* 実際の客の出入りに合わせて、歩く人を足す */
function yWalkerSync() {
  const paid = (G.today && G.today.paid) || 0;
  if (paid > Y_LAST_PAID) { for (let i = 0; i < Math.min(3, paid - Y_LAST_PAID); i++) ySpawnWalker('in'); }
  Y_LAST_PAID = paid;
  const inside = (G.customers || []).length;
  if (inside < Y_LAST_IN) { for (let i = 0; i < Math.min(3, Y_LAST_IN - inside); i++) ySpawnWalker('out'); }
  Y_LAST_IN = inside;
}

/* 歩く人を進める＆描く。入口に着いたら、吸い込まれるように消える */
function yDrawWalkers(g, dt, streetY, doorX) {
  Y_DOOR_X = doorX;
  // 通行人（店に入らない人）。夜の通りが完全に無人だと、街に見えない
  if (Math.random() < dt * 0.55) ySpawnWalker('pass');

  /* **入口と同じ高さの地面に立たせる**（作者指定）。
     ビルの下端＝streetY がそのまま通路の床なので、足元がそこに来るように置く。
     以前は歩道をビルより一段下に敷いていたので、客が段差の下を歩いていた */
  const baseY = streetY - 39;
  for (let i = Y_WALKERS.length - 1; i >= 0; i--) {
    const w = Y_WALKERS[i];
    w.x += w.dir * w.spd * dt;
    w.t += dt * 9;
    /* 入る人は、**戸が開いてから**くぐって消える。
       閉まっているうちは戸の前で足踏みして待つ＝ドアが開くのを待っている  */
    if (w.kind === 'in' && Math.abs(w.x - doorX) < 18) {
      if (Y_DOOR_OPEN > 0.55) w.fade -= dt * 2.4;
      else w.x -= w.dir * w.spd * dt;            // まだ開いていない＝その場で待つ
    }
    if (w.kind === 'out' && Math.abs(w.x - doorX) > 30) { /* そのまま歩き去る */ }
    if (w.fade <= 0 || w.x < -80 || w.x > 1120) { Y_WALKERS.splice(i, 1); continue; }

    const bob = Math.sin(w.t) * 2;
    g.globalAlpha = Math.max(0, w.fade);
    if (w.yaku) { yDrawYakuWalker(g, w, baseY, bob); g.globalAlpha = 1; continue; }
    // 影
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.fillRect(w.x - 13, baseY + 38, 26, 5);
    // 体
    g.fillStyle = w.body;
    g.fillRect(w.x - 11, baseY + bob, 22, 28);
    // 足（歩幅）
    const st = Math.sin(w.t) * 6;
    g.fillRect(w.x - 10 + st, baseY + 28 + bob, 7, 11);
    g.fillRect(w.x + 3 - st, baseY + 28 + bob, 7, 11);
    // 頭
    g.fillStyle = '#e8c39a';
    g.fillRect(w.x - 9, baseY - 17 + bob, 18, 18);
    g.fillStyle = w.hair;
    g.fillRect(w.x - 10, baseY - 21 + bob, 20, 8);
    g.globalAlpha = 1;
  }
}

/* ============ 通りを歩く強面の人（作者指定 8/5）============
   **服装と髪型で、ひと目でそれと分かること。**

   > 「今の彼らの服装は、戦隊モノのヒーローみたいだ」（作者・8/5）

   初版は白スーツと赤いアロハで振っていたが、明度と彩度が高い服を2色並べると
   **戦隊モノに見える。**色で区別するのをやめ、**濃紺と黒だけ**にした。
   見分けるのは色ではなく、**輪郭**：

     ・濃い色のスーツ（中は黒シャツ・**太い金のネックレス**）
     ・オールバック（白髪まじり／黒）。額を出して、後ろへ撫でつける
     ・黒いサングラス
     ・**肩幅が広く、がに股。**上半身を一回り大きく取り、足を外へ開いて立つ
     ・歩き方が違う＝ゆっくり、肩を左右に振る（ySpawnWalker で spd を落としてある）

   ドットの人形なので、顔は描き込まない。**シルエットだけで読ませる**       */
function yDrawYakuWalker(g, w, baseY, bob) {
  const x = w.x;
  const sway = Math.sin(w.t * 0.5) * 2.5;        // 肩で風を切る（ゆっくり左右に振れる）
  const st = Math.sin(w.t) * 5;                  // 歩幅

  const SUIT = w.suit ? '#242c40' : '#1e1c1b';   // 濃紺／黒
  const SUIT_HI = w.suit ? '#2f3a54' : '#2b2826'; // 肩の面（少しだけ明るく）
  const SHIRT = '#0e1014';                        // 中の黒シャツ
  const GOLD = '#d8b64a';

  // 影（体が大きいぶん、影も広い）
  g.fillStyle = 'rgba(0,0,0,.42)';
  g.fillRect(x - 17, baseY + 38, 34, 6);

  /* 足＝**がに股。**内股を空けて、爪先を外へ向ける（先の尖った革靴） */
  g.fillStyle = SUIT;
  g.fillRect(x - 13 + st, baseY + 26 + bob, 8, 11);
  g.fillRect(x + 5 - st, baseY + 26 + bob, 8, 11);
  g.fillStyle = '#141211';
  g.fillRect(x - 16 + st, baseY + 36 + bob, 11, 4);      // 左足は外（左）へ
  g.fillRect(x + 5 - st, baseY + 36 + bob, 11, 4);       // 右足は外（右）へ

  /* 上着。**裾が長い**（腿の半ばまで）＝スーツの丈で、体を大きく見せる */
  g.fillStyle = SUIT;
  g.fillRect(x - 14 + sway, baseY - 1 + bob, 28, 28);
  // 中の黒シャツ（襟元をV字に開ける）
  g.fillStyle = SHIRT;
  g.fillRect(x - 5 + sway, baseY - 1 + bob, 10, 15);
  // 上着の合わせ（左右の前身頃）。Vの両脇を厚めに取る
  g.fillStyle = SUIT_HI;
  g.fillRect(x - 10 + sway, baseY - 1 + bob, 6, 14);
  g.fillRect(x + 4 + sway, baseY - 1 + bob, 6, 14);
  // 太い金のネックレス（襟元の一点。**この店の通りでいちばん光る**）
  g.fillStyle = GOLD;
  g.fillRect(x - 3 + sway, baseY + 3 + bob, 6, 3);
  g.fillRect(x - 1 + sway, baseY + 6 + bob, 2, 2);
  // 前立てのボタン
  g.fillStyle = 'rgba(0,0,0,.45)';
  g.fillRect(x - 1 + sway, baseY + 14 + bob, 2, 2);

  /* 手はポケットの中＝腕は描かず、上着の裾に切れ目だけ入れる */
  g.fillStyle = 'rgba(0,0,0,.35)';
  g.fillRect(x - 11 + sway, baseY + 17 + bob, 5, 2);
  g.fillRect(x + 6 + sway, baseY + 17 + bob, 5, 2);
  // 上着の裾（ここでズボンに変わる）
  g.fillStyle = 'rgba(0,0,0,.32)';
  g.fillRect(x - 14 + sway, baseY + 24 + bob, 28, 3);

  // 肩（一段せり出す＝いかり肩）
  g.fillStyle = SUIT_HI;
  g.fillRect(x - 17 + sway, baseY - 1 + bob, 34, 5);
  g.fillStyle = 'rgba(0,0,0,.28)';
  g.fillRect(x - 17 + sway, baseY + 4 + bob, 34, 2);

  // 首（太い）
  g.fillStyle = '#d9ab7e';
  g.fillRect(x - 6 + sway, baseY - 6 + bob, 12, 6);

  // 顔
  g.fillStyle = '#e0b083';
  g.fillRect(x - 10 + sway, baseY - 20 + bob, 20, 16);
  /* オールバック。**額を出して、後ろへ撫でつける**＝
     てっぺんを盛らずに、生え際を一段上げて横に流す（白髪まじりと黒の2通り） */
  const HAIR = w.grey ? '#7d7970' : '#171512';
  const HAIR_DK = w.grey ? '#4e4b45' : '#0d0c0b';
  g.fillStyle = HAIR;
  g.fillRect(x - 11 + sway, baseY - 25 + bob, 22, 6);       // 後ろへ撫でつけた髪
  g.fillStyle = HAIR_DK;
  g.fillRect(x - 11 + sway, baseY - 26 + bob, 22, 2);       // てっぺんの陰
  g.fillStyle = HAIR;
  g.fillRect(x - 11 + sway, baseY - 19 + bob, 3, 9);        // もみあげ（両脇を下まで）
  g.fillRect(x + 8 + sway, baseY - 19 + bob, 3, 9);
  /* 黒いサングラス（額を一段見せてから掛ける＝オールバックが効く）。
     **一本の帯にしない。**レンズ2枚と、その間を渡すブリッジで組む＝
     真ん中が細くなって、初めて「掛けている眼鏡」に見える（作者指定 8/5） */
  g.fillStyle = '#0d0c0b';
  g.fillRect(x - 10 + sway, baseY - 16 + bob, 8, 6);        // 左のレンズ
  g.fillRect(x + 2 + sway, baseY - 16 + bob, 8, 6);         // 右のレンズ
  g.fillRect(x - 2 + sway, baseY - 15 + bob, 4, 2);         // ブリッジ（鼻にかかる細い一本）
  g.fillRect(x - 11 + sway, baseY - 15 + bob, 1, 2);        // 蔓（左右のこめかみへ）
  g.fillRect(x + 10 + sway, baseY - 15 + bob, 1, 2);
  g.fillStyle = 'rgba(255,255,255,.20)';                    // レンズの照り返し
  g.fillRect(x - 9 + sway, baseY - 15 + bob, 3, 2);
  g.fillStyle = 'rgba(255,255,255,.10)';
  g.fillRect(x + 3 + sway, baseY - 15 + bob, 3, 2);
  // への字の口（太くすると髭に見えるので、細く短く）
  g.fillStyle = 'rgba(70,44,32,.55)';
  g.fillRect(x - 3 + sway, baseY - 8 + bob, 6, 1);
}

function yRound(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/* 階の並び（下から1F…）。階段＆エレベーターは「階」ではないので外す */
function yFloorsOnScreen() {
  return (CONF.areas || []).map((a, f) => ({ a, f })).filter(o => o.a.lvl > 0)
    .sort((p, q) => p.a.lvl - q.a.lvl);
}
/* まだ建っていない階（点線の枠で空に出す＝これから積む場所） */
function yGhostFloors() {
  const built = (CONF.areas || []).length;
  return AREAS_Y.map((a, f) => ({ a, f })).filter(o => o.f >= built && o.a.lvl > 0)
    .sort((p, q) => p.a.lvl - q.a.lvl);
}

/* いま何時か（準備中は朝＝10時として扱う）。工事の職人の出退勤に使う */
function yNowHour() {
  if (G.phase !== 'biz') return 10;
  return (CONF.openHour + Math.floor(G.minutes / 60)) % 24;
}
/* **建設業者は朝9時に来て、夕方18時に帰る**（作者指定）。
   夜のあいだ足場は架かったままだが、人はいないし、音もしない */
function yWorkersOn() {
  const h = yNowHour();
  return h >= 9 && h < 18;
}
/* 工事の音（ガンガン！／キューン！）。職人がいる時間だけ、間をあけて鳴らす */
let Y_KOUJI_SND = 0;
function yKoujiSound(dt) {
  if (!yWorkersOn() || G.paused) return;
  Y_KOUJI_SND -= dt;
  if (Y_KOUJI_SND > 0) return;
  Y_KOUJI_SND = 1.6 + Math.random() * 2.4;                 // 1.6〜4.0秒おき
  if (typeof Sfx === 'undefined') return;
  Sfx.play(Math.random() < 0.62 ? 'kouji' : 'drill');      // 槌のほうが多い
}

/* ============================================================
   館内案内図に、中の人の声を出す（作者指定 2026-08-06）
   ------------------------------------------------------------
   > 客の吹き出しもビルの各階に出るようにしたい。中に人がいるのを感じられるでしょ。

   窓の灯りは「何人いるか」しか言わない（しかも作者指定で**つけっぱなし**）。
   声が出て初めて、**そこに誰かが居る**になる。

   ⚠ 生の吹き出しをそのまま映すと、ほとんどの瞬間はどの階も無言なので、
     ビルが静まり返って見える。**階ごとに「最後に言われたこと」を覚えておいて、
     しばらく残す。**＝一度に全部の階が喋るのではなく、順に灯っては消える     */
const Y_SAY_LIFE = 9;                      // 何ゲーム分ぶん残すか
const Y_SAY_N = 2;                         // 1つの階に、同時にいくつ声を出すか
const Y_SAY = {};                          // 階 → [ { text, at, hint }, … ] 新しい順

/* 「⚠ スタッフがいません」の帯の当たり判定。**押したらバイトの管理画面へ飛ぶ**
   （作者指定 8/6）＝警告を読んで、その場で直せる。描くたびに作り直す */
let Y_WARN_RECTS = [];
/* 看板の置き場（場所を選んでいる間だけ出る・作者指定 8/8）。描くたびに作り直す */
let Y_SIGN_RECTS = [];
/* 未建設の階に置く【＋】の当たり判定（作者指定 8/8）。
   増築は**下の階から順**にしか積めないので、＋を出すのは**次の1階だけ**。
   その上は「まだ」と分かる見た目にして、押させない */
let Y_ZOU_RECTS = [];
/* **同じ台詞は、ビル全体で1つだけ。**
   階ごとの重複は潰していたが、階をまたぐぶんが残っていて、
   「……宇宙……」が5Fと4Fに同時に出ていた＝群れではなく、コピーに見える */
let Y_SAY_SHOWN = new Set();
/* 声は**いちばん最後にまとめて描く。**フロアの帯の中で描いていたときは、
   あとから描かれる入口の自動ドアと庇に1階の声が隠れて、字が切れていた。
   ついでに、声はこの絵のいちばん上の層でいい（いちばん生きている要素なので） */
let Y_SAY_DRAW = [];
function yGuideTap(px, py) {
  /* 看板の場所を選んでいる間は、置き場のタップが最優先（階の中へは入らない） */
  if (typeof ySignPlacing === 'function' && ySignPlacing()) {
    const sp = Y_SIGN_RECTS.find(q => px >= q.x && px <= q.x + q.w && py >= q.y && py <= q.y + q.h);
    if (sp) {
      if (typeof Sfx !== 'undefined') Sfx.play('ui');
      ySignPlaceAt(sp.f);
      return true;
    }
    return true;                            // 選んでいる最中は、よそを叩いても階へ入らない
  }
  /* 何も選んでいないときの置き場のタップ＝**どの看板を出すか**を聞く（作者指定 8/8） */
  {
    const sp0 = Y_SIGN_RECTS.find(q => px >= q.x && px <= q.x + q.w && py >= q.y && py <= q.y + q.h);
    if (sp0 && typeof yAskSign === 'function') {
      if (typeof Sfx !== 'undefined') Sfx.play('ui');
      yAskSign(sp0.f);
      return true;
    }
  }
  /* 未建設の階の【＋】＝増築の入口（作者指定 8/8）。
     下の階から順にしか積めないので、押せるのは次の1階だけ */
  const zh = Y_ZOU_RECTS.find(q => px >= q.x && px <= q.x + q.w && py >= q.y && py <= q.y + q.h);
  if (zh) {
    if (typeof Sfx !== 'undefined') Sfx.play('ui');
    if (typeof yAskZou === 'function') yAskZou(zh.f);
    return true;
  }
  const hit = Y_WARN_RECTS.find(q => px >= q.x && px <= q.x + q.w && py >= q.y && py <= q.y + q.h);
  if (!hit) return false;
  if (typeof Sfx !== 'undefined') Sfx.play('ui');
  if (typeof openStaffMgr === 'function') openStaffMgr();
  return true;                             // ここで止める（階の中へは入らない）
}

function yDrawGuideSay(g, f, bx, bw, y, h, warned) {
  if (G.phase !== 'biz') return;
  /* その階で、いま声が出ている**客**を拾う。
     **同じ台詞は重ねない**＝「牛乳のむ！」が2段になると、群れではなくバグに見える */
  const heard = [];
  for (const c of (G.customers || []))
    /* `c.bub.f` ＝**その台詞を言った階**。いま居る階と照らす（game.js の bubble）。
       吹き出しは数秒残るので、これが無いと**受付の「よろしく〜」が2階の声になり、
       風呂上がりの「ととのった〜！！」が、寝ているはずのカプセル階から聞こえた** */
    if ((c.f | 0) === (f | 0) && c.bub && c.bub.text
        && (c.bub.f == null || (c.bub.f | 0) === (f | 0))
        && !heard.includes(c.bub.text)) {
      heard.push(c.bub.text);
      if (heard.length >= Y_SAY_N) break;
    }
  /* **バイトの声は出さない**（作者指定 8/6）。ここは「客が居る」を見せる層で、
     働いている側の独り言が混ざると、店の熱気ではなく厨房の内輪話になる */

  let list = Y_SAY[f] || [];
  for (const text of heard) {
    const hint = (G.customers || []).some(c => c.bub && c.bub.text === text && c.bub.hint);
    list = list.filter(v => v.text !== text);
    list.unshift({ text, at: G.minutes, hint });
  }
  // 古いものと、日をまたいだもの（age が負）を落とす
  list = list.filter(v => { const a = G.minutes - v.at; return a >= 0 && a <= Y_SAY_LIFE; })
             .slice(0, Y_SAY_N);
  Y_SAY[f] = list;
  if (!list.length) return;

  /* ⚠ の帯が出ている階でも**声は出す**（作者指定 8/6）。
     譲らせていたときは、深夜にいちばん人が多い屋上（20人）とカプセル（15人）が
     警告に覆われて**無言に見えていた**＝この仕組みで一番見たい瞬間が隠れていた。
     客の声はこの絵のいちばん上の層。ただし警告の帯を潰さないよう、
     警告が出ている階では**1つだけ、帯の下に**置く                        */
  /* **ビルの上に、大きく。**
     右の空に小さく1行だと「外の誰かが喋っている」ようにしか見えず、
     中の熱気が伝わらなかった（作者指摘 8/6）。
     窓の上に直に貼って、**同じ階から2つ**出す＝人がひしめいている感じになる。
     声の板は階ごとに左右へずらす（縦に揃うと、看板が並んでいるように見える）  */
  /* ビル全体で言われていない台詞だけを、上から2つ選ぶ */
  const show = [];
  for (const v of list) {
    if (Y_SAY_SHOWN.has(v.text)) continue;
    Y_SAY_SHOWN.add(v.text);
    show.push(v);
    if (show.length >= Y_SAY_N) break;
  }
  if (!show.length) return;

  Y_SAY_DRAW.push({ show: warned ? show.slice(0, 1) : show, bx, bw, y, h, f, warned });
}

function yFlushGuideSay(g) {
  for (const { show, bx, bw, y, h, f, warned } of Y_SAY_DRAW) {
  const lean = ((f * 5) % 3) - 1;
  const maxW = bw - 44;
  g.save();
  g.textAlign = 'left';
  for (let i = 0; i < show.length; i++) {
    const say = show[i];
    const age = G.minutes - say.at;
    const fade = Math.min(1, (Y_SAY_LIFE - age) / 2.5) * (i === 0 ? 1 : 0.88);
    if (fade <= 0.02) continue;

    let fs = i === 0 ? 22 : 19;
    g.font = 'bold ' + fs + 'px "DotGothic16",sans-serif';
    let t = say.text;
    while (g.measureText(t).width > maxW - 30 && t.length > 5) t = t.slice(0, -1);
    if (t !== say.text) t += '…';
    const bw2 = g.measureText(t).width + 30, bh2 = fs + 16;
    /* 1つ目は上、2つ目は下。**板同士は重ねない**（重なると字が潰れて読めない）。
       警告が出ている階は、その帯（中央から上）の**すぐ下**に1つだけ置く */
    const dy = warned ? 28 : (i === 0 ? -22 : 24);
    const dx = (i === 0 ? lean * 34 : -lean * 30 + 26);
    const sx = clamp(bx + bw / 2 - bw2 / 2 + dx, bx + 8, bx + bw - bw2 - 8);
    const sy = y + h / 2 - bh2 / 2 + dy;

    g.globalAlpha = fade;
    g.fillStyle = say.hint ? 'rgba(150,36,32,.93)' : 'rgba(16,12,9,.86)';
    yRound(g, sx, sy, bw2, bh2, 9); g.fill();
    g.strokeStyle = say.hint ? '#ff9a86' : 'rgba(255,224,168,.45)';
    g.lineWidth = 2; yRound(g, sx, sy, bw2, bh2, 9); g.stroke();
    // 下向きの小さな尻尾（窓のほうへ）＝板ではなく吹き出しに見せる
    g.fillStyle = say.hint ? 'rgba(150,36,32,.93)' : 'rgba(16,12,9,.86)';
    const tx = sx + Math.min(bw2 - 22, 26);
    g.beginPath();
    g.moveTo(tx, sy + bh2); g.lineTo(tx + 14, sy + bh2); g.lineTo(tx + 3, sy + bh2 + 10);
    g.closePath(); g.fill();
    g.fillStyle = say.hint ? '#ffd9cf' : '#ffeccb';
    g.fillText(t, sx + 15, sy + bh2 / 2 + fs * 0.36);
  }
  g.restore();
  }
  Y_SAY_DRAW = [];
}


/* ============ 看板のアイコン（作者指定 8/8）============
   外観メニューを**フロアのカタログと同じ形**（絵→名前→値段）にするために、
   看板の小さな絵をその場で描いて data URL にする。
   ⚠ 看板は設備（EQ）ではないので、共有の iconFor() は使えない。
     色はビルの絵で使っているものと揃える＝一覧と外観で同じ物に見える     */
/* 看板に出す文字＝**自分で決めた屋号**（作者指定 8/9）。
   入力は10文字までだが、セーブが壊れていても絵が壊れないように、ここでも切っておく */
function ySignText() {
  const n = (typeof G !== 'undefined' && G && G.name) ? String(G.name).trim() : '';
  const d = (CONF.shopNaming && CONF.shopNaming.def) || 'サウナ';
  return (n || d).slice(0, 10);
}

const Y_SIGN_ICON = {};
function ySignIcon(id) {
  /* 一覧の小さな絵にも屋号を出す。**屋号が変わったら描き直す**ので、
     しまっておく鍵に屋号を混ぜる（混ぜないと最初の屋号のまま残る）        */
  const txt = ySignText();
  const key = id + '/' + txt;
  if (Y_SIGN_ICON[key]) return Y_SIGN_ICON[key];
  const c = document.createElement('canvas');
  c.width = 68; c.height = 68;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  if (id === 'roof') {                                   // 屋上の大看板＝横長の板
    g.fillStyle = '#241d17'; g.fillRect(6, 20, 56, 28);
    g.strokeStyle = '#6a5642'; g.lineWidth = 3; g.strokeRect(7.5, 21.5, 53, 25);
    g.fillStyle = '#3a2f26'; g.fillRect(14, 48, 6, 8); g.fillRect(48, 48, 6, 8);   // 脚
    g.fillStyle = '#ffd98a'; g.font = 'bold 15px "DotGothic16",sans-serif';
    g.textAlign = 'center'; g.fillText('♨', 34, 40);
  } else {                                               // 袖看板／ネオン＝縦長の板
    const neon = (id === 'neon');
    if (neon) { g.fillStyle = 'rgba(255,120,90,.28)'; g.fillRect(14, 4, 40, 60); }  // 光
    g.fillStyle = '#3a2f26'; g.fillRect(4, 26, 18, 7);                              // 壁から出た腕
    g.fillStyle = neon ? '#c2265a' : '#b4442f';
    yRound(g, 20, 6, 30, 56, 6); g.fill();
    g.strokeStyle = neon ? '#ffd0e0' : '#e9c48a'; g.lineWidth = 3;
    yRound(g, 20, 6, 30, 56, 6); g.stroke();
    /* 縦書き。**字の送りは字数から割り出す**（決め打ちだと長い屋号がはみ出す）。
       10文字でも板（高さ56）に収まる                                       */
    const n = Math.max(1, txt.length);
    const st = Math.min(11, 52 / n);
    g.fillStyle = neon ? '#fff2f6' : '#ffeccd';
    g.font = 'bold ' + Math.max(6, Math.round(st * 0.95)) + 'px "DotGothic16",sans-serif';
    g.textAlign = 'center';
    for (let i = 0; i < n; i++) g.fillText(txt[i], 35, 12 + st * 0.9 + i * st);
  }
  Y_SIGN_ICON[key] = c.toDataURL();
  return Y_SIGN_ICON[key];
}

function yDrawGuide(g, W, H, list) {
  /* 館内案内図に切り替えたら、客をタップした札は畳む（custcard_y.js）。
     札は DOM なので、キャンバスを描き替えただけでは消えない＝ここで明示的に消す */
  if (typeof yCardHide === 'function') yCardHide();
  const floors = yFloorsOnScreen();
  const ghosts = yGhostFloors();
  if (!floors.length) return false;              // 念のため（描けないときは従来の絵に任せる）

  /* ── 空（時間帯で色が変わる。ySkyNow を見よ）── */
  const sk = ySkyNow();
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, sk.top); sky.addColorStop(1, sk.bot);
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  // 遠くのビル群（外気ベイ）。昼はシルエット、夜は明かりが灯る
  g.fillStyle = sk.night > 0.5 ? 'rgba(120,140,180,.13)'
                               : 'rgba(40,55,80,' + (0.10 + 0.10 * (1 - sk.night)).toFixed(3) + ')';
  const far = [[40, 260], [130, 200], [210, 320], [300, 150], [820, 230], [900, 300], [980, 180]];
  for (const [x, h] of far) g.fillRect(x, H - 300 - h, 70, h + 300);
  if (sk.night > 0.04) {                       // 窓の明かりと星は、暮れてから
    g.fillStyle = 'rgba(255,220,150,' + (0.16 * sk.night).toFixed(3) + ')';
    for (let i = 0; i < 90; i++) {
      const x = (i * 137) % W, y = (i * 91) % (H - 420);
      g.fillRect(x, 60 + y, 5, 7);
    }
  }

  /* ── 寸法。1階ぶんの高さは決め打ちで、階が増えたら上へ伸びる ── */
  const streetY = H - 200;                        // 歩道の高さ（ここより下が通り）
  const fh = Math.min(150, Math.max(96, (streetY - 210) / Math.max(1, floors.length)));
  const bw = Math.min(560, W - 300);              // ビルの幅
  const bx = (W - bw) / 2;
  const bottom = streetY;
  const yOf = lvlIdx => bottom - (lvlIdx + 1) * fh;   // 下から数えて何段目か

  /* ── 通り（下） ── */
  g.fillStyle = Y_STREET; g.fillRect(0, streetY, W, H - streetY);
  g.fillStyle = 'rgba(255,255,255,.10)';
  g.fillStyle = '#2a241e'; g.fillRect(0, streetY, W, 96);                 // 歩道
  g.fillStyle = 'rgba(255,255,255,.10)';
  for (let x = 20; x < W; x += 90) g.fillRect(x, streetY + 132, 46, 5);  // 車道のセンターライン
  // 隣のビル（両隣は埋まっている＝裏通りの詰まった感じ）
  g.fillStyle = '#2b2620';
  g.fillRect(bx - 150, streetY - 420, 130, 420);
  g.fillRect(bx + bw + 20, streetY - 330, 140, 330);
  g.fillStyle = 'rgba(255,210,140,.10)';
  for (let i = 0; i < 14; i++) { g.fillRect(bx - 132, streetY - 400 + i * 28, 20, 14); g.fillRect(bx + bw + 40, streetY - 310 + i * 22, 18, 12); }

  /* ── 工事中の階（3日かけて、だんだん出来上がる）──────────────
     着工した朝は鉄骨だけ。2日目に床と柱、3日目に壁が入って、
     翌朝ここが本物の階になる。足場には建設業者がいて、槌を振っている       */
  const kj = (typeof yKouji === 'function') ? yKouji() : null;
  if (kj) {
    const ka = AREAS_Y[kj.f] || {};
    const ky = yOf((ka.lvl || 2) - 1);
    const p = (typeof yKoujiProgress === 'function') ? yKoujiProgress() : 0;
    const t = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;

    // 鉄骨（初日から立っている）
    g.strokeStyle = '#8a7a5a'; g.lineWidth = 4;
    for (let i = 0; i <= 4; i++) {
      const cx2 = bx + 10 + (bw - 20) * (i / 4);
      g.beginPath(); g.moveTo(cx2, ky + fh - 6); g.lineTo(cx2, ky + 6); g.stroke();
    }
    g.beginPath(); g.moveTo(bx, ky + fh - 6); g.lineTo(bx + bw, ky + fh - 6); g.stroke();

    // 床（2日目から）と壁（3日目から）が、下から順に埋まっていく
    if (p > 0.15) { g.fillStyle = Y_WALL_DK; g.fillRect(bx, ky + fh - 16, bw, 12); }
    if (p > 0.3) {
      const wh2 = (fh - 20) * Math.min(1, (p - 0.3) / 0.6);
      g.fillStyle = Y_WALL; g.fillRect(bx, ky + fh - 16 - wh2, bw, wh2);
    }
    // 養生シート（半透明の青）
    g.fillStyle = 'rgba(120,170,200,.18)'; g.fillRect(bx - 6, ky, bw + 12, fh - 4);

    // 足場（パイプの格子）
    g.strokeStyle = '#c9a86a'; g.lineWidth = 3;
    for (let i = 0; i <= 6; i++) {
      const sx2 = bx - 6 + (bw + 12) * (i / 6);
      g.beginPath(); g.moveTo(sx2, ky); g.lineTo(sx2, ky + fh - 4); g.stroke();
    }
    for (const ry of [ky + fh * 0.25, ky + fh * 0.6, ky + fh - 8]) {
      g.beginPath(); g.moveTo(bx - 6, ry); g.lineTo(bx + bw + 6, ry); g.stroke();
    }

    /* 建設業者。**朝9時に来て、夕方18時に帰る**（作者指定）。
       いる間は足場の上で槌を振り、ガンガン／キューンと音がする              */
    if (yWorkersOn()) for (let i = 0; i < 3; i++) {
      const wx = bx + 60 + i * (bw - 120) / 2;
      const wy = ky + fh - 30;
      const swing = Math.sin(t * 6 + i * 2) * 6;
      g.fillStyle = '#3f5d8a'; g.fillRect(wx - 8, wy, 16, 22);        // 作業着
      g.fillStyle = '#e8c39a'; g.fillRect(wx - 6, wy - 13, 13, 14);   // 顔
      g.fillStyle = '#ffcf3a'; g.fillRect(wx - 9, wy - 18, 19, 7);    // ヘルメット
      g.strokeStyle = '#c9a86a'; g.lineWidth = 3;                     // 槌
      g.beginPath(); g.moveTo(wx + 6, wy + 6); g.lineTo(wx + 16, wy - 4 + swing); g.stroke();
    }
    // 職人が帰ったあとは、足場だけが残る（音もしない）
    if (!yWorkersOn()) {
      g.fillStyle = 'rgba(12,10,8,.35)'; g.fillRect(bx - 6, ky, bw + 12, fh - 4);
    }
    // 「工事中」の看板
    g.fillStyle = '#f2c14b'; yRound(g, bx + bw / 2 - 66, ky + fh / 2 - 16, 132, 32, 5); g.fill();
    g.fillStyle = '#2a2318'; g.font = 'bold 24px "DotGothic16",sans-serif'; g.textAlign = 'center';
    g.fillText('工 事 中', bx + bw / 2, ky + fh / 2 + 8);
  }

  /* ── まだ建っていない階（点線の枠）──────────────────────
     ⚠ 以前は線 .30／字 .42 の**空に溶ける薄さ**で、夜でも読みづらく、
       昼の空（明るい水色）を入れてからは、ほぼ見えなくなっていた（作者指摘 8/8）。

     濃くするだけでは足りない。**空の色は時刻で動く**ので、線と字だけを強めても
     昼と夜のどちらかで必ず埋もれる。**先に暗い下地を敷いて空から切り離し**、
     その上に線と字を置く＝どの時刻でも同じ読みやすさになる。
     下地の濃さは、建っている階の名札（rgba(12,10,8,.8)）に合わせてある      */
  Y_ZOU_RECTS = [];
  /* いま頼める階（＝次の1階）。ここにだけ【＋】を出す */
  const nextF = (typeof yFloorCount === 'function') ? yFloorCount() : -1;
  for (const o of ghosts) {
    if (kj && o.f === kj.f) continue;            // 工事中の階は、上でもう描いてある
    const y = yOf(o.a.lvl - 1);
    if (y < 40) break;
    const gh = fh - 6;
    // 下地（空を透かしつつ、字が乗る濃さ）
    g.setLineDash([]);
    g.fillStyle = 'rgba(16,14,12,.38)';
    yRound(g, bx, y, bw, gh, 6); g.fill();
    // 点線の枠
    g.setLineDash([10, 10]); g.lineWidth = 3;
    g.strokeStyle = 'rgba(228,236,248,.62)';
    yRound(g, bx, y, bw, gh, 6); g.stroke();
    g.setLineDash([]);
    /* **何階の何になる場所か**を出す（作者指摘 8/8）。
       ⚠ 最初は枠の中に右寄せで書いていたが、**建っている階と並びが違う**（作者指摘 8/9）。
         建っている階の名札はビルの左に出るので、未建設の階も**左に同じ形の名札**を出す。
         ＝上から下まで、階の名前が一本の列に揃う。枠の中は【＋】のためだけに空ける      */
    g.textAlign = 'left';
    const gl1 = o.a.lvl + 'F ' + (o.a.short || o.a.name.replace(/^\S+\s/, ''));
    const groom = bx - 24;                       // 左に使える幅（建っている階と同じ）
    let gfs = 26;
    g.font = 'bold ' + gfs + 'px "DotGothic16",sans-serif';
    while (gfs > 15 && g.measureText(gl1).width + 28 > groom) {
      gfs -= 2; g.font = 'bold ' + gfs + 'px "DotGothic16",sans-serif';
    }
    /* ⚠ 札に「未建設」とは**書かない**（作者指定 8/9）。
       枠が点線で、中が空で、【＋】が出ている＝まだ建っていないことは絵で分かる。
       札は建っている階と同じ形・同じ大きさにして、**下地だけ薄くする**（.8 → .62）  */
    const glw = Math.min(groom, g.measureText(gl1).width + 28);
    const glx = Math.max(10, bx - 14 - glw);
    /* 下地は**建っている階とまったく同じ濃さ**（作者指定 8/9）。
       薄くして「まだ無い階」を出そうとしたが、空の色が時刻で動くぶん読みにくかった。
       建っていないことは点線の枠と【＋】で伝わるので、札は同じ色でいい            */
    g.fillStyle = 'rgba(12,10,8,.8)';
    yRound(g, glx, y + gh / 2 - 26, glw, 52, 8); g.fill();
    g.setLineDash([6, 5]); g.lineWidth = 2; g.strokeStyle = 'rgba(228,236,248,.45)';
    yRound(g, glx, y + gh / 2 - 26, glw, 52, 8); g.stroke();
    g.setLineDash([]);
    g.fillStyle = 'rgba(238,243,252,.88)';
    g.fillText(gl1, glx + 14, y + gh / 2 + gfs * 0.36);
    /* ── 【＋】＝ここを増築する（作者指定 8/8）──
       下の階から順にしか積めないので、**次の1階にだけ**出す。
       上の階は枠だけ＝「まだ順番じゃない」が、押せないことで伝わる。
       置き場は**枠のまん中**（作者指定 8/9）＝名札が左に出たので、中央が空いた      */
    if (o.f === nextF) {
      /* ⚠ **屋上の大看板とぶつかる。** 大看板は「いちばん上の階の上」＝
         ちょうどこの枠の下辺に載るので、まん中に置くと看板が【＋】に重なる。
         看板があるときは、その上に空いている高さの中で真ん中に置き直す      */
      const roofOn = ((typeof yGaikan === 'function' ? yGaikan() : {}).roof != null)
                   && o.a.lvl === floors[floors.length - 1].a.lvl + 1;
      const band = roofOn ? Math.max(46, gh - 62) : gh;      // 使える縦幅
      const gs = Math.min(gh - 16, band - 8, 96);
      const r = { x: bx + bw / 2 - gs / 2, y: y + (band - gs) / 2, w: gs, h: gs, f: o.f };
      Y_ZOU_RECTS.push(r);
      const t3 = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
      const pl = 0.62 + Math.sin(t3 * 3) * 0.22;
      g.fillStyle = 'rgba(255,214,120,' + (pl * 0.22).toFixed(3) + ')';
      yRound(g, r.x, r.y, r.w, r.h, 8); g.fill();
      g.lineWidth = 3; g.strokeStyle = 'rgba(255,214,120,' + pl.toFixed(2) + ')';
      yRound(g, r.x, r.y, r.w, r.h, 8); g.stroke();
      g.textAlign = 'center'; g.font = 'bold 40px "DotGothic16",sans-serif';
      g.fillStyle = 'rgba(0,0,0,.5)';  g.fillText('＋', r.x + r.w / 2 + 1, r.y + r.h / 2 + 15);
      g.fillStyle = '#ffe6a8';         g.fillText('＋', r.x + r.w / 2, r.y + r.h / 2 + 14);
    }
  }
  g.setLineDash([]);

  /* ── 躯体 ── */
  const topY = yOf(floors[floors.length - 1].a.lvl - 1);
  g.fillStyle = Y_WALL; g.fillRect(bx, topY, bw, bottom - topY);
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(bx + bw - 26, topY, 26, bottom - topY);   // 右面の陰
  g.strokeStyle = '#241d17'; g.lineWidth = 6; g.strokeRect(bx + 3, topY + 3, bw - 6, bottom - topY - 6);

  /* ── 階ごとの帯（＝タップできる場所）── */
  guideRects = [];
  Y_WARN_RECTS = [];
  Y_SAY_SHOWN = new Set();          // 同じ台詞をビルの二か所に出さない（1フレームごとに空にする）
  Y_SAY_DRAW = [];
  for (const o of floors) {
    const y = yOf(o.a.lvl - 1), h = fh;
    guideRects.push({ x: bx, y, w: bw, h, f: o.f });

    // 床のスラブ（階の境目）
    g.fillStyle = Y_WALL_DK; g.fillRect(bx, y + h - 10, bw, 10);

    /* 窓。**いま何人いるか**で灯りの数が決まる＝中を描かずに、店の動きが見える */
    const cols = 5, ww = 62, wh = h - 52;
    const gap = (bw - 70 - cols * ww) / (cols - 1);
    /* **電気は全部屋つけっぱなし**（作者指定）。客の数で消灯させると、
       閑古鳥の日にビルが真っ暗になって、店が死んでいるように見える */
    const lit = cols;
    for (let i = 0; i < cols; i++) {
      /* **1階の真ん中は入口。** ここに窓を描くと、自動ドアの上にサッシが乗って
         「ドアの上に窓がある」おかしな外観になる（作者指摘）              */
      if (o.a.lvl === 1 && i === 2) continue;
      const wx = bx + 35 + i * (ww + gap), wy = y + 16;
      /* 灯りは点けっぱなしだが、**昼はそう見えない**（作者指定 8/8）。
         真昼に窓が煌々と光っていると、空だけ青くて絵は夜のまま、になる。
         昼はガラスの色に寄せて、暮れるにつれて灯りの色へ戻す              */
      const winOn = (typeof mixCol === 'function') ? mixCol('#cfe0ea', Y_WIN_ON, sk.night) : Y_WIN_ON;
      g.fillStyle = (i < lit) ? winOn : Y_WIN_OFF;
      g.fillRect(wx, wy, ww, wh);
      if (i < lit && sk.night > 0.05) {
        g.fillStyle = 'rgba(255,240,200,' + (0.22 * sk.night).toFixed(3) + ')';
        g.fillRect(wx - 6, wy - 4, ww + 12, wh + 8);
      }
      g.strokeStyle = '#2a231c'; g.lineWidth = 4; g.strokeRect(wx, wy, ww, wh);
      // サッシの十字
      g.strokeStyle = 'rgba(30,24,18,.6)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(wx, wy + wh / 2); g.lineTo(wx + ww, wy + wh / 2); g.stroke();
    }

    /* 階の名札（左のプレート）。**左の余白に必ず収まる**ように作る（作者指摘）。
       ①短い呼び名を使う（受付／男湯／女湯／ラウンジ…）
       ②その余白に入る大きさまで文字を縮める
       ③それでも溢れるなら札の左端を画面内で止める
       ―― これで階の名前が長くなっても、画面の外に切れて出ない          */
    g.textAlign = 'left';
    const label = o.a.lvl + 'F ' + (o.a.short || o.a.name.replace(/^\S+\s/, ''));
    const room = bx - 24;                        // 左に使える幅（ビルの左端まで）
    let fs = 26;
    g.font = 'bold ' + fs + 'px "DotGothic16",sans-serif';
    while (fs > 15 && g.measureText(label).width + 28 > room) {
      fs -= 2; g.font = 'bold ' + fs + 'px "DotGothic16",sans-serif';
    }
    const lw = Math.min(room, g.measureText(label).width + 28);
    const lx = Math.max(10, bx - 14 - lw);
    g.fillStyle = 'rgba(12,10,8,.8)'; yRound(g, lx, y + h / 2 - 26, lw, 52, 8); g.fill();
    g.fillStyle = '#f5ead8';
    g.fillText(label, lx + 14, y + h / 2 + fs * 0.36);

    /* **汚れ・人数・「いまここ」は出さない**（作者指定）。
       ここは外から見たビルの絵。中の事情は、階に入れば分かる。

       ⚠ **深夜の無人だけは例外**（作者指定 8/6）。
         深夜も全ての階が開くようにした（rules_y.js の yFloorOpenNow）ので、
         人を置かない階は客が入り放題のまま朝まで誰も拭かない。
         **それを知らずに朝を迎えるのが、いちばん理不尽**なので、
         決める前＝準備中から見えるところに出しておく。
         「今日の汚れ」ではなく「今夜どうなるか」の予告なので、時刻では出し分けない */
    g.textAlign = 'center';
    /* 出すのは**本当に無人のとき**と、**決める前（準備中の予告）**だけ。
       ⚠ 営業中の日中にも出していたときは、まだ人が立っている18時の画面に
         「スタッフがいません」と貼り出していた＝**嘘の警告**だった。
         大きい警告ほど、間違って出ていると何の意味も無くなる               */
    let warned = false;
    const nightNow = (typeof yIsNight === 'function') && yIsNight();
    const forecast = G.phase === 'prep';
    if ((nightNow || forecast) && G.opts && G.opts.nightOpen && o.f !== AY.FRONT
        && typeof yNightStaffOn === 'function' && !yNightStaffOn(o.f)) {
      /* **警告はデカくないと警告じゃない**（作者指定 8/6）。
         階の名札の脇に小さく添えていたが、それでは見落とす。
         **真ん中の窓3つを覆い尽くす帯**にして、ビルの上に直に貼る            */
      const x0 = bx + 35 + 1 * (ww + gap);                 // 左から2つ目の窓
      const x1 = bx + 35 + 3 * (ww + gap) + ww;            // 左から4つ目の窓の右端
      /* **声の場所をあけるために、警告は上へ寄せる。**
         階の帯は106px。警告46＋声38＋隙間 で、ぎりぎり1つぶんだけ入る */
      const bh3 = 46, by3 = y + h / 2 - bh3 + 2;
      Y_WARN_RECTS.push({ x: x0, y: by3, w: x1 - x0, h: bh3, f: o.f });   // 押したら【👥 バイト】へ
      g.fillStyle = 'rgba(150,36,32,.94)'; yRound(g, x0, by3, x1 - x0, bh3, 6); g.fill();
      g.strokeStyle = '#ff9a86'; g.lineWidth = 3; yRound(g, x0, by3, x1 - x0, bh3, 6); g.stroke();
      const wt = '⚠ スタッフがいません';
      let ws = 26;
      g.font = 'bold ' + ws + 'px "DotGothic16",sans-serif';
      while (ws > 14 && g.measureText(wt).width > (x1 - x0) - 20) {
        ws -= 2; g.font = 'bold ' + ws + 'px "DotGothic16",sans-serif';
      }
      g.fillStyle = '#ffe6de';
      g.fillText(wt, (x0 + x1) / 2, by3 + bh3 / 2 + ws * 0.36);
      warned = true;
    }
    /* ⚠️ 入場制限中（作者指定 8/8）。
       1階＝靴箱が埋まった／浴室階＝その階の脱衣ロッカーが埋まった。
       スタッフ不在の警告と場所を取り合うので、そちらが出ていない階だけ。
       押し先はバイトではなく**その階の中**（＝器を増やしに行く）ので、
       当たり判定は足さない＝帯をタップすればいつもどおり階に入る          */
    else if (o.f !== AY.FRONT && typeof yEntryLimited === 'function' && yEntryLimited(o.f)) {
      /* 1階（＝靴箱が満杯）はここには出さない。**ビルの上に大きく出している**し、
         1階の帯は入口の庇と重なって字が欠ける                              */
      const x0 = bx + 35 + 1 * (ww + gap);
      const x1 = bx + 35 + 3 * (ww + gap) + ww;
      const bh3 = 46, by3 = y + h / 2 - bh3 + 2;
      g.fillStyle = 'rgba(150,96,20,.94)'; yRound(g, x0, by3, x1 - x0, bh3, 6); g.fill();
      g.strokeStyle = '#ffcf7a'; g.lineWidth = 3; yRound(g, x0, by3, x1 - x0, bh3, 6); g.stroke();
      const wt = '⚠️ 入場制限中';
      let ws = 26;
      g.font = 'bold ' + ws + 'px "DotGothic16",sans-serif';
      while (ws > 14 && g.measureText(wt).width > (x1 - x0) - 20) {
        ws -= 2; g.font = 'bold ' + ws + 'px "DotGothic16",sans-serif';
      }
      g.fillStyle = '#fff0d6';
      g.fillText(wt, (x0 + x1) / 2, by3 + bh3 / 2 + ws * 0.36);
      warned = true;
    }

    /* **中に人がいるのを、外から感じさせる**（作者指定 8/6）。
       窓の灯りは「何人いるか」しか言わないので、ここで初めて**誰かが居る**になる。
       ⚠ の帯と同じ場所を使うので、警告が出ている階には出さない（`warned`） */
    yDrawGuideSay(g, o.f, bx, bw, y, h, warned);
  }

  /* ── エレベーターのシャフト（右端の一本）──
     階段区画は廃止し、**各階の右下2×2のエレベーター1基**で全部つないでいる。
     外観では、その井戸を右端の縦線として描く＝乗っている客がいれば箱が光る。
     ここはタップしても中へは入らない（階の帯をタップして入る）             */
  {
    const sx = bx + bw - 22, sw = 18;
    g.fillStyle = '#1d2630'; g.fillRect(sx, topY, sw, bottom - topY);
    const riding = (G.customers || []).filter(c => c.yRide > 0);
    const car = riding.length ? riding[0] : null;
    const carA = (CONF.areas || [])[car ? (car.f | 0) : 0] || floors[0].a;
    g.fillStyle = car ? Y_WIN_ON : '#3a4652';
    g.fillRect(sx + 2, yOf((carA.lvl || 1) - 1) + fh / 2 - 18, sw - 4, 36);
    // 壊れている階があれば、シャフトに赤いしるし（外からでも異常が分かる）
    for (const o of floors) {
      const e = (G.equip || []).find(q => q.id === 'y_elev' && (q.f | 0) === o.f);
      if (e && e.cond <= 0) {
        g.fillStyle = '#c04040';
        g.fillRect(sx - 2, yOf(o.a.lvl - 1) + fh / 2 - 6, sw + 4, 12);
      }
    }
  }

  /* ── 時間の進み（この画面はフレームごとに描き直される）── */
  const now = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
  const dtRaw = (Y_WALK_T && now - Y_WALK_T < 0.5) ? (now - Y_WALK_T) : 0.016;
  Y_WALK_T = now;
  const dt = G.paused ? 0 : dtRaw;
  yWalkerSync();
  if (typeof yKouji === 'function' && yKouji()) yKoujiSound(dtRaw);   // 工事の音（ガンガン／キューン）
  /* **自動ドアは、人が近づくと開く。**（作者指定）
     入る客も、帰る客も、開いた戸をくぐって出入りする。
     誰も居なければ、ゆっくり閉まる                                      */
  const doorCx = bx + bw / 2;
  const near = Y_WALKERS.some(w => w.kind !== 'pass' && Math.abs(w.x - doorCx) < 90);
  Y_DOOR_OPEN += ((near ? 1 : 0) - Y_DOOR_OPEN) * Math.min(1, dtRaw * 6);

  /* ── 1階の入口 ──────────────────────────────
     **地面（＝歩行者が歩く線）にぴったり立たせる。**
     以前は入口の下に「こぼれた灯り」の帯を敷いていたので、
     段差の中にドアが刺さっているように見えていた（作者指摘）。
     いまは灯りを**歩道の上に平たく**落とし、ドアそのものは地面で終わる。
     上には窓ではなく庇（ひさし）を出す                                  */
  const gy = bottom - fh;
  const cx = bx + bw / 2, dW = 132, dH = 96;
  // 灯りは歩道の上に落ちる（ドアの下ではなく、ドアの手前の床）
  g.fillStyle = 'rgba(255,220,150,.16)';
  g.beginPath(); g.moveTo(cx - dW / 2, bottom); g.lineTo(cx + dW / 2, bottom);
  g.lineTo(cx + dW / 2 + 40, bottom + 44); g.lineTo(cx - dW / 2 - 40, bottom + 44); g.closePath(); g.fill();
  // 枠
  g.fillStyle = '#241d17'; g.fillRect(cx - dW / 2, bottom - dH, dW, dH);
  // 開いた先＝店の中（灯りが漏れる）
  g.fillStyle = '#3a2b1f'; g.fillRect(cx - dW / 2 + 9, bottom - dH + 9, dW - 18, dH - 9);
  g.fillStyle = 'rgba(255,220,150,' + (0.20 + Y_DOOR_OPEN * 0.35) + ')';
  g.fillRect(cx - dW / 2 + 9, bottom - dH + 9, dW - 18, dH - 9);
  /* 両開きのガラス戸。Y_DOOR_OPEN のぶんだけ左右へ引き込まれる */
  const half = dW / 2 - 9, slide = half * 0.92 * Y_DOOR_OPEN;
  g.fillStyle = '#8ec7e0';
  g.fillRect(cx - dW / 2 + 9 - slide, bottom - dH + 9, half, dH - 9);   // 左の戸
  g.fillRect(cx + slide, bottom - dH + 9, half, dH - 9);                // 右の戸
  g.strokeStyle = '#241d17'; g.lineWidth = 4;
  g.strokeRect(cx - dW / 2 + 9 - slide, bottom - dH + 9, half, dH - 9);
  g.strokeRect(cx + slide, bottom - dH + 9, half, dH - 9);
  // 床のレール
  g.fillStyle = '#1a1511'; g.fillRect(cx - dW / 2 - 6, bottom - 6, dW + 12, 6);
  // 庇（ひさし）＝ドアの上。ここに窓は無い
  g.fillStyle = '#3a2f26'; g.fillRect(cx - dW / 2 - 16, bottom - dH - 18, dW + 32, 18);
  g.fillStyle = '#5a4636'; g.fillRect(cx - dW / 2 - 16, bottom - dH - 18, dW + 32, 6);

  /* ── お断りの札（作者指定 8/10）───────────────────────────
     運営メニューで掲げたものを、**入口の右手の壁**に貼り出す。
     ・刺青・ヤクザお断り（banYakuza）
     ・子供不可（banKids＝小学生以下お断り）
     **両方オンでも重ならない。** 右端に揃えて下から積む＝
     1枚だけのときは必ず同じ位置（いちばん下）に出るので、増えた時に気づける */
  {
    const plates = [];
    if (G.opts && G.opts.banYakuza) plates.push(['刺青・ヤクザ', 'お断り']);
    if (G.opts && G.opts.banKids)   plates.push(['子供不可']);
    const pw = 118, gap = 8, fs = 15;
    // 入口の右端より右、ビルの右端より内側に収める
    const px = Math.max(cx + dW / 2 + 10, bx + bw - 14 - pw);
    let py = bottom - 26;                                    // いちばん下の札の下辺
    for (const rows of plates) {
      const ph = 14 + rows.length * 19;
      const top = py - ph;
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(px + 3, top + 4, pw, ph);   // 影
      g.fillStyle = '#f2ead8'; g.fillRect(px, top, pw, ph);                   // 白い掲示板
      g.strokeStyle = '#a33028'; g.lineWidth = 3; g.strokeRect(px + 2, top + 2, pw - 4, ph - 4);
      g.fillStyle = '#a33028'; g.font = 'bold ' + fs + 'px "DotGothic16",sans-serif'; g.textAlign = 'center';
      rows.forEach((t, i) => g.fillText(t, px + pw / 2, top + 22 + i * 19));
      py = top - gap;                                        // 次の札は、この上に積む
    }
  }
  /* ── 看板は「買った物」だけ出す（作者指定）──────────────
     開業時は看板ゼロ＝通りから見ると、ただの古いビル。
     【🪧 外観】で買い、**付ける階も自分で選ぶ**（壁の看板は2階以上だけ）。
     どれも集客に効く（rules_y.js の yGuestAdjust）                        */
  /* 看板の文字は**自分で決めた屋号**（作者決定 8/8 → 8/9 に変更）。
     せっかく名前を決めたのに通りの看板が「SAUNA」では、自分の店に見えない。
     入力は10文字までなので（index.html の nameInput maxlength）、
     **10文字でも崩れない**ように、袖看板も屋上の大看板も寸法を字数から割り出す。
     ⚠ 「SAUNA」に戻すなら、この1行を 'SAUNA' に書き換えるだけでいい        */
  const sign = ySignText();
  const owned = (typeof yGaikan === 'function') ? yGaikan() : {};

  /* 壁に付ける袖看板。選んだ階の横に出る＝増築して付け替えれば、看板も上がる */
  const drawSode = (f, neon) => {
    const a = (CONF.areas || [])[f]; if (!a || a.lvl < 2) return;
    const fy = yOf(a.lvl - 1);
    const sgX = bx + bw + 14, sgTop = fy + 10;
    /* 一文字ぶんの高さ。**箱の高さから割り出す**（作者指摘 8/8）。
       ⚠ 以前はここに `Math.max(26, …)` の下限があった。箱は上限で頭打ちなのに
         字の送りは 26 で止まるので、**7文字あたりから字だけが箱の下へこぼれ**、
         屋号10文字なら 102px もはみ出していた（既定の「夕凪湯」ですら 22px）。
       下限をやめて、必ず 26 + 文字数 × chH が箱に収まるようにする。

       屋号を出すようにした（8/9）ので、**箱の高さも字数で伸ばす**。
       5文字までは1階ぶん強（＝これまでの見た目のまま）、それより長い屋号は
       下へ垂らす＝袖看板は本来2〜3階ぶん垂らすものなので、絵として不自然でない。
       ただし歩道より下へは出さない（bottom で止める）                      */
    const sgN = Math.max(1, sign.length);
    const base = fh * 1.3;                                   // 5文字までの箱（従来どおり）
    const room = Math.max(base, bottom - sgTop - 12);        // 歩道までの余白
    const avail = Math.min(room, base + Math.max(0, sgN - 5) * 30);
    const chH = Math.max(12, Math.min(42, (avail - 26) / sgN));
    const sgH = 26 + sgN * chH;
    if (neon) {   // ネオンは光を纏う（夜の通りで目を引く）
      g.fillStyle = 'rgba(255,120,90,.22)';
      g.fillRect(sgX - 14, sgTop - 12, 92, sgH + 24);
    }
    g.fillStyle = neon ? '#c2265a' : '#b4442f'; yRound(g, sgX, sgTop, 64, sgH, 6); g.fill();
    g.strokeStyle = neon ? '#ffd0e0' : '#e9c48a'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#3a2f26'; g.fillRect(bx + bw - 2, sgTop + 12, 18, 8);   // 壁から出た腕
    g.fillStyle = neon ? '#fff2f6' : '#ffeccd';
    g.font = 'bold ' + Math.round(chH * 0.82) + 'px "DotGothic16",sans-serif'; g.textAlign = 'center';
    for (let i = 0; i < sign.length; i++) g.fillText(sign[i], sgX + 32, sgTop + 20 + chH * 0.85 + i * chH);
  };
  if (owned.sode != null) drawSode(owned.sode, false);
  if (owned.neon != null) drawSode(owned.neon, true);

  /* ── 看板の置き場（場所を選んでいる間だけ・作者指定 8/8）──────────
     フロア画面で設備を置くときと同じ手つきで、**ビルの右側面**をタップして決める。
     ⚠ **左側面には出さない。** 階の名札（「2F 男湯」）がビルの左に並ぶので、
       左に置き場を出すと必ず字が重なる（作者指摘）。
     いま付いている階には印を付けて、付け替えなのが分かるようにする       */
  /* ⚠ **置き場は常に出す**（作者指定 8/8）。以前は「場所を選んでいる間だけ」出していたが、
     外観メニューを畳んだので、**ここが看板を出す唯一の入口**になった。
     ・何も付いていない階 …… 【＋ 看板】（未建設の階の【＋】と同じ手つき）
     ・選んでいる最中     …… これまでどおり光らせて、いま付いている階に「いまここ」  */
  Y_SIGN_RECTS = [];
  {
    const placing = (typeof ySignPlacing === 'function') && ySignPlacing();
    const own = (typeof yGaikan === 'function') ? yGaikan() : {};
    const cur = placing ? own[placing] : null;
    const t2 = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
    const pulse = 0.55 + Math.sin(t2 * 4) * 0.25;
    // その階に袖看板かネオンが付いているか（付いている階には【＋】を出さない）
    const taken = new Set();
    for (const k of ['sode', 'neon']) if (typeof own[k] === 'number') taken.add(own[k]);
    for (const o of floors) {
      if (o.a.lvl < 2) continue;                       // 1階は地面に刺さるので出さない
      const y = yOf(o.a.lvl - 1);
      const r = { x: bx + bw + 8, y: y + 8, w: 76, h: fh - 16, f: o.f };
      const on = placing && (typeof cur === 'number') && cur === o.f;
      if (!placing && taken.has(o.f)) continue;        // もう看板が出ている階は、そのまま見せる
      Y_SIGN_RECTS.push(r);
      g.setLineDash([8, 6]); g.lineWidth = 3;
      const a1 = placing ? pulse : 0.30;               // 選んでいない間は控えめに
      g.fillStyle = on ? 'rgba(255,190,90,.26)' : 'rgba(255,240,200,' + (a1 * 0.20).toFixed(3) + ')';
      yRound(g, r.x, r.y, r.w, r.h, 8); g.fill();
      g.strokeStyle = on ? '#ffd98a' : 'rgba(255,240,200,' + a1.toFixed(2) + ')';
      yRound(g, r.x, r.y, r.w, r.h, 8); g.stroke();
      g.setLineDash([]);
      g.fillStyle = placing ? '#fff3d8' : 'rgba(255,243,216,.78)';
      g.textAlign = 'center';
      if (placing) {
        g.font = 'bold 22px "DotGothic16",sans-serif';
        g.fillText(on ? 'いまここ' : o.a.lvl + 'F', r.x + r.w / 2, r.y + r.h / 2 + 8);
      } else {
        g.font = 'bold 26px "DotGothic16",sans-serif';
        g.fillText('＋', r.x + r.w / 2, r.y + r.h / 2 - 4);
        g.font = 'bold 15px "DotGothic16",sans-serif';
        g.fillText('看板', r.x + r.w / 2, r.y + r.h / 2 + 20);
      }
    }
  }

  /* 屋上の大看板。いちばん上の階の上に載る */
  if (owned.roof != null) {
    /* ⚠ 幅180・字34px の**決め打ち**だった（作者指摘 8/8）。屋号は10文字まで入るので、
       既定の「俺のサウナ」で 65px、10文字なら 235px＝**箱の倍以上**はみ出していた。
       まず字を縮め、それでも足りなければ**看板そのものを広げる**（上限あり）。
       ＝短い屋号のときの見た目は、これまでとほとんど変わらない              */
    const label = '♨ ' + sign;
    const maxW = Math.max(180, Math.min(bw + 40, 440));       // 屋上に載せられる幅の上限
    let fs = 34;
    g.font = 'bold ' + fs + 'px "DotGothic16",sans-serif';
    while (fs > 16 && g.measureText(label).width + 28 > maxW) {
      fs -= 2; g.font = 'bold ' + fs + 'px "DotGothic16",sans-serif';
    }
    const sw = Math.max(180, Math.min(maxW, g.measureText(label).width + 28));
    const sx = bx + bw / 2 - sw / 2, sy = topY - 54;
    g.fillStyle = '#241d17'; g.fillRect(sx, sy, sw, 50);
    g.strokeStyle = '#6a5642'; g.lineWidth = 4; g.strokeRect(sx, sy, sw, 50);
    g.fillStyle = '#3a2f26';                                   // 屋上に載せる脚
    g.fillRect(bx + bw / 2 - 70, topY - 8, 10, 10); g.fillRect(bx + bw / 2 + 60, topY - 8, 10, 10);
    g.fillStyle = '#ffd98a'; g.textAlign = 'center';
    g.fillText(label, bx + bw / 2, sy + 25 + fs * 0.36);
  }

  /* ⚠️ 店ぜんぶの入場制限（作者指定 8/8）＝**靴箱がいっぱい。**
     階ごとの札とは別に、**ビルの上に大きく**貼る。
     これが出ている間は、通りに来た客がひとりも入れていない＝
     いちばん高くつく取り逃がしなので、いちばん大きく出す                */
  if (typeof yEntryLimited === 'function' && yEntryLimited(AY.FRONT)) {
    const bw2 = Math.min(bw + 60, 420), bx2 = bx + bw / 2 - bw2 / 2;
    const by2 = topY - (owned.roof != null ? 118 : 62), bh2 = 52;
    g.fillStyle = 'rgba(160,88,16,.95)'; yRound(g, bx2, by2, bw2, bh2, 8); g.fill();
    g.strokeStyle = '#ffcf7a'; g.lineWidth = 4; yRound(g, bx2, by2, bw2, bh2, 8); g.stroke();
    g.fillStyle = '#fff2dc'; g.textAlign = 'center';
    g.font = 'bold 30px "DotGothic16",sans-serif';
    g.fillText('⚠️ 入場制限中', bx + bw / 2, by2 + 36);
  }

  /* ── 通りを歩く人を描く（看板や入口より手前＝建物の前を歩いている）── */
  yDrawWalkers(g, dt, streetY, bx + bw / 2);

  /* ── 下の帯＝ととのい番付 ──────────────────────────
     ⚠この「知るまで出さない」設計は廃止済み（battleKnown常時true・作者決定 8/8）＝
     大会は冒頭のイントロで既知。下の分岐は常に通る。
     知った日（G.ch2.battleKnown）から、この帯が出るようになる           */
  if (G.ch2 && G.ch2.battleKnown) {
    g.fillStyle = 'rgba(12,10,8,.82)'; g.fillRect(0, H - 74, W, 74);
    let rankTxt = 'ととのい番付 ―';
    try {
      if (typeof yRanking === 'function') {
        const rows = yRanking(), me = rows.find(r => r.mine), gap = yGapToBoss();
        rankTxt = 'ととのい番付 ' + me.rank + '位 / ' + rows.length + '軒　　合計 ' + me.total + '点'
                + (gap.gap > 0 ? '　　1位まで あと ' + gap.gap + '点' : '　　いま1位に立っている');
      }
    } catch (e) { /* 大会の計算がまだ動かない段階でも、絵は出す */ }
    g.fillStyle = '#f5ead8'; g.font = 'bold 28px "DotGothic16",sans-serif'; g.textAlign = 'center';
    g.fillText(rankTxt, W / 2, H - 28);
  }
  /* **声はいちばん最後。**入口の自動ドアも庇も看板も、みんな上から越えていく */
  yFlushGuideSay(g);
  return true;                                   // ここで描き切った＝間取り図は描かない
}

/* ============ 1Fの入口マット ============
   下の壁1行は表示から削った（CONF_Y.cropBottomWall・作者指定 8/10）ので、
   入口の自動ドアの絵は画面の外になった。かわりに**見えている最下列の中央マス**
   （entrance の1つ上）を玄関マットの色に変えて「▼入口」と書く＝
   客はこのマスから湧いて入ってくるように見える。
   外への入口が下壁にある階＝1Fだけ描く（上の階の entrance はEVの前） */
function yDrawEntryTile() {
  if (!CONF.cropBottomWall) return;
  const e = CONF.entrance;
  if (!e || e.y !== CONF.H - 1) return;
  /* 1マス（作者指定 8/10・えんじ色の3マスマットは廃止）。
     見た目は**下の壁があった頃の入口（drawBottomDoor）をそのまま**＝
     茶色い板張りの開口部＋左右の木枠＋敷居。文字は白ではみ出さない大きさに */
  const c = ctx, x = e.x * T, y = (e.y - 1) * T;
  c.fillStyle = '#7d6647';                                   // 向こう側＝廊下の床
  c.fillRect(x, y, T, T);
  c.strokeStyle = 'rgba(0,0,0,.10)'; c.lineWidth = 1;
  for (let ly = y + 6; ly < y + T; ly += 10) { c.beginPath(); c.moveTo(x, ly + .5); c.lineTo(x + T, ly + .5); c.stroke(); }
  c.fillStyle = '#4a3528';                                   // 木枠
  c.fillRect(x - 3, y, 4, T); c.fillRect(x + T - 1, y, 4, T);
  c.fillStyle = '#8a6a3a';                                   // 敷居（外へ出る側＝下端）
  c.fillRect(x + 1, y + T - 4, T - 2, 4);
  const s = CONF.bubScale || 1;
  c.fillStyle = '#fff'; c.font = 'bold ' + Math.round(9 * s) + 'px "DotGothic16",sans-serif';
  c.textAlign = 'center';
  c.fillText('▼入口', x + T / 2, y + T / 2 + 4 * s);
}

registerChapter2Hooks({ drawGuide: yDrawGuide, guideTap: yGuideTap, drawEntryTile: yDrawEntryTile });

/* ============ エレベーターの絵（各階の右下 2×2）============
   **扉は左側の面**（作者指定）＝客は左のマスに立って待ち、そこから乗り降りする。
   上から見下ろした絵なので、左の辺に沿って上下に開く2枚の扉を描く。          */
/* ============ 洗い場まわり（第1章に同じ物が無いので、ここで描く）============
   ・小／中／大カラン … **人数ぶんの席を並べる**（3人・6人・9人）。
                        鏡・カラン・桶・腰掛けを1組＝1人ぶんとして、cap の数だけ描く
   ・かけ湯      … 浴室の入口に置く小さな湯だめ（柄杓が一本）
   ・垢すり台    … 2×2の寝台。タオルを敷いた台に、湯桶が添えてある            */
const WASH_IDS_Y = ['y_wash', 'y_wash3', 'y_wash5', 'y_wash9'];
function yWash5Art(c2, it, def, x, y, w, h, rt, broken) {
  if (WASH_IDS_Y.indexOf(it.id) >= 0) {
    const n = Math.max(1, def.cap || 1), slot = w / n;
    c2.fillStyle = '#dcdcd4'; c2.fillRect(x + 1, y + 2, w - 2, h - 4);      // タイルの壁面
    for (let i = 0; i < n; i++) {
      const sx = x + i * slot;
      c2.fillStyle = '#bfe3f2'; c2.fillRect(sx + 2, y + 4, slot - 4, 7);    // 鏡
      c2.fillStyle = 'rgba(255,255,255,.45)'; c2.fillRect(sx + 3, y + 5, slot - 6, 2);
      c2.fillStyle = '#9a9a9a'; c2.fillRect(sx + slot / 2 - 1.5, y + 12, 3, 5);   // カラン
      c2.fillStyle = '#c7cdd2'; c2.fillRect(sx + slot / 2 - 3, y + 12, 6, 2);     // 混合栓
      c2.fillStyle = '#e8c84a'; c2.fillRect(sx + 2, y + h - 9, slot - 8, 5);      // 桶
      c2.fillStyle = '#e86a5a'; c2.fillRect(sx + slot - 6, y + h - 9, 4, 5);      // 腰掛け
    }
    c2.strokeStyle = 'rgba(0,0,0,.18)'; c2.lineWidth = 1;                   // 仕切り
    for (let i = 1; i < n; i++) {
      c2.beginPath(); c2.moveTo(x + i * slot, y + 3); c2.lineTo(x + i * slot, y + h - 3); c2.stroke();
    }
    return true;
  }
  /* ロッカーは**扉の数＝収まる人数**（小6・中12・大24）。
     見た目と数字が食い違うと、どれを買えばいいのか分からなくなる            */
  if (it.id === 'y_locker' || it.id === 'y_locker12' || it.id === 'y_locker24') {
    const lock = def.lock || 6;
    const rows = lock >= 24 ? 3 : 2, cols = Math.round(lock / rows);
    c2.fillStyle = broken ? '#8a6a48' : lock >= 24 ? '#6e7f96' : lock >= 12 ? '#7f8fa6' : '#c98f4e';
    c2.fillRect(x + 1, y + 1, w - 2, h - 2);
    c2.strokeStyle = 'rgba(0,0,0,.35)'; c2.lineWidth = 1;
    for (let i = 1; i < cols; i++) {
      c2.beginPath(); c2.moveTo(x + i * (w / cols), y + 2); c2.lineTo(x + i * (w / cols), y + h - 2); c2.stroke();
    }
    for (let j = 1; j < rows; j++) {
      c2.beginPath(); c2.moveTo(x + 2, y + j * (h / rows)); c2.lineTo(x + w - 2, y + j * (h / rows)); c2.stroke();
    }
    c2.fillStyle = 'rgba(255,255,255,.5)';                                  // 扉の取っ手
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      c2.fillRect(x + i * (w / cols) + w / cols - 4, y + 4 + j * (h / rows), 2, Math.min(4, h / rows - 4));
    }
    return true;
  }
  if (it.id === 'y_kakeyu') {                                              // かけ湯
    c2.fillStyle = '#8a8578'; c2.fillRect(x + 2, y + 6, w - 4, h - 9);      // 石の湯だめ
    c2.fillStyle = broken ? '#4a4a44' : '#79b8cc'; c2.fillRect(x + 4, y + 8, w - 8, h - 13);
    if (!broken) { c2.fillStyle = 'rgba(255,255,255,.35)'; c2.fillRect(x + 5, y + 9, w - 10, 2); }
    c2.fillStyle = '#a9743f'; c2.fillRect(x + w - 8, y + 4, 2, 9);          // 柄杓の柄
    c2.fillStyle = '#c98f4e'; c2.fillRect(x + w - 10, y + 12, 6, 3);
    return true;
  }
  if (it.id === 'y_akasuri') {                                             // 垢すり台
    c2.fillStyle = '#6f7a80'; c2.fillRect(x + 3, y + 4, w - 6, h - 8);      // 台
    c2.fillStyle = '#eef2f4'; c2.fillRect(x + 5, y + 6, w - 10, h - 12);    // 敷いたタオル
    c2.fillStyle = '#d7dee2'; c2.fillRect(x + 7, y + 8, w - 14, 4);         // 枕
    c2.fillStyle = '#e8c84a'; c2.fillRect(x + w - 12, y + h - 12, 7, 6);    // 湯桶
    c2.strokeStyle = 'rgba(0,0,0,.2)'; c2.lineWidth = 1;
    c2.strokeRect(x + 3.5, y + 4.5, w - 7, h - 9);
    return true;
  }
  /* ── ととのいの椅子（作者から実物の写真をもらって描いた・8/8）──────
     第1章の椅子の絵を借りていたが、**借り物では特徴が消えてどれも同じ四角**
     になるうえ、1マスぶんしか描かないので2マス以上の台は下半分が空く。
     ここから下は、写真のあるものを1つずつ自前で描いている                */
  /* フルフラットベッド（作者から実物の写真・8/8）。**1台＝ひとり用。**
     木の台にベージュのマットを敷き、頭側に低い木の衝立、そこに丸めた枕。
     並べるかどうかはプレイヤーが決める（作者決定 8/8）                    */
  if (it.id === 'y_chair_flat') {
    c2.fillStyle = 'rgba(0,0,0,.18)'; c2.fillRect(x + 4, y + h - 4, w - 8, 2);       // 影
    c2.fillStyle = '#6d5637'; c2.fillRect(x + 2, y + 3, w - 4, h - 6);               // 木の台
    c2.fillStyle = '#8a6b41'; c2.fillRect(x + 3, y + 4, w - 6, 6);                   // 頭側の衝立
    c2.fillStyle = 'rgba(255,255,255,.12)'; c2.fillRect(x + 3, y + 4, w - 6, 1);
    c2.fillStyle = 'rgba(0,0,0,.24)'; c2.fillRect(x + 3, y + 10, w - 6, 1);          // 衝立の影
    c2.fillStyle = '#b9b3a6'; c2.fillRect(x + 4, y + 11, w - 8, h - 17);             // マット
    c2.fillStyle = 'rgba(255,255,255,.14)'; c2.fillRect(x + 4, y + 12, w - 8, 1);
    c2.fillStyle = '#4a3b2a'; c2.fillRect(x + 5, y + 12, w - 10, 3);                 // 丸めた枕
    c2.strokeStyle = 'rgba(0,0,0,.25)'; c2.lineWidth = 1;
    c2.strokeRect(x + 2.5, y + 3.5, w - 5, h - 7);
    return true;
  }
  /* アディロンダックチェア（作者から実物の写真・8/8）。
     樹脂の椅子。**扇形に広がった背もたれに縦のスラット**、そして**幅広の肘掛け**。
     この2つが無いと、ただの椅子になってしまう。
     色は赤（ととのいイス＝白／インフィニティ＝黒枠とベージュ、と見分けるため） */
  if (it.id === 'y_chair_ado') {
    const R = '#b8382f', R2 = '#d1544a', R3 = '#8e2a23';
    c2.fillStyle = 'rgba(0,0,0,.16)'; c2.fillRect(x + 5, y + h - 5, w - 10, 2);   // 影
    // 扇形の背もたれ（上へ広がる）
    c2.fillStyle = R;
    c2.beginPath();
    c2.moveTo(x + 7, y + h * 0.52); c2.lineTo(x + w - 7, y + h * 0.52);
    c2.lineTo(x + w - 4, y + 4);    c2.lineTo(x + 4, y + 4);
    c2.closePath(); c2.fill();
    c2.fillStyle = R3;                                                            // 背もたれの縦スラット
    for (let i = 1; i < 5; i++) {
      const px = x + 5 + (w - 10) * (i / 5);
      c2.fillRect(px - 0.5, y + 5, 1, h * 0.52 - 7);
    }
    c2.fillStyle = R2;                                                            // 幅広の肘掛け
    c2.fillRect(x + 2, y + h * 0.46, 5, h * 0.34);
    c2.fillRect(x + w - 7, y + h * 0.46, 5, h * 0.34);
    c2.fillStyle = R;                                                             // 座面
    c2.fillRect(x + 6, y + h * 0.5, w - 12, h * 0.34);
    c2.fillStyle = R3;                                                            // 座面のスラット
    for (let i = 0; i < 3; i++) c2.fillRect(x + 7, y + h * 0.56 + i * 3, w - 14, 1);
    return true;
  }
  /* インフィニティチェア（作者から実物の写真・8/8）。
     **黒いパイプの枠に、ベージュのメッシュを紐で編み込んである。**
     頭のところに枕、左右に黒い肘掛け。第1章の `chair_inf`（銀フレーム＋濃い座面）
     とは見た目がまるで違うので、借りずにここで描く                        */
  if (it.id === 'y_chair_inf') {
    const FR = '#26262a', MESH = '#c3ab8a', MESH2 = '#ad9573', PIL = '#d8c6a8';
    c2.fillStyle = 'rgba(0,0,0,.16)'; c2.fillRect(x + 5, y + h - 4, w - 10, 2);   // 影
    c2.fillStyle = FR; c2.fillRect(x + 4, y + 3, w - 8, h - 7);                   // 黒いパイプ枠
    c2.fillStyle = MESH; c2.fillRect(x + 7, y + 6, w - 14, h - 12);               // メッシュ
    c2.fillStyle = MESH2;                                                          // 編み目
    for (let i = 1; i < 5; i++) c2.fillRect(x + 7, y + 6 + (h - 12) * (i / 5), w - 14, 1);
    c2.fillStyle = PIL; c2.fillRect(x + 8, y + 5, w - 16, 4);                     // 頭の枕
    c2.fillStyle = FR;                                                             // 肘掛け（左右）
    c2.fillRect(x + 2, y + h * 0.42, 4, h * 0.2);
    c2.fillRect(x + w - 6, y + h * 0.42, 4, h * 0.2);
    return true;
  }
  /* リクライニングチェア（作者から実物の写真・8/8）。
     白い樹脂のS字ラウンジャー。**肘掛けは無い。**
     頭側がやや狭く足側が広い一枚板で、全面に**細かい横スラット**が走る       */
  if (it.id === 'y_chair_rec') {
    const W1 = '#f2f2ee', W2 = '#cfcfc4', W3 = '#a9a99e';
    c2.fillStyle = 'rgba(0,0,0,.16)'; c2.fillRect(x + 5, y + h - 5, w - 10, 3);   // 影
    const top = y + 4, bot = y + h - 7;
    const path = () => {
      c2.beginPath();
      c2.moveTo(x + 7, top); c2.lineTo(x + w - 7, top);
      c2.lineTo(x + w - 4, bot); c2.lineTo(x + 4, bot);
      c2.closePath();
    };
    c2.fillStyle = W1; path(); c2.fill();
    c2.strokeStyle = W3; c2.lineWidth = 1; path(); c2.stroke();
    c2.fillStyle = W2;                                                            // 細かい横スラット
    for (let sy = top + 3; sy < bot - 1; sy += 4) {
      const t = (sy - top) / Math.max(1, bot - top);
      const ix = 7 - 3 * t;
      c2.fillRect(x + ix, sy, w - ix * 2, 1);
    }
    return true;
  }
  /* 雲のごろ寝マット（ブレインスリープの写真から・8/8）。**1台＝ひとり用。**
     淡い水色の床に、白いフォームのマットを一枚。頭に同じ白の枕。
     枠も脚も無い＝畳の台（黒い石＋木の仕切り）とは正反対の軽さで描く       */
  if (it.id === 'y_chair_cloud') {
    c2.fillStyle = '#dff0fa'; c2.fillRect(x + 1, y + 2, w - 2, h - 4);               // 淡い水色の床
    c2.fillStyle = 'rgba(120,170,200,.16)'; c2.fillRect(x + 3, y + h - 5, w - 6, 2); // 薄い影
    c2.fillStyle = '#f6fafc'; c2.fillRect(x + 3, y + 4, w - 6, h - 9);               // マット本体
    c2.fillStyle = '#e4eef4'; c2.fillRect(x + 3, y + h - 6, w - 6, 1);               // 厚みの縁
    c2.fillStyle = 'rgba(180,205,220,.55)';                                          // フォームの粒
    for (let k = 0; k < 10; k++) {
      const px = x + 4 + ((k * 7) % Math.max(1, w - 8));
      const py = y + 6 + ((k * 5) % Math.max(1, h - 14));
      c2.fillRect(px, py, 1, 1);
    }
    c2.fillStyle = '#ffffff'; c2.fillRect(x + 4, y + 5, w - 8, 5);                   // 頭の枕
    c2.fillStyle = 'rgba(150,190,215,.45)'; c2.fillRect(x + 4, y + 10, w - 8, 1);
    return true;
  }
  /* 畳の寝ころび台（サウナ東京の「休憩」の写真から・8/8）。**1台＝ひとり用。**
     黒い石の台に畳が一枚。**脇に濃い木の仕切り板**が立つ＝隣に並べると、
     板が仕切りになって一人ぶんずつ区切られる。畳の頭には木の枕            */
  if (it.id === 'y_chair_tatami') {
    c2.fillStyle = '#2e2b28'; c2.fillRect(x + 1, y + 3, w - 2, h - 5);               // 石の台
    c2.fillStyle = '#c9c987'; c2.fillRect(x + 4, y + 6, w - 8, h - 11);              // 畳
    c2.fillStyle = 'rgba(0,0,0,.13)';                                                // 畳の目
    for (let ly = y + 8; ly < y + h - 6; ly += 3) c2.fillRect(x + 4, ly, w - 8, 1);
    c2.fillStyle = '#6a5a2e';                                                        // 畳縁
    c2.fillRect(x + 4, y + 6, w - 8, 1); c2.fillRect(x + 4, y + h - 6, w - 8, 1);
    c2.fillStyle = '#8a6b41'; c2.fillRect(x + w / 2 - 3, y + 7, 6, 2);               // 木の枕
    c2.fillStyle = '#3a2f24'; c2.fillRect(x + w - 3, y + 4, 3, h - 8);               // 脇の仕切り板
    c2.fillStyle = 'rgba(255,255,255,.10)'; c2.fillRect(x + w - 3, y + 4, 3, 1);
    return true;
  }
  return false;
}

/* ============ 第1章の絵を借りる（作者指摘 8/5）============
   第1章の設備の絵は **id で分岐している**（chair1・wash_triple…）。
   第2章の id は一つも一致しないので、ととのいイスが木のベンチになり、
   三連カランが1人用カランの引き伸ばしになっていた。
   **同じ物は同じ絵で描く。** ここで id だけ第1章のものに読み替えて渡す。
   ※ 読み替え先は**同じ cat の中**でなければ効かない（絵の分岐が cat → id の順のため） */
const EQ_ART_ALIAS_Y = {
  y_chair:     'chair1',       // ととのいイス（白のプラ椅子）
  /* 足したととのいイス（8/8）。**同じ cat の中でしか読み替えられない**ので、
     第1章の rest の4枚（bench1／chair1／chair2／chair_inf）から一番近いものを当てる */
  /* アディロンダックチェアとリクライニングチェアは、作者から実物の写真をもらって
     yEquipArt に自前の絵を描いた（借り物では、ただの四角い椅子にしかならない） */
  /* フルフラットベッドと大判マットは 2×2 なので、借り物では下半分が空く＝
     yEquipArt に自前の絵を持たせてある（ここには入れない） */
  y_chair_deck: 'bench1',      // デッキチェア
  y_x_massage: 'chair2',       // ラウンジのマッサージチェア＝リクライニングの絵で代用
  y_shower:    'wash_shower',  // 立ちシャワー
  /* ── サウナ（第1章の断面図をそのまま借りる。**熱源だけが種類ごとに違う**）──
     候補1（js/ch2/art_eq2.js）の絵は「外から見た小屋」なので、
     こちらの断面図＝**中に座っている客が見える**作りとは混ぜられない。
     熱源の描き分け（石／噴霧ノズル／遠赤ヒーター）と段数だけを引っ張ってくる     */
  y_sauna_auto: 'sauna2',      // オートロウリュ＝サウナストーン
  y_sauna_self: 'sauna2',      // セルフロウリュ＝石と桶と柄杓
  y_sauna_kero: 'sauna2',      // ケロ材セルフロウリュ室
  y_sauna_steam:'sauna_mist',  // 蒸気サウナ＝噴霧ノズルとタイル壁
  y_sauna_kusa: 'sauna_mist',  // 薬草の蒸サウナ
  y_sauna_ne:   'sauna3',      // 大型（寝サウナ付）＝ベンチが3段になる
  /* 脱衣所の小物は第1章の絵をそのまま借りる（作者指定 8/10）。
     どちらも第1章では cat 'datsui' の分岐にある絵なので、EQ_ART_CAT_Y にも登録する */
  y_scale:     'scale',        // 体重計（アナログ・針が振れる）
  y_fan:       'fan_bath',     // 扇風機（首振り・羽根が回る）
  y_sink:      'sink',         // 洗面所
  y_powder:    'sink',         // パウダーコーナー（鏡＋ドライヤー）
  y_dresser:   'sink',         // 高級ドレッサー
  y_shave:     'sink',         // 髭剃りコーナー
  y_toilet:    'toilet2',      // トイレ（ウォシュレット）
  y_cooler:    'cooler',       // 冷水機
  y_milk:      'vend1',        // 牛乳の自販機（第1章と同じ物＝同じ絵）
  y_vend:      'vend2',        // ドリンク自販機（同上）
};
/* id はそのまま、**cat だけ読み替える**品。第1章では脱衣所の設備だったものを、
   第2章では1階（front）とラウンジ（rest）に置いているため                     */
const EQ_ART_CAT_Y = { gacha: 'datsui', ehon: 'datsui',
  y_milk: 'datsui',     // 牛乳の自販機＝第1章の絵は cat 'datsui' の分岐にある
  y_scale: 'datsui',    // 体重計も同じ分岐の中にある
  /* ⚠ **扇風機だけは `case 'etc'` の中**（第1章の fan_bath は cat:'etc'。
     体重計と並んでいるように見えて、絵の置き場所が違う）。
     ここを 'datsui' にしていたので、どの分岐にも当たらず**絵が出ないまま
     名前札だけ置かれていた**（プレイヤー報告 2026-08-13） */
  y_fan: 'etc' };

/* ============ 音サウナ（作者指摘 8/5＝赤系）============
   候補1（js/ch2/art_eq2.js の s2_oto）の「真っ赤な照明と重低音」を、
   こちらの断面図の上に載せる。**部屋の作りは第1章の絵のまま**なので、
   中に座っている客はちゃんと見える。低音に合わせて明滅させる。          */
function yOtoSaunaArt(c2, it, def, x, y, w, h, rt, broken) {
  if (it.id !== 'y_sauna_oto') return false;
  drawEquipArt(c2, Object.assign({}, it, { id: 'y_sauna_oto_base' }), def, x, y, w, h, rt, broken);
  if (broken) return true;
  const pulse = (Math.sin(rt * 5 + it.x) + 1) / 2;
  c2.fillStyle = 'rgba(200,30,26,' + (0.30 + pulse * 0.20).toFixed(2) + ')';   // 部屋ぜんぶが赤い
  c2.fillRect(x + 3, y + 3, w - 6, h - 6);
  c2.fillStyle = '#c9302a';                                                    // 左右のライン照明
  c2.fillRect(x + 5, y + 6, 2, h - 16);
  c2.fillRect(x + w - 7, y + 6, 2, h - 16);
  for (const cx of [x + 14, x + w - 14]) {                                     // スピーカー（2本）
    c2.fillStyle = '#1e1a1a'; c2.fillRect(cx - 5, y + h - 20, 10, 13);
    c2.fillStyle = '#3a3030';
    c2.beginPath(); c2.arc(cx, y + h - 13 + pulse * 0.8, 3.4, 0, Math.PI * 2); c2.fill();
    c2.fillStyle = 'rgba(255,90,70,' + (0.2 + pulse * 0.4).toFixed(2) + ')';
    c2.beginPath(); c2.arc(cx, y + h - 13, 5.5 + pulse * 2, 0, Math.PI * 2); c2.fill();
  }
  return true;
}

/* ============ 6F カプセル（作者指定 2026-08-06・**真上から**に作り直し）============
   > 「真上からカプセルを見下ろして、端っこに色が違う部分（入り口のカーテン）にしたら良いかも」
   > 「プレミアムは完全に上から見下ろして『部屋にシングルベッドが一台ある』という絵に」

   はじめ斜め上から描いたが、**この game の絵は全部が真上から**なので浮いていた。
   真上に揃えたうえで、**端に細いカーテンの帯**を置く＝それだけで「寝る箱」に見える。

     ・2段カプセル … 殻（真上から見た蓋）＋**手前の端にカーテンの帯**。
                     帯は**寝床の数だけ**に割ってあり、埋まった枡から閉まっていく
                     ＝廊下を眺めるだけで、いま何人泊まっているかが分かる
     ・プレミアム   … 蓋ではなく**部屋**。シングルベッドが一台、机、枕元の灯り。
                     泊まっていれば、**上から見た寝姿**（頭と、掛け布団のふくらみ）  */

/* カーテンの閉まり具合を寝床ごとに覚えておく（0＝開いている／1＝閉まりきり）。
   G.equip に持たせるとセーブに入るので、ここだけの一時の値にする */
const Y_CAP_ANIM = {};
let Y_CAP_T = 0;
function yCapShade(it, slot, occupied) {
  const now = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
  const dt = (Y_CAP_T && now - Y_CAP_T < 0.5) ? (now - Y_CAP_T) : 0.016;
  const key = it.uid + '_' + slot;
  const cur = Y_CAP_ANIM[key] || 0;
  const to = occupied ? 1 : 0;
  const v = cur + (to - cur) * Math.min(1, dt * 3.2);      // 0.3秒ほどで閉まる
  Y_CAP_ANIM[key] = Math.abs(v - to) < 0.01 ? to : v;
  return Y_CAP_ANIM[key];
}

const Y_CAP_SKIN = {
  y_cap:       { shell: '#e2d0a8', shellHi: '#f2e6c8', shellLo: '#c2a97a', seam: 'rgba(90,70,40,.22)',
                 hole: '#2b241c', glow: 'rgba(255,190,105,.55)', curtain: '#6fb9ae',
                 curtainHi: '#9ad6cd', plate: '#26221e', num: '#e8a44a', ladder: '#c9ced2' },
  y_cap_style: { shell: '#232020', shellHi: '#39332f', shellLo: '#121110', seam: 'rgba(0,0,0,.45)',
                 hole: '#0d0b0a', glow: 'rgba(255,172,64,.72)', curtain: '#171512',
                 curtainHi: '#8a6a34', plate: null, num: '#efe7d6', ladder: '#141312' },
};

/* ── 2段カプセル（真上から見た殻＋手前の入口）──
   **上下2段。横並びではない**（作者指摘 8/6）。
   真上から見れば上段しか見えないが、それでは2段だと分からないので、
   **手前の入口を上下2本の帯に割る**（奥＝上段／手前＝下段）＋右端に梯子。
   埋まった段からカーテンが閉まる                                        */
function yCapPod(c2, it, def, x, y, w, h, broken) {
  const sk = Y_CAP_SKIN[it.id] || Y_CAP_SKIN.y_cap;
  const beds = Math.max(1, def.cap || 1);
  /* 1マス幅（縦2×横1）でも成り立つように、梯子の幅は箱に合わせる。
     カプセルは**肩幅ぶんの間口・体の長さぶんの奥行き**なので、実物どおり縦長 */
  const LAD = w >= 48 ? 8 : 5;                      // 右端の梯子のぶん
  const band = 7.5;                                 // 入口1本ぶんの太さ
  const shellH = h - (band * beds + 2) - 3;

  // 殻（真上から見た蓋）。中央が高い＝丸みを明るい帯で見せる
  c2.fillStyle = broken ? '#4a4038' : sk.shell;
  yRound(c2, x + 1, y + 1, w - 2, h - 2, 6); c2.fill();
  c2.fillStyle = broken ? 'rgba(255,255,255,.04)' : sk.shellHi;
  yRound(c2, x + 4, y + 4, w - 8 - LAD, Math.max(6, shellH * 0.55), 5); c2.fill();
  c2.fillStyle = sk.shellLo;
  c2.fillRect(x + 3, y + shellH, w - 6 - LAD, 2);   // 手前の陰
  c2.strokeStyle = 'rgba(0,0,0,.30)'; c2.lineWidth = 1.5;
  yRound(c2, x + 1, y + 1, w - 2, h - 2, 6); c2.stroke();

  // 部屋番号のプレート（左上）
  const pw = Math.min(14, w - LAD - 8);
  if (sk.plate) {
    c2.fillStyle = sk.plate; c2.fillRect(x + 4, y + 4, pw, 4);
    c2.fillStyle = sk.num;   c2.fillRect(x + 5.5, y + 5.5, pw - 3, 1.5);
  } else {
    c2.fillStyle = sk.num;   c2.fillRect(x + 4, y + 5, pw - 2, 1.5);
  }

  /* ── 入口。**奥の帯が上段、手前の帯が下段** ── */
  const ex = x + 3, ew2 = w - 6 - LAD;
  for (let i = 0; i < beds; i++) {
    const slot = beds - 1 - i;                       // 奥（i=0）が上段＝スロット1
    const ey = y + shellH + 3 + band * i;
    const occ = !!(it.occ && it.occ[slot]);
    const sh = yCapShade(it, slot, occ);
    c2.fillStyle = sk.hole; c2.fillRect(ex, ey, ew2, band - 1);
    const gg = c2.createLinearGradient(ex, ey, ex, ey + band);
    gg.addColorStop(0, sk.glow); gg.addColorStop(1, 'rgba(0,0,0,.35)');
    c2.fillStyle = gg; c2.fillRect(ex, ey, ew2, band - 1);
    c2.fillStyle = '#fbf8f1'; c2.fillRect(ex + 1.5, ey + band - 3.5, ew2 - 3, 1.8);   // 布団の端
    if (sh > 0.01) {                                  // カーテンが横に引かれて閉まる
      const ww = ew2 * sh;
      c2.fillStyle = sk.curtain; c2.fillRect(ex, ey, ww, band - 1);
      c2.fillStyle = 'rgba(255,255,255,.13)';
      for (let k = 2; k < ww; k += 4) c2.fillRect(ex + k, ey + 1, 1, band - 3);
      c2.fillStyle = sk.curtainHi; c2.fillRect(ex + ww - 1.8, ey, 1.8, band - 1);
    }
    c2.strokeStyle = 'rgba(0,0,0,.38)'; c2.lineWidth = 1;
    c2.strokeRect(ex, ey, ew2, band - 1);
  }

  /* ── 右端の梯子。**上段へ上がる**＝ここで「2段」だと分かる ── */
  if (beds > 1) {
    const lx = x + w - LAD - 1, ly = y + 5, lh = h - 10;
    c2.strokeStyle = sk.ladder || '#c9ced2'; c2.lineWidth = 1.8;
    c2.beginPath(); c2.moveTo(lx + 1.5, ly); c2.lineTo(lx + 1.5, ly + lh); c2.stroke();
    c2.beginPath(); c2.moveTo(lx + LAD - 3, ly); c2.lineTo(lx + LAD - 3, ly + lh); c2.stroke();
    c2.lineWidth = 1.4;
    for (let ry = ly + 4; ry < ly + lh - 1; ry += 6) {
      c2.beginPath(); c2.moveTo(lx + 1.5, ry); c2.lineTo(lx + LAD - 3, ry); c2.stroke();
    }
  }
  Y_CAP_T = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
  return true;
}

/* ── プレミアム（真上から見た「部屋」。シングルベッドが一台）── */
function yCapPremium(c2, it, x, y, w, h, broken) {
  const occ = !!(it.occ && it.occ[0]);
  const CUR = 9;

  // 部屋の壁と床
  c2.fillStyle = broken ? '#4a4038' : '#6f573c';                 // 壁（木）
  yRound(c2, x + 1, y + 1, w - 2, h - 2, 5); c2.fill();
  const fx = x + 4, fy = y + 4, fw = w - 8, fh = h - 8 - CUR;
  c2.fillStyle = '#e9dcc4'; c2.fillRect(fx, fy, fw, fh);         // 床
  c2.fillStyle = 'rgba(255,214,150,.20)';                        // 枕元の灯りが落ちる
  c2.fillRect(fx, fy, fw * 0.45, fh);

  /* ── シングルベッドが一台（頭が奥、足が手前）── */
  const bx = fx + fw * 0.30, bw = fw * 0.46;
  const by = fy + 2, bh = fh - 4;

  /* 左手の棚は、**ベッドと縦幅を揃える**（作者指定 8/6）＝
     壁に沿って奥から手前まで一本通る。横幅は細いまま               */
  const dw = fw * 0.17;
  c2.fillStyle = '#4a3a2a';
  yRound(c2, fx + 2, by, dw, bh, 2); c2.fill();
  c2.fillStyle = 'rgba(255,255,255,.07)'; c2.fillRect(fx + 2, by, dw, 1.5);
  c2.fillStyle = 'rgba(0,0,0,.22)';                       // 棚板の切れ目
  c2.fillRect(fx + 2, by + bh * 0.46, dw, 1);
  c2.fillStyle = 'rgba(255,224,166,.85)';                 // 枕元の灯り（棚の奥の端）
  c2.beginPath(); c2.arc(fx + 2 + dw / 2, by + bh * 0.12, 3.2, 0, Math.PI * 2); c2.fill();
  c2.fillStyle = 'rgba(0,0,0,.18)'; yRound(c2, bx + 1.5, by + 2, bw, bh, 3); c2.fill();   // 影
  c2.fillStyle = '#f7f3ec'; yRound(c2, bx, by, bw, bh, 3); c2.fill();                     // マットレス
  c2.strokeStyle = '#cfc7b8'; c2.lineWidth = 1; yRound(c2, bx, by, bw, bh, 3); c2.stroke();
  c2.fillStyle = '#ffffff';                                                               // 枕（奥）
  yRound(c2, bx + 2, by + 2, bw - 4, bh * 0.20, 2); c2.fill();

  if (occ) {
    // 掛け布団（枕の手前から足元まで）と、その下のふくらみ
    c2.fillStyle = '#dfe6e8';
    yRound(c2, bx + 1, by + bh * 0.24, bw - 2, bh * 0.74, 3); c2.fill();
    c2.fillStyle = 'rgba(120,140,150,.22)';
    c2.beginPath();
    c2.ellipse(bx + bw / 2, by + bh * 0.58, bw * 0.26, bh * 0.26, 0, 0, Math.PI * 2); c2.fill();
    c2.strokeStyle = 'rgba(120,140,150,.35)'; c2.lineWidth = 1;                           // 折り返し
    c2.beginPath(); c2.moveTo(bx + 2, by + bh * 0.30); c2.lineTo(bx + bw - 2, by + bh * 0.30); c2.stroke();
    // 上から見た頭（枕の上）
    const hx = bx + bw / 2, hy = by + bh * 0.13;
    c2.fillStyle = '#2e2620';
    c2.beginPath(); c2.arc(hx, hy, 4.6, 0, Math.PI * 2); c2.fill();                       // 髪（上から）
    c2.fillStyle = '#e0b184';
    c2.beginPath(); c2.arc(hx, hy + 1.4, 3.1, 0, Math.PI * 2); c2.fill();                 // 顔
  } else {
    /* 空き＝**畳んだ白いタオルだけ**を足元に置く（作者指定 8/6）。
       濃い色の館内着を重ねると、真上から見たときにベッドの上の黒い四角にしか見えない */
    c2.fillStyle = '#fdfbf6';
    yRound(c2, bx + bw * 0.24, by + bh * 0.66, bw * 0.52, bh * 0.14, 2); c2.fill();
    c2.fillStyle = 'rgba(0,0,0,.10)';
    c2.fillRect(bx + bw * 0.24, by + bh * 0.73, bw * 0.52, 1);
  }

  /* ── 入口（手前の端。カーテンではなく扉なので、いつも同じ）── */
  const cy = y + h - CUR - 3;
  c2.fillStyle = '#3a2f26'; c2.fillRect(x + 4, cy, w - 8, CUR);
  c2.fillStyle = '#c9a86a'; c2.fillRect(x + 4, cy, w - 8, 1.5);          // 真鍮の見切り
  c2.fillStyle = '#e9dcc4'; c2.fillRect(x + w / 2 - 7, cy + 3, 14, 2);   // 引き手
  c2.strokeStyle = 'rgba(0,0,0,.35)'; c2.lineWidth = 1.5;
  yRound(c2, x + 1, y + 1, w - 2, h - 2, 5); c2.stroke();
  return true;
}

function yCapsuleArt(c2, it, def, x, y, w, h, rt, broken) {
  if (def.cat !== 'capsule') return false;

  if (it.id === 'y_cap_locker') {
    /* 宿泊者用ロッカー（真上から見た扉の列）。**扉は数えられる数まで**＝
       3マスに20枚描くと縞模様にしか見えない（実測）ので、6枚に減らして取っ手を大きく */
    c2.fillStyle = broken ? '#4a4038' : '#6b5a46'; c2.fillRect(x + 1, y + 2, w - 2, h - 4);
    c2.strokeStyle = '#3a2f26'; c2.lineWidth = 2; c2.strokeRect(x + 1, y + 2, w - 2, h - 4);
    const n = 6, cw = (w - 6) / n;
    for (let i = 0; i < n; i++) {
      const cx = x + 3 + cw * i;
      c2.fillStyle = '#8a7358'; c2.fillRect(cx + 0.5, y + 4, cw - 2, h - 8);
      c2.fillStyle = 'rgba(255,255,255,.10)'; c2.fillRect(cx + 0.5, y + 4, cw - 2, 2);
      c2.fillStyle = '#d8c49a'; c2.fillRect(cx + cw - 5, y + h / 2 - 2, 2.5, 5);   // 取っ手
    }
    return true;
  }
  if (it.id === 'y_cap_pre') return yCapPremium(c2, it, x, y, w, h, broken);
  return yCapPod(c2, it, def, x, y, w, h, broken);
}

function yEquipArt(c2, it, def, x, y, w, h, rt, broken) {
  if (yCapsuleArt(c2, it, def, x, y, w, h, rt, broken)) return true;
  if (yFrontArt(c2, it, def, x, y, w, h, rt, broken)) return true;
  if (yShokudoArt(c2, it, def, x, y, w, h, rt, broken)) return true;
  if (yWash5Art(c2, it, def, x, y, w, h, rt, broken)) return true;
  if (yOtoSaunaArt(c2, it, def, x, y, w, h, rt, broken)) return true;
  /* 第1章と同じ物は、第1章の絵で描く（id を読み替えて描き直させる）。
     読み替えた id は第2章の絵を持たないので、ここへは戻ってこない＝無限には回らない */
  const alias = EQ_ART_ALIAS_Y[it.id];
  if (alias) {
    /* ⚠ id だけ読み替えても、第1章の絵は **cat で分岐している**ものがある。
       牛乳の自販機（vend1）は第1章の `case 'datsui'` の中＝y_milk の cat 'front' の
       ままでは届かず、名前札のまま置かれていた（作者報告 8/9）。
       EQ_ART_CAT_Y に読み替え先があれば、cat も一緒に差し替える           */
    const catFix = EQ_ART_CAT_Y[it.id];
    drawEquipArt(c2, Object.assign({}, it, { id: alias }),
      catFix ? Object.assign({}, def, { cat: catFix, __yArt: true }) : def, x, y, w, h, rt, broken);
    return true;
  }
  /* **id は第1章と同じなのに、cat だけ第2章で変えた品**（ガチャガチャ・絵本の棚）。
     game.js の絵は cat で振り分けているので、cat も読み替えないと名前札に落ちる
     （第1章は datsui＝脱衣所の品、第2章は1階とラウンジに置くので front / rest）。
     `__yArt` の印を付けて渡す＝もう一度ここへ来ても、そのまま第1章の絵へ抜ける      */
  const catAlias = EQ_ART_CAT_Y[it.id];
  if (catAlias && !def.__yArt) {
    drawEquipArt(c2, it, Object.assign({}, def, { cat: catAlias, __yArt: true }), x, y, w, h, rt, broken);
    return true;
  }
  if (it.id !== 'y_elev') return false;

  // 箱（金属のシャフト）
  c2.fillStyle = broken ? '#4a4038' : '#5b6672';
  c2.fillRect(x, y, w, h);
  c2.fillStyle = 'rgba(255,255,255,.06)'; c2.fillRect(x + 2, y + 2, w - 4, 3);
  c2.strokeStyle = '#2b3138'; c2.lineWidth = 2; c2.strokeRect(x + 1, y + 1, w - 2, h - 2);
  // 鋼板の目地
  c2.strokeStyle = 'rgba(0,0,0,.18)'; c2.lineWidth = 1;
  for (let ly = y + 8; ly < y + h - 4; ly += 10) {
    c2.beginPath(); c2.moveTo(x + 8, ly); c2.lineTo(x + w - 3, ly); c2.stroke();
  }

  /* 扉＝左の辺。2枚が上下に開く（真ん中に合わせ目） */
  const dw = 7, dy = y + 4, dh = h - 8;
  c2.fillStyle = broken ? '#6a5a4a' : '#8fa3b4';
  c2.fillRect(x + 1, dy, dw, dh);
  c2.strokeStyle = '#2b3138'; c2.lineWidth = 1; c2.strokeRect(x + 1, dy, dw, dh);
  c2.strokeStyle = 'rgba(20,26,32,.8)';
  c2.beginPath(); c2.moveTo(x + 1, dy + dh / 2); c2.lineTo(x + 1 + dw, dy + dh / 2); c2.stroke();

  // 呼びボタンと階数ランプ（扉の上）
  c2.fillStyle = broken ? '#8a3030' : '#ffd98a';
  c2.fillRect(x + 1 + dw + 2, dy - 3, 4, 4);

  // 壊れていたら「調整中」の貼り紙
  if (broken) {
    c2.fillStyle = '#f2ead8'; c2.fillRect(x + w / 2 - 14, y + h / 2 - 7, 28, 14);
    c2.fillStyle = '#a33028'; c2.font = 'bold 8px "DotGothic16",sans-serif'; c2.textAlign = 'center';
    c2.fillText('調整中', x + w / 2, y + h / 2 + 3);
  } else {
    c2.fillStyle = 'rgba(240,246,250,.85)'; c2.font = 'bold 8px "DotGothic16",sans-serif'; c2.textAlign = 'center';
    c2.fillText('EV', x + w / 2 + 4, y + h / 2 + 3);
  }
  return true;
}

/* ============================================================
   5F食堂の品もの（プレイヤー報告 2026-08-13）
   ------------------------------------------------------------
   **食堂を建てた瞬間、10品ぜんぶが灰色の名前札だった。**
   増築費を700万に下げて誰でも建てられるようにした以上、ここは埋めておく。
   描き方は1階フロント（yFrontArt）と同じ＝**見下ろした絵。上の面が主役で、
   厚みは下辺の濃い帯だけで出す**。broken のときは色を落とす。
   ============================================================ */
function yShokudoArt(c2, it, def, x, y, w, h, rt, broken) {
  const F = {};
  const dim = c => (broken ? '#8a8078' : c);
  const R = (px, py, pw, ph, c) => { c2.fillStyle = c; c2.fillRect(x + px, y + py, pw, ph); };
  const C = (cx, cy, r, c) => { c2.fillStyle = c; c2.beginPath(); c2.arc(x + cx, y + cy, r, 0, 7); c2.fill(); };
  const base = (fill, top) => {
    c2.fillStyle = 'rgba(0,0,0,.28)'; c2.fillRect(x + 2, y + 3, w - 2, h - 2);
    c2.fillStyle = broken ? '#6a5f55' : fill;
    c2.fillRect(x + 1, y + 1, w - 2, h - 2);
    if (top) { c2.fillStyle = 'rgba(255,255,255,.14)'; c2.fillRect(x + 1, y + 1, w - 2, 3); }
    c2.fillStyle = 'rgba(0,0,0,.30)'; c2.fillRect(x + 1, y + h - 4, w - 2, 3);
    c2.strokeStyle = 'rgba(0,0,0,.40)'; c2.lineWidth = 1;
    c2.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  };
  /* 木の天板（席もの共通）。木目を2本入れると、板に見える */
  const ita = (fill) => {
    base(fill, true);
    c2.fillStyle = 'rgba(0,0,0,.10)';
    c2.fillRect(x + 4, y + h * 0.38, w - 8, 1);
    c2.fillRect(x + 4, y + h * 0.66, w - 8, 1);
  };
  // 丸椅子（座面＋影）
  const stool = (cx, cy, r) => { C(cx + 1, cy + 1, r, 'rgba(0,0,0,.30)'); C(cx, cy, r, dim('#8a5a3a')); C(cx, cy - r * 0.3, r * 0.55, dim('#a9743f')); };

  /* ── 厨房（4×2）＝コンロ・寸胴・炊飯器・冷蔵庫。手前が受け渡しカウンター ── */
  F.y_k_kitchen = () => {
    base('#8e979e', true);                                   // ステンレスの島
    R(3, 3, w - 6, h * 0.52, dim('#aab4bb'));                // 調理台の面
    // コンロ2口（火が入っている）
    for (let i = 0; i < 2; i++) {
      const cx = 12 + i * 17, cy = 3 + h * 0.26;
      C(cx, cy, 6, dim('#3a4148'));
      if (!broken) { C(cx, cy, 3.5, '#ff9a3c'); C(cx, cy, 1.8, '#ffd98a'); }
    }
    R(34, 5, 13, 13, dim('#7b858c')); R(36, 3, 9, 3, dim('#c9d2d8'));      // 寸胴（湯気の出る鍋）
    if (!broken) { c2.fillStyle = 'rgba(255,255,255,.30)'; c2.fillRect(x + 39, y + 1, 2, 3); }
    R(52, 5, 12, 13, dim('#e2e6e9')); R(54, 8, 8, 3, dim('#b3402e'));      // 炊飯器
    R(w - 26, 4, 22, h * 0.52 - 2, dim('#cfd6da'));                        // 冷蔵庫（両開き）
    R(w / 2 + 12, 6, 1, h * 0.42, dim('#8e979e'));
    R(w - 16, 10, 2, 5, dim('#8e979e')); R(w - 12, 10, 2, 5, dim('#8e979e'));
    // 手前＝受け渡しカウンター。出来た皿が並ぶ
    R(3, h * 0.62, w - 6, h * 0.3, dim('#a9743f'));
    R(3, h * 0.62, w - 6, 2, dim('#c08a52'));
    for (let i = 0; i < 4; i++) { C(14 + i * 22, h * 0.77, 4.5, dim('#f2f4f5')); C(14 + i * 22, h * 0.77, 2.2, dim('#e0c07a')); }
  };

  /* ── カウンター席（2×1・2席）＝細い天板＋丸椅子2 ── */
  F.y_k_counter = () => {
    ita('#a9743f');
    R(3, 3, w - 6, h * 0.42, dim('#c08a52'));                // 天板の面
    stool(w * 0.3, h * 0.74, 5); stool(w * 0.7, h * 0.74, 5);
  };

  /* ── テーブル席（2×2・4席）＝四角い卓に椅子4 ── */
  F.y_k_table = () => {
    c2.fillStyle = 'rgba(0,0,0,.26)'; c2.fillRect(x + 8, y + 9, w - 12, h - 12);
    R(6, 6, w - 12, h - 12, dim('#a9743f'));                 // 卓
    R(8, 8, w - 16, h - 16, dim('#c08a52'));
    R(w / 2 - 5, h / 2 - 5, 10, 10, dim('#e8e2d2'));         // 卓上の紙ナプキン立て
    stool(w / 2, 4, 4.5); stool(w / 2, h - 4, 4.5);          // 椅子4（上下左右）
    stool(4, h / 2, 4.5); stool(w - 4, h / 2, 4.5);
  };

  /* ── 立ち飲みカウンター（3×1・3人）＝椅子が無い。天板とジョッキだけ ── */
  F.y_k_bar = () => {
    ita('#8a5a3a');
    R(3, 4, w - 6, h * 0.5, dim('#a9743f'));
    for (let i = 0; i < 3; i++) {                            // 置かれたジョッキ
      const cx = w * (0.2 + i * 0.3);
      C(cx, h * 0.52, 4, dim('#e8b23c')); C(cx, h * 0.44, 4, dim('#f2f4f5'));
    }
  };

  /* ── 座敷席（3×2・6席）＝畳に座卓、座布団が6枚 ── */
  F.y_k_zaseki = () => {
    base('#c8b98a', true);                                   // 畳
    c2.strokeStyle = 'rgba(0,0,0,.16)'; c2.lineWidth = 1;
    for (let i = 1; i < 3; i++) { c2.beginPath(); c2.moveTo(x + i * w / 3, y + 2); c2.lineTo(x + i * w / 3, y + h - 2); c2.stroke(); }
    R(2, 2, w - 4, 2, dim('#2e6b4f'));                        // 畳の縁
    R(2, h - 4, w - 4, 2, dim('#2e6b4f'));
    R(w * 0.22, h * 0.3, w * 0.56, h * 0.4, dim('#6b432a'));  // 座卓
    R(w * 0.24, h * 0.32, w * 0.52, h * 0.34, dim('#8a5a3a'));
    for (let i = 0; i < 3; i++) {                            // 座布団（上3・下3）
      R(w * (0.16 + i * 0.28), 5, 12, 8, dim('#b3402e'));
      R(w * (0.16 + i * 0.28), h - 13, 12, 8, dim('#b3402e'));
    }
  };

  /* ── 窓際のカウンター（3×1・3人）＝上辺が窓。夜景が見えている ── */
  F.y_k_mado = () => {
    R(1, 1, w - 2, h * 0.42, dim('#1d2733'));                // 窓の外（夜）
    if (!broken) {                                           // 熱波銀座の灯り
      for (let i = 0; i < 7; i++) R(5 + i * ((w - 10) / 7), 4 + (i % 3) * 3, 3, 3, ['#ffd98a', '#7de0c8', '#ff9a3c'][i % 3]);
    }
    R(1, h * 0.42, w - 2, 2, dim('#5b6672'));                // サッシ
    c2.fillStyle = 'rgba(0,0,0,.28)'; c2.fillRect(x + 2, y + h * 0.5 + 3, w - 2, h * 0.46);
    R(1, h * 0.5, w - 2, h * 0.42, dim('#c08a52'));          // 天板
    R(1, h * 0.5, w - 2, 2, dim('#d8a56a'));
    for (let i = 0; i < 3; i++) stool(w * (0.2 + i * 0.3), h - 4, 4.5);
  };

  /* ── 生ビールサーバー（1×1）＝銀の筐体にタップ、横にジョッキ ── */
  F.y_k_beer = () => {
    base('#8e979e', true);
    R(3, 3, w - 6, h * 0.5, dim('#aab4bb'));                 // 本体（上面）
    R(5, 5, 7, 4, dim('#1d2530'));                           // 温度計の窓
    R(4, h * 0.55, 6, 9, dim('#2a3138'));                    // タップの柱（太く・濃く）
    R(3, h * 0.55, 8, 3, dim('#c9a86a'));                    // 金色のレバー
    C(w - 10, h - 8, 5.5, dim('#e8b23c'));                   // ジョッキ（黄金色）
    C(w - 10, h - 12, 5, dim('#fbf7ee'));                    // 泡（白を厚く）
    R(w - 5, h - 12, 3, 8, dim('#cfd6da'));                  // 取っ手
  };

  /* ── ソフトクリーム機（1×1）＝白い筐体、下にコーン ── */
  F.y_k_soft = () => {
    base('#cfd6da', true);
    R(3, 3, w - 6, h * 0.46, dim('#f2f4f5'));                // 白い筐体
    R(5, 5, w - 10, 4, dim('#7de0c8'));                      // 操作パネル
    R(w / 2 - 3, h * 0.5, 6, 4, dim('#8e979e'));             // ノズル
    if (!broken) {                                           // 巻かれたクリーム（3段＋コーン）
      C(w / 2, h * 0.66, 4.5, '#fff3d8');
      C(w / 2, h * 0.78, 5.5, '#fff3d8');
      c2.fillStyle = dim('#c9a86a');                         // コーン（三角）
      c2.beginPath();
      c2.moveTo(x + w / 2 - 5.5, y + h * 0.82); c2.lineTo(x + w / 2 + 5.5, y + h * 0.82);
      c2.lineTo(x + w / 2, y + h - 2); c2.closePath(); c2.fill();
    }
  };

  /* ── コーヒーマシン（1×1）＝黒い筐体、抽出口の下にカップ ── */
  F.y_k_coffee = () => {
    base('#3a3630', true);
    R(4, 3, w - 8, h - 13, dim('#4a453e'));
    R(6, 5, w - 12, 4, dim('#ff9a3c'));                      // ランプ
    R(w / 2 - 3, h - 12, 6, 3, dim('#2a262a'));              // 抽出口
    C(w / 2, h - 6, 4, dim('#f2f4f5'));                      // カップ
    C(w / 2, h - 6, 2.4, dim('#6b432a'));                    // 中身
  };

  /* ── 食器返却棚（2×1）＝3段の棚に、下げた皿が積んである ── */
  F.y_k_sara = () => {
    base('#8e979e', true);
    for (let r = 0; r < 3; r++) R(3, 4 + r * ((h - 8) / 3), w - 6, 2, dim('#aab4bb'));   // 棚板
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {                            // 積まれた皿
      const cx = 9 + c * ((w - 14) / 3), cy = 3 + r * ((h - 8) / 3);
      C(cx, cy, 3.6, dim('#f2f4f5')); C(cx, cy, 1.8, dim('#cfd6da'));
    }
    R(3, h - 6, w - 6, 3, dim('#7b858c'));                                               // 下の受け
  };

  const f = F[it.id];
  if (!f) return false;
  f();
  return true;
}

/* ============================================================
   1階フロントの品もの（作者依頼 8/2）
   ------------------------------------------------------------
   ここまで cat:'front' の品には絵が無く、名前だけの札が並んでいた。
   **フロントは客がいちばん最初に見る場所**なので、一つずつ描く。
   見下ろした絵＝上の面が主役。厚みは下辺の濃い帯だけで出す
   ============================================================ */
function yFrontArt(c2, it, def, x, y, w, h, rt, broken) {
  const F = {}; // ← 下で id ごとに描く

  // 影と土台。broken のときは色を落とす
  const base = (fill, top) => {
    c2.fillStyle = 'rgba(0,0,0,.28)'; c2.fillRect(x + 2, y + 3, w - 2, h - 2);
    c2.fillStyle = broken ? '#6a5f55' : fill;
    c2.fillRect(x + 1, y + 1, w - 2, h - 2);
    if (top) { c2.fillStyle = 'rgba(255,255,255,.14)'; c2.fillRect(x + 1, y + 1, w - 2, 3); }
    c2.fillStyle = 'rgba(0,0,0,.30)'; c2.fillRect(x + 1, y + h - 4, w - 2, 3);
    c2.strokeStyle = 'rgba(0,0,0,.40)'; c2.lineWidth = 1;
    c2.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  };
  const dim = c => (broken ? '#8a8078' : c);
  const R = (px, py, pw, ph, c) => { c2.fillStyle = c; c2.fillRect(x + px, y + py, pw, ph); };

  F.y_ticket = () => {                       // 券売機：ボタンがずらりと並ぶ盤面
    base('#3d4650', true);
    R(4, 5, w - 8, 9, dim('#1d2530'));                     // 表示窓
    R(6, 7, 8, 5, dim('#7de0c8'));
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++)  // 押しボタン
      R(5 + c * 7, 17 + r * 6, 5, 4, dim(r === 0 ? '#ffd98a' : '#cfd8e2'));
    R(w - 10, h - 12, 6, 2, dim('#111'));                  // 硬貨の投入口
  };
  /* 靴箱：木の扉が横に並ぶ。**3つの大きさで同じ絵を使う**（小・中・大）。
     扉の数は幅に合わせて増える＝大きい靴箱ほど、実際に扉が多く見える。
     ⚠ ここが `y_shoe` だけだったので、**【靴箱（中）】と【大きな靴箱】は
       絵が無く、灰色の名前札のまま置かれていた**（プレイヤー報告 2026-08-13） */
  F.y_shoe = () => {
    base('#a9743f', true);
    const cols = Math.max(4, Math.round((w - 8) / 8));       // 1枚およそ8px
    for (let r = 0; r < 2; r++) for (let c = 0; c < cols; c++) {
      const dw = (w - 8) / cols;
      const dx = 4 + c * dw, dy = 5 + r * ((h - 10) / 2);
      R(dx, dy, dw - 2, (h - 10) / 2 - 2, dim('#c08a52'));
      R(dx + dw - 6, dy + 2, 2, 3, dim('#6b4522'));          // 木札の鍵
    }
  };
  F.y_shoe40 = F.y_shoe80 = F.y_shoe;
  F.y_water = () => {                        // ウォーターサーバー：上に水のボトル
    base('#e8ecef', true);
    c2.fillStyle = dim('#5aa8d8');
    c2.beginPath(); c2.arc(x + w / 2, y + h / 2 - 3, Math.min(w, h) / 3.4, 0, 7); c2.fill();
    c2.fillStyle = 'rgba(255,255,255,.45)';
    c2.beginPath(); c2.arc(x + w / 2 - 3, y + h / 2 - 6, 3, 0, 7); c2.fill();
    R(w / 2 - 4, h - 11, 8, 3, dim('#9aa4ac'));            // 蛇口
  };
  F.y_vend = () => {                         // ドリンク自販機：赤い帯と見本の列
    base('#dfe3e6', true);
    R(3, 3, w - 6, 7, dim('#b3402e'));
    for (let i = 0; i < 4; i++) R(5 + i * 6, 13, 4, 9, dim(['#4a8ac9', '#e8c84a', '#5aa84a', '#c9564a'][i]));
    R(4, h - 12, w - 8, 4, dim('#9aa4ac'));                // 取り出し口
  };
  F.y_goods = () => {                        // 物販棚：段ごとに色の違う商品
    base('#8a5a2f', true);
    for (let r = 0; r < 3; r++) {
      R(4, 5 + r * ((h - 10) / 3), w - 8, 2, dim('#6b4522'));
      for (let c = 0; c < 7; c++)
        R(5 + c * ((w - 10) / 7), 8 + r * ((h - 10) / 3), (w - 10) / 7 - 2, (h - 10) / 3 - 5,
          dim(['#e8dcc0', '#c9564a', '#4a8ac9', '#e8c84a', '#7fae5c', '#d89a4a', '#b48ac9'][(c + r) % 7]));
    }
  };
  /* ── 子ども向け（作者決定 8/5）。ガチャガチャと絵本の棚は
     **id を第1章と同じにしてあるので、絵もそのまま第1章のものが出る**（ここには書かない） */
  F.y_dagashi = () => {                      // 駄菓子コーナー：小分けの袋が籠に並ぶ
    base('#c98a4a', true);
    R(3, 4, w - 6, 2, dim('#7a4a20'));                      // 棚板
    const col = ['#e8544a', '#f0c040', '#5aa84a', '#4a8ac9', '#e0709a', '#f08a3a'];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) {
      const bx = 4 + c * ((w - 8) / 6), by = 7 + r * ((h - 12) / 2);
      R(bx, by, (w - 8) / 6 - 2, (h - 12) / 2 - 2, dim(col[(c + r * 3) % 6]));
      c2.fillStyle = 'rgba(255,255,255,.35)';               // 袋の照り
      c2.fillRect(x + bx + 1, y + by + 1, 2, 2);
    }
    R(3, h - 5, w - 6, 2, dim('#7a4a20'));
  };
  F.y_omutsu = () => {                       // おむつ替え台：折りたたみの台とベルト
    base('#e6e9ec', true);
    R(3, 5, w - 6, h - 12, dim('#f4f6f8'));                 // 白い天板
    R(3, 5, w - 6, 3, dim('#b9c4cc'));                      // ふちの立ち上がり
    R(6, h - 12, w - 12, 2, dim('#8fb8d8'));                // 安全ベルト
    R(w / 2 - 1, h - 14, 2, 5, dim('#8fb8d8'));
    R(4, h - 7, w - 8, 3, dim('#aab4bc'));                  // 折りたたみの蝶番
  };
  F.y_kidspace = () => {                     // キッズスペース：カラーマットとブロック
    const cols = ['#f0a8a8', '#a8d8f0', '#f0e0a0', '#b8e0a8'];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++)   // 敷きつめたジョイントマット
      R(2 + c * ((w - 4) / 3), 2 + r * ((h - 4) / 2), (w - 4) / 3 - 1, (h - 4) / 2 - 1,
        dim(cols[(c + r) % 4]));
    c2.strokeStyle = 'rgba(0,0,0,.18)'; c2.lineWidth = 1;
    c2.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
    // 散らばったブロック
    R(w * 0.20, h * 0.28, 6, 6, dim('#e8544a'));
    R(w * 0.55, h * 0.20, 5, 5, dim('#4a8ac9'));
    R(w * 0.70, h * 0.62, 7, 5, dim('#f0c040'));
    R(w * 0.30, h * 0.66, 5, 6, dim('#5aa84a'));
  };
  F.y_coin = () => {                         // 貴重品ロッカー：小さな扉がびっしり
    base('#7f8fa6', true);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 10; c++) {
      const dw = (w - 8) / 10, dh = (h - 10) / 3;
      R(4 + c * dw, 5 + r * dh, dw - 1, dh - 1, dim('#9db0c4'));
      R(4 + c * dw + dw - 4, 5 + r * dh + 2, 2, 2, dim('#e8eef4'));
    }
  };
  F.y_kasa = () => {                         // 傘立て：傘の柄が突き出している
    base('#4a535d', true);
    R(3, 3, w - 6, h - 8, dim('#2f363d'));                  // 筒の内側（覗き込んでいる）
    for (let i = 0; i < 4; i++) {
      const cx = 8 + (i % 2) * 9, cy = 9 + Math.floor(i / 2) * 9;
      c2.fillStyle = dim(['#3a6ea5', '#b3402e', '#4a7a4a', '#6a5a8a'][i]);
      c2.beginPath(); c2.arc(x + cx, y + cy, 3.2, 0, 7); c2.fill();     // 畳んだ傘の断面
      c2.fillStyle = 'rgba(255,255,255,.35)'; c2.fillRect(x + cx - 1, y + cy - 3, 2, 2);
    }
    c2.strokeStyle = dim('#7d8892'); c2.lineWidth = 2;
    c2.strokeRect(x + 3, y + 3, w - 6, h - 8);              // 縁
  };
  F.y_board = () => {                        // イベント黒板：チョークの手書き
    base('#6b4522', true);
    R(4, 4, w - 8, h - 10, dim('#26332c'));
    c2.strokeStyle = broken ? '#8a8078' : 'rgba(255,255,255,.75)'; c2.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      c2.beginPath(); c2.moveTo(x + 8, y + 10 + i * 6);
      c2.lineTo(x + 8 + (w - 22) * [0.9, 0.6, 0.75][i], y + 10 + i * 6); c2.stroke();
    }
  };
  F.y_ice = () => {                          // アイスの冷凍ケース：ガラス越しに色が見える
    base('#e4eaee', true);
    R(4, 5, w - 8, h - 12, dim('#bcd8e4'));
    for (let i = 0; i < 6; i++)
      R(6 + (i % 3) * 7, 7 + Math.floor(i / 3) * 7, 5, 5,
        dim(['#f0a8c0', '#a8d8f0', '#f0e0a8', '#c0f0a8', '#d8a8f0', '#f0c0a8'][i]));
    c2.fillStyle = 'rgba(255,255,255,.35)'; c2.fillRect(x + 4, y + 5, w - 8, 4);
  };
  F.y_massage = () => {                      // マッサージ機：上から見た椅子
    base('#3a3038', true);
    R(5, 4, w - 10, h - 12, dim('#5a4a58'));               // 座面
    R(7, 6, w - 14, 6, dim('#7a6878'));                    // 背もたれの頭側
    R(2, 8, 4, 12, dim('#2a222a')); R(w - 6, 8, 4, 12, dim('#2a222a')); // 肘掛け
    R(w / 2 - 4, h - 10, 8, 3, dim('#ffd98a'));            // 操作パネル
  };

  const f = F[it.id];
  if (!f) return false;
  f();
  return true;
}

registerChapter2Hooks({ equipArt: yEquipArt });
