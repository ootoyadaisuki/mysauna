'use strict';
/* ストーリー再生（一枚絵 + タイプライター文字送り） */

const StoryArt = {
  // 360x200 のドット風一枚絵をコードで描く
  draw(ctx, key) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 360, 200);
    (this[key] || this.gate).call(this, ctx);
    ctx.restore();
  },

  px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); },

  office(ctx) {
    const p = this.px.bind(this, ctx);
    p(0, 0, 360, 200, '#141826');                      // 暗い室内
    // 窓と夜景
    p(30, 20, 130, 90, '#0a0e1c'); p(200, 20, 130, 90, '#0a0e1c');
    ctx.strokeStyle = '#2a3350'; ctx.lineWidth = 3;
    ctx.strokeRect(30, 20, 130, 90); ctx.strokeRect(200, 20, 130, 90);
    for (let i = 0; i < 26; i++) {
      p(38 + Math.floor(Math.random() * 280), 30 + Math.floor(Math.random() * 70), 3, 3,
        Math.random() < .5 ? '#ffd98a' : '#5a6a9a');
    }
    // デスクとPC
    p(0, 130, 360, 70, '#3a3040');
    p(90, 96, 180, 40, '#2a2432');                     // 机
    p(150, 70, 60, 40, '#111'); p(154, 74, 52, 30, '#9fd8ff'); // モニタ
    p(175, 110, 10, 8, '#111');
    // 蛍光灯
    p(120, 6, 120, 8, '#e8f4ff');
    // 主人公(うつむき)
    p(230, 92, 26, 40, '#4a5568'); p(233, 76, 20, 18, '#f2c9a0'); p(233, 72, 20, 8, '#3a3a3a');
  },

  phone(ctx) {
    const p = this.px.bind(this, ctx);
    p(0, 0, 360, 200, '#10131f');
    // 震えるスマホ
    const t = Date.now() / 90, dx = Math.round(Math.sin(t) * 4);
    p(140 + dx, 40, 80, 130, '#222'); p(146 + dx, 50, 68, 100, '#9fd8ff');
    ctx.fillStyle = '#10131f'; ctx.font = '16px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('着信中…', 180 + dx, 90); ctx.fillText('実家', 180 + dx, 115);
    // 波紋
    ctx.strokeStyle = '#ffd98a'; ctx.lineWidth = 2;
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath(); ctx.arc(180, 105, 60 + i * 16 + (t * 3 % 16), 0, Math.PI * 2); ctx.stroke();
    }
  },

  // 病室の共通部分（鍵の有無だけを呼び出し側で分ける）
  /* フェーズ3：夜の居間のテレビ。蒼天SPAのオープン特集が流れている */
  tvnews(ctx) {
    const p = this.px.bind(this, ctx);
    p(0, 0, 360, 200, '#241d18');                     // 夜の居間
    p(0, 160, 360, 40, '#3a2f26');                    // 畳
    p(60, 150, 240, 12, '#1a1512');                   // テレビ台
    p(70, 30, 220, 122, '#111');                      // テレビ枠
    p(78, 38, 204, 100, '#8fd0ee');                   // 画面（空）
    p(120, 58, 120, 80, '#3a7bd5');                   // 青いガラスの巨大施設
    p(126, 64, 108, 62, '#bfe3f2');
    for (let i = 0; i < 5; i++) p(130 + i * 21, 68, 14, 52, '#7fb8e8');
    p(150, 44, 60, 12, '#2a5aa8');                    // 屋上のサイン
    p(78, 118, 204, 20, 'rgba(20,30,60,.9)');         // 下部テロップ
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('駅前に「蒼天SPA」グランドオープン！', 180, 132);
    p(140, 168, 80, 8, '#5a4632');                    // ちゃぶ台
    p(172, 161, 10, 7, '#cfd8d4');                    // 湯呑み
  },
  hospitalRoom(ctx) {
    const p = this.px.bind(this, ctx);
    p(0, 0, 360, 200, '#dfe8ea');                      // 白い病室
    p(0, 150, 360, 50, '#b8c4c8');
    p(240, 30, 90, 110, '#eef6f8'); ctx.strokeStyle = '#9ab2b8'; ctx.strokeRect(240, 30, 90, 110); // 窓
    p(250, 40, 70, 60, '#bfe3f2');
    // ベッド
    p(40, 110, 180, 50, '#f8f8f8'); p(40, 150, 180, 20, '#8a9aa0');
    p(46, 90, 40, 30, '#f8f8f8');                      // 枕
    // 親父
    p(70, 96, 120, 26, '#c9d8dd');                     // 布団
    p(52, 92, 22, 20, '#e8b890'); p(52, 88, 22, 7, '#cfcfcf'); // 顔と白髪
    p(56, 100, 4, 3, '#333'); p(66, 100, 4, 3, '#333');
    // 点滴
    p(230, 60, 4, 90, '#8a9aa0'); p(224, 52, 16, 22, '#cfe8f2');
  },
  // 最初の見舞いだけ（鍵あり）
  hospital(ctx) {
    this.hospitalRoom(ctx);
    ctx.fillStyle = '#c9a86a';
    this.px(ctx, 150, 60, 26, 8, '#c9a86a'); ctx.beginPath(); ctx.arc(150, 64, 9, 0, Math.PI * 2); ctx.fill();
  },
  // 2回目以降の見舞い・ゲームオーバー（鍵なし）
  hospitalPlain(ctx) {
    this.hospitalRoom(ctx);
  },
  // 墓。治療費が払えず親父が亡くなった後（ゲームオーバー後半）だけに使う、静かで曇った一枚絵
  grave(ctx) {
    const p = this.px.bind(this, ctx);
    // 曇った空
    const g = ctx.createLinearGradient(0, 0, 0, 110);
    g.addColorStop(0, '#565c66'); g.addColorStop(1, '#889097');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 360, 110);
    // 地面（墓地の土と敷石）
    p(0, 110, 360, 90, '#4a5240');
    p(0, 110, 360, 5, '#3d4436');
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    for (let i = 0; i < 30; i++) p((i * 53) % 360, 118 + (i * 29) % 78, 3, 3, 'rgba(0,0,0,.12)');
    // 墓石
    p(148, 108, 8, 46, '#5c5c5c');                       // 台座の縁
    p(150, 44, 60, 68, '#6f6f6f');                        // 石本体
    p(150, 44, 60, 6, '#7c7c7c');                          // 天面のハイライト
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1; ctx.strokeRect(150, 44, 60, 68);
    ctx.fillStyle = '#3a3a3a'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('家', 180, 68); ctx.fillText('之墓', 180, 86);
    // 花（左右に一対）
    for (const fx of [136, 216]) {
      p(fx, 118, 4, 20, '#3f6a34');
      ctx.fillStyle = '#e8a8bc';
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(fx + 2 + Math.sin(i) * 3, 116 - i * 5, 3, 0, Math.PI * 2); ctx.fill(); }
    }
    // 線香の煙（細く立ちのぼる）
    const t = Date.now() / 1000;
    for (let i = 0; i < 2; i++) {
      const bx = 160 + i * 40, rise = (t * 6 + i * 5) % 30;
      ctx.fillStyle = `rgba(230,230,230,${(0.3 * (1 - rise / 30)).toFixed(2)})`;
      p(bx, 112 - rise, 2, 5, ctx.fillStyle);
    }
    // 主人公（後ろ姿・佇む）
    const hx = 250;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(hx + 9, 158, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
    p(hx, 118, 20, 40, '#3a4556');                        // 体
    p(hx + 2, 158, 7, 16, '#2f3846'); p(hx + 11, 158, 7, 16, '#2f3846'); // 脚
    p(hx + 3, 102, 15, 16, '#2c2723');                    // 後頭部
  },

  gate(ctx) {
    const p = this.px.bind(this, ctx);
    // 夕焼け空
    const g = ctx.createLinearGradient(0, 0, 0, 120);
    g.addColorStop(0, '#2a3a6a'); g.addColorStop(.55, '#c96a3a'); g.addColorStop(1, '#ffb37a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 360, 120);
    p(300, 26, 18, 18, '#ffe8c0');                     // 夕日
    p(0, 120, 360, 80, '#3a3028');                     // 道
    // 銭湯の建物
    p(60, 60, 240, 80, '#6b5040');
    p(50, 44, 260, 22, '#4a3528');                     // 屋根
    p(70, 20, 20, 30, '#5a4436');                      // 煙突
    for (let i = 0; i < 3; i++) p(74 + i * 3, 8 - i * 4, 8, 6, 'rgba(240,240,240,.5)');
    // のれん
    p(140, 84, 80, 30, '#3a5a8a');
    p(140, 84, 80, 4, '#2a4a70');
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('ゆ', 180, 106);
    p(120, 84, 14, 56, '#2a2018'); p(226, 84, 14, 56, '#2a2018'); // 戸
    // 主人公の後ろ姿
    p(172, 128, 18, 34, '#4a5568'); p(174, 114, 14, 14, '#3a3a3a');
  },

  revival(ctx) {
    const p = this.px.bind(this, ctx);
    // 明けやかな朝空（グラデ）
    const g = ctx.createLinearGradient(0, 0, 0, 130);
    g.addColorStop(0, '#9ec8f0'); g.addColorStop(.5, '#cfe6f5'); g.addColorStop(1, '#ffe9c8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 360, 130);
    // 朝日と光条
    p(300, 22, 20, 20, '#fff2cf');
    ctx.fillStyle = 'rgba(255,240,190,.5)'; ctx.beginPath(); ctx.arc(310, 32, 26, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,236,180,.45)'; ctx.lineWidth = 2;
    for (let a = 0; a < 8; a++) { const r = a * Math.PI / 4; ctx.beginPath(); ctx.moveTo(310, 32); ctx.lineTo(310 + Math.cos(r) * 60, 32 + Math.sin(r) * 60); ctx.stroke(); }
    // 道
    p(0, 130, 360, 70, '#5a4a38');
    p(0, 130, 360, 6, '#6b5a44');
    // 銭湯（明るく塗り直された壁）
    p(60, 66, 240, 74, '#8a6a50');
    p(50, 50, 260, 20, '#5a3f2c');                     // 屋根
    p(70, 26, 20, 28, '#6a5040');                      // 煙突（湯を沸かす煙）
    for (let i = 0; i < 4; i++) p(74 + i * 2, 14 - i * 5, 9, 7, 'rgba(255,255,255,.6)');
    // ネイビーの暖簾（男湯）
    p(140, 88, 80, 30, '#1f3a6b');
    p(140, 88, 80, 4, '#16294d');
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('ゆ', 180, 110);
    p(120, 88, 14, 52, '#2a2018'); p(226, 88, 14, 52, '#2a2018');   // 戸
    // 親父（白髪・桶を持って・正面）
    p(150, 120, 22, 40, '#6a6f78'); p(153, 104, 16, 16, '#e8b890'); p(153, 100, 16, 7, '#e6e6e6'); // 体・顔・白髪
    p(157, 110, 3, 2, '#333'); p(164, 110, 3, 2, '#333');
    p(140, 138, 12, 8, '#c9a86a');                     // 桶
    // 主人公（隣に並ぶ・黒髪）
    p(190, 122, 20, 38, '#3a4556'); p(193, 106, 15, 16, '#f2c9a0'); p(193, 102, 15, 7, '#2c2723');
    p(197, 112, 3, 2, '#333'); p(203, 112, 3, 2, '#333');
  },

  // 蒼天SPA：作者提示のRPGマップ風・重厚な大浴場（俯瞰）。石枠のテーマ別サウナ5室＋滝／多彩な湯（青・桃・紫電気・翡翠ジェット・白湯・薬草）／
  // 寝湯／水風呂3種（浅・深・氷）／岩の露天／ランタン・緑・寝椅子。湯気・水面・泡はアニメ。主人公はちいさく立たせて規模を対比。番号・ラベルなし。
  /* 蒼天SPAの外観。駅前で見上げる巨大なガラスの塔（下すぼまり＝見上げアングル）。
     手前に主人公の後ろ姿を小さく置いて、スケールの差を出す */
  soutenBldg(ctx) {
    const p = this.px.bind(this, ctx);
    const t = Date.now() / 1000;
    // 空（上ほど濃い＝見上げている）
    const g = ctx.createLinearGradient(0, 0, 0, 200);
    g.addColorStop(0, '#2c68ad'); g.addColorStop(.55, '#7db2dc'); g.addColorStop(1, '#d3e4f1');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 360, 200);
    // 雲（ゆっくり流れる）
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 97 + t * 5) % 420) - 30, cy = 16 + (i % 2) * 22;
      ctx.fillRect(cx, cy, 34, 6); ctx.fillRect(cx + 8, cy - 4, 20, 5);
    }
    // 隣の雑居ビル（低く・くすんだ色＝対比）
    p(0, 118, 48, 82, '#5f6b78'); p(0, 114, 48, 5, '#4a5560');
    for (let r = 0; r < 5; r++) for (let c = 0; c < 2; c++) p(8 + c * 20, 126 + r * 14, 12, 9, '#8f9aa6');
    p(312, 108, 48, 92, '#5f6b78'); p(312, 104, 48, 5, '#4a5560');
    for (let r = 0; r < 6; r++) for (let c = 0; c < 2; c++) p(320 + c * 20, 116 + r * 14, 12, 9, '#8f9aa6');
    // 本体：ガラスの塔（台形＝上が広い＝見上げ）
    const topY = 6, botY = 188, lT = 76, rT = 284, lB = 100, rB = 260;
    const lAt = y => lT + (lB - lT) * (y - topY) / (botY - topY);
    const rAt = y => rT + (rB - rT) * (y - topY) / (botY - topY);
    ctx.fillStyle = '#3d5f8c';
    ctx.beginPath(); ctx.moveTo(lT, topY); ctx.lineTo(rT, topY); ctx.lineTo(rB, botY); ctx.lineTo(lB, botY); ctx.closePath(); ctx.fill();
    // ガラス窓（行ごとに幅が縮む）。ときどき点いている窓＝生きている施設
    for (let r = 0; r < 11; r++) {
      const y = topY + 14 + r * 15, l = lAt(y), w = rAt(y) - l, cols = 8, cw = (w - 10) / cols;
      for (let c = 0; c < cols; c++) {
        const lit = ((r * 3 + c * 5 + Math.floor(t * 1.5)) % 7 === 0);
        p(l + 5 + c * cw, y, cw - 2.5, 9, lit ? '#eaf7ff' : '#9dc6e8');
      }
      ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(l + 5, y - 2, w - 10, 1.5);   // 階の照り
    }
    // 斜めに走る反射（ガラスのハイライト）
    ctx.save();
    ctx.beginPath(); ctx.moveTo(lT, topY); ctx.lineTo(rT, topY); ctx.lineTo(rB, botY); ctx.lineTo(lB, botY); ctx.closePath(); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.beginPath(); ctx.moveTo(120, topY); ctx.lineTo(168, topY); ctx.lineTo(96, botY); ctx.lineTo(52, botY); ctx.closePath(); ctx.fill();
    ctx.restore();
    // 屋上のサイン（青地に白抜き）
    p(128, 14, 104, 26, '#123f75'); p(128, 14, 104, 3, '#2a68ad');
    ctx.fillStyle = '#fff'; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('蒼天SPA', 180, 34);
    // 足元：庇と自動ドア、のぼり旗
    p(96, 150, 168, 8, '#12324f');
    p(140, 158, 80, 30, '#0d2a44'); p(142, 160, 36, 26, '#8fd8f0'); p(182, 160, 36, 26, '#8fd8f0');
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(142, 160, 36, 3); ctx.fillRect(182, 160, 36, 3);
    ctx.fillStyle = '#e8322a';
    for (const fx of [112, 240]) { p(fx, 146, 2, 42, '#8a8f98'); p(fx + 2, 148, 12, 30, '#e8322a'); }
    // 歩道
    p(0, 188, 360, 12, '#9aa4ad'); p(0, 188, 360, 2, '#7d8791');
    // 見上げる主人公（後ろ姿・小さい＝スケール差）
    const mx = 300;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(mx, 197, 8, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    p(mx - 5, 176, 10, 20, '#3a6ea5');
    p(mx - 4, 165, 8, 11, '#e8b890');
    p(mx - 4, 165, 8, 5, '#2a2a2a');
    p(mx - 6, 178, 2, 12, '#e8b890'); p(mx + 4, 178, 2, 12, '#e8b890');
  },

  /* 蒼天SPAの浴室で玲奈と向き合う。左＝主人公（腰にタオル）／右＝玲奈（金髪ロング・ドレス） */
  soutenBath(ctx) {
    const p = this.px.bind(this, ctx);
    const t = Date.now() / 1000;
    const wisp = (x, y, n, a) => { for (let i = 0; i < n; i++) { const seed = x * 0.7 + i * 13, rise = (t * 8 + seed * 5) % 18, sway = Math.sin(t * 2 + seed) * 2; ctx.fillStyle = `rgba(255,255,255,${(a * (1 - rise / 18)).toFixed(3)})`; ctx.fillRect(Math.round(x + i * 6 + sway), Math.round(y - rise), 3, 6); } };
    // 壁と天井（高級感のある濃紺のタイル）
    const g = ctx.createLinearGradient(0, 0, 0, 130);
    g.addColorStop(0, '#1d2c3f'); g.addColorStop(1, '#33506e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 360, 130);
    for (let x = 0; x < 360; x += 24) { ctx.fillStyle = 'rgba(255,255,255,.045)'; ctx.fillRect(x, 0, 1, 130); }
    // 奥の大窓（外光＝明るい）
    p(40, 20, 280, 76, '#0e1b2a');
    p(46, 26, 268, 64, '#7fc3e8');
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(46, 26, 268, 6);
    for (let x = 46; x < 314; x += 67) { ctx.fillStyle = '#0e1b2a'; ctx.fillRect(x, 26, 3, 64); }
    // 壁ぎわの間接照明
    for (let i = 0; i < 6; i++) { const fl = 0.5 + 0.5 * Math.sin(t * 3 + i); ctx.fillStyle = `rgba(255,200,120,${(0.25 * fl).toFixed(2)})`; ctx.beginPath(); ctx.arc(28 + i * 62, 112, 9, 0, Math.PI * 2); ctx.fill(); p(26 + i * 62, 110, 5, 3, '#ffd08a'); }
    // 濡れた石のデッキ（二人はここに立つ）
    p(0, 120, 360, 34, '#4c4a48');
    p(0, 120, 360, 3, '#6a6764');
    for (let x = 0; x < 360; x += 30) { ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(x, 123, 1, 31); }
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(0, 136, 360, 2);   // 濡れた床の照り返し
    // 湯船（手前いっぱいの大きな浴槽）
    p(0, 150, 360, 50, '#243b52');
    p(0, 150, 360, 5, '#4a6f92');
    p(8, 158, 344, 42, '#2f7fa8');
    // 波紋
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1;
    for (const wy of [168, 182, 194]) {
      ctx.beginPath();
      for (let i = 0; i <= 344; i += 4) { const yy = wy + Math.sin(i * 0.06 + t * 2.4 + wy) * 2; if (i === 0) ctx.moveTo(8 + i, yy); else ctx.lineTo(8 + i, yy); }
      ctx.stroke();
    }
    wisp(30, 158, 4, .3); wisp(150, 154, 4, .26); wisp(288, 158, 4, .3);

    // ── 主人公（左・腰にタオル。気圧されて少し身を引いている）。足元はデッキ（y=150）
    const ax = 104;
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(ax, 151, 15, 4, 0, 0, Math.PI * 2); ctx.fill();
    p(ax - 7, 137, 6, 13, '#e8b890'); p(ax + 1, 137, 6, 13, '#e8b890');          // 脚
    p(ax - 11, 103, 22, 35, '#e8b890');                                          // 胴
    p(ax - 11, 125, 22, 13, '#f2ece0');                                          // 腰のタオル
    p(ax - 11, 125, 22, 2, '#dcd4c2'); p(ax + 0.5, 126, 1.6, 12, '#e2dbcb');
    p(ax - 15, 105, 4, 22, '#e8b890'); p(ax + 11, 105, 4, 22, '#e8b890');         // 腕
    p(ax - 9, 81, 18, 23, '#e8b890');                                            // 顔
    p(ax - 9, 81, 18, 9, '#2a2a2a');                                             // 髪
    p(ax - 5, 92, 3, 3, '#2a2320'); p(ax + 2, 92, 3, 3, '#2a2320');
    p(ax - 2.5, 99, 6, 2, '#8a5a4a');                                            // 半開きの口＝圧倒されている

    // ── 玲奈（右・金髪ロング／深紅のドレス）
    const rx = 254;
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(rx, 151, 18, 4, 0, 0, Math.PI * 2); ctx.fill();
    p(rx - 16, 79, 32, 60, '#d9b752');                                           // 背面のロングヘア
    p(rx - 16, 79, 32, 8, '#e6c860');
    p(rx - 10, 99, 20, 24, '#8e1f38');                                           // 上身頃
    ctx.fillStyle = '#8e1f38';                                                   // 広がる裾
    ctx.beginPath(); ctx.moveTo(rx - 10, 119); ctx.lineTo(rx + 10, 119);
    ctx.lineTo(rx + 19, 150); ctx.lineTo(rx - 19, 150); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.beginPath(); ctx.moveTo(rx - 2, 119); ctx.lineTo(rx + 4, 119);
    ctx.lineTo(rx + 9, 150); ctx.lineTo(rx + 1, 150); ctx.closePath(); ctx.fill();
    p(rx - 10, 99, 20, 2.5, '#c9506a');                                          // 胸元の切り替え
    p(rx - 14, 101, 4, 21, '#f0cdae'); p(rx + 10, 101, 4, 21, '#f0cdae');         // 腕
    p(rx - 9, 77, 18, 23, '#f2d2b4');                                            // 顔
    p(rx - 10, 75, 20, 10, '#e6c860');                                           // 前髪
    p(rx - 10, 75, 20, 3.5, '#f2dc90');
    p(rx - 5, 88, 3, 3, '#3a2a28'); p(rx + 2, 88, 3, 3, '#3a2a28');
    p(rx - 2.5, 95, 5, 2, '#c94a5a');                                            // 紅い唇＝薄い笑み
    ctx.fillStyle = '#eaf4ff'; ctx.beginPath(); ctx.arc(rx, 105, 2, 0, Math.PI * 2); ctx.fill();   // 胸元の宝石
  },

  /* 夕凪湯の浴室で、主人公ともう一人が並んで話す二人芝居（作者指定）。
     蒼天SPAの豪華な浴室(soutenBath)と対になる、富士山のペンキ絵がある昭和の銭湯。
     who='tadokoro'|'kuroda'|'kito' で右側の人物を描き分ける。※叩き台 */
  bathTadokoro(ctx) { this.yunagiBath(ctx, 'tadokoro'); },
  bathKuroda(ctx)   { this.yunagiBath(ctx, 'kuroda'); },
  bathKito(ctx)     { this.yunagiBath(ctx, 'kito'); },
  bathJoren(ctx)    { this.yunagiBath(ctx, 'joren'); },   // 白髪の常連との一幕（常連イベント用）
  yunagiBath(ctx, who) {
    const p = this.px.bind(this, ctx);
    const t = Date.now() / 1000;
    const wisp = (x, y, n, a) => { for (let i = 0; i < n; i++) { const seed = x * 0.7 + i * 13, rise = (t * 8 + seed * 5) % 18, sway = Math.sin(t * 2 + seed) * 2; ctx.fillStyle = `rgba(255,255,255,${(a * (1 - rise / 18)).toFixed(3)})`; ctx.fillRect(Math.round(x + i * 6 + sway), Math.round(y - rise), 3, 6); } };
    // ── 上壁＝富士山のペンキ絵（銭湯の顔）
    const g = ctx.createLinearGradient(0, 0, 0, 96);
    g.addColorStop(0, '#8fd0ee'); g.addColorStop(1, '#d6f0f8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 360, 96);
    // 遠くの山なみ
    ctx.fillStyle = '#7fae7a';
    ctx.beginPath(); ctx.moveTo(0, 96); ctx.lineTo(70, 66); ctx.lineTo(150, 96); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(250, 96); ctx.lineTo(320, 60); ctx.lineTo(360, 96); ctx.closePath(); ctx.fill();
    // 富士山（白い冠雪）
    ctx.fillStyle = '#5b7fb0';
    ctx.beginPath(); ctx.moveTo(120, 96); ctx.lineTo(185, 24); ctx.lineTo(250, 96); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f4f8fb';
    ctx.beginPath(); ctx.moveTo(163, 52); ctx.lineTo(185, 24); ctx.lineTo(208, 52);
    ctx.lineTo(199, 50); ctx.lineTo(192, 57); ctx.lineTo(185, 49); ctx.lineTo(178, 57); ctx.lineTo(171, 50); ctx.closePath(); ctx.fill();
    // 海（絵の下辺）と額縁
    p(0, 88, 360, 8, '#4a86b8');
    p(0, 96, 360, 3, '#b58a54');
    // ── タイル壁
    p(0, 99, 360, 27, '#cfe0e2');
    for (let x = 0; x < 360; x += 20) { ctx.fillStyle = 'rgba(0,0,0,.05)'; ctx.fillRect(x, 99, 1, 27); }
    for (let y = 99; y < 126; y += 9) { ctx.fillStyle = 'rgba(0,0,0,.05)'; ctx.fillRect(0, y, 360, 1); }
    // カラン（左手前の壁に一列）
    for (let i = 0; i < 4; i++) { p(20 + i * 22, 110, 3, 8, '#b0b8ba'); p(19 + i * 22, 108, 5, 2, '#9aa2a4'); }
    // ── 濡れた床のデッキ（二人はここに立つ）
    p(0, 120, 360, 34, '#b7a98e');
    p(0, 120, 360, 3, '#c9bda4');
    for (let x = 0; x < 360; x += 30) { ctx.fillStyle = 'rgba(0,0,0,.10)'; ctx.fillRect(x, 123, 1, 31); }
    ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(0, 138, 360, 2);
    // ── 湯船（手前・木枠のあたたかい湯）
    p(0, 150, 360, 50, '#6b4f36');
    p(0, 150, 360, 5, '#8a6a48');
    p(8, 158, 344, 42, '#c98f4a');
    p(8, 158, 344, 6, '#e0b070');
    ctx.strokeStyle = 'rgba(255,255,255,.30)'; ctx.lineWidth = 1;
    for (const wy of [170, 184, 195]) {
      ctx.beginPath();
      for (let i = 0; i <= 344; i += 4) { const yy = wy + Math.sin(i * 0.06 + t * 2.2 + wy) * 2; if (i === 0) ctx.moveTo(8 + i, yy); else ctx.lineTo(8 + i, yy); }
      ctx.stroke();
    }
    wisp(40, 156, 4, .3); wisp(170, 152, 4, .26); wisp(300, 156, 4, .3);

    // 二人は服のまま、閉店後の浴室で立ち話をする（作者指定：主人公は湯に入らない／相手も着衣）
    // 上着は腰まで、その下に長ズボンを足で伸ばす＝半ズボンに見えないようにする（作者指定）
    // ── 主人公（左・紺の作務衣＝番台に立つ普段着）
    const ax = 104;
    ctx.fillStyle = 'rgba(0,0,0,.24)'; ctx.beginPath(); ctx.ellipse(ax, 151, 15, 4, 0, 0, Math.PI * 2); ctx.fill();
    p(ax - 8, 124, 7, 26, '#2c3550'); p(ax + 1, 124, 7, 26, '#2c3550');            // 長ズボン
    p(ax - 11, 103, 22, 25, '#3a6ea5');                                            // 作務衣の上衣（腰まで）
    p(ax - 11, 121, 22, 3, '#2c5480');                                             // 帯
    p(ax + 0.3, 103, 1.4, 20, '#2c5480');                                          // 打ち合わせ
    p(ax - 15, 105, 5, 20, '#3a6ea5'); p(ax + 10, 105, 5, 20, '#3a6ea5');          // 袖
    p(ax - 14, 122, 3, 6, '#e8b890'); p(ax + 11, 122, 3, 6, '#e8b890');            // 手
    p(ax - 9, 81, 18, 23, '#e8b890');                                              // 顔
    p(ax - 9, 81, 18, 9, '#2a2a2a');                                               // 髪
    p(ax - 5, 92, 3, 3, '#2a2320'); p(ax + 2, 92, 3, 3, '#2a2320');

    // ── もう一人（右・who別）。全員、街着のまま
    const rx = 250, base = 150;
    ctx.fillStyle = 'rgba(0,0,0,.24)'; ctx.beginPath(); ctx.ellipse(rx, base + 1, 15, 4, 0, 0, Math.PI * 2); ctx.fill();
    if (who === 'tadokoro') {
      // 田所＝痩せた老人。白髪・白い太眉・白い顎髭。作業着じみた地味な普段着
      p(rx - 8, base - 26, 7, 26, '#5b5148'); p(rx + 1, base - 26, 7, 26, '#5b5148');    // 長ズボン
      p(rx - 10, base - 47, 20, 24, '#6a7a5a');                                          // 上着（腰まで・渋い緑）
      p(rx - 14, base - 45, 4, 20, '#6a7a5a'); p(rx + 10, base - 45, 4, 20, '#6a7a5a');   // 袖
      p(rx - 13, base - 28, 3, 6, '#e6c3a6'); p(rx + 10, base - 28, 3, 6, '#e6c3a6');     // 手
      p(rx - 9, base - 70, 18, 23, '#e6c3a6');                                           // 顔
      p(rx - 9, base - 72, 18, 8, '#eee');                                               // 白髪
      p(rx - 6, base - 62, 7, 1.8, '#d2d2d2'); p(rx - 1, base - 62, 7, 1.8, '#d2d2d2');   // 太い白眉
      p(rx - 5, base - 59, 3, 2.5, '#2a2320'); p(rx + 2, base - 59, 3, 2.5, '#2a2320');   // 目
      p(rx - 5, base - 52, 10, 4, '#e6e6e6');                                            // 白い顎髭
    } else if (who === 'joren') {
      // 白髪の常連の爺さん＝桶を抱えた湯上がり姿。田所より小柄で穏やか（太眉なし・肩にタオル）
      p(rx - 7, base - 24, 6, 24, '#4a4a52'); p(rx + 1, base - 24, 6, 24, '#4a4a52');    // 長ズボン
      p(rx - 9, base - 43, 18, 22, '#8a7a5a');                                           // 上着（腰まで・くすんだ茶）
      p(rx - 13, base - 41, 4, 18, '#8a7a5a'); p(rx + 9, base - 41, 4, 18, '#8a7a5a');    // 袖
      p(rx - 12, base - 26, 3, 5, '#e6c3a6'); p(rx + 9, base - 26, 3, 5, '#e6c3a6');      // 手
      p(rx - 8, base - 31, 16, 9, '#c9a86a'); p(rx - 8, base - 31, 16, 2, '#e0c080');     // 胸の前に抱えた桶
      p(rx - 9, base - 45, 8, 4, '#f2ece0');                                              // 肩に掛けたタオル
      p(rx - 8, base - 64, 16, 21, '#e6c3a6');                                            // 顔（少し小さめ）
      p(rx - 8, base - 66, 16, 7, '#eee');                                                // 白髪
      p(rx - 6, base - 57, 5, 1.5, '#d2d2d2'); p(rx + 1, base - 57, 5, 1.5, '#d2d2d2');   // 細い白眉
      p(rx - 5, base - 54, 3, 2.5, '#2a2320'); p(rx + 2, base - 54, 3, 2.5, '#2a2320');   // 目
      p(rx - 2, base - 47, 5, 1.6, '#8a5a4a');                                            // 穏やかな口元
    } else if (who === 'kuroda') {
      // 黒田＝痩身・冷静。黒髪七三・鋭い眉。仕立てのいいダークスーツ＋臙脂のネクタイ
      p(rx - 8, base - 26, 7, 26, '#20262f'); p(rx + 1, base - 26, 7, 26, '#20262f');    // 長いスラックス
      p(rx - 10, base - 47, 20, 24, '#2b3340');                                          // ジャケット（腰まで）
      p(rx - 3, base - 47, 6, 22, '#e8e2d6');                                            // Yシャツ
      p(rx - 1, base - 47, 2, 15, '#7a1f2b');                                            // 臙脂のネクタイ
      p(rx - 14, base - 45, 4, 22, '#2b3340'); p(rx + 10, base - 45, 4, 22, '#2b3340');   // 袖
      p(rx - 13, base - 25, 3, 6, '#efd0b2'); p(rx + 10, base - 25, 3, 6, '#efd0b2');     // 手
      p(rx - 9, base - 70, 18, 23, '#efd0b2');                                           // 顔
      p(rx - 9, base - 72, 18, 9, '#1e1e22');                                            // 黒髪
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(rx - 1.6, base - 72, 1.2, 5); // 七三の分け目
      p(rx - 6, base - 62, 5, 1.6, '#2a2320'); p(rx + 1, base - 62, 5, 1.6, '#2a2320');   // 鋭い眉
      p(rx - 5, base - 59, 3, 2.5, '#2a2320'); p(rx + 2, base - 59, 3, 2.5, '#2a2320');
      p(rx - 2, base - 51, 4, 1.4, '#8a5a4a');                                           // への字口
    } else {
      // 鬼頭＝スキンヘッドの強面。太い体・黒い上等なスーツ・額にサングラス・顎髭
      p(rx - 8, base - 26, 7, 26, '#1c1620'); p(rx + 1, base - 26, 7, 26, '#1c1620');    // 長いスラックス
      p(rx - 12, base - 47, 24, 24, '#2a2030');                                          // ジャケット（腰まで・黒に近い臙脂）
      p(rx - 4, base - 47, 8, 22, '#3a2a34');                                            // 開襟の黒シャツ
      p(rx - 1, base - 47, 2, 18, '#c9a86a');                                            // 金のネックレス風
      p(rx - 16, base - 45, 4, 22, '#2a2030'); p(rx + 12, base - 45, 4, 22, '#2a2030');   // 太い袖
      p(rx - 15, base - 25, 3, 6, '#d8a888'); p(rx + 12, base - 25, 3, 6, '#d8a888');     // 手
      p(rx - 9, base - 70, 18, 23, '#e0b092');                                           // 顔
      p(rx - 9, base - 72, 18, 5, '#c99a80');                                            // 剃り上げた頭の縁
      p(rx - 8, base - 74, 16, 4, '#20161a');                                            // 額のサングラス
      p(rx - 6, base - 60, 6, 1.4, '#2a2320'); p(rx + 0, base - 60, 6, 1.4, '#2a2320');   // 太い眉
      p(rx - 5, base - 58, 3, 2.5, '#2a2320'); p(rx + 2, base - 58, 3, 2.5, '#2a2320');
      p(rx - 4, base - 51, 8, 2.5, '#3a2a2a');                                           // 顎髭
    }
  },

  souten(ctx) {
    const p = this.px.bind(this, ctx);
    const t = Date.now() / 1000;
    // 湯気＝立ちのぼって消える puff（上昇・ゆらぎ・フェード）
    const wisp = (x, y, n, a) => { for (let i = 0; i < n; i++) { const seed = x * 0.7 + i * 13, rise = (t * 9 + seed * 5) % 15, sway = Math.sin(t * 2 + seed) * 2; ctx.fillStyle = `rgba(255,255,255,${(a * (1 - rise / 15)).toFixed(3)})`; ctx.fillRect(Math.round(x + i * 5 + sway), Math.round(y - rise), 3, 5); } };
    // 水面＝横に流れるさざ波
    const ripple = (x, y, w) => { ctx.strokeStyle = 'rgba(255,255,255,.38)'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i <= w; i += 3) { const yy = y + Math.sin(i * 0.3 + t * 3 + x * 0.2) * 1.4; if (i === 0) ctx.moveTo(x + i, yy); else ctx.lineTo(x + i, yy); } ctx.stroke(); };
    // 石枠（外の暗線＋石のふち＋中身）。内側は (x+3,y+3,w-6,h-6)
    const frame = (x, y, w, h, inner) => { p(x - 1, y - 1, w + 2, h + 2, '#211a13'); p(x, y, w, h, '#6b6155'); p(x + 3, y + 3, w - 6, h - 6, inner); ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1; for (let i = x + 6; i < x + w - 3; i += 8) { ctx.beginPath(); ctx.moveTo(i, y); ctx.lineTo(i, y + 3); ctx.moveTo(i, y + h - 3); ctx.lineTo(i, y + h); ctx.stroke(); } };
    const lantern = (x, y) => { const fl = 0.55 + 0.45 * Math.sin(t * 6 + x * 0.5); ctx.fillStyle = `rgba(255,178,70,${(0.22 * fl).toFixed(2)})`; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); p(x - 1, y - 2, 3, 4, '#2a2018'); p(x - 1, y - 2, 3, 2, '#ffce7a'); };
    const plant = (x, y) => { p(x, y, 4, 4, '#33502c'); p(x + 2, y - 2, 3, 3, '#4a6a38'); p(x - 1, y + 1, 3, 3, '#3c5a30'); };
    const lounger = (x, y) => { p(x, y, 14, 7, '#b58a54'); ctx.strokeStyle = 'rgba(50,34,16,.5)'; ctx.lineWidth = 1; ctx.strokeRect(x, y, 14, 7); p(x, y, 3, 7, '#8a6238'); };
    const firepit = (x, y) => { p(x - 4, y - 4, 8, 8, '#3a2c1e'); ctx.fillStyle = `rgba(255,140,50,${(0.32 + 0.16 * Math.sin(t * 6)).toFixed(2)})`; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill(); p(x - 2, y - 2, 4, 4, '#ff9a3a'); wisp(x - 2, y - 6, 2, .3); };

    // テーマ別サウナ室（石枠＋室内の演出＋ランタン）
    const chamber = (x, y, w, h, kind) => {
      const inner = { gold: '#8a5a2a', stone: '#3e3226', green: '#33512f', purple: '#33264a', salt: '#9a5450' }[kind];
      frame(x, y, w, h, inner);
      const ix = x + 3, iy = y + 3, iw = w - 6, ih = h - 6;
      if (kind === 'gold') { ctx.strokeStyle = 'rgba(210,160,80,.5)'; ctx.lineWidth = 1; for (let i = ix + 4; i < ix + iw; i += 6) { ctx.beginPath(); ctx.moveTo(i, iy); ctx.lineTo(i, iy + ih); ctx.stroke(); } p(x + w / 2 - 5, iy + ih - 12, 10, 10, '#241812'); for (let i = 0; i < 4; i++) p(x + w / 2 - 4 + (i % 2) * 4, iy + ih - 11 + Math.floor(i / 2) * 4, 3, 3, '#ffb24a'); }
      else if (kind === 'stone') { ctx.fillStyle = '#5a564e'; ctx.beginPath(); ctx.arc(x + w / 2, iy + ih / 2, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ff8a3a'; ctx.beginPath(); ctx.arc(x + w / 2, iy + ih / 2, 4, 0, Math.PI * 2); ctx.fill(); wisp(x + w / 2 - 6, iy + ih / 2 - 8, 3, .4); wisp(x + w / 2 + 4, iy + ih / 2 - 8, 3, .34); }
      else if (kind === 'green') { p(ix, iy, iw, ih, 'rgba(60,120,50,.22)'); p(x + w / 2 - 5, iy + ih / 2 - 4, 10, 9, '#2c4a2a'); ctx.fillStyle = `rgba(120,220,120,${(0.4 + 0.2 * Math.sin(t * 3)).toFixed(2)})`; ctx.beginPath(); ctx.arc(x + w / 2, iy + ih / 2, 7, 0, Math.PI * 2); ctx.fill(); plant(ix + 4, iy + ih - 8); plant(ix + iw - 8, iy + 6); }
      else if (kind === 'purple') { p(ix, iy, iw, ih, 'rgba(20,10,34,.34)'); for (let i = 0; i < 3; i++) { const cx = ix + 8 + i * ((iw - 16) / 2); p(cx, iy + ih - 10, 2, 6, '#2a2018'); ctx.fillStyle = `rgba(255,180,90,${(0.6 + 0.3 * Math.sin(t * 5 + i)).toFixed(2)})`; p(cx, iy + ih - 12, 2, 3, ctx.fillStyle); } }
      else if (kind === 'salt') { ctx.fillStyle = `rgba(255,150,140,${(0.3 + 0.12 * Math.sin(t * 4)).toFixed(2)})`; for (let i = 0; i < 5; i++) p(ix + 3 + i * ((iw - 8) / 4), iy + 4, 5, 5, ctx.fillStyle); for (let i = 0; i < 4; i++) p(ix + 3, iy + 12 + i * ((ih - 16) / 3), 5, 5, ctx.fillStyle); }
      lantern(x + 7, y + 7); lantern(x + w - 7, y + 7);
    };

    // 湯船（石枠＋湯＋波紋＋湯気＋style演出）
    const basin = (x, y, w, h, inner, style) => {
      frame(x, y, w, h, inner);
      const ix = x + 3, iy = y + 3, iw = w - 6, ih = h - 6;
      ripple(ix + 3, iy + ih * 0.38, iw - 6); if (ih > 22) ripple(ix + 3, iy + ih * 0.72, iw - 6);
      wisp(ix + 6, iy + 6, 3, .24);
      if (style === 'blue') { for (let i = 0; i < 3; i++) { const off = (t * 34 + i * 6) % (ih - 6); p(ix + 4 + i * 4, Math.round(iy + 2 + off), 2, 6, 'rgba(220,245,252,.6)'); } }
      else if (style === 'pink') { const span = ih - 6; for (let i = 0; i < Math.floor(iw / 10); i++) { const rise = (t * 10 + i * 11) % span, al = .5 * (1 - rise / span); p(Math.round(ix + 6 + i * 10 + Math.sin(t * 2 + i)), Math.round(iy + ih - 3 - rise), 2, 2, `rgba(255,255,255,${al.toFixed(3)})`); } }
      else if (style === 'electric') { for (let i = 0; i < 6; i++) { const pu = 0.4 + 0.5 * Math.sin(t * 5 + i * 1.3); p(Math.round(ix + 6 + i * ((iw - 10) / 5)), iy + Math.round(ih / 2) - 1, 3, 3, `rgba(180,220,255,${pu.toFixed(2)})`); } }
      else if (style === 'jet') { for (let i = 0; i < Math.floor(iw / 9); i++) { const off = (t * 18 + i * 5) % (ih - 4); p(ix + 5 + i * 9, Math.round(iy + ih - 3 - off), 2, 4, 'rgba(255,255,255,.5)'); } }
      else if (style === 'white') { p(ix, iy, iw, ih, 'rgba(255,255,255,.12)'); }
      else if (style === 'green') { ctx.fillStyle = 'rgba(30,60,18,.5)'; for (let i = 0; i < 6; i++) p(ix + 5 + (i % 3) * ((iw - 8) / 3), iy + 5 + Math.floor(i / 3) * ((ih - 8) / 2), 3, 3, 'rgba(30,60,18,.5)'); }
      else if (style === 'lie') { ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1; const n = Math.floor(iw / 16); for (let i = 1; i < n; i++) { ctx.beginPath(); ctx.moveTo(ix + i * 16, iy); ctx.lineTo(ix + i * 16, iy + ih); ctx.stroke(); } ctx.fillStyle = 'rgba(40,60,80,.4)'; for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.ellipse(ix + 8 + i * 16, iy + ih / 2, 4, 2, 0, 0, Math.PI * 2); ctx.fill(); } }
    };
    // 水風呂（浅=氷青／深=濃紺／氷=氷塊）
    const plunge = (x, y, w, h, kind) => {
      const inner = kind === 'deep' ? '#255490' : kind === 'ice' ? '#a9dcef' : '#7fc8ec';
      frame(x, y, w, h, inner);
      const ix = x + 3, iy = y + 3, iw = w - 6, ih = h - 6;
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1; ctx.strokeRect(ix + 1, iy + 1, iw - 2, ih - 2);   // 霜のふち
      if (kind === 'ice') { for (let i = 0; i < 8; i++) p(ix + 3 + (i % 4) * ((iw - 6) / 4), iy + 3 + Math.floor(i / 4) * ((ih - 6) / 2), 6, 5, i % 2 ? '#e6f4fb' : '#cfeaf7'); }
      else { ripple(ix + 3, iy + ih * 0.5, iw - 6); wisp(ix + 6, iy + 6, 2, .3); }
    };
    // 岩の露天風呂（滝の流れ込み・岩・緑・湯気）
    const onsen = (x, y, w, h) => {
      frame(x, y, w, h, '#4a5a52');
      const ix = x + 6, iy = y + 8, iw = w - 12, ih = h - 18;
      p(ix, iy, iw, ih, '#3f93a8'); p(ix + 2, iy + 2, iw - 4, ih - 4, '#5fb0bc');
      ripple(ix + 4, iy + ih * 0.35, iw - 8); ripple(ix + 4, iy + ih * 0.7, iw - 8);
      wisp(ix + 8, iy + 8, 4, .34); wisp(ix + iw - 16, iy + 12, 4, .28);
      ctx.fillStyle = '#7a7266'; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; p(Math.round(x + w / 2 + Math.cos(a) * (w / 2 - 4) - 2), Math.round(y + h / 2 + Math.sin(a) * (h / 2 - 5) - 2), 6, 5, '#7a7266'); }
      for (let i = 0; i < 3; i++) { const off = (t * 40 + i * 7) % 14; p(x + w / 2 - 6 + i * 5, Math.round(iy + off), 2, 7, 'rgba(214,242,250,.7)'); }
      plant(x + 7, y + h - 12); plant(x + w - 12, y + 9); plant(x + 9, y + 10);
    };
    // 枯山水の島（石・木・小さな池・ランタン）
    const zen = (x, y, w, h) => {
      frame(x, y, w, h, '#8f9a6a');
      const ix = x + 3, iy = y + 3, iw = w - 6, ih = h - 6;
      p(ix + iw - 20, iy + 4, 16, ih - 8, '#3f93a8'); ripple(ix + iw - 18, iy + ih / 2, 12);   // 小さな池
      p(ix + 6, iy + ih - 10, 7, 6, '#7a7266'); p(ix + 15, iy + 6, 6, 5, '#8a8276');           // 石
      p(ix + 4, iy + 4, 4, ih - 8, '#5a3f28'); ctx.fillStyle = '#3f6a34'; ctx.beginPath(); ctx.arc(ix + 6, iy + 6, 7, 0, Math.PI * 2); ctx.fill();   // 木
      lantern(ix + iw - 6, iy + ih - 6);
    };
    // 滝＝暗い岩壁を落ちる水＋下の水たまり＋緑
    const waterfall = (x, y, w, h) => {
      frame(x, y, w, h, '#38443f');
      const ix = x + 3, iy = y + 3, iw = w - 6, ih = h - 6;
      ctx.fillStyle = '#5f5f54'; p(ix, iy, 6, ih, '#5f5f54'); p(ix + iw - 6, iy, 6, ih, '#5f5f54');
      for (let i = 0; i < 6; i++) { const off = (t * 40 + i * 9) % (ih - 16); p(ix + 8 + i * 5, Math.round(iy + 4 + off), 2, 8, 'rgba(214,242,250,.72)'); }
      p(ix + 4, iy + ih - 14, iw - 8, 11, '#4a9aa8'); ripple(ix + 6, iy + ih - 8, iw - 12);
      plant(ix + 2, iy + 2); plant(ix + iw - 8, iy + ih - 12);
    };

    // ── 床（温かみのある石畳）＋外壁
    p(0, 0, 360, 200, '#c2ac82');
    ctx.strokeStyle = 'rgba(120,100,70,.22)'; ctx.lineWidth = 1;
    for (let x = 0; x < 360; x += 15) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 200); ctx.stroke(); }
    for (let y = 0; y < 200; y += 15) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); }
    ctx.strokeStyle = '#201810'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 356, 196);

    // ── 上：テーマ別サウナ5室（金/石/緑/紫/塩）＋滝
    chamber(6, 4, 56, 52, 'gold');
    chamber(64, 4, 56, 52, 'stone');
    chamber(122, 4, 56, 52, 'green');
    chamber(180, 4, 56, 52, 'purple');
    chamber(238, 4, 56, 52, 'salt');
    waterfall(298, 4, 58, 52);
    for (const lx of [34, 92, 150, 208, 266]) lantern(lx, 60);   // 通路のランタン

    // ── 左：多彩な湯（青・桃・紫電気・翡翠ジェット）
    basin(6, 64, 106, 40, '#5aa8d0', 'blue');
    basin(6, 108, 106, 26, '#c87a9a', 'pink');
    basin(6, 138, 106, 26, '#6a4a9a', 'electric');
    basin(6, 168, 106, 26, '#3fa0a8', 'jet');

    // ── 中央：枯山水＋広場（焚火・寝椅子・主人公）＋白湯・薬草・寝湯
    zen(120, 64, 66, 30);
    lounger(196, 66); lounger(228, 64); firepit(224, 82);
    basin(120, 100, 64, 40, '#eef2f2', 'white');
    basin(190, 100, 60, 40, '#7a8a3a', 'green');
    basin(120, 146, 130, 18, '#5ab0b8', 'lie');
    plunge(120, 168, 40, 24, 'cold'); plunge(164, 168, 40, 24, 'deep'); plunge(208, 168, 42, 24, 'ice');

    // ── 右：岩の露天＋ととのいの寝椅子群
    onsen(256, 64, 100, 84);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) lounger(260 + c * 24, 154 + r * 13);

    // ── ランタン・緑を要所に散らす
    for (const [lx, ly] of [[118, 100], [118, 168], [252, 64], [252, 148], [116, 64]]) lantern(lx, ly);
    for (const [gx, gy] of [[186, 96], [116, 106], [250, 96], [116, 136]]) plant(gx, gy);

    // ── 主人公（広場にちいさく立ち尽くす＝影＋体＋頭。俯瞰でも“人が立っている”とわかるように）
    const hx = 206, hy = 80;
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(hx + 3, hy + 12, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
    p(hx, hy, 6, 10, '#3a4556'); p(hx, hy - 5, 6, 5, '#2c2723');
  },

  // 売却エンド：暖簾を下ろした夕凪湯の前に、ひとり立つ親父（悲しそう・薄暮）
  oyajiSad(ctx) {
    const p = this.px.bind(this, ctx);
    // くすんだ薄暮の空
    const g = ctx.createLinearGradient(0, 0, 0, 130);
    g.addColorStop(0, '#3a3a4e'); g.addColorStop(.6, '#6a5a5a'); g.addColorStop(1, '#8a7060');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 360, 130);
    // 沈む夕日（弱い光）
    ctx.fillStyle = 'rgba(200,150,110,.5)'; ctx.beginPath(); ctx.arc(300, 40, 16, 0, Math.PI * 2); ctx.fill();
    // 道
    p(0, 130, 360, 70, '#40382f');
    p(0, 130, 360, 5, '#4a4036');
    // 夕凪湯（灯りの消えた壁・くすんだ茶）
    p(60, 62, 240, 78, '#584438');
    p(50, 46, 260, 20, '#3a2c22');                     // 屋根
    p(70, 22, 20, 28, '#4a3830');                      // 煙突（煙は無し＝湯を落とした）
    // のれんが外され、「ゆ」の跡（色あせた四角）だけが残る
    p(140, 84, 80, 30, '#4a4038');
    ctx.strokeStyle = 'rgba(200,190,170,.35)'; ctx.lineWidth = 1; ctx.strokeRect(140, 84, 80, 30);
    ctx.fillStyle = 'rgba(210,200,180,.28)'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('ゆ', 180, 106);
    p(120, 84, 14, 56, '#241c16'); p(226, 84, 14, 56, '#241c16'); // 閉ざされた戸
    // 「蒼天SPA 分館 建設予定」の看板
    p(244, 70, 96, 30, '#e9edf0'); ctx.strokeStyle = '#3a6a8a'; ctx.lineWidth = 2; ctx.strokeRect(244, 70, 96, 30);
    p(250, 100, 4, 30, '#8a8a8a'); p(330, 100, 4, 30, '#8a8a8a');
    ctx.fillStyle = '#2a4a68'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('蒼天SPA', 292, 84); ctx.fillText('分館 建設予定', 292, 96);
    // 親父（ひとり・作業着・こちらに背を向け、肩を落として建物を見上げる＝小さく寂しく）
    const fx = 168;
    p(fx, 138, 22, 44, '#5a5a52');                     // 背中（作業着・くすんだ）
    p(fx + 3, 164, 8, 18, '#4a4a44'); p(fx + 12, 164, 8, 18, '#4a4a44'); // 脚
    p(fx + 3, 138, 16, 6, '#4e4e46');                  // 落ちた肩
    p(fx + 4, 124, 15, 15, '#dcdcdc');                 // 白髪の後頭部
    // 足元に置いた桶（もう使われない）
    p(fx - 16, 172, 14, 9, '#b89a5e'); ctx.strokeStyle = '#3a2f20'; ctx.lineWidth = 1; ctx.strokeRect(fx - 16, 172, 14, 9);
  },

  inside(ctx) {
    const p = this.px.bind(this, ctx);
    // ── 浴場全体（薄暗い空気）
    p(0, 0, 360, 200, '#443a2e');
    // 天井（板張り）＋切れかけの裸電球
    p(0, 0, 360, 15, '#2c2216');
    p(300, 15, 3, 9, '#191108');
    ctx.fillStyle = 'rgba(255,208,140,.22)'; ctx.beginPath(); ctx.arc(301, 30, 13, 0, Math.PI * 2); ctx.fill();
    p(297, 25, 8, 8, '#d8b46a');

    // ── 奥の壁（曇ったタイル・水染み）
    p(0, 15, 360, 86, '#8d877a');
    ctx.strokeStyle = 'rgba(58,52,42,.32)'; ctx.lineWidth = 1;
    for (let x = 0; x <= 360; x += 24) { ctx.beginPath(); ctx.moveTo(x, 15); ctx.lineTo(x, 101); ctx.stroke(); }
    for (let y = 33; y < 101; y += 18) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); }
    p(16, 58, 46, 34, 'rgba(64,74,64,.22)'); p(300, 30, 44, 56, 'rgba(64,74,64,.2)');  // 水染み

    // ── 富士山のペンキ絵（色あせ・剥げ）＝奥の壁に掛かる一枚絵
    const mx = 100, my = 22, mw = 160, mh = 60;
    p(mx - 5, my - 5, mw + 10, mh + 10, '#5a4636');    // 木枠
    p(mx, my, mw, mh, '#9db0b4');                      // 色あせた空
    p(mx, my, mw, 13, '#87a0a8');
    ctx.fillStyle = '#c3ced2'; ctx.beginPath();        // 富士山（くすんだ白）
    ctx.moveTo(mx + 38, my + mh); ctx.lineTo(mx + mw / 2, my + 15); ctx.lineTo(mx + mw - 38, my + mh); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#edf1f3'; ctx.beginPath();        // 冠雪
    ctx.moveTo(mx + mw / 2 - 13, my + 29); ctx.lineTo(mx + mw / 2, my + 15); ctx.lineTo(mx + mw / 2 + 13, my + 29); ctx.lineTo(mx + mw / 2, my + 23); ctx.closePath(); ctx.fill();
    // ペンキの剥げ（斑点）
    p(mx + 18, my + 20, 14, 9, '#867c6f'); p(mx + mw - 34, my + 32, 15, 11, '#867c6f'); p(mx + 64, my + mh - 13, 22, 9, '#867c6f');
    // ひび
    ctx.strokeStyle = '#4a4236'; ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(mx + mw - 20, my + 4); ctx.lineTo(mx + mw - 30, my + 28); ctx.lineTo(mx + mw - 24, my + 48); ctx.stroke();

    // ── 濡れた床タイル（奥行きの目地）
    p(0, 101, 360, 99, '#5d574a');
    ctx.strokeStyle = 'rgba(28,24,16,.4)'; ctx.lineWidth = 1;
    for (let y = 114; y < 200; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); }
    for (let x = 0; x <= 360; x += 30) { ctx.beginPath(); ctx.moveTo(x, 101); ctx.lineTo(x, 200); ctx.stroke(); }

    // ── 左手の洗い場（曇り鏡・錆カラン・桶・風呂椅子）
    p(6, 66, 52, 30, '#6d6454'); p(10, 70, 44, 22, '#8a97a0');   // 鏡
    p(27, 92, 8, 12, '#585144'); p(29, 86, 4, 8, '#7a6a4a');     // カラン（錆）
    p(12, 122, 22, 11, '#c9a86a'); ctx.strokeStyle = '#3a2f28'; ctx.lineWidth = 1; ctx.strokeRect(12, 122, 22, 11); // 桶
    p(42, 128, 18, 18, '#8a6a48');                               // 風呂椅子

    // ── ヒビだらけの古い浴槽（右手前）
    const bx = 200, by = 120, bw = 148, bh = 66;
    p(bx, by, bw, bh, '#8f8a7c');                      // タイルの縁
    ctx.strokeStyle = 'rgba(58,52,42,.4)'; ctx.lineWidth = 1;
    for (let x = bx; x <= bx + bw; x += 18) { ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x, by + 10); ctx.stroke(); }
    p(bx + 8, by + 12, bw - 16, bh - 22, '#7d918a');   // 濁った湯（ぬるい）
    ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 2; ctx.beginPath();  // 水面の照り
    ctx.moveTo(bx + 16, by + 26); ctx.quadraticCurveTo(bx + 42, by + 22, bx + 68, by + 26); ctx.stroke();
    ctx.strokeStyle = '#4c473b'; ctx.lineWidth = 2; ctx.beginPath();  // ヒビ
    ctx.moveTo(bx + 22, by); ctx.lineTo(bx + 36, by + 22); ctx.lineTo(bx + 28, by + 44);
    ctx.moveTo(bx + bw - 24, by + 6); ctx.lineTo(bx + bw - 34, by + 34); ctx.stroke();

    // ── 主人公（後ろ姿・呆然と立ち尽くす）
    const hx = 150;
    p(hx, 118, 27, 54, '#3a4556');                     // 背中
    p(hx + 3, 148, 9, 24, '#2f3846'); p(hx + 15, 148, 9, 24, '#2f3846'); // 脚
    p(hx + 3, 118, 21, 6, '#334150');                  // 肩
    p(hx + 4, 101, 19, 18, '#2c2723');                 // 後頭部（黒髪）
  },

  // 常連の車座：湯上がりの年寄り連中が番台の脇で車座になり、主人公も輪に加わる（あたたかい脱衣所）
  /* 夜の脱衣所（あたたかい木の部屋・裸電球・番台・柱時計）。車座・作戦会議・鬼頭救出などの共通背景 */
  datsuiNight(ctx) {
    const p = this.px.bind(this, ctx);
    // ── あたたかい木の壁（夜の脱衣所・裸電球の灯り）
    p(0, 0, 360, 100, '#5a4a36');
    for (let x = 0; x < 360; x += 36) { ctx.fillStyle = 'rgba(0,0,0,.10)'; ctx.fillRect(x, 0, 1, 100); }
    // 裸電球（あたたかい光）
    p(178, 0, 3, 12, '#2c2216');
    ctx.fillStyle = 'rgba(255,214,150,.20)'; ctx.beginPath(); ctx.arc(179.5, 22, 34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,214,150,.14)'; ctx.beginPath(); ctx.arc(179.5, 22, 56, 0, Math.PI * 2); ctx.fill();
    p(175, 12, 9, 10, '#ffd98a');
    // ── 左の番台（木の箱＋のれん端）
    p(8, 40, 62, 60, '#6b4f36'); p(8, 40, 62, 6, '#8a6a48');
    p(14, 52, 50, 26, '#4a3826');                       // 窓口
    p(8, 96, 62, 4, '#3a2c1e');
    // 柱時計と木札
    p(300, 26, 26, 40, '#4a3826'); p(305, 32, 16, 16, '#e8e0cc');
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(313, 40); ctx.lineTo(313, 34); ctx.moveTo(313, 40); ctx.lineTo(317, 42); ctx.stroke();
    p(280, 70, 46, 14, '#c9a86a');
    // ── 木の床（飴色）
    p(0, 100, 360, 100, '#8a6a48');
    for (let y = 112; y < 200; y += 14) { ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(0, y, 360, 1); }
    ctx.fillStyle = 'rgba(255,220,160,.08)'; ctx.fillRect(80, 110, 200, 70);   // 電球の照り返し
  },

  /* 立ち姿の人物（上着＋長ズボン）。who で配色・特徴を切り替える共通ヘルパー。
     d=向き（1=右向き/-1=左向き。目の寄せに使う）。yunagiBathの造形をベースに全キャラを統一 */
  figStand(ctx, x, base, who, d, opts) {
    const p = this.px.bind(this, ctx);
    d = d || 1;
    opts = opts || {};
    const eye = (dx) => { p(x - 5 + dx, base - 59, 3, 2.5, '#2a2320'); p(x + 2 + dx, base - 59, 3, 2.5, '#2a2320'); };
    ctx.fillStyle = 'rgba(0,0,0,.24)'; ctx.beginPath(); ctx.ellipse(x, base + 1, 15, 4, 0, 0, Math.PI * 2); ctx.fill();
    if (who === 'hero') {                 // 主人公＝紺の作務衣
      p(x - 8, base - 26, 7, 26, '#2c3550'); p(x + 1, base - 26, 7, 26, '#2c3550');
      p(x - 10, base - 47, 20, 24, '#3a6ea5'); p(x - 10, base - 26, 20, 3, '#2c5480');
      p(x - 14, base - 45, 4, 20, '#3a6ea5'); p(x + 10, base - 45, 4, 20, '#3a6ea5');
      p(x - 13, base - 27, 3, 6, '#e8b890'); p(x + 10, base - 27, 3, 6, '#e8b890');
      p(x - 9, base - 70, 18, 23, '#e8b890'); p(x - 9, base - 72, 18, 9, '#2a2a2a'); eye(d);
    } else if (who === 'tadokoro') {      // 田所＝渋緑の上着・白髪白眉白髭
      p(x - 8, base - 26, 7, 26, '#5b5148'); p(x + 1, base - 26, 7, 26, '#5b5148');
      p(x - 10, base - 47, 20, 24, '#6a7a5a');
      if (!opts.hideLeftArm) p(x - 14, base - 45, 4, 20, '#6a7a5a');
      if (!opts.hideRightArm) p(x + 10, base - 45, 4, 20, '#6a7a5a');
      if (!opts.hideLeftArm) p(x - 13, base - 28, 3, 6, '#e6c3a6');
      if (!opts.hideRightArm) p(x + 10, base - 28, 3, 6, '#e6c3a6');
      p(x - 9, base - 70, 18, 23, '#e6c3a6'); p(x - 9, base - 72, 18, 8, '#eee');
      p(x - 6, base - 62, 7, 1.8, '#d2d2d2'); p(x - 1, base - 62, 7, 1.8, '#d2d2d2');
      eye(d); p(x - 5, base - 52, 10, 4, '#e6e6e6');
    } else if (who === 'kuroda') {        // 黒田＝ダークスーツ・臙脂タイ・黒髪七三
      p(x - 8, base - 26, 7, 26, '#20262f'); p(x + 1, base - 26, 7, 26, '#20262f');
      p(x - 10, base - 47, 20, 24, '#2b3340'); p(x - 3, base - 47, 6, 22, '#e8e2d6'); p(x - 1, base - 47, 2, 15, '#7a1f2b');
      p(x - 14, base - 45, 4, 22, '#2b3340'); p(x + 10, base - 45, 4, 22, '#2b3340');
      p(x - 13, base - 25, 3, 6, '#efd0b2'); p(x + 10, base - 25, 3, 6, '#efd0b2');
      p(x - 9, base - 70, 18, 23, '#efd0b2'); p(x - 9, base - 72, 18, 9, '#1e1e22');
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x - 1.6, base - 72, 1.2, 5);
      p(x - 6, base - 63, 5, 1.6, '#2a2320'); p(x + 1, base - 63, 5, 1.6, '#2a2320'); eye(d);
    } else if (who === 'kito') {          // 鬼頭＝黒スーツ・スキンヘッド・額サングラス・顎髭（太い体）
      p(x - 8, base - 26, 7, 26, '#1c1620'); p(x + 1, base - 26, 7, 26, '#1c1620');
      p(x - 12, base - 47, 24, 24, '#2a2030'); p(x - 4, base - 47, 8, 22, '#3a2a34'); p(x - 1, base - 47, 2, 18, '#c9a86a');
      p(x - 16, base - 45, 4, 22, '#2a2030'); p(x + 12, base - 45, 4, 22, '#2a2030');
      p(x - 15, base - 25, 3, 6, '#d8a888'); p(x + 12, base - 25, 3, 6, '#d8a888');
      p(x - 9, base - 70, 18, 23, '#e0b092'); p(x - 9, base - 72, 18, 5, '#c99a80');
      p(x - 8, base - 74, 16, 4, '#20161a');
      p(x - 6, base - 60, 6, 1.4, '#2a2320'); p(x + 0, base - 60, 6, 1.4, '#2a2320');
      p(x - 5, base - 58, 3, 2.5, '#2a2320'); p(x + 2, base - 58, 3, 2.5, '#2a2320');
      p(x - 4, base - 51, 8, 2.5, '#3a2a2a');
    } else if (who === 'reina') {         // 玲奈＝赤いドレス・金髪ロング
      p(x - 7, base - 40, 14, 14, '#b3273a');                                     // 胴（ドレス上）
      ctx.fillStyle = '#b3273a'; ctx.beginPath();                                 // 裾＝腰から広がる台形
      ctx.moveTo(x - 7, base - 28); ctx.lineTo(x + 7, base - 28); ctx.lineTo(x + 12, base); ctx.lineTo(x - 12, base);
      ctx.closePath(); ctx.fill();
      p(x - 11, base - 38, 4, 16, '#b3273a'); p(x + 7, base - 38, 4, 16, '#b3273a');
      p(x - 10, base - 22, 3, 5, '#f2d3b8'); p(x + 7, base - 22, 3, 5, '#f2d3b8');
      p(x - 8, base - 62, 16, 21, '#f2d3b8');                                     // 顔
      p(x - 9, base - 64, 18, 8, '#e8c24a');                                      // 金髪
      p(x - 11, base - 60, 4, 30, '#e8c24a'); p(x + 7, base - 60, 4, 30, '#e8c24a');  // ロング
      p(x - 4, base - 53, 2.5, 2.5, '#4a3520'); p(x + 2, base - 53, 2.5, 2.5, '#4a3520');
      p(x - 1, base - 47, 3, 1.2, '#a34a5a');
    } else if (who === 'nappa') {         // 熱波師＝橙の法被・白鉢巻・肩に大タオル
      p(x - 8, base - 26, 7, 26, '#3a3230'); p(x + 1, base - 26, 7, 26, '#3a3230');
      p(x - 10, base - 47, 20, 24, '#c9502a'); p(x - 10, base - 47, 3, 24, '#7a2a12'); p(x + 7, base - 47, 3, 24, '#7a2a12');
      p(x - 14, base - 45, 4, 20, '#c9502a'); p(x + 10, base - 45, 4, 20, '#c9502a');
      p(x - 13, base - 27, 3, 6, '#d8a878'); p(x + 10, base - 27, 3, 6, '#d8a878');
      p(x - 9, base - 70, 18, 23, '#d8a878'); p(x - 9, base - 72, 18, 8, '#2a2a2a');
      p(x - 9, base - 64, 18, 3, '#f4f0e6');                                      // 鉢巻
      eye(d);
      p(x - 16, base - 50, 10, 26, '#fff'); p(x - 16, base - 50, 10, 4, '#cfe0e8');  // 肩の大タオル
    } else if (who === 'banker') {        // 信金の担当者＝グレーのスーツ・眼鏡
      p(x - 8, base - 26, 7, 26, '#4a4e56'); p(x + 1, base - 26, 7, 26, '#4a4e56');
      p(x - 10, base - 47, 20, 24, '#5c6470'); p(x - 3, base - 47, 6, 22, '#e8e2d6'); p(x - 1, base - 47, 2, 15, '#3a5a7a');
      p(x - 14, base - 45, 4, 20, '#5c6470'); p(x + 10, base - 45, 4, 20, '#5c6470');
      p(x - 13, base - 26, 3, 6, '#e8c8a8'); p(x + 10, base - 26, 3, 6, '#e8c8a8');
      p(x - 9, base - 70, 18, 23, '#e8c8a8'); p(x - 9, base - 72, 18, 8, '#3a3a3a');
      ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1;                             // 眼鏡
      ctx.strokeRect(x - 6, base - 60, 5, 4); ctx.strokeRect(x + 1, base - 60, 5, 4);
      ctx.beginPath(); ctx.moveTo(x - 1, base - 58); ctx.lineTo(x + 1, base - 58); ctx.stroke();
    } else if (who === 'haida') {         // 灰田＝くたびれた茶スーツ・擦り切れた革鞄・薄笑い
      p(x - 8, base - 26, 7, 26, '#4a3e30'); p(x + 1, base - 26, 7, 26, '#4a3e30');
      p(x - 10, base - 47, 20, 24, '#6a5a42'); p(x - 3, base - 47, 6, 22, '#d8d0c0');
      p(x - 14, base - 45, 4, 20, '#6a5a42'); p(x + 10, base - 45, 4, 20, '#6a5a42');
      p(x - 13, base - 26, 3, 6, '#e0c0a0'); p(x + 10, base - 26, 3, 6, '#e0c0a0');
      p(x - 9, base - 70, 18, 23, '#e0c0a0'); p(x - 9, base - 72, 18, 7, '#5a5048');
      p(x - 5, base - 60, 3, 1.6, '#2a2320'); p(x + 2, base - 60, 3, 1.6, '#2a2320');   // 細い目（笑っていない）
      p(x - 3, base - 52, 6, 1.4, '#8a5a4a');                                     // 薄笑い
      p(x + 12, base - 18, 12, 14, '#5a4632'); p(x + 12, base - 18, 12, 3, '#3e3022');  // 革鞄
    }
  },

  kurumaza(ctx) {
    const p = this.px.bind(this, ctx);
    this.datsuiNight(ctx);
    // ── 座った人（あぐら）を描く小さなヘルパー。back=後ろ姿（顔なし）
    const seated = (x, y, cloth, hairC, opts) => {
      const o = opts || {};
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(x, y + 10, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
      p(x - 12, y + 2, 24, 8, o.pants || '#4a4038');    // あぐらの脚
      p(x - 9, y - 18, 18, 22, cloth);                  // 胴
      p(x - 12, y - 16, 4, 14, cloth); p(x + 8, y - 16, 4, 14, cloth);   // 腕
      p(x - 8, y - 36, 16, 19, o.skin || '#e6c3a6');    // 顔
      p(x - 8, y - 38, 16, 7, hairC);                   // 髪
      if (!o.back) {                                    // 顔（正面向きだけ）
        p(x - 4, y - 27, 2.5, 2.5, '#2a2320'); p(x + 2, y - 27, 2.5, 2.5, '#2a2320');
        if (o.hige) p(x - 4, y - 21, 8, 3, hairC);      // 顎髭
      }
      if (o.milk) {                                     // 手元の瓶牛乳
        p(x + 11, y - 8, 5, 9, '#f6f2ea'); p(x + 11, y - 10, 5, 2, '#b3402e');
      }
    };
    // 輪のかたち＝奥に3人（正面）・手前に2人（後ろ姿）。主人公は奥の真ん中
    seated(126, 128, '#6a7a5a', '#e8e8e8', { milk: true, hige: true });          // 常連A（渋緑・白髭）
    seated(234, 128, '#5a6a7a', '#dcdcdc', { milk: true });                      // 常連B（青鼠）
    seated(180, 120, '#3a6ea5', '#2a2a2a', { pants: '#2c3550', skin: '#e8b890' }); // 主人公（紺の作務衣）
    seated(140, 172, '#7a6a4a', '#e0e0e0', { back: true });                      // 常連C（後ろ姿）
    seated(222, 172, '#5b5148', '#cccccc', { back: true, milk: true });          // 常連D（後ろ姿）
    // 輪の真ん中：将棋盤と湯上がりの桶
    p(168, 150, 26, 12, '#d9b98a'); ctx.strokeStyle = 'rgba(80,50,20,.5)'; ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(168 + i * 8.6, 150); ctx.lineTo(168 + i * 8.6, 162); ctx.stroke(); }
    p(150, 156, 12, 6, '#c9a86a');
  },

  /* ── 鬼頭との決着（3回目）＝田所が割って入る特別シーン3枚。夜の脱衣所で */
  kitoRescue1(ctx) {   // ①鬼頭がみかじめ料を取ろうとする
    this.datsuiNight(ctx);
    this.figStand(ctx, 120, 168, 'hero', 1);
    this.figStand(ctx, 226, 166, 'kito', -1);
    // 鬼頭の威圧（頭上の怒りマーク風の線）
    ctx.strokeStyle = 'rgba(200,60,50,.7)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (const [ax, ay, bx, by] of [[244, 84, 250, 78], [250, 90, 257, 86], [242, 94, 248, 92]]) {
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
  },
  kitoRescue2(ctx) {   // ②田所が間に割って入る
    this.datsuiNight(ctx);
    this.figStand(ctx, 96, 168, 'hero', 1);
    this.figStand(ctx, 176, 170, 'tadokoro', 1, { hideRightArm: true });
    this.figStand(ctx, 268, 166, 'kito', -1);
    // 田所の伸ばした腕（鬼頭を制止）＝通常の右腕の代わりに、鬼頭側へ伸ばした腕を1本だけ描く
    const p = this.px.bind(this, ctx);
    p(184, 122, 18, 4, '#6a7a5a'); p(198, 121, 5, 6, '#e6c3a6');
  },
  kitoRescue3(ctx) {   // ③主人公が田所に感謝（鬼頭は去った）
    this.datsuiNight(ctx);
    // 主人公＝頭を下げる（少し前傾＝胴を短く・頭を前へ）
    const p = this.px.bind(this, ctx);
    const x = 140, base = 168;
    ctx.fillStyle = 'rgba(0,0,0,.24)'; ctx.beginPath(); ctx.ellipse(x, base + 1, 15, 4, 0, 0, Math.PI * 2); ctx.fill();
    p(x - 8, base - 26, 7, 26, '#2c3550'); p(x + 1, base - 26, 7, 26, '#2c3550');
    p(x - 10, base - 44, 20, 21, '#3a6ea5'); p(x - 10, base - 26, 20, 3, '#2c5480');
    p(x - 14, base - 42, 4, 18, '#3a6ea5'); p(x + 10, base - 42, 4, 18, '#3a6ea5');
    p(x + 2, base - 62, 18, 21, '#e8b890');            // 前へ倒した頭
    p(x + 2, base - 64, 18, 8, '#2a2a2a');
    this.figStand(ctx, 234, 168, 'tadokoro', -1);
  },

  /* ── 信用金庫の窓口（初回面談）：明るいロビー・カウンター越しの担当者 */
  bankMeet(ctx) {
    const p = this.px.bind(this, ctx);
    p(0, 0, 360, 120, '#e8e4da');                                  // 明るい壁
    p(0, 0, 360, 8, '#c8c2b4');
    p(24, 22, 90, 44, '#5a8ab0'); p(28, 26, 82, 36, '#d8ecf4');    // ポスター（青）
    ctx.fillStyle = '#5a8ab0'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('ご融資', 69, 40); ctx.fillText('ご相談ください', 69, 54);
    p(250, 16, 70, 26, '#4a4e56'); ctx.fillStyle = '#ffd98a'; ctx.font = 'bold 12px sans-serif';
    ctx.fillText('窓口 ①', 285, 33);                                // 窓口番号板
    p(0, 120, 360, 80, '#b0a890');                                 // 床
    for (let y = 132; y < 200; y += 16) { ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(0, y, 360, 1); }
    // カウンター（右側・担当者はその奥）
    p(190, 96, 170, 12, '#8a7a5e'); p(190, 108, 170, 50, '#a8987a');
    p(198, 116, 60, 3, '#6a5a42');                                  // 書類
    p(266, 112, 26, 18, '#e8e2d6'); p(268, 114, 22, 2, '#888');     // 通帳
    this.figStand(ctx, 300, 108, 'banker', -1);                     // 担当者（カウンター奥＝上半身が見える）
    this.figStand(ctx, 110, 186, 'hero', 1);                        // 主人公（手前）
  },

  /* ── 夜の店先：ヤミ金・灰田との初対面。暗い通りに、のれんの明かり */
  haidaMeet(ctx) {
    const p = this.px.bind(this, ctx);
    const g = ctx.createLinearGradient(0, 0, 0, 200);
    g.addColorStop(0, '#141824'); g.addColorStop(1, '#242434');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 360, 200);                // 夜
    p(20, 20, 320, 120, '#4a3a2c');                                 // 店の正面
    p(20, 20, 320, 10, '#2c2216');
    p(150, 44, 60, 40, '#1f3a6b');                                  // 暖簾
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('ゆ', 180, 70);
    ctx.fillStyle = 'rgba(255,214,150,.16)'; ctx.beginPath(); ctx.arc(180, 66, 60, 0, Math.PI * 2); ctx.fill();
    p(60, 60, 34, 60, '#3a2c1e'); p(266, 60, 34, 60, '#3a2c1e');    // 窓（灯りは消えている）
    p(0, 140, 360, 60, '#3a3a44');                                  // 通り
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(0, 150, 360, 2);
    this.figStand(ctx, 120, 186, 'hero', 1);
    this.figStand(ctx, 240, 186, 'haida', -1);
  },

  /* ── 蒼天SPAのビル前（特別映像①）：ガラスの塔の足元に主人公と玲奈 */
  soutenFront(ctx) {
    const p = this.px.bind(this, ctx);
    const g = ctx.createLinearGradient(0, 0, 0, 140);
    g.addColorStop(0, '#8fc8e8'); g.addColorStop(1, '#d8ecf4');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 360, 140);               // 空
    // ガラスの塔（画面中央奥・そびえる）
    p(110, 0, 140, 140, '#9ec6dc');
    for (let x = 116; x < 244; x += 18) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x, 0, 3, 140); }
    for (let y = 10; y < 140; y += 16) { ctx.fillStyle = 'rgba(70,110,140,.25)'; ctx.fillRect(110, y, 140, 2); }
    p(150, 8, 60, 18, '#2c5a80'); ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('蒼天SPA', 180, 21);
    p(140, 108, 80, 32, '#4a7a9a'); p(150, 114, 60, 26, '#d8ecf4');  // エントランス
    p(0, 140, 360, 60, '#9a9aa2');                                   // 石畳
    for (let x = 0; x < 360; x += 40) { ctx.fillStyle = 'rgba(0,0,0,.10)'; ctx.fillRect(x, 140, 1, 60); }
    ctx.fillStyle = 'rgba(0,0,0,.10)'; ctx.fillRect(0, 168, 360, 1);
    this.figStand(ctx, 120, 190, 'hero', 1);
    this.figStand(ctx, 240, 190, 'reina', -1);
  },

  /* ── 作戦会議（特別映像②）：夜の脱衣所、湯呑み三つの卓を囲む3人 */
  kaigi(ctx) {
    const p = this.px.bind(this, ctx);
    this.datsuiNight(ctx);
    this.figStand(ctx, 90, 164, 'tadokoro', 1);
    this.figStand(ctx, 180, 152, 'hero', 1);
    this.figStand(ctx, 268, 164, 'kuroda', -1);
    // 卓と湯呑み三つ（手前）
    p(126, 168, 110, 22, '#c9a86a'); p(126, 168, 110, 4, '#e0c288');
    p(122, 186, 8, 10, '#8a6a48'); p(232, 186, 8, 10, '#8a6a48');
    for (const tx of [146, 178, 210]) { p(tx, 172, 10, 8, '#e8e0cc'); p(tx + 1, 171, 8, 2, '#7a9a6a'); }
    // 黒田の資料（卓の端）
    p(222, 173, 12, 8, '#e8e2d6'); ctx.strokeStyle = '#888'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(224, 176); ctx.lineTo(232, 176); ctx.moveTo(224, 178); ctx.lineTo(232, 178); ctx.stroke();
  },

  /* ── 熱波師、夕凪湯へ（特別映像③）：夜の脱衣所に黒田と熱波師 */
  nappaCome(ctx) {
    this.datsuiNight(ctx);
    this.figStand(ctx, 96, 168, 'hero', 1);
    this.figStand(ctx, 200, 166, 'nappa', -1);
    this.figStand(ctx, 286, 168, 'kuroda', -1);
  },

  // 投票対決：夕凪湯（あたたかい・小）vs 蒼天SPA（冷たいガラス・大）。報道バナー・群衆・綱引き票バー。
  // 票数は window.DUEL = {yu, so, t0} をアートが読み、カウントアップ＆バーが最終比率へイージング（アニメ）。
  duel(ctx) {
    const p = this.px.bind(this, ctx);
    const D = (typeof window !== 'undefined' && window.DUEL) || { yu: 0, so: 0, t0: Date.now() };
    const t = Date.now() / 1000;
    // 会場の暗がり
    const g = ctx.createLinearGradient(0, 0, 0, 200);
    g.addColorStop(0, '#20222e'); g.addColorStop(1, '#2c2e3b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 360, 200);
    // 上部：報道バナー（テレビ・新聞）
    p(0, 0, 360, 22, D.mid ? '#1a5a8a' : '#b1122a'); p(0, 22, 360, 2, D.mid ? '#0e3f63' : '#7d0d1e');
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(D.mid ? '📺 中間発表 ―― 大接戦！' : '🗳 サウナ天下分け目 投票対決 🗳', 180, 15);
    // スポットライト（点滅）
    const sp = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.fillStyle = `rgba(255,244,200,${0.08 + 0.10 * sp})`;
    ctx.beginPath(); ctx.moveTo(180, 24); ctx.lineTo(120, 122); ctx.lineTo(240, 122); ctx.closePath(); ctx.fill();
    // 左：夕凪湯（小さく・あたたかい）
    const yx = 26, yy = 60;
    p(yx, yy, 84, 70, '#8a5a34'); p(yx - 6, yy - 10, 96, 14, '#5a3b22');   // 壁・屋根
    p(yx + 10, yy + 16, 20, 16, '#ffcf8a'); p(yx + 54, yy + 16, 20, 16, '#ffcf8a'); // 灯る窓
    p(yx + 30, yy + 44, 24, 20, '#1f3a6b');                                 // 暖簾
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.fillText('ゆ', yx + 42, yy + 60);
    for (let i = 0; i < 3; i++) { const ph = (t * 0.5 + i * 0.4) % 1; ctx.fillStyle = `rgba(255,236,205,${0.5 * (1 - ph)})`; ctx.fillRect(yx + 20 + i * 24, yy - 12 - ph * 20, 6, 6); } // 湯気
    // 右：蒼天SPA（高く・冷たいガラス）
    const sx = 250, sy = 34;
    p(sx, sy, 84, 96, '#3a5a86'); p(sx, sy, 84, 6, '#557aa8');
    for (let ry = 0; ry < 7; ry++) for (let cx = 0; cx < 4; cx++) {
      const lit = ((ry + cx + Math.floor(t * 2)) % 3 === 0);
      p(sx + 8 + cx * 18, sy + 12 + ry * 12, 12, 8, lit ? '#e8f6ff' : '#9fc4e6');
    }
    // 中央 VS
    ctx.fillStyle = '#ffd76a'; ctx.font = 'bold 26px sans-serif'; ctx.fillText('対', 180, 100);
    // 群衆（下・揺れる）
    for (let i = 0; i < 18; i++) { const cxp = 8 + i * 20, bob = Math.sin(t * 2 + i) * 1.5; ctx.fillStyle = '#12141d'; ctx.beginPath(); ctx.arc(cxp, 150 + bob, 4, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(cxp - 4, 152 + bob, 8, 10); }
    // 投票ボード（綱引きバー＋カウントアップ）
    const prog = Math.min(1, (Date.now() - D.t0) / 2200), eased = 1 - Math.pow(1 - prog, 3);
    const yu = Math.round(D.yu * eased), so = Math.round(D.so * eased);
    const finalR = D.yu / Math.max(1, D.yu + D.so), ratio = 0.5 + (finalR - 0.5) * eased;
    const bx = 18, by = 172, bw = 324, bh = 18, mid = Math.round(bw * ratio);
    p(bx, by, mid, bh, '#f0a94e');                 // 夕凪（琥珀）
    p(bx + mid, by, bw - mid, bh, '#4f8fd6');       // 蒼天（青）
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh);
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left'; ctx.fillStyle = '#ffd9a0'; ctx.fillText('夕凪 ' + yu, bx + 2, by - 4);
    ctx.textAlign = 'right'; ctx.fillStyle = '#bfe0ff'; ctx.fillText(so + ' 蒼天', bx + bw - 2, by - 4);
    ctx.textAlign = 'center';
  },
};

