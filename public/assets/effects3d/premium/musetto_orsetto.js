// Tiditalk — effetto viso 3D "premium" (procedurale, scritto da zero, AGPL-3.0).
// GENERATO da premium/_src/build.py: modificare i sorgenti in _src/ (kit.js, creature.js, body.js, fx/musetto_orsetto.js).
function KIT(THREE, H) {
  const K = {};
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sst = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  const mix3 = (o, a, b, t) => { o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; return o; };
  const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  Object.assign(K, { PI, TAU, clamp, lerp, sst, mix3, hex });
  K.shellMode = H && H.__shellMode; K.shellAmb = H && H.__shellAmb; K.aniso = H && H.__aniso; K.noLOD = H && H.__noLOD;   // (__aniso: 4 = old filtering)
  function hash3(i, j, k) {
    let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 1440662683)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y, z) {
    const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
    let fx = x - i, fy = y - j, fz = z - k; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
    const a = hash3(i, j, k), b = hash3(i + 1, j, k), c = hash3(i, j + 1, k), d = hash3(i + 1, j + 1, k);
    const e = hash3(i, j, k + 1), f = hash3(i + 1, j, k + 1), g = hash3(i, j + 1, k + 1), h = hash3(i + 1, j + 1, k + 1);
    return lerp(lerp(lerp(a, b, fx), lerp(c, d, fx), fy), lerp(lerp(e, f, fx), lerp(g, h, fx), fy), fz);
  }
  function fbm(x, y, z, o = 3) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f, z * f); n += a; f *= 2.03; a *= 0.5; } return s / n; }
  function rng(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  Object.assign(K, { hash3, vnoise, fbm, rng });
  function sdEll(x, y, z, c, r) {
    const px = (x - c[0]) / r[0], py = (y - c[1]) / r[1], pz = (z - c[2]) / r[2];
    const k0 = Math.sqrt(px * px + py * py + pz * pz);
    const qx = px / r[0], qy = py / r[1], qz = pz / r[2];
    const k1 = Math.sqrt(qx * qx + qy * qy + qz * qz);
    return k1 < 1e-9 ? -Math.min(r[0], r[1], r[2]) : k0 * (k0 - 1) / k1;
  }
  function sdSph(x, y, z, c, r) { const dx = x - c[0], dy = y - c[1], dz = z - c[2]; return Math.sqrt(dx * dx + dy * dy + dz * dz) - r; }
  function sdCap(x, y, z, a, b, r1, r2 = r1) {
    const pax = x - a[0], pay = y - a[1], paz = z - a[2], bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
    const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz));
    const dx = pax - bax * h, dy = pay - bay * h, dz = paz - baz * h;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - lerp(r1, r2, h);
  }
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const smax = (a, b, k) => -smin(-a, -b, k);
  Object.assign(K, { sdEll, sdSph, sdCap, smin, smax });
  function gridMesh(NU, NV, posFn, opts = {}) {
    const W = NU + 1, nGrid = W * (NV + 1), sl = opts.slit;
    const dup = new Int32Array(W).fill(-1); let nDup = 0;
    if (sl) for (let j = sl.j0 + 1; j < sl.j1; j++) dup[j] = nGrid + nDup++;
    const n = nGrid + nDup;
    const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), side = new Int8Array(n), gi = new Float32Array(n * 2);
    const tmp = [0, 0, 0];
    for (let i = 0; i <= NV; i++) for (let j = 0; j <= NU; j++) {
      const k = i * W + j; posFn(i, j, tmp);
      pos[k * 3] = tmp[0]; pos[k * 3 + 1] = tmp[1]; pos[k * 3 + 2] = tmp[2];
      uv[k * 2] = j / NU; uv[k * 2 + 1] = i / NV; gi[k * 2] = j; gi[k * 2 + 1] = i;
      if (sl && i === sl.i && dup[j] >= 0) {
        const d = dup[j]; pos[d * 3] = tmp[0]; pos[d * 3 + 1] = tmp[1]; pos[d * 3 + 2] = tmp[2];
        uv[d * 2] = j / NU; uv[d * 2 + 1] = i / NV; gi[d * 2] = j; gi[d * 2 + 1] = i; side[k] = 1; side[d] = -1;
      }
    }
    const vid = (i, j, low) => (low && sl && i === sl.i && dup[j] >= 0) ? dup[j] : i * W + j;
    const idx = [];
    const flip = !!opts.flip;
    for (let i = 0; i < NV; i++) for (let j = 0; j < NU; j++) {
      const a = vid(i, j, false), b = vid(i, j + 1, false), c = vid(i + 1, j + 1, true), d = vid(i + 1, j, true);
      if (!(opts.pole0 && i === 0)) flip ? idx.push(a, c, b) : idx.push(a, b, c);
      if (!(opts.pole1 && i === NV - 1)) flip ? idx.push(a, d, c) : idx.push(a, c, d);
    }
    const weld = [];
    if (opts.closedU) for (let i = 0; i <= NV; i++) weld.push([i * W, i * W + NU]);
    if (opts.pole0) { const g = []; for (let j = 0; j <= NU; j++) g.push(j); weld.push(g); }
    if (opts.pole1) { const g = []; for (let j = 0; j <= NU; j++) g.push(NV * W + j); weld.push(g); }
    const m = { NU, NV, n, pos, uv, side, gi, idx, weld, dup };
    m.nrm = calcNormals(pos, idx, n, weld);
    return m;
  }
  function calcNormals(pos, idx, n, weld, out) {
    const nr = out || new Float32Array(n * 3); nr.fill(0);
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const e1x = pos[b] - pos[a], e1y = pos[b + 1] - pos[a + 1], e1z = pos[b + 2] - pos[a + 2];
      const e2x = pos[c] - pos[a], e2y = pos[c + 1] - pos[a + 1], e2z = pos[c + 2] - pos[a + 2];
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      nr[a] += nx; nr[a + 1] += ny; nr[a + 2] += nz; nr[b] += nx; nr[b + 1] += ny; nr[b + 2] += nz; nr[c] += nx; nr[c + 1] += ny; nr[c + 2] += nz;
    }
    for (const g of weld) {
      let sx = 0, sy = 0, sz = 0; for (const v of g) { sx += nr[v * 3]; sy += nr[v * 3 + 1]; sz += nr[v * 3 + 2]; }
      for (const v of g) { nr[v * 3] = sx; nr[v * 3 + 1] = sy; nr[v * 3 + 2] = sz; }
    }
    for (let v = 0; v < n; v++) { const x = nr[v * 3], y = nr[v * 3 + 1], z = nr[v * 3 + 2]; const l = Math.sqrt(x * x + y * y + z * z) || 1; nr[v * 3] = x / l; nr[v * 3 + 1] = y / l; nr[v * 3 + 2] = z / l; }
    return nr;
  }
  K.gridMesh = gridMesh; K.calcNormals = calcNormals;
  function starSurface(o) {
    const NU = o.nu, NV = o.nv, c = o.c, kw = o.kw ?? 0.5, sdf = o.sdf, rmax = o.rmax || 26;
    const phiOf = (t) => PI * (t - kw * Math.sin(PI * t) / PI);
    const phis = new Float64Array(NU + 1); for (let j = 0; j <= NU; j++) phis[j] = phiOf(-1 + 2 * j / NU);
    const mo = o.mouth;
    const latM = mo ? Math.atan2(mo.at[1] - c[1], Math.hypot(mo.at[0] - c[0], mo.at[2] - c[2])) : 0;
    const iM = mo ? 2 * Math.round((latM + PI / 2) / PI * NV / 2) : -1;
    const rowLat = (fi) => !mo ? -PI / 2 + PI * fi / NV
      : fi <= iM ? -PI / 2 + (latM + PI / 2) * (fi / iM) : latM + (PI / 2 - latM) * ((fi - iM) / (NV - iM));
    const jc = NU / 2, mm = mo ? mo.m : 0, phiC = mo ? phis[jc + mm] : 0;
    const amp = mo ? (mo.amp || 0) : 0, shapeF = (mo && mo.shape) || ((s) => Math.cos(TAU * s));
    const rowStep = mo ? (latM + PI / 2) / iM : PI / NV;
    const Wf = (phi) => { if (!mo) return 0; const a = Math.abs(phi); return a <= phiC ? amp * shapeF(phi / phiC) : amp * shapeF(1) * sst(phiC * 2.2, phiC, a); };
    const Ff = (d) => sst(rowStep * 3.2, 0, Math.abs(d));
    const latOf = (fi, phi) => { const l = rowLat(fi); return mo ? l + Wf(phi) * Ff(l - latM) : l; };
    const R = new Float32Array((NV + 1) * (NU + 1)), LAT = new Float32Array((NV + 1) * (NU + 1));
    const march = (dx, dy, dz) => {
      let t = rmax, d = 1;
      for (let s = 0; s < 90; s++) { d = sdf(c[0] + dx * t, c[1] + dy * t, c[2] + dz * t); if (d < 0.004) break; t -= Math.max(d * 0.9, 0.004); if (t < 0.3) return 0.3; }
      return t;
    };
    for (let i = 0; i <= NV; i++) for (let j = 0; j <= NU; j++) {
      const k = i * (NU + 1) + j, phi = phis[j];
      const lat = (i === 0) ? -PI / 2 : (i === NV) ? PI / 2 : latOf(i, phi);
      LAT[k] = lat;
      if (j === NU) { R[k] = R[i * (NU + 1)]; continue; }
      if ((i === 0 || i === NV) && j > 0) { R[k] = R[i * (NU + 1)]; continue; }
      const cl = Math.cos(lat); R[k] = march(cl * Math.sin(phi), Math.sin(lat), cl * Math.cos(phi));
    }
    if (mo && o.pinch) for (let i = iM - 2; i <= iM + 2; i++) for (let j = 0; j <= NU; j++) {
      const a = Math.abs(phis[j]); if (a >= phiC) continue;
      const di = Math.abs(i - iM); const w = (di === 0 ? 1 : di === 1 ? 0.45 : 0.12) * sst(phiC, phiC * 0.7, a);
      R[i * (NU + 1) + j] -= o.pinch * w;
    }
    const S = { NU, NV, c, phis, LAT, R, iM, jc, mm, phiC, latM, rowLat, latOf, phiOf, sdf };
    S.dirAt = (phi, lat, out) => { const cl = Math.cos(lat); out[0] = cl * Math.sin(phi); out[1] = Math.sin(lat); out[2] = cl * Math.cos(phi); return out; };
    S.point = (i, j, out) => { const k = i * (NU + 1) + j; S.dirAt(phis[j], LAT[k], out); const r = R[k]; out[0] = c[0] + out[0] * r; out[1] = c[1] + out[1] * r; out[2] = c[2] + out[2] * r; return out; };
    S.radiusAt = (fi, fj) => {
      const i0 = clamp(Math.floor(fi), 0, NV - 1), j0 = clamp(Math.floor(fj), 0, NU - 1), ti = clamp(fi - i0), tj = clamp(fj - j0), W = NU + 1;
      return lerp(lerp(R[i0 * W + j0], R[i0 * W + j0 + 1], tj), lerp(R[(i0 + 1) * W + j0], R[(i0 + 1) * W + j0 + 1], tj), ti);
    };
    S.mesh = (step) => {
      const nu = NU / step, nv = NV / step;
      const slit = mo ? { i: iM / step, j0: (jc - mm) / step, j1: (jc + mm) / step } : null;
      const m = gridMesh(nu, nv, (i, j, out) => S.point(i * step, j * step, out), { closedU: true, pole0: true, pole1: true, slit });
      m.phi = new Float32Array(m.n); m.lat = new Float32Array(m.n);
      for (let v = 0; v < m.n; v++) { const j = m.gi[v * 2] * step, i = m.gi[v * 2 + 1] * step; m.phi[v] = phis[j]; m.lat[v] = LAT[i * (NU + 1) + j]; }
      m.step = step; return m;
    };
    S.uvPoint = (u, v, out, info) => {
      const fj = u * NU, fi = v * NV; const phi = phiOf(-1 + 2 * u); const lat = clamp(latOf(fi, phi), -PI / 2, PI / 2);
      S.dirAt(phi, lat, out); const r = S.radiusAt(fi, fj);
      if (info) { info.phi = phi; info.lat = lat; info.nx = out[0]; info.ny = out[1]; info.nz = out[2]; }
      out[0] = c[0] + out[0] * r; out[1] = c[1] + out[1] * r; out[2] = c[2] + out[2] * r; return out;
    };
    S.hit = (dx, dy, dz, out) => { const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l; const t = march(dx, dy, dz); out[0] = c[0] + dx * t; out[1] = c[1] + dy * t; out[2] = c[2] + dz * t; return out; };
    S.march = march;
    return S;
  }
  K.starSurface = starSurface;
  K.sdfNormal = (sdf, x, y, z, out) => { const e = 0.02; out[0] = sdf(x + e, y, z) - sdf(x - e, y, z); out[1] = sdf(x, y + e, z) - sdf(x, y - e, z); out[2] = sdf(x, y, z + e) - sdf(x, y, z - e); const l = Math.hypot(out[0], out[1], out[2]) || 1; out[0] /= l; out[1] /= l; out[2] /= l; return out; };
  K.rayHit = (sdf, from, to, out) => {
    let dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2]; const L = Math.hypot(dx, dy, dz); dx /= L; dy /= L; dz /= L;
    let t = 0; for (let s = 0; s < 120; s++) { const d = sdf(from[0] + dx * t, from[1] + dy * t, from[2] + dz * t); if (d < 0.003) break; t += Math.max(d * 0.85, 0.004); if (t > L * 2) break; }
    out[0] = from[0] + dx * t; out[1] = from[1] + dy * t; out[2] = from[2] + dz * t; return out;
  };
  function catmull(P, t) { // uniform Catmull-Rom through P, t in [0,1]
    const n = P.length - 1, f = clamp(t) * n, i = Math.min(Math.floor(f), n - 1), u = f - i;
    const p0 = P[Math.max(i - 1, 0)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(i + 2, n)];
    const u2 = u * u, u3 = u2 * u, o = [0, 0, 0];
    for (let k = 0; k < 3; k++) o[k] = 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3);
    return o;
  }
  function makePath(ctrl, refs, N = 64) {
    const P = [], T = [], Nn = [], B = [], L = [0];
    for (let i = 0; i <= N; i++) P.push(catmull(ctrl, i / N));
    for (let i = 1; i <= N; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]));
    for (let i = 0; i <= N; i++) {
      const a = P[Math.max(i - 1, 0)], b = P[Math.min(i + 1, N)]; let t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const tl = Math.hypot(...t) || 1; t = t.map(x => x / tl);
      const r = catmull(refs, i / N); const d = r[0] * t[0] + r[1] * t[1] + r[2] * t[2];
      let n = [r[0] - t[0] * d, r[1] - t[1] * d, r[2] - t[2] * d]; const nl = Math.hypot(...n) || 1; n = n.map(x => x / nl);
      const bb = [t[1] * n[2] - t[2] * n[1], t[2] * n[0] - t[0] * n[2], t[0] * n[1] - t[1] * n[0]];
      T.push(t); Nn.push(n); B.push(bb);
    }
    const total = L[N];
    return {
      length: total,
      at(s, out) {
        let ss = s; const ext = ss < 0 ? ss * total : ss > 1 ? (ss - 1) * total : 0; ss = clamp(ss);
        const target = ss * total; let lo = 0, hi = N; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (L[mid] < target) lo = mid; else hi = mid; }
        const f = (L[hi] - L[lo]) > 1e-9 ? (target - L[lo]) / (L[hi] - L[lo]) : 0;
        for (let k = 0; k < 3; k++) {
          out.p[k] = lerp(P[lo][k], P[hi][k], f); out.t[k] = lerp(T[lo][k], T[hi][k], f); out.n[k] = lerp(Nn[lo][k], Nn[hi][k], f); out.b[k] = lerp(B[lo][k], B[hi][k], f);
        }
        if (ext) for (let k = 0; k < 3; k++) out.p[k] += out.t[k] * ext;
        return out;
      },
    };
  }
  K.makePath = makePath;
  function tubePointFn(path, sec) {
    const fr = { p: [0, 0, 0], t: [0, 0, 0], n: [0, 0, 0], b: [0, 0, 0] };
    return (u, s, out) => {
      path.at(s, fr); const q = sec(clamp(s, 0, 1)); const a = TAU * u, sa = Math.sin(a), ca = Math.cos(a);
      const lat = q.w * sa, nn = (ca > 0 ? q.t * (q.tf ?? 1) : q.t) * ca - (q.d || 0) * (1 - sa * sa);
      out[0] = fr.p[0] + fr.b[0] * lat + fr.n[0] * nn; out[1] = fr.p[1] + fr.b[1] * lat + fr.n[1] * nn; out[2] = fr.p[2] + fr.b[2] * lat + fr.n[2] * nn;
      return out;
    };
  }
  K.tubePointFn = tubePointFn;
  K.tubeMorph = (name, path2, sec) => { const P2 = tubePointFn(path2, sec), pa = [0, 0, 0]; return { name, fn: (x, y, z, v, m, out) => { P2(m.uOf(v), m.sOf(v), pa); out[0] = pa[0] - x; out[1] = pa[1] - y; out[2] = pa[2] - z; } }; };
  function tubeMesh(path, sec, nu, nv, s0 = 0, opts = {}) {
    const posAt = tubePointFn(path, sec);
    const m = gridMesh(nu, nv, (i, j, out) => posAt(j / nu, lerp(s0, 1, i / nv), out), { closedU: true, pole1: opts.tip !== false, pole0: !!opts.pole0, flip: !!opts.flip });
    m.sOf = (v) => lerp(s0, 1, m.gi[v * 2 + 1] / nv); m.uOf = (v) => m.gi[v * 2] / nu;
    m.posAt = posAt; m.s0 = s0;
    return m;
  }
  K.tubeMesh = tubeMesh;
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function bake(w, h, fn) {
    const ca = mkCanvas(w, h), cf = mkCanvas(w, h);
    const xa = ca.getContext('2d'), xf = cf.getContext('2d');
    const ia = xa.createImageData(w, h), iff = xf.createImageData(w, h); const A = ia.data, F = iff.data;
    const o = [0, 0, 0, 0, 0];
    for (let y = 0; y < h; y++) {
      const v = 1 - (y + 0.5) / h;
      for (let x = 0; x < w; x++) {
        o[0] = o[1] = o[2] = 0.5; o[3] = 0; o[4] = 0;
        fn((x + 0.5) / w, v, o);
        const k = (y * w + x) * 4;
        A[k] = clamp(o[0]) * 255; A[k + 1] = clamp(o[1]) * 255; A[k + 2] = clamp(o[2]) * 255; A[k + 3] = 255;
        F[k] = clamp(o[3]) * 255; F[k + 1] = clamp(o[4]) * 255; F[k + 2] = 0; F[k + 3] = 255;
      }
    }
    xa.putImageData(ia, 0, 0); xf.putImageData(iff, 0, 0);
    const map = new THREE.CanvasTexture(ca); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = K.aniso || 2;   // sampled by every shell: keep filtering cheap
    const fur = new THREE.CanvasTexture(cf); fur.colorSpace = THREE.NoColorSpace;
    if (fn.wrapU) { map.wrapS = fur.wrapS = THREE.RepeatWrapping; }
    return { map, fur };
  }
  K.bake = bake;
  let _noise = null;
  K.noiseTex = () => {
    if (_noise) return _noise;
    const S = 128, cells = 16, cs = S / cells, r = rng(1337), pts = [];
    for (let cy = 0; cy < cells; cy++) for (let cx = 0; cx < cells; cx++) for (let q = 0; q < 2; q++) pts.push([(cx + 0.1 + 0.8 * r()) * cs, (cy + 0.1 + 0.8 * r()) * cs, 0.5 + 0.5 * r(), r()]);
    const grid = []; for (let i = 0; i < cells * cells; i++) grid.push([]);
    pts.forEach(p => grid[Math.floor(p[1] / cs) * cells + Math.floor(p[0] / cs)].push(p));
    const d = new Uint8Array(S * S * 4), rad = cs * 0.55;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const gx = Math.floor(x / cs), gy = Math.floor(y / cs); let best = 0, bh = 0, bv = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const cx = (gx + ox + cells) % cells, cy = (gy + oy + cells) % cells;
        for (const p of grid[cy * cells + cx]) {
          let dx = Math.abs(x + 0.5 - p[0]); dx = Math.min(dx, S - dx); let dy = Math.abs(y + 0.5 - p[1]); dy = Math.min(dy, S - dy);
          const pr = 1 - (dx * dx + dy * dy) / (rad * rad);
          if (pr > best) { best = pr; bh = p[2]; bv = p[3]; }
        }
      }
      const k = (y * S + x) * 4; d[k] = bh * 255; d[k + 1] = clamp(best) * 255; d[k + 2] = bv * 255; d[k + 3] = 255;
    }
    const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = K.aniso ? THREE.LinearMipmapLinearFilter : THREE.LinearMipmapNearestFilter;
    t.generateMipmaps = true; t.anisotropy = K.aniso || 1; t.needsUpdate = true;
    return (_noise = t);
  };
  let _fnm = null;
  K.furNormal = () => {
    if (_fnm) return _fnm;
    const S = 64, hgt = new Float32Array(S * S), r = rng(99);
    for (let k = 0; k < 420; k++) { const x0 = r() * S, y0 = r() * S, L = 4 + r() * 6, a = -PI / 2 + (r() - 0.5) * 0.5; for (let t = 0; t < L; t += 0.5) { const x = Math.floor(x0 + Math.cos(a) * t + S) % S, y = Math.floor(y0 + Math.sin(a) * t + S) % S; hgt[y * S + x] = Math.max(hgt[y * S + x], 1 - t / L); } }
    const d = new Uint8Array(S * S * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const hx = hgt[y * S + (x + 1) % S] - hgt[y * S + (x + S - 1) % S], hy = hgt[((y + 1) % S) * S + x] - hgt[((y + S - 1) % S) * S + x]; const nx = -hx * 1.2, ny = -hy * 1.2, l = Math.hypot(nx, ny, 1); const k = (y * S + x) * 4; d[k] = (nx / l * 0.5 + 0.5) * 255; d[k + 1] = (ny / l * 0.5 + 0.5) * 255; d[k + 2] = (1 / l * 0.5 + 0.5) * 255; d[k + 3] = 255; }
    const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
    return (_fnm = t);
  };
  function furMats(o) {
    const U = {
      uShells: { value: o.shells || 12 }, uLen: { value: o.len || 0.8 }, uLag: { value: new THREE.Vector3() },
      uNoise: { value: K.noiseTex() }, uFur: { value: o.fur }, uRep: { value: new THREE.Vector2(o.rep[0], o.rep[1]) },
      uRoot: { value: o.root ?? 0.55 }, uTip: { value: o.tip ?? 1.12 }, uCombK: { value: o.comb ?? 0.6 }, uDens: { value: o.dens ?? 1 },
    };
    const base = new THREE.MeshStandardMaterial({ map: o.map, roughness: o.rough ?? 0.82, metalness: 0 });
    base.onBeforeCompile = (sh) => {
      sh.uniforms.uFur = U.uFur; sh.uniforms.uRoot = U.uRoot;
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform sampler2D uFur; uniform float uRoot;\nvoid main() {')
        .replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= mix(1.0, uRoot * 1.18, clamp(texture2D(uFur, vMapUv).r * 1.4, 0.0, 1.0));');
    };
    base.customProgramCacheKey = () => 'tdp-furbase';
    let shell = null;
    if (o.shells > 0) {
      const mode = K.shellMode || 'lambert';
      shell = mode === 'standard' ? new THREE.MeshStandardMaterial({ map: o.map, roughness: 1, metalness: 0, transparent: true, depthWrite: false })
        : new THREE.MeshLambertMaterial({ map: o.map, transparent: true, depthWrite: false });
      const amb = K.shellAmb ?? 3.3; U.uAmb = { value: new THREE.Color(amb, amb * 0.99, amb * 0.97) };   // ≈ π × mean RoomEnvironment radiance (calibrated 3.07), slightly warm
      shell.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, U);
        if (mode === 'lambert') sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_maps>', 'iblIrradiance += uAmb * (0.88 + 0.22 * geometryNormal.y);').replace('void main() {', 'uniform vec3 uAmb;\nvoid main() {');
        sh.vertexShader = sh.vertexShader.replace('void main() {', 'uniform float uShells, uLen, uCombK; uniform vec3 uLag; attribute vec3 aComb; varying float vH;\nvoid main() {')
          .replace('#include <morphtarget_vertex>', `#include <morphtarget_vertex>
  vH = (float(gl_InstanceID) + 1.0) / uShells;
  transformed += normalize(objectNormal) * (uLen * vH) + (aComb * uCombK + uLag) * (uLen * vH * vH);`);
        sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform sampler2D uNoise, uFur; uniform vec2 uRep; uniform float uRoot, uTip, uDens; varying float vH;\nvoid main() {')
          .replace('#include <map_fragment>', `#include <map_fragment>
  vec4 fm = texture2D(uFur, vMapUv);
  vec4 nz = texture2D(uNoise, vMapUv * uRep);
  float slen = fm.r * (0.5 + 0.5 * nz.r);
  float fa = smoothstep(vH - 0.05, vH + 0.05, slen) * smoothstep(vH * 0.8 - 0.22 * uDens, vH * 0.8 + 0.04, nz.g);
  if (fa < 0.02) discard;
  diffuseColor.a *= fa;
  diffuseColor.rgb *= mix(uRoot, uTip, vH) * (0.9 + 0.2 * nz.b);`);
      };
      shell.customProgramCacheKey = () => 'tdp-furshell-' + mode;
    }
    return { base, shell, U };
  }
  K.furMats = furMats;
  K.MORPH_N = 12;
  K.padMorphs = (g, N = K.MORPH_N) => {
    const n = g.attributes.position.count, mp = g.morphAttributes.position || [], mn = g.morphAttributes.normal || [];
    if (mp.length > N) throw new Error('too many morph targets: ' + mp.length);
    let z = null; while (mp.length < N) { z = z || new THREE.BufferAttribute(new Float32Array(n * 3), 3); mp.push(z); mn.push(z); }
    g.morphAttributes.position = mp; g.morphAttributes.normal = mn; g.morphTargetsRelative = true; return g;
  };
  K.vc = (g, rgb) => {
    const n = g.attributes.position.count, a = new Float32Array(n * 3), c = rgb ? K.col(rgb) : null;
    for (let i = 0; i < n; i++) { a[i * 3] = c ? c.r : 1; a[i * 3 + 1] = c ? c.g : 1; a[i * 3 + 2] = c ? c.b : 1; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
  };
  K.finish = (root) => { root.traverse(o => { if (o.isMesh && o.material && o.material.vertexColors && !o.geometry.attributes.color) K.vc(o.geometry); }); return root; };
  function toGeometry(m, morphs, comb, pad) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(m.nrm, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(m.uv, 2));
    g.setIndex(m.idx);
    if (comb) {
      const a = new Float32Array(m.n * 3), o = [0, 0, 0];
      for (let v = 0; v < m.n; v++) {
        o[0] = o[1] = o[2] = 0; comb(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2], v, m, o);
        const nx = m.nrm[v * 3], ny = m.nrm[v * 3 + 1], nz = m.nrm[v * 3 + 2], d = o[0] * nx + o[1] * ny + o[2] * nz;
        a[v * 3] = o[0] - nx * d; a[v * 3 + 1] = o[1] - ny * d; a[v * 3 + 2] = o[2] - nz * d;
      }
      g.setAttribute('aComb', new THREE.BufferAttribute(a, 3));
    }
    if (morphs && morphs.length) {
      const mp = [], mn = []; const P2 = new Float32Array(m.n * 3), N2 = new Float32Array(m.n * 3), o = [0, 0, 0];
      for (const mo of morphs) {
        const d = new Float32Array(m.n * 3);
        for (let v = 0; v < m.n; v++) {
          const x = m.pos[v * 3], y = m.pos[v * 3 + 1], z = m.pos[v * 3 + 2]; o[0] = o[1] = o[2] = 0;
          mo.fn(x, y, z, v, m, o); d[v * 3] = o[0]; d[v * 3 + 1] = o[1]; d[v * 3 + 2] = o[2];
          P2[v * 3] = x + o[0]; P2[v * 3 + 1] = y + o[1]; P2[v * 3 + 2] = z + o[2];
        }
        calcNormals(P2, m.idx, m.n, m.weld, N2);
        const dn = new Float32Array(m.n * 3); for (let k = 0; k < m.n * 3; k++) dn[k] = N2[k] - m.nrm[k];
        const pa = new THREE.BufferAttribute(d, 3); pa.name = mo.name; mp.push(pa);
        const na = new THREE.BufferAttribute(dn, 3); na.name = mo.name; mn.push(na);
      }
      g.morphAttributes.position = mp; g.morphAttributes.normal = mn; g.morphTargetsRelative = true;
    }
    g.computeBoundingSphere(); if (g.boundingSphere) g.boundingSphere.radius *= 1.6;
    if (pad) K.padMorphs(g);
    return g;
  }
  K.toGeometry = toGeometry;
  function furPart(o) {
    const geoHi = toGeometry(o.hi, o.morphs, null, true);
    const mats = furMats(Object.assign({ map: o.tex.map, fur: o.tex.fur }, o.fur));
    if (o.fur.mat) Object.assign(mats.base, o.fur.mat);
    const base = new THREE.Mesh(geoHi, mats.base);
    base.renderOrder = o.order ?? 0;
    const part = { base, shells: null, mats, names: {}, U: mats.U };
    (o.morphs || []).forEach((mo, i) => { part.names[mo.name] = i; });
    if (mats.shell && o.lo) {
      const geoLo = toGeometry(o.lo, o.morphs, o.comb || ((x, y, z, v, m, out) => { out[1] = -1; }), true);
      const sh = new THREE.InstancedMesh(geoLo, mats.shell, mats.U.uShells.value);
      const I = new THREE.Matrix4(); for (let i = 0; i < sh.count; i++) sh.setMatrixAt(i, I);
      sh.frustumCulled = false; sh.renderOrder = (o.order ?? 0) + 1;
      sh.userData.U = mats.U; sh.userData.n0 = sh.count;
      sh.morphTargetInfluences = new Array(K.MORPH_N).fill(0); sh.morphTargetDictionary = {}; (o.morphs || []).forEach((mo, i) => { sh.morphTargetDictionary[mo.name] = i; });
      part.shells = sh;
    }
    base.frustumCulled = false;
    part.set = (name, val) => { const i = part.names[name]; if (i === undefined) return; base.morphTargetInfluences[i] = val; if (part.shells) part.shells.morphTargetInfluences[i] = val; };
    part.add = (parent) => { parent.add(base); if (part.shells) parent.add(part.shells); return part; };
    part.obj = new THREE.Group(); part.obj.add(base); if (part.shells) part.obj.add(part.shells);
    return part;
  }
  K.furPart = furPart;
  K.plainMesh = (m, mat, morphs) => { const g = toGeometry(m, morphs); const me = new THREE.Mesh(g, mat); me.frustumCulled = false; return me; };
  K.vcol = (m, fn) => {
    const a = new Float32Array(m.n * 3), o = [1, 1, 1], c = new THREE.Color();
    for (let v = 0; v < m.n; v++) { o[0] = o[1] = o[2] = 1; fn(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2], v, m, o); c.setRGB(o[0], o[1], o[2], THREE.SRGBColorSpace); a[v * 3] = c.r; a[v * 3 + 1] = c.g; a[v * 3 + 2] = c.b; }
    return new THREE.BufferAttribute(a, 3);
  };
  function eyeTexture(o) {
    const S = 256, cv = mkCanvas(S, S), x = cv.getContext('2d'), c = S / 2, R = o.ir * S;
    const css = (a, al = 1) => `rgba(${Math.round(a[0] * 255)},${Math.round(a[1] * 255)},${Math.round(a[2] * 255)},${al})`;
    const scl = o.sclera || [0.9, 0.88, 0.84];
    const gs = x.createRadialGradient(c, c, R * 0.9, c, c, S * 0.5); gs.addColorStop(0, css(scl)); gs.addColorStop(1, css(scl.map(v => v * 0.82)));
    x.fillStyle = gs; x.fillRect(0, 0, S, S);
    x.fillStyle = css(scl.map(v => v * 0.75), 0.5); x.beginPath(); x.arc(c, c, R * 1.06, 0, TAU); x.fill();
    const ia = o.iris[0], ib = o.iris[1], ic = o.iris[2] || ib.map(v => v * 0.45);
    const g = x.createRadialGradient(c, c, R * 0.05, c, c, R);
    g.addColorStop(0, css(ia)); g.addColorStop(0.45, css(lerpC(ia, ib, 0.5))); g.addColorStop(0.82, css(ib)); g.addColorStop(0.94, css(ic)); g.addColorStop(1, css(ic.map(v => v * 0.7)));
    x.fillStyle = g; x.beginPath(); x.arc(c, c, R, 0, TAU); x.fill();
    const r = rng(o.seed || 7); x.lineCap = 'round';
    for (let i = 0; i < 90; i++) {
      const a = r() * TAU, r0 = R * (0.3 + 0.15 * r()), r1 = R * (0.75 + 0.2 * r()); const light = r() > 0.5;
      x.strokeStyle = light ? css(ia.map(v => Math.min(1, v * 1.25)), 0.22) : css(ic, 0.25); x.lineWidth = 1 + r() * 2;
      x.beginPath(); x.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); x.lineTo(c + Math.cos(a + 0.05) * r1, c + Math.sin(a + 0.05) * r1); x.stroke();
    }
    const pr = R * (o.pupil || 0.42);
    x.fillStyle = 'rgba(8,6,6,0.55)';
    if (o.slit) { x.beginPath(); x.ellipse(c, c, pr * 0.5 * 1.25, R * 0.86, 0, 0, TAU); x.fill(); x.fillStyle = '#060404'; x.beginPath(); x.ellipse(c, c, pr * 0.42, R * 0.8, 0, 0, TAU); x.fill(); }
    else { x.beginPath(); x.arc(c, c, pr * 1.12, 0, TAU); x.fill(); x.fillStyle = '#060404'; x.beginPath(); x.arc(c, c, pr, 0, TAU); x.fill(); }
    const gl = x.createRadialGradient(c, c + R * 0.55, 0, c, c + R * 0.55, R * 0.6); gl.addColorStop(0, css(ia.map(v => Math.min(1, v * 1.35)), 0.45)); gl.addColorStop(1, css(ia, 0));
    x.save(); x.beginPath(); x.arc(c, c, R * 0.97, 0, TAU); x.clip(); x.globalCompositeOperation = 'lighter'; x.fillStyle = gl; x.fillRect(0, 0, S, S); x.restore();
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2; return t;
  }
  const lerpC = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  K.lerpC = lerpC;
  K.mixIn = (c, b, t) => { if (t <= 0) return c; if (t > 1) t = 1; c[0] += (b[0] - c[0]) * t; c[1] += (b[1] - c[1]) * t; c[2] += (b[2] - c[2]) * t; return c; };
  K.setC = (c, b) => { c[0] = b[0]; c[1] = b[1]; c[2] = b[2]; return c; };
  K.mulC = (c, k) => { c[0] *= k; c[1] *= k; c[2] *= k; return c; };
  function makeEye(o) {
    const r = o.r, sock = new THREE.Group(); sock.position.set(...o.pos);
    sock.rotation.set(o.pitch || 0, (o.yaw || 0) * o.side, (o.roll || 0) * o.side, 'YXZ');
    if (o.scaleY) sock.scale.set(1, o.scaleY, 1);
    const bg = new THREE.SphereGeometry(r, 28, 20);
    const p = bg.attributes.position, uv = bg.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getX(i) / (2 * r), 0.5 + p.getY(i) / (2 * r));
    const key = JSON.stringify([o.iris, o.pupil, o.slit, o.ir, o.sclera, o.seed]);
    const emat = (K._eyeMats || (K._eyeMats = {}))[key] || (K._eyeMats[key] = furMats({ map: eyeTexture(o), fur: K.blackTex(), shells: 0, rough: 0.12, rep: [1, 1] }).base);
    bg.computeBoundingSphere(); K.padMorphs(bg);
    const ball = new THREE.Mesh(bg, emat);
    const gaze = new THREE.Group(); gaze.add(ball); sock.add(gaze);
    const hm = K._hlMat || (K._hlMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xf6f4f0, roughness: 1, metalness: 0, vertexColors: true }));
    const h1 = new THREE.Mesh(K.vc(new THREE.CircleGeometry(r * (o.hl1 ?? 0.2), 18)), hm); const d1 = new THREE.Vector3(0.36, 0.42, 0.83).normalize().multiplyScalar(r * 1.015); h1.position.copy(d1); h1.lookAt(d1.clone().multiplyScalar(3));
    const h2 = new THREE.Mesh(K.vc(new THREE.CircleGeometry(r * (o.hl2 ?? 0.09), 14)), hm); const d2 = new THREE.Vector3(-0.3, -0.36, 0.88).normalize().multiplyScalar(r * 1.015); h2.position.copy(d2); h2.lookAt(d2.clone().multiplyScalar(3));
    sock.add(h1, h2);
    const lidMat = K.std(o.lid, { roughness: 0.9 }), lashMat = K.std(o.lash || [0.12, 0.08, 0.07], { roughness: 0.6 });
    const RL = r * 1.07, mkLid = (top) => {
      const piv = new THREE.Group();
      const sg = new THREE.SphereGeometry(RL, 30, 9, 0, TAU, top ? 0 : PI / 2, PI / 2);
      const lid = new THREE.Mesh(K.vc(sg), lidMat); piv.add(lid);
      const rim = new THREE.Mesh(K.vc(new THREE.TorusGeometry(RL, r * (o.lashW ?? 0.065), 6, 28, PI)), lashMat);
      rim.rotation.x = PI / 2; piv.add(rim);
      const tilt = new THREE.Group(); tilt.add(piv); sock.add(tilt);
      return { piv, tilt };
    };
    const U = mkLid(true), L = mkLid(false);
    const st = {
      sock, gaze, U, L, side: o.side,
      openU: o.openU ?? -0.95, closeU: o.closeU ?? 0.32, openL: o.openL ?? 1.0, closeL: o.closeL ?? -0.28,
      set(blink, squint, wide, tilt, gx, gy) {
        const ou = st.openU - wide * 0.22 + squint * 0.05;
        const meet = lerp(st.closeU, st.closeU - 0.25, squint);
        U.piv.rotation.x = lerp(ou, meet, blink);
        L.piv.rotation.x = lerp(lerp(st.openL, st.openL - 0.85, squint), st.closeL, blink * 0.6);
        U.tilt.rotation.z = tilt * st.side * 0.42; L.tilt.rotation.z = -tilt * st.side * 0.12;
        gaze.rotation.y = gx * 0.42; gaze.rotation.x = -gy * 0.3;
      },
    };
    st.set(0, 0, 0, 0, 0, 0);
    return st;
  }
  K.makeEye = makeEye;
  const CH = [
    ['jaw', 'jawOpen', 0.04, 1], ['smileL', 'mouthSmileLeft', 0.06, 1.05], ['smileR', 'mouthSmileRight', 0.06, 1.05],
    ['frownL', 'mouthFrownLeft', 0.16, 1], ['frownR', 'mouthFrownRight', 0.16, 1],
    ['pucker', 'mouthPucker', 0.12, 1.05], ['funnel', 'mouthFunnel', 0.1, 1], ['puff', 'cheekPuff', 0.18, 1.1],
    ['tongue', 'tongueOut', 0.22, 1.15], ['browIn', 'browInnerUp', 0.08, 1],
    ['browOutL', 'browOuterUpLeft', 0.08, 1], ['browOutR', 'browOuterUpRight', 0.08, 1],
    ['browDnL', 'browDownLeft', 0.12, 1], ['browDnR', 'browDownRight', 0.12, 1],
    ['sneerL', 'noseSneerLeft', 0.18, 1], ['sneerR', 'noseSneerRight', 0.18, 1],
    ['wideL', 'eyeWideLeft', 0.15, 1], ['wideR', 'eyeWideRight', 0.15, 1],
    ['squintL', 'eyeSquintLeft', 0.1, 1], ['squintR', 'eyeSquintRight', 0.1, 1],
  ];
  const rd = (bs, k) => { const v = bs[k]; return (typeof v === 'number' && v > 0) ? (v < 1 ? v : 1) : 0; };
  const dzf = (x, d, g) => (x <= d ? 0 : Math.min(1, (x - d) / (1 - d) * g));
  K.dzf = dzf;
  function makeExpr() {
    const st = { t: null, v: {} }, out = st.v;
    for (const c of CH) out[c[0]] = 0;
    out.blinkL = out.blinkR = out.gx = out.gy = out.smile = out.frown = out.browUpL = out.browUpR = out.browDn = out.browUp = out.blink = out.dt = 0;
    st.update = (bs, t, snap) => {
      if (!bs) bs = {};
      const dt = (st.t == null || snap) ? 0 : clamp(t - st.t, 0, 0.25); st.t = t;
      for (let i = 0; i < CH.length; i++) { const c = CH[i]; out[c[0]] = dzf(rd(bs, c[1]), c[2], c[3]); }
      const sm = (out.smileL + out.smileR) / 2;
      const lo = 0.14 + 0.41 * sm, hi = Math.min(0.97, lo + 0.46);
      out.blinkL = sst(lo, hi, rd(bs, 'eyeBlinkLeft')); out.blinkR = sst(lo, hi, rd(bs, 'eyeBlinkRight'));
      const gx = (rd(bs, 'eyeLookOutLeft') - rd(bs, 'eyeLookInLeft') + rd(bs, 'eyeLookInRight') - rd(bs, 'eyeLookOutRight')) / 2;
      const gy = (rd(bs, 'eyeLookUpLeft') + rd(bs, 'eyeLookUpRight') - rd(bs, 'eyeLookDownLeft') - rd(bs, 'eyeLookDownRight')) / 2;
      out.gx = Math.sign(gx) * dzf(Math.abs(gx), 0.1, 1.15); out.gy = Math.sign(gy) * dzf(Math.abs(gy), 0.12, 1.1);
      out.smile = sm; out.frown = (out.frownL + out.frownR) / 2;
      out.browUpL = Math.max(out.browIn * 0.8, out.browOutL); out.browUpR = Math.max(out.browIn * 0.8, out.browOutR);
      out.browDn = (out.browDnL + out.browDnR) / 2; out.browUp = (out.browUpL + out.browUpR) / 2;
      out.blink = (out.blinkL + out.blinkR) / 2; out.dt = dt;
      return out;
    };
    return st;
  }
  K.makeExpr = makeExpr;
  function makeMotion(g) {
    const Mp = new THREE.Matrix4(), Mi = new THREE.Matrix4(), D = new THREE.Matrix4(), v = new THREE.Vector3(), ref = new THREE.Vector3(0, 6, 0);
    const st = { init: false, inertia: new THREE.Vector3(), grav: new THREE.Vector3(0, -1, 0), springs: [] };
    st.spring = (k = 60, c = 8, gain = 1, max = 3) => { const s = { x: new THREE.Vector3(), v: new THREE.Vector3(), k, c, gain, max }; st.springs.push(s); return s; };
    st.update = (dt, snap) => {
      const P = g.parent;
      st.inertia.set(0, 0, 0);
      if (P && !snap && st.init && dt > 0) {
        Mi.copy(P.matrix).invert(); D.multiplyMatrices(Mi, Mp);
        v.copy(ref).applyMatrix4(D).sub(ref); if (v.lengthSq() < 25) st.inertia.copy(v);
      }
      if (P) {
        Mp.copy(P.matrix); st.init = true;
        const e = P.matrix.elements, sc = Math.hypot(e[1], e[5], e[9]) || 1;
        const s0 = Math.hypot(e[0], e[1], e[2]) || 1, s1 = Math.hypot(e[4], e[5], e[6]) || 1, s2 = Math.hypot(e[8], e[9], e[10]) || 1;
        st.grav.set(-e[1] / s0, -e[5] / s1, -e[9] / s2); if (st.grav.lengthSq() < 0.01) st.grav.set(0, -1, 0); st.grav.normalize(); void sc;
      }
      const h = Math.min(dt, 0.05);
      for (const s of st.springs) {
        if (snap || !dt) { s.x.set(0, 0, 0); s.v.set(0, 0, 0); continue; }
        s.x.addScaledVector(st.inertia, s.gain);
        for (let q = 0; q < 2; q++) {
          const hh = h / 2;
          s.v.x += (-s.k * s.x.x - s.c * s.v.x) * hh; s.v.y += (-s.k * s.x.y - s.c * s.v.y) * hh; s.v.z += (-s.k * s.x.z - s.c * s.v.z) * hh;
          s.x.addScaledVector(s.v, hh);
        }
        if (s.x.length() > s.max) s.x.setLength(s.max);
      }
    };
    return st;
  }
  K.makeMotion = makeMotion;
  K.makeFurLOD = (root) => {
    const items = [], F = [1, 0.65, 0.45, 0];
    const st = { level: 0, ema: null, slow: 0, fast: 0, wait: 8, items };
    const collect = () => { items.length = 0; root.traverse(o => { if (o.isInstancedMesh && o.userData.U) items.push(o); }); };
    const apply = () => { const f = F[st.level]; for (const o of items) { const n = Math.max(4, Math.min(o.userData.n0, Math.round(o.userData.n0 * f))); o.visible = f > 0; o.count = n; o.userData.U.uShells.value = n; } };
    st.update = (dt) => {
      if (!(dt > 0) || K.noLOD) return;
      if (!items.length) collect();
      const d = Math.min(dt, 0.5); st.ema = st.ema == null ? d : st.ema * 0.94 + d * 0.06;
      if (st.ema > 0.085) { st.slow += d; st.fast = 0; } else if (st.ema < 0.045) { st.fast += d; st.slow = 0; } else { st.slow = st.fast = 0; }
      if (st.slow > 2.5 && st.level < F.length - 1) { st.level++; st.slow = 0; if (st.up) st.wait *= 2; st.up = false; apply(); }
      else if (st.fast > st.wait && st.level > 0) { st.level--; st.fast = 0; st.up = true; apply(); }
    };
    return st;
  };
  function makeLive(g, ids) {
    const fm = H.face, st = { mesh: null, tries: 0, ok: false, P: {}, M: new THREE.Matrix4(), I: new THREE.Matrix4(), v: new THREE.Vector3() };
    for (const i of ids) st.P[i] = new THREE.Vector3(fm.pos[i * 3], fm.pos[i * 3 + 1], fm.pos[i * 3 + 2]);
    st.canon = (i, out) => out.set(fm.pos[i * 3], fm.pos[i * 3 + 1], fm.pos[i * 3 + 2]);
    st.update = (k = 0.6) => {
      if (!st.mesh && st.tries < 40 && g.parent) {
        st.tries++; let root = g; while (root.parent) root = root.parent;
        for (const o of root.children) if (o.isMesh && o !== g && o.material && o.material.colorWrite === false && o.geometry?.attributes?.position?.count === 468) { st.mesh = o; break; }
      }
      if (!st.mesh || !g.parent) { st.ok = false; return false; }
      st.I.copy(g.parent.matrix).invert(); st.M.multiplyMatrices(st.I, st.mesh.matrix);
      const a = st.mesh.geometry.attributes.position.array;
      for (const i of ids) { st.v.set(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]).applyMatrix4(st.M); if (st.v.lengthSq() < 900) st.P[i].lerp(st.v, k); }
      st.ok = true; return true;
    };
    return st;
  }
  K.makeLive = makeLive;
  K.col = (rgb) => new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);
  K.std = (rgb, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: K.col(rgb), roughness: 0.6, metalness: 0, vertexColors: true }, o));
  K.vcMat = (o = {}) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.6, metalness: 0, vertexColors: true }, o));
  let _black = null;
  K.blackTex = () => _black || (_black = Object.assign(new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat), { needsUpdate: true }));
  K.phys = (rgb, o = {}) => new THREE.MeshPhysicalMaterial(Object.assign({ color: K.col(rgb), roughness: 0.4, metalness: 0 }, o));
  K.gw = (x, y, z, c, s) => { const dx = x - c[0], dy = y - c[1], dz = z - c[2]; return Math.exp(-(dx * dx + dy * dy + dz * dz) / (2 * s * s)); };
  K.gwe = (x, y, z, c, r) => { const dx = (x - c[0]) / r[0], dy = (y - c[1]) / r[1], dz = (z - c[2]) / r[2]; return Math.exp(-(dx * dx + dy * dy + dz * dz) * 0.5); };
  K.blob = (x, y, z, c, r, soft = 0.25) => { const dx = (x - c[0]) / r[0], dy = (y - c[1]) / r[1], dz = (z - c[2]) / r[2]; const d = Math.sqrt(dx * dx + dy * dy + dz * dz); return sst(1 + soft, 1 - soft, d); };
  K.rotX = (y, z, cy, cz, a, out) => { const s = Math.sin(a), c = Math.cos(a), py = y - cy, pz = z - cz; out[0] = cy + py * c - pz * s; out[1] = cz + py * s + pz * c; return out; };
  K.yieldUI = () => new Promise(r => setTimeout(r, 0));
  return K;
}
function CREATURE(THREE, H, K) {
  const { PI, TAU, clamp, lerp, sst, lerpC } = K;
  const C = {};
  C.earPath = (o) => {
    const L = o.L, b = o.back || 0, k = o.kind;
    if (k === 'floppy' || k === 'lop') {
      const s = L / 10, up = o.up ?? 1.6, hang = o.hang ?? 1, ox = o.outX ?? 3.0 * s, fz = o.fwd ?? 0;
      const ctrl = [[0, -0.8 * s, 0], [0.5 * s, 0.9 * s * up, 0], [ox * 0.5, 1.5 * s * up, 0.1 * s], [ox * 0.85, 0.6 * s, 0.25 * s + fz * 0.3], [ox, -2.6 * s * hang, 0.5 * s + fz * 0.6], [ox * 1.03, -5.6 * s * hang, 0.75 * s + fz], [ox * 0.98, -8.4 * s * hang, 0.9 * s + fz]];
      const refs = [[0.2, 1, 0], [0.3, 1, 0], [0.3, 1, 0], [1, 0.3, 0], [1, 0, 0], [1, 0, -0.05], [1, 0, -0.1]];
      return { ctrl, refs };
    }
    if (k === 'button') {
      const s = L / 4;
      return { ctrl: [[0, -0.5 * s, 0], [0, 1.4 * s, 0], [0.35 * s, 2.5 * s, 0.6 * s], [0.75 * s, 2.5 * s, 1.7 * s], [0.95 * s, 1.7 * s, 2.5 * s]], refs: [[0, 0, 1], [0, 0, 1], [0, 0.6, 1], [0, 1, 0.3], [0, 1, -0.3]] };
    }
    return { ctrl: [[0, -0.22 * L, 0.02 * L * b], [0, 0.3 * L, -0.03 * L * b], [0, 0.66 * L, -0.1 * L * b], [0, L, -0.2 * L * b]], refs: [[0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1]] };
  };
  C.earSection = (o) => {
    const k = o.kind, W = o.W, T = o.T, D = o.D ?? W * 0.35, rho = o.rho ?? 0;
    if (k === 'floppy' || k === 'lop') {
      return (s) => {
        const prof = k === 'lop' ? (0.45 + 0.75 * sst(0.05, 0.6, s)) * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, (s - 0.62) / 0.38), 2.2)))
          : (0.3 + 0.82 * sst(0.0, 0.78, s)) * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, (s - 0.68) / 0.32), 2.0)));
        return { w: W * prof + 0.02, t: T * (1 - 0.45 * s) * Math.sqrt(prof + 0.05) + 0.02, tf: 1, d: -D * prof * sst(0, 0.3, s) };
      };
    }
    if (k === 'button') return (s) => { const p = Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, (s - 0.45) / 0.55), 2))) * (0.8 + 0.3 * s); return { w: W * p + 0.02, t: T * (1 - 0.4 * s) + 0.02, tf: 1, d: 0 }; };
    return (s) => {
      const pointy = Math.pow(Math.max(0, 1 - s), 0.75) * (1 + 0.7 * s) * (1 - 0.35 * s);
      const round = Math.sqrt(Math.max(0, 1 - s * s)) * (1 + 0.12 * s);
      const p = lerp(pointy, round, rho);
      return { w: W * p + 0.01, t: T * Math.sqrt(Math.max(0, 1 - s)) * (1 - 0.4 * s) + 0.03, tf: o.tf ?? 0.28, d: D * p * (1 - 0.45 * s) };
    };
  };
  C.ear = (o) => {
    const P = C.earPath(o), path = K.makePath(P.ctrl, P.refs), sec = C.earSection(o);
    const nu = o.nu || 24, nv = o.nv || 16, s0 = o.s0 ?? -0.12;
    const hi = K.tubeMesh(path, sec, nu, nv, s0), lo = o.fur && o.fur.shells ? K.tubeMesh(path, sec, nu / 2, nv / 2, s0) : null;
    const morphs = (o.morphs || []).map(mm => K.tubeMorph(mm.name, K.makePath(mm.ctrl, mm.refs || P.refs), sec));
    const inner = o.innerSide ?? 1;  // +1: inner skin on the +n side (upright ears); -1 for hanging ears
    const fr = { p: [0, 0, 0], t: [0, 0, 0], n: [0, 0, 0], b: [0, 0, 0] };
    const outC = o.out, innC = o.inn || [0.86, 0.6, 0.6], tuft = o.tuft || lerpC(o.out, [0.95, 0.92, 0.86], 0.6), tipC = o.tip, rimC = o.rim;
    const cc = [0, 0, 0], mixIn = K.mixIn, tuftMix = lerpC(outC, tuft, 0.75);
    const bf = (u, v, out) => {
      const s = lerp(s0, 1, v), a = TAU * u, sa = Math.sin(a), ca = Math.cos(a) * inner;
      const c = K.setC(cc, outC); let fur = o.furOut ?? 0.75;
      if (ca > 0) {
        const edge = Math.abs(sa), skin = sst(0.82, 0.45, edge) * sst(0.98, 0.7, s) * sst(-0.05, 0.12, s);
        const tf = sst(0.55, 0.95, edge) * 0.8 + sst(0.35, 0.0, s) * 0.6;
        K.setC(c, tuftMix); mixIn(c, innC, skin);
        fur = Math.max((o.furIn ?? 0.95) * clamp(tf), (1 - skin) * 0.5) * (1 - skin * 0.9);
        if (o.innerFur) { mixIn(c, tuft, 0.6); fur = Math.max(fur, o.innerFur); }
      } else if (rimC) {
        mixIn(c, rimC, sst(0.7, 0.95, Math.abs(sa)) * 0.85);
      }
      if (tipC) mixIn(c, tipC, sst(o.tipFrom ?? 0.62, 0.95, s) * (o.tipK ?? 1));
      if (o.paint) o.paint(u, s, ca, sa, c);
      out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; out[3] = fur * sst(1.0, 0.85, s) + (s > 0.9 ? (o.tipTuft || 0) : 0); out[4] = 0;
    };
    bf.wrapU = true;
    const tex = K.bake(o.tw || 64, o.th || 64, bf);
    const comb = (x, y, z, v, m, out) => { path.at(m.sOf(v), fr); out[0] = fr.t[0]; out[1] = fr.t[1]; out[2] = fr.t[2]; };
    const fur = Object.assign({ shells: 0, len: 0.5, rep: [3, 6], root: 0.6, tip: 1.1 }, o.fur || {});
    const part = K.furPart({ hi, lo, morphs, comb, tex, fur, order: o.order });
    const piv = new THREE.Group(); piv.add(part.obj);
    return { piv, part, path };
  };
  C.cloneEar = (e) => {
    const p = e.part, base = new THREE.Mesh(p.base.geometry, p.base.material); base.frustumCulled = false; base.renderOrder = p.base.renderOrder;
    const obj = new THREE.Group(); obj.add(base); let shells = null;
    if (p.shells) { shells = new THREE.InstancedMesh(p.shells.geometry, p.shells.material, p.shells.count); const I = new THREE.Matrix4(); for (let i = 0; i < shells.count; i++) shells.setMatrixAt(i, I); shells.frustumCulled = false; shells.renderOrder = p.shells.renderOrder; shells.userData.U = p.shells.userData.U; shells.userData.n0 = p.shells.userData.n0; if (p.shells.morphTargetInfluences) { shells.morphTargetInfluences = p.shells.morphTargetInfluences.map(() => 0); } obj.add(shells); }
    const part = { base, shells, mats: p.mats, names: p.names, U: p.U, obj };
    part.set = (name, val) => { const i = part.names[name]; if (i === undefined) return; base.morphTargetInfluences[i] = val; if (shells) shells.morphTargetInfluences[i] = val; };
    const piv = new THREE.Group(); piv.add(obj);
    return { piv, part, path: e.path };
  };
  C.nose = (o) => {
    const w = o.w, hh = o.h, d = o.d, kind = o.kind;
    let sdf;
    if (kind === 'cat' || kind === 'bunny') {
      sdf = (x, y, z) => {
        const ty = clamp((y + hh) / (2 * hh)); const sx = lerp(0.35, 1.0, Math.pow(ty, 0.8));
        let dd = K.sdEll(x / sx, y, z, [0, 0, 0], [w, hh, d]) * Math.min(1, sx + 0.3);
        dd = K.smax(dd, -K.sdEll(x, y, z, [0, -hh * 1.05, d * 0.95], [w * 0.18, hh * 0.5, d * 0.5]), 0.12);
        return dd;
      };
    } else if (kind === 'pig') {
      sdf = (x, y, z) => {
        const q = Math.hypot(x / w, y / hh) - 1, pz = Math.abs(z) - d;
        const rr = 0.32 * Math.min(w, hh);
        let dd = Math.min(Math.max(q * Math.min(w, hh), pz), 0) + Math.hypot(Math.max(q * Math.min(w, hh) + rr, 0), Math.max(pz + rr, 0)) - rr;
        for (const sgn of [-1, 1]) dd = K.smax(dd, -K.sdEll(x, y, z, [sgn * w * 0.36, -hh * 0.02, d * 1.02], [w * 0.17, hh * 0.3, d * 0.42]), 0.12);
        return dd;
      };
    } else {
      sdf = (x, y, z) => {
        const ty = clamp((y + hh) / (2 * hh)); const sx = lerp(0.62, 1.0, Math.pow(ty, 0.6));
        let dd = K.sdEll(x / sx, y + 0.12 * hh * (x * x) / (w * w), z, [0, 0, 0], [w, hh, d]) * Math.min(1, sx + 0.2);
        const nx = w * 0.45, ny = -hh * 0.15;
        for (const sgn of [-1, 1]) dd = K.smax(dd, -K.sdEll(x, y, z, [sgn * nx, ny, d * 0.92], [w * 0.2, hh * 0.24, d * 0.42]), 0.14);
        dd = K.smax(dd, -K.sdEll(x, y, z, [0, -hh * 0.95, d * 0.85], [w * 0.07, hh * 0.55, d * 0.4]), 0.08);
        return dd;
      };
    }
    const S = K.starSurface({ sdf, c: [0, 0, 0], nu: o.nu || 40, nv: o.nv || 26, rmax: Math.max(w, hh, d) * 2 + 0.5, kw: 0.3 });
    const m = S.mesh(1);
    const g = K.toGeometry(m, null);
    const base = o.col, dark = o.dark || base.map(v => v * 0.35), hi = o.hiC || lerpC(base, [1, 1, 1], 0.25);
    g.setAttribute('color', K.vcol(m, (x, y, z, v, mm, out) => {
      let c = base;
      if (kind === 'pig') {
        const nost = Math.max(K.blob(x, y, z, [w * 0.36, -hh * 0.02, d * 0.9], [w * 0.22, hh * 0.36, d * 0.5], 0.35), K.blob(x, y, z, [-w * 0.36, -hh * 0.02, d * 0.9], [w * 0.22, hh * 0.36, d * 0.5], 0.35));
        c = lerpC(c, dark, nost * 0.85); c = lerpC(c, hi, sst(0.3, 1.0, y / hh) * 0.3);
      } else if (kind !== 'cat' && kind !== 'bunny') {
        const nost = Math.max(K.blob(x, y, z, [w * 0.45, -hh * 0.15, d * 0.85], [w * 0.22, hh * 0.28, d * 0.45], 0.4), K.blob(x, y, z, [-w * 0.45, -hh * 0.15, d * 0.85], [w * 0.22, hh * 0.28, d * 0.45], 0.4));
        c = lerpC(c, dark, nost);
        c = lerpC(c, hi, sst(0.2, 0.9, y / hh) * sst(0.0, 0.8, z / d) * 0.45);
      } else {
        c = lerpC(c, hi, sst(0.0, 0.9, y / hh) * 0.35);
        c = lerpC(c, dark, sst(-0.5, -1.0, y / hh) * sst(w * 0.35, 0, Math.abs(x)) * 0.5);
      }
      out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
    }));
    const mat = K.vcMat({ roughness: (o.rough ?? 0.42) * 0.7 });
    const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false;
    return mesh;
  };
  C.beak = (o) => {
    const L = o.L, W = o.W, T = o.T, hook = o.hook ?? 0.2, lo = !!o.lower, sg = lo ? -1 : 1;
    const path = K.makePath([[0, 0, -0.5 * L], [0, sg * 0.04 * L, 0.35 * L], [0, -hook * 0.28 * L, 0.8 * L], [0, -hook * 0.62 * L, L]], [[0, sg, 0], [0, sg, 0], [0, sg, 0.25 * hook], [0, sg, 0.8 * hook]]);
    const m = K.tubeMesh(path, (s) => { const k = Math.pow(Math.max(0, 1 - s), 0.85); return { w: W * k * (1 + 0.25 * (1 - s)) + 0.015, t: T * 0.12 * k + 0.01, tf: 8.5, d: 0 }; }, 18, 14, 0);
    const g = K.toGeometry(m, null);
    const col = o.col || [0.12, 0.1, 0.1], tip = o.tipCol || col;
    g.setAttribute('color', K.vcol(m, (x, y, z, v, mm, out) => { const c = lerpC(col, tip, sst(0.45, 1.0, z / L)); const ridge = sst(W * 0.35, 0, Math.abs(x)) * (lo ? 0 : 0.12); out[0] = c[0] * (1 + ridge); out[1] = c[1] * (1 + ridge); out[2] = c[2] * (1 + ridge); }));
    const me = new THREE.Mesh(g, K.vcMat({ roughness: o.rough ?? 0.38 })); me.frustumCulled = false; return me;
  };
  C.horn = (o) => {
    const L = o.L, R = o.R, tw = o.twists ?? 3.2, NU = 40, NV = 48;
    const m = K.gridMesh(NU, NV, (i, j, out) => {
      const s = i / NV, a = TAU * j / NU, k = Math.pow(1 - s, 0.92) * (1 - 0.06 * s) + 0.004;
      const groove = 1 - 0.13 * Math.pow(0.5 + 0.5 * Math.cos(a - tw * TAU * s), 3) * sst(0.0, 0.08, s) * sst(1.0, 0.85, s);
      const r = R * k * groove; out[0] = Math.cos(a) * r; out[1] = L * s + (s > 0.985 ? 0 : 0); out[2] = Math.sin(a) * r; return out;
    }, { closedU: true, pole1: true, flip: true });
    const g = K.toGeometry(m, null);
    const col = o.col, tip = o.tip || col;
    g.setAttribute('color', K.vcol(m, (x, y, z, v, mm, out) => { const s = y / L, c = lerpC(col, tip, sst(0.2, 1, s)); out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; }));
    const me = new THREE.Mesh(g, K.vcMat({ roughness: o.rough ?? 0.28, metalness: o.metal ?? 0.35 })); me.frustumCulled = false; return me;
  };
  C.whiskers = (list, o = {}) => {
    const geos = [];
    for (const w of list) {
      const r0 = w.r0 ?? o.r0 ?? 0.055, r1 = o.r1 ?? 0.012, L = w.len;
      const a = w.root, dl = Math.hypot(...w.dir), d = w.dir.map(x => x / dl);
      const c1 = [a[0] + d[0] * L * 0.4, a[1] + d[1] * L * 0.4 + (w.lift || 0) * L, a[2] + d[2] * L * 0.4];
      const e = [a[0] + d[0] * L, a[1] + d[1] * L - (w.droop ?? 0.12) * L, a[2] + d[2] * L];
      const path = K.makePath([a, c1, e], [[0, 1, 0], [0, 1, 0], [0, 1, 0]], 16);
      const m = K.tubeMesh(path, (s) => ({ w: lerp(r0, r1, s), t: lerp(r0, r1, s), tf: 1, d: 0 }), 5, 10, 0, { tip: false });
      geos.push(K.toGeometry(m, null));
    }
    const merged = K.vc(H.BufferGeometryUtils.mergeGeometries(geos));
    const mat = K.std(o.col || [0.9, 0.88, 0.84], { roughness: 0.4 });
    const mesh = new THREE.Mesh(merged, mat); mesh.frustumCulled = false; return mesh;
  };
  C.tongue = (o = {}) => {
    const w = o.w || 1.5, t = o.t || 0.42, L = o.L || 2.6;
    const path = K.makePath([[0, 0, -0.4], [0, 0.05, L * 0.45], [0, -0.05 * L, L]], [[0, 1, 0], [0, 1, 0], [0, 1, 0]]);
    const m = K.tubeMesh(path, (s) => { const p = Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, (s - 0.55) / 0.45), 2))); return { w: w * (0.85 + 0.15 * s) * p + 0.02, t: t * (1 - 0.3 * s) * p + 0.02, tf: 0.75, d: 0.18 * p }; }, 20, 14, 0);
    const g = K.toGeometry(m, null);
    const col = o.col || [0.86, 0.38, 0.42];
    g.setAttribute('color', K.vcol(m, (x, y, z, v, mm, out) => { const groove = sst(0.35, 0, Math.abs(x)) * sst(-0.1, 0.2, y); const c = lerpC(col, col.map(q => q * 0.72), groove * 0.7); out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; }));
    const me = new THREE.Mesh(g, K.vcMat({ roughness: 0.32 }));
    me.frustumCulled = false; return me;
  };
  C.fang = (r, l, col) => { const g = K.vc(new THREE.ConeGeometry(r, l, 10, 1)); g.rotateX(PI); g.translate(0, -l / 2, 0); const m = new THREE.Mesh(g, K.std(col || [0.93, 0.9, 0.84], { roughness: 0.3 })); return m; };
  C.incisor = (w, h, d, col) => {
    const g = new THREE.BoxGeometry(w, h, d, 3, 3, 2); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, p.getZ(i) - 0.15 * (x * x) / (w * w) * d * 4); if (y < 0) p.setX(i, x * (1 - 0.18 * (-y / h))); }
    g.computeVertexNormals(); g.translate(0, -h / 2, 0); K.vc(g);
    return new THREE.Mesh(g, K.std(col || [0.94, 0.92, 0.86], { roughness: 0.3 }));
  };
  C.HEAD_FIT = { s: [1.08, 1.13, 1.08], p: [0, -7, 2] };
  C.head = async (spec) => {
    const root = new THREE.Group();
    const TT = [performance.now()], tm = {}; const mark = (k) => { TT.push(performance.now()); tm[k] = Math.round(TT[TT.length - 1] - TT[TT.length - 2]); };
    const sc = spec.scale || 1;
    const E = spec.eyes, mo = spec.mouth;
    const eyeC = [[E.pos[0], E.pos[1], E.pos[2]], [-E.pos[0], E.pos[1], E.pos[2]]];
    const sock = E.socket ?? 1.13, er = E.r;
    const sdfBase = spec.sdf;
    const sdf = (x, y, z) => {
      let d = sdfBase(x, y, z);
      for (const c of eyeC) d = K.smax(d, -K.sdSph(x, y, z, c, er * sock), E.sockK ?? 0.55);
      return d;
    };
    const S = K.starSurface({ sdf, c: spec.c, nu: spec.nu || 72, nv: spec.nv || 48, rmax: spec.rmax || 26, kw: spec.kw ?? 0.5, mouth: { at: mo.at, m: mo.m || 6, amp: mo.amp ?? 0.03, shape: mo.shape }, pinch: mo.pinch ?? 0.14 });
    mark('star');
    await K.yieldUI();
    const W = S.NU + 1, pt = [0, 0, 0];
    const Mc = S.point(S.iM, S.jc, [0, 0, 0]), CL = S.point(S.iM, S.jc + S.mm, [0, 0, 0]), CR = S.point(S.iM, S.jc - S.mm, [0, 0, 0]);
    const J = mo.pivot || [0, Mc[1] + 3.5, Mc[2] - 9.5];
    const theta = mo.open ?? 0.42;
    const latSlit = (phi) => S.latOf(S.iM, phi);
    const rowStep = (S.latM + PI / 2) / S.iM;
    const phiC = S.phiC;
    const lowCore = (a) => a < phiC ? lerp(0.5, 1, sst(phiC, phiC * 0.45, a)) : 0.5 * sst(phiC * (mo.wide ?? 3.2), phiC, a);
    const upCore = (a) => a < phiC ? 0.5 * sst(phiC * 0.4, phiC, a) : 0.5 * sst(phiC * (mo.wide ?? 3.2), phiC, a);
    const jawW = (x, y, z, v, m) => {
      const phi = m.phi[v], lat = m.lat[v], sd = m.side[v], a = Math.abs(phi);
      const d = lat - latSlit(phi);
      let w;
      if (sd === -1) w = lowCore(a);
      else if (sd === 1) w = upCore(a);
      else if (d < 0) w = Math.max(lowCore(a), sst(0.95, 0.3, a) * sst(-0.02, -0.3, d));
      else w = upCore(a) * sst(rowStep * 2.6, 0, d);
      return w * sst(spec.c[2] - 5, spec.c[2] + 3, z) * sst(-1.45, -0.95, lat * 1 + 0 * y);
    };
    const s2 = [0, 0];
    const fwdOf = (x, y, z, out) => { const dx = x - spec.c[0], dy = y - spec.c[1], dz = z - spec.c[2], l = Math.hypot(dx, dy, dz) || 1; out[0] = dx / l; out[1] = dy / l; out[2] = dz / l; return out; };
    const nn = [0, 0, 0];
    const eyeL = eyeC[0], eyeR = eyeC[1];
    const D = Object.assign({ smile: 1, frown: 1, pucker: 1, puff: 1, brow: 1, sneer: 1 }, spec.deform || {});
    const ms = spec.mscale || 1;  // feature size scale
    const BL = [eyeL[0] * 0.95, eyeL[1] + er * 1.45, eyeL[2] + 0.2], BR = [-BL[0], BL[1], BL[2]];
    const BDL = [BL[0] - er * 0.45, BL[1], BL[2]], BDR = [BR[0] + er * 0.45, BR[1], BR[2]];
    const cheekL = [CL[0] + 1.6 * ms, CL[1] + 1.8 * ms, CL[2] - 1.4 * ms], cheekR = [-cheekL[0], cheekL[1], cheekL[2]];
    const puffL = [CL[0] + 2.2 * ms, CL[1] + 1.4 * ms, CL[2] - 1.6 * ms], puffR = [-puffL[0], puffL[1], puffL[2]];
    let noseAt = spec.nose ? spec.nose.at : [0, Mc[1] + 2.5, Mc[2] + 1.5];
    if (spec.nose && spec.nose.onSurf !== false) {
      const c0 = spec.c, dx = noseAt[0] - c0[0], dy = noseAt[1] - c0[1], dz = noseAt[2] - c0[2], l = Math.hypot(dx, dy, dz);
      const q = S.hit(dx, dy, dz, [0, 0, 0]); const k = spec.nose.out ?? (spec.nose.d * 0.38);
      noseAt = [q[0] + dx / l * k, q[1] + dy / l * k, q[2] + dz / l * k]; spec.nose.at = noseAt;
    }
    const NB = [noseAt[0], noseAt[1] + 1.2 * ms, noseAt[2] - 0.8 * ms];
    const morphs = [
      { name: 'jaw', fn: (x, y, z, v, m, out) => {
        const w = jawW(x, y, z, v, m); if (w <= 0) return;
        K.rotX(y, z, J[1], J[2], theta * w, s2); out[1] = s2[0] - y; out[2] = s2[1] - z;
        const lat = m.lat[v], phi = m.phi[v], a = Math.abs(phi); const dd = Math.abs(lat - latSlit(phi));
        const roll = sst(rowStep * 2.2, 0, dd) * sst(phiC, phiC * 0.6, a) * (mo.roll ?? 0.35);
        fwdOf(x, y, z, nn); out[0] -= nn[0] * roll; out[1] -= nn[1] * roll; out[2] -= nn[2] * roll;
        if (m.side[v] === 1 || (lat > latSlit(phi) && dd < rowStep * 1.5)) out[1] += (mo.lift ?? 0.3) * sst(phiC, 0, a);
      } },
      { name: 'smileL', fn: (x, y, z, v, m, out) => { const g = K.gw(x, y, z, CL, 1.9 * ms), g2 = K.gw(x, y, z, cheekL, 2.9 * ms); out[0] = (0.7 * g + 0.22 * g2) * D.smile; out[1] = (2.3 * g + 0.95 * g2) * D.smile; out[2] = (-0.65 * g + 0.5 * g2) * D.smile; } },
      { name: 'smileR', fn: (x, y, z, v, m, out) => { const g = K.gw(x, y, z, CR, 1.9 * ms), g2 = K.gw(x, y, z, cheekR, 2.9 * ms); out[0] = -(0.7 * g + 0.22 * g2) * D.smile; out[1] = (2.3 * g + 0.95 * g2) * D.smile; out[2] = (-0.65 * g + 0.5 * g2) * D.smile; } },
      { name: 'frownL', fn: (x, y, z, v, m, out) => { const g = K.gw(x, y, z, CL, 2.1 * ms); out[0] = 0.15 * g * D.frown; out[1] = -1.55 * g * D.frown; out[2] = 0.05 * g; } },
      { name: 'frownR', fn: (x, y, z, v, m, out) => { const g = K.gw(x, y, z, CR, 2.1 * ms); out[0] = -0.15 * g * D.frown; out[1] = -1.55 * g * D.frown; out[2] = 0.05 * g; } },
      { name: 'pucker', fn: (x, y, z, v, m, out) => { const g = K.gw(x, y, z, Mc, 2.3 * ms); out[0] = -x * 0.4 * g * D.pucker; out[1] = -(y - Mc[1]) * 0.15 * g; out[2] = 1.0 * g * D.pucker; } },
      { name: 'puff', fn: (x, y, z, v, m, out) => { const g = K.gw(x, y, z, puffL, 3.2 * ms) + K.gw(x, y, z, puffR, 3.2 * ms); fwdOf(x, y, z, nn); const k = 2.1 * g * D.puff; out[0] = nn[0] * k; out[1] = nn[1] * k; out[2] = nn[2] * k; } },
      { name: 'browUpL', fn: (x, y, z, v, m, out) => { const g = K.gw(x, y, z, BL, 2.6 * ms); out[1] = 1.6 * g * D.brow; out[2] = 0.15 * g; } },
      { name: 'browUpR', fn: (x, y, z, v, m, out) => { const g = K.gw(x, y, z, BR, 2.6 * ms); out[1] = 1.6 * g * D.brow; out[2] = 0.15 * g; } },
      { name: 'browDnL', fn: (x, y, z, v, m, out) => { const g = K.gw(x, y, z, BDL, 2.3 * ms); out[1] = -1.2 * g * D.brow; out[2] = 0.45 * g * D.brow; } },
      { name: 'browDnR', fn: (x, y, z, v, m, out) => { const g = K.gw(x, y, z, BDR, 2.3 * ms); out[1] = -1.2 * g * D.brow; out[2] = 0.45 * g * D.brow; } },
      { name: 'sneer', fn: (x, y, z, v, m, out) => { const g = K.gw(x, y, z, NB, 1.8 * ms); out[1] = 0.45 * g * D.sneer; out[2] = -0.1 * g; } },
    ];
    if (spec.morphs) morphs.push(...spec.morphs({ S, Mc, CL, CR, J, eyeC, er }));
    const info = { phi: 0, lat: 0, nx: 0, ny: 0, nz: 0 }, P = [0, 0, 0];
    const tw = spec.tw || 256, th = spec.th || 128;
    const cx = { S, Mc, CL, CR, eyeC, er, noseAt, J };
    const bf = (u, v, out) => { S.uvPoint(u, v, P, info); spec.color(P[0], P[1], P[2], info, out, cx); };
    bf.wrapU = true;
    const tex = K.bake(tw, th, bf);
    mark('bake');
    await K.yieldUI();
    const hi = S.mesh(1), lo = spec.fur && spec.fur.shells ? S.mesh(spec.lo || 2) : null;
    const combC = spec.combFrom || [0, Mc[1] + 1, Mc[2] + 6];
    const comb = spec.comb || ((x, y, z, v, m, out) => { out[0] = x - combC[0]; out[1] = (y - combC[1]) * 0.8 - 2.5; out[2] = z - combC[2]; const l = Math.hypot(out[0], out[1], out[2]) || 1; out[0] /= l; out[1] /= l; out[2] /= l; });
    const fur = Object.assign({ shells: 12, len: 0.9, rep: [18, 9], root: 0.58, tip: 1.12 }, spec.fur || {});
    const head = K.furPart({ hi, lo, morphs, comb, tex, fur });
    root.add(head.obj);
    mark('morph');
    await K.yieldUI();
    const sampleCol = (x, y, z) => { const o = [0, 0, 0, 0, 0]; const q = S.hit(x - spec.c[0], y - spec.c[1], z - spec.c[2], [0, 0, 0]); const dir = [q[0] - spec.c[0], q[1] - spec.c[1], q[2] - spec.c[2]]; const l = Math.hypot(...dir); spec.color(q[0], q[1], q[2], { phi: Math.atan2(dir[0], dir[2]), lat: Math.asin(dir[1] / l), nx: dir[0] / l, ny: dir[1] / l, nz: dir[2] / l }, o, cx); return [o[0], o[1], o[2]]; };
    const lidCol = E.lid || sampleCol(eyeL[0], eyeL[1] + er * 1.3, eyeL[2] + er).map(v => v * (E.lidK ?? 0.97));
    const eyes = [1, -1].map((sd, i) => K.makeEye(Object.assign({}, E, { pos: eyeC[i], side: sd, lid: lidCol })));
    eyes.forEach(e => root.add(e.sock));
    const jawPiv = new THREE.Group(); jawPiv.position.set(J[0], J[1], J[2]); root.add(jawPiv);
    const toJaw = (p) => [p[0] - J[0], p[1] - J[1], p[2] - J[2]];
    const mw = Math.abs(CL[0]);
    const deep = mo.deep || [0.16, 0.035, 0.045], edge = mo.edge || [0.42, 0.12, 0.14];
    const bagCol = (g2) => { const pp = g2.attributes.position, a = new Float32Array(pp.count * 3), c = new THREE.Color(); for (let i = 0; i < pp.count; i++) { const z = pp.getZ(i), y = pp.getY(i); const t = sst(-0.3, 0.95, z) * 0.85 + sst(0.5, 1.0, Math.abs(y)) * 0.15; const q2 = lerpC(deep, edge, t); c.setRGB(q2[0], q2[1], q2[2], THREE.SRGBColorSpace); a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g2.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g2; };
    const bagMat = K.vcMat({ roughness: 0.9 });
    const inside = (g2) => { const ix = g2.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } const nr = g2.attributes.normal.array; for (let i = 0; i < nr.length; i++) nr[i] = -nr[i]; return g2; };
    const bagBase = { x: 0, y: Mc[1] - (mo.bagY ?? 0.5) * ms, z: Mc[2] - (mo.bagZ ?? 2.1) * ms, rx: mw + (mo.bagX ?? 0.7) * ms, ry: (mo.bagH ?? 1.5) * ms, rz: (mo.bagD ?? 2.1) * ms };
    const bagU = new THREE.Mesh(inside(bagCol(new THREE.SphereGeometry(1, 24, 10, 0, TAU, 0, PI * 0.6))), bagMat);
    bagU.position.set(bagBase.x, bagBase.y, bagBase.z); bagU.scale.set(bagBase.rx, bagBase.ry, bagBase.rz); root.add(bagU);
    const bagL = new THREE.Mesh(inside(bagCol(new THREE.SphereGeometry(1, 24, 10, 0, TAU, PI * 0.4, PI * 0.6))), bagMat);
    bagL.position.set(...toJaw([bagBase.x, bagBase.y, bagBase.z])); bagL.scale.set(bagBase.rx, bagBase.ry, bagBase.rz); jawPiv.add(bagL);
    const plug = new THREE.Mesh(K.vc(new THREE.SphereGeometry(1, 16, 10)), K.std(deep.map(v => v * 0.8), { roughness: 1 }));
    plug.position.set(0, bagBase.y - bagBase.ry * 0.2, bagBase.z - bagBase.rz * 0.75); plug.scale.set(bagBase.rx * 0.9, bagBase.ry * 1.3, bagBase.rz * 0.45); root.add(plug);
    const bag = { set visible(v) { bagU.visible = bagL.visible = plug.visible = v; } };
    let tongue = null;
    if (mo.tongue !== false) {
      const T = Object.assign({ w: mw * 0.62, t: 0.42 * ms, L: 2.8 * ms }, mo.tongue || {});
      tongue = C.tongue(T);
      const tg = new THREE.Group(); const tp = toJaw([0, bagBase.y - bagBase.ry * 0.55, Mc[2] - T.L - (mo.tongueBack ?? 0.7) * ms]); tg.position.set(...tp); tg.add(tongue);
      tongue.userData.rest = tp; jawPiv.add(tg); tongue.userData.g = tg;
    }
    const fangs = [];
    if (mo.fangs) {
      const f = mo.fangs;
      for (const sd of [1, -1]) {
        const up = C.fang(f.r || 0.17 * ms, f.l || 0.6 * ms, f.col); up.position.set(sd * mw * (f.x ?? 0.55), Mc[1] + 0.05, Mc[2] - (f.back ?? 0.45) * ms); root.add(up); fangs.push(up);
        if (f.lower !== false) { const lw = C.fang((f.r || 0.17 * ms) * 0.8, (f.l || 0.6 * ms) * 0.7, f.col); lw.rotation.x = PI; const p = toJaw([sd * mw * (f.x ?? 0.55) * 0.8, Mc[1] - 0.2, Mc[2] - (f.back ?? 0.45) * ms - 0.2]); lw.position.set(...p); jawPiv.add(lw); }
      }
    }
    if (mo.incisors) {
      const f = mo.incisors;
      for (const sd of [1, -1]) { const t = C.incisor(f.w || 0.62 * ms, f.h || 1.0 * ms, f.d || 0.28 * ms, f.col); t.position.set(sd * (f.w || 0.62 * ms) * 0.53, Mc[1] + (f.y ?? 0.35) * ms, Mc[2] + (f.z ?? 0.12) * ms); t.rotation.x = f.rx ?? -0.12; root.add(t); }
    }
    let nose = null;
    if (spec.nose) {
      nose = C.nose(spec.nose); nose.position.set(...spec.nose.at); if (spec.nose.rx) nose.rotation.x = spec.nose.rx; root.add(nose);
    }
    let beak = null;
    if (spec.beak) {
      const b = spec.beak, rx = b.rx ?? 0.25; let at = b.at;
      if (b.onSurf !== false) { const c0 = spec.c, dx = at[0] - c0[0], dy = at[1] - c0[1], dz = at[2] - c0[2], l = Math.hypot(dx, dy, dz); const q = S.hit(dx, dy, dz, [0, 0, 0]); const k = b.sink ?? 0.35; at = [q[0] - dx / l * k, q[1] - dy / l * k, q[2] - dz / l * k]; }
      const up = C.beak(Object.assign({}, b, { lower: false })); up.position.set(...at); up.rotation.x = rx; root.add(up);
      const lw = C.beak(Object.assign({}, b, { lower: true, L: b.L * (b.lowL ?? 0.8), W: b.W * 0.92, T: b.T * (b.lowT ?? 0.75), hook: b.lowHook ?? 0.05, col: b.lowCol || b.col }));
      const lp = toJaw([at[0], at[1] - (b.gap ?? 0.12), at[2] - 0.15]); lw.position.set(...lp); lw.rotation.x = rx + (b.lowRx ?? 0.1); jawPiv.add(lw);
      beak = { up, lw };
    }
    const whisk = [];
    if (spec.whiskers) {
      const W2 = spec.whiskers;
      for (const sd of [1, -1]) {
        const grp = new THREE.Group(); const pc = [sd * W2.at[0], W2.at[1], W2.at[2]]; grp.position.set(...pc);
        const list = [];
        for (let i = 0; i < W2.n; i++) {
          const t = W2.n > 1 ? i / (W2.n - 1) : 0.5;
          const root2 = [sd * (W2.dx ?? 0.5) * (t - 0.5), (W2.dy ?? 1.0) * (0.5 - t), 0];
          list.push({ root: root2, dir: [sd * 1, lerp(W2.up ?? 0.3, W2.down ?? -0.35, t), W2.fwd ?? 0.25], len: W2.len * (1 - 0.12 * Math.abs(t - 0.4)), droop: W2.droop ?? 0.1, lift: 0.03 });
        }
        const mesh = C.whiskers(list, { col: W2.col, r0: W2.r0 });
        grp.add(mesh); root.add(grp); whisk.push(grp);
      }
    }
    const ears = [];
    if (spec.ears) {
      const EA = spec.ears;
      const e0 = C.ear(EA);
      let at = EA.at;
      if (EA.dir) { const c0 = spec.c, dx = EA.dir[0] - c0[0], dy = EA.dir[1] - c0[1], dz = EA.dir[2] - c0[2], l = Math.hypot(dx, dy, dz); const q = S.hit(dx, dy, dz, [0, 0, 0]); const sk = EA.sink ?? 0.3; at = [q[0] - dx / l * sk, q[1] - dy / l * sk, q[2] - dz / l * sk]; }
      for (const sd of [1, -1]) {
        const e = sd > 0 ? e0 : C.cloneEar(e0);
        const holder = new THREE.Group(); holder.position.set(sd * at[0], at[1], at[2]);
        holder.rotation.set(EA.rot[0], EA.rot[1] * sd, EA.rot[2] * sd, 'YXZ');
        if (sd < 0 && EA.mirror) holder.scale.x = -1;
        holder.add(e.piv); root.add(holder); e.sd = sd; e.holder = holder; ears.push(e);
      }
    }
    mark('parts'); root.userData.timings = tm;
    K.finish(root);
    const fit = spec.fit === false ? null : (spec.fit || C.HEAD_FIT);
    if (fit) { const k = fit.s, q = fit.p; root.scale.set(k[0], k[1], k[2]); root.position.set(q[0] * (1 - k[0]), q[1] * (1 - k[1]), q[2] * (1 - k[2])); }
    const ctx = { root, S, head, eyes, ears, nose, beak, whisk, jawPiv, bag, bagBase, tongue, fangs, Mc, CL, CR, J, theta, spec, sampleCol, eyeC, er, ms, cx };
    if (spec.extra) await spec.extra(ctx, K, C);
    root.userData.ctx = ctx;
    return ctx;
  };
  C.rig = (ctx, opt = {}) => {
    const ex = K.makeExpr(), mot = K.makeMotion(ctx.root);
    const spEar = mot.spring(opt.earK ?? 55, opt.earC ?? 6, 1, 4), spFur = mot.spring(30, 5, 1, 3), spWh = mot.spring(90, 7, 1, 2);
    const lod = K.makeFurLOD(opt.lodRoot || ctx.root);
    const st = { ex, mot, t0: null, lod };
    const seed = opt.seed || 1;
    const twitch = (t, k) => { const ph = t * 0.37 + k * 1.7 + seed; const f = ph - Math.floor(ph); return f < 0.08 ? Math.sin(f / 0.08 * PI) : 0; };
    st.update = (bs, t, snap) => {
      const e = ex.update(bs, t, snap); const dt = e.dt; mot.update(dt, snap); lod.update(snap ? 0 : dt);
      const h = ctx.head;
      const jaw = Math.max(e.jaw, e.tongue * 0.32, e.funnel * 0.35, (opt.restTongue || 0) * 0.32);
      h.set('jaw', jaw);
      h.set('smileL', e.smileL); h.set('smileR', e.smileR);
      h.set('frownL', e.frownL * (1 - e.smileL)); h.set('frownR', e.frownR * (1 - e.smileR));
      h.set('pucker', Math.max(e.pucker, e.funnel * 0.7) * (1 - jaw * 0.5));
      h.set('puff', e.puff);
      h.set('browUpL', e.browUpL); h.set('browUpR', e.browUpR); h.set('browDnL', e.browDnL); h.set('browDnR', e.browDnR);
      h.set('sneer', Math.max(e.sneerL, e.sneerR));
      const th = ctx.theta * jaw;
      ctx.jawPiv.rotation.x = th;
      ctx.bag.visible = jaw > 0.015;
      if (ctx.tongue) {
        const tg = ctx.tongue.userData.g, r = ctx.tongue.userData.rest, to = Math.max(e.tongue, (opt.restTongue || 0) * (1 - e.jaw));
        tg.position.set(r[0], r[1] + to * 0.35 * ctx.ms, r[2] + to * (ctx.spec.mouth.tongueOut ?? 3.4) * ctx.ms); tg.rotation.x = to * 0.5 - jaw * 0.05; tongueScale(tg, 1 + to * 0.3); tg.visible = jaw > 0.015 || to > 0.02;
      }
      const sq = e.smile * 0.85;
      for (let k = 0; k < ctx.eyes.length; k++) { const ey = ctx.eyes[k];
        const L = ey.side > 0;
        const bl = L ? e.blinkL : e.blinkR, sqz = Math.max(sq, (L ? e.squintL : e.squintR) * 0.5), wd = L ? e.wideL : e.wideR;
        const bd = L ? e.browDnL : e.browDnR;
        const tilt = bd * 1.25 - e.browIn * 0.9 + (opt.restTilt || 0);
        ey.set(Math.max(bl, bd * 0.22), Math.max(sqz, bd * 0.3) * (1 - bl), Math.max(wd, (L ? e.browUpL : e.browUpR) * 0.35), tilt, e.gx, e.gy);
      }
      if (ctx.nose) { const sn = Math.max(e.sneerL, e.sneerR); const n0 = ctx.spec.nose.at; ctx.nose.position.set(n0[0], n0[1] + sn * 0.35 + e.smile * 0.12 + Math.sin(t * 11) * (opt.sniff || 0) * (0.5 + 0.5 * Math.sin(t * 0.9)), n0[2]); }
      const wx = spWh.x;
      for (let i = 0; i < ctx.whisk.length; i++) { const w = ctx.whisk[i]; const sd = i === 0 ? 1 : -1; const sm = sd > 0 ? e.smileL : e.smileR; w.rotation.z = sd * (sm * 0.32 - e.frown * 0.2 + Math.sin(t * 1.3 + i) * 0.02 + wx.y * 0.08); w.rotation.y = -sd * (e.pucker * 0.25 + wx.x * 0.05); }
      const ex2 = spEar.x;
      for (let i = 0; i < ctx.ears.length; i++) { const ea = ctx.ears[i];
        const sd = ea.sd, tw = twitch(t, i) * (opt.twitch ?? 0.25);
        const back = e.browDn * (opt.earBack ?? 0.5) - e.browUp * (opt.earPerk ?? 0.25) + (opt.earFrown ?? 0) * e.frown;
        ea.piv.rotation.x = -back + ex2.z * 0.06 + tw * 0.4;
        ea.piv.rotation.z = sd * (-back * 0.35 + ex2.x * 0.06 * sd) + tw * 0.25 * sd;
        ea.piv.rotation.y = ex2.x * 0.03;
        if (ea.part.names.lift !== undefined) ea.part.set('lift', clamp(e.browUp * 1.2 + e.smile * 0.2));
        if (ea.part.names.droop !== undefined) ea.part.set('droop', clamp(Math.max(e.frown, e.browDn) * 1.3));
      }
      const lag = h.U.uLag.value; lag.copy(spFur.x).multiplyScalar(-0.25).addScaledVector(mot.grav, ctx.spec.fur?.grav ?? 0.25);
      for (let i = 0; i < ctx.ears.length; i++) ctx.ears[i].part.U.uLag.value.copy(lag);
      if (opt.extra) opt.extra(e, t, dt, mot);
      return e;
    };
    const tongueScale = (g, s) => { g.scale.set(1, 1, s); };
    return st;
  };
  return C;
}
function PRESETS(THREE, H, K, C) {
  const { PI, clamp, lerp, sst, lerpC } = K;
  const P = {};
  const blob = K.blob, sdEll = K.sdEll, smin = K.smin, smax = K.smax;
  const eyeDist = (x, y, z, cx) => { let d = 1e9; for (const e of cx.eyeC) { const dx = x - e[0], dy = (y - e[1]) * 0.95, dz = z - e[2]; d = Math.min(d, Math.sqrt(dx * dx + dy * dy + dz * dz)); } return d / cx.er; };
  P.eyeDist = eyeDist;
  P.mouthMasks = (x, y, z, info, cx, o = {}) => {
    const S = cx.S, phi = info.phi, a = Math.abs(phi);
    const R = Math.hypot(x - S.c[0], y - S.c[1], z - S.c[2]);
    const d = (info.lat - S.latOf(S.iM, phi)) * R;
    const inMouth = sst(S.phiC * 1.08, S.phiC * 0.86, a);
    const line = sst(o.lw ?? 0.27, 0.05, Math.abs(d)) * inMouth;
    const nose = cx.noseAt;
    const phil = sst(o.pw ?? 0.13, 0.03, Math.abs(x)) * sst(cx.Mc[1] - 0.1, cx.Mc[1] + 0.3, y) * sst(nose[1] - 0.2, nose[1] - 0.7, y) * sst(cx.Mc[2] - 2.5, cx.Mc[2] - 1, z);
    const lips = sst(0.9, 0.2, Math.abs(d)) * inMouth;
    const r = P._mm; r.d = d; r.line = line; r.phil = phil; r.lips = lips; r.inMouth = inMouth; return r;
  };
  P._mm = { d: 0, line: 0, phil: 0, lips: 0, inMouth: 0 };
  P.tabby = (x, y, z, info, o) => {
    const phi = info.phi, lat = info.lat, w = o.wobble ?? 0.35;
    const n1 = K.fbm(x * 0.22 + 3, y * 0.22, z * 0.22, 2) - 0.5, n2 = K.vnoise(x * 0.5, y * 0.5 + 7, z * 0.5) - 0.5;
    const thin = o.thin ?? 0.62;
    const crownF = o.crownF ?? 15, cs = Math.cos(crownF * phi * (0.75 + 0.25 * Math.cos(lat)) + n1 * 4 * w);
    const crown = sst(thin, thin + 0.22, cs) * sst(0.32, 0.62, lat) * (o.crown ?? 1);
    const sideF = o.sideF ?? 13, ss = Math.cos(sideF * lat + 2.2 * Math.sin(Math.abs(phi) * 1.6) + n1 * 5 * w + 1.3);
    const sideW = sst(0.55, 1.0, Math.abs(phi)) * sst(0.75, 0.35, lat) * sst(-1.2, -0.6, lat);
    const side = sst(thin + 0.04, thin + 0.25, ss) * sideW * (o.side ?? 1);
    const cheek = o.cheek ? sst(0.82, 0.95, Math.cos(22 * (lat - 0.06 - 0.12 * Math.abs(phi)) + n2 * 2)) * sst(0.45, 0.65, Math.abs(phi)) * sst(1.25, 0.9, Math.abs(phi)) * sst(-0.25, -0.05, lat) * sst(0.35, 0.18, lat) * o.cheek : 0;
    return clamp(Math.max(crown, side, cheek) * (0.75 + 0.5 * n2 + 0.25));
  };
  P.shapes = {
    feline(o) {
      const flat = o.flat || 0, fl = o.fluff || 0, muzZ = 6.6 - flat * 1.4, padZ = 9.4 - flat * 1.6;
      return {
        prims: [
          [[0, 3.4, -2.6], [11.2 + fl * 0.6, 10.4, 10.6], 0],
          [[0, 5.4, 4.2], [7.2, 4.6, 4.6], 3],
          [[6.0 + fl, -2.6 - fl * 0.4, 2.4], [6.0 + fl * 1.4, 5.2 + fl * 0.6, 6.2 + fl * 0.4], 3.5],
          [[-(6.0 + fl), -2.6 - fl * 0.4, 2.4], [6.0 + fl * 1.4, 5.2 + fl * 0.6, 6.2 + fl * 0.4], 3.5],
          [[0, -7.6, 1.0], [8.0 + fl, 4.0, 6.5], 3.5],
          [[0, -1.6, muzZ], [4.6, 3.8, 3.9], 2.5],
          [[1.5, -2.9, padZ], [2.2, 1.75, 1.7], 1.0], [[-1.5, -2.9, padZ], [2.2, 1.75, 1.7], 1.0],
          [[0, -5.3, padZ - 1.4], [2.2, 1.4, 1.6], 1.2],
          [[3.9, 4.5, 6.9 - flat * 0.6], [3.0, 1.6, 2.2], 1.8], [[-3.9, 4.5, 6.9 - flat * 0.6], [3.0, 1.6, 2.2], 1.8],
        ],
        caps: [[[0, 2.2, 8.6 - flat * 1.2], [0, -0.6, 10.3 - flat * 1.5], 1.6, 2.0]],
        padZ, eyePos: [4.2 + fl * 0.2, 1.6, 7.25 - flat * 0.5], noseAt: [0, -0.72 + flat * 0.25, 10.95 - flat * 1.55],
        mouthAt: [0, -4.3, 10.5], pivot: [0, -1.2, -2.0], whiskAt: [2.05, -2.95, padZ + 1.2],
        M1: [[0, -2.9, padZ], [3.7, 2.2, 2.6]], M2: [[0, -5.3, padZ - 1.4], [3.2, 2.4, 3]], M3: [[0, -8.6, 3.5], [6.5, 3.2, 6]], M4: [[0, -2.4, padZ + 0.3], [3.6, 2.4, 2.2]],
      };
    },
    canine(o) {
      const sn = o.snout ?? 0, fl = o.fluff || 0, padZ = 10.4 + sn;
      return {
        prims: [
          [[0, 3.6, -2.8], [10.8 + fl * 0.6, 10.2, 10.4], 0],
          [[0, 5.6, 3.8], [7.0, 4.4, 4.6], 3],
          [[5.8 + fl * 0.5, -1.8 - fl * 0.3, 2.4], [5.6 + fl, 4.8 + fl * 0.5, 6.0], 3.5], [[-(5.8 + fl * 0.5), -1.8 - fl * 0.3, 2.4], [5.6 + fl, 4.8 + fl * 0.5, 6.0], 3.5],
          [[0, -7.2, 0.8], [7.6 + fl, 4.2, 6.6], 3.5],
          [[0, -1.9, 7.6 + sn * 0.6], [4.1 - sn * 0.25, 3.3 - sn * 0.15, 4.2 + sn * 0.6], 2.2],
          [[1.7, -3.0, padZ], [2.4, 1.9, 2.0], 1.2], [[-1.7, -3.0, padZ], [2.4, 1.9, 2.0], 1.2],
          [[0, -5.0, padZ - 1.2], [2.2, 1.4, 1.8], 1.2],
          [[3.8, 4.6, 6.6], [3.0, 1.6, 2.2], 1.8], [[-3.8, 4.6, 6.6], [3.0, 1.6, 2.2], 1.8],
        ],
        caps: [[[0, 2.4, 7.8], [0, -0.1, 11.4 + sn], 1.9, 2.0]],
        padZ, eyePos: [4.05, 1.9, 7.3], noseAt: [0, -0.35, 12.5 + sn],
        mouthAt: [0, -4.4, 11.9 + sn], pivot: [0, -1.0, -1.5], whiskAt: [2.3, -2.9, padZ + 1.3],
        M1: [[0, -2.8, padZ], [3.9, 2.4, 3.0]], M2: [[0, -5.0, padZ - 1.2], [3.0, 2.2, 2.8]], M3: [[0, -8.4, 3.5], [6.5, 3.4, 6]], M4: [[0, -2.2, padZ + 0.4], [3.8, 2.6, 2.6]],
      };
    },
    bird(o) {
      const fl = o.fluff || 0, flat = o.flat || 0;
      return {
        prims: [
          [[0, 3.0, -2.4], [11.0 + fl * 0.5, 10.6 + fl * 0.2, 10.6], 0],
          [[0, 0.8, 3.2 - flat], [8.6 + fl * 0.4, 7.8, 6.6], 3],
          [[5.6 + fl * 0.6, -2.4, 2.6], [5.4 + fl, 5.2, 5.8], 3.5], [[-(5.6 + fl * 0.6), -2.4, 2.6], [5.4 + fl, 5.2, 5.8], 3.5],
          [[0, -7.0, 1.0], [7.8 + fl, 4.2, 6.4], 3.5],
          [[0, -1.6, 8.0 - flat * 1.2], [2.6, 2.2, 2.4], 2.2],
          [[3.9, 4.3, 6.6 - flat * 0.6], [3.0, 1.5, 2.0], 1.8], [[-3.9, 4.3, 6.6 - flat * 0.6], [3.0, 1.5, 2.0], 1.8],
        ],
        caps: [],
        padZ: 8.6 - flat, eyePos: [4.1, 1.7, 7.2 - flat * 0.6], noseAt: [0, -1.2, 10.1 - flat * 1.2],
        mouthAt: [0, -2.2, 10.0 - flat * 1.2], pivot: [0, -0.4, -2.0], whiskAt: [2.0, -2.4, 9.6],
        M1: [[0, -1.8, 9.6], [1.6, 1.2, 1.4]], M2: [[0, -4.0, 8.4], [2.6, 1.8, 2.4]], M3: [[0, -8.6, 3.5], [6.5, 3.2, 6]], M4: [[0, -1.6, 9.8], [2.2, 1.8, 1.8]],
      };
    },
  };
  P.feline = (o) => P.critter(Object.assign({ shape: 'feline' }, o));
  P.canine = (o) => P.critter(Object.assign({ shape: 'canine' }, o));
  P.critter = (o) => {
    const SH = typeof o.shape === 'string' ? P.shapes[o.shape](o) : o.shape;
    if (o.shapeEdit) o.shapeEdit(SH);
    const er = o.eyeR || 2.3, padZ = SH.padZ;
    const eyePos = o.eyePos || SH.eyePos;
    const Pc = SH.prims.slice(); if (o.prims) Pc.push(...o.prims);
    const caps = SH.caps;
    const sdf = (x, y, z) => {
      let d = sdEll(x, y, z, Pc[0][0], Pc[0][1]);
      for (let i = 1; i < Pc.length; i++) { const q = Pc[i]; d = q[2] > 0 ? smin(d, sdEll(x, y, z, q[0], q[1]), q[2]) : K.smax(d, -sdEll(x, y, z, q[0], q[1]), -q[2]); }
      for (let i = 0; i < caps.length; i++) { const q = caps[i]; d = smin(d, K.sdCap(x, y, z, q[0], q[1], q[2]), q[3]); }
      if (o.sdfExtra) d = o.sdfExtra(x, y, z, d);
      return d;
    };
    const noseAt = o.noseAt || SH.noseAt;
    const light = o.light, base = o.base, dark = o.dark || base.map(v => v * 0.35);
    const [M1c, M1r] = SH.M1, [M2c, M2r] = SH.M2, [M3c, M3r] = SH.M3, [M4c, M4r] = SH.M4;
    if (o.mask) { o.mask.c = o.mask.c || [0, -1.2, 9.5]; o.mask.r = o.mask.r || [6, 5.5, 5]; }
    const lipC = o.lip || [0.32, 0.22, 0.22];
    const cc = [0, 0, 0], tmpC = [0, 0, 0];
    const mixIn = K.mixIn;
    const color = (x, y, z, info, out, cx) => {
      const n = K.vnoise(x * 0.3, y * 0.3, z * 0.3);
      const c = K.setC(cc, base); if (o.base2) mixIn(c, o.base2, n);
      const sh = sst(0.2, 1.2, info.ny) * sst(0.4, -0.6, info.nz) * 0.6; if (sh > 0) K.mulC(c, 1 - 0.12 * sh);
      if (o.stripes) mixIn(c, dark, P.tabby(x, y, z, info, o.stripes) * (o.stripes.k ?? 0.85));
      const ed = eyeDist(x, y, z, cx);
      let lm = Math.max(blob(x, y, z, M1c, M1r, 0.45), blob(x, y, z, M2c, M2r, 0.5), blob(x, y, z, M3c, M3r, 0.5) * (o.throat ?? 1));
      lm = Math.max(lm * (o.muzzleK ?? 1), (o.rimK ?? 0.3) * sst(1.6, 1.15, ed));
      if (o.lightFace) lm = Math.max(lm, o.lightFace(x, y, z, info, cx));
      mixIn(c, light, clamp(lm));
      if (o.mask) { const mk = o.mask; const m = Math.max(blob(x, y, z, mk.c, mk.r, mk.soft ?? 0.6), mk.eyes ? mk.eyes * sst(2.4, 1.2, ed) : 0); mixIn(c, mk.col, clamp(m * (mk.k ?? 1))); }
      if (o.paint) o.paint(x, y, z, info, c, cx, ed);
      const mm = P.mouthMasks(x, y, z, info, cx);
      mixIn(c, lipC, Math.max(mm.line, mm.phil * 0.8));
      let f = o.furBase ?? 1;
      if (o.furMap) f = o.furMap(x, y, z, info, cx, f, ed);
      f *= sst(1.02, 1.12, ed) * lerp(0.3, 1, sst(1.12, 1.9, ed));
      f *= lerp(1, o.muzzleFur ?? 0.55, blob(x, y, z, M4c, M4r, 0.5));
      f *= 1 - mm.lips * 0.75;
      const dn = Math.hypot(x - noseAt[0], (y - noseAt[1]) * 1.2, z - noseAt[2]); f *= sst(0.9, 1.9, dn);
      out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; out[3] = f; out[4] = 0;
    };
    const fur = Object.assign({ shells: 14, len: 1.0, rep: [20, 10], root: 0.5, tip: 1.02, grav: 0.25 }, o.fur || {});
    const ear = Object.assign({
      kind: 'pointy', L: 7.4, W: 3.6, T: 0.6, D: 1.0, back: 0.5, rho: 0.12, dir: [6.4, 9.6, -0.3], sink: 0.35, rot: [-0.12, 0.28, -0.38],
      out: o.earOut || base, inn: o.earIn || [0.8, 0.48, 0.48], tuft: o.earTuft || lerpC(light, base, 0.35), tip: o.earTip, rim: o.earRim,
      fur: { shells: 8, len: 0.55, rep: [4, 6], root: 0.62, tip: 1.1 }, furIn: 1, innerSide: 1, nu: 24, nv: 16,
    }, o.ear || {});
    const spec = {
      c: [0, 1.5, -1.5], rmax: 26, nu: 72, nv: 48, sdf, color, fur,
      eyes: Object.assign({ r: er, pos: eyePos, yaw: 0.2, pitch: -0.04, roll: 0.06, iris: o.iris, pupil: o.pupil ?? 0.5, slit: !!o.slit, ir: o.ir ?? 0.4, lash: o.lash || [0.14, 0.1, 0.08], lashW: 0.085, socket: 1.09, openU: -0.92, openL: 1.02, closeU: 0.3, closeL: -0.3, lidK: 0.8, seed: 3 }, o.eye || {}),
      mouth: Object.assign({ at: SH.mouthAt, m: 6, amp: 0.028, pivot: SH.pivot, open: 0.42, pinch: 0.14, fangs: { r: 0.16, l: 0.55, x: 0.55, back: 0.35, lower: false }, tongue: {}, deep: [0.16, 0.035, 0.045], edge: [0.45, 0.14, 0.16] }, o.mouth || {}),
      nose: o.nose === false ? null : Object.assign({ kind: 'cat', at: noseAt, w: 1.05, h: 0.74, d: 0.66, col: o.noseCol || [0.84, 0.5, 0.52], rx: 0.22 }, o.nose || {}),
      whiskers: o.whiskers === false ? null : Object.assign({ at: SH.whiskAt, n: 4, len: 8.5, col: o.whiskerCol || [0.9, 0.88, 0.84], up: 0.32, down: -0.32, fwd: 0.18, droop: 0.12, dy: 1.1, dx: 0.5 }, o.whisk || {}),
      ears: o.ears === false ? null : ear, combFrom: o.combFrom || [0, -1.5, 16], extra: o.extra, deform: o.deform, morphs: o.morphs, SH,
      beak: o.beak ? Object.assign({ at: noseAt, L: 2.4, W: 0.8, T: 1.0, hook: 0.3, rx: 0.3 }, o.beak) : null,
    };
    return spec;
  };
  P.placeEars = (ctx) => {
    const ea = ctx.spec.ears; if (!ea || !ea.dir) return;
  };
  return P;
}
function LENS(THREE, H, K, C) {
  const { PI, TAU, clamp, lerp, sst, lerpC } = K;
  const L = {};
  const SK = [0, 1.5, -3.8], SR = [7.4, 8.9, 7.5];
  L.capPoint = (dir, hair = 1.6) => {
    const l = Math.hypot(dir[0] / SR[0], dir[1] / SR[1], dir[2] / SR[2]);
    const d = [dir[0] / l, dir[1] / l, dir[2] / l]; const dl = Math.hypot(...d);
    return [SK[0] + d[0] + d[0] / dl * hair, SK[1] + d[1] + d[1] / dl * hair, SK[2] + d[2] + d[2] / dl * hair];
  };
  L.ears = (g, o) => {
    const e0 = C.ear(o), out = [];
    const at = L.capPoint(o.dir, o.hair ?? 1.2);
    for (const sd of [1, -1]) {
      const e = sd > 0 ? e0 : C.cloneEar(e0);
      const holder = new THREE.Group(); holder.position.set(sd * at[0], at[1], at[2]);
      holder.rotation.set(o.rot[0], o.rot[1] * sd, o.rot[2] * sd, 'YXZ');
      if (sd < 0 && o.mirror) holder.scale.x = -1;
      holder.add(e.piv); g.add(holder); e.sd = sd; e.holder = holder; out.push(e);
    }
    return out;
  };
  L.anchors = (g, ids) => K.makeLive(g, ids);
  L.decals = (g, spots, o = {}) => {
    const fm = H.face, P = fm.pos, I = fm.idx, nT = I.length / 3;
    const tri = [], bw = [];
    const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), q = new THREE.Vector3(), cp = new THREE.Vector3(), T = new THREE.Triangle(), bc = new THREE.Vector3();
    for (const s of spots) {
      q.set(...s.c); let best = 1e9, bt = 0;
      for (let t = 0; t < nT; t++) {
        v0.fromArray(P, I[t * 3] * 3); v1.fromArray(P, I[t * 3 + 1] * 3); v2.fromArray(P, I[t * 3 + 2] * 3); T.set(v0, v1, v2); T.closestPointToPoint(q, cp);
        const d = cp.distanceToSquared(q); if (d < best) { best = d; bt = t; }
      }
      v0.fromArray(P, I[bt * 3] * 3); v1.fromArray(P, I[bt * 3 + 1] * 3); v2.fromArray(P, I[bt * 3 + 2] * 3); T.set(v0, v1, v2); T.closestPointToPoint(q, cp); T.getBarycoord(cp, bc);
      tri.push(I[bt * 3], I[bt * 3 + 1], I[bt * 3 + 2]); bw.push(bc.x, bc.y, bc.z);
    }
    const SEG = 10, nv = spots.length * (SEG + 1);
    const pos = new Float32Array(nv * 3), col = new Float32Array(nv * 4), idx = [];
    const cc = new THREE.Color();
    spots.forEach((s, k) => {
      const b = k * (SEG + 1); cc.setRGB(...s.col, THREE.SRGBColorSpace);
      for (let i = 0; i <= SEG; i++) { col.set([cc.r, cc.g, cc.b, i === 0 ? s.a : s.a * (s.edge ?? 0)], (b + i) * 4); }
      for (let i = 0; i < SEG; i++) idx.push(b, b + 1 + i, b + 1 + (i + 1) % SEG);
    });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 4)); geo.setIndex(idx);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 2; g.add(mesh);
    const ids = [...new Set(tri)];
    const live = K.makeLive(g, ids);
    const a = new THREE.Vector3(), b2 = new THREE.Vector3(), c2 = new THREE.Vector3(), n = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), p = new THREE.Vector3();
    const st = {
      mesh, live,
      update(scale = 1) {
        live.update(0.7);
        spots.forEach((s, k) => {
          a.copy(live.P[tri[k * 3]]); b2.copy(live.P[tri[k * 3 + 1]]); c2.copy(live.P[tri[k * 3 + 2]]);
          p.set(0, 0, 0).addScaledVector(a, bw[k * 3]).addScaledVector(b2, bw[k * 3 + 1]).addScaledVector(c2, bw[k * 3 + 2]);
          t1.subVectors(b2, a); t2.subVectors(c2, a); n.crossVectors(t1, t2).normalize(); if (n.z < 0) n.negate();
          t1.normalize(); t2.crossVectors(n, t1);
          p.addScaledVector(n, o.lift ?? 0.06);
          const base = k * (SEG + 1); pos[base * 3] = p.x; pos[base * 3 + 1] = p.y; pos[base * 3 + 2] = p.z;
          const r = s.r * scale, ry = s.ry ? s.ry * scale : r;
          for (let i = 0; i < SEG; i++) { const an = TAU * i / SEG, cx = Math.cos(an) * r, cy = Math.sin(an) * ry; const j = (base + 1 + i) * 3; pos[j] = p.x + t1.x * cx + t2.x * cy; pos[j + 1] = p.y + t1.y * cx + t2.y * cy; pos[j + 2] = p.z + t1.z * cx + t2.z * cy; }
        });
        geo.attributes.position.needsUpdate = true;
      },
    };
    st.update();
    return st;
  };
  L.scatter = (seed, n, regions, o = {}) => {
    const r = K.rng(seed), out = [];
    let guard = 0;
    while (out.length < n && guard++ < n * 50) {
      const R = regions[Math.floor(r() * regions.length)];
      const ang = r() * TAU, rad = Math.sqrt(r());
      const x = R.c[0] + Math.cos(ang) * rad * R.r[0], y = R.c[1] + Math.sin(ang) * rad * R.r[1];
      if (out.some(s => Math.hypot(s.c[0] - x, s.c[1] - y) < (o.minD ?? 0.55))) continue;
      out.push({ c: [x, y, 10], r: lerp(o.r0 ?? 0.12, o.r1 ?? 0.24, r()), col: o.col, a: lerp(o.a0 ?? 0.55, o.a1 ?? 0.85, r()), edge: o.edge ?? 0.0 });
    }
    const P = H.face.pos;
    for (const s of out) { let best = 1e9, bz = 4; for (let i = 0; i < 468; i++) { const d = Math.hypot(P[i * 3] - s.c[0], P[i * 3 + 1] - s.c[1]); if (d < best) { best = d; bz = P[i * 3 + 2]; } } s.c[2] = bz; }
    return out;
  };
  L.hangTongue = (o = {}) => {
    const w = o.w || 1.55, th = o.t || 0.36;
    const sec = (s) => { const p = Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, (s - 0.62) / 0.38), 2))); return { w: w * (0.82 + 0.25 * s) * p + 0.02, t: th * (1 - 0.25 * s) * p + 0.02, tf: 0.7, d: 0.16 * p }; };
    const refs = [[0, 0, 1], [0, 0.4, 1], [0, 1, 0.6], [0, 1, 0.3], [0, 1, 0.2]];
    const short = K.makePath([[0, 0.25, -0.5], [0, 0.15, 0.45], [0, -0.45, 1.0], [0, -1.3, 1.15], [0, -2.1, 1.1]], refs);
    const long = K.makePath([[0, 0.25, -0.5], [0, 0.1, 0.55], [0, -1.2, 1.25], [0, -3.6, 1.35], [0, -6.2, 1.15]], refs);
    const swing = K.makePath([[0, 0.25, -0.5], [0.1, 0.1, 0.55], [0.9, -1.2, 1.2], [2.0, -3.4, 1.2], [3.0, -5.6, 1.0]], refs);
    const m = K.tubeMesh(short, sec, 18, 16, 0);
    const morphs = [K.tubeMorph('long', long, sec), K.tubeMorph('swing', swing, sec)];
    const g = K.toGeometry(m, morphs);
    const P0 = Float32Array.from(g.attributes.position.array), N0 = Float32Array.from(g.attributes.normal.array);
    const DP = g.morphAttributes.position.map(a => a.array), DN = g.morphAttributes.normal.map(a => a.array);
    g.morphAttributes = {}; const W = [0, 0];
    const col = o.col || [0.88, 0.4, 0.45];
    g.setAttribute('color', K.vcol(m, (x, y, z, v, mm, out) => { const u = mm.uOf(v), a = TAU * u; const top = Math.cos(a) > 0; const groove = top ? sst(0.22, 0.0, Math.abs(Math.sin(a))) : 0; const c = lerpC(col, col.map(q => q * 0.7), groove * 0.8 + (top ? 0 : 0.25)); out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; }));
    const mesh = new THREE.Mesh(g, K.vcMat({ roughness: 0.3 }));
    mesh.frustumCulled = false;
    mesh.userData.blend = (w0, w1) => {
      if (Math.abs(w0 - W[0]) < 1e-3 && Math.abs(w1 - W[1]) < 1e-3) return; W[0] = w0; W[1] = w1;
      const p = g.attributes.position.array, nr = g.attributes.normal.array;
      for (let i = 0; i < p.length; i++) { p[i] = P0[i] + DP[0][i] * w0 + DP[1][i] * w1; nr[i] = N0[i] + DN[0][i] * w0 + DN[1][i] * w1; }
      g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
    };
    return mesh;
  };
  L.build = async (g, cfg) => {
    const ctx = { g, ears: [], cfg };
    if (cfg.ears) ctx.ears = L.ears(g, cfg.ears);
    await K.yieldUI();
    if (cfg.nose) { ctx.nose = C.nose(cfg.nose); ctx.nose.rotation.x = cfg.nose.rx || 0; g.add(ctx.nose); }
    if (cfg.whiskers) {
      const W = cfg.whiskers; ctx.whisk = [];
      for (const sd of [1, -1]) {
        const grp = new THREE.Group(), list = [];
        for (let i = 0; i < W.n; i++) { const t = W.n > 1 ? i / (W.n - 1) : 0.5; list.push({ root: [sd * 0.25 * i, (W.dy ?? 0.5) * (0.5 - t), 0], dir: [sd, lerp(W.up ?? 0.28, W.down ?? -0.3, t), W.fwd ?? 0.12], len: W.len * (1 - 0.1 * Math.abs(t - 0.4)), droop: W.droop ?? 0.06, lift: 0.02 }); }
        grp.add(C.whiskers(list, { col: W.col, r0: W.r0 ?? 0.05, r1: 0.012 })); g.add(grp); ctx.whisk.push(grp);
      }
    }
    if (cfg.tongue) { ctx.tongue = L.hangTongue(cfg.tongue); ctx.tongueG = new THREE.Group(); ctx.tongueG.add(ctx.tongue); g.add(ctx.tongueG); }
    if (cfg.teeth) { const T = cfg.teeth; ctx.teeth = new THREE.Group(); for (const sd of [1, -1]) { const t = C.incisor(T.w, T.h, T.d, T.col); t.position.x = sd * T.w * 0.53; ctx.teeth.add(t); } g.add(ctx.teeth); }
    if (cfg.decals) ctx.decals = L.decals(g, cfg.decals, cfg.decalOpt || {});
    const lod = K.makeFurLOD(g);
    const ex = K.makeExpr(), mot = K.makeMotion(g), spE = mot.spring(48, 5, 1, 4), spT = mot.spring(26, 3.2, 1.2, 5), spW = mot.spring(90, 7, 1, 2);
    const ids = [1, 4, 13, 14, 17, 0, 61, 291, 423, 203, 205, 425, 98, 327];
    const live = K.makeLive(g, ids);
    const v = new THREE.Vector3(), lip = new THREE.Vector3(), up = new THREE.Vector3();
    const seed = cfg.seed || 1;
    const twitch = (t, k) => { const ph = t * 0.31 + k * 1.9 + seed; const f = ph - Math.floor(ph); return f < 0.07 ? Math.sin(f / 0.07 * PI) : 0; };
    ctx.update = (bs, t, snap) => {
      const e = ex.update(bs, t, snap); mot.update(e.dt, snap); live.update(snap ? 1 : 0.65); lod.update(snap ? 0 : e.dt);
      const P = live.P, ok = live.ok;
      if (ctx.nose) { const o = cfg.nose.off || [0, 0.1, 0.3]; const sn = Math.max(e.sneerL, e.sneerR); ctx.nose.position.set(P[1].x + o[0], P[1].y + o[1] + sn * 0.25 + (cfg.wiggle ? Math.sin(t * 13) * cfg.wiggle * (0.4 + 0.6 * Math.max(0, Math.sin(t * 1.1))) : 0), P[1].z + o[2]); const s2 = 1 + e.puff * 0.08; ctx.nose.scale.setScalar(s2); }
      if (ctx.whisk) {
        const W = cfg.whiskers;
        for (let i = 0; i < ctx.whisk.length; i++) { const w = ctx.whisk[i];
          const sd = i === 0 ? 1 : -1; const a = P[sd > 0 ? 423 : 203], b = P[sd > 0 ? 425 : 205];
          w.position.set(lerp(a.x, b.x, W.k ?? 0.35) + sd * (W.ox ?? 0.2), lerp(a.y, b.y, W.k ?? 0.35) + (W.oy ?? 0), lerp(a.z, b.z, W.k ?? 0.35) + (W.oz ?? 0.3));
          const sm = sd > 0 ? e.smileL : e.smileR;
          w.rotation.z = sd * (sm * 0.38 - e.frown * 0.2 + Math.sin(t * 1.4 + i * 2) * 0.025 + twitch(t, i + 3) * 0.12 + spW.x.y * 0.06);
          w.rotation.y = -sd * (e.pucker * 0.3);
        }
      }
      if (ctx.tongue) {
        lip.copy(P[14]); if (!ok) lip.y -= e.jaw * 2.4;
        const open = sst(0.3, 0.62, Math.max(e.jaw, e.tongue * 1.2)), ext = sst(0.45, 0.95, Math.max(e.jaw, e.tongue * 1.1));
        ctx.tongueG.visible = open > 0.02;
        const o = cfg.tongue.off || [0, -0.05, 0.25];
        ctx.tongueG.position.set(lip.x + o[0], lip.y + o[1], lip.z + o[2]);
        ctx.tongueG.scale.setScalar(lerp(0.4, 1, open));
        const sw = clamp(spT.x.x * 0.35 + Math.sin(t * 2.2) * 0.12 * ext, -1, 1);
        ctx.tongue.userData.blend(ext, Math.max(0, sw)); ctx.tongueG.scale.x = (sw < 0 ? -1 : 1) * Math.abs(ctx.tongueG.scale.x);
        ctx.tongueG.rotation.x = -spT.x.y * 0.05 + (ok ? 0 : 0);
      }
      if (ctx.teeth) { const T = cfg.teeth; up.copy(P[13]); const o = T.off || [0, 0.15, 0.3]; ctx.teeth.position.set(up.x + o[0], up.y + o[1], up.z + o[2]); ctx.teeth.scale.setScalar(1 + e.jaw * 0.1); }
      for (let i = 0; i < ctx.ears.length; i++) { const ea = ctx.ears[i];
        const sd = ea.sd, tw = twitch(t, i) * (cfg.twitch ?? 0.22), x2 = spE.x;
        const back = e.browDn * (cfg.earBack ?? 0.35) - e.browUp * (cfg.earPerk ?? 0.2);
        ea.piv.rotation.x = -back + x2.z * 0.05 + tw * 0.35;
        ea.piv.rotation.z = sd * (-back * 0.3) + x2.x * 0.05 + tw * 0.2 * sd;
        if (ea.part.names.droop !== undefined) { const d = clamp(Math.max(e.frown * 1.4, e.browDn * 1.2) - e.smile * 0.4); ea.part.set('droop', d); }
        if (ea.part.names.lift !== undefined) ea.part.set('lift', clamp(e.browUp * 1.1 + e.smile * 0.2));
        ea.part.U.uLag.value.copy(spE.x).multiplyScalar(-0.2).addScaledVector(mot.grav, 0.25);
      }
      if (ctx.decals) ctx.decals.update(1 + e.puff * 0.06);
      if (cfg.extra) cfg.extra(e, t, ctx, live, mot);
      return e;
    };
    ctx.live = live;
    K.finish(g);
    return ctx;
  };
  return L;
}
function PETS(THREE, H, K, C, P) {
  const { PI, TAU, clamp, lerp, sst, lerpC } = K;
  const Q = {};
  Q.furTube = (o) => {
    const path = K.makePath(o.ctrl, o.refs || o.ctrl.map(() => [0, 0, 1]));
    const sec = (s) => { const r = o.r(s); return { w: r, t: r, tf: 1, d: 0 }; };
    const hi = K.tubeMesh(path, sec, o.nu || 14, o.nv || 14, 0, { tip: true, pole0: false });
    const lo = o.fur && o.fur.shells ? K.tubeMesh(path, sec, (o.nu || 14) / 2, (o.nv || 14) / 2, 0, { tip: true }) : null;
    const morphs = (o.morphs || []).map(mm => K.tubeMorph(mm.name, K.makePath(mm.ctrl, mm.refs || o.ctrl.map(() => [0, 0, 1])), sec));
    const cc = [0, 0, 0];
    const bf = (u, v, out) => { o.color(u, v, cc); out[0] = cc[0]; out[1] = cc[1]; out[2] = cc[2]; out[3] = o.furLen ? o.furLen(u, v) : 1; out[4] = 0; };
    bf.wrapU = true;
    const tex = K.bake(o.tw || 32, o.th || 64, bf);
    const fr = { p: [0, 0, 0], t: [0, 0, 0], n: [0, 0, 0], b: [0, 0, 0] };
    const comb = (x, y, z, v, m, out) => { path.at(m.sOf(v), fr); out[0] = fr.t[0]; out[1] = fr.t[1] - 0.6; out[2] = fr.t[2]; };
    return K.furPart({ hi, lo, morphs, comb, tex, fur: Object.assign({ shells: 0, len: 0.6, rep: [3, 8] }, o.fur || {}), order: o.order });
  };
  Q.lock = (o) => {
    const path = K.makePath(o.ctrl, o.refs || o.ctrl.map(() => [0, 0, 1]));
    const sec = (s) => { const k = Math.pow(Math.max(0, 1 - s), 0.75) * (0.7 + 0.3 * sst(0, 0.35, s)); return { w: o.w * k + 0.02, t: o.t * k + 0.02, tf: 1, d: 0 }; };
    const nu = o.nu || 14, nv = o.nv || 18;
    const hi = K.tubeMesh(path, sec, nu, nv, 0, { tip: true }), lo = o.fur && o.fur.shells ? K.tubeMesh(path, sec, nu / 2, nv / 2, 0, { tip: true }) : null;
    const morphs = (o.morphs || []).map(mm => K.tubeMorph(mm.name, K.makePath(mm.ctrl, mm.refs || o.refs || o.ctrl.map(() => [0, 0, 1])), sec));
    const c0 = o.col[0], c1 = o.col[1], cc = [0, 0, 0];
    const bf = (u, v, out) => { K.setC(cc, c0); K.mixIn(cc, c1, sst(0.1, 0.95, v)); const st = 0.88 + 0.24 * K.vnoise(u * 9, v * 2, 3.3) * (o.stripe ?? 1); out[0] = cc[0] * st; out[1] = cc[1] * st; out[2] = cc[2] * st; out[3] = 1; out[4] = 0; };
    bf.wrapU = true;
    const tex = K.bake(16, 48, bf);
    const fr = { p: [0, 0, 0], t: [0, 0, 0], n: [0, 0, 0], b: [0, 0, 0] };
    const comb = (x, y, z, v, m, out) => { path.at(m.sOf(v), fr); out[0] = fr.t[0] * 1.6; out[1] = fr.t[1] * 1.6 - 0.4; out[2] = fr.t[2] * 1.6; };
    const part = K.furPart({ hi, lo, morphs, comb, tex, fur: Object.assign({ shells: 6, len: 0.7, rep: [4, 10], root: 0.62, tip: 1.12, comb: 1.2 }, o.fur || {}), order: o.order });
    part.path = path; return part;
  };
  Q.furBody = (o) => {
    const S = K.starSurface({ sdf: o.sdf, c: o.c, nu: o.nu || 48, nv: o.nv || 32, rmax: o.rmax || 30, kw: 0.2 });
    const info = { phi: 0, lat: 0, nx: 0, ny: 0, nz: 0 }, Pp = [0, 0, 0];
    const bf = (u, v, out) => { S.uvPoint(u, v, Pp, info); o.color(Pp[0], Pp[1], Pp[2], info, out); };
    bf.wrapU = true;
    const tex = K.bake(o.tw || 192, o.th || 96, bf);
    const hi = S.mesh(1), lo = o.fur && o.fur.shells ? S.mesh(2) : null;
    const c = o.c;
    const morphs = [{ name: 'breathe', fn: (x, y, z, v, m, out) => { const w = sst(c[1] - 14, c[1] + 2, y) * sst(c[1] + 14, c[1] + 4, y); out[0] = (x - c[0]) * 0.035 * w; out[2] = (z - c[2]) * 0.035 * w; } }];
    const comb = (x, y, z, v, m, out) => { out[0] = (x - c[0]) * 0.1; out[1] = -1; out[2] = (z - c[2]) * 0.05 - 0.3; };
    const part = K.furPart({ hi, lo, morphs, comb, tex, fur: Object.assign({ shells: 10, len: 0.9, rep: [14, 7], root: 0.55, tip: 1.06 }, o.fur || {}) });
    part.S = S; return part;
  };
  Q.pet = async (o) => {
    const root = new THREE.Group(), inner = new THREE.Group(); root.add(inner); inner.scale.setScalar(o.scale || 0.34);
    const headPiv = new THREE.Group(); headPiv.position.set(...(o.neck || [0, -7, -3])); inner.add(headPiv);
    o.head.fit = false;
    const hctx = await C.head(o.head);
    hctx.root.position.set(-(o.neck || [0, -7, -3])[0], -(o.neck || [0, -7, -3])[1], -(o.neck || [0, -7, -3])[2]);
    headPiv.add(hctx.root);
    await K.yieldUI();
    const body = Q.furBody(o.body); inner.add(body.obj);
    const legs = (o.legs || []).map(l => { const p = Q.furTube(Object.assign({ color: o.legColor, fur: o.legFur, furLen: o.legFurLen }, l)); inner.add(p.obj); return p; });
    let tail = null;
    if (o.tail) { tail = Q.furTube(o.tail); const tp = new THREE.Group(); tp.add(tail.obj); inner.add(tp); tail.piv = tp; }
    await K.yieldUI();
    const rig = C.rig(hctx, Object.assign({ seed: o.seed || 3, lodRoot: root }, o.rigOpt || {}));
    const mot = rig.mot, spBody = mot.spring(22, 3.2, 1, 6), spTail = mot.spring(14, 1.8, 1.5, 8);
    const st = { root, inner, headPiv, hctx, body, legs, tail, rig };
    K.finish(root);
    st.update = (bs, t, snap) => {
      const e = rig.update(bs, t, snap);
      const look = o.look || [0.55, 0.32];
      const hx = clamp(e.gx * look[0] + (o.lookBias ? o.lookBias(t, e) : 0), -0.9, 0.9), hy = clamp(e.gy * look[1], -0.5, 0.5);
      headPiv.rotation.y += (hx - headPiv.rotation.y) * (snap ? 1 : 0.15);
      headPiv.rotation.x += (-hy + Math.sin(t * 0.7) * 0.03 - spBody.x.z * 0.02 - e.jaw * 0.08 - e.smile * 0.04 - (snap ? 0 : 0) - headPiv.rotation.x) * (snap ? 1 : 0.15);
      headPiv.rotation.z = Math.sin(t * 0.53) * 0.04 + spBody.x.x * 0.015 + e.browIn * 0.12 * (o.tiltSide || 1);
      body.set('breathe', 0.5 + 0.5 * Math.sin(t * 2.6));
      inner.rotation.z = -spBody.x.x * 0.02; inner.rotation.x = spBody.x.z * 0.015;
      if (tail) {
        const wag = o.tailWag ? o.tailWag(t, e) : Math.sin(t * 1.6) * 0.8;
        const sw = clamp(wag + spTail.x.x * 0.25);
        tail.set('swingL', Math.max(0, sw)); tail.set('swingR', Math.max(0, -sw)); tail.set('up', clamp(0.3 + e.smile * 0.6 + e.browUp * 0.3));
      }
      if (o.extra) o.extra(e, t, st);
      return e;
    };
    return st;
  };
  Q.sitSdf = (o = {}) => {
    const k = o.k || 1, w = o.w || 1;
    const prims = [
      [[0, -21, -5.5], [9.5 * w, 12, 9.5], 0],
      [[0, -27, -2.5], [9.0 * w, 9, 8.5], 4],
      [[7.2 * w, -31, -8], [6.6, 7, 8.6], 4], [[-7.2 * w, -31, -8], [6.6, 7, 8.6], 4],
      [[8.0 * w, -37, -2.5], [3.3, 1.9, 4.8], 2], [[-8.0 * w, -37, -2.5], [3.3, 1.9, 4.8], 2],
      [[0, -11, -3.5], [7.0, 6.2, 7.0], 4],
    ];
    return (x, y, z) => {
      let d = K.sdEll(x, y, z, prims[0][0], prims[0][1]);
      for (let i = 1; i < prims.length; i++) d = K.smin(d, K.sdEll(x, y, z, prims[i][0], prims[i][1]), prims[i][2]);
      d = K.smax(d, -(y + 38.6), 1.5);
      return d * k;
    };
  };
  return Q;
}
export const meta = { label: 'Musetto da orsetto', labelEn: 'Teddy face', labelFr: 'Frimousse d\'ourson', labelDe: 'Teddygesicht', category: 'divertenti', icon: '🧸' };
export const hideHead = false;
export default async function build(THREE, h) {
  const K = KIT(THREE, h), C = CREATURE(THREE, h, K), L = LENS(THREE, h, K, C);
  // 1.8.9: orecchie sul cranio vero del motore (HEAD.cranium: centro (0, 5,6, −4,8), raggi 7,7 × 7,7 × 8,7), non
  // sull'ellissoide di prima (cima 10,4): sulle teste vere stavano 3 cm dentro la testa e il motore spegneva la calotta
  L.capPoint = (dir, hair = 1.6) => { const SK = [0, 5.6, -4.8], SR = [7.7, 7.7, 8.7]; const l = Math.hypot(dir[0] / SR[0], dir[1] / SR[1], dir[2] / SR[2]); const d = [dir[0] / l, dir[1] / l, dir[2] / l], dl = Math.hypot(...d); return [SK[0] + d[0] + d[0] / dl * hair, SK[1] + d[1] + d[1] / dl * hair, SK[2] + d[2] + d[2] / dl * hair]; };
  const g = new THREE.Group();
  const blush = [1, -1].map(sd => ({ c: [sd * 4.4, -0.8, 3.5], r: 1.3, ry: 0.9, col: [0.92, 0.5, 0.48], a: 0.3, edge: 0 }));
  const ctx = await L.build(g, {
    seed: 6, earBack: 0.2,
    ears: { kind: 'pointy', L: 4.6, W: 3.7, T: 0.9, D: 0.9, rho: 1, dir: [0.62, 1.0, 0.0], hair: 1.8, rot: [-0.06, 0.3, -0.5],
      out: [0.44, 0.28, 0.17], inn: [0.62, 0.44, 0.32], tuft: [0.6, 0.43, 0.3], innerFur: 0.8, furIn: 1,
      fur: { shells: 10, len: 0.95, rep: [4, 5], root: 0.55, tip: 1.08 } },
    nose: { kind: 'bear', w: 1.55, h: 1.0, d: 0.95, col: [0.17, 0.1, 0.08], cc: 0.7, rough: 0.32, off: [0, 0.1, 0.25], rx: 0.15 },
    decals: blush,
  });
  g.userData.ctx = ctx;
  return g;
}
export function update(g, bs, t) { const c = g.userData.ctx; if (c) c.update(bs, t, !!g.userData.snap); g.userData.snap = false; }
