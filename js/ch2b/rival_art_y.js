'use strict';

/* ============================================================
   ライバル5軒の館内図（第2章「ととのい市編」）
   ------------------------------------------------------------
   第1章の蒼天SPA（story.js の souten）と同じ作り＝**360×200の見下ろし一枚絵**を
   コードで描く。休みの日に他店へ行くと、この絵が出る。

   **絵は数字の説明図でもある。**（CHAPTER2_B.md §7-3）
     SAUNA GATE 37  … サウナは巨大だが**水風呂が一槽だけ**（行列を描く）
     ととのいの森  … 何でもあるが**サウナが一室だけ**（マンガの壁が主役）
     茶煙楼… 設備は一級だが**厨房が無い**（空いた床を描く）
     月白 SPA TERRACE… 露天は豪華だが**休憩の椅子が足りない**（満席を描く）
     松乃湯    … 昭和の銭湯。**掃除が行き届いていない**（汚れを描く）

   ※店名・人物・台詞はすべて架空。実在施設は「そういう強さの店がととのい市にある」
     という設計の借用にとどめる
   ============================================================ */

(function () {
  const P = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const T = () => Date.now() / 1000;

  /* ── 共通の部品 ───────────────────────────────── */
  // 湯気（立ちのぼって消える）
  function wisp(ctx, x, y, n, a) {
    const t = T();
    for (let i = 0; i < n; i++) {
      const seed = x * 0.7 + i * 13, rise = (t * 9 + seed * 5) % 15, sway = Math.sin(t * 2 + seed) * 2;
      ctx.fillStyle = `rgba(255,255,255,${(a * (1 - rise / 15)).toFixed(3)})`;
      ctx.fillRect(Math.round(x + i * 5 + sway), Math.round(y - rise), 3, 5);
    }
  }
  // 水面のさざ波
  function ripple(ctx, x, y, w, col) {
    const t = T();
    ctx.strokeStyle = col || 'rgba(255,255,255,.38)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= w; i += 3) {
      const yy = y + Math.sin(i * 0.3 + t * 3 + x * 0.2) * 1.4;
      i === 0 ? ctx.moveTo(x + i, yy) : ctx.lineTo(x + i, yy);
    }
    ctx.stroke();
  }
  // 枠のある区画（石／タイル／レンガ／大理石）
  function frame(ctx, x, y, w, h, inner, edge) {
    P(ctx, x - 1, y - 1, w + 2, h + 2, '#211a13');
    P(ctx, x, y, w, h, edge || '#6b6155');
    P(ctx, x + 3, y + 3, w - 6, h - 6, inner);
  }
  // 湯船
  function basin(ctx, x, y, w, h, inner, style) {
    frame(ctx, x, y, w, h, inner);
    const ix = x + 3, iy = y + 3, iw = w - 6, ih = h - 6, t = T();
    ripple(ctx, ix + 2, iy + ih * 0.4, iw - 4);
    if (ih > 20) ripple(ctx, ix + 2, iy + ih * 0.74, iw - 4);
    wisp(ctx, ix + 4, iy + 5, 2, .22);
    if (style === 'jet') {
      for (let i = 0; i < Math.floor(iw / 9); i++) {
        const off = (t * 18 + i * 5) % Math.max(1, ih - 4);
        P(ctx, ix + 4 + i * 9, Math.round(iy + ih - 3 - off), 2, 4, 'rgba(255,255,255,.5)');
      }
    } else if (style === 'electric') {
      for (let i = 0; i < 5; i++) {
        const pu = 0.4 + 0.5 * Math.sin(t * 5 + i * 1.3);
        P(ctx, Math.round(ix + 5 + i * ((iw - 8) / 4)), iy + Math.round(ih / 2) - 1, 3, 3,
          `rgba(180,220,255,${pu.toFixed(2)})`);
      }
    } else if (style === 'soda') {   // 炭酸泉＝細かい泡が上がる
      const span = Math.max(1, ih - 6);
      for (let i = 0; i < Math.floor(iw / 8); i++) {
        const rise = (t * 10 + i * 11) % span, al = .55 * (1 - rise / span);
        P(ctx, Math.round(ix + 5 + i * 8), Math.round(iy + ih - 3 - rise), 2, 2, `rgba(255,255,255,${al.toFixed(3)})`);
      }
    } else if (style === 'lie') {    // 寝湯＝仕切りと寝ている人
      ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1;
      const n = Math.max(1, Math.floor(iw / 15));
      for (let i = 1; i < n; i++) { ctx.beginPath(); ctx.moveTo(ix + i * 15, iy); ctx.lineTo(ix + i * 15, iy + ih); ctx.stroke(); }
      ctx.fillStyle = 'rgba(40,60,80,.45)';
      for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.ellipse(ix + 7 + i * 15, iy + ih / 2, 4, 2, 0, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  // 水風呂
  function plunge(ctx, x, y, w, h, inner) {
    frame(ctx, x, y, w, h, inner || '#5fb6e0');
    const ix = x + 3, iy = y + 3, iw = w - 6, ih = h - 6;
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1;
    ctx.strokeRect(ix + 1, iy + 1, iw - 2, ih - 2);
    ripple(ctx, ix + 2, iy + ih * 0.5, iw - 4);
  }
  // サウナ室（ひな壇と熱源）。kind で照明と石の色が変わる
  function sauna(ctx, x, y, w, h, kind, seats) {
    const inner = { hot: '#5a2c22', wood: '#7a5330', dark: '#2e2620', steam: '#3a5250',
                    tea: '#3c5236', gold: '#8a5a2a', showa: '#6a4a2c' }[kind] || '#5a3a24';
    frame(ctx, x, y, w, h, inner, '#3a2a1c');
    const ix = x + 3, iy = y + 3, iw = w - 6, ih = h - 6, t = T();
    // ひな壇（板の段）
    ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 1;
    for (let ly = iy + 7; ly < iy + ih - 2; ly += 7) {
      ctx.beginPath(); ctx.moveTo(ix, ly); ctx.lineTo(ix + iw, ly); ctx.stroke();
    }
    // 熱源（ストーブ）
    const sx = ix + iw / 2, sy = iy + ih - 8;
    P(ctx, sx - 5, sy - 5, 10, 10, '#241812');
    const glow = kind === 'steam' ? '#9fe0d8' : kind === 'tea' ? '#9fd47a' : '#ff8a3a';
    ctx.fillStyle = glow;
    for (let i = 0; i < 4; i++) P(ctx, sx - 4 + (i % 2) * 4, sy - 4 + Math.floor(i / 2) * 4, 3, 3, glow);
    ctx.fillStyle = `rgba(255,140,50,${(0.16 + 0.1 * Math.sin(t * 5)).toFixed(2)})`;
    ctx.beginPath(); ctx.arc(sx, sy, 11, 0, Math.PI * 2); ctx.fill();
    wisp(ctx, sx - 5, sy - 9, 3, kind === 'steam' || kind === 'tea' ? .5 : .3);
    // 座っている人（席数のぶん、点で並べる）
    if (seats) {
      ctx.fillStyle = 'rgba(240,210,170,.85)';
      const cols = Math.min(seats, Math.max(2, Math.floor((iw - 6) / 6)));
      const rows = Math.ceil(seats / cols);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        if (r * cols + c >= seats) break;
        ctx.fillRect(ix + 3 + c * 6, iy + 3 + r * 7, 3, 4);
      }
    }
  }
  // ととのいイス（1脚）
  function chair(ctx, x, y, occupied) {
    P(ctx, x, y, 7, 9, '#c8b48a'); P(ctx, x, y, 7, 3, '#a8916a');
    if (occupied) { P(ctx, x + 1, y + 2, 5, 6, '#e8c39a'); P(ctx, x + 1, y + 1, 5, 2, '#3b2d24'); }
  }
  // 寝椅子（フルフラット）
  function lounger(ctx, x, y, occupied) {
    P(ctx, x, y, 16, 7, '#b58a54'); P(ctx, x, y, 4, 7, '#8a6238');
    ctx.strokeStyle = 'rgba(50,34,16,.5)'; ctx.lineWidth = 1; ctx.strokeRect(x, y, 16, 7);
    if (occupied) { ctx.fillStyle = 'rgba(240,215,180,.9)'; ctx.beginPath(); ctx.ellipse(x + 9, y + 3.5, 5, 2.4, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  // カラン（洗い場）1つ
  function karan(ctx, x, y) {
    P(ctx, x, y, 6, 8, '#cfd6dc'); P(ctx, x + 1, y + 1, 4, 3, '#9fb4c4'); P(ctx, x + 2, y + 5, 2, 2, '#7a8a96');
  }
  function karanRow(ctx, x, y, n, gap) {
    for (let i = 0; i < n; i++) karan(ctx, x + i * (gap || 8), y);
  }
  // 観葉植物
  function plant(ctx, x, y) {
    P(ctx, x, y, 4, 4, '#33502c'); P(ctx, x + 2, y - 2, 3, 3, '#4a6a38'); P(ctx, x - 1, y + 1, 3, 3, '#3c5a30');
  }
  // 人（立っている・並んでいる）
  function person(ctx, x, y, col) {
    P(ctx, x, y, 5, 7, col || '#5a6b8a'); P(ctx, x, y - 4, 5, 4, '#e8c39a'); P(ctx, x, y - 5, 5, 2, '#3b2d24');
  }
  // 部屋の名札
  function label(ctx, x, y, text, col) {
    ctx.font = '7px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    const w = ctx.measureText(text).width + 6;
    ctx.fillRect(x - w / 2, y - 7, w, 9);
    ctx.fillStyle = col || '#f5ead8'; ctx.fillText(text, x, y);
    ctx.textAlign = 'left';
  }
  // 夜景の見える窓（横に長い）
  function nightWindow(ctx, x, y, w, h) {
    P(ctx, x, y, w, h, '#0b1020');
    for (let i = 0; i < Math.floor(w / 7); i++) {
      const bh = 6 + ((i * 37) % 14);
      P(ctx, x + 2 + i * 7, y + h - bh, 5, bh, i % 3 ? '#1a2440' : '#22304e');
      for (let k = 0; k < 3; k++) {
        if (((i * 7 + k * 13) % 5) < 2) P(ctx, x + 3 + i * 7, y + h - bh + 2 + k * 4, 2, 2, '#ffd98a');
      }
    }
    ctx.strokeStyle = '#3a4a66'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  }
  // 床（種類ごとの地）
  function floorBase(ctx, col, gridCol, gap) {
    P(ctx, 0, 0, 360, 200, col);
    ctx.strokeStyle = gridCol; ctx.lineWidth = 1;
    const g = gap || 15;
    for (let x = 0; x < 360; x += g) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 200); ctx.stroke(); }
    for (let y = 0; y < 200; y += g) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); }
    ctx.strokeStyle = '#201810'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 356, 196);
  }
  // レンガの床・壁（ハマサウナ）
  function brickBase(ctx) {
    P(ctx, 0, 0, 360, 200, '#8a5a48');
    ctx.strokeStyle = 'rgba(40,20,14,.35)'; ctx.lineWidth = 1;
    for (let y = 0; y < 200; y += 9) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke();
      for (let x = (y / 9) % 2 ? 0 : 11; x < 360; x += 22) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 9); ctx.stroke();
      }
    }
    ctx.strokeStyle = '#2a1610'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 356, 196);
  }

  // 部屋の見出し（左上）
  function head(ctx, text, sub, col, bottom) {
    const y0 = bottom ? 170 : 6;
    ctx.font = 'bold 8px "DotGothic16",sans-serif'; ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(6, y0, ctx.measureText(text).width + 8, 12);
    ctx.fillStyle = col || '#ffd98a'; ctx.fillText(text, 10, y0 + 9);
    if (sub) {
      ctx.font = '7px "DotGothic16",sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.fillRect(6, y0 + 13, ctx.measureText(sub).width + 8, 11);
      ctx.fillStyle = '#d8c6a8'; ctx.fillText(sub, 10, y0 + 21);
    }
  }

  /* ══════════════════════════════════════════════════════
     SAUNA GATE 37 ── 浴室（八角形の檜の湯）
     ------------------------------------------------------------
     台本「八角形の檜の湯。十六度の水風呂。——欲しいものが、全部ここにある」。
     一枚一設備＝**八角の湯だけ**を正面から。窓の外は夜のととのい湾
     ══════════════════════════════════════════════════════ */
  function y_tenku_bath(ctx) {
    const t = T();

    /* 天井（濃い木・オレンジの間接光） */
    P(ctx, 0, 0, 360, 24, '#33261a');
    P(ctx, 0, 0, 360, 5, '#443324');
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(i * 44, 0); ctx.lineTo(i * 44 + 10, 24); ctx.stroke(); }
    P(ctx, 70, 22, 220, 3, `rgba(255,190,110,${(0.55 + 0.1 * Math.sin(t)).toFixed(2)})`);

    /* 奥：一面の窓＝夜のととのい湾（十四階の特権） */
    P(ctx, 0, 24, 360, 86, '#0c1424');
    for (let i = 0; i < 26; i++) {
      const h = Math.sin(i * 12.9898) * 43758.5453, h2 = Math.sin(i * 78.233) * 12345.678;
      P(ctx, Math.floor((h - Math.floor(h)) * 360), 28 + Math.floor((h2 - Math.floor(h2)) * 30), 1, 1,
        `rgba(220,230,255,${(0.16 + 0.28 * Math.abs(Math.sin(t + i))).toFixed(2)})`);
    }
    // 湾の対岸の灯りと、海に落ちる映り
    for (let i = 0; i < 20; i++) {
      const bx = i * 19 + (i % 3) * 4;
      P(ctx, bx, 74 - ((i * 13) % 8), 10, 8 + ((i * 13) % 8), i % 2 ? '#16203a' : '#1b2542');
      if ((i % 3) < 2) P(ctx, bx + 3, 76, 2, 2, 'rgba(255,214,150,.6)');
    }
    P(ctx, 0, 84, 360, 26, '#0e1830');
    for (let i = 0; i < 12; i++)
      P(ctx, 12 + i * 30, 88 + (i % 3) * 5, 12, 1, `rgba(255,214,150,${(0.14 + 0.06 * Math.sin(t + i)).toFixed(2)})`);
    // 窓の桟
    ctx.strokeStyle = 'rgba(90,70,50,.8)'; ctx.lineWidth = 2;
    for (const wx of [90, 180, 270]) { ctx.beginPath(); ctx.moveTo(wx, 24); ctx.lineTo(wx, 110); ctx.stroke(); }
    ctx.strokeRect(0, 24, 360, 86);

    /* ── 八角形の檜の湯（画面中央・大きく）── */
    const CX2 = 180, CY2 = 152, RX = 150, RY = 44;
    const oct = (rx, ry) => {
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = Math.PI / 8 + k * Math.PI / 4;
        const px = CX2 + Math.cos(a) * rx, py = CY2 + Math.sin(a) * ry;
        k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
    };
    oct(RX + 10, RY + 12); ctx.fillStyle = '#6b4a2c'; ctx.fill();     // 檜の縁（外）
    oct(RX + 10, RY + 12); ctx.strokeStyle = '#8a6238'; ctx.lineWidth = 2; ctx.stroke();
    oct(RX + 2, RY + 5); ctx.fillStyle = '#4a3220'; ctx.fill();       // 縁の内側の影
    oct(RX - 4, RY - 1); ctx.fillStyle = '#3f7f8a'; ctx.fill();       // 湯
    ctx.save(); oct(RX - 4, RY - 1); ctx.clip();
    const wat = ctx.createLinearGradient(0, CY2 - RY, 0, CY2 + RY);
    wat.addColorStop(0, '#2e6a76'); wat.addColorStop(1, '#4a8a92');
    ctx.fillStyle = wat; ctx.fillRect(0, CY2 - RY, 360, RY * 2);
    ripple(ctx, CX2 - RX + 8, CY2 - 12, RX * 2 - 16, 'rgba(220,244,248,.34)');
    ripple(ctx, CX2 - RX + 8, CY2 + 6, RX * 2 - 16, 'rgba(220,244,248,.26)');
    ripple(ctx, CX2 - RX + 8, CY2 + 22, RX * 2 - 16, 'rgba(220,244,248,.16)');
    // 窓の夜景の映り
    for (let i = 0; i < 8; i++)
      P(ctx, 40 + i * 38, CY2 - RY + 4 + (i % 2) * 4, 10, 2, `rgba(255,214,150,${(0.10 - i * 0.006).toFixed(3)})`);
    ctx.restore();
    wisp(ctx, CX2 - 90, CY2 - 26, 4, .42); wisp(ctx, CX2 + 10, CY2 - 30, 5, .5); wisp(ctx, CX2 + 80, CY2 - 24, 4, .40);

    /* 浸かる人（五人＝聖地はよく入っている。それでも湯は広い） */
    const soak = (x, y) => {
      P(ctx, x - 4, y + 7, 16, 3, 'rgba(230,248,250,.25)');
      P(ctx, x, y, 9, 8, '#f0cda6'); P(ctx, x, y - 2, 9, 4, '#3b2d24');
      P(ctx, x + 2, y + 3, 1, 1, '#5a4030'); P(ctx, x + 6, y + 3, 1, 1, '#5a4030');
    };
    soak(88, 138); soak(216, 136); soak(178, 168);
    /* 所作差（審査）：縁に両腕をかけてもたれる人／いま入りかけの人 */
    P(ctx, 148, 148, 9, 8, '#f0cda6'); P(ctx, 148, 146, 9, 4, '#3b2d24');
    P(ctx, 143, 144, 5, 3, '#f0cda6'); P(ctx, 157, 144, 5, 3, '#f0cda6');
    P(ctx, 262, 128, 10, 22, '#e0ac84');                            // 入りかけ（縁に立つ）
    P(ctx, 264, 118, 8, 10, '#f0cda6'); P(ctx, 264, 116, 8, 4, '#3b2d24');
    P(ctx, 263, 138, 9, 4, '#f2efe6');

    /* 手前の床（檜のデッキ） */
    P(ctx, 0, 190, 360, 10, '#4a3826');
    P(ctx, 0, 190, 360, 2, '#5f4a32');
    // 縁に桶と、たたんだタオル
    P(ctx, 24, 182, 16, 8, '#c8a56a'); P(ctx, 24, 182, 16, 3, '#e0bc80');
    P(ctx, 318, 184, 14, 4, '#f2efe6');
  }

  /* ══════════════════════════════════════════════════════
     SAUNA GATE 37 ── 食事処（一枚板のテーブル）
     ------------------------------------------------------------
     台本「長い一枚板のテーブルが中央を一本まっすぐに通っている。名物はチゲ鍋」
     ══════════════════════════════════════════════════════ */
  function y_tenku_meshi(ctx) {
    const t = T();

    /* 壁（濃い木・のれんと品書き） */
    P(ctx, 0, 0, 360, 200, '#3c2f22');
    P(ctx, 0, 0, 360, 18, '#2f2419');
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
    for (let x = 8; x < 360; x += 14) { ctx.beginPath(); ctx.moveTo(x, 18); ctx.lineTo(x, 110); ctx.stroke(); }
    /* 厨房ののれん（左）と湯気 */
    P(ctx, 22, 30, 74, 52, '#1e1610');
    for (const nx of [22, 47, 72]) {
      P(ctx, nx, 30, 24, 30, '#8a3030'); P(ctx, nx, 30, 24, 4, '#a84040');
    }
    ctx.font = '7px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#f5ead8'; ctx.fillText('サ飯', 59, 48);
    ctx.textAlign = 'left';
    wisp(ctx, 40, 78, 3, .40); wisp(ctx, 70, 80, 3, .36);
    /* 品書きの木札（右の壁一面） */
    for (let i = 0; i < 6; i++) {
      P(ctx, 150 + i * 32, 30, 24, 44, '#c8a56a'); P(ctx, 150 + i * 32, 30, 24, 3, '#e0bc80');
      ctx.fillStyle = 'rgba(60,36,16,.7)';
      for (let r = 0; r < 4; r++) P(ctx, 158 + i * 32, 38 + r * 8, 8, 3, 'rgba(60,36,16,.55)');
    }
    /* ととのい番付の額（イントロ場面5が指す小道具＝壁打ち3往復・INTRO_SCRIPT.md 4c）。
       王者が誇示する額。数字は読めなくてよい＝8行の帯で「八部門」を形で語る */
    P(ctx, 102, 30, 44, 46, '#8a6a3a'); P(ctx, 102, 30, 44, 2, '#a8854c');   // 額縁
    P(ctx, 105, 33, 38, 40, '#e8e0cc'); P(ctx, 105, 33, 38, 1, '#f4eee0');   // 紙
    ctx.font = '7px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#6a3020'; ctx.fillText('番付', 124, 41);
    ctx.textAlign = 'left';
    for (let r = 0; r < 8; r++) {                                            // 8部門の帯
      P(ctx, 108, 44 + r * 3.4, 20 - (r % 3) * 2, 2, 'rgba(60,40,24,.55)');
      P(ctx, 132, 44 + r * 3.4, 8, 2, 'rgba(138,48,48,.6)');                 // 点数の朱
    }
    /* 吊りの裸電球 */
    for (const lx of [90, 180, 270]) {
      P(ctx, lx, 0, 2, 22, '#181008');
      P(ctx, lx - 3, 22, 8, 8, '#ffce7a');
      ctx.fillStyle = `rgba(255,190,110,${(0.10 + 0.03 * Math.sin(t * 1.3 + lx)).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(lx + 1, 26, 30, 0, Math.PI * 2); ctx.fill();
    }

    /* 床 */
    P(ctx, 0, 110, 360, 90, '#241b12');
    ctx.strokeStyle = 'rgba(0,0,0,.4)';
    for (let y = 118; y < 200; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); }

    /* ── 一枚板のテーブル（画面を横一本）── */
    P(ctx, 8, 128, 344, 30, '#7a5230');
    P(ctx, 8, 128, 344, 5, '#9a6c40');
    // 木目（うねる線）
    ctx.strokeStyle = 'rgba(60,36,16,.4)'; ctx.lineWidth = 1;
    for (let r = 0; r < 3; r++) {
      ctx.beginPath();
      for (let x = 10; x < 350; x += 8)
        ctx.lineTo(x, 138 + r * 7 + Math.sin(x * 0.06 + r * 2) * 2);
      ctx.stroke();
    }
    P(ctx, 30, 158, 8, 20, '#3f2c1a'); P(ctx, 322, 158, 8, 20, '#3f2c1a');
    P(ctx, 172, 158, 8, 20, '#3f2c1a');

    /* 食べる人と料理（チゲ・ビール・定食が一列に） */
    const eater = (x, cloth, hair) => {
      P(ctx, x, 108, 15, 22, cloth);
      P(ctx, x + 3, 98, 9, 10, '#f0cda6'); P(ctx, x + 3, 96, 9, 4, hair || '#3b2d24');
    };
    eater(36, '#a86a4a'); eater(104, '#6b7a92', '#5a3a2c'); eater(188, '#7a6a5a');
    eater(252, '#5a7a6a', '#2c2420'); eater(304, '#8a5a6a');
    /* 名物のチゲ鍋＝画面中央で主役に（審査）。石鍋・赤い汁・強い湯気 */
    P(ctx, 164, 126, 32, 16, '#1c1410'); P(ctx, 166, 124, 28, 4, '#2c2018');
    P(ctx, 168, 128, 24, 6, '#c84a2e'); P(ctx, 170, 128, 8, 2, '#e86a3a');
    wisp(ctx, 170, 120, 4, .65); wisp(ctx, 184, 118, 3, .55);
    P(ctx, 158, 142, 44, 3, '#8a3030');                              // 敷き板
    /* 手前の小さいチゲ（各席にも） */
    P(ctx, 34, 132, 20, 11, '#1c1410'); P(ctx, 36, 132, 16, 4, '#c84a2e');
    wisp(ctx, 38, 128, 3, .5);
    /* 生ビール */
    P(ctx, 110, 130, 8, 13, '#e8b83a'); P(ctx, 110, 130, 8, 4, '#fdf3e0');
    /* 定食（盆・小鉢） */
    P(ctx, 182, 133, 26, 9, '#8a3030');
    P(ctx, 185, 135, 7, 5, '#e8e2d2'); P(ctx, 194, 135, 7, 5, '#7a8a5a'); P(ctx, 202, 136, 5, 4, '#2c2218');
    /* アイス（サウナ後の甘味） */
    P(ctx, 258, 133, 8, 8, '#e8e2d2'); P(ctx, 259, 130, 6, 4, '#d88aa0');
    P(ctx, 308, 131, 9, 11, '#c8a03a');
    wisp(ctx, 310, 128, 2, .3);
  }

  /* ══════════════════════════════════════════════════════
     SAUNA GATE 37 ── 休憩スペース（🌤55の現場）
     ------------------------------------------------------------
     台本「六十人が一斉に出てくる。椅子は全部埋まっていた。
           壁ぎわに、体を冷ましながら立っている人が並んでいる」。
     **穴を絵で見せる一枚。**椅子は全席埋まり、立ち待ちの列ができている
     ══════════════════════════════════════════════════════ */
  function y_tenku_rest(ctx) {
    const t = T();

    /* 壁と天井（オレンジの落ち着いた休憩室） */
    P(ctx, 0, 0, 360, 200, '#4a3a2c');
    P(ctx, 0, 0, 360, 20, '#3a2d20');
    P(ctx, 60, 18, 240, 3, `rgba(255,206,140,${(0.5 + 0.08 * Math.sin(t)).toFixed(2)})`);
    ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 1;
    for (let x = 10; x < 360; x += 12) { ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, 108); ctx.stroke(); }
    /* サウナ室の扉（右奥）。開いて、まさに人が出てくる */
    P(ctx, 296, 34, 52, 74, '#241812');
    P(ctx, 300, 38, 20, 70, '#180f0a');
    wisp(ctx, 304, 44, 4, .5); wisp(ctx, 316, 40, 3, .4);
    ctx.font = '7px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#ffce7a'; ctx.fillText('SAUNA', 322, 30);
    ctx.textAlign = 'left';
    // 出てきたばかりの人（扉の前・汗）
    person(ctx, 306, 100, '#c88a6a'); person(ctx, 318, 96, '#c8946a');

    /* 給水器と時計 */
    P(ctx, 20, 66, 18, 42, '#8a9298'); P(ctx, 23, 72, 12, 10, '#5fb6e0');
    ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.arc(120, 48, 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5a3f28'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(120, 48); ctx.lineTo(120, 40); ctx.moveTo(120, 48); ctx.lineTo(126, 50); ctx.stroke();

    /* 床 */
    P(ctx, 0, 108, 360, 92, '#3a2e22');
    ctx.strokeStyle = 'rgba(0,0,0,.3)';
    for (let y = 116; y < 200; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); }

    /* ── ととのい椅子の列＝**全席埋まっている** ── */
    for (let i = 0; i < 6; i++) {
      const x = 26 + i * 46, y = 124;
      P(ctx, x, y, 22, 26, '#c8b48a'); P(ctx, x, y, 22, 6, '#a8916a');   // 椅子
      P(ctx, x - 2, y + 26, 26, 3, '#8a744e');
      // 座っている人（もたれて目を閉じる）
      P(ctx, x + 3, y - 2, 16, 20, ['#c88a6a', '#b87a5a', '#c8946a', '#b8865a', '#c88a72', '#b8825a'][i]);
      P(ctx, x + 6, y - 12, 10, 11, '#f0cda6'); P(ctx, x + 6, y - 14, 10, 4, '#3b2d24');
      ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 8, y - 7); ctx.lineTo(x + 10, y - 7);
      ctx.moveTo(x + 12, y - 7); ctx.lineTo(x + 14, y - 7); ctx.stroke();
    }

    /* ── 手前：立ち待ちの列（座り客と同じ縮尺で大きく）── */
    const stand = (x, y, skin) => {
      P(ctx, x + 2, y + 24, 14, 3, 'rgba(0,0,0,.3)');        // 影
      P(ctx, x, y, 16, 25, skin);                            // 体（湯上がりの肌）
      P(ctx, x + 1, y + 10, 14, 6, '#f2efe6');               // 腰のタオル
      P(ctx, x + 3, y - 11, 10, 12, '#f0cda6');              // 顔
      P(ctx, x + 3, y - 13, 10, 4, '#3b2d24');
      P(ctx, x + 1, y - 1, 14, 3, '#e8e2d2');                // 首のタオル
    };
    const skins = ['#e0ac84', '#d8a078', '#e0b088', '#d8a684', '#e0aa7e'];
    for (let i = 0; i < 5; i++) stand(38 + i * 64 + (i % 2) * 8, 162, skins[i]);
  }

  /* ══════════════════════════════════════════════════════
     SAUNA GATE 37 ── カプセル（泊まれる聖地）
     ------------------------------------------------------------
     台本「疲れたらそのまま泊まれる。平日なら一泊五千円ほど。——強い。強すぎる」
     ══════════════════════════════════════════════════════ */
  function y_tenku_capsule(ctx) {
    const t = T();

    /* 暗い通路。カプセルの丸窓の灯りだけ */
    P(ctx, 0, 0, 360, 200, '#241c14');
    P(ctx, 0, 0, 360, 16, '#1b140e');
    /* 通路の誘導灯 */
    for (let i = 0; i < 5; i++)
      P(ctx, 30 + i * 72, 190, 4, 2, `rgba(255,206,140,${(0.4 + 0.2 * Math.sin(t * 2 + i)).toFixed(2)})`);

    /* カプセルの壁（2段×4列） */
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
      const x = 14 + c * 86, y = 26 + r * 76;
      P(ctx, x, y, 78, 68, '#3a3026');                       // 枠
      P(ctx, x, y, 78, 3, '#5a4c3a');
      P(ctx, x + 6, y + 8, 66, 54, '#181008');               // 開口
      // 丸い縁
      ctx.strokeStyle = '#6b583f'; ctx.lineWidth = 3;
      ctx.strokeRect(x + 6, y + 8, 66, 54);
      const occupied = (r * 4 + c) % 3 !== 2;
      if (occupied) {
        // 眠っている人（足元から。布団の起伏と読書灯）
        P(ctx, x + 10, y + 38, 58, 18, '#4a3f52');
        P(ctx, x + 14, y + 40, 20, 8, '#f0cda6');
        const on = ((r * 4 + c) % 4) === 0;
        if (on) {
          P(ctx, x + 58, y + 14, 6, 4, '#ffce7a');
          ctx.fillStyle = 'rgba(255,206,140,.08)';
          ctx.beginPath(); ctx.arc(x + 60, y + 20, 18, 0, Math.PI * 2); ctx.fill();
        }
      } else if ((r * 4 + c) === 2) {
        // 1室だけ「使っている最中」＝カーテン半開き・荷物・点いた読書灯（審査）
        P(ctx, x + 10, y + 38, 58, 18, '#4a3f52');
        P(ctx, x + 6, y + 8, 22, 54, '#3f5548');                    // 半開きのカーテン
        ctx.strokeStyle = 'rgba(10,20,14,.5)';
        for (let f2 = x + 10; f2 < x + 26; f2 += 5) {
          ctx.beginPath(); ctx.moveTo(f2, y + 8); ctx.lineTo(f2, y + 62); ctx.stroke();
        }
        P(ctx, x + 56, y + 12, 7, 5, '#ffce7a');
        ctx.fillStyle = 'rgba(255,206,140,.10)';
        ctx.beginPath(); ctx.arc(x + 58, y + 20, 18, 0, Math.PI * 2); ctx.fill();
        P(ctx, x + 34, y + 56, 18, 8, '#5a6b8a');                   // 置かれたバッグ
        P(ctx, x + 40, y + 54, 6, 3, '#3f4c66');
      } else {
        // 空室＝たたんだ布団と枕
        P(ctx, x + 12, y + 44, 26, 10, '#5a4c3a');
        P(ctx, x + 44, y + 46, 16, 8, '#d8d2c6');
      }
      // 号室札
      P(ctx, x + 30, y - 1, 18, 7, '#181008');
      ctx.font = '6px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = '#c8b48a'; ctx.fillText(String(1401 + r * 4 + c), x + 39, y + 5);
      ctx.textAlign = 'left';
    }
    /* はしご */
    for (let c = 0; c < 4; c++) {
      const x = 96 + c * 86;
      P(ctx, x - 4, 96, 3, 84, '#5a4c3a'); P(ctx, x + 3, 96, 3, 84, '#5a4c3a');
      for (let r2 = 0; r2 < 6; r2++) P(ctx, x - 4, 102 + r2 * 13, 10, 2, '#6b583f');
    }
    /* 手前：スリッパと、歩く客のシルエット */
    P(ctx, 150, 192, 10, 4, '#d8d2c6'); P(ctx, 163, 193, 10, 4, '#d8d2c6');
    ctx.fillStyle = 'rgba(10,7,4,.75)';
    P(ctx, 296, 150, 14, 42, 'rgba(10,7,4,.75)');
    ctx.beginPath(); ctx.arc(303, 144, 8, 0, Math.PI * 2); ctx.fill();
  }


  /* ══════════════════════════════════════════════════════
     ととのいの森 ── 外観（郊外・昼）
     ------------------------------------------------------------
     **森は「昼と緑」。**月白=夜の白、GATE37=夜のオレンジ、と描き分ける。
     雑木林を抱き込んだ低くて広い大箱。駐車場に家族の車。のぼり。
     ══════════════════════════════════════════════════════ */
  function y_rakuen_out(ctx) {
    const t = T();

    /* 昼の空と雲 */
    const sky = ctx.createLinearGradient(0, 0, 0, 130);
    sky.addColorStop(0, '#7db4dc'); sky.addColorStop(1, '#c3dcea');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 360, 200);
    for (let i = 0; i < 3; i++) {
      const cx = ((t * 3 + i * 140) % 480) - 60, cy = 22 + i * 18;
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.fillRect(cx, cy, 56 + i * 14, 8); ctx.fillRect(cx + 12, cy - 6, 34, 7);
    }

    /* 奥の雑木林（建物を抱く緑） */
    for (let i = 0; i < 30; i++) {
      const x = i * 13 - 6, hh = 26 + ((i * 37) % 18), y = 108 - hh;
      ctx.fillStyle = i % 2 ? '#4a7a44' : '#3f6e3c';
      ctx.beginPath(); ctx.arc(x + 7, y + 8, 11, 0, Math.PI * 2); ctx.fill();
      P(ctx, x + 5, y + 14, 4, hh - 10, '#5a4632');
    }
    /* 木々の間から屋根の湯気 */
    wisp(ctx, 120, 66, 4, .5); wisp(ctx, 230, 62, 4, .45);

    /* ── 本体：低くて広い大箱（ログ調・切妻屋根）── */
    const X = 52, W = 256, RY2 = 74, BASE = 148;
    // 屋根
    ctx.fillStyle = '#7a4a30';
    ctx.beginPath(); ctx.moveTo(X - 16, 102); ctx.lineTo(X + W / 2, RY2 - 12); ctx.lineTo(X + W + 16, 102); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8f5a3a';
    ctx.beginPath(); ctx.moveTo(X - 16, 102); ctx.lineTo(X + W / 2, RY2 - 8); ctx.lineTo(X + W + 16, 102);
    ctx.lineTo(X + W + 8, 102); ctx.lineTo(X + W / 2, RY2 - 2); ctx.lineTo(X - 8, 102); ctx.closePath(); ctx.fill();
    // 壁（ログ材の横縞）
    P(ctx, X, 102, W, BASE - 102, '#b98a58');
    ctx.strokeStyle = 'rgba(90,56,28,.35)'; ctx.lineWidth = 1;
    for (let y = 108; y < BASE; y += 7) { ctx.beginPath(); ctx.moveTo(X, y); ctx.lineTo(X + W, y); ctx.stroke(); }
    /* 大きな看板（屋根の上） */
    P(ctx, X + 74, 58, 108, 26, '#2e5a30'); P(ctx, X + 74, 58, 108, 3, '#4a7a44');
    ctx.font = 'bold 11px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#f5ead8'; ctx.fillText('ととのいの森', X + 128, 75);
    ctx.textAlign = 'left';
    /* 入口（ガラス・自動ドア）と、入っていく家族 */
    P(ctx, X + 96, 116, 62, 32, '#3a5a6a');
    P(ctx, X + 98, 118, 28, 30, 'rgba(200,230,240,.7)'); P(ctx, X + 128, 118, 28, 30, 'rgba(200,230,240,.7)');
    person(ctx, X + 104, 140, '#6a5a4a'); person(ctx, X + 114, 142, '#8a5a6a');
    P(ctx, X + 122, 134, 4, 8, '#5a7a6a'); P(ctx, X + 122, 130, 4, 4, '#f0cda6');   // 子ども
    /* 窓（家族の影） */
    for (let i = 0; i < 4; i++) {
      const wx = X + 12 + i * 22;
      P(ctx, wx, 112, 16, 20, 'rgba(255,244,214,.75)');
    }
    for (let i = 0; i < 4; i++) {
      const wx = X + 178 + i * 20;
      P(ctx, wx, 112, 14, 20, 'rgba(255,244,214,.75)');
    }
    /* のぼり（風で揺れる） */
    for (const fx of [X - 34, X + W + 20]) {
      P(ctx, fx, 96, 2, 52, '#5a4632');
      const sway = Math.sin(t * 2.4 + fx) * 2;
      P(ctx, fx + 2 + sway, 98, 12, 34, '#c84a2e');
      ctx.font = '7px "DotGothic16",sans-serif';
      ctx.fillStyle = '#fff'; ctx.fillText('湯', fx + 5 + sway, 112);
    }

    /* 手前：駐車場（家族の車が並ぶ） */
    P(ctx, 0, BASE, 360, 52, '#8a8578');
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1;
    for (let x = 20; x < 360; x += 52) { ctx.beginPath(); ctx.moveTo(x, BASE + 8); ctx.lineTo(x - 8, BASE + 44); ctx.stroke(); }
    const car = (x, col) => {
      P(ctx, x, BASE + 18, 38, 14, col); P(ctx, x + 6, BASE + 12, 24, 8, col);
      P(ctx, x + 8, BASE + 13, 9, 6, 'rgba(210,235,245,.8)'); P(ctx, x + 19, BASE + 13, 9, 6, 'rgba(210,235,245,.8)');
      P(ctx, x + 5, BASE + 30, 7, 5, '#222'); P(ctx, x + 27, BASE + 30, 7, 5, '#222');
    };
    car(30, '#b04a3a'); car(88, '#4a6a8a'); car(146, '#d8d2c6'); car(204, '#5a7a5a'); car(262, '#8a8060');
    /* 入口へ向かう親子（手を引く＝到着の導線。審査） */
    P(ctx, X + 34, BASE - 20, 13, 22, '#7a6a5a');
    P(ctx, X + 37, BASE - 29, 8, 9, '#f0cda6'); P(ctx, X + 37, BASE - 31, 8, 4, '#3b2d24');
    P(ctx, X + 47, BASE - 12, 8, 14, '#c85a3a');
    P(ctx, X + 49, BASE - 19, 6, 7, '#f0cda6'); P(ctx, X + 49, BASE - 21, 6, 3, '#4a3a2e');
    ctx.strokeStyle = '#e8c8a0'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X + 46, BASE - 12); ctx.lineTo(X + 49, BASE - 10); ctx.stroke();
    P(ctx, X + 28, BASE - 14, 8, 10, '#8a8060');                     // 荷物のバッグ
    /* ベビーカーを押す家族 */
    person(ctx, 320, BASE + 26, '#6a5a4a');
    P(ctx, 330, BASE + 28, 10, 7, '#8a5a6a'); P(ctx, 331, BASE + 35, 3, 3, '#333'); P(ctx, 336, BASE + 35, 3, 3, '#333');
  }

  /* ══════════════════════════════════════════════════════
     ととのいの森 ── 浴室（黄金色の天然温泉・窓の緑）
     ------------------------------------------------------------
     台本「湯は黄金色の天然温泉。窓いっぱいに緑が広がる」
     ══════════════════════════════════════════════════════ */
  function y_rakuen_bath(ctx) {
    const t = T();

    /* 天井（明るい梁） */
    P(ctx, 0, 0, 360, 22, '#8a6c48');
    P(ctx, 0, 0, 360, 5, '#a5845a');
    ctx.strokeStyle = 'rgba(60,40,20,.3)'; ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(i * 44, 0); ctx.lineTo(i * 44 + 10, 22); ctx.stroke(); }

    /* 奥：一面の窓＝昼の緑（これがこの店の風呂の主役） */
    P(ctx, 0, 22, 360, 92, '#bfe0ea');
    // 木々（近い緑を大きく）
    for (let i = 0; i < 16; i++) {
      const x = i * 24 - 8, hh = 30 + ((i * 41) % 22);
      ctx.fillStyle = ['#4a7a44', '#3f6e3c', '#568a4c'][i % 3];
      ctx.beginPath(); ctx.arc(x + 12, 96 - hh + 12, 15, 0, Math.PI * 2); ctx.fill();
      P(ctx, x + 10, 96 - hh + 22, 5, hh - 14, '#5a4632');
    }
    P(ctx, 0, 100, 360, 14, '#6e9a58');                        // 下草
    // 木漏れ日（ゆっくり揺れる）
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = `rgba(255,252,220,${(0.10 + 0.04 * Math.sin(t * 0.8 + i * 2)).toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(50 + i * 70 + Math.sin(t * 0.6 + i) * 4, 60 + (i % 2) * 20, 22, 12, 0, 0, Math.PI * 2); ctx.fill();
    }
    // 窓の桟
    ctx.strokeStyle = 'rgba(90,70,50,.85)'; ctx.lineWidth = 2;
    for (const wx of [72, 144, 216, 288]) { ctx.beginPath(); ctx.moveTo(wx, 22); ctx.lineTo(wx, 114); ctx.stroke(); }
    ctx.strokeRect(0, 22, 360, 92);

    /* ── 黄金色の湯（全幅）── */
    const BY = 122, BH = 54;
    P(ctx, 0, BY - 8, 360, 8, '#7a6a52');
    P(ctx, 0, BY - 8, 360, 2, '#96846a');
    const wat = ctx.createLinearGradient(0, BY, 0, BY + BH);
    wat.addColorStop(0, '#b8862e'); wat.addColorStop(1, '#d8a848');
    ctx.fillStyle = wat; ctx.fillRect(0, BY, 360, BH);
    ripple(ctx, 4, BY + 12, 352, 'rgba(255,240,190,.42)');
    ripple(ctx, 4, BY + 28, 352, 'rgba(255,240,190,.30)');
    ripple(ctx, 4, BY + 42, 352, 'rgba(255,240,190,.18)');
    wisp(ctx, 50, BY + 3, 4, .40); wisp(ctx, 160, BY + 1, 5, .48); wisp(ctx, 270, BY + 4, 4, .38);
    /* 湯に映る緑 */
    for (let i = 0; i < 6; i++)
      P(ctx, 20 + i * 60, BY + 4 + (i % 2) * 3, 26, 2, `rgba(110,154,88,${(0.16 - i * 0.01).toFixed(3)})`);

    /* 浸かる人（家族も・子どもも） */
    const soak = (x, y, hair) => {
      P(ctx, x - 4, y + 7, 16, 3, 'rgba(255,244,214,.26)');
      P(ctx, x, y, 9, 8, '#f0cda6'); P(ctx, x, y - 2, 9, 4, hair || '#3b2d24');
    };
    soak(60, BY + 14); soak(130, BY + 26, '#5a3a2c'); soak(240, BY + 12);
    /* 子どもと、隣で見守る親（審査：子連れ歓迎を具体に） */
    P(ctx, 160, BY + 30, 7, 6, '#f0cda6'); P(ctx, 160, BY + 28, 7, 3, '#4a3a2e');
    P(ctx, 146, BY + 22, 10, 9, '#f0cda6'); P(ctx, 146, BY + 20, 10, 4, '#3b2d24');
    P(ctx, 152, BY + 28, 8, 3, '#f0cda6');                            // 子へ伸ばした腕
    P(ctx, 176, BY + 33, 8, 5, '#f0c020'); P(ctx, 182, BY + 31, 4, 4, '#f0c020');
    P(ctx, 184, BY + 32, 2, 1, '#c84a2e');

    /* 手前の床 */
    P(ctx, 0, BY + BH, 360, 200 - BY - BH, '#8a7a62');
    P(ctx, 0, BY + BH, 360, 2, '#a5947a');
    P(ctx, 40, BY + BH + 8, 16, 8, '#c8a56a'); P(ctx, 40, BY + BH + 8, 16, 3, '#e0bc80');
  }

  /* ══════════════════════════════════════════════════════
     ととのいの森 ── サウナ（タイルの四角い部屋・オートロウリュ）
     ------------------------------------------------------------
     台本「奇をてらわない、まっすぐな熱だ」
     ══════════════════════════════════════════════════════ */
  function y_rakuen_sauna(ctx) {
    const t = T();

    /* タイル張りの壁（四角い部屋。装飾なし＝まっすぐ） */
    P(ctx, 0, 0, 360, 24, '#5a4a3a');
    P(ctx, 0, 24, 360, 118, '#8a7458');
    ctx.strokeStyle = 'rgba(50,36,22,.30)'; ctx.lineWidth = 1;
    for (let y = 24; y < 142; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); }
    for (let x = 0; x < 360; x += 20) { ctx.beginPath(); ctx.moveTo(x, 24); ctx.lineTo(x, 142); ctx.stroke(); }

    /* 中央：オートロウリュのストーブ（タワー型・タイマー付き） */
    P(ctx, 158, 66, 44, 76, '#3a332c');
    P(ctx, 158, 66, 44, 3, '#5a5248');
    for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++)
      P(ctx, 163 + c * 9, 74 + r * 12, 7, 8, (r + c) % 2 ? '#4c443a' : '#57493a');
    // 石の熱の照り
    ctx.fillStyle = `rgba(255,140,60,${(0.16 + 0.08 * Math.sin(t * 4)).toFixed(2)})`;
    ctx.beginPath(); ctx.arc(180, 100, 30, 0, Math.PI * 2); ctx.fill();
    /* オートロウリュ（一定周期で水が落ち、蒸気が立つ） */
    const phase = (t % 6) / 6;
    P(ctx, 168, 54, 24, 10, '#8a9298'); P(ctx, 168, 54, 24, 2, '#aab4ba');
    /* 作動中（審査＝「いま」を描く）：噴霧・弾ける蒸気・熱の波 */
    if (phase < 0.4) {
      for (let i = 0; i < 6; i++)
        P(ctx, 172 + i * 3, Math.round(64 + ((t * 70 + i * 4) % 14)), 2, 5, 'rgba(190,230,250,.75)');
      wisp(ctx, 160, 60, 6, .75); wisp(ctx, 182, 54, 5, .65); wisp(ctx, 196, 60, 4, .55);
      ctx.fillStyle = 'rgba(255,170,90,.10)';
      ctx.beginPath(); ctx.arc(180, 96, 58, 0, Math.PI * 2); ctx.fill();
      // 熱の波（横に走る細い線）
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = `rgba(255,220,170,${(0.22 - i * 0.06).toFixed(2)})`; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 40; x <= 320; x += 6)
          ctx.lineTo(x, 70 + i * 12 + Math.sin(x * 0.1 + t * 6) * 2);
        ctx.stroke();
      }
    } else {
      wisp(ctx, 172, 60, 3, .3);
    }
    /* ロウリュを浴びて目を閉じ、タオルで頭を守る客（両側の最前列） */
    ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 1;
    for (const rx of [46, 296]) {
      P(ctx, rx - 2, 92, 13, 4, '#f2efe6');                           // 頭のタオル
      ctx.beginPath(); ctx.moveTo(rx + 1, 100); ctx.lineTo(rx + 3, 100);
      ctx.moveTo(rx + 5, 100); ctx.lineTo(rx + 7, 100); ctx.stroke();
    }
    /* タイマー（60分計） */
    ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.arc(180, 42, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5a3f28'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(180, 42); ctx.lineTo(180 + Math.cos(t) * 6, 42 + Math.sin(t) * 6); ctx.stroke();

    /* 左右のひな壇（2段ずつ・タオルを敷いて座る客） */
    for (const side of [0, 1]) {
      const sx = side ? 232 : 8, w2 = 120;
      for (let r = 0; r < 2; r++) {
        const ry = 118 - r * 20;
        P(ctx, sx, ry, w2, 22, '#a5845a'); P(ctx, sx, ry, w2, 3, '#c09a68');
        P(ctx, sx, ry + 20, w2, 4, '#6b5236');
      }
    }
    const sit2 = (x, ry, cloth) => {
      P(ctx, x, ry - 14, 14, 15, cloth);
      P(ctx, x + 3, ry - 23, 9, 9, '#f0cda6'); P(ctx, x + 3, ry - 25, 9, 4, '#3b2d24');
    };
    sit2(30, 118, '#e0ac84'); sit2(78, 118, '#d8a078'); sit2(56, 98, '#e0b088');
    sit2(258, 118, '#d8a684'); sit2(306, 118, '#e0aa7e'); sit2(282, 98, '#d8a078');

    /* 床 */
    P(ctx, 0, 142, 360, 58, '#4c4038');
    ctx.strokeStyle = 'rgba(20,14,10,.4)';
    for (let y = 148; y < 200; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); }
    P(ctx, 0, 142, 360, 2, '#6a5c50');
    P(ctx, 130, 168, 100, 12, '#585046');
  }

  /* ══════════════════════════════════════════════════════
     ととのいの森 ── レストラン（キッズメニューまである）
     ------------------------------------------------------------
     台本「家族も、カップルも、サウナ客も、全部ここで満足させるつもりらしい」
     ══════════════════════════════════════════════════════ */
  function y_rakuen_meshi(ctx) {
    const t = T();

    /* 明るいホール */
    P(ctx, 0, 0, 360, 200, '#c9b490');
    P(ctx, 0, 0, 360, 16, '#a5946e');
    /* 大きな窓（緑） */
    for (const wx of [20, 250]) {
      P(ctx, wx, 26, 90, 56, '#bfe0ea');
      ctx.fillStyle = '#4a7a44';
      ctx.beginPath(); ctx.arc(wx + 22, 66, 14, 0, Math.PI * 2); ctx.arc(wx + 56, 60, 17, 0, Math.PI * 2);
      ctx.arc(wx + 80, 68, 12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#8a7458'; ctx.lineWidth = 3; ctx.strokeRect(wx, 26, 90, 56);
    }
    /* メニューの垂れ幕（限定コラボ） */
    P(ctx, 140, 22, 80, 48, '#e8e2d2'); P(ctx, 140, 22, 80, 4, '#c84a2e');
    ctx.font = '7px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#c84a2e'; ctx.fillText('期間限定', 180, 38);
    ctx.fillStyle = '#5a4028'; ctx.fillText('コラボメニュー', 180, 50);
    ctx.fillStyle = '#8a8060'; ctx.fillText('キッズあり', 180, 62);
    ctx.textAlign = 'left';

    /* 床 */
    P(ctx, 0, 96, 360, 104, '#b09a72');
    ctx.strokeStyle = 'rgba(90,64,36,.2)'; ctx.lineWidth = 1;
    for (let y = 104; y < 200; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); }

    /* ファミリーテーブル（円卓・子ども椅子） */
    const round = (x, y, r2) => {
      ctx.fillStyle = '#8a6c48'; ctx.beginPath(); ctx.ellipse(x, y, r2, r2 * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a5845a'; ctx.beginPath(); ctx.ellipse(x, y - 2, r2, r2 * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    };
    const diner2 = (x, y, cloth, hair, small) => {
      const s2 = small ? 0.72 : 1;
      P(ctx, x, y - 12 * s2, 14 * s2, 14 * s2, cloth);
      P(ctx, x + 3 * s2, y - 21 * s2, 9 * s2, 9 * s2, '#f0cda6');
      P(ctx, x + 3 * s2, y - 23 * s2, 9 * s2, 4 * s2, hair || '#3b2d24');
    };
    /* 家族の円卓＝三世代4人（審査）。祖父・父・母・子 */
    round(84, 138, 44);
    diner2(48, 132, '#7a6a5a'); diner2(104, 130, '#8a5a6a', '#5a3a2c'); diner2(80, 150, '#c84a2e', '#4a3a2e', true);
    diner2(66, 120, '#6a6a5a', '#8a8578');                            // 祖父（白髪）
    P(ctx, 74, 130, 14, 8, '#e8e2d2'); P(ctx, 76, 130, 10, 3, '#c89448'); wisp(ctx, 78, 127, 2, .4);
    P(ctx, 96, 142, 10, 6, '#e8e2d2'); P(ctx, 98, 141, 6, 3, '#d88aa0');
    /* カップルの円卓 */
    round(240, 128, 36);
    diner2(214, 122, '#6b7a92'); diner2(252, 120, '#b8869a', '#5a3a2c');
    P(ctx, 232, 120, 8, 10, '#e8b83a'); P(ctx, 232, 120, 8, 3, '#fdf3e0');
    /* ソフトクリームを運ぶ子ども（走る） */
    const runx = ((t * 26) % 420) - 30;
    P(ctx, runx, 172, 10, 12, '#5a7a6a');
    P(ctx, runx + 2, 164, 7, 8, '#f0cda6'); P(ctx, runx + 2, 162, 7, 3, '#3b2d24');
    P(ctx, runx + 10, 162, 4, 8, '#fdf3e0'); P(ctx, runx + 10, 158, 4, 5, '#f5ead8');
    /* 店員（お盆） */
    P(ctx, 316, 150, 13, 20, '#4a6a50');
    P(ctx, 319, 141, 8, 9, '#f0cda6'); P(ctx, 319, 139, 8, 4, '#2c2420');
    P(ctx, 308, 154, 9, 3, '#e8e2d2');
  }

  /* ══════════════════════════════════════════════════════
     ととのいの森 ── ビーズクッションの間
     ------------------------------------------------------------
     台本「そこら中にビーズクッションが転がっている。奥の窓の向こうには、林」
     ══════════════════════════════════════════════════════ */
  function y_rakuen_beads(ctx) {
    const t = T();

    /* 落ち着いた壁と、林の見える窓 */
    P(ctx, 0, 0, 360, 200, '#8a7a62');
    P(ctx, 0, 0, 360, 16, '#6e6250');
    P(ctx, 96, 26, 168, 62, '#a8ccd8');
    ctx.fillStyle = '#4a7a44';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath(); ctx.arc(110 + i * 28, 72 - ((i * 17) % 14), 13, 0, Math.PI * 2); ctx.fill();
    }
    P(ctx, 96, 78, 168, 10, '#6e9a58');
    ctx.strokeStyle = '#6e6250'; ctx.lineWidth = 3; ctx.strokeRect(96, 26, 168, 62);
    ctx.beginPath(); ctx.moveTo(180, 26); ctx.lineTo(180, 88); ctx.stroke();

    /* 床（明るいカーペット） */
    P(ctx, 0, 100, 360, 100, '#b09a78');
    ctx.fillStyle = 'rgba(90,64,36,.12)';
    for (let y = 104; y < 200; y += 8) for (let x = (y % 16) ? 0 : 4; x < 360; x += 8) ctx.fillRect(x, y, 4, 4);

    /* ビーズクッション（色とりどり・転がっている） */
    const bean = (x, y, w2, col, lit) => {
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, w2, w2 * 0.62, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = lit; ctx.beginPath(); ctx.ellipse(x - w2 * 0.2, y - w2 * 0.24, w2 * 0.55, w2 * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    };
    bean(52, 128, 24, '#7a5a6a', '#8f6e80');
    bean(300, 122, 22, '#5a7a6a', '#6e8f7e');
    bean(126, 158, 28, '#6b7a92', '#8092aa');
    bean(240, 166, 30, '#b08a4a', '#c8a05e');
    bean(38, 180, 22, '#8a6a5a', '#a08070');
    /* 沈んでいる人（クッションに埋まる） */
    const sink2 = (x, y, cloth, hair) => {
      P(ctx, x, y - 8, 16, 12, cloth);
      P(ctx, x + 4, y - 17, 10, 10, '#f0cda6'); P(ctx, x + 4, y - 19, 10, 4, hair);
      ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 6, y - 12); ctx.lineTo(x + 8, y - 12);
      ctx.moveTo(x + 10, y - 12); ctx.lineTo(x + 12, y - 12); ctx.stroke();
    };
    sink2(118, 152, '#c8beb0', '#3b2d24');
    sink2(232, 158, '#b8c2cc', '#5a3a2c');
    /* 完全に沈み込んでうたた寝する人（審査＝逃げ場を身体感覚に） */
    P(ctx, 286, 112, 30, 10, '#c2b4a4');                              // だらっと横たわる体
    P(ctx, 278, 112, 10, 10, '#f0cda6'); P(ctx, 278, 110, 10, 4, '#4a3a2e');
    ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 1;                   // 閉じた目
    ctx.beginPath(); ctx.moveTo(280, 116); ctx.lineTo(282, 116);
    ctx.moveTo(284, 116); ctx.lineTo(286, 116); ctx.stroke();
    P(ctx, 300, 104, 8, 7, '#e8e2d2');                                // 顔に載せかけた本
    P(ctx, 314, 116, 6, 8, '#c2b4a4');                                // 投げ出した腕
    /* 転がったままのクッション（誰もいない＝数が多い） */
    bean(184, 128, 18, '#8a8060', '#a09a74');
  }

  /* ══════════════════════════════════════════════════════
     ととのいの森 ── 漫画の壁（一万冊）
     ------------------------------------------------------------
     台本「反対側の壁は、一面が漫画で埋まっている。一万冊」
     ══════════════════════════════════════════════════════ */
  function y_rakuen_rest(ctx) {
    const t = T();

    /* 壁一面の本棚（圧倒する量＝これが絵の主役） */
    P(ctx, 0, 0, 360, 200, '#5a4a3a');
    P(ctx, 0, 0, 360, 12, '#493c2e');
    for (let r = 0; r < 5; r++) {
      const sy = 18 + r * 26;
      P(ctx, 8, sy, 344, 22, '#3a2e22');
      P(ctx, 8, sy + 22, 344, 4, '#6b583f');
      let bx = 12;
      const cols = ['#c84a2e', '#e8b83a', '#4a6a8a', '#5a7a5a', '#8a5a6a', '#d8d2c6', '#b08a4a', '#7a5a6a'];
      let b = 0;
      while (bx < 346) {
        const bw = 4 + ((r * 7 + b * 5) % 4), bh = 17 + ((b * 3 + r) % 4);
        P(ctx, bx, sy + 22 - bh, bw, bh, cols[(r * 3 + b) % 8]);
        if ((b % 7) === 3) P(ctx, bx + 1, sy + 22 - bh + 2, bw - 2, 2, 'rgba(255,255,255,.5)');
        bx += bw + 1; b++;
      }
    }
    /* 棚の見出し札 */
    for (let i = 0; i < 4; i++) {
      P(ctx, 40 + i * 88, 12, 30, 8, '#e8e2d2');
      ctx.font = '6px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = '#5a4028'; ctx.fillText(['あ〜か', 'き〜さ', 'し〜な', 'に〜わ'][i], 55 + i * 88, 18);
      ctx.textAlign = 'left';
    }

    /* 床 */
    P(ctx, 0, 148, 360, 52, '#b09a78');
    P(ctx, 0, 148, 360, 2, '#c9b490');

    /* 選んでいる人・抱えて歩く人 */
    const back = (x, cloth, hair) => {                        // 棚に向いた後ろ姿
      P(ctx, x, 116, 15, 34, cloth);
      P(ctx, x + 3, 106, 9, 10, '#f0cda6'); P(ctx, x + 3, 104, 9, 5, hair);
      P(ctx, x + 15, 124, 3, 10, cloth);
    };
    back(70, '#c8beb0', '#3b2d24'); back(210, '#b8c2cc', '#5a3a2c');
    /* 山ほど抱えて運ぶ人（8冊） */
    P(ctx, 292, 130, 15, 26, '#c2b4a4');
    P(ctx, 295, 120, 9, 10, '#f0cda6'); P(ctx, 295, 118, 9, 4, '#2c2420');
    for (let i = 0; i < 8; i++) P(ctx, 284, 148 - i * 4, 12, 3, ['#c84a2e', '#e8b83a', '#4a6a8a', '#5a7a5a'][i % 4]);
    /* 座り読みの若い二人（隣り合って一冊ずつ） */
    P(ctx, 120, 168, 44, 16, '#8a6c48');
    P(ctx, 124, 154, 13, 16, '#6b7a92'); P(ctx, 127, 146, 8, 8, '#f0cda6'); P(ctx, 127, 144, 8, 4, '#3b2d24');
    P(ctx, 146, 154, 13, 16, '#b8869a'); P(ctx, 149, 146, 8, 8, '#f0cda6'); P(ctx, 149, 143, 8, 5, '#5a3a2c');
    P(ctx, 121, 160, 8, 6, '#e8e2d2'); P(ctx, 156, 160, 8, 6, '#e8e2d2');
  }

  /* ══════════════════════════════════════════════════════
     ととのいの森 ── 屋上テラス（🌤45の現場）
     ------------------------------------------------------------
     台本「寝椅子に体を預けると、林を抜けてきた風が吹き抜けていく。
           下の広場から、子どもの声が上がってきた」。
     **気持ちいいのに、静かではない**＝吹き出しの「わー！」で穴を見せる
     ══════════════════════════════════════════════════════ */
  function y_rakuen_terrace(ctx) {
    const t = T();

    /* 昼の空 */
    const sky = ctx.createLinearGradient(0, 0, 0, 140);
    sky.addColorStop(0, '#7db4dc'); sky.addColorStop(1, '#cfe4ee');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 360, 200);
    for (let i = 0; i < 3; i++) {
      const cx = ((t * 4 + i * 150) % 470) - 60, cy = 20 + i * 20;
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.fillRect(cx, cy, 60 + i * 12, 8); ctx.fillRect(cx + 14, cy - 6, 34, 7);
    }
    /* 遠くの蒸岳（うっすら） */
    ctx.fillStyle = 'rgba(120,140,170,.35)';
    ctx.beginPath(); ctx.moveTo(230, 96); ctx.lineTo(290, 46); ctx.lineTo(350, 96); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath(); ctx.moveTo(278, 56); ctx.lineTo(290, 46); ctx.lineTo(302, 56); ctx.lineTo(292, 60); ctx.closePath(); ctx.fill();

    /* 林の梢（屋上の高さまで届く） */
    for (let i = 0; i < 20; i++) {
      const x = i * 19 - 6, hh = ((i * 37) % 16);
      ctx.fillStyle = i % 2 ? '#4a7a44' : '#568a4c';
      ctx.beginPath(); ctx.arc(x + 9, 104 - hh, 13, 0, Math.PI * 2); ctx.fill();
    }

    /* 手すり（木） */
    P(ctx, 0, 108, 360, 4, '#8a6c48');
    for (let x = 6; x < 360; x += 16) P(ctx, x, 112, 3, 18, '#7a5c3e');
    P(ctx, 0, 128, 360, 3, '#6b5236');

    /* ウッドデッキ */
    P(ctx, 0, 131, 360, 69, '#a5845a');
    ctx.strokeStyle = 'rgba(90,56,28,.35)'; ctx.lineWidth = 1;
    for (let y = 138; y < 200; y += 9) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); }

    /* 寝椅子（3台）と、預けている人 */
    const deckchair = (x, y, withman, hair) => {
      P(ctx, x, y, 52, 6, '#c09a68'); P(ctx, x + 4, y - 14, 16, 16, '#c09a68');
      P(ctx, x + 2, y + 6, 5, 9, '#7a5c3e'); P(ctx, x + 45, y + 6, 5, 9, '#7a5c3e');
      if (withman) {
        P(ctx, x + 16, y - 8, 34, 9, '#e0ac84');
        P(ctx, x + 6, y - 12, 11, 11, '#f0cda6'); P(ctx, x + 6, y - 14, 11, 4, hair);
        P(ctx, x + 20, y - 10, 30, 3, '#f2efe6');
        ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + 9, y - 7); ctx.lineTo(x + 11, y - 7);
        ctx.moveTo(x + 13, y - 7); ctx.lineTo(x + 15, y - 7); ctx.stroke();
      }
    };
    deckchair(30, 150, true, '#3b2d24');
    deckchair(150, 160, true, '#5a3a2c');
    deckchair(270, 148, false);
    /* 風（線が流れる） */
    for (let i = 0; i < 3; i++) {
      const wx = ((t * 40 + i * 120) % 480) - 60;
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(wx, 120 + i * 8); ctx.quadraticCurveTo(wx + 20, 116 + i * 8, wx + 40, 120 + i * 8); ctx.stroke();
    }
    /* 下の広場から上がってくる子どもの声＝穴 */
    const bl = (x, y, txt) => {
      ctx.font = '7px "DotGothic16",sans-serif';
      const w2 = ctx.measureText(txt).width + 8;
      P(ctx, x, y, w2, 12, 'rgba(255,255,255,.88)');
      ctx.fillStyle = '#5a4028'; ctx.fillText(txt, x + 4, y + 9);
      ctx.beginPath(); ctx.moveTo(x + 8, y + 12); ctx.lineTo(x + 4, y + 17); ctx.lineTo(x + 14, y + 12);
      ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fill();
    };
    const pop = Math.floor(t % 6);
    if (pop < 2) bl(214, 96, 'わー！');
    else if (pop < 4) bl(84, 92, 'まてー！');
    /* 起きてしまった一人（穴の体感） */
    P(ctx, 296, 132, 13, 16, '#e0aa7e');
    P(ctx, 299, 124, 8, 8, '#f0cda6'); P(ctx, 299, 122, 8, 3, '#2c2420');
  }


  /* ══════════════════════════════════════════════════════
     茶煙楼 ── 外観（旧貿易地区の夜・煉瓦と提灯）
     ------------------------------------------------------------
     **茶煙楼は「煉瓦の赤と、茶の緑の灯り」。**築110年の旧貿易商館。
     低い二階建て・煉瓦・丸窓・提灯＝高層のGATE37とも白の月白とも違う
     ══════════════════════════════════════════════════════ */
  function y_hama_out(ctx) {
    const t = T();

    /* 夜空（少し紫がかった港の夜） */
    const sky = ctx.createLinearGradient(0, 0, 0, 150);
    sky.addColorStop(0, '#120c1c'); sky.addColorStop(1, '#2a1e30');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 360, 200);
    for (let i = 0; i < 30; i++) {
      const h = Math.sin(i * 12.9898) * 43758.5453, h2 = Math.sin(i * 78.233) * 12345.678;
      P(ctx, Math.floor((h - Math.floor(h)) * 360), Math.floor((h2 - Math.floor(h2)) * 56), 1, 1,
        `rgba(255,238,214,${(0.14 + 0.26 * Math.abs(Math.sin(t * 0.8 + i))).toFixed(2)})`);
    }
    /* 周囲の商館（低い石造り） */
    for (const [bx, bw, bh] of [[0, 70, 64], [292, 68, 58]]) {
      P(ctx, bx, 148 - bh, bw, bh, '#241a26');
      for (let r = 0; r < 3; r++) for (let c = 0; c < Math.floor(bw / 18); c++)
        if (((r * 5 + c * 3) % 4) < 2)
          P(ctx, bx + 6 + c * 18, 148 - bh + 10 + r * 16, 8, 10, 'rgba(255,206,150,.32)');
    }

    /* ── 本体：煉瓦の商館（二階建て・低くて濃い）── */
    const X = 84, W = 192, TOP2 = 58, BASE = 148;
    /* 煉瓦の壁 */
    P(ctx, X, TOP2, W, BASE - TOP2, '#6e3a2c');
    ctx.strokeStyle = 'rgba(30,12,8,.4)'; ctx.lineWidth = 1;
    for (let y = TOP2 + 6; y < BASE; y += 7) {
      ctx.beginPath(); ctx.moveTo(X, y); ctx.lineTo(X + W, y); ctx.stroke();
      for (let x = X + ((y / 7) % 2 ? 0 : 9); x < X + W; x += 18) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 7); ctx.stroke();
      }
    }
    /* 石の帯（一階と二階の間・上端） */
    P(ctx, X - 4, TOP2 - 4, W + 8, 6, '#8a7a68');
    P(ctx, X - 4, 100, W + 8, 5, '#8a7a68');
    /* 屋上の煙突から、茶の香りの煙 */
    P(ctx, X + 28, TOP2 - 20, 12, 17, '#4a2a20'); P(ctx, X + 28, TOP2 - 20, 12, 3, '#6e4a3a');
    wisp(ctx, X + 30, TOP2 - 22, 4, .45);
    /* 二階の丸窓（3つ。茶の緑の灯り） */
    for (let i = 0; i < 3; i++) {
      const wx = X + 46 + i * 52;
      ctx.fillStyle = '#1c1410'; ctx.beginPath(); ctx.arc(wx, 80, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(159,212,122,${(0.5 + 0.14 * Math.sin(t * 1.2 + i * 2)).toFixed(2)})`;
      ctx.beginPath(); ctx.arc(wx, 80, 10, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#3a241c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(wx - 10, 80); ctx.lineTo(wx + 10, 80); ctx.moveTo(wx, 70); ctx.lineTo(wx, 90); ctx.stroke();
    }
    /* 一階のアーチ窓（湯気で曇っている） */
    for (let i = 0; i < 2; i++) {
      const wx = X + 22 + i * 116;
      ctx.fillStyle = '#2a1c14';
      ctx.beginPath(); ctx.arc(wx + 17, 122, 17, Math.PI, 0); ctx.fill();
      ctx.fillRect(wx, 122, 34, 22);
      ctx.fillStyle = 'rgba(255,214,150,.30)';
      ctx.beginPath(); ctx.arc(wx + 17, 122, 14, Math.PI, 0); ctx.fill();
      ctx.fillRect(wx + 3, 122, 28, 19);
      wisp(ctx, wx + 8, 130, 2, .25);
    }
    /* 中央の入口（木の扉・のれん・提灯） */
    P(ctx, X + 76, 108, 40, 40, '#2a1c14');
    P(ctx, X + 78, 110, 36, 12, '#8a3030');                  // のれん
    P(ctx, X + 78, 110, 36, 2, '#a84040');
    ctx.strokeStyle = '#5a1e1e'; ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(X + 78 + i * 12, 110); ctx.lineTo(X + 78 + i * 12, 122); ctx.stroke(); }
    ctx.font = '7px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#f5ead8'; ctx.fillText('茶煙楼', X + 96, 119);
    ctx.textAlign = 'left';
    /* 提灯（左右・揺れる） */
    for (const lx of [X + 66, X + 122]) {
      const sway = Math.sin(t * 2 + lx) * 1.5;
      P(ctx, lx + sway, 104, 2, 6, '#241c14');
      ctx.fillStyle = `rgba(255,178,90,${(0.8 + 0.14 * Math.sin(t * 1.6 + lx)).toFixed(2)})`;
      ctx.beginPath(); ctx.ellipse(lx + 1 + sway, 116, 6, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,178,90,.10)';
      ctx.beginPath(); ctx.arc(lx + 1 + sway, 116, 17, 0, Math.PI * 2); ctx.fill();
    }
    /* 縦看板「茶煙楼」（緑の灯り） */
    P(ctx, X + W + 4, 66, 15, 52, '#14201a');
    ctx.font = 'bold 9px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(159,212,122,${(0.8 + 0.14 * Math.sin(t * 1.4)).toFixed(2)})`;
    ctx.fillText('茶', X + W + 12, 80); ctx.fillText('煙', X + W + 12, 96); ctx.fillText('楼', X + W + 12, 112);
    ctx.textAlign = 'left';

    /* 石畳の通り */
    P(ctx, 0, BASE, 360, 52, '#2e2630');
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1;
    for (let y = BASE + 6; y < 200; y += 10) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke();
      for (let x = ((y / 10) % 2 ? 10 : 0); x < 360; x += 20) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 10); ctx.stroke();
      }
    }
    /* 提灯の光だまりと、並んでいる客（予約制＝外で待つ） */
    ctx.fillStyle = 'rgba(255,178,90,.07)';
    ctx.beginPath(); ctx.ellipse(X + 96, BASE + 10, 70, 14, 0, 0, Math.PI * 2); ctx.fill();
    /* 予約待ちの列＝3組・間隔を空けて（審査：人気の小箱） */
    person(ctx, X + 84, BASE + 14, '#5a6b8a'); person(ctx, X + 93, BASE + 16, '#7a5a6a');
    person(ctx, X + 124, BASE + 15, '#4a5a50'); person(ctx, X + 133, BASE + 17, '#8a6a4a');
    person(ctx, X + 162, BASE + 14, '#5a5a6b');
    P(ctx, X + 158, BASE + 24, 12, 4, '#8a8060');                    // 3組目の足元に鞄
    /* ガス灯（通りの端） */
    P(ctx, 30, BASE - 44, 3, 48, '#1c1620');
    P(ctx, 26, BASE - 50, 11, 10, '#241c14');
    P(ctx, 28, BASE - 48, 7, 6, `rgba(255,214,150,${(0.7 + 0.2 * Math.sin(t * 1.8)).toFixed(2)})`);
    ctx.fillStyle = 'rgba(255,214,150,.08)';
    ctx.beginPath(); ctx.arc(31, BASE - 45, 20, 0, Math.PI * 2); ctx.fill();
  }

  /* ══════════════════════════════════════════════════════
     茶煙楼 ── 浴室（漢方の水風呂）
     ------------------------------------------------------------
     台本「水風呂は漢方の色。同じ通りの老舗薬局と組んでつくった、ここだけのもの」。
     一枚一設備＝**漢方の水風呂だけ。**煉瓦と配管の下、深い緑茶色の水
     ══════════════════════════════════════════════════════ */
  function y_hama_bath(ctx) {
    const t = T();

    /* 煉瓦の壁と剥き出しの配管 */
    P(ctx, 0, 0, 360, 120, '#5e3226');
    ctx.strokeStyle = 'rgba(28,10,6,.4)'; ctx.lineWidth = 1;
    for (let y = 6; y < 120; y += 7) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke();
      for (let x = ((y / 7) % 2 ? 0 : 9); x < 360; x += 18) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 7); ctx.stroke();
      }
    }
    /* 配管（天井を横に走り、水風呂へ降りる） */
    P(ctx, 0, 14, 360, 8, '#3a3a40'); P(ctx, 0, 14, 360, 2, '#55555e');
    for (const px of [60, 170, 292]) P(ctx, px, 10, 10, 16, '#46464e');
    P(ctx, 240, 22, 8, 76, '#3a3a40'); P(ctx, 240, 22, 2, 76, '#55555e');
    P(ctx, 236, 92, 16, 10, '#46464e');
    // バルブ（ゆっくり回したくなる形）
    ctx.strokeStyle = '#8a3030'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(244, 60, 7, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(244, 53); ctx.lineTo(244, 67); ctx.moveTo(237, 60); ctx.lineTo(251, 60); ctx.stroke();

    /* 薬棚（左の壁＝薬局と組んでいる証拠） */
    P(ctx, 22, 40, 84, 64, '#3a241c'); P(ctx, 22, 40, 84, 3, '#55362a');
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
      P(ctx, 28 + c * 16, 46 + r * 20, 12, 15, '#241610');
      P(ctx, 30 + c * 16, 50 + r * 20, 8, 8, ['#8a6a3a', '#5a6a3a', '#6e4a2c'][((r + c) % 3)]);
      P(ctx, 30 + c * 16, 48 + r * 20, 8, 2, '#c8b48a');
    }
    /* 温度計＝十四度（水風呂の売り） */
    ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.arc(320, 56, 13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2a5a6a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(320, 56); ctx.lineTo(313, 62); ctx.stroke();
    ctx.font = 'bold 9px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#2a4a5a'; ctx.fillText('14', 320, 60);
    ctx.textAlign = 'left';

    /* ── 漢方の水風呂（深い緑茶色・画面いっぱい）── */
    const BY = 128, BH = 52;
    P(ctx, 0, BY - 8, 360, 8, '#4a3a2c');
    P(ctx, 0, BY - 8, 360, 2, '#6a5a44');
    const wat = ctx.createLinearGradient(0, BY, 0, BY + BH);
    wat.addColorStop(0, '#2a4a34'); wat.addColorStop(1, '#3c6246');
    ctx.fillStyle = wat; ctx.fillRect(0, BY, 360, BH);
    ripple(ctx, 4, BY + 12, 352, 'rgba(190,240,200,.32)');
    ripple(ctx, 4, BY + 28, 352, 'rgba(190,240,200,.22)');
    ripple(ctx, 4, BY + 42, 352, 'rgba(190,240,200,.14)');
    /* 漢方の薬袋（布袋が浮かんでいる） */
    for (const [hx, hy] of [[80, BY + 10], [230, BY + 16]]) {
      ctx.fillStyle = '#c8b48a';
      ctx.beginPath(); ctx.ellipse(hx, hy, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hx - 6, hy - 3); ctx.lineTo(hx + 6, hy - 3); ctx.stroke();
    }
    /* 浸かる人（二人。目を閉じてじっとしている） */
    const soak = (x, y) => {
      P(ctx, x - 4, y + 7, 16, 3, 'rgba(220,248,220,.22)');
      P(ctx, x, y, 9, 8, '#f0cda6'); P(ctx, x, y - 2, 9, 4, '#3b2d24');
      ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 2, y + 3); ctx.lineTo(x + 3, y + 3);
      ctx.moveTo(x + 6, y + 3); ctx.lineTo(x + 7, y + 3); ctx.stroke();
    };
    soak(140, BY + 20); soak(300, BY + 14);
    /* 配管から水風呂へ、水が細く落ち続ける */
    for (let i = 0; i < 5; i++) {
      const d = (t * 42 + i * 5) % 26;
      P(ctx, 242, Math.round(102 + d), 2, 4, `rgba(200,240,210,${(0.55 - d / 50).toFixed(2)})`);
    }

    /* 手前の床（黒タイル） */
    P(ctx, 0, BY + BH, 360, 200 - BY - BH, '#241c1a');
    P(ctx, 0, BY + BH, 360, 2, '#3c322e');
    P(ctx, 300, BY + BH + 6, 16, 8, '#c8a56a'); P(ctx, 300, BY + BH + 6, 16, 3, '#e0bc80');
  }

  /* ══════════════════════════════════════════════════════
     茶煙楼 ── サウナ（水車式ストーブ）
     ------------------------------------------------------------
     台本「観覧車のような水車が回り、くみ上げた水をサウナストーンへ落としていく。
           見ているだけで、わくわくする」。既存の水車描画を一枚絵の主役に
     ══════════════════════════════════════════════════════ */
  function y_hama_sauna(ctx) {
    const t = T();

    /* 煉瓦の壁（暗め・熱の色） */
    P(ctx, 0, 0, 360, 130, '#4a2620');
    ctx.strokeStyle = 'rgba(20,8,5,.4)'; ctx.lineWidth = 1;
    for (let y = 6; y < 130; y += 7) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke();
      for (let x = ((y / 7) % 2 ? 0 : 9); x < 360; x += 18) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 7); ctx.stroke();
      }
    }
    P(ctx, 0, 0, 360, 14, '#33180f');

    /* ── 中央：水車式ストーブ ── */
    const CX2 = 180, CY2 = 88, R2 = 42;
    /* 石の土台とサウナストーン */
    P(ctx, CX2 - 34, 128, 68, 22, '#3a3026');
    for (let i = 0; i < 7; i++) P(ctx, CX2 - 28 + i * 8, 124 + (i % 2) * 3, 8, 7, '#57493a');
    ctx.fillStyle = `rgba(255,140,60,${(0.22 + 0.1 * Math.sin(t * 5)).toFixed(2)})`;
    ctx.beginPath(); ctx.arc(CX2, 132, 30, 0, Math.PI * 2); ctx.fill();
    /* 回る水車 */
    const a0 = t * 0.9;
    ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(CX2, CY2, R2, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#8a6238'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(CX2, CY2, R2 - 8, 0, Math.PI * 2); ctx.stroke();
    for (let k = 0; k < 8; k++) {
      const a = a0 + k * Math.PI / 4;
      ctx.strokeStyle = '#6a4a2c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(CX2, CY2);
      ctx.lineTo(CX2 + Math.cos(a) * R2, CY2 + Math.sin(a) * R2); ctx.stroke();
      /* バケツ（下で水を汲み、上で石へこぼす） */
      const bx = CX2 + Math.cos(a) * (R2 - 4), by = CY2 + Math.sin(a) * (R2 - 4);
      P(ctx, bx - 4, by - 3, 8, 6, '#8a6238');
      P(ctx, bx - 4, by - 3, 8, 2, '#a87c48');
    }
    P(ctx, CX2 - 5, CY2 - 5, 10, 10, '#3a241c');            // 軸
    /* てっぺんのバケツから石へ落ちる水（周期的） */
    const topA = ((a0 % (Math.PI / 4)) / (Math.PI / 4));
    if (topA < 0.4) {
      for (let i = 0; i < 4; i++)
        P(ctx, CX2 - 2 + (i % 2) * 3, Math.round(CY2 + R2 - 6 + ((t * 70 + i * 8) % 34)), 2, 5,
          'rgba(200,240,250,.65)');
      wisp(ctx, CX2 - 8, 122, 4, .6); wisp(ctx, CX2 + 4, 118, 3, .5);
    } else {
      wisp(ctx, CX2 - 6, 122, 3, .3);
    }

    /* 左右のひな壇と、見ている客（**全員が水車を見ている**） */
    for (const side of [0, 1]) {
      const sx = side ? 250 : 8, w2 = 102;
      for (let r = 0; r < 2; r++) {
        const ry = 126 - r * 20;
        P(ctx, sx, ry, w2, 22, '#5e3a24'); P(ctx, sx, ry, w2, 3, '#7a4e30');
        P(ctx, sx, ry + 20, w2, 4, '#3f2716');
      }
    }
    const watch = (x, ry, flip) => {
      P(ctx, x, ry - 14, 14, 15, '#e0ac84');
      P(ctx, x + (flip ? 1 : 4), ry - 23, 9, 9, '#f0cda6');
      P(ctx, x + (flip ? 1 : 4), ry - 25, 9, 4, '#3b2d24');
      P(ctx, x + (flip ? 3 : 9), ry - 19, 1, 1, '#5a4030');  // 水車の方を見る目
    };
    watch(26, 126); watch(64, 126); watch(46, 106);
    watch(266, 126, true); watch(304, 126, true); watch(286, 106, true);

    /* 床 */
    P(ctx, 0, 150, 360, 50, '#33241c');
    ctx.strokeStyle = 'rgba(12,6,4,.4)';
    for (let y = 156; y < 200; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); }
    P(ctx, 0, 150, 360, 2, '#4c382c');
  }

  /* ══════════════════════════════════════════════════════
     茶煙楼 ── 休憩（送風装置の椅子＝🌤90の現場）
     ------------------------------------------------------------
     台本「体を預けて目を閉じると、狙ったようにちょうどいい風が落ちてくる。
           ——ここのととのいは、ととのい市で一番かもしれない」
     ══════════════════════════════════════════════════════ */
  function y_hama_rest(ctx) {
    const t = T();

    /* 煉瓦の壁（照明を落としてある） */
    P(ctx, 0, 0, 360, 132, '#3c2018');
    ctx.strokeStyle = 'rgba(16,6,4,.4)'; ctx.lineWidth = 1;
    for (let y = 6; y < 132; y += 7) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke();
      for (let x = ((y / 7) % 2 ? 0 : 9); x < 360; x += 18) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 7); ctx.stroke();
      }
    }
    /* 小さな行灯（茶の緑） */
    for (const lx of [50, 310]) {
      P(ctx, lx - 5, 36, 10, 14, '#14201a');
      P(ctx, lx - 3, 38, 6, 10, `rgba(159,212,122,${(0.5 + 0.14 * Math.sin(t + lx)).toFixed(2)})`);
      ctx.fillStyle = 'rgba(159,212,122,.06)';
      ctx.beginPath(); ctx.arc(lx, 43, 20, 0, Math.PI * 2); ctx.fill();
    }

    /* 天井の送風装置（ダクトから3本の風） */
    P(ctx, 0, 8, 360, 10, '#3a3a40'); P(ctx, 0, 8, 360, 2, '#55555e');
    for (const fx of [70, 180, 290]) {
      P(ctx, fx - 12, 18, 24, 8, '#46464e');
      P(ctx, fx - 8, 26, 16, 4, '#2c2c32');
      /* 落ちてくる風（波線が下へ流れる） */
      for (let i = 0; i < 3; i++) {
        const d = (t * 30 + i * 18) % 60;
        ctx.strokeStyle = `rgba(190,230,240,${(0.25 * (1 - d / 60)).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = -8; x <= 8; x += 2)
          ctx.lineTo(fx + x, 34 + d + Math.sin(x * 0.8 + t * 3) * 1.5);
        ctx.stroke();
      }
    }

    /* 床 */
    P(ctx, 0, 132, 360, 68, '#241c1a');
    ctx.strokeStyle = 'rgba(10,5,3,.4)';
    for (let y = 138; y < 200; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); }
    P(ctx, 0, 132, 360, 2, '#3c322e');

    /* アウトドアブランドの椅子×3（送風の真下） */
    const chair2 = (x, col, withman) => {
      const y = 118;
      /* 布張りのリクライニング */
      ctx.strokeStyle = '#2a2a30'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y + 30); ctx.lineTo(x + 14, y - 8); ctx.stroke();   // フレーム背
      ctx.beginPath(); ctx.moveTo(x + 38, y + 30); ctx.lineTo(x + 8, y + 2); ctx.stroke();
      P(ctx, x + 4, y - 6, 30, 8, col);                     // 背布
      P(ctx, x + 2, y + 2, 38, 10, col);                    // 座布
      P(ctx, x + 2, y + 2, 38, 2, 'rgba(255,255,255,.25)');
      if (withman) {
        P(ctx, x + 8, y - 14, 20, 14, '#e0ac84');           // 預けた体
        P(ctx, x + 10, y - 24, 11, 11, '#f0cda6'); P(ctx, x + 10, y - 26, 11, 4, '#3b2d24');
        ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 1;      // 閉じた目
        ctx.beginPath(); ctx.moveTo(x + 13, y - 19); ctx.lineTo(x + 15, y - 19);
        ctx.moveTo(x + 17, y - 19); ctx.lineTo(x + 19, y - 19); ctx.stroke();
        P(ctx, x + 6, y + 12, 26, 4, '#f2efe6');            // 膝のタオル
      }
    };
    chair2(48, '#4a5a6a', true);
    chair2(158, '#5a4a3a', true);
    chair2(268, '#3f5548', false);                          // 一脚だけ空いている＝特等席
    /* 空席にだけ風が「見えて」落ちる（審査：視覚の一撃） */
    for (let i = 0; i < 4; i++) {
      const d = (t * 36 + i * 15) % 84;
      const al = 0.5 * (1 - d / 84);
      ctx.strokeStyle = `rgba(200,238,248,${al.toFixed(3)})`; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = -12; x <= 12; x += 2)
        ctx.lineTo(290 + x, 34 + d + Math.sin(x * 0.6 + t * 4 + i) * 2);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(200,238,248,${(0.07 + 0.03 * Math.sin(t * 3)).toFixed(3)})`;
    ctx.beginPath(); ctx.ellipse(290, 122, 30, 10, 0, 0, Math.PI * 2); ctx.fill();
    /* 座面のタオルが風でめくれ、札が揺れる */
    const fl2 = Math.sin(t * 5) * 2;
    P(ctx, 274, 116, 22, 4, '#f2efe6');
    P(ctx, 292, 113 + Math.round(fl2 * 0.5), 8, 3, '#f2efe6');       // めくれた端
    ctx.save(); ctx.translate(313, 108); ctx.rotate(Math.sin(t * 4) * 0.08);
    P(ctx, -7, 0, 14, 18, '#c8b48a');
    ctx.font = '6px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#5a4028'; ctx.fillText('整', 0, 8); ctx.fillText('い', 0, 15);
    ctx.textAlign = 'left'; ctx.restore();
  }

  /* ══════════════════════════════════════════════════════
     茶煙楼 ── カプセル（豪華寝台列車風）
     ------------------------------------------------------------
     台本「豪華な寝台列車を思わせるカプセル。眠るだけでも旅をしている気分」
     ══════════════════════════════════════════════════════ */
  function y_hama_capsule(ctx) {
    const t = T();

    /* 深い緑の壁と真鍮の帯＝寝台列車の廊下 */
    P(ctx, 0, 0, 360, 200, '#1e3228');
    P(ctx, 0, 0, 360, 14, '#16241c');
    P(ctx, 0, 14, 360, 3, '#c8a03a');                        // 真鍮のモール
    P(ctx, 0, 176, 360, 3, '#c8a03a');
    /* 絨毯の通路 */
    P(ctx, 0, 179, 360, 21, '#5e2430');
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1;
    for (let x = 10; x < 360; x += 24) { ctx.beginPath(); ctx.moveTo(x, 182); ctx.lineTo(x, 200); ctx.stroke(); }
    P(ctx, 0, 179, 360, 2, '#7a3040');

    /* 寝台（2段×3列。木枠・真鍮・カーテン） */
    for (let c = 0; c < 3; c++) for (let r = 0; r < 2; r++) {
      const x = 16 + c * 116, y = 24 + r * 78, w2 = 100, h2 = 70;
      P(ctx, x, y, w2, h2, '#4a3220');                       // 木枠
      P(ctx, x, y, w2, 3, '#6a4a2c');
      P(ctx, x + 4, y + 6, w2 - 8, h2 - 12, '#181008');      // 開口
      P(ctx, x + 3, y + 4, w2 - 6, 2, '#c8a03a');            // 真鍮の縁
      P(ctx, x + 3, y + h2 - 6, w2 - 6, 2, '#c8a03a');
      const kind = (c * 2 + r) % 3;
      if (kind === 0) {
        /* カーテンが閉まっている（緑のベロア） */
        P(ctx, x + 5, y + 7, w2 - 10, h2 - 14, '#2a4a38');
        ctx.strokeStyle = 'rgba(10,20,14,.5)';
        for (let f = x + 12; f < x + w2 - 8; f += 8) {
          ctx.beginPath(); ctx.moveTo(f, y + 7); ctx.lineTo(f, y + h2 - 7); ctx.stroke();
        }
        P(ctx, x + w2 / 2 - 2, y + h2 / 2 - 3, 5, 7, '#c8a03a');   // カーテンの留め
      } else if (kind === 1) {
        /* 眠っている（読書灯・布団） */
        P(ctx, x + 8, y + 34, w2 - 18, 22, '#3f3548');
        P(ctx, x + 12, y + 38, 20, 10, '#f0cda6');
        P(ctx, x + w2 - 24, y + 12, 8, 5, '#ffce7a');
        ctx.fillStyle = 'rgba(255,206,140,.07)';
        ctx.beginPath(); ctx.arc(x + w2 - 20, y + 20, 20, 0, Math.PI * 2); ctx.fill();
      } else {
        /* 空室（整えたベッドと畳んだ浴衣） */
        P(ctx, x + 8, y + 40, w2 - 18, 16, '#c8beb0');
        P(ctx, x + 8, y + 40, w2 - 18, 3, '#e0d8cc');
        P(ctx, x + 14, y + 20, 22, 12, '#3f5548'); P(ctx, x + 14, y + 20, 22, 3, '#c8a03a');
      }
      /* 列車の記号（審査）：カプセル上の真鍮の荷物棚と、枠の切符差し */
      if (r === 0) {
        P(ctx, x + 8, y - 8, w2 - 16, 2, '#c8a03a');
        for (let b2 = 0; b2 < 4; b2++) P(ctx, x + 10 + b2 * 22, y - 6, 2, 5, '#c8a03a');
        if (c === 1) { P(ctx, x + 14, y - 14, 24, 8, '#5a6b8a'); P(ctx, x + 44, y - 12, 18, 6, '#8a6a4a'); }
      }
      P(ctx, x + w2 - 14, y + 4, 10, 12, '#3a2a10');
      P(ctx, x + w2 - 13, y + 5, 8, 7, '#e8e2d2');                   // 切符
      /* 号室の真鍮プレート */
      P(ctx, x + w2 / 2 - 10, y - 2, 20, 8, '#c8a03a');
      ctx.font = '6px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = '#3a2a10'; ctx.fillText(String(201 + c * 2 + r), x + w2 / 2, y + 4);
      ctx.textAlign = 'left';
    }
    /* 廊下のランプ */
    for (const lx of [74, 190, 306]) {
      P(ctx, lx, 17, 2, 5, '#c8a03a');
      ctx.fillStyle = `rgba(255,214,150,${(0.6 + 0.14 * Math.sin(t * 1.4 + lx)).toFixed(2)})`;
      ctx.beginPath(); ctx.arc(lx + 1, 25, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,214,150,.05)';
      ctx.beginPath(); ctx.arc(lx + 1, 25, 16, 0, Math.PI * 2); ctx.fill();
    }
  }


  /* ══════════════════════════════════════════════════════
     月白 SPA TERRACE ①男湯
     ══════════════════════════════════════════════════════ */
  /* ══════════════════════════════════════════════════════
     月白 ── 浴室（琥珀色の天然温泉）
     ------------------------------------------------------------
     台本「扉の向こうでは、琥珀色の湯が静かに揺れている」。
     白い石・大きなガラス・琥珀の湯＝🧼95 と「高い理由」を色でやる
     ══════════════════════════════════════════════════════ */
  function y_lumina_bath(ctx) {
    const t = T();

    /* ── 構図の決まり（作者フィードバック 2026-08-09）──
       俯瞰で浴室全体を見せない。**主浴槽ひとつだけ**を正面から。
       露天・シアターと同じ型＝一枚につき、設備はひとつ                       */

    /* 天井（石・暗め。灯りは湯へ落とす） */
    P(ctx, 0, 0, 360, 26, '#4e4a42');
    P(ctx, 0, 0, 360, 5, '#5f5a50');
    ctx.strokeStyle = 'rgba(20,16,12,.3)'; ctx.lineWidth = 1;
    for (let i2 = 0; i2 < 9; i2++) { ctx.beginPath(); ctx.moveTo(i2 * 44, 0); ctx.lineTo(i2 * 44 + 10, 26); ctx.stroke(); }
    // ダウンライト3つ（光の円錐が湯へ落ちる）
    for (const lx of [88, 180, 272]) {
      P(ctx, lx - 4, 24, 8, 3, '#2c2822');
      P(ctx, lx - 2, 26, 4, 2, `rgba(255,240,206,${(0.8 + 0.1 * Math.sin(t + lx)).toFixed(2)})`);
      const cone = ctx.createLinearGradient(0, 28, 0, 128);
      cone.addColorStop(0, `rgba(255,240,200,${(0.10 + 0.02 * Math.sin(t * 0.9 + lx)).toFixed(3)})`);
      cone.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = cone;
      ctx.beginPath(); ctx.moveTo(lx - 3, 28); ctx.lineTo(lx + 3, 28);
      ctx.lineTo(lx + 26, 128); ctx.lineTo(lx - 26, 128); ctx.closePath(); ctx.fill();
    }

    /* 正面の壁（大判の石タイル・落ち着いた砂色） */
    const wall = ctx.createLinearGradient(0, 26, 0, 122);
    wall.addColorStop(0, '#6a6154'); wall.addColorStop(1, '#8d8271');
    ctx.fillStyle = wall; ctx.fillRect(0, 26, 360, 96);
    ctx.strokeStyle = 'rgba(30,24,18,.28)'; ctx.lineWidth = 1;
    for (let y = 50; y < 122; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); }
    for (let x = 22; x < 360; x += 44) { ctx.beginPath(); ctx.moveTo(x, 26); ctx.lineTo(x, 122); ctx.stroke(); }

    /* 壁の紋＝三日月（外観・露天と同じ形。店の意匠で統一） */
    ctx.fillStyle = 'rgba(240,244,255,.75)';
    ctx.beginPath(); ctx.arc(180, 58, 11, 0, Math.PI * 2); ctx.arc(175, 54, 10, 0, Math.PI * 2); ctx.fill('evenodd');
    ctx.fillStyle = 'rgba(240,244,255,.05)';
    ctx.beginPath(); ctx.arc(180, 58, 22, 0, Math.PI * 2); ctx.fill();

    /* 右：夜の窓（縦一本。外は暗い＝露天へ続く） */
    P(ctx, 318, 26, 42, 96, '#131c30');
    for (let i2 = 0; i2 < 8; i2++) {
      const h = Math.sin(i2 * 12.9898) * 43758.5453, h2 = Math.sin(i2 * 78.233) * 12345.678;
      P(ctx, 322 + Math.floor((h - Math.floor(h)) * 34), 30 + Math.floor((h2 - Math.floor(h2)) * 50), 1, 1,
        `rgba(220,230,255,${(0.2 + 0.3 * Math.abs(Math.sin(t + i2))).toFixed(2)})`);
    }
    ctx.strokeStyle = 'rgba(86,98,116,.9)'; ctx.lineWidth = 2; ctx.strokeRect(318, 26, 42, 96);
    ctx.beginPath(); ctx.moveTo(318, 74); ctx.lineTo(360, 74); ctx.stroke();
    P(ctx, 320, 28, 1, 92, '#d5b678');                    // 窓枠内側の暖色反射

    /* 石の樋（壁から突き出て、湯へ落ち続ける＝源泉かけ流し）＋石台 */
    P(ctx, 168, 104, 24, 22, '#6a6154');
    P(ctx, 168, 104, 24, 2, '#847a68');
    P(ctx, 152, 96, 56, 10, '#57503f');
    P(ctx, 152, 96, 56, 3, '#6d6550');
    P(ctx, 150, 94, 4, 14, '#453f32'); P(ctx, 206, 94, 4, 14, '#453f32');
    for (let i2 = 0; i2 < 8; i2++) {
      const d = (t * 46 + i2 * 4) % 18;
      P(ctx, 160 + i2 * 5, Math.round(106 + d), 2, 5, `rgba(255,224,150,${(0.62 - d / 30).toFixed(2)})`);
    }
    wisp(ctx, 168, 112, 3, .4); wisp(ctx, 188, 110, 2, .34);

    /* ── 主浴槽（琥珀色の湯・画面いっぱい）── */
    const BY = 124, BH = 56;
    P(ctx, 0, BY - 9, 360, 9, '#e8e5d8');                 // 白い石材の浴槽縁（S級審査②）
    P(ctx, 0, BY - 9, 360, 2, '#f4f2ea');
    P(ctx, 0, BY - 2, 360, 2, '#b5ab96');
    P(ctx, 0, BY - 1, 360, 1, '#d5b678');                 // 縁下のシャンパンライト
    ctx.strokeStyle = 'rgba(150,138,120,.35)'; ctx.lineWidth = 1;
    for (let x = 30; x < 360; x += 44) { ctx.beginPath(); ctx.moveTo(x, BY - 9); ctx.lineTo(x, BY); ctx.stroke(); }
    const w2 = ctx.createLinearGradient(0, BY, 0, BY + BH);
    w2.addColorStop(0, '#8f5f20'); w2.addColorStop(0.5, '#b07f34'); w2.addColorStop(1, '#c89448');
    ctx.fillStyle = w2; ctx.fillRect(0, BY, 360, BH);
    // ダウンライトの照りが湯面に三つ
    for (const lx of [88, 180, 272]) {
      ctx.fillStyle = `rgba(255,238,190,${(0.10 + 0.03 * Math.sin(t * 0.9 + lx)).toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(lx, BY + 12, 26, 6, 0, 0, Math.PI * 2); ctx.fill();
    }
    ripple(ctx, 4, BY + 12, 352, 'rgba(255,236,190,.42)');
    ripple(ctx, 4, BY + 28, 352, 'rgba(255,236,190,.30)');
    ripple(ctx, 4, BY + 43, 352, 'rgba(255,236,190,.18)');
    wisp(ctx, 40, BY + 4, 4, .42); wisp(ctx, 150, BY + 2, 5, .5); wisp(ctx, 260, BY + 5, 4, .40); wisp(ctx, 320, BY + 3, 3, .34);

    /* 浸かる人（三人。距離を空けて静かに） */
    const soak = (x, y) => {
      P(ctx, x - 4, y + 7, 16, 3, 'rgba(255,244,214,.28)');
      P(ctx, x, y, 9, 8, '#f0cda6'); P(ctx, x, y - 2, 9, 4, '#3b2d24');
      P(ctx, x + 2, y + 3, 1, 1, '#5a4030'); P(ctx, x + 6, y + 3, 1, 1, '#5a4030');
    };
    soak(66, BY + 16); soak(300, BY + 14);
    /* 演技差：縁に両腕をかけてのけぞる人／頭にタオルの人（審査3） */
    P(ctx, 192, BY + 22, 9, 8, '#f0cda6'); P(ctx, 192, BY + 20, 9, 4, '#3b2d24');
    P(ctx, 188, BY + 18, 4, 2, '#f0cda6'); P(ctx, 201, BY + 18, 4, 2, '#f0cda6');
    P(ctx, 250, BY + 30, 9, 7, '#f0cda6'); P(ctx, 249, BY + 26, 11, 5, '#f2efe6');
    // 縁に整えた小物一組（審査3：白タオル・木桶・ボトル2本）
    P(ctx, 122, BY - 6, 14, 4, '#f2efe6'); P(ctx, 122, BY - 6, 14, 1, '#ffffff');
    P(ctx, 139, BY - 8, 11, 6, '#c8a56a'); P(ctx, 139, BY - 8, 11, 2, '#e0bc80');
    P(ctx, 153, BY - 9, 3, 7, '#8a9a6a'); P(ctx, 158, BY - 9, 3, 7, '#c8b48a');

    /* 手前の床（濡れた石・湯の照り返し） */
    P(ctx, 0, BY + BH, 360, 200 - BY - BH, '#575044');
    P(ctx, 0, BY + BH, 360, 2, '#6f6759');
    for (let i2 = 0; i2 < 5; i2++)
      P(ctx, 30 + i2 * 70, BY + BH + 6 + (i2 % 2) * 4, 34, 2,
        `rgba(255,226,160,${(0.07 + 0.03 * Math.sin(t * 1.4 + i2)).toFixed(3)})`);
  }

  /* ══════════════════════════════════════════════════════
     月白 ── 休憩ラウンジ（大きなソファ）
     ------------------------------------------------------------
     台本「休憩は大きなソファ。体を預けた瞬間、全身から力が抜ける」。
     新スコアで🛋85＝**旧・館内図（寝椅子6セットだけ）を廃棄**して、
     「客が帰らない理由まで、ちゃんと用意されている」を描く
     ══════════════════════════════════════════════════════ */
  function y_lumina_rest(ctx) {
    const t = T();

    /* 壁（藍鼠・落ち着いた暗さ）。設備はソファひとつを主役に寄せる */
    P(ctx, 0, 0, 360, 200, '#3e4450');
    P(ctx, 0, 0, 360, 18, '#333944');
    P(ctx, 70, 16, 220, 3, `rgba(255,244,220,${(0.5 + 0.06 * Math.sin(t)).toFixed(2)})`);

    /* 奥：本棚（壁一面。読む店＝帰らない店） */
    P(ctx, 20, 28, 130, 84, '#5a4632'); P(ctx, 20, 28, 130, 3, '#75603f');
    for (let r = 0; r < 3; r++) {
      P(ctx, 25, 36 + r * 26, 120, 18, '#2c2218');
      let bx = 27;
      for (let b = 0; b < 22 && bx < 141; b++) {
        const bw = 3 + ((r * 7 + b * 5) % 4), bh = 14 + ((b * 3) % 4);
        const cols = ['#9c6a4a', '#6a7a8c', '#8c8c6a', '#7a5a6a', '#5a7a6a', '#8a6a5a'];
        P(ctx, bx, 54 + r * 26 - bh, bw, bh, cols[(r + b) % 6]);
        bx += bw + 1;
      }
    }
    // 斜めに差してある一冊（生活感）
    P(ctx, 96, 40, 8, 3, '#9c6a4a'); P(ctx, 95, 43, 9, 2, '#8a5a3c');

    /* 奥：窓（カーテン越しの夜） */
    P(ctx, 258, 28, 84, 78, '#141d33');
    for (let i2 = 0; i2 < 10; i2++) {
      const h = Math.sin(i2 * 91.7) * 4771.3;
      P(ctx, 262 + Math.floor((h - Math.floor(h)) * 74), 54 + (i2 * 13) % 44, 2, 2, 'rgba(255,216,138,.45)');
    }
    ctx.fillStyle = 'rgba(220,214,200,.18)';
    ctx.fillRect(258, 28, 16, 78); ctx.fillRect(326, 28, 16, 78);
    ctx.strokeStyle = '#5a6070'; ctx.lineWidth = 2; ctx.strokeRect(258, 28, 84, 78);

    /* 壁の三日月照明（S級審査⑥：円ではなく欠けた月）＋スタンド */
    ctx.fillStyle = 'rgba(86,98,116,.5)';
    ctx.beginPath(); ctx.arc(205, 57, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(231,228,216,${(0.85 + 0.1 * Math.sin(t * 1.2)).toFixed(2)})`;
    ctx.beginPath(); ctx.arc(205, 57, 26, 0, Math.PI * 2);
    ctx.arc(194, 51, 24, 0, Math.PI * 2); ctx.fill('evenodd');
    ctx.fillStyle = 'rgba(231,228,216,.08)';
    ctx.beginPath(); ctx.arc(205, 57, 44, 0, Math.PI * 2); ctx.fill();
    P(ctx, 196, 88, 4, 44, '#26202a');

    /* 床（カーペット） */
    P(ctx, 0, 112, 360, 88, '#4e4438');
    ctx.fillStyle = 'rgba(30,22,14,.16)';
    for (let y = 116; y < 200; y += 8) for (let x = (y % 16) ? 0 : 4; x < 360; x += 8) ctx.fillRect(x, y, 4, 4);
    // 照明の光だまり
    ctx.fillStyle = `rgba(255,240,206,${(0.05 + 0.02 * Math.sin(t * 1.2)).toFixed(3)})`;
    ctx.beginPath(); ctx.ellipse(190, 150, 120, 34, 0, 0, Math.PI * 2); ctx.fill();

    /* ── 主役：大きなソファ（画面の半分を使う）── */
    const SX = 56, SY = 128, SW = 210;
    P(ctx, SX - 14, SY - 26, 14, 74, '#5f7268');           // 左肘
    P(ctx, SX + SW, SY - 26, 14, 74, '#5f7268');           // 右肘
    P(ctx, SX - 14, SY - 26, 14, 4, '#7d9084');
    P(ctx, SX + SW, SY - 26, 14, 4, '#7d9084');
    P(ctx, SX, SY - 22, SW, 26, '#546658');                // 背もたれ
    P(ctx, SX, SY - 22, SW, 4, '#7d9084');
    for (let c = 1; c < 4; c++) {                          // 背クッションの割り
      ctx.strokeStyle = 'rgba(20,26,22,.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(SX + c * (SW / 4), SY - 20); ctx.lineTo(SX + c * (SW / 4), SY + 2); ctx.stroke();
    }
    P(ctx, SX, SY + 4, SW, 30, '#5f7268');                 // 座面
    P(ctx, SX, SY + 4, SW, 5, '#70836f');
    ctx.fillStyle = 'rgba(0,0,0,.20)'; ctx.fillRect(SX, SY + 30, SW, 4);
    P(ctx, SX - 10, SY + 42, SW + 20, 5, '#3a3028');       // 台輪

    /* 沈んでいる二人（体を預けて、目を閉じている） */
    const sunk = (x, cloth, hair) => {
      P(ctx, x, SY - 8, 22, 34, cloth);                    // 深く沈んだ胴
      P(ctx, x - 2, SY + 20, 26, 8, cloth);                // 伸ばした脚の付け根
      P(ctx, x + 5, SY - 19, 12, 12, '#f0cda6');           // 上を向いた顔
      P(ctx, x + 5, SY - 22, 12, 5, hair);
      ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 1;      // 閉じた目
      ctx.beginPath(); ctx.moveTo(x + 8, SY - 13); ctx.lineTo(x + 10, SY - 13);
      ctx.moveTo(x + 12, SY - 13); ctx.lineTo(x + 14, SY - 13); ctx.stroke();
    };
    sunk(SX + 30, '#c8beb0', '#3b2d24');
    sunk(SX + 128, '#b8c2cc', '#5a3a2c');
    /* 端で本を読む一人（帰らない客） */
    P(ctx, SX + 174, SY - 6, 20, 30, '#c2b4a4');
    P(ctx, SX + 178, SY - 17, 11, 11, '#f0cda6'); P(ctx, SX + 178, SY - 20, 11, 5, '#4a3a2e');
    P(ctx, SX + 170, SY + 2, 10, 8, '#e8e2d2');
    ctx.strokeStyle = 'rgba(60,44,28,.6)'; ctx.strokeRect(SX + 170.5, SY + 2.5, 9, 7);

    /* サイドテーブル＝水差しとグラス2つ（審査3：湯上がりの読み） */
    P(ctx, 288, 140, 34, 6, '#3a3026'); P(ctx, 302, 146, 5, 20, '#3a3026');
    P(ctx, 291, 128, 8, 12, 'rgba(210,230,250,.75)');
    P(ctx, 290, 126, 10, 3, 'rgba(230,242,255,.9)');
    P(ctx, 292, 132, 6, 6, 'rgba(120,170,220,.55)');
    P(ctx, 304, 132, 5, 8, 'rgba(210,230,250,.7)'); P(ctx, 312, 132, 5, 8, 'rgba(210,230,250,.7)');
    P(ctx, 305, 136, 3, 3, 'rgba(120,170,220,.5)'); P(ctx, 313, 136, 3, 3, 'rgba(120,170,220,.5)');
    /* 足元のスリッパ（脱ぎっぱなし＝長居）と、丸めた白タオル */
    P(ctx, 96, 178, 10, 4, '#d8d2c6'); P(ctx, 109, 179, 10, 4, '#d8d2c6');
    ctx.fillStyle = '#f2efe6';
    ctx.beginPath(); ctx.ellipse(276, 176, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c8c2b2'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(270, 176); ctx.lineTo(282, 176); ctx.stroke();
  }

  /* ══════════════════════════════════════════════════════
     月白 ── レストラン
     ------------------------------------------------------------
     台本「御膳にするか、麺にするか、カツカレーか。選んでいる時間まで楽しい」
     ══════════════════════════════════════════════════════ */
  function y_lumina_meshi(ctx) {
    const t = T();

    /* 壁（暖色の和モダン）と障子風の窓 */
    P(ctx, 0, 0, 360, 200, '#4a4038');
    P(ctx, 0, 0, 360, 20, '#3c342c');
    /* 窓は夜で統一（S級審査⑦：外観・露天と同じ時間に合わせる） */
    for (const wx of [28, 132, 236]) {
      P(ctx, wx, 30, 84, 64, '#151c31');
      for (let i = 0; i < 8; i++) {
        const h = Math.sin((wx + i) * 91.7) * 4771.3;
        P(ctx, wx + 4 + Math.floor((h - Math.floor(h)) * 76), 58 + (i * 11) % 32, 2, 2, 'rgba(255,214,138,.5)');
      }
      if (wx === 132) {                                        // 中央の窓だけ涼風大橋（審査3）
        ctx.strokeStyle = 'rgba(150,175,215,.55)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= 60; x += 3) {
          const u = (x - 30) / 17, yy = 66 - Math.max(0, 18 - u * u * 6);
          x === 0 ? ctx.moveTo(wx + 12 + x, 66) : ctx.lineTo(wx + 12 + x, yy);
        }
        ctx.stroke();
        P(ctx, wx + 24, 48, 2, 18, 'rgba(150,175,215,.45)');
        P(ctx, wx + 56, 48, 2, 18, 'rgba(150,175,215,.45)');
        for (let x2 = wx + 14; x2 < wx + 70; x2 += 5)
          P(ctx, x2, 65, 1, 1, 'rgba(220,232,255,.6)');
      }
      ctx.strokeStyle = '#566274'; ctx.lineWidth = 2;
      ctx.strokeRect(wx, 30, 84, 64);
      ctx.beginPath(); ctx.moveTo(wx + 42, 30); ctx.lineTo(wx + 42, 94); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(wx, 62); ctx.lineTo(wx + 84, 62); ctx.stroke();
      P(ctx, wx + 1, 31, 1, 62, '#d5b678');                    // 内側の暖色反射
    }
    /* 吊り照明 */
    for (const lx of [90, 200, 310]) {
      P(ctx, lx, 0, 2, 26, '#241e18');
      P(ctx, lx - 7, 26, 16, 9, '#e8d8b0');
      ctx.fillStyle = `rgba(255,236,190,${(0.09 + 0.03 * Math.sin(t * 1.4 + lx)).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(lx + 1, 34, 24, 0, Math.PI * 2); ctx.fill();
    }

    /* 床 */
    P(ctx, 0, 110, 360, 90, '#5e5044');
    ctx.strokeStyle = 'rgba(30,22,14,.3)'; ctx.lineWidth = 1;
    for (let y = 116; y < 200; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); }

    /* テーブル（湯上がりの客。御膳と麺とビール） */
    const table = (x, y) => {
      P(ctx, x, y, 72, 26, '#7a5c3a'); P(ctx, x, y, 72, 4, '#96754c');
      P(ctx, x + 4, y + 26, 5, 12, '#4a3826'); P(ctx, x + 63, y + 26, 5, 12, '#4a3826');
    };
    const diner = (x, y, cloth, hair) => {
      P(ctx, x, y - 12, 14, 14, cloth);
      P(ctx, x + 3, y - 21, 9, 9, '#f0cda6'); P(ctx, x + 3, y - 23, 9, 4, hair || '#3b2d24');
    };
    /* 御膳（小鉢が並ぶ） */
    table(30, 138); diner(44, 138, '#c8beb0');
    for (let i = 0; i < 4; i++) P(ctx, 36 + i * 16, 142, 10, 7, ['#e8e2d2', '#c85a3a', '#7a8a5a', '#e8e2d2'][i]);
    P(ctx, 40, 151, 12, 5, '#2c2218');                     // 汁椀
    /* 麺（丼から湯気）。左の客は箸を上げている（審査3：所作差） */
    table(146, 150); diner(160, 150, '#aab6be', '#5a3a2c'); diner(186, 150, '#c2b4a4');
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(168, 142); ctx.lineTo(173, 134); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(170, 142); ctx.lineTo(175, 135); ctx.stroke();
    P(ctx, 166, 140, 4, 3, '#f0cda6');
    P(ctx, 158, 154, 16, 9, '#e8e2d2'); P(ctx, 160, 154, 12, 3, '#c89448');
    wisp(ctx, 162, 150, 2, .4);
    P(ctx, 186, 155, 12, 8, '#e8e2d2');
    /* カツカレーと生ビール */
    table(252, 136); diner(264, 136, '#b8a89a'); diner(290, 136, '#98a8b4', '#2c2420');
    P(ctx, 258, 140, 18, 8, '#e8e2d2'); P(ctx, 260, 141, 9, 5, '#8a5a2a'); P(ctx, 269, 142, 6, 4, '#c8a03a');
    ctx.save(); ctx.translate(296, 144); ctx.rotate(-0.3);
    P(ctx, -3, -6, 7, 11, '#e8b83a'); P(ctx, -3, -6, 7, 3, '#fdf3e0'); ctx.restore();
    P(ctx, 288, 132, 4, 3, '#f0cda6');
    /* 配膳の店員 */
    P(ctx, 118, 168, 13, 18, '#3a3a44');
    P(ctx, 121, 159, 8, 8, '#f0cda6'); P(ctx, 121, 157, 8, 4, '#2c2420');
    P(ctx, 112, 172, 8, 3, '#e8e2d2');                     // 盆
    wisp(ctx, 114, 169, 1, .3);
  }

  /* ══════════════════════════════════════════════════════
     月白 ── カフェ（連れを待つ場所）
     ------------------------------------------------------------
     台本＝立ち話の舞台。「ソファがあって、コーヒーがあって、本が読める。
     待たせる側じゃなく、待つ側のことまで考えてある」
     ══════════════════════════════════════════════════════ */
  function y_lumina_cafe(ctx) {
    const t = T();

    /* 白い壁・木の腰板 */
    P(ctx, 0, 0, 360, 200, '#ded6c8');
    P(ctx, 0, 0, 360, 18, '#cec6b6');
    P(ctx, 0, 92, 360, 34, '#8a6c48');
    ctx.strokeStyle = 'rgba(60,42,24,.25)'; ctx.lineWidth = 1;
    for (let x = 8; x < 360; x += 12) { ctx.beginPath(); ctx.moveTo(x, 92); ctx.lineTo(x, 126); ctx.stroke(); }

    /* カウンター（右）とコーヒーの機械 */
    P(ctx, 250, 76, 110, 14, '#5a4632'); P(ctx, 250, 76, 110, 3, '#75603f');
    P(ctx, 256, 90, 98, 46, '#6a563e');
    P(ctx, 262, 56, 26, 20, '#3a3a44'); P(ctx, 266, 60, 8, 6, '#c8d2dc');   // エスプレッソマシン
    wisp(ctx, 270, 54, 2, .35);
    P(ctx, 300, 62, 10, 14, '#e8e2d2'); P(ctx, 316, 64, 10, 12, '#e8e2d2'); // カップの列
    /* 店員 */
    P(ctx, 330, 52, 13, 24, '#4a4438');
    P(ctx, 333, 43, 8, 9, '#f0cda6'); P(ctx, 333, 41, 8, 4, '#3b2d24');
    P(ctx, 330, 58, 13, 4, '#e8e2d2');                     // 前掛け

    /* 壁の黒板メニューと小さな棚 */
    P(ctx, 36, 34, 54, 40, '#2c3830'); ctx.strokeStyle = '#8a7a5e'; ctx.lineWidth = 2; ctx.strokeRect(36, 34, 54, 40);
    ctx.fillStyle = 'rgba(240,236,220,.7)'; ctx.font = '6px "DotGothic16",sans-serif';
    ctx.fillText('COFFEE', 46, 48); ctx.fillText('ほうじ茶', 46, 58); ctx.fillText('ソーダ', 46, 68);
    P(ctx, 120, 40, 70, 5, '#75603f');
    for (let i = 0; i < 5; i++) P(ctx, 126 + i * 13, 30, 8, 10, ['#9c6a4a', '#6a7a8c', '#8c8c6a', '#7a5a6a', '#5a7a6a'][i]);

    /* 床 */
    P(ctx, 0, 126, 360, 74, '#b8a888');
    ctx.strokeStyle = 'rgba(90,64,36,.2)'; ctx.lineWidth = 1;
    for (let y = 132; y < 200; y += 11) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); }

    /* ── 中央：一人・空席・コーヒー二つ＝「待っている」が一目で分かる構図
         （S級審査：C判定→処方箋の座標どおりに組み直し 2026-08-09）──   */
    /* 座っている男（一人だけ。連れはまだ風呂） */
    P(ctx, 104, 132, 26, 32, '#5f7268'); P(ctx, 104, 128, 26, 6, '#7d9084');  // 椅子
    P(ctx, 107, 134, 18, 26, '#c7b89a');                   // 館内着（アイボリー）
    P(ctx, 110, 122, 11, 12, '#f0cda6'); P(ctx, 110, 120, 11, 5, '#4a3a2e');
    P(ctx, 113, 127, 1, 1, '#5a4030'); P(ctx, 117, 127, 1, 1, '#5a4030');
    P(ctx, 107, 156, 22, 5, '#a09082');                    // 組んだ脚
    /* 小テーブルと、コーヒー二つ */
    P(ctx, 149, 148, 46, 6, '#6a563e'); P(ctx, 149, 148, 46, 2, '#866f4e');
    P(ctx, 154, 154, 5, 14, '#4a3826'); P(ctx, 185, 154, 5, 14, '#4a3826');
    P(ctx, 159, 139, 9, 9, '#e8e2d2'); P(ctx, 161, 141, 5, 3, '#3a2418');    // 飲みかけ（暗く・少ない）
    P(ctx, 177, 137, 9, 10, '#e8e2d2'); P(ctx, 179, 138, 5, 2, '#7a4a2a');   // 手つかず
    wisp(ctx, 181, 133, 1, .45);                                             // 湯気は手つかず側だけ
    /* 空の椅子＝背もたれと脚をはっきり（審査3：箱に見せない） */
    P(ctx, 226, 122, 8, 42, '#6a5f70'); P(ctx, 226, 122, 8, 3, '#877c8e');
    P(ctx, 208, 144, 22, 12, '#6a5f70'); P(ctx, 208, 144, 22, 3, '#877c8e');
    P(ctx, 210, 156, 4, 14, '#4a4152'); P(ctx, 224, 156, 4, 14, '#4a4152');
    P(ctx, 210, 146, 18, 8, 'rgba(0,0,0,.14)');
    /* 観葉植物 */
    plant(ctx, 66, 130); plant(ctx, 72, 135); plant(ctx, 286, 132); plant(ctx, 292, 137);
    P(ctx, 62, 136, 18, 6, '#8a7458');
  }

  /* ══════════════════════════════════════════════════════
     松乃湯 ── 外観（松乃町商店街の夜。六十八年）
     ------------------------------------------------------------
     **松乃湯は「低くて、生活の色」。**アーケードの奥、瓦屋根と煙突。
     五軒で唯一、看板が電球色の裸文字＝豪華さの対極
     ══════════════════════════════════════════════════════ */
  function y_fukurai_out(ctx) {
    const t = T();

    /* 夜空と煙突 */
    const sky = ctx.createLinearGradient(0, 0, 0, 130);
    sky.addColorStop(0, '#0e1018'); sky.addColorStop(1, '#242030');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 360, 200);
    for (let i = 0; i < 24; i++) {
      const h = Math.sin(i * 12.9898) * 43758.5453, h2 = Math.sin(i * 78.233) * 12345.678;
      P(ctx, Math.floor((h - Math.floor(h)) * 360), Math.floor((h2 - Math.floor(h2)) * 44), 1, 1,
        `rgba(255,244,224,${(0.16 + 0.26 * Math.abs(Math.sin(t * 0.8 + i))).toFixed(2)})`);
    }
    /* 銭湯の高い煙突（六十八年の証拠） */
    P(ctx, 258, 18, 16, 92, '#3a3438');
    P(ctx, 256, 18, 20, 5, '#4c454c');
    ctx.font = '7px "DotGothic16",sans-serif';
    ctx.save(); ctx.translate(266, 46); ctx.rotate(Math.PI / 2);
    ctx.textAlign = 'left'; ctx.fillStyle = '#d8d2c6'; ctx.fillText('ゆ', -4, 3); ctx.restore();
    wisp(ctx, 260, 14, 4, .35);

    /* 商店街のアーケード（左から店の前まで） */
    P(ctx, 0, 60, 150, 10, '#4a3a30');
    P(ctx, 0, 70, 150, 3, '#5e4a3c');
    for (let x = 8; x < 150; x += 22) P(ctx, x, 73, 3, 12, '#3a2e26');
    /* アーケードの下の店（閉まったシャッターと、開いている惣菜屋） */
    P(ctx, 0, 85, 66, 55, '#2c2622');
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1;
    for (let y = 90; y < 138; y += 5) { ctx.beginPath(); ctx.moveTo(2, y); ctx.lineTo(64, y); ctx.stroke(); }
    P(ctx, 70, 85, 56, 55, '#3a3026');
    P(ctx, 74, 92, 48, 30, `rgba(255,206,130,${(0.5 + 0.08 * Math.sin(t)).toFixed(2)})`);
    person(ctx, 88, 130, '#6a5a4a');
    ctx.font = '6px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#3a2a18'; ctx.fillText('そうざい', 98, 104);
    ctx.textAlign = 'left';

    /* ── 本体：松乃湯（瓦屋根・木の壁・唐破風ふうの玄関）── */
    const X = 152, W = 150, BASE = 140;
    /* 瓦屋根 */
    ctx.fillStyle = '#3c4450';
    ctx.beginPath(); ctx.moveTo(X - 12, 96); ctx.lineTo(X + W / 2, 62); ctx.lineTo(X + W + 12, 96); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(X - 12 + i * 8, 96 - i * 1.5); ctx.lineTo(X + W / 2, 62 + i * 5); ctx.stroke();
    }
    P(ctx, X - 14, 94, W + 28, 4, '#2c333e');
    /* 木の壁 */
    P(ctx, X, 98, W, BASE - 98, '#5e4a38');
    ctx.strokeStyle = 'rgba(30,20,12,.35)';
    for (let x = X + 8; x < X + W; x += 10) { ctx.beginPath(); ctx.moveTo(x, 98); ctx.lineTo(x, BASE); ctx.stroke(); }
    /* 玄関（唐破風の小屋根とのれん） */
    ctx.fillStyle = '#4c454c';
    ctx.beginPath(); ctx.moveTo(X + 42, 104); ctx.quadraticCurveTo(X + 75, 92, X + 108, 104);
    ctx.lineTo(X + 104, 108); ctx.quadraticCurveTo(X + 75, 98, X + 46, 108); ctx.closePath(); ctx.fill();
    P(ctx, X + 52, 108, 46, 32, '#241c14');
    P(ctx, X + 54, 110, 42, 13, '#2a4a6a');                    // 藍ののれん
    ctx.strokeStyle = '#1a3350'; ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(X + 54 + i * 14, 110); ctx.lineTo(X + 54 + i * 14, 123); ctx.stroke(); }
    ctx.font = '7px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#f5ead8'; ctx.fillText('ゆ', X + 75, 119);
    ctx.textAlign = 'left';
    /* 電球色の看板（裸文字。ネオンではない） */
    P(ctx, X + 28, 86, 94, 13, '#241c14');
    ctx.font = 'bold 9px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(255,214,130,${(0.85 + 0.1 * Math.sin(t * 1.1)).toFixed(2)})`;
    ctx.fillText('松乃湯', X + 75, 96);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,214,130,.06)';
    ctx.beginPath(); ctx.arc(X + 75, 92, 30, 0, Math.PI * 2); ctx.fill();
    /* 格子窓（湯気で白い） */
    for (const wx of [X + 10, X + 114]) {
      P(ctx, wx, 106, 26, 26, '#1c1610');
      P(ctx, wx + 2, 108, 22, 22, 'rgba(255,244,224,.34)');
      ctx.strokeStyle = '#3a2e22'; ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(wx + i * 9, 106); ctx.lineTo(wx + i * 9, 132); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(wx, 106 + i * 9); ctx.lineTo(wx + 26, 106 + i * 9); ctx.stroke();
      }
      wisp(ctx, wx + 8, 112, 2, .22);
    }
    /* 入口横の手書き料金札（審査：コスパ市内一位を外観で語る） */
    P(ctx, X + 40, 112, 3, 24, '#3a2e22');
    P(ctx, X + 30, 110, 24, 20, '#e8e2d2'); P(ctx, X + 30, 110, 24, 2, '#c8c2b2');
    ctx.font = '5px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#3a2a18';
    ctx.fillText('入浴+サウナ', X + 42, 118);
    ctx.font = 'bold 7px "DotGothic16",sans-serif';
    ctx.fillText('850円', X + 42, 127);
    ctx.textAlign = 'left';
    /* 玄関先：自転車と、風呂桶を抱えた常連 */
    const bike = (x) => {
      ctx.strokeStyle = '#8a8578'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, BASE + 14, 6, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 16, BASE + 14, 6, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, BASE + 14); ctx.lineTo(x + 8, BASE + 4); ctx.lineTo(x + 16, BASE + 14); ctx.stroke();
      P(ctx, x + 5, BASE + 2, 8, 2, '#8a8578');
    };
    bike(X - 30); bike(X - 6);
    person(ctx, X + 66, BASE + 16, '#5a6b8a');
    P(ctx, X + 76, BASE + 8, 8, 5, '#e8c04a');                 // 黄色い桶

    /* 石畳ふうの路地 */
    P(ctx, 0, BASE, 360, 60, '#2a2622');
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1;
    for (let y = BASE + 8; y < 200; y += 11) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,214,130,.05)';
    ctx.beginPath(); ctx.ellipse(X + 75, BASE + 8, 56, 12, 0, 0, Math.PI * 2); ctx.fill();
  }

  /* ══════════════════════════════════════════════════════
     松乃湯 ── 男湯（蒸岳のペンキ絵と、多彩な湯）
     ------------------------------------------------------------
     台本「電気、ジャグジー、ラドン。攻略したくなる湯がずらりと並ぶ」。
     背景に**蒸岳のペンキ絵**＝✨80の中身。カラン、ケロリンの桶
     ══════════════════════════════════════════════════════ */
  function y_fukurai_1f(ctx) {
    const t = T();

    /* ペンキ絵（蒸岳と湖。壁いっぱい） */
    const sky = ctx.createLinearGradient(0, 0, 0, 96);
    sky.addColorStop(0, '#7db4dc'); sky.addColorStop(1, '#cfe4ee');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 360, 108);
    // 蒸岳（大きく・雪の帽子・頂から湯気の意匠）
    ctx.fillStyle = '#5a7a9a';
    ctx.beginPath(); ctx.moveTo(60, 108); ctx.lineTo(180, 20); ctx.lineTo(300, 108); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#48688a';
    ctx.beginPath(); ctx.moveTo(180, 20); ctx.lineTo(300, 108); ctx.lineTo(214, 108); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f0f4f8';
    ctx.beginPath(); ctx.moveTo(158, 36); ctx.lineTo(180, 20); ctx.lineTo(202, 36);
    ctx.lineTo(192, 42); ctx.lineTo(180, 34); ctx.lineTo(168, 42); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.fillRect(168, 8, 24, 5); ctx.fillRect(176, 3, 18, 4);   // 頂の湯気雲
    // 手前の松（松乃町の松）
    for (const [px2, ps] of [[36, 1], [318, 1.1]]) {
      P(ctx, px2, 78, 5 * ps, 30 * ps, '#5a4632');
      ctx.fillStyle = '#3f6e3c';
      ctx.beginPath(); ctx.arc(px2 + 2, 72, 13 * ps, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px2 - 8, 80, 9 * ps, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px2 + 12, 80, 9 * ps, 0, Math.PI * 2); ctx.fill();
    }
    /* ペンキ絵の枠（ここまでが絵） */
    P(ctx, 0, 106, 360, 4, '#2a3a4a');

    /* 湯船の列（電気・ジャグジー・ラドン＝色と札で描き分け） */
    const BY = 118, BH = 40;
    P(ctx, 0, BY - 8, 360, 8, '#8a9298');                     // タイルの縁
    P(ctx, 0, BY - 8, 360, 2, '#aab4ba');
    const baths = [
      [4, 112, '#3f6f8a', 'electric', '電気'],
      [122, 112, '#4a7a96', 'jet', 'ジャグジー'],
      [240, 116, '#5a6a9a', 'radon', 'ラドン'],
    ];
    for (const [bx, bw, col, kind, name] of baths) {
      P(ctx, bx, BY, bw, BH, col);
      ripple(ctx, bx + 4, BY + 12, bw - 8, 'rgba(220,240,255,.35)');
      ripple(ctx, bx + 4, BY + 26, bw - 8, 'rgba(220,240,255,.22)');
      if (kind === 'electric') {
        for (let i = 0; i < 4; i++) {
          const pu = 0.4 + 0.5 * Math.sin(t * 5 + i * 1.3);
          P(ctx, bx + 16 + i * 22, BY + 18, 3, 3, `rgba(180,220,255,${pu.toFixed(2)})`);
        }
      } else if (kind === 'jet') {
        for (let i = 0; i < 8; i++) {
          const rise = (t * 20 + i * 9) % (BH - 8);
          P(ctx, bx + 10 + i * 12, Math.round(BY + BH - 4 - rise), 2, 3, 'rgba(255,255,255,.5)');
        }
      } else {
        wisp(ctx, bx + 20, BY + 4, 3, .35); wisp(ctx, bx + 60, BY + 6, 2, .3);
      }
      /* 木の札 */
      P(ctx, bx + 6, BY - 20, 40, 12, '#c8b48a'); P(ctx, bx + 6, BY - 20, 40, 2, '#e0d0a0');
      ctx.font = '6px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = '#4a3418'; ctx.fillText(name, bx + 26, BY - 11);
      ctx.textAlign = 'left';
      /* 仕切り */
      P(ctx, bx + bw, BY - 4, 4, BH + 4, '#7a848a');
    }
    /* 浸かる人 */
    const soak = (x, y) => { P(ctx, x, y, 8, 7, '#f0cda6'); P(ctx, x, y - 2, 8, 3, '#3b2d24'); };
    soak(46, BY + 16); soak(176, BY + 18); soak(292, BY + 14);

    /* 手前：カランの列と、ケロリン色の桶 */
    P(ctx, 0, BY + BH, 360, 200 - BY - BH, '#9aa2a6');
    ctx.strokeStyle = 'rgba(60,66,70,.3)'; ctx.lineWidth = 1;
    for (let x = 0; x < 360; x += 20) { ctx.beginPath(); ctx.moveTo(x, BY + BH); ctx.lineTo(x, 200); ctx.stroke(); }
    for (let i = 0; i < 6; i++) {
      const kx = 22 + i * 58;
      karan(ctx, kx, BY + BH + 8);
      P(ctx, kx + 12, BY + BH + 16, 12, 6, '#e8c04a');        // 黄色い桶
      P(ctx, kx + 12, BY + BH + 16, 12, 2, '#f0d060');
    }
    /* 座って洗う人（一人だけ・背中） */
    P(ctx, 138, BY + BH + 4, 14, 18, '#e0ac84');
    P(ctx, 141, BY + BH - 5, 9, 9, '#f0cda6'); P(ctx, 141, BY + BH - 7, 9, 4, '#8a8578');
  }

  /* ══════════════════════════════════════════════════════
     松乃湯 ── サウナと名水の水風呂（🔥65・💧85）
     ------------------------------------------------------------
     台本「サウナは一室だけ。百八度、詰めて八人。扉を開けた瞬間に熱が顔を殴ってくる。
           名水の水風呂——この水のために、わざわざ来る人がいる」
     ══════════════════════════════════════════════════════ */
  function y_fukurai_sauna(ctx) {
    const t = T();

    /* タイルの壁（昭和の水色） */
    P(ctx, 0, 0, 360, 132, '#8fb0b8');
    ctx.strokeStyle = 'rgba(60,80,88,.30)'; ctx.lineWidth = 1;
    for (let y = 10; y < 132; y += 10) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); }
    for (let x = 0; x < 360; x += 12) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 132); ctx.stroke(); }

    /* ── 左：サウナ室（外から見た木の箱・扉が開く瞬間）── */
    P(ctx, 14, 26, 150, 116, '#6a4a2c');
    P(ctx, 14, 26, 150, 5, '#8a6238');
    ctx.strokeStyle = 'rgba(30,18,8,.4)';
    for (let y = 36; y < 140; y += 9) { ctx.beginPath(); ctx.moveTo(14, y); ctx.lineTo(164, y); ctx.stroke(); }
    /* 扉（少し開いて、熱の色が漏れる） */
    P(ctx, 96, 46, 52, 96, '#4a3018');
    P(ctx, 100, 50, 44, 88, '#33200e');
    P(ctx, 138, 50, 6, 88, `rgba(255,140,50,${(0.5 + 0.14 * Math.sin(t * 3)).toFixed(2)})`);
    wisp(ctx, 138, 46, 3, .5);
    P(ctx, 132, 92, 4, 10, '#c8a03a');                        // 取っ手
    /* 丸窓から中（ぎっしり座る肩） */
    ctx.fillStyle = '#1c1006'; ctx.beginPath(); ctx.arc(118, 74, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a2c22'; ctx.beginPath(); ctx.arc(118, 74, 10, 0, Math.PI * 2); ctx.fill();
    P(ctx, 111, 76, 5, 6, '#e0ac84'); P(ctx, 118, 75, 5, 7, '#d8a078');
    /* 「108」の札 */
    P(ctx, 30, 44, 44, 26, '#241c14');
    ctx.font = 'bold 13px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(255,150,60,${(0.85 + 0.1 * Math.sin(t * 2)).toFixed(2)})`;
    ctx.fillText('108', 52, 61);
    ctx.font = '6px "DotGothic16",sans-serif'; ctx.fillStyle = '#c8b48a';
    ctx.fillText('定員八名', 52, 80);
    ctx.textAlign = 'left';
    /* 外で待つ人（満室＝一人が扉の前に立つ） */
    P(ctx, 70, 116, 16, 26, '#e0aa7e');
    P(ctx, 73, 106, 10, 11, '#f0cda6'); P(ctx, 73, 104, 10, 4, '#3b2d24');
    P(ctx, 71, 124, 14, 5, '#f2efe6');

    /* ── 右：名水の水風呂（岩肌・竹樋・光る水）── */
    P(ctx, 182, 60, 164, 82, '#5a544a');
    for (let i = 0; i < 12; i++) {
      const rx = 186 + (i * 37) % 150, ry2 = 64 + (i * 23) % 20;
      P(ctx, rx, ry2, 12 + (i % 3) * 5, 7, i % 2 ? '#6a6258' : '#4c463e');
    }
    /* 竹樋から水 */
    P(ctx, 236, 56, 60, 6, '#8a7a4a'); P(ctx, 236, 56, 60, 2, '#a89660');
    P(ctx, 292, 52, 6, 10, '#6a5a34');
    for (let i = 0; i < 6; i++) {
      const d = (t * 46 + i * 5) % 24;
      P(ctx, 262 + (i % 2) * 4, Math.round(62 + d), 2, 5, `rgba(210,240,255,${(0.6 - d / 40).toFixed(2)})`);
    }
    /* 水面（青く澄んで、底の岩が見える＝名水） */
    const WY = 86, WH = 56;
    P(ctx, 190, WY, 148, WH, '#2a6a8a');
    ctx.fillStyle = 'rgba(180,230,250,.14)';
    ctx.fillRect(196, WY + 8, 40, 16); ctx.fillRect(258, WY + 22, 52, 14);   // 底の岩の透け
    ripple(ctx, 194, WY + 10, 140, 'rgba(220,244,255,.44)');
    ripple(ctx, 194, WY + 26, 140, 'rgba(220,244,255,.30)');
    ripple(ctx, 194, WY + 42, 140, 'rgba(220,244,255,.18)');
    /* きらめき（名水＝光の粒） */
    for (let i = 0; i < 6; i++) {
      const h = Math.sin(i * 12.9898 + Math.floor(t * 2)) * 43758.5453;
      const gx = 196 + Math.floor((h - Math.floor(h)) * 136);
      P(ctx, gx, WY + 6 + (i * 17) % (WH - 12), 2, 2,
        `rgba(255,255,255,${(0.4 + 0.4 * Math.abs(Math.sin(t * 3 + i))).toFixed(2)})`);
    }
    /* 頭まで浸かりそうな人（気持ちよさに目を閉じる） */
    P(ctx, 250, WY + 24, 9, 8, '#f0cda6'); P(ctx, 250, WY + 22, 9, 4, '#3b2d24');
    ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(252, WY + 27); ctx.lineTo(253, WY + 27);
    ctx.moveTo(255, WY + 27); ctx.lineTo(256, WY + 27); ctx.stroke();
    /* 「名水」の札 */
    P(ctx, 306, 66, 16, 30, '#c8b48a');
    ctx.font = '7px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#2a4a6a'; ctx.fillText('名', 314, 78); ctx.fillText('水', 314, 90);
    ctx.textAlign = 'left';

    /* 床 */
    P(ctx, 0, 142, 360, 58, '#9aa2a6');
    ctx.strokeStyle = 'rgba(60,66,70,.3)';
    for (let y = 150; y < 200; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); }
    P(ctx, 0, 142, 360, 2, '#b4bcc0');
    P(ctx, 196, 152, 12, 6, '#e8c04a');                       // 桶
  }

  /* ══════════════════════════════════════════════════════
     松乃湯 ── 番台と脱衣所（🛋25の現場）
     ------------------------------------------------------------
     台本「休憩用の椅子は、脱衣所の隅に二脚だけ置いてあった」。
     鉄治の番台・柳行李の棚・扇風機・体重計＝六十八年の生活
     ══════════════════════════════════════════════════════ */
  function y_fukurai_2f(ctx) {
    const t = T();

    /* 板の間（飴色） */
    P(ctx, 0, 0, 360, 200, '#8a6c48');
    P(ctx, 0, 0, 360, 14, '#6e5638');
    ctx.strokeStyle = 'rgba(60,40,20,.3)'; ctx.lineWidth = 1;
    for (let x = 10; x < 360; x += 12) { ctx.beginPath(); ctx.moveTo(x, 14); ctx.lineTo(x, 110); ctx.stroke(); }
    /* 格天井の照明（蛍光灯） */
    P(ctx, 120, 8, 120, 6, '#f0f0e0');
    ctx.fillStyle = 'rgba(240,240,220,.06)'; ctx.fillRect(90, 14, 180, 60);

    /* ── 左：番台（高い台・鉄治が座る）── */
    P(ctx, 16, 40, 74, 84, '#5e4a38');
    P(ctx, 16, 40, 74, 5, '#7a6248');
    ctx.strokeStyle = 'rgba(30,20,12,.4)';
    for (let y = 52; y < 124; y += 10) { ctx.beginPath(); ctx.moveTo(16, y); ctx.lineTo(90, y); ctx.stroke(); }
    /* 鉄治（作務衣・胸ポケットにレンチ・仏頂面） */
    P(ctx, 38, 22, 26, 24, '#3f4a56');
    P(ctx, 43, 8, 15, 15, '#e8bc94');
    P(ctx, 43, 5, 15, 6, '#8a8578');                          // 白髪まじり
    P(ctx, 47, 13, 2, 2, '#4a342a'); P(ctx, 53, 13, 2, 2, '#4a342a');
    ctx.strokeStyle = '#7a5a48'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(47, 19); ctx.lineTo(55, 19); ctx.stroke();   // 一文字の口
    P(ctx, 58, 26, 4, 12, '#8a9298');                         // レンチ
    P(ctx, 57, 24, 6, 3, '#aab4ba');
    /* 番台の小物（釣り銭皿・飴の瓶） */
    P(ctx, 22, 46, 14, 5, '#c8a03a');
    P(ctx, 70, 44, 10, 12, '#c8b48a'); P(ctx, 70, 44, 10, 3, '#8a3030');
    /* 番台の奥の壁に、古い夫婦写真（春江の仕込み①＝GONIN_OWNERS.md。説明はしない） */
    P(ctx, 20, 6, 14, 11, '#6a5038'); P(ctx, 21, 7, 12, 9, '#d8d0be');
    P(ctx, 23, 9, 3, 3, '#8a8578'); P(ctx, 28, 9, 3, 3, '#4a3a30');        // 白髪の女と、若い鉄治
    P(ctx, 23, 12, 3, 3, '#b0687a'); P(ctx, 28, 12, 3, 3, '#3f4a56');

    /* ── 中央：柳行李の棚（鍵の木札）── */
    P(ctx, 110, 30, 130, 94, '#6a5236');
    P(ctx, 110, 30, 130, 4, '#8a6c48');
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
      P(ctx, 116 + c * 25, 38 + r * 22, 21, 18, '#4a3826');
      P(ctx, 118 + c * 25, 40 + r * 22, 17, 14, '#8a7458');
      ctx.strokeStyle = 'rgba(40,26,12,.5)';
      ctx.strokeRect(118.5 + c * 25, 40.5 + r * 22, 16, 13);
      if (((r * 5 + c) % 3) < 1) P(ctx, 124 + c * 25, 44 + r * 22, 6, 8, '#c8b48a');  // 木札の鍵
    }

    /* ── 右：ここが🛋25＝椅子は二脚だけ。**扇風機の真正面に並べる**（審査）── */
    for (const [cx2, occ] of [[286, true], [316, false]]) {
      P(ctx, cx2, 96, 22, 5, '#4a3826');                      // 丸椅子
      P(ctx, cx2 + 3, 101, 4, 16, '#3a2c1e'); P(ctx, cx2 + 15, 101, 4, 16, '#3a2c1e');
      if (occ) {
        P(ctx, cx2 + 2, 74, 18, 24, '#e0aa7e');
        P(ctx, cx2 + 5, 62, 12, 13, '#f0cda6'); P(ctx, cx2 + 5, 60, 12, 4, '#8a8578');
        P(ctx, cx2, 92, 22, 5, '#f2efe6');                    // 腰のタオル
        /* コーヒー牛乳（腰に手・一気飲み） */
        P(ctx, cx2 + 20, 66, 5, 9, '#c8b48a'); P(ctx, cx2 + 20, 66, 5, 3, '#8a5a2c');
      }
    }
    /* 扇風機（首を振る） */
    const fa = Math.sin(t * 1.4) * 0.5;
    P(ctx, 330, 60, 4, 40, '#4c454c');
    ctx.save(); ctx.translate(332, 56); ctx.rotate(fa);
    ctx.fillStyle = '#8a9298'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#aab4ba';
    for (let k = 0; k < 3; k++) {
      const a = t * 9 + k * Math.PI * 2 / 3;
      ctx.beginPath(); ctx.ellipse(Math.cos(a) * 6, Math.sin(a) * 6, 6, 3, a, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    /* 扇風機の風が椅子へ流れる（取り合いの一席） */
    for (let i = 0; i < 3; i++) {
      const d = (t * 30 + i * 14) % 42;
      ctx.strokeStyle = `rgba(220,235,245,${(0.3 * (1 - d / 42)).toFixed(3)})`; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k <= 10; k += 2)
        ctx.lineTo(326 - d + k - 8, 62 + i * 9 + Math.sin(k * 0.8 + t * 4) * 1.5);
      ctx.stroke();
    }
    /* 体重計（昭和の丸目盛り） */
    P(ctx, 128, 140, 22, 30, '#8a3030'); P(ctx, 128, 140, 22, 4, '#a84040');
    ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.arc(139, 150, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5a3f28'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(139, 150); ctx.lineTo(139, 144); ctx.stroke();

    /* 床（籐のマットと、脱いだままの服の籠） */
    P(ctx, 0, 128, 360, 72, '#a5845a');
    ctx.strokeStyle = 'rgba(90,56,28,.25)';
    for (let y = 134; y < 200; y += 8) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); }
    for (const bx of [40, 210, 292]) {
      P(ctx, bx, 156, 30, 14, '#c8b48a'); P(ctx, bx, 156, 30, 3, '#e0d0a0');
      ctx.strokeStyle = 'rgba(120,90,50,.6)';
      for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(bx + i * 7, 156); ctx.lineTo(bx + i * 7, 170); ctx.stroke(); }
      P(ctx, bx + 4, 152, 18, 6, ['#5a6b8a', '#7a5a6a', '#4a5a50'][bx % 3]);
    }
  }


  /* ══════════════════════════════════════════════════════
     【試作】SAUNA GATE 37｜セルフロウリュ室（**中に入った絵**）
     ------------------------------------------------------
     作者提供の写真をゲームの絵に起こしたもの。俯瞰図ではなく、
     **その部屋に立ったときに目に入るもの**を描く。
       ・左に煉瓦の壁と、金網の籠に入った大きなストーブ
       ・ストーブを囲う荒材の柵
       ・正面に二段のベンチ、座面に生成りのマット
       ・壁の温度計と、灯り
       ・右は一面の窓。ととのい市の街と川が見える（昼）
       ・床は黒と白の市松のマット、丸太の椅子が二つ
     ══════════════════════════════════════════════════════ */
  function y_tenku_sauna_in(ctx) {
    const t = T();
    const VX = 196, VY = 96;                 // 消失点

    /* ── 天井（濃い木・梁）── */
    P(ctx, 0, 0, 360, 30, '#3a2c20');
    P(ctx, 0, 0, 360, 8, '#4a3828');
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(i * 44, 0); ctx.lineTo(i * 44 + 12, 30); ctx.stroke(); }
    P(ctx, 44, 4, 96, 10, '#5a4632');        // 手前の梁
    P(ctx, 168, 6, 6, 5, '#1c1610');         // 天井の小さな吸気口

    /* ── 正面の壁（濃い木の板）── */
    P(ctx, 96, 30, 132, 92, '#3a2418');
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1;
    for (let x = 104; x < 228; x += 11) { ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x, 122); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,190,120,.06)';
    for (let x = 106; x < 228; x += 11) { ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x, 122); ctx.stroke(); }
    // 温度計（丸い文字盤）
    ctx.fillStyle = '#c8a86a'; ctx.beginPath(); ctx.arc(150, 46, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.arc(150, 46, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5a3f28'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(150, 46); ctx.lineTo(155, 42); ctx.stroke();
    P(ctx, 149, 38, 2, 2, '#8a3030');
    // 壁の灯り（オレンジ）
    const fl = 0.6 + 0.4 * Math.sin(t * 3);
    ctx.fillStyle = `rgba(255,178,70,${(0.18 * fl).toFixed(2)})`;
    ctx.beginPath(); ctx.arc(206, 44, 14, 0, Math.PI * 2); ctx.fill();
    P(ctx, 203, 38, 6, 12, '#2a2018'); P(ctx, 204, 39, 4, 9, '#ffce7a');
    // 木の飾り格子
    for (let i = 0; i < 5; i++) P(ctx, 214, 34 + i * 5, 10, 3, '#5a4028');

    /* ── 右：一面の窓（ととのい市の街・昼）── */
    // 窓枠
    P(ctx, 228, 24, 132, 92, '#4a3020');
    P(ctx, 234, 30, 126, 74, '#dfe8ee');
    // 空
    const sky = ctx.createLinearGradient(0, 30, 0, 104);
    sky.addColorStop(0, '#e6eef4'); sky.addColorStop(1, '#cddae4');
    ctx.fillStyle = sky; ctx.fillRect(234, 30, 126, 74);
    // 遠景のビル群
    const towers = [[240, 44, 12, 40], [254, 36, 10, 48], [266, 48, 9, 36], [277, 40, 13, 44],
                    [292, 52, 8, 32], [302, 34, 12, 50], [316, 46, 10, 38], [328, 40, 14, 44],
                    [344, 50, 12, 34]];
    for (const [bx, by, bw, bh] of towers) {
      P(ctx, bx, by, bw, bh, '#aebac4');
      P(ctx, bx, by, bw, 2, '#c4ced6');
      ctx.fillStyle = 'rgba(90,110,128,.55)';
      for (let r = 0; r < Math.floor(bh / 5); r++) for (let c = 0; c < Math.floor(bw / 4); c++) {
        if (((r * 3 + c * 5 + bx) % 4) < 2) ctx.fillRect(bx + 1 + c * 4, by + 3 + r * 5, 2, 3);
      }
    }
    // 手前のビル（低層）
    for (let i = 0; i < 8; i++) P(ctx, 236 + i * 16, 78, 14, 10, i % 2 ? '#9fb0bc' : '#8fa2b0');
    // 川
    P(ctx, 234, 88, 126, 10, '#7fa4b8');
    for (let i = 0; i < 5; i++) ripple(ctx, 240 + i * 24, 92, 20, 'rgba(255,255,255,.45)');
    // 対岸の緑
    P(ctx, 234, 98, 126, 6, '#6f9060');
    for (let i = 0; i < 14; i++) P(ctx, 236 + i * 9, 96, 5, 4, '#5f8052');
    // 窓の桟
    ctx.strokeStyle = '#4a3020'; ctx.lineWidth = 4; ctx.strokeRect(234, 30, 126, 74);
    // 窓の下の木の棚（受け）
    P(ctx, 222, 104, 138, 12, '#8a5f34');
    P(ctx, 222, 104, 138, 3, '#a8763f');
    P(ctx, 226, 116, 134, 8, '#6a4526');
    // 棚の下の間接照明
    ctx.fillStyle = 'rgba(255,190,110,.16)'; ctx.fillRect(226, 122, 134, 8);

    /* ── 左：煉瓦の壁 ── */
    P(ctx, 0, 24, 96, 126, '#6e6a4e');
    for (let r = 0; r < 14; r++) {
      const y = 26 + r * 9;
      ctx.strokeStyle = 'rgba(40,40,26,.42)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(96, y); ctx.stroke();
      for (let x = (r % 2 ? 0 : 12); x < 96; x += 24) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 9); ctx.stroke();
      }
      // 煉瓦ごとの色ムラ（苔・焼け）
      for (let x = (r % 2 ? 0 : 12); x < 96; x += 24) {
        const k = (r * 7 + x) % 5;
        if (k === 0) P(ctx, x + 1, y + 1, 22, 7, '#5f6a48');
        else if (k === 2) P(ctx, x + 1, y + 1, 22, 7, '#7a7452');
      }
    }
    // 煉瓦壁の奥行き（正面壁との継ぎ目を斜めに）
    ctx.fillStyle = '#4a4632';
    ctx.beginPath(); ctx.moveTo(96, 24); ctx.lineTo(96, 150); ctx.lineTo(110, 132); ctx.lineTo(110, 30); ctx.closePath(); ctx.fill();

    /* ── ストーブ（金網の籠にサウナストーン。大きい）──
       石は下ほど焼けて赤い。**火の口だけは網より上に描く**（網をかけると色が濁る） */
    const sx = 40, sy = 56, sw = 52, sh = 88;
    const g = 0.55 + 0.45 * Math.sin(t * 4);
    // 背後の火明かりが煉瓦を照らす
    ctx.fillStyle = 'rgba(255,130,45,' + (0.16 * g).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(sx + sw / 2, sy + sh - 18, 62, 0, Math.PI * 2); ctx.fill();
    // 籠の外枠（金属）
    P(ctx, sx - 4, sy - 5, sw + 8, sh + 9, '#4a4a50');
    P(ctx, sx - 2, sy - 3, sw + 4, sh + 5, '#6a6a70');
    P(ctx, sx, sy, sw, sh, '#2a2620');
    // サウナストーンを積む
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 4; c++) {
        const px = sx + 2 + c * 12 + (r % 2 ? 5 : 0), py = sy + 3 + r * 11;
        if (px + 11 > sx + sw) continue;
        const heat = Math.max(0, (r - 3) / 4) * g;
        P(ctx, px, py, 11, 10, ['#c0b8a6', '#a29a8c', '#d0c8b6', '#8e8678'][(r * 3 + c) % 4]);
        P(ctx, px + 1, py + 1, 9, 3, 'rgba(255,255,255,.16)');
        P(ctx, px, py + 7, 11, 3, 'rgba(0,0,0,.22)');
        if (heat > 0.02) {
          ctx.fillStyle = 'rgba(255,105,35,' + (0.72 * heat).toFixed(2) + ')';
          ctx.fillRect(px, py, 11, 10);
          ctx.fillStyle = 'rgba(255,190,110,' + (0.3 * heat).toFixed(2) + ')';
          ctx.fillRect(px + 2, py + 2, 7, 4);
        }
      }
    }
    // 金網（石の上・火の下）
    ctx.strokeStyle = 'rgba(210,205,195,.26)'; ctx.lineWidth = 1;
    for (let i = 0; i <= sw; i += 7) { ctx.beginPath(); ctx.moveTo(sx + i, sy); ctx.lineTo(sx + i, sy + sh); ctx.stroke(); }
    for (let i = 0; i <= sh; i += 7) { ctx.beginPath(); ctx.moveTo(sx, sy + i); ctx.lineTo(sx + sw, sy + i); ctx.stroke(); }
    // **いちばん下＝燃えている口**
    ctx.fillStyle = 'rgba(255,140,45,.85)';
    ctx.fillRect(sx + 3, sy + sh - 22, sw - 6, 19);
    ctx.fillStyle = 'rgba(255,190,90,' + (0.55 + 0.3 * g).toFixed(2) + ')';
    ctx.fillRect(sx + 6, sy + sh - 19, sw - 12, 13);
    ctx.fillStyle = 'rgba(255,240,190,' + (0.45 + 0.35 * g).toFixed(2) + ')';
    ctx.fillRect(sx + 11, sy + sh - 16, sw - 22, 6);
    ctx.strokeStyle = 'rgba(80,30,10,.5)'; ctx.lineWidth = 1;
    for (let i = 6; i < sw - 6; i += 7) { ctx.beginPath(); ctx.moveTo(sx + i, sy + sh - 22); ctx.lineTo(sx + i, sy + sh - 3); ctx.stroke(); }
    // 立ちのぼる熱気
    wisp(ctx, sx + 6, sy - 8, 6, .34);
    // 銘板
    P(ctx, sx + 10, sy + 6, 30, 6, '#1e1e22');
    P(ctx, sx + 13, sy + 8, 24, 2, '#8a8a90');

    /* ── ストーブを囲う荒材の柵 ── */
    // 手前の横木（ゆるく曲がっている）
    ctx.strokeStyle = '#b8925a'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-4, 106); ctx.quadraticCurveTo(56, 84, 118, 96); ctx.stroke();
    ctx.strokeStyle = '#9a7444'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-4, 109); ctx.quadraticCurveTo(56, 87, 118, 99); ctx.stroke();
    // 柱
    P(ctx, 20, 92, 8, 56, '#a8834e'); P(ctx, 20, 92, 3, 56, '#c09a62');
    P(ctx, 92, 88, 8, 52, '#a8834e'); P(ctx, 92, 88, 3, 52, '#c09a62');
    // 柵の足元（石）
    P(ctx, 10, 142, 96, 10, '#c8c0b0');
    P(ctx, 10, 142, 96, 3, '#ded6c6');

    /* ── コンクリートの柱（ストーブの右）── */
    P(ctx, 104, 60, 16, 84, '#b4b0a4');
    P(ctx, 104, 60, 5, 84, '#c8c4b8');
    P(ctx, 102, 56, 20, 6, '#9a968c');

    /* ── 正面の二段ベンチ（生成りのマット付き）── */
    // 上段
    P(ctx, 124, 96, 96, 12, '#8a5f34'); P(ctx, 124, 96, 96, 3, '#a8763f');
    P(ctx, 132, 92, 34, 8, '#e8e0cc'); P(ctx, 172, 92, 34, 8, '#e8e0cc');
    // 背もたれ
    P(ctx, 128, 74, 88, 5, '#a8763f'); P(ctx, 128, 82, 88, 5, '#a8763f');
    P(ctx, 128, 74, 5, 20, '#8a5f34'); P(ctx, 211, 74, 5, 20, '#8a5f34');
    // 下段
    P(ctx, 112, 116, 120, 16, '#8a5f34'); P(ctx, 112, 116, 120, 3, '#a8763f');
    P(ctx, 122, 112, 44, 8, '#e8e0cc'); P(ctx, 174, 112, 44, 8, '#e8e0cc');
    // 段の下の影と脚
    P(ctx, 112, 132, 120, 6, 'rgba(0,0,0,.4)');
    P(ctx, 126, 132, 6, 9, '#6a4526'); P(ctx, 212, 132, 6, 9, '#6a4526');

    /* ── 床（黒白の市松マット。手前ほど大きく）── */
    const FY = 140, FB = 200;
    for (let r = 0; r < 9; r++) {
      const y0 = FY + Math.pow(r / 9, 1.6) * (FB - FY);
      const y1 = FY + Math.pow((r + 1) / 9, 1.6) * (FB - FY);
      const s0 = (y0 - VY) / (FB - VY), s1 = (y1 - VY) / (FB - VY);
      for (let c = -8; c < 9; c++) {
        const xa = VX + c * 46 * s0, xb = VX + (c + 1) * 46 * s0;
        const xc = VX + (c + 1) * 46 * s1, xd = VX + c * 46 * s1;
        ctx.fillStyle = ((r + c) % 2) ? '#33333a' : '#bdb9b0';
        ctx.beginPath(); ctx.moveTo(xa, y0); ctx.lineTo(xb, y0); ctx.lineTo(xc, y1); ctx.lineTo(xd, y1); ctx.closePath(); ctx.fill();
        // マットの織り目
        ctx.strokeStyle = ((r + c) % 2) ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.07)';
        ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xa, y0); ctx.lineTo(xc, y1); ctx.stroke();
      }
    }
    // 床と壁の境目（奥に影を落として、設備が床に乗って見えるようにする）
    P(ctx, 0, FY - 2, 360, 3, '#3a2c1e');
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(0, FY + 1, 360, 7);

    /* ── 丸太の椅子（二つ）── */
    const log = (lx, ly, lw, lh) => {
      P(ctx, lx, ly + 5, lw, lh, '#8a6238');
      ctx.strokeStyle = 'rgba(60,40,20,.5)'; ctx.lineWidth = 1;
      for (let i = 4; i < lw; i += 5) { ctx.beginPath(); ctx.moveTo(lx + i, ly + 5); ctx.lineTo(lx + i, ly + 5 + lh); ctx.stroke(); }
      ctx.fillStyle = '#c09a62';
      ctx.beginPath(); ctx.ellipse(lx + lw / 2, ly + 5, lw / 2, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(120,90,50,.6)';
      for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(lx + lw / 2, ly + 5, (lw / 2) * i / 4, 5 * i / 4, 0, 0, Math.PI * 2); ctx.stroke(); }
      P(ctx, lx - 2, ly + 5 + lh, lw + 4, 3, 'rgba(0,0,0,.3)');
    };
    log(206, 142, 26, 22);
    log(244, 156, 30, 26);

    /* ── 手前右のベンチ（画面のいちばん手前・マットが並ぶ）── */
    P(ctx, 250, 168, 110, 32, '#8a5f34');
    P(ctx, 250, 168, 110, 4, '#a8763f');
    ctx.strokeStyle = 'rgba(60,40,20,.4)'; ctx.lineWidth = 1;
    for (let i = 258; i < 360; i += 10) { ctx.beginPath(); ctx.moveTo(i, 172); ctx.lineTo(i, 200); ctx.stroke(); }
    P(ctx, 256, 176, 46, 14, '#e8e0cc'); P(ctx, 308, 172, 50, 14, '#e8e0cc');
    P(ctx, 262, 194, 44, 6, '#e8e0cc');

    /* ── 部屋全体の空気（暖色のかぶり）と、窓からの光 ── */
    ctx.fillStyle = 'rgba(255,150,60,.06)'; ctx.fillRect(0, 0, 360, 200);
    const lightBeam = ctx.createLinearGradient(300, 40, 150, 190);
    lightBeam.addColorStop(0, 'rgba(255,250,235,.16)'); lightBeam.addColorStop(1, 'rgba(255,250,235,0)');
    ctx.fillStyle = lightBeam; ctx.fillRect(0, 0, 360, 200);

    /* ── セルフロウリュの主役（審査＝王者のコア）──
       柄杓を石にかたむける客。石の上で蒸気が弾け、ベンチの客が熱を受けて目を閉じる */
    (() => {
      const lx = 108, ly = 128;                        // ストーブ右に立つ
      P(ctx, lx, ly - 26, 16, 28, '#e0ac84');          // 体
      P(ctx, lx + 1, ly - 16, 15, 6, '#f2efe6');       // 腰タオル
      P(ctx, lx + 3, ly - 37, 10, 11, '#f0cda6'); P(ctx, lx + 3, ly - 39, 10, 4, '#2c2420');
      // 柄杓（ストーブへ差し出す腕）
      P(ctx, lx - 12, ly - 30, 12, 3, '#e0ac84');
      ctx.strokeStyle = '#8a6238'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(lx - 12, ly - 29); ctx.lineTo(lx - 26, ly - 40); ctx.stroke();
      P(ctx, lx - 32, ly - 46, 9, 6, '#a87c48'); P(ctx, lx - 31, ly - 45, 7, 4, '#6a4a2c');
      // 石の上で弾ける蒸気（強く・周期的）
      const ph = (t % 4) / 4;
      if (ph < 0.5) {
        for (let i2 = 0; i2 < 3; i2++)
          P(ctx, 58 + i2 * 8, Math.round(52 - ((t * 50 + i2 * 7) % 22)), 3, 6,
            `rgba(255,255,255,${(0.5 - ((t * 50 + i2 * 7) % 22) / 50).toFixed(2)})`);
        wisp(ctx, 52, 44, 5, .65); wisp(ctx, 70, 40, 4, .55);
      } else { wisp(ctx, 58, 46, 3, .3); }
    })();
    /* ベンチで熱を受ける客（二人。目を閉じ、うつむき加減） */
    const uke = (x, y) => {
      P(ctx, x, y - 16, 15, 17, '#dca47c');
      P(ctx, x + 3, y - 26, 10, 11, '#f0cda6'); P(ctx, x + 3, y - 28, 10, 4, '#3b2d24');
      ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 5, y - 21); ctx.lineTo(x + 7, y - 21);
      ctx.moveTo(x + 9, y - 21); ctx.lineTo(x + 11, y - 21); ctx.stroke();
      P(ctx, x + 1, y - 6, 13, 4, '#f2efe6');
    };
    uke(196, 118); uke(258, 116);
  }



  /* ══════════════════════════════════════════════════════
     【内観】月白 SPA TERRACE｜浴室（作者提供の写真を、構図そのままドットに）
     ------------------------------------------------------
     写真から拾ったもの：
       手前＝**泡の湧く濃紺の湯**と、**水色のタイルの湯**。あいだを御影石の縁が斜めに走る
       両方の縁に**ステンレスの手すり**が何本も並ぶ
       左＝**白い樹脂の椅子が壁ぎわに一列**
       奥＝オレンジに灯る入口／白い蒸し風呂の扉／石段／八角形の湯／寝椅子／木の扉
       右＝**丸いモザイクの意匠**が二つ、窓の灯り
       上＝石積みの壁と、天井から垂れる蔦
     ══════════════════════════════════════════════════════ */
  function y_lumina_bath_in(ctx) {
    const t = T();
    const rnd = i => (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const poly = (pts, col) => {
      ctx.fillStyle = col; ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath(); ctx.fill();
    };
    // 御影石（黒っぽい地に白い斑）
    const granite = (pts, seed) => {
      poly(pts, '#565049');
      ctx.save(); ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath(); ctx.clip();
      for (let i = 0; i < 900; i++) {
        const px = Math.abs(rnd(i + seed)) * 360, py = 90 + Math.abs(rnd(i + seed + 99)) * 115;
        const k = Math.abs(rnd(i + seed + 7));
        ctx.fillStyle = k > .74 ? '#cac4b8' : k > .5 ? '#8b857b' : k > .25 ? '#413c37' : '#6a645c';
        ctx.fillRect(px | 0, py | 0, 2, 2);
      }
      ctx.restore();
    };
    // ステンレスの手すり（曲げた1本）
    const rail = (x, y, w, h) => {
      ctx.strokeStyle = '#8f979d'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + 4); ctx.lineTo(x + w, y); ctx.stroke();
      ctx.strokeStyle = '#e2e8ec'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - 1, y + h); ctx.lineTo(x - 1, y + 4); ctx.lineTo(x + w, y - 1); ctx.stroke();
      ctx.lineCap = 'butt';
    };
    // 白い樹脂の椅子（背もたれが扇形）
    const chairW = (x, y, s) => {
      const w = Math.round(20 * s), h = Math.round(13 * s);
      P(ctx, x, y + h - 2, w, 3, 'rgba(0,0,0,.25)');
      P(ctx, x, y + 4, w, h - 4, '#e8ecee');            // 座面
      P(ctx, x, y + 4, w, 2, '#ffffff');
      P(ctx, x, y - h + 4, w, h, '#dfe4e8');            // 背もたれ
      ctx.strokeStyle = '#b6bec4'; ctx.lineWidth = 1;
      for (let i = 1; i < 5; i++) {
        const bx = x + (w / 5) * i;
        ctx.beginPath(); ctx.moveTo(bx, y - h + 5); ctx.lineTo(bx, y + 3); ctx.stroke();
      }
      P(ctx, x, y - h + 4, w, 2, '#ffffff');
      P(ctx, x + 1, y + h, 2, Math.round(5 * s), '#c8ced2');
      P(ctx, x + w - 3, y + h, 2, Math.round(5 * s), '#c8ced2');
    };

    /* ── 天井 ── */
    P(ctx, 0, 0, 360, 13, '#241f1c');
    P(ctx, 0, 10, 360, 3, '#3a332e');
    for (let i = 0; i < 7; i++) P(ctx, 22 + i * 52, 2, 16, 5, '#3e3630');
    P(ctx, 176, 1, 10, 8, '#5a5048');                    // 天井の設備

    /* ── 奥の壁（大きな石積み）── */
    P(ctx, 0, 13, 360, 74, '#9c988c');
    ctx.strokeStyle = 'rgba(70,66,58,.45)'; ctx.lineWidth = 1;
    for (let r = 0; r < 5; r++) {
      const y = 20 + r * 15;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke();
      for (let x = (r % 2 ? 0 : 20); x < 360; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 15); ctx.stroke();
      }
    }
    for (let i = 0; i < 90; i++) {                        // 石のムラ
      const px = Math.abs(rnd(i)) * 360, py = 14 + Math.abs(rnd(i + 51)) * 72;
      ctx.fillStyle = Math.abs(rnd(i + 13)) > .5 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
      ctx.fillRect(px | 0, py | 0, 6, 4);
    }
    // 上のほうは緑がかった壁（写真の奥）
    P(ctx, 196, 13, 92, 30, '#8e9c90');

    /* ── 左上：垂れ下がる蔦 ── */
    P(ctx, 0, 13, 108, 8, '#4a4238');
    for (let i = 0; i < 26; i++) {
      const lx = i * 4, len = 6 + (Math.abs(rnd(i + 5)) * 16 | 0);
      ctx.strokeStyle = i % 3 ? '#4f7a44' : '#3f6a38'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(lx, 18); ctx.lineTo(lx + (i % 2 ? 2 : -2), 18 + len); ctx.stroke();
      P(ctx, lx - 2, 18 + len - 3, 5, 4, i % 2 ? '#5e8c4e' : '#487a3e');
      P(ctx, lx - 1, 22 + (i % 3) * 4, 4, 3, '#568449');
    }

    /* ── 左壁：白い掲示板 ── */
    P(ctx, 8, 40, 74, 24, '#eef0ee');
    P(ctx, 8, 40, 74, 4, '#cfd6cc');
    ctx.strokeStyle = '#6f9a63'; ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(12, 48 + i * 3.4); ctx.lineTo(76, 48 + i * 3.4); ctx.stroke(); }
    P(ctx, 10, 42, 8, 8, '#4f7a44');

    /* ── 奥中央：オレンジに灯る入口 ── */
    P(ctx, 92, 24, 46, 56, '#2a221c');
    P(ctx, 96, 28, 38, 50, '#140f0c');
    const fl = 0.6 + 0.4 * Math.sin(t * 3);
    for (const gx of [92, 132]) {
      ctx.fillStyle = 'rgba(255,150,50,' + (0.30 * fl).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(gx, 40, 15, 0, Math.PI * 2); ctx.fill();
      P(ctx, gx - 3, 32, 6, 16, '#2a2018');
      P(ctx, gx - 2, 34, 4, 12, '#ffb45a');
    }
    P(ctx, 100, 60, 30, 18, '#3a2e24');                   // 中の暗がり
    P(ctx, 88, 78, 54, 6, '#6a635a');                     // 敷居

    /* ── 奥中央：白い蒸し風呂の扉（TERMALE）── */
    P(ctx, 146, 18, 44, 62, '#c8ccd0');
    P(ctx, 149, 21, 38, 56, '#e6eaee');
    P(ctx, 154, 26, 28, 30, '#aab4bc');                   // すりガラス
    P(ctx, 156, 28, 24, 12, '#cdd6dc');
    P(ctx, 158, 60, 20, 12, '#8f979d');
    ctx.font = '6px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#e8ecee'; ctx.fillText('TERMALE', 168, 15);
    ctx.textAlign = 'left';
    P(ctx, 194, 26, 12, 22, '#d8dce0');                   // 隣の機器
    P(ctx, 196, 30, 8, 6, '#f0d060');

    /* ── 奥右：木の扉と掲示 ── */
    P(ctx, 262, 20, 26, 54, '#a8763f');
    P(ctx, 265, 23, 20, 48, '#8a5f34');
    P(ctx, 266, 40, 4, 8, '#e2c07a');
    P(ctx, 296, 26, 16, 22, '#eef0ee');
    P(ctx, 298, 30, 12, 3, '#7a8fa8');
    P(ctx, 298, 36, 12, 3, '#7a8fa8');
    // 窓の灯り
    P(ctx, 320, 30, 30, 34, '#5a4a38');
    P(ctx, 323, 33, 24, 28, '#e8b070');
    ctx.fillStyle = 'rgba(255,190,110,.18)';
    ctx.beginPath(); ctx.arc(335, 47, 26, 0, Math.PI * 2); ctx.fill();

    /* ── 奥右：寝椅子 ── */
    P(ctx, 222, 44, 34, 6, '#4a4238');
    P(ctx, 224, 50, 30, 12, '#6a6258');
    ctx.strokeStyle = '#8a8276'; ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(226 + i * 6, 44); ctx.lineTo(226 + i * 6, 62); ctx.stroke(); }
    P(ctx, 226, 62, 4, 6, '#4a4238'); P(ctx, 248, 62, 4, 6, '#4a4238');

    /* ── 床（濡れた石。奥の灯りを映す）── */
    P(ctx, 0, 84, 360, 46, '#8a8378');
    for (let i = 0; i < 130; i++) {
      const px = Math.abs(rnd(i + 200)) * 360, py = 84 + Math.abs(rnd(i + 301)) * 46;
      ctx.fillStyle = Math.abs(rnd(i + 17)) > .55 ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.08)';
      ctx.fillRect(px | 0, py | 0, 5, 3);
    }
    // 入口の灯りの映り込み
    ctx.fillStyle = 'rgba(255,170,80,.16)';
    ctx.beginPath(); ctx.ellipse(114, 96, 34, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,200,130,.14)';
    ctx.beginPath(); ctx.ellipse(330, 92, 30, 10, 0, 0, Math.PI * 2); ctx.fill();
    // 石段
    P(ctx, 138, 84, 66, 6, '#a49c90'); P(ctx, 134, 90, 74, 6, '#948c80');
    P(ctx, 130, 96, 82, 5, '#8a8276');

    /* ── 奥中央右：八角形の湯 ── */
    const oct = (cx, cy, r, sq) => {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = Math.PI / 8 + i * Math.PI / 4;
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * sq;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
    };
    oct(224, 82, 36, .38); ctx.fillStyle = '#7a5638'; ctx.fill();
    oct(224, 82, 31, .38); ctx.fillStyle = '#a8763f'; ctx.fill();
    oct(224, 82, 25, .38); ctx.fillStyle = '#4f8fa8'; ctx.fill();
    ripple(ctx, 204, 80, 40); ripple(ctx, 208, 86, 32);
    wisp(ctx, 212, 76, 3, .22);

    /* ── 右：丸いモザイクの意匠（2つ）── */
    for (const [mx, my, mr] of [[236, 112, 36], [318, 106, 30]]) {
      ctx.fillStyle = '#3a3630';
      ctx.beginPath(); ctx.ellipse(mx, my, mr, mr * .36, 0, 0, Math.PI * 2); ctx.fill();
      for (let ring = 1; ring <= 4; ring++) {
        const rr = mr * ring / 4.4;
        ctx.strokeStyle = ring % 2 ? 'rgba(200,192,178,.55)' : 'rgba(120,112,100,.6)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(mx, my, rr, rr * .36, 0, 0, Math.PI * 2); ctx.stroke();
      }
      for (let i = 0; i < 40; i++) {
        const a = i / 40 * Math.PI * 2, rr = mr * (.35 + Math.abs(rnd(i + mx)) * .6);
        ctx.fillStyle = Math.abs(rnd(i + mx + 3)) > .5 ? '#b8b0a0' : '#6e675e';
        ctx.fillRect((mx + Math.cos(a) * rr) | 0, (my + Math.sin(a) * rr * .36) | 0, 2, 2);
      }
    }

    /* ── 左：白い椅子が壁ぎわに一列（奥ほど小さい）── */
    const chairs = [[104, 82, .72], [78, 89, .82], [48, 97, .92], [14, 106, 1.02]];
    for (const [cx, cy, cs] of chairs) chairW(cx, cy, cs);

    /* ══ 手前：二つの湯 ══════════════════════════════════
       写真どおり、あいだを御影石の縁が斜めに走る                      */
    // 左の湯（泡が湧く濃紺）
    const L_OUT = [[24, 130], [152, 100], [192, 118], [128, 200], [8, 200], [2, 158]];
    granite(L_OUT, 3);
    const L_IN = [[42, 137], [150, 110], [178, 124], [122, 191], [24, 191], [20, 159]];
    poly(L_IN, '#1f3f5e');
    ctx.save(); ctx.beginPath();
    ctx.moveTo(L_IN[0][0], L_IN[0][1]);
    for (let i = 1; i < L_IN.length; i++) ctx.lineTo(L_IN[i][0], L_IN[i][1]);
    ctx.closePath(); ctx.clip();
    // 泡（白く沸き立つ面）
    for (let i = 0; i < 700; i++) {
      const px = 16 + Math.abs(rnd(i + 400)) * 175, py = 104 + Math.abs(rnd(i + 501)) * 96;
      const k = Math.abs(rnd(i + 41));
      const wob = Math.sin(t * 2 + i) * 1.5;
      ctx.fillStyle = k > .66 ? 'rgba(255,255,255,.9)' : k > .42 ? 'rgba(205,232,244,.7)'
                    : k > .2 ? 'rgba(110,170,205,.6)' : 'rgba(45,95,140,.55)';
      ctx.fillRect((px + wob) | 0, py | 0, k > .66 ? 3 : 4, 2);
    }
    for (let i = 0; i < 10; i++) {
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
      ctx.beginPath();
      const yy = 116 + i * 8 + Math.sin(t * 1.6 + i) * 2;
      ctx.moveTo(24, yy); ctx.bezierCurveTo(70, yy - 5, 120, yy + 4, 180, yy - 3); ctx.stroke();
    }
    ctx.restore();
    // 左の湯の手すり（写真どおり縁に何本も並ぶ）
    rail(66, 124, 26, 34); rail(52, 139, 26, 34); rail(38, 154, 26, 34); rail(26, 170, 26, 28);

    // 中央の御影石の縁（斜めに走る）
    granite([[152, 100], [192, 118], [152, 200], [122, 200]], 11);
    P(ctx, 156, 104, 0, 0, '#000');
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(155, 104); ctx.lineTo(188, 120); ctx.stroke();

    // 右の湯（水色のタイル）
    const R_OUT = [[190, 116], [292, 106], [360, 100], [360, 200], [148, 200]];
    granite(R_OUT, 21);
    const R_IN = [[206, 127], [296, 116], [360, 110], [360, 192], [166, 192]];
    poly(R_IN, '#1fa8d8');
    ctx.save(); ctx.beginPath();
    ctx.moveTo(R_IN[0][0], R_IN[0][1]);
    for (let i = 1; i < R_IN.length; i++) ctx.lineTo(R_IN[i][0], R_IN[i][1]);
    ctx.closePath(); ctx.clip();
    // モザイクタイルの底
    for (let y = 108; y < 196; y += 5) for (let x = 160; x < 360; x += 5) {
      const k = Math.abs(rnd(x * 0.7 + y));
      ctx.fillStyle = k > .7 ? '#4fd0f0' : k > .4 ? '#2fbde6' : '#18a0d0';
      ctx.fillRect(x, y, 4, 4);
    }
    // 水面のうねり
    for (let i = 0; i < 12; i++) {
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2;
      const yy = 116 + i * 7 + Math.sin(t * 1.4 + i * .8) * 2;
      ctx.beginPath(); ctx.moveTo(200, yy); ctx.bezierCurveTo(250, yy - 4, 300, yy + 5, 360, yy - 2); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    for (let i = 0; i < 60; i++) {
      const px = 196 + Math.abs(rnd(i + 700)) * 164, py = 112 + Math.abs(rnd(i + 801)) * 80;
      ctx.fillRect(px | 0, py | 0, 3, 2);
    }
    ctx.restore();
    // 右の湯の手すり
    rail(232, 132, 30, 30); rail(264, 126, 32, 30); rail(298, 120, 34, 30); rail(332, 115, 26, 28);

    /* ── 全体の空気（浴室の湿った暖色）── */
    ctx.fillStyle = 'rgba(255,170,90,.05)'; ctx.fillRect(0, 0, 360, 200);
    wisp(ctx, 60, 118, 4, .18); wisp(ctx, 250, 116, 4, .16);

    head(ctx, '月白 SPA TERRACE｜浴室', '泡の湯と、水色の湯。あいだを御影石が斜めに走る', null, true);
  }


  /* ============================================================
     五軒を全部見終わった夜（作者決定 8/2）
     ------------------------------------------------------------
     **五軒の灯りが並んでいて、手前のうちの店だけが暗い。**
     大会は冒頭から既知（battleKnown常時true）。五軒制覇＝「勝てない」を一度そろえてから、
     戦う理由を渡す
     ============================================================ */
  function y_five_town(ctx) {
    const t = T();
    // 夜空
    const g = ctx.createLinearGradient(0, 0, 0, 130);
    g.addColorStop(0, '#080b18'); g.addColorStop(1, '#272138');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 360, 200);
    // 星（並ばないように散らす）
    for (let i = 0; i < 46; i++) {
      const h = Math.sin(i * 12.9898) * 43758.5453;
      const x = Math.floor((h - Math.floor(h)) * 360);
      const h2 = Math.sin(i * 78.233) * 12345.678;
      const y = Math.floor((h2 - Math.floor(h2)) * 74);
      P(ctx, x, y, 1, 1, `rgba(255,255,255,${(0.18 + 0.32 * Math.abs(Math.sin(t + i))).toFixed(2)})`);
    }
    // 遠景のビル（背景）
    for (let i = 0; i < 26; i++) {
      const x = i * 14 + (i % 3) * 3, h = 20 + ((i * 53) % 30), y = 124 - h;
      P(ctx, x, y, 12, h, '#12162a');
    }
    /* 五軒。左から GATE37／森／茶煙楼／月白／松乃湯。**高さと灯りで格を出す** */
    const SHOPS = [
      { x: 12,  w: 42, h: 76, col: '#2b3252', win: '#ffd07a', dense: 1.0 },  // SAUNA GATE 37＝いちばん高い
      { x: 66,  w: 50, h: 58, col: '#2a3450', win: '#ffe0a0', dense: 0.9 },  // ととのいの森＝いちばん広い
      { x: 128, w: 28, h: 42, col: '#3a2a26', win: '#ff9a5c', dense: 0.7 },  // 茶煙楼＝小さいが濃い
      { x: 168, w: 44, h: 60, col: '#2c2f4a', win: '#fff0c8', dense: 0.95 }, // 月白 SPA TERRACE＝白く明るい
      { x: 224, w: 26, h: 38, col: '#2e3230', win: '#c9d8a8', dense: 0.5 },  // 松乃湯＝低くて緑がかった灯り
    ];
    for (const s of SHOPS) {
      const y0 = 124 - s.h;
      P(ctx, s.x, y0, s.w, s.h, s.col);
      P(ctx, s.x, y0, s.w, 2, '#4a5170');
      for (let r = 0; r < Math.floor((s.h - 6) / 8); r++) {
        for (let c = 0; c < Math.floor(s.w / 8); c++) {
          if (((r * 7 + c * 3 + s.x) % 10) / 10 > s.dense) continue;
          P(ctx, s.x + 3 + c * 8, y0 + 6 + r * 8, 4, 4, s.win);
        }
      }
    }
    // 道路
    P(ctx, 0, 124, 360, 22, '#1a1d28');
    P(ctx, 0, 124, 360, 2, '#2a2f3e');
    for (let i = 0; i < 14; i++) P(ctx, ((i * 28 + t * 16) % 380) - 20, 135, 14, 2, '#3a4152');
    /* 手前＝うちの店。**灯りは一つだけ** */
    P(ctx, 288, 100, 60, 72, '#171a22');
    P(ctx, 288, 100, 60, 3, '#242833');
    P(ctx, 286, 164, 64, 8, '#0f1116');
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++)
      P(ctx, 294 + c * 11, 110 + r * 11, 7, 7, '#1e222c');            // 消えた窓
    P(ctx, 316, 132, 7, 7, `rgba(255,190,110,${(0.5 + 0.3 * Math.sin(t * 2)).toFixed(2)})`);
    wisp(ctx, 318, 100, 3, 0.09);
    // 足元（主人公が立っている歩道）
    P(ctx, 0, 172, 360, 28, '#0d0f14');
    P(ctx, 0, 172, 360, 2, '#1c1f28');
  }


  /* ══════════════════════════════════════════════════════
     SAUNA GATE 37 ── 外観（蒸都ターミナルの夜）
     ------------------------------------------------------------
     **月白が「白」なら、GATE 37は「オレンジ」。**
     駅直結のターミナルビル。下層は駅の光、十四階にサウナの火の色。
     ・「37」のネオン＝十四階の位置に大きく
     ・下に駅の入口と、吸い込まれていく人の列＝聖地の集客力
     ・屋上に湯気＝ビルの上でサウナが生きている
     ══════════════════════════════════════════════════════ */
  function y_tenku_out(ctx) {
    const t = T();

    /* 夜空 */
    const sky = ctx.createLinearGradient(0, 0, 0, 160);
    sky.addColorStop(0, '#0a0c1a'); sky.addColorStop(1, '#1e1c30');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 360, 200);
    for (let i = 0; i < 36; i++) {
      const h = Math.sin(i * 12.9898) * 43758.5453, h2 = Math.sin(i * 78.233) * 12345.678;
      P(ctx, Math.floor((h - Math.floor(h)) * 360), Math.floor((h2 - Math.floor(h2)) * 60), 1, 1,
        `rgba(255,244,224,${(0.14 + 0.28 * Math.abs(Math.sin(t * 0.8 + i))).toFixed(2)})`);
    }

    /* 周囲のビル（駅前。高いが、主役より低い） */
    for (let i = 0; i < 14; i++) {
      const bx = (i * 27 + (i % 3) * 5) % 360, bh = 30 + ((i * 43) % 42), by = 150 - bh;
      if (bx > 110 && bx < 230) continue;                     // 主役の場所は空ける
      P(ctx, bx, by, 22, bh, i % 2 ? '#151a2e' : '#1a2036');
      for (let r = 0; r < Math.floor(bh / 7); r++) for (let c = 0; c < 2; c++)
        if (((i * 5 + r * 3 + c) % 4) < 2)
          P(ctx, bx + 4 + c * 9, by + 3 + r * 7, 4, 3, 'rgba(255,214,150,.42)');
    }

    /* ── 主役：蒸都ターミナル（画面中央・最も高い）── */
    const X = 128, W = 104, TOP = 14, BASE = 158;
    const body = ctx.createLinearGradient(0, TOP, 0, BASE);
    body.addColorStop(0, '#3a3348'); body.addColorStop(1, '#241f30');
    ctx.fillStyle = body; ctx.fillRect(X, TOP, W, BASE - TOP);
    P(ctx, X, TOP, W, 2, '#5c5270');
    P(ctx, X - 3, TOP + 4, 3, BASE - TOP - 4, '#100d18');
    P(ctx, X + W, TOP + 4, 3, BASE - TOP - 4, '#100d18');

    /* 屋上：換気塔と湯気（ビルの上でサウナが生きている） */
    P(ctx, X + 12, TOP - 8, 14, 8, '#2c2638'); P(ctx, X + 70, TOP - 10, 18, 10, '#2c2638');
    wisp(ctx, X + 14, TOP - 10, 3, .34); wisp(ctx, X + 74, TOP - 12, 4, .40);

    /* 十四階＝サウナフロア（上層3段はオレンジの大窓） */
    for (let f = 0; f < 3; f++) {
      const wy = TOP + 8 + f * 13;
      P(ctx, X + 5, wy, W - 10, 10, '#180f0a');
      for (let c = 0; c < 8; c++) {
        const pulse = 0.68 + 0.14 * Math.sin(t * 1.1 + f * 2 + c * 0.7);
        P(ctx, X + 7 + c * 12, wy + 2, 9, 6, `rgba(255,168,74,${pulse.toFixed(2)})`);
      }
    }
    /* 「37」の看板（十四階の横・火の色で息をする） */
    const SX = X + W + 5, SY = TOP + 6;
    P(ctx, SX, SY, 22, 34, '#181018');
    P(ctx, SX, SY, 22, 2, '#453a50');
    ctx.font = 'bold 13px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(255,150,60,${(0.75 + 0.2 * Math.sin(t * 1.8)).toFixed(2)})`;
    ctx.fillText('37', SX + 11, SY + 16);
    ctx.font = '6px "DotGothic16",sans-serif';
    ctx.fillStyle = 'rgba(255,196,130,.85)';
    ctx.fillText('SAUNA', SX + 11, SY + 27);
    ctx.fillText('GATE', SX + 11, SY + 33);
    ctx.textAlign = 'left';
    ctx.fillStyle = `rgba(255,150,60,${(0.10 + 0.05 * Math.sin(t * 1.8)).toFixed(2)})`;
    ctx.fillRect(SX - 5, SY - 5, 32, 44);

    /* 中層＝オフィス（白っぽい小窓・まばら） */
    for (let f = 0; f < 6; f++) {
      const wy = TOP + 50 + f * 11;
      for (let c = 0; c < 10; c++) {
        const on = ((f * 7 + c * 3) % 5) < 2;
        P(ctx, X + 6 + c * 10, wy, 6, 6, on ? 'rgba(214,224,240,.55)' : 'rgba(60,66,88,.5)');
      }
    }

    /* 2階レベルの接続デッキ（駅直結を物理で見せる＝審査） */
    P(ctx, X - 58, BASE - 46, 58, 12, '#2c2838');
    P(ctx, X - 58, BASE - 46, 58, 2, '#4c4660');
    for (let i2 = 0; i2 < 6; i2++)
      P(ctx, X - 54 + i2 * 9, BASE - 42, 6, 6, `rgba(255,206,140,${(0.36 + 0.08 * Math.sin(t + i2)).toFixed(2)})`);
    P(ctx, X - 58, BASE - 34, 4, 34, '#1c1826'); P(ctx, X - 8, BASE - 34, 4, 34, '#1c1826');
    person(ctx, X - 40, BASE - 40, '#5a6b8a'); person(ctx, X - 26, BASE - 41, '#7a5a6a');
    /* 下層＝駅。ガラスの大屋根とホームの光 */
    P(ctx, X - 22, BASE - 34, W + 44, 6, '#3c3548');
    ctx.fillStyle = 'rgba(255,214,150,.16)';
    ctx.beginPath(); ctx.moveTo(X - 22, BASE - 28); ctx.lineTo(X + W + 22, BASE - 28);
    ctx.lineTo(X + W + 30, BASE); ctx.lineTo(X - 30, BASE); ctx.closePath(); ctx.fill();
    for (let c = 0; c < 12; c++)
      P(ctx, X - 16 + c * 12, BASE - 26, 8, 22, `rgba(255,206,140,${(0.30 + 0.06 * Math.sin(t + c)).toFixed(2)})`);
    /* 駅名板と入口 */
    P(ctx, X + 24, BASE - 32, 56, 9, '#20304a');
    ctx.font = '6px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#dce8f8'; ctx.fillText('ととのい中央', X + 52, BASE - 25);
    ctx.textAlign = 'left';

    /* 吸い込まれる人の列（サウナバッグを提げて） */
    const cols = ['#5a6b8a', '#6b5a4a', '#4a5a50', '#7a5a6a', '#5a5a6b', '#8a6a4a'];
    for (let i = 0; i < 9; i++) {
      const px = 40 + ((t * 7 + i * 34) % 280);
      if (px > X - 20 && px < X + W + 20 && px % 3 < 3) {
        person(ctx, Math.round(px), BASE - 8, cols[i % 6]);
      } else {
        person(ctx, Math.round(px), BASE - 8, cols[i % 6]);
      }
    }

    /* 歩道と車道 */
    P(ctx, 0, BASE, 360, 10, '#191722');
    P(ctx, 0, BASE, 360, 2, '#2e2a3c');
    P(ctx, 0, BASE + 10, 360, 32, '#0e0c14');
    for (let x = 8; x < 360; x += 34)
      P(ctx, x, BASE + 24, 16, 2, 'rgba(214,214,190,.24)');   // 車線
    /* タクシーの流れ（灯りだけ） */
    const cx2 = ((t * 34) % 430) - 40;
    P(ctx, Math.round(cx2), BASE + 16, 20, 7, '#241f2e');
    P(ctx, Math.round(cx2) + 16, BASE + 17, 4, 3, '#ffd98a');
    P(ctx, Math.round(cx2) + 1, BASE + 17, 3, 3, '#ff8a6a');
  }


  /* ══════════════════════════════════════════════════════
     月白 SPA TERRACE ── 外観（外気ベイの夜）
     ------------------------------------------------------------
     **五軒でここだけ、灯りが白い。**
     GATE 37・森・茶煙楼・松乃湯はオレンジ（湯と木の色）。月白だけ青白い。
     ひと目で「うちとは違う客が行く店」だと分かる＝💴40・🧼95を色でやる。

     置いたもの（絵は数字の説明図でもある）
       ・屋上の露天と湯気     … 🌤85。いちばん上に、いちばんいいものがある
       ・青白い窓、まばらな灯り … 静かさ。窓が全部は点いていない＝混んでいない
       ・水面に伸びる月の道   … 店名の由来。**月白＝月の出のときの、白い空**
       ・左奥の涼風大橋       … ここが外気ベイだと、地名を言わずに示す
       ・車寄せの庇と、傘の下の二人 … 連れと来る店（客層）
     ══════════════════════════════════════════════════════ */
  function y_lumina_out(ctx) {
    const t = T();

    /* ── 夜空 ── */
    const sky = ctx.createLinearGradient(0, 0, 0, 168);
    sky.addColorStop(0, '#070a18'); sky.addColorStop(0.6, '#101a34'); sky.addColorStop(1, '#1d2b46');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 360, 200);
    // 星（乱数を使わず、同じ位置に散らす）
    for (let i = 0; i < 40; i++) {
      const h = Math.sin(i * 12.9898) * 43758.5453, h2 = Math.sin(i * 78.233) * 12345.678;
      const x = Math.floor((h - Math.floor(h)) * 360), y = Math.floor((h2 - Math.floor(h2)) * 88);
      P(ctx, x, y, 1, 1, `rgba(214,226,255,${(0.14 + 0.3 * Math.abs(Math.sin(t * 0.8 + i))).toFixed(2)})`);
    }

    /* ── 月（三日月。白石澪のブローチと同じ形）── */
    const MX = 300, MY = 40;
    // halo は**三日月の側にだけ**寄せる（丸い暈を出すと満月に見える）
    ctx.fillStyle = 'rgba(200,218,255,.055)';
    ctx.beginPath(); ctx.arc(MX + 3, MY + 1, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(214,230,255,.075)';
    ctx.beginPath(); ctx.arc(MX + 3, MY + 1, 15, 0, Math.PI * 2); ctx.fill();
    // 三日月＝外円から内円を抜いた形（空の色で塗り潰すと「穴」に見えるので evenodd で抜く）
    ctx.fillStyle = '#eef2ff';
    ctx.beginPath();
    ctx.arc(MX, MY, 13, 0, Math.PI * 2);
    ctx.arc(MX - 6, MY - 3, 12, 0, Math.PI * 2);
    ctx.fill('evenodd');

    /* ── 左奥：涼風大橋（吊り橋のシルエット）── */
    const BY = 104;                                   // 桁の高さ
    ctx.strokeStyle = 'rgba(150,175,215,.5)'; ctx.lineWidth = 1;
    for (const tx of [26, 104]) {                     // 主塔2本
      P(ctx, tx - 2, BY - 44, 4, 44, '#26324e');
      P(ctx, tx - 6, BY - 34, 12, 3, '#26324e');
      P(ctx, tx - 1, BY - 47, 2, 4, '#3a4a70');
      P(ctx, tx - 1, BY - 49, 2, 2, `rgba(255,120,110,${(0.35 + 0.5 * Math.abs(Math.sin(t * 1.6))).toFixed(2)})`);
    }
    // メインケーブル（垂れ下がる曲線）
    ctx.beginPath();
    for (let x = -10; x <= 140; x += 3) {
      const u = (x - 65) / 39, yy = BY - 44 + Math.min(40, u * u * 26);
      x === -10 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
    }
    ctx.stroke();
    // ハンガーロープ
    for (let x = 0; x < 140; x += 9) {
      const u = (x - 65) / 39, yy = BY - 44 + Math.min(40, u * u * 26);
      if (yy > BY - 3) continue;
      ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x, BY - 2); ctx.stroke();
    }
    P(ctx, 0, BY - 3, 140, 4, '#1c2740');             // 桁
    for (let x = 2; x < 138; x += 6)                  // 橋の灯り（白）
      P(ctx, x, BY - 5, 2, 2, 'rgba(220,232,255,.75)');

    /* ── 対岸の街（低く、暗く）── */
    for (let i = 0; i < 24; i++) {
      const bx = i * 15 + (i % 3) * 4, bh = 12 + ((i * 47) % 22), by = 118 - bh;
      P(ctx, bx, by, 13, bh, i % 2 ? '#141d33' : '#18223a');
      for (let r = 0; r < Math.floor(bh / 6); r++)
        if (((i * 5 + r * 7) % 4) < 1) P(ctx, bx + 4, by + 3 + r * 6, 2, 2, 'rgba(180,200,240,.5)');
    }

    /* ── 本体：月白 SPA TERRACE（中央の高層棟）── */
    const X = 148, W = 86, TOP = 30, BASE = 152;
    // 躯体（上へいくほど白い＝上層がスパ）
    const body = ctx.createLinearGradient(0, TOP, 0, BASE);
    body.addColorStop(0, '#3b4668'); body.addColorStop(0.35, '#2c3452'); body.addColorStop(1, '#1e2440');
    ctx.fillStyle = body; ctx.fillRect(X, TOP, W, BASE - TOP);
    P(ctx, X, TOP, W, 2, '#5a6890');
    P(ctx, X - 3, TOP + 6, 3, BASE - TOP - 6, '#161c33');    // 左の陰
    P(ctx, X + W, TOP + 6, 3, BASE - TOP - 6, '#161c33');    // 右の陰

    /* 屋上テラス＝露天。**いちばん上に、いちばんいいもの** */
    P(ctx, X - 6, TOP - 8, W + 12, 8, '#39456a');            // テラスの床
    P(ctx, X - 6, TOP - 9, W + 12, 2, '#63739c');
    // ガラスの手すり
    ctx.fillStyle = 'rgba(190,214,255,.22)'; ctx.fillRect(X - 6, TOP - 18, W + 12, 10);
    ctx.strokeStyle = 'rgba(206,226,255,.55)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const gx = X - 6 + i * ((W + 12) / 10);
      ctx.beginPath(); ctx.moveTo(gx, TOP - 18); ctx.lineTo(gx, TOP - 8); ctx.stroke();
    }
    /* 屋上中央の三日月アーチ（S級審査①：建物のシルエットで月白と分かる） */
    ctx.strokeStyle = `rgba(232,229,216,${(0.85 + 0.12 * Math.sin(t * 1.2)).toFixed(2)})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(X + 43, TOP - 12, 20, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(86,98,116,.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(X + 43, TOP - 12, 23, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(232,229,216,.10)';
    ctx.beginPath(); ctx.arc(X + 43, TOP - 14, 28, 0, Math.PI * 2); ctx.fill();
    /* 手すり下のシャンパンゴールドの1pxライン */
    P(ctx, X - 6, TOP - 8, W + 12, 1, '#d5b678');
    // 露天の湯（水面が揺れる）
    P(ctx, X + 8, TOP - 15, 46, 7, '#2f6f86');
    ripple(ctx, X + 10, TOP - 12, 42, 'rgba(220,240,255,.5)');
    wisp(ctx, X + 12, TOP - 16, 4, .40);
    wisp(ctx, X + 34, TOP - 16, 3, .32);
    // 湯に浸かっている人（頭だけ）
    P(ctx, X + 18, TOP - 16, 3, 3, '#e8c39a');
    P(ctx, X + 40, TOP - 16, 3, 3, '#e8c39a');
    // テラスの寝椅子（空いている＝静か）
    for (let i = 0; i < 2; i++) P(ctx, X + 60 + i * 12, TOP - 13, 9, 4, '#c8d2e4');

    /* スパの階（大きな窓・青白い光）── 窓が全部は点いていない＝混んでいない */
    for (let f = 0; f < 4; f++) {
      const wy = TOP + 6 + f * 13;
      P(ctx, X + 5, wy, W - 10, 10, '#101830');
      for (let c = 0; c < 7; c++) {
        const on = ((f * 5 + c * 3) % 7) < 5;
        const pulse = 0.72 + 0.10 * Math.sin(t * 0.9 + f * 1.7 + c);
        P(ctx, X + 7 + c * 11, wy + 2, 8, 6,
          on ? `rgba(214,232,255,${pulse.toFixed(2)})` : 'rgba(64,84,120,.35)');
      }
    }

    /* 縦の看板「月　白」。白い灯りでほのかに息をする */
    const SX = X + W + 4, SY = TOP + 24;
    P(ctx, SX, SY, 13, 46, '#171d33');
    P(ctx, SX, SY, 13, 2, '#3d4a70');
    ctx.fillStyle = `rgba(226,238,255,${(0.72 + 0.18 * Math.sin(t * 1.2)).toFixed(2)})`;
    ctx.font = 'bold 10px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('月', SX + 7, SY + 15);
    ctx.fillText('白', SX + 7, SY + 32);
    ctx.font = '6px "DotGothic16",sans-serif';
    ctx.fillStyle = 'rgba(200,218,250,.8)';
    ctx.fillText('SPA', SX + 7, SY + 42);
    ctx.textAlign = 'left';
    ctx.fillStyle = `rgba(180,210,255,${(0.10 + 0.05 * Math.sin(t * 1.2)).toFixed(2)})`;
    ctx.fillRect(SX - 5, SY - 5, 23, 56);

    /* 中層に横長の暗いガラス帯（窓グリッドを1か所崩す＝審査3） */
    P(ctx, X + 4, TOP + 56, W - 8, 5, '#101828');
    P(ctx, X + 4, TOP + 56, W - 8, 1, 'rgba(120,140,180,.5)');
    P(ctx, X + 4, TOP + 100, W - 8, 1, '#d5b678');
    /* 客室・その他の階（小さい窓。ここも白寄り） */
    for (let f = 0; f < 5; f++) {
      const wy = TOP + 62 + f * 12;
      for (let c = 0; c < 9; c++) {
        const on = ((f * 7 + c * 5) % 9) < 4;
        P(ctx, X + 5 + c * 9, wy, 6, 7, on ? 'rgba(198,218,252,.72)' : 'rgba(52,68,102,.5)');
      }
    }

    /* 車寄せ（庇）と、傘の下の二人＝連れと来る店 */
    P(ctx, X - 14, BASE - 16, W + 28, 4, '#4a577e');
    P(ctx, X - 14, BASE - 13, 3, 13, '#2a3350');
    P(ctx, X + W + 11, BASE - 13, 3, 13, '#2a3350');
    ctx.fillStyle = 'rgba(226,240,255,.13)';                 // 庇の下の白い光だまり
    ctx.beginPath(); ctx.moveTo(X - 14, BASE); ctx.lineTo(X + W + 14, BASE);
    ctx.lineTo(X + W + 2, BASE - 12); ctx.lineTo(X - 2, BASE - 12); ctx.closePath(); ctx.fill();
    P(ctx, X + 30, BASE - 12, 26, 12, 'rgba(230,244,255,.5)');  // 自動ドア
    /* 入口の暖色（高級スパのロビーの色。S級審査①） */
    ctx.fillStyle = `rgba(213,182,120,${(0.16 + 0.04 * Math.sin(t)).toFixed(3)})`;
    ctx.fillRect(X + 26, BASE - 13, 34, 13);
    P(ctx, X + 8, BASE - 11, 4, 8, '#d5b678'); P(ctx, X + W - 12, BASE - 11, 4, 8, '#d5b678');
    person(ctx, X + 18, BASE - 9, '#3f4c70');
    person(ctx, X + 25, BASE - 9, '#6a5570');

    /* ── 岸壁と海 ── */
    P(ctx, 0, BASE, 360, 8, '#141a2c');                      // 護岸
    P(ctx, 0, BASE, 360, 2, '#26304a');
    const sea = ctx.createLinearGradient(0, BASE + 8, 0, 200);
    sea.addColorStop(0, '#0d1526'); sea.addColorStop(1, '#141f38');
    ctx.fillStyle = sea; ctx.fillRect(0, BASE + 8, 360, 200 - BASE - 8);

    /* 月の道（水面に一本だけ伸びる白い光）＝店名の由来 */
    for (let i = 0; i < 14; i++) {
      const yy = BASE + 9 + i * 3, w = 5 + i * 1.6;
      const a = (0.30 - i * 0.018) * (0.8 + 0.2 * Math.sin(t * 1.6 + i));
      P(ctx, Math.round(MX - w / 2 + Math.sin(t * 0.9 + i * 0.7) * 2), yy, Math.round(w), 2,
        `rgba(226,238,255,${Math.max(0, a).toFixed(3)})`);
    }
    /* ビルの映り込み（縦に伸びて、途中で切れる）
       ⚠ 同じ幅の横棒を等間隔で並べると**階段に見える。**幅と位置を段ごとに崩す */
    for (let i = 0; i < 14; i++) {
      const yy = BASE + 9 + i * 3;
      if ((i * 7 + 3) % 5 === 0) continue;                       // ときどき抜く＝途切れる
      const shrink = 14 + i * 2 + ((i * 13) % 9);
      const a = (0.20 - i * 0.013) * (0.7 + 0.3 * Math.sin(t * 2 + i * 0.9));
      P(ctx, Math.round(X + shrink / 2 + Math.sin(t + i * 1.3) * 3), yy,
        Math.max(4, W - shrink), 1, `rgba(178,206,250,${Math.max(0, a).toFixed(3)})`);
    }
    // さざ波
    ripple(ctx, 0, BASE + 14, 360, 'rgba(180,206,250,.18)');
    ripple(ctx, 0, BASE + 28, 360, 'rgba(180,206,250,.12)');
    /* ⚠ 左上の名札（head）は出さない＝**絵で分からせる**（作者指示 2026-08-09）。
       店名は縦看板に描いてあるので、名札は説明の重複になる                     */
  }


  /* ══════════════════════════════════════════════════════
     月白 ── サウナ室（六段の大型・アロマ）
     ------------------------------------------------------------
     **🔥55 を、絵の中の温度計と、客の顔で見せる。**
     ・温度計は八十二度。他店より低い
     ・いちばん上の段に、初めて来た人が平気な顔で座っている
       （台本の「初めての人が、いちばん上の段で平気な顔をして座っていた」と同じ絵）
     ・白木・間接照明・白いマット＝🧼95。木が焦げていない、新しい店の色
     ══════════════════════════════════════════════════════ */
  function y_lumina_sauna(ctx) {
    const t = T();

    /* ── 天井（濃いめの木・照明の帯）── */
    P(ctx, 0, 0, 360, 22, '#7d6244');
    P(ctx, 0, 0, 360, 5, '#95784f');
    ctx.strokeStyle = 'rgba(50,34,20,.3)'; ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.moveTo(i * 40, 0); ctx.lineTo(i * 40 + 14, 22); ctx.stroke(); }
    P(ctx, 84, 20, 192, 3, `rgba(255,246,226,${(0.66 + 0.08 * Math.sin(t)).toFixed(2)})`);

    /* ── 正面の壁（白木の縦板。上ほど暗い＝奥行き）── */
    const wall = ctx.createLinearGradient(0, 22, 0, 150);
    wall.addColorStop(0, '#a2865f'); wall.addColorStop(1, '#c6a87d');
    ctx.fillStyle = wall; ctx.fillRect(0, 22, 360, 128);
    ctx.strokeStyle = 'rgba(84,58,32,.20)'; ctx.lineWidth = 1;
    for (let x = 5; x < 360; x += 11) { ctx.beginPath(); ctx.moveTo(x, 22); ctx.lineTo(x, 150); ctx.stroke(); }

    /* ── 側壁（手前に開く。台形で奥行きを出す）── */
    ctx.fillStyle = '#8a6f4b';
    ctx.beginPath(); ctx.moveTo(0, 22); ctx.lineTo(34, 40); ctx.lineTo(34, 150); ctx.lineTo(0, 168); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(360, 22); ctx.lineTo(326, 40); ctx.lineTo(326, 150); ctx.lineTo(360, 168); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(40,26,14,.22)';
    ctx.beginPath(); ctx.moveTo(0, 22); ctx.lineTo(34, 40); ctx.lineTo(34, 150); ctx.lineTo(0, 168); ctx.closePath(); ctx.fill();

    /* ── 六段のひな壇 ──
       ⚠ 段ごとに左右を大きく詰めると**ウェディングケーキに見える。**
         詰めるのは片側7pxまで＝「奥に下がっている」だけに見せる            */
    const R0Y = 128, RH = 12, STEP = 14, X0 = 58, X1 = 302, IN = 7;
    const rowX = r => [X0 + r * IN, X1 - r * IN];
    for (let r = 0; r < 6; r++) {
      const ry = R0Y - r * STEP, [rx, rr] = rowX(r), rw = rr - rx;
      // 段の下から漏れる間接照明
      P(ctx, rx - 2, ry + RH, rw + 4, 3, `rgba(255,242,214,${(0.20 + 0.05 * Math.sin(t * 0.7 + r)).toFixed(2)})`);
      P(ctx, rx, ry + RH - 1, rw, 4, '#6f5734');            // 小口（影）
      P(ctx, rx, ry, rw, RH - 1, '#d3b98e');                // 座面
      P(ctx, rx, ry, rw, 2, '#e8d5ac');                     // 座面の照り
      ctx.strokeStyle = 'rgba(90,64,36,.30)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(rx, ry + 6); ctx.lineTo(rx + rw, ry + 6); ctx.stroke();   // 板の継ぎ目
    }
    /* 白いマットは**人が座るところにだけ**敷く（等間隔に並べると棚に見える） */
    const MAT = [[76, 0], [224, 1], [138, 2], [250, 3], [116, 4], [168, 5]];
    for (const [mx, r] of MAT) {
      const ry = R0Y - r * STEP;
      P(ctx, mx, ry + 1, 42, 6, '#f0ece1'); P(ctx, mx, ry + 1, 42, 2, '#fbf8f1');
    }

    /* ── 座っている人 ──
       服の色を鈍くして、白いマットと分ける。**最上段にも平気な顔の客がいる** */
    const sit = (x, r, cloth, hair) => {
      const ry = R0Y - r * STEP;
      P(ctx, x - 2, ry - 2, 20, 3, 'rgba(60,42,24,.28)');   // 座面に落ちる影
      P(ctx, x + 2, ry - 8, 12, 8, '#e0b489');              // 膝から下（前の段へ垂れる）
      P(ctx, x, ry - 21, 16, 14, cloth);                    // 胴
      P(ctx, x, ry - 21, 16, 3, cloth === '#b0bcc8' ? '#c8d2dc' : '#ffffff88');
      P(ctx, x - 3, ry - 19, 4, 11, cloth);                 // 腕
      P(ctx, x + 15, ry - 19, 4, 11, cloth);
      P(ctx, x + 4, ry - 31, 9, 10, '#f0cda6');             // 顔
      P(ctx, x + 4, ry - 33, 9, 5, hair || '#3b2d24');      // 髪
      P(ctx, x + 6, ry - 26, 1, 1, '#5a4030'); P(ctx, x + 10, ry - 26, 1, 1, '#5a4030');
    };
    sit(80,  0, '#7d94ad');
    /* 演技差：前かがみで肘を膝に置く人（審査3） */
    (() => { const x = 296, ry = R0Y;
      P(ctx, x - 2, ry - 2, 20, 3, 'rgba(60,42,24,.28)');
      P(ctx, x + 2, ry - 8, 12, 8, '#e0b489');
      P(ctx, x, ry - 18, 16, 12, '#8e9ba8');
      P(ctx, x - 2, ry - 14, 6, 3, '#8e9ba8');
      P(ctx, x + 2, ry - 27, 9, 10, '#f0cda6'); P(ctx, x + 2, ry - 29, 9, 4, '#2c2420');
    })();
    sit(228, 1, '#9c88b2', '#5a3a2c');
    sit(142, 2, '#6f8598');
    sit(254, 3, '#8e9ba8', '#2c2420');
    // 最上段＝初めて来た人。畳んだ白いタオルを膝に置き、背筋が伸びている
    sit(172, 5, '#b0bcc8', '#4a3a2e');
    P(ctx, 172, R0Y - STEP * 5 - 10, 16, 4, '#ffffff');

    /* ── 右手前：アロマストーブ（1.3倍・白い石5個＝S級審査③）── */
    P(ctx, 296, 84, 40, 52, '#6a5236');
    P(ctx, 296, 84, 40, 3, '#8a6c48');
    P(ctx, 301, 90, 30, 18, '#33281c');
    // 白いサウナストーン5個と、下の橙
    P(ctx, 303, 104, 26, 2, 'rgba(255,140,60,.5)');
    for (let i2 = 0; i2 < 5; i2++) P(ctx, 303 + i2 * 5, 96 + (i2 % 2) * 3, 5, 5, '#ded8cc');
    P(ctx, 303, 112, 26, 6, `rgba(176,232,220,${(0.40 + 0.28 * Math.sin(t * 2.2)).toFixed(2)})`);
    P(ctx, 301, 124, 30, 10, '#4a3a26');
    ctx.fillStyle = 'rgba(190,240,230,.07)';
    ctx.beginPath(); ctx.arc(316, 100, 30, 0, Math.PI * 2); ctx.fill();
    wisp(ctx, 303, 82, 4, .45); wisp(ctx, 317, 76, 3, .30);

    /* ── 左手前：温度計。**八十二度**＝ここが🔥55の理由 ── */
    const TX = 34, TY = 62;
    ctx.fillStyle = '#6a5236'; ctx.beginPath(); ctx.arc(TX, TY, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4ede0'; ctx.beginPath(); ctx.arc(TX, TY, 13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI * 0.78 + i * (Math.PI * 1.56 / 7);
      ctx.beginPath();
      ctx.moveTo(TX + Math.cos(a) * 9, TY + Math.sin(a) * 9);
      ctx.lineTo(TX + Math.cos(a) * 12, TY + Math.sin(a) * 12);
      ctx.stroke();
    }
    ctx.strokeStyle = '#a03028'; ctx.lineWidth = 2;      // 針は真上まで届かない
    ctx.beginPath(); ctx.moveTo(TX, TY); ctx.lineTo(TX + 7, TY - 7); ctx.stroke();
    ctx.font = 'bold 11px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#5a4028'; ctx.fillText('82', TX, TY + 4);
    ctx.font = '6px "DotGothic16",sans-serif';
    ctx.fillText('℃', TX, TY + 11);
    ctx.textAlign = 'left';

    /* ── 床（濃いタイル・手前へ広がる）── */
    P(ctx, 0, 150, 360, 50, '#463f38');
    ctx.strokeStyle = 'rgba(20,16,12,.4)'; ctx.lineWidth = 1;
    for (let x = -40; x < 400; x += 22) { ctx.beginPath(); ctx.moveTo(x, 150); ctx.lineTo(x - 26, 200); ctx.stroke(); }
    for (let y = 156; y < 200; y += 13) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); }
    P(ctx, 0, 150, 360, 2, '#6a6058');
    P(ctx, 112, 170, 136, 13, '#5f584e');                // 足元マットは床に溶かす（審査3）
    P(ctx, 112, 170, 136, 2, '#6f675c');

    /* ── 空気（下にたまる薄い霧と、四隅の落ち）── */
    ctx.fillStyle = `rgba(255,252,244,${(0.05 + 0.02 * Math.sin(t * 0.6)).toFixed(3)})`;
    ctx.fillRect(0, 118, 360, 40);
    const vig = ctx.createRadialGradient(180, 100, 60, 180, 100, 220);
    vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(20,12,4,.34)');
    ctx.fillStyle = vig; ctx.fillRect(0, 0, 360, 200);
  }


  /* ══════════════════════════════════════════════════════
     月白 ── 露天（高層階。囲いの向こうは空だけ）
     ------------------------------------------------------------
     台本「湯に浸かって空を見上げていると、ととのい市の真ん中にいることさえ忘れる」。
     **街を見せない。**高いところにあるのに、見えるのは空と月だけ＝それが忘れられる理由
     ══════════════════════════════════════════════════════ */
  function y_lumina_roten(ctx) {
    const t = T();

    /* ── 空（上から下へ、夜が薄くなる）── */
    const sky = ctx.createLinearGradient(0, 0, 0, 104);
    sky.addColorStop(0, '#0a0f22'); sky.addColorStop(0.6, '#182440'); sky.addColorStop(1, '#2c3a56');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 360, 200);
    for (let i = 0; i < 34; i++) {
      const h = Math.sin(i * 12.9898) * 43758.5453, h2 = Math.sin(i * 78.233) * 12345.678;
      const x = Math.floor((h - Math.floor(h)) * 360), y = Math.floor((h2 - Math.floor(h2)) * 66);
      P(ctx, x, y, 1, 1, `rgba(220,230,255,${(0.16 + 0.3 * Math.abs(Math.sin(t * 0.7 + i))).toFixed(2)})`);
    }
    // 三日月（外観と同じ形・小さめ）
    ctx.fillStyle = 'rgba(210,226,255,.06)';
    ctx.beginPath(); ctx.arc(72, 34, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#eef2ff';
    ctx.beginPath(); ctx.arc(72, 34, 10, 0, Math.PI * 2); ctx.arc(68, 31, 9, 0, Math.PI * 2); ctx.fill('evenodd');
    // 薄い雲（ゆっくり流れる）
    for (let i = 0; i < 3; i++) {
      const cx = ((t * 4 + i * 150) % 470) - 70, cy = 46 + i * 15;
      ctx.fillStyle = `rgba(186,202,232,${0.08 - i * 0.02})`;
      ctx.fillRect(cx, cy, 84 + i * 28, 4);
      ctx.fillRect(cx + 22, cy - 3, 44, 3);
    }

    /* ── 右上の庇（空は開いている）── */
    P(ctx, 244, 0, 116, 20, '#2a2018');
    P(ctx, 240, 18, 120, 5, '#3d2e20');
    for (let i = 0; i < 8; i++) P(ctx, 248 + i * 14, 20, 4, 4, '#1d160f');
    /* 吊り行灯（枠と屋根のある灯り。白い光） */
    const LX = 300, LY = 30;
    P(ctx, LX + 6, 23, 2, 8, '#241c14');                       // 吊り紐
    P(ctx, LX - 2, LY, 18, 3, '#3a2c1e');                      // 小さな屋根
    P(ctx, LX, LY + 3, 14, 16, '#241c14');                     // 枠
    P(ctx, LX + 2, LY + 5, 10, 12, `rgba(250,246,232,${(0.80 + 0.10 * Math.sin(t * 1.4)).toFixed(2)})`);
    P(ctx, LX + 6, LY + 5, 2, 12, '#241c14');                  // 桟
    P(ctx, LX, LY + 19, 14, 2, '#3a2c1e');
    ctx.fillStyle = `rgba(255,248,226,${(0.09 + 0.03 * Math.sin(t * 1.4)).toFixed(2)})`;
    ctx.beginPath(); ctx.arc(LX + 7, LY + 11, 26, 0, Math.PI * 2); ctx.fill();

    /* ── 奥の板塀（全幅。ここで街が消える）── */
    P(ctx, 0, 100, 360, 26, '#4e3b28');
    P(ctx, 0, 98, 360, 4, '#6d5537');                          // 笠木
    ctx.strokeStyle = 'rgba(26,17,10,.42)'; ctx.lineWidth = 1;
    for (let x = 4; x < 360; x += 8) { ctx.beginPath(); ctx.moveTo(x, 102); ctx.lineTo(x, 126); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,246,220,.05)'; ctx.fillRect(250, 100, 110, 26);   // 行灯の照り返し
    /* 左右の袖塀（少し手前に出る＝囲われている） */
    for (const [bx, bw] of [[0, 26], [334, 26]]) {
      P(ctx, bx, 92, bw, 42, '#5a4530'); P(ctx, bx, 90, bw, 4, '#795f41');
      for (let x = bx + 3; x < bx + bw; x += 7) { ctx.beginPath(); ctx.moveTo(x, 94); ctx.lineTo(x, 134); ctx.stroke(); }
    }
    // 塀ぎわの植栽と、飛び石ぎわの岩
    plant(ctx, 32, 124); plant(ctx, 40, 128); plant(ctx, 326, 122); plant(ctx, 318, 127);
    const rock = (x, y, w, h) => { P(ctx, x, y, w, h, '#4a4640'); P(ctx, x + 1, y, w - 2, 2, '#615c53');
                                   P(ctx, x, y + h - 2, w, 2, '#302d29'); };
    rock(52, 118, 18, 9); rock(292, 116, 22, 10);

    /* ── 石張りのデッキ ── */
    P(ctx, 0, 126, 360, 74, '#443f39');
    ctx.strokeStyle = 'rgba(22,18,14,.45)'; ctx.lineWidth = 1;
    for (let y = 130; y < 200; y += 11) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke();
      for (let x = ((y / 11) % 2 ? 14 : 0); x < 360; x += 28) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 11); ctx.stroke();
      }
    }
    P(ctx, 0, 126, 360, 2, '#5e574e');

    /* ── 湯船（夜の湯。**明るい水色にしない**＝プールに見える）── */
    const BX = 34, BY = 132, BW = 292, BH = 56;
    P(ctx, BX - 7, BY - 7, BW + 14, BH + 14, '#2a2620');       // 石の縁（外）
    P(ctx, BX - 7, BY - 7, BW + 14, 5, '#b0a898');             // 縁の上面（白灰・厚く）
    P(ctx, BX - 7, BY - 3, BW + 14, 1, '#d5b678');             // シャンパンの間接光
    P(ctx, BX - 2, BY - 2, BW + 4, BH + 4, '#514a41');
    const wat = ctx.createLinearGradient(0, BY, 0, BY + BH);
    wat.addColorStop(0, '#1d4351'); wat.addColorStop(1, '#2d5f6b');
    ctx.fillStyle = wat; ctx.fillRect(BX, BY, BW, BH);
    ripple(ctx, BX + 6, BY + 13, BW - 12, 'rgba(206,232,248,.30)');
    ripple(ctx, BX + 6, BY + 30, BW - 12, 'rgba(206,232,248,.22)');
    ripple(ctx, BX + 6, BY + 46, BW - 12, 'rgba(206,232,248,.14)');
    /* 月あかりが湯の上に落ちる（月の真下＝左寄り） */
    for (let i = 0; i < 8; i++) {
      const a = 0.20 - i * 0.023;
      P(ctx, Math.round(66 + Math.sin(t + i) * 2), BY + 4 + i * 6, 14 + i * 4, 2,
        `rgba(226,238,255,${Math.max(0, a).toFixed(3)})`);
    }
    /* 行灯の映り込み（右寄り・細く） */
    for (let i = 0; i < 6; i++)
      P(ctx, Math.round(304 + Math.sin(t * 1.3 + i) * 2), BY + 6 + i * 7, 6, 2,
        `rgba(255,244,214,${(0.20 - i * 0.03).toFixed(3)})`);
    wisp(ctx, 66, 136, 4, .42); wisp(ctx, 158, 133, 5, .48); wisp(ctx, 252, 137, 4, .38);

    /* 浸かっている人（二人。**混んでいない**） */
    const bather = (x, y) => {
      P(ctx, x - 3, y + 8, 14, 3, 'rgba(255,255,255,.18)');    // 肩まわりの波
      P(ctx, x, y, 8, 8, '#f0cda6'); P(ctx, x, y - 2, 8, 4, '#3b2d24');
      P(ctx, x + 2, y + 4, 1, 1, '#5a4030'); P(ctx, x + 5, y + 4, 1, 1, '#5a4030');
    };
    bather(112, 148); bather(226, 156);

    /* 湯口（竹）から落ちる湯 */
    P(ctx, 168, 120, 18, 5, '#8a7a4a'); P(ctx, 168, 120, 18, 2, '#a89660');
    for (let i = 0; i < 5; i++) {
      const d = (t * 40 + i * 6) % 14;
      P(ctx, 176, Math.round(125 + d), 2, 4, `rgba(226,240,255,${(0.62 - d / 24).toFixed(2)})`);
    }
    wisp(ctx, 173, 134, 2, .3);

    /* 足元灯（3つ。S級審査④） */
    for (const lx2 of [65, 180, 295]) {
      P(ctx, lx2, 126, 6, 5, '#241c14');
      P(ctx, lx2 + 1, 127, 4, 3, `rgba(255,240,200,${(0.7 + 0.2 * Math.sin(t * 1.6 + lx2)).toFixed(2)})`);
      ctx.fillStyle = 'rgba(255,240,200,.06)';
      ctx.beginPath(); ctx.arc(lx2 + 3, 128, 12, 0, Math.PI * 2); ctx.fill();
    }
    /* 手前の縁と、置かれた桶 */
    P(ctx, 0, 190, 360, 10, '#3a3630');
    P(ctx, 0, 190, 360, 2, '#57514a');
    P(ctx, 296, 180, 18, 10, '#c8a56a'); P(ctx, 296, 180, 18, 3, '#e0bc80');
    P(ctx, 298, 183, 14, 2, '#9c7f4c');
  }


  /* ══════════════════════════════════════════════════════
     月白 ── シアターサウナ（巨大スクリーン）
     ------------------------------------------------------------
     台本「映像とアロマと熱風に包まれているうちに、自分がどこにいるのかも分からなくなる」。
     **室内でいちばん明るいのがスクリーンで、人は全員そのシルエット。**
     ここが✨85 の中身＝金をかけた個性。うちには真似できない側の絵
     ══════════════════════════════════════════════════════ */
  function y_lumina_sauna_im(ctx) {
    const t = T();

    /* 暗い室内 */
    P(ctx, 0, 0, 360, 200, '#12141d');
    P(ctx, 0, 0, 360, 20, '#1a1d28');                 // 天井
    for (let i = 0; i < 6; i++) P(ctx, 30 + i * 60, 16, 10, 4, '#0c0e14');   // スピーカー

    /* 巨大スクリーン（映像がゆっくり動く） */
    const SX = 40, SY = 26, SW = 280, SH = 92;
    P(ctx, SX - 4, SY - 4, SW + 8, SH + 8, '#080a10');
    const g = ctx.createLinearGradient(0, SY, 0, SY + SH);
    g.addColorStop(0, '#123a52'); g.addColorStop(0.5, '#1d6c74'); g.addColorStop(1, '#0e2a3a');
    ctx.fillStyle = g; ctx.fillRect(SX, SY, SW, SH);
    // 映像＝流れるオーロラの帯
    for (let i = 0; i < 5; i++) {
      const yy = SY + 14 + i * 15 + Math.sin(t * 0.8 + i) * 5;
      ctx.fillStyle = `rgba(150,240,220,${(0.12 + 0.08 * Math.sin(t * 1.3 + i * 2)).toFixed(3)})`;
      ctx.beginPath();
      for (let x = 0; x <= SW; x += 6) {
        const py = yy + Math.sin(x * 0.04 + t * 1.1 + i) * 6;
        x === 0 ? ctx.moveTo(SX + x, py) : ctx.lineTo(SX + x, py);
      }
      for (let x = SW; x >= 0; x -= 6) {
        const py = yy + 7 + Math.sin(x * 0.04 + t * 1.1 + i) * 6;
        ctx.lineTo(SX + x, py);
      }
      ctx.closePath(); ctx.fill();
    }
    // 光の粒
    for (let i = 0; i < 26; i++) {
      const h = Math.sin(i * 12.9898) * 43758.5453;
      const x = SX + Math.floor((h - Math.floor(h)) * SW);
      const y = SY + ((t * 12 + i * 17) % SH);
      P(ctx, x, Math.round(SY + SH - (y - SY)), 2, 2, `rgba(220,255,248,${(0.5 - (y - SY) / SH * 0.4).toFixed(2)})`);
    }
    // 画面のフレーム
    ctx.strokeStyle = '#243040'; ctx.lineWidth = 2; ctx.strokeRect(SX, SY, SW, SH);

    /* スクリーンの光が、床へ台形に落ちる */
    const glow = 0.16 + 0.05 * Math.sin(t * 1.1);
    ctx.fillStyle = `rgba(140,230,220,${glow.toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(SX, SY + SH); ctx.lineTo(SX + SW, SY + SH);
    ctx.lineTo(348, 200); ctx.lineTo(12, 200); ctx.closePath(); ctx.fill();

    /* ひな壇（3段）。座面と小口を描き分けないと**ただの黒い帯**になる */
    const TIER = [[128, '#232833'], [154, '#1b2029'], [182, '#12161d']];
    for (const [ty, col] of TIER) {
      P(ctx, 0, ty, 360, 8, col);                                  // 座面
      P(ctx, 0, ty, 360, 2, 'rgba(150,230,220,.20)');              // 座面にスクリーンの光
      P(ctx, 0, ty + 8, 360, 4, '#0b0e13');                        // 小口（影）
      P(ctx, 0, ty + 12, 360, 2, 'rgba(120,200,196,.07)');         // 段下の照り返し
    }

    /* 客＝全員シルエット。**顔は描かない**（どこにいるか分からなくなる部屋）
       ⚠ 立ち姿の四角を並べると**杭に見える。**膝を折って、肩を落として座らせる */
    const sil = (x, ty, s) => {
      const C = '#05080c';
      // 後光（スクリーンの光が人の背に当たる）。**これが無いと杭に見える**
      const gl = ctx.createRadialGradient(x + 9 * s, ty - 12 * s, 2, x + 9 * s, ty - 12 * s, 17 * s);
      gl.addColorStop(0, 'rgba(150,235,225,.30)'); gl.addColorStop(1, 'rgba(150,235,225,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(x - 10 * s, ty - 30 * s, 38 * s, 34 * s);
      // 座り姿（肩は丸く、頭は小さく）
      ctx.fillStyle = C;
      ctx.beginPath();                                              // 胴＝肩の丸い山
      ctx.moveTo(x, ty);
      ctx.lineTo(x, ty - 10 * s);
      ctx.quadraticCurveTo(x + 1 * s, ty - 15 * s, x + 8 * s, ty - 15 * s);
      ctx.quadraticCurveTo(x + 15 * s, ty - 15 * s, x + 16 * s, ty - 10 * s);
      ctx.lineTo(x + 16 * s, ty);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 8 * s, ty - 18 * s, 4 * s, 0, Math.PI * 2); ctx.fill();  // 頭
      P(ctx, x + 13 * s, ty - 4 * s, 8 * s, 4 * s, C);              // 膝（前の段へ）
    };
    sil(52, 126, 1);   sil(160, 126, 1);   sil(262, 126, 1);
    sil(100, 152, 1.15); sil(214, 152, 1.15);
    sil(26, 180, 1.3);  sil(146, 180, 1.3);  sil(286, 180, 1.3);

    /* アロマの霧（下から立ちのぼって、スクリーンの光に照らされる） */
    for (let i = 0; i < 9; i++) {
      const rise = (t * 7 + i * 9) % 40;
      ctx.fillStyle = `rgba(180,240,230,${(0.10 * (1 - rise / 40)).toFixed(3)})`;
      ctx.fillRect(20 + i * 38 + Math.sin(t + i) * 3, 196 - rise, 10, 6);
    }

    /* 画面下中央：低い円形ストーブ（S級審査⑤＝サウナだと分かる発光源） */
    ctx.fillStyle = '#2a2622';
    ctx.beginPath(); ctx.ellipse(180, 190, 34, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a342c';
    ctx.beginPath(); ctx.ellipse(180, 187, 30, 7, 0, 0, Math.PI * 2); ctx.fill();
    for (let i2 = 0; i2 < 7; i2++)
      P(ctx, 158 + i2 * 7, 182 + (i2 % 2) * 3, 6, 5, '#d8d2c6');       // 白い石
    P(ctx, 158, 189, 46, 2, `rgba(255,150,70,${(0.4 + 0.2 * Math.sin(t * 3)).toFixed(2)})`);
    wisp(ctx, 168, 178, 3, .5); wisp(ctx, 186, 176, 3, .42);
    /* 足元の誘導灯（安全灯。高級店らしく小さく） */
    for (const ty of [72, 103, 128, 154, 182])
      for (let i = 0; i < 5; i++)
        P(ctx, 34 + i * 74, ty + 9, 3, 2, `rgba(255,236,190,${(0.5 + 0.24 * Math.sin(t * 2 + i + ty)).toFixed(2)})`);
  }



  /* ══════════════════════════════════════════════════════
     お出かけ先の一枚絵（作者決定 8/9・24枚すべてコード描画）
     デート5行き先／買い出し3行き先／ロウリュ街4景／病院・居間・冒頭の湾
     ══════════════════════════════════════════════════════ */
/* ── 風待公園（昼・海沿いの遊歩道。夫婦がベンチで海を見る） ── */
function y_date_yamashita(ctx) {
  const t = T();
  const h = i => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;

  /* 空（昼。水平線に向かって明るく） */
  const sky = ctx.createLinearGradient(0, 0, 0, 88);
  sky.addColorStop(0, '#9fc8e8'); sky.addColorStop(1, '#d4e6f2');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 360, 200);
  /* 流れる雲（幅も高さもバラす） */
  for (let i = 0; i < 3; i++) {
    const cx = ((t * 2.2 + i * 128 + h(i) * 70) % 470) - 55, cy = 12 + h(i + 9) * 28;
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillRect(cx, cy, 38 + h(i + 3) * 36, 7);
    ctx.fillRect(cx + 10, cy - 5, 22 + h(i + 5) * 20, 6);
  }

  /* 海（水平線の1pxの光→手前ほど濃く） */
  P(ctx, 0, 88, 360, 40, '#4a7fa8');
  P(ctx, 0, 88, 360, 1, '#bcd8e8');
  P(ctx, 0, 89, 360, 1, '#6f9cc0');
  P(ctx, 0, 112, 360, 16, '#41729a');
  for (let i = 0; i < 5; i++) {
    ripple(ctx, 4, 94 + i * 7 + h(i + 20) * 3, 352, `rgba(255,255,255,${(0.12 + 0.05 * i).toFixed(2)})`);
  }
  /* 陽のきらめき（散らし） */
  for (let i = 0; i < 14; i++) {
    const gx = 30 + h(i + 40) * 300, gy = 92 + h(i + 60) * 30;
    const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * 2 + i * 1.7));
    P(ctx, Math.round(gx), Math.round(gy), 2, 1, `rgba(255,244,214,${(tw * 0.6).toFixed(2)})`);
  }
  /* 沖の貨物船（小さく） */
  P(ctx, 288, 92, 26, 4, '#3a4a58'); P(ctx, 293, 89, 7, 3, '#d8d2c6'); P(ctx, 303, 90, 3, 2, '#c84a2e');

  /* カモメ（T()で上下・羽ばたき） */
  const gull = (x, y, ph) => {
    const b = Math.sin(t * 2.2 + ph) * 2.5, fl = Math.sin(t * 7 + ph * 2);
    ctx.fillStyle = '#f6f8fa';
    ctx.beginPath(); ctx.ellipse(x, y + b, 4, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#eef2f4'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 6, y + b - 2 - fl * 2.5); ctx.lineTo(x, y + b - 1);
    ctx.lineTo(x + 6, y + b - 2 - fl * 2.5); ctx.stroke();
    P(ctx, x + 4, Math.round(y + b), 2, 1, '#d8a848');
  };
  gull(84, 58, 0); gull(196, 44, 2.4); gull(268, 66, 4.9);

  /* 海際の柵（支柱の間隔は不揃いに） */
  P(ctx, 0, 124, 360, 2, '#dde2e6'); P(ctx, 0, 126, 360, 1, '#9aa6ae');
  P(ctx, 0, 131, 360, 2, '#d4dade');
  let fx = 4;
  for (let i = 0; i < 14 && fx < 356; i++) {
    P(ctx, Math.round(fx), 122, 2, 13, '#8a949c');
    P(ctx, Math.round(fx), 122, 1, 13, '#c4ccd2');
    fx += 20 + h(i + 80) * 14;
  }

  /* 芝の帯（風でなびく草） */
  P(ctx, 0, 135, 360, 16, '#7da868');
  P(ctx, 0, 135, 360, 1, '#93bc7c');
  for (let i = 0; i < 26; i++) {
    const gx = h(i + 100) * 356 + 2, gy = 138 + h(i + 130) * 10;
    const lean = Math.sin(t * 1.9 + gx * 0.15) * 2.2;
    ctx.strokeStyle = i % 3 ? '#5f8a4c' : '#6f9a58'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(gx, gy + 4); ctx.quadraticCurveTo(gx + lean * 0.4, gy + 1, gx + lean, gy - 2); ctx.stroke();
  }

  /* 遊歩道（石の目地は不揃い） */
  P(ctx, 0, 151, 360, 49, '#c8bfa8');
  P(ctx, 0, 151, 360, 1, '#dcd4c0');
  ctx.strokeStyle = 'rgba(90,80,60,.22)'; ctx.lineWidth = 1;
  const rows = [158, 167, 178, 191];
  for (let r = 0; r < rows.length; r++) {
    ctx.beginPath(); ctx.moveTo(0, rows[r]); ctx.lineTo(360, rows[r]); ctx.stroke();
    let jx = h(r + 7) * 26;
    while (jx < 360) {
      const top = r === 0 ? 151 : rows[r - 1];
      ctx.beginPath(); ctx.moveTo(jx, top); ctx.lineTo(jx, rows[r]); ctx.stroke();
      jx += 24 + h(r * 31 + jx) * 22;
    }
  }

  /* 鳩（歩く。首がT()で前後） */
  const px = 66 + Math.sin(t * 0.5) * 14, pb = Math.abs(Math.sin(t * 5)) * 1.4;
  ctx.fillStyle = '#8a8ea0';
  ctx.beginPath(); ctx.ellipse(px, 184, 4, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(px + 4 + pb, 181.5, 1.8, 0, Math.PI * 2); ctx.fill();
  P(ctx, Math.round(px + 5 + pb), 181, 2, 1, '#d8a848');
  ctx.strokeStyle = '#b06a4a'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px - 1, 186); ctx.lineTo(px - 1 - pb * 0.6, 189); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px + 2, 186); ctx.lineTo(px + 2 + pb * 0.6, 189); ctx.stroke();

  /* ── 主役：ベンチと夫婦の後ろ姿 ── */
  const BX = 126, BW = 108;
  /* 脚（先に描いて背もたれで隠す） */
  P(ctx, BX + 8, 158, 4, 16, '#5a4230'); P(ctx, BX + BW - 12, 158, 4, 16, '#5a4230');
  P(ctx, BX + 6, 172, 8, 2, '#463222'); P(ctx, BX + BW - 14, 172, 8, 2, '#463222');
  /* 座面のふち（背もたれの下にわずかに見える） */
  P(ctx, BX + 2, 155, BW - 4, 4, '#775a3c');

  /* 夫（左）：黒短髪・紺シャツ。背中を丸めて座る */
  ctx.fillStyle = '#2e3a66';
  ctx.beginPath();
  ctx.moveTo(150, 156); ctx.lineTo(150, 128);
  ctx.quadraticCurveTo(150, 121, 157, 120);
  ctx.lineTo(169, 120);
  ctx.quadraticCurveTo(176, 121, 176, 128);
  ctx.lineTo(176, 156); ctx.closePath(); ctx.fill();
  P(ctx, 151, 124, 24, 1, '#42509a');                    /* 肩の1px縁光 */
  P(ctx, 160, 119, 6, 3, '#e8c39a');                     /* 首 */
  ctx.fillStyle = '#241f1c';                              /* 後頭部＝黒髪 */
  ctx.beginPath(); ctx.arc(163, 111, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(120,140,180,.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(163, 111, 6, Math.PI * 1.15, Math.PI * 1.75); ctx.stroke();
  P(ctx, 156, 112, 2, 3, '#e8c39a'); P(ctx, 168, 112, 2, 3, '#e8c39a');   /* 耳 */
  /* 夫の左腕は背もたれの上、妻の背へ回す */
  ctx.strokeStyle = '#2e3a66'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(174, 127); ctx.quadraticCurveTo(184, 122, 194, 128); ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = '#e8c39a'; ctx.beginPath(); ctx.arc(196, 129, 2.2, 0, Math.PI * 2); ctx.fill();

  /* 妻（右）：茶髪を後ろで結ぶ・暖色の服。頭が夫の肩へわずかに傾く。
     S級審査（8/9）：背中の間を詰めて肩を触れさせる＝「もう離れてはいない」 */
  ctx.save(); ctx.translate(-3, 0);
  ctx.fillStyle = '#d0784f';
  ctx.beginPath();
  ctx.moveTo(180, 156); ctx.lineTo(180, 131);
  ctx.quadraticCurveTo(180, 125, 186, 124);
  ctx.lineTo(196, 124);
  ctx.quadraticCurveTo(202, 125, 202, 131);
  ctx.lineTo(202, 156); ctx.closePath(); ctx.fill();
  P(ctx, 181, 128, 20, 1, '#e89468');                    /* 肩の縁光 */
  P(ctx, 186, 122, 5, 3, '#f0cda6');                     /* 首（傾きぶん左寄り） */
  ctx.fillStyle = '#7a4a2c';                              /* 後頭部＝茶髪・夫の肩へ傾く */
  ctx.beginPath(); ctx.arc(184, 116, 5.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5f381f';                              /* 結び目（低いおだんご） */
  ctx.beginPath(); ctx.arc(188, 119.5, 2.6, 0, Math.PI * 2); ctx.fill();
  P(ctx, 187, 118, 3, 1, '#8f5c38');
  /* ほつれ毛が風に揺れる */
  ctx.strokeStyle = '#7a4a2c'; ctx.lineWidth = 1;
  const hs = Math.sin(t * 3.1) * 1.6;
  ctx.beginPath(); ctx.moveTo(189, 113); ctx.quadraticCurveTo(192 + hs, 111, 194 + hs, 108); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,220,180,.5)';
  ctx.beginPath(); ctx.arc(184, 116, 5.4, Math.PI * 1.2, Math.PI * 1.7); ctx.stroke();
  ctx.restore();
  /* 触れた肩に淡いベージュ1px（S級審査の処方箋） */
  P(ctx, 175, 126, 2, 1, '#d9c3a1');

  /* 背もたれ（横板3枚・木目、上面に1pxの陽） */
  for (let i = 0; i < 3; i++) {
    const by = 138 + i * 7;
    P(ctx, BX, by, BW, 5, '#8a6b48');
    P(ctx, BX, by, BW, 1, '#a8875f');
    P(ctx, BX, by + 4, BW, 1, '#6a4f34');
  }
  P(ctx, BX - 2, 137, 3, 22, '#6a4f34'); P(ctx, BX + BW - 1, 137, 3, 22, '#6a4f34');
  /* ベンチ横に妻のかご（安上がりな遠足の気配） */
  P(ctx, BX + BW + 8, 162, 12, 9, '#b89a62'); P(ctx, BX + BW + 8, 162, 12, 2, '#96793f');
  ctx.strokeStyle = '#96793f'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(BX + BW + 14, 161, 5, Math.PI, Math.PI * 2); ctx.stroke();

  /* ふたりの影 */
  ctx.fillStyle = 'rgba(60,50,40,.18)';
  ctx.beginPath(); ctx.ellipse(176, 176, 46, 5, 0, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = '#201810'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 356, 196);
}


/* ── 水明商店街（夕方・石畳の上品な通り。妻が服を当て、夫は紙袋を提げて待つ） ── */
function y_date_motomachi(ctx) {
  const t = T();
  const h = i => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;

  /* 夕空 */
  const sky = ctx.createLinearGradient(0, 0, 0, 60);
  sky.addColorStop(0, '#d8935e'); sky.addColorStop(1, '#e8b878');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 360, 200);
  /* 帰る鳥の点 */
  for (let i = 0; i < 3; i++) {
    const bx = ((t * 9 + i * 60 + h(i) * 40) % 420) - 30, by = 14 + h(i + 4) * 16;
    ctx.strokeStyle = 'rgba(70,50,40,.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bx - 3, by); ctx.lineTo(bx, by - 2); ctx.lineTo(bx + 3, by); ctx.stroke();
  }
  /* 遠景の屋根の影絵 */
  ctx.fillStyle = '#b08658';
  ctx.beginPath(); ctx.moveTo(0, 44); ctx.lineTo(30, 34); ctx.lineTo(58, 44); ctx.lineTo(96, 40);
  ctx.lineTo(130, 46); ctx.lineTo(360, 42); ctx.lineTo(360, 60); ctx.lineTo(0, 60); ctx.closePath(); ctx.fill();

  /* ── 店の壁面 ── */
  P(ctx, 0, 46, 122, 106, '#c8beae');            /* 左の店（帽子屋） */
  P(ctx, 122, 42, 216, 110, '#d8cfc0');          /* 主役の洋装店 */
  P(ctx, 338, 44, 22, 108, '#ded6c8');           /* 右端の店の切れ端 */
  P(ctx, 120, 42, 3, 110, '#a89a86');            /* 店境の柱 */
  P(ctx, 336, 44, 3, 108, '#a89a86');
  /* コーニス（軒飾り。高さを揃えない） */
  P(ctx, 0, 46, 122, 5, '#8a8070'); P(ctx, 0, 46, 122, 1, '#f0d8a8');
  P(ctx, 122, 42, 216, 6, '#7a7062'); P(ctx, 122, 42, 216, 1, '#f0d8a8');
  P(ctx, 338, 44, 22, 5, '#8a8070');
  /* 壁の石目（擬似ハッシュ散らし） */
  for (let i = 0; i < 22; i++) {
    const wx = h(i + 10) * 350, wy = 52 + h(i + 40) * 40;
    P(ctx, Math.round(wx), Math.round(wy), 5 + Math.round(h(i) * 6), 1, 'rgba(120,108,92,.18)');
  }

  /* 洋装店の看板 */
  P(ctx, 176, 52, 122, 13, '#3a4a3c'); P(ctx, 176, 52, 122, 1, '#5c7a5e');
  ctx.font = '8px monospace'; ctx.textAlign = 'center';
  ctx.fillStyle = '#f0e8d0'; ctx.fillText('洋 装  ミ ナ セ', 237, 62);
  ctx.textAlign = 'left';

  /* 日よけ（深緑。幅も高さも波の刻みも左右で変える） */
  ctx.fillStyle = '#3f6b52';
  ctx.beginPath(); ctx.moveTo(184, 66); ctx.lineTo(310, 66); ctx.lineTo(304, 82); ctx.lineTo(190, 82); ctx.closePath(); ctx.fill();
  P(ctx, 190, 68, 114, 1, '#5c8a6e');
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 ? '#35604a' : '#3f6b52';
    ctx.beginPath(); ctx.arc(196 + i * 12, 82, 6, 0, Math.PI); ctx.fill();
  }
  ctx.fillStyle = '#2d5442';
  ctx.beginPath(); ctx.moveTo(20, 92); ctx.lineTo(102, 92); ctx.lineTo(98, 104); ctx.lineTo(24, 104); ctx.closePath(); ctx.fill();
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(30 + i * 16, 104, 8, 0, Math.PI); ctx.fill(); }

  /* 左の店のウィンドウ（帽子屋。控えめな灯り） */
  P(ctx, 30, 104, 66, 44, '#3a3228');
  P(ctx, 33, 107, 60, 38, '#e8d0a0');
  P(ctx, 33, 107, 60, 10, '#f4e2b8');
  P(ctx, 42, 122, 10, 4, '#8a4a3a'); P(ctx, 44, 119, 6, 4, '#8a4a3a');       /* 帽子たち */
  P(ctx, 62, 124, 12, 3, '#4a5a7a'); P(ctx, 65, 120, 6, 5, '#4a5a7a');
  P(ctx, 80, 121, 8, 6, '#c8a040');
  ctx.font = '7px monospace'; ctx.fillStyle = '#5a4c3a'; ctx.fillText('帽子', 52, 101);

  /* ── 主役のショーウィンドウ（灯りがともる） ── */
  P(ctx, 192, 84, 116, 68, '#4a3a2c');
  const glow = ctx.createLinearGradient(0, 88, 0, 148);
  glow.addColorStop(0, '#f8e2b4'); glow.addColorStop(1, '#e2bc84');
  ctx.fillStyle = glow; ctx.fillRect(196, 88, 108, 60);
  P(ctx, 249, 88, 2, 60, '#4a3a2c');                     /* 中桟 */
  /* 中のトルソーと棚 */
  P(ctx, 210, 100, 14, 26, '#b86a58'); P(ctx, 214, 96, 6, 5, '#8a7a6a');
  P(ctx, 210, 100, 14, 2, '#d88a70');
  P(ctx, 232, 112, 12, 20, '#6a7a9a'); P(ctx, 232, 112, 12, 2, '#8a9cba');
  P(ctx, 260, 104, 36, 2, '#7a6a54'); P(ctx, 262, 96, 8, 8, '#c8b8d8'); P(ctx, 276, 95, 9, 9, '#a8c0a0');
  P(ctx, 260, 126, 36, 2, '#7a6a54'); P(ctx, 264, 118, 10, 8, '#d8b090');
  /* ガラスの斜めの照り返しと、妻のぼんやりした映り込み */
  ctx.fillStyle = 'rgba(255,240,210,.13)';
  ctx.beginPath(); ctx.moveTo(202, 88); ctx.lineTo(224, 88); ctx.lineTo(200, 148); ctx.lineTo(196, 148); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.14)';
  ctx.beginPath(); ctx.ellipse(262, 122, 6, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(262, 104, 4, 0, Math.PI * 2); ctx.fill();

  /* ガス灯（点きはじめ。T()でちらつく） */
  const lamp = (x, ph, s) => {
    P(ctx, x - 1, 62, 3, 96, '#3a342c'); P(ctx, x - 1, 62, 1, 96, '#5a5248');
    P(ctx, x - 4, 60, 9, 3, '#3a342c');
    P(ctx, x - 3, 50, 7, 11, '#4a4238');
    const fl = 0.5 + 0.28 * Math.sin(t * 9 + ph) + 0.22 * h(Math.floor(t * 4) + ph);
    P(ctx, x - 2, 52, 5, 7, `rgba(216,168,72,${Math.min(1, fl).toFixed(2)})`);
    ctx.fillStyle = `rgba(232,178,88,${(fl * 0.16).toFixed(2)})`;
    ctx.beginPath(); ctx.arc(x + 0.5, 55, 14 * s, 0, Math.PI * 2); ctx.fill();
  };
  lamp(140, 1.7, 1);
  P(ctx, 324, 96, 2, 62, '#3a342c'); P(ctx, 321, 90, 8, 8, '#4a4238');
  const fl2 = 0.4 + 0.3 * Math.sin(t * 7 + 5);
  P(ctx, 323, 92, 4, 5, `rgba(216,168,72,${fl2.toFixed(2)})`);

  /* 石畳（目地は行ごとに互い違い＋不揃い） */
  P(ctx, 0, 152, 360, 48, '#9a9488');
  P(ctx, 0, 152, 360, 1, '#b4aea0');
  ctx.strokeStyle = 'rgba(55,50,44,.30)'; ctx.lineWidth = 1;
  const prows = [158, 165, 174, 185, 198];
  for (let r = 0; r < prows.length; r++) {
    ctx.beginPath(); ctx.moveTo(0, prows[r]); ctx.lineTo(360, prows[r]); ctx.stroke();
    let jx = h(r * 13 + 3) * 20;
    while (jx < 360) {
      const top = r === 0 ? 152 : prows[r - 1];
      ctx.beginPath(); ctx.moveTo(jx, top); ctx.lineTo(jx, prows[r]); ctx.stroke();
      jx += 16 + h(r * 47 + jx) * 18;
    }
  }
  /* ウィンドウの灯りが石畳に落ちる。
     S級審査（8/9）：光を左へ伸ばして夫の足元まで届かせる＝二人が同じ光の中に入る */
  ctx.fillStyle = 'rgba(248,214,150,.16)';
  ctx.beginPath(); ctx.moveTo(196, 152); ctx.lineTo(304, 152); ctx.lineTo(322, 200); ctx.lineTo(178, 200); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(228,193,140,.14)';                 /* #E4C18C の淡い延長 */
  ctx.beginPath(); ctx.moveTo(196, 152); ctx.lineTo(210, 152); ctx.lineTo(190, 200); ctx.lineTo(156, 200); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(228,193,140,.18)';
  ctx.beginPath(); ctx.ellipse(180, 176, 26, 6, 0, 0, Math.PI * 2); ctx.fill();

  /* ── 妻：服を体に当ててガラスを鏡代わりに見る ── */
  /* 脚（膝をわずかに折る） */
  P(ctx, 249, 158, 4, 12, '#8a5a40'); P(ctx, 256, 157, 4, 12, '#8a5a40');
  P(ctx, 250, 168, 4, 3, '#5a3a2a'); P(ctx, 257, 167, 4, 3, '#5a3a2a');
  /* 体（暖色のカーディガン。肩は丸く） */
  ctx.fillStyle = '#d0855c';
  ctx.beginPath();
  ctx.moveTo(246, 159); ctx.lineTo(246, 138);
  ctx.quadraticCurveTo(246, 132, 252, 131);
  ctx.lineTo(258, 131);
  ctx.quadraticCurveTo(264, 132, 264, 138);
  ctx.lineTo(264, 159); ctx.closePath(); ctx.fill();
  P(ctx, 260, 134, 3, 1, '#f0b088');                      /* 窓の灯を受ける縁光 */
  /* 頭（横顔でガラスを見る。茶髪を後ろで結ぶ） */
  P(ctx, 253, 128, 5, 3, '#f0cda6');
  ctx.fillStyle = '#f0cda6'; ctx.beginPath(); ctx.arc(257, 123, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7a4a2c';
  ctx.beginPath(); ctx.arc(255.5, 121.5, 5.2, Math.PI * 0.75, Math.PI * 2.05); ctx.fill();
  ctx.beginPath(); ctx.arc(251, 126, 2.8, 0, Math.PI * 2); ctx.fill();     /* 結び目 */
  ctx.strokeStyle = '#5f381f'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(250, 128); ctx.quadraticCurveTo(248, 132, 249, 135); ctx.stroke();
  P(ctx, 260, 122, 1, 1, '#3a2a20');                      /* ガラスへ向く目 */
  /* 当てている服（体の前に掲げるワンピース。裾がかすかに揺れる） */
  const dsw = Math.sin(t * 1.6) * 1.2;
  ctx.fillStyle = '#c88a9a';
  ctx.beginPath();
  ctx.moveTo(252, 137); ctx.lineTo(262, 137);
  ctx.lineTo(266 + dsw, 162); ctx.lineTo(250 + dsw, 162); ctx.closePath(); ctx.fill();
  P(ctx, 252, 137, 10, 2, '#e0aab8'); P(ctx, 256, 139, 2, 21, 'rgba(140,80,96,.5)');
  ctx.strokeStyle = '#8a5a66'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(254, 137); ctx.lineTo(257, 133); ctx.lineTo(260, 137); ctx.stroke();  /* ハンガー */
  /* 服を持つ両腕 */
  ctx.strokeStyle = '#d0855c'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(248, 137); ctx.lineTo(253, 134); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(263, 138); ctx.lineTo(260, 134); ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = '#f0cda6';
  ctx.beginPath(); ctx.arc(254, 133.5, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(259.5, 133.5, 1.6, 0, Math.PI * 2); ctx.fill();

  /* ── 夫：少し後ろで紙袋を2つ提げて待つ（片手を持ち直す） ── */
  const lift = Math.pow(Math.max(0, Math.sin(t * 1.1 + 0.6)), 10) * 3;
  /* 脚（重心を片足に。後ろ膝を折る） */
  P(ctx, 176, 162, 4, 13, '#3a3a44'); P(ctx, 183, 161, 4, 8, '#3a3a44'); P(ctx, 184, 168, 4, 6, '#3a3a44');
  P(ctx, 176, 174, 5, 3, '#26262e'); P(ctx, 185, 173, 5, 3, '#26262e');
  /* 体（紺シャツ・肩は丸く、少し猫背） */
  ctx.fillStyle = '#2e3a66';
  ctx.beginPath();
  ctx.moveTo(173, 163); ctx.lineTo(173, 141);
  ctx.quadraticCurveTo(173, 134, 180, 133);
  ctx.lineTo(186, 133);
  ctx.quadraticCurveTo(192, 134, 192, 141);
  ctx.lineTo(192, 163); ctx.closePath(); ctx.fill();
  P(ctx, 188, 136, 3, 1, '#5a6aa0');
  /* 頭（黒短髪。妻のほうを向く横顔） */
  P(ctx, 180, 130, 5, 3, '#e8c39a');
  ctx.fillStyle = '#e8c39a'; ctx.beginPath(); ctx.arc(184, 125, 5.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#241f1c';
  ctx.beginPath(); ctx.arc(182.5, 123.5, 5.4, Math.PI * 0.8, Math.PI * 2.1); ctx.fill();
  P(ctx, 187, 124, 1, 1, '#3a2a20');
  /* 左手の紙袋（提げたまま） */
  ctx.strokeStyle = '#2e3a66'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(174, 142); ctx.lineTo(171, 152); ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = '#e8c39a'; ctx.beginPath(); ctx.arc(171, 153, 1.7, 0, Math.PI * 2); ctx.fill();
  P(ctx, 165, 156, 12, 15, '#c8a878'); P(ctx, 165, 156, 12, 2, '#dbc094'); P(ctx, 165, 169, 12, 2, '#a8885c');
  ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(171, 156, 3.5, Math.PI, Math.PI * 2); ctx.stroke();
  /* 右手の紙袋（T()でときどき持ち直して浮く） */
  ctx.strokeStyle = '#2e3a66'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(191, 142); ctx.lineTo(194, 152 - lift); ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = '#e8c39a'; ctx.beginPath(); ctx.arc(194, 153 - lift, 1.7, 0, Math.PI * 2); ctx.fill();
  const b2y = 156 - lift;
  P(ctx, 189, Math.round(b2y), 11, 13, '#d8cfc0'); P(ctx, 189, Math.round(b2y), 11, 2, '#ece5d8');
  P(ctx, 189, Math.round(b2y) + 11, 11, 2, '#b0a894');
  P(ctx, 191, Math.round(b2y) + 4, 7, 4, '#b8687a');      /* 袋のリボン柄 */
  ctx.strokeStyle = '#8a8274'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(194.5, b2y, 3.2, Math.PI, Math.PI * 2); ctx.stroke();

  /* ふたりの長い夕方の影（光は窓とガス灯＝右から） */
  ctx.fillStyle = 'rgba(50,42,36,.22)';
  ctx.beginPath(); ctx.ellipse(173, 177, 17, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(246, 171, 15, 3, 0, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = '#201810'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 356, 196);
}


/* ── 旧香料倉庫（夕暮れ・煉瓦倉庫前のイベント広場。夫婦は外から眺める） ── */
function y_date_akarenga(ctx) {
  const t = T();
  const h = i => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;

  /* 夕暮れの空 */
  const sky = ctx.createLinearGradient(0, 0, 0, 64);
  sky.addColorStop(0, '#b06a4c'); sky.addColorStop(1, '#e8a86b');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 360, 200);
  /* 薄い雲の帯 */
  P(ctx, 40, 16, 90, 3, 'rgba(240,196,140,.7)'); P(ctx, 210, 26, 120, 3, 'rgba(240,196,140,.6)');
  P(ctx, 120, 34, 60, 2, 'rgba(240,196,140,.5)');

  /* ── 煉瓦倉庫の大きな壁 ── */
  const WX = 18, WW = 324, WY = 40, WB = 122;
  /* 屋根とコーニス */
  P(ctx, WX - 6, WY - 6, WW + 12, 6, '#6a3626'); P(ctx, WX - 6, WY - 6, WW + 12, 1, '#f0c088');
  P(ctx, WX, WY, WW, WB - WY, '#9a4f38');
  /* 煉瓦の目地 */
  ctx.strokeStyle = 'rgba(46,20,14,.32)'; ctx.lineWidth = 1;
  for (let y = WY + 6; y < WB; y += 6) {
    ctx.beginPath(); ctx.moveTo(WX, y); ctx.lineTo(WX + WW, y); ctx.stroke();
    for (let x = WX + ((y / 6) % 2 ? 0 : 8); x < WX + WW; x += 16) {
      ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x, y); ctx.stroke();
    }
  }
  /* 焼きむらの煉瓦を散らす */
  for (let i = 0; i < 34; i++) {
    const bx = WX + h(i + 5) * (WW - 14), by = WY + 6 * Math.floor(h(i + 55) * ((WB - WY) / 6 - 1));
    ctx.fillStyle = h(i + 90) > 0.5 ? '#a85f44' : '#8a4530';
    ctx.fillRect(Math.round(bx), Math.round(by) + 1, 7, 5);
  }
  /* 夕陽が壁の上端をなめる */
  P(ctx, WX, WY, WW, 2, '#c8785a');
  /* 消えかけたペイントの屋号 */
  ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(232,224,208,.34)';
  ctx.fillText('香 料 倉 庫', 140, 56);

  /* アーチ窓（幅も間隔も不揃い。中は催しの灯り） */
  const arch = (x, w, hh, ph) => {
    const top = WB - hh;
    ctx.fillStyle = '#3a2018';
    ctx.beginPath(); ctx.moveTo(x - 2, WB); ctx.lineTo(x - 2, top + w / 2);
    ctx.arc(x + w / 2, top + w / 2 + 2, w / 2 + 2, Math.PI, 0);
    ctx.lineTo(x + w + 2, WB); ctx.closePath(); ctx.fill();
    const gl = 0.8 + 0.12 * Math.sin(t * 3 + ph);
    ctx.fillStyle = `rgba(255,214,132,${gl.toFixed(2)})`;
    ctx.beginPath(); ctx.moveTo(x, WB); ctx.lineTo(x, top + w / 2 + 2);
    ctx.arc(x + w / 2, top + w / 2 + 2, w / 2, Math.PI, 0);
    ctx.lineTo(x + w, WB); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#3a2018'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + w / 2, top + 2); ctx.lineTo(x + w / 2, WB); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, WB - hh * 0.42); ctx.lineTo(x + w, WB - hh * 0.42); ctx.stroke();
    /* 窓の中の人影 */
    ctx.fillStyle = 'rgba(60,34,26,.55)';
    ctx.beginPath(); ctx.arc(x + w * 0.3, WB - 5, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(x + w * 0.3 - 2, WB - 4, 5, 4);
  };
  arch(52, 30, 46, 0); arch(126, 44, 58, 2.1); arch(216, 26, 40, 4.2); arch(282, 36, 52, 1.3);

  /* 広場の地面（夕陽の照り返し） */
  const gnd = ctx.createLinearGradient(0, WB, 0, 200);
  gnd.addColorStop(0, '#8a7562'); gnd.addColorStop(1, '#5a4c40');
  ctx.fillStyle = gnd; ctx.fillRect(0, WB, 360, 200 - WB);
  P(ctx, 0, WB, 360, 1, '#b08a64');
  for (let i = 0; i < 16; i++) {
    const sx = h(i + 30) * 350, sy = WB + 6 + h(i + 70) * 60;
    P(ctx, Math.round(sx), Math.round(sy), 6 + Math.round(h(i) * 8), 1, 'rgba(40,28,22,.20)');
  }

  /* ── 白テントの屋台（幅・間隔・高さを崩す） ── */
  const tent = (x, w, ty, ph) => {
    P(ctx, x + 2, ty + 10, 2, 16, '#5a4636'); P(ctx, x + w - 4, ty + 10, 2, 16, '#5a4636');
    ctx.fillStyle = '#e8e4d8';
    ctx.beginPath(); ctx.moveTo(x - 3, ty + 10); ctx.lineTo(x + w * 0.5, ty); ctx.lineTo(x + w + 3, ty + 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d4cfbe';
    ctx.beginPath(); ctx.moveTo(x + w * 0.5, ty); ctx.lineTo(x + w + 3, ty + 10); ctx.lineTo(x + w - 1, ty + 12); ctx.lineTo(x + w * 0.5, ty + 2); ctx.closePath(); ctx.fill();
    P(ctx, x - 3, ty + 9, w + 6, 1, '#f6f2e6');
    /* 台と品 */
    P(ctx, x + 1, ty + 20, w - 2, 7, '#7a5a3c'); P(ctx, x + 1, ty + 20, w - 2, 1, '#9a7850');
    for (let i = 0; i < Math.floor(w / 9); i++) {
      ctx.fillStyle = ['#c86a4a', '#c8a040', '#6a8a5a', '#9a6ab0'][Math.floor(h(i + ph) * 4)];
      ctx.fillRect(x + 3 + i * 9 + h(i * 3 + ph) * 3, ty + 16, 4, 4);
    }
    /* 裸電球（またたく） */
    for (let i = 0; i < Math.floor(w / 12); i++) {
      const on = h(i * 7 + ph + Math.floor(t * 2)) > 0.25;
      P(ctx, x + 4 + i * 12, ty + 11, 2, 2, on ? '#ffd98a' : '#8a6a48');
    }
  };
  tent(48, 52, 128, 1); tent(128, 68, 124, 7); tent(238, 40, 131, 13);
  wisp(ctx, 148, 122, 3, .3);                             /* 屋台の湯気 */

  /* ── 人の渦（肩は丸く・向きも背丈もバラバラの影絵） ── */
  const fig = (x, y, s, col, face) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x - 3 * s, y); ctx.lineTo(x - 3 * s, y - 5 * s);
    ctx.quadraticCurveTo(x - 3 * s, y - 8 * s, x, y - 8 * s);
    ctx.quadraticCurveTo(x + 3 * s, y - 8 * s, x + 3 * s, y - 5 * s);
    ctx.lineTo(x + 3 * s, y); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(x + face * 1.6 * s, y - 9.6 * s, 2.3 * s, 0, Math.PI * 2); ctx.fill();
  };
  const cols = ['#2a2430', '#332a26', '#3a3040', '#26202a'];
  for (let i = 0; i < 19; i++) {
    const d = h(i + 200);                                  /* 0=奥 1=手前 */
    const x = 34 + h(i + 300) * 290;
    const y = 138 + d * 26 + h(i + 400) * 5;
    const s = 0.62 + d * 0.5;
    const face = [-1, 0, 1][Math.floor(h(i + 500) * 3)];
    const bob = Math.sin(t * 2 + i * 2.3) * 0.6;           /* ざわめきの上下 */
    fig(x, y + bob, s, cols[Math.floor(h(i + 600) * 4)], face);
  }
  /* 群衆の頭に夕陽の縁光を1px */
  for (let i = 0; i < 7; i++) {
    const x = 44 + h(i + 700) * 280, y = 128 + h(i + 800) * 24;
    P(ctx, Math.round(x), Math.round(y), 2, 1, 'rgba(255,190,120,.5)');
  }

  /* ── 旗のガーランド（T()で揺れる。2本、たわみも違う） ── */
  const garland = (x0, y0, x1, y1, dip, n, ph) => {
    ctx.strokeStyle = 'rgba(240,230,210,.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2, dip, x1, y1); ctx.stroke();
    const fcols = ['#e05a4a', '#e8d05a', '#5a88c8', '#e8e4d8', '#6aa870'];
    for (let i = 0; i < n; i++) {
      const tt = (i + 0.5 + (h(i + ph) - 0.5) * 0.4) / n;
      const mx = (1 - tt) * (1 - tt) * x0 + 2 * (1 - tt) * tt * ((x0 + x1) / 2) + tt * tt * x1;
      const my = (1 - tt) * (1 - tt) * y0 + 2 * (1 - tt) * tt * dip + tt * tt * y1;
      const sw = Math.sin(t * 2.4 + i * 1.1 + ph) * 2;
      ctx.fillStyle = fcols[Math.floor(h(i * 3 + ph) * 5)];
      ctx.beginPath(); ctx.moveTo(mx - 3, my); ctx.lineTo(mx + 3, my); ctx.lineTo(mx + sw * 0.3, my + 7 + sw * 0.5); ctx.closePath(); ctx.fill();
    }
  };
  garland(20, 62, 200, 70, 96, 9, 2);
  garland(200, 70, 344, 58, 92, 8, 11);

  /* S級審査（8/9）：二人の前に半円の「余白」＝人の渦と二人の間の距離。
     一段暗い灰褐色で、群衆がここへは踏み込んでいないことを地面で見せる */
  ctx.fillStyle = 'rgba(107,92,86,.55)';                   /* #6B5C56 */
  ctx.beginPath(); ctx.ellipse(118, 180, 26, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(107,92,86,.28)';
  ctx.beginPath(); ctx.ellipse(118, 180, 36, 11, 0, 0, Math.PI * 2); ctx.fill();

  /* ── 夫婦：手前の端、輪の外から眺める ── */
  /* 夫（黒短髪・紺シャツ。右腕で屋台を指さす）——半分後ろ姿 */
  P(ctx, 58, 178, 5, 15, '#3a3a44'); P(ctx, 66, 178, 5, 11, '#3a3a44'); P(ctx, 67, 187, 5, 7, '#3a3a44');
  P(ctx, 57, 192, 6, 3, '#26262e'); P(ctx, 68, 192, 6, 3, '#26262e');
  ctx.fillStyle = '#2e3a66';
  ctx.beginPath();
  ctx.moveTo(54, 180); ctx.lineTo(54, 154);
  ctx.quadraticCurveTo(54, 147, 61, 146);
  ctx.lineTo(69, 146);
  ctx.quadraticCurveTo(76, 147, 76, 154);
  ctx.lineTo(76, 180); ctx.closePath(); ctx.fill();
  P(ctx, 72, 149, 3, 1, '#ffb47a');                       /* 会場の灯を受ける縁光（右） */
  P(ctx, 74, 152, 2, 22, 'rgba(255,170,110,.35)');
  P(ctx, 62, 143, 6, 4, '#e8c39a');
  ctx.fillStyle = '#e8c39a'; ctx.beginPath(); ctx.arc(66, 137, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#241f1c';
  ctx.beginPath(); ctx.arc(64, 135.5, 6.2, Math.PI * 0.72, Math.PI * 2.12); ctx.fill();
  P(ctx, 70, 136, 1, 1, '#3a2a20');
  ctx.strokeStyle = 'rgba(255,180,120,.6)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(66, 137, 5.7, Math.PI * 1.75, Math.PI * 2.2); ctx.stroke();
  /* 指さす右腕（肘から先を上げる） */
  ctx.strokeStyle = '#2e3a66'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(74, 153); ctx.lineTo(84, 148); ctx.lineTo(94, 141); ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = '#e8c39a'; ctx.beginPath(); ctx.arc(95, 140, 2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#e8c39a'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(96, 140); ctx.lineTo(100, 137); ctx.stroke();

  /* 妻（茶髪の結び・暖色）——夫の指の先を見上げ、両手を前で重ねる */
  P(ctx, 88, 180, 4, 12, '#8a5a40'); P(ctx, 94, 180, 4, 12, '#8a5a40');
  P(ctx, 88, 190, 5, 3, '#5a3a2a'); P(ctx, 94, 190, 5, 3, '#5a3a2a');
  ctx.fillStyle = '#d0855c';
  ctx.beginPath();
  ctx.moveTo(84, 181); ctx.lineTo(84, 158);
  ctx.quadraticCurveTo(84, 152, 90, 151);
  ctx.lineTo(96, 151);
  ctx.quadraticCurveTo(102, 152, 102, 158);
  ctx.lineTo(102, 181); ctx.closePath(); ctx.fill();
  P(ctx, 98, 154, 3, 1, '#ffb47a');
  P(ctx, 100, 158, 2, 18, 'rgba(255,170,110,.35)');
  /* 前で重ねた両手 */
  ctx.strokeStyle = '#d0855c'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(85, 160); ctx.lineTo(92, 167); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(101, 160); ctx.lineTo(94, 167); ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = '#f0cda6'; ctx.beginPath(); ctx.arc(93, 168, 2.2, 0, Math.PI * 2); ctx.fill();
  /* 頭（少し上向き） */
  P(ctx, 90, 148, 5, 4, '#f0cda6');
  ctx.fillStyle = '#f0cda6'; ctx.beginPath(); ctx.arc(94, 142, 5.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7a4a2c';
  ctx.beginPath(); ctx.arc(92, 141, 5.6, Math.PI * 0.7, Math.PI * 2.05); ctx.fill();
  ctx.beginPath(); ctx.arc(88, 145, 2.6, 0, Math.PI * 2); ctx.fill();     /* 結び目 */
  P(ctx, 97, 140, 1, 1, '#3a2a20');
  ctx.strokeStyle = 'rgba(255,180,120,.6)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(94, 142, 5.1, Math.PI * 1.75, Math.PI * 2.2); ctx.stroke();

  /* ふたりの影は会場と反対＝左へ長く */
  ctx.fillStyle = 'rgba(30,22,18,.30)';
  ctx.beginPath(); ctx.ellipse(52, 195, 24, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(82, 194, 18, 3, 0, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = '#201810'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 356, 196);
}

/* ══════════════════════════════════════════════════════
   旧貿易地区 1/6 ── 大門の通り（夕方・提灯が灯り始める）
   夕陽の残る空、緑青の大門を見上げる夫婦の後ろ姿。
   ══════════════════════════════════════════════════════ */
function y_date_chuka1(ctx) {
  const t = T();
  const h = i => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;

  /* 夕空（まだ日が高い） */
  const sky = ctx.createLinearGradient(0, 0, 0, 130);
  sky.addColorStop(0, '#c87850'); sky.addColorStop(.55, '#d88858'); sky.addColorStop(1, '#f0c080');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 360, 130);
  // 西日（左上に低く傾いた太陽）
  ctx.fillStyle = '#ffe8b0';
  ctx.beginPath(); ctx.arc(58, 34, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,232,176,.25)';
  ctx.beginPath(); ctx.arc(58, 34, 18, 0, Math.PI * 2); ctx.fill();
  // 細い夕雲
  ctx.fillStyle = 'rgba(255,214,160,.55)';
  P(ctx, 120, 26, 70, 4, 'rgba(255,214,160,.55)');
  P(ctx, 210, 44, 96, 5, 'rgba(250,190,140,.5)');
  P(ctx, 30, 58, 54, 4, 'rgba(255,214,160,.4)');

  /* 通りの両側の建物（生成りの壁・高さを崩す） */
  const bldg = (x, w, top, dark) => {
    P(ctx, x, top, w, 130 - top, dark ? '#b8a888' : '#d8c8a8');
    P(ctx, x, top, w, 3, '#5a4438');
    P(ctx, x, top + 3, w, 1, '#f0e0c0');            // 縁光
    for (let wy = top + 10; wy < 122; wy += 14) {
      for (let wx = x + 4; wx < x + w - 6; wx += 11) {
        const lit = h(wx * 3 + wy) < .4;
        P(ctx, wx, wy, 6, 8, lit ? '#f8d890' : '#5a4438');
        if (lit) P(ctx, wx, wy, 6, 1, '#fff0c0');
      }
    }
  };
  bldg(0, 62, 46, false); bldg(62, 40, 66, true);
  bldg(258, 46, 58, true); bldg(304, 56, 40, false);

  /* 大門（奥・緑青の反り屋根） */
  const GX = 180, GY = 58;                           // 屋根の頂点
  // 柱（赤・金の帯）
  const pil = (x) => {
    P(ctx, x, GY + 30, 10, 52, '#a83028');
    P(ctx, x + 1, GY + 30, 2, 52, '#d86050');       // 縁光
    P(ctx, x - 2, GY + 26, 14, 5, '#d8a848');
    P(ctx, x - 2, GY + 80, 14, 6, '#8a6a30');
  };
  pil(GX - 52); pil(GX + 42);
  // 梁と扁額
  P(ctx, GX - 58, GY + 20, 116, 8, '#a83028');
  P(ctx, GX - 58, GY + 20, 116, 2, '#d86050');
  P(ctx, GX - 20, GY + 21, 40, 12, '#182028');
  ctx.font = '7px monospace'; ctx.textAlign = 'center';
  ctx.fillStyle = '#d8a848'; ctx.fillText('東光門', GX, GY + 30);
  ctx.textAlign = 'left';
  // 反り屋根（緑青）
  ctx.fillStyle = '#4a8a78';
  ctx.beginPath();
  ctx.moveTo(GX - 74, GY + 20);
  ctx.quadraticCurveTo(GX - 30, GY + 2, GX, GY);
  ctx.quadraticCurveTo(GX + 30, GY + 2, GX + 74, GY + 20);
  ctx.quadraticCurveTo(GX + 52, GY + 14, GX, GY + 12);
  ctx.quadraticCurveTo(GX - 52, GY + 14, GX - 74, GY + 20);
  ctx.closePath(); ctx.fill();
  P(ctx, GX - 3, GY - 6, 6, 7, '#d8a848');           // 宝珠
  P(ctx, GX - 3, GY - 6, 6, 1, '#f8e0a0');
  ctx.fillStyle = '#3a6e60';                          // 屋根の下影
  ctx.beginPath();
  ctx.moveTo(GX - 60, GY + 20); ctx.quadraticCurveTo(GX, GY + 10, GX + 60, GY + 20);
  ctx.lineTo(GX + 58, GY + 23); ctx.quadraticCurveTo(GX, GY + 14, GX - 58, GY + 23);
  ctx.closePath(); ctx.fill();
  // 軒先の反り上がり（両端に金の飾り）
  P(ctx, GX - 76, GY + 15, 4, 4, '#d8a848'); P(ctx, GX + 72, GY + 15, 4, 4, '#d8a848');

  /* 石畳の通り（奥へすぼむ） */
  P(ctx, 0, 130, 360, 70, '#9a8a72');
  ctx.strokeStyle = 'rgba(90,68,56,.4)'; ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const y = 134 + i * i * 2.4;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(120, 200); ctx.lineTo(GX - 44, 130); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(252, 200); ctx.lineTo(GX + 42, 130); ctx.stroke();
  // 西日が石畳に落とす色
  ctx.fillStyle = 'rgba(240,180,110,.18)'; ctx.fillRect(0, 130, 360, 70);

  /* 提灯の列（2本のロープ・間隔と大きさを崩す・揺れる・灯り始め） */
  const lantern = (x, y, s, on, ph) => {
    const sw = Math.sin(t * 1.8 + ph) * 1.6;
    const lx = x + sw;
    if (on) {
      ctx.fillStyle = 'rgba(255,180,90,.22)';
      ctx.beginPath(); ctx.arc(lx + s / 2, y + s * .7, s * 1.1, 0, Math.PI * 2); ctx.fill();
    }
    P(ctx, lx + s / 2 - 1, y - 3, 2, 3, '#3a2820');
    P(ctx, lx, y, s, s + 2, on ? '#e85838' : '#c83c30');
    P(ctx, lx + 1, y + 1, s - 2, 2, on ? '#ffb070' : '#d86050');  // 縁光
    P(ctx, lx + s / 2 - 2, y + s + 2, 4, 2, '#d8a848');
  };
  // ロープ1（手前・低い）
  ctx.strokeStyle = 'rgba(58,40,32,.8)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 62); ctx.quadraticCurveTo(180, 78, 360, 58); ctx.stroke();
  const xs1 = [22, 58, 104, 138, 196, 226, 284, 330];
  for (let i = 0; i < xs1.length; i++) {
    const x = xs1[i], yy = 62 + (78 - 62) * Math.sin((x / 360) * Math.PI) - 2;
    lantern(x, yy + 4, 9 + Math.floor(h(i) * 4), h(i + 7) < .5, i * 1.7);
  }
  // ロープ2（奥・高い・小さめ）
  ctx.beginPath(); ctx.moveTo(30, 92); ctx.quadraticCurveTo(180, 102, 330, 90); ctx.stroke();
  const xs2 = [48, 92, 150, 210, 262, 306];
  for (let i = 0; i < xs2.length; i++) {
    const x = xs2[i];
    lantern(x, 96 + Math.floor(h(i + 20) * 4), 6 + Math.floor(h(i + 3) * 3), h(i + 11) < .5, i * 2.3);
  }

  /* S級審査（8/9）：門の真下の中央通路に提灯の光だまり＝「吸い込まれて入っていく街」 */
  ctx.fillStyle = 'rgba(216,176,106,.16)';                 /* #D8B06A */
  ctx.beginPath(); ctx.ellipse(180, 142, 66, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(216,176,106,.20)';
  ctx.beginPath(); ctx.ellipse(180, 138, 42, 7, 0, 0, Math.PI * 2); ctx.fill();

  /* 通りの人（中景・小さく） */
  person(ctx, 148, 122, '#6a5a4a'); person(ctx, 210, 124, '#5a6b8a');
  person(ctx, 96, 132, '#8a5a6a'); person(ctx, 262, 128, '#4a6a5a');
  person(ctx, 176, 118, '#7a5236');

  /* 手前：門を見上げる夫婦（後ろ姿・大きく） */
  // 夫（左）紺シャツ・黒短髪。上を見上げて頭が少し反る
  {
    const x = 130, y = 152;
    P(ctx, x + 2, y + 30, 6, 14, '#2a3040');         // 左脚
    P(ctx, x + 10, y + 30, 6, 13, '#2a3040');        // 右脚（半歩前で短く）
    P(ctx, x + 1, y + 44, 8, 3, '#3a2820'); P(ctx, x + 9, y + 43, 8, 3, '#3a2820');
    ctx.fillStyle = '#2c3a5e';                        // 紺シャツ（肩を丸く）
    ctx.beginPath();
    ctx.moveTo(x, y + 32); ctx.lineTo(x, y + 10);
    ctx.quadraticCurveTo(x, y + 4, x + 6, y + 3);
    ctx.lineTo(x + 12, y + 3);
    ctx.quadraticCurveTo(x + 18, y + 4, x + 18, y + 10);
    ctx.lineTo(x + 18, y + 32); ctx.closePath(); ctx.fill();
    P(ctx, x + 1, y + 5, 2, 26, '#4a5a80');           // 縁光
    P(ctx, x - 2, y + 8, 4, 16, '#2c3a5e');           // 左腕（下ろす）
    P(ctx, x + 16, y + 8, 4, 10, '#2c3a5e');          // 右腕（指をさす途中まで上げる）
    P(ctx, x + 19, y + 4, 5, 4, '#e8c39a');           // 指さす手
    ctx.fillStyle = '#e8c39a';                        // 首〜頭（見上げて反る＝頭を後ろへ）
    ctx.beginPath(); ctx.arc(x + 8, y - 3, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1410';                        // 黒短髪（後頭部が広く見える）
    ctx.beginPath(); ctx.arc(x + 8, y - 4, 6, Math.PI * .85, Math.PI * 2.35); ctx.fill();
    P(ctx, x + 3, y - 2, 10, 4, '#1a1410');
  }
  // 妻（右）暖色の服・茶髪おだんご。両手を後ろで組む
  {
    const x = 158, y = 156;
    P(ctx, x + 2, y + 27, 5, 13, '#8a5a4a');
    P(ctx, x + 9, y + 27, 5, 12, '#8a5a4a');
    P(ctx, x + 1, y + 40, 7, 3, '#5a3a30'); P(ctx, x + 8, y + 39, 7, 3, '#5a3a30');
    ctx.fillStyle = '#d87848';                        // 暖色ワンピ（裾広がり）
    ctx.beginPath();
    ctx.moveTo(x - 1, y + 29); ctx.lineTo(x + 2, y + 8);
    ctx.quadraticCurveTo(x + 2, y + 3, x + 8, y + 2);
    ctx.quadraticCurveTo(x + 14, y + 3, x + 14, y + 8);
    ctx.lineTo(x + 17, y + 29); ctx.closePath(); ctx.fill();
    P(ctx, x + 3, y + 4, 2, 22, '#f09860');           // 縁光
    P(ctx, x + 5, y + 16, 6, 4, '#e8c39a');           // 後ろで組んだ手
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath(); ctx.arc(x + 8, y - 4, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a5236';                        // 茶髪
    ctx.beginPath(); ctx.arc(x + 8, y - 5, 5, Math.PI * .8, Math.PI * 2.4); ctx.fill();
    P(ctx, x + 4, y - 4, 8, 4, '#7a5236');
    ctx.beginPath(); ctx.arc(x + 8, y - 10, 3, 0, Math.PI * 2); ctx.fill();  // おだんご
  }
}

/* ══════════════════════════════════════════════════════
   旧貿易地区 2/6 ── 蒸籠の店先（日暮れ・湯気）
   積まれた蒸籠から湯気。妻は屈んで覗き、夫は財布を出す。
   ══════════════════════════════════════════════════════ */
function y_date_chuka2(ctx) {
  const t = T();
  const h = i => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;

  /* 日暮れの空（細く見えるだけ） */
  const sky = ctx.createLinearGradient(0, 0, 0, 50);
  sky.addColorStop(0, '#7a4a58'); sky.addColorStop(1, '#d88858');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 360, 50);

  /* 店の建物（画面いっぱい・赤い庇） */
  P(ctx, 0, 28, 360, 132, '#c8b494');
  ctx.strokeStyle = 'rgba(90,68,56,.25)'; ctx.lineWidth = 1;
  for (let y = 36; y < 158; y += 9) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); }
  // 庇（赤・波形の縁）
  P(ctx, 0, 28, 360, 20, '#a83028');
  P(ctx, 0, 28, 360, 3, '#d86050');
  ctx.fillStyle = '#8a2420';
  for (let x = 0; x < 360; x += 18) {
    ctx.beginPath(); ctx.arc(x + 9, 48, 9, 0, Math.PI); ctx.fill();
  }
  // 店の看板
  P(ctx, 96, 8, 130, 22, '#182028');
  P(ctx, 96, 8, 130, 2, '#3a4a58');
  ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
  ctx.fillStyle = '#d8a848'; ctx.fillText('點心 香满楼', 161, 24);
  ctx.textAlign = 'left';
  // 店内の窓明かり（暖色）
  P(ctx, 250, 66, 60, 44, '#f8d890'); P(ctx, 250, 66, 60, 2, '#fff0c0');
  P(ctx, 278, 66, 3, 44, '#8a6a48');
  person(ctx, 262, 96, '#8a4a3a');                    // 中で働く影
  // 赤提灯（庇の下に2つ・大きさ違い）
  const lan = (x, y, s, ph) => {
    const sw = Math.sin(t * 2 + ph) * 1.5;
    ctx.fillStyle = 'rgba(255,170,80,.25)';
    ctx.beginPath(); ctx.arc(x + sw + s / 2, y + s * .6, s, 0, Math.PI * 2); ctx.fill();
    P(ctx, x + sw + s / 2 - 1, y - 4, 2, 4, '#3a2820');
    P(ctx, x + sw, y, s, s + 3, '#e85838');
    P(ctx, x + sw + 1, y + 1, s - 2, 2, '#ffb070');
    P(ctx, x + sw + s / 2 - 2, y + s + 3, 4, 2, '#d8a848');
  };
  lan(30, 54, 13, 0); lan(322, 56, 10, 2.1);

  /* 石畳 */
  P(ctx, 0, 160, 360, 40, '#8a7a64');
  ctx.strokeStyle = 'rgba(58,40,32,.35)';
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, 166 + i * 9); ctx.lineTo(360, 166 + i * 9); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,200,120,.12)'; ctx.fillRect(220, 160, 120, 40); // 店明かりの落ち

  /* 蒸籠の屋台（主役・左〜中央） */
  P(ctx, 22, 118, 150, 42, '#7a5330');               // 台
  P(ctx, 22, 118, 150, 4, '#a8804a');
  P(ctx, 26, 160, 8, 26, '#5a4438'); P(ctx, 158, 160, 8, 26, '#5a4438');
  // 蒸し器の釜（湯気の源）
  P(ctx, 36, 104, 54, 14, '#3a3a40'); P(ctx, 36, 104, 54, 2, '#6a6a76');
  P(ctx, 40, 108, 3, 3, '#f0a060');                  // 釜の火の覗き窓
  // 積まれた蒸籠（三山・高さを崩す）
  const seiro = (x, y, w) => {
    P(ctx, x, y, w, 8, '#c8a060');
    P(ctx, x, y, w, 2, '#e8c88a');                    // 縁光
    P(ctx, x + 2, y + 3, w - 4, 1, '#8a6a3a');
    P(ctx, x, y + 7, w, 1, '#6a4a26');
  };
  for (let i = 0; i < 5; i++) seiro(40, 96 - i * 8, 46);       // 山1（5段）
  for (let i = 0; i < 3; i++) seiro(96, 110 - i * 8, 40);      // 山2（3段）
  for (let i = 0; i < 2; i++) seiro(140, 112 - i * 8, 28);     // 山3（2段・フタ半開き）
  P(ctx, 138, 100, 32, 4, '#c8a060'); P(ctx, 138, 100, 32, 1, '#e8c88a');
  // フタの隙間から肉まん
  P(ctx, 146, 106, 7, 5, '#f0e8d8'); P(ctx, 155, 107, 6, 4, '#f0e8d8');
  // 湯気（主役の動き）
  wisp(ctx, 46, 54, 5, .6); wisp(ctx, 100, 82, 4, .5); wisp(ctx, 144, 92, 3, .45);
  // 値札
  P(ctx, 62, 122, 30, 12, '#f0e0c0');
  ctx.font = '7px monospace'; ctx.fillStyle = '#5a4438'; ctx.fillText('3ヶ', 68, 131);

  /* 白衣の店員（蒸籠を胸の高さで運ぶ・膝を折って歩く）。
     作者指摘（8/9）：足が石畳に着くまで下げ、影で接地させる */
  {
    const x = 196, y = 121, step = Math.sin(t * 5);
    ctx.fillStyle = 'rgba(40,28,20,.28)';
    ctx.beginPath(); ctx.ellipse(x + 9, y + 52, 14, 3, 0, 0, Math.PI * 2); ctx.fill();
    P(ctx, x + 2, y + 34, 6, 14 + step * 2, '#e8e4dc');
    P(ctx, x + 10, y + 34, 6, 14 - step * 2, '#e8e4dc');
    P(ctx, x + 1, y + 48 + step * 2, 8, 3, '#3a2820');
    P(ctx, x + 9, y + 48 - step * 2, 8, 3, '#3a2820');
    ctx.fillStyle = '#f4f0e8';                        // 白衣（肩を丸く）
    ctx.beginPath();
    ctx.moveTo(x, y + 36); ctx.lineTo(x, y + 12);
    ctx.quadraticCurveTo(x, y + 6, x + 6, y + 5);
    ctx.lineTo(x + 12, y + 5);
    ctx.quadraticCurveTo(x + 18, y + 6, x + 18, y + 12);
    ctx.lineTo(x + 18, y + 36); ctx.closePath(); ctx.fill();
    P(ctx, x + 1, y + 7, 2, 26, '#fffdf8');
    P(ctx, x + 6, y + 20, 6, 2, '#c8b494');           // 帯
    // 両腕を前へ（蒸籠を抱える）
    P(ctx, x - 6, y + 12, 8, 4, '#f4f0e8'); P(ctx, x - 8, y + 14, 4, 4, '#e8c39a');
    P(ctx, x - 5, y + 20, 7, 4, '#f4f0e8'); P(ctx, x - 7, y + 22, 4, 4, '#e8c39a');
    // 抱えた蒸籠（2段・湯気）
    seiro(x - 22, y + 10, 20); seiro(x - 22, y + 2, 20);
    wisp(ctx, x - 18, y - 4, 2, .5);
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath(); ctx.arc(x + 9, y - 1, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a2018';
    ctx.beginPath(); ctx.arc(x + 9, y - 3, 6, Math.PI, Math.PI * 2); ctx.fill();
    P(ctx, x + 3, y - 10, 12, 5, '#f4f0e8');          // 白いコック帽
    P(ctx, x + 3, y - 12, 12, 3, '#fffdf8');
    P(ctx, x + 12, y - 1, 2, 2, '#2a2018');           // 横顔の目
  }

  /* 妻（腰を折って蒸籠の山を覗き込む・左向き）。作者指摘（8/9）：接地 */
  {
    const x = 106, y = 119;                            // 足が石畳・頭は台上の蒸籠の高さ
    ctx.fillStyle = 'rgba(40,28,20,.28)';
    ctx.beginPath(); ctx.ellipse(x + 12, y + 52, 13, 3, 0, 0, Math.PI * 2); ctx.fill();
    // 脚（膝を少し曲げて立つ）
    P(ctx, x + 8, y + 34, 6, 14, '#8a5a4a');
    P(ctx, x + 14, y + 36, 6, 13, '#8a5a4a');
    P(ctx, x + 6, y + 48, 8, 3, '#5a3a30'); P(ctx, x + 13, y + 49, 8, 3, '#5a3a30');
    ctx.fillStyle = '#d87848';                        // 腰から前へ折れた胴（暖色）
    ctx.beginPath();
    ctx.moveTo(x + 20, y + 36); ctx.lineTo(x + 16, y + 18);
    ctx.quadraticCurveTo(x + 12, y + 8, x + 4, y + 5);
    ctx.quadraticCurveTo(x - 2, y + 4, x - 3, y + 9);
    ctx.quadraticCurveTo(x - 2, y + 13, x + 4, y + 15);
    ctx.quadraticCurveTo(x + 8, y + 22, x + 8, y + 36); ctx.closePath(); ctx.fill();
    P(ctx, x + 12, y + 10, 2, 20, '#f09860');         // 背の縁光
    P(ctx, x - 4, y + 12, 9, 4, '#d87848');           // 前へ伸ばす腕
    P(ctx, x - 8, y + 13, 4, 4, '#e8c39a');           // 蒸籠を指さす手
    ctx.fillStyle = '#7a5236';                        // 茶髪（明るい蒸籠を背に立つ）
    ctx.beginPath(); ctx.arc(x - 1, y - 2, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 6, y - 5, 3.5, 0, Math.PI * 2); ctx.fill(); // おだんご
    ctx.fillStyle = '#e8c39a';                        // 顔（前・下向き）
    ctx.beginPath(); ctx.arc(x - 3, y, 4.5, 0, Math.PI * 2); ctx.fill();
    P(ctx, x - 7, y, 2, 2, '#2a2018');                // 覗く目
    P(ctx, x - 6, y + 3, 3, 1, '#c8604a');            // わあ、の口
    /* S級審査（8/9）：顔の前に乳白色の湯気をもう1束＝「覗き込んで香りを浴びている」 */
    const kao = T();
    for (let k = 0; k < 4; k++) {
      const seed = k * 17 + 3, rise = (kao * 8 + seed * 4) % 13, sway = Math.sin(kao * 2.1 + seed) * 1.8;
      ctx.fillStyle = `rgba(233,225,208,${(0.62 * (1 - rise / 13)).toFixed(3)})`;   /* #E9E1D0 */
      ctx.fillRect(Math.round(x - 16 + k * 3 + sway), Math.round(y + 4 - rise), 3, 5);
    }
  }

  /* 夫（財布を出す・妻の後ろに立つ） */
  {
    const x = 138, y = 121;
    ctx.fillStyle = 'rgba(40,28,20,.28)';
    ctx.beginPath(); ctx.ellipse(x + 9, y + 50, 13, 3, 0, 0, Math.PI * 2); ctx.fill();
    P(ctx, x + 2, y + 32, 6, 15, '#2a3040');
    P(ctx, x + 10, y + 33, 6, 14, '#2a3040');
    P(ctx, x + 1, y + 47, 8, 3, '#3a2820'); P(ctx, x + 9, y + 47, 8, 3, '#3a2820');
    ctx.fillStyle = '#2c3a5e';
    ctx.beginPath();
    ctx.moveTo(x, y + 34); ctx.lineTo(x, y + 12);
    ctx.quadraticCurveTo(x, y + 6, x + 6, y + 5);
    ctx.lineTo(x + 12, y + 5);
    ctx.quadraticCurveTo(x + 18, y + 6, x + 18, y + 12);
    ctx.lineTo(x + 18, y + 34); ctx.closePath(); ctx.fill();
    P(ctx, x + 1, y + 7, 2, 24, '#4a5a80');
    // 両手を胸の前で財布へ（左手=財布・右手=小銭をつまむ）
    P(ctx, x - 3, y + 14, 6, 4, '#2c3a5e');
    P(ctx, x - 6, y + 15, 5, 4, '#e8c39a');
    P(ctx, x - 10, y + 13, 8, 7, '#5a4438');          // 財布
    P(ctx, x - 10, y + 13, 8, 2, '#7a6050');
    P(ctx, x + 2, y + 10, 4, 6, '#e8c39a');           // つまむ右手
    ctx.fillStyle = '#e8c39a';                        // 頭（財布へうつむく）
    ctx.beginPath(); ctx.arc(x + 6, y - 1, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1410';
    ctx.beginPath(); ctx.arc(x + 7, y - 3, 6, Math.PI * .9, Math.PI * 2.2); ctx.fill();
    P(ctx, x + 2, y - 4, 10, 4, '#1a1410');
    P(ctx, x + 2, y, 2, 2, '#2a2018');                // うつむく目
  }

  /* 手前の通行人（作者指摘 8/9：小さすぎた→夫婦と同じ縮尺の後ろ姿2人） */
  const walker = (x, y, col, hair, ph) => {
    const st = Math.sin(t * 4 + ph);
    ctx.fillStyle = 'rgba(40,28,20,.25)';
    ctx.beginPath(); ctx.ellipse(x + 8, y + 48, 11, 3, 0, 0, Math.PI * 2); ctx.fill();
    P(ctx, x + 2, y + 30, 5, 14 + st * 2, col);
    P(ctx, x + 9, y + 31, 5, 13 - st * 2, col);
    P(ctx, x + 1, y + 44 + st * 2, 7, 3, '#3a2820');
    P(ctx, x + 8, y + 44 - st * 2, 7, 3, '#3a2820');
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x, y + 32); ctx.lineTo(x, y + 11);
    ctx.quadraticCurveTo(x, y + 5, x + 6, y + 4);
    ctx.lineTo(x + 10, y + 4);
    ctx.quadraticCurveTo(x + 16, y + 5, x + 16, y + 11);
    ctx.lineTo(x + 16, y + 32); ctx.closePath(); ctx.fill();
    P(ctx, x + 6, y + 2, 5, 3, '#e8c39a');
    ctx.fillStyle = hair;
    ctx.beginPath(); ctx.arc(x + 8, y - 3, 5.5, 0, Math.PI * 2); ctx.fill();
  };
  walker(292, 124, '#6a5a4a', '#2a2018', 0);
  walker(324, 130, '#8a5a6a', '#4a3020', 2.2);
}

/* ══════════════════════════════════════════════════════
   旧貿易地区 3/6 ── 円卓の店内（夜・箸を上げた瞬間）
   赤い円卓・料理の皿・金の飾り文字・ランタンの明かり。
   ══════════════════════════════════════════════════════ */
function y_date_chuka3(ctx) {
  const t = T();
  const h = i => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;

  /* 店内の壁（深い赤・下は腰板） */
  P(ctx, 0, 0, 360, 200, '#5c1f1c');
  P(ctx, 0, 0, 360, 200, 'rgba(28,16,14,.25)');
  for (let i = 0; i < 90; i++) {                      // 壁の質感散らし
    const x = Math.floor(h(i) * 360), y = Math.floor(h(i + 99) * 110);
    P(ctx, x, y, 2, 2, h(i + 5) < .5 ? 'rgba(120,50,44,.5)' : 'rgba(40,18,16,.5)');
  }
  P(ctx, 0, 110, 360, 14, '#3a2820');                 // 腰板の帯
  P(ctx, 0, 110, 360, 2, '#6a5040');

  /* 壁の金の飾り文字（丸い額に一文字） */
  const plaque = (x, y, r, ch) => {
    ctx.fillStyle = '#8a2420';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d8a848'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r - 2, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#f8d890';
    ctx.font = 'bold ' + Math.floor(r) + 'px monospace'; ctx.textAlign = 'center';
    ctx.fillText(ch, x, y + r * .38);
    ctx.textAlign = 'left';
  };
  plaque(66, 52, 17, '福'); plaque(296, 60, 13, '囍');
  // 金の房飾り（額の下・揺れる）
  for (const [fx, fy] of [[66, 70], [296, 74]]) {
    const sw = Math.sin(t * 2 + fx) * 1.5;
    P(ctx, fx - 1 + sw, fy, 2, 10, '#d8a848');
    P(ctx, fx - 3 + sw, fy + 10, 6, 4, '#b8862e');
  }

  /* 赤いランタン（天井から2つ・明滅する暖光） */
  const rl = (x, y, s, ph) => {
    const fl = .8 + .2 * Math.sin(t * 3 + ph);
    ctx.fillStyle = `rgba(255,160,70,${(0.28 * fl).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(x, y + s * .5, s * 1.7, 0, Math.PI * 2); ctx.fill();
    P(ctx, x - 1, y - 12, 2, 12, '#3a2820');
    ctx.fillStyle = '#e85838';
    ctx.beginPath(); ctx.ellipse(x, y + s * .5, s * .8, s * .62, 0, 0, Math.PI * 2); ctx.fill();
    P(ctx, x - s * .5, y + 1, s, 2, '#ffb070');
    P(ctx, x - 3, y - 3, 6, 3, '#d8a848');
    P(ctx, x - 3, y + s, 6, 3, '#d8a848');
    P(ctx, x - 1, y + s + 3, 2, 6, '#b8862e');
  };
  rl(140, 14, 16, 0); rl(250, 20, 12, 1.8);

  /* 窓（夜の紺・向こうに提灯の点） */
  P(ctx, 168, 34, 56, 52, '#1c2030');
  P(ctx, 168, 34, 56, 2, '#3a4a58'); P(ctx, 195, 34, 3, 52, '#3a2820');
  P(ctx, 178, 52, 4, 5, '#e85838'); P(ctx, 206, 44, 3, 4, '#e85838');
  P(ctx, 212, 66, 3, 4, '#d8a848');
  ctx.strokeStyle = '#6a5040'; ctx.lineWidth = 2; ctx.strokeRect(168, 34, 56, 52);

  /* 床 */
  P(ctx, 0, 124, 360, 76, '#4a3428');
  ctx.strokeStyle = 'rgba(20,10,8,.4)'; ctx.lineWidth = 1;
  for (let y = 132; y < 200; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,160,70,.08)'; ctx.fillRect(60, 124, 240, 76);   // ランタンの落ち明かり

  /* 赤い円卓（主役・画面中央いっぱい） */
  ctx.fillStyle = '#2a1410';
  ctx.beginPath(); ctx.ellipse(180, 168, 92, 26, 0, 0, Math.PI * 2); ctx.fill();  // 影
  P(ctx, 116, 150, 12, 34, '#6a3226'); P(ctx, 234, 150, 12, 34, '#6a3226');       // 脚
  ctx.fillStyle = '#a83028';
  ctx.beginPath(); ctx.ellipse(180, 140, 96, 30, 0, 0, Math.PI * 2); ctx.fill();  // 天板
  ctx.fillStyle = '#c84838';
  ctx.beginPath(); ctx.ellipse(180, 137, 96, 29, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#d8a848'; ctx.lineWidth = 2;                                  // 金の縁
  ctx.beginPath(); ctx.ellipse(180, 137, 90, 26, 0, 0, Math.PI * 2); ctx.stroke();
  // ターンテーブル
  ctx.fillStyle = '#8a2420';
  ctx.beginPath(); ctx.ellipse(180, 135, 52, 15, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#a03428';
  ctx.beginPath(); ctx.ellipse(180, 134, 52, 14, 0, 0, Math.PI * 2); ctx.fill();

  /* 料理の皿（色数を絞る＝白皿・料理は茶と金だけ） */
  const dish = (x, y, w, food) => {
    ctx.fillStyle = '#f0e8d8';
    ctx.beginPath(); ctx.ellipse(x, y, w, w * .38, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d8d0c0';
    ctx.beginPath(); ctx.ellipse(x, y + 1, w - 2, w * .34, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = food;
    ctx.beginPath(); ctx.ellipse(x, y, w * .6, w * .24, 0, 0, Math.PI * 2); ctx.fill();
  };
  dish(180, 128, 22, '#8a5a2a');                       // 大皿（あんかけ）
  P(ctx, 172, 124, 5, 4, '#d8a848'); P(ctx, 182, 126, 5, 4, '#d8a848'); P(ctx, 178, 121, 4, 4, '#d8a848');
  wisp(ctx, 172, 118, 3, .5);                          // 大皿の湯気＝いま来たて
  dish(136, 140, 13, '#6a4a26');
  dish(226, 141, 13, '#8a5a2a'); wisp(ctx, 222, 134, 2, .35);
  // 小さい蒸籠も卓上に
  P(ctx, 202, 148, 20, 6, '#c8a060'); P(ctx, 202, 148, 20, 2, '#e8c88a');
  // 茶器
  P(ctx, 158, 150, 9, 7, '#f0e8d8'); P(ctx, 166, 151, 3, 2, '#f0e8d8');
  P(ctx, 146, 153, 5, 4, '#f0e8d8'); P(ctx, 214, 132, 5, 4, '#f0e8d8');

  /* 夫（左・こちら側・背中越し）。作者指摘（8/9）：椅子を先に描いて「座り」に */
  {
    const x = 84, y = 138;
    P(ctx, x - 6, y + 36, 40, 6, '#6a3226');          // 椅子の座面（両脇が背中から覗く）
    P(ctx, x - 6, y + 36, 40, 2, '#8a4a34');
    P(ctx, x - 4, y + 42, 5, 15, '#4a2018');          // 椅子の脚
    P(ctx, x + 27, y + 42, 5, 15, '#4a2018');
    ctx.fillStyle = '#26324e';                        // 座る背中（大きめ・肩丸く・腰は座面まで）
    ctx.beginPath();
    ctx.moveTo(x, y + 40); ctx.lineTo(x + 1, y + 14);
    ctx.quadraticCurveTo(x + 2, y + 5, x + 11, y + 4);
    ctx.lineTo(x + 17, y + 4);
    ctx.quadraticCurveTo(x + 26, y + 5, x + 27, y + 14);
    ctx.lineTo(x + 28, y + 40); ctx.closePath(); ctx.fill();
    P(ctx, x + 2, y + 8, 2, 34, '#3c4a6a');           // ランタン側の縁光
    P(ctx, x + 24, y + 12, 6, 5, '#26324e');          // 右腕＝卓へ
    P(ctx, x + 29, y + 14, 5, 4, '#e8c39a');          // 茶碗を持つ手
    P(ctx, x + 32, y + 12, 6, 5, '#f0e8d8');          // 茶碗
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath(); ctx.arc(x + 14, y - 3, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1410';                        // 黒短髪（後頭部）
    ctx.beginPath(); ctx.arc(x + 14, y - 4, 8, Math.PI * .75, Math.PI * 2.4); ctx.fill();
    P(ctx, x + 7, y - 4, 14, 5, '#1a1410');
    P(ctx, x + 20, y - 2, 2, 2, '#2a2018');           // 妻を見る横目
  }
  /* 妻（右・向こう側・顔が見える・箸を上げた瞬間）。
     作者指摘（8/9）：椅子は卓の向こうで見えない＝描かない。腰は卓の縁に隠す */
  {
    const x = 250, y = 88;
    ctx.fillStyle = '#d87848';                        // 胴（正面）
    ctx.beginPath();
    ctx.moveTo(x, y + 34); ctx.lineTo(x + 1, y + 12);
    ctx.quadraticCurveTo(x + 2, y + 5, x + 9, y + 4);
    ctx.lineTo(x + 15, y + 4);
    ctx.quadraticCurveTo(x + 22, y + 5, x + 23, y + 12);
    ctx.lineTo(x + 24, y + 34); ctx.closePath(); ctx.fill();
    P(ctx, x + 2, y + 7, 2, 22, '#f09860');
    // 左腕＝卓に添える
    P(ctx, x - 4, y + 22, 8, 4, '#d87848'); P(ctx, x - 7, y + 24, 4, 3, '#e8c39a');
    // 右腕＝箸を上げる（ひじを曲げて口元へ）
    P(ctx, x + 20, y + 14, 5, 8, '#d87848');
    P(ctx, x + 21, y + 8, 4, 7, '#e8c39a');
    ctx.strokeStyle = '#e8d0a8'; ctx.lineWidth = 1;   // 箸2本
    ctx.beginPath(); ctx.moveTo(x + 23, y + 9); ctx.lineTo(x + 15, y - 1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 25, y + 8); ctx.lineTo(x + 17, y - 2); ctx.stroke();
    P(ctx, x + 14, y - 3, 4, 3, '#f0e8d8');           // 箸先の小籠包
    ctx.fillStyle = '#e8c39a';                        // 顔
    ctx.beginPath(); ctx.arc(x + 11, y - 4, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a5236';                        // 茶髪（前髪＋横）
    ctx.beginPath(); ctx.arc(x + 11, y - 6, 7, Math.PI * .85, Math.PI * 2.15); ctx.fill();
    P(ctx, x + 4, y - 8, 4, 7, '#7a5236'); P(ctx, x + 15, y - 8, 4, 6, '#7a5236');
    ctx.beginPath(); ctx.arc(x + 18, y - 10, 4, 0, Math.PI * 2); ctx.fill();  // 結んだおだんご
    P(ctx, x + 7, y - 4, 2, 2, '#2a2018'); P(ctx, x + 13, y - 4, 2, 2, '#2a2018');  // 目
    P(ctx, x + 9, y, 4, 2, '#c8604a');                // 開いた口＝あーん
    P(ctx, x + 5, y - 1, 2, 2, 'rgba(230,120,100,.6)');  // 頬
  }

  /* 奥の客席（にぎわいの影） */
  person(ctx, 22, 96, '#5a4a3e'); person(ctx, 40, 98, '#6a4a5a');
  P(ctx, 14, 104, 48, 8, '#8a2420');
  person(ctx, 330, 100, '#4a5a6a');
  P(ctx, 318, 108, 36, 7, '#8a2420');
}

/* ══════════════════════════════════════════════════════
   旧貿易地区 4/6 ── 裏路地（夜・換気扇の湯気と猫）
   幅と高さを崩した赤提灯の列。二人の後ろ姿が奥へ。
   ══════════════════════════════════════════════════════ */
function y_date_chuka4(ctx) {
  const t = T();
  const h = i => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;

  /* 夜空（路地の上に細く） */
  P(ctx, 0, 0, 360, 40, '#1c2030');
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(h(i) * 360), y = Math.floor(h(i + 40) * 34);
    P(ctx, x, y, 1, 1, h(i + 9) < .3 ? '#f8f4e8' : 'rgba(220,220,240,.5)');
  }

  /* 路地の両壁（奥へすぼむ台形） */
  // 左壁
  ctx.fillStyle = '#3a2f28';
  ctx.beginPath(); ctx.moveTo(0, 16); ctx.lineTo(148, 66); ctx.lineTo(148, 152); ctx.lineTo(0, 200); ctx.closePath(); ctx.fill();
  // 右壁
  ctx.fillStyle = '#453830';
  ctx.beginPath(); ctx.moveTo(360, 10); ctx.lineTo(212, 64); ctx.lineTo(212, 150); ctx.lineTo(360, 196); ctx.closePath(); ctx.fill();
  // 突き当たり（表通りの明かりが漏れる）
  P(ctx, 148, 66, 64, 86, '#241c18');
  P(ctx, 166, 96, 28, 56, '#f0c080');                 // 表の明かり
  P(ctx, 166, 96, 28, 3, '#f8e0b0');
  P(ctx, 176, 96, 3, 56, '#8a5038');                  // 柱の影
  // 壁の質感（レンガ風の散らし）
  for (let i = 0; i < 60; i++) {
    const u = h(i), v = h(i + 77);
    const lx = u * 140, ly = 20 + u * 46 + v * (128 - u * 40);
    P(ctx, Math.floor(lx), Math.floor(ly), 3, 2, 'rgba(90,68,56,.45)');
    const rx = 360 - u * 140, ry = 14 + u * 46 + v * (128 - u * 40);
    P(ctx, Math.floor(rx), Math.floor(ry), 3, 2, 'rgba(20,12,8,.4)');
  }

  /* 換気扇（左壁・回って湯気を吐く） */
  {
    const fx = 56, fy = 88;
    P(ctx, fx - 3, fy - 3, 26, 26, '#241c18');
    P(ctx, fx - 1, fy - 1, 22, 22, '#4a4a52');
    P(ctx, fx - 1, fy - 1, 22, 2, '#6a6a76');
    ctx.save();
    ctx.translate(fx + 10, fy + 10); ctx.rotate(t * 6);
    ctx.fillStyle = '#2a2a30';
    for (let b = 0; b < 4; b++) { ctx.rotate(Math.PI / 2); ctx.fillRect(-1, -9, 3, 9); }
    ctx.restore();
    P(ctx, fx + 9, fy + 9, 3, 3, '#8a8a96');
    wisp(ctx, fx + 22, fy + 6, 4, .55);                // 吐き出す湯気
    wisp(ctx, fx + 30, fy + 16, 3, .4);
    // 下に一斗缶とビールケース
    P(ctx, fx - 8, 148, 14, 16, '#6a6a76'); P(ctx, fx - 8, 148, 14, 2, '#9a9aa6');
    P(ctx, fx + 10, 154, 20, 12, '#8a6a30'); P(ctx, fx + 10, 154, 20, 2, '#b8963e');
  }
  /* 右壁の勝手口（明かりと暖簾） */
  P(ctx, 282, 92, 26, 52, '#241c18');
  P(ctx, 284, 94, 22, 48, '#f8d890');
  P(ctx, 284, 94, 22, 20, '#c83c30');                 // 半暖簾
  P(ctx, 284, 94, 22, 2, '#e85838');
  P(ctx, 291, 94, 2, 20, '#8a2420'); P(ctx, 298, 94, 2, 20, '#8a2420');
  person(ctx, 291, 132, '#8a4a3a');                   // 中の人影

  /* 赤提灯の列（両壁から突き出す・幅と高さを崩す） */
  const lan = (x, y, s, ph, tall) => {
    const sw = Math.sin(t * 1.6 + ph) * 1.4;
    ctx.fillStyle = 'rgba(255,150,70,.2)';
    ctx.beginPath(); ctx.arc(x + sw, y + s * .5, s * 1.6, 0, Math.PI * 2); ctx.fill();
    P(ctx, x - 1 + sw, y - 5, 2, 5, '#3a2820');
    ctx.fillStyle = '#e85838';
    ctx.beginPath(); ctx.ellipse(x + sw, y + s * .5, s * .55, s * (tall ? .8 : .55), 0, 0, Math.PI * 2); ctx.fill();
    P(ctx, x - s * .35 + sw, y + 1, s * .7, 2, '#ffb070');
    P(ctx, x - 2 + sw, y + s * (tall ? 1.3 : 1) + 1, 4, 2, '#d8a848');
  };
  // 左壁側（4つ・奥ほど小さく・高さバラバラ）
  lan(34, 44, 15, 0, true); lan(88, 62, 11, 1.2, false);
  lan(122, 60, 12, 2.6, true); lan(142, 74, 7, 3.5, false);
  // 右壁側（3つ・詰まったり離れたり）
  lan(322, 38, 14, .7, false); lan(288, 52, 9, 1.9, true); lan(228, 66, 8, 4.2, false);

  /* 石畳（奥へすぼむ・提灯の赤が落ちる） */
  ctx.fillStyle = '#4a4038';
  ctx.beginPath(); ctx.moveTo(0, 200); ctx.lineTo(148, 152); ctx.lineTo(212, 150); ctx.lineTo(360, 196); ctx.lineTo(360, 200); ctx.closePath(); ctx.fill();
  P(ctx, 148, 150, 64, 4, '#3a322a');
  ctx.strokeStyle = 'rgba(20,14,10,.5)'; ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const y = 158 + i * 10, sq = (200 - y) / 50;
    ctx.beginPath(); ctx.moveTo(148 - (148 * (1 - sq)) * -0 + (y - 152) * -2.9, y);
    ctx.moveTo(148 - (y - 152) * 3.0, y); ctx.lineTo(212 + (y - 150) * 3.0, y); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(232,88,56,.1)';
  ctx.beginPath(); ctx.ellipse(96, 176, 60, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(240,200,128,.12)';
  ctx.beginPath(); ctx.ellipse(292, 168, 40, 12, 0, 0, Math.PI * 2); ctx.fill();
  // 水たまり（夜紺を映す）
  ctx.fillStyle = '#28304a';
  ctx.beginPath(); ctx.ellipse(232, 184, 22, 5, 0, 0, Math.PI * 2); ctx.fill();
  P(ctx, 224, 182, 8, 1, 'rgba(232,88,56,.6)');

  /* 猫（尻尾がT()で揺れる・路地を横切る） */
  {
    const cx = 156, cy = 158;
    ctx.fillStyle = '#241c18';
    ctx.beginPath(); ctx.ellipse(cx, cy, 8, 4, 0, 0, Math.PI * 2); ctx.fill();  // 胴
    ctx.beginPath(); ctx.arc(cx + 8, cy - 3, 4, 0, Math.PI * 2); ctx.fill();    // 頭
    ctx.beginPath(); ctx.moveTo(cx + 5, cy - 6); ctx.lineTo(cx + 7, cy - 10); ctx.lineTo(cx + 9, cy - 6); ctx.fill();  // 耳
    ctx.beginPath(); ctx.moveTo(cx + 8, cy - 6); ctx.lineTo(cx + 10, cy - 10); ctx.lineTo(cx + 12, cy - 6); ctx.fill();
    P(ctx, cx - 5, cy + 3, 2, 4, '#241c18'); P(ctx, cx + 4, cy + 3, 2, 4, '#241c18');  // 脚
    ctx.strokeStyle = '#241c18'; ctx.lineWidth = 2;                              // 尻尾（ゆらり）
    const tw = Math.sin(t * 3) * 5;
    ctx.beginPath(); ctx.moveTo(cx - 7, cy - 1);
    ctx.quadraticCurveTo(cx - 14, cy - 8, cx - 13 + tw, cy - 15); ctx.stroke();
    P(ctx, cx + 10, cy - 4, 1, 1, '#f8d890');                                    // 光る目
  }

  /* 二人の後ろ姿（路地の奥へ・小さめ・寄り添う） */
  {
    const x = 168, y = 108;
    // 夫（紺）
    P(ctx, x + 1, y + 20, 4, 9, '#222838');
    P(ctx, x + 6, y + 20, 4, 8, '#222838');
    ctx.fillStyle = '#2c3a5e';
    ctx.beginPath();
    ctx.moveTo(x, y + 21); ctx.lineTo(x, y + 6);
    ctx.quadraticCurveTo(x, y + 2, x + 5, y + 1);
    ctx.quadraticCurveTo(x + 10, y + 2, x + 11, y + 6);
    ctx.lineTo(x + 11, y + 21); ctx.closePath(); ctx.fill();
    P(ctx, x + 1, y + 3, 1, 14, '#4a5a80');
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath(); ctx.arc(x + 5, y - 3, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1410';
    ctx.beginPath(); ctx.arc(x + 5, y - 4, 4, Math.PI * .8, Math.PI * 2.3); ctx.fill();
    P(ctx, x + 2, y - 3, 7, 3, '#1a1410');
    // 妻（暖色・夫の腕に寄る）
    const wx = x + 12, wy = y + 3;
    P(ctx, wx + 1, wy + 16, 4, 8, '#8a5a4a');
    P(ctx, wx + 5, wy + 16, 4, 7, '#8a5a4a');
    ctx.fillStyle = '#d87848';
    ctx.beginPath();
    ctx.moveTo(wx - 1, wy + 17); ctx.lineTo(wx, wy + 5);
    ctx.quadraticCurveTo(wx + 1, wy + 1, wx + 5, wy);
    ctx.quadraticCurveTo(wx + 9, wy + 1, wx + 10, wy + 5);
    ctx.lineTo(wx + 11, wy + 17); ctx.closePath(); ctx.fill();
    P(ctx, wx + 8, wy + 3, 1, 12, '#f09860');
    // つないだ手
    P(ctx, x + 10, y + 12, 3, 3, '#e8c39a');
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath(); ctx.arc(wx + 5, wy - 3, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a5236';
    ctx.beginPath(); ctx.arc(wx + 5, wy - 4, 3.5, Math.PI * .8, Math.PI * 2.3); ctx.fill();
    ctx.beginPath(); ctx.arc(wx + 8, wy - 7, 2, 0, Math.PI * 2); ctx.fill();  // おだんご
  }
}

/* ══════════════════════════════════════════════════════
   旧貿易地区 5/6 ── 土産物屋の棚（夜・パンダ柄を見せる）
   ぎっしりの棚・吊るし飾り。妻が手に取り夫に見せる。
   ══════════════════════════════════════════════════════ */
function y_date_chuka5(ctx) {
  const t = T();
  const h = i => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;

  /* 店内の壁（暖色の明かりに染まる生成り） */
  P(ctx, 0, 0, 360, 200, '#8a7a5e');
  ctx.fillStyle = 'rgba(255,220,150,.12)'; ctx.fillRect(0, 0, 360, 120);
  /* 天井の裸電球（2つ・明滅） */
  for (const [bx, ph] of [[110, 0], [268, 2.2]]) {
    const fl = .85 + .15 * Math.sin(t * 4 + ph);
    P(ctx, bx - 1, 0, 2, 8, '#3a2820');
    ctx.fillStyle = `rgba(255,220,140,${(0.3 * fl).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(bx, 12, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe8a8';
    ctx.beginPath(); ctx.arc(bx, 10, 4, 0, Math.PI * 2); ctx.fill();
  }

  /* 吊るし飾り（中国結び・扇・ぬいぐるみ／揺れる） */
  const knot = (x, y, ph) => {
    const sw = Math.sin(t * 1.7 + ph) * 2;
    P(ctx, x - 1, 0, 2, y, '#3a2820');
    P(ctx, x - 4 + sw, y, 8, 8, '#c83c30');
    P(ctx, x - 4 + sw, y, 8, 2, '#e85838');
    P(ctx, x - 2 + sw, y + 2, 4, 4, '#8a2420');
    P(ctx, x - 1 + sw, y + 8, 2, 7, '#d8a848');
    P(ctx, x - 3 + sw, y + 15, 6, 3, '#b8862e');
  };
  knot(36, 22, 0); knot(64, 34, 1.1); knot(206, 26, 2.3); knot(336, 30, 3.1);
  // 吊るしパンダ
  {
    const sw = Math.sin(t * 1.7 + 4) * 2;
    P(ctx, 155, 0, 2, 18, '#3a2820');
    P(ctx, 150 + sw, 18, 12, 10, '#f0ece0');
    P(ctx, 149 + sw, 16, 4, 4, '#241c18'); P(ctx, 159 + sw, 16, 4, 4, '#241c18');
    P(ctx, 152 + sw, 21, 3, 3, '#241c18'); P(ctx, 157 + sw, 21, 3, 3, '#241c18');
  }

  /* ── ぎっしりの棚（主役・左右2本・段の高さも崩す）── */
  const shelf = (sx, w, rows) => {
    P(ctx, sx - 4, 40, w + 8, 126, '#5a4438');
    P(ctx, sx - 4, 40, w + 8, 3, '#7a6050');
    let y = 52;
    for (let r = 0; r < rows.length; r++) {
      const rh = rows[r];
      P(ctx, sx - 4, y + rh, w + 8, 4, '#3a2820');    // 棚板
      P(ctx, sx - 4, y + rh, w + 8, 1, '#8a7058');
      // 品物をぎっしり（幅・高さ・色を散らしで変える）
      let x = sx;
      let i = sx * 3 + r * 71;
      while (x < sx + w - 5) {
        const iw = 6 + Math.floor(h(i) * 7);
        const ih = Math.min(rh - 3, 8 + Math.floor(h(i + 1) * (rh - 10)));
        const pick = h(i + 2);
        const col = pick < .28 ? '#c83c30' : pick < .5 ? '#d8a848' : pick < .68 ? '#4a8a78' : pick < .85 ? '#f0ece0' : '#8a5a6a';
        P(ctx, x, y + rh - ih, iw, ih, col);
        P(ctx, x, y + rh - ih, iw, 2, 'rgba(255,255,255,.35)');  // 縁光
        P(ctx, x, y + rh - 2, iw, 2, 'rgba(0,0,0,.25)');
        if (pick < .28 && ih > 9) P(ctx, x + 2, y + rh - ih + 4, iw - 4, 2, '#d8a848');  // 赤箱に金帯
        if (pick >= .68 && pick < .85 && iw > 8) {                // 白い品はパンダ壺
          P(ctx, x, y + rh - ih - 1, 2, 2, '#241c18'); P(ctx, x + iw - 2, y + rh - ih - 1, 2, 2, '#241c18');  // 耳
          P(ctx, x + 1, y + rh - ih + 3, 3, 3, '#241c18'); P(ctx, x + iw - 4, y + rh - ih + 3, 3, 3, '#241c18');
          P(ctx, x + Math.floor(iw / 2) - 1, y + rh - ih + 6, 2, 2, '#241c18');       // 鼻
        }
        x += iw + 1 + Math.floor(h(i + 3) * 3);
        i += 7;
      }
      y += rh + 4;
    }
  };
  shelf(18, 108, [24, 30, 26]);                        // 左棚（3段・段の高さ違い）
  shelf(238, 104, [28, 22, 30]);                       // 右棚
  /* S級審査（8/9）：右棚2段目の中央に白地のパンダ顔商品を3個まとめる＋朱赤の差し箱
     ＝「ここはパンダ土産の店だ」を一発で */
  for (let i = 0; i < 3; i++) {
    const bx = 270 + i * 13;
    P(ctx, bx, 94, 11, 12, '#f2ebd9');
    P(ctx, bx, 94, 11, 2, 'rgba(255,255,255,.5)');
    P(ctx, bx, 93, 2, 2, '#2b2b2b'); P(ctx, bx + 9, 93, 2, 2, '#2b2b2b');   // 耳
    P(ctx, bx + 2, 98, 3, 3, '#2b2b2b'); P(ctx, bx + 7, 98, 3, 3, '#2b2b2b'); // 目
    P(ctx, bx + 5, 102, 2, 2, '#2b2b2b');                                     // 鼻
  }
  P(ctx, 309, 96, 9, 10, '#c94b3d'); P(ctx, 309, 96, 9, 2, 'rgba(255,255,255,.35)');

  /* 中央の平台（お茶缶の山とパンダの箱） */
  P(ctx, 148, 128, 76, 38, '#6a5040');
  P(ctx, 148, 128, 76, 3, '#8a7058');
  for (let i = 0; i < 6; i++) {                        // 茶缶ピラミッド（色違い）
    const row = i < 3 ? 0 : 1, cIdx = i < 3 ? i : i - 3;
    if (row === 1 && cIdx > 1) continue;
    const x = 154 + cIdx * 13 + row * 7, y = 116 - row * 11;
    const col = h(i + 50) < .5 ? '#c83c30' : '#4a8a78';
    P(ctx, x, y, 11, 12, col);
    P(ctx, x, y, 11, 2, 'rgba(255,255,255,.4)');
    P(ctx, x + 2, y + 4, 7, 4, '#d8a848');
  }
  P(ctx, 196, 112, 22, 16, '#f0ece0');                 // パンダ菓子の箱
  P(ctx, 196, 112, 22, 2, '#fff');
  P(ctx, 196, 110, 3, 3, '#241c18'); P(ctx, 215, 110, 3, 3, '#241c18');   // 耳
  P(ctx, 200, 116, 3, 3, '#241c18'); P(ctx, 211, 116, 3, 3, '#241c18');
  P(ctx, 206, 120, 2, 2, '#241c18');
  P(ctx, 198, 124, 18, 3, '#c83c30');                  // 箱の帯

  /* 床 */
  P(ctx, 0, 166, 360, 34, '#4a3a2c');
  ctx.strokeStyle = 'rgba(20,12,8,.4)'; ctx.lineWidth = 1;
  for (let x = 8; x < 360; x += 26) { ctx.beginPath(); ctx.moveTo(x, 166); ctx.lineTo(x - 4, 200); ctx.stroke(); }

  /* 妻（パンダ柄のぬいぐるみを掲げて夫に見せる） */
  {
    const x = 128, y = 128;
    P(ctx, x + 2, y + 28, 6, 14, '#8a5a4a');
    P(ctx, x + 9, y + 28, 6, 13, '#8a5a4a');
    P(ctx, x + 1, y + 42, 8, 3, '#5a3a30'); P(ctx, x + 8, y + 41, 8, 3, '#5a3a30');
    ctx.fillStyle = '#d87848';                        // 胴（少し夫へひねる）
    ctx.beginPath();
    ctx.moveTo(x - 1, y + 30); ctx.lineTo(x + 1, y + 10);
    ctx.quadraticCurveTo(x + 2, y + 4, x + 8, y + 3);
    ctx.quadraticCurveTo(x + 14, y + 4, x + 15, y + 10);
    ctx.lineTo(x + 17, y + 30); ctx.closePath(); ctx.fill();
    P(ctx, x + 12, y + 6, 2, 20, '#f09860');
    // 両腕を右上へ＝掲げる
    P(ctx, x + 13, y + 8, 8, 4, '#d87848');
    P(ctx, x + 15, y + 4, 8, 4, '#d87848');
    P(ctx, x + 21, y + 2, 4, 4, '#e8c39a'); P(ctx, x + 20, y + 10, 4, 4, '#e8c39a');
    // パンダぬいぐるみ（掲げた先・ちょっと大きめ）
    const px = x + 24, py = y - 12;
    P(ctx, px, py + 8, 16, 13, '#f0ece0');            // 胴
    P(ctx, px, py + 8, 16, 2, '#fff');
    P(ctx, px - 2, py + 10, 5, 8, '#241c18'); P(ctx, px + 13, py + 10, 5, 8, '#241c18');  // 腕
    P(ctx, px + 2, py, 12, 10, '#f0ece0');            // 頭
    P(ctx, px + 1, py - 2, 4, 4, '#241c18'); P(ctx, px + 11, py - 2, 4, 4, '#241c18');    // 耳
    P(ctx, px + 3, py + 3, 4, 4, '#241c18'); P(ctx, px + 9, py + 3, 4, 4, '#241c18');     // 目まわり
    P(ctx, px + 4, py + 4, 1, 1, '#fff'); P(ctx, px + 10, py + 4, 1, 1, '#fff');
    P(ctx, px + 7, py + 7, 2, 2, '#241c18');
    ctx.fillStyle = '#e8c39a';                        // 顔（夫を見る・笑う）
    ctx.beginPath(); ctx.arc(x + 8, y - 3, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a5236';
    ctx.beginPath(); ctx.arc(x + 7, y - 5, 6, Math.PI * .85, Math.PI * 2.1); ctx.fill();
    P(ctx, x + 2, y - 7, 4, 6, '#7a5236');
    ctx.beginPath(); ctx.arc(x + 2, y - 8, 3, 0, Math.PI * 2); ctx.fill();  // おだんご（後ろ）
    P(ctx, x + 9, y - 2, 2, 2, '#2a2018'); P(ctx, x + 13, y - 2, 2, 2, '#2a2018');  // 夫向きの目
    P(ctx, x + 10, y, 4, 2, '#c8604a');               // 笑う口
  }
  /* 夫（腕を組んで苦笑い・妻の右） */
  {
    const x = 186, y = 120;
    P(ctx, x + 2, y + 32, 6, 15, '#2a3040');
    P(ctx, x + 10, y + 32, 6, 15, '#2a3040');
    P(ctx, x + 1, y + 47, 8, 3, '#3a2820'); P(ctx, x + 9, y + 47, 8, 3, '#3a2820');
    ctx.fillStyle = '#2c3a5e';
    ctx.beginPath();
    ctx.moveTo(x, y + 34); ctx.lineTo(x, y + 12);
    ctx.quadraticCurveTo(x, y + 6, x + 6, y + 5);
    ctx.lineTo(x + 12, y + 5);
    ctx.quadraticCurveTo(x + 18, y + 6, x + 18, y + 12);
    ctx.lineTo(x + 18, y + 34); ctx.closePath(); ctx.fill();
    P(ctx, x + 1, y + 7, 2, 24, '#4a5a80');
    P(ctx, x - 1, y + 15, 20, 5, '#26324e');          // 組んだ腕
    P(ctx, x + 1, y + 16, 5, 4, '#e8c39a'); P(ctx, x + 13, y + 16, 5, 4, '#e8c39a');
    ctx.fillStyle = '#e8c39a';                        // 顔（妻の方へ傾げる）
    ctx.beginPath(); ctx.arc(x + 8, y - 2, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1410';
    ctx.beginPath(); ctx.arc(x + 9, y - 4, 6, Math.PI * .9, Math.PI * 2.2); ctx.fill();
    P(ctx, x + 4, y - 5, 10, 4, '#1a1410');
    P(ctx, x + 4, y - 1, 2, 2, '#2a2018'); P(ctx, x + 9, y - 1, 2, 2, '#2a2018');  // 妻向きの目
    P(ctx, x + 5, y + 2, 3, 1, '#b08560');            // 苦笑いの口
  }

  /* レジの店主（奥・こちらを見ている） */
  P(ctx, 316, 148, 34, 18, '#5a4438');
  P(ctx, 316, 148, 34, 2, '#7a6050');
  person(ctx, 326, 144, '#8a4a3a');
  P(ctx, 320, 140, 10, 8, '#4a4a52');                 // レジ
}

/* ══════════════════════════════════════════════════════
   旧貿易地区 6/6 ── 夜更けの大門（ライトアップ・帰り道）
   1枚目と同じ門が金色に照る。月。二人はこちらへ歩く。
   ══════════════════════════════════════════════════════ */
function y_date_chuka6(ctx) {
  const t = T();
  const h = i => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;

  /* 夜紺の空と月 */
  const sky = ctx.createLinearGradient(0, 0, 0, 130);
  sky.addColorStop(0, '#12141f'); sky.addColorStop(1, '#1c2030');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 360, 130);
  for (let i = 0; i < 22; i++) {
    const x = Math.floor(h(i) * 360), y = Math.floor(h(i + 31) * 100);
    P(ctx, x, y, 1, 1, h(i + 8) < .25 ? '#f8f4e8' : 'rgba(200,204,230,.5)');
  }
  // 月（右上・欠けた月）
  ctx.fillStyle = '#f0e8c8';
  ctx.beginPath(); ctx.arc(300, 34, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#181a26';
  ctx.beginPath(); ctx.arc(295, 30, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(240,232,200,.1)';
  ctx.beginPath(); ctx.arc(300, 34, 20, 0, Math.PI * 2); ctx.fill();

  /* 両側の建物（夜・窓明かりはまばらに消えていく） */
  const bldg = (x, w, top) => {
    P(ctx, x, top, w, 130 - top, '#262230');
    P(ctx, x, top, w, 2, '#3a3648');
    for (let wy = top + 10; wy < 122; wy += 14) {
      for (let wx = x + 4; wx < x + w - 6; wx += 11) {
        const lit = h(wx * 7 + wy * 3) < .18;          // ほぼ消灯
        P(ctx, wx, wy, 6, 8, lit ? '#d8a848' : '#141220');
        if (lit) P(ctx, wx, wy, 6, 1, '#f8d890');
      }
    }
  };
  bldg(0, 62, 46); bldg(62, 40, 66); bldg(258, 46, 58); bldg(304, 56, 40);

  /* 大門（1枚目と同じ形・金色にライトアップ） */
  const GX = 180, GY = 58;
  // 下からの投光（ゆらがない金の光柱）
  ctx.fillStyle = 'rgba(216,168,72,.14)';
  ctx.beginPath(); ctx.moveTo(GX - 66, 130); ctx.lineTo(GX - 90, GY - 10); ctx.lineTo(GX + 90, GY - 10); ctx.lineTo(GX + 66, 130); ctx.closePath(); ctx.fill();
  const pil = (x) => {
    P(ctx, x, GY + 30, 10, 52, '#c85838');            // 照らされて明るい赤
    P(ctx, x + 1, GY + 30, 3, 52, '#f0a060');         // 光の当たる面
    P(ctx, x - 2, GY + 26, 14, 5, '#f8d890');
    P(ctx, x - 2, GY + 80, 14, 6, '#d8a848');
  };
  pil(GX - 52); pil(GX + 42);
  P(ctx, GX - 58, GY + 20, 116, 8, '#c85838');
  P(ctx, GX - 58, GY + 20, 116, 3, '#f0a060');
  P(ctx, GX - 20, GY + 21, 40, 12, '#241c10');
  ctx.font = '7px monospace'; ctx.textAlign = 'center';
  ctx.fillStyle = '#f8d890'; ctx.fillText('東光門', GX, GY + 30);
  ctx.textAlign = 'left';
  // 屋根（緑青が金に照る）
  ctx.fillStyle = '#5a9a84';
  ctx.beginPath();
  ctx.moveTo(GX - 74, GY + 20);
  ctx.quadraticCurveTo(GX - 30, GY + 2, GX, GY);
  ctx.quadraticCurveTo(GX + 30, GY + 2, GX + 74, GY + 20);
  ctx.quadraticCurveTo(GX + 52, GY + 14, GX, GY + 12);
  ctx.quadraticCurveTo(GX - 52, GY + 14, GX - 74, GY + 20);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8ac0a8';                          // 光の当たる棟
  ctx.beginPath();
  ctx.moveTo(GX - 40, GY + 8); ctx.quadraticCurveTo(GX, GY, GX + 40, GY + 8);
  ctx.lineTo(GX + 34, GY + 10); ctx.quadraticCurveTo(GX, GY + 3, GX - 34, GY + 10);
  ctx.closePath(); ctx.fill();
  P(ctx, GX - 3, GY - 6, 6, 7, '#f8d890');
  P(ctx, GX - 76, GY + 15, 4, 4, '#f8d890'); P(ctx, GX + 72, GY + 15, 4, 4, '#f8d890');
  // 投光器（門の足元・またたく）
  for (const lx of [GX - 62, GX + 56]) {
    P(ctx, lx, 126, 8, 4, '#3a3648');
    const fl = .7 + .3 * Math.sin(t * 6 + lx);
    ctx.fillStyle = `rgba(255,220,140,${(0.5 * fl).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(lx + 4, 126, 5, 0, Math.PI * 2); ctx.fill();
  }

  /* 石畳（夜・門の金が落ちる） */
  P(ctx, 0, 130, 360, 70, '#3c3830');
  ctx.strokeStyle = 'rgba(14,10,8,.5)'; ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const y = 134 + i * i * 2.4;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(120, 200); ctx.lineTo(GX - 44, 130); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(252, 200); ctx.lineTo(GX + 42, 130); ctx.stroke();
  ctx.fillStyle = 'rgba(216,168,72,.12)';
  ctx.beginPath(); ctx.ellipse(GX, 142, 86, 12, 0, 0, Math.PI * 2); ctx.fill();

  /* 提灯（消えかけ・数個だけ灯る） */
  ctx.strokeStyle = 'rgba(30,26,22,.9)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 62); ctx.quadraticCurveTo(180, 78, 360, 58); ctx.stroke();
  const xs1 = [22, 58, 104, 138, 196, 226, 284, 330];
  for (let i = 0; i < xs1.length; i++) {
    const x = xs1[i], yy = 62 + 16 * Math.sin((x / 360) * Math.PI) + 2;
    const s = 9 + Math.floor(h(i) * 4);
    const on = h(i + 13) < .3;                         // ほとんど消灯
    const sw = Math.sin(t * 1.8 + i * 1.7) * 1.6;
    if (on) {
      ctx.fillStyle = 'rgba(255,170,80,.2)';
      ctx.beginPath(); ctx.arc(x + sw + s / 2, yy + s * .6, s, 0, Math.PI * 2); ctx.fill();
    }
    P(ctx, x + sw + s / 2 - 1, yy - 3, 2, 3, '#241c18');
    P(ctx, x + sw, yy, s, s + 2, on ? '#e85838' : '#6e2822');
    if (on) P(ctx, x + sw + 1, yy + 1, s - 2, 2, '#ffb070');
    P(ctx, x + sw + s / 2 - 2, yy + s + 2, 4, 2, on ? '#d8a848' : '#5a4a28');
  }

  /* まばらな人（帰る人ばかり・遠く） */
  person(ctx, 236, 122, '#3c4450');
  person(ctx, 130, 126, '#443c48');
  // 店じまいの主人（シャッターを下ろす）
  P(ctx, 300, 96, 40, 34, '#38343e');
  for (let i = 0; i < 5; i++) P(ctx, 300, 98 + i * 6, 40, 1, 'rgba(120,116,130,.4)');
  person(ctx, 316, 138, '#5a4a3e');

  /* S級審査（8/9）：二人の足元から手前へ斜めの長い影2本＝「歩き出した帰り道」 */
  ctx.fillStyle = 'rgba(75,80,103,.45)';                   /* #4B5067 */
  ctx.beginPath(); ctx.moveTo(150, 194); ctx.lineTo(163, 194); ctx.lineTo(146, 200); ctx.lineTo(128, 200); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(172, 195); ctx.lineTo(184, 195); ctx.lineTo(170, 200); ctx.lineTo(152, 200); ctx.closePath(); ctx.fill();

  /* 帰り道の二人（手前・こちら向きに歩く） */
  // 夫（左・歩みの途中＝片膝が前）
  {
    const x = 148, y = 148, step = Math.sin(t * 4);
    P(ctx, x + 2, y + 30, 6, 15 + step * 2, '#222838');           // 前後の脚
    P(ctx, x + 10, y + 31, 6, 14 - step * 2, '#222838');
    P(ctx, x + 1, y + 45 + step * 2, 8, 3, '#3a2820');
    P(ctx, x + 9, y + 45 - step * 2, 8, 3, '#3a2820');
    ctx.fillStyle = '#2c3a5e';
    ctx.beginPath();
    ctx.moveTo(x, y + 32); ctx.lineTo(x, y + 12);
    ctx.quadraticCurveTo(x, y + 6, x + 6, y + 5);
    ctx.lineTo(x + 12, y + 5);
    ctx.quadraticCurveTo(x + 18, y + 6, x + 18, y + 12);
    ctx.lineTo(x + 18, y + 32); ctx.closePath(); ctx.fill();
    P(ctx, x + 15, y + 7, 2, 24, '#4a5a80');          // 門の金が当たる側
    P(ctx, x - 3, y + 10, 5, 14, '#2c3a5e');          // 左腕（振る）
    P(ctx, x - 3, y + 24, 5, 4, '#e8c39a');
    ctx.fillStyle = '#e8c39a';                        // 顔（正面・満足げ）
    ctx.beginPath(); ctx.arc(x + 9, y - 2, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1410';
    ctx.beginPath(); ctx.arc(x + 9, y - 4, 7, Math.PI * .95, Math.PI * 2.05); ctx.fill();
    P(ctx, x + 3, y - 6, 12, 4, '#1a1410');
    P(ctx, x + 5, y - 2, 2, 2, '#2a2018'); P(ctx, x + 11, y - 2, 2, 2, '#2a2018');
    P(ctx, x + 7, y + 2, 4, 1, '#b08560');            // 目を細めた笑み
  }
  // 妻（右・紙袋を提げる・夫と腕を組む）
  {
    const x = 176, y = 152, step = Math.sin(t * 4 + Math.PI);
    P(ctx, x + 2, y + 26, 5, 14 + step * 1.5, '#8a5a4a');
    P(ctx, x + 9, y + 26, 5, 13 - step * 1.5, '#8a5a4a');
    P(ctx, x + 1, y + 40 + step * 1.5, 7, 3, '#5a3a30');
    P(ctx, x + 8, y + 39 - step * 1.5, 7, 3, '#5a3a30');
    ctx.fillStyle = '#d87848';
    ctx.beginPath();
    ctx.moveTo(x - 1, y + 28); ctx.lineTo(x + 1, y + 10);
    ctx.quadraticCurveTo(x + 2, y + 4, x + 8, y + 3);
    ctx.quadraticCurveTo(x + 14, y + 4, x + 15, y + 10);
    ctx.lineTo(x + 17, y + 28); ctx.closePath(); ctx.fill();
    P(ctx, x + 2, y + 6, 2, 20, '#f09860');
    // 左腕＝夫の腕に絡める
    P(ctx, x - 4, y + 10, 6, 4, '#d87848');
    P(ctx, x - 7, y + 12, 4, 3, '#e8c39a');
    // 右腕＝紙袋（歩みで揺れる）
    P(ctx, x + 13, y + 10, 4, 12, '#d87848');
    P(ctx, x + 14, y + 22, 4, 3, '#e8c39a');
    const bs = Math.sin(t * 4 + .6) * 1.5;
    P(ctx, x + 12 + bs, y + 26, 14, 15, '#e8d0a8');   // 紙袋
    P(ctx, x + 12 + bs, y + 26, 14, 2, '#f8ecd0');
    P(ctx, x + 16 + bs, y + 24, 6, 3, '#b89868');     // 持ち手
    P(ctx, x + 15 + bs, y + 31, 8, 6, '#241c18');     // 袋のパンダ
    P(ctx, x + 15 + bs, y + 31, 8, 3, '#f0ece0');
    ctx.fillStyle = '#e8c39a';                        // 顔（夫を見上げて笑う）
    ctx.beginPath(); ctx.arc(x + 7, y - 3, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a5236';
    ctx.beginPath(); ctx.arc(x + 6, y - 5, 6, Math.PI * .9, Math.PI * 2.1); ctx.fill();
    P(ctx, x + 1, y - 6, 4, 6, '#7a5236'); P(ctx, x + 11, y - 7, 4, 5, '#7a5236');
    ctx.beginPath(); ctx.arc(x + 12, y - 9, 3, 0, Math.PI * 2); ctx.fill();  // おだんご
    P(ctx, x + 4, y - 3, 2, 2, '#2a2018'); P(ctx, x + 9, y - 3, 2, 2, '#2a2018');
    P(ctx, x + 6, y + 1, 3, 2, '#c8604a');            // 笑う口
    P(ctx, x + 2, y - 1, 2, 1, 'rgba(230,120,100,.6)');
  }
}

/* ══════════════════════════════════════════════════════
   外気ベイ ── 観覧車の下（デート・夜）
   ------------------------------------------------------------
   プロムナードから観覧車を大きく見上げる。観覧車はT()で
   ゆっくり回転、ネオンは周期で色替わり。乗り場には長い列
   （三十分並んだ）。夫婦は列のいちばん後ろ。
   ══════════════════════════════════════════════════════ */
function y_date_minato1(ctx) {
  const t = T();
  const h = i => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
  const NEON = ['#e8a040', '#e06888', '#58b8d8'];

  /* 夜空（見上げているので空が広い） */
  const sky = ctx.createLinearGradient(0, 0, 0, 200);
  sky.addColorStop(0, '#0a1020'); sky.addColorStop(0.7, '#101828'); sky.addColorStop(1, '#182238');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 360, 200);
  for (let i = 0; i < 46; i++) {
    const sx = Math.floor(h(i) * 356) + 2, sy = Math.floor(h(i + 99) * 110) + 2;
    const tw = 0.55 + 0.45 * Math.sin(t * 2.2 + i * 1.7);
    ctx.fillStyle = `rgba(230,238,255,${(0.14 + 0.5 * h(i + 7) * tw).toFixed(3)})`;
    ctx.fillRect(sx, sy, 1, 1);
  }

  /* 奥のビルのシルエット（低く、脇役として） */
  const blds = [[0, 34, 52], [30, 26, 40], [286, 30, 58], [312, 48, 44]];
  for (let b = 0; b < blds.length; b++) {
    const bx = blds[b][0], bw = blds[b][1], bh = blds[b][2];
    P(ctx, bx, 168 - bh, bw, bh, '#0a0e18');
    for (let wy = 0; wy < Math.floor(bh / 8); wy++) for (let wx = 0; wx < Math.floor(bw / 8); wx++) {
      if (h(b * 91 + wy * 13 + wx * 7) < 0.26)
        P(ctx, bx + 3 + wx * 8, 172 - bh + wy * 8, 3, 4, '#d8c878');
    }
  }

  /* ── 観覧車（主役・画面いっぱいに見上げる）── */
  const cx = 192, cy = 64, R = 82, rot = t * 0.16;
  // 支柱（A脚）
  ctx.fillStyle = '#141c30';
  ctx.beginPath(); ctx.moveTo(cx - 5, cy); ctx.lineTo(cx - 40, 180); ctx.lineTo(cx - 30, 180); ctx.lineTo(cx + 1, cy + 4); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + 40, 180); ctx.lineTo(cx + 30, 180); ctx.lineTo(cx - 1, cy + 4); ctx.closePath(); ctx.fill();
  P(ctx, cx - 36, 96, 3, 2, '#26324e'); P(ctx, cx + 33, 96, 3, 2, '#26324e');  // 脚のボルト光
  // スポーク（回転）
  ctx.strokeStyle = '#26324e'; ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const a = rot + i * Math.PI / 6;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * (R - 5), cy + Math.sin(a) * (R - 5)); ctx.stroke();
  }
  // リム二重
  ctx.strokeStyle = '#1e2a44'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, R - 7, 0, Math.PI * 2); ctx.stroke();
  // リムのネオン（色が周期で流れ替わる）
  for (let i = 0; i < 54; i++) {
    const a = rot + i * Math.PI * 2 / 54;
    const ci = (Math.floor(i / 6) + Math.floor(t * 0.8)) % 3;
    const px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R;
    P(ctx, Math.round(px) - 1, Math.round(py) - 1, 2, 2, NEON[ci]);
  }
  // ハブの光
  ctx.fillStyle = `rgba(232,160,64,${(0.16 + 0.08 * Math.sin(t * 3)).toFixed(2)})`;
  ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.fill();
  P(ctx, cx - 4, cy - 4, 8, 8, '#e8a040'); P(ctx, cx - 2, cy - 2, 4, 4, '#f5e0b8');
  // ゴンドラ（吊り下げ・等間隔を崩す：大きさと灯りを散らす）
  for (let i = 0; i < 12; i++) {
    const a = rot + i * Math.PI / 6;
    const gx = cx + Math.cos(a) * (R - 3), gy = cy + Math.sin(a) * (R - 3);
    const sw = Math.sin(t * 1.6 + i * 2.1) * 1.2;                 // わずかに揺れる
    const gw = 7 + Math.round(h(i + 31) * 2), gh = 8;
    const bx = Math.round(gx - gw / 2 + sw), by = Math.round(gy + 3);
    ctx.strokeStyle = '#1e2a44'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(bx + gw / 2, by); ctx.stroke();
    P(ctx, bx, by, gw, gh, NEON[i % 3]);
    P(ctx, bx, by + gh - 2, gw, 2, '#141c30');
    if (h(i + 77) < 0.6) P(ctx, bx + 2, by + 2, gw - 4, 3, '#f5e6c0');   // 灯りは一部だけ
  }

  /* ── プロムナードの地面 ── */
  P(ctx, 0, 168, 360, 32, '#1a2030');
  ctx.strokeStyle = 'rgba(90,110,150,.2)'; ctx.lineWidth = 1;
  for (let x = 0; x < 360; x += 24) { ctx.beginPath(); ctx.moveTo(x, 168); ctx.lineTo(x - 10, 200); ctx.stroke(); }
  P(ctx, 0, 168, 360, 2, '#26324e');
  // 街灯ふたつ（玉の光）
  for (const lx of [22, 332]) {
    P(ctx, lx, 138, 2, 30, '#141c30');
    ctx.fillStyle = `rgba(232,216,168,${(0.2 + 0.06 * Math.sin(t * 4 + lx)).toFixed(2)})`;
    ctx.beginPath(); ctx.arc(lx + 1, 135, 7, 0, Math.PI * 2); ctx.fill();
    P(ctx, lx - 1, 133, 4, 4, '#e8d8a8');
  }

  /* ── 乗り場（白い看板と暖かい灯り）── */
  P(ctx, 152, 140, 80, 30, '#141c30');
  P(ctx, 154, 146, 76, 24, '#1e2a44');
  P(ctx, 150, 136, 84, 5, '#26324e');
  P(ctx, 168, 128, 48, 9, '#f2f4f6');                                  // 白い看板
  ctx.font = '7px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = '#2a3450'; ctx.fillText('のりば', 192, 135); ctx.textAlign = 'left';
  P(ctx, 176, 150, 32, 20, '#3a3020');                                 // 入口の暖光
  P(ctx, 178, 152, 28, 18, 'rgba(245,224,168,.8)');
  ctx.fillStyle = 'rgba(245,224,168,.12)';
  ctx.beginPath(); ctx.moveTo(178, 170); ctx.lineTo(206, 170); ctx.lineTo(216, 186); ctx.lineTo(168, 186); ctx.closePath(); ctx.fill();
  // 係員（乗り場の前で手を挙げて案内）
  P(ctx, 214, 158, 5, 9, '#3a5a6a'); P(ctx, 213, 165, 2, 4, '#3a5a6a'); P(ctx, 218, 165, 2, 4, '#2e4a58');
  ctx.fillStyle = '#e8c39a'; ctx.beginPath(); ctx.arc(216.5, 155, 2.5, 0, Math.PI * 2); ctx.fill();
  P(ctx, 214, 152, 5, 2, '#3b2d24');
  P(ctx, 219, 156, 4, 2, '#3a5a6a'); P(ctx, 222, 152, 2, 4, '#e8c39a');  // 挙げた腕

  /* ── 順番待ちの長い列（三十分並んだ＝画面の左端まで）── */
  // ロープ柵
  for (let x = 32; x <= 172; x += 28) {
    P(ctx, x, 172, 2, 8, '#3a4458');
    if (x > 32) { ctx.strokeStyle = 'rgba(200,170,90,.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - 26, 174); ctx.quadraticCurveTo(x - 13, 178, x + 1, 174); ctx.stroke(); }
  }
  // 並ぶ人々（肩は丸く・姿勢を1人ずつ散らす）
  const q = [
    [166, '#5a6b8a', 0], [152, '#6a5a4a', 1], [139, '#7a4a5a', 2], [125, '#4a6a5a', 0],
    [112, '#8a6a4a', 3], [99, '#5a5a7a', 1], [86, '#6a4a3a', 2], [72, '#4a5a6e', 4],
    [59, '#7a5a6a', 1], [46, '#5a6a4a', 0]
  ];
  for (let i = 0; i < q.length; i++) {
    const px = q[i][0], col = q[i][1], pose = q[i][2];
    const bob = Math.round(Math.sin(t * 1.8 + i * 2.3) * 0.6);
    const py = 158 + bob;
    ctx.fillStyle = col;
    if (pose === 3) {                                    // しゃがんで子どもと話す
      ctx.beginPath(); ctx.arc(px + 2.5, py + 6, 3, Math.PI, 0); ctx.fill();
      P(ctx, px, py + 6, 5, 6, col); P(ctx, px, py + 12, 6, 3, col);
      ctx.fillStyle = '#e8c39a'; ctx.beginPath(); ctx.arc(px + 2.5, py + 3, 2.3, 0, Math.PI * 2); ctx.fill();
      P(ctx, px, py, 5, 2, '#3b2d24');
      P(ctx, px - 5, py + 8, 4, 5, '#c8788a');           // 子ども
      ctx.fillStyle = '#e8c39a'; ctx.beginPath(); ctx.arc(px - 3, py + 6, 2, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(px + 2.5, py + 1, 3, Math.PI, 0); ctx.fill();   // 丸い肩
      P(ctx, px, py + 1, 5, 7, col);
      ctx.fillStyle = '#e8c39a'; ctx.beginPath(); ctx.arc(px + 2.5, py - 2.5, 2.3, 0, Math.PI * 2); ctx.fill();
      P(ctx, px, py - 5, 5, 2, '#3b2d24');
      if (pose === 1) {                                  // スマホをのぞく（うつむき）
        P(ctx, px + 4, py + 3, 3, 2, col); P(ctx, px + 6, py + 2, 2, 3, '#9fd4e8');
      } else if (pose === 2) {                            // 腕組み
        P(ctx, px - 1, py + 3, 7, 2, col);
      } else if (pose === 4) {                            // 観覧車を見上げて指さす
        P(ctx, px + 4, py, 4, 2, col); P(ctx, px + 7, py - 2, 2, 2, '#e8c39a');
      }
      P(ctx, px, py + 8, 2, 5, col); P(ctx, px + 3, py + 8 + (i % 2), 2, 5 - (i % 2), col);  // 膝を折る片脚
    }
  }

  /* ── 夫婦（列のいちばん後ろ・左端）── */
  const hx = 24, hy = 156;
  // 夫：30代・黒短髪・紺シャツ
  ctx.fillStyle = '#3a4a6e';
  ctx.beginPath(); ctx.arc(hx + 3, hy + 1, 3.2, Math.PI, 0); ctx.fill();
  P(ctx, hx, hy + 1, 6, 8, '#3a4a6e');
  ctx.fillStyle = '#e8c39a'; ctx.beginPath(); ctx.arc(hx + 3, hy - 2.5, 2.5, 0, Math.PI * 2); ctx.fill();
  P(ctx, hx, hy - 5.5, 6, 2.4, '#181410');
  P(ctx, hx + 5, hy + 1, 3, 2, '#3a4a6e'); P(ctx, hx + 7, hy - 3, 2, 4, '#e8c39a');   // 観覧車を見上げ指さす
  P(ctx, hx, hy + 9, 2, 5, '#2a3448'); P(ctx, hx + 4, hy + 9, 2, 5, '#2a3448');
  // 妻：茶髪を後ろで結ぶ・暖色の服（夫の腕にそっと寄る）
  const wx = hx + 10, wy = hy + 1;
  ctx.fillStyle = '#d88848';
  ctx.beginPath(); ctx.arc(wx + 2.5, wy + 1, 3, Math.PI, 0); ctx.fill();
  P(ctx, wx, wy + 1, 5, 7, '#d88848');
  ctx.fillStyle = '#f0cda6'; ctx.beginPath(); ctx.arc(wx + 2.5, wy - 2.5, 2.3, 0, Math.PI * 2); ctx.fill();
  P(ctx, wx, wy - 5, 5, 2, '#6b4226'); P(ctx, wx + 4, wy - 3.5, 2, 4, '#6b4226');     // 結んだ髪
  P(ctx, wx - 2, wy + 2, 3, 2, '#d88848');                                            // 夫の腕に手
  P(ctx, wx, wy + 8, 2, 5, '#a05a30'); P(ctx, wx + 3, wy + 9, 2, 4, '#a05a30');       // 片膝ゆるく
  // ふたりの足元の淡い影
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(hx + 9, 171, 12, 2, 0, 0, Math.PI * 2); ctx.fill();
}


/* ══════════════════════════════════════════════════════
   外気ベイ ── ゴンドラの中から（デート・夜）
   ------------------------------------------------------------
   窓越しに夜の街を見下ろす。手前は窓枠とシートの二人の
   シルエット。妻が窓の外＝熱波銀座のほうを指さす。
   眼下は灯りの海、遠くにひとつだけ強い灯り（自分の店）。
   湾には月の反射。
   ══════════════════════════════════════════════════════ */
function y_date_minato2(ctx) {
  const t = T();
  const h = i => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;

  /* 窓の外＝空と湾（上）→街の灯りの海（下） */
  const sky = ctx.createLinearGradient(0, 0, 0, 78);
  sky.addColorStop(0, '#0a1020'); sky.addColorStop(1, '#101828');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 360, 78);
  for (let i = 0; i < 30; i++) {
    const sx = Math.floor(h(i) * 356) + 2, sy = Math.floor(h(i + 55) * 34) + 2;
    ctx.fillStyle = `rgba(230,238,255,${(0.15 + 0.4 * h(i + 9)).toFixed(2)})`;
    ctx.fillRect(sx, sy, 1, 1);
  }
  // 月
  ctx.fillStyle = '#f2ecd8'; ctx.beginPath(); ctx.arc(66, 22, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#101828'; ctx.beginPath(); ctx.arc(70, 19, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(242,236,216,.1)'; ctx.beginPath(); ctx.arc(66, 22, 13, 0, Math.PI * 2); ctx.fill();
  // 湾（左上に広がる）と対岸の影
  ctx.fillStyle = '#1a2a48';
  ctx.beginPath(); ctx.moveTo(0, 40); ctx.lineTo(150, 44); ctx.lineTo(96, 78); ctx.lineTo(0, 84); ctx.closePath(); ctx.fill();
  P(ctx, 0, 38, 128, 3, '#0a0e18');
  // 月の反射（縦に伸びて揺れる）
  for (let k = 0; k < 9; k++) {
    const ry = 44 + k * 4;
    const rx = 64 + Math.sin(t * 2 + k * 1.1) * (1 + k * 0.3);
    ctx.fillStyle = `rgba(242,236,216,${(0.5 - k * 0.05).toFixed(2)})`;
    ctx.fillRect(Math.round(rx), ry, 3 + (k % 2), 2);
  }
  ripple(ctx, 24, 56, 70, 'rgba(180,200,230,.25)');

  /* 眼下の街＝灯りの海（ブロックの影＋擬似ハッシュの窓） */
  P(ctx, 0, 78, 360, 96, '#0e1424');
  ctx.fillStyle = 'rgba(20,28,48,.9)';
  for (let r = 0; r < 5; r++) {
    const ry = 80 + r * 19, bh2 = 15 + r * 3;
    for (let c = 0; c < 9; c++) {
      const bx = c * 42 + Math.floor(h(r * 17 + c) * 14) - 4;
      const bw = 22 + Math.floor(h(r * 31 + c + 5) * 16);
      P(ctx, bx, ry, bw, bh2, r % 2 ? '#0a0e18' : '#101a30');
    }
  }
  // 街灯りの粒（遠いほど細かい・T()でまたたく）
  for (let i = 0; i < 170; i++) {
    const lx = Math.floor(h(i * 3 + 1) * 356) + 2;
    const ly = 80 + Math.floor(h(i * 7 + 2) * 90);
    const near = (ly - 80) / 90;
    const tw = 0.6 + 0.4 * Math.sin(t * 2.4 + i * 2.9);
    const warm = h(i + 13) < 0.75;
    ctx.fillStyle = warm
      ? `rgba(232,216,168,${(0.25 + 0.55 * near * tw).toFixed(3)})`
      : `rgba(88,184,216,${(0.2 + 0.4 * near * tw).toFixed(3)})`;
    ctx.fillRect(lx, ly, near > 0.55 ? 2 : 1, near > 0.55 ? 2 : 1);
  }
  // 道路の光の筋（遠景にだけ・点線で淡く）
  ctx.fillStyle = 'rgba(232,216,168,.2)';
  for (let k = 0; k < 12; k++) P(ctx, 46 + k * 11, 96 - Math.floor(k * 0.6), 4, 1, 'rgba(232,216,168,.2)');
  for (let k = 0; k < 9; k++) P(ctx, 236 + k * 12, 88 + Math.floor(k * 0.4), 4, 1, 'rgba(232,216,168,.16)');

  /* 遠くにひとつだけ強い灯り＝自分の店（熱波銀座の方角） */
  const gx = 296, gy = 62;
  ctx.fillStyle = `rgba(255,180,80,${(0.16 + 0.1 * Math.sin(t * 3)).toFixed(2)})`;
  ctx.beginPath(); ctx.arc(gx, gy, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(255,180,80,${(0.3 + 0.12 * Math.sin(t * 3)).toFixed(2)})`;
  ctx.beginPath(); ctx.arc(gx, gy, 6, 0, Math.PI * 2); ctx.fill();
  P(ctx, gx - 2, gy - 2, 4, 4, '#ffc860'); P(ctx, gx - 1, gy - 1, 2, 2, '#fff2d0');
  P(ctx, gx - 1, gy - 6, 2, 3, 'rgba(255,200,120,.5)');    // 上へ立つ細い光

  /* ── 手前：ゴンドラの窓枠とシートの二人 ── */
  // 窓ガラスのうっすら反射
  ctx.fillStyle = 'rgba(160,200,230,.05)';
  ctx.beginPath(); ctx.moveTo(60, 10); ctx.lineTo(130, 10); ctx.lineTo(40, 150); ctx.lineTo(10, 150); ctx.closePath(); ctx.fill();
  // 枠（上・左・右は湾曲したゴンドラの殻）
  P(ctx, 0, 0, 360, 12, '#0a0e18'); P(ctx, 0, 12, 360, 2, '#26324e');
  P(ctx, 0, 0, 14, 200, '#0a0e18'); P(ctx, 14, 0, 2, 200, '#26324e');
  P(ctx, 346, 0, 14, 200, '#0a0e18'); P(ctx, 344, 0, 2, 200, '#26324e');
  P(ctx, 172, 0, 6, 152, '#0a0e18'); P(ctx, 178, 0, 1, 152, '#1e2a44');   // 中桟
  // 窓下の白い注意プレート
  P(ctx, 300, 130, 34, 12, '#eef0f2');
  P(ctx, 303, 133, 28, 2, '#8a94a4'); P(ctx, 303, 137, 20, 2, '#8a94a4');
  // シート（窓下の縁と座面）
  P(ctx, 0, 148, 360, 8, '#141c30'); P(ctx, 0, 148, 360, 2, '#2e3a58');
  P(ctx, 0, 156, 360, 44, '#1a2234');
  P(ctx, 8, 158, 344, 6, '#232e48');
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1;
  for (let x = 60; x < 340; x += 70) { ctx.beginPath(); ctx.moveTo(x, 158); ctx.lineTo(x, 196); ctx.stroke(); }

  /* 二人のシルエット（逆光・輪郭だけ淡く光る） */
  const bob = Math.sin(t * 1.4) * 0.8;                      // ゴンドラの微揺れ
  // 夫（左）：座って街を見る。肩は丸く、頭は小さく
  ctx.fillStyle = '#0a0e18';
  ctx.beginPath(); ctx.arc(120, 118 + bob, 9, 0, Math.PI * 2); ctx.fill();          // 頭
  ctx.beginPath(); ctx.moveTo(96, 200); ctx.lineTo(96, 140 + bob);
  ctx.quadraticCurveTo(98, 126 + bob, 120, 126 + bob);
  ctx.quadraticCurveTo(142, 126 + bob, 144, 142 + bob); ctx.lineTo(146, 200); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(120,150,190,.4)'; ctx.lineWidth = 1;                       // 1pxの縁光
  ctx.beginPath(); ctx.arc(120, 118 + bob, 9, -Math.PI * 0.85, -Math.PI * 0.15); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(98, 138 + bob); ctx.quadraticCurveTo(100, 127 + bob, 118, 127 + bob); ctx.stroke();
  // 妻（右）：身を乗り出し、窓の外＝店の灯りを指さす
  const lean = bob * 0.6;
  ctx.fillStyle = '#0a0e18';
  ctx.beginPath(); ctx.arc(216, 108 + lean, 8, 0, Math.PI * 2); ctx.fill();          // 頭（少し前へ）
  P(ctx, 219, 98 + lean, 8, 6, '#0a0e18');                                           // 結んだ髪のふくらみ
  ctx.beginPath(); ctx.moveTo(196, 200); ctx.lineTo(198, 134 + lean);
  ctx.quadraticCurveTo(202, 116 + lean, 218, 118 + lean);
  ctx.quadraticCurveTo(234, 120 + lean, 236, 140 + lean); ctx.lineTo(238, 200); ctx.closePath(); ctx.fill();
  // 指さす腕（店の灯りへ向けて・二の腕は太く、指先は細く）
  ctx.strokeStyle = '#0a0e18'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(222, 126 + lean); ctx.lineTo(248, 100 + lean); ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(248, 100 + lean); ctx.lineTo(262, 87 + lean); ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.strokeStyle = 'rgba(255,190,110,.45)'; ctx.lineWidth = 1;                      // 前腕の上辺にだけ照り返し
  ctx.beginPath(); ctx.moveTo(247, 97 + lean); ctx.lineTo(262, 83 + lean); ctx.stroke();
  ctx.beginPath(); ctx.arc(216, 108 + lean, 8, -Math.PI * 0.7, 0); ctx.stroke();     // 髪の縁光（暖色）
}


/* ══════════════════════════════════════════════════════
   外気ベイ ── 湾越しの全景（第2章冒頭・夜・人物なし）
   ------------------------------------------------------------
   対岸から見たスカイライン。観覧車（回転・ネオン色替わり）
   ＋高さを崩した高層ビル群（窓は一部点灯）＋帆の形のホテル。
   手前は暗い海、灯りが水面に縦へ伸びて揺れる。
   ══════════════════════════════════════════════════════ */
function y_intro_minato(ctx) {
  const t = T();
  const h = i => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
  const NEON = ['#e8a040', '#e06888', '#58b8d8'];
  const SEA = 130;

  /* 夜空 */
  const sky = ctx.createLinearGradient(0, 0, 0, SEA);
  sky.addColorStop(0, '#0a1020'); sky.addColorStop(0.75, '#101828'); sky.addColorStop(1, '#1a2440');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 360, SEA);
  for (let i = 0; i < 52; i++) {
    const sx = Math.floor(h(i) * 356) + 2, sy = Math.floor(h(i + 99) * 62) + 2;
    const tw = 0.55 + 0.45 * Math.sin(t * 2 + i * 1.3);
    ctx.fillStyle = `rgba(230,238,255,${(0.12 + 0.5 * h(i + 7) * tw).toFixed(3)})`;
    ctx.fillRect(sx, sy, 1, 1);
  }
  // 細い月
  ctx.fillStyle = '#f2ecd8'; ctx.beginPath(); ctx.arc(318, 20, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0d1424'; ctx.beginPath(); ctx.arc(321, 17, 5.5, 0, Math.PI * 2); ctx.fill();

  /* ── スカイライン（高さを崩したビル群）── */
  const blds = [
    [2, 26, 46], [24, 20, 66], [46, 30, 38], [74, 24, 84], [96, 18, 58],
    [196, 26, 92], [220, 34, 60], [252, 22, 74], [272, 18, 48]
  ];
  for (let b = 0; b < blds.length; b++) {
    const bx = blds[b][0], bw = blds[b][1], bh = blds[b][2];
    P(ctx, bx, SEA - bh, bw, bh, b % 2 ? '#0a0e18' : '#0e1626');
    P(ctx, bx, SEA - bh, bw, 1, '#1e2a44');
    if (bh > 70) P(ctx, bx + Math.floor(bw / 2) - 1, SEA - bh - 5, 2, 5, '#0a0e18');   // アンテナ
    // 窓＝擬似ハッシュで一部だけ点灯
    for (let wy = 0; wy < Math.floor((bh - 6) / 6); wy++)
      for (let wx = 0; wx < Math.floor((bw - 4) / 6); wx++) {
        const s = h(b * 131 + wy * 17 + wx * 7);
        if (s < 0.3) P(ctx, bx + 3 + wx * 6, SEA - bh + 4 + wy * 6, 3, 3, '#d8c878');
        else if (s < 0.36) P(ctx, bx + 3 + wx * 6, SEA - bh + 4 + wy * 6, 3, 3, '#8aa4c8');
      }
  }
  // いちばん高いビルの屋上に赤い航空灯（点滅）
  ctx.fillStyle = `rgba(255,80,80,${(0.4 + 0.6 * (Math.sin(t * 2.6) > 0 ? 1 : 0.1)).toFixed(2)})`;
  ctx.fillRect(207, SEA - 92 - 4, 2, 2); ctx.fillRect(84, SEA - 84 - 4, 2, 2);
  // 白い電光看板（ビルの中腹に一枚）
  P(ctx, 224, 92, 24, 8, '#f2f4f6');
  P(ctx, 227, 95, 6, 2, '#3a4458'); P(ctx, 236, 95, 8, 2, '#3a4458');

  /* ── 帆の形のホテル（右） ── */
  ctx.fillStyle = '#0a0e18';
  ctx.beginPath(); ctx.moveTo(294, SEA);
  ctx.quadraticCurveTo(298, 66, 336, 44);
  ctx.lineTo(340, SEA); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#2e4a6e'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(294, SEA); ctx.quadraticCurveTo(298, 66, 336, 44); ctx.stroke();  // 帆の縁の光
  for (let wy = 0; wy < 12; wy++) for (let wx = 0; wx < 6; wx++) {
    const yy = 56 + wy * 6, edge = 298 + (SEA - yy) * -0.02 + (yy - 44) * 0.42;
    const xx = 336 - wx * 6 - Math.floor((SEA - yy) * 0.28);
    if (xx > 296 && yy < SEA - 4 && h(wy * 23 + wx * 11 + 400) < 0.34)
      P(ctx, xx, yy, 3, 3, '#d8c878');
  }
  P(ctx, 322, 38, 2, 8, '#101a30');
  ctx.fillStyle = `rgba(224,104,136,${(0.5 + 0.4 * Math.sin(t * 3.4)).toFixed(2)})`;
  ctx.fillRect(321, 36, 3, 3);                                       // 帆先の桃ネオン

  /* ── 観覧車（左中・回転しネオンが替わる主役級ランドマーク）── */
  const cx = 148, cy = 90, R = 36, rot = t * 0.2;
  ctx.fillStyle = '#0a0e18';
  ctx.beginPath(); ctx.moveTo(cx - 3, cy); ctx.lineTo(cx - 16, SEA); ctx.lineTo(cx - 11, SEA); ctx.lineTo(cx, cy + 3); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + 3, cy); ctx.lineTo(cx + 16, SEA); ctx.lineTo(cx + 11, SEA); ctx.lineTo(cx, cy + 3); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#1a2436'; ctx.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    const a = rot + i * Math.PI / 5;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * (R - 2), cy + Math.sin(a) * (R - 2)); ctx.stroke();
  }
  ctx.strokeStyle = '#1e2a44'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 30; i++) {
    const a = rot + i * Math.PI * 2 / 30;
    const ci = (Math.floor(i / 5) + Math.floor(t * 0.8)) % 3;
    P(ctx, Math.round(cx + Math.cos(a) * R) - 1, Math.round(cy + Math.sin(a) * R) - 1, 2, 2, NEON[ci]);
  }
  for (let i = 0; i < 10; i++) {                                     // ゴンドラ＝ぶら下がる粒（点灯は一部）
    const a = rot + i * Math.PI / 5;
    const gx2 = Math.round(cx + Math.cos(a) * (R - 1)), gy2 = Math.round(cy + Math.sin(a) * (R - 1)) + 2;
    P(ctx, gx2 - 1, gy2, 3, 3, h(i + 61) < 0.55 ? '#f5e6c0' : '#26324e');
  }
  P(ctx, cx - 2, cy - 2, 4, 4, '#e8a040');
  ctx.fillStyle = `rgba(232,160,64,${(0.14 + 0.08 * Math.sin(t * 3)).toFixed(2)})`;
  ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();

  /* 岸辺の街の灯（低い連なり） */
  for (let i = 0; i < 24; i++) {
    const lx = 4 + i * 15 + Math.floor(h(i + 200) * 6);
    if (h(i + 210) < 0.7) P(ctx, lx, SEA - 4, 2, 2, '#e8d8a8');
  }
  P(ctx, 0, SEA - 2, 360, 2, '#0a0e18');

  /* ── 手前の暗い海と、縦に伸びて揺れる灯りの反射 ── */
  const sea = ctx.createLinearGradient(0, SEA, 0, 200);
  sea.addColorStop(0, '#1a2a48'); sea.addColorStop(1, '#0d1730');
  ctx.fillStyle = sea; ctx.fillRect(0, SEA, 360, 200 - SEA);
  // 反射柱（光源のx・色・長さを散らし、T()で揺らす）
  const refl = [
    [cx - 20, NEON[Math.floor(t * 0.8) % 3], 52], [cx, '#f5e6c0', 40], [cx + 20, NEON[(Math.floor(t * 0.8) + 1) % 3], 48],
    [86, '#d8c878', 30], [208, '#d8c878', 36], [236, '#f2f4f6', 26],
    [316, '#e06888', 44], [330, '#d8c878', 30], [34, '#d8c878', 22], [262, '#d8c878', 28],
    /* S級審査（8/9）：観覧車の真下にネオン色の反射を足す＝デートの余韻 */
    [cx - 32, '#d98ab5', 34], [cx - 8, '#d98ab5', 26], [cx + 12, '#d98ab5', 30], [cx + 30, '#d98ab5', 22],
    [cx - 26, '#7eb9d8', 24], [cx - 14, '#7eb9d8', 32], [cx + 6, '#7eb9d8', 22], [cx + 24, '#7eb9d8', 28]
  ];
  for (let r = 0; r < refl.length; r++) {
    const bx = refl[r][0], col = refl[r][1], len = refl[r][2];
    for (let k = 0; k < Math.floor(len / 5); k++) {
      const yy = SEA + 3 + k * 5;
      const sway = Math.sin(t * 2.2 + yy * 0.25 + bx * 0.4) * (1 + k * 0.35);
      ctx.globalAlpha = Math.max(0, 0.55 - k * 0.055);
      P(ctx, Math.round(bx + sway), yy, 2, 3, col);
    }
    ctx.globalAlpha = 1;
  }
  // 月の反射（右寄り・白く長く）
  for (let k = 0; k < 10; k++) {
    const yy = SEA + 4 + k * 6;
    const sway = Math.sin(t * 1.8 + k * 1.3) * (1.5 + k * 0.3);
    ctx.fillStyle = `rgba(242,236,216,${(0.4 - k * 0.035).toFixed(3)})`;
    ctx.fillRect(Math.round(316 + sway), yy, 3 + (k % 2), 2);
  }
  // さざ波
  ripple(ctx, 20, SEA + 14, 130, 'rgba(140,170,210,.22)');
  ripple(ctx, 180, SEA + 30, 160, 'rgba(140,170,210,.18)');
  ripple(ctx, 60, SEA + 52, 240, 'rgba(140,170,210,.12)');
  // 手前を横切る小さな船の影（ゆっくり流れる）
  const shipX = ((t * 7) % 480) - 60;
  P(ctx, Math.round(shipX), 176, 26, 5, '#0a0e18');
  P(ctx, Math.round(shipX) + 8, 172, 8, 4, '#0a0e18');
  P(ctx, Math.round(shipX) + 22, 177, 2, 2, '#e8a040');
  P(ctx, Math.round(shipX) + 10, 173, 2, 2, '#e8d8a8');
}

/* ══════════════════════════════════════════════════════
   買い出し ── ととのい中央駅の地下街
   ------------------------------------------------------------
   昼だが地下。蛍光灯の白い光が、通路の端まで同じ明るさで続く。
   一点透視の長い通路。両側に業務用の店。奥に上り階段と地上の光。
   主人公は台車に段ボールを積んで押す。蛍光灯は1本だけちらつく。
   ══════════════════════════════════════════════════════ */
function y_kai_marinard(ctx) {
  const t = T();
  const h = i => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
  const LX = u => u * 128, RX = u => 360 - u * 128;
  const LT = u => u * 52, LB = u => 200 - u * 76;
  const q = (u, f) => LT(u) + (LB(u) - LT(u)) * f;

  /* 地＝蛍光灯の白。端まで同じ明るさ */
  P(ctx, 0, 0, 360, 200, '#e8f0ec');

  /* 天井・壁・床（白さは保って面だけ分ける） */
  ctx.fillStyle = '#dfe9e4';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(360, 0); ctx.lineTo(232, 52); ctx.lineTo(128, 52); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e2ece7';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(128, 52); ctx.lineTo(128, 124); ctx.lineTo(0, 200); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e0eae5';
  ctx.beginPath(); ctx.moveTo(360, 0); ctx.lineTo(232, 52); ctx.lineTo(232, 124); ctx.lineTo(360, 200); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c8c8c0';
  ctx.beginPath(); ctx.moveTo(0, 200); ctx.lineTo(360, 200); ctx.lineTo(232, 124); ctx.lineTo(128, 124); ctx.closePath(); ctx.fill();
  /* 床の目地（奥へ収束） */
  ctx.strokeStyle = 'rgba(118,118,108,.4)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    ctx.beginPath(); ctx.moveTo(i / 8 * 360, 200); ctx.lineTo(128 + i / 8 * 104, 124); ctx.stroke();
  }
  for (let i = 1; i <= 6; i++) {
    const f = (i / 6) * (i / 6), y = 124 + 76 * f, half = 52 + 128 * ((y - 124) / 76);
    ctx.beginPath(); ctx.moveTo(180 - half, y); ctx.lineTo(180 + half, y); ctx.stroke();
  }

  /* 両側の業務用の店（間口も棚の中身も揃えない） */
  const pals = [
    ['#d86848', '#4a78b8', '#e0a83a', '#5a9a6a', '#b85a9a'],   // 洗剤の箱
    ['#f0e8d4', '#d8cfc0', '#e6dcc4'],                          // タオルの束
    ['#c8a868', '#8a9ab0', '#b0885a', '#7a9a8a']                // 雑多な箱
  ];
  const shop = (side, u1, u2, pal, seed, signCol) => {
    const X = side < 0 ? LX : RX;
    ctx.fillStyle = '#cfdad3';
    ctx.beginPath();
    ctx.moveTo(X(u1), q(u1, .16)); ctx.lineTo(X(u2), q(u2, .16));
    ctx.lineTo(X(u2), q(u2, .97)); ctx.lineTo(X(u1), q(u1, .97));
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = signCol;
    ctx.beginPath();
    ctx.moveTo(X(u1), q(u1, .06)); ctx.lineTo(X(u2), q(u2, .06));
    ctx.lineTo(X(u2), q(u2, .15)); ctx.lineTo(X(u1), q(u1, .15));
    ctx.closePath(); ctx.fill();
    for (const f of [.42, .64, .86]) {
      ctx.strokeStyle = '#9aa8a0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(X(u1), q(u1, f)); ctx.lineTo(X(u2), q(u2, f)); ctx.stroke();
      let k = seed + f * 40, u = u1 + 0.015;
      while (u < u2 - 0.01) {
        const w = (7 - u * 4) * (0.7 + h(k) * 0.6);
        const ht = (q(u, f) - q(u, f - .2)) * (0.55 + h(k + 1) * 0.4);
        const col = pal[Math.floor(h(k + 2) * pal.length)];
        const x = X(u);
        P(ctx, side < 0 ? x : x - w, q(u, f) - ht, w, ht, col);
        P(ctx, side < 0 ? x : x - w, q(u, f) - ht, w, 1, 'rgba(255,255,255,.45)');
        u += (w + 1.5 + h(k + 3) * 5) / 128;
        k += 4;
      }
    }
  };
  shop(-1, .10, .46, pals[0], 3, '#8898a8');
  shop(-1, .54, .82, pals[1], 77, '#2a7858');
  shop(1, .16, .58, pals[2], 151, '#8898a8');
  shop(1, .66, .86, pals[0], 210, '#2a7858');

  /* 奥の壁と上り階段（地上の光）。
     S級審査（8/9）：階段まわりだけコントラストを一段強く＝「白い世界の先の出口」。
     壁は冷たい薄灰 #D6DDE1 に落とし、踏面と奥の光はクリーム #F2E6B0 で締める */
  P(ctx, 128, 52, 104, 72, '#d6dde1');
  P(ctx, 154, 58, 52, 66, '#bcc7cc');
  for (let i = 0; i < 7; i++) {
    const yy = 118 - i * 8, ww = 48 - i * 4;
    P(ctx, 180 - ww / 2, yy, ww, 3, `rgba(242,230,176,${(0.35 + i * 0.10).toFixed(2)})`);
  }
  P(ctx, 164, 58, 32, 13, '#f2e6b0');
  P(ctx, 164, 58, 32, 2, '#faf2cc');
  ctx.fillStyle = 'rgba(242,230,176,.38)';
  ctx.beginPath(); ctx.arc(180, 66, 24, 0, Math.PI * 2); ctx.fill();
  P(ctx, 152, 58, 2, 66, '#9aa6ac'); P(ctx, 206, 58, 2, 66, '#9aa6ac');

  /* 蛍光灯の列（3本目だけちらつく） */
  for (let i = 0; i < 6; i++) {
    const v = 0.10 + i * 0.15, y = v * 52;
    const xl = (y / 52) * 128 + 14, xr = 360 - (y / 52) * 128 - 14;
    const bh = Math.max(2, 4 - i * 0.5);
    P(ctx, xl - 2, y - 1, xr - xl + 4, bh + 2, '#c9d3cd');
    let a = 0.95;
    if (i === 3) a = Math.sin(t * 26) > -0.3 ? 0.95 : 0.2;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(xl, y, xr - xl, bh);
    ctx.fillStyle = `rgba(255,255,255,${(a * 0.14).toFixed(2)})`;
    ctx.fillRect(xl, y + bh, xr - xl, 8);
  }

  /* 案内板（緑） */
  P(ctx, 84, 0, 2, 12, '#8a948e'); P(ctx, 138, 0, 2, 12, '#8a948e');
  P(ctx, 76, 12, 72, 18, '#2a7858'); P(ctx, 76, 12, 72, 2, '#3f9070');
  ctx.font = '8px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = '#f2f7f0'; ctx.fillText('↑ 地上', 112, 24);
  ctx.textAlign = 'left';

  /* 店先に積まれた段ボール */
  P(ctx, 52, 168, 24, 16, '#c8a868'); P(ctx, 52, 168, 24, 2, '#e0c088');
  P(ctx, 63, 168, 2, 16, '#a8854e');
  P(ctx, 56, 153, 18, 15, '#b8945a'); P(ctx, 56, 153, 18, 2, '#d4b478');
  P(ctx, 64, 153, 2, 15, '#98753e');

  /* ── 主人公：台車に段ボールを積んで押す ── */
  ctx.fillStyle = 'rgba(0,0,0,.14)';
  ctx.beginPath(); ctx.ellipse(168, 184, 46, 5, 0, 0, Math.PI * 2); ctx.fill();
  // 台車
  P(ctx, 150, 172, 44, 5, '#7a746c'); P(ctx, 150, 171, 44, 2, '#98928a');
  ctx.fillStyle = '#2e2a26';
  ctx.beginPath(); ctx.arc(159, 180, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(185, 180, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8a8480'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(152, 170); ctx.lineTo(147, 148); ctx.stroke();
  // 段ボール2箱（テープと縁光）
  P(ctx, 153, 147, 38, 25, '#c8a868'); P(ctx, 153, 147, 38, 2, '#e0c088');
  P(ctx, 170, 147, 3, 25, '#a8854e');
  P(ctx, 157, 128, 30, 19, '#b8945a'); P(ctx, 157, 128, 30, 2, '#d4b478');
  P(ctx, 170, 128, 3, 19, '#98753e');
  // 男（30代・黒短髪・紺シャツ）＝前傾して押す
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#39404e'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(135, 158); ctx.lineTo(123, 182); ctx.stroke();          // 後ろ脚＝伸ばして蹴る
  ctx.beginPath(); ctx.moveTo(137, 158); ctx.lineTo(144, 168); ctx.lineTo(142, 180); ctx.stroke(); // 前脚＝膝折り
  P(ctx, 118, 180, 8, 4, '#2a2622'); P(ctx, 139, 178, 8, 4, '#2a2622');
  ctx.save(); ctx.translate(136, 158); ctx.rotate(0.34);
  P(ctx, -5, -16, 10, 17, '#2a3a5e');
  ctx.fillStyle = '#2a3a5e'; ctx.beginPath(); ctx.arc(0, -16, 5, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = '#2a3a5e'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(2, -13); ctx.lineTo(11, -6); ctx.stroke();
  P(ctx, 9, -8, 4, 4, '#e8c39a');
  ctx.fillStyle = '#e8c39a'; ctx.beginPath(); ctx.arc(1, -24, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#20180f'; ctx.beginPath(); ctx.arc(0.4, -25.4, 4.5, Math.PI * 0.9, Math.PI * 2.05); ctx.fill();
  ctx.restore();
  ctx.lineCap = 'butt';

  ctx.strokeStyle = '#3a4440'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 356, 196);
}


/* ══════════════════════════════════════════════════════
   買い出し ── 熱波銀座モール（アーケード商店街・昼）
   ------------------------------------------------------------
   ガラスと鉄骨の屋根から光が落ちる。「熱波銀座」のアーチ看板。
   店の並びは幅も色も揃えない。買い物客はまばら。
   主人公は店の前で立ち止まり、メモを見る。
   ══════════════════════════════════════════════════════ */
function y_kai_isezaki1(ctx) {
  const t = T();
  const h = i => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
  const ry = x => 440 - Math.sqrt(160000 - (x - 180) * (x - 180));

  /* 奥の壁と路面 */
  P(ctx, 0, 0, 360, 152, '#d8d0c0');
  P(ctx, 0, 152, 360, 48, '#b0a890');
  P(ctx, 0, 152, 360, 2, '#9a927e');
  ctx.strokeStyle = 'rgba(90,84,70,.3)'; ctx.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    const x = i * 27 + (i % 2) * 8;
    ctx.beginPath(); ctx.moveTo(x, 154); ctx.lineTo(x - 4, 200); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(0, 170); ctx.lineTo(360, 170); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 186); ctx.lineTo(360, 186); ctx.stroke();

  /* 店の並び（幅・色・軒の高さを崩す） */
  const stores = [
    { x: 6, w: 62, top: 90, col: '#c86848', aw: '#e8ddc4', name: '器' },
    { x: 72, w: 88, top: 84, col: '#4a8a78', aw: '#d8a848', name: 'くすり', stripe: 1 },
    { x: 164, w: 54, top: 94, col: '#d8a848', aw: '#b05040', name: '布' },
    { x: 222, w: 80, top: 86, col: '#b05a48', aw: '#e8ddc4', name: '金物', stripe: 1 },
    { x: 306, w: 48, top: 92, col: '#3f7a6a', aw: '#d8c890', name: '茶' }
  ];
  ctx.font = '7px "DotGothic16",sans-serif';
  for (const s of stores) {
    P(ctx, s.x, s.top, s.w, 152 - s.top, s.col);
    P(ctx, s.x, s.top, s.w, 2, 'rgba(255,255,255,.3)');
    P(ctx, s.x + 4, s.top + 5, s.w - 8, 11, 'rgba(30,24,18,.55)');
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f5ead8'; ctx.fillText(s.name, s.x + s.w / 2, s.top + 13);
    ctx.textAlign = 'left';
    const ay = s.top + 18;
    P(ctx, s.x - 2, ay, s.w + 4, 9, s.aw);
    if (s.stripe) for (let sx = s.x - 2; sx < s.x + s.w + 2; sx += 8) P(ctx, sx, ay, 4, 9, 'rgba(120,60,40,.5)');
    P(ctx, s.x - 2, ay + 9, s.w + 4, 1, 'rgba(0,0,0,.25)');
    P(ctx, s.x + 5, ay + 12, s.w - 10, 152 - ay - 12, 'rgba(222,232,232,.75)');
    ctx.strokeStyle = 'rgba(60,60,60,.35)'; ctx.lineWidth = 1;
    ctx.strokeRect(s.x + 5, ay + 12, s.w - 10, 152 - ay - 12);
    ctx.beginPath(); ctx.moveTo(s.x + s.w / 2, ay + 12); ctx.lineTo(s.x + s.w / 2, 152); ctx.stroke();
  }
  /* 店先の木箱 */
  P(ctx, 98, 140, 16, 12, '#b08a58'); P(ctx, 98, 140, 16, 2, '#caa870');
  P(ctx, 101, 130, 12, 10, '#9a7448'); P(ctx, 101, 130, 12, 2, '#b8905c');

  /* アーケードの屋根（ガラス＋鉄骨のアーチ） */
  const a1 = Math.atan2(-357, 180), a2 = Math.atan2(-357, -180);
  ctx.fillStyle = '#f0e8d0';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(360, 0); ctx.lineTo(360, 83);
  ctx.arc(180, 440, 400, a1, a2, true); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#586878'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(180, 440, 400, a1, a2, true); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(180, 440, 390, a1, a2, true); ctx.stroke();
  for (let x = 30; x <= 330; x += 50) {
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ry(x)); ctx.stroke();
  }
  /* 屋根から落ちる光だまり */
  ctx.fillStyle = 'rgba(255,248,220,.2)';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(64 + i * 88 + h(i) * 14, 162 + (i % 2) * 14, 26, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /* 垂れ幕（風で揺れる） */
  P(ctx, 300, 78, 1, 12, '#6a6458');
  const sway = Math.sin(t * 2) * 3;
  ctx.fillStyle = '#c84a2e';
  ctx.beginPath(); ctx.moveTo(295, 90); ctx.lineTo(307, 90);
  ctx.lineTo(307 + sway, 118); ctx.lineTo(295 + sway, 118); ctx.closePath(); ctx.fill();

  /* アーチ看板「熱波銀座」＋追いかけ点滅の電球 */
  P(ctx, 112, 52, 7, 138, '#586878'); P(ctx, 241, 52, 7, 138, '#586878');
  P(ctx, 112, 52, 2, 138, '#7a8a98'); P(ctx, 241, 52, 2, 138, '#7a8a98');
  P(ctx, 108, 186, 15, 8, '#4a5563'); P(ctx, 237, 186, 15, 8, '#4a5563');
  P(ctx, 106, 52, 148, 24, '#37424e');
  P(ctx, 109, 55, 142, 18, '#222c36');
  ctx.font = 'bold 12px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd98a'; ctx.fillText('熱波銀座', 180, 69);
  ctx.textAlign = 'left';
  for (let i = 0; i < 6; i++) {
    const on = ((i + Math.floor(t * 4)) % 3) !== 0;
    ctx.fillStyle = on ? '#ffd98a' : '#6a5a3a';
    ctx.beginPath(); ctx.arc(118 + i * 25, 80, 2, 0, Math.PI * 2); ctx.fill();
    if (on) {
      ctx.fillStyle = 'rgba(255,217,138,.25)';
      ctx.beginPath(); ctx.arc(118 + i * 25, 80, 4, 0, Math.PI * 2); ctx.fill();
    }
  }

  /* まばらな買い物客（歩幅と持ち物で差をつける） */
  const walker = (x, y, col, ph) => {
    ctx.strokeStyle = col; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x - 3 * ph, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x + 3 * ph, y); ctx.stroke();
    P(ctx, x - 3, y - 19, 6, 10, col);
    ctx.fillStyle = '#e8c39a'; ctx.beginPath(); ctx.arc(x, y - 22, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4a3626'; ctx.beginPath(); ctx.arc(x, y - 23, 3, Math.PI, Math.PI * 2); ctx.fill();
  };
  ctx.lineCap = 'round';
  walker(146, 178, '#7a5a4a', 1);                       // 大股で歩く
  walker(58, 172, '#5a7a6a', 0.4);                      // 紙袋を提げる
  P(ctx, 62, 162, 7, 9, '#d8a848'); P(ctx, 62, 162, 7, 1, '#f0c868');

  /* ── 主人公：店の前で立ち止まり、メモを見る ── */
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath(); ctx.ellipse(271, 186, 12, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#39404e'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(268, 166); ctx.lineTo(266, 184); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(274, 166); ctx.lineTo(276, 184); ctx.stroke();
  P(ctx, 262, 182, 8, 4, '#2a2622'); P(ctx, 273, 182, 8, 4, '#2a2622');
  P(ctx, 263, 145, 15, 22, '#2a3a5e');
  ctx.fillStyle = '#2a3a5e'; ctx.beginPath(); ctx.arc(270.5, 145, 7.5, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = '#2a3a5e'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(265, 150); ctx.lineTo(258, 155); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(273, 151); ctx.lineTo(261, 157); ctx.stroke();
  P(ctx, 255, 152, 4, 4, '#e8c39a'); P(ctx, 258, 155, 4, 4, '#e8c39a');
  // メモ（買うものの控え）。S級審査（8/9）：一段明るくして行動の焦点に
  P(ctx, 248, 145, 11, 13, '#f1e2bc');
  P(ctx, 248, 145, 11, 1, '#faf0d4');
  P(ctx, 250, 148, 7, 1, '#6b523d'); P(ctx, 250, 151, 6, 1, '#6b523d'); P(ctx, 250, 154, 7, 1, '#6b523d');
  // うつむいた頭（黒短髪）
  ctx.fillStyle = '#e8c39a'; ctx.beginPath(); ctx.arc(264, 137, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#20180f'; ctx.beginPath(); ctx.arc(265.5, 135.5, 5, Math.PI * 0.55, Math.PI * 1.95); ctx.fill();
  P(ctx, 260, 138, 1, 2, '#20180f');
  ctx.lineCap = 'butt';

  ctx.strokeStyle = '#4a4436'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 356, 196);
}


/* ══════════════════════════════════════════════════════
   買い出し ── 古道具屋の店内
   ------------------------------------------------------------
   薄暗い店内に裸電球。ぎっしりの棚（急須・桶・時計・扇風機）。
   奥から店主の親父が腰を落として木の椅子を引っ張り出してくる。
   「これ、去年潰れたサウナのだよ。使うかい」
   主人公は手前で振り返る。埃が光の中で舞う。
   ══════════════════════════════════════════════════════ */
function y_kai_isezaki2(ctx) {
  const t = T();
  const h = i => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;

  /* 薄暗い店内と床板 */
  P(ctx, 0, 0, 360, 200, '#221a12');
  P(ctx, 0, 152, 360, 48, '#453424');
  ctx.strokeStyle = 'rgba(20,12,6,.5)'; ctx.lineWidth = 1;
  for (let y = 160; y < 200; y += 9) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke();
  }
  for (let i = 0; i < 12; i++) P(ctx, 18 + i * 31 + (i % 2) * 9, 154 + (i % 3) * 15, 1, 8, 'rgba(20,12,6,.4)');

  /* 奥の壁とガラクタの影 */
  P(ctx, 126, 58, 118, 94, '#2c2218');
  for (let i = 0; i < 8; i++) {
    P(ctx, 130 + i * 14, 66 + h(i) * 22, 10, 28 - h(i + 9) * 12, '#241c12');
  }

  /* 裸電球と光（光はこの一つだけ） */
  P(ctx, 149, 0, 2, 20, '#3a3026');
  const grad = ctx.createRadialGradient(150, 30, 4, 150, 60, 95);
  grad.addColorStop(0, 'rgba(238,204,124,.5)'); grad.addColorStop(1, 'rgba(238,204,124,0)');
  ctx.fillStyle = grad; ctx.fillRect(40, 0, 220, 170);
  ctx.fillStyle = 'rgba(238,204,124,.08)';
  ctx.beginPath(); ctx.moveTo(150, 32); ctx.lineTo(66, 200); ctx.lineTo(234, 200); ctx.closePath(); ctx.fill();
  P(ctx, 146, 18, 8, 5, '#4a4034');
  ctx.fillStyle = '#e8c878'; ctx.beginPath(); ctx.arc(150, 28, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f8e0a0'; ctx.beginPath(); ctx.arc(150, 27, 2.5, 0, Math.PI * 2); ctx.fill();

  /* ぎっしりの棚（色と形を散らす） */
  const cols = ['#8a6a4a', '#6a7a8a', '#9a8a5a', '#7a5a6a', '#5a7a6a', '#a8875a', '#8a5a4a'];
  const clutter = (x0, w, ys, seed) => {
    P(ctx, x0 - 3, ys[0] - 26, 3, ys[ys.length - 1] - ys[0] + 36, '#3a2c1c');
    P(ctx, x0 + w, ys[0] - 26, 3, ys[ys.length - 1] - ys[0] + 36, '#3a2c1c');
    let k = seed;
    for (const y of ys) {
      P(ctx, x0 - 3, y, w + 6, 3, '#4a3826');
      P(ctx, x0 - 3, y, w + 6, 1, '#5f4a30');
      let x = x0 + 1;
      while (x < x0 + w - 7) {
        const typ = Math.floor(h(k) * 5);
        const iw = 6 + h(k + 1) * 7, ih = 8 + h(k + 2) * 10;
        const c = cols[Math.floor(h(k + 3) * cols.length)];
        if (typ === 0) {                        // 急須
          P(ctx, x, y - ih * 0.6, iw, ih * 0.6, c);
          P(ctx, x + iw, y - ih * 0.55, 3, 2, c);
          P(ctx, x + iw / 2 - 1, y - ih * 0.6 - 2, 2, 2, '#3a2c1c');
          P(ctx, x, y - ih * 0.6, iw, 1, 'rgba(238,204,124,.3)');
        } else if (typ === 1) {                 // 桶
          P(ctx, x, y - ih * 0.7, iw, ih * 0.7, c);
          P(ctx, x, y - ih * 0.7, iw, 2, '#c8b088');
        } else if (typ === 2) {                 // 時計
          ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + iw / 2, y - ih / 2, iw / 2, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.arc(x + iw / 2, y - ih / 2, iw / 2 - 2, 0, Math.PI * 2); ctx.fill();
          P(ctx, x + iw / 2, y - ih / 2 - 3, 1, 3, '#2a2218');
          P(ctx, x + iw / 2, y - ih / 2, 3, 1, '#2a2218');
        } else if (typ === 3) {                 // 扇風機
          P(ctx, x + iw / 2 - 1, y - 4, 2, 4, '#4a4440');
          ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + iw / 2, y - ih + 3, iw / 2, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#2c261e'; ctx.beginPath(); ctx.arc(x + iw / 2, y - ih + 3, iw / 2 - 2, 0, Math.PI * 2); ctx.fill();
        } else {                                // 皿の山
          for (let s = 0; s < 3; s++) P(ctx, x, y - 3 - s * 3, iw, 2, s % 2 ? c : '#b8a888');
        }
        x += iw + 2 + h(k + 4) * 4;
        k += 5;
      }
    }
  };
  clutter(10, 104, [70, 104, 138], 5);
  clutter(252, 98, [78, 118, 152], 200);

  /* ── 店主：腰を落として木の椅子を引っ張り出す ── */
  // 椅子（去年潰れたサウナの、だ）。
  // S級審査（8/9）：座面と背を蜂蜜色 #C79A60 に上げ、「店主が出したモノ」を主役に
  P(ctx, 196, 150, 18, 4, '#c79a60'); P(ctx, 196, 150, 18, 1, '#e0b878');
  P(ctx, 197, 154, 3, 16, '#8a6a3c'); P(ctx, 210, 154, 3, 16, '#8a6a3c');
  P(ctx, 211, 128, 3, 22, '#c79a60'); P(ctx, 203, 126, 11, 3, '#c79a60');
  P(ctx, 203, 126, 11, 1, '#e0b878');
  // 引きずりの擦れ線
  ctx.strokeStyle = 'rgba(238,204,124,.22)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(190, 170); ctx.lineTo(182, 170); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(192, 174); ctx.lineTo(183, 174); ctx.stroke();
  // 親父（前掛け・ハンチング）＝膝を折り、後ろに反って引く
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#4a4438'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(238, 166); ctx.lineTo(247, 173); ctx.lineTo(244, 186); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(236, 166); ctx.lineTo(229, 174); ctx.lineTo(232, 186); ctx.stroke();
  P(ctx, 241, 184, 7, 4, '#2c261e'); P(ctx, 228, 184, 7, 4, '#2c261e');
  /* 店主の服は冷たい灰茶 #6F6A64 に寄せる（椅子を立たせるため・S級審査 8/9） */
  ctx.save(); ctx.translate(237, 166); ctx.rotate(-0.3);
  P(ctx, -5, -16, 10, 17, '#6f6a64');
  P(ctx, -6, -10, 7, 13, '#5e564e');
  ctx.fillStyle = '#6f6a64'; ctx.beginPath(); ctx.arc(0, -16, 5, Math.PI, 0); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#6f6a64'; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(233, 150); ctx.lineTo(217, 132); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(235, 155); ctx.lineTo(218, 139); ctx.stroke();
  P(ctx, 213, 129, 5, 5, '#d8b088'); P(ctx, 214, 136, 5, 5, '#d8b088');
  ctx.fillStyle = '#d8b088'; ctx.beginPath(); ctx.arc(234, 143, 4.5, 0, Math.PI * 2); ctx.fill();
  P(ctx, 229, 137, 11, 3, '#6a5a3a'); P(ctx, 226, 139, 5, 2, '#6a5a3a');
  P(ctx, 230, 143, 1, 2, '#2a2218');

  /* ── 主人公：手前で振り返る ── */
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(87, 191, 13, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#39404e'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(84, 168); ctx.lineTo(81, 190); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(90, 168); ctx.lineTo(94, 190); ctx.stroke();
  P(ctx, 77, 188, 8, 4, '#2a2622'); P(ctx, 91, 188, 8, 4, '#2a2622');
  P(ctx, 77, 146, 17, 24, '#2a3a5e');
  ctx.fillStyle = '#2a3a5e'; ctx.beginPath(); ctx.arc(85.5, 146, 8.5, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = '#2a3a5e'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(79, 152); ctx.lineTo(70, 145); ctx.stroke();   // 左手＝棚に伸ばしかけ
  ctx.beginPath(); ctx.moveTo(92, 152); ctx.lineTo(95, 166); ctx.stroke();   // 右手＝下ろす
  P(ctx, 66, 141, 5, 5, '#e8c39a'); P(ctx, 93, 165, 5, 5, '#e8c39a');
  // 振り向いた頭（右後ろの店主のほうへ）
  ctx.fillStyle = '#e8c39a'; ctx.beginPath(); ctx.arc(90, 136, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#20180f'; ctx.beginPath(); ctx.arc(88.4, 134.8, 5.5, Math.PI * 0.62, Math.PI * 1.9); ctx.fill();
  P(ctx, 93, 134, 1, 2, '#20180f');
  ctx.lineCap = 'butt';

  /* 埃が光の中で舞う */
  for (let i = 0; i < 12; i++) {
    const dx = 96 + h(i) * 120;
    const dy = 40 + ((t * (12 + h(i + 30) * 12) + h(i + 60) * 150) % 150);
    const al = 0.16 + 0.3 * (0.5 + 0.5 * Math.sin(t * 2 + i * 1.7));
    P(ctx, Math.round(dx + Math.sin(t + i) * 3), Math.round(dy), 1, 1, `rgba(240,214,150,${al.toFixed(2)})`);
  }

  ctx.strokeStyle = '#141008'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 356, 196);
}


/* ══════════════════════════════════════════════════════
   買い出し ── 郊外SC・外観（昼）
   ------------------------------------------------------------
   巨大な箱型の建物と広い駐車場。車はまばらで等間隔にしない。
   カート置き場。自動ドアが開いたり閉じたり。空は広く、
   主人公は小さく＝建物の大きさを見せる。
   ══════════════════════════════════════════════════════ */
function y_kai_mall1(ctx) {
  const t = T();
  const h = i => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;

  /* 広い空と流れる雲 */
  P(ctx, 0, 0, 360, 200, '#9fc8e8');
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  for (let i = 0; i < 3; i++) {
    const cx = ((t * 2.5 + i * 150) % 480) - 60, cy = 12 + i * 17;
    ctx.fillRect(cx, cy, 60 + i * 12, 8); ctx.fillRect(cx + 14, cy - 6, 32, 7);
  }

  /* 巨大な箱（横にとにかく長い） */
  P(ctx, 16, 64, 328, 68, '#e0dcd4');
  P(ctx, 16, 60, 328, 6, '#cfcac0');
  P(ctx, 16, 64, 328, 2, '#f0ece4');
  ctx.strokeStyle = 'rgba(0,0,0,.07)'; ctx.lineWidth = 1;
  for (let x = 50; x < 344; x += 34) { ctx.beginPath(); ctx.moveTo(x, 66); ctx.lineTo(x, 130); ctx.stroke(); }
  P(ctx, 16, 128, 328, 4, '#b8b4ac');
  /* 屋上の室外機 */
  P(ctx, 58, 52, 18, 8, '#b0aca4'); P(ctx, 210, 54, 14, 6, '#b0aca4'); P(ctx, 300, 53, 10, 7, '#b0aca4');
  /* 細長い窓帯 */
  P(ctx, 30, 76, 118, 8, 'rgba(120,140,150,.35)');
  P(ctx, 224, 76, 104, 8, 'rgba(120,140,150,.35)');
  /* 大きな赤い看板＝スーパーヴィヒタ（作者命名 8/9） */
  P(ctx, 138, 42, 84, 32, '#c84838');
  P(ctx, 138, 42, 84, 3, '#e06850');
  ctx.textAlign = 'center';
  ctx.font = '8px "DotGothic16",sans-serif';
  ctx.fillStyle = '#f8d8c8'; ctx.fillText('スーパー', 180, 53);
  ctx.font = 'bold 13px "DotGothic16",sans-serif';
  ctx.fillStyle = '#f8f2e8'; ctx.fillText('ヴィヒタ', 180, 68);
  ctx.textAlign = 'left';

  /* 入口＝自動ドア（ChatGPT処方 8/9）
     構成：固定16px｜扉24px‖扉24px｜固定16px（x148〜228）。
     扉は固定ガラスの上へスライドして重なる＝重なった所だけガラスが濃くなる。
     開口の奥は「店内→床→玄関マット」の3段で「奥まで床が続く入口」に読ませる。
     描画順：店内 → 固定ガラス → スライド扉 → 框・センサー                */
  P(ctx, 146, 96, 84, 10, '#c84838');                  // 庇
  P(ctx, 146, 104, 84, 30, '#7e898d');                 // 外枠サッシ
  // 奥（開口の向こう）
  P(ctx, 148, 106, 80, 26, '#f4ecd2');                 // 店内の明かり
  P(ctx, 148, 122, 80, 8, '#c8bea7');                  // 奥へ続く床
  P(ctx, 168, 126, 40, 4, '#535d61');                  // 濃灰の玄関マット
  // 固定ガラス（薄い・框1px・映り込み）
  const fixPane = (fx) => {
    ctx.fillStyle = 'rgba(190,215,223,.55)'; ctx.fillRect(fx, 106, 16, 26);
    ctx.strokeStyle = '#7e898d'; ctx.lineWidth = 1; ctx.strokeRect(fx + 0.5, 106.5, 15, 25);
    ctx.strokeStyle = 'rgba(255,255,255,.45)';
    ctx.beginPath(); ctx.moveTo(fx + 4, 128); ctx.lineTo(fx + 12, 110); ctx.stroke();
  };
  fixPane(148); fixPane(212);
  // スライド扉2枚（濃いガラス・太い框・キックプレート・緑の小シール）
  const openPx = Math.round(14 * (0.5 + 0.5 * Math.sin(t * 1.7)));
  const slideDoor = (dx, sealOfs) => {
    ctx.fillStyle = 'rgba(145,185,202,.78)'; ctx.fillRect(dx, 106, 24, 26);
    P(ctx, dx + 2, 127, 20, 3, '#626a6d');             // キックプレート（動く扉だけ）
    ctx.strokeStyle = '#4f5c63'; ctx.lineWidth = 2; ctx.strokeRect(dx + 1, 107, 22, 24);
    P(ctx, dx + sealOfs, 116, 2, 2, '#5d9472');        // 緑の小シール
  };
  slideDoor(164 - openPx, 16); slideDoor(188 + openPx, 6);
  // 自動ドアセンサー（中央上・小さく点滅）
  P(ctx, 184, 101, 8, 3, '#3a4247');
  P(ctx, 187, 102, 2, 1, Math.sin(t * 3) > 0 ? '#7ec8a0' : '#41564b');

  /* カート置き場 */
  P(ctx, 244, 110, 48, 4, '#b0aca4');
  P(ctx, 244, 110, 3, 24, '#9a968e'); P(ctx, 289, 110, 3, 24, '#9a968e');
  ctx.strokeStyle = '#9aa4ac'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const x = 252 + i * 8;
    ctx.beginPath();
    ctx.moveTo(x, 120); ctx.lineTo(x + 8, 120); ctx.lineTo(x + 7, 128); ctx.lineTo(x + 1, 128); ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = '#22201e';
    ctx.fillRect(x + 1, 130, 2, 2); ctx.fillRect(x + 5, 130, 2, 2);
  }

  /* 駐車場（作者指摘 8/9：区画線に沿ってきちんと停める。
     奥列＝建物沿い／中央の通路＝空ける／手前列＝縦の区画線） */
  P(ctx, 0, 132, 360, 68, '#8a8880');
  P(ctx, 0, 132, 360, 2, '#7a786e');
  ctx.strokeStyle = 'rgba(235,235,228,.45)'; ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {                        // 手前列の区画線（縦・等間隔）
    const x = 14 + i * 42;
    ctx.beginPath(); ctx.moveTo(x, 158); ctx.lineTo(x, 196); ctx.stroke();
  }
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {                        // 奥列の区画線（短く・細く）
    const x = 132 + i * 38;
    ctx.beginPath(); ctx.moveTo(x, 136); ctx.lineTo(x, 150); ctx.stroke();
  }
  const car = (x, y, col) => {
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.ellipse(x + 15, y + 11, 17, 3, 0, 0, Math.PI * 2); ctx.fill();
    P(ctx, x, y, 30, 10, col); P(ctx, x + 5, y - 6, 19, 7, col);
    P(ctx, x + 7, y - 5, 7, 5, 'rgba(214,235,245,.9)'); P(ctx, x + 16, y - 5, 6, 5, 'rgba(214,235,245,.9)');
    P(ctx, x, y, 30, 1, 'rgba(255,255,255,.35)');
    ctx.fillStyle = '#22201e';
    ctx.beginPath(); ctx.arc(x + 6, y + 10, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 24, y + 10, 3, 0, Math.PI * 2); ctx.fill();
  };
  /* 手前列＝区画の中央に停める（空き区画も残す） */
  car(20, 172, '#c85a4a'); car(104, 172, '#4a6a9a'); car(188, 172, '#d8d0c0');
  car(272, 172, '#3a3a3e'); car(314, 172, '#7a9a6a');
  /* S級審査（8/9）：奥列に小さめの車を足して駐車場の奥行き＝「行くだけでひと仕事」 */
  const farCar = (x, y, col) => {
    ctx.fillStyle = 'rgba(0,0,0,.14)';
    ctx.beginPath(); ctx.ellipse(x + 9, y + 6, 10, 2, 0, 0, Math.PI * 2); ctx.fill();
    P(ctx, x, y, 18, 6, col); P(ctx, x + 3, y - 3, 11, 4, col);
    P(ctx, x + 4, y - 2, 8, 2, 'rgba(214,235,245,.8)');
    ctx.fillStyle = '#22201e';
    ctx.beginPath(); ctx.arc(x + 4, y + 6, 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 14, y + 6, 1.7, 0, Math.PI * 2); ctx.fill();
  };
  farCar(142, 141, '#b8c2c8'); farCar(180, 141, '#4b4f56'); farCar(256, 141, '#93aa8a');
  farCar(294, 141, '#b8c2c8'); farCar(332, 141, '#4b4f56');

  /* ── 主人公：小さく、通路を歩いて入口へ（奥列の車と重ねない） ── */
  ctx.fillStyle = 'rgba(0,0,0,.2)';
  ctx.beginPath(); ctx.ellipse(146, 172, 6, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#39404e'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(146, 164); ctx.lineTo(143, 171); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(146, 164); ctx.lineTo(149, 171); ctx.stroke();
  P(ctx, 143, 156, 6, 9, '#2a3a5e');
  ctx.fillStyle = '#e8c39a'; ctx.beginPath(); ctx.arc(146, 153, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#20180f'; ctx.beginPath(); ctx.arc(146, 152.4, 3, Math.PI, Math.PI * 2); ctx.fill();
  ctx.lineCap = 'butt';
}


/* ══════════════════════════════════════════════════════
   買い出し ── 郊外SC・棚の海（店内）
   ------------------------------------------------------------
   一階から四階まで、同じ種類の棚が延々と続いている。
   吹き抜けの上に二階・三階の手すりと同じ棚。棚の列は反復が主題、
   ただし中身の色は散らす。主人公はカートを押し、手をかざして見上げる。
   ══════════════════════════════════════════════════════ */
function y_kai_mall2(ctx) {
  const t = T();
  const h = i => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
  const pal = ['#c86848', '#4a8ab8', '#d8a848', '#5a9a6a', '#9a6ab8', '#b85a5a', '#d8d0c0'];

  /* 三階（吹き抜けの向こうに同じ棚） */
  P(ctx, 0, 0, 360, 34, '#dcd6cc');
  for (let i = 0; i < 24; i++) {
    const x = i * 15 + h(i) * 4;
    P(ctx, x, 6, 10, 18, '#c6c0b4');
    P(ctx, x + 1, 8, 8, 3, pal[Math.floor(h(i + 40) * 7)]);
    P(ctx, x + 1, 13, 8, 3, pal[Math.floor(h(i + 80) * 7)]);
  }
  P(ctx, 0, 22, 360, 10, 'rgba(168,180,188,.3)');
  for (let x = 4; x < 360; x += 12) P(ctx, x, 22, 1, 10, '#8f8a80');
  P(ctx, 0, 30, 360, 6, '#c8c2b6'); P(ctx, 0, 30, 360, 1, '#e2dcd0');

  /* 二階（同じ棚がまた続く） */
  P(ctx, 0, 36, 360, 38, '#e0dad0');
  for (let i = 0; i < 19; i++) {
    const x = i * 19 + h(i + 7) * 5;
    P(ctx, x, 40, 13, 24, '#c2bcb0');
    P(ctx, x + 1, 43, 11, 4, pal[Math.floor(h(i + 120) * 7)]);
    P(ctx, x + 1, 50, 11, 4, pal[Math.floor(h(i + 160) * 7)]);
  }
  P(ctx, 0, 54, 360, 14, 'rgba(168,180,188,.3)');
  for (let x = 2; x < 360; x += 14) P(ctx, x, 54, 1, 14, '#8f8a80');
  P(ctx, 0, 66, 360, 8, '#c8c2b6'); P(ctx, 0, 66, 360, 1, '#e2dcd0');

  /* 一階（売り場） */
  P(ctx, 0, 74, 360, 126, '#e8e4da');
  // スラブ下の蛍光灯
  for (let i = 0; i < 5; i++) {
    P(ctx, 28 + i * 68, 74, 36, 4, '#b8b2a8');
    P(ctx, 30 + i * 68, 74, 32, 3, 'rgba(255,255,255,.95)');
  }
  /* 床（通路が奥へ） */
  ctx.fillStyle = '#d8d4ca';
  ctx.beginPath();
  ctx.moveTo(0, 200); ctx.lineTo(0, 172); ctx.lineTo(150, 140); ctx.lineTo(210, 140);
  ctx.lineTo(360, 172); ctx.lineTo(360, 200); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(150, 196); ctx.lineTo(172, 142); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(210, 196); ctx.lineTo(188, 142); ctx.stroke();

  /* 奥＝エスカレーターと小さな客 */
  P(ctx, 150, 100, 60, 42, '#cfcabe');
  ctx.strokeStyle = '#a8a296'; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(156 + i * 3, 136 - i * 2); ctx.lineTo(202 - i * 2, 104 + i * 2); ctx.stroke();
  }
  P(ctx, 175, 118, 3, 6, '#3a4a6e');
  P(ctx, 175, 115, 3, 3, '#e8c39a');

  /* 同じ棚が延々と続く（列は反復・中身の色は散らす） */
  const run = (fx, bx, seed) => {
    ctx.fillStyle = '#c2bcb0';
    ctx.beginPath(); ctx.moveTo(fx, 88); ctx.lineTo(bx, 118); ctx.lineTo(bx, 142); ctx.lineTo(fx, 196); ctx.closePath(); ctx.fill();
    for (let r = 0; r < 4; r++) {
      const f = 0.16 + r * 0.22;
      const y1 = 88 + 108 * f, y2 = 118 + 24 * f;
      ctx.strokeStyle = '#a8a296'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(fx, y1); ctx.lineTo(bx, y2); ctx.stroke();
      let k = seed + r * 31, u = 0.03;
      while (u < 0.96) {
        const x = fx + (bx - fx) * u;
        const yb = y1 + (y2 - y1) * u;
        const ih = (20 - 15 * u) * (0.55 + h(k) * 0.4);
        const iw = (7 - 5 * u) * (0.7 + h(k + 1) * 0.5);
        P(ctx, x, yb - ih, iw, ih, pal[Math.floor(h(k + 2) * 7)]);
        P(ctx, x, yb - ih, iw, 1, 'rgba(255,255,255,.4)');
        u += (iw + 1 + h(k + 3) * 3) / Math.abs(bx - fx);
        k += 4;
      }
    }
  };
  run(96, 166, 55);
  run(264, 194, 300);

  /* 手前のエンド棚（商品の壁） */
  const wall = (x0, seed) => {
    P(ctx, x0, 86, 80, 110, '#b4aea2');
    P(ctx, x0, 82, 80, 5, '#9a948a');
    let k = seed;
    for (const y of [108, 132, 156, 180]) {
      P(ctx, x0, y, 80, 3, '#8f897d');
      let x = x0 + 2;
      while (x < x0 + 76) {
        const iw = 5 + h(k) * 7, ih = 9 + h(k + 1) * 11;
        P(ctx, x, y - ih, iw, ih, pal[Math.floor(h(k + 2) * 7)]);
        P(ctx, x, y - ih, iw, 1, 'rgba(255,255,255,.4)');
        x += iw + 1 + h(k + 3) * 3; k += 4;
      }
    }
  };
  wall(16, 9);
  wall(264, 400);

  /* 電光掲示（流れる光の点） */
  P(ctx, 46, 76, 2, 8, '#8a857c'); P(ctx, 112, 76, 2, 8, '#8a857c');
  P(ctx, 36, 84, 88, 16, '#232830');
  ctx.strokeStyle = '#3a424e'; ctx.lineWidth = 1; ctx.strokeRect(36, 84, 88, 16);
  for (let i = 0; i < 4; i++) {
    const xx = 40 + ((i * 26 + t * 30) % 76);
    P(ctx, xx, 90, 6, 4, '#ffb84a');
  }

  /* ── 主人公：カートを押して棚を見上げる（手をかざす） ── */
  ctx.fillStyle = 'rgba(0,0,0,.16)';
  ctx.beginPath(); ctx.ellipse(184, 192, 20, 4, 0, 0, Math.PI * 2); ctx.fill();
  // カート（奥へ向いている）
  ctx.fillStyle = 'rgba(200,210,215,.35)';
  ctx.beginPath(); ctx.moveTo(172, 146); ctx.lineTo(196, 146); ctx.lineTo(199, 162); ctx.lineTo(169, 162); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#8a949c'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(172, 146); ctx.lineTo(196, 146); ctx.lineTo(199, 162); ctx.lineTo(169, 162); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(178, 146); ctx.lineTo(177, 162); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(190, 146); ctx.lineTo(191, 162); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(170, 152); ctx.lineTo(198, 152); ctx.stroke();
  ctx.fillStyle = '#33302c';
  ctx.beginPath(); ctx.arc(172, 166, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(196, 166, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(169, 163); ctx.lineTo(166, 171); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(199, 163); ctx.lineTo(202, 171); ctx.stroke();
  P(ctx, 165, 170, 38, 3, '#c84838');
  // 主人公（後ろ姿・右手を額にかざして見上げる）
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#39404e'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(178, 176); ctx.lineTo(176, 192); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(188, 176); ctx.lineTo(190, 192); ctx.stroke();
  P(ctx, 172, 190, 8, 4, '#2a2622'); P(ctx, 187, 190, 8, 4, '#2a2622');
  P(ctx, 172, 154, 22, 24, '#2a3a5e');
  ctx.fillStyle = '#2a3a5e'; ctx.beginPath(); ctx.arc(183, 154, 11, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = '#2a3a5e'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(174, 158); ctx.lineTo(168, 170); ctx.stroke();     // 左手＝カートの持ち手へ
  ctx.beginPath(); ctx.moveTo(192, 157); ctx.lineTo(198, 148); ctx.lineTo(191, 141); ctx.stroke(); // 右手＝額へ
  P(ctx, 165, 168, 5, 4, '#e8c39a'); P(ctx, 188, 139, 5, 4, '#e8c39a');
  // 頭（見上げているので後頭部＝黒髪、首すじが見える）
  ctx.fillStyle = '#20180f'; ctx.beginPath(); ctx.arc(183, 142, 5.5, 0, Math.PI * 2); ctx.fill();
  P(ctx, 180, 148, 6, 3, '#e8c39a');
  ctx.lineCap = 'butt';

  ctx.strokeStyle = '#4a463c'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 356, 196);
}

/* ══════════════════════════════════════════════════════
   ロウリュ街で飲む(1) ── 路地の入口（夜）
   ------------------------------------------------------------
   「飲み屋の看板が、路地の両側から頭の上まで迫ってくる」
   両側の看板・提灯・ネオンが頭上で層になりほぼ繋がる圧迫構図。
   濡れた路面が灯りを縦に反射。奥へ人の肩。主人公は見上げる後ろ姿。
   ══════════════════════════════════════════════════════ */
function y_noge1(ctx) {
  const t = T();
  const h = i => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
  const R = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  const E = (x, y, rx, ry, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); };

  /* 夜空（看板の隙間からわずかに見える） */
  P(ctx, 0, 0, 360, 200, '#1c2030');

  /* 路地の突き当たり＝光だまり */
  const bk = ctx.createRadialGradient(182, 100, 4, 182, 100, 62);
  bk.addColorStop(0, 'rgba(232,160,64,.55)'); bk.addColorStop(1, 'rgba(232,160,64,0)');
  ctx.fillStyle = bk; ctx.fillRect(120, 40, 124, 82);
  /* 奥の小さな灯（店明かりの点） */
  for (let i = 0; i < 7; i++) {
    const x = 158 + h(i + 2) * 48, y = 66 + h(i + 9) * 40;
    P(ctx, Math.round(x), Math.round(y), 2, 2, i % 3 ? '#e8a040' : '#d04838');
  }
  /* 奥へ連なる人の肩（シルエット・遠いほど小さい） */
  for (let i = 4; i >= 0; i--) {
    const d = i / 4, x = 170 + (h(i + 21) - 0.4) * 26, y = 104 + d * 12, s = 3.4 + d * 3.2;
    const a = (0.55 + d * 0.35).toFixed(2);
    E(x, y, s * 1.6, s, `rgba(10,9,14,${a})`);            // 肩
    R(x, y - s - 2.4, s * 0.72, `rgba(10,9,14,${a})`);    // 頭
    P(ctx, Math.round(x - s * 1.4), Math.round(y - s - 1), Math.round(s * 2.8), 1, 'rgba(232,160,64,.28)'); // 灯の縁光
  }

  /* 両側の建物壁（黒い量塊） */
  ctx.fillStyle = '#14161e';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(168, 34); ctx.lineTo(168, 118); ctx.lineTo(28, 200); ctx.lineTo(0, 200); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#121420';
  ctx.beginPath(); ctx.moveTo(360, 0); ctx.lineTo(196, 34); ctx.lineTo(196, 118); ctx.lineTo(332, 200); ctx.lineTo(360, 200); ctx.closePath(); ctx.fill();
  /* 壁の小窓（にじむ灯） */
  for (let i = 0; i < 6; i++) {
    const d = h(i + 31);
    P(ctx, Math.round(120 + d * 40), Math.round(58 + h(i + 40) * 40), 4, 5, 'rgba(255,214,138,.35)');
    P(ctx, Math.round(200 + h(i + 50) * 40), Math.round(60 + h(i + 61) * 38), 4, 5, 'rgba(255,214,138,.3)');
  }

  /* 濡れた路面 */
  ctx.fillStyle = '#3a3e48';
  ctx.beginPath(); ctx.moveTo(168, 118); ctx.lineTo(196, 118); ctx.lineTo(332, 200); ctx.lineTo(28, 200); ctx.closePath(); ctx.fill();
  const lx = y => 168 + (28 - 168) * (y - 118) / 82;
  const rx = y => 196 + (332 - 196) * (y - 118) / 82;
  /* 石畳の目地（奥ほど詰まる） */
  ctx.strokeStyle = 'rgba(20,22,30,.5)'; ctx.lineWidth = 1;
  for (const y of [126, 136, 150, 168, 190]) {
    ctx.beginPath(); ctx.moveTo(lx(y), y); ctx.lineTo(rx(y), y); ctx.stroke();
  }
  /* 灯りの縦反射（色ごとに揺れる） */
  const streaks = [[0.16, '#d04838'], [0.34, '#e8a040'], [0.5, '#e8a040'], [0.68, '#48a860'], [0.86, '#d04838']];
  for (let s = 0; s < streaks.length; s++) {
    const [u, col] = streaks[s];
    for (let y = 122; y < 198; y += 4) {
      const w = 2 + (y - 118) / 26;
      const x = lx(y) + (rx(y) - lx(y)) * u + Math.sin(t * 2 + y * 0.25 + s * 2) * 1.6;
      const al = 0.3 * (1 - (y - 118) / 110) + 0.06 * Math.sin(t * 3 + s);
      ctx.fillStyle = col; ctx.globalAlpha = Math.max(0.05, al);
      ctx.fillRect(Math.round(x), y, Math.round(w), 3);
    }
  }
  ctx.globalAlpha = 1;

  /* ── 看板の氾濫（高さ・幅・色を崩して密度で圧する） ── */
  // 看板ヘルパー：本体＋壁への腕木＋下面の照り。
  // S級審査（8/9）：壁から伸びる支持アーム（藍黒#161C34）と短い落ち影で「物体の重さ」を出す
  const sgn = (x, y, w, hh, bg, edge) => {
    const armX = (x + w / 2 < 180) ? x - 7 : x + w + 1;          // 近い側の壁へ
    P(ctx, armX, y + 3, 6, 2, '#161c34');
    P(ctx, armX, y + hh - 4, 6, 2, '#161c34');
    P(ctx, x - 1, y - 1, w + 2, hh + 2, '#0c0e14');
    P(ctx, x, y, w, hh, bg);
    P(ctx, x, y, w, 1, edge);                       // 上縁の照り
    P(ctx, x, y + hh, w, 1, 'rgba(0,0,0,.6)');
    P(ctx, x + 2, y + hh + 1, w - 4, 2, 'rgba(22,28,52,.5)');    // 落ち影
  };
  const txt = (s, x, y, size, col, bold) => {
    ctx.font = (bold ? 'bold ' : '') + size + 'px "DotGothic16",sans-serif';
    ctx.textAlign = 'center'; ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.textAlign = 'left';
  };
  const vtxt = (s, x, y, step, size, col) => {
    ctx.font = size + 'px "DotGothic16",sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = col;
    for (let i = 0; i < s.length; i++) ctx.fillText(s[i], x, y + i * step);
    ctx.textAlign = 'left';
  };

  /* 左壁の看板群 */
  sgn(6, 8, 66, 28, '#e8a040', '#ffd98a'); txt('酒場', 39, 28, 13, '#2a1a10', true);
  P(ctx, 72, 18, 6, 3, '#3a3040');                                   // 腕木
  sgn(2, 54, 30, 62, '#d04838', '#ff8a6a'); vtxt('炭火や', 17, 68, 15, 10, '#ffe8d0');
  // 緑ネオン（明滅）
  const bl = 0.55 + 0.45 * Math.sin(t * 5.2);
  sgn(48, 44, 52, 20, '#101418', '#223028');
  ctx.strokeStyle = `rgba(72,168,96,${bl.toFixed(2)})`; ctx.lineWidth = 1; ctx.strokeRect(50.5, 46.5, 47, 15);
  txt('もつ焼', 74, 58, 9, `rgba(120,232,150,${bl.toFixed(2)})`);
  sgn(96, 24, 28, 14, '#2a3a58', '#4a5c80'); txt('呑', 110, 35, 10, '#f5ead8');
  sgn(112, 74, 26, 12, '#6a5038', '#8a6a48'); txt('串', 125, 84, 9, '#ffd98a');

  /* 右壁の看板群 */
  sgn(292, 4, 62, 26, '#d04838', '#ff8a6a'); txt('大衆', 323, 23, 13, '#ffe8d0', true);
  sgn(250, 38, 48, 18, '#e8a040', '#ffd98a'); txt('やきとん', 274, 51, 8, '#3a2010');
  // 縦の緑ネオン（別リズムで明滅）
  const bl2 = 0.55 + 0.45 * Math.sin(t * 3.4 + 2);
  sgn(324, 40, 30, 70, '#101418', '#223028');
  ctx.strokeStyle = `rgba(72,168,96,${bl2.toFixed(2)})`; ctx.strokeRect(326.5, 42.5, 25, 65);
  vtxt('ホルモン', 339, 54, 15, 8, `rgba(120,232,150,${bl2.toFixed(2)})`);
  sgn(238, 66, 26, 12, '#2a3a58', '#4a5c80'); txt('麦酒', 251, 76, 8, '#f5ead8');

  /* 頭上で繋がりかける中央の看板（左右から迫り出す） */
  sgn(122, 12, 44, 18, '#6a5038', '#8a6a48'); txt('ロウリュ横丁', 144, 25, 8, '#ffd98a');
  sgn(198, 8, 46, 20, '#d04838', '#ff8a6a'); txt('酔処', 221, 23, 11, '#ffe8d0');
  P(ctx, 166, 18, 32, 2, '#0c0e14');   // 渡り梁でほぼ接続

  /* 提灯の列（高さも間隔も揃えない・揺れる） */
  const lant = (x, y, w, hh, s) => {
    const sw = Math.sin(t * 1.8 + s) * 2;
    const xx = x + sw;
    P(ctx, Math.round(x), y - 6, 1, 6, '#3a3040');                    // 吊り紐
    P(ctx, Math.round(xx - w / 2), y, w, hh, '#d04838');
    P(ctx, Math.round(xx - w / 2) + 1, y + 2, w - 2, hh - 4, '#e86048');
    P(ctx, Math.round(xx - w / 2), y - 1, w, 2, '#2a2020'); P(ctx, Math.round(xx - w / 2), y + hh - 1, w, 2, '#2a2020');
    ctx.fillStyle = `rgba(255,180,120,${(0.2 + 0.08 * Math.sin(t * 4 + s)).toFixed(2)})`;
    ctx.beginPath(); ctx.arc(xx, y + hh / 2, w, 0, Math.PI * 2); ctx.fill();
    return xx;
  };
  for (let i = 0; i < 5; i++) {
    const x = 136 + i * 22 + (h(i + 70) - 0.5) * 8, y = 52 + Math.round(h(i + 80) * 14);
    const cx = lant(x, y, 8 + Math.round(h(i + 90) * 3), 11 + Math.round(h(i + 95) * 4), i * 1.7);
    if (i === 2) txt('酒', cx, y + 10, 7, '#5a1810');
  }
  lant(96, 92, 11, 15, 9); lant(268, 88, 10, 14, 11);

  /* ── 主人公（手前・見上げる後ろ姿） ── */
  const px = 130;
  E(px, 197, 15, 3, 'rgba(0,0,0,.45)');                       // 影
  P(ctx, px - 8, 176, 6, 21, '#22283a'); P(ctx, px + 2, 176, 6, 21, '#22283a');   // 脚
  P(ctx, px - 9, 195, 8, 3, '#181a22'); P(ctx, px + 1, 195, 8, 3, '#181a22');     // 靴
  E(px, 152, 12, 7, '#2a3a58');                               // 丸い肩
  P(ctx, px - 12, 152, 24, 26, '#2a3a58');                    // 紺シャツの背
  P(ctx, px - 12, 151, 24, 1, 'rgba(232,160,64,.55)');        // 肩の縁光（看板の照り返し）
  P(ctx, px - 14, 154, 5, 16, '#2a3a58'); P(ctx, px + 9, 154, 5, 16, '#243250');  // 腕
  P(ctx, px - 14, 170, 5, 3, '#e8c39a'); P(ctx, px + 9, 170, 5, 3, '#e8c39a');    // 手
  R(px, 142, 7, '#181a20');                                   // 黒短髪（見上げて頭がのけぞる）
  E(px, 138.5, 5, 2.4, 'rgba(232,160,64,.4)');                // 頭頂の縁光
  P(ctx, px - 3, 149, 6, 3, '#e8c39a');                       // うなじ
}


/* ══════════════════════════════════════════════════════
   ロウリュ街で飲む(2) ── 狭い店のカウンター（夜）
   ------------------------------------------------------------
   「狭いから、隣の客と肩がぶつかる」
   一列ぎっしり・全員姿勢違い。焼き場の炎と煙。大将が串を返す。
   主人公は右端で隣とジョッキを合わせる。
   ══════════════════════════════════════════════════════ */
function y_noge2(ctx) {
  const t = T();
  const h = i => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
  const R = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  const E = (x, y, rx, ry, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); };
  const txt = (s, x, y, size, col) => {
    ctx.font = size + 'px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.textAlign = 'left';
  };
  const vtxt = (s, x, y, step, size, col) => {
    ctx.font = size + 'px "DotGothic16",sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = col;
    for (let i = 0; i < s.length; i++) ctx.fillText(s[i], x, y + i * step);
    ctx.textAlign = 'left';
  };

  /* 板壁（縦板・煤けた茶） */
  P(ctx, 0, 0, 360, 200, '#2c2014');
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1;
  for (let x = 0; x < 360; x += 13 + 0) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 128); ctx.stroke(); }
  /* 暖色の店明かり（全体を包む） */
  const gl = ctx.createRadialGradient(180, 60, 20, 180, 90, 200);
  gl.addColorStop(0, 'rgba(232,160,64,.22)'); gl.addColorStop(1, 'rgba(232,160,64,0)');
  ctx.fillStyle = gl; ctx.fillRect(0, 0, 360, 200);

  /* 短冊メニュー（高さバラバラ） */
  const menu = ['もつ煮', '串五本', '酒', 'ハイ', '漬物', '煮込', 'たん'];
  for (let i = 0; i < 7; i++) {
    const x = 150 + i * 29 + Math.round((h(i + 5) - 0.5) * 6), y = 8 + Math.round(h(i + 15) * 8);
    const hh = 30 + Math.round(h(i + 25) * 14);
    P(ctx, x, y, 16, hh, '#e8dcc0'); P(ctx, x, y, 16, 2, '#a89468');
    P(ctx, x + 15, y, 1, hh, 'rgba(0,0,0,.25)');
    vtxt(menu[i], x + 8, y + 11, 9, 7, '#3a2a18');
  }
  /* 棚と酒瓶 */
  P(ctx, 8, 40, 118, 5, '#4a382a'); P(ctx, 8, 45, 118, 2, 'rgba(0,0,0,.4)');
  for (let i = 0; i < 9; i++) {
    const x = 14 + i * 13, bh = 12 + Math.round(h(i + 35) * 6);
    P(ctx, x, 40 - bh, 7, bh, ['#3a5a3a', '#6a4a2a', '#2a3a58'][i % 3]);
    P(ctx, x + 2, 40 - bh - 4, 3, 4, '#1a1410');
    P(ctx, x + 1, 40 - bh + 1, 1, bh - 2, 'rgba(255,255,255,.22)');
  }
  /* 店内の赤提灯（揺れる） */
  const sw = Math.sin(t * 1.9) * 2;
  P(ctx, 134, 6, 1, 8, '#1a1410');
  P(ctx, Math.round(129 + sw), 14, 12, 16, '#d04838'); P(ctx, Math.round(130 + sw), 16, 10, 12, '#e86048');
  P(ctx, Math.round(129 + sw), 13, 12, 2, '#2a2020'); P(ctx, Math.round(129 + sw), 29, 12, 2, '#2a2020');
  txt('酒', 135 + sw, 26, 8, '#5a1810');
  ctx.fillStyle = `rgba(255,180,120,${(0.18 + 0.07 * Math.sin(t * 4)).toFixed(2)})`;
  ctx.beginPath(); ctx.arc(135 + sw, 22, 13, 0, Math.PI * 2); ctx.fill();

  /* ── 焼き場（左）── */
  P(ctx, 30, 84, 96, 36, '#3a2c20'); P(ctx, 30, 84, 96, 2, '#5a4630');
  P(ctx, 40, 90, 74, 12, '#181210');                                   // 火床
  for (let i = 0; i < 9; i++) {                                        // 炎（揺れる）
    const fx = 44 + i * 8, fh = 4 + 3 * Math.abs(Math.sin(t * 7 + i * 1.4)) + h(i + 45) * 2;
    P(ctx, fx, Math.round(96 - fh), 3, Math.round(fh + 4), i % 2 ? '#e8a040' : '#d04838');
    P(ctx, fx + 1, Math.round(98 - fh * 0.5), 1, 2, '#ffe8a0');
  }
  P(ctx, 40, 88, 74, 2, '#8a8078');                                    // 焼き網
  for (let i = 0; i < 5; i++) P(ctx, 46 + i * 14, 86, 10, 3, '#7a4a30'); // 網の上の串
  wisp(ctx, 52, 80, 3, .3); wisp(ctx, 84, 76, 4, .35);                 // 煙
  /* 大将（白衣・鉢巻・串を返す腕がt()で動く） */
  E(58, 66, 12, 7, '#e8e4da'); P(ctx, 46, 66, 24, 22, '#e8e4da');
  P(ctx, 46, 66, 24, 1, 'rgba(255,214,138,.6)');
  R(58, 54, 7, '#e8c39a');                                             // 顔
  P(ctx, 51, 46, 14, 4, '#4a4038'); P(ctx, 51, 49, 14, 2, '#f0ead8');  // 髪と鉢巻
  P(ctx, 54, 55, 2, 2, '#2a2020'); P(ctx, 60, 55, 2, 2, '#2a2020');    // 目
  const arm = Math.sin(t * 3.2) * 4;                                   // 串を返す動き
  P(ctx, 68, 68, 12, 5, '#e8e4da');                                    // 突き出す腕
  P(ctx, 80, Math.round(70 + arm * 0.4), 4, 4, '#e8c39a');             // 手
  P(ctx, 82, Math.round(72 + arm * 0.4), 16, 1, '#c8a060');            // 串
  P(ctx, 96, Math.round(71 + arm * 0.4), 4, 3, '#a05838');             // 肉

  /* ── カウンター ── */
  P(ctx, 0, 126, 360, 3, '#a8845a'); P(ctx, 0, 129, 360, 9, '#8a6a44');
  P(ctx, 0, 138, 360, 16, '#6a5038'); P(ctx, 0, 152, 360, 2, '#4a3626');
  /* 卓上（皿・徳利・グラス） */
  E(120, 133, 7, 2.5, '#d8d2c6'); P(ctx, 116, 131, 8, 2, '#a05838');   // もつ皿
  P(ctx, 176, 124, 5, 9, '#d8d2c6'); P(ctx, 177, 122, 3, 3, '#b8b0a4');// 徳利
  P(ctx, 186, 126, 4, 7, 'rgba(220,235,240,.8)');                      // ぐい呑み
  E(238, 133, 6, 2.5, '#d8d2c6'); P(ctx, 235, 131, 7, 2, '#4a6a38');

  /* ── 客の列（肩が触れる距離・全員違う姿勢） ── */
  const skin = '#e8c39a';
  const guy = (x, col, hair, pose) => {
    P(ctx, x - 7, 176, 14, 4, '#3a2c20'); P(ctx, x - 5, 180, 3, 14, '#2a2016'); P(ctx, x + 2, 180, 3, 14, '#2a2016'); // 丸椅子
    let hx = x, hy = 116, lean = 0;
    if (pose === 'laugh') { lean = -3; hy = 111; }
    if (pose === 'cheek') { hx = x + 4; hy = 119; }
    E(x, 140 + lean * 0.3, 13, 8, col);                                // 丸い肩
    P(ctx, x - 13, 140 + lean, 26, 38 - lean, col);                    // 背中
    P(ctx, x - 13, 139 + lean, 26, 1, 'rgba(255,190,120,.4)');         // 肩の縁光
    if (pose === 'mug') {                                              // ジョッキを傾ける
      P(ctx, x + 10, 122, 5, 14, col);
      P(ctx, x + 13, 114, 9, 11, '#e8c050'); P(ctx, x + 13, 112, 9, 3, '#fff8e8');
      P(ctx, x + 22, 116, 2, 6, '#c8a040');
    } else if (pose === 'cheek') {                                     // 頬杖
      P(ctx, x + 8, 126, 4, 12, col); P(ctx, x + 8, 122, 4, 5, skin);
    } else if (pose === 'laugh') {                                     // のけぞって笑う
      P(ctx, x - 16, 126, 5, 10, col); P(ctx, x + 11, 126, 5, 10, col);
      P(ctx, x - 16, 123, 5, 3, skin); P(ctx, x + 11, 123, 5, 3, skin);
    } else {                                                           // 徳利に手
      P(ctx, x + 9, 130, 5, 10, col); P(ctx, x + 9, 127, 5, 3, skin);
    }
    R(hx, hy, 7, hair);                                                // 後頭部
    P(ctx, hx - 3, hy + 6, 6, 4, skin);                                // うなじ
    E(hx, hy - 5, 5, 2, 'rgba(255,190,120,.3)');                       // 頭の照り
  };
  guy(22, '#6a4a3a', '#2a2420', 'mug');
  guy(64, '#4a5a44', '#b8b4ac', 'cheek');      // 白髪の常連
  guy(106, '#8a5a6a', '#3a3028', 'laugh');
  guy(150, '#5a6b8a', '#2a2420', 'sit');
  guy(194, '#6a5038', '#4a3a2c', 'mug');
  guy(238, '#4a4a5a', '#2a2420', 'cheek');

  /* 主人公（右端・隣とジョッキを合わせる瞬間） */
  const nb = 288, me = 330;                                            // 隣客と主人公
  P(ctx, nb - 7, 176, 14, 4, '#3a2c20'); P(ctx, me - 7, 176, 14, 4, '#3a2c20');
  E(nb, 140, 13, 8, '#6a4a3a'); P(ctx, nb - 13, 140, 26, 38, '#6a4a3a');
  P(ctx, nb - 13, 139, 26, 1, 'rgba(255,190,120,.4)');
  E(me, 140, 13, 8, '#2a3a58'); P(ctx, me - 13, 140, 26, 38, '#2a3a58'); // 紺シャツ
  P(ctx, me - 13, 139, 26, 1, 'rgba(255,190,120,.5)');
  const cl = Math.sin(t * 4);                                          // 乾杯の寄せ
  P(ctx, nb + 8, 124, 5, 14, '#6a4a3a');                               // 隣の腕（右上へ）
  P(ctx, me - 13, 124, 5, 14, '#243250');                              // 主人公の腕（左上へ）
  const mx = 306 + Math.round(cl);                                     // ぶつかるジョッキ2つ
  /* S級審査（8/9）：ジョッキを1pxずつ内側へ寄せ、接点に泡#F3E6A0を跳ねさせる */
  P(ctx, mx - 7, 112, 8, 12, '#e8c050'); P(ctx, mx - 7, 110, 8, 3, '#fff8e8');
  P(ctx, mx, 112, 8, 12, '#e8c050'); P(ctx, mx, 110, 8, 3, '#fff8e8');
  const sp = (0.5 + 0.5 * Math.sin(t * 6)).toFixed(2);                 // 触れ合う光
  P(ctx, mx - 1, 106, 3, 3, `rgba(255,248,220,${sp})`);
  P(ctx, mx, 103, 1, 2, `rgba(255,248,220,${sp})`); P(ctx, mx - 3, 108, 2, 1, `rgba(255,248,220,${sp})`);
  P(ctx, mx + 2, 107, 2, 2, `rgba(243,230,160,${sp})`);                // 泡の跳ね #F3E6A0
  P(ctx, mx - 2, 104, 1, 1, `rgba(243,230,160,${sp})`);
  P(ctx, mx + 4, 104, 1, 2, `rgba(243,230,160,${(sp * 0.8).toFixed(2)})`);
  R(nb, 114, 7, '#3a3028'); P(ctx, nb - 3, 120, 6, 4, skin);           // 隣：頭を主人公側へ傾け
  R(me - 2, 115, 7, '#181a20'); P(ctx, me - 5, 121, 6, 4, skin);       // 主人公：黒短髪
  E(me - 2, 110, 5, 2, 'rgba(255,190,120,.35)');

  /* 店内にたなびく煙 */
  wisp(ctx, 150, 50, 5, .16); wisp(ctx, 230, 44, 4, .13);
  P(ctx, 0, 196, 360, 4, 'rgba(0,0,0,.35)');
}


/* ══════════════════════════════════════════════════════
   ロウリュ街で飲む(3) ── 雨上がりの暖簾（夜）
   ------------------------------------------------------------
   藍の暖簾と赤提灯が揺れ、裸電球が滲む。水たまりに看板の色。
   先客の背中が半分だけ中へ。猫が軒下で丸まる。
   主人公は暖簾に手をかけた瞬間。
   ══════════════════════════════════════════════════════ */
function y_noge3(ctx) {
  const t = T();
  const h = i => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
  const R = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  const E = (x, y, rx, ry, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); };
  const txt = (s, x, y, size, col, bold) => {
    ctx.font = (bold ? 'bold ' : '') + size + 'px "DotGothic16",sans-serif';
    ctx.textAlign = 'center'; ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.textAlign = 'left';
  };
  const vtxt = (s, x, y, step, size, col) => {
    ctx.font = size + 'px "DotGothic16",sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = col;
    for (let i = 0; i < s.length; i++) ctx.fillText(s[i], x, y + i * step);
    ctx.textAlign = 'left';
  };

  /* 夜空（雨上がり・雲が切れて星がふたつみっつ） */
  P(ctx, 0, 0, 360, 200, '#1c2030');
  P(ctx, 0, 0, 360, 30, '#181c2a');
  for (let i = 0; i < 4; i++) {
    const al = 0.4 + 0.3 * Math.sin(t * 2 + i * 2.2);
    P(ctx, Math.round(20 + h(i + 3) * 320), Math.round(4 + h(i + 9) * 16), 1, 1, `rgba(220,230,255,${al.toFixed(2)})`);
  }
  E(70, 14, 30, 6, 'rgba(30,34,50,.8)'); E(300, 10, 36, 6, 'rgba(30,34,50,.7)');  // 切れ残りの雲

  /* 店の構え（木の面） */
  P(ctx, 24, 34, 312, 128, '#241c14');
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1;
  for (let x = 30; x < 336; x += 12) { ctx.beginPath(); ctx.moveTo(x, 56); ctx.lineTo(x, 162); ctx.stroke(); }
  /* 軒（瓦） */
  P(ctx, 16, 34, 328, 14, '#3a3e48'); P(ctx, 16, 34, 328, 3, '#4a4e58');
  for (let x = 20; x < 344; x += 16) P(ctx, x, 44, 12, 4, '#2e323c');
  P(ctx, 16, 48, 328, 2, '#14161e');
  /* 軒からの雫（雨上がり・ぽたり） */
  for (let i = 0; i < 3; i++) {
    const dx = [60, 246, 318][i], fall = ((t * 26 + i * 47) % 60);
    if (fall < 44) P(ctx, dx, Math.round(50 + fall), 1, 3, 'rgba(180,210,240,.55)');
  }
  /* 屋号看板（軒上） */
  P(ctx, 130, 18, 100, 18, '#6a5038'); P(ctx, 130, 18, 100, 2, '#8a6a48');
  P(ctx, 129, 17, 102, 1, '#0c0e14'); P(ctx, 129, 36, 102, 1, '#0c0e14');
  txt('もつ処 ろうりゅ', 180, 31, 9, '#ffd98a', true);

  /* 裸電球（軒下・にじむ光がまたたく） */
  for (const bx of [104, 258]) {
    P(ctx, bx, 48, 1, 7, '#1a1410');
    const fl = 0.75 + 0.25 * Math.sin(t * 9 + bx);
    R(bx, 58, 3, '#ffe8b0');
    ctx.fillStyle = `rgba(255,214,138,${(0.22 * fl).toFixed(2)})`;
    ctx.beginPath(); ctx.arc(bx, 58, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,214,138,${(0.1 * fl).toFixed(2)})`;
    ctx.beginPath(); ctx.arc(bx, 58, 20, 0, Math.PI * 2); ctx.fill();
  }

  /* 入口の奥（土間の暖かい光） */
  P(ctx, 128, 56, 104, 106, '#0e0a08');
  const din = ctx.createLinearGradient(0, 56, 0, 162);
  din.addColorStop(0, 'rgba(232,160,64,.5)'); din.addColorStop(1, 'rgba(232,160,64,.12)');
  ctx.fillStyle = din; ctx.fillRect(130, 58, 100, 104);
  /* 中の気配（カウンターと先客の腰から下） */
  P(ctx, 134, 116, 92, 6, '#6a5038');
  /* 暖簾をくぐる先客＝背中が半分だけ中へ */
  P(ctx, 152, 118, 18, 34, '#4a4a5a');                                 // 腰から下（灰ズボン）
  P(ctx, 152, 150, 8, 10, '#2a2016'); P(ctx, 162, 148, 8, 10, '#2a2016'); // 踏み込む足
  E(161, 104, 11, 7, '#6a4a3a'); P(ctx, 150, 104, 22, 16, '#6a4a3a');  // 上半身は暖簾の陰
  ctx.fillStyle = 'rgba(14,10,8,.55)'; ctx.fillRect(150, 96, 24, 14);  // 頭は暖簾に隠れ影に

  /* 藍の暖簾（4枚・裾が揺れる） */
  P(ctx, 126, 56, 108, 4, '#5a4632');                                  // 暖簾棒
  for (let i = 0; i < 4; i++) {
    const nx = 130 + i * 25, swy = Math.sin(t * 2.1 + i * 1.6) * 2.5;
    const lift = i === 1 ? 10 : 0;                                     // くぐられて1枚だけめくれる
    ctx.fillStyle = '#2a3a58';
    ctx.beginPath();
    ctx.moveTo(nx, 60); ctx.lineTo(nx + 23, 60);
    ctx.lineTo(nx + 23 + swy, 98 - lift); ctx.lineTo(nx + swy, 100 - lift);
    ctx.closePath(); ctx.fill();
    P(ctx, nx, 60, 23, 2, '#3a5078');
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(Math.round(nx + swy) + 2, 88 - lift, 2, 8);           // 裾の陰
  }
  txt('酒', 155, 82, 11, '#e8dcc0'); txt('処', 205, 82, 11, '#e8dcc0');

  /* 赤提灯（入口右・大きく揺れる） */
  const ls = Math.sin(t * 1.7) * 3;
  P(ctx, 250, 50, 1, 10, '#1a1410');
  P(ctx, Math.round(243 + ls), 60, 16, 22, '#d04838'); P(ctx, Math.round(244 + ls), 63, 14, 16, '#e86048');
  P(ctx, Math.round(243 + ls), 59, 16, 2, '#2a2020'); P(ctx, Math.round(243 + ls), 80, 16, 2, '#2a2020');
  ctx.strokeStyle = 'rgba(90,24,16,.5)';
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(244 + ls, 62 + i * 5); ctx.lineTo(258 + ls, 62 + i * 5); ctx.stroke(); }
  vtxt('もつ', 251 + ls, 70, 9, 8, '#ffe8d0');
  ctx.fillStyle = `rgba(255,150,110,${(0.2 + 0.08 * Math.sin(t * 3.8)).toFixed(2)})`;
  ctx.beginPath(); ctx.arc(251 + ls, 71, 16, 0, Math.PI * 2); ctx.fill();

  /* 格子窓（左・中の灯） */
  P(ctx, 44, 66, 66, 54, '#181008');
  P(ctx, 46, 68, 62, 50, 'rgba(255,214,138,.65)');
  ctx.fillStyle = '#241c14';
  for (let i = 1; i < 5; i++) P(ctx, 44 + i * 13, 66, 3, 54, '#241c14');
  P(ctx, 44, 90, 66, 3, '#241c14');
  ctx.fillStyle = 'rgba(40,24,10,.6)'; E(70, 80, 6, 7, 'rgba(40,24,10,.6)');       // 中の人影
  /* 立て看板（緑ネオンの小さな灯） */
  const bl = 0.55 + 0.45 * Math.sin(t * 4.6);
  P(ctx, 292, 108, 30, 52, '#101418'); P(ctx, 291, 107, 32, 1, '#0c0e14');
  ctx.strokeStyle = `rgba(72,168,96,${bl.toFixed(2)})`; ctx.lineWidth = 1; ctx.strokeRect(294.5, 110.5, 25, 47);
  vtxt('炭火', 307, 124, 13, 9, `rgba(120,232,150,${bl.toFixed(2)})`);

  /* 濡れた路面 */
  P(ctx, 0, 162, 360, 38, '#3a3e48');
  P(ctx, 0, 162, 360, 2, '#4a4e58');
  ctx.strokeStyle = 'rgba(20,22,30,.45)';
  for (const y of [172, 184, 196]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); }
  /* 水たまり（看板の色が映る） */
  const puddle = (x, y, rx, ry, col, s) => {
    E(x, y, rx, ry, '#262a34');
    ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
    ctx.globalAlpha = 0.5 + 0.15 * Math.sin(t * 3 + s);
    for (let i = 0; i < 3; i++) {
      const wx = x - rx + ((t * 6 + i * rx) % (rx * 2));
      P(ctx, Math.round(wx), y - ry, 3, ry * 2, col);
    }
    ctx.globalAlpha = 1; ctx.restore();
    ctx.strokeStyle = 'rgba(180,210,240,.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  };
  puddle(84, 180, 26, 5, '#e8a040', 1);                                // 窓灯の橙
  puddle(252, 186, 30, 6, '#d04838', 2);                               // 提灯の赤
  puddle(316, 172, 18, 4, '#48a860', 3);                               // ネオンの緑
  /* 入口の光の帯（土間の灯が路面へ） */
  ctx.fillStyle = 'rgba(232,160,64,.16)';
  ctx.beginPath(); ctx.moveTo(132, 162); ctx.lineTo(228, 162); ctx.lineTo(252, 200); ctx.lineTo(112, 200); ctx.closePath(); ctx.fill();

  /* 軒下の猫（丸くなって尻尾で耳を隠す・呼吸） */
  const br = Math.sin(t * 2.4) * 0.6;
  E(320, 156 - br * 0.5, 11, 6 + br, '#3a3028');
  R(313, 152, 4, '#3a3028');
  ctx.fillStyle = '#3a3028';
  ctx.beginPath(); ctx.moveTo(310, 150); ctx.lineTo(312, 145); ctx.lineTo(314, 150); ctx.closePath(); ctx.fill(); // 耳
  ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(322, 158, 8, Math.PI * 0.2, Math.PI * 0.9); ctx.stroke();  // 巻いた尻尾
  P(ctx, 312, 151, 1, 1, '#e8a040');                                   // 薄目

  /* ── 主人公（暖簾に手をかけた瞬間・やや斜め後ろ） ── */
  const px = 206;
  E(px, 198, 14, 3, 'rgba(0,0,0,.5)');
  P(ctx, px - 7, 172, 6, 24, '#22283a'); P(ctx, px + 2, 174, 6, 22, '#22283a');    // 右足を半歩前へ
  P(ctx, px - 8, 194, 8, 3, '#181a22'); P(ctx, px + 1, 194, 8, 3, '#181a22');
  E(px, 146, 12, 7, '#2a3a58'); P(ctx, px - 12, 146, 24, 28, '#2a3a58');
  P(ctx, px - 12, 145, 24, 1, 'rgba(255,190,120,.5)');
  P(ctx, px + 8, 148, 5, 16, '#243250'); P(ctx, px + 8, 163, 5, 3, '#e8c39a');     // 左腕は下
  /* 右腕＝暖簾の裾へ伸ばす */
  ctx.fillStyle = '#2a3a58';
  ctx.beginPath(); ctx.moveTo(px - 10, 150); ctx.lineTo(px - 26, 112); ctx.lineTo(px - 21, 109); ctx.lineTo(px - 5, 148); ctx.closePath(); ctx.fill();
  P(ctx, px - 27, 105, 5, 5, '#e8c39a');                               // 暖簾裾をつかむ手
  ctx.fillStyle = '#2a3a58';                                           // つかまれてたわむ裾
  ctx.beginPath(); ctx.moveTo(px - 31, 98); ctx.lineTo(px - 20, 98); ctx.lineTo(px - 23, 107); ctx.closePath(); ctx.fill();
  R(px - 2, 136, 7, '#181a20');                                        // 黒短髪（店の方を向く）
  P(ctx, px - 8, 134, 3, 4, '#e8c39a');                                // 左頬がわずかに見える
  P(ctx, px - 5, 142, 6, 4, '#e8c39a');
  E(px - 2, 131, 5, 2, 'rgba(255,190,120,.4)');
}


/* ══════════════════════════════════════════════════════
   ロウリュ街で飲む(4) ── 常連の席（夜）
   ------------------------------------------------------------
   「『いらっしゃい』の前に、もう座る場所が空けてある」
   (2)と同じ店。満席の中に一席だけ空き、大将がおしぼりで指す。
   主人公は入口から歩み寄り、常連の一人が振り向いて手を上げる。
   ══════════════════════════════════════════════════════ */
function y_noge4(ctx) {
  const t = T();
  const h = i => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
  const R = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  const E = (x, y, rx, ry, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); };
  const txt = (s, x, y, size, col) => {
    ctx.font = size + 'px "DotGothic16",sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.textAlign = 'left';
  };
  const vtxt = (s, x, y, step, size, col) => {
    ctx.font = size + 'px "DotGothic16",sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = col;
    for (let i = 0; i < s.length; i++) ctx.fillText(s[i], x, y + i * step);
    ctx.textAlign = 'left';
  };
  const skin = '#e8c39a';

  /* 板壁と店明かり（(2)と同じ店） */
  P(ctx, 0, 0, 360, 200, '#2c2014');
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1;
  for (let x = 0; x < 360; x += 13) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 128); ctx.stroke(); }
  const gl = ctx.createRadialGradient(200, 60, 20, 200, 90, 200);
  gl.addColorStop(0, 'rgba(232,160,64,.22)'); gl.addColorStop(1, 'rgba(232,160,64,0)');
  ctx.fillStyle = gl; ctx.fillRect(0, 0, 360, 200);

  /* 短冊メニュー（同じ壁・同じ癖） */
  const menu = ['もつ煮', '串五本', '酒', 'ハイ', '漬物', '煮込'];
  for (let i = 0; i < 6; i++) {
    const x = 150 + i * 30 + Math.round((h(i + 5) - 0.5) * 6), y = 8 + Math.round(h(i + 15) * 8);
    const hh = 30 + Math.round(h(i + 25) * 14);
    P(ctx, x, y, 16, hh, '#e8dcc0'); P(ctx, x, y, 16, 2, '#a89468');
    P(ctx, x + 15, y, 1, hh, 'rgba(0,0,0,.25)');
    vtxt(menu[i], x + 8, y + 11, 9, 7, '#3a2a18');
  }
  /* 棚と酒瓶 */
  P(ctx, 60, 40, 100, 5, '#4a382a'); P(ctx, 60, 45, 100, 2, 'rgba(0,0,0,.4)');
  for (let i = 0; i < 7; i++) {
    const x = 66 + i * 13, bh = 12 + Math.round(h(i + 35) * 6);
    P(ctx, x, 40 - bh, 7, bh, ['#3a5a3a', '#6a4a2a', '#2a3a58'][i % 3]);
    P(ctx, x + 2, 40 - bh - 4, 3, 4, '#1a1410');
  }
  /* 店内の赤提灯 */
  const sw = Math.sin(t * 1.9) * 2;
  P(ctx, 180, 6, 1, 8, '#1a1410');
  P(ctx, Math.round(175 + sw), 14, 12, 16, '#d04838'); P(ctx, Math.round(176 + sw), 16, 10, 12, '#e86048');
  P(ctx, Math.round(175 + sw), 13, 12, 2, '#2a2020'); P(ctx, Math.round(175 + sw), 29, 12, 2, '#2a2020');
  txt('酒', 181 + sw, 26, 8, '#5a1810');
  ctx.fillStyle = `rgba(255,180,120,${(0.18 + 0.07 * Math.sin(t * 4)).toFixed(2)})`;
  ctx.beginPath(); ctx.arc(181 + sw, 22, 13, 0, Math.PI * 2); ctx.fill();

  /* 入口（左端・藍暖簾の内側から夜がのぞく） */
  P(ctx, 0, 30, 34, 130, '#12141e');                                   // 開いた戸の外＝夜
  for (let i = 0; i < 3; i++) P(ctx, 4 + i * 9, 44 + Math.round(h(i + 55) * 10), 3, 4, '#e8a040'); // 外の路地の灯
  P(ctx, 0, 30, 36, 4, '#5a4632');
  for (let i = 0; i < 2; i++) {                                        // 内から見た暖簾
    const nx = 2 + i * 16, swy = Math.sin(t * 2.2 + i * 2) * 2;
    ctx.fillStyle = '#2a3a58';
    ctx.beginPath(); ctx.moveTo(nx, 34); ctx.lineTo(nx + 14, 34);
    ctx.lineTo(nx + 14 + swy, 66); ctx.lineTo(nx + swy, 68); ctx.closePath(); ctx.fill();
  }
  P(ctx, 34, 30, 3, 130, '#3a2c20');                                   // 戸の柱

  /* 焼き場（今夜も煙） */
  P(ctx, 44, 92, 60, 28, '#3a2c20'); P(ctx, 44, 92, 60, 2, '#5a4630');
  P(ctx, 50, 96, 48, 9, '#181210');
  for (let i = 0; i < 6; i++) {
    const fx = 53 + i * 7, fh = 3 + 3 * Math.abs(Math.sin(t * 7 + i * 1.4));
    P(ctx, fx, Math.round(100 - fh), 3, Math.round(fh + 4), i % 2 ? '#e8a040' : '#d04838');
  }
  P(ctx, 50, 94, 48, 2, '#8a8078');
  wisp(ctx, 60, 86, 3, .28); wisp(ctx, 84, 82, 3, .3);

  /* ── カウンター ── */
  P(ctx, 0, 126, 360, 3, '#a8845a'); P(ctx, 0, 129, 360, 9, '#8a6a44');
  P(ctx, 0, 138, 360, 16, '#6a5038'); P(ctx, 0, 152, 360, 2, '#4a3626');
  E(150, 133, 7, 2.5, '#d8d2c6'); P(ctx, 146, 131, 8, 2, '#a05838');
  P(ctx, 208, 124, 5, 9, '#d8d2c6'); P(ctx, 218, 126, 4, 7, 'rgba(220,235,240,.8)');

  /* ── 空けてある一席（右から二番目・光が当たる） ── */
  const ex = 276;
  const pu = 0.16 + 0.07 * Math.sin(t * 2.6);
  const halo = ctx.createRadialGradient(ex, 140, 4, ex, 140, 34);
  halo.addColorStop(0, `rgba(255,214,138,${pu.toFixed(2)})`); halo.addColorStop(1, 'rgba(255,214,138,0)');
  ctx.fillStyle = halo; ctx.fillRect(ex - 34, 106, 68, 74);
  /* S級審査（8/9）：空席スツールの天面を明るい飴茶#8A5A35に持ち上げ、
     琥珀#D2B07Aのスポットを落とす＝「そこだけ空いている」を視線で即読ませる */
  P(ctx, ex - 7, 160, 14, 4, '#8a5a35');                               // 誰も座っていない丸椅子
  P(ctx, ex - 5, 164, 3, 16, '#2a2016'); P(ctx, ex + 2, 164, 3, 16, '#2a2016');
  P(ctx, ex - 6, 158, 12, 2, '#d2b07a');
  P(ctx, ex - 3, 159, 6, 1, '#e8cc96');
  P(ctx, ex - 9, 122, 18, 6, '#f0ead8'); P(ctx, ex - 9, 122, 18, 2, '#fff');       // 席に置かれた箸と小皿
  P(ctx, ex - 6, 119, 14, 1, '#c8a060'); P(ctx, ex - 6, 121, 14, 1, '#c8a060');

  /* 大将（カウンター越しに身を乗り出し、おしぼりで席を指す） */
  const mx = 232;
  E(mx, 78, 12, 7, '#e8e4da'); P(ctx, mx - 12, 78, 24, 26, '#e8e4da');
  P(ctx, mx - 12, 77, 24, 1, 'rgba(255,214,138,.6)');
  R(mx + 3, 66, 7, skin);                                              // 顔（空席の方へ向く）
  P(ctx, mx - 3, 58, 13, 4, '#4a4038'); P(ctx, mx - 3, 61, 13, 2, '#f0ead8');      // 鉢巻
  P(ctx, mx + 5, 66, 2, 2, '#2a2020'); P(ctx, mx + 9, 68, 3, 1, '#8a5a4a');        // 目と笑い口
  const nod = Math.sin(t * 2.8) * 2;                                   // 「ここ空いてるよ」の腕
  ctx.fillStyle = '#e8e4da';
  ctx.beginPath(); ctx.moveTo(mx + 8, 84); ctx.lineTo(mx + 34, Math.round(104 + nod)); ctx.lineTo(mx + 30, Math.round(109 + nod)); ctx.lineTo(mx + 5, 90); ctx.closePath(); ctx.fill();
  P(ctx, mx + 32, Math.round(105 + nod), 5, 4, skin);                  // 手
  P(ctx, mx + 34, Math.round(108 + nod), 10, 6, '#fff');               // 白いおしぼり
  P(ctx, mx + 34, Math.round(112 + nod), 10, 2, '#d8e4e8');

  /* ── 満席の常連たち（空席の左右をぎっしり埋める） ── */
  const guy = (x, col, hair, pose) => {
    P(ctx, x - 7, 160, 14, 4, '#3a2c20'); P(ctx, x - 5, 164, 3, 16, '#2a2016'); P(ctx, x + 2, 164, 3, 16, '#2a2016');
    let hx = x, hy = 104;
    if (pose === 'laugh') hy = 100;
    if (pose === 'cheek') { hx = x + 4; hy = 107; }
    E(x, 126, 12, 8, col); P(ctx, x - 12, 126, 24, 36, col);
    P(ctx, x - 12, 125, 24, 1, 'rgba(255,190,120,.4)');
    if (pose === 'mug') {
      P(ctx, x + 9, 110, 5, 13, col);
      P(ctx, x + 12, 102, 8, 10, '#e8c050'); P(ctx, x + 12, 100, 8, 3, '#fff8e8');
    } else if (pose === 'cheek') {
      P(ctx, x + 8, 114, 4, 11, col); P(ctx, x + 8, 110, 4, 5, skin);
    } else if (pose === 'laugh') {
      P(ctx, x - 15, 114, 5, 9, col); P(ctx, x + 10, 114, 5, 9, col);
      P(ctx, x - 15, 111, 5, 3, skin); P(ctx, x + 10, 111, 5, 3, skin);
    }
    R(hx, hy, 7, hair); P(ctx, hx - 3, hy + 6, 6, 4, skin);
    E(hx, hy - 5, 5, 2, 'rgba(255,190,120,.3)');
  };
  guy(120, '#6a4a3a', '#2a2420', 'mug');
  guy(158, '#8a5a6a', '#3a3028', 'laugh');
  guy(196, '#5a6b8a', '#2a2420', 'cheek');
  guy(316, '#6a5038', '#4a3a2c', 'mug');                               // 空席の右隣

  /* 振り向いて片手を上げる常連（空席の左隣・白髪） */
  const cx2 = 238;
  P(ctx, cx2 - 7, 160, 14, 4, '#3a2c20');
  P(ctx, cx2 - 5, 164, 3, 16, '#2a2016'); P(ctx, cx2 + 2, 164, 3, 16, '#2a2016');
  E(cx2, 126, 12, 8, '#4a5a44'); P(ctx, cx2 - 12, 126, 24, 36, '#4a5a44');
  P(ctx, cx2 - 12, 125, 24, 1, 'rgba(255,190,120,.4)');
  const wv = Math.sin(t * 5) * 2;                                      // よお、の手
  P(ctx, cx2 - 16, 106, 5, 16, '#4a5a44');
  P(ctx, cx2 - 17, Math.round(100 + wv), 6, 6, skin);
  R(cx2 - 2, 103, 7, '#b8b4ac');                                       // 白髪頭を入口へひねる
  P(ctx, cx2 - 9, 100, 4, 6, skin);                                    // 振り向いた横顔の頬
  P(ctx, cx2 - 9, 102, 1, 1, '#2a2020');                               // こちらを見る目
  P(ctx, cx2 - 10, 105, 3, 1, '#8a5a4a');                              // にっと笑う口

  /* ── 主人公（入口からその席へ・歩みの途中） ── */
  const px = 64;
  E(px, 196, 14, 3, 'rgba(0,0,0,.45)');
  P(ctx, px - 2, 168, 6, 26, '#22283a');                               // 前へ出た右足
  P(ctx, px - 12, 170, 6, 24, '#22283a');                              // 蹴り出す左足
  P(ctx, px - 1, 192, 9, 3, '#181a22'); P(ctx, px - 14, 192, 8, 3, '#181a22');
  E(px - 2, 140, 12, 7, '#2a3a58'); P(ctx, px - 14, 140, 24, 30, '#2a3a58');       // 紺シャツ（右向きの歩き）
  P(ctx, px - 14, 139, 24, 1, 'rgba(255,190,120,.5)');
  P(ctx, px + 6, 144, 5, 14, '#243250'); P(ctx, px + 6, 157, 5, 4, skin);          // 振った右腕（前）
  P(ctx, px - 16, 146, 5, 13, '#2a3a58'); P(ctx, px - 16, 158, 5, 4, skin);        // 左腕（後ろ）
  R(px, 130, 7, '#181a20');                                            // 黒短髪
  P(ctx, px + 4, 128, 4, 7, skin);                                     // 右向きの横顔
  P(ctx, px + 5, 130, 1, 1, '#2a2020');                                // 空席を見る目
  P(ctx, px + 5, 134, 3, 1, '#8a5a4a');                                // ゆるむ口もと
  E(px, 125, 5, 2, 'rgba(255,190,120,.4)');

  /* 店内の煙とけむり、手前の落ち */
  wisp(ctx, 170, 48, 4, .14); wisp(ctx, 260, 44, 4, .12);
  P(ctx, 0, 196, 360, 4, 'rgba(0,0,0,.35)');
}

/* ══════════════════════════════════════════════════════
   y_hospital ── 診察室：働きすぎで倒れて運ばれた日（昼）
   ------------------------------------------------------------
   白衣の医者がカルテに書き込みながら振り返って一言。
   主人公はパイプ椅子で腕まくり、血圧計を巻かれてうつむく。
   空気は深刻すぎず「叱られている」くらい
   ══════════════════════════════════════════════════════ */
function y_hospital(ctx) {
  const t = T();
  const h = i => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
  const SKIN = '#e8c39a';

  /* ── 壁（灰みの白・腰壁で面を分割） ── */
  P(ctx, 0, 0, 360, 138, '#e8ece8');
  P(ctx, 0, 0, 360, 7, '#dde2dd');                      // 天井際の影
  P(ctx, 0, 96, 360, 42, '#dde3d8');                    // 腰壁
  P(ctx, 0, 94, 360, 2, '#c6cec4');                     // 見切り縁
  ctx.strokeStyle = 'rgba(165,176,164,.35)'; ctx.lineWidth = 1;
  for (const wx of [130, 244]) { ctx.beginPath(); ctx.moveTo(wx, 7); ctx.lineTo(wx, 94); ctx.stroke(); }

  /* ── 床（リノリウム） ── */
  P(ctx, 0, 138, 360, 62, '#d8d3c5');
  P(ctx, 0, 138, 360, 3, '#c2bcae');
  ctx.strokeStyle = 'rgba(150,142,126,.20)';
  for (let i = 0; i < 5; i++) { const fy = 150 + i * 12; ctx.beginPath(); ctx.moveTo(0, fy); ctx.lineTo(360, fy); ctx.stroke(); }

  /* ── 窓（昼の光） ── */
  P(ctx, 12, 12, 86, 70, '#b8c0b6');                    // 枠
  P(ctx, 16, 16, 78, 62, '#cfe9f6');                    // 空
  P(ctx, 16, 60, 78, 18, '#e0f0ec');                    // 地平の白
  for (let i = 0; i < 6; i++)                           // 雲（擬似ハッシュ散らし）
    P(ctx, 20 + Math.floor(h(i) * 56), 21 + Math.floor(h(i + 9) * 26),
      9 + Math.floor(h(i + 3) * 9), 3, 'rgba(255,255,255,.85)');
  P(ctx, 53, 16, 3, 62, '#b8c0b6'); P(ctx, 16, 44, 78, 3, '#b8c0b6');
  P(ctx, 10, 82, 90, 4, '#c8cec6');                     // 窓台
  // 日射しが床へ落ちる
  ctx.fillStyle = 'rgba(255,246,210,.15)';
  ctx.beginPath(); ctx.moveTo(18, 84); ctx.lineTo(94, 84);
  ctx.lineTo(140, 182); ctx.lineTo(44, 182); ctx.closePath(); ctx.fill();

  /* ── 壁の小物：時計（午後二時）とポスター ── */
  ctx.fillStyle = '#f4f4f0'; ctx.beginPath(); ctx.arc(215, 30, 9, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8a9088'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(215, 30, 9, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#3a3f3a'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(215, 30); ctx.lineTo(215, 24); ctx.stroke();       // 長針
  ctx.beginPath(); ctx.moveTo(215, 30); ctx.lineTo(220, 33); ctx.stroke();       // 短針
  P(ctx, 108, 30, 18, 24, '#f2f2ee');                   // 掲示ポスター
  P(ctx, 108, 30, 18, 5, '#88b8a0');
  ctx.strokeStyle = 'rgba(140,150,140,.5)'; ctx.strokeRect(108, 30, 18, 24);
  for (let i = 0; i < 4; i++) P(ctx, 111, 38 + i * 4, 12 - (i % 2) * 4, 1, '#b8beb8');

  /* ── 奥のベッド（白いシーツは灰みで面を分ける） ── */
  P(ctx, 264, 134, 88, 4, '#9aa0a6');                   // フレーム
  P(ctx, 266, 138, 4, 18, '#8a9096'); P(ctx, 344, 138, 4, 18, '#8a9096');
  P(ctx, 264, 112, 88, 22, '#f1f1ec');                  // シーツ
  P(ctx, 264, 120, 88, 3, '#dfe2df');                   // 折り目の灰
  P(ctx, 264, 126, 88, 8, '#dce4e8');                   // 掛け布
  P(ctx, 268, 108, 16, 8, '#eef0ee');                   // 枕
  P(ctx, 268, 113, 16, 2, '#d8dcd8');

  /* ── 青いカーテン（レールからT()で揺れる） ── */
  P(ctx, 240, 11, 118, 3, '#98a2a8');                   // レール
  for (let i = 0; i < 6; i++) {
    const cx0 = 300 + i * 9, sw = Math.sin(t * 1.4 + i * 0.9) * 1.6;
    P(ctx, Math.round(cx0 + sw), 14, 9, 130 + Math.floor(h(i + 20) * 6), i % 2 ? '#6a9ab8' : '#5b89a6');
    P(ctx, Math.round(cx0 + sw), 14, 2, 128, 'rgba(255,255,255,.14)');           // 1pxの縁光
    P(ctx, cx0 + 3, 12, 2, 3, '#6a7076');               // フック
  }
  P(ctx, 300, 14, 1, 128, 'rgba(20,40,60,.25)');

  /* ── 観葉植物（窓の下・大きめの鉢） ── */
  P(ctx, 20, 150, 16, 13, '#b07048'); P(ctx, 22, 150, 12, 2, '#8a5438');
  ctx.fillStyle = '#3c6034';
  ctx.beginPath(); ctx.ellipse(28, 140, 9, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4e7842';
  ctx.beginPath(); ctx.ellipse(24, 136, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
  plant(ctx, 36, 148);

  /* ── 机（木・カルテと書類） ── */
  P(ctx, 104, 112, 74, 7, '#b09878');                   // 天板
  P(ctx, 104, 112, 74, 2, '#c8ac88');                   // 縁光
  P(ctx, 104, 119, 74, 3, '#8a7458');
  P(ctx, 108, 122, 5, 42, '#96805f'); P(ctx, 168, 122, 5, 42, '#96805f');
  P(ctx, 106, 100, 15, 12, '#d8d0b4');                  // 書類の束
  P(ctx, 106, 100, 15, 2, '#b85848'); P(ctx, 106, 105, 15, 2, '#5878a0');
  const wr = Math.sin(t * 6) * 1.5;                     // 書く手の揺れ
  P(ctx, 128, 108, 30, 5, '#fbfbf7');                   // カルテ
  P(ctx, 131, 109, 20, 1, '#b8beb8'); P(ctx, 131, 111, 14, 1, '#b8beb8');

  /* ── 医者（カルテに書き込みながら振り返って一言） ── */
  const dx = 196;
  // 丸椅子
  P(ctx, dx - 9, 138, 18, 5, '#8a9096');
  P(ctx, dx - 7, 143, 3, 22, '#70767c'); P(ctx, dx + 4, 143, 3, 22, '#70767c');
  ctx.fillStyle = 'rgba(0,0,0,.10)'; ctx.beginPath(); ctx.ellipse(dx - 4, 166, 20, 4, 0, 0, Math.PI * 2); ctx.fill();
  // 脚（膝をきちんと折る）
  P(ctx, dx - 14, 131, 15, 8, '#7e8894'); P(ctx, dx - 17, 138, 5, 23, '#6b7684'); P(ctx, dx - 21, 161, 10, 4, '#3a3f45');
  P(ctx, dx - 9, 132, 13, 8, '#74808c'); P(ctx, dx - 11, 139, 5, 22, '#606b78'); P(ctx, dx - 15, 161, 10, 4, '#32373d');
  // 白衣の胴（肩は丸く）
  P(ctx, dx - 8, 106, 17, 28, '#f0f0ec');
  ctx.fillStyle = '#f0f0ec'; ctx.beginPath(); ctx.arc(dx, 108, 9, Math.PI, 0); ctx.fill();
  P(ctx, dx - 2, 108, 3, 15, '#5a6b85');                // 前合わせの内シャツ
  P(ctx, dx + 6, 108, 3, 24, '#dcdcd6');                // 白衣の影
  P(ctx, dx - 8, 106, 1, 26, 'rgba(255,255,255,.7)');   // 1pxの縁光
  // 左腕＝机で書く（手が揺れる）
  P(ctx, dx - 18, 110, 11, 7, '#f0f0ec');
  P(ctx, dx - 32, 110, 15, 6, '#eaeae4');
  P(ctx, Math.round(dx - 36 + wr), 108, 6, 5, SKIN);    // 手
  P(ctx, Math.round(dx - 34 + wr), 104, 2, 7, '#3a3f45');                        // ペン
  // 右腕＝振り返って持ち上げる（言い聞かせ）
  const gs = Math.sin(t * 3) * 1.5;
  P(ctx, dx + 7, 110, 6, 11, '#f0f0ec');
  P(ctx, dx + 10, Math.round(98 + gs), 5, 13, '#eaeae4');
  P(ctx, dx + 10, Math.round(93 + gs), 6, 5, SKIN);
  // 首と頭（右へ振り返る・頭は小さく）。
  // S級審査（8/9）：顔を主人公側へ1px寄せ、口元に濃灰#666の短線＝「説明」でなく「小言」
  P(ctx, dx - 2, 100, 6, 5, SKIN);
  ctx.fillStyle = SKIN; ctx.beginPath(); ctx.arc(dx + 2, 92, 7, 0, Math.PI * 2); ctx.fill();
  P(ctx, dx - 6, 84, 11, 6, '#6a6258');                 // 白髪まじりの髪
  P(ctx, dx - 6, 88, 4, 8, '#6a6258');
  P(ctx, dx, 90, 8, 1, '#4a4a4a');                      // 眼鏡のつる
  P(ctx, dx + 4, 89, 3, 3, 'rgba(210,224,230,.9)');     // レンズ
  P(ctx, dx + 5, 90, 2, 2, '#2a2a2a');                  // 目
  P(ctx, dx + 4, 96, 4, 1, '#666666');                  // 結んだ小言の口
  if (Math.sin(t * 5) > 0) P(ctx, dx + 4, 97, 3, 1, '#8a4a3a');                  // 話す口

  /* ── 血圧計のスタンド（白い箱・赤いゴム） ── */
  P(ctx, 224, 122, 3, 42, '#9aa2aa'); P(ctx, 218, 164, 15, 4, '#8a9096');
  P(ctx, 216, 104, 19, 17, '#eceae6'); P(ctx, 216, 104, 19, 2, '#f8f8f4');
  ctx.strokeStyle = '#a8aeb2'; ctx.lineWidth = 1; ctx.strokeRect(216, 104, 19, 17);
  ctx.fillStyle = '#fbfbf7'; ctx.beginPath(); ctx.arc(225, 112, 5, 0, Math.PI * 2); ctx.fill();
  const na = -1.9 + 0.25 * Math.sin(t * 2);             // 針が震える
  ctx.strokeStyle = '#c03828'; ctx.beginPath(); ctx.moveTo(225, 112);
  ctx.lineTo(225 + Math.cos(na) * 4, 112 + Math.sin(na) * 4); ctx.stroke();

  /* ── 主人公（紺シャツ・腕まくり・うつむいて反省） ── */
  const px = 254;
  // パイプ椅子
  P(ctx, px - 10, 134, 21, 5, '#7d858d'); P(ctx, px - 10, 134, 21, 1, '#9aa2aa');
  P(ctx, px - 8, 139, 3, 27, '#6a7178'); P(ctx, px + 7, 139, 3, 27, '#6a7178');
  P(ctx, px + 8, 106, 3, 28, '#7d858d'); P(ctx, px + 4, 106, 6, 13, '#6a7178');
  ctx.fillStyle = 'rgba(0,0,0,.10)'; ctx.beginPath(); ctx.ellipse(px - 2, 167, 20, 4, 0, 0, Math.PI * 2); ctx.fill();
  // 脚（膝を折って前へ）
  P(ctx, px - 17, 130, 17, 9, '#464a54'); P(ctx, px - 19, 138, 5, 24, '#3c404a'); P(ctx, px - 24, 162, 10, 4, '#2a2a2e');
  P(ctx, px - 11, 131, 15, 8, '#50545e'); P(ctx, px - 12, 138, 5, 24, '#444852'); P(ctx, px - 17, 162, 10, 4, '#32323a');
  // 前かがみの胴（紺シャツ・背中を丸める）
  P(ctx, px - 8, 112, 16, 22, '#2e3a5e');
  P(ctx, px - 13, 108, 15, 11, '#2e3a5e');
  ctx.fillStyle = '#2e3a5e'; ctx.beginPath(); ctx.arc(px - 5, 110, 8, Math.PI, 0); ctx.fill();
  P(ctx, px + 3, 114, 4, 18, '#26304e');                // 背の影
  P(ctx, px - 13, 108, 1, 12, 'rgba(200,214,240,.35)'); // 1pxの縁光
  // 左腕＝腕まくりして前へ（血圧計を巻かれる）
  P(ctx, px - 21, 112, 10, 7, '#2e3a5e');               // 袖
  P(ctx, px - 24, 111, 4, 9, '#222c48');                // まくった袖口
  P(ctx, px - 36, 114, 14, 5, SKIN);                    // 素の前腕
  P(ctx, px - 33, 111, 8, 10, '#c84838');               // 血圧計の赤いゴム帯
  P(ctx, px - 33, 111, 8, 2, '#d86048'); P(ctx, px - 33, 119, 8, 2, '#a03428');
  P(ctx, px - 41, 113, 6, 6, SKIN);                     // 膝に置いた手
  ctx.strokeStyle = '#b04838'; ctx.lineWidth = 1;       // ゴム管が計器へ
  ctx.beginPath(); ctx.moveTo(px - 29, 111); ctx.quadraticCurveTo(px - 24, 96, 233, 112); ctx.stroke();
  // 右腕＝腿の上
  P(ctx, px - 2, 116, 5, 14, '#26304e'); P(ctx, px - 4, 129, 5, 4, SKIN);
  // うつむく頭（小さく・目を伏せる）
  ctx.fillStyle = SKIN; ctx.beginPath(); ctx.arc(px - 12, 101, 7, 0, Math.PI * 2); ctx.fill();
  P(ctx, px - 18, 93, 12, 6, '#26221e');                // 黒短髪
  P(ctx, px - 8, 96, 4, 6, '#26221e');
  P(ctx, px - 18, 102, 4, 1, '#3a3026');                // 伏せた目
  P(ctx, px - 17, 106, 3, 1, '#a06a50');                // 結んだ口
  // 反省の汗がひとつぶ落ちる
  const sw2 = (t * 12) % 16;
  if (sw2 < 12) P(ctx, px - 22, Math.round(96 + sw2), 2, 3, 'rgba(160,210,240,.8)');
}

/* ══════════════════════════════════════════════════════
   y_living ── 自宅の居間：夜、帰りを待つ食卓
   ------------------------------------------------------------
   古いアパート。ちゃぶ台に夕飯の湯気、妻が茶を注ぐ。
   主人公の座布団はまだ空。テレビの光がちらつき、窓の外に街の灯
   ══════════════════════════════════════════════════════ */
function y_living(ctx) {
  const t = T();
  const h = i => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
  const SKIN = '#ecc8a0';

  /* ── 壁（夜の電灯に沈む砂壁） ── */
  P(ctx, 0, 0, 360, 122, '#6e5e48');
  P(ctx, 0, 0, 360, 10, '#55483a');                     // 天井の影
  P(ctx, 0, 112, 360, 10, '#5c4e3c');                   // 長押の帯
  for (let i = 0; i < 22; i++)                          // 砂壁の擬似ハッシュ散らし
    P(ctx, Math.floor(h(i) * 356), 14 + Math.floor(h(i + 31) * 92), 2, 1, 'rgba(0,0,0,.08)');
  P(ctx, 100, 10, 6, 112, '#4a3c2c'); P(ctx, 248, 10, 6, 112, '#4a3c2c');       // 柱
  P(ctx, 100, 10, 1, 112, '#5e4e3a'); P(ctx, 248, 10, 1, 112, '#5e4e3a');

  /* ── 窓（夜の街の灯） ── */
  P(ctx, 256, 22, 92, 70, '#4a3a28');                   // 枠
  P(ctx, 260, 26, 84, 62, '#26304a');
  ctx.fillStyle = '#d8dce8'; ctx.beginPath(); ctx.arc(328, 38, 5, 0, Math.PI * 2); ctx.fill();  // 月
  P(ctx, 326, 36, 2, 2, '#b8bcd0');
  for (let i = 0; i < 8; i++) {                         // 対岸のビル影
    const bx = 262 + i * 10, bh = 8 + Math.floor(h(i + 7) * 14);
    P(ctx, bx, 88 - bh, 8, bh, i % 2 ? '#1c2438' : '#202a40');
  }
  for (let i = 0; i < 14; i++) {                        // 街の灯（またたく）
    const al = 0.3 + 0.4 * Math.abs(Math.sin(t * 0.8 + i * 2.1));
    P(ctx, 263 + Math.floor(h(i + 50) * 76), 70 + Math.floor(h(i + 70) * 15), 2, 2,
      `rgba(255,214,138,${al.toFixed(2)})`);
  }
  P(ctx, 300, 26, 3, 62, '#4a3a28'); P(ctx, 260, 56, 84, 2, '#4a3a28');         // 桟
  P(ctx, 254, 24, 9, 66, '#b8764e'); P(ctx, 254, 24, 2, 66, '#cc8a5e');         // 端のカーテン
  P(ctx, 341, 24, 9, 66, '#b8764e'); P(ctx, 347, 24, 2, 66, '#9c6242');

  /* ── 壁の小物：カレンダー ── */
  P(ctx, 158, 30, 26, 32, '#ece8dc');
  P(ctx, 158, 30, 26, 7, '#c85848'); P(ctx, 169, 26, 3, 5, '#8a7a62');
  ctx.strokeStyle = 'rgba(120,116,104,.5)'; ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(158, 37 + i * 6); ctx.lineTo(184, 37 + i * 6); ctx.stroke(); }
  ctx.strokeStyle = '#c03828'; ctx.beginPath(); ctx.arc(176, 47, 3, 0, Math.PI * 2); ctx.stroke();  // 給料日に丸

  /* ── 電灯（暖色・笠つき） ── */
  P(ctx, 176, 10, 2, 12, '#3a3226');
  ctx.fillStyle = '#e8c878';
  ctx.beginPath(); ctx.moveTo(165, 34); ctx.lineTo(171, 22); ctx.lineTo(183, 22); ctx.lineTo(189, 34); ctx.closePath(); ctx.fill();
  P(ctx, 165, 33, 24, 2, '#d8b060');
  P(ctx, 173, 35, 8, 4, '#f8ecc0');                     // 玉
  const lp = 0.10 + 0.02 * Math.sin(t * 1.2);
  ctx.fillStyle = `rgba(232,200,120,${lp.toFixed(3)})`;
  ctx.beginPath(); ctx.arc(177, 44, 62, 0, Math.PI * 2); ctx.fill();

  /* ── 畳（縁布で面を分割） ── */
  P(ctx, 0, 122, 120, 78, '#a89858'); P(ctx, 120, 122, 120, 78, '#a08f50'); P(ctx, 240, 122, 120, 78, '#a89858');
  ctx.strokeStyle = 'rgba(70,62,30,.10)'; ctx.lineWidth = 1;
  for (let fy = 128; fy < 200; fy += 5) { ctx.beginPath(); ctx.moveTo(0, fy); ctx.lineTo(360, fy); ctx.stroke(); }
  P(ctx, 118, 122, 5, 78, '#4a5340'); P(ctx, 238, 122, 5, 78, '#4a5340');       // 畳の縁
  P(ctx, 119, 122, 1, 78, '#5e6850'); P(ctx, 239, 122, 1, 78, '#5e6850');
  P(ctx, 0, 122, 360, 2, '#8a7a44');

  /* ── テレビ（ブラウン管・光がちらつく） ── */
  ctx.fillStyle = 'rgba(184,216,232,.10)';              // 画面の光が畳へ
  ctx.beginPath(); ctx.moveTo(30, 130); ctx.lineTo(84, 130); ctx.lineTo(104, 186); ctx.lineTo(14, 186); ctx.closePath(); ctx.fill();
  P(ctx, 22, 134, 70, 8, '#5a4634'); P(ctx, 26, 142, 5, 22, '#4a3a2a'); P(ctx, 82, 142, 5, 22, '#4a3a2a');
  P(ctx, 20, 82, 74, 52, '#3c3c40'); P(ctx, 20, 82, 74, 2, '#54545a'); P(ctx, 20, 82, 1, 52, '#54545a');
  ctx.strokeStyle = '#8a8a90'; ctx.lineWidth = 1;       // アンテナ
  ctx.beginPath(); ctx.moveTo(52, 82); ctx.lineTo(40, 66); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(52, 82); ctx.lineTo(66, 64); ctx.stroke();
  const fl = 0.68 + 0.18 * Math.sin(t * 11) + 0.10 * Math.sin(t * 23 + 1.7);
  P(ctx, 26, 88, 48, 38, `rgba(184,216,232,${fl.toFixed(3)})`);                 // 画面
  P(ctx, 30, 112, 40, 10, `rgba(90,130,160,${(fl * 0.7).toFixed(3)})`);         // 映像の暗部
  P(ctx, 34, 94, 18, 7, `rgba(240,250,255,${(fl * 0.8).toFixed(3)})`);
  P(ctx, 26, 88 + Math.floor((t * 26) % 38), 48, 2, 'rgba(255,255,255,.16)');   // 走査線
  P(ctx, 78, 90, 12, 34, '#2e2e32');                    // つまみ盤
  ctx.fillStyle = '#8a8a90';
  ctx.beginPath(); ctx.arc(84, 96, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(84, 106, 3, 0, Math.PI * 2); ctx.fill();
  P(ctx, 81, 116, 7, 2, '#6a6a70');

  /* ── ちゃぶ台と夕飯 ── */
  ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.beginPath(); ctx.ellipse(200, 174, 62, 6, 0, 0, Math.PI * 2); ctx.fill();
  P(ctx, 150, 146, 5, 26, '#6e5238'); P(ctx, 244, 146, 5, 26, '#6e5238');       // 折り脚
  P(ctx, 142, 138, 116, 9, '#8a6848');
  ctx.fillStyle = '#8a6848';
  ctx.beginPath(); ctx.arc(142, 142.5, 4.5, Math.PI / 2, Math.PI * 1.5); ctx.fill();
  ctx.beginPath(); ctx.arc(258, 142.5, 4.5, -Math.PI / 2, Math.PI / 2); ctx.fill();
  P(ctx, 142, 138, 116, 2, '#9c7a56');                  // 天板の縁光
  // ごはんと味噌汁（湯気）
  P(ctx, 172, 131, 12, 7, '#ece8e2'); P(ctx, 173, 129, 10, 3, '#f8f6f0'); P(ctx, 172, 136, 12, 2, '#c8c4ba');
  P(ctx, 190, 131, 12, 7, '#4a2e22'); P(ctx, 191, 130, 10, 2, '#6a4432'); P(ctx, 190, 136, 12, 2, '#341f16');
  wisp(ctx, 173, 127, 2, .40); wisp(ctx, 191, 126, 2, .45);
  // 焼き魚の皿
  P(ctx, 208, 133, 24, 5, '#d8d8d0'); P(ctx, 208, 136, 24, 2, '#b8b8b0');
  P(ctx, 211, 130, 17, 4, '#8a7a5a'); P(ctx, 225, 129, 4, 3, '#6e6248');
  // 主人の席の箸と茶碗。**起きている**（イントロ壁打ち3往復＝この絵は
  // 「帰りを待つ」でなく「二人でノートを開く夜」に読み替えた。伏せ茶碗は不在の記号なので起こす）
  P(ctx, 236, 131, 10, 6, '#ece8e2'); P(ctx, 237, 130, 8, 1, '#c8c2b8');   // 口が上
  P(ctx, 238, 132, 6, 2, '#e0d8c8');
  P(ctx, 240, 128, 14, 1, '#8a5a34'); P(ctx, 241, 130, 14, 1, '#8a5a34');
  /* 畳の上・ちゃぶ台の脇に、サウナ開拓ノート三冊（背表紙の色違い＝台本「三冊目」の絵回収） */
  P(ctx, 252, 158, 22, 5, '#4a6a8a'); P(ctx, 252, 158, 22, 1, '#6a8aaa');   // 一冊目（藍）
  P(ctx, 254, 152, 22, 5, '#7a5a3a'); P(ctx, 254, 152, 22, 1, '#9a7a52');   // 二冊目（茶）
  P(ctx, 253, 146, 22, 5, '#8a4a44'); P(ctx, 253, 146, 22, 1, '#aa6a5c');   // 三冊目（えんじ）
  P(ctx, 258, 147, 2, 15, 'rgba(255,255,255,.25)');                          // 背ラベルの気配
  // 注がれる湯呑み
  P(ctx, 158, 131, 9, 7, '#d8d0c0'); P(ctx, 158, 131, 9, 1, '#e8e0d0'); P(ctx, 158, 136, 9, 2, '#b0a890');

  /* ── 妻（茶髪を後ろで結ぶ・暖色の服・茶を注ぐ） ── */
  const mx = 112;
  ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.ellipse(mx + 4, 174, 18, 4, 0, 0, Math.PI * 2); ctx.fill();
  // 正座の腰まわり（スカート）
  ctx.fillStyle = '#a85838';
  ctx.beginPath(); ctx.ellipse(mx + 3, 162, 15, 12, 0, 0, Math.PI * 2); ctx.fill();
  P(ctx, mx - 12, 158, 30, 14, '#a85838');
  P(ctx, mx - 12, 170, 30, 3, '#8a4630');
  P(ctx, mx + 12, 166, 6, 5, SKIN);                     // 折った足先
  // 胴（暖色の上着・肩は丸く・少し前へ）
  P(ctx, mx - 7, 128, 17, 32, '#d87848');
  ctx.fillStyle = '#d87848'; ctx.beginPath(); ctx.arc(mx + 1, 130, 9, Math.PI, 0); ctx.fill();
  P(ctx, mx + 6, 132, 4, 26, '#c05e38');                // 影
  P(ctx, mx - 7, 128, 1, 30, 'rgba(255,220,180,.4)');   // 1pxの縁光
  // 右腕＝急須を差し出す
  P(ctx, mx + 8, 130, 14, 6, '#d87848');
  P(ctx, mx + 20, 128, 12, 5, SKIN);
  P(ctx, mx + 30, 124, 6, 6, SKIN);                     // 急須を持つ手
  // 左腕＝蓋を押さえる
  P(ctx, mx + 6, 122, 13, 5, '#c86838');
  P(ctx, mx + 18, 119, 5, 4, SKIN);
  // 急須（傾けて注ぐ）
  P(ctx, mx + 26, 116, 15, 10, '#7a5a3c'); P(ctx, mx + 26, 116, 15, 2, '#8e6c48');
  P(ctx, mx + 40, 121, 6, 4, '#7a5a3c'); P(ctx, mx + 44, 124, 3, 3, '#6a4c30'); // 注ぎ口
  P(ctx, mx + 31, 113, 5, 3, '#5e4228');                // 蓋
  ctx.strokeStyle = '#5e4228'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(mx + 27, 118, 5, Math.PI * 0.8, Math.PI * 1.6); ctx.stroke();          // 持ち手
  // お茶が落ちる（アニメ）
  for (let i = 0; i < 3; i++) {
    const dy = (t * 22 + i * 4) % 8;
    P(ctx, 161, Math.round(124 + dy), 2, 3, 'rgba(206,172,80,.85)');
  }
  P(ctx, 160, 132, 5, 2, 'rgba(226,196,110,.9)');       // 湯面
  wisp(ctx, 159, 128, 1, .35);
  // 頭（茶髪を後ろで結ぶ・顔は右＝空いた席のほうへ）
  P(ctx, mx - 1, 118, 6, 5, SKIN);
  ctx.fillStyle = SKIN; ctx.beginPath(); ctx.arc(mx + 2, 110, 7, 0, Math.PI * 2); ctx.fill();
  P(ctx, mx - 5, 102, 12, 6, '#8a5a34');                // 前髪
  P(ctx, mx - 6, 106, 4, 8, '#8a5a34');
  ctx.fillStyle = '#7a4c2c'; ctx.beginPath(); ctx.arc(mx - 7, 112, 4, 0, Math.PI * 2); ctx.fill();  // 後ろの結び
  P(ctx, mx + 5, 109, 2, 2, '#3a2c20');                 // 目
  P(ctx, mx + 6, 114, 3, 1, '#b0684a');                 // 口もと
  P(ctx, mx + 7, 111, 2, 2, 'rgba(224,140,120,.5)');    // 頬

  /* ── 主人公の席＝空の座布団 ── */
  P(ctx, 272, 156, 32, 13, '#b06848');
  ctx.fillStyle = '#b06848';
  ctx.beginPath(); ctx.arc(272, 162.5, 6.5, Math.PI / 2, Math.PI * 1.5); ctx.fill();
  ctx.beginPath(); ctx.arc(304, 162.5, 6.5, -Math.PI / 2, Math.PI / 2); ctx.fill();
  P(ctx, 272, 156, 32, 2, '#c47c58');
  P(ctx, 286, 161, 3, 3, '#7e4530');                    // 綴じ糸
  P(ctx, 270, 167, 36, 3, 'rgba(0,0,0,.12)');

  /* ── 畳の上の営業のチラシ ── */
  P(ctx, 316, 176, 20, 12, '#eee9dc');
  P(ctx, 316, 176, 20, 3, '#c85848');
  P(ctx, 319, 182, 14, 1, '#a8a498'); P(ctx, 319, 185, 10, 1, '#a8a498');
  P(ctx, 334, 174, 12, 9, '#e2ddd0');                   // 重なったもう一枚
  P(ctx, 336, 177, 8, 1, '#aca89c');
}

  /* ============================================================
     エンディング用の描き下ろし4枚（#47）
     使い先: ending_y.js（真=帰り道・番台・風呂／傘下・廃業=番台／人気店=朝の行列）
     ============================================================ */
  /* ══════════════════════════════════════════════════════
     y_bandai_night ── 閉店後の番台（ED共用）
     ------------------------------------------------------------
     誰もいない店。妻が番台に座り、帳面を付けている。
     吊り電球の光だまりがひとつ。光の外は青い影。
     左の壁に四十枠の靴箱、木の下足札——**中央寄りのひと枠だけ空**。
     真EDでは「最後の客を待つ」、廃業EDでは「最後の札」に読める。
     パレット：木の茶2・電球色・藍影2・のれん藍・札の生成り・肌
     ══════════════════════════════════════════════════════ */
  function y_bandai_night(ctx) {
    const t = T();
    const hs = i => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    const SKIN = '#ecc8a0';

    /* ── 壁（夜の藍に沈む板壁） ── */
    P(ctx, 0, 0, 360, 132, '#232c40');
    P(ctx, 0, 0, 360, 10, '#181f30');                    // 天井の影
    ctx.strokeStyle = 'rgba(10,14,26,.45)'; ctx.lineWidth = 1;
    for (let x = 0; x < 360; x += 24) { ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x, 132); ctx.stroke(); }
    P(ctx, 0, 124, 360, 8, '#1c2436');                   // 幅木

    /* ── 床（木の板張り・夜色） ── */
    P(ctx, 0, 132, 360, 68, '#4a3a2a');
    ctx.strokeStyle = 'rgba(20,14,8,.4)'; ctx.lineWidth = 1;
    for (let fy = 140; fy < 200; fy += 9) { ctx.beginPath(); ctx.moveTo(0, fy); ctx.lineTo(360, fy); ctx.stroke(); }
    for (let i = 0; i < 12; i++)                         // 板の継ぎ目（擬似ハッシュ）
      P(ctx, Math.floor(hs(i) * 350), 140 + Math.floor(hs(i + 17) * 6) * 9, 1, 8, 'rgba(20,14,8,.35)');
    P(ctx, 0, 132, 360, 2, '#5e4a34');

    /* ── 左の壁：靴箱（8×5＝四十枠） ── */
    const BX = 14, BY = 26, CW = 14, CH = 15;
    P(ctx, BX - 4, BY - 6, CW * 8 + 8, CH * 5 + 12, '#5e4630');   // 外枠
    P(ctx, BX - 4, BY - 6, CW * 8 + 8, 2, '#8a6848');
    for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) {
      const x = BX + c * CW, y = BY + r * CH;
      P(ctx, x, y, CW - 2, CH - 2, '#161c2c');           // 枠の口（夜の影）
      P(ctx, x, y, CW - 2, 1, '#0e1220');
      if (r === 2 && c === 4) {                          // **ひと枠だけ空**
        /* 空き枠の中を一段暗く落とし、「抜け」として読ませる（S級審査の処方箋 8/9） */
        P(ctx, x + 1, y + 1, CW - 4, CH - 4, '#1a2130');
        P(ctx, x + 2, y + 2, CW - 6, CH - 6, '#0c101c');
        continue;
      }
      P(ctx, x + 3, y + 3, 7, 9, '#e8e1c8');             // 木の下足札（審査で1段明るく）
      P(ctx, x + 3, y + 3, 7, 1, '#f4ecd8');
      P(ctx, x + 5, y + 5, 3, 1, 'rgba(94,70,48,.55)');  // 札の焼き番号の気配
      P(ctx, x + 3, y + 11, 7, 1, '#b8a880');
    }
    P(ctx, BX - 4, BY + CH * 5 + 4, CW * 8 + 8, 2, '#3a2c1e');            // 台輪

    /* ── のれん（藍・しまい忘れの気配で少し揺れる） ── */
    P(ctx, 300, 12, 52, 6, '#5e4630');                   // 竿
    for (let i = 0; i < 4; i++) {
      const sw = Math.sin(t * 0.9 + i * 1.4) * 1.5;
      P(ctx, Math.round(302 + i * 13 + sw), 18, 10, 46, i % 2 ? '#26375c' : '#2c3e66');
      P(ctx, Math.round(302 + i * 13 + sw), 18, 10, 3, '#1c2c4c');
    }
    P(ctx, 310, 30, 30, 8, 'rgba(232,220,192,.16)');     // 白抜きの「ゆ」の気配
    wisp(ctx, 316, 66, 2, .10);                          // 奥からうっすら湯気の匂い

    /* ── 吊り電球（ひとつ）と光だまり ── */
    P(ctx, 251, 0, 2, 22, '#181f30');                    // コード
    P(ctx, 246, 22, 12, 5, '#3a2c1e');                   // ソケット笠
    P(ctx, 248, 27, 8, 8, '#ffd98a');                    // 玉
    P(ctx, 249, 28, 3, 3, '#fff2cc');
    const lp = 0.13 + 0.02 * Math.sin(t * 1.4);
    const gl = ctx.createRadialGradient(252, 34, 6, 252, 34, 96);
    gl.addColorStop(0, `rgba(255,217,138,${(lp + 0.14).toFixed(3)})`);
    gl.addColorStop(0.55, `rgba(255,217,138,${lp.toFixed(3)})`);
    gl.addColorStop(1, 'rgba(255,217,138,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(252, 34, 96, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,217,138,.06)';             // 床の光だまり
    ctx.beginPath(); ctx.ellipse(252, 168, 78, 20, 0, 0, Math.PI * 2); ctx.fill();

    /* ── 番台（木・正面やや右） ── */
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath(); ctx.ellipse(252, 184, 56, 7, 0, 0, Math.PI * 2); ctx.fill();
    P(ctx, 212, 108, 80, 74, '#5e4630');                 // 胴（縦板）
    ctx.strokeStyle = 'rgba(30,20,12,.4)'; ctx.lineWidth = 1;
    for (let x = 220; x < 292; x += 10) { ctx.beginPath(); ctx.moveTo(x, 112); ctx.lineTo(x, 180); ctx.stroke(); }
    P(ctx, 206, 102, 92, 8, '#8a6848');                  // 天板
    P(ctx, 206, 102, 92, 2, '#a8845c');
    P(ctx, 206, 96, 4, 8, '#8a6848'); P(ctx, 294, 96, 4, 8, '#8a6848');   // 両袖の立て
    P(ctx, 200, 92, 12, 5, '#5e4630'); P(ctx, 292, 92, 12, 5, '#5e4630'); // 袖笠
    P(ctx, 212, 176, 80, 6, '#3a2c1e');                  // 台輪

    /* 天板の上：開いた帳面と算盤 */
    P(ctx, 224, 96, 26, 8, '#e8dcc0');                   // 帳面（開き）
    P(ctx, 236, 96, 1, 8, '#b8a880');                    // 綴じ目
    P(ctx, 226, 98, 8, 1, 'rgba(60,50,36,.6)'); P(ctx, 226, 101, 8, 1, 'rgba(60,50,36,.6)');
    P(ctx, 239, 98, 8, 1, 'rgba(60,50,36,.6)'); P(ctx, 239, 101, 8, 1, 'rgba(60,50,36,.45)');
    P(ctx, 256, 98, 18, 6, '#3a2c1e');                   // 算盤
    for (let i = 0; i < 5; i++) P(ctx, 258 + i * 3, 100, 2, 2, '#e8dcc0');

    /* ── 妻（番台に座る・帳面へ手） ── */
    const mx = 258;
    P(ctx, mx - 9, 74, 20, 26, '#5a6b8a');               // 胴（藍鼠の上着）
    ctx.fillStyle = '#5a6b8a'; ctx.beginPath(); ctx.arc(mx + 1, 76, 10, Math.PI, 0); ctx.fill();  // 丸い肩
    P(ctx, mx + 6, 78, 4, 20, '#46557a');                // 影側
    P(ctx, mx - 9, 74, 1, 24, 'rgba(255,220,180,.35)');  // 縁光
    // 左腕＝帳面へ（筆を持つ）
    P(ctx, mx - 8, 84, 6, 12, '#5a6b8a');
    P(ctx, mx - 12, 94, 6, 5, SKIN);
    P(ctx, mx - 14, 90, 2, 7, '#3a2c1e');                // 筆
    // 右腕＝帳面を押さえる
    P(ctx, mx + 6, 86, 5, 11, '#46557a');
    P(ctx, mx + 5, 96, 6, 4, SKIN);
    // 頭（小さく・帳面へ少しうつむく）
    P(ctx, mx - 3, 64, 7, 6, SKIN);                      // 首
    ctx.fillStyle = SKIN; ctx.beginPath(); ctx.arc(mx, 56, 8, 0, Math.PI * 2); ctx.fill();
    P(ctx, mx - 8, 47, 15, 6, '#3b2d24');                // 前髪
    P(ctx, mx - 9, 51, 4, 8, '#3b2d24');
    ctx.fillStyle = '#2e231c'; ctx.beginPath(); ctx.arc(mx + 8, 58, 4, 0, Math.PI * 2); ctx.fill(); // 後ろの結び
    P(ctx, mx - 5, 58, 2, 2, '#3a2c20');                 // 伏せ目（左向き＝帳面へ）
    P(ctx, mx - 4, 62, 3, 1, '#b0684a');                 // 口もと

    /* ── 手前の影（がらんどうの箱の暗さ） ── */
    const vg = ctx.createLinearGradient(0, 132, 0, 200);
    vg.addColorStop(0, 'rgba(12,16,30,0)'); vg.addColorStop(1, 'rgba(12,16,30,.5)');
    ctx.fillStyle = vg; ctx.fillRect(0, 132, 360, 68);
    P(ctx, 0, 0, 70, 200, 'rgba(12,16,30,.18)');         // 光の届かない左端
  }


  /* ══════════════════════════════════════════════════════
     y_my_bath_night ── 客のいない夜の風呂（真EDの最終場面）
     ------------------------------------------------------------
     湯を張った。客のいない風呂に、二人で入った。
     肩まで沈む。湯気の向こうで妻が笑っている。
     「明日も、開けよう」——照明は落とし、電球色の反射が湯面に一筋。
     パレット：湯の緑白・タイル青白2・木の茶・電球色・肌・髪・影
     ══════════════════════════════════════════════════════ */
  function y_my_bath_night(ctx) {
    const t = T();
    const hs = i => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    const SKIN = '#ecc8a0';

    /* ── タイル壁（夜の青白・照明は落とし気味） ── */
    P(ctx, 0, 0, 360, 96, '#8ea6b4');
    ctx.strokeStyle = 'rgba(58,84,100,.35)'; ctx.lineWidth = 1;
    for (let y = 8; y < 96; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); }
    for (let x = 0; x < 360; x += 14) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 96); ctx.stroke(); }
    for (let i = 0; i < 16; i++)                         // 濃淡タイルの散らし
      P(ctx, Math.floor(hs(i) * 25) * 14 + 1, 8 + Math.floor(hs(i + 23) * 7) * 12 + 1, 13, 11, 'rgba(184,204,212,.30)');
    /* うちの店らしい素朴な壁＝富士山でなく、一本の帯 */
    P(ctx, 0, 34, 360, 12, '#4a7086');
    P(ctx, 0, 34, 360, 2, '#3a5a6e'); P(ctx, 0, 44, 360, 2, '#3a5a6e');
    P(ctx, 0, 92, 360, 4, '#6e8a9a');                    // 壁の根元の帯

    /* ── 落とした照明（吊り電球ひとつ・上端） ── */
    P(ctx, 179, 0, 2, 8, '#22303a');
    P(ctx, 175, 8, 10, 4, '#3a2c1e');
    P(ctx, 176, 12, 8, 7, '#ffd98a'); P(ctx, 178, 13, 3, 3, '#fff2cc');
    const lp = 0.10 + 0.02 * Math.sin(t * 1.2);
    const gl = ctx.createRadialGradient(180, 16, 6, 180, 16, 110);
    gl.addColorStop(0, `rgba(255,217,138,${(lp + 0.10).toFixed(3)})`);
    gl.addColorStop(1, 'rgba(255,217,138,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(180, 16, 110, 0, Math.PI * 2); ctx.fill();

    /* ── 湯船（正面・画面いっぱい） ── */
    P(ctx, 8, 96, 344, 10, '#8a6848');                   // 木の縁
    P(ctx, 8, 96, 344, 2, '#a8845c');
    P(ctx, 8, 104, 344, 2, '#5e4630');
    P(ctx, 0, 106, 360, 94, '#22303a');                  // 槽の外
    P(ctx, 14, 106, 332, 82, '#cfe4d8');                 // 湯（緑がかった白）
    P(ctx, 14, 106, 332, 4, '#e2f0e8');                  // 湯面の明るみ
    ripple(ctx, 20, 118, 320, 'rgba(255,255,255,.30)');
    ripple(ctx, 20, 146, 320, 'rgba(160,190,178,.35)');
    ripple(ctx, 20, 170, 320, 'rgba(160,190,178,.25)');
    /* 電球色の反射が湯面に一筋 */
    for (let i = 0; i < 7; i++) {
      const sw = Math.sin(t * 2 + i * 1.7) * 2;
      P(ctx, Math.round(176 + sw), 110 + i * 11, 8 - (i > 4 ? 2 : 0), 4,
        `rgba(255,217,138,${(0.30 - i * 0.035).toFixed(3)})`);
    }
    P(ctx, 14, 184, 332, 4, '#9cb4a8');                  // 槽底の影

    /* ── 桶がひとつ、縁に置いてある ── */
    P(ctx, 46, 86, 22, 11, '#8a6848');
    P(ctx, 46, 86, 22, 2, '#a8845c');
    P(ctx, 46, 90, 22, 2, '#5e4630');                    // タガ
    P(ctx, 48, 84, 18, 2, '#3a2c1e');                    // 口の影

    /* ── 夫婦（肩まで沈む・中央にひと組だけ） ── */
    // 湯の中の体はゆらぎとして（沈んでいる証拠）
    ctx.fillStyle = 'rgba(214,190,160,.28)';
    ctx.beginPath(); ctx.ellipse(162, 138, 13, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(197, 139, 12, 16, 0, 0, Math.PI * 2); ctx.fill();
    const bob1 = Math.sin(t * 0.9) * 1.2, bob2 = Math.sin(t * 0.9 + 1.1) * 1.2;
    /* 夫（左・黒髪）——妻のほうを向く */
    { const y0 = 104 + bob1;
      P(ctx, 155, y0 + 12, 15, 4, SKIN);                 // 湯面に出た肩先
      ctx.fillStyle = SKIN; ctx.beginPath(); ctx.arc(162, y0, 8, 0, Math.PI * 2); ctx.fill();
      P(ctx, 154, y0 - 9, 16, 6, '#3b2d24');             // 短い髪
      P(ctx, 153, y0 - 5, 4, 6, '#3b2d24'); P(ctx, 167, y0 - 5, 3, 4, '#3b2d24');
      P(ctx, 158, y0 + 8, 12, 3, 'rgba(255,255,255,.5)');// 首まわりの湯面
      P(ctx, 165, y0 - 1, 2, 2, '#3a2c20');              // 目（右＝妻へ）
      P(ctx, 165, y0 + 4, 3, 1, '#b0684a');              // 口
      P(ctx, 156, y0 - 12, 10, 3, '#e8dcc0');            // 頭に載せた畳んだ手拭い（夫だけ）
      P(ctx, 156, y0 - 12, 10, 1, '#f4ecd8');
    }
    /* 妻（右・結び髪）——笑っている */
    { const y0 = 106 + bob2;
      P(ctx, 191, y0 + 11, 13, 4, SKIN);
      ctx.fillStyle = SKIN; ctx.beginPath(); ctx.arc(197, y0, 7.5, 0, Math.PI * 2); ctx.fill();
      P(ctx, 190, y0 - 9, 14, 6, '#8a5a34');             // 前髪（茶）
      P(ctx, 203, y0 - 5, 4, 7, '#8a5a34');
      ctx.fillStyle = '#7a4c2c'; ctx.beginPath(); ctx.arc(205, y0 - 8, 4, 0, Math.PI * 2); ctx.fill(); // 上げた結び
      P(ctx, 192, y0 - 1, 2, 1, '#3a2c20');              // 笑い目（左＝夫へ・細く）
      P(ctx, 191, y0 + 3, 4, 1, '#b0684a');              // 笑う口
      P(ctx, 191, y0 + 4, 2, 1, '#b0684a');
      P(ctx, 190, y0 + 1, 2, 2, 'rgba(224,140,120,.55)');// 頬
      P(ctx, 193, y0 + 7, 11, 3, 'rgba(255,255,255,.5)');
    }
    /* 二人のあいだの湯面〜胸元に、電球の暖色をひと塊（S級審査の処方箋 8/9）
       ＝「並んだ二人」でなく「同じ湯の中のひと塊」に見せる */
    ctx.fillStyle = 'rgba(230,215,168,.15)';
    ctx.beginPath(); ctx.ellipse(180, 114, 22, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(230,215,168,.09)';
    ctx.beginPath(); ctx.ellipse(180, 120, 34, 16, 0, 0, Math.PI * 2); ctx.fill();
    ripple(ctx, 146, 124, 70, 'rgba(255,255,255,.45)');   // 二人の周りのさざ波

    /* ── 湯気を主役級に（ゆっくり・幾重にも） ── */
    wisp(ctx, 40, 112, 4, .30);
    wisp(ctx, 120, 104, 5, .40);
    wisp(ctx, 176, 96, 5, .46);
    wisp(ctx, 236, 106, 5, .38);
    wisp(ctx, 300, 114, 4, .28);
    for (let i = 0; i < 5; i++) {                        // 大きくたなびく層
      const rise = (t * 3.5 + i * 9) % 46, sway = Math.sin(t * 0.7 + i * 2.2) * 8;
      ctx.fillStyle = `rgba(255,255,255,${(0.13 * (1 - rise / 46)).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(70 + i * 58 + sway, 96 - rise, 26, 8, 0, 0, Math.PI * 2); ctx.fill();
    }

    /* ── 夜の浴室の暗さ（四隅を沈める） ── */
    const vg = ctx.createLinearGradient(0, 96, 0, 200);
    vg.addColorStop(0, 'rgba(16,26,32,0)'); vg.addColorStop(1, 'rgba(16,26,32,.42)');
    ctx.fillStyle = vg; ctx.fillRect(0, 96, 360, 104);
    P(ctx, 0, 0, 46, 200, 'rgba(16,26,32,.20)');
    P(ctx, 314, 0, 46, 200, 'rgba(16,26,32,.20)');
  }

  /* ══════════════════════════════════════════════════════
     エンディング ── 開店前の行列（人気店ED・朝）
     ------------------------------------------------------------
     台本「翌朝。開店前の店の前に列ができていた。ひとりが下足札を
     目の高さに掲げて見せる——俺の風呂は、ここだ」。
     主役＝自店1階の入口。シャッターが半分開いた瞬間。のれんはまだ無い。
     仕込みは中央に一組＝先頭近くの常連が掲げる木の下足札
     ══════════════════════════════════════════════════════ */
  function y_my_front_morning(ctx) {
    const t = T();

    /* 朝の空（白青。左の低い朝日） */
    const sky = ctx.createLinearGradient(0, 0, 0, 150);
    sky.addColorStop(0, '#cfe0ea'); sky.addColorStop(1, '#e8ecdf');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 360, 200);
    ctx.fillStyle = 'rgba(255,233,176,.55)';
    ctx.beginPath(); ctx.arc(18, 96, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,233,176,.22)';
    ctx.beginPath(); ctx.arc(18, 96, 58, 0, Math.PI * 2); ctx.fill();
    /* 朝の鳥（二羽だけ・等間隔にしない） */
    ctx.strokeStyle = 'rgba(70,84,110,.6)'; ctx.lineWidth = 1;
    for (const [bx, by] of [[236, 26], [268, 38]]) {
      const f = Math.sin(t * 6 + bx) * 2;
      ctx.beginPath(); ctx.moveTo(bx - 4, by - f); ctx.lineTo(bx, by); ctx.lineTo(bx + 4, by - f); ctx.stroke();
    }

    /* ── 主役：自店の1階正面（ビル全体は描かない。2階は窓の下端だけ）──
       **外観図（art_y.js の yDrawGuide）と同じビル**に見せる（作者指定 8/9）：
       外壁 #4a4038（タイル）／階境スラブ #3a3229／1階5連窓の中央が入口／
       窓は枠 #2a231c＋横1本サッシ・朝はガラス色 #cfe0ea／右面に陰。
       **屋号の看板は掲げない**＝店名はユーザーが決めるもの（作者指定 8/9） */
    const X = 26, W = 172, GROUND = 148;
    /* 2階の窓下端（上に続いている気配だけ）＝外観図と同じ窓割り */
    P(ctx, X - 6, 0, W + 12, 30, '#4a4038');
    for (let i = 0; i < 4; i++) {
      P(ctx, X + 8 + i * 42, 0, 30, 20, '#cfe0ea');                // 朝のガラス色
      P(ctx, X + 8 + i * 42, 16, 30, 2, 'rgba(255,233,176,.5)');   // 窓に朝日
      ctx.strokeStyle = '#2a231c'; ctx.lineWidth = 2;
      ctx.strokeRect(X + 8 + i * 42, -2, 30, 22);
    }
    P(ctx, X - 6, 30, W + 12, 8, '#3a3229');                        // 階境のスラブ
    /* 1階の外壁（タイル貼り） */
    P(ctx, X - 6, 38, W + 12, GROUND - 38, '#4a4038');
    ctx.strokeStyle = 'rgba(20,14,8,.22)'; ctx.lineWidth = 1;
    for (let y = 50; y < GROUND; y += 12) { ctx.beginPath(); ctx.moveTo(X - 6, y); ctx.lineTo(X + W + 6, y); ctx.stroke(); }
    for (let x = X; x < X + W; x += 16) { ctx.beginPath(); ctx.moveTo(x, 38); ctx.lineTo(x, GROUND); ctx.stroke(); }
    P(ctx, X + W - 8, 0, 14, GROUND, 'rgba(0,0,0,.18)');            // 右面の陰（外観図と同じ）
    /* 1階の窓＝入口の左右に1つずつ（外観図の「中央だけ窓なし」の窓割り） */
    for (const wx of [X + 8, X + W - 38]) {
      P(ctx, wx, 52, 30, 40, '#cfe0ea');
      P(ctx, wx, 52, 30, 3, 'rgba(255,233,176,.45)');
      ctx.strokeStyle = '#2a231c'; ctx.lineWidth = 2; ctx.strokeRect(wx, 52, 30, 40);
      ctx.strokeStyle = 'rgba(30,24,18,.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(wx, 72); ctx.lineTo(wx + 30, 72); ctx.stroke();   // 横1本サッシ
    }
    /* 庇（入口の上・朝日で上面だけ暖色） */
    P(ctx, X + 40, 62, 92, 8, '#3a322a');
    P(ctx, X + 40, 62, 92, 2, '#ffe9b0');
    P(ctx, X + 40, 70, 92, 2, '#241d17');
    /* 入口の枠と、半分開いたシャッター（奥に外観図と同じ青ガラスの自動ドア） */
    const EX = X + 44, EW = 84, ETOP = 74;
    P(ctx, EX - 4, ETOP - 2, EW + 8, GROUND - ETOP + 2, '#3a322a');
    P(ctx, EX, ETOP, EW, GROUND - ETOP, '#241e18');                 // 奥はまだ暗い
    /* 奥の自動ドア（青ガラス・閉。開店前） */
    P(ctx, EX + 24, ETOP + 18, 36, GROUND - ETOP - 18, '#8fc3d8');
    P(ctx, EX + 24, ETOP + 18, 36, 4, '#b8dcea');                   // 朝空の反射
    P(ctx, EX + 41, ETOP + 18, 2, GROUND - ETOP - 18, '#5a8296');   // 合わせ目
    ctx.strokeStyle = '#2a3a44'; ctx.lineWidth = 2;
    ctx.strokeRect(EX + 24, ETOP + 18, 36, GROUND - ETOP - 18);
    P(ctx, EX + 8, GROUND - 26, 10, 26, 'rgba(255,206,130,.30)');   // 奥の脱衣所の灯りが漏れる
    /* 下足札棚の気配（開いた下半分の奥に木の格子） */
    ctx.strokeStyle = 'rgba(160,130,90,.35)'; ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(EX + 26 + i * 8, GROUND - 20); ctx.lineTo(EX + 26 + i * 8, GROUND - 2); ctx.stroke(); }
    const sh = ETOP + 34 + Math.round(Math.sin(t * 2.2) * 2);        // 半開のシャッター（少し動く）
    P(ctx, EX, ETOP, EW, sh - ETOP, '#c9ced4');
    ctx.strokeStyle = 'rgba(90,100,110,.55)';
    for (let y = ETOP + 4; y < sh - 2; y += 5) { ctx.beginPath(); ctx.moveTo(EX, y); ctx.lineTo(EX + EW, y); ctx.stroke(); }
    P(ctx, EX, sh - 3, EW, 3, '#8f959e');                            // 座板
    P(ctx, EX + EW / 2 - 5, sh - 1, 10, 2, '#5a6470');               // 取っ手

    /* 歩道（朝日で暖かい） */
    P(ctx, 0, GROUND, 360, 52, '#a8a49a');
    P(ctx, 0, GROUND, 360, 3, '#8a867c');
    ctx.strokeStyle = 'rgba(120,116,106,.5)'; ctx.lineWidth = 1;
    for (let x = 14; x < 360; x += 34) { ctx.beginPath(); ctx.moveTo(x, GROUND + 3); ctx.lineTo(x + 10, 200); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,233,176,.16)';
    P(ctx, 0, GROUND, 360, 52, 'rgba(255,233,176,.10)');

    /* 朝日の長い影（左から光→右へ伸びる）。人の前に敷く */
    const shadow = (px, gy, len) => {
      ctx.fillStyle = 'rgba(46,56,92,.22)';
      ctx.beginPath();
      ctx.moveTo(px, gy); ctx.lineTo(px + 6, gy);
      ctx.lineTo(px + 6 + len, gy + 7); ctx.lineTo(px + len, gy + 7);
      ctx.closePath(); ctx.fill();
    };

    /* 人（姿勢つき。列は間隔も姿勢も崩す） */
    const guy = (px, gy, col, pose) => {
      shadow(px, gy, 26);
      const hy = gy - 16;                                            // 頭のy
      if (pose === 'bow') {                                          // 頭を下げかけ
        P(ctx, px, gy - 11, 6, 11, col);
        P(ctx, px + 3, hy + 3, 5, 4, '#e8c39a'); P(ctx, px + 3, hy + 2, 5, 2, '#3b2d24');
      } else if (pose === 'arms') {                                  // 腕組み
        P(ctx, px, gy - 12, 6, 12, col);
        P(ctx, px - 1, gy - 9, 8, 3, col);
        P(ctx, px + 1, hy, 5, 4, '#e8c39a'); P(ctx, px + 1, hy - 1, 5, 2, '#3b2d24');
      } else if (pose === 'paper') {                                 // 新聞
        P(ctx, px, gy - 12, 6, 12, col);
        P(ctx, px - 3, gy - 10, 7, 5, '#eee8da');
        ctx.strokeStyle = 'rgba(90,90,90,.6)'; ctx.beginPath();
        ctx.moveTo(px - 2, gy - 8); ctx.lineTo(px + 3, gy - 8); ctx.stroke();
        P(ctx, px + 1, hy + 1, 5, 4, '#e8c39a'); P(ctx, px + 1, hy, 5, 2, '#555a60');
      } else if (pose === 'stretch') {                               // 伸び
        P(ctx, px, gy - 13, 6, 13, col);
        P(ctx, px - 2, gy - 17, 2, 5, col); P(ctx, px + 6, gy - 18, 2, 6, col);
        P(ctx, px + 1, hy - 2, 5, 4, '#e8c39a'); P(ctx, px + 1, hy - 3, 5, 2, '#3b2d24');
      } else {                                                       // ポケットに手
        P(ctx, px, gy - 12, 6, 12, col);
        P(ctx, px - 1, gy - 6, 2, 3, col); P(ctx, px + 5, gy - 6, 2, 3, col);
        P(ctx, px + 1, hy, 5, 4, '#e8c39a'); P(ctx, px + 1, hy - 1, 5, 2, '#6a6258');
      }
    };

    /* ── 中央の仕込み（一組だけ）＝下足札を目の高さに掲げる常連（列の先頭） ── */
    const FX = 170, FY = GROUND + 16;
    shadow(FX, FY, 30);
    P(ctx, FX, FY - 13, 7, 13, '#7a5a4a');                           // 茶の上着
    P(ctx, FX + 6, FY - 12, 2, 4, '#7a5a4a');                        // 掲げる腕
    P(ctx, FX + 8, FY - 15, 2, 4, '#e8c39a');
    P(ctx, FX + 1, FY - 17, 5, 4, '#e8c39a'); P(ctx, FX + 1, FY - 18, 5, 2, '#3b2d24');
    /* 木の下足札＝この絵の物語の主役。顔の高さより上へ・一回り大きく・木肌を明るく
       （S級審査の処方箋 8/9。ここが読めれば「行列」が「通い続ける常連」になる） */
    P(ctx, FX + 8, FY - 24, 9, 11, '#d8b07c');
    P(ctx, FX + 8, FY - 24, 9, 1, '#ecd0a0');
    ctx.strokeStyle = '#8b633e'; ctx.lineWidth = 1;
    ctx.strokeRect(FX + 8.5, FY - 23.5, 8, 10);
    P(ctx, FX + 10, FY - 20, 5, 1, 'rgba(94,70,48,.6)');             // 焼き番号の気配
    /* 紐穴＋吊り紐＝「手持ちの看板」でなく「下足札」の記号（S級審査2回目の処方箋） */
    P(ctx, FX + 12, FY - 23, 1, 1, '#5e432b');                       // 紐穴
    P(ctx, FX + 12, FY - 26, 1, 3, '#6b4a2e');                       // 吊り紐
    P(ctx, FX + 11, FY - 27, 1, 2, '#6b4a2e');

    /* 行列（先頭＝札の常連から右手前へ**一列**。
       高さは単調に下げる＝遠近の列に読ませる。間隔と姿勢だけ崩す） */
    guy(196, GROUND + 18, '#5a6b8a', 'arms');
    guy(218, GROUND + 20, '#4a6a58', 'paper');
    guy(244, GROUND + 23, '#8a6a4a', 'bow');
    guy(266, GROUND + 25, '#5a6b8a', 'pocket');
    guy(292, GROUND + 28, '#6a5a70', 'stretch');
    guy(322, GROUND + 31, '#4a6a58', 'pocket');

    /* 妻＝シャッターを上げている（入口の左端・両手を座板に） */
    const WX = EX + 4, WY = GROUND + 10;
    shadow(WX, WY, 22);
    P(ctx, WX, WY - 12, 6, 12, '#a05a62');                           // えんじの上っ張り
    P(ctx, WX + 1, WY - 24 - (sh - ETOP - 34), 2, 12, '#a05a62');    // 上へ伸ばした腕
    P(ctx, WX + 4, WY - 24 - (sh - ETOP - 34), 2, 12, '#a05a62');
    P(ctx, WX + 1, WY - 16, 5, 4, '#e8c39a'); P(ctx, WX + 1, WY - 17, 5, 2, '#3b2d24');
    P(ctx, WX + 1, WY - 26 - (sh - ETOP - 34), 5, 2, '#e8c39a');     // 座板を掴む手
  }

  /* ══════════════════════════════════════════════════════
     エンディング ── 夜の帰り道（真ED・場面1）
     ------------------------------------------------------------
     台本「祝賀の声を断って、二人で歩いて帰った。優勝旗が、
     街灯の下で揺れた。優勝旗は妻が持った。持たせてくれなかった」。
     主役＝奥へ伸びる夜の歩道。二人の後ろ姿が中央。旗は妻の肩に
     ══════════════════════════════════════════════════════ */
  function y_night_road(ctx) {
    const t = T();

    /* 夜空と星 */
    const sky = ctx.createLinearGradient(0, 0, 0, 130);
    sky.addColorStop(0, '#0e1428'); sky.addColorStop(1, '#1a2440');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 360, 200);
    for (let i = 0; i < 30; i++) {
      const h = Math.sin(i * 12.9898) * 43758.5453, h2 = Math.sin(i * 78.233) * 12345.678;
      P(ctx, Math.floor((h - Math.floor(h)) * 360), Math.floor((h2 - Math.floor(h2)) * 58), 1, 1,
        `rgba(255,244,224,${(0.14 + 0.26 * Math.abs(Math.sin(t * 0.7 + i))).toFixed(2)})`);
    }

    /* ビルのシルエット（両側。道の奥は空ける） */
    for (let i = 0; i < 16; i++) {
      const h = Math.sin(i * 34.789) * 43758.5453;
      const bx = i * 24 + Math.floor((h - Math.floor(h)) * 8);
      if (bx > 130 && bx < 226) continue;                            // 道の抜け
      const bh = 26 + ((i * 47) % 38);
      P(ctx, bx, 122 - bh, 20, bh, i % 2 ? '#141a30' : '#181f38');
      for (let r = 0; r < 3; r++)
        if (((i * 7 + r * 5) % 6) < 1) P(ctx, bx + 4 + (r % 2) * 9, 122 - bh + 5 + r * 9, 3, 3, 'rgba(255,214,150,.30)');
    }

    /* 右奥＝熱波銀座の提灯の灯（小さなオレンジの点列。祝賀は続いている） */
    for (let i = 0; i < 8; i++) {
      const h = Math.sin(i * 55.331) * 43758.5453;
      const gx = 236 + i * 13 + Math.floor((h - Math.floor(h)) * 4);
      const gy = 104 + ((i * 3) % 5);
      P(ctx, gx, gy, 2, 3, `rgba(255,154,76,${(0.5 + 0.2 * Math.sin(t * 1.4 + i)).toFixed(2)})`);
    }
    /* 光の膜は弱く小さく（強いと「浮いた円盤」に見える＝目視 8/9） */
    ctx.fillStyle = 'rgba(255,154,76,.04)';
    ctx.beginPath(); ctx.ellipse(288, 107, 38, 7, 0, 0, Math.PI * 2); ctx.fill();

    /* 奥へ伸びる歩道（正面〜やや斜め・消失点は右奥） */
    P(ctx, 0, 122, 360, 78, '#2e3138');
    ctx.fillStyle = '#3a3e46';
    ctx.beginPath();
    ctx.moveTo(40, 200); ctx.lineTo(196, 122); ctx.lineTo(232, 122); ctx.lineTo(360, 200);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(20,22,28,.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(40, 200); ctx.lineTo(196, 122); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(360, 200); ctx.lineTo(232, 122); ctx.stroke();
    /* 敷石の横線（奥ほど詰まる） */
    ctx.strokeStyle = 'rgba(20,22,28,.45)'; ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const yy = 200 - 78 * (1 - Math.pow(0.72, i + 1)) / (1 - Math.pow(0.72, 8));
      const k = (yy - 122) / 78;
      ctx.beginPath(); ctx.moveTo(196 - 156 * k + 156 * (1 - k) * 0, yy); // 左端
      ctx.moveTo(196 + (40 - 196) * k, yy); ctx.lineTo(232 + (360 - 232) * k, yy); ctx.stroke();
    }

    /* 街灯（手前・中・奥の三本。等間隔にしない） */
    const lamp = (lx, top, gy, s) => {
      P(ctx, lx, top, 2 * s, gy - top, '#181c26');
      P(ctx, lx - 3 * s, top, 5 * s, 2 * s, '#181c26');
      const gl = 0.85 + 0.1 * Math.sin(t * 1.6 + lx);
      P(ctx, lx - 3 * s, top + 2 * s, 3 * s, 3 * s, `rgba(255,226,160,${gl.toFixed(2)})`);
      ctx.fillStyle = `rgba(255,226,160,${(0.10 * gl).toFixed(2)})`;
      ctx.beginPath();
      ctx.moveTo(lx - 2 * s, top + 3 * s);
      ctx.lineTo(lx - 14 * s, gy + 4); ctx.lineTo(lx + 10 * s, gy + 4);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(255,226,160,${(0.12 * gl).toFixed(2)})`;
      ctx.beginPath(); ctx.ellipse(lx - 2 * s, gy + 4, 15 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();
    };
    lamp(300, 128, 133, 1);                                          // 奥（小）
    lamp(64, 58, 186, 2);                                            // 手前（大）
    lamp(214, 96, 152, 1.4);                                         // 中＝二人の頭上

    /* ── 中央の一組：二人の後ろ姿（妻が優勝旗を担ぐ・夫は手ぶら）── */
    const GY = 170;                                                  // 接地
    ctx.fillStyle = 'rgba(10,12,18,.5)';
    ctx.beginPath(); ctx.ellipse(197, GY + 2, 20, 4, 0, 0, Math.PI * 2); ctx.fill();

    /* 優勝旗（妻の肩から斜め上へ。街灯の下でゆっくり揺れる）
       ＝二人の塊は中央の街灯の**光だまりの芯**（x≈196〜204）に立たせる
       （S級審査の処方箋 8/9。半歩ずれると「帰り道の一場面」に、芯に入ると「凱旋」になる） */
    const sway = Math.sin(t * 1.1) * 2.4;
    const PX = 188, PY = GY - 22;                                    // 妻の肩
    ctx.strokeStyle = '#7a6244'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(PX + 4, PY + 2); ctx.lineTo(PX - 8, PY - 26); ctx.stroke();
    P(ctx, PX - 10, PY - 30, 4, 4, '#e8c04a');                       // 金の頭
    ctx.fillStyle = '#c8323c';                                       // 旗（赤）
    ctx.beginPath();
    ctx.moveTo(PX - 8, PY - 26); ctx.lineTo(PX + 12, PY - 22 + sway * 0.4);
    ctx.lineTo(PX + 11, PY - 8 + sway); ctx.lineTo(PX - 5, PY - 12 + sway * 0.6);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f5ead8';                                       // 白の房
    for (let i = 0; i < 5; i++) {
      const fx = PX - 5 + i * 4, fy = PY - 12 + sway * (0.6 + i * 0.1) + i * 1;
      P(ctx, Math.round(fx), Math.round(fy), 2, 3, '#f5ead8');
    }
    P(ctx, PX + 2, PY - 18 + Math.round(sway * 0.5), 6, 4, '#e8c04a'); // 旗の金の紋

    /* 妻（左・旗の竿を両手で。担いで歩く後ろ姿） */
    P(ctx, PX - 1, GY - 6, 3, 6, '#4a3a44'); P(ctx, PX + 4, GY - 6, 3, 6, '#4a3a44');
    P(ctx, PX - 2, GY - 20, 10, 14, '#8a4a56');                      // えんじの上着
    P(ctx, PX + 3, PY + 1, 3, 4, '#e8c39a');                         // 竿を握る手
    P(ctx, PX, GY - 26, 7, 6, '#3b2d24');                            // 後ろ髪（顔は見えない）
    P(ctx, PX + 1, GY - 21, 5, 2, '#e8c39a');                        // うなじ

    /* 夫（右・少しだけ後ろ・手ぶら。距離は近い） */
    const HX = 202;
    P(ctx, HX, GY - 7, 3, 7, '#2e3644'); P(ctx, HX + 5, GY - 7, 3, 7, '#2e3644');
    P(ctx, HX - 1, GY - 22, 10, 15, '#5a6b8a');                      // 上着
    P(ctx, HX - 2, GY - 16, 2, 6, '#5a6b8a'); P(ctx, HX + 9, GY - 16, 2, 6, '#5a6b8a'); // 下げた腕
    P(ctx, HX + 1, GY - 28, 7, 6, '#3b2d24');
    P(ctx, HX + 2, GY - 23, 5, 2, '#e8c39a');

    /* 手前の縁石で画面を締める */
    P(ctx, 0, 194, 360, 6, '#22252c');
  }

  /* ── 登録（story.js の StoryArt に足す）──
     方針転換（作者決定 2026-08-09）：**五名館の絵はコードのドット絵で完結させる。**
     横浜編時代の生成画像（assets/story/*.webp）も、横浜編時代のコード絵
     （館内図タイプ・y_lumina_bath_in など）も使わない。
     CODE_FINAL に入れたキーは STORY_IMG を張らない＝webp があっても出ない。
     残りのキーは描き下ろしが済むまで暫定で webp が出る（施設ごとに移行）      */
  const AREA_ARTS = {
    y_tenku_out,
    y_rakuen_out, y_rakuen_sauna, y_rakuen_beads, y_rakuen_terrace,
    y_hama_out, y_hama_sauna, y_hama_rest,
    y_fukurai_out, y_fukurai_sauna,
    // ── 月白（描き下ろし済み・CODE_FINAL）──
    y_lumina_out, y_lumina_bath, y_lumina_sauna, y_lumina_roten,
    y_lumina_sauna_im, y_lumina_rest, y_lumina_meshi, y_lumina_cafe,
    // ── 以下は横浜編時代の絵。**描き下ろし次第、順に置き換える** ──
    y_tenku_bath, y_tenku_meshi, y_tenku_rest, y_tenku_capsule, y_tenku_sauna_in,
    y_rakuen_bath, y_rakuen_meshi, y_rakuen_rest,
    y_hama_bath, y_hama_capsule,
    y_fukurai_1f, y_fukurai_2f,
    y_five_town,
    // ── お出かけ先（描き下ろし済み・CODE_FINAL）──
    y_date_yamashita, y_date_motomachi, y_date_akarenga, y_date_chuka1, y_date_chuka2, y_date_chuka3, y_date_chuka4, y_date_chuka5, y_date_chuka6,
    y_date_minato1, y_date_minato2, y_intro_minato, y_kai_marinard, y_kai_isezaki1, y_kai_isezaki2, y_kai_mall1, y_kai_mall2,
    y_noge1, y_noge2, y_noge3, y_noge4, y_hospital, y_living,
    // ── エンディング4枚（描き下ろし済み・CODE_FINAL）──
    y_bandai_night, y_my_bath_night, y_my_front_morning, y_night_road,
  };
  /* コードの絵が完成した施設のキー。webp を張らない */
  const CODE_FINAL = new Set([
    'y_tenku_out', 'y_tenku_bath', 'y_tenku_meshi', 'y_tenku_rest', 'y_tenku_capsule',
    'y_rakuen_out', 'y_rakuen_bath', 'y_rakuen_sauna', 'y_rakuen_meshi',
    'y_rakuen_beads', 'y_rakuen_rest', 'y_rakuen_terrace',
    'y_hama_out', 'y_hama_bath', 'y_hama_sauna', 'y_hama_rest', 'y_hama_capsule',
    'y_fukurai_out', 'y_fukurai_1f', 'y_fukurai_sauna', 'y_fukurai_2f',
    'y_tenku_sauna_in', 'y_five_town',
    'y_lumina_out', 'y_lumina_bath', 'y_lumina_sauna', 'y_lumina_roten',
    'y_lumina_sauna_im', 'y_lumina_rest', 'y_lumina_meshi', 'y_lumina_cafe',
      // ── お出かけ先24枚 ──
    'y_date_yamashita', 'y_date_motomachi', 'y_date_akarenga', 'y_date_chuka1', 'y_date_chuka2', 'y_date_chuka3',
    'y_date_chuka4', 'y_date_chuka5', 'y_date_chuka6', 'y_date_minato1', 'y_date_minato2', 'y_intro_minato',
    'y_kai_marinard', 'y_kai_isezaki1', 'y_kai_isezaki2', 'y_kai_mall1', 'y_kai_mall2', 'y_noge1',
    'y_noge2', 'y_noge3', 'y_noge4', 'y_hospital', 'y_living',
    // ── エンディング4枚 ──
    'y_bandai_night', 'y_my_bath_night', 'y_my_front_morning', 'y_night_road',
  ]);
  if (typeof StoryArt !== 'undefined') Object.assign(StoryArt, AREA_ARTS);
  // 湯気・水面・月・送風機を動かす（動く一枚絵）
  if (typeof STORY_ANIM_ARTS !== 'undefined') {
    for (const k of Object.keys(AREA_ARTS)) STORY_ANIM_ARTS.add(k);
  }

  /* 描き下ろしが済んでいないキーだけ、暫定で画像が出る */
  if (typeof STORY_IMG !== 'undefined') {
    const IMG_ONLY = [
    ];
    for (const k of Object.keys(AREA_ARTS).concat(IMG_ONLY)) {
      if (CODE_FINAL.has(k)) { delete STORY_IMG[k]; continue; }
      STORY_IMG[k] = 'assets/story/' + k + '.webp';
    }
  }
})();
