'use strict';
/* ============================================================
   休みの日の行き先（第2章「ととのい市編」）
   ------------------------------------------------------------
   一枚絵が届いたので（2026-08-07）、**寄り道に行き先を持たせた。**
   これまでは「妻と出かける」も「買い出し」も一本道の文章だったが、
   ライバル店めぐりと同じ形＝**どこへ行くかを選ぶ**ようにする。

   ・妻と出かける … ととのい市のどこへ行くかで、値段も・機嫌の戻りも・その日の出来事も変わる
   ・買い出し     … 金を出すほど当たりが出る（安い地下街／標準のモール／品揃えの郊外店）
   ・ロウリュ街で飲む   … 行き先は変わらないが、夜の路地の絵が毎回変わる

   ⚠ 絵は `assets/story/*.webp`。無ければコード描画の控えが出るので、
     絵が揃っていなくてもゲームは止まらない（js/story.js の作り）
   ============================================================ */

/* ---- 一枚絵 ----
   お出かけ先24枚は**すべてコードのドット絵**（作者決定 8/9）。
   描き手は rival_art_y.js（AREA_ARTS→StoryArt に登録済み・CODE_FINAL）なので、
   ここで STORY_IMG に webp を張ってはいけない。張ると Story がコード絵より
   webp（横浜編の生成画像）を優先してしまう */

/* 同じ場所でも、行くたびに絵を変える（行った回数で順に回す＝毎回ちがうととのい市が見える） */
function yPickImg(imgs, n) { return imgs[((n | 0) % imgs.length + imgs.length) % imgs.length]; }

/* 一枚絵＋地の文を、Story が読める形にする（ライバル店の yRivalScenes と同じ変換）。
   ⚠ Story.play が受けるのは `{ art, lines: [{narr, text}] }`。
     `[キー, [文字列]]` のままでは showLine で落ちる                        */
function yScene(art, lines) {
  if (typeof storyImgPreload === 'function') storyImgPreload([art]);
  return [{ art, lines: lines.map(text => ({ narr: true, text })) }];
}

/* ============================================================
   ① 妻と出かける
   ------------------------------------------------------------
   **値段の高い場所ほど機嫌が戻る、にはしない。**
   風待公園はいちばん安いのに、いちばんストレスが抜ける＝
   「金をかけた日」と「よかった日」を一致させない。
   彼女の機嫌がいちばん戻るのは、**彼女のために選んだ**水明商店街       */
/* **妻と出かける＝機嫌の専門**（作者決定 8/8）。
   以前は風待公園が **¥1,000 で 体力+45・ストレス−40・機嫌+18** の三重取りで、
   どう考えてもこれ一択だった。体力とストレスの旨みを削り、
   **行き先ごとの差は「機嫌がいくつ戻るか」と値段だけ**にしてある            */
const DATE_SPOTS_Y = [
  { id: 'yamashita', name: '風待公園', area: '海沿いをただ歩く', cost: 1000,
    stam: 10, mood: 18, stress: -15, imgs: ['y_date_yamashita'],
    sub: '金はかからない。歩いて、座って、海を見る' },
  { id: 'chuka', name: '旧貿易地区', area: '飯を食う', cost: 8000,
    stam: 10, mood: 28, stress: -15,
    imgs: ['y_date_chuka1', 'y_date_chuka3', 'y_date_chuka5', 'y_date_chuka2', 'y_date_chuka4', 'y_date_chuka6'],
    sub: '腹を満たすと、たいていの話はまとまる' },
  { id: 'akarenga', name: '旧香料倉庫', area: 'イベントを冷やかす', cost: 6000,
    stam: 10, mood: 26, stress: -15, imgs: ['y_date_akarenga'],
    sub: '人が多い。人が多い店を、外から見られる' },
  { id: 'minato', name: '外気ベイ', area: '観覧車と、湾の夜景', cost: 9000,
    stam: 10, mood: 32, stress: -15, imgs: ['y_date_minato1', 'y_date_minato2'],
    sub: '上から街を見る。自分の店も、その中にある' },
  { id: 'motomachi', name: '水明商店街', area: '彼女の買い物に付き合う', cost: 12000,
    stam: 10, mood: 42, stress: -15, imgs: ['y_date_motomachi'],
    sub: 'いちばん高い。そして、いちばん機嫌が戻る' },
];

/* その場所の一枚絵と、地の文。
   ⚠ 一枚絵の文字送りはタグを解釈しない（textContent）＝**<br>や<b>は書かない。**
     行を分けたいときは配列を分ける（ライバル店の台本と同じ決まり）          */
function yDateScenes(s, n, ev) {
  const w = (typeof yWife === 'function') ? yWife() : { pushed: 0, stopped: 0 };
  const img = yPickImg(s.imgs, n);
  const nm = (typeof WIFE_Y !== 'undefined') ? WIFE_Y.name : '妻';
  const first = n === 0;
  const lines = {
    yamashita: first
      ? ['風待公園。古い貨物船の前のベンチが、ひとつだけ空いていた。',
         '二人とも、しばらく何も言わなかった。',
         '「……こうやって座るの、いつ以来かしら」',
         '思い出せなかった。開店の準備を始めてからは、たぶん一度もない。',
         '海の風が、湯の匂いを少しだけ剥がしていった。']
      : ['また風待公園まで歩いた。ベンチは埋まっていたので、柵にもたれて海を見た。',
         '対岸の倉庫の上に、うちのビルの給水塔が見える気がした。',
         '「あれ、うちじゃない？」と' + nm + 'が指した先は、まったく別のビルだった。',
         '二人で笑った。笑ってから、少し黙った。'],
    chuka: first
      ? ['旧貿易地区。大通りの提灯が、まだ日の高いうちから灯っていた。',
         '二人で入った店は、昼から満席だった。',
         '厨房が見える席で、' + nm + 'はずっと鍋を振る手を見ていた。',
         '「あの人、何十年やってるんでしょうね」',
         '——同じことを、二十年後に言われる店にしたい。']
      : ['旧貿易地区で飯を食った。',
         '注文を取りに来た若い店員が、二人ぶんの取り皿を黙って置いていった。',
         '「気が利くわね」と' + nm + '。',
         'ああいうのを、うちのバイトにも覚えてほしい。'],
    akarenga: first
      ? ['旧香料倉庫。広場で何かの催しをやっていて、人が渦を巻いていた。',
         '出店の行列を、二人で端から数えた。',
         '「あそこ、四十人待ってる。何を売ってるの？」',
         '見に行ったら、ただのホットドッグだった。',
         '——並ばせる理由は、味だけじゃない。']
      : ['旧香料倉庫。今日は別の催しに変わっていた。',
         '同じ広場で、同じくらいの人が並んでいる。',
         '売っているものだけが、毎回違う。',
         '「うちの黒板も、毎週書き換えたら並ぶかしらね」'],
    minato: first
      ? ['外気ベイ。観覧車の順番待ちに、三十分並んだ。',
         '上がりきったところで、' + nm + 'が窓に額をつけた。',
         '「……ねえ、うちのビルってどれ？」',
         '熱波銀座のほうを指した。夜の底に、小さな灯りが並んでいる。',
         'そのどれかが、うちだった。どれかは、分からなかった。']
      : ['外気ベイまで出た。',
         '観覧車には乗らず、下の広場のベンチで缶コーヒーを飲んだ。',
         '「乗らなくても、ここから見えるものね」',
         '街は、上から見ても下から見ても、同じだけ明るかった。'],
    motomachi: first
      ? ['水明商店街。' + nm + 'の買い物に、久しぶりに付き合った。',
         '三軒めで、彼女は値札を見て棚に戻した。',
         '俺がそれを黙って取って、レジへ持っていった。',
         '店を出るまで、彼女は何も言わなかった。',
         '「……ありがと」と言ったのは、坂を下りきってからだった。']
      : ['水明の坂を、また二人で歩いた。',
         '今日は彼女のほうが先にレジへ行った。',
         '袋の中を見せてくれない。',
         '「あなたの。サウナ用の、いいタオル」'],
  }[s.id];
  /* **押し切られた回数が多い日は、最後の一行が変わる**（作者指定の温度差）。
     機嫌の数字ではなく、場面のほうで返す */
  const tail = (w.pushed > w.stopped + 2)
    ? ['帰り道、店の話をしようとして、やめた。',
       '今日は、それをしない日だと決めていた。']
    : [];
  return yScene(img, lines.concat(ev ? ev.lines : []).concat(tail));
}

