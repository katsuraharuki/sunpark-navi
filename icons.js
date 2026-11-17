/* 店の種類ごとの絵記号（自前の線画。実在の店のロゴは使わない・ロゴに見えるマークは作らない）
 * すべて 24×24 の枠・線の太さ 1.8・角は丸。色は呼ぶ側が決める（館の緑・墨）。 */
(function () {
  'use strict';
  var P = {
    fashion: '<path d="M10 5.2a2 2 0 1 1 2 2v1.6L3.5 15.5h17L12 8.8"/>',
    cafe: '<path d="M5 10h11v3.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8.5 4c-.8 1 .8 1.8 0 3M12.5 4c-.8 1 .8 1.8 0 3"/><path d="M4 21h14"/>',
    meal: '<path d="M7 3v5.5a2 2 0 0 0 4 0V3M9 10.5V21"/><path d="M17 21V3c-2 1.5-3 4.5-3 8h3"/>',
    service: '<path d="M5 17a7 7 0 0 1 14 0z"/><path d="M12 10V8M10 8h4M3 20h18"/>',
    goods: '<rect x="4" y="10" width="16" height="10" rx="1"/><path d="M3 7h18v3H3zM12 7v13"/><path d="M12 7c-1.5-3-5-3.5-5-1.5S10 7 12 7c2 0 5-.5 5-1.5S13.5 4 12 7"/>',
    food: '<path d="M3 10h18l-2 9.5H5z"/><path d="M8 10l3-6M16 10l-3-6M9 13.5v3M12 13.5v3M15 13.5v3"/>',
    phone: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
    glasses: '<circle cx="6" cy="14" r="3.2"/><circle cx="18" cy="14" r="3.2"/><path d="M9.2 14c1.5-1.2 4.1-1.2 5.6 0M2.8 13.5 4.5 8M21.2 13.5 19.5 8"/>',
    toilet: '<circle cx="7" cy="5" r="1.6"/><path d="M5 9h4v6H8v5H6v-5H5z"/><circle cx="17" cy="5" r="1.6"/><path d="M17 9l-3 7h6zM16 16v4M18 16v4"/>',
    atm: '<circle cx="12" cy="12" r="9"/><path d="M8.5 7 12 11.5 15.5 7M12 11.5V17M9 12.5h6M9 15h6"/>',
    amuse: '<path d="M7 8.5h10a4 4 0 0 1 4 4v1.5a3 3 0 0 1-5.2 2l-1.3-1.5h-5L8.2 16a3 3 0 0 1-5.2-2v-1.5a4 4 0 0 1 4-4z"/><path d="M6.5 12h3M8 10.5v3"/><circle cx="15.5" cy="11.5" r=".7"/><circle cx="17.5" cy="13.5" r=".7"/>',
    hobby: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="9" cy="15" r="1"/>',
    accessory: '<path d="M7 4h10l4 5-9 11L3 9z"/><path d="M3 9h18M9.5 4 12 9l2.5-5M12 9v11"/>',
    clinic: '<path d="M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.6v.4"/>',
    shoe: '<path d="M3 17V8h4.5c.8 2 2.5 3 5.5 3l4.5 1.2A4 4 0 0 1 21 16v1z"/><path d="M3 20h18M9 11.5l1-1.5M11.5 12l1-1.5"/>',
    bed: '<path d="M3 19V6M3 14h18v5M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.8"/>',
    drug: '<path d="M5.5 18.5a3.5 3.5 0 0 1 0-5l8-8a3.5 3.5 0 0 1 5 5l-8 8a3.5 3.5 0 0 1-5 0z"/><path d="M9.5 9.5l5 5"/>',
    cart: '<path d="M3 4h2.5l2 11h11l2-8H6.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
    sports: '<circle cx="12" cy="12" r="9"/><path d="M3.6 9.5c5 1.2 11.8 1.2 16.8 0M3.6 14.5c5-1.2 11.8-1.2 16.8 0M12 3c-3 5-3 13 0 18"/>',
    pet: '<circle cx="6.5" cy="10.5" r="1.6"/><circle cx="10" cy="6.5" r="1.6"/><circle cx="14" cy="6.5" r="1.6"/><circle cx="17.5" cy="10.5" r="1.6"/><path d="M12 11.5c-3 0-5.5 4-5.5 6s2 2.5 3.5 2 2.5-.5 4 0 3.5 0 3.5-2-2.5-6-5.5-6z"/>',
    event: '<path d="M5 21V4M5 4h12l-2.2 4L17 12H5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    rest: '<path d="M5 11V7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5V11"/><path d="M3 11h4v3h10v-3h4v6H3zM5.5 17v2.5M18.5 17v2.5"/>',
    book: '<path d="M4 5.5C6.5 4 9.5 4 12 6c2.5-2 5.5-2 8-.5V19c-2.5-1.5-5.5-1.5-8 .5-2.5-2-5.5-2-8-.5z"/><path d="M12 6v13.5"/>',
    lesson: '<path d="M4 20l1-5L16 4l4 4L9 19z"/><path d="M14 6l4 4M4 20l5-1"/>',
    building: '<path d="M5 21V5h9v16M14 9h5v12M3 21h18M8 8h3M8 11h3M8 14h3M8 17h3"/>',
    shop: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'
  };
  var BY_CAT = { 'ファッション': 'fashion', 'サービス': 'service', '雑貨': 'goods', '食品': 'food', '携帯電話': 'phone', 'メガネ': 'glasses',
    'トイレ': 'toilet', '銀行・ATM': 'atm', 'アミューズメント': 'amuse', 'ホビー': 'hobby', 'アクセサリー': 'accessory', 'クリニック': 'clinic',
    '案内所': 'info', '靴': 'shoe', '寝具': 'bed', 'ドラッグストア': 'drug', 'スーパー': 'cart', 'スポーツ': 'sports', 'ペット': 'pet',
    '催事': 'event', '時計': 'clock', '休憩・その他': 'rest', '書店': 'book', '習い事': 'lesson', '東館': 'building' };
  var LABEL = { fashion: 'ファッション', cafe: 'カフェ', meal: '食事', service: 'サービス', goods: '雑貨', food: '食品', phone: '携帯電話', glasses: 'メガネ',
    toilet: 'トイレ', atm: 'ATM', amuse: 'アミューズメント', hobby: 'ホビー', accessory: 'アクセサリー', clinic: 'クリニック', info: '案内所', shoe: '靴',
    bed: '寝具', drug: 'ドラッグストア', cart: 'スーパー', sports: 'スポーツ', pet: 'ペット', event: '催事', clock: '時計', rest: '休憩', book: '書店',
    lesson: '習い事', building: '東館', shop: 'お店' };
  // 飲食は店名で「カフェ（コーヒー・カフェ・珈琲・ティー・スイーツ系）」と「食事」に分ける
  var CAFE = /コーヒー|珈琲|カフェ|cafe|ｶﾌｪ|ティー|tea|茶|スイーツ|ドーナツ|クレープ|ケーキ|パン|ベーカリー|アイス|サーティワン|タピオカ|スターバックス|ミスド|パフェ|ジェラート|果汁|ジュース/i;
  function kind(s) {
    if (!s) return 'shop';
    if (s.cat === '飲食') return CAFE.test(s.name + ' ' + (s.aliases || []).join(' ')) ? 'cafe' : 'meal';
    return BY_CAT[s.cat] || 'shop';
  }
  var ATTR = 'fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  // HTML の中に置く小さな SVG
  function html(key, cls) {
    return '<svg class="' + (cls || 'ic') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false" stroke="currentColor" ' + ATTR + '>' + (P[key] || P.shop) + '</svg>';
  }
  // 地図の SVG の中に置く記号（中心 cx,cy・一辺 size（地図の単位））
  function group(key, cx, cy, size, color, bg) {
    var k = size / 24, r = size * 0.66;
    return '<g class="map-ic" pointer-events="none" aria-hidden="true">' +
      (bg ? '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + bg + '"/>' : '') +
      '<g transform="translate(' + (cx - size / 2) + ',' + (cy - size / 2) + ') scale(' + k + ')" stroke="' + color + '" ' + ATTR + '>' + (P[key] || P.shop) + '</g></g>';
  }
  var api = { kind: kind, html: html, group: group, label: function (k) { return LABEL[k] || ''; }, keys: Object.keys(P) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else window.SunparkIcons = api;
})();
