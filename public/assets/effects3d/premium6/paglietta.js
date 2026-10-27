// Tiditalk — effetto viso 3D "paglietta" (premium6). Codice originale, AGPL-3.0. GENERATO da _src/fx/paglietta.js + _src/lib (node _src/build.mjs): modificare i sorgenti.

// lib/head.js
var HULL = { c: [0, 2.4, -4], r: [8.1, 11.6, 9.9] };
var clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
var smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
function hullAt(theta, phi, off, P, N) {
  const c = HULL.c, r = HULL.r;
  const sx = Math.sin(theta) * Math.sin(phi), sy = Math.cos(theta), sz = Math.sin(theta) * Math.cos(phi);
  N.set(sx / r[0], sy / r[1], sz / r[2]).normalize();
  P.set(c[0] + r[0] * sx, c[1] + r[1] * sy, c[2] + r[2] * sz);
  if (off) P.addScaledVector(N, off);
  return P;
}
function thetaAtY(y) {
  return Math.acos(clamp((y - HULL.c[1]) / HULL.r[1], -1, 1));
}
function bandRing(THREE, { yF = 8.6, yB = 4.4, gap = () => 0.6, lift = null, n = 96 } = {}) {
  const V = THREE.Vector3;
  const F = hullAt(thetaAtY(yF), 0, 0, new V(), new V());
  const B = hullAt(thetaAtY(yB), Math.PI, 0, new V(), new V());
  const d = new V().subVectors(B, F);
  const axis = new V(0, -d.z, d.y).normalize();
  if (axis.y < 0) axis.negate();
  const P = [], N = [], T = [], PH = [], G = [];
  const p = new V(), nn = new V();
  for (let i = 0; i <= n; i++) {
    const phi = i / n * Math.PI * 2;
    const off = lift ? lift(phi) : 0;
    let a = 0.02, b = Math.PI - 0.02;
    for (let k = 0; k < 40; k++) {
      const m = (a + b) / 2;
      hullAt(m, phi, 0, p, nn);
      const g2 = axis.dot(p.clone().sub(F)) - off;
      if (g2 > 0) a = m;
      else b = m;
    }
    const th = (a + b) / 2;
    hullAt(th, phi, 0, p, nn);
    const gp = gap(phi);
    P.push(p.clone().addScaledVector(nn, gp));
    N.push(nn.clone());
    T.push(th);
    PH.push(phi);
    G.push(gp);
  }
  const C = new V();
  for (let i = 0; i < n; i++) C.add(P[i]);
  C.divideScalar(n);
  const fwd = new V(0, 0, 1).projectOnPlane(axis).normalize();
  const side = new V().crossVectors(axis, fwd).normalize();
  return { n, P, N, T, G, phi: PH, axis, C, fwd, side, F, B };
}
function grid(THREE, nu, nv, fn, { uRep = 1, vRep = 1, colors = null, pole0 = false, pole1 = false, flip = false } = {}) {
  const pos = new Float32Array((nu + 1) * (nv + 1) * 3), uv = new Float32Array((nu + 1) * (nv + 1) * 2);
  const col = colors ? new Float32Array((nu + 1) * (nv + 1) * 3) : null;
  const P = new THREE.Vector3(), C = new THREE.Color();
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const k = j * (nu + 1) + i;
    fn(i % nu === 0 && i ? 0 : i, j, P);
    pos[k * 3] = P.x;
    pos[k * 3 + 1] = P.y;
    pos[k * 3 + 2] = P.z;
    uv[k * 2] = i / nu * uRep;
    uv[k * 2 + 1] = j / nv * vRep;
    if (col) {
      colors(i % nu, j, C);
      col[k * 3] = C.r;
      col[k * 3 + 1] = C.g;
      col[k * 3 + 2] = C.b;
    }
  }
  const idx = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    if (flip) idx.push(a, b, c, b, d, c);
    else idx.push(a, c, b, b, c, d);
  }
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g2.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  if (col) g2.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g2.setIndex(idx);
  g2.computeVertexNormals();
  const n = g2.attributes.normal.array;
  for (let j = 0; j <= nv; j++) {
    const a = j * (nu + 1), b = a + nu;
    for (let c = 0; c < 3; c++) {
      const m = (n[a * 3 + c] + n[b * 3 + c]) / 2;
      n[a * 3 + c] = n[b * 3 + c] = m;
    }
    const L = Math.hypot(n[a * 3], n[a * 3 + 1], n[a * 3 + 2]) || 1;
    for (let c = 0; c < 3; c++) {
      n[a * 3 + c] /= L;
      n[b * 3 + c] /= L;
    }
  }
  for (const [on, j] of [[pole0, 0], [pole1, nv]]) {
    if (!on) continue;
    let x = 0, y = 0, z = 0;
    for (let i = 0; i <= nu; i++) {
      const k = (j * (nu + 1) + i) * 3;
      x += n[k];
      y += n[k + 1];
      z += n[k + 2];
    }
    const L = Math.hypot(x, y, z) || 1;
    for (let i = 0; i <= nu; i++) {
      const k = (j * (nu + 1) + i) * 3;
      n[k] = x / L;
      n[k + 1] = y / L;
      n[k + 2] = z / L;
    }
  }
  return g2;
}
function depthOnly(THREE, { side = THREE.DoubleSide } = {}) {
  return new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, side });
}
function fillerCap(THREE, ring, { inset = 0.15, nv = 12 } = {}) {
  const n = ring.n, p = new THREE.Vector3(), nn = new THREE.Vector3();
  const g2 = grid(THREE, n, nv, (i, j, out) => {
    const t = j / nv, th = ring.T[i] * (1 - t);
    const gp = ring.G ? ring.G[i] : 0;
    hullAt(Math.max(1e-4, th), ring.phi[i], gp * Math.pow(1 - t, 1.5) - inset * t, out, nn);
  });
  const m = new THREE.Mesh(g2, depthOnly(THREE));
  m.renderOrder = -1;
  m.name = "filler";
  return m;
}
function faceShadow(THREE, h, alphaFn, { color = 1708556, opacity = 1, lift = 0.06 } = {}) {
  const fm = h.face, nV = fm.pos.length / 3;
  const pos = new Float32Array(nV * 3), al = new Float32Array(nV);
  const base = new THREE.BufferGeometry();
  base.setAttribute("position", new THREE.Float32BufferAttribute(fm.pos, 3));
  base.setIndex(fm.idx);
  base.computeVertexNormals();
  const nr = base.attributes.normal.array;
  for (let i = 0; i < nV; i++) {
    const x = fm.pos[i * 3], y = fm.pos[i * 3 + 1], z = fm.pos[i * 3 + 2];
    pos[i * 3] = x + nr[i * 3] * lift;
    pos[i * 3 + 1] = y + nr[i * 3 + 1] * lift;
    pos[i * 3 + 2] = z + nr[i * 3 + 2] * lift;
    al[i] = clamp(alphaFn(x, y, z));
  }
  const idx = [];
  for (let t = 0; t < fm.idx.length; t += 3) {
    const a = fm.idx[t], b = fm.idx[t + 1], c = fm.idx[t + 2];
    if (al[a] + al[b] + al[c] > 3e-3) idx.push(a, b, c);
  }
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g2.setAttribute("alpha", new THREE.BufferAttribute(al, 1));
  g2.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(color) }, uOp: { value: opacity } },
    vertexShader: "attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform vec3 uCol; uniform float uOp; varying float vA; void main(){ gl_FragColor = vec4(uCol, vA * uOp); }",
    transparent: true,
    depthWrite: false
  });
  const m = new THREE.Mesh(g2, mat);
  m.renderOrder = 1;
  m.name = "shadow";
  return m;
}

