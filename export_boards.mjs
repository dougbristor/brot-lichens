// Export the J3b edge covers at 1/32 for the board page (11-25). -> boards/{index.json, <id>.json}
// index carries each board's gate state (J3b conv, run stats) and gate W, so the page can say what may be read. The page recomputes the stats
// with the same board.mjs and shows both: a mismatch = the export or the page is wrong.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const W = '.', list = [];
// audit_j3 (10 vs 20 starts): what the J3b flag does not say
const WARN = { 3: 'fragment count not settled: 25 pieces at 10 starts, 19 at 20; read the largest piece only' };
for (let p = 0; p < 8; p++) { const f = `runs/edge_graphs_${p}.json`; if (!existsSync(f)) continue; const d = JSON.parse(readFileSync(f, 'utf8'));
  if (d.gate !== 'J3') { console.log('skip', f, 'gate', d.gate); continue; }
  for (const r of d.rows) { const flat = []; for (const k of r.cells32) for (const v of k.split(',')) flat.push(+v);
    const { conv, N, components, largest_frac, mean_degree, articulation_frac, adds } = r.e32;
    writeFileSync(`${W}/boards/${p}.json`, JSON.stringify({ E: 32, cells: flat }));
    list.push({ id: p, name: r.name, c: r.c, conv, run: { N, components, largest_frac, mean_degree, articulation_frac }, adds, dim_16_32: r.dim_16_32, warn: WARN[p] || null }); } }
const g = JSON.parse(readFileSync('runs/gate_agents.json', 'utf8'));
writeFileSync(`${W}/boards/index.json`, JSON.stringify({ made: new Date().toISOString(), gateW: { eps: g.eps, pass: Object.values(g.ok).every(Boolean), ok: g.ok }, boards: list }, null, 1));
console.log(list.map((b) => `${b.id} ${b.name} conv ${b.conv} N ${b.run.N}`).join('\n'), '\ngate W', g.eps, Object.values(g.ok).every(Boolean));
