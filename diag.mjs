import { sqrtAll, loadTable } from './lib/bristor_sqrt_all/v1.js';
import { BALL_MARGIN } from './edge_graph.mjs';
await loadTable();
const c = JSON.parse(process.argv[2]), E = 32, key = (w) => w.map((v) => Math.floor(v * E)).join(',');
let front = new Map([[key([0.53, 0.31, 0.17]), [0.53, 0.31, 0.17]]]); const hist = [], union = new Set(); let roots = [0, 0, 0, 0, 0, 0, 0];
for (let k = 1; k <= 18; k++) { const next = new Map();
  for (const w of front.values()) { const r = sqrtAll(w[0] - c[0], w[1] - c[1], w[2] - c[2]); const kids = r.roots.filter((v) => Math.hypot(...v) <= 2 - BALL_MARGIN); roots[kids.length]++;
    for (const v of kids) { const kk = key(v); if (!next.has(kk)) next.set(kk, v); } }
  const J = (a, b) => { let i = 0; for (const x of a.keys()) if (b.has(x)) i++; return (i / (a.size + b.size - i)).toFixed(2); };
  const before = union.size; for (const x of next.keys()) union.add(x);
  console.log(`k${k} N ${next.size} J(k,k-1) ${J(next, front)} J(k,k-2) ${hist.length > 1 ? J(next, hist.at(-1)) : '-'} union ${union.size} (+${union.size - before})`);
  hist.push(front); front = next; if (next.size > 40000) break; }
console.log('kid-count histogram over expansions', roots.join(' '));
