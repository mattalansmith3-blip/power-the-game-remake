/* Power: The Game remake - rules engine (pure logic, no DOM). Works in browser (window.PowerEngine) and node. */
(function (root) {
  'use strict';

  var UNITS = {
    I:  { name: 'Infantry',      short: 'Inf',  power: 2,  cost: 2, land: true,  sea: false },
    T:  { name: 'Tank',          short: 'Tank', power: 3,  cost: 3, land: true,  sea: false },
    F:  { name: 'Fighter',       short: 'Jet',  power: 5,  cost: 5, land: true,  sea: true  },
    D:  { name: 'Destroyer',     short: 'Ship', power: 4,  cost: 4, land: false, sea: true  },
    MI: { name: 'Mega Infantry', short: 'M.Inf',  power: 10, land: true,  sea: false },
    MT: { name: 'Mega Tank',     short: 'M.Tank', power: 15, land: true,  sea: false },
    MF: { name: 'Mega Fighter',  short: 'M.Jet',  power: 25, land: true,  sea: true  },
    MD: { name: 'Mega Destroyer',short: 'M.Ship', power: 20, land: false, sea: true  }
  };
  var TYPES = ['I', 'T', 'F', 'D', 'MI', 'MT', 'MF', 'MD'];
  var BASE = ['I', 'T', 'F', 'D'];
  var MEGA = { I: 'MI', T: 'MT', F: 'MF', D: 'MD' };
  var MAX_ORDERS = 5;
  var MAX_ROUNDS = 60;
  var INCOME_PER_TERRITORY = 2;
  var BASE_INCOME = 1;
  var START_POINTS = 4;

  /* ---------- board ---------- */
  var SPACES = {};
  var ORDER = [];
  function addSpace(id, name, kind, x, y, extra) {
    var s = { id: id, name: name, kind: kind, x: x, y: y, nb: [], corner: null, hq: false, port: false };
    if (extra) for (var k in extra) s[k] = extra[k];
    SPACES[id] = s; ORDER.push(id);
  }
  function link(a, b) {
    if (SPACES[a].nb.indexOf(b) < 0) SPACES[a].nb.push(b);
    if (SPACES[b].nb.indexOf(a) < 0) SPACES[b].nb.push(a);
  }
  var CORNERS = [
    { key: 'nw', name: 'Aldoria', hq: [90, 80],   a: [290, 80],  b: [90, 220],  port: 'sNW', aName: 'East', bName: 'South' },
    { key: 'ne', name: 'Borvia',  hq: [910, 80],  a: [710, 80],  b: [910, 220], port: 'sNE', aName: 'West', bName: 'South' },
    { key: 'se', name: 'Cestria', hq: [910, 620], a: [710, 620], b: [910, 480], port: 'sSE', aName: 'West', bName: 'North' },
    { key: 'sw', name: 'Drovia',  hq: [90, 620],  a: [290, 620], b: [90, 480],  port: 'sSW', aName: 'East', bName: 'North' }
  ];
  CORNERS.forEach(function (c, i) {
    addSpace(c.key + '_hq', c.name + ' HQ', 'land', c.hq[0], c.hq[1], { corner: i, hq: true });
    addSpace(c.key + '_a', c.name + ' ' + c.aName, 'land', c.a[0], c.a[1], { corner: i });
    addSpace(c.key + '_b', c.name + ' ' + c.bName, 'land', c.b[0], c.b[1], { corner: i });
  });
  addSpace('nt', 'North Plains', 'land', 500, 80);
  addSpace('nr', 'East Hills', 'land', 910, 350);
  addSpace('nb', 'South Plains', 'land', 500, 620);
  addSpace('nl', 'West Hills', 'land', 90, 350);
  addSpace('isle', 'Central Isle', 'land', 500, 350);
  var seas = [
    ['sNW', 'NW Sea', 290, 220], ['sN', 'North Sea', 500, 220], ['sNE', 'NE Sea', 710, 220], ['sE', 'East Sea', 710, 350],
    ['sSE', 'SE Sea', 710, 480], ['sS', 'South Sea', 500, 480], ['sSW', 'SW Sea', 290, 480], ['sW', 'West Sea', 290, 350]
  ];
  seas.forEach(function (s) { addSpace(s[0], s[1], 'sea', s[2], s[3]); });
  CORNERS.forEach(function (c, i) { SPACES[c.port].port = true; SPACES[c.port].corner = i; });

  var LAND_RING = ['nw_hq', 'nw_a', 'nt', 'ne_a', 'ne_hq', 'ne_b', 'nr', 'se_b', 'se_hq', 'se_a', 'nb', 'sw_a', 'sw_hq', 'sw_b', 'nl', 'nw_b'];
  LAND_RING.forEach(function (id, i) { link(id, LAND_RING[(i + 1) % LAND_RING.length]); });
  var SEA_RING = seas.map(function (s) { return s[0]; });
  SEA_RING.forEach(function (id, i) { link(id, SEA_RING[(i + 1) % SEA_RING.length]); });
  [['sNW', 'nw_a'], ['sNW', 'nw_b'], ['sN', 'nt'], ['sNE', 'ne_a'], ['sNE', 'ne_b'], ['sE', 'nr'], ['sSE', 'se_b'], ['sSE', 'se_a'],
   ['sS', 'nb'], ['sSW', 'sw_a'], ['sSW', 'sw_b'], ['sW', 'nl'],
   ['isle', 'sN'], ['isle', 'sE'], ['isle', 'sS'], ['isle', 'sW']].forEach(function (e) { link(e[0], e[1]); });

  /* ---------- helpers ---------- */
  function rngFrom(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function canEnter(type, kind) { return kind === 'land' ? UNITS[type].land : UNITS[type].sea; }
  function powerOf(u) { var p = 0; for (var t in u) p += (u[t] || 0) * UNITS[t].power; return p; }
  function countOf(u) { var n = 0; for (var t in u) n += (u[t] || 0); return n; }
  function addUnits(dst, src) { for (var t in src) if (src[t]) dst[t] = (dst[t] || 0) + src[t]; }
  function cleanUnits(u) { for (var t in u) if (!u[t]) delete u[t]; return u; }
  function enterable(u, kind) { var r = {}; for (var t in u) if (u[t] > 0 && canEnter(t, kind)) r[t] = u[t]; return r; }
  function hasInfantry(u) { return (u.I || 0) + (u.MI || 0) > 0; }

  /* seat -> corner, depending on number of players */
  function cornersFor(n) { return n === 2 ? [0, 2] : n === 3 ? [0, 1, 2] : [0, 1, 2, 3]; }
  var COLORS = [
    { name: 'Blue',   hex: '#2f6fd6' },
    { name: 'Red',    hex: '#d8423b' },
    { name: 'Gold',   hex: '#e2a50f' },
    { name: 'Green',  hex: '#2f9e57' }
  ];

  function startingUnits(isHQ, isA, isB, isPort) {
    if (isHQ) return { I: 2, T: 2, F: 1 };
    if (isA) return { I: 1 };
    if (isB) return { I: 1 };
    if (isPort) return { D: 1 };
    return {};
  }

  function newGame(cfg) {
    var n = cfg.players;                       // 2..4
    var level = cfg.level || 'normal';
    var seed = cfg.seed == null ? (Math.random() * 1e9) | 0 : cfg.seed;
    var corners = cornersFor(n);
    var state = { round: 1, seed: seed, players: [], board: {}, over: false, winner: null, endReason: null, maxRounds: MAX_ROUNDS };
    corners.forEach(function (c, seat) {
      state.players.push({
        id: seat, seat: seat, corner: c, color: COLORS[seat].hex, colorName: COLORS[seat].name,
        name: seat === 0 && !cfg.allAI ? 'You' : COLORS[seat].name + ' AI',
        ai: cfg.allAI ? true : seat !== 0, level: level, alive: true, points: START_POINTS
      });
    });
    ORDER.forEach(function (id) { state.board[id] = { o: null, u: {} }; });
    state.players.forEach(function (p) {
      var c = CORNERS[p.corner];
      [[c.key + '_hq', 1, 0, 0, 0], [c.key + '_a', 0, 1, 0, 0], [c.key + '_b', 0, 0, 1, 0], [c.port, 0, 0, 0, 1]].forEach(function (r) {
        state.board[r[0]] = { o: p.id, u: startingUnits(r[1], r[2], r[3], r[4]) };
      });
    });
    return state;
  }

  function homeOwner(state, spaceId) {      // player id whose (living) home country this is, else null
    var c = SPACES[spaceId].corner;
    if (c == null) return null;
    for (var i = 0; i < state.players.length; i++) if (state.players[i].corner === c && state.players[i].alive) return state.players[i].id;
    return null;
  }
  function hqSpace(player) { return CORNERS[player.corner].key + '_hq'; }
  function portSpace(player) { return CORNERS[player.corner].port; }

  /* ---------- orders ---------- */
  // order shapes: {t:'move',from,to,u:{I:2}} | {t:'merge',at,type:'I'} | {t:'buy',type:'T'}
  function sanitizeOrders(state, pid, orders) {
    var p = state.players[pid]; var out = []; var errors = [];
    var avail = {}; var points = p.points;
    ORDER.forEach(function (id) { var b = state.board[id]; if (b.o === pid) avail[id] = Object.assign({}, b.u); });
    (orders || []).forEach(function (o, idx) {
      if (out.length >= MAX_ORDERS) { errors.push('Too many orders'); return; }
      if (o.t === 'move') {
        var sp = SPACES[o.from], tp = SPACES[o.to];
        if (!sp || !tp || !avail[o.from] || sp.nb.indexOf(o.to) < 0) { errors.push('Bad move'); return; }
        var u = {};
        for (var t in o.u) {
          var n = Math.min(o.u[t] | 0, avail[o.from][t] || 0);
          if (n > 0 && canEnter(t, tp.kind)) u[t] = n;
        }
        if (!countOf(u)) { errors.push('Nothing can move there'); return; }
        for (var t2 in u) avail[o.from][t2] -= u[t2];
        out.push({ t: 'move', from: o.from, to: o.to, u: u });
      } else if (o.t === 'merge') {
        if (BASE.indexOf(o.type) < 0 || !avail[o.at] || (avail[o.at][o.type] || 0) < 3) { errors.push('Cannot merge'); return; }
        avail[o.at][o.type] -= 3;
        out.push({ t: 'merge', at: o.at, type: o.type });
      } else if (o.t === 'buy') {
        if (BASE.indexOf(o.type) < 0 || UNITS[o.type].cost > points) { errors.push('Cannot afford'); return; }
        if (o.type === 'D') { var pb = state.board[portSpace(p)]; if (pb.o != null && pb.o !== pid) { errors.push('Port blocked'); return; } }
        points -= UNITS[o.type].cost;
        out.push({ t: 'buy', type: o.type });
      }
    });
    return { orders: out, errors: errors, pointsLeft: points, avail: avail };
  }

  /* ---------- resolution ---------- */
  function spaceName(id) { return SPACES[id].name; }
  function unitsText(u) {
    var parts = [];
    TYPES.forEach(function (t) { if (u[t]) parts.push(u[t] + ' ' + UNITS[t].name + (u[t] > 1 && t.length === 1 ? (t === 'I' ? '' : 's') : '')); });
    return parts.join(', ');
  }

  function resolveRound(state0, ordersBy) {
    var s = clone(state0);
    var events = []; var log = [];
    var pl = s.players;
    var startOwner = {}; ORDER.forEach(function (id) { startOwner[id] = state0.board[id].o; });
    function pname(i) { return pl[i].name === 'You' ? 'You' : pl[i].colorName; }

    var clean = {};
    pl.forEach(function (p) { if (p.alive) clean[p.id] = sanitizeOrders(state0, p.id, ordersBy[p.id] || []).orders; });

    /* 1. buys and merges */
    pl.forEach(function (p) {
      if (!p.alive) return;
      clean[p.id].forEach(function (o) {
        if (o.t === 'buy') {
          var at = o.type === 'D' ? portSpace(p) : hqSpace(p);
          var b = s.board[at]; b.o = p.id; b.u[o.type] = (b.u[o.type] || 0) + 1; p.points -= UNITS[o.type].cost;
          events.push({ k: 'buy', pid: p.id, type: o.type, at: at });
          log.push({ pid: p.id, text: pname(p.id) + ' bought a ' + UNITS[o.type].name + ' at ' + spaceName(at) + '.' });
        } else if (o.t === 'merge') {
          var m = s.board[o.at]; m.u[o.type] -= 3; m.u[MEGA[o.type]] = (m.u[MEGA[o.type]] || 0) + 1; cleanUnits(m.u);
          events.push({ k: 'merge', pid: p.id, type: o.type, at: o.at });
          log.push({ pid: p.id, text: pname(p.id) + ' merged 3 ' + UNITS[o.type].name + 's into a ' + UNITS[MEGA[o.type]].name + ' at ' + spaceName(o.at) + '.' });
        }
      });
    });
    var setupSnap = clone(s.board);

    /* 2. departures */
    var groups = [];                       // {owner, from, to, u}
    pl.forEach(function (p) {
      if (!p.alive) return;
      clean[p.id].forEach(function (o) {
        if (o.t !== 'move') return;
        var key = p.id + ':' + o.from + ':' + o.to;
        var g = groups.filter(function (x) { return x.key === key; })[0];
        if (!g) { g = { key: key, owner: p.id, from: o.from, to: o.to, u: {} }; groups.push(g); }
        addUnits(g.u, o.u);
        var b = s.board[o.from];
        for (var t in o.u) b.u[t] -= o.u[t];
        cleanUnits(b.u); if (!countOf(b.u)) b.o = null;
      });
    });
    groups.forEach(function (g) { events.push({ k: 'move', pid: g.owner, from: g.from, to: g.to, u: clone(g.u) }); });
    var departSnap = clone(s.board);

    var capturedAt = {};                    // infantry captured this round do not count for flag-taking
    function noteCaptured(space, u) { var c = capturedAt[space] || (capturedAt[space] = {}); addUnits(c, u); }

    /* 3. units passing each other on the same link fight on the way */
    groups.forEach(function (g1) {
      if (g1.dead) return;
      var g2 = groups.filter(function (x) { return !x.dead && x !== g1 && x.from === g1.to && x.to === g1.from && x.owner !== g1.owner; })[0];
      if (!g2) return;
      var p1 = powerOf(g1.u), p2 = powerOf(g2.u);
      var ev = { k: 'pass', a: g1.from, b: g1.to, p1: g1.owner, p2: g2.owner, pow1: p1, pow2: p2, winner: null };
      if (p1 === p2) {
        // tie: both turn back
        [g1, g2].forEach(function (g) { var b = s.board[g.from]; b.o = g.owner; addUnits(b.u, g.u); g.dead = true; });
        log.push({ text: 'Tie on the road between ' + spaceName(g1.from) + ' and ' + spaceName(g1.to) + ' (' + p1 + ' vs ' + p2 + '): both columns turn back.' });
      } else {
        var w = p1 > p2 ? g1 : g2, l = p1 > p2 ? g2 : g1;
        ev.winner = w.owner; ev.captured = clone(l.u);
        addUnits(w.u, l.u); l.dead = true; noteCaptured(w.to, l.u);
        log.push({ text: pname(w.owner) + ' beat ' + pname(l.owner) + ' on the road between ' + spaceName(g1.from) + ' and ' + spaceName(g1.to) + ' (' + Math.max(p1, p2) + ' vs ' + Math.min(p1, p2) + ') and captured ' + unitsText(l.u) + '!' });
      }
      events.push(ev);
    });

    /* 4. arrivals */
    var arrivals = {};                      // space -> [ {owner, u, origins:[{from,u}]} ]
    function pushArrival(space, owner, u, from) {
      var list = arrivals[space] || (arrivals[space] = []);
      var a = list.filter(function (x) { return x.owner === owner; })[0];
      if (!a) { a = { owner: owner, u: {}, origins: [] }; list.push(a); }
      addUnits(a.u, u);
      var org = a.origins.filter(function (x) { return x.from === from; })[0];
      if (!org) a.origins.push({ from: from, u: Object.assign({}, u) }); else addUnits(org.u, u);
    }
    groups.forEach(function (g) { if (!g.dead) pushArrival(g.to, g.owner, g.u, g.from); });

    for (var pass = 1; pass <= 2; pass++) {
      var spaces = Object.keys(arrivals);
      if (!spaces.length) break;
      var nextArr = {}; var results = [];
      spaces.forEach(function (id) {
        var b = s.board[id]; var parties = [];
        var stationary = b.o != null && countOf(b.u) ? { owner: b.o, u: Object.assign({}, b.u), stationary: true } : null;
        if (stationary) parties.push(stationary);
        arrivals[id].forEach(function (a) {
          var same = parties.filter(function (x) { return x.owner === a.owner; })[0];
          if (same) { addUnits(same.u, a.u); same.origins = a.origins; same.arriving = true; }
          else parties.push({ owner: a.owner, u: Object.assign({}, a.u), origins: a.origins, arriving: true });
        });
        parties.forEach(function (x) { x.power = powerOf(x.u); });
        results.push({ id: id, parties: parties, stationary: stationary });
      });
      results.forEach(function (r) {
        var id = r.id, b = s.board[id], parties = r.parties;
        if (parties.length === 1) {
          var only = parties[0]; b.o = only.owner; b.u = only.u; return;
        }
        var top = Math.max.apply(null, parties.map(function (x) { return x.power; }));
        var tops = parties.filter(function (x) { return x.power === top; });
        var ev = { k: 'fight', at: id, parties: parties.map(function (x) { return { pid: x.owner, power: x.power, u: clone(x.u), stationary: !!x.stationary && !x.arriving }; }), winner: null, tie: false, captured: {} };
        var summary = parties.map(function (x) { return pname(x.owner) + ' ' + x.power; }).join(' vs ');
        var winner = null;
        if (tops.length === 1) winner = tops[0];
        else if (pass === 2) {
          winner = tops.filter(function (x) { return x.stationary && !x.arriving; })[0] || tops.filter(function (x) { return x.stationary; })[0] || tops[0];
        }
        if (winner) {
          var cap = {};
          var merged = Object.assign({}, winner.u);
          parties.forEach(function (x) { if (x !== winner) { addUnits(merged, x.u); addUnits(cap, x.u); } });
          b.o = winner.owner; b.u = merged;
          noteCaptured(id, cap);
          ev.winner = winner.owner; ev.captured = cap; ev.tieBroken = tops.length > 1;
          log.push({ text: spaceName(id) + ': ' + summary + ' \u2192 ' + pname(winner.owner) + ' wins and captures ' + unitsText(cap) + '!' });
        } else {
          // tie: everyone who walked in turns back; defender stays
          ev.tie = true;
          if (r.stationary) { b.o = r.stationary.owner; b.u = Object.assign({}, r.stationary.u); }
          else { b.o = null; b.u = {}; }
          parties.forEach(function (x) {
            if (!x.arriving) return;
            x.origins.forEach(function (og) {
              var list = nextArr[og.from] || (nextArr[og.from] = []);
              var a = list.filter(function (q) { return q.owner === x.owner; })[0];
              if (!a) { a = { owner: x.owner, u: {}, origins: [{ from: og.from, u: {} }] }; list.push(a); }
              addUnits(a.u, og.u); addUnits(a.origins[0].u, og.u);
            });
          });
          log.push({ text: spaceName(id) + ': ' + summary + ' \u2014 a tie! Nobody captures; attackers turn back.' });
        }
        events.push(ev);
      });
      arrivals = nextArr;
    }
    // anything left in arrivals (shouldn't be) is returned to its owner's origin
    Object.keys(arrivals).forEach(function (id) {
      arrivals[id].forEach(function (a) { var b = s.board[id]; if (b.o == null || b.o === a.owner) { b.o = a.owner; addUnits(b.u, a.u); } });
    });
    ORDER.forEach(function (id) { var b = s.board[id]; cleanUnits(b.u); if (!countOf(b.u)) { b.o = null; b.u = {}; } });

    /* 5. flag captures */
    var flags = [];
    pl.forEach(function (p) {
      if (!p.alive) return;
      var b = s.board[hqSpace(p)];
      var cu = capturedAt[hqSpace(p)] || {};
      var inf = (b.u.I || 0) + (b.u.MI || 0) - (cu.I || 0) - (cu.MI || 0);
      if (b.o != null && b.o !== p.id && inf > 0) flags.push({ victim: p.id, by: b.o });
    });
    flags.forEach(function (f) {
      if (!pl[f.victim].alive || !pl[f.by].alive) return;
      pl[f.victim].alive = false;
      ORDER.forEach(function (id) { var b = s.board[id]; if (b.o === f.victim) b.o = f.by; });
      pl[f.by].points += 0;
      events.push({ k: 'flag', victim: f.victim, by: f.by, at: hqSpace(pl[f.victim]) });
      log.push({ text: '\uD83D\uDEA9 ' + pname(f.by) + ' captured the Flag in ' + spaceName(hqSpace(pl[f.victim])) + '! ' + pname(f.victim) + ' is out and all their units now fight for ' + pname(f.by) + '.' });
    });

    /* 6. power points */
    var aliveBefore = pl.filter(function (p) { return p.alive; });
    aliveBefore.forEach(function (p) {
      var held = [];
      ORDER.forEach(function (id) {
        var sp = SPACES[id];
        if (sp.kind !== 'land') return;
        if (startOwner[id] !== p.id || s.board[id].o !== p.id) return;
        var ho = homeOwner(state0, id);
        if (ho === p.id) return;           // your own home country earns nothing
        held.push(id);
      });
      var inc = BASE_INCOME + held.length * INCOME_PER_TERRITORY;
      p.points += inc;
      events.push({ k: 'income', pid: p.id, amount: inc, spaces: held });
      log.push({ pid: p.id, text: pname(p.id) + ' earned ' + inc + ' power point' + (inc === 1 ? '' : 's') + (held.length ? ' (held ' + held.map(spaceName).join(', ') + ' all round)' : '') + '.' });
    });

    s.round = state0.round + 1;
    /* 7. game over? */
    var alive = pl.filter(function (p) { return p.alive; });
    if (alive.length <= 1) { s.over = true; s.winner = alive.length ? alive[0].id : null; s.endReason = 'flag'; }
    else if (s.round > s.maxRounds) {
      var best = null, bp = -1;
      alive.forEach(function (p) {
        var tot = p.points;
        ORDER.forEach(function (id) { if (s.board[id].o === p.id) tot += powerOf(s.board[id].u); });
        if (tot > bp) { bp = tot; best = p; }
      });
      s.over = true; s.winner = best.id; s.endReason = 'time';
    }
    return { state: s, events: events, log: log, setupBoard: setupSnap, departBoard: departSnap, orders: clean };
  }

  function totalPower(state, pid) {
    var t = 0; ORDER.forEach(function (id) { if (state.board[id].o === pid) t += powerOf(state.board[id].u); }); return t;
  }

  var api = {
    UNITS: UNITS, TYPES: TYPES, BASE: BASE, MEGA: MEGA, SPACES: SPACES, ORDER: ORDER, CORNERS: CORNERS, COLORS: COLORS,
    MAX_ORDERS: MAX_ORDERS, MAX_ROUNDS: MAX_ROUNDS, INCOME_PER_TERRITORY: INCOME_PER_TERRITORY, BASE_INCOME: BASE_INCOME,
    rngFrom: rngFrom, clone: clone, canEnter: canEnter, powerOf: powerOf, countOf: countOf, addUnits: addUnits, enterable: enterable,
    hasInfantry: hasInfantry, newGame: newGame, sanitizeOrders: sanitizeOrders, resolveRound: resolveRound, homeOwner: homeOwner,
    hqSpace: hqSpace, portSpace: portSpace, totalPower: totalPower, unitsText: unitsText, cornersFor: cornersFor
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PowerEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