// lib/hatkit.js
function resample(pts, n) {
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k2 = 0; k2 < 16; k2++) {
      const t = k2 / 16, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  dense.push(pts[pts.length - 1].slice());
  const L = [0];
  for (let i = 1; i < dense.length; i++) L.push(L[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const out = [];
  let k = 0;
  for (let i = 0; i <= n; i++) {
    const s = i / n * L[L.length - 1];
    while (k < L.length - 2 && L[k + 1] < s) k++;
    const t = (s - L[k]) / (L[k + 1] - L[k] || 1);
    out.push([dense[k][0] + (dense[k + 1][0] - dense[k][0]) * t, dense[k][1] + (dense[k + 1][1] - dense[k][1]) * t]);
  }
  return out;
}
function crown(THREE, ring, profile, { nv = 30, hScale = null, dent = null, shade = null } = {}) {
  const profs = typeof profile === "function" ? Array.from({ length: ring.n + 1 }, (_, i) => resample(profile(i, ring.phi[i]), nv)) : null;
  const prof = profs ? profs[0] : resample(profile, nv);
  const n = ring.n, C = ring.C, A = ring.axis, Fw = ring.fwd, Sd = ring.side;
  const Rv = [], D = [], Rl = [];
  for (let i = 0; i <= n; i++) {
    const r = ring.P[i].clone().sub(C);
    r.projectOnPlane(A);
    Rv.push(r);
    Rl.push(r.length());
    D.push(r.clone().normalize());
  }
  const out0 = new THREE.Vector3();
  const pt = (i, j, out) => {
    const [r, h0] = profs ? profs[i][j] : prof[j];
    const hs = hScale ? hScale(i) : 1;
    let rr = r * Rl[i], hh = h0 * hs;
    if (dent) {
      const lx = r * Rv[i].dot(Sd), lf = r * Rv[i].dot(Fw);
      const d = dent(i, r, hh, lx, lf, ring.phi[i], j / nv);
      rr += d[0];
      hh += d[1];
    }
    const base = ring.P[i];
    out.copy(C).addScaledVector(D[i], rr).addScaledVector(A, hh);
    const dz = base.clone().sub(C).dot(A);
    out.addScaledVector(A, dz * (1 - j / nv));
    return out;
  };
  const geo = grid(THREE, n, nv, (i, j, out) => pt(i, j, out), { pole1: true, flip: true, colors: shade ? (i, j, c) => shade(i, j / nv, prof[j], c) : null });
  return { geo, pt, prof, profs, nv, D, Rl };
}
function brim(THREE, ring, { w = () => 5, curl = () => 0, th = 0.3, ns = 10, edge = 6, dark = 0.62, inset = 0.25, top = 1, ao = 0.3, topAo = 0.75 } = {}) {
  const n = ring.n, A = ring.axis, C = ring.C;
  const D = [];
  for (let i = 0; i <= n; i++) D.push(ring.P[i].clone().sub(C).projectOnPlane(A).normalize());
  const sec = [];
  for (let k = 0; k <= ns; k++) sec.push([k / ns, 1, null]);
  for (let k = 1; k < edge; k++) sec.push([1, 0, Math.PI / 2 - k / edge * Math.PI]);
  for (let k = ns; k >= 0; k--) sec.push([k / ns, -1, null]);
  const P = new THREE.Vector3(), Q = new THREE.Vector3(), T = new THREE.Vector3(), Nn = new THREE.Vector3();
  const mid = (i, s, out) => {
    const ww = w(i);
    out.copy(ring.P[i]).addScaledVector(D[i], -inset + (ww + inset) * s).addScaledVector(A, curl(i, s) - th * 0.5);
    return out;
  };
  const geo = grid(THREE, n, sec.length - 1, (i, j, out) => {
    const [s, side, ang] = sec[j];
    mid(i, s, P);
    mid(i, Math.min(1, s + 0.02), Q);
    mid(i, Math.max(0, s - 0.02), T);
    Q.sub(T).normalize();
    Nn.copy(A).addScaledVector(Q, -A.dot(Q)).normalize();
    if (ang === null) out.copy(P).addScaledVector(Nn, side * th * 0.5);
    else out.copy(P).addScaledVector(Nn, Math.sin(ang) * th * 0.5).addScaledVector(Q, Math.cos(ang) * th * 0.5);
  }, { colors: (i, j, c) => {
    const s = sec[j][0], side = sec[j][1], ang = sec[j][2];
    const kb = dark * (ao + (1 - ao) * smooth(0, 0.7, s)), kt = top * (topAo + (1 - topAo) * smooth(0, 0.35, s));
    const k = side > 0 ? kt : side < 0 ? kb : kb + (kt - kb) * (0.5 + 0.5 * Math.sin(ang));
    c.setRGB(k, k, k);
  }, uRep: Math.round(n / 8), vRep: 1 });
  return { geo, mid, D };
}
function crownBand(THREE, cr, ring, { j0 = 0, j1 = 4, out = 0.14, nu = null } = {}) {
  const n = ring.n, P = new THREE.Vector3(), Q = new THREE.Vector3(), Nn = new THREE.Vector3();
  const rows = [];
  for (let j = j0; j <= j1; j++) rows.push([j, 1]);
  rows.push([j1, 0]);
  const geo = grid(THREE, n, rows.length - 1, (i, k, o) => {
    const [j, on] = rows[k];
    cr.pt(i, j, P);
    cr.pt(i, Math.min(cr.nv, j + 1), Q);
    Nn.copy(cr.D[i]);
    o.copy(P).addScaledVector(Nn, on * out + 0.02);
  }, { uRep: 24, flip: true });
  return geo;
}
function hatRig(THREE, g2, ring) {
  const pivot = new THREE.Group();
  pivot.position.copy(ring.C);
  g2.add(pivot);
  const hat = new THREE.Group();
  hat.position.copy(ring.C).negate();
  pivot.add(hat);
  return { pivot, hat, y0: pivot.position.y, z0: pivot.position.z };
}

// lib/core.js
var clamp2 = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
var TAU = Math.PI * 2;
function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s = s * 1664525 + 1013904223 >>> 0;
    return s / 4294967296;
  };
}
var Ticker = class {
  constructor() {
    this.t = null;
    this.dt = 1 / 30;
    this.n = 0;
  }
  tick(t) {
    if (this.t == null || !isFinite(t)) {
      this.t = t;
      this.dt = 1 / 30;
      this.n++;
      return this.dt;
    }
    let dt = t - this.t;
    this.t = t;
    if (!(dt > 0)) dt = 0;
    else if (dt > 0.1) dt = 0.1;
    this.dt = dt;
    this.n++;
    return dt;
  }
};
var Spring = class {
  constructor(x = 0, k = 120, c = 12) {
    this.x = x;
    this.v = 0;
    this.k = k;
    this.c = c;
    this.target = x;
  }
  step(dt, target = this.target) {
    const sub = dt > 1 / 60 ? Math.ceil(dt * 60) : 1, h = dt / sub;
    for (let i = 0; i < sub; i++) {
      const a = this.k * (target - this.x) - this.c * this.v;
      this.v += a * h;
      this.x += this.v * h;
    }
    return this.x;
  }
};

