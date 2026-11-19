/* おのだサンパーク 避難誘導（スタッフ用・見本）の計算部分。
 * v3/app.js の道順（歩ける格子の上の最短路、8方向・角をかすめない）と同じ地図データで動く。
 * 画面に依存しないので、ブラウザでも Node（monthly_check.cjs）でも同じ関数を使う。
 *
 * 避難の決まり（見本の仮置き）
 *  - 出口＝ mapdata の入口（starts）。非常口は館の防災図で差し替える
 *  - 危ない場所（火元など）の周りは通れない
 *  - 階の移動は階段・エスカレーターだけ。エレベーターは避難では使わない
 *  - 車いすの方：2F では最寄りの階段前の待避場所まで（そこで救助を待つ）
 */
(function (root) {
  'use strict';

  var LIFT_COST = { escalator: 150, stairs: 230, elevator: 330 }; // v3 と同じ重み
  var LIFT_NAME = {
    east_esc: '東エスカレーター', east_stairs: '東階段', center_esc: '中央エスカレーター', west_esc: '西エスカレーター',
    east_ev: '東エレベーター', west_ev: '西エレベーター', north_ev: '北エレベーター'
  };
  var RADIUS = { s: 36, m: 70, l: 120 }; // 危ない場所の半径（地図の単位。小・中・大）
  var EVAC_KINDS = ['stairs', 'escalator'];

  function create(M) {
    var CELL = M.cell;

    // ---------- 歩ける格子 ----------
    var G = {};
    Object.keys(M.floors).forEach(function (k) {
      var fl = +k, f = M.floors[k], w = f.w, h = f.h, a = new Uint8Array(w * h);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) a[y * w + x] = f.rows[y].charCodeAt(x) === 49 ? 1 : 0;
      G[fl] = { w: w, h: h, a: a, outline: f.outline, voids: f.voids || [] };
    });
    var FLOORS = Object.keys(G).map(Number).sort();
    function cellOf(fl, p) {
      var g = G[fl], x = Math.floor(p.x / CELL), y = Math.floor(p.y / CELL);
      if (x < 0 || y < 0 || x >= g.w || y >= g.h) return -1;
      return y * g.w + x;
    }
    function ptOf(fl, i) { var w = G[fl].w; return { x: (i % w) * CELL + CELL / 2, y: Math.floor(i / w) * CELL + CELL / 2 }; }
    // 歩ける格子の上に寄せる（入口・昇降機の点が格子の外にある時のため）
    function snap(fl, p) {
      var g = G[fl], c = cellOf(fl, p);
      if (c >= 0 && g.a[c]) return c;
      var cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL), best = -1, bd = Infinity;
      for (var r = 1; r <= 8 && best < 0; r++) {
        for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          var x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
          var j = y * g.w + x; if (!g.a[j]) continue;
          var d = dx * dx + dy * dy; if (d < bd) { bd = d; best = j; }
        }
      }
      return best;
    }

    // ---------- 店・出口・昇降機 ----------
    var stores = M.stores.map(function (s, i) {
      return { id: 's' + i, name: s.name, floor: s.floor, cat: s.cat, aliases: s.aliases || [], polys: s.polys,
        label: { x: s.label[0], y: s.label[1] }, door: { x: s.door[0], y: s.door[1] } };
    });
    var storeById = {}; stores.forEach(function (s) { storeById[s.id] = s; });
    var exits = M.starts.map(function (s, i) {
      return { id: s.id, no: i + 1, floor: s.floor, x: s.x, y: s.y, label: s.label, cell: snap(s.floor, s) };
    });
    var exitById = {}; exits.forEach(function (e) { exitById[e.id] = e; });
    var lifts = {};
    M.lifts.forEach(function (l) {
      var L = lifts[l.id] = lifts[l.id] || { id: l.id, kind: l.kind, stepFree: l.stepFree, conf: l.conf, name: LIFT_NAME[l.id] || l.id };
      L[l.floor] = { x: l.sx, y: l.sy, cell: snap(l.floor, { x: l.sx, y: l.sy }) };
    });
    var liftList = Object.keys(lifts).map(function (k) { return lifts[k]; });

    // ---------- 危ない場所 ----------
    // hazards: [{floor, x, y, r}]  → 階ごとの「通れないマス」
    function blockMask(fl, hazards) {
      var g = G[fl], m = new Uint8Array(g.w * g.h);
      (hazards || []).forEach(function (hz) {
        if (hz.floor !== fl) return;
        var r = hz.r, x0 = Math.max(0, Math.floor((hz.x - r) / CELL)), x1 = Math.min(g.w - 1, Math.floor((hz.x + r) / CELL));
        var y0 = Math.max(0, Math.floor((hz.y - r) / CELL)), y1 = Math.min(g.h - 1, Math.floor((hz.y + r) / CELL));
        for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
          var px = x * CELL + CELL / 2, py = y * CELL + CELL / 2;
          if ((px - hz.x) * (px - hz.x) + (py - hz.y) * (py - hz.y) <= r * r) m[y * g.w + x] = 1;
        }
      });
      return m;
    }

    // ---------- 複数の起点からのダイクストラ（8方向・角をかすめない。v3 と同じ動き） ----------
    // seeds: [{cell, cost}] → d（距離）, prev（ひとつ前）, tag（どの起点から来たか）
    function dijkstra(fl, seeds, block) {
      var g = G[fl], n = g.w * g.h, d = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), tag = new Int16Array(n).fill(-1);
      var heap = [], D = Math.SQRT2 * CELL;
      function push(i, v) { heap.push([v, i]); var k = heap.length - 1; while (k) { var p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; var t = heap[p]; heap[p] = heap[k]; heap[k] = t; k = p; } }
      function pop() { var top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; var k = 0; for (;;) { var l = 2 * k + 1, r = l + 1, m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; var t = heap[m]; heap[m] = heap[k]; heap[k] = t; k = m; } } return top; }
      seeds.forEach(function (s, si) {
        if (s.cell < 0 || !g.a[s.cell] || (block && block[s.cell]) || !(s.cost < Infinity)) return;
        if (s.cost < d[s.cell]) { d[s.cell] = s.cost; tag[s.cell] = si; push(s.cell, s.cost); }
      });
      var NB = [[1, 0, CELL], [-1, 0, CELL], [0, 1, CELL], [0, -1, CELL], [1, 1, D], [1, -1, D], [-1, 1, D], [-1, -1, D]];
      function ok(j) { return g.a[j] && !(block && block[j]); }
      while (heap.length) {
        var t = pop(), v = t[0], i = t[1];
        if (v > d[i]) continue;
        var x = i % g.w, y = (i / g.w) | 0;
        for (var k = 0; k < 8; k++) {
          var nx = x + NB[k][0], ny = y + NB[k][1];
          if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) continue;
          var j = ny * g.w + nx; if (!ok(j)) continue;
          if (k >= 4 && (!ok(y * g.w + nx) || !ok(ny * g.w + x))) continue;
          var nv = v + NB[k][2];
          if (nv < d[j]) { d[j] = nv; prev[j] = i; tag[j] = tag[i]; push(j, nv); }
        }
      }
      return { d: d, prev: prev, tag: tag };
    }

    // ---------- 見通しで折れ線をまとめる（危ない場所はまたがない） ----------
    function clear(fl, a, b, block) {
      var g = G[fl], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (CELL / 3)));
      for (var k = 0; k <= n; k++) {
        var x = a.x + (b.x - a.x) * k / n, y = a.y + (b.y - a.y) * k / n, j = Math.floor(y / CELL) * g.w + Math.floor(x / CELL);
        if (!g.a[j] || (block && block[j])) return false;
      }
      return true;
    }
    function smooth(fl, cells, block) {
      var p = cells.map(function (i) { return ptOf(fl, i); });
      if (p.length < 2) return p;
      var out = [p[0]], a = 0;
      while (a < p.length - 1) {
        var b = p.length - 1;
        while (b > a + 1 && !clear(fl, p[a], p[b], block)) b--;
        out.push(p[b]); a = b;
      }
      return out;
    }
    function walkCells(F, c) { var out = [], i = c, guard = 0; while (i !== -1 && guard++ < 100000) { out.push(i); i = F.prev[i]; } return out; }
    function lenOf(pts) { var L = 0; for (var i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return L; }

    // ---------- 出口までの「距離の場」 ----------
    // opt: { hazards, closed:{exitId:true}, kinds:['stairs','escalator'], exitFloors:[1,2] }
    // 1F は出口から、2F は「2F の出口」と「1F へ降りる昇降機の上」から測る
    function field(opt) {
      opt = opt || {};
      var kinds = opt.kinds || EVAC_KINDS, closed = opt.closed || {}, exitFloors = opt.exitFloors || FLOORS;
      var blk = {}; FLOORS.forEach(function (fl) { blk[fl] = blockMask(fl, opt.hazards); });
      var seeds = {}, F = {};
      seeds[1] = exits.filter(function (e) { return e.floor === 1 && !closed[e.id] && exitFloors.indexOf(1) !== -1; })
        .map(function (e) { return { cell: e.cell, cost: 0, exit: e }; });
      F[1] = dijkstra(1, seeds[1], blk[1]);
      seeds[2] = exits.filter(function (e) { return e.floor === 2 && !closed[e.id] && exitFloors.indexOf(2) !== -1; })
        .map(function (e) { return { cell: e.cell, cost: 0, exit: e }; });
      liftList.forEach(function (L) {
        if (kinds.indexOf(L.kind) === -1 || !L[1] || !L[2]) return;
        if (blk[1][L[1].cell] || blk[2][L[2].cell]) return; // 昇降機の前が危ない場所
        var c1 = F[1].d[L[1].cell];
        if (c1 < Infinity) seeds[2].push({ cell: L[2].cell, cost: c1 + LIFT_COST[L.kind], lift: L });
      });
      F[2] = dijkstra(2, seeds[2], blk[2]);
      return { F: F, seeds: seeds, blk: blk, opt: opt };
    }

    // その場からどの出口へ向かうか（道の線は引かない。全館の一括用）
    function exitOf(fld, fl, c) {
      var F = fld.F[fl]; if (c < 0 || !(F.d[c] < Infinity)) return null;
      var s = fld.seeds[fl][F.tag[c]];
      if (s.exit) return { exit: s.exit, cost: F.d[c], via: null };
      var r = exitOf(fld, 1, s.lift[1].cell);
      return r && { exit: r.exit, cost: F.d[c], via: s.lift };
    }

    // 危ない場所の中にいる時：まず外へ出る道（危ない場所は無視して、近い「安全で出口へつながるマス」まで）
    function escapeFrom(fld, fl, c) {
      var g = G[fl], F = fld.F[fl], blk = fld.blk[fl];
      var seen = new Int32Array(g.w * g.h).fill(-2), q = [c], h = 0; seen[c] = -1;
      while (h < q.length) {
        var i = q[h++];
        if (!blk[i] && F.d[i] < Infinity) { var out = [], k = i; while (k !== -1) { out.push(k); k = seen[k]; } return { cells: out.reverse(), end: i }; }
        var x = i % g.w, y = (i / g.w) | 0;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue; var nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) continue;
          var j = ny * g.w + nx; if (!g.a[j] || seen[j] !== -2) continue;
          seen[j] = i; q.push(j);
        }
      }
      return null;
    }

    // 1か所からの道順（線つき）
    function routeIn(fld, pt) {
      var fl = pt.floor, c = snap(fl, pt), legs = [], esc = null;
      if (c < 0) return { ok: false, reason: 'off' };
      var inHazard = !!fld.blk[fl][c];
      if (!(fld.F[fl].d[c] < Infinity)) {
        if (!inHazard) return { ok: false, reason: 'trapped', inHazard: false };
        esc = escapeFrom(fld, fl, c);
        if (!esc) return { ok: false, reason: 'trapped', inHazard: true };
        c = esc.end;
      }
      var F = fld.F[fl], cells = walkCells(F, c), seed = fld.seeds[fl][F.tag[c]];
      var pts = smooth(fl, cells, fld.blk[fl]);
      if (esc) pts = smooth(fl, esc.cells, null).concat(pts.slice(1));
      var r = { ok: true, inHazard: inHazard, escaped: !!esc, legs: legs, cost: F.d[c] };
      legs.push({ floor: fl, pts: pts, len: lenOf(pts) });
      if (seed.exit) { r.exit = seed.exit; return r; }
      var L = seed.lift, F1 = fld.F[1], c1 = L[1].cell, cells1 = walkCells(F1, c1);
      legs[0].toLift = L;
      legs.push({ lift: L, from: fl, to: 1 });
      var pts1 = smooth(1, cells1, fld.blk[1]);
      legs.push({ floor: 1, pts: pts1, len: lenOf(pts1) });
      r.exit = fld.seeds[1][F1.tag[c1]].exit; r.via = L;
      return r;
    }

    // 車いすの方（2F）：最寄りの階段前の待避場所まで
    function waitRoute(opt, pt) {
      var fl = pt.floor, blk = blockMask(fl, opt.hazards), c = snap(fl, pt);
      function tryKinds(kinds) {
        var seeds = liftList.filter(function (L) { return kinds.indexOf(L.kind) !== -1 && L[fl] && !blk[L[fl].cell]; })
          .map(function (L) { return { cell: L[fl].cell, cost: 0, lift: L }; });
        if (!seeds.length) return null;
        var F = dijkstra(fl, seeds, blk);
        var fld = { F: {}, seeds: {}, blk: {} }; fld.F[fl] = F; fld.seeds[fl] = seeds; fld.blk[fl] = blk;
        var cc = c, esc = null;
        if (!(F.d[cc] < Infinity)) {
          if (!blk[cc]) return null;
          esc = escapeFrom(fld, fl, cc); if (!esc) return null; cc = esc.end;
        }
        var pts = smooth(fl, walkCells(F, cc), blk);
        if (esc) pts = smooth(fl, esc.cells, null).concat(pts.slice(1));
        return { ok: true, wait: true, waitAt: seeds[F.tag[cc]].lift, legs: [{ floor: fl, pts: pts, len: lenOf(pts) }], escaped: !!esc, inHazard: !!blk[c], cost: F.d[cc] };
      }
      return tryKinds(['stairs']) || (function () { var r = tryKinds(['escalator']); if (r) r.fallback = true; return r; })() || { ok: false, reason: 'trapped', wait: true, inHazard: !!blk[c] };
    }

    // 画面から呼ぶ入口：pt={floor,x,y}、opt={hazards, wheelchair, closed}
    function evacuate(pt, opt) {
      opt = opt || {};
      if (opt.wheelchair && pt.floor !== 1) return waitRoute(opt, pt);
      var fld = field({ hazards: opt.hazards, closed: opt.closed, kinds: EVAC_KINDS });
      return routeIn(fld, pt);
    }

    // 全館の避難状況：全店の前から出口へ
    function survey(opt) {
      opt = opt || {};
      var fld = field({ hazards: opt.hazards, closed: opt.closed, kinds: opt.kinds || EVAC_KINDS, exitFloors: opt.exitFloors });
      var byExit = {}, trapped = [], inHazard = [], rows = [];
      exits.forEach(function (e) { byExit[e.id] = []; });
      stores.forEach(function (s) {
        var fl = s.floor, c = snap(fl, s.door), r = exitOf(fld, fl, c), hz = c >= 0 && !!fld.blk[fl][c];
        if (!r && hz) { var e = escapeFrom(fld, fl, c); if (e) r = exitOf(fld, fl, e.end); }
        var row = { store: s, exit: r && r.exit, via: r && r.via, inHazard: hz };
        rows.push(row);
        if (hz) inHazard.push(s);
        if (r) byExit[r.exit.id].push(s); else trapped.push(s);
      });
      return { rows: rows, byExit: byExit, trapped: trapped, inHazard: inHazard, field: fld };
    }

    // ---------- 店名の検索（v3 と同じ揺れの吸収） ----------
    function norm(s) {
      return String(s).normalize('NFKC').toLowerCase()
        .replace(/[ぁ-ゖ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) + 0x60); })
        .replace(/[\s・･\.\-‐ー_&＆'’!！,，、。()（）\/]/g, '');
    }
    stores.forEach(function (s) { s.keys = [s.name].concat(s.aliases).map(norm).filter(Boolean); s.catKey = norm(s.cat); });
    function search(q) {
      var k = norm(q); if (!k) return [];
      var res = [];
      stores.forEach(function (s) {
        var best = 0;
        s.keys.forEach(function (key, i) {
          var sc = key === k ? 100 : key.indexOf(k) === 0 ? 80 : key.indexOf(k) !== -1 ? 60 : 0;
          if (sc && i > 0) sc -= 5;
          if (sc > best) best = sc;
        });
        if (!best && s.catKey.indexOf(k) !== -1) best = 40;
        if (best) res.push({ s: s, score: best });
      });
      res.sort(function (a, b) { return b.score - a.score || a.s.floor - b.s.floor || a.s.name.localeCompare(b.s.name, 'ja'); });
      return res.map(function (r) { return r.s; });
    }

    return {
      M: M, CELL: CELL, G: G, FLOORS: FLOORS, stores: stores, storeById: storeById, exits: exits, exitById: exitById,
      lifts: lifts, liftList: liftList, RADIUS: RADIUS, LIFT_COST: LIFT_COST, EVAC_KINDS: EVAC_KINDS,
      snap: snap, cellOf: cellOf, blockMask: blockMask, field: field, exitOf: exitOf, routeIn: routeIn,
      evacuate: evacuate, waitRoute: waitRoute, survey: survey, search: search
    };
  }

  var api = { create: create, RADIUS: RADIUS, LIFT_NAME: LIFT_NAME };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EvacCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
