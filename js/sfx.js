'use strict';
/* ============ 効果音 ============
   絵と同じで、音のファイルは1つも持たない。全部その場で合成する（＝配信サイズが増えない）。
   狙いは昭和のゲーム機の音。きれいな音より、短くて痩せた音のほうが手ざわりに合う。
     ピッ      … メニュー・ボタンを押した
     ピピピピ  … セリフが1文字ずつ出ている間
     チャリーン… 売上（金が入った）
     バコーン  … 出費（金が出ていった）
   ブラウザは「客が触る前」に音を出させてくれないので、最初の操作で目を覚ます。 */
const Sfx = {
  HIT: 'button, .shop-item, .ad-item, .chip, .tab',   // 「押せるもの」＝ピッと鳴る相手
  KEY: 'orenoSauna_sfx',
  MUS_KEY: 'orenoSauna_bgm',
  ctx: null,
  on: true,
  music: true,
  cur: null,                                  // 再生中の曲（BGMは効果音と別に入り切りできる）
  last: {},                                   // 種類ごとの直近再生時刻（連打で音が団子にならないように）

  init() {
    this.on = localStorage.getItem(this.KEY) !== 'off';
    this.music = localStorage.getItem(this.MUS_KEY) !== 'off';
    // 最初のタップ・クリック・キーで音の準備をする（自動再生はどのブラウザでも止められている）
    const wake = () => this.ready();
    for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, wake, { capture: true });
    /* 押せるものは、どこを押しても「ピッ」。個々の場所に書いて回ると必ず付け忘れが出るので、
        1か所で拾う。カタログの行（.shop-item）と広告の行（.ad-item）はボタン要素ではないので、
        ここに並べておく＝押せる見た目のものを足したら、この行に足すだけでいい */
    document.addEventListener('pointerdown', e => {
      if (e.target.closest && e.target.closest(Sfx.HIT)) this.play('ui');
    }, { capture: true });
  },
  toggle() {
    this.on = !this.on;
    localStorage.setItem(this.KEY, this.on ? 'on' : 'off');
    if (this.on) this.play('ui'); else this.engine(false);   // 切った瞬間にエンジンも黙らせる
    return this.on;
  },
  /* BGMの入り切りは効果音とは別にする。
     「音は出したいが、曲は繰り返すとうるさい」という人が必ずいるので */
  toggleMusic() {
    this.music = !this.music;
    localStorage.setItem(this.MUS_KEY, this.music ? 'on' : 'off');
    if (this.music) { if (this.bgmWant) this.bgm_(this.bgmWant); } else this.bgmStop(true);
    return this.music;
  },
  ready() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  },

  /* 単音。type=波形／f0→f1=周波数の動き／dur=長さ／vol=音量 */
  tone(type, f0, f1, dur, vol, delay) {
    const c = this.ctx; if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);      // 立ち上がりだけ速く
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },
  /* ざらついた一撃（バコーンの芯）。短い雑音を作って鳴らす */
  noise(dur, vol, delay) {
    const c = this.ctx; if (!c) return;
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);   // 後ろへ向かって減衰
    const src = c.createBufferSource(); src.buffer = buf;
    const g = c.createGain(); g.gain.value = vol;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    src.connect(lp); lp.connect(g); g.connect(c.destination);
    src.start(c.currentTime + (delay || 0));
  },
  /* 金属質な一撃（レジのガッチャーンに使う）。上の noise の帯域ちがい＝高いところだけ残す */
  clank(dur, vol, freq, delay) {
    const c = this.ctx; if (!c) return;
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const src = c.createBufferSource(); src.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 1.6;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(bp); bp.connect(g); g.connect(c.destination);
    src.start(c.currentTime + (delay || 0));
  },

  /* ---- エンジン音（ブオーン）----
     単発ではなく鳴りっぱなしの音なので、他の効果音とは別あつかい。
     ベンツが走っているあいだだけ on にして、停まったら off。
     ノコギリ波2本をわざと少しずらして唸らせ、低いところだけ残すとディーゼルらしくなる */
  engine(on) {
    if (on && !this.on) return;                 // 効果音オフ
    const c = on ? this.ready() : this.ctx; if (!c) return;
    if (on) {
      if (this.eng) return;                     // すでに鳴っている
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 0.25);   // 遠くから近づく感じで立ち上げる
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
      const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 61;
      const o2 = c.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 64.5;  // 3.5Hzの唸り＝アイドリングのむら
      const sub = c.createOscillator(); sub.type = 'square'; sub.frequency.value = 30.5;
      const sg = c.createGain(); sg.gain.value = 0.35;
      o1.connect(lp); o2.connect(lp); sub.connect(sg); sg.connect(lp);
      lp.connect(g); g.connect(c.destination);
      o1.start(); o2.start(); sub.start();
      this.eng = { g, nodes: [o1, o2, sub] };
    } else {
      const e = this.eng; if (!e) return;
      this.eng = null;
      const t = c.currentTime;
      e.g.gain.cancelScheduledValues(t);
      e.g.gain.setValueAtTime(Math.max(e.g.gain.value, 0.0001), t);
      e.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);            // ぷつっと切らずに落とす
      for (const n of e.nodes) n.stop(t + 0.35);
    }
  },

  /* ---- BGM ----
     曲のファイルも持たない。音符を文字で書いておいて、その場で鳴らす（＝譜面はただの文字列）。
     鳴らし方は効果音と同じで、違うのは「先の音符を前もって予約しておく」ところだけ。
     画面の描画に合わせて鳴らすと、処理が詰まった瞬間にリズムがよれるので、
     0.2秒先までの音符をタイマーで予約し続ける（音の時刻はブラウザの音時計が守ってくれる）。

     譜面の書き方：8分音符ごとに1マス。`C5`=その音を鳴らす／`-`=前の音をのばす／`.`=休み。
     音階は【ヨナ抜き長音階】（ドレミソラ＝ファとシを抜く）＝昭和の歌謡曲や童謡の音階で、
     暖簾をくぐる銭湯の空気にいちばん近い。 */
  bgm(name) {
    this.bgmWant = name;                       // 曲を切っていても「いま何をかけたいか」は覚えておく
    if (!this.music) return;                   // 効果音とは独立（片方だけ鳴らせる）
    this.bgm_(name);
  },
  bgm_(name) {
    const song = SONGS[name]; if (!song) return;
    if (this.cur && this.cur.name === name) return;
    const c = this.ready(); if (!c) return;
    this.bgmStop(true);
    if (!song.parsed) {                        // 譜面を「音符と長さ」に開くのは初回だけ
      song.parsed = {};
      for (const part of ['mel', 'bass']) song.parsed[part] = parseNotes(song[part]);
      song.steps = song[ 'mel' ].trim().split(/\s+/).length;
    }
    const g = c.createGain(); g.gain.value = 1; g.connect(c.destination);
    this.cur = { name, song, out: g, step: 0, at: c.currentTime + 0.12 };
    this.cur.timer = setInterval(() => this.pump(), 30);
    this.pump();
  },
  bgmStop(hard) {
    const b = this.cur; if (!b) return;
    if (!hard) this.bgmWant = null;
    clearInterval(b.timer);
    const c = this.ctx, t = c.currentTime;
    b.out.gain.setValueAtTime(b.out.gain.value, t);
    b.out.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);   // ぶつ切りにせず消える
    setTimeout(() => { try { b.out.disconnect(); } catch (e) {} }, 600);
    this.cur = null;
  },
  /* 0.2秒先までの音符を予約する。タイマーが多少ぶれても、音のほうはぶれない */
  pump() {
    const b = this.cur, c = this.ctx; if (!b || !c) return;
    const s = b.song, stepDur = 30 / s.bpm;                       // 8分音符1マスぶんの秒数
    // タブが裏に回るとタイマーが間引かれて予約が遅れる。戻ってきた時に
    // 溜まった音符をまとめて鳴らさないよう、遅れていたら現在時刻に置き直す
    if (b.at < c.currentTime) b.at = c.currentTime + 0.05;
    while (b.at < c.currentTime + 0.2) {
      const i = b.step % s.steps;
      const mel = s.parsed.mel[i], bass = s.parsed.bass[i];
      const v = s.vol ?? 1;                                       // 曲ごとの音量（夜の曲は小さく）
      if (mel) this.note(s.wave || 'triangle', mel.f, b.at, Math.max(mel.len * stepDur * 0.92, 0.12), 0.055 * v, 2600);
      if (bass) this.note('square', bass.f, b.at, Math.max(bass.len * stepDur * 0.9, 0.12), 0.032 * v, 420);
      const d = s.drum[i % s.drum.length];
      if (d === 'k') this.tone2(b.at);                            // ドン
      else if (d === 'h') this.hat(b.at);                         // チッ
      b.at += stepDur; b.step++;
    }
  },
  /* BGM用の1音（効果音の tone とほぼ同じだが、鳴らす時刻を自分で決められる＋音色を丸める） */
  note(type, freq, t0, dur, vol, lp) {
    const c = this.ctx; if (!c || !this.cur) return;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);          // やわらかく立ち上げる
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let tail = g;
    if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; g.connect(f); tail = f; }
    o.connect(g); tail.connect(this.cur.out);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },
  hat(t0) {                                                       // チッ（雑音をほんの一瞬）
    const c = this.ctx; if (!c || !this.cur) return;
    const n = Math.floor(c.sampleRate * 0.03);
    const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const src = c.createBufferSource(); src.buffer = buf;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
    const g = c.createGain(); g.gain.value = 0.05;
    src.connect(hp); hp.connect(g); g.connect(this.cur.out);
    src.start(t0);
  },
  tone2(t0) {                                                     // ドンの胴鳴り（低い方が一瞬落ちる）
    const c = this.ctx; if (!c || !this.cur) return;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(150, t0); o.frequency.exponentialRampToValueAtTime(55, t0 + 0.12);
    const g = c.createGain(); g.gain.setValueAtTime(0.07, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13);
    o.connect(g); g.connect(this.cur.out); o.start(t0); o.stop(t0 + 0.18);
  },

  play(kind) {
    if (!this.on) return;
    const c = this.ready(); if (!c) return;
    const now = c.currentTime;
    // 同じ音が重なって団子になるのを防ぐ（客が増えると売上音が一斉に鳴る）
    const gap = { ui: 0.04, talk: 0.03, cash: 0.09, pay: 0.12, register: 0.3, fix: 0.2 }[kind] || 0.05;
    if (this.last[kind] && now - this.last[kind] < gap) return;
    this.last[kind] = now;
    switch (kind) {
      case 'ui':                                                  // ピッ
        this.tone('square', 1180, 1180, 0.05, 0.06);
        break;
      case 'talk':                                                // ピ（これが続いて「ピピピピ」になる）
        this.tone('square', 1500, 1500, 0.018, 0.022);
        break;
      case 'cash':                                                // チャリーン（高い2音を少しずらす）
        this.tone('triangle', 1568, 1568, 0.16, 0.075);
        this.tone('triangle', 2093, 2093, 0.42, 0.055, 0.055);
        break;
      case 'pay':                                                 // バコーン（低い音が落ちる＋ざらつき）
        this.tone('square', 190, 62, 0.26, 0.085);
        this.noise(0.14, 0.05);
        break;
      /* ガッチャーン（レジ）。売上のチャリーンとは別物にする＝
         あちらは硬貨の澄んだ音、こちらは「金属の引き出しが開いて閉まる」機械の音。
         ①打鍵のカチン ②ベルのチン ③引き出しが出るガシャ ④閉まるゴトン、の4つを少しずつずらして重ねる */
      case 'register':
        this.clank(0.05, 0.30, 3600);                             // ①キーを叩く
        this.tone('triangle', 2637, 2637, 0.5, 0.09, 0.03);       // ②ベル
        this.tone('triangle', 3520, 3520, 0.38, 0.05, 0.045);
        this.clank(0.16, 0.34, 1500, 0.06);                       // ③引き出しが飛び出す
        this.tone('square', 150, 70, 0.2, 0.075, 0.06);
        this.clank(0.1, 0.26, 800, 0.28);                         // ④ゴトンと閉まる
        this.tone('square', 110, 55, 0.22, 0.07, 0.28);
        break;
      /* カンカン！（修理業者の金槌）。硬い金属を2回叩く＝高い金属音＋短い減衰。
         レジのガッチャーンと混ざらないよう、もっと高く・短く・乾いた音にしてある */
      case 'fix':
        // ハンマーで叩く「ガンガン！」（作者指定でカンカン→重い打撃音へ）。
        // 低い帯域のクランク＋ドスの効いたノイズを重ねて、2打目はさらに少し低く
        this.clank(0.10, 0.34, 1100);                             // 1打目（ガン！）
        this.noise(0.08, 0.16);                                   // 打撃の芯（ドスッ）
        this.tone('square', 180, 70, 0.12, 0.055);
        this.clank(0.10, 0.30, 950, 0.19);                        // 2打目（少し低い＝手の返し）
        this.noise(0.08, 0.14, 0.19);
        this.tone('square', 165, 65, 0.12, 0.05, 0.19);
        break;
    }
  },
};

