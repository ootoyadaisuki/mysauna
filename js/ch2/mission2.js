'use strict';

/* ============================================================
   第2章の依頼（ミッション）
   ------------------------------------------------------------
   第1章の田所・黒田の「注文」と同じ役目だが、中身は全部別物。
   第1章のコードには一切触らず、この1ファイルで完結させる（作者指定＝別ゲーム）。

   ── 一件目：桑田芳雄（くわた よしお）──────────────────────
   前の店「健康ランド ゆらぎ」に二十年通った常連。寒川の店の、最後の客のひとり。

   **褒めない。最後まで褒めない。** 口を開けば「前の方が良かった」。
   注文は無茶で、いちいち癪に障る。だが、ひとつ残らず**筋が通っている**。
   全部聞いてやると評判が30まで上がり、この爺さんは仲間を連れてくる。

   ここが第2章の入口にいちばん向いている理由：
   ・**残置物を残す／捨てるの判断**（石床）に、はじめて理由が生まれる
   ・**ボロい初期設備を買い替える**きっかけになる（22℃の水風呂）
   ・**料金と客足の関係**を体で覚えさせられる（安くしろ）
   ・そして――**前の店は負けた店だ。** その客の言うことを聞く意味は、
     プレイヤー自身が最後まで疑いながら進むことになる
   ============================================================ */

const KUWATA_REP = 6;              // 注文ひとつ聞くごとの評判（5件で+30）
const KUWATA_GUESTS = 12;          // 全部応えたときに増える1日の客数

/* 依頼の一覧。ok() が true になったら、次に桑田が来たときに認められる */
const KUWATA_ASKS = [
  {
    key: 'milk',
    title: '牛乳を置け',
    ask: '「……おい。<b>風呂上がりに牛乳が飲めねえ風呂屋</b>があるか。」<br>' +
         '「前はな、番台の横に冷蔵ケースがあってな。腰に手ぇ当てて飲むんだよ。<br>' +
         'あれが無えんじゃ、上がった意味がねえだろうが。」',
    label: 'ロビーに冷蔵ケース（ドリンク自販機・物販棚・アイスケースのどれか）を置く',
    ok: () => G.equip.some(e => ['f2_vend', 'f2_goods', 'f2_ice'].includes(e.id) && e.cond > 0),
    ok_line: '「……フン。まあ、置いたか。」<br>「言っとくが、褒めてねえからな。<b>あって当たり前</b>のもんだ。」',
  },
  {
    key: 'ganban',
    title: '石床を剥がすな',
    ask: '「休憩んとこの、<b>あの石床</b>。あれ剥がすんじゃねえだろうな。」<br>' +
         '「二十年、あそこで寝てたんだ。婆さんが生きてた頃はな、二人で並んで寝てたんだよ。」<br>' +
         '「……金にならんのは知っとる。それでも、だ。」',
    label: '岩盤浴の石床を【残す】で決着させる（撤去・売却したら二度と戻らない）',
    ok: () => {
      const it = G.equip.find(e => e.id === 'z2_ganban');
      return !!(it && it.keep);
    },
    fail: () => !G.equip.some(e => e.id === 'z2_ganban'),   // 剥がしてしまったら失敗が確定する
    fail_line: '「……剥がしやがったな。」<br>「いや、いい。あんたの店だ。あんたの店だよ。」<br>' +
               '<span class="mika-note">桑田は、それきり石床の話をしなかった。</span>',
    ok_line: '「……残したか。」<br>「そうか。」<br>' +
             '<span class="mika-note">桑田はそれだけ言って、石床のほうを長いこと見ていた。</span>',
  },
  {
    key: 'mizu',
    title: '水風呂がぬるい',
    ask: '「あの水風呂、何度だ。<b>二十二度？</b> それは水風呂じゃねえ。ぬるま湯だ。」<br>' +
         '「前の店はな、十六度でキンキンだったんだ。あれに入るために通ってたんだよ。」<br>' +
         '「……チラーが死んでんだろ。分かってて言ってんだ。」',
    label: '男湯に18℃以下の水風呂を置く（ヒビ割れた水風呂は22℃）',
    ok: () => G.equip.some(e => {
      const d = EQ[e.id];
      return d && d.cat === 'mizu' && e.cond > 0 && (d.temp ?? 99) <= 18 && (e.f | 0) === AR.OTOKO;
    }),
    ok_line: '「……入ってきた。」<br>「悪くねえ。」<br>' +
             '<span class="mika-note">「悪くねえ」は、この爺さんの最上級だと後で知った。</span>',
  },
  {
    key: 'fee',
    title: '高い',
    ask: '「高い。」<br>「前は七百円だったぞ。それがなんだ、この値段は。」<br>' +
         '「わしみたいな年寄りが毎日来られる値段にしろ。<b>毎日来る客</b>で店は保つんだ。」',
    /* **¥700。** 桑田が口にした額そのものにする。
       ここを¥800にしていたときは、**店の初期料金がちょうど¥800**だったので、
       この注文だけ何もせずに3日待てば片付いた＝注文になっていなかった。
       ¥700は1人あたり¥100の値下げ＝1日30人なら¥3,000の減収。
       「毎日来る客で店は保つ」を信じるかどうかを、はじめて金で選ばせる      */
    label: '入館料を¥700以下にして、3日つづけて営業する',
    ok: () => (G.ch2 && G.ch2.kuwataCheapDays || 0) >= 3,
    tick: () => {
      // 1日の終わりに数える。値上げしたらやり直し
      if (!G.ch2) return;
      if ((G.opts.fee || 9999) <= 700) G.ch2.kuwataCheapDays = (G.ch2.kuwataCheapDays || 0) + 1;
      else G.ch2.kuwataCheapDays = 0;
    },
    ok_line: '「……三日、見せてもらった。」<br>「値札ってのはな、<b>その日の気分で変えるもんじゃねえ</b>んだ。」<br>' +
             '「据えたなら、据え続けろ。」',
  },
  {
    key: 'rest',
    title: '寝るところがない',
    ask: '「上がったあと、<b>寝転がるとこ</b>がねえ。」<br>' +
         '「椅子に座って何になる。サウナ入った体ってのは、横にならなきゃ収まらねえんだ。」<br>' +
         '「若えのは分からんだろうがな。」',
    /* 熟睡まくら＆マットは廃止したので、代わりにビーズクッションと仮眠リクライナーを数える。
       どれも「横になれる／沈める」もの＝桑田の言い分は満たしている */
    label: '休憩スペースに横になれるものを置く（ごろ寝マット・畳の小上がり・ビーズクッション・ハンモック・仮眠リクライナーのどれか）',
    ok: () => G.equip.some(e =>
      ['x2_goro', 'x2_tatami', 'x2_beads', 'x2_hammock2', 'x2_nap'].includes(e.id) && e.cond > 0),
    ok_line: '「……寝た。」<br>「二時間、寝ちまった。閉め出されるかと思ったわ。」',
  },
];

