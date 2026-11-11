# Power: The Game (remake)

A small, easy-to-learn, turn-based strategy game inspired by *Power: The Game* (1981 board game / IBM 1995).
Plan up to five secret orders, press **GO!**, and everyone moves at once. Bigger forces **capture** smaller ones. Take an enemy Flag with Infantry to win.

**Play:** https://mattalansmith3-blip.github.io/power-the-game-remake/ (or open `index.html` locally, no server needed).

## Rules (one screen)
1. Win by moving an **Infantry** into an enemy HQ and holding it to the end of the round. They're out, you take all their units.
2. Each round: up to **5 secret orders**, then **GO!** – all players' moves resolve at the same time.
3. Orders: **Move** (to an adjacent space), **Merge** (3 of a kind → Mega), **Buy** (new unit at HQ / home port).
4. Units: Infantry 2 · Tank 3 · Destroyer 4 · Fighter 5. Megas: 10 / 15 / 20 / 25 (Inf / Tank / Destroyer / Fighter).
5. Fights: the bigger total power **captures** every loser. Ties: attackers turn back. Armies swapping places fight on the road.
6. Power points: +1 per round and +2 per neutral/foreign land space held all round.
7. Land units: land only. Destroyers: sea only. Fighters: both.

## Files
- `engine.js` – rules engine (pure logic, shared by the browser and the node tests)
- `ai.js` – AI planner (Easy / Normal / Hard)
- `ui.js`, `style.css`, `index.html` – the browser UI (plain HTML/CSS/JS, no dependencies)
- `sim.js` – headless AI-vs-AI simulation: `node sim.js 300 normal`
- `tests/rules.test.js` – rule unit tests: `node tests/rules.test.js`
- `tests/e2e.py` – Playwright click-through at desktop and 390px phone width
- `tests/sim-report.txt` – last simulation results
- `assets/splash.jpg` – AI-generated title art