/* ============ その日の行き先は、選ばない（作者決定 2026-08-07）============
   **どこへ行くかは決めない。** 出かけると決めた朝に、行き先のほうが決まっている。
   選べてしまうと「いちばん機嫌が戻る水明」しか行かなくなり、
   風待公園の静けさも、旧香料倉庫の人だかりも、一度も見ないまま終わる。

   ・払えない行き先は候補から外す（財布の中身が、行ける範囲を決める）
   ・**直前と同じ場所には続けて行かない**＝絵と場面が一巡りしやすくなる       */
function yPickSpot(list, cash, lastId) {
  let pool = list.filter(s => cash >= s.cost);
  if (!pool.length) return null;
  if (pool.length > 1 && lastId) {
    const others = pool.filter(s => s.id !== lastId);
    if (others.length) pool = others;
  }
  return pool[(Math.random() * pool.length) | 0];
}

function yGoDateRandom() {
  const s = yPickSpot(DATE_SPOTS_Y, G.cash, G.ch2 && G.ch2.lastDate);
  if (!s) { toast('どこへ行くにも、金が足りない…'); return null; }
  G.ch2.lastDate = s.id;
  yGoDate(s);
  return null;                        // 絵のほうで結果まで出すので、ここでは何も返さない
}

function yGoDate(s) {
  const been = (G.ch2.dateBeen = G.ch2.dateBeen || {});
  const n = been[s.id] | 0;
  been[s.id] = n + 1;
  G.cash -= s.cost;
  const w = (typeof yWife === 'function') ? yWife() : null;
  /* **出かけた日は、押し切った回数が戻る。**（従来の「妻と出かける」と同じ）
     水明だけは、彼女のために使った日なので余分に戻る */
  if (w) w.pushed = Math.max(0, w.pushed - (s.id === 'motomachi' ? 3 : 2));
  yStamAdd(s.stam); yMoodAdd(s.mood, s.name); yStressAdd(s.stress, s.name);
  log('💗 ' + s.name + 'へ出かけた（' + yen(s.cost) + '）');
  /* その日の出来事。**選択のあるものは、絵が終わってから聞く**（先に効かせない） */
  const ev = yPickEvent(SPOT_EVENTS_Y[s.id]);
  const note = (ev && !ev.choose) ? yApplyEvent(ev) : '';
  const text = '<b>' + s.name + '</b>へ出かけた。<br>' + s.sub
             + (note ? '<br><br>' + note : '');
  yPlayOffdayScenes(yDateScenes(s, n, ev), text,
    (ev && ev.choose) ? (() => yEventChoice(ev, text)) : null);
}

/* ============================================================
   ② 買い出し
   ------------------------------------------------------------
   **金を出すほど当たりが出る。** 安い地下街は割引が薄く掘り出し物も出にくい。
   郊外の大型店はいちばん高いが、値引きも掘り出し物の確率もいちばん高い
   ＝「今日はどこまで賭けるか」を選ばせる
   ============================================================ */
const KAIDASHI_SPOTS_Y = [
  /* id は 'marinard' のまま（G.ch2.lastKai がセーブに残るので変えない）。名前だけ架空へ */
  { id: 'marinard', name: 'ととのい中央駅の地下街', cost: 2000, waribiki: 0.06, bargain: 0.30,
    imgs: ['y_kai_marinard'], sub: '安いが、置いているものは限られる' },
  { id: 'isezaki', name: '熱波銀座モール', cost: 5000, waribiki: 0.10, bargain: 0.55,
    imgs: ['y_kai_isezaki1', 'y_kai_isezaki2'], sub: '業務用の店と古道具屋。うちの地元' },
  /* 店名は「スーパーヴィヒタ」（作者命名 8/9・ヴィヒタ=白樺の束＝郊外の白樺台地に建つ） */
  { id: 'mall', name: 'スーパーヴィヒタ（ヴィヒタ台）', cost: 8000, waribiki: 0.15, bargain: 0.75,
    imgs: ['y_kai_mall1', 'y_kai_mall2'], sub: '一日がかり。そのぶん、置いていないものが無い' },
];

function yKaidashiScenes(s, n, hit, ev) {
  const img = yPickImg(s.imgs, n);
  const lines = {
    marinard: ['ととのい中央駅の地下街。蛍光灯の白い光が、通路の端まで同じ明るさで続いている。',
               '業務用の洗剤とタオルを、まとめて安く買った。',
               '地上に出たら、まだ昼だった。'],
    isezaki: ['熱波銀座モール。自分の店から歩いて行ける距離に、必要なものはたいてい揃う。',
              '古道具屋の親父が、奥から椅子を引っ張り出してきた。',
              '「これ、去年潰れたサウナのだよ。使うかい」'],
    mall: ['電車を乗り継いで、ヴィヒタ台の「スーパーヴィヒタ」まで出た。',
           '一階から四階まで、同じ種類の棚が延々と続いている。',
           'こういう店を見ると、自分の店の狭さが分かる。',
           '——狭さは、悪いことばかりでもない。'],
  }[s.id];
  const tail = hit
    ? ['帰り際、値札の違うものが一点だけ出てきた。', '「' + hit.name + '。これ、持っていきな」']
    : [];
  return yScene(img, lines.concat(ev ? ev.lines : []).concat(tail));
}

function yGoKaidashiRandom() {
  const s = yPickSpot(KAIDASHI_SPOTS_Y, G.cash, G.ch2 && G.ch2.lastKai);
  if (!s) { toast('買い出しに出る金も無い…'); return null; }
  G.ch2.lastKai = s.id;
  yGoKaidashi(s);
  return null;
}

