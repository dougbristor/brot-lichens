// Edge graph of a Bristorian Julia set (11-25, Doug: lichens|moulds on the boundary). Deduplicated inverse iteration (one point per eps-cell
// per level, the classic modified-IIM): level k's cells -> preimages -> level k+1's cells. Gate J1: the last two levels' cell sets must agree
// (Jaccard >= 0.9) or the c is flagged NOT CONVERGED and its stats are not read. Graph: cells touching in the 26-neighbourhood.
// node edge_graph.mjs  -> runs/edge_graphs.json (cells + stats per c and eps)
import { writeFileSync } from 'node:fs';
import { sqrtAll, loadTable } from './lib/bristor_sqrt_all/v1.js'; // vendored from caro's Brot Hill arena, pinned: lib/PINNED.sha256
// From the Brot Hill rules (brot-hill/1), fixed here so the repo stands alone: the ball margin, and the c of two rounds by seed.
export const BALL_MARGIN = 1e-9;
const ROUND_C = { 'sval/24': [0.00390625, -0.265625, -0.60546875], 'sval/25': [0.18359375, -0.4609375, 0.3828125] };
import { rng } from './lichens.mjs';
import { graphOf, stats } from './board.mjs';
export { graphOf, stats };
await loadTable();
export const CS = [['zero', [0, 0, 0]], ['real -0.75', [-0.75, 0, 0]], ['real +0.30', [0.3, 0, 0]], ['j 0.65', [0, 0.65, 0]], ['i 0.65', [0, 0, 0.65]],
  ['rabbit-ish (r,j)', [-0.123, 0.745, 0]], ['round sval/24', ROUND_C['sval/24']], ['round sval/25', ROUND_C['sval/25']]];
