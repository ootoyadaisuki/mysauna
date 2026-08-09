'use strict';

/* ============================================================
   客をタップすると、その人が何者で、何を求めているかが出る（作者指定 2026-08-06）
   ------------------------------------------------------------
   > 「客をタップすると、属性（サウナーなど）、求めるもの（評価が上がるポイント）、
   >   一言コメントが出てくるようにしたい。求めるものの内、満たされているものは緑、
   >   まだ満たされていないものは赤文字で。客の右側か左側（スペースに余裕のある方）に」

   これまで、客が何を思っているかを知る道は**吹き出しを目撃すること**しかなかった。
   数百人が同時に歩く第2章では、それはもう追えない（§11-17 で受け入れを245人にした）。
   データ画面の層ごとの点数は「どの層が低いか」は言うが、「目の前のこの人に何が足りないか」は言わない。

   ここで**一人ぶんの内訳**を開く。緑と赤が並ぶので、次に何を建てるかがその場で決まる。

   **表示するものは、すべて実際に満足度を動かしている判定そのもの。**
   飾りの一行は置かない（置くと、直しても赤のままの行が出て、嘘になる）。
   ============================================================ */

/* いまカードを開いている客（G には持たせない＝セーブに残さない。閉じれば消える一時のもの） */
let Y_CARD = null;

/* ============ 求めるもの ============ */

/* その客が使う浴室階の、生きている設備 */
function yCardEq(c) {
  const f = (typeof yBathOf === 'function') ? yBathOf(c) : (c.f | 0);
  return (G.equip || []).filter(e => (e.f | 0) === (f | 0) && e.cond > 0 && !e.dead);
}
function yCardTemp(e) {
  const d = EQ[e.id] || {};
  return (e.temp != null) ? e.temp : d.temp;
}
/* その分類の設備が、望みの温度で建っているか */
function yCardHasTemp(c, cat, want, tol, extra) {
  return yCardEq(c).some(e => {
    const d = EQ[e.id] || {};
    if (d.cat !== cat) return false;
    if (extra && !extra(d, e)) return false;
    const t = yCardTemp(e);
    return t != null && Math.abs(t - want) <= tol;
  });
}

/* その客の「求めるもの」を並べる。**多くても6行**（それ以上は読まれない）。
   ①その層が見ているもの（SEG_WANTS_Y。データ画面と同じ物差し）
   ②その人だけの好み（温度・手ぶら・欲しがっている設備）
   ③誰にでも効くもの（入浴料）                                            */
function yCustWants(c) {
  const rows = [];
  const T2 = c.type || {};

  // ── ① 層が見ているもの ──
  const sk = (typeof segOf === 'function') ? segOf(c.typeKey) : null;
  const list = (sk && typeof SEG_WANTS_Y === 'object' && SEG_WANTS_Y[sk]) || [];
  for (const [cond, , label] of list) {
    if (!label) continue;                       // 見出しの無い条件は出さない（嘘の行を作らない）
    let ok = false;
    try { ok = !!cond(); } catch (e) { continue; }
    rows.push({ label, ok });
  }

  // ── ② その人だけの好み ──
  if (c.wantsSauna) {
    const pref = T2.saunaPref || 90, cap = T2.saunaMax;
    rows.push({
      label: pref + '℃くらいのサウナ',
      ok: yCardHasTemp(c, 'sauna', pref, 4, d => !d.gentle && (!cap || (d.temp || 90) <= cap)),
    });
    const cold = (typeof idealCold === 'function') ? Math.round(idealCold(c)) : 15;
    rows.push({ label: cold + '℃くらいの水風呂', ok: yCardHasTemp(c, 'mizu', cold, 2) });
    // サウナ上がりの給水。ここが無いと、いいサウナでも満足しきれない
    rows.push({ label: '冷水機', ok: hasRole('cooler', 'cooler') });
  } else {
    const pf = (typeof furoPrefOf === 'function') ? Math.round(furoPrefOf(c)) : 42;
    rows.push({ label: pf + '℃くらいの湯', ok: yCardHasTemp(c, 'furo', pf, 1, d => !d.old) });
  }
  /* ── ③ 誰にでも効くもの。**ここは②の“ないものねだり”より先に置く。**
     後ろに回すと6行の枠から溢れて、いちばん効く一行が出ないことがある（実測）  */
  const worth = (typeof worthFee === 'function') ? worthFee() : 0;
  if (worth) {
    rows.push({ label: '入浴料が¥' + worth.toLocaleString() + '以下', ok: (G.opts.fee || 0) <= worth });
  }

  // ── ④ 一部の客だけが欲しがるもの（無くても進行は詰まらない） ──
  if (c.wantsMist) rows.push({ label: 'ミスト・蒸気のサウナ', ok: hasRole('mist', 'sauna_mist') });
  if (c.wantsShio) rows.push({ label: '塩サウナ', ok: hasRole('shio', 'sauna_shio') });
  if (c.wantsNappa && c.wantsSauna) rows.push({ label: '熱波師のアウフグース', ok: nappaOn() });
  if (c.tebura) rows.push({ label: '手ぶらセット', ok: !!(G.opts && G.opts.tebura) });

  return rows.slice(0, 7);
}

