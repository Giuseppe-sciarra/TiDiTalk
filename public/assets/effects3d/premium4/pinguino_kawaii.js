// Tiditalk — effetto viso 3D "kawaii" (procedurale, scritto da zero, AGPL-3.0).
// GENERATO da premium4/_src/build.py: modificare i sorgenti in _src/ (kit.js, kawaii.js, pets.js, fx/pinguino_kawaii.js).
function KIT(THREE, H) {
  const K = {};
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sst = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  const mix3 = (o, a, b, t) => { o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; return o; };
  const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  Object.assign(K, { PI, TAU, clamp, lerp, sst, mix3, hex });
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
    if (pad) K.padMorphs(g);
    g.computeBoundingSphere(); if (g.boundingSphere) g.boundingSphere.radius *= 1.6;
    return g;
  }
  K.toGeometry = toGeometry;
  K.plainMesh = (m, mat, morphs) => { const g = toGeometry(m, morphs); const me = new THREE.Mesh(g, mat); me.frustumCulled = false; return me; };
  K.vcol = (m, fn) => {
    const a = new Float32Array(m.n * 3), o = [1, 1, 1], c = new THREE.Color();
    for (let v = 0; v < m.n; v++) { o[0] = o[1] = o[2] = 1; fn(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2], v, m, o); c.setRGB(o[0], o[1], o[2], THREE.SRGBColorSpace); a[v * 3] = c.r; a[v * 3 + 1] = c.g; a[v * 3 + 2] = c.b; }
    return new THREE.BufferAttribute(a, 3);
  };
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
  const lerpC = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  K.lerpC = lerpC;
  K.mixIn = (c, b, t) => { if (t <= 0) return c; if (t > 1) t = 1; c[0] += (b[0] - c[0]) * t; c[1] += (b[1] - c[1]) * t; c[2] += (b[2] - c[2]) * t; return c; };
  K.setC = (c, b) => { c[0] = b[0]; c[1] = b[1]; c[2] = b[2]; return c; };
  K.mulC = (c, k) => { c[0] *= k; c[1] *= k; c[2] *= k; return c; };
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
function KAWAII(THREE, H, K) {
  const { PI, TAU, clamp, lerp, sst, lerpC } = K;
  const W = {};
  const tmpC = new THREE.Color();
  let _white = null;
  W.white = () => _white || (_white = (() => { const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; })());
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  W.mkCanvas = mkCanvas;
  W.bake = (w, h, fn, wrapU) => {
    const cv = mkCanvas(w, h), x = cv.getContext('2d'), im = x.createImageData(w, h), A = im.data, o = [0, 0, 0];
    for (let y = 0; y < h; y++) {
      const v = 1 - (y + 0.5) / h;
      for (let i = 0; i < w; i++) {
        o[0] = o[1] = o[2] = 0.5; fn((i + 0.5) / w, v, o);
        const k = (y * w + i) * 4; A[k] = clamp(o[0]) * 255; A[k + 1] = clamp(o[1]) * 255; A[k + 2] = clamp(o[2]) * 255; A[k + 3] = 255;
      }
    }
    x.putImageData(im, 0, 0);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    if (wrapU) t.wrapS = THREE.RepeatWrapping;
    return t;
  };
  const CHK = THREE.ShaderChunk.lights_physical_pars_fragment;
  const TGT = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );';
  const SSS = CHK && CHK.indexOf(TGT) >= 0 ? CHK.replace(TGT, 'float kwNL = dot( geometryNormal, directLight.direction );\n\tvec3 kwW = max( saturate( ( kwNL + uKwWrap ) / ( 1.0 + uKwWrap ) ) - dotNL, 0.0 ) * directLight.color * uKwSSS;\n\treflectedLight.directDiffuse += ( irradiance + kwW ) * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );') : null;
  W.FINISH = {
    gloss: { rough: 0.45, cc: 0.36, ccr: 0.2, sheen: 0.06, sheenR: 0.5, wrap: 0.45, sssK: 0.45 },
    vinyl: { rough: 0.56, cc: 0.26, ccr: 0.3, sheen: 0.08, sheenR: 0.55, wrap: 0.5, sssK: 0.5 },
    matte: { rough: 0.66, cc: 0.12, ccr: 0.45, sheen: 0.2, sheenR: 0.6, wrap: 0.55, sssK: 0.55 },
    plush: { rough: 0.88, cc: 0.03, ccr: 0.6, sheen: 0.7, sheenR: 0.45, wrap: 0.6, sssK: 0.55 },
  };
  W.EXPO = 0.34;
  W.vinyl = (o = {}) => {
    const f = Object.assign({}, W.FINISH[o.finish || 'vinyl'], o);
    const sc = f.sheenCol ? K.col(f.sheenCol) : new THREE.Color(1, 0.94, 0.9);
    const m = new THREE.MeshPhysicalMaterial({
      color: f.col ? K.col(f.col) : new THREE.Color(1, 1, 1), map: f.map || W.white(), vertexColors: true,
      roughness: f.rough, metalness: 0, clearcoat: Math.max(0.01, f.cc), clearcoatRoughness: f.ccr,
      sheen: 0, sheenRoughness: f.sheenR, sheenColor: sc, envMapIntensity: f.env ?? 0.5,
      emissive: f.emissive ? K.col(f.emissive) : new THREE.Color(0, 0, 0), side: f.side ?? THREE.FrontSide, transparent: !!f.transparent,
    });
    m.color.multiplyScalar(f.expo ?? W.EXPO);   // the app's lights are strong (no tone mapping): keep albedos below clipping
    if (f.emissiveIntensity != null) m.emissiveIntensity = f.emissiveIntensity;
    const s = f.sss || [1.0, 0.6, 0.5], k = f.sssK;
    const U = { uKwWrap: { value: f.wrap }, uKwSSS: { value: new THREE.Color(s[0] * k, s[1] * k, s[2] * k) } };
    m.userData.kw = U;
    if (SSS) {
      m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U); sh.fragmentShader = 'uniform float uKwWrap;\nuniform vec3 uKwSSS;\n' + sh.fragmentShader.replace('#include <lights_physical_pars_fragment>', SSS); };
      m.customProgramCacheKey = () => 'kw-vinyl';
    }
    return m;
  };
  W.vcolFn = (pos, n, fn) => {
    const a = new Float32Array(n * 3), o = [1, 1, 1];
    for (let v = 0; v < n; v++) { o[0] = o[1] = o[2] = 1; fn(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], v, o); tmpC.setRGB(clamp(o[0]), clamp(o[1]), clamp(o[2]), THREE.SRGBColorSpace); a[v * 3] = tmpC.r; a[v * 3 + 1] = tmpC.g; a[v * 3 + 2] = tmpC.b; }
    return new THREE.BufferAttribute(a, 3);
  };
  W.ao = (pos, nrm, n, sdf, o = {}) => {
    const tint = o.tint || [0.56, 0.4, 0.42], st = o.k ?? 1, hs = o.h || [0.3, 0.8, 1.6, 2.8, 4.5], w0 = o.w || [1, 0.8, 0.6, 0.45, 0.35];
    return W.vcolFn(pos, n, (x, y, z, v, out) => {
      const nx = nrm[v * 3], ny = nrm[v * 3 + 1], nz = nrm[v * 3 + 2]; let occ = 0;
      for (let i = 0; i < hs.length; i++) { const h = hs[i], d = sdf(x + nx * h, y + ny * h, z + nz * h); occ += Math.max(0, h - d) / h * w0[i]; }
      const a = clamp(1 - occ * 0.42 * st), b = (0.35 + 0.65 * a) * (1 - (o.vol ?? 0.14) * sst(0.1, -0.9, ny) * sst(0.8, 0.2, nz) - (o.vol ?? 0.14) * 0.6 * sst(0.2, -0.8, nz));   // never fully black
      out[0] = lerp(tint[0], 1, b); out[1] = lerp(tint[1], 1, b); out[2] = lerp(tint[2], 1, b);
      if (o.extra) o.extra(x, y, z, out);
    });
  };
  W.setColors = (g, attr) => { g.setAttribute('color', attr); return g; };
  W.mesh = (g, mat, order) => { if (!g.attributes.color) K.vc(g); const m = new THREE.Mesh(g, mat); m.frustumCulled = false; if (order != null) m.renderOrder = order; return m; };
  W.zAt = (sdf, x, y, z0 = 32) => { let z = z0; for (let i = 0; i < 160; i++) { const d = sdf(x, y, z); if (d < 0.003) break; z -= Math.max(d * 0.9, 0.003); if (z < -32) break; } return z; };
  W.normalAt = (sdf, x, y, z, out) => K.sdfNormal(sdf, x, y, z, out || [0, 0, 0]);
  W.sdfOf = (prims, caps, extra) => (x, y, z) => {
    let d = K.sdEll(x, y, z, prims[0][0], prims[0][1]);
    for (let i = 1; i < prims.length; i++) { const q = prims[i]; d = q[2] >= 0 ? K.smin(d, K.sdEll(x, y, z, q[0], q[1]), q[2] || 0.001) : K.smax(d, -K.sdEll(x, y, z, q[0], q[1]), -q[2]); }
    if (caps) for (let i = 0; i < caps.length; i++) { const q = caps[i]; d = K.smin(d, K.sdCap(x, y, z, q[0], q[1], q[2], q[3]), q[4]); }
    return extra ? extra(x, y, z, d) : d;
  };
  W.chibi = (o = {}) => {
    const w = o.w ?? 1, hh = o.h ?? 1, ch = o.cheek ?? 1, jw = o.jowl ?? 0;
    const prims = [
      [[0, 3.1 * hh, -2.4], [12.2 * w, 11.5 * hh, 11.0], 0],
      [[0, -3.3 * hh - jw, 1.0], [(10.4 + 1.2 * ch) * w, (7.2 + 0.5 * ch) * hh, 8.4 + 0.4 * ch], 4.5],
    ];
    if (o.muzzle) prims.push(o.muzzle);
    if (o.prims) prims.push(...o.prims);
    return { sdf: W.sdfOf(prims, o.caps, o.extra), c: [0, 1.6 * hh, -2.0], prims };
  };
  W.blob = K.blob;
  W.front = (z, z0 = 0, z1 = 4) => sst(z0, z1, z);
  W.part = (o) => {
    const S = K.starSurface({ sdf: o.sdf, c: o.c, nu: o.nu || 40, nv: o.nv || 28, rmax: o.rmax || 16, kw: o.kw ?? 0.2 });
    const m = S.mesh(1), g = K.toGeometry(m, o.morphs || null);
    let map = null;
    if (o.color) {
      const info = { phi: 0, lat: 0, nx: 0, ny: 0, nz: 0 }, P = [0, 0, 0];
      map = W.bake(o.tw || 64, o.th || 64, (u, v, out) => { S.uvPoint(u, v, P, info); o.color(P[0], P[1], P[2], info, out); }, true);
    }
    W.setColors(g, o.noAO ? K.vc(g).attributes.color : W.ao(m.pos, m.nrm, m.n, o.aoSdf || o.sdf, o.aoOpt));
    const mat = o.mat || W.vinyl(Object.assign({ map, col: o.color ? null : o.col }, o.matOpt || {}));
    const me = W.mesh(g, mat, o.order); me.userData.S = S; return me;
  };
  W.tube = (o) => {
    const path = K.makePath(o.ctrl, o.refs || o.ctrl.map(() => [0, 0, 1]), o.N || 64);
    const sec = o.sec || ((s) => { const r = o.r(s); return { w: r, t: r, tf: 1, d: 0 }; });
    const m = K.tubeMesh(path, sec, o.nu || 16, o.nv || 16, o.s0 ?? 0, { tip: o.tip !== false, pole0: !!o.pole0 });
    const morphs = (o.morphs || []).map(mm => K.tubeMorph(mm.name, K.makePath(mm.ctrl, mm.refs || o.refs || o.ctrl.map(() => [0, 0, 1])), sec));
    const g = K.toGeometry(m, morphs.length ? morphs : null);
    let map = null;
    if (o.color) map = W.bake(o.tw || 32, o.th || 64, (u, v, out) => o.color(u, lerp(o.s0 ?? 0, 1, v), out), true);
    const aoR = o.aoRoot ?? 0.35, tint = o.aoTint || [0.55, 0.38, 0.38];
    W.setColors(g, W.vcolFn(m.pos, m.n, (x, y, z, v, out) => { const s = m.sOf(v), a = 1 - aoR * sst(0.25, -0.05, s); out[0] = lerp(tint[0], 1, a); out[1] = lerp(tint[1], 1, a); out[2] = lerp(tint[2], 1, a); }));
    const mat = o.mat || W.vinyl(Object.assign({ map, col: o.color ? null : o.col }, o.matOpt || {}));
    const me = W.mesh(g, mat, o.order); me.userData.path = path; me.userData.m = m;
    if (morphs.length) { me.userData.mi = {}; (o.morphs || []).forEach((mm, i) => { me.userData.mi[mm.name] = i; }); }
    return me;
  };
  W.ell = (r, col, o = {}) => {
    const g = new THREE.SphereGeometry(1, o.seg || 24, Math.max(8, (o.seg || 24) * 0.7 | 0)); g.scale(r[0], r[1], r[2]);
    K.vc(g, col); const me = W.mesh(g, o.mat || W.vinyl(Object.assign({}, o.matOpt || {}))); return me;
  };
  W.spikeGeo = (r, hgt, o = {}) => {
    const pts = [], n = o.n || 10, tip = o.tip ?? 0.28;
    pts.push(new THREE.Vector2(0.001, -r * 0.3));
    for (let i = 0; i < n; i++) { const s = i / n, rr = r * Math.pow(1 - s, o.pow ?? 0.85) * (1 + (o.belly ?? 0.15) * Math.sin(s * PI)); pts.push(new THREE.Vector2(Math.max(rr, 0.001), hgt * s)); }
    pts.push(new THREE.Vector2(r * tip * 0.45, hgt * (1 - tip * 0.08))); pts.push(new THREE.Vector2(0.001, hgt));
    return new THREE.LatheGeometry(pts, o.seg || 12);
  };
  const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _m4 = new THREE.Matrix4(), _s = new THREE.Vector3(1, 1, 1), _qs = new THREE.Quaternion();
  W.placeGeo = (geo, pos, dir, spin = 0, scl) => {
    _v.set(dir[0], dir[1], dir[2]).normalize(); _q.setFromUnitVectors(_up, _v); _qs.setFromAxisAngle(_up, spin); _q.multiply(_qs);
    if (scl) _s.set(scl[0], scl[1], scl[2]); else _s.set(1, 1, 1);
    _m4.compose(_v.set(pos[0], pos[1], pos[2]), _q, _s); geo.applyMatrix4(_m4); return geo;
  };
  W.merged = (items, o = {}) => {
    const geos = items.map(it => {
      let g = it.geo.index ? it.geo : H.BufferGeometryUtils.mergeVertices(it.geo);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      const p = g.attributes.position.array;
      g.setAttribute('color', W.vcolFn(p, g.attributes.position.count, (x, y, z, v, out) => { if (it.colFn) it.colFn(x, y, z, out); else { out[0] = it.col[0]; out[1] = it.col[1]; out[2] = it.col[2]; } }));
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
      return g;
    });
    const g = H.BufferGeometryUtils.mergeGeometries(geos);
    if (o.aoSdf) {   // multiply a cheap AO into the colours
      const ao = W.ao(g.attributes.position.array, g.attributes.normal.array, g.attributes.position.count, o.aoSdf, o.aoOpt || { k: 0.7 }).array, c = g.attributes.color.array;
      for (let i = 0; i < c.length; i++) c[i] *= ao[i];
    }
    return W.mesh(g, W.vinyl(Object.assign({}, o.matOpt || {})));
  };
  W.roundEar = (o) => {
    const Wd = o.W, Hh = o.H, T = o.T, cup = o.cup ?? 0.6;
    const cE = [0, Hh * 0.5, 0], rE = [Wd, Hh * 0.55, T];
    const cC = [0, Hh * 0.56, T * (1.05 - 0.25 * cup)], rC = [Wd * (o.innR ?? 0.66), Hh * 0.55 * (o.innR ?? 0.66), T * 0.7];
    const sdf = (x, y, z) => { let d = K.sdEll(x, y, z, cE, rE); if (cup > 0) d = K.smax(d, -K.sdEll(x, y, z, cC, rC), 0.35); return d; };
    const outC = o.out, innC = o.inn || o.out;
    const ir = o.innR ?? 0.66;
    return W.part({ sdf, c: [0, Hh * 0.5, -T * 0.3], nu: o.nu || 40, nv: o.nv || 28, rmax: Math.max(Wd, Hh) * 1.4 + 2, kw: 0.1, tw: 64, th: 64,
      color: (x, y, z, info, out) => {
        const dx = x / (Wd * ir), dy = (y - cC[1]) / (Hh * 0.55 * ir), r = Math.sqrt(dx * dx + dy * dy);
        const inner = sst(1.05, 0.88, r) * sst(T * -0.1, T * 0.35, z);
        const c = lerpC(outC, innC, inner); if (o.paint) o.paint(x, y, z, c, inner);
        out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
      }, matOpt: Object.assign({ finish: o.finish }, o.matOpt || {}), aoOpt: { k: 0.8 } });
  };
  W.earPath = (o) => {
    const L = o.L, b = o.back || 0, k = o.kind;
    if (k === 'floppy') {
      const s = L / 10, up = o.up ?? 1.2, hang = o.hang ?? 1, ox = o.outX ?? 3.0 * s, fz = o.fwd ?? 0;
      const ctrl = [[0, -0.8 * s, 0], [0.5 * s, 0.8 * s * up, 0], [ox * 0.55, 1.4 * s * up, 0.1 * s], [ox * 0.9, 0.5 * s, 0.25 * s + fz * 0.3], [ox, -2.6 * s * hang, 0.5 * s + fz * 0.6], [ox * 1.02, -5.4 * s * hang, 0.7 * s + fz], [ox * 0.97, -8.0 * s * hang, 0.85 * s + fz]];
      const refs = [[0.2, 1, 0], [0.3, 1, 0], [0.3, 1, 0], [1, 0.3, 0], [1, 0, 0], [1, 0, -0.05], [1, 0, -0.1]];
      return { ctrl, refs };
    }
    if (k === 'side') {   // ears sticking out sideways (calf, lamb, fawn): grows along +y in the local frame, the holder turns it outwards
      return { ctrl: [[0, -0.2 * L, 0], [0, 0.3 * L, 0.04 * L * b], [0, 0.7 * L, 0.02 * L * b], [0, L, -0.06 * L * b]], refs: [[0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1]] };
    }
    return { ctrl: [[0, -0.22 * L, 0.02 * L * b], [0, 0.3 * L, -0.03 * L * b], [0, 0.66 * L, -0.1 * L * b], [0, L, -0.2 * L * b]], refs: [[0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1]] };
  };
  W.earSection = (o) => {
    const k = o.kind, Wd = o.W, T = o.T, D = o.D ?? Wd * 0.35, rho = o.rho ?? 0;
    if (k === 'floppy') return (s) => { const prof = (0.42 + 0.7 * sst(0.0, 0.7, s)) * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, (s - 0.66) / 0.34), 2.0))); return { w: Wd * prof + 0.03, t: T * (1 - 0.35 * s) * Math.sqrt(prof + 0.05) + 0.05, tf: 1, d: -D * prof * sst(0, 0.3, s) }; };
    if (k === 'long') return (s) => { const p = Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, (s - 0.5) / 0.5), 2.2))) * (0.62 + 0.5 * sst(-0.1, 0.45, s)); return { w: Wd * p + 0.03, t: T * (1 - 0.3 * s) * (0.5 + 0.5 * p) + 0.06, tf: o.tf ?? 0.45, d: D * p * sst(0.0, 0.25, s) }; };
    if (k === 'side' || k === 'leaf') return (s) => { const p = Math.sin(clamp(s * 0.94 + 0.06) * PI) ** 0.75 * (0.75 + 0.35 * s) * (s > 0.7 ? 1 - 0.25 * (s - 0.7) / 0.3 : 1); return { w: Wd * p + 0.03, t: T * (1 - 0.4 * s) + 0.05, tf: o.tf ?? 0.5, d: D * p }; };
    return (s) => {
      const pointy = Math.pow(Math.max(0, 1 - s), 0.75) * (1 + 0.7 * s) * (1 - 0.35 * s), round = Math.sqrt(Math.max(0, 1 - s * s)) * (1 + 0.12 * s);
      const p = lerp(pointy, round, rho);
      return { w: Wd * p + 0.02, t: T * Math.sqrt(Math.max(0, 1 - s)) * (1 - 0.3 * s) + 0.05, tf: o.tf ?? 0.4, d: D * p * (1 - 0.45 * s) };
    };
  };
  W.tubeEar = (o) => {
    const P = W.earPath(o), sec = W.earSection(o);
    const inner = o.innerSide ?? 1, outC = o.out, innC = o.inn || o.out;
    const tipC = o.tip, cc = [0, 0, 0];
    return W.tube({ ctrl: P.ctrl, refs: P.refs, sec, nu: o.nu || 24, nv: o.nv || 20, s0: o.s0 ?? -0.12, tw: 64, th: 64,
      color: (u, s, out) => {
        const a = TAU * u, sa = Math.sin(a), ca = Math.cos(a) * inner;
        K.setC(cc, outC);
        if (ca > 0) { const edge = Math.abs(sa), skin = sst(o.innEdge ?? 0.72, (o.innEdge ?? 0.72) - 0.18, edge) * sst(0.96, 0.8, s) * sst(0.0, 0.14, s); K.mixIn(cc, innC, skin); }
        if (tipC) K.mixIn(cc, tipC, sst(o.tipFrom ?? 0.66, (o.tipFrom ?? 0.66) + 0.1, s));
        if (o.paint) o.paint(u, s, ca, sa, cc);
        out[0] = cc[0]; out[1] = cc[1]; out[2] = cc[2];
      }, matOpt: Object.assign({ finish: o.finish }, o.matOpt || {}), aoRoot: 0.4 });
  };
  W.nose = (o) => {
    const w = o.w, hh = o.h, d = o.d, kind = o.kind || 'oval';
    let sdf;
    if (kind === 'tri') {
      sdf = (x, y, z) => { const ty = clamp((y + hh) / (2 * hh)); const sx = lerp(0.42, 1.0, Math.pow(ty, 0.7)); return K.sdEll(x / sx, y, z, [0, 0, 0], [w, hh, d]) * Math.min(1, sx + 0.3); };
    } else if (kind === 'pig') {
      sdf = (x, y, z) => {
        const q = Math.hypot(x / w, y / hh) - 1, pz = Math.abs(z) - d, mn = Math.min(w, hh), rr = 0.38 * mn;
        let dd = Math.min(Math.max(q * mn, pz), 0) + Math.hypot(Math.max(q * mn + rr, 0), Math.max(pz + rr, 0)) - rr;
        for (const sg of [-1, 1]) dd = K.smax(dd, -K.sdEll(x, y, z, [sg * w * 0.34, 0, d * 1.02], [w * 0.15, hh * 0.32, d * 0.4]), 0.1);
        return dd;
      };
    } else if (kind === 'button') {
      sdf = (x, y, z) => K.sdEll(x, y, z, [0, 0, 0], [w, hh, d]);
    } else {
      sdf = (x, y, z) => {
        const ty = clamp((y + hh) / (2 * hh)); const sx = lerp(0.6, 1.0, Math.pow(ty, 0.55));
        let dd = K.sdEll(x / sx, y + 0.1 * hh * (x * x) / (w * w), z, [0, 0, 0], [w, hh, d]) * Math.min(1, sx + 0.2);
        if (o.nostrils) for (const sg of [-1, 1]) dd = K.smax(dd, -K.sdEll(x, y, z, [sg * w * 0.42, -hh * 0.18, d * 0.9], [w * 0.17, hh * 0.2, d * 0.35]), 0.1);
        return dd;
      };
    }
    const S = K.starSurface({ sdf, c: [0, 0, 0], nu: o.nu || 36, nv: o.nv || 24, rmax: Math.max(w, hh, d) * 2 + 0.5, kw: 0.25 });
    const m = S.mesh(1), g = K.toGeometry(m, null);
    const base = o.col, hi = o.hi || lerpC(base, [1, 1, 1], 0.3), dark = o.dark || base.map(v => v * 0.35);
    g.setAttribute('color', W.vcolFn(m.pos, m.n, (x, y, z, v, out) => {
      let c = lerpC(base, hi, sst(0.0, 0.95, y / hh) * sst(0, 0.9, z / d) * 0.6);
      if (kind === 'pig') c = lerpC(c, dark, Math.max(K.blob(x, y, z, [w * 0.34, 0, d * 0.9], [w * 0.2, hh * 0.38, d * 0.5], 0.35), K.blob(x, y, z, [-w * 0.34, 0, d * 0.9], [w * 0.2, hh * 0.38, d * 0.5], 0.35)) * 0.8);
      else c = lerpC(c, dark, sst(-0.4, -1.0, y / hh) * 0.35);
      out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
    }));
    return W.mesh(g, W.vinyl(Object.assign({ finish: o.finish || 'gloss' }, o.matOpt || {})));
  };
  W.beak = (o) => {
    const L = o.L, Wd = o.W, T = o.T, hook = o.hook ?? 0.15, lo = !!o.lower, sg = lo ? -1 : 1, flat = o.flat ?? 0;
    const path = K.makePath([[0, 0, -0.5 * L], [0, sg * 0.05 * L, 0.35 * L], [0, -hook * 0.28 * L, 0.8 * L], [0, -hook * 0.62 * L, L]], [[0, sg, 0], [0, sg, 0], [0, sg, 0.25 * hook], [0, sg, 0.8 * hook]]);
    const m = K.tubeMesh(path, (s) => { const k = flat ? Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, (s - 0.55) / 0.45), 2))) : Math.pow(Math.max(0, 1 - s), 0.8); return { w: Wd * k * (1 + (flat ? 0.15 : 0.25) * (1 - s)) + 0.02, t: T * 0.14 * k + 0.02, tf: flat ? 3.0 : 7.0, d: 0 }; }, 22, 16, 0);
    const g = K.toGeometry(m, null);
    const col = o.col, tip = o.tipCol || col;
    g.setAttribute('color', W.vcolFn(m.pos, m.n, (x, y, z, v, out) => { const c = lerpC(col, tip, sst(0.45, 1.0, z / L)); const k = lo ? 0.9 : 1; out[0] = c[0] * k; out[1] = c[1] * k; out[2] = c[2] * k; }));
    return W.mesh(g, W.vinyl({ finish: 'gloss' }));
  };
  W.tongue = (o = {}) => {
    const w = o.w || 1.5, t = o.t || 0.42, L = o.L || 2.6;
    const path = K.makePath([[0, 0, -0.4], [0, 0.05, L * 0.45], [0, -0.05 * L, L]], [[0, 1, 0], [0, 1, 0], [0, 1, 0]]);
    const m = K.tubeMesh(path, (s) => { const p = Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, (s - 0.55) / 0.45), 2))); return { w: w * (0.85 + 0.15 * s) * p + 0.02, t: t * (1 - 0.3 * s) * p + 0.02, tf: 0.75, d: 0.18 * p }; }, 20, 14, 0);
    const g = K.toGeometry(m, null), col = o.col || [0.95, 0.45, 0.52];
    g.setAttribute('color', W.vcolFn(m.pos, m.n, (x, y, z, v, out) => { const groove = sst(0.3, 0, Math.abs(x)) * sst(-0.1, 0.2, y); const c = lerpC(col, col.map(q => q * 0.75), groove * 0.6); out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; }));
    return W.mesh(g, W.vinyl({ finish: 'gloss', wrap: 0.3 }));
  };
  W.tooth = (w, h, d, col) => {
    const g = new THREE.BoxGeometry(w, h, d, 3, 4, 2), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const ty = (y + h / 2) / h; p.setX(i, x * (1 - 0.12 * (1 - ty))); p.setZ(i, z - 0.3 * (x * x) / (w * w) * d); if (ty < 0.15) { const k = 1 - Math.pow((0.15 - ty) / 0.15, 2) * 0.5; p.setX(i, p.getX(i) * k); } }
    g.computeVertexNormals(); g.translate(0, -h / 2, 0); K.vc(g, col || [0.98, 0.96, 0.92]);
    return W.mesh(g, W.vinyl({ finish: 'gloss', wrap: 0.2 }));
  };
  W.fang = (r, l, col) => { const g = new THREE.ConeGeometry(r, l, 10, 1); g.rotateX(PI); g.translate(0, -l / 2, 0); K.vc(g, col || [0.98, 0.96, 0.92]); return W.mesh(g, W.vinyl({ finish: 'gloss', wrap: 0.2 })); };
  W.whiskers = (list, o = {}) => {
    const geos = [];
    for (const w of list) {
      const r0 = o.r0 ?? 0.06, r1 = o.r1 ?? 0.02, L = w.len, a = w.root, dl = Math.hypot(...w.dir), d = w.dir.map(x => x / dl);
      const c1 = [a[0] + d[0] * L * 0.45, a[1] + d[1] * L * 0.45 + (w.lift || 0.04) * L, a[2] + d[2] * L * 0.45];
      const e = [a[0] + d[0] * L, a[1] + d[1] * L - (w.droop ?? 0.1) * L, a[2] + d[2] * L];
      const path = K.makePath([a, c1, e], [[0, 1, 0], [0, 1, 0], [0, 1, 0]], 16);
      const m = K.tubeMesh(path, (s) => ({ w: lerp(r0, r1, s), t: lerp(r0, r1, s), tf: 1, d: 0 }), 5, 8, 0, { tip: false });
      geos.push(K.vc(K.toGeometry(m, null), o.col || [0.3, 0.22, 0.2]));
    }
    return W.mesh(H.BufferGeometryUtils.mergeGeometries(geos), W.vinyl({ finish: 'matte', wrap: 0.2 }));
  };
  W.eyeTex = (o) => {
    const S = 256, cv = mkCanvas(S, S), x = cv.getContext('2d'), c = S / 2, R = (o.ir ?? 0.4) * S;
    const css = (a, al = 1) => `rgba(${Math.round(clamp(a[0]) * 255)},${Math.round(clamp(a[1]) * 255)},${Math.round(clamp(a[2]) * 255)},${al})`;
    const scl = o.sclera || [0.97, 0.96, 0.95];
    const gs = x.createRadialGradient(c, c, R * 0.95, c, c, S * 0.5); gs.addColorStop(0, css(scl)); gs.addColorStop(1, css(scl.map(v => v * 0.86)));
    x.fillStyle = gs; x.fillRect(0, 0, S, S);
    const it = o.iris[0], ib = o.iris[1], ring = o.iris[2] || it.map(v => v * 0.6);
    const cy = c + (o.irisY ?? 0) * S;
    x.fillStyle = css(scl.map(v => v * 0.8), 0.6); x.beginPath(); x.ellipse(c, cy, R * 1.05, R * 1.05, 0, 0, TAU); x.fill();
    const g = x.createLinearGradient(0, cy - R, 0, cy + R); g.addColorStop(0, css(it)); g.addColorStop(0.45, css(lerpC(it, ib, 0.35))); g.addColorStop(1, css(ib));
    x.fillStyle = g; x.beginPath(); x.arc(c, cy, R, 0, TAU); x.fill();
    x.lineWidth = R * 0.1; x.strokeStyle = css(ring, 0.9); x.beginPath(); x.arc(c, cy, R * 0.95, 0, TAU); x.stroke();
    const pr = R * (o.pupil ?? 0.55);
    const pg = x.createRadialGradient(c, cy - pr * 0.1, pr * 0.6, c, cy - pr * 0.1, pr * 1.05); pg.addColorStop(0, css(o.pupilCol || [0.04, 0.03, 0.04])); pg.addColorStop(1, css(o.pupilCol || [0.04, 0.03, 0.04], 0));
    x.fillStyle = pg; x.beginPath(); x.arc(c, cy - pr * 0.1, pr * 1.05, 0, TAU); x.fill();
    if (o.slit) { x.fillStyle = css([0.03, 0.02, 0.03]); x.beginPath(); x.ellipse(c, cy, pr * 0.32, R * 0.82, 0, 0, TAU); x.fill(); }
    const gl = x.createRadialGradient(c, cy + R * 0.62, 0, c, cy + R * 0.62, R * 0.62); const gc = o.glow || lerpC(ib, [1, 1, 1], 0.35);
    gl.addColorStop(0, css(gc, 0.75)); gl.addColorStop(1, css(gc, 0));
    x.save(); x.beginPath(); x.arc(c, cy, R * 0.94, 0, TAU); x.clip(); x.globalCompositeOperation = 'lighter'; x.fillStyle = gl; x.fillRect(0, 0, S, S); x.restore();
    if (o.sparkle !== false) { x.fillStyle = 'rgba(255,255,255,0.55)'; x.beginPath(); x.arc(c - R * 0.42, cy + R * 0.3, R * 0.07, 0, TAU); x.fill(); x.beginPath(); x.arc(c + R * 0.2, cy + R * 0.55, R * 0.045, 0, TAU); x.fill(); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  };
  W.eye = (o) => {
    const r = o.r, sock = new THREE.Group(); sock.position.set(o.pos[0], o.pos[1], o.pos[2]);
    sock.rotation.set(o.pitch || 0, (o.yaw || 0) * o.side, (o.roll || 0) * o.side, 'YXZ');
    if (o.scaleY) sock.scale.set(1, o.scaleY, 1);
    const bg = new THREE.SphereGeometry(r, 32, 24);
    const p = bg.attributes.position, uv = bg.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getX(i) / (2 * r), 0.5 + p.getY(i) / (2 * r));
    const key = JSON.stringify([o.iris, o.ir, o.pupil, o.sclera, o.slit, o.irisY, o.sparkle]);
    const tex = (W._eyeT || (W._eyeT = {}))[key] || (W._eyeT[key] = W.eyeTex(o));
    const emat = (W._eyeM || (W._eyeM = {}))[key] || (W._eyeM[key] = W.vinyl({ map: tex, rough: 0.12, cc: 1, ccr: 0.03, sheen: 0.02, wrap: 0.15, sssK: 0.2, expo: 0.4 }));
    const ball = W.mesh(bg, emat);
    const gaze = new THREE.Group(); gaze.add(ball); sock.add(gaze);
    const hm = W._hlMat || (W._hlMat = W.vinyl({ col: [0, 0, 0], emissive: [1, 1, 1], rough: 1, cc: 0.01, sheen: 0.02, wrap: 0, expo: 1 }));
    const hl = (dir, rr, sx, sy, rot) => { const g = K.vc(new THREE.CircleGeometry(rr, 20)); const me = W.mesh(g, hm); const d = new THREE.Vector3(...dir).normalize().multiplyScalar(r * 1.012); me.position.copy(d); me.lookAt(d.clone().multiplyScalar(3)); me.rotateZ(rot || 0); me.scale.set(sx, sy, 1); sock.add(me); return me; };
    hl([0.34, 0.42, 0.84], r * (o.hl1 ?? 0.28), 1, 1.25, -0.5);
    hl([-0.3, -0.33, 0.89], r * (o.hl2 ?? 0.12), 1, 1, 0);
    const lidMat = W.vinyl({ col: o.lid, finish: o.finish || 'vinyl' });
    const linMat = W._linM || (W._linM = W.vinyl({ col: [1, 1, 1], finish: 'matte', wrap: 0.2 }));
    const RL = r * 1.07, mkLid = (top) => {
      const piv = new THREE.Group();
      const sg = new THREE.SphereGeometry(RL, 32, 10, 0, TAU, top ? 0 : PI / 2, PI / 2);
      piv.add(W.mesh(K.vc(sg), lidMat));
      if (top || o.lowLiner) {
        const lg = K.vc(new THREE.TorusGeometry(RL, r * (o.linerW ?? 0.075), 6, 30, PI), top ? (o.liner || [0.16, 0.1, 0.1]) : lerpC(o.liner || [0.16, 0.1, 0.1], o.lid, 0.5));
        const rim = W.mesh(lg, linMat); rim.rotation.x = PI / 2; piv.add(rim);
        if (top && o.lashes) for (let i = 0; i < o.lashes; i++) {
          const a = PI * (0.08 + 0.1 * i), cg = K.vc(new THREE.ConeGeometry(r * 0.07, r * 0.42, 6), o.liner || [0.16, 0.1, 0.1]);
          const l = W.mesh(cg, linMat); const px = Math.cos(a) * RL * 1.01, pz = Math.sin(a) * RL * 1.01;
          l.position.set(px, r * 0.08, pz); l.rotation.set(0, 0, -PI / 2 + 0.35 + 0.25 * i); piv.add(l);
        }
      }
      const tilt = new THREE.Group(); tilt.add(piv); sock.add(tilt);
      return { piv, tilt };
    };
    const U = mkLid(true), L = mkLid(false);
    if (o.side < 0) U.piv.children.forEach(ch => { if (ch.geometry && ch.geometry.type === 'ConeGeometry') ch.position.x *= -1; });
    if (o.side < 0) U.piv.children.forEach(ch => { if (ch.geometry && ch.geometry.type === 'ConeGeometry') ch.rotation.z *= -1; });
    const st = {
      sock, gaze, U, L, side: o.side, r,
      openU: o.openU ?? -1.05, closeU: o.closeU ?? 0.42, openL: o.openL ?? 1.1, closeL: o.closeL ?? -0.25,
      z0: o.pos[2],
      set(blink, squint, wide, tilt, gx, gy) {
        sock.position.z = st.z0 - blink * blink * r * 0.34;
        const ou = st.openU - wide * 0.2 + squint * 0.22;
        U.piv.rotation.x = lerp(ou, lerp(st.closeU, st.closeU - 0.3, squint), blink);
        L.piv.rotation.x = lerp(lerp(st.openL, st.openL - 0.95, squint), st.closeL, blink * 0.6);
        U.tilt.rotation.z = tilt * st.side * 0.4; L.tilt.rotation.z = -tilt * st.side * 0.1;
        gaze.rotation.y = gx * 0.52; gaze.rotation.x = -gy * 0.36;
      },
    };
    st.set(0, 0, 0, 0, 0, 0);
    return st;
  };
  W.browMesh = (o) => {
    if (o.style === 'dot') return W.ell([o.w * 0.5, o.th, o.th * 0.45], o.col, { matOpt: { finish: o.finish || 'matte' } });
    const w = o.w, th = o.th, ar = o.arch ?? 0.35;
    return W.tube({ ctrl: [[-w / 2, -ar * 0.5, 0], [-w * 0.18, ar * 0.35, 0], [w * 0.18, ar * 0.35, 0], [w / 2, -ar * 0.5, 0]], refs: [[0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1]],
      sec: (s) => { const p = Math.sqrt(Math.max(0, Math.sin(clamp(s) * PI))) * (0.75 + 0.25 * Math.sin(s * PI)); return { w: th * p + 0.03, t: th * 0.45 * p + 0.03, tf: 1, d: 0 }; },
      nu: 12, nv: 16, s0: 0, col: o.col, matOpt: { finish: o.finish || 'matte' }, aoRoot: 0 });
  };
  W.head = async (spec) => {
    const root = new THREE.Group();
    const T0 = performance.now(), tm = {}; let tl = T0; const mark = (k) => { const n = performance.now(); tm[k] = Math.round(n - tl); tl = n; };
    const E = spec.eyes, mo = spec.mouth || {}, c0 = spec.c || [0, 2, -2];
    const base = spec.sdf;
    const er = E.r, sy = E.scaleY || 1, eyeC = [];
    for (const sd of [1, -1]) { const x = sd * E.x, y = E.y, z = W.zAt(base, x, y) - er * (E.sink ?? 0.52); eyeC.push([x, y, z]); }
    const sockR = [er * (E.socket || 1), er * (E.socket || 1) * sy, er * (E.socket || 1)];
    const carve = (E.socket ?? 0) > 0;
    const sdf = carve ? (x, y, z) => { let d = base(x, y, z); for (let i = 0; i < 2; i++) d = K.smax(d, -K.sdEll(x, y, z, eyeC[i], sockR), E.sockK ?? 0.5); return d; } : base;
    const mAt = mo.at || [0, mo.y ?? -4.6, W.zAt(base, 0, mo.y ?? -4.6)];
    const S = K.starSurface({ sdf, c: c0, nu: spec.nu || 88, nv: spec.nv || 60, rmax: spec.rmax || 28, kw: spec.kw ?? 0.5, mouth: { at: mAt, m: mo.m || 4, amp: mo.amp ?? 0.02, shape: mo.shape }, pinch: mo.pinch ?? 0.1 });
    mark('star'); await K.yieldUI();
    const Mc = S.point(S.iM, S.jc, [0, 0, 0]), CL = S.point(S.iM, S.jc + S.mm, [0, 0, 0]), CR = S.point(S.iM, S.jc - S.mm, [0, 0, 0]);
    const ms = mo.ms ?? 1;
    const J = mo.pivot || [0, Mc[1] + 3.0, Mc[2] - 8.5];
    const theta = mo.open ?? 0.5;
    const latSlit = (phi) => S.latOf(S.iM, phi);
    const rowStep = (S.latM + PI / 2) / S.iM, phiC = S.phiC;
    const lowCore = (a) => a < phiC ? lerp(0.5, 1, sst(phiC, phiC * 0.4, a)) : 0.5 * sst(phiC * (mo.wide ?? 3.4), phiC, a);
    const upCore = (a) => a < phiC ? 0.5 * sst(phiC * 0.4, phiC, a) : 0.5 * sst(phiC * (mo.wide ?? 3.4), phiC, a);
    const jawW = (x, y, z, v, m) => {
      const phi = m.phi[v], lat = m.lat[v], sd = m.side[v], a = Math.abs(phi), d = lat - latSlit(phi);
      let w;
      if (sd === -1) w = lowCore(a);
      else if (sd === 1) w = upCore(a);
      else if (d < 0) w = Math.max(lowCore(a), sst(0.9, 0.25, a) * sst(-0.02, -0.3, d) * (mo.chin ?? 1));
      else w = upCore(a) * sst(rowStep * 2.6, 0, d);
      return w * sst(c0[2] - 5, c0[2] + 3, z) * sst(-1.5, -1.0, lat);
    };
    const s2 = [0, 0], nn = [0, 0, 0];
    const fwdOf = (x, y, z, out) => { const dx = x - c0[0], dy = y - c0[1], dz = z - c0[2], l = Math.hypot(dx, dy, dz) || 1; out[0] = dx / l; out[1] = dy / l; out[2] = dz / l; return out; };
    const D = Object.assign({ smile: 1, frown: 1, pucker: 1.2, puff: 1, brow: 0.5, breath: 1 }, spec.deform || {});
    const BL = [eyeC[0][0] * 0.95, eyeC[0][1] + er * sy * 1.5, eyeC[0][2] + 0.4], BR = [-BL[0], BL[1], BL[2]];
    const ck = spec.cheek || {};
    const cheekL = [CL[0] + (ck.dx ?? 1.8) * ms, CL[1] + (ck.dy ?? 1.6) * ms, CL[2] - 1.2 * ms], cheekR = [-cheekL[0], cheekL[1], cheekL[2]];
    const puffL = [CL[0] + (ck.px ?? 3.0) * ms, CL[1] + (ck.py ?? 1.0) * ms, CL[2] - 1.6 * ms], puffR = [-puffL[0], puffL[1], puffL[2]], puffS = (ck.ps ?? 3.4) * ms;
    const morphs = [
      { name: 'jaw', fn: (x, y, z, v, m, out) => {
        const w = jawW(x, y, z, v, m); if (w <= 0) return;
        K.rotX(y, z, J[1], J[2], theta * w, s2); out[1] = s2[0] - y; out[2] = s2[1] - z;
        const lat = m.lat[v], phi = m.phi[v], a = Math.abs(phi), dd = Math.abs(lat - latSlit(phi));
        const roll = sst(rowStep * 2.2, 0, dd) * sst(phiC, phiC * 0.6, a) * (mo.roll ?? 0.3);
        fwdOf(x, y, z, nn); out[0] -= nn[0] * roll; out[1] -= nn[1] * roll; out[2] -= nn[2] * roll;
        if (m.side[v] === 1 || (lat > latSlit(phi) && dd < rowStep * 1.5)) out[1] += (mo.lift ?? 0.35) * sst(phiC, 0, a);
        if (a < phiC * 1.6) out[0] += Math.sign(phi) * (mo.widen ?? 0.35) * sst(phiC * 0.3, phiC, a) * sst(rowStep * 3, 0, dd);
      } },
      { name: 'smileL', fn: (x, y, z, v, m, out) => { const g = K.gw(x, y, z, CL, 1.5 * ms), g2 = K.gw(x, y, z, cheekL, 2.6 * ms); out[0] = (0.55 * g + 0.2 * g2) * D.smile; out[1] = (1.5 * g + 0.8 * g2) * D.smile; out[2] = (-0.4 * g + 0.45 * g2) * D.smile; } },
      { name: 'smileR', fn: (x, y, z, v, m, out) => { const g = K.gw(x, y, z, CR, 1.5 * ms), g2 = K.gw(x, y, z, cheekR, 2.6 * ms); out[0] = -(0.55 * g + 0.2 * g2) * D.smile; out[1] = (1.5 * g + 0.8 * g2) * D.smile; out[2] = (-0.4 * g + 0.45 * g2) * D.smile; } },
      { name: 'frownL', fn: (x, y, z, v, m, out) => { const g = K.gw(x, y, z, CL, 1.7 * ms); out[0] = 0.1 * g * D.frown; out[1] = -1.15 * g * D.frown; out[2] = 0.05 * g; } },
      { name: 'frownR', fn: (x, y, z, v, m, out) => { const g = K.gw(x, y, z, CR, 1.7 * ms); out[0] = -0.1 * g * D.frown; out[1] = -1.15 * g * D.frown; out[2] = 0.05 * g; } },
      { name: 'pucker', fn: (x, y, z, v, m, out) => { const sw = Math.max(2.4 * ms, 0.8 * Math.abs(CL[0])), g = K.gw(x, y, z, Mc, sw), g2 = K.gw(x, y, z, Mc, 1.3 * ms); out[0] = -(x - Mc[0]) * (0.24 + 0.2 * K.clamp((sw - 2.4 * ms) / 2)) * g * D.pucker; out[1] = -(y - Mc[1]) * 0.1 * g; out[2] = (0.75 * g + 0.35 * g2) * D.pucker; } },
      { name: 'puff', fn: (x, y, z, v, m, out) => { const g = K.gw(x, y, z, puffL, puffS) + K.gw(x, y, z, puffR, puffS); fwdOf(x, y, z, nn); const k = 2.2 * g * D.puff; out[0] = nn[0] * k + Math.sign(x) * g * 0.6 * D.puff; out[1] = nn[1] * k; out[2] = nn[2] * k; } },
      { name: 'browUpL', fn: (x, y, z, v, m, out) => { const g = K.gw(x, y, z, BL, 2.4 * ms); out[1] = 1.4 * g * D.brow; out[2] = 0.1 * g * D.brow; } },
      { name: 'browUpR', fn: (x, y, z, v, m, out) => { const g = K.gw(x, y, z, BR, 2.4 * ms); out[1] = 1.4 * g * D.brow; out[2] = 0.1 * g * D.brow; } },
      { name: 'browDnL', fn: (x, y, z, v, m, out) => { const g = K.gw(x, y, z, [BL[0] - er * 0.4, BL[1], BL[2]], 2.2 * ms); out[1] = -1.0 * g * D.brow; out[2] = 0.35 * g * D.brow; } },
      { name: 'browDnR', fn: (x, y, z, v, m, out) => { const g = K.gw(x, y, z, [BR[0] + er * 0.4, BR[1], BR[2]], 2.2 * ms); out[1] = -1.0 * g * D.brow; out[2] = 0.35 * g * D.brow; } },
      { name: 'breath', fn: (x, y, z, v, m, out) => { const w = sst(c0[1] + 2, c0[1] - 6, y) * 0.22 * D.breath; out[0] = (x - c0[0]) * w * 0.05; out[1] = -w * 0.15; out[2] = (z - c0[2]) * w * 0.035; } },
    ];
    if (spec.morphs) morphs.push(...spec.morphs({ S, Mc, CL, CR, J, eyeC, er }));
    const hi = S.mesh(1);
    let noseAt = null;
    if (spec.nose) {
      const n = spec.nose; const ny = n.y ?? (Mc[1] + 1.6), nx = n.x ?? 0;
      const zz = W.zAt(sdf, nx, ny); noseAt = n.at || [nx, ny, zz + (n.out ?? n.d * 0.35)]; n.at = noseAt;
    }
    const cx = { S, Mc, CL, CR, eyeC, er, noseAt, J, ms, sdf, spec };
    const info = { phi: 0, lat: 0, nx: 0, ny: 0, nz: 0 }, P = [0, 0, 0], col = [0, 0, 0];
    const lipC = mo.line || [0.24, 0.12, 0.12];
    const bl = spec.blush;
    const blushAt = bl ? [[bl.x ?? (E.x + 0.6), bl.y ?? (E.y - er * sy - 1.2)], [-(bl.x ?? (E.x + 0.6)), bl.y ?? (E.y - er * sy - 1.2)]] : null;
    const bf = (u, v, out) => {
      S.uvPoint(u, v, P, info); const x = P[0], y = P[1], z = P[2];
      spec.color(x, y, z, info, col, cx);
      if (spec.paint) spec.paint(x, y, z, info, col, cx);
      if (bl) for (let i = 0; i < 2; i++) {
        const dx = (x - blushAt[i][0]) / (bl.rx ?? 1.9), dy = (y - blushAt[i][1]) / (bl.ry ?? 1.25), r = Math.sqrt(dx * dx + dy * dy);
        const fz = sst(c0[2] + 1, c0[2] + 5, z); const k = sst(1.0, 0.15, r) * fz * (bl.k ?? 0.75);
        K.mixIn(col, bl.col || [0.98, 0.55, 0.6], k);
        if (bl.lines) {   // three little slanted strokes ("///")
          let ln = 0; for (let s = -1; s <= 1; s++) { const u = dx - s * 0.42 + dy * 0.42; ln = Math.max(ln, sst(0.11, 0.04, Math.abs(u)) * sst(0.62, 0.42, Math.abs(dy))); }
          K.mixIn(col, bl.lineCol || [0.86, 0.36, 0.42], ln * fz * 0.9);
        }
      }
      const phi = info.phi, a = Math.abs(phi), R = Math.hypot(x - c0[0], y - c0[1], z - c0[2]);
      const d = (info.lat - S.latOf(S.iM, phi)) * R;
      const inMouth = sst(phiC * 1.06, phiC * 0.88, a);
      const lw = mo.lw ?? 0.2; let line = lw > 0.02 ? sst(lw, lw * 0.3, Math.abs(d)) * inMouth : 0;
      if (mo.phil && noseAt) line = Math.max(line, sst(mo.pw ?? 0.11, 0.03, Math.abs(x)) * sst(Mc[1] - 0.05, Mc[1] + 0.25, y) * sst(noseAt[1] - (spec.nose.h || 0.5) * 0.7, noseAt[1] - (spec.nose.h || 0.5) * 1.3, y) * sst(Mc[2] - 3, Mc[2] - 1, z));
      K.mixIn(col, lipC, line);
      out[0] = col[0]; out[1] = col[1]; out[2] = col[2];
    };
    const map = W.bake(spec.tw || 512, spec.th || 384, bf, true);
    mark('bake'); await K.yieldUI();
    const aoSdf = (x, y, z) => { let d = sdf(x, y, z); for (let i = 0; i < 2; i++) d = Math.min(d, K.sdEll(x, y, z, eyeC[i], [er, er * sy, er])); if (spec.aoExtra) d = spec.aoExtra(x, y, z, d); return d; };
    const geo = K.toGeometry(hi, morphs, null, false);
    W.setColors(geo, W.ao(hi.pos, hi.nrm, hi.n, aoSdf, { tint: spec.aoTint, k: spec.aoK ?? 1 }));
    const headMat = W.vinyl(Object.assign({ map, finish: spec.finish || 'vinyl' }, spec.matOpt || {}));
    const head = W.mesh(geo, headMat); root.add(head);
    const mi = {}; morphs.forEach((mm, i) => { mi[mm.name] = i; });
    head.userData.mi = mi;
    mark('morph'); await K.yieldUI();
    const sampleCol = (x, y, z) => { const q = S.hit(x - c0[0], y - c0[1], z - c0[2], [0, 0, 0]); const dir = [q[0] - c0[0], q[1] - c0[1], q[2] - c0[2]]; const l = Math.hypot(...dir); const o = [0, 0, 0]; spec.color(q[0], q[1], q[2], { phi: Math.atan2(dir[0], dir[2]), lat: Math.asin(dir[1] / l), nx: dir[0] / l, ny: dir[1] / l, nz: dir[2] / l }, o, cx); if (spec.paint) spec.paint(q[0], q[1], q[2], { phi: Math.atan2(dir[0], dir[2]), lat: Math.asin(dir[1] / l), nx: dir[0] / l, ny: dir[1] / l, nz: dir[2] / l }, o, cx); return o; };
    const lidOf = (i) => E.lid || sampleCol(eyeC[i][0], eyeC[i][1] + er * sy * 0.9, eyeC[i][2] + er).map(v => v * (E.lidK ?? 1));
    const eyes = [1, -1].map((sd, i) => W.eye(Object.assign({ yaw: 0.22, pitch: -0.05, roll: 0 }, E, { pos: eyeC[i], side: sd, lid: lidOf(i), finish: spec.finish })));
    eyes.forEach(e => root.add(e.sock));
    const jawPiv = new THREE.Group(); jawPiv.position.set(J[0], J[1], J[2]); root.add(jawPiv);
    const toJaw = (p) => [p[0] - J[0], p[1] - J[1], p[2] - J[2]];
    const mw = Math.abs(CL[0]);
    const deep = mo.deep || [0.36, 0.08, 0.12], edge = mo.edge || [0.72, 0.26, 0.32];
    const bagCol = (g2) => { const pp = g2.attributes.position, a = new Float32Array(pp.count * 3); for (let i = 0; i < pp.count; i++) { const z = pp.getZ(i), y = pp.getY(i); const t = sst(-0.3, 0.95, z) * 0.85 + sst(0.5, 1.0, Math.abs(y)) * 0.15; const q2 = lerpC(deep, edge, t); tmpC.setRGB(q2[0], q2[1], q2[2], THREE.SRGBColorSpace); a[i * 3] = tmpC.r; a[i * 3 + 1] = tmpC.g; a[i * 3 + 2] = tmpC.b; } g2.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g2; };
    const bagMat = W._bagM || (W._bagM = W.vinyl({ finish: 'matte', wrap: 0.1, sssK: 0.1, cc: 0.2 }));
    const inside = (g2) => { const ix = g2.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } const nr = g2.attributes.normal.array; for (let i = 0; i < nr.length; i++) nr[i] = -nr[i]; return g2; };
    const bagB = { x: 0, y: Mc[1] - (mo.bagY ?? 0.4) * ms, z: Mc[2] - (mo.bagZ ?? 1.9) * ms, rx: mw + (mo.bagX ?? 0.4) * ms, ry: (mo.bagH ?? 2.0) * ms, rz: (mo.bagD ?? 2.2) * ms };
    const bgeo = inside(bagCol(new THREE.SphereGeometry(1, 28, 18)));
    bgeo.scale(bagB.rx, bagB.ry, bagB.rz); bgeo.translate(bagB.x, bagB.y, bagB.z);
    {
      const bp = bgeo.attributes.position, md = new Float32Array(bp.count * 3), zs = Math.max(4, Mc[2] - c0[2]), q2 = [0, 0];
      for (let i = 0; i < bp.count; i++) {
        const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i), a = Math.atan2(Math.abs(x), zs);
        const w = lowCore(a) * sst(Mc[1] + 0.25, Mc[1] - 0.4, y); if (w <= 0) continue;
        K.rotX(y, z, J[1], J[2], theta * w, q2); md[i * 3 + 1] = q2[0] - y; md[i * 3 + 2] = q2[1] - z;
      }
      bgeo.morphAttributes.position = [new THREE.BufferAttribute(md, 3)]; bgeo.morphTargetsRelative = true;
    }
    const bagM = W.mesh(bgeo, W._bagMM || (W._bagMM = W.vinyl({ finish: 'matte', wrap: 0.1, sssK: 0.1, cc: 0.2 }))); root.add(bagM);
    const plug = W.mesh(K.vc(new THREE.SphereGeometry(1, 16, 10), deep.map(v => v * 0.75)), bagMat);
    plug.position.set(0, bagB.y - bagB.ry * 0.2, bagB.z - bagB.rz * 0.75); plug.scale.set(bagB.rx * 0.9, bagB.ry * 1.3, bagB.rz * 0.45); root.add(plug);
    const bag = { set visible(v) { bagM.visible = plug.visible = v; } };
    let tongue = null;
    if (mo.tongue !== false) {
      const Tt = Object.assign({ w: mw * 0.7, t: 0.4 * ms, L: 2.4 * ms }, mo.tongue || {});
      tongue = W.tongue(Tt);
      const tg = new THREE.Group(); const tp = toJaw([0, bagB.y - bagB.ry * 0.5, Mc[2] - Tt.L - (mo.tongueBack ?? 0.5) * ms]); tg.position.set(...tp); tg.add(tongue);
      tongue.userData.rest = tp; tongue.userData.g = tg; jawPiv.add(tg);
    }
    if (mo.teeth) {   // two buck teeth under the upper lip (bunny, hamster, beaver…)
      const f = mo.teeth;
      for (const sd of [1, -1]) { const t = W.tooth(f.w || 0.55 * ms, f.h || 0.9 * ms, f.d || 0.3 * ms, f.col); t.position.set(sd * (f.w || 0.55 * ms) * 0.54, Mc[1] + (f.y ?? 0.3) * ms, Mc[2] + (f.z ?? -0.05) * ms); t.rotation.x = f.rx ?? -0.1; root.add(t); }
    }
    if (mo.fangs) {   // tiny fangs (kitten, dragon)
      const f = mo.fangs;
      for (const sd of [1, -1]) { const up = W.fang(f.r || 0.16 * ms, f.l || 0.5 * ms, f.col); up.position.set(sd * mw * (f.x ?? 0.55), Mc[1] + 0.05, Mc[2] - (f.back ?? 0.35) * ms); root.add(up); }
    }
    let nose = null;
    if (spec.nose) { nose = W.nose(spec.nose); nose.position.set(...noseAt); if (spec.nose.rx) nose.rotation.x = spec.nose.rx; root.add(nose); }
    let beak = null;
    if (spec.beak) {
      const b = spec.beak, rx = b.rx ?? 0.2, by = b.y ?? (Mc[1] + 0.4);
      const at = b.at || [0, by, W.zAt(sdf, 0, by) - (b.sink ?? 0.3)];
      const up = W.beak(Object.assign({}, b, { lower: false })); up.position.set(...at); up.rotation.x = rx; root.add(up);
      const lw = W.beak(Object.assign({}, b, { lower: true, L: b.L * (b.lowL ?? 0.82), W: b.W * 0.92, T: b.T * (b.lowT ?? 0.8), hook: b.lowHook ?? 0.05, col: b.lowCol || b.col, tipCol: b.lowTip || b.tipCol }));
      const lp = toJaw([at[0], at[1] - (b.gap ?? 0.1), at[2] - 0.1]); lw.position.set(...lp); lw.rotation.x = rx + (b.lowRx ?? 0.08); jawPiv.add(lw);
      beak = { up, lw, at };
    }
    const whisk = [];
    if (spec.whiskers) {
      const W2 = spec.whiskers;
      for (const sd of [1, -1]) {
        const grp = new THREE.Group(); const px = sd * W2.at[0], py = W2.at[1]; grp.position.set(px, py, W.zAt(sdf, px, py) - 0.15);
        const list = [];
        for (let i = 0; i < W2.n; i++) { const t = W2.n > 1 ? i / (W2.n - 1) : 0.5; list.push({ root: [0, (W2.dy ?? 0.7) * (0.5 - t), 0], dir: [sd, lerp(W2.up ?? 0.28, W2.down ?? -0.28, t), W2.fwd ?? 0.2], len: W2.len * (1 - 0.1 * Math.abs(t - 0.4)), droop: W2.droop ?? 0.08, lift: 0.04 }); }
        grp.add(W.whiskers(list, { col: W2.col, r0: W2.r0, r1: W2.r1 })); root.add(grp); whisk.push(grp);
      }
    }
    const brows = [];
    if (spec.brows) {
      const bo = Object.assign({ style: 'bean', w: 2.2, th: 0.32, arch: 0.35, col: [0.3, 0.2, 0.16], x: E.x * 0.92, y: E.y + er * sy * 1.45 + 0.4, up: 1.1, dn: 0.6, tilt: 0 }, spec.brows);
      const tmpN = [0, 0, 0];
      for (const sd of [1, -1]) {
        const mesh = W.browMesh(bo), obj = new THREE.Group(); obj.add(mesh); root.add(obj);
        const pts = [0, bo.up, -bo.dn].map(dy => { const x = sd * bo.x, y = bo.y + dy; let z = W.zAt(sdf, x, y); if (z < -25) z = W.zAt(sdf, x, bo.y); const n = W.normalAt(sdf, x, y, z, tmpN); return [x + n[0] * 0.12, y + n[1] * 0.12, z + n[2] * 0.12, n[0], n[1], n[2]]; });
        const q = pts.map(p => { const o3 = new THREE.Object3D(); o3.position.set(p[0], p[1], p[2]); o3.lookAt(p[0] + p[3], p[1] + p[4], p[2] + p[5]); return o3.quaternion.clone(); });
        brows.push({ obj, side: sd, pts, q, rest: bo.tilt * sd, tq: new THREE.Quaternion(), zq: new THREE.Quaternion(), ax: new THREE.Vector3(0, 0, 1) });
      }
    }
    const ears = [];
    if (spec.ears) {
      const EA = spec.ears;
      for (const sd of [1, -1]) {
        const ear = EA.build(sd);
        const dx = EA.dir[0] * sd - c0[0], dy = EA.dir[1] - c0[1], dz = EA.dir[2] - c0[2], l = Math.hypot(dx, dy, dz);
        const q = S.hit(dx, dy, dz, [0, 0, 0]); const sk = EA.sink ?? 0.4;
        const holder = new THREE.Group(); holder.position.set(q[0] - dx / l * sk, q[1] - dy / l * sk, q[2] - dz / l * sk);
        holder.rotation.set(EA.rot[0], EA.rot[1] * sd, EA.rot[2] * sd, 'YXZ');
        const piv = new THREE.Group(); piv.add(ear); holder.add(piv);
        if (sd < 0 && EA.mirror) holder.scale.x = -1;
        root.add(holder); ears.push({ piv, holder, sd, ear, kind: EA.kind || 'up' });
      }
    }
    mark('parts');
    root.userData.timings = tm;
    const ctx = { root, S, head, mi, eyes, ears, nose, beak, whisk, brows, jawPiv, bag, bagM, bagB, tongue, Mc, CL, CR, J, theta, spec, sampleCol, eyeC, er, ms, cx, sdf, wob: [], sniff: [] };
    if (spec.extra) await spec.extra(ctx);
    K.finish(root);
    tm.total = Math.round(performance.now() - T0);
    return ctx;
  };
  W.onSurf = (ctx, obj, dir, rot, sink = 0.3) => {
    const c0 = ctx.spec.c || [0, 2, -2], dx = dir[0] - c0[0], dy = dir[1] - c0[1], dz = dir[2] - c0[2], l = Math.hypot(dx, dy, dz);
    const q = ctx.S.hit(dx, dy, dz, [0, 0, 0]);
    const h = new THREE.Group(); h.position.set(q[0] - dx / l * sink, q[1] - dy / l * sink, q[2] - dz / l * sink);
    if (rot) h.rotation.set(rot[0], rot[1], rot[2], 'YXZ');
    h.add(obj); ctx.root.add(h); return h;
  };
  W.wobble = (ctx, obj, o = {}) => { const w = { obj, rx: obj.rotation.x, ry: obj.rotation.y, rz: obj.rotation.z, k: o.k ?? 0.08, idle: o.idle ?? 0.04, f: o.f ?? 1.3, ph: o.ph ?? Math.random() * 6, ex: o.ex || null, side: o.side || 0 }; ctx.wob.push(w); return w; };
  W.rig = (ctx, opt = {}) => {
    const ex = K.makeExpr(), mot = K.makeMotion(opt.motionRoot || ctx.root);
    const spEar = mot.spring(opt.earK ?? 42, opt.earC ?? 4.2, 1, 4), spW = mot.spring(opt.wobK ?? 26, opt.wobC ?? 3.0, 1, 5), spWh = mot.spring(80, 6, 1, 2);
    const st = { ex, mot, spEar, spW };
    const seed = opt.seed || 1, mi = ctx.mi, inf = ctx.head.morphTargetInfluences;
    const set = (n, v) => { const i = mi[n]; if (i !== undefined) inf[i] = v; };
    const twitch = (t, k) => { const ph = t * 0.31 + k * 1.7 + seed * 0.37; const f = ph - Math.floor(ph); return f < 0.07 ? Math.sin(f / 0.07 * PI) : 0; };
    const qz = ctx.brows.length ? ctx.brows[0].zq : null;
    st.update = (bs, t, snap) => {
      const e = ex.update(bs, t, snap); const dt = e.dt; mot.update(dt, snap);
      const jaw = Math.max(e.jaw, e.tongue * 0.32, e.funnel * 0.3, e.pucker * 0.12);
      set('jaw', jaw);
      set('smileL', e.smileL * (1 - jaw * 0.3)); set('smileR', e.smileR * (1 - jaw * 0.3));
      set('frownL', e.frownL * (1 - e.smileL)); set('frownR', e.frownR * (1 - e.smileR));
      set('pucker', Math.max(e.pucker, e.funnel * 0.6) * (1 - jaw * 0.6));
      set('puff', e.puff);
      set('browUpL', e.browUpL); set('browUpR', e.browUpR); set('browDnL', e.browDnL); set('browDnR', e.browDnR);
      set('breath', snap ? 0.5 : 0.5 + 0.5 * Math.sin(t * 2.1 + seed));
      ctx.jawPiv.rotation.x = ctx.theta * jaw;
      ctx.bag.visible = jaw > 0.012; ctx.bagM.morphTargetInfluences[0] = jaw;
      if (ctx.tongue) {
        const tg = ctx.tongue.userData.g, r = ctx.tongue.userData.rest, to = e.tongue;
        tg.position.set(r[0], r[1] + to * 0.3 * ctx.ms, r[2] + to * (ctx.spec.mouth.tongueOut ?? 3.0) * ctx.ms); tg.rotation.x = to * 0.45; tg.scale.z = 1 + to * 0.3; tg.visible = jaw > 0.012 || to > 0.02;
      }
      const sq = e.smile * (opt.smileSquint ?? 0.9);
      for (let i = 0; i < ctx.eyes.length; i++) {
        const ey = ctx.eyes[i], L = ey.side > 0;
        const b = L ? e.blinkL : e.blinkR, sqz = Math.max(sq, (L ? e.squintL : e.squintR) * 0.45), wd = L ? e.wideL : e.wideR, bd = L ? e.browDnL : e.browDnR;
        const tilt = bd * 1.1 - e.browIn * 0.8;
        ey.set(Math.max(b, bd * 0.18), Math.max(sqz, bd * 0.25) * (1 - b), Math.max(wd, (L ? e.browUpL : e.browUpR) * 0.4), tilt, e.gx, e.gy);
      }
      for (let i = 0; i < ctx.brows.length; i++) {
        const B = ctx.brows[i], L = B.side > 0, up = L ? e.browUpL : e.browUpR, dn = L ? e.browDnL : e.browDnR, p = B.pts;
        const wu = up * (1 - dn * 0.5), wd = dn;
        B.obj.position.set(p[0][0] + (p[1][0] - p[0][0]) * wu + (p[2][0] - p[0][0]) * wd, p[0][1] + (p[1][1] - p[0][1]) * wu + (p[2][1] - p[0][1]) * wd + (snap ? 0 : spW.x.y * 0.02), p[0][2] + (p[1][2] - p[0][2]) * wu + (p[2][2] - p[0][2]) * wd);
        B.tq.copy(B.q[0]); if (wu > 0) B.tq.slerp(B.q[1], wu); if (wd > 0) B.tq.slerp(B.q[2], wd);
        const tilt = B.rest + B.side * (dn * 0.42 - e.browIn * 0.32 + (L ? e.browOutL : e.browOutR) * 0.12);
        qz.setFromAxisAngle(B.ax, tilt); B.obj.quaternion.copy(B.tq).multiply(qz);
      }
      if (ctx.nose) { const n0 = ctx.spec.nose.at, sn = opt.sniff || 0; ctx.nose.position.set(n0[0], n0[1] + e.smile * 0.1 + (snap ? 0 : Math.sin(t * 12) * sn * (0.5 + 0.5 * Math.sin(t * 0.8))), n0[2] + e.pucker * 0.25); }
      const wx = spWh.x;
      for (let i = 0; i < ctx.whisk.length; i++) { const w = ctx.whisk[i], sd = i === 0 ? 1 : -1, sm = sd > 0 ? e.smileL : e.smileR; w.rotation.z = sd * (sm * 0.3 - e.frown * 0.2 + (snap ? 0 : Math.sin(t * 1.3 + i) * 0.03) + wx.y * 0.08); w.rotation.y = -sd * (e.pucker * 0.25 + wx.x * 0.05); }
      const ex2 = spEar.x, g = mot.grav;
      for (let i = 0; i < ctx.ears.length; i++) {
        const ea = ctx.ears[i], sd = ea.sd, tw = snap ? 0 : twitch(t, i) * (opt.twitch ?? 0.3);
        const back = e.browDn * (opt.earBack ?? 0.35) - e.browUp * (opt.earPerk ?? 0.2) + (opt.earFrown ?? 0.25) * e.frown;
        const sway = snap ? 0 : Math.sin(t * 1.1 + i * 2.1 + seed) * (opt.earSway ?? 0.025);
        if (ea.kind === 'floppy') {
          ea.piv.rotation.x = ex2.z * 0.07 + tw * 0.15 + (snap ? 0 : -g.z * 0.25);
          ea.piv.rotation.z = sd * (-(e.browUp * 0.28 + e.smile * 0.1) + e.frown * 0.1 + tw * 0.2 + sway) + ex2.x * 0.08 + (snap ? 0 : g.x * 0.3);
          ea.piv.rotation.y = 0;
        } else {
          ea.piv.rotation.x = -back + ex2.z * 0.09 + tw * 0.35 + sway * 0.5;
          ea.piv.rotation.z = sd * (-back * 0.3 + tw * 0.25 + sway) + ex2.x * 0.09;
          ea.piv.rotation.y = ex2.x * 0.03;
        }
      }
      const wx2 = spW.x;
      for (let i = 0; i < ctx.wob.length; i++) {
        const w = ctx.wob[i], id = snap ? 0 : Math.sin(t * w.f + w.ph) * w.idle;
        w.obj.rotation.x = w.rx + wx2.z * w.k + id * 0.6 + (w.ex ? (w.ex.x || 0) * (e[w.ex.k] || 0) : 0);
        w.obj.rotation.z = w.rz + wx2.x * w.k + id + (w.ex ? (w.ex.z || 0) * (e[w.ex.k] || 0) * (w.side || 1) : 0);
        w.obj.rotation.y = w.ry;
      }
      if (opt.extra) opt.extra(e, t, dt, mot, snap);
      return e;
    };
    return st;
  };
  W.finishHead = (ctx, opt) => { ctx.root.userData.rig = W.rig(ctx, opt); ctx.root.userData.ctx = ctx; return ctx.root; };
  return W;
}
function KW_UPDATE(g, bs, t) { const r = g.userData.rig; if (r) r.update(bs || {}, t, !!g.userData.snap); g.userData.snap = false; }
function KPETS(THREE, H, K, W) {
  const { clamp, sst } = K;
  const Q = {};
  Q.body = (o = {}) => {
    const w = o.w ?? 1, hh = o.h ?? 1;
    const prims = [
      [[0, -7.5 * hh, -0.5], [8.2 * w, 8.2 * hh, 7.6], 0],
      [[0, -12.0 * hh, 0.5], [9.2 * w, 4.8 * hh, 8.2], 3.5],
    ];
    if (o.feet !== false) for (const sd of [1, -1]) prims.push([[sd * 4.6 * w, -15.6 * hh, 4.6], [2.9, 1.9, 3.4], 1.6]);
    if (o.arms !== false) for (const sd of [1, -1]) prims.push([[sd * 6.4 * w, -7.4 * hh, 4.4], [2.1, 3.4, 2.3], 1.8]);
    if (o.prims) prims.push(...o.prims);
    const sdf0 = W.sdfOf(prims), sdf = (x, y, z) => K.smax(sdf0(x, y, z), -(y + 17.2 * hh), 1.0);
    const me = W.part({ sdf, c: [0, -9 * hh, 0.5], nu: o.nu || 56, nv: o.nv || 40, rmax: 20, kw: 0.15, tw: 192, th: 128, color: o.color, matOpt: { finish: o.finish || 'vinyl' }, aoOpt: { k: 1.0 } });
    me.userData.sdf = sdf; return me;
  };
  Q.pet = async (o) => {
    const root = new THREE.Group(), inner = new THREE.Group(); root.add(inner); inner.scale.setScalar(o.scale || 0.3);
    const body = Q.body(o.body); inner.add(body);
    const headPiv = new THREE.Group(); headPiv.position.set(0, o.neckY ?? -1.2, 0.4); inner.add(headPiv);
    o.head.nu = o.head.nu || 64; o.head.nv = o.head.nv || 44; o.head.tw = o.head.tw || 256; o.head.th = o.head.th || 192;
    const ctx = await W.head(o.head);
    ctx.root.position.set(0, o.headY ?? 10.2, 0); headPiv.add(ctx.root);
    await K.yieldUI();
    const rig = W.rig(ctx, Object.assign({ motionRoot: o.g, seed: o.seed || 3 }, o.rigOpt || {}));
    const spB = rig.mot.spring(20, 3, 1, 6);
    const st = { root, inner, body, headPiv, ctx, rig, spB, bob: 0 };
    st.update = (bs, t, snap) => {
      const e = rig.update(bs, t, snap);
      const look = o.look || [0.55, 0.32], k = snap ? 1 : 0.15;
      const hx = clamp(e.gx * look[0] + (o.lookBias ? o.lookBias(t, e, snap) : 0), -0.9, 0.9), hy = clamp(e.gy * look[1], -0.5, 0.5);
      headPiv.rotation.y += (hx - headPiv.rotation.y) * k;
      headPiv.rotation.x += (-hy + (snap ? 0 : Math.sin(t * 0.7) * 0.03) - e.jaw * 0.06 - headPiv.rotation.x) * k;
      headPiv.rotation.z = (snap ? 0 : Math.sin(t * 0.53) * 0.04 + spB.x.x * 0.015) + e.browIn * 0.12 * (o.tiltSide || 1);
      const br = snap ? 0 : Math.sin(t * 2.4 + (o.seed || 0)) * 0.012;
      body.scale.set(1 + br, 1 - br * 0.5, 1 + br);
      inner.rotation.z = snap ? 0 : -spB.x.x * 0.02; inner.rotation.x = snap ? 0 : spB.x.z * 0.015;
      if (o.extra) o.extra(st, e, t, snap);
      return e;
    };
    K.finish(root);
    return st;
  };
  return Q;
}
function KW_PET_UPDATE(g, bs, t) { const p = g.userData.pet; if (p) p.update(bs || {}, t, !!g.userData.snap); g.userData.snap = false; }
export const meta = { label: 'Pinguino kawaii', labelEn: 'Kawaii penguin', category: 'personaggi', icon: '🐧' };
export const hideHead = true;
export default async function build(THREE, h) {
  const K = KIT(THREE, h), W = KAWAII(THREE, h, K);
  const B = K.blob;
  const navy = [0.32, 0.4, 0.55], navy2 = [0.25, 0.31, 0.44], white = [1.0, 0.98, 0.95], ora = [1.0, 0.62, 0.2];
  const sh = W.chibi({ w: 1.02, cheek: 1.1 });
  const mask = (x, y, z) => Math.max(B(x, y, z, [3.7, 0.4, 9], [4.6, 5.2, 4.5], 0.22), B(x, y, z, [-3.7, 0.4, 9], [4.6, 5.2, 4.5], 0.22), B(x, y, z, [0, -4.8, 7.5], [8.2, 5.0, 6], 0.22));
  const spec = {
    c: sh.c, sdf: sh.sdf, finish: 'vinyl',
    color: (x, y, z, info, o) => { K.setC(o, navy); K.mixIn(o, navy2, K.sst(0.3, 1.0, info.ny) * 0.5); K.mixIn(o, white, mask(x, y, z)); },
    eyes: { x: 4.4, y: 0.6, r: 2.55, scaleY: 1.06, iris: [[0.04, 0.04, 0.06], [0.24, 0.24, 0.34], [0.03, 0.03, 0.05]], ir: 0.45, pupil: 0.62, liner: [0.16, 0.18, 0.26], lashes: 0 },
    mouth: { y: -3.2, m: 3, amp: 0, lw: 0, tongue: { col: [0.98, 0.5, 0.56], w: 1.0, L: 1.8 }, open: 0.32, ms: 0.85, bagX: 0.6 },
    beak: { y: -2.4, L: 2.5, W: 1.55, T: 1.5, hook: 0.12, col: ora, tipCol: [0.98, 0.5, 0.12], sink: 0.5, rx: 0.15 },
    brows: { style: 'bean', w: 1.6, th: 0.3, col: [0.3, 0.35, 0.48], y: 4.7 },
    blush: { col: [1.0, 0.56, 0.6], k: 0.7, x: 5.6, y: -2.4 },
    extra: (ctx) => {
      // a little cowlick on top
      const t = W.tube({ ctrl: [[0, -0.6, 0], [0.2, 1.6, 0.3], [1.3, 2.8, 0.2], [2.0, 2.2, -0.2]], r: (s) => 0.75 * (1 - 0.8 * s) + 0.08, nu: 10, nv: 16, col: navy2, matOpt: { finish: 'gloss' } });
      const p = new THREE.Group(); p.add(t); W.onSurf(ctx, p, [0, 14, 1], [0, 0, 0], 0.5); W.wobble(ctx, p, { k: 0.12, idle: 0.05, f: 1.4 });
    },
  };
  const ctx = await W.head(spec);
  return W.finishHead(ctx, { seed: 17 });
}
export function update(g, bs, t) { KW_UPDATE(g, bs, t); }
