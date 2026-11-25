// Probe for gate W's R_poly failure (11-25): rules mismatch, or finite-size mould fade-out? (1) one genotype alone: ODE vs agents endemic
// prevalence and density; (2) R from 5% at N 4000 vs 20000: when does the mould die?
import { runAgents, meanField, BASE } from './lichens.mjs';
const m = (tr) => { const t = tr.slice(-20); return ['density', 'prevalence'].map((k) => (t.reduce((a, x) => a + x[k], 0) / t.length).toFixed(3)).join('/'); };
for (const [g, x0] of [['S', [1, 0, 0]], ['R', [0, 1, 0]], ['T', [0, 0, 1]]]) { const o = meanField(BASE, x0);
  console.log(`${g} alone  ODE dens/prev ${o.density.toFixed(3)}/${o.prevalence.toFixed(3)}  agents N4000 ${m(runAgents({ mixed: 4000 }, BASE, x0, { ticks: 3000, seed: 3 }))}`); }
for (const N of [4000, 20000]) { const tr = runAgents({ mixed: N }, BASE, [0.95, 0.05, 0], { ticks: 3000, seed: 7, every: 50 }); const die = tr.find((x) => x.prevalence === 0);
  const at = (k) => tr.find((x) => x.k >= k); console.log(`R_lo N ${N}: mould dies at tick ${die ? die.k : 'never (3000)'}; R freq @500 ${at(500).freq[1].toFixed(3)} @1000 ${at(1000)?.freq[1].toFixed(3)} prev @500 ${at(500).prevalence.toFixed(3)}`); }
