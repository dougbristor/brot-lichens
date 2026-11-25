// WebGPU match engine for Edge lichens (insights 11-25, step 3). The same rules as lichens.mjs makeSim, run as B matches at once on one board.
//
// Update order. The CPU visits every cell once per tick in a random order. Here the cells are split into 8 parity classes (board.mjs
// parityClasses: no two cells of a class touch), each tick visits the 8 classes in a random order (shared by the batch), and a class updates
// in parallel. Two kernels per class: PROPOSE (a lichen picks a neighbour; if it is empty and the birth draw passes, it claims it with a random
// priority, atomicMax) and APPLY (the claim's winner places a clean child, then death, infection or recovery, as on the CPU).
// Within a class a cell writes only itself and the cell it won, and it reads neighbours only for "is it infected", which a newborn (clean)
// cannot change. Equal priorities (2^-32 per pair) would both place: ignored.
// Random numbers: a counter hash of (seed, tick, class, match, cell, draw). No RNG state, so any tick of any match can be replayed.
// The CPU makeSim is the oracle: trainer.html's gate compares outcome means over seeds, and two plants must make it fail.
import { genomeTraits, BASE, rng } from '../lichens.mjs';
import { parityClasses } from '../board.mjs';

export const WG = 64, SLOT = 256; // workgroup size; uniform slot stride (minUniformBufferOffsetAlignment)
const WGSL = /* wgsl */`
struct P { tick: u32, cls: u32, clsOff: u32, clsLen: u32, N: u32, seed: u32, d: f32, gamma: f32, eps: f32, plant: u32, p0: u32, p1: u32 };
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> nbr: array<i32>;      // N*26, -1 pad
@group(0) @binding(2) var<storage, read> deg: array<u32>;
@group(0) @binding(3) var<storage, read> cls: array<u32>;      // the 8 class lists, concatenated
@group(0) @binding(4) var<storage, read> tr: array<f32>;       // per match: b0 beta0 alpha0 b1 beta1 alpha1
@group(0) @binding(5) var<storage, read_write> st: array<u32>; // per match per cell: 0 empty, else 1 + 2*lineage + infected
@group(0) @binding(6) var<storage, read_write> claim: array<atomic<u32>>;
@group(0) @binding(7) var<storage, read_write> cnt: array<atomic<u32>>; // per match: held0, held1, infected, occupied (summed over samples)

fn h(x: u32) -> u32 { var v = x; v = v ^ (v >> 16u); v = v * 0x7feb352du; v = v ^ (v >> 15u); v = v * 0x846ca68bu; v = v ^ (v >> 16u); return v; }
fn key(m: u32, i: u32) -> u32 { return h(i ^ h(m ^ h((p.tick * 8u + p.cls) ^ h(p.seed)))); }
fn u(k: u32, d: u32) -> f32 { return f32(h(k + d * 0x9e3779b9u) >> 8u) / 16777216.0; }
fn trt(m: u32, g: u32, w: u32) -> f32 { var gg = g; if (p.plant == 1u) { gg = 0u; } return tr[m * 6u + gg * 3u + w]; } // plant 1: lineage-index bug
fn pick(i: u32, dg: u32, r: f32) -> u32 { return u32(nbr[i * 26u + min(u32(r * f32(dg)), dg - 1u)]); }

@compute @workgroup_size(${WG}) fn propose(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= p.clsLen) { return; }
  let m = gid.y; let i = cls[p.clsOff + gid.x]; let base = m * p.N; let s = st[base + i]; if (s == 0u) { return; }
  let dg = deg[i]; if (dg == 0u) { return; }
  let g = (s - 1u) >> 1u; let k = key(m, i); let j = pick(i, dg, u(k, 0u));
  if (st[base + j] != 0u) { return; }
  if (u(k, 1u) >= trt(m, g, 0u)) { return; }
  atomicMax(&claim[base + j], h(k + 7u) | 1u);
}
@compute @workgroup_size(${WG}) fn apply(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= p.clsLen) { return; }
  let m = gid.y; let i = cls[p.clsOff + gid.x]; let base = m * p.N; let s = st[base + i]; if (s == 0u) { return; }
  let g = (s - 1u) >> 1u; let inf = (s - 1u) & 1u; let k = key(m, i); let dg = deg[i];
  if (dg > 0u) { let j = pick(i, dg, u(k, 0u));
    if (st[base + j] == 0u && u(k, 1u) < trt(m, g, 0u)) { let pr = h(k + 7u) | 1u;
      if (atomicLoad(&claim[base + j]) == pr) { st[base + j] = 1u + 2u * g; atomicStore(&claim[base + j], 0u); } } }
  var death = p.d; if (inf == 1u) { death = death + trt(m, g, 2u); }
  if (u(k, 2u) < death) { st[base + i] = 0u; return; }
  if (inf == 0u) {
    var met = false; if (dg > 0u) { let sm = st[base + pick(i, dg, u(k, 3u))]; met = sm != 0u && ((sm - 1u) & 1u) == 1u; }
    if ((met || u(k, 4u) < p.eps) && u(k, 5u) < trt(m, g, 1u)) { st[base + i] = s + 1u; }
  } else if (p.plant != 2u && u(k, 6u) < p.gamma) { st[base + i] = s - 1u; } // plant 2: no recovery
}
@compute @workgroup_size(${WG}) fn count(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= p.N) { return; }
  let m = gid.y; let s = st[m * p.N + gid.x]; if (s == 0u) { return; }
  atomicAdd(&cnt[m * 4u + ((s - 1u) >> 1u)], 1u); atomicAdd(&cnt[m * 4u + 3u], 1u);
  if (((s - 1u) & 1u) == 1u) { atomicAdd(&cnt[m * 4u + 2u], 1u); }
}`;