function yGoKaidashi(s) {
  const been = (G.ch2.kaiBeen = G.ch2.kaiBeen || {});
  const n = been[s.id] | 0;
  been[s.id] = n + 1;
  G.cash -= s.cost;
  yStamAdd(25); yMoodAdd(2, s.name); yStressAdd(0, s.name);
  /* ⚠ **全設備の割引と、掘り出し物（特定の1点だけ安い）は同時に出さない**（作者指定 8/10）。
     以前は両方を重ねて掛けていたので、「全部10%引き＋この1点は40%引き」の日ができ、
     どちらが効いているのか分からないうえ、買い出し1回の値打ちが日によって跳ねていた。
     **掘り出し物が出た日は、その1点だけ。出なかった日は、全部が少し安い。**
     期限はどちらも3日（作者指定 8/10・以前は7日）                            */
  const hit = (typeof yBargainPick === 'function') ? yBargainPick(s.bargain) : null;
  let text = '<b>' + s.name + '</b>で買い出しをした。';
  if (hit) {
    G.ch2.waribikiUntil = 0; G.ch2.waribikiPct = 0;     // 全設備の割引は掛けない
    G.ch2.sale = { id: hit.id, pct: hit.pct, until: G.day + 3 };
    text += '<br><br>店の奥から一点だけ、値札の違うものが出てきた。<br>'
          + '<b>「' + hit.name + '」が' + Math.round(hit.pct * 100) + '%引き。</b>'
          + '<span class="opt-sub">（3日間）</span>';
    log('🛍 掘り出し物：' + hit.name + ' が' + Math.round(hit.pct * 100) + '%引き（3日間）');
  } else {
    G.ch2.sale = null;                                   // 前の掘り出し物を引きずらない
    G.ch2.waribikiUntil = G.day + 3;
    G.ch2.waribikiPct = s.waribiki;            // 行き先ごとの割引率（yEqDiscount が見る）
    text += '<br><b>これから3日間、設備が' + Math.round(s.waribiki * 100) + '%引きで入る。</b>';
  }
  log('🛍 ' + s.name + 'で買い出し（' + yen(s.cost) + '）');
  const ev = yPickEvent(KAI_EVENTS_Y[s.id]);
  const note = ev ? yApplyEvent(ev) : '';
  if (note) text += '<br><br>' + note;
  yPlayOffdayScenes(yKaidashiScenes(s, n, hit, ev), text);
}

/* ============================================================
   ③ ロウリュ街の夜（行き先は変わらないが、路地の絵が毎回変わる）
   ============================================================ */
const NOGE_IMGS_Y = ['y_noge1', 'y_noge2', 'y_noge3', 'y_noge4'];
/* ロウリュ街で覚えるもの。**通うほど、人の見分けがつくようになる**＝
   スカウトの夜そのものではなく、「顔ぶれを見る目」のほうが身につく */
function yNogeLearn() {
  const got = yLearn('mitate');
  return '<br><br>隣に座った男が、店の若い衆を顎で指して言った。<br>'
       + '「あれは続くよ。手より先に目が動くもん」<br>'
       + '——言われてみると、そう見えてくる。'
       + yLearnNote('mitate', got);
}
function yNogeScenes() {
  const n = (G.ch2 && G.ch2.jinmyaku) | 0;
  const img = yPickImg(NOGE_IMGS_Y, n - 1);
  const lines = n <= 1
    ? ['ロウリュ街。飲み屋の看板が、路地の両側から頭の上まで迫ってくる。',
       'どの店も狭い。狭いから、隣の客と肩がぶつかる。',
       'ぶつかれば、たいてい話が始まる。']
    : ['ロウリュ街の路地。何度か通ううちに、暖簾をくぐる店が決まってきた。',
       '「いらっしゃい」の前に、もう座る場所が空けてある。',
       '——常連というのは、こういう気分か。'];
  return yScene(img, lines);
}

/* ============================================================
   ④ コード絵を朝の画面に出す部品
   ------------------------------------------------------------
   Story の外（朝の画面・結果画面）は innerHTML で差し込むので <script> が走らない。
   → canvas に data-yart="キー" を付けておき、常駐の描き直しループが
     画面上の canvas を見つけて StoryArt.draw で塗る（湯気・観覧車が動き続ける）。
   canvas が1枚も無ければ querySelectorAll が空を返すだけ＝実質タダ           */
function yArtVisual(key) {
  if (typeof StoryArt === 'undefined' || !StoryArt[key]) return '';
  return '<div class="y-visual"><canvas width="360" height="200" data-yart="' + key + '"></canvas></div>';
}
setInterval(() => {
  if (typeof StoryArt === 'undefined') return;
  document.querySelectorAll('canvas[data-yart]').forEach(cv => {
    if (StoryArt[cv.dataset.yart]) StoryArt.draw(cv.getContext('2d'), cv.dataset.yart);
  });
}, 150);

/* 倒れた日（病院の診察室） */
function yHospitalVisual() { return yArtVisual('y_hospital'); }

/* ============================================================
   共通：一枚絵を流してから、朝の画面へ戻る
   ------------------------------------------------------------
   ライバル店めぐりは絵のあと一日が終わる（yEndOffDay）が、
   **寄り道はそのあと出勤できる**（OFFDAY_Y の説明どおり）ので、
   絵が終わったら朝の画面を開き直して【🏮 出勤する】を出す
   ============================================================ */
/* ============ 行き先の一枚絵を、出勤するまで出し続ける（作者指定 8/8）============
   これまでは一枚絵が終わった瞬間に消えて、朝の画面には文章だけが残っていた。
   ＝どこへ行った話なのかが、決めるときの画面から消える。
   最後に見せた絵を覚えておいて、【🏮 出勤する】を押すまで上に出しておく    */
let Y_SPOT_ART = null;
function ySetSpotArt(a) { Y_SPOT_ART = a || null; }
function ySpotVisual() {
  if (!Y_SPOT_ART) return '';
  /* コード絵があればそれを（お出かけ先は全部こちら）。無いキーだけ webp に落ちる */
  const code = yArtVisual(Y_SPOT_ART);
  if (code) return code;
  const src = (typeof STORY_IMG !== 'undefined' && STORY_IMG[Y_SPOT_ART])
            || ('assets/story/' + Y_SPOT_ART + '.webp');
  return '<div class="y-visual"><img src="' + src + '" alt="" '
       + 'onerror="this.parentElement.style.display=\'none\'"></div>';
}
function yPlayOffdayScenes(scenes, text, after) {
  const done = () => { yOpenDayScreen(); if (after) after(); else yShowResult(text); };
  if (typeof Story === 'undefined' || !scenes || !scenes.length) { done(); return; }
  ySetSpotArt(scenes[scenes.length - 1].art);      // 最後の絵を朝の画面に残す
  Story.play(scenes, done);
  yCloseDayScreen();
}

/* ============================================================
   その場で決める出来事（作者指定 2026-08-07）
   ------------------------------------------------------------
   **休みの日にも、決めることがある。** ロウリュ街のスカウトと同じ形＝
   絵が終わったところで2択を出し、選んだほうの結末を結果画面に書く。
   どちらを選んでも一日は終わる（【🏮 出勤する】へ進む）
   ============================================================ */
