// Board = the edge graph, pure (no Node imports) so the web page and edge_graph.mjs share it (11-25). cells = 'x,y,z' integer keys at 1/E.
// graphOf: adjacency in the 26-neighbourhood. stats: components, largest share, mean degree, articulation share of the largest component.
export function graphOf(cells) {
  const idx = new Map(cells.map((k, i) => [k, i])), P = cells.map((k) => k.split(',').map(Number)), adj = P.map(() => []);
  P.forEach((p, i) => { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) { if (!dx && !dy && !dz) continue;
    const j = idx.get(`${p[0] + dx},${p[1] + dy},${p[2] + dz}`); if (j !== undefined) adj[i].push(j); } });
  return adj;
}
export function stats(adj, perCell = false) { // perCell: also return comp (component id per cell), art (articulation flags), big (largest id)
  const N = adj.length, comp = new Int32Array(N).fill(-1); let nc = 0; const sizes = [];
  for (let s = 0; s < N; s++) if (comp[s] < 0) { let q = [s], n = 0; comp[s] = nc; while (q.length) { const u = q.pop(); n++; for (const v of adj[u]) if (comp[v] < 0) { comp[v] = nc; q.push(v); } } sizes.push(n); nc++; }
  const big = sizes.indexOf(Math.max(...sizes));
  // articulation points in the largest component (iterative Tarjan)
  const disc = new Int32Array(N).fill(-1), low = new Int32Array(N), art = new Uint8Array(N); let time = 0;
  const root = comp.indexOf(big), stack = [[root, -1, 0]]; disc[root] = low[root] = time++; let rootKids = 0;
  while (stack.length) { const top = stack[stack.length - 1], [u, par] = top;
    if (top[2] < adj[u].length) { const v = adj[u][top[2]++]; if (v === par) continue;
      if (disc[v] < 0) { disc[v] = low[v] = time++; if (u === root) rootKids++; stack.push([v, u, 0]); } else low[u] = Math.min(low[u], disc[v]); }
    else { stack.pop(); if (stack.length) { const p = stack[stack.length - 1][0]; low[p] = Math.min(low[p], low[u]); if (p !== root && low[u] >= disc[p]) art[p] = 1; } } }
  if (rootKids > 1) art[root] = 1;
  const nb = sizes[big]; let arts = 0, deg = 0; for (let i = 0; i < N; i++) { deg += adj[i].length; if (comp[i] === big && art[i]) arts++; }
  const res = { N, components: nc, largest_frac: +(nb / N).toFixed(3), mean_degree: +(deg / N).toFixed(2), articulation_frac: +(arts / nb).toFixed(3) };
  return perCell ? { ...res, comp, art, big } : res;
}

// ---- shared by the board page and the GPU trainer (11-25, step 3) ----
// boardFromFlat: integer cell coords at 1/E (flat x,y,z...) -> { n, E, coords, pos (cell centres), keys, adj }.
export function boardFromFlat(flat, E) {
  const n = flat.length / 3, coords = Int32Array.from(flat), pos = new Float32Array(flat.length), keys = new Array(n);
  for (let i = 0; i < n; i++) { keys[i] = `${flat[3 * i]},${flat[3 * i + 1]},${flat[3 * i + 2]}`; for (let d = 0; d < 3; d++) pos[3 * i + d] = (flat[3 * i + d] + 0.5) / E; }
  return { n, E, coords, pos, keys, adj: graphOf(keys) };
}
// clumpAt: breadth-first clump of k cells from `start`, skipping `avoid`.
export function clumpAt(B, start, k, avoid = new Set()) {
  const out = [], seen = new Set([start]), q = [start];
  while (q.length && out.length < k) { const u = q.shift(); if (!avoid.has(u)) out.push(u); for (const v of B.adj[u]) if (!seen.has(v)) { seen.add(v); q.push(v); } }
  return out;
}
// farClump: the opponent's seed. A k-cell clump around the cell farthest from the centre of `seed` (needs B.pos, B.adj, B.n).
export function farClump(B, seed, k) {
  if (!seed.length) return []; const c = [0, 0, 0], L = seed.length; for (const i of seed) for (let d = 0; d < 3; d++) c[d] += B.pos[3 * i + d];
  let far = 0, fd = -1; for (let i = 0; i < B.n; i++) { const d = (B.pos[3 * i] * L - c[0]) ** 2 + (B.pos[3 * i + 1] * L - c[1]) ** 2 + (B.pos[3 * i + 2] * L - c[2]) ** 2; if (d > fd) { fd = d; far = i; } }
  return clumpAt(B, far, k, new Set(seed));
}
// parityClasses: 8 lists by (x&1, y&1, z&1). In the 26-neighbourhood two cells of one class never touch (a neighbour differs by 1 in some
// coordinate), so a class can update in parallel. `touching` counts violations: it must print 0, and a plant that merges classes must not.
export function parityClasses(B) {
  const cls = Array.from({ length: 8 }, () => []), of = new Uint8Array(B.n);
  for (let i = 0; i < B.n; i++) { const c = (B.coords[3 * i] & 1) | ((B.coords[3 * i + 1] & 1) << 1) | ((B.coords[3 * i + 2] & 1) << 2); of[i] = c; cls[c].push(i); }
  let touching = 0; for (let i = 0; i < B.n; i++) for (const j of B.adj[i]) if (of[i] === of[j]) touching++;
  return { cls, of, touching };
}
