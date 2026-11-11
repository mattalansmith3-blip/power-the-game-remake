/* Power: The Game remake - AI planner. Pure logic; window.PowerAI or node module. */
(function (root) {
  'use strict';
  var E = (typeof require !== 'undefined' && typeof module !== 'undefined') ? require('./engine.js') : root.PowerEngine;
  var SP = E.SPACES, ORDER = E.ORDER, UNITS = E.UNITS, BASE = E.BASE, MEGA = E.MEGA;
  var powerOf = E.powerOf, countOf = E.countOf, canEnter = E.canEnter;

  function bfs(starts, allow) {
    var d = {}; var q = [];
    starts.forEach(function (s) { d[s] = 0; q.push(s); });
    while (q.length) {
      var c = q.shift();
      SP[c].nb.forEach(function (n) { if (d[n] == null && allow(n)) { d[n] = d[c] + 1; q.push(n); } });
    }
    return d;
  }
  function sig(x) { return 1 / (1 + Math.exp(-x)); }
  function winProb(P, opp) { return sig(2.4 * (P - opp) / (0.25 * (P + opp) + 1.5)); }
  var isLand = function (id) { return SP[id].kind === 'land'; };
  var LEVELS = {
    easy:   { orders: 3, noise: 3.0, potFactor: 0.45, bluff: 0.05, aggr: 1.3, guard: 0.5, atk: 0.2, drop: 0.2 },
    normal: { orders: 4, noise: 1.0, potFactor: 0.7,  bluff: 0.14, aggr: 0.55, guard: 1.0, atk: 0.0, drop: 0 },
    hard:   { orders: 5, noise: 0.3, potFactor: 0.9,  bluff: 0.2,  aggr: 0.35, guard: 1.0, atk: 0.0, drop: 0 }
  };

  function plan(state, pid, rng, mem) {
    rng = rng || Math.random;
    mem = mem || {};
    var lastMoves = mem.last || {};
    var me = state.players[pid];
    var cfg = LEVELS[me.level] || LEVELS.normal;
    var enemies = state.players.filter(function (p) { return p.alive && p.id !== pid; });
    if (!enemies.length) return [];
    var board = state.board;
    var avail = {};          // my units still free to order
    var arriveMine = {};     // planned arrivals of my own units
    ORDER.forEach(function (id) { if (board[id].o === pid) avail[id] = Object.assign({}, board[id].u); });
    var myHQ = E.hqSpace(me);
    var orders = [];
    var points = me.points;

    function ownerOf(id) { return board[id].o; }
    function stationaryPow(id) { return board[id].o === pid ? powerOf(avail[id] || {}) + powerOf(arriveMine[id] || {}) : powerOf(board[id].u); }
    function potentialInto(owner, y) {   // power of `owner` that could be moved into y next round
      var kind = SP[y].kind, t = 0;
      SP[y].nb.forEach(function (n) { if (board[n].o === owner) t += powerOf(E.enterable(board[n].u, kind)); });
      return t;
    }
    function dangerAt(y, extraFor) {   // expected hostile power arriving at y (not counting units already in y)
      var best = 0, second = 0;
      enemies.forEach(function (e) {
        var pot = potentialInto(e.id, y) * cfg.potFactor;
        if (board[y].o === e.id) pot += potentialInto(e.id, y) * 0.0;
        if (pot > best) { second = best; best = pot; } else if (pot > second) second = pot;
      });
      return best + 0.25 * second;
    }
    function hold(y) {
      var sp = SP[y];
      if (y === myHQ) return 1000;
      if (sp.kind === 'sea') return sp.port && sp.corner === me.corner ? 6 : 1.5;
      var ho = E.homeOwner(state, y);
      if (ho === pid) return 3;
      return 5;
    }
    function ev(P, opp, holdVal, gain) {
      if (P <= 0) return 0;
      var pw = winProb(P, opp);
      return pw * (P + gain * 1.25 + holdVal) - (1 - pw) * (P * 1.3);
    }
    function evEmpty(x) {   // value of leaving x empty
      var d = dangerAt(x);
      if (x === myHQ) return d > 0 ? -1000 * Math.min(1, d / 3) : -2;
      return d > 0 ? -hold(x) * 0.6 : 0;
    }
    function evStay(x, units) {
      var P = powerOf(units);
      if (P <= 0) return evEmpty(x);
      return ev(P, dangerAt(x), hold(x), 0);
    }

    // goals: nearest/weakest enemy HQ for land push
    var hqs = enemies.map(function (e) { return { e: e, id: E.hqSpace(e) }; });
    var landDistFromMine = bfs(Object.keys(avail).filter(isLand), isLand);
    function hqStrength(h) {
      var p = powerOf(board[h.id].u);
      SP[h.id].nb.forEach(function (n) { if (board[n].o === h.e.id) p += powerOf(board[n].u) * 0.5; });
      return p;
    }
    var target = null, tscore = -1e9;
    hqs.forEach(function (h) {
      var d = landDistFromMine[h.id]; if (d == null) d = 20;
      var sc = -d * 4 - hqStrength(h) * 0.6 + rng() * 2;
      if (sc > tscore) { tscore = sc; target = h; }
    });
    var landToTarget = bfs([target.id], isLand);
    var myTotal = 0, tgtTotal = 0;
    ORDER.forEach(function (id) { if (board[id].o === pid) myTotal += powerOf(board[id].u); if (board[id].o === target.e.id) tgtTotal += powerOf(board[id].u); });
    var ratio = (myTotal + 1) / (tgtTotal + 1);
    var aggrScale = cfg.aggr * (ratio > 1.15 ? 1.6 : ratio > 0.85 ? 1.2 : 0.8);
    var enemyOwned = ORDER.filter(function (id) { return board[id].o != null && board[id].o !== pid && countOf(board[id].u); });
    var anyDist = bfs(enemyOwned, function () { return true; });
    var seaDist = bfs(enemyOwned.filter(function (id) { return SP[id].kind === 'sea'; }).concat(
      enemyOwned.filter(isLand).flatMap(function (id) { return SP[id].nb.filter(function (n) { return SP[n].kind === 'sea'; }); })), function (id) { return SP[id].kind === 'sea'; });

    function variants(x) {
      var base = avail[x]; var res = []; var seen = {};
      function add(u) { cleanU(u); if (!countOf(u)) return; var k = JSON.stringify(u); if (seen[k]) return; seen[k] = 1; res.push(u); }
      if (x !== myHQ) { add(Object.assign({}, base)); }
      else {
        var need = Math.max(6 * cfg.guard, dangerAt(x) * 1.25 * cfg.guard + 1);
        [['MF', 'F', 'MT', 'T', 'MD', 'D', 'MI', 'I'], ['I', 'T', 'F', 'MI', 'MT', 'MF', 'D', 'MD']].forEach(function (ord) {
          var keep = {}, kp = 0;
          ord.forEach(function (t) { while ((base[t] || 0) - (keep[t] || 0) > 0 && kp < need) { keep[t] = (keep[t] || 0) + 1; kp += UNITS[t].power; } });
          var mv = {}; for (var t in base) { var n = base[t] - (keep[t] || 0); if (n > 0) mv[t] = n; }
          add(mv);
        });
      }
      // sea/air strike group
      var fs = {}; ['F', 'MF', 'D', 'MD'].forEach(function (t) { if (base[t]) fs[t] = base[t]; });
      if (x !== myHQ) add(fs);
      return res;
    }
    function cleanU(u) { for (var t in u) if (!u[t]) delete u[t]; }

    function evalMove(x, y, G) {
      var enter = E.enterable(G, SP[y].kind);
      if (!countOf(enter)) return null;
      G = enter;
      var P = powerOf(G);
      var rem = {}; for (var t in avail[x]) { var r = avail[x][t] - (G[t] || 0); if (r > 0) rem[t] = r; }
      var delta = (evStay(x, rem) - evStay(x, avail[x])) * (x === myHQ ? 1 : 0.35);
      var o = ownerOf(y), score;
      if (o === pid) {
        var S = stationaryPow(y);
        var d = dangerAt(y);
        score = ev(S + P, d, hold(y), 0) - (S > 0 ? ev(S, d, hold(y), 0) : 0);
        if (S === 0) score = ev(P, d, hold(y), 0) - evEmpty(y) * 0;
      } else if (o == null) {
        var opp = dangerAt(y) * 0.8 + potentialInto(pid, y) * 0; // others may race there
        var holdV = hold(y) + (SP[y].kind === 'land' && E.homeOwner(state, y) !== pid ? 2 : 0);
        score = ev(P, opp, holdV, 0);
      } else {
        var S2 = powerOf(board[y].u);
        var reinf = 0;
        SP[y].nb.forEach(function (n) { if (board[n].o === o && n !== x) reinf += powerOf(E.enterable(board[n].u, SP[y].kind)); });
        var opp2 = S2 + reinf * 0.35 * cfg.potFactor + dangerAt(y) * 0.2;
        var holdV2 = hold(y);
        var isHQ = SP[y].hq && E.homeOwner(state, y) === o;
        if (isHQ && E.hasInfantry(G)) holdV2 += 1000;
        else if (isHQ) holdV2 += 8;
        score = ev(P, opp2, holdV2, S2);
      }
      var total = score + delta;
      var land = false; for (var q in G) if (G[q] > 0 && (q === 'I' || q === 'MI')) land = true;
      var landy = false; for (var q2 in G) if (G[q2] > 0 && canEnter(q2, 'land') && q2 !== 'F' && q2 !== 'MF') landy = true;
      var hasAir = false; for (var q3 in G) if (G[q3] > 0 && (q3 === 'F' || q3 === 'MF')) hasAir = true;
      var prog = 0;
      if ((landy || hasAir) && landToTarget[x] != null && landToTarget[y] != null) prog = (landToTarget[x] - landToTarget[y]) * (land ? 4.0 : landy ? 3.0 : 2.4) * aggrScale;
      else if (anyDist[x] != null && anyDist[y] != null) prog = (anyDist[x] - anyDist[y]) * 1.3 * aggrScale;
      if (!landy && SP[x].kind === 'sea' && seaDist[x] != null && seaDist[y] != null) prog += (seaDist[x] - seaDist[y]) * 1.0 * aggrScale;
      var Pstay = powerOf(avail[x]);
      var threatened = dangerAt(x) > Pstay * 1.1;
      var pwHere = o === pid ? 1 : winProb(P, o == null ? dangerAt(y) * 0.8 : powerOf(board[y].u));
      if (prog < 0 && !threatened) return null;            // no wandering backwards
      if (o !== pid && pwHere < (prog > 0 ? 0.5 : 0.62) + cfg.atk) return null;   // only fight when favoured
      total += prog;
      if (lastMoves[y + '>' + x]) total -= 5;
      total += (rng() - 0.5) * cfg.noise * 2;
      return { total: total, G: G };
    }

    function buyChoice(budget) {
      var hq = board[myHQ].u, port = board[E.portSpace(me)];
      var portOK = port.o == null || port.o === pid;
      var infTotal = 0; ORDER.forEach(function (id) { if (board[id].o === pid) infTotal += (board[id].u.I || 0) + (board[id].u.MI || 0); });
      var danger = dangerAt(myHQ);
      var best = null, bs = -1e9;
      BASE.forEach(function (t) {
        var c = UNITS[t].cost; if (c > budget) return;
        if (t === 'D' && !portOK) return;
        var sc = 1 + rng() * cfg.noise * 0.6;
        var have = t === 'D' ? (port.u.D || 0) : (hq[t] || 0) + (arriveMine[myHQ] ? (arriveMine[myHQ][t] || 0) : 0);
        var pendingBuys = orders.filter(function (o) { return o.t === 'buy' && o.type === t; }).length;
        have += pendingBuys;
        if (have % 3 === 2) sc += 2;          // completes a Mega
        if (t === 'I' && infTotal < 3) sc += 3.5;
        if (t === 'I' && infTotal >= 6) sc -= 1.5;
        if (t === 'F') sc += 0.8;
        if (t === 'D') sc -= 0.6;
        if (danger > powerOf(hq) * 0.7 && t !== 'D') sc += UNITS[t].power * 0.3;
        sc += (c / 5);                        // prefer spending big when rich
        if (sc > bs) { bs = sc; best = t; }
      });
      return best;
    }

    // spend points first (buys take effect at start of round; leave room for moves)
    var maxBuys = points >= 9 ? 2 : 1;
    var buys = 0;
    while (buys < maxBuys && orders.length < cfg.orders) {
      var bt = buyChoice(points);
      if (!bt) break;
      if (points < 2) break;
      orders.push({ t: 'buy', type: bt }); points -= UNITS[bt].cost; buys++;
      if (points < 2) break;
    }

    // merges + moves greedily
    var guard = 0; var newLast = {};
    while (orders.length < cfg.orders && guard++ < 8) {
      var bestO = null, bestS = 0.6;
      Object.keys(avail).forEach(function (x) {
        if (countOf(avail[x]) === 0) return;
        // merge candidate
        BASE.forEach(function (t) {
          if ((avail[x][t] || 0) >= 3) {
            var gain = UNITS[MEGA[t]].power - 3 * UNITS[t].power;
            var sc = gain * 0.6 + 0.8 - dangerAt(x) * 0.1 + (rng() - 0.5) * cfg.noise;
            if (sc > bestS) { bestS = sc; bestO = { t: 'merge', at: x, type: t }; }
          }
        });
        SP[x].nb.forEach(function (y) {
          variants(x).forEach(function (G) {
            var r = evalMove(x, y, G); if (!r) return;
            if (r.total > bestS) { bestS = r.total; bestO = { t: 'move', from: x, to: y, u: r.G }; }
          });
        });
      });
      if (!bestO) break;
      if (cfg.drop && rng() < cfg.drop) { guard += 2; continue; }
      orders.push(bestO);
      if (bestO.t === 'move') newLast[bestO.from + '>' + bestO.to] = 1;
      if (bestO.t === 'merge') avail[bestO.at][bestO.type] -= 3;
      else {
        for (var t in bestO.u) avail[bestO.from][t] -= bestO.u[t];
        var am = arriveMine[bestO.to] || (arriveMine[bestO.to] = {});
        E.addUnits(am, bestO.u);
      }
    }
    // bluff: a lone cheap unit pokes towards an enemy
    if (orders.length < cfg.orders && rng() < cfg.bluff) {
      var cands = [];
      Object.keys(avail).forEach(function (x) {
        if (x === myHQ) return;
        var u = avail[x];
        ['I', 'T'].forEach(function (t) {
          if ((u[t] || 0) >= 2) SP[x].nb.forEach(function (y) {
            if (canEnter(t, SP[y].kind) && board[y].o !== pid && powerOf(board[y].u) <= 8) cands.push({ t: 'move', from: x, to: y, u: (function () { var o = {}; o[t] = 1; return o; })() });
          });
        });
      });
      if (cands.length) { var c = cands[(rng() * cands.length) | 0]; orders.push(c); }
    }
    mem.last = newLast;
    return orders;
  }

  var api = { plan: plan, LEVELS: LEVELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PowerAI = api;
})(typeof window !== 'undefined' ? window : globalThis);
