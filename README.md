# Edge lichens

Lichens and moulds on the boundary of a Bristorian Julia set. **The board is the edge itself:** the 1/32 cells that the set's boundary passes through,
linked when they touch (26 neighbours). Each cell holds nothing or one lichen: plain **S**, **R** that resists (catches the mould less, grows slower)
or **T** that tolerates (is harmed less, grows slower). A mould spreads between neighbouring lichens and rains in from outside as spores.
The question the game asks: **does the shape of the edge decide which strategy wins?** Well-mixed, T takes over. On the edge, early looks say otherwise.

*Bristorian, not quaternion:* the algebra shares the symbols i, j, k but not the rules. Its products keep the order of the ranked imaginaries
and break the magnitude (|ab| ≠ |a||b|), and its squaring map has 2 or 6 square roots, never 4.

A game by Doug and a few dozen AI agents (Brot, 2026-11-25). Started as "Core War / Life on the evolving edge".

## Play
```
npm run play          # or any static server in this folder
open http://localhost:8090/
```
No build, no dependencies. Pick a board, drag to turn, and choose a view: **edge** (the board), **plant G1** (the control: the same number of cells
scattered at random) or **lichens** (play the game). The page recomputes each board's stats and shows them next to the run's; they must agree.

## Rebuild and check
```
npm run gates        # gate O (ODE vs Roy & Kirchner 2000) and gate W (agents vs the ODE)
npm run boards       # rebuild the 8 boards from scratch (~5 min, CPU), then export to boards/
npm run audit        # J3 audit: 20 starts vs 10
npm run lib-check    # the vendored square-root lib against its pins
```
`lib/` is vendored unchanged from caro's Brot Hill arena (codetree blocks `bristor_sqrt_all/v1`, `bristor_square_jacobian/v1`, `cramer3_solve/v1`),
with the pins in `lib/PINNED.sha256`. Rebuilt with it, the zero board matches the working run cell for cell.

## Files

| file | what |
|---|---|
| `edge_graph.mjs` | edge cover per c (deduplicated inverse iteration, union over starts), graph, stats; gates J3, plants G1 and P3. `node edge_graph.mjs [c indices]` → `runs/edge_graphs_<part>.json` |
| `audit_j3.mjs` | second instrument for J3: runs 20 starts, reports the cells J3's 10 miss and whether the **graph stats** move. `node audit_j3.mjs <c index> [E] [n]` |
| `lichens.mjs` | the host-mould rules: `meanField` (ODE) and `runAgents` (individuals on a graph or well-mixed); `rng` = mulberry32 |
| `gate_ode.mjs` | gate O: the ODE against Roy & Kirchner 2000 |
| `gate_agents.mjs` | gate W: the agents, well-mixed, against the same |
| `probe_W.mjs` | why gate W failed: rules match vs finite-size fade-out |
| `board.mjs` | graphOf + stats, pure (shared by edge_graph.mjs and the page) |
| `export_boards.mjs` | J3b covers → `boards/` for the page |
| `index.html` | the board page (play) |
| `boards/` | the 8 J3b boards at 1/32 + `index.json` (gate state per board, gate W) |
| `lib/` | vendored Bristorian square roots (see Rebuild) |
| `diag.mjs` | per-level trace of one c's inverse iteration (first-light tool for J1/J2) |
| `runs/` | logs (evidence for every number below); `*_backup.mjs` = the code before each 11-25 change, from before the repo |

## Gates (state 11-25)

**Board (edge cover)**
- J1 (cell sets stable level to level) and J1′/J2 (union since the plateau; two starts agree, Jaccard ≥ 0.9): **failed**, two-start J 0.71–0.93.
  One start's cover is partial.
- J3, first form (stop when 2 starts in a row add < 2%): passed part A, then **the audit fired**. It missed 3.1% (zero) and 4.0% (real +0.30)
  of the 10-start union. The literal "one quiet start" rule would have stopped real −0.75 at start 4 and missed a 19% piece that came in at start 5.
- J3b (now): always 10 starts; converged if each of the last 3 added < 2%. Part A (c 0–3): **all converge at 1/16 and 1/32.**
- Audit, 20 vs 10 starts: **the cell union never saturates.** 10 starts miss 1.1–5.8%. Each start keeps adding 0.1–1%, with odd jumps.
  This reads as the known inverse-iteration defect: low-measure parts of the set are reached rarely. No finite union is "the" cover.
- What the game reads is the graph, so that is the real gate. 10 → 20 starts: zero, real −0.75 and real +0.30 are **stable** (mean degree within 3.4%,
  one component, articulation share unchanged). **j 0.65:** the giant component is stable (0.999 → 1), but the small fragments go **25 → 19**.
  The fragment count is not a settled quantity there; do not read it.
