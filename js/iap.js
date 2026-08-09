'use strict';

/* ============ App内課金（オート修理） ============
   売り物はひとつだけ＝「オート修理」。一度買えば、ずっと使える（非消耗型／買い切り）。

   iOS   … StoreKit（App Store）
   Android … Google Play Billing
   どちらも cordova-plugin-purchase（CdvPurchase）が面倒を見る。

   ブラウザで遊んでいるとき（PCのChrome・開発サーバー）は、
   ストアが存在しないので **売り場そのものを出さない**。
   ＝「買えないのに購入ボタンがある」画面を作らないため（審査でも嫌われる）。

   買った・買っていないの記録は2か所にある：
     ①ストア側（Apple/Googleのアカウントに紐づく＝機種変更しても残る。これが正）
     ②localStorage の orenoSauna_premium（章をまたいで共有する持ち物＝chapter.js）
   起動時にストアへ問い合わせて、①で持っていれば②を立てる＝作り直し・機種変更でも戻る。 */

const IAP = (function () {

  /* 商品ID。App Store Connect と Google Play Console で、この文字列そのままで商品を作る */
  const PRODUCT_ID = 'com.contena.orenosauna.autorepair';

  let store = null;          // CdvPurchase.store（ネイティブのときだけ入る）
  let product = null;        // 商品（値段や名前はストアから降ってくる）
  let started = false;
  const watchers = [];       // 状態が変わったときに呼び戻す先（メニューの描き直し）

  /* いま画面に売り場を出してよいか。
     ネイティブで動いていて、ストアから商品が降りてきている＝値段が言えるときだけ true */
  function available() { return !!(product && product.canPurchase !== undefined); }

  /* 「¥370」のような、その国の通貨の値段。ストアが教えてくれた文字列をそのまま使う
     （こちらで値段を書くと、国ごとの通貨・為替・税に必ずズレる） */
  function price() {
    const o = product && product.offers && product.offers[0];
    const p = o && o.pricingPhases && o.pricingPhases[0];
    return (p && p.price) || '';
  }

  function owned() {
    if (!store) return false;
    try { return !!store.owned({ id: PRODUCT_ID, type: CdvPurchase.ProductType.NON_CONSUMABLE }); }
    catch (e) { return false; }
  }

  function onChange(fn) { watchers.push(fn); }
  function notify() { for (const fn of watchers) { try { fn(); } catch (e) {} } }

  /* ストアで「持っている」ことが分かったら、ゲーム側の持ち物にも印をつける。
     ここが唯一の解禁口＝購入・復元・起動時の問い合わせが、全部ここへ合流する */
  function syncOwned() {
    if (!owned()) { notify(); return; }
    G.premium = G.premium || {};
    if (!G.premium.autoRepair) {
      G.premium.autoRepair = true;
      if (G.premium.autoRepairOn === undefined) G.premium.autoRepairOn = true;
      savePremium();
      if (typeof toast === 'function') toast('🔧 オート修理が使えるようになった');
    }
    notify();
  }

  /* ---- 起動 ---- */
  function init() {
    if (started) return;
    if (typeof CdvPurchase === 'undefined') return;   // ブラウザ＝ストアなし。何もしない
    started = true;

    store = CdvPurchase.store;
    const { ProductType, Platform, LogLevel } = CdvPurchase;
    store.verbosity = LogLevel.ERROR;

    store.register([
      { id: PRODUCT_ID, type: ProductType.NON_CONSUMABLE, platform: Platform.APPLE_APPSTORE },
      { id: PRODUCT_ID, type: ProductType.NON_CONSUMABLE, platform: Platform.GOOGLE_PLAY },
    ]);

    store.when()
      /* 支払いが通った。領収書サーバーは持っていない（単機のゲームで、売り物も解禁フラグひとつ）ので、
         ストアが「買った」と言った時点で finish()＝取引を閉じる。閉じないと同じ請求が何度も戻ってくる */
      .approved(t => t.finish())
      .productUpdated(refresh)
      .receiptUpdated(refresh);

    store.error(err => {
      /* 6777006 = 支払いをユーザーがやめた（＝正常）。それ以外だけ知らせる */
      if (err && err.code === CdvPurchase.ErrorCode.PAYMENT_CANCELLED) return;
      if (typeof toast === 'function') toast('ストアにつながらなかった（時間をおいて試してほしい）');
    });

    store.initialize([Platform.APPLE_APPSTORE, Platform.GOOGLE_PLAY]).then(refresh);
  }

  function refresh() {
    if (!store) return;
    product = store.get(PRODUCT_ID) || product;
    syncOwned();
  }

  /* ---- 購入 ---- */
  function buy() {
    if (!store) return;
    const p = store.get(PRODUCT_ID);
    const offer = p && p.getOffer();
    if (!offer) { if (typeof toast === 'function') toast('いま商品を取り寄せられなかった'); return; }
    offer.order().then(err => {
      if (err) return;              // やめた・失敗＝store.error 側で知らせる
      refresh();
    });
  }

  /* ---- 購入の復元 ----
     機種変更・アプリを入れ直したとき用。Appleは買い切り商品に復元手段を必ず求める（審査要件） */
  function restore() {
    if (!store) return;
    if (typeof toast === 'function') toast('購入を確かめている…');
    store.restorePurchases().then(() => {
      refresh();
      if (typeof toast === 'function' && !owned()) toast('このアカウントでの購入は見つからなかった');
    });
  }

  document.addEventListener('deviceready', init, false);

  return { init, buy, restore, owned, price, available, onChange, PRODUCT_ID };
})();
