'use strict';

/* ============ 置く前に読む、設備の詳細（第2章） ============

   カタログの行は「名前・収容・値段」だけにして、説明はここへ移す（作者指定 8/6）。

   なぜそうするか。
   この店の設備は、サウナも浴槽も水風呂も**絵が似ている**。
   違いは温度・収容・客層＝ぜんぶ文字のほうにある。
   だから説明を消すわけにはいかないが、カタログの1行に押し込むと
   iPhone SE では5件しか並ばない。

   そこで「読む場所」を、**設備を選んだ直後の設置画面**にずらす。
     ・設置画面は confirmBar しか出ていない＝下半分がまるごと空いている
     ・まだ金は払っていない（払うのは【ここに置く】を押した瞬間）＝買う前に読める
     ・カタログは行が縮んで、一画面に並ぶ数が増える

   ここで出すものは3つ。
     ① desc … 設備ごとの長い説明。**いままで画面のどこにも出ていなかった**
              （def.desc を読んでいたのは残置物の始末パネルだけ）
     ② 効きどころ … どの客層に刺さるか。**数値から出す**（作り話をしない）
              equipFit() 本体をそのまま呼んで採点する＝将来この式を直しても表示がズレない
     ③ 維持費・収容・温度 … カタログに出しきれない数字

   第1章には触れない。game.js 側は hasHook('placeInfo') で分岐するだけで、
   フックの無い第1章はいままでどおり一行説明つきのカタログのまま。          */

/* ---- ① 効きどころを、実際の採点式から出す ----
   equipFit() には rand(-0.8, 0.8) の揺らぎが入っているので、何回か回して均す。
   採点に使うのは「その設備を選ぶかどうか」の部分だけなので、
   客そのものではなく { type } だけの張りぼてを渡せば足りる  */
/* equipFit() には rand(-0.8, 0.8) の揺らぎが入っている。
   何度も回して均す形にしていたが、**同点が同点にならない**（平均が毎回わずかに違う）ので、
   ぴったり並ぶはずの2層の順番が、開くたびに入れ替わっていた。
   ここは表示だけの計算なので、その一瞬だけ乱数を止めて**まん中の値**で採点する。
   rand は const で差し替えられないため、その素の Math.random を借りて必ず戻す */
function yFitScore(id, t) {
  const mr = Math.random;
  Math.random = () => 0.5;
  try { return equipFit({ id }, { type: t }); }
  finally { Math.random = mr; }
}

/* いま、この店に来られる客層。
   3Fを建てていないのに「サウナ女子に効く」と言うと嘘になるので、
   来られない層はそもそも並べない（yCanVisit と同じ条件から、時刻の分だけ外したもの） */
function yInfoTypes(area) {
  const out = [];
  for (const k in TYPES) {
    const t = TYPES[k];
    if (!t || t.kid) continue;                                   // 子どもは自分で設備を選ばない
    if (CONF.menOnly && t.sex !== 'm') continue;
    if (t.needArea != null && !yBuilt(t.needArea)) continue;
    if (t.night && !(G.opts && G.opts.nightOpen)) continue;
    // 男湯／女湯に置くものは、その性別の客しか使わない
    if (area === AY.OTOKO && t.sex !== 'm') continue;
    if (area === AY.ONNA && t.sex !== 'f') continue;
    out.push(t);
  }
  return out;
}

/* 温度で客層が割れるもの（ドライサウナ・浴槽・水風呂）だけ、名前を挙げる。
   蒸し系（ミスト・薬草）は全員おなじ点＝「誰に効く」が無い設備なので黙る */
const Y_FIT_CATS = ['sauna', 'furo', 'mizu'];
/* 首位からどこまでを「効く」とみなすか。
   固定幅にすると噛み合わない＝**種類ごとに点の開きがまるで違う**。
     ・湯船 … 好みが 39〜46℃ に固まっていて、どの湯も点差が2くらいしか付かない
     ・水風呂 … 好みが 8〜18℃ に散っていて、しかも1.5倍で効く＝点差が10以上開く
   固定2.5だと、湯船は「1層だけに効く」に、水風呂は「誰にも効かない」に寄ってしまう。
   なので**その設備で実際に開いた点差**を見て、上から35%を「効く」とする */