/* ※**一言コメントは置かない**（作者決定 8/6）。
   「求めるものだけで十分伝わるから」＝赤い行がそのまま『これが欲しい』であり、
   同じことを文章で言い直すと、札が縦に伸びるぶんだけ損をする。
   吹き出しは、これまでどおりマップの上に出ている                          */

/* ============================================================
   働く人の札（作者指定 2026-08-06）
   ------------------------------------------------------------
   > 「主人公・妻・バイトにも札システムを入れたい。スキル、持ち場、給料などへの不満とか？
   >   こっちこそ一言コメントで良さそう」

   客の札は**チェックリスト**（次に何を建てるかを決める道具）。
   働く人の札はそれとは別の役目にする＝

     **バイトは、自分の持ち場の状況を教えてくれる人にする。**

   7階建てで**一度に一階しか見られない**のが、この章の構造的な不便。
   3階のバイトが「汚れが溜まってます」と言えば、上がらなくても分かる。
   ＝札が「眺めるもの」から「巡回の代わり」になる。

   **一言は、すべて実際の状態から引く。**（客の札と同じ約束＝飾りの一行は置かない）
   ============================================================ */

/* その人の持ち場（バイト・妻）。主人公はいまいる階 */
function yCardFloor(e) {
  if (e.kind === 'player') return G.actF | 0;
  if (e.isWife) return (typeof yWifeFloor === 'function') ? yWifeFloor() : (e.f | 0);
  return (e.emp && e.emp.f != null) ? (e.emp.f | 0) : (e.f | 0);
}
function yCardFloorName(f) {
  const a = (CONF.areas || [])[f | 0];
  return a ? (a.lvl ? a.lvl + 'F ' : '') + (a.short || a.name) : '';
}
/* その階の困りごと。**札の一言は、ここから引く** */
function yCardTrouble(f) {
  const dirt = (G.dirts || []).filter(d => (d.f | 0) === (f | 0)).length;
  const broke = (G.equip || []).filter(e => (e.f | 0) === (f | 0) && e.cond <= 0 && !EQ[e.id].fixed);
  return { dirt, broke: broke.length, brokeName: broke.length ? (EQ[broke[0].id] || {}).name : null };
}