/* ============ 状態 ============ */
function kuwata() {
  if (!G.ch2) return null;
  if (!G.ch2.kuwata) G.ch2.kuwata = { met: false, i: 0, asked: false, done: 0, ally: false, failed: [] };
  return G.ch2.kuwata;
}
function kuwataOn() { return !!(G.ch2 && G.ch2.opened); }
/* いま出ている注文 */
function kuwataAsk() {
  const k = kuwata();
  if (!k || !k.asked) return null;
  return KUWATA_ASKS[k.i] || null;
}
function kuwataAllyOn() { return !!(G.ch2 && G.ch2.kuwata && G.ch2.kuwata.ally); }

/* 1日の終わりに呼ぶ（week2 の nightFlow から）。日数を数える注文はここで進む */
function kuwataTick() {
  const d = kuwataAsk();
  if (d && d.tick) d.tick();
}

/* ============ 出会い ============
   開業初日の営業が終わった夜。暖簾を下ろした店に、勝手に入ってくる。   */
const KUWATA_MEET = [
  { art: 'ruin', lines: [
    { narr: true, text: '初日の暖簾を下ろして、番台の金を数えていた。' },
    { narr: true, text: '入口の戸が開いた。閉めたはずの戸だ。' },
    { sp: '桑田', text: '……やってんのか、ここ。' },
    { narr: true, text: '白髪を短く刈った爺さんが、勝手知ったる足取りで入ってきた。' },
    { narr: true, text: '下足箱の前で立ち止まり、木札を一枚抜いて、また戻した。' },
    { sp: '桑田', text: '五十七番。わしの番号だ。二十年、ここに靴入れとった。' },
    { sp: '俺', text: '……前の、ゆらぎの。' },
    { sp: '桑田', text: '桑田だ。' },
    { narr: true, text: '桑田は答えず、天井を見上げ、大広間のほうを見て、それから浴室の戸を開けた。' },
    { narr: true, text: '湯気が出てこないのを確かめて、戻ってきた。' },
    { sp: '桑田', text: '……サウナ屋にするのか。' },
    { sp: '俺', text: 'はい。' },
    { sp: '桑田', text: 'ふん。' },
    { sp: '桑田', text: '寒川さんはな、最後まで「風呂屋だ」と言い張っとったよ。' },
    { sp: '桑田', text: 'それで負けた。' },
    { narr: true, text: '言い方に湿ったところはなかった。事実を読み上げるみたいな声だった。' },
    { sp: '俺', text: '……。' },
    { sp: '桑田', text: '言っとくがな。' },
    /* ⚠ 会話の場面（Story）は**ただの文字**として1文字ずつ打ち出すので、
       <b> や <br> を書くとそのまま画面に出てしまう。強調はここでは使えない。
       タグが使えるのは innerHTML で描いている注文ボード側（kuwataInfo）だけ */
    { sp: '桑田', text: '前の方が良かった。' },
    { sp: '俺', text: '（初日にそれ言うか）' },
    { sp: '桑田', text: 'だが、無いよりはマシだ。三キロ先まで歩けるほど若かねえ。' },
    { narr: true, text: '桑田は番台に肘をついて、こちらを正面から見た。' },
    { sp: '桑田', text: 'わしが通ってやる。' },
    { sp: '桑田', text: 'その代わり、言いたいことは言う。' },
    { narr: true, text: '断る理由を探したが、初日の客は十人に届いていなかった。' },
    { sp: '俺', text: '……どうぞ。' },
    { sp: '桑田', text: 'よし。' },
    { narr: true, text: 'そう言うと、桑田は本当に、その場でひとつ目を突きつけてきた。' },
  ]},
];

