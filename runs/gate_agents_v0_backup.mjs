// Gate W (agents, well-mixed): the same rules with individuals must match Roy & Kirchner like the ODE does. Fails if: R does not settle at the same
// interior frequency from both sides (|diff| < 0.08 and 0.05 < f < 0.95), T does not fix from 5% (> 0.9), or a no-mould plant keeps a defence (> 0.1).
import { writeFileSync } from 'node:fs';
import { runAgents, meanField, BASE } from './lichens.mjs';
const N = 4000, T = 8000, last = (tr) => tr.at(-1), mean = (tr) => { const t = tr.slice(-20); return [0, 1, 2].map((g) => t.reduce((a, x) => a + x.freq[g], 0) / t.length); };
const runs = { R_lo: [[0.95, 0.05, 0], BASE], R_hi: [[0.05, 0.95, 0], BASE], T_lo: [[0.95, 0, 0.05], BASE], plant_R: [[0.5, 0.5, 0], { ...BASE, beta: 0 }], plant_T: [[0.5, 0, 0.5], { ...BASE, beta: 0 }] };
const out = {};
for (const [k, [x0, p]] of Object.entries(runs)) { const tr = runAgents({ mixed: N }, p, x0, { ticks: T, seed: 7 }); out[k] = { end: last(tr), mean_last2000: mean(tr) };
  console.log(k.padEnd(8), 'S/R/T (mean of last 2000 ticks)', out[k].mean_last2000.map((v) => v.toFixed(3)).join(' '), 'prev', last(tr).prevalence.toFixed(3), 'dens', last(tr).density.toFixed(3), 'ticks', last(tr).k); }
const ode = meanField(BASE, [0.99, 0.01, 0]);
const rl = out.R_lo.mean_last2000[1], rh = out.R_hi.mean_last2000[1];
const ok = { R_poly: Math.abs(rl - rh) < 0.08 && rl > 0.05 && rl < 0.95, T_fix: out.T_lo.mean_last2000[2] > 0.9, plants: out.plant_R.mean_last2000[1] < 0.1 && out.plant_T.mean_last2000[2] < 0.1 };
console.log('ODE R freq', ode.freq[1].toFixed(3), '| agents R from 5%:', rl.toFixed(3), 'from 95%:', rh.toFixed(3));
console.log(Object.entries(ok).map(([k, v]) => `${v ? 'ok  ' : 'FAIL'} ${k}`).join('  '), Object.values(ok).every(Boolean) ? 'GATE W PASS' : 'GATE W FAIL');
writeFileSync('runs/gate_agents.json', JSON.stringify({ N, T, out, ode_R: ode.freq[1], ok }, null, 1));