// lib/tex.js
function canvas(w, h = w) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function texFrom(THREE, c, { srgb = true, repeat = null, wrap = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (wrap) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  }
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  return t;
}
function valueNoise(seed = 1, per = 16) {
  const r = rng(seed), N = per, tab = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) tab[i] = r();
  const at = (x, y) => tab[(y % N + N) % N * N + (x % N + N) % N];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function normalFromHeight(THREE, H, w, h, strength = 2, repeat = null) {
  const c = canvas(w, h), x = c.getContext("2d"), img = x.createImageData(w, h), d = img.data;
  const at = (i, j) => H[(j + h) % h * w + (i + w) % w];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const dx = (at(i + 1, j) - at(i - 1, j)) * strength, dy = (at(i, j + 1) - at(i, j - 1)) * strength;
    let nx = -dx, ny = dy, nz = 1;
    const L = Math.hypot(nx, ny, nz);
    nx /= L;
    ny /= L;
    nz /= L;
    const k = (j * w + i) * 4;
    d[k] = (nx * 0.5 + 0.5) * 255;
    d[k + 1] = (ny * 0.5 + 0.5) * 255;
    d[k + 2] = (nz * 0.5 + 0.5) * 255;
    d[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return texFrom(THREE, c, { srgb: false, repeat });
}
function heightField(w, h, fn) {
  const H = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) H[j * w + i] = fn(i / w, j / h);
  return H;
}

