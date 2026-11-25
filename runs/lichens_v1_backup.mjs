// Edge lichens, host-mould game v0 (insights 11-25, Doug: "resisting vs tolerating strategy on boundary lichens|moulds"; a new game, not Brot Hill).
// Each cell of a board holds nothing or one lichen of genotype S (plain), R (resists: lower infection chance) or T (tolerates: lower harm when
// infected). Both defences cost growth. A mould infects lichen from infected neighbours. One tick, every occupied cell, in random order:
//   birth into one random neighbour if it is empty (prob b_g, offspring clean) · death (d, or d + alpha_g if infected) ·
//   a clean lichen meets one random neighbour, and if it is infected, catches the mould with prob beta_g · an infected lichen recovers (gamma).
// Board = a graph (adjacency lists) or 'mixed' (every neighbour pick is uniform over all cells: the well-mixed limit).
// The mean-field ODE of the same rules is in meanField(); gate W (see runGate) compares both against Roy & Kirchner 2000.
export const BASE = { b: 0.30, d: 0.05, alpha: 0.20, beta: 0.60, gamma: 0.02, costR: 0.06, effR: 0.5, costT: 0.06, effT: 0.6 };
export function traits(p) {
  return { b: [p.b, p.b * (1 - p.costR), p.b * (1 - p.costT)], beta: [p.beta, p.beta * (1 - p.effR), p.beta], alpha: [p.alpha, p.alpha, p.alpha * (1 - p.effT)] };
}
// ODE: X_g' = b_g (X_g + Y_g)(1 - N) - d X_g - beta_g X_g I + gamma Y_g ;  Y_g' = beta_g X_g I - (d + alpha_g + gamma) Y_g ; I = sum Y, N = sum (X + Y)
export function meanField(p, x0, steps = 400000, dt = 0.05) {
  const t = traits(p); let X = x0.map((v) => v * 0.45), Y = x0.map((v) => v * 0.05);
  for (let s = 0; s < steps; s++) {
    const I = Y.reduce((a, v) => a + v, 0), N = X.reduce((a, v) => a + v, 0) + I, dX = [], dY = [];
    for (let g = 0; g < 3; g++) { dX[g] = t.b[g] * (X[g] + Y[g]) * (1 - N) - p.d * X[g] - t.beta[g] * X[g] * I + p.gamma * Y[g];
      dY[g] = t.beta[g] * X[g] * I - (p.d + t.alpha[g] + p.gamma) * Y[g]; }
    for (let g = 0; g < 3; g++) { X[g] = Math.max(0, X[g] + dt * dX[g]); Y[g] = Math.max(0, Y[g] + dt * dY[g]); }
  }
  const tot = X.map((v, g) => v + Y[g]), n = tot.reduce((a, v) => a + v, 0);
  return { freq: tot.map((v) => v / n), density: n, prevalence: Y.reduce((a, v) => a + v, 0) / n };
}
export const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// Agent run. board: adjacency array, or {mixed: N}. x0: initial genotype fractions [S, R, T]. Returns genotype frequencies over time.
export function runAgents(board, p, x0, { ticks = 4000, seed = 1, fill = 0.5, inf0 = 0.1, every = 100 } = {}) {
  const mixed = !Array.isArray(board), N = mixed ? board.mixed : board.length, r = rng(seed), t = traits(p);
  const G = new Int8Array(N).fill(-1), Inf = new Uint8Array(N), order = new Int32Array(N).map((_, i) => i);
  for (let i = 0; i < N; i++) if (r() < fill) { const u = r(); G[i] = u < x0[0] ? 0 : u < x0[0] + x0[1] ? 1 : 2; Inf[i] = r() < inf0 ? 1 : 0; }
  const nb = (i) => { if (mixed) return Math.floor(r() * N); const a = board[i]; return a.length ? a[Math.floor(r() * a.length)] : -1; };
  const trace = [];
  for (let k = 0; k < ticks; k++) {
    for (let i = N - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const tmp = order[i]; order[i] = order[j]; order[j] = tmp; }
    for (const i of order) { const g = G[i]; if (g < 0) continue;
      const j = nb(i); if (j >= 0 && G[j] < 0 && r() < t.b[g]) { G[j] = g; Inf[j] = 0; }
      if (r() < p.d + (Inf[i] ? t.alpha[g] : 0)) { G[i] = -1; Inf[i] = 0; continue; }
      if (!Inf[i]) { const m = nb(i); if (m >= 0 && G[m] >= 0 && Inf[m] && r() < t.beta[g]) Inf[i] = 1; }
      else if (r() < p.gamma) Inf[i] = 0; }
    if (k % every === every - 1 || k === ticks - 1) { const c = [0, 0, 0]; let y = 0, n = 0; for (let i = 0; i < N; i++) if (G[i] >= 0) { c[G[i]]++; n++; y += Inf[i]; }
      trace.push({ k: k + 1, freq: c.map((v) => (n ? v / n : 0)), density: n / N, prevalence: n ? y / n : 0 }); if (!n) break; } // 11-25: was (!n || !y): stopping when the mould died froze the frequencies (plants could not fire)
  }
  return trace;
}