/* ============ 譜面 ============
   8分音符ごとに1マス。`C5`＝その高さで鳴らす／`-`＝前の音をのばす／`.`＝休み。
   行のあたまのコメントが小節番号。譜面を書き換えれば曲が変わる（コードは触らなくていい）。 */
const NOTE_STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteFreq(n) {
  const step = NOTE_STEP[n[0]] + (n[1] === '#' ? 1 : 0);
  const oct = +n[n.length - 1];
  return 440 * Math.pow(2, ((step + (oct + 1) * 12) - 69) / 12);   // A4=440Hzを基準に半音ずつ
}
/* 譜面の文字列を「どのマスで、どの高さを、何マスぶん鳴らすか」に開く */
function parseNotes(src) {
  const tk = src.trim().split(/\s+/);
  const out = new Array(tk.length).fill(null);
  for (let i = 0; i < tk.length; i++) {
    if (tk[i] === '-' || tk[i] === '.') continue;
    let len = 1;
    while (i + len < tk.length && tk[i + len] === '-') len++;      // 後ろの「-」の数＝音の長さ
    out[i] = { f: noteFreq(tk[i]), len };
  }
  return out;
}

const SONGS = {
  /* 営業中のBGM「夕凪湯のうた」※作者リライト前提の叩き台。
     ヨナ抜き長音階（ドレミソラ）でゆっくりめ。番台に座って一日を眺めている音、のつもり。
     16小節・約40秒でひと回り。前半8小節が“いつもの夕方”、後半8小節が“少し上を向く”。 */
  biz: {
    bpm: 96,
    drum: 'k.h.k.h.',                       // ドン…チッ ドン…チッ（1小節ぶん）
    mel: `
      G4 -  A4 -  C5 -  -  -
      A4 -  G4 -  E4 -  -  -
      D4 -  E4 -  G4 -  A4 -
      G4 -  -  -  -  -  .  .
      C5 -  A4 -  G4 -  E4 -
      D4 -  E4 -  D4 -  C4 -
      E4 -  G4 -  A4 -  C5 -
      A4 -  -  -  -  -  .  .
      C5 -  D5 -  E5 -  -  -
      D5 -  C5 -  A4 -  -  -
      G4 -  A4 -  C5 -  D5 -
      C5 -  -  -  -  -  .  .
      E5 -  D5 -  C5 -  A4 -
      G4 -  A4 -  G4 -  E4 -
      D4 -  E4 -  G4 -  A4 -
      C5 -  -  -  -  -  .  .`,
    bass: `
      C3 -  -  -  G3 -  -  -
      A2 -  -  -  E3 -  -  -
      F2 -  -  -  C3 -  -  -
      G2 -  -  -  D3 -  -  -
      C3 -  -  -  G3 -  -  -
      A2 -  -  -  E3 -  -  -
      F2 -  -  -  C3 -  -  -
      G2 -  -  -  D3 -  -  -
      F2 -  -  -  C3 -  -  -
      G2 -  -  -  D3 -  -  -
      C3 -  -  -  G3 -  -  -
      A2 -  -  -  E3 -  -  -
      F2 -  -  -  C3 -  -  -
      G2 -  -  -  D3 -  -  -
      C3 -  -  -  E3 -  -  -
      G2 -  -  -  G2 -  -  -`,
  },

  /* 準備中（夜）の「暖簾を下ろしたあと」。8小節・約27秒。
     昼の曲と同じ音階のまま速さと編成だけ落とす＝同じ店の、時間だけが変わった音。
     太鼓なし・音色はやわらかい丸い音・音量も控えめ。設備を並べて考えている時間の邪魔をしない */
  prep: {
    bpm: 72, wave: 'sine', vol: 0.8,
    drum: '........',
    mel: `
      A4 -  -  -  G4 -  -  -
      E4 -  -  -  -  -  .  .
      C5 -  -  -  A4 -  -  -
      G4 -  -  -  -  -  .  .
      E5 -  -  -  D5 -  -  -
      C5 -  -  -  A4 -  -  -
      G4 -  -  -  E4 -  -  -
      A4 -  -  -  -  -  -  -`,
    bass: `
      A2 -  -  -  -  -  -  -
      F2 -  -  -  -  -  -  -
      C3 -  -  -  -  -  -  -
      G2 -  -  -  -  -  -  -
      A2 -  -  -  -  -  -  -
      F2 -  -  -  -  -  -  -
      G2 -  -  -  -  -  -  -
      A2 -  -  -  -  -  -  -`,
  },

  /* エンディング。16小節・約36秒。昼の曲と同じヨナ抜き長音階のまま、
     速く・高く・厚くした＝「同じ店の、同じ音階の歌が、ここまで来た」という作り。
     太鼓も一段にぎやかにしてある */
  ending: {
    bpm: 108,
    drum: 'k.h.kkh.',
    mel: `
      C5 -  E5 -  G5 -  -  -
      E5 -  D5 -  C5 -  -  -
      D5 -  E5 -  G5 -  A5 -
      G5 -  -  -  -  -  .  .
      A5 -  G5 -  E5 -  D5 -
      C5 -  D5 -  E5 -  -  -
      G4 -  A4 -  C5 -  D5 -
      C5 -  -  -  -  -  .  .
      E5 -  G5 -  A5 -  -  -
      G5 -  E5 -  D5 -  -  -
      C5 -  D5 -  E5 -  G5 -
      A5 -  -  -  -  -  .  .
      G5 -  E5 -  D5 -  C5 -
      A4 -  C5 -  D5 -  E5 -
      D5 -  C5 -  A4 -  G4 -
      C5 -  -  -  -  -  -  -`,
    bass: `
      C3 -  -  -  G3 -  -  -
      F2 -  -  -  C3 -  -  -
      G2 -  -  -  D3 -  -  -
      C3 -  -  -  G3 -  -  -
      A2 -  -  -  E3 -  -  -
      F2 -  -  -  C3 -  -  -
      G2 -  -  -  D3 -  -  -
      C3 -  -  -  G3 -  -  -
      F2 -  -  -  C3 -  -  -
      G2 -  -  -  D3 -  -  -
      C3 -  -  -  G3 -  -  -
      A2 -  -  -  E3 -  -  -
      F2 -  -  -  C3 -  -  -
      G2 -  -  -  D3 -  -  -
      C3 -  -  -  E3 -  -  -
      C3 -  -  -  G3 -  -  -`,
  },
};
