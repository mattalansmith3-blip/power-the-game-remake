/* Power: The Game remake - UI */
(function () {
  'use strict';
  var E = window.PowerEngine, AI = window.PowerAI;
  var SP = E.SPACES, UN = E.UNITS;
  var $ = function (id) { return document.getElementById(id); };
  var NS = 'http://www.w3.org/2000/svg';

  var settings = { opp: 1, level: 'normal', timer: 0 };
  try { var saved = JSON.parse(localStorage.getItem('powerRemakeSettings') || 'null'); if (saved) settings = Object.assign(settings, saved); } catch (e) {}
  function saveSettings() { try { localStorage.setItem('powerRemakeSettings', JSON.stringify(settings)); } catch (e) {} }

  var G = {
    state: null, orders: [], sel: null, inspect: null, busy: false, mems: {}, hints: true, skip: false,
    logHtml: '', timerLeft: 0, timerId: null, zoom: 1, auto: false, startedAt: 0
  };
  window.__game = G; window.__E = E;

  /* ---------- icons (24x24, white) ---------- */
  var ICONS = {
    I: '<circle cx="12" cy="6.2" r="3.3"/><path d="M12 2.2a4.2 3.6 0 0 1 4.2 3.8H7.8A4.2 3.6 0 0 1 12 2.2z"/><path d="M6.5 21v-6.2a5.5 5.5 0 0 1 11 0V21z"/><rect x="15.5" y="9" width="2.2" height="12" rx="1" transform="rotate(14 16.6 15)"/>',
    T: '<rect x="3" y="13" width="18" height="6.5" rx="3.2"/><rect x="7" y="8" width="9" height="5.5" rx="1.8"/><rect x="14.5" y="9.7" width="8" height="2.2" rx="1"/><circle cx="6.5" cy="16.2" r="1.3" fill="#0006"/><circle cx="12" cy="16.2" r="1.3" fill="#0006"/><circle cx="17.5" cy="16.2" r="1.3" fill="#0006"/>',
    F: '<path d="M12 1.5l2 6.2 8.2 5.3v2.7l-8.2-2.4-.4 4.6 2.7 2v1.5L12 20.6 7.7 21.4v-1.5l2.7-2-.4-4.6-8.2 2.4V13l8.2-5.3z"/>',
    D: '<path d="M1.5 14.5h21l-3.2 5.5H4.7z"/><rect x="8" y="9.5" width="7" height="5" rx="1"/><rect x="10.7" y="5" width="1.7" height="4.8"/><rect x="15" y="10.8" width="7" height="1.7" rx=".8"/><rect x="3" y="11.3" width="4" height="3.2" rx=".8"/>'
  };
  function baseOf(t) { return t.length === 2 ? t[1] : t; }
  function isMega(t) { return t.length === 2; }
  function iconSvg(t, size) {
    return '<svg viewBox="0 0 24 24" width="' + (size || 24) + '" height="' + (size || 24) + '" fill="#fff">' + ICONS[baseOf(t)] + (isMega(t) ? '<path d="M20 0l1.3 2.7 2.9.4-2.1 2 .5 2.9L20 6.6l-2.6 1.4.5-2.9-2.1-2 2.900-.4z" fill="#ffd54a"/>' : '') + '</svg>';
  }
  function owner(pid) { return G.state.players[pid]; }
  function pColor(pid) { return pid == null ? '#999' : G.state.players[pid].color; }
  function pName(pid) { return pid === 0 && !G.state.players[0].ai ? 'You' : G.state.players[pid].colorName + (G.state.players[pid].ai ? ' AI' : ''); }
  var ORDER_TYPES = ['MF', 'MT', 'MD', 'MI', 'F', 'T', 'D', 'I'];
  function sortedTypes(u) { return ORDER_TYPES.filter(function (t) { return u[t] > 0; }); }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function uText(u) {
    return sortedTypes(u).map(function (t) { return u[t] + ' ' + UN[t].short; }).join(' + ');
  }

  /* ---------- board ---------- */
  var NODE_W = 168, NODE_H = 104, CHIP_W = 50, CHIP_H = 34;
  function buildStatic() {
    var h = '<defs><pattern id="waves" width="60" height="30" patternUnits="userSpaceOnUse"><path d="M0 15q15-12 30 0t30 0" fill="none" stroke="#ffffff" stroke-opacity=".07" stroke-width="2"/></pattern>' +
      '<marker id="ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker></defs>';
    h += '<rect width="1000" height="700" fill="#0b4a6e"/><rect width="1000" height="700" fill="url(#waves)"/>';
    // sea basin
    h += '<rect x="196" y="150" width="608" height="400" rx="60" fill="#1b79a8" opacity=".55"/>';
    var drawn = {};
    E.ORDER.forEach(function (a) {
      SP[a].nb.forEach(function (b) {
        var k = a < b ? a + b : b + a; if (drawn[k]) return; drawn[k] = 1;
        var A = SP[a], B = SP[b], ll = A.kind === 'land' && B.kind === 'land', ss = A.kind === 'sea' && B.kind === 'sea';
        if (ll) h += '<line x1="' + A.x + '" y1="' + A.y + '" x2="' + B.x + '" y2="' + B.y + '" stroke="#7b6a3c" stroke-width="20" stroke-linecap="round"/><line x1="' + A.x + '" y1="' + A.y + '" x2="' + B.x + '" y2="' + B.y + '" stroke="#d9c88f" stroke-width="12" stroke-linecap="round"/>';
        else if (ss) h += '<line x1="' + A.x + '" y1="' + A.y + '" x2="' + B.x + '" y2="' + B.y + '" stroke="#7fd0f2" stroke-opacity=".55" stroke-width="12" stroke-linecap="round" stroke-dasharray="2 14"/>';
        else h += '<line x1="' + A.x + '" y1="' + A.y + '" x2="' + B.x + '" y2="' + B.y + '" stroke="#fff" stroke-opacity=".4" stroke-width="3" stroke-dasharray="6 8"/>';
      });
    });
    $('board').innerHTML = h + '<g id="gNodes"></g><g id="gArrows"></g><g id="gFx"></g>';
  }

  function chipSvg(t, n, color, x, y, dim) {
    var mega = isMega(t);
    var fill = color, stroke = mega ? '#ffd54a' : '#fff';
    return '<g class="chip" transform="translate(' + x + ',' + y + ')"' + (dim ? ' opacity=".45"' : '') + '><rect width="' + CHIP_W + '" height="' + CHIP_H + '" rx="8" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (mega ? 3.2 : 2) + '"/>' +
      '<g transform="translate(2,5) scale(1)" fill="#fff"><svg viewBox="0 0 24 24" width="24" height="24" fill="#fff">' + ICONS[baseOf(t)] + '</svg></g>' +
      (mega ? '<path transform="translate(-3,-3) scale(.9)" d="M10 0l2.3 5 5.400.7-4 3.800 1 5.400L10 12.300 5.300 14.900l1-5.400-4-3.800L7.700 5z" fill="#ffd54a" stroke="#7a5a00" stroke-width="1" opacity="1"/>' : '') +
      '<text x="' + (CHIP_W - 5) + '" y="25" text-anchor="end" font-size="20" fill="#fff">' + n + '</text></g>';
  }
  function nodeSvg(id, board, opts) {
    var sp = SP[id], b = board[id], st = G.state;
    var x = sp.x - NODE_W / 2, y = sp.y - NODE_H / 2;
    var land = sp.kind === 'land';
    var home = sp.corner != null ? st.players.filter(function (p) { return p.corner === sp.corner; })[0] : null;
    var base = land ? '#eadfbb' : '#59b4e0';
    var stroke = land ? '#8a7a47' : '#2b7fa8';
    var sw = 2.5;
    if (home) { stroke = home.alive ? home.color : '#777'; sw = sp.hq ? 6 : 4; }
    var cls = 'node';
    if (opts.sel === id) cls += ' sel';
    if (opts.targets && opts.targets[id]) cls += ' target';
    if (opts.flash && opts.flash[id]) cls += ' flash';
    var h = '<g class="' + cls + '" data-space="' + id + '">';
    h += '<rect class="box" x="' + x + '" y="' + y + '" width="' + NODE_W + '" height="' + NODE_H + '" rx="' + (land ? 14 : 38) + '" fill="' + base + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
    if (b.o != null) h += '<rect x="' + x + '" y="' + y + '" width="' + NODE_W + '" height="' + NODE_H + '" rx="' + (land ? 14 : 38) + '" fill="' + pColor(b.o) + '" opacity=".38" pointer-events="none"/>';
    if (home && !land) h += '<text x="' + sp.x + '" y="' + (y + NODE_H - 6) + '" font-size="10" text-anchor="middle" fill="#0b3a55" opacity=".8">⚓ port</text>';
    // title row
    var nm = sp.name;
    h += '<text x="' + (sp.x - (opts.pw && b.o != null ? 14 : 0)) + '" y="' + (y + 17) + '" font-size="13" font-weight="700" text-anchor="middle" fill="' + (land ? '#3b3216' : '#073049') + '">' + esc(nm) + '</text>';
    if (sp.hq && home) {
      var alive = home.alive;
      h += '<g transform="translate(' + (x + 8) + ',' + (y + 22) + ')" pointer-events="none"><rect x="0" y="0" width="3" height="20" fill="#222"/><path d="M3 1h15l-4 5 4 5H3z" fill="' + (alive ? home.color : '#888') + '" stroke="#222" stroke-width="1"/>' + (alive ? '' : '<path d="M-2 -2L22 22M22 -2L-2 22" stroke="#b00" stroke-width="3"/>') + '</g>';
    }
    var types = sortedTypes(b.u);
    if (b.o != null && types.length) {
      var pw = E.powerOf(b.u);
      h += '<text x="' + (x + NODE_W - 7) + '" y="' + (y + 17) + '" font-size="12" font-weight="800" text-anchor="end" fill="#111">⚡' + pw + '</text>';
      var perRow = 3, rows = Math.ceil(types.length / perRow);
      var area0 = y + 24, areaH = NODE_H - 28;
      var totalH = rows * CHIP_H + (rows - 1) * 4;
      var yy = area0 + (areaH - totalH) / 2;
      for (var r = 0; r < rows; r++) {
        var rowTypes = types.slice(r * perRow, r * perRow + perRow);
        var rw = rowTypes.length * CHIP_W + (rowTypes.length - 1) * 4;
        var xx = sp.x - rw / 2;
        rowTypes.forEach(function (t, i) {
          var committed = opts.committed && opts.committed[id] && opts.committed[id][t];
          h += chipSvg(t, b.u[t], pColor(b.o), xx + i * (CHIP_W + 4), yy + r * (CHIP_H + 4), false);
        });
      }
    }
    h += '<rect class="ring" x="' + (x - 4) + '" y="' + (y - 4) + '" width="' + (NODE_W + 8) + '" height="' + (NODE_H + 8) + '" rx="' + (land ? 18 : 42) + '"/>';
    h += '<rect x="' + x + '" y="' + y + '" width="' + NODE_W + '" height="' + NODE_H + '" rx="14" fill="transparent"/>';
    return h + '</g>';
  }
  function arrowSvg(from, to, color, label, idx) {
    var A = SP[from], B = SP[to];
    var dx = B.x - A.x, dy = B.y - A.y, len = Math.sqrt(dx * dx + dy * dy), ux = dx / len, uy = dy / len;
    var off = (from < to ? 1 : -1) * 11, ox = -uy * off, oy = ux * off;
    var sx = A.x + ux * 56 + ox, sy = A.y + uy * 42 + oy, ex = B.x - ux * 62 + ox, ey = B.y - uy * 46 + oy;
    // keep within edge between boxes: shorten by box half-size along direction
    function hit(ux2, uy2) { var tx = ux2 ? (NODE_W / 2) / Math.abs(ux2) : 1e9, ty = uy2 ? (NODE_H / 2) / Math.abs(uy2) : 1e9; return Math.min(tx, ty); }
    var h1 = hit(ux, uy) - 4, h2 = hit(ux, uy) - 4;
    sx = A.x + ux * h1 + ox; sy = A.y + uy * h1 + oy; ex = B.x - ux * (h2 - 8) + ox; ey = B.y - uy * (h2 - 8) + oy;
    var mx = (sx + ex) / 2, my = (sy + ey) / 2;
    var s = '<g class="arrow"><line x1="' + sx + '" y1="' + sy + '" x2="' + ex + '" y2="' + ey + '" stroke="#000" stroke-opacity=".55" stroke-width="11" stroke-linecap="round"/>' +
      '<line x1="' + sx + '" y1="' + sy + '" x2="' + ex + '" y2="' + ey + '" stroke="' + color + '" stroke-width="7" stroke-linecap="round" marker-end="url(#ah)"/>';
    if (label) s += '<circle cx="' + mx + '" cy="' + my + '" r="11" fill="#fff" stroke="#000" stroke-width="2"/><text x="' + mx + '" y="' + (my + 5) + '" text-anchor="middle" font-size="14" font-weight="800" fill="#000">' + label + '</text>';
    return s + '</g>';
  }

  var lastBoardForFlash = null;
  function renderBoard(board, opts) {
    opts = opts || {};
    board = board || G.state.board;
    var committed = null;
    var h = '';
    E.ORDER.forEach(function (id) { h += nodeSvg(id, board, { sel: opts.sel === undefined ? (G.sel && G.sel.space) : opts.sel, targets: opts.targets, flash: opts.flash, pw: true, committed: committed }); });
    $('gNodes').innerHTML = h;
    $('gArrows').innerHTML = opts.arrows || '';
  }
  function myArrows() {
    var s = '', n = 0;
    G.orders.forEach(function (o, i) { if (o.t === 'move') s += arrowSvg(o.from, o.to, pColor(0), i + 1); });
    // mark merge orders
    G.orders.forEach(function (o, i) {
      if (o.t === 'merge') { var p = SP[o.at]; s += '<g class="arrow"><circle cx="' + (p.x + 62) + '" cy="' + (p.y - 38) + '" r="13" fill="#ffd54a" stroke="#000" stroke-width="2"/><text x="' + (p.x + 62) + '" y="' + (p.y - 33) + '" text-anchor="middle" font-size="13" font-weight="800">' + (i + 1) + '⛓</text></g>'; }
    });
    return s;
  }

  /* ---------- availability / selection ---------- */
  function sanity() { return E.sanitizeOrders(G.state, 0, G.orders); }
  function availAt(space) { var a = sanity().avail[space]; return a ? a : {}; }
  function targetsFor(space, take) {
    var res = {};
    SP[space].nb.forEach(function (y) {
      for (var t in take) if (take[t] > 0 && E.canEnter(t, SP[y].kind)) { res[y] = true; break; }
    });
    return res;
  }
  function selectSpace(id) {
    var a = availAt(id);
    if (!E.countOf(a)) { G.sel = null; G.inspect = id; return; }
    G.sel = { space: id, take: Object.assign({}, a) };
    G.inspect = id;
  }

  function onBoardClick(ev) {
    if (G.skipHandler) { G.skipHandler(); return; }
    if (G.busy || !G.state || G.state.over) return;
    var el = ev.target.closest ? ev.target.closest('[data-space]') : null;
    if (!el) { G.sel = null; refresh(); return; }
    var id = el.getAttribute('data-space');
    if (G.sel) {
      if (G.sel.space === id) { G.sel = null; refresh(); return; }
      var tg = targetsFor(G.sel.space, G.sel.take);
      if (tg[id]) { addMove(G.sel.space, id, G.sel.take); return; }
    }
    if (G.state.board[id].o === 0 && E.countOf(availAt(id))) selectSpace(id);
    else { G.sel = null; G.inspect = id; }
    refresh();
  }
  function addMove(from, to, take) {
    var u = E.enterable(take, SP[to].kind);
    var before = G.orders.length;
    if (before >= E.MAX_ORDERS) { toast('You already have 5 orders. Remove one first.'); return; }
    G.orders.push({ t: 'move', from: from, to: to, u: u });
    G.orders = sanity().orders;
    G.sel = null;
    if (G.orders.length === before) toast('That move is not possible.');
    refresh();
  }

  /* ---------- side panels ---------- */
  function orderText(o) {
    if (o.t === 'move') return 'Move ' + uText(o.u) + ': <b>' + esc(SP[o.from].name) + '</b> \u2192 <b>' + esc(SP[o.to].name) + '</b>';
    if (o.t === 'merge') return 'Merge 3 ' + UN[o.type].name + 's \u2192 ' + UN[E.MEGA[o.type]].name + ' at <b>' + esc(SP[o.at].name) + '</b>';
    return 'Buy ' + UN[o.type].name + ' (\u26A1' + UN[o.type].cost + ')';
  }
  function renderOrders() {
    var ol = $('orderList');
    if (!G.orders.length) ol.innerHTML = '<li class="empty">No orders yet. Tap one of your stacks on the map.</li>';
    else ol.innerHTML = G.orders.map(function (o, i) { return '<li>' + orderText(o) + '<button class="del" data-del="' + i + '" title="Remove this order" aria-label="Remove order ' + (i + 1) + '">✕</button></li>'; }).join('');
    $('orderCount').textContent = G.orders.length + '/' + E.MAX_ORDERS;
    $('btnUndo').disabled = !G.orders.length || G.busy;
    $('btnClear').disabled = !G.orders.length || G.busy;
  }
  function renderBuy() {
    var s = sanity(), me = G.state.players[0];
    var h = '';
    E.BASE.forEach(function (t) {
      var why = '';
      if (G.orders.length >= E.MAX_ORDERS) why = 'No orders left';
      else if (UN[t].cost > s.pointsLeft) why = 'Not enough power points';
      else if (t === 'D') { var pb = G.state.board[E.portSpace(me)]; if (pb.o != null && pb.o !== 0) why = 'Your home port is blocked'; }
      h += '<button class="btn buy" data-buy="' + t + '" ' + (why || G.busy || !me.alive ? 'disabled' : '') + ' title="' + esc(why || ('Buy a ' + UN[t].name + (t === 'D' ? ' (appears at your home port)' : ' (appears at your HQ)'))) + '">' +
        '<svg viewBox="0 0 24 24" fill="' + me.color + '" style="background:' + me.color + ';border-radius:6px;padding:2px"><g fill="#fff">' + ICONS[t] + '</g></svg><b>' + UN[t].short + '</b><span>⚡' + UN[t].cost + '</span></button>';
    });
    $('buyRow').innerHTML = h;
  }
  function renderTray() {
    var tray = $('tray'), st = G.state, h;
    if (G.sel) {
      var sp = SP[G.sel.space], a = availAt(G.sel.space);
      h = '<div class="win-title sub">Selected: ' + esc(sp.name) + '</div><div class="tbody"><div class="tray-empty">Pick how many of each to send, then tap a <b style="color:#16a34a">glowing</b> space.</div><div class="chips">';
      sortedTypes(a).forEach(function (t) {
        var n = G.sel.take[t] || 0;
        h += '<div class="uchip"><span class="ic" style="background:' + pColor(0) + '">' + iconSvg(t) + '</span><span class="nm">' + UN[t].name + '<small>power ' + UN[t].power + ' each</small></span>' +
          '<span class="step"><button data-step="-1" data-t="' + t + '" aria-label="fewer ' + UN[t].name + '">−</button><span class="n">' + n + '/' + a[t] + '</span><button data-step="1" data-t="' + t + '" aria-label="more ' + UN[t].name + '">+</button></span></div>';
      });
      h += '</div>';
      E.BASE.forEach(function (t) {
        if ((a[t] || 0) >= 3 && G.orders.length < E.MAX_ORDERS) h += '<button class="btn mergeBtn" data-merge="' + t + '">⛓ Merge 3 ' + UN[t].name + 's \u2192 ' + UN[E.MEGA[t]].name + ' (power ' + UN[E.MEGA[t]].power + ', was ' + 3 * UN[t].power + ')</button>';
      });
      h += '<div class="tray-empty" style="margin-top:6px">Selected power: <b>' + E.powerOf(G.sel.take) + '</b></div></div>';
    } else if (G.inspect) {
      var b = st.board[G.inspect], s2 = SP[G.inspect];
      var info = b.o == null ? 'Empty' : (pName(b.o) + ' \u2014 power <b>' + E.powerOf(b.u) + '</b>');
      h = '<div class="win-title sub">' + esc(s2.name) + ' <small>' + (s2.kind === 'sea' ? 'sea' : s2.hq ? 'HQ' : 'land') + '</small></div><div class="tbody">' + info;
      if (b.o != null) { h += '<div class="chips">'; sortedTypes(b.u).forEach(function (t) { h += '<div class="uchip"><span class="ic" style="background:' + pColor(b.o) + '">' + iconSvg(t) + '</span><span class="nm">' + UN[t].name + '<small>× ' + b.u[t] + '</small></span></div>'; }); h += '</div>'; }
      if (b.o === 0 && !E.countOf(availAt(G.inspect))) h += '<div class="tray-empty">All units here already have orders.</div>';
      if (s2.hq && E.homeOwner(st, G.inspect) != null) h += '<div class="tray-empty">⚑ ' + esc(pName(E.homeOwner(st, G.inspect))) + '\'s Flag is here. Park an Infantry here to the end of a round to take it.</div>';
      h += '</div>';
    } else {
      h = '<div class="win-title sub">Selection</div><div class="tbody tray-empty">Tap one of <b>your</b> stacks (blue counters) to give it a move. Tap any space to look at it.</div>';
    }
    tray.innerHTML = h;
  }
  function renderLegend() {
    var st = G.state;
    $('legend').innerHTML = st.players.map(function (p) {
      var pw = E.totalPower(st, p.id), n = 0;
      E.ORDER.forEach(function (id) { if (st.board[id].o === p.id) n += E.countOf(st.board[id].u); });
      return '<span class="lg"><span class="dot" style="background:' + p.color + '"></span><b>' + esc(pName(p.id)) + '</b>' + (p.alive ? ' power ' + pw + ' · ' + n + ' units' : ' <i>(out)</i>') + '</span>';
    }).join('') + '<span class="lg">⚡ = power points · flag = HQ</span>';
  }
  function renderHint() {
    var el = $('hint'), st = G.state;
    if (!G.hints || !st || st.over || G.busy || st.round > 2) { el.hidden = true; return; }
    var t;
    if (st.round === 1) {
      if (G.orders.length) t = '👍 <b>Nice, that\'s an order!</b> You can give up to 5 (move, merge or buy). When you\'re ready press <b>GO!</b> — everyone moves at the same time.';
      else if (G.sel) t = '👆 <b>Now tap a glowing green space</b> to send these units there. Use − / + below to send only some of them.';
      else t = '👋 <b>Welcome!</b> Tap one of <b>your</b> stacks (blue counters) to select it. Try the big one in your HQ (the flag, top-left).';
    } else t = '⚔ <b>Fights:</b> the side with more power <b>captures</b> the loser\'s units — they change colour and join the winner. Take ⚡ points from neutral land, and spend them on units.';
    el.innerHTML = t + '<button class="x" id="hintX" aria-label="Hide hints">✕</button>';
    el.hidden = false;
  }
  function updateTop() {
    var st = G.state, me = st.players[0], s = sanity();
    $('roundPill').textContent = 'Round ' + Math.min(st.round, st.maxRounds);
    var pend = me.points - s.pointsLeft;
    $('ptsPill').textContent = '⚡ ' + me.points + (pend ? ' (−' + pend + ' pending)' : '');
    var go = $('go');
    go.disabled = G.busy || st.over || !me.alive;
    go.textContent = G.busy ? 'Resolving…' : 'GO! ▶' + (G.orders.length ? '  (' + G.orders.length + ')' : '');
    go.classList.toggle('pulse', !go.disabled && G.orders.length > 0);
  }
  function refresh() {
    if (!G.state) return;
    var tg = G.sel ? targetsFor(G.sel.space, G.sel.take) : null;
    renderBoard(null, { targets: tg, arrows: myArrows() });
    renderTray(); renderOrders(); renderBuy(); renderLegend(); renderHint(); updateTop();
  }

  /* ---------- toast ---------- */
  var toastT;
  function toast(msg) {
    var b = $('banner'); b.className = 'banner'; b.textContent = msg; b.hidden = false; clearTimeout(toastT);
    toastT = setTimeout(function () { b.hidden = true; }, 1800);
  }

  /* ---------- log ---------- */
  function appendLog(round, lines) {
    var h = '<div class="rh">Round ' + round + '</div>';
    lines.forEach(function (l) {
      var cls = /captur|wins/.test(l.text) ? 'cap' : '';
      h += '<div class="l ' + cls + '">' + esc(l.text) + '</div>';
    });
    G.logHtml = h + G.logHtml;
    $('log').innerHTML = G.logHtml;
  }

  /* ---------- animation ---------- */
  function wait(ms) { return new Promise(function (res) { if (G.skip) return res(); var t = setTimeout(res, ms); G.skipHandler = function () { clearTimeout(t); G.skip = true; res(); }; }); }
  function banner(text, cls, ms) {
    var b = $('banner'); b.className = 'banner ' + (cls || ''); b.textContent = text; b.hidden = false;
    return wait(ms || 800);
  }
  function tween(dur, fn) {
    return new Promise(function (res) {
      if (G.skip) { fn(1); return res(); }
      var t0 = performance.now();
      G.skipHandler = function () { G.skip = true; };
      (function step(now) {
        var k = Math.min(1, (now - t0) / dur);
        if (G.skip) k = 1;
        fn(k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
        if (k < 1) requestAnimationFrame(step); else res();
      })(t0);
    });
  }
  function ghostSvg(owner, u) {
    var types = sortedTypes(u).slice(0, 3);
    var w = types.length * (CHIP_W + 2);
    var s = '';
    types.forEach(function (t, i) { s += chipSvg(t, u[t], pColor(owner), -w / 2 + i * (CHIP_W + 2), -CHIP_H / 2, false); });
    return s;
  }
  async function animate(res, prevState) {
    var st = prevState;
    var arrows = '';
    G.skip = false;
    // 1. reveal orders
    var all = [];
    Object.keys(res.orders).forEach(function (pid) { res.orders[pid].forEach(function (o) { if (o.t === 'move') all.push({ pid: +pid, o: o }); }); });
    all.forEach(function (m) { arrows += arrowSvg(m.o.from, m.o.to, pColor(m.pid), ''); });
    renderBoard(st.board, { arrows: arrows, sel: null });
    await banner('Orders revealed!', '', all.length ? 1300 : 600);
    // 2. buys / merges
    var hasSetup = res.events.some(function (e) { return e.k === 'buy' || e.k === 'merge'; });
    if (hasSetup) {
      renderBoard(res.setupBoard, { arrows: arrows, sel: null, flash: (function () { var f = {}; res.events.forEach(function (e) { if (e.k === 'buy' || e.k === 'merge') f[e.at] = 1; }); return f; })() });
      await banner('Buying & merging…', '', 700);
    }
    // 3. movement
    var moves = res.events.filter(function (e) { return e.k === 'move'; });
    if (moves.length) {
      renderBoard(res.departBoard, { arrows: '', sel: null });
      var fx = $('gFx'); var ghosts = [];
      var gs = '';
      moves.forEach(function (m, i) { gs += '<g id="gh' + i + '">' + ghostSvg(m.pid, m.u) + '</g>'; });
      fx.innerHTML = gs;
      var passes = res.events.filter(function (e) { return e.k === 'pass'; });
      var passShown = false;
      $('banner').hidden = true;
      await tween(1100, function (k) {
        moves.forEach(function (m, i) {
          var A = SP[m.from], B = SP[m.to];
          var g = document.getElementById('gh' + i);
          if (g) g.setAttribute('transform', 'translate(' + (A.x + (B.x - A.x) * k) + ',' + (A.y + (B.y - A.y) * k) + ')');
        });
        if (k > .5 && !passShown && passes.length) {
          passShown = true;
          var s = '';
          passes.forEach(function (p) { var A = SP[p.a], B = SP[p.b]; s += '<text class="pop" x="' + ((A.x + B.x) / 2) + '" y="' + ((A.y + B.y) / 2) + '" text-anchor="middle">⚔ ' + (p.winner == null ? 'tie' : pName(p.winner) + ' wins') + '</text>'; });
          fx.insertAdjacentHTML('beforeend', s);
        }
      });
      if (passes.length) await wait(500);
      fx.innerHTML = '';
    }
    // 4. final board with fights
    var fights = res.events.filter(function (e) { return e.k === 'fight'; });
    var fl = {}; fights.forEach(function (f) { fl[f.at] = 1; });
    renderBoard(res.state.board, { arrows: '', sel: null, flash: fl });
    for (var i = 0; i < fights.length && i < 6; i++) {
      var f = fights[i], sp = SP[f.at];
      var txt = f.parties.map(function (p) { return pName(p.pid) + ' ' + p.power; }).join('  vs  ');
      $('gFx').innerHTML = '<text class="pop" x="' + sp.x + '" y="' + (sp.y - 50) + '" text-anchor="middle" font-size="20">⚔ ' + esc(txt) + '</text><text class="pop" x="' + sp.x + '" y="' + (sp.y + 66) + '" text-anchor="middle" fill="' + (f.winner != null ? pColor(f.winner) : '#fff') + '">' + (f.winner != null ? pName(f.winner) + ' captures!' : 'Tie - attackers turn back') + '</text>';
      await wait(900);
    }
    $('gFx').innerHTML = '';
    // 5. flags
    var flags = res.events.filter(function (e) { return e.k === 'flag'; });
    for (var j = 0; j < flags.length; j++) {
      await banner('🚩 ' + pName(flags[j].by) + ' captured the Flag! ' + pName(flags[j].victim) + ' is out.', 'flag', 2200);
    }
    $('banner').hidden = true;
  }

  /* ---------- round flow ---------- */
  async function doGo(quick) {
    if (G.busy || G.state.over) return;
    G.busy = true; stopTimer(); G.sel = null; G.inspect = null;
    var st = G.state;
    var by = {};
    by[0] = st.players[0].alive && !st.players[0].ai ? sanity().orders : [];
    st.players.forEach(function (p) {
      if (p.alive && p.ai) by[p.id] = AI.plan(st, p.id, Math.random, G.mems[p.id] || (G.mems[p.id] = {}));
    });
    var res = E.resolveRound(st, by);
    refresh();
    if (quick) { G.skip = true; } else await animate(res, st);
    G.skipHandler = null;
    G.state = res.state; G.orders = [];
    appendLog(st.round, res.log);
    G.busy = false;
    refresh();
    if (G.state.over) return showOver();
    if (!G.state.players[0].alive && !G.auto) return showEliminated();
    if (G.auto) { setTimeout(function () { doGo(true); }, 60); return; }
    startTimer();
  }
  function showOver() {
    var s = G.state, me = s.players[0];
    var win = s.winner;
    var youWin = win === 0;
    $('overTitle').textContent = youWin ? '🏆 Victory!' : (me.alive ? 'Game over' : 'Defeat');
    var why = s.endReason === 'time' ? ' (round limit reached, so the biggest army and bank wins)' : '';
    $('overText').innerHTML = youWin ? 'You captured every rival Flag in <b>' + (s.round - 1) + '</b> rounds. Well played, commander!' :
      '<b>' + esc(pName(win)) + '</b> wins after <b>' + (s.round - 1) + '</b> rounds' + why + '.';
    $('overModal').hidden = false;
  }
  function showEliminated() {
    $('overTitle').textContent = 'Your Flag was captured';
    $('overText').innerHTML = 'You are out of the game. Watch the AIs finish, or start a new game.';
    $('overModal').hidden = false;
    G.elim = true;
  }
  function stopTimer() { clearInterval(G.timerId); G.timerId = null; $('timerPill').hidden = !settings.timer; }
  function startTimer() {
    stopTimer();
    if (!settings.timer || G.state.over || !G.state.players[0].alive) { $('timerPill').hidden = true; return; }
    G.timerLeft = settings.timer; $('timerPill').hidden = false;
    var tick = function () { $('timerPill').textContent = '⏱ ' + G.timerLeft; $('timerPill').style.color = G.timerLeft <= 10 ? '#ff7b72' : ''; };
    tick();
    G.timerId = setInterval(function () {
      G.timerLeft--; tick();
      if (G.timerLeft <= 0) { clearInterval(G.timerId); doGo(); }
    }, 1000);
  }

  /* ---------- new game ---------- */
  function newGame() {
    stopTimer();
    G.auto = false; G.elim = false;
    G.state = E.newGame({ players: settings.opp + 1, level: settings.level });
    G.orders = []; G.sel = null; G.inspect = null; G.mems = {}; G.busy = false; G.logHtml = ''; G.hints = true;
    $('log').innerHTML = '<div class="l" style="color:#666">Orders and results will appear here after each round.</div>';
    $('overModal').hidden = true; $('startScreen').hidden = true;
    refresh();
    startTimer();
    focusZoom();
  }
  function focusZoom() {
    var wrap = $('boardWrap'); wrap.scrollLeft = 0; wrap.scrollTop = 0;
  }
  function applyZoom() {
    $('board').style.width = (G.zoom * 100) + '%';
  }
  function initZoom() {
    G.zoom = window.innerWidth < 600 ? 1.35 : 1;
    applyZoom();
  }

  /* ---------- events ---------- */
  function seg(id, key, num) {
    var box = $(id);
    Array.prototype.forEach.call(box.children, function (b) {
      var v = b.getAttribute('data-v'); if (num) v = +v;
      b.classList.toggle('on', settings[key] === v);
      b.addEventListener('click', function () {
        settings[key] = v; saveSettings();
        Array.prototype.forEach.call(box.children, function (c) { c.classList.remove('on'); }); b.classList.add('on');
      });
    });
  }
  function init() {
    buildStatic(); initZoom();
    seg('optOpp', 'opp', true); seg('optLvl', 'level', false); seg('optTimer', 'timer', true);
    $('board').addEventListener('click', onBoardClick);
    $('btnStart').addEventListener('click', newGame);
    $('btnNew').addEventListener('click', function () { stopTimer(); $('startScreen').hidden = false; });
    $('btnAgain').addEventListener('click', function () { $('overModal').hidden = true; $('startScreen').hidden = false; });
    $('btnCloseOver').addEventListener('click', function () {
      $('overModal').hidden = true;
      if (G.elim && !G.state.over) { G.auto = true; doGo(true); }
    });
    $('btnCloseOver').textContent = 'Look at the map';
    $('btnRules').addEventListener('click', function () { $('rulesModal').hidden = false; });
    $('btnRules2').addEventListener('click', function () { $('rulesModal').hidden = false; });
    document.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { $(b.getAttribute('data-close')).hidden = true; }); });
    $('go').addEventListener('click', function () { doGo(); });
    $('btnUndo').addEventListener('click', function () { G.orders.pop(); G.sel = null; refresh(); });
    $('btnClear').addEventListener('click', function () { G.orders = []; G.sel = null; refresh(); });
    $('zIn').addEventListener('click', function () { G.zoom = Math.min(3, G.zoom + .35); applyZoom(); });
    $('zOut').addEventListener('click', function () { G.zoom = Math.max(1, G.zoom - .35); applyZoom(); });
    $('side').addEventListener('click', function (ev) {
      var t = ev.target.closest('button'); if (!t) return;
      if (t.id === 'hintX') { G.hints = false; refresh(); return; }
      if (t.hasAttribute('data-del')) { G.orders.splice(+t.getAttribute('data-del'), 1); G.orders = sanity().orders; G.sel = null; refresh(); return; }
      if (t.hasAttribute('data-buy')) {
        if (G.orders.length >= E.MAX_ORDERS) return toast('You already have 5 orders.');
        G.orders.push({ t: 'buy', type: t.getAttribute('data-buy') }); G.orders = sanity().orders; refresh(); return;
      }
      if (t.hasAttribute('data-merge')) { G.orders.push({ t: 'merge', at: G.sel.space, type: t.getAttribute('data-merge') }); G.orders = sanity().orders; G.sel = null; refresh(); return; }
      if (t.hasAttribute('data-step') && G.sel) {
        var ty = t.getAttribute('data-t'), d = +t.getAttribute('data-step'), a = availAt(G.sel.space);
        G.sel.take[ty] = Math.max(0, Math.min(a[ty] || 0, (G.sel.take[ty] || 0) + d));
        refresh();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { G.sel = null; ['rulesModal'].forEach(function (m) { $(m).hidden = true; }); if (G.state) refresh(); }
    });
    // show start screen on load; remember settings
    $('startScreen').hidden = false;
    // create a preview game behind the start screen
    G.state = E.newGame({ players: settings.opp + 1, level: settings.level });
    refresh();
  }
  init();
})();