export async function getDevice() {
  if (!navigator.gpu) throw new Error('This browser has no WebGPU (try Chrome or Edge).');
  const a = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }); if (!a) throw new Error('No WebGPU adapter.');
  const dev = await a.requestDevice({ requiredLimits: { maxStorageBufferBindingSize: a.limits.maxStorageBufferBindingSize, maxBufferSize: a.limits.maxBufferSize } });
  return { dev, info: a.info || {} };
}

// Engine for one board. B = matches per run (fixed buffer size). run(matches, opts) plays them all and returns per-match holds.
export class Engine {
  constructor(dev, board, B) {
    const N = board.n, P = parityClasses(board); if (P.touching) throw new Error('parity classes touch: ' + P.touching);
    this.dev = dev; this.N = N; this.B = B; this.board = board;
    const nbr = new Int32Array(N * 26).fill(-1), deg = new Uint32Array(N);
    board.adj.forEach((a, i) => { deg[i] = a.length; a.forEach((j, k) => { nbr[i * 26 + k] = j; }); });
    const flat = new Uint32Array(N); this.off = []; let o = 0; for (const c of P.cls) { this.off.push([o, c.length]); flat.set(c, o); o += c.length; }
    const mk = (data, usage) => { const b = dev.createBuffer({ size: Math.max(16, data.byteLength), usage: usage | GPUBufferUsage.COPY_DST }); dev.queue.writeBuffer(b, 0, data); return b; };
    const S = GPUBufferUsage.STORAGE;
    this.nbr = mk(nbr, S); this.deg = mk(deg, S); this.cls = mk(flat, S);
    this.tr = dev.createBuffer({ size: B * 6 * 4, usage: S | GPUBufferUsage.COPY_DST });
    this.st = dev.createBuffer({ size: B * N * 4, usage: S | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
    this.claim = dev.createBuffer({ size: B * N * 4, usage: S | GPUBufferUsage.COPY_DST });
    this.cnt = dev.createBuffer({ size: B * 16, usage: S | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
    this.read = dev.createBuffer({ size: B * 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    this.CHUNK = 50; this.slots = this.CHUNK * 9; // 8 class slots per tick + 1 count slot
    this.uni = dev.createBuffer({ size: this.slots * SLOT, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const mod = dev.createShaderModule({ code: WGSL });
    // a shader that does not compile must stop the run, not come back as zeros (11-25: 'trait' is reserved in WGSL; the gate caught it as all-zero)
    this.ready = mod.getCompilationInfo().then((ci) => { const e = ci.messages.filter((m) => m.type === 'error'); if (e.length) throw new Error('WGSL: ' + e.map((m) => `${m.lineNum}:${m.linePos} ${m.message}`).join('; ')); });
    const ro = { type: 'read-only-storage' }, rw = { type: 'storage' }, C = GPUShaderStage.COMPUTE;
    const lay = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: C, buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: 48 } },
      ...[1, 2, 3, 4].map((b) => ({ binding: b, visibility: C, buffer: ro })), ...[5, 6, 7].map((b) => ({ binding: b, visibility: C, buffer: rw }))] });
    const pl = dev.createPipelineLayout({ bindGroupLayouts: [lay] });
    this.pipe = Object.fromEntries(['propose', 'apply', 'count'].map((e) => [e, dev.createComputePipeline({ layout: pl, compute: { module: mod, entryPoint: e } })]));
    this.bg = dev.createBindGroup({ layout: lay, entries: [{ binding: 0, resource: { buffer: this.uni, size: 48 } },
      ...[this.nbr, this.deg, this.cls, this.tr, this.st, this.claim, this.cnt].map((buffer, k) => ({ binding: k + 1, resource: { buffer } }))] });
  }
  // matches: [{ genomes: [g0, g1], cells: [cells0, cells1] }] (length <= B). opts: T, tail, every, seed, plant (0 none, 1 lineage-index bug, 2 no recovery).
  async run(matches, { T = 1500, tail = 300, every = 10, seed = 1, plant = 0, p = BASE } = {}) {
    await this.ready;
    const { dev, N, B } = this, M = matches.length; if (M > B) throw new Error('too many matches');
    const tr = new Float32Array(B * 6), st = new Uint32Array(B * N);
    matches.forEach((mt, m) => { const t = genomeTraits(p, mt.genomes); for (let g = 0; g < 2; g++) { tr[m * 6 + g * 3] = t.b[g]; tr[m * 6 + g * 3 + 1] = t.beta[g]; tr[m * 6 + g * 3 + 2] = t.alpha[g]; }
      mt.cells.forEach((cs, g) => { for (const c of cs) if (!st[m * N + c]) st[m * N + c] = 1 + 2 * g; }); });
    dev.queue.writeBuffer(this.tr, 0, tr); dev.queue.writeBuffer(this.st, 0, st);
    dev.queue.writeBuffer(this.claim, 0, new Uint32Array(B * N)); dev.queue.writeBuffer(this.cnt, 0, new Uint32Array(B * 4));
    const order = rng(seed ^ 0x51ed), u32 = new Uint32Array(SLOT / 4), f32 = new Float32Array(u32.buffer), t0 = performance.now(); let samples = 0;
    for (let t0k = 0; t0k < T; t0k += this.CHUNK) {
      const n = Math.min(this.CHUNK, T - t0k), data = new Uint8Array(this.slots * SLOT), enc = dev.createCommandEncoder(), plan = [];
      for (let q = 0; q < n; q++) { const tick = t0k + q, ord = [0, 1, 2, 3, 4, 5, 6, 7];
        for (let a = 7; a > 0; a--) { const b = Math.floor(order() * (a + 1)); [ord[a], ord[b]] = [ord[b], ord[a]]; }
        ord.forEach((c, s) => { const [off, len] = this.off[c]; u32.set([tick, c, off, len, N, seed >>> 0]); f32[6] = p.d; f32[7] = p.gamma; f32[8] = p.eps || 0; u32[9] = plant;
          data.set(new Uint8Array(u32.buffer), (q * 9 + s) * SLOT); plan.push([q * 9 + s, len]); });
        const sample = (tick + 1) % every === 0 && tick + 1 > T - tail; if (sample) { u32.set([tick, 0, 0, 0, N, seed >>> 0]); data.set(new Uint8Array(u32.buffer), (q * 9 + 8) * SLOT); plan.push([q * 9 + 8, -1]); samples++; } }
      dev.queue.writeBuffer(this.uni, 0, data);
      const pass = enc.beginComputePass();
      for (const [slot, len] of plan) { pass.setBindGroup(0, this.bg, [slot * SLOT]);
        if (len < 0) { pass.setPipeline(this.pipe.count); pass.dispatchWorkgroups(Math.ceil(N / WG), M); continue; }
        if (!len) continue; const wx = Math.ceil(len / WG);
        pass.setPipeline(this.pipe.propose); pass.dispatchWorkgroups(wx, M); pass.setPipeline(this.pipe.apply); pass.dispatchWorkgroups(wx, M); }
      pass.end(); dev.queue.submit([enc.finish()]);
    }
    const enc = dev.createCommandEncoder(); enc.copyBufferToBuffer(this.cnt, 0, this.read, 0, B * 16); dev.queue.submit([enc.finish()]);
    await this.read.mapAsync(GPUMapMode.READ); const c = new Uint32Array(this.read.getMappedRange().slice(0)); this.read.unmap();
    const ms = performance.now() - t0;
    return { ms, samples, results: matches.map((_, m) => ({ you: c[m * 4] / samples / N, opp: c[m * 4 + 1] / samples / N, mould: c[m * 4 + 3] ? c[m * 4 + 2] / c[m * 4 + 3] : 0 })) };
  }
}
