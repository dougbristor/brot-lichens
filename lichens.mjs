// Edge lichens, host-mould game v0 (insights 11-25, Doug: "resisting vs tolerating strategy on boundary lichens|moulds"; a new game, not Brot Hill).
// Each cell of a board holds nothing or one lichen of genotype S (plain), R (resists: lower infection chance) or T (tolerates: lower harm when
// infected). Both defences cost growth. A mould infects lichen from infected neighbours. One tick, every occupied cell, in random order:
//   birth into one random neighbour if it is empty (prob b_g, offspring clean) · death (d, or d + alpha_g if infected) ·
//   a clean lichen meets one random neighbour, and if it is infected, catches the mould with prob beta_g · an infected lichen recovers (gamma).
// Spore rain (Doug 11-25): a clean lichen that did not meet the mould meets an outside spore with prob eps, then catches it with prob beta_g
//   (resistance still works). It removes the absorbing no-mould state that failed gate W from above; eps = 0 is the old game, stream for stream.
// Board = a graph (adjacency lists) or 'mixed' (every neighbour pick is uniform over all cells: the well-mixed limit).
// The mean-field ODE of the same rules is in meanField(); gate W (see runGate) compares both against Roy & Kirchner 2000.
export const BASE = { b: 0.30, d: 0.05, alpha: 0.20, beta: 0.60, gamma: 0.02, costR: 0.06, effR: 0.5, costT: 0.06, effT: 0.6, eps: 0.001 };
// Lineages (11-25, step 1 of the probe game): a genome is (r, t), resist and tolerate levels, r + t <= 1 (one defence budget).
//   infection x (1 - effR r) · harm x (1 - effT t) · growth x (1 - costR r)(1 - costT t).  S = (0,0), R = (1,0), T = (0,1): the old three, exactly.
export const SRT = [{ r: 0, t: 0 }, { r: 1, t: 0 }, { r: 0, t: 1 }];
export function genomeTraits(p, gs) {
  return { b: gs.map((g) => (g.r === 0 && g.t === 0 ? p.b : g.t === 0 ? p.b * (1 - p.costR * g.r) : g.r === 0 ? p.b * (1 - p.costT * g.t) : p.b * (1 - p.costR * g.r) * (1 - p.costT * g.t))),
    beta: gs.map((g) => (g.r === 0 ? p.beta : p.beta * (1 - p.effR * g.r))), alpha: gs.map((g) => (g.t === 0 ? p.alpha : p.alpha * (1 - p.effT * g.t))) };
}
export function traits(p) { return genomeTraits(p, SRT); }
// ODE: X_g' = b_g (X_g + Y_g)(1 - N) - d X_g - beta_g X_g F + gamma Y_g ;  Y_g' = beta_g X_g F - (d + alpha_g + gamma) Y_g ;
//   I = sum Y, N = sum (X + Y), F = I + eps (1 - I) (meet the mould, or else a spore)
export function meanField(p, x0, steps = 400000, dt = 0.05) {
  const t = traits(p); let X = x0.map((v) => v * 0.45), Y = x0.map((v) => v * 0.05);
  for (let s = 0; s < steps; s++) {
    const I = Y.reduce((a, v) => a + v, 0), N = X.reduce((a, v) => a + v, 0) + I, F = I + (p.eps || 0) * (1 - I), dX = [], dY = [];
    for (let g = 0; g < 3; g++) { dX[g] = t.b[g] * (X[g] + Y[g]) * (1 - N) - p.d * X[g] - t.beta[g] * X[g] * F + p.gamma * Y[g];
      dY[g] = t.beta[g] * X[g] * F - (p.d + t.alpha[g] + p.gamma) * Y[g]; }
    for (let g = 0; g < 3; g++) { X[g] = Math.max(0, X[g] + dt * dX[g]); Y[g] = Math.max(0, Y[g] + dt * dY[g]); }
  }
  const tot = X.map((v, g) => v + Y[g]), n = tot.reduce((a, v) => a + v, 0);
  return { freq: tot.map((v) => v / n), density: n, prevalence: Y.reduce((a, v) => a + v, 0) / n };
}
export const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// Agent sim as a stepper (11-25, so the board page runs this same code). board: adjacency array, or {mixed: N}. x0: genotype fractions [S, R, T].
// G[i] = -1 empty, 0 S, 1 R, 2 T; Inf[i] = 1 infected. step() = one tick; count() = { k, freq, density, prevalence }.
// opts.lineages: genomes (default S, R, T). opts.seeds: [{ lineage, cells: [cell index...] }] places colonies instead of the random fill
// (then x0 is ignored and nothing starts infected unless inf0 > 0: the spore rain brings the mould).
export function makeSim(board, p, x0, { seed = 1, fill = 0.5, inf0 = 0.1, lineages = SRT, seeds = null } = {}) {
  const mixed = !Array.isArray(board), N = mixed ? board.mixed : board.length, r = rng(seed), t = genomeTraits(p, lineages), eps = p.eps || 0, L = lineages.length;
  const G = new Int8Array(N).fill(-1), Inf = new Uint8Array(N), order = new Int32Array(N).map((_, i) => i);
  if (seeds) { for (const s of seeds) for (const i of s.cells) if (G[i] < 0) { G[i] = s.lineage; Inf[i] = inf0 > 0 && r() < inf0 ? 1 : 0; } }
  else for (let i = 0; i < N; i++) if (r() < fill) { const u = r(); let g = 0, acc = x0[0]; while (g < L - 1 && !(u < acc)) acc += x0[++g]; G[i] = g; Inf[i] = r() < inf0 ? 1 : 0; }
  const nb = (i) => { if (mixed) return Math.floor(r() * N); const a = board[i]; return a.length ? a[Math.floor(r() * a.length)] : -1; };
  const sim = { N, L, G, Inf, k: 0,
    step() {
      for (let i = N - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const tmp = order[i]; order[i] = order[j]; order[j] = tmp; }
      for (const i of order) { const g = G[i]; if (g < 0) continue;
        const j = nb(i); if (j >= 0 && G[j] < 0 && r() < t.b[g]) { G[j] = g; Inf[j] = 0; }
        if (r() < p.d + (Inf[i] ? t.alpha[g] : 0)) { G[i] = -1; Inf[i] = 0; continue; }
        if (!Inf[i]) { const m = nb(i), met = m >= 0 && G[m] >= 0 && Inf[m]; if ((met || (eps > 0 && r() < eps)) && r() < t.beta[g]) Inf[i] = 1; }
        else if (r() < p.gamma) Inf[i] = 0; }
      sim.k++;
    },
    count() { const c = new Array(L).fill(0); let y = 0, n = 0; for (let i = 0; i < N; i++) if (G[i] >= 0) { c[G[i]]++; n++; y += Inf[i]; }
      return { k: sim.k, freq: c.map((v) => (n ? v / n : 0)), density: n / N, prevalence: n ? y / n : 0 }; } };
  return sim;
}
// Agent run: genotype frequencies every `every` ticks. Stops only when the lichens are gone (11-25: it used to stop when the mould died too,
// which froze the frequencies and made the no-mould plants unfireable).
export function runAgents(board, p, x0, { ticks = 4000, seed = 1, fill = 0.5, inf0 = 0.1, every = 100 } = {}) {
  const sim = makeSim(board, p, x0, { seed, fill, inf0 }), trace = [];
  for (let k = 0; k < ticks; k++) { sim.step(); if (k % every === every - 1 || k === ticks - 1) { const o = sim.count(); trace.push(o); if (!o.density) break; } }
  return trace;
}
