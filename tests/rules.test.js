const assert = require('assert');
const E = require('../engine.js');
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('  ok   ' + name); } catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; } }
function blank(n = 2) {
  const s = E.newGame({ players: n, seed: 1 });
  E.ORDER.forEach(id => { s.board[id] = { o: null, u: {} }; });
  s.players.forEach(p => { p.points = 0; });
  return s;
}
function put(s, id, o, u) { s.board[id] = { o, u: Object.assign({}, u) }; }
// player 0 = NW corner, player 1 = SE corner (2p)
test('board: 4 land corners with HQ, 5 neutral land, 8 sea zones', () => {
  const hq = E.ORDER.filter(id => E.SPACES[id].hq), land = E.ORDER.filter(id => E.SPACES[id].kind === 'land'), sea = E.ORDER.filter(id => E.SPACES[id].kind === 'sea');
  assert.strictEqual(hq.length, 4); assert.strictEqual(land.length, 17); assert.strictEqual(sea.length, 8);
  E.ORDER.forEach(a => E.SPACES[a].nb.forEach(b => assert(E.SPACES[b].nb.includes(a), 'adjacency symmetric')));
});
test('unit powers and mega values', () => {
  assert.deepStrictEqual(['I', 'T', 'D', 'F'].map(t => E.UNITS[t].power), [2, 3, 4, 5]);
  assert.deepStrictEqual(['MI', 'MT', 'MF', 'MD'].map(t => E.UNITS[t].power), [10, 15, 25, 20]);
});
test('bigger force captures all losers (they change colour and join)', () => {
  const s = blank(); put(s, 'nw_hq', 0, { I: 1 }); put(s, 'se_hq', 1, { I: 1 });
  put(s, 'nw_a', 0, { T: 2, I: 1 }); put(s, 'nt', 1, { I: 2, T: 1 });   // 8 vs 7
  const r = E.resolveRound(s, { 0: [{ t: 'move', from: 'nw_a', to: 'nt', u: { T: 2, I: 1 } }], 1: [] });
  assert.strictEqual(r.state.board.nt.o, 0);
  assert.deepStrictEqual(r.state.board.nt.u, { T: 3, I: 3 });
  assert.strictEqual(r.state.board.nw_a.o, null);
});
test('defender with more power captures the attacker', () => {
  const s = blank(); put(s, 'nw_hq', 0, { I: 1 }); put(s, 'se_hq', 1, { I: 1 });
  put(s, 'nw_a', 0, { I: 2 }); put(s, 'nt', 1, { T: 2 });
  const r = E.resolveRound(s, { 0: [{ t: 'move', from: 'nw_a', to: 'nt', u: { I: 2 } }], 1: [] });
  assert.strictEqual(r.state.board.nt.o, 1); assert.deepStrictEqual(r.state.board.nt.u, { T: 2, I: 2 });
});
test('tie: attackers turn back, defender stays', () => {
  const s = blank(); put(s, 'nw_hq', 0, { I: 1 }); put(s, 'se_hq', 1, { I: 1 });
  put(s, 'nw_a', 0, { T: 2 }); put(s, 'nt', 1, { T: 1, I: 1, F: 0 }); s.board.nt.u = { T: 2 };
  const r = E.resolveRound(s, { 0: [{ t: 'move', from: 'nw_a', to: 'nt', u: { T: 2 } }], 1: [] });
  assert.strictEqual(r.state.board.nt.o, 1); assert.deepStrictEqual(r.state.board.nt.u, { T: 2 });
  assert.strictEqual(r.state.board.nw_a.o, 0); assert.deepStrictEqual(r.state.board.nw_a.u, { T: 2 });
});
test('swap: units passing each other fight on the road; winner keeps going with captured units', () => {
  const s = blank(); put(s, 'nw_hq', 0, { I: 1 }); put(s, 'se_hq', 1, { I: 1 });
  put(s, 'nw_a', 0, { T: 2 }); put(s, 'nt', 1, { I: 2 });     // 6 vs 4, cross paths
  const r = E.resolveRound(s, { 0: [{ t: 'move', from: 'nw_a', to: 'nt', u: { T: 2 } }], 1: [{ t: 'move', from: 'nt', to: 'nw_a', u: { I: 2 } }] });
  assert(r.events.some(e => e.k === 'pass' && e.winner === 0));
  assert.strictEqual(r.state.board.nt.o, 0); assert.deepStrictEqual(r.state.board.nt.u, { T: 2, I: 2 });
  assert.strictEqual(r.state.board.nw_a.o, null);
});
test('swap tie: both turn back', () => {
  const s = blank(); put(s, 'nw_hq', 0, { I: 1 }); put(s, 'se_hq', 1, { I: 1 });
  put(s, 'nw_a', 0, { T: 2 }); put(s, 'nt', 1, { T: 2 });
  const r = E.resolveRound(s, { 0: [{ t: 'move', from: 'nw_a', to: 'nt', u: { T: 2 } }], 1: [{ t: 'move', from: 'nt', to: 'nw_a', u: { T: 2 } }] });
  assert.deepStrictEqual(r.state.board.nw_a, { o: 0, u: { T: 2 } }); assert.deepStrictEqual(r.state.board.nt, { o: 1, u: { T: 2 } });
});
test('two armies racing into an empty space: higher power wins and captures', () => {
  const s = blank(); put(s, 'nw_hq', 0, { I: 1 }); put(s, 'se_hq', 1, { I: 1 });
  put(s, 'nw_a', 0, { T: 1 }); put(s, 'ne_a', 1, { T: 1, I: 1 });
  const r = E.resolveRound(s, { 0: [{ t: 'move', from: 'nw_a', to: 'nt', u: { T: 1 } }], 1: [{ t: 'move', from: 'ne_a', to: 'nt', u: { T: 1, I: 1 } }] });
  assert.strictEqual(r.state.board.nt.o, 1); assert.deepStrictEqual(r.state.board.nt.u, { T: 2, I: 1 });
});
test('merge 3 of a kind into a Mega', () => {
  const s = blank(); put(s, 'nw_hq', 0, { I: 3, T: 1 }); put(s, 'se_hq', 1, { I: 1 });
  const r = E.resolveRound(s, { 0: [{ t: 'merge', at: 'nw_hq', type: 'I' }], 1: [] });
  assert.deepStrictEqual(r.state.board.nw_hq.u, { T: 1, MI: 1 }); assert.strictEqual(E.powerOf(r.state.board.nw_hq.u), 13);
});
test('cannot merge with fewer than 3, merged units cannot also move', () => {
  const s = blank(); put(s, 'nw_hq', 0, { I: 2 }); put(s, 'se_hq', 1, { I: 1 });
  assert.strictEqual(E.sanitizeOrders(s, 0, [{ t: 'merge', at: 'nw_hq', type: 'I' }]).orders.length, 0);
  put(s, 'nw_hq', 0, { I: 3 });
  const o = E.sanitizeOrders(s, 0, [{ t: 'merge', at: 'nw_hq', type: 'I' }, { t: 'move', from: 'nw_hq', to: 'nw_a', u: { I: 1 } }]);
  assert.strictEqual(o.orders.length, 1);
});
test('buy: spends points, unit appears at HQ (destroyer at port) and cannot move this round', () => {
  const s = blank(); put(s, 'nw_hq', 0, { I: 1 }); put(s, 'se_hq', 1, { I: 1 }); s.players[0].points = 9;
  const r = E.resolveRound(s, { 0: [{ t: 'buy', type: 'T' }, { t: 'buy', type: 'D' }, { t: 'buy', type: 'F' }, { t: 'buy', type: 'F' }], 1: [] });
  assert.strictEqual(r.state.board.nw_hq.u.T, 1); assert.strictEqual(r.state.board.sNW.u.D, 1);
  assert.strictEqual(r.state.board.nw_hq.u.F, undefined);        // 5-point Fighter refused: only 2 points left
  assert.strictEqual(r.state.players[0].points, 9 - 3 - 4 + 1);  // +1 base income (nothing foreign held)
});
test('cannot buy what you cannot afford', () => {
  const s = blank(); s.players[0].points = 1; put(s, 'nw_hq', 0, { I: 1 });
  assert.strictEqual(E.sanitizeOrders(s, 0, [{ t: 'buy', type: 'I' }]).orders.length, 0);
});
test('land units cannot enter sea and destroyers cannot enter land; fighters go both', () => {
  const s = blank(); put(s, 'nw_hq', 0, { I: 1 }); put(s, 'nw_a', 0, { I: 1, F: 1 }); put(s, 'sNW', 0, { D: 1, F: 1 });
  const o = E.sanitizeOrders(s, 0, [{ t: 'move', from: 'nw_a', to: 'sNW', u: { I: 1, F: 1 } }, { t: 'move', from: 'sNW', to: 'nw_a', u: { D: 1, F: 1 } }]);
  assert.deepStrictEqual(o.orders[0].u, { F: 1 }); assert.deepStrictEqual(o.orders[1].u, { F: 1 });
});
test('max 5 orders', () => {
  const s = blank(); s.players[0].points = 20; put(s, 'nw_hq', 0, { I: 9 });
  const orders = Array(8).fill({ t: 'buy', type: 'I' });
  assert.strictEqual(E.sanitizeOrders(s, 0, orders).orders.length, 5);
});
test('only adjacent moves allowed', () => {
  const s = blank(); put(s, 'nw_hq', 0, { I: 2 });
  assert.strictEqual(E.sanitizeOrders(s, 0, [{ t: 'move', from: 'nw_hq', to: 'nt', u: { I: 1 } }]).orders.length, 0);
});
test('flag capture: infantry in enemy HQ at end of round eliminates owner and transfers all units', () => {
  const s = blank(); put(s, 'nw_hq', 0, { T: 1 }); put(s, 'nw_a', 0, { I: 1 });
  put(s, 'se_hq', 1, { I: 1 }); put(s, 'se_a', 1, { T: 2 }); put(s, 'nt', 1, { F: 1 });
  put(s, 'ne_a', 0, { I: 5, T: 1 }); // attack strong enough
  s.board.se_hq.u = { I: 1 }; put(s, 'se_b', 0, { MI: 1, T: 1 });
  const r = E.resolveRound(s, { 0: [{ t: 'move', from: 'se_b', to: 'se_hq', u: { MI: 1, T: 1 } }], 1: [] });
  assert.strictEqual(r.state.players[1].alive, false); assert.strictEqual(r.state.over, true); assert.strictEqual(r.state.winner, 0);
  assert.strictEqual(r.state.board.se_a.o, 0); assert.strictEqual(r.state.board.nt.o, 0);
  assert.strictEqual(r.state.board.se_hq.o, 0);
});
test('tanks alone cannot take a flag (only infantry)', () => {
  const s = blank(); put(s, 'nw_hq', 0, { I: 1 }); put(s, 'se_hq', 1, { I: 1 }); put(s, 'se_b', 0, { T: 3 });
  const r = E.resolveRound(s, { 0: [{ t: 'move', from: 'se_b', to: 'se_hq', u: { T: 3 } }], 1: [] });
  assert.strictEqual(r.state.board.se_hq.o, 0); assert.strictEqual(r.state.players[1].alive, true); assert.strictEqual(r.state.over, false);
});
test('infantry captured in the same fight do not take the flag for you', () => {
  const s = blank(); put(s, 'nw_hq', 0, { I: 1 }); put(s, 'se_hq', 1, { I: 1 }); put(s, 'se_b', 0, { T: 3 });
  const r = E.resolveRound(s, { 0: [{ t: 'move', from: 'se_b', to: 'se_hq', u: { T: 3 } }], 1: [] });
  assert.deepStrictEqual(r.state.board.se_hq.u, { T: 3, I: 1 }); assert.strictEqual(r.state.players[1].alive, true);
  // next round, the captured infantry (now yours) is already there -> it holds the HQ with infantry
  const r2 = E.resolveRound(r.state, { 0: [], 1: [] });
  assert.strictEqual(r2.state.players[1].alive, false);
});
test('power points: +1 base, +2 per foreign/neutral land held all round; own country and sea earn nothing', () => {
  const s = blank(); put(s, 'nw_hq', 0, { I: 1 }); put(s, 'nw_a', 0, { I: 1 }); put(s, 'nt', 0, { I: 1 }); put(s, 'sN', 0, { D: 1 }); put(s, 'ne_a', 0, { I: 1 });
  put(s, 'se_hq', 1, { I: 1 });
  const r = E.resolveRound(s, { 0: [], 1: [] });
  assert.strictEqual(r.state.players[0].points, 1 + 2 * 2);      // nt + ne_a (ne corner is empty => neutral)
  assert.strictEqual(r.state.players[1].points, 1);
});
test('a space only earns points if held for the entire round (moving in does not count yet)', () => {
  const s = blank(); put(s, 'nw_hq', 0, { I: 1 }); put(s, 'nw_a', 0, { I: 2 }); put(s, 'se_hq', 1, { I: 1 });
  const r = E.resolveRound(s, { 0: [{ t: 'move', from: 'nw_a', to: 'nt', u: { I: 2 } }], 1: [] });
  assert.strictEqual(r.state.players[0].points, 1);
  const r2 = E.resolveRound(r.state, { 0: [], 1: [] });
  assert.strictEqual(r2.state.players[0].points, 1 + 1 + 2);
});
test('3-way fight: strongest wins and captures both others', () => {
  const s = blank(3); [0, 1, 2].forEach(i => put(s, E.hqSpace(s.players[i]), i, { I: 1 }));
  put(s, 'nw_a', 0, { T: 2 }); put(s, 'ne_a', 1, { T: 1, I: 1 }); put(s, 'nt', 2, { I: 1 });
  s.players[2].corner;
  const r = E.resolveRound(s, { 0: [{ t: 'move', from: 'nw_a', to: 'nt', u: { T: 2 } }], 1: [{ t: 'move', from: 'ne_a', to: 'nt', u: { T: 1, I: 1 } }], 2: [] });
  assert.strictEqual(r.state.board.nt.o, 0);   // T2=6 beats 5 and 2
  assert.deepStrictEqual(r.state.board.nt.u, { T: 3, I: 2 });
});
test('headless: complete AI games always reach a legal end', () => {
  const { playGame } = require('../sim.js');
  for (let i = 0; i < 20; i++) { const r = playGame(2 + (i % 3), 'normal', 77 + i); assert(r.state.over); }
});
console.log(`\n${passed} passed`);
