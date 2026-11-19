/* 避難誘導（スタッフ用・見本）の画面。計算は evac-core.js */
(function () {
  'use strict';
  var E = EvacCore.create(window.MAPDATA);
  var $ = function (id) { return document.getElementById(id); };
  var state = { tool: 'hz', rk: 'm', floor: 1, zoom: 2, hazards: [], here: null, wc: false, res: null, sv: null, seq: 0 };
  var R_WORD = { s: '小', m: '中', l: '大' };

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pp(poly) { return poly.map(function (p) { return p[0] + ',' + p[1]; }).join(' '); }
  function pl(pts) { return pts.map(function (p) { return Math.round(p.x) + ',' + Math.round(p.y); }).join(' '); }
  function centroid(poly) { var x = 0, y = 0; poly.forEach(function (p) { x += p[0]; y += p[1]; }); return { x: x / poly.length, y: y / poly.length }; }
  function short(n) { return n.replace(/（.*?）/g, '').replace(/・Standard Products/, ''); }
  function exitName(e) { return e.label.replace(/（.*?）/, ''); }

  // ---------- 計算 ----------
  function recompute() {
    state.res = state.here ? E.evacuate(state.here, { hazards: state.hazards, wheelchair: state.wc }) : null;
    if (state.sv) state.sv = E.survey({ hazards: state.hazards });
  }

  // ---------- 地図 ----------
  var VB = {};
  E.FLOORS.forEach(function (fl) {
    var xs = E.G[fl].outline.map(function (p) { return p[0]; }), ys = E.G[fl].outline.map(function (p) { return p[1]; });
    var x0 = Math.min.apply(null, xs) - 20, y0 = Math.min.apply(null, ys) - 20;
    VB[fl] = { x: x0, y: y0, w: Math.max.apply(null, xs) + 20 - x0, h: Math.max.apply(null, ys) + 20 - y0 };
  });
  var LIFT_ICON = { escalator: 'エス', stairs: '階段', elevator: 'EV' };

  function renderMap() {
    var fl = state.floor, vb = VB[fl], box = $('map'), cw = box.clientWidth || 343, u = vb.w / (cw * state.zoom);
    var r = state.res, sv = state.sv;
    var s = '<svg viewBox="' + [vb.x, vb.y, vb.w, vb.h].join(' ') + '" style="width:' + state.zoom * 100 + '%;height:auto" role="img" aria-label="' + fl + '階の地図">';
    s += '<defs><marker id="arw" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.4" markerHeight="2.4" orient="auto-start-reverse"><path d="M1,1 L9,5 L1,9 z" fill="#fff"/></marker></defs>';
    s += '<polygon points="' + pp(E.G[fl].outline) + '" fill="#fff" stroke="#b9c2b5" stroke-width="' + 1.4 * u + '" stroke-linejoin="round"/>';
    E.G[fl].voids.forEach(function (p) { var c = centroid(p); s += '<polygon points="' + pp(p) + '" fill="#e4ebf1" stroke="#c3cfda" stroke-width="' + 0.7 * u + '"/><text x="' + c.x + '" y="' + c.y + '" font-size="' + 9 * u + '" text-anchor="middle" dominant-baseline="middle" fill="#7d8b99">吹抜</text>'; });
    (E.M.unnamed[fl] || []).forEach(function (p) { s += '<polygon points="' + pp(p) + '" fill="#eef1ec" stroke="#d9ded5" stroke-width="' + 0.6 * u + '"/>'; });
    var trapped = {}; if (sv) sv.trapped.forEach(function (st) { trapped[st.id] = 1; });
    var hereId = state.here && state.here.storeId;
    E.stores.forEach(function (st) {
      if (st.floor !== fl) return;
      var fill = trapped[st.id] ? '#fbd5d0' : st.id === hereId ? '#d6efdc' : '#f1f6e9', stroke = trapped[st.id] ? '#e08a80' : '#c9d6b8';
      st.polys.forEach(function (p) { s += '<polygon points="' + pp(p) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + 0.7 * u + '"/>'; });
    });
    E.stores.forEach(function (st) {
      if (st.floor !== fl || !st.polys.length || st.cat === 'トイレ') return;
      var poly = st.polys[0], xs = poly.map(function (p) { return p[0]; }), ys = poly.map(function (p) { return p[1]; });
      var bw = Math.max.apply(null, xs) - Math.min.apply(null, xs), bh = Math.max.apply(null, ys) - Math.min.apply(null, ys);
      var nm = short(st.name), fs = Math.min(11 * u, bw / (nm.length * 1.05));
      if (fs < 6.5 * u || bh < fs * 1.4) return;
      var c = centroid(poly);
      s += '<text x="' + c.x + '" y="' + c.y + '" font-size="' + fs + '" text-anchor="middle" dominant-baseline="middle" fill="' + (trapped[st.id] ? '#9b1c1c' : '#6b7568') + '"' + (trapped[st.id] ? ' font-weight="700"' : '') + '>' + esc(nm) + '</text>';
    });
    // 全館の一括：店の前の点
    if (sv) sv.rows.forEach(function (row) {
      var st = row.store; if (st.floor !== fl) return;
      if (!row.exit) s += '<circle cx="' + st.door.x + '" cy="' + st.door.y + '" r="' + 5 * u + '" fill="#c62828" stroke="#fff" stroke-width="' + 1.4 * u + '"/>';
      else s += '<circle cx="' + st.door.x + '" cy="' + st.door.y + '" r="' + 2.6 * u + '" fill="#00a040"/>';
    });
    // 危ない場所
    state.hazards.forEach(function (h) {
      if (h.floor !== fl) return;
      s += '<circle cx="' + h.x + '" cy="' + h.y + '" r="' + h.r + '" fill="#c62828" fill-opacity=".16" stroke="#c62828" stroke-width="' + 1.6 * u + '" stroke-dasharray="' + 5 * u + ' ' + 3 * u + '"/>';
      s += '<circle cx="' + h.x + '" cy="' + h.y + '" r="' + 8 * u + '" fill="#c62828" stroke="#fff" stroke-width="' + 1.6 * u + '"/>';
      s += '<text x="' + h.x + '" y="' + (h.y + 0.6 * u) + '" font-size="' + 9 * u + '" font-weight="700" text-anchor="middle" dominant-baseline="middle" fill="#fff">' + h.no + '</text>';
    });
    // 避難の道
    if (r && r.ok) r.legs.forEach(function (lg) {
      if (lg.floor !== fl || !lg.pts || lg.pts.length < 2) return;
      s += '<polyline points="' + pl(lg.pts) + '" fill="none" stroke="#fff" stroke-width="' + 10 * u + '" stroke-linecap="round" stroke-linejoin="round"/>';
      s += '<polyline points="' + pl(lg.pts) + '" fill="none" stroke="#00a040" stroke-width="' + 6 * u + '" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#arw)"/>';
    });
    // 昇降機（エレベーターは避難で使わない印）
    E.liftList.forEach(function (L) {
      var p = L[fl]; if (!p) return;
      var used = r && r.ok && (r.via === L || r.waitAt === L), rr = (used ? 10 : 7.5) * u;
      if (L.kind === 'elevator') {
        s += '<rect x="' + (p.x - rr) + '" y="' + (p.y - rr) + '" width="' + 2 * rr + '" height="' + 2 * rr + '" rx="' + 2.5 * u + '" fill="#a9b3a6"/>';
        s += '<text x="' + p.x + '" y="' + (p.y + 0.5 * u) + '" font-size="' + 6.5 * u + '" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-weight="700">EV</text>';
        s += '<line x1="' + (p.x - rr) + '" y1="' + (p.y + rr) + '" x2="' + (p.x + rr) + '" y2="' + (p.y - rr) + '" stroke="#c62828" stroke-width="' + 1.8 * u + '"/>';
      } else {
        s += '<rect x="' + (p.x - rr) + '" y="' + (p.y - rr) + '" width="' + 2 * rr + '" height="' + 2 * rr + '" rx="' + 2.5 * u + '" fill="' + (used ? '#00a040' : '#24302a') + '"/>';
        s += '<text x="' + p.x + '" y="' + (p.y + 0.5 * u) + '" font-size="' + (used ? 8 : 6.5) * u + '" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-weight="700">' + LIFT_ICON[L.kind] + '</text>';
        if (r && r.wait && r.waitAt === L) s += '<text x="' + p.x + '" y="' + (p.y - rr - 5 * u) + '" font-size="' + 10 * u + '" font-weight="700" text-anchor="middle" fill="#007a30" paint-order="stroke" stroke="#fff" stroke-width="' + 2.6 * u + '">待避場所</text>';
      }
    });
    // 出口
    var counts = {}; if (sv) E.exits.forEach(function (e) { counts[e.id] = sv.byExit[e.id].length; });
    E.exits.forEach(function (e) {
      if (e.floor !== fl) return;
      var used = r && r.ok && r.exit === e, w = (used ? 15 : 12) * u;
      s += '<rect x="' + (e.x - w) + '" y="' + (e.y - w * 0.62) + '" width="' + 2 * w + '" height="' + 1.24 * w + '" rx="' + 2 * u + '" fill="' + (used ? '#007a30' : '#00a040') + '" stroke="#fff" stroke-width="' + 1.4 * u + '"/>';
      s += '<text x="' + e.x + '" y="' + (e.y + 0.6 * u) + '" font-size="' + (used ? 8.5 : 7) * u + '" font-weight="700" text-anchor="middle" dominant-baseline="middle" fill="#fff">出口' + e.no + '</text>';
      if (sv) s += '<text x="' + e.x + '" y="' + (e.y + w + 9 * u) + '" font-size="' + 9 * u + '" font-weight="700" text-anchor="middle" fill="#007a30" paint-order="stroke" stroke="#fff" stroke-width="' + 2.6 * u + '">' + counts[e.id] + '店</text>';
    });
    // 今いる場所
    var h = state.here;
    if (h && h.floor === fl) {
      s += '<circle cx="' + h.x + '" cy="' + h.y + '" r="' + 7.5 * u + '" fill="#fff" stroke="#24302a" stroke-width="' + 3.2 * u + '"/>';
      s += '<text x="' + h.x + '" y="' + (h.y + 19 * u) + '" font-size="' + 10 * u + '" font-weight="700" text-anchor="middle" fill="#24302a" paint-order="stroke" stroke="#fff" stroke-width="' + 2.6 * u + '">今いる場所</text>';
    }
    s += '</svg>';
    box.innerHTML = s;
  }

  // 地図をタップ
  function svgPoint(svg, e) {
    var m = svg.getScreenCTM(); if (!m) return null;
    var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(m.inverse());
  }
  function nearStoreName(fl, p) {
    var best = null, bd = Infinity;
    E.stores.forEach(function (st) { if (st.floor !== fl) return; var d = Math.hypot(st.door.x - p.x, st.door.y - p.y); if (d < bd) { bd = d; best = st; } });
    return best && bd < 160 ? short(best.name) : null;
  }
  $('map').addEventListener('click', function (e) {
    var svg = $('map').querySelector('svg'); if (!svg) return;
    var p = svgPoint(svg, e); if (!p) return;
    var fl = state.floor;
    if (state.tool === 'hz') {
      var hit = -1;
      state.hazards.forEach(function (h, i) { if (h.floor === fl && Math.hypot(h.x - p.x, h.y - p.y) < Math.max(18, h.r * 0.35)) hit = i; });
      if (hit >= 0) state.hazards.splice(hit, 1);
      else {
        if (E.snap(fl, p) < 0) { flash('館の中（通路の近く）をタップしてください'); return; }
        state.seq += 1;
        state.hazards.push({ no: state.seq, floor: fl, x: Math.round(p.x), y: Math.round(p.y), r: E.RADIUS[state.rk], rk: state.rk, near: nearStoreName(fl, p) });
      }
    } else {
      if (E.snap(fl, p) < 0) { flash('通路の上をタップしてください'); return; }
      var nm = nearStoreName(fl, p);
      state.here = { floor: fl, x: Math.round(p.x), y: Math.round(p.y), label: fl + 'F ' + (nm ? nm + 'の近く' : '地図で選んだ場所') };
    }
    recompute(); render();
  });
  function flash(msg) { var t = $('tap-hint'); t.textContent = msg; t.style.color = '#9b1c1c'; setTimeout(hintText, 2400); }
  function hintText() {
    var t = $('tap-hint'); t.style.color = '';
    t.textContent = state.tool === 'hz' ? '地図をタップすると、火元・危ない場所を置きます（印をもう一度タップで消す）' : '地図をタップすると、そこを「今いる場所」にします';
  }

  // ---------- 結果 ----------
  function renderOut() {
    var r = state.res, h = state.here, o = $('out');
    if (!h) { o.innerHTML = ''; return; }
    var hzN = state.hazards.length, html = '<p class="from">今いる場所：<b>' + esc(h.label) + '</b>　<button class="hz-clear" id="here-clear">取り消す</button></p>';
    if (!r || !r.ok) {
      html += '<div class="card warn"><p class="card-label">道順が出ません</p><p class="card-title">出口への道がふさがれています</p>' +
        '<ol class="steps"><li>危ない場所から離れた、煙の来ない所へ移る</li><li>防災センターへ場所を伝え、指示を待つ</li></ol>' +
        '<p class="note">' + (r && r.wait ? '車いすの方の待避場所（階段前）へも、危ない場所を通らずに行けません。' : '置いた危ない場所で、どの出口へもつながりません。') + '</p></div>';
      o.innerHTML = html; bindOut(); return;
    }
    if (r.wait) {
      html += '<div class="card warn"><p class="card-label">車いすの方がいる時</p><p class="card-title">' + esc(r.waitAt.name) + 'の前で救助を待つ</p><ol class="steps">';
      if (r.escaped) html += '<li><b>危ない場所の中です。</b>まず矢印の方へ離れる</li>';
      html += '<li>エレベーターは使いません</li><li>' + esc(h.label) + 'から、<b>' + esc(r.waitAt.name) + 'の前（待避場所）</b>へ</li><li>着いたら、防災センターへ場所を伝える</li></ol>';
      if (r.fallback) html += '<p class="alert">階段の前へは行けないため、エスカレーターの前で待つ道を出しています</p>';
      html += '<p class="note">待避場所は見本の仮置きです（階段の前）。場所と連絡の手順は館の消防計画で決めます。</p></div>';
      o.innerHTML = html; bindOut(); return;
    }
    html += '<div class="card"><p class="card-label">避難の道順</p><p class="card-title">出口' + r.exit.no + '　' + esc(exitName(r.exit)) + '</p><ol class="steps">';
    if (r.escaped) html += '<li><b>危ない場所の中です。</b>まず矢印の方へ離れる</li>';
    r.legs.forEach(function (lg, i) {
      if (lg.lift) { html += '<li><b>' + esc(lg.lift.name) + '</b>で1Fへ降りる</li>'; return; }
      if (i === 0) html += '<li>' + esc(h.label) + 'から、<b>' + (lg.toLift ? esc(lg.toLift.name) : '出口' + r.exit.no) + '</b>へ</li>';
      else html += '<li>1Fで<b>出口' + r.exit.no + '</b>へ</li>';
    });
    html += '</ol>';
    if (h.floor !== 1 || r.via) html += '<p class="note">エレベーターは避難では使いません（地図の EV に斜線）。</p>';
    if (state.wc && h.floor === 1) html += '<p class="note">車いすの方：1Fは段差のない道を前提にしています（現地未確認）。</p>';
    if (hzN) html += '<p class="note">置いた危ない場所 ' + hzN + 'か所を避けた道です。</p>';
    if (r.legs.length > 1) html += '<p class="note">道は ' + h.floor + 'F と 1F に分かれます。上の「1F」「2F」で切り替えて見られます。</p>';
    html += '</div>';
    o.innerHTML = html; bindOut();
  }
  function bindOut() { var b = $('here-clear'); if (b) b.addEventListener('click', function () { state.here = null; recompute(); render(); }); }

  function renderSurvey() {
    var sv = state.sv, o = $('survey-out');
    if (!sv) { o.innerHTML = ''; return; }
    var total = E.stores.length, max = 0;
    E.exits.forEach(function (e) { max = Math.max(max, sv.byExit[e.id].length); });
    var html = '<p class="sv-sum">全' + total + '店のうち、出口へ向かえる店 <b>' + (total - sv.trapped.length) + '店</b>／道順が出ない店 <b' + (sv.trapped.length ? ' style="color:#9b1c1c"' : '') + '>' + sv.trapped.length + '店</b></p><ul class="bars">';
    E.exits.slice().sort(function (a, b) { return sv.byExit[b.id].length - sv.byExit[a.id].length; }).forEach(function (e) {
      var n = sv.byExit[e.id].length;
      html += '<li' + (n ? '' : ' class="closed"') + '><span>出口' + e.no + '　' + esc(exitName(e)) + '</span><span class="n">' + n + '店</span><span class="bar"><i style="width:' + (max ? n / max * 100 : 0) + '%"></i></span></li>';
    });
    html += '</ul>';
    if (sv.trapped.length) {
      html += '<div class="trap"><h3>道順が出ない店（火元で閉じ込められる）' + sv.trapped.length + '店</h3><ul>' +
        sv.trapped.map(function (st) { return '<li>' + st.floor + 'F ' + esc(short(st.name)) + '</li>'; }).join('') + '</ul></div>';
    } else html += '<p class="ok-line">道順が出ない店はありません。</p>';
    if (sv.inHazard.length) html += '<p class="note">危ない場所の中にある店：' + sv.inHazard.map(function (st) { return esc(short(st.name)); }).join('、') + '（先に危ない場所の外へ出る道で数えています）</p>';
    html += '<p class="note">各店の前から、一番近い出口へ向かう数です。2Fの店は階段・エスカレーターか2Fの出口を使い、エレベーターは使いません。</p>';
    o.innerHTML = html;
  }

  function renderHz() {
    var l = $('hz-list');
    if (!state.hazards.length) { l.innerHTML = ''; return; }
    l.innerHTML = state.hazards.map(function (h, i) {
      return '<span class="hz-chip">' + h.no + '　' + h.floor + 'F ' + esc(h.near ? h.near + 'の近く' : '') + '（' + R_WORD[h.rk] + '）<button data-del="' + i + '" aria-label="この危ない場所を消す">×</button></span>';
    }).join('') + '<button class="hz-clear" id="hz-clear">全部消す</button>';
    Array.prototype.forEach.call(l.querySelectorAll('[data-del]'), function (b) { b.addEventListener('click', function () { state.hazards.splice(+b.getAttribute('data-del'), 1); recompute(); render(); }); });
    $('hz-clear').addEventListener('click', function () { state.hazards = []; recompute(); render(); });
  }

  function renderFloors() {
    Array.prototype.forEach.call(document.querySelectorAll('.fl'), function (b) {
      var f = +b.getAttribute('data-fl'), dot = state.hazards.some(function (h) { return h.floor === f; });
      b.classList.toggle('on', f === state.floor);
      b.innerHTML = f + 'F' + (dot ? '<span class="dot" aria-label="危ない場所あり"></span>' : '');
    });
    $('z-val').textContent = state.zoom === 1 ? '全体' : state.zoom + '倍';
  }

  function render() { renderFloors(); renderMap(); renderHz(); renderOut(); renderSurvey(); }

  // ---------- 操作 ----------
  function bindSeg(sel, attr, fn) {
    Array.prototype.forEach.call(document.querySelectorAll(sel), function (b) {
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(document.querySelectorAll(sel), function (x) { x.classList.toggle('on', x === b); });
        fn(b.getAttribute(attr));
      });
    });
  }
  bindSeg('[data-tool]', 'data-tool', function (v) { state.tool = v; hintText(); });
  bindSeg('[data-r]', 'data-r', function (v) { state.rk = v; });
  Array.prototype.forEach.call(document.querySelectorAll('.fl'), function (b) { b.addEventListener('click', function () { state.floor = +b.getAttribute('data-fl'); render(); }); });
  function setZoom(z) {
    var box = $('map'), cx = (box.scrollLeft + box.clientWidth / 2) / box.scrollWidth, cy = (box.scrollTop + box.clientHeight / 2) / box.scrollHeight;
    state.zoom = Math.max(1, Math.min(4, z)); render();
    box.scrollLeft = cx * box.scrollWidth - box.clientWidth / 2; box.scrollTop = cy * box.scrollHeight - box.clientHeight / 2;
  }
  $('z-in').addEventListener('click', function () { setZoom(state.zoom + 1); });
  $('z-out').addEventListener('click', function () { setZoom(state.zoom - 1); });
  function scrollToPt(p) {
    var box = $('map'), vb = VB[state.floor];
    box.scrollLeft = (p.x - vb.x) / vb.w * box.scrollWidth - box.clientWidth / 2;
    box.scrollTop = (p.y - vb.y) / vb.h * box.scrollHeight - box.clientHeight / 2;
  }

  $('q').addEventListener('input', function () {
    var q = this.value, list = q ? E.search(q).slice(0, 8) : [];
    $('results').innerHTML = list.map(function (st) { return '<li><button class="res" data-id="' + st.id + '"><span class="fl-badge">' + st.floor + 'F</span><span class="res-name">' + esc(st.name) + '</span></button></li>'; }).join('') +
      (q && !list.length ? '<li class="note">見つかりません。地図で「今いる場所」をタップしても選べます。</li>' : '');
    Array.prototype.forEach.call(document.querySelectorAll('.res'), function (b) {
      b.addEventListener('click', function () {
        var st = E.storeById[b.getAttribute('data-id')];
        state.here = { floor: st.floor, x: st.door.x, y: st.door.y, label: st.floor + 'F ' + short(st.name) + 'の前', storeId: st.id };
        state.floor = st.floor; $('q').value = ''; $('results').innerHTML = '';
        recompute(); render(); scrollToPt(state.here);
        $('out').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  });
  $('wc').addEventListener('change', function () { state.wc = this.checked; recompute(); render(); });
  $('survey').addEventListener('click', function () {
    state.sv = E.survey({ hazards: state.hazards }); render();
    $('survey-out').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  // URL で状態を渡せる（スクリーンショット・説明用）：?hz=1:x:y:m,2:x:y:l&here=店名&wc=1&survey=1&fl=2
  (function readUrl() {
    var q = new URLSearchParams(location.search);
    (q.get('hz') || '').split(',').filter(Boolean).forEach(function (t) {
      var a = t.split(':'); if (a.length < 3) return; var rk = E.RADIUS[a[3]] ? a[3] : 'm'; state.seq += 1;
      var p = { x: +a[1], y: +a[2] };
      state.hazards.push({ no: state.seq, floor: +a[0], x: p.x, y: p.y, r: E.RADIUS[rk], rk: rk, near: nearStoreName(+a[0], p) });
    });
    var hn = q.get('here');
    if (hn) { var st = E.search(hn)[0]; if (st) { state.here = { floor: st.floor, x: st.door.x, y: st.door.y, label: st.floor + 'F ' + short(st.name) + 'の前', storeId: st.id }; state.floor = st.floor; } }
    if (q.get('wc') === '1') { state.wc = true; $('wc').checked = true; }
    if (q.get('zoom')) state.zoom = Math.max(1, Math.min(4, +q.get('zoom')));
    if (q.get('fl')) state.floor = +q.get('fl');
    recompute();
    if (q.get('survey') === '1') state.sv = E.survey({ hazards: state.hazards });
  })();
  hintText(); render();
  if (state.here && state.here.floor === state.floor) scrollToPt(state.here);
  window.addEventListener('resize', function () { renderMap(); });
  window.__evac = { E: E, state: state }; // 確認用
})();