// lib/mats.js
var V2 = (THREE, a, b = a) => new THREE.Vector2(a, b);
function lining(THREE, color = 1906451) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.95, side: THREE.BackSide, envMapIntensity: 0.25, transparent: true });
}
function grosgrain(THREE, color, { rep = [40, 2], ...o } = {}) {
  const H = heightField(8, 64, (u, v) => 0.5 + 0.5 * Math.sin(v * 64 * Math.PI));
  const nrm = normalFromHeight(THREE, H, 8, 64, 1.6, rep);
  return new THREE.MeshPhysicalMaterial(Object.assign({ color: new THREE.Color(color), roughness: 0.72, sheen: 0.4, sheenRoughness: 0.45, sheenColor: new THREE.Color(color).lerp(new THREE.Color(1, 1, 1), 0.35), normalMap: nrm, normalScale: V2(THREE, 0.7), envMapIntensity: 0.4, transparent: true }, o));
}
function straw(THREE, { base = [212, 182, 128], rep = [30, 6], seed = 7 } = {}) {
  const S = 128, c = canvas(S, S), x = c.getContext("2d"), img = x.createImageData(S, S), d = img.data;
  const n = valueNoise(seed, 64), Hh = new Float32Array(S * S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const ci = Math.floor(i / 8), cj = Math.floor(j / 8), fu = i % 8 / 8, fv = j % 8 / 8;
    const over = (ci + cj) % 2 === 0;
    const strand = over ? Math.sin(fv * Math.PI) : Math.sin(fu * Math.PI);
    const fib = n(i / 1.5 + (over ? 0 : 40), j / 6 + (over ? 30 : 0));
    const k = j * S + i;
    Hh[k] = strand * 0.8 + fib * 0.2;
    const sh = 0.72 + 0.32 * strand + (fib - 0.5) * 0.18;
    d[k * 4] = Math.min(255, base[0] * sh);
    d[k * 4 + 1] = Math.min(255, base[1] * sh);
    d[k * 4 + 2] = Math.min(255, base[2] * sh * 0.96);
    d[k * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const map = texFrom(THREE, c, { repeat: rep });
  const nrm = normalFromHeight(THREE, Hh, S, S, 3.2, rep);
  return new THREE.MeshPhysicalMaterial({ map, normalMap: nrm, normalScale: V2(THREE, 0.85), roughness: 0.7, sheen: 0.3, sheenColor: new THREE.Color(1, 0.92, 0.75), envMapIntensity: 0.6, transparent: true });
}

// lib/expr.js
var g = (b, k) => {
  const v = b ? b[k] : 0;
  return typeof v === "number" && v === v ? v : 0;
};
var avg = (b, a, c) => (g(b, a) + g(b, c)) / 2;
var smileOf = (b) => b && typeof b.smile === "number" ? b.smile : avg(b, "mouthSmileLeft", "mouthSmileRight");
var CHANNELS = {
  smile: (b) => smileOf(b),
  jaw: (b) => g(b, "jawOpen"),
  // labbra a "o" / bacio / guance gonfie (soffiare): il più forte dei tre
  pucker: (b) => Math.max(g(b, "mouthPucker"), g(b, "mouthFunnel"), g(b, "cheekPuff")),
  browUp: (b) => Math.max(g(b, "browInnerUp"), avg(b, "browOuterUpLeft", "browOuterUpRight")),
  browDown: (b) => avg(b, "browDownLeft", "browDownRight"),
  wide: (b) => avg(b, "eyeWideLeft", "eyeWideRight"),
  eyesClosed: (b) => b && typeof b.blink === "number" ? b.blink : avg(b, "eyeBlinkLeft", "eyeBlinkRight"),
  // broncio: angoli giù o labbro inferiore in fuori; un sorriso lo annulla
  // fronte aggrottata o angoli della bocca giù (niente labbro in fuori: con la barba sale da solo)
  frown: (b) => Math.max(avg(b, "browDownLeft", "browDownRight"), avg(b, "mouthFrownLeft", "mouthFrownRight")) * (1 - 0.8 * clamp2(smileOf(b) * 1.5)),
  pout: (b) => Math.max(avg(b, "mouthFrownLeft", "mouthFrownRight"), g(b, "mouthShrugLower") * 0.85, g(b, "mouthRollLower") * 0.6) * (1 - 0.8 * clamp2(smileOf(b) * 1.5))
};
var Expr = class {
  constructor(names = Object.keys(CHANNELS)) {
    this.names = names;
    this.v = {};
    this.raw = {};
    this.ready = true;
    this.gate = 1;
    this._first = true;
    for (const n of names) {
      this.v[n] = 0;
      this.raw[n] = 0;
    }
  }
  // bs: espressioni calibrate del motore; h: helper del motore (h.calib = { ready, progress })
  update(bs, dt, h) {
    const c = h && h.calib;
    const target = !c || c.ready ? 1 : clamp2((c.progress - 0.5) * 2);
    if (this._first) {
      this.gate = target;
      this._first = false;
    } else this.gate += (target - this.gate) * Math.min(1, dt * 4);
    if (target === 1 && this.gate > 0.995) this.gate = 1;
    this.ready = this.gate > 0.98;
    for (let i = 0; i < this.names.length; i++) {
      const n = this.names[i], x = clamp2(CHANNELS[n](bs));
      this.raw[n] = x;
      this.v[n] = x * this.gate;
    }
    return this.v;
  }
};
var Trigger = class {
  constructor({ on = 0.55, off = 0.3, hold = 0, cooldown = 0.8 } = {}) {
    Object.assign(this, { on, off, hold, cooldown });
    this.active = false;
    this.above = 0;
    this.cool = 0;
    this.fired = false;
    this.released = false;
    this.since = 0;
  }
  update(v, dt) {
    this.fired = false;
    this.released = false;
    this.cool -= dt;
    if (!this.active) {
      if (v >= this.on) {
        this.above += dt;
        if (this.above >= this.hold && this.cool <= 0) {
          this.active = true;
          this.fired = true;
          this.cool = this.cooldown;
          this.since = 0;
        }
      } else this.above = 0;
    } else {
      this.since += dt;
      if (v <= this.off) {
        this.active = false;
        this.above = 0;
        this.released = true;
      }
    }
    return this.fired;
  }
};
var Rel = class {
  constructor({ up = 0.035, down = 3 } = {}) {
    this.up = up;
    this.down = down;
    this.b = 0;
    this.init = false;
    this.v = 0;
  }
  update(x, dt, ready = true) {
    if (!ready) {
      this.init = false;
      this.v = 0;
      return 0;
    }
    if (!this.init) {
      this.b = x;
      this.init = true;
    }
    const k = x < this.b ? this.down : this.up;
    this.b += (x - this.b) * (1 - Math.exp(-k * dt));
    this.v = clamp2((x - this.b) / Math.max(0.3, 1 - this.b));
    return this.v;
  }
};

// fx/paglietta.js
var meta = { label: "Paglietta", labelEn: "Straw boater", labelFr: "Canotier", labelDe: "Kreiss\xE4ge-Strohhut", category: "accessori", icon: "\u{1F452}" };
async function build(THREE, h) {
  const g2 = new THREE.Group();
  g2.name = "paglietta";
  const ring = bandRing(THREE, { yF: 8.7, yB: 5.4, n: 96, gap: (p) => 0.35 + 0.6 * (1 - Math.pow(Math.cos(p) * 0.5 + 0.5, 3)) });
  const R = hatRig(THREE, g2, ring), hat = R.hat;
  const profile = [[1, 0], [0.995, 2], [0.985, 5.2], [0.978, 6.7], [0.965, 7.25], [0.93, 7.45], [0.7, 7.5], [0.35, 7.5], [0, 7.5]];
  const cr = crown(THREE, ring, profile, { nv: 26 });
  const strawC = straw(THREE, { rep: [40, 7], base: [178, 142, 92] });
  {
    const pos = cr.geo.attributes.position, n = ring.n, nv = cr.nv, col = new Float32Array(pos.count * 3);
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= n; i++) {
      const k = j * (n + 1) + i, v = j / nv;
      const s = 0.86 + 0.14 * smooth(0, 0.5, v);
      col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = s;
    }
    cr.geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    strawC.vertexColors = true;
  }
  hat.add(new THREE.Mesh(cr.geo, strawC));
  hat.add(new THREE.Mesh(cr.geo, lining(THREE, 2760726)));
  {
    const c = canvas(4, 128), x = c.getContext("2d");
    const bands = [["#1b2340", 0, 0.22], ["#e9e1cf", 0.22, 0.27], ["#7a1d2a", 0.27, 0.73], ["#e9e1cf", 0.73, 0.78], ["#1b2340", 0.78, 1]];
    for (const [col, a, b] of bands) {
      x.fillStyle = col;
      x.fillRect(0, Math.round(a * 128), 4, Math.ceil((b - a) * 128));
    }
    const map = texFrom(THREE, c, { wrap: true });
    map.repeat.set(1, 1);
    const rib = grosgrain(THREE, 16777215, { rep: [70, 1], map });
    hat.add(new THREE.Mesh(crownBand(THREE, cr, ring, { j0: 0, j1: 12, out: 0.13 }), rib));
  }
  const br = brim(THREE, ring, {
    th: 0.32,
    ns: 12,
    edge: 6,
    dark: 0.55,
    ao: 0.25,
    inset: 0.3,
    w: (i) => {
      const c = Math.cos(ring.phi[i]);
      return 5.2 + 0.4 * c * c;
    },
    curl: (i, s) => -0.25 * Math.pow(s, 3)
  });
  const strawB = straw(THREE, { rep: [4, 10], base: [182, 146, 94] });
  strawB.vertexColors = true;
  hat.add(new THREE.Mesh(br.geo, strawB));
  g2.add(fillerCap(THREE, ring));
  const shadow = faceShadow(THREE, h, (x, y, z) => smooth(5.8, 8.2, y) * smooth(-1, 2.5, z) * 0.45, { lift: 0.2 });
  g2.add(shadow);
  const U = g2.userData;
  Object.assign(U, R, { shadow });
  U.ex = new Expr(["smile", "browUp"]);
  U.rel = new Rel();
  U.tick = new Ticker();
  U.smileT = new Trigger({ on: 0.6, off: 0.3, hold: 0.12, cooldown: 1.2 });
  U.hop = new Spring(0, 260, 9);
  U.lift = new Spring(0, 160, 18);
  U.spin = new Spring(0, 90, 8);
  return g2;
}
function update(g2, bs, t, h) {
  const U = g2.userData, dt = U.tick.tick(t);
  const v = U.ex.update(bs, dt, h);
  const up = U.rel.update(v.browUp, dt, U.ex.ready);
  if (U.smileT.update(v.smile, dt)) {
    U.hop.v += 26;
    U.spin.v += 2.4;
  }
  const hop = U.hop.step(dt, 0), lift = U.lift.step(dt, up * 0.55), spin = U.spin.step(dt, 0);
  U.pivot.position.y = U.y0 + lift + Math.max(0, hop) * 0.55;
  U.pivot.rotation.set(Math.max(0, hop) * 0.02, spin * 0.12, -spin * 0.04);
  U.shadow.material.uniforms.uOp.value = clamp(1 - lift * 0.4 - Math.max(0, hop) * 0.12);
}
export {
  build as default,
  meta,
  update
};