/* バイト・妻の一言。上から順に、当てはまった最初のものを言う */
function yStaffSay(e) {
  const emp = e.emp || {};
  const f = yCardFloor(e), tr = yCardTrouble(f);
  const night = (typeof yIsNight === 'function') && yIsNight();

  if (e.isWife) {
    const mood = (typeof yMood === 'function') ? yMood() : 70;
    if (mood <= 20) return 'もう、わたし限界かもしれない';
    if (tr.broke) return tr.brokeName + 'が壊れてるわよ';
    if (tr.dirt >= 3) return 'ここ、汚れてきてる';
    if ((G.payQueue || []).length >= 4) return '受付、並んでるわよ';
    if (mood >= 80) return 'いい店になってきたじゃない';
    if (mood <= 45) return '……ちょっと、話がしたいんだけど';
    return 'こっちは大丈夫。見てくる？';
  }
  /* ふてくされは**ここでしか気づけない**（一覧の😾は運営メニューを開かないと見えない）。
     ただし「あと何回で辞めるか」は言わせない（作者指定）  */
  if (emp.sulk) return '……給料の話、まだですか';
  if (e.lateT > 0) return 'すみません、遅れました';
  if (tr.broke) return tr.brokeName + 'が壊れてます';
  if (tr.dirt >= 3) return 'この階、汚れが溜まってます';
  if ((G.payQueue || []).length >= 4 && (typeof yDeskFloor === 'function') && yDeskFloor() === f) {
    return '受付、並んでます';
  }
  if (night) return '……眠い';
  if ((emp.skill || 40) < 40) return 'まだ慣れません';
  if ((emp.skill || 40) >= 90) return 'もう手は覚えました';
  if ((emp.maji || 3) <= 2) return '休憩、まだですか';
  return '回ってます';
}

/* 主人公の一言。体力とストレスが先＝**倒れる前に気づける**ようにする */
function yPlayerSay() {
  const stam = G.stam ?? 100, max = (typeof yStamMax === 'function') ? yStamMax() : 100;
  const pct = max ? stam / max * 100 : 100;
  const st = (typeof yStress === 'function') ? yStress() : 0;
  const f = G.actF | 0, tr = yCardTrouble(f);
  if (typeof playerSpent === 'function' && playerSpent()) return '……少しだけ、休ませてくれ';
  if (pct <= 20) return 'そろそろ限界だ';
  if (CONF.stressMax && st >= CONF.stressMax * 0.8) return '……頭が回らない';
  if (tr.broke) return tr.brokeName + 'を直さないとな';
  if (tr.dirt >= 3) return 'ここ、片づけないとな';
  if ((G.payQueue || []).length >= 4) return '受付が詰まってる';
  if (pct >= 80) return 'まだやれる';
  return '今日も回すか';
}

/* ============ タップ ============ */
/* game.js から呼ばれる。true を返すと、その先（設備・スタッフ）を見に行かない。
   c が null＝何もない所を叩いた＝開いていたカードを閉じる。

   **バイトは2回叩くと、これまでの給料・持ち場・クビのパネルが開く**（作者決定 8/6）。
   1回目＝札（ゲームは止まらない・眺めるだけ）／2回目＝操作。
   「手を止めずに全階の様子を掴む」がこの札の値打ちなので、1回目で止めてはいけない */
function yCustTap(c) {
  if (!G.ch2) return false;
  if (!c) {
    if (!Y_CARD) return false;
    Y_CARD = null;
    return true;                                 // 閉じるだけ。設備は選ばせない
  }
  if (Y_CARD && Y_CARD.c === c) {
    Y_CARD = null;
    // 雇っているバイトだけ、2度目で操作パネルへ（妻と主人公はクビにできない）
    if (c.kind === 'staff' && c.emp && !c.isWife && typeof openStaffPanel === 'function') {
      openStaffPanel(c.emp);
    }
    return true;
  }
  Y_CARD = { c };
  if (typeof deselect === 'function') deselect();   // 設備の説明パネルとは同時に出さない
  return true;
}

