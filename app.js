/* おのだサンパーク 館内ナビ（見本）
 * 行き先：全店（公式フロア図から起こした目安）。道順：歩ける格子の上の最短経路。
 * 上半分（Nav）は画面に依存せず Node でも動く。下半分が画面。
 */
(function () {
  'use strict';
  var M = (typeof module !== 'undefined' && module.exports) ? require('./mapdata.js') : window.MAPDATA;
  var CELL = M.cell;

  // ---------- 東館（本館とは別の図。道順はまだ出せない） ----------
  var EAST = [
    ['東館1F', '暮らしの診療所', 'くらしのしんりょうじょ|クリニック|病院'], ['東館1F', '痛み改善・姿勢矯正Lab 縁-YOSUGA-', 'よすが|縁|整体'],
    ['東館1F', 'アンジェロ', 'あんじぇろ'], ['東館1F', 'クローバー薬局', 'くろーばー|薬局|くすり'],
    ['東館1F', '船鉄観光旅行社', 'ふなてつ|旅行'], ['東館1F', 'ネイス体操教室', 'ねいす|体操|習い事'],
    ['東館2F', 'ピーチ・ツリー', 'ぴーちつりー'], ['東館2F', 'ジョイ皮ふ科クリニック', 'じょい|皮膚科|ひふか|クリニック'],
    ['東館2F', '第一生命保険', 'だいいちせいめい|保険'], ['東館2F', 'カーブス', 'Curves|かーぶす|フィットネス']
  ];

  // ---------- 店の一覧 ----------
  var stores = M.stores.map(function (s, i) {
    var poly = s.polys[0] || null;
    return { id: 's' + i, name: s.name, floor: s.floor, cat: s.cat, aliases: s.aliases, polys: s.polys,
      label: { x: s.label[0], y: s.label[1] }, door: { x: s.door[0], y: s.door[1] },
      c: poly ? centroid(poly) : { x: s.label[0], y: s.label[1] }, east: false };
  });
  EAST.forEach(function (e, i) {
    stores.push({ id: 'e' + i, name: e[1], floor: e[0], cat: '東館', aliases: e[2].split('|'), polys: [], east: true });
  });
  var storeById = {}; stores.forEach(function (s) { storeById[s.id] = s; });

  // ---------- 検索 ----------
  // ひらがな→カタカナ、全角英数→半角、小文字、記号と空白を除く
  function norm(s) {
    return String(s).normalize('NFKC').toLowerCase()
      .replace(/[ぁ-ゖ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) + 0x60); })
      .replace(/[\s・･\.\-‐ー_&＆'’!！,，、。()（）\/]/g, '');
  }
  stores.forEach(function (s) { s.keys = [s.name].concat(s.aliases || []).map(norm).filter(Boolean); s.catKey = norm(s.cat); });
  function search(q) {
    var k = norm(q); if (!k) return [];
    var res = [];
    stores.forEach(function (s) {
      var best = 0;
      s.keys.forEach(function (key, i) {
        var sc = key === k ? 100 : key.indexOf(k) === 0 ? 80 : key.indexOf(k) !== -1 ? 60 : 0;
        if (sc && i > 0) sc -= 5; // 別名よりも店名の一致を上に
        if (sc > best) best = sc;
      });
      if (!best && s.catKey.indexOf(k) !== -1) best = 40;
      if (best) res.push({ s: s, score: best });
    });
    res.sort(function (a, b) { return b.score - a.score || (a.s.east - b.s.east) || String(a.s.floor).localeCompare(String(b.s.floor)) || a.s.name.localeCompare(b.s.name, 'ja'); });
    return res.map(function (r) { return r.s; });
  }

  // ---------- 歩ける格子 ----------
  var G = {};
  [1, 2].forEach(function (fl) {
    var f = M.floors[fl], w = f.w, h = f.h, a = new Uint8Array(w * h);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) a[y * w + x] = f.rows[y].charCodeAt(x) === 49 ? 1 : 0;
    G[fl] = { w: w, h: h, a: a, outline: f.outline };
  });
  function cellOf(fl, p) { return Math.floor(p.y / CELL) * G[fl].w + Math.floor(p.x / CELL); }
  function ptOf(fl, i) { var w = G[fl].w; return { x: (i % w) * CELL + CELL / 2, y: Math.floor(i / w) * CELL + CELL / 2 }; }

  // 二分ヒープつきダイクストラ（8方向）。全マスへの距離と、ひとつ前のマス
  function dijkstra(fl, src) {
    var g = G[fl], n = g.w * g.h, d = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1);
    var heap = [], D = Math.SQRT2 * CELL;
    function push(i, v) { heap.push([v, i]); var k = heap.length - 1; while (k) { var p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; var t = heap[p]; heap[p] = heap[k]; heap[k] = t; k = p; } }
    function pop() { var top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; var k = 0; for (;;) { var l = 2 * k + 1, r = l + 1, m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; var t = heap[m]; heap[m] = heap[k]; heap[k] = t; k = m; } } return top; }
    d[src] = 0; push(src, 0);
    var NB = [[1, 0, CELL], [-1, 0, CELL], [0, 1, CELL], [0, -1, CELL], [1, 1, D], [1, -1, D], [-1, 1, D], [-1, -1, D]];
    while (heap.length) {
      var t = pop(), v = t[0], i = t[1];
      if (v > d[i]) continue;
      var x = i % g.w, y = (i / g.w) | 0;
      for (var k = 0; k < 8; k++) {
        var nx = x + NB[k][0], ny = y + NB[k][1];
        if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) continue;
        var j = ny * g.w + nx; if (!g.a[j]) continue;
        if (k >= 4 && (!g.a[y * g.w + nx] || !g.a[ny * g.w + x])) continue; // 角をかすめない
        var nv = v + NB[k][2];
        if (nv < d[j]) { d[j] = nv; prev[j] = i; push(j, nv); }
      }
    }
    return { d: d, prev: prev };
  }
  var cache = {};
  function distFrom(fl, p) { var key = fl + ':' + cellOf(fl, p); return cache[key] || (cache[key] = dijkstra(fl, cellOf(fl, p))); }
  function trace(dj, to) { var out = [], i = to; while (i !== -1) { out.push(i); i = dj.prev[i]; } return out; } // to → src

  // 見通し（その線の上が全部歩けるか）
  function clear(fl, a, b) {
    var g = G[fl], n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (CELL / 3));
    for (var k = 0; k <= n; k++) {
      var x = a.x + (b.x - a.x) * k / n, y = a.y + (b.y - a.y) * k / n;
      if (!g.a[Math.floor(y / CELL) * g.w + Math.floor(x / CELL)]) return false;
    }
    return true;
  }
  // マスの列 → 曲がり角だけの折れ線（糸を引くように、見通せる所は飛ばす）
  function smooth(fl, cells) {
    var p = cells.map(function (i) { return ptOf(fl, i); });
    var out = [p[0]], a = 0;
    while (a < p.length - 1) {
      var b = p.length - 1;
      while (b > a + 1 && !clear(fl, p[a], p[b])) b--;
      out.push(p[b]); a = b;
    }
    return out;
  }

  var LIFT_COST = { escalator: 150, stairs: 230, elevator: 330 };
  var LIFT_WORD = { escalator: 'エスカレーター', stairs: '階段', elevator: 'エレベーター' };
  var lifts = {};
  M.lifts.forEach(function (l) { (lifts[l.id] = lifts[l.id] || { id: l.id, kind: l.kind, stepFree: l.stepFree, conf: l.conf })[l.floor] = l; });
  var starts = M.starts;
  var startById = {}; starts.forEach(function (s) { startById[s.id] = s; });

  // 道順：{ legs:[{floor, pts}|{lift}], cost }
  function route(startId, storeId, stepFree) {
    var st = startById[startId], ds = storeById[storeId];
    if (!st || !ds || ds.east) return null;
    var A = distFrom(st.floor, st);
    if (st.floor === ds.floor) {
      var t = cellOf(ds.floor, ds.door);
      if (A.d[t] === Infinity) return null;
      return { legs: [{ floor: st.floor, pts: smooth(st.floor, trace(A, t).reverse()) }], cost: A.d[t] };
    }
    var B = distFrom(ds.floor, ds.door), best = null;
    Object.keys(lifts).forEach(function (k) {
      var L = lifts[k]; if (stepFree && !L.stepFree) return;
      var la = L[st.floor], lb = L[ds.floor];
      var c = A.d[cellOf(st.floor, la)] + LIFT_COST[L.kind] + B.d[cellOf(ds.floor, lb)];
      if (c < (best ? best.c : Infinity)) best = { c: c, L: L };
    });
    if (!best) return null;
    var L = best.L, la = L[st.floor], lb = L[ds.floor];
    var leg1 = smooth(st.floor, trace(A, cellOf(st.floor, la)).reverse());
    var leg2 = smooth(ds.floor, trace(B, cellOf(ds.floor, lb))); // B は行き先から測ったので、そのまま lift→行き先 の順
    return { legs: [{ floor: st.floor, pts: leg1 }, { lift: L, from: st.floor, to: ds.floor }, { floor: ds.floor, pts: leg2 }], cost: best.c };
  }

  // ---------- 形 ----------
  function centroid(poly) {
    var a = 0, x = 0, y = 0;
    for (var i = 0; i < poly.length; i++) {
      var p = poly[i], q = poly[(i + 1) % poly.length], cr = p[0] * q[1] - q[0] * p[1];
      a += cr; x += (p[0] + q[0]) * cr; y += (p[1] + q[1]) * cr;
    }
    if (Math.abs(a) < 1e-6) return { x: poly[0][0], y: poly[0][1] };
    return { x: x / (3 * a), y: y / (3 * a) };
  }
  function ptSeg(p, a, b) {
    var vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy;
    var t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2)) : 0;
    return { d: Math.hypot(p.x - a.x - t * vx, p.y - a.y - t * vy), t: t };
  }
  function polyDist(p, polys) { // 点から店の縁（いちばん近い区画）まで
    var best = Infinity;
    polys.forEach(function (poly) { for (var i = 0; i < poly.length; i++) { var a = { x: poly[i][0], y: poly[i][1] }, q = poly[(i + 1) % poly.length]; var r = ptSeg(p, a, { x: q[0], y: q[1] }); if (r.d < best) best = r.d; } });
    return best;
  }
  function storeDist(p, s) { return s.polys.length ? polyDist(p, s.polys) : Math.hypot(p.x - s.door.x, p.y - s.door.y); }

  // ---------- 案内文 ----------
  function hd(a, b) { return [b.x - a.x, b.y - a.y]; }
  function turnDeg(h1, h2) { return Math.atan2(h1[0] * h2[1] - h1[1] * h2[0], h1[0] * h2[0] + h1[1] * h2[1]) * 180 / Math.PI; }
  function turnWord(deg) { var a = Math.abs(deg); if (a < 35) return null; if (a > 140) return '振り返るように'; return deg > 0 ? (a > 110 ? '右へ大きく' : '右へ') : (a > 110 ? '左へ大きく' : '左へ'); }
  function side(h, from, p) {
    var cr = h[0] * (p.y - from.y) - h[1] * (p.x - from.x), dt = h[0] * (p.x - from.x) + h[1] * (p.y - from.y);
    if (Math.abs(Math.atan2(cr, dt)) * 180 / Math.PI < 28) return '正面';
    return cr > 0 ? '右手' : '左手';
  }
  // 目印に使う店（トイレ・案内所・行き先は除く、大きさのある区画を持つ店）
  function markable(s, dest) { return !s.east && s.id !== dest.id && s.polys.length && s.cat !== 'トイレ'; }
  // 角の目印：その点にいちばん近い店
  function nearestStore(fl, p, dest, maxd, avoid) {
    var best = null;
    stores.forEach(function (s) {
      if (s.floor !== fl || !markable(s, dest) || (avoid && avoid[s.name])) return;
      var d = storeDist(p, s); if (d < maxd && (!best || d < best.d)) best = { s: s, d: d };
    });
    return best && best.s;
  }
  // 区間の途中の目印：道から近い店を、通る順に2つまで
  function along(fl, a, b, dest, said) {
    var h = hd(a, b), len = Math.hypot(h[0], h[1]), found = {};
    if (len < 50) return [];
    stores.forEach(function (s) {
      if (s.floor !== fl || !markable(s, dest) || said[s.name]) return;
      var c = s.c, r = ptSeg(c, a, b);
      if (r.t <= 0.08 || r.t >= 0.92) return;
      var dd = storeDist({ x: a.x + (b.x - a.x) * r.t, y: a.y + (b.y - a.y) * r.t }, s);
      if (dd > 40) return;
      var sd = side(h, a, c); if (sd === '正面') return;
      if (!found[s.name] || dd < found[s.name].d) found[s.name] = { name: s.name, t: r.t, d: dd, side: sd };
    });
    var list = Object.keys(found).map(function (k) { return found[k]; }).sort(function (x, y) { return x.d - y.d; }).slice(0, 2);
    return list.sort(function (x, y) { return x.t - y.t; });
  }
  function alongPhrase(list) {
    if (!list.length) return '';
    var by = {}, order = [];
    list.forEach(function (l) { if (!by[l.side]) { by[l.side] = []; order.push(l.side); } by[l.side].push(l.name); });
    return order.map(function (sd) { return by[sd].join('・') + 'を' + sd + 'に'; }).join('、') + '見ながら、';
  }

  // 折れ線を、曲がり角でまとめ直す（短い区間・浅い曲がりは前の区間に含める）
  function legsOf(pts) {
    var segs = [];
    for (var i = 0; i + 1 < pts.length; i++) segs.push([pts[i], pts[i + 1]]);
    var out = [];
    segs.forEach(function (sg) {
      var len = Math.hypot(sg[1].x - sg[0].x, sg[1].y - sg[0].y);
      var last = out[out.length - 1];
      if (last) {
        var lp = last.pts, lh = hd(lp[lp.length - 2], lp[lp.length - 1]), deg = turnDeg(lh, hd(sg[0], sg[1]));
        if (Math.abs(deg) < 35 || len < 28) { last.b = sg[1]; last.pts.push(sg[1]); return; }
      }
      out.push({ a: sg[0], b: sg[1], pts: [sg[0], sg[1]] });
    });
    return out;
  }

  // 道順 → カード
  function cards(r, dest, startId, avoidName) { // avoidName：目印に使わない店（寄り道コースで、いま出てきた店）
    var startIsEntrance = !startId || /入口/.test((startById[startId] || {}).label || '入口');
    var out = [], said = {}; said[dest.name] = true; if (avoidName) said[avoidName] = true;
    var walks = r.legs.filter(function (l) { return !l.lift; });
    r.legs.forEach(function (leg, li) {
      if (leg.lift) {
        var L = leg.lift, p = L[leg.from], near = nearestStore(leg.from, { x: p.sx, y: p.sy }, dest, 90);
        out.push({ kind: 'lift', floor: leg.from, floorTo: leg.to, pts: [{ x: p.sx, y: p.sy }],
          text: LIFT_WORD[L.kind] + 'で' + leg.to + '階へ' + (leg.from < leg.to ? '上がります。' : '下ります。'),
          sub: near ? near.name + 'のそばの' + LIFT_WORD[L.kind] : '', near: near ? near.name : null });
        return;
      }
      var parts = legsOf(leg.pts), isLastWalk = leg === walks[walks.length - 1];
      var prevH = null;
      parts.forEach(function (pt, k) {
        var h = hd(pt.a, pt.b), h0 = hd(pt.pts[0], pt.pts[1]), np_ = pt.pts.length, head = '';
        if (k === 0) head = li === 0 ? '' : '降りたら、';
        else { var tw = turnWord(turnDeg(prevH, h0)); head = tw ? tw + '曲がって、' : ''; }
        prevH = hd(pt.pts[np_ - 2], pt.pts[np_ - 1]);
        var al = along(leg.floor, pt.a, pt.b, dest, said), marks = al.map(function (x) { return x.name; });
        var mid = alongPhrase(al);
        al.forEach(function (x) { said[x.name] = true; });
        var tail;
        var lastPart = k === parts.length - 1;
        if (lastPart && isLastWalk) tail = dest.name + 'の前まで進みます。';
        else if (lastPart) tail = LIFT_WORD[r.legs[li + 1].lift.kind] + 'まで進みます。';
        else {
          var nx = nearestStore(leg.floor, pt.b, dest, 70, said);
          if (nx) { said[nx.name] = true; marks.push(nx.name); tail = nx.name + 'の前まで進みます。'; }
          else tail = 'その先の曲がり角まで進みます。';
        }
        if (k === 0 && li === 0) head = startIsEntrance ? '入口を入って、' : '';
        out.push({ kind: 'walk', floor: leg.floor, pts: pt.pts, text: head + mid + tail, marks: marks });
      });
    });
    // 到着：最後の区間の向きから、店が右手・左手・正面のどれか
    var lw = walks[walks.length - 1].pts, n = lw.length, sd = '目の前';
    if (n >= 2) { var s2 = side(hd(lw[n - 2], lw[n - 1]), lw[n - 1], dest.c); sd = s2 === '正面' ? '正面' : s2; }
    out.push({ kind: 'arrive', floor: dest.floor, pts: [lw[n - 1]],
      text: dest.name + 'は' + sd + 'です。', sub: '店舗前の目安です。入口の位置は現地でご確認ください。' });
    return out;
  }

  // ---------- 寄り道コース（店の前から次の店へ） ----------
  // route() と同じ計算を、入口ではなく任意の点（店の前＝door）から行う。route() 自体は変えない。
  function routeFromPoint(pt, storeId, stepFree) {
    var ds = storeById[storeId];
    if (!pt || !ds || ds.east || !G[pt.floor]) return null;
    var A = distFrom(pt.floor, pt);
    if (pt.floor === ds.floor) {
      var t = cellOf(ds.floor, ds.door);
      if (A.d[t] === Infinity) return null;
      return { legs: [{ floor: pt.floor, pts: smooth(pt.floor, trace(A, t).reverse()) }], cost: A.d[t] };
    }
    var B = distFrom(ds.floor, ds.door), best = null;
    Object.keys(lifts).forEach(function (k) {
      var L = lifts[k]; if (stepFree && !L.stepFree) return;
      var la = L[pt.floor], lb = L[ds.floor]; if (!la || !lb) return;
      var c = A.d[cellOf(pt.floor, la)] + LIFT_COST[L.kind] + B.d[cellOf(ds.floor, lb)];
      if (c < (best ? best.c : Infinity)) best = { c: c, L: L };
    });
    if (!best || best.c === Infinity) return null;
    var L = best.L, la = L[pt.floor], lb = L[ds.floor];
    return { legs: [{ floor: pt.floor, pts: smooth(pt.floor, trace(A, cellOf(pt.floor, la)).reverse()) }, { lift: L, from: pt.floor, to: ds.floor }, { floor: ds.floor, pts: smooth(ds.floor, trace(B, cellOf(ds.floor, lb))) }], cost: best.c };
  }
  // 出発点：入口ID または 店ID（その店の前）
  function pointOf(id) {
    if (startById[id]) { var s = startById[id]; return { floor: s.floor, x: s.x, y: s.y, label: s.label, entrance: true }; }
    var st = storeById[id];
    if (st && !st.east) return { floor: st.floor, x: st.door.x, y: st.door.y, label: st.name + 'の前', entrance: false, storeId: st.id };
    return null;
  }
  // 1区間ぶん：道順とカード。店の前からの区間は、最初の言い回しを「◯◯の前から」に直す
  function legOf(fromId, toId, stepFree) {
    var p = pointOf(fromId), d = storeById[toId]; if (!p || !d || d.east) return null;
    var r = p.entrance ? route(fromId, toId, stepFree) : routeFromPoint(p, toId, stepFree);
    if (!r) return null;
    var cs = cards(r, d, p.entrance ? fromId : undefined, p.entrance ? undefined : storeById[fromId].name);
    if (!p.entrance && cs[0] && cs[0].kind === 'walk') cs[0].text = cs[0].text.replace(/^入口を入って、/, p.label + 'から、');
    return { from: fromId, to: toId, r: r, cards: cs, cost: r.cost };
  }
  function floorMoves(r) { return r.legs.filter(function (l) { return l.lift; }).length; }
  // 決めた順番どおりに区間をつなぐ
  function courseLegs(startId, ids, stepFree) {
    var out = [], from = startId;
    for (var i = 0; i < ids.length; i++) { var lg = legOf(from, ids[i], stepFree); if (!lg) return null; out.push(lg); from = ids[i]; }
    return out;
  }
  // 近い順（貪欲法）：いまいる所から、道のりがいちばん短い店を次に選ぶ。道順が出ない店・東館は外す
  function courseOrder(startId, ids, stepFree) {
    var left = [], skipped = [], seen = {};
    ids.forEach(function (id) { var s = storeById[id]; if (seen[id]) return; seen[id] = 1; if (!s || s.east) skipped.push(id); else left.push(id); });
    var legs = [], from = startId;
    if (!pointOf(startId)) return null;
    while (left.length) {
      var best = null;
      left.forEach(function (id) { var lg = legOf(from, id, stepFree); if (lg && (!best || lg.cost < best.cost)) best = lg; });
      if (!best) { skipped = skipped.concat(left); break; }
      legs.push(best); left.splice(left.indexOf(best.to), 1); from = best.to;
    }
    return { order: legs.map(function (l) { return l.to; }), legs: legs, skipped: skipped,
      moves: legs.reduce(function (a, l) { return a + floorMoves(l.r); }, 0) };
  }
  // 館内QR：?here=<入口ID> を入口に解決する（知らないIDは null）
  function hereFrom(search) {
    var id; try { id = new URLSearchParams(search || '').get('here'); } catch (e) { return null; }
    return id && startById[id] ? id : null;
  }

  var Nav = { M: M, stores: stores, storeById: storeById, search: search, route: route, cards: cards, starts: starts, lifts: lifts, norm: norm,
    startById: startById, routeFromPoint: routeFromPoint, pointOf: pointOf, legOf: legOf, courseLegs: courseLegs, courseOrder: courseOrder, floorMoves: floorMoves, hereFrom: hereFrom, CELL: CELL,
    PUBLIC_URL: 'https://katsuraharuki.github.io/sunpark-navi/index.html' };
  if (typeof module !== 'undefined' && module.exports) { module.exports = Nav; return; }
  window.Nav = Nav;
  if (document.body.dataset.explore) return;

  // ======================= 画面 =======================
  var $ = function (id) { return document.getElementById(id); };
  var state = { from: null, to: null, stepFree: false, idx: 0, mapFloor: 1, r: null, cards: null, q: '', course: null, cl: 0, legs: null, nz: null };
  var REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  // いまの区間の出発点（コースの2区間目からは、前の店の前）
  function legStart() { return state.course && state.cl > 0 ? pointOf(state.course[state.cl - 1]) : pointOf(state.from); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function floorLabel(f) { return typeof f === 'number' ? f + 'F' : f; }

  function readUrl() {
    var q = new URLSearchParams(location.search);
    if (startById[q.get('from')]) state.from = q.get('from');
    var to = q.get('to');
    if (to) { var hit = stores.filter(function (s) { return s.name === to; })[0]; if (hit) state.to = hit.id; }
    state.stepFree = q.get('stepfree') === '1';
    var cs = (q.get('course') || '').split(',').filter(function (id, i, a) { return storeById[id] && !storeById[id].east && a.indexOf(id) === i; }).slice(0, 6);
    if (cs.length) { state.course = cs; state.cl = Math.max(0, Math.min(cs.length - 1, parseInt(q.get('leg'), 10) || 0)); state.to = cs[state.cl]; }
  }
  function writeUrl() {
    var q = new URLSearchParams();
    if (state.from) q.set('from', state.from);
    if (state.course) { q.set('course', state.course.join(',')); q.set('leg', String(state.cl)); }
    else if (state.to) q.set('to', storeById[state.to].name);
    if (state.stepFree) q.set('stepfree', '1');
    var s = q.toString();
    try { history.replaceState(null, '', location.pathname + (s ? '?' + s : '')); } catch (e) { /* file:// など */ }
  }
  function compute() {
    state.r = null; state.cards = null; state.idx = 0;
    if (state.course) {
      state.legs = state.from ? courseLegs(state.from, state.course, state.stepFree) : null;
      state.to = state.course[state.cl];
      if (state.legs) { var lg = state.legs[state.cl]; state.r = lg.r; state.cards = lg.cards; state.mapFloor = state.cards[0].floor; }
      return;
    }
    if (!state.from || !state.to || storeById[state.to].east) return;
    state.r = route(state.from, state.to, state.stepFree);
    if (state.r) { state.cards = cards(state.r, storeById[state.to], state.from); state.mapFloor = state.cards[0].floor; }
  }

  // ---------- 検索の画面 ----------
  var QUICK = ['DAISO・Standard Products', 'ユニクロ', '無印良品', 'スターバックス コーヒー', 'マクドナルド', 'フードウェイ'];
  var CATS = [['トイレ', 'トイレ'], ['飲食', 'ごはん・カフェ'], ['ファッション', 'ファッション'], ['雑貨', '雑貨'], ['携帯電話', 'スマホ'], ['銀行・ATM', 'ATM']];

  function rowHtml(s) {
    return '<li><button class="res" data-id="' + s.id + '"><span class="fl-badge' + (s.east ? ' east' : '') + '">' + esc(floorLabel(s.floor)) + '</span>' +
      '<span class="res-name">' + esc(s.name) + '</span><span class="res-cat">' + esc(s.cat) + '</span></button></li>';
  }
  function renderHome() {
    var q = state.q, html = '';
    if (!q) {
      html += '<section class="block"><h2 class="h">主な行き先</h2><div class="chips">' +
        QUICK.map(function (n) { var s = stores.filter(function (x) { return x.name === n; })[0]; return s ? '<button class="chip" data-id="' + s.id + '">' + esc(s.name.replace(/・Standard Products| コーヒー/, '')) + '</button>' : ''; }).join('') + '</div></section>';
      html += '<section class="block"><h2 class="h">種類から探す</h2><div class="chips">' +
        CATS.map(function (c) { return '<button class="chip ghost" data-q="' + esc(c[0]) + '">' + esc(c[1]) + '</button>'; }).join('') + '</div></section>';
      if (state.from) html += '<p class="from-now">いまの場所：<b>' + esc(startById[state.from].label) + '</b>　<button class="link" id="change-from">変える</button></p>';
    } else {
      var list = search(q);
      html += '<p class="count">' + (list.length ? list.length + '件' : '見つかりませんでした。店名の一部や、ひらがなでもお試しください。') + '</p>';
      html += '<ul class="results">' + list.map(rowHtml).join('') + '</ul>';
    }
    $('main').innerHTML = html;
    bind('.chip[data-id], .res', function (b) { choose(b.getAttribute('data-id')); });
    bind('.chip[data-q]', function (b) { state.q = b.getAttribute('data-q'); $('q').value = state.q; render(); });
    var cf = $('change-from'); if (cf) cf.addEventListener('click', function () { state.from = null; writeUrl(); render(); });
  }
  function bind(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), function (b) { b.addEventListener('click', function () { fn(b); }); }); }
  function choose(id) { state.to = id; state.q = ''; $('q').value = ''; writeUrl(); compute(); render(); window.scrollTo(0, 0); }

  // ---------- 出発点の画面 ----------
  function renderStart() {
    var d = storeById[state.to];
    var html = destHead(d) + '<h2 class="h q">いまどこにいますか？</h2><div class="starts">';
    starts.forEach(function (s) { html += '<button class="start-btn" data-from="' + s.id + '"><span class="fl-badge">' + s.floor + 'F</span>' + esc(s.label.replace(/^[12]F /, '')) + '</button>'; });
    html += '</div><p class="hint">館内のQRシールを読み取ると、この質問は省かれます。</p>';
    $('main').innerHTML = html;
    bind('.start-btn', function (b) { state.from = b.getAttribute('data-from'); writeUrl(); compute(); render(); });
    bindDestHead();
  }
  function destHead(d) {
    return '<div class="dest"><span class="dest-pin" aria-hidden="true"></span><div class="dest-body"><p class="dest-label">行き先</p>' +
      '<p class="dest-name">' + esc(d.name) + '</p><p class="dest-meta">' + esc(floorLabel(d.floor)) + '・' + esc(d.cat) + '</p></div>' +
      '<button class="link" id="change-to">変える</button></div>';
  }
  function bindDestHead() { var b = $('change-to'); if (b) b.addEventListener('click', function () { state.to = null; state.course = null; writeUrl(); compute(); render(); setTimeout(function () { $('q').focus(); }, 0); }); }

  // ---------- 道順の画面 ----------
  function renderRoute() {
    var d = storeById[state.to], cs = state.cards, c = cs[state.idx], co = state.course, last = !co || state.cl === co.length - 1;
    var html = '';
    if (co) {
      html += '<section class="course" aria-label="寄り道コース"><p class="course-h">寄り道コース <b>' + (state.cl + 1) + '</b> / ' + co.length + '店目</p><ol class="course-list">' +
        co.map(function (id, i) { return '<li class="' + (i < state.cl ? 'done' : i === state.cl ? 'now' : '') + '"><span>' + (i + 1) + '</span>' + esc(storeById[id].name.replace(/・Standard Products/, '')) + '</li>'; }).join('') +
        '</ol><button class="link" id="quit-course">コースをやめる</button></section>';
    }
    html += destHead(d);
    var sp = legStart();
    html += '<div class="opts"><p class="from-now">出発：<b>' + esc(sp.label) + '</b>' + (!co || state.cl === 0 ? '　<button class="link" id="change-from">変える</button>' : '') + '</p>' +
      '<div class="seg-wrap" role="group" aria-label="道の選び方"><button class="seg' + (state.stepFree ? '' : ' on') + '" data-sf="0">ふつう</button>' +
      '<button class="seg' + (state.stepFree ? ' on' : '') + '" data-sf="1">車いす・ベビーカー</button></div></div>';
    var stepTag = c.kind === 'arrive' ? '到着' : (state.idx + 1) + ' / ' + (cs.length - 1);
    html += '<section class="card' + (c.kind === 'arrive' ? ' arrive' : '') + '" aria-live="polite">' +
      '<div class="card-top"><span class="step-no">' + stepTag + '</span><span class="card-fl">' + c.floor + '階' + (c.kind === 'lift' ? ' → ' + c.floorTo + '階' : '') + '</span></div>' +
      '<p class="card-text">' + esc(c.text) + '</p>' + (c.sub ? '<p class="card-sub">' + esc(c.sub) + '</p>' : '') +
      (c.kind === 'arrive' && co ? '<p class="card-sub">' + (last ? 'コースの最後のお店です。' : '次は ' + esc(storeById[co[state.cl + 1]].name) + ' です。') + '</p>' : '') +
      '<div class="nav"><button id="prev" class="btn"' + (state.idx === 0 && !(co && state.cl > 0) ? ' disabled' : '') + '>' + (state.idx === 0 && co && state.cl > 0 ? '前の店へ' : '前へ') + '</button>' +
      (state.idx === cs.length - 1 ? (last ? '<button id="again" class="btn primary">' + (co ? 'コースを終える' : 'ほかの店を探す') + '</button>' : '<button id="next-stop" class="btn primary">次の店へ →</button>') : '<button id="next" class="btn primary">次へ</button>') + '</div></section>';
    var floorsUsed = {}; cs.forEach(function (x) { floorsUsed[x.floor] = 1; if (x.floorTo) floorsUsed[x.floorTo] = 1; });
    html += '<div class="map-head"><div class="floors">' + [1, 2].map(function (f) { return '<button class="fl' + (state.mapFloor === f ? ' on' : '') + '" data-fl="' + f + '">' + f + 'F' + (floorsUsed[f] ? '' : '') + '</button>'; }).join('') +
      '</div><p class="legend"><span class="lg lg-route"></span>道順　<span class="lg lg-dest"></span>行き先</p></div>';
    state.nz = null; // カードを進めた・階を替えた時は、今までどおり、その区間が見える位置に戻す
    html += '<div class="map-wrap"><div class="map" id="nmap">' + renderMap() + '</div><div class="nzoom"><button type="button" id="nz-in" aria-label="地図を拡大">＋</button><button type="button" id="nz-out" aria-label="地図を縮小">−</button><button type="button" id="nz-reset" aria-label="地図の拡大を戻す">↺</button></div></div>';
    html += '<p class="nz-hint" hidden>Ctrl（⌘）＋ホイールで地図を拡大できます</p>'; html += '<p class="hint">' + (state.stepFree ? 'エレベーターだけを使う道順の目安です。段差・通路幅・扉は現地未確認です。' : '公式フロアマップから起こした道順の目安です（現地未確認）。') + '</p>';
    $('main').innerHTML = html; bindZoom();
    $('prev').addEventListener('click', function () { if (state.idx === 0 && co && state.cl > 0) setLeg(state.cl - 1, true); else go(-1); });
    if ($('next')) $('next').addEventListener('click', function () { go(1); });
    if ($('next-stop')) $('next-stop').addEventListener('click', function () { setLeg(state.cl + 1, false); });
    if ($('again')) $('again').addEventListener('click', function () { state.course = null; state.to = null; writeUrl(); compute(); render(); setTimeout(function () { $('q').focus(); }, 0); });
    if ($('quit-course')) $('quit-course').addEventListener('click', function () { state.course = null; writeUrl(); compute(); render(); });
    if ($('change-from')) $('change-from').addEventListener('click', function () { state.from = null; writeUrl(); compute(); render(); });
    bind('.seg', function (b) { state.stepFree = b.getAttribute('data-sf') === '1'; writeUrl(); compute(); render(); });
    bind('.fl', function (b) { state.mapFloor = +b.getAttribute('data-fl'); render(); });
    bindDestHead();
  }
  // コースの区間を切り替える（atEnd：前の店へ戻る時は、その区間の到着カードを出す）
  function setLeg(n, atEnd) {
    if (!state.course || n < 0 || n >= state.course.length) return;
    state.cl = n; writeUrl(); compute();
    if (state.cards && atEnd) { state.idx = state.cards.length - 1; state.mapFloor = state.cards[state.idx].floor; }
    render(); window.scrollTo(0, 0);
  }
  function go(dlt) {
    var n = state.idx + dlt; if (n < 0 || n >= state.cards.length) return;
    state.idx = n; var c = state.cards[n];
    state.mapFloor = c.kind === 'lift' ? c.floorTo : c.floor;
    render();
  }

  // ---------- 地図 ----------
  function pp(poly) { return poly.map(function (p) { return p[0] + ',' + p[1]; }).join(' '); }
  function pl(pts) { return pts.map(function (p) { return Math.round(p.x) + ',' + Math.round(p.y); }).join(' '); }
  function viewBox(fl) {
    var xs = [], ys = [];
    state.cards.forEach(function (c) { if (c.floor === fl && c.kind !== 'lift') c.pts.forEach(function (p) { xs.push(p.x); ys.push(p.y); }); });
    state.cards.forEach(function (c) { if (c.kind === 'lift' && (c.floor === fl || c.floorTo === fl)) { xs.push(c.pts[0].x); ys.push(c.pts[0].y); } });
    var d = storeById[state.to];
    if (d.floor === fl) { xs.push(d.c.x, d.door.x); ys.push(d.c.y, d.door.y); }
    if (!xs.length) { G[fl].outline.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); }
    var pad = 90, x0 = Math.min.apply(null, xs) - pad, x1 = Math.max.apply(null, xs) + pad, y0 = Math.min.apply(null, ys) - pad, y1 = Math.max.apply(null, ys) + pad;
    var w = Math.max(x1 - x0, 460), h = Math.max(y1 - y0, 340);
    if (w / h > 1.4) h = w / 1.4; else if (w / h < 1.0) w = h;
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return { x: cx - w / 2, y: cy - h / 2, w: w, h: h };
  }
  // ---------- 道順画面の地図の拡大（＋−↺・ピンチ・拡大中のドラッグ・Ctrl＋ホイール） ----------
  // 区間が見える枠（viewBox）を基準に、その中を拡大する。線・点・ピン・「出発」は地図の座標のままなので位置は変わらない
  var NZMAX = 6, nzDrag = { pts: {}, moved: 0, justMoved: false, d0: 0, z0: 1, timer: 0 };
  function zoomedBox(vb) {
    var v = state.nz; if (!v || v.z <= 1.001) { state.nz = null; return vb; }
    var w = vb.w / v.z, h = vb.h / v.z;
    v.cx = Math.min(vb.x + vb.w - w / 2, Math.max(vb.x + w / 2, v.cx)); v.cy = Math.min(vb.y + vb.h - h / 2, Math.max(vb.y + h / 2, v.cy));
    return { x: v.cx - w / 2, y: v.cy - h / 2, w: w, h: h };
  }
  function setNz(z, cx, cy) {
    var b = viewBox(state.mapFloor); z = Math.max(1, Math.min(NZMAX, z));
    if (z <= 1.001) { state.nz = null; return; }
    var v = state.nz || { cx: b.x + b.w / 2, cy: b.y + b.h / 2 };
    state.nz = { z: z, cx: cx == null ? v.cx : cx, cy: cy == null ? v.cy : cy };
  }
  function nmapSvg() { var m = $('nmap'); return m && m.querySelector('svg'); }
  function refreshMap() { var m = $('nmap'); if (!m) return; m.innerHTML = renderMap(); m.classList.toggle('zoomed', !!state.nz); }
  function liveNz() {
    var sv = nmapSvg(); if (!sv) return;
    var vb = zoomedBox(viewBox(state.mapFloor));
    sv.setAttribute('viewBox', [vb.x, vb.y, vb.w, vb.h].join(' '));
    $('nmap').classList.toggle('zoomed', !!state.nz);
    clearTimeout(nzDrag.timer); nzDrag.timer = setTimeout(refreshMap, 140); // 動きが止まったら、記号と名前を今の拡大率で描き直す
  }
  function nzAround(clientX, clientY, z) {
    var sv = nmapSvg(); if (!sv) return;
    var m = sv.getScreenCTM(), b = viewBox(state.mapFloor), r = sv.getBoundingClientRect();
    z = Math.max(1, Math.min(NZMAX, z));
    if (!m) { setNz(z); liveNz(); return; }
    var pt = sv.createSVGPoint(); pt.x = clientX; pt.y = clientY; var p = pt.matrixTransform(m.inverse());
    var s = Math.min(r.width / (b.w / z), r.height / (b.h / z));
    setNz(z, p.x - (clientX - (r.left + r.width / 2)) / s, p.y - (clientY - (r.top + r.height / 2)) / s); liveNz();
  }
  function bindZoom() {
    var m = $('nmap'); if (!m) return;
    $('nz-in').addEventListener('click', function () {
      var cur = state.cards[state.idx], c = null;
      if (!state.nz && cur && cur.floor === state.mapFloor && cur.pts && cur.pts.length) { var a = cur.pts[0], b = cur.pts[cur.pts.length - 1]; c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; } // 最初の拡大は、いまのカードの区間を真ん中に
      setNz((state.nz ? state.nz.z : 1) * 1.6, c && c.x, c && c.y); refreshMap();
    });
    $('nz-out').addEventListener('click', function () { setNz((state.nz ? state.nz.z : 1) / 1.6); refreshMap(); });
    $('nz-reset').addEventListener('click', function () { state.nz = null; refreshMap(); });
    m.addEventListener('pointerdown', function (e) {
      if (e.button) return; nzDrag.pts[e.pointerId] = { x: e.clientX, y: e.clientY }; nzDrag.moved = 0; nzDrag.justMoved = false;
      var k = Object.keys(nzDrag.pts);
      if (k.length === 2) { var a = nzDrag.pts[k[0]], c = nzDrag.pts[k[1]]; nzDrag.d0 = Math.hypot(a.x - c.x, a.y - c.y); nzDrag.z0 = state.nz ? state.nz.z : 1; }
    });
    m.addEventListener('pointermove', function (e) {
      var prev = nzDrag.pts[e.pointerId]; if (!prev) return; nzDrag.pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var k = Object.keys(nzDrag.pts);
      if (k.length === 2 && nzDrag.d0) { var a = nzDrag.pts[k[0]], c = nzDrag.pts[k[1]]; nzDrag.justMoved = true; nzAround((a.x + c.x) / 2, (a.y + c.y) / 2, nzDrag.z0 * Math.hypot(a.x - c.x, a.y - c.y) / nzDrag.d0); return; }
      if (k.length !== 1 || !state.nz) return;
      var dx = e.clientX - prev.x, dy = e.clientY - prev.y; nzDrag.moved += Math.abs(dx) + Math.abs(dy); if (nzDrag.moved < 6) return;
      if (!nzDrag.justMoved) { nzDrag.justMoved = true; try { m.setPointerCapture(e.pointerId); } catch (_) {} }
      var sv = nmapSvg(), r = sv.getBoundingClientRect(), vb = zoomedBox(viewBox(state.mapFloor)), s = Math.min(r.width / vb.w, r.height / vb.h);
      state.nz.cx -= dx / s; state.nz.cy -= dy / s; liveNz();
    });
    function end(e) { delete nzDrag.pts[e.pointerId]; if (Object.keys(nzDrag.pts).length < 2) nzDrag.d0 = 0; }
    m.addEventListener('pointerup', end); m.addEventListener('pointercancel', end);
    var hintAt = 0;
    m.addEventListener('wheel', function (e) {
      if (!(e.ctrlKey || e.metaKey)) { if (Date.now() - hintAt > 6000) { hintAt = Date.now(); var h = document.querySelector('#main .nz-hint'); if (h) { h.hidden = false; setTimeout(function () { h.hidden = true; }, 2400); } } return; }
      e.preventDefault(); nzAround(e.clientX, e.clientY, (state.nz ? state.nz.z : 1) * Math.exp(-e.deltaY * 0.0022));
    }, { passive: false });
  }
  var LIFT_ICON = { escalator: 'エス', stairs: '階段', elevator: 'EV' };
  function renderMap() {
    var fl = state.mapFloor, vb = zoomedBox(viewBox(fl)), u = vb.w / 360, d = storeById[state.to], cur = state.cards[state.idx];
    var s = '<svg viewBox="' + [vb.x, vb.y, vb.w, vb.h].map(Math.round).join(' ') + '" role="img" aria-label="' + fl + '階の地図">';
    s += '<defs><marker id="arw" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto-start-reverse"><path d="M1,1 L9,5 L1,9 z" fill="#fff"/></marker></defs>';
    s += '<polygon points="' + pp(G[fl].outline) + '" fill="#fff" stroke="#b9c2b5" stroke-width="' + 1.4 * u + '" stroke-linejoin="round"/>';
    (M.floors[fl].voids || []).forEach(function (p) { var c = centroid(p); s += '<polygon points="' + pp(p) + '" fill="#e4ebf1" stroke="#c3cfda" stroke-width="' + 0.7 * u + '"/><text x="' + c.x + '" y="' + c.y + '" font-size="' + 6 * u + '" text-anchor="middle" dominant-baseline="middle" fill="#7d8b99">吹抜</text>'; });
    (M.unnamed[fl] || []).forEach(function (p) { s += '<polygon points="' + pp(p) + '" fill="#eef1ec" stroke="#d9ded5" stroke-width="' + 0.6 * u + '"/>'; });
    var routeNames = {};
    state.cards.forEach(function (c) { (c.marks || []).forEach(function (n) { routeNames[n] = 1; }); if (c.near) routeNames[c.near] = 1; });
    stores.forEach(function (st) {
      if (st.floor !== fl || !st.polys.length || st.id === d.id) return;
      st.polys.forEach(function (p) { s += '<polygon points="' + pp(p) + '" fill="' + (routeNames[st.name] ? '#e3efd2' : '#f1f6e9') + '" stroke="#c9d6b8" stroke-width="' + 0.7 * u + '"/>'; });
    });
    // 店名：区画に入る大きさのものだけ。道順の目印は必ず出す
    stores.forEach(function (st) {
      if (st.floor !== fl || !st.polys.length || st.id === d.id) return;
      var poly = st.polys[0], xs = poly.map(function (p) { return p[0]; }), ys = poly.map(function (p) { return p[1]; });
      var bw = Math.max.apply(null, xs) - Math.min.apply(null, xs), bh = Math.max.apply(null, ys) - Math.min.apply(null, ys);
      var nm = st.name.replace(/（.*?）/g, ''), fs = Math.min(8.5 * u, bw / (nm.length * 1.0));
      var must = routeNames[st.name];
      if (!must && (fs < 5.2 * u || bh < 7 * u)) return;
      if (must) fs = Math.max(fs, 6.5 * u);
      var c = centroid(poly), IC = window.SunparkIcons;
      // 店名の横に小さく記号（入りきる時だけ。入らなければ今までどおり名前だけ）
      if (IC) {
        var fs2 = Math.min(fs, bw / (nm.length + 1.6));
        if (fs2 >= (must ? 5 : 5.2) * u && bh >= fs2 * 1.6) {
          fs = fs2; var icw = fs * 1.15, tw = nm.length * fs;
          s += IC.group(IC.kind(st), c.x - (tw + icw * 1.25) / 2 + icw / 2, c.y, icw, must ? '#1d4a32' : '#5d7a66', null);
          c = { x: c.x + icw * 0.625, y: c.y };
        }
      }
      s += '<text x="' + c.x + '" y="' + c.y + '" font-size="' + fs + '" text-anchor="middle" dominant-baseline="middle" fill="' + (must ? '#1f3b2a' : '#6b7568') + '"' + (must ? ' font-weight="700" paint-order="stroke" stroke="#fff" stroke-width="' + 2.2 * u + '"' : '') + '>' + esc(nm) + '</text>';
    });
    // 行き先
    if (d.floor === fl) {
      d.polys.forEach(function (p) { s += '<polygon points="' + pp(p) + '" fill="#fde3cc" stroke="#eb6b00" stroke-width="' + 2.2 * u + '"/>'; });
    }
    // 道順（全体は細く、いまのカードは太く。白い縁どり＋矢印）
    state.cards.forEach(function (c) {
      if (c.floor !== fl || c.kind !== 'walk') return;
      s += '<polyline points="' + pl(c.pts) + '" fill="none" stroke="#eb6b00" stroke-opacity=".35" stroke-width="' + 5 * u + '" stroke-linecap="round" stroke-linejoin="round"/>';
    });
    if (cur && cur.floor === fl && cur.kind === 'walk') {
      s += '<polyline points="' + pl(cur.pts) + '" fill="none" stroke="#fff" stroke-width="' + 11 * u + '" stroke-linecap="round" stroke-linejoin="round"/>';
      s += '<polyline points="' + pl(cur.pts) + '" fill="none" stroke="#eb6b00" stroke-width="' + 7 * u + '" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#arw)"/>';
    }
    // 昇降機
    Object.keys(lifts).forEach(function (k) {
      var L = lifts[k], p = L[fl]; if (!p) return;
      var used = state.r.legs.some(function (lg) { return lg.lift && lg.lift.id === k; });
      var act = used && cur && cur.kind === 'lift';
      var r = (used ? 10 : 7) * u;
      s += '<rect x="' + (p.sx - r) + '" y="' + (p.sy - r) + '" width="' + 2 * r + '" height="' + 2 * r + '" rx="' + 3 * u + '" fill="' + (act ? '#eb6b00' : used ? '#00a040' : '#a9b3a6') + '"/>';
      s += '<text x="' + p.sx + '" y="' + (p.sy + 0.6 * u) + '" font-size="' + (used ? 8.5 : 6) * u + '" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-weight="700">' + LIFT_ICON[L.kind] + '</text>';
    });
    // トイレ
    stores.forEach(function (st) {
      if (st.floor !== fl || st.cat !== 'トイレ' || st.id === d.id) return;
      s += '<circle cx="' + st.label.x + '" cy="' + st.label.y + '" r="' + 6 * u + '" fill="#3a6fb0"/><text x="' + st.label.x + '" y="' + (st.label.y + 0.5 * u) + '" font-size="' + 6.5 * u + '" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-weight="700">WC</text>';
    });
    // 行き先のピン（店舗前の目安）
    if (d.floor === fl) {
      var px = d.door.x, py = d.door.y, R = 9 * u;
      s += '<path d="M' + px + ',' + py + ' l' + (-R * 0.8) + ',' + (-R * 1.3) + ' a' + R + ',' + R + ' 0 1 1 ' + (R * 1.6) + ',0 z" fill="#eb6b00" stroke="#fff" stroke-width="' + 1.8 * u + '"/>';
      s += '<circle cx="' + px + '" cy="' + (py - R * 1.75) + '" r="' + R * 0.38 + '" fill="#fff"/>';
      s += '<text x="' + px + '" y="' + (py - R * 3.1) + '" font-size="' + 9 * u + '" font-weight="700" text-anchor="middle" fill="#b34f00" paint-order="stroke" stroke="#fff" stroke-width="' + 2.6 * u + '">' + esc(d.name.replace(/・Standard Products/, '')) + '</text>';
    }
    // 出発
    var st0 = legStart();
    if (st0.floor === fl) {
      s += '<circle cx="' + st0.x + '" cy="' + st0.y + '" r="' + 8 * u + '" fill="#fff" stroke="#00a040" stroke-width="' + 3.4 * u + '"/>';
      s += '<text x="' + st0.x + '" y="' + (st0.y + 19 * u) + '" font-size="' + 9 * u + '" font-weight="700" text-anchor="middle" fill="#007a30" paint-order="stroke" stroke="#fff" stroke-width="' + 2.4 * u + '">出発</text>';
    }
    // 歩く点：いまのカードの線の上を、光る点が端まで歩く（動きを減らす設定では、線の始まりに止めて置く）
    if (cur && cur.floor === fl && cur.kind === 'walk' && cur.pts.length > 1) {
      var p0 = cur.pts[0], path = 'M' + cur.pts.map(function (p) { return Math.round(p.x) + ',' + Math.round(p.y); }).join(' L');
      s += '<g class="walker"' + (REDUCED ? ' transform="translate(' + Math.round(p0.x) + ',' + Math.round(p0.y) + ')"' : '') + '>' +
        '<circle r="' + 9 * u + '" fill="#fff" fill-opacity=".55"/><circle r="' + 5.2 * u + '" fill="#fff" stroke="#00a040" stroke-width="' + 2.6 * u + '"/>' +
        (REDUCED ? '' : '<animateMotion dur="2.6s" repeatCount="indefinite" calcMode="linear" keyPoints="0;1;1" keyTimes="0;0.85;1" path="' + path + '"/>') + '</g>';
    }
    // 昇降機を降りた所
    state.cards.forEach(function (c) {
      if (c.kind === 'lift' && c.floorTo === fl && st0.floor !== fl) {
        var p = c.pts[0];
        s += '<text x="' + p.x + '" y="' + (p.y + 20 * u) + '" font-size="' + 8.5 * u + '" font-weight="700" text-anchor="middle" fill="#007a30" paint-order="stroke" stroke="#fff" stroke-width="' + 2.4 * u + '">ここに着きます</text>';
      }
    });
    return s + '</svg>';
  }

  function renderEast() {
    var d = storeById[state.to];
    $('main').innerHTML = destHead(d) + '<section class="card"><p class="card-text">' + esc(d.name) + 'は、東館（' + esc(d.floor) + '）にあります。</p>' +
      '<p class="card-sub">東館は本館とは別の建物です。本館からの道順は、現地で通路を確認してから表示します。</p>' +
      '<div class="nav"><button id="again" class="btn primary">ほかの店を探す</button></div></section>';
    $('again').addEventListener('click', function () { state.to = null; writeUrl(); render(); });
    bindDestHead();
  }

  function render() {
    if (!state.to) renderHome();
    else if (storeById[state.to].east) renderEast();
    else if (!state.from) renderStart();
    else if (state.cards) renderRoute();
    else { $('main').innerHTML = destHead(storeById[state.to]) + '<p class="card-text">道順が見つかりませんでした。</p><p><button class="link" id="change-from">出発点を選び直す</button></p>'; $('change-from').addEventListener('click', function () { state.from = null; writeUrl(); render(); }); bindDestHead(); }
    document.body.classList.toggle('routing', !!state.to);
  }

  function init() {
    readUrl(); compute();
    var input = $('q');
    input.addEventListener('input', function () { state.q = input.value.trim(); if (state.q && state.to) { state.to = null; writeUrl(); } render(); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var l = search(input.value); if (l.length === 1) choose(l[0].id); } });
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