function yEventChoice(ev, text) {
  const box = document.getElementById('offdayBody');
  /* 題名は**いま何を決めているか**にする（作者指摘 8/8）。
     三代目を雇うかどうかの画面に「今日は何をする？」と出ていた */
  document.getElementById('offdayTitle').textContent =
    (ev.choose === 'chuka') ? '🧑‍🔧 雇いますか？' : '🌤 今日は何をする？';
  document.getElementById('offdayNote').innerHTML = ySpotVisual() + text;
  box.innerHTML = '';
  document.getElementById('btnOffdayClose').classList.add('hidden');
  // 三代目の顔と経歴を、選ぶ前に見せる
  if (ev.choose === 'chuka' && typeof yScoutProfile === 'function') {
    const p = yChukaPool();
    if (p) { const d = document.createElement('div'); d.innerHTML = yScoutProfile(p); box.appendChild(d); }
  }
  const grid = document.createElement('div');
  grid.className = 'y-cmd-grid';
  const opts = (ev.choose === 'chuka') ? yChukaChoice(text) : yMotomachiChoice(text);
  for (const o of opts) {
    const b = document.createElement('button');
    b.className = 'y-cmd' + (o.go ? ' go' : '');
    b.disabled = !!o.disabled;
    b.innerHTML = '<b>' + o.label + '</b>'
      + (o.cost ? '<span class="y-cmd-cost">' + yen(o.cost) + '</span>' : '')
      + '<span class="y-cmd-sub">' + o.sub + '</span>';
    b.onclick = o.on;
    grid.appendChild(b);
  }
  box.appendChild(grid);
}

/* 旧貿易地区の三代目。**断ったら二度と声を掛けられない**（ロウリュ街と同じ決まり） */
function yChukaChoice(text) {
  const p = yChukaPool();
  return [
    { label: '🥟 雇う', go: true, cost: 0,
      sub: '日給' + yen(staffWageOf(p)) + '。持ち場はこちらで決める。あとで動かせる',
      on: () => { yScoutHire(p);
        yShowResult(text + '<br><br><b>「……ありがとうございます。明日から行きます」</b><br>'
          + '前掛けを外して、深く頭を下げた。');
        if (typeof yAfterScoutHire === 'function') yAfterScoutHire(); } },
    { label: '🙇 今日はやめておく', sub: 'この人には、二度と声を掛けられない',
      on: () => { if (!G.ch2.scoutNo) G.ch2.scoutNo = []; G.ch2.scoutNo.push(CHUKA_PID_Y);
        log('🥟 旧貿易地区で三代目の話を聞いたが、雇わなかった');
        yShowResult(text + '<br><br>「今は、人を増やせる時期じゃないんだ」<br>'
          + '若い衆は笑って、また皿を運びに行った。'
          + '<span class="opt-sub">——次に来ても、あの話はもう出ない</span>'); } },
  ];
}

/* 水明商店街。**値札を見て棚に戻したものを、買ってやるか** */
const MOTOMACHI_GIFT_Y = 15000;
function yMotomachiChoice(text) {
  const can = G.cash >= MOTOMACHI_GIFT_Y;
  return [
    { label: '🎁 黙って買う', go: true, cost: MOTOMACHI_GIFT_Y, disabled: !can,
      sub: can ? '彼女の機嫌が、いちばん上まで戻る' : '※金が足りない',
      on: () => { G.cash -= MOTOMACHI_GIFT_Y;
        yMoodAdd(100, '水明で買ってやった');           // 上限で頭打ち＝満タンになる
        const w = yWife(); w.pushed = 0;               // 押し切った回数も、この日は帳消し
        log('🎁 水明で' + WIFE_Y.name + 'に買った（' + yen(MOTOMACHI_GIFT_Y) + '）');
        /* **黙って買った回数だけ、彼女の顔色が読めるようになる**（作者指定 8/7）＝
           値札を見て戻した手つきに気づけた人にだけ、【察しがいい】が付く */
        const got = yLearn('sasshi');
        yShowResult(text + '<br><br>レジで包んでもらって、袋のまま渡した。<br>'
          + '「……高かったでしょう」<br>'
          + '「言うな」<br>'
          + '<b>' + WIFE_Y.name + 'の機嫌が、いちばん上まで戻った。</b>'
          + yLearnNote('sasshi', got)); } },
    { label: '👀 気づかないふりをした', sub: '金は減らない。ただ、見なかったことにはならない',
      on: () => { yStressAdd(8, '水明'); 
        yShowResult(text + '<br><br>見なかったことにして、店を出た。<br>'
          + '坂を下りながら、彼女は別の話をしていた。<br>'
          + '<span class="opt-sub">——その話の内容を、俺はひとつも覚えていない</span>'); } },
  ];
}

/* ============================================================
   休みの日の「出来事」（作者指定 2026-08-07）
   ------------------------------------------------------------
   行き先はランダムだが、**その場所で何が起きるかも、その日に決まる。**
   出来事は1回の外出につき1つ。行き先の基本の効き（DATE_SPOTS_Y）に上乗せする。

   ── 決まりごと ────────────────────────────
   ・**その場所でしか起きないこと**を書く。どこでも起きる話は書かない
   ・**得ばかりにしない。** 人混みで疲れる／腹を壊す／うっかり店の話をする——
     休みの日にも失敗はある。それがあるから、当たりの日が当たりになる
   ・持続効果（原価・速さ・値引き）は日数で切る＝**その数日だけ店が変わる（値引きは3日）**
   ・`w` は出やすさ。`need` が false を返す日は候補から外れる
   ============================================================ */

/* 出来事の効き目を、まとめて反映する */
/* ゲージを使わない章（`gauges: false`）では、出来事の文から
   「体力+15」「機嫌−8」「ストレス−10」といった**もう存在しない数字**を落とす。
   台本そのものは書き換えない＝旗を戻せば元の文がそのまま出る（作者指定 8/8） */
function yStripGauge(s) {
  if (!s || CONF.gauges) return s || '';
  return String(s)
    .replace(/[／\/、]?\s*(妻の機嫌|体力|機嫌|ストレス)\s*[+\-−＋]?\s*\d+/g, '')
    .replace(/／\s*(<|$)/g, '$1')          // 落とした跡に残る区切りを掃除
    .replace(/(^|<br>)\s*／/g, '$1')
    .replace(/\s{2,}/g, ' ');
}

function yApplyEvent(e) {
  if (!e) return '';
  /* 街で覚えるもの。**効き目とは別枠**なので、金や体力の増減とは重ならない */
  let learned = '';
  if (e.learn) learned = yLearnNote(e.learn, yLearn(e.learn));
  if (e.cash) G.cash += e.cash;                       // マイナスで書く（−¥2,000 なら cash: -2000）
  if (e.stam) yStamAdd(e.stam);
  if (e.mood) yMoodAdd(e.mood, e.name);
  if (e.stress) yStressAdd(e.stress, e.name);
  if (typeof e.apply === 'function') e.apply();
  if (e.log) log(e.log);
  return yStripGauge(e.note || '') + learned;
}
/* 期限つきの効き目（日数で切れる） */
function yBuff(key, val, days) { G.ch2[key] = { ...val, until: G.day + days }; }
function yBuffOn(key) { const b = G.ch2 && G.ch2[key]; return (b && G.day <= b.until) ? b : null; }

/* ============================================================
   おでかけで覚えるもの（作者指定 2026-08-07）
   ------------------------------------------------------------
   休みの日に積み上がるものは、これまで**筋トレ（体力の上限）**と
   **講習（サウナ専門家）**の2つだけだった。そこへ**街で覚えるもの**を足す。

   ・**一度で覚えない。** 同じものを何度か見て、やっと身につく
   ・**効くのは店のほう。** 覚えた本人が強くなるのではなく、店の回り方が変わる
   ・行き先はランダムなので、狙って取れない＝**通ううちに、いつのまにか身についている**
   ============================================================ */