// 湯気や水面を動かしたい“動く一枚絵”（このキーの間だけ再描画ループを回す）
const STORY_ANIM_ARTS = new Set(['souten', 'soutenBldg', 'soutenBath', 'bathTadokoro', 'bathKuroda', 'bathKito', 'duel', 'grave']);

const Story = {
  queue: [], sceneIdx: 0, lineIdx: 0, typing: false, typeTimer: null, onEnd: null, artTimer: null,

  el: {},
  init() {
    this.el.root = document.getElementById('story');
    this.el.art = document.getElementById('storyArt');
    this.el.sp = document.getElementById('storySpeaker');
    this.el.text = document.getElementById('storyText');
    this.el.root.addEventListener('pointerdown', () => this.advance());
  },

  play(scenes, onEnd) {
    this.queue = scenes; this.sceneIdx = 0; this.lineIdx = 0; this.onEnd = onEnd;
    this.el.root.classList.remove('hidden');
    Sfx.bgmStop();                // 会話シーンはBGMなし（作者指定）。エンディングだけは呼び出し側が直後に上書きする
    this.showLine();
  },

  cur() { return this.queue[this.sceneIdx]; },

  // 動く一枚絵のとき、現在シーンの絵を一定間隔で再描画（湯気・水面が動く）
  setArtAnim(key) {
    clearInterval(this.artTimer); this.artTimer = null;
    if (!STORY_ANIM_ARTS.has(key)) return;
    const ctx = this.el.art.getContext('2d');
    this.artTimer = setInterval(() => {
      if (this.el.root.classList.contains('hidden')) { clearInterval(this.artTimer); this.artTimer = null; return; }
      StoryArt.draw(ctx, key);
    }, 80);
  },

  showLine() {
    const scene = this.cur();
    StoryArt.draw(this.el.art.getContext('2d'), scene.art);
    this.setArtAnim(scene.art);
    const line = scene.lines[this.lineIdx];
    this.el.sp.textContent = line.narr ? '' : line.sp;
    this.el.text.classList.toggle('narr', !!line.narr);
    // タイプライター
    clearInterval(this.typeTimer);
    this.typing = true;
    let i = 0;
    this.el.text.textContent = '';
    this.typeTimer = setInterval(() => {
      i++;
      this.el.text.textContent = line.text.slice(0, i);
      if (i % 3 === 1) Sfx.play('talk');     // 1文字ずつではうるさいので3文字に1回＝「ピピピピ」
      if (i >= line.text.length) { clearInterval(this.typeTimer); this.typing = false; }
    }, 28);
  },

  advance() {
    if (this.sceneIdx >= this.queue.length) return;
    const line = this.cur().lines[this.lineIdx];
    if (this.typing) {                      // 表示中なら全文表示
      clearInterval(this.typeTimer); this.typing = false;
      this.el.text.textContent = line.text;
      return;
    }
    this.lineIdx++;
    if (this.lineIdx >= this.cur().lines.length) {
      this.sceneIdx++; this.lineIdx = 0;
      if (this.sceneIdx >= this.queue.length) {
        this.el.root.classList.add('hidden');
        clearInterval(this.artTimer); this.artTimer = null;
        if (this.onEnd) { const f = this.onEnd; this.onEnd = null; f(); }
        return;
      }
    }
    this.showLine();
  },
};