function yFitBand(top, bottom) { return Math.max(2, (top - bottom) * 0.4); }
const Y_FIT_MAX = 3;        // 挙げるのは3層まで（それ以上は「客を選ばない」と同じ意味になる）

/* **サウナに入らない客は、水風呂にも入らない。**
   equipFit は “どの部屋を選ぶか” しか見ていないので、掛けないと
   子連れの父（likesSauna 0）が水風呂の一番手に並ぶ。
   ・サウナ … 0.5 未満は「たまにしか入らない層」なので外す
   ・水風呂 … サウナに入る客なら誰でも浸かる＝0 より上なら入れる
     （0.5 で切ると、**16℃がちょうど好みの老人**が丸ごと消えて
       「強面の客と観光客の水風呂」に見えてしまった）
   ・湯船 … 誰でも浸かるので掛けない                                */
function yFitPool(d, types) {
  if (d.cat === 'sauna') return types.filter(t => (t.likesSauna ?? 1) >= 0.5);
  if (d.cat === 'mizu') return types.filter(t => (t.likesSauna ?? 1) > 0);
  return types;
}

/* 客層（13種）ではなく **層（老人・サウナー・会社員・若者・子連れ）** の名前で言う。
   「遠征サウナー・強面の客」より「サウナー」のほうが、何を買えばいいか分かる（作者指定 8/6）。
   層の点は、その層のいちばん高い客の点＝**その層の誰かにはハマる**なら、その層に効く。
   強面の客だけは SEGMENTS のどこにも属さない（game.js:186）ので、そのまま名前で出す */
function yKeyOfType(t) {
  for (const k in TYPES) if (TYPES[k] === t) return k;
  return null;
}
function ySegName(t) {
  const tk = yKeyOfType(t);
  const k = (tk && typeof segOf === 'function') ? segOf(tk) : null;
  const s = k && SEGMENTS.find(x => x.key === k);
  return s ? s.name : t.name;
}

function yFitLine(id, area) {
  const d = EQ[id];
  if (!d || !Y_FIT_CATS.includes(d.cat) || d.gentle || d.old || d.temp == null) return '';
  const types = yFitPool(d, yInfoTypes(area));
  if (types.length < 2) return '';
  /* 同点のときは客層の並び順で決める。揺らぎを均しても、
     好みがまったく同じ2層（遠征サウナーと強面の客＝どちらも108℃好み）は本当に同点なので、
     ここを決めておかないと開くたびに名前の順が入れ替わる */
  const byType = types.map((t, i) => ({ t, i, s: yFitScore(id, t) }));
  const seg = new Map();
  for (const x of byType) {
    const n = ySegName(x.t);
    if (!seg.has(n) || seg.get(n).s < x.s) seg.set(n, { n, i: x.i, s: x.s });
  }
  const scored = [...seg.values()].sort((a, b) => (b.s - a.s) || (a.i - b.i));
  const top = scored[0].s;
  /* **誰の好みにも届いていない温度**は、全員が同点（＝near が 0）で並ぶので、
     そのままだと「全員に効く」と見分けが付かない。
     この設備にぴったり合う客を1人でっち上げて採点し、その満点との差で見分ける。
     ここが第2章でいちばん高い買い物（110℃の室で¥155万）を止められる一行になる */
  /* 10（水風呂は1.5倍なので15）＝ **near() が全員ぶん 0**、つまり
     いちばん近い客ですら好みから10℃以上離れている。ここで初めて「誰にも合っていない」。
     7 で切ると、88℃の半個室（いちばん近い客が95℃）まで警告になって嘘になった */
  const gap = yFitScore(id, yIdealType(d)) - top;
  if (gap >= (d.cat === 'mizu' ? 15 : 10)) {
    const hot = d.temp > yPrefAvg(d, types);
    const w = d.cat === 'mizu' ? (hot ? 'ぬるすぎる' : '冷たすぎる')
      : d.cat === 'furo' ? (hot ? '熱すぎる' : 'ぬるすぎる')
      : (hot ? '熱すぎる' : 'ぬるすぎる');
    return '<div class="pi-warn">⚠ この階の客層には<b>' + w + '</b>（誰の好みにも合っていない）</div>';
  }
  const band = yFitBand(top, scored[scored.length - 1].s);
  const hit = scored.filter(x => top - x.s <= band);
  /* どの層も同じくらい喜ぶ設備（16℃の水風呂のように）は、名前を並べると
     **並ばなかった層には効かない**ように見えてしまう。そこは言い切る。
     前は空文字を返していたので、いちばん万能な設備ほど何も出なかった */
  if (hit.length >= scored.length || hit.length > Y_FIT_MAX)
    return '<div class="pi-fit">👥 <b>どの層にも効く</b>（客を選ばない）</div>';
  return '<div class="pi-fit">👥 効くのは　'
    + hit.map(x => '<b>' + x.n + '</b>').join('・') + '</div>';
}

