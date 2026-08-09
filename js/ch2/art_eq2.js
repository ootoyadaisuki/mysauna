'use strict';

/* ============================================================
   第2章の設備のドット絵
   ------------------------------------------------------------
   第1章の設備は js/game.js の drawEquipArt がカテゴリごとに描いている。
   第2章は品数が多く（99点）、しかも中身がまったく別なので、
   **id ごとの絵をこのファイルに集める**。

   ・ART2[id] が有れば、その絵で描く
   ・無ければ、これまでどおり共通の札（drawGenericEquip）に落ちる
     ＝描き足しは1品ずつ足していけて、途中でも画面は壊れない

   座標は「その設備の左上」からの相対。w,h は実寸（ピクセル）。
   1マス＝T（40px）なので、2x1 の設備なら w=80, h=40。
   ============================================================ */

/* ---- 描くための小道具 ---- */
function a2px(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
/* 床に落ちる影。設備の足もとを締める */
function a2shadow(c, x, y, w, h) { a2px(c, x + 2, y + 4, w, h - 2, 'rgba(0,0,0,.26)'); }
/* 金属の箱（業務用機器の基本形）。上面のハイライトと下の影で厚みを出す */
function a2metal(c, x, y, w, h, base, top) {
  a2px(c, x, y, w, h, base);
  a2px(c, x, y, w, Math.max(2, h * .12), top || '#b9c2c8');
  a2px(c, x, y + h - 3, w, 3, 'rgba(0,0,0,.28)');
}
/* 木の天板（席まわりの基本形） */
function a2wood(c, x, y, w, h, base, top) {
  a2px(c, x, y, w, h, base);
  a2px(c, x, y, w, 3, top || '#bb9264');
  a2px(c, x, y + h - 3, w, 3, 'rgba(0,0,0,.22)');
}
/* 彫りの入ったパネル（扉の面） */
function a2panel(c, x, y, w, h, col) {
  a2px(c, x, y, w, h, col);
  c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = 1;
  c.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
  c.strokeStyle = 'rgba(255,255,255,.12)';
  c.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
}
/* 湯気・煙。動いている厨房に見せる（rt＝実時間の秒） */
function a2steam(c, x, y, rt, n, col) {
  c.fillStyle = col || 'rgba(240,240,235,.42)';
  for (let i = 0; i < (n || 3); i++) {
    const t = (rt * .7 + i * .37) % 1;
    const r = 1.6 + t * 3.2;
    c.globalAlpha = (1 - t) * .55;
    c.beginPath(); c.arc(x + Math.sin(rt * 2 + i * 2.1) * 3, y - t * 13, r, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
}


/* ---- 駐車場に停まる車 ----
   車1台＝1×2マス（縦向き）、大型車＝1×3マス（縦向き）。作者指定。
   停まっている台数は、いま館内にいる客の数から出す（1台に平均1.4人乗ってくる）。
   準備中・開業前は空っぽ＝白線だけが引かれている                                */
function a2carsNow() {
  if (G.phase !== 'biz') return 0;
  return Math.ceil(G.customers.length / 1.4);
}
function a2bigCarsNow() {
  if (G.phase !== 'biz') return 0;
  return G.customers.filter(c => c.typeKey === 'driver').length;
}
/* 同じ id の設備のうち、これが何番目か（左上から順） */
function a2slotIndex(it, id) {
  let n = 0;
  for (const e of G.equip) { if (e.id === id) { if (e === it) return n; n++; } }
  return 0;
}
/* 上から見下ろした乗用車（縦向き・前が上）。cx＝中心、ty＝上端 */
function a2car(c, cx, ty, len, col, big) {
  const bw = big ? 26 : 22;                          // 車幅
  a2px(c, cx - bw / 2 + 2, ty + 3, bw, len - 2, 'rgba(0,0,0,.30)');     // 影
  a2px(c, cx - bw / 2 - 2, ty + len * .18, 4, len * .18, '#1c1a18');    // タイヤ（4輪）
  a2px(c, cx + bw / 2 - 2, ty + len * .18, 4, len * .18, '#1c1a18');
  a2px(c, cx - bw / 2 - 2, ty + len * .64, 4, len * .18, '#1c1a18');
  a2px(c, cx + bw / 2 - 2, ty + len * .64, 4, len * .18, '#1c1a18');
  a2px(c, cx - bw / 2, ty, bw, len, col);                                // 車体
  a2px(c, cx - bw / 2, ty, bw, 3, 'rgba(255,255,255,.22)');              // 天面のハイライト
  if (big) {                                                             // トラック＝運転席＋荷台
    a2px(c, cx - bw / 2 + 2, ty + 3, bw - 4, len * .22, '#20262c');      // フロントガラス
    a2px(c, cx - bw / 2 + 1, ty + len * .30, bw - 2, len * .66, '#c9c4b8');  // 箱の荷台
    c.strokeStyle = 'rgba(0,0,0,.20)'; c.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const yy = ty + len * .30 + i * (len * .66) / 4;
      c.beginPath(); c.moveTo(cx - bw / 2 + 1, yy); c.lineTo(cx + bw / 2 - 1, yy); c.stroke();
    }
  } else {
    a2px(c, cx - bw / 2 + 3, ty + len * .16, bw - 6, len * .20, '#20262c');   // フロントガラス
    a2px(c, cx - bw / 2 + 3, ty + len * .62, bw - 6, len * .17, '#2a3138');   // リアガラス
    a2px(c, cx - bw / 2 + 1, ty + len * .40, 2, len * .16, '#3a4148');        // サイドミラー・ドア線
    a2px(c, cx + bw / 2 - 3, ty + len * .40, 2, len * .16, '#3a4148');
  }
  a2px(c, cx - bw / 2 + 2, ty + 1, 4, 2.5, '#ffe9a8');                   // 前照灯
  a2px(c, cx + bw / 2 - 6, ty + 1, 4, 2.5, '#ffe9a8');
  a2px(c, cx - bw / 2 + 2, ty + len - 3, 4, 2, '#c9402e');               // 尾灯
  a2px(c, cx + bw / 2 - 6, ty + len - 3, 4, 2, '#c9402e');
}
const A2_CAR_COL = ['#4a6b8a', '#8a4a4a', '#e8e2d8', '#3a3f44', '#4a7a5a', '#c9a86a'];

const ART2 = {


  /* ══════════ 受付 ══════════════════════════════════════ */

  bandai(c, x, y, w, h) {                                             // 受付カウンター（3x1）
    a2shadow(c, x, y, w, h);
    a2px(c, x, y + 6, w, h - 9, '#6b432a');                           // 台
    a2px(c, x, y + 3, w, 7, '#8a5a3a');                               // 天板
    a2px(c, x, y + 3, w, 2, '#a5714a');
    c.strokeStyle = 'rgba(0,0,0,.20)'; c.lineWidth = 1;               // 板の継ぎ目
    for (let i = 1; i < 3; i++) { c.beginPath(); c.moveTo(x + i * w / 3, y + 10); c.lineTo(x + i * w / 3, y + h - 3); c.stroke(); }
    a2px(c, x + w - 24, y + 5, 15, 6, '#3a3f44');                     // レジ
    a2px(c, x + w - 22, y + 6, 11, 3, '#7ac96a');
    a2px(c, x + 8, y + 5, 10, 5, '#e8ddc8');                          // 台帳
    a2px(c, x + 22, y + 6, 3, 4, '#c9a86a');                          // ペン立て
  },

  /* ══════════ 厨房 ══════════════════════════════════════ */

  /* 厨房（4×2の一個物）。**奥の列が調理台、手前の列がカウンター。**
     コンロ・寸胴・炊飯器・冷蔵庫を1枚の絵に収めてある＝
     器具を1つずつ買わせるのをやめたので、絵のほうに全部入っている。

     出来上がった皿は、手前のカウンターの上に並ぶ（描くのは shokudo2.js の
     drawPass＝盤面の上に載せる演出なので、この絵には含めない）              */
  k2_kitchen(c, x, y, w, h, rt) {
    const bh = h * .58;                                                // 奥＝調理台の高さ
    a2shadow(c, x, y, w, h);
    // 手前のカウンター（木口）
    a2px(c, x, y + bh, w, h - bh, '#8a6a45');
    a2px(c, x, y + bh, w, (h - bh) * .3, '#a8865c');                   // 天板の照り
    c.strokeStyle = 'rgba(60,44,28,.5)'; c.lineWidth = 1;
    c.strokeRect(x + .5, y + bh + .5, w - 1, h - bh - 1);
    // 奥＝ステンレスの調理台
    a2metal(c, x, y, w, bh, '#7e858a', '#9aa2a7');
    a2px(c, x, y, w, bh * .14, '#b6bdc1');                             // フードの下端の照り
    // 換気フード
    a2px(c, x + 2, y - 1, w - 4, bh * .22, '#5c6367');
    // コンロ（2口）と青い火
    for (let i = 0; i < 2; i++) {
      const cx = x + w * (i ? .22 : .11), cy = y + bh * .66;
      a2px(c, cx - 6, cy - 5, 12, 10, '#33383c');
      const fl = 2 + Math.sin(rt * 6 + i * 2) * .7;
      c.fillStyle = '#5fa8e8'; c.beginPath(); c.arc(cx, cy, fl, 0, Math.PI * 2); c.fill();
    }
    // 寸胴（湯気つき）
    a2px(c, x + w * .36, y + bh * .34, 13, 13, '#b8bdc0');
    a2px(c, x + w * .36 - 1, y + bh * .34 - 2, 15, 3, '#cfd4d6');
    a2steam(c, x + w * .36 + 6, y + bh * .30, rt, 2);
    // 炊飯器
    a2px(c, x + w * .58, y + bh * .40, 12, 11, '#e2e4e2');
    a2px(c, x + w * .58 + 2, y + bh * .40 + 3, 8, 3, '#4a4e52');
    // 冷蔵庫（右端・縦長）
    a2px(c, x + w - 16, y + 2, 14, bh - 4, '#c8ccce');
    a2px(c, x + w - 6, y + bh * .38, 2, 7, '#8a9095');                 // 取っ手
    // カウンターの上に置いた皿の重ね（飾り）
    a2px(c, x + 5, y + bh + 4, 9, 3, '#e8e4dc');
    a2px(c, x + 6, y + bh + 2, 7, 2, '#f2eee6');
  },

  /* ══════════ 食堂 ══════════════════════════════════════ */

  // カウンター席（2x1）＝天板とスツール2つ
  k2_counter(c, x, y, w, h) {
    a2shadow(c, x, y, w, h);
    a2wood(c, x, y + 4, w, h - 14, '#a07a4e');
    for (let i = 0; i < 2; i++) {                                        // スツール
      const cx = x + w * (i ? .72 : .28);
      a2px(c, cx - 2, y + h - 12, 4, 8, '#6f7a80');
      c.fillStyle = '#8a4a3a';
      c.beginPath(); c.ellipse(cx, y + h - 12, 8, 4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#a55c46';
      c.beginPath(); c.ellipse(cx, y + h - 13, 8, 3.4, 0, 0, Math.PI * 2); c.fill();
    }
  },

  // テーブル席（2x2）＝四人掛け。椅子が四方に
  k2_table(c, x, y, w, h) {
    a2shadow(c, x, y, w, h);
    for (const [cx, cy] of [[x + w * .5, y + 8], [x + w * .5, y + h - 8], [x + 9, y + h * .5], [x + w - 9, y + h * .5]]) {
      a2px(c, cx - 7, cy - 5, 14, 10, '#7a5c46');                        // 椅子
      a2px(c, cx - 7, cy - 5, 14, 3, '#96755a');
    }
    a2wood(c, x + w * .18, y + h * .22, w * .64, h * .56, '#a07a4e');
    c.fillStyle = '#e8ddc8';                                             // 皿
    c.beginPath(); c.arc(x + w * .38, y + h * .48, 6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x + w * .62, y + h * .48, 6, 0, Math.PI * 2); c.fill();
    a2px(c, x + w * .48, y + h * .62, 4, 8, '#c9a86a');                  // 箸立て
  },

  // 立ち飲みカウンター（3x1）＝細長い天板だけ。椅子は無い
  k2_bar(c, x, y, w, h) {
    a2shadow(c, x, y, w, h);
    a2wood(c, x, y + 6, w, h - 16, '#8a6a44');
    a2px(c, x + 6, y + h - 10, 4, 8, '#5f696e');                         // 支柱
    a2px(c, x + w / 2 - 2, y + h - 10, 4, 8, '#5f696e');
    a2px(c, x + w - 10, y + h - 10, 4, 8, '#5f696e');
    a2px(c, x + 4, y + h - 6, w - 8, 3, '#4e585f');                      // 足かけの棒
    for (let i = 0; i < 3; i++) {                                        // 置かれたジョッキ
      const cx = x + w * (.22 + i * .28);
      a2px(c, cx - 4, y + 9, 8, 9, 'rgba(230,180,70,.7)');
      a2px(c, cx - 4, y + 9, 8, 2, 'rgba(255,250,230,.85)');
    }
  },

  // 座敷席（3x2）＝畳と座卓
  k2_zaseki(c, x, y, w, h) {
    a2shadow(c, x, y, w, h);
    a2px(c, x, y, w, h - 3, '#c2c08a');                                  // 畳
    c.strokeStyle = 'rgba(120,120,80,.35)'; c.lineWidth = 1;
    for (let i = 1; i < 3; i++) { c.beginPath(); c.moveTo(x + i * w / 3, y); c.lineTo(x + i * w / 3, y + h - 3); c.stroke(); }
    a2px(c, x, y, w, 3, '#3b3a2a');                                      // 縁
    a2px(c, x, y + h - 6, w, 3, '#3b3a2a');
    a2wood(c, x + w * .22, y + h * .28, w * .56, h * .40, '#8a5a3a', '#a5714a');   // 座卓
    for (const dx of [x + w * .10, x + w * .84]) {                       // 座布団
      a2px(c, dx - 6, y + h * .36, 12, 11, '#8a4a5a');
      a2px(c, dx - 6, y + h * .36, 12, 3, '#a55c6e');
    }
  },

  // 窓際のカウンター（3x1）＝外を向いた席。窓の光が差す
  k2_terrace(c, x, y, w, h) {
    a2shadow(c, x, y, w, h);
    a2px(c, x, y, w, 9, 'rgba(198,232,242,.55)');                        // 窓
    c.strokeStyle = '#cfe0e6'; c.lineWidth = 1; c.strokeRect(x + .5, y + .5, w - 1, 8);
    c.beginPath(); c.moveTo(x + w * .35, y + 8); c.lineTo(x + w * .45, y + 1); c.stroke();
    a2wood(c, x, y + 11, w, h - 22, '#96754e');
    for (let i = 0; i < 3; i++) {                                        // スツール
      const cx = x + w * (.18 + i * .32);
      a2px(c, cx - 2, y + h - 10, 4, 7, '#6f7a80');
      c.fillStyle = '#7a5c46';
      c.beginPath(); c.ellipse(cx, y + h - 10, 7, 3.4, 0, 0, Math.PI * 2); c.fill();
    }
  },

  // 生ビールサーバー（1x1）＝タップと注いだ泡
  k2_beer(c, x, y, w, h) {
    a2shadow(c, x, y, w, h);
    a2metal(c, x + 6, y + 4, w - 12, h - 12, '#a9b3b8', '#c6cfd4');
    a2px(c, x + w / 2 - 2, y + 12, 4, 12, '#c9a86a');                    // タップ
    a2px(c, x + w / 2 - 5, y + 22, 10, 3, '#b09040');
    a2px(c, x + w / 2 - 4, y + h - 14, 8, 10, 'rgba(230,180,70,.85)');   // ジョッキ
    a2px(c, x + w / 2 - 4, y + h - 14, 8, 3, 'rgba(255,252,238,.9)');
    a2px(c, x + w / 2 + 4, y + h - 12, 2, 5, 'rgba(220,225,225,.7)');
  },

  // ソフトクリーム機（1x1）＝2本のレバーと巻いたコーン
  k2_soft(c, x, y, w, h) {
    a2shadow(c, x, y, w, h);
    a2metal(c, x + 5, y + 3, w - 10, h - 10, '#c6cfd4', '#e2e8ec');
    a2px(c, x + 9, y + 8, w - 18, 7, '#8a9aa4');                         // ホッパー
    for (const dx of [x + w / 2 - 6, x + w / 2 + 3]) a2px(c, dx, y + 18, 3, 8, '#5f696e');
    c.fillStyle = '#f2e0b8';                                             // コーン
    c.beginPath(); c.moveTo(x + w / 2 - 4, y + h - 14); c.lineTo(x + w / 2 + 4, y + h - 14); c.lineTo(x + w / 2, y + h - 5); c.closePath(); c.fill();
    c.fillStyle = '#fff6e4';                                             // クリーム
    c.beginPath(); c.arc(x + w / 2, y + h - 16, 4.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x + w / 2, y + h - 20, 3, 0, Math.PI * 2); c.fill();
  },

  // コーヒーマシン（1x1）＝抽出口とサーバー
  k2_coffee(c, x, y, w, h, rt) {
    a2shadow(c, x, y, w, h);
    a2px(c, x + 6, y + 3, w - 12, h - 10, '#3a3f44');
    a2px(c, x + 6, y + 3, w - 12, 3, '#5a6167');
    a2px(c, x + 9, y + 8, w - 18, 6, '#6ab0d8');                         // パネル
    a2px(c, x + w / 2 - 3, y + 16, 6, 4, '#8d9599');                     // 抽出口
    a2px(c, x + w / 2 - 7, y + h - 15, 14, 10, 'rgba(60,35,20,.85)');    // サーバー
    a2px(c, x + w / 2 - 7, y + h - 15, 14, 2, 'rgba(120,80,50,.9)');
    a2px(c, x + w / 2 + 6, y + h - 13, 3, 6, '#c9a86a');                 // 取っ手
    a2steam(c, x + w / 2, y + h - 18, rt, 2);
  },

  // 食器返却棚（2x1）＝重ねたトレーと洗い桶
  k2_sara(c, x, y, w, h) {
    a2shadow(c, x, y, w, h);
    a2px(c, x, y + 6, w, h - 12, '#6b5241');
    a2px(c, x, y + 6, w, 3, '#87684f');
    a2px(c, x + 4, y + h * .42, w * .42, 3, '#4e3c2e');                  // 棚板
    for (let i = 0; i < 4; i++) a2px(c, x + 6, y + 10 + i * 3, w * .36, 2.2, '#c8c0ac');   // 重ねたトレー
    a2px(c, x + w * .55, y + 12, w * .38, h - 24, '#8d9599');            // 桶
    a2px(c, x + w * .57, y + 14, w * .34, h - 28, '#5f696e');
    a2px(c, x + w * .60, y + 17, 8, 3, '#c6ccc8');                       // 食器
    a2px(c, x + w * .72, y + 20, 7, 3, '#c6ccc8');
  },

  /* ══════════ 浴室：サウナ ══════════════════════════════ */

  // サウナ小屋の基本形。木の壁＋扉＋覗き窓＋温度札（doorAt＝扉の中心の割合）
  _sauna(c, x, y, w, h, rt, wall, roof, temp, opt) {
    const o = opt || {};
    a2shadow(c, x, y, w, h);
    a2px(c, x, y, w, h, wall);
    a2px(c, x, y, w, 5, roof);                                        // 屋根の見切り
    c.strokeStyle = 'rgba(0,0,0,.16)'; c.lineWidth = 1;               // 板目
    for (let i = 1; i * 7 < h - 6; i++) { c.beginPath(); c.moveTo(x, y + 5 + i * 7); c.lineTo(x + w, y + 5 + i * 7); c.stroke(); }
    const dx = x + w * (o.doorAt || .5) - 11;
    a2px(c, dx - 2, y + h - 24, 26, 24, '#4a3528');                   // 扉枠
    a2px(c, dx, y + h - 22, 22, 22, o.door || '#7a5a3a');
    a2px(c, dx + 4, y + h - 19, 14, 9, 'rgba(230,240,235,.5)');       // 覗き窓
    c.strokeStyle = '#cfe0e6'; c.lineWidth = 1; c.strokeRect(dx + 4.5, y + h - 18.5, 13, 8);
    a2px(c, dx + 19, y + h - 12, 2, 6, '#c9a86a');                    // 取っ手
    if (temp) {                                                       // 温度札
      a2px(c, x + w - 26, y + 8, 23, 12, 'rgba(20,16,12,.72)');
      c.fillStyle = '#ffd98a'; c.font = 'bold 9px "DotGothic16",sans-serif'; c.textAlign = 'center';
      c.fillText(temp, x + w - 14.5, y + 17);
    }
    if (o.steam) a2steam(c, dx + 11, y + h - 26, rt, 3);
  },
  s2_steam(c, x, y, w, h, rt)  { ART2._sauna(c, x, y, w, h, rt, '#9aa8a4', '#b2c0bc', '45℃', { door: '#7f8f8a', steam: 1 }); },
  s2_kobeya(c, x, y, w, h, rt) { ART2._sauna(c, x, y, w, h, rt, '#8a6a44', '#a5825a', '90℃', { door: '#6b4a2a', doorAt: .3 });
    a2px(c, x + w * .58, y + h - 22, 18, 20, '#6b4a2a');              // もう一室ぶんの扉
    a2px(c, x + w * .58 + 3, y + h - 19, 12, 8, 'rgba(230,240,235,.4)'); },
  s2_main(c, x, y, w, h, rt)   { ART2._sauna(c, x, y, w, h, rt, '#8a6a44', '#a5825a', '90℃', { steam: 1 });
    a2px(c, x + 6, y + 10, 16, 10, '#3a2f26');                        // ストーブ
    a2px(c, x + 8, y + 12, 12, 4, '#c9622e'); },
  s2_big(c, x, y, w, h, rt)    { ART2._sauna(c, x, y, w, h, rt, '#96754e', '#b08a5e', '85℃', { steam: 1 });
    a2px(c, x + 5, y + 9, w - 10, 5, '#6b4a2a');                      // 寝られる段
    a2px(c, x + 5, y + 17, w - 10, 5, '#7a5a36'); },
  s2_hot(c, x, y, w, h, rt)    { ART2._sauna(c, x, y, w, h, rt, '#6b4a3a', '#8a5f46', '110℃', { door: '#4e352a' });
    c.fillStyle = 'rgba(230,120,60,.22)'; c.fillRect(x + 2, y + 6, w - 4, h - 10); },
  s2_kero(c, x, y, w, h, rt)   { ART2._sauna(c, x, y, w, h, rt, '#c2a274', '#d8bb8c', '90℃', { door: '#a8865a', steam: 1 });
    a2px(c, x + 5, y + 10, 12, 12, '#4a3f34');                        // ストーブと桶
    a2px(c, x + 7, y + 12, 8, 4, '#c9622e');
    a2px(c, x + w - 20, y + 12, 10, 8, '#9a7a4a'); },

  s2_maki(c, x, y, w, h, rt) {                                        // 薪サウナ＝煙突から煙、薪が積んである
    ART2._sauna(c, x, y, w, h, rt, '#7a5a3a', '#96724a', '80℃', { door: '#5c4028', steam: 1 });
    a2px(c, x + w - 16, y + 2, 7, 12, '#4a4438');                     // 煙突
    a2px(c, x + w - 17, y + 1, 9, 3, '#5f5a4c');
    a2steam(c, x + w - 12.5, y + 1, rt, 4, 'rgba(210,208,200,.45)');
    for (let i = 0; i < 4; i++) {                                     // 積んだ薪（木口）
      c.fillStyle = '#a5825a';
      c.beginPath(); c.arc(x + 8 + (i % 2) * 7, y + h - 10 - ((i / 2) | 0) * 6, 3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#c2966a';
      c.beginPath(); c.arc(x + 8 + (i % 2) * 7, y + h - 10 - ((i / 2) | 0) * 6, 1.6, 0, Math.PI * 2); c.fill();
    }
  },
  s2_mushi(c, x, y, w, h, rt) {                                       // 蒸サウナ＝高野槙の樽。ひとり用
    a2shadow(c, x, y, w, h);
    a2px(c, x + 4, y + 8, w - 8, h - 12, '#c2a274');                  // 樽の胴
    c.strokeStyle = 'rgba(120,90,50,.35)'; c.lineWidth = 1;           // 縦の板
    for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(x + 4 + i * (w - 8) / 5, y + 8); c.lineTo(x + 4 + i * (w - 8) / 5, y + h - 4); c.stroke(); }
    a2px(c, x + 3, y + h * .38, w - 6, 3, '#8a6a44');                 // タガ（箍）
    a2px(c, x + 3, y + h * .72, w - 6, 3, '#8a6a44');
    c.fillStyle = '#d8bd92';                                          // 座る穴（上から見える）
    c.beginPath(); c.ellipse(x + w / 2, y + 10, (w - 14) / 2, 4, 0, 0, Math.PI * 2); c.fill();
    a2px(c, x + 6, y + h - 12, w - 12, 5, '#5f7a4a');                 // 薬草の袋
    a2steam(c, x + w / 2, y + 8, rt, 4, 'rgba(210,225,200,.45)');
  },
  s2_finland(c, x, y, w, h, rt) {                                     // フィンランドサウナ＝石と柄杓
    ART2._sauna(c, x, y, w, h, rt, '#c2a274', '#d8bb8c', '90℃', { door: '#a8865a', steam: 1 });
    a2px(c, x + 6, y + 10, 14, 12, '#4a4438');                        // ストーブ
    for (let i = 0; i < 5; i++) {                                     // サウナストーン
      c.fillStyle = ['#7d7a70', '#8f8c82', '#6e6a60'][i % 3];
      c.beginPath(); c.arc(x + 9 + (i % 3) * 4.5, y + 12 + ((i / 3) | 0) * 4.5, 2.6, 0, Math.PI * 2); c.fill();
    }
    a2px(c, x + 23, y + 16, 8, 2, '#a5825a');                         // 柄杓
    a2px(c, x + 22, y + 13, 5, 5, '#c2966a');
    a2px(c, x + w - 22, y + h - 20, 9, 10, '#8a6a44');                // 桶
  },
  s2_oto(c, x, y, w, h, rt) {                                         // 音サウナ＝真っ赤な照明と重低音
    ART2._sauna(c, x, y, w, h, rt, '#4a2a28', '#66393a', '95℃', { door: '#3a1f1e' });
    const pulse = (Math.sin(rt * 5) + 1) / 2;                         // 低音に合わせて明滅
    c.fillStyle = `rgba(210,40,30,${(.18 + pulse * .22).toFixed(2)})`;
    c.fillRect(x + 2, y + 6, w - 4, h - 10);
    a2px(c, x + 5, y + 8, 3, h - 18, '#c9302a');                      // ライン照明
    a2px(c, x + w - 8, y + 8, 3, h - 18, '#c9302a');
    for (const cx of [x + 12, x + w - 14]) {                          // スピーカー
      a2px(c, cx - 5, y + 10, 10, 13, '#1e1a1a');
      c.fillStyle = '#3a3030';
      c.beginPath(); c.arc(cx, y + 15 + pulse * .6, 3.4, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#5a4a4a';
      c.beginPath(); c.arc(cx, y + 21, 1.8, 0, Math.PI * 2); c.fill();
    }
    c.strokeStyle = `rgba(255,140,110,${(.25 + pulse * .35).toFixed(2)})`; c.lineWidth = 1.4;
    for (let i = 1; i < 3; i++) {                                     // 音の輪
      c.beginPath(); c.arc(x + w / 2, y + h * .5, i * 7 + pulse * 4, 0, Math.PI * 2); c.stroke();
    }
  },

  /* ══════════ 外気浴・ととのい ══════════════════════════ */

  b2_totonoi(c, x, y, w, h) {                                         // ととのいイス
    a2shadow(c, x, y, w, h);
    a2px(c, x + 8, y + 6, w - 16, 7, '#e8e2d8');                      // 背
    a2px(c, x + 8, y + 6, w - 16, 2, '#fff8ea');
    a2px(c, x + 7, y + 15, w - 14, 10, '#dcd6cc');                    // 座
    a2px(c, x + 7, y + 15, w - 14, 2, '#f2ece2');
    a2px(c, x + 9, y + h - 8, 3, 6, '#8d9599'); a2px(c, x + w - 12, y + h - 8, 3, 6, '#8d9599');
  },
  b2_infinity(c, x, y, w, h) {                                        // インフィニティチェア（1x2・倒れている）
    a2shadow(c, x, y, w, h);
    a2px(c, x + 8, y + 4, w - 16, h * .42, '#3f4a52');                // 背（大きく倒れている）
    a2px(c, x + 8, y + 4, w - 16, 3, '#5a6870');
    a2px(c, x + 6, y + h * .46, w - 12, h * .30, '#4a5860');          // 座
    a2px(c, x + 9, y + h * .78, w - 18, h * .12, '#3f4a52');          // 足のせ
    c.strokeStyle = '#8d9599'; c.lineWidth = 2;                       // フレーム
    c.beginPath(); c.moveTo(x + 5, y + 6); c.lineTo(x + 5, y + h - 5); c.stroke();
    c.beginPath(); c.moveTo(x + w - 5, y + 6); c.lineTo(x + w - 5, y + h - 5); c.stroke();
  },
  b2_bench(c, x, y, w, h) { ART2.x2_bench(c, x, y, w, h); },

  /* ══════════ 男湯だけ／女湯だけ ══════════════════════════ */

  b2_denki(c, x, y, w, h, rt) {                                       // 電気風呂
    ART2._tub(c, x, y, w, h, rt, '#8a7a9a', '#a294b2', '41℃');
    const z = (Math.sin(rt * 9) + 1) / 2;
    c.strokeStyle = `rgba(180,220,255,${(.35 + z * .5).toFixed(2)})`; c.lineWidth = 1.6;
    for (let i = 0; i < 2; i++) {                                     // 電極のあいだに走る電気
      const yy = y + h * (.42 + i * .26);
      c.beginPath();
      for (let k = 0; k <= w - 16; k += 4)
        c.lineTo(x + 8 + k, yy + ((k / 4) % 2 ? -2 : 2));
      c.stroke();
    }
    a2px(c, x + 4, y + h * .34, 4, h * .38, '#5f696e');               // 電極板
    a2px(c, x + w - 8, y + h * .34, 4, h * .38, '#5f696e');
  },
  d2_shave(c, x, y, w, h) {                                           // ひげ剃りブース
    a2shadow(c, x, y, w, h);
    a2px(c, x, y, w, 14, 'rgba(226,242,246,.8)');                     // 鏡
    c.strokeStyle = '#a8bcc2'; c.lineWidth = 1; c.strokeRect(x + .5, y + .5, w - 1, 13);
    a2px(c, x, y + 15, w, h - 20, '#7d868a');                         // 台
    c.fillStyle = '#f2f6f6';                                          // 洗面ボウル
    c.beginPath(); c.ellipse(x + w * .3, y + h - 11, 8, 4.5, 0, 0, Math.PI * 2); c.fill();
    a2px(c, x + w * .3 - 1, y + 16, 2, 4, '#b8bfc2');
    a2px(c, x + w * .58, y + h - 14, 10, 3, '#c9c4b8');               // 剃刀
    a2px(c, x + w * .58, y + h - 14, 3, 3, '#4a5257');
    a2px(c, x + w * .78, y + h - 16, 7, 8, '#e8e2ee');                // シェービングフォーム
    a2px(c, x + w * .78 + 2, y + h - 18, 3, 2, '#b8bfc2');
  },
  sv2_yomogi(c, x, y, w, h, rt) {                                     // よもぎ蒸しの個室（2x2）
    a2shadow(c, x, y, w, h);
    a2px(c, x, y, w, h - 3, '#6b5241');                               // 個室の床（木）
    a2px(c, x, y, w, 4, '#87684f');
    a2px(c, x, y + 4, 4, h - 8, '#5c4432');                           // 間仕切り（左右）
    a2px(c, x + w - 4, y + 4, 4, h - 8, '#5c4432');
    a2px(c, x + w * .30, y + 3, w * .40, 4, '#c2a2b8');               // のれん（女性専用）
    a2px(c, x + 8, y + h * .34, w - 16, h * .40, '#8a6a44');          // 穴あきの椅子
    a2px(c, x + 8, y + h * .34, w - 16, 3, '#a5825a');
    c.fillStyle = '#3a2f26';
    c.beginPath(); c.ellipse(x + w / 2, y + h * .46, (w - 26) / 2, 4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#7a4a6a';                                          // 掛けてあるマント
    c.beginPath(); c.moveTo(x + 9, y + h - 8); c.lineTo(x + 11, y + h * .30);
    c.lineTo(x + w - 11, y + h * .30); c.lineTo(x + w - 9, y + h - 8); c.closePath(); c.fill();
    a2px(c, x + 11, y + h * .30, w - 22, 3, '#96608a');
    a2px(c, x + 12, y + h - 14, w - 24, 5, '#5f7a4a');                // よもぎの鍋
    a2steam(c, x + w / 2, y + h * .28, rt, 4, 'rgba(200,215,190,.45)');
  },
  d2_dresser(c, x, y, w, h) {                                         // 高級ドレッサー（3x1）
    a2shadow(c, x, y, w, h);
    a2px(c, x, y, w, 16, 'rgba(240,246,248,.85)');                    // 大きな鏡
    for (let i = 1; i < 3; i++) a2px(c, x + i * w / 3 - 1, y, 2, 16, '#c2a2b8');
    for (let i = 0; i < 6; i++) a2px(c, x + 5 + i * (w - 10) / 6, y + 1, 5, 3, '#ffeec2');   // 電球
    a2px(c, x, y + 17, w, h - 22, '#e8dce6');                         // 天板
    for (let i = 0; i < 3; i++) {
      const cx = x + w * (i + .5) / 3;
      a2px(c, cx - 7, y + 19, 5, 7, '#c2a2b8');                       // 高級ドライヤー
      a2px(c, cx - 8, y + 25, 7, 2, '#9a7f92');
      a2px(c, cx + 1, y + 20, 4, 6, '#f2e8ee');                       // 化粧品のボトル
      a2px(c, cx + 6, y + 22, 3, 4, '#e8c8d8');
    }
  },

  /* ══════════ 浴室：水風呂・浴槽 ════════════════════════ */

  // 湯船の基本形。縁＋水面＋波（col＝水の色）
  _tub(c, x, y, w, h, rt, col, top, label) {
    a2shadow(c, x, y, w, h);
    a2px(c, x, y, w, h, '#b8bfc2');                                   // タイルの縁
    a2px(c, x + 3, y + 3, w - 6, h - 6, col);
    a2px(c, x + 3, y + 3, w - 6, 3, top);
    c.strokeStyle = 'rgba(255,255,255,.30)'; c.lineWidth = 1;         // 波
    for (let i = 0; i < 2; i++) {
      const yy = y + 10 + i * 9 + Math.sin(rt * 1.6 + i) * 1.2;
      c.beginPath();
      for (let k = 0; k <= w - 8; k += 4) c.lineTo(x + 4 + k, yy + Math.sin((k / 7) + rt * 2 + i) * 1.4);
      c.stroke();
    }
    if (label) {
      a2px(c, x + 3, y + h - 13, 24, 11, 'rgba(20,16,12,.66)');
      c.fillStyle = '#9fd8ff'; c.font = 'bold 9px "DotGothic16",sans-serif'; c.textAlign = 'center';
      c.fillText(label, x + 15, y + h - 4.5);
    }
  },
  m2_tank(c, x, y, w, h, rt)   { ART2._tub(c, x, y, w, h, rt, '#4a86a8', '#6aa6c8', '20℃'); },
  m2_cold(c, x, y, w, h, rt)   { ART2._tub(c, x, y, w, h, rt, '#3a72a0', '#5a95c2', '15℃'); },
  m2_single(c, x, y, w, h, rt) { ART2._tub(c, x, y, w, h, rt, '#2a5f96', '#4a80b8', '9℃');
    c.fillStyle = 'rgba(230,246,255,.5)';                             // 冷気
    for (let i = 0; i < 4; i++) c.fillRect(x + 8 + i * 11, y + 6 + (i % 2) * 5, 3, 3); },
  m2_plunge(c, x, y, w, h, rt) { ART2._tub(c, x, y, w, h, rt, '#3f7ba4', '#5f9cc4', '16℃');
    a2px(c, x + w - 22, y + 6, 16, h - 12, 'rgba(255,255,255,.14)'); },  // 寝そべる段
  m2_soda(c, x, y, w, h, rt)   { ART2._tub(c, x, y, w, h, rt, '#4e8a86', '#6faaa4', '38℃');
    for (let i = 0; i < 9; i++) {                                     // 炭酸の泡
      const t = (rt * .8 + i * .11) % 1;
      c.fillStyle = `rgba(240,255,252,${((1 - t) * .55).toFixed(2)})`;
      c.beginPath(); c.arc(x + 9 + i * (w - 18) / 8, y + h - 6 - t * (h - 14), 1.5 + t, 0, Math.PI * 2); c.fill();
    } },
  b2_nuru(c, x, y, w, h, rt)   { ART2._tub(c, x, y, w, h, rt, '#c98a6a', '#dda98a', '39℃'); },
  /* あつ湯＝ぬる湯より赤く、湯気が濃い。44℃は「入る前に一呼吸置く」湯 */
  b2_atsu(c, x, y, w, h, rt)   { ART2._tub(c, x, y, w, h, rt, '#c4604a', '#dc8a6c', '44℃');
    a2steam(c, x + w * .32, y + 5, rt, 3);
    a2steam(c, x + w * .68, y + 7, rt + 1.4, 3); },
  b2_hot(c, x, y, w, h, rt)    { ART2._tub(c, x, y, w, h, rt, '#c2765a', '#d6957a', '42℃');
    for (let i = 0; i < 3; i++) {                                     // ジェットの噴流
      const cx = x + w * (.25 + i * .25);
      c.fillStyle = 'rgba(255,255,255,.35)';
      c.beginPath(); c.arc(cx, y + h * .5 + Math.sin(rt * 5 + i) * 2, 4, 0, Math.PI * 2); c.fill();
    }
    a2steam(c, x + w / 2, y + 4, rt, 2); },
  b2_roten(c, x, y, w, h, rt)  { ART2._tub(c, x, y, w, h, rt, '#a8825f', '#c29a74', '41℃');
    a2px(c, x, y, w, h, 'rgba(0,0,0,0)');
    for (const [gx, gy, r] of [[x + 7, y + 8, 6], [x + w - 9, y + 12, 7], [x + w * .5, y + h - 7, 5]]) {
      c.fillStyle = '#6e6a60'; c.beginPath(); c.arc(gx, gy, r, 0, Math.PI * 2); c.fill();     // 岩
      c.fillStyle = '#87837a'; c.beginPath(); c.arc(gx - 1, gy - 1.5, r * .7, 0, Math.PI * 2); c.fill();
    }
    a2steam(c, x + w * .35, y + 6, rt, 3); },
  z2_furo(c, x, y, w, h, rt)   { ART2._tub(c, x, y, w, h, rt, '#7e8f88', '#95a69e', '40℃');
    c.strokeStyle = 'rgba(40,50,45,.5)'; c.lineWidth = 1.4;           // 浮いたタイルのヒビ
    c.beginPath(); c.moveTo(x + 6, y + h - 6); c.lineTo(x + 18, y + h - 14); c.lineTo(x + 26, y + h - 8); c.stroke();
    a2px(c, x + w - 16, y + h - 10, 8, 5, '#5f6b64'); },

  /* ══════════ 浴室：洗い場 ══════════════════════════════ */

  w2_kakeyu(c, x, y, w, h, rt) {                                      // かけ湯＝小さな桶と湯口
    a2shadow(c, x, y, w, h);
    a2px(c, x + 5, y + 12, w - 10, h - 18, '#b8bfc2');
    a2px(c, x + 8, y + 15, w - 16, h - 24, '#cf9a7a');
    c.strokeStyle = '#a8b0b4'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x + w / 2, y + 12); c.lineTo(x + w / 2, y + 5); c.lineTo(x + w / 2 + 8, y + 5); c.stroke();
    a2steam(c, x + w / 2, y + 12, rt, 2);
  },
  w2_shower(c, x, y, w, h, rt) {                                      // シャワーブース
    a2shadow(c, x, y, w, h);
    a2px(c, x + 3, y + 2, w - 6, h - 6, 'rgba(198,232,242,.35)');
    c.strokeStyle = '#9fc4cf'; c.lineWidth = 2; c.strokeRect(x + 3.5, y + 2.5, w - 7, h - 7);
    a2px(c, x + w / 2 - 5, y + 6, 10, 4, '#b8bfc2');                  // ヘッド
    c.strokeStyle = 'rgba(200,235,245,.55)'; c.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const ox2 = x + w / 2 - 5 + i * 3.4;
      c.beginPath(); c.moveTo(ox2, y + 10); c.lineTo(ox2 - 1, y + h - 8); c.stroke();
    }
  },
  w2_bank(c, x, y, w, h) {                                            // 洗い場（5連）＝鏡・カラン・椅子
    a2shadow(c, x, y, w, h);
    a2px(c, x, y, w, h - 8, '#c6ccc8');
    for (let i = 0; i < 5; i++) {
      const cx = x + w * (i + .5) / 5;
      a2px(c, cx - 8, y + 3, 16, 12, 'rgba(220,240,245,.75)');        // 鏡
      c.strokeStyle = '#9fb0b4'; c.lineWidth = 1; c.strokeRect(cx - 7.5, y + 3.5, 15, 11);
      a2px(c, cx - 5, y + 17, 3, 5, '#b8bfc2');                       // カラン
      a2px(c, cx + 2, y + 17, 3, 5, '#b8bfc2');
      a2px(c, cx - 6, y + h - 8, 12, 5, '#e8d8b8');                   // 風呂椅子
      a2px(c, cx - 6, y + h - 8, 12, 2, '#fff0d4');
    }
  },
  sv2_akasuri(c, x, y, w, h) {                                        // 垢すり台
    a2shadow(c, x, y, w, h);
    a2px(c, x + 4, y + 6, w - 8, h - 14, '#8a5a5a');                  // ベッド
    a2px(c, x + 4, y + 6, w - 8, 4, '#a56e6e');
    a2px(c, x + 8, y + 9, w - 16, 6, '#e8e2d8');                      // 敷いた布
    a2px(c, x + 6, y + h - 8, 5, 6, '#5f696e');                       // 脚
    a2px(c, x + w - 11, y + h - 8, 5, 6, '#5f696e');
    a2px(c, x + w - 16, y + 12, 10, 7, '#c6ccc8');                    // 桶とタオル
    a2px(c, x + w - 15, y + 13, 8, 3, '#f2ead8');
  },

  /* ══════════ 脱衣所 ══════════════════════════════════════ */

  d2_locker(c, x, y, w, h) {                                          // 大型ロッカー＝縦2段×6列
    a2shadow(c, x, y, w, h);
    a2px(c, x, y, w, h, '#5f7a86');
    for (let i = 0; i < 6; i++) for (let k = 0; k < 2; k++) {
      const dx = x + 2 + i * (w - 4) / 6, dy = y + 2 + k * (h - 4) / 2;
      a2px(c, dx, dy, (w - 4) / 6 - 1.5, (h - 4) / 2 - 1.5, '#7593a0');
      a2px(c, dx, dy, (w - 4) / 6 - 1.5, 2, '#8fadb9');
      a2px(c, dx + (w - 4) / 6 - 5, dy + 4, 2, 4, '#c9a86a');         // 鍵
    }
  },
  d2_sink(c, x, y, w, h) {                                            // 洗面台＝鏡とボウル2つ
    a2shadow(c, x, y, w, h);
    a2px(c, x, y, w, 13, 'rgba(226,242,246,.8)');                     // 鏡
    c.strokeStyle = '#a8bcc2'; c.lineWidth = 1; c.strokeRect(x + .5, y + .5, w - 1, 12);
    a2px(c, x, y + 14, w, h - 18, '#d8d2c6');                         // カウンター
    for (const cx of [x + w * .28, x + w * .72]) {
      c.fillStyle = '#f2f6f6'; c.beginPath(); c.ellipse(cx, y + h - 11, 9, 5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#c6ccc8'; c.beginPath(); c.ellipse(cx, y + h - 11, 6, 3, 0, 0, Math.PI * 2); c.fill();
      a2px(c, cx - 1, y + 15, 2, 4, '#b8bfc2');
    }
  },
  d2_toilet(c, x, y, w, h) {                                          // ウォシュレット
    a2shadow(c, x, y, w, h);
    a2px(c, x + 10, y + 5, w - 20, 12, '#eef0ee');                    // タンク
    c.fillStyle = '#f6f8f6';                                          // 便器
    c.beginPath(); c.ellipse(x + w / 2, y + h - 14, 9, 10, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#d6dcd8';
    c.beginPath(); c.ellipse(x + w / 2, y + h - 14, 6, 6.5, 0, 0, Math.PI * 2); c.fill();
    a2px(c, x + w - 12, y + 8, 7, 9, '#dfe4e0');                      // 操作盤
    a2px(c, x + w - 10, y + 10, 3, 2, '#6ab0d8');
  },
  d2_powder(c, x, y, w, h) {                                          // パウダールーム＝鏡3面と椅子
    a2shadow(c, x, y, w, h);
    a2px(c, x, y, w, 15, 'rgba(232,244,248,.8)');
    for (let i = 1; i < 3; i++) a2px(c, x + i * w / 3 - 1, y, 2, 15, '#b0c2c8');
    a2px(c, x, y + 16, w, h - 22, '#e0d6c8');                         // カウンター
    for (let i = 0; i < 3; i++) {
      const cx = x + w * (i + .5) / 3;
      a2px(c, cx - 4, y + 4, 8, 3, '#ffe9a8');                        // 電球
      a2px(c, cx - 6, y + 18, 12, 4, '#c9a86a');                      // ドライヤー
      a2px(c, cx - 5, y + h - 6, 10, 4, '#8a6a5a');                   // スツール
    }
  },
  z2_kagami(c, x, y, w, h) {                                          // 割れた大鏡
    a2shadow(c, x, y, w, h);
    a2px(c, x, y + 4, w, h - 10, '#6b5241');                          // 枠（真鍮は持っていかれた）
    a2px(c, x + 3, y + 7, w - 6, h - 16, 'rgba(200,215,218,.7)');
    c.strokeStyle = 'rgba(60,70,72,.75)'; c.lineWidth = 1.6;          // 縦に走るヒビ
    c.beginPath(); c.moveTo(x + w / 2 - 2, y + 7); c.lineTo(x + w / 2 + 3, y + h * .5); c.lineTo(x + w / 2 - 3, y + h - 9); c.stroke();
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(x + w / 2 + 1, y + h * .38); c.lineTo(x + w - 8, y + h * .3); c.stroke();
    c.beginPath(); c.moveTo(x + w / 2, y + h * .62); c.lineTo(x + 8, y + h * .72); c.stroke();
  },

  /* ── 置いていかれた最低限（ボロいが、一応そろっている）──────────
     買える設備と同じ形に見えてはいけない。**どれも一目で「古い」と分かる**ように、
     色をくすませ、錆・ヒビ・貼り紙・傾きを一つずつ足してある。
     買い替えたくなることが、この絵の役目                                  */

  z2_sauna(c, x, y, w, h, rt) {                                       // 古い電気サウナ＝色褪せた板、傾いた札
    ART2._sauna(c, x, y, w, h, rt, '#7f6d55', '#93816a', '85℃', { door: '#6a5843' });
    // 板の抜け・染み
    a2px(c, x + 4, y + 12, w - 30, 3, 'rgba(60,48,36,.45)');
    a2px(c, x + w - 22, y + h - 34, 12, 6, 'rgba(70,58,44,.4)');
    // 痩せたストーン（粉になりかけ）とヒーター
    a2px(c, x + 7, y + h - 22, 15, 11, '#4a4038');
    a2px(c, x + 9, y + h - 20, 11, 4, '#8a5f3a');                     // 火の色が弱い
    c.fillStyle = '#6f6a60';
    for (let i = 0; i < 4; i++) {
      c.beginPath(); c.arc(x + 10 + (i % 3) * 4, y + h - 24 - ((i / 3) | 0) * 3, 1.8, 0, Math.PI * 2); c.fill();
    }
    // 手書きの貼り紙（斜めに貼ってある）
    c.save(); c.translate(x + 8, y + 8); c.rotate(-0.09);
    a2px(c, 0, 0, 20, 9, 'rgba(232,224,204,.85)');
    a2px(c, 2, 3, 15, 1.4, '#6b6154'); a2px(c, 2, 6, 10, 1.4, '#6b6154');
    c.restore();
  },

  z2_mizu(c, x, y, w, h, rt) {                                        // ヒビ割れた水風呂＝ぬるい水色、底のヒビ、止まったチラー
    ART2._tub(c, x, y, w, h, rt, '#6d94a0', '#84a9b4', '22℃');
    /* ヒビは**右下**に走らせる。温度札は _tub が左下に置くので、
       同じところに描くと札の裏に隠れて「割れている」が伝わらない */
    /* ヒビは**細く枝分かれ**させる。太い2本を交差させると「×印」に見えてしまう */
    const cx0 = x + w - 17, cy0 = y + h - 10;
    c.strokeStyle = 'rgba(24,38,44,.62)'; c.lineWidth = 1.1;
    c.beginPath();                                                    // 本筋（折れながら走る）
    c.moveTo(x + w - 5, y + h - 4);
    c.lineTo(x + w - 11, y + h - 7);
    c.lineTo(cx0, cy0);
    c.lineTo(x + w - 23, y + h - 8);
    c.lineTo(x + w - 28, y + h - 5);
    c.stroke();
    c.lineWidth = 0.7;                                                // 枝（短く、細く）
    c.strokeStyle = 'rgba(24,38,44,.45)';
    c.beginPath(); c.moveTo(cx0, cy0); c.lineTo(cx0 + 2, cy0 - 6); c.stroke();
    c.beginPath(); c.moveTo(x + w - 11, y + h - 7); c.lineTo(x + w - 9, y + h - 12); c.stroke();
    c.beginPath(); c.moveTo(x + w - 23, y + h - 8); c.lineTo(x + w - 25, y + h - 12); c.stroke();
    // 死んだチラー（上の縁に据えられ、配管が抜かれている）
    a2px(c, x + w - 20, y + 2, 14, 7, '#8b9094');
    a2px(c, x + w - 19, y + 3, 12, 2, '#a6abaf');
    a2px(c, x + w - 17, y + 4, 4, 4, '#5a5f63');                      // 止まったファン
    a2px(c, x + w - 6, y + 4, 4, 3, '#6b7074');                       // 切れた配管の口
    // 縁の欠け
    a2px(c, x + 6, y + 1, 7, 3, 'rgba(140,148,150,.9)');
  },

  z2_locker(c, x, y, w, h) {                                          // 錆びたロッカー＝下が錆で膨らみ、扉が二枚開いたまま
    a2shadow(c, x, y, w, h);
    a2px(c, x + 2, y + 4, w - 4, h - 8, '#7d8378');
    a2px(c, x + 2, y + 4, w - 4, 3, '#949a8c');
    const n = 4, bw = (w - 8) / n;
    for (let i = 0; i < n; i++) {
      const dx = x + 4 + i * bw;
      const open = (i === 1 || i === 3);                              // 閉まらない扉
      a2px(c, dx, y + 7, bw - 2, h - 15, open ? '#4e5349' : '#8d9387');
      if (!open) {
        a2px(c, dx + bw - 6, y + 7 + (h - 15) / 2 - 2, 3, 5, '#c9a86a');   // 鍵
        a2px(c, dx + 2, y + 10, bw - 6, 2, 'rgba(255,255,255,.14)');
      } else {
        a2px(c, dx - 1, y + 7, 2, h - 15, '#a5aa9c');                 // 開いた扉の小口
      }
    }
    /* 下端の錆。一本の帯で塗ると**棚板**に見えるので、
       高さの違う染みをまばらに置いて、縁から染み上がっている形にする */
    const rust = [[3, 4, 5], [9, 6, 3], [16, 3, 6], [22, 7, 4], [31, 4, 5], [37, 5, 3]];
    for (const [dx, rw, rh] of rust) {
      if (dx + rw > w - 3) continue;
      c.fillStyle = 'rgba(132,76,42,.5)';
      c.fillRect(x + dx, y + h - 8 - rh, rw, rh + 3);
      c.fillStyle = 'rgba(96,54,28,.45)';
      c.fillRect(x + dx + 1, y + h - 7, rw - 2, 2);
    }
    a2px(c, x + 2, y + h - 6, w - 4, 2, 'rgba(110,62,32,.4)');        // 接地部だけ薄く通す
  },

  /* ══════════ ロビー ══════════════════════════════════════ */

  f2_ticket(c, x, y, w, h) {                                          // 券売機
    a2shadow(c, x, y, w, h);
    a2px(c, x + 5, y + 3, w - 10, h - 8, '#3f4c58');
    a2px(c, x + 5, y + 3, w - 10, 3, '#5d6b78');
    a2px(c, x + 8, y + 8, w - 16, 11, '#7ac6d8');                     // ボタンの面
    for (let i = 0; i < 6; i++) a2px(c, x + 9 + (i % 3) * 8, y + 9 + ((i / 3) | 0) * 5, 6, 3.5, '#ffe9a8');
    a2px(c, x + 10, y + h - 13, w - 20, 4, '#1e242a');                // 取り出し口
    a2px(c, x + w - 14, y + 21, 6, 3, '#c9a86a');                     // コイン投入口
  },
  f2_shoe(c, x, y, w, h) {                                            // 靴箱＝木札の並び
    a2shadow(c, x, y, w, h);
    a2px(c, x, y, w, h, '#6b5241');
    for (let i = 0; i < 6; i++) for (let k = 0; k < 2; k++) {
      const dx = x + 2 + i * (w - 4) / 6, dy = y + 2 + k * (h - 4) / 2;
      a2px(c, dx, dy, (w - 4) / 6 - 1.5, (h - 4) / 2 - 1.5, '#8a6a4a');
      a2px(c, dx + 2, dy + 2, 3, 5, '#c9a86a');                       // 木札
    }
  },
  f2_goods(c, x, y, w, h) {                                           // 物販棚＝サウナハットとTシャツ
    a2shadow(c, x, y, w, h);
    a2px(c, x, y, w, h - 4, '#7a5c46');
    a2px(c, x + 2, y + h * .48, w - 4, 2.5, '#5c4232');
    for (let i = 0; i < 3; i++) {                                     // ハット
      const cx = x + w * (.2 + i * .3);
      c.fillStyle = ['#e8dcc4', '#c9a86a', '#a8bcc2'][i];
      c.beginPath(); c.ellipse(cx, y + 10, 7, 4.5, 0, 0, Math.PI * 2); c.fill();
      a2px(c, cx - 4, y + 5, 8, 5, ['#e8dcc4', '#c9a86a', '#a8bcc2'][i]);
    }
    for (let i = 0; i < 3; i++) a2px(c, x + 5 + i * (w - 12) / 3, y + h * .58, (w - 16) / 3, 9, ['#4a6b8a', '#8a4a5a', '#4a6b4a'][i]);
  },
  f2_vend(c, x, y, w, h) {                                            // 自販機
    a2shadow(c, x, y, w, h);
    a2px(c, x + 4, y + 2, w - 8, h - 6, '#b3402e');
    a2px(c, x + 4, y + 2, w - 8, 4, '#d05a44');
    a2px(c, x + 7, y + 8, w - 14, 14, 'rgba(255,255,255,.22)');       // 見本の窓
    for (let i = 0; i < 6; i++) a2px(c, x + 8 + (i % 3) * 7, y + 9 + ((i / 3) | 0) * 6, 5, 5, ['#e8c84a', '#7ac96a', '#6ab0d8'][i % 3]);
    a2px(c, x + 8, y + h - 12, w - 16, 5, '#2b2119');                 // 取り出し口
  },
  f2_sofa(c, x, y, w, h) {                                            // 待合ソファ
    a2shadow(c, x, y, w, h);
    a2px(c, x, y + 4, w, h - 12, '#6a4a6a');                          // 背もたれ
    a2px(c, x, y + 4, w, 4, '#84608a');
    a2px(c, x + 2, y + h * .48, w - 4, h * .38, '#7d5a7d');           // 座面
    a2px(c, x + 2, y + h * .48, w - 4, 3, '#96729a');
    a2px(c, x + w / 2 - 1, y + h * .48, 2, h * .38, 'rgba(0,0,0,.18)');
    a2px(c, x + 3, y + h - 6, 5, 5, '#4a3528'); a2px(c, x + w - 8, y + h - 6, 5, 5, '#4a3528');
  },
  f2_kasa(c, x, y, w, h) {                                            // 傘立て
    a2shadow(c, x, y, w, h);
    a2px(c, x + 9, y + 16, w - 18, h - 22, '#5f696e');
    a2px(c, x + 9, y + 16, w - 18, 3, '#7f8a90');
    for (let i = 0; i < 3; i++) {                                     // 傘
      const cx = x + 13 + i * 6;
      c.strokeStyle = ['#4a6b8a', '#8a4a5a', '#3a3f44'][i]; c.lineWidth = 2;
      c.beginPath(); c.moveTo(cx, y + 18); c.lineTo(cx - 1, y + 6); c.stroke();
      a2px(c, cx - 3, y + 4, 6, 3, ['#4a6b8a', '#8a4a5a', '#3a3f44'][i]);
    }
  },
  f2_maruta(c, x, y, w, h) {                                          // 丸太のベンチ
    a2shadow(c, x, y, w, h);
    a2px(c, x + 2, y + h * .34, w - 4, h * .40, '#a57a4a');
    a2px(c, x + 2, y + h * .34, w - 4, 4, '#c2966a');
    c.strokeStyle = 'rgba(90,60,30,.35)'; c.lineWidth = 1;            // 木肌
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(x + 6 + i * (w - 12) / 4, y + h * .38); c.lineTo(x + 6 + i * (w - 12) / 4, y + h * .70); c.stroke(); }
    c.fillStyle = '#8a6a44';                                          // 木口
    c.beginPath(); c.ellipse(x + 3, y + h * .54, 3, h * .21, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(x + w - 3, y + h * .54, 3, h * .21, 0, 0, Math.PI * 2); c.fill();
    a2px(c, x + 7, y + h - 6, 5, 5, '#6b4a2a'); a2px(c, x + w - 12, y + h - 6, 5, 5, '#6b4a2a');
  },
  f2_water(c, x, y, w, h) {                                           // ウォーターサーバー
    a2shadow(c, x, y, w, h);
    a2px(c, x + 9, y + 3, w - 18, 12, 'rgba(160,215,235,.75)');       // ボトル
    c.strokeStyle = '#bfe0ec'; c.lineWidth = 1; c.strokeRect(x + 9.5, y + 3.5, w - 19, 11);
    a2px(c, x + 7, y + 15, w - 14, h - 20, '#e2e6e4');                // 本体
    a2px(c, x + 7, y + 15, w - 14, 3, '#f2f5f4');
    a2px(c, x + w / 2 - 4, y + 22, 3, 5, '#6ab0d8');                  // コック（冷・温）
    a2px(c, x + w / 2 + 2, y + 22, 3, 5, '#c96a4a');
    a2px(c, x + w / 2 - 4, y + h - 10, 9, 4, '#b8bfc2');
  },
  f2_hat(c, x, y, w, h) {                                             // サウナハット掛け
    a2shadow(c, x, y, w, h);
    a2px(c, x + 2, y + 8, w - 4, 3, '#8a6a4a');                       // 横木
    a2px(c, x + 4, y + 11, 3, h - 16, '#7a5c3a'); a2px(c, x + w - 7, y + 11, 3, h - 16, '#7a5c3a');
    for (let i = 0; i < 4; i++) {
      const cx = x + w * (.18 + i * .215);
      a2px(c, cx - 1, y + 11, 2, 4, '#c9a86a');                       // フック
      c.fillStyle = ['#e8dcc4', '#c9a86a', '#a8bcc2', '#c2a2b8'][i];
      c.beginPath(); c.ellipse(cx, y + 22, 6, 4, 0, 0, Math.PI * 2); c.fill();
      a2px(c, cx - 3.5, y + 16, 7, 6, ['#e8dcc4', '#c9a86a', '#a8bcc2', '#c2a2b8'][i]);
    }
  },
  f2_ice(c, x, y, w, h) {                                             // アイスの冷凍ケース
    a2shadow(c, x, y, w, h);
    a2px(c, x + 4, y + 6, w - 8, h - 12, '#8fb8c8');
    a2px(c, x + 6, y + 8, w - 12, h - 20, 'rgba(226,246,252,.7)');    // ガラス蓋
    c.strokeStyle = '#cfe6ee'; c.lineWidth = 1; c.strokeRect(x + 6.5, y + 8.5, w - 13, h - 21);
    for (let i = 0; i < 4; i++) a2px(c, x + 8 + (i % 2) * 9, y + 11 + ((i / 2) | 0) * 7, 7, 5, ['#f2e0b8', '#c98a6a', '#e8e2ee', '#a8c8a0'][i]);
    a2px(c, x + 5, y + h - 9, w - 10, 3, '#6a92a2');
  },
  f2_board(c, x, y, w, h) {                                           // イベント黒板
    a2shadow(c, x, y, w, h);
    a2px(c, x, y + 3, w, h - 10, '#8a6a44');
    a2px(c, x + 3, y + 6, w - 6, h - 16, '#2f3a30');
    c.fillStyle = 'rgba(240,240,225,.75)';                            // チョークの字
    for (let i = 0; i < 3; i++) c.fillRect(x + 7, y + 10 + i * 5, (w - 20) * [0.9, 0.6, 0.75][i], 2);
    a2px(c, x + w - 12, y + h - 14, 6, 2, 'rgba(240,240,225,.5)');
    a2px(c, x + 4, y + h - 7, w - 8, 3, '#6b4a2a');                   // 受け皿
    a2px(c, x + 8, y + h - 8, 5, 2, '#f2f2ea');                       // チョーク
  },
  f2_coin(c, x, y, w, h) {                                            // 貴重品ロッカー
    a2shadow(c, x, y, w, h);
    a2px(c, x, y, w, h, '#4a5560');
    for (let i = 0; i < 8; i++) for (let k = 0; k < 2; k++) {
      const dx = x + 2 + i * (w - 4) / 8, dy = y + 2 + k * (h - 4) / 2;
      a2px(c, dx, dy, (w - 4) / 8 - 1.2, (h - 4) / 2 - 1.2, '#63707c');
      a2px(c, dx + 1, dy + 1.5, 2, 2, '#c9a86a');                     // 鍵穴
    }
  },
  f2_massage(c, x, y, w, h) {                                         // マッサージ機
    a2shadow(c, x, y, w, h);
    a2px(c, x + 5, y + 8, w - 10, h - 14, '#4a3f4a');                 // 座面
    a2px(c, x + 5, y + 8, w - 10, 3, '#645668');
    a2px(c, x + 7, y + 4, w - 14, 10, '#5a4d5e');                     // 背もたれ
    a2px(c, x + 9, y + 6, w - 18, 6, '#3a323e');
    a2px(c, x + w - 13, y + h - 14, 7, 8, '#2b2530');                 // 操作盤
    a2px(c, x + w - 11, y + h - 12, 3, 2, '#e8c84a');
    a2px(c, x + 7, y + h - 6, 5, 4, '#2b2530'); a2px(c, x + w - 12, y + h - 6, 5, 4, '#2b2530');
  },

  /* ══════════ 駐車場 ══════════════════════════════════════ */

  p2_slot(c, x, y, w, h, rt, it) {                                    // 駐車マス（3x2）＝白線3組。車は1×2マス縦向き
    a2px(c, x, y, w, h, 'rgba(60,58,55,.30)');
    c.strokeStyle = 'rgba(245,245,235,.85)'; c.lineWidth = 3;
    for (let i = 0; i <= 3; i++) {                                    // 3台ぶんの区切り線
      const lx = x + 2 + i * (w - 4) / 3;
      c.beginPath(); c.moveTo(lx, y + 2); c.lineTo(lx, y + h - 2); c.stroke();
    }
    c.beginPath(); c.moveTo(x + 2, y + 2); c.lineTo(x + w - 2, y + 2); c.stroke();
    for (let i = 0; i < 3; i++) a2px(c, x + 6 + i * (w - 4) / 3, y + h - 8, (w - 4) / 3 - 8, 4, '#9a9a92');   // 車止め
    // いま停まっている車
    const idx = a2slotIndex(it, 'p2_slot'), have = a2carsNow() - idx * 3;
    for (let i = 0; i < Math.min(3, have); i++)
      a2car(c, x + 2 + (i + .5) * (w - 4) / 3, y + 4, h - 12, A2_CAR_COL[(idx * 3 + i) % A2_CAR_COL.length], false);
  },
  p2_big(c, x, y, w, h, rt, it) {                                     // 大型車スペース（3x3）＝大型3台ぶん
    a2px(c, x, y, w, h, 'rgba(60,58,55,.30)');
    c.strokeStyle = 'rgba(245,235,150,.9)'; c.lineWidth = 3;
    for (let i = 0; i <= 3; i++) {
      const lx = x + 2 + i * (w - 4) / 3;
      c.beginPath(); c.moveTo(lx, y + 2); c.lineTo(lx, y + h - 2); c.stroke();
    }
    c.beginPath(); c.moveTo(x + 2, y + 2); c.lineTo(x + w - 2, y + 2); c.stroke();
    c.fillStyle = 'rgba(245,235,150,.75)'; c.font = 'bold 11px "DotGothic16",sans-serif'; c.textAlign = 'center';
    c.fillText('大型車', x + w / 2, y + h - 6);
    const idx = a2slotIndex(it, 'p2_big'), have = a2bigCarsNow() - idx * 3;
    for (let i = 0; i < Math.min(3, have); i++)
      a2car(c, x + 2 + (i + .5) * (w - 4) / 3, y + 4, h - 16, ['#8f9aa2', '#c9c4b8', '#4a6b8a'][i % 3], true);
  },
  p2_light(c, x, y, w, h) {                                           // 外灯
    a2shadow(c, x, y, w, h);
    a2px(c, x + w / 2 - 2, y + 10, 4, h - 14, '#5f696e');             // ポール
    a2px(c, x + w / 2 - 8, y + h - 6, 16, 4, '#4a5257');              // 基礎
    a2px(c, x + w / 2 - 9, y + 5, 18, 6, '#7f8a90');                  // 笠
    a2px(c, x + w / 2 - 7, y + 11, 14, 3, 'rgba(255,240,190,.9)');    // 光る面
  },
  p2_kanban(c, x, y, w, h) {                                          // 国道沿いの看板
    a2shadow(c, x, y, w, h);
    a2px(c, x + 6, y + h - 12, 4, 12, '#5f696e'); a2px(c, x + w - 10, y + h - 12, 4, 12, '#5f696e');
    a2px(c, x + 2, y + 2, w - 4, h - 14, '#b3402e');
    a2px(c, x + 4, y + 4, w - 8, h - 18, '#d8553f');
    c.fillStyle = '#fff8ea'; c.font = 'bold 12px "DotGothic16",sans-serif'; c.textAlign = 'center';
    c.fillText('サウナ', x + w / 2, y + h / 2 - 1);
  },
  p2_ev(c, x, y, w, h) {                                              // EV充電器（1x2）
    a2shadow(c, x, y, w, h);
    a2px(c, x + 8, y + 4, w - 16, h - 12, '#3f6b4a');
    a2px(c, x + 8, y + 4, w - 16, 3, '#5a8a62');
    a2px(c, x + 11, y + 9, w - 22, 10, '#1e2a20');                    // 画面
    c.fillStyle = '#7ac96a'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center';
    c.fillText('⚡', x + w / 2, y + 18);
    c.strokeStyle = '#2b2f33'; c.lineWidth = 2;                       // ケーブル
    c.beginPath(); c.moveTo(x + w - 9, y + 24); c.bezierCurveTo(x + w - 2, y + 32, x + 4, y + 34, x + 9, y + h - 10); c.stroke();
    a2px(c, x + 6, y + h - 12, 7, 6, '#2b2f33');
  },
  p2_bicycle(c, x, y, w, h) {                                         // 駐輪場＝ラックと自転車
    a2px(c, x, y, w, h, 'rgba(60,58,55,.22)');
    for (let i = 0; i < 4; i++) {
      const cx = x + w * (.15 + i * .24);
      c.strokeStyle = '#8d9599'; c.lineWidth = 2;                     // ラック
      c.beginPath(); c.moveTo(cx, y + h - 6); c.lineTo(cx, y + 10); c.stroke();
    }
    for (let i = 0; i < 2; i++) {                                     // 自転車2台
      const cx = x + w * (.28 + i * .38);
      c.strokeStyle = ['#3a5a7a', '#7a3a3a'][i]; c.lineWidth = 1.6;
      c.beginPath(); c.arc(cx - 6, y + h - 12, 5, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(cx + 6, y + h - 12, 5, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(cx - 6, y + h - 12); c.lineTo(cx, y + h - 20); c.lineTo(cx + 6, y + h - 12); c.stroke();
    }
  },
  p2_yusetsu(c, x, y, w, h, rt) {                                     // 融雪ヒーター＝路面の熱線
    a2px(c, x, y, w, h, 'rgba(70,58,50,.35)');
    const glow = (Math.sin(rt * 2) + 1) / 2;
    c.strokeStyle = `rgba(230,120,60,${(.35 + glow * .3).toFixed(2)})`; c.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const yy = y + 6 + i * (h - 12) / 4;
      c.beginPath(); c.moveTo(x + 4, yy); c.lineTo(x + w - 4, yy); c.stroke();
    }
    a2px(c, x + w - 14, y + h - 12, 10, 8, '#5f696e');                // 制御盤
    a2px(c, x + w - 12, y + h - 10, 3, 3, '#e8c84a');
  },
  p2_camera(c, x, y, w, h) {                                          // 防犯カメラ
    a2shadow(c, x, y, w, h);
    a2px(c, x + w / 2 - 2, y + 4, 4, 8, '#5f696e');                   // 支柱
    a2px(c, x + 8, y + 11, w - 16, 8, '#d8d2c6');                     // 本体
    a2px(c, x + 8, y + 11, w - 16, 3, '#eeeae2');
    a2px(c, x + 6, y + 13, 4, 5, '#2b2f33');                          // レンズ
    a2px(c, x + w - 12, y + 12, 3, 3, '#e85a5a');                     // 赤ランプ
  },
  p2_nobori(c, x, y, w, h, rt) {                                      // 幟（のぼり）＝風になびく
    a2shadow(c, x, y, w, h);
    a2px(c, x + 7, y + 2, 2, h - 6, '#8a7a5a');                       // 竿
    a2px(c, x + 4, y + h - 6, 9, 4, '#5f696e');                       // 台座
    const sway = Math.sin(rt * 2.2) * 2;
    c.fillStyle = '#c94a3a';
    c.beginPath();
    c.moveTo(x + 9, y + 4); c.lineTo(x + w - 4 + sway, y + 6 + sway);
    c.lineTo(x + w - 4 + sway, y + h - 12 + sway); c.lineTo(x + 9, y + h - 10); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,248,234,.9)';
    c.fillRect(x + 12, y + 8, 2, 12);
  },
  p2_gate(c, x, y, w, h) {                                            // 入口ゲート看板（3x1）
    a2shadow(c, x, y, w, h);
    a2px(c, x + 4, y + 6, 5, h - 10, '#5f696e'); a2px(c, x + w - 9, y + 6, 5, h - 10, '#5f696e');
    a2px(c, x + 2, y + 2, w - 4, 13, '#3a2f28');
    a2px(c, x + 4, y + 4, w - 8, 9, '#4e4038');
    c.fillStyle = '#ffd98a'; c.font = 'bold 11px "DotGothic16",sans-serif'; c.textAlign = 'center';
    c.fillText('ようこそ', x + w / 2, y + 12);
  },
  p2_bike(c, x, y, w, h) {                                            // バイク置き場
    a2px(c, x, y, w, h, 'rgba(60,58,55,.22)');
    c.strokeStyle = 'rgba(245,245,235,.6)'; c.lineWidth = 2;
    c.strokeRect(x + 3, y + 3, w - 6, h - 6);
    const cx = x + w * .5, cy = y + h * .55;
    c.strokeStyle = '#2b2f33'; c.lineWidth = 3;                       // バイク
    c.beginPath(); c.arc(cx - 11, cy, 6, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(cx + 11, cy, 6, 0, Math.PI * 2); c.stroke();
    a2px(c, cx - 10, cy - 10, 20, 6, '#3a5a7a');
    a2px(c, cx + 2, cy - 14, 9, 5, '#4a6b8a');
  },
  p2_tree(c, x, y, w, h, rt) {                                        // 植栽
    a2shadow(c, x, y, w, h);
    a2px(c, x + w / 2 - 3, y + h - 14, 6, 12, '#6b4a2a');             // 幹
    const sw = Math.sin(rt * 1.1) * 1.2;
    for (const [dx, dy, r, col] of [[-6, -4, 9, '#3f6b3a'], [6, -3, 9, '#4a7a44'], [0, -11, 10, '#568a4e']]) {
      c.fillStyle = col;
      c.beginPath(); c.arc(x + w / 2 + dx + sw, y + h - 16 + dy, r, 0, Math.PI * 2); c.fill();
    }
    a2px(c, x + w / 2 - 9, y + h - 4, 18, 4, '#5f5348');              // 植え込みの縁
  },
  p2_smoke(c, x, y, w, h, rt) {                                       // 喫煙所
    a2px(c, x, y, w, h, 'rgba(60,58,55,.25)');
    a2px(c, x + 3, y + 4, w - 6, 3, '#7f8a90');                       // 屋根
    a2px(c, x + 5, y + 7, 3, h - 13, '#5f696e'); a2px(c, x + w - 8, y + 7, 3, h - 13, '#5f696e');
    a2px(c, x + w / 2 - 5, y + h - 18, 10, 14, '#4a5257');            // 灰皿
    a2px(c, x + w / 2 - 6, y + h - 20, 12, 3, '#6a747a');
    a2steam(c, x + w / 2, y + h - 22, rt, 2, 'rgba(210,210,205,.35)');
  },

  /* ══════════ 休憩スペース ══════════════════════════════ */

  x2_bench(c, x, y, w, h) {                                           // 長椅子
    a2shadow(c, x, y, w, h);
    a2px(c, x + 2, y + 6, w - 4, 5, '#8a6a4a');                       // 背
    a2px(c, x + 2, y + h * .45, w - 4, 8, '#a5825a');
    a2px(c, x + 2, y + h * .45, w - 4, 3, '#c2966a');
    a2px(c, x + 5, y + h - 8, 4, 6, '#6b4a2a'); a2px(c, x + w - 9, y + h - 8, 4, 6, '#6b4a2a');
  },
  x2_goro(c, x, y, w, h) {                                            // ごろ寝マット
    a2shadow(c, x, y, w, h);
    a2px(c, x + 2, y + 8, w - 4, h - 16, '#4a6b6a');
    a2px(c, x + 2, y + 8, w - 4, 3, '#5f8482');
    c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1;
    for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x + 2 + i * (w - 4) / 4, y + 9); c.lineTo(x + 2 + i * (w - 4) / 4, y + h - 9); c.stroke(); }
    a2px(c, x + 5, y + 10, 12, 7, '#e8e2d8');                         // 枕
  },
  /* 仮眠リクライナー（1x2・縦向き）＝スパの「テレビ付きリクライニングシート」。
     オレンジの本体に灰色のクッション、頭の脇に一人ぶんの液晶（写真より）      */
  /* 仮眠リクライナー（1x2・縦向き）＝作者が指定した写真の椅子をそのまま。
     黒革のシェルが左右から body を包み、内側だけグレーの布。
     頭のところに丸い枕がひとつ、足元にフットレストが伸びる。
     **テレビは付けない**（作者指定）＝椅子そのものを見せる                  */
  x2_nap(c, x, y, w, h) {
    a2shadow(c, x, y, w, h);
    a2px(c, x + 2, y + 3, w - 4, h - 6, '#232429');                   // 黒革のシェル（外側）
    a2px(c, x + 2, y + 3, w - 4, 3, '#3c3e45');                       // 上面の照り
    a2px(c, x + 2, y + h - 6, w - 4, 3, '#15161a');                   // 足もとの影
    /* 黒革が左右から包み込む＝内側の布はうんと細くする。
       ここを広く取ると、ただの灰色の板に見えて椅子だと分からなかった  */
    a2px(c, x + 8, y + h * .17, w - 16, h * .30, '#575d69');          // 背もたれ（グレーの布）
    a2px(c, x + 8, y + h * .17, w - 16, 2, '#6e7583');
    // 頭の枕（写真の丸いクッション）。背もたれより一段明るく、はっきり出す
    c.fillStyle = '#9aa1ad';
    c.beginPath();
    if (c.roundRect) c.roundRect(x + w * .20, y + h * .065, w * .60, h * .085, h * .042);
    else c.rect(x + w * .20, y + h * .065, w * .60, h * .085);
    c.fill();
    a2px(c, x + w * .24, y + h * .08, w * .52, 1.5, '#b5bcc6');       // 枕の照り
    a2px(c, x + 8, y + h * .51, w - 16, h * .24, '#4f5460');          // 座面
    a2px(c, x + 8, y + h * .51, w - 16, 2, '#646a77');
    c.strokeStyle = 'rgba(0,0,0,.38)'; c.lineWidth = 1;               // 革の縫い目（背と座）
    c.beginPath();
    c.moveTo(x + w / 2 + .5, y + h * .19); c.lineTo(x + w / 2 + .5, y + h * .45);
    c.moveTo(x + w / 2 + .5, y + h * .53); c.lineTo(x + w / 2 + .5, y + h * .73);
    c.stroke();
    a2px(c, x + 7, y + h * .79, w - 14, h * .13, '#1c1d21');          // フットレスト（黒革）
    a2px(c, x + 7, y + h * .79, w - 14, 2, '#34363c');
  },
  /* ビーズクッション（1x1）＝ヨギボー系の一人がけ。角の丸い塊に、沈んだくぼみ。
     **影は付けない**（作者指定）＝床に置いてぺたんと潰れているものなので、
     浮いて見える影があると座布団というより箱に見える                          */
  x2_beads(c, x, y, w, h) {
    c.fillStyle = '#7a6f9a';
    c.beginPath();
    if (c.roundRect) c.roundRect(x + 3, y + 4, w - 6, h - 8, Math.min(w, h) * .34);
    else c.rect(x + 3, y + 4, w - 6, h - 8);
    c.fill();
    a2px(c, x + 6, y + 6, w - 12, 3, '#9084ad');                      // 上の照り
    c.fillStyle = 'rgba(50,44,70,.34)';                               // 人が沈んだくぼみ
    c.beginPath(); c.ellipse(x + w / 2, y + h * .60, w * .24, h * .15, 0, 0, Math.PI * 2); c.fill();
    a2px(c, x + 5, y + h - 6, w - 10, 2, 'rgba(0,0,0,.20)');
  },
  /* ロングソファ（3x1）＝背もたれ付きの長いソファ。クッションが3つ並ぶ */
  x2_sofa2(c, x, y, w, h) {
    a2shadow(c, x, y, w, h);
    a2px(c, x + 2, y + 5, w - 4, 8, '#8d99a6');                       // 背もたれ
    a2px(c, x + 2, y + 5, w - 4, 3, '#a4b0bc');
    a2px(c, x + 2, y + 12, w - 4, h - 20, '#9aa6b3');                 // 座面
    c.strokeStyle = 'rgba(60,70,80,.30)'; c.lineWidth = 1;            // クッションの切れ目
    for (let i = 1; i < 3; i++) {
      const gx2 = x + 2 + i * (w - 4) / 3;
      c.beginPath(); c.moveTo(gx2, y + 13); c.lineTo(gx2, y + h - 9); c.stroke();
    }
    a2px(c, x + 4, y + h - 7, 4, 5, '#8a6a4a');                       // 木の脚
    a2px(c, x + w - 8, y + h - 7, 4, 5, '#8a6a4a');
  },
  x2_work(c, x, y, w, h) {                                            // ワークスペース
    a2shadow(c, x, y, w, h);
    a2wood(c, x + 2, y + 8, w - 4, h - 18, '#8a6a4a');
    a2px(c, x + w * .18, y + 4, 16, 11, '#3a3f44');                   // ノートPC
    a2px(c, x + w * .18 + 1, y + 5, 14, 9, '#6ab0d8');
    a2px(c, x + w * .16, y + 14, 20, 3, '#5a6167');
    a2px(c, x + w * .68, y + 10, 6, 8, '#c9a86a');                    // カップ
    a2px(c, x + 5, y + h - 8, 4, 6, '#6b4a2a'); a2px(c, x + w - 9, y + h - 8, 4, 6, '#6b4a2a');
  },
  x2_yomi(c, x, y, w, h) {                                            // 静かな読書灯コーナー
    a2shadow(c, x, y, w, h);
    a2px(c, x + 2, y + 12, w - 4, h - 20, '#5a4a5a');                 // 椅子
    a2px(c, x + 2, y + 12, w - 4, 3, '#75627a');
    a2px(c, x + w - 12, y + 4, 3, 12, '#5f696e');                     // スタンド
    a2px(c, x + w - 17, y + 2, 13, 4, '#c9a86a');
    c.fillStyle = 'rgba(255,236,170,.28)';                            // 灯りの落ちる範囲
    c.beginPath(); c.moveTo(x + w - 17, y + 6); c.lineTo(x + w - 4, y + 6); c.lineTo(x + w + 2, y + h - 6); c.lineTo(x + w - 24, y + h - 6); c.closePath(); c.fill();
    a2px(c, x + 8, y + 18, 12, 8, '#c2a2b8');                         // 本
  },
  x2_massage(c, x, y, w, h) { ART2.f2_massage(c, x, y, w, h); },
  r2_cooler(c, x, y, w, h)  { ART2.f2_water(c, x, y, w, h); },
  /* 〈給水機〉〈ボディケア台〉〈熟睡まくら＆マット〉〈コインランドリー〉
     〈リクライニングチェア〉は廃止した（作者指定）。絵も一緒に消してある＝
     戻したくなったら git の履歴から引っぱってくる                          */
  x2_hammock2(c, x, y, w, h, rt) {                                    // 室内ハンモック
    a2shadow(c, x, y, w, h);
    a2px(c, x + 3, y + 6, 4, h - 12, '#8a7a5a'); a2px(c, x + w - 7, y + 6, 4, h - 12, '#8a7a5a');
    const sag = 5 + Math.sin(rt * 1.3) * 1.5;
    c.strokeStyle = '#c2a274'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(x + 6, y + h * .38);
    c.quadraticCurveTo(x + w / 2, y + h * .38 + sag * 2, x + w - 6, y + h * .38); c.stroke();
    c.strokeStyle = '#d8bd92'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x + 6, y + h * .38 - 2);
    c.quadraticCurveTo(x + w / 2, y + h * .38 + sag * 2 - 2, x + w - 6, y + h * .38 - 2); c.stroke();
  },
  r2_hammock(c, x, y, w, h, rt) { ART2.x2_hammock2(c, x, y, w, h, rt); },
  x2_tatami(c, x, y, w, h) {                                          // 畳の小上がり
    a2shadow(c, x, y, w, h);
    a2px(c, x, y + 3, w, h - 6, '#c2c08a');
    c.strokeStyle = 'rgba(120,120,80,.32)'; c.lineWidth = 1;
    for (let i = 1; i < 3; i++) { c.beginPath(); c.moveTo(x + i * w / 3, y + 3); c.lineTo(x + i * w / 3, y + h - 3); c.stroke(); }
    a2px(c, x, y + 3, w, 3, '#3b3a2a'); a2px(c, x, y + h - 6, w, 3, '#3b3a2a');
    a2px(c, x, y, w, 3, '#8a6a4a');                                   // 上がり框
    a2px(c, x + w * .12, y + h * .42, 14, 12, '#8a4a5a');             // 座布団
    a2px(c, x + w * .66, y + h * .46, 14, 12, '#4a6b6a');
  },
  /* マンガ棚（2x2）＝天井まである本棚。4段びっしり、背表紙の高さも不揃い。
     雑誌の棚（2x1・2段）と並べたとき、ひと目で「こっちは量が違う」と分かるようにする */
  x2_manga2(c, x, y, w, h) {
    a2shadow(c, x, y, w, h);
    a2px(c, x, y + 2, w, h - 6, '#5a4130');                           // 棚の枠
    a2px(c, x, y + 2, w, 3, '#75563f');
    const rows = 4, rh = (h - 12) / rows;
    const col = ['#c94a3a', '#4a6b8a', '#e8c84a', '#4a7a44', '#8a4a6a', '#d1743a', '#3f5f6b'];
    for (let k = 0; k < rows; k++) {
      const ry = y + 5 + k * rh;
      a2px(c, x + 2, ry, w - 4, rh - 2, '#3e2f24');                   // 段の奥
      const n = 11;
      for (let i = 0; i < n; i++) {
        const bw = (w - 8) / n - 0.6;
        const tall = ((i + k) % 3 === 0) ? 1 : 0;                     // 背の高さを不揃いに
        a2px(c, x + 4 + i * (w - 8) / n, ry + 1 + tall, bw, rh - 4 - tall,
             col[(i * 3 + k) % col.length]);
      }
      a2px(c, x + 2, ry + rh - 2, w - 4, 2, '#6b5241');               // 棚板
    }
  },
  x2_manga(c, x, y, w, h) {                                           // サウナ雑誌の棚
    a2shadow(c, x, y, w, h);
    a2px(c, x, y + 2, w, h - 6, '#6b5241');
    for (let k = 0; k < 2; k++) {
      a2px(c, x + 2, y + 5 + k * (h - 12) / 2, w - 4, (h - 12) / 2 - 2, '#4e3c2e');
      for (let i = 0; i < 9; i++)
        a2px(c, x + 4 + i * (w - 8) / 9, y + 6 + k * (h - 12) / 2, (w - 8) / 9 - 1, (h - 12) / 2 - 4,
             ['#c94a3a', '#4a6b8a', '#e8c84a', '#4a7a44', '#8a4a6a'][i % 5]);
    }
  },
  x2_tv(c, x, y, w, h) {                                              // 静かなテレビ（字幕）
    a2shadow(c, x, y, w, h);
    a2px(c, x + 3, y + 4, w - 6, h - 14, '#2b2f33');
    a2px(c, x + 6, y + 7, w - 12, h - 22, '#3a5a6b');
    a2px(c, x + 8, y + h - 19, w - 16, 4, 'rgba(255,255,255,.75)');   // 字幕の帯
    a2px(c, x + w / 2 - 8, y + h - 9, 16, 3, '#4a5257');              // スタンド
    a2px(c, x + w / 2 - 12, y + h - 6, 24, 3, '#3a4045');
  },
  x2_aroma(c, x, y, w, h, rt) {                                       // アロマディフューザー
    a2shadow(c, x, y, w, h);
    c.fillStyle = '#d8cdbc';
    c.beginPath(); c.ellipse(x + w / 2, y + h - 12, 8, 9, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#eee4d4';
    c.beginPath(); c.ellipse(x + w / 2, y + h - 15, 6, 4, 0, 0, Math.PI * 2); c.fill();
    a2px(c, x + w / 2 - 4, y + h - 8, 8, 2, 'rgba(150,200,190,.6)');
    a2steam(c, x + w / 2, y + h - 18, rt, 3, 'rgba(200,230,220,.4)');
  },
  r2_aroma(c, x, y, w, h, rt) {                                       // アロマミストシャワー
    a2shadow(c, x, y, w, h);
    a2px(c, x + w / 2 - 6, y + 3, 12, 5, '#a8bcc2');
    a2px(c, x + w / 2 - 2, y + 8, 4, 5, '#8d9599');
    for (let i = 0; i < 5; i++) {
      const t = (rt * .9 + i * .2) % 1;
      c.fillStyle = `rgba(200,235,230,${((1 - t) * .5).toFixed(2)})`;
      c.beginPath(); c.arc(x + w / 2 + Math.sin(i * 2 + rt) * (4 + t * 8), y + 13 + t * (h - 20), 2, 0, Math.PI * 2); c.fill();
    }
  },
  x2_plant(c, x, y, w, h, rt) {                                       // 大きな観葉植物
    a2shadow(c, x, y, w, h);
    a2px(c, x + w / 2 - 8, y + h - 14, 16, 12, '#8a6a4a');            // 鉢
    a2px(c, x + w / 2 - 9, y + h - 15, 18, 3, '#a5825a');
    const sw = Math.sin(rt * 1.2) * 1.5;
    c.strokeStyle = '#3f6b3a'; c.lineWidth = 3;
    for (const a of [-1, -.4, .3, 1]) {
      c.beginPath(); c.moveTo(x + w / 2, y + h - 14);
      c.quadraticCurveTo(x + w / 2 + a * 10 + sw, y + h - 26, x + w / 2 + a * 13 + sw, y + 5); c.stroke();
    }
    c.fillStyle = '#4a7a44';
    for (const a of [-1, -.4, .3, 1]) { c.beginPath(); c.ellipse(x + w / 2 + a * 13 + sw, y + 6, 5, 3.5, a, 0, Math.PI * 2); c.fill(); }
  },
  x2_locker2(c, x, y, w, h) {                                         // 充電ステーション
    a2shadow(c, x, y, w, h);
    a2px(c, x + 5, y + 6, w - 10, h - 12, '#3f4c58');
    a2px(c, x + 5, y + 6, w - 10, 3, '#5d6b78');
    for (let i = 0; i < 3; i++) {
      a2px(c, x + 8, y + 11 + i * 6, w - 16, 4, '#63707c');
      a2px(c, x + w - 13, y + 12 + i * 6, 3, 2, '#7ac96a');
    }
  },

  /* ══════════ 外気浴・残置物 ══════════════════════════════ */

  r2_gaiki(c, x, y, w, h) {                                           // 外気浴デッキ＝ウッドデッキとととのいイス
    a2shadow(c, x, y, w, h);
    a2px(c, x, y, w, h - 3, '#a5825a');
    c.strokeStyle = 'rgba(90,60,30,.30)'; c.lineWidth = 1;
    for (let i = 1; i * 8 < h; i++) { c.beginPath(); c.moveTo(x, y + i * 8); c.lineTo(x + w, y + i * 8); c.stroke(); }
    for (let i = 0; i < 2; i++) {                                     // ととのいイス
      const cx = x + w * (i ? .70 : .30);
      a2px(c, cx - 9, y + h * .30, 18, 6, '#e8e2d8');                 // 背
      a2px(c, cx - 9, y + h * .30, 18, 2, '#fff8ea');
      a2px(c, cx - 9, y + h * .52, 18, 10, '#dcd6cc');                // 座
      a2px(c, cx - 7, y + h - 9, 3, 6, '#8d9599'); a2px(c, cx + 4, y + h - 9, 3, 6, '#8d9599');
    }
  },
  z2_ganban(c, x, y, w, h, rt) {                                      // 岩盤浴の石床（3x3）
    a2shadow(c, x, y, w, h);
    a2px(c, x, y, w, h, '#8a8278');
    for (let i = 0; i < 5; i++) for (let k = 0; k < 5; k++) {
      const dx = x + 2 + i * (w - 4) / 5, dy = y + 2 + k * (h - 4) / 5;
      a2px(c, dx, dy, (w - 4) / 5 - 1.5, (h - 4) / 5 - 1.5, ((i + k) % 2) ? '#9a9188' : '#8f867c');
    }
    c.fillStyle = 'rgba(230,140,80,.14)'; c.fillRect(x + 2, y + 2, w - 4, h - 4);   // ほのかな熱
    a2steam(c, x + w * .3, y + h * .35, rt, 2, 'rgba(240,230,220,.25)');
    a2steam(c, x + w * .7, y + h * .6, rt + 1.1, 2, 'rgba(240,230,220,.25)');
  },
  z2_stage(c, x, y, w, h) {                                           // 大衆演劇のステージ（4x2）
    a2shadow(c, x, y, w, h);
    a2px(c, x, y + 6, w, h - 9, '#8a6a44');                           // 舞台の板
    c.strokeStyle = 'rgba(70,45,20,.35)'; c.lineWidth = 1;
    for (let i = 1; i < 8; i++) { c.beginPath(); c.moveTo(x + i * w / 8, y + 6); c.lineTo(x + i * w / 8, y + h - 3); c.stroke(); }
    a2px(c, x, y, w, 7, '#7a2f2a');                                   // 緞帳
    for (let i = 0; i < 10; i++) a2px(c, x + i * w / 10, y, 2, 7, '#93413a');
    a2px(c, x, y + h - 4, w, 4, '#5c4432');                           // 前板
  },
  z2_enkai(c, x, y, w, h) {                                           // 大広間・宴会場（4x3）
    a2shadow(c, x, y, w, h);
    a2px(c, x, y, w, h - 3, '#b8b684');
    c.strokeStyle = 'rgba(110,110,70,.35)'; c.lineWidth = 1;
    for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x + i * w / 4, y); c.lineTo(x + i * w / 4, y + h - 3); c.stroke(); }
    for (let k = 1; k < 3; k++) { c.beginPath(); c.moveTo(x, y + k * (h - 3) / 3); c.lineTo(x + w, y + k * (h - 3) / 3); c.stroke(); }
    for (let i = 0; i < 2; i++) for (let k = 0; k < 2; k++)            // 座卓が4つ
      a2wood(c, x + w * (.10 + i * .46), y + h * (.14 + k * .44), w * .34, h * .22, '#8a5a3a', '#a5714a');
    a2px(c, x, y, w, 3, '#4a3a28');
  },
  z2_game(c, x, y, w, h) {                                            // ゲームコーナーの跡（2x2）
    a2shadow(c, x, y, w, h);
    a2px(c, x, y, w, h, '#6b6258');                                   // 焼けた床
    c.fillStyle = 'rgba(40,32,26,.35)';
    c.beginPath(); c.ellipse(x + w * .35, y + h * .45, w * .22, h * .18, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(x + w * .70, y + h * .62, w * .16, h * .13, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#3a3f44'; c.lineWidth = 2;                       // 残された配線
    c.beginPath(); c.moveTo(x + 5, y + h - 8); c.bezierCurveTo(x + w * .4, y + h - 2, x + w * .5, y + 8, x + w - 6, y + 12); c.stroke();
    a2px(c, x + w - 12, y + 9, 8, 6, '#2b2f33');                      // コンセント
    a2px(c, x + w - 10, y + 11, 2, 2, '#c9a86a');
  },
};

/* game.js の drawEquipArt から呼ばれる。
   絵を持っている id なら描いて true、無ければ false（＝共通の札に落ちる） */
function equipArt2(c2, it, def, x, y, w, h, rt, broken) {
  const fn = ART2[it.id];
  if (!fn) return false;
  c2.save();
  fn(c2, x, y, w, h, rt || 0, it, broken);
  c2.restore();
  return true;
}

registerChapter2Hooks({ equipArt: equipArt2 });