/* ============ 描く ============
   **札の中身はキャンバスに描かない。**キャンバスの字はマップと同じ倍率で縮むので、
   スマホの画面では読めない大きさになる（作者指摘 8/6）。
   中身は実寸の DOM（#custCard／css/style.css）で重ね、
   キャンバスには**客の輪と引き出し線だけ**を描く＝どの人の札かは絵で示し、
   読ませるものは実寸で出す                                                */

let Y_CARD_EL = null;
function yCardEl() {
  if (Y_CARD_EL && Y_CARD_EL.isConnected) return Y_CARD_EL;
  const wrap = document.getElementById('canvasWrap');
  if (!wrap) return null;
  Y_CARD_EL = document.createElement('div');
  Y_CARD_EL.id = 'custCard';
  Y_CARD_EL.className = 'hidden';
  wrap.appendChild(Y_CARD_EL);
  return Y_CARD_EL;
}
function yCardHide() {
  const el = Y_CARD_EL;
  if (el) el.classList.add('hidden');
}
function esc(s) {
  return String(s).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
}

/* ============ 年齢（作者指定 8/6）============
   > 「観光客（23）みたいな感じで、年齢も入れられる？
   >   そしたら若者なのか老人なのか、会社員なのか、だいたい分かる」

   客層のラベルを外したぶん、**歳がその人の輪郭になる。**
   「商店街の旦那（68）」と「学生サウナー（19）」では、同じ赤い行の重みが違って見える。

   歳は `TYPES_Y` の `age: [下, 上]` から、**その客の id で決める**＝
   同じ客なら何度開いても同じ歳。セーブにも持たせない（id から引き直せる）  */
function yCustAge(c) {
  const r = c.type && c.type.age;
  if (!r) return null;
  if (c.yAge == null) {
    const n = ((c.id || 1) * 2654435761) >>> 0;          // id を散らす（隣り合う客が同い年にならない）
    c.yAge = r[0] + (n % (r[1] - r[0] + 1));
  }
  return c.yAge;
}

/* 中身を組む。**同じ内容なら組み直さない**（毎フレーム作り直すと重い）。

   大きく出すのは**その人の呼び名**（作者決定 8/6）。
   はじめは層の名前（♂サウナー）を大見出しにしていたが、
   ・子どもの札に「子連れ」と出る（層の名前であって、その子のことではない）
   ・強面の客はどの層にも属さないので**名無し**になる
   ＝**層は、その人を指す言葉ではない。**タップしたのは人なので、人の名前を大きく出す */
/* その人が属する層（老人・サウナー・会社員・若者・子連れ／オバサン・サウナ女子・OL…）。
   強面の客はどの層にも属さないので空（game.js:186）*/
function yCardSeg(c) {
  const k = (typeof segOf === 'function') ? segOf(c.typeKey) : null;
  const s = k && typeof SEGMENTS !== 'undefined' && SEGMENTS.find(x => x.key === k);
  return s ? s.name : '';
}

function yCardFill(el, c, rows) {
  /* 100点満点。**館内にいるあいだの c.sat は100を超える**（加点している箇所が20以上あって、
     どこも途中では丸めていない）。帰り際に clamp(0,100) されるので、
     評判も常連の増減も日報も100を超えた値は見ていない＝**ここだけが素通しだった**。
     中の数字は触らない（丸めると、加点が効いているかどうかが裏でも消える） */
  const sat = Math.min(100, Math.round(c.sat));
  const cls = sat >= 75 ? 's4' : sat >= 60 ? 's3' : sat >= 45 ? 's2' : 's1';
  const age = yCustAge(c);
  const who = ((c.type && c.type.name) || '客') + (age ? '（' + age + '）' : '');
  /* 層の名前は「求めるもの」の見出しの右に出す（作者指定 8/6）。
     **この下に並ぶ最初の数行は、その人ではなく“層”が見ているもの**（SEG_WANTS_Y）で、
     評判と需要を動かしているのもそちら。名前だけ出していたときは、
     画面に見えているもの（13種の呼び名）と、効いているもの（5つの層）が別々だった。
     大見出しを層にしないのは 8/6 の決定どおり＝タップしたのは人であって、層ではない */
  const seg = yCardSeg(c);

  const sig = who + '|' + seg + '|' + sat + '|' + rows.map(r => r.label + (r.ok ? 1 : 0)).join(',');
  if (el.dataset.sig === sig) return;
  el.dataset.sig = sig;

  el.innerHTML =
    '<div class="cc-head"><span class="cc-seg">' + esc(who) + '</span>'
    + '<span class="cc-sat ' + cls + '">' + sat + '点</span></div>'
    + '<div class="cc-sec"><span>求めるもの</span>'
    + (seg ? '<b>' + esc(seg) + '</b>' : '') + '</div>'
    + rows.map(r => '<div class="cc-row ' + (r.ok ? 'ok' : 'ng') + '"><i>'
        + (r.ok ? '✓' : '✕') + '</i><span>' + esc(r.label) + '</span></div>').join('');
}

