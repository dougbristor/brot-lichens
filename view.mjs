// view.mjs (insights 11-25): the board's 3D view as a module, for the trainer's in-training game. The same projection as index.html
// (z-buffered squares, one per cell, shaded by depth; drag to turn, wheel to zoom, double-click to reset, slow spin).
// makeView(canvas, colourOf) -> { setBoard(B), draw(), dirty }. colourOf(i) returns [r, g, b] for cell i. index.html still has its own copy.
export const pack = (r, g, b) => (255 << 24) | (b << 16) | (g << 8) | r;
export const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export function makeView(cv, colourOf) {
  const ctx = cv.getContext('2d'), v = { yaw: 0.6, pitch: -0.35, zoom: 1, spin: true, B: null, R: 1, dirty: true };
  let img, buf, zb, W = 0, H = 0, drag = null, last = performance.now();
  function size() { const dpr = devicePixelRatio || 1; W = Math.max(1, Math.round(cv.clientWidth * dpr)); H = Math.max(1, Math.round(cv.clientHeight * dpr));
    cv.width = W; cv.height = H; img = ctx.createImageData(W, H); buf = new Uint32Array(img.data.buffer); zb = new Float32Array(W * H); v.dirty = true; }
  addEventListener('resize', size); size();
  v.setBoard = (B) => { v.B = B; let R = 0; for (let i = 0; i < B.n; i++) R = Math.max(R, Math.hypot(B.pos[3 * i], B.pos[3 * i + 1], B.pos[3 * i + 2])); v.R = R || 1; v.dirty = true; };
  v.draw = () => { const B = v.B; if (!B) return; if (cv.clientWidth * (devicePixelRatio || 1) !== W) size();
    buf.fill(pack(12, 14, 17)); zb.fill(-1e9);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; if (v.spin && !drag) v.yaw += dt * 0.18;
    const cy = Math.cos(v.yaw), sy = Math.sin(v.yaw), cp = Math.cos(v.pitch), sp = Math.sin(v.pitch), p = B.pos, Rr = v.R;
    const scale = (Math.min(W, H) * 0.42 / Math.max(Rr, 0.5)) * v.zoom, ox = W / 2, oy = H / 2, sz = Math.max(1, Math.ceil(scale / B.E)), half = sz / 2;
    for (let i = 0; i < B.n; i++) { const x = p[3 * i], y = p[3 * i + 1], z = p[3 * i + 2];
      const x1 = cy * x + sy * z, z1 = -sy * x + cy * z, y2 = cp * y - sp * z1, z2 = sp * y + cp * z1;
      const px = Math.round(ox + x1 * scale - half), py = Math.round(oy - y2 * scale - half);
      if (px + sz < 0 || py + sz < 0 || px >= W || py >= H) continue;
      const c = colourOf(i), f = 0.38 + 0.62 * Math.max(0, Math.min(1, (z2 / Rr + 1) / 2)), col = pack(c[0] * f | 0, c[1] * f | 0, c[2] * f | 0);
      for (let dy = 0; dy < sz; dy++) { const yy = py + dy; if (yy < 0 || yy >= H) continue; let k = yy * W + px;
        for (let dx = 0; dx < sz; dx++, k++) { const xx = px + dx; if (xx < 0 || xx >= W) continue; if (z2 > zb[k]) { zb[k] = z2; buf[k] = col; } } } }
    ctx.putImageData(img, 0, 0); v.dirty = false; };
  cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, yaw: v.yaw, pitch: v.pitch }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => { if (!drag) return; v.yaw = drag.yaw + (e.clientX - drag.x) * 0.008; v.pitch = Math.max(-1.5, Math.min(1.5, drag.pitch + (e.clientY - drag.y) * 0.008)); v.dirty = true; });
  cv.addEventListener('pointerup', () => { drag = null; });
  cv.addEventListener('wheel', (e) => { e.preventDefault(); v.zoom = Math.max(0.3, Math.min(8, v.zoom * Math.exp(-e.deltaY * 0.0012))); v.dirty = true; }, { passive: false });
  cv.addEventListener('dblclick', () => { v.yaw = 0.6; v.pitch = -0.35; v.zoom = 1; v.dirty = true; });
  return v;
}
