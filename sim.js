const E = require('./engine.js'); const AI = require('./ai.js');
function playGame(n, level, seed, opts) {
  opts = opts || {};
  const rng = E.rngFrom(seed);
  let s = E.newGame({ players: n, level, seed, allAI: true });
  if (opts.levels) s.players.forEach((p, i) => p.level = opts.levels[i]);
  let rounds = 0; const mems = {};
  while (!s.over) {
    const by = {};
    s.players.forEach(p => { if (p.alive) by[p.id] = AI.plan(s, p.id, rng, mems[p.id] || (mems[p.id] = {})); });
    // validate every AI order is fully accepted
    s.players.forEach(p => { if (p.alive) { const r = E.sanitizeOrders(s, p.id, by[p.id]); if (r.orders.length !== by[p.id].length) throw new Error('AI produced invalid order: ' + JSON.stringify(by[p.id]) + ' -> ' + r.errors); } });
    const r = E.resolveRound(s, by); s = r.state; rounds++;
    // invariants
    s.players.forEach(p => { if (p.points < 0 || !Number.isFinite(p.points)) throw new Error('bad points'); });
    for (const id of E.ORDER) { const b = s.board[id]; for (const t in b.u) { if (b.u[t] < 0) throw new Error('neg'); if (!E.canEnter(t, E.SPACES[id].kind)) throw new Error('illegal unit ' + t + ' at ' + id); } if ((b.o == null) !== (E.countOf(b.u) === 0)) throw new Error('owner/unit mismatch at ' + id); }
    if (rounds > 200) throw new Error('runaway');
  }
  return { rounds, winner: s.winner, reason: s.endReason, state: s };
}
if (require.main === module) {
  const N = +process.argv[2] || 200; const level = process.argv[3] || 'normal';
  const lines = [];
  [2, 3, 4].forEach(n => {
    const wins = Array(n).fill(0); let tot = 0, time = 0, mx = 0, rs = [];
    for (let i = 0; i < N; i++) { const r = playGame(n, level, 1000 + i * 7 + n); wins[r.winner]++; tot += r.rounds; rs.push(r.rounds); if (r.reason === 'time') time++; mx = Math.max(mx, r.rounds); }
    rs.sort((a, b) => a - b);
    lines.push(`${n} players (${level}): avg rounds ${(tot / N).toFixed(1)}, median ${rs[N >> 1]}, max ${mx}, timeouts ${time}/${N}, wins by seat ${wins.map(w => (100 * w / N).toFixed(0) + '%').join(' / ')}`);
  });
  console.log(lines.join('\n'));
}
module.exports = { playGame };