/* ── バイトと妻の札 ──
   数字（働きぶり・機嫌）は右肩に。★と持ち場と日給は1行ずつ。最後に一言。
   **客の札と同じ高さに収める**＝並べて見たときに揃う                       */
function yStaffCardFill(el, e) {
  const emp = e.emp || {};
  const wife = !!e.isWife;
  const who = (emp.name || '') + (emp.age ? '（' + emp.age + '）' : '');
  const f = yCardFloor(e);

  /* 右肩の数字。バイトは**働きぶり**（0〜100・毎日+3で伸びる）、妻は**機嫌** */
  const v = wife ? ((typeof yMood === 'function') ? Math.round(yMood()) : 70) : (emp.skill || 40);
  const cls = v >= 75 ? 's4' : v >= 60 ? 's3' : v >= 45 ? 's2' : 's1';
  const say = yStaffSay(e);

  const tags = [];
  if (emp.sulk) tags.push('<b class="cc-warn">😾 ふてくされ中</b>');
  if (e.lateT > 0) tags.push('<b class="cc-warn">遅刻</b>');
  if (emp.night) tags.push('🌙 深夜可');

  const sig = 'S|' + who + '|' + v + '|' + f + '|' + say + '|' + tags.join('');
  if (el.dataset.sig === sig) return;
  el.dataset.sig = sig;

  el.innerHTML =
    '<div class="cc-head"><span class="cc-seg">' + esc(who) + '</span>'
    + '<span class="cc-sat ' + cls + '">' + v + (wife ? '' : '点') + '</span></div>'
    + '<div class="cc-sec"><span>' + (wife ? '機嫌' : '働きぶり') + '</span></div>'
    + (wife ? '' : '<div class="cc-skill">' + esc(skillLine(emp)) + '</div>')
    + '<div class="cc-line">' + esc(yCardFloorName(f) || '持ち場なし')
    + (wife ? '' : '　' + yen(emp.wage) + '／勤続' + (emp.days || 0) + '日') + '</div>'
    + (tags.length ? '<div class="cc-line">' + tags.join('　') + '</div>' : '')
    + '<div class="cc-say">「' + esc(say) + '」</div>'
    + (wife ? '' : '<div class="cc-more">もう一度タップ → 給料・持ち場</div>');
}