/* `need` ＝**その場面に何度出くわせば身につくか。**
   行き先がランダムなので、3回にすると一生届かない（実測：ひとつ覚えるのに外出50回）。
   2回にしたうえで、**まだ覚えていない場面は出やすくする**（yPickEvent の重み×6）＝
   その場所へ3回ほど通えば身につき、覚えたあとは他の出来事が出るようになる     */
const OUT_SKILLS_Y = {
  ashirai:   { name: '🤹 あしらい上手', need: 2, note: '番台の行列で、客が粘るようになる' },
  mekiki:    { name: '🥟 目利き',       need: 2, note: '食材の原価が、いつでも8%安い' },
  miseru:    { name: '🪧 見せ方上手',   need: 2, note: '外の看板が、3割よく効くようになる' },
  sasshi:    { name: '💗 察しがいい',   need: 2, note: '妻の機嫌が、半分しか下がらなくなる' },
  machinome: { name: '🎡 街の目',       need: 2, note: '街から来る客が、5%増える' },
  mitate:    { name: '🍶 人の見立て',   need: 2, note: '面接に来る人が、ひとり増える' },
  negiri:    { name: '🏷 値切り上手',   need: 2, note: '設備が、いつでも5%安く入る' },
};
if (typeof SKILL_NAME_Y !== 'undefined') {
  for (const k in OUT_SKILLS_Y) SKILL_NAME_Y[k] = OUT_SKILLS_Y[k].name;
}
/* 1回ぶん身につける。覚えきったら true */
function yLearn(key) {
  const c = G.ch2; if (!c) return false;
  c.learn = c.learn || {};
  c.learn[key] = (c.learn[key] || 0) + 1;
  const s = OUT_SKILLS_Y[key];
  if (c.learn[key] >= s.need && !yHasSkill(key)) { yGainSkill(key); return true; }
  return false;
}
/* 結果画面の一行。**あと何回で身につくかを、その場で出す**＝
   ランダムでも「積み上がっている」ことが分かる */
function yLearnNote(key, got) {
  const s = OUT_SKILLS_Y[key], n = ((G.ch2.learn || {})[key] || 0);
  if (got) return '<br><b>✨【' + s.name + '】を覚えた。</b><span class="opt-sub">' + s.note + '</span>';
  if (yHasSkill(key)) return '';
  return '<span class="opt-sub">（' + s.name + 'まで、あと' + Math.max(1, s.need - n) + '回）</span>';
}

/* ---- 覚えたものが、店のどこに効くか ---- */
/* 🤹 あしらい上手：番台の行列で客が粘る（game.js が chHook で引く。第1章は 1.0） */
function yWaitPatience() { return yHasSkill('ashirai') ? 1.35 : 1; }
registerChapter2Hooks({ waitPatience: yWaitPatience });
/* 🥟 目利き：食材の原価（yMenuCost が足し合わせる） */
function ySkillGenkaOff() { return yHasSkill('mekiki') ? 0.08 : 0; }
/* 🪧 見せ方上手：外の看板の効き（yGaikanGuests に掛かる） */
function ySkillGaikanMul() { return yHasSkill('miseru') ? 1.3 : 1; }
/* 🎡 街の目：街から来る客（yGuestAdjust に掛かる） */
function ySkillGuestMul() { return yHasSkill('machinome') ? 1.05 : 1; }
/* 💗 察しがいい：機嫌の下がり方（yMoodAdd が下げる時だけ掛かる） */
function ySkillMoodDownMul() { return yHasSkill('sasshi') ? 0.5 : 1; }
/* 🍶 人の見立て：面接に来る人数（yJobPoolN が足す） */
function ySkillJobAdd() { return yHasSkill('mitate') ? 1 : 0; }
/* 🏷 値切り上手：設備がいつでも安く入る（yEqDiscount が足す） */
function ySkillEqOff() { return yHasSkill('negiri') ? 0.05 : 0; }

/* 「旧貿易地区の三代目」＝街の絵とバイトの顔ぶれが繋がっている、唯一の人 */
const CHUKA_PID_Y = 'y_chuka';
function yChukaHired() { return (G.roster || []).some(e => e.pid === CHUKA_PID_Y); }
function yChukaPool() { return (typeof STAFF_POOL !== 'undefined') && STAFF_POOL.find(p => p.pid === CHUKA_PID_Y); }