/* ============ 来訪 ============
   営業中に歩いてきて、番台の前で足を止める。
   ・まだ会っていない　… 出会いの場面（初日の夜）
   ・注文が済んでいる　… 認める → 次の注文
   ・注文が残っている　… 催促（何度でも言う。この爺さんは忘れない）      */
function kuwataVisit() {
  const k = kuwata(); if (!k) return false;
  if (!kuwataOn()) return false;
  if (k.ally) return false;                       // もう全部応えた
  const d = kuwataAsk();
  if (!d) { openKuwata('ask'); return true; }     // 次の注文を出す
  if (d.fail && d.fail()) { openKuwata('fail', d); return true; }
  if (d.ok()) { openKuwata('done', d); return true; }
  openKuwata('nag', d);
  return true;
}

function openKuwata(kind, d) {
  const k = kuwata();
  G.paused = true;
  const box = $('kuwataChoices'); box.innerHTML = '';
  const addBtn = (label, sub, fn) => {
    const b = document.createElement('button');
    b.className = 'big-btn';
    b.innerHTML = sub ? `${label}<br><span class="opt-sub">${sub}</span>` : label;
    b.onclick = fn;
    box.appendChild(b);
  };
  const close = () => {
    $('kuwataModal').classList.add('hidden');
    G.paused = false;
    syncTip();                 // 受けた注文を、そのまま上の一行へ
    saveGame();
  };

  if (kind === 'ask') {
    d = KUWATA_ASKS[k.i];
    if (!d) { kuwataFinish(); return; }
    k.asked = true;
    $('kuwataTitle').textContent = `🧓 桑田の注文（${k.i + 1}／${KUWATA_ASKS.length}件目）`;
    $('kuwataInfo').innerHTML = `${d.ask}<br><br>
      <span class="mika-note">📌 ${d.label}</span>`;
    addBtn('🧓 …わかったよ', `聞いてやる（応えると 評判＋${KUWATA_REP}）`, close);
  } else if (kind === 'nag') {
    $('kuwataTitle').textContent = '🧓 桑田が、また同じことを言っている';
    $('kuwataInfo').innerHTML = `「まだか。」<br>「わしは忘れんぞ。<b>${d.title}</b>だ。」<br><br>
      <span class="mika-note">📌 ${d.label}</span>`;
    addBtn('🧓 いま、やってる', '', close);
  } else if (kind === 'fail') {
    k.failed = (k.failed || []).concat([d.key]);
    k.i++; k.asked = false;
    $('kuwataTitle').textContent = '🧓 桑田が、黙った';
    $('kuwataInfo').innerHTML = d.fail_line || '「……そうか。」';
    addBtn('…すまない', '', close);
  } else if (kind === 'done') {
    k.done++; k.i++; k.asked = false;
    /* 評判は **repBonus**（物語の出来事ぶんの加点）に足す。
       G.rep へ直接足すと、その晩の再計算（syncRep）で10項目の点に上書きされて消える。
       ※ game.js の addRep() の二重定義（旧方式が後勝ちで隠す）は 2026-08-09 に解消済み。
         ただしこちらは上限 +40 で運用してきた実績があるので、共通の addRep（上限 +25）に
         乗り換えず repBonus を自分で動かす形のまま残す（この章は保留中＝挙動を変えない） */
    G.repBonus = clamp((G.repBonus || 0) + KUWATA_REP, -40, 40);
    syncRep();
    log(`🧓 桑田の注文に応えた（${d.title}）　評判 +${KUWATA_REP}`);
    flashTip(`✅ <b>${d.title}</b> ── 応えた（評判 +${KUWATA_REP}）`, 3.2);
    const last = k.i >= KUWATA_ASKS.length;
    $('kuwataTitle').textContent = '🧓 桑田が、口の端を下げた';
    $('kuwataInfo').innerHTML = `${d.ok_line}<br><br>
      <span class="mika-note">✅ 評判 +${KUWATA_REP}（いま ${Math.round(G.rep)}）</span>`;
    log(`　評判ボーナス 累計 +${G.repBonus}`);
    addBtn(last ? '…（これで最後だ）' : '…（次は何を言われるんだ）', '',
      last ? () => { $('kuwataModal').classList.add('hidden'); kuwataFinish(); } : close);
  }
  $('kuwataModal').classList.remove('hidden');
}

