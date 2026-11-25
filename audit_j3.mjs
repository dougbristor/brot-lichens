// Audit of J3 (11-25): run 2x the starts. missed = the share of the 20-start union that J3's 10-start cover lacks. Fires (J3 too weak) if
// missed > 0.02 while J3 said converged. Second instrument for the non-saturating tail (first J3, stop at 2 quiet starts, missed 3-4%).
// node audit_j3.mjs <c index> [E] [n]
import { coverOf, graphOf, stats, CS } from './edge_graph.mjs';
const i = +process.argv[2], E = +(process.argv[3] || 32), n = +(process.argv[4] || 20), c = CS[i][1];
const e = coverOf(c, E, { n });
console.log(`c#${i} E ${E} J3 ${e.conv ? 'conv' : 'NOT conv'} adds ${e.adds.join(',')} N${n} ${e.cells.length} missed ${e.missed} ${e.conv && e.missed > 0.02 ? 'J3 TOO WEAK' : 'ok'}`);
// What the game reads: graph stats of the 10-start cover vs the 20-start one. Drift > 10% in mean degree or articulation share, or a
// change in component count beyond 20%, = the cover is not good enough for the game even where the cell share looks small.
const a = stats(graphOf(e.cells10)), b = stats(graphOf(e.cells)), rel = (x, y) => Math.abs(x - y) / Math.max(Math.abs(y), 1e-9);
const drift = { deg: +rel(a.mean_degree, b.mean_degree).toFixed(3), comps: `${a.components}->${b.components}`, largest: `${a.largest_frac}->${b.largest_frac}`, artic: `${a.articulation_frac}->${b.articulation_frac}` };
const bad = rel(a.mean_degree, b.mean_degree) > 0.1 || rel(a.components, b.components) > 0.2 || Math.abs(a.articulation_frac - b.articulation_frac) > 0.1 * Math.max(b.articulation_frac, 0.01);
console.log(`   graph 10 vs ${n}:`, JSON.stringify(drift), bad ? 'GRAPH DRIFTS' : 'graph stable');