const SPOT_EVENTS_Y = {
  /* ── 旧香料倉庫 ── 人が多い。人が多い店を、外から見られる場所 ── */
  akarenga: [
    { id: 'konzatsu', name: '人混み', w: 3, stam: -15, stress: 10,
      lines: ['広場の人の流れが、途中から一方通行になった。',
              '押し戻されるように端へ寄って、二人で息をついた。',
              '「……人の多い店って、外から見るとこうなのね」'],
      note: '人混みに疲れた。<b>体力−15・ストレス+10</b>' },
    { id: 'beer', name: 'ビール', w: 3, cash: -2000, stress: -8, mood: 8,
      lines: ['出店のビールを一杯ずつ買って、海に向かって立ったまま飲んだ。',
              '昼から飲む一杯は、どうしてこんなにうまいのか。',
              '「あなた、店でも売れば？」', '——それは、うちの5階の話だ。'],
      note: 'ビールを飲んだ。<b>−¥2,000／ストレス−8・機嫌+8</b>' },
    { id: 'gyoretsu', name: '行列を数えた', w: 3, learn: 'miseru',
      lines: ['出店の行列を、二人で端から数えた。',
              '「あそこ、四十人待ってる。何を売ってるの？」',
              '見に行ったら、ただのホットドッグだった。',
              'ただ、幟の立て方と、鉄板の置き方が、通りから見て気持ちよかった。',
              '——並ばせる理由は、味だけじゃない。'],
      note: '並ばせ方を、外から見た。' },
    { id: 'sweets', name: '新作スイーツ', w: 2, cash: -4000, stam: 12, mood: 12,
      lines: ['カフェの新作だという菓子を、行列に並んで買った。',
              '一口くれと言ったら、本当に一口しかくれなかった。',
              '写真を撮ってから食べるのだと、初めて知った。'],
      note: 'カフェで新作スイーツ。<b>−¥4,000／体力+12・機嫌+12</b>' },
  ],

  /* ── 外気ベイ ── 上から街を見る場所 ── */
  minato: [
    { id: 'konzatsu', name: '人混み', w: 3, stam: -15, stress: 10,
      lines: ['連休だったらしい。改札から先が、ずっと人の列だった。',
              '歩く速さを人に合わせているうちに、脚が重くなった。'],
      note: '人混みに疲れた。<b>体力−15・ストレス+10</b>' },
    { id: 'fuku', name: '妻の服', w: 2, cash: -10000, mood: 20,
      lines: ['店の前で足が止まった彼女に、「着てみたら」と言った。',
              '鏡の前で二度振り返ったので、それが答えだった。',
              'レジで金額を見て、少しだけ息を止めた。'],
      note: '妻の服を買った。<b>−¥10,000／機嫌+20</b>' },
    { id: 'ramen', name: '家系ラーメン', w: 3, cash: -1000, stam: 15,
      lines: ['帰りに、駅の裏の家系に入った。',
              '硬め・濃いめ・多め。二人とも同じ頼み方をしていた。',
              '「……あなたと私、こういうところだけ合うわね」'],
      note: '家系ラーメンを食べた。<b>−¥1,000／体力+15</b>' },
    { id: 'muda', name: '無駄遣い', w: 2, cash: -3000, stress: -10,
      lines: ['要らないものを買った。',
              '船の形をした、置物だ。',
              '「どこに置くの、それ」', '——番台の横に置いた。悪くない。'],
      note: '無駄遣いをした。<b>−¥3,000／ストレス−10</b>' },
    /* 累計の来客が増えると、上から自分の店が「分かる」ようになる＝成長が絵で返る */
    { id: 'kanransha', name: '観覧車', w: 2, mood: 10, stress: -12, learn: 'machinome',
      need: () => (typeof yTotalGuests === 'function') && yTotalGuests() >= 1000,
      lines: ['観覧車が頂上に着いたとき、彼女が窓を指した。',
              '「あそこ。あの灯り、うちじゃない？」',
              '熱波銀座の並びに、ひとつだけ遅くまで点いている灯りがある。',
              '——今日は、どれがうちか、分かった。'],
      note: '観覧車から、自分の店の灯りが見えた。<b>機嫌+10・ストレス−12</b>' },
  ],

  /* ── 旧貿易地区 ── 飯の街。うちの5階と、いちばん近い場所 ── */
  chuka: [
    /* ① まだ雇っていないなら、その場で志望される（選択） */
    { id: 'sandaime', name: '旧貿易地区の三代目', w: 4,
      need: () => !yChukaHired() && yChukaPool() && (G.roster || []).length < CONF.maxStaff
                  && !((G.ch2.scoutNo || []).includes(CHUKA_PID_Y)),
      lines: ['入った店の若い衆が、こちらの顔を見て手を止めた。',
              '「……熱波銀座の、サウナの人ですよね」',
              '実家がこの通りの店で、三代目にはならないのだと言う。',
              '「人を捌くのは、体で覚えてます。使ってもらえませんか」'],
      choose: 'chuka' },
    /* ② もう雇っているなら、休みの日に会ったことが働きぶりになって返る */
    { id: 'sandaime2', name: '三代目に会った', w: 3,
      need: () => yChukaHired(),
      apply: () => {
        const e = G.roster.find(x => x.pid === CHUKA_PID_Y);
        if (e) e.skill = Math.min(100, (e.skill || 40) + 10);
      },
      lines: ['実家の前を通ったら、うちのバイトが立っていた。',
              '休みの日に、実家の手伝いをしているらしい。',
              '「うちの店、見ていきますか」と言って、厨房まで通された。',
              '——人の使い方は、この家で覚えたのだと分かった。'],
      note: '三代目の働きぶりが上がった。<b>働きぶり+10</b>' },
    { id: 'nikuman', name: '肉まん', w: 3, cash: -1000, stam: 12,
      lines: ['店先の蒸籠から湯気が上がっていた。',
              '歩きながら食べる肉まんは、店で食べるより確実にうまい。',
              '「行儀が悪いわよ」と言いながら、彼女も半分食べた。'],
      note: '肉まんを食べた。<b>−¥1,000／体力+12</b>' },
    { id: 'hara', name: '腹を壊した', w: 2, stam: -20, mood: -10,
      lines: ['路地を一本入ったところの店に、なんとなく入った。',
              '安かった。理由は、その晩に分かった。',
              '「……だから、あそこはやめようって言ったのよ」'],
      note: '腹を壊した。<b>体力−20・機嫌−10</b>' },
    /* 食堂を持っている日だけ意味がある＝5階を建てた人へのご褒美 */
    { id: 'shiire', name: '仕入れ先', w: 3,
      need: () => (typeof yHasKitchen === 'function') && yHasKitchen(),
      apply: () => yBuff('genkaOff', { pct: 0.10 }, 10),
      lines: ['乾物屋の親父と、値段の話になった。',
              'うちが熱波銀座でサウナの飯をやっていると言うと、奥から帳面を持ってきた。',
              '「まとめて取るなら、その値で出すよ。十日ぶんな」'],
      note: '仕入れ先を見つけた。<b>10日間、食材の原価が−10%</b>',
      log: '🥟 旧貿易地区で仕入れ先を見つけた（10日間、食材の原価−10%）', learn: 'mekiki' },
  ],

  /* ── 水明商店街 ── 彼女のための一日 ── */
  motomachi: [
    { id: 'nefuda', name: '値札', w: 5, choose: 'motomachi',
      lines: ['彼女が手に取ったものを、値札を見て、そっと棚に戻した。',
              'その手つきを、俺は前にも見たことがある。',
              '——開店の金をかき集めていた年に、何度も見た。'] },
    { id: 'lunch', name: 'カフェでランチ', w: 3, cash: -3000, mood: 10,
      lines: ['坂の途中のカフェで、遅い昼を食べた。',
              '窓から、荷物を提げて坂を上る人が見える。',
              '「うちの店にも、こういう窓があればね」', '——うちのビルに、外を向いた窓は無い。'],
      note: 'カフェでランチ。<b>−¥3,000／機嫌+10</b>' },
  ],

  /* ── 風待公園 ── 何も買わない日 ── */
  yamashita: [
    /* 押し切った回数が多い人ほど、つい店の話をしてしまう */
    { id: 'shigoto', name: '店の話', w: 4,
      need: () => { const w = yWife(); return w.pushed > w.stopped; },
      mood: -10,
      lines: ['ベンチに座って、海を見ていた。',
              '——気がついたら、増築の話をしていた。',
              '彼女は最後まで聞いて、それから言った。',
              '「今日は、その話をしない日じゃなかったの」'],
      note: 'つい店の話をしてしまった。<b>機嫌−10</b>' },
    { id: 'relax', name: '何もしない', w: 5, stress: -15,
      lines: ['何もしなかった。',
              '海を見て、船を数えて、二人とも黙っていた。',
              '——こんなに何も起きない時間は、久しぶりだった。'],
      note: 'ただ座っていた。<b>ストレス−15</b>' },
    /* **待たせ方を盗んだ週**（作者指定 8/7・元は「主人公のスピード+10%」だったが、
       効いているのが体感できなかったので差し替えた）。
       地の文が言っているのは「待たせ方がうまい」なので、効くのは**行列のほう**にした
       ＝番台に並ぶ客が粘るようになり、待ちきれず帰る客が目に見えて減る */
    { id: 'daidogei', name: '大道芸', w: 3, learn: 'ashirai',
      lines: ['広場に人だかりができていた。',
              '皿を回す男が、客の呼吸に合わせて手を止めたり、動かしたりしている。',
              '列の後ろのほうの客まで、誰ひとり抜けていかない。',
              '——待たせ方が、うまい。',
              '番台の前の、あの列のことを考えていた。'],
      note: '大道芸の、待たせ方を見た。' },
  ],
};