const LEVELS = 90, CAP = 150000;
// J2 (11-25, second light: a level holds only part of the cover; one point per cell cannot reach every child cell, so the held part drifts).
// From the plateau (N grows < 1% per level, twice running) keep iterating and take the cover = the union of every level since the plateau,
// until the union grows < 0.5% per level twice running. Gate: covers from two different starting points must agree, Jaccard >= 0.9.
export function edgeCells(c, E, A = [0.53, 0.31, 0.17]) {
  const key = (w) => w.map((v) => Math.floor(v * E)).join(',');
  let front = new Map([[key(A), A]]), flat = 0, still = 0, k = 0, note = ''; const U = new Set();
  for (k = 1; k <= LEVELS; k++) {
    const next = new Map();
    for (const w of front.values()) { const r = sqrtAll(w[0] - c[0], w[1] - c[1], w[2] - c[2]);
      for (const v of r.roots) if (Math.hypot(...v) <= 2 - BALL_MARGIN) { const kk = key(v); if (!next.has(kk)) next.set(kk, v); } }
    if (next.size === 0) { note = 'empty'; break; } if (next.size > CAP) { note = 'cap'; break; }
    if (flat < 2) { flat = next.size < front.size * 1.01 ? flat + 1 : 0; }
    else { const before = U.size; for (const x of next.keys()) U.add(x); still = U.size - before < 0.005 * U.size ? still + 1 : 0; if (still >= 2) break; }
    front = next;
  }
  return { cells: [...U], levels: k, note: note || (still >= 2 ? '' : 'not still') };
}
// J3 (11-25, third light: after J2 two starts still agree only 0.71-0.93, so one start's cover is itself partial). Cover = the union over a fixed
// STARTS starts (A, B, then seeded random points in |w| <= 1.2), always all of them. Converged if each of the last 3 starts added < 2% of the union.
// (First J3 stopped at 2 quiet starts in a row; audit_j3 showed that missed 3.1% on zero and 4.0% on real +0.30: the tail adds 0.2-1.9% per start,
// it does not saturate. Before that, the literal 'one quiet start' would have stopped real -0.75 at start 4 and missed a 19% piece at start 5.)
// Plant P3 (patch): keep only the cells within 0.5 of each start's nearest cover cell, a cover that depends on where it began; J3 must FAIL it.
// n > STARTS (audit): every start is run, conv is read at STARTS, and missed = the share of the n-start union the STARTS-start cover lacks.
const STARTS = 10;
export function coverOf(c, E, { patch = 0, n = STARTS } = {}) {
  const r = rng(271), starts = [[0.53, 0.31, 0.17], [-0.41, 0.62, -0.23]];
  while (starts.length < n) { const v = [0, 0, 0].map(() => (r() * 2 - 1) * 1.2); if (Math.hypot(...v) <= 1.2) starts.push(v); }
  const U = new Set(), adds = [], notes = []; let levels = 0, jAB = 0, first = null, nAt = 0;
  for (let s = 0; s < n; s++) {
    const e = edgeCells(c, E, starts[s]); levels = Math.max(levels, e.levels); if (e.note && s < STARTS) notes.push(`s${s}:${e.note}`);
    let cells = e.cells; if (patch && cells.length) { // centre = the cover cell nearest the start, so the patch is never empty
      const P = cells.map((k) => k.split(',').map(Number)), a = starts[s].map((v) => v * E), d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
      let o = P[0]; for (const p of P) if (d2(p, a) < d2(o, a)) o = p; cells = cells.filter((_, i) => d2(P[i], o) <= (patch * E) ** 2); }
    if (s === 0) first = new Set(cells); if (s === 1) { let i = 0; for (const x of cells) if (first.has(x)) i++; jAB = i / (first.size + cells.length - i || 1); }
    const before = U.size; for (const x of cells) U.add(x); const add = U.size ? (U.size - before) / U.size : 1; adds.push(+add.toFixed(3));
    if (s === STARTS - 1) { nAt = U.size; if (n > STARTS) var cells10 = [...U]; }
  }
  const tail = adds.slice(STARTS - 3, STARTS), conv = tail.every((a) => a < 0.02) && !notes.length;
  return { cells: [...U], jac: [+jAB.toFixed(3)], adds, starts: Math.min(n, STARTS), levels, note: notes.join('/'), conv, missed: n > STARTS ? +((U.size - nAt) / U.size).toFixed(3) : null, cells10 };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const out = [], part = process.argv[2] ? process.argv[2].split(',').map(Number) : CS.map((_, i) => i);
  for (const [name, c] of CS.filter((_, i) => part.includes(i))) { const row = { name, c: c.map((v) => +v.toFixed(4)) };
    for (const E of [16, 32]) { const e = coverOf(c, E), conv = e.conv;
      row['e' + E] = { conv, jac_AB: e.jac, adds: e.adds, starts: e.starts, levels: e.levels, note: e.note, ...stats(graphOf(e.cells)) }; if (E === 32) row.cells32 = e.cells; }
    const n = [16, 32].map((E) => row['e' + E].N); row.dim_16_32 = +Math.log2(n[1] / n[0]).toFixed(2);
    out.push(row); const s = row.e32;
    console.log(name.padEnd(18), `conv16/32 ${[16, 32].map((E) => row['e' + E].conv ? 'Y' : 'N').join('')} J(A,B) ${s.jac_AB} starts ${s.starts} adds ${s.adds.join(',')} lv ${s.levels}${s.note ? ' ' + s.note : ''}  N ${n.join('/')}  dim ${row.dim_16_32}  @1/32: comps ${s.components} largest ${s.largest_frac} deg ${s.mean_degree} artic ${s.articulation_frac}`); }
  if (process.argv[2] && !part.includes(0)) { writeFileSync(`runs/edge_graphs_${process.argv[2]}.json`, JSON.stringify({ gate: 'J3', levels: LEVELS, rows: out })); process.exit(0); }
  // plant G1: the same number of cells scattered uniformly in the ball must NOT look like an edge. Fires (ok) if largest component < 0.5 of the
  // cells or mean degree < half the edge's. Seeded with mulberry32 (the old LCG overflowed 2^53: s*1103515245 lost its low bits).
  const r0 = out[0], M = r0.e32.N, cells = new Set(), rnd = rng(12345);
  while (cells.size < M) { const v = [0, 0, 0].map(() => (rnd() * 2 - 1) * 1.6); if (Math.hypot(...v) <= 1.6) cells.add(v.map((x) => Math.floor(x * 32)).join(',')); }
  const g1 = stats(graphOf([...cells])), g1fires = g1.largest_frac < 0.5 || g1.mean_degree < 0.5 * r0.e32.mean_degree;
  console.log('plant G1 (uniform scatter, same N as zero):', JSON.stringify(g1), g1fires ? 'FIRES (ok)' : 'DOES NOT FIRE (broken control)');
  // plant P3: start-dependent patch covers on zero at 1/32; J3 must not call them converged.
  const p3 = coverOf(r0.c, 32, { patch: 0.5 }), p3fires = !p3.conv;
  console.log('plant P3 (patch r 0.5 per start, zero @1/32): starts', p3.starts, 'adds', p3.adds.join(','), 'N', p3.cells.length, p3fires ? 'FIRES (ok)' : 'DOES NOT FIRE (broken control)');
  writeFileSync(`runs/edge_graphs_${process.argv[2] || 'all'}.json`, JSON.stringify({ gate: 'J3', levels: LEVELS, rows: out, plant_G1: { ...g1, fires: g1fires },
    plant_P3: { starts: p3.starts, adds: p3.adds, N: p3.cells.length, fires: p3fires } }));
}