- Plant G1 (uniform scatter, same N; mulberry32 now, the old LCG overflowed 2^53): **fires.** largest 0.001, degree 0.68 vs the edge's 1, 11.3.
- Plant P3 (each start keeps only a 0.5 patch around its nearest cover cell): **fires, narrowly.** The last adds are 0.026 and 0.026 against the 0.02 line.

Part A at 1/32 (J3b): zero N 15106, deg 11.3, dim 2.00 · real −0.75 N 15941, deg 14.1, dim 2.40 · real +0.30 N 39586, deg 15.9, dim 2.26 ·
j 0.65 N 52100, deg 17.5, dim 2.80, 25 fragments. Every one has articulation share ≤ 0.001: at 1/32 these edges have almost no chokepoint cells.
Part B (c 4–7, J3b, `runs/eg_j3b_B_*.log`): rabbit-ish (r,j) **converges** (N 35002, deg 15.8, 5 comps) · sval/25 **converges** (N 18698,
deg 12.4, 13 comps) · sval/24 **NOT** (start 10 adds 4.5%, a late piece again) · i 0.65 **NOT at 1/32** (all 10 starts hit the 90-level cap
before their own union went still; 1/16 converges). Do not read the last two. Part B not yet audited at 20 starts.

**Game rules**
- Gate O (ODE vs Roy & Kirchner): **passes.** R stays polymorphic at 0.864 from both sides; T fixes from 1% and from 99%; no-mould plants lose both defences.
- Gate W (agents, well-mixed), as it stands:
  - Bug fixed: `runAgents` stopped as soon as no lichen was infected, which froze the frequencies. The no-mould plants could not fire.
  - Probe: the rules match. Alone, each genotype's agent density agrees with the ODE to 0.002. Agent prevalence runs 5–7% (relative)
    above the ODE (S alone 0.315 vs 0.294), probably from the sequential update within a tick.
  - At N 4000 the mould fades out near the R equilibrium (prevalence ~0.02); at N 20000 it persists. The gate now runs at N 20000.
  - N 20000: R from 5% → 0.849 (ODE 0.864) ok · T fixes ok · plants fire ok · **R from 95%: FAIL.** A population that is 95% R cannot hold
    the mould (R alone has R0 < 1), so the mould dies out and S wins. "No mould" is an absorbing state for the agents and never for the ODE.

## Spore rain (Doug 11-25: "spore rain")
`BASE.eps = 0.001`: a clean lichen that did not meet the mould meets an outside spore with prob eps, then catches it with prob beta_g (resistance
still works). The ODE uses F = I + eps(1 − I). With eps = 0 the refactored code (`makeSim` stepper) reproduces the old gate W run exactly.
- Gate O at eps 0.001: R polymorphic at **0.935** from both sides (was 0.864 at eps 0; S keeps ~7%), T fixes, plants fire. The eps 0 line is kept for Roy & Kirchner.
- **Gate W PASS** (N 20000): R 0.926 from 5%, 0.925 from 95% (ODE 0.935) · T fixes · plants fire. `runs/gate_agents_eps.log`.

## The board page
`index.html` (in the Brot ecosystem: `http://localhost:8088/insights/edge_lichens/`; `node export_boards.mjs` refreshes `boards/`).
- Views: **edge** (colour = neighbour count, white = chokepoint, magenta = outside the largest piece), **plant G1** (the uniform scatter, same N), **lichens** (live game).
- It imports `board.mjs` and `lichens.mjs` through symlinks: same code as the runs. It recomputes the board stats and shows run vs page (they agree on all 8).
  Its G1 plant matches the run's (largest 0.001, deg 0.68).
- **The game on the edge is not gated.** Gate W is well-mixed only. First look (zero, thirds, tick ~1200): R 0.63, T 0.36, S 0.01, mould 0.20.
  Well-mixed, T fixes. If that holds, the board changes the winner, but no control backs it yet.

## Next
1. Gate for the game on a graph: a known spatial result (e.g. pair approximation, or a lattice where tolerance/resistance outcomes are published) plus a plant.
2. The game on the J3b graphs, largest piece only; compare with a same-degree random graph (does the *shape* matter, or only the degree?).
3. The articulation share is ≈ 0 at 1/32: test finer eps, or use another measure of shape (degree spread, cut size).
4. Part B not audited at 20 starts; sval/24 and i 0.65 do not converge.

Ideas log: `../ideas_20261125.md`