/* ── 買い出し先の出来事 ── */
const KAI_EVENTS_Y = {
  marinard: [
    { id: 'coupon', name: '割引クーポン', w: 3,
      apply: () => { G.ch2.waribikiPct = 0.10; G.ch2.waribikiUntil = G.day + 3; G.ch2.sale = null; },
      lines: ['通路の端で、地下街の福引をやっていた。',
              '二等。景品は、加盟店で使える割引券の束だった。'],
      note: '割引クーポンをもらった。<b>3日間、設備が−10%</b>',
      log: '🎟 駅の地下街で割引クーポン（3日間、設備−10%）' },
    { id: 'heiten', name: '閉店セール', w: 2,
      apply: () => { G.ch2.waribikiPct = 0.20; G.ch2.waribikiUntil = G.day + 3; G.ch2.sale = null; },
      lines: ['一軒が閉めるらしい。',
              '「三日で全部さばくから、好きなだけ持っていって」',
              '——安いのは嬉しい。嬉しいのだが、店を畳む人の顔は見たくない。'],
      note: '閉店セールに出くわした。<b>3日間、設備が−20%</b>',
      log: '🏷 駅の地下街の閉店セール（3日間、設備−20%）' },
    /* ↓ここから下は**何度でも出る枠**（作者指定 8/14）。
       割引にも掘り出し物にも触らない＝金とゲージと景色だけ。
       一度きりの仕掛けを足すと長く遊ぶ人ほど早く涸れるので、ここは使い回す      */
    { id: 'soba', name: '立ち食いそば', w: 3, cash: -600, stam: 8,
      lines: ['改札脇の立ち食いで、かけそばを一杯すすった。',
              '隣の男が、三分もかからずに出ていった。',
              '——回転の速さでは、どうやっても勝てない商売がある。'],
      note: '立ち食いそばを食べた。<b>−¥600／体力+8</b>' },
    { id: 'shinagire', name: '品切れ', w: 2, stress: 6,
      lines: ['いつもの洗剤の棚だけが、きれいに空いていた。',
              '「入荷、来週なんですよ」',
              '来週まで、床は待ってくれない。'],
      note: '目当ての品が無かった。<b>ストレス+6</b>' },
    { id: 'amayadori', name: '雨宿り', w: 2, stam: 6, stress: -5,
      lines: ['地上に出たら、雨だった。',
              '仕方なく地下へ戻り、ベンチで小一時間ぼんやりした。',
              '地下街は、天気を知らないままずっと明るい。'],
      note: '地下で雨宿りをした。<b>体力+6・ストレス−5</b>' },
    { id: 'jitsuen', name: '実演販売', w: 2, cash: -3400,
      lines: ['実演販売の兄さんに、名指しで呼び止められた。',
              '包丁がトマトを撫でるように切っていく。',
              '気がつくと、その包丁を持って歩いていた。',
              '——うちで切るものといえば、豆腐くらいだ。'],
      note: '実演販売に捕まった。<b>−¥3,400</b>' },
  ],
  isezaki: [
    { id: 'furudogu', name: '古道具屋', w: 3, stam: -8, learn: 'negiri',
      lines: ['古道具屋の親父が、奥から椅子を引っ張り出してきた。',
              '「これ、去年潰れたサウナのだよ。使うかい」',
              '値段を聞いて、黙っていた。',
              '親父が先に折れた。——黙っているだけで、値は動く。'],
      note: '古道具屋で長話をした。<b>体力−8</b>' },
    { id: 'yakitori', name: '焼鳥', w: 3, cash: -1200, stam: 10, stress: -6,
      lines: ['帰りに、モールの焼鳥屋で串を何本か食べた。',
              '自分の店から歩いて三分の場所に、こういう店がある。',
              '——湯上がりの客が、まっすぐここへ流れているのだろう。'],
      note: '焼鳥をつまんだ。<b>−¥1,200／体力+10・ストレス−6</b>' },
    /* ↓何度でも出る枠。**重みは低め**（w:2）＝ここは【🏷 値切り上手】を覚える
       唯一の場所なので、出来事を足しすぎると一生覚えられなくなる（yPickEvent の
       ×10 の下駄と合わせて、古道具屋がまだ7割方引けるように置いてある）        */
    { id: 'tonari', name: '隣の店の店長', w: 2, stress: -4,
      lines: ['業務用の店の前で、隣のサウナの店長と鉢合わせた。',
              '向こうも買い出しらしい。',
              '互いのかごの中は、見ないことにした。',
              '「儲かってる？」「まさか」——毎回、同じ挨拶をしている。'],
      note: '同業と立ち話をした。<b>ストレス−4</b>' },
    { id: 'kaomi', name: '顔見知り', w: 2, mood: 4, stress: -6,
      lines: ['商店街で、うちの常連に声を掛けられた。',
              '風呂着でない姿を見るのは、初めてだった。',
              '「店長、そんな格好もするんだ」',
              '——どんな格好だと思われていたのだろう。'],
      note: '外で客に会った。<b>機嫌+4・ストレス−6</b>' },
    { id: 'yoriai', name: '商店会の寄合', w: 2, cash: -3000, stam: -6,
      lines: ['買い出しの途中で、商店会の会長に捕まった。',
              '立ち話のつもりが、会費まで集められた。',
              '「熱波銀座も長いんだから、そろそろ役員やってよ」',
              '——断る言葉を探しているうちに、日が傾いた。'],
      note: '寄合に捕まった。<b>−¥3,000／体力−6</b>' },
  ],
  mall: [
    { id: 'foodcourt', name: 'フードコート', w: 3, cash: -1200, stam: 12,
      lines: ['フードコートで、遅い昼を食べた。',
              '広い。席が、見渡すかぎり空いている。',
              '——うちの5階に、この席数があったら。'],
      note: 'フードコートで昼を食べた。<b>−¥1,200／体力+12</b>' },
    { id: 'tenji', name: '展示品', w: 3,
      apply: () => { G.ch2.waribikiPct = Math.max(G.ch2.waribikiPct || 0, 0.18); G.ch2.waribikiUntil = G.day + 3; G.ch2.sale = null; },
      lines: ['売場の隅に、展示に使っていた品がまとめて置いてあった。',
              '傷はあるが、動く。',
              '「これ、値段付いてないんですけど」と言ったら、店員が奥へ走っていった。'],
      note: '展示品を分けてもらった。<b>3日間、設備が−18%</b>',
      log: '🏷 展示品の値引き（3日間、設備−18%）' },
    { id: 'tsukareta', name: '一日仕事', w: 2, stam: -12, stress: 6,
      lines: ['電車を乗り継いで、荷物を提げて、また乗り継いで帰った。',
              '着いたときには、日が暮れていた。',
              '——安く買った分は、たぶん電車賃と、この疲れで消えている。'],
      note: '往復で一日が終わった。<b>体力−12・ストレス+6</b>' },
    /* ↓何度でも出る枠 */
    { id: 'shishoku', name: '試食', w: 3, stam: 6,
      lines: ['一階から四階まで上がるあいだに、試食だけで腹がふくれた。',
              'ソーセージ、味噌汁、よく分からない健康食品。',
              '差し出す手が、どれも同じ角度をしている。',
              '——ああやって出されると、人は受け取ってしまう。'],
      note: '試食で腹がふくれた。<b>体力+6</b>' },
    { id: 'kazoku', name: '家族連れ', w: 2, mood: 6, stress: -6,
      lines: ['カートに子どもを乗せた夫婦とすれ違った。',
              '買うものを、二人で一つずつ相談している。',
              '用も無いのに、妻に電話をかけた。',
              '「どうしたの」と言われて、何でもない、と答えた。'],
      note: '家族連れを見た。<b>機嫌+6・ストレス−6</b>' },
    { id: 'reji', name: 'レジの行列', w: 2, stress: 8,
      lines: ['会計に二十分並んだ。',
              '前の客が財布を出すまで、誰も何も言わない。',
              'レジ係は目も上げず、同じ速さで手を動かしている。',
              '——うちの番台も、客からはこう見えているのだろうか。'],
      note: 'レジで待たされた。<b>ストレス+8</b>' },
    { id: 'kaikkiri', name: '棚ひとつ買い', w: 2, cash: -4000, stam: -6,
      lines: ['タオルの棚を、端から端まで買った。',
              'レジ係が二度、数を数え直した。',
              '袋は六つになった。電車が空いている時間で、本当によかった。'],
      note: '積みすぎた。<b>−¥4,000／体力−6</b>' },
  ],
};