/* ── 主人公の札 ── */
function yPlayerCardFill(el) {
  const max = (typeof yStamMax === 'function') ? yStamMax() : 100;
  const stam = Math.round(G.stam ?? max);
  const pct = max ? Math.round(stam / max * 100) : 100;
  const cls = pct >= 75 ? 's4' : pct >= 50 ? 's3' : pct >= 25 ? 's2' : 's1';
  const st = (typeof yStress === 'function') ? Math.round(yStress()) : 0;
  const p = G.player || {};
  const doing = (typeof playerSpent === 'function' && playerSpent()) ? '番台の横で寝ている'
    : p.task === 'bandai' ? '番台に立っている'
    : p.task === 'home' ? '持ち場へ戻っている'
    : p.target ? '掃除に向かっている'
    : '見回っている';
  const say = yPlayerSay();

  const sig = 'P|' + stam + '|' + st + '|' + doing + '|' + say;
  if (el.dataset.sig === sig) return;
  el.dataset.sig = sig;

  el.innerHTML =
    '<div class="cc-head"><span class="cc-seg">自分</span>'
    + '<span class="cc-sat ' + cls + '">体力 ' + pct + '%</span></div>'
    + '<div class="cc-sec"><span>いま</span></div>'
    + '<div class="cc-line">' + esc(yCardFloorName(G.actF) + '　' + doing) + '</div>'
    + '<div class="cc-line">ストレス ' + st + (CONF.stressMax ? ' / ' + CONF.stressMax : '') + '</div>'
    + '<div class="cc-say">「' + esc(say) + '」</div>';
}

function yDrawCustCard(g) {
  if (!Y_CARD || !G.ch2) { yCardHide(); return; }
  const c = Y_CARD.c;
  /* その人が帰った／画面に出ていない階に移った＝札も畳む。
     客は G.customers、バイトと妻は G.staff、主人公は G.player に居るあいだだけ */
  const view = (G.viewF >= 0 ? G.viewF : G.actF) | 0;
  const alive = c.kind === 'player' ? (G.player === c && onDuty())
              : c.kind === 'staff' ? ((G.staff || []).includes(c) && workerHere(c))
              : (G.customers || []).includes(c);
  if (G.phase !== 'biz' || !alive || (c.f | 0) !== view) {
    Y_CARD = null; yCardHide(); return;
  }
  const el = yCardEl();
  if (!el) return;

  if (c.kind === 'player') yPlayerCardFill(el);
  else if (c.kind === 'staff') yStaffCardFill(el, c);
  else yCardFill(el, c, yCustWants(c));
  el.classList.remove('hidden');

  /* ── 置き場所。**ゲーム内の座標を、画面の実寸に直してから**決める ── */
  const wrap = el.parentElement, cvEl = document.getElementById('game');
  const sc = (cvEl && cvEl.clientWidth) ? cvEl.clientWidth / (CONF.W * T) : 1;   // ゲーム内px → 実寸px
  const WW = wrap.clientWidth, HH = wrap.clientHeight;
  const cx = c.px * sc, cy = c.py * sc;
  const w = el.offsetWidth, h = el.offsetHeight;
  const pad = 6, arm = 14 * sc;

  /* **右か左か。空いているほうへ出す**（作者指定） */
  const gapR = WW - (cx + arm), gapL = cx - arm;
  const right = gapR >= w + pad || gapR >= gapL;
  let x = right ? cx + arm : cx - arm - w;
  x = Math.max(pad, Math.min(x, WW - w - pad));
  const y = Math.max(pad, Math.min(cy - h / 2, HH - h - pad));
  el.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';

  /* ── キャンバス側は、客の輪と引き出し線だけ（ここはゲーム内の座標のまま）── */
  const gx = x / sc, gy = y / sc, gw = w / sc, gh = h / sc;
  g.save();
  g.strokeStyle = '#ffd98a'; g.lineWidth = 1.5;
  g.beginPath(); g.arc(c.px, c.py, 11, 0, Math.PI * 2); g.stroke();
  g.beginPath();
  g.moveTo(c.px + (right ? 11 : -11), c.py);
  g.lineTo(right ? gx : gx + gw, clamp(c.py, gy + 6, gy + gh - 6));
  g.stroke();
  g.restore();
}

/* **drawTop＝いちばん最後に描く層。**吹き出しや floaters より上に載せる＝
   自分で開いた札が、勝手に出るものに隠されない（実測して drawPass から移した） */
registerChapter2Hooks({ custTap: yCustTap, drawTop: yDrawCustCard });
