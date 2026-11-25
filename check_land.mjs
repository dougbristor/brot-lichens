// check_land.mjs (insights 11-25): the control for makeSim's addLineage, the in-training game's landing.
//   A  two lineages seeded at the start == one seeded + the second landed by addLineage before tick 1, cell for cell after T ticks
//      (seeds with inf0 0 draw no random number, and the two clumps are disjoint, so both runs must be the same run).
//   B  a mid-game landing: every seed cell holds the new lineage, clean; count() has one more lineage.
//   plants (must FAIL A): land the wrong genome; land on the wrong cells.
//   node check_land.mjs [old_lichens.mjs]  also checks that runs which never land are byte-exact with the old code.
import { readFileSync } from 'node:fs';
import { boardFromFlat, clumpAt, farClump } from './board.mjs';
import { makeSim, runAgents, BASE } from './lichens.mjs';
const IDX = JSON.parse(readFileSync(new URL('boards/index.json', import.meta.url))), id = IDX.boards.find((b) => b.conv).id;
const d = JSON.parse(readFileSync(new URL(`boards/${id}.json`, import.meta.url))), B = boardFromFlat(d.cells, d.E), T = 300;
const g0 = { r: 0.8, t: 0.2 }, g1 = { r: 0, t: 0 }, c0 = clumpAt(B, 0, 12), c1 = farClump(B, c0, 12);
const snap = (s) => { let h = 2166136261; for (let i = 0; i < s.N; i++) { h = Math.imul(h ^ (s.G[i] + 1), 16777619); h = Math.imul(h ^ s.Inf[i], 16777619); } return h >>> 0; };
function both(land) { const a = makeSim(B.adj, BASE, null, { seed: 7, inf0: 0, lineages: [g0, g1], seeds: [{ lineage: 0, cells: c0 }, { lineage: 1, cells: c1 }] });
  const b = makeSim(B.adj, BASE, null, { seed: 7, inf0: 0, lineages: [g0], seeds: [{ lineage: 0, cells: c0 }] }); land(b);
  for (let k = 0; k < T; k++) { a.step(); b.step(); } const n = a.count().freq.map((v) => v * a.count().density * a.N);
  return { same: snap(a) === snap(b), held: n.map((v) => Math.round(v)) }; }
const A = both((b) => b.addLineage(g1, c1));
const P1 = both((b) => b.addLineage(g0, c1)), P2 = both((b) => b.addLineage(g1, c1.map((i) => B.adj[i][0])));
console.log(`A  seeded == landed at tick 0: ${A.same ? 'PASS' : 'FAIL'}  (cells held after ${T} ticks: ${A.held.join(' / ')}, so both lineages are in play)`);
console.log(`   plant wrong genome: ${P1.same ? 'does NOT fire (broken)' : 'fires (ok)'} · plant wrong cells: ${P2.same ? 'does NOT fire (broken)' : 'fires (ok)'}`);
const m = makeSim(B.adj, BASE, null, { seed: 9, inf0: 0, lineages: [g0], seeds: [{ lineage: 0, cells: c0 }] }); for (let k = 0; k < 200; k++) m.step();
const cl = clumpAt(B, Math.floor(B.n / 2), 12), idn = m.addLineage(g1, cl), okB = idn === 1 && m.L === 2 && cl.every((i) => m.G[i] === 1 && m.Inf[i] === 0) && m.count().freq.length === 2;
console.log(`B  mid-game landing at tick 200: ${okB ? 'PASS' : 'FAIL'}  (id ${idn}, ${cl.length} cells clean and held)`);
let okO = true;
if (process.argv[2]) { const old = await import(new URL(process.argv[2], `file://${process.cwd()}/`));
  const runs = [(L) => runAgents(B.adj, BASE, [1 / 3, 1 / 3, 1 / 3], { ticks: 400, seed: 3, every: 50, ...L }), (L) => runAgents({ mixed: 4000 }, BASE, [0.5, 0.25, 0.25], { ticks: 400, seed: 5, every: 50, ...L })];
  const nowA = runs.map((f) => JSON.stringify(f({}))), oldA = [JSON.stringify(old.runAgents(B.adj, BASE, [1 / 3, 1 / 3, 1 / 3], { ticks: 400, seed: 3, every: 50 })), JSON.stringify(old.runAgents({ mixed: 4000 }, BASE, [0.5, 0.25, 0.25], { ticks: 400, seed: 5, every: 50 }))];
  const mk = (mod) => { const s = mod.makeSim(B.adj, BASE, null, { seed: 11, inf0: 0, lineages: [g0, g1], seeds: [{ lineage: 0, cells: c0 }, { lineage: 1, cells: c1 }] }); for (let k = 0; k < T; k++) s.step(); return snap(s); };
  okO = nowA[0] === oldA[0] && nowA[1] === oldA[1] && mk(old) === mk({ makeSim });
  console.log(`O  no landing == old code (graph, mixed, seeded match): ${okO ? 'PASS, byte-exact' : 'FAIL'}`); }
process.exit(A.same && !P1.same && !P2.same && okB && okO ? 0 : 1);