/* この設備が「ど真ん中」に嵌まる客を1人でっち上げる（満点を測るためだけの張りぼて）*/
function yIdealType(d) {
  if (d.cat === 'sauna') return { saunaPref: d.temp, likesSauna: 1 };
  if (d.cat === 'furo') return { furoPref: d.temp };
  return { coldLove: clamp((19 - d.temp) / 11, 0, 1) };   // idealCold() が d.temp になる客
}
/* いまこの階に来る客の、好みの平均（熱すぎるのか、ぬるすぎるのかを言い分けるため）*/
function yPrefAvg(d, types) {
  const of = t => d.cat === 'sauna' ? t.saunaPref
    : d.cat === 'furo' ? t.furoPref
      : 8 + (1 - t.coldLove) * 11;
  return types.reduce((a, t) => a + of(t), 0) / types.length;
}

/* ---- ② 数字の札（収容・温度・維持費）---- */
function yInfoChips(id) {
  const d = EQ[id], out = [];
  if (typeof CAP_CATS !== 'undefined' && CAP_CATS.includes(d.cat) && d.cap > 0)
    out.push('<span class="cap-chip">収容' + d.cap + '人</span>');
  if (d.shoes) out.push('<span class="cap-chip">' + d.shoes + '人ぶん</span>');
  if (d.temp != null) {
    const lab = d.cat === 'mizu' ? '水温' : d.cat === 'sauna' ? '室温' : '湯温';
    out.push('<span class="cap-chip">' + lab + d.temp + '℃</span>');
  }
  if (d.run > 0) out.push('<span class="cap-chip">維持費 ' + yen(d.run) + '/日</span>');
  return out.join(' ');
}

/* ---- ③ 設置画面に出す一枚 ---- */
function yPlaceInfo(id) {
  const d = EQ[id];
  if (!d) return '';
  const area = (CONF.areas && CONF.areas[G.actF | 0])
    ? ({ otoko: AY.OTOKO, onna: AY.ONNA })[CONF.areas[G.actF | 0].key]
    : undefined;
  const chips = yInfoChips(id);
  /* EQ_NOTE は desc を1行に圧縮したものなので、desc を出せる場所では重ねない
     （「110℃・無音」と「110℃。無音。…」が並ぶ）。
     desc を持たないのは受付カウンターだけ＝そこだけ note を出す */
  const note = d.desc ? '' : (EQ_NOTE[id] ? String(EQ_NOTE[id]).replace('{店名}', G.name) : '');
  return '<div class="pi-head"><img class="pi-icon" src="' + iconFor(id) + '">'
    + '<div><b>' + d.name + '</b>'
    + (chips ? '<div class="pi-chips">' + chips + '</div>' : '')
    + '</div></div>'
    + (d.desc ? '<div class="pi-desc">' + d.desc + '</div>' : '')
    + yFitLine(id, area)
    + (note ? '<div class="pi-note">💡 ' + note + '</div>' : '');
}

registerChapter2Hooks({ placeInfo: yPlaceInfo });