/* その日の出来事をひとつ引く（`need` を満たすものから、`w` の重みで） */
function yPickEvent(list) {
  const pool = (list || []).filter(e => !e.need || e.need());
  if (!pool.length) return null;
  /* **まだ覚えていない場面は、出やすくする。** 行き先がランダムなので、
     ここで寄せておかないと「見たことのある景色」ばかりが続いて、
     街で覚えるものが一つも身につかないまま終わる。
     覚えたあとは重みが戻る＝その場所の他の出来事が出るようになる */
  /* ⚠ **下駄は 6 → 10**（8/14）。出来事を26→38に増やしたぶん、技を覚える場面が
     薄まる。とくに熱波銀座モールは【🏷 値切り上手】の**唯一の入り口**で、
     6 のままだと引ける割合が 86% → 62% まで落ちていた（10 で 77% に戻る）      */
  const wOf = e => (e.w || 1) * ((e.learn && !yHasSkill(e.learn)) ? 10 : 1);
  let t = pool.reduce((a, e) => a + wOf(e), 0) * Math.random();
  for (const e of pool) { t -= wOf(e); if (t <= 0) return e; }
  return pool[pool.length - 1];
}

/* ============================================================
   【✨ スキル】＝データ画面のタブ（作者指定 2026-08-07）
   ------------------------------------------------------------
   積み上がるものが9つになったので、**どこかで一覧できないと
   「何を取ったのか」も「あと何が残っているのか」も分からない。**
   【📊 データ】のタブに1枚足す（`dataTabs` / `dataPane` は元からある仕組み）。

   **取り方は問わない。** いまは休みの日の寄り道だけだが、
   店の中で身につくもの・物語で手に入るものも、この一覧に並べていく（作者指定 8/7）。

   見た目は**野球ゲームの特殊能力**の並び（作者指定）：
   ・**3列のグリッドに名前だけ**を並べる。覚えたものは金色、まだのものは沈んだ色
   ・**押すと下の一枚に説明が出る。** 画面は動かない＝並びを見ながら読み比べられる
   ・覚えたものは「何が変わったか」を書く。「＋10%」ではなく「行列で客が粘る」
   ・まだのものは**どこで覚えるか**と**あと何回か**＝次の休みの行き先になる
   ・筋トレ（体力の上限）だけは回数で終わらないので、下の一枚の初期表示に置く
   ============================================================ */
/* 並ぶ順＝覚えやすい順ではなく、**効き先が近いもの同士**を隣に置く */
const SKILL_LIST_Y = [
  { key: 'hatarakimono', how: '休みの日に【🔧 店に出る】',
    note: '立っている1時間あたりの消耗が半分になる。自分で直す手も早くなる',
    need: 5, count: () => (G.ch2.hatarakuCount | 0) },
  { key: 'senmonka', how: '【🎓 講習を受ける】',
    note: '🔥サウナの評価が10上がる',
    need: 3, count: () => (G.ch2.koushu | 0) },
  { key: 'ashirai', how: '妻と出かける → 風待公園（大道芸）', out: true },
  { key: 'miseru', how: '妻と出かける → 旧香料倉庫（行列）', out: true },
  { key: 'mekiki', how: '妻と出かける → 旧貿易地区（乾物屋）', out: true, sub: '※5階に厨房がある日だけ' },
  { key: 'sasshi', how: '妻と出かける → 水明商店街（値札を黙って買う）', out: true },
  { key: 'machinome', how: '妻と出かける → 外気ベイ（観覧車）', out: true, sub: '※累計1,000人から' },
  { key: 'mitate', how: '【🍶 ロウリュ街で飲む】', out: true },
  { key: 'negiri', how: '【🛍 買い出し】→ 熱波銀座モール（古道具屋）', out: true },
];

function ySkillPane() {
  const cells = SKILL_LIST_Y.map(sk => {
    const got = yHasSkill(sk.key);
    return `<button class="sk-chip${got ? ' got' : ''}" onclick="ySkillTap('${sk.key}')">${
      SKILL_NAME_Y[sk.key] || sk.key}</button>`;
  }).join('');
  const n = SKILL_LIST_Y.filter(sk => yHasSkill(sk.key)).length;
  const up = (G.ch2.stamUp | 0);
  /* **「街で覚えたもの」とは書かない**（作者指定 8/7）＝
     街の外で身につくものが、この先いくらでも増える。見出しは中身を限定しない */
  return `<p class="modal-note">取得済み <b>${n}／${SKILL_LIST_Y.length}</b>
      <span class="opt-sub">　名前を押すと、何が変わるかが出る</span></p>
    <div class="sk-grid">${cells}</div>
    <div id="skDetail" class="sk-detail">💪 <b>鍛えた体</b>　体力の上限 ${yStamMax()}
      <span class="opt-sub">${up ? '（筋トレ' + Math.round(up / STAM_TRAIN_UP_Y) + '回ぶん +' + up + '）'
                                : '（まだ鍛えていない。休みの日に【💪 筋トレ】）'}</span></div>`;
}

/* 名前を押したときに、下の一枚に説明を出す（画面は動かない） */
function ySkillTap(key) {
  const box = document.getElementById('skDetail'); if (!box) return;
  const sk = SKILL_LIST_Y.find(x => x.key === key); if (!sk) return;
  const o = OUT_SKILLS_Y[key];
  const name = SKILL_NAME_Y[key] || key;
  const note = sk.note || (o && o.note) || '';
  if (yHasSkill(key)) {
    box.className = 'sk-detail got';
    box.innerHTML = `<b>${name}</b>　${note}`;
    return;
  }
  const need = sk.out ? (o ? o.need : 2) : sk.need;
  const now = sk.out ? (((G.ch2.learn || {})[key]) | 0) : sk.count();
  box.className = 'sk-detail';
  box.innerHTML = `<b>${name}</b>　${note}
    <span class="opt-sub">${sk.how}　<b>あと${Math.max(1, need - now)}回</b>${sk.sub ? '／' + sk.sub : ''}</span>`;
}

/* データ画面のタブに1枚足す。**dataTabs / dataPane は battle_y が先に登録している**ので、
   上書きせずに繋ぐ（フックは1名につき1つしか持てない） */
const yPrevDataTabs = (typeof yDataTabs === 'function') ? yDataTabs : () => [];
const yPrevDataPane = (typeof yDataPane === 'function') ? yDataPane : () => null;
registerChapter2Hooks({
  dataTabs: () => (yPrevDataTabs() || []).concat([['skill', '\u2728 スキル']]),
  dataPane: (t) => (t === 'skill' ? ySkillPane() : yPrevDataPane(t)),
});

