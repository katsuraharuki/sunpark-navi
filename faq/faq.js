/* サンパーク インフォメーション（見本）：質問 → よくある質問／欲しい物から店／店名 の順に探して答える。
   API・外部送信なし。記録はこの端末の localStorage だけ。 */
(function () {
  'use strict';
  var NAVI = '../navi.html?to=';
  var KEY_LOG = 'spfaq.log.v1', KEY_ADD = 'spfaq.added.v1';
  var SEED = [ // 館の方の画面が空にならないための例
    { q: 'ATMは何時まで使えますか', n: 3, ex: true },
    { q: 'クリーニング屋さんはありますか', n: 2, ex: true },
    { q: 'タクシーを呼んでほしい', n: 2, ex: true }
  ];

  function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function norm(s) {
    s = String(s || '').normalize('NFKC').toLowerCase();
    s = s.replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); });
    return s.replace(/[\s、。・,.!?！？「」『』()（）\-ー〜~]/g, '');
  }
  function keyScore(nq, key) { // 「駐車 無料」のような空白区切りは全部を含む時だけ
    var parts = String(key).split(/\s+/).map(norm).filter(Boolean), sum = 0;
    for (var i = 0; i < parts.length; i++) { if (nq.indexOf(parts[i]) < 0) return 0; sum += parts[i].length; }
    return sum;
  }
  function best(list, nq) {
    var top = null, topS = 0;
    list.forEach(function (it) {
      var s = 0; (it.keys || []).forEach(function (k) { s += keyScore(nq, k); });
      if (s > topS) { topS = s; top = it; }
    });
    return { item: top, score: topS };
  }

  var M = window.MAPDATA || {};
  var STORES = M.stores || [];
  var byName = {}; STORES.forEach(function (s) { byName[s.name] = s; });
  var GENERIC = {}; // 「トイレ」「ATM」「めがね」のような一般語の別名は店名として扱わない
  PRODUCTS.concat(FAQ).forEach(function (it) { (it.keys || []).forEach(function (k) { String(k).split(/\s+/).forEach(function (w) { GENERIC[norm(w)] = 1; }); }); });
  function storeHit(nq) {
    var top = null, len = 0;
    STORES.forEach(function (s) {
      [s.name].concat(s.aliases || []).forEach(function (n, i) {
        var k = norm(n); if (i > 0 && GENERIC[k]) return;
        if (k.length >= 2 && nq.indexOf(k) >= 0 && k.length > len) { len = k.length; top = s; }
      });
    });
    return top ? { st: top, len: len } : null;
  }

  function answer(raw) {
    var nq = norm(raw);
    if (!nq) return null;
    var added = load(KEY_ADD, []).map(function (a) { return { q: a.q, a: a.a, src: 'staff', stores: a.stores || [], keys: [a.q].concat(a.keys || []) }; });
    var a = best(added, nq), f = best(FAQ, nq), p = best(PRODUCTS, nq), st = storeHit(nq);
    if (a.item && a.score >= Math.max(f.score, p.score)) return { kind: 'faq', it: a.item };
    if (st && st.len * 2 > Math.max(f.score, p.score)) return { kind: 'store', st: st.st };
    if (f.item && f.score >= p.score) return { kind: 'faq', it: f.item, extra: p.item && p.score >= f.score ? p.item : null };
    if (p.item) return { kind: 'product', it: p.item };
    return null;
  }

  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function badge(src) {
    var m = { official: ['b-off', '公式サイト'], list: ['b-list', 'フロアマップ'], ask: ['b-ask', '館に確認中'], staff: ['b-off', 'インフォメーションの答え'], guess: ['b-list', '品ぞろえは目安'] }[src] || ['b-list', ''];
    return el('span', 'badge ' + m[0], m[1]);
  }
  function shopList(names, max) {
    var ul = el('ul', 'shops'), shown = 0;
    names.forEach(function (n) {
      var s = byName[n]; if (!s || shown >= (max || 6)) return; shown++;
      var li = el('li'), a = el('a'); a.href = NAVI + encodeURIComponent(n);
      a.appendChild(el('span', 'fl', s.floor + 'F')); a.appendChild(el('span', 'nm', n)); a.appendChild(el('span', 'go', '道順 ›'));
      li.appendChild(a); ul.appendChild(li);
    });
    return shown ? ul : null;
  }

  function ask(raw) {
    raw = String(raw || '').trim(); if (!raw) return;
    var log = $('log'), r = answer(raw);
    var pair = el('div', 'log'); pair.appendChild(el('div', 'you', raw));
    var box = el('div', 'ans');
    if (!r) {
      box.className = 'ans none';
      box.appendChild(el('p', 't', 'ここではお答えできませんでした'));
      box.appendChild(el('p', null, '1F の総合インフォメーションでご案内します。この質問は館に届け、次からここで答えられるようにします。'));
      var l = shopList(['総合インフォメーション']); if (l) box.appendChild(l);
    } else if (r.kind === 'store') {
      var t = el('p', 't', r.st.floor + 'F・' + r.st.name + 'です'); box.appendChild(t);
      box.appendChild(el('p', null, 'いまいる所からの道順をご案内します。'));
      box.appendChild(shopList([r.st.name]));
    } else if (r.kind === 'product') {
      var t2 = el('p', 't', r.it.place ? r.it.label + 'はこちらです' : r.it.label + 'なら、こちらのお店です'); if (!r.it.place) t2.appendChild(badge('guess')); box.appendChild(t2);
      var l2 = shopList(r.it.stores); if (l2) box.appendChild(l2);
    } else {
      if (r.it.src === 'ask') box.className = 'ans ask-tag';
      var t3 = el('p', 't', r.it.q); t3.appendChild(badge(r.it.src)); box.appendChild(t3);
      box.appendChild(el('p', null, r.it.a));
      var l3 = shopList(r.it.stores || []); if (l3) box.appendChild(l3);
      if (r.extra) { box.appendChild(el('p', 'more', r.extra.label + 'のお店：')); var l4 = shopList(r.extra.stores, 4); if (l4) box.appendChild(l4); }
    }
    pair.appendChild(box); log.prepend(pair); // 新しい質問を上に
    var lg = load(KEY_LOG, []); lg.push({ q: raw, hit: !!r, t: Date.now() }); save(KEY_LOG, lg.slice(-500));
  }

  /* お客様 */
  FAQ_CHIPS.forEach(function (c) { var b = el('button', null, c); b.type = 'button'; b.onclick = function () { ask(c); }; $('chips').appendChild(b); });
  $('f').addEventListener('submit', function (e) { e.preventDefault(); ask($('q').value); $('q').value = ''; });
  var first = new URLSearchParams(location.search).get('q'); if (first) ask(first);

  /* 館の方 */
  function renderStaff() {
    var lg = load(KEY_LOG, []), added = load(KEY_ADD, []), doneQ = {};
    added.forEach(function (a) { doneQ[norm(a.q)] = 1; });
    $('s-all').textContent = lg.length; $('s-hit').textContent = lg.filter(function (x) { return x.hit; }).length; $('s-miss').textContent = lg.filter(function (x) { return !x.hit; }).length;
    var cnt = {}, order = [];
    lg.filter(function (x) { return !x.hit; }).forEach(function (x) { var k = norm(x.q); if (doneQ[k]) return; if (!cnt[k]) { cnt[k] = { q: x.q, n: 0 }; order.push(k); } cnt[k].n++; });
    var items = order.map(function (k) { return cnt[k]; });
    SEED.forEach(function (s) { if (!doneQ[norm(s.q)] && !cnt[norm(s.q)]) items.push(s); });
    items.sort(function (a, b) { return b.n - a.n; });
    var ul = $('miss'); ul.innerHTML = '';
    if (!items.length) ul.appendChild(el('li', 'empty', '答えられなかった質問はありません。'));
    items.forEach(function (it) {
      var li = el('li');
      li.appendChild(el('div', 'mq', it.q));
      li.appendChild(el('div', 'mc', it.n + '回聞かれた' + (it.ex ? '（見本の例）' : '')));
      var ta = el('textarea'); ta.placeholder = '答えを書く（例：1F のセブン銀行のATMは、館の営業時間内に使えます）'; li.appendChild(ta);
      var row = el('div', 'row'), kw = el('input'); kw.placeholder = '言いかえ（空白区切り。例：ATM 時間）';
      var btn = el('button', null, '答えに足す'); btn.type = 'button';
      btn.onclick = function () {
        var txt = ta.value.trim(); if (!txt) { ta.focus(); return; }
        var ad = load(KEY_ADD, []); ad.push({ q: it.q, a: txt, keys: kw.value.trim() ? kw.value.trim().split(/\s+/) : [] }); save(KEY_ADD, ad);
        renderStaff();
      };
      row.appendChild(kw); row.appendChild(btn); li.appendChild(row); ul.appendChild(li);
    });
    if (added.length) { var d = el('li', 'added', '足した答え ' + added.length + '件：' + added.map(function (a) { return a.q; }).join('／') + '（お客様の画面で聞くと、この答えが出ます）'); ul.appendChild(d); }
    var al = $('asklist'); al.innerHTML = '';
    FAQ.filter(function (x) { return x.src === 'ask'; }).forEach(function (x) { al.appendChild(el('li', null, x.q)); });
  }
  function tab(which) {
    var g = which === 'guest';
    $('guest').hidden = !g; $('staff').hidden = g;
    $('t-guest').setAttribute('aria-selected', g); $('t-staff').setAttribute('aria-selected', !g);
    if (!g) renderStaff();
  }
  $('t-guest').onclick = function () { tab('guest'); };
  $('t-staff').onclick = function () { tab('staff'); };
})();