/* ============ 全部応えた ============ */
function kuwataFinish() {
  const k = kuwata();
  k.ally = true;
  const failed = (k.failed || []).length;
  G.paused = true;
  $('kuwataTitle').textContent = '🧓 桑田が、仲間を連れてきた';
  $('kuwataInfo').innerHTML =
    `翌朝、開店前の駐車場に軽自動車が三台停まっていた。<br>
     降りてきたのは、みな桑田と同じくらいの歳の連中だった。<br><br>
     「前の店の連中だ。行くとこが無くてな。」<br>
     「言っとくが、<b>前の方が良かった</b>。」<br>
     「……だが、こいつらが来るのは、ここだ。」<br><br>
     <span class="mika-note">✅ 桑田が常連の顔役になった（毎日の客足 +${KUWATA_GUESTS}人）` +
    (failed ? `<br>⚠ 応えられなかった注文が ${failed}件 あった` : '') + '</span>';
  const box = $('kuwataChoices'); box.innerHTML = '';
  const b = document.createElement('button');
  b.className = 'big-btn';
  b.textContent = '……ありがとうございます';
  b.onclick = () => { $('kuwataModal').classList.add('hidden'); G.paused = false; saveGame(); };
  box.appendChild(b);
  $('kuwataModal').classList.remove('hidden');
  log(`🧓 桑田が常連の顔役になった（客足 +${KUWATA_GUESTS}人／日）`);
  Sfx.play('register');
}

/* ============ 上の一行に出す注文（作者指定）============
   受けている注文を、画面のいちばん上に一行だけ。
   条件を満たすと**その場で緑に変わる**＝「できた。次に桑田が来たら見せろ」。
   今後べつの依頼人が増えても、ここに一本足すだけで同じ場所に出せる。     */
function missionTip() {
  const k = kuwata();
  if (!k || !k.met || k.ally) return '';
  const d = kuwataAsk();
  if (!d) return '📌 桑田が、次に何か言ってくる';
  if (d.fail && d.fail()) return `📌 <b>${d.title}</b> ── もう手遅れだ`;
  if (d.ok()) return `✅ <b>${d.title}</b> ── できている（次に桑田が来たら見せよう）`;
  // 日数を数える注文だけは、進み具合も出す
  const n = d.key === 'fee' ? `（${(G.ch2.kuwataCheapDays || 0)}／3日）` : '';
  return `📌 桑田の注文：<b>${d.title}</b>${n} ── ${d.label}`;
}

/* ============ 依頼の一覧（バイト画面と同じ並びで見せる）============ */
function kuwataBoard() {
  const k = kuwata();
  if (!k || !k.met) return '';
  const rows = KUWATA_ASKS.map((d, i) => {
    const state = (k.failed || []).includes(d.key) ? ['ng', '✕ 応えられなかった']
      : i < k.i ? ['ok', '✔ 応えた']
      : i === k.i && k.asked ? (d.ok() ? ['ok', '✔ できている（次に来たら報告）'] : ['now', '▶ いま言われている'])
      : ['yet', '—'];
    return `<div class="msn-row ${state[0]}"><b>${d.title}</b><span>${state[1]}</span>
      <p class="msn-note">${i <= k.i ? d.label : '……まだ何か言われる'}</p></div>`;
  });
  return `<div class="msn-box"><div class="msn-head">🧓 桑田芳雄の注文
    <span>${k.done}／${KUWATA_ASKS.length}</span></div>
    <p class="msn-lead">前の「健康ランド ゆらぎ」に二十年通った常連。全部応えると、仲間を連れてくる。</p>
    ${rows.join('')}</div>`;
}

/* ============ 登録 ============ */
registerChapter2Hooks({
  /* 客足の上乗せ（桑田が仲間を連れてきた後）。
     game.js の guestAdjust は rules2 が持っているので、そちらから足す */
  kuwataGuests: () => (kuwataAllyOn() ? KUWATA_GUESTS : 0),
  kuwataTick,
  kuwataVisit,
  kuwataBoard,
  missionTip,
  kuwataMeet: () => KUWATA_MEET,
});
